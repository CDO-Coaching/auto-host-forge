import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function SeanceDetail() {
  const { weekId, sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessionDetail();
  }, [sessionId]);

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
          <Badge variant="outline" className="mt-2">
            {exercises.length} exercices
          </Badge>
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
