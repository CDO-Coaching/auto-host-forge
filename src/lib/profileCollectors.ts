// Collecteurs automatiques pour la carte coureur : REG (adhérence) et MEN
// (écart RPE annoncé / RPE théorique de la zone), calculés sur une fenêtre
// glissante de 8 semaines depuis les données déjà suivies dans l'app.
import { supabase } from "@/integrations/supabase/client";
import { subWeeks } from "date-fns";

// RPE théorique par intensité moyenne (%VMA en course, proxy de zone d'effort)
function theoreticalRpe(intensityPct: number): number {
  if (intensityPct < 60) return 2;
  if (intensityPct < 70) return 3;
  if (intensityPct < 80) return 5;
  if (intensityPct < 90) return 7;
  return 9;
}

export interface AutoMeasures {
  adherence?: number; // REG (%)
  rpeGap?: number;    // MEN (points)
}

/** Calcule REG et MEN sur les 8 dernières semaines glissantes pour un athlète. */
export async function collectAutoMeasures(athleteId: string): Promise<AutoMeasures> {
  const since = subWeeks(new Date(), 8);

  const { data: weeks } = await supabase
    .from("training_weeks")
    .select("id")
    .eq("athlete_id", athleteId)
    .gte("created_at", since.toISOString());

  const weekIds = (weeks || []).map((w: any) => w.id);
  if (weekIds.length === 0) return {};

  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("id, completed_at, session_rpe, cardio_average_intensity, session_type")
    .in("week_id", weekIds);

  const list = (sessions || []) as any[];
  if (list.length === 0) return {};

  // REG : % de séances programmées réalisées
  const adherence = Math.round((list.filter((s) => s.completed_at != null).length / list.length) * 100);

  // MEN : écart moyen |RPE annoncé - RPE théorique| sur séances cardio avec les deux valeurs
  const withBoth = list.filter(
    (s) => s.completed_at != null && s.session_rpe != null && s.cardio_average_intensity != null
  );
  let rpeGap: number | undefined;
  if (withBoth.length >= 6) {
    const gaps = withBoth.map((s) => Math.abs(Number(s.session_rpe) - theoreticalRpe(Number(s.cardio_average_intensity))));
    rpeGap = Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 100) / 100;
  }

  return { adherence, rpeGap };
}
