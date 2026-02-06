import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Users, Dumbbell, AlertTriangle, CalendarDays, Clock, ChevronRight, Activity } from "lucide-react";
import { format, startOfWeek, endOfWeek, parseISO, getISOWeek, getYear } from "date-fns";
import { fr } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";

interface DashboardData {
  activeClients: number;
  pendingRequests: number;
  sessionsCompletedThisWeek: number;
  sessionsProgrammedThisWeek: number;
  unvalidatedAthletes: UnvalidatedAthlete[];
  recentActivities: RecentActivity[];
  fatigueAlerts: FatigueAlert[];
}

interface UnvalidatedAthlete {
  athleteId: string;
  athleteName: string;
  totalSessions: number;
  completedSessions: number;
}

interface RecentActivity {
  id: string;
  type: "session_completed" | "payment" | "new_request";
  label: string;
  detail: string;
  date: string;
}

interface FatigueAlert {
  athleteId: string;
  athleteName: string;
  score: number;
  date: string;
}

export default function CoachDashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [data, setData] = useState<DashboardData>({
    activeClients: 0,
    pendingRequests: 0,
    sessionsCompletedThisWeek: 0,
    sessionsProgrammedThisWeek: 0,
    unvalidatedAthletes: [],
    recentActivities: [],
    fatigueAlerts: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.id) {
      loadDashboardData();
    }
  }, [session?.user?.id]);

  const loadDashboardData = async () => {
    if (!session?.user?.id) return;
    setLoading(true);

    try {
      const coachId = session.user.id;

      // Fetch relationships
      const { data: relationships } = await supabase
        .from("coach_athlete_relationships")
        .select("athlete_id, status")
        .eq("coach_id", coachId);

      const approved = relationships?.filter(r => r.status === "approved") || [];
      const pending = relationships?.filter(r => r.status === "pending") || [];
      const athleteIds = approved.map(r => r.athlete_id);

      // Fetch athlete profiles
      const profileMap = new Map<string, { first_name: string; last_name: string }>();
      if (athleteIds.length > 0) {
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("id, first_name, last_name")
          .in("id", athleteIds);
        (profiles || []).forEach(p => profileMap.set(p.id, { first_name: p.first_name || "", last_name: p.last_name || "" }));
      }

      // Week data
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const weekNumber = getISOWeek(weekStart);
      const weekYear = getYear(weekStart);

      let sessionsCompleted = 0;
      let sessionsProgrammed = 0;
      const recentActivities: RecentActivity[] = [];

      // Track per-athlete session counts for unvalidated list
      const athleteSessionCounts = new Map<string, { total: number; completed: number }>();
      athleteIds.forEach(id => athleteSessionCounts.set(id, { total: 0, completed: 0 }));

      if (athleteIds.length > 0) {
        // Training sessions this week
        const { data: trainingSessions } = await supabase
          .from("training_sessions")
          .select("id, name, session_type, completed_at, training_weeks!inner(athlete_id, week_number, year)")
          .in("training_weeks.athlete_id", athleteIds)
          .eq("training_weeks.week_number", weekNumber)
          .eq("training_weeks.year", weekYear);

        sessionsProgrammed = trainingSessions?.length || 0;

        (trainingSessions || []).forEach((ts: any) => {
          const athleteId = ts.training_weeks?.athlete_id;
          if (athleteId) {
            const counts = athleteSessionCounts.get(athleteId) || { total: 0, completed: 0 };
            counts.total++;
            if (ts.completed_at) {
              counts.completed++;
              sessionsCompleted++;

              const profile = profileMap.get(athleteId);
              const athleteName = profile ? `${profile.first_name} ${profile.last_name}` : "Athlète";
              recentActivities.push({
                id: ts.id,
                type: "session_completed",
                label: athleteName,
                detail: ts.name,
                date: ts.completed_at,
              });
            }
            athleteSessionCounts.set(athleteId, counts);
          }
        });

        // Custom sessions this week
        const weekStartStr = format(weekStart, "yyyy-MM-dd");
        const weekEndStr = format(weekEnd, "yyyy-MM-dd");
        const { data: customSessions } = await supabase
          .from("custom_sessions")
          .select("id, session_name, completed_at, user_id")
          .in("user_id", athleteIds)
          .gte("completed_at", weekStartStr)
          .lte("completed_at", weekEndStr + "T23:59:59");

        (customSessions || []).forEach((cs: any) => {
          if (cs.completed_at) {
            sessionsCompleted++;
            sessionsProgrammed++;
            const counts = athleteSessionCounts.get(cs.user_id) || { total: 0, completed: 0 };
            counts.total++;
            counts.completed++;
            athleteSessionCounts.set(cs.user_id, counts);
          }
        });

        // Build unvalidated athletes list (those with incomplete sessions this week)
        const unvalidatedAthletes: UnvalidatedAthlete[] = [];
        athleteSessionCounts.forEach((counts, athleteId) => {
          if (counts.total > 0 && counts.completed < counts.total) {
            const profile = profileMap.get(athleteId);
            unvalidatedAthletes.push({
              athleteId,
              athleteName: profile ? `${profile.first_name} ${profile.last_name}` : "Athlète",
              totalSessions: counts.total,
              completedSessions: counts.completed,
            });
          }
        });
        // Sort by least completed first, take top 5
        unvalidatedAthletes.sort((a, b) => (a.completedSessions / a.totalSessions) - (b.completedSessions / b.totalSessions));

        // Fatigue alerts (last 3 days, score >= 4)
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const { data: fatigueEntries } = await supabase
          .from("daily_fatigue")
          .select("id, user_id, fatigue_score, stress_score, soreness_score, date")
          .in("user_id", athleteIds)
          .gte("date", format(threeDaysAgo, "yyyy-MM-dd"))
          .order("date", { ascending: false });

        const fatigueAlerts: FatigueAlert[] = [];
        const seenAthletes = new Set<string>();
        (fatigueEntries || []).forEach((entry: any) => {
          const avgScore = Math.round(((entry.fatigue_score || 0) + (entry.stress_score || 0) + (entry.soreness_score || 0)) / 3);
          if (avgScore >= 4 && !seenAthletes.has(entry.user_id)) {
            seenAthletes.add(entry.user_id);
            const profile = profileMap.get(entry.user_id);
            fatigueAlerts.push({
              athleteId: entry.user_id,
              athleteName: profile ? `${profile.first_name} ${profile.last_name}` : "Athlète",
              score: avgScore,
              date: entry.date,
            });
          }
        });

        // Recent payments
        const { data: recentPayments } = await supabase
          .from("athlete_subscriptions")
          .select("id, athlete_id, product_name, paid_at")
          .in("athlete_id", athleteIds)
          .order("paid_at", { ascending: false })
          .limit(5);

        (recentPayments || []).forEach((p: any) => {
          const profile = profileMap.get(p.athlete_id);
          recentActivities.push({
            id: p.id,
            type: "payment",
            label: profile ? `${profile.first_name} ${profile.last_name}` : "Athlète",
            detail: p.product_name,
            date: p.paid_at,
          });
        });

        setData({
          activeClients: approved.length,
          pendingRequests: pending.length,
          sessionsCompletedThisWeek: sessionsCompleted,
          sessionsProgrammedThisWeek: sessionsProgrammed,
          unvalidatedAthletes: unvalidatedAthletes.slice(0, 5),
          recentActivities: recentActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8),
          fatigueAlerts,
        });
      } else {
        setData(prev => ({
          ...prev,
          activeClients: approved.length,
          pendingRequests: pending.length,
        }));
      }
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const completionRate = data.sessionsProgrammedThisWeek > 0
    ? Math.round((data.sessionsCompletedThisWeek / data.sessionsProgrammedThisWeek) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Chargement du tableau de bord...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">
          {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/coach/mes-clients")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5 text-primary" />
              {data.pendingRequests > 0 && (
                <Badge variant="destructive" className="text-xs">{data.pendingRequests}</Badge>
              )}
            </div>
            <p className="text-2xl font-bold text-foreground">{data.activeClients}</p>
            <p className="text-xs text-muted-foreground">Clients actifs</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/coach/agenda")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Dumbbell className="h-5 w-5 text-primary" />
              <span className="text-xs text-muted-foreground">{completionRate}%</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {data.sessionsCompletedThisWeek}/{data.sessionsProgrammedThisWeek}
            </p>
            <p className="text-xs text-muted-foreground">Séances cette semaine</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center mb-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <p className="text-2xl font-bold text-foreground">{data.fatigueAlerts.length}</p>
            <p className="text-xs text-muted-foreground">Alertes fatigue</p>
          </CardContent>
        </Card>
      </div>

      <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-2"} gap-4`}>
        {/* Séances non validées cette semaine */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Séances à valider
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.unvalidatedAthletes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Toutes les séances sont validées 👍
              </p>
            ) : (
              data.unvalidatedAthletes.map(a => (
                <div
                  key={a.athleteId}
                  className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 cursor-pointer hover:bg-secondary/80 transition-colors"
                  onClick={() => navigate(`/coach/client/${a.athleteId}`)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{a.athleteName}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Badge variant="outline" className="text-xs">
                      {a.completedSessions}/{a.totalSessions}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Alertes fatigue */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-destructive" />
              Alertes fatigue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.fatigueAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Aucune alerte en cours 👍
              </p>
            ) : (
              data.fatigueAlerts.map(a => (
                <div
                  key={a.athleteId}
                  className="flex items-center justify-between p-2 rounded-lg bg-destructive/10 cursor-pointer hover:bg-destructive/20 transition-colors"
                  onClick={() => navigate(`/coach/client/${a.athleteId}`)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{a.athleteName}</p>
                    <p className="text-xs text-muted-foreground">{format(parseISO(a.date), "d MMM", { locale: fr })}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Badge variant="destructive" className="text-xs">{a.score}/7</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dernières activités */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Dernières activités
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.recentActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Aucune activité récente
            </p>
          ) : (
            data.recentActivities.map(a => (
              <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors">
                <div className={`h-2 w-2 rounded-full shrink-0 ${
                  a.type === "session_completed" ? "bg-green-500" :
                  a.type === "payment" ? "bg-primary" : "bg-blue-500"
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">
                    <span className="font-medium">{a.label}</span>
                    <span className="text-muted-foreground"> — {a.detail}</span>
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {format(parseISO(a.date), "d MMM HH:mm", { locale: fr })}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
