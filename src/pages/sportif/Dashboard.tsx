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
import { getCardioEstimatedDuration, isCardioSession } from "@/lib/cardioEstimatedDuration";
import {
  Dumbbell,
  Activity,
  ChevronRight,
  MessageSquare,
  CalendarCheck,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Smile,
  Frown,
  Meh,
} from "lucide-react";
import { AthleteSfmsRequestBanner } from "@/components/AthleteSfmsRequestBanner";
import { WelcomeBanner } from "@/components/sportif/WelcomeBanner";

interface WeeklySessionInfo {
  total: number;
  completed: number;
  nextSession: { name: string; type: string; id: string; weekId: string; overdue: boolean; scheduledLabel: string; estimatedDuration: string | null } | null;
}

interface FatigueInfo {
  avgScore: number | null;
  entryCount: number;
  hasToday: boolean;
}

interface WeeklyStats {
  totalDurationMinutes: number;
  completedCount: number;
  distanceBySport: { course: number; velo: number; natation: number };
}

export default function SportifDashboard() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const firstName = profile?.first_name || "Champion";

  const [weeklyInfo, setWeeklyInfo] = useState<WeeklySessionInfo>({ total: 0, completed: 0, nextSession: null });
  const [fatigue, setFatigue] = useState<FatigueInfo>({ avgScore: null, entryCount: 0, hasToday: false });
  const [unreadCount, setUnreadCount] = useState(0);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({ totalDurationMinutes: 0, completedCount: 0, distanceBySport: { course: 0, velo: 0, natation: 0 } });
  const [loading, setLoading] = useState(true);

  const isSessionCompleted = useCallback((session: any) => {
    // A session is completed when the athlete has validated it (completed_at is set)
    if (session.completed_at) return true;
    // Fallback: check exercise-level completion for legacy data
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
    await Promise.all([loadWeeklySessions(), loadFatigue(), loadUnreadMessages(), loadWeeklyStats()]);
    setLoading(false);
  };

  const loadWeeklySessions = async () => {
    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const year = getWeekYear(now);

    // Fetch VMA for cardio duration calculation
    let athleteVma: number | null = null;
    if (user) {
      const { data: profileData } = await supabase.from("user_profiles").select("vma").eq("id", user.id).single();
      if (profileData?.vma) athleteVma = profileData.vma;
    }

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
    const incompleteSessions: typeof sessions = [];

    for (const s of sessions) {
      if (isSessionCompleted(s)) {
        completed++;
      } else {
        incompleteSessions.push(s);
      }
    }

    // Sort incomplete sessions: scheduled ones first (by date), then by session_number for same-day ordering
    incompleteSessions.sort((a, b) => {
      const aDate = a.scheduled_date;
      const bDate = b.scheduled_date;
      if (aDate && bDate) {
        const dateCmp = aDate.localeCompare(bDate);
        if (dateCmp !== 0) return dateCmp;
      }
      if (aDate && !bDate) return -1;
      if (!aDate && bDate) return 1;
      return a.session_number - b.session_number;
    });

    const nextS = incompleteSessions[0] || null;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const isOverdue = nextS?.scheduled_date ? nextS.scheduled_date < todayStr : false;
    const nextSession: WeeklySessionInfo["nextSession"] = nextS ? {
      name: nextS.athlete_custom_name || nextS.name,
      type: nextS.session_type || "renfo",
      id: nextS.id,
      weekId: week.id,
      overdue: isOverdue,
      scheduledLabel: nextS.scheduled_date ? format(new Date(nextS.scheduled_date + "T00:00:00"), "EEEE d", { locale: fr }) : "",
      estimatedDuration: isCardioSession(nextS) ? getCardioEstimatedDuration(nextS.session_exercises || [], athleteVma) : null,
    } : null;

    // Also count custom sessions for the week
    const mondayISO = getMondayISO(weekNumber, year);
    const sundayISO = getSundayISO(weekNumber, year);

    const { data: customData } = await supabase
      .from("custom_sessions")
      .select("id, completed_at")
      .eq("user_id", user!.id)
      .or(`and(completed_at.gte.${mondayISO},completed_at.lte.${sundayISO}T23:59:59),and(scheduled_date.gte.${mondayISO},scheduled_date.lte.${sundayISO})`);

    const customTotal = customData?.length || 0;
    const customCompleted = customData?.filter(c => c.completed_at != null).length || 0;

    setWeeklyInfo({
      total: sessions.length + customTotal,
      completed: completed + customCompleted,
      nextSession,
    });
  };

  const loadFatigue = async () => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 4); // aujourd'hui inclus = 5 jours

    const { data } = await supabase
      .from("daily_fatigue_log")
      .select("score_total, date")
      .eq("user_id", user!.id)
      .gte("date", fiveDaysAgo.toISOString().split("T")[0])
      .lte("date", todayStr)
      .order("date", { ascending: false });

    if (!data || data.length === 0) {
      setFatigue({ avgScore: null, entryCount: 0, hasToday: false });
      return;
    }

    const scores = data.map(d => d.score_total).filter((s): s is number => s !== null);
    const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

    setFatigue({
      avgScore: avg,
      entryCount: scores.length,
      hasToday: data.some(d => d.date === todayStr),
    });
  };

  const loadWeeklyStats = async () => {
    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const year = getWeekYear(now);
    const mondayISO = getMondayISO(weekNumber, year);
    const sundayISO = getSundayISO(weekNumber, year);

    let totalDuration = 0;
    let completedCount = 0;
    const distanceBySport = { course: 0, velo: 0, natation: 0 };

    // 1. Training sessions (coach-programmed) — only completed ones
    const { data: week } = await supabase
      .from("training_weeks")
      .select("id")
      .eq("week_number", weekNumber)
      .eq("year", year)
      .eq("validated", true)
      .maybeSingle();

    if (week) {
      const { data: sessions } = await supabase
        .from("training_sessions")
        .select("id, duration_minutes, session_type, completed_at, cardio_total_distance_km, cardio_total_duration_minutes, session_exercises(actual_distance_km, actual_duration_minutes, cardio_sport)")
        .eq("week_id", week.id)
        .not("completed_at", "is", null);

      if (sessions) {
        for (const s of sessions) {
          const ex = s.session_exercises?.[0];
          completedCount++;

          // Duration: prioritize actual, then duration_minutes, then cardio_total_duration_minutes
          if (ex?.actual_duration_minutes) {
            totalDuration += ex.actual_duration_minutes;
          } else if (s.duration_minutes) {
            totalDuration += s.duration_minutes;
          } else if (s.cardio_total_duration_minutes) {
            totalDuration += s.cardio_total_duration_minutes;
          }

          // Distance by sport for cardio sessions
          if (s.session_type === "cardio") {
            const dist = ex?.actual_distance_km ?? s.cardio_total_distance_km ?? 0;
            const sport = ex?.cardio_sport ?? "course";
            if (dist > 0) {
              if (sport === "velo") distanceBySport.velo += dist;
              else if (sport === "natation") distanceBySport.natation += dist;
              else distanceBySport.course += dist;
            }
          }
        }
      }
    }

    // 2. Custom sessions completed this week
    const { data: customData } = await supabase
      .from("custom_sessions")
      .select("duration_minutes, distance_km, completed_at, cardio_type")
      .eq("user_id", user!.id)
      .not("completed_at", "is", null)
      .gte("completed_at", `${mondayISO}T00:00:00`)
      .lte("completed_at", `${sundayISO}T23:59:59`);

    if (customData) {
      for (const c of customData) {
        completedCount++;
        if (c.duration_minutes) totalDuration += c.duration_minutes;
        if (c.distance_km && c.distance_km > 0) {
          const sport = c.cardio_type ?? "course";
          if (sport === "velo") distanceBySport.velo += c.distance_km;
          else if (sport === "natation") distanceBySport.natation += c.distance_km;
          else distanceBySport.course += c.distance_km;
        }
      }
    }

    setWeeklyStats({ totalDurationMinutes: totalDuration, completedCount, distanceBySport });
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

  const getRecoveryIcon = (percent: number, small = false) => {
    const cls = small ? "h-5 w-5" : "h-8 w-8";
    if (percent >= 50) return <Smile className={`${cls} text-green-500`} />;
    if (percent >= 36) return <Meh className={`${cls} text-yellow-500`} />;
    return <Frown className={`${cls} text-red-500`} />;
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

  const recoveryPercentForBanner = fatigue.avgScore !== null ? getRecoveryPercent(fatigue.avgScore) : null;

  return (
    <div className="space-y-2 sm:space-y-3 pb-20 sm:pb-4">
      <AthleteSfmsRequestBanner />

      <WelcomeBanner firstName={firstName} recoveryPercent={recoveryPercentForBanner} />

      {/* Progression hebdomadaire — avec numéro de semaine intégré */}
      <Card className="overflow-hidden">
        <CardContent className="p-3 sm:p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Progression</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              S{currentWeek} · {formatWeekRangeFromNumber(currentWeek, currentYear)}
            </span>
          </div>
          {weeklyInfo.total > 0 ? (
            <>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{weeklyInfo.completed}/{weeklyInfo.total} séances</span>
                <span className="font-bold text-primary">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Pas de programme cette semaine</p>
          )}
          {progressPercent === 100 && weeklyInfo.total > 0 && (
            <p className="text-xs text-green-500 font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Bravo, semaine complétée ! 🎉
            </p>
          )}
        </CardContent>
      </Card>

      {/* Bilan hebdo — durée + distances par sport */}
      {weeklyStats.completedCount > 0 && (() => {
        const total = weeklyStats.totalDurationMinutes;
        const h = Math.floor(total / 60);
        const m = total % 60;
        const durLabel = h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${total} min`;
        const stats = [
          ...(total > 0 ? [{ emoji: "⏱", value: durLabel, label: "Entraînement" }] : []),
          ...(weeklyStats.distanceBySport.course > 0 ? [{ emoji: "🏃", value: `${Math.round(weeklyStats.distanceBySport.course * 100) / 100} km`, label: "Course" }] : []),
          ...(weeklyStats.distanceBySport.velo > 0 ? [{ emoji: "🚴", value: `${Math.round(weeklyStats.distanceBySport.velo * 100) / 100} km`, label: "Vélo" }] : []),
          ...(weeklyStats.distanceBySport.natation > 0 ? [{ emoji: "🏊", value: `${Math.round(weeklyStats.distanceBySport.natation)} m`, label: "Natation" }] : []),
        ];
        return (
          <Card className="cursor-pointer active:bg-muted/30 transition-colors" onClick={() => navigate("/sportif/bilan")}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Bilan</span>
              </div>
              <div className={`grid gap-2 ${stats.length <= 2 ? "grid-cols-2" : stats.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
                {stats.map((s) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm leading-none">{s.emoji}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground leading-tight truncate">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Récupération + Messagerie — side by side */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/sportif/fatigue")}
        >
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="font-semibold text-xs sm:text-sm">Récupération</span>
            </div>
            {fatigue.avgScore !== null ? (() => {
              const percent = getRecoveryPercent(fatigue.avgScore);
              return (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getRecoveryIcon(percent, true)}
                    <p className={`text-lg font-bold ${getRecoveryColor(percent)}`}>
                      {percent}%
                    </p>
                  </div>
                  <Progress value={percent} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground">{getRecoveryLabel(percent)} • {fatigue.entryCount}j</p>
                </div>
              );
            })() : (
              <p className="text-xs text-muted-foreground">Aucune donnée</p>
            )}
            {!fatigue.hasToday && (
              <Badge variant="outline" className="mt-1.5 border-orange-500 text-orange-500 text-[10px] px-1.5 py-0">
                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                Non rempli
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/sportif/messagerie")}
        >
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="font-semibold text-xs sm:text-sm">Messages</span>
            </div>
            {unreadCount > 0 ? (
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">{unreadCount}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  non lu{unreadCount > 1 ? "s" : ""}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Aucun nouveau</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Prochaine séance + Programmer */}
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
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <CalendarCheck className="h-4 w-4 text-primary" />
              <span className="font-semibold text-xs sm:text-sm">Prochaine séance</span>
            </div>
            {weeklyInfo.nextSession.overdue && (
              <div className="flex items-center gap-1.5 mb-1.5 px-2 py-1 rounded-md bg-destructive/10 border border-destructive/30">
                <span className="text-xs">❓</span>
                <span className="text-[10px] font-medium text-destructive">À valider — {weeklyInfo.nextSession.scheduledLabel}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm sm:text-base">{weeklyInfo.nextSession.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                    {weeklyInfo.nextSession.type === "recup"
                      ? "Récup"
                      : weeklyInfo.nextSession.type === "cardio"
                      ? "Cardio"
                      : "Renfo"}
                  </Badge>
                  {weeklyInfo.nextSession.estimatedDuration && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      ⏱ {weeklyInfo.nextSession.estimatedDuration}
                    </Badge>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Boutons d'action */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-10 text-sm"
          onClick={() => navigate("/sportif/seances")}
        >
          Mes séances
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
        <Button
          className="h-10 text-sm"
          onClick={() => navigate("/sportif/programmer")}
        >
          <CalendarDays className="h-4 w-4 mr-1" />
          Programmer
        </Button>
      </div>

      {/* Citation motivante de la semaine */}
      <WeeklyQuote />
    </div>
  );
}

const MOTIVATIONAL_QUOTES = [
  { text: "La discipline est le pont entre les objectifs et leur accomplissement.", author: "Jim Rohn" },
  { text: "Nous sommes ce que nous faisons de façon répétée.", author: "Aristote" },
  { text: "Le succès dépend de la discipline quotidienne.", author: "John C. Maxwell" },
  { text: "La motivation vous fait démarrer, la discipline vous fait continuer.", author: "Jim Ryun" },
  { text: "La douleur est temporaire, abandonner dure pour toujours.", author: "Lance Armstrong" },
  { text: "Travaille en silence, laisse ton succès faire du bruit.", author: "Frank Ocean" },
  { text: "Sans discipline, il n'y a pas de vie.", author: "Katharine Hepburn" },
  { text: "Le travail bat le talent quand le talent ne travaille pas.", author: "Tim Notke" },
  { text: "Ce que tu fais aujourd'hui améliore tous tes lendemains.", author: "Ralph Marston" },
  { text: "Rêve grand, travaille dur.", author: "Dwayne Johnson" },
  { text: "N'abandonne jamais.", author: "Winston Churchill" },
  { text: "La persévérance est la clé du succès.", author: "Charles Chaplin" },
  { text: "Ce n'est pas la force mais la persévérance qui fait les grandes œuvres.", author: "Samuel Johnson" },
  { text: "Le succès, c'est tomber sept fois et se relever huit.", author: "Proverbe japonais" },
  { text: "Continue. Tout le monde abandonne trop tôt.", author: "Sam Altman" },
  { text: "L'échec est le fondement de la réussite.", author: "Lao Tseu" },
  { text: "Les obstacles sont ces choses effrayantes que tu vois quand tu détournes les yeux de ton objectif.", author: "Henry Ford" },
  { text: "Tombe sept fois, relève-toi huit.", author: "Proverbe japonais" },
  { text: "La difficulté forge le caractère.", author: "Albert Einstein" },
  { text: "Ce qui ne te tue pas te rend plus fort.", author: "Friedrich Nietzsche" },
  { text: "Un objectif sans plan reste un vœu.", author: "Antoine de Saint-Exupéry" },
  { text: "Fixe-toi des objectifs élevés.", author: "Michael Jordan" },
  { text: "Le succès n'est pas final, l'échec n'est pas fatal.", author: "Winston Churchill" },
  { text: "Fais aujourd'hui ce que les autres ne veulent pas faire.", author: "Jerry Rice" },
  { text: "Si tu veux être le meilleur, tu dois faire des choses que les autres ne veulent pas faire.", author: "Michael Phelps" },
  { text: "Ne rêve pas ta vie, vis tes rêves.", author: "Anonyme" },
  { text: "Le secret d'aller de l'avant est de commencer.", author: "Mark Twain" },
  { text: "Agis comme si c'était impossible d'échouer.", author: "Winston Churchill" },
  { text: "Les grandes choses ne viennent jamais de la zone de confort.", author: "Neil Strauss" },
  { text: "Le succès, c'est la somme de petits efforts répétés.", author: "Robert Collier" },
  { text: "Que tu penses pouvoir ou non, tu as raison.", author: "Henry Ford" },
  { text: "Sois plus fort que tes excuses.", author: "Muhammad Ali" },
  { text: "Tout commence dans la tête.", author: "Tony Robbins" },
  { text: "La différence entre l'impossible et le possible réside dans la détermination.", author: "Tommy Lasorda" },
  { text: "Le courage commence là où finit la zone de confort.", author: "Osho" },
  { text: "Ton seul rival, c'est toi-même.", author: "Inconnu" },
  { text: "Le mental est tout.", author: "Buddha" },
  { text: "Tu es ce que tu fais, pas ce que tu dis.", author: "Carl Jung" },
  { text: "L'attitude détermine ton altitude.", author: "Zig Ziglar" },
  { text: "Gagne dans ta tête avant de gagner dans la réalité.", author: "Inconnu" },
  { text: "Je déteste chaque minute de l'entraînement, mais je dis : n'abandonne pas.", author: "Muhammad Ali" },
  { text: "Le succès en sport demande du sacrifice.", author: "Cristiano Ronaldo" },
  { text: "Tu dois t'attendre à de grandes choses de toi-même.", author: "Michael Jordan" },
  { text: "Plus tu transpires à l'entraînement, moins tu saignes en combat.", author: "Navy SEALs" },
  { text: "Rien n'est donné, tout se mérite.", author: "Zlatan Ibrahimović" },
  { text: "L'excellence n'est pas un acte, c'est une habitude.", author: "Aristote" },
  { text: "Les champions continuent quand les autres abandonnent.", author: "Billie Jean King" },
  { text: "Travaille jusqu'à ce que tes idoles deviennent tes rivales.", author: "Inconnu" },
  { text: "Sois obsédé ou sois moyen.", author: "Grant Cardone" },
  { text: "L'effort aujourd'hui, la victoire demain.", author: "Inconnu" },
  { text: "Passe à l'action.", author: "Tony Robbins" },
  { text: "Fais-le maintenant.", author: "Nike" },
  { text: "Un petit progrès chaque jour.", author: "Inconnu" },
  { text: "La constance bat l'intensité.", author: "Inconnu" },
  { text: "Agis comme si.", author: "William James" },
  { text: "Chaque jour compte.", author: "Inconnu" },
  { text: "Ne remets pas à demain.", author: "Benjamin Franklin" },
  { text: "Les actions parlent plus que les mots.", author: "Abraham Lincoln" },
  { text: "Sois régulier.", author: "Inconnu" },
  { text: "L'effort constant crée le succès.", author: "Inconnu" },
  { text: "Fais-le pour toi.", author: "Inconnu" },
  { text: "Tu peux le faire.", author: "Barack Obama" },
  { text: "Ne t'arrête pas.", author: "Usain Bolt" },
  { text: "Tout est possible.", author: "Kevin Garnett" },
  { text: "Crois en toi.", author: "Serena Williams" },
  { text: "Rien n'est impossible.", author: "Audrey Hepburn" },
  { text: "Va au bout.", author: "Inconnu" },
  { text: "Donne tout.", author: "Inconnu" },
  { text: "Plus fort chaque jour.", author: "Inconnu" },
  { text: "Ne lâche rien.", author: "Inconnu" },
  { text: "Ce qui compte, ce n'est pas tomber, c'est se relever.", author: "Vince Lombardi" },
  { text: "Le succès est fait de 1% de talent et 99% de travail.", author: "Thomas Edison" },
  { text: "Apprends de tes erreurs.", author: "Bill Gates" },
  { text: "La vie commence à la fin de ta zone de confort.", author: "Neale Donald Walsch" },
  { text: "Sois dur avec toi-même.", author: "David Goggins" },
  { text: "Rien ne remplace le travail.", author: "Thomas Edison" },
  { text: "Le succès appartient aux persévérants.", author: "Napoléon Bonaparte" },
  { text: "La douleur forge les champions.", author: "Inconnu" },
  { text: "Continue malgré tout.", author: "Inconnu" },
  { text: "Ne t'arrête jamais d'essayer.", author: "Albert Einstein" },
  { text: "Le succès est un marathon, pas un sprint.", author: "Inconnu" },
  { text: "Construis chaque jour.", author: "Inconnu" },
  { text: "Les grandes choses prennent du temps.", author: "Steve Jobs" },
  { text: "Reste patient et travaille dur.", author: "Elon Musk" },
  { text: "La vision sans action est un rêve.", author: "Joel A. Barker" },
  { text: "Avance même lentement.", author: "Confucius" },
  { text: "Chaque étape compte.", author: "Inconnu" },
  { text: "Sois constant.", author: "Inconnu" },
  { text: "Ne brûle pas les étapes.", author: "Inconnu" },
  { text: "La patience paie.", author: "Warren Buffett" },
  { text: "Fais ce que tu dois, même quand tu n'en as pas envie.", author: "Inconnu" },
  { text: "Discipline > motivation.", author: "Inconnu" },
  { text: "Sois la personne que tu respectes.", author: "Inconnu" },
  { text: "L'inconfort crée la progression.", author: "Inconnu" },
  { text: "Pas d'excuses.", author: "Inconnu" },
  { text: "Travaille pendant que les autres dorment.", author: "Dwayne Johnson" },
  { text: "Tu récoltes ce que tu sèmes.", author: "Proverbe" },
  { text: "Chaque jour est une opportunité.", author: "Inconnu" },
  { text: "Deviens imparable.", author: "Inconnu" },
  { text: "Fais-le encore une fois.", author: "Inconnu" },
];

function getWeeklyQuoteIndex(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const weekNum = Math.floor(diff / oneWeek);
  return weekNum % MOTIVATIONAL_QUOTES.length;
}

function WeeklyQuote() {
  const quote = MOTIVATIONAL_QUOTES[getWeeklyQuoteIndex()];
  return (
    <div className="px-3 py-2 rounded-lg bg-muted/50 border border-border/50">
      <p className="text-xs italic text-muted-foreground leading-relaxed">
        « {quote.text} »
      </p>
      <p className="text-[10px] text-muted-foreground/70 mt-0.5 text-right">— {quote.author}</p>
    </div>
  );
}
