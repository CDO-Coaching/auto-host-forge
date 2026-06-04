/**
 * PlannedCardioZonesCard
 * Affiche la répartition d'intensité programmée par sport (Course / Vélo / Natation)
 * pour la semaine affichée, en lisant directement les sessions et exercices déjà
 * chargés en mémoire — réactif en temps réel, pas de fetch Supabase supplémentaire.
 *
 * Zones basées sur le % VMA de chaque step :
 *   Z1 < 60% · Z2 60-70% · Z3 70-80% · Z4 80-90% · Z5 ≥ 90%
 */

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStepSpeed } from "@/lib/cardioCalculations";
import type { CardioData, CardioStep } from "@/components/CardioStepBuilder";
import { Activity } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SportType = "course" | "velo" | "natation";

interface VMAZone {
  zone: number;
  label: string;
  max: number;
  bgBar: string;
  bgCard: string;
  text: string;
  pctLabel: string;
}

const VMA_ZONES: VMAZone[] = [
  { zone: 1, label: "Z1 · Récup",     max: 60,  bgBar: "bg-blue-500",   bgCard: "bg-blue-500/10",   text: "text-blue-400",   pctLabel: "<60%" },
  { zone: 2, label: "Z2 · Endurance", max: 70,  bgBar: "bg-green-500",  bgCard: "bg-green-500/10",  text: "text-green-400",  pctLabel: "60–70%" },
  { zone: 3, label: "Z3 · Tempo",     max: 80,  bgBar: "bg-yellow-400", bgCard: "bg-yellow-400/10", text: "text-yellow-400", pctLabel: "70–80%" },
  { zone: 4, label: "Z4 · Seuil",     max: 90,  bgBar: "bg-orange-500", bgCard: "bg-orange-500/10", text: "text-orange-400", pctLabel: "80–90%" },
  { zone: 5, label: "Z5 · VMA",       max: 999, bgBar: "bg-red-500",    bgCard: "bg-red-500/10",    text: "text-red-400",    pctLabel: "≥90%" },
];

const SPORT_LABELS: Record<SportType, string> = {
  course:   "🏃 Course",
  velo:     "🚴 Vélo",
  natation: "🏊 Natation",
};

export interface PlannedSession {
  id: number;
  session_type: string;
}
export interface PlannedExercise {
  cardio_sport?: string;
  cardio_content?: string;
}

interface PlannedCardioZonesCardProps {
  sessions: PlannedSession[];
  sessionExercises: Record<number, PlannedExercise[]>;
  athleteVma: number | null;
  defaultSport?: SportType;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (seconds <= 0) return "0s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}min${s}s` : `${m}min`;
}

function getZone(vmaPct: number): number {
  for (const z of VMA_ZONES) {
    if (vmaPct < z.max) return z.zone;
  }
  return 5;
}

