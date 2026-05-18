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
import { VoiceCommandButton } from "@/components/VoiceCommandButton";
import { calculateSessionDuration, formatSessionDuration } from "@/lib/sessionDurationCalculator";
import {
  calculateCardioMetrics,
  formatCardioSessionDuration,
} from "@/lib/cardioCalculations";
import { formatWeekRange } from "@/lib/weekUtils";

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
  request_video?: boolean;
  serie_details?: SerieDetail[] | string;
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
  const count = parseInt(exercise.series) || 0;
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
    serie_rpe_details?: { rpe: number | null }[] | null;
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
    undoStack, onWeekChange, onSave, onUndo,
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
  } = props;

  const selectedSession = sessions.find((s) => s.id === expandedSessionId) ?? null;

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
  const FeedbackBadge = ({ sessionId, exerciceName }: { sessionId: number; exerciceName: string }) => {
    const fb = getExerciseFeedback(sessionId, exerciceName);
    if (!fb) return null;
    return (
      <div className="text-[10px] bg-muted/50 rounded px-1.5 py-0.5 mt-0.5 border-l-2 border-primary/50">
        {fb.skipped ? (
          <span className="text-destructive font-medium">⚠️ Non fait</span>
        ) : (
          <div className="flex flex-wrap gap-x-2 text-muted-foreground">
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
                    onClick={() => setExpandedSessionId(isSelected ? null : session.id)}
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

          {/* Validated message */}
          {isValidated && (
            <div className="p-2 bg-primary/10 border border-primary/20 rounded-md text-xs text-primary font-medium">
              ✓ Semaine validée
            </div>
          )}
        </div>

        {/* RIGHT PANEL — exercise editor ──────────────────────────────────── */}
        <div className="flex-1 min-w-0 rounded-lg border border-border/40 bg-card/20 overflow-hidden flex flex-col">

          {!selectedSession ? (
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
                            <FeedbackBadge sessionId={selectedSession.id} exerciceName={exercise.exercice} />
                          </div>

                          <CardioStepBuilder
                            steps={cardioData.steps}
                            blocks={cardioData.blocks}
                            onChange={(newData) => onExerciseChange(selectedSession.id, exercise.id, "cardio_content", JSON.stringify(newData))}
                            athleteVma={athleteVma}
                            disabled={isValidated}
                            sportType={currentSportType}
                          />

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
                                      </TableCell>
                                      <TableCell>
                                        <div>
                                          <label className="text-xs text-muted-foreground mb-1 block">Séries communes</label>
                                          <SeriesStepper sessionId={selectedSession.id} exercise={exercise} compact isValidated={isValidated} onExerciseChange={onExerciseChange} onAddExercise={onAddExercise} />
                                        </div>
                                      </TableCell>
                                      <TableCell colSpan={2} />
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
                                                  <FeedbackBadge sessionId={selectedSession.id} exerciceName={ex.exercice} />
                                                </div>
                                              </div>
                                            </TableCell>
                                            <TableCell>
                                              <Select value={ex.recuperation} onValueChange={(v) => { onExerciseChange(selectedSession.id, ex.id, "recuperation", v); setTimeout(() => { const el = document.querySelector(`[data-session="${selectedSession.id}"][data-exercise="${ex.id}"][data-field="reps"]`) as HTMLInputElement; el?.focus(); }, 100); }} disabled={isValidated}>
                                                <SelectTrigger data-session={selectedSession.id} data-exercise={ex.id} data-field="recuperation"><SelectValue placeholder="Récup" /></SelectTrigger>
                                                <SelectContent>{recuperationOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                              </Select>
                                            </TableCell>
                                            <TableCell>
                                              <div className="space-y-2">
                                                <Input value={ex.reps} onChange={(e) => onExerciseChange(selectedSession.id, ex.id, "reps", e.target.value)} onKeyDown={(e) => onKeyDown(e, selectedSession.id, ex.id, "reps")} placeholder={ex.is_duration ? "sec" : "10"} disabled={isValidated} data-session={selectedSession.id} data-exercise={ex.id} data-field="reps" />
                                                <div className="flex items-center gap-1.5">
                                                  <Checkbox id={`dur-ss-${ex.id}`} checked={ex.is_duration || false} onCheckedChange={(c) => onExerciseChange(selectedSession.id, ex.id, "is_duration", c as boolean)} disabled={isValidated} />
                                                  <label htmlFor={`dur-ss-${ex.id}`} className="text-xs cursor-pointer">durée</label>
                                                </div>
                                                {ex.is_unilateral && (
                                                  <div className="flex items-center gap-1.5">
                                                    <Checkbox id={`side-ss-${ex.id}`} checked={ex.per_side || false} onCheckedChange={(c) => onExerciseChange(selectedSession.id, ex.id, "per_side", c as boolean)} disabled={isValidated} />
                                                    <label htmlFor={`side-ss-${ex.id}`} className="text-xs cursor-pointer">par côté</label>
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

                                          {/* Series individuelles (superset) */}
                                          {getSerieDetailsArray(ex.serie_details).length > 1 && (
                                            <>
                                              <TableRow className="bg-primary/5 border-l-4 border-l-primary cursor-pointer hover:bg-primary/10" onClick={() => setCollapsedSeriesExercises((prev) => ({ ...prev, [ex.id]: !prev[ex.id] }))}>
                                                <TableCell colSpan={10} className="py-1 pl-10">
                                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${collapsedSeriesExercises[ex.id] ? "-rotate-90" : ""}`} />
                                                    <span>{collapsedSeriesExercises[ex.id] ? "Afficher" : "Masquer"} le détail des {getSerieDetailsArray(ex.serie_details).length} séries</span>
                                                  </div>
                                                </TableCell>
                                              </TableRow>
                                              {!collapsedSeriesExercises[ex.id] && getSerieDetailsArray(ex.serie_details).map((serie, si) => (
                                                <TableRow key={`${ex.id}-ss-serie-${si}`} className="bg-muted/20">
                                                  <TableCell className="pl-10 text-xs text-muted-foreground font-medium py-1">
                                                    Série {si + 1}
                                                    {(() => { const fb = getExerciseFeedback(selectedSession.id, ex.exercice); const rpe = fb?.serie_rpe_details?.[si]?.rpe; return rpe != null ? <span className="ml-2 text-[10px] text-orange-500">RPE {rpe}</span> : null; })()}
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
                                          )}
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
                                            <FeedbackBadge sessionId={selectedSession.id} exerciceName={exercise.exercice} />
                                          </div>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Select value={exercise.recuperation} onValueChange={(v) => { onExerciseChange(selectedSession.id, exercise.id, "recuperation", v); setTimeout(() => { const el = document.querySelector(`[data-session="${selectedSession.id}"][data-exercise="${exercise.id}"][data-field="reps"]`) as HTMLInputElement; el?.focus(); }, 100); }} disabled={isValidated}>
                                          <SelectTrigger data-session={selectedSession.id} data-exercise={exercise.id} data-field="recuperation"><SelectValue placeholder="Récup" /></SelectTrigger>
                                          <SelectContent>{recuperationOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell>
                                        <div className="space-y-2">
                                          <Input value={exercise.reps} onChange={(e) => onExerciseChange(selectedSession.id, exercise.id, "reps", e.target.value)} onKeyDown={(e) => onKeyDown(e, selectedSession.id, exercise.id, "reps")} placeholder={exercise.is_duration ? "sec" : "10"} disabled={isValidated} data-session={selectedSession.id} data-exercise={exercise.id} data-field="reps" />
                                          <div className="flex items-center gap-1.5">
                                            <Checkbox id={`dur-${selectedSession.id}-${exercise.id}`} checked={exercise.is_duration || false} onCheckedChange={(c) => onExerciseChange(selectedSession.id, exercise.id, "is_duration", c as boolean)} disabled={isValidated} />
                                            <label htmlFor={`dur-${selectedSession.id}-${exercise.id}`} className="text-xs cursor-pointer">durée (sec)</label>
                                          </div>
                                          {exercise.is_unilateral && (
                                            <div className="flex items-center gap-1.5">
                                              <Checkbox id={`side-${selectedSession.id}-${exercise.id}`} checked={exercise.per_side || false} onCheckedChange={(c) => onExerciseChange(selectedSession.id, exercise.id, "per_side", c as boolean)} disabled={isValidated} />
                                              <label htmlFor={`side-${selectedSession.id}-${exercise.id}`} className="text-xs cursor-pointer">par côté</label>
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
                                    {getSerieDetailsArray(exercise.serie_details).length > 1 && (
                                      <>
                                        <TableRow className="bg-muted/10 cursor-pointer hover:bg-muted/30" onClick={() => setCollapsedSeriesExercises((prev) => ({ ...prev, [exercise.id]: !prev[exercise.id] }))}>
                                          <TableCell colSpan={10} className="py-1 pl-10">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${collapsedSeriesExercises[exercise.id] ? "-rotate-90" : ""}`} />
                                              <span>{collapsedSeriesExercises[exercise.id] ? "Afficher" : "Masquer"} le détail des {getSerieDetailsArray(exercise.serie_details).length} séries</span>
                                            </div>
                                          </TableCell>
                                        </TableRow>
                                        {!collapsedSeriesExercises[exercise.id] && getSerieDetailsArray(exercise.serie_details).map((serie, si) => {
                                          const totalSeries = getSerieDetailsArray(exercise.serie_details).length;
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
                                                <span className="flex items-center gap-2">
                                                  Série {si + 1}
                                                  {(() => { const fb = getExerciseFeedback(selectedSession.id, exercise.exercice); const rpe = fb?.serie_rpe_details?.[si]?.rpe; return rpe != null ? <span className="text-[10px] text-orange-500">RPE {rpe}</span> : null; })()}
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
