// AthleteReadinessCard — version compacte (tient sur ~400px de hauteur)

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Flame, Gauge, HeartPulse, Moon, TrendingUp, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  computeReadiness,
  STATE_LABELS,
  type FatigueLogInput,
  type PerformanceTestInput,
  type ReadinessResult,
  type ReadinessState,
  type SessionInput,
  type SfmsInput,
  type SignalKey,
  type SignalResult,
  type StravaActivityInput,
} from "@/lib/readinessAlgorithm";

// ── Styles ────────────────────────────────────────────────────────────────────

const STATE_STYLES: Record<ReadinessState, { text: string; bg: string; stroke: string }> = {
  peak:          { text: "text-blue-400",            bg: "bg-blue-500/10",    stroke: "#60a5fa" },
  good:          { text: "text-green-400",           bg: "bg-green-500/10",   stroke: "#4ade80" },
  moderate:      { text: "text-yellow-400",          bg: "bg-yellow-500/10",  stroke: "#facc15" },
  fatigued:      { text: "text-orange-400",          bg: "bg-orange-500/10",  stroke: "#fb923c" },
  overtraining:  { text: "text-red-400",             bg: "bg-red-500/10",     stroke: "#f87171" },
  undertraining: { text: "text-purple-400",          bg: "bg-purple-500/10",  stroke: "#c084fc" },
  insufficient:  { text: "text-muted-foreground",    bg: "bg-muted/40",       stroke: "#9ca3af" },
};

const SIGNAL_ICONS: Record<SignalKey, typeof Activity> = {
  load: Flame, wellness: Moon, sfms: HeartPulse, efficiency: Activity, performance: TrendingUp,
};

// ── Mini gauge SVG ─────────────────────────────────────────────────────────────

function MiniGauge({ score, stroke }: { score: number | null; stroke: string }) {
  const size = 56;
  const sw = 6;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75;
  const offset = arc * (1 - (score ?? 0) / 100);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor"
          className="text-border" strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${arc} ${circ}`} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={stroke}
          strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${arc} ${circ}`} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      </g>
      <text x="50%" y="44%" textAnchor="middle" dominantBaseline="middle"
        className="fill-foreground" style={{ fontSize: 13, fontWeight: 700 }}>
        {score == null ? "—" : score}
      </text>
      <text x="50%" y="64%" textAnchor="middle" dominantBaseline="middle"
        className="fill-muted-foreground" style={{ fontSize: 7 }}>/100</text>
    </svg>
  );
}

// ── Ligne signal compacte ─────────────────────────────────────────────────────

