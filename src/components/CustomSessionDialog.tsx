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
import { validateSessionMetrics } from "@/lib/sessionMetrics";
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

export interface StravaSessionData {
  sessionName: string;
  cardioType: string;
  duration: string;
  distanceKm: string;
  avgPace: string;
  avgHeartRate: string;
  date: Date;
  // New Strava fields
  maxHeartRate?: number | null;
  cadence?: number | null;
  calories?: number | null;
  elevationGain?: number | null;
  heartRateZones?: { zone: number; min: number; max: number; time_seconds: number }[] | null;
  stravaActivityId?: number | null;
}

interface CustomSessionDialogProps {
  onSessionCreated?: () => void;
  editSession?: CustomSession | null;
  onClose?: () => void;
  /** When provided, skip the planning flow and directly validate (complete) a planned session */
  validateSession?: CustomSession | null;
  /** When provided, opens the dialog pre-filled with Strava activity data */
  stravaData?: StravaSessionData | null;
  /** When true, forces the dialog open (for external trigger buttons) */
  forceOpen?: boolean;
  /** Called when the dialog closes after a forceOpen */
  onForceClose?: () => void;
  /** When true, hides the internal trigger button (caller provides its own trigger) */
  hideTrigger?: boolean;
}

export function CustomSessionDialog({ onSessionCreated, editSession, onClose, validateSession, stravaData, forceOpen, onForceClose, hideTrigger }: CustomSessionDialogProps) {
  const [open, setOpen] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [cardioType, setCardioType] = useState<string>("");
  const [distanceKm, setDistanceKm] = useState("");
  const [avgPace, setAvgPace] = useState("");
  const [avgHeartRate, setAvgHeartRate] = useState("");
  const [sessionRpe, setSessionRpe] = useState<string>("");
  const [maxHeartRate, setMaxHeartRate] = useState<number | null>(null);
  const [cadence, setCadence] = useState<number | null>(null);
  const [sessionCalories, setSessionCalories] = useState<number | null>(null);
  const [elevationGain, setElevationGain] = useState<number | null>(null);
  const [heartRateZones, setHeartRateZones] = useState<any[] | null>(null);
  const [stravaActivityId, setStravaActivityId] = useState<number | null>(null);
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
      setSessionRpe((editSession as any).session_rpe?.toString() || "");
      setCardioType((editSession as any).cardio_type || "");
      {
        const ctype = (editSession as any).cardio_type || "";
        const distKm = (editSession as any).distance_km;
        // La natation s'affiche en mètres (distance_km stocke des km)
        setDistanceKm(distKm != null ? (ctype === "natation" ? Math.round(distKm * 1000).toString() : distKm.toString()) : "");
      }
      setAvgPace((editSession as any).avg_pace || "");
      setAvgHeartRate((editSession as any).avg_heart_rate?.toString() || "");
      setSelectedDate(editSession.scheduled_date ? new Date(editSession.scheduled_date) : editSession.completed_at ? new Date(editSession.completed_at) : new Date());
      setMode(editSession.completed_at ? "validate" : "plan");
      setShowValidatePrompt(false);
      setMaxHeartRate((editSession as any).max_heart_rate ?? null);
      setCadence((editSession as any).cadence ?? null);
      setSessionCalories((editSession as any).calories ?? null);
      setElevationGain((editSession as any).elevation_gain ?? null);
      setHeartRateZones((editSession as any).heart_rate_zones ?? null);
      setStravaActivityId((editSession as any).strava_activity_id ?? null);
    }
  }, [editSession]);

  // Sync open state when forceOpen changes (external trigger)
  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      // Reset to blank new session
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
    }
  }, [forceOpen]);

  // Pré-remplissage depuis Strava
  useEffect(() => {
    if (stravaData) {
      setOpen(true);
      setSessionName(stravaData.sessionName);
      setCardioType(stravaData.cardioType);
      setDuration(stravaData.duration);
      // La natation s'affiche en mètres
      {
        const n = parseFloat(String(stravaData.distanceKm).replace(",", "."));
        setDistanceKm(stravaData.cardioType === "natation" && !isNaN(n) ? Math.round(n * 1000).toString() : stravaData.distanceKm);
      }
      setAvgPace(stravaData.avgPace);
      setAvgHeartRate(stravaData.avgHeartRate);
      setSessionRpe("");
      setSelectedDate(stravaData.date);
      setMode("validate");
      setShowValidatePrompt(false);
      setMaxHeartRate(stravaData.maxHeartRate ?? null);
      setCadence(stravaData.cadence ?? null);
      setSessionCalories(stravaData.calories ?? null);
      setElevationGain(stravaData.elevationGain ?? null);
      setHeartRateZones(stravaData.heartRateZones ?? null);
      setStravaActivityId(stravaData.stravaActivityId ?? null);
    }
  }, [stravaData]);

  // Handle validate mode (completing a planned session)
  useEffect(() => {
    if (validateSession) {
      setOpen(true);
      setSessionName(validateSession.session_name);
      setDescription(validateSession.description || "");
      setDuration("");
      setSessionRpe("");
      setSelectedDate(new Date());
      setCardioType((validateSession as any).cardio_type || "");
      setMode("validate");
      setShowValidatePrompt(false);
    }
  }, [validateSession]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      resetForm();
      onClose?.();
      onForceClose?.();
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
    setSessionRpe("");
    setMaxHeartRate(null);
    setCadence(null);
    setSessionCalories(null);
    setElevationGain(null);
    setHeartRateZones(null);
    setStravaActivityId(null);
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

    // Convertit la valeur saisie en km stockés (natation = saisie en mètres)
    const toStoredKm = (): number | null => {
      if (!distanceKm) return null;
      const n = parseFloat(distanceKm.replace(",", "."));
      if (isNaN(n)) return null;
      return cardioType === "natation" ? n / 1000 : n;
    };

    // Garde-fou anti-saisie aberrante (ex: 889 km au lieu de 8,89)
    const distanceValue = toStoredKm();
    const metricsError = validateSessionMetrics({ distanceKm: distanceValue });
    if (metricsError) {
      toast.error(metricsError);
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utilisateur non connecté");

      // Build completed_at from the selected date (preserves correct date even for past sessions)
      const completedAtForDate = (dateStr: string) => {
        const isToday = format(new Date(), "yyyy-MM-dd") === dateStr;
        return isToday ? new Date().toISOString() : `${dateStr}T12:00:00.000Z`;
      };

      if (validateSession) {
        // Completing a planned session — use scheduled_date as the completion date
        const dateStr = validateSession.scheduled_date ?? format(new Date(), "yyyy-MM-dd");
        const updatePayload: any = {
          duration_minutes: parseInt(duration),
          completed_at: completedAtForDate(dateStr),
          description: description.trim() || null,
          distance_km: toStoredKm(),
          avg_pace: avgPace.trim() || null,
          avg_heart_rate: avgHeartRate ? parseInt(avgHeartRate) : null,
          session_rpe: sessionRpe ? parseInt(sessionRpe) : null,
          max_heart_rate: maxHeartRate ?? null,
          cadence: cadence ?? null,
          calories: sessionCalories ?? null,
          elevation_gain: elevationGain ?? null,
          heart_rate_zones: heartRateZones ?? null,
          strava_activity_id: stravaActivityId ?? null,
        };
        let { error } = await (supabase.from("custom_sessions") as any).update(updatePayload).eq("id", validateSession.id);
        if (error && (error.message?.includes("column") || error.code === "42703" || error.code === "PGRST204")) {
          const { max_heart_rate, cadence, calories, elevation_gain, heart_rate_zones, strava_activity_id, ...safePayload } = updatePayload;
          const retry = await (supabase.from("custom_sessions") as any).update(safePayload).eq("id", validateSession.id);
          error = retry.error;
        }
        if (error) throw error;
        toast.success("Séance perso validée ! 💪");
      } else if (editSession) {
        // Update existing session
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const updateData: any = {
          session_name: sessionName.trim(),
          description: description.trim() || null,
          scheduled_date: dateStr,
          session_rpe: sessionRpe ? parseInt(sessionRpe) : null,
          max_heart_rate: maxHeartRate ?? null,
          cadence: cadence ?? null,
          calories: sessionCalories ?? null,
          elevation_gain: elevationGain ?? null,
          heart_rate_zones: heartRateZones ?? null,
          strava_activity_id: stravaActivityId ?? null,
        };
        if (isCompleting) {
          updateData.duration_minutes = parseInt(duration);
          updateData.completed_at = completedAtForDate(dateStr);
        }

        let { error } = await (supabase.from("custom_sessions") as any).update(updateData).eq("id", editSession.id);
        if (error && (error.message?.includes("column") || error.code === "42703" || error.code === "PGRST204")) {
          const { max_heart_rate, cadence, calories, elevation_gain, heart_rate_zones, strava_activity_id, ...safeData } = updateData;
          const retry = await (supabase.from("custom_sessions") as any).update(safeData).eq("id", editSession.id);
          error = retry.error;
        }
        if (error) throw error;
        toast.success("Séance perso modifiée !");
      } else {
        // Create new session
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const insertData: any = {
          user_id: user.id,
          session_name: sessionName.trim(),
          description: description.trim() || null,
          scheduled_date: dateStr,
          cardio_type: cardioType || null,
        };

        if (isCompleting) {
          insertData.duration_minutes = parseInt(duration);
          insertData.completed_at = completedAtForDate(dateStr);
          insertData.distance_km = toStoredKm();
          insertData.avg_pace = avgPace.trim() || null;
          insertData.avg_heart_rate = avgHeartRate ? parseInt(avgHeartRate) : null;
          insertData.session_rpe = sessionRpe ? parseInt(sessionRpe) : null;
          insertData.max_heart_rate = maxHeartRate ?? null;
          insertData.cadence = cadence ?? null;
          insertData.calories = sessionCalories ?? null;
          insertData.elevation_gain = elevationGain ?? null;
          insertData.heart_rate_zones = heartRateZones ?? null;
          insertData.strava_activity_id = stravaActivityId ?? null;
        }

        let { error } = await (supabase.from("custom_sessions") as any).insert(insertData);

        // Si erreur de colonne manquante (SQL pas encore lancé), retry sans les nouvelles colonnes
        if (error && (error.message?.includes("column") || error.code === "42703" || error.code === "PGRST204")) {
          const { max_heart_rate, cadence, calories, elevation_gain, heart_rate_zones, strava_activity_id, ...safeData } = insertData;
          const retry = await (supabase.from("custom_sessions") as any).insert(safeData);
          error = retry.error;
        }

        if (error) throw error;
        toast.success(isCompleting ? "Séance perso enregistrée !" : "Séance perso planifiée ! 📅");
      }

      resetForm();
      setOpen(false);
      onSessionCreated?.();
    } catch (error: any) {
      console.error("Erreur lors de l'enregistrement:", error);
      const msg = error?.message || error?.details || JSON.stringify(error);
      toast.error(`Erreur : ${msg}`);
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
      {!isEditing && !isValidating && !hideTrigger && (
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

          {/* Cardio metrics: only show when completing/validating */}
          {(isCompleting || isValidating) && (
            <div className="space-y-4">
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

              {/* RPE — grande grille 1-10 */}
              <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                <div>
                  <Label className="text-base font-semibold">Comment tu as ressenti l'effort ? *</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">1 = très facile · 10 = effort maximal</p>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSessionRpe(String(n))}
                      className={`h-12 rounded-xl font-bold text-lg border-2 transition-all ${
                        sessionRpe === String(n)
                          ? n <= 3 ? "bg-green-500 border-green-500 text-white shadow-lg scale-105"
                            : n <= 6 ? "bg-yellow-400 border-yellow-400 text-black shadow-lg scale-105"
                            : n <= 8 ? "bg-orange-500 border-orange-500 text-white shadow-lg scale-105"
                            : "bg-red-500 border-red-500 text-white shadow-lg scale-105"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {sessionRpe && (
                  <p className={`text-center font-semibold text-sm ${
                    Number(sessionRpe) <= 3 ? "text-green-500"
                    : Number(sessionRpe) <= 6 ? "text-yellow-500"
                    : Number(sessionRpe) <= 8 ? "text-orange-500"
                    : "text-red-500"
                  }`}>
                    {Number(sessionRpe) <= 3 ? "🟢 Facile — Effort léger, tu aurais pu continuer longtemps"
                     : Number(sessionRpe) <= 6 ? "🟡 Modéré — Bon rythme, conversation possible"
                     : Number(sessionRpe) <= 8 ? "🟠 Difficile — Effort soutenu, essoufflement marqué"
                     : "🔴 Très difficile — Effort maximal ou quasi-maximal"}
                  </p>
                )}
              </div>

              {cardioType && cardioType !== "none" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="distance">
                      {cardioType === "natation" ? "Distance (m)" : "Distance (km)"}
                    </Label>
                    <Input
                      id="distance"
                      type="text"
                      inputMode="decimal"
                      placeholder={cardioType === "natation" ? "Ex: 1500" : "Ex: 10.5"}
                      value={distanceKm}
                      onChange={(e) => setDistanceKm(e.target.value.replace(",", "."))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="avg-pace">
                      {cardioType === "velo" ? "Vitesse moy. (km/h)" : cardioType === "natation" ? "Allure (min:sec/100m)" : "Allure moy. (min:sec/km)"}
                    </Label>
                    <Input
                      id="avg-pace"
                      type="text"
                      inputMode={cardioType === "velo" ? "decimal" : "text"}
                      placeholder={cardioType === "velo" ? "Ex: 28.5" : cardioType === "natation" ? "Ex: 2:10" : "Ex: 5:30"}
                      value={avgPace}
                      onChange={(e) => {
                        if (cardioType === "velo") {
                          setAvgPace(e.target.value.replace(",", "."));
                        } else {
                          const val = e.target.value.replace(/[^0-9:]/g, '');
                          setAvgPace(val);
                        }
                      }}
                      maxLength={cardioType === "velo" ? 6 : 6}
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
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Résumé de ta séance <span className="text-muted-foreground font-normal text-xs">(optionnel)</span></Label>
            <Textarea
              id="description"
              placeholder="Comment s'est passée ta séance ? Points forts, difficultés, sensations..."
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
