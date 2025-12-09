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
  exerciseType?: "cardio" | "renfo" | "recup";
  isRpeRequired?: boolean;
}

export function ExerciseFeedbackDialog({
  open,
  onOpenChange,
  onValidate,
  onCancel,
  exerciseName,
  exerciseType = "renfo",
  isRpeRequired = false,
}: ExerciseFeedbackDialogProps) {
  const [rpe, setRpe] = useState("");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleValidate = async () => {
    const rpeValue = rpe.trim();

    // Validation du RPE obligatoire
    if (isRpeRequired && !rpeValue) {
      toast({
        title: "RPE obligatoire",
        description: "Merci de remplir un RPE pour valider",
        variant: "destructive",
      });
      return;
    }

    if (rpeValue) {
      const rpeNumber = Number(rpeValue);
      
      // Vérifier si c'est un nombre valide
      if (isNaN(rpeNumber)) {
        toast({
          title: "RPE invalide",
          description: "Le RPE doit être un chiffre entre 1 et 10 (pas de lettres ou caractères spéciaux)",
          variant: "destructive",
        });
        return;
      }

      // Vérifier si c'est un nombre entier (pas de décimales)
      if (!Number.isInteger(rpeNumber)) {
        toast({
          title: "RPE invalide",
          description: "Le RPE doit être un chiffre rond entre 1 et 10 (pas de virgule : 5.5, 7.2, etc.)",
          variant: "destructive",
        });
        return;
      }

      // Vérifier la plage
      if (rpeNumber < 1 || rpeNumber > 10) {
        toast({
          title: "RPE invalide",
          description: "Le RPE doit être un chiffre entre 1 et 10 uniquement",
          variant: "destructive",
        });
        return;
      }
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Exercice terminé</DialogTitle>
          <DialogDescription>
            {exerciseName ? `Comment s'est passé ${exerciseName} ?` : "Comment s'est passé l'exercice ?"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="rpe">
                RPE ressenti (1-10) {isRpeRequired ? <span className="text-destructive">*</span> : <span className="text-muted-foreground text-sm font-normal">(optionnel)</span>}
              </Label>
              <RPEExplanationDialog />
            </div>
            <Input
              id="rpe"
              type="number"
              min="1"
              max="10"
              placeholder="Ex: 8"
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              required={isRpeRequired}
            />
            <p className="text-xs text-muted-foreground">
              {isRpeRequired ? "Obligatoire" : "Optionnel"} - Ressenti de l'effort (1 = très facile, 10 = maximum)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="comment">Commentaires <span className="text-muted-foreground text-sm font-normal">(optionnel)</span></Label>
            <Textarea
              id="comment"
              placeholder="Comment t'es-tu senti pendant l'exercice ?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting} className="w-full sm:w-auto">
            Non effectué
          </Button>
          <Button onClick={handleValidate} disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? "Enregistrement..." : "Valider"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
