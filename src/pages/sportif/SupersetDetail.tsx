import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Timer, Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ExerciseFeedbackDialog } from "@/components/ExerciseFeedbackDialog";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";

export default function SupersetDetail() {
  const { sessionId, supersetId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalCompletedSets, setGlobalCompletedSets] = useState(0);
  const [timers, setTimers] = useState<{ [key: string]: number }>({});
  const [timerIntervals, setTimerIntervals] = useState<{ [key: string]: NodeJS.Timeout }>({});
  const [isTimerRunning, setIsTimerRunning] = useState<{ [key: string]: boolean }>({});
  const [weekId, setWeekId] = useState<string | null>(null);
  const [videoUrls, setVideoUrls] = useState<{ [key: string]: string }>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    loadSupersetExercises();
    
    // Restaurer les données sauvegardées
    const savedData = localStorage.getItem(`superset-progress-${supersetId}`);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.globalCompletedSets !== undefined) setGlobalCompletedSets(parsed.globalCompletedSets);
        if (parsed.timers) setTimers(parsed.timers);
      } catch (error) {
        console.error("Erreur lors de la restauration:", error);
      }
    }
    
    return () => {
      Object.values(timerIntervals).forEach(clearInterval);
    };
  }, [supersetId]);

  // Sauvegarder automatiquement la progression
  useEffect(() => {
    if (supersetId) {
      const dataToSave = {
        globalCompletedSets,
        timers,
      };
      localStorage.setItem(`superset-progress-${supersetId}`, JSON.stringify(dataToSave));
    }
  }, [globalCompletedSets, timers, supersetId]);

  const loadSupersetExercises = async () => {
    setLoading(true);

    // Charger le weekId depuis la session
    if (sessionId) {
      const { data: sessionData } = await supabase
        .from("training_sessions")
        .select("week_id")
        .eq("id", sessionId)
        .maybeSingle();
      if (sessionData?.week_id) setWeekId(sessionData.week_id);
    }

    const { data, error } = await supabase
      .from("session_exercises")
      .select("*")
      .eq("session_id", sessionId)
      .eq("super_set_group", supersetId)
      .order("exercise_order");

    if (error) {
      console.error("Erreur lors du chargement des exercices:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les exercices",
        variant: "destructive",
      });
    } else {
      setExercises(data || []);
      const initialTimers: { [key: string]: number } = {};
      const initialRunning: { [key: string]: boolean } = {};

      (data || []).forEach((ex: any) => {
        initialTimers[ex.id] = 0;
        initialRunning[ex.id] = false;
      });
      // Charger les vidéos depuis la bibliothèque d'exercices
      const urls: { [key: string]: string } = {};
      for (const ex of data || []) {
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

      setTimers(initialTimers);
      setIsTimerRunning(initialRunning);
    }

    setLoading(false);
  };

  const parseRecuperationTime = (timeStr: string): number => {
    if (!timeStr) return 0;
    let totalSeconds = 0;
    const minMatch = timeStr.match(/(\d+)min/);
    const secMatch = timeStr.match(/(\d+)s/);
    if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60;
    if (secMatch) totalSeconds += parseInt(secMatch[1]);
    return totalSeconds;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startTimer = (exerciseId: string, recuperation: string) => {
    if (timerIntervals[exerciseId]) {
      clearInterval(timerIntervals[exerciseId]);
    }

    const targetSeconds = parseRecuperationTime(recuperation);
    setTimers({ ...timers, [exerciseId]: targetSeconds });
    setIsTimerRunning({ ...isTimerRunning, [exerciseId]: true });

    const interval = setInterval(() => {
      setTimers((prev) => {
        const newTime = prev[exerciseId] - 1;
        if (newTime <= 0) {
          clearInterval(interval);
          setIsTimerRunning((r) => ({ ...r, [exerciseId]: false }));
          return { ...prev, [exerciseId]: 0 };
        }
        return { ...prev, [exerciseId]: newTime };
      });
    }, 1000);

    setTimerIntervals({ ...timerIntervals, [exerciseId]: interval });
  };

  const pauseTimer = (exerciseId: string) => {
    if (timerIntervals[exerciseId]) {
      clearInterval(timerIntervals[exerciseId]);
      setIsTimerRunning({ ...isTimerRunning, [exerciseId]: false });
    }
  };

  const resetTimer = (exerciseId: string) => {
    if (timerIntervals[exerciseId]) {
      clearInterval(timerIntervals[exerciseId]);
    }
    setTimers({ ...timers, [exerciseId]: 0 });
    setIsTimerRunning({ ...isTimerRunning, [exerciseId]: false });
  };

  const incrementGlobalSet = () => {
    const maxSets = parseInt(exercises[0]?.series || "0");
    if (globalCompletedSets < maxSets) {
      setGlobalCompletedSets(globalCompletedSets + 1);
    }
  };

  const decrementGlobalSet = () => {
    if (globalCompletedSets > 0) {
      setGlobalCompletedSets(globalCompletedSets - 1);
    }
  };

  const handleValidateFeedback = async (rpe: string, comment: string) => {
    const rpeValue = rpe ? Number(rpe) : null;

    try {
      // Sauvegarder le même feedback pour chaque exercice du superset
      for (const exercise of exercises) {
        const { error } = await supabase
          .from("session_exercises")
          .update({
            sportif_rpe: rpeValue,
            sportif_comment: comment.trim() || null,
          })
          .eq("id", exercise.id);

        if (error) {
          console.error("Erreur lors de la sauvegarde pour l'exercice", exercise.id, error);
          toast({
            title: "Erreur",
            description: `Impossible de sauvegarder le retour: ${error.message}`,
            variant: "destructive",
          });
          throw error;
        }
      }

      // Nettoyer les données sauvegardées
      localStorage.removeItem(`superset-progress-${supersetId}`);

      setDialogOpen(false);
      
      // Afficher la célébration
      setShowCelebration(true);
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la sauvegarde",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleCelebrationComplete = () => {
    setShowCelebration(false);
    
    toast({
      title: "Retour enregistré",
      description: "Ton retour a été sauvegardé pour tous les exercices du superset",
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

  const maxSets = parseInt(exercises[0]?.series || "0");

  return (
    <div className="min-h-screen bg-background pb-4">
      <CelebrationOverlay 
        show={showCelebration}
        message="Superset terminé"
        onComplete={handleCelebrationComplete}
        type="exercise"
      />
      
      <ExerciseFeedbackDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onValidate={handleValidateFeedback}
        onCancel={handleCancelFeedback}
        exerciseName="ce superset"
        exerciseType="renfo"
      />

      {/* Header compact */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="p-2 flex justify-center">
          <Badge className="bg-orange-500 text-white">Superset</Badge>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Compteur de séries global */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Séries</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={decrementGlobalSet}
                  disabled={globalCompletedSets === 0}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="font-mono text-xl font-bold min-w-[60px] text-center">
                  {globalCompletedSets}/{maxSets}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={incrementGlobalSet}
                  disabled={globalCompletedSets >= maxSets}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exercices en vertical */}
        {exercises.map((exercise, index) => {
          const isLastExercise = index === exercises.length - 1;
          return (
            <div key={exercise.id} className="space-y-2">
              {/* Card Exercice - Mise en avant */}
              <Card className="border-2 border-primary/30 bg-card shadow-md">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* En-tête exercice */}
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-sm px-2 py-1">
                        {index + 1}
                      </Badge>
                      <div className="flex items-center gap-2 flex-1">
                        <h3 className="font-bold text-xl leading-tight">{exercise.exercice}</h3>
                        {videoUrls[exercise.id] && (
                          <a
                            href={videoUrls[exercise.id]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-yellow-400 hover:text-yellow-200 text-2xl"
                          >
                            🎥
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Détails exercice - Bien visible */}
                    <div className="grid grid-cols-2 gap-3">
                      {exercise.charge && (
                        <div className="bg-muted/30 rounded-md p-2">
                          <div className="text-xs text-muted-foreground uppercase">Charge</div>
                          <div className="text-2xl font-bold text-primary">{exercise.charge}</div>
                        </div>
                      )}
                      {exercise.reps && (
                        <div className="bg-muted/30 rounded-md p-2">
                          <div className="text-xs text-muted-foreground uppercase">Reps</div>
                          <div className="text-2xl font-bold text-primary">{exercise.reps}</div>
                        </div>
                      )}
                      {exercise.rpe && (
                        <div className="bg-muted/30 rounded-md p-2">
                          <div className="text-xs text-muted-foreground uppercase">RPE</div>
                          <div className="text-2xl font-bold text-primary">{exercise.rpe}</div>
                        </div>
                      )}
                      {exercise.tempo && (
                        <div className="bg-muted/30 rounded-md p-2">
                          <div className="text-xs text-muted-foreground uppercase">Tempo</div>
                          <div className="text-2xl font-bold text-primary">{exercise.tempo}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Minuteur visible et uniforme */}
              {exercise.recuperation && (
                <Card className="border border-muted-foreground/20 bg-muted/50">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1">
                        <Timer className="h-6 w-6 text-primary" />
                        <span className="text-sm font-medium">
                          {isLastExercise ? "Récup superset" : `Avant ex. ${index + 2}`}
                        </span>
                      </div>
                      <span className="font-mono text-xl font-bold">{formatTime(timers[exercise.id])}</span>
                      <div className="flex gap-1">
                        <Button
                          variant={isTimerRunning[exercise.id] ? "secondary" : "default"}
                          size="sm"
                          className="h-8 text-xs px-3"
                          onClick={() =>
                            isTimerRunning[exercise.id]
                              ? pauseTimer(exercise.id)
                              : startTimer(exercise.id, exercise.recuperation)
                          }
                        >
                          {isTimerRunning[exercise.id] ? "Pause" : "Start"}
                        </Button>
                        {timers[exercise.id] > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs px-2"
                            onClick={() => resetTimer(exercise.id)}
                          >
                            Reset
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          );
        })}

        {/* Bouton superset terminé */}
        <Button 
          onClick={() => setDialogOpen(true)}
          size="lg"
          className="w-full"
        >
          Superset terminé
        </Button>
      </div>
    </div>
  );
}
