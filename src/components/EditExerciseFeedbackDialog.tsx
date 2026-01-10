import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { RPEExplanationDialog } from "@/components/RPEExplanationDialog";
import { supabase } from "@/integrations/supabase/client";

interface EditExerciseFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  exercise: {
    id: string;
    exercice?: string;
    sportif_rpe?: number | null;
    sportif_comment?: string | null;
    // Cardio fields
    cardio_sport?: string | null;
    actual_distance_km?: number | null;
    actual_duration_minutes?: number | null;
    actual_pace_min_per_km?: string | null;
    actual_avg_heart_rate?: number | null;
  } | null;
}

export function EditExerciseFeedbackDialog({
  open,
  onOpenChange,
  onSaved,
  exercise,
}: EditExerciseFeedbackDialogProps) {
  const [rpe, setRpe] = useState("");
  const [comment, setComment] = useState("");
  // Cardio fields
  const [actualDistance, setActualDistance] = useState("");
  const [actualDuration, setActualDuration] = useState("");
  const [actualPace, setActualPace] = useState("");
  const [actualHeartRate, setActualHeartRate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Determine if this is a cardio exercise (has cardio_sport defined and not null)
  const isCardio = !!exercise?.cardio_sport;

  // Reset fields when dialog opens with current data
  useEffect(() => {
    if (open && exercise) {
      setRpe(exercise.sportif_rpe?.toString() || "");
      setComment(exercise.sportif_comment || "");
      setActualDistance(exercise.actual_distance_km?.toString() || "");
      setActualDuration(exercise.actual_duration_minutes?.toString() || "");
      setActualPace(exercise.actual_pace_min_per_km || "");
      setActualHeartRate(exercise.actual_avg_heart_rate?.toString() || "");
    }
  }, [open, exercise]);

  const handleSave = async () => {
    if (!exercise) return;

    // Validate RPE if provided
    if (rpe.trim()) {
      const rpeNumber = Number(rpe);
      if (isNaN(rpeNumber) || !Number.isInteger(rpeNumber) || rpeNumber < 1 || rpeNumber > 10) {
        toast({
          title: "RPE invalide",
          description: "Le RPE doit être un chiffre rond entre 1 et 10",
          variant: "destructive",
        });
        return;
      }
    }

    // Validate cardio fields if provided
    if (actualDistance.trim()) {
      const distance = Number(actualDistance);
      if (isNaN(distance) || distance < 0) {
        toast({
          title: "Distance invalide",
          description: "La distance doit être un nombre positif",
          variant: "destructive",
        });
        return;
      }
    }

    if (actualDuration.trim()) {
      const duration = Number(actualDuration);
      if (isNaN(duration) || duration < 0) {
        toast({
          title: "Durée invalide",
          description: "La durée doit être un nombre positif",
          variant: "destructive",
        });
        return;
      }
    }

    if (actualHeartRate.trim()) {
      const hr = Number(actualHeartRate);
      if (isNaN(hr) || hr < 30 || hr > 250) {
        toast({
          title: "FC invalide",
          description: "La fréquence cardiaque doit être entre 30 et 250 bpm",
          variant: "destructive",
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const updateData: Record<string, any> = {
        sportif_rpe: rpe.trim() ? parseInt(rpe) : null,
        sportif_comment: comment.trim() || null,
        sportif_feedback_at: new Date().toISOString(),
      };

      // Add cardio fields if this is a cardio exercise
      if (isCardio) {
        updateData.actual_distance_km = actualDistance.trim() ? parseFloat(actualDistance) : null;
        updateData.actual_duration_minutes = actualDuration.trim() ? parseFloat(actualDuration) : null;
        updateData.actual_pace_min_per_km = actualPace.trim() || null;
        updateData.actual_avg_heart_rate = actualHeartRate.trim() ? parseInt(actualHeartRate) : null;
      }

      const { error } = await supabase
        .from("session_exercises")
        .update(updateData)
        .eq("id", exercise.id);

      if (error) throw error;

      toast({
        title: "Modifié !",
        description: "Ton retour a été mis à jour",
      });

      onOpenChange(false);
      onSaved();
    } catch (error) {
      console.error("Erreur lors de la modification:", error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier le retour",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le retour</DialogTitle>
          <DialogDescription>
            {exercise?.exercice ? `Modifier ton retour pour ${exercise.exercice}` : "Modifier ton retour"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* RPE */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="edit-exercise-rpe">RPE ressenti (1-10)</Label>
              <RPEExplanationDialog isCardio={isCardio} />
            </div>
            <Input
              id="edit-exercise-rpe"
              type="number"
              min="1"
              max="10"
              placeholder="Ex: 8"
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
            />
          </div>

          {/* Cardio-specific fields */}
          {isCardio && (
            <>
              <div className="space-y-2">
                <Label htmlFor="edit-distance">Distance réelle (km)</Label>
                <Input
                  id="edit-distance"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 10.5"
                  value={actualDistance}
                  onChange={(e) => setActualDistance(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-duration">Durée réelle (minutes)</Label>
                <Input
                  id="edit-duration"
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="Ex: 45"
                  value={actualDuration}
                  onChange={(e) => setActualDuration(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-pace">Allure moyenne (min:sec/km)</Label>
                <Input
                  id="edit-pace"
                  type="text"
                  placeholder="Ex: 5:30"
                  value={actualPace}
                  onChange={(e) => setActualPace(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Format: minutes:secondes par kilomètre
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-hr">FC moyenne (bpm)</Label>
                <Input
                  id="edit-hr"
                  type="number"
                  min="30"
                  max="250"
                  placeholder="Ex: 145"
                  value={actualHeartRate}
                  onChange={(e) => setActualHeartRate(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="edit-exercise-comment">Commentaires</Label>
            <Textarea
              id="edit-exercise-comment"
              placeholder="Comment t'es-tu senti pendant l'exercice ?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
