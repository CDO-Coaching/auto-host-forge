/**
 * WeeklyHRZonesCard
 * Agrège les zones de FC des 7 derniers jours (custom_sessions Strava +
 * session_exercises cardio) et affiche la répartition globale d'intensité
 * de la semaine sous forme de barre + légende.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart } from "lucide-react";

interface HRZone {
  zone: number;
  time_seconds: number;
}

interface WeeklyHRZonesCardProps {
  athleteId: string;
}

const ZONE_COLORS = [
  { bg: "bg-blue-500",   text: "text-blue-400",   label: "Z1 · Récup" },
  { bg: "bg-green-500",  text: "text-green-400",  label: "Z2 · Endurance" },
  { bg: "bg-yellow-400", text: "text-yellow-400", label: "Z3 · Tempo" },
  { bg: "bg-orange-500", text: "text-orange-400", label: "Z4 · Seuil" },
  { bg: "bg-red-500",    text: "text-red-400",    label: "Z5 · Max" },
];

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}min${s}s` : `${m}min`;
}

function formatHours(seconds: number): string {
  if (seconds < 3600) return formatTime(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
}

export function WeeklyHRZonesCard({ athleteId }: WeeklyHRZonesCardProps) {
  const [aggregated, setAggregated] = useState<HRZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalTrackedSeconds, setTotalTrackedSeconds] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const sinceIso = since.toISOString();

      const totals: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

      // ── 1. Séances perso (custom_sessions via Strava) ──────────────────────
      const { data: customSessions } = await supabase
        .from("custom_sessions")
        .select("heart_rate_zones")
        .eq("user_id", athleteId)
        .gte("completed_at", sinceIso)
        .not("heart_rate_zones", "is", null);

      for (const cs of customSessions || []) {
        const zones = cs.heart_rate_zones as HRZone[] | null;
        if (!Array.isArray(zones)) continue;
        for (const z of zones) {
          if (z.zone >= 1 && z.zone <= 5) {
            totals[z.zone] += z.time_seconds || 0;
          }
        }
      }

      // ── 2. Exercices cardio des training_sessions ──────────────────────────
      const { data: exercises } = await supabase
        .from("session_exercises")
        .select("actual_heart_rate_zones, training_sessions!inner(completed_at, user_id)")
        .eq("training_sessions.user_id", athleteId)
        .gte("training_sessions.completed_at", sinceIso)
        .not("actual_heart_rate_zones", "is", null);

      for (const ex of exercises || []) {
        const zones = ex.actual_heart_rate_zones as HRZone[] | null;
        if (!Array.isArray(zones)) continue;
        for (const z of zones) {
          if (z.zone >= 1 && z.zone <= 5) {
            totals[z.zone] += z.time_seconds || 0;
          }
        }
      }

      const result = [1, 2, 3, 4, 5].map((z) => ({ zone: z, time_seconds: totals[z] }));
      const total = result.reduce((s, z) => s + z.time_seconds, 0);
      setAggregated(result);
      setTotalTrackedSeconds(total);
      setLoading(false);
    };

    load();
  }, [athleteId]);

  if (loading) return null;
  if (totalTrackedSeconds === 0) return null;

  const activeZones = aggregated.filter((z) => z.time_seconds > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Heart className="h-4 w-4 text-rose-400" />
          Répartition FC — 7 derniers jours
          <span className="text-xs font-normal text-muted-foreground">
            {formatHours(totalTrackedSeconds)} trackés
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">

        {/* Barre empilée */}
        <div className="flex h-4 w-full rounded-full overflow-hidden gap-px">
          {aggregated.map((z) => {
            const pct = (z.time_seconds / totalTrackedSeconds) * 100;
            if (pct === 0) return null;
            const color = ZONE_COLORS[z.zone - 1];
            return (
              <div
                key={z.zone}
                className={`${color.bg} transition-all`}
                style={{ width: `${pct}%` }}
                title={`${color.label} · ${formatTime(z.time_seconds)} (${Math.round(pct)}%)`}
              />
            );
          })}
        </div>

        {/* Légende détaillée */}
        <div className="grid grid-cols-5 gap-1">
          {aggregated.map((z) => {
            const pct = Math.round((z.time_seconds / totalTrackedSeconds) * 100);
            const color = ZONE_COLORS[z.zone - 1];
            const isActive = z.time_seconds > 0;
            return (
              <div
                key={z.zone}
                className={`rounded-lg border p-2 text-center transition-opacity ${
                  isActive
                    ? "border-border/50 bg-secondary/40"
                    : "border-border/20 bg-transparent opacity-30"
                }`}
              >
                <div className={`text-xs font-bold ${color.text}`}>Z{z.zone}</div>
                {isActive ? (
                  <>
                    <div className="text-[11px] font-semibold text-foreground">{pct}%</div>
                    <div className="text-[10px] text-muted-foreground">{formatTime(z.time_seconds)}</div>
                  </>
                ) : (
                  <div className="text-[10px] text-muted-foreground">—</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Labels zones */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {ZONE_COLORS.map((c, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${c.bg} shrink-0`} />
              <span className="text-[10px] text-muted-foreground">{c.label}</span>
            </div>
          ))}
        </div>

      </CardContent>
    </Card>
  );
}
