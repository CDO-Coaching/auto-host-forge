/**
 * Helper d'envoi d'une séance cardio (test) dans la semaine d'un athlète,
 * SANS toucher au reste du programme. Utilisé par les outils VMA/calibration.
 */
import { supabase } from "@/integrations/supabase/client";
import { getWeekNumber, getWeekYear } from "@/lib/weekUtils";
import { calculateCardioMetrics } from "@/lib/cardioCalculations";

export interface SendCardioTestOptions {
  athleteId: string;
  targetWeek?: { week: number; year: number }; // sinon semaine calendaire courante
  name: string;            // nom de la séance
  exerciceLabel: string;   // libellé de l'exercice cardio
  cardioContent: { steps: any[]; blocks: any[] };
  commentaire: string;     // consignes affichées au sportif
  vma: number | null;      // pour le calcul des métriques (peut être null)
}

/** Crée la séance cardio dans la semaine cible. Renvoie le numéro de semaine. */
export async function sendCardioTestSession(opts: SendCardioTestOptions): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("non connecté");

  const today = new Date();
  const week = opts.targetWeek?.week ?? getWeekNumber(today);
  const year = opts.targetWeek?.year ?? getWeekYear(today);

  // Semaine : réutiliser si elle existe, sinon créer (sans rien supprimer)
  let weekId: string | null = null;
  // Même tri que le chargement de la prog (semaine la plus récente) pour éviter
  // d'insérer dans un enregistrement de semaine différent de celui affiché.
  const { data: weeks } = await supabase.from("training_weeks")
    .select("id").eq("athlete_id", opts.athleteId).eq("week_number", week).eq("year", year)
    .order("created_at", { ascending: false }).limit(1);
  if (weeks && weeks.length) weekId = (weeks[0] as any).id;
  else {
    const { data: w, error: we } = await supabase.from("training_weeks")
      .insert({ coach_id: user.id, athlete_id: opts.athleteId, week_number: week, year, validated: true, validated_at: new Date().toISOString() })
      .select("id").single();
    if (we) throw we;
    weekId = (w as any).id;
  }

  const { data: existing } = await supabase.from("training_sessions").select("session_number").eq("week_id", weekId);
  const nextNum = ((existing || []) as any[]).reduce((m, s) => Math.max(m, s.session_number || 0), 0) + 1;

  const metrics = calculateCardioMetrics(opts.cardioContent as any, opts.vma);
  const finite = (n: number) => (Number.isFinite(n) ? n : 0);
  // L'intensité moyenne est soumise à une contrainte en base (0-100 %) :
  // un test peut dépasser 100 % VMA (ex: Vaussenat 25 km/h) → on borne.
  const clampIntensity = (n: number) => Math.max(0, Math.min(100, Math.round(finite(n))));

  const { data: sess, error: se } = await supabase.from("training_sessions").insert({
    week_id: weekId, session_number: nextNum, name: opts.name, session_type: "cardio",
    cardio_total_distance_km: finite(metrics.totalDistanceKm),
    cardio_total_duration_minutes: finite(metrics.totalDurationMinutes),
    cardio_average_intensity: clampIntensity(metrics.averageIntensity),
  } as any).select("id").single();
  if (se) throw new Error(`training_sessions: ${se.message || JSON.stringify(se)}`);

  const { error: ee } = await supabase.from("session_exercises").insert({
    session_id: (sess as any).id, exercise_order: 1, exercice: opts.exerciceLabel,
    cardio_sport: "course", cardio_content: JSON.stringify(opts.cardioContent),
    recuperation: "", reps: "", series: "", charge: "", rpe: "", tempo: "",
    commentaire: opts.commentaire,
  } as any);
  if (ee) throw new Error(`session_exercises: ${ee.message || JSON.stringify(ee)}`);

  return week;
}
