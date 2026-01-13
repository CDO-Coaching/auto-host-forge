import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";

interface ScheduleSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: {
    id: string;
    name: string;
    athlete_custom_name?: string | null;
    scheduled_date?: string | null;
  } | null;
  onUpdate: () => void;
}

export function ScheduleSessionDialog({
  open,
  onOpenChange,
  session,
  onUpdate,
}: ScheduleSessionDialogProps) {
  const [customName, setCustomName] = useState(session?.athlete_custom_name || "");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    session?.scheduled_date ? new Date(session.scheduled_date) : undefined
  );
  const [saving, setSaving] = useState(false);

  // Reset state when dialog opens with new session
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && session) {
      setCustomName(session.athlete_custom_name || "");
      setSelectedDate(session.scheduled_date ? new Date(session.scheduled_date) : undefined);
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    if (!session) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("training_sessions")
        .update({
          athlete_custom_name: customName.trim() || null,
          scheduled_date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : null,
        })
        .eq("id", session.id);

      if (error) throw error;

      toast.success("Séance mise à jour");
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveSchedule = async () => {
    if (!session) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("training_sessions")
        .update({
          scheduled_date: null,
        })
        .eq("id", session.id);

      if (error) throw error;

      toast.success("Programmation retirée");
      setSelectedDate(undefined);
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  if (!session) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Personnaliser la séance</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Renommer la séance */}
          <div className="space-y-2">
            <Label htmlFor="custom-name">Renommer la séance (optionnel)</Label>
            <Input
              id="custom-name"
              placeholder={session.name}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Laisse vide pour garder le nom "{session.name}"
            </p>
          </div>

          {/* Programmer la séance */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Programmer pour un jour
            </Label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={fr}
              className="rounded-md border"
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
            />
            {selectedDate && (
              <div className="flex items-center justify-between p-2 bg-primary/10 rounded-md">
                <span className="text-sm">
                  Programmée le{" "}
                  <strong>{format(selectedDate, "EEEE d MMMM", { locale: fr })}</strong>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDate(undefined)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {session.scheduled_date && (
            <Button
              variant="outline"
              onClick={handleRemoveSchedule}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              Retirer la programmation
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
