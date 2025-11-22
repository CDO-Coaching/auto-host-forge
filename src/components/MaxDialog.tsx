import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Exercise {
  id: string;
  name: string;
  muscle_principal: string;
}

interface MaxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editMax?: {
    id: string;
    exercise_id: string;
    max_type: string;
    weight_kg: number;
    notes: string | null;
    recorded_at: string;
  } | null;
  athleteId?: string;
}

export function MaxDialog({ open, onOpenChange, onSuccess, editMax, athleteId }: MaxDialogProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseId, setExerciseId] = useState("");
  const [maxType, setMaxType] = useState("1RM");
  const [weight, setWeight] = useState("");
  const [recordedAt, setRecordedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExercises();
  }, []);

  useEffect(() => {
    if (editMax) {
      setExerciseId(editMax.exercise_id);
      setMaxType(editMax.max_type);
      setWeight(editMax.weight_kg.toString());
      setRecordedAt(editMax.recorded_at.split('T')[0]);
      setNotes(editMax.notes || "");
    } else {
      resetForm();
    }
  }, [editMax, open]);

  const loadExercises = async () => {
    const { data } = await supabase
      .from("exercise_library")
      .select("id, name, muscle_principal")
      .order("name");
    
    if (data) setExercises(data);
  };

  const resetForm = () => {
    setExerciseId("");
    setMaxType("1RM");
    setWeight("");
    setRecordedAt(new Date().toISOString().split('T')[0]);
    setNotes("");
  };

  const handleSubmit = async () => {
    if (!exerciseId || !weight || !recordedAt) {
      toast.error("Remplis tous les champs obligatoires");
      return;
    }

    const weightNum = parseFloat(weight);
    if (weightNum <= 0) {
      toast.error("Le poids doit être supérieur à 0");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const targetAthleteId = athleteId || user?.id;

      if (!targetAthleteId) {
        toast.error("Utilisateur non trouvé");
        return;
      }

      const maxData = {
        athlete_id: targetAthleteId,
        exercise_id: exerciseId,
        max_type: maxType,
        weight_kg: weightNum,
        recorded_at: recordedAt,
        notes: notes || null,
      };

      if (editMax) {
        const { error } = await supabase
          .from("exercise_maxes")
          .update(maxData)
          .eq("id", editMax.id);

        if (error) throw error;
        toast.success("Max mis à jour !");
      } else {
        const { error } = await supabase
          .from("exercise_maxes")
          .insert(maxData);

        if (error) throw error;
        toast.success("Nouveau max enregistré ! 🎉");
      }

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{editMax ? "Modifier le max" : "Nouveau max"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="exercise">Exercice *</Label>
            <Select value={exerciseId} onValueChange={setExerciseId}>
              <SelectTrigger id="exercise">
                <SelectValue placeholder="Sélectionne un exercice" />
              </SelectTrigger>
              <SelectContent>
                {exercises.map((ex) => (
                  <SelectItem key={ex.id} value={ex.id}>
                    {ex.name} <span className="text-muted-foreground">({ex.muscle_principal})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxType">Type de max *</Label>
              <Select value={maxType} onValueChange={setMaxType}>
                <SelectTrigger id="maxType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1RM">1RM</SelectItem>
                  <SelectItem value="3RM">3RM</SelectItem>
                  <SelectItem value="5RM">5RM</SelectItem>
                  <SelectItem value="10RM">10RM</SelectItem>
                  <SelectItem value="max_theorique">Max théorique</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="weight">Poids (kg) *</Label>
              <Input
                id="weight"
                type="number"
                step="0.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="100"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              value={recordedAt}
              onChange={(e) => setRecordedAt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ajoute des notes sur cette performance..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editMax ? "Mettre à jour" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
