import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ChevronRight, Play, Square, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ExerciseFeedbackDialog } from "@/components/ExerciseFeedbackDialog";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";

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
      .single();

    if (sessionError) {
      console.error("Erreur lors du chargement de la séance:", sessionError);
    } else {
      setSession(sessionData);
      const sortedExercises =
        sessionData.session_exercises?.sort((a: any, b: any) => a.exercise_order - b.exercise_order) || [];

      // Debug: vérifier les groupes de super-set chargés
      try {
        console.log(
          "[SeanceDetail] session:",
          sessionId,
          "exercises:",
          sortedExercises.map((e: any) => ({ id: e.id, order: e.exercise_order, super_set_group: e.super_set_group })),
        );
      } catch {}

      // Grouper les exercices par superset
      const groupedExercises: any[] = [];
      const processedIds = new Set<string>();

      sortedExercises.forEach((exercise: any) => {
        if (processedIds.has(exercise.id)) return;

        if (exercise.super_set_group) {
          // Trouver tous les exercices du même superset
          const supersetExercises = sortedExercises.filter((e: any) => e.super_set_group === exercise.super_set_group);
          groupedExercises.push({
            isSuperset: true,
            super_set_group: exercise.super_set_group,
            exercises: supersetExercises,
          });
          supersetExercises.forEach((e: any) => processedIds.add(e.id));
        } else {
          groupedExercises.push({
            isSuperset: false,
            ...exercise,
          });
          processedIds.add(exercise.id);
        }
      });

      setExercises(groupedExercises);
    }

    setLoading(false);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const startSession = () => {
    const startTime = Date.now();
    setSessionStartTime(startTime);
    setIsSessionActive(true);
    setSessionDuration(0);

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

    toast({
      title: "Séance démarrée",
      description: "Bon entraînement !",
    });
  };

  const endSession = async () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    setIsSessionActive(false);
    
    // Nettoyer le localStorage
    localStorage.removeItem(`session_timer_${sessionId}`);

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
    } else {
      // Afficher la célébration
      setShowCelebration(true);
    }
  };
  
  const handleCelebrationComplete = () => {
    setShowCelebration(false);
    toast({
      title: "Séance terminée !",
      description: `Durée totale: ${formatDuration(sessionDuration)}`,
    });
  };
  
  // --- Arrêter automatiquement la séance quand tout est terminé ---
  useEffect(() => {
    if (isSessionActive && exercises.length > 0) {
      const allDone = exercises.every((ex: any) => {
        if (ex.isSuperset) {
          return ex.exercises.every((e: any) => e.sportif_rpe !== null);
        }
        return ex.sportif_rpe !== null;
      });

      if (allDone) {
        endSession();
      }
    }
  }, [exercises, isSessionActive]);

  const handleCardioComplete = (exercise: any) => {
    setSelectedCardioExercise(exercise);
    setFeedbackDialogOpen(true);
  };

  const handleValidateCardioFeedback = async (rpe: string, comment: string) => {
    if (!selectedCardioExercise) return;

    const { error } = await supabase
      .from("session_exercises")
      .update({
        sportif_rpe: rpe || null,
        sportif_comment: comment || null,
        sportif_feedback_at: new Date().toISOString(),
      })
      .eq("id", selectedCardioExercise.id);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le feedback",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Feedback enregistré",
        description: "Ton feedback a bien été enregistré",
      });
      setFeedbackDialogOpen(false);
      setSelectedCardioExercise(null);
      await loadSessionDetail();
    }
  };

  const handleCancelCardioFeedback = () => {
    setFeedbackDialogOpen(false);
    setSelectedCardioExercise(null);
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

  return (
    <div className="min-h-screen bg-background pb-20">
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
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline">{exercises.length} exercices</Badge>
            {isSessionActive && (
              <Badge variant="secondary" className="bg-green-600/20 text-green-600 border-green-600/30">
                {formatDuration(sessionDuration)}
              </Badge>
            )}
          </div>
        </div>

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

        <div className="space-y-2">
          {exercises.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">Aucun exercice pour cette séance</p>
              </CardContent>
            </Card>
          ) : (
            exercises.map((item, index) => {
              if (item.isSuperset) {
                // Vérifier si tous les exercices du superset sont terminés
                const isCompleted = item.exercises.every((ex: any) => ex.sportif_rpe !== null);

                return (
                  <Card
                    key={item.super_set_group}
                    className={`cursor-pointer hover:border-primary transition-colors border-2 ${
                      isCompleted ? "border-green-500/50 bg-green-500/5" : "border-orange-500/50 bg-orange-500/5"
                    }`}
                    onClick={() => navigate(`/sportif/superset/${sessionId}/${item.super_set_group}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge className={isCompleted ? "bg-green-600 text-white" : "bg-orange-500 text-white"}>
                              Superset
                            </Badge>
                            {isCompleted && (
                              <Badge variant="outline" className="border-green-600 text-green-600">
                                Terminé
                              </Badge>
                            )}
                            <span className="font-semibold">{item.exercises.length} exercices</span>
                          </div>
                          <div className="mt-2 space-y-1">
                            {item.exercises.map((ex: any, idx: number) => (
                              <div key={ex.id} className="text-sm text-muted-foreground">
                                {idx + 1}. {ex.exercice}
                              </div>
                            ))}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                );
              } else {
                // Vérifier si l'exercice est terminé
                const isCompleted = item.sportif_rpe !== null;
                const isCardio = item.cardio_sport || item.cardio_content || item.cardio_pace;

                // Affichage cardio en ligne
                if (isCardio) {
                  return (
                    <Card
                      key={item.id}
                      className={`${
                        isCompleted ? "border-green-500/30 bg-green-500/5" : ""
                      }`}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {index + 1}
                            </Badge>
                            <h3 className="font-semibold">{item.exercice}</h3>
                            {isCompleted && (
                              <Badge variant="outline" className="border-green-600 text-green-600 text-xs">
                                Terminé
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          {item.cardio_sport && (
                            <div>
                              <span className="font-medium text-muted-foreground">Sport: </span>
                              <span>{item.cardio_sport}</span>
                            </div>
                          )}
                          {item.cardio_content && (
                            <div>
                              <span className="font-medium text-muted-foreground">Contenu: </span>
                              <span className="whitespace-pre-wrap">{item.cardio_content}</span>
                            </div>
                          )}
                          {item.cardio_pace && (
                            <div>
                              <span className="font-medium text-muted-foreground">Allure: </span>
                              <span>{item.cardio_pace}</span>
                            </div>
                          )}
                        </div>

                        {!isCompleted && (
                          <Button 
                            onClick={() => handleCardioComplete(item)}
                            className="w-full"
                            size="lg"
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Exercice terminé
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                }

                // Affichage renfo classique
                return (
                  <Card
                    key={item.id}
                    className={`cursor-pointer hover:border-primary transition-colors ${
                      isCompleted ? "border-green-500/30 bg-green-500/5" : ""
                    }`}
                    onClick={() => navigate(`/sportif/exercice/${item.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {index + 1}
                            </Badge>
                            <h3 className="font-semibold">{item.exercice}</h3>
                            {isCompleted && (
                              <Badge variant="outline" className="border-green-600 text-green-600 text-xs">
                                Terminé
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-2 mt-2 text-sm text-muted-foreground">
                            {item.series && <span>{item.series} séries</span>}
                            {item.reps && <span>• {item.reps} reps</span>}
                            {item.charge && <span>• {item.charge}</span>}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
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
        onValidate={handleValidateCardioFeedback}
        onCancel={handleCancelCardioFeedback}
        exerciseName={selectedCardioExercise?.exercice}
        exerciseType="cardio"
      />
    </div>
  );
}
