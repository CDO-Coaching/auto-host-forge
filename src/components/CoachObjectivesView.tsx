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
import { format, differenceInWeeks, differenceInDays, isWithinInterval, parseISO, addWeeks, addDays, addMonths } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { YearTimeline } from "./YearTimeline";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PhaseBuilder } from "./PhaseBuilder";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CoachObjectivesViewProps {
  athleteId: string;
  athleteName: string;
  onObjectiveChange?: (hasObjective: boolean, name?: string | null, deadline?: string | null) => void;
}

interface AthleteObjective {
  id?: string;
  main_objective?: string;
  main_objective_deadline?: string;
  secondary_objective?: string;
  main_completed?: boolean;
  main_completed_at?: string | null;
}

interface ObjectiveMilestone {
  id: string;
  label: string;
  target_date?: string | null;
  completed_at?: string | null;
  notes?: string;
  completed: boolean;
  created_by_role?: string | null;
  approval_status?: string | null; // 'approved' | 'pending'
  is_objective?: boolean | null; // true = objectif principal archivé
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

export function CoachObjectivesView({ athleteId, athleteName, onObjectiveChange }: CoachObjectivesViewProps) {
  const [objective, setObjective] = useState<AthleteObjective>({});
  const [milestones, setMilestones] = useState<ObjectiveMilestone[]>([]);
  const [macrocycles, setMacrocycles] = useState<Macrocycle[]>([]);
  const [mesocycles, setMesocycles] = useState<Mesocycle[]>([]);
  const [microcycles, setMicrocycles] = useState<Microcycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSavingMain, setIsSavingMain] = useState(false);
  const [editingObjective, setEditingObjective] = useState(false);
  const [showValidated, setShowValidated] = useState(false); // section "validés" repliée par défaut
  const [tlMonthOffset, setTlMonthOffset] = useState(0); // navigation timeline (mois)

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

  const [milestoneForm, setMilestoneForm] = useState<{ label: string; target_date: Date | null; notes: string; completed: boolean }>({
    label: "", target_date: null, notes: "", completed: false,
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
    const row = data && data.length > 0 ? data[0] : null;
    if (row) setObjective(row); else setObjective({});
    // Fiche si un objectif est déjà enregistré, sinon mode saisie (et il y reste tant qu'on n'enregistre pas)
    setEditingObjective(!row?.main_objective);
    onObjectiveChange?.(!!row?.main_objective, row?.main_objective || null, row?.main_objective_deadline || null);
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
        // Un objectif enregistré/modifié est "en cours" ; la validation passe par l'archivage.
        main_completed: false,
        main_completed_at: null,
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
      setObjective((prev) => ({ ...prev, main_objective_deadline: deadline, main_completed: false, main_completed_at: null }));
      toast.success("Objectif principal enregistré");
      setEditingObjective(false);
      await loadObjectives();
    } catch { toast.error("Erreur lors de l'enregistrement"); }
    finally { setIsSavingMain(false); }
  };

