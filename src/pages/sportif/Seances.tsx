import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, CheckCircle2, Clock, Pencil, Trash2, CalendarPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getWeekNumber, getWeekYear, formatWeekRangeFromNumber, getDateFromWeekNumber, getMondayOfWeek, getSundayOfWeek } from "@/lib/weekUtils";
import { CustomSessionDialog } from "@/components/CustomSessionDialog";
import { ScheduleSessionDialog } from "@/components/ScheduleSessionDialog";
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

export default function Seances() {
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const firstName = profile?.first_name || "champion";
  const [weeks, setWeeks] = useState<any[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [customSessions, setCustomSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCustomSession, setEditingCustomSession] = useState<any>(null);
  const [validatingCustomSession, setValidatingCustomSession] = useState<any>(null);
  const [schedulingSession, setSchedulingSession] = useState<any>(null);

  const handleDeleteCustomSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from("custom_sessions")
        .delete()
        .eq("id", sessionId);

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
      // Attendre d'avoir un utilisateur authentifié avant de charger les données
      // Sinon RLS renvoie 0 résultats si le token est en cours de refresh
      let user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        // Tenter un refresh si getUser échoue (token expiré transitoirement)
        const { data } = await supabase.auth.refreshSession().catch(() => ({ data: { session: null } }));
        user = data.session?.user ?? null;
      }
      if (!user) {
        // Toujours pas d'utilisateur, on charge quand même (le guard parent redirigera)
        setLoading(false);
        return;
      }
      loadWeeks();
      loadCustomSessions();
    };
    init();
  }, []);

  const loadWeeks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("training_weeks")
      .select("*")
      .eq("validated", true)
      .order("year", { ascending: false })
      .order("week_number", { ascending: false });

    if (error) {
      console.error("Erreur lors du chargement des semaines:", error);
    } else {
      const now = new Date();
      const currentYear = getWeekYear(now);
      const currentWeekNumber = getWeekNumber(now);

      const filteredWeeks = (data || []).filter((week: any) => {
        if (week.year < currentYear) return true;
        if (week.year > currentYear) return false;
        return week.week_number <= currentWeekNumber;
      });

      setWeeks(filteredWeeks);
      
      // Chercher la semaine actuelle
      const currentWeek = filteredWeeks.find(
        (week: any) => week.week_number === currentWeekNumber && week.year === currentYear
      );

      if (currentWeek) {
        // La semaine actuelle existe, l'afficher
        loadWeekSessions(currentWeek.id);
        setSelectedWeek(currentWeek);
      } else if (filteredWeeks && filteredWeeks.length > 0) {
        // La semaine actuelle n'existe pas, afficher la plus récente
        loadWeekSessions(filteredWeeks[0].id);
        setSelectedWeek(filteredWeeks[0]);
      } else {
        // Aucune semaine disponible
        setSelectedWeek(null);
      }
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

      if (error) {
        console.error("Erreur lors du chargement des séances perso:", error);
      } else {
        setCustomSessions(data || []);
      }
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const loadWeekSessions = async (weekId: string) => {
    const { data: sessionsData, error: sessionsError } = await supabase
      .from("training_sessions")
      .select(
        `
        *,
        session_exercises (*)
      `,
      )
      .eq("week_id", weekId)
      .order("session_number");

    if (sessionsError) {
      console.error("Erreur lors du chargement des séances:", sessionsError);
    } else {
      const sorted = (sessionsData || []).sort((a: any, b: any) => {
        const aCompleted = isSessionCompleted(a);
        const bCompleted = isSessionCompleted(b);

        if (aCompleted === bCompleted) {
          return a.session_number - b.session_number;
        }
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
    
    // Pour les sessions Récup/Mobilité, vérifier si duration_minutes est défini
    if (session.session_type === "recup") {
      return session.duration_minutes !== null && session.duration_minutes !== undefined;
    }
    
    // Pour les autres séances, vérifier si tous les exercices ont soit un RPE soit sont marqués comme skipped
    return session.session_exercises.every((ex: any) => 
      (ex.sportif_rpe !== null && ex.sportif_rpe !== undefined) || ex.skipped === true
    );
  }, []);

  // Hook pour la célébration hebdomadaire
  const { showCelebration, celebration, closeCelebration } = useWeeklyCompletionCelebration(
    selectedWeek?.id || null,
    sessions,
    isSessionCompleted
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
    (week) => week.week_number === currentWeekNumber && week.year === currentYear
  );

  return (
    <div className="space-y-3 sm:space-y-4 pb-4">
      <WeeklyCompletionCelebration
        show={showCelebration}
        title={celebration?.title || ""}
        message={celebration?.message || ""}
        onClose={closeCelebration}
      />
      <AthleteFatigueAlert />
      
      <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold">Tes séances</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">{firstName}, voici ton programme personnalisé</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {weeks.length > 0 && (
            <div className="flex flex-col gap-1 w-full sm:w-auto sm:min-w-[140px]">
              <label className="text-xs text-muted-foreground">Semaine</label>
              <select
                className="text-sm p-2.5 sm:p-2 border rounded-md bg-background text-foreground border-input focus:outline-none focus:ring-2 focus:ring-ring w-full"
                value={selectedWeek?.id || ""}
                onChange={(e) => handleWeekChange(e.target.value)}
              >
                {weeks.map((week) => (
                  <option key={week.id} value={week.id}>
                    S{week.week_number} - {week.year} ({formatWeekRangeFromNumber(week.week_number, week.year)})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {!isCurrentWeekAvailable && weeks.length > 0 && (
        <Card className="border-orange-500 bg-orange-500/10">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start gap-2 sm:gap-3">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-sm sm:text-base text-orange-700 dark:text-orange-400">
                  Semaine {currentWeekNumber} en cours de création
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {firstName}, ton coach prépare ta semaine de sport. En attendant, tu peux consulter tes semaines précédentes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
          <div className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold">
              Semaine {selectedWeek.week_number} ({formatWeekRangeFromNumber(selectedWeek.week_number, selectedWeek.year)})
            </h2>
            {sessions.length === 0 ? (
              <p className="text-sm sm:text-base text-muted-foreground text-center py-6 sm:py-8">Aucune séance pour cette semaine.</p>
            ) : (
              <div className="space-y-4">
                {sessions.map((session, index) => {
                  const completed = isSessionCompleted(session);
                  const isFirstToDo = index === 0 && !completed;
                  const displayName = session.athlete_custom_name || session.name;
                  const hasSchedule = session.scheduled_date && !completed;

                  return (
                    <div
                      key={session.id}
                      className="group"
                      style={{
                        animationDelay: `${index * 50}ms`,
                      }}
                    >
                      <Card
                        className={`
                          relative overflow-hidden transition-all duration-300 ease-out
                          transform-gpu hover:scale-[1.02] hover:-translate-y-1
                          shadow-lg hover:shadow-2xl
                          ${completed
                            ? "border-green-500/50 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent"
                            : hasSchedule
                              ? "border-orange-500/50 bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent"
                              : isFirstToDo
                                ? "border-primary border-2 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent shadow-primary/20"
                                : "border-border/50 bg-gradient-to-br from-card via-card/80 to-transparent hover:border-primary/50"
                          }
                        `}
                        style={{
                          boxShadow: completed 
                            ? '0 8px 30px -10px rgba(34, 197, 94, 0.3), 0 4px 10px -5px rgba(0, 0, 0, 0.2)'
                            : hasSchedule
                              ? '0 8px 30px -10px rgba(249, 115, 22, 0.3), 0 4px 10px -5px rgba(0, 0, 0, 0.2)'
                              : isFirstToDo
                                ? '0 8px 30px -10px rgba(var(--primary), 0.4), 0 4px 10px -5px rgba(0, 0, 0, 0.2)'
                                : '0 4px 20px -5px rgba(0, 0, 0, 0.3)',
                        }}
                      >
                        {/* Effet de brillance au survol */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[200%]" 
                          style={{ transition: 'transform 0.75s ease-in-out, opacity 0.3s' }}
                        />
                        
                        <CardContent className="p-4 sm:p-5 relative z-10">
                          <div className="flex items-center justify-between gap-3">
                            <div 
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => {
                                if (session.session_type === "recup") {
                                  navigate(`/sportif/recup/${selectedWeek.id}/${session.id}`);
                                } else {
                                  navigate(`/sportif/seance/${selectedWeek.id}/${session.id}`);
                                }
                              }}
                            >
                              <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                                <h3 className="font-bold text-lg sm:text-2xl flex items-center gap-2">
                                  {displayName}
                                  {session.athlete_custom_name && (
                                    <span className="text-xs text-muted-foreground font-normal">
                                      ({session.name})
                                    </span>
                                  )}
                                  {completed && (
                                    <div className="flex items-center gap-1 text-green-500 text-xs sm:text-sm font-normal">
                                      <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                                      {session.duration_minutes && (
                                        <span className="flex items-center gap-1 text-green-400">
                                          <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                                          {session.duration_minutes} min
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </h3>

                                {hasSchedule && (
                                  <Badge variant="outline" className="border-orange-500 text-orange-600 dark:text-orange-400 text-xs backdrop-blur-sm bg-orange-500/10">
                                    📅 {format(new Date(session.scheduled_date), "EEE d", { locale: fr })}
                                  </Badge>
                                )}

                                {isFirstToDo && !hasSchedule && (
                                  <Badge variant="default" className="bg-primary text-primary-foreground text-xs shadow-lg shadow-primary/30">
                                    À faire
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant={completed ? "secondary" : "outline"} className="text-xs sm:text-sm px-2 sm:px-3 py-1 backdrop-blur-sm">
                                  {session.session_exercises?.length || 0} exercices
                                </Badge>
                                {session.session_type === "recup" && (
                                  <Badge variant="outline" className="text-xs sm:text-sm px-2 sm:px-3 py-1 border-purple-500 text-purple-600 dark:text-purple-400 backdrop-blur-sm bg-purple-500/10">
                                    Récup/Mobilité
                                  </Badge>
                                )}
                                {session.session_type === "cardio" && (
                                  <Badge variant="outline" className="text-xs sm:text-sm px-2 sm:px-3 py-1 border-blue-500 text-blue-600 dark:text-blue-400 backdrop-blur-sm bg-blue-500/10">
                                    Cardio
                                  </Badge>
                                )}
                                {isCardioSession(session) && (() => {
                                  const dur = getCardioEstimatedDuration(session.session_exercises || [], (profile as any)?.vma || null);
                                  return dur ? (
                                    <Badge variant="secondary" className="text-xs sm:text-sm px-2 sm:px-3 py-1">
                                      ⏱ {dur}
                                    </Badge>
                                  ) : null;
                                })()}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              {!completed && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 sm:h-10 sm:w-10 hover:bg-white/10 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSchedulingSession(session);
                                  }}
                                >
                                  <CalendarPlus className={`h-4 w-4 sm:h-5 sm:w-5 ${hasSchedule ? "text-orange-500" : "text-muted-foreground"}`} />
                                </Button>
                              )}
                              <div 
                                className={`
                                  h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center cursor-pointer
                                  transition-all duration-200 hover:scale-110
                                  ${completed ? "bg-green-500/20" : hasSchedule ? "bg-orange-500/20" : isFirstToDo ? "bg-primary/20" : "bg-white/5 hover:bg-white/10"}
                                `}
                                onClick={() => {
                                  if (session.session_type === "recup") {
                                    navigate(`/sportif/recup/${selectedWeek.id}/${session.id}`);
                                  } else {
                                    navigate(`/sportif/seance/${selectedWeek.id}/${session.id}`);
                                  }
                                }}
                              >
                                <ChevronRight
                                  className={`h-5 w-5 sm:h-6 sm:w-6 ${
                                    completed ? "text-green-500" : hasSchedule ? "text-orange-500" : isFirstToDo ? "text-primary" : "text-muted-foreground"
                                  }`}
                                />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bouton pour ajouter une séance perso + Dialog d'édition */}
            <div className="mt-4 sm:mt-6">
              <CustomSessionDialog 
                onSessionCreated={() => { loadWeeks(); loadCustomSessions(); }} 
                editSession={editingCustomSession}
                onClose={() => { setEditingCustomSession(null); setValidatingCustomSession(null); }}
                validateSession={validatingCustomSession}
              />
            </div>

            {/* Séances perso de la semaine */}
            {selectedWeek && (() => {
              const weekRefDate = getDateFromWeekNumber(selectedWeek.week_number, selectedWeek.year);
              const weekStart = getMondayOfWeek(weekRefDate);
              const weekEnd = getSundayOfWeek(weekRefDate);
              weekEnd.setHours(23, 59, 59, 999);

              const weekCustomSessions = customSessions.filter(cs => {
                const dateStr = cs.scheduled_date || cs.completed_at;
                if (!dateStr) return false;
                const sessionDate = new Date(dateStr);
                return sessionDate >= weekStart && sessionDate <= weekEnd;
              });

              if (weekCustomSessions.length === 0) return null;

              return (
                <div className="mt-4 sm:mt-6">
                  <h3 className="text-base sm:text-lg font-semibold mb-3">Séances perso</h3>
                  <div className="space-y-2 sm:space-y-3">
                    {weekCustomSessions.map((customSession) => {
                      const isPlanned = !customSession.completed_at;
                      return (
                        <Card key={customSession.id} className={isPlanned ? "border-orange-500/30 bg-orange-500/5" : "border-primary/30 bg-primary/5"}>
                          <CardContent className="p-4 sm:p-5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <h3 className="font-bold text-base sm:text-xl">{customSession.session_name}</h3>
                                  <Badge variant="secondary" className="text-xs">Perso</Badge>
                                  {isPlanned ? (
                                    <Badge variant="outline" className="text-xs border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-500/10">
                                      📅 Planifiée
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs border-green-500 text-green-600 dark:text-green-400 bg-green-500/10">
                                      ✅ Validée
                                    </Badge>
                                  )}
                                </div>
                                {customSession.duration_minutes && (
                                  <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground mb-2">
                                    <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                                    <span>{customSession.duration_minutes} min</span>
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  {new Date(customSession.scheduled_date || customSession.completed_at).toLocaleDateString('fr-FR', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long',
                                  })}
                                </p>
                                {customSession.description && (
                                  <p className="text-xs sm:text-sm mt-2 text-foreground/80 italic border-l-2 border-primary/30 pl-3">
                                    {customSession.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                {isPlanned && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setValidatingCustomSession(customSession);
                                    }}
                                  >
                                    Valider ✅
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCustomSession(customSession);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Supprimer cette séance ?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Cette action est irréversible. La séance "{customSession.session_name}" sera définitivement supprimée.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => handleDeleteCustomSession(customSession.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Supprimer
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )
      )}

      {/* Dialog pour programmer/renommer une séance */}
      <ScheduleSessionDialog
        open={!!schedulingSession}
        onOpenChange={(open) => !open && setSchedulingSession(null)}
        session={schedulingSession}
        onUpdate={() => {
          if (selectedWeek) {
            loadWeekSessions(selectedWeek.id);
          }
        }}
      />
    </div>
  );
}
