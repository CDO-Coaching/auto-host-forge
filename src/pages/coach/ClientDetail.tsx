import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  User,
  Calendar,
  Mail,
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  Check,
  X,
  Copy,
  MessageSquare,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { getWeek } from "date-fns";
import { ExerciseCombobox } from "@/components/ExerciseCombobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  super_set_group?: string | null;
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
  const [showLastWeekFeedback, setShowLastWeekFeedback] = useState(false);
  const [lastWeekData, setLastWeekData] = useState<any>(null);
  const [newHistoricalSessionName, setNewHistoricalSessionName] = useState("");
  const [newHistoricalSessionType, setNewHistoricalSessionType] = useState<"renfo" | "cardio">("renfo");
  const [selectedWeekToProgram, setSelectedWeekToProgram] = useState<{ week: number; year: number } | null>(null);

  const currentWeekNumber = getWeek(new Date());

  // Générer les 12 prochaines semaines pour la sélection
  const getNextWeeks = () => {
    const weeks = [];
    const now = new Date();

    for (let i = 0; i < 12; i++) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + i * 7);
      const weekNum = getWeek(targetDate);
      const year = targetDate.getFullYear();
      weeks.push({ week: weekNum, year, date: targetDate });
    }

    return weeks;
  };

  const availableWeeks = getNextWeeks();

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
    
    // Restaurer les données sauvegardées localement
    const savedData = localStorage.getItem(`coach-programming-${athleteId}`);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.sessions) setSessions(parsed.sessions);
        if (parsed.sessionExercises) setSessionExercises(parsed.sessionExercises);
        if (parsed.selectedWeekToProgram) setSelectedWeekToProgram(parsed.selectedWeekToProgram);
      } catch (error) {
        console.error("Erreur lors de la restauration des données:", error);
      }
    }
  }, [athleteId]);

  // Sauvegarder automatiquement les données localement
  useEffect(() => {
    if (athleteId && (sessions.length > 0 || Object.keys(sessionExercises).length > 0)) {
      const dataToSave = {
        sessions,
        sessionExercises,
        selectedWeekToProgram,
      };
      localStorage.setItem(`coach-programming-${athleteId}`, JSON.stringify(dataToSave));
    }
  }, [sessions, sessionExercises, selectedWeekToProgram, athleteId]);

  // Scroll automatique vers le bas lors de l'ajout de séances ou d'exercices
  useEffect(() => {
    if (!isValidated && sessions.length > 0) {
      // Attendre un peu que le DOM soit mis à jour
      setTimeout(() => {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: 'smooth'
        });
      }, 150);
    }
  }, [sessions, sessionExercises, isValidated]);

  const loadLibraryExercises = async () => {
    const { data, error } = await supabase.from("exercise_library").select("id, name, muscle").order("name");

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

    // Trouver toutes les semaines validées avec des sessions complétées par le sportif
    const { data: weeks, error: weeksError } = await supabase
      .from("training_weeks")
      .select(
        `
        *,
        training_sessions!inner(
          id,
          completed_at
        )
      `,
      )
      .eq("athlete_id", athleteId)
      .eq("validated", true)
      .not("training_sessions.completed_at", "is", null)
      .order("year", { ascending: false })
      .order("week_number", { ascending: false });

    if (weeksError || !weeks || weeks.length === 0) {
      console.error("Pas de semaine avec feedback:", weeksError);
      setLastWeekData(null);
      return;
    }

    // Prendre la première semaine (la plus récente)
    const lastWeek = weeks[0];

    const { data: sessionsData, error: sessionsError } = await supabase
      .from("training_sessions")
      .select(
        `
        *,
        session_exercises (*)
      `,
      )
      .eq("week_id", lastWeek.id)
      .order("session_number");

    if (!sessionsError && sessionsData) {
      setLastWeekData({
        week: lastWeek,
        sessions: sessionsData,
      });
    }
  };

  const loadHistoricalWeekDetails = async (weekId: string) => {
    const { data: sessionsData, error: sessionsError } = await supabase
      .from("training_sessions")
      .select(
        `
        *,
        session_exercises (*)
      `,
      )
      .eq("week_id", weekId)
      .order("session_number");

    if (sessionsError) {
      console.error("Erreur lors du chargement des séances:", sessionsError);
    } else {
      setHistoricalSessions(sessionsData || []);
      // Initialiser les exercices éditables
      const exercisesMap: Record<string, any[]> = {};
      sessionsData?.forEach((session) => {
        if (session.session_exercises) {
          exercisesMap[session.id] = session.session_exercises.sort(
            (a: any, b: any) => a.exercise_order - b.exercise_order,
          );
        }
      });
      setEditedHistoricalExercises(exercisesMap);
    }
  };

  const handleSelectHistoricalWeek = async (weekId: string) => {
    const week = historicalWeeks.find((w) => w.id === weekId);
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
    setEditedHistoricalExercises((prev) => {
      const sessionExercises = prev[sessionId] || [];
      return {
        ...prev,
        [sessionId]: sessionExercises.map((ex) => (ex.id === exerciseId ? { ...ex, [field]: value } : ex)),
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
              commentaire: exercise.commentaire,
              cardio_sport: exercise.cardio_sport || null,
              cardio_content: exercise.cardio_content || null,
              cardio_pace: exercise.cardio_pace || null,
              super_set_group: exercise.super_set_group || null,
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

  const handleAddHistoricalSession = async () => {
    if (!newHistoricalSessionName.trim() || !selectedHistoricalWeek) return;

    try {
      // Calculer le prochain numéro de séance basé sur le max existant
      const maxSessionNumber = historicalSessions.reduce(
        (max, session) => Math.max(max, session.session_number || 0),
        0,
      );
      const nextSessionNumber = maxSessionNumber + 1;

      console.log("Ajout séance:", {
        week_id: selectedHistoricalWeek.id,
        session_number: nextSessionNumber,
        name: newHistoricalSessionName,
      });

      const { data: sessionData, error } = await supabase
        .from("training_sessions")
        .insert({
          week_id: selectedHistoricalWeek.id,
          session_number: nextSessionNumber,
          name: newHistoricalSessionName,
        })
        .select()
        .single();

      if (error) {
        console.error("Erreur Supabase complète:", error);
        throw error;
      }

      setNewHistoricalSessionName("");
      setNewHistoricalSessionType("renfo");
      toast.success("Séance ajoutée");

      // Recharger les données
      await loadHistoricalWeekDetails(selectedHistoricalWeek.id);
    } catch (error: any) {
      console.error("Erreur lors de l'ajout de la séance:", error);
      toast.error(`Erreur: ${error.message || "Impossible d'ajouter la séance"}`);
    }
  };

  const handleDeleteHistoricalSession = async (sessionId: string) => {
    try {
      const { error } = await supabase.from("training_sessions").delete().eq("id", sessionId);

      if (error) throw error;

      toast.success("Séance supprimée");

      // Recharger les données
      if (selectedHistoricalWeek) {
        await loadHistoricalWeekDetails(selectedHistoricalWeek.id);
      }
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression de la séance");
    }
  };

  const handleAddHistoricalExercise = async (sessionId: string) => {
    const session = historicalSessions.find((s) => s.id === sessionId);
    if (!session) return;

    try {
      const currentExercises = editedHistoricalExercises[sessionId] || [];
      const isCardio = session.session_type === "cardio";

      const { data, error } = await supabase
        .from("session_exercises")
        .insert({
          session_id: sessionId,
          exercise_order: currentExercises.length + 1,
          exercice: isCardio ? "Séance Cardio" : "",
          recuperation: "",
          reps: "",
          series: "",
          charge: "",
          rpe: "",
          tempo: "",
          commentaire: "",
          ...(isCardio && {
            cardio_sport: null,
            cardio_content: null,
            cardio_pace: null,
          }),
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Exercice ajouté");

      // Recharger les données
      if (selectedHistoricalWeek) {
        await loadHistoricalWeekDetails(selectedHistoricalWeek.id);
      }
    } catch (error) {
      console.error("Erreur lors de l'ajout:", error);
      toast.error("Erreur lors de l'ajout de l'exercice");
    }
  };

  const handleDeleteHistoricalExercise = async (exerciseId: string) => {
    try {
      const { error } = await supabase.from("session_exercises").delete().eq("id", exerciseId);

      if (error) throw error;

      toast.success("Exercice supprimé");

      // Recharger les données
      if (selectedHistoricalWeek) {
        await loadHistoricalWeekDetails(selectedHistoricalWeek.id);
      }
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression de l'exercice");
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

    const { data, error } = await supabase.from("user_profiles").select("*").eq("id", athleteId).single();

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

    // Si c'est une séance cardio, ajouter automatiquement un exercice cardio
    if (newSessionType === "cardio") {
      const newExercise: Exercise = {
        id: 1,
        exercice: "Séance Cardio",
        recuperation: "",
        reps: "",
        series: "",
        charge: "",
        rpe: "",
        tempo: "",
        commentaire: "",
        cardio_sport: "",
        cardio_content: "",
        cardio_pace: "",
      };

      setSessionExercises({
        ...sessionExercises,
        [nextSessionNumber]: [newExercise],
      });
    }

    setNewSessionType("renfo"); // Reset to default
    toast.success(`Séance créée`);
  };

  const toggleSession = (sessionId: number) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
    } else {
      setExpandedSessionId(sessionId);
      // Scroll vers le bas quand on ouvre une séance pour voir la zone d'ajout
      setTimeout(() => {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: 'smooth',
        });
      }, 200);
    }
  };

  const handleDeleteSession = (sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Créer un mapping des anciens IDs vers les nouveaux IDs
    const idMapping: { [key: number]: number } = {};
    const updatedSessions = sessions
      .filter((s) => s.id !== sessionId)
      .map((s, index) => {
        const newId = index + 1;
        idMapping[s.id] = newId;
        return {
          ...s,
          id: newId,
          // Garder le nom original s'il a été personnalisé, sinon mettre un nom par défaut
          name: s.name.match(/^(Séance|Cardio) \d+$/) 
            ? (s.session_type === "cardio" ? `Cardio ${newId}` : `Séance ${newId}`)
            : s.name,
        };
      });

    // Mettre à jour sessionExercises avec les nouveaux IDs
    const updatedSessionExercises: { [key: number]: Exercise[] } = {};
    Object.keys(sessionExercises).forEach((oldIdStr) => {
      const oldId = parseInt(oldIdStr);
      if (idMapping[oldId] !== undefined) {
        updatedSessionExercises[idMapping[oldId]] = sessionExercises[oldId];
      }
    });

    setSessions(updatedSessions);
    setSessionExercises(updatedSessionExercises);
    
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
    }
    toast.success("Séance supprimée");
  };

  const handleValidate = async () => {
    if (!athleteId) return;

    if (!selectedWeekToProgram) {
      toast.error("Veuillez sélectionner une semaine");
      return;
    }

    try {
      // Récupérer l'ID du coach connecté
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Erreur d'authentification");
        return;
      }

      // Vérifier que cette semaine n'est pas déjà programmée
      const { data: existingWeek } = await supabase
        .from("training_weeks")
        .select("id")
        .eq("athlete_id", athleteId)
        .eq("week_number", selectedWeekToProgram.week)
        .eq("year", selectedWeekToProgram.year)
        .maybeSingle();

      if (existingWeek) {
        toast.error("Cette semaine est déjà programmée pour cet athlète");
        return;
      }

      // 1. Créer la semaine d'entraînement
      const { data: weekData, error: weekError } = await supabase
        .from("training_weeks")
        .insert({
          coach_id: user.id,
          athlete_id: athleteId,
          week_number: selectedWeekToProgram.week,
          year: selectedWeekToProgram.year,
          validated: true,
          validated_at: new Date().toISOString(),
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
            cardio_pace: exercise.cardio_pace || null,
            super_set_group: exercise.super_set_group || null,
          }));

          const { error: exercisesError } = await supabase.from("session_exercises").insert(exercisesToInsert);

          if (exercisesError) throw exercisesError;
        }
      }

      setIsValidated(true);
      toast.success("Semaine d'entraînement validée et envoyée au sportif !");

      // Réinitialiser pour permettre de programmer une nouvelle semaine
      setSelectedWeekToProgram(null);
      setSessions([]);
      setSessionExercises({});

      // Nettoyer les données sauvegardées localement
      localStorage.removeItem(`coach-programming-${athleteId}`);

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
        .select(
          `
          *,
          session_exercises (*)
        `,
        )
        .eq("week_id", selectedWeekToCopy)
        .order("session_number");

      if (error) throw error;

      if (sessionsData && sessionsData.length > 0) {
        // Créer les nouvelles séances avec les exercices
        const newSessions: Session[] = sessionsData.map((session, index) => {
          // Détecter automatiquement si c'est une session cardio en regardant les exercices
          let sessionType = session.session_type;
          if (!sessionType && session.session_exercises && session.session_exercises.length > 0) {
            const hasCardioFields = session.session_exercises.some((ex: any) => 
              ex.cardio_sport || ex.cardio_content || ex.cardio_pace
            );
            sessionType = hasCardioFields ? "cardio" : "renfo";
          }
          
          return {
            id: index + 1,
            name: session.name,
            isExpanded: false,
            session_type: sessionType || "renfo",
          };
        });

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
                cardio_pace: ex.cardio_pace || "",
                super_set_group: ex.super_set_group || null,
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
        .select(
          `
          *,
          session_exercises (*)
        `,
        )
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
    const session = sessions.find((s) => s.id === sessionId);
    const isCardio = session?.session_type === "cardio";

    const newExerciseId = currentExercises.length + 1;
    const newExercise: Exercise = {
      id: newExerciseId,
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
        cardio_pace: "",
      }),
    };

    setSessionExercises({
      ...sessionExercises,
      [sessionId]: [...currentExercises, newExercise],
    });

    // Après insertion, descendre automatiquement en bas et amener la nouvelle ligne à l'écran
    setTimeout(() => {
      // Scroll global en bas
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth',
      });
      // S'assurer que la nouvelle ligne est visible et focus sur le champ exercice
      const newExerciseButton = document.querySelector(
        `[data-session="${sessionId}"][data-exercise="${newExerciseId}"][data-field="exercice"] button`
      ) as HTMLElement | null;
      newExerciseButton?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      newExerciseButton?.focus();
      newExerciseButton?.click();
    }, 200);
  };

  const handleExerciseChange = (sessionId: number, exerciseId: number, field: keyof Exercise, value: string) => {
    const currentExercises = sessionExercises[sessionId] || [];
    const currentExercise = currentExercises.find((ex) => ex.id === exerciseId);

    // Si on modifie les séries d'un exercice dans un super-set, synchroniser avec tous les exercices du groupe
    if (field === "series" && currentExercise?.super_set_group) {
      const updatedExercises = currentExercises.map((ex) => {
        if (ex.super_set_group === currentExercise.super_set_group) {
          return { ...ex, series: value };
        }
        return ex.id === exerciseId ? { ...ex, [field]: value } : ex;
      });

      setSessionExercises({
        ...sessionExercises,
        [sessionId]: updatedExercises,
      });
    } else {
      const updatedExercises = currentExercises.map((ex) => (ex.id === exerciseId ? { ...ex, [field]: value } : ex));

      setSessionExercises({
        ...sessionExercises,
        [sessionId]: updatedExercises,
      });
    }
  };

  const handleDeleteExercise = (sessionId: number, exerciseId: number) => {
    const currentExercises = sessionExercises[sessionId] || [];
    const exerciseToDelete = currentExercises.find((ex) => ex.id === exerciseId);

    // Si l'exercice supprimé fait partie d'un super-set, retirer aussi le groupe des autres
    if (exerciseToDelete?.super_set_group) {
      const groupExercises = currentExercises.filter((ex) => ex.super_set_group === exerciseToDelete.super_set_group);

      // Si le groupe n'a plus que 2 exercices après suppression, retirer le groupe
      if (groupExercises.length === 2) {
        const updatedExercises = currentExercises
          .filter((ex) => ex.id !== exerciseId)
          .map((ex) =>
            ex.super_set_group === exerciseToDelete.super_set_group ? { ...ex, super_set_group: null } : ex,
          );

        setSessionExercises({
          ...sessionExercises,
          [sessionId]: updatedExercises,
        });
      } else {
        const updatedExercises = currentExercises.filter((ex) => ex.id !== exerciseId);
        setSessionExercises({
          ...sessionExercises,
          [sessionId]: updatedExercises,
        });
      }
    } else {
      const updatedExercises = currentExercises.filter((ex) => ex.id !== exerciseId);
      setSessionExercises({
        ...sessionExercises,
        [sessionId]: updatedExercises,
      });
    }

    toast.success("Ligne supprimée");
  };

  const handleToggleSuperSet = (sessionId: number, exerciseId: number) => {
    const currentExercises = sessionExercises[sessionId] || [];
    const exerciseIndex = currentExercises.findIndex((ex) => ex.id === exerciseId);

    if (exerciseIndex === -1 || exerciseIndex === currentExercises.length - 1) return;

    const currentExercise = currentExercises[exerciseIndex];
    const nextExercise = currentExercises[exerciseIndex + 1];

    // Cas 1: Aucun des deux n'est dans un groupe - créer un nouveau groupe
    if (!currentExercise.super_set_group && !nextExercise.super_set_group) {
      const newGroupId = `group-${Date.now()}`;
      const updatedExercises = currentExercises.map((ex) => {
        if (ex.id === exerciseId || ex.id === nextExercise.id) {
          return { ...ex, super_set_group: newGroupId };
        }
        return ex;
      });
      setSessionExercises({
        ...sessionExercises,
        [sessionId]: updatedExercises,
      });
      toast.success("Super-set créé !");
    }
    // Cas 2: L'exercice actuel est dans un groupe - ajouter le suivant au groupe
    else if (currentExercise.super_set_group && !nextExercise.super_set_group) {
      const updatedExercises = currentExercises.map((ex) => {
        if (ex.id === nextExercise.id) {
          return { ...ex, super_set_group: currentExercise.super_set_group };
        }
        return ex;
      });
      setSessionExercises({
        ...sessionExercises,
        [sessionId]: updatedExercises,
      });
      toast.success("Exercice ajouté au super-set !");
    }
    // Cas 3: Le suivant est dans un groupe - ajouter l'actuel au groupe
    else if (!currentExercise.super_set_group && nextExercise.super_set_group) {
      const updatedExercises = currentExercises.map((ex) => {
        if (ex.id === exerciseId) {
          return { ...ex, super_set_group: nextExercise.super_set_group };
        }
        return ex;
      });
      setSessionExercises({
        ...sessionExercises,
        [sessionId]: updatedExercises,
      });
      toast.success("Exercice ajouté au super-set !");
    }
    // Cas 4: Les deux sont dans le même groupe - retirer le lien entre eux
    else if (currentExercise.super_set_group === nextExercise.super_set_group) {
      const groupId = currentExercise.super_set_group;
      const groupExercises = currentExercises.filter((ex) => ex.super_set_group === groupId);

      // Trouver l'index du prochain exercice dans le groupe
      const groupIndexes = groupExercises.map((ex) => currentExercises.findIndex((e) => e.id === ex.id));
      const currentGroupIndex = groupIndexes.indexOf(exerciseIndex);
      const nextGroupIndex = groupIndexes.indexOf(exerciseIndex + 1);

      // Si ce sont les deux derniers du groupe adjacents
      if (currentGroupIndex !== -1 && nextGroupIndex === currentGroupIndex + 1) {
        // Créer un nouveau groupe pour les exercices après la coupure
        const newGroupId = `group-${Date.now()}`;
        const updatedExercises = currentExercises.map((ex) => {
          const exIndex = currentExercises.findIndex((e) => e.id === ex.id);
          if (ex.super_set_group === groupId && exIndex > exerciseIndex) {
            return { ...ex, super_set_group: newGroupId };
          }
          return ex;
        });

        setSessionExercises({
          ...sessionExercises,
          [sessionId]: updatedExercises,
        });
        toast.success("Super-set séparé !");
      }
    }
  };

  const isInSameGroup = (sessionId: number, exerciseId: number, nextExerciseId: number): boolean => {
    const currentExercises = sessionExercises[sessionId] || [];
    const exercise = currentExercises.find((ex) => ex.id === exerciseId);
    const nextExercise = currentExercises.find((ex) => ex.id === nextExerciseId);

    return !!(
      exercise?.super_set_group &&
      nextExercise?.super_set_group &&
      exercise.super_set_group === nextExercise.super_set_group
    );
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
            `[data-session="${sessionId}"][data-exercise="${newExerciseId}"][data-field="exercice"] button`,
          ) as HTMLElement;
          newExerciseInput?.focus();
          newExerciseInput?.click();
        }, 100);
      } else {
        // Pour les autres champs, passer au champ suivant
        const fieldOrder: (keyof Exercise)[] = [
          "exercice",
          "recuperation",
          "reps",
          "series",
          "charge",
          "rpe",
          "tempo",
          "commentaire",
        ];
        const currentIndex = fieldOrder.indexOf(field);
        const nextField = fieldOrder[currentIndex + 1];

        if (nextField) {
          const nextInput = document.querySelector(
            `[data-session="${sessionId}"][data-exercise="${exerciseId}"][data-field="${nextField}"]`,
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("/coach/mes-clients")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour à mes clients
        </Button>
      </div>

      <div className="flex items-center justify-between bg-muted/30 p-2 rounded-md">
        <div>
          <h2 className="text-base font-semibold">
            {athlete.first_name} {athlete.last_name}
          </h2>
          <p className="text-xs text-muted-foreground">{athlete.email}</p>
        </div>
        <div className="text-xs text-muted-foreground text-right">
          {athlete.gender && (
            <p>{athlete.gender === "female" ? "Femme" : athlete.gender === "male" ? "Homme" : "Autre"}</p>
          )}
          {athlete.date_of_birth && <p>{new Date(athlete.date_of_birth).toLocaleDateString("fr-FR")}</p>}
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
            <Collapsible open={showLastWeekFeedback} onOpenChange={setShowLastWeekFeedback}>
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-80 transition-opacity">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <CardTitle className="text-sm">
                        Retours de la semaine {lastWeekData.week.week_number} - {lastWeekData.week.year}
                      </CardTitle>
                    </div>
                    {showLastWeekFeedback ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-0 px-4 pb-3">
                    <div className="space-y-2">
                      {lastWeekData.sessions.map((session: any) => (
                        <div key={session.id} className="border rounded-lg p-2 bg-background">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-semibold text-xs">{session.name}</h4>
                            <div className="flex gap-2 text-[10px] text-muted-foreground">
                              {session.completed_at && (
                                <span>{new Date(session.completed_at).toLocaleDateString()}</span>
                              )}
                              {session.duration_minutes && <span>{session.duration_minutes} min</span>}
                            </div>
                          </div>

                          {session.session_exercises && session.session_exercises.length > 0 ? (
                            <div className="space-y-1">
                              {session.session_exercises
                                .filter((ex: any) => ex.sportif_rpe || ex.sportif_comment)
                                .sort((a: any, b: any) => a.exercise_order - b.exercise_order)
                                .map((ex: any) => (
                                  <div key={ex.id} className="pl-2 border-l-2 border-primary/30 py-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1">
                                        <div className="font-medium text-xs">{ex.exercice}</div>
                                        <div className="text-[10px] text-muted-foreground mt-0.5">
                                          Prescrit: {ex.series}x{ex.reps} @ {ex.charge} • RPE {ex.rpe}
                                        </div>
                                      </div>
                                      {ex.sportif_rpe && (
                                        <Badge variant="secondary" className="shrink-0 text-[10px] h-4">
                                          RPE: {ex.sportif_rpe}
                                        </Badge>
                                      )}
                                    </div>
                                    {ex.sportif_comment && (
                                      <div className="mt-1 text-[10px] italic text-muted-foreground bg-muted/50 p-1.5 rounded">
                                        "{ex.sportif_comment}"
                                      </div>
                                    )}
                                  </div>
                                ))}
                              {!session.session_exercises.some((ex: any) => ex.sportif_rpe || ex.sportif_comment) && (
                                <p className="text-[10px] text-muted-foreground text-center py-1">
                                  Aucun retour du sportif pour cette séance
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-[10px] text-muted-foreground text-center py-1">Aucun exercice</p>
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
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-base">Nouvelle programmation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              {/* Sélecteur de semaine - toujours visible */}
              {!isValidated && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-sm">Sélectionne la semaine à programmer</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Tu peux programmer jusqu'à 12 semaines à l'avance</p>
                      <select
                        className="w-full p-2 border rounded-md bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                        value={
                          selectedWeekToProgram ? `${selectedWeekToProgram.week}-${selectedWeekToProgram.year}` : ""
                        }
                        onChange={(e) => {
                          if (!e.target.value) {
                            setSelectedWeekToProgram(null);
                            return;
                          }
                          const [week, year] = e.target.value.split("-").map(Number);
                          setSelectedWeekToProgram({ week, year });
                        }}
                      >
                        <option value="">-- Choisir une semaine --</option>
                        {availableWeeks.map((w) => (
                          <option key={`${w.week}-${w.year}`} value={`${w.week}-${w.year}`}>
                            Semaine {w.week} - {w.year} (du{" "}
                            {w.date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })})
                          </option>
                        ))}
                      </select>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Bouton de validation en haut */}
              {!isValidated && sessions.length > 0 && (
                <div className="flex justify-end items-center gap-2">
                  <Button onClick={handleValidate} size="sm" disabled={!selectedWeekToProgram}>
                    <Check className="h-4 w-4 mr-2" />
                    Valider la programmation
                  </Button>
                </div>
              )}
              {sessions.length === 0 ? (
                <div className="text-center py-6 space-y-2">
                  <p className="text-sm text-muted-foreground">Aucune séance créée.</p>
                  {historicalWeeks.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Vous pouvez créer une nouvelle séance ou copier une semaine précédente.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Cliquez sur "Créer une séance" pour commencer.</p>
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
                            <Badge variant="outline">{expandedSessionId === session.id ? "Ouvert" : "Fermé"}</Badge>
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
                                      Aucune séance cardio ajoutée. Clique sur "Ajouter une séance cardio" pour
                                      commencer.
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
                                              onChange={(e) =>
                                                handleExerciseChange(
                                                  session.id,
                                                  exercise.id,
                                                  "cardio_sport",
                                                  e.target.value,
                                                )
                                              }
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
                                                onChange={(e) =>
                                                  handleExerciseChange(
                                                    session.id,
                                                    exercise.id,
                                                    "cardio_pace",
                                                    e.target.value,
                                                  )
                                                }
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
                                            onChange={(e) =>
                                              handleExerciseChange(
                                                session.id,
                                                exercise.id,
                                                "cardio_content",
                                                e.target.value,
                                              )
                                            }
                                            placeholder="Décris le contenu de la séance..."
                                            disabled={isValidated}
                                          />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                          <div>
                                            <label className="text-sm font-medium mb-1 block">RPE</label>
                                            <Input
                                              value={exercise.rpe || ""}
                                              onChange={(e) =>
                                                handleExerciseChange(session.id, exercise.id, "rpe", e.target.value)
                                              }
                                              placeholder="ex: 7"
                                              disabled={isValidated}
                                            />
                                          </div>
                                          <div>
                                            <label className="text-sm font-medium mb-1 block">Commentaire</label>
                                            <Input
                                              value={exercise.commentaire || ""}
                                              onChange={(e) =>
                                                handleExerciseChange(
                                                  session.id,
                                                  exercise.id,
                                                  "commentaire",
                                                  e.target.value,
                                                )
                                              }
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
                                          (() => {
                                            const exercises = sessionExercises[session.id] || [];
                                            const result: JSX.Element[] = [];
                                            let i = 0;

                                            while (i < exercises.length) {
                                              const exercise = exercises[i];

                                              // Si l'exercice fait partie d'un super-set
                                              if (exercise.super_set_group) {
                                                // Trouver tous les exercices du groupe
                                                const groupExercises = [];
                                                let j = i;
                                                while (
                                                  j < exercises.length &&
                                                  exercises[j].super_set_group === exercise.super_set_group
                                                ) {
                                                  groupExercises.push(exercises[j]);
                                                  j++;
                                                }

                                                // Rendu du bloc super-set
                                                result.push(
                                                  <React.Fragment key={`superset-${exercise.super_set_group}`}>
                                                    {/* Séparateur visuel avant le super-set */}
                                                    <TableRow>
                                                      <TableCell
                                                        colSpan={9}
                                                        className="p-0 h-2 bg-muted/30"
                                                      ></TableCell>
                                                    </TableRow>

                                                    {/* En-tête du super-set avec la case de série commune */}
                                                    <TableRow className="bg-primary/10 border-l-4 border-l-primary">
                                                      <TableCell colSpan={3} className="font-semibold">
                                                        <Badge variant="default" className="mr-2">
                                                          Super-set ({groupExercises.length} exercices)
                                                        </Badge>
                                                      </TableCell>
                                                      <TableCell>
                                                        <div className="font-medium">
                                                          <label className="text-xs text-muted-foreground mb-1 block">
                                                            Séries communes
                                                          </label>
                                                          <Input
                                                            value={exercise.series}
                                                            onChange={(e) =>
                                                              handleExerciseChange(
                                                                session.id,
                                                                exercise.id,
                                                                "series",
                                                                e.target.value,
                                                              )
                                                            }
                                                            placeholder="ex: 3"
                                                            disabled={isValidated}
                                                            className="font-semibold bg-background"
                                                          />
                                                        </div>
                                                      </TableCell>
                                                      <TableCell colSpan={5}></TableCell>
                                                    </TableRow>

                                                    {/* Exercices du super-set */}
                                                    {groupExercises.map((ex, exIndex) => {
                                                      const nextExercise = groupExercises[exIndex + 1];
                                                      const inGroup =
                                                        nextExercise &&
                                                        isInSameGroup(session.id, ex.id, nextExercise.id);

                                                      return (
                                                        <React.Fragment key={ex.id}>
                                                          <TableRow className="bg-primary/5 border-l-4 border-l-primary">
                                                            <TableCell>
                                                              <div
                                                                data-session={session.id}
                                                                data-exercise={ex.id}
                                                                data-field="exercice"
                                                              >
                                                                <ExerciseCombobox
                                                                  value={ex.exercice}
                                                                  onChange={(value) => {
                                                                    handleExerciseChange(
                                                                      session.id,
                                                                      ex.id,
                                                                      "exercice",
                                                                      value,
                                                                    );
                                                                    setTimeout(() => {
                                                                      const nextInput = document.querySelector(
                                                                        `[data-session="${session.id}"][data-exercise="${ex.id}"][data-field="recuperation"]`,
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
                                                                value={ex.recuperation}
                                                                onValueChange={(value) => {
                                                                  handleExerciseChange(
                                                                    session.id,
                                                                    ex.id,
                                                                    "recuperation",
                                                                    value,
                                                                  );
                                                                  setTimeout(() => {
                                                                    const nextInput = document.querySelector(
                                                                      `[data-session="${session.id}"][data-exercise="${ex.id}"][data-field="reps"]`,
                                                                    ) as HTMLInputElement;
                                                                    nextInput?.focus();
                                                                  }, 100);
                                                                }}
                                                                disabled={isValidated}
                                                              >
                                                                <SelectTrigger
                                                                  data-session={session.id}
                                                                  data-exercise={ex.id}
                                                                  data-field="recuperation"
                                                                >
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
                                                                value={ex.reps}
                                                                onChange={(e) =>
                                                                  handleExerciseChange(
                                                                    session.id,
                                                                    ex.id,
                                                                    "reps",
                                                                    e.target.value,
                                                                  )
                                                                }
                                                                onKeyDown={(e) =>
                                                                  handleKeyDown(e, session.id, ex.id, "reps")
                                                                }
                                                                placeholder="ex: 10"
                                                                disabled={isValidated}
                                                                data-session={session.id}
                                                                data-exercise={ex.id}
                                                                data-field="reps"
                                                              />
                                                            </TableCell>
                                                            <TableCell>
                                                              {/* Case de série masquée pour les exercices du super-set */}
                                                              <div className="text-center text-muted-foreground text-xs">
                                                                (voir en-tête)
                                                              </div>
                                                            </TableCell>
                                                            <TableCell>
                                                              <Input
                                                                value={ex.charge}
                                                                onChange={(e) =>
                                                                  handleExerciseChange(
                                                                    session.id,
                                                                    ex.id,
                                                                    "charge",
                                                                    e.target.value,
                                                                  )
                                                                }
                                                                onKeyDown={(e) =>
                                                                  handleKeyDown(e, session.id, ex.id, "charge")
                                                                }
                                                                placeholder="ex: 80kg"
                                                                disabled={isValidated}
                                                                data-session={session.id}
                                                                data-exercise={ex.id}
                                                                data-field="charge"
                                                              />
                                                            </TableCell>
                                                            <TableCell>
                                                              <Input
                                                                value={ex.rpe}
                                                                onChange={(e) =>
                                                                  handleExerciseChange(
                                                                    session.id,
                                                                    ex.id,
                                                                    "rpe",
                                                                    e.target.value,
                                                                  )
                                                                }
                                                                onKeyDown={(e) =>
                                                                  handleKeyDown(e, session.id, ex.id, "rpe")
                                                                }
                                                                placeholder="ex: 8"
                                                                disabled={isValidated}
                                                                data-session={session.id}
                                                                data-exercise={ex.id}
                                                                data-field="rpe"
                                                              />
                                                            </TableCell>
                                                            <TableCell>
                                                              <Input
                                                                value={ex.tempo}
                                                                onChange={(e) =>
                                                                  handleExerciseChange(
                                                                    session.id,
                                                                    ex.id,
                                                                    "tempo",
                                                                    e.target.value,
                                                                  )
                                                                }
                                                                onKeyDown={(e) =>
                                                                  handleKeyDown(e, session.id, ex.id, "tempo")
                                                                }
                                                                placeholder="ex: 3010"
                                                                disabled={isValidated}
                                                                data-session={session.id}
                                                                data-exercise={ex.id}
                                                                data-field="tempo"
                                                              />
                                                            </TableCell>
                                                            <TableCell>
                                                              <Input
                                                                value={ex.commentaire}
                                                                onChange={(e) =>
                                                                  handleExerciseChange(
                                                                    session.id,
                                                                    ex.id,
                                                                    "commentaire",
                                                                    e.target.value,
                                                                  )
                                                                }
                                                                onKeyDown={(e) =>
                                                                  handleKeyDown(e, session.id, ex.id, "commentaire")
                                                                }
                                                                placeholder="Notes..."
                                                                disabled={isValidated}
                                                                data-session={session.id}
                                                                data-exercise={ex.id}
                                                                data-field="commentaire"
                                                              />
                                                            </TableCell>
                                                            <TableCell>
                                                              {!isValidated && (
                                                                <Button
                                                                  variant="ghost"
                                                                  size="sm"
                                                                  onClick={() =>
                                                                    handleDeleteExercise(session.id, ex.id)
                                                                  }
                                                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                >
                                                                  <X className="h-4 w-4" />
                                                                </Button>
                                                              )}
                                                            </TableCell>
                                                          </TableRow>

                                                          {/* Bouton pour gérer les liens dans le super-set */}
                                                          {exIndex < groupExercises.length - 1 && !isValidated && (
                                                            <TableRow>
                                                              <TableCell
                                                                colSpan={9}
                                                                className="p-0 h-6 relative group bg-primary/5 border-l-4 border-l-primary"
                                                              >
                                                                <div className="absolute inset-0 flex items-center justify-center">
                                                                  <Button
                                                                    variant="default"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                      handleToggleSuperSet(session.id, ex.id)
                                                                    }
                                                                    className="h-5 px-2 text-xs bg-destructive hover:bg-destructive/80"
                                                                  >
                                                                    <X className="h-3 w-3 mr-1" />
                                                                    Séparer
                                                                  </Button>
                                                                </div>
                                                              </TableCell>
                                                            </TableRow>
                                                          )}
                                                        </React.Fragment>
                                                      );
                                                    })}

                                                    {/* Séparateur visuel après le super-set */}
                                                    <TableRow>
                                                      <TableCell
                                                        colSpan={9}
                                                        className="p-0 h-2 bg-muted/30"
                                                      ></TableCell>
                                                    </TableRow>

                                                    {/* Bouton pour ajouter au super-set si pas le dernier exercice */}
                                                    {i + groupExercises.length < exercises.length && !isValidated && (
                                                      <TableRow>
                                                        <TableCell colSpan={9} className="p-0 h-8 relative group">
                                                          <div className="absolute inset-0 flex items-center justify-center">
                                                            <Button
                                                              variant="ghost"
                                                              size="sm"
                                                              onClick={() =>
                                                                handleToggleSuperSet(
                                                                  session.id,
                                                                  groupExercises[groupExercises.length - 1].id,
                                                                )
                                                              }
                                                              className="h-6 px-3 opacity-0 group-hover:opacity-100 hover:bg-primary/10"
                                                            >
                                                              <Plus className="h-3 w-3 mr-1" />
                                                              Ajouter au super-set
                                                            </Button>
                                                          </div>
                                                        </TableCell>
                                                      </TableRow>
                                                    )}
                                                  </React.Fragment>,
                                                );

                                                i = j; // Passer au prochain exercice après le groupe
                                              } else {
                                                // Exercice normal (pas dans un super-set)
                                                const nextExercise = exercises[i + 1];
                                                const isLastExercise = i === exercises.length - 1;
                                                const inGroup =
                                                  nextExercise &&
                                                  isInSameGroup(session.id, exercise.id, nextExercise.id);

                                                result.push(
                                                  <React.Fragment key={exercise.id}>
                                                    <TableRow>
                                                      <TableCell>
                                                        <div
                                                          data-session={session.id}
                                                          data-exercise={exercise.id}
                                                          data-field="exercice"
                                                        >
                                                          <ExerciseCombobox
                                                            value={exercise.exercice}
                                                            onChange={(value) => {
                                                              handleExerciseChange(
                                                                session.id,
                                                                exercise.id,
                                                                "exercice",
                                                                value,
                                                              );
                                                              setTimeout(() => {
                                                                const nextInput = document.querySelector(
                                                                  `[data-session="${session.id}"][data-exercise="${exercise.id}"][data-field="recuperation"]`,
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
                                                            handleExerciseChange(
                                                              session.id,
                                                              exercise.id,
                                                              "recuperation",
                                                              value,
                                                            );
                                                            setTimeout(() => {
                                                              const nextInput = document.querySelector(
                                                                `[data-session="${session.id}"][data-exercise="${exercise.id}"][data-field="reps"]`,
                                                              ) as HTMLInputElement;
                                                              nextInput?.focus();
                                                            }, 100);
                                                          }}
                                                          disabled={isValidated}
                                                        >
                                                          <SelectTrigger
                                                            data-session={session.id}
                                                            data-exercise={exercise.id}
                                                            data-field="recuperation"
                                                          >
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
                                                          onChange={(e) =>
                                                            handleExerciseChange(
                                                              session.id,
                                                              exercise.id,
                                                              "reps",
                                                              e.target.value,
                                                            )
                                                          }
                                                          onKeyDown={(e) =>
                                                            handleKeyDown(e, session.id, exercise.id, "reps")
                                                          }
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
                                                          onChange={(e) =>
                                                            handleExerciseChange(
                                                              session.id,
                                                              exercise.id,
                                                              "series",
                                                              e.target.value,
                                                            )
                                                          }
                                                          onKeyDown={(e) =>
                                                            handleKeyDown(e, session.id, exercise.id, "series")
                                                          }
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
                                                          onChange={(e) =>
                                                            handleExerciseChange(
                                                              session.id,
                                                              exercise.id,
                                                              "charge",
                                                              e.target.value,
                                                            )
                                                          }
                                                          onKeyDown={(e) =>
                                                            handleKeyDown(e, session.id, exercise.id, "charge")
                                                          }
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
                                                          onChange={(e) =>
                                                            handleExerciseChange(
                                                              session.id,
                                                              exercise.id,
                                                              "rpe",
                                                              e.target.value,
                                                            )
                                                          }
                                                          onKeyDown={(e) =>
                                                            handleKeyDown(e, session.id, exercise.id, "rpe")
                                                          }
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
                                                          onChange={(e) =>
                                                            handleExerciseChange(
                                                              session.id,
                                                              exercise.id,
                                                              "tempo",
                                                              e.target.value,
                                                            )
                                                          }
                                                          onKeyDown={(e) =>
                                                            handleKeyDown(e, session.id, exercise.id, "tempo")
                                                          }
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
                                                          onChange={(e) =>
                                                            handleExerciseChange(
                                                              session.id,
                                                              exercise.id,
                                                              "commentaire",
                                                              e.target.value,
                                                            )
                                                          }
                                                          onKeyDown={(e) =>
                                                            handleKeyDown(e, session.id, exercise.id, "commentaire")
                                                          }
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
                                                            onClick={() =>
                                                              handleDeleteExercise(session.id, exercise.id)
                                                            }
                                                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                          >
                                                            <X className="h-4 w-4" />
                                                          </Button>
                                                        )}
                                                      </TableCell>
                                                    </TableRow>

                                                    {/* Bouton pour créer un super-set */}
                                                    {!isLastExercise && !isValidated && (
                                                      <TableRow>
                                                        <TableCell colSpan={9} className="p-0 h-8 relative group">
                                                          <div className="absolute inset-0 flex items-center justify-center">
                                                            <Button
                                                              variant={inGroup ? "default" : "ghost"}
                                                              size="sm"
                                                              onClick={() =>
                                                                handleToggleSuperSet(session.id, exercise.id)
                                                              }
                                                              className={`h-6 px-3 transition-all ${
                                                                inGroup
                                                                  ? "bg-primary hover:bg-primary/80"
                                                                  : "opacity-0 group-hover:opacity-100 hover:bg-primary/10"
                                                              }`}
                                                            >
                                                              <Plus className="h-3 w-3 mr-1" />
                                                              Super-set
                                                            </Button>
                                                          </div>
                                                        </TableCell>
                                                      </TableRow>
                                                    )}
                                                  </React.Fragment>,
                                                );

                                                i++;
                                              }
                                            }

                                            return result;
                                          })()
                                        )}
                                      </TableBody>
                                    </Table>
                                  </div>

                                  {!isValidated && (
                                    <Button onClick={() => handleAddExercise(session.id)} variant="outline" size="sm">
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


                  {isValidated && (
                    <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                      <p className="text-sm font-medium text-primary">
                        ✓ Semaine validée - Le sportif peut maintenant voir ses séances
                      </p>
                    </div>
                  )}
                </>
              )}

              {!isValidated && (
                <div className="mt-6 flex justify-between gap-2">
                  {historicalWeeks.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCopyDialog(true)}
                      disabled={!selectedWeekToProgram}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copier d'une semaine
                    </Button>
                  )}
                  <div className="flex gap-2 ml-auto">
                    <Button
                      size="sm"
                      variant={newSessionType === "renfo" ? "default" : "outline"}
                      onClick={() => setNewSessionType("renfo")}
                      disabled={!selectedWeekToProgram}
                    >
                      Renfo
                    </Button>
                    <Button
                      size="sm"
                      variant={newSessionType === "cardio" ? "default" : "outline"}
                      onClick={() => setNewSessionType("cardio")}
                      disabled={!selectedWeekToProgram}
                    >
                      Cardio
                    </Button>
                    <Button size="sm" onClick={handleCreateSession} disabled={!selectedWeekToProgram}>
                      <Plus className="h-4 w-4 mr-2" />
                      Créer
                    </Button>
                  </div>
                </div>
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
              <p className="mt-4 text-sm text-muted-foreground">Fonctionnalité en cours de développement...</p>
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
                    <label className="text-sm font-medium mb-2 block">Sélectionner une semaine</label>
                    <select
                      className="w-full p-2 border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                      value={selectedHistoricalWeek?.id || ""}
                      onChange={(e) => handleSelectHistoricalWeek(e.target.value)}
                    >
                      <option value="">-- Choisir une semaine --</option>
                      {historicalWeeks.map((week) => (
                        <option key={week.id} value={week.id}>
                          Semaine {week.week_number} - {week.year} (validée le{" "}
                          {new Date(week.validated_at).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedHistoricalWeek && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold">
                              Semaine {selectedHistoricalWeek.week_number} - {selectedHistoricalWeek.year}
                            </h3>
                            {(() => {
                              const weekSessions = historicalSessions.filter((s: any) => s.week_id === selectedHistoricalWeek.id);
                              if (weekSessions.length === 0) return null;
                              
                              let totalExercises = 0;
                              let completedExercises = 0;
                              
                              weekSessions.forEach((s: any) => {
                                const exercises = s.session_exercises || [];
                                totalExercises += exercises.length;
                                completedExercises += exercises.filter((ex: any) => ex.sportif_rpe !== null).length;
                              });
                              
                              if (totalExercises === 0) return null;
                              if (completedExercises === 0) {
                                return <Badge variant="outline" className="text-muted-foreground">Non commencée</Badge>;
                              } else if (completedExercises === totalExercises) {
                                return <Badge className="bg-green-600 text-white">Semaine terminée</Badge>;
                              } else {
                                return <Badge className="bg-orange-500 text-white">En cours ({completedExercises}/{totalExercises} exos)</Badge>;
                              }
                            })()}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Validée le {new Date(selectedHistoricalWeek.validated_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {!isEditingHistorical ? (
                            <Button onClick={handleStartEditingHistorical} variant="outline">
                              Modifier
                            </Button>
                          ) : (
                            <>
                              <Button onClick={handleSaveHistoricalChanges} variant="default">
                                <Check className="h-4 w-4 mr-2" />
                                Enregistrer
                              </Button>
                              <Button onClick={handleCancelEditingHistorical} variant="outline">
                                Annuler
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        {isEditingHistorical && (
                          <Card className="bg-primary/5 border-primary/20">
                            <CardContent className="pt-4">
                              <div className="space-y-3">
                                <div className="flex gap-2">
                                  <Button
                                    variant={newHistoricalSessionType === "renfo" ? "default" : "outline"}
                                    onClick={() => setNewHistoricalSessionType("renfo")}
                                    size="sm"
                                  >
                                    Renfo
                                  </Button>
                                  <Button
                                    variant={newHistoricalSessionType === "cardio" ? "default" : "outline"}
                                    onClick={() => setNewHistoricalSessionType("cardio")}
                                    size="sm"
                                  >
                                    Cardio
                                  </Button>
                                </div>
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="Nom de la séance"
                                    value={newHistoricalSessionName}
                                    onChange={(e) => setNewHistoricalSessionName(e.target.value)}
                                    onKeyPress={(e) => e.key === "Enter" && handleAddHistoricalSession()}
                                  />
                                  <Button onClick={handleAddHistoricalSession} size="sm">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Ajouter séance
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}

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
                                <Badge variant={session.session_type === "cardio" ? "secondary" : "outline"}>
                                  {session.session_type === "cardio" ? "Cardio" : "Renfo"}
                                </Badge>
                                {(() => {
                                  const exercises = session.session_exercises || [];
                                  if (exercises.length === 0) return null;
                                  const completedCount = exercises.filter((ex: any) => ex.sportif_rpe !== null).length;
                                  if (completedCount === 0) {
                                    return <Badge variant="outline" className="text-muted-foreground">Non commencée</Badge>;
                                  } else if (completedCount === exercises.length) {
                                    return <Badge className="bg-green-600 text-white">Terminée</Badge>;
                                  } else {
                                    return <Badge className="bg-orange-500 text-white">En cours ({completedCount}/{exercises.length})</Badge>;
                                  }
                                })()}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{session.session_exercises?.length || 0} exercices</Badge>
                                {session.duration_minutes && (
                                  <Badge variant="secondary">{session.duration_minutes} min</Badge>
                                )}
                                {isEditingHistorical && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteHistoricalSession(session.id);
                                    }}
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>

                            {expandedHistoricalSessionId === session.id && (
                              <div className="border-t p-4 bg-muted/20">
                                {/* Info de la séance */}
                                <div className="flex gap-6 mb-4 p-3 bg-background rounded-md">
                                  {session.completed_at && (
                                    <div>
                                      <span className="text-sm text-muted-foreground">Date de réalisation: </span>
                                      <span className="font-medium">
                                        {new Date(session.completed_at).toLocaleDateString()} à{" "}
                                        {new Date(session.completed_at).toLocaleTimeString()}
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
                                        {isEditingHistorical && <TableHead className="w-[50px]"></TableHead>}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {editedHistoricalExercises[session.id] &&
                                      editedHistoricalExercises[session.id].length > 0 ? (
                                        editedHistoricalExercises[session.id].map((exercise: any) => (
                                          <TableRow key={exercise.id}>
                                            <TableCell>
                                              {isEditingHistorical ? (
                                                <ExerciseCombobox
                                                  value={exercise.exercice}
                                                  onChange={(value) =>
                                                    handleHistoricalExerciseChange(
                                                      session.id,
                                                      exercise.id,
                                                      "exercice",
                                                      value,
                                                    )
                                                  }
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
                                                  onValueChange={(value) =>
                                                    handleHistoricalExerciseChange(
                                                      session.id,
                                                      exercise.id,
                                                      "recuperation",
                                                      value,
                                                    )
                                                  }
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
                                                  onChange={(e) =>
                                                    handleHistoricalExerciseChange(
                                                      session.id,
                                                      exercise.id,
                                                      "reps",
                                                      e.target.value,
                                                    )
                                                  }
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
                                                  onChange={(e) =>
                                                    handleHistoricalExerciseChange(
                                                      session.id,
                                                      exercise.id,
                                                      "series",
                                                      e.target.value,
                                                    )
                                                  }
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
                                                  onChange={(e) =>
                                                    handleHistoricalExerciseChange(
                                                      session.id,
                                                      exercise.id,
                                                      "charge",
                                                      e.target.value,
                                                    )
                                                  }
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
                                                  onChange={(e) =>
                                                    handleHistoricalExerciseChange(
                                                      session.id,
                                                      exercise.id,
                                                      "rpe",
                                                      e.target.value,
                                                    )
                                                  }
                                                  placeholder="ex: 7"
                                                />
                                              ) : (
                                                exercise.rpe || "-"
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              <div className="space-y-1">
                                                <div
                                                  className={
                                                    exercise.sportif_rpe
                                                      ? "font-medium text-primary"
                                                      : "text-muted-foreground"
                                                  }
                                                >
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
                                                  onChange={(e) =>
                                                    handleHistoricalExerciseChange(
                                                      session.id,
                                                      exercise.id,
                                                      "tempo",
                                                      e.target.value,
                                                    )
                                                  }
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
                                                  onChange={(e) =>
                                                    handleHistoricalExerciseChange(
                                                      session.id,
                                                      exercise.id,
                                                      "commentaire",
                                                      e.target.value,
                                                    )
                                                  }
                                                  placeholder="Notes..."
                                                />
                                              ) : (
                                                exercise.commentaire || "-"
                                              )}
                                            </TableCell>
                                            <TableCell>
                                              {exercise.sportif_comment ? (
                                                <div className="max-w-xs">
                                                  <p className="text-sm whitespace-pre-wrap">
                                                    {exercise.sportif_comment}
                                                  </p>
                                                </div>
                                              ) : (
                                                <span className="text-muted-foreground">-</span>
                                              )}
                                            </TableCell>
                                            {isEditingHistorical && (
                                              <TableCell>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => handleDeleteHistoricalExercise(exercise.id)}
                                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                >
                                                  <X className="h-4 w-4" />
                                                </Button>
                                              </TableCell>
                                            )}
                                          </TableRow>
                                        ))
                                      ) : (
                                        <TableRow>
                                          <TableCell
                                            colSpan={isEditingHistorical ? 11 : 10}
                                            className="text-center text-muted-foreground"
                                          >
                                            Aucun exercice
                                          </TableCell>
                                        </TableRow>
                                      )}
                                    </TableBody>
                                  </Table>
                                </div>

                                {isEditingHistorical && (
                                  <div className="mt-3">
                                    <Button
                                      onClick={() => handleAddHistoricalExercise(session.id)}
                                      variant="outline"
                                      size="sm"
                                    >
                                      <Plus className="h-4 w-4 mr-2" />
                                      Ajouter un exercice
                                    </Button>
                                  </div>
                                )}
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
              Sélectionnez une semaine à copier. Vous pourrez voir les retours du sportif et modifier les exercices
              avant validation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Sélectionner une semaine</label>
              <select
                className="w-full p-2 border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                value={selectedWeekToCopy}
                onChange={(e) => handleSelectWeekForPreview(e.target.value)}
              >
                <option value="">-- Choisir une semaine --</option>
                {historicalWeeks.map((week) => (
                  <option key={week.id} value={week.id}>
                    Semaine {week.week_number} - {week.year} (validée le{" "}
                    {new Date(week.validated_at).toLocaleDateString()})
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
            <Button
              variant="outline"
              onClick={() => {
                setShowCopyDialog(false);
                setSelectedWeekToCopy("");
                setWeekToCopyData(null);
              }}
            >
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
