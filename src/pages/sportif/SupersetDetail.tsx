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
  const [feedbacks, setFeedbacks] = useState<{ [key: string]: { rpe: string; comments: string } }>({});

  useEffect(() => {
    loadSupersetExercises();
    return () => {
      Object.values(timerIntervals).forEach(clearInterval);
    };
  }, [supersetId]);

  const loadSupersetExercises = async () => {
    setLoading(true);
    
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
      const initialFeedbacks: { [key: string]: { rpe: string; comments: string } } = {};
      
      (data || []).forEach((ex: any) => {
        initialTimers[ex.id] = 0;
        initialRunning[ex.id] = false;
        initialFeedbacks[ex.id] = {
          rpe: ex.rpe_sportif || "",
          comments: ex.commentaires_sportif || "",
        };
      });
      
      setTimers(initialTimers);
      setIsTimerRunning(initialRunning);
      setFeedbacks(initialFeedbacks);
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

  const saveFeedback = async (exerciseId: string) => {
    const feedback = feedbacks[exerciseId];
    const rpeValue = feedback.rpe.trim();

    if (rpeValue && (isNaN(Number(rpeValue)) || Number(rpeValue) < 0 || Number(rpeValue) > 10)) {
      toast({
        title: "RPE invalide",
        description: "Le RPE doit être un nombre entre 0 et 10",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("session_exercises")
      .update({
        rpe_sportif: rpeValue || null,
        commentaires_sportif: feedback.comments || null,
      })
      .eq("id", exerciseId);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le retour",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Retour enregistré",
        description: "Tes commentaires ont été sauvegardés",
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

                  {/* Retour sportif inline */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor={`rpe-${exercise.id}`} className="text-[10px] text-muted-foreground">
                        Ton RPE
                      </Label>
                      <Input
                        id={`rpe-${exercise.id}`}
                        type="number"
                        min="0"
                        max="10"
                        placeholder="8"
                        className="h-8 text-sm"
                        value={feedbacks[exercise.id]?.rpe || ""}
                        onChange={(e) =>
                          setFeedbacks({
                            ...feedbacks,
                            [exercise.id]: {
                              ...feedbacks[exercise.id],
                              rpe: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`comments-${exercise.id}`} className="text-[10px] text-muted-foreground">
                        Ressenti
                      </Label>
                      <Input
                        id={`comments-${exercise.id}`}
                        placeholder="..."
                        className="h-8 text-sm"
                        value={feedbacks[exercise.id]?.comments || ""}
                        onChange={(e) =>
                          setFeedbacks({
                            ...feedbacks,
                            [exercise.id]: {
                              ...feedbacks[exercise.id],
                              comments: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                  <Button
                    onClick={() => saveFeedback(exercise.id)}
                    size="sm"
                    className="w-full mt-2 h-7 text-xs"
                  >
                    Enregistrer
                  </Button>
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
      </div>
    </div>
  );
}
