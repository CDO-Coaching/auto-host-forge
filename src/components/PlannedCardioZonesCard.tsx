/**
 * PlannedCardioZonesCard
 * Affiche la répartition d'intensité planifiée par sport (Course / Vélo / Natation)
 * pour la semaine en cours, en lisant cardio_content des session_exercises non validés.
 *
 * Les zones sont basées sur le % VMA de chaque step :
 *   Z1 < 60% · Z2 60-70% · Z3 70-80% · Z4 80-90% · Z5 ≥ 90%
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateCardioSessionDuration, getStepSpeed } from "@/lib/cardioCalculations";
import type { CardioData, CardioStep, CardioBlock } from "@/components/CardioStepBuilder";
import { getWeekNumber, getWeekYear } from "@/lib/weekUtils";
import { Activity } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SportType = "course" | "velo" | "natation";

interface VMAZone {
  zone: number;
  label: string;
  min: number;   // % VMA min (exclusif bas)
  max: number;   // % VMA max (inclusif)
  bgBar: string;
  bgCard: string;
  text: string;
}

const VMA_ZONES: VMAZone[] = [
  { zone: 1, label: "Z1 · Récup",     min: 0,   max: 60,  bgBar: "bg-blue-500",   bgCard: "bg-blue-500/10",   text: "text-blue-400"   },
  { zone: 2, label: "Z2 · Endurance", min: 60,  max: 70,  bgBar: "bg-green-500",  bgCard: "bg-green-500/10",  text: "text-green-400"  },
  { zone: 3, label: "Z3 · Tempo",     min: 70,  max: 80,  bgBar: "bg-yellow-400", bgCard: "bg-yellow-400/10", text: "text-yellow-400" },
  { zone: 4, label: "Z4 · Seuil",     min: 80,  max: 90,  bgBar: "bg-orange-500", bgCard: "bg-orange-500/10", text: "text-orange-400" },
  { zone: 5, label: "Z5 · VMA",       min: 90,  max: 999, bgBar: "bg-red-500",    bgCard: "bg-red-500/10",    text: "text-red-400"    },
];

const SPORT_LABELS: Record<SportType, string> = {
  course:   "🏃 Course",
  velo:     "🚴 Vélo",
  natation: "🏊 Natation",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}min${s}s` : `${m}min`;
}

function getZoneForVmaPct(pct: number): number {
  for (const z of VMA_ZONES) {
    if (pct < z.max) return z.zone;
  }
  return 5;
}

/**
 * Calcule la durée en secondes de chaque step d'un cardio_content
 * et la ventile dans les zones VMA.
 */
function computePlannedZones(
  cardioData: CardioData,
  vma: number | null,
): Record<number, number> {
  const totals: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const steps  = cardioData.steps  || [];
  const blocks = cardioData.blocks || [];

  const processStep = (step: CardioStep, repeat = 1) => {
    // Durée du step
    let duration = 0;
    if (step.effort_type === "duration") {
      duration = step.duration || 0;
    } else if (step.effort_type === "distance" && step.distance) {
      const speed = getStepSpeed(step, vma);
      if (speed > 0) {
        duration = (step.distance / 1000 / speed) * 3600;
      }
    }
    if (duration <= 0) return;

    // Zone
    let zone = 1;
    if (step.movement_type === "marche") {
      zone = 1; // récup
    } else if (step.vma_percentage) {
      zone = getZoneForVmaPct(step.vma_percentage);
    } else if (step.rpe) {
      // Conversion RPE → zone approximative
      zone = step.rpe <= 4 ? 1 : step.rpe <= 6 ? 2 : step.rpe <= 7 ? 3 : step.rpe <= 8 ? 4 : 5;
    } else {
      zone = 2; // par défaut endurance
    }

    totals[zone] += duration * repeat;
  };

  // Blocs répétés
  for (const block of blocks) {
    const blockSteps = steps.filter((s) => s.block_id === block.id);
    for (const step of blockSteps) {
      processStep(step, block.repetitions);
    }
  }
  // Steps libres
  for (const step of steps.filter((s) => !s.block_id)) {
    processStep(step);
  }

  return totals;
}

// ─── Composant ────────────────────────────────────────────────────────────────

interface PlannedCardioZonesCardProps {
  athleteId: string;
  defaultSport?: SportType;
}

interface SessionData {
  name: string;
  sport: SportType;
  zones: Record<number, number>;
  totalSeconds: number;
}

