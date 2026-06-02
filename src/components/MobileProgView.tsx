import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExerciseCombobox } from "@/components/ExerciseCombobox";
import { CardioStepBuilder, CardioData } from "@/components/CardioStepBuilder";
import { RECUP_OPTIONS } from "@/lib/groqVoiceCommand";
import { formatWeekRange } from "@/lib/weekUtils";
import { calculateCardioMetrics, formatCardioSessionDuration } from "@/lib/cardioCalculations";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, ChevronRight, Plus, Dumbbell, Heart, Zap,
  Trash2, ChevronDown, ChevronUp, Save, X, Copy, MessageSquare, Link2, Unlink, Lock,
} from "lucide-react";

// ─── Types (miroir de ClientDetail) ──────────────────────────────────────────

interface Session {
  id: number;
  name: string;
  isExpanded: boolean;
  session_type: "renfo" | "cardio" | "recup";
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
  serie_details?: SerieDetail[] | string;
  super_set_group?: string | null;
  is_duration?: boolean;
  is_distance?: boolean;
  [key: string]: unknown;
}

interface WeekOption {
  week: number;
  year: number;
  monday: Date;
}

interface LibraryExercise {
  id: string;
  name: string;
  muscle_principal?: string | null;
  muscles_second?: string[] | null;
  [key: string]: unknown;
}

interface ExerciseFeedback {
  sportif_rpe?: string | null;
  sportif_comment?: string | null;
  skipped?: boolean;
}

interface MobileProgViewProps {
  sessions: Session[];
  sessionExercises: Record<number, Exercise[]>;
  selectedWeekToProgram: { week: number; year: number };
  availableWeeks: WeekOption[];
  isValidated: boolean;
  libraryExercises: LibraryExercise[];
  onWeekChange: (week: number, year: number) => void;
  onCreateSession: (type: "renfo" | "cardio" | "recup") => void;
  onDeleteSession: (sessionId: number, e: React.MouseEvent) => void;
  onAddExercise: (sessionId: number) => void;
  onDeleteExercise: (sessionId: number, exerciseId: number) => void;
  onExerciseChange: (sessionId: number, exerciseId: number, field: string, value: string) => void;
  onSerieDetailChange: (sessionId: number, exerciseId: number, serieIndex: number, field: string, value: string) => void;
  onToggleSuperSet?: (sessionId: number, exerciseId: number) => void;
  onSave: () => void;
  onUnvalidate?: () => void;
  isSaving?: boolean;
  hasPreviousWeeks?: boolean;
  onCopyPreviousWeek?: () => void;
  onOpenCopyDialog?: () => void;
  athleteVma?: number | null;
  copiedWeekFeedback?: Record<string, ExerciseFeedback>;
  onShowFeedback?: () => void;
  hasFeedback?: boolean;
}

function getSerieDetailsArray(value: SerieDetail[] | string | undefined): SerieDetail[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try { const p = JSON.parse(value as string); return Array.isArray(p) ? p : []; } catch { return []; }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

const SESSION_TYPE_CONFIG = {
  renfo: { label: "Renfo", color: "bg-primary/20 text-primary border-primary/30", icon: Dumbbell, createLabel: "Renforcement", emoji: "🏋️" },
  cardio: { label: "Cardio", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Heart, createLabel: "Cardio", emoji: "🏃" },
  recup: { label: "Récup", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: Zap, createLabel: "Récupération", emoji: "💆" },
} as const;

// ─── Stepper +/- réutilisable ─────────────────────────────────────────────────

function Stepper({ label, value, onChange, step = 1, min = 0, max, freeText = false }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: number;
  min?: number;
  max?: number;
  /** Si true : input texte libre, les boutons +/- incrémentent seulement si la valeur est numérique */
  freeText?: boolean;
}) {
  const dec = () => {
    const cur = parseFloat(value);
    if (isNaN(cur)) return;
    const next = Math.max(min, cur - step);
    onChange(String(next % 1 === 0 ? next : next.toFixed(1)));
  };
  const inc = () => {
    const cur = parseFloat(value) || 0;
    const next = max != null ? Math.min(max, cur + step) : cur + step;
    onChange(String(next % 1 === 0 ? next : next.toFixed(1)));
  };
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      <div className="flex items-center gap-2">
        <button type="button"
          className="h-11 w-11 rounded-xl border border-border bg-secondary flex items-center justify-center text-xl font-bold shrink-0 active:bg-muted"
          onClick={dec}>−</button>
        <Input
          type={freeText ? "text" : "number"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-11 text-center text-base font-semibold"
        />
        <button type="button"
          className="h-11 w-11 rounded-xl border border-border bg-secondary flex items-center justify-center text-xl font-bold shrink-0 active:bg-muted"
          onClick={inc}>+</button>
      </div>
    </div>
  );
}

// ─── Éditeur inline exercice renfo (pas de Sheet imbriqué) ────────────────────

