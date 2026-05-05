import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfWeek, endOfWeek, getISOWeek, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { getWeekYear } from "@/lib/weekUtils";
import { Heart, CheckCircle2, Clock, Calendar, AlertTriangle, Target, Flag } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CoachSessionDetailDialog } from "@/components/CoachSessionDetailDialog";

interface CoachClientSummaryViewProps {
  athleteId: string;
  athleteName: string;
}

// Primary source (used by athlete Fatigue page)
interface DailyFatigueLogRow {
  date: string;
  sommeil: number;
  stress: number;
  fatigue: number;
  courbatures: number;
  has_injury: boolean;
  injury_level: number | null;
  injury_location: string | null;
}

// Fallback source (used in coach central dashboard alerts)
interface DailyFatigueRowFallback {
  date: string;
  user_id: string;
  fatigue_score: number | null;
  stress_score: number | null;
  soreness_score: number | null;
}

interface SessionInfo {
  id: string;
  name: string;
  session_type: string;
  completed_at: string | null;
  session_rpe: number | null;
  duration_minutes: number | null;
  scheduled_date: string | null;
  isCustom?: boolean;
  inProgress?: boolean;
}

interface Milestone {
  id: string;
  name: string;
  target_date: string;
  completed: boolean;
}

type FatiguePoint = {
  dateLabel: string;
  score: number; // 1..7 (average)
};

type InjuryPoint = {
  dateLabel: string;
  douleur: number;
};

