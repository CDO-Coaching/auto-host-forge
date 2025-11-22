import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ChevronRight, Play, Square, CheckCircle2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ExerciseFeedbackDialog } from "@/components/ExerciseFeedbackDialog";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";
import { UniversalTimer } from "@/components/UniversalTimer";
import {
  formatCardioTime,
  formatCardioDistance,
  calculatePace,
  calculateCardioSessionDuration,
  formatCardioSessionDuration,
} from "@/lib/cardioCalculations";
import { CardioData } from "@/components/CardioStepBuilder";
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

export default function SeanceDetail() {
  const { weekId, sessionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionDuration, setSessionDuration] = useState<number>(0);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [selectedCardioExercise, setSelectedCardioExercise] = useState<any>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [athleteVma, setAthleteVma] = useState<number | null>(null);

  // Charger la VMA de l'athlète
  useEffect(() => {
    const loadVma = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("user_profiles").select("vma").eq("id", user.id).single();
        if (data?.vma) {
          setAthleteVma(data.vma);
        }
      }
    };
    loadVma();
  }, []);

  // --- Restaurer l'état du timer depuis localStorage ---
  useEffect(() => {
    const savedTimer = localStorage.getItem(`session_timer_${sessionId}`);
    if (savedTimer) {
      const { startTime, isActive } = JSON.parse(savedTimer);
      if (isActive) {
        setSessionStartTime(startTime);
        setIsSessionActive(true);

        // Recalcule le temps écoulé depuis le début réel
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setSessionDuration(elapsed);

        // Relance le timer
        const interval = setInterval(() => {
          const currentElapsed = Math.floor((Date.now() - startTime) / 1000);
          setSessionDuration(currentElapsed);

          // Arrêt automatique après 2 heures (7200 secondes)
          if (currentElapsed >= 7200) {
            clearInterval(interval);
            setTimerInterval(null);
            setIsSessionActive(false);
            localStorage.removeItem(`session_timer_${sessionId}`);

            // Enregistrer dans la base
            supabase
              .from("training_sessions")
              .update({
                duration_minutes: 120,
                completed_at: new Date().toISOString(),
              })
              .eq("id", sessionId)
              .then(() => {
                toast({
                  title: "Séance terminée automatiquement",
                  description: "La séance a duré 2 heures et a été arrêtée automatiquement.",
                });
              });
          }
        }, 1000);
        setTimerInterval(interval);
      }
    }
  }, [sessionId]);

  useEffect(() => {
    loadSessionDetail();
  }, [sessionId]);

  useEffect(() => {
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [timerInterval]);

  // --- Sauvegarder le timer dans localStorage ---
  useEffect(() => {
    if (isSessionActive && sessionStartTime) {
      localStorage.setItem(
        `session_timer_${sessionId}`,
        JSON.stringify({
          startTime: sessionStartTime,
          isActive: isSessionActive,
        }),
      );
    }
  }, [sessionStartTime, isSessionActive, sessionId]);

  // Fonction helper pour vérifier si un exercice est complété
  const isExerciseCompleted = (item: any) => {
    if (item.isSuperset) {
      return item.exercises.every((ex: any) => ex.sportif_rpe !== null);
    }
    return item.sportif_rpe !== null;
  };

  // Fonction pour trier les exercices
  const getSortedExercises = (exercisesList: any[]) => {
    // Vérifier si tous les exercices sont complétés
    const allCompleted = exercisesList.every(isExerciseCompleted);

    // Si tous complétés, retourner l'ordre d'origine
    if (allCompleted) {
      return [...exercisesList].sort((a: any, b: any) => {
        const orderA = a.isSuperset ? a.exercises[0].exercise_order : a.exercise_order;
        const orderB = b.isSuperset ? b.exercises[0].exercise_order : b.exercise_order;
        return orderA - orderB;
      });
    }

    // Sinon, mettre les non complétés en premier
    return [...exercisesList].sort((a: any, b: any) => {
      const aCompleted = isExerciseCompleted(a);
      const bCompleted = isExerciseCompleted(b);

      // Si l'un est complété et l'autre non, le non complété passe en premier
      if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1;
      }

      // Sinon, garder l'ordre d'origine
      const orderA = a.isSuperset ? a.exercises[0].exercise_order : a.exercise_order;
      const orderB = b.isSuperset ? b.exercises[0].exercise_order : b.exercise_order;
      return orderA - orderB;
    });
  };

  const loadSessionDetail = async () => {
    setLoading(true);

    const { data: sessionData, error: sessionError } = await supabase
      .from("training_sessions")
      .select(
        `
        *,
        session_exercises (*)
      `,
      )
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError || !sessionData) {
      console.error("Erreur lors du chargement de la séance:", sessionError);
      setLoading(false);
      return;
    }

    setSession(sessionData);

    // Regrouper les exercices par superset
    const exData = sessionData.session_exercises || [];
    const grouped: any[] = [];
    const processedGroups = new Set<string>();

    exData.forEach((exercise: any) => {
      if (exercise.super_set_group && !processedGroups.has(exercise.super_set_group)) {
        // C'est un superset
        processedGroups.add(exercise.super_set_group);
        const supersetExercises = exData.filter((ex: any) => ex.super_set_group === exercise.super_set_group);
        grouped.push({
          isSuperset: true,
          super_set_group: exercise.super_set_group,
          exercises: supersetExercises.sort((a: any, b: any) => a.exercise_order - b.exercise_order),
        });
      } else if (!exercise.super_set_group) {
        // Exercice classique
        grouped.push(exercise);
      }
    });

    const sorted = grouped.sort((a: any, b: any) => {
      const orderA = a.isSuperset ? a.exercises[0].exercise_order : a.exercise_order;
      const orderB = b.isSuperset ? b.exercises[0].exercise_order : b.exercise_order;
      return orderA - orderB;
    });

    setExercises(sorted);
    setLoading(false);
  };

  const startSession = () => {
    const startTime = Date.now();
    setSessionStartTime(startTime);
    setIsSessionActive(true);
    setSessionDuration(0);

    // Sauvegarder dans localStorage
    localStorage.setItem(`session_timer_${sessionId}`, JSON.stringify({ startTime, isActive: true }));

    // Démarrer le timer avec recalcul basé sur timestamp
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setSessionDuration(elapsed);

      // Arrêt automatique après 2 heures (7200 secondes)
      if (elapsed >= 7200) {
        clearInterval(interval);
        setTimerInterval(null);
        setIsSessionActive(false);
        localStorage.removeItem(`session_timer_${sessionId}`);

        // Enregistrer dans la base
        supabase
          .from("training_sessions")
          .update({
            duration_minutes: 120,
            completed_at: new Date().toISOString(),
          })
          .eq("id", sessionId)
          .then(() => {
            toast({
              title: "Séance terminée automatiquement",
              description: "La séance a duré 2 heures et a été arrêtée automatiquement.",
            });
          });
      }
    }, 1000);
    setTimerInterval(interval);
  };

  const endSession = async () => {
    if (timerInterval) {
      clearInterval(timerInterval);
    }

    setTimerInterval(null);
    setIsSessionActive(false);

    // Nettoyer le localStorage
    localStorage.removeItem(`session_timer_${sessionId}`);

    // Vérifier si TOUS les exercices sont terminés
    const allExercisesCompleted = exercises.every(isExerciseCompleted);

    // Si tous ne sont pas terminés, marquer les exercices non faits comme "skipped"
    if (!allExercisesCompleted) {
      const incompleteExerciseIds: string[] = [];
      
      exercises.forEach((item: any) => {
        if (item.isSuperset) {
          item.exercises.forEach((ex: any) => {
            if (ex.sportif_rpe === null) {
              incompleteExerciseIds.push(ex.id);
            }
          });
        } else {
          if (item.sportif_rpe === null) {
            incompleteExerciseIds.push(item.id);
          }
        }
      });

      // Marquer ces exercices comme skipped
      if (incompleteExerciseIds.length > 0) {
        const { error: skipError } = await supabase
          .from("session_exercises")
          .update({ skipped: true })
          .in("id", incompleteExerciseIds);

        if (skipError) {
          console.error("Erreur lors du marquage des exercices non faits:", skipError);
        }
      }
    }

    const { data, error, status } = await supabase
      .from("training_sessions")
      .update({
        duration_minutes: Math.max(1, Math.floor(sessionDuration / 60)),
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .select("id, duration_minutes, completed_at")
      .maybeSingle();

    if (error) {
      console.error("Erreur lors de l'enregistrement de la durée:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer la durée de la séance",
        variant: "destructive",
      });
      return;
    }

    if (allExercisesCompleted) {
      setShowCelebration(true);
    } else {
      toast({
        title: "Séance terminée",
        description: `Durée: ${formatDuration(sessionDuration)}`,
      });
      navigate("/sportif/seances");
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const handleCelebrationComplete = () => {
    setShowCelebration(false);
    toast({
      title: "Bravo !",
      description: "Séance complétée avec succès !",
    });
    navigate("/sportif/seances");
  };

  const handleCardioClick = (exercise: any) => {
    setSelectedCardioExercise(exercise);
    setFeedbackDialogOpen(true);
  };

  const handleCardioFeedback = async (rpe: string, comment: string) => {
    if (!selectedCardioExercise) return;

    const { error } = await supabase
      .from("session_exercises")
      .update({
        sportif_rpe: rpe ? Number(rpe) : null,
        sportif_comment: comment || null,
        sportif_feedback_at: new Date().toISOString(),
      })
      .eq("id", selectedCardioExercise.id);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer ton retour",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Retour enregistré !",
      description: "Ton RPE a bien été sauvegardé",
    });

    setFeedbackDialogOpen(false);
    setSelectedCardioExercise(null);
    loadSessionDetail();
  };

  const handleCancelCardioFeedback = () => {
    setFeedbackDialogOpen(false);
    setSelectedCardioExercise(null);
  };

  const handleInvalidateSession = async () => {
    // Récupérer tous les IDs des exercices de la séance
    const exerciseIds = exercises.flatMap((item: any) => {
      if (item.isSuperset) {
        return item.exercises.map((ex: any) => ex.id);
      }
      return [item.id];
    });

    // Réinitialiser tous les feedbacks à null et skipped à false
    const { error } = await supabase
      .from("session_exercises")
      .update({
        sportif_rpe: null,
        sportif_comment: null,
        sportif_feedback_at: null,
        skipped: false,
      })
      .in("id", exerciseIds);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'invalider la séance",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Séance invalidée",
      description: "La séance a été remise à zéro",
    });

    // Recharger les données
    loadSessionDetail();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen p-4">
        <Button variant="ghost" onClick={() => navigate("/sportif/seances")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <p className="text-center text-muted-foreground mt-8">Séance introuvable</p>
      </div>
    );
  }

  // Check if all exercises are completed
  const allCompleted = exercises.every(isExerciseCompleted);

  // Trier les exercices en fonction de leur état de complétion
  const sortedExercises = getSortedExercises(exercises);

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalTimer />
      <CelebrationOverlay
        show={showCelebration}
        message={session?.name || ""}
        onComplete={handleCelebrationComplete}
        type="session"
      />

      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/sportif/seances")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{session.name}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="outline">{exercises.length} exercices</Badge>
            {isSessionActive && (
              <Badge variant="secondary" className="bg-green-600/20 text-green-600 border-green-600/30">
                {formatDuration(sessionDuration)}
              </Badge>
            )}
            {allCompleted && (
              <Badge variant="outline" className="border-green-600 text-green-600">
                Séance terminée
              </Badge>
            )}
          </div>
        </div>

        {!allCompleted ? (
          <div className="flex gap-2">
            {!isSessionActive ? (
              <Button onClick={startSession} className="flex-1" size="lg">
                <Play className="h-4 w-4 mr-2" />
                Démarrer la séance
              </Button>
            ) : (
              <Button onClick={endSession} variant="destructive" className="flex-1" size="lg">
                <Square className="h-4 w-4 mr-2" />
                Terminer la séance
              </Button>
            )}
          </div>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="lg" className="w-full">
                <RotateCcw className="h-4 w-4 mr-2" />
                Invalider la séance
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Invalider cette séance ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action va supprimer tous tes retours (RPE et commentaires) pour cette séance. Tu pourras la
                  refaire comme si tu ne l'avais jamais complétée.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleInvalidateSession}>Confirmer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <div className="space-y-2">
          {sortedExercises.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">Aucun exercice pour cette séance</p>
              </CardContent>
            </Card>
          ) : (
            sortedExercises.map((item, index) => {
              if (item.isSuperset) {
                const isCompleted = isExerciseCompleted(item);

                return (
                  <Card
                    key={item.super_set_group}
                    className={`${allCompleted ? "" : "cursor-pointer hover:border-primary"} transition-colors border-2 ${
                      isCompleted ? "border-green-500/50 bg-green-500/5" : "border-orange-500/50 bg-orange-500/5"
                    }`}
                    onClick={
                      allCompleted
                        ? undefined
                        : () => navigate(`/sportif/superset/${sessionId}/${item.super_set_group}`)
                    }
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge className={isCompleted ? "bg-green-600 text-white" : "bg-orange-500 text-white"}>
                              Superset
                            </Badge>
                            {isCompleted && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">{item.exercises.length} exercices</p>
                        </div>
                        {!allCompleted && <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                      </div>

                      <div className={`space-y-2 ${allCompleted ? "mt-4 border-t pt-3" : ""}`}>
                        {item.exercises.map((ex: any, exIndex: number) => (
                          <div
                            key={exIndex}
                            className={allCompleted ? "bg-muted/30 rounded-lg p-3 space-y-2" : "space-y-1"}
                          >
                            <p className={`${allCompleted ? "font-medium" : "text-sm text-muted-foreground"}`}>
                              {!allCompleted && `${exIndex + 1}. `}
                              {ex.exercice}
                            </p>

                            {allCompleted && (
                              <div className="flex gap-2 flex-wrap">
                                {ex.series && (
                                  <Badge variant="outline" className="text-xs">
                                    {ex.series} séries
                                  </Badge>
                                )}
                                {ex.reps && (
                                  <Badge variant="outline" className="text-xs">
                                    {ex.reps} reps{ex.per_side ? " (par côté)" : ""}
                                  </Badge>
                                )}
                                {ex.charge && (
                                  <Badge variant="outline" className="text-xs">
                                    {ex.charge}
                                  </Badge>
                                )}
                                {ex.rpe && (
                                  <Badge variant="outline" className="text-xs">
                                    RPE prescrit: {ex.rpe}
                                  </Badge>
                                )}
                                {ex.tempo && (
                                  <Badge variant="outline" className="text-xs">
                                    Tempo: {ex.tempo}
                                  </Badge>
                                )}
                                {ex.recuperation && (
                                  <Badge variant="outline" className="text-xs">
                                    Récup: {ex.recuperation}
                                  </Badge>
                                )}
                              </div>
                            )}

                            {isCompleted && allCompleted && (
                              <>
                                <div className="flex items-center gap-2 text-xs flex-wrap border-t pt-2">
                                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                                    RPE ressenti: {ex.sportif_rpe || "-"}
                                  </Badge>
                                  {ex.sportif_feedback_at && (
                                    <span className="text-muted-foreground">
                                      {new Date(ex.sportif_feedback_at).toLocaleDateString("fr-FR", {
                                        day: "2-digit",
                                        month: "2-digit",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  )}
                                </div>
                                {ex.sportif_comment && (
                                  <p className="text-xs text-muted-foreground italic">💬 {ex.sportif_comment}</p>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              } else {
                const isCompleted = isExerciseCompleted(item);
                const isCardio = item.cardio_sport || item.cardio_content || item.cardio_pace;

                return (
                  <Card
                    key={item.id}
                    className={`${allCompleted ? "" : "cursor-pointer hover:border-primary"} transition-colors border-2 ${
                      isCompleted ? "border-green-500/50 bg-green-500/5" : ""
                    }`}
                    onClick={
                      allCompleted
                        ? undefined
                        : isCardio
                          ? () => handleCardioClick(item)
                          : () => navigate(`/sportif/exercice/${item.id}`)
                    }
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {isCompleted && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                              <p className="font-semibold text-lg">{item.exercice}</p>
                            </div>
                            {!isCardio && (
                              <div className="flex gap-2 flex-wrap">
                                {item.series && (
                                  <Badge variant="outline" className="text-xs">
                                    {item.series} séries
                                  </Badge>
                                )}
                                {item.reps && (
                                  <Badge variant="outline" className="text-xs">
                                    {item.reps} reps{item.per_side ? " (par côté)" : ""}
                                  </Badge>
                                )}
                                {item.charge && (
                                  <Badge variant="outline" className="text-xs">
                                    {item.charge}
                                  </Badge>
                                )}
                                {item.rpe && (
                                  <Badge variant="outline" className="text-xs">
                                    RPE prescrit: {item.rpe}
                                  </Badge>
                                )}
                                {item.tempo && (
                                  <Badge variant="outline" className="text-xs">
                                    Tempo: {item.tempo}
                                  </Badge>
                                )}
                                {item.recuperation && (
                                  <Badge variant="outline" className="text-xs">
                                    Récup: {item.recuperation}
                                  </Badge>
                                )}
                              </div>
                            )}
                            {isCardio && (
                              <div className="space-y-3">
                                {item.cardio_sport && (
                                  <Badge variant="outline" className="text-xs">
                                    {item.cardio_sport}
                                  </Badge>
                                )}
                                {item.cardio_content &&
                                  (() => {
                                    try {
                                      const cardioData: CardioData = JSON.parse(item.cardio_content);
                                      const steps = cardioData.steps || [];
                                      const blocks = cardioData.blocks || [];
                                      const estimatedDuration = calculateCardioSessionDuration(cardioData, athleteVma);

                                      return (
                                        <div className="space-y-2 mt-2">
                                          {estimatedDuration > 0 && (
                                            <Badge variant="secondary" className="text-xs">
                                              Durée estimée: {formatCardioSessionDuration(estimatedDuration)}
                                            </Badge>
                                          )}
                                          {blocks.map((block: any) => {
                                            const blockSteps = steps.filter((s: any) => s.block_id === block.id);
                                            return (
                                              <div key={block.id} className="border rounded-lg p-3 bg-muted/30">
                                                <div className="font-medium text-sm mb-2 text-primary">
                                                  Bloc {block.name} - {block.repetitions}x
                                                </div>
                                                <div className="space-y-1.5">
                                                  {blockSteps.map((step: any) => {
                                                    const pace = calculatePace(step.vma_percentage, athleteVma);
                                                    return (
                                                      <div
                                                        key={step.id}
                                                        className="text-xs space-y-1 pl-2 border-l-2 border-primary/30"
                                                      >
                                                        <div className="flex gap-2 flex-wrap items-center">
                                                          <span className="font-medium capitalize">
                                                            {step.movement_type}
                                                          </span>
                                                          <span className="text-muted-foreground">•</span>
                                                          {step.effort_type === "duration" ? (
                                                            <span>{formatCardioTime(step.duration)}</span>
                                                          ) : (
                                                            <span>{formatCardioDistance(step.distance)}</span>
                                                          )}
                                                          {pace && (
                                                            <>
                                                              <span className="text-muted-foreground">•</span>
                                                              <span className="text-primary font-medium">{pace}</span>
                                                            </>
                                                          )}
                                                          {step.target_heart_rate && (
                                                            <>
                                                              <span className="text-muted-foreground">•</span>
                                                              <span>FC: {step.target_heart_rate}</span>
                                                            </>
                                                          )}
                                                        </div>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            );
                                          })}
                                          {steps
                                            .filter((s: any) => !s.block_id)
                                            .map((step: any) => {
                                              const pace = calculatePace(step.vma_percentage, athleteVma);
                                              return (
                                                <div
                                                  key={step.id}
                                                  className="text-xs space-y-1 border-l-2 border-border pl-2"
                                                >
                                                  <div className="flex gap-2 flex-wrap items-center">
                                                    <span className="font-medium capitalize">{step.movement_type}</span>
                                                    <span className="text-muted-foreground">•</span>
                                                    {step.effort_type === "duration" ? (
                                                      <span>{formatCardioTime(step.duration)}</span>
                                                    ) : (
                                                      <span>{formatCardioDistance(step.distance)}</span>
                                                    )}
                                                    {pace && (
                                                      <>
                                                        <span className="text-muted-foreground">•</span>
                                                        <span className="text-primary font-medium">{pace}</span>
                                                      </>
                                                    )}
                                                    {step.target_heart_rate && (
                                                      <>
                                                        <span className="text-muted-foreground">•</span>
                                                        <span>FC: {step.target_heart_rate}</span>
                                                      </>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                        </div>
                                      );
                                    } catch (e) {
                                      return (
                                        <p className="text-sm text-muted-foreground mt-2">{item.cardio_content}</p>
                                      );
                                    }
                                  })()}
                                {item.cardio_pace && (
                                  <Badge variant="outline" className="text-xs">
                                    {item.cardio_pace}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                          {!allCompleted && <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                        </div>

                        {isCompleted && allCompleted && (
                          <div className="border-t pt-3 space-y-1">
                            <div className="flex items-center gap-2 text-xs flex-wrap">
                              <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                                RPE ressenti: {item.sportif_rpe || "-"}
                              </Badge>
                              {item.sportif_feedback_at && (
                                <span className="text-muted-foreground">
                                  {new Date(item.sportif_feedback_at).toLocaleDateString("fr-FR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                            </div>
                            {item.sportif_comment && (
                              <p className="text-xs text-muted-foreground italic">💬 {item.sportif_comment}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              }
            })
          )}
        </div>
      </div>

      <ExerciseFeedbackDialog
        open={feedbackDialogOpen}
        onOpenChange={setFeedbackDialogOpen}
        exerciseName={selectedCardioExercise?.exercice || ""}
        onValidate={handleCardioFeedback}
        onCancel={handleCancelCardioFeedback}
      />
    </div>
  );
}