function RenfoExerciseRow({
  exercise, sessionId, isValidated, libraryExercises, feedback, onChange, onSerieDetailChange, onDelete,
}: {
  exercise: Exercise;
  sessionId: number;
  isValidated: boolean;
  libraryExercises: LibraryExercise[];
  feedback?: ExerciseFeedback | null;
  onChange: (field: string, value: string) => void;
  onSerieDetailChange: (serieIndex: number, field: string, value: string) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const summary = [
    exercise.series && `${exercise.series}×`,
    exercise.reps && `${exercise.reps} reps`,
    exercise.charge && `${exercise.charge}kg`,
    exercise.rpe && `RPE ${exercise.rpe}`,
  ].filter(Boolean).join(" · ");

  return (
    <div className="border-b border-border/30 last:border-0">
      {/* En-tête de l'exercice — tap pour expand */}
      <div
        className="flex items-center gap-3 px-4 py-3 active:bg-muted/40 transition-colors cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <p className={cn("font-medium text-sm truncate", feedback?.skipped && "line-through text-muted-foreground")}>
            {exercise.exercice || <span className="text-muted-foreground italic">Sans nom</span>}
          </p>
          {summary && <p className="text-xs text-muted-foreground mt-0.5">{summary}</p>}
          {feedback && (
            <div className="mt-1 text-[10px] bg-primary/10 border-l-2 border-primary/50 rounded-r px-1.5 py-0.5">
              {feedback.skipped ? (
                <span className="text-destructive font-medium">⚠️ Non fait</span>
              ) : (
                <span className="text-muted-foreground">
                  {feedback.sportif_rpe && <span>RPE réel: <b className="text-foreground">{feedback.sportif_rpe}</b> </span>}
                  {feedback.sportif_comment && <span className="italic">"{feedback.sportif_comment}"</span>}
                </span>
              )}
            </div>
          )}
        </div>
        {!isValidated && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-2 text-muted-foreground active:text-destructive shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </div>

      {/* Contenu inline */}
      {expanded && (
        <div className="px-4 pb-5 space-y-4 bg-muted/20">
          {/* Nom */}
          <div className="space-y-1.5 pt-2">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Exercice</label>
            <ExerciseCombobox
              value={exercise.exercice}
              onChange={(v) => onChange("exercice", v)}
              exercises={libraryExercises}
              disabled={isValidated}
            />
          </div>

          {/* Steppers 2 colonnes */}
          <div className="grid grid-cols-2 gap-3">
            <Stepper label="Séries" value={exercise.series} onChange={(v) => onChange("series", v)} step={1} min={1} />

            {/* Reps / Durée / Distance avec toggle 3 modes */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {exercise.is_duration ? "Durée (sec)" : exercise.is_distance ? "Distance (m)" : "Reps"}
                </label>
                {!isValidated && (
                  <div className="flex items-center gap-1">
                    {/* Cycle between modes: reps → durée → distance → reps */}
                    {(() => {
                      const cycleMode = () => {
                        if (!exercise.is_duration && !exercise.is_distance) {
                          // reps → durée
                          onChange("is_duration", "true");
                          onChange("is_distance", "false");
                        } else if (exercise.is_duration) {
                          // durée → distance
                          onChange("is_duration", "false");
                          onChange("is_distance", "true");
                        } else {
                          // distance → reps
                          onChange("is_duration", "false");
                          onChange("is_distance", "false");
                        }
                      };
                      const label = exercise.is_duration ? "⏱ durée" : exercise.is_distance ? "📏 distance" : "🔢 reps";
                      const activeClass = (exercise.is_duration || exercise.is_distance)
                        ? "bg-primary/20 text-primary border-primary/40"
                        : "bg-secondary text-muted-foreground border-border/50";
                      return (
                        <button type="button" onClick={cycleMode}
                          className={cn("text-[9px] font-bold rounded-full px-2 py-0.5 border transition-colors", activeClass)}>
                          {label}
                        </button>
                      );
                    })()}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button type="button"
                  className="h-11 w-11 rounded-xl border border-border bg-secondary flex items-center justify-center text-xl font-bold shrink-0 active:bg-muted"
                  onClick={() => { const cur = parseFloat(exercise.reps) || 0; if (cur > 0) onChange("reps", String(cur - (exercise.is_duration ? 5 : exercise.is_distance ? 10 : 1))); }}
                  disabled={isValidated}>−</button>
                <Input
                  type="text"
                  value={exercise.reps}
                  onChange={(e) => onChange("reps", e.target.value)}
                  className="flex-1 h-11 text-center text-base font-semibold"
                  placeholder={exercise.is_duration ? "sec" : exercise.is_distance ? "m" : "10"}
                  disabled={isValidated}
                />
                <button type="button"
                  className="h-11 w-11 rounded-xl border border-border bg-secondary flex items-center justify-center text-xl font-bold shrink-0 active:bg-muted"
                  onClick={() => { const cur = parseFloat(exercise.reps) || 0; onChange("reps", String(cur + (exercise.is_duration ? 5 : exercise.is_distance ? 10 : 1))); }}
                  disabled={isValidated}>+</button>
              </div>
            </div>

            <Stepper label="Charge (kg)" value={exercise.charge} onChange={(v) => onChange("charge", v)} step={2.5} min={0} />
            <Stepper label="RPE" value={exercise.rpe} onChange={(v) => onChange("rpe", v)} step={0.5} min={1} max={10} />
          </div>

          {/* Récupération */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Récupération</label>
            <Select value={exercise.recuperation || "0s"} onValueChange={(v) => onChange("recuperation", v)} disabled={isValidated}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Récupération" />
              </SelectTrigger>
              <SelectContent>
                {RECUP_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tempo */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Tempo</label>
            <Input value={exercise.tempo} onChange={(e) => onChange("tempo", e.target.value)}
              placeholder="Ex: 3010" className="h-11 text-center font-mono" disabled={isValidated} />
          </div>

          {/* ── Séries individualisées ──────────────────────────── */}
          {(() => {
            const details = getSerieDetailsArray(exercise.serie_details);
            if (details.length < 2) return null;
            return (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border/60" />
                  <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">
                    Séries individuelles
                  </span>
                  <div className="h-px flex-1 bg-border/60" />
                </div>
                <div className="space-y-3">
                  {details.map((serie, si) => (
                    <div key={si} className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                      <p className="text-xs font-bold text-primary">Série {si + 1}</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Reps</label>
                          <Input
                            type="text"
                            value={serie.reps || ""}
                            onChange={(e) => onSerieDetailChange(si, "reps", e.target.value)}
                            placeholder={exercise.reps || "—"}
                            className="h-10 text-center text-sm font-semibold"
                            disabled={isValidated}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Charge</label>
                          <Input
                            type="text"
                            value={serie.charge || ""}
                            onChange={(e) => onSerieDetailChange(si, "charge", e.target.value)}
                            placeholder={exercise.charge || "kg"}
                            className="h-10 text-center text-sm font-semibold"
                            disabled={isValidated}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">RPE</label>
                          <Input
                            type="text"
                            value={serie.rpe || ""}
                            onChange={(e) => onSerieDetailChange(si, "rpe", e.target.value)}
                            placeholder={exercise.rpe || "—"}
                            className="h-10 text-center text-sm font-semibold"
                            disabled={isValidated}
                          />
                        </div>
                      </div>
                      {(serie.tempo !== undefined || serie.commentaire !== undefined) && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Tempo</label>
                            <Input
                              type="text"
                              value={serie.tempo || ""}
                              onChange={(e) => onSerieDetailChange(si, "tempo", e.target.value)}
                              placeholder="3010"
                              className="h-9 text-center text-xs font-mono"
                              disabled={isValidated}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Note</label>
                            <Input
                              type="text"
                              value={serie.commentaire || ""}
                              onChange={(e) => onSerieDetailChange(si, "commentaire", e.target.value)}
                              placeholder="…"
                              className="h-9 text-xs"
                              disabled={isValidated}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Commentaire global */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Commentaire</label>
            <Input value={exercise.commentaire} onChange={(e) => onChange("commentaire", e.target.value)}
              placeholder="Consignes…" className="h-11" disabled={isValidated} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Couleurs superset ────────────────────────────────────────────────────────

const SUPERSET_COLORS = [
  { border: "border-orange-400", bg: "bg-orange-400/10", text: "text-orange-400", badge: "bg-orange-400/20 text-orange-400 border-orange-400/40", dot: "bg-orange-400" },
  { border: "border-purple-400", bg: "bg-purple-400/10", text: "text-purple-400", badge: "bg-purple-400/20 text-purple-400 border-purple-400/40", dot: "bg-purple-400" },
  { border: "border-cyan-400",   bg: "bg-cyan-400/10",   text: "text-cyan-400",   badge: "bg-cyan-400/20 text-cyan-400 border-cyan-400/40",   dot: "bg-cyan-400"   },
  { border: "border-pink-400",   bg: "bg-pink-400/10",   text: "text-pink-400",   badge: "bg-pink-400/20 text-pink-400 border-pink-400/40",   dot: "bg-pink-400"   },
];

function getSupersetColorIndex(group: string, allGroups: string[]): number {
  const idx = allGroups.indexOf(group);
  return idx >= 0 ? idx % SUPERSET_COLORS.length : 0;
}

// ─── Sous-composant : carte session ──────────────────────────────────────────

function SessionCard({
  session, exercises, isValidated, athleteVma, libraryExercises, copiedWeekFeedback,
  onDelete, onAddExercise, onDeleteExercise, onExerciseChange, onSerieDetailChange, onToggleSuperSet,
}: {
  session: Session;
  exercises: Exercise[];
  isValidated: boolean;
  athleteVma?: number | null;
  libraryExercises: LibraryExercise[];
  copiedWeekFeedback?: Record<string, ExerciseFeedback>;
  onDelete: (e: React.MouseEvent) => void;
  onAddExercise: () => void;
  onDeleteExercise: (exerciseId: number) => void;
  onExerciseChange: (exerciseId: number, field: string, value: string) => void;
  onSerieDetailChange: (exerciseId: number, serieIndex: number, field: string, value: string) => void;
  onToggleSuperSet?: (exerciseId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const cfg = SESSION_TYPE_CONFIG[session.session_type];

  // Données cardio du premier exercice
  const cardioExercise = exercises[0];
  const cardioData: CardioData = (() => {
    if (!cardioExercise?.cardio_content) return { steps: [], blocks: [] };
    try { return JSON.parse(cardioExercise.cardio_content); } catch { return { steps: [], blocks: [] }; }
  })();
  const cardioSport = (cardioExercise?.cardio_sport as "course" | "velo" | "natation" | undefined) || "course";

  // Distance & durée pour séances cardio
  const cardioStats = (() => {
    if (session.session_type !== "cardio") return null;
    let totalKm = 0;
    let totalSec = 0;
    for (const ex of exercises) {
      if (!(ex as any).cardio_content) continue;
      try {
        const parsed = JSON.parse((ex as any).cardio_content);
        const data = Array.isArray(parsed) ? { steps: parsed, blocks: [] } : parsed;
        const m = calculateCardioMetrics(data, athleteVma);
        totalKm += m.totalDistanceKm;
        totalSec += m.totalDurationMinutes * 60;
      } catch { /* ignore */ }
    }
    if (totalKm <= 0 && totalSec <= 0) return null;
    return {
      dist: totalKm >= 1 ? `${totalKm.toFixed(1)} km` : totalKm > 0 ? `${Math.round(totalKm * 1000)} m` : null,
      dur: totalSec > 0 ? formatCardioSessionDuration(Math.round(totalSec)) : null,
    };
  })();

  // Completion status from athlete data (direct exercise fields)
  const completionStatus: "none" | "partial" | "full" = (() => {
    if (exercises.length === 0) return "none";
    const doneCount = exercises.filter((ex: any) =>
      ex.skipped === true ||
      ex.sportif_rpe != null ||
      ex.actual_distance_km != null ||
      ex.actual_duration_minutes != null ||
      ex.actual_pace_min_per_km != null ||
      ex.actual_avg_heart_rate != null
    ).length;
    if (doneCount === 0) return "none";
    if (doneCount === exercises.length) return "full";
    return "partial";
  })();

  const statusDot =
    completionStatus === "full"
      ? "bg-emerald-500"
      : completionStatus === "partial"
      ? "bg-amber-400"
      : "bg-muted-foreground/30";

  return (
    <>
      {/* Carte tap pour ouvrir */}
      <div
        className="rounded-2xl border border-border/60 bg-card p-4 active:bg-card/80 transition-colors cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {/* Completion dot */}
              <div
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDot}`}
                title={
                  completionStatus === "full"
                    ? "Séance terminée"
                    : completionStatus === "partial"
                    ? "Séance partiellement faite"
                    : "Non effectuée"
                }
              />
              <span className="text-base font-bold">{session.name}</span>
              <Badge variant="outline" className={cn("text-xs", cfg.color)}>
                {cfg.emoji} {cfg.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {exercises.length > 0
                ? [
                    `${exercises.length} exercice${exercises.length > 1 ? "s" : ""}`,
                    cardioStats?.dist,
                    cardioStats?.dur,
                  ].filter(Boolean).join(" · ")
                : "Vide — tap pour ajouter"}
            </p>
          </div>
          {!isValidated && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(e); }}
              className="p-2 text-muted-foreground active:text-destructive transition-colors shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Preview des 2 premiers exercices (renfo) */}
        {session.session_type === "renfo" && exercises.length > 0 && (() => {
          const allGroups = [...new Set(exercises.filter(e => e.super_set_group).map(e => e.super_set_group as string))];
          const hasSupersets = allGroups.length > 0;
          return (
            <div className="mt-3 space-y-1">
              {hasSupersets && (
                <div className="flex items-center gap-1 mb-1.5">
                  <Link2 className="h-3 w-3 text-orange-400" />
                  <span className="text-[10px] text-orange-400 font-medium">
                    {allGroups.length} superset{allGroups.length > 1 ? "s" : ""}
                  </span>
                </div>
              )}
              {exercises.slice(0, 2).map((ex) => {
                const colorIdx = ex.super_set_group ? getSupersetColorIndex(ex.super_set_group, allGroups) : -1;
                const color = colorIdx >= 0 ? SUPERSET_COLORS[colorIdx] : null;
                return (
                  <div key={ex.id} className={cn("text-xs text-muted-foreground flex items-center gap-1.5 rounded px-1", color?.bg)}>
                    {color
                      ? <Link2 className={cn("h-2.5 w-2.5 shrink-0", color.text)} />
                      : <div className="h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />}
                    <span className="truncate">{ex.exercice || "—"}</span>
                    {ex.series && ex.reps && (
                      <span className="shrink-0 opacity-60">{ex.series}×{ex.reps}</span>
                    )}
                  </div>
                );
              })}
              {exercises.length > 2 && (
                <p className="text-xs text-muted-foreground/50">+{exercises.length - 2} autre{exercises.length - 2 > 1 ? "s" : ""}…</p>
              )}
            </div>
          );
        })()}

        {/* Preview cardio */}
        {session.session_type === "cardio" && (() => {
          const rpe = (cardioExercise as any)?.sportif_rpe != null ? Number((cardioExercise as any).sportif_rpe) : null;
          const rpeColor = rpe === null ? "text-green-400"
            : rpe <= 4 ? "text-green-400"
            : rpe <= 6 ? "text-yellow-400"
            : rpe <= 8 ? "text-orange-400"
            : "text-red-400";
          const rpeDot = rpe === null ? "bg-green-400"
            : rpe <= 4 ? "bg-green-400"
            : rpe <= 6 ? "bg-yellow-400"
            : rpe <= 8 ? "bg-orange-400"
            : "bg-red-400";

          return (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-muted-foreground">
                {cardioData.steps.length > 0
                  ? `${cardioData.steps.length} étape${cardioData.steps.length > 1 ? "s" : ""}`
                  : "Tap pour configurer"}
              </p>
              {/* Commentaire coach */}
              {cardioExercise?.commentaire && (
                <p className={`text-xs italic truncate ${rpe !== null ? rpeColor + "/80" : "text-muted-foreground/70"}`}>
                  📝 {cardioExercise.commentaire}
                </p>
              )}
              {/* Retour sportif en preview */}
              {cardioExercise && (cardioExercise.actual_distance_km != null || cardioExercise.actual_duration_minutes != null) && (
                <div className={`flex items-center gap-2 text-xs font-medium ${rpeColor}`}>
                  <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${rpeDot}`} />
                  {cardioExercise.actual_distance_km != null && (
                    <span>{Number(cardioExercise.actual_distance_km).toFixed(1)} km réalisé</span>
                  )}
                  {cardioExercise.actual_duration_minutes != null && (
                    <span>· {Math.floor(Number(cardioExercise.actual_duration_minutes) / 60)}h{Math.round(Number(cardioExercise.actual_duration_minutes) % 60).toString().padStart(2, "0")}</span>
                  )}
                  {rpe !== null && <span className="opacity-70">· RPE {rpe}</span>}
                  {(cardioExercise as any).linked_strava_activity_id && <span className="text-orange-400">· Strava</span>}
                </div>
              )}
              {/* Commentaire sportif en preview */}
              {cardioExercise && (cardioExercise as any).sportif_comment && (
                <p className={`text-xs italic truncate ${rpeColor}/80`}>
                  💬 "{(cardioExercise as any).sportif_comment}"
                </p>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Sheet détail session ─────────────────────────────────────── */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[92dvh] flex flex-col p-0 rounded-t-2xl">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/40 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-base">{session.name}</SheetTitle>
                <Badge variant="outline" className={cn("text-xs", cfg.color)}>{cfg.emoji} {cfg.label}</Badge>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">

            {/* ─── Renfo : liste d'exercices inline ─── */}
            {session.session_type === "renfo" && (
              <>
                {exercises.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground px-6">
                    <Dumbbell className="h-8 w-8 opacity-30" />
                    <p className="text-sm text-center">Aucun exercice — ajoute le premier ci-dessous.</p>
                  </div>
                ) : (() => {
                  const allGroups = [...new Set(exercises.filter(e => e.super_set_group).map(e => e.super_set_group as string))];
                  return (
                    <div>
                      {exercises.map((ex, idx) => {
                        const prevEx = exercises[idx - 1];
                        const nextEx = exercises[idx + 1];
                        const colorIdx = ex.super_set_group ? getSupersetColorIndex(ex.super_set_group, allGroups) : -1;
                        const color = colorIdx >= 0 ? SUPERSET_COLORS[colorIdx] : null;
                        const isFirstInGroup = !!(ex.super_set_group && (!prevEx?.super_set_group || prevEx.super_set_group !== ex.super_set_group));
                        const isLastInGroup = !!(ex.super_set_group && (!nextEx?.super_set_group || nextEx.super_set_group !== ex.super_set_group));
                        const linkedWithNext = !!(ex.super_set_group && nextEx?.super_set_group && ex.super_set_group === nextEx.super_set_group);
                        const groupSize = ex.super_set_group ? exercises.filter(e => e.super_set_group === ex.super_set_group).length : 0;

                        return (
                          <div key={ex.id}>
                            {/* Header visible pour le premier exercice du groupe */}
                            {isFirstInGroup && color && (
                              <div className={cn("flex items-center gap-2 px-4 py-1.5 border-l-4", color.border, color.bg)}>
                                <Link2 className={cn("h-3.5 w-3.5 shrink-0", color.text)} />
                                <span className={cn("text-[10px] font-bold uppercase tracking-wider", color.text)}>
                                  Superset · {groupSize} exercices
                                </span>
                              </div>
                            )}

                            {/* Exercice avec bordure et fond colorés si dans un groupe */}
                            <div className={cn(color && "border-l-4", color?.border, color?.bg)}>
                              <RenfoExerciseRow
                                exercise={ex}
                                sessionId={session.id}
                                isValidated={isValidated}
                                libraryExercises={libraryExercises}
                                feedback={copiedWeekFeedback?.[`${session.id}-${ex.exercice}`] ?? null}
                                onChange={(field, value) => onExerciseChange(ex.id, field, value)}
                                onSerieDetailChange={(si, field, value) => onSerieDetailChange(ex.id, si, field, value)}
                                onDelete={() => onDeleteExercise(ex.id)}
                              />
                            </div>

                            {/* Connecteur visuel entre exercices du même groupe (toujours visible) */}
                            {linkedWithNext && color && (
                              <div className={cn("flex items-center gap-3 px-4 py-0 border-l-4", color.border, color.bg)}>
                                <div className={cn("w-0.5 h-5 ml-1 rounded-full opacity-40", color.dot)} />
                              </div>
                            )}

                            {/* Bouton toggle superset (mode édition seulement) */}
                            {!isValidated && onToggleSuperSet && idx < exercises.length - 1 && !linkedWithNext && (
                              <div className="flex items-center gap-2 px-4 py-1.5">
                                <div className="h-px flex-1 border-t border-border/30 border-dashed" />
                                <button
                                  onClick={() => onToggleSuperSet(ex.id)}
                                  className="flex items-center gap-1 text-[10px] font-semibold rounded-full px-2.5 py-1 border border-border/50 text-muted-foreground bg-secondary active:bg-muted transition-colors shrink-0"
                                >
                                  <Link2 className="h-3 w-3" /> Superset
                                </button>
                                <div className="h-px flex-1 border-t border-border/30 border-dashed" />
                              </div>
                            )}

                            {/* Bouton Délier (mode édition, exercices liés) */}
                            {!isValidated && onToggleSuperSet && linkedWithNext && color && (
                              <div className={cn("flex justify-end px-4 py-1 border-l-4", color.border, color.bg)}>
                                <button
                                  onClick={() => onToggleSuperSet(ex.id)}
                                  className={cn("flex items-center gap-1 text-[10px] font-semibold rounded-full px-2.5 py-1 border active:opacity-70", color.badge)}
                                >
                                  <Unlink className="h-3 w-3" /> Délier
                                </button>
                              </div>
                            )}

                            {/* Espacement après la fin d'un groupe */}
                            {isLastInGroup && color && <div className="h-2" />}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )}

            {/* ─── Cardio : CardioStepBuilder complet ─── */}
            {session.session_type === "cardio" && (
              <div className="px-4 py-4 space-y-4">

                {/* ── Retours du sportif — collapsible en haut ── */}
                {cardioExercise && (
                  cardioExercise.actual_distance_km != null ||
                  cardioExercise.actual_duration_minutes != null ||
                  (cardioExercise as any).actual_avg_heart_rate != null ||
                  (cardioExercise as any).sportif_rpe != null ||
                  (cardioExercise as any).sportif_comment
                ) && (() => {
                  const feedbackDate = (cardioExercise as any).sportif_feedback_at
                    ? new Date((cardioExercise as any).sportif_feedback_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
                    : null;
                  return (
                    <div className="rounded-xl border border-green-500/30 bg-green-500/8 overflow-hidden">
                      {/* Header cliquable */}
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-4 py-3 active:bg-green-500/10 transition-colors"
                        onClick={() => setFeedbackOpen((v) => !v)}
                      >
                        <div className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                        <div className="flex-1 text-left">
                          <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">
                            Retour du sportif
                          </span>
                          {feedbackDate && (
                            <span className="ml-2 text-[10px] font-normal text-green-600/70">· {feedbackDate}</span>
                          )}
                          {(cardioExercise as any).linked_strava_activity_id && (
                            <span className="ml-2 text-[10px] font-normal text-orange-500">via Strava</span>
                          )}
                        </div>
                        {feedbackOpen
                          ? <ChevronUp className="h-4 w-4 text-green-600/70 shrink-0" />
                          : <ChevronDown className="h-4 w-4 text-green-600/70 shrink-0" />
                        }
                      </button>

                      {/* Contenu dépliable */}
                      {feedbackOpen && (
                        <div className="px-4 pb-4 space-y-3 border-t border-green-500/20">
                          <div className="grid grid-cols-2 gap-2 pt-3">
                            {cardioExercise.actual_distance_km != null && (
                              <div className="bg-background/60 rounded-lg px-3 py-2">
                                <p className="text-[10px] text-muted-foreground uppercase">Distance</p>
                                <p className="text-base font-bold">{Number(cardioExercise.actual_distance_km).toFixed(1)} <span className="text-xs font-normal text-muted-foreground">km</span></p>
                              </div>
                            )}
                            {cardioExercise.actual_duration_minutes != null && (
                              <div className="bg-background/60 rounded-lg px-3 py-2">
                                <p className="text-[10px] text-muted-foreground uppercase">Durée</p>
                                <p className="text-base font-bold">
                                  {Math.floor(Number(cardioExercise.actual_duration_minutes) / 60)}h{Math.round(Number(cardioExercise.actual_duration_minutes) % 60).toString().padStart(2, "0")}
                                </p>
                              </div>
                            )}
                            {(cardioExercise as any).actual_avg_heart_rate != null && (
                              <div className="bg-background/60 rounded-lg px-3 py-2">
                                <p className="text-[10px] text-muted-foreground uppercase">FC moy.</p>
                                <p className="text-base font-bold">{(cardioExercise as any).actual_avg_heart_rate} <span className="text-xs font-normal text-muted-foreground">bpm</span></p>
                              </div>
                            )}
                            {(cardioExercise as any).actual_max_heart_rate != null && (
                              <div className="bg-background/60 rounded-lg px-3 py-2">
                                <p className="text-[10px] text-muted-foreground uppercase">FC max</p>
                                <p className="text-base font-bold">{(cardioExercise as any).actual_max_heart_rate} <span className="text-xs font-normal text-muted-foreground">bpm</span></p>
                              </div>
                            )}
                            {(cardioExercise as any).actual_cadence != null && (
                              <div className="bg-background/60 rounded-lg px-3 py-2">
                                <p className="text-[10px] text-muted-foreground uppercase">Cadence</p>
                                <p className="text-base font-bold">{Math.round((cardioExercise as any).actual_cadence)} <span className="text-xs font-normal text-muted-foreground">spm</span></p>
                              </div>
                            )}
                            {(cardioExercise as any).actual_elevation_gain != null && (cardioExercise as any).actual_elevation_gain > 0 && (
                              <div className="bg-background/60 rounded-lg px-3 py-2">
                                <p className="text-[10px] text-muted-foreground uppercase">Dénivelé</p>
                                <p className="text-base font-bold">+{Math.round((cardioExercise as any).actual_elevation_gain)} <span className="text-xs font-normal text-muted-foreground">m</span></p>
                              </div>
                            )}
                            {(cardioExercise as any).actual_calories != null && (
                              <div className="bg-background/60 rounded-lg px-3 py-2">
                                <p className="text-[10px] text-muted-foreground uppercase">Calories</p>
                                <p className="text-base font-bold">{(cardioExercise as any).actual_calories} <span className="text-xs font-normal text-muted-foreground">kcal</span></p>
                              </div>
                            )}
                            {(cardioExercise as any).sportif_rpe != null && (
                              <div className="bg-background/60 rounded-lg px-3 py-2">
                                <p className="text-[10px] text-muted-foreground uppercase">RPE ressenti</p>
                                <p className="text-base font-bold">{(cardioExercise as any).sportif_rpe} <span className="text-xs font-normal text-muted-foreground">/10</span></p>
                              </div>
                            )}
                          </div>
                          {(cardioExercise as any).sportif_comment && (
                            <p className="text-xs text-muted-foreground italic border-t border-green-500/20 pt-2">
                              "{(cardioExercise as any).sportif_comment}"
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <CardioStepBuilder
                  steps={cardioData.steps}
                  blocks={cardioData.blocks}
                  onChange={(newData: CardioData) => {
                    if (cardioExercise) {
                      onExerciseChange(cardioExercise.id, "cardio_content", JSON.stringify(newData));
                    }
                  }}
                  athleteVma={athleteVma}
                  disabled={isValidated}
                  sportType={cardioSport !== "yoga" && cardioSport !== "hiit" ? cardioSport : "course"}
                />
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Commentaire</label>
                  <Input
                    value={cardioExercise?.commentaire || ""}
                    onChange={(e) => cardioExercise && onExerciseChange(cardioExercise.id, "commentaire", e.target.value)}
                    placeholder="Consignes pour l'athlète…"
                    className="h-11"
                    disabled={isValidated}
                  />
                </div>
              </div>
            )}

            {/* ─── Récup ─── */}
            {session.session_type === "recup" && (
              <div className="px-4 py-4 space-y-4">
                {exercises.map((ex) => (
                  <div key={ex.id} className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Activité</label>
                      <Input value={ex.exercice} onChange={(e) => onExerciseChange(ex.id, "exercice", e.target.value)}
                        placeholder="Ex: Étirements, Yoga…" className="h-11" disabled={isValidated} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Commentaire</label>
                      <Input value={ex.commentaire} onChange={(e) => onExerciseChange(ex.id, "commentaire", e.target.value)}
                        placeholder="Consignes…" className="h-11" disabled={isValidated} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer : ajouter exercice (renfo uniquement) */}
          {!isValidated && session.session_type === "renfo" && (
            <div className="px-5 py-4 border-t border-border/40 shrink-0">
              <Button className="w-full h-12 text-base gap-2" variant="outline" onClick={onAddExercise}>
                <Plus className="h-5 w-5" />
                Ajouter un exercice
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function MobileProgView({
  sessions, sessionExercises, selectedWeekToProgram, availableWeeks,
  isValidated, libraryExercises, onWeekChange, onCreateSession, onDeleteSession,
  onAddExercise, onDeleteExercise, onExerciseChange, onSerieDetailChange, onToggleSuperSet,
  onSave, onUnvalidate, isSaving,
  hasPreviousWeeks, onCopyPreviousWeek, onOpenCopyDialog, athleteVma,
  copiedWeekFeedback, onShowFeedback, hasFeedback,
}: MobileProgViewProps) {
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  const currentIndex = availableWeeks.findIndex(
    (w) => w.week === selectedWeekToProgram.week && w.year === selectedWeekToProgram.year,
  );
  const currentWeek = availableWeeks[currentIndex];
  const prevWeek = availableWeeks[currentIndex - 1];
  const nextWeek = availableWeeks[currentIndex + 1];

  return (
    <div className="flex flex-col min-h-0">

      {/* ── Navigation semaine ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => prevWeek && onWeekChange(prevWeek.week, prevWeek.year)}
          disabled={!prevWeek}
          className="h-10 w-10 rounded-xl border border-border flex items-center justify-center disabled:opacity-30 active:bg-muted transition-colors shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 text-center">
          <p className="font-bold text-sm">
            S{selectedWeekToProgram.week} – {selectedWeekToProgram.year}
          </p>
          {currentWeek && (
            <p className="text-xs text-muted-foreground">
              {formatWeekRange(currentWeek.monday)}
            </p>
          )}
        </div>
        <button
          onClick={() => nextWeek && onWeekChange(nextWeek.week, nextWeek.year)}
          disabled={!nextWeek}
          className="h-10 w-10 rounded-xl border border-border flex items-center justify-center disabled:opacity-30 active:bg-muted transition-colors shrink-0"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* ── Bannière semaine verrouillée ────────────────────────────── */}
      {isValidated && onUnvalidate && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10">
          <Lock className="h-4 w-4 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-400 flex-1">Semaine verrouillée</p>
          <button
            onClick={onUnvalidate}
            className="text-xs font-semibold text-amber-400 border border-amber-400/50 rounded-lg px-2.5 py-1 active:bg-amber-400/20 transition-colors shrink-0"
          >
            Modifier
          </button>
        </div>
      )}

      {/* ── Retours athlète (semaine copiée) ─────────────────────────── */}
      {hasFeedback && onShowFeedback && (
        <button
          onClick={onShowFeedback}
          className="w-full mb-2 h-9 rounded-xl border border-primary/40 bg-primary/10 flex items-center justify-center gap-1.5 text-xs text-primary active:bg-primary/20 transition-colors"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Voir les retours de l'athlète
        </button>
      )}

      {/* ── Copier une semaine précédente ───────────────────────────────── */}
      {!isValidated && hasPreviousWeeks && (
        <div className="flex gap-2 mb-3">
          {onCopyPreviousWeek && (
            <button
              onClick={onCopyPreviousWeek}
              className="flex-1 h-9 rounded-xl border border-border flex items-center justify-center gap-1.5 text-xs text-muted-foreground active:bg-muted transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
              Copier précédente
            </button>
          )}
          {onOpenCopyDialog && (
            <button
              onClick={onOpenCopyDialog}
              className="flex-1 h-9 rounded-xl border border-border flex items-center justify-center gap-1.5 text-xs text-muted-foreground active:bg-muted transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
              Autre semaine
            </button>
          )}
        </div>
      )}

      {/* ── Liste des séances ───────────────────────────────────────────── */}
      <div className="space-y-3 flex-1">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted-foreground">
            <div className="h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center">
              <Dumbbell className="h-8 w-8 opacity-40" />
            </div>
            <div className="text-center">
              <p className="font-medium">Aucune séance cette semaine</p>
              <p className="text-sm opacity-70 mt-1">Crée ta première séance avec le bouton +</p>
            </div>
          </div>
        ) : (
          sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              exercises={sessionExercises[session.id] || []}
              isValidated={isValidated}
              athleteVma={athleteVma}
              libraryExercises={libraryExercises}
              copiedWeekFeedback={copiedWeekFeedback}
              onSerieDetailChange={(exId, si, field, value) => onSerieDetailChange(session.id, exId, si, field, value)}
              onDelete={(e) => onDeleteSession(session.id, e)}
              onAddExercise={() => onAddExercise(session.id)}
              onDeleteExercise={(exId) => onDeleteExercise(session.id, exId)}
              onExerciseChange={(exId, field, value) => onExerciseChange(session.id, exId, field, value)}
              onToggleSuperSet={onToggleSuperSet ? (exId) => onToggleSuperSet(session.id, exId) : undefined}
            />
          ))
        )}
      </div>

      {/* ── FAB + Sauvegarder ───────────────────────────────────────────── */}
      {!isValidated && (
        <div className="fixed bottom-6 right-4 flex flex-col gap-3 z-30">
          {sessions.length > 0 && (
            <Button
              onClick={onSave}
              disabled={isSaving}
              size="sm"
              className="h-12 px-4 rounded-2xl shadow-lg gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "…" : "Sauver"}
            </Button>
          )}
          <button
            onClick={() => setShowCreateSheet(true)}
            className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Créer une séance"
          >
            <Plus className="h-7 w-7" />
          </button>
        </div>
      )}

      {/* ── Sheet création de séance ─────────────────────────────────────── */}
      <Sheet open={showCreateSheet} onOpenChange={setShowCreateSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl p-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/40">
            <SheetTitle className="text-base">Nouvelle séance</SheetTitle>
          </SheetHeader>
          <div className="px-5 py-5 space-y-3">
            {(["renfo", "cardio", "recup"] as const).map((type) => {
              const cfg = SESSION_TYPE_CONFIG[type];
              const Icon = cfg.icon;
              return (
                <button
                  key={type}
                  onClick={() => {
                    onCreateSession(type);
                    setShowCreateSheet(false);
                  }}
                  className={cn(
                    "w-full h-16 rounded-2xl border-2 flex items-center gap-4 px-5 active:scale-[0.98] transition-transform",
                    cfg.color,
                  )}
                >
                  <Icon className="h-6 w-6 shrink-0" />
                  <div className="text-left">
                    <p className="font-bold text-sm">{cfg.emoji} {cfg.createLabel}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
