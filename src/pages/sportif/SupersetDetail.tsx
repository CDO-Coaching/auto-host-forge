import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Timer, Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

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
  const [globalFeedback, setGlobalFeedback] = useState({ rpe: "", comments: "" });
  const [weekId, setWeekId] = useState<string | null>(null);

  useEffect(() => {
    loadSupersetExercises();
    return () => {
      Object.values(timerIntervals).forEach(clearInterval);
    };
  }, [supersetId]);

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
      
      // Charger le feedback du premier exercice comme feedback global
      if (data && data.length > 0) {
        setGlobalFeedback({
          rpe: data[0].sportif_rpe ? String(data[0].sportif_rpe) : "",
          comments: data[0].sportif_comment || "",
        });
      }
      
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

  const saveGlobalFeedback = async () => {
    const rpeValue = globalFeedback.rpe.trim();

    if (rpeValue && (isNaN(Number(rpeValue)) || Number(rpeValue) < 0 || Number(rpeValue) > 10)) {
      toast({
        title: "RPE invalide",
        description: "Le RPE doit être un nombre entre 0 et 10",
        variant: "destructive",
      });
      return;
    }

    try {
      // Sauvegarder le même feedback pour chaque exercice du superset
      for (const exercise of exercises) {
        const { error } = await supabase
          .from("session_exercises")
          .update({
            sportif_rpe: rpeValue ? Number(rpeValue) : null,
            sportif_comment: globalFeedback.comments || null,
          })
          .eq("id", exercise.id);

        if (error) {
          console.error("Erreur lors de la sauvegarde pour l'exercice", exercise.id, error);
          toast({
            title: "Erreur",
            description: `Impossible de sauvegarder le retour: ${error.message}`,
            variant: "destructive",
          });
          return;
        }
      }

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
          navigate('/sportif/seances');
        }
      }, 500);
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la sauvegarde",
        variant: "destructive",
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

  const maxSets = parseInt(exercises[0]?.series || "0");

  return (
    <div className="min-h-screen bg-background pb-4">
      {/* Header compact */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="p-2 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
          <Badge className="bg-orange-500 text-white">Superset</Badge>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Compteur de séries global compact */}
        <Card className="border-2 border-primary">
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
              {/* Card Exercice compact */}
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-xs">{index + 1}</Badge>
                        <h4 className="font-semibold text-sm leading-tight">{exercise.exercice}</h4>
                      </div>
                      <div className="grid grid-cols-3 gap-x-2 text-xs">
                        {exercise.charge && (
                          <div>
                            <span className="text-muted-foreground">Charge:</span>
                            <span className="ml-1 font-medium">{exercise.charge}</span>
                          </div>
                        )}
                        {exercise.reps && (
                          <div>
                            <span className="text-muted-foreground">Reps:</span>
                            <span className="ml-1 font-medium">{exercise.reps}</span>
                          </div>
                        )}
                        {exercise.rpe && (
                          <div>
                            <span className="text-muted-foreground">RPE:</span>
                            <span className="ml-1 font-medium">{exercise.rpe}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Minuteur compact */}
              {exercise.recuperation && (
                <Card className={isLastExercise ? 'border-2 border-primary bg-primary/5' : ''}>
                  <CardContent className="p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Timer className="h-4 w-4" />
                        <span className="text-[10px] text-muted-foreground">
                          {isLastExercise ? "Récup superset" : `Avant ex. ${index + 2}`}
                        </span>
                      </div>
                      <span className="font-mono text-lg font-bold">
                        {formatTime(timers[exercise.id])}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant={isTimerRunning[exercise.id] ? "secondary" : "default"}
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => isTimerRunning[exercise.id] 
                            ? pauseTimer(exercise.id) 
                            : startTimer(exercise.id, exercise.recuperation)}
                        >
                          {isTimerRunning[exercise.id] ? "Pause" : "Start"}
                        </Button>
                        {timers[exercise.id] > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2"
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

        {/* Feedback global en bas */}
        <Card className="border-2 border-primary">
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold">Ton retour sur le superset</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="global-rpe" className="text-xs text-muted-foreground">
                RPE ressenti (0-10)
              </Label>
              <Input
                id="global-rpe"
                type="number"
                min="0"
                max="10"
                placeholder="Ex: 8"
                className="h-9"
                value={globalFeedback.rpe}
                onChange={(e) =>
                  setGlobalFeedback({
                    ...globalFeedback,
                    rpe: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="global-comments" className="text-xs text-muted-foreground">
                Commentaires
              </Label>
              <Textarea
                id="global-comments"
                placeholder="Comment s'est passé ce superset ?"
                className="text-sm"
                value={globalFeedback.comments}
                onChange={(e) =>
                  setGlobalFeedback({
                    ...globalFeedback,
                    comments: e.target.value,
                  })
                }
                rows={3}
              />
            </div>
            <Button
              onClick={saveGlobalFeedback}
              className="w-full"
            >
              Enregistrer mon retour
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
