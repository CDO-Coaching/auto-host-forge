import { useState } from "react";
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

interface ExerciseFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onValidate: (rpe: string, comment: string) => Promise<void>;
  onCancel: () => void;
  exerciseName?: string;
  exerciseType?: "cardio" | "renfo";
}

export function ExerciseFeedbackDialog({
  open,
  onOpenChange,
  onValidate,
  onCancel,
  exerciseName,
  exerciseType = "renfo",
}: ExerciseFeedbackDialogProps) {
  const [rpe, setRpe] = useState("");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleValidate = async () => {
    const rpeValue = rpe.trim();

    if (rpeValue && (isNaN(Number(rpeValue)) || Number(rpeValue) < 0 || Number(rpeValue) > 10)) {
      toast({
        title: "RPE invalide",
        description: "Le RPE doit être un nombre entre 0 et 10",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onValidate(rpeValue, comment);
      setRpe("");
      setComment("");
    } catch (error) {
      console.error("Erreur validation:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setRpe("");
    setComment("");
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] mx-3 max-w-[calc(100vw-24px)]">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Exercice terminé</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {exerciseName ? `Comment s'est passé ${exerciseName} ?` : "Comment s'est passé l'exercice ?"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="rpe" className="text-xs sm:text-sm">RPE ressenti (0-10) <span className="text-muted-foreground text-xs font-normal">(optionnel)</span></Label>
              <RPEExplanationDialog />
            </div>
            <Input
              id="rpe"
              type="number"
              min="0"
              max="10"
              placeholder="Ex: 8"
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              className="text-sm sm:text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comment" className="text-xs sm:text-sm">Commentaires <span className="text-muted-foreground text-xs font-normal">(optionnel)</span></Label>
            <Textarea
              id="comment"
              placeholder="Comment t'es-tu senti pendant l'exercice ?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="text-xs sm:text-sm"
            />
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting} className="w-full sm:w-auto text-xs sm:text-sm">
            Non effectué
          </Button>
          <Button onClick={handleValidate} disabled={isSubmitting} className="w-full sm:w-auto text-xs sm:text-sm">
            {isSubmitting ? "Enregistrement..." : "Valider"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
