import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { QuickRatingInput } from "./QuickRatingInput";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface FatigueLog {
  id: string;
  date: string;
  fatigue: number;
  courbatures: number;
  sommeil: number;
  stress: number;
  score_total: number;
  has_injury: boolean | null;
  injury_level: number | null;
  injury_location: string | null;
}

interface EditFatigueDialogProps {
  open: boolean;
  onClose: () => void;
  logs: FatigueLog[];
  initialLog?: FatigueLog | null;
}

const questions = [
  {
    id: "fatigue",
    label: "Niveau de fatigue",
    labels: ["Très frais", "Frais", "Légèrement fatigué", "Fatigué", "Très fatigué", "Épuisé", "Exténué"],
  },
  {
    id: "courbatures",
    label: "Niveau de courbatures",
    labels: ["Aucune", "Très légères", "Légères", "Modérées", "Importantes", "Très importantes", "Sévères"],
  },
  {
    id: "sommeil",
    label: "Qualité du sommeil",
    labels: ["Catastrophique", "Très mauvais", "Mauvais", "Moyen", "Bon", "Très bon", "Excellent"],
  },
  {
    id: "stress",
    label: "Niveau de stress",
    labels: ["Très calme", "Calme", "Légèrement tendu", "Modéré", "Élevé", "Très élevé", "Extrême"],
  },
];

const injuryLevelLabels = ["Aucune", "Très légère", "Légère", "Modérée", "Gênante", "Importante", "Très forte"];