export function PlannedCardioZonesCard({ athleteId, defaultSport = "course" }: PlannedCardioZonesCardProps) {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [selectedSport, setSelectedSport] = useState<SportType>(defaultSport);
  const [vma, setVma] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // VMA de l'athlète
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("vma")
        .eq("id", athleteId)
        .single();
      const athleteVma = profile?.vma ?? null;
      setVma(athleteVma);

      // Semaine courante
      const today = new Date();
      const weekNum  = getWeekNumber(today);
      const weekYear = getWeekYear(today);

      // Week ID de la semaine courante
      const { data: weekRows } = await supabase
        .from("training_weeks")
        .select("id")
        .eq("athlete_id", athleteId)
        .eq("week_number", weekNum)
        .eq("year", weekYear);

      const weekIds = (weekRows || []).map((w) => w.id);
      if (weekIds.length === 0) { setLoading(false); return; }

      // Toutes les séances cardio de la semaine (planifiées ET validées)
      // On affiche la structure planifiée (cardio_content) indépendamment du statut
      const { data: trainingSessions } = await supabase
        .from("training_sessions")
        .select("id, name, session_type")
        .in("week_id", weekIds)
        .eq("session_type", "cardio");

      const sessionIds = (trainingSessions || []).map((s) => s.id);
      if (sessionIds.length === 0) { setLoading(false); return; }

      // Exercices cardio avec cardio_content et cardio_sport
      const { data: exercises } = await supabase
        .from("session_exercises")
        .select("session_id, cardio_content, cardio_sport")
        .in("session_id", sessionIds)
        .not("cardio_content", "is", null);

      const result: SessionData[] = [];
      for (const ex of exercises || []) {
        if (!ex.cardio_content) continue;
        const sport = (ex.cardio_sport as SportType) || "course";
        let cardioData: CardioData;
        try {
          cardioData = typeof ex.cardio_content === "string"
            ? JSON.parse(ex.cardio_content)
            : ex.cardio_content as CardioData;
        } catch { continue; }

        const zones = computePlannedZones(cardioData, athleteVma);
        const totalSeconds = Object.values(zones).reduce((s, v) => s + v, 0);
        if (totalSeconds <= 0) continue;

        const session = (trainingSessions || []).find((s) => s.id === ex.session_id);
        result.push({
          name: session?.name || "Séance cardio",
          sport,
          zones,
          totalSeconds,
        });
      }

      setSessions(result);
      setLoading(false);
    };
    load();
  }, [athleteId]);

  if (loading) return null;

  const availableSports = [...new Set(sessions.map((s) => s.sport))] as SportType[];
  if (availableSports.length === 0) return null;

  // Sélectionne le premier sport disponible si le sport actuel n'est pas dispo
  const activeSport = availableSports.includes(selectedSport) ? selectedSport : availableSports[0];

  // Agrège les zones pour le sport sélectionné
  const sportSessions = sessions.filter((s) => s.sport === activeSport);
  const merged: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalSec = 0;
  for (const s of sportSessions) {
    for (let z = 1; z <= 5; z++) merged[z] += s.zones[z] || 0;
    totalSec += s.totalSeconds;
  }

  const lowSec  = (merged[1] || 0) + (merged[2] || 0) + (merged[3] || 0);
  const highSec = (merged[4] || 0) + (merged[5] || 0);
  const lowPct  = totalSec > 0 ? Math.round((lowSec  / totalSec) * 100) : 0;
  const highPct = 100 - lowPct;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Intensité programmée — semaine en cours
          {vma && <span className="text-xs font-normal text-muted-foreground">VMA {vma} km/h</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">

        {/* Onglets sport */}
        <div className="flex gap-1.5 flex-wrap">
          {availableSports.map((sport) => (
            <button
              key={sport}
              onClick={() => setSelectedSport(sport)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                activeSport === sport
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {SPORT_LABELS[sport]}
              {sessions.filter((s) => s.sport === sport).length > 1 &&
                ` · ${sessions.filter((s) => s.sport === sport).length} séances`}
            </button>
          ))}
        </div>

        {/* Barre fine basse / haute intensité */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-green-400 font-semibold">
              Z1–Z3 · {lowPct}% <span className="font-normal text-muted-foreground">{formatTime(lowSec)}</span>
            </span>
            <span className="text-red-400 font-semibold">
              <span className="font-normal text-muted-foreground">{formatTime(highSec)}</span> {highPct}% · Z4–Z5
            </span>
          </div>
          <div className="flex h-1.5 w-full rounded-full overflow-hidden">
            <div className="bg-green-500 transition-all" style={{ width: `${lowPct}%` }} />
            <div className="bg-red-500 transition-all" style={{ width: `${highPct}%` }} />
          </div>
        </div>

        {/* Barre détaillée empilée */}
        <div className="flex h-4 w-full rounded-full overflow-hidden gap-px">
          {VMA_ZONES.map((z) => {
            const sec = merged[z.zone] || 0;
            const pct = totalSec > 0 ? (sec / totalSec) * 100 : 0;
            if (pct < 0.5) return null;
            return (
              <div
                key={z.zone}
                className={`${z.bgBar} transition-all`}
                style={{ width: `${pct}%` }}
                title={`${z.label} · ${formatTime(sec)} (${Math.round(pct)}%)`}
              />
            );
          })}
        </div>

        {/* Cases par zone */}
        <div className="grid grid-cols-5 gap-1">
          {VMA_ZONES.map((z) => {
            const sec = merged[z.zone] || 0;
            const pct = totalSec > 0 ? Math.round((sec / totalSec) * 100) : 0;
            const isActive = sec > 0;
            return (
              <div
                key={z.zone}
                className={`rounded-lg border p-2 text-center transition-opacity ${
                  isActive ? "border-border/50 bg-secondary/40" : "border-border/20 opacity-30"
                }`}
              >
                <div className={`text-xs font-bold ${z.text}`}>Z{z.zone}</div>
                <div className="text-[10px] text-muted-foreground leading-none mb-1">
                  {z.zone === 1 ? "<60%" : `${VMA_ZONES[z.zone - 1].min}–${z.zone === 5 ? "100" : VMA_ZONES[z.zone - 1].max}%`} VMA
                </div>
                {isActive ? (
                  <>
                    <div className="text-[11px] font-semibold text-foreground">{pct}%</div>
                    <div className="text-[10px] text-muted-foreground">{formatTime(sec)}</div>
                  </>
                ) : (
                  <div className="text-[10px] text-muted-foreground">—</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Total */}
        <p className="text-[11px] text-muted-foreground text-right">
          Total planifié : <span className="font-medium text-foreground">{formatTime(totalSec)}</span>
          {sportSessions.length > 1 && ` (${sportSessions.length} séances)`}
        </p>

      </CardContent>
    </Card>
  );
}