function computeZonesFromCardio(
  cardioData: CardioData,
  vma: number | null,
): Record<number, number> {
  const totals: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const steps  = cardioData.steps  || [];
  const blocks = cardioData.blocks || [];

  const addStep = (step: CardioStep, repeat = 1) => {
    let duration = 0;
    if (step.effort_type === "duration") {
      duration = step.duration || 0;
    } else if (step.effort_type === "distance" && step.distance) {
      const speed = getStepSpeed(step, vma);
      if (speed > 0) duration = (step.distance / 1000 / speed) * 3600;
    }
    if (duration <= 0) return;

    let zone = 2; // défaut endurance
    if (step.movement_type === "marche") {
      zone = 1;
    } else if (step.vma_percentage) {
      zone = getZone(step.vma_percentage);
    } else if (step.rpe) {
      zone = step.rpe <= 4 ? 1 : step.rpe <= 6 ? 2 : step.rpe <= 7 ? 3 : step.rpe <= 8 ? 4 : 5;
    }
    totals[zone] += duration * repeat;
  };

  for (const block of blocks) {
    const blockSteps = steps.filter((s) => s.block_id === block.id);
    for (const step of blockSteps) addStep(step, block.repetitions);
  }
  for (const step of steps.filter((s) => !s.block_id)) addStep(step);

  return totals;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function PlannedCardioZonesCard({
  sessions,
  sessionExercises,
  athleteVma,
  defaultSport = "course",
}: PlannedCardioZonesCardProps) {
  const [selectedSport, setSelectedSport] = useState<SportType>(defaultSport);

  // Calcul dérivé des props — réactif automatiquement
  const { byPort, availableSports } = useMemo(() => {
    const byPort: Record<SportType, { zones: Record<number, number>; totalSec: number; count: number }> = {
      course:   { zones: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, totalSec: 0, count: 0 },
      velo:     { zones: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, totalSec: 0, count: 0 },
      natation: { zones: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, totalSec: 0, count: 0 },
    };

    for (const session of sessions) {
      if (session.session_type !== "cardio") continue;
      const exercises = sessionExercises[session.id] || [];
      for (const ex of exercises) {
        if (!ex.cardio_content) continue;
        const sport = (ex.cardio_sport as SportType) || "course";
        if (!byPort[sport]) continue;
        let cardioData: CardioData;
        try {
          cardioData = typeof ex.cardio_content === "string"
            ? JSON.parse(ex.cardio_content)
            : ex.cardio_content as CardioData;
        } catch { continue; }

        const zones = computeZonesFromCardio(cardioData, athleteVma);
        const sec = Object.values(zones).reduce((s, v) => s + v, 0);
        if (sec <= 0) continue;

        byPort[sport].count++;
        byPort[sport].totalSec += sec;
        for (let z = 1; z <= 5; z++) byPort[sport].zones[z] += zones[z] || 0;
      }
    }

    const availableSports = (Object.keys(byPort) as SportType[]).filter(
      (s) => byPort[s].count > 0
    );
    return { byPort, availableSports };
  }, [sessions, sessionExercises, athleteVma]);

  if (availableSports.length === 0) return null;

  const activeSport = availableSports.includes(selectedSport) ? selectedSport : availableSports[0];
  const { zones: merged, totalSec, count } = byPort[activeSport];

  const lowSec  = (merged[1] || 0) + (merged[2] || 0) + (merged[3] || 0);
  const highSec = (merged[4] || 0) + (merged[5] || 0);
  const lowPct  = totalSec > 0 ? Math.round((lowSec  / totalSec) * 100) : 0;
  const highPct = 100 - lowPct;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Intensité programmée — semaine affichée
          {athleteVma && (
            <span className="text-xs font-normal text-muted-foreground">VMA {athleteVma} km/h</span>
          )}
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
              {byPort[sport].count > 1 && ` · ${byPort[sport].count} séances`}
            </button>
          ))}
        </div>

        {/* Barre fine basse / haute intensité */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-green-400 font-semibold">
              Z1–Z3 · {lowPct}%{" "}
              <span className="font-normal text-muted-foreground">{formatTime(lowSec)}</span>
            </span>
            <span className="text-red-400 font-semibold">
              <span className="font-normal text-muted-foreground">{formatTime(highSec)}</span>{" "}
              {highPct}% · Z4–Z5
            </span>
          </div>
          <div className="flex h-1.5 w-full rounded-full overflow-hidden">
            <div className="bg-green-500 transition-all" style={{ width: `${lowPct}%` }} />
            <div className="bg-red-500 transition-all" style={{ width: `${highPct}%` }} />
          </div>
        </div>

        {/* Barre détaillée */}
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

        {/* Cases */}
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
                <div className="text-[10px] text-muted-foreground leading-none mb-1">{z.pctLabel} VMA</div>
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

        <p className="text-[11px] text-muted-foreground text-right">
          Total : <span className="font-medium text-foreground">{formatTime(totalSec)}</span>
          {count > 1 && ` · ${count} séances`}
        </p>

      </CardContent>
    </Card>
  );
}
