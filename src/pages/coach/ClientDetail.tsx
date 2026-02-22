import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { parsePaceToDecimal, formatPaceFromDecimal } from "@/lib/cardioCalculations";
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
  Target,
  ChevronLeft,
  GripVertical,
  Dumbbell,
  Activity,
  StickyNote,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Search,
  Video,
  CreditCard,
  Footprints,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ExerciseCombobox } from "@/components/ExerciseCombobox";
import { getWeekNumber, getNextWeeks, formatWeekRange, getWeekYear } from "@/lib/weekUtils";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CoachMaxesView } from "@/components/CoachMaxesView";
import { CoachFatigueView } from "@/components/CoachFatigueView";
import { CoachFatigueAlert } from "@/components/CoachFatigueAlert";
import { CoachFcReminderAlert } from "@/components/CoachFcReminderAlert";
import { CoachWeightView } from "@/components/CoachWeightView";
import { CoachRunningView } from "@/components/CoachRunningView";
import { CoachCyclingView } from "@/components/CoachCyclingView";
import { CoachSwimmingView } from "@/components/CoachSwimmingView";
import { CoachStrengthView } from "@/components/CoachStrengthView";
import { CoachTriathlonView } from "@/components/CoachTriathlonView";
import { CoachExerciseProgressPanel } from "@/components/CoachExerciseProgressPanel";
import { CoachObjectivesView } from "@/components/CoachObjectivesView";
import { CoachObjectiveAlert } from "@/components/CoachObjectiveAlert";
import { CoachSubscriptionManager } from "@/components/CoachSubscriptionManager";
import { CoachClientSummaryView } from "@/components/CoachClientSummaryView";

import { calculate1RM } from "@/lib/maxCalculations";
import { calculateSessionDuration, formatSessionDuration } from "@/lib/sessionDurationCalculator";
import { CardioStepBuilder, CardioStep, CardioData, CardioBlock } from "@/components/CardioStepBuilder";
import { formatCardioTime, formatCardioDistance, calculatePace, calculateCardioSessionDuration, formatCardioSessionDuration, calculateCardioMetrics } from "@/lib/cardioCalculations";
import { getISOWeek, subDays, format, startOfDay, endOfDay } from "date-fns";

interface AthleteProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  date_of_birth: string | null;
  gender: string | null;
  role: string;
  adaptation_period_level?: "legere" | "moyenne" | "grosse" | null;
  payment_enabled?: boolean;
}

interface Session {
  id: number;
  name: string;
  isExpanded: boolean;
  session_type: "renfo" | "cardio" | "recup";
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
  cardio_sport?: "course" | "natation" | "velo" | "yoga" | "hiit" | "";
  cardio_content?: string;
  cardio_pace?: string;
  super_set_group?: string | null;
  per_side?: boolean;
  is_unilateral?: boolean;
  is_duration?: boolean;
  request_video?: boolean;
}

