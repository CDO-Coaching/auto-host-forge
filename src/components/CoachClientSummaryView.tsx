import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfWeek, endOfWeek, getISOWeek, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { getWeekYear } from "@/lib/weekUtils";
import { Heart, CheckCircle2, Clock, Calendar, AlertTriangle, Target, Flag } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";

interface CoachClientSummaryViewProps {
  athleteId: string;
  athleteName: string;
}

interface FatigueEntry {
  date: string;
  sleep_quality: number;
  stress_level: number;
  fatigue_level: number;
  soreness_level: number;
  has_injury: boolean;
  injury_level: number | null;
  injury_location: string | null;
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
  description?: string;
}

interface ObjectiveData {
  primary_objective: string | null;
  secondary_objective: string | null;
}

interface Milestone {
  id: string;
  name: string;
  target_date: string;
  completed: boolean;
}

export function CoachClientSummaryView({ athleteId, athleteName }: CoachClientSummaryViewProps) {
  const [fatigueData, setFatigueData] = useState<FatigueEntry[]>([]);
  const [currentWeekSessions, setCurrentWeekSessions] = useState<SessionInfo[]>([]);
  const [previousWeekSessions, setPreviousWeekSessions] = useState<SessionInfo[]>([]);
  const [objectives, setObjectives] = useState<ObjectiveData | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, [athleteId]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      loadFatigue(),
      loadWeekSessions(currentWeekNumber, currentYear, setCurrentWeekSessions),
      loadWeekSessions(previousWeekNumber, previousYear, setPreviousWeekSessions),
      loadObjectives(),
    ]);
    setLoading(false);
  };

  const loadFatigue = async () => {
    const sevenDaysAgo = format(subDays(today, 6), "yyyy-MM-dd");
    const todayStr = format(today, "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("daily_fatigue_log")
      .select("date, sleep_quality, stress_level, fatigue_level, soreness_level, has_injury, injury_level, injury_location")
      .eq("user_id", athleteId)
      .gte("date", sevenDaysAgo)
      .lte("date", todayStr)
      .order("date", { ascending: true });

    if (!error && data) {
      setFatigueData(data as FatigueEntry[]);
    }
  };

  const loadObjectives = async () => {
    const { data: objData } = await supabase
      .from("athlete_objectives")
      .select("primary_objective, secondary_objective")
      .eq("athlete_id", athleteId)
      .maybeSingle();

    if (objData) setObjectives(objData);

    const { data: milData } = await supabase
      .from("objective_milestones")
      .select("id, name, target_date, completed")
      .eq("athlete_id", athleteId)
      .order("target_date", { ascending: true });

    if (milData) setMilestones(milData);
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
      const weekIds = weeks.map(w => w.id);
      const { data: sessions } = await supabase
        .from("training_sessions")
        .select("id, name, session_type, completed_at, session_rpe, duration_minutes, scheduled_date")
        .in("week_id", weekIds)
        .order("session_number");

      if (sessions) {
        coachSessions = sessions.map(s => ({ ...s, isCustom: false }));
      }
    }

    const weekStart = startOfWeek(new Date(year, 0, 1 + (weekNum - 1) * 7), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

    const { data: customData } = await supabase
      .from("custom_sessions")
      .select("id, session_name, duration_minutes, completed_at, description, scheduled_date")
      .eq("user_id", athleteId)
      .or(`completed_at.gte.${weekStart.toISOString()},scheduled_date.gte.${format(weekStart, "yyyy-MM-dd")}`)
      .or(`completed_at.lte.${weekEnd.toISOString()},scheduled_date.lte.${format(weekEnd, "yyyy-MM-dd")}`);

    let customSessions: SessionInfo[] = [];
    if (customData) {
      customSessions = customData
        .filter(cs => {
          const completedDate = cs.completed_at ? new Date(cs.completed_at) : null;
          const scheduledDate = cs.scheduled_date ? new Date(cs.scheduled_date + "T00:00:00") : null;
          const date = completedDate || scheduledDate;
          return date && date >= weekStart && date <= weekEnd;
        })
        .map(cs => ({
          id: cs.id,
          name: cs.session_name,
          session_type: "custom",
          completed_at: cs.completed_at,
          session_rpe: null,
          duration_minutes: cs.duration_minutes,
          scheduled_date: cs.scheduled_date,
          isCustom: true,
          description: cs.description,
        }));
    }

    setter([...coachSessions, ...customSessions]);
  };

  // Build fatigue chart data
  const fatigueChartData = fatigueData.map(entry => {
    const invertedSleep = 8 - entry.sleep_quality;
    const totalScore = (invertedSleep + entry.stress_level + entry.fatigue_level + entry.soreness_level) / 4;
    return {
      date: format(new Date(entry.date + "T00:00:00"), "EEE dd", { locale: fr }),
      fatigue: entry.fatigue_level,
      courbatures: entry.soreness_level,
      sommeil: invertedSleep,
      stress: entry.stress_level,
      score: Math.round(totalScore * 10) / 10,
    };
  });

  // Build injury chart data
  const injuryEntries = fatigueData.filter(e => e.has_injury && e.injury_level !== null);
  const injuryChartData = injuryEntries.map(entry => ({
    date: format(new Date(entry.date + "T00:00:00"), "EEE dd", { locale: fr }),
    douleur: entry.injury_level || 0,
    location: entry.injury_location || "Non précisé",
  }));

  const getLatestInjury = () => {
    const injured = [...fatigueData].reverse().find(f => f.has_injury && f.injury_level && f.injury_level > 0);
    if (!injured) return null;
    return { level: injured.injury_level!, location: injured.injury_location || "Non précisé" };
  };

  // Recovery percentage
  const getRecoveryInfo = () => {
    if (fatigueData.length === 0) return null;
    const last5 = fatigueData.slice(-5);
    const totalScores = last5.map(entry => {
      const invertedSleep = 8 - entry.sleep_quality;
      return invertedSleep + entry.stress_level + entry.fatigue_level + entry.soreness_level;
    });
    const avgScore = totalScores.reduce((sum, s) => sum + s, 0) / totalScores.length;
    const percentage = Math.round(((28 - avgScore) / (28 - 4)) * 100);
    return { percentage: Math.max(0, Math.min(100, percentage)), days: last5.length };
  };

  const getSessionTypeBadge = (session: SessionInfo) => {
    if (session.isCustom) return <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30 text-[10px]">Perso</Badge>;
    if (session.session_type === "cardio") return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30 text-[10px]">Cardio</Badge>;
    if (session.session_type === "recup") return <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-[10px]">Récup</Badge>;
    return <Badge className="bg-purple-500/20 text-purple-600 border-purple-500/30 text-[10px]">Renfo</Badge>;
  };

  const getDaysRemainingLabel = (targetDate: string) => {
    const target = new Date(targetDate + "T00:00:00");
    const diff = differenceInDays(target, today);
    if (diff < 0) return { label: `Dépassé de ${Math.abs(diff)}j`, color: "text-destructive" };
    if (diff === 0) return { label: "Aujourd'hui", color: "text-green-600" };
    if (diff === 1) return { label: "Demain", color: "text-orange-600" };
    return { label: `J-${diff}`, color: diff <= 7 ? "text-orange-600" : "text-muted-foreground" };
  };

  const renderSessionList = (sessions: SessionInfo[], weekLabel: string) => {
    const completed = sessions.filter(s => s.completed_at);
    return (
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {weekLabel}
            </span>
            <Badge variant="outline" className="text-xs">
              {completed.length}/{sessions.length} validée{sessions.length > 1 ? "s" : ""}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune séance</p>
          ) : (
            <div className="space-y-2">
              {sessions.map(session => {
                const isCompleted = !!session.completed_at;
                const sessionDate = session.completed_at
                  ? format(new Date(session.completed_at), "EEEE d MMM", { locale: fr })
                  : session.scheduled_date
                    ? format(new Date(session.scheduled_date + "T00:00:00"), "EEEE d MMM", { locale: fr })
                    : null;
                return (
                  <div
                    key={session.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border ${
                      isCompleted ? "bg-green-500/5 border-green-500/20" : "bg-muted/30 border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{session.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {sessionDate && <span className="capitalize">{sessionDate}</span>}
                          {session.duration_minutes && <span>· {session.duration_minutes} min</span>}
                          {session.session_rpe && <span>· RPE {session.session_rpe}</span>}
                        </div>
                      </div>
                    </div>
                    {getSessionTypeBadge(session)}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const FatigueTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-card border rounded-md p-2 text-xs shadow-md">
          <p className="font-semibold mb-1">{d.date}</p>
          <p>Fatigue: <strong>{d.fatigue}/7</strong></p>
          <p>Courbatures: <strong>{d.courbatures}/7</strong></p>
          <p>Sommeil (inversé): <strong>{d.sommeil}/7</strong></p>
          <p>Stress: <strong>{d.stress}/7</strong></p>
          <p className="mt-1 font-semibold">Moyenne: {d.score}/7</p>
        </div>
      );
    }
    return null;
  };

  const InjuryTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-card border rounded-md p-2 text-xs shadow-md">
          <p className="font-semibold mb-1">{d.date}</p>
          <p>Douleur: <strong>{d.douleur}/7</strong></p>
          <p className="text-muted-foreground">{d.location}</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-muted-foreground text-sm">Chargement du résumé...</p>
      </div>
    );
  }

  const recovery = getRecoveryInfo();
  const injury = getLatestInjury();

  return (
    <div className="space-y-4">
      {/* Recovery + fatigue chart */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Heart className="h-4 w-4 text-red-500" />
            État de forme (7 derniers jours)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {fatigueChartData.length > 0 ? (
            <div className="space-y-3">
              {/* Recovery percentage */}
              {recovery && (
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold">{recovery.percentage}%</span>
                  <Progress
                    value={recovery.percentage}
                    className={`h-2.5 flex-1 ${
                      recovery.percentage >= 70 ? "[&>div]:bg-green-500" :
                      recovery.percentage >= 40 ? "[&>div]:bg-orange-500" :
                      "[&>div]:bg-destructive"
                    }`}
                  />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {recovery.days}j
                  </span>
                </div>
              )}

              {/* Fatigue chart */}
              <div style={{ width: "100%", height: "160px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fatigueChartData} margin={{ left: -25, right: 5, top: 5, bottom: 5 }}>
                    <ReferenceArea y1={1} y2={3} fill="hsl(142 76% 36%)" fillOpacity={0.1} />
                    <ReferenceArea y1={3} y2={5} fill="hsl(45 93% 47%)" fillOpacity={0.1} />
                    <ReferenceArea y1={5} y2={7} fill="hsl(0 84% 60%)" fillOpacity={0.1} />
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} height={20} />
                    <YAxis domain={[1, 7]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} width={30} ticks={[1, 3, 5, 7]} />
                    <Tooltip content={<FatigueTooltip />} />
                    <Line type="monotone" dataKey="fatigue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2.5 }} name="Fatigue" />
                    <Line type="monotone" dataKey="courbatures" stroke="hsl(25 95% 53%)" strokeWidth={1.5} dot={{ r: 2 }} name="Courbatures" />
                    <Line type="monotone" dataKey="sommeil" stroke="hsl(221 83% 53%)" strokeWidth={1.5} dot={{ r: 2 }} name="Sommeil" />
                    <Line type="monotone" dataKey="stress" stroke="hsl(280 65% 60%)" strokeWidth={1.5} dot={{ r: 2 }} name="Stress" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "hsl(var(--primary))" }} />Fatigue</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "hsl(25 95% 53%)" }} />Courbatures</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "hsl(221 83% 53%)" }} />Sommeil</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "hsl(280 65% 60%)" }} />Stress</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune donnée de fatigue sur les 7 derniers jours
            </p>
          )}
        </CardContent>
      </Card>

      {/* Injury/Pain chart */}
      {injury && injuryChartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Douleur — {injury.location}
              <Badge variant="destructive" className="text-[10px] ml-auto">{injury.level}/7</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div style={{ width: "100%", height: "120px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={injuryChartData} margin={{ left: -25, right: 5, top: 5, bottom: 5 }}>
                  <ReferenceArea y1={0} y2={2} fill="hsl(142 76% 36%)" fillOpacity={0.1} />
                  <ReferenceArea y1={2} y2={4} fill="hsl(45 93% 47%)" fillOpacity={0.1} />
                  <ReferenceArea y1={4} y2={7} fill="hsl(0 84% 60%)" fillOpacity={0.1} />
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} height={20} />
                  <YAxis domain={[0, 7]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} width={30} ticks={[0, 2, 4, 7]} />
                  <Tooltip content={<InjuryTooltip />} />
                  <Line type="monotone" dataKey="douleur" stroke="hsl(0 84% 60%)" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(0 84% 60%)" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Objectives & milestones */}
      {(objectives || milestones.length > 0) && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Objectifs
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {objectives?.primary_objective && (
              <div className="p-2.5 rounded-lg border bg-primary/5 border-primary/20">
                <p className="text-[10px] text-muted-foreground uppercase font-medium mb-0.5">Objectif principal</p>
                <p className="text-sm font-medium">{objectives.primary_objective}</p>
              </div>
            )}
            {objectives?.secondary_objective && (
              <div className="p-2.5 rounded-lg border bg-muted/30">
                <p className="text-[10px] text-muted-foreground uppercase font-medium mb-0.5">Objectif secondaire</p>
                <p className="text-sm">{objectives.secondary_objective}</p>
              </div>
            )}

            {milestones.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Flag className="h-3.5 w-3.5" />
                  Jalons
                </p>
                {milestones.map(milestone => {
                  const remaining = getDaysRemainingLabel(milestone.target_date);
                  return (
                    <div
                      key={milestone.id}
                      className={`flex items-center justify-between p-2 rounded-lg border ${
                        milestone.completed ? "bg-green-500/5 border-green-500/20" : "bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {milestone.completed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <Flag className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className={`text-sm truncate ${milestone.completed ? "line-through text-muted-foreground" : "font-medium"}`}>
                            {milestone.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground capitalize">
                            {format(new Date(milestone.target_date + "T00:00:00"), "d MMMM yyyy", { locale: fr })}
                          </p>
                        </div>
                      </div>
                      {!milestone.completed && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${remaining.color} flex-shrink-0`}
                        >
                          {remaining.label}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!objectives?.primary_objective && !objectives?.secondary_objective && milestones.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">Aucun objectif défini</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Week sessions */}
      {renderSessionList(currentWeekSessions, `Semaine ${currentWeekNumber} (en cours)`)}
      {renderSessionList(previousWeekSessions, `Semaine ${previousWeekNumber} (précédente)`)}
    </div>
  );
}