  // Valider l'objectif principal : l'archive dans les "validés" et vide la fiche.
  const handleValidateMainObjective = async () => {
    if (!objective.id || !objective.main_objective) { toast.error("Enregistre d'abord l'objectif principal"); return; }
    if (!confirm("Objectif atteint ? Il rejoint les objectifs validés et la fiche se vide pour un nouvel objectif.")) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const todayStr = format(new Date(), "yyyy-MM-dd");
      // 1) Archiver comme entrée validée (marquée is_objective)
      const { error: insErr } = await supabase.from("objective_milestones").insert({
        athlete_id: athleteId, coach_id: user?.id,
        label: objective.main_objective,
        target_date: objective.main_objective_deadline || null,
        completed: true, completed_at: objective.main_completed ? (objective.main_completed_at || todayStr) : todayStr,
        created_by_role: "coach", approval_status: "approved",
        updated_at: new Date().toISOString(),
      });
      if (insErr) throw insErr;
      // 2) Vider l'objectif principal
      const { error: updErr } = await supabase.from("athlete_objectives").update({
        main_objective: null, main_objective_deadline: null, secondary_objective: null,
        main_completed: false, main_completed_at: null, updated_at: new Date().toISOString(),
      }).eq("id", objective.id);
      if (updErr) throw updErr;
      setObjective({});
      setMainDeadlineDate(undefined);
      setEditingObjective(false);
      toast.success("Objectif atteint et archivé 🏆");
      await loadObjectives();
      await loadMilestones();
    } catch { toast.error("Impossible de valider l'objectif"); }
  };

  // ── Milestones ───────────────────────────────────────────────────────────────

  const handleOpenMilestoneDialog = (milestone?: ObjectiveMilestone) => {
    if (milestone) {
      setEditingMilestone(milestone);
      setMilestoneForm({ label: milestone.label, target_date: milestone.target_date ? new Date(milestone.target_date) : null, notes: milestone.notes || "", completed: milestone.completed });
    } else {
      setEditingMilestone(null);
      setMilestoneForm({ label: "", target_date: null, notes: "", completed: false });
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
        target_date: milestoneForm.target_date ? format(milestoneForm.target_date, "yyyy-MM-dd") : null,
        notes: milestoneForm.notes || null, completed: milestoneForm.completed,
        // Si coché "atteint" dans le formulaire et pas encore de date de validation, on met aujourd'hui
        completed_at: milestoneForm.completed ? (editingMilestone?.completed_at || format(new Date(), "yyyy-MM-dd")) : null,
        created_by_role: "coach", approval_status: "approved",
        updated_at: new Date().toISOString(),
      };
      if (editingMilestone) {
        await supabase.from("objective_milestones").update(data).eq("id", editingMilestone.id);
        toast.success("Jalon modifié");
      } else {
        await supabase.from("objective_milestones").insert(data);
        toast.success("Jalon ajouté");
      }
      setShowMilestoneDialog(false);
      await loadMilestones();
    } catch { toast.error("Erreur lors de l'enregistrement"); }
  };

  const handleDeleteMilestone = async (id: string) => {
    if (!confirm("Supprimer ce jalon ?")) return;
    await supabase.from("objective_milestones").delete().eq("id", id);
    toast.success("Jalon supprimé");
    await loadMilestones();
  };

  // Approuver une proposition du sportif
  const handleApproveMilestone = async (m: ObjectiveMilestone) => {
    setMilestones((prev) => prev.map((x) => (x.id === m.id ? { ...x, approval_status: "approved" } : x)));
    const { error } = await supabase.from("objective_milestones").update({ approval_status: "approved" }).eq("id", m.id);
    if (error) { await loadMilestones(); toast.error("Impossible d'approuver"); }
    else toast.success("Sous-objectif approuvé ✓");
  };
  // Refuser une proposition du sportif (supprime)
  const handleRejectMilestone = async (m: ObjectiveMilestone) => {
    if (!confirm("Refuser cette proposition du sportif ?")) return;
    setMilestones((prev) => prev.filter((x) => x.id !== m.id));
    const { error } = await supabase.from("objective_milestones").delete().eq("id", m.id);
    if (error) { await loadMilestones(); toast.error("Impossible de refuser"); }
    else toast.success("Proposition refusée");
  };

  // Bascule "atteint / à venir" directement depuis la carte du jalon
  const handleToggleMilestone = async (m: ObjectiveMilestone) => {
    const next = !m.completed;
    const completedAt = next ? format(new Date(), "yyyy-MM-dd") : null;
    // Optimiste : on met à jour localement tout de suite
    setMilestones((prev) => prev.map((x) => (x.id === m.id ? { ...x, completed: next, completed_at: completedAt } : x)));
    const { error } = await supabase.from("objective_milestones").update({ completed: next, completed_at: completedAt }).eq("id", m.id);
    if (error) {
      setMilestones((prev) => prev.map((x) => (x.id === m.id ? { ...x, completed: !next, completed_at: m.completed_at } : x)));
      toast.error("Impossible de mettre à jour le jalon");
    } else {
      toast.success(next ? "Jalon validé 🎯" : "Jalon remis à venir");
    }
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
  const getDaysUntil = (d?: string | null) => (d ? Math.ceil((new Date(d).getTime() - new Date().getTime()) / 86400000) : null);
  const getMilestoneBadge = (m: ObjectiveMilestone) => {
    if (m.completed) return "default";
    const d = getDaysUntil(m.target_date);
    if (d === null) return "outline";
    if (d < 0 || d <= 7) return "destructive";
    if (d <= 14) return "secondary";
    return "outline";
  };
  // Date qui sert au tri / positionnement : validation si atteint, sinon date cible
  const milestoneRefDate = (m: ObjectiveMilestone) => m.completed ? (m.completed_at || m.target_date) : m.target_date;
  const sortMilestones = (list: ObjectiveMilestone[]) =>
    [...list].sort((a, b) => {
      const da = milestoneRefDate(a), db = milestoneRefDate(b);
      if (!da && !db) return 0;
      if (!da) return 1;   // sans date → à la fin
      if (!db) return -1;
      return new Date(da).getTime() - new Date(db).getTime();
    });

  const isPending = (m: ObjectiveMilestone) => m.approval_status === "pending";
  const pendingMilestones = milestones.filter(isPending);
  const activeMilestones = milestones.filter((m) => !isPending(m) && !m.completed);
  const doneMilestones = milestones.filter((m) => !isPending(m) && m.completed);
  const approvedMilestones = milestones.filter((m) => !isPending(m));

  if (loading) return <div className="text-center py-8 text-muted-foreground">Chargement…</div>;

  return (
    <>
    <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:h-[calc(100dvh-11rem)]">

      {/* ═══ Quadrant 1 : Objectif principal ═══ */}
      <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
      {/* ── Objectif principal ────────────────────────────────────────── */}
      <Card className={cn(objective.main_completed && "border-emerald-500/50 bg-emerald-500/5")}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" /> Objectif principal
            </div>
            {objective.id && objective.main_objective && !editingObjective && (
              <button
                type="button"
                onClick={handleValidateMainObjective}
                title="Archive l'objectif dans les validés et vide la fiche pour un nouvel objectif"
                className="flex items-center gap-1.5 rounded-full border-2 border-emerald-500/50 px-3 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors"
              >
                <Check className="h-4 w-4" /> {objective.main_completed ? "Archiver → nouvel objectif" : "Objectif atteint"}
              </button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!editingObjective && objective.main_objective ? (
            /* ── Mode fiche (enregistré) ── */
            (() => {
              const dl = objective.main_objective_deadline ? new Date(objective.main_objective_deadline) : null;
              const days = dl ? Math.ceil((dl.getTime() - new Date().getTime()) / 86400000) : null;
              return (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className={cn("text-lg font-bold leading-tight", objective.main_completed && "text-emerald-600")}>{objective.main_objective}</h3>
                      {dl && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {objective.main_completed
                            ? `🏆 Atteint${objective.main_completed_at ? ` le ${format(new Date(objective.main_completed_at), "d MMM yyyy", { locale: fr })}` : ""}`
                            : days !== null && days >= 0
                              ? `Dans ${days} jour${days > 1 ? "s" : ""} · ${format(dl, "d MMM yyyy", { locale: fr })}`
                              : `Échéance ${format(dl, "d MMM yyyy", { locale: fr })}`}
                        </p>
                      )}
                      {objective.secondary_objective && (
                        <p className="text-sm text-muted-foreground mt-1">Aussi : {objective.secondary_objective}</p>
                      )}
                    </div>
                    <span className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                      objective.main_completed ? "bg-emerald-500/15 text-emerald-600" : "bg-primary/15 text-primary",
                    )}>
                      {objective.main_completed ? "Validé ✓" : "En cours"}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditingObjective(true)}>
                    <Pencil className="h-3.5 w-3.5" /> Modifier
                  </Button>
                </div>
              );
            })()
          ) : (
            /* ── Mode édition ── */
            <>
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
                {objective.id && objective.main_objective && (
                  <Button size="sm" variant="ghost" onClick={() => setEditingObjective(false)}>Annuler</Button>
                )}
              </div>
              <Input
                placeholder="Objectif secondaire (optionnel)"
                value={objective.secondary_objective || ""}
                onChange={(e) => setObjective((prev) => ({ ...prev, secondary_objective: e.target.value }))}
              />
            </>
          )}
        </CardContent>
      </Card>


      {/* Jalons / propositions / validés */}
      {/* ── Propositions du sportif à valider ─────────────────────────── */}
      {pendingMilestones.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-amber-600">
              <AlertTriangle className="h-5 w-5" /> Propositions du sportif à valider ({pendingMilestones.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sortMilestones(pendingMilestones).map((m) => (
              <div key={m.id} className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-background p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{m.label}</p>
                  {m.target_date && <p className="text-xs text-muted-foreground">Cible : {format(new Date(m.target_date), "d MMM yyyy", { locale: fr })}</p>}
                  {m.notes && <p className="text-xs text-muted-foreground italic">{m.notes}</p>}
                  <p className="text-[11px] text-amber-600 mt-0.5">Proposé par le sportif</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApproveMilestone(m)}>
                    <Check className="h-4 w-4 mr-1" /> Valider
                  </Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => handleRejectMilestone(m)}>
                    <X className="h-4 w-4 mr-1" /> Refuser
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
          {activeMilestones.length === 0 ? (
            <p className="text-center text-muted-foreground py-3 text-sm">Aucun jalon à venir.</p>
          ) : (
            <div className="space-y-3">
              {sortMilestones(activeMilestones).map((m) => {
                const daysUntil = getDaysUntil(m.target_date);
                return (
                  <Card key={m.id} className={cn("p-4", m.completed && "border-emerald-500/40 bg-emerald-500/5")}>
                    <div className="flex items-start gap-3">
                      {/* Bouton valider / dévalider */}
                      <button
                        type="button"
                        onClick={() => handleToggleMilestone(m)}
                        title={m.completed ? "Marquer comme à venir" : "Valider ce jalon"}
                        className={cn(
                          "mt-0.5 h-7 w-7 shrink-0 rounded-full grid place-items-center border-2 transition-colors",
                          m.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/40 text-transparent hover:border-primary hover:text-primary/40",
                        )}
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={cn("font-semibold", m.completed && "text-emerald-600")}>{m.label}</h4>
                          <Badge variant={getMilestoneBadge(m)}>
                            {m.completed ? "Atteint ✓" : daysUntil === null ? "Sans date" : daysUntil < 0 ? `Dépassé de ${Math.abs(daysUntil)} j` : daysUntil === 0 ? "Aujourd'hui" : daysUntil === 1 ? "Demain" : `Dans ${daysUntil} j`}
                          </Badge>
                        </div>
                        {m.completed ? (
                          <p className="text-sm text-emerald-600">
                            Validé{m.completed_at ? ` le ${format(new Date(m.completed_at), "d MMMM yyyy", { locale: fr })}` : ""}
                            {m.target_date ? <span className="text-muted-foreground"> · cible {format(new Date(m.target_date), "d MMM", { locale: fr })}</span> : null}
                          </p>
                        ) : m.target_date ? (
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(m.target_date), "EEEE d MMMM yyyy", { locale: fr })}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground/60 italic">Pas de date cible</p>
                        )}
                        {m.notes && <p className="text-sm text-muted-foreground italic">{m.notes}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
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

      {/* ── Objectifs & sous-objectifs validés (repliable) ────────────── */}
      {doneMilestones.length > 0 && (
        <Card className="border-emerald-500/30">
          <button type="button" onClick={() => setShowValidated((v) => !v)} className="w-full text-left">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-emerald-600">
                <Check className="h-5 w-5" /> Objectifs &amp; sous-objectifs validés ({doneMilestones.length})
                <ChevronDown className={cn("h-4 w-4 ml-auto transition-transform", showValidated && "rotate-180")} />
              </CardTitle>
            </CardHeader>
          </button>
          {showValidated && (
          <CardContent className="space-y-2">
            {sortMilestones(doneMilestones).map((m) => (
              <div key={m.id} className={cn("flex items-center gap-3 rounded-lg border p-3", m.is_objective ? "border-primary/40 bg-primary/5" : "border-emerald-500/30 bg-emerald-500/5")}>
                <span className={cn("h-7 w-7 shrink-0 rounded-full grid place-items-center text-white", m.is_objective ? "bg-primary text-[13px]" : "bg-emerald-500")}>
                  {m.is_objective ? "🎯" : <Check className="h-4 w-4" />}
                </span>
                <div className="flex-1 min-w-0">
                  {m.is_objective && <p className="text-[9px] uppercase tracking-wide text-primary font-bold leading-none">Objectif atteint</p>}
                  <p className={cn("font-semibold text-sm", m.is_objective ? "text-primary" : "text-emerald-600")}>{m.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Validé{m.completed_at ? ` le ${format(new Date(m.completed_at), "d MMMM yyyy", { locale: fr })}` : ""}
                  </p>
                </div>
                {!m.is_objective && (
                  <button type="button" onClick={() => handleToggleMilestone(m)} title="Remettre à venir" className="text-[11px] text-muted-foreground hover:text-foreground shrink-0">Annuler</button>
                )}
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => handleDeleteMilestone(m.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </CardContent>
          )}
        </Card>
      )}

      </div>

      {/* Colonne droite : Phases + Timeline */}
      <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
      {/* ── Phases d'entraînement (liées à l'objectif) ────────────────── */}
      {objective.main_objective && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-5 w-5 text-primary" /> Phases d'entraînement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PhaseBuilder
              athleteId={athleteId}
              deadline={objective.main_objective_deadline || null}
              phases={mesocycles
                .filter((m) => !m.macrocycle_id)
                .map((m) => ({ id: m.id, name: m.name, start_date: m.start_date, end_date: m.end_date, coach_note: m.coach_note, color: m.color }))}
              onReload={loadAll}
            />
          </CardContent>
        </Card>
      )}


      {/* ── Timeline de validation ────────────────────────────────────── */}
      {(milestones.length > 0 || !!objective.main_objective) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-5 w-5 text-primary" /> Timeline de validation
              <div className="ml-auto flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" title="Reculer" onClick={() => setTlMonthOffset((o) => o - 1)}>
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </Button>
                {tlMonthOffset !== 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2" onClick={() => setTlMonthOffset(0)}>Aujourd'hui</Button>
                )}
                <Button variant="outline" size="icon" className="h-7 w-7" title="Avancer" onClick={() => setTlMonthOffset((o) => o + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const start = new Date(); start.setHours(0, 0, 0, 0);
              const dl = objective.main_objective_deadline ? new Date(objective.main_objective_deadline) : null;
              const COLORS = ["#e8c466", "#5aa9e6", "#9c7bd6", "#5fbf82", "#e8974a", "#e56464"];
              const phasesTL = mesocycles
                .filter((m) => !m.macrocycle_id)
                .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
              const endOf = (p: Mesocycle) => (p.end_date ? new Date(p.end_date) : (dl || addDays(new Date(p.start_date), 14)));

              // Points (jalons + objectif principal)
              type TItem = { key: string; label: string; date: string | null; completed: boolean; isNext: boolean; isMain: boolean; onClick: () => void };
              const items: TItem[] = sortMilestones(approvedMilestones).map((m) => {
                const daysUntil = getDaysUntil(m.target_date);
                return { key: m.id, label: m.label, date: milestoneRefDate(m) || null, completed: m.completed, isNext: !m.completed && daysUntil !== null && daysUntil >= 0, isMain: false, onClick: () => handleToggleMilestone(m) };
              });
              if (objective.main_objective && (objective.main_objective_deadline || objective.main_completed)) {
                const mdate = objective.main_completed ? (objective.main_completed_at || objective.main_objective_deadline || null) : (objective.main_objective_deadline || null);
                items.push({ key: "main", label: objective.main_objective, date: mdate, completed: !!objective.main_completed, isNext: !objective.main_completed, isMain: true, onClick: handleValidateMainObjective });
              }
              // Fenêtre glissante : J-2 semaines (gauche) → +6 mois (droite), navigable
              const windowStart = addMonths(addDays(start, -14), tlMonthOffset);
              const windowEnd = addMonths(windowStart, 4);
              const totalMs = windowEnd.getTime() - windowStart.getTime();
              const pos = (ms: number) => Math.max(0, Math.min(100, ((ms - windowStart.getTime()) / totalMs) * 100));
              const inWin = (ms: number) => ms >= windowStart.getTime() && ms <= windowEnd.getTime();
              const weeksTotal = Math.round(totalMs / (7 * 86400000));
              const dated = items
                .filter((it) => it.date && inWin(new Date(it.date).getTime()))
                .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());

              return (
                <div className="overflow-x-auto pb-2">
                  <div className="relative min-w-[560px]">
                    {/* Bande des phases (survole pour le détail) */}
                    {phasesTL.length > 0 && (
                      <div className="relative h-3.5 rounded-full bg-muted/40 overflow-hidden mb-3">
                        {phasesTL.map((p, i) => {
                          const s = new Date(p.start_date).getTime();
                          const e = endOf(p).getTime() + 86400000; // +1 jour pour toucher la phase suivante
                          if (e < windowStart.getTime() || s > windowEnd.getTime()) return null; // hors fenêtre
                          const col = p.color || COLORS[i % COLORS.length];
                          const range = `${format(new Date(p.start_date), "d MMM", { locale: fr })}${p.end_date ? ` → ${format(new Date(p.end_date), "d MMM yyyy", { locale: fr })}` : " → en cours"}`;
                          return (
                            <div key={p.id} className="absolute top-0 h-full rounded-full transition-transform hover:scale-y-150 cursor-help"
                              style={{ left: `${pos(s)}%`, width: `${Math.max(1, pos(e) - pos(s))}%`, backgroundColor: col }}
                              title={`Phase ${i + 1} · ${p.name} · ${range}`} />
                          );
                        })}
                      </div>
                    )}

                    {/* Zone timeline : axe + traits de semaine + points */}
                    <div className="relative h-[128px]">
                      {/* Axe */}
                      <div className="absolute left-0 right-0 top-[14px] h-0.5 bg-border" />
                      {/* Curseur "aujourd'hui" */}
                      {inWin(start.getTime()) && (
                        <div className="absolute top-[6px] h-4 w-0.5 bg-primary z-20" style={{ left: `${pos(start.getTime())}%` }} title="Aujourd'hui" />
                      )}
                      {/* Traits de semaine sur la ligne (label mensuel toutes les 4 sem.) */}
                      {weeksTotal >= 1 && weeksTotal <= 40 && Array.from({ length: weeksTotal + 1 }, (_, w) => {
                        const leftPct = (w * 7 * 86400000 / totalMs) * 100;
                        const major = w % 4 === 0;
                        const tickDate = addWeeks(windowStart, w);
                        return (
                          <div key={w} className="absolute -translate-x-1/2 flex flex-col items-center" style={{ left: `${leftPct}%`, top: major ? "8px" : "11px" }}>
                            <div className={cn("w-px", major ? "h-3 bg-muted-foreground/50" : "h-1.5 bg-muted-foreground/25")} />
                            {major && <span className="text-[8px] text-muted-foreground/50 tabular-nums leading-none mt-0.5">{format(tickDate, "d MMM", { locale: fr })}</span>}
                          </div>
                        );
                      })}
                      {/* Points (étiquettes alternées sur 2 niveaux pour rester lisibles) */}
                      {dated.map((it, idx) => {
                        const leftPct = pos(new Date(it.date!).getTime());
                        const d0 = new Date(); d0.setHours(0, 0, 0, 0);
                        const weeks = Math.ceil((new Date(it.date!).getTime() - d0.getTime()) / (7 * 86400000));
                        const labelTop = 32 + (idx % 2) * 42; // deux rangées
                        return (
                          <div key={it.key} className="group absolute -translate-x-1/2" style={{ left: `${leftPct}%`, top: 0 }}>
                            {/* connecteur point → étiquette */}
                            <div className="absolute left-1/2 -translate-x-1/2 w-px bg-border/60" style={{ top: "14px", height: `${labelTop - 14}px` }} />
                            {/* Bulle au survol (nom + date) */}
                            <span className={cn("pointer-events-none absolute left-1/2 -translate-x-1/2 -top-7 hidden group-hover:block whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-[11px] font-medium shadow-md z-30",
                              it.completed ? "text-emerald-600" : "text-foreground")}>
                              {it.isMain ? "🎯 " : ""}{it.label}{it.completed ? " ✓" : ""} · {format(new Date(it.date!), "d MMM yyyy", { locale: fr })}
                            </span>
                            {/* point sur l'axe (non cliquable) */}
                            <span
                              className={cn(
                                "absolute left-1/2 -translate-x-1/2 grid place-items-center rounded-full border-2 border-background z-10 text-[10px] cursor-help transition-transform group-hover:scale-125",
                                it.isMain ? "h-7 w-7" : "h-4 w-4",
                                it.completed ? "bg-emerald-500 ring-4 ring-emerald-500/25"
                                  : it.isMain ? "bg-primary ring-4 ring-primary/25"
                                  : it.isNext ? "bg-primary ring-4 ring-primary/20"
                                  : "bg-muted border-dashed border-muted-foreground/50",
                              )}
                              style={{ top: it.isMain ? "1px" : "6px" }}
                            >{it.isMain ? "🎯" : ""}</span>
                            {/* étiquette : seulement le compte à rebours */}
                            <div className="absolute left-1/2 -translate-x-1/2 w-[70px] text-center" style={{ top: `${labelTop}px` }}>
                              {!it.completed && (weeks < 0
                                ? <span className="block text-[9px] text-destructive font-medium leading-none">en retard</span>
                                : <span className={cn("block text-[9px] font-semibold leading-none", it.isMain ? "text-primary" : "text-muted-foreground")}>dans {weeks} sem.</span>)}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground pt-1">
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Validé</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> À venir</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-muted border border-dashed border-muted-foreground/50" /> Dépassé</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
      </div>

    </div>

      {/* ── Dialog milestone ──────────────────────────────────────────── */}
      <Dialog open={showMilestoneDialog} onOpenChange={setShowMilestoneDialog}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingMilestone ? "Modifier le jalon" : "Ajouter un jalon"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label>Intitulé *</Label>
              <Input placeholder="Ex: 10 km sous 52 min, Test VMA…" value={milestoneForm.label} onChange={(e) => setMilestoneForm({ ...milestoneForm, label: e.target.value })} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Date cible <span className="text-muted-foreground font-normal">(facultatif)</span></Label>
                {milestoneForm.target_date && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setMilestoneForm({ ...milestoneForm, target_date: null })}>
                    Retirer la date
                  </Button>
                )}
              </div>
              <div className="border rounded-md p-2 bg-background">
                <Calendar mode="single" selected={milestoneForm.target_date ?? undefined} onSelect={(d) => setMilestoneForm({ ...milestoneForm, target_date: d ?? null })} locale={fr} weekStartsOn={1} className="pointer-events-auto mx-auto" />
              </div>
              <p className="text-xs text-muted-foreground">Sans date, le jalon se placera sur la timeline à sa <b>date de validation</b>.</p>
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
