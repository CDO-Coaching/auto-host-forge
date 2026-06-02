import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import {
  ChevronRight,
  CheckCircle2,
  Clock,
  Pencil,
  Trash2,
  CalendarPlus,
  ChevronLeft,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getWeekNumber,
  getWeekYear,
  formatWeekRangeFromNumber,
  getDateFromWeekNumber,
  getMondayOfWeek,
  getSundayOfWeek,
} from "@/lib/weekUtils";
import { CustomSessionDialog } from "@/components/CustomSessionDialog";
import { ScheduleSessionDialog } from "@/components/ScheduleSessionDialog";
import { StravaActivityMatcher } from "@/components/StravaActivityMatcher";
import { AthleteFatigueAlert } from "@/components/AthleteFatigueAlert";
import { WeeklyCompletionCelebration } from "@/components/WeeklyCompletionCelebration";
import { useWeeklyCompletionCelebration } from "@/hooks/useWeeklyCompletionCelebration";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getCardioEstimatedDuration, isCardioSession } from "@/lib/cardioEstimatedDuration";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ─── Helper ─────────────────────────────────────────────────────────────────

function SportBadge({ sport }: { sport: string | undefined }) {
  if (sport === "course")
    return (
      <Badge variant="outline" className="text-xs border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-500/10">
        🏃 Course
      </Badge>
    );
  if (sport === "velo")
    return (
      <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10">
        🚴 Vélo
      </Badge>
    );
  if (sport === "natation")
    return (
      <Badge variant="outline" className="text-xs border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-500/10">
        🏊 Natation
      </Badge>
    );
  if (sport === "hiit")
    return (
      <Badge variant="outline" className="text-xs border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-500/10">
        ⚡ HIIT
      </Badge>
    );
  return null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Seances() {
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const firstName = profile?.first_name || "champion";
  const [userId, setUserId] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<any[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [customSessions, setCustomSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCustomSession, setEditingCustomSession] = useState<any>(null);
  const [validatingCustomSession, setValidatingCustomSession] = useState<any>(null);
  const [schedulingSession, setSchedulingSession] = useState<any>(null);
  const [openCustomDialog, setOpenCustomDialog] = useState(false);

  const handleDeleteCustomSession = async (sessionId: string) => {
    try {
      const { error } = await supabase.from("custom_sessions").delete().eq("id", sessionId);
      if (error) throw error;
      toast.success("Séance perso supprimée");
      loadCustomSessions();
    } catch (error) {
      console.error("Erreur suppression:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  useEffect(() => {
    const init = async () => {
      let user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        const { data } = await supabase.auth.refreshSession().catch(() => ({ data: { session: null } }));
        user = data.session?.user ?? null;
      }
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      loadWeeks(user.id);
      loadCustomSessions();
    };
    init();
  }, []);

  const loadWeeks = async (userId?: string) => {
    setLoading(true);
    const resolvedUserId = userId ?? (await supabase.auth.getUser()).data.user?.id;
    if (!resolvedUserId) {
      setWeeks([]);
      setSelectedWeek(null);
      setSessions([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("training_weeks")
      .select("*")
      .eq("athlete_id", resolvedUserId)
      .eq("validated", true)
      .order("year", { ascending: false })
      .order("week_number", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur lors du chargement des semaines:", error);
      setLoading(false);
      return;
    }

    const now = new Date();
    const currentYear = getWeekYear(now);
    const currentWeekNumber = getWeekNumber(now);

    const filteredWeeks = (data || []).filter((week: any) => {
      if (week.year < currentYear) return true;
      if (week.year > currentYear) return false;
      return week.week_number <= currentWeekNumber;
    });

    const weekIds = filteredWeeks.map((week: any) => week.id);
    const { data: sessionLinks } = weekIds.length
      ? await supabase.from("training_sessions").select("week_id").in("week_id", weekIds)
      : { data: [] };

    const sessionCountByWeekId = new Map<string, number>();
    (sessionLinks || []).forEach((session: any) => {
      sessionCountByWeekId.set(session.week_id, (sessionCountByWeekId.get(session.week_id) || 0) + 1);
    });

    const uniqueWeeksMap = new Map<string, any>();
    filteredWeeks.forEach((week: any) => {
      const key = `${week.year}-${week.week_number}`;
      const currentBest = uniqueWeeksMap.get(key);
      const weekWithCount = { ...week, session_count: sessionCountByWeekId.get(week.id) || 0 };
      if (!currentBest || weekWithCount.session_count > currentBest.session_count) {
        uniqueWeeksMap.set(key, weekWithCount);
      }
    });

    const uniqueWeeks = Array.from(uniqueWeeksMap.values()).sort((a: any, b: any) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.week_number !== b.week_number) return b.week_number - a.week_number;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setWeeks(uniqueWeeks);

    const currentWeek = uniqueWeeks.find(
      (week: any) => week.week_number === currentWeekNumber && week.year === currentYear,
    );

    if (currentWeek) {
      loadWeekSessions(currentWeek.id);
      setSelectedWeek(currentWeek);
    } else if (uniqueWeeks.length > 0) {
      loadWeekSessions(uniqueWeeks[0].id);
      setSelectedWeek(uniqueWeeks[0]);
    } else {
      setSelectedWeek(null);
      setSessions([]);
    }

    setLoading(false);
  };

  const loadCustomSessions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await (supabase.from("custom_sessions") as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) console.error("Erreur lors du chargement des séances perso:", error);
      else setCustomSessions(data || []);
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const loadWeekSessions = async (weekId: string) => {
    const { data: sessionsData, error: sessionsError } = await supabase
      .from("training_sessions")
      .select("*, session_exercises (*)")
      .eq("week_id", weekId)
      .order("session_number");

    if (sessionsError) {
      console.error("Erreur lors du chargement des séances:", sessionsError);
    } else {
      const sorted = (sessionsData || []).sort((a: any, b: any) => {
        const aCompleted = isSessionCompleted(a);
        const bCompleted = isSessionCompleted(b);
        if (aCompleted === bCompleted) return a.session_number - b.session_number;
        return aCompleted ? 1 : -1;
      });
      setSessions(sorted);
    }
  };

  const handleWeekChange = (weekId: string) => {
    const week = weeks.find((w) => w.id === weekId);
    setSelectedWeek(week);
    loadWeekSessions(weekId);
  };

  const isSessionCompleted = useCallback((session: any) => {
    if (!session.session_exercises || session.session_exercises.length === 0) return false;
    if (session.session_type === "recup") {
      return session.duration_minutes !== null && session.duration_minutes !== undefined;
    }
    return session.session_exercises.every(
      (ex: any) => (ex.sportif_rpe !== null && ex.sportif_rpe !== undefined) || ex.skipped === true,
    );
  }, []);

  const { showCelebration, celebration, closeCelebration } = useWeeklyCompletionCelebration(
    selectedWeek?.id || null,
    sessions,
    isSessionCompleted,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentWeekNumber = getWeekNumber(now);
  const isCurrentWeekAvailable = weeks.some(
    (week) => week.week_number === currentWeekNumber && week.year === currentYear,
  );

  // Week navigation
  const selectedIdx = weeks.findIndex((w) => w.id === selectedWeek?.id);
  const prevWeek = selectedIdx >= 0 && selectedIdx + 1 < weeks.length ? weeks[selectedIdx + 1] : null;
  const nextWeek = selectedIdx > 0 ? weeks[selectedIdx - 1] : null;

  return (
    <div className="space-y-3 pb-4">
      <WeeklyCompletionCelebration
        show={showCelebration}
        title={celebration?.title || ""}
        message={celebration?.message || ""}
        onClose={closeCelebration}
      />
      <AthleteFatigueAlert />

      {/* ── Week navigator + action buttons ──────────────────────────────── */}
      {weeks.length > 0 && selectedWeek && (
        <div className="space-y-2">
          {/* Week nav row */}
          <div className="flex items-center gap-2">
            <button
              disabled={!prevWeek}
              onClick={() => prevWeek && handleWeekChange(prevWeek.id)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium disabled:opacity-30 hover:bg-accent transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              S{prevWeek?.week_number ?? "—"}
            </button>

            <div className="flex-1 text-center">
              <span className="text-sm font-semibold">
                S{selectedWeek.week_number}
                <span className="text-muted-foreground font-normal">
                  {" "}· {formatWeekRangeFromNumber(selectedWeek.week_number, selectedWeek.year)}
                </span>
              </span>
            </div>

            <button
              disabled={!nextWeek}
              onClick={() => nextWeek && handleWeekChange(nextWeek.id)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium disabled:opacity-30 hover:bg-accent transition-colors"
            >
              S{nextWeek?.week_number ?? "—"}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Action buttons row */}
          <div className="flex gap-2">
            <button
              onClick={() => setOpenCustomDialog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/50 text-primary text-xs font-medium hover:bg-primary/10 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Perso
            </button>
            {userId && selectedWeek && (
              <StravaActivityMatcher
                athleteId={userId}
                currentWeekSessions={sessions}
                onLinked={() => {
                  loadWeekSessions(selectedWeek.id);
                  loadCustomSessions();
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* CustomSessionDialog (triggered by "+ Perso" button or editing) */}
      <CustomSessionDialog
        hideTrigger
        forceOpen={openCustomDialog}
        onForceClose={() => setOpenCustomDialog(false)}
        onSessionCreated={() => {
          setOpenCustomDialog(false);
          loadWeeks();
          loadCustomSessions();
        }}
        editSession={editingCustomSession}
        onClose={() => {
          setOpenCustomDialog(false);
          setEditingCustomSession(null);
          setValidatingCustomSession(null);
        }}
        validateSession={validatingCustomSession}
      />

      {/* ── "Semaine en cours de création" alert ─────────────────────────── */}
      {!isCurrentWeekAvailable && weeks.length > 0 && (
        <Card className="border-orange-500 bg-orange-500/10">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-sm text-orange-700 dark:text-orange-400">
                  Semaine {currentWeekNumber} en cours de création
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {firstName}, ton coach prépare ta semaine. En attendant, tu peux consulter les semaines précédentes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── No weeks ─────────────────────────────────────────────────────── */}
      {weeks.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Aucune séance programmée</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {firstName}, ton coach n'a pas encore programmé de séances. Reste motivé, elles arrivent bientôt ! 💪
            </p>
          </CardContent>
        </Card>
      ) : (
        selectedWeek && (
          <div className="space-y-2">
            {/* ── Coach sessions ─────────────────────────────────────────── */}
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucune séance pour cette semaine.</p>
            ) : (
              sessions.map((session, index) => {
                const completed = isSessionCompleted(session);
                const isFirstToDo = index === 0 && !completed;
                const displayName = session.athlete_custom_name || session.name;
                const hasSchedule = session.scheduled_date && !completed;
                const exCount = session.session_exercises?.length || 0;
                const sport = session.session_exercises?.find((ex: any) => ex.cardio_sport)?.cardio_sport;
                const cardioDur =
                  isCardioSession(session)
                    ? getCardioEstimatedDuration(session.session_exercises || [], (profile as any)?.vma || null)
                    : null;

                // RPE moyen de la séance
                const rpeValues = (session.session_exercises || [])
                  .map((ex: any) => ex.sportif_rpe)
                  .filter((v: any) => v !== null && v !== undefined && !isNaN(Number(v)));
                const avgRpe = rpeValues.length > 0
                  ? Math.round(rpeValues.reduce((s: number, v: any) => s + Number(v), 0) / rpeValues.length)
                  : null;

                const borderCls = completed
                  ? "border-green-500/40 bg-green-500/5"
                  : hasSchedule
                  ? "border-orange-500/40 bg-orange-500/5"
                  : isFirstToDo
                  ? "border-primary/60 bg-primary/5"
                  : "border-border/50 hover:border-primary/30";

                return (
                  <div
                    key={session.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors hover:bg-accent/40 ${borderCls}`}
                    onClick={() => {
                      if (session.session_type === "recup") {
                        navigate(`/sportif/recup/${selectedWeek.id}/${session.id}`);
                      } else {
                        navigate(`/sportif/seance/${selectedWeek.id}/${session.id}`);
                      }
                    }}
                  >
                    {/* Status icon */}
                    <div className="shrink-0">
                      {completed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <div
                          className={`h-5 w-5 rounded-full border-2 ${
                            isFirstToDo ? "border-primary" : "border-muted-foreground/30"
                          }`}
                        />
                      )}
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-sm">{displayName}</span>

                        {session.athlete_custom_name && (
                          <span className="text-xs text-muted-foreground">({session.name})</span>
                        )}

                        {isFirstToDo && !hasSchedule && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">
                            À faire
                          </Badge>
                        )}

                        {hasSchedule && (
                          <Badge variant="outline" className="text-[10px] border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-500/10 px-1.5 py-0 h-4">
                            📅 {format(new Date(session.scheduled_date), "EEE d", { locale: fr })}
                          </Badge>
                        )}

                        {session.session_type === "recup" && (
                          <Badge variant="outline" className="text-[10px] border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0 h-4">
                            Récup
                          </Badge>
                        )}

                        {session.session_type === "cardio" && <SportBadge sport={sport} />}

                        {session.linked_strava_activity_id && (
                          <Badge className="text-[10px] bg-[#FC4C02]/15 text-[#FC4C02] border border-[#FC4C02]/30 px-1.5 py-0 h-4">
                            <svg viewBox="0 0 24 24" className="w-2 h-2 fill-[#FC4C02] mr-0.5">
                              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.599h4.172L10.463 0l-7 13.828h4.169" />
                            </svg>
                            Strava
                          </Badge>
                        )}
                      </div>

                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {exCount} exercice{exCount > 1 ? "s" : ""}
                        {completed && session.duration_minutes ? ` · ${session.duration_minutes} min` : ""}
                        {cardioDur ? ` · ⏱ ${cardioDur}` : ""}
                        {avgRpe !== null && (
                          <span className={`ml-1 font-semibold ${
                            avgRpe <= 4 ? "text-green-500" :
                            avgRpe <= 6 ? "text-yellow-500" :
                            avgRpe <= 8 ? "text-orange-500" :
                            "text-red-500"
                          }`}>· RPE {avgRpe}/10</span>
                        )}
                      </p>
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {!completed && (
                        <button
                          className="p-1 rounded hover:bg-accent transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSchedulingSession(session);
                          }}
                        >
                          <CalendarPlus
                            className={`h-4 w-4 ${hasSchedule ? "text-orange-500" : "text-muted-foreground/50"}`}
                          />
                        </button>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                    </div>
                  </div>
                );
              })
            )}

            {/* ── Custom (perso) sessions for this week ──────────────────── */}
            {(() => {
              const weekRefDate = getDateFromWeekNumber(selectedWeek.week_number, selectedWeek.year);
              const weekStart = getMondayOfWeek(weekRefDate);
              const weekEnd = getSundayOfWeek(weekRefDate);
              weekEnd.setHours(23, 59, 59, 999);

              const weekCustomSessions = customSessions.filter((cs) => {
                const dateStr = cs.scheduled_date || cs.completed_at;
                if (!dateStr) return false;
                const d = new Date(dateStr);
                return d >= weekStart && d <= weekEnd;
              });

              if (weekCustomSessions.length === 0) return null;

              return (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
                    Séances perso
                  </p>
                  {weekCustomSessions.map((cs) => {
                    const isPlanned = !cs.completed_at;
                    const dateLabel = new Date(cs.scheduled_date || cs.completed_at).toLocaleDateString("fr-FR", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    });

                    return (
                      <div
                        key={cs.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer hover:bg-muted/40 transition-colors ${
                          isPlanned
                            ? "border-orange-500/30 bg-orange-500/5"
                            : "border-primary/30 bg-primary/5"
                        }`}
                        onClick={() => setEditingCustomSession(cs)}
                      >
                        {/* Status */}
                        <div className="shrink-0">
                          {isPlanned ? (
                            <div className="h-5 w-5 rounded-full border-2 border-orange-400/60" />
                          ) : (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-sm">{cs.session_name}</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                              Perso
                            </Badge>
                            {cs.cardio_type && <SportBadge sport={cs.cardio_type} />}
                            {isPlanned ? (
                              <Badge variant="outline" className="text-[10px] border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-500/10 px-1.5 py-0 h-4">
                                Planifiée
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] border-green-500 text-green-600 dark:text-green-400 bg-green-500/10 px-1.5 py-0 h-4">
                                Validée
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {dateLabel}
                            {cs.duration_minutes ? ` · ${cs.duration_minutes} min` : ""}
                          </p>
                          {cs.description && (
                            <p className="text-xs mt-1 text-foreground/70 italic border-l-2 border-primary/30 pl-2">
                              {cs.description}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          {isPlanned && (
                            <Button
                              variant="default"
                              size="sm"
                              className="text-xs h-7 px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                setValidatingCustomSession(cs);
                              }}
                            >
                              Valider
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCustomSession(cs);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer cette séance ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Cette action est irréversible. La séance "{cs.session_name}" sera définitivement supprimée.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteCustomSession(cs.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )
      )}

      {/* ── Schedule dialog ───────────────────────────────────────────────── */}
      <ScheduleSessionDialog
        open={!!schedulingSession}
        onOpenChange={(open) => !open && setSchedulingSession(null)}
        session={schedulingSession}
        onUpdate={() => {
          if (selectedWeek) loadWeekSessions(selectedWeek.id);
        }}
      />
    </div>
  );
}
