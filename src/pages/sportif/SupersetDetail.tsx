import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Timer, Video, Zap, Weight, Repeat, Clock } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ExerciseFeedbackDialog } from "@/components/ExerciseFeedbackDialog";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";
import { TimerOverlay } from "@/components/TimerOverlay";
import { TempoExplanationDialog } from "@/components/TempoExplanationDialog";
import { RPEExplanationDialog } from "@/components/RPEExplanationDialog";
import { UniversalTimer } from "@/components/UniversalTimer";
import { calculate1RM, parseWeight, parseReps, shouldRecordMax } from "@/lib/maxCalculations";
import { useRecoveryTimer } from "@/hooks/useRecoveryTimer";

export default function SupersetDetail() {
  const { sessionId, supersetId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedRounds, setCompletedRounds] = useState(0);
  const [weekId, setWeekId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [exerciseTimers, setExerciseTimers] = useState<Record<string, any>>({});
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
  const [showSupersetRecoveryOverlay, setShowSupersetRecoveryOverlay] = useState(false);
  
  const {
    timers,
    isRunning: timersRunning,
    startTimer,
    pauseTimer,
    resetTimer,
    formatTime: formatTimerTime,
  } = useRecoveryTimer();
  
  const supersetTimerId = `superset-recovery-${supersetId}`;
  const supersetRecoveryTime = timers[supersetTimerId] || 0;
  const isSupersetRecoveryRunning = timersRunning[supersetTimerId] || false;

  useEffect(() => {
    loadSupersetDetail();
    
    // Restaurer les données sauvegardées
    const savedData = localStorage.getItem(`superset-progress-${supersetId}`);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.completedRounds !== undefined) setCompletedRounds(parsed.completedRounds);
      } catch (error) {
        console.error("Erreur lors de la restauration:", error);
      }
    }
  }, [supersetId]);

  // Sauvegarder automatiquement la progression
  useEffect(() => {
    if (supersetId) {
      const dataToSave = {
        completedRounds,
      };
      localStorage.setItem(`superset-progress-${supersetId}`, JSON.stringify(dataToSave));
    }
  }, [completedRounds, supersetId]);

  const loadSupersetDetail = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("session_exercises")
      .select("*")
      .eq("super_set_group", supersetId)
      .order("exercise_order");

    if (error) {
      console.error("Erreur lors du chargement du superset:", error);
    } else if (data && data.length > 0) {
      // Dédoublonner les exercices par nom pour n'afficher qu'une fois chaque exercice unique
      const uniqueExercises = data.reduce((acc: any[], current: any) => {
        const existingExercise = acc.find((ex) => ex.exercice === current.exercice);
        if (!existingExercise) {
          acc.push(current);
        }
        return acc;
      }, []);

      setExercises(uniqueExercises);

      // Charger les URLs de vidéos depuis la bibliothèque d'exercices
      const exerciseNames = Array.from(
        new Set(uniqueExercises.map((ex: any) => ex.exercice).filter(Boolean))
      );

      if (exerciseNames.length > 0) {
        const { data: libraryData, error: libraryError } = await supabase
          .from("exercise_library")
          .select("name, video_url")
          .in("name", exerciseNames);

        if (libraryError) {
          console.error("Erreur lors du chargement des vidéos d'exercices:", libraryError);
        } else if (libraryData) {
          const videoMap: Record<string, string> = {};
          libraryData.forEach((row: any) => {
            if (row.video_url) {
              videoMap[row.name] = row.video_url;
            }
          });
          setVideoUrls(videoMap);
        }
      }

      const { data: sessionRow } = await supabase
        .from("training_sessions")
        .select("week_id")
        .eq("id", data[0].session_id)
        .maybeSingle();
      if (sessionRow?.week_id) setWeekId(sessionRow.week_id);

      // Initialiser les timers pour chaque exercice
      const timers: Record<string, any> = {};
      data.forEach((exercise, index) => {
        if (exercise.recuperation) {
          timers[exercise.id] = {
            duration: parseRecuperationTime(exercise.recuperation),
            isRunning: false,
            timeRemaining: parseRecuperationTime(exercise.recuperation),
          };
        }
      });
      setExerciseTimers(timers);
    }

    setLoading(false);
  };
  const parseRecuperationTime = (recup: string): number => {
    const minMatch = recup.match(/(\d+)min/);
    const secMatch = recup.match(/(\d+)s/);
    const minutes = minMatch ? parseInt(minMatch[1]) : 0;
    const seconds = secMatch ? parseInt(secMatch[1]) : 0;
    return minutes * 60 + seconds;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleValidateFeedback = async (rpe: string, comment: string) => {
    const rpeValue = rpe ? parseInt(rpe) : null;

    // Valider tous les exercices du superset avec le même RPE
    for (const exercise of exercises) {
      const { error } = await supabase
        .from("session_exercises")
        .update({
          sportif_comment: comment.trim() || null,
          sportif_rpe: rpeValue,
          sportif_feedback_at: new Date().toISOString(),
        })
        .eq("id", exercise.id);

      if (error) {
        console.error("Erreur lors de la sauvegarde:", error);
        toast({
          title: "Erreur",
          description: "Impossible de sauvegarder vos données",
          variant: "destructive",
        });
        throw error;
      }

      if (rpeValue && shouldRecordMax(exercise.charge, exercise.reps, rpeValue)) {
        await recordTheoreticalMax(exercise, rpeValue);
      }
    }

    toast({
      title: "Superset validé !",
      description: "Tous les exercices ont été enregistrés",
    });

    setDialogOpen(false);
    await loadSupersetDetail();
  };

  const recordTheoreticalMax = async (exercise: any, rpeValue: number) => {
    try {
      if (exercise.tempo && exercise.tempo.trim() !== "") {
        console.log("Max théorique non enregistré: tempo défini");
        return;
      }

      const weight = parseWeight(exercise.charge);
      const repsValue = parseReps(exercise.reps);

      if (!weight || !repsValue) return;

      const theoretical1RM = calculate1RM(weight, repsValue, rpeValue);

      const { data: libraryData } = await supabase
        .from("exercise_library")
        .select("id")
        .eq("name", exercise.exercice)
        .maybeSingle();

      if (!libraryData?.id) {
        console.log("Exercice non trouvé dans la bibliothèque:", exercise.exercice);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: latestMax } = await supabase
        .from("exercise_maxes")
        .select("weight_kg")
        .eq("athlete_id", user.id)
        .eq("exercise_id", libraryData.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestMax || theoretical1RM > latestMax.weight_kg) {
        const { error: insertError } = await supabase.from("exercise_maxes").insert({
          athlete_id: user.id,
          exercise_id: libraryData.id,
          max_type: "max_theorique",
          weight_kg: theoretical1RM,
          recorded_at: new Date().toISOString(),
          notes: `Calculé depuis: ${exercise.charge} x ${exercise.reps} reps @ RPE ${rpeValue}`,
        });

        if (!insertError) {
          toast({
            title: "Max théorique enregistré",
            description: `${theoretical1RM} kg sur ${exercise.exercice}`,
          });
        }
      }
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du max théorique:", error);
    }
  };

  const handleFinishSuperset = () => {
    // Ouvrir le dialog pour valider le superset
    setDialogOpen(true);
  };

  const handleSupersetValidated = async () => {
    // Marquer le superset comme terminé et célébrer
    localStorage.removeItem(`superset-progress-${supersetId}`);
    setShowCelebration(true);
  };

  // Fonction pour incrémenter les rounds avec démarrage automatique du timer
  const handleIncrementRound = () => {
    const totalSets = exercises[0]?.series ? parseInt(exercises[0].series) : 0;
    if (completedRounds < totalSets) {
      setCompletedRounds(completedRounds + 1);
      
      // Démarrer automatiquement le timer de récupération du superset
      if (exercises[0]?.recuperation) {
        startTimer(supersetTimerId, exercises[0].recuperation);
        setShowSupersetRecoveryOverlay(true);
      }
    }
  };

  const handleCelebrationComplete = () => {
    setShowCelebration(false);
    toast({
      title: "Superset terminé !",
      description: "Tous les rounds ont été validés",
    });

    setTimeout(() => {
      if (weekId && sessionId) {
        navigate(`/sportif/seance/${weekId}/${sessionId}`);
      } else if (sessionId) {
        navigate(`/sportif/seance/${sessionId}`);
      } else {
        navigate("/sportif/seances");
      }
    }, 300);
  };

  const handleCancelFeedback = () => {
    setDialogOpen(false);
  };

  const handleBack = () => {
    if (weekId && sessionId) {
      navigate(`/sportif/seance/${weekId}/${sessionId}`);
    } else {
      navigate("/sportif/seances");
    }
  };

  const startExerciseTimer = (exerciseId: string) => {
    const timer = exerciseTimers[exerciseId];
    if (!timer || timer.isRunning) return;

    const newTimers = { ...exerciseTimers };
    newTimers[exerciseId] = {
      ...timer,
      isRunning: true,
      startTime: Date.now(),
    };
    setExerciseTimers(newTimers);

    const interval = setInterval(() => {
      setExerciseTimers(prev => {
        const currentTimer = prev[exerciseId];
        if (!currentTimer || !currentTimer.isRunning) {
          clearInterval(interval);
          return prev;
        }

        const elapsed = Math.floor((Date.now() - currentTimer.startTime) / 1000);
        const remaining = Math.max(0, currentTimer.duration - elapsed);

        if (remaining === 0) {
          clearInterval(interval);
          return {
            ...prev,
            [exerciseId]: {
              ...currentTimer,
              isRunning: false,
              timeRemaining: 0,
            }
          };
        }

        return {
          ...prev,
          [exerciseId]: {
            ...currentTimer,
            timeRemaining: remaining,
          }
        };
      });
    }, 100);
  };

  const pauseExerciseTimer = (exerciseId: string) => {
    setExerciseTimers(prev => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        isRunning: false,
      }
    }));
  };

  const resetExerciseTimer = (exerciseId: string) => {
    const timer = exerciseTimers[exerciseId];
    if (!timer) return;

    setExerciseTimers(prev => ({
      ...prev,
      [exerciseId]: {
        ...timer,
        isRunning: false,
        timeRemaining: timer.duration,
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground text-sm">Chargement...</p>
      </div>
    );
  }

  if (exercises.length === 0) {
    return (
      <div className="min-h-screen p-3 sm:p-4">
        <p className="text-center text-muted-foreground text-sm mt-8">Superset introuvable</p>
      </div>
    );
  }

  const totalSets = exercises[0]?.series ? parseInt(exercises[0].series) : 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalTimer />
      
      <CelebrationOverlay
        show={showCelebration}
        message="Superset terminé !"
        onComplete={handleCelebrationComplete}
        type="exercise"
      />

      <TimerOverlay
        show={showSupersetRecoveryOverlay}
        onClose={() => setShowSupersetRecoveryOverlay(false)}
        timeRemaining={supersetRecoveryTime}
        isRunning={isSupersetRecoveryRunning}
        onStart={() => {
          if (exercises[0]?.recuperation) {
            startTimer(supersetTimerId, exercises[0].recuperation);
          }
        }}
        onPause={() => pauseTimer(supersetTimerId)}
        onReset={() => resetTimer(supersetTimerId)}
        title="Récup superset"
      />

      <ExerciseFeedbackDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onValidate={async (rpe, comment) => {
          await handleValidateFeedback(rpe, comment);
          await handleSupersetValidated();
        }}
        onCancel={handleCancelFeedback}
        exerciseName="Superset"
        exerciseType="renfo"
        isRpeRequired={true}
      />

      <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* En-tête */}
        <div className="flex items-center gap-3 mb-2 sm:mb-4">
          <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 w-8 sm:h-10 sm:w-10 p-0">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">Superset</h1>
          <Badge variant="secondary" className="ml-auto text-xs">
            Superset
          </Badge>
        </div>

        {/* Compteur de séries */}
        <Card className="border-2 border-primary/30">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm sm:text-base font-semibold">Séries</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCompletedRounds(Math.max(0, completedRounds - 1))}
                  className="h-8 w-8"
                >
                  -
                </Button>
                <div className="text-2xl sm:text-3xl font-bold min-w-[80px] text-center">
                  {completedRounds}
                  <span className="text-lg sm:text-xl text-muted-foreground">/{totalSets}</span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleIncrementRound}
                  className="h-8 w-8"
                >
                  +
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator className="my-4 sm:my-6" />

        {/* Liste des exercices */}
        {exercises.map((exercise, index) => (
          <div key={exercise.id}>
            {/* Exercice */}
            <Card className="border-primary/50">
              <CardContent className="p-4 sm:p-6 space-y-4">
                {/* En-tête exercice */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg font-bold text-primary">{index + 1}</span>
                      <h3 className="text-xl sm:text-2xl font-bold">{exercise.exercice}</h3>
                    </div>
                  </div>
                  {videoUrls[exercise.exercice] && (
                    <a
                      href={videoUrls[exercise.exercice]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-yellow-400 hover:text-yellow-200 text-3xl sm:text-4xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      🎥
                    </a>
                  )}
                </div>

                {/* Détails - Grid responsive */}
                <div className="grid grid-cols-2 gap-3">
                  {exercise.charge && (
                    <div className="border border-primary/30 bg-primary/5 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Weight className="h-4 w-4 text-primary" />
                        <span className="text-xs sm:text-sm font-semibold text-primary uppercase">Charge</span>
                      </div>
                      <p className="text-xl sm:text-2xl font-bold text-primary">{exercise.charge}</p>
                    </div>
                  )}

                  {exercise.reps && (
                    <div className="border border-primary/30 bg-primary/5 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Repeat className="h-4 w-4 text-primary" />
                        <span className="text-xs sm:text-sm font-semibold text-primary uppercase">Reps</span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xl sm:text-2xl font-bold text-primary">{exercise.reps}</p>
                        {exercise.per_side && (
                          <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-primary/30">
                            par côté
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {exercise.rpe && (
                    <div className="border border-primary/30 bg-primary/5 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-primary" />
                          <span className="text-xs sm:text-sm font-semibold text-primary uppercase">RPE</span>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <RPEExplanationDialog />
                        </div>
                      </div>
                      <p className="text-xl sm:text-2xl font-bold text-primary">{exercise.rpe}</p>
                    </div>
                  )}

                  {exercise.tempo && (
                    <div className="border border-primary/30 bg-primary/5 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary" />
                          <span className="text-xs sm:text-sm font-semibold text-primary uppercase">Tempo</span>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <TempoExplanationDialog />
                        </div>
                      </div>
                      <p className="text-xl sm:text-2xl font-bold text-primary">{exercise.tempo}</p>
                    </div>
                  )}
                </div>

                {/* Notes du coach */}
                {exercise.commentaire && (
                  <div className="border-2 border-primary/20 rounded-lg p-3 sm:p-4">
                    <div className="flex items-start gap-2">
                      <span className="text-xl sm:text-2xl">📝</span>
                      <div className="flex-1">
                        <p className="text-xs sm:text-sm font-semibold text-primary mb-2">Notes du coach</p>
                        <p className="text-sm sm:text-base leading-relaxed">{exercise.commentaire}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Timer entre les exercices */}
            {index < exercises.length - 1 && exercise.recuperation && exerciseTimers[exercise.id] && (
              <div className="my-3 sm:my-4">
                <Card className="bg-muted/50 border-primary/30">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Timer className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">Avant ex. {index + 2}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-mono font-bold">
                          {formatTime(exerciseTimers[exercise.id].timeRemaining)}
                        </span>
                        <Button
                          size="sm"
                          variant={exerciseTimers[exercise.id].isRunning ? "secondary" : "default"}
                          onClick={() => {
                            if (exerciseTimers[exercise.id].isRunning) {
                              pauseExerciseTimer(exercise.id);
                            } else {
                              startExerciseTimer(exercise.id);
                            }
                          }}
                          className="h-8 px-3"
                        >
                          {exerciseTimers[exercise.id].isRunning ? "Pause" : "Start"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        ))}

        {/* Timer de récupération du superset */}
        {exercises[0]?.recuperation && (
          <Card className="bg-muted/50 border-primary/30">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Récup superset</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-mono font-bold">
                    {formatTime(supersetRecoveryTime)}
                  </span>
                  <Button
                    size="sm"
                    variant={isSupersetRecoveryRunning ? "secondary" : "default"}
                    onClick={() => {
                      if (isSupersetRecoveryRunning) {
                        pauseTimer(supersetTimerId);
                      } else {
                        startTimer(supersetTimerId, exercises[0].recuperation);
                        setShowSupersetRecoveryOverlay(true);
                      }
                    }}
                    className="h-8 px-3"
                  >
                    {isSupersetRecoveryRunning ? "Pause" : "Start"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bouton terminer le superset */}
        <Button
          size="lg"
          className="w-full text-base sm:text-lg py-6 bg-primary hover:bg-primary/90"
          onClick={handleFinishSuperset}
        >
          Superset terminé
        </Button>
      </div>
    </div>
  );
}
