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
import { CalendarIcon, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface EditSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  sessionId: string;
  sessionName?: string;
  sessionType?: "renfo" | "cardio" | "recup";
  currentData: {
    completedAt: string | null;
    durationMinutes: number | null;
    sessionRpe: number | null;
    sessionComment: string | null;
  };
}

export function EditSessionDialog({
  open,
  onOpenChange,
  onSaved,
  sessionId,
  sessionName,
  sessionType = "renfo",
  currentData,
}: EditSessionDialogProps) {
  const [date, setDate] = useState<Date>(new Date());
  const [rpe, setRpe] = useState("");
  const [comment, setComment] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Reset fields when dialog opens with current data
  useEffect(() => {
    if (open) {
      setDate(currentData.completedAt ? parseISO(currentData.completedAt) : new Date());
      setRpe(currentData.sessionRpe?.toString() || "");
      setComment(currentData.sessionComment || "");
      setDurationMinutes(currentData.durationMinutes?.toString() || "");
    }
  }, [open, currentData]);

  const isRpeRequired = sessionType !== "recup";

  const handleSave = async () => {
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

    // Validation de la durée obligatoire
    if (!durationMinutes.trim()) {
      toast({
        title: "Durée obligatoire",
        description: "Merci de renseigner la durée de ta séance",
        variant: "destructive",
      });
      return;
    }

    const durationNumber = Number(durationMinutes);
    if (isNaN(durationNumber) || durationNumber < 1) {
      toast({
        title: "Durée invalide",
        description: "La durée doit être d'au moins 1 minute",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("training_sessions")
        .update({
          completed_at: date.toISOString(),
          duration_minutes: Math.round(durationNumber),
          session_rpe: rpe.trim() ? Number(rpe) : null,
          session_comment: comment.trim() || null,
        })
        .eq("id", sessionId);

      if (error) throw error;

      toast({
        title: "Séance modifiée",
        description: "Les informations ont été mises à jour",
      });

      onOpenChange(false);
      onSaved();
    } catch (error) {
      console.error("Erreur modification séance:", error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier la séance",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier la séance</DialogTitle>
          <DialogDescription>
            {sessionName ? `${sessionName}` : "Modifier les informations de ta séance"}
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

          {/* Duration */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="edit-session-duration">
                Durée de la séance (minutes) <span className="text-destructive">*</span>
              </Label>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <Input
              id="edit-session-duration"
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min="1"
              max="600"
              step="1"
              placeholder="Ex: 45"
              value={durationMinutes}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setDurationMinutes(val);
              }}
            />
          </div>

          {/* RPE */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="edit-session-rpe">
                RPE global (1-10){" "}
                {isRpeRequired ? (
                  <span className="text-destructive">*</span>
                ) : (
                  <span className="text-muted-foreground text-sm font-normal">(optionnel)</span>
                )}
              </Label>
              <RPEExplanationDialog isCardio={sessionType === "cardio"} />
            </div>
            <Input
              id="edit-session-rpe"
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
            <Label htmlFor="edit-session-comment">
              Commentaire <span className="text-muted-foreground text-sm font-normal">(optionnel)</span>
            </Label>
            <Textarea
              id="edit-session-comment"
              placeholder="Comment s'est passée la séance ?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="w-full sm:w-auto">
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