function SignalRow({ signal }: { signal: SignalResult }) {
  const Icon = SIGNAL_ICONS[signal.key];
  const pct = Math.round(signal.confidence * 100);
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${signal.available ? "text-foreground" : "text-muted-foreground/50"}`} />
      <span className={`text-xs flex-1 truncate ${signal.available ? "text-foreground" : "text-muted-foreground/60"}`}>
        {signal.label}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-foreground/50" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] text-muted-foreground w-6 text-right tabular-nums">
          {signal.score == null ? "—" : Math.round(signal.score)}
        </span>
        {signal.available
          ? <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0" />
          : <XCircle className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Gauge className="h-4 w-4" /> État de forme
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-4 items-center">
          <div className="h-20 w-20 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            <div className="h-2 w-full bg-muted animate-pulse rounded" />
          </div>
        </div>
        {[0,1,2,3,4].map(i => <div key={i} className="h-5 bg-muted animate-pulse rounded" />)}
      </CardContent>
    </Card>
  );
}

// ── Fetch ──────────────────────────────────────────────────────────────────────

async function fetchData(athleteId: string) {
  const now = new Date();
  const iso = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

  const [programmed, custom, fatigue, sfms, strava, tests] = await Promise.all([
    supabase.from("training_sessions" as any)
      .select("completed_at, session_rpe, duration_minutes, training_weeks!inner(athlete_id)")
      .eq("training_weeks.athlete_id", athleteId)
      .not("completed_at", "is", null).gte("completed_at", iso(28)),
    supabase.from("custom_sessions" as any)
      .select("completed_at, session_rpe, duration_minutes")
      .eq("user_id", athleteId)
      .not("completed_at", "is", null).gte("completed_at", iso(28)),
    supabase.from("daily_fatigue_log" as any)
      .select("date, fatigue, courbatures, sommeil, stress, score_total")
      .eq("user_id", athleteId).gte("date", iso(7).slice(0, 10)),
    supabase.from("sfms_questionnaire_results" as any)
      .select("total_score, completed_at")
      .eq("athlete_id", athleteId)
      .order("completed_at", { ascending: false }).limit(1),
    supabase.from("strava_activities" as any)
      .select("start_date, distance_meters, moving_time_seconds, average_heartrate, sport_type")
      .eq("athlete_id", athleteId).gte("start_date", iso(70)),
    supabase.from("athlete_performance_tests" as any)
      .select("test_date, vma_estimated, test_type")
      .eq("athlete_id", athleteId)
      .not("vma_estimated", "is", null).gte("test_date", iso(120).slice(0, 10)),
  ]);

  const sessions: SessionInput[] = [
    ...((programmed.data ?? []) as any[]).map(r => ({ completed_at: r.completed_at, session_rpe: r.session_rpe, duration_minutes: r.duration_minutes })),
    ...((custom.data ?? []) as any[]).map(r => ({ completed_at: r.completed_at, session_rpe: r.session_rpe, duration_minutes: r.duration_minutes })),
  ];
  const fatigueLogs: FatigueLogInput[] = ((fatigue.data ?? []) as any[]).map(r => ({ date: r.date, fatigue: r.fatigue, courbatures: r.courbatures, sommeil: r.sommeil, stress: r.stress, score_total: r.score_total }));
  const sfmsRow = ((sfms.data ?? []) as any[])[0];
  const sfmsInput: SfmsInput | null = sfmsRow ? { total_score: sfmsRow.total_score, completed_at: sfmsRow.completed_at } : null;
  const stravaActivities: StravaActivityInput[] = ((strava.data ?? []) as any[]).map(r => ({ start_date: r.start_date, distance_meters: r.distance_meters, moving_time_seconds: r.moving_time_seconds, average_heartrate: r.average_heartrate, sport_type: r.sport_type }));
  const performanceTests: PerformanceTestInput[] = ((tests.data ?? []) as any[]).map(r => ({ date: r.test_date, vma: r.vma_estimated, fc_max: null, type: r.test_type }));

  return { sessions, fatigueLogs, sfms: sfmsInput, stravaActivities, performanceTests };
}

// ── Composant principal ───────────────────────────────────────────────────────

export function AthleteReadinessCard({ athleteId }: { athleteId: string }) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ReadinessResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const data = await fetchData(athleteId);
        if (!cancelled) setResult(computeReadiness(data));
      } catch {
        if (!cancelled) setResult(computeReadiness({ sessions: [], fatigueLogs: [], sfms: null, stravaActivities: [], performanceTests: [] }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [athleteId]);

  if (loading) return <Skeleton />;
  if (!result) return null;

  const style = STATE_STYLES[result.state];
  const confPct = Math.round(result.totalConfidence * 100);
  const isInsufficient = result.state === "insufficient";

  return (
    <Card className="h-fit">
      <CardHeader className="pb-1 pt-2.5 px-3">
        <CardTitle className="text-xs flex items-center gap-1.5">
          <Gauge className="h-3.5 w-3.5" /> État de forme
        </CardTitle>
      </CardHeader>

      <CardContent className="px-3 pb-2.5 space-y-2">
        {/* Gauge + badge + complétude */}
        <div className="flex gap-2.5 items-center">
          <MiniGauge score={result.score} stroke={style.stroke} />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Badge className={`${style.bg} ${style.text} border-0 text-[11px] px-1.5 py-0`} variant="secondary">
              {STATE_LABELS[result.state]}
            </Badge>
            <div>
              <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                <span>Complétude</span><span>{confPct}%</span>
              </div>
              <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${style.text.replace("text-", "bg-")}`} style={{ width: `${confPct}%` }} />
              </div>
            </div>
            {!isInsufficient && (
              <p className="text-[10px] text-muted-foreground leading-snug line-clamp-1">{result.recommendation}</p>
            )}
          </div>
        </div>

        {/* Override */}
        {result.overrides.length > 0 && (
          <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
            <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />
            <p className="text-[10px] text-red-400 leading-snug truncate">{result.overrides[0].reason}</p>
          </div>
        )}

        {/* Signaux */}
        <div className="divide-y divide-border/40">
          {result.signals.map(s => <SignalRow key={s.key} signal={s} />)}
        </div>
      </CardContent>
    </Card>
  );
}

export default AthleteReadinessCard;
