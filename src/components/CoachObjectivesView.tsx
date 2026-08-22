import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon, Plus, Pencil, Trash2, Target, CalendarDays,
  Save, X, Layers, Layers2, Layers3, AlertTriangle, Clock,
  ChevronDown, ChevronRight, Dumbbell, Footprints, NotebookPen, Check,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, differenceInWeeks, differenceInDays, isWithinInterval, parseISO, addWeeks, addDays } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { YearTimeline } from "./YearTimeline";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CoachObjectivesViewProps {
  athleteId: string;
  athleteName: string;
}

interface AthleteObjective {
  id?: string;
  main_objective?: string;
  main_objective_deadline?: string;
  secondary_objective?: string;
}

interface ObjectiveMilestone {
  id: string;
  label: string;
  target_date: string;
  notes?: string;
  completed: boolean;
}

interface Cycle {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  description?: string;
  color: string;
  phase_type?: string;
  sport?: string;
  volume_target?: number;
  intensity_target?: number;
  objective?: string;
  coach_note?: string;
}

interface Macrocycle extends Cycle {}
interface Mesocycle extends Cycle { macrocycle_id?: string; }
interface Microcycle extends Cycle { mesocycle_id?: string; }

type CycleType = "macro" | "meso" | "micro";

// ─── Constantes de phase ──────────────────────────────────────────────────────

export const PHASE_TYPES = [
  {
    value: "accumulation",
    label: "Accumulation",
    color: "#3B82F6",
    defaultVolume: 4,
    defaultIntensity: 2,
    description: "Volume élevé · intensité modérée",
    emoji: "📈",
  },
  {
    value: "transformation",
    label: "Transformation",
    color: "#8B5CF6",
    defaultVolume: 3,
    defaultIntensity: 4,
    description: "Volume réduit · intensité haute",
    emoji: "⚡",
  },
  {
    value: "realisation",
    label: "Réalisation",
    color: "#EF4444",
    defaultVolume: 2,
    defaultIntensity: 5,
    description: "Volume bas · intensité max",
    emoji: "🔥",
  },
  {
    value: "competition",
    label: "Compétition",
    color: "#F59E0B",
    defaultVolume: 1,
    defaultIntensity: 4,
    description: "Maintien · pics de forme",
    emoji: "🏆",
  },
  {
    value: "decharge",
    label: "Décharge",
    color: "#10B981",
    defaultVolume: 2,
    defaultIntensity: 2,
    description: "Récupération active · volume bas",
    emoji: "🌿",
  },
  {
    value: "mise_en_route",
    label: "Mise en route",
    color: "#06B6D4",
    defaultVolume: 2,
    defaultIntensity: 1,
    description: "Apprentissage · faible charge",
    emoji: "🌱",
  },
  {
    value: "transition",
    label: "Transition",
    color: "#6B7280",
    defaultVolume: 1,
    defaultIntensity: 1,
    description: "Repos · coupure",
    emoji: "💤",
  },
  {
    value: "custom",
    label: "Personnalisé",
    color: "#EC4899",
    defaultVolume: 3,
    defaultIntensity: 3,
    description: "Phase définie manuellement",
    emoji: "✏️",
  },
] as const;

export type PhaseTypeValue = typeof PHASE_TYPES[number]["value"];

export function getPhase(value?: string) {
  return PHASE_TYPES.find((p) => p.value === value) ?? PHASE_TYPES.find((p) => p.value === "custom")!;
}

// ─── Sport types ──────────────────────────────────────────────────────────────
export const SPORT_TYPES = [
  // Endurance / Cardio
  { value: "course",      label: "Course à pied",        emoji: "🏃", category: "endurance" },
  { value: "trail",       label: "Trail / Montagne",     emoji: "🏔️", category: "endurance" },
  { value: "triathlon",   label: "Triathlon",            emoji: "🏊", category: "endurance" },
  { value: "cyclisme",    label: "Cyclisme",             emoji: "🚴", category: "endurance" },
  { value: "natation",    label: "Natation",             emoji: "🏊", category: "endurance" },
  { value: "duathlon",    label: "Duathlon",             emoji: "🏃", category: "endurance" },
  // Force / Musculaire
  { value: "musculation", label: "Musculation / Force",  emoji: "💪", category: "force" },
  { value: "haltero",     label: "Haltérophilie",        emoji: "🏋️", category: "force" },
  { value: "crossfit",    label: "CrossFit / Functional",emoji: "⚡", category: "force" },
  // Autre
  { value: "cross_training", label: "Cross-training",   emoji: "🔄", category: "autre" },
  { value: "yoga",        label: "Yoga / Mobilité",      emoji: "🧘", category: "autre" },
  { value: "sport_collectif", label: "Sport collectif",  emoji: "⚽", category: "autre" },
  { value: "general",     label: "Général / Mixte",      emoji: "📋", category: "autre" },
] as const;

// Values that count as "cardio/endurance" for AI filtering
export const CARDIO_SPORT_VALUES = ["course", "trail", "triathlon", "cyclisme", "natation", "duathlon"] as const;

export type SportTypeValue = typeof SPORT_TYPES[number]["value"];

export function getSport(value?: string) {
  return SPORT_TYPES.find((s) => s.value === value) ?? null;
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function PhaseTag({ value, size = "sm" }: { value?: string; size?: "sm" | "xs" }) {
  const phase = getPhase(value);
  const textSize = size === "xs" ? "text-[10px]" : "text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${textSize}`}
      style={{ backgroundColor: `${phase.color}20`, color: phase.color }}
    >
      {phase.emoji} {phase.label}
    </span>
  );
}

