import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, User, Calendar, Mail, Plus, ChevronDown, ChevronRight, Trash2, Check, X, Copy, MessageSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { getWeek } from "date-fns";
import { ExerciseCombobox } from "@/components/ExerciseCombobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface AthleteProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  date_of_birth: string | null;
  gender: string | null;
  role: string;
}

interface Session {
  id: number;
  name: string;
  isExpanded: boolean;
  session_type: "renfo" | "cardio";
}

interface Exercise {
  id: number;
  exercice: string;
  recuperation: string;
  reps: string;
  series: string;
  charge: string;
  rpe: string;
  tempo: string;
  commentaire: string;
  cardio_sport?: "course" | "natation" | "vélo" | "yoga" | "hiit" | "";
  cardio_content?: string;
  cardio_pace?: string;
}

export default function ClientDetail() {
  const { athleteId } = useParams();
  const navigate = useNavigate();
  const [athlete, setAthlete] = useState<AthleteProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null);
  const [isValidated, setIsValidated] = useState(false);
  const [sessionExercises, setSessionExercises] = useState<Record<number, Exercise[]>>({});
  const [libraryExercises, setLibraryExercises] = useState<Array<{ id: string; name: string }>>([]);
  const [historicalWeeks, setHistoricalWeeks] = useState<any[]>([]);
  const [selectedHistoricalWeek, setSelectedHistoricalWeek] = useState<any>(null);
  const [historicalSessions, setHistoricalSessions] = useState<any[]>([]);
  const [expandedHistoricalSessionId, setExpandedHistoricalSessionId] = useState<string | null>(null);
  const [isEditingHistorical, setIsEditingHistorical] = useState(false);
  const [editedHistoricalExercises, setEditedHistoricalExercises] = useState<Record<string, any[]>>({});
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [selectedWeekToCopy, setSelectedWeekToCopy] = useState<string>("");
  const [weekToCopyData, setWeekToCopyData] = useState<any>(null);
  const [showLastWeekFeedback, setShowLastWeekFeedback] = useState(true);
  const [lastWeekData, setLastWeekData] = useState<any>(null);
  
  const currentWeekNumber = getWeek(new Date());

  const recuperationOptions = [
    { value: "30s", label: "30 secondes" },
    { value: "45s", label: "45 secondes" },
    { value: "1min", label: "1 minute" },
    { value: "1min30s", label: "1 min 30 sec" },
    { value: "2min", label: "2 minutes" },
    { value: "2min30s", label: "2 min 30 sec" },
    { value: "3min", label: "3 minutes" },
    { value: "3min30s", label: "3 min 30 sec" },
    { value: "4min", label: "4 minutes" },
    { value: "4min30s", label: "4 min 30 sec" },
    { value: "5min", label: "5 minutes" },
  ];

  useEffect(() => {
    loadAthleteData();
    loadLibraryExercises();
    loadHistoricalWeeks();
    loadLastWeekFeedback();
  }, [athleteId]);

  const loadLibraryExercises = async () => {
    const { data, error } = await supabase
      .from("exercise_library")
      .select("id, name")
      .order("name");

    if (error) {
      console.error("Erreur lors du chargement des exercices:", error);
    } else {
      setLibraryExercises(data || []);
    }
  };

  const loadHistoricalWeeks = async () => {
    if (!athleteId) return;
    
    const { data, error } = await supabase
      .from("training_weeks")
      .select("*")
      .eq("athlete_id", athleteId)
      .eq("validated", true)
      .order("year", { ascending: false })
      .order("week_number", { ascending: false });

    if (error) {
      console.error("Erreur lors du chargement de l'historique:", error);
    } else {
      setHistoricalWeeks(data || []);
    }
  };

  const loadLastWeekFeedback = async () => {
    if (!athleteId) return;
    
    const { data: lastWeek, error: weekError } = await supabase
      .from("training_weeks")
      .select("*")
      .eq("athlete_id", athleteId)
      .eq("validated", true)
      .order("year", { ascending: false })
      .order("week_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (weekError || !lastWeek) {
      console.error("Pas de semaine précédente:", weekError);
      return;
    }

    const { data: sessionsData, error: sessionsError } = await supabase
      .from("training_sessions")
      .select(`
        *,
        session_exercises (*)
      `)
      .eq("week_id", lastWeek.id)
      .order("session_number");

    if (!sessionsError && sessionsData) {
      setLastWeekData({
        week: lastWeek,
        sessions: sessionsData
      });
    }
  };

  const loadHistoricalWeekDetails = async (weekId: string) => {
    const { data: sessionsData, error: sessionsError } = await supabase
      .from("training_sessions")
      .select(`
        *,
        session_exercises (*)
      `)
      .eq("week_id", weekId)
      .order("session_number");

    if (sessionsError) {
      console.error("Erreur lors du chargement des séances:", sessionsError);
    } else {
      setHistoricalSessions(sessionsData || []);
      // Initialiser les exercices éditables
      const exercisesMap: Record<string, any[]> = {};
      sessionsData?.forEach(session => {
        if (session.session_exercises) {
          exercisesMap[session.id] = session.session_exercises.sort((a: any, b: any) => a.exercise_order - b.exercise_order);
        }
      });
      setEditedHistoricalExercises(exercisesMap);
    }
  };

  const handleSelectHistoricalWeek = async (weekId: string) => {
    const week = historicalWeeks.find(w => w.id === weekId);
    setSelectedHistoricalWeek(week);
    setIsEditingHistorical(false);
    await loadHistoricalWeekDetails(weekId);
  };

  const handleStartEditingHistorical = () => {
    setIsEditingHistorical(true);
  };

  const handleCancelEditingHistorical = async () => {
    setIsEditingHistorical(false);
    // Recharger les données originales
    if (selectedHistoricalWeek) {
      await loadHistoricalWeekDetails(selectedHistoricalWeek.id);
    }
  };

  const handleHistoricalExerciseChange = (sessionId: string, exerciseId: string, field: string, value: string) => {
    setEditedHistoricalExercises(prev => {
      const sessionExercises = prev[sessionId] || [];
      return {
        ...prev,
        [sessionId]: sessionExercises.map(ex => 
          ex.id === exerciseId ? { ...ex, [field]: value } : ex
        )
      };
    });
  };

  const handleSaveHistoricalChanges = async () => {
    try {
      // Mettre à jour tous les exercices modifiés
      for (const sessionId in editedHistoricalExercises) {
        const exercises = editedHistoricalExercises[sessionId];
        
        for (const exercise of exercises) {
          const { error } = await supabase
            .from("session_exercises")
            .update({
              exercice: exercise.exercice,
              recuperation: exercise.recuperation,
              reps: exercise.reps,
              series: exercise.series,
              charge: exercise.charge,
              rpe: exercise.rpe,
              tempo: exercise.tempo,
              commentaire: exercise.commentaire
            })
            .eq("id", exercise.id);

          if (error) throw error;
        }
      }

      setIsEditingHistorical(false);
      toast.success("Modifications enregistrées avec succès");
      
      // Recharger les données
      if (selectedHistoricalWeek) {
        await loadHistoricalWeekDetails(selectedHistoricalWeek.id);
      }
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde des modifications");
    }
  };


  const toggleHistoricalSession = (sessionId: string) => {
    if (expandedHistoricalSessionId === sessionId) {
      setExpandedHistoricalSessionId(null);
    } else {
      setExpandedHistoricalSessionId(sessionId);
    }
  };

  const loadAthleteData = async () => {
    if (!athleteId) return;

    setLoading(true);
    
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", athleteId)
      .single();

    if (error) {
      toast.error("Erreur lors du chargement des données");
      console.error(error);
      navigate("/coach/mes-clients");
    } else {
      setAthlete(data);
    }
    
    setLoading(false);
  };

  const [newSessionType, setNewSessionType] = useState<"renfo" | "cardio">("renfo");
  
  const handleCreateSession = () => {
    const nextSessionNumber = sessions.length + 1;
    const newSession: Session = {
      id: nextSessionNumber,
      name: newSessionType === "cardio" ? `Cardio ${nextSessionNumber}` : `Séance ${nextSessionNumber}`,
      isExpanded: false,
      session_type: newSessionType,
    };
    
    setSessions([...sessions, newSession]);
    setNewSessionType("renfo"); // Reset to default
    toast.success(`Séance créée`);
  };

  const toggleSession = (sessionId: number) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
    } else {
      setExpandedSessionId(sessionId);
    }
  };

  const handleDeleteSession = (sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedSessions = sessions
      .filter(s => s.id !== sessionId)
      .map((s, index) => ({
        ...s,
        id: index + 1,
        name: `Séance ${index + 1}`
      }));
    
    setSessions(updatedSessions);
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
    }
    toast.success("Séance supprimée");
  };

  const handleValidate = async () => {
    if (!athleteId) return;
    
    try {
      // Récupérer l'ID du coach connecté
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Erreur d'authentification");
        return;
      }

      const currentYear = new Date().getFullYear();

      // 1. Créer la semaine d'entraînement
      const { data: weekData, error: weekError } = await supabase
        .from("training_weeks")
        .insert({
          coach_id: user.id,
          athlete_id: athleteId,
          week_number: currentWeekNumber,
          year: currentYear,
          validated: true,
          validated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (weekError) throw weekError;

      // 2. Pour chaque séance, créer l'entrée et ses exercices
      for (const session of sessions) {
        const { data: sessionData, error: sessionError } = await supabase
          .from("training_sessions")
          .insert({
            week_id: weekData.id,
            session_number: session.id,
            name: session.name,
            session_type: session.session_type
          })
          .select()
          .single();

        if (sessionError) throw sessionError;

        // 3. Pour chaque exercice de la séance, créer l'entrée
        const exercises = sessionExercises[session.id] || [];
        if (exercises.length > 0) {
          const exercisesToInsert = exercises.map((exercise, index) => ({
            session_id: sessionData.id,
            exercise_order: index + 1,
            exercice: exercise.exercice,
            recuperation: exercise.recuperation,
            reps: exercise.reps,
            series: exercise.series,
            charge: exercise.charge,
            rpe: exercise.rpe,
            tempo: exercise.tempo,
            commentaire: exercise.commentaire,
            cardio_sport: exercise.cardio_sport || null,
            cardio_content: exercise.cardio_content || null,
            cardio_pace: exercise.cardio_pace || null
          }));

          const { error: exercisesError } = await supabase
            .from("session_exercises")
            .insert(exercisesToInsert);

          if (exercisesError) throw exercisesError;
        }
      }

      setIsValidated(true);
      toast.success("Semaine d'entraînement validée et envoyée au sportif !");
      
      // Recharger l'historique et les retours
      await loadHistoricalWeeks();
      await loadLastWeekFeedback();
      
    } catch (error) {
      console.error("Erreur lors de la validation:", error);
      toast.error("Erreur lors de la validation de la semaine");
    }
  };

  const handleCopyFromWeek = async () => {
    if (!selectedWeekToCopy) {
      toast.error("Veuillez sélectionner une semaine");
      return;
    }

    try {
      // Charger les données de la semaine sélectionnée
      const { data: sessionsData, error } = await supabase
        .from("training_sessions")
        .select(`
          *,
          session_exercises (*)
        `)
        .eq("week_id", selectedWeekToCopy)
        .order("session_number");

      if (error) throw error;

      if (sessionsData && sessionsData.length > 0) {
        // Créer les nouvelles séances avec les exercices
        const newSessions: Session[] = sessionsData.map((session, index) => ({
          id: index + 1,
          name: session.name,
          isExpanded: false,
          session_type: session.session_type || "renfo",
        }));

        const newExercises: Record<number, Exercise[]> = {};
        sessionsData.forEach((session, sessionIndex) => {
          if (session.session_exercises) {
            const sortedExercises = session.session_exercises
              .sort((a: any, b: any) => a.exercise_order - b.exercise_order)
              .map((ex: any, exIndex: number) => ({
                id: exIndex + 1,
                exercice: ex.exercice,
                recuperation: ex.recuperation,
                reps: ex.reps,
                series: ex.series,
                charge: ex.charge,
                rpe: ex.rpe,
                tempo: ex.tempo,
                commentaire: ex.commentaire,
                cardio_sport: ex.cardio_sport || "",
                cardio_content: ex.cardio_content || "",
                cardio_pace: ex.cardio_pace || ""
              }));
            newExercises[sessionIndex + 1] = sortedExercises;
          }
        });

        setSessions(newSessions);
        setSessionExercises(newExercises);
        setWeekToCopyData(sessionsData);
        setShowCopyDialog(false);
        toast.success("Semaine copiée avec succès ! Vous pouvez maintenant la modifier.");
      }
    } catch (error) {
      console.error("Erreur lors de la copie:", error);
      toast.error("Erreur lors de la copie de la semaine");
    }
  };

  const handleSelectWeekForPreview = async (weekId: string) => {
    setSelectedWeekToCopy(weekId);
    
    if (weekId) {
      const { data: sessionsData, error } = await supabase
        .from("training_sessions")
        .select(`
          *,
          session_exercises (*)
        `)
        .eq("week_id", weekId)
        .order("session_number");

      if (!error && sessionsData) {
        setWeekToCopyData(sessionsData);
      }
    } else {
      setWeekToCopyData(null);
    }
  };

  const handleAddExercise = (sessionId: number) => {
    const currentExercises = sessionExercises[sessionId] || [];
    const session = sessions.find(s => s.id === sessionId);
    const isCardio = session?.session_type === "cardio";
    
    const newExercise: Exercise = {
      id: currentExercises.length + 1,
      exercice: isCardio ? "Séance Cardio" : "",
      recuperation: "",
      reps: "",
      series: "",
      charge: "",
      rpe: "",
      tempo: "",
      commentaire: "",
      ...(isCardio && {
        cardio_sport: "",
        cardio_content: "",
        cardio_pace: ""
      })
    };
    
    setSessionExercises({
      ...sessionExercises,
      [sessionId]: [...currentExercises, newExercise]
    });
  };

  const handleExerciseChange = (sessionId: number, exerciseId: number, field: keyof Exercise, value: string) => {
    const currentExercises = sessionExercises[sessionId] || [];
    const updatedExercises = currentExercises.map(ex =>
      ex.id === exerciseId ? { ...ex, [field]: value } : ex
    );
    
    setSessionExercises({
      ...sessionExercises,
      [sessionId]: updatedExercises
    });
  };

  const handleDeleteExercise = (sessionId: number, exerciseId: number) => {
    const currentExercises = sessionExercises[sessionId] || [];
    const updatedExercises = currentExercises.filter(ex => ex.id !== exerciseId);
    
    setSessionExercises({
      ...sessionExercises,
      [sessionId]: updatedExercises
    });
    toast.success("Ligne supprimée");
  };

  const handleKeyDown = (e: React.KeyboardEvent, sessionId: number, exerciseId: number, field: keyof Exercise) => {
    if (e.key === "Enter") {
      e.preventDefault();
      
      if (field === "commentaire") {
        // Dans le commentaire, Entrée crée une nouvelle ligne
        handleAddExercise(sessionId);
        // Focus sur le champ exercice de la nouvelle ligne
        setTimeout(() => {
          const currentExercises = sessionExercises[sessionId] || [];
          const newExerciseId = currentExercises.length + 1;
          const newExerciseInput = document.querySelector(
            `[data-session="${sessionId}"][data-exercise="${newExerciseId}"][data-field="exercice"] button`
          ) as HTMLElement;
          newExerciseInput?.focus();
          newExerciseInput?.click();
        }, 100);
      } else {
        // Pour les autres champs, passer au champ suivant
        const fieldOrder: (keyof Exercise)[] = ["exercice", "recuperation", "reps", "series", "charge", "rpe", "tempo", "commentaire"];
        const currentIndex = fieldOrder.indexOf(field);
        const nextField = fieldOrder[currentIndex + 1];
        
        if (nextField) {
          const nextInput = document.querySelector(
            `[data-session="${sessionId}"][data-exercise="${exerciseId}"][data-field="${nextField}"]`
          ) as HTMLElement;
          
          if (nextInput) {
            nextInput.focus();
            if (nextInput.tagName === "BUTTON") {
              nextInput.click();
            }
          }
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/coach/mes-clients")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour à mes clients
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Athlète introuvable</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("/coach/mes-clients")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour à mes clients
        </Button>
      </div>

      <div className="flex items-center gap-6">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-10 w-10 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">
            {athlete.first_name} {athlete.last_name}
          </h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Mail className="h-4 w-4" />
              {athlete.email}
            </div>
            {athlete.date_of_birth && (
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Né(e) le {new Date(athlete.date_of_birth).toLocaleDateString()}
              </div>
            )}
            {athlete.gender && (
              <Badge variant="outline">
                {athlete.gender === "male" ? "Homme" : athlete.gender === "female" ? "Femme" : "Autre"}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="programmation" className="w-full">
        <TabsList>
          <TabsTrigger value="programmation">Programmation</TabsTrigger>
          <TabsTrigger value="suivi">Suivi</TabsTrigger>
          <TabsTrigger value="historique">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="programmation" className="space-y-4">
          {/* Retours de la semaine précédente */}
          {lastWeekData && (
            <Collapsible
              open={showLastWeekFeedback}
              onOpenChange={setShowLastWeekFeedback}
            >
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-80 transition-opacity">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">
                        Retours de la semaine {lastWeekData.week.week_number} - {lastWeekData.week.year}
                      </CardTitle>
                    </div>
                    {showLastWeekFeedback ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {lastWeekData.sessions.map((session: any) => (
                        <div key={session.id} className="border rounded-lg p-3 bg-background">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-sm">{session.name}</h4>
                            <div className="flex gap-3 text-xs text-muted-foreground">
                              {session.completed_at && (
                                <span>
                                  Réalisée le {new Date(session.completed_at).toLocaleDateString()}
                                </span>
                              )}
                              {session.duration_minutes && (
                                <span>{session.duration_minutes} min</span>
                              )}
                            </div>
                          </div>
                          
                          {session.session_exercises && session.session_exercises.length > 0 ? (
                            <div className="space-y-2">
                              {session.session_exercises
                                .filter((ex: any) => ex.sportif_rpe || ex.sportif_comment)
                                .sort((a: any, b: any) => a.exercise_order - b.exercise_order)
                                .map((ex: any) => (
                                  <div key={ex.id} className="pl-3 border-l-2 border-primary/30 py-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">{ex.exercice}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                          Prescrit: {ex.series}x{ex.reps} @ {ex.charge} • RPE {ex.rpe}
                                        </div>
                                      </div>
                                      {ex.sportif_rpe && (
                                        <Badge variant="secondary" className="shrink-0">
                                          RPE ressenti: {ex.sportif_rpe}
                                        </Badge>
                                      )}
                                    </div>
                                    {ex.sportif_comment && (
                                      <div className="mt-1.5 text-xs italic text-muted-foreground bg-muted/50 p-2 rounded">
                                        "{ex.sportif_comment}"
                                      </div>
                                    )}
                                  </div>
                                ))}
                              {!session.session_exercises.some((ex: any) => ex.sportif_rpe || ex.sportif_comment) && (
                                <p className="text-xs text-muted-foreground text-center py-2">
                                  Aucun retour du sportif pour cette séance
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              Aucun exercice
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Semaine d'entraînement n°{currentWeekNumber}</CardTitle>
                <div className="flex gap-2">
                  {historicalWeeks.length > 0 && !isValidated && (
                    <Button 
                      variant="outline" 
                      onClick={() => setShowCopyDialog(true)}
                      disabled={sessions.length > 0}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copier d'une semaine
                    </Button>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant={newSessionType === "renfo" ? "default" : "outline"}
                      onClick={() => setNewSessionType("renfo")}
                      disabled={isValidated}
                    >
                      Renfo
                    </Button>
                    <Button
                      variant={newSessionType === "cardio" ? "default" : "outline"}
                      onClick={() => setNewSessionType("cardio")}
                      disabled={isValidated}
                    >
                      Cardio
                    </Button>
                    <Button onClick={handleCreateSession} disabled={isValidated}>
                      <Plus className="h-4 w-4 mr-2" />
                      Créer
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <div className="text-center py-8 space-y-4">
                  <p className="text-muted-foreground">
                    Aucune séance créée. 
                  </p>
                  {historicalWeeks.length > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Vous pouvez créer une nouvelle séance ou copier une semaine précédente.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Cliquez sur "Créer une séance" pour commencer.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {sessions.map((session) => (
                      <div key={session.id} className="border rounded-lg">
                        <div
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => !isValidated && toggleSession(session.id)}
                        >
                          <div className="flex items-center gap-3">
                            {expandedSessionId === session.id ? (
                              <ChevronDown className="h-5 w-5 text-primary" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )}
                            <span className="font-medium">{session.name}</span>
                            <Badge variant={session.session_type === "cardio" ? "secondary" : "outline"}>
                              {session.session_type === "cardio" ? "Cardio" : "Renfo"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {expandedSessionId === session.id ? "Ouvert" : "Fermé"}
                            </Badge>
                            {!isValidated && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleDeleteSession(session.id, e)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {expandedSessionId === session.id && (
                          <div className="border-t p-4 bg-muted/20">
                            <div className="space-y-4">
                              {session.session_type === "cardio" ? (
                                // Interface Cardio
                                <div className="space-y-3">
                                  {(sessionExercises[session.id] || []).length === 0 ? (
                                    <div className="text-center text-muted-foreground py-8">
                                      Aucune séance cardio ajoutée. Clique sur "Ajouter une séance cardio" pour commencer.
                                    </div>
                                  ) : (
                                    (sessionExercises[session.id] || []).map((exercise) => (
                                      <div key={exercise.id} className="border rounded-lg p-4 bg-background space-y-3">
                                        <div className="flex justify-between items-center">
                                          <h4 className="font-medium">Séance Cardio {exercise.id}</h4>
                                          {!isValidated && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handleDeleteExercise(session.id, exercise.id)}
                                              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          )}
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                          <div>
                                            <label className="text-sm font-medium mb-1 block">Sport</label>
                                            <select
                                              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                              value={exercise.cardio_sport || ""}
                                              onChange={(e) => handleExerciseChange(session.id, exercise.id, "cardio_sport", e.target.value)}
                                              disabled={isValidated}
                                            >
                                              <option value="">Sélectionner...</option>
                                              <option value="course">Course</option>
                                              <option value="natation">Natation</option>
                                              <option value="vélo">Vélo</option>
                                              <option value="yoga">Yoga (balance)</option>
                                              <option value="hiit">HIIT</option>
                                            </select>
                                          </div>
                                          {exercise.cardio_sport === "course" && (
                                            <div>
                                              <label className="text-sm font-medium mb-1 block">Allure</label>
                                              <Input
                                                value={exercise.cardio_pace || ""}
                                                onChange={(e) => handleExerciseChange(session.id, exercise.id, "cardio_pace", e.target.value)}
                                                placeholder="ex: 5:30/km"
                                                disabled={isValidated}
                                              />
                                            </div>
                                          )}
                                        </div>
                                        <div>
                                          <label className="text-sm font-medium mb-1 block">Contenu</label>
                                          <textarea
                                            className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={exercise.cardio_content || ""}
                                            onChange={(e) => handleExerciseChange(session.id, exercise.id, "cardio_content", e.target.value)}
                                            placeholder="Décris le contenu de la séance..."
                                            disabled={isValidated}
                                          />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                          <div>
                                            <label className="text-sm font-medium mb-1 block">RPE</label>
                                            <Input
                                              value={exercise.rpe || ""}
                                              onChange={(e) => handleExerciseChange(session.id, exercise.id, "rpe", e.target.value)}
                                              placeholder="ex: 7"
                                              disabled={isValidated}
                                            />
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium mb-1 block">Commentaire</label>
                                            <Input
                                              value={exercise.commentaire || ""}
                                              onChange={(e) => handleExerciseChange(session.id, exercise.id, "commentaire", e.target.value)}
                                              placeholder="Notes..."
                                              disabled={isValidated}
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                  {!isValidated && (
                                    <Button
                                      variant="outline"
                                      onClick={() => handleAddExercise(session.id)}
                                      className="w-full"
                                    >
                                      <Plus className="h-4 w-4 mr-2" />
                                      Ajouter une séance cardio
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                // Interface Renfo (existante)
                                <>
                                  <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="min-w-[150px]">Exercice</TableHead>
                                        <TableHead className="min-w-[120px]">Récupération</TableHead>
                                        <TableHead className="min-w-[100px]">Reps</TableHead>
                                        <TableHead className="min-w-[100px]">Séries</TableHead>
                                        <TableHead className="min-w-[100px]">Charge</TableHead>
                                        <TableHead className="min-w-[100px]">RPE</TableHead>
                                        <TableHead className="min-w-[100px]">Tempo</TableHead>
                                        <TableHead className="min-w-[200px]">Commentaire</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                    {(sessionExercises[session.id] || []).length === 0 ? (
                                      <TableRow>
                                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                                          Aucun exercice ajouté. Clique sur "Ajouter une ligne" pour commencer.
                                        </TableCell>
                                      </TableRow>
                                    ) : (
                                      (sessionExercises[session.id] || []).map((exercise) => (
                                        <TableRow key={exercise.id}>
                                          <TableCell>
                                            <div data-session={session.id} data-exercise={exercise.id} data-field="exercice">
                                              <ExerciseCombobox
                                                value={exercise.exercice}
                                                onChange={(value) => {
                                                  handleExerciseChange(session.id, exercise.id, "exercice", value);
                                                  // Passer automatiquement au champ suivant
                                                  setTimeout(() => {
                                                    const nextInput = document.querySelector(
                                                      `[data-session="${session.id}"][data-exercise="${exercise.id}"][data-field="recuperation"]`
                                                    ) as HTMLElement;
                                                    nextInput?.focus();
                                                    nextInput?.click();
                                                  }, 100);
                                                }}
                                                exercises={libraryExercises}
                                                disabled={isValidated}
                                              />
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            <Select
                                              value={exercise.recuperation}
                                              onValueChange={(value) => {
                                                handleExerciseChange(session.id, exercise.id, "recuperation", value);
                                                // Passer automatiquement au champ suivant
                                                setTimeout(() => {
                                                  const nextInput = document.querySelector(
                                                    `[data-session="${session.id}"][data-exercise="${exercise.id}"][data-field="reps"]`
                                                  ) as HTMLInputElement;
                                                  nextInput?.focus();
                                                }, 100);
                                              }}
                                              disabled={isValidated}
                                            >
                                              <SelectTrigger data-session={session.id} data-exercise={exercise.id} data-field="recuperation">
                                                <SelectValue placeholder="Temps de récup" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {recuperationOptions.map((option) => (
                                                  <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </TableCell>
                                          <TableCell>
                                            <Input
                                              value={exercise.reps}
                                              onChange={(e) => handleExerciseChange(session.id, exercise.id, "reps", e.target.value)}
                                              onKeyDown={(e) => handleKeyDown(e, session.id, exercise.id, "reps")}
                                              placeholder="ex: 10"
                                              disabled={isValidated}
                                              data-session={session.id}
                                              data-exercise={exercise.id}
                                              data-field="reps"
                                            />
                                          </TableCell>
                                          <TableCell>
                                            <Input
                                              value={exercise.series}
                                              onChange={(e) => handleExerciseChange(session.id, exercise.id, "series", e.target.value)}
                                              onKeyDown={(e) => handleKeyDown(e, session.id, exercise.id, "series")}
                                              placeholder="ex: 3"
                                              disabled={isValidated}
                                              data-session={session.id}
                                              data-exercise={exercise.id}
                                              data-field="series"
                                            />
                                          </TableCell>
                                          <TableCell>
                                            <Input
                                              value={exercise.charge}
                                              onChange={(e) => handleExerciseChange(session.id, exercise.id, "charge", e.target.value)}
                                              onKeyDown={(e) => handleKeyDown(e, session.id, exercise.id, "charge")}
                                              placeholder="ex: 80kg"
                                              disabled={isValidated}
                                              data-session={session.id}
                                              data-exercise={exercise.id}
                                              data-field="charge"
                                            />
                                          </TableCell>
                                          <TableCell>
                                            <Input
                                              value={exercise.rpe}
                                              onChange={(e) => handleExerciseChange(session.id, exercise.id, "rpe", e.target.value)}
                                              onKeyDown={(e) => handleKeyDown(e, session.id, exercise.id, "rpe")}
                                              placeholder="ex: 8"
                                              disabled={isValidated}
                                              data-session={session.id}
                                              data-exercise={exercise.id}
                                              data-field="rpe"
                                            />
                                          </TableCell>
                                          <TableCell>
                                            <Input
                                              value={exercise.tempo}
                                              onChange={(e) => handleExerciseChange(session.id, exercise.id, "tempo", e.target.value)}
                                              onKeyDown={(e) => handleKeyDown(e, session.id, exercise.id, "tempo")}
                                              placeholder="ex: 3010"
                                              disabled={isValidated}
                                              data-session={session.id}
                                              data-exercise={exercise.id}
                                              data-field="tempo"
                                            />
                                          </TableCell>
                                          <TableCell>
                                            <Input
                                              value={exercise.commentaire}
                                              onChange={(e) => handleExerciseChange(session.id, exercise.id, "commentaire", e.target.value)}
                                              onKeyDown={(e) => handleKeyDown(e, session.id, exercise.id, "commentaire")}
                                              placeholder="Notes..."
                                              disabled={isValidated}
                                              data-session={session.id}
                                              data-exercise={exercise.id}
                                              data-field="commentaire"
                                            />
                                          </TableCell>
                                          <TableCell>
                                            {!isValidated && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteExercise(session.id, exercise.id)}
                                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                              >
                                                <X className="h-4 w-4" />
                                              </Button>
                                            )}
                                           </TableCell>
                                         </TableRow>
                                       ))
                                     )}
                                   </TableBody>
                                 </Table>
                                  </div>
                                  
                                  {!isValidated && (
                                    <Button
                                      onClick={() => handleAddExercise(session.id)}
                                      variant="outline"
                                      size="sm"
                                    >
                                      <Plus className="h-4 w-4 mr-2" />
                                      Ajouter une ligne
                                    </Button>
                                  )}
                                 </>
                               )}
                             </div>
                           </div>
                         )}
                       </div>
                    ))}
                  </div>
                  
                  {!isValidated && (
                    <div className="mt-6 flex justify-end">
                      <Button onClick={handleValidate} size="lg">
                        <Check className="h-4 w-4 mr-2" />
                        Valider la semaine
                      </Button>
                    </div>
                  )}
                  
                  {isValidated && (
                    <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                      <p className="text-sm font-medium text-primary">
                        ✓ Semaine validée - Le sportif peut maintenant voir ses séances
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suivi" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Suivi de progression</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Suivi des performances et de la progression de {athlete.first_name}.
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                Fonctionnalité en cours de développement...
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historique" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historique des semaines d'entraînement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {historicalWeeks.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucune semaine d'entraînement validée pour le moment.
                </p>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Sélectionner une semaine
                    </label>
                    <select
                      className="w-full p-2 border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                      value={selectedHistoricalWeek?.id || ""}
                      onChange={(e) => handleSelectHistoricalWeek(e.target.value)}
                    >
                      <option value="">-- Choisir une semaine --</option>
                      {historicalWeeks.map((week) => (
                        <option key={week.id} value={week.id}>
                          Semaine {week.week_number} - {week.year} (validée le {new Date(week.validated_at).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedHistoricalWeek && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                        <div>
                          <h3 className="font-semibold">
                            Semaine {selectedHistoricalWeek.week_number} - {selectedHistoricalWeek.year}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Validée le {new Date(selectedHistoricalWeek.validated_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {!isEditingHistorical ? (
                            <Button
                              onClick={handleStartEditingHistorical}
                              variant="outline"
                            >
                              Modifier
                            </Button>
                          ) : (
                            <>
                              <Button
                                onClick={handleSaveHistoricalChanges}
                                variant="default"
                              >
                                <Check className="h-4 w-4 mr-2" />
                                Enregistrer
                              </Button>
                              <Button
                                onClick={handleCancelEditingHistorical}
                                variant="outline"
                              >
                                Annuler
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {historicalSessions.map((session) => (
                          <div key={session.id} className="border rounded-lg">
                            <div
                              className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => toggleHistoricalSession(session.id)}
                            >
                              <div className="flex items-center gap-3">
                                {expandedHistoricalSessionId === session.id ? (
                                  <ChevronDown className="h-5 w-5 text-primary" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                )}
                                <span className="font-medium">{session.name}</span>
                              </div>
                              <Badge variant="outline">
                                {session.session_exercises?.length || 0} exercices
                              </Badge>
                            </div>

                            {expandedHistoricalSessionId === session.id && (
                              <div className="border-t p-4 bg-muted/20">
                                {/* Info de la séance */}
                                <div className="flex gap-6 mb-4 p-3 bg-background rounded-md">
                                  {session.completed_at && (
                                    <div>
                                      <span className="text-sm text-muted-foreground">Date de réalisation: </span>
                                      <span className="font-medium">
                                        {new Date(session.completed_at).toLocaleDateString()} à {new Date(session.completed_at).toLocaleTimeString()}
                                      </span>
                                    </div>
                                  )}
                                  {session.duration_minutes && (
                                    <div>
                                      <span className="text-sm text-muted-foreground">Durée: </span>
                                      <span className="font-medium">{session.duration_minutes} min</span>
                                    </div>
                                  )}
                                </div>

                                <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Exercice</TableHead>
                                        <TableHead>Récup</TableHead>
                                        <TableHead>Reps</TableHead>
                                        <TableHead>Séries</TableHead>
                                        <TableHead>Charge</TableHead>
                                        <TableHead>RPE prescrit</TableHead>
                                        <TableHead>RPE ressenti</TableHead>
                                        <TableHead>Tempo</TableHead>
                                        <TableHead>Commentaire coach</TableHead>
                                        <TableHead>Retour sportif</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {editedHistoricalExercises[session.id] && editedHistoricalExercises[session.id].length > 0 ? (
                                        editedHistoricalExercises[session.id].map((exercise: any) => (
                                          <TableRow key={exercise.id}>
                                            <TableCell>
                                              {isEditingHistorical ? (
                                                <ExerciseCombobox
                                                  value={exercise.exercice}
                                                  onChange={(value) => handleHistoricalExerciseChange(session.id, exercise.id, "exercice", value)}
                                                  exercises={libraryExercises}
                                                />
                                              ) : (
                                                <span className="font-medium">{exercise.exercice}</span>
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              {isEditingHistorical ? (
                                                <Select
                                                  value={exercise.recuperation}
                                                  onValueChange={(value) => handleHistoricalExerciseChange(session.id, exercise.id, "recuperation", value)}
                                                >
                                                  <SelectTrigger>
                                                    <SelectValue placeholder="Récup" />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {recuperationOptions.map((option) => (
                                                      <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              ) : (
                                                exercise.recuperation || "-"
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              {isEditingHistorical ? (
                                                <Input
                                                  value={exercise.reps}
                                                  onChange={(e) => handleHistoricalExerciseChange(session.id, exercise.id, "reps", e.target.value)}
                                                  placeholder="ex: 10"
                                                />
                                              ) : (
                                                exercise.reps || "-"
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              {isEditingHistorical ? (
                                                <Input
                                                  value={exercise.series}
                                                  onChange={(e) => handleHistoricalExerciseChange(session.id, exercise.id, "series", e.target.value)}
                                                  placeholder="ex: 3"
                                                />
                                              ) : (
                                                exercise.series || "-"
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              {isEditingHistorical ? (
                                                <Input
                                                  value={exercise.charge}
                                                  onChange={(e) => handleHistoricalExerciseChange(session.id, exercise.id, "charge", e.target.value)}
                                                  placeholder="ex: 80kg"
                                                />
                                              ) : (
                                                exercise.charge || "-"
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              {isEditingHistorical ? (
                                                <Input
                                                  value={exercise.rpe}
                                                  onChange={(e) => handleHistoricalExerciseChange(session.id, exercise.id, "rpe", e.target.value)}
                                                  placeholder="ex: 7"
                                                />
                                              ) : (
                                                exercise.rpe || "-"
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              <div className="space-y-1">
                                                <div className={exercise.sportif_rpe ? "font-medium text-primary" : "text-muted-foreground"}>
                                                  {exercise.sportif_rpe || "-"}
                                                </div>
                                                {exercise.sportif_feedback_at && (
                                                  <div className="text-xs text-muted-foreground">
                                                    {new Date(exercise.sportif_feedback_at).toLocaleDateString()}
                                                  </div>
                                                )}
                                              </div>
                                            </TableCell>
                                            <TableCell>
                                              {isEditingHistorical ? (
                                                <Input
                                                  value={exercise.tempo}
                                                  onChange={(e) => handleHistoricalExerciseChange(session.id, exercise.id, "tempo", e.target.value)}
                                                  placeholder="ex: 3010"
                                                />
                                              ) : (
                                                exercise.tempo || "-"
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              {isEditingHistorical ? (
                                                <Input
                                                  value={exercise.commentaire}
                                                  onChange={(e) => handleHistoricalExerciseChange(session.id, exercise.id, "commentaire", e.target.value)}
                                                  placeholder="Notes..."
                                                />
                                              ) : (
                                                exercise.commentaire || "-"
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              {exercise.sportif_comment ? (
                                                <div className="max-w-xs">
                                                  <p className="text-sm whitespace-pre-wrap">{exercise.sportif_comment}</p>
                                                </div>
                                              ) : (
                                                <span className="text-muted-foreground">-</span>
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        ))
                                      ) : (
                                        <TableRow>
                                          <TableCell colSpan={10} className="text-center text-muted-foreground">
                                            Aucun exercice
                                          </TableCell>
                                        </TableRow>
                                      )}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog pour copier une semaine */}
      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Copier une semaine précédente</DialogTitle>
            <DialogDescription>
              Sélectionnez une semaine à copier. Vous pourrez voir les retours du sportif et modifier les exercices avant validation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Sélectionner une semaine
              </label>
              <select
                className="w-full p-2 border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                value={selectedWeekToCopy}
                onChange={(e) => handleSelectWeekForPreview(e.target.value)}
              >
                <option value="">-- Choisir une semaine --</option>
                {historicalWeeks.map((week) => (
                  <option key={week.id} value={week.id}>
                    Semaine {week.week_number} - {week.year} (validée le {new Date(week.validated_at).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>

            {selectedWeekToCopy && weekToCopyData && (
              <div className="border rounded-lg p-4 bg-muted/30">
                <h4 className="font-semibold mb-3">Aperçu de la semaine avec retours du sportif</h4>
                <div className="space-y-3 text-sm">
                  {weekToCopyData.map((session: any) => (
                    <div key={session.id} className="border rounded p-3 bg-background">
                      <h5 className="font-medium mb-2">{session.name}</h5>
                      {session.session_exercises && session.session_exercises.length > 0 ? (
                        <div className="space-y-2">
                          {session.session_exercises
                            .sort((a: any, b: any) => a.exercise_order - b.exercise_order)
                            .map((ex: any) => (
                              <div key={ex.id} className="pl-4 border-l-2 border-primary/20">
                                <div className="flex justify-between items-start">
                                  <span className="font-medium">{ex.exercice}</span>
                                  <div className="text-right text-xs text-muted-foreground">
                                    {ex.series}x{ex.reps} @ {ex.charge}
                                  </div>
                                </div>
                                {ex.sportif_rpe && (
                                  <div className="mt-1 text-xs">
                                    <span className="text-primary font-medium">RPE ressenti: {ex.sportif_rpe}</span>
                                    {ex.sportif_feedback_at && (
                                      <span className="text-muted-foreground ml-2">
                                        ({new Date(ex.sportif_feedback_at).toLocaleDateString()})
                                      </span>
                                    )}
                                  </div>
                                )}
                                {ex.sportif_comment && (
                                  <div className="mt-1 text-xs text-muted-foreground italic">
                                    "{ex.sportif_comment}"
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-xs">Aucun exercice</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCopyDialog(false);
              setSelectedWeekToCopy("");
              setWeekToCopyData(null);
            }}>
              Annuler
            </Button>
            <Button onClick={handleCopyFromWeek} disabled={!selectedWeekToCopy}>
              <Copy className="h-4 w-4 mr-2" />
              Copier cette semaine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
