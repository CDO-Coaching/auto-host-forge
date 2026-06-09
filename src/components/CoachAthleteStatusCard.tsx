import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { subDays, differenceInDays, format, startOfDay, endOfDay } from "date-fns";
import { AlertTriangle, Activity } from "lucide-react";
import { getWeekNumber, getWeekYear } from "@/lib/weekUtils";

export interface CoachAthleteStatusCardProps {
  athleteId: string;
  athleteName: string;
}

interface FatigueLog {
  date: string;
  fatigue: number;
  sommeil: number;
  courbatures: number;
  stress: number;
  score_total: number;
  has_injury: boolean | null;
  injury_level: number | null;
  injury_location: string | null;
}

interface SessionExercise {
  cardio_sport: string | null;
  actual_distance_km: number | null;
  actual_duration_minutes: number | null;
  actual_avg_heart_rate: number | null;
  actual_heart_rate_zones: unknown;
  sportif_rpe: number | null;
}

interface TrainingSessionRaw {
  id: string;
  name: string;
  session_type: string;
  completed_at: string | null;
  duration_minutes: number | null;
  session_rpe: number | null;
  session_exercises: SessionExercise[];
}

interface CustomSessionRaw {
  id: string;
  session_name: string;
  cardio_type: string | null;
  duration_minutes: number | null;
  distance_km: number | null;
  avg_pace: string | null;
  avg_heart_rate: number | null;
  session_rpe: number | null;
  completed_at: string | null;
}

interface LastSession {
  name: string;
  duration: number | null; // minutes
  distance: number | null; // km
  rpe: number | null;
  hr: number | null;
  pace: string | null;
  completedAt: string;
}

interface ActivityCount {
  course: { count: number; durationMin: number; distanceKm: number };
  velo: { count: number; durationMin: number; distanceKm: number };
  natation: { count: number; durationMin: number; distanceKm: number };
  renfo: { count: number; durationMin: number };
  recup: { count: number; durationMin: number };
  perso: { count: number; durationMin: number };
}

interface Alert {
  message: string;
  level: "red" | "orange";
}

interface StatusData {
  score: number;
  acwr: number | null;
  weeklyLoadUA: number;
  monotony: number;
  latestLog: FatigueLog | null;
  activity: ActivityCount;
  lastSession: LastSession | null;
  daysSinceLastSession: number;
  alerts: Alert[];
  rpeReliability: number;
  hasActiveInjury: boolean;
}

function computeReadinessScore(
  acwr: number | null,
  monotony: number,
  latestLog: FatigueLog | null,
  last7Logs: FatigueLog[]
): number {
  // ACWR score (30%)
  let acwrScore = 50;
  if (acwr !== null) {
    if (acwr >= 0.8 && acwr <= 1.3) acwrScore = 100;
    else if ((acwr >= 0.6 && acwr < 0.8) || (acwr > 1.3 && acwr <= 1.5)) acwrScore = 70;
    else acwrScore = 30;
  }

  // Monotony score (25%)
  let monotonyScore = 100;
  if (monotony >= 2) monotonyScore = 20;
  else if (monotony >= 1.5) monotonyScore = 60;

  // Fatigue score (25%)
  let fatigueScore = 50;
  if (latestLog) {
    fatigueScore = Math.max(0, Math.min(100, ((28 - latestLog.score_total) / 24) * 100));
  }

  // Sommeil score (20%)
  let sommeilScore = 50;
  if (last7Logs.length > 0) {
    const avgSommeil = last7Logs.reduce((s, l) => s + l.sommeil, 0) / last7Logs.length;
    sommeilScore = Math.max(0, Math.min(100, ((7 - avgSommeil) / 6) * 100));
  }

  const total =
    acwrScore * 0.3 +
    monotonyScore * 0.25 +
    fatigueScore * 0.25 +
    sommeilScore * 0.2;

  return Math.round(Math.max(0, Math.min(100, total)));
}

