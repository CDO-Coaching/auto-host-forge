import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfWeek, endOfWeek, getISOWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { getWeekYear } from "@/lib/weekUtils";
import { Heart, Dumbbell, Activity, CheckCircle2, Clock, Calendar, AlertTriangle } from "lucide-react";

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

export function CoachClientSummaryView({ athleteId, athleteName }: CoachClientSummaryViewProps) {
  const [fatigueData, setFatigueData] = useState<FatigueEntry[]>([]);
  const [currentWeekSessions, setCurrentWeekSessions] = useState<SessionInfo[]>([]);
  const [previousWeekSessions, setPreviousWeekSessions] = useState<SessionInfo[]>([]);
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
    await Promise.all([loadFatigue(), loadWeekSessions(currentWeekNumber, currentYear, setCurrentWeekSessions), loadWeekSessions(previousWeekNumber, previousYear, setPreviousWeekSessions)]);
    setLoading(false);
  };

  const loadFatigue = async () => {
    const fiveDaysAgo = format(subDays(today, 4), "yyyy-MM-dd");
    const todayStr = format(today, "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("daily_fatigue_log")
      .select("date, sleep_quality, stress_level, fatigue_level, soreness_level, has_injury, injury_level, injury_location")
      .eq("user_id", athleteId)
      .gte("date", fiveDaysAgo)
      .lte("date", todayStr)
      .order("date", { ascending: false });

    if (!error && data) {
      setFatigueData(data as FatigueEntry[]);
    }
  };

  const loadWeekSessions = async (weekNum: number, year: number, setter: React.Dispatch<React.SetStateAction<SessionInfo[]>>) => {
    // Load coach-programmed sessions for this week
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

    // Load custom/personal sessions for this week's date range
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

  // Calculate recovery percentage (same logic as athlete dashboard)
  const getRecoveryInfo = () => {
    if (fatigueData.length === 0) return null;

    const totalScores = fatigueData.map(entry => {
      // Invert sleep (high sleep = good = low fatigue contribution)
      const invertedSleep = 8 - entry.sleep_quality;
      return invertedSleep + entry.stress_level + entry.fatigue_level + entry.soreness_level;
    });

    const avgScore = totalScores.reduce((sum, s) => sum + s, 0) / totalScores.length;
    // Score range: 4 (best) to 28 (worst)
    const percentage = Math.round(((28 - avgScore) / (28 - 4)) * 100);
    return { percentage: Math.max(0, Math.min(100, percentage)), days: fatigueData.length };
  };

  const getLatestInjury = () => {
    const injured = fatigueData.find(f => f.has_injury && f.injury_level && f.injury_level > 0);
    if (!injured) return null;
    return { level: injured.injury_level!, location: injured.injury_location || "Non précisé" };
  };

  const getSessionTypeBadge = (session: SessionInfo) => {
    if (session.isCustom) return <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30 text-[10px]">Perso</Badge>;
    if (session.session_type === "cardio") return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30 text-[10px]">Cardio</Badge>;
    if (session.session_type === "recup") return <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-[10px]">Récup</Badge>;
    return <Badge className="bg-purple-500/20 text-purple-600 border-purple-500/30 text-[10px]">Renfo</Badge>;
  };

  const renderSessionList = (sessions: SessionInfo[], weekLabel: string) => {
    const completed = sessions.filter(s => s.completed_at);
    const pending = sessions.filter(s => !s.completed_at);

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
                      isCompleted 
                        ? "bg-green-500/5 border-green-500/20" 
                        : "bg-muted/30 border-border"
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
      {/* Recovery card */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Heart className="h-4 w-4 text-red-500" />
            État de forme (5 derniers jours)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {recovery ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{recovery.percentage}%</span>
                <span className="text-xs text-muted-foreground">
                  Moyenne sur {recovery.days} jour{recovery.days > 1 ? "s" : ""}
                </span>
              </div>
              <Progress 
                value={recovery.percentage} 
                className={`h-3 ${
                  recovery.percentage >= 70 ? "[&>div]:bg-green-500" : 
                  recovery.percentage >= 40 ? "[&>div]:bg-orange-500" : 
                  "[&>div]:bg-destructive"
                }`}
              />
              {/* Individual daily scores */}
              <div className="flex gap-1.5 mt-2">
                {fatigueData.slice().reverse().map(entry => {
                  const invertedSleep = 8 - entry.sleep_quality;
                  const total = invertedSleep + entry.stress_level + entry.fatigue_level + entry.soreness_level;
                  const dayPct = Math.round(((28 - total) / (28 - 4)) * 100);
                  return (
                    <div key={entry.date} className="flex-1 text-center">
                      <div 
                        className={`h-8 rounded-md flex items-center justify-center text-[10px] font-medium ${
                          dayPct >= 70 ? "bg-green-500/20 text-green-600" :
                          dayPct >= 40 ? "bg-orange-500/20 text-orange-600" :
                          "bg-destructive/20 text-destructive"
                        }`}
                      >
                        {dayPct}%
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5 capitalize">
                        {format(new Date(entry.date + "T00:00:00"), "EEE", { locale: fr })}
                      </p>
                    </div>
                  );
                })}
              </div>
              {/* Injury alert */}
              {injury && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20 mt-2">
                  <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                  <div className="text-xs">
                    <span className="font-medium text-destructive">Blessure : {injury.location}</span>
                    <span className="text-muted-foreground ml-1">— Douleur {injury.level}/7</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune donnée de fatigue sur les 5 derniers jours
            </p>
          )}
        </CardContent>
      </Card>

      {/* Week sessions */}
      {renderSessionList(currentWeekSessions, `Semaine ${currentWeekNumber} (en cours)`)}
      {renderSessionList(previousWeekSessions, `Semaine ${previousWeekNumber} (précédente)`)}
    </div>
  );
}
