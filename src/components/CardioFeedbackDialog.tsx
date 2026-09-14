import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    garminLink?: string;
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
  const [date, setDate] = useState<Date>(new Date());
  const [garminLink, setGarminLink] = useState("");
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
      setGarminLink("");
    }
  }, [open]);

  const handleValidate = () => {
    setIsSubmitting(true);

    const data: any = {
      rpe: rpe.trim(),
      comment: "",
      date,
      garminLink: garminLink.trim(),
    };

    onValidate(data);
    setIsSubmitting(false);
  };

  const handleCancel = () => {
    setRpe("");
    setDate(new Date());
    setGarminLink("");
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
            {/* Tous les chiffres 1-10, comme sur les exercices */}
            <div className="flex items-center gap-2">
              <span className={`text-3xl font-black w-9 text-center tabular-nums shrink-0 ${
                Number(rpe) <= 3 ? "text-green-500" :
                Number(rpe) <= 6 ? "text-yellow-500" :
                Number(rpe) <= 8 ? "text-orange-500" : rpe ? "text-red-500" : "text-muted-foreground"
              }`}>{rpe || "–"}</span>
              <div className="grid grid-cols-5 gap-1 flex-1">
                {[1,2,3,4,5,6,7,8,9,10].map((v) => (
                  <button key={v} type="button" onClick={() => setRpe(String(v))}
                    className={`h-9 rounded-lg text-sm font-bold border transition-colors ${
                      Number(rpe) === v
                        ? (v<=3?"border-green-400 bg-green-400/20 text-green-600":v<=6?"border-yellow-400 bg-yellow-400/20 text-yellow-600":v<=8?"border-orange-400 bg-orange-400/20 text-orange-600":"border-red-400 bg-red-400/20 text-red-600")
                        : "border-border bg-secondary text-foreground"
                    }`}>{v}</button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Obligatoire - Ressenti de l'effort (1 = très facile, 10 = maximum){lastWeekRpe ? ` · Dernier : ${lastWeekRpe}` : ""}
            </p>
          </div>

          {/* Lien Strava — bloc guidé en 2 étapes, mis en avant */}
          <div className="border-t pt-4">
            <div className="rounded-2xl border-2 border-primary/40 bg-primary/[0.07] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔗</span>
                <p className="text-sm font-bold" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
                  Ajoute le lien de ta séance Strava
                </p>
              </div>

              {/* Étape 1 : ouvrir Strava (bouton bien visible) */}
              <div className="flex items-start gap-2.5">
                <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                <div className="flex-1 min-w-0">
                  <a
                    href="https://www.strava.com/athlete/training"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-11 rounded-xl bg-[#FC4C02] text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
                  >
                    Ouvrir mes activités Strava
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>
                  </a>
                  <p className="text-[11px] text-muted-foreground mt-1">Ouvre ton activité et copie le <b>lien de partage</b>.</p>
                </div>
              </div>

              {/* Étape 2 : coller le lien */}
              <div className="flex items-start gap-2.5">
                <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                <div className="flex-1 min-w-0 space-y-1">
                  <Label htmlFor="garmin" className="text-[13px] font-semibold">Colle le lien ici</Label>
                  <Input
                    id="garmin"
                    type="url"
                    inputMode="url"
                    value={garminLink}
                    onChange={(e) => setGarminLink(e.target.value)}
                    placeholder="https://www.strava.com/activities/..."
                    className="h-11"
                  />
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground text-center">Ton coach pourra voir ta séance en détail. <span className="opacity-70">(optionnel mais recommandé)</span></p>
            </div>
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
