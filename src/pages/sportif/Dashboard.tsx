import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { getWeekNumber, getWeekYear, formatWeekRangeFromNumber } from "@/lib/weekUtils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Dumbbell,
  Activity,
  ChevronRight,
  MessageSquare,
  CalendarCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Smile,
  Frown,
  Meh,
} from "lucide-react";

interface WeeklySessionInfo {
  total: number;
  completed: number;
  nextSession: { name: string; type: string; id: string; weekId: string } | null;
}

interface FatigueInfo {
  score: number | null;
  hasToday: boolean;
}

export default function SportifDashboard() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const firstName = profile?.first_name || "Champion";

  const [weeklyInfo, setWeeklyInfo] = useState<WeeklySessionInfo>({ total: 0, completed: 0, nextSession: null });
  const [fatigue, setFatigue] = useState<FatigueInfo>({ score: null, hasToday: false });
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const isSessionCompleted = useCallback((session: any) => {
    if (!session.session_exercises || session.session_exercises.length === 0) return false;
    if (session.session_type === "recup") {
      return session.duration_minutes !== null && session.duration_minutes !== undefined;
    }
    return session.session_exercises.every(
      (ex: any) => (ex.sportif_rpe !== null && ex.sportif_rpe !== undefined) || ex.skipped === true
    );
  }, []);

  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadWeeklySessions(), loadFatigue(), loadUnreadMessages()]);
    setLoading(false);
  };

  const loadWeeklySessions = async () => {
    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const year = getWeekYear(now);

    const { data: week } = await supabase
      .from("training_weeks")
      .select("id")
      .eq("week_number", weekNumber)
      .eq("year", year)
      .eq("validated", true)
      .maybeSingle();

    if (!week) {
      setWeeklyInfo({ total: 0, completed: 0, nextSession: null });
      return;
    }

    const { data: sessions } = await supabase
      .from("training_sessions")
      .select("*, session_exercises(*)")
      .eq("week_id", week.id)
      .order("session_number");

    if (!sessions || sessions.length === 0) {
      setWeeklyInfo({ total: 0, completed: 0, nextSession: null });
      return;
    }

    let completed = 0;
    let nextSession: WeeklySessionInfo["nextSession"] = null;

    for (const s of sessions) {
      if (isSessionCompleted(s)) {
        completed++;
      } else if (!nextSession) {
        nextSession = {
          name: s.athlete_custom_name || s.name,
          type: s.session_type || "renfo",
          id: s.id,
          weekId: week.id,
        };
      }
    }

    // Also count custom sessions for the week
    const { count: customCount } = await supabase
      .from("custom_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .not("completed_at", "is", null)
      .gte("completed_at", getMondayISO(weekNumber, year))
      .lte("completed_at", getSundayISO(weekNumber, year));

    setWeeklyInfo({
      total: sessions.length,
      completed: completed + (customCount || 0),
      nextSession,
    });
  };

  const loadFatigue = async () => {
    const today = new Date().toISOString().split("T")[0];

    const { data } = await supabase
      .from("daily_fatigue_log")
      .select("score_total, date")
      .eq("user_id", user!.id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    setFatigue({
      score: data?.score_total ?? null,
      hasToday: data?.date === today,
    });
  };

  const loadUnreadMessages = async () => {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", user!.id)
      .is("read_at", null);

    setUnreadCount(count || 0);
  };

  const getMondayISO = (week: number, year: number) => {
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
    return monday.toISOString().split("T")[0];
  };

  const getSundayISO = (week: number, year: number) => {
    const mon = getMondayISO(week, year);
    const d = new Date(mon);
    d.setDate(d.getDate() + 6);
    return d.toISOString().split("T")[0];
  };

  const progressPercent = weeklyInfo.total > 0 ? Math.round((weeklyInfo.completed / weeklyInfo.total) * 100) : 0;

  // Score min = 4 (meilleur), max = 28 (pire) → plage de 24
  const getRecoveryPercent = (score: number) => Math.max(0, Math.min(100, Math.round(((28 - score) / 24) * 100)));

  const getRecoveryColor = (percent: number) => {
    if (percent >= 68) return "text-green-500";
    if (percent >= 50) return "text-green-400";
    if (percent >= 36) return "text-yellow-500";
    if (percent >= 22) return "text-orange-500";
    return "text-red-500";
  };

  const getRecoveryIcon = (percent: number) => {
    if (percent >= 50) return <Smile className="h-8 w-8 text-green-500" />;
    if (percent >= 36) return <Meh className="h-8 w-8 text-yellow-500" />;
    return <Frown className="h-8 w-8 text-red-500" />;
  };

  const getRecoveryLabel = (percent: number) => {
    if (percent >= 68) return "Très bon";
    if (percent >= 50) return "Bon";
    if (percent >= 36) return "Alerte";
    if (percent >= 22) return "Risque";
    return "Critique";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  const now = new Date();
  const currentWeek = getWeekNumber(now);
  const currentYear = getWeekYear(now);

  return (
    <div className="space-y-4 sm:space-y-6 pb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Bonjour {firstName} 👋</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Semaine {currentWeek} • {formatWeekRangeFromNumber(currentWeek, currentYear)}
        </p>
      </div>

      {/* Progression hebdomadaire */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Dumbbell className="h-5 w-5 text-primary" />
            Progression de la semaine
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {weeklyInfo.total > 0 ? (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {weeklyInfo.completed}/{weeklyInfo.total} séances complétées
                </span>
                <span className="font-bold text-primary">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-3" />
              {progressPercent === 100 && (
                <p className="text-sm text-green-500 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Semaine complétée, bravo ! 🎉
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Pas encore de programme cette semaine</span>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => navigate("/sportif/seances")}
          >
            Voir mes séances
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Score de fatigue */}
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/sportif/fatigue")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5 text-primary" />
              Récupération
            </CardTitle>
          </CardHeader>
          <CardContent>
            {fatigue.score !== null ? (() => {
              const percent = getRecoveryPercent(fatigue.score);
              return (
                <div className="flex items-center gap-3">
                  {getRecoveryIcon(percent)}
                  <div className="flex-1">
                    <div className="flex items-baseline gap-1">
                      <p className={`text-2xl font-bold ${getRecoveryColor(percent)}`}>
                        {percent}%
                      </p>
                      <span className="text-xs text-muted-foreground">de forme</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{getRecoveryLabel(percent)}</p>
                    <Progress value={percent} className="h-2 mt-1.5" />
                  </div>
                </div>
              );
            })() : (
              <p className="text-sm text-muted-foreground">Aucune donnée récente</p>
            )}
            {!fatigue.hasToday && (
              <Badge variant="outline" className="mt-2 border-orange-500 text-orange-500 text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Non rempli aujourd'hui
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Messages non lus */}
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/sportif/messagerie")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-5 w-5 text-primary" />
              Messagerie
            </CardTitle>
          </CardHeader>
          <CardContent>
            {unreadCount > 0 ? (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">{unreadCount}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {unreadCount === 1 ? "message non lu" : "messages non lus"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun nouveau message</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Prochaine séance */}
      {weeklyInfo.nextSession && (
        <Card
          className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => {
            const s = weeklyInfo.nextSession!;
            if (s.type === "recup") {
              navigate(`/sportif/recup/${s.weekId}/${s.id}`);
            } else {
              navigate(`/sportif/seance/${s.weekId}/${s.id}`);
            }
          }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="h-5 w-5 text-primary" />
              Prochaine séance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-lg">{weeklyInfo.nextSession.name}</p>
                <Badge variant="outline" className="mt-1 text-xs capitalize">
                  {weeklyInfo.nextSession.type === "recup"
                    ? "Récup/Mobilité"
                    : weeklyInfo.nextSession.type === "cardio"
                    ? "Cardio"
                    : "Renforcement"}
                </Badge>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
