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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface SessionCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onValidate: (data: { date: Date; rpe: number; comment: string }) => Promise<void>;
  onCancel: () => void;
  sessionName?: string;
  sessionType?: "renfo" | "cardio" | "recup";
}

export function SessionCompletionDialog({
  open,
  onOpenChange,
  onValidate,
  onCancel,
  sessionName,
  sessionType = "renfo",
}: SessionCompletionDialogProps) {
  const [date, setDate] = useState<Date>(new Date());
  const [rpe, setRpe] = useState("");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Reset date to today when dialog opens
  useEffect(() => {
    if (open) {
      setDate(new Date());
      setRpe("");
      setComment("");
    }
  }, [open]);

  const isRpeRequired = sessionType !== "recup";

  const handleValidate = async () => {
    // Validation du RPE obligatoire (sauf pour recup)
    if (isRpeRequired && !rpe.trim()) {
      toast({
        title: "RPE obligatoire",
        description: "Merci de remplir un RPE pour valider la séance",
        variant: "destructive",
      });
      return;
    }

    if (rpe.trim()) {
      const rpeNumber = Number(rpe);

      if (isNaN(rpeNumber)) {
        toast({
          title: "RPE invalide",
          description: "Le RPE doit être un chiffre entre 1 et 10",
          variant: "destructive",
        });
        return;
      }

      if (!Number.isInteger(rpeNumber)) {
        toast({
          title: "RPE invalide",
          description: "Le RPE doit être un chiffre rond entre 1 et 10 (pas de virgule)",
          variant: "destructive",
        });
        return;
      }

      if (rpeNumber < 1 || rpeNumber > 10) {
        toast({
          title: "RPE invalide",
          description: "Le RPE doit être entre 1 et 10",
          variant: "destructive",
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onValidate({
        date,
        rpe: rpe.trim() ? Number(rpe) : 0,
        comment: comment.trim(),
      });
    } catch (error) {
      console.error("Erreur validation:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setDate(new Date());
    setRpe("");
    setComment("");
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Valider la séance</DialogTitle>
          <DialogDescription>
            {sessionName ? `${sessionName}` : "Renseigne les informations de ta séance"}
          </DialogDescription>
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

          {/* RPE */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="session-rpe">
                RPE global (1-10){" "}
                {isRpeRequired ? (
                  <span className="text-destructive">*</span>
                ) : (
                  <span className="text-muted-foreground text-sm font-normal">(optionnel)</span>
                )}
              </Label>
              <RPEExplanationDialog />
            </div>
            <Input
              id="session-rpe"
              type="number"
              min="1"
              max="10"
              placeholder="Ex: 7"
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Ressenti global de la séance (1 = très facile, 10 = maximum)
            </p>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="session-comment">
              Commentaire <span className="text-muted-foreground text-sm font-normal">(optionnel)</span>
            </Label>
            <Textarea
              id="session-comment"
              placeholder="Comment s'est passée la séance ?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting} className="w-full sm:w-auto">
            Annuler
          </Button>
          <Button onClick={handleValidate} disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? "Enregistrement..." : "Valider la séance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
