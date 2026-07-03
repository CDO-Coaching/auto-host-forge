/**
 * DesktopProgView — Two-column desktop programming interface.
 *
 * Left panel  : compact session list + quick-create buttons + copy-week actions.
 * Right panel : full exercise editor for the selected session.
 * Toolbar     : arrow-based week navigation + validate / undo / copy / méthodo.
 *
 * All exercise logic (handlers, state) lives in ClientDetail.tsx and is
 * threaded through props. This component is purely presentational.
 */

import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Check,
  Copy,
  MessageSquare,
  GripVertical,
  Dumbbell,
  Activity,
  BookOpen,
  Undo2,
  Search,
  Video,
  X,
  ChevronDown,
  Minus,
  Link2,
  Unlink2,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExerciseCombobox } from "@/components/ExerciseCombobox";
import { CardioStepBuilder, CardioData } from "@/components/CardioStepBuilder";
import { parseDurationInput } from "@/lib/formatDuration";
import { VoiceCommandButton } from "@/components/VoiceCommandButton";
import { calculateSessionDuration, formatSessionDuration } from "@/lib/sessionDurationCalculator";
import {
  calculateCardioMetrics,
  formatCardioSessionDuration,
} from "@/lib/cardioCalculations";
import { formatWeekRange } from "@/lib/weekUtils";
import { HeartRateZonesBar } from "@/components/HeartRateZonesBar";
import { RunSessionAnalysis } from "@/components/RunSessionAnalysis";

