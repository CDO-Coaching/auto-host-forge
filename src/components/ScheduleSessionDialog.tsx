import { useState, useEffect } from "react";
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
import { CalendarIcon, X, CalendarPlus } from "lucide-react";

// Construit le lien "Ajouter à Google Agenda" (heure locale, pas de compte requis)
function googleCalendarUrl(title: string, start: Date, durationMin: number, details?: string) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const end = new Date(start.getTime() + durationMin * 60000);
  const params = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${fmt(start)}/${fmt(end)}` });
  if (details) params.set("details", details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

interface ScheduleSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: {
    id: string;
    name: string;
    athlete_custom_name?: string | null;
    scheduled_date?: string | null;
  } | null;
  estimatedMinutes?: number | null;
  onUpdate: () => void;
}

export function ScheduleSessionDialog({
  open,
  onOpenChange,
  session,
  estimatedMinutes,
  onUpdate,
}: ScheduleSessionDialogProps) {
  const [customName, setCustomName] = useState(session?.athlete_custom_name || "");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    session?.scheduled_date ? new Date(session.scheduled_date) : undefined
  );
  const [time, setTime] = useState("18:00");
  const [duration, setDuration] = useState(String(estimatedMinutes || 60));
  const [saving, setSaving] = useState(false);

  // Synchronise les champs à l'ouverture (l'ouverture externe ne passe pas par onOpenChange)
  useEffect(() => {
    if (open && session) {
      setCustomName(session.athlete_custom_name || "");
      setSelectedDate(session.scheduled_date ? new Date(session.scheduled_date) : undefined);
      setTime("18:00");
      setDuration(String(estimatedMinutes || 60));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session?.id, estimatedMinutes]);

  // Reset state when dialog opens with new session
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && session) {
      setCustomName(session.athlete_custom_name || "");
      setSelectedDate(session.scheduled_date ? new Date(session.scheduled_date) : undefined);
      setTime("18:00");
      setDuration(String(estimatedMinutes || 60));
    }
    onOpenChange(isOpen);
  };

  const title = customName.trim() || session?.athlete_custom_name || session?.name || "Séance";

  // Enregistre la date puis ouvre Google Agenda (comme "Programmer ma semaine")
  const handleAddToAgenda = async () => {
    if (!session || !selectedDate) {
      toast.error("Choisis d'abord un jour");
      return;
    }
    const [h, m] = time.split(":").map((n) => parseInt(n, 10));
    const start = new Date(selectedDate);
    start.setHours(isNaN(h) ? 18 : h, isNaN(m) ? 0 : m, 0, 0);
    const durMin = parseInt(duration, 10) || 60;

    setSaving(true);
    try {
      await supabase
        .from("training_sessions")
        .update({
          athlete_custom_name: customName.trim() || null,
          scheduled_date: format(selectedDate, "yyyy-MM-dd"),
        })
        .eq("id", session.id);
      onUpdate();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
    window.open(googleCalendarUrl(title, start, durMin, "Séance ajoutée depuis CDO Coaching"), "_blank", "noopener,noreferrer");
    onOpenChange(false);
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
              <>
                <div className="flex items-center justify-between p-2 bg-primary/10 rounded-md">
                  <span className="text-sm">
                    Programmée le{" "}
                    <strong>{format(selectedDate, "EEEE d MMMM", { locale: fr })}</strong>
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedDate(undefined)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {/* Heure + durée pour l'événement Google Agenda */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="sched-time" className="text-xs">Heure</Label>
                    <Input id="sched-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sched-dur" className="text-xs">Durée (min)</Label>
                    <Input id="sched-dur" type="number" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2">
          <Button onClick={handleAddToAgenda} disabled={saving || !selectedDate} className="w-full gap-2">
            <CalendarPlus className="h-4 w-4" />
            Ajouter à Google Agenda
          </Button>
          <div className="flex gap-2 w-full">
            {session.scheduled_date && (
              <Button variant="outline" onClick={handleRemoveSchedule} disabled={saving} className="flex-1">
                Retirer
              </Button>
            )}
            <Button variant="secondary" onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? "..." : "Enregistrer seulement"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