export function CoachAthleteStatusCard({ athleteId, athleteName }: CoachAthleteStatusCardProps) {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId]);

  async function loadAll() {
    setLoading(true);
    try {
      const today = new Date();
      const sevenDaysAgo = subDays(today, 6);
      const thirtyFiveDaysAgo = subDays(today, 34);

      // ── 1. Fatigue logs – last 7 days ────────────────────────────────────
      const { data: fatigueData } = await supabase
        .from("daily_fatigue_log")
        .select("date, fatigue, sommeil, courbatures, stress, score_total, has_injury, injury_level, injury_location")
        .eq("user_id", athleteId)
        .order("date", { ascending: false })
        .limit(7);

      const fatigueLogs: FatigueLog[] = (fatigueData || []) as FatigueLog[];
      const latestLog = fatigueLogs.length > 0 ? fatigueLogs[0] : null;
      const hasActiveInjury =
        !!latestLog?.has_injury && (latestLog?.injury_level ?? 0) > 0;

      // ── 2. Training weeks for this athlete ───────────────────────────────
      const { data: weeksData } = await supabase
        .from("training_weeks")
        .select("id")
        .eq("athlete_id", athleteId);

      const weekIds: string[] = (weeksData || []).map((w: { id: string }) => w.id);

      // ── 3. Training sessions – last 7 days ──────────────────────────────
      let trainingSessions7: TrainingSessionRaw[] = [];
      if (weekIds.length > 0) {
        const { data: tsData } = await supabase
          .from("training_sessions")
          .select(`
            id, name, session_type, completed_at, duration_minutes, session_rpe,
            session_exercises (
              cardio_sport, actual_distance_km, actual_duration_minutes,
              actual_avg_heart_rate, actual_heart_rate_zones, sportif_rpe
            )
          `)
          .in("week_id", weekIds)
          .not("completed_at", "is", null)
          .gte("completed_at", startOfDay(sevenDaysAgo).toISOString())
          .lte("completed_at", endOfDay(today).toISOString());
        trainingSessions7 = (tsData || []) as TrainingSessionRaw[];
      }

      // ── 4. Custom sessions – last 7 days ────────────────────────────────
      const { data: customData } = await (supabase.from("custom_sessions") as ReturnType<typeof supabase.from>)
        .select("id, session_name, cardio_type, duration_minutes, distance_km, avg_pace, avg_heart_rate, session_rpe, completed_at")
        .eq("user_id", athleteId)
        .not("completed_at", "is", null)
        .gte("completed_at", startOfDay(sevenDaysAgo).toISOString());
      const customSessions7: CustomSessionRaw[] = (customData || []) as CustomSessionRaw[];

      // ── 5. sRPE / ACWR – last 35 days ────────────────────────────────────
      let trainingSessions35: { completed_at: string; duration_minutes: number | null; session_rpe: number | null }[] = [];
      if (weekIds.length > 0) {
        const { data: ts35Data } = await supabase
          .from("training_sessions")
          .select("id, completed_at, duration_minutes, session_rpe")
          .in("week_id", weekIds)
          .not("completed_at", "is", null)
          .gte("completed_at", startOfDay(thirtyFiveDaysAgo).toISOString())
          .lte("completed_at", endOfDay(today).toISOString());
        trainingSessions35 = (ts35Data || []) as typeof trainingSessions35;
      }

      // ── 6. Compute daily loads for 35 days ──────────────────────────────
      const allDailyLoadsMap = new Map<string, number>();
      for (let i = 34; i >= 0; i--) {
        allDailyLoadsMap.set(format(subDays(today, i), "yyyy-MM-dd"), 0);
      }
      for (const s of trainingSessions35) {
        if (s.duration_minutes && s.session_rpe && s.completed_at) {
          const dateKey = format(new Date(s.completed_at), "yyyy-MM-dd");
          const existing = allDailyLoadsMap.get(dateKey) ?? 0;
          allDailyLoadsMap.set(dateKey, existing + s.duration_minutes * s.session_rpe);
        }
      }
      const allDailyLoads = Array.from(allDailyLoadsMap.entries())
        .map(([date, load]) => ({ date, load }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // ACWR: acute = last 7 days, chronic = last 28 days / 4
      const acuteSum = allDailyLoads.slice(-7).reduce((s, d) => s + d.load, 0);
      const chronicSum = allDailyLoads.slice(-28).reduce((s, d) => s + d.load, 0);
      const chronic = chronicSum / 4;
      const acwr: number | null = chronic > 0 ? acuteSum / chronic : null;

      // Weekly load (last 7 days UA)
      const weeklyLoadUA = acuteSum;

      // Monotony (last 7 days)
      const last7Loads = allDailyLoads.slice(-7).map((d) => d.load);
      const meanLoad7 = last7Loads.reduce((s, l) => s + l, 0) / 7;
      const variance7 = last7Loads.reduce((s, l) => s + Math.pow(l - meanLoad7, 2), 0) / 7;
      const stdDev7 = Math.sqrt(variance7);
      const monotony = stdDev7 > 0 ? meanLoad7 / stdDev7 : 0;

      // ── 7. Activity counts last 7 days ───────────────────────────────────
      const activity: ActivityCount = {
        course: { count: 0, durationMin: 0, distanceKm: 0 },
        velo: { count: 0, durationMin: 0, distanceKm: 0 },
        natation: { count: 0, durationMin: 0, distanceKm: 0 },
        renfo: { count: 0, durationMin: 0 },
        recup: { count: 0, durationMin: 0 },
        perso: { count: 0, durationMin: 0 },
      };

      for (const ts of trainingSessions7) {
        const type = ts.session_type;
        const dur = ts.duration_minutes ?? 0;

        if (type === "renfo") {
          activity.renfo.count++;
          activity.renfo.durationMin += dur;
        } else if (type === "recup") {
          activity.recup.count++;
          activity.recup.durationMin += dur;
        } else if (type === "cardio") {
          // Detect sport from exercises
          const exs = ts.session_exercises || [];
          const sport = exs.find((e) => e.cardio_sport)?.cardio_sport ?? null;
          const actualKm = exs.reduce((s, e) => s + (e.actual_distance_km ?? 0), 0);
          const actualDur = exs.reduce((s, e) => s + (e.actual_duration_minutes ?? 0), 0);
          const effectiveDur = actualDur > 0 ? actualDur : dur;
          if (sport === "course") {
            activity.course.count++;
            activity.course.durationMin += effectiveDur;
            activity.course.distanceKm += actualKm;
          } else if (sport === "velo") {
            activity.velo.count++;
            activity.velo.durationMin += effectiveDur;
            activity.velo.distanceKm += actualKm;
          } else if (sport === "natation") {
            activity.natation.count++;
            activity.natation.durationMin += effectiveDur;
            activity.natation.distanceKm += actualKm;
          } else {
            activity.perso.count++;
            activity.perso.durationMin += effectiveDur;
          }
        }
      }

      for (const cs of customSessions7) {
        const type = cs.cardio_type?.toLowerCase() ?? "";
        const dur = cs.duration_minutes ?? 0;
        const km = cs.distance_km ?? 0;
        if (type === "course") {
          activity.course.count++;
          activity.course.durationMin += dur;
          activity.course.distanceKm += km;
        } else if (type === "velo") {
          activity.velo.count++;
          activity.velo.durationMin += dur;
          activity.velo.distanceKm += km;
        } else if (type === "natation") {
          activity.natation.count++;
          activity.natation.durationMin += dur;
          activity.natation.distanceKm += km;
        } else {
          activity.perso.count++;
          activity.perso.durationMin += dur;
        }
      }

      // ── 8. Last session & days since ─────────────────────────────────────
      const allCompletedSessions: { completedAt: string; session: LastSession }[] = [];

      for (const ts of trainingSessions7) {
        if (!ts.completed_at) continue;
        const exs = ts.session_exercises || [];
        const actualKm = exs.reduce((s, e) => s + (e.actual_distance_km ?? 0), 0);
        const actualDur = exs.reduce((s, e) => s + (e.actual_duration_minutes ?? 0), 0);
        const rpe = ts.session_rpe ?? exs.find((e) => e.sportif_rpe != null)?.sportif_rpe ?? null;
        const hr = exs.find((e) => e.actual_avg_heart_rate != null)?.actual_avg_heart_rate ?? null;
        allCompletedSessions.push({
          completedAt: ts.completed_at,
          session: {
            name: ts.name,
            duration: actualDur > 0 ? actualDur : ts.duration_minutes,
            distance: actualKm > 0 ? actualKm : null,
            rpe,
            hr,
            pace: null,
            completedAt: ts.completed_at,
          },
        });
      }

      for (const cs of customSessions7) {
        if (!cs.completed_at) continue;
        allCompletedSessions.push({
          completedAt: cs.completed_at,
          session: {
            name: cs.session_name,
            duration: cs.duration_minutes,
            distance: cs.distance_km,
            rpe: cs.session_rpe,
            hr: cs.avg_heart_rate,
            pace: cs.avg_pace,
            completedAt: cs.completed_at,
          },
        });
      }

      allCompletedSessions.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
      const lastSession = allCompletedSessions.length > 0 ? allCompletedSessions[0].session : null;
      const daysSinceLastSession = lastSession
        ? differenceInDays(today, new Date(lastSession.completedAt))
        : 999;

      // ── 9. RPE reliability (last 7 day sessions) ─────────────────────────
      const totalSessions7 = trainingSessions7.length + customSessions7.length;
      const sessionsWithRpe =
        trainingSessions7.filter((s) => s.session_rpe != null || s.session_exercises?.some((e) => e.sportif_rpe != null)).length +
        customSessions7.filter((s) => s.session_rpe != null).length;
      const rpeReliability = totalSessions7 > 0 ? sessionsWithRpe / totalSessions7 : 1;

      // ── 10. Readiness score ───────────────────────────────────────────────
      const score = computeReadinessScore(acwr, monotony, latestLog, fatigueLogs);

      // ── 11. Alerts ────────────────────────────────────────────────────────
      const alerts: Alert[] = [];
      if (daysSinceLastSession >= 4 && daysSinceLastSession < 999) {
        alerts.push({ message: `Aucune séance depuis ${daysSinceLastSession} jours`, level: "orange" });
      }
      if (acwr !== null && acwr > 1.5) {
        alerts.push({ message: "Surcharge détectée (ACWR élevé)", level: "red" });
      }
      if (acwr !== null && acwr < 0.6) {
        alerts.push({ message: "Volume trop faible (ACWR bas)", level: "orange" });
      }
      if (monotony > 2) {
        alerts.push({ message: "Entraînement trop monotone", level: "orange" });
      }
      if (latestLog && latestLog.score_total > 20) {
        alerts.push({ message: "Fatigue élevée signalée", level: "red" });
      }
      if (hasActiveInjury) {
        alerts.push({ message: "Blessure/douleur signalée", level: "red" });
      }
      if (totalSessions7 > 0 && rpeReliability < 0.5) {
        alerts.push({ message: "RPE renseigné sur moins de 50% des séances", level: "orange" });
      }

      setData({
        score,
        acwr,
        weeklyLoadUA,
        monotony,
        latestLog,
        activity,
        lastSession,
        daysSinceLastSession,
        alerts,
        rpeReliability,
        hasActiveInjury,
      });
    } catch (err) {
      console.error("[CoachAthleteStatusCard] error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card className="border-2 border-muted animate-pulse">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-10 rounded bg-muted" />
            <div className="space-y-1.5">
              <div className="w-32 h-3 rounded bg-muted" />
              <div className="w-20 h-4 rounded bg-muted" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/40 h-24" />
            <div className="rounded-lg bg-muted/40 h-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="border-2 border-muted">
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>Impossible de charger les données de statut.</p>
        </CardContent>
      </Card>
    );
  }

  const { score, acwr, weeklyLoadUA, monotony, latestLog, activity, lastSession, daysSinceLastSession, alerts } = data;

  // Colors
  const scoreColorClass =
    score >= 80 ? "text-green-500" : score >= 60 ? "text-orange-500" : "text-red-500";
  const statusText =
    score >= 80 ? "Prêt à l'entraînement" : score >= 60 ? "Vigilance recommandée" : "Repos conseillé";
  const borderClass =
    score >= 80
      ? "border-green-500/50 bg-green-500/5"
      : score >= 60
      ? "border-orange-500/50 bg-orange-500/5"
      : "border-red-500/50 bg-red-500/5";
  const badgeClass =
    score >= 80
      ? "bg-green-500/15 text-green-600 border-green-500/30"
      : score >= 60
      ? "bg-orange-500/15 text-orange-600 border-orange-500/30"
      : "bg-red-500/15 text-red-600 border-red-500/30";

  const acwrColor =
    acwr === null
      ? "text-muted-foreground"
      : acwr >= 0.8 && acwr <= 1.3
      ? "text-green-500"
      : acwr > 1.5 || acwr < 0.6
      ? "text-red-500"
      : "text-orange-500";

  const monotonyColor =
    monotony < 1.5 ? "text-green-500" : monotony < 2 ? "text-orange-500" : "text-red-500";

  const fatigueVal = latestLog?.score_total ?? null;
  const fatigueColor =
    fatigueVal === null
      ? "text-muted-foreground"
      : fatigueVal > 20
      ? "text-red-500"
      : fatigueVal > 14
      ? "text-orange-500"
      : "text-green-500";

  // Activity badges helper
  type SportKey = "course" | "velo" | "natation" | "renfo" | "recup" | "perso";
  const sportEmoji: Record<SportKey, string> = {
    course: "🏃",
    velo: "🚴",
    natation: "🏊",
    renfo: "🏋️",
    recup: "🧘",
    perso: "⚡",
  };
  const sportLabel: Record<SportKey, string> = {
    course: "Course",
    velo: "Vélo",
    natation: "Natation",
    renfo: "Muscu/Renfo",
    recup: "Récup",
    perso: "Perso",
  };

  const totalSessions7Count =
    activity.course.count +
    activity.velo.count +
    activity.natation.count +
    activity.renfo.count +
    activity.recup.count +
    activity.perso.count;

  const formatDuration = (minutes: number) => {
    if (minutes <= 0) return "";
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`;
  };

  const buildBadgeText = (sport: SportKey): string | null => {
    const a = activity[sport];
    if (a.count === 0) return null;
    const emoji = sportEmoji[sport];
    const label = sportLabel[sport];
    let text = `${emoji} ${label} · ${a.count} séance${a.count > 1 ? "s" : ""}`;
    if ("distanceKm" in a && a.distanceKm > 0) {
      text += ` · ${a.distanceKm.toFixed(1)} km`;
    } else if (a.durationMin > 0) {
      text += ` · ${formatDuration(a.durationMin)}`;
    }
    return text;
  };

  const lastSessionDurationStr = lastSession?.duration
    ? `${Math.floor(lastSession.duration / 60)}h${(lastSession.duration % 60).toString().padStart(2, "0")}`
    : null;

  return (
    <Card className={`border-2 ${borderClass} h-fit`}>
      <CardHeader className="pb-1 pt-2.5 px-3">
        <CardTitle className="text-xs flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" /> Score Prépa
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-2.5 space-y-2">

        {/* Score + badge + statut */}
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold leading-none ${scoreColorClass}`}>{score}</span>
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide leading-none">/ 100</p>
            <p className={`text-[11px] font-semibold leading-none ${scoreColorClass}`}>{statusText}</p>
          </div>
          <Badge className={`text-[10px] px-1.5 py-0 border ml-auto shrink-0 ${badgeClass}`}>
            {score >= 80 ? "🟢 Prêt" : score >= 60 ? "🟡 Attention" : "🔴 Repos"}
          </Badge>
        </div>

        {/* Métriques clés — grille 2×2 */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
          <span className="text-muted-foreground">sRPE <span className="font-medium text-foreground">{weeklyLoadUA > 0 ? `${Math.round(weeklyLoadUA)} UA` : "—"}</span></span>
          <span className="text-muted-foreground">ACWR <span className={`font-medium ${acwrColor}`}>{acwr !== null ? acwr.toFixed(2) : "—"}</span></span>
          <span className="text-muted-foreground">Mono <span className={`font-medium ${monotonyColor}`}>{monotony.toFixed(2)}</span></span>
          {latestLog
            ? <span className="text-muted-foreground">Fatigue <span className={`font-medium ${fatigueColor}`}>{latestLog.score_total}/28</span></span>
            : <span className="text-muted-foreground italic">Pas de Hooper</span>}
        </div>

        {/* Dernière séance + activité */}
        {(lastSession || daysSinceLastSession < 999) && (
          <div className="text-[10px] text-muted-foreground truncate">
            {lastSession && <span>⚡ {lastSession.name}{lastSession.rpe ? ` · RPE ${lastSession.rpe}` : ""} · </span>}
            <span>{daysSinceLastSession === 0 ? "Aujourd'hui ✅" : daysSinceLastSession === 1 ? "Hier" : `Il y a ${daysSinceLastSession}j`}</span>
          </div>
        )}

        {/* Alertes */}
        {alerts.length > 0 && (
          <div className="space-y-1">
            {alerts.map((alert, i) => (
              <div key={i} className={`flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded ${
                alert.level === "red" ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-orange-500/10 text-orange-500 border border-orange-500/20"
              }`}>
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span className="truncate">{alert.message}</span>
              </div>
            ))}
          </div>
        )}

      </CardContent>
    </Card>
  );
}