// ── Local types (mirror ClientDetail) ────────────────────────────────────────
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
  super_set_group?: string | null;
  per_side?: boolean;
  is_unilateral?: boolean;
  is_duration?: boolean;
  is_distance?: boolean;
  request_video?: boolean;
  request_activity_link?: boolean;
  serie_details?: SerieDetail[] | string;
}
// ── AMRAP helpers ─────────────────────────────────────────────────────────────
/** Returns duration in seconds if series is in AMRAP format, else null. */
function parseAmrap(series: string | undefined): number | null {
  if (!series) return null;
  const m = String(series).match(/^amrap:(\d+)$/);
  return m ? parseInt(m[1]) : null;
}
function formatAmrapDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h${m > 0 ? `${m.toString().padStart(2, "0")}min` : ""}`;
  if (s > 0) return `${m}min ${s}s`;
  return `${m} min`;
}

// ── SeriesStepper — defined at module level so React identity is stable ───────
interface StepperProps {
  sessionId: number;
  exercise: Exercise;
  compact?: boolean;
  isValidated: boolean;
  onExerciseChange: (sessionId: number, exerciseId: number, field: string, value: string) => void;
  onAddExercise: (sessionId: number) => void;
}

function SeriesStepper({
  sessionId, exercise, compact = false,
  isValidated, onExerciseChange, onAddExercise,
}: StepperProps) {
  const count = parseAmrap(exercise.series) !== null ? 0 : (parseInt(exercise.series) || 0);
  const btnCls = compact ? "h-6 w-6 p-0 rounded-sm" : "h-7 w-7 p-0";
  const spanCls = compact
    ? "text-xs font-semibold w-5 text-center tabular-nums"
    : "text-sm font-semibold w-6 text-center tabular-nums select-none";

  const decrement = () => {
    if (!isValidated && count > 1)
      onExerciseChange(sessionId, exercise.id, "series", String(count - 1));
  };
  const increment = () => {
    if (!isValidated && count < 10)
      onExerciseChange(sessionId, exercise.id, "series", String(count + 1));
  };

  return (
    <div
      className="flex items-center gap-0.5 rounded-md"
      tabIndex={isValidated ? -1 : 0}
      data-session={sessionId}
      data-exercise={exercise.id}
      data-field="series"
      onKeyDown={(e) => {
        if (isValidated) return;
        if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); increment(); }
        else if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); decrement(); }
        else if (e.key === "Enter") { e.preventDefault(); onAddExercise(sessionId); }
      }}
      onFocus={(e) => { e.currentTarget.style.outline = "2px solid hsl(var(--ring))"; e.currentTarget.style.outlineOffset = "2px"; }}
      onBlur={(e) => { e.currentTarget.style.outline = ""; e.currentTarget.style.outlineOffset = ""; }}
    >
      <Button
        variant="ghost" size="sm" className={btnCls}
        disabled={isValidated || count <= 1}
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={decrement}
      >
        <Minus className="h-3 w-3" />
      </Button>
      <span className={spanCls}>{count > 0 ? count : "—"}</span>
      <Button
        variant="ghost" size="sm" className={btnCls}
        disabled={isValidated || count >= 10}
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={increment}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}

interface Session {
  id: number;
  name: string;
  isExpanded: boolean;
  session_type: "renfo" | "cardio" | "recup";
}

function getSerieDetailsArray(value: any): SerieDetail[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const p = JSON.parse(value);
      return Array.isArray(p) ? p : [];
    } catch { return []; }
  }
  return [];
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface DesktopProgViewProps {
  // Data
  sessions: Session[];
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
  sessionExercises: Record<number, Exercise[]>;
  selectedWeek: { week: number; year: number };
  availableWeeks: Array<{ week: number; year: number; monday: Date }>;
  isValidated: boolean;
  libraryExercises: Array<{ id: string; name: string; unilateral?: boolean; category?: string }>;
  undoStack: Array<unknown>;
  expandedSessionId: number | null;
  setExpandedSessionId: React.Dispatch<React.SetStateAction<number | null>>;

  // Week / save
  onWeekChange: (week: number, year: number) => void;
  onSave: () => void;
  onUndo: () => void;
  onUnvalidate?: () => void;

  // Autorisation sportif d'ajouter des exercices (réglage par athlète, persistant)
  allowAddExercises?: boolean;
  onToggleAllowAddExercises?: (value: boolean) => void;

  // Session CRUD
  onCreateSession: (type: "renfo" | "cardio" | "recup") => void;
  onDeleteSession: (id: number, e: React.MouseEvent) => void;

  // Exercise CRUD
  onAddExercise: (sessionId: number) => void;
  onDeleteExercise: (sessionId: number, exerciseId: number) => void;
  onExerciseChange: (sessionId: number, exerciseId: number, field: string, value: any) => void;
  onSerieDetailChange: (sessionId: number, exerciseId: number, si: number, field: string, value: string) => void;
  onKeyDown: (e: React.KeyboardEvent, sessionId: number, exerciseId: number, field: string) => void;
  setSessionExercises: React.Dispatch<React.SetStateAction<Record<number, Exercise[]>>>;

  // Drag & drop
  onSessionDragStart: (id: number) => void;
  onSessionDragOver: (e: React.DragEvent, id: number) => void;
  onSessionDrop: (e: React.DragEvent, id: number) => void;
  onExerciseDragStart: (sessionId: number, exerciseId: number) => void;
  onExerciseDragOver: (e: React.DragEvent) => void;
  onExerciseDrop: (e: React.DragEvent, sessionId: number, exerciseId: number) => void;

  // Series collapse state
  collapsedSeriesExercises: Record<string, boolean>;
  setCollapsedSeriesExercises: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

  // Auto-open exercise combobox
  autoOpenExercise: { sessionId: number; exerciseId: number } | null;
  setAutoOpenExercise: (v: { sessionId: number; exerciseId: number } | null) => void;

  // Feedback display
  copiedWeekFeedback: Record<string, {
    sportif_rpe?: string | null;
    sportif_comment?: string | null;
    skipped?: boolean;
    serie_rpe_details?: { rpe: number | null; actual_reps?: string | null; actual_charge?: string | null; modification_type?: "failure" | "too_easy" | null }[] | null;
  }>;
  setCopiedWeekFeedback: React.Dispatch<React.SetStateAction<any>>;
  getExerciseFeedback: (sessionId: number, name: string) => any;

  // % suggestions
  getPercentSuggestion: (charge: string, name: string) => string | null;
  chargeSuggestions: Record<string, Record<string, string>>;
  serieChargeSuggestions: Record<string, string>;
  isInSameGroup: (sessionId: number, a: number, b: number) => boolean;

  // Cardio
  athleteVma: number | null;
  selectedCardioSport: "course" | "velo" | "natation";
  setSelectedCardioSport: (s: "course" | "velo" | "natation") => void;
  showTemplateSelector: boolean;
  setShowTemplateSelector: (v: boolean) => void;
  showRenfoTemplateSelector: number | null;
  setShowRenfoTemplateSelector: (v: number | null) => void;
  templateSearchQuery: string;
  setTemplateSearchQuery: (v: string) => void;
  filteredCardioTemplates: Array<{ id: string; name: string }>;
  filteredRenfoTemplates: Array<{ id: string; name: string }>;
  handleImportTemplateToSession: (templateId: string, sessionId: number, exerciseId: number) => void;
  handleImportRenfoTemplateToSession: (templateId: string, sessionId: number) => void;
  handleVoiceApply: (sessionId: number, exerciseId: number, changes: any, seriesOverrides: any) => void;
  handleVoiceAddExercise: (sessionId: number, name: string, changes: any) => void;

  // History / copy
  historicalWeeks: unknown[];
  handleCopyPreviousWeek: () => void;
  setShowCopyDialog: (v: boolean) => void;

  // All training weeks (for visual indicators)
  allTrainingWeeks?: Array<{ week_number: number; year: number; validated: boolean }>;
  isLoadingWeek?: boolean;

  // Multi-week
  multiWeekMode: boolean;
  multiWeekCurrent: number;
  multiWeekTotal: number;
  setMultiWeekMode: (v: boolean) => void;
  setMultiWeekTotal: (v: number) => void;
  setMultiWeekCurrent: (v: number) => void;
  setMultiWeekStartWeek: (v: { week: number; year: number } | null) => void;

  // Cycle / methodology display
  cycleInfo: { cycleNum: number; weekInCycle: number; weeksPerCycle: number; methodologyName: string } | null;
  persistentMethodology: any;
  persistentMaxes: Record<string, { exercise_name: string; reference_max: number }>;
  lastWeekData: any;
  setShowFeedbackSheet: (v: boolean) => void;

  // Athlete milestones
  athleteMilestones: Array<{ id: string; label: string; target_date: string; completed: boolean }>;

  // Récup options
  recuperationOptions: Array<{ value: string; label: string }>;

  // Séances perso de l'athlète
  customSessions?: any[];

  // FCR Karvonen pour redistribution des zones FC
  athleteFcMax?: number | null;
  athleteFcRepos?: number | null;

  // Exercise creation
  onExerciseCreated: (ex: { id: string; name: string; muscle_principal?: string | null; muscles_second?: string[] | null }) => void;

  // Super-set
  onToggleSuperSet: (sessionId: number, exerciseId: number) => void;

  // Methodology dialog
  onCancelMethodology: () => void;
  loadMethodologiesForAssignment: () => void;
  setShowMethodologyDialog: (v: boolean) => void;
  setSelectedMethodologyId: (v: string) => void;
  setSelectedMethodologyWeek: (v: number) => void;
  setSelectedMethodologyCycle: (v: number) => void;
  setMethodologyStep: (v: "select" | "maxes") => void;
  setMethodologyMaxes: (v: any) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function DesktopProgView(props: DesktopProgViewProps) {
  const {
    sessions, setSessions, sessionExercises, setSessionExercises,
    selectedWeek, availableWeeks, isValidated, libraryExercises,
    expandedSessionId, setExpandedSessionId,
    undoStack, onWeekChange, onSave, onUndo, onUnvalidate,
    allowAddExercises, onToggleAllowAddExercises,
    onCreateSession, onDeleteSession,
    onAddExercise, onDeleteExercise, onExerciseChange, onSerieDetailChange, onKeyDown,
    onSessionDragStart, onSessionDragOver, onSessionDrop,
    onExerciseDragStart, onExerciseDragOver, onExerciseDrop,
    collapsedSeriesExercises, setCollapsedSeriesExercises,
    autoOpenExercise, setAutoOpenExercise,
    copiedWeekFeedback, setCopiedWeekFeedback, getExerciseFeedback,
    getPercentSuggestion, chargeSuggestions, serieChargeSuggestions, isInSameGroup,
    athleteVma, selectedCardioSport, setSelectedCardioSport,
    showTemplateSelector, setShowTemplateSelector,
    showRenfoTemplateSelector, setShowRenfoTemplateSelector,
    templateSearchQuery, setTemplateSearchQuery,
    filteredCardioTemplates, filteredRenfoTemplates,
    handleImportTemplateToSession, handleImportRenfoTemplateToSession,
    handleVoiceApply, handleVoiceAddExercise,
    historicalWeeks, handleCopyPreviousWeek, setShowCopyDialog,
    multiWeekMode, multiWeekCurrent, multiWeekTotal,
    setMultiWeekMode, setMultiWeekTotal, setMultiWeekCurrent, setMultiWeekStartWeek,
    cycleInfo, persistentMethodology, persistentMaxes,
    lastWeekData, setShowFeedbackSheet,
    athleteMilestones, recuperationOptions,
    onExerciseCreated,
    onToggleSuperSet,
    onCancelMethodology, loadMethodologiesForAssignment, setShowMethodologyDialog,
    setSelectedMethodologyId, setSelectedMethodologyWeek,
    setSelectedMethodologyCycle, setMethodologyStep, setMethodologyMaxes,
    allTrainingWeeks = [], isLoadingWeek = false,
    customSessions = [],
    athleteFcMax = null,
    athleteFcRepos = null,
  } = props;

  const [selectedCustomSessionId, setSelectedCustomSessionId] = React.useState<string | null>(null);

  const selectedSession = sessions.find((s) => s.id === expandedSessionId) ?? null;
  const selectedCustomSession = customSessions.find((s) => s.id === selectedCustomSessionId) ?? null;

  // Filtre les séances perso de la semaine sélectionnée
  const weekCustomSessions = React.useMemo(() => {
    if (!customSessions.length) return [];
    // Calcul lundi/dimanche de la semaine sélectionnée
    const jan4 = new Date(selectedWeek.year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - dayOfWeek + 1 + (selectedWeek.week - 1) * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return customSessions.filter((cs) => {
      const d = new Date(cs.scheduled_date || cs.completed_at);
      return d >= monday && d <= sunday;
    });
  }, [customSessions, selectedWeek]);

  // ── Week arrow navigation ─────────────────────────────────────────────────
  const goToPrevWeek = () => {
    let { week, year } = selectedWeek;
    week--;
    if (week < 1) { year--; week = 52; }
    onWeekChange(week, year);
  };
  const goToNextWeek = () => {
    let { week, year } = selectedWeek;
    week++;
    if (week > 52) { year++; week = 1; }
    onWeekChange(week, year);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const weekMonday = availableWeeks.find(
    (w) => w.week === selectedWeek.week && w.year === selectedWeek.year,
  )?.monday;

  const sessionTypeLabel = (type: Session["session_type"]) =>
    type === "cardio" ? "🏃 Cardio" : type === "recup" ? "💆 Récup" : "💪 Renfo";

  const sessionDuration = (s: Session) => {
    const exs = sessionExercises[s.id] ?? [];
    if (s.session_type === "renfo" && exs.length > 0)
      return formatSessionDuration(calculateSessionDuration(exs));
    if (s.session_type === "cardio" && exs.length > 0) {
      let totalSec = 0;
      for (const ex of exs) {
        if (!ex.cardio_content) continue;
        try {
          const parsed = JSON.parse(ex.cardio_content);
          const data = Array.isArray(parsed) ? { steps: parsed, blocks: [] } : parsed;
          totalSec += calculateCardioMetrics(data, athleteVma).totalDurationMinutes * 60;
        } catch { /* ignore */ }
      }
      if (totalSec > 0) return formatCardioSessionDuration(Math.round(totalSec));
    }
    return null;
  };

  const sessionDistance = (s: Session) => {
    if (s.session_type !== "cardio") return null;
    const exs = sessionExercises[s.id] ?? [];
    let totalKm = 0;
    for (const ex of exs) {
      if (!ex.cardio_content) continue;
      try {
        const parsed = JSON.parse(ex.cardio_content);
        const data = Array.isArray(parsed) ? { steps: parsed, blocks: [] } : parsed;
        totalKm += calculateCardioMetrics(data, athleteVma).totalDistanceKm;
      } catch { /* ignore */ }
    }
    if (totalKm <= 0) return null;
    return totalKm >= 1
      ? `${totalKm.toFixed(1)} km`
      : `${Math.round(totalKm * 1000)} m`;
  };

  // ── Inline feedback display (closure over copiedWeekFeedback) ─────────────
  const FeedbackBadge = ({ sessionId, exerciceName, series }: { sessionId: number; exerciceName: string; series?: string }) => {
    const fb = getExerciseFeedback(sessionId, exerciceName);
    if (!fb) return null;
    const isAmrapEx = parseAmrap(series) !== null;
    const tours = isAmrapEx ? (fb.serie_rpe_details?.length ?? 0) : 0;
    return (
      <div className="text-[10px] bg-muted/50 rounded px-1.5 py-0.5 mt-0.5 border-l-2 border-primary/50">
        {fb.skipped ? (
          <span className="text-destructive font-medium">⚠️ Non fait</span>
        ) : (
          <div className="flex flex-wrap gap-x-2 text-muted-foreground">
            {isAmrapEx && tours > 0 && <span className="font-bold text-primary">⏱ {tours} tour{tours > 1 ? "s" : ""}</span>}
            {fb.sportif_rpe && <span>RPE: <span className="font-medium text-foreground">{fb.sportif_rpe}</span></span>}
            {fb.sportif_comment && <span className="italic">"{fb.sportif_comment}"</span>}
          </div>
        )}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ── TOOLBAR ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Week arrows */}
        <div className="flex items-center gap-1 bg-muted/40 rounded-lg px-1 py-0.5">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={goToPrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col items-center min-w-[180px]">
            <span className="text-sm font-semibold">
              S.{selectedWeek.week} {weekMonday ? `— ${formatWeekRange(weekMonday)}` : `/ ${selectedWeek.year}`}
            </span>
            {(() => {
              const dbWeek = allTrainingWeeks.find(
                (w) => w.week_number === selectedWeek.week && w.year === selectedWeek.year
              );
              if (isLoadingWeek) return <span className="text-[10px] text-muted-foreground animate-pulse">Chargement…</span>;
              if (dbWeek?.validated) return <span className="text-[10px] text-emerald-600 font-medium">✓ Validée</span>;
              if (dbWeek) return <span className="text-[10px] text-amber-500 font-medium">● En cours</span>;
              return <span className="text-[10px] text-muted-foreground">Vide</span>;
            })()}
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={goToNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Cycle badge */}
        {cycleInfo && (
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[10px] border-primary/50 text-primary font-medium">
              {persistentMethodology?.name} — C{cycleInfo.cycleNum} · S{cycleInfo.weekInCycle}/{cycleInfo.weeksPerCycle}
            </Badge>
            {!isValidated && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-muted-foreground/50 hover:text-destructive"
                onClick={onCancelMethodology}
                title="Retirer la méthodologie"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}

        <div className="flex-1" />

        {/* Copy previous */}
        {!isValidated && historicalWeeks.length > 0 && (
          <>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleCopyPreviousWeek}>
              <Copy className="h-3.5 w-3.5 mr-1" />Copier précédente
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowCopyDialog(true)}>
              <Copy className="h-3.5 w-3.5 mr-1" />Autre semaine
            </Button>
          </>
        )}

        {/* Methodology */}
        {!isValidated && (
          <Button
            variant="outline" size="sm" className="h-8 text-xs"
            onClick={() => {
              loadMethodologiesForAssignment();
              setShowMethodologyDialog(true);
              setSelectedMethodologyId("");
              setSelectedMethodologyWeek(1);
              setSelectedMethodologyCycle(0);
              setMethodologyStep("select");
              setMethodologyMaxes({});
            }}
          >
            <BookOpen className="h-3.5 w-3.5 mr-1" />Méthodo
          </Button>
        )}

        {/* Undo */}
        {undoStack.length > 0 && !isValidated && (
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onUndo}>
            <Undo2 className="h-3.5 w-3.5 mr-1" />Annuler
          </Button>
        )}

        {/* Unvalidate */}
        {isValidated && onUnvalidate && (
          <Button size="sm" variant="outline" className="h-8 text-xs border-amber-500/50 text-amber-500 hover:bg-amber-500/10" onClick={onUnvalidate}>
            <Undo2 className="h-3.5 w-3.5 mr-1" />
            Modifier la semaine
          </Button>
        )}

        {/* Autorisation sportif : ajouter des exercices */}
        {onToggleAllowAddExercises && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none ml-1">
            <Checkbox checked={!!allowAddExercises} onCheckedChange={(v) => onToggleAllowAddExercises(!!v)} />
            Sportif peut ajouter des exercices
          </label>
        )}

        {/* Validate */}
        {sessions.length > 0 && !isValidated && (
          <Button size="sm" className="h-8 text-xs" onClick={onSave}>
            <Check className="h-3.5 w-3.5 mr-1" />
            {multiWeekMode
              ? multiWeekCurrent < multiWeekTotal
                ? `Valider S${selectedWeek.week} → Suivante`
                : `Valider S${selectedWeek.week} (dernière)`
              : "Valider"}
          </Button>
        )}
      </div>

      {/* Multi-week progress */}
      {multiWeekMode && (
        <div className="flex items-center gap-3 p-2 rounded-lg bg-accent/30 border text-xs">
          <Checkbox
            id="mw-mode-dpv"
            checked={multiWeekMode}
            onCheckedChange={(c) => {
              const on = c === true;
              setMultiWeekMode(on);
              if (on) { setMultiWeekStartWeek(selectedWeek); setMultiWeekCurrent(1); }
              else { setMultiWeekStartWeek(null); setMultiWeekCurrent(1); }
            }}
            disabled={multiWeekMode && multiWeekCurrent > 1}
          />
          <label htmlFor="mw-mode-dpv" className="text-muted-foreground cursor-pointer">
            Multi-semaines
          </label>
          <select
            className="p-1 border rounded bg-background text-foreground text-xs w-14 focus:ring-primary focus:ring-2 focus:outline-none"
            value={multiWeekTotal}
            onChange={(e) => setMultiWeekTotal(Number(e.target.value))}
            disabled={multiWeekCurrent > 1}
          >
            {[2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <Badge variant="outline" className="text-[10px]">{multiWeekCurrent}/{multiWeekTotal}</Badge>
          {multiWeekCurrent > 1 && (
            <Button
              variant="ghost" size="sm" className="h-6 text-xs text-destructive ml-auto"
              onClick={() => { setMultiWeekMode(false); setMultiWeekCurrent(1); setMultiWeekStartWeek(null); }}
            >
              <X className="h-3 w-3 mr-1" />Arrêter
            </Button>
          )}
        </div>
      )}

      {/* Copied-week feedback banner */}
      {Object.keys(copiedWeekFeedback).length > 0 && (
        <div className="flex items-center gap-2 p-2 bg-primary/10 border border-primary/20 rounded-md text-xs">
          <MessageSquare className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-muted-foreground">Retours de la semaine copiée affichés sous chaque exercice</span>
          <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-xs" onClick={() => setCopiedWeekFeedback({})}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* ── TWO-COLUMN LAYOUT ─────────────────────────────────────────────── */}
      <div className="flex gap-3 min-h-[500px]">

        {/* LEFT PANEL — session list ─────────────────────────────────────── */}
        <div className="w-52 flex-shrink-0 flex flex-col gap-2">

          {/* Quick-create buttons */}
          {!isValidated && (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs px-1" onClick={() => onCreateSession("renfo")}>
                <Plus className="h-3 w-3 mr-0.5" />Renfo
              </Button>
              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs px-1" onClick={() => onCreateSession("cardio")}>
                <Plus className="h-3 w-3 mr-0.5" />Cardio
              </Button>
              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs px-1" onClick={() => onCreateSession("recup")}>
                <Plus className="h-3 w-3 mr-0.5" />Récup
              </Button>
            </div>
          )}

          {/* Session cards */}
          {sessions.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center text-muted-foreground py-8 px-2">
              <div>
                <Dumbbell className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs">Aucune séance.</p>
                {!isValidated && <p className="text-[10px] mt-1">Clique sur + pour commencer</p>}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[calc(100vh-360px)] pr-0.5 smooth-scroll">
              {sessions.map((session) => {
                const dur = sessionDuration(session);
                const dist = sessionDistance(session);
                const exs = sessionExercises[session.id] ?? [];
                const exCount = exs.length;
                const isSelected = expandedSessionId === session.id;

                // Completion status from athlete data (direct exercise fields)
                const completionStatus: "none" | "partial" | "full" = (() => {
                  if (exCount === 0) return "none";
                  const doneCount = exs.filter((ex: any) =>
                    ex.skipped === true ||
                    ex.sportif_rpe != null ||
                    ex.actual_distance_km != null ||
                    ex.actual_duration_minutes != null ||
                    ex.actual_pace_min_per_km != null ||
                    ex.actual_avg_heart_rate != null
                  ).length;
                  if (doneCount === 0) return "none";
                  if (doneCount === exCount) return "full";
                  return "partial";
                })();

                const statusDot =
                  completionStatus === "full"
                    ? "bg-emerald-500"
                    : completionStatus === "partial"
                    ? "bg-amber-400"
                    : "bg-muted-foreground/30";

                return (
                  <div
                    key={session.id}
                    className={`rounded-lg border p-2 cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? "border-primary bg-primary/8 shadow-sm"
                        : "border-border/50 bg-card/40 hover:border-primary/40 hover:bg-muted/30"
                    }`}
                    onClick={() => { setExpandedSessionId(isSelected ? null : session.id); setSelectedCustomSessionId(null); }}
                    draggable={!isValidated}
                    onDragStart={() => onSessionDragStart(session.id)}
                    onDragOver={(e) => onSessionDragOver(e, session.id)}
                    onDrop={(e) => onSessionDrop(e, session.id)}
                  >
                    <div className="flex items-start gap-1.5">
                      {/* Completion dot */}
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${statusDot}`}
                        title={
                          completionStatus === "full"
                            ? "Séance terminée"
                            : completionStatus === "partial"
                            ? "Séance partiellement faite"
                            : "Non effectuée"
                        }
                      />
                      {!isValidated && (
                        <GripVertical className="h-3.5 w-3.5 mt-1 text-muted-foreground cursor-grab flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        {!isValidated ? (
                          <Input
                            value={session.name}
                            onChange={(e) => {
                              e.stopPropagation();
                              setSessions((prev) =>
                                prev.map((s) => s.id === session.id ? { ...s, name: e.target.value } : s),
                              );
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-6 text-xs font-medium border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 w-full"
                            placeholder="Nom séance"
                          />
                        ) : (
                          <span className="text-xs font-medium truncate block">{session.name}</span>
                        )}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge
                            variant={isSelected ? "default" : "secondary"}
                            className="text-[9px] px-1 py-0"
                          >
                            {sessionTypeLabel(session.session_type)}
                          </Badge>
                          <span className="text-[9px] text-muted-foreground">
                            {exCount} ex{dur ? ` · ${dur}` : ""}{dist ? ` · ${dist}` : ""}
                          </span>
                        </div>
                      </div>
                      {!isValidated && (
                        <Button
                          variant="ghost" size="sm"
                          className="h-5 w-5 p-0 text-destructive hover:bg-destructive/10 flex-shrink-0 mt-0.5"
                          onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id, e); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Séances perso de l'athlète */}
          {weekCustomSessions.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border/40">
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-0.5">
                Séances perso
              </p>
              <div className="flex flex-col gap-1.5">
                {weekCustomSessions.map((cs) => {
                  const isSelected = selectedCustomSessionId === cs.id;
                  const sportLabel = cs.cardio_type === "course" ? "🏃 Course"
                    : cs.cardio_type === "velo" ? "🚴 Vélo"
                    : cs.cardio_type === "natation" ? "🏊 Natation"
                    : "Perso";
                  return (
                    <div
                      key={cs.id}
                      className={`rounded-lg border p-2 cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? "border-[#FC4C02]/60 bg-[#FC4C02]/10 shadow-sm"
                          : "border-border/50 bg-card/40 hover:border-[#FC4C02]/30 hover:bg-muted/30"
                      }`}
                      onClick={() => {
                        setSelectedCustomSessionId(isSelected ? null : cs.id);
                        setExpandedSessionId(null);
                      }}
                    >
                      <div className="flex items-start gap-1.5">
                        <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5 bg-emerald-500" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium truncate block">{cs.session_name}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-[#FC4C02]/15 text-[#FC4C02] border-none">
                              {sportLabel}
                            </Badge>
                            <span className="text-[9px] text-muted-foreground">
                              {cs.duration_minutes ? `${cs.duration_minutes} min` : ""}
                              {cs.distance_km ? ` · ${cs.distance_km} km` : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Validated message */}
          {isValidated && (
            <div className="p-2 bg-primary/10 border border-primary/20 rounded-md text-xs text-primary font-medium">
              ✓ Semaine validée
            </div>
          )}
        </div>

        {/* RIGHT PANEL — exercise editor ──────────────────────────────────── */}
        <div className="flex-1 min-w-0 rounded-lg border border-border/40 bg-card/20 overflow-hidden flex flex-col">

          {selectedCustomSession ? (
            /* Détail d'une séance perso */
            <div className="flex-1 p-5 space-y-4 overflow-y-auto">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-[#FC4C02] flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.599h4.172L10.463 0l-7 13.828h4.169" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-base">{selectedCustomSession.session_name}</h3>
                  <p className="text-xs text-muted-foreground">Séance personnalisée de l'athlète</p>
                </div>
              </div>

              {/* Date */}
              <div className="rounded-lg bg-muted/30 border border-border/40 p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">
                    {new Date(selectedCustomSession.scheduled_date || selectedCustomSession.completed_at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  </span>
                </div>
                {selectedCustomSession.cardio_type && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Type</span>
                    <Badge className="bg-[#FC4C02]/15 text-[#FC4C02] border-[#FC4C02]/30 text-xs">
                      {selectedCustomSession.cardio_type === "course" ? "🏃 Course"
                        : selectedCustomSession.cardio_type === "velo" ? "🚴 Vélo"
                        : selectedCustomSession.cardio_type === "natation" ? "🏊 Natation"
                        : selectedCustomSession.cardio_type}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Données de performance */}
              <div className="rounded-lg bg-muted/30 border border-border/40 p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Données</p>
                {selectedCustomSession.duration_minutes && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">⏱ Durée</span>
                    <span className="font-medium">{selectedCustomSession.duration_minutes} min</span>
                  </div>
                )}
                {selectedCustomSession.distance_km && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">📍 Distance</span>
                    <span className="font-medium">
                      {selectedCustomSession.distance_km} {selectedCustomSession.cardio_type === "natation" ? "m" : "km"}
                    </span>
                  </div>
                )}
                {selectedCustomSession.avg_pace && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {selectedCustomSession.cardio_type === "velo" ? "🚴 Vitesse" : selectedCustomSession.cardio_type === "natation" ? "🏊 Allure" : "🏃 Allure"}
                    </span>
                    <span className="font-medium">
                      {selectedCustomSession.avg_pace}
                      {selectedCustomSession.cardio_type === "velo" ? " km/h" : selectedCustomSession.cardio_type === "natation" ? " /100m" : " /km"}
                    </span>
                  </div>
                )}
                {selectedCustomSession.avg_heart_rate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">❤️ FC moyenne</span>
                    <span className="font-medium">{selectedCustomSession.avg_heart_rate} bpm</span>
                  </div>
                )}
                {selectedCustomSession.max_heart_rate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">❤️ FC max</span>
                    <span className="font-medium">{selectedCustomSession.max_heart_rate} bpm</span>
                  </div>
                )}
                {selectedCustomSession.cadence && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">👟 Cadence</span>
                    <span className="font-medium">{selectedCustomSession.cadence} spm</span>
                  </div>
                )}
                {selectedCustomSession.calories && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">🔥 Calories</span>
                    <span className="font-medium">{selectedCustomSession.calories} kcal</span>
                  </div>
                )}
                {selectedCustomSession.elevation_gain > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">⛰ Dénivelé</span>
                    <span className="font-medium">{selectedCustomSession.elevation_gain} m</span>
                  </div>
                )}
                {selectedCustomSession.session_rpe && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">⚡ RPE ressenti</span>
                    <span className="font-medium">
                      {selectedCustomSession.session_rpe}/10
                      <span className="text-muted-foreground text-xs ml-2">
                        {selectedCustomSession.session_rpe <= 3 ? "Facile 🟢"
                          : selectedCustomSession.session_rpe <= 6 ? "Modéré 🟡"
                          : selectedCustomSession.session_rpe <= 8 ? "Difficile 🟠"
                          : "Très difficile 🔴"}
                      </span>
                    </span>
                  </div>
                )}
                {!selectedCustomSession.duration_minutes && !selectedCustomSession.distance_km && (
                  <p className="text-xs text-muted-foreground">Aucune donnée enregistrée</p>
                )}
              </div>

              {/* Zones FC */}
              {selectedCustomSession.heart_rate_zones && Array.isArray(selectedCustomSession.heart_rate_zones) && selectedCustomSession.heart_rate_zones.length > 0 && (
                <div className="rounded-lg bg-muted/30 border border-border/40 p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Zones de fréquence cardiaque</p>
                  <HeartRateZonesBar zones={selectedCustomSession.heart_rate_zones} fcMax={athleteFcMax} fcRepos={athleteFcRepos} />
                </div>
              )}

              {/* Commentaire */}
              {selectedCustomSession.description && (
                <div className="rounded-lg bg-muted/30 border border-border/40 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Résumé</p>
                  <p className="text-sm italic text-foreground/80">{selectedCustomSession.description}</p>
                </div>
              )}
            </div>
          ) : !selectedSession ? (
            /* Empty state */
            <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
              <div>
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Sélectionne une séance</p>
                <p className="text-xs mt-1 opacity-70">dans le panel de gauche</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Session header */}
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border/40 bg-muted/20 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {sessionTypeLabel(selectedSession.session_type)}
                  </Badge>
                  {selectedSession.session_type === "renfo" && (sessionExercises[selectedSession.id]?.length ?? 0) > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {formatSessionDuration(calculateSessionDuration(sessionExercises[selectedSession.id] ?? []))}
                    </span>
                  )}
                  {cycleInfo && persistentMaxes && Object.keys(persistentMaxes).length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {Object.values(persistentMaxes).map((m: any) => (
                        <Badge key={m.exercise_name} variant="secondary" className="text-[9px] font-normal">
                          {m.exercise_name}: {m.reference_max}kg
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {/* Voice */}
                  {!isValidated && selectedSession.session_type === "renfo" && (
                    <VoiceCommandButton
                      exercises={(sessionExercises[selectedSession.id] ?? []).map((ex) => ({
                        id: ex.id,
                        name: ex.exercice,
                        charge: ex.charge,
                        reps: ex.reps,
                        series: ex.series,
                        rpe: ex.rpe,
                        recuperation: ex.recuperation,
                        tempo: ex.tempo,
                      }))}
                      onApply={(exerciseId, changes, seriesOverrides) =>
                        handleVoiceApply(selectedSession.id, exerciseId, changes, seriesOverrides)
                      }
                      onAddExercise={(name, changes) =>
                        handleVoiceAddExercise(selectedSession.id, name, changes)
                      }
                      onDeleteExercise={(exerciseId) =>
                        onDeleteExercise(selectedSession.id, exerciseId)
                      }
                    />
                  )}
                  {/* Import renfo template */}
                  {!isValidated && selectedSession.session_type === "renfo" && (
                    <Dialog
                      open={showRenfoTemplateSelector === selectedSession.id}
                      onOpenChange={(open) => {
                        setShowRenfoTemplateSelector(open ? selectedSession.id : null);
                        if (!open) setTemplateSearchQuery("");
                      }}
                    >
                      <Button
                        variant="outline" size="sm" className="h-7 text-xs"
                        onClick={() => { setShowRenfoTemplateSelector(selectedSession.id); setTemplateSearchQuery(""); }}
                      >
                        <Copy className="h-3 w-3 mr-1" />Importer
                      </Button>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Importer une séance programmée</DialogTitle>
                          <DialogDescription>Sélectionnez une séance pour remplacer le contenu actuel</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Rechercher..." value={templateSearchQuery} onChange={(e) => setTemplateSearchQuery(e.target.value)} className="pl-9" />
                          </div>
                          <div className="max-h-60 overflow-y-auto space-y-2">
                            {filteredRenfoTemplates.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">Aucune séance programmée</p>
                            ) : filteredRenfoTemplates.map((t) => (
                              <Button key={t.id} variant="outline" size="sm" className="w-full justify-start h-auto py-2 px-3 text-left"
                                onClick={() => handleImportRenfoTemplateToSession(t.id, selectedSession.id)}>
                                <span className="truncate">{t.name}</span>
                              </Button>
                            ))}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>

              {/* Exercise content */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">

                {/* ── CARDIO ─────────────────────────────────────────────── */}
                {selectedSession.session_type === "cardio" && (
                  <>
                    {(sessionExercises[selectedSession.id] ?? []).map((exercise) => {
                      let cardioData: CardioData = { steps: [], blocks: [] };
                      try {
                        const parsed = exercise.cardio_content ? JSON.parse(exercise.cardio_content) : { steps: [], blocks: [] };
                        cardioData = Array.isArray(parsed) ? { steps: parsed, blocks: [] } : parsed;
                      } catch { /* ignore */ }

                      const currentSportType = (["velo", "natation", "course"] as const).includes(exercise.cardio_sport as any)
                        ? exercise.cardio_sport as "course" | "velo" | "natation"
                        : "course";

                      return (
                        <div key={exercise.id} className="space-y-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <label className="text-sm font-medium">Type de sport :</label>
                            <Select
                              value={currentSportType}
                              onValueChange={(value: "course" | "velo" | "natation") => {
                                const sportLabels: Record<string, string> = { course: "Séance Course", velo: "Séance Vélo", natation: "Séance Natation" };
                                setSessionExercises((prev) => ({
                                  ...prev,
                                  [selectedSession.id]: (prev[selectedSession.id] ?? []).map((ex) =>
                                    ex.id === exercise.id
                                      ? { ...ex, cardio_sport: value, cardio_content: JSON.stringify({ steps: [], blocks: [] }), exercice: sportLabels[value] }
                                      : ex,
                                  ),
                                }));
                                setSelectedCardioSport(value);
                              }}
                              disabled={isValidated}
                            >
                              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="course">🏃 Course</SelectItem>
                                <SelectItem value="velo">🚴 Vélo</SelectItem>
                                <SelectItem value="natation">🏊 Natation</SelectItem>
                              </SelectContent>
                            </Select>

                            {/* Cardio template import */}
                            {!isValidated && (
                              <Dialog
                                open={showTemplateSelector && expandedSessionId === selectedSession.id}
                                onOpenChange={(open) => { setShowTemplateSelector(open); if (open) { setSelectedCardioSport(currentSportType); setTemplateSearchQuery(""); } }}
                              >
                                <Button variant="outline" size="sm" className="h-8 text-xs"
                                  onClick={() => { setShowTemplateSelector(true); setSelectedCardioSport(currentSportType); }}>
                                  <Copy className="h-3 w-3 mr-1" />Importer
                                </Button>
                                <DialogContent className="max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>Importer une séance programmée</DialogTitle>
                                    <DialogDescription>Sélectionnez une séance pour remplacer le contenu actuel</DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="flex gap-2">
                                      {(["course", "velo", "natation"] as const).map((sport) => (
                                        <Button key={sport} size="sm" variant={selectedCardioSport === sport ? "default" : "outline"} onClick={() => setSelectedCardioSport(sport)} className="flex-1">
                                          {sport === "course" ? "🏃 Course" : sport === "velo" ? "🚴 Vélo" : "🏊 Natation"}
                                        </Button>
                                      ))}
                                    </div>
                                    <div className="relative">
                                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                      <Input placeholder="Rechercher..." value={templateSearchQuery} onChange={(e) => setTemplateSearchQuery(e.target.value)} className="pl-9" />
                                    </div>
                                    <div className="max-h-60 overflow-y-auto space-y-2">
                                      {filteredCardioTemplates.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-4">Aucune séance programmée</p>
                                      ) : filteredCardioTemplates.map((t) => (
                                        <Button key={t.id} variant="outline" size="sm" className="w-full justify-start h-auto py-2 px-3 text-left"
                                          onClick={() => handleImportTemplateToSession(t.id, selectedSession.id, exercise.id)}>
                                          <span className="truncate">{t.name}</span>
                                        </Button>
                                      ))}
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                            <FeedbackBadge sessionId={selectedSession.id} exerciceName={exercise.exercice} series={exercise.series} />
                          </div>

                          {/* Données réelles (Strava ou saisie manuelle) */}
                          {(exercise.actual_duration_minutes != null || exercise.actual_distance_km != null || exercise.actual_pace_min_per_km != null || exercise.actual_avg_heart_rate != null || exercise.sportif_rpe != null) && (
                            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3">
                              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.599h4.172L10.463 0l-7 13.828h4.169" /></svg>
                                Réalisé
                              </p>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                                {exercise.actual_duration_minutes != null && (
                                  <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground text-xs">Durée</span>
                                    <span className="font-medium text-xs">{exercise.actual_duration_minutes} min</span>
                                  </div>
                                )}
                                {exercise.actual_distance_km != null && (
                                  <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground text-xs">Distance</span>
                                    <span className="font-medium text-xs">{exercise.actual_distance_km} km</span>
                                  </div>
                                )}
                                {exercise.actual_pace_min_per_km != null && (
                                  <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground text-xs">Allure</span>
                                    <span className="font-medium text-xs">{exercise.actual_pace_min_per_km} /km</span>
                                  </div>
                                )}
                                {exercise.actual_avg_heart_rate != null && (
                                  <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground text-xs">FC moy.</span>
                                    <span className="font-medium text-xs">{exercise.actual_avg_heart_rate} bpm</span>
                                  </div>
                                )}
                                {(exercise as any).actual_max_heart_rate != null && (
                                  <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground text-xs">FC max</span>
                                    <span className="font-medium text-xs">{(exercise as any).actual_max_heart_rate} bpm</span>
                                  </div>
                                )}
                                {(exercise as any).actual_cadence != null && (
                                  <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground text-xs">Cadence</span>
                                    <span className="font-medium text-xs">{Math.round((exercise as any).actual_cadence)} spm</span>
                                  </div>
                                )}
                                {(exercise as any).actual_elevation_gain != null && (exercise as any).actual_elevation_gain > 0 && (
                                  <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground text-xs">Dénivelé</span>
                                    <span className="font-medium text-xs">+{Math.round((exercise as any).actual_elevation_gain)} m</span>
                                  </div>
                                )}
                                {(exercise as any).actual_calories != null && (
                                  <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground text-xs">Calories</span>
                                    <span className="font-medium text-xs">{(exercise as any).actual_calories} kcal</span>
                                  </div>
                                )}
                                {exercise.sportif_rpe != null && (
                                  <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground text-xs">RPE</span>
                                    <span className="font-medium text-xs">{exercise.sportif_rpe}/10</span>
                                  </div>
                                )}
                              </div>
                              {(exercise as any).actual_heart_rate_zones?.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-emerald-500/20">
                                  <HeartRateZonesBar zones={(exercise as any).actual_heart_rate_zones} fcMax={athleteFcMax} fcRepos={athleteFcRepos} />
                                </div>
                              )}
                              <RunSessionAnalysis
                                durationMin={exercise.actual_duration_minutes ?? null}
                                distanceKm={(exercise as any).actual_distance_km ?? null}
                                paceMinPerKm={(exercise as any).actual_pace_min_per_km ?? null}
                                avgHr={exercise.actual_avg_heart_rate ?? null}
                                rpe={exercise.sportif_rpe ?? null}
                                elevationGain={(exercise as any).actual_elevation_gain}
                                cadence={(exercise as any).actual_cadence}
                                cardioContent={(exercise as any).cardio_content}
                                vma={athleteVma}
                                fcMax={athleteFcMax}
                                fcRepos={athleteFcRepos}
                              />
                            </div>
                          )}

                          <CardioStepBuilder
                            steps={cardioData.steps}
                            blocks={cardioData.blocks}
                            onChange={(newData) => onExerciseChange(selectedSession.id, exercise.id, "cardio_content", JSON.stringify(newData))}
                            athleteVma={athleteVma}
                            athleteFcMax={athleteFcMax}
                            athleteFcRepos={athleteFcRepos}
                            disabled={isValidated}
                            sportType={currentSportType}
                          />

                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`req-link-${exercise.id}`}
                              checked={exercise.request_activity_link || false}
                              onCheckedChange={(c) => onExerciseChange(selectedSession.id, exercise.id, "request_activity_link", c === true)}
                              disabled={isValidated}
                            />
                            <label htmlFor={`req-link-${exercise.id}`} className="text-sm cursor-pointer">
                              Demander le lien Garmin/Strava de la sortie
                            </label>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">Commentaire</label>
                            <Textarea
                              value={exercise.commentaire || ""}
                              onChange={(e) => onExerciseChange(selectedSession.id, exercise.id, "commentaire", e.target.value)}
                              placeholder="Ajouter un commentaire pour cette séance..."
                              disabled={isValidated}
                              className="min-h-[80px]"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* ── RÉCUP ──────────────────────────────────────────────── */}
                {selectedSession.session_type === "recup" && (
                  <>
                    <div className="overflow-x-auto">
                      <Table className="text-sm">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[200px]">Exercice</TableHead>
                            <TableHead className="min-w-[140px]">Durée / Reps</TableHead>
                            <TableHead className="min-w-[200px]">Notes</TableHead>
                            <TableHead className="w-[50px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(sessionExercises[selectedSession.id] ?? []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucun exercice ajouté.</TableCell>
                            </TableRow>
                          ) : (sessionExercises[selectedSession.id] ?? []).map((exercise) => (
                            <TableRow
                              key={exercise.id}
                              draggable={!isValidated}
                              onDragStart={() => onExerciseDragStart(selectedSession.id, exercise.id)}
                              onDragOver={onExerciseDragOver}
                              onDrop={(e) => onExerciseDrop(e, selectedSession.id, exercise.id)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {!isValidated && <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />}
                                  <ExerciseCombobox
                                    value={exercise.exercice}
                                    onChange={(v) => onExerciseChange(selectedSession.id, exercise.id, "exercice", v)}
                                    exercises={libraryExercises.filter((ex) => ex.category === "mobilité-souplesse" || ex.category === "massage")}
                                    disabled={isValidated}
                                    onExerciseCreated={onExerciseCreated}
                                  />
                                </div>
                              </TableCell>
                              <TableCell>
                                <Input value={exercise.reps} onChange={(e) => onExerciseChange(selectedSession.id, exercise.id, "reps", e.target.value)} placeholder="ex: 3x30sec" disabled={isValidated} />
                              </TableCell>
                              <TableCell>
                                <Input value={exercise.commentaire} onChange={(e) => onExerciseChange(selectedSession.id, exercise.id, "commentaire", e.target.value)} placeholder="Notes..." disabled={isValidated} />
                              </TableCell>
                              <TableCell>
                                {!isValidated && (
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                                    onClick={() => onDeleteExercise(selectedSession.id, exercise.id)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}

                {/* ── RENFO ──────────────────────────────────────────────── */}
                {selectedSession.session_type === "renfo" && (
                  <>
                    <div className="overflow-x-auto">
                      <Table className="text-xs md:text-sm">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[160px]">Exercice</TableHead>
                            <TableHead className="min-w-[90px]">Récup</TableHead>
                            <TableHead className="min-w-[70px]">Reps</TableHead>
                            <TableHead className="min-w-[50px]">RPE</TableHead>
                            <TableHead className="min-w-[80px]">Charge</TableHead>
                            <TableHead className="min-w-[70px]">Tempo</TableHead>
                            <TableHead className="min-w-[120px]">Comm.</TableHead>
                            <TableHead className="min-w-[60px]">Séries</TableHead>
                            <TableHead className="w-[40px] text-center"><Video className="h-4 w-4 mx-auto" /></TableHead>
                            <TableHead className="w-[32px]" />
                            <TableHead className="w-[40px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(sessionExercises[selectedSession.id] ?? []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={10} className="text-center text-muted-foreground py-8">Aucun exercice ajouté.</TableCell>
                            </TableRow>
                          ) : (() => {
                            const exercises = sessionExercises[selectedSession.id] ?? [];
                            const result: React.ReactElement[] = [];
                            let i = 0;

                            while (i < exercises.length) {
                              const exercise = exercises[i];

                              /* ── Super-set block ── */
                              if (exercise.super_set_group) {
                                const groupExercises: Exercise[] = [];
                                let j = i;
                                while (j < exercises.length && exercises[j].super_set_group === exercise.super_set_group) {
                                  groupExercises.push(exercises[j]);
                                  j++;
                                }

                                result.push(
                                  <React.Fragment key={`ss-${exercise.super_set_group}`}>
                                    <TableRow>
                                      <TableCell colSpan={10} className="p-0 h-2 bg-muted/30" />
                                    </TableRow>
                                    <TableRow className="bg-primary/10 border-l-4 border-l-primary">
                                      <TableCell colSpan={7} className="font-semibold">
                                        <Badge variant="default" className="mr-2">Super-set ({groupExercises.length} exercices)</Badge>
                                        {parseAmrap(exercise.series) !== null && (
                                          <Badge variant="outline" className="text-primary border-primary/40 gap-1">
                                            <Timer className="h-3 w-3" />
                                            AMRAP · {formatAmrapDuration(parseAmrap(exercise.series)!)}
                                          </Badge>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {(() => {
                                          const amrapSec = parseAmrap(exercise.series);
                                          const isAmrap = amrapSec !== null;
                                          const amrapMin = isAmrap ? Math.floor(amrapSec / 60) : 0;

                                          const setAmrapMode = (on: boolean) => {
                                            const val = on ? "amrap:1800" : "4";
                                            groupExercises.forEach(gex => {
                                              onExerciseChange(selectedSession.id, gex.id, "series", val);
                                            });
                                          };

                                          return (
                                            <div className="flex items-start gap-2">
                                              <div>
                                                <label className="text-xs text-muted-foreground mb-1 block">
                                                  {isAmrap ? "Durée AMRAP" : "Séries communes"}
                                                </label>
                                                {isAmrap ? (
                                                  <div className="flex items-center gap-1">
                                                    <Input
                                                      type="number"
                                                      min={1}
                                                      max={180}
                                                      value={amrapMin}
                                                      onChange={(e) => {
                                                        const mins = Math.max(1, parseInt(e.target.value) || 1);
                                                        const val = `amrap:${mins * 60}`;
                                                        groupExercises.forEach(gex => {
                                                          onExerciseChange(selectedSession.id, gex.id, "series", val);
                                                        });
                                                      }}
                                                      disabled={isValidated}
                                                      className="h-7 w-16 text-center text-xs font-semibold"
                                                    />
                                                    <span className="text-xs text-muted-foreground">min</span>
                                                  </div>
                                                ) : (
                                                  <SeriesStepper sessionId={selectedSession.id} exercise={exercise} compact isValidated={isValidated} onExerciseChange={onExerciseChange} onAddExercise={onAddExercise} />
                                                )}
                                              </div>
                                              {!isValidated && (
                                                <button
                                                  type="button"
                                                  title={isAmrap ? "Repasser en séries" : "Mode AMRAP (durée)"}
                                                  onClick={() => setAmrapMode(!isAmrap)}
                                                  className={`mt-5 h-7 w-7 rounded-md border flex items-center justify-center transition-colors ${
                                                    isAmrap
                                                      ? "border-primary bg-primary/10 text-primary"
                                                      : "border-border text-muted-foreground hover:text-primary hover:border-primary/50"
                                                  }`}
                                                >
                                                  <Timer className="h-3.5 w-3.5" />
                                                </button>
                                              )}
                                            </div>
                                          );
                                        })()}
                                      </TableCell>
                                      <TableCell colSpan={2}>
                                        {/* Retour AMRAP du sportif */}
                                        {parseAmrap(exercise.series) !== null && (() => {
                                          const fb = getExerciseFeedback(selectedSession.id, exercise.exercice);
                                          const tours = fb?.serie_rpe_details?.length ?? 0;
                                          if (!fb || (!tours && !fb.sportif_rpe && !fb.sportif_comment)) return null;
                                          return (
                                            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                              {tours > 0 && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2 py-0.5 font-bold">
                                                  <Timer className="h-3 w-3" />
                                                  {tours} tour{tours > 1 ? "s" : ""}
                                                </span>
                                              )}
                                              {fb.sportif_rpe && (
                                                <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/15 text-orange-600 px-2 py-0.5 font-bold">
                                                  RPE {fb.sportif_rpe}
                                                </span>
                                              )}
                                              {fb.sportif_comment && (
                                                <span className="text-muted-foreground italic truncate max-w-[180px]">
                                                  "{fb.sportif_comment}"
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })()}
                                      </TableCell>
                                    </TableRow>

                                    {groupExercises.map((ex, exIndex) => {
                                      const nextEx = groupExercises[exIndex + 1];
                                      return (
                                        <React.Fragment key={ex.id}>
                                          <TableRow
                                            className="bg-primary/5 border-l-4 border-l-primary"
                                            draggable={!isValidated}
                                            onDragStart={() => onExerciseDragStart(selectedSession.id, ex.id)}
                                            onDragOver={onExerciseDragOver}
                                            onDrop={(e) => onExerciseDrop(e, selectedSession.id, ex.id)}
                                          >
                                            <TableCell>
                                              <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-muted-foreground/35 font-mono w-4 shrink-0 select-none text-center">{i + exIndex + 1}</span>
                                                {!isValidated && <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />}
                                                <div className="flex-1" data-session={selectedSession.id} data-exercise={ex.id} data-field="exercice">
                                                  <ExerciseCombobox
                                                    value={ex.exercice}
                                                    onChange={(v) => {
                                                      onExerciseChange(selectedSession.id, ex.id, "exercice", v);
                                                      setTimeout(() => {
                                                        const el = document.querySelector(`[data-session="${selectedSession.id}"][data-exercise="${ex.id}"][data-field="recuperation"]`) as HTMLElement;
                                                        el?.focus(); el?.click();
                                                      }, 100);
                                                    }}
                                                    exercises={libraryExercises}
                                                    disabled={isValidated}
                                                    autoOpen={autoOpenExercise?.sessionId === selectedSession.id && autoOpenExercise?.exerciseId === ex.id}
                                                    onAutoOpenHandled={() => setAutoOpenExercise(null)}
                                                    onExerciseCreated={onExerciseCreated}
                                                  />
                                                  <FeedbackBadge sessionId={selectedSession.id} exerciceName={ex.exercice} series={ex.series} />
                                                </div>
                                              </div>
                                            </TableCell>
                                            <TableCell>
                                              <Select value={ex.recuperation} onValueChange={(v) => { onExerciseChange(selectedSession.id, ex.id, "recuperation", v); setTimeout(() => { const el = document.querySelector(`[data-session="${selectedSession.id}"][data-exercise="${ex.id}"][data-field="reps"]`) as HTMLInputElement; el?.focus(); }, 100); }} disabled={isValidated}>
                                                <SelectTrigger data-session={selectedSession.id} data-exercise={ex.id} data-field="recuperation" onKeyDown={(e) => { if (e.key === "Enter" && e.currentTarget.getAttribute("aria-expanded") === "false") { e.preventDefault(); const repsEl = document.querySelector(`[data-session="${selectedSession.id}"][data-exercise="${ex.id}"][data-field="reps"]`) as HTMLInputElement; repsEl?.focus(); repsEl?.select(); } }}><SelectValue placeholder="Récup" /></SelectTrigger>
                                                <SelectContent>{recuperationOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                              </Select>
                                            </TableCell>
                                            <TableCell>
                                              <div className="space-y-2">
                                                <Input value={ex.reps} onChange={(e) => onExerciseChange(selectedSession.id, ex.id, "reps", e.target.value)} onBlur={(e) => { if (ex.is_duration) { const parsed = parseDurationInput(e.target.value); if (parsed !== e.target.value) onExerciseChange(selectedSession.id, ex.id, "reps", parsed); } }} onKeyDown={(e) => onKeyDown(e, selectedSession.id, ex.id, "reps")} placeholder={ex.is_duration ? "sec ou 10min" : ex.is_distance ? "m" : "10"} disabled={isValidated} data-session={selectedSession.id} data-exercise={ex.id} data-field="reps" />
                                                <div className="flex items-center gap-1.5">
                                                  <Checkbox id={`dur-ss-${ex.id}`} checked={ex.is_duration || false} onCheckedChange={(c) => onExerciseChange(selectedSession.id, ex.id, "is_duration", c as boolean)} disabled={isValidated} data-session={selectedSession.id} data-exercise={ex.id} data-field="is_duration" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onKeyDown(e, selectedSession.id, ex.id, "is_duration"); } }} />
                                                  <label htmlFor={`dur-ss-${ex.id}`} className="text-xs cursor-pointer select-none">durée <kbd className="text-[9px] text-muted-foreground/60 font-mono">Space</kbd></label>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                  <Checkbox id={`dist-ss-${ex.id}`} checked={ex.is_distance || false} onCheckedChange={(c) => onExerciseChange(selectedSession.id, ex.id, "is_distance", c as boolean)} disabled={isValidated} data-session={selectedSession.id} data-exercise={ex.id} data-field="is_distance" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onKeyDown(e, selectedSession.id, ex.id, "is_distance"); } }} />
                                                  <label htmlFor={`dist-ss-${ex.id}`} className="text-xs cursor-pointer select-none">distance (m)</label>
                                                </div>
                                                {ex.is_unilateral && (
                                                  <div className="flex items-center gap-1.5">
                                                    <Checkbox id={`side-ss-${ex.id}`} checked={ex.per_side || false} onCheckedChange={(c) => onExerciseChange(selectedSession.id, ex.id, "per_side", c as boolean)} disabled={isValidated} data-session={selectedSession.id} data-exercise={ex.id} data-field="per_side" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onKeyDown(e, selectedSession.id, ex.id, "per_side"); } }} />
                                                    <label htmlFor={`side-ss-${ex.id}`} className="text-xs cursor-pointer select-none">par côté <kbd className="text-[9px] text-muted-foreground/60 font-mono">Space</kbd></label>
                                                  </div>
                                                )}
                                              </div>
                                            </TableCell>
                                            <TableCell>
                                              <Input value={ex.rpe} onChange={(e) => onExerciseChange(selectedSession.id, ex.id, "rpe", e.target.value)} onKeyDown={(e) => onKeyDown(e, selectedSession.id, ex.id, "rpe")} placeholder="8" disabled={isValidated} data-session={selectedSession.id} data-exercise={ex.id} data-field="rpe" />
                                            </TableCell>
                                            <TableCell>
                                              <Input value={ex.charge} onChange={(e) => onExerciseChange(selectedSession.id, ex.id, "charge", e.target.value)} onKeyDown={(e) => onKeyDown(e, selectedSession.id, ex.id, "charge")} placeholder={chargeSuggestions[selectedSession.id]?.[ex.id] ? `${chargeSuggestions[selectedSession.id][ex.id]}kg` : "80kg"} disabled={isValidated} data-session={selectedSession.id} data-exercise={ex.id} data-field="charge" />
                                            </TableCell>
                                            <TableCell>
                                              <Input value={ex.tempo} onChange={(e) => onExerciseChange(selectedSession.id, ex.id, "tempo", e.target.value)} onKeyDown={(e) => onKeyDown(e, selectedSession.id, ex.id, "tempo")} placeholder="3010" disabled={isValidated} data-session={selectedSession.id} data-exercise={ex.id} data-field="tempo" />
                                            </TableCell>
                                            <TableCell>
                                              <Input value={ex.commentaire} onChange={(e) => onExerciseChange(selectedSession.id, ex.id, "commentaire", e.target.value)} onKeyDown={(e) => onKeyDown(e, selectedSession.id, ex.id, "commentaire")} placeholder="Notes..." disabled={isValidated} data-session={selectedSession.id} data-exercise={ex.id} data-field="commentaire" />
                                            </TableCell>
                                            <TableCell className="text-center text-muted-foreground text-xs">(en-tête)</TableCell>
                                            <TableCell className="text-center">
                                              <Checkbox checked={ex.request_video || false} onCheckedChange={(c) => onExerciseChange(selectedSession.id, ex.id, "request_video", c === true)} disabled={isValidated} title="Demander une vidéo" />
                                            </TableCell>
                                            <TableCell>
                                              {!isValidated && <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => onDeleteExercise(selectedSession.id, ex.id)}><X className="h-4 w-4" /></Button>}
                                            </TableCell>
                                          </TableRow>

                                          {/* Series individuelles (superset) — fallback sur les séries du header si l'exo n'en a pas */}
                                          {(() => {
                                            const ownDetails = getSerieDetailsArray(ex.serie_details);
                                            const headerSeries = parseInt(exercise.series) || 0;
                                            const serieCount = ownDetails.length > 1 ? ownDetails.length : headerSeries;
                                            const serieList = ownDetails.length > 1 ? ownDetails : Array.from({ length: headerSeries }, () => ({ reps: ex.reps ?? "", charge: ex.charge ?? "", rpe: ex.rpe ?? "", tempo: ex.tempo ?? "", commentaire: "", recuperation: ex.recuperation ?? "" }));
                                            return serieCount > 1 ? (
                                            <>
                                              <TableRow className="bg-primary/5 border-l-4 border-l-primary cursor-pointer hover:bg-primary/10" onClick={() => setCollapsedSeriesExercises((prev) => ({ ...prev, [ex.id]: !prev[ex.id] }))}>
                                                <TableCell colSpan={10} className="py-1 pl-10">
                                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${collapsedSeriesExercises[ex.id] ? "-rotate-90" : ""}`} />
                                                    <span>{collapsedSeriesExercises[ex.id] ? "Afficher" : "Masquer"} le détail des {serieCount} séries</span>
                                                    {(() => { const fb = getExerciseFeedback(selectedSession.id, ex.exercice); const hasFailure = fb?.serie_rpe_details?.some(sd => sd.modification_type === "failure"); const hasTooEasy = fb?.serie_rpe_details?.some(sd => sd.modification_type === "too_easy"); const hasAnyModif = fb?.serie_rpe_details?.some(sd => sd.actual_reps || sd.actual_charge); if (!hasAnyModif) return null; return (<span className={`ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${hasFailure ? "bg-red-500/15 text-red-600" : "bg-blue-500/15 text-blue-600"}`}>{hasFailure ? "⬇ échec" : "⬆ ajusté"} — voir les séries</span>); })()}
                                                  </div>
                                                </TableCell>
                                              </TableRow>
                                              {!collapsedSeriesExercises[ex.id] && serieList.map((serie, si) => (
                                                <TableRow key={`${ex.id}-ss-serie-${si}`} className="bg-muted/20">
                                                  <TableCell className="pl-10 text-xs text-muted-foreground font-medium py-1">
                                                    Série {si + 1}
                                                    {(() => { const fb = getExerciseFeedback(selectedSession.id, ex.exercice); const sd = fb?.serie_rpe_details?.[si]; if (!sd) return null; const isFailure = sd.modification_type === "failure"; const isTooEasy = sd.modification_type === "too_easy"; const plannedCharge = serie.charge || ex.charge; const pc = (plannedCharge || "").trim(); const chargeIsUnknown = pc === "??" || /^(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)$/.test(pc); const plannedReps = serie.reps || ex.reps; const pr = (plannedReps || "").trim(); const repsIsRange = /^\d+\s*-\s*\d+$/.test(pr); return (<span className="ml-2 inline-flex flex-wrap gap-1">{sd.rpe != null && <span className="text-[10px] text-orange-500 font-medium">RPE {sd.rpe}</span>}{sd.actual_reps && (repsIsRange ? <span className="text-[10px] font-semibold text-orange-500">⚖️ {sd.actual_reps} reps</span> : <span className={`text-[10px] font-semibold ${isFailure ? "text-red-500" : isTooEasy ? "text-blue-500" : "text-orange-500"}`}>{isFailure ? "⬇" : isTooEasy ? "⬆" : "≠"} {sd.actual_reps} reps (prévu {plannedReps})</span>)}{sd.actual_charge && (chargeIsUnknown ? <span className="text-[10px] font-semibold text-orange-500">⚖️ {sd.actual_charge} kg</span> : <span className={`text-[10px] font-semibold ${isFailure ? "text-red-500" : isTooEasy ? "text-blue-500" : "text-orange-500"}`}>{isFailure ? "⬇" : isTooEasy ? "⬆" : "≠"} {sd.actual_charge} (prévu {plannedCharge})</span>)}</span>); })()}
                                                  </TableCell>
                                                  <TableCell className="py-1">
                                                    <Select value={serie.recuperation || ex.recuperation || ""} onValueChange={(v) => onSerieDetailChange(selectedSession.id, ex.id, si, "recuperation", v)} disabled={isValidated}>
                                                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Récup" /></SelectTrigger>
                                                      <SelectContent>{recuperationOptions.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                  </TableCell>
                                                  <TableCell className="py-1"><Input value={serie.reps} onChange={(e) => onSerieDetailChange(selectedSession.id, ex.id, si, "reps", e.target.value)} placeholder={ex.reps || "reps"} disabled={isValidated} className="h-7 text-xs" /></TableCell>
                                                  <TableCell className="py-1"><Input value={serie.rpe} onChange={(e) => onSerieDetailChange(selectedSession.id, ex.id, si, "rpe", e.target.value)} placeholder={ex.rpe || "RPE"} disabled={isValidated} className="h-7 text-xs" /></TableCell>
                                                  <TableCell className="py-1">
                                                    <div className="relative">
                                                      <Input value={serie.charge} onChange={(e) => onSerieDetailChange(selectedSession.id, ex.id, si, "charge", e.target.value)} placeholder={serieChargeSuggestions[`${ex.id}-${si}`] ? `${serieChargeSuggestions[`${ex.id}-${si}`]}kg` : (ex.charge || "charge")} disabled={isValidated} className="h-7 text-xs" />
                                                      {getPercentSuggestion(serie.charge || ex.charge, ex.exercice) && <span className="absolute -bottom-3.5 left-0 text-[9px] text-primary font-medium whitespace-nowrap">{getPercentSuggestion(serie.charge || ex.charge, ex.exercice)}</span>}
                                                    </div>
                                                  </TableCell>
                                                  <TableCell className="py-1"><Input value={serie.tempo} onChange={(e) => onSerieDetailChange(selectedSession.id, ex.id, si, "tempo", e.target.value)} placeholder={ex.tempo || "tempo"} disabled={isValidated} className="h-7 text-xs" /></TableCell>
                                                  <TableCell className="py-1"><Input value={serie.commentaire} onChange={(e) => onSerieDetailChange(selectedSession.id, ex.id, si, "commentaire", e.target.value)} placeholder="..." disabled={isValidated} className="h-7 text-xs" /></TableCell>
                                                  <TableCell colSpan={4} />
                                                </TableRow>
                                              ))}
                                            </>
                                            ) : null;
                                          })()}
                                        </React.Fragment>
                                      );
                                    })}
                                    <TableRow>
                                      <TableCell colSpan={10} className="p-0 h-2 bg-muted/30" />
                                    </TableRow>
                                  </React.Fragment>,
                                );
                                i = j;
                              } else {
                                /* ── Normal exercise row ── */
                                const nextExercise = exercises[i + 1];
                                const inGroup = nextExercise && isInSameGroup(selectedSession.id, exercise.id, nextExercise.id);

                                result.push(
                                  <React.Fragment key={exercise.id}>
                                    <TableRow
                                      className={`${inGroup ? "border-b-0" : ""}`}
                                      draggable={!isValidated}
                                      onDragStart={() => onExerciseDragStart(selectedSession.id, exercise.id)}
                                      onDragOver={onExerciseDragOver}
                                      onDrop={(e) => onExerciseDrop(e, selectedSession.id, exercise.id)}
                                    >
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] text-muted-foreground/35 font-mono w-4 shrink-0 select-none text-center">{i + 1}</span>
                                          {!isValidated && <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />}
                                          <div className="flex-1" data-session={selectedSession.id} data-exercise={exercise.id} data-field="exercice">
                                            <ExerciseCombobox
                                              value={exercise.exercice}
                                              onChange={(v) => {
                                                onExerciseChange(selectedSession.id, exercise.id, "exercice", v);
                                                setTimeout(() => {
                                                  const el = document.querySelector(`[data-session="${selectedSession.id}"][data-exercise="${exercise.id}"][data-field="recuperation"]`) as HTMLElement;
                                                  el?.focus(); el?.click();
                                                }, 100);
                                              }}
                                              exercises={libraryExercises}
                                              disabled={isValidated}
                                              autoOpen={autoOpenExercise?.sessionId === selectedSession.id && autoOpenExercise?.exerciseId === exercise.id}
                                              onAutoOpenHandled={() => setAutoOpenExercise(null)}
                                              onExerciseCreated={onExerciseCreated}
                                            />
                                            <FeedbackBadge sessionId={selectedSession.id} exerciceName={exercise.exercice} series={exercise.series} />
                                          </div>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Select value={exercise.recuperation} onValueChange={(v) => { onExerciseChange(selectedSession.id, exercise.id, "recuperation", v); setTimeout(() => { const el = document.querySelector(`[data-session="${selectedSession.id}"][data-exercise="${exercise.id}"][data-field="reps"]`) as HTMLInputElement; el?.focus(); }, 100); }} disabled={isValidated}>
                                          <SelectTrigger data-session={selectedSession.id} data-exercise={exercise.id} data-field="recuperation" onKeyDown={(e) => { if (e.key === "Enter" && e.currentTarget.getAttribute("aria-expanded") === "false") { e.preventDefault(); const repsEl = document.querySelector(`[data-session="${selectedSession.id}"][data-exercise="${exercise.id}"][data-field="reps"]`) as HTMLInputElement; repsEl?.focus(); repsEl?.select(); } }}><SelectValue placeholder="Récup" /></SelectTrigger>
                                          <SelectContent>{recuperationOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell>
                                        <div className="space-y-2">
                                          <Input value={exercise.reps} onChange={(e) => onExerciseChange(selectedSession.id, exercise.id, "reps", e.target.value)} onBlur={(e) => { if (exercise.is_duration) { const parsed = parseDurationInput(e.target.value); if (parsed !== e.target.value) onExerciseChange(selectedSession.id, exercise.id, "reps", parsed); } }} onKeyDown={(e) => onKeyDown(e, selectedSession.id, exercise.id, "reps")} placeholder={exercise.is_duration ? "sec ou 10min" : exercise.is_distance ? "m" : "10"} disabled={isValidated} data-session={selectedSession.id} data-exercise={exercise.id} data-field="reps" />
                                          <div className="flex items-center gap-1.5">
                                            <Checkbox id={`dur-${selectedSession.id}-${exercise.id}`} checked={exercise.is_duration || false} onCheckedChange={(c) => onExerciseChange(selectedSession.id, exercise.id, "is_duration", c as boolean)} disabled={isValidated} data-session={selectedSession.id} data-exercise={exercise.id} data-field="is_duration" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onKeyDown(e, selectedSession.id, exercise.id, "is_duration"); } }} />
                                            <label htmlFor={`dur-${selectedSession.id}-${exercise.id}`} className="text-xs cursor-pointer select-none">durée <kbd className="text-[9px] text-muted-foreground/60 font-mono">Space</kbd></label>
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                            <Checkbox id={`dist-${selectedSession.id}-${exercise.id}`} checked={exercise.is_distance || false} onCheckedChange={(c) => onExerciseChange(selectedSession.id, exercise.id, "is_distance", c as boolean)} disabled={isValidated} data-session={selectedSession.id} data-exercise={exercise.id} data-field="is_distance" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onKeyDown(e, selectedSession.id, exercise.id, "is_distance"); } }} />
                                            <label htmlFor={`dist-${selectedSession.id}-${exercise.id}`} className="text-xs cursor-pointer select-none">distance (m)</label>
                                          </div>
                                          {exercise.is_unilateral && (
                                            <div className="flex items-center gap-1.5">
                                              <Checkbox id={`side-${selectedSession.id}-${exercise.id}`} checked={exercise.per_side || false} onCheckedChange={(c) => onExerciseChange(selectedSession.id, exercise.id, "per_side", c as boolean)} disabled={isValidated} data-session={selectedSession.id} data-exercise={exercise.id} data-field="per_side" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onKeyDown(e, selectedSession.id, exercise.id, "per_side"); } }} />
                                              <label htmlFor={`side-${selectedSession.id}-${exercise.id}`} className="text-xs cursor-pointer select-none">par côté <kbd className="text-[9px] text-muted-foreground/60 font-mono">Space</kbd></label>
                                            </div>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Input value={exercise.rpe} onChange={(e) => onExerciseChange(selectedSession.id, exercise.id, "rpe", e.target.value)} onKeyDown={(e) => onKeyDown(e, selectedSession.id, exercise.id, "rpe")} placeholder="8" disabled={isValidated} data-session={selectedSession.id} data-exercise={exercise.id} data-field="rpe" />
                                      </TableCell>
                                      <TableCell>
                                        <div className="relative">
                                          <Input value={exercise.charge} onChange={(e) => onExerciseChange(selectedSession.id, exercise.id, "charge", e.target.value)} onKeyDown={(e) => onKeyDown(e, selectedSession.id, exercise.id, "charge")} placeholder={!exercise.charge && chargeSuggestions[selectedSession.id]?.[exercise.id] ? `${chargeSuggestions[selectedSession.id][exercise.id]}kg` : "80kg"} disabled={isValidated} data-session={selectedSession.id} data-exercise={exercise.id} data-field="charge" />
                                          {getPercentSuggestion(exercise.charge, exercise.exercice) && (
                                            <span className="absolute -bottom-3.5 left-0 text-[9px] text-primary font-medium whitespace-nowrap">{getPercentSuggestion(exercise.charge, exercise.exercice)}</span>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Input value={exercise.tempo} onChange={(e) => onExerciseChange(selectedSession.id, exercise.id, "tempo", e.target.value)} onKeyDown={(e) => onKeyDown(e, selectedSession.id, exercise.id, "tempo")} placeholder="3010" disabled={isValidated} data-session={selectedSession.id} data-exercise={exercise.id} data-field="tempo" />
                                      </TableCell>
                                      <TableCell>
                                        <Input value={exercise.commentaire} onChange={(e) => onExerciseChange(selectedSession.id, exercise.id, "commentaire", e.target.value)} onKeyDown={(e) => onKeyDown(e, selectedSession.id, exercise.id, "commentaire")} placeholder="Notes..." disabled={isValidated} data-session={selectedSession.id} data-exercise={exercise.id} data-field="commentaire" />
                                      </TableCell>
                                      <TableCell>
                                        <SeriesStepper sessionId={selectedSession.id} exercise={exercise} isValidated={isValidated} onExerciseChange={onExerciseChange} onAddExercise={onAddExercise} />
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Checkbox checked={exercise.request_video || false} onCheckedChange={(c) => onExerciseChange(selectedSession.id, exercise.id, "request_video", c === true)} disabled={isValidated} title="Demander une vidéo" />
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {!isValidated && i < exercises.length - 1 && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className={`h-7 w-7 p-0 ${exercise.super_set_group ? "text-primary" : "text-muted-foreground/40 hover:text-primary"}`}
                                            onClick={() => onToggleSuperSet(selectedSession.id, exercise.id)}
                                            title={exercise.super_set_group ? "Retirer du super-set" : "Créer un super-set avec l'exercice suivant"}
                                          >
                                            {exercise.super_set_group ? <Unlink2 className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                                          </Button>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {!isValidated && <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => onDeleteExercise(selectedSession.id, exercise.id)}><X className="h-4 w-4" /></Button>}
                                      </TableCell>
                                    </TableRow>

                                    {/* Series individuelles */}
                                    {(getSerieDetailsArray(exercise.serie_details).length > 1 || (parseInt(exercise.series || "0") > 1 && !!(getExerciseFeedback(selectedSession.id, exercise.exercice)?.serie_rpe_details?.length))) && (
                                      <>
                                        <TableRow className="bg-muted/10 cursor-pointer hover:bg-muted/30" onClick={() => setCollapsedSeriesExercises((prev) => ({ ...prev, [exercise.id]: !prev[exercise.id] }))}>
                                          <TableCell colSpan={10} className="py-1 pl-10">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${collapsedSeriesExercises[exercise.id] ? "-rotate-90" : ""}`} />
                                              <span>{collapsedSeriesExercises[exercise.id] ? "Afficher" : "Masquer"} le détail des {getSerieDetailsArray(exercise.serie_details).length > 1 ? getSerieDetailsArray(exercise.serie_details).length : parseInt(exercise.series || "0")} séries</span>
                                              {(() => { const fb = getExerciseFeedback(selectedSession.id, exercise.exercice); const hasFailure = fb?.serie_rpe_details?.some(sd => sd.modification_type === "failure"); const hasTooEasy = fb?.serie_rpe_details?.some(sd => sd.modification_type === "too_easy"); const hasAnyModif = fb?.serie_rpe_details?.some(sd => sd.actual_reps || sd.actual_charge); if (!hasAnyModif) return null; return (<span className={`ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${hasFailure ? "bg-red-500/15 text-red-600" : "bg-blue-500/15 text-blue-600"}`}>{hasFailure ? "⬇ échec" : "⬆ ajusté"} — voir les séries</span>); })()}
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                        {!collapsedSeriesExercises[exercise.id] && (getSerieDetailsArray(exercise.serie_details).length > 1 ? getSerieDetailsArray(exercise.serie_details) : Array.from({ length: parseInt(exercise.series || "0") }, () => ({ reps: exercise.reps ?? "", charge: exercise.charge ?? "", rpe: exercise.rpe ?? "", tempo: exercise.tempo ?? "", commentaire: "", recuperation: exercise.recuperation ?? "" }))).map((serie, si) => {
                                          const totalSeries = getSerieDetailsArray(exercise.serie_details).length > 1 ? getSerieDetailsArray(exercise.serie_details).length : parseInt(exercise.series || "0");
                                          const serieFields = ["reps", "rpe", "charge", "tempo", "commentaire"] as const;
                                          const handleSerieKeyDown = (e: React.KeyboardEvent, field: string) => {
                                            if (e.key !== "Enter") return;
                                            e.preventDefault();
                                            const fieldIndex = serieFields.indexOf(field as any);
                                            const nextSi = si < totalSeries - 1 ? si + 1 : null;
                                            const nextField = nextSi === null && fieldIndex < serieFields.length - 1 ? serieFields[fieldIndex + 1] : null;
                                            const targetSi = nextSi ?? 0;
                                            const targetField = nextField ?? field;
                                            const el = document.querySelector(`[data-serie-exercise="${exercise.id}"][data-serie-index="${targetSi}"][data-serie-field="${targetField}"]`) as HTMLElement;
                                            if (el) el.focus();
                                          };
                                          return (
                                            <TableRow key={`${exercise.id}-serie-${si}`} className="bg-muted/20">
                                              <TableCell className="pl-10 text-xs text-muted-foreground font-medium py-1">
                                                <span className="flex items-center flex-wrap gap-1">
                                                  Série {si + 1}
                                                  {(() => { const fb = getExerciseFeedback(selectedSession.id, exercise.exercice); const sd = fb?.serie_rpe_details?.[si]; if (!sd) return null; const isFailure = sd.modification_type === "failure"; const isTooEasy = sd.modification_type === "too_easy"; const plannedCharge = serie.charge || exercise.charge; const pc = (plannedCharge || "").trim(); const chargeIsUnknown = pc === "??" || /^(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)$/.test(pc); const plannedReps = serie.reps || exercise.reps; const pr = (plannedReps || "").trim(); const repsIsRange = /^\d+\s*-\s*\d+$/.test(pr); return (<span className="inline-flex flex-wrap gap-1">{sd.rpe != null && <span className="text-[10px] text-orange-500 font-medium">RPE {sd.rpe}</span>}{sd.actual_reps && (repsIsRange ? <span className="text-[10px] font-semibold text-orange-500">⚖️ {sd.actual_reps} reps</span> : <span className={`text-[10px] font-semibold ${isFailure ? "text-red-500" : isTooEasy ? "text-blue-500" : "text-orange-500"}`}>{isFailure ? "⬇" : isTooEasy ? "⬆" : "≠"} {sd.actual_reps} reps (prévu {plannedReps})</span>)}{sd.actual_charge && (chargeIsUnknown ? <span className="text-[10px] font-semibold text-orange-500">⚖️ {sd.actual_charge} kg</span> : <span className={`text-[10px] font-semibold ${isFailure ? "text-red-500" : isTooEasy ? "text-blue-500" : "text-orange-500"}`}>{isFailure ? "⬇" : isTooEasy ? "⬆" : "≠"} {sd.actual_charge} (prévu {plannedCharge})</span>)}</span>); })()}
                                                </span>
                                              </TableCell>
                                              <TableCell className="py-1">
                                                <Select value={serie.recuperation || exercise.recuperation || ""} onValueChange={(v) => onSerieDetailChange(selectedSession.id, exercise.id, si, "recuperation", v)} disabled={isValidated}>
                                                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Récup" /></SelectTrigger>
                                                  <SelectContent>{recuperationOptions.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
                                                </Select>
                                              </TableCell>
                                              <TableCell className="py-1"><Input value={serie.reps} onChange={(e) => onSerieDetailChange(selectedSession.id, exercise.id, si, "reps", e.target.value)} onKeyDown={(e) => handleSerieKeyDown(e, "reps")} placeholder={exercise.reps || "reps"} disabled={isValidated} className="h-7 text-xs" data-serie-exercise={exercise.id} data-serie-index={si} data-serie-field="reps" /></TableCell>
                                              <TableCell className="py-1"><Input value={serie.rpe} onChange={(e) => onSerieDetailChange(selectedSession.id, exercise.id, si, "rpe", e.target.value)} onKeyDown={(e) => handleSerieKeyDown(e, "rpe")} placeholder={exercise.rpe || "RPE"} disabled={isValidated} className="h-7 text-xs" data-serie-exercise={exercise.id} data-serie-index={si} data-serie-field="rpe" /></TableCell>
                                              <TableCell className="py-1">
                                                <div className="relative">
                                                  <Input value={serie.charge} onChange={(e) => onSerieDetailChange(selectedSession.id, exercise.id, si, "charge", e.target.value)} onKeyDown={(e) => handleSerieKeyDown(e, "charge")} placeholder={serieChargeSuggestions[`${exercise.id}-${si}`] ? `${serieChargeSuggestions[`${exercise.id}-${si}`]}kg` : (exercise.charge || "charge")} disabled={isValidated} className="h-7 text-xs" data-serie-exercise={exercise.id} data-serie-index={si} data-serie-field="charge" />
                                                  {getPercentSuggestion(serie.charge || exercise.charge, exercise.exercice) && <span className="absolute -bottom-3.5 left-0 text-[9px] text-primary font-medium whitespace-nowrap">{getPercentSuggestion(serie.charge || exercise.charge, exercise.exercice)}</span>}
                                                </div>
                                              </TableCell>
                                              <TableCell className="py-1"><Input value={serie.tempo} onChange={(e) => onSerieDetailChange(selectedSession.id, exercise.id, si, "tempo", e.target.value)} onKeyDown={(e) => handleSerieKeyDown(e, "tempo")} placeholder={exercise.tempo || "tempo"} disabled={isValidated} className="h-7 text-xs" data-serie-exercise={exercise.id} data-serie-index={si} data-serie-field="tempo" /></TableCell>
                                              <TableCell className="py-1"><Input value={serie.commentaire} onChange={(e) => onSerieDetailChange(selectedSession.id, exercise.id, si, "commentaire", e.target.value)} onKeyDown={(e) => handleSerieKeyDown(e, "commentaire")} placeholder="..." disabled={isValidated} className="h-7 text-xs" data-serie-exercise={exercise.id} data-serie-index={si} data-serie-field="commentaire" /></TableCell>
                                              <TableCell colSpan={4} />
                                            </TableRow>
                                          );
                                        })}
                                      </>
                                    )}
                                  </React.Fragment>,
                                );
                                i++;
                              }
                            }
                            return result;
                          })()}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}

                {/* Add exercise */}
                {!isValidated && (
                  <Button
                    variant="outline" size="sm" className="text-sm"
                    onClick={() => onAddExercise(selectedSession.id)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {selectedSession.session_type === "cardio" ? "Ajouter une étape" : "Ajouter un exercice"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
