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
  const [completedSets, setCompletedSets] = useState<{ [key: string]: number }>({});
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
      const initialSets: { [key: string]: number } = {};
      const initialTimers: { [key: string]: number } = {};
      const initialRunning: { [key: string]: boolean } = {};
      const initialFeedbacks: { [key: string]: { rpe: string; comments: string } } = {};
      
      (data || []).forEach((ex: any) => {
        initialSets[ex.id] = 0;
        initialTimers[ex.id] = 0;
        initialRunning[ex.id] = false;
        initialFeedbacks[ex.id] = {
          rpe: ex.rpe_sportif || "",
          comments: ex.commentaires_sportif || "",
        };
      });
      
      setCompletedSets(initialSets);
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

  const incrementSet = (exerciseId: string) => {
    const exercise = exercises.find((e) => e.id === exerciseId);
    const maxSets = parseInt(exercise?.series || "0");
    if (completedSets[exerciseId] < maxSets) {
      setCompletedSets({ ...completedSets, [exerciseId]: completedSets[exerciseId] + 1 });
    }
  };

  const decrementSet = (exerciseId: string) => {
    if (completedSets[exerciseId] > 0) {
      setCompletedSets({ ...completedSets, [exerciseId]: completedSets[exerciseId] - 1 });
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour à la séance
        </Button>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Badge className="bg-orange-500 text-white text-lg px-3 py-1">
            Superset
          </Badge>
          <span className="text-muted-foreground">{exercises.length} exercices</span>
        </div>

        <div className="space-y-6">
          {exercises.map((exercise, index) => (
            <Card key={exercise.id} className="border-2">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{index + 1}</Badge>
                  <CardTitle className="text-xl">{exercise.exercice}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Informations de l'exercice */}
                <div className="grid grid-cols-2 gap-4">
                  {exercise.series && (
                    <div>
                      <Label className="text-muted-foreground">Séries</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => decrementSet(exercise.id)}
                          disabled={completedSets[exercise.id] === 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="font-bold text-lg min-w-[80px] text-center">
                          {completedSets[exercise.id]} / {exercise.series}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => incrementSet(exercise.id)}
                          disabled={completedSets[exercise.id] >= parseInt(exercise.series)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {exercise.recuperation && (
                    <div>
                      <Label className="text-muted-foreground">Récupération</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => isTimerRunning[exercise.id] 
                            ? pauseTimer(exercise.id) 
                            : startTimer(exercise.id, exercise.recuperation)}
                        >
                          <Timer className="h-4 w-4 mr-1" />
                          {isTimerRunning[exercise.id] ? "Pause" : "Start"}
                        </Button>
                        <span className="font-mono text-lg">
                          {formatTime(timers[exercise.id])}
                        </span>
                        {timers[exercise.id] > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resetTimer(exercise.id)}
                          >
                            Reset
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Autres infos */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {exercise.reps && (
                    <div>
                      <Label className="text-muted-foreground">Répétitions</Label>
                      <p className="font-medium">{exercise.reps}</p>
                    </div>
                  )}
                  {exercise.charge && (
                    <div>
                      <Label className="text-muted-foreground">Charge</Label>
                      <p className="font-medium">{exercise.charge}</p>
                    </div>
                  )}
                  {exercise.rpe && (
                    <div>
                      <Label className="text-muted-foreground">RPE Coach</Label>
                      <p className="font-medium">{exercise.rpe}</p>
                    </div>
                  )}
                  {exercise.tempo && (
                    <div>
                      <Label className="text-muted-foreground">Tempo</Label>
                      <p className="font-medium">{exercise.tempo}</p>
                    </div>
                  )}
                </div>

                {exercise.commentaires_coach && (
                  <div>
                    <Label className="text-muted-foreground">Commentaires du coach</Label>
                    <p className="text-sm mt-1 p-2 bg-muted rounded-md">
                      {exercise.commentaires_coach}
                    </p>
                  </div>
                )}

                {/* Retours sportif */}
                <div className="space-y-3 pt-4 border-t">
                  <Label>Ton retour</Label>
                  <div>
                    <Label htmlFor={`rpe-${exercise.id}`} className="text-sm text-muted-foreground">
                      RPE ressenti (0-10)
                    </Label>
                    <Input
                      id={`rpe-${exercise.id}`}
                      type="number"
                      min="0"
                      max="10"
                      placeholder="Ex: 8"
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
                    <Label htmlFor={`comments-${exercise.id}`} className="text-sm text-muted-foreground">
                      Commentaires
                    </Label>
                    <Textarea
                      id={`comments-${exercise.id}`}
                      placeholder="Comment s'est passé cet exercice ?"
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
                      rows={3}
                    />
                  </div>
                  <Button
                    onClick={() => saveFeedback(exercise.id)}
                    className="w-full"
                  >
                    Enregistrer mon retour
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
