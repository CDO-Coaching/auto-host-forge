import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ChevronRight, Play, Square, CheckCircle2, RotateCcw, Pencil, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ExerciseFeedbackDialog } from "@/components/ExerciseFeedbackDialog";
import { CardioFeedbackDialog } from "@/components/CardioFeedbackDialog";
import { SessionCompletionDialog } from "@/components/SessionCompletionDialog";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";
import { UniversalTimer } from "@/components/UniversalTimer";
import { AthleteFatigueAlert } from "@/components/AthleteFatigueAlert";
import {
  formatCardioTime,
  formatCardioDistance,
  calculatePace,
  calculateCardioSessionDuration,
  formatCardioSessionDuration,
  calculateCardioMetrics,
  formatPaceFromDecimal,
  parsePaceToDecimal,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RPEExplanationDialog } from "@/components/RPEExplanationDialog";
import { useWakeLock } from "@/hooks/useWakeLock";
import { exportSessionToPdf } from "@/lib/sessionPdfExport";

export default function SeanceDetail() {
  // Keep screen on during workout
  useWakeLock(true);
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
  const [cardioFeedbackDialogOpen, setCardioFeedbackDialogOpen] = useState(false);
  const [selectedCardioExercise, setSelectedCardioExercise] = useState<any>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [athleteVma, setAthleteVma] = useState<number | null>(null);
  
  // États pour l'édition des feedbacks
  const [editFeedbackDialogOpen, setEditFeedbackDialogOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<any>(null);
  const [editRpe, setEditRpe] = useState("");
  const [editComment, setEditComment] = useState("");
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  
  // État pour le dialog de validation de séance
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  
  // Date choisie pour la validation cardio (stockée lors du feedback)
  const [cardioSessionDate, setCardioSessionDate] = useState<Date | null>(null);

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
    
    // Recharger les données quand la page redevient visible (après modification par le coach)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadSessionDetail();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionId]);

  useEffect(() => {
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [timerInterval]);

  // Arrêter automatiquement le timer de séance quand tous les exercices sont validés
  // Fonctionne pour tous les types de séances (renfo, cardio, recup)
  useEffect(() => {
    // Ne pas déclencher si la séance est déjà complétée ou si le dialog est déjà ouvert
    if (session?.completed_at || completionDialogOpen) return;
    
    const allExercisesCompleted = exercises.every(isExerciseCompleted);
    
    // Pour les séances cardio: auto-compléter quand tous les exercices sont terminés (pas besoin de timer)
    const isCardio = session?.session_type === 'course' || session?.session_type === 'velo' || session?.session_type === 'natation' || exercises.some((ex: any) => ex.cardio_sport === 'course' || ex.cardio_sport === 'velo' || ex.cardio_sport === 'natation');
    
    if (allExercisesCompleted && exercises.length > 0) {
      if (isCardio) {
        // Pour cardio: auto-valider la séance directement
        handleAutoCompleteCardioSession();
      } else {
        // Pour renfo/recup: toujours ouvrir le dialog de validation (avec ou sans timer)
        setCompletionDialogOpen(true);
      }
    }
  }, [exercises, isSessionActive, session, completionDialogOpen]);

  // Auto-complétion pour les séances cardio
  const handleAutoCompleteCardioSession = async () => {
    // Vérifier que la séance n'est pas déjà complétée
    if (session?.completed_at) return;
    
    // Utiliser la date choisie dans le CardioFeedbackDialog, ou la date actuelle par défaut
    const completionDate = cardioSessionDate || new Date();
    
    const { error } = await supabase
      .from("training_sessions")
      .update({
        completed_at: completionDate.toISOString(),
      })
      .eq("id", sessionId);

    if (error) {
      console.error("Erreur lors de la validation auto de la séance cardio:", error);
      return;
    }

    setShowCelebration(true);
  };

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

  // Ouvre le dialog de validation
  const requestEndSession = () => {
    setCompletionDialogOpen(true);
  };

  // Validation finale avec date et RPE
  const handleSessionCompletion = async (data: { date: Date; rpe: number; comment: string; durationMinutes: number }) => {
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

    // Sauvegarder la séance avec la date choisie, la durée et le RPE global
    const { error } = await supabase
      .from("training_sessions")
      .update({
        duration_minutes: data.durationMinutes,
        completed_at: data.date.toISOString(),
        session_rpe: data.rpe || null,
        session_comment: data.comment || null,
      })
      .eq("id", sessionId);

    if (error) {
      console.error("Erreur lors de l'enregistrement de la durée:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer la séance",
        variant: "destructive",
      });
      return;
    }

    setCompletionDialogOpen(false);

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

  const handleCancelCompletion = () => {
    setCompletionDialogOpen(false);
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
    setCardioFeedbackDialogOpen(true);
  };

  const handleCardioFeedback = async (data: {
    rpe: string;
    comment: string;
    date: Date;
    actualDistance?: number;
    actualDuration?: number;
    actualPace?: string;
    actualAvgHeartRate?: number;
  }) => {
    if (!selectedCardioExercise) return;

    const { rpe, comment, actualDistance, actualDuration, actualPace, actualAvgHeartRate } = data;

    // Validation obligatoire du RPE pour les séances cardio
    if (!rpe || rpe.trim() === '') {
      toast({
        title: "RPE obligatoire",
        description: "Merci de remplir un RPE pour valider l'exercice",
        variant: "destructive",
      });
      return;
    }

    const rpeNumber = Number(rpe);
    
    // Vérifier si c'est un nombre valide
    if (isNaN(rpeNumber)) {
      toast({
        title: "RPE invalide",
        description: "Le RPE doit être un chiffre entre 1 et 10 (pas de lettres ou caractères spéciaux)",
        variant: "destructive",
      });
      return;
    }

    // Vérifier si c'est un nombre entier (pas de décimales)
    if (!Number.isInteger(rpeNumber)) {
      toast({
        title: "RPE invalide",
        description: "Le RPE doit être un chiffre rond entre 1 et 10 (pas de virgule : 5.5, 7.2, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Vérifier la plage
    if (rpeNumber < 1 || rpeNumber > 10) {
      toast({
        title: "RPE invalide",
        description: "Le RPE doit être un chiffre entre 1 et 10 uniquement",
        variant: "destructive",
      });
      return;
    }

    const updateData: any = {
      sportif_rpe: rpeNumber,
      sportif_comment: comment || null,
      sportif_feedback_at: new Date().toISOString(),
    };

    // Ajouter les données optionnelles si présentes
    if (actualDistance !== undefined) {
      updateData.actual_distance_km = actualDistance;
    }
    if (actualDuration !== undefined) {
      updateData.actual_duration_minutes = actualDuration;
    }
    if (actualPace !== undefined) {
      updateData.actual_pace_min_per_km = actualPace;
    }
    if (actualAvgHeartRate !== undefined) {
      updateData.actual_avg_heart_rate = actualAvgHeartRate;
    }

    const { error } = await supabase
      .from("session_exercises")
      .update(updateData)
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
      title: "Exercice validé",
      description: "Ton retour a été enregistré",
    });

    // Stocker la date choisie pour l'utiliser lors de l'auto-complétion de la séance
    setCardioSessionDate(data.date);
    
    setCardioFeedbackDialogOpen(false);
    setSelectedCardioExercise(null);
    
    // Recharger les exercices pour voir la mise à jour
    await loadSessionDetail();
    
    // Vérifier si tous les exercices sont maintenant complétés
    // Le useEffect s'occupera d'ouvrir le dialog de complétion si nécessaire
  };

  const handleCancelCardioFeedback = () => {
    setCardioFeedbackDialogOpen(false);
    setSelectedCardioExercise(null);
  };

  // Fonctions pour l'édition des feedbacks
  const handleOpenEditFeedback = (exercise: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingExercise(exercise);
    setEditRpe(exercise.sportif_rpe?.toString() || "");
    setEditComment(exercise.sportif_comment || "");
    setEditFeedbackDialogOpen(true);
  };

  const handleSaveEditFeedback = async () => {
    if (!editingExercise) return;

    const rpeValue = editRpe.trim();
    
    if (rpeValue) {
      const rpeNumber = Number(rpeValue);
      
      if (isNaN(rpeNumber) || !Number.isInteger(rpeNumber) || rpeNumber < 1 || rpeNumber > 10) {
        toast({
          title: "RPE invalide",
          description: "Le RPE doit être un chiffre rond entre 1 et 10",
          variant: "destructive",
        });
        return;
      }
    }

    setIsEditSubmitting(true);
    try {
      const { error } = await supabase
        .from("session_exercises")
        .update({
          sportif_rpe: rpeValue ? parseInt(rpeValue) : null,
          sportif_comment: editComment.trim() || null,
          sportif_feedback_at: new Date().toISOString(),
        })
        .eq("id", editingExercise.id);

      if (error) throw error;

      toast({
        title: "Modifié !",
        description: "Ton retour a été mis à jour",
      });

      setEditFeedbackDialogOpen(false);
      setEditingExercise(null);
      loadSessionDetail();
    } catch (error) {
      console.error("Erreur lors de la modification:", error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier le retour",
        variant: "destructive",
      });
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleInvalidateSession = async () => {
    // Récupérer tous les IDs des exercices de la séance
    const exerciseIds = exercises.flatMap((item: any) => {
      if (item.isSuperset) {
        return item.exercises.map((ex: any) => ex.id);
      }
      return [item.id];
    });

    // Réinitialiser tous les feedbacks des exercices à null (comme si jamais faits)
    const { error: exerciseError } = await supabase
      .from("session_exercises")
      .update({
        sportif_rpe: null,
        sportif_comment: null,
        sportif_feedback_at: null,
        skipped: false,
        actual_distance_km: null,
        actual_duration_minutes: null,
        actual_pace_min_per_km: null,
        actual_avg_heart_rate: null,
      })
      .in("id", exerciseIds);

    if (exerciseError) {
      toast({
        title: "Erreur",
        description: "Impossible de réinitialiser les exercices de la séance",
        variant: "destructive",
      });
      return;
    }

    // Réinitialiser la séance (supprimer completed_at pour qu'elle redevienne "à faire")
    const { error: sessionError } = await supabase
      .from("training_sessions")
      .update({
        completed_at: null,
        session_rpe: null,
        session_comment: null,
        duration_minutes: null,
      })
      .eq("id", sessionId);

    if (sessionError) {
      toast({
        title: "Erreur",
        description: "Impossible de réinitialiser la séance",
        variant: "destructive",
      });
      return;
    }

    // Réinitialiser la date cardio stockée
    setCardioSessionDate(null);

    toast({
      title: "Séance réinitialisée",
      description: "La séance a été remise à zéro et est à nouveau disponible",
    });

    // Retourner à la liste des séances pour voir la séance réinitialisée
    navigate("/sportif/seances");
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

  // Vérifier si c'est une séance cardio (course, vélo, natation)
  const isCardioSession = session.session_type === 'course' || session.session_type === 'velo' || session.session_type === 'natation' || exercises.some((ex: any) => ex.cardio_sport === 'course' || ex.cardio_sport === 'velo' || ex.cardio_sport === 'natation');
  
  // Vérifier si c'est une séance de récup/mobilité
  const isRecupMobilitySession = session.session_type === 'recup';
  
  // Déterminer le type de session pour le dialog de complétion
  const getSessionType = (): "renfo" | "cardio" | "recup" => {
    if (isRecupMobilitySession) return "recup";
    if (isCardioSession) return "cardio";
    return "renfo";
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalTimer />
      <CelebrationOverlay
        show={showCelebration}
        message={session?.name || ""}
        onComplete={handleCelebrationComplete}
        type="session"
      />

      <div className="sticky top-0 z-10 bg-background border-b p-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/sportif/seances")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => exportSessionToPdf(session, athleteVma)}
          title="Télécharger la séance en PDF"
        >
          <Download className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Exporter</span>
        </Button>
      </div>

      <div className="p-4 space-y-4">
        <AthleteFatigueAlert />
        
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

        {/* Masquer les boutons pour les séances cardio pures */}
        {!allCompleted && !isCardioSession ? (
          <div className="flex gap-2">
            {!isSessionActive ? (
              <>
                <Button onClick={startSession} className="flex-1" size="lg">
                  <Play className="h-4 w-4 mr-2" />
                  Démarrer la séance
                </Button>
                <Button onClick={requestEndSession} variant="outline" size="lg">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Séance terminée
                </Button>
              </>
            ) : (
              <Button onClick={requestEndSession} variant="destructive" className="flex-1" size="lg">
                <Square className="h-4 w-4 mr-2" />
                Terminer la séance
              </Button>
            )}
          </div>
        ) : allCompleted ? (
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
        ) : null}

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
                                  ex.recuperation === "0s" ? (
                                    <Badge className="text-xs bg-amber-500/20 text-amber-600 border-amber-500/30">
                                      ⚡ Enchaîné
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs">
                                      Récup: {ex.recuperation}
                                    </Badge>
                                  )
                                )}
                              </div>
                            )}

                            {isCompleted && allCompleted && (
                              <>
                                <div className="flex items-center justify-between gap-2 border-t pt-2">
                                  <div className="flex items-center gap-2 text-xs flex-wrap flex-1">
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
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 flex-shrink-0"
                                    onClick={(e) => handleOpenEditFeedback(ex, e)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
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
                                  item.recuperation === "0s" ? (
                                    <Badge className="text-xs bg-amber-500/20 text-amber-600 border-amber-500/30">
                                      ⚡ Enchaîné
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs">
                                      Récup: {item.recuperation}
                                    </Badge>
                                  )
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
                                      const metrics = calculateCardioMetrics(cardioData, athleteVma);

                                      return (
                                        <div className="space-y-2 mt-2">
                                          <div className="flex flex-wrap gap-2">
                                            {estimatedDuration > 0 && (
                                              <Badge variant="secondary" className="text-xs">
                                                Durée estimée: {formatCardioSessionDuration(estimatedDuration)}
                                              </Badge>
                                            )}
                                            {metrics.totalDistanceKm > 0 && (
                                              <Badge variant="secondary" className="text-xs">
                                                Distance estimée: {formatCardioDistance(metrics.totalDistanceKm * 1000)}
                                              </Badge>
                                            )}
                                          </div>
                                          {(() => {
                                            const displayedBlocks = new Set();
                                            return steps.map((step: any, stepIndex: number) => {
                                              // Si le step est dans un bloc
                                              if (step.block_id) {
                                                // Si on a déjà affiché ce bloc, on le saute
                                                if (displayedBlocks.has(step.block_id)) {
                                                  return null;
                                                }
                                                
                                                // Sinon, on affiche le bloc entier
                                                displayedBlocks.add(step.block_id);
                                                const block = blocks.find((b: any) => b.id === step.block_id);
                                                if (!block) return null;
                                                
                                                const blockSteps = steps.filter((s: any) => s.block_id === step.block_id);
                                                return (
                                                  <div key={`block-${block.id}`} className="border rounded-lg p-3 bg-muted/30">
                                                    <div className="font-medium text-sm mb-2 text-primary">
                                                      Bloc répété - {block.repetitions}x
                                                    </div>
                                                    <div className="space-y-1.5">
                                                      {blockSteps.map((blockStep: any) => {
                                                        const pace = calculatePace(blockStep.vma_percentage, athleteVma);
                                                        return (
                                                          <div
                                                            key={blockStep.id}
                                                            className="text-xs space-y-1 pl-2 border-l-2 border-primary/30"
                                                          >
                                                            <div className="flex gap-2 flex-wrap items-center">
                                                              <span className="font-medium capitalize">
                                                                {blockStep.movement_type}
                                                              </span>
                                                              <span className="text-muted-foreground">•</span>
                                                              {blockStep.effort_type === "duration" ? (
                                                                <span>{formatCardioTime(blockStep.duration)}</span>
                                                              ) : (
                                                                <span>{formatCardioDistance(blockStep.distance)}</span>
                                                              )}
                                                              {pace && (
                                                                <>
                                                                  <span className="text-muted-foreground">•</span>
                                                                  <span className="text-primary font-medium">{pace}</span>
                                                                </>
                                                              )}
                                                              {blockStep.target_heart_rate && (
                                                                <>
                                                                  <span className="text-muted-foreground">•</span>
                                                                  <span>FC: {blockStep.target_heart_rate}</span>
                                                                </>
                                                              )}
                                                            </div>
                                                          </div>
                                                        );
                                                      })}
                                                    </div>
                                                  </div>
                                                );
                                              }
                                              
                                               // Sinon, c'est une étape individuelle
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
                                            });
                                          })()}
                                        </div>
                                      );
                                    } catch (e) {
                                      return (
                                        <p className="text-sm text-muted-foreground mt-2">{item.cardio_content}</p>
                                      );
                                    }
                                   })()}
                                {item.commentaire && (
                                  <div className="bg-background/50 p-2 rounded-md border border-border/50 mt-2">
                                    <span className="text-xs font-medium text-muted-foreground">Commentaire: </span>
                                    <p className="text-xs mt-1">{item.commentaire}</p>
                                  </div>
                                )}
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
                          <div className="border-t pt-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs flex-wrap flex-1">
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
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 flex-shrink-0"
                                onClick={(e) => handleOpenEditFeedback(item, e)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            {item.sportif_comment && (
                              <p className="text-xs text-muted-foreground italic">💬 {item.sportif_comment}</p>
                            )}
                            
                            {/* Données réelles saisies (pour séances cardio) */}
                            {(item.actual_distance_km || item.actual_duration_minutes || item.actual_pace_min_per_km || item.actual_avg_heart_rate) && (
                              <div className="bg-green-50 dark:bg-green-950/20 p-2 rounded-md border border-green-200 dark:border-green-800">
                                <div className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">Tes données de la séance</div>
                                <div className="flex gap-3 flex-wrap text-xs">
                                  {item.actual_distance_km && (
                                    <div>
                                      <span className="text-muted-foreground">Distance: </span>
                                      <span className="font-medium text-green-900 dark:text-green-100">{item.actual_distance_km} km</span>
                                    </div>
                                  )}
                                  {item.actual_duration_minutes && (
                                    <div>
                                      <span className="text-muted-foreground">Durée: </span>
                                      <span className="font-medium text-green-900 dark:text-green-100">{item.actual_duration_minutes} min</span>
                                    </div>
                                  )}
                                  {item.actual_pace_min_per_km && (
                                    <div>
                                      <span className="text-muted-foreground">Allure: </span>
                                      <span className="font-medium text-green-900 dark:text-green-100">
                                        {formatPaceFromDecimal(parsePaceToDecimal(item.actual_pace_min_per_km)) || `${item.actual_pace_min_per_km}`}
                                      </span>
                                    </div>
                                  )}
                                  {item.actual_avg_heart_rate && (
                                    <div>
                                      <span className="text-muted-foreground">FC moy: </span>
                                      <span className="font-medium text-green-900 dark:text-green-100">{item.actual_avg_heart_rate} bpm</span>
                                    </div>
                                  )}
                                </div>
                              </div>
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

      <CardioFeedbackDialog
        open={cardioFeedbackDialogOpen}
        onOpenChange={setCardioFeedbackDialogOpen}
        exerciseName={selectedCardioExercise?.exercice || ""}
        sessionName={session?.name}
        sportifId={session?.sportif_id}
        onValidate={handleCardioFeedback}
        onCancel={handleCancelCardioFeedback}
      />

      {/* Dialog d'édition des feedbacks */}
      <Dialog open={editFeedbackDialogOpen} onOpenChange={setEditFeedbackDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Modifier le retour</DialogTitle>
            <DialogDescription>
              {editingExercise?.exercice ? `Modifier ton retour pour ${editingExercise.exercice}` : "Modifier ton retour"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="edit-rpe">RPE ressenti (1-10)</Label>
                <RPEExplanationDialog />
              </div>
              <Input
                id="edit-rpe"
                type="number"
                min="1"
                max="10"
                placeholder="Ex: 8"
                value={editRpe}
                onChange={(e) => setEditRpe(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-comment">Commentaires</Label>
              <Textarea
                id="edit-comment"
                placeholder="Comment t'es-tu senti pendant l'exercice ?"
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setEditFeedbackDialogOpen(false)} 
              disabled={isEditSubmitting}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button 
              onClick={handleSaveEditFeedback} 
              disabled={isEditSubmitting}
              className="w-full sm:w-auto"
            >
              {isEditSubmitting ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de validation de séance */}
      <SessionCompletionDialog
        open={completionDialogOpen}
        onOpenChange={setCompletionDialogOpen}
        onValidate={handleSessionCompletion}
        onCancel={handleCancelCompletion}
        sessionName={session?.name}
        sessionType={getSessionType()}
        initialDurationSeconds={sessionDuration}
      />
    </div>
  );
}
