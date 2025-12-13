import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Plus, Pencil, Trash2, Target, CalendarDays, Save, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, addWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

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

export function CoachObjectivesView({ athleteId, athleteName }: CoachObjectivesViewProps) {
  const [objective, setObjective] = useState<AthleteObjective>({});
  const [milestones, setMilestones] = useState<ObjectiveMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSavingMain, setIsSavingMain] = useState(false);
  const [isSavingSecondary, setIsSavingSecondary] = useState(false);
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<ObjectiveMilestone | null>(null);
  const [mainDeadlineDate, setMainDeadlineDate] = useState<Date | undefined>(undefined);
  const [milestoneForm, setMilestoneForm] = useState({
    label: "",
    target_date: new Date(),
    notes: "",
    completed: false,
  });

  useEffect(() => {
    loadObjectives();
    loadMilestones();
  }, [athleteId]);

  useEffect(() => {
    if (objective.main_objective_deadline) {
      setMainDeadlineDate(new Date(objective.main_objective_deadline));
    }
  }, [objective.main_objective_deadline]);

  const loadObjectives = async () => {
    try {
      const { data, error } = await supabase
        .from("athlete_objectives")
        .select("*")
        .eq("athlete_id", athleteId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      
      if (data) {
        setObjective(data);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des objectifs:", error);
      toast.error("Erreur lors du chargement des objectifs");
    } finally {
      setLoading(false);
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

  const handleSaveSecondaryObjective = async () => {
    if (!objective.secondary_objective?.trim()) {
      toast.error("Veuillez remplir l'objectif secondaire");
      return;
    }

    setIsSavingSecondary(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { error } = await supabase
        .from("athlete_objectives")
        .upsert({
          athlete_id: athleteId,
          coach_id: user.id,
          main_objective: objective.main_objective,
          main_objective_deadline: objective.main_objective_deadline,
          secondary_objective: objective.secondary_objective,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "athlete_id"
        });

      if (error) throw error;

      toast.success("Objectif secondaire enregistré");
      await loadObjectives();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setIsSavingSecondary(false);
    }
  };

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
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette date d'objectif ?")) {
      return;
    }

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

  if (loading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
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

      {/* Objectif Secondaire */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-secondary" />
            Objectif Secondaire
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="secondary-objective">Description de l'objectif secondaire</Label>
            <Textarea
              id="secondary-objective"
              placeholder="Ex: Améliorer la technique de course, renforcer le core, etc."
              value={objective.secondary_objective || ""}
              onChange={(e) => setObjective({ ...objective, secondary_objective: e.target.value })}
              rows={3}
            />
          </div>

          <Button onClick={handleSaveSecondaryObjective} disabled={isSavingSecondary} variant="secondary">
            <Save className="h-4 w-4 mr-2" />
            {isSavingSecondary ? "Enregistrement..." : "Enregistrer l'objectif secondaire"}
          </Button>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMilestone ? "Modifier la date d'objectif" : "Ajouter une date d'objectif"}
            </DialogTitle>
            <DialogDescription>
              Définissez une échéance importante pour le suivi de progression de {athleteName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
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

          <DialogFooter>
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
    </div>
  );
}
