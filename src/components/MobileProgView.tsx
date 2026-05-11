import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExerciseCombobox } from "@/components/ExerciseCombobox";
import { RECUP_OPTIONS } from "@/lib/groqVoiceCommand";
import { formatWeekRange } from "@/lib/weekUtils";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, ChevronRight, Plus, Dumbbell, Heart, Zap,
  Trash2, ChevronDown, ChevronUp, Save, X, Copy,
} from "lucide-react";

// ─── Types (miroir de ClientDetail) ──────────────────────────────────────────

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
}

interface WeekOption {
  week: number;
  year: number;
  monday: Date;
}

interface MobileProgViewProps {
  sessions: Session[];
  sessionExercises: Record<number, Exercise[]>;
  selectedWeekToProgram: { week: number; year: number };
  availableWeeks: WeekOption[];
  isValidated: boolean;
  onWeekChange: (week: number, year: number) => void;
  onCreateSession: (type: "renfo" | "cardio" | "recup") => void;
  onDeleteSession: (sessionId: number, e: React.MouseEvent) => void;
  onAddExercise: (sessionId: number) => void;
  onDeleteExercise: (sessionId: number, exerciseId: number) => void;
  onExerciseChange: (sessionId: number, exerciseId: number, field: string, value: string) => void;
  onSave: () => void;
  isSaving?: boolean;
  hasPreviousWeeks?: boolean;
  onCopyPreviousWeek?: () => void;
  onOpenCopyDialog?: () => void;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

const SESSION_TYPE_CONFIG = {
  renfo: { label: "Renfo", color: "bg-primary/20 text-primary border-primary/30", icon: Dumbbell, createLabel: "Renforcement", emoji: "🏋️" },
  cardio: { label: "Cardio", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Heart, createLabel: "Cardio", emoji: "🏃" },
  recup: { label: "Récup", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: Zap, createLabel: "Récupération", emoji: "💆" },
} as const;

// ─── Sous-composant : ligne d'exercice éditable ───────────────────────────────

function ExerciseEditor({
  exercise, sessionId, sessionType, isValidated, onChange, onDelete,
}: {
  exercise: Exercise;
  sessionId: number;
  sessionType: "renfo" | "cardio" | "recup";
  isValidated: boolean;
  onChange: (field: string, value: string) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  const summary = [
    exercise.series && `${exercise.series} séries`,
    exercise.reps && `× ${exercise.reps}`,
    exercise.charge && `@ ${exercise.charge}kg`,
    exercise.rpe && `RPE ${exercise.rpe}`,
  ].filter(Boolean).join(" ");

  return (
    <>
      {/* Ligne résumé — tap pour ouvrir l'éditeur */}
      <div
        className="flex items-center gap-3 px-4 py-3 active:bg-muted/50 transition-colors"
        onClick={() => !isValidated && setOpen(true)}
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {exercise.exercice || <span className="text-muted-foreground italic">Sans nom</span>}
          </p>
          {summary && <p className="text-xs text-muted-foreground mt-0.5">{summary}</p>}
        </div>
        {!isValidated && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-2 text-muted-foreground hover:text-destructive transition-colors shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        {!isValidated && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>

      {/* Sheet d'édition des paramètres */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[85dvh] flex flex-col p-0 rounded-t-2xl">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/40 shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base">Modifier l'exercice</SheetTitle>
              <button onClick={() => setOpen(false)} className="p-1 text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Nom */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Exercice</label>
              {sessionType === "renfo" ? (
                <ExerciseCombobox
                  value={exercise.exercice}
                  onChange={(v) => onChange("exercice", v)}
                  disabled={isValidated}
                />
              ) : (
                <Input value={exercise.exercice} onChange={(e) => onChange("exercice", e.target.value)} className="h-11" />
              )}
            </div>

            {sessionType === "renfo" && (
              <>
                {/* Séries / Reps / Charge / RPE — gros +/- */}
                {[
                  { field: "series", label: "Séries", placeholder: "3", step: 1, min: 1 },
                  { field: "reps", label: "Reps", placeholder: "10", step: 1, min: 1 },
                  { field: "charge", label: "Charge (kg)", placeholder: "0", step: 2.5, min: 0 },
                  { field: "rpe", label: "RPE", placeholder: "7", step: 0.5, min: 1, max: 10 },
                ].map(({ field, label, placeholder, step, min, max }) => (
                  <div key={field} className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="h-12 w-12 rounded-xl border border-border bg-secondary flex items-center justify-center text-xl font-bold shrink-0 active:bg-muted"
                        onClick={() => {
                          const cur = parseFloat(exercise[field as keyof Exercise] as string) || 0;
                          const next = Math.max(min ?? 0, cur - step);
                          onChange(field, String(next % 1 === 0 ? next : next.toFixed(1)));
                        }}
                      >−</button>
                      <Input
                        type="number"
                        value={exercise[field as keyof Exercise] as string}
                        onChange={(e) => onChange(field, e.target.value)}
                        placeholder={placeholder}
                        className="flex-1 h-12 text-center text-lg font-semibold"
                        disabled={isValidated}
                      />
                      <button
                        type="button"
                        className="h-12 w-12 rounded-xl border border-border bg-secondary flex items-center justify-center text-xl font-bold shrink-0 active:bg-muted"
                        onClick={() => {
                          const cur = parseFloat(exercise[field as keyof Exercise] as string) || 0;
                          const next = max != null ? Math.min(max, cur + step) : cur + step;
                          onChange(field, String(next % 1 === 0 ? next : next.toFixed(1)));
                        }}
                      >+</button>
                    </div>
                  </div>
                ))}

                {/* Récupération */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Récupération</label>
                  <Select value={exercise.recuperation || "0s"} onValueChange={(v) => onChange("recuperation", v)} disabled={isValidated}>
                    <SelectTrigger className="h-12">
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
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tempo</label>
                  <Input
                    value={exercise.tempo}
                    onChange={(e) => onChange("tempo", e.target.value)}
                    placeholder="Ex: 3010"
                    className="h-12 text-center font-mono text-base"
                    disabled={isValidated}
                  />
                </div>
              </>
            )}

            {/* Commentaire */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Note / Commentaire</label>
              <Input
                value={exercise.commentaire}
                onChange={(e) => onChange("commentaire", e.target.value)}
                placeholder="Consignes pour l'athlète…"
                className="h-12"
                disabled={isValidated}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-border/40 shrink-0">
            <Button className="w-full h-12 text-base" onClick={() => setOpen(false)}>
              Valider
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Sous-composant : carte session ──────────────────────────────────────────

function SessionCard({
  session, exercises, isValidated,
  onDelete, onAddExercise, onDeleteExercise, onExerciseChange,
}: {
  session: Session;
  exercises: Exercise[];
  isValidated: boolean;
  onDelete: (e: React.MouseEvent) => void;
  onAddExercise: () => void;
  onDeleteExercise: (exerciseId: number) => void;
  onExerciseChange: (exerciseId: number, field: string, value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const cfg = SESSION_TYPE_CONFIG[session.session_type];

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
              <span className="text-base font-bold">{session.name}</span>
              <Badge variant="outline" className={cn("text-xs", cfg.color)}>
                {cfg.emoji} {cfg.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {exercises.length > 0
                ? `${exercises.length} exercice${exercises.length > 1 ? "s" : ""}`
                : "Vide — tap pour ajouter"}
            </p>
          </div>
          {!isValidated && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(e); }}
              className="p-2 text-muted-foreground hover:text-destructive transition-colors shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Preview des 2 premiers exercices */}
        {exercises.length > 0 && (
          <div className="mt-3 space-y-1">
            {exercises.slice(0, 2).map((ex) => (
              <div key={ex.id} className="text-xs text-muted-foreground flex items-center gap-1.5">
                <div className="h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                <span className="truncate">{ex.exercice || "—"}</span>
                {ex.series && ex.reps && (
                  <span className="shrink-0 opacity-60">{ex.series}×{ex.reps}</span>
                )}
              </div>
            ))}
            {exercises.length > 2 && (
              <p className="text-xs text-muted-foreground/50">+{exercises.length - 2} autre{exercises.length - 2 > 1 ? "s" : ""}…</p>
            )}
          </div>
        )}
      </div>

      {/* Sheet détail session */}
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

          {/* Liste exercices */}
          <div className="flex-1 overflow-y-auto">
            {exercises.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground px-6">
                <Dumbbell className="h-10 w-10 opacity-30" />
                <p className="text-sm text-center">Aucun exercice — ajoute le premier ci-dessous.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {exercises.map((ex) => (
                  <ExerciseEditor
                    key={ex.id}
                    exercise={ex}
                    sessionId={session.id}
                    sessionType={session.session_type}
                    isValidated={isValidated}
                    onChange={(field, value) => onExerciseChange(ex.id, field, value)}
                    onDelete={() => onDeleteExercise(ex.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer : ajouter exercice */}
          {!isValidated && (
            <div className="px-5 py-4 border-t border-border/40 shrink-0">
              <Button
                className="w-full h-12 text-base gap-2"
                variant="outline"
                onClick={onAddExercise}
              >
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
  isValidated, onWeekChange, onCreateSession, onDeleteSession,
  onAddExercise, onDeleteExercise, onExerciseChange, onSave, isSaving,
  hasPreviousWeeks, onCopyPreviousWeek, onOpenCopyDialog,
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
      <div className="flex items-center gap-2 mb-4">
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

      {/* ── Copier une semaine précédente ───────────────────────────────── */}
      {!isValidated && hasPreviousWeeks && (
        <div className="flex gap-2 mb-1">
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
              onDelete={(e) => onDeleteSession(session.id, e)}
              onAddExercise={() => onAddExercise(session.id)}
              onDeleteExercise={(exId) => onDeleteExercise(session.id, exId)}
              onExerciseChange={(exId, field, value) => onExerciseChange(session.id, exId, field, value)}
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
