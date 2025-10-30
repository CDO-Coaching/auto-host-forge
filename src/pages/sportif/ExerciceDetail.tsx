import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Minus, Play, Pause, RotateCcw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export default function ExerciceDetail() {
  const { exerciceId } = useParams();
  const navigate = useNavigate();
  const [exercise, setExercise] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completedSets, setCompletedSets] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);

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
      .select("*")
      .eq("id", exerciceId)
      .single();

    if (error) {
      console.error("Erreur lors du chargement de l'exercice:", error);
    } else {
      setExercise(data);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="min-h-screen p-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
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
      <div className="py-3">
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p className="text-lg font-medium">{value}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* Compteur de séries */}
        {exercise.series && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Progression des séries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-4">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={decrementSet}
                  disabled={completedSets === 0}
                  className="h-12 w-12 rounded-full p-0"
                >
                  <Minus className="h-6 w-6" />
                </Button>
                
                <div className="text-center">
                  <div className="text-4xl font-bold">
                    {completedSets} / {exercise.series}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {completedSets === parseInt(exercise.series) ? "✓ Terminé !" : "séries complétées"}
                  </p>
                </div>
                
                <Button
                  size="lg"
                  onClick={incrementSet}
                  disabled={completedSets >= parseInt(exercise.series)}
                  className="h-12 w-12 rounded-full p-0"
                >
                  <Plus className="h-6 w-6" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chronomètre de récupération */}
        {exercise.recuperation && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Temps de récupération</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className={`text-5xl font-bold ${timeRemaining === 0 ? 'text-green-500' : ''}`}>
                  {formatTime(timeRemaining)}
                </div>
                <Badge variant="outline" className="mt-2">
                  Récup : {exercise.recuperation}
                </Badge>
              </div>
              
              <div className="flex gap-2 justify-center">
                {!isTimerRunning ? (
                  <Button
                    size="lg"
                    onClick={startTimer}
                    disabled={timeRemaining === 0}
                    className="flex-1"
                  >
                    <Play className="h-5 w-5 mr-2" />
                    Démarrer
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    onClick={pauseTimer}
                    variant="secondary"
                    className="flex-1"
                  >
                    <Pause className="h-5 w-5 mr-2" />
                    Pause
                  </Button>
                )}
                
                <Button
                  size="lg"
                  onClick={resetTimer}
                  variant="outline"
                >
                  <RotateCcw className="h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Détails de l'exercice */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{exercise.exercice}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <InfoItem label="Séries" value={exercise.series} />
            <Separator />
            
            <InfoItem label="Répétitions" value={exercise.reps} />
            <Separator />
            
            <InfoItem label="Charge" value={exercise.charge} />
            <Separator />
            
            <InfoItem label="Récupération" value={exercise.recuperation} />
            <Separator />
            
            <InfoItem label="RPE (effort perçu)" value={exercise.rpe} />
            <Separator />
            
            <InfoItem label="Tempo" value={exercise.tempo} />
            
            {exercise.commentaire && (
              <>
                <Separator />
                <div className="py-3">
                  <p className="text-sm text-muted-foreground mb-2">Notes du coach</p>
                  <p className="text-base leading-relaxed">{exercise.commentaire}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
