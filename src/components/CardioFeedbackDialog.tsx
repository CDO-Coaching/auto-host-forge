import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, CalendarIcon } from "lucide-react";
import { RPEExplanationDialog } from "@/components/RPEExplanationDialog";
import { RPEHistoryChartDialog } from "@/components/RPEHistoryChartDialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface CardioFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onValidate: (data: {
    rpe: string;
    comment: string;
    date: Date;
    actualDistance?: number;
    actualDuration?: number;
    actualPace?: string;
    actualAvgHeartRate?: number;
  }) => void;
  onCancel: () => void;
  exerciseName?: string;
  sessionName?: string;
  sportifId?: string;
}

export function CardioFeedbackDialog({
  open,
  onOpenChange,
  onValidate,
  onCancel,
  exerciseName,
  sessionName,
  sportifId,
}: CardioFeedbackDialogProps) {
  const [rpe, setRpe] = useState("");
  const [comment, setComment] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [actualDistance, setActualDistance] = useState("");
  const [actualDuration, setActualDuration] = useState("");
  const [actualPace, setActualPace] = useState("");
  const [actualAvgHeartRate, setActualAvgHeartRate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastWeekRpe, setLastWeekRpe] = useState<number | null>(null);

  // Fetch last week's RPE for the same session name
  useEffect(() => {
    const fetchLastWeekRpe = async () => {
      if (!open || !sessionName || !sportifId) {
        setLastWeekRpe(null);
        return;
      }

      try {
        // Find sessions with the same name completed by this sportif
        const { data, error } = await supabase
          .from("training_sessions")
          .select("session_rpe, completed_at")
          .eq("sportif_id", sportifId)
          .eq("name", sessionName)
          .not("completed_at", "is", null)
          .not("session_rpe", "is", null)
          .order("completed_at", { ascending: false })
          .limit(1);

        if (error) {
          console.error("Erreur lors de la récupération du RPE précédent:", error);
          return;
        }

        if (data && data.length > 0 && data[0].session_rpe) {
          setLastWeekRpe(data[0].session_rpe);
        } else {
          setLastWeekRpe(null);
        }
      } catch (err) {
        console.error("Erreur:", err);
      }
    };

    fetchLastWeekRpe();
  }, [open, sessionName, sportifId]);

  // Reset date when dialog opens
  useEffect(() => {
    if (open) {
      setDate(new Date());
    }
  }, [open]);

  const handleValidate = () => {
    setIsSubmitting(true);

    const data: any = {
      rpe: rpe.trim(),
      comment: comment.trim(),
      date,
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
    setDate(new Date());
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
          {exerciseName && <DialogDescription>{exerciseName}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date picker */}
          <div className="space-y-2">
            <Label>Date de la séance</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP", { locale: fr }) : "Sélectionner une date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                  className="pointer-events-auto"
                  locale={fr}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="rpe" className="text-sm font-medium">
                RPE (1-10) <span className="text-destructive">*</span>
              </Label>
              <RPEExplanationDialog isCardio />
              <RPEHistoryChartDialog />
            </div>
            <Input
              id="rpe"
              type="number"
              min="1"
              max="10"
              step="1"
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              placeholder={lastWeekRpe ? `Dernier RPE: ${lastWeekRpe}` : "Ex: 8"}
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
                inputMode="numeric"
                pattern="[0-9]*"
                step="1"
                min="1"
                max="600"
                value={actualDuration}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setActualDuration(val);
                }}
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
