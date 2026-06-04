/**
 * WeeklyHRZonesCard
 * Agrège les zones de FC des 7 derniers jours (custom_sessions Strava +
 * session_exercises cardio) et reclassifie le temps dans les zones FCR
 * (Karvonen) de l'athlète : FC cible = fc_repos + FCR × % zone.
 *
 * Les données Strava contiennent les bornes bpm réelles de chaque zone
 * (min / max). On calcule le chevauchement entre ces bornes et les bornes
 * FCR pour redistribuer le temps proportionnellement.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawZone {
  zone: number;
  min: number;   // bpm bas de la zone Strava
  max: number;   // bpm haut de la zone Strava
  time_seconds: number;
}

interface FCRZone {
  zone: number;        // 1-5
  fcrMin: number;      // % FCR bas
  fcrMax: number;      // % FCR haut
  label: string;
  description: string;
}

// ─── Définition des 5 zones FCR (Karvonen) ────────────────────────────────────

const FCR_ZONES: FCRZone[] = [
  { zone: 1, fcrMin: 50, fcrMax: 60, label: "Z1 · Récup",      description: "Récupération active" },
  { zone: 2, fcrMin: 60, fcrMax: 70, label: "Z2 · Endurance",  description: "Endurance fondamentale" },
  { zone: 3, fcrMin: 70, fcrMax: 80, label: "Z3 · Tempo",      description: "Allure marathon" },
  { zone: 4, fcrMin: 80, fcrMax: 90, label: "Z4 · Seuil",      description: "Seuil anaérobie" },
  { zone: 5, fcrMin: 90, fcrMax: 100, label: "Z5 · Max",       description: "VMA / VO₂max" },
];

const ZONE_COLORS = [
  { bg: "bg-blue-500",   text: "text-blue-400"   },
  { bg: "bg-green-500",  text: "text-green-400"  },
  { bg: "bg-yellow-400", text: "text-yellow-400" },
  { bg: "bg-orange-500", text: "text-orange-400" },
  { bg: "bg-red-500",    text: "text-red-400"    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}min${s}s` : `${m}min`;
}

function formatHours(seconds: number): string {
  if (seconds < 3600) return formatTime(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
}

/**
 * Redistribue le temps d'une zone Strava [rawMin, rawMax] bpm dans les
 * zones FCR [fcrLowBpm, fcrHighBpm] bpm par proportion de chevauchement.
 * Hypothèse : distribution uniforme du temps dans la zone Strava.
 */
function redistributeZone(
  rawZones: RawZone[],
  fcRepos: number,
  fcMax: number,
): Record<number, number> {
  const fcr = fcMax - fcRepos;
  const totals: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  // Bornes bpm des zones FCR
  const fcrBounds = FCR_ZONES.map((z) => ({
    zone: z.zone,
    low:  fcRepos + fcr * z.fcrMin / 100,
    high: fcRepos + fcr * z.fcrMax / 100,
  }));

  for (const raw of rawZones) {
    if (!raw.time_seconds || raw.time_seconds <= 0) continue;

    const rawLow  = raw.min ?? 0;
    const rawHigh = raw.max ?? 999;
    const rawSpan = rawHigh - rawLow;
    if (rawSpan <= 0) {
      // Pas de bornes bpm → on utilise le numéro de zone Strava tel quel
      const z = Math.min(Math.max(raw.zone, 1), 5);
      totals[z] += raw.time_seconds;
      continue;
    }

    for (const fcz of fcrBounds) {
      const overlapLow  = Math.max(rawLow,  fcz.low);
      const overlapHigh = Math.min(rawHigh, fcz.high);
      if (overlapHigh <= overlapLow) continue;

      const fraction = (overlapHigh - overlapLow) / rawSpan;
      totals[fcz.zone] += raw.time_seconds * fraction;
    }
  }

  return totals;
}

// ─── Composant ────────────────────────────────────────────────────────────────

interface WeeklyHRZonesCardProps {
  athleteId: string;
}

