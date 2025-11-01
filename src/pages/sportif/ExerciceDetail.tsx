import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Minus, Play, Pause, RotateCcw, ExternalLink, Video, Zap, Weight, Repeat, Clock } from "lucide-react";
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
  const [weekId, setWeekId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
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
      .select("*")
      .eq("id", exerciceId)
      .single();

    if (error) {
      console.error("Erreur lors du chargement de l'exercice:", error);
    } else {
      setExercise(data);
      setSessionId(data.session_id);
      // Récupérer la semaine de la séance pour un retour fiable
      if (data.session_id) {
        const { data: sessionRow } = await supabase
          .from("training_sessions")
          .select("week_id")
          .eq("id", data.session_id)
          .maybeSingle();
        if (sessionRow?.week_id) setWeekId(sessionRow.week_id);
      }
      setSportifComment(data.sportif_comment || "");
      setSportifRpe(data.sportif_rpe ? String(data.sportif_rpe) : "");
      // Initialiser le timer avec le temps de récupération
      if (data.recuperation) {
        setTimeRemaining(parseRecuperationTime(data.recuperation));
      }
      
      // Récupérer la vidéo depuis la bibliothèque d'exercices
      if (data.exercice) {
        const { data: libraryData } = await supabase
          .from("exercise_library")
          .select("video_url")
          .eq("name", data.exercice)
          .maybeSingle();
        
        if (libraryData?.video_url) {
          setVideoUrl(libraryData.video_url);
        }
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
        sportif_feedback_at: new Date().toISOString(),
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
      
      // Rediriger vers la page de la séance
      if (weekId && sessionId) {
        setTimeout(() => {
          navigate(`/sportif/seance/${weekId}/${sessionId}`);
        }, 500);
      } else if (sessionId) {
        setTimeout(() => {
          navigate(`/sportif/seance/${sessionId}`);
        }, 500);
      }
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
    if (weekId && sessionId) {
      navigate(`/sportif/seance/${weekId}/${sessionId}`);
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

      <div className="h-[calc(100vh-60px)] overflow-hidden flex flex-col p-3">
        {/* En-tête exercice - compact */}
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold flex-1">{exercise.exercice}</h1>
          {videoUrl && (
            <Button 
              variant="ghost" 
              size="sm"
              className="h-8 px-2"
              asChild
            >
              <a href={videoUrl} target="_blank" rel="noopener noreferrer">
                <Video className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>

        {/* Grid principal - toutes les infos */}
        <div className="flex-1 grid grid-cols-2 gap-2 mb-2">
          {/* Compteur de séries */}
          {exercise.series && (
            <Card className="p-3 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 flex flex-col justify-center">
              <div className="text-center">
                <p className="text-xs font-semibold text-primary uppercase mb-1">Séries</p>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={decrementSet}
                    disabled={completedSets === 0}
                    className="h-8 w-8 rounded-full p-0"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  
                  <div className="text-3xl font-bold">
                    {completedSets}<span className="text-lg text-muted-foreground">/{exercise.series}</span>
                  </div>
                  
                  <Button
                    size="sm"
                    onClick={incrementSet}
                    disabled={completedSets >= parseInt(exercise.series)}
                    className="h-8 w-8 rounded-full p-0"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Chronomètre de récupération */}
          {exercise.recuperation && (
            <Card className="p-3 bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20 flex flex-col justify-center">
              <div className="text-center">
                <p className="text-xs font-semibold text-blue-600 uppercase mb-1">Récup</p>
                <div className={`text-3xl font-bold mb-2 ${timeRemaining === 0 ? 'text-green-500' : 'text-foreground'}`}>
                  {formatTime(timeRemaining)}
                </div>
                <div className="flex gap-1">
                  {!isTimerRunning ? (
                    <Button
                      size="sm"
                      onClick={startTimer}
                      disabled={timeRemaining === 0}
                      className="flex-1 h-7 text-xs px-1"
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={pauseTimer}
                      variant="secondary"
                      className="flex-1 h-7 text-xs px-1"
                    >
                      <Pause className="h-3 w-3" />
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

          {/* Détails de l'exercice - Cards compactes */}
          {exercise.reps && (
            <Card className="p-3 bg-gradient-to-br from-orange-500/5 to-orange-500/10 border-orange-500/20">
              <div className="flex flex-col items-center text-center">
                <Repeat className="h-5 w-5 text-orange-600 mb-1" />
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Reps</p>
                <p className="text-2xl font-bold text-foreground">{exercise.reps}</p>
              </div>
            </Card>
          )}
          
          {exercise.charge && (
            <Card className="p-3 bg-gradient-to-br from-red-500/5 to-red-500/10 border-red-500/20">
              <div className="flex flex-col items-center text-center">
                <Weight className="h-5 w-5 text-red-600 mb-1" />
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Charge</p>
                <p className="text-2xl font-bold text-foreground">{exercise.charge}</p>
              </div>
            </Card>
          )}
          
          {exercise.rpe && (
            <Card className="p-3 bg-gradient-to-br from-yellow-500/5 to-yellow-500/10 border-yellow-500/20">
              <div className="flex flex-col items-center text-center">
                <Zap className="h-5 w-5 text-yellow-600 mb-1" />
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">RPE</p>
                <p className="text-2xl font-bold text-foreground">{exercise.rpe}</p>
              </div>
            </Card>
          )}
          
          {exercise.tempo && (
            <Card className="p-3 bg-gradient-to-br from-purple-500/5 to-purple-500/10 border-purple-500/20">
              <div className="flex flex-col items-center text-center">
                <Clock className="h-5 w-5 text-purple-600 mb-1" />
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Tempo</p>
                <p className="text-2xl font-bold text-foreground">{exercise.tempo}</p>
              </div>
            </Card>
          )}
          
          {/* Notes du coach - Prend 2 colonnes si présent */}
          {exercise.commentaire && (
            <Card className="p-3 col-span-2">
              <div>
                <p className="text-xs font-semibold text-primary mb-1">📝 Notes</p>
                <p className="text-xs leading-relaxed line-clamp-2">{exercise.commentaire}</p>
              </div>
            </Card>
          )}
        </div>

        {/* Retours du sportif - compact et au bas */}
        <Card className="p-3">
          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <div className="space-y-1">
              <Label htmlFor="sportif-rpe" className="text-xs">RPE (1-10)</Label>
              <Input
                id="sportif-rpe"
                type="number"
                min="1"
                max="10"
                placeholder="1-10"
                value={sportifRpe}
                onChange={(e) => setSportifRpe(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <Button 
              onClick={saveSportifFeedback}
              size="sm"
              className="h-8"
            >
              Enregistrer
            </Button>
          </div>
          <div className="space-y-1 mt-2">
            <Label htmlFor="sportif-comment" className="text-xs">Commentaire</Label>
            <Textarea
              id="sportif-comment"
              placeholder="Ton retour..."
              value={sportifComment}
              onChange={(e) => setSportifComment(e.target.value)}
              className="min-h-[50px] text-sm resize-none"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
