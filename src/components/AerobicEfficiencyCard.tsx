/**
 * AerobicEfficiencyCard
 * Suit le ratio Efficience Aérobie = Allure (m/min) ÷ FC moyenne
 * sur les courses Strava de l'athlète, semaine par semaine.
 *
 * Formule : Efficience = (distance_m / moving_time_s * 60) / average_heartrate
 * Plus la valeur est élevée = meilleure efficience cardiovasculaire.
 *
 * Alerte dérive : si la moyenne des 2 dernières semaines baisse de > 5%
 * par rapport aux 4 semaines précédentes → risque fatigue.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Dot,
} from "recharts";
import { Heart, TrendingUp, TrendingDown, Minus, AlertTriangle, Info } from "lucide-react";
import { InfoButton } from "@/components/InfoButton";

// ── Types ──────────────────────────────────────────────────────────────────────

interface StravaRun {
  strava_activity_id: number;
  name: string;
  start_date: string;
  distance_meters: number;
  moving_time_seconds: number;
  average_speed_ms: number | null;
  average_heartrate: number | null;
  sport_type: string;
}

interface WeekPoint {
  week: string;        // "S23 '25"
  efficiency: number;  // m/min ÷ bpm
  runCount: number;
  avgHr: number;
  avgPaceMinKm: number; // min/km
  isoWeek: string;     // YYYY-Www pour tri
}

interface Props {
  athleteId: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isoWeekKey(date: Date): string {
  // Renvoie "YYYY-Www" (ISO 8601)
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function weekLabel(isoKey: string): string {
  // "2025-W23" → "S23 '25"
  const [year, wPart] = isoKey.split("-W");
  return `S${wPart} '${year.slice(2)}`;
}

function trend(points: WeekPoint[]): "up" | "down" | "stable" | null {
  if (points.length < 4) return null;
  const recent = points.slice(-2).reduce((a, b) => a + b.efficiency, 0) / 2;
  const reference = points.slice(-6, -2).reduce((a, b) => a + b.efficiency, 0) / Math.max(points.slice(-6, -2).length, 1);
  if (reference === 0) return null;
  const delta = (recent - reference) / reference;
  if (delta > 0.04) return "up";
  if (delta < -0.05) return "down";
  return "stable";
}

// ── Composant ──────────────────────────────────────────────────────────────────

export function AerobicEfficiencyCard({ athleteId }: Props) {
  const [points, setPoints] = useState<WeekPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasStrava, setHasStrava] = useState(true);

  useEffect(() => {
    load();
  }, [athleteId]);

  const load = async () => {
    setLoading(true);

    // 12 dernières semaines de courses Strava avec FC
    const since = new Date();
    since.setDate(since.getDate() - 84); // 12 semaines

    const { data, error } = await supabase
      .from("strava_activities" as any)
      .select("strava_activity_id, name, start_date, distance_meters, moving_time_seconds, average_speed_ms, average_heartrate, sport_type")
      .eq("athlete_id", athleteId)
      .in("sport_type", ["Run", "TrailRun", "VirtualRun"])
      .not("average_heartrate", "is", null)
      .gte("start_date", since.toISOString())
      .order("start_date", { ascending: true });

    if (error || !data) {
      setHasStrava(false);
      setLoading(false);
      return;
    }

    const runs = (data as StravaRun[]).filter(
      r =>
        r.distance_meters > 1000 &&          // > 1 km
        r.moving_time_seconds > 600 &&        // > 10 min
        r.average_heartrate! > 90 &&          // FC plausible
        r.average_heartrate! < 210
    );

    if (runs.length === 0) {
      setHasStrava(false);
      setLoading(false);
      return;
    }

    // Regrouper par semaine ISO
    const byWeek: Record<string, { efficiencies: number[]; hrs: number[]; paces: number[] }> = {};
    for (const run of runs) {
      const key = isoWeekKey(new Date(run.start_date));
      if (!byWeek[key]) byWeek[key] = { efficiencies: [], hrs: [], paces: [] };
      const speedMpm = run.distance_meters / run.moving_time_seconds * 60; // m/min
      const efficiency = speedMpm / run.average_heartrate!;
      const paceMinKm = run.moving_time_seconds / 60 / (run.distance_meters / 1000);
      byWeek[key].efficiencies.push(efficiency);
      byWeek[key].hrs.push(run.average_heartrate!);
      byWeek[key].paces.push(paceMinKm);
    }

    const sorted = Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
        return {
          week: weekLabel(key),
          isoWeek: key,
          efficiency: Math.round(avg(v.efficiencies) * 1000) / 1000,
          runCount: v.efficiencies.length,
          avgHr: Math.round(avg(v.hrs)),
          avgPaceMinKm: avg(v.paces),
        } satisfies WeekPoint;
      });

    setPoints(sorted);
    setHasStrava(true);
    setLoading(false);
  };

  // ── Calculs pour le résumé ──────────────────────────────────────────────────

  const t = trend(points);
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const overallDelta =
    points.length >= 2 && firstPoint
      ? ((lastPoint.efficiency - firstPoint.efficiency) / firstPoint.efficiency) * 100
      : null;

  const formatPace = (minKm: number) => {
    const min = Math.floor(minKm);
    const sec = Math.round((minKm - min) * 60);
    return `${min}'${String(sec).padStart(2, "0")}"`;
  };

  // ── Tooltip personnalisé ───────────────────────────────────────────────────

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as WeekPoint;
    return (
      <div className="bg-background border border-border rounded-lg p-2.5 text-xs shadow-lg">
        <p className="font-semibold mb-1">{label}</p>
        <p className="text-primary">Efficience : <strong>{d.efficiency.toFixed(3)}</strong></p>
        <p className="text-muted-foreground">FC moy : {d.avgHr} bpm</p>
        <p className="text-muted-foreground">Allure moy : {formatPace(d.avgPaceMinKm)} /km</p>
        <p className="text-muted-foreground">{d.runCount} course{d.runCount > 1 ? "s" : ""}</p>
      </div>
    );
  };

  // ── Couleur par point (vert si > moyenne, rouge si < moyenne - 5%) ──────────

  const avgEff = points.length
    ? points.reduce((a, b) => a + b.efficiency, 0) / points.length
    : 0;

  const dotColor = (eff: number) => {
    if (eff >= avgEff * 0.98) return "#22c55e";
    if (eff >= avgEff * 0.93) return "#f59e0b";
    return "#ef4444";
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader><CardTitle className="text-sm">Efficience aérobie</CardTitle></CardHeader>
        <CardContent><div className="h-32 bg-muted rounded" /></CardContent>
      </Card>
    );
  }

  if (!hasStrava || points.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <Heart className="h-4 w-4 text-rose-400" />
            Efficience aérobie
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Aucune donnée disponible. L'athlète doit connecter Strava et porter une montre cardiaque lors de ses courses.
          </p>
        </CardContent>
      </Card>
    );
  }

  const trendBadge = () => {
    if (t === "up")     return <Badge className="bg-green-500/15 text-green-400 border-green-500/30 gap-1"><TrendingUp className="h-3 w-3" />En progression</Badge>;
    if (t === "down")   return <Badge className="bg-red-500/15 text-red-400 border-red-500/30 gap-1"><TrendingDown className="h-3 w-3" />Dérive détectée</Badge>;
    if (t === "stable") return <Badge className="bg-muted text-muted-foreground gap-1"><Minus className="h-3 w-3" />Stable</Badge>;
    return null;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <Heart className="h-4 w-4 text-rose-400" />
          Efficience aérobie
          <InfoButton text="Ratio Allure (m/min) ÷ FC moyenne. Plus la valeur est élevée, moins le cœur travaille pour produire une vitesse donnée. Une baisse prolongée indique fatigue ou surentraînement." />
        </CardTitle>
        <div className="flex items-center gap-2">
          {t === "down" && <AlertTriangle className="h-4 w-4 text-red-400" />}
          {trendBadge()}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Résumé chiffré */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-xl font-bold text-primary">{lastPoint.efficiency.toFixed(3)}</div>
            <div className="text-[10px] text-muted-foreground">Dernière semaine</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold">{avgEff.toFixed(3)}</div>
            <div className="text-[10px] text-muted-foreground">Moyenne période</div>
          </div>
          <div className="text-center">
            {overallDelta !== null ? (
              <>
                <div className={`text-xl font-bold ${overallDelta > 0 ? "text-green-400" : overallDelta < -3 ? "text-red-400" : "text-yellow-400"}`}>
                  {overallDelta > 0 ? "+" : ""}{overallDelta.toFixed(1)}%
                </div>
                <div className="text-[10px] text-muted-foreground">vs début période</div>
              </>
            ) : (
              <div className="text-[10px] text-muted-foreground mt-3">—</div>
            )}
          </div>
        </div>

        {/* Graphique */}
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={points} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              domain={["auto", "auto"]}
              tickFormatter={(v) => v.toFixed(2)}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={avgEff}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <Line
              type="monotone"
              dataKey="efficiency"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                return (
                  <Dot
                    key={payload.isoWeek}
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={dotColor(payload.efficiency)}
                    stroke="none"
                  />
                );
              }}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Légende */}
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground justify-center">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Bonne efficience</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />Légère baisse</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Dérive (&gt;5%)</span>
          <span className="flex items-center gap-1"><span className="border-t border-dashed border-muted-foreground w-4 inline-block" />Moyenne</span>
        </div>

        {t === "down" && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 text-xs text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              L'efficience aérobie a baissé de plus de 5% ces 2 dernières semaines.
              Vérifier le volume, la récupération ou un état de fatigue.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