export function CoachClientSummaryView({ athleteId, athleteName }: CoachClientSummaryViewProps) {
  const [fatiguePoints, setFatiguePoints] = useState<FatiguePoint[]>([]);
  const [injuryPoints, setInjuryPoints] = useState<InjuryPoint[]>([]);
  const [latestInjury, setLatestInjury] = useState<{ location: string | null; level: number | null } | null>(null);
  const [fatigueError, setFatigueError] = useState<string | null>(null);

  const [currentWeekSessions, setCurrentWeekSessions] = useState<SessionInfo[]>([]);
  const [previousWeekSessions, setPreviousWeekSessions] = useState<SessionInfo[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null);

  const today = new Date();
  const currentWeekNumber = getISOWeek(today);
  const currentYear = getWeekYear(today);
  let previousWeekNumber = currentWeekNumber - 1;
  let previousYear = currentYear;
  if (previousWeekNumber <= 0) {
    previousWeekNumber = 52;
    previousYear = currentYear - 1;
  }

  useEffect(() => {
    if (!athleteId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      loadFatigue(),
      loadWeekSessions(currentWeekNumber, currentYear, setCurrentWeekSessions),
      loadWeekSessions(previousWeekNumber, previousYear, setPreviousWeekSessions),
      loadMilestones(),
    ]);
    setLoading(false);
  };

  const loadFatigue = async () => {
    setFatigueError(null);

    const thirtyDaysAgo = format(subDays(today, 30), "yyyy-MM-dd");
    const todayStr = format(today, "yyyy-MM-dd");

    // 1) Try daily_fatigue_log (rich data: sleep + pain)
    const primary = await supabase
      .from("daily_fatigue_log")
      .select("date, sommeil, stress, fatigue, courbatures, has_injury, injury_level, injury_location")
      .eq("user_id", athleteId)
      .gte("date", thirtyDaysAgo)
      .lte("date", todayStr)
      .order("date", { ascending: true });

    if (!primary.error && primary.data) {
      const rows = primary.data as DailyFatigueLogRow[];

      const points: FatiguePoint[] = rows
        .filter((r) => r.date)
        .map((r) => {
          const invSleep = 8 - (r.sommeil ?? 0); // 1..7 where 7 = mauvais sommeil
          const total = invSleep + (r.stress ?? 0) + (r.fatigue ?? 0) + (r.courbatures ?? 0);
          const avg = Math.max(1, Math.min(7, Number((total / 4).toFixed(1))));
          return {
            dateLabel: format(new Date(r.date + "T00:00:00"), "dd/MM", { locale: fr }),
            score: avg,
          };
        });

      const injuryRows = rows.filter((r) => r.has_injury && r.injury_level !== null && r.injury_level > 0);
      const injuryPts: InjuryPoint[] = injuryRows.map((r) => ({
        dateLabel: format(new Date(r.date + "T00:00:00"), "dd/MM", { locale: fr }),
        douleur: r.injury_level || 0,
      }));

      const lastInjury = injuryRows.length > 0 ? injuryRows[injuryRows.length - 1] : null;

      setFatiguePoints(points);
      setInjuryPoints(injuryPts);
      setLatestInjury(lastInjury ? { location: lastInjury.injury_location, level: lastInjury.injury_level } : null);
      return;
    }

    // 2) Fallback: daily_fatigue (coach dashboard uses this table)
    const fallback = await supabase
      .from("daily_fatigue")
      .select("date, user_id, fatigue_score, stress_score, soreness_score")
      .eq("user_id", athleteId)
      .gte("date", thirtyDaysAgo)
      .lte("date", todayStr)
      .order("date", { ascending: true });

    if (!fallback.error && fallback.data) {
      const rows = fallback.data as DailyFatigueRowFallback[];
      const points: FatiguePoint[] = rows.map((r) => {
        const f = r.fatigue_score ?? 0;
        const s = r.stress_score ?? 0;
        const so = r.soreness_score ?? 0;
        const avg = Math.max(1, Math.min(7, Number(((f + s + so) / 3).toFixed(1))));
        return {
          dateLabel: format(new Date(r.date + "T00:00:00"), "dd/MM", { locale: fr }),
          score: avg,
        };
      });

      setFatiguePoints(points);
      setInjuryPoints([]);
      setLatestInjury(null);
      return;
    }

    // 3) Both failed
    const msg = primary.error?.message || fallback.error?.message || "Impossible de charger les données.";
    console.error("Fatigue load error:", { primaryError: primary.error, fallbackError: fallback.error });
    setFatiguePoints([]);
    setInjuryPoints([]);
    setLatestInjury(null);
    setFatigueError(msg);
  };

  const loadMilestones = async () => {
    const { data } = await supabase
      .from("objective_milestones")
      .select("id, name, target_date, completed")
      .eq("athlete_id", athleteId)
      .eq("completed", false)
      .order("target_date", { ascending: true })
      .limit(3);
    if (data) setMilestones(data);
  };

  const loadWeekSessions = async (weekNum: number, year: number, setter: React.Dispatch<React.SetStateAction<SessionInfo[]>>) => {
    const { data: weeks } = await supabase
      .from("training_weeks")
      .select("id")
      .eq("athlete_id", athleteId)
      .eq("week_number", weekNum)
      .eq("year", year);

    let coachSessions: SessionInfo[] = [];
    if (weeks && weeks.length > 0) {
      const { data: sessions } = await supabase
        .from("training_sessions")
        .select("id, name, session_type, completed_at, session_rpe, duration_minutes, scheduled_date")
        .in(
          "week_id",
          weeks.map((w) => w.id)
        )
        .order("session_number");

      if (sessions) {
        const sessionIds = sessions.map((s) => s.id);
        const { data: exercisesWithFeedback } = await supabase
          .from("session_exercises")
          .select("session_id")
          .in("session_id", sessionIds)
          .or("sportif_rpe.not.is.null,skipped.eq.true,sportif_feedback.not.is.null");

        const sessionIdsWithProgress = new Set((exercisesWithFeedback || []).map((e: any) => e.session_id));

        coachSessions = sessions.map((s) => ({
          ...s,
          isCustom: false,
          inProgress: !s.completed_at && sessionIdsWithProgress.has(s.id),
        }));
      }
    }

    const weekStart = startOfWeek(new Date(year, 0, 1 + (weekNum - 1) * 7), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

    const { data: customData } = await supabase
      .from("custom_sessions")
      .select("id, session_name, duration_minutes, completed_at, scheduled_date")
      .eq("user_id", athleteId)
      .or(`completed_at.gte.${weekStart.toISOString()},scheduled_date.gte.${format(weekStart, "yyyy-MM-dd")}`)
      .or(`completed_at.lte.${weekEnd.toISOString()},scheduled_date.lte.${format(weekEnd, "yyyy-MM-dd")}`);

    let custom: SessionInfo[] = [];
    if (customData) {
      custom = customData
        .filter((cs) => {
          const d = cs.completed_at
            ? new Date(cs.completed_at)
            : cs.scheduled_date
              ? new Date(cs.scheduled_date + "T00:00:00")
              : null;
          return d && d >= weekStart && d <= weekEnd;
        })
        .map((cs) => ({
          id: cs.id,
          name: cs.session_name,
          session_type: "custom",
          completed_at: cs.completed_at,
          session_rpe: null,
          duration_minutes: cs.duration_minutes,
          scheduled_date: cs.scheduled_date,
          isCustom: true,
        }));
    }

    setter([...coachSessions, ...custom]);
  };

  // Recovery % (based on last 5 points)
  const last5 = fatiguePoints.slice(-5);
  const recovery =
    last5.length > 0
      ? (() => {
          const avg = last5.reduce((s, e) => s + e.score, 0) / last5.length; // 1..7 where 7 = very fatigued
          const pct = Math.round(((7 - avg) / (7 - 1)) * 100); // map 1..7 => 100..0
          return Math.max(0, Math.min(100, pct));
        })()
      : null;

  const completedCurrent = currentWeekSessions.filter((s) => s.completed_at).length;
  const completedPrevious = previousWeekSessions.filter((s) => s.completed_at).length;

  const getTypeBadge = (s: SessionInfo) => {
    if (s.isCustom) return <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30 text-[9px] px-1.5 py-0">Perso</Badge>;
    if (s.session_type === "cardio") return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30 text-[9px] px-1.5 py-0">Cardio</Badge>;
    if (s.session_type === "recup") return <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-[9px] px-1.5 py-0">Récup</Badge>;
    return <Badge className="bg-purple-500/20 text-purple-600 border-purple-500/30 text-[9px] px-1.5 py-0">Renfo</Badge>;
  };

  const ScoreTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-card border rounded-md p-1.5 text-xs shadow-md">
        <p className="font-semibold">{d.dateLabel}</p>
        <p className="text-primary">Score fatigue : {d.score}/7</p>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-muted-foreground text-sm">Chargement...</p>
      </div>
    );
  }

  const renderSessionCompact = (sessions: SessionInfo[], label: string, completed: number) => (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium">{label}</span>
        <Badge variant="outline" className="text-[9px] h-4">
          {completed}/{sessions.length}
        </Badge>
      </div>
      {sessions.length === 0 ? (
        <p className="text-[10px] text-muted-foreground text-center py-1">Aucune séance</p>
      ) : (
        <div className="space-y-1">
          {sessions.map((s) => {
            const isClickable = !s.isCustom;
            const bgClass = s.completed_at
              ? "bg-green-500/5 border-green-500/20"
              : s.inProgress
              ? "bg-orange-500/5 border-orange-500/30"
              : "bg-muted/20 border-border";
            const hoverClass = s.completed_at
              ? "hover:bg-green-500/10 hover:border-green-500/40"
              : s.inProgress
              ? "hover:bg-orange-500/10 hover:border-orange-500/50"
              : "hover:bg-muted/40";
            return (
              <div
                key={s.id}
                onClick={isClickable ? () => setSelectedSession(s) : undefined}
                role={isClickable ? "button" : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={isClickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedSession(s); } } : undefined}
                className={`flex items-center justify-between px-2 py-1.5 rounded border text-xs overflow-hidden transition-colors ${bgClass} ${isClickable ? `cursor-pointer ${hoverClass}` : ""}`}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                  {s.completed_at ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                  ) : s.inProgress ? (
                    <Clock className="h-3 w-3 text-orange-500 flex-shrink-0" />
                  ) : (
                    <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className={`truncate text-[11px] ${s.inProgress ? "text-orange-400" : ""}`}>{s.name}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                  {s.inProgress && (
                    <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30 text-[9px] px-1.5 py-0">En cours</Badge>
                  )}
                  {getTypeBadge(s)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 overflow-hidden">
      {/* LEFT COLUMN: Fatigue chart + Injury + Objectives */}
      <div className="space-y-3">
        {/* Fatigue score chart */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs flex items-center justify-between gap-1">
              <span className="flex items-center gap-1.5 min-w-0">
                <Heart className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                <span className="truncate">Évolution du score de fatigue</span>
              </span>
              {recovery !== null && (
                <span className={`text-sm font-bold flex-shrink-0 ${recovery >= 70 ? "text-green-500" : recovery >= 40 ? "text-orange-500" : "text-destructive"}`}>
                  {recovery}%
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-1 pb-2">
            {fatiguePoints.length > 0 ? (
              <div style={{ width: "100%", height: "140px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fatiguePoints} margin={{ left: -15, right: 5, top: 5, bottom: 0 }}>
                    <ReferenceArea y1={1} y2={3} fill="hsl(142 76% 36%)" fillOpacity={0.08} />
                    <ReferenceArea y1={3} y2={5} fill="hsl(45 93% 47%)" fillOpacity={0.08} />
                    <ReferenceArea y1={5} y2={7} fill="hsl(0 84% 60%)" fillOpacity={0.08} />
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                    <XAxis dataKey="dateLabel" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 8 }} height={18} interval="preserveStartEnd" />
                    <YAxis domain={[1, 7]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 8 }} width={25} ticks={[1, 3, 5, 7]} />
                    <Tooltip content={<ScoreTooltip />} />
                    <Line type="monotone" dataKey="score" stroke="hsl(45 93% 47%)" strokeWidth={2.5} dot={{ r: 2.5, fill: "hsl(45 93% 47%)", stroke: "hsl(45 93% 47%)" }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-4">
                <p className="text-[10px] text-muted-foreground text-center">Aucune donnée de fatigue</p>
                {fatigueError && <p className="mt-1 text-[10px] text-destructive text-center px-3 break-words">{fatigueError}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Injury chart (conditional) */}
        {latestInjury && injuryPoints.length > 0 && (
          <Card className="overflow-hidden">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                Douleur — {latestInjury.location || "Non précisé"}
                <Badge variant="destructive" className="text-[9px] ml-auto">
                  {latestInjury.level}/7
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-1 pb-2">
              <div style={{ width: "100%", height: "90px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={injuryPoints} margin={{ left: -15, right: 5, top: 5, bottom: 0 }}>
                    <ReferenceArea y1={0} y2={2} fill="hsl(142 76% 36%)" fillOpacity={0.08} />
                    <ReferenceArea y1={2} y2={4} fill="hsl(45 93% 47%)" fillOpacity={0.08} />
                    <ReferenceArea y1={4} y2={7} fill="hsl(0 84% 60%)" fillOpacity={0.08} />
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                    <XAxis dataKey="dateLabel" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 8 }} height={18} interval="preserveStartEnd" />
                    <YAxis domain={[0, 7]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 8 }} width={20} ticks={[0, 3, 7]} />
                    <Line type="monotone" dataKey="douleur" stroke="hsl(0 84% 60%)" strokeWidth={2} dot={{ r: 2.5, fill: "hsl(0 84% 60%)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Milestones */}
        {milestones.length > 0 && (
          <Card>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-primary" />
                Prochains objectifs
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="space-y-1.5">
                {milestones.map((m) => {
                  const diff = differenceInDays(new Date(m.target_date + "T00:00:00"), today);
                  const label = diff < 0 ? `+${Math.abs(diff)}j` : diff === 0 ? "Auj." : `J-${diff}`;
                  const color = diff < 0 ? "text-destructive" : diff <= 7 ? "text-orange-600" : "text-muted-foreground";
                  return (
                    <div key={m.id} className="flex items-center justify-between px-2 py-1.5 rounded border bg-muted/20 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Flag className="h-3 w-3 text-primary flex-shrink-0" />
                        <span className="truncate">{m.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[9px] text-muted-foreground">{format(new Date(m.target_date + "T00:00:00"), "d MMM", { locale: fr })}</span>
                        <Badge variant="outline" className={`text-[9px] h-4 ${color}`}>
                          {label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* RIGHT COLUMN: Sessions */}
      <div className="space-y-3">
        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Séances
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-4">
            {renderSessionCompact(currentWeekSessions, `S${currentWeekNumber} — en cours`, completedCurrent)}
            <div className="border-t pt-3">{renderSessionCompact(previousWeekSessions, `S${previousWeekNumber} — précédente`, completedPrevious)}</div>
          </CardContent>
        </Card>
      </div>
    </div>

    <CoachSessionDetailDialog
      open={!!selectedSession}
      onOpenChange={(open) => !open && setSelectedSession(null)}
      sessionId={selectedSession?.id ?? null}
      sessionType={selectedSession?.session_type ?? ""}
      athleteId={athleteId}
      athleteName={athleteName}
    />
    </>
  );
}
