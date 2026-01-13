import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Milestone {
  id: string;
  label: string;
  target_date: string;
  notes: string | null;
  completed: boolean;
}

interface AthleteMilestoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestone?: Milestone | null;
  onSaved: () => void;
}

export function AthleteMilestoneDialog({ 
  open, 
  onOpenChange, 
  milestone, 
  onSaved 
}: AthleteMilestoneDialogProps) {
  const [label, setLabel] = useState("");
  const [targetDate, setTargetDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (milestone) {
      setLabel(milestone.label);
      setTargetDate(new Date(milestone.target_date));
      setNotes(milestone.notes || "");
    } else {
      setLabel("");
      setTargetDate(undefined);
      setNotes("");
    }
  }, [milestone, open]);

  const handleSave = async () => {
    if (!label.trim() || !targetDate) {
      toast.error("Remplis le libellé et la date");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Get coach_id from relationship
      const { data: relationship } = await supabase
        .from("coach_athlete_relationships")
        .select("coach_id")
        .eq("athlete_id", user.id)
        .eq("status", "approved")
        .maybeSingle();

      const coachId = relationship?.coach_id || user.id;

      const milestoneData = {
        athlete_id: user.id,
        coach_id: coachId,
        label: label.trim(),
        target_date: format(targetDate, "yyyy-MM-dd"),
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (milestone) {
        const { error } = await supabase
          .from("objective_milestones")
          .update(milestoneData)
          .eq("id", milestone.id);

        if (error) throw error;
        toast.success("Date d'objectif modifiée");
      } else {
        const { error } = await supabase
          .from("objective_milestones")
          .insert({ ...milestoneData, completed: false });

        if (error) throw error;
        toast.success("Date d'objectif ajoutée");
      }

      onOpenChange(false);
      onSaved();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!milestone) return;
    if (!confirm("Supprimer cette date d'objectif ?")) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("objective_milestones")
        .delete()
        .eq("id", milestone.id);

      if (error) throw error;
      toast.success("Date d'objectif supprimée");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {milestone ? "Modifier la date d'objectif" : "Ajouter une date d'objectif"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="label">Libellé *</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Compétition, Course, Objectif poids..."
            />
          </div>

          <div className="space-y-2">
            <Label>Date cible *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !targetDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {targetDate 
                    ? format(targetDate, "d MMMM yyyy", { locale: fr })
                    : "Sélectionner une date"
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={targetDate}
                  onSelect={setTargetDate}
                  locale={fr}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optionnel)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes personnelles..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-2">
            {milestone && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="flex-shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={saving || deleting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || deleting || !label.trim() || !targetDate}
              className="flex-1"
            >
              {saving ? "..." : "Enregistrer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