export function EditFatigueDialog({ open, onClose, logs, initialLog }: EditFatigueDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedLog, setSelectedLog] = useState<FatigueLog | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({
    fatigue: 4,
    courbatures: 4,
    sommeil: 4,
    stress: 4,
  });
  const [hasInjury, setHasInjury] = useState(false);
  const [injuryLevel, setInjuryLevel] = useState(4);
  const [injuryLocation, setInjuryLocation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { toast } = useToast();

  // Dates disponibles (celles qui ont des entrées)
  const availableDates = logs.map(log => new Date(log.date));

  useEffect(() => {
    if (open) {
      if (initialLog) {
        // Si un log initial est fourni, le sélectionner
        setSelectedDate(new Date(initialLog.date));
        loadLogData(initialLog);
      } else {
        // Sinon, réinitialiser
        setSelectedDate(undefined);
        setSelectedLog(null);
        setAnswers({ fatigue: 4, courbatures: 4, sommeil: 4, stress: 4 });
        setHasInjury(false);
        setInjuryLevel(4);
        setInjuryLocation("");
      }
    }
  }, [open, initialLog]);

  const loadLogData = (log: FatigueLog) => {
    setSelectedLog(log);
    // Pour le sommeil, la valeur stockée est inversée (8 - valeur_slider)
    // Donc pour retrouver la valeur du slider: 8 - valeur_stockée
    setAnswers({
      fatigue: log.fatigue,
      courbatures: log.courbatures,
      sommeil: 8 - log.sommeil, // Inverser pour afficher correctement
      stress: log.stress,
    });
    setHasInjury(log.has_injury || false);
    setInjuryLevel(log.injury_level || 4);
    setInjuryLocation(log.injury_location || "");
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setCalendarOpen(false);
    
    if (date) {
      const dateStr = format(date, "yyyy-MM-dd");
      const foundLog = logs.find(log => log.date === dateStr);
      if (foundLog) {
        loadLogData(foundLog);
      }
    }
  };

  const handleSliderChange = (id: string, value: number[]) => {
    setAnswers({ ...answers, [id]: value[0] });
  };

  const handleSubmit = async () => {
    if (!selectedLog) return;
    
    setIsSubmitting(true);
    try {
      const updateData: any = {
        fatigue: answers.fatigue,
        courbatures: answers.courbatures,
        sommeil: 8 - answers.sommeil, // Inverser pour le stockage
        stress: answers.stress,
        has_injury: hasInjury,
        injury_level: hasInjury ? injuryLevel : null,
        injury_location: hasInjury ? injuryLocation || null : null,
      };

      const { error } = await supabase
        .from("daily_fatigue_log")
        .update(updateData)
        .eq("id", selectedLog.id);

      if (error) throw error;

      toast({
        title: "✅ Modifié !",
        description: `Les données du ${format(new Date(selectedLog.date), "dd/MM/yyyy", { locale: fr })} ont été mises à jour.`,
      });

      onClose();
    } catch (error: any) {
      console.error("Error updating fatigue log:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de modifier les données.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fonction pour vérifier si une date a une entrée
  const hasLogForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return logs.some(log => log.date === dateStr);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[95vh] flex flex-col p-3 sm:p-6 gap-0 overflow-hidden">
        <DialogHeader className="pb-2 sm:pb-3 space-y-0.5">
          <DialogTitle className="text-base sm:text-xl">Modifier une entrée</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Sélectionne une date pour modifier les données
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 flex-1 overflow-y-auto pr-1">
          {/* Sélecteur de date */}
          <div className="space-y-2">
            <Label className="text-xs sm:text-sm font-medium">Date à modifier</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "dd MMMM yyyy", { locale: fr }) : "Choisir une date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  locale={fr}
                  disabled={(date) => !hasLogForDate(date)}
                  modifiers={{
                    hasLog: availableDates,
                  }}
                  modifiersStyles={{
                    hasLog: { fontWeight: "bold", color: "hsl(var(--primary))" },
                  }}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {selectedLog && (
            <>
              {/* Questions de fatigue */}
              {questions.map((question) => (
                <div key={question.id} className="space-y-1 sm:space-y-2">
                  <Label className="text-xs sm:text-base font-medium block">{question.label}</Label>
                  
                  <QuickRatingInput
                    value={answers[question.id]}
                    onChange={(v) => handleSliderChange(question.id, [v])}
                    min={1}
                    max={7}
                    labels={question.labels}
                  />
                </div>
              ))}

              {/* Section douleur */}
              <div className="pt-2 sm:pt-3 border-t space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs sm:text-sm font-medium">
                    As-tu une douleur / blessure ?
                  </Label>
                  <Switch
                    checked={hasInjury}
                    onCheckedChange={setHasInjury}
                  />
                </div>

                {hasInjury && (
                  <div className="space-y-3 bg-destructive/5 rounded-lg p-3">
                    <div className="space-y-1 sm:space-y-2">
                      <Label className="text-xs sm:text-base font-medium">Niveau de douleur</Label>
                      
                      <Slider
                        value={[injuryLevel]}
                        onValueChange={(value) => setInjuryLevel(value[0])}
                        min={1}
                        max={7}
                        step={1}
                        className="w-full"
                      />
                      
                      <div className="flex justify-between text-[9px] sm:text-xs text-muted-foreground px-0.5">
                        <span>1</span>
                        <span>2</span>
                        <span>3</span>
                        <span>4</span>
                        <span>5</span>
                        <span>6</span>
                        <span>7</span>
                      </div>
                      
                      <div className="text-center">
                        <span className="inline-block px-2 py-0.5 sm:px-4 sm:py-1.5 bg-destructive/10 text-destructive rounded text-[10px] sm:text-sm font-medium">
                          {injuryLevelLabels[injuryLevel - 1]}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="injuryLocation" className="text-xs sm:text-sm font-medium">
                        Localisation
                      </Label>
                      <Input
                        id="injuryLocation"
                        placeholder="Ex: genou droit, épaule..."
                        value={injuryLocation}
                        onChange={(e) => setInjuryLocation(e.target.value)}
                        className="text-sm h-9"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 pt-3 mt-2 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 text-xs sm:text-sm h-9 sm:h-10"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedLog || isSubmitting}
            className="flex-1 text-xs sm:text-sm h-9 sm:h-10"
          >
            {isSubmitting ? "Modification..." : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}