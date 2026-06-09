// =============================================================================
// AthleteReadinessCard.tsx
// Carte d'état de forme athlète : fetch Supabase + computeReadiness + UI.
// =============================================================================

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Gauge,
  HeartPulse,
  Moon,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

// -----------------------------------------------------------------------------
// Styles par état
// -----------------------------------------------------------------------------

const STATE_STYLES: Record<
  ReadinessState,
  { text: string; bg: string; stroke: string }
> = {
  peak: { text: "text-blue-400", bg: "bg-blue-500/10", stroke: "#60a5fa" },
  good: { text: "text-green-400", bg: "bg-green-500/10", stroke: "#4ade80" },
  moderate: { text: "text-yellow-400", bg: "bg-yellow-500/10", stroke: "#facc15" },
  fatigued: { text: "text-orange-400", bg: "bg-orange-500/10", stroke: "#fb923c" },
  overtraining: { text: "text-red-400", bg: "bg-red-500/10", stroke: "#f87171" },
  undertraining: { text: "text-purple-400", bg: "bg-purple-500/10", stroke: "#c084fc" },
  insufficient: { text: "text-muted-foreground", bg: "bg-muted/40", stroke: "#9ca3af" },
};

const SIGNAL_ICONS: Record<SignalKey, typeof Activity> = {
  load: Flame,
  wellness: Moon,
  sfms: HeartPulse,
  efficiency: Activity,
  performance: TrendingUp,
};

// -----------------------------------------------------------------------------
// Gauge SVG
// -----------------------------------------------------------------------------

function ScoreGauge({
  score,
  stroke,
}: {
  score: number | null;
  stroke: string;
}) {
  const size = 140;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Arc 270° (laisse une ouverture en bas).
  const arcFraction = 0.75;
  const arcLength = circumference * arcFraction;
  const pct = score == null ? 0 : score / 100;
  const dashOffset = arcLength * (1 - pct);
  const rotation = 135; // ouverture vers le bas

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(${rotation} ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-border"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </g>
      <text
        x="50%"
        y="48%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-foreground"
        style={{ fontSize: 30, fontWeight: 700 }}
      >
        {score == null ? "—" : score}
      </text>
      <text
        x="50%"
        y="64%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-muted-foreground"
        style={{ fontSize: 11 }}
      >
        / 100
      </text>
    </svg>
  );
}

// -----------------------------------------------------------------------------
// Ligne de signal
// -----------------------------------------------------------------------------

function SignalRow({ signal }: { signal: SignalResult }) {
  const Icon = SIGNAL_ICONS[signal.key];
  const confidencePct = Math.round(signal.confidence * 100);

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon
            className={`h-4 w-4 shrink-0 ${
              signal.available ? "text-foreground" : "text-muted-foreground"
            }`}
          />
          <span className="text-sm font-medium text-foreground truncate">
            {signal.label}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {signal.available ? (
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          ) : (
            <XCircle className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {signal.score == null ? "—" : Math.round(signal.score)}
          </span>
        </div>
      </div>

      <p className="mt-1.5 text-xs text-muted-foreground leading-snug">
        {signal.detail}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-foreground/60"
            style={{ width: `${confidencePct}%` }}
          />
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums w-24 text-right">
          Données {confidencePct}%
        </span>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Skeleton
// -----------------------------------------------------------------------------

function ReadinessSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-5 w-5" />
          État de forme
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <div className="h-[140px] w-[140px] rounded-full bg-muted animate-pulse" />
        </div>
        <div className="h-6 w-32 mx-auto rounded bg-muted animate-pulse" />
        <div className="h-2 w-full rounded bg-muted animate-pulse" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 w-full rounded-lg bg-muted animate-pulse" />
        ))}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Fetch des données
// -----------------------------------------------------------------------------

interface RawInputs {
  sessions: SessionInput[];
  fatigueLogs: FatigueLogInput[];
  sfms: SfmsInput | null;
  stravaActivities: StravaActivityInput[];
  performanceTests: PerformanceTestInput[];
}