export function WeeklyHRZonesCard({ athleteId }: WeeklyHRZonesCardProps) {
  const [aggregated, setAggregated] = useState<{ zone: number; time_seconds: number }[]>([]);
  const [totalTrackedSeconds, setTotalTrackedSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasFCR, setHasFCR] = useState(false);
  const [fcMax, setFcMax] = useState<number | null>(null);
  const [fcRepos, setFcRepos] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // ── Profil athlète : fc_max + fc_repos ──
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("fc_max, fc_repos")
        .eq("id", athleteId)
        .single();

      const fMax   = profile?.fc_max   ?? null;
      const fRepos = profile?.fc_repos ?? null;
      setFcMax(fMax);
      setFcRepos(fRepos);
      setHasFCR(!!(fMax && fRepos));

      const since = new Date();
      since.setDate(since.getDate() - 7);
      const sinceIso  = since.toISOString();
      const sinceDate = since.toISOString().slice(0, 10); // "yyyy-MM-dd"

      const totals: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

      const addZones = (zones: RawZone[]) => {
        let contrib: Record<number, number>;
        if (fMax && fRepos) {
          contrib = redistributeZone(zones, fRepos, fMax);
        } else {
          contrib = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
          for (const z of zones) {
            const idx = Math.min(Math.max(z.zone, 1), 5);
            contrib[idx] += z.time_seconds || 0;
          }
        }
        for (let i = 1; i <= 5; i++) totals[i] += contrib[i];
      };

      // ── 1. custom_sessions (Strava) — filtre sur completed_at OU scheduled_date ──
      const { data: customSessions } = await supabase
        .from("custom_sessions")
        .select("heart_rate_zones, completed_at, scheduled_date")
        .eq("user_id", athleteId)
        .not("heart_rate_zones", "is", null)
        .or(`completed_at.gte.${sinceIso},scheduled_date.gte.${sinceDate}`);

      for (const cs of customSessions || []) {
        const zones = cs.heart_rate_zones as RawZone[] | null;
        if (!Array.isArray(zones) || zones.length === 0) continue;
        addZones(zones);
      }

      // ── 2. session_exercises cardio ──
      // training_sessions n'a pas de user_id direct.
      // Chemin : training_weeks (athlete_id) → ALL week IDs → training_sessions
      // (filtre scheduled_date côté session) → session_exercises

      // Étape A : TOUS les week IDs de l'athlète (pas de filtre date ici)
      const { data: allWeeks } = await supabase
        .from("training_weeks")
        .select("id")
        .eq("athlete_id", athleteId);

      const weekIds = (allWeeks || []).map((w) => w.id);

      if (weekIds.length > 0) {
        // Étape B : séances complétées OU planifiées dans les 7 derniers jours
        // completed_at = quand l'athlète a validé (source de vérité pour les données réelles)
        // scheduled_date = fallback pour séances avec zones mais sans completed_at
        const { data: recentSessions } = await supabase
          .from("training_sessions")
          .select("id")
          .in("week_id", weekIds)
          .or(`completed_at.gte.${sinceIso},scheduled_date.gte.${sinceDate}`);

        const sessionIds = (recentSessions || []).map((s) => s.id);

        // Étape C : exercices avec zones FC
        if (sessionIds.length > 0) {
          const { data: exercises } = await supabase
            .from("session_exercises")
            .select("actual_heart_rate_zones")
            .in("session_id", sessionIds)
            .not("actual_heart_rate_zones", "is", null);

          for (const ex of exercises || []) {
            const zones = ex.actual_heart_rate_zones as RawZone[] | null;
            if (!Array.isArray(zones) || zones.length === 0) continue;
            addZones(zones);
          }
        }
      }

      const result = [1, 2, 3, 4, 5].map((z) => ({
        zone: z,
        time_seconds: Math.round(totals[z]),
      }));
      const total = result.reduce((s, z) => s + z.time_seconds, 0);
      setAggregated(result);
      setTotalTrackedSeconds(total);
      setLoading(false);
    };

    load();
  }, [athleteId]);

  if (loading) return null;
  if (totalTrackedSeconds === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Heart className="h-4 w-4 text-rose-400" />
          Répartition FC — 7 derniers jours
          <span className="text-xs font-normal text-muted-foreground">
            {formatHours(totalTrackedSeconds)} trackés
            {hasFCR
              ? <span className="text-emerald-400 ml-1">· FCR Karvonen</span>
              : <span className="text-amber-400 ml-1">· zones Strava brutes</span>}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">

        {/* Avertissement si FCR manquante */}
        {!hasFCR && (
          <div className="text-[11px] text-amber-400 bg-amber-400/10 rounded-lg px-3 py-2 border border-amber-400/20">
            ⚠️ FC repos non renseignée — affichage en zones Strava brutes.
            Renseigne FC max + FC repos dans les données physiologiques pour passer en FCR Karvonen.
          </div>
        )}

        {/* Indication méthode si FCR disponible */}
        {hasFCR && fcMax && fcRepos && (
          <div className="text-[11px] text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2 border border-border/40">
            <span className="font-semibold text-foreground">Karvonen</span>
            {" "}· FCR = {fcMax} − {fcRepos} = {fcMax - fcRepos} bpm · Zones reclassifiées par chevauchement bpm
          </div>
        )}

        {/* Barre empilée */}
        <div className="flex h-4 w-full rounded-full overflow-hidden gap-px">
          {aggregated.map((z) => {
            const pct = (z.time_seconds / totalTrackedSeconds) * 100;
            if (pct < 0.5) return null;
            const color = ZONE_COLORS[z.zone - 1];
            const fcrZ = FCR_ZONES[z.zone - 1];
            return (
              <div
                key={z.zone}
                className={`${color.bg} transition-all`}
                style={{ width: `${pct}%` }}
                title={`${fcrZ.label} · ${formatTime(z.time_seconds)} (${Math.round(pct)}%)`}
              />
            );
          })}
        </div>

        {/* Cases par zone */}
        <div className="grid grid-cols-5 gap-1">
          {aggregated.map((z) => {
            const pct = Math.round((z.time_seconds / totalTrackedSeconds) * 100);
            const color = ZONE_COLORS[z.zone - 1];
            const fcrZ = FCR_ZONES[z.zone - 1];
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
                <div className="text-[10px] text-muted-foreground leading-none mb-1">
                  {fcrZ.fcrMin}–{fcrZ.fcrMax}%
                </div>
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

        {/* Légende labels */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {FCR_ZONES.map((z, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${ZONE_COLORS[i].bg} shrink-0`} />
              <span className="text-[10px] text-muted-foreground">{z.label}</span>
            </div>
          ))}
        </div>

      </CardContent>
    </Card>
  );
}
