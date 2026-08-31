import React, { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { parsePaceToDecimal, formatPaceFromDecimal } from "@/lib/cardioCalculations";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
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
  Undo2,
  Search,
  Video,
  CreditCard,
  Footprints,
  BookOpen,
  Bot,
  Gauge,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ExerciseCombobox } from "@/components/ExerciseCombobox";
import { getWeekNumber, getNextWeeks, getWeeksRange, formatWeekRange, getWeekYear } from "@/lib/weekUtils";
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
import { VmaCard } from "@/components/VmaCard";
import { RaceTimeEstimatesCard } from "@/components/RaceTimeEstimatesCard";
import { AerobicEfficiencyCard } from "@/components/AerobicEfficiencyCard";
import { PerformanceTestsCard } from "@/components/PerformanceTestsCard";
import { CoachFatigueView } from "@/components/CoachFatigueView";
import { CoachFatigueAlert } from "@/components/CoachFatigueAlert";
import { CoachSfmsAlert } from "@/components/CoachSfmsAlert";
import { CoachFcReminderAlert } from "@/components/CoachFcReminderAlert";
import { CoachWeightView } from "@/components/CoachWeightView";
import { CoachRunningView } from "@/components/CoachRunningView";
import { CoachCyclingView } from "@/components/CoachCyclingView";
import { CoachSwimmingView } from "@/components/CoachSwimmingView";
import { CoachStrengthView } from "@/components/CoachStrengthView";
import { CoachTriathlonView } from "@/components/CoachTriathlonView";
import { CoachExerciseProgressPanel } from "@/components/CoachExerciseProgressPanel";
import { CoachObjectivesView, getPhase, CARDIO_SPORT_VALUES } from "@/components/CoachObjectivesView";
import { CycleSetupGate } from "@/components/CycleSetupGate";
import { ProgObjectiveBanner } from "@/components/ProgObjectiveBanner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CoachSubscriptionManager } from "@/components/CoachSubscriptionManager";
import { CoachAthleteSubscriptionOverview } from "@/components/CoachAthleteSubscriptionOverview";
import { CoachClientSummaryView } from "@/components/CoachClientSummaryView";
import { WeeklyHRZonesCard } from "@/components/WeeklyHRZonesCard";
import { DailyDebriefCard } from "@/components/DailyDebriefCard";
import { AthleteProfileTab } from "@/components/AthleteProfileTab";
import { WeekAvailabilityCard } from "@/components/WeekAvailabilityCard";
import { PlannedCardioZonesCard } from "@/components/PlannedCardioZonesCard";
import { CoachAthleteMethodologies } from "@/components/CoachAthleteMethodologies";
import { VoiceCommandButton } from "@/components/VoiceCommandButton";
import type { VoiceChanges } from "@/lib/parseVoiceCommand";
import { MobileProgView } from "@/components/MobileProgView";
import { DesktopProgView } from "@/components/DesktopProgView";
import { CoachCardioAIChat, type AIChatContext } from "@/components/CoachCardioAIChat";
import { CustomSessionDialog } from "@/components/CustomSessionDialog";
import { CustomSessionDetailDialog } from "@/components/CustomSessionDetailDialog";

import { calculate1RM } from "@/lib/maxCalculations";
import { calculateSessionDuration, formatSessionDuration } from "@/lib/sessionDurationCalculator";
import { CardioStepBuilder, CardioStep, CardioData, CardioBlock } from "@/components/CardioStepBuilder";
import { formatCardioTime, formatCardioDistance, calculatePace, calculateCardioSessionDuration, formatCardioSessionDuration, calculateCardioMetrics, formatCardioStepsForAI } from "@/lib/cardioCalculations";
import { getISOWeek, subDays, format, startOfDay, endOfDay } from "date-fns";
import { HeartRateZonesBar } from "@/components/HeartRateZonesBar";

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
  coach_note?: string | null; // note privée coach (invisible au sportif)
}

interface SerieDetail {
  reps: string;
  charge: string;
  rpe: string;
  tempo: string;
  commentaire: string;
  recuperation?: string;
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
  is_distance?: boolean;
  request_video?: boolean;
  request_activity_link?: boolean;
  serie_details?: SerieDetail[];
  coach_note?: string | null; // note privée coach (invisible au sportif)
}

/**
 * Returns serie_details as an array, even when the value comes from the DB
 * as a JSON string (e.g. right after a week-copy). Always returns an array,
 * never null/undefined, so callers can safely use .map / .length.
 */
/** Construit la map { exerciceId: true } pour replier toutes les séries individuelles (length > 1). */
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function buildCollapsedSeriesMap(exercises: Record<number, Exercise[]>): Record<string, boolean> {
  const collapsed: Record<string, boolean> = {};
  Object.values(exercises).forEach((exList) => {
    exList.forEach((ex) => {
      if (getSerieDetailsArray(ex.serie_details).length > 1) collapsed[ex.id] = true;
    });
  });
  return collapsed;
}

