import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface CardioFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onValidate: (data: {
    rpe: string;
    comment: string;
    actualDistance?: number;
    actualDuration?: number;
    actualPace?: string;
    actualAvgHeartRate?: number;
  }) => void;
  onCancel: () => void;
  exerciseName?: string;
}

export function CardioFeedbackDialog({
  open,
  onOpenChange,
  onValidate,
  onCancel,
  exerciseName,
}: CardioFeedbackDialogProps) {
  const [rpe, setRpe] = useState("");
  const [comment, setComment] = useState("");
  const [actualDistance, setActualDistance] = useState("");
  const [actualDuration, setActualDuration] = useState("");
  const [actualPace, setActualPace] = useState("");
  const [actualAvgHeartRate, setActualAvgHeartRate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleValidate = () => {
    setIsSubmitting(true);

    const data: any = {
      rpe: rpe.trim(),
      comment: comment.trim(),
    };

    // Ajouter les données optionnelles si elles sont renseignées
    if (actualDistance.trim()) {
      const distanceNum = parseFloat(actualDistance);
      if (!isNaN(distanceNum) && distanceNum > 0) {
        data.actualDistance = distanceNum;
      }
    }

    if (actualDuration.trim()) {
      const durationNum = parseFloat(actualDuration);
      if (!isNaN(durationNum) && durationNum > 0) {
        data.actualDuration = durationNum;
      }
    }

    if (actualPace.trim()) {
      data.actualPace = actualPace.trim();
    }

    if (actualAvgHeartRate.trim()) {
      const hrNum = parseInt(actualAvgHeartRate);
      if (!isNaN(hrNum) && hrNum > 0 && hrNum < 250) {
        data.actualAvgHeartRate = hrNum;
      }
    }

    onValidate(data);
    setIsSubmitting(false);
  };

  const handleCancel = () => {
    setRpe("");
    setComment("");
    setActualDistance("");
    setActualDuration("");
    setActualPace("");
    setActualAvgHeartRate("");
    setIsSubmitting(false);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Retour sur la séance</DialogTitle>
          {exerciseName && <p className="text-sm text-muted-foreground">{exerciseName}</p>}
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="rpe" className="text-sm font-medium">
              RPE (1-10) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="rpe"
              type="number"
              min="1"
              max="10"
              step="1"
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              placeholder="Ex: 8"
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">Obligatoire - Ressenti de l'effort (1 = très facile, 10 = maximum)</p>
          </div>

          <div className="border-t pt-4 space-y-4">
            <p className="text-sm font-medium text-muted-foreground">Données de la séance (optionnel)</p>
            
            <div className="space-y-2">
              <Label htmlFor="distance" className="text-sm">
                Distance parcourue (km)
              </Label>
              <Input
                id="distance"
                type="number"
                step="0.1"
                min="0"
                value={actualDistance}
                onChange={(e) => setActualDistance(e.target.value)}
                placeholder="Ex: 10.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration" className="text-sm">
                Durée de la séance (minutes)
              </Label>
              <Input
                id="duration"
                type="number"
                step="1"
                min="0"
                value={actualDuration}
                onChange={(e) => setActualDuration(e.target.value)}
                placeholder="Ex: 45"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pace" className="text-sm">
                Allure moyenne (min/km)
              </Label>
              <Input
                id="pace"
                type="text"
                value={actualPace}
                onChange={(e) => setActualPace(e.target.value)}
                placeholder="Ex: 5:30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="heartrate" className="text-sm">
                Fréquence cardiaque moyenne (bpm)
              </Label>
              <Input
                id="heartrate"
                type="number"
                min="0"
                max="250"
                step="1"
                value={actualAvgHeartRate}
                onChange={(e) => setActualAvgHeartRate(e.target.value)}
                placeholder="Ex: 155"
              />
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="comment" className="text-sm">
              Commentaire
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ajoute un commentaire sur la séance..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button onClick={handleValidate} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Valider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
