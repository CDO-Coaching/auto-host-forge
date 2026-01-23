import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Plus, Pencil, Trash2, Target, CalendarDays, Save, X, RefreshCw, Layers, Layers2, Layers3 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, differenceInWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { YearTimeline } from "./YearTimeline";

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

interface Macrocycle {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  description?: string;
  color: string;
}

interface Mesocycle {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  description?: string;
  color: string;
  macrocycle_id?: string;
}

interface Microcycle {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  description?: string;
  color: string;
  mesocycle_id?: string;
}

const CYCLE_COLORS = [
  { value: "#8B5CF6", label: "Violet" },
  { value: "#3B82F6", label: "Bleu" },
  { value: "#10B981", label: "Vert" },
  { value: "#F59E0B", label: "Orange" },
  { value: "#EF4444", label: "Rouge" },
  { value: "#EC4899", label: "Rose" },
  { value: "#06B6D4", label: "Cyan" },
  { value: "#84CC16", label: "Lime" },
];

type CycleType = "macro" | "meso" | "micro";

export function CoachObjectivesView({ athleteId, athleteName }: CoachObjectivesViewProps) {
  const [objective, setObjective] = useState<AthleteObjective>({});
  const [milestones, setMilestones] = useState<ObjectiveMilestone[]>([]);
  const [macrocycles, setMacrocycles] = useState<Macrocycle[]>([]);
  const [mesocycles, setMesocycles] = useState<Mesocycle[]>([]);
  const [microcycles, setMicrocycles] = useState<Microcycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSavingMain, setIsSavingMain] = useState(false);
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false);
  const [showCycleDialog, setShowCycleDialog] = useState(false);
  const [cycleDialogType, setCycleDialogType] = useState<CycleType>("macro");
  const [editingMilestone, setEditingMilestone] = useState<ObjectiveMilestone | null>(null);
  const [editingCycle, setEditingCycle] = useState<Macrocycle | Mesocycle | Microcycle | null>(null);
  const [mainDeadlineDate, setMainDeadlineDate] = useState<Date | undefined>(undefined);
  const [milestoneForm, setMilestoneForm] = useState({
    label: "",
    target_date: new Date(),
    notes: "",
    completed: false,
  });
  const [cycleForm, setCycleForm] = useState({
    name: "",
    start_date: new Date(),
    end_date: new Date(),
    description: "",
    color: "#8B5CF6",
    parent_id: "" as string,
  });

  useEffect(() => {
    loadAll();
  }, [athleteId]);

  useEffect(() => {
    if (objective.main_objective_deadline) {
      setMainDeadlineDate(new Date(objective.main_objective_deadline));
    }
  }, [objective.main_objective_deadline]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      loadObjectives(),
      loadMilestones(),
      loadMacrocycles(),
      loadMesocycles(),
      loadMicrocycles(),
    ]);
    setLoading(false);
  };

  const loadObjectives = async () => {
    try {
      const { data, error } = await supabase
        .from("athlete_objectives")
        .select("*")
        .eq("athlete_id", athleteId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      if (data) setObjective(data);
    } catch (error) {
      console.error("Erreur lors du chargement des objectifs:", error);
    }
  };

  const loadMilestones = async () => {
    try {
      const { data, error } = await supabase
        .from("objective_milestones")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("target_date", { ascending: true });

      if (error) throw error;
      setMilestones(data || []);
    } catch (error) {
      console.error("Erreur lors du chargement des dates d'objectifs:", error);
    }
  };

  const loadMacrocycles = async () => {
    try {
      const { data, error } = await supabase
        .from("macrocycles")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("start_date", { ascending: true });

      if (error) throw error;
      setMacrocycles(data || []);
    } catch (error) {
      console.error("Erreur lors du chargement des macrocycles:", error);
    }
  };

  const loadMesocycles = async () => {
    try {
      const { data, error } = await supabase
        .from("mesocycles")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("start_date", { ascending: true });

      if (error) throw error;
      setMesocycles(data || []);
    } catch (error) {
      console.error("Erreur lors du chargement des mésocycles:", error);
    }
  };

  const loadMicrocycles = async () => {
    try {
      const { data, error } = await supabase
        .from("microcycles")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("start_date", { ascending: true });

      if (error) throw error;
      setMicrocycles(data || []);
    } catch (error) {
      console.error("Erreur lors du chargement des microcycles:", error);
    }
  };

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

      const { error } = await supabase
        .from("athlete_objectives")
        .upsert({
          athlete_id: athleteId,
          coach_id: user.id,
          main_objective: objective.main_objective,
          main_objective_deadline: deadline,
          secondary_objective: objective.secondary_objective,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "athlete_id"
        });

      if (error) throw error;

      setObjective(prev => ({ ...prev, main_objective_deadline: deadline }));
      toast.success("Objectif principal enregistré");
      await loadObjectives();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setIsSavingMain(false);
    }
  };

  // Milestone handlers
  const handleOpenMilestoneDialog = (milestone?: ObjectiveMilestone) => {
    if (milestone) {
      setEditingMilestone(milestone);
      setMilestoneForm({
        label: milestone.label,
        target_date: new Date(milestone.target_date),
        notes: milestone.notes || "",
        completed: milestone.completed,
      });
    } else {
      setEditingMilestone(null);
      setMilestoneForm({
        label: "",
        target_date: new Date(),
        notes: "",
        completed: false,
      });
    }
    setShowMilestoneDialog(true);
  };

  const handleSaveMilestone = async () => {
    if (!milestoneForm.label.trim()) {
      toast.error("Veuillez remplir le label");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const milestoneData = {
        athlete_id: athleteId,
        coach_id: user.id,
        label: milestoneForm.label,
        target_date: format(milestoneForm.target_date, "yyyy-MM-dd"),
        notes: milestoneForm.notes || null,
        completed: milestoneForm.completed,
        updated_at: new Date().toISOString(),
      };

      if (editingMilestone) {
        const { error } = await supabase
          .from("objective_milestones")
          .update(milestoneData)
          .eq("id", editingMilestone.id);

        if (error) throw error;
        toast.success("Date d'objectif modifiée");
      } else {
        const { error } = await supabase
          .from("objective_milestones")
          .insert(milestoneData);

        if (error) throw error;
        toast.success("Date d'objectif ajoutée");
      }

      setShowMilestoneDialog(false);
      await loadMilestones();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette date d'objectif ?")) return;

    try {
      const { error } = await supabase
        .from("objective_milestones")
        .delete()
        .eq("id", milestoneId);

      if (error) throw error;
      toast.success("Date d'objectif supprimée");
      await loadMilestones();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  // Cycle handlers (generic for macro/meso/micro)
  const handleOpenCycleDialog = (type: CycleType, cycle?: Macrocycle | Mesocycle | Microcycle) => {
    setCycleDialogType(type);
    if (cycle) {
      setEditingCycle(cycle);
      setCycleForm({
        name: cycle.name,
        start_date: new Date(cycle.start_date),
        end_date: new Date(cycle.end_date),
        description: cycle.description || "",
        color: cycle.color,
        parent_id: type === "meso" 
          ? (cycle as Mesocycle).macrocycle_id || ""
          : type === "micro"
          ? (cycle as Microcycle).mesocycle_id || ""
          : "",
      });
    } else {
      setEditingCycle(null);
      setCycleForm({
        name: "",
        start_date: new Date(),
        end_date: new Date(),
        description: "",
        color: type === "macro" ? "#8B5CF6" : type === "meso" ? "#3B82F6" : "#06B6D4",
        parent_id: "",
      });
    }
    setShowCycleDialog(true);
  };

  const handleSaveCycle = async () => {
    if (!cycleForm.name.trim()) {
      toast.error("Veuillez remplir le nom");
      return;
    }

    if (cycleForm.end_date < cycleForm.start_date) {
      toast.error("La date de fin doit être après la date de début");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const baseData = {
        athlete_id: athleteId,
        coach_id: user.id,
        name: cycleForm.name,
        start_date: format(cycleForm.start_date, "yyyy-MM-dd"),
        end_date: format(cycleForm.end_date, "yyyy-MM-dd"),
        description: cycleForm.description || null,
        color: cycleForm.color,
        updated_at: new Date().toISOString(),
      };

      const tableName = cycleDialogType === "macro" 
        ? "macrocycles" 
        : cycleDialogType === "meso" 
        ? "mesocycles" 
        : "microcycles";

      const cycleData = cycleDialogType === "meso"
        ? { ...baseData, macrocycle_id: cycleForm.parent_id || null }
        : cycleDialogType === "micro"
        ? { ...baseData, mesocycle_id: cycleForm.parent_id || null }
        : baseData;

      if (editingCycle) {
        const { error } = await supabase
          .from(tableName)
          .update(cycleData)
          .eq("id", editingCycle.id);

        if (error) throw error;
        toast.success(`${getCycleLabel(cycleDialogType)} modifié`);
      } else {
        const { error } = await supabase
          .from(tableName)
          .insert(cycleData);

        if (error) throw error;
        toast.success(`${getCycleLabel(cycleDialogType)} créé`);
      }

      setShowCycleDialog(false);
      await loadAll();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const handleDeleteCycle = async (type: CycleType, cycleId: string) => {
    const label = getCycleLabel(type);
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ce ${label.toLowerCase()} ?`)) return;

    const tableName = type === "macro" ? "macrocycles" : type === "meso" ? "mesocycles" : "microcycles";

    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", cycleId);

      if (error) throw error;
      toast.success(`${label} supprimé`);
      await loadAll();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  // Handler for drag/resize updates from timeline
  const handleCycleDatesChange = async (
    cycleType: CycleType,
    cycleId: string,
    newStartDate: string,
    newEndDate: string
  ) => {
    const tableName = cycleType === "macro" 
      ? "macrocycles" 
      : cycleType === "meso" 
      ? "mesocycles" 
      : "microcycles";

    try {
      const { error } = await supabase
        .from(tableName)
        .update({
          start_date: newStartDate,
          end_date: newEndDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cycleId);

      if (error) throw error;
      
      toast.success("Dates mises à jour");
      await loadAll();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour des dates");
    }
  };

  const getCycleLabel = (type: CycleType) => {
    switch (type) {
      case "macro": return "Macrocycle";
      case "meso": return "Mésocycle";
      case "micro": return "Microcycle";
    }
  };

  const getCycleIcon = (type: CycleType) => {
    switch (type) {
      case "macro": return Layers;
      case "meso": return Layers2;
      case "micro": return Layers3;
    }
  };

  const getDaysUntil = (dateString: string): number => {
    const target = new Date(dateString);
    const today = new Date();
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getMilestoneBadgeVariant = (milestone: ObjectiveMilestone) => {
    if (milestone.completed) return "default";
    const daysUntil = getDaysUntil(milestone.target_date);
    if (daysUntil < 0) return "destructive";
    if (daysUntil <= 7) return "destructive";
    if (daysUntil <= 14) return "secondary";
    return "outline";
  };

  const getCycleStatus = (cycle: { start_date: string; end_date: string }) => {
    const today = new Date();
    const startDate = new Date(cycle.start_date);
    const endDate = new Date(cycle.end_date);
    
    if (today < startDate) return "upcoming";
    if (today > endDate) return "completed";
    return "active";
  };

  const getCycleWeeks = (cycle: { start_date: string; end_date: string }) => {
    const start = new Date(cycle.start_date);
    const end = new Date(cycle.end_date);
    return differenceInWeeks(end, start) + 1;
  };

  const renderCycleCard = (
    cycle: Macrocycle | Mesocycle | Microcycle,
    type: CycleType,
    parentName?: string
  ) => {
    const status = getCycleStatus(cycle);
    const weeks = getCycleWeeks(cycle);
    const CycleIcon = getCycleIcon(type);

    return (
      <Card 
        key={cycle.id} 
        className="p-4"
        style={{ borderLeftColor: cycle.color, borderLeftWidth: "4px" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <CycleIcon className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold">{cycle.name}</h4>
              <Badge 
                variant={status === "active" ? "default" : status === "upcoming" ? "secondary" : "outline"}
              >
                {status === "active" ? "En cours" : status === "upcoming" ? "À venir" : "Terminé"}
              </Badge>
              <Badge variant="outline">{weeks} sem.</Badge>
            </div>
            {parentName && (
              <p className="text-xs text-muted-foreground">
                Dans: {parentName}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              <CalendarIcon className="inline h-4 w-4 mr-1" />
              {format(new Date(cycle.start_date), "d MMM yyyy", { locale: fr })}
              {" → "}
              {format(new Date(cycle.end_date), "d MMM yyyy", { locale: fr })}
            </p>
            {cycle.description && (
              <p className="text-sm text-muted-foreground italic">{cycle.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenCycleDialog(type, cycle)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteCycle(type, cycle.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  if (loading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Timeline annuelle */}
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
        onCycleDatesChange={handleCycleDatesChange}
        onAddCycle={(type) => handleOpenCycleDialog(type)}
        onAddMilestone={() => handleOpenMilestoneDialog()}
      />

      {/* Objectif Principal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Objectif Principal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="main-objective">Description de l'objectif</Label>
            <Textarea
              id="main-objective"
              placeholder="Ex: Préparer le marathon de Paris, améliorer son 10km, etc."
              value={objective.main_objective || ""}
              onChange={(e) => setObjective({ ...objective, main_objective: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Date cible de l'objectif *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !mainDeadlineDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {mainDeadlineDate ? (
                    format(mainDeadlineDate, "EEEE d MMMM yyyy", { locale: fr })
                  ) : (
                    <span>Sélectionner une date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={mainDeadlineDate}
                  onSelect={setMainDeadlineDate}
                  initialFocus
                  locale={fr}
                  weekStartsOn={1}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button onClick={handleSaveMainObjective} disabled={isSavingMain}>
            <Save className="h-4 w-4 mr-2" />
            {isSavingMain ? "Enregistrement..." : "Enregistrer l'objectif principal"}
          </Button>
        </CardContent>
      </Card>

      {/* Macrocycles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Macrocycles
              <Badge variant="outline" className="ml-2">{macrocycles.length}</Badge>
            </div>
            <Button onClick={() => handleOpenCycleDialog("macro")} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {macrocycles.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucun macrocycle. Créez un grand cycle de planification (ex: saison, préparation olympique).
            </p>
          ) : (
            <div className="space-y-3">
              {macrocycles.map((m) => renderCycleCard(m, "macro"))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mésocycles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers2 className="h-5 w-5 text-primary" />
              Mésocycles
              <Badge variant="outline" className="ml-2">{mesocycles.length}</Badge>
            </div>
            <Button onClick={() => handleOpenCycleDialog("meso")} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mesocycles.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucun mésocycle. Créez des cycles intermédiaires (ex: préparation générale, spécifique).
            </p>
          ) : (
            <div className="space-y-3">
              {mesocycles.map((m) => {
                const parentMacro = macrocycles.find(mac => mac.id === m.macrocycle_id);
                return renderCycleCard(m, "meso", parentMacro?.name);
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Microcycles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers3 className="h-5 w-5 text-primary" />
              Microcycles
              <Badge variant="outline" className="ml-2">{microcycles.length}</Badge>
            </div>
            <Button onClick={() => handleOpenCycleDialog("micro")} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {microcycles.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucun microcycle. Créez des cycles courts (ex: semaine type, bloc d'entraînement).
            </p>
          ) : (
            <div className="space-y-3">
              {microcycles.map((m) => {
                const parentMeso = mesocycles.find(meso => meso.id === m.mesocycle_id);
                return renderCycleCard(m, "micro", parentMeso?.name);
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dates d'Objectifs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Dates d'Objectifs
            </div>
            <Button onClick={() => handleOpenMilestoneDialog()} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {milestones.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucune date d'objectif pour le moment.
            </p>
          ) : (
            <div className="space-y-3">
              {milestones.map((milestone) => {
                const daysUntil = getDaysUntil(milestone.target_date);
                return (
                  <Card key={milestone.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{milestone.label}</h4>
                          <Badge variant={getMilestoneBadgeVariant(milestone)}>
                            {milestone.completed
                              ? "Atteint"
                              : daysUntil < 0
                              ? `Dépassé de ${Math.abs(daysUntil)} j`
                              : daysUntil === 0
                              ? "Aujourd'hui"
                              : daysUntil === 1
                              ? "Demain"
                              : `Dans ${daysUntil} j`}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <CalendarIcon className="inline h-4 w-4 mr-1" />
                          {format(new Date(milestone.target_date), "EEEE d MMMM yyyy", { locale: fr })}
                        </p>
                        {milestone.notes && (
                          <p className="text-sm text-muted-foreground italic">{milestone.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenMilestoneDialog(milestone)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMilestone(milestone.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog pour ajouter/modifier une date d'objectif */}
      <Dialog open={showMilestoneDialog} onOpenChange={setShowMilestoneDialog}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingMilestone ? "Modifier la date d'objectif" : "Ajouter une date d'objectif"}
            </DialogTitle>
            <DialogDescription>
              Définissez une échéance importante pour le suivi de progression de {athleteName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label htmlFor="milestone-label">Label *</Label>
              <Input
                id="milestone-label"
                placeholder="Ex: Compétition régionale, Test VMA..."
                value={milestoneForm.label}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, label: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Date cible *</Label>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <CalendarIcon className="h-4 w-4" />
                {milestoneForm.target_date ? (
                  format(milestoneForm.target_date, "EEEE d MMMM yyyy", { locale: fr })
                ) : (
                  <span>Aucune date sélectionnée</span>
                )}
              </div>
              <div className="border rounded-md p-2 bg-background">
                <Calendar
                  mode="single"
                  selected={milestoneForm.target_date}
                  onSelect={(date) => date && setMilestoneForm({ ...milestoneForm, target_date: date })}
                  locale={fr}
                  weekStartsOn={1}
                  className="pointer-events-auto mx-auto"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="milestone-notes">Notes (optionnel)</Label>
              <Textarea
                id="milestone-notes"
                placeholder="Informations complémentaires..."
                value={milestoneForm.notes}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, notes: e.target.value })}
                rows={3}
              />
            </div>

            {editingMilestone && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="milestone-completed"
                  checked={milestoneForm.completed}
                  onCheckedChange={(checked) =>
                    setMilestoneForm({ ...milestoneForm, completed: checked as boolean })
                  }
                />
                <label
                  htmlFor="milestone-completed"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 cursor-pointer"
                >
                  Marquer comme atteint
                </label>
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setShowMilestoneDialog(false)}>
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
            <Button onClick={handleSaveMilestone}>
              <Save className="h-4 w-4 mr-2" />
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog pour ajouter/modifier un cycle (macro/meso/micro) */}
      <Dialog open={showCycleDialog} onOpenChange={setShowCycleDialog}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingCycle ? `Modifier le ${getCycleLabel(cycleDialogType).toLowerCase()}` : `Ajouter un ${getCycleLabel(cycleDialogType).toLowerCase()}`}
            </DialogTitle>
            <DialogDescription>
              {cycleDialogType === "macro" && "Créez un grand cycle de planification pour organiser la saison."}
              {cycleDialogType === "meso" && "Créez un cycle intermédiaire au sein d'un macrocycle."}
              {cycleDialogType === "micro" && "Créez un cycle court (semaine type) au sein d'un mésocycle."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label htmlFor="cycle-name">Nom *</Label>
              <Input
                id="cycle-name"
                placeholder={
                  cycleDialogType === "macro" 
                    ? "Ex: Saison 2025, Préparation Olympique..."
                    : cycleDialogType === "meso"
                    ? "Ex: Préparation générale, Spécifique, Affûtage..."
                    : "Ex: Semaine de charge, Semaine de récup..."
                }
                value={cycleForm.name}
                onChange={(e) => setCycleForm({ ...cycleForm, name: e.target.value })}
              />
            </div>

            {/* Parent selection for meso and micro */}
            {cycleDialogType === "meso" && macrocycles.length > 0 && (
              <div className="space-y-2">
                <Label>Macrocycle parent (optionnel)</Label>
                <Select
                  value={cycleForm.parent_id || "none"}
                  onValueChange={(value) => setCycleForm({ ...cycleForm, parent_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun macrocycle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {macrocycles.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {cycleDialogType === "micro" && mesocycles.length > 0 && (
              <div className="space-y-2">
                <Label>Mésocycle parent (optionnel)</Label>
                <Select
                  value={cycleForm.parent_id || "none"}
                  onValueChange={(value) => setCycleForm({ ...cycleForm, parent_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun mésocycle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {mesocycles.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Couleur</Label>
              <div className="flex gap-2 flex-wrap">
                {CYCLE_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-all",
                      cycleForm.color === color.value 
                        ? "border-foreground scale-110" 
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setCycleForm({ ...cycleForm, color: color.value })}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date de début *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(cycleForm.start_date, "d MMMM yyyy", { locale: fr })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={cycleForm.start_date}
                      onSelect={(date) => date && setCycleForm({ ...cycleForm, start_date: date })}
                      locale={fr}
                      weekStartsOn={1}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Date de fin *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(cycleForm.end_date, "d MMMM yyyy", { locale: fr })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={cycleForm.end_date}
                      onSelect={(date) => date && setCycleForm({ ...cycleForm, end_date: date })}
                      locale={fr}
                      weekStartsOn={1}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cycle-description">Description (optionnel)</Label>
              <Textarea
                id="cycle-description"
                placeholder="Objectifs de ce cycle, focus particulier..."
                value={cycleForm.description}
                onChange={(e) => setCycleForm({ ...cycleForm, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setShowCycleDialog(false)}>
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
            <Button onClick={handleSaveCycle}>
              <Save className="h-4 w-4 mr-2" />
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
