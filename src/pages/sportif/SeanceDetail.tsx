import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ChevronRight, Play, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

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

  const loadSessionDetail = async () => {
    setLoading(true);
    
    const { data: sessionData, error: sessionError } = await supabase
      .from("training_sessions")
      .select(`
        *,
        session_exercises (*)
      `)
      .eq("id", sessionId)
      .single();

    if (sessionError) {
      console.error("Erreur lors du chargement de la séance:", sessionError);
    } else {
      setSession(sessionData);
      const sortedExercises = sessionData.session_exercises?.sort(
        (a: any, b: any) => a.exercise_order - b.exercise_order
      ) || [];
      setExercises(sortedExercises);
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
      setSessionDuration(Math.floor((Date.now() - startTime) / 1000));
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

    const { data, error, status } = await supabase
      .from("training_sessions")
      .update({ 
        duration_minutes: Math.max(1, Math.floor(sessionDuration / 60)),
        completed_at: new Date().toISOString()
      })
      .eq("id", sessionId)
      .select('id, duration_minutes, completed_at')
      .maybeSingle();

    if (error) {
      console.error("Erreur lors de l'enregistrement de la durée:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer la durée de la séance",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Séance terminée !",
        description: `Durée totale: ${formatDuration(sessionDuration)}`,
      });
    }
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
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <p className="text-center text-muted-foreground mt-8">Séance introuvable</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">{session.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline">
              {exercises.length} exercices
            </Badge>
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
                <p className="text-center text-muted-foreground">
                  Aucun exercice pour cette séance
                </p>
              </CardContent>
            </Card>
          ) : (
            exercises.map((exercise, index) => (
              <Card
                key={exercise.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => navigate(`/sportif/exercice/${exercise.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {index + 1}
                        </Badge>
                        <h3 className="font-semibold">{exercise.exercice}</h3>
                      </div>
                      <div className="flex gap-2 mt-2 text-sm text-muted-foreground">
                        {exercise.series && (
                          <span>{exercise.series} séries</span>
                        )}
                        {exercise.reps && (
                          <span>• {exercise.reps} reps</span>
                        )}
                        {exercise.charge && (
                          <span>• {exercise.charge}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