function getSerieDetailsArray(value: any): SerieDetail[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// ── Brouillon de programmation (persiste les modifs non validées, synchronisé
// entre appareils via Supabase) ──
async function loadProgDraft(athleteId: string, week: number, year: number): Promise<{ sessions: Session[]; sessionExercises: Record<number, Exercise[]> } | null> {
  try {
    const { data } = await supabase
      .from("programming_drafts")
      .select("content")
      .eq("athlete_id", athleteId)
      .eq("week_number", week)
      .eq("year", year)
      .maybeSingle();
    const content = (data as any)?.content;
    if (!content || !Array.isArray(content.sessions)) return null;
    return content;
  } catch {
    return null;
  }
}

async function saveProgDraft(athleteId: string, week: number, year: number, sessions: Session[], sessionExercises: Record<number, Exercise[]>) {
  try {
    await supabase.from("programming_drafts").upsert({
      athlete_id: athleteId,
      week_number: week,
      year,
      content: { sessions, sessionExercises } as any,
      updated_at: new Date().toISOString(),
    } as any, { onConflict: "coach_id,athlete_id,week_number,year" });
  } catch {}
}

async function clearProgDraft(athleteId: string, week: number, year: number) {
  try {
    await supabase.from("programming_drafts").delete()
      .eq("athlete_id", athleteId).eq("week_number", week).eq("year", year);
  } catch {}
}

export default function ClientDetail() {
  const { athleteId } = useParams();
  const navigate = useNavigate();
  const [athlete, setAthlete] = useState<AthleteProfile | null>(null);
  const [athleteVma, setAthleteVma] = useState<number | null>(null);
  const [athleteFtp, setAthleteFtp] = useState<number | null>(null);
  const [allowAddExercises, setAllowAddExercises] = useState(false);
  const [athleteFcMax, setAthleteFcMax] = useState<number | null>(null);
  const [athleteFcRepos, setAthleteFcRepos] = useState<number | null>(null);
  const [currentInjury, setCurrentInjury] = useState<{ level: number; location: string } | null>(null);
  const [recentPerfTests, setRecentPerfTests] = useState<Array<{ test_type: string; test_date: string; raw_value: number | null; vma_estimated: number | null; notes: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null);
  const [isValidated, setIsValidated] = useState(false);
  const [sessionExercises, setSessionExercises] = useState<Record<number, Exercise[]>>({});
  const [undoStack, setUndoStack] = useState<Array<{ sessions: Session[]; sessionExercises: Record<number, Exercise[]> }>>([]);
  const [libraryExercises, setLibraryExercises] = useState<Array<{ id: string; name: string; muscle_principal?: string | null; muscles_second?: string[] | null; unilateral?: boolean; category?: string }>>([]);
  const [historicalWeeks, setHistoricalWeeks] = useState<any[]>([]);
  const [allTrainingWeeks, setAllTrainingWeeks] = useState<any[]>([]); // all weeks (validated or not)
  const [selectedHistoricalWeek, setSelectedHistoricalWeek] = useState<any>(null);
  const [historicalSessions, setHistoricalSessions] = useState<any[]>([]);
  const [customSessions, setCustomSessions] = useState<any[]>([]);
  const [coachCustomSessions, setCoachCustomSessions] = useState<any[]>([]);
  const [editingCoachCustomSession, setEditingCoachCustomSession] = useState<any>(null);
  const [viewingCoachCustomSession, setViewingCoachCustomSession] = useState<any>(null);
  const [isLoadingWeek, setIsLoadingWeek] = useState(false);
  // Empêche la sauvegarde du brouillon pendant le chargement initial d'une semaine
  const suppressDraftSaveRef = useRef(true);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expandedHistoricalSessionId, setExpandedHistoricalSessionId] = useState<string | null>(null);
  const [isEditingHistorical, setIsEditingHistorical] = useState(false);
  const [editedHistoricalExercises, setEditedHistoricalExercises] = useState<Record<string, any[]>>({});
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  // Presse-papier de séance (copier une séance et la coller chez un autre athlète)
  const [clipboardSession, setClipboardSession] = useState<{ name: string; session_type: Session["session_type"]; exercises: Exercise[] } | null>(() => {
    try { const raw = localStorage.getItem("cdo_session_clipboard"); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const [selectedWeekToCopy, setSelectedWeekToCopy] = useState<string>("");
  const [weekToCopyData, setWeekToCopyData] = useState<any>(null);
  const [copiedWeekFeedback, setCopiedWeekFeedback] = useState<Record<string, { 
    sportif_rpe?: string | null; 
    sportif_comment?: string | null; 
    skipped?: boolean;
    serie_rpe_details?: { rpe: number | null; actual_reps?: string | null; actual_charge?: string | null }[] | null;
  }>>({});
  const [showFeedbackSheet, setShowFeedbackSheet] = useState(false);
  const [collapsedSeriesExercises, setCollapsedSeriesExercises] = useState<Record<string, boolean>>({});
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
  const [athleteMesocycles, setAthleteMesocycles] = useState<Array<{ id: string; name: string; start_date: string; end_date: string; color: string; description?: string; phase_type?: string; volume_target?: number; intensity_target?: number; objective?: string; coach_note?: string }>>([]);
  const [athleteMacrocycles, setAthleteMacrocycles] = useState<Array<{ id: string; name: string; start_date: string; end_date: string; color: string; description?: string; phase_type?: string; sport?: string; volume_target?: number; intensity_target?: number; objective?: string; coach_note?: string }>>([]);
  const [athleteMicrocycles, setAthleteMicrocycles] = useState<Array<{ id: string; name: string; start_date: string; end_date: string; color: string; description?: string; phase_type?: string; volume_target?: number; intensity_target?: number; objective?: string; coach_note?: string }>>([]);
  // Fermeture temporaire du gate de cycles (non persistée : réapparaît au rechargement de la page)
  const [cycleGateDismissed, setCycleGateDismissed] = useState(false);
  const [hasMainObjective, setHasMainObjective] = useState<boolean | null>(null);
  const [mainObjectiveName, setMainObjectiveName] = useState<string | null>(null);
  const [mainObjectiveDeadline, setMainObjectiveDeadline] = useState<string | null>(null);
  const [deleteCycleConfirm, setDeleteCycleConfirm] = useState<{ table: "mesocycles" | "microcycles"; id: string; name: string } | null>(null);
  const [isDeletingCycle, setIsDeletingCycle] = useState(false);
  const [showObjectivesSheet, setShowObjectivesSheet] = useState(false);
  const [showExerciseProgressSheet, setShowExerciseProgressSheet] = useState(false);
  const [showRunningSheet, setShowRunningSheet] = useState(false);
  const [showNotesSheet, setShowNotesSheet] = useState(false);
  const [showCardioAIChat, setShowCardioAIChat] = useState(false);
  const [recentCardioHistory, setRecentCardioHistory] = useState<import("@/components/CoachCardioAIChat").AIChatWeekHistory[]>([]);
  const [athleteNotes, setAthleteNotes] = useState<Array<{ id: string; content: string; created_at: string }>>([]);
  const [dismissedNoteId, setDismissedNoteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("resume");
  const [chargeSuggestions, setChargeSuggestions] = useState<{ [sessionId: string]: { [exerciseId: string]: string } }>({});
  const [serieChargeSuggestions, setSerieChargeSuggestions] = useState<{ [key: string]: string }>({});
  const [athleteMaxes, setAthleteMaxes] = useState<Record<string, number>>({});
  const [draggedSessionId, setDraggedSessionId] = useState<number | null>(null);
  const [draggedExerciseId, setDraggedExerciseId] = useState<number | null>(null);
  const [draggedSessionForExercise, setDraggedSessionForExercise] = useState<number | null>(null);
  const [headerMonotony, setHeaderMonotony] = useState<number | null>(null);
  const [headerInjury, setHeaderInjury] = useState<{ avgPain: number; location: string } | null>(null);
  const [selectedEffortType, setSelectedEffortType] = useState<"renfo" | "course" | "velo" | "natation" | "triathlon" | "physio">("course");
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

  // Methodology assignment
  const [showMethodologyDialog, setShowMethodologyDialog] = useState(false);
  const [availableMethodologies, setAvailableMethodologies] = useState<any[]>([]);
  const [selectedMethodologyId, setSelectedMethodologyId] = useState<string>("");
  const [selectedMethodologyWeek, setSelectedMethodologyWeek] = useState<number>(1);
  const [selectedMethodologyCycle, setSelectedMethodologyCycle] = useState<number>(0);
  const [loadingMethodologies, setLoadingMethodologies] = useState(false);
  const [methodologyStep, setMethodologyStep] = useState<"select" | "maxes">("select");
  const [methodologyMaxes, setMethodologyMaxes] = useState<Record<string, { name: string; max: string; athleteMax?: number | null }>>({});
  const [activeAssignmentForMethodology, setActiveAssignmentForMethodology] = useState<any>(null);
  const [persistentActiveAssignment, setPersistentActiveAssignment] = useState<any>(null);
  const [persistentMethodology, setPersistentMethodology] = useState<any>(null);
  const [persistentMaxes, setPersistentMaxes] = useState<Record<string, { exercise_name: string; reference_max: number }>>({});
  const [showCopyAdaptDialog, setShowCopyAdaptDialog] = useState(false);
  const [pendingCopyData, setPendingCopyData] = useState<any>(null);

  const currentWeekNumber = getWeekNumber(new Date());

  // Build available weeks: all weeks from earliest known training week (or 52 past) up to 12 future
  const availableWeeks = useMemo(() => {
    const baseRange = getWeeksRange(52, 12);
    if (allTrainingWeeks.length === 0) return baseRange;

    // Find the earliest week in the DB
    const earliestDbYear = Math.min(...allTrainingWeeks.map((w: any) => w.year));
    const earliestDbWeek = Math.min(
      ...allTrainingWeeks.filter((w: any) => w.year === earliestDbYear).map((w: any) => w.week_number)
    );

    // Check if baseRange already covers it
    const firstInBase = baseRange[0];
    if (
      earliestDbYear > firstInBase.year ||
      (earliestDbYear === firstInBase.year && earliestDbWeek >= firstInBase.week)
    ) {
      return baseRange;
    }

    // Calculate how many more past weeks we need
    const today = new Date();
    const currentWeek = getWeekNumber(today);
    const currentYear = getWeekYear(today);

    // Approximate weeks difference (conservative)
    const yearDiff = currentYear - earliestDbYear;
    const weekDiff = currentWeek - earliestDbWeek;
    const totalPastWeeks = yearDiff * 52 + weekDiff + 4; // +4 buffer

    return getWeeksRange(Math.max(52, totalPastWeeks), 12);
  }, [allTrainingWeeks]);

  // Compute which methodology cycle week the selected programming week corresponds to
  const getMethodologyCycleInfo = () => {
    if (!persistentActiveAssignment || !persistentMethodology) return null;
    const assignment = persistentActiveAssignment;
    const meth = persistentMethodology;
    const weeksPerCycle = meth.weeks_per_cycle || 1;
    const numCycles = meth.num_cycles || 1;
    const totalWeeks = weeksPerCycle * numCycles;

    // Calculate week offset from start_date to the Monday of selectedWeekToProgram
    const startDate = new Date(assignment.start_date);
    // Get Monday of the selected programming week
    const jan1 = new Date(selectedWeekToProgram.year, 0, 1);
    const days = (selectedWeekToProgram.week - 1) * 7;
    const dayOfWeek = jan1.getDay() || 7; // Mon=1..Sun=7
    const mondayOfWeek = new Date(jan1.getTime() + (days - (dayOfWeek - 1)) * 86400000);
    
    const diffMs = mondayOfWeek.getTime() - startDate.getTime();
    const diffWeeks = Math.floor(diffMs / (7 * 86400000));
    
    if (diffWeeks < 0 || diffWeeks >= totalWeeks) return null;
    
    const cycleNum = Math.floor(diffWeeks / weeksPerCycle) + 1;
    const weekInCycle = (diffWeeks % weeksPerCycle) + 1;
    
    return { cycleNum, weekInCycle, weeksPerCycle, numCycles, totalWeeks, methodologyName: meth.name, weekIndex: diffWeeks };
  };

  const cycleInfo = getMethodologyCycleInfo();

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

  // Load all athlete maxes for % suggestions
  const loadAthleteMaxes = async () => {
    if (!athleteId) return;
    const { data } = await supabase
      .from("exercise_maxes")
      .select("exercise_id, weight_kg, exercise_library(name)")
      .eq("athlete_id", athleteId)
      .order("recorded_at", { ascending: false });
    if (data) {
      const maxMap: Record<string, number> = {};
      data.forEach((m: any) => {
        const name = m.exercise_library?.name;
        if (name && !maxMap[name]) maxMap[name] = m.weight_kg;
      });
      setAthleteMaxes(maxMap);
    }
  };

  // Helper: extract % from charge and compute kg from 1RM
  // Accepts "70%", "70 %", or plain "70" (treated as 70% if ≤100)
  const getPercentSuggestion = (charge: string, exerciseName: string): string | null => {
    if (!charge) return null;
    let pct: number | null = null;
    const matchPercent = charge.match(/(\d+\.?\d*)\s*%/);
    if (matchPercent) {
      pct = parseFloat(matchPercent[1]);
    } else {
      // Plain number ≤ 100 → treat as percentage
      const trimmed = charge.trim();
      if (/^\d+\.?\d*$/.test(trimmed)) {
        const val = parseFloat(trimmed);
        if (val > 0 && val <= 100) pct = val;
      }
    }
    if (pct === null || isNaN(pct) || pct <= 0) return null;
    const max1RM = athleteMaxes[exerciseName];
    if (!max1RM) return null;
    const suggested = Math.round((max1RM * pct / 100) * 2) / 2;
    return `≈${suggested}kg`;
  };

  // Load active assignment persistently for cycle indicator
  const loadPersistentActiveAssignment = async () => {
    if (!athleteId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: assignments } = await supabase
      .from("athlete_methodology_assignments")
      .select("*")
      .eq("athlete_id", athleteId)
      .eq("coach_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);
    
    if (assignments && assignments.length > 0) {
      setPersistentActiveAssignment(assignments[0]);
      // Load the methodology details
      const { data: meth } = await supabase
        .from("coaching_methodologies")
        .select("id, name, num_cycles, weeks_per_cycle, sessions_options, session_exercise_configs")
        .eq("id", assignments[0].methodology_id)
        .single();
      if (meth) {
        setPersistentMethodology(meth);
        // Load reference maxes for this assignment
        const { data: maxesData } = await supabase
          .from("athlete_methodology_maxes")
          .select("exercise_id, exercise_name, reference_max")
          .eq("assignment_id", assignments[0].id);
        const maxesObj: Record<string, { exercise_name: string; reference_max: number }> = {};
        (maxesData || []).forEach((m: any) => { maxesObj[m.exercise_id] = { exercise_name: m.exercise_name, reference_max: m.reference_max }; });
        setPersistentMaxes(maxesObj);
        // Update localStorage cache
        try {
          localStorage.setItem(`coach-active-methodology-${athleteId}`, JSON.stringify({
            assignment: assignments[0],
            methodology: meth,
            maxes: maxesObj,
          }));
        } catch (e) { /* ignore */ }
      }
    } else {
      // Fallback to localStorage if DB returns nothing
      try {
        const cached = localStorage.getItem(`coach-active-methodology-${athleteId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.assignment && parsed.methodology && parsed.assignment.status === "active") {
            setPersistentActiveAssignment(parsed.assignment);
            setPersistentMethodology(parsed.methodology);
            if (parsed.maxes) setPersistentMaxes(parsed.maxes);
            return;
          }
        }
      } catch (e) { /* ignore */ }
      setPersistentActiveAssignment(null);
      setPersistentMethodology(null);
    }
  };

  useEffect(() => {
    loadAthleteData();
    loadLibraryExercises();
    loadHistoricalWeeks();
    loadAllTrainingWeeks();
    loadAthleteMaxes();
    loadCustomSessions();
    loadCoachCustomSessions();
    loadLastWeekFeedback();
    loadAthleteObjectives();
    loadHeaderMonotony();
    loadHeaderInjury();
    loadSessionTemplates();
    loadPersistentActiveAssignment();
    loadInjuryAndPerfTests();
    loadAthleteNotes();
    setDismissedNoteId(athleteId ? localStorage.getItem(`notes_card_dismissed_${athleteId}`) : null);
  }, [athleteId]);

  // When selected week changes, load its data from DB
  useEffect(() => {
    if (!athleteId || !selectedWeekToProgram) return;
    loadWeekFromDB(selectedWeekToProgram.week, selectedWeekToProgram.year);
  }, [selectedWeekToProgram.week, selectedWeekToProgram.year, athleteId]);

  // Sauvegarde automatique du brouillon (modifs non validées) pour pouvoir
  // quitter la page et revenir sans rien perdre.
  useEffect(() => {
    if (suppressDraftSaveRef.current) return;
    if (!athleteId || isValidated || isLoadingWeek) return;
    // Débounce : évite d'écrire à chaque frappe
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    const week = selectedWeekToProgram.week, year = selectedWeekToProgram.year;
    draftSaveTimerRef.current = setTimeout(() => {
      saveProgDraft(athleteId, week, year, sessions, sessionExercises);
    }, 800);
  }, [sessions, sessionExercises, athleteId, selectedWeekToProgram.week, selectedWeekToProgram.year, isValidated, isLoadingWeek]);

  // Note: sessions are now loaded from DB on week change; localStorage save is disabled

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
    const { data, error } = await supabase.from("exercise_library").select("id, name, muscle_principal, muscles_second, unilateral, category, video_url, equipment, load_coefficient").order("name");

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

  const loadAllTrainingWeeks = async () => {
    if (!athleteId) return;

    const { data, error } = await supabase
      .from("training_weeks")
      .select("id, week_number, year, validated, validated_at, created_at")
      .eq("athlete_id", athleteId)
      .order("year", { ascending: false })
      .order("week_number", { ascending: false });

    if (error) {
      console.error("Erreur lors du chargement des semaines:", error);
      return;
    }

    // Deduplicate: keep only the latest entry per (week_number, year)
    const seen = new Set<string>();
    const unique = (data || []).filter((w: any) => {
      const key = `${w.year}-${w.week_number}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setAllTrainingWeeks(unique);
  };

  // Load the last 8 weeks of cardio data for AI context
  const loadRecentCardioHistory = async () => {
    if (!athleteId) return;
    try {
      // ── 1. Get last 5 unique training weeks ─────────────────────────────
      const { data: weeksData, error: weeksError } = await supabase
        .from("training_weeks")
        .select("id, week_number, year")
        .eq("athlete_id", athleteId)
        .order("year", { ascending: false })
        .order("week_number", { ascending: false })
        .limit(12); // fetch more to deduplicate then slice

      if (weeksError || !weeksData) return;

      const seen = new Set<string>();
      const uniqueWeeks = weeksData.filter((w: any) => {
        const key = `${w.year}-${w.week_number}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 5); // only last 5 weeks

      if (uniqueWeeks.length === 0) return;

      const weekIds = uniqueWeeks.map((w: any) => w.id);

      // ── 2. Load cardio + recup sessions with real performance data ───────
      const { data: sessionsData, error: sessionsError } = await supabase
        .from("training_sessions")
        .select(`
          id, week_id, session_type, name, session_rpe, completed_at,
          session_exercises (
            cardio_content, cardio_sport,
            actual_distance_km, actual_duration_minutes,
            actual_pace_min_per_km, actual_avg_heart_rate,
            actual_max_heart_rate, actual_cadence,
            actual_elevation_gain, actual_calories,
            actual_heart_rate_zones,
            sportif_rpe
          )
        `)
        .in("week_id", weekIds)
        .in("session_type", ["cardio", "recup"]);

      if (sessionsError) return;

      // ── 3. Compute date range to fetch custom sessions ───────────────────
      const getWeekMonday = (weekNum: number, year: number): Date => {
        const jan4 = new Date(year, 0, 4);
        const dow = jan4.getDay() || 7;
        const monday = new Date(jan4);
        monday.setDate(jan4.getDate() - dow + 1 + (weekNum - 1) * 7);
        monday.setHours(0, 0, 0, 0);
        return monday;
      };
      const getWeekSunday = (weekNum: number, year: number): Date => {
        const s = new Date(getWeekMonday(weekNum, year));
        s.setDate(s.getDate() + 6);
        s.setHours(23, 59, 59, 999);
        return s;
      };

      const oldestWeek = uniqueWeeks[uniqueWeeks.length - 1];
      const newestWeek  = uniqueWeeks[0];
      const rangeStart  = getWeekMonday(oldestWeek.week_number, oldestWeek.year).toISOString();
      const rangeEnd    = getWeekSunday(newestWeek.week_number, newestWeek.year).toISOString();

      const { data: customData } = await (supabase.from("custom_sessions") as any)
        .select("session_name, cardio_type, duration_minutes, distance_km, avg_pace, avg_heart_rate, completed_at, scheduled_date")
        .eq("user_id", athleteId)
        .not("completed_at", "is", null)
        .gte("completed_at", rangeStart)
        .lte("completed_at", rangeEnd);

      // ── 4. Build per-week buckets ────────────────────────────────────────
      type WeekBucket = {
        weekNumber: number; year: number;
        totalKm: number; totalMinutes: number;
        intensities: number[]; sessionCount: number;
        sessions: import("@/components/CoachCardioAIChat").AIChatSessionDetail[];
      };
      const weekMap: Record<string, WeekBucket> = {};
      for (const w of uniqueWeeks) {
        weekMap[w.id] = { weekNumber: w.week_number, year: w.year, totalKm: 0, totalMinutes: 0, intensities: [], sessionCount: 0, sessions: [] };
      }

      // ── 5. Process coach sessions ────────────────────────────────────────
      for (const session of sessionsData || []) {
        const bucket = weekMap[session.week_id];
        if (!bucket) continue;
        bucket.sessionCount++;

        const exs = (session.session_exercises || []) as any[];
        let plannedKm = 0, plannedMinutes = 0;
        let plannedContentParts: string[] = [];
        let actualKm = 0, actualMinutes = 0;
        let rpe: number | undefined;
        let sport: string | undefined;
        let avgHr: number | undefined;
        let avgPace: string | undefined;

        for (const ex of exs) {
          // Planned data from cardio_content
          if (ex.cardio_content) {
            try {
              const parsed = JSON.parse(ex.cardio_content);
              const cdata = Array.isArray(parsed) ? { steps: parsed, blocks: [] } : parsed;
              const m = calculateCardioMetrics(cdata, athleteVma);
              plannedKm      += m.totalDistanceKm;
              plannedMinutes += m.totalDurationMinutes;
              if (m.averageIntensity) bucket.intensities.push(m.averageIntensity);
              // Format step-by-step content for the AI
              const stepsText = formatCardioStepsForAI(cdata, athleteVma);
              if (stepsText) plannedContentParts.push(stepsText);
            } catch { /* ignore */ }
          }
          // Real (actual) data
          if (ex.actual_distance_km)    actualKm      += ex.actual_distance_km;
          if (ex.actual_duration_minutes) actualMinutes += ex.actual_duration_minutes;
          if (ex.sportif_rpe != null && !rpe)         rpe     = ex.sportif_rpe;
          if (ex.cardio_sport && !sport)              sport   = ex.cardio_sport;
          if (ex.actual_avg_heart_rate && !avgHr)     avgHr   = ex.actual_avg_heart_rate;
          if (ex.actual_pace_min_per_km && !avgPace)  avgPace = ex.actual_pace_min_per_km;
        }

        const completed = !!session.completed_at || exs.some((ex: any) => ex.sportif_rpe != null);
        // Use actual if available, else planned
        const effectiveKm  = actualKm > 0  ? actualKm  : plannedKm;
        const effectiveMin = actualMinutes > 0 ? actualMinutes : plannedMinutes;

        bucket.totalKm      += effectiveKm;
        bucket.totalMinutes += effectiveMin;

        bucket.sessions.push({
          name:            session.name,
          sport,
          source:          "coach",
          plannedKm:       plannedKm > 0         ? Math.round(plannedKm * 10) / 10    : undefined,
          plannedMinutes:  plannedMinutes > 0     ? Math.round(plannedMinutes)          : undefined,
          plannedContent:  plannedContentParts.length > 0 ? plannedContentParts.join("\n") : undefined,
          actualKm:        actualKm > 0           ? Math.round(actualKm * 10) / 10     : undefined,
          actualMinutes:   actualMinutes > 0      ? Math.round(actualMinutes)           : undefined,
          actualPaceMinkm: avgPace || undefined,
          actualAvgHr:     avgHr || undefined,
          rpe:             rpe ?? (session.session_rpe || undefined),
          completed,
        });
      }

      // ── 6. Process custom sessions & assign to week ──────────────────────
      const findWeekId = (dateStr: string): string | null => {
        const d = new Date(dateStr);
        for (const w of uniqueWeeks) {
          const mon = getWeekMonday(w.week_number, w.year);
          const sun = getWeekSunday(w.week_number, w.year);
          if (d >= mon && d <= sun) return w.id;
        }
        return null;
      };

      for (const cs of customData || []) {
        const dateStr = cs.completed_at || cs.scheduled_date;
        if (!dateStr) continue;
        const wid = findWeekId(dateStr);
        if (!wid || !weekMap[wid]) continue;

        const bucket = weekMap[wid];
        bucket.sessionCount++;
        const km  = cs.distance_km      || 0;
        const min = cs.duration_minutes || 0;
        bucket.totalKm      += km;
        bucket.totalMinutes += min;

        bucket.sessions.push({
          name:            cs.session_name,
          sport:           cs.cardio_type || undefined,
          source:          "custom",
          actualKm:        km > 0  ? km  : undefined,
          actualMinutes:   min > 0 ? min : undefined,
          actualPaceMinkm: cs.avg_pace     || undefined,
          actualAvgHr:     cs.avg_heart_rate || undefined,
          completed:       true,
        });
      }

      // ── 7. Build final history array ─────────────────────────────────────
      const history = uniqueWeeks.map((w: any) => {
        const b = weekMap[w.id];
        return {
          weekNumber:     b.weekNumber,
          year:           b.year,
          totalKm:        Math.round(b.totalKm * 10) / 10,
          totalMinutes:   Math.round(b.totalMinutes),
          sessionCount:   b.sessionCount,
          avgIntensityPct: b.intensities.length > 0
            ? Math.round(b.intensities.reduce((a: number, c: number) => a + c, 0) / b.intensities.length)
            : undefined,
          sessions: b.sessions,
        };
      });

      setRecentCardioHistory(history);
    } catch (e) {
      console.error("Erreur loadRecentCardioHistory:", e);
    }
  };

  // Load sessions from DB for a given week (used for past or navigated weeks)
  const loadWeekFromDB = async (week: number, year: number) => {
    if (!athleteId) return;
    setIsLoadingWeek(true);
    suppressDraftSaveRef.current = true;
    try {
      // Find the training_week record
      const { data: weekRecords } = await supabase
        .from("training_weeks")
        .select("*")
        .eq("athlete_id", athleteId)
        .eq("week_number", week)
        .eq("year", year)
        .order("created_at", { ascending: false })
        .limit(1);

      const weekRecord = weekRecords?.[0] ?? null;
      const validated = !!weekRecord?.validated;
      const draft = validated ? null : await loadProgDraft(athleteId, week, year);

      // Un brouillon non validé prime sur la DB (modifs en cours de l'entraîneur)
      if (draft) {
        setIsValidated(false);
        setSessions(draft.sessions);
        setSessionExercises(draft.sessionExercises);
        setCollapsedSeriesExercises(buildCollapsedSeriesMap(draft.sessionExercises));
        return;
      }

      if (!weekRecord) {
        // No data for this week → clear sessions
        setSessions([]);
        setSessionExercises({});
        setIsValidated(false);
        return;
      }

      setIsValidated(!!weekRecord.validated);

      // Load sessions for this week
      const { data: sessionsData, error } = await supabase
        .from("training_sessions")
        .select("*, session_exercises (*)")
        .eq("week_id", weekRecord.id)
        .order("session_number");

      if (error) throw error;

      if (!sessionsData || sessionsData.length === 0) {
        setSessions([]);
        setSessionExercises({});
        return;
      }

      const newSessions: Session[] = sessionsData.map((s, idx) => {
        let sessionType = s.session_type;
        if (!sessionType && s.session_exercises?.length > 0) {
          sessionType = s.session_exercises.some(
            (ex: any) => ex.cardio_sport || ex.cardio_content || ex.cardio_pace
          ) ? "cardio" : "renfo";
        }
        return {
          id: idx + 1,
          name: s.name,
          isExpanded: false,
          session_type: sessionType || "renfo",
          coach_note: (s as any).coach_note ?? null,
        };
      });

      const newExercises: Record<number, Exercise[]> = {};
      sessionsData.forEach((s, sessionIdx) => {
        const sessionId = sessionIdx + 1;
        if (s.session_exercises) {
          newExercises[sessionId] = s.session_exercises
            .sort((a: any, b: any) => a.exercise_order - b.exercise_order)
            .map((ex: any) => ({
              id: ex.id,
              exercice: ex.exercice || "",
              series: ex.series || "",
              reps: ex.reps || "",
              charge: ex.charge || "",
              rpe: ex.rpe || "",
              recuperation: ex.recuperation || "",
              tempo: ex.tempo || "",
              commentaire: ex.commentaire || "",
              exercise_order: ex.exercise_order || 0,
              super_set_group: ex.super_set_group || null,
              per_side: ex.per_side || false,
              is_duration: ex.is_duration || false,
              is_distance: ex.is_distance || false,
              serie_details: ex.serie_details || null,
              coach_note: ex.coach_note ?? null,
              sportif_rpe: ex.sportif_rpe || null,
              sportif_comment: ex.sportif_comment || null,
              skipped: ex.skipped || false,
              exercise_library_id: ex.exercise_library_id || null,
              cardio_sport: ex.cardio_sport || null,
              cardio_content: ex.cardio_content || null,
              cardio_pace: ex.cardio_pace || null,
              cardio_duration: ex.cardio_duration || null,
              cardio_distance: ex.cardio_distance || null,
              cardio_avg_heart_rate: ex.cardio_avg_heart_rate || null,
              actual_distance_km: ex.actual_distance_km || null,
              actual_duration_minutes: ex.actual_duration_minutes || null,
              actual_pace_min_per_km: ex.actual_pace_min_per_km || null,
              actual_avg_heart_rate: ex.actual_avg_heart_rate || null,
              actual_max_heart_rate: ex.actual_max_heart_rate || null,
              actual_cadence: ex.actual_cadence || null,
              actual_elevation_gain: ex.actual_elevation_gain || null,
              actual_calories: ex.actual_calories || null,
              actual_heart_rate_zones: ex.actual_heart_rate_zones || null,
              serie_rpe_details: ex.serie_rpe_details || null,
              sportif_feedback_at: ex.sportif_feedback_at || null,
              linked_strava_activity_id: ex.linked_strava_activity_id || null,
            }));
        }
      });

      setSessions(newSessions);
      setSessionExercises(newExercises);

      // Replier toutes les séries individuelles par défaut (validé ou non)
      setCollapsedSeriesExercises(buildCollapsedSeriesMap(newExercises));

      // Populate copiedWeekFeedback from DB exercise feedback fields
      const feedbackMap: Record<string, {
        sportif_rpe?: string | null;
        sportif_comment?: string | null;
        skipped?: boolean;
        serie_rpe_details?: { rpe: number | null; actual_reps?: string | null; actual_charge?: string | null }[] | null;
      }> = {};
      sessionsData.forEach((s, sessionIdx) => {
        const sessionId = sessionIdx + 1;
        (s.session_exercises || []).forEach((ex: any) => {
          const hasFeedback =
            ex.sportif_rpe != null ||
            ex.sportif_comment != null ||
            ex.skipped === true ||
            (ex.serie_rpe_details && ex.serie_rpe_details.length > 0);
          if (hasFeedback && ex.exercice) {
            feedbackMap[`${sessionId}-${ex.exercice}`] = {
              sportif_rpe: ex.sportif_rpe ?? null,
              sportif_comment: ex.sportif_comment ?? null,
              skipped: ex.skipped ?? false,
              serie_rpe_details: ex.serie_rpe_details ?? null,
            };
          }
        });
      });
      setCopiedWeekFeedback(feedbackMap);
    } catch (err) {
      console.error("Erreur chargement semaine:", err);
    } finally {
      setIsLoadingWeek(false);
      // Réactive la sauvegarde du brouillon une fois l'état posé
      setTimeout(() => { suppressDraftSaveRef.current = false; }, 0);
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

  const loadCoachCustomSessions = async () => {
    if (!athleteId) return;
    const { data } = await (supabase.from("custom_sessions") as any)
      .select("id, session_name, cardio_type, duration_minutes, distance_km, avg_pace, avg_heart_rate, session_rpe, description, completed_at, scheduled_date, max_heart_rate, cadence, calories, elevation_gain, heart_rate_zones, strava_activity_id")
      .eq("user_id", athleteId)
      .order("completed_at", { ascending: false })
      .limit(50);
    setCoachCustomSessions(data || []);
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

      // L'objectif principal remplace le macrocycle : le rappel s'appuie dessus
      const { data: objRows } = await supabase
        .from("athlete_objectives")
        .select("main_objective, main_objective_deadline")
        .eq("athlete_id", athleteId)
        .order("updated_at", { ascending: false })
        .limit(1);
      setHasMainObjective(!!objRows?.[0]?.main_objective);
      setMainObjectiveName(objRows?.[0]?.main_objective || null);
      setMainObjectiveDeadline(objRows?.[0]?.main_objective_deadline || null);

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

  const loadInjuryAndPerfTests = async () => {
    if (!athleteId) return;

    // Recent injury from daily_fatigue_log
    const { data: injuryData } = await supabase
      .from("daily_fatigue_log")
      .select("injury_level, injury_location")
      .eq("user_id", athleteId)
      .eq("has_injury", true)
      .not("injury_level", "is", null)
      .order("date", { ascending: false })
      .limit(1);

    if (injuryData && injuryData.length > 0 && injuryData[0].injury_level > 0) {
      setCurrentInjury({
        level: injuryData[0].injury_level,
        location: injuryData[0].injury_location || "Non précisé",
      });
    } else {
      setCurrentInjury(null);
    }

    // Performance tests
    const { data: testData } = await (supabase.from("athlete_performance_tests") as any)
      .select("test_type, test_date, raw_value, vma_estimated, notes")
      .eq("athlete_id", athleteId)
      .order("test_date", { ascending: false })
      .limit(5);

    if (testData) setRecentPerfTests(testData);
  };

  const loadHeaderInjury = async () => {
    if (!athleteId) return;
    
    try {
      const today = new Date();
      const sevenDaysAgo = subDays(today, 6);

      // Récupérer TOUTES les entrées (y compris "Terminée" avec has_injury=false)
      const { data, error } = await supabase
        .from("daily_fatigue_log")
        .select("injury_level, injury_location, has_injury, date")
        .eq("user_id", athleteId)
        .gte("date", format(sevenDaysAgo, "yyyy-MM-dd"))
        .lte("date", format(today, "yyyy-MM-dd"))
        .order("date", { ascending: false }); // Plus récent en premier

      console.log("[loadHeaderInjury] raw data from supabase:", JSON.stringify(data));
      console.log("[loadHeaderInjury] error:", error);

      if (error || !data || data.length === 0) {
        setHeaderInjury(null);
        return;
      }

      // L'entrée la plus récente : si c'est "Terminée" (has_injury=false ou injury_level=0), pas de badge
      const mostRecent = data[0];
      console.log("[loadHeaderInjury] mostRecent:", JSON.stringify(mostRecent));
      if (!mostRecent.has_injury || (mostRecent.injury_level ?? 0) === 0) {
        setHeaderInjury(null);
        return;
      }

      // Calculer la moyenne uniquement sur les entrées actives (has_injury=true et injury_level > 0)
      const activeEntries = data.filter(
        (d) => d.has_injury && (d.injury_level || 0) > 0
      );
      if (activeEntries.length === 0) {
        setHeaderInjury(null);
        return;
      }
      const totalPain = activeEntries.reduce((sum, d) => sum + (d.injury_level || 0), 0);
      const avgPain = totalPain / activeEntries.length;
      const location = activeEntries[0]?.injury_location || "Non précisé";

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
    if (!selectedWeekToProgram || !athleteId) return;

    try {
      // Supprimer toutes les semaines correspondant au même couple (athlete_id, week_number, year)
      const { data: weeksToDelete, error: weeksError } = await supabase
        .from("training_weeks")
        .select("id")
        .eq("athlete_id", athleteId)
        .eq("week_number", selectedWeekToProgram.week)
        .eq("year", selectedWeekToProgram.year);

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

      // Clear local state
      setSessions([]);
      setSessionExercises({});
      setIsValidated(false);
      setShowDeleteWeekDialog(false);

      // Recharger les semaines disponibles
      await new Promise((r) => setTimeout(r, 250));
      await loadHistoricalWeeks();
      await loadAllTrainingWeeks();
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
              is_distance: exercise.is_distance || false,
              request_video: exercise.request_video || false,
            request_activity_link: exercise.request_activity_link || false,
              request_activity_link: exercise.request_activity_link || false,
              serie_details: (() => { const __sd = getSerieDetailsArray(exercise.serie_details); return __sd.length > 0 ? JSON.stringify(__sd) : null; })(),
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
      setAthleteFcMax((data as any).fc_max || null);
      setAthleteFcRepos((data as any).fc_repos || null);
      setAthleteFtp((data as any).ftp || null);
      setAllowAddExercises(!!(data as any).allow_athlete_add_exercises);
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

    // Si c'est une séance renfo, ajouter automatiquement une ligne vide et ouvrir le combobox
    if (newSessionType === "renfo") {
      const blankExercise: Exercise = {
        id: 1, exercice: "", recuperation: "1min30s", reps: "", series: "4",
        charge: "", rpe: "", tempo: "", commentaire: "",
      };
      setSessionExercises((prev) => ({ ...prev, [nextSessionNumber]: [blankExercise] }));
      setExpandedSessionId(nextSessionNumber);
      if (window.matchMedia("(min-width: 640px)").matches) setTimeout(() => setAutoOpenExercise({ sessionId: nextSessionNumber, exerciseId: 1 }), 80);
    }

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

  /** Wrapper for mobile UX — accepts session type directly */
  const handleCreateSessionByType = (type: "renfo" | "cardio" | "recup") => {
    setNewSessionType(type);
    const nextSessionNumber = sessions.length + 1;
    const sessionName = type === "cardio"
      ? `Cardio ${nextSessionNumber}`
      : type === "recup"
      ? `Récup/Mobilité ${nextSessionNumber}`
      : `Séance ${nextSessionNumber}`;

    const newSession: Session = { id: nextSessionNumber, name: sessionName, isExpanded: false, session_type: type };
    const updatedSessions = [...sessions, newSession];
    setSessions(updatedSessions);

    if (type === "renfo") {
      const blankExercise: Exercise = {
        id: 1, exercice: "", recuperation: "1min30s", reps: "", series: "4",
        charge: "", rpe: "", tempo: "", commentaire: "",
      };
      setSessionExercises((prev) => ({ ...prev, [nextSessionNumber]: [blankExercise] }));
      setExpandedSessionId(nextSessionNumber);
      if (window.matchMedia("(min-width: 640px)").matches) setTimeout(() => setAutoOpenExercise({ sessionId: nextSessionNumber, exerciseId: 1 }), 80);
    }

    if (type === "cardio") {
      setSessionExercises((prev) => ({
        ...prev,
        [nextSessionNumber]: [{ id: 1, exercice: "Séance Cardio", recuperation: "", reps: "", series: "", charge: "", rpe: "", tempo: "", commentaire: "", cardio_sport: selectedCardioSport, cardio_content: "", cardio_pace: "" }],
      }));
    } else if (type === "recup") {
      setSessionExercises((prev) => ({
        ...prev,
        [nextSessionNumber]: [{ id: 1, exercice: "", recuperation: "", reps: "", series: "", charge: "", rpe: "", tempo: "", commentaire: "" }],
      }));
    }
    toast.success(`Séance créée`);
  };

  const handleCancelMethodology = async () => {
    if (!persistentActiveAssignment?.id) return;
    try {
      await supabase
        .from("athlete_methodology_assignments")
        .update({ status: "cancelled" })
        .eq("id", persistentActiveAssignment.id);
    } catch { /* best-effort */ }
    // Clear local state
    setPersistentActiveAssignment(null);
    setPersistentMethodology(null);
    setPersistentMaxes({});
    // Clear localStorage cache
    try { localStorage.removeItem(`coach-active-methodology-${athleteId}`); } catch { /* ignore */ }
    toast.success("Méthodologie retirée");
  };

  const loadMethodologiesForAssignment = async () => {
    setLoadingMethodologies(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("coaching_methodologies")
        .select("id, name, num_cycles, weeks_per_cycle, sessions_options, session_exercise_configs")
        .eq("coach_id", user.id)
        .order("name");

      if (error) throw error;

      // Also load exercise details for each methodology
      const methIds = (data || []).map(m => m.id);
      let exercisesMap: Record<string, string[]> = {};
      if (methIds.length > 0) {
        const { data: methExData } = await supabase
          .from("methodology_exercises")
          .select("methodology_id, exercise_id")
          .in("methodology_id", methIds);
        (methExData || []).forEach((e: any) => {
          if (!exercisesMap[e.methodology_id]) exercisesMap[e.methodology_id] = [];
          exercisesMap[e.methodology_id].push(e.exercise_id);
        });
      }

      // Load exercise names
      const allExIds = [...new Set(Object.values(exercisesMap).flat())];
      let exerciseNamesMap: Record<string, string> = {};
      if (allExIds.length > 0) {
        const { data: exData } = await supabase
          .from("exercise_library")
          .select("id, name, unilateral")
          .in("id", allExIds);
        (exData || []).forEach((e: any) => {
          exerciseNamesMap[e.id] = e.name;
        });
      }

      setAvailableMethodologies((data || []).map(m => ({
        ...m,
        exerciseNames: exercisesMap[m.id]?.map(eid => exerciseNamesMap[eid]).filter(Boolean) || [],
        exerciseIds: exercisesMap[m.id] || [],
      })));

      // Load active assignment for this athlete to auto-detect cycle/week
      if (athleteId) {
        const { data: assignments } = await supabase
          .from("athlete_methodology_assignments")
          .select("*")
          .eq("athlete_id", athleteId)
          .eq("coach_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false });
        
        if (assignments && assignments.length > 0) {
          setActiveAssignmentForMethodology(assignments[0]);
        } else {
          setActiveAssignmentForMethodology(null);
        }
      }
    } catch (error) {
      console.error("Erreur chargement méthodologies:", error);
      toast.error("Erreur lors du chargement des méthodologies");
    } finally {
      setLoadingMethodologies(false);
    }
  };

  // Helper: extract ALL exercises for a given cycle/week
  const getAllExercisesForWeek = (methodology: any, cycleIndex: number, weekIndex: number): { exerciseId: string; name: string; hasPercent: boolean }[] => {
    const configs: Record<string, any[]> = methodology.session_exercise_configs || {};
    const exercisesMap: Map<string, { name: string; hasPercent: boolean }> = new Map();

    for (const key of Object.keys(configs)) {
      const parts = key.split("-");
      if (parts.length !== 3) continue;
      const [ci, wi] = parts.map(Number);
      if (ci === cycleIndex && wi === weekIndex) {
        (configs[key] || []).forEach((ex: any) => {
          const hasPercent = (charge: string) => charge && charge.includes("%");
          const chargeHasPercent = hasPercent(ex.charge);
          const detailsHavePercent = ex.serieDetails?.some((sd: any) => hasPercent(sd.charge));
          const libEx = libraryExercises.find(e => e.id === ex.exerciseId);
          const name = libEx?.name || ex.exerciseId;
          const existing = exercisesMap.get(ex.exerciseId);
          exercisesMap.set(ex.exerciseId, {
            name,
            hasPercent: (existing?.hasPercent || false) || chargeHasPercent || detailsHavePercent,
          });
        });
      }
    }

    return Array.from(exercisesMap.entries()).map(([exerciseId, data]) => ({ exerciseId, name: data.name, hasPercent: data.hasPercent }));
  };

  // Helper: convert a % charge string to actual kg using reference max
  // Accepts "80%", "80 %", or plain "80" (number ≤100 treated as %)
  const convertPercentCharge = (charge: string, referenceMax: number): string => {
    if (!charge) return charge;
    let percent: number | null = null;
    const matchPercent = charge.match(/(\d+\.?\d*)\s*%/);
    if (matchPercent) {
      percent = parseFloat(matchPercent[1]);
    } else {
      // Plain number ≤ 100 → treat as percentage
      const trimmed = charge.trim();
      if (/^\d+\.?\d*$/.test(trimmed)) {
        const val = parseFloat(trimmed);
        if (val > 0 && val <= 100) percent = val;
      }
    }
    if (percent === null || isNaN(percent) || percent <= 0) return charge;
    const actualKg = Math.round((percent / 100) * referenceMax * 2) / 2; // arrondi à 0.5kg
    return `${actualKg}kg`;
  };

  // Auto-detect cycle and week from active assignment
  const autoDetectMethodologyWeek = (methodology: any) => {
    if (!activeAssignmentForMethodology || activeAssignmentForMethodology.methodology_id !== methodology.id) return;
    
    const startDate = new Date(activeAssignmentForMethodology.start_date);
    const today = new Date();
    const diffMs = today.getTime() - startDate.getTime();
    const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
    
    const weeksPerCycle = methodology.weeks_per_cycle || 1;
    const numCycles = methodology.num_cycles || 1;
    
    const totalWeeksInMethodology = weeksPerCycle * numCycles;
    const currentWeekInMethodology = Math.min(Math.max(diffWeeks, 0), totalWeeksInMethodology - 1);
    
    const detectedCycle = Math.floor(currentWeekInMethodology / weeksPerCycle);
    const detectedWeek = (currentWeekInMethodology % weeksPerCycle) + 1;
    
    setSelectedMethodologyCycle(Math.min(detectedCycle, numCycles - 1));
    setSelectedMethodologyWeek(Math.min(detectedWeek, weeksPerCycle));
  };

  const handleProceedToMaxes = () => {
    const methodology = availableMethodologies.find(m => m.id === selectedMethodologyId);
    if (!methodology) return;

    const weekIndex = selectedMethodologyWeek - 1;
    const allExercises = getAllExercisesForWeek(methodology, selectedMethodologyCycle, weekIndex);

    if (allExercises.length === 0) {
      // No exercises at all, apply directly (will show error)
      handleApplyMethodology();
      return;
    }

    // Always show maxes step so coach can see/set reference maxes
    const loadExistingMaxes = async () => {
      // Fetch athlete's current maxes from exercise_maxes table
      const exerciseIds = allExercises.map(ex => ex.exerciseId);
      const { data: athleteCurrentMaxes } = await supabase
        .from("exercise_maxes")
        .select("exercise_id, weight_kg")
        .eq("athlete_id", athleteId!)
        .in("exercise_id", exerciseIds)
        .order("recorded_at", { ascending: false });

      // Build a map of latest max per exercise
      const latestMaxMap: Record<string, number> = {};
      (athleteCurrentMaxes || []).forEach((m: any) => {
        if (!latestMaxMap[m.exercise_id]) latestMaxMap[m.exercise_id] = m.weight_kg;
      });

      if (activeAssignmentForMethodology && activeAssignmentForMethodology.methodology_id === methodology.id) {
        const { data: existingMaxes } = await supabase
          .from("athlete_methodology_maxes")
          .select("*")
          .eq("assignment_id", activeAssignmentForMethodology.id);

        const maxesMap: Record<string, { name: string; max: string; athleteMax: number | null }> = {};
        allExercises.forEach(ex => {
          const existing = existingMaxes?.find(m => m.exercise_id === ex.exerciseId);
          const athleteMax = latestMaxMap[ex.exerciseId] || null;
          maxesMap[ex.exerciseId] = {
            name: ex.name,
            max: existing ? String(existing.reference_max) : (athleteMax ? String(athleteMax) : ""),
            athleteMax,
          };
        });
        setMethodologyMaxes(maxesMap);
      } else {
        const maxesMap: Record<string, { name: string; max: string; athleteMax: number | null }> = {};
        allExercises.forEach(ex => {
          const athleteMax = latestMaxMap[ex.exerciseId] || null;
          maxesMap[ex.exerciseId] = { name: ex.name, max: athleteMax ? String(athleteMax) : "", athleteMax };
        });
        setMethodologyMaxes(maxesMap);
      }
      setMethodologyStep("maxes");
    };

    loadExistingMaxes();
  };

  const handleApplyMethodology = async () => {
    const methodology = availableMethodologies.find(m => m.id === selectedMethodologyId);
    if (!methodology) {
      toast.error("Sélectionne une méthodologie");
      return;
    }

    const configs: Record<string, any[]> = methodology.session_exercise_configs || {};
    const cycleIndex = selectedMethodologyCycle;
    const weekIndex = selectedMethodologyWeek - 1; // 0-based

    // Find all sessions for this cycle+week
    const sessionsForWeek: { sessionIndex: number; exercises: any[] }[] = [];
    
    for (const key of Object.keys(configs)) {
      const parts = key.split("-");
      if (parts.length !== 3) continue;
      const [ci, wi, si] = parts.map(Number);
      if (ci === cycleIndex && wi === weekIndex) {
        sessionsForWeek.push({ sessionIndex: si, exercises: configs[key] });
      }
    }

    if (sessionsForWeek.length === 0) {
      toast.error("Aucun exercice trouvé pour cette semaine dans la méthodologie");
      return;
    }

    // Sort by session index
    sessionsForWeek.sort((a, b) => a.sessionIndex - b.sessionIndex);

    // Auto-create assignment if none exists for this methodology
    let assignmentId = activeAssignmentForMethodology?.id;
    if (!activeAssignmentForMethodology || activeAssignmentForMethodology.methodology_id !== methodology.id) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && athleteId) {
        // Check if an active assignment already exists
        const { data: existing } = await supabase
          .from("athlete_methodology_assignments")
          .select("id")
          .eq("athlete_id", athleteId)
          .eq("coach_id", user.id)
          .eq("methodology_id", methodology.id)
          .eq("status", "active")
          .limit(1);
        
        if (existing && existing.length > 0) {
          assignmentId = existing[0].id;
        } else {
          // Create assignment automatically
          const totalWeeks = (methodology.num_cycles || 1) * (methodology.weeks_per_cycle || 1);
          // Calculate start date from selectedWeekToProgram
          const jan1 = new Date(selectedWeekToProgram.year, 0, 1);
          const dayOfWeek = jan1.getDay() || 7;
          const mondayOfSelectedWeek = new Date(jan1.getTime() + ((selectedWeekToProgram.week - 1) * 7 - (dayOfWeek - 1)) * 86400000);
          
          const { data: newAssignment } = await supabase
            .from("athlete_methodology_assignments")
            .insert({
              coach_id: user.id,
              athlete_id: athleteId,
              methodology_id: methodology.id,
              total_weeks: totalWeeks,
              start_date: mondayOfSelectedWeek.toISOString().split("T")[0],
            })
            .select("id")
            .single();
          
          if (newAssignment) {
            assignmentId = newAssignment.id;
            // Create week tracking rows
            const weekRows = Array.from({ length: totalWeeks }, (_, i) => ({
              assignment_id: newAssignment.id,
              week_number: i + 1,
            }));
            await supabase.from("athlete_methodology_weeks").insert(weekRows);
          }
        }
      }
    }

    // Save maxes to DB
    if (assignmentId && Object.keys(methodologyMaxes).length > 0) {
      const maxRows = Object.entries(methodologyMaxes)
        .filter(([_, v]) => v.max && parseFloat(v.max) > 0)
        .map(([exerciseId, v]) => ({
          assignment_id: assignmentId!,
          exercise_id: exerciseId,
          exercise_name: v.name,
          reference_max: parseFloat(v.max),
        }));

      if (maxRows.length > 0) {
        for (const row of maxRows) {
          await supabase
            .from("athlete_methodology_maxes")
            .upsert(row, { onConflict: "assignment_id,exercise_id" });
        }
      }
    }

    // Save undo state
    setUndoStack(prev => [...prev, { sessions: [...sessions], sessionExercises: { ...sessionExercises } }]);

    // Create sessions and exercises
    const newSessions: Session[] = [];
    const newSessionExercises: Record<number, Exercise[]> = {};

    sessionsForWeek.forEach((sw, idx) => {
      const sessionId = sessions.length + idx + 1;
      newSessions.push({
        id: sessionId,
        name: `Séance ${sessionId}`,
        isExpanded: false,
        session_type: "renfo",
      });

      const exercises: Exercise[] = sw.exercises.map((config: any, exIdx: number) => {
        // Find exercise name from library
        const libEx = libraryExercises.find(e => e.id === config.exerciseId);
        const seriesCount = parseInt(config.series) || 0;
        const refMax = methodologyMaxes[config.exerciseId]?.max ? parseFloat(methodologyMaxes[config.exerciseId].max) : 0;

        // Helper to convert charge
        const resolveCharge = (charge: string) => {
          if (refMax > 0) return convertPercentCharge(charge, refMax);
          return charge;
        };
        
        // Build serie_details: use saved details if available, otherwise generate from main values
        let serieDetails: any[] = [];
        if (config.serieDetails && config.serieDetails.length > 0) {
          serieDetails = config.serieDetails.map((sd: any) => ({
            reps: sd.reps || config.reps || "",
            charge: resolveCharge(sd.charge || config.charge || ""),
            rpe: sd.rpe || config.rpe || "",
            tempo: sd.tempo || config.tempo || "",
            commentaire: sd.commentaire || "",
            recuperation: sd.recuperation || config.recuperation || "",
          }));
        } else if (seriesCount > 0) {
          // No saved details but series count exists → generate from main values
          serieDetails = Array.from({ length: seriesCount }, () => ({
            reps: config.reps || "",
            charge: resolveCharge(config.charge || ""),
            rpe: config.rpe || "",
            tempo: config.tempo || "",
            commentaire: "",
            recuperation: config.recuperation || "",
          }));
        }

        return {
          id: exIdx + 1,
          exercice: libEx?.name || "",
          recuperation: config.recuperation || "",
          reps: config.reps || "",
          series: config.series || "",
          charge: resolveCharge(config.charge || ""),
          rpe: config.rpe || "",
          tempo: config.tempo || "",
          commentaire: config.commentaire || "",
          per_side: false,
          is_unilateral: libEx?.unilateral || false,
          is_duration: false,
          is_distance: false,
          request_video: false,
          request_activity_link: false,
          serie_details: serieDetails,
        };
      });

      newSessionExercises[sessionId] = exercises;
    });

    setSessions(prev => [...prev, ...newSessions]);
    setSessionExercises(prev => ({ ...prev, ...newSessionExercises }));
    setShowMethodologyDialog(false);
    setMethodologyStep("select");
    toast.success(`Méthodologie appliquée : ${sessionsForWeek.length} séance(s) ajoutée(s)`);

    // Set persistent state directly (don't rely solely on DB refetch)
    if (assignmentId) {
      const assignmentData = {
        id: assignmentId,
        methodology_id: methodology.id,
        athlete_id: athleteId,
        total_weeks: (methodology.num_cycles || 1) * (methodology.weeks_per_cycle || 1),
        start_date: (() => {
          const jan1 = new Date(selectedWeekToProgram.year, 0, 1);
          const dayOfWeek = jan1.getDay() || 7;
          const mondayOfSelectedWeek = new Date(jan1.getTime() + ((selectedWeekToProgram.week - 1) * 7 - (dayOfWeek - 1)) * 86400000);
          return mondayOfSelectedWeek.toISOString().split("T")[0];
        })(),
        status: "active",
      };
      setPersistentActiveAssignment(assignmentData);
      setPersistentMethodology(methodology);
      // Update persistentMaxes from methodologyMaxes
      const maxesObj: Record<string, { exercise_name: string; reference_max: number }> = {};
      Object.entries(methodologyMaxes).forEach(([exId, v]) => {
        if (v.max && parseFloat(v.max) > 0) {
          maxesObj[exId] = { exercise_name: v.name, reference_max: parseFloat(v.max) };
        }
      });
      setPersistentMaxes(maxesObj);
      // Persist to localStorage as fallback
      try {
        localStorage.setItem(`coach-active-methodology-${athleteId}`, JSON.stringify({
          assignment: assignmentData,
          methodology: {
            id: methodology.id,
            name: methodology.name,
            num_cycles: methodology.num_cycles,
            weeks_per_cycle: methodology.weeks_per_cycle,
            sessions_options: methodology.sessions_options,
            session_exercise_configs: methodology.session_exercise_configs,
          },
          maxes: maxesObj,
        }));
      } catch (e) { /* ignore */ }
    }
    // Also try DB refetch
    loadPersistentActiveAssignment();
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
              is_distance: ex.is_distance || false,
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
    .filter(t => templateSearchQuery === "" || norm(t.name).includes(norm(templateSearchQuery)));

  // Filtrer les templates renfo
  const filteredRenfoTemplates = sessionTemplates
    .filter(t => t.session_type === "renfo")
    .filter(t => templateSearchQuery === "" || norm(t.name).includes(norm(templateSearchQuery)));

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
              is_distance: ex.is_distance || false,
      per_side: ex.per_side || false,
      is_unilateral: libraryExercises.find(e => e.name === ex.exercice)?.unilateral || false,
      serie_details: ex.serie_details ? (typeof ex.serie_details === "string" ? JSON.parse(ex.serie_details) : ex.serie_details) : undefined,
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
    
    // Sauvegarder l'état avant suppression pour undo
    setUndoStack((prev) => [...prev.slice(-9), { sessions: [...sessions], sessionExercises: { ...sessionExercises } }]);

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

  const handleUnvalidate = async () => {
    if (!athleteId || !selectedWeekToProgram) return;
    try {
      const { data: weekRecords } = await supabase
        .from("training_weeks")
        .select("id")
        .eq("athlete_id", athleteId)
        .eq("week_number", selectedWeekToProgram.week)
        .eq("year", selectedWeekToProgram.year)
        .order("created_at", { ascending: false })
        .limit(1);

      const weekRecord = weekRecords?.[0] ?? null;
      if (!weekRecord) {
        toast.error("Semaine introuvable");
        return;
      }

      const { error } = await supabase
        .from("training_weeks")
        .update({ validated: false, validated_at: null })
        .eq("id", weekRecord.id);

      if (error) throw error;
      setIsValidated(false);
      toast.success("Semaine déverrouillée — tu peux maintenant modifier les séances");
    } catch (error) {
      console.error("Erreur lors du déverrouillage:", error);
      toast.error("Erreur lors du déverrouillage de la semaine");
    }
  };

  const handleToggleAllowAddExercises = async (value: boolean) => {
    if (!athleteId) return;
    setAllowAddExercises(value);
    const { error } = await supabase.rpc("set_athlete_can_add_exercises", {
      p_athlete_id: athleteId,
      p_allowed: value,
    } as any);
    if (error) {
      setAllowAddExercises(!value);
      toast.error(`Erreur : ${error.message}`);
    } else {
      toast.success(value ? "Le sportif peut ajouter des exercices." : "Ajout d'exercices désactivé.");
    }
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
          coach_note: session.coach_note ?? null, // note privée coach
        };

        // Si c'est une séance cardio, calculer et ajouter les métriques
        if (session.session_type === 'cardio') {
          const exercises = sessionExercises[session.id] || [];
          if (exercises.length > 0 && exercises[0].cardio_content) {
            try {
              const cardioData = JSON.parse(exercises[0].cardio_content);
              const metrics = calculateCardioMetrics(cardioData, athleteVma);
              const finite = (n: number) => (Number.isFinite(n) ? n : 0);
              // L'intensité moyenne est bornée [0,100] (contrainte DB) : un test peut
              // dépasser 100 % VMA (ex: Vaussenat 25 km/h).
              sessionInsertData.cardio_total_distance_km = finite(metrics.totalDistanceKm);
              sessionInsertData.cardio_total_duration_minutes = finite(metrics.totalDurationMinutes);
              sessionInsertData.cardio_average_intensity = Math.max(0, Math.min(100, Math.round(finite(metrics.averageIntensity))));
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
        // On préserve les retours sportif (sportif_rpe, sportif_comment, skipped…) s'ils existent
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
              is_distance: exercise.is_distance || false,
            coach_note: exercise.coach_note ?? null,
            request_video: exercise.request_video || false,
            request_activity_link: exercise.request_activity_link || false,
            serie_details: (() => { const __sd = getSerieDetailsArray(exercise.serie_details); return __sd.length > 0 ? JSON.stringify(__sd) : null; })(),
            // Préserver les retours athlète si présents
            sportif_rpe: (exercise as any).sportif_rpe ?? null,
            sportif_comment: (exercise as any).sportif_comment ?? null,
            skipped: (exercise as any).skipped ?? false,
            sportif_feedback_at: (exercise as any).sportif_feedback_at ?? null,
            serie_rpe_details: (exercise as any).serie_rpe_details ?? null,
            actual_distance_km: (exercise as any).actual_distance_km ?? null,
            actual_duration_minutes: (exercise as any).actual_duration_minutes ?? null,
            actual_pace_min_per_km: (exercise as any).actual_pace_min_per_km ?? null,
            actual_avg_heart_rate: (exercise as any).actual_avg_heart_rate ?? null,
          }));

          const { error: exercisesError } = await supabase.from("session_exercises").insert(exercisesToInsert);

          if (exercisesError) throw exercisesError;
        }
      }

      toast.success(`Semaine S${selectedWeekToProgram.week} validée et envoyée au sportif !`);
      setIsValidated(true);
      // La semaine est validée en base → le brouillon local n'est plus nécessaire
      if (athleteId) clearProgDraft(athleteId, selectedWeekToProgram.week, selectedWeekToProgram.year);

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

      // Recharger l'historique, les retours, et les semaines disponibles
      await loadHistoricalWeeks();
      await loadAllTrainingWeeks();
      await loadCustomSessions();
      await loadLastWeekFeedback();
    } catch (error: any) {
      console.error("Erreur lors de la validation:", error);
      toast.error(`Erreur lors de la validation : ${error?.message || error}`);
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
            coach_note: (session as any).coach_note ?? null,
          };
        });

        const newExercises: Record<number, Exercise[]> = {};
        const feedbackMapping: Record<string, { sportif_rpe?: string | null; sportif_comment?: string | null; skipped?: boolean; serie_rpe_details?: any }> = {};
        
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
                    serie_rpe_details: ex.serie_rpe_details || null,
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
                  is_duration: ex.is_duration || false,
                  is_distance: ex.is_distance || false,
                  per_side: ex.per_side || false,
                  is_unilateral: ex.is_unilateral || false,
                  super_set_group: newSuperSetGroup,
                  coach_note: ex.coach_note ?? null,
                  request_video: ex.request_video || false,
                  request_activity_link: ex.request_activity_link || false,
                  serie_details: ex.serie_details ? (typeof ex.serie_details === "string" ? JSON.parse(ex.serie_details as string) : ex.serie_details) : undefined,
                };
              });
            newExercises[sessionIndex + 1] = sortedExercises;
          }
        });

        setSessions(newSessions);
        setSessionExercises(newExercises);
        setCollapsedSeriesExercises(buildCollapsedSeriesMap(newExercises));
        setCopiedWeekFeedback(feedbackMapping);
        setWeekToCopyData(sessionsData);
        setShowCopyDialog(false);
        toast.success("Semaine copiée avec succès ! Vous pouvez maintenant la modifier.");

        // Check if there's an active methodology cycle and ask to adapt
        if (cycleInfo && persistentMethodology) {
          setPendingCopyData({ newSessions, newExercises });
          setShowCopyAdaptDialog(true);
        }
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
      // Trouver la semaine précédente validée - d'abord exact match
      let { data: weeks, error: weeksError } = await supabase
        .from("training_weeks")
        .select("*")
        .eq("athlete_id", athleteId)
        .eq("validated", true)
        .eq("week_number", previousWeek)
        .eq("year", previousYear)
        .limit(1);

      // Fallback: si pas trouvée, chercher la dernière semaine validée
      if ((!weeks || weeks.length === 0) && !weeksError) {
        const { data: fallbackWeeks } = await supabase
          .from("training_weeks")
          .select("*")
          .eq("athlete_id", athleteId)
          .eq("validated", true)
          .order("year", { ascending: false })
          .order("week_number", { ascending: false })
          .limit(1);
        
        if (fallbackWeeks && fallbackWeeks.length > 0) {
          weeks = fallbackWeeks;
          toast.info(`S${previousWeek} non trouvée, copie de S${fallbackWeeks[0].week_number} ${fallbackWeeks[0].year} à la place`);
        }
      }

      if (weeksError || !weeks || weeks.length === 0) {
        toast.error(`Aucune semaine validée trouvée`);
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
            coach_note: (session as any).coach_note ?? null,
          };
        });

        const newExercises: Record<number, Exercise[]> = {};
        const feedbackMapping: Record<string, { sportif_rpe?: string | null; sportif_comment?: string | null; skipped?: boolean; serie_rpe_details?: any }> = {};
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
                    serie_rpe_details: ex.serie_rpe_details || null,
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
                  is_duration: ex.is_duration || false,
                  is_distance: ex.is_distance || false,
                  per_side: ex.per_side || false,
                  is_unilateral: ex.is_unilateral || false,
                  super_set_group: newSuperSetGroup,
                  coach_note: ex.coach_note ?? null,
                  request_video: ex.request_video || false,
                  request_activity_link: ex.request_activity_link || false,
                  serie_details: ex.serie_details ? (typeof ex.serie_details === "string" ? JSON.parse(ex.serie_details as string) : ex.serie_details) : undefined,
                };
              });
            newExercises[sessionIndex + 1] = sortedExercises;
          }
        });

        setSessions(newSessions);
        setSessionExercises(newExercises);
        setCollapsedSeriesExercises(buildCollapsedSeriesMap(newExercises));
        setCopiedWeekFeedback(feedbackMapping);
        setWeekToCopyData(sessionsData);
        toast.success(`Semaine S${previousWeek} copiée ! Vous pouvez maintenant la modifier.`);

        // Check if there's an active methodology cycle and ask to adapt
        if (cycleInfo && persistentMethodology) {
          setPendingCopyData({ newSessions, newExercises });
          setShowCopyAdaptDialog(true);
        }
      } else {
        toast.error("La semaine précédente ne contient aucune séance");
      }
    } catch (error) {
      console.error("Erreur lors de la copie:", error);
      toast.error("Erreur lors de la copie de la semaine précédente");
    }
  };

  // Adapt methodology exercises after copy
  const handleAdaptMethodologyExercises = async () => {
    if (!cycleInfo || !persistentMethodology || !pendingCopyData) return;
    
    const meth = persistentMethodology;
    const configs: Record<string, any[]> = typeof meth.session_exercise_configs === "string" 
      ? JSON.parse(meth.session_exercise_configs) 
      : (meth.session_exercise_configs || {});
    
    const cycleIndex = cycleInfo.cycleNum - 1;
    const weekIndex = cycleInfo.weekInCycle - 1;

    console.log("[ADAPT] cycleInfo:", cycleInfo);
    console.log("[ADAPT] Looking for configs with cycleIndex:", cycleIndex, "weekIndex:", weekIndex);
    console.log("[ADAPT] All config keys:", Object.keys(configs));
    console.log("[ADAPT] libraryExercises count:", libraryExercises.length);

    // Collect methodology exercise configs PER SESSION for this cycle+week
    // Key: sessionIndex → exerciseName → config
    const methPerSession: Record<number, Record<string, any>> = {};
    for (const key of Object.keys(configs)) {
      const parts = key.split("-");
      if (parts.length !== 3) continue;
      const [ci, wi, si] = parts.map(Number);
      if (ci === cycleIndex && wi === weekIndex) {
        console.log("[ADAPT] Found matching config key:", key, "exercises:", configs[key]);
        if (!methPerSession[si]) methPerSession[si] = {};
        (configs[key] || []).forEach((ex: any) => {
          const libEx = libraryExercises.find(e => e.id === ex.exerciseId);
          const name = libEx?.name || "";
          console.log("[ADAPT] Exercise mapping: session", si, ex.exerciseId, "→", name, "config:", { reps: ex.reps, rpe: ex.rpe, charge: ex.charge, tempo: ex.tempo });
          if (name) methPerSession[si][name] = ex;
        });
      }
    }
    
    console.log("[ADAPT] methPerSession:", methPerSession);

    if (Object.keys(methPerSession).length === 0) {
      toast.info("Aucun exercice trouvé dans la méthodologie pour cette semaine");
      setShowCopyAdaptDialog(false);
      setPendingCopyData(null);
      return;
    }

    // Build maxes map from persistentMaxes (already loaded from DB or cache)
    let maxesMap: Record<string, number> = {};
    Object.entries(persistentMaxes).forEach(([exerciseId, v]) => {
      const libEx = libraryExercises.find(e => e.id === exerciseId);
      if (libEx && v.reference_max > 0) maxesMap[libEx.name] = v.reference_max;
    });
    
    // Fallback: try localStorage cache format
    if (Object.keys(maxesMap).length === 0) {
      try {
        const cached = localStorage.getItem(`coach-active-methodology-${athleteId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.maxes) {
            Object.entries(parsed.maxes).forEach(([exerciseId, v]: [string, any]) => {
              const refMax = v.reference_max || (v.max ? parseFloat(v.max) : 0);
              if (refMax > 0) {
                const libEx = libraryExercises.find(e => e.id === exerciseId);
                if (libEx) maxesMap[libEx.name] = refMax;
              }
            });
          }
        }
      } catch (e) { /* ignore */ }
    }

    // Update exercises in the current programming that match methodology exercises
    const updatedExercises = { ...sessionExercises };
    let adaptedCount = 0;

    // Helper: use config value if it exists (even if "0"), otherwise fallback
    const pick = (configVal: string | undefined, fallback: string) => 
      configVal !== undefined && configVal !== null && configVal !== "" ? configVal : fallback;

    // Map programming session numbers to methodology session indices
    const sessionKeys = Object.keys(updatedExercises).map(Number).sort((a, b) => a - b);
    
    // Log current exercise names for debugging
    for (const sessionId of sessionKeys) {
      console.log("[ADAPT] Session", sessionId, "exercises:", updatedExercises[sessionId].map(e => e.exercice));
    }

    for (let i = 0; i < sessionKeys.length; i++) {
      const sessionId = sessionKeys[i];
      const sessionConfigs = methPerSession[i] || {}; // sessionIndex i maps to programming session i
      console.log("[ADAPT] Adapting session", sessionId, "using methodologySessionIndex:", i, "available configs:", Object.keys(sessionConfigs));
      
      updatedExercises[sessionId] = updatedExercises[sessionId].map(ex => {
        const config = sessionConfigs[ex.exercice];
        console.log("[ADAPT] Checking exercise:", ex.exercice, "in session", sessionId, "found config:", !!config);
        if (!config) return ex; // Not a methodology exercise, keep as-is

        adaptedCount++;
        const refMax = maxesMap[ex.exercice] || 0;
        const resolveCharge = (charge: string) => {
          if (refMax > 0) return convertPercentCharge(charge, refMax);
          return charge;
        };

        const seriesCount = parseInt(config.series) || 0;
        let serieDetails: any[] = [];
        if (config.serieDetails && config.serieDetails.length > 0) {
          serieDetails = config.serieDetails.map((sd: any) => ({
            reps: pick(sd.reps, config.reps || ""),
            charge: resolveCharge(pick(sd.charge, config.charge || "")),
            rpe: pick(sd.rpe, config.rpe || ""),
            tempo: pick(sd.tempo, config.tempo || ""),
            commentaire: sd.commentaire || "",
            recuperation: pick(sd.recuperation, config.recuperation || ""),
          }));
        } else if (seriesCount > 0) {
          serieDetails = Array.from({ length: seriesCount }, () => ({
            reps: config.reps || "",
            charge: resolveCharge(config.charge || ""),
            rpe: config.rpe || "",
            tempo: config.tempo || "",
            commentaire: "",
            recuperation: config.recuperation || "",
          }));
        }

        return {
          ...ex,
          reps: pick(config.reps, ex.reps),
          series: pick(config.series, ex.series),
          charge: resolveCharge(pick(config.charge, ex.charge)),
          rpe: pick(config.rpe, ex.rpe),
          tempo: pick(config.tempo, ex.tempo),
          recuperation: pick(config.recuperation, ex.recuperation),
          serie_details: serieDetails.length > 0 ? serieDetails : ex.serie_details,
        };
      });
    }

    setSessionExercises(updatedExercises);
    setShowCopyAdaptDialog(false);
    setPendingCopyData(null);
    toast.success(`${adaptedCount} exercice(s) adapté(s) selon la semaine ${cycleInfo.weekInCycle} du cycle`);
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

  const handleVoiceApply = (
    sessionId: number,
    exerciseId: number,
    changes: VoiceChanges,
    seriesOverrides?: Record<number, Partial<VoiceChanges>>,
  ) => {
    console.log("[VoiceApply] called", { sessionId, exerciseId, changes, seriesOverrides });
    setSessionExercises((prev) => {
      try {
      const exercises = prev[sessionId] || [];
      const updated = exercises.map((ex) => {
        if (ex.id !== exerciseId) return ex;

        console.log("[VoiceApply] found exercise", ex.id, "recuperation:", ex.recuperation, "serie_details type:", typeof ex.serie_details, "is array:", Array.isArray(ex.serie_details), "length:", Array.isArray(ex.serie_details) ? ex.serie_details.length : typeof ex.serie_details === "string" ? `string(${ex.serie_details.length})` : "n/a");

        // 0. Si serie_details est une string JSON, la parser d'abord
        let parsedSerieDetails = ex.serie_details;
        if (typeof ex.serie_details === "string") {
          try { parsedSerieDetails = JSON.parse(ex.serie_details as any); } catch (e) { parsedSerieDetails = undefined; }
        }
        const parsedEx = { ...ex, serie_details: parsedSerieDetails };

        // 1. Appliquer les changements globaux sur la ligne principale
        let updatedEx: Exercise = { ...parsedEx, ...changes };

        // 2. Propager les changements globaux sur les série_details existantes
        if (changes.series) {
          // Nombre de séries modifié → régénérer tout le détail
          const count = parseInt(changes.series) || 0;
          if (count > 0) {
            updatedEx.serie_details = Array.from({ length: count }, () => ({
              reps: updatedEx.reps ?? "",
              charge: updatedEx.charge ?? "",
              rpe: updatedEx.rpe ?? "",
              tempo: updatedEx.tempo ?? "",
              commentaire: updatedEx.commentaire ?? "",
              recuperation: updatedEx.recuperation ?? "",
            }));
          }
        } else if (updatedEx.serie_details && updatedEx.serie_details.length > 0) {
          // Autres champs modifiés → propager sur chaque série existante
          const fieldsChanged = Object.keys(changes) as (keyof VoiceChanges)[];
          updatedEx.serie_details = updatedEx.serie_details.map((sd) => {
            const patched = { ...sd };
            fieldsChanged.forEach((f) => {
              if (changes[f] !== undefined) (patched as any)[f] = changes[f];
            });
            return patched;
          });
        }

        // 3. Appliquer les exceptions par série (atomique, après propagation globale)
        if (seriesOverrides && updatedEx.serie_details && updatedEx.serie_details.length > 0) {
          const details = [...updatedEx.serie_details];
          Object.entries(seriesOverrides).forEach(([serieNumStr, override]) => {
            const idx = parseInt(serieNumStr) - 1; // base 1 → base 0
            if (details[idx]) {
              details[idx] = { ...details[idx], ...override };
            }
          });
          updatedEx = { ...updatedEx, serie_details: details };
        }

        console.log("[VoiceApply] result recuperation:", updatedEx.recuperation, "serie_details recuperation:", Array.isArray(updatedEx.serie_details) ? updatedEx.serie_details.map(s => s.recuperation) : "n/a");
        return updatedEx;
      });
      return { ...prev, [sessionId]: updated };
      } catch (err) {
        console.error("[VoiceApply] ERREUR dans setSessionExercises:", err);
        return prev;
      }
    });
  };

  const handleVoiceAddExercise = (sessionId: number, name: string, changes: VoiceChanges) => {
    const currentExercises = sessionExercises[sessionId] || [];
    const maxId = currentExercises.reduce((max, ex) => Math.max(max, ex.id), 0);
    const newId = maxId + 1;
    const newExercise: Exercise = {
      id: newId,
      exercice: name,
      charge: changes.charge ?? "",
      reps: changes.reps ?? "",
      series: changes.series ?? "",
      rpe: changes.rpe ?? "",
      recuperation: changes.recuperation ?? "",
      tempo: changes.tempo ?? "",
      commentaire: "",
    };
    setSessionExercises((prev) => ({
      ...prev,
      [sessionId]: [...(prev[sessionId] || []), newExercise],
    }));
  };

  const handleExerciseCreated = (ex: { id: string; name: string; muscle_principal?: string | null; muscles_second?: string[] | null }) => {
    setLibraryExercises((prev) => {
      if (prev.some((e) => e.id === ex.id)) return prev;
      return [...prev, ex].sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  // ── Copier une séance dans le presse-papier (pour la coller chez un autre athlète) ──
  const handleCopySession = (sessionId: number) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const exercises = (sessionExercises[sessionId] || []).map((ex) => ({ ...ex }));
    const payload = { name: session.name, session_type: session.session_type, exercises };
    try { localStorage.setItem("cdo_session_clipboard", JSON.stringify(payload)); } catch { /* ignore */ }
    setClipboardSession(payload);
    toast.success(`Séance « ${session.name} » copiée — colle-la chez un autre athlète`);
  };

  // ── Coller la séance copiée dans la semaine affichée ──
  const handlePasteSession = () => {
    if (!clipboardSession) return;
    const nextId = sessions.reduce((m, s) => Math.max(m, s.id), 0) + 1;
    const newSession: Session = {
      id: nextId,
      name: clipboardSession.name,
      isExpanded: false,
      session_type: clipboardSession.session_type,
    };
    // Régénère les ids d'exercices et remappe les groupes de super-set pour éviter les collisions
    const groupMap = new Map<string, string>();
    const base = Date.now();
    const newExercises: Exercise[] = clipboardSession.exercises.map((ex, i) => {
      let group = ex.super_set_group ?? null;
      if (group) {
        if (!groupMap.has(group)) groupMap.set(group, `sg_${base}_${groupMap.size}`);
        group = groupMap.get(group)!;
      }
      return { ...ex, id: base + i + 1, super_set_group: group };
    });
    setSessions((prev) => [...prev, newSession]);
    setSessionExercises((prev) => ({ ...prev, [nextId]: newExercises }));
    setExpandedSessionId(nextId);
    toast.success("Séance collée — pense à valider la semaine pour l'enregistrer");
  };

  const handleAddExercise = (sessionId: number) => {
    const session = sessions.find((s) => s.id === sessionId);
    const isCardio = session?.session_type === "cardio";

    const currentExercises = sessionExercises[sessionId] || [];
    // Use Date.now() as a unique temporary numeric ID.
    // Exercise IDs from Supabase are UUID strings; Math.max on strings yields NaN,
    // making ex.id === NaN always false and breaking handleExerciseChange lookups.
    const newExerciseId = Date.now();
    const newExercise: Exercise = {
      id: newExerciseId,
      exercice: isCardio ? "Séance Cardio" : "",
      recuperation: isCardio ? "" : "1min30s",
      reps: "",
      series: isCardio ? "1" : "4",
      charge: "",
      rpe: "",
      tempo: "",
      commentaire: "",
      cardio_sport: isCardio ? "course" : undefined,
      cardio_content: isCardio ? "" : undefined,
      cardio_pace: isCardio ? "" : undefined,
    };

    setSessionExercises((prev) => ({
      ...prev,
      [sessionId]: [...(prev[sessionId] || []), newExercise],
    }));

    // Après insertion, remonter la nouvelle ligne vers le haut de l'écran (pas collée en bas)
    setTimeout(() => {
      const newExerciseButton = document.querySelector(
        `[data-session="${sessionId}"][data-exercise="${newExerciseId}"][data-field="exercice"] button`,
      ) as HTMLElement | null;

      if (newExerciseButton) {
        // Positionne la ligne à ~180px du haut (sous les en-têtes fixes)
        const rect = newExerciseButton.getBoundingClientRect();
        const target = window.scrollY + rect.top - 180;
        window.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
        // preventScroll: le focus ne doit pas re-scroller la vue en bas
        newExerciseButton.focus({ preventScroll: true });
      }

      // Ouvrir automatiquement le sélecteur (sans click qui toggle et referme)
      if (!isCardio && window.matchMedia("(min-width: 640px)").matches) {
        setAutoOpenExercise({ sessionId, exerciseId: newExerciseId });
      }
    }, 200);
  };

  /** Normalise un nom d'exercice pour la comparaison (minuscules + accents + espaces) */
  const normExName = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

  /**
   * Retourne le 1RM de référence pour un exercice donné.
   * Priorité : maxes méthodologie (persistentMaxes) > 1RM perso (athleteMaxes).
   * La comparaison est insensible à la casse et aux accents.
   */
  const getMax1RM = (exerciseName: string): number | null => {
    const normName = normExName(exerciseName);
    const methEntry = Object.values(persistentMaxes).find(
      (m) => normExName(m.exercise_name) === normName,
    );
    if (methEntry && methEntry.reference_max > 0) return methEntry.reference_max;
    // Cherche dans les maxes perso en ignorant casse et accents
    const athEntry = Object.entries(athleteMaxes).find(
      ([name]) => normExName(name) === normName,
    );
    const athMax = athEntry?.[1] ?? null;
    return athMax && athMax > 0 ? athMax : null;
  };

  /**
   * Estime le RPE à partir de la charge et des répétitions.
   * Utilise la formule inverse d'Epley (plus précise sur 1-5 reps) :
   *   RPE = 10 - (1RM/charge - 1) × 30 + reps
   * Retourne null si les données sont insuffisantes ou si aucun 1RM n'est connu.
   */
  const estimateRpe = (charge: string, reps: string, exerciseName: string): string | null => {
    // Ne pas calculer si la charge est encore un % non résolu
    if (!charge || charge.includes("%")) return null;
    const w = parseFloat(charge);
    const n = parseInt(reps);
    if (!w || !n || isNaN(w) || isNaN(n) || w <= 0 || n <= 0) return null;

    const max1RM = getMax1RM(exerciseName);
    if (!max1RM) return null;

    // Inverse Epley : RIR = (1RM/w - 1)×30 - n  →  RPE = 10 - RIR
    const rawRpe = 10 - (max1RM / w - 1) * 30 + n;
    // Seuil minimal : ne pas auto-remplir pour les charges légères (RPE < 5)
    // car l'estimation est peu fiable et inutile pour les échauffements.
    if (rawRpe < 5) return null;
    const clamped = Math.max(5, Math.min(10, rawRpe));
    // Arrondi à 0.5 près
    return (Math.round(clamped * 2) / 2).toString();
  };

  /**
   * Résout "78%" en kg si un max est connu pour cet exercice.
   * Priorité : maxes méthodologie (persistentMaxes) > 1RM perso (athleteMaxes).
   * Retourne la valeur inchangée si pas de max ou si la valeur n'est pas un %.
   */
  const resolvePercentCharge = (rawValue: string, exerciseName: string): string => {
    const pctMatch = rawValue.match(/^(\d+(?:\.\d+)?)\s*%$/);
    if (!pctMatch) return rawValue;
    const pct = parseFloat(pctMatch[1]);
    const max = getMax1RM(exerciseName);
    if (!max) return rawValue; // pas de max connu → garde le %
    return String(Math.round((pct * max) / 100));
  };

  const handleExerciseChange = (sessionId: number, exerciseId: number, field: keyof Exercise, value: string | boolean) => {
    // Normaliser les champs booléens passés comme string depuis le mobile
    if ((field === "is_duration" || field === "is_distance" || field === "per_side") && typeof value === "string") {
      value = value === "true";
    }

    // Determine extra updates synchronously (unilateral check + auto is_duration)
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

    // Mutual exclusivity: is_duration and is_distance cannot both be true
    if (field === "is_duration" && value === true) extraUpdates.is_distance = false;
    if (field === "is_distance" && value === true) extraUpdates.is_duration = false;

    // Auto-detect is_duration from reps value (time formats only — not distances)
    if (field === "reps" && typeof value === "string") {
      const isTimeFormat = /(\d+\s*min|\d+\s*s(?:ec)?(?!\w))/i.test(value);
      if (isTimeFormat) {
        extraUpdates.is_duration = true;
        extraUpdates.is_distance = false;
      }
    }

    // Update state immediately using functional updater to avoid stale closures
    setSessionExercises(prev => {
      const currentExercises = prev[sessionId] || [];
      
      if (field === "series" && typeof value === "string") {
        // AMRAP mode: store the special string without resizing serie_details
        if (String(value).startsWith("amrap:")) {
          const updatedExercises = currentExercises.map((ex) =>
            ex.id === exerciseId ? { ...ex, series: value, serie_details: [] } : ex
          );
          return { ...prev, [sessionId]: updatedExercises };
        }
        const newCount = parseInt(value) || 0;
        const currentExercise = currentExercises.find((ex) => ex.id === exerciseId);

        // Smart resize: preserve existing per-serie edits.
        // Increasing → append copies of the main-line defaults.
        // Decreasing → slice from the end.
        // Empty fields in existing entries are back-filled from the main line.
        const smartResizeSeries = (ex: Exercise, count: number): SerieDetail[] => {
          const existing = getSerieDetailsArray(ex.serie_details);
          const mainDefaults: SerieDetail = {
            reps: ex.reps ?? "",
            charge: ex.charge ?? "",
            rpe: ex.rpe ?? "",
            tempo: ex.tempo ?? "",
            commentaire: ex.commentaire ?? "",
            recuperation: ex.recuperation ?? "",
          };
          if (count <= 0) return [];

          // Back-fill empty fields of existing entries from main-line values
          const filled = existing.map((s) => ({
            ...s,
            reps:         s.reps         || mainDefaults.reps,
            charge:       s.charge       || mainDefaults.charge,
            rpe:          s.rpe          || mainDefaults.rpe,
            tempo:        s.tempo        || mainDefaults.tempo,
            recuperation: s.recuperation || mainDefaults.recuperation,
          }));

          if (count === filled.length) return filled;
          if (count > filled.length) {
            return [
              ...filled,
              ...Array.from({ length: count - filled.length }, () => ({ ...mainDefaults })),
            ];
          }
          return filled.slice(0, count);
        };

        // Auto-collapse when more than 1 serie
        if (newCount > 1) {
          setCollapsedSeriesExercises(prev => ({ ...prev, [exerciseId]: true }));
        }

        if (currentExercise?.super_set_group) {
          const updatedExercises = currentExercises.map((ex) => {
            if (ex.super_set_group === currentExercise.super_set_group) {
              if (newCount > 1) setCollapsedSeriesExercises(prev => ({ ...prev, [ex.id]: true }));
              return { ...ex, series: value, serie_details: smartResizeSeries(ex, newCount) };
            }
            return ex.id === exerciseId ? { ...ex, series: value, serie_details: smartResizeSeries(ex, newCount) } : ex;
          });
          return { ...prev, [sessionId]: updatedExercises };
        }

        const updatedExercises = currentExercises.map((ex) => {
          if (ex.id === exerciseId) {
            return { ...ex, series: value, serie_details: smartResizeSeries(ex, newCount) };
          }
          return ex;
        });
        return { ...prev, [sessionId]: updatedExercises };
      }

      const updatedExercises = currentExercises.map((ex) => {
        if (ex.id === exerciseId) {
          const finalValue =
            field === "charge" && typeof value === "string"
              ? resolvePercentCharge(value, ex.exercice)
              : value;

          const update: Partial<Exercise> = { [field]: finalValue, ...extraUpdates };

          // Propagate main-line value changes to all serie_details.
          if (
            (field === "charge" || field === "reps" || field === "rpe" || field === "recuperation" || field === "commentaire" || field === "tempo") &&
            typeof finalValue === "string"
          ) {
            const details = getSerieDetailsArray(ex.serie_details);
            if (details.length > 0) {
              update.serie_details = details.map((s) => ({ ...s, [field]: finalValue }));
            }
          }

          return { ...ex, ...update };
        }
        return ex;
      });
      return { ...prev, [sessionId]: updatedExercises };
    });

    // Defer async suggested load calculation so it doesn't block input
    if ((field === "rpe" || field === "reps" || field === "exercice" || field === "series") && typeof value === "string") {
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

        // Also calculate suggestions for each serie detail
        const seriesCount = field === "series" ? parseInt(value) : parseInt(currentExercise.series);
        if (seriesCount > 1) {
          const details = updatedExercise.serie_details || [];
          for (let i = 0; i < Math.min(seriesCount, details.length); i++) {
            const serie = details[i];
            const reps = parseInt(serie.reps || updatedExercise.reps);
            const rpe = parseInt(serie.rpe || updatedExercise.rpe);
            if (reps && rpe && !isNaN(reps) && !isNaN(rpe)) {
              const idx = i;
              calculateSuggestedLoadForSerie(updatedExercise.exercice, reps, rpe).then(load => {
                if (load) {
                  setSerieChargeSuggestions(prev => ({ ...prev, [`${exerciseId}-${idx}`]: load }));
                }
              });
            }
          }
        }
      }
    }
  };

  const handleSerieDetailChange = (sessionId: number, exerciseId: number, serieIndex: number, field: keyof SerieDetail, value: string) => {
    setSessionExercises(prev => {
      const exercises = prev[sessionId] || [];
      const updated = exercises.map(ex => {
        if (ex.id !== exerciseId) return ex;
        const details = [...(ex.serie_details || [])];
        if (details[serieIndex]) {
          const finalValue =
            field === "charge"
              ? resolvePercentCharge(value, ex.exercice)
              : value;

          const serieUpdate: Partial<SerieDetail> = { [field]: finalValue };

          details[serieIndex] = { ...details[serieIndex], ...serieUpdate };
        }
        return { ...ex, serie_details: details };
      });
      return { ...prev, [sessionId]: updated };
    });

    // Calculate charge suggestion for this serie if reps or rpe changed
    if (field === "reps" || field === "rpe") {
      const exercises = sessionExercises[sessionId] || [];
      const exercise = exercises.find(ex => ex.id === exerciseId);
      if (exercise) {
        const details = exercise.serie_details || [];
        const serie = details[serieIndex];
        if (serie) {
          const repsVal = field === "reps" ? value : serie.reps;
          const rpeVal = field === "rpe" ? value : serie.rpe;
          const reps = parseInt(repsVal || exercise.reps);
          const rpe = parseInt(rpeVal || exercise.rpe);
          if (reps && rpe && !isNaN(reps) && !isNaN(rpe)) {
            calculateSuggestedLoadForSerie(exercise.exercice, reps, rpe).then(load => {
              if (load) {
                setSerieChargeSuggestions(prev => ({ ...prev, [`${exerciseId}-${serieIndex}`]: load }));
              }
            });
          }
        }
      }
    }
  };

  // Calculate suggested load for a specific serie
  const calculateSuggestedLoadForSerie = async (exerciseName: string, reps: number, rpe: number): Promise<string | null> => {
    if (!exerciseName || !reps || !rpe || isNaN(rpe) || isNaN(reps)) return null;
    try {
      const { data: libraryData } = await supabase
        .from("exercise_library")
        .select("id")
        .eq("name", exerciseName)
        .maybeSingle();
      if (!libraryData?.id) return null;
      const { data: maxData } = await supabase
        .from("exercise_maxes")
        .select("weight_kg")
        .eq("athlete_id", athleteId)
        .eq("exercise_id", libraryData.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!maxData?.weight_kg) return null;
      const rir = 10 - rpe;
      const effectiveReps = reps + rir;
      const suggestedLoad = maxData.weight_kg * (37 - effectiveReps) / 36;
      const roundedLoad = Math.round(suggestedLoad * 2) / 2;
      return roundedLoad.toString();
    } catch { return null; }
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
    // Sauvegarder l'état avant suppression pour undo
    setUndoStack((prev) => [...prev.slice(-9), { sessions: [...sessions], sessionExercises: { ...sessionExercises } }]);

    setSessionExercises((prev) => {
      const currentExercises = prev[sessionId] || [];
      const exerciseToDelete = currentExercises.find((ex) => ex.id === exerciseId);

      let updatedExercises: Exercise[];

      // Si l'exercice supprimé fait partie d'un super-set, retirer aussi le groupe des autres
      if (exerciseToDelete?.super_set_group) {
        const groupExercises = currentExercises.filter((ex) => ex.super_set_group === exerciseToDelete.super_set_group);

        // Si le groupe n'a plus que 2 exercices après suppression, retirer le groupe
        if (groupExercises.length === 2) {
          updatedExercises = currentExercises
            .filter((ex) => ex.id !== exerciseId)
            .map((ex) =>
              ex.super_set_group === exerciseToDelete.super_set_group ? { ...ex, super_set_group: null } : ex,
            );
        } else {
          updatedExercises = currentExercises.filter((ex) => ex.id !== exerciseId);
        }
      } else {
        updatedExercises = currentExercises.filter((ex) => ex.id !== exerciseId);
      }

      return { ...prev, [sessionId]: updatedExercises };
    });

    toast.success("Ligne supprimée");
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setSessions(last.sessions);
    setSessionExercises(last.sessionExercises);
    setUndoStack((prev) => prev.slice(0, -1));
    toast.success("Annulé !");
  };

  const handleToggleSuperSet = (sessionId: number, exerciseId: number) => {
    const currentExercises = sessionExercises[sessionId] || [];
    const exerciseIndex = currentExercises.findIndex((ex) => ex.id === exerciseId);

    if (exerciseIndex === -1 || exerciseIndex === currentExercises.length - 1) return;

    const currentExercise = currentExercises[exerciseIndex];
    const nextExercise = currentExercises[exerciseIndex + 1];

    // Helper: synchronise les serie_details de tous les exercices d'un groupe
    // en s'assurant que chacun a autant d'entrées que l'exercice qui en a le plus.
    const syncSerieDetails = (exercises: Exercise[], groupId: string): Exercise[] => {
      const group = exercises.filter((ex) => ex.super_set_group === groupId);
      const maxCount = Math.max(...group.map((ex) => getSerieDetailsArray(ex.serie_details).length), 0);
      if (maxCount <= 1) return exercises;
      return exercises.map((ex) => {
        if (ex.super_set_group !== groupId) return ex;
        const existing = getSerieDetailsArray(ex.serie_details);
        if (existing.length === maxCount) return ex;
        const defaults = { reps: ex.reps ?? "", charge: ex.charge ?? "", rpe: ex.rpe ?? "", tempo: ex.tempo ?? "", commentaire: "", recuperation: ex.recuperation ?? "" };
        const filled = [...existing, ...Array.from({ length: maxCount - existing.length }, () => ({ ...defaults }))].slice(0, maxCount);
        return { ...ex, serie_details: filled };
      });
    };

    // Cas 1: Aucun des deux n'est dans un groupe - créer un nouveau groupe
    if (!currentExercise.super_set_group && !nextExercise.super_set_group) {
      const newGroupId = `group-${Date.now()}`;
      let updatedExercises = currentExercises.map((ex) => {
        if (ex.id === exerciseId || ex.id === nextExercise.id) {
          return { ...ex, super_set_group: newGroupId };
        }
        return ex;
      });
      updatedExercises = syncSerieDetails(updatedExercises, newGroupId);
      setSessionExercises({ ...sessionExercises, [sessionId]: updatedExercises });
      toast.success("Super-set créé !");
    }
    // Cas 2: L'exercice actuel est dans un groupe - ajouter le suivant au groupe
    else if (currentExercise.super_set_group && !nextExercise.super_set_group) {
      let updatedExercises = currentExercises.map((ex) => {
        if (ex.id === nextExercise.id) return { ...ex, super_set_group: currentExercise.super_set_group };
        return ex;
      });
      updatedExercises = syncSerieDetails(updatedExercises, currentExercise.super_set_group!);
      setSessionExercises({ ...sessionExercises, [sessionId]: updatedExercises });
      toast.success("Exercice ajouté au super-set !");
    }
    // Cas 3: Le suivant est dans un groupe - ajouter l'actuel au groupe
    else if (!currentExercise.super_set_group && nextExercise.super_set_group) {
      let updatedExercises = currentExercises.map((ex) => {
        if (ex.id === exerciseId) return { ...ex, super_set_group: nextExercise.super_set_group };
        return ex;
      });
      updatedExercises = syncSerieDetails(updatedExercises, nextExercise.super_set_group!);
      setSessionExercises({ ...sessionExercises, [sessionId]: updatedExercises });
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
        let updatedExercises = currentExercises.map((ex) => {
          const exIndex = currentExercises.findIndex((e) => e.id === ex.id);
          if (ex.super_set_group === groupId && exIndex > exerciseIndex) {
            return { ...ex, super_set_group: newGroupId };
          }
          return ex;
        });

        // Un super-set doit compter au moins 2 exercices : on vide tout groupe réduit à 1
        const counts: Record<string, number> = {};
        updatedExercises.forEach((ex) => {
          if (ex.super_set_group) counts[ex.super_set_group] = (counts[ex.super_set_group] || 0) + 1;
        });
        updatedExercises = updatedExercises.map((ex) =>
          ex.super_set_group && counts[ex.super_set_group] < 2 ? { ...ex, super_set_group: null } : ex,
        );

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

      if (field === "series") {
        // Séries est le dernier champ — Entrée crée une nouvelle ligne
        handleAddExercise(sessionId);
        return;
      }

      // "par côté" est désormais disponible pour tous les exercices
      const fieldOrder: string[] = ["exercice", "recuperation", "reps", "is_duration", "is_distance", "per_side", "charge", "rpe", "tempo", "commentaire", "series"];

      const currentIndex = fieldOrder.indexOf(field as string);
      const nextField = fieldOrder[currentIndex + 1];

      if (nextField) {
        const nextEl = document.querySelector(
          `[data-session="${sessionId}"][data-exercise="${exerciseId}"][data-field="${nextField}"]`,
        ) as HTMLElement;
        if (nextEl) {
          nextEl.focus();
          // Pour les inputs, sélectionner le contenu
          if (nextEl.tagName === "INPUT") {
            (nextEl as HTMLInputElement).select();
          }
        }
      }
    }

    // Space sur un checkbox-field → toggle + rester sur place (comportement natif préservé)
    // Enter sur un checkbox-field → avancer au champ suivant sans toggle
    if (e.key === " " && (field === "is_duration" || field === "per_side")) {
      // Laisser le comportement natif du bouton (toggle via click)
      return;
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

  const showNotesFloating = athleteNotes.length > 0 && athleteNotes[0].id !== dismissedNoteId;
  const dismissNotesFloating = () => {
    const latestId = athleteNotes[0]?.id;
    if (latestId && athleteId) {
      localStorage.setItem(`notes_card_dismissed_${athleteId}`, latestId);
      setDismissedNoteId(latestId);
    }
  };

  return (
    <div className="space-y-2 sm:space-y-3 overflow-x-hidden max-w-full px-1 sm:px-0">
      {/* ── Dernières notes de coaching (flottant, fermable) ── */}
      {showNotesFloating && (
        <div className="fixed top-16 right-3 sm:right-6 z-50 w-[calc(100vw-1.5rem)] sm:w-96 max-w-96">
          <Card className="border-primary/40 bg-background shadow-xl">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Dernières notes</span>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1" onClick={dismissNotesFloating} aria-label="Fermer">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="max-h-[50vh] overflow-y-auto space-y-3">
                {athleteNotes.slice(0, 3).map((note) => (
                  <div key={note.id} className="border-l-2 border-primary/40 pl-3">
                    <p className="text-[11px] text-muted-foreground mb-0.5">
                      {new Date(note.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs w-full" onClick={() => setShowNotesSheet(true)}>
                Voir toutes les notes ({athleteNotes.length})
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
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
              {/* Prochain milestone */}
              {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const next = athleteMilestones
                  .filter((m: any) => !m.completed && new Date(m.target_date) >= today)
                  .sort((a: any, b: any) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime())[0];
                if (!next) return null;
                const daysLeft = Math.ceil((new Date(next.target_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                const isUrgent = daysLeft <= 14;
                const label = daysLeft === 0 ? "Aujourd'hui" : daysLeft === 1 ? "Demain" : `J-${daysLeft}`;
                return (
                  <span
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium border cursor-pointer ${
                      isUrgent
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                        : "bg-primary/10 text-primary border-primary/30"
                    }`}
                    title={`${next.label} — ${new Date(next.target_date).toLocaleDateString("fr-FR")}`}
                    onClick={() => setActiveTab("objectifs")}
                  >
                    🚩 {label} · {next.label}
                  </span>
                );
              })()}

              {/* Objectif principal + semaines avant l'échéance */}
              {mainObjectiveName && (() => {
                let weeksLeft: number | null = null;
                if (mainObjectiveDeadline) {
                  const t = new Date(); t.setHours(0, 0, 0, 0);
                  weeksLeft = Math.ceil((new Date(mainObjectiveDeadline + "T00:00:00").getTime() - t.getTime()) / (7 * 86400000));
                }
                return (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border bg-primary/10 text-primary border-primary/30 cursor-pointer max-w-[240px]"
                    title={`${mainObjectiveName}${mainObjectiveDeadline ? ` — échéance ${new Date(mainObjectiveDeadline + "T00:00:00").toLocaleDateString("fr-FR")}` : ""}`}
                    onClick={() => setActiveTab("objectifs")}
                  >
                    🎯 <span className="truncate max-w-[160px]">{mainObjectiveName}</span>
                    {weeksLeft !== null && <span className="opacity-80 shrink-0">· {weeksLeft < 0 ? "dépassé" : `${weeksLeft} sem.`}</span>}
                  </span>
                );
              })()}
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
              <TabsTrigger value="efforts" className="text-[10px] sm:text-sm px-1.5 sm:px-3 h-7 sm:h-9">Données</TabsTrigger>
              <TabsTrigger value="max" className="text-[10px] sm:text-sm px-1.5 sm:px-3 h-7 sm:h-9">Max</TabsTrigger>
              <TabsTrigger value="suivi" className="text-[10px] sm:text-sm px-1.5 sm:px-3 h-7 sm:h-9">Fatigue</TabsTrigger>
              <TabsTrigger value="poids" className="text-[10px] sm:text-sm px-1.5 sm:px-3 h-7 sm:h-9">Poids</TabsTrigger>
              <TabsTrigger value="objectifs" className="text-[10px] sm:text-sm px-1.5 sm:px-3 h-7 sm:h-9">Objectifs</TabsTrigger>
              <TabsTrigger value="profil" className="text-[10px] sm:text-sm px-1.5 sm:px-3 h-7 sm:h-9">Profil</TabsTrigger>
              <TabsTrigger value="paiements" className="text-[10px] sm:text-sm px-1.5 sm:px-3 h-7 sm:h-9">Paiements</TabsTrigger>
            </TabsList>
          </div>
          {/* Indicateur de scroll */}
          <div className="absolute right-0 top-0 bottom-1 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none sm:hidden" />
        </div>

        <TabsContent value="resume" className="space-y-2">
          {/* ── Analyse du jour collapsible ── */}
          <DailyDebriefCard athleteId={athleteId!} />
          {/* ── Grille principale 3 colonnes ── */}
          {athlete ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {/* Col 1 : Répartition FC + Douleur */}
              <div className="space-y-2">
                <WeeklyHRZonesCard athleteId={athleteId!} />
                <CoachClientSummaryView
                  athleteId={athleteId!}
                  athleteName={`${athlete.first_name || ''} ${athlete.last_name || ''}`.trim() || athlete.email}
                  column="injury"
                />
              </div>
              {/* Col 2 : Évolution fatigue */}
              <div className="space-y-2">
                <CoachClientSummaryView
                  athleteId={athleteId!}
                  athleteName={`${athlete.first_name || ''} ${athlete.last_name || ''}`.trim() || athlete.email}
                  column="left"
                />
              </div>
              {/* Col 3 : Séances */}
              <CoachClientSummaryView
                athleteId={athleteId!}
                athleteName={`${athlete.first_name || ''} ${athlete.last_name || ''}`.trim() || athlete.email}
                column="right"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <WeeklyHRZonesCard athleteId={athleteId!} />
            </div>
          )}
          {/* ── Alerte SFMS pleine largeur ── */}
          {athlete && (
            <CoachSfmsAlert
              athleteId={athleteId!}
              athleteName={`${athlete.first_name || ''} ${athlete.last_name || ''}`.trim() || athlete.email}
            />
          )}
        </TabsContent>

        <TabsContent value="profil" className="space-y-2">
          {athlete && athleteId && (
            <AthleteProfileTab
              athleteId={athleteId}
              athleteName={`${athlete.first_name || ''} ${athlete.last_name || ''}`.trim() || athlete.email}
              athleteVma={athleteVma}
            />
          )}
        </TabsContent>

        <TabsContent value="programmation" className={`space-y-4 transition-all duration-300 ${showCardioAIChat ? "sm:pr-[460px]" : ""}`}>
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
                <div className="mt-4 space-y-4">
                  <PlannedCardioZonesCard
                    sessions={sessions}
                    sessionExercises={sessionExercises}
                    athleteVma={athleteVma}
                    athleteFcMax={athleteFcMax}
                    athleteFcRepos={athleteFcRepos}
                    athleteFtp={athleteFtp}
                    defaultSport="course"
                  />
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
                                      <span className={`font-medium uppercase ${ex.skipped ? 'text-destructive line-through' : ''}`}>
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
                                      <div className="mt-2 space-y-2">
                                      <div className="flex flex-wrap gap-3 text-xs p-2 bg-background/50 rounded">
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
                                        {ex.actual_max_heart_rate != null && (
                                          <div className="flex items-center gap-1">
                                            <span className="text-muted-foreground">FC max:</span>
                                            <span className="font-medium">{ex.actual_max_heart_rate} bpm</span>
                                          </div>
                                        )}
                                        {ex.actual_cadence != null && (
                                          <div className="flex items-center gap-1">
                                            <span className="text-muted-foreground">Cadence:</span>
                                            <span className="font-medium">{Math.round(ex.actual_cadence)} spm</span>
                                          </div>
                                        )}
                                        {ex.actual_elevation_gain != null && ex.actual_elevation_gain > 0 && (
                                          <div className="flex items-center gap-1">
                                            <span className="text-muted-foreground">Dénivelé:</span>
                                            <span className="font-medium">+{Math.round(ex.actual_elevation_gain)} m</span>
                                          </div>
                                        )}
                                        {ex.actual_calories != null && (
                                          <div className="flex items-center gap-1">
                                            <span className="text-muted-foreground">Calories:</span>
                                            <span className="font-medium">{ex.actual_calories} kcal</span>
                                          </div>
                                        )}
                                      </div>
                                      {ex.actual_heart_rate_zones?.length > 0 && (
                                        <div className="px-2 pb-2">
                                          <HeartRateZonesBar zones={ex.actual_heart_rate_zones} fcMax={athleteFcMax} fcRepos={athleteFcRepos} />
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

            {/* Bouton IA Cardio */}
            <Button
              variant="outline"
              size="sm"
              className="bg-background/95 backdrop-blur-sm border-primary/30 hover:bg-primary/10 shadow-md"
              onClick={() => { setShowCardioAIChat(true); loadRecentCardioHistory(); }}
            >
              <Bot className="h-4 w-4 mr-1 text-primary" />
              <span className="text-xs">IA Cardio</span>
            </Button>

            </div>
          </div>

          {/* ── Rappel : pas d'objectif principal défini ──────────────── */}
          {hasMainObjective === false && !cycleGateDismissed && activeTab !== "objectifs" && activeTab !== "programmation" && (
            <div className="fixed z-50 bottom-4 right-4 left-4 sm:left-auto sm:w-[340px] animate-in slide-in-from-bottom-4 fade-in duration-300">
              <div className="rounded-2xl border border-primary/30 bg-card shadow-lg shadow-black/20 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setActiveTab("objectifs")}
                  className="flex w-full items-center gap-3 p-3.5 text-left active:bg-muted/40 transition-colors"
                >
                  <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight truncate">Définis l'objectif</p>
                    <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                      {athlete?.first_name || "l'athlète"} · avant de programmer les phases
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setCycleGateDismissed(true)}
                aria-label="Masquer le rappel"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground shadow hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Alerte de fatigue */}
          {athlete && (
            <CoachFatigueAlert
              athleteId={athleteId!}
              athleteName={`${athlete.first_name || ''} ${athlete.last_name || ''}`.trim() || athlete.email}
            />
          )}

          {/* ── Objectif principal + timeline de validation ── */}
          {athleteId && <ProgObjectiveBanner athleteId={athleteId} />}

          {/* ── Disponibilités déclarées par l'athlète pour la semaine affichée ── */}
          <WeekAvailabilityCard athleteId={athleteId!} week={selectedWeekToProgram.week} year={selectedWeekToProgram.year} />

          {/* ── Vue mobile (uniquement < sm) ─────────────────────────── */}
          <div className="sm:hidden">
            <MobileProgView
              onSessionNoteChange={(sid, note) => setSessions((prev) => prev.map((s) => s.id === sid ? { ...s, coach_note: note } : s))}
              sessions={sessions}
              sessionExercises={sessionExercises}
              selectedWeekToProgram={selectedWeekToProgram}
              availableWeeks={availableWeeks}
              isValidated={isValidated}
              libraryExercises={libraryExercises as any}
              onWeekChange={(week, year) => setSelectedWeekToProgram({ week, year })}
              onCreateSession={handleCreateSessionByType}
              onDeleteSession={handleDeleteSession}
              onAddExercise={handleAddExercise}
              onDeleteExercise={handleDeleteExercise}
              onExerciseChange={(sessionId, exerciseId, field, value) =>
                handleExerciseChange(sessionId, exerciseId, field as keyof Exercise, value)
              }
              onSerieDetailChange={(sessionId, exerciseId, serieIndex, field, value) =>
                handleSerieDetailChange(sessionId, exerciseId, serieIndex, field as keyof SerieDetail, value)
              }
              onToggleSuperSet={handleToggleSuperSet}
              onSave={handleValidate}
              onUnvalidate={handleUnvalidate}
              allowAddExercises={allowAddExercises}
              onToggleAllowAddExercises={handleToggleAllowAddExercises}
              hasPreviousWeeks={historicalWeeks.length > 0}
              onCopyPreviousWeek={handleCopyPreviousWeek}
              onOpenCopyDialog={() => setShowCopyDialog(true)}
              onCopySession={handleCopySession}
              onPasteSession={handlePasteSession}
              clipboardSessionName={clipboardSession?.name ?? null}
              athleteVma={athleteVma}
              athleteFcMax={athleteFcMax}
              athleteFcRepos={athleteFcRepos}
              athleteFtp={athleteFtp}
              copiedWeekFeedback={copiedWeekFeedback}
              hasFeedback={lastWeekData != null}
              onShowFeedback={() => setShowFeedbackSheet(true)}
            />
          </div>

          {/* ── Vue desktop (masquée < sm) ────────────────────────────── */}
          <div className="hidden sm:block">
            <DesktopProgView
              sessions={sessions}
              setSessions={setSessions}
              sessionExercises={sessionExercises}
              setSessionExercises={setSessionExercises}
              selectedWeek={selectedWeekToProgram}
              availableWeeks={availableWeeks}
              isValidated={isValidated}
              libraryExercises={libraryExercises}
              undoStack={undoStack}
              expandedSessionId={expandedSessionId}
              setExpandedSessionId={setExpandedSessionId}
              onWeekChange={(week, year) => setSelectedWeekToProgram({ week, year })}
              onSave={handleValidate}
              onUnvalidate={handleUnvalidate}
              allowAddExercises={allowAddExercises}
              onToggleAllowAddExercises={handleToggleAllowAddExercises}
              onUndo={handleUndo}
              onCreateSession={handleCreateSessionByType}
              onDeleteSession={handleDeleteSession}
              onAddExercise={handleAddExercise}
              onDeleteExercise={handleDeleteExercise}
              onExerciseChange={(sessionId, exerciseId, field, value) => handleExerciseChange(sessionId, exerciseId, field as any, value)}
              onSerieDetailChange={(sessionId, exerciseId, si, field, value) => handleSerieDetailChange(sessionId, exerciseId, si, field as any, value)}
              onKeyDown={(e, sessionId, exerciseId, field) => handleKeyDown(e, sessionId, exerciseId, field as any)}
              onSessionDragStart={handleSessionDragStart}
              onSessionDragOver={handleSessionDragOver}
              onSessionDrop={handleSessionDrop}
              onExerciseDragStart={handleExerciseDragStart}
              onExerciseDragOver={handleExerciseDragOver}
              onExerciseDrop={handleExerciseDrop}
              collapsedSeriesExercises={collapsedSeriesExercises}
              setCollapsedSeriesExercises={setCollapsedSeriesExercises}
              autoOpenExercise={autoOpenExercise}
              setAutoOpenExercise={setAutoOpenExercise}
              copiedWeekFeedback={copiedWeekFeedback}
              setCopiedWeekFeedback={setCopiedWeekFeedback}
              getExerciseFeedback={getExerciseFeedback}
              getPercentSuggestion={getPercentSuggestion}
              chargeSuggestions={chargeSuggestions}
              serieChargeSuggestions={serieChargeSuggestions}
              isInSameGroup={isInSameGroup}
              athleteVma={athleteVma}
              athleteFcMax={athleteFcMax}
              athleteFcRepos={athleteFcRepos}
              athleteFtp={athleteFtp}
              selectedCardioSport={selectedCardioSport}
              setSelectedCardioSport={setSelectedCardioSport}
              showTemplateSelector={showTemplateSelector}
              setShowTemplateSelector={setShowTemplateSelector}
              showRenfoTemplateSelector={showRenfoTemplateSelector}
              setShowRenfoTemplateSelector={setShowRenfoTemplateSelector}
              templateSearchQuery={templateSearchQuery}
              setTemplateSearchQuery={setTemplateSearchQuery}
              filteredCardioTemplates={filteredCardioTemplates}
              filteredRenfoTemplates={filteredRenfoTemplates}
              handleImportTemplateToSession={handleImportTemplateToSession}
              handleImportRenfoTemplateToSession={handleImportRenfoTemplateToSession}
              handleVoiceApply={handleVoiceApply}
              handleVoiceAddExercise={handleVoiceAddExercise}
              historicalWeeks={historicalWeeks}
              handleCopyPreviousWeek={handleCopyPreviousWeek}
              setShowCopyDialog={setShowCopyDialog}
              onCopySession={handleCopySession}
              onPasteSession={handlePasteSession}
              clipboardSessionName={clipboardSession?.name ?? null}
              multiWeekMode={multiWeekMode}
              multiWeekCurrent={multiWeekCurrent}
              multiWeekTotal={multiWeekTotal}
              setMultiWeekMode={setMultiWeekMode}
              setMultiWeekTotal={setMultiWeekTotal}
              setMultiWeekCurrent={setMultiWeekCurrent}
              setMultiWeekStartWeek={setMultiWeekStartWeek}
              cycleInfo={cycleInfo}
              persistentMethodology={persistentMethodology}
              persistentMaxes={persistentMaxes}
              lastWeekData={lastWeekData}
              setShowFeedbackSheet={setShowFeedbackSheet}
              athleteMilestones={athleteMilestones}
              recuperationOptions={recuperationOptions}
              loadMethodologiesForAssignment={loadMethodologiesForAssignment}
              setShowMethodologyDialog={setShowMethodologyDialog}
              setSelectedMethodologyId={setSelectedMethodologyId}
              setSelectedMethodologyWeek={setSelectedMethodologyWeek}
              setSelectedMethodologyCycle={setSelectedMethodologyCycle}
              setMethodologyStep={setMethodologyStep}
              setMethodologyMaxes={setMethodologyMaxes}
              onExerciseCreated={handleExerciseCreated}
              onToggleSuperSet={handleToggleSuperSet}
              onCancelMethodology={handleCancelMethodology}
              allTrainingWeeks={allTrainingWeeks}
              isLoadingWeek={isLoadingWeek}
              customSessions={customSessions}
            />

          {/* Dialog méthodologie */}
          <Dialog open={showMethodologyDialog} onOpenChange={(open) => { setShowMethodologyDialog(open); if (!open) setMethodologyStep("select"); }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  {methodologyStep === "select" ? "Appliquer une méthodologie" : "Définir les maxes de référence"}
                </DialogTitle>
                <DialogDescription>
                  {methodologyStep === "select"
                    ? "Sélectionne une méthodologie et la semaine à appliquer"
                    : "Renseigne le 1RM de référence pour calculer les charges en %"
                  }
                </DialogDescription>
              </DialogHeader>

              {methodologyStep === "select" ? (
                <div className="space-y-4">
                  {loadingMethodologies ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Chargement...</p>
                  ) : availableMethodologies.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucune méthodologie créée</p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Méthodologie</label>
                        <Select value={selectedMethodologyId} onValueChange={(v) => {
                          setSelectedMethodologyId(v);
                          const meth = availableMethodologies.find(m => m.id === v);
                          if (meth) {
                            autoDetectMethodologyWeek(meth);
                          } else {
                            setSelectedMethodologyWeek(1);
                            setSelectedMethodologyCycle(0);
                          }
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir une méthodologie" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableMethodologies.map(m => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name} {m.num_cycles ? `(${m.num_cycles} cycles, ${m.weeks_per_cycle} sem/cycle)` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedMethodologyId && (() => {
                        const meth = availableMethodologies.find((m: any) => m.id === selectedMethodologyId);
                        if (!meth) return null;
                        const numCycles = meth.num_cycles || 1;
                        const weeksPerCycle = meth.weeks_per_cycle || 1;
                        const isAutoDetected = activeAssignmentForMethodology?.methodology_id === meth.id;
                        return (
                          <div className="space-y-3">
                            {isAutoDetected && (
                              <div className="p-2 bg-primary/10 border border-primary/20 rounded text-xs text-primary">
                                📍 Semaine auto-détectée selon l'assignation active
                              </div>
                            )}
                            {numCycles > 1 && (
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Cycle</label>
                                <Select value={String(selectedMethodologyCycle)} onValueChange={(v) => setSelectedMethodologyCycle(Number(v))}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: numCycles }, (_, i) => (
                                      <SelectItem key={i} value={String(i)}>Cycle {i + 1}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Semaine du cycle</label>
                              <Select value={String(selectedMethodologyWeek)} onValueChange={(v) => setSelectedMethodologyWeek(Number(v))}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: weeksPerCycle }, (_, i) => (
                                    <SelectItem key={i + 1} value={String(i + 1)}>Semaine {i + 1}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {/* Preview */}
                            {(() => {
                              const configs = meth.session_exercise_configs || {};
                              const weekIdx = selectedMethodologyWeek - 1;
                              let sessionCount = 0;
                              let exerciseCount = 0;
                              const sessionDetails: { sessionIndex: number; exercises: any[] }[] = [];
                              for (const key of Object.keys(configs)) {
                                const parts = key.split("-").map(Number);
                                if (parts.length === 3 && parts[0] === selectedMethodologyCycle && parts[1] === weekIdx) {
                                  sessionCount++;
                                  const exs = configs[key] || [];
                                  exerciseCount += exs.length;
                                  sessionDetails.push({ sessionIndex: parts[2], exercises: exs });
                                }
                              }
                              if (sessionCount === 0) return (
                                <p className="text-xs text-muted-foreground p-2 bg-muted rounded">Aucun exercice configuré pour cette semaine</p>
                              );
                              return (
                                <div className="space-y-2">
                                  <div className="p-2 bg-primary/5 border border-primary/20 rounded text-xs">
                                    <span className="font-medium">{sessionCount} séance(s)</span> avec <span className="font-medium">{exerciseCount} exercice(s)</span> au total
                                  </div>
                                  {sessionDetails.sort((a, b) => a.sessionIndex - b.sessionIndex).map(sd => (
                                    <div key={sd.sessionIndex} className="text-xs space-y-0.5 p-2 bg-muted/30 rounded border border-border">
                                      <span className="font-medium text-foreground">Séance {sd.sessionIndex + 1}</span>
                                      {sd.exercises.map((ex: any, i: number) => {
                                        const libEx = libraryExercises.find(e => e.id === ex.exerciseId);
                                        return (
                                          <div key={i} className="text-muted-foreground flex items-center gap-2 pl-2">
                                            <span>• {libEx?.name || "?"}</span>
                                            {ex.series && <span className="text-[10px]">{ex.series}x{ex.reps || "?"}</span>}
                                            {ex.charge && <span className="text-[10px] text-primary">{ex.charge}</span>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              ) : (
                /* Step 2: Maxes input */
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Définis les maxes de référence (1RM) pour chaque exercice. Les charges en % seront automatiquement converties en kg. Laisse vide si non applicable.
                  </p>
                  {Object.entries(methodologyMaxes).map(([exerciseId, data]) => (
                    <div key={exerciseId} className="space-y-0.5">
                      <div className="flex items-center gap-3">
                        <label className="text-sm flex-1 min-w-0 truncate">{data.name}</label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            placeholder={data.athleteMax ? `${data.athleteMax}` : "1RM"}
                            className="w-20 h-8 text-sm"
                            value={data.max}
                            onChange={(e) => setMethodologyMaxes(prev => ({
                              ...prev,
                              [exerciseId]: { ...prev[exerciseId], max: e.target.value }
                            }))}
                          />
                          <span className="text-xs text-muted-foreground">kg</span>
                        </div>
                      </div>
                      {data.athleteMax && (
                        <p className="text-[10px] text-muted-foreground text-right pr-8">
                          Max actuel : {data.athleteMax}kg
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <DialogFooter>
                {methodologyStep === "maxes" && (
                  <Button variant="outline" onClick={() => setMethodologyStep("select")}>Retour</Button>
                )}
                <Button variant="outline" onClick={() => { setShowMethodologyDialog(false); setMethodologyStep("select"); }}>Annuler</Button>
                {methodologyStep === "select" ? (
                  <Button onClick={handleProceedToMaxes} disabled={!selectedMethodologyId}>
                    <BookOpen className="h-4 w-4 mr-1" />
                    Suivant
                  </Button>
                ) : (
                  <Button onClick={handleApplyMethodology}>
                    <BookOpen className="h-4 w-4 mr-1" />
                    Appliquer
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>{/* end hidden sm:block */}

          {/* ── IA Cardio chat panel ────────────────────────────────── */}
          {(() => {
            const today = new Date();
            // Find active mesocycle for context
            const activeMeso = athleteMesocycles.find(
              (m) => today >= new Date(m.start_date) && today <= new Date(m.end_date)
            );

            const aiChatContext: AIChatContext = {
              athleteName: `${athlete?.first_name || ""} ${athlete?.last_name || ""}`.trim() || "l'athlète",
              athleteVma: athleteVma ?? undefined,
              selectedWeek: selectedWeekToProgram,
              mesocycleName: activeMeso?.name,
              phaseType: activeMeso?.phase_type,
              mesocycleStart: activeMeso?.start_date,
              mesocycleEnd: activeMeso?.end_date,
              objective: activeMeso?.objective || (athleteObjectives as any)?.main_objective || undefined,
              recentHistory: recentCardioHistory.length > 0 ? recentCardioHistory : undefined,
              allMesocycles: athleteMesocycles.length > 0
                ? athleteMesocycles
                    .filter((m) => !m.sport || (CARDIO_SPORT_VALUES as readonly string[]).includes(m.sport))
                    .map((m) => ({
                      name: m.name,
                      phaseType: m.phase_type,
                      start: m.start_date,
                      end: m.end_date,
                      objective: m.objective,
                      sport: m.sport || undefined,
                      volumeTarget: m.volume_target,
                      intensityTarget: m.intensity_target,
                    }))
                : undefined,
              milestones: athleteMilestones.length > 0
                ? athleteMilestones.map((m: any) => ({
                    label: m.label || m.name || "Objectif",
                    targetDate: m.target_date,
                    completed: m.completed || false,
                    type: m.type,
                  }))
                : undefined,
              athleteFcMax: athleteFcMax,
              athleteFcRepos: athleteFcRepos,
              adaptationLevel: (athlete as any)?.adaptation_period_level ?? null,
              currentInjury: currentInjury,
              recentPerformanceTests: recentPerfTests.map((t) => ({
                testType: t.test_type,
                testDate: t.test_date,
                rawValue: t.raw_value,
                vmaEstimated: t.vma_estimated,
                notes: t.notes,
              })),
              renfoSessionCount: sessions.filter((s) => s.session_type === "renfo").length,
              sessions: sessions.filter((s) => s.session_type !== "renfo").map((s) => {
                const exs = sessionExercises[s.id] || [];
                let cardioSummary: string | undefined;
                if (s.session_type === "cardio" && exs.length > 0) {
                  let totalKm = 0;
                  let totalSec = 0;
                  const intensities: number[] = [];
                  for (const ex of exs) {
                    if (!(ex as any).cardio_content) continue;
                    try {
                      const parsed = JSON.parse((ex as any).cardio_content);
                      const data = Array.isArray(parsed) ? { steps: parsed, blocks: [] } : parsed;
                      const m = calculateCardioMetrics(data, athleteVma);
                      totalKm += m.totalDistanceKm;
                      totalSec += m.totalDurationMinutes * 60;
                      if (m.averageIntensity) intensities.push(m.averageIntensity);
                    } catch { /* ignore */ }
                  }
                  const parts: string[] = [];
                  if (totalKm > 0) parts.push(totalKm >= 1 ? `${totalKm.toFixed(1)} km` : `${Math.round(totalKm * 1000)} m`);
                  if (totalSec > 0) parts.push(formatCardioSessionDuration(Math.round(totalSec)));
                  if (intensities.length > 0) {
                    const avg = Math.round(intensities.reduce((a, b) => a + b, 0) / intensities.length);
                    parts.push(`~${avg}% VMA`);
                  }
                  cardioSummary = parts.join(" · ");
                }
                // First exercise that holds cardio_content (or first exercise)
                const cardioEx = exs.find((e: any) => e.cardio_sport || e.cardio_content) ?? exs[0];
                return {
                  name: s.name,
                  type: s.session_type,
                  exerciseCount: exs.length,
                  cardioSummary,
                  sessionId: s.id,
                  exerciseId: cardioEx?.id,
                };
              }),
            };

            const handleApplyCardioFromAI = (sessionId: number, exerciseId: number | undefined, data: import("@/components/CardioStepBuilder").CardioData) => {
              setSessionExercises(prev => {
                const exs = prev[sessionId] || [];
                // Use provided exerciseId, or fall back to first exercise in session
                const targetId = exerciseId ?? exs[0]?.id;
                if (!targetId) return prev; // no exercise to update
                return {
                  ...prev,
                  [sessionId]: exs.map((ex: any) =>
                    ex.id === targetId
                      ? { ...ex, cardio_content: JSON.stringify(data) }
                      : ex
                  ),
                };
              });
            };

            return (
              <CoachCardioAIChat
                open={showCardioAIChat}
                onOpenChange={setShowCardioAIChat}
                context={aiChatContext}
                athleteId={athleteId}
                onApplyToSession={handleApplyCardioFromAI}
              />
            );
          })()}
        </TabsContent>

        <TabsContent value="efforts" className="space-y-4">
          {/* Menu de sélection du type d'effort */}
          <div className="flex flex-wrap gap-2 mb-4">
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
              variant={selectedEffortType === "renfo" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedEffortType("renfo")}
            >
              <Dumbbell className="h-4 w-4 mr-2" />
              Renfo
            </Button>
            <Button
              variant={selectedEffortType === "triathlon" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedEffortType("triathlon")}
            >
              <Activity className="h-4 w-4 mr-2" />
              Triathlon
            </Button>
            <Button
              variant={selectedEffortType === "physio" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedEffortType("physio")}
            >
              <Gauge className="h-4 w-4 mr-2" />
              Physiologie
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
          {selectedEffortType === "physio" && (
            <div className="space-y-4">
              <VmaCard
                athleteId={athleteId!}
                isCoachView={true}
                onVmaUpdate={() => window.location.reload()}
                calibrationTargetWeek={selectedWeekToProgram}
                onTestSessionSent={() => loadWeekFromDB(selectedWeekToProgram.week, selectedWeekToProgram.year)}
              />
              <RaceTimeEstimatesCard athleteId={athleteId!} isCoachView={true} />
              <AerobicEfficiencyCard athleteId={athleteId!} />
            </div>
          )}

          {/* Séances perso */}
          {selectedEffortType !== "physio" && coachCustomSessions.length > 0 && (
            <div className="space-y-3 mt-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Séances personnelles ({coachCustomSessions.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {coachCustomSessions.slice(0, 20).map((cs) => {
                  const dateStr = cs.completed_at ?? cs.scheduled_date;
                  const isCompleted = !!cs.completed_at;
                  return (
                    <div
                      key={cs.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-card cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => isCompleted ? setViewingCoachCustomSession(cs) : setEditingCoachCustomSession(cs)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-sm truncate">{cs.session_name}</span>
                          {cs.cardio_type && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{cs.cardio_type}</Badge>
                          )}
                          {!isCompleted && (
                            <Badge variant="outline" className="text-[10px] border-orange-500 text-orange-600 px-1.5 py-0 h-4">Planifiée</Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {dateStr ? new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : ""}
                          {cs.duration_minutes ? ` · ${cs.duration_minutes} min` : ""}
                          {cs.distance_km ? ` · ${cs.distance_km} km` : ""}
                          {cs.session_rpe ? ` · RPE ${cs.session_rpe}` : ""}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </TabsContent>

        <TabsContent value="max" className="space-y-4">
          <CoachMaxesView
            athleteId={athleteId!}
            athleteName={athlete.first_name || "l'athlète"}
          />
          <PerformanceTestsCard
            athleteId={athleteId!}
            onVmaUpdated={(vma) => setAthleteVma(vma)}
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
            onObjectiveChange={(has, name, deadline) => { setHasMainObjective(has); setMainObjectiveName(name || null); setMainObjectiveDeadline(deadline || null); }}
          />
        </TabsContent>

        <TabsContent value="paiements" className="space-y-4">
          <CoachSubscriptionManager
            athleteId={athleteId!}
            athleteName={`${athlete?.first_name || ""} ${athlete?.last_name || ""}`}
            paymentEnabled={athlete?.payment_enabled || false}
            onPaymentEnabledChange={handleTogglePaymentEnabled}
          />
          <CoachAthleteSubscriptionOverview athleteId={athleteId!} />
        </TabsContent>
      </Tabs>

      {/* Dialog pour adapter les exercices de la méthodologie après copie */}
      <Dialog open={showCopyAdaptDialog} onOpenChange={(open) => { if (!open) { setShowCopyAdaptDialog(false); setPendingCopyData(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Adapter la méthodologie ?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Vous êtes en <strong>Semaine {cycleInfo?.weekInCycle}/{cycleInfo?.weeksPerCycle}</strong> du cycle {cycleInfo?.cycleNum} ({persistentMethodology?.name}).
            </p>
            <p className="text-sm text-muted-foreground">
              Voulez-vous adapter les exercices de la méthodologie avec les paramètres prévus pour cette semaine ? Les autres exercices resteront inchangés.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowCopyAdaptDialog(false); setPendingCopyData(null); }}>
              Non, garder tel quel
            </Button>
            <Button onClick={handleAdaptMethodologyExercises}>
              Oui, adapter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* ── Dialog confirmation suppression mésocycle / microcycle ───── */}
      <AlertDialog open={!!deleteCycleConfirm} onOpenChange={(open) => { if (!open) setDeleteCycleConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce {deleteCycleConfirm?.table === "mesocycles" ? "mésocycle" : "microcycle"} ?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">« {deleteCycleConfirm?.name} »</span> sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingCycle}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingCycle}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteCycleConfirm) return;
                setIsDeletingCycle(true);
                try {
                  const { error } = await supabase.from(deleteCycleConfirm.table).delete().eq("id", deleteCycleConfirm.id);
                  if (error) throw error;
                  // Mise à jour locale
                  if (deleteCycleConfirm.table === "mesocycles") {
                    setAthleteMesocycles(prev => prev.filter(m => m.id !== deleteCycleConfirm.id));
                  } else {
                    setAthleteMicrocycles(prev => prev.filter(m => m.id !== deleteCycleConfirm.id));
                  }
                  toast.success("Cycle supprimé");
                  setDeleteCycleConfirm(null);
                } catch {
                  toast.error("Erreur lors de la suppression");
                } finally {
                  setIsDeletingCycle(false);
                }
              }}
            >
              {isDeletingCycle ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialogs séances perso coach — hors TabsContent pour ne pas bloquer la navigation */}
      <CustomSessionDetailDialog
        session={viewingCoachCustomSession}
        open={!!viewingCoachCustomSession}
        onClose={() => setViewingCoachCustomSession(null)}
        onEdit={() => {
          setEditingCoachCustomSession(viewingCoachCustomSession);
          setViewingCoachCustomSession(null);
        }}
        fcMax={athleteFcMax}
        fcRepos={athleteFcRepos}
      />
      {editingCoachCustomSession && (
        <CustomSessionDialog
          editSession={editingCoachCustomSession}
          onClose={() => setEditingCoachCustomSession(null)}
          onSessionCreated={() => {
            setEditingCoachCustomSession(null);
            loadCoachCustomSessions();
          }}
          hideTrigger
        />
      )}
    </div>
  );
}
