import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Minus, Play, Pause, RotateCcw, Video, Zap, Weight, Repeat, Clock, CheckCircle2 } from "lucide-react";
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

export default function SupersetDetail() {
  const { sessionId, supersetId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedRounds, setCompletedRounds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timerStartTimestamp, setTimerStartTimestamp] = useState<number | null>(null);
  const [targetDuration, setTargetDuration] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [weekId, setWeekId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showTimerOverlay, setShowTimerOverlay] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<any>(null);
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSupersetDetail();

    // Restaurer les données sauvegardées
    const savedData = localStorage.getItem(`superset-progress-${supersetId}`);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.completedRounds !== undefined) setCompletedRounds(parsed.completedRounds);

        // Restaurer le timer avec recalcul basé sur timestamp
        if (parsed.isTimerRunning && parsed.timerStartTimestamp && parsed.targetDuration) {
          const now = Date.now();
          const elapsedSeconds = Math.floor((now - parsed.timerStartTimestamp) / 1000);
          const remaining = Math.max(0, parsed.targetDuration - elapsedSeconds);

          if (remaining > 0) {
            setTimeRemaining(remaining);
            setTimerStartTimestamp(parsed.timerStartTimestamp);
            setTargetDuration(parsed.targetDuration);
            setIsTimerRunning(true);

            const interval = setInterval(() => {
              const currentElapsed = Math.floor((Date.now() - parsed.timerStartTimestamp) / 1000);
              const currentRemaining = Math.max(0, parsed.targetDuration - currentElapsed);
              setTimeRemaining(currentRemaining);

              if (currentRemaining === 0) {
                clearInterval(interval);
                setIsTimerRunning(false);
                setTimerStartTimestamp(null);
              }
            }, 100);
            setTimerInterval(interval);
          }
        } else if (parsed.timeRemaining !== undefined) {
          setTimeRemaining(parsed.timeRemaining);
        }
      } catch (error) {
        console.error("Erreur lors de la restauration:", error);
      }
    }

    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [supersetId]);

  // Sauvegarder automatiquement la progression
  useEffect(() => {
    if (supersetId) {
      const dataToSave = {
        completedRounds,
        timeRemaining,
        isTimerRunning,
        timerStartTimestamp,
        targetDuration,
      };
      localStorage.setItem(`superset-progress-${supersetId}`, JSON.stringify(dataToSave));
    }
  }, [completedRounds, timeRemaining, isTimerRunning, timerStartTimestamp, targetDuration, supersetId]);

  const loadSupersetDetail = async () => {
    setLoading(true);

    // Charger tous les exercices du superset
    const { data, error } = await supabase
      .from("session_exercises")
      .select("*")
      .eq("super_set_group", supersetId)
      .order("exercise_order");

    if (error) {
      console.error("Erreur lors du chargement du superset:", error);
    } else if (data && data.length > 0) {
      setExercises(data);
      
      // Récupérer la semaine de la séance
      const { data: sessionRow } = await supabase
        .from("training_sessions")
        .select("week_id")
        .eq("id", data[0].session_id)
        .maybeSingle();
      if (sessionRow?.week_id) setWeekId(sessionRow.week_id);

      // Initialiser le timer avec le temps de récupération du premier exercice
      if (data[0].recuperation && timeRemaining === 0) {
        const recupTime = parseRecuperationTime(data[0].recuperation);
        setTimeRemaining(recupTime);
        setTargetDuration(recupTime);
      }

      // Charger les vidéos pour tous les exercices
      const urls: Record<string, string> = {};
      for (const ex of data) {
        if (ex.exercice) {
          const { data: libraryData } = await supabase
            .from("exercise_library")
            .select("video_url")
            .eq("name", ex.exercice)
            .maybeSingle();
          if (libraryData?.video_url) {
            urls[ex.id] = libraryData.video_url;
          }
        }
      }
      setVideoUrls(urls);
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
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const incrementRound = () => {
    if (exercises.length > 0 && exercises[0].series) {
      const totalSets = parseInt(exercises[0].series);
      if (completedRounds < totalSets) {
        setCompletedRounds((prev) => prev + 1);

        // Démarrer automatiquement le chrono de récupération
        if (exercises[0].recuperation && !isTimerRunning) {
          const recuperationTime = parseRecuperationTime(exercises[0].recuperation);
          const now = Date.now();

          setTimeRemaining(recuperationTime);
          setTargetDuration(recuperationTime);
          setTimerStartTimestamp(now);
          setIsTimerRunning(true);

          const interval = setInterval(() => {
            const elapsedSeconds = Math.floor((Date.now() - now) / 1000);
            const remaining = Math.max(0, recuperationTime - elapsedSeconds);
            setTimeRemaining(remaining);

            if (remaining === 0) {
              setIsTimerRunning(false);
              setTimerStartTimestamp(null);
              clearInterval(interval);
            }
          }, 100);
          setTimerInterval(interval);
          setShowTimerOverlay(true);
        }
      }
    }
  };

  const decrementRound = () => {
    if (completedRounds > 0) {
      setCompletedRounds((prev) => prev - 1);
    }
  };

  const startTimer = () => {
    if (!isTimerRunning && timeRemaining > 0) {
      const now = Date.now();
      setTimerStartTimestamp(now);
      setTargetDuration(timeRemaining);
      setIsTimerRunning(true);

      const interval = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - now) / 1000);
        const remaining = Math.max(0, timeRemaining - elapsedSeconds);
        setTimeRemaining(remaining);

        if (remaining === 0) {
          setIsTimerRunning(false);
          setTimerStartTimestamp(null);
          clearInterval(interval);
        }
      }, 100);
      setTimerInterval(interval);
    }
  };

  const pauseTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }

    if (timerStartTimestamp && targetDuration) {
      const elapsedSeconds = Math.floor((Date.now() - timerStartTimestamp) / 1000);
      const remaining = Math.max(0, targetDuration - elapsedSeconds);
      setTimeRemaining(remaining);
    }

    setIsTimerRunning(false);
    setTimerStartTimestamp(null);
  };

  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimerStartTimestamp(null);
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    if (exercises.length > 0 && exercises[0].recuperation) {
      const recupTime = parseRecuperationTime(exercises[0].recuperation);
      setTimeRemaining(recupTime);
      setTargetDuration(recupTime);
    }
  };

  const handleExerciseClick = (exercise: any) => {
    // Ne permettre la validation que si l'exercice n'est pas déjà validé
    if (exercise.sportif_rpe === null) {
      setSelectedExercise(exercise);
      setDialogOpen(true);
    }
  };

  const handleValidateFeedback = async (rpe: string, comment: string) => {
    if (!selectedExercise) return;

    const rpeValue = rpe ? parseInt(rpe) : null;

    const { error } = await supabase
      .from("session_exercises")
      .update({
        sportif_comment: comment.trim() || null,
        sportif_rpe: rpeValue,
        sportif_feedback_at: new Date().toISOString(),
      })
      .eq("id", selectedExercise.id);

    if (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder vos données",
        variant: "destructive",
      });
      throw error;
    }

    // Calculer et enregistrer le max théorique si les conditions sont remplies
    if (rpeValue && shouldRecordMax(selectedExercise.charge, selectedExercise.reps, rpeValue)) {
      await recordTheoreticalMax(selectedExercise, rpeValue);
    }

    toast({
      title: "Exercice validé !",
      description: `${selectedExercise.exercice} enregistré`,
    });

    setDialogOpen(false);
    setSelectedExercise(null);

    // Recharger les données
    await loadSupersetDetail();

    // Vérifier si tous les exercices du superset sont terminés
    const allCompleted = exercises.every((ex) => ex.id === selectedExercise.id || ex.sportif_rpe !== null);
    if (allCompleted) {
      // Nettoyer les données sauvegardées
      localStorage.removeItem(`superset-progress-${supersetId}`);
      setShowCelebration(true);
    }
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

  const handleCelebrationComplete = () => {
    setShowCelebration(false);
    toast({
      title: "Superset terminé !",
      description: "Tous les exercices ont été validés",
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
    setSelectedExercise(null);
  };

  const handleBack = () => {
    if (weekId && sessionId) {
      navigate(`/sportif/seance/${weekId}/${sessionId}`);
    } else {
      navigate("/sportif/seances");
    }
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
  const allExercisesCompleted = exercises.every((ex) => ex.sportif_rpe !== null);

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
        show={showTimerOverlay}
        onClose={() => setShowTimerOverlay(false)}
        timeRemaining={timeRemaining}
        isRunning={isTimerRunning}
        onStart={startTimer}
        onPause={pauseTimer}
        onReset={resetTimer}
        title="Récupération"
      />

      <ExerciseFeedbackDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onValidate={handleValidateFeedback}
        onCancel={handleCancelFeedback}
        exerciseName={selectedExercise?.exercice}
        exerciseType="renfo"
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
            {exercises.length} exercices
          </Badge>
        </div>

        {/* Compteur de rounds */}
        {totalSets > 0 && (
          <Card className="border-2 border-primary/30">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm sm:text-base font-semibold">Rounds</Label>
                <div className="flex items-center gap-2 sm:gap-3">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={decrementRound}
                    disabled={completedRounds === 0}
                    className="h-8 w-8 sm:h-10 sm:w-10"
                  >
                    <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>

                  <div className="text-3xl sm:text-4xl font-bold min-w-[80px] sm:min-w-[100px] text-center">
                    {completedRounds}
                    <span className="text-xl sm:text-2xl text-muted-foreground">/{totalSets}</span>
                  </div>

                  <Button
                    size="icon"
                    onClick={incrementRound}
                    disabled={completedRounds >= totalSets}
                    className="h-8 w-8 sm:h-10 sm:w-10"
                  >
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chronomètre de récupération */}
        {exercises[0]?.recuperation && (
          <Card className="border-2 border-muted-foreground/20 bg-muted/50">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-0 sm:justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  <Label className="text-sm sm:text-base font-semibold">Récupération</Label>
                </div>
                <div
                  className={`text-2xl sm:text-3xl font-bold font-mono ${timeRemaining === 0 ? "text-green-500" : "text-foreground"}`}
                >
                  {formatTime(timeRemaining)}
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  {!isTimerRunning ? (
                    <Button size="sm" onClick={startTimer} disabled={timeRemaining === 0} className="h-8 sm:h-9 flex-1 sm:flex-none px-3 sm:px-4">
                      <Play className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      <span className="text-xs sm:text-sm">Start</span>
                    </Button>
                  ) : (
                    <Button size="sm" onClick={pauseTimer} variant="secondary" className="h-8 sm:h-9 flex-1 sm:flex-none px-3 sm:px-4">
                      <Pause className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      <span className="text-xs sm:text-sm">Pause</span>
                    </Button>
                  )}
                  <Button size="sm" onClick={resetTimer} variant="outline" className="h-8 w-8 sm:h-9 sm:w-9 p-0">
                    <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Separator className="my-4 sm:my-6" />

        {/* Liste des exercices */}
        <div className="space-y-3 sm:space-y-4">
          {exercises.map((exercise, index) => {
            const isCompleted = exercise.sportif_rpe !== null;

            return (
              <Card
                key={exercise.id}
                className={`cursor-pointer transition-all ${
                  isCompleted
                    ? "border-green-500/50 bg-green-500/5"
                    : "border-primary/30 hover:border-primary/50"
                }`}
                onClick={() => handleExerciseClick(exercise)}
              >
                <CardContent className="p-3 sm:p-4 space-y-3">
                  {/* En-tête exercice */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          #{index + 1}
                        </Badge>
                        {isCompleted && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                      </div>
                      <h3 className="text-base sm:text-lg font-bold">{exercise.exercice}</h3>
                    </div>
                    {videoUrls[exercise.id] && (
                      <a
                        href={videoUrls[exercise.id]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-yellow-400 hover:text-yellow-200 text-2xl sm:text-3xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        🎥
                      </a>
                    )}
                  </div>

                  {/* Détails - Grid responsive */}
                  <div className="grid grid-cols-2 gap-2">
                    {exercise.charge && (
                      <div className="border border-red-500/30 bg-red-500/5 rounded-lg p-2">
                        <div className="flex items-center gap-1 mb-1">
                          <Weight className="h-4 w-4 text-red-600" />
                          <span className="text-xs font-semibold text-red-600 uppercase">Charge</span>
                        </div>
                        <p className="text-xl sm:text-2xl font-bold">{exercise.charge}</p>
                      </div>
                    )}

                    {exercise.reps && (
                      <div className="border border-orange-500/30 bg-orange-500/5 rounded-lg p-2">
                        <div className="flex items-center gap-1 mb-1">
                          <Repeat className="h-4 w-4 text-orange-600" />
                          <span className="text-xs font-semibold text-orange-600 uppercase">Reps</span>
                        </div>
                        <p className="text-xl sm:text-2xl font-bold">{exercise.reps}</p>
                      </div>
                    )}

                    {exercise.rpe && (
                      <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-2">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1">
                            <Zap className="h-4 w-4 text-yellow-600" />
                            <span className="text-xs font-semibold text-yellow-600 uppercase">RPE</span>
                          </div>
                          <div onClick={(e) => e.stopPropagation()}>
                            <RPEExplanationDialog />
                          </div>
                        </div>
                        <p className="text-xl sm:text-2xl font-bold">{exercise.rpe}</p>
                      </div>
                    )}

                    {exercise.tempo && (
                      <div className="border border-purple-500/30 bg-purple-500/5 rounded-lg p-2">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-purple-600" />
                            <span className="text-xs font-semibold text-purple-600 uppercase">Tempo</span>
                          </div>
                          <div onClick={(e) => e.stopPropagation()}>
                            <TempoExplanationDialog />
                          </div>
                        </div>
                        <p className="text-xl sm:text-2xl font-bold">{exercise.tempo}</p>
                      </div>
                    )}
                  </div>

                  {/* Notes du coach */}
                  {exercise.commentaire && (
                    <div className="border-2 border-primary/20 rounded-lg p-2 sm:p-3">
                      <div className="flex items-start gap-2">
                        <span className="text-base sm:text-lg">📝</span>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-primary mb-1">Notes du coach</p>
                          <p className="text-xs sm:text-sm leading-relaxed">{exercise.commentaire}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Status de validation */}
                  {isCompleted ? (
                    <div className="text-xs sm:text-sm text-green-600 font-medium text-center">
                      ✓ Exercice validé
                    </div>
                  ) : (
                    <div className="text-xs sm:text-sm text-muted-foreground text-center">
                      Cliquer pour valider l'exercice
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Message si tous terminés */}
        {allExercisesCompleted && (
          <Card className="border-2 border-green-500 bg-green-500/10">
            <CardContent className="p-3 sm:p-4 text-center">
              <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12 text-green-600 mx-auto mb-2" />
              <p className="text-sm sm:text-base font-semibold text-green-600">
                Tous les exercices du superset sont terminés !
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