async function fetchReadinessData(athleteId: string): Promise<RawInputs> {
  const now = new Date();
  const iso = (daysAgo: number) =>
    new Date(now.getTime() - daysAgo * 86_400_000).toISOString();

  const since28 = iso(28);
  const since7 = iso(7);
  const since120 = iso(120);

  // --- Séances programmées (jointure athlete_id via training_weeks) ---------
  const programmedP = supabase
    .from("training_sessions" as any)
    .select("completed_at, session_rpe, duration_minutes, training_weeks!inner(athlete_id)")
    .eq("training_weeks.athlete_id", athleteId)
    .not("completed_at", "is", null)
    .gte("completed_at", since28);

  // --- Séances libres -------------------------------------------------------
  const customP = supabase
    .from("custom_sessions" as any)
    .select("completed_at, session_rpe, duration_minutes")
    .eq("user_id", athleteId)
    .not("completed_at", "is", null)
    .gte("completed_at", since28);

  // --- Hooper (colonne user_id dans cette table) ----------------------------
  const fatigueP = supabase
    .from("daily_fatigue_log" as any)
    .select("date, fatigue, courbatures, sommeil, stress, score_total")
    .eq("user_id", athleteId)
    .gte("date", since7.slice(0, 10));

  // --- SFMS (dernier) -------------------------------------------------------
  const sfmsP = supabase
    .from("sfms_questionnaire_results" as any)
    .select("total_score, completed_at")
    .eq("athlete_id", athleteId)
    .order("completed_at", { ascending: false })
    .limit(1);

  // --- Strava ---------------------------------------------------------------
  const stravaP = supabase
    .from("strava_activities" as any)
    .select(
      "start_date, distance_meters, moving_time_seconds, average_heartrate, sport_type"
    )
    .eq("athlete_id", athleteId)
    .gte("start_date", iso(70)); // ~10 semaines pour la confiance max

  // --- Tests performance (colonnes test_date / vma_estimated / test_type) ---
  const testsP = supabase
    .from("athlete_performance_tests" as any)
    .select("test_date, vma_estimated, test_type")
    .eq("athlete_id", athleteId)
    .not("vma_estimated", "is", null)
    .gte("test_date", since120.slice(0, 10));

  const [programmed, custom, fatigue, sfms, strava, tests] = await Promise.all([
    programmedP,
    customP,
    fatigueP,
    sfmsP,
    stravaP,
    testsP,
  ]);

  const programmedRows = (programmed.data ?? []) as any[];
  const customRows = (custom.data ?? []) as any[];

  const sessions: SessionInput[] = [
    ...programmedRows.map((r) => ({
      completed_at: r.completed_at,
      session_rpe: r.session_rpe,
      duration_minutes: r.duration_minutes,
    })),
    ...customRows.map((r) => ({
      completed_at: r.completed_at,
      session_rpe: r.session_rpe,
      duration_minutes: r.duration_minutes,
    })),
  ];

  const fatigueLogs: FatigueLogInput[] = ((fatigue.data ?? []) as any[]).map((r) => ({
    date: r.date,
    fatigue: r.fatigue,
    courbatures: r.courbatures,
    sommeil: r.sommeil,
    stress: r.stress,
    score_total: r.score_total,
  }));

  const sfmsRow = ((sfms.data ?? []) as any[])[0];
  const sfmsInput: SfmsInput | null = sfmsRow
    ? { total_score: sfmsRow.total_score, completed_at: sfmsRow.completed_at }
    : null;

  const stravaActivities: StravaActivityInput[] = ((strava.data ?? []) as any[]).map(
    (r) => ({
      start_date: r.start_date,
      distance_meters: r.distance_meters,
      moving_time_seconds: r.moving_time_seconds,
      average_heartrate: r.average_heartrate,
      sport_type: r.sport_type,
    })
  );

  // Mapping vers le format attendu par l'algo (date / vma / type).
  // fc_max absent de la table → null (non utilisé par l'algorithme).
  const performanceTests: PerformanceTestInput[] = ((tests.data ?? []) as any[]).map(
    (r) => ({
      date: r.test_date,
      vma: r.vma_estimated,
      fc_max: null,
      type: r.test_type,
    })
  );

  return { sessions, fatigueLogs, sfms: sfmsInput, stravaActivities, performanceTests };
}

// -----------------------------------------------------------------------------
// Composant principal
// -----------------------------------------------------------------------------

export function AthleteReadinessCard({ athleteId }: { athleteId: string }) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ReadinessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchReadinessData(athleteId);
        const computed = computeReadiness(data);
        if (!cancelled) setResult(computed);
      } catch (e) {
        if (!cancelled) {
          setError("Impossible de charger l'état de forme.");
          // Dégradation : on calcule quand même sur des données vides.
          setResult(
            computeReadiness({
              sessions: [],
              fatigueLogs: [],
              sfms: null,
              stravaActivities: [],
              performanceTests: [],
            })
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [athleteId]);

  if (loading) return <ReadinessSkeleton />;
  if (!result) return null;

  const style = STATE_STYLES[result.state];
  const confidencePct = Math.round(result.totalConfidence * 100);
  const isInsufficient = result.state === "insufficient";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-5 w-5" />
          État de forme
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {error && (
          <p className="text-xs text-orange-400">
            {error} Affichage basé sur les données disponibles.
          </p>
        )}

        {/* Gauge + badge */}
        <div className="flex flex-col items-center gap-3">
          <ScoreGauge score={result.score} stroke={style.stroke} />
          <Badge
            className={`${style.bg} ${style.text} border-0 px-3 py-1 text-sm`}
            variant="secondary"
          >
            {STATE_LABELS[result.state]}
          </Badge>
        </div>

        {/* Barre de complétude globale */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Complétude des données</span>
            <span className="text-xs font-medium text-foreground tabular-nums">
              {confidencePct}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${style.text.replace("text-", "bg-")}`}
              style={{ width: `${confidencePct}%` }}
            />
          </div>
        </div>

        {/* Overrides */}
        {result.overrides.length > 0 && (
          <div className="space-y-2">
            {result.overrides.map((o, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/30 p-3"
              >
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-400 leading-snug">{o.reason}</p>
              </div>
            ))}
          </div>
        )}

        {/* État insuffisant */}
        {isInsufficient && (
          <div className="rounded-lg bg-muted/40 border border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Pas assez de données pour un diagnostic fiable. Invitez l'athlète à
              remplir son questionnaire quotidien (Hooper) et à synchroniser ses
              séances pour activer l'analyse.
            </p>
          </div>
        )}

        {/* Signaux */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Signaux
          </p>
          {result.signals.map((s) => (
            <SignalRow key={s.key} signal={s} />
          ))}
        </div>

        {/* Recommandation */}
        <div className={`rounded-lg ${style.bg} p-3`}>
          <p className={`text-sm font-medium ${style.text}`}>Recommandation</p>
          <p className="mt-1 text-sm text-foreground leading-snug">
            {result.recommendation}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default AthleteReadinessCard;
