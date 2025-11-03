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
import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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

  const rpeExplanationCardio = `Le RPE sert à estimer ton intensité globale d'effort pendant l'exercice :

RPE 2-3 : très facile — respiration tranquille, tu peux parler sans problème.

RPE 4-5 : modéré — tu sens le travail, mais tu pourrais continuer longtemps.

RPE 6-7 : soutenu — la respiration s'accélère, parler devient difficile.

RPE 8-9 : intense — effort fort, tu tiens seulement quelques minutes.

RPE 10 : maximal — sprint ou effort à fond, tu ne peux pas maintenir plus de quelques secondes.

👉 C'est utile pour gérer les zones d'intensité, adapter les séances sans matériel de mesure, et éviter le surentraînement.`;

  const rpeExplanationRenfo = `Le RPE (Rate of Perceived Exertion) sert à évaluer la difficulté ressentie sur une série.

RPE 6 : facile — tu aurais pu faire 4 reps de plus.

RPE 8 : difficile — il restait 1 à 2 reps possibles.

RPE 9 : très dur — quasiment à l'échec.

RPE 10 : échec total, tu ne pouvais pas faire plus.

👉 Ça aide à choisir les bonnes charges, éviter la fatigue excessive et mieux gérer la progression.`;

  const rpeExplanation = exerciseType === "cardio" ? rpeExplanationCardio : rpeExplanationRenfo;

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
              <Label htmlFor="rpe">RPE ressenti (0-10)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                    <Info className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="max-w-sm whitespace-pre-line text-sm">
                  <p>{rpeExplanation}</p>
                </PopoverContent>
              </Popover>
            </div>
            <Input
              id="rpe"
              type="number"
              min="0"
              max="10"
              placeholder="Ex: 8"
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comment">Commentaires</Label>
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
