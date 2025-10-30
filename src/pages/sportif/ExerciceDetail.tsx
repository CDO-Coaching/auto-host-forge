import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Minus, Play, Pause, RotateCcw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function ExerciceDetail() {
  const { exerciceId } = useParams();
  const navigate = useNavigate();
  const [exercise, setExercise] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completedSets, setCompletedSets] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [sportifComment, setSportifComment] = useState("");
  const [sportifRpe, setSportifRpe] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadExerciseDetail();
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [exerciceId]);

  useEffect(() => {
    if (timeRemaining <= 0 && isTimerRunning) {
      setIsTimerRunning(false);
      if (timerInterval) clearInterval(timerInterval);
      // Jouer un son ou vibration ici si souhaité
    }
  }, [timeRemaining, isTimerRunning]);

  const loadExerciseDetail = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from("session_exercises")
      .select("*, training_session_id")
      .eq("id", exerciceId)
      .single();

    if (error) {
      console.error("Erreur lors du chargement de l'exercice:", error);
    } else {
      setExercise(data);
      setSessionId(data.training_session_id);
      setSportifComment(data.sportif_comment || "");
      setSportifRpe(data.sportif_rpe ? String(data.sportif_rpe) : "");
      // Initialiser le timer avec le temps de récupération
      if (data.recuperation) {
        setTimeRemaining(parseRecuperationTime(data.recuperation));
      }
    }
    
    setLoading(false);
  };

  const parseRecuperationTime = (recup: string): number => {
    // Parse "1min30s" => 90 secondes, "2min" => 120 secondes, etc.
    const minMatch = recup.match(/(\d+)min/);
    const secMatch = recup.match(/(\d+)s/);
    
    const minutes = minMatch ? parseInt(minMatch[1]) : 0;
    const seconds = secMatch ? parseInt(secMatch[1]) : 0;
    
    return minutes * 60 + seconds;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const incrementSet = () => {
    if (exercise?.series) {
      const totalSets = parseInt(exercise.series);
      if (completedSets < totalSets) {
        setCompletedSets(prev => prev + 1);
      }
    }
  };

  const decrementSet = () => {
    if (completedSets > 0) {
      setCompletedSets(prev => prev - 1);
    }
  };

  const startTimer = () => {
    if (!isTimerRunning && timeRemaining > 0) {
      setIsTimerRunning(true);
      const interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      setTimerInterval(interval);
    }
  };

  const pauseTimer = () => {
    setIsTimerRunning(false);
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
  };

  const resetTimer = () => {
    setIsTimerRunning(false);
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    if (exercise?.recuperation) {
      setTimeRemaining(parseRecuperationTime(exercise.recuperation));
    }
  };

  const saveSportifFeedback = async () => {
    const rpeValue = sportifRpe ? parseInt(sportifRpe) : null;
    
    if (rpeValue !== null && (rpeValue < 1 || rpeValue > 10)) {
      toast({
        title: "Erreur",
        description: "Le RPE doit être entre 1 et 10",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("session_exercises")
      .update({
        sportif_comment: sportifComment.trim() || null,
        sportif_rpe: rpeValue,
      })
      .eq("id", exerciceId);

    if (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder vos données",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Enregistré !",
        description: "Vos retours ont été sauvegardés",
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

  const handleBack = () => {
    if (sessionId) {
      navigate(`/sportif/seance/${sessionId}`);
    } else {
      navigate('/sportif/seances');
    }
  };

  if (!exercise) {
    return (
      <div className="min-h-screen p-4">
        <Button variant="ghost" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <p className="text-center text-muted-foreground mt-8">Exercice introuvable</p>
      </div>
    );
  }

  const InfoItem = ({ label, value }: { label: string; value: string | null }) => {
    if (!value) return null;
    
    return (
      <div className="py-2">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-base font-medium">{value}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b px-3 py-2">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
      </div>

      <div className="p-3 space-y-2 max-h-[calc(100vh-60px)] overflow-y-auto">
        {/* En-tête exercice */}
        <div className="text-center pb-2">
          <h1 className="text-xl font-bold">{exercise.exercice}</h1>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Compteur de séries */}
          {exercise.series && (
            <Card className="p-3">
              <div className="text-center space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Séries</p>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={decrementSet}
                    disabled={completedSets === 0}
                    className="h-8 w-8 rounded-full p-0"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  
                  <div className="text-2xl font-bold">
                    {completedSets}/{exercise.series}
                  </div>
                  
                  <Button
                    size="sm"
                    onClick={incrementSet}
                    disabled={completedSets >= parseInt(exercise.series)}
                    className="h-8 w-8 rounded-full p-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Chronomètre de récupération */}
          {exercise.recuperation && (
            <Card className="p-3">
              <div className="text-center space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Récup</p>
                <div className={`text-2xl font-bold ${timeRemaining === 0 ? 'text-green-500' : ''}`}>
                  {formatTime(timeRemaining)}
                </div>
                <div className="flex gap-1">
                  {!isTimerRunning ? (
                    <Button
                      size="sm"
                      onClick={startTimer}
                      disabled={timeRemaining === 0}
                      className="flex-1 h-7 text-xs"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Start
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={pauseTimer}
                      variant="secondary"
                      className="flex-1 h-7 text-xs"
                    >
                      <Pause className="h-3 w-3 mr-1" />
                      Pause
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={resetTimer}
                    variant="outline"
                    className="h-7 w-7 p-0"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Détails compacts */}
        <Card className="p-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {exercise.reps && (
              <div>
                <span className="text-muted-foreground">Reps:</span>
                <span className="ml-2 font-medium">{exercise.reps}</span>
              </div>
            )}
            {exercise.charge && (
              <div>
                <span className="text-muted-foreground">Charge:</span>
                <span className="ml-2 font-medium">{exercise.charge}</span>
              </div>
            )}
            {exercise.rpe && (
              <div>
                <span className="text-muted-foreground">RPE:</span>
                <span className="ml-2 font-medium">{exercise.rpe}</span>
              </div>
            )}
            {exercise.tempo && (
              <div>
                <span className="text-muted-foreground">Tempo:</span>
                <span className="ml-2 font-medium">{exercise.tempo}</span>
              </div>
            )}
          </div>
          
          {exercise.commentaire && (
            <>
              <Separator className="my-2" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Notes du coach</p>
                <p className="text-sm leading-relaxed">{exercise.commentaire}</p>
              </div>
            </>
          )}
        </Card>

        {/* Retours du sportif */}
        <Card className="p-3">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Mes retours</h3>
            
            <div className="space-y-2">
              <Label htmlFor="sportif-rpe" className="text-xs">
                RPE ressenti (1-10)
              </Label>
              <Input
                id="sportif-rpe"
                type="number"
                min="1"
                max="10"
                placeholder="Entre 1 et 10"
                value={sportifRpe}
                onChange={(e) => setSportifRpe(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sportif-comment" className="text-xs">
                Mon commentaire
              </Label>
              <Textarea
                id="sportif-comment"
                placeholder="Comment s'est passé cet exercice ?"
                value={sportifComment}
                onChange={(e) => setSportifComment(e.target.value)}
                className="min-h-[80px] text-sm"
              />
            </div>

            <Button 
              onClick={saveSportifFeedback}
              className="w-full"
              size="sm"
            >
              Enregistrer mes retours
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