function DotScale({
  value, max = 5, color, label, interactive = false, onChange,
}: {
  value: number; max?: number; color: string; label: string;
  interactive?: boolean; onChange?: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-16 shrink-0">{label}</span>
      <div className="flex gap-1">
        {Array.from({ length: max }, (_, i) => (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(i + 1)}
            className={cn(
              "h-3 w-3 rounded-full transition-all",
              interactive && "cursor-pointer hover:scale-125",
              !interactive && "cursor-default"
            )}
            style={{ backgroundColor: i < value ? color : "#e5e7eb" }}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{value}/5</span>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function CoachObjectivesView({ athleteId, athleteName }: CoachObjectivesViewProps) {
  const [objective, setObjective] = useState<AthleteObjective>({});
  const [milestones, setMilestones] = useState<ObjectiveMilestone[]>([]);
  const [macrocycles, setMacrocycles] = useState<Macrocycle[]>([]);
  const [mesocycles, setMesocycles] = useState<Mesocycle[]>([]);
  const [microcycles, setMicrocycles] = useState<Microcycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSavingMain, setIsSavingMain] = useState(false);

  // Dialogs
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false);
  const [showCycleDialog, setShowCycleDialog] = useState(false);
  const [cycleDialogType, setCycleDialogType] = useState<CycleType>("macro");
  const [editingMilestone, setEditingMilestone] = useState<ObjectiveMilestone | null>(null);
  const [editingCycle, setEditingCycle] = useState<Cycle | null>(null);

  // Note inline
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Confirmation suppression cycle
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: CycleType; id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Collapsed groups
  const [collapsedMacros, setCollapsedMacros] = useState<Set<string>>(new Set());

  const [mainDeadlineDate, setMainDeadlineDate] = useState<Date | undefined>(undefined);

  const [milestoneForm, setMilestoneForm] = useState({
    label: "", target_date: new Date(), notes: "", completed: false,
  });

  const defaultCycleForm = {
    name: "", start_date: new Date(), end_date: new Date(),
    description: "", color: "#8B5CF6", parent_id: "",
    weeks: 4, phase_type: "custom" as string,
    sport: "", volume_target: 3, intensity_target: 3,
    objective: "", coach_note: "",
  };
  const [cycleForm, setCycleForm] = useState(defaultCycleForm);

  useEffect(() => { loadAll(); }, [athleteId]);
  useEffect(() => {
    if (objective.main_objective_deadline) {
      setMainDeadlineDate(new Date(objective.main_objective_deadline));
    }
  }, [objective.main_objective_deadline]);

  // ── Chargement ──────────────────────────────────────────────────────────────

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      loadObjectives(), loadMilestones(),
      loadMacrocycles(), loadMesocycles(), loadMicrocycles(),
    ]);
    setLoading(false);
  };

  const loadObjectives = async () => {
    // .limit(1) plutôt que .maybeSingle() : robuste même si plusieurs lignes existent
    // pour le même athlète (sinon maybeSingle échoue et rien ne s'affiche).
    const { data } = await supabase
      .from("athlete_objectives")
      .select("*")
      .eq("athlete_id", athleteId)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) setObjective(data[0]);
  };

  const loadMilestones = async () => {
    const { data } = await supabase.from("objective_milestones").select("*").eq("athlete_id", athleteId).order("target_date");
    setMilestones(data || []);
  };

  const loadMacrocycles = async () => {
    const { data } = await supabase.from("macrocycles").select("*").eq("athlete_id", athleteId).order("start_date");
    setMacrocycles((data || []) as Macrocycle[]);
  };

  const loadMesocycles = async () => {
    const { data } = await supabase.from("mesocycles").select("*").eq("athlete_id", athleteId).order("start_date");
    setMesocycles((data || []) as Mesocycle[]);
  };

  const loadMicrocycles = async () => {
    const { data } = await supabase.from("microcycles").select("*").eq("athlete_id", athleteId).order("start_date");
    setMicrocycles((data || []) as Microcycle[]);
  };

  // ── Objectif principal ───────────────────────────────────────────────────────

  const handleSaveMainObjective = async () => {
    if (!objective.main_objective?.trim() || !mainDeadlineDate) {
      toast.error("Veuillez remplir l'objectif et sélectionner une date");
      return;
    }
    setIsSavingMain(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const deadline = format(mainDeadlineDate, "yyyy-MM-dd");
      const payload = {
        athlete_id: athleteId, coach_id: user.id,
        main_objective: objective.main_objective,
        main_objective_deadline: deadline,
        secondary_objective: objective.secondary_objective,
        updated_at: new Date().toISOString(),
      };
      // Update si une ligne existe déjà, sinon insert — ne dépend pas d'une contrainte unique.
      const { data: existing } = await supabase
        .from("athlete_objectives").select("id").eq("athlete_id", athleteId).limit(1);
      let error;
      if (existing && existing.length > 0) {
        ({ error } = await supabase.from("athlete_objectives").update(payload).eq("id", existing[0].id));
      } else {
        ({ error } = await supabase.from("athlete_objectives").insert(payload));
      }
      if (error) throw error;
      setObjective((prev) => ({ ...prev, main_objective_deadline: deadline }));
      toast.success("Objectif principal enregistré");
      await loadObjectives();
    } catch { toast.error("Erreur lors de l'enregistrement"); }
    finally { setIsSavingMain(false); }
  };

  // ── Milestones ───────────────────────────────────────────────────────────────

  const handleOpenMilestoneDialog = (milestone?: ObjectiveMilestone) => {
    if (milestone) {
      setEditingMilestone(milestone);
      setMilestoneForm({ label: milestone.label, target_date: new Date(milestone.target_date), notes: milestone.notes || "", completed: milestone.completed });
    } else {
      setEditingMilestone(null);
      setMilestoneForm({ label: "", target_date: new Date(), notes: "", completed: false });
    }
    setShowMilestoneDialog(true);
  };

  const handleSaveMilestone = async () => {
    if (!milestoneForm.label.trim()) { toast.error("Veuillez remplir le label"); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const data = {
        athlete_id: athleteId, coach_id: user.id,
        label: milestoneForm.label,
        target_date: format(milestoneForm.target_date, "yyyy-MM-dd"),
        notes: milestoneForm.notes || null, completed: milestoneForm.completed,
        updated_at: new Date().toISOString(),
      };
      if (editingMilestone) {
        await supabase.from("objective_milestones").update(data).eq("id", editingMilestone.id);
        toast.success("Date d'objectif modifiée");
      } else {
        await supabase.from("objective_milestones").insert(data);
        toast.success("Date d'objectif ajoutée");
      }
      setShowMilestoneDialog(false);
      await loadMilestones();
    } catch { toast.error("Erreur lors de l'enregistrement"); }
  };

  const handleDeleteMilestone = async (id: string) => {
    if (!confirm("Supprimer cette date d'objectif ?")) return;
    await supabase.from("objective_milestones").delete().eq("id", id);
    toast.success("Date d'objectif supprimée");
    await loadMilestones();
  };

  // ── Cycles ───────────────────────────────────────────────────────────────────

  const getLastCycleEndDate = (type: CycleType): Date | null => {
    const cycles = type === "macro" ? macrocycles : type === "meso" ? mesocycles : microcycles;
    if (!cycles.length) return null;
    const sorted = [...cycles].sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime());
    return new Date(sorted[0].end_date);
  };

  const handleOpenCycleDialog = (type: CycleType, cycle?: Cycle) => {
    setCycleDialogType(type);
    if (cycle) {
      const start = new Date(cycle.start_date);
      const end = new Date(cycle.end_date);
      const weeks = Math.max(1, differenceInWeeks(end, start) + 1);
      setEditingCycle(cycle);
      setCycleForm({
        name: cycle.name, start_date: start, end_date: end,
        description: cycle.description || "", color: cycle.color,
        parent_id: type === "meso" ? ((cycle as Mesocycle).macrocycle_id || "") : type === "micro" ? ((cycle as Microcycle).mesocycle_id || "") : "",
        weeks, phase_type: cycle.phase_type || "custom", sport: cycle.sport || "",
        volume_target: cycle.volume_target ?? 3, intensity_target: cycle.intensity_target ?? 3,
        objective: cycle.objective || "", coach_note: cycle.coach_note || "",
      });
    } else {
      const lastEnd = getLastCycleEndDate(type);
      const defaultStart = lastEnd ? addDays(lastEnd, 1) : new Date();
      const defaultWeeks = type === "macro" ? 12 : type === "meso" ? 4 : 1;
      const defaultPhase = type === "macro" ? "accumulation" : type === "meso" ? "accumulation" : "accumulation";
      const phase = getPhase(defaultPhase);
      setEditingCycle(null);
      setCycleForm({
        ...defaultCycleForm,
        start_date: defaultStart,
        end_date: addDays(addWeeks(defaultStart, defaultWeeks), -1),
        weeks: defaultWeeks, phase_type: defaultPhase, color: phase.color,
        volume_target: phase.defaultVolume, intensity_target: phase.defaultIntensity,
      });
    }
    setShowCycleDialog(true);
  };

  const handlePhaseTypeChange = (phaseType: string) => {
    const phase = getPhase(phaseType);
    setCycleForm((prev) => ({
      ...prev, phase_type: phaseType, color: phase.color,
      volume_target: phase.defaultVolume, intensity_target: phase.defaultIntensity,
    }));
  };

  const handleSaveCycle = async () => {
    if (!cycleForm.name.trim()) { toast.error("Veuillez remplir le nom"); return; }
    if (cycleForm.end_date < cycleForm.start_date) { toast.error("La date de fin doit être après le début"); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const baseData: any = {
        athlete_id: athleteId, coach_id: user.id, name: cycleForm.name,
        start_date: format(cycleForm.start_date, "yyyy-MM-dd"),
        end_date: format(cycleForm.end_date, "yyyy-MM-dd"),
        description: cycleForm.description || null, color: cycleForm.color,
        phase_type: cycleForm.phase_type, sport: cycleForm.sport || null,
        volume_target: cycleForm.volume_target, intensity_target: cycleForm.intensity_target,
        objective: cycleForm.objective || null, coach_note: cycleForm.coach_note || null,
        updated_at: new Date().toISOString(),
      };

      const tableName = cycleDialogType === "macro" ? "macrocycles" : cycleDialogType === "meso" ? "mesocycles" : "microcycles";
      const cycleData = cycleDialogType === "meso"
        ? { ...baseData, macrocycle_id: cycleForm.parent_id || null }
        : cycleDialogType === "micro"
        ? { ...baseData, mesocycle_id: cycleForm.parent_id || null }
        : baseData;

      if (editingCycle) {
        await supabase.from(tableName).update(cycleData).eq("id", editingCycle.id);
        toast.success(`${getCycleLabel(cycleDialogType)} modifié`);
      } else {
        await supabase.from(tableName).insert(cycleData);
        toast.success(`${getCycleLabel(cycleDialogType)} créé`);
      }
      setShowCycleDialog(false);
      await loadAll();
    } catch (e) { console.error(e); toast.error("Erreur lors de l'enregistrement"); }
  };

  const handleDeleteCycle = (type: CycleType, id: string, name: string) => {
    setDeleteConfirm({ type, id, name });
  };

  const confirmDeleteCycle = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      const { type, id } = deleteConfirm;
      const tableName = type === "macro" ? "macrocycles" : type === "meso" ? "mesocycles" : "microcycles";
      const { error } = await supabase.from(tableName).delete().eq("id", id);
      if (error) throw error;
      toast.success(`${getCycleLabel(type)} supprimé`);
      setDeleteConfirm(null);
      await loadAll();
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveNote = async (type: CycleType, cycleId: string) => {
    setIsSavingNote(true);
    const tableName = type === "macro" ? "macrocycles" : type === "meso" ? "mesocycles" : "microcycles";
    try {
      await supabase.from(tableName).update({ coach_note: noteValue || null, updated_at: new Date().toISOString() }).eq("id", cycleId);
      toast.success("Note enregistrée");
      setEditingNoteId(null);
      await loadAll();
    } catch { toast.error("Erreur lors de l'enregistrement de la note"); }
    finally { setIsSavingNote(false); }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const getCycleLabel = (type: CycleType) =>
    type === "macro" ? "Macrocycle" : type === "meso" ? "Mésocycle" : "Microcycle";

  const getCycleStatus = (c: { start_date: string; end_date: string }) => {
    const today = new Date();
    if (today < new Date(c.start_date)) return "upcoming";
    if (today > new Date(c.end_date)) return "completed";
    return "active";
  };

  const getCycleProgress = (c: { start_date: string; end_date: string }) => {
    const start = new Date(c.start_date);
    const end = new Date(c.end_date);
    const today = new Date();
    const total = differenceInDays(end, start) + 1;
    const elapsed = Math.max(0, differenceInDays(today, start));
    const totalWeeks = Math.ceil(total / 7);
    const currentWeek = Math.min(Math.floor(elapsed / 7) + 1, totalWeeks);
    const pct = Math.min(100, (elapsed / total) * 100);
    return { totalWeeks, currentWeek, pct };
  };

  const isActive = (c: { start_date: string; end_date: string }) => {
    const today = new Date();
    return isWithinInterval(today, { start: parseISO(c.start_date), end: parseISO(c.end_date) });
  };

  const getCycleEndingAlert = (cycle: Cycle | null, label: string) => {
    if (!cycle) return null;
    const daysLeft = differenceInDays(parseISO(cycle.end_date), new Date());
    if (daysLeft >= 0 && daysLeft <= 7) return { daysLeft, name: cycle.name, label };
    return null;
  };

  // ── Rendu d'une carte cycle ───────────────────────────────────────────────────

  const renderCycleCard = (cycle: Cycle, type: CycleType, indentLevel = 0) => {
    const status = getCycleStatus(cycle);
    // Le macrocycle est un conteneur neutre (pas de phase), méso/micro ont une phase
    const phase = type === "macro" ? null : getPhase(cycle.phase_type);
    const borderColor = phase ? phase.color : "#6B7280";
    const { totalWeeks, currentWeek, pct } = getCycleProgress(cycle);
    const weeksRemaining = Math.max(0, totalWeeks - currentWeek + 1);
    const isEditingNote = editingNoteId === cycle.id;

    return (
      <div
        key={cycle.id}
        className={cn("rounded-xl border bg-card transition-all", indentLevel === 0 ? "" : "")}
        style={{
          borderLeftWidth: "4px",
          borderLeftColor: borderColor,
          marginLeft: indentLevel > 0 ? `${indentLevel * 20}px` : 0,
        }}
      >
        <div className="p-3 sm:p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                {phase ? <PhaseTag value={cycle.phase_type} /> : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-xs font-medium text-muted-foreground">
                    Macrocycle
                  </span>
                )}
                {cycle.sport && (() => {
                  const sp = getSport(cycle.sport);
                  return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-xs font-medium text-muted-foreground">
                      {sp ? `${sp.emoji} ${sp.label}` : cycle.sport}
                    </span>
                  );
                })()}
                <Badge variant={status === "active" ? "default" : status === "upcoming" ? "secondary" : "outline"} className="text-xs">
                  {status === "active" ? "En cours" : status === "upcoming" ? "À venir" : "Terminé"}
                </Badge>
                <Badge variant="outline" className="text-xs">{totalWeeks} sem.</Badge>
                {status === "active" && weeksRemaining <= 2 && (
                  <Badge variant="outline" className="text-xs border-amber-500/60 text-amber-500">
                    ⚠️ {weeksRemaining === 1 ? "Dernière semaine" : `${weeksRemaining} sem. restantes`}
                  </Badge>
                )}
              </div>
              <p className="font-semibold text-base leading-tight">{cycle.name}</p>
              {cycle.objective && (
                <p className="text-sm text-muted-foreground italic leading-snug">{cycle.objective}</p>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleOpenCycleDialog(type, cycle)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteCycle(type, cycle.id, cycle.name)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Volume / Intensité — uniquement pour méso/micro */}
          {phase && (
            <div className="space-y-1.5">
              <DotScale label="Volume" value={cycle.volume_target ?? 3} max={5} color={phase.color} />
              <DotScale label="Intensité" value={cycle.intensity_target ?? 3} max={5} color={phase.color} />
            </div>
          )}

          {/* Dates + barre de progression */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{format(new Date(cycle.start_date), "d MMM yyyy", { locale: fr })}</span>
              {status === "active" && <span className="font-medium" style={{ color: borderColor }}>Sem. {currentWeek}/{totalWeeks}</span>}
              <span>{format(new Date(cycle.end_date), "d MMM yyyy", { locale: fr })}</span>
            </div>
            {status === "active" && (
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: borderColor }} />
              </div>
            )}
          </div>

          {/* Note du coach */}
          <div className="border-t border-border/40 pt-2">
            {isEditingNote ? (
              <div className="space-y-2">
                <Textarea
                  value={noteValue}
                  onChange={(e) => setNoteValue(e.target.value)}
                  placeholder="Note sur l'évolution de la stratégie, ajustements…"
                  rows={3}
                  className="text-sm resize-none"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleSaveNote(type, cycle.id)} disabled={isSavingNote}>
                    <Check className="h-3 w-3" />
                    {isSavingNote ? "Enregistrement…" : "Enregistrer"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingNoteId(null)}>
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="w-full text-left group"
                onClick={() => { setEditingNoteId(cycle.id); setNoteValue(cycle.coach_note || ""); }}
              >
                {cycle.coach_note ? (
                  <p className="text-xs text-muted-foreground leading-snug group-hover:text-foreground transition-colors">
                    <NotebookPen className="inline h-3 w-3 mr-1 opacity-60" />
                    {cycle.coach_note}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/40 italic group-hover:text-muted-foreground transition-colors">
                    <NotebookPen className="inline h-3 w-3 mr-1" />
                    Ajouter une note de suivi…
                  </p>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Vue hiérarchique ─────────────────────────────────────────────────────────

  const renderHierarchy = () => {
    const orphanMesos = mesocycles.filter((m) => !m.macrocycle_id || !macrocycles.find((mac) => mac.id === m.macrocycle_id));
    const orphanMicros = microcycles.filter((m) => !m.mesocycle_id || !mesocycles.find((meso) => meso.id === m.mesocycle_id));

    return (
      <div className="space-y-4">
        {macrocycles.length === 0 && mesocycles.length === 0 && microcycles.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Layers className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Aucun cycle créé pour cet athlète.</p>
            <p className="text-xs mt-1">Commencez par créer un macrocycle.</p>
          </div>
        ) : (
          <>
            {/* Macrocycles avec mésocycles/microcycles imbriqués */}
            {macrocycles.map((macro) => {
              const isCollapsed = collapsedMacros.has(macro.id);
              const childMesos = mesocycles.filter((m) => m.macrocycle_id === macro.id);
              return (
                <div key={macro.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setCollapsedMacros((prev) => {
                        const next = new Set(prev);
                        next.has(macro.id) ? next.delete(macro.id) : next.add(macro.id);
                        return next;
                      })}
                    >
                      {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      <Layers className="h-3.5 w-3.5" />
                      <span className="uppercase tracking-wide font-medium">Macrocycle</span>
                    </button>
                  </div>

                  {renderCycleCard(macro, "macro", 0)}

                  {!isCollapsed && (
                    <div className="space-y-2 pl-1">
                      {childMesos.map((meso) => {
                        const childMicros = microcycles.filter((m) => m.mesocycle_id === meso.id);
                        return (
                          <div key={meso.id} className="space-y-2">
                            <div className="flex items-center gap-1 pl-5">
                              <Layers2 className="h-3 w-3 text-muted-foreground" />
                              <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Mésocycle</span>
                            </div>
                            {renderCycleCard(meso, "meso", 1)}
                            {childMicros.map((micro) => (
                              <div key={micro.id} className="space-y-1">
                                <div className="flex items-center gap-1 pl-10">
                                  <Layers3 className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Microcycle</span>
                                </div>
                                {renderCycleCard(micro, "micro", 2)}
                              </div>
                            ))}
                            {childMicros.length === 0 && (
                              <button
                                type="button"
                                className="ml-10 text-xs text-muted-foreground/50 hover:text-primary flex items-center gap-1 transition-colors"
                                onClick={() => { handleOpenCycleDialog("micro"); setCycleForm((prev) => ({ ...prev, parent_id: meso.id })); }}
                              >
                                <Plus className="h-3 w-3" /> Ajouter un microcycle
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {childMesos.length === 0 && (
                        <button
                          type="button"
                          className="ml-5 text-xs text-muted-foreground/50 hover:text-primary flex items-center gap-1 transition-colors"
                          onClick={() => { handleOpenCycleDialog("meso"); setCycleForm((prev) => ({ ...prev, parent_id: macro.id })); }}
                        >
                          <Plus className="h-3 w-3" /> Ajouter un mésocycle
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Mésocycles orphelins */}
            {orphanMesos.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1">
                  <Layers2 className="h-3.5 w-3.5" /> Mésocycles non rattachés
                </p>
                {orphanMesos.map((m) => {
                  const childMicros = microcycles.filter((mc) => mc.mesocycle_id === m.id);
                  return (
                    <div key={m.id} className="space-y-2">
                      {renderCycleCard(m, "meso", 0)}
                      {childMicros.map((micro) => renderCycleCard(micro, "micro", 1))}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Microcycles orphelins */}
            {orphanMicros.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1">
                  <Layers3 className="h-3.5 w-3.5" /> Microcycles non rattachés
                </p>
                {orphanMicros.map((m) => renderCycleCard(m, "micro", 0))}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // ── Alertes ───────────────────────────────────────────────────────────────────

  const allActiveMacros = macrocycles.filter(isActive);
  const allActiveMesos = mesocycles.filter(isActive);
  const allActiveMicros = microcycles.filter(isActive);

  const cycleAlerts = [
    ...allActiveMacros.map((c) => getCycleEndingAlert(c, "Macrocycle")),
    ...allActiveMesos.map((c) => getCycleEndingAlert(c, "Mésocycle")),
    ...allActiveMicros.map((c) => getCycleEndingAlert(c, "Microcycle")),
  ].filter(Boolean) as { daysLeft: number; name: string; label: string }[];

  // ── getDaysUntil (pour milestones) ────────────────────────────────────────────
  const getDaysUntil = (d: string) => Math.ceil((new Date(d).getTime() - new Date().getTime()) / 86400000);
  const getMilestoneBadge = (m: ObjectiveMilestone) => {
    if (m.completed) return "default";
    const d = getDaysUntil(m.target_date);
    if (d < 0 || d <= 7) return "destructive";
    if (d <= 14) return "secondary";
    return "outline";
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Chargement…</div>;

  return (
    <>
    <Tabs defaultValue="obj" className="space-y-4">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="obj">🎯 Objectifs &amp; jalons</TabsTrigger>
        <TabsTrigger value="plan">📅 Planning annuel</TabsTrigger>
      </TabsList>

      {/* ═══════════ ONGLET OBJECTIFS & JALONS ═══════════ */}
      <TabsContent value="obj" className="mt-0 space-y-4">

      {/* ── Objectif principal ────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-5 w-5 text-primary" /> Objectif principal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Ex : Semi-marathon en 1h45, 100 kg au squat…"
            value={objective.main_objective || ""}
            onChange={(e) => setObjective((prev) => ({ ...prev, main_objective: e.target.value }))}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="justify-start text-left font-normal">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {mainDeadlineDate ? format(mainDeadlineDate, "d MMM yyyy", { locale: fr }) : "Échéance"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={mainDeadlineDate} onSelect={setMainDeadlineDate} locale={fr} weekStartsOn={1} className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Button size="sm" onClick={handleSaveMainObjective} disabled={isSavingMain}>
              <Check className="h-4 w-4 mr-1" /> {isSavingMain ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
          <Input
            placeholder="Objectif secondaire (optionnel)"
            value={objective.secondary_objective || ""}
            onChange={(e) => setObjective((prev) => ({ ...prev, secondary_objective: e.target.value }))}
          />
        </CardContent>
      </Card>

      {/* ── Jalons / sous-objectifs ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Jalons / sous-objectifs
            </div>
            <Button size="sm" onClick={() => handleOpenMilestoneDialog()}>
              <Plus className="h-4 w-4 mr-2" /> Ajouter un jalon
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {milestones.length === 0 ? (
            <p className="text-center text-muted-foreground py-3 text-sm">Aucune date d'objectif pour le moment.</p>
          ) : (
            <div className="space-y-3">
              {[...milestones].sort((a, b) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime()).map((m) => {
                const daysUntil = getDaysUntil(m.target_date);
                return (
                  <Card key={m.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold">{m.label}</h4>
                          <Badge variant={getMilestoneBadge(m)}>
                            {m.completed ? "Atteint" : daysUntil < 0 ? `Dépassé de ${Math.abs(daysUntil)} j` : daysUntil === 0 ? "Aujourd'hui" : daysUntil === 1 ? "Demain" : `Dans ${daysUntil} j`}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(m.target_date), "EEEE d MMMM yyyy", { locale: fr })}
                        </p>
                        {m.notes && <p className="text-sm text-muted-foreground italic">{m.notes}</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenMilestoneDialog(m)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteMilestone(m.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </TabsContent>

      {/* ═══════════ ONGLET PLANNING ANNUEL ═══════════ */}
      <TabsContent value="plan" className="mt-0 space-y-4">

      {/* ── Alertes fin de cycle ──────────────────────────────────────── */}
      {cycleAlerts.length > 0 && (
        <div className="space-y-2">
          {cycleAlerts.map((alert, i) => (
            <Alert key={i} className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertTitle className="text-amber-600">{alert.label} bientôt terminé</AlertTitle>
              <AlertDescription>
                « {alert.name} » se termine {alert.daysLeft === 0 ? "aujourd'hui" : alert.daysLeft === 1 ? "demain" : `dans ${alert.daysLeft} jours`}. Planifie la suite.
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* ── Cycles actifs en résumé ───────────────────────────────────── */}
      {(allActiveMacros.length > 0 || allActiveMesos.length > 0 || allActiveMicros.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 text-primary" />
              Phase actuelle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Pour chaque macro actif, afficher la hiérarchie compacte */}
            {allActiveMacros.map((macro) => {
              // Le macro est un conteneur : sa couleur vient du premier méso actif, ou neutre
              const firstActiveMeso = allActiveMesos.find((m) => m.macrocycle_id === macro.id);
              const macroColor = firstActiveMeso ? getPhase(firstActiveMeso.phase_type).color : "#6B7280";
              const activeMesosUnder = allActiveMesos.filter((m) => m.macrocycle_id === macro.id);
              return (
                <div key={macro.id} className="rounded-xl border p-3 space-y-2" style={{ borderColor: `${macroColor}40`, backgroundColor: `${macroColor}08` }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold text-sm">{macro.name}</span>
                    {macro.sport && <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">· {macro.sport}</span>}
                  </div>
                  {macro.objective && <p className="text-xs text-muted-foreground italic pl-1">{macro.objective}</p>}

                  {activeMesosUnder.map((meso) => {
                    const mesoPhase = getPhase(meso.phase_type);
                    const activeMicrosUnder = allActiveMicros.filter((m) => m.mesocycle_id === meso.id);
                    return (
                      <div key={meso.id} className="ml-4 border-l-2 pl-3 space-y-2" style={{ borderColor: `${mesoPhase.color}60` }}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Layers2 className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium text-sm">{meso.name}</span>
                          <PhaseTag value={meso.phase_type} size="xs" />
                        </div>
                        <div className="space-y-1 pl-1">
                          <DotScale label="Volume" value={meso.volume_target ?? 3} max={5} color={mesoPhase.color} />
                          <DotScale label="Intensité" value={meso.intensity_target ?? 3} max={5} color={mesoPhase.color} />
                        </div>
                        {meso.objective && <p className="text-xs text-muted-foreground italic pl-1">{meso.objective}</p>}

                        {activeMicrosUnder.map((micro) => {
                          const microPhase = getPhase(micro.phase_type);
                          const { currentWeek, totalWeeks } = getCycleProgress(micro);
                          return (
                            <div key={micro.id} className="ml-4 border-l-2 pl-3" style={{ borderColor: `${microPhase.color}60` }}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Layers3 className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">{micro.name}</span>
                                <PhaseTag value={micro.phase_type} size="xs" />
                                <span className="text-xs text-muted-foreground">Sem. {currentWeek}/{totalWeeks}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Mesos actifs sans macro parent */}
            {allActiveMesos.filter((m) => !m.macrocycle_id || !macrocycles.find((mac) => mac.id === m.macrocycle_id)).map((meso) => {
              const mesoPhase = getPhase(meso.phase_type);
              return (
                <div key={meso.id} className="rounded-xl border p-3 space-y-2" style={{ borderColor: `${mesoPhase.color}40`, backgroundColor: `${mesoPhase.color}08` }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Layers2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold text-sm">{meso.name}</span>
                    <PhaseTag value={meso.phase_type} size="xs" />
                  </div>
                  <div className="space-y-1 pl-1">
                    <DotScale label="Volume" value={meso.volume_target ?? 3} max={5} color={mesoPhase.color} />
                    <DotScale label="Intensité" value={meso.intensity_target ?? 3} max={5} color={mesoPhase.color} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Timeline annuelle (lecture seule) ────────────────────────── */}
      <YearTimeline
        macrocycles={macrocycles}
        mesocycles={mesocycles}
        microcycles={microcycles}
        milestones={milestones}
        mainObjectiveDate={objective.main_objective_deadline}
        onMacrocycleClick={(m) => handleOpenCycleDialog("macro", m)}
        onMesocycleClick={(m) => handleOpenCycleDialog("meso", m)}
        onMicrocycleClick={(m) => handleOpenCycleDialog("micro", m)}
        onMilestoneClick={handleOpenMilestoneDialog}
        onAddCycle={(type) => handleOpenCycleDialog(type)}
        onAddMilestone={() => handleOpenMilestoneDialog()}
      />

      {/* ── Hiérarchie des cycles ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Cycles d'entraînement
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleOpenCycleDialog("micro")}>
                <Layers3 className="h-3.5 w-3.5 mr-1 text-cyan-500" /> Micro
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleOpenCycleDialog("meso")}>
                <Layers2 className="h-3.5 w-3.5 mr-1 text-blue-500" /> Méso
              </Button>
              <Button size="sm" onClick={() => handleOpenCycleDialog("macro")}>
                <Layers className="h-3.5 w-3.5 mr-1" /> Macro
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderHierarchy()}
        </CardContent>
      </Card>
      </TabsContent>
    </Tabs>

      {/* ── Dialog milestone ──────────────────────────────────────────── */}
      <Dialog open={showMilestoneDialog} onOpenChange={setShowMilestoneDialog}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingMilestone ? "Modifier la date d'objectif" : "Ajouter une date d'objectif"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label>Label *</Label>
              <Input placeholder="Ex: Compétition régionale, Test VMA…" value={milestoneForm.label} onChange={(e) => setMilestoneForm({ ...milestoneForm, label: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Date cible *</Label>
              <div className="border rounded-md p-2 bg-background">
                <Calendar mode="single" selected={milestoneForm.target_date} onSelect={(d) => d && setMilestoneForm({ ...milestoneForm, target_date: d })} locale={fr} weekStartsOn={1} className="pointer-events-auto mx-auto" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Textarea placeholder="Informations complémentaires…" value={milestoneForm.notes} onChange={(e) => setMilestoneForm({ ...milestoneForm, notes: e.target.value })} rows={3} />
            </div>
            {editingMilestone && (
              <div className="flex items-center gap-2">
                <Checkbox id="completed" checked={milestoneForm.completed} onCheckedChange={(c) => setMilestoneForm({ ...milestoneForm, completed: c as boolean })} />
                <label htmlFor="completed" className="text-sm cursor-pointer">Marquer comme atteint</label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMilestoneDialog(false)}><X className="h-4 w-4 mr-2" />Annuler</Button>
            <Button onClick={handleSaveMilestone}><Save className="h-4 w-4 mr-2" />Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog cycle ──────────────────────────────────────────────── */}
      <Dialog open={showCycleDialog} onOpenChange={setShowCycleDialog}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[92dvh] flex flex-col p-0 gap-0 rounded-2xl overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/40 shrink-0">
            <DialogTitle className="text-base">
              {editingCycle ? `Modifier le ${getCycleLabel(cycleDialogType).toLowerCase()}` : `Nouveau ${getCycleLabel(cycleDialogType).toLowerCase()}`}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

            {/* Phase type — uniquement pour méso et micro (pas le macro qui est un conteneur) */}
            {cycleDialogType !== "macro" && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Type de phase *</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PHASE_TYPES.map((pt) => (
                    <button
                      key={pt.value}
                      type="button"
                      onClick={() => handlePhaseTypeChange(pt.value)}
                      className={cn(
                        "rounded-xl border-2 p-3 text-left transition-all space-y-1",
                        cycleForm.phase_type === pt.value ? "scale-[1.02]" : "border-border/40 hover:border-border opacity-70 hover:opacity-100"
                      )}
                      style={cycleForm.phase_type === pt.value ? { borderColor: pt.color, backgroundColor: `${pt.color}12` } : {}}
                    >
                      <div className="text-base">{pt.emoji}</div>
                      <div className="font-semibold text-xs" style={cycleForm.phase_type === pt.value ? { color: pt.color } : {}}>{pt.label}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">{pt.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Nom */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Nom *</Label>
              <Input
                placeholder={cycleDialogType === "macro" ? "Ex: Saison 2025, Prépa Hiver…" : cycleDialogType === "meso" ? "Ex: Bloc Force, Préparation Spécifique…" : "Ex: Semaine de charge, Semaine test…"}
                value={cycleForm.name}
                onChange={(e) => setCycleForm({ ...cycleForm, name: e.target.value })}
              />
            </div>

            {/* Sport / Discipline */}
            {(cycleDialogType === "macro" || cycleDialogType === "meso") && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Discipline (optionnel)</Label>
                <Select
                  value={cycleForm.sport || "none"}
                  onValueChange={(v) => setCycleForm({ ...cycleForm, sport: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une discipline…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non spécifié</SelectItem>
                    <SelectItem value="_endurance" disabled className="text-xs text-muted-foreground font-semibold uppercase tracking-wide py-1">── Endurance</SelectItem>
                    {SPORT_TYPES.filter((s) => s.category === "endurance").map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.emoji} {s.label}</SelectItem>
                    ))}
                    <SelectItem value="_force" disabled className="text-xs text-muted-foreground font-semibold uppercase tracking-wide py-1">── Force</SelectItem>
                    {SPORT_TYPES.filter((s) => s.category === "force").map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.emoji} {s.label}</SelectItem>
                    ))}
                    <SelectItem value="_autre" disabled className="text-xs text-muted-foreground font-semibold uppercase tracking-wide py-1">── Autre</SelectItem>
                    {SPORT_TYPES.filter((s) => s.category === "autre").map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.emoji} {s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {cycleDialogType === "meso" ? "Utilisé pour filtrer les cycles dans l'IA Cardio." : "Utile si l'athlète a plusieurs macrocycles simultanés."}
                </p>
              </div>
            )}

            {/* Parent */}
            {cycleDialogType === "meso" && macrocycles.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Macrocycle parent (optionnel)</Label>
                <Select value={cycleForm.parent_id || "none"} onValueChange={(v) => setCycleForm({ ...cycleForm, parent_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {macrocycles.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {cycleDialogType === "micro" && mesocycles.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Mésocycle parent (optionnel)</Label>
                <Select value={cycleForm.parent_id || "none"} onValueChange={(v) => setCycleForm({ ...cycleForm, parent_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {mesocycles.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Début *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal text-sm h-9">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(cycleForm.start_date, "d MMM yyyy", { locale: fr })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single" selected={cycleForm.start_date}
                      onSelect={(d) => { if (d) { const end = addDays(addWeeks(d, cycleForm.weeks), -1); setCycleForm({ ...cycleForm, start_date: d, end_date: end }); } }}
                      locale={fr} weekStartsOn={1} className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Durée (semaines) *</Label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0"
                    onClick={() => { const w = Math.max(1, cycleForm.weeks - 1); setCycleForm({ ...cycleForm, weeks: w, end_date: addDays(addWeeks(cycleForm.start_date, w), -1) }); }}
                    disabled={cycleForm.weeks <= 1}
                  >−</Button>
                  <Input type="number" min={1} max={52} value={cycleForm.weeks}
                    onChange={(e) => { const w = Math.max(1, Math.min(52, parseInt(e.target.value) || 1)); setCycleForm({ ...cycleForm, weeks: w, end_date: addDays(addWeeks(cycleForm.start_date, w), -1) }); }}
                    className="w-16 text-center h-9"
                  />
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0"
                    onClick={() => { const w = Math.min(52, cycleForm.weeks + 1); setCycleForm({ ...cycleForm, weeks: w, end_date: addDays(addWeeks(cycleForm.start_date, w), -1) }); }}
                    disabled={cycleForm.weeks >= 52}
                  >+</Button>
                </div>
                <p className="text-xs text-muted-foreground">→ {format(cycleForm.end_date, "d MMM yyyy", { locale: fr })}</p>
              </div>
            </div>

            {/* Volume / Intensité */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Cibles de charge</Label>
              <div className="rounded-xl border bg-secondary/20 p-4 space-y-3">
                <DotScale
                  label="Volume" value={cycleForm.volume_target} max={5}
                  color={getPhase(cycleForm.phase_type).color} interactive
                  onChange={(v) => setCycleForm({ ...cycleForm, volume_target: v })}
                />
                <DotScale
                  label="Intensité" value={cycleForm.intensity_target} max={5}
                  color={getPhase(cycleForm.phase_type).color} interactive
                  onChange={(v) => setCycleForm({ ...cycleForm, intensity_target: v })}
                />
              </div>
            </div>

            {/* Objectif de phase */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Objectif de la phase (optionnel)</Label>
              <Textarea
                placeholder="Ex: Développer la base aérobie, augmenter le 1RM au squat de 10%…"
                value={cycleForm.objective}
                onChange={(e) => setCycleForm({ ...cycleForm, objective: e.target.value })}
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            {/* Couleur (custom seulement) */}
            {cycleForm.phase_type === "custom" && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Couleur</Label>
                <div className="flex gap-2 flex-wrap">
                  {["#8B5CF6","#3B82F6","#10B981","#F59E0B","#EF4444","#EC4899","#06B6D4","#84CC16"].map((c) => (
                    <button key={c} type="button"
                      className={cn("h-8 w-8 rounded-full border-2 transition-all", cycleForm.color === c ? "border-foreground scale-110" : "border-transparent hover:scale-105")}
                      style={{ backgroundColor: c }} onClick={() => setCycleForm({ ...cycleForm, color: c })}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-row gap-2 px-6 py-4 border-t border-border/40 shrink-0">
            <Button variant="outline" onClick={() => setShowCycleDialog(false)} className="flex-1">
              <X className="h-4 w-4 mr-1.5" /> Annuler
            </Button>
            <Button onClick={handleSaveCycle} className="flex-1">
              <Save className="h-4 w-4 mr-1.5" /> Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog de confirmation suppression cycle ─────────────────────── */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce {deleteConfirm ? getCycleLabel(deleteConfirm.type).toLowerCase() : ""} ?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">« {deleteConfirm?.name} »</span> sera définitivement supprimé.
              {deleteConfirm?.type === "macro" && (
                <span className="block mt-1 text-destructive">
                  Attention : les mésocycles et microcycles liés ne seront pas supprimés automatiquement.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCycle}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
