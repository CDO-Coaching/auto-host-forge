import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Play, Square, CheckCircle2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";
import { SessionCompletionDialog } from "@/components/SessionCompletionDialog";
import { UniversalTimer } from "@/components/UniversalTimer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
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

export default function RecupDetail() {
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
  const [showCelebration, setShowCelebration] = useState(false);
  const [feedback, setFeedback] = useState<string>("");
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);

  useEffect(() => {
    const savedTimer = localStorage.getItem(`session_timer_${sessionId}`);
    if (savedTimer) {
      const { startTime, isActive } = JSON.parse(savedTimer);
      if (isActive) {
        setSessionStartTime(startTime);
        setIsSessionActive(true);
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setSessionDuration(elapsed);

        const interval = setInterval(() => {
          const currentElapsed = Math.floor((Date.now() - startTime) / 1000);
          setSessionDuration(currentElapsed);

          if (currentElapsed >= 7200) {
            clearInterval(interval);
            setTimerInterval(null);
            setIsSessionActive(false);
            localStorage.removeItem(`session_timer_${sessionId}`);
            
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
      .maybeSingle();

    if (sessionError || !sessionData) {
      console.error("Erreur lors du chargement de la séance:", sessionError);
      setLoading(false);
      return;
    }

    setSession(sessionData);
    setExercises(sessionData.session_exercises || []);
    setLoading(false);
  };

  const startSession = () => {
    const startTime = Date.now();
    setSessionStartTime(startTime);
    setIsSessionActive(true);
    setSessionDuration(0);

    localStorage.setItem(`session_timer_${sessionId}`, JSON.stringify({ startTime, isActive: true }));

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setSessionDuration(elapsed);

      if (elapsed >= 7200) {
        clearInterval(interval);
        setTimerInterval(null);
        setIsSessionActive(false);
        localStorage.removeItem(`session_timer_${sessionId}`);

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
  const handleSessionCompletion = async (data: { date: Date; rpe: number; comment: string }) => {
    if (timerInterval) {
      clearInterval(timerInterval);
    }

    setTimerInterval(null);
    setIsSessionActive(false);
    localStorage.removeItem(`session_timer_${sessionId}`);

    const { error } = await supabase
      .from("training_sessions")
      .update({
        duration_minutes: Math.max(1, Math.floor(sessionDuration / 60)),
        completed_at: data.date.toISOString(),
        session_rpe: data.rpe || null,
        session_comment: data.comment || null,
      })
      .eq("id", sessionId);

    if (error) {
      console.error("Erreur lors de l'enregistrement de la durée:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer la durée de la séance",
        variant: "destructive",
      });
      return;
    }

    // Enregistrer le feedback global s'il existe
    if (feedback.trim()) {
      await supabase
        .from("session_exercises")
        .update({ sportif_comment: feedback })
        .eq("session_id", sessionId);
    }

    setCompletionDialogOpen(false);
    setShowCelebration(true);
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

  const handleInvalidateSession = async () => {
    const { error } = await supabase
      .from("training_sessions")
      .update({
        duration_minutes: null,
        completed_at: null,
      })
      .eq("id", sessionId);

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

  const isCompleted = session.completed_at !== null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalTimer />
      <CelebrationOverlay
        show={showCelebration}
        message={session?.name || ""}
        onComplete={handleCelebrationComplete}
        type="session"
      />

      <div className="sticky top-0 z-10 bg-background border-b p-3 sm:p-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/sportif/seances")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
      </div>

      <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{session.name}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="outline" className="border-purple-500 text-purple-600 dark:text-purple-400">
              Récup/Mobilité
            </Badge>
            <Badge variant="outline">{exercises.length} exercices</Badge>
            {isSessionActive && (
              <Badge variant="secondary" className="bg-green-600/20 text-green-600 border-green-600/30">
                {formatDuration(sessionDuration)}
              </Badge>
            )}
            {isCompleted && (
              <Badge variant="outline" className="border-green-600 text-green-600">
                Séance terminée
              </Badge>
            )}
          </div>
        </div>

        {!isSessionActive && !isCompleted && (
          <Button onClick={startSession} className="w-full" size="lg">
            <Play className="h-5 w-5 mr-2" />
            Démarrer la séance
          </Button>
        )}

        {isSessionActive && !isCompleted && (
          <Button onClick={requestEndSession} variant="destructive" className="w-full" size="lg">
            <Square className="h-5 w-5 mr-2" />
            Terminer la séance
          </Button>
        )}

        {isCompleted && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <RotateCcw className="h-4 w-4 mr-2" />
                Invalider cette séance
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Invalider la séance ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action va réinitialiser la séance. Tu pourras la refaire.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleInvalidateSession}>Confirmer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Version mobile : Cards empilées */}
        <div className="block sm:hidden space-y-2">
          {exercises.map((exercise) => (
            <Card key={exercise.id}>
              <CardContent className="p-3">
                <div className="space-y-2">
                  <p className="font-semibold text-sm">{exercise.exercise_name}</p>
                  <div className="flex gap-2 text-xs">
                    <Badge variant="outline" className="text-xs">
                      {exercise.reps || "-"}
                    </Badge>
                    {exercise.coach_notes && (
                      <span className="text-muted-foreground line-clamp-1">{exercise.coach_notes}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Version desktop : Table */}
        <Card className="hidden sm:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exercice</TableHead>
                  <TableHead>Durée/Répétitions</TableHead>
                  <TableHead>Commentaire</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exercises.map((exercise) => (
                  <TableRow key={exercise.id}>
                    <TableCell className="font-medium">{exercise.exercise_name}</TableCell>
                    <TableCell>{exercise.reps || "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {exercise.coach_notes || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {isSessionActive && (
          <Card>
            <CardContent className="p-3 sm:p-4">
              <label className="text-sm font-medium mb-2 block">
                Tes retours sur cette séance (optionnel)
              </label>
              <Textarea
                placeholder="Comment te sens-tu après cette séance ? Des remarques ?"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>
        )}

        {isCompleted && session.session_exercises?.some((ex: any) => ex.sportif_comment) && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-3 sm:p-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Tes retours
              </h3>
              <p className="text-sm text-muted-foreground">
                {session.session_exercises.find((ex: any) => ex.sportif_comment)?.sportif_comment || "-"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog de validation de séance */}
      <SessionCompletionDialog
        open={completionDialogOpen}
        onOpenChange={setCompletionDialogOpen}
        onValidate={handleSessionCompletion}
        onCancel={handleCancelCompletion}
        sessionName={session?.name}
        sessionType="recup"
      />
    </div>
  );
}
