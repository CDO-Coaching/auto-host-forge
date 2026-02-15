import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, CalendarIcon, Footprints, Bike, Waves } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfDay, isAfter } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface CustomSession {
  id: string;
  session_name: string;
  description: string | null;
  duration_minutes: number | null;
  completed_at: string | null;
  scheduled_date: string | null;
}

interface CustomSessionDialogProps {
  onSessionCreated?: () => void;
  editSession?: CustomSession | null;
  onClose?: () => void;
  /** When provided, skip the planning flow and directly validate (complete) a planned session */
  validateSession?: CustomSession | null;
}

export function CustomSessionDialog({ onSessionCreated, editSession, onClose, validateSession }: CustomSessionDialogProps) {
  const [open, setOpen] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [cardioType, setCardioType] = useState<string>("");
  const [distanceKm, setDistanceKm] = useState("");
  const [avgPace, setAvgPace] = useState("");
  const [avgHeartRate, setAvgHeartRate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // "plan" = planning only, "validate" = completing now
  const [mode, setMode] = useState<"plan" | "validate">("plan");
  // Show confirmation step when date is today or past
  const [showValidatePrompt, setShowValidatePrompt] = useState(false);

  // Sync open state when editSession changes
  useEffect(() => {
    if (editSession) {
      setOpen(true);
      setSessionName(editSession.session_name);
      setDescription(editSession.description || "");
      setDuration(editSession.duration_minutes?.toString() || "");
      setSelectedDate(editSession.scheduled_date ? new Date(editSession.scheduled_date) : editSession.completed_at ? new Date(editSession.completed_at) : new Date());
      setMode(editSession.completed_at ? "validate" : "plan");
      setShowValidatePrompt(false);
    }
  }, [editSession]);

  // Handle validate mode (completing a planned session)
  useEffect(() => {
    if (validateSession) {
      setOpen(true);
      setSessionName(validateSession.session_name);
      setDescription(validateSession.description || "");
      setDuration("");
      setSelectedDate(new Date());
      setMode("validate");
      setShowValidatePrompt(false);
    }
  }, [validateSession]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      resetForm();
      onClose?.();
    }
  };

  const resetForm = () => {
    setSessionName("");
    setDescription("");
    setDuration("");
    setSelectedDate(new Date());
    setCardioType("");
    setDistanceKm("");
    setAvgPace("");
    setAvgHeartRate("");
    setMode("plan");
    setShowValidatePrompt(false);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);

    // If date is today or in the past, ask if they want to validate now
    const today = startOfDay(new Date());
    const selected = startOfDay(date);
    if (!isAfter(selected, today) && !editSession && !validateSession) {
      setShowValidatePrompt(true);
    } else {
      setShowValidatePrompt(false);
      setMode("plan");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sessionName.trim()) {
      toast.error("Veuillez entrer un nom de séance");
      return;
    }

    const isCompleting = mode === "validate";

    if (isCompleting) {
      const durationValue = parseInt(duration);
      if (isNaN(durationValue) || durationValue <= 0 || durationValue > 600) {
        toast.error("Veuillez entrer une durée valide (entre 1 et 600 minutes)");
        return;
      }
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utilisateur non connecté");

      if (validateSession) {
        // Completing a planned session
        const { error } = await (supabase.from("custom_sessions") as any)
          .update({
            duration_minutes: parseInt(duration),
            completed_at: new Date().toISOString(),
            description: description.trim() || null,
            distance_km: distanceKm ? parseFloat(distanceKm) : null,
            avg_pace: avgPace.trim() || null,
            avg_heart_rate: avgHeartRate ? parseInt(avgHeartRate) : null,
          })
          .eq("id", validateSession.id);

        if (error) throw error;
        toast.success("Séance perso validée ! 💪");
      } else if (editSession) {
        // Update existing session
        const updateData: any = {
          session_name: sessionName.trim(),
          description: description.trim() || null,
          scheduled_date: format(selectedDate, "yyyy-MM-dd"),
        };
        if (isCompleting) {
          updateData.duration_minutes = parseInt(duration);
          updateData.completed_at = new Date().toISOString();
        }

        const { error } = await (supabase.from("custom_sessions") as any)
          .update(updateData)
          .eq("id", editSession.id);

        if (error) throw error;
        toast.success("Séance perso modifiée !");
      } else {
        // Create new session
        const insertData: any = {
          user_id: user.id,
          session_name: sessionName.trim(),
          description: description.trim() || null,
          scheduled_date: format(selectedDate, "yyyy-MM-dd"),
          cardio_type: cardioType || null,
          distance_km: distanceKm ? parseFloat(distanceKm) : null,
          avg_pace: avgPace.trim() || null,
          avg_heart_rate: avgHeartRate ? parseInt(avgHeartRate) : null,
        };

        if (isCompleting) {
          insertData.duration_minutes = parseInt(duration);
          insertData.completed_at = new Date().toISOString();
        }

        const { error } = await (supabase.from("custom_sessions") as any)
          .insert(insertData);

        if (error) throw error;
        toast.success(isCompleting ? "Séance perso enregistrée !" : "Séance perso planifiée ! 📅");
      }

      resetForm();
      setOpen(false);
      onSessionCreated?.();
    } catch (error) {
      console.error("Erreur lors de l'enregistrement:", error);
      toast.error("Erreur lors de l'enregistrement de la séance");
    } finally {
      setSubmitting(false);
    }
  };

  const isEditing = !!editSession;
  const isValidating = !!validateSession;
  const isCompleting = mode === "validate";

  const dialogTitle = isValidating
    ? "Valider la séance perso"
    : isEditing
      ? "Modifier la séance perso"
      : isCompleting
        ? "Enregistrer une séance perso"
        : "Planifier une séance perso";

  const dialogDescription = isValidating
    ? `Valide ta séance "${validateSession?.session_name}" en renseignant la durée`
    : isEditing
      ? "Modifie les informations de ta séance personnelle"
      : isCompleting
        ? "Enregistre une séance que tu viens de réaliser"
        : "Planifie une séance perso pour plus tard dans la semaine";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isEditing && !isValidating && (
        <DialogTrigger asChild>
          <Button className="gap-2 w-full sm:w-auto text-sm sm:text-base">
            <Plus className="h-4 w-4" />
            Ajouter une séance perso
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto mx-4">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isValidating && (
            <div className="space-y-2">
              <Label htmlFor="session-name">Nom de la séance *</Label>
              <Input
                id="session-name"
                placeholder="Ex: Course à pied, Natation, Yoga..."
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                maxLength={100}
                required
              />
            </div>
          )}

          {!isValidating && (
            <div className="space-y-2">
              <Label>Date de la séance *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "EEEE d MMMM yyyy", { locale: fr }) : "Choisir une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    initialFocus
                    locale={fr}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {!isValidating && (
            <div className="space-y-2">
              <Label>Type de séance</Label>
              <Select value={cardioType} onValueChange={(v) => setCardioType(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Séance libre (aucun type)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Séance libre</SelectItem>
                  <SelectItem value="course">
                    <span className="flex items-center gap-2"><Footprints className="h-4 w-4" /> Course à pied</span>
                  </SelectItem>
                  <SelectItem value="velo">
                    <span className="flex items-center gap-2"><Bike className="h-4 w-4" /> Vélo</span>
                  </SelectItem>
                  <SelectItem value="natation">
                    <span className="flex items-center gap-2"><Waves className="h-4 w-4" /> Natation</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {cardioType && cardioType !== "none" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="distance">Distance (km)</Label>
                  <Input
                    id="distance"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    placeholder="Ex: 10"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value)}
                    min="0"
                    max="500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-duration-cardio">Durée (min)</Label>
                  <Input
                    id="custom-duration-cardio"
                    type="number"
                    inputMode="numeric"
                    placeholder="Ex: 45"
                    value={duration}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setDuration(val);
                    }}
                    min="1"
                    max="600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="avg-pace">Allure moy. (min:sec/km)</Label>
                  <Input
                    id="avg-pace"
                    type="text"
                    placeholder="Ex: 5:30"
                    value={avgPace}
                    onChange={(e) => {
                      // Allow only digits and colon
                      const val = e.target.value.replace(/[^0-9:]/g, '');
                      setAvgPace(val);
                    }}
                    maxLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="avg-hr">FC moyenne (bpm)</Label>
                  <Input
                    id="avg-hr"
                    type="number"
                    inputMode="numeric"
                    placeholder="Ex: 155"
                    value={avgHeartRate}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setAvgHeartRate(val);
                    }}
                    min="30"
                    max="250"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Prompt when date is today or past */}
          {showValidatePrompt && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-sm font-medium">Cette date est aujourd'hui ou passée. As-tu déjà fait cette séance ?</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => { setMode("validate"); setShowValidatePrompt(false); }}
                >
                  Oui, valider maintenant
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => { setMode("plan"); setShowValidatePrompt(false); }}
                >
                  Non, juste planifier
                </Button>
              </div>
            </div>
          )}

          {/* Duration field: only show when completing */}
          {isCompleting && (
            <div className="space-y-2">
              <Label htmlFor="duration">Durée (minutes) *</Label>
              <Input
                id="duration"
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Ex: 45"
                value={duration}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setDuration(val);
                }}
                min="1"
                max="600"
                step="1"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description (optionnel)</Label>
            <Textarea
              id="description"
              placeholder="Décrivez brièvement votre séance..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? "Enregistrement..."
                : isValidating
                  ? "Valider ✅"
                  : isEditing
                    ? "Modifier"
                    : isCompleting
                      ? "Enregistrer"
                      : "Planifier 📅"
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