export default function ClientDetail() {
  const { athleteId } = useParams();
  const navigate = useNavigate();
  const [athlete, setAthlete] = useState<AthleteProfile | null>(null);
  const [athleteVma, setAthleteVma] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null);
  const [isValidated, setIsValidated] = useState(false);
  const [sessionExercises, setSessionExercises] = useState<Record<number, Exercise[]>>({});
  const [libraryExercises, setLibraryExercises] = useState<Array<{ id: string; name: string; unilateral?: boolean; category?: string }>>([]);
  const [historicalWeeks, setHistoricalWeeks] = useState<any[]>([]);
  const [selectedHistoricalWeek, setSelectedHistoricalWeek] = useState<any>(null);
  const [historicalSessions, setHistoricalSessions] = useState<any[]>([]);
  const [customSessions, setCustomSessions] = useState<any[]>([]);
  const [expandedHistoricalSessionId, setExpandedHistoricalSessionId] = useState<string | null>(null);
  const [isEditingHistorical, setIsEditingHistorical] = useState(false);
  const [editedHistoricalExercises, setEditedHistoricalExercises] = useState<Record<string, any[]>>({});
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [selectedWeekToCopy, setSelectedWeekToCopy] = useState<string>("");
  const [weekToCopyData, setWeekToCopyData] = useState<any>(null);
  const [copiedWeekFeedback, setCopiedWeekFeedback] = useState<Record<string, { 
    sportif_rpe?: string | null; 
    sportif_comment?: string | null; 
    skipped?: boolean;
  }>>({});
  const [showFeedbackSheet, setShowFeedbackSheet] = useState(false);
  const [lastWeekData, setLastWeekData] = useState<any>(null);
  const [newHistoricalSessionName, setNewHistoricalSessionName] = useState("");
  const [newHistoricalSessionType, setNewHistoricalSessionType] = useState<"renfo" | "cardio" | "recup">("renfo");
  const [selectedWeekToProgram, setSelectedWeekToProgram] = useState<{ week: number; year: number }>(() => {
    const today = new Date();
    return { week: getWeekNumber(today), year: getWeekYear(today) };
  });
  const [showDeleteWeekDialog, setShowDeleteWeekDialog] = useState(false);
  const [athleteObjectives, setAthleteObjectives] = useState<any>({});
  const [athleteMilestones, setAthleteMilestones] = useState<any[]>([]);
  const [athleteMesocycles, setAthleteMesocycles] = useState<Array<{ id: string; name: string; start_date: string; end_date: string; color: string; description?: string }>>([]);
  const [athleteMacrocycles, setAthleteMacrocycles] = useState<Array<{ id: string; name: string; start_date: string; end_date: string; color: string; description?: string }>>([]);
  const [athleteMicrocycles, setAthleteMicrocycles] = useState<Array<{ id: string; name: string; start_date: string; end_date: string; color: string; description?: string }>>([]);
  const [showObjectivesSheet, setShowObjectivesSheet] = useState(false);
  const [showExerciseProgressSheet, setShowExerciseProgressSheet] = useState(false);
  const [showRunningSheet, setShowRunningSheet] = useState(false);
  const [showNotesSheet, setShowNotesSheet] = useState(false);
  const [athleteNotes, setAthleteNotes] = useState<Array<{ id: string; content: string; created_at: string }>>([]);
  const [activeTab, setActiveTab] = useState("resume");
  const [chargeSuggestions, setChargeSuggestions] = useState<{ [sessionId: string]: { [exerciseId: string]: string } }>({});
  const [draggedSessionId, setDraggedSessionId] = useState<number | null>(null);
  const [draggedExerciseId, setDraggedExerciseId] = useState<number | null>(null);
  const [draggedSessionForExercise, setDraggedSessionForExercise] = useState<number | null>(null);
  const [headerMonotony, setHeaderMonotony] = useState<number | null>(null);
  const [headerInjury, setHeaderInjury] = useState<{ avgPain: number; location: string } | null>(null);
  const [selectedEffortType, setSelectedEffortType] = useState<"renfo" | "course" | "velo" | "natation" | "triathlon">("renfo");
  const [sessionTemplates, setSessionTemplates] = useState<Array<{ id: string; name: string; session_type: string; cardio_sport: string | null }>>([]);
  const [selectedCardioSport, setSelectedCardioSport] = useState<"course" | "velo" | "natation">("course");
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showRenfoTemplateSelector, setShowRenfoTemplateSelector] = useState<number | null>(null);
  const [autoOpenExercise, setAutoOpenExercise] = useState<{ sessionId: number; exerciseId: number } | null>(null);
  
  // Multi-week programming mode
  const [multiWeekMode, setMultiWeekMode] = useState(false);
  const [multiWeekTotal, setMultiWeekTotal] = useState(2);
  const [multiWeekCurrent, setMultiWeekCurrent] = useState(1);
  const [multiWeekStartWeek, setMultiWeekStartWeek] = useState<{ week: number; year: number } | null>(null);

  const currentWeekNumber = getWeekNumber(new Date());
  const availableWeeks = getNextWeeks(12);

  const recuperationOptions = [
    { value: "0s", label: "Aucune" },
    { value: "30s", label: "30 secondes" },
    { value: "35s", label: "35 secondes" },
    { value: "40s", label: "40 secondes" },
    { value: "45s", label: "45 secondes" },
    { value: "50s", label: "50 secondes" },
    { value: "55s", label: "55 secondes" },
    { value: "1min", label: "1 minute" },
    { value: "1min30s", label: "1 min 30 sec" },
    { value: "2min", label: "2 minutes" },
    { value: "2min30s", label: "2 min 30 sec" },
    { value: "3min", label: "3 minutes" },
    { value: "3min30s", label: "3 min 30 sec" },
    { value: "4min", label: "4 minutes" },
    { value: "4min30s", label: "4 min 30 sec" },
    { value: "5min", label: "5 minutes" },
    { value: "emom", label: "EMOM" },
  ];

  useEffect(() => {
    loadAthleteData();
    loadLibraryExercises();
    loadHistoricalWeeks();
    loadCustomSessions();
    loadLastWeekFeedback();
    loadAthleteObjectives();
    loadHeaderMonotony();
    loadHeaderInjury();
    loadSessionTemplates();
    
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

  const loadSessionTemplates = async () => {
    const { data, error } = await supabase
      .from("session_templates")
      .select("id, name, session_type, cardio_sport")
      .order("name");

    if (!error && data) {
      setSessionTemplates(data);
    }
  };

  const loadLibraryExercises = async () => {
    const { data, error } = await supabase.from("exercise_library").select("id, name, muscle_principal, muscles_second, unilateral, category").order("name");

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
      .order("week_number", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur lors du chargement de l'historique:", error);
    } else {
      // Deduplicate: keep only the latest entry per (week_number, year)
      const seen = new Set<string>();
      const unique = (data || []).filter((w: any) => {
        const key = `${w.year}-${w.week_number}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setHistoricalWeeks(unique);
    }
  };

  const loadCustomSessions = async () => {
    if (!athleteId) return;

    const { data, error } = await supabase
      .from("custom_sessions")
      .select("*")
      .eq("user_id", athleteId)
      .order("completed_at", { ascending: false });

    if (error) {
      console.error("Erreur lors du chargement des séances personnalisées:", error);
    } else {
      setCustomSessions(data || []);
    }
  };

  const loadLastWeekFeedback = async () => {
    if (!athleteId) return;

    // Calculer la semaine précédente (semaine actuelle - 1)
    const now = new Date();
    const currentWeek = getISOWeek(now);
    const currentYear = getWeekYear(now);
    
    // Calculer la semaine précédente
    let previousWeek = currentWeek - 1;
    let previousYear = currentYear;
    if (previousWeek <= 0) {
      previousWeek = 52;
      previousYear = currentYear - 1;
    }

    // Trouver la semaine précédente validée
    const { data: weeks, error: weeksError } = await supabase
      .from("training_weeks")
      .select("*")
      .eq("athlete_id", athleteId)
      .eq("validated", true)
      .eq("week_number", previousWeek)
      .eq("year", previousYear)
      .limit(1);

    if (weeksError || !weeks || weeks.length === 0) {
      console.error("Pas de semaine précédente validée:", weeksError);
      setLastWeekData(null);
      return;
    }

    const lastWeek = weeks[0];

    // Charger toutes les sessions de cette semaine (complétées ou non)
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

  const loadAthleteObjectives = async () => {
    if (!athleteId) return;

    try {
      // Charger l'objectif principal et secondaire
      const { data: objectivesData, error: objectivesError } = await supabase
        .from("athlete_objectives")
        .select("*")
        .eq("athlete_id", athleteId)
        .maybeSingle();

      if (objectivesError && objectivesError.code !== "PGRST116") {
        console.error("Erreur lors du chargement des objectifs:", objectivesError);
      } else {
        setAthleteObjectives(objectivesData || {});
      }

      // Charger les milestones
      const { data: milestonesData, error: milestonesError } = await supabase
        .from("objective_milestones")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("target_date", { ascending: true });

      if (milestonesError) {
        console.error("Erreur lors du chargement des milestones:", milestonesError);
      } else {
        setAthleteMilestones(milestonesData || []);
      }

      // Charger les mésocycles
      const { data: mesocyclesData, error: mesocyclesError } = await supabase
        .from("mesocycles")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("start_date", { ascending: true });

      if (mesocyclesError) {
        console.error("Erreur lors du chargement des mésocycles:", mesocyclesError);
      } else {
        setAthleteMesocycles(mesocyclesData || []);
      }

      // Charger les macrocycles
      const { data: macrocyclesData, error: macrocyclesError } = await supabase
        .from("macrocycles")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("start_date", { ascending: true });

      if (macrocyclesError) {
        console.error("Erreur lors du chargement des macrocycles:", macrocyclesError);
      } else {
        setAthleteMacrocycles(macrocyclesData || []);
      }

      // Charger les microcycles
      const { data: microcyclesData, error: microcyclesError } = await supabase
        .from("microcycles")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("start_date", { ascending: true });

      if (microcyclesError) {
        console.error("Erreur lors du chargement des microcycles:", microcyclesError);
      } else {
        setAthleteMicrocycles(microcyclesData || []);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des objectifs:", error);
    }
  };

  const loadAthleteNotes = async () => {
    if (!athleteId) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("coach_notes")
        .select("id, content, created_at")
        .eq("coach_id", user.id)
        .eq("athlete_id", athleteId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Erreur lors du chargement des notes:", error);
      } else {
        setAthleteNotes(data || []);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des notes:", error);
    }
  };

  const loadHeaderMonotony = async () => {
    if (!athleteId) return;
    
    try {
      const today = new Date();
      const sevenDaysAgo = subDays(today, 6);

      // Récupérer les semaines de l'athlète
      const { data: weeks, error: weeksError } = await supabase
        .from("training_weeks")
        .select("id")
        .eq("athlete_id", athleteId);

      if (weeksError || !weeks || weeks.length === 0) {
        setHeaderMonotony(null);
        return;
      }

      const weekIds = weeks.map(w => w.id);

      // Récupérer les sessions des 7 derniers jours
      const { data: sessions, error } = await supabase
        .from("training_sessions")
        .select("id, completed_at, duration_minutes, session_rpe")
        .in("week_id", weekIds)
        .not("completed_at", "is", null)
        .gte("completed_at", startOfDay(sevenDaysAgo).toISOString())
        .lte("completed_at", endOfDay(today).toISOString());

      if (error || !sessions || sessions.length === 0) {
        setHeaderMonotony(null);
        return;
      }

      // Calculer les charges journalières
      const dailyLoadsMap = new Map<string, number>();
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(today, i), "yyyy-MM-dd");
        dailyLoadsMap.set(date, 0);
      }

      sessions.forEach(session => {
        if (session.duration_minutes && session.session_rpe) {
          const date = format(new Date(session.completed_at), "yyyy-MM-dd");
          const load = session.duration_minutes * session.session_rpe;
          const current = dailyLoadsMap.get(date) || 0;
          dailyLoadsMap.set(date, current + load);
        }
      });

      const loads = Array.from(dailyLoadsMap.values());
      const weeklyLoad = loads.reduce((sum, l) => sum + l, 0);
      const meanLoad = weeklyLoad / 7;

      const squaredDiffs = loads.map(l => Math.pow(l - meanLoad, 2));
      const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / 7;
      const stdDev = Math.sqrt(variance);

      const monotony = stdDev > 0 ? meanLoad / stdDev : 0;
      setHeaderMonotony(monotony);
    } catch (error) {
      console.error("Error loading header monotony:", error);
    }
  };

  const loadHeaderInjury = async () => {
    if (!athleteId) return;
    
    try {
      const today = new Date();
      const sevenDaysAgo = subDays(today, 6);

      const { data, error } = await supabase
        .from("daily_fatigue_log")
        .select("injury_level, injury_location")
        .eq("user_id", athleteId)
        .eq("has_injury", true)
        .gte("date", format(sevenDaysAgo, "yyyy-MM-dd"))
        .lte("date", format(today, "yyyy-MM-dd"))
        .not("injury_level", "is", null);

      if (error || !data || data.length === 0) {
        setHeaderInjury(null);
        return;
      }

      // Calculer la moyenne de la douleur et récupérer la localisation la plus récente
      const totalPain = data.reduce((sum, d) => sum + (d.injury_level || 0), 0);
      const avgPain = totalPain / data.length;
      const location = data[0]?.injury_location || "Non précisé";

      setHeaderInjury({ avgPain, location });
    } catch (error) {
      console.error("Error loading header injury:", error);
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

  const handleDeleteWeek = async () => {
    if (!selectedHistoricalWeek || !athleteId) return;

    try {
      // Supprimer toutes les semaines correspondant au même couple (athlete_id, week_number, year)
      // (utile si des doublons ont été créés)
      const { data: weeksToDelete, error: weeksError } = await supabase
        .from("training_weeks")
        .select("id")
        .eq("athlete_id", athleteId)
        .eq("week_number", selectedHistoricalWeek.week_number)
        .eq("year", selectedHistoricalWeek.year);

      if (weeksError) throw weeksError;

      const weekIds = (weeksToDelete || []).map((w) => w.id);
      if (weekIds.length === 0) {
        toast.error("Semaine introuvable");
        return;
      }

      // 1) Récupérer toutes les séances de ces semaines
      const { data: sessionsToDelete, error: sessionsError } = await supabase
        .from("training_sessions")
        .select("id")
        .in("week_id", weekIds);

      if (sessionsError) throw sessionsError;

      const sessionIds = (sessionsToDelete || []).map((s) => s.id);

      // 2) Supprimer tous les exercices des séances
      if (sessionIds.length > 0) {
        const { error: exercisesError } = await supabase
          .from("session_exercises")
          .delete()
          .in("session_id", sessionIds);

        if (exercisesError) throw exercisesError;
      }

      // 3) Supprimer toutes les séances
      if (weekIds.length > 0) {
        const { error: sessionsDeleteError } = await supabase
          .from("training_sessions")
          .delete()
          .in("week_id", weekIds);

        if (sessionsDeleteError) throw sessionsDeleteError;
      }

      // 4) Supprimer toutes les semaines
      const { error: weekDeleteError } = await supabase
        .from("training_weeks")
        .delete()
        .in("id", weekIds);

      if (weekDeleteError) throw weekDeleteError;

      toast.success("Semaine supprimée définitivement");

      // Retirer immédiatement de la liste (UX + évite les effets de cache)
      setHistoricalWeeks((prev) =>
        prev.filter(
          (w) => !(w.week_number === selectedHistoricalWeek.week_number && w.year === selectedHistoricalWeek.year),
        ),
      );

      // Réinitialiser l'état
      setSelectedHistoricalWeek(null);
      setHistoricalSessions([]);
      setIsEditingHistorical(false);
      setShowDeleteWeekDialog(false);

      // Recharger l'historique (petit délai pour laisser la suppression se propager)
      await new Promise((r) => setTimeout(r, 250));
      await loadHistoricalWeeks();
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      toast.error("Erreur lors de la suppression de la semaine");
    }
  };

  const handleHistoricalExerciseChange = (sessionId: string, exerciseId: string, field: string, value: string | boolean) => {
    setEditedHistoricalExercises((prev) => {
      const sessionExercises = prev[sessionId] || [];
      
      // Si on change l'exercice, vérifier si c'est un exercice unilatéral
      if (field === "exercice" && typeof value === "string") {
        const selectedExercise = libraryExercises.find((ex) => ex.name === value);
        const updatedExercises = sessionExercises.map((ex) => {
          if (ex.id === exerciseId) {
            const updates: any = { [field]: value };
            if (selectedExercise) {
              updates.is_unilateral = selectedExercise.unilateral || false;
              if (!selectedExercise.unilateral) {
                updates.per_side = false;
              }
            }
            return { ...ex, ...updates };
          }
          return ex;
        });
        return {
          ...prev,
          [sessionId]: updatedExercises,
        };
      }
      
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
              per_side: exercise.per_side || false,
              is_duration: exercise.is_duration || false,
              request_video: exercise.request_video || false,
            })
            .eq("id", exercise.id);

          if (error) throw error;
        }

        // Si la session contient du cardio, recalculer les métriques
        const cardioExercise = exercises.find(ex => ex.cardio_sport === "course" && ex.cardio_content);
        if (cardioExercise) {
          try {
            const cardioData = JSON.parse(cardioExercise.cardio_content);
            const metrics = calculateCardioMetrics(cardioData, athleteVma);
            
            const { error: sessionError } = await supabase
              .from("training_sessions")
              .update({
                cardio_total_distance_km: metrics.totalDistanceKm,
                cardio_total_duration_minutes: metrics.totalDurationMinutes,
                cardio_average_intensity: metrics.averageIntensity,
              })
              .eq("id", sessionId);

            if (sessionError) throw sessionError;
          } catch (e) {
            console.error("Erreur calcul métriques cardio:", e);
          }
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
          session_type: newHistoricalSessionType,
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
      const isRecup = session.session_type === "recup";

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
          cardio_sport: isCardio ? "course" : null,
          cardio_content: isCardio ? "" : null,
          cardio_pace: isCardio ? "" : null,
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
      setAthleteVma(data.vma || null);
    }

    setLoading(false);
  };

  const handleTogglePaymentEnabled = async (enabled: boolean) => {
    if (!athleteId) return;

    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ payment_enabled: enabled })
        .eq("id", athleteId);

      if (error) throw error;

      setAthlete((prev) => (prev ? { ...prev, payment_enabled: enabled } : null));
      toast.success(enabled ? "Mode paiement activé" : "Mode paiement désactivé");

      // UX: basculer directement sur l'onglet Paiements quand on active
      if (enabled) {
        setActiveTab("paiements");
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const [newSessionType, setNewSessionType] = useState<"renfo" | "cardio" | "recup">("renfo");

  const handleCreateSession = () => {
    const nextSessionNumber = sessions.length + 1;
    const sessionName = newSessionType === "cardio" 
      ? `Cardio ${nextSessionNumber}` 
      : newSessionType === "recup" 
      ? `Récup/Mobilité ${nextSessionNumber}`
      : `Séance ${nextSessionNumber}`;
      
    const newSession: Session = {
      id: nextSessionNumber,
      name: sessionName,
      isExpanded: false,
      session_type: newSessionType,
    };

    setSessions([...sessions, newSession]);

    // Si c'est une séance cardio ou recup, ajouter automatiquement un exercice
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
        cardio_sport: selectedCardioSport,
        cardio_content: "",
        cardio_pace: "",
      };

      setSessionExercises({
        ...sessionExercises,
        [nextSessionNumber]: [newExercise],
      });
    } else if (newSessionType === "recup") {
      const newExercise: Exercise = {
        id: 1,
        exercice: "",
        recuperation: "",
        reps: "",
        series: "",
        charge: "",
        rpe: "",
        tempo: "",
        commentaire: "",
      };

      setSessionExercises({
        ...sessionExercises,
        [nextSessionNumber]: [newExercise],
      });
    }

    setNewSessionType("renfo"); // Reset to default
    setShowTemplateSelector(false);
    toast.success(`Séance créée`);
  };

  const handleCreateSessionFromTemplate = async (templateId: string) => {
    // Charger les exercices du template
    const { data: templateData } = await supabase
      .from("session_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    const { data: templateExercises } = await supabase
      .from("session_template_exercises")
      .select("*")
      .eq("template_id", templateId)
      .order("ordre", { ascending: true });

    if (!templateData) {
      toast.error("Template introuvable");
      return;
    }

    const nextSessionNumber = sessions.length + 1;
    
    const newSession: Session = {
      id: nextSessionNumber,
      name: templateData.name,
      isExpanded: false,
      session_type: templateData.session_type as "renfo" | "cardio" | "recup",
    };

    setSessions([...sessions, newSession]);

    // Convertir les exercices du template en exercices de séance
    if (templateExercises && templateExercises.length > 0) {
      const exercises: Exercise[] = templateExercises.map((ex, idx) => ({
        id: idx + 1,
        exercice: ex.exercice,
        recuperation: ex.recuperation || "",
        reps: ex.reps || "",
        series: ex.series || "",
        charge: ex.charge || "",
        rpe: ex.rpe || "",
        tempo: ex.tempo || "",
        commentaire: ex.commentaire || "",
        is_duration: ex.is_duration || false,
        per_side: ex.per_side || false,
        cardio_sport: ex.cardio_sport as any || undefined,
        cardio_content: ex.cardio_content ? JSON.stringify(ex.cardio_content) : "",
        cardio_pace: ex.cardio_pace || "",
      }));

      setSessionExercises({
        ...sessionExercises,
        [nextSessionNumber]: exercises,
      });
    }

    setShowTemplateSelector(false);
    setTemplateSearchQuery("");
    toast.success(`Séance "${templateData.name}" importée`);
  };

  // Filtrer les templates par sport cardio sélectionné
  const filteredCardioTemplates = sessionTemplates
    .filter(t => t.session_type === "cardio" && t.cardio_sport === selectedCardioSport)
    .filter(t => templateSearchQuery === "" || t.name.toLowerCase().includes(templateSearchQuery.toLowerCase()));

  // Filtrer les templates renfo
  const filteredRenfoTemplates = sessionTemplates
    .filter(t => t.session_type === "renfo")
    .filter(t => templateSearchQuery === "" || t.name.toLowerCase().includes(templateSearchQuery.toLowerCase()));

  // Importer un template dans une séance existante (cardio)
  const handleImportTemplateToSession = async (templateId: string, sessionId: number, exerciseId: number) => {
    const { data: templateData } = await supabase
      .from("session_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    const { data: templateExercises } = await supabase
      .from("session_template_exercises")
      .select("*")
      .eq("template_id", templateId)
      .order("ordre", { ascending: true });

    if (!templateData) {
      toast.error("Template introuvable");
      return;
    }

    // Mettre à jour le nom de la séance
    setSessions(sessions.map(s => 
      s.id === sessionId 
        ? { ...s, name: templateData.name }
        : s
    ));

    // Mettre à jour l'exercice cardio avec le contenu du template
    const currentExercises = sessionExercises[sessionId] || [];
    
    // Si le template a des exercices, utiliser le premier ; sinon utiliser la description du template comme commentaire
    const templateExercise = templateExercises && templateExercises.length > 0 ? templateExercises[0] : null;
    
    // Déterminer le commentaire : priorité au commentaire de l'exercice, puis à la description du template
    const finalCommentaire = templateExercise?.commentaire || templateData.description || "";
    
    console.log("Import template:", {
      templateName: templateData.name,
      templateDescription: templateData.description,
      templateExerciseCommentaire: templateExercise?.commentaire,
      finalCommentaire
    });
    
    const updatedExercises = currentExercises.map((ex) => 
      ex.id === exerciseId 
        ? {
            ...ex,
            exercice: templateExercise?.exercice || templateData.name,
            cardio_sport: (templateExercise?.cardio_sport || templateData.cardio_sport) as any,
            cardio_content: templateExercise?.cardio_content ? JSON.stringify(templateExercise.cardio_content) : "",
            commentaire: finalCommentaire,
          }
        : ex
    );
    
    setSessionExercises({
      ...sessionExercises,
      [sessionId]: updatedExercises,
    });

    setShowTemplateSelector(false);
    setTemplateSearchQuery("");
    toast.success(`Séance "${templateData.name}" importée`);
  };

  // Importer un template renfo dans une séance existante
  const handleImportRenfoTemplateToSession = async (templateId: string, sessionId: number) => {
    const { data: templateData } = await supabase
      .from("session_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    const { data: templateExercises } = await supabase
      .from("session_template_exercises")
      .select("*")
      .eq("template_id", templateId)
      .order("ordre", { ascending: true });

    if (!templateData || !templateExercises || templateExercises.length === 0) {
      toast.error("Template introuvable ou vide");
      return;
    }

    // Mettre à jour le nom de la séance
    setSessions(sessions.map(s => 
      s.id === sessionId 
        ? { ...s, name: templateData.name }
        : s
    ));

    // Convertir les exercices du template en exercices de séance
    const exercises: Exercise[] = templateExercises.map((ex, idx) => ({
      id: idx + 1,
      exercice: ex.exercice,
      recuperation: ex.recuperation || "",
      reps: ex.reps || "",
      series: ex.series || "",
      charge: ex.charge || "",
      rpe: ex.rpe || "",
      tempo: ex.tempo || "",
      commentaire: ex.commentaire || "",
      is_duration: ex.is_duration || false,
      per_side: ex.per_side || false,
      is_unilateral: libraryExercises.find(e => e.name === ex.exercice)?.unilateral || false,
    }));
    
    setSessionExercises({
      ...sessionExercises,
      [sessionId]: exercises,
    });

    setShowRenfoTemplateSelector(null);
    setTemplateSearchQuery("");
    toast.success(`Séance "${templateData.name}" importée`);
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

      // Vérifier si cette semaine existe déjà - si oui, supprimer TOUTES les occurrences pour éviter les doublons
      const { data: existingWeeks } = await supabase
        .from("training_weeks")
        .select("id")
        .eq("athlete_id", athleteId)
        .eq("week_number", selectedWeekToProgram.week)
        .eq("year", selectedWeekToProgram.year);

      if (existingWeeks && existingWeeks.length > 0) {
        // Supprimer TOUTES les semaines dupliquées
        for (const existingWeek of existingWeeks) {
          // Récupérer les séances existantes pour supprimer leurs exercices
          const { data: existingSessions } = await supabase
            .from("training_sessions")
            .select("id")
            .eq("week_id", existingWeek.id);

          // Supprimer les exercices des séances existantes
          if (existingSessions && existingSessions.length > 0) {
            await supabase
              .from("session_exercises")
              .delete()
              .in("session_id", existingSessions.map((s) => s.id));
          }

          // Supprimer les séances existantes
          await supabase
            .from("training_sessions")
            .delete()
            .eq("week_id", existingWeek.id);

          // Supprimer la semaine existante
          await supabase
            .from("training_weeks")
            .delete()
            .eq("id", existingWeek.id);
        }

        toast.info(`${existingWeeks.length > 1 ? 'Semaines dupliquées supprimées et remplacées' : 'Semaine existante remplacée'}`);
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
        // Préparer les données de la séance
        const sessionInsertData: any = {
          week_id: weekData.id,
          session_number: session.id,
          name: session.name,
          session_type: session.session_type, // Ajouter le type de session
        };

        // Si c'est une séance cardio, calculer et ajouter les métriques
        if (session.session_type === 'cardio') {
          const exercises = sessionExercises[session.id] || [];
          if (exercises.length > 0 && exercises[0].cardio_content) {
            try {
              const cardioData = JSON.parse(exercises[0].cardio_content);
              const metrics = calculateCardioMetrics(cardioData, athleteVma);
              sessionInsertData.cardio_total_distance_km = metrics.totalDistanceKm;
              sessionInsertData.cardio_total_duration_minutes = metrics.totalDurationMinutes;
              sessionInsertData.cardio_average_intensity = metrics.averageIntensity;
            } catch (error) {
              console.error("Erreur lors du calcul des métriques cardio:", error);
            }
          }
        }

        const { data: sessionData, error: sessionError } = await supabase
          .from("training_sessions")
          .insert(sessionInsertData)
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
            per_side: exercise.per_side || false,
            is_duration: exercise.is_duration || false,
            request_video: exercise.request_video || false,
          }));

          const { error: exercisesError } = await supabase.from("session_exercises").insert(exercisesToInsert);

          if (exercisesError) throw exercisesError;
        }
      }

      toast.success(`Semaine S${selectedWeekToProgram.week} validée et envoyée au sportif !`);

      // Multi-week mode: advance to next week keeping sessions
      if (multiWeekMode && multiWeekCurrent < multiWeekTotal) {
        // Calculate next week
        let nextWeek = selectedWeekToProgram.week + 1;
        let nextYear = selectedWeekToProgram.year;
        if (nextWeek > 52) {
          nextWeek = 1;
          nextYear += 1;
        }
        setSelectedWeekToProgram({ week: nextWeek, year: nextYear });
        setMultiWeekCurrent(prev => prev + 1);
        setCopiedWeekFeedback({});
        setIsValidated(false);
        // Keep sessions & exercises for the next week (coach can modify)
      } else {
        // Normal reset
        setSelectedWeekToProgram({ week: getWeekNumber(new Date()), year: getWeekYear(new Date()) });
        setSessions([]);
        setSessionExercises({});
        setCopiedWeekFeedback({});
        setIsValidated(false);
        // Reset multi-week state
        if (multiWeekMode) {
          setMultiWeekMode(false);
          setMultiWeekCurrent(1);
          setMultiWeekStartWeek(null);
          toast.success("Toutes les semaines ont été programmées !");
        }
        // Nettoyer les données sauvegardées localement
        localStorage.removeItem(`coach-programming-${athleteId}`);
      }

      // Recharger l'historique et les retours
      await loadHistoricalWeeks();
      await loadCustomSessions();
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
        const feedbackMapping: Record<string, { sportif_rpe?: string | null; sportif_comment?: string | null; skipped?: boolean }> = {};
        
        // Créer un mapping pour générer de nouveaux UUIDs pour les super_set_group
        // afin d'éviter les conflits avec les exercices de la semaine source
        const superSetGroupMapping: Record<string, string> = {};
        
        sessionsData.forEach((session, sessionIndex) => {
          if (session.session_exercises) {
            const sortedExercises = session.session_exercises
              .sort((a: any, b: any) => a.exercise_order - b.exercise_order)
              .map((ex: any, exIndex: number) => {
                // Créer une clé unique pour mapper le feedback: sessionIndex-exerciseName
                const feedbackKey = `${sessionIndex + 1}-${ex.exercice}`;
                if (ex.sportif_rpe || ex.sportif_comment || ex.skipped) {
                  feedbackMapping[feedbackKey] = {
                    sportif_rpe: ex.sportif_rpe,
                    sportif_comment: ex.sportif_comment,
                    skipped: ex.skipped || false,
                  };
                }
                
                // Générer un nouveau UUID pour chaque super_set_group unique
                // afin que les exercices de la nouvelle semaine aient leurs propres groupes
                let newSuperSetGroup: string | null = null;
                if (ex.super_set_group) {
                  if (!superSetGroupMapping[ex.super_set_group]) {
                    superSetGroupMapping[ex.super_set_group] = crypto.randomUUID();
                  }
                  newSuperSetGroup = superSetGroupMapping[ex.super_set_group];
                }
                
                return {
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
                  super_set_group: newSuperSetGroup,
                  request_video: ex.request_video || false,
                };
              });
            newExercises[sessionIndex + 1] = sortedExercises;
          }
        });

        setSessions(newSessions);
        setSessionExercises(newExercises);
        setCopiedWeekFeedback(feedbackMapping);
        setWeekToCopyData(sessionsData);
        setShowCopyDialog(false);
        toast.success("Semaine copiée avec succès ! Vous pouvez maintenant la modifier.");
      }
    } catch (error) {
      console.error("Erreur lors de la copie:", error);
      toast.error("Erreur lors de la copie de la semaine");
    }
  };

  // Copier directement la semaine précédente (sans passer par le dialog)
  const handleCopyPreviousWeek = async () => {
    if (!selectedWeekToProgram) {
      toast.error("Veuillez sélectionner une semaine à programmer");
      return;
    }

    // Calculer la semaine précédente par rapport à selectedWeekToProgram
    let previousWeek = selectedWeekToProgram.week - 1;
    let previousYear = selectedWeekToProgram.year;
    if (previousWeek <= 0) {
      previousWeek = 52;
      previousYear = selectedWeekToProgram.year - 1;
    }

    try {
      // Trouver la semaine précédente validée
      const { data: weeks, error: weeksError } = await supabase
        .from("training_weeks")
        .select("*")
        .eq("athlete_id", athleteId)
        .eq("validated", true)
        .eq("week_number", previousWeek)
        .eq("year", previousYear)
        .limit(1);

      if (weeksError || !weeks || weeks.length === 0) {
        toast.error(`Aucune semaine validée trouvée pour S${previousWeek} ${previousYear}`);
        return;
      }

      const previousWeekData = weeks[0];

      // Charger les données de la semaine précédente
      const { data: sessionsData, error } = await supabase
        .from("training_sessions")
        .select(
          `
          *,
          session_exercises (*)
        `,
        )
        .eq("week_id", previousWeekData.id)
        .order("session_number");

      if (error) throw error;

      if (sessionsData && sessionsData.length > 0) {
        // Créer les nouvelles séances avec les exercices
        const newSessions: Session[] = sessionsData.map((session, index) => {
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
        const feedbackMapping: Record<string, { sportif_rpe?: string | null; sportif_comment?: string | null; skipped?: boolean }> = {};
        const superSetGroupMapping: Record<string, string> = {};
        
        sessionsData.forEach((session, sessionIndex) => {
          if (session.session_exercises) {
            const sortedExercises = session.session_exercises
              .sort((a: any, b: any) => a.exercise_order - b.exercise_order)
              .map((ex: any, exIndex: number) => {
                const feedbackKey = `${sessionIndex + 1}-${ex.exercice}`;
                if (ex.sportif_rpe || ex.sportif_comment || ex.skipped) {
                  feedbackMapping[feedbackKey] = {
                    sportif_rpe: ex.sportif_rpe,
                    sportif_comment: ex.sportif_comment,
                    skipped: ex.skipped || false,
                  };
                }
                
                let newSuperSetGroup: string | null = null;
                if (ex.super_set_group) {
                  if (!superSetGroupMapping[ex.super_set_group]) {
                    superSetGroupMapping[ex.super_set_group] = crypto.randomUUID();
                  }
                  newSuperSetGroup = superSetGroupMapping[ex.super_set_group];
                }
                
                return {
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
                  super_set_group: newSuperSetGroup,
                  request_video: ex.request_video || false,
                };
              });
            newExercises[sessionIndex + 1] = sortedExercises;
          }
        });

        setSessions(newSessions);
        setSessionExercises(newExercises);
        setCopiedWeekFeedback(feedbackMapping);
        setWeekToCopyData(sessionsData);
        toast.success(`Semaine S${previousWeek} copiée ! Vous pouvez maintenant la modifier.`);
      } else {
        toast.error("La semaine précédente ne contient aucune séance");
      }
    } catch (error) {
      console.error("Erreur lors de la copie:", error);
      toast.error("Erreur lors de la copie de la semaine précédente");
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
      cardio_sport: isCardio ? "course" : undefined,
      cardio_content: isCardio ? "" : undefined,
      cardio_pace: isCardio ? "" : undefined,
    };

    setSessionExercises({
      ...sessionExercises,
      [sessionId]: [...currentExercises, newExercise],
    });

    // Après insertion, descendre automatiquement en bas et amener la nouvelle ligne à l'écran
    setTimeout(() => {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth",
      });

      const newExerciseButton = document.querySelector(
        `[data-session="${sessionId}"][data-exercise="${newExerciseId}"][data-field="exercice"] button`,
      ) as HTMLElement | null;

      newExerciseButton?.scrollIntoView({ behavior: "smooth", block: "center" });
      newExerciseButton?.focus();

      // Ouvrir automatiquement le sélecteur (sans click qui toggle et referme)
      if (!isCardio) {
        setAutoOpenExercise({ sessionId, exerciseId: newExerciseId });
      }
    }, 200);
  };

  const handleExerciseChange = (sessionId: number, exerciseId: number, field: keyof Exercise, value: string | boolean) => {
    // Determine extra updates synchronously (unilateral check)
    let extraUpdates: Partial<Exercise> = {};
    if (field === "exercice" && typeof value === "string") {
      const selectedExercise = libraryExercises.find((ex) => ex.name === value);
      if (selectedExercise) {
        extraUpdates.is_unilateral = selectedExercise.unilateral || false;
        if (!selectedExercise.unilateral) {
          extraUpdates.per_side = false;
        }
      }
    }

    // Update state immediately using functional updater to avoid stale closures
    setSessionExercises(prev => {
      const currentExercises = prev[sessionId] || [];
      
      if (field === "series") {
        const currentExercise = currentExercises.find((ex) => ex.id === exerciseId);
        if (currentExercise?.super_set_group && typeof value === "string") {
          const updatedExercises = currentExercises.map((ex) => {
            if (ex.super_set_group === currentExercise.super_set_group) {
              return { ...ex, series: value };
            }
            return ex.id === exerciseId ? { ...ex, [field]: value } : ex;
          });
          return { ...prev, [sessionId]: updatedExercises };
        }
      }

      const updatedExercises = currentExercises.map((ex) => {
        if (ex.id === exerciseId) {
          return { ...ex, [field]: value, ...extraUpdates };
        }
        return ex;
      });
      return { ...prev, [sessionId]: updatedExercises };
    });

    // Defer async suggested load calculation so it doesn't block input
    if ((field === "rpe" || field === "reps" || field === "exercice") && typeof value === "string") {
      // Build a temporary exercise for calculation
      const currentExercises = sessionExercises[sessionId] || [];
      const currentExercise = currentExercises.find((ex) => ex.id === exerciseId);
      if (currentExercise) {
        const updatedExercise = { ...currentExercise, [field]: value, ...extraUpdates };
        calculateSuggestedLoad(updatedExercise).then(suggestedLoad => {
          if (suggestedLoad !== null) {
            setChargeSuggestions(prev => ({
              ...prev,
              [sessionId]: {
                ...(prev[sessionId] || {}),
                [exerciseId]: suggestedLoad
              }
            }));
          }
        });
      }
    }
  };

  // Calculer la charge suggérée basée sur le max de l'athlète (retourne null si impossible)
  const calculateSuggestedLoad = async (exercise: Exercise): Promise<string | null> => {
    const rpeValue = parseInt(exercise.rpe);
    const repsValue = parseInt(exercise.reps);
    
    if (!exercise.exercice || !repsValue || !rpeValue || isNaN(rpeValue) || isNaN(repsValue)) {
      return null; // Pas assez de données
    }

    try {
      // Récupérer l'exercise_id depuis la bibliothèque
      const { data: libraryData } = await supabase
        .from("exercise_library")
        .select("id")
        .eq("name", exercise.exercice)
        .maybeSingle();

      if (!libraryData?.id) return null;

      // Récupérer le max le plus récent pour cet exercice pour cet athlète
      const { data: maxData } = await supabase
        .from("exercise_maxes")
        .select("weight_kg")
        .eq("athlete_id", athleteId)
        .eq("exercise_id", libraryData.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!maxData?.weight_kg) return null; // Pas de max enregistré

      // Calculer la charge suggérée
      // Formule inverse de calculate1RM
      // 1RM = weight * (36 / (37 - effectiveReps))
      // weight = 1RM * (37 - effectiveReps) / 36
      const rir = 10 - rpeValue; // Reps in reserve
      const effectiveReps = repsValue + rir;
      const suggestedLoad = maxData.weight_kg * (37 - effectiveReps) / 36;
      
      // Arrondir à 0.5kg près
      const roundedLoad = Math.round(suggestedLoad * 2) / 2;

      return roundedLoad.toString();
    } catch (error) {
      console.error("Erreur lors du calcul de la charge suggérée:", error);
      return null;
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

  // Helper pour obtenir le feedback de la semaine copiée
  const getExerciseFeedback = (sessionId: number, exerciceName: string) => {
    const feedbackKey = `${sessionId}-${exerciceName}`;
    return copiedWeekFeedback[feedbackKey] || null;
  };

  // Composant pour afficher le feedback
  const ExerciseFeedbackDisplay = ({ sessionId, exerciceName }: { sessionId: number; exerciceName: string }) => {
    const feedback = getExerciseFeedback(sessionId, exerciceName);
    if (!feedback) return null;
    
    return (
      <div className="text-[10px] sm:text-xs bg-muted/50 rounded px-1.5 py-0.5 mt-1 border-l-2 border-primary/50">
        {feedback.skipped ? (
          <span className="text-destructive font-medium">⚠️ Non fait</span>
        ) : (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-muted-foreground">
            {feedback.sportif_rpe && (
              <span>RPE: <span className="font-medium text-foreground">{feedback.sportif_rpe}</span></span>
            )}
            {feedback.sportif_comment && (
              <span className="italic">"{feedback.sportif_comment}"</span>
            )}
          </div>
        )}
      </div>
    );
  };

  // Drag & Drop handlers pour les séances
  const handleSessionDragStart = (sessionId: number) => {
    setDraggedSessionId(sessionId);
  };

  const handleSessionDragOver = (e: React.DragEvent, targetSessionId: number) => {
    e.preventDefault();
    if (draggedSessionId === null || draggedSessionId === targetSessionId) return;
  };

  const handleSessionDrop = (e: React.DragEvent, targetSessionId: number) => {
    e.preventDefault();
    if (draggedSessionId === null || draggedSessionId === targetSessionId) {
      setDraggedSessionId(null);
      return;
    }

    const draggedIndex = sessions.findIndex((s) => s.id === draggedSessionId);
    const targetIndex = sessions.findIndex((s) => s.id === targetSessionId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newSessions = [...sessions];
    const [draggedSession] = newSessions.splice(draggedIndex, 1);
    newSessions.splice(targetIndex, 0, draggedSession);

    setSessions(newSessions);
    setDraggedSessionId(null);
    toast.success("Séance réorganisée");
  };

  // Drag & Drop handlers pour les exercices
  const handleExerciseDragStart = (sessionId: number, exerciseId: number) => {
    setDraggedExerciseId(exerciseId);
    setDraggedSessionForExercise(sessionId);
  };

  const handleExerciseDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleExerciseDrop = (e: React.DragEvent, targetSessionId: number, targetExerciseId: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      draggedExerciseId === null ||
      draggedSessionForExercise === null ||
      draggedExerciseId === targetExerciseId
    ) {
      setDraggedExerciseId(null);
      setDraggedSessionForExercise(null);
      return;
    }

    const sourceExercises = sessionExercises[draggedSessionForExercise] || [];
    const draggedIndex = sourceExercises.findIndex((ex) => ex.id === draggedExerciseId);
    const targetIndex = sourceExercises.findIndex((ex) => ex.id === targetExerciseId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedExerciseId(null);
      setDraggedSessionForExercise(null);
      return;
    }

    const newExercises = [...sourceExercises];
    const [draggedExercise] = newExercises.splice(draggedIndex, 1);
    newExercises.splice(targetIndex, 0, draggedExercise);

    setSessionExercises({
      ...sessionExercises,
      [draggedSessionForExercise]: newExercises,
    });

    setDraggedExerciseId(null);
    setDraggedSessionForExercise(null);
    toast.success("Exercice réorganisé");
  };

  const handleKeyDown = (e: React.KeyboardEvent, sessionId: number, exerciseId: number, field: keyof Exercise) => {
    if (e.key === "Enter") {
      e.preventDefault();

      if (field === "commentaire") {
        // Dans le commentaire, Entrée crée une nouvelle ligne
        handleAddExercise(sessionId);
      } else {
        // Pour les autres champs, passer au champ suivant
        const fieldOrder: (keyof Exercise)[] = [
          "exercice",
          "recuperation",
          "reps",
          "series",
          "rpe",
          "charge",
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
    <div className="space-y-2 sm:space-y-3 overflow-x-hidden max-w-full px-1 sm:px-0">
      {/* Header compact */}
      <div className="flex items-center justify-between py-1">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/coach/mes-clients")} 
          className="text-xs sm:text-sm px-1.5 sm:px-2 h-8 sm:h-9"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">Retour à mes clients</span>
        </Button>
      </div>

      {/* Infos athlète compact */}
      <div className="flex items-center justify-between bg-muted/30 p-1.5 sm:p-2 rounded-md gap-2">
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm sm:text-base font-semibold truncate">
                {athlete.first_name} {athlete.last_name}
              </h2>
              {/* Icône période d'adaptation */}
              {(athlete as any).adaptation_period_level && (
                <span 
                  className={`flex items-center justify-center h-5 w-5 rounded-full ${
                    (athlete as any).adaptation_period_level === "legere"
                      ? "bg-yellow-500/20 border border-yellow-500/50"
                      : (athlete as any).adaptation_period_level === "moyenne"
                      ? "bg-orange-500/20 border border-orange-500/50"
                      : "bg-red-500/20 border border-red-500/50"
                  }`}
                  title={`Période d'adaptation - Réduction ${
                    (athlete as any).adaptation_period_level === "legere" ? "légère" :
                    (athlete as any).adaptation_period_level === "moyenne" ? "moyenne" : "grosse"
                  }`}
                >
                  <Activity className={`h-3 w-3 ${
                    (athlete as any).adaptation_period_level === "legere"
                      ? "text-yellow-400"
                      : (athlete as any).adaptation_period_level === "moyenne"
                      ? "text-orange-400"
                      : "text-red-400"
                  }`} />
                </span>
              )}
              {/* Indice de monotonie */}
              {headerMonotony !== null && headerMonotony > 0 && (
                <span 
                  className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    headerMonotony > 2 
                      ? "bg-destructive/20 text-destructive border border-destructive/30" 
                      : headerMonotony > 1.5 
                      ? "bg-orange-500/20 text-orange-500 border border-orange-500/30" 
                      : "bg-green-500/20 text-green-500 border border-green-500/30"
                  }`}
                  title={`Indice de monotonie: ${headerMonotony.toFixed(2)} - ${
                    headerMonotony > 2 ? "Risque de surentraînement" : 
                    headerMonotony > 1.5 ? "À surveiller" : "Bonne variabilité"
                  }`}
                >
                  <TrendingUp className="h-3 w-3" />
                  {headerMonotony.toFixed(1)}
                </span>
              )}
              {/* Alerte blessure */}
              {headerInjury && (
                <span 
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-destructive/20 text-destructive border border-destructive/30"
                  title={`Blessure signalée: ${headerInjury.location} - Douleur moyenne: ${headerInjury.avgPain.toFixed(1)}/7`}
                >
                  <AlertTriangle className="h-3 w-3" />
                  {headerInjury.avgPain.toFixed(1)}/7
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{athlete.email}</p>
              {headerInjury && (
                <p className="text-[10px] text-destructive truncate hidden sm:block">
                  Blessure: {headerInjury.location}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Toggle paiement Stripe */}
          <div 
            className="flex items-center gap-1.5"
            title={athlete.payment_enabled ? "Paiement activé" : "Paiement désactivé"}
          >
            <CreditCard className={`h-3.5 w-3.5 ${athlete.payment_enabled ? "text-green-500" : "text-muted-foreground"}`} />
            <Switch
              checked={athlete.payment_enabled || false}
              onCheckedChange={handleTogglePaymentEnabled}
              className="scale-75"
            />
          </div>
          <div className="text-[10px] sm:text-xs text-muted-foreground text-right">
            {athlete.gender && (
              <p>{athlete.gender === "female" ? "F" : athlete.gender === "male" ? "H" : "A"}</p>
            )}
            {athlete.date_of_birth && <p>{new Date(athlete.date_of_birth).toLocaleDateString("fr-FR")}</p>}
          </div>
        </div>
      </div>


      {/* Tabs avec indicateur de scroll */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="relative">
          <div className="overflow-x-auto -mx-1 sm:-mx-2 px-1 sm:px-2 pb-1 sm:pb-2 scrollbar-hide">
            <TabsList className="inline-flex w-max min-w-full sm:w-auto h-8 sm:h-10">
              <TabsTrigger value="resume" className="text-[10px] sm:text-sm px-1.5 sm:px-3 h-7 sm:h-9">Résumé</TabsTrigger>
              <TabsTrigger value="programmation" className="text-[10px] sm:text-sm px-1.5 sm:px-3 h-7 sm:h-9">Prog</TabsTrigger>
              <TabsTrigger value="efforts" className="text-[10px] sm:text-sm px-1.5 sm:px-3 h-7 sm:h-9">Efforts</TabsTrigger>
              <TabsTrigger value="max" className="text-[10px] sm:text-sm px-1.5 sm:px-3 h-7 sm:h-9">Max</TabsTrigger>
              <TabsTrigger value="suivi" className="text-[10px] sm:text-sm px-1.5 sm:px-3 h-7 sm:h-9">Fatigue</TabsTrigger>
              <TabsTrigger value="poids" className="text-[10px] sm:text-sm px-1.5 sm:px-3 h-7 sm:h-9">Poids</TabsTrigger>
              <TabsTrigger value="objectifs" className="text-[10px] sm:text-sm px-1.5 sm:px-3 h-7 sm:h-9">Objectifs</TabsTrigger>
              <TabsTrigger value="historique" className="text-[10px] sm:text-sm px-1.5 sm:px-3 h-7 sm:h-9">Historique</TabsTrigger>
              <TabsTrigger value="paiements" className="text-[10px] sm:text-sm px-1.5 sm:px-3 h-7 sm:h-9">Paiements</TabsTrigger>
            </TabsList>
          </div>
          {/* Indicateur de scroll */}
          <div className="absolute right-0 top-0 bottom-1 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none sm:hidden" />
        </div>

        <TabsContent value="resume" className="space-y-4">
          <CoachClientSummaryView
            athleteId={athleteId!}
            athleteName={`${athlete.first_name || ""} ${athlete.last_name || ""}`}
          />
        </TabsContent>

        <TabsContent value="programmation" className="space-y-4">
          {/* Boutons flottants en haut - scrollable sur mobile */}
          <div className="fixed top-16 left-0 right-0 z-50 px-2 sm:px-0 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-auto overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-1.5 sm:gap-2 w-max mx-auto sm:w-auto">
            {/* Bouton Exercices */}
            <Sheet open={showExerciseProgressSheet} onOpenChange={setShowExerciseProgressSheet}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-background/95 backdrop-blur-sm border-primary/30 hover:bg-primary/10 shadow-md"
                >
                  <Dumbbell className="h-4 w-4 mr-1 text-primary" />
                  <span className="text-xs">Exercices</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="top" className="h-[85vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Dumbbell className="h-5 w-5 text-primary" />
                    Progression des exercices
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <CoachExerciseProgressPanel athleteId={athleteId!} />
                </div>
              </SheetContent>
            </Sheet>

            {/* Bouton Objectifs */}
            <Sheet open={showObjectivesSheet} onOpenChange={(open) => {
              setShowObjectivesSheet(open);
              if (open) {
                loadAthleteObjectives();
              }
            }}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-background/95 backdrop-blur-sm border-primary/30 hover:bg-primary/10 shadow-md"
                >
                  <Target className="h-4 w-4 mr-1 text-primary" />
                  <span className="text-xs">Objectifs</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="top" className="h-[85vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                      Objectifs de {athlete?.first_name}
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    {/* Cycles en cours - Affichage principal */}
                    {(() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);

                      const getCurrentCycles = (cycles: Array<{ id: string; name: string; start_date: string; end_date: string; color: string; description?: string }>) => {
                        return cycles.filter(cycle => {
                          const startDate = new Date(cycle.start_date);
                          const endDate = new Date(cycle.end_date);
                          startDate.setHours(0, 0, 0, 0);
                          endDate.setHours(23, 59, 59, 999);
                          return today >= startDate && today <= endDate;
                        });
                      };

                      const getWeeksRemaining = (endDate: string) => {
                        const end = new Date(endDate);
                        end.setHours(0, 0, 0, 0);
                        const diffTime = end.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        return Math.ceil(diffDays / 7);
                      };

                      const getWeekProgress = (startDate: string, endDate: string) => {
                        const start = new Date(startDate);
                        const end = new Date(endDate);
                        start.setHours(0, 0, 0, 0);
                        end.setHours(0, 0, 0, 0);
                        
                        const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        const totalWeeks = Math.ceil(totalDays / 7);
                        
                        const daysSinceStart = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                        const currentWeek = Math.min(Math.floor(daysSinceStart / 7) + 1, totalWeeks);
                        
                        return { currentWeek, totalWeeks };
                      };

                      const currentMacros = getCurrentCycles(athleteMacrocycles);
                      const currentMesos = getCurrentCycles(athleteMesocycles);
                      const currentMicros = getCurrentCycles(athleteMicrocycles);

                      const hasAnyCycle = currentMacros.length > 0 || currentMesos.length > 0 || currentMicros.length > 0;

                      if (!hasAnyCycle) {
                        return (
                          <div className="text-center py-8 text-muted-foreground">
                            <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Aucun cycle actif pour cet athlète</p>
                            <p className="text-xs mt-1">Créez des cycles dans l'onglet Objectifs</p>
                          </div>
                        );
                      }

                      const renderCycleCard = (
                        cycle: { id: string; name: string; start_date: string; end_date: string; color: string; description?: string },
                        type: string
                      ) => {
                        const { currentWeek, totalWeeks } = getWeekProgress(cycle.start_date, cycle.end_date);
                        const weeksRemaining = getWeeksRemaining(cycle.end_date);
                        const progressPercent = (currentWeek / totalWeeks) * 100;

                        return (
                          <div 
                            key={cycle.id}
                            className="p-4 rounded-lg border-2 transition-all"
                            style={{ 
                              borderColor: cycle.color,
                              backgroundColor: `${cycle.color}10`
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <div 
                                    className="h-3 w-3 rounded-full flex-shrink-0" 
                                    style={{ backgroundColor: cycle.color }}
                                  />
                                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    {type}
                                  </span>
                                </div>
                                <p className="font-semibold text-base" style={{ color: cycle.color }}>
                                  {cycle.name}
                                </p>
                                {cycle.description && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {cycle.description}
                                  </p>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <Badge 
                                  variant="outline" 
                                  className="font-bold text-sm"
                                  style={{ 
                                    borderColor: cycle.color, 
                                    color: cycle.color 
                                  }}
                                >
                                  {weeksRemaining <= 0 
                                    ? "Dernière semaine" 
                                    : `${weeksRemaining} sem. restante${weeksRemaining > 1 ? 's' : ''}`
                                  }
                                </Badge>
                              </div>
                            </div>
                            
                            {/* Barre de progression */}
                            <div className="mt-3 space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Semaine {currentWeek}/{totalWeeks}</span>
                                <span className="text-muted-foreground">
                                  Fin : {new Date(cycle.end_date).toLocaleDateString("fr-FR")}
                                </span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full transition-all duration-300 rounded-full"
                                  style={{ 
                                    width: `${progressPercent}%`,
                                    backgroundColor: cycle.color
                                  }}
                                />
                              </div>
                            </div>

                            {/* Alerte si fin proche */}
                            {weeksRemaining <= 1 && weeksRemaining >= 0 && (
                              <div className="flex items-center gap-1.5 mt-3 text-amber-500">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                <span className="text-xs font-medium">
                                  {weeksRemaining <= 0 
                                    ? "Dernière semaine du cycle" 
                                    : "Plus qu'une semaine"
                                  }
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      };

                      return (
                        <div className="space-y-4">
                          {/* Macrocycles */}
                          {currentMacros.length > 0 && (
                            <div className="space-y-3">
                              {currentMacros.map(cycle => renderCycleCard(cycle, "Macrocycle"))}
                            </div>
                          )}

                          {/* Mésocycles */}
                          {currentMesos.length > 0 && (
                            <div className="space-y-3">
                              {currentMesos.map(cycle => renderCycleCard(cycle, "Mésocycle"))}
                            </div>
                          )}

                          {/* Microcycles */}
                          {currentMicros.length > 0 && (
                            <div className="space-y-3">
                              {currentMicros.map(cycle => renderCycleCard(cycle, "Microcycle"))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Prochain objectif (milestone) */}
                    {(() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const upcomingMilestones = athleteMilestones
                        .filter((m: any) => !m.completed && new Date(m.target_date) >= today)
                        .sort((a: any, b: any) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime());
                      const next = upcomingMilestones[0];
                      if (!next) return null;
                      const daysLeft = Math.ceil((new Date(next.target_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      const label = daysLeft === 0 ? "Aujourd'hui" : daysLeft === 1 ? "Demain" : `J-${daysLeft}`;
                      return (
                        <div className="mt-4 p-3 rounded-lg border border-primary/30 bg-primary/5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Target className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium">{next.label}</span>
                            </div>
                            <Badge variant="outline" className="text-xs border-primary/50 text-primary font-bold">
                              {label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(next.target_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </SheetContent>
              </Sheet>

            {/* Bouton Course */}
            <Sheet open={showRunningSheet} onOpenChange={setShowRunningSheet}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-background/95 backdrop-blur-sm border-primary/30 hover:bg-primary/10 shadow-md"
                >
                  <Footprints className="h-4 w-4 mr-1 text-primary" />
                  <span className="text-xs">Course</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="top" className="h-[85vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Footprints className="h-5 w-5 text-primary" />
                    Suivi Course à Pied - {athlete?.first_name}
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <CoachRunningView 
                    athleteId={athleteId!} 
                    athleteName={`${athlete?.first_name || ''} ${athlete?.last_name || ''}`}
                    programmingWeek={selectedWeekToProgram}
                    programmingSessions={sessions}
                    programmingExercises={sessionExercises}
                    athleteVmaOverride={athleteVma}
                  />
                </div>
              </SheetContent>
            </Sheet>

            {/* Bouton Notes */}
            <Sheet open={showNotesSheet} onOpenChange={(open) => {
              setShowNotesSheet(open);
              if (open) {
                loadAthleteNotes();
              }
            }}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-background/95 backdrop-blur-sm border-primary/30 hover:bg-primary/10 shadow-md"
                >
                  <StickyNote className="h-4 w-4 mr-1 text-primary" />
                  <span className="text-xs">Notes</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="top" className="h-[85vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <StickyNote className="h-5 w-5 text-primary" />
                    Notes sur {athlete?.first_name}
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  {athleteNotes.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Aucune note pour cet athlète.
                    </p>
                  ) : (
                    athleteNotes.map((note) => (
                      <Card key={note.id}>
                        <CardContent className="pt-4">
                          <p className="text-xs text-muted-foreground mb-2">
                            {new Date(note.created_at).toLocaleDateString("fr-FR", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                        </CardContent>
                      </Card>
                    ))
                  )}
                  <div className="pt-4">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate(`/coach/notes?email=${athlete?.email}`)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter une note
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Bouton Retours */}
            {lastWeekData && (
              <Sheet open={showFeedbackSheet} onOpenChange={setShowFeedbackSheet}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-background/95 backdrop-blur-sm border-primary/30 hover:bg-primary/10 shadow-md"
                  >
                    <MessageSquare className="h-4 w-4 mr-1 text-primary" />
                    <span className="text-xs">Retours</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="top" className="h-[85vh] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Retours de la semaine {lastWeekData.week.week_number}
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    {lastWeekData.sessions.map((session: any) => {
                      const isCardioSession = session.session_type === 'course' || session.session_type === 'velo' || session.session_type === 'natation';
                      const allExercises = session.session_exercises || [];
                      
                      // Pour cardio: afficher toutes les données
                      // Pour renfo: afficher exercices avec feedback OU skipped
                      const exercisesToShow = isCardioSession 
                        ? allExercises.filter((ex: any) => 
                            ex.sportif_rpe !== null || 
                            ex.actual_distance_km !== null || 
                            ex.actual_duration_minutes !== null ||
                            ex.actual_pace_min_per_km !== null ||
                            ex.actual_avg_heart_rate !== null
                          )
                        : allExercises.filter((ex: any) => 
                            ex.sportif_feedback || ex.sportif_comment || ex.sportif_rpe || ex.skipped
                          );
                      
                      return (
                        <Card key={session.id}>
                          <CardHeader className="py-3">
                            <CardTitle className="text-sm flex items-center justify-between">
                              <span>{session.name}</span>
                              {session.sportif_rpe && (
                                <Badge variant="outline">RPE Séance: {session.sportif_rpe}</Badge>
                              )}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="py-2">
                            {exercisesToShow.length > 0 ? (
                              <div className="space-y-2">
                                {exercisesToShow.map((ex: any) => (
                                  <div key={ex.id} className={`text-sm p-2 rounded ${ex.skipped ? 'bg-destructive/10 border border-destructive/30' : 'bg-muted/50'}`}>
                                    <div className="flex items-center justify-between">
                                      <span className={`font-medium ${ex.skipped ? 'text-destructive line-through' : ''}`}>
                                        {ex.exercice}
                                      </span>
                                      <div className="flex gap-1">
                                        {ex.skipped && (
                                          <Badge variant="destructive" className="text-xs">Non fait</Badge>
                                        )}
                                        {ex.sportif_rpe && (
                                          <Badge variant="secondary" className="text-xs">RPE: {ex.sportif_rpe}</Badge>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Données cardio complètes */}
                                    {isCardioSession && (
                                      <div className="flex flex-wrap gap-3 text-xs mt-2 p-2 bg-background/50 rounded">
                                        {ex.actual_distance_km !== null && (
                                          <div className="flex items-center gap-1">
                                            <span className="text-muted-foreground">Distance:</span>
                                            <span className="font-medium">{ex.actual_distance_km} km</span>
                                          </div>
                                        )}
                                        {ex.actual_duration_minutes !== null && (
                                          <div className="flex items-center gap-1">
                                            <span className="text-muted-foreground">Durée:</span>
                                            <span className="font-medium">{Math.floor(ex.actual_duration_minutes)}min{ex.actual_duration_minutes % 1 > 0 ? Math.round((ex.actual_duration_minutes % 1) * 60) + 's' : ''}</span>
                                          </div>
                                        )}
                                        {ex.actual_pace_min_per_km !== null && (
                                          <div className="flex items-center gap-1">
                                            <span className="text-muted-foreground">Allure:</span>
                                            <span className="font-medium">{formatPaceFromDecimal(parsePaceToDecimal(ex.actual_pace_min_per_km)) || ex.actual_pace_min_per_km}</span>
                                          </div>
                                        )}
                                        {ex.actual_avg_heart_rate !== null && (
                                          <div className="flex items-center gap-1">
                                            <span className="text-muted-foreground">FC moy:</span>
                                            <span className="font-medium">{ex.actual_avg_heart_rate} bpm</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Données renfo */}
                                    {!isCardioSession && !ex.skipped && (
                                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
                                        {ex.series && <span>{ex.series} séries</span>}
                                        {ex.reps && <span>× {ex.reps} reps</span>}
                                        {ex.charge && <span>@ {ex.charge}</span>}
                                        {ex.recuperation && <span>• Récup: {ex.recuperation}</span>}
                                      </div>
                                    )}
                                    
                                    {(ex.sportif_feedback || ex.sportif_comment) && (
                                      <p className="text-muted-foreground text-xs mt-1 italic border-l-2 border-primary/30 pl-2">
                                        {ex.sportif_feedback || ex.sportif_comment}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">Aucun retour pour cette séance</p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </SheetContent>
              </Sheet>
            )}
            </div>
          </div>

          {/* Alerte de fatigue */}
          {athlete && (
            <CoachFatigueAlert 
              athleteId={athleteId!} 
              athleteName={`${athlete.first_name || ''} ${athlete.last_name || ''}`.trim() || athlete.email}
            />
          )}

          {/* Alerte objectif atteint */}
          {athlete && (
            <CoachObjectiveAlert 
              athleteId={athleteId!} 
              athleteName={athlete.first_name || "l'athlète"}
              onNavigateToObjectives={() => setActiveTab("objectifs")}
            />
          )}



          <Card>
            <CardHeader className="py-2 sm:py-3 px-2 sm:px-4">
              <CardTitle className="text-sm sm:text-base">Nouvelle programmation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3 px-2 sm:px-4 pb-3 sm:pb-4">
              {/* Sélecteur de semaine compact */}
              {!isValidated && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-2 sm:p-3">
                    <div className="space-y-1.5 sm:space-y-2">
                      {/* Multi-week toggle */}
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="multi-week-mode"
                          checked={multiWeekMode}
                          onCheckedChange={(checked) => {
                            const isEnabled = checked === true;
                            setMultiWeekMode(isEnabled);
                            if (isEnabled) {
                              setMultiWeekStartWeek(selectedWeekToProgram);
                              setMultiWeekCurrent(1);
                            } else {
                              setMultiWeekStartWeek(null);
                              setMultiWeekCurrent(1);
                            }
                          }}
                          disabled={multiWeekMode && multiWeekCurrent > 1}
                        />
                        <label htmlFor="multi-week-mode" className="text-[10px] sm:text-xs text-muted-foreground cursor-pointer">
                          Programmer plusieurs semaines d'affilée
                        </label>
                      </div>

                      {multiWeekMode && (
                        <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 border border-primary/20">
                          <span className="text-[10px] sm:text-xs text-muted-foreground">Nombre de semaines :</span>
                          <select
                            className="p-1 border rounded bg-background text-foreground text-xs focus:ring-2 focus:ring-primary focus:outline-none w-16"
                            value={multiWeekTotal}
                            onChange={(e) => setMultiWeekTotal(Number(e.target.value))}
                            disabled={multiWeekCurrent > 1}
                          >
                            {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                          <Badge variant="outline" className="text-[10px] ml-auto">
                            {multiWeekCurrent}/{multiWeekTotal}
                          </Badge>
                        </div>
                      )}

                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {multiWeekMode 
                          ? `Semaine ${multiWeekCurrent}/${multiWeekTotal}`
                          : "Semaine à programmer (jusqu'à 12 sem.)"
                        }
                      </p>
                      <select
                        className="w-full p-1.5 sm:p-2 border rounded-md bg-background text-foreground text-xs sm:text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                        value={`${selectedWeekToProgram.week}-${selectedWeekToProgram.year}`}
                        onChange={(e) => {
                          const [week, year] = e.target.value.split("-").map(Number);
                          setSelectedWeekToProgram({ week, year });
                          if (multiWeekMode && multiWeekCurrent === 1) {
                            setMultiWeekStartWeek({ week, year });
                          }
                        }}
                        disabled={multiWeekMode && multiWeekCurrent > 1}
                      >
                        {availableWeeks.map((w) => (
                          <option key={`${w.week}-${w.year}`} value={`${w.week}-${w.year}`}>
                            S{w.week} - {w.year} ({formatWeekRange(w.monday)})
                          </option>
                        ))}
                      </select>

                      {/* Affichage du mésocycle actif pour la semaine sélectionnée */}
                      {selectedWeekToProgram && (() => {
                        const selectedWeekInfo = availableWeeks.find(
                          w => w.week === selectedWeekToProgram.week && w.year === selectedWeekToProgram.year
                        );
                        if (!selectedWeekInfo) return null;
                        
                        const weekMonday = selectedWeekInfo.monday;
                        const weekSunday = new Date(weekMonday);
                        weekSunday.setDate(weekSunday.getDate() + 6);
                        
                        const activeMesocycle = athleteMesocycles.find(m => {
                          const startDate = new Date(m.start_date);
                          const endDate = new Date(m.end_date);
                          return weekMonday >= startDate && weekMonday <= endDate;
                        });

                        if (!activeMesocycle) return null;

                        return (
                          <div 
                            className="mt-2 flex items-center gap-2 p-2 rounded-md border"
                            style={{ 
                              borderColor: activeMesocycle.color,
                              backgroundColor: `${activeMesocycle.color}15`
                            }}
                          >
                            <RefreshCw className="h-3.5 w-3.5" style={{ color: activeMesocycle.color }} />
                            <span className="text-xs font-medium">{activeMesocycle.name}</span>
                            {activeMesocycle.description && (
                              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                                - {activeMesocycle.description}
                              </span>
                            )}
                          </div>
                        );
                      })()}

                      {/* Prochain objectif (milestone) dans la programmation */}
                      {(() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const upcomingMilestones = athleteMilestones
                          .filter((m: any) => !m.completed && new Date(m.target_date) >= today)
                          .sort((a: any, b: any) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime());
                        const next = upcomingMilestones[0];
                        if (!next) return null;
                        const daysLeft = Math.ceil((new Date(next.target_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        const label = daysLeft === 0 ? "Aujourd'hui" : daysLeft === 1 ? "Demain" : `J-${daysLeft}`;
                        return (
                          <div className="mt-2 flex items-center gap-2 p-2 rounded-md border border-primary/30 bg-primary/5">
                            <Target className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-medium">{next.label}</span>
                            <Badge variant="outline" className="text-[10px] ml-auto border-primary/50 text-primary font-bold">
                              {label}
                            </Badge>
                          </div>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Bouton de validation compact */}
              {!isValidated && sessions.length > 0 && (
                <div className="flex flex-col gap-2">
                  {multiWeekMode && (
                    <div className="flex items-center justify-between p-2 rounded-md bg-accent/50 border text-xs">
                      <span className="text-muted-foreground">
                        Semaine <strong>{multiWeekCurrent}</strong> sur <strong>{multiWeekTotal}</strong> — S{selectedWeekToProgram.week}
                      </span>
                      {multiWeekCurrent < multiWeekTotal && (
                        <span className="text-primary font-medium">
                          → S{selectedWeekToProgram.week >= 52 ? 1 : selectedWeekToProgram.week + 1} suivante
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    {multiWeekMode && multiWeekCurrent > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setMultiWeekMode(false);
                          setMultiWeekCurrent(1);
                          setMultiWeekStartWeek(null);
                          setSessions([]);
                          setSessionExercises({});
                          setCopiedWeekFeedback({});
                          localStorage.removeItem(`coach-programming-${athleteId}`);
                          toast.info("Mode multi-semaines annulé");
                        }}
                        className="h-9 sm:h-8 text-xs"
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Arrêter
                      </Button>
                    )}
                    <Button 
                      onClick={handleValidate} 
                      size="sm" 
                      disabled={!selectedWeekToProgram} 
                      className="w-full sm:w-auto h-9 sm:h-8 text-xs sm:text-sm"
                    >
                      <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                      {multiWeekMode 
                        ? multiWeekCurrent < multiWeekTotal 
                          ? `Valider S${selectedWeekToProgram.week} → Suivante`
                          : `Valider S${selectedWeekToProgram.week} (dernière)`
                        : "Valider"
                      }
                    </Button>
                  </div>
                </div>
              )}

              {/* Info banner when feedback from copied week is available */}
              {Object.keys(copiedWeekFeedback).length > 0 && (
                <div className="flex items-center gap-2 p-2 bg-primary/10 border border-primary/20 rounded-md text-xs">
                  <MessageSquare className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">
                    Retours de la semaine copiée affichés sous chaque exercice
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="ml-auto h-6 px-2 text-xs"
                    onClick={() => setCopiedWeekFeedback({})}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {sessions.length === 0 ? (
                <div className="text-center py-4 sm:py-6 space-y-1.5 sm:space-y-2">
                  <p className="text-xs sm:text-sm text-muted-foreground">Aucune séance créée.</p>
                  {historicalWeeks.length > 0 ? (
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      Créez une séance ou copiez une semaine.
                    </p>
                  ) : (
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Créez une séance pour commencer.</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-2 sm:space-y-3">
                    {sessions.map((session) => (
                      <div 
                        key={session.id} 
                        className={`rounded-lg transition-all duration-200 ${
                          expandedSessionId === session.id
                            ? 'border border-primary/40 bg-muted/60 shadow-md'
                            : 'border border-border/50 bg-card/40 opacity-75 hover:opacity-100'
                        }`}
                        draggable={!isValidated}
                        onDragStart={() => handleSessionDragStart(session.id)}
                        onDragOver={(e) => handleSessionDragOver(e, session.id)}
                        onDrop={(e) => handleSessionDrop(e, session.id)}
                      >
                        <div
                          className="flex items-center justify-between p-2 sm:p-3 cursor-pointer hover:bg-muted/50 transition-colors gap-1.5 sm:gap-2"
                          onClick={() => !isValidated && toggleSession(session.id)}
                        >
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                            {!isValidated && (
                              <GripVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0" />
                            )}
                            {expandedSessionId === session.id ? (
                              <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                              {!isValidated ? (
                                <Input
                                  value={session.name}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const updatedSessions = sessions.map((s) =>
                                      s.id === session.id ? { ...s, name: e.target.value } : s
                                    );
                                    setSessions(updatedSessions);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="font-medium h-7 w-24 sm:w-40 text-xs sm:text-sm"
                                  placeholder="Nom séance"
                                />
                              ) : (
                                <span className="font-medium text-xs sm:text-sm truncate">{session.name}</span>
                              )}
                              {session.session_type === "renfo" && sessionExercises[session.id]?.length > 0 && (
                                <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">
                                  ({formatSessionDuration(calculateSessionDuration(sessionExercises[session.id]))})
                                </span>
                              )}
                            </div>
                            <Badge variant={session.session_type === "cardio" ? "secondary" : "outline"} className="text-[10px] sm:text-xs flex-shrink-0">
                              {session.session_type === "cardio" ? "Cardio" : session.session_type === "recup" ? "Récup" : "Renfo"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2">
                            {!isValidated && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleDeleteSession(session.id, e)}
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {expandedSessionId === session.id && (
                          <div className="border-t p-1.5 sm:p-4 bg-muted/20 overflow-hidden">
                            <div className="space-y-3 sm:space-y-4">
                              {session.session_type === "cardio" ? (
                                // Interface Cardio
                                <div className="space-y-3">
                                  {(sessionExercises[session.id] || []).length === 0 ? (
                                    <div className="text-center text-muted-foreground py-8">
                                      Aucune étape ajoutée. Clique sur "Ajouter une étape" pour commencer.
                                    </div>
                                  ) : (
                                    (sessionExercises[session.id] || []).map((exercise) => {
                                      let cardioData: CardioData = { steps: [], blocks: [] };

                                      try {
                                        const parsed = exercise.cardio_content
                                          ? JSON.parse(exercise.cardio_content)
                                          : { steps: [], blocks: [] };
                                        cardioData = Array.isArray(parsed)
                                          ? { steps: parsed, blocks: [] }
                                          : parsed;
                                      } catch (e) {
                                        console.error("Erreur lors du parsing de cardio_content:", e);
                                      }

                                      const currentSportType = (exercise.cardio_sport === "velo" || exercise.cardio_sport === "natation" || exercise.cardio_sport === "course") 
                                        ? exercise.cardio_sport 
                                        : "course";

                                      return (
                                        <div
                                          key={exercise.id}
                                          className="space-y-3"
                                        >
                                          {/* Sélecteur de sport cardio */}
                                          <div className="flex items-center gap-3 flex-wrap">
                                            <label className="text-sm font-medium">Type de sport :</label>
                                            <Select
                                              value={currentSportType}
                                              onValueChange={(value: "course" | "velo" | "natation") => {
                                                // Mettre à jour tous les champs en une seule fois pour éviter les conflits d'état
                                                const sportLabels: Record<string, string> = { course: "Séance Course", velo: "Séance Vélo", natation: "Séance Natation" };
                                                const currentExercises = sessionExercises[session.id] || [];
                                                const updatedExercises = currentExercises.map((ex) => 
                                                  ex.id === exercise.id 
                                                    ? { 
                                                        ...ex, 
                                                        cardio_sport: value,
                                                        cardio_content: JSON.stringify({ steps: [], blocks: [] }),
                                                        exercice: sportLabels[value]
                                                      }
                                                    : ex
                                                );
                                                setSessionExercises({
                                                  ...sessionExercises,
                                                  [session.id]: updatedExercises,
                                                });
                                                setSelectedCardioSport(value);
                                              }}
                                              disabled={isValidated}
                                            >
                                              <SelectTrigger className="w-[140px]">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="course">🏃 Course</SelectItem>
                                                <SelectItem value="velo">🚴 Vélo</SelectItem>
                                                <SelectItem value="natation">🏊 Natation</SelectItem>
                                              </SelectContent>
                                            </Select>
                                            
                                            {/* Bouton pour importer un template */}
                                            {!isValidated && (
                                              <Dialog open={showTemplateSelector && expandedSessionId === session.id} onOpenChange={(open) => {
                                                setShowTemplateSelector(open);
                                                if (open) {
                                                  setSelectedCardioSport(currentSportType);
                                                  setTemplateSearchQuery("");
                                                }
                                              }}>
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => {
                                                    setShowTemplateSelector(true);
                                                    setSelectedCardioSport(currentSportType);
                                                  }}
                                                  className="h-8 text-xs"
                                                >
                                                  <Copy className="h-3 w-3 mr-1" />
                                                  Importer
                                                </Button>
                                                <DialogContent className="max-w-md">
                                                  <DialogHeader>
                                                    <DialogTitle>Importer une séance programmée</DialogTitle>
                                                    <DialogDescription>
                                                      Sélectionnez une séance pour remplacer le contenu actuel
                                                    </DialogDescription>
                                                  </DialogHeader>
                                                  
                                                  <div className="space-y-4 py-4">
                                                    {/* Sélecteur de sport */}
                                                    <div className="flex gap-2">
                                                      <Button
                                                        size="sm"
                                                        variant={selectedCardioSport === "course" ? "default" : "outline"}
                                                        onClick={() => setSelectedCardioSport("course")}
                                                        className="flex-1"
                                                      >
                                                        🏃 Course
                                                      </Button>
                                                      <Button
                                                        size="sm"
                                                        variant={selectedCardioSport === "velo" ? "default" : "outline"}
                                                        onClick={() => setSelectedCardioSport("velo")}
                                                        className="flex-1"
                                                      >
                                                        🚴 Vélo
                                                      </Button>
                                                      <Button
                                                        size="sm"
                                                        variant={selectedCardioSport === "natation" ? "default" : "outline"}
                                                        onClick={() => setSelectedCardioSport("natation")}
                                                        className="flex-1"
                                                      >
                                                        🏊 Natation
                                                      </Button>
                                                    </div>
                                                    
                                                    {/* Barre de recherche */}
                                                    <div className="relative">
                                                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                      <Input
                                                        placeholder="Rechercher..."
                                                        value={templateSearchQuery}
                                                        onChange={(e) => setTemplateSearchQuery(e.target.value)}
                                                        className="pl-9"
                                                      />
                                                    </div>
                                                    
                                                    {/* Liste des templates */}
                                                    <div className="max-h-60 overflow-y-auto space-y-2">
                                                      {filteredCardioTemplates.length === 0 ? (
                                                        <p className="text-sm text-muted-foreground text-center py-4">
                                                          Aucune séance programmée
                                                        </p>
                                                      ) : (
                                                        filteredCardioTemplates.map((template) => (
                                                          <Button
                                                            key={template.id}
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleImportTemplateToSession(template.id, session.id, exercise.id)}
                                                            className="w-full justify-start h-auto py-2 px-3 text-left"
                                                          >
                                                            <span className="truncate">{template.name}</span>
                                                          </Button>
                                                        ))
                                                      )}
                                                    </div>
                                                  </div>
                                                </DialogContent>
                                              </Dialog>
                                            )}
                                            
                                            {/* Affichage du feedback de la semaine copiée */}
                                            <ExerciseFeedbackDisplay sessionId={session.id} exerciceName={exercise.exercice} />
                                          </div>

                                          <CardioStepBuilder
                                            steps={cardioData.steps}
                                            blocks={cardioData.blocks}
                                            onChange={(newCardioData) => {
                                              handleExerciseChange(
                                                session.id,
                                                exercise.id,
                                                "cardio_content",
                                                JSON.stringify(newCardioData),
                                              );
                                            }}
                                            athleteVma={athleteVma}
                                            disabled={isValidated}
                                            sportType={currentSportType}
                                          />
                                          
                                          <div className="space-y-2">
                                            <label className="text-sm font-medium">Commentaire</label>
                                            <Textarea
                                              value={exercise.commentaire || ""}
                                              onChange={(e) =>
                                                handleExerciseChange(
                                                  session.id,
                                                  exercise.id,
                                                  "commentaire",
                                                  e.target.value,
                                                )
                                              }
                                              placeholder="Ajouter un commentaire pour cette séance..."
                                              disabled={isValidated}
                                              className="min-h-[80px]"
                                            />
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              ) : session.session_type === "recup" ? (
                                // Interface Récup/Mobilité - Mobile optimized
                                <>
                                  <div className="space-y-2 sm:hidden">
                                    {/* Vue mobile en cartes empilées */}
                                    {(sessionExercises[session.id] || []).length === 0 ? (
                                      <div className="text-center text-muted-foreground py-8 text-xs">
                                        Aucun exercice ajouté.
                                      </div>
                                    ) : (
                                      (sessionExercises[session.id] || []).map((exercise) => (
                                        <div 
                                          key={exercise.id}
                                          className="border rounded-lg p-2 bg-muted/20 space-y-2"
                                          draggable={!isValidated}
                                          onDragStart={() => handleExerciseDragStart(session.id, exercise.id)}
                                          onDragOver={handleExerciseDragOver}
                                          onDrop={(e) => handleExerciseDrop(e, session.id, exercise.id)}
                                        >
                                          <div className="flex items-center gap-1">
                                            {!isValidated && (
                                              <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0" />
                                            )}
                                            <div className="flex-1">
                                              <ExerciseCombobox
                                                value={exercise.exercice}
                                                onChange={(value) =>
                                                  handleExerciseChange(session.id, exercise.id, "exercice", value)
                                                }
                                                exercises={libraryExercises.filter(
                                                  (ex) => ex.category === "mobilité-souplesse" || ex.category === "massage"
                                                )}
                                                disabled={isValidated}
                                              />
                                            </div>
                                            {!isValidated && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteExercise(session.id, exercise.id)}
                                                className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                                              >
                                                <X className="h-3 w-3" />
                                              </Button>
                                            )}
                                          </div>
                                          <div className="grid grid-cols-2 gap-2">
                                            <div>
                                              <label className="text-[9px] text-muted-foreground">Durée/Reps</label>
                                              <Input
                                                value={exercise.reps}
                                                onChange={(e) =>
                                                  handleExerciseChange(session.id, exercise.id, "reps", e.target.value)
                                                }
                                                placeholder="3x30sec"
                                                disabled={isValidated}
                                                className="h-7 text-xs"
                                              />
                                            </div>
                                            <div>
                                              <label className="text-[9px] text-muted-foreground">Notes</label>
                                              <Input
                                                value={exercise.commentaire}
                                                onChange={(e) =>
                                                  handleExerciseChange(session.id, exercise.id, "commentaire", e.target.value)
                                                }
                                                placeholder="Notes..."
                                                disabled={isValidated}
                                                className="h-7 text-xs"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                  
                                  {/* Vue desktop en table */}
                                  <div className="overflow-x-auto hidden sm:block">
                                    <Table className="text-sm">
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="min-w-[180px]">Exercice</TableHead>
                                          <TableHead className="min-w-[120px]">Durée/Reps</TableHead>
                                          <TableHead className="min-w-[200px]">Notes</TableHead>
                                          <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {(sessionExercises[session.id] || []).length === 0 ? (
                                          <TableRow>
                                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                              Aucun exercice ajouté.
                                            </TableCell>
                                          </TableRow>
                                         ) : (
                                           (sessionExercises[session.id] || []).map((exercise) => (
                                             <TableRow 
                                               key={exercise.id}
                                               draggable={!isValidated}
                                               onDragStart={() => handleExerciseDragStart(session.id, exercise.id)}
                                               onDragOver={handleExerciseDragOver}
                                               onDrop={(e) => handleExerciseDrop(e, session.id, exercise.id)}
                                             >
                                               <TableCell>
                                                 <div className="flex items-center gap-2">
                                                   {!isValidated && (
                                                     <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                                                   )}
                                                   <div className="flex-1">
                                                     <ExerciseCombobox
                                                       value={exercise.exercice}
                                                       onChange={(value) =>
                                                         handleExerciseChange(session.id, exercise.id, "exercice", value)
                                                       }
                                                       exercises={libraryExercises.filter(
                                                         (ex) => ex.category === "mobilité-souplesse" || ex.category === "massage"
                                                       )}
                                                       disabled={isValidated}
                                                     />
                                                   </div>
                                                 </div>
                                               </TableCell>
                                              <TableCell>
                                                <Input
                                                  value={exercise.reps}
                                                  onChange={(e) =>
                                                    handleExerciseChange(session.id, exercise.id, "reps", e.target.value)
                                                  }
                                                  placeholder="ex: 3x30sec ou 10 reps"
                                                  disabled={isValidated}
                                                />
                                              </TableCell>
                                              <TableCell>
                                                <Input
                                                  value={exercise.commentaire}
                                                  onChange={(e) =>
                                                    handleExerciseChange(session.id, exercise.id, "commentaire", e.target.value)
                                                  }
                                                  placeholder="Notes..."
                                                  disabled={isValidated}
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
                                    <Button onClick={() => handleAddExercise(session.id)} variant="outline" size="sm" className="text-xs sm:text-sm">
                                      <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                      <span className="hidden sm:inline">Ajouter une ligne</span>
                                      <span className="sm:hidden">Ajouter</span>
                                    </Button>
                                  )}
                                </>
                              ) : (
                                // Interface Renfo
                                <>
                                  {/* Vue mobile en cartes empilées */}
                                  <div className="space-y-2 sm:hidden">
                                    {(sessionExercises[session.id] || []).length === 0 ? (
                                      <div className="text-center text-muted-foreground py-8 text-xs">
                                        Aucun exercice ajouté.
                                      </div>
                                    ) : (
                                      (() => {
                                        const exercises = sessionExercises[session.id] || [];
                                        const result: JSX.Element[] = [];
                                        let i = 0;

                                        while (i < exercises.length) {
                                          const exercise = exercises[i];

                                          // Si l'exercice fait partie d'un super-set
                                          if (exercise.super_set_group) {
                                            const groupExercises: Exercise[] = [];
                                            let j = i;
                                            while (
                                              j < exercises.length &&
                                              exercises[j].super_set_group === exercise.super_set_group
                                            ) {
                                              groupExercises.push(exercises[j]);
                                              j++;
                                            }

                                            // Bloc super-set mobile
                                            result.push(
                                              <div key={`mobile-superset-${exercise.super_set_group}`} className="border-2 border-primary rounded-lg p-2 bg-primary/5 space-y-2">
                                                <div className="flex items-center justify-between">
                                                  <Badge variant="default" className="text-[10px]">
                                                    Super-set ({groupExercises.length})
                                                  </Badge>
                                                  <div className="flex items-center gap-1">
                                                    <span className="text-[10px] text-muted-foreground">Séries:</span>
                                                    <Input
                                                      value={exercise.series}
                                                      onChange={(e) =>
                                                        handleExerciseChange(session.id, exercise.id, "series", e.target.value)
                                                      }
                                                      disabled={isValidated}
                                                      className="h-6 w-10 text-xs text-center p-0"
                                                    />
                                                  </div>
                                                </div>
                                                {groupExercises.map((ex) => (
                                                  <div key={ex.id} className="border rounded p-2 bg-background space-y-1.5">
                                                    <div className="flex items-center gap-1">
                                                      {!isValidated && (
                                                        <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                                      )}
                                                      <div className="flex-1">
                                                        <ExerciseCombobox
                                                          value={ex.exercice}
                                                          onChange={(value) => handleExerciseChange(session.id, ex.id, "exercice", value)}
                                                          exercises={libraryExercises}
                                                          disabled={isValidated}
                                                        />
                                                        <ExerciseFeedbackDisplay sessionId={session.id} exerciceName={ex.exercice} />
                                                      </div>
                                                      {!isValidated && (
                                                        <Button
                                                          variant="ghost"
                                                          size="sm"
                                                          onClick={() => handleDeleteExercise(session.id, ex.id)}
                                                          className="h-5 w-5 p-0 text-destructive"
                                                        >
                                                          <X className="h-3 w-3" />
                                                        </Button>
                                                      )}
                                                    </div>
                                                    <div className="grid grid-cols-4 gap-1">
                                                      <div>
                                                        <label className="text-[8px] text-muted-foreground">Récup</label>
                                                        <Select
                                                          value={ex.recuperation}
                                                          onValueChange={(value) => handleExerciseChange(session.id, ex.id, "recuperation", value)}
                                                          disabled={isValidated}
                                                        >
                                                          <SelectTrigger className="h-6 text-[10px] px-1">
                                                            <SelectValue placeholder="--" />
                                                          </SelectTrigger>
                                                          <SelectContent>
                                                            {recuperationOptions.map((option) => (
                                                              <SelectItem key={option.value} value={option.value} className="text-xs">
                                                                {option.label}
                                                              </SelectItem>
                                                            ))}
                                                          </SelectContent>
                                                        </Select>
                                                      </div>
                                                      <div>
                                                        <label className="text-[8px] text-muted-foreground">{ex.is_duration ? "Durée" : "Reps"}</label>
                                                        <Input value={ex.reps} onChange={(e) => handleExerciseChange(session.id, ex.id, "reps", e.target.value)} disabled={isValidated} className="h-6 text-[10px] px-1" placeholder="10" />
                                                      </div>
                                                      <div>
                                                        <label className="text-[8px] text-muted-foreground">RPE</label>
                                                        <Input value={ex.rpe} onChange={(e) => handleExerciseChange(session.id, ex.id, "rpe", e.target.value)} disabled={isValidated} className="h-6 text-[10px] px-1" placeholder="8" />
                                                      </div>
                                                      <div>
                                                        <label className="text-[8px] text-muted-foreground">Charge</label>
                                                        <Input value={ex.charge} onChange={(e) => handleExerciseChange(session.id, ex.id, "charge", e.target.value)} disabled={isValidated} className="h-6 text-[10px] px-1" placeholder="kg" />
                                                      </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-1">
                                                      <div>
                                                        <label className="text-[8px] text-muted-foreground">Tempo</label>
                                                        <Input value={ex.tempo} onChange={(e) => handleExerciseChange(session.id, ex.id, "tempo", e.target.value)} disabled={isValidated} className="h-6 text-[10px] px-1" placeholder="3010" />
                                                      </div>
                                                      <div>
                                                        <label className="text-[8px] text-muted-foreground">Comm.</label>
                                                        <Input value={ex.commentaire} onChange={(e) => handleExerciseChange(session.id, ex.id, "commentaire", e.target.value)} disabled={isValidated} className="h-6 text-[10px] px-1" placeholder="..." />
                                                      </div>
                                                    </div>
                                                    <div className="flex gap-2 flex-wrap">
                                                      <div className="flex items-center gap-1">
                                                        <Checkbox id={`mobile-dur-${ex.id}`} checked={ex.is_duration || false} onCheckedChange={(c) => handleExerciseChange(session.id, ex.id, "is_duration", c as boolean)} disabled={isValidated} className="h-3 w-3" />
                                                        <label htmlFor={`mobile-dur-${ex.id}`} className="text-[9px]">durée</label>
                                                      </div>
                                                      {ex.is_unilateral && (
                                                        <div className="flex items-center gap-1">
                                                          <Checkbox id={`mobile-side-${ex.id}`} checked={ex.per_side || false} onCheckedChange={(c) => handleExerciseChange(session.id, ex.id, "per_side", c as boolean)} disabled={isValidated} className="h-3 w-3" />
                                                          <label htmlFor={`mobile-side-${ex.id}`} className="text-[9px]">par côté</label>
                                                        </div>
                                                      )}
                                                      <div className="flex items-center gap-1">
                                                        <Checkbox id={`mobile-video-${ex.id}`} checked={ex.request_video || false} onCheckedChange={(c) => handleExerciseChange(session.id, ex.id, "request_video", c as boolean)} disabled={isValidated} className="h-3 w-3" />
                                                        <label htmlFor={`mobile-video-${ex.id}`} className="text-[9px] flex items-center gap-0.5">
                                                          <Video className="h-2.5 w-2.5" /> vidéo
                                                        </label>
                                                      </div>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            );
                                            i = j;
                                          } else {
                                            // Exercice normal mobile
                                            result.push(
                                              <div 
                                                key={exercise.id} 
                                                className="border rounded-lg p-2 bg-muted/20 space-y-1.5"
                                                draggable={!isValidated}
                                                onDragStart={() => handleExerciseDragStart(session.id, exercise.id)}
                                                onDragOver={handleExerciseDragOver}
                                                onDrop={(e) => handleExerciseDrop(e, session.id, exercise.id)}
                                              >
                                                <div className="flex items-center gap-1">
                                                  {!isValidated && (
                                                    <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                                  )}
                                                  <div className="flex-1">
                                                    <ExerciseCombobox
                                                      value={exercise.exercice}
                                                      onChange={(value) => handleExerciseChange(session.id, exercise.id, "exercice", value)}
                                                      exercises={libraryExercises}
                                                      disabled={isValidated}
                                                    />
                                                    <ExerciseFeedbackDisplay sessionId={session.id} exerciceName={exercise.exercice} />
                                                  </div>
                                                  {!isValidated && (
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() => handleDeleteExercise(session.id, exercise.id)}
                                                      className="h-5 w-5 p-0 text-destructive"
                                                    >
                                                      <X className="h-3 w-3" />
                                                    </Button>
                                                  )}
                                                </div>
                                                <div className="grid grid-cols-4 gap-1">
                                                  <div>
                                                    <label className="text-[8px] text-muted-foreground">Récup</label>
                                                    <Select
                                                      value={exercise.recuperation}
                                                      onValueChange={(value) => handleExerciseChange(session.id, exercise.id, "recuperation", value)}
                                                      disabled={isValidated}
                                                    >
                                                      <SelectTrigger className="h-6 text-[10px] px-1">
                                                        <SelectValue placeholder="--" />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        {recuperationOptions.map((option) => (
                                                          <SelectItem key={option.value} value={option.value} className="text-xs">
                                                            {option.label}
                                                          </SelectItem>
                                                        ))}
                                                      </SelectContent>
                                                    </Select>
                                                  </div>
                                                  <div>
                                                    <label className="text-[8px] text-muted-foreground">{exercise.is_duration ? "Durée" : "Reps"}</label>
                                                    <Input value={exercise.reps} onChange={(e) => handleExerciseChange(session.id, exercise.id, "reps", e.target.value)} disabled={isValidated} className="h-6 text-[10px] px-1" placeholder="10" />
                                                  </div>
                                                  <div>
                                                    <label className="text-[8px] text-muted-foreground">Séries</label>
                                                    <Input value={exercise.series} onChange={(e) => handleExerciseChange(session.id, exercise.id, "series", e.target.value)} disabled={isValidated} className="h-6 text-[10px] px-1" placeholder="3" />
                                                  </div>
                                                  <div>
                                                    <label className="text-[8px] text-muted-foreground">RPE</label>
                                                    <Input value={exercise.rpe} onChange={(e) => handleExerciseChange(session.id, exercise.id, "rpe", e.target.value)} disabled={isValidated} className="h-6 text-[10px] px-1" placeholder="8" />
                                                  </div>
                                                </div>
                                                <div className="grid grid-cols-3 gap-1">
                                                  <div>
                                                    <label className="text-[8px] text-muted-foreground">Charge</label>
                                                    <Input value={exercise.charge} onChange={(e) => handleExerciseChange(session.id, exercise.id, "charge", e.target.value)} disabled={isValidated} className="h-6 text-[10px] px-1" placeholder="kg" />
                                                  </div>
                                                  <div>
                                                    <label className="text-[8px] text-muted-foreground">Tempo</label>
                                                    <Input value={exercise.tempo} onChange={(e) => handleExerciseChange(session.id, exercise.id, "tempo", e.target.value)} disabled={isValidated} className="h-6 text-[10px] px-1" placeholder="3010" />
                                                  </div>
                                                  <div>
                                                    <label className="text-[8px] text-muted-foreground">Comm.</label>
                                                    <Input value={exercise.commentaire} onChange={(e) => handleExerciseChange(session.id, exercise.id, "commentaire", e.target.value)} disabled={isValidated} className="h-6 text-[10px] px-1" placeholder="..." />
                                                  </div>
                                                </div>
                                                <div className="flex gap-2 flex-wrap">
                                                  <div className="flex items-center gap-1">
                                                    <Checkbox id={`mobile-dur-normal-${exercise.id}`} checked={exercise.is_duration || false} onCheckedChange={(c) => handleExerciseChange(session.id, exercise.id, "is_duration", c as boolean)} disabled={isValidated} className="h-3 w-3" />
                                                    <label htmlFor={`mobile-dur-normal-${exercise.id}`} className="text-[9px]">durée</label>
                                                  </div>
                                                  {exercise.is_unilateral && (
                                                    <div className="flex items-center gap-1">
                                                      <Checkbox id={`mobile-side-normal-${exercise.id}`} checked={exercise.per_side || false} onCheckedChange={(c) => handleExerciseChange(session.id, exercise.id, "per_side", c as boolean)} disabled={isValidated} className="h-3 w-3" />
                                                      <label htmlFor={`mobile-side-normal-${exercise.id}`} className="text-[9px]">par côté</label>
                                                    </div>
                                                  )}
                                                  <div className="flex items-center gap-1">
                                                    <Checkbox id={`mobile-video-normal-${exercise.id}`} checked={exercise.request_video || false} onCheckedChange={(c) => handleExerciseChange(session.id, exercise.id, "request_video", c as boolean)} disabled={isValidated} className="h-3 w-3" />
                                                    <label htmlFor={`mobile-video-normal-${exercise.id}`} className="text-[9px] flex items-center gap-0.5">
                                                      <Video className="h-2.5 w-2.5" /> vidéo
                                                    </label>
                                                  </div>
                                                </div>
                                                {/* Bouton super-set mobile */}
                                                {i < exercises.length - 1 && !isValidated && (
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleToggleSuperSet(session.id, exercise.id)}
                                                    className="w-full h-6 text-[10px] mt-1"
                                                  >
                                                    <Plus className="h-2.5 w-2.5 mr-1" />
                                                    Super-set
                                                  </Button>
                                                )}
                                              </div>
                                            );
                                            i++;
                                          }
                                        }
                                        return result;
                                      })()
                                    )}
                                  </div>

                                  {/* Vue desktop en table */}
                                  <div className="overflow-x-auto hidden sm:block">
                                    <Table className="text-xs md:text-sm">
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="min-w-[130px]">Exercice</TableHead>
                                          <TableHead className="min-w-[90px]">Récup</TableHead>
                                          <TableHead className="min-w-[70px]">Reps</TableHead>
                                          <TableHead className="min-w-[60px]">Séries</TableHead>
                                          <TableHead className="min-w-[50px]">RPE</TableHead>
                                          <TableHead className="min-w-[70px]">Charge</TableHead>
                                          <TableHead className="min-w-[70px]">Tempo</TableHead>
                                          <TableHead className="min-w-[120px]">Comm.</TableHead>
                                          <TableHead className="w-[50px] text-center">
                                            <Video className="h-4 w-4 mx-auto" />
                                          </TableHead>
                                          <TableHead className="w-[40px]"></TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {(sessionExercises[session.id] || []).length === 0 ? (
                                          <TableRow>
                                            <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                                              Aucun exercice ajouté.
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
                                                        colSpan={10}
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
                                                           <TableRow 
                                                             className="bg-primary/5 border-l-4 border-l-primary"
                                                             draggable={!isValidated}
                                                             onDragStart={() => handleExerciseDragStart(session.id, ex.id)}
                                                             onDragOver={handleExerciseDragOver}
                                                             onDrop={(e) => handleExerciseDrop(e, session.id, ex.id)}
                                                           >
                                                             <TableCell>
                                                               <div className="flex items-center gap-2">
                                                                 {!isValidated && (
                                                                   <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                                                                 )}
                                                                 <div
                                                                   data-session={session.id}
                                                                   data-exercise={ex.id}
                                                                   data-field="exercice"
                                                                   className="flex-1"
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
                                                                     autoOpen={autoOpenExercise?.sessionId === session.id && autoOpenExercise?.exerciseId === ex.id}
                                                                     onAutoOpenHandled={() => setAutoOpenExercise(null)}
                                                                   />
                                                                   <ExerciseFeedbackDisplay sessionId={session.id} exerciceName={ex.exercice} />
                                                                 </div>
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
                                                              <div className="space-y-2">
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
                                                                  placeholder={ex.is_duration ? "ex: 20 (sec)" : "ex: 10"}
                                                                  disabled={isValidated}
                                                                  data-session={session.id}
                                                                  data-exercise={ex.id}
                                                                  data-field="reps"
                                                                />
                                                                <div className="flex items-center space-x-2">
                                                                  <Checkbox
                                                                    id={`is-duration-superset-${session.id}-${ex.id}`}
                                                                    checked={ex.is_duration || false}
                                                                    onCheckedChange={(checked) =>
                                                                      handleExerciseChange(
                                                                        session.id,
                                                                        ex.id,
                                                                        "is_duration",
                                                                        checked as boolean
                                                                      )
                                                                    }
                                                                    disabled={isValidated}
                                                                  />
                                                                  <label
                                                                    htmlFor={`is-duration-superset-${session.id}-${ex.id}`}
                                                                    className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 cursor-pointer"
                                                                  >
                                                                    durée (sec)
                                                                  </label>
                                                                </div>
                                                                {ex.is_unilateral && (
                                                                  <div className="flex items-center space-x-2">
                                                                    <Checkbox
                                                                      id={`per-side-${session.id}-${ex.id}`}
                                                                      checked={ex.per_side || false}
                                                                      onCheckedChange={(checked) =>
                                                                        handleExerciseChange(
                                                                          session.id,
                                                                          ex.id,
                                                                          "per_side",
                                                                          checked as boolean
                                                                        )
                                                                      }
                                                                      disabled={isValidated}
                                                                    />
                                                                    <label
                                                                      htmlFor={`per-side-${session.id}-${ex.id}`}
                                                                      className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 cursor-pointer"
                                                                    >
                                                                      par côté
                                                                    </label>
                                                                  </div>
                                                                )}
                                                              </div>
                                                            </TableCell>
                                                            <TableCell>
                                                              {/* Case de série masquée pour les exercices du super-set */}
                                                              <div className="text-center text-muted-foreground text-xs">
                                                                (voir en-tête)
                                                              </div>
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
                                                                 placeholder={
                                                                   !ex.charge && chargeSuggestions[session.id]?.[ex.id]
                                                                     ? `${chargeSuggestions[session.id][ex.id]}kg`
                                                                     : "ex: 80kg"
                                                                 }
                                                                 disabled={isValidated}
                                                                 data-session={session.id}
                                                                 data-exercise={ex.id}
                                                                 data-field="charge"
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
                                                            <TableCell className="text-center">
                                                              <Checkbox
                                                                checked={ex.request_video || false}
                                                                onCheckedChange={(checked) =>
                                                                  handleExerciseChange(
                                                                    session.id,
                                                                    ex.id,
                                                                    "request_video",
                                                                    checked === true,
                                                                  )
                                                                }
                                                                disabled={isValidated}
                                                                title="Demander une vidéo à l'athlète"
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
                                                                colSpan={10}
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
                                                        colSpan={10}
                                                        className="p-0 h-2 bg-muted/30"
                                                      ></TableCell>
                                                    </TableRow>

                                                    {/* Bouton pour ajouter au super-set si pas le dernier exercice */}
                                                    {i + groupExercises.length < exercises.length && !isValidated && (
                                                      <TableRow>
                                                        <TableCell colSpan={10} className="p-0 h-8 relative group">
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
                                                     <TableRow
                                                       draggable={!isValidated}
                                                       onDragStart={() => handleExerciseDragStart(session.id, exercise.id)}
                                                       onDragOver={handleExerciseDragOver}
                                                       onDrop={(e) => handleExerciseDrop(e, session.id, exercise.id)}
                                                     >
                                                       <TableCell>
                                                         <div className="flex items-center gap-2">
                                                           {!isValidated && (
                                                             <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                                                           )}
                                                           <div
                                                             data-session={session.id}
                                                             data-exercise={exercise.id}
                                                             data-field="exercice"
                                                             className="flex-1"
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
                                                               autoOpen={autoOpenExercise?.sessionId === session.id && autoOpenExercise?.exerciseId === exercise.id}
                                                               onAutoOpenHandled={() => setAutoOpenExercise(null)}
                                                             />
                                                             <ExerciseFeedbackDisplay sessionId={session.id} exerciceName={exercise.exercice} />
                                                           </div>
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
                                                        <div className="space-y-2">
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
                                                            placeholder={exercise.is_duration ? "ex: 20 (sec)" : "ex: 10"}
                                                            disabled={isValidated}
                                                            data-session={session.id}
                                                            data-exercise={exercise.id}
                                                            data-field="reps"
                                                          />
                                                          <div className="flex items-center space-x-2">
                                                            <Checkbox
                                                              id={`is-duration-${session.id}-${exercise.id}`}
                                                              checked={exercise.is_duration || false}
                                                              onCheckedChange={(checked) =>
                                                                handleExerciseChange(
                                                                  session.id,
                                                                  exercise.id,
                                                                  "is_duration",
                                                                  checked as boolean
                                                                )
                                                              }
                                                              disabled={isValidated}
                                                            />
                                                            <label
                                                              htmlFor={`is-duration-${session.id}-${exercise.id}`}
                                                              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 cursor-pointer"
                                                            >
                                                              durée (sec)
                                                            </label>
                                                          </div>
                                                          {exercise.is_unilateral && (
                                                            <div className="flex items-center space-x-2">
                                                              <Checkbox
                                                                id={`per-side-${session.id}-${exercise.id}`}
                                                                checked={exercise.per_side || false}
                                                                onCheckedChange={(checked) =>
                                                                  handleExerciseChange(
                                                                    session.id,
                                                                    exercise.id,
                                                                    "per_side",
                                                                    checked as boolean
                                                                  )
                                                                }
                                                                disabled={isValidated}
                                                              />
                                                              <label
                                                                htmlFor={`per-side-${session.id}-${exercise.id}`}
                                                                className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 cursor-pointer"
                                                              >
                                                                par côté
                                                              </label>
                                                            </div>
                                                          )}
                                                        </div>
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
                                                           placeholder={
                                                             !exercise.charge && chargeSuggestions[session.id]?.[exercise.id]
                                                               ? `${chargeSuggestions[session.id][exercise.id]}kg`
                                                               : "ex: 80kg"
                                                           }
                                                           disabled={isValidated}
                                                           data-session={session.id}
                                                           data-exercise={exercise.id}
                                                           data-field="charge"
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
                                                      <TableCell className="text-center">
                                                        <Checkbox
                                                          checked={exercise.request_video || false}
                                                          onCheckedChange={(checked) =>
                                                            handleExerciseChange(
                                                              session.id,
                                                              exercise.id,
                                                              "request_video",
                                                              checked === true,
                                                            )
                                                          }
                                                          disabled={isValidated}
                                                          title="Demander une vidéo à l'athlète"
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
                                                        <TableCell colSpan={10} className="p-0 h-8 relative group">
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
                                    <div className="flex gap-2 flex-wrap">
                                      <Button onClick={() => handleAddExercise(session.id)} variant="outline" size="sm" className="text-xs sm:text-sm">
                                        <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                        <span className="hidden sm:inline">Ajouter une ligne</span>
                                        <span className="sm:hidden">Ajouter</span>
                                      </Button>
                                      
                                      {/* Bouton pour importer un template renfo */}
                                      <Dialog 
                                        open={showRenfoTemplateSelector === session.id} 
                                        onOpenChange={(open) => {
                                          setShowRenfoTemplateSelector(open ? session.id : null);
                                          if (!open) setTemplateSearchQuery("");
                                        }}
                                      >
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            setShowRenfoTemplateSelector(session.id);
                                            setTemplateSearchQuery("");
                                          }}
                                          className="text-xs sm:text-sm"
                                        >
                                          <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                          <span className="hidden sm:inline">Importer</span>
                                          <span className="sm:hidden">Import</span>
                                        </Button>
                                        <DialogContent className="max-w-md">
                                          <DialogHeader>
                                            <DialogTitle>Importer une séance programmée</DialogTitle>
                                            <DialogDescription>
                                              Sélectionnez une séance pour remplacer le contenu actuel
                                            </DialogDescription>
                                          </DialogHeader>
                                          
                                          <div className="space-y-4 py-4">
                                            {/* Barre de recherche */}
                                            <div className="relative">
                                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                              <Input
                                                placeholder="Rechercher..."
                                                value={templateSearchQuery}
                                                onChange={(e) => setTemplateSearchQuery(e.target.value)}
                                                className="pl-9"
                                              />
                                            </div>
                                            
                                            {/* Liste des templates */}
                                            <div className="max-h-60 overflow-y-auto space-y-2">
                                              {filteredRenfoTemplates.length === 0 ? (
                                                <p className="text-sm text-muted-foreground text-center py-4">
                                                  Aucune séance programmée
                                                </p>
                                              ) : (
                                                filteredRenfoTemplates.map((template) => (
                                                  <Button
                                                    key={template.id}
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleImportRenfoTemplateToSession(template.id, session.id)}
                                                    className="w-full justify-start h-auto py-2 px-3 text-left"
                                                  >
                                                    <span className="truncate">{template.name}</span>
                                                  </Button>
                                                ))
                                              )}
                                            </div>
                                          </div>
                                        </DialogContent>
                                      </Dialog>
                                    </div>
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

              {/* Boutons de création - optimisés mobile */}
              {!isValidated && (
                <div className="mt-4 sm:mt-6 space-y-2 sm:space-y-0 sm:flex sm:justify-between sm:gap-2">
                  {historicalWeeks.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyPreviousWeek}
                        disabled={!selectedWeekToProgram}
                        className="w-full sm:w-auto h-9 sm:h-8 text-xs"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        <span className="sm:hidden">Copier précédente</span>
                        <span className="hidden sm:inline">Copier semaine précédente</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCopyDialog(true)}
                        disabled={!selectedWeekToProgram}
                        className="w-full sm:w-auto h-9 sm:h-8 text-xs"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        <span className="sm:hidden">Autre semaine</span>
                        <span className="hidden sm:inline">Copier d'une semaine</span>
                      </Button>
                    </div>
                  )}
                  {/* Grille 2x2 sur mobile, inline sur desktop */}
                  <div className="grid grid-cols-4 sm:flex gap-1.5 sm:gap-2 sm:ml-auto">
                    <Button
                      size="sm"
                      variant={newSessionType === "renfo" ? "default" : "outline"}
                      onClick={() => setNewSessionType("renfo")}
                      disabled={!selectedWeekToProgram}
                      className="h-11 sm:h-8 text-[11px] sm:text-sm px-2 sm:px-3 min-w-[44px]"
                    >
                      Renfo
                    </Button>
                    <Button
                      size="sm"
                      variant={newSessionType === "cardio" ? "default" : "outline"}
                      onClick={() => setNewSessionType("cardio")}
                      disabled={!selectedWeekToProgram}
                      className="h-11 sm:h-8 text-[11px] sm:text-sm px-2 sm:px-3 min-w-[44px]"
                    >
                      Cardio
                    </Button>
                    <Button
                      size="sm"
                      variant={newSessionType === "recup" ? "default" : "outline"}
                      onClick={() => setNewSessionType("recup")}
                      disabled={!selectedWeekToProgram}
                      className="h-11 sm:h-8 text-[11px] sm:text-sm px-2 sm:px-3 min-w-[44px]"
                    >
                      Récup
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleCreateSession} 
                      disabled={!selectedWeekToProgram} 
                      className="h-11 sm:h-8 text-[11px] sm:text-sm px-2 sm:px-3 min-w-[44px]"
                    >
                      <Plus className="h-4 w-4" />
                      <span className="hidden sm:inline ml-1">Créer</span>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="efforts" className="space-y-4">
          {/* Menu de sélection du type d'effort */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant={selectedEffortType === "renfo" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedEffortType("renfo")}
            >
              <Dumbbell className="h-4 w-4 mr-2" />
              Renfo
            </Button>
            <Button
              variant={selectedEffortType === "course" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedEffortType("course")}
            >
              <Activity className="h-4 w-4 mr-2" />
              Course
            </Button>
            <Button
              variant={selectedEffortType === "velo" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedEffortType("velo")}
            >
              <Activity className="h-4 w-4 mr-2" />
              Vélo
            </Button>
            <Button
              variant={selectedEffortType === "natation" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedEffortType("natation")}
            >
              <Activity className="h-4 w-4 mr-2" />
              Natation
            </Button>
            <Button
              variant={selectedEffortType === "triathlon" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedEffortType("triathlon")}
            >
              <Activity className="h-4 w-4 mr-2" />
              Triathlon
            </Button>
          </div>

          {/* Contenu selon le type sélectionné */}
          {selectedEffortType === "renfo" && (
            <CoachStrengthView 
              athleteId={athleteId!} 
              athleteName={athlete.first_name || "l'athlète"} 
            />
          )}
          {selectedEffortType === "course" && (
            <CoachRunningView 
              athleteId={athleteId!} 
              athleteName={athlete.first_name || "l'athlète"} 
            />
          )}
          {selectedEffortType === "velo" && (
            <CoachCyclingView 
              athleteId={athleteId!} 
              athleteName={athlete.first_name || "l'athlète"} 
            />
          )}
          {selectedEffortType === "natation" && (
            <CoachSwimmingView 
              athleteId={athleteId!} 
              athleteName={athlete.first_name || "l'athlète"} 
            />
          )}
          {selectedEffortType === "triathlon" && (
            <CoachTriathlonView 
              athleteId={athleteId!} 
              athleteName={athlete.first_name || "l'athlète"} 
            />
          )}
        </TabsContent>

        <TabsContent value="max" className="space-y-4">
          <CoachMaxesView 
            athleteId={athleteId!} 
            athleteName={athlete.first_name || "l'athlète"} 
          />
        </TabsContent>

        <TabsContent value="suivi" className="space-y-4">
          <CoachFatigueView 
            athleteId={athleteId!} 
            athleteName={athlete.first_name || "l'athlète"} 
          />
        </TabsContent>

        <TabsContent value="poids" className="space-y-4">
          <CoachWeightView 
            athleteId={athleteId!} 
            athleteName={athlete.first_name || "l'athlète"} 
          />
        </TabsContent>

        <TabsContent value="objectifs" className="space-y-4">
          <CoachObjectivesView 
            athleteId={athleteId!} 
            athleteName={athlete.first_name || "l'athlète"} 
          />
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
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-3 sm:p-4 bg-muted/50 rounded-lg">
                        <div className="space-y-1 sm:space-y-2">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <h3 className="font-semibold text-sm sm:text-base">
                              Semaine {selectedHistoricalWeek.week_number} - {selectedHistoricalWeek.year}
                            </h3>
                            {(() => {
                              const weekSessions = historicalSessions.filter((s: any) => s.week_id === selectedHistoricalWeek.id);
                              if (weekSessions.length === 0) return null;
                              
                              let totalSessionCount = weekSessions.length;
                              let completedSessionCount = 0;
                              
                              weekSessions.forEach((s: any) => {
                                const exercises = s.session_exercises || [];
                                
                                // Pour les sessions Récup/Mobilité
                                if (s.session_type === "recup") {
                                  if (s.duration_minutes !== null && s.duration_minutes !== undefined) {
                                    completedSessionCount++;
                                  }
                                  return;
                                }
                                
                                // Pour les autres séances: vérifier si tous les exercices sont complétés (avec RPE, données cardio, ou skipped)
                                if (exercises.length > 0) {
                                  const allCompleted = exercises.every((ex: any) => 
                                    ex.sportif_rpe !== null || 
                                    ex.actual_distance_km !== null || 
                                    ex.actual_duration_minutes !== null || 
                                    ex.actual_pace_min_per_km !== null || 
                                    ex.actual_avg_heart_rate !== null ||
                                    ex.skipped === true
                                  );
                                  if (allCompleted) {
                                    completedSessionCount++;
                                  }
                                }
                              });
                              
                              if (completedSessionCount === 0) {
                                return <Badge variant="outline" className="text-muted-foreground text-xs">Non commencée</Badge>;
                              } else if (completedSessionCount === totalSessionCount) {
                                return <Badge className="bg-green-600 text-white text-xs">Semaine terminée</Badge>;
                              } else {
                                return <Badge className="bg-orange-500 text-white text-xs">En cours ({completedSessionCount}/{totalSessionCount})</Badge>;
                              }
                            })()}
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            Validée le {new Date(selectedHistoricalWeek.validated_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {!isEditingHistorical ? (
                            <Button onClick={handleStartEditingHistorical} variant="outline" size="sm" className="text-xs sm:text-sm">
                              Modifier
                            </Button>
                          ) : (
                            <>
                              <Button onClick={handleSaveHistoricalChanges} variant="default" size="sm" className="text-xs sm:text-sm">
                                <Check className="h-4 w-4 mr-1 sm:mr-2" />
                                Enregistrer
                              </Button>
                              <Button onClick={handleCancelEditingHistorical} variant="outline" size="sm" className="text-xs sm:text-sm">
                                Annuler
                              </Button>
                              <Button onClick={() => setShowDeleteWeekDialog(true)} variant="destructive" size="sm" className="text-xs sm:text-sm">
                                <Trash2 className="h-4 w-4 mr-1 sm:mr-2" />
                                <span className="hidden sm:inline">Supprimer la semaine</span>
                                <span className="sm:hidden">Supprimer</span>
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
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    variant={newHistoricalSessionType === "renfo" ? "default" : "outline"}
                                    onClick={() => setNewHistoricalSessionType("renfo")}
                                    size="sm"
                                    className="text-xs sm:text-sm"
                                  >
                                    Renfo
                                  </Button>
                                  <Button
                                    variant={newHistoricalSessionType === "cardio" ? "default" : "outline"}
                                    onClick={() => setNewHistoricalSessionType("cardio")}
                                    size="sm"
                                    className="text-xs sm:text-sm"
                                  >
                                    Cardio
                                  </Button>
                                  <Button
                                    variant={newHistoricalSessionType === "recup" ? "default" : "outline"}
                                    onClick={() => setNewHistoricalSessionType("recup")}
                                    size="sm"
                                    className="text-xs sm:text-sm"
                                  >
                                    Récup
                                  </Button>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <Input
                                    placeholder="Nom de la séance"
                                    value={newHistoricalSessionName}
                                    onChange={(e) => setNewHistoricalSessionName(e.target.value)}
                                    onKeyPress={(e) => e.key === "Enter" && handleAddHistoricalSession()}
                                    className="flex-1"
                                  />
                                  <Button onClick={handleAddHistoricalSession} size="sm" className="w-full sm:w-auto">
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
                              className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 cursor-pointer hover:bg-muted/50 transition-colors gap-2"
                              onClick={() => toggleHistoricalSession(session.id)}
                            >
                              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                                {expandedHistoricalSessionId === session.id ? (
                                  <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                                )}
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                  <span className="font-medium text-sm sm:text-base">{session.name}</span>
                                  {session.session_type === "renfo" && session.session_exercises?.length > 0 && (
                                    <span className="text-xs sm:text-sm text-muted-foreground">
                                      ({formatSessionDuration(calculateSessionDuration(session.session_exercises))})
                                    </span>
                                  )}
                                </div>
                                <Badge variant={session.session_type === "cardio" ? "secondary" : session.session_type === "recup" ? "outline" : "outline"} className="text-xs">
                                  {session.session_type === "cardio" ? "Cardio" : session.session_type === "recup" ? "Récup" : "Renfo"}
                                </Badge>
                                {(() => {
                                  const exercises = session.session_exercises || [];
                                  if (exercises.length === 0) return null;
                                  
                                  // Pour les sessions Récup/Mobilité, vérifier si duration_minutes est défini
                                  if (session.session_type === "recup") {
                                    if (session.duration_minutes !== null && session.duration_minutes !== undefined) {
                                      return <Badge className="bg-green-600 text-white text-xs">Terminée</Badge>;
                                    }
                                    return <Badge variant="outline" className="text-muted-foreground text-xs">Non commencée</Badge>;
                                  }
                                  
                                  // Pour les autres séances: compter les exercices avec feedback
                                  const completedCount = exercises.filter((ex: any) => 
                                    ex.sportif_rpe !== null || 
                                    ex.actual_distance_km !== null || 
                                    ex.actual_duration_minutes !== null || 
                                    ex.actual_pace_min_per_km !== null || 
                                    ex.actual_avg_heart_rate !== null
                                  ).length;
                                  const skippedCount = exercises.filter((ex: any) => 
                                    ex.skipped === true && 
                                    !ex.sportif_rpe && 
                                    !ex.actual_distance_km && 
                                    !ex.actual_duration_minutes &&
                                    !ex.actual_pace_min_per_km &&
                                    !ex.actual_avg_heart_rate
                                  ).length;
                                  const totalWithFeedback = completedCount + skippedCount;
                                  
                                  if (totalWithFeedback === 0) {
                                    return <Badge variant="outline" className="text-muted-foreground text-xs">Non commencée</Badge>;
                                  } else if (totalWithFeedback === exercises.length) {
                                    if (skippedCount > 0) {
                                      return <Badge className="bg-orange-600 text-white text-xs">Terminée ({skippedCount} non fait{skippedCount > 1 ? 's' : ''})</Badge>;
                                    }
                                    return <Badge className="bg-green-600 text-white text-xs">Terminée</Badge>;
                                  } else {
                                    return <Badge className="bg-orange-500 text-white text-xs">En cours ({totalWithFeedback}/{exercises.length})</Badge>;
                                  }
                                })()}
                              </div>
                              <div className="flex items-center gap-2 justify-end">
                                <Badge variant="outline" className="text-xs">{session.session_exercises?.length || 0} ex.</Badge>
                                {session.duration_minutes && (
                                  <Badge variant="secondary" className="text-xs">{session.duration_minutes} min</Badge>
                                )}
                                {isEditingHistorical && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteHistoricalSession(session.id);
                                    }}
                                    className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>

                            {expandedHistoricalSessionId === session.id && (
                              <div className="border-t p-3 sm:p-4 bg-muted/20">
                                {/* Info de la séance */}
                                <div className="flex flex-col sm:flex-row sm:gap-6 gap-2 mb-4 p-2 sm:p-3 bg-background rounded-md text-sm">
                                  {session.completed_at && (
                                    <div>
                                      <span className="text-xs sm:text-sm text-muted-foreground">Date: </span>
                                      <span className="font-medium text-xs sm:text-sm">
                                        {new Date(session.completed_at).toLocaleDateString()} à{" "}
                                        {new Date(session.completed_at).toLocaleTimeString()}
                                      </span>
                                    </div>
                                  )}
                                  {session.duration_minutes && (
                                    <div>
                                      <span className="text-xs sm:text-sm text-muted-foreground">Durée: </span>
                                      <span className="font-medium text-xs sm:text-sm">{session.duration_minutes} min</span>
                                    </div>
                                  )}
                                </div>

                                <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        {session.session_type === "recup" ? (
                                          <>
                                            <TableHead className="text-xs">Exercice</TableHead>
                                            <TableHead className="text-xs">Durée/Reps</TableHead>
                                            <TableHead className="text-xs">Comm.</TableHead>
                                            {isEditingHistorical && <TableHead className="w-[40px]"></TableHead>}
                                          </>
                                        ) : (
                                          <>
                                            <TableHead className="text-xs min-w-[100px]">Exercice</TableHead>
                                            <TableHead className="text-xs min-w-[60px]">Récup</TableHead>
                                            <TableHead className="text-xs min-w-[60px]">Reps</TableHead>
                                            <TableHead className="text-xs min-w-[50px]">Séries</TableHead>
                                            <TableHead className="text-xs min-w-[60px]">Charge</TableHead>
                                            <TableHead className="text-xs min-w-[50px]">RPE</TableHead>
                                            <TableHead className="text-xs min-w-[60px]">Ressenti</TableHead>
                                            <TableHead className="text-xs min-w-[60px]">Tempo</TableHead>
                                            <TableHead className="text-xs min-w-[80px]">Comm.</TableHead>
                                            <TableHead className="text-xs min-w-[80px]">Retour</TableHead>
                                            <TableHead className="text-xs min-w-[50px]">Vidéo</TableHead>
                                            {isEditingHistorical && <TableHead className="w-[40px]"></TableHead>}
                                          </>
                                        )}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {editedHistoricalExercises[session.id] &&
                                      editedHistoricalExercises[session.id].length > 0 ? (
                                        editedHistoricalExercises[session.id].map((exercise: any) => {
                                          const isCardioExercise = exercise.cardio_sport || exercise.cardio_content;
                                          const isRecupSession = session.session_type === "recup";
                                          
                                          if (isRecupSession) {
                                            // Affichage simplifié pour séances récup/mobilité
                                            return (
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
                                                      exercises={libraryExercises.filter(
                                                        (ex) => ex.category === "mobilité-souplesse" || ex.category === "massage"
                                                      )}
                                                    />
                                                  ) : (
                                                    <span className="font-medium">{exercise.exercice}</span>
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
                                                      placeholder="ex: 3x30sec"
                                                    />
                                                  ) : (
                                                    exercise.reps || "-"
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
                                                {isEditingHistorical && (
                                                  <TableCell>
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() => handleDeleteHistoricalExercise(exercise.id)}
                                                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    >
                                                      <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                  </TableCell>
                                                )}
                                              </TableRow>
                                            );
                                          }
                                          
                                          if (isCardioExercise) {
                                            // Affichage pour exercices cardio
                                            let cardioData: CardioData = { steps: [], blocks: [] };
                                            try {
                                              const parsed = exercise.cardio_content ? JSON.parse(exercise.cardio_content) : { steps: [], blocks: [] };
                                              cardioData = Array.isArray(parsed) ? { steps: parsed, blocks: [] } : parsed;
                                            } catch (e) {
                                              console.error("Error parsing cardio content:", e);
                                            }

                                            const estimatedDuration = calculateCardioSessionDuration(cardioData, athleteVma);

                                            return (
                                              <TableRow key={exercise.id}>
                                                <TableCell colSpan={isEditingHistorical ? 11 : 10}>
                                                  <div className="space-y-3 p-3 bg-muted/30 rounded-md">
                                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                                      <span className="font-medium text-lg">{exercise.exercice}</span>
                                                      {exercise.cardio_sport && (
                                                        <Badge variant="outline" className="capitalize">
                                                          {exercise.cardio_sport}
                                                        </Badge>
                                                      )}
                                                      {estimatedDuration > 0 && (
                                                        <Badge variant="secondary" className="text-xs">
                                                          Durée estimée: {formatCardioSessionDuration(estimatedDuration)}
                                                        </Badge>
                                                      )}
                                                    </div>
                                                    
                                                    {isEditingHistorical ? (
                                                      // Mode édition avec CardioStepBuilder
                                                      <>
                                                        <CardioStepBuilder
                                                          steps={cardioData.steps}
                                                          blocks={cardioData.blocks}
                                                          onChange={(newCardioData) => {
                                                            handleHistoricalExerciseChange(
                                                              session.id,
                                                              exercise.id,
                                                              "cardio_content",
                                                              JSON.stringify(newCardioData),
                                                            );
                                                          }}
                                                          athleteVma={athleteVma}
                                                          sportType={(exercise.cardio_sport === "velo" || exercise.cardio_sport === "natation" || exercise.cardio_sport === "course") ? exercise.cardio_sport : "course"}
                                                        />
                                                        
                                                        <div className="space-y-2 mt-3">
                                                          <label className="text-sm font-medium">Commentaire</label>
                                                          <Textarea
                                                            value={exercise.commentaire || ""}
                                                            onChange={(e) =>
                                                              handleHistoricalExerciseChange(
                                                                session.id,
                                                                exercise.id,
                                                                "commentaire",
                                                                e.target.value,
                                                              )
                                                            }
                                                            placeholder="Ajouter un commentaire pour cette séance..."
                                                            className="min-h-[80px]"
                                                          />
                                                        </div>
                                                      </>
                                                    ) : (
                                                      // Mode lecture seule
                                                      cardioData.steps.length > 0 ? (
                                                        <div className="space-y-3">
                                                          {/* Afficher les blocs et étapes dans l'ordre */}
                                                          <div className="space-y-2">
                                                            {(() => {
                                                              const displayedBlocks = new Set();
                                                              return cardioData.steps.map((step, stepIdx) => {
                                                                // Si le step est dans un bloc
                                                                if (step.block_id) {
                                                                  // Si on a déjà affiché ce bloc, on le saute
                                                                  if (displayedBlocks.has(step.block_id)) {
                                                                    return null;
                                                                  }
                                                                  
                                                                  // Sinon, on affiche le bloc entier
                                                                  displayedBlocks.add(step.block_id);
                                                                  const block = cardioData.blocks.find(b => b.id === step.block_id);
                                                                  if (!block) return null;
                                                                  
                                                                  const blockSteps = cardioData.steps.filter(s => s.block_id === step.block_id);
                                                                  return (
                                                                    <div key={`block-${step.block_id}`} className="p-3 bg-primary/10 rounded-md border border-primary/20">
                                                                      <div className="flex items-center gap-2 mb-2">
                                                                        <Badge className="bg-primary">Bloc répété</Badge>
                                                                        <span className="text-sm font-medium">{block.repetitions}x</span>
                                                                      </div>
                                                                      <div className="space-y-1 ml-4">
                                                                        {blockSteps.map((blockStep, blockStepIdx) => {
                                                                          const pace = calculatePace(blockStep.vma_percentage, athleteVma);
                                                                          return (
                                                                            <div key={blockStepIdx} className="flex items-center gap-3 text-sm p-1.5 bg-background/50 rounded">
                                                                              <span className="text-muted-foreground">#{blockStepIdx + 1}</span>
                                                                              <span className="capitalize">{blockStep.movement_type}</span>
                                                                              {blockStep.effort_type === "duration" && blockStep.duration && (
                                                                                <span>{formatCardioTime(blockStep.duration)}</span>
                                                                              )}
                                                                              {blockStep.effort_type === "distance" && blockStep.distance && (
                                                                                <span>{formatCardioDistance(blockStep.distance)}</span>
                                                                              )}
                                                                              {pace && (
                                                                                <span className="text-primary font-medium">{pace}</span>
                                                                              )}
                                                                              {blockStep.target_heart_rate && (
                                                                                <span className="text-orange-600">FC: {blockStep.target_heart_rate}</span>
                                                                              )}
                                                                            </div>
                                                                          );
                                                                        })}
                                                                      </div>
                                                                    </div>
                                                                  );
                                                                }
                                                                
                                                                // Sinon, c'est une étape individuelle
                                                                const pace = calculatePace(step.vma_percentage, athleteVma);
                                                                return (
                                                                  <div key={stepIdx} className="flex items-center gap-4 text-sm p-2 bg-background rounded border">
                                                                    <span className="font-medium text-muted-foreground">Étape {stepIdx + 1}:</span>
                                                                    <span className="capitalize">{step.movement_type}</span>
                                                                    {step.effort_type === "duration" && step.duration && (
                                                                      <span>{formatCardioTime(step.duration)}</span>
                                                                    )}
                                                                    {step.effort_type === "distance" && step.distance && (
                                                                      <span>{formatCardioDistance(step.distance)}</span>
                                                                    )}
                                                                    {pace && (
                                                                      <span className="text-primary font-medium">{pace}</span>
                                                                    )}
                                                                    {step.target_heart_rate && (
                                                                      <span className="text-orange-600">FC: {step.target_heart_rate}</span>
                                                                    )}
                                                                  </div>
                                                                );
                                                              });
                                                            })()}
                                                          </div>
                                                        </div>
                                                      ) : (
                                                        <p className="text-sm text-muted-foreground">Aucune donnée cardio enregistrée</p>
                                                      )
                                                     )}
                                                     
                                                     {/* Commentaire du coach pour la séance cardio */}
                                                     {exercise.commentaire && (
                                                       <div className="bg-background p-3 rounded-md border">
                                                         <span className="text-sm font-medium text-muted-foreground">Commentaire du coach: </span>
                                                         <p className="text-sm mt-1">{exercise.commentaire}</p>
                                                       </div>
                                                     )}
                                                     
                                                     <div className="space-y-2 pt-2 border-t">
                                                       {/* Afficher les données réelles en priorité */}
                                                       {(exercise.sportif_rpe || exercise.actual_distance_km || exercise.actual_duration_minutes || exercise.actual_pace_min_per_km || exercise.actual_avg_heart_rate) ? (
                                                         <>
                                                           <div className="flex gap-4 flex-wrap">
                                                             {exercise.sportif_rpe && (
                                                               <div>
                                                                 <span className="text-sm text-muted-foreground">RPE ressenti: </span>
                                                                 <span className="font-medium text-primary">{exercise.sportif_rpe}</span>
                                                               </div>
                                                             )}
                                                             {exercise.sportif_comment && (
                                                               <div>
                                                                 <span className="text-sm text-muted-foreground">Retour: </span>
                                                                 <span className="text-sm">{exercise.sportif_comment}</span>
                                                               </div>
                                                             )}
                                                           </div>
                                                           
                                                           {/* Données réelles saisies par le sportif */}
                                                           {(exercise.actual_distance_km || exercise.actual_duration_minutes || exercise.actual_pace_min_per_km || exercise.actual_avg_heart_rate) && (
                                                             <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-md border border-green-200 dark:border-green-800">
                                                               <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">Données réelles de la séance</div>
                                                                <div className="flex gap-4 flex-wrap text-sm">
                                                                  {exercise.actual_distance_km && (
                                                                    <div>
                                                                      <span className="text-muted-foreground">Distance: </span>
                                                                      <span className="font-medium text-green-900 dark:text-green-100">{exercise.actual_distance_km} km</span>
                                                                    </div>
                                                                  )}
                                                                  {exercise.actual_duration_minutes && (
                                                                    <div>
                                                                      <span className="text-muted-foreground">Durée: </span>
                                                                      <span className="font-medium text-green-900 dark:text-green-100">{exercise.actual_duration_minutes} min</span>
                                                                    </div>
                                                                  )}
                                                                  {exercise.actual_pace_min_per_km && (
                                                                    <div>
                                                                      <span className="text-muted-foreground">Allure: </span>
                                                                      <span className="font-medium text-green-900 dark:text-green-100">{formatPaceFromDecimal(parsePaceToDecimal(exercise.actual_pace_min_per_km)) || exercise.actual_pace_min_per_km}</span>
                                                                    </div>
                                                                  )}
                                                                  {exercise.actual_avg_heart_rate && (
                                                                    <div>
                                                                      <span className="text-muted-foreground">FC moy: </span>
                                                                      <span className="font-medium text-green-900 dark:text-green-100">{exercise.actual_avg_heart_rate} bpm</span>
                                                                    </div>
                                                                  )}
                                                                </div>
                                                             </div>
                                                           )}
                                                         </>
                                                       ) : exercise.skipped ? (
                                                         <div className="flex items-center gap-2">
                                                           <Badge variant="outline" className="text-orange-600 border-orange-600">
                                                             Exercice non fait
                                                           </Badge>
                                                         </div>
                                                       ) : null}
                                                     </div>
                                                  </div>
                                                </TableCell>
                                              </TableRow>
                                            );
                                          }

                                          // Affichage standard pour exercices renfo
                                          return (
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
                                                              <div className="space-y-2">
                                                                {isEditingHistorical ? (
                                                                  <>
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
                                                                      placeholder={exercise.is_duration ? "ex: 20 (sec)" : "ex: 10"}
                                                                    />
                                                                    <div className="flex items-center space-x-2">
                                                                      <Checkbox
                                                                        id={`historical-is-duration-${session.id}-${exercise.id}`}
                                                                        checked={exercise.is_duration || false}
                                                                        onCheckedChange={(checked) =>
                                                                          handleHistoricalExerciseChange(
                                                                            session.id,
                                                                            exercise.id,
                                                                            "is_duration",
                                                                            checked as boolean
                                                                          )
                                                                        }
                                                                      />
                                                                      <label
                                                                        htmlFor={`historical-is-duration-${session.id}-${exercise.id}`}
                                                                        className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 cursor-pointer"
                                                                      >
                                                                        durée (sec)
                                                                      </label>
                                                                    </div>
                                                                    {exercise.is_unilateral && (
                                                                      <div className="flex items-center space-x-2">
                                                                        <Checkbox
                                                                          id={`historical-per-side-${session.id}-${exercise.id}`}
                                                                          checked={exercise.per_side || false}
                                                                          onCheckedChange={(checked) =>
                                                                            handleHistoricalExerciseChange(
                                                                              session.id,
                                                                              exercise.id,
                                                                              "per_side",
                                                                              checked as boolean
                                                                            )
                                                                          }
                                                                        />
                                                                        <label
                                                                          htmlFor={`historical-per-side-${session.id}-${exercise.id}`}
                                                                          className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 cursor-pointer"
                                                                        >
                                                                          par côté
                                                                        </label>
                                                                      </div>
                                                                    )}
                                                                  </>
                                                                ) : (
                                                                  <div className="space-y-1">
                                                                    <div>{exercise.reps || "-"}{exercise.is_duration ? "s" : ""}</div>
                                                                    {exercise.is_duration && (
                                                                      <Badge variant="secondary" className="text-xs">
                                                                        durée
                                                                      </Badge>
                                                                    )}
                                                                    {exercise.per_side && (
                                                                      <Badge variant="secondary" className="text-xs">
                                                                        par côté
                                                                      </Badge>
                                                                    )}
                                                                  </div>
                                                                )}
                                                              </div>
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
                                                  {exercise.skipped ? (
                                                    <Badge variant="outline" className="text-orange-600 border-orange-600">
                                                      Non fait
                                                    </Badge>
                                                  ) : (
                                                    <>
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
                                                    </>
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
                                              <TableCell>
                                                {isEditingHistorical ? (
                                                  <div className="flex items-center justify-center">
                                                    <Checkbox
                                                      id={`historical-request-video-${session.id}-${exercise.id}`}
                                                      checked={exercise.request_video || false}
                                                      onCheckedChange={(checked) =>
                                                        handleHistoricalExerciseChange(
                                                          session.id,
                                                          exercise.id,
                                                          "request_video",
                                                          checked as boolean
                                                        )
                                                      }
                                                    />
                                                  </div>
                                                ) : (
                                                  exercise.request_video ? (
                                                    <Video className="h-4 w-4 text-primary" />
                                                  ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                  )
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
                                          );
                                        })
                                      ) : (
                                        <TableRow>
                                          <TableCell
                                            colSpan={isEditingHistorical ? 12 : 11}
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

                        {/* Séances perso */}
                        {customSessions.filter(cs => {
                          const sessionDate = new Date(cs.completed_at);
                          const weekStart = new Date(selectedHistoricalWeek.year, 0, 1 + (selectedHistoricalWeek.week_number - 1) * 7);
                          const weekEnd = new Date(weekStart);
                          weekEnd.setDate(weekStart.getDate() + 6);
                          return sessionDate >= weekStart && sessionDate <= weekEnd;
                        }).length > 0 && (
                          <div className="mt-6">
                            <h4 className="font-semibold mb-3 text-lg">Séances perso</h4>
                            <div className="space-y-3">
                              {customSessions
                                .filter(cs => {
                                  const sessionDate = new Date(cs.completed_at);
                                  const weekStart = new Date(selectedHistoricalWeek.year, 0, 1 + (selectedHistoricalWeek.week_number - 1) * 7);
                                  const weekEnd = new Date(weekStart);
                                  weekEnd.setDate(weekStart.getDate() + 6);
                                  return sessionDate >= weekStart && sessionDate <= weekEnd;
                                })
                                .map((customSession) => (
                                  <Card key={customSession.id} className="border-primary/30 bg-primary/5">
                                    <CardContent className="p-4">
                                      <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            <h5 className="font-semibold">{customSession.session_name}</h5>
                                            <Badge variant="secondary">Perso</Badge>
                                          </div>
                                          <p className="text-sm text-muted-foreground">
                                            Durée: {customSession.duration_minutes} min
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {new Date(customSession.completed_at).toLocaleDateString('fr-FR', {
                                              weekday: 'long',
                                              year: 'numeric',
                                              month: 'long',
                                              day: 'numeric',
                                            })}
                                          </p>
                                        </div>
                                      </div>
                                      {customSession.description && (
                                        <p className="text-sm mt-2 text-foreground/80 italic border-l-2 border-primary/30 pl-3">
                                          {customSession.description}
                                        </p>
                                      )}
                                    </CardContent>
                                  </Card>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paiements" className="space-y-4">
          <CoachSubscriptionManager
            athleteId={athleteId!}
            athleteName={`${athlete?.first_name || ""} ${athlete?.last_name || ""}`}
            paymentEnabled={athlete?.payment_enabled || false}
            onPaymentEnabledChange={handleTogglePaymentEnabled}
          />
        </TabsContent>
      </Tabs>

      {/* Dialog pour copier une semaine */}
      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Copier une semaine précédente</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Sélectionnez une semaine à copier. Vous pourrez modifier les exercices avant validation.
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

      {/* Dialog de confirmation de suppression de semaine */}
      <Dialog open={showDeleteWeekDialog} onOpenChange={setShowDeleteWeekDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer toute cette semaine d'entraînement ? Cette action est irréversible et supprimera toutes les séances et exercices associés.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteWeekDialog(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDeleteWeek}>
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
