import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Minus, Play, Pause, RotateCcw, Video, Zap, Weight, Repeat, Clock, Timer } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ExerciseFeedbackDialog } from "@/components/ExerciseFeedbackDialog";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";
import { TimerOverlay } from "@/components/TimerOverlay";
import { TempoExplanationDialog } from "@/components/TempoExplanationDialog";
import { RPEExplanationDialog } from "@/components/RPEExplanationDialog";
import { calculate1RM, parseWeight, parseReps, shouldRecordMax } from "@/lib/maxCalculations";
import { UniversalTimer, UniversalTimerRef } from "@/components/UniversalTimer";
import { useWakeLock } from "@/hooks/useWakeLock";

export default function ExerciceDetail() {
  // Keep screen on during workout
  useWakeLock(true);
  const { exerciceId } = useParams();
  const navigate = useNavigate();
  const [exercise, setExercise] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completedSets, setCompletedSets] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timerStartTimestamp, setTimerStartTimestamp] = useState<number | null>(null);
  const [targetDuration, setTargetDuration] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [weekId, setWeekId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showTimerOverlay, setShowTimerOverlay] = useState(false);
  const { toast } = useToast();
  const timerRef = useRef<UniversalTimerRef>(null);

  // Vérifier si la récupération est en mode EMOM
  const isEmomRecovery = exercise?.recuperation?.toLowerCase() === 'emom';
  
  // Vérifier si l'exercice est en mode durée (Tabata)
  const isDurationMode = exercise?.is_duration === true;

  const handleLaunchEmom = () => {
    const totalSets = exercise?.series ? parseInt(exercise.series) : 1;
    timerRef.current?.openWithSettings({
      type: 'emom',
      emomInterval: 60, // 1 minute
      rounds: totalSets,
    });
  };

  const handleLaunchTabata = () => {
    const totalSets = exercise?.series ? parseInt(exercise.series) : 1;
    const workTime = exercise?.reps ? parseInt(exercise.reps) : 20;
    const restTime = exercise?.recuperation ? parseRecuperationTime(exercise.recuperation) : 10;
    
    timerRef.current?.openWithSettings({
      type: 'tabata',
      workTime: workTime,
      restTime: restTime,
      rounds: totalSets,
    });
  };

  useEffect(() => {
    loadExerciseDetail();

    // Restaurer les données sauvegardées
    const savedData = localStorage.getItem(`exercise-progress-${exerciceId}`);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.completedSets !== undefined) setCompletedSets(parsed.completedSets);

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

            // Relancer le timer
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

    // Recharger les données quand la page redevient visible (après modification par le coach)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadExerciseDetail();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerInterval) clearInterval(timerInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [exerciceId]);

  // Sauvegarder automatiquement la progression
  useEffect(() => {
    if (exerciceId) {
      const dataToSave = {
        completedSets,
        timeRemaining,
        isTimerRunning,
        timerStartTimestamp,
        targetDuration,
      };
      localStorage.setItem(`exercise-progress-${exerciceId}`, JSON.stringify(dataToSave));
    }
  }, [completedSets, timeRemaining, isTimerRunning, timerStartTimestamp, targetDuration, exerciceId]);

  useEffect(() => {
    if (timeRemaining <= 0 && isTimerRunning) {
      setIsTimerRunning(false);
      setTimerStartTimestamp(null);
      if (timerInterval) clearInterval(timerInterval);
    }
  }, [timeRemaining, isTimerRunning]);

  const loadExerciseDetail = async () => {
    setLoading(true);

    const { data, error } = await supabase.from("session_exercises").select("*").eq("id", exerciceId).single();

    if (error) {
      console.error("Erreur lors du chargement de l'exercice:", error);
    } else {
      setExercise(data);
      setSessionId(data.session_id);
      // Récupérer la semaine de la séance pour un retour fiable
      if (data.session_id) {
        const { data: sessionRow } = await supabase
          .from("training_sessions")
          .select("week_id")
          .eq("id", data.session_id)
          .maybeSingle();
        if (sessionRow?.week_id) setWeekId(sessionRow.week_id);
      }
      // Initialiser le timer avec le temps de récupération
      if (data.recuperation && timeRemaining === 0) {
        setTimeRemaining(parseRecuperationTime(data.recuperation));
        setTargetDuration(parseRecuperationTime(data.recuperation));
      }

      // Récupérer la vidéo depuis la bibliothèque d'exercices
      if (data.exercice) {
        const { data: libraryData } = await supabase
          .from("exercise_library")
          .select("video_url")
          .eq("name", data.exercice)
          .maybeSingle();

        if (libraryData?.video_url) {
          setVideoUrl(libraryData.video_url);
        }
      }
    }

    setLoading(false);
  };

  const parseRecuperationTime = (recup: string): number => {
    // Parse "1min30s" => 90 secondes, "2min" => 120 secondes, etc.
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

  const incrementSet = () => {
    if (exercise?.series) {
      const totalSets = parseInt(exercise.series);
      if (completedSets < totalSets) {
        setCompletedSets((prev) => prev + 1);

        // Ne pas démarrer le timer de récupération si c'est un EMOM
        const isEmom = exercise.recuperation?.toLowerCase() === 'emom';
        if (exercise.recuperation && !isEmom) {
          // Arrêter le timer précédent s'il existe
          if (timerInterval) {
            clearInterval(timerInterval);
            setTimerInterval(null);
          }

          const recuperationTime = parseRecuperationTime(exercise.recuperation);
          const now = Date.now();

          setTimeRemaining(recuperationTime);
          setTargetDuration(recuperationTime);
          setTimerStartTimestamp(now);
          setIsTimerRunning(true);

          // Démarrer le timer avec calcul basé sur timestamp
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

          // Afficher l'overlay
          setShowTimerOverlay(true);
        }
      }
    }
  };

  const decrementSet = () => {
    if (completedSets > 0) {
      setCompletedSets((prev) => prev - 1);
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

    // Calculer le temps restant réel avant la pause
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
    if (exercise?.recuperation) {
      const recupTime = parseRecuperationTime(exercise.recuperation);
      setTimeRemaining(recupTime);
      setTargetDuration(recupTime);
    }
  };

  const handleValidateFeedback = async (rpe: string, comment: string) => {
    const rpeValue = rpe ? parseInt(rpe) : null;

    const { error } = await supabase
      .from("session_exercises")
      .update({
        sportif_comment: comment.trim() || null,
        sportif_rpe: rpeValue,
        sportif_feedback_at: new Date().toISOString(),
      })
      .eq("id", exerciceId);

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
    if (exercise && rpeValue && shouldRecordMax(exercise.charge, exercise.reps, rpeValue)) {
      await recordTheoreticalMax(exercise, rpeValue);
    }

    // Nettoyer les données sauvegardées
    localStorage.removeItem(`exercise-progress-${exerciceId}`);

    setDialogOpen(false);

    // Afficher la célébration
    setShowCelebration(true);
  };

  const recordTheoreticalMax = async (exercise: any, rpeValue: number) => {
    try {
      console.log("🔍 Début recordTheoreticalMax", { 
        exercice: exercise.exercice, 
        charge: exercise.charge, 
        reps: exercise.reps, 
        rpe: rpeValue,
        tempo: exercise.tempo 
      });

      // Ne pas enregistrer si l'exercice a un tempo défini
      if (exercise.tempo && exercise.tempo.trim() !== "") {
        console.log("❌ Max théorique non enregistré: tempo défini");
        return;
      }

      const weight = parseWeight(exercise.charge);
      const repsValue = parseReps(exercise.reps);

      console.log("📊 Poids et reps parsés:", { weight, repsValue });

      if (!weight || !repsValue) {
        console.log("❌ Poids ou reps invalide");
        return;
      }

      // Calculer le 1RM théorique
      const theoretical1RM = calculate1RM(weight, repsValue, rpeValue);
      console.log("💪 1RM théorique calculé:", theoretical1RM);

      // Récupérer l'exercise_id depuis la bibliothèque
      const { data: libraryData } = await supabase
        .from("exercise_library")
        .select("id")
        .eq("name", exercise.exercice)
        .maybeSingle();

      console.log("📚 Recherche exercice dans bibliothèque:", libraryData);

      if (!libraryData?.id) {
        console.log("❌ Exercice non trouvé dans la bibliothèque:", exercise.exercice);
        return;
      }

      // Récupérer l'athlete_id
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        console.log("❌ Utilisateur non connecté");
        return;
      }

      // Chercher le max le plus récent pour cet exercice (tous types confondus)
      const { data: latestMax } = await supabase
        .from("exercise_maxes")
        .select("weight_kg, max_type, recorded_at")
        .eq("athlete_id", user.id)
        .eq("exercise_id", libraryData.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log("🏆 Max existant trouvé:", latestMax);
      console.log("🔄 Comparaison:", { 
        nouveau: theoretical1RM, 
        ancien: latestMax?.weight_kg, 
        estNouveauRecord: !latestMax || theoretical1RM > latestMax.weight_kg 
      });

      // Enregistrer tous les max théoriques, même s'ils sont en baisse
      const isNewRecord = !latestMax || theoretical1RM > latestMax.weight_kg;
      console.log("✅ Enregistrement du max...");
      
      const { data: insertData, error: insertError } = await supabase.from("exercise_maxes").insert({
        athlete_id: user.id,
        exercise_id: libraryData.id,
        max_type: "max_theorique",
        weight_kg: theoretical1RM,
        recorded_at: new Date().toISOString(),
        notes: `Calculé depuis: ${exercise.charge} x ${exercise.reps} reps @ RPE ${rpeValue}`,
      }).select();

      if (insertError) {
        console.error("❌ Erreur insert max théorique:", insertError);
        toast({
          title: "Max non enregistré",
          description: "Autorisation refusée. Je peux corriger les permissions si tu veux.",
          variant: "destructive",
        });
      } else {
        console.log("✅ Max enregistré avec succès:", insertData);
        toast({
          title: isNewRecord ? "Nouveau record !" : "Max enregistré",
          description: `${theoretical1RM} kg sur ${exercise.exercice}${!isNewRecord ? ` (précédent: ${latestMax.weight_kg} kg)` : ""}`,
        });
      }
    } catch (error) {
      console.error("❌ Erreur lors de l'enregistrement du max théorique:", error);
      // Ne pas faire échouer la sauvegarde du feedback si l'enregistrement du max échoue
    }
  };

  const handleCelebrationComplete = () => {
    setShowCelebration(false);

    toast({
      title: "Enregistré !",
      description: "Ton retour a été sauvegardé",
    });

    // Rediriger vers la page de la séance
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  const handleBack = () => {
    if (weekId && sessionId) {
      navigate(`/sportif/seance/${weekId}/${sessionId}`);
    } else {
      navigate("/sportif/seances");
    }
  };

  if (!exercise) {
    return (
      <div className="min-h-screen p-4">
        <p className="text-center text-muted-foreground mt-8">Exercice introuvable</p>
      </div>
    );
  }

  const InfoItem = ({ label, value }: { label: string; value: string | null }) => {
    if (!value) return null;

    return (
      <div className="py-2">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-base font-medium">{value}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <UniversalTimer ref={timerRef} />
      <CelebrationOverlay
        show={showCelebration}
        message={exercise?.exercice || ""}
        onComplete={handleCelebrationComplete}
        type="exercise"
      />

      {/* Timer Overlay */}
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
        exerciseName={exercise?.exercice}
        exerciseType="renfo"
        isRpeRequired={true}
      />

      <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* En-tête exercice avec vidéo */}
        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <h1 className="text-xl sm:text-2xl font-bold flex-1">{exercise.exercice}</h1>
          {videoUrl && (
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 hover:text-yellow-200 text-2xl sm:text-3xl"
            >
              🎥
            </a>
          )}
        </div>

        {/* Compteur de séries - Mis en avant */}
        {exercise.series && (
          <Card className="border-2 border-primary/30">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm sm:text-base font-semibold">Séries</Label>
                <div className="flex items-center gap-2 sm:gap-3">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={decrementSet}
                    disabled={completedSets === 0}
                    className="h-8 w-8 sm:h-10 sm:w-10"
                  >
                    <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>

                  <div className="text-2xl sm:text-4xl font-bold min-w-[80px] sm:min-w-[100px] text-center">
                    {completedSets}
                    <span className="text-lg sm:text-2xl text-muted-foreground">/{exercise.series}</span>
                  </div>

                  <Button
                    size="icon"
                    onClick={incrementSet}
                    disabled={completedSets >= parseInt(exercise.series)}
                    className="h-8 w-8 sm:h-10 sm:w-10"
                  >
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chronomètre de récupération, Bouton EMOM ou Bouton Tabata */}
        {exercise.recuperation && (
          exercise.recuperation === "0s" ? (
            <Card className="border-2 border-amber-500/30 bg-amber-500/10">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚡</span>
                  <Label className="text-sm sm:text-base font-semibold text-amber-600">Exercice enchaîné</Label>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Pas de récupération — passez directement à la série suivante
                </p>
              </CardContent>
            </Card>
          ) : isEmomRecovery ? (
            <Card className="border-2 border-primary/30 bg-primary/5">
              <CardContent className="p-3 sm:p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Timer className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    <Label className="text-sm sm:text-base font-semibold">Mode EMOM</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {exercise.series} tour{parseInt(exercise.series) > 1 ? 's' : ''} × 1 minute
                  </p>
                  <Button 
                    onClick={handleLaunchEmom} 
                    className="w-full h-11"
                  >
                    <Timer className="h-4 w-4 mr-2" />
                    Lancer l'EMOM
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : isDurationMode ? (
            <Card className="border-2 border-green-500/30 bg-green-500/5">
              <CardContent className="p-3 sm:p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Timer className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                    <Label className="text-sm sm:text-base font-semibold">Mode Tabata</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {exercise.series} tour{parseInt(exercise.series) > 1 ? 's' : ''} × {exercise.reps}s travail / {exercise.recuperation} repos
                  </p>
                  <Button 
                    onClick={handleLaunchTabata} 
                    className="w-full h-11 bg-green-600 hover:bg-green-700"
                  >
                    <Timer className="h-4 w-4 mr-2" />
                    Lancer le Tabata
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-2 border-muted-foreground/20 bg-muted/50">
              <CardContent className="p-3 sm:p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      <Label className="text-sm sm:text-base font-semibold">Récupération</Label>
                    </div>
                    <div
                      className={`text-2xl sm:text-3xl font-bold font-mono ${timeRemaining === 0 ? "text-green-500" : "text-foreground"}`}
                    >
                      {formatTime(timeRemaining)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!isTimerRunning ? (
                      <Button size="sm" onClick={startTimer} disabled={timeRemaining === 0} className="flex-1 h-9">
                        <Play className="h-4 w-4 mr-1" />
                        Start
                      </Button>
                    ) : (
                      <Button size="sm" onClick={pauseTimer} variant="secondary" className="flex-1 h-9">
                        <Pause className="h-4 w-4 mr-1" />
                        Pause
                      </Button>
                    )}
                    <Button size="sm" onClick={resetTimer} variant="outline" className="h-9 w-9 p-0">
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        )}

        {/* Détails de l'exercice - Compact et lisible */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {exercise.charge && (
            <Card className="border border-red-500/30 bg-red-500/5">
              <CardContent className="p-2 sm:p-3">
                <div className="flex items-center gap-1 sm:gap-2 mb-1">
                  <Weight className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                  <span className="text-xs sm:text-sm font-semibold text-red-600 uppercase">Charge</span>
                </div>
                <p className="text-2xl sm:text-3xl font-bold">{exercise.charge}</p>
              </CardContent>
            </Card>
          )}

          {exercise.reps && (
            <Card className="border border-orange-500/30 bg-orange-500/5">
              <CardContent className="p-2 sm:p-3">
                <div className="flex items-center gap-1 sm:gap-2 mb-1">
                  <Repeat className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
                  <span className="text-xs sm:text-sm font-semibold text-orange-600 uppercase">
                    {exercise.is_duration ? "Durée" : "Reps"}
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl sm:text-3xl font-bold">
                    {exercise.reps}{exercise.is_duration ? "s" : ""}
                  </p>
                  {exercise.per_side && (
                    <Badge variant="secondary" className="text-xs bg-orange-600/20 text-orange-700 border-orange-600/30">
                      par côté
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {exercise.rpe && (
            <Card className="border border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="p-2 sm:p-3">
                <div className="flex items-center justify-between gap-1 sm:gap-2 mb-1">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
                    <span className="text-xs sm:text-sm font-semibold text-yellow-600 uppercase">RPE</span>
                  </div>
                  <RPEExplanationDialog />
                </div>
                <p className="text-2xl sm:text-3xl font-bold">{exercise.rpe}</p>
              </CardContent>
            </Card>
          )}

          {exercise.tempo && (
            <Card className="border border-purple-500/30 bg-purple-500/5">
              <CardContent className="p-2 sm:p-3">
                <div className="flex items-center justify-between gap-1 sm:gap-2 mb-1">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                    <span className="text-xs sm:text-sm font-semibold text-purple-600 uppercase">Tempo</span>
                  </div>
                  <TempoExplanationDialog />
                </div>
                <p className="text-2xl sm:text-3xl font-bold">{exercise.tempo}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Notes du coach */}
        {exercise.commentaire && (
          <Card className="border-2 border-primary/20">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start gap-2">
                <span className="text-lg sm:text-xl">📝</span>
                <div className="flex-1">
                  <p className="text-xs sm:text-sm font-semibold text-primary mb-1">Notes du coach</p>
                  <p className="text-sm leading-relaxed">{exercise.commentaire}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bouton exercice terminé */}
        <Button onClick={() => setDialogOpen(true)} size="lg" className="w-full">
          Exercice terminé
        </Button>
      </div>
    </div>
  );
}
