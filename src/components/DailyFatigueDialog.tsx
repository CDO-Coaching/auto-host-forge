import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Droplet } from "lucide-react";

interface DailyFatigueDialogProps {
  open: boolean;
  onClose: () => void;
  includeInjuryQuestions?: boolean;
  isFemale?: boolean;
}

const questions = [
  {
    id: "fatigue",
    label: "Niveau de fatigue",
    labels: ["Aucune", "Minime", "Légère", "Modérée", "Importante", "Forte", "Extrême"],
  },
  {
    id: "courbatures",
    label: "Niveau de courbatures",
    labels: ["Aucune", "Très légères", "Légères", "Modérées", "Marquées", "Fortes", "Intenses"],
  },
  {
    id: "sommeil",
    label: "Qualité du sommeil",
    labels: ["Très mauvais", "Mauvais", "Agité", "Moyen", "Bon", "Très bon", "Excellent"],
  },
  {
    id: "stress",
    label: "Niveau de stress",
    labels: ["Zen", "Calme", "Détendu", "Neutre", "Tendu", "Stressé", "Très stressé"],
  },
];

const injuryLevelLabels = ["Aucune", "Très légère", "Légère", "Modérée", "Gênante", "Importante", "Très forte"];

export function DailyFatigueDialog({ open, onClose, includeInjuryQuestions = false, isFemale = false }: DailyFatigueDialogProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({
    fatigue: 4,
    courbatures: 4,
    sommeil: 4,
    stress: 4,
  });
  const [hasInjury, setHasInjury] = useState(false);
  const [injuryLevel, setInjuryLevel] = useState(4);
  const [injuryLocation, setInjuryLocation] = useState("");
  const [menstrualPeriodActive, setMenstrualPeriodActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Charger l'état de la période menstruelle et réinitialiser les autres états quand le dialog s'ouvre
  useEffect(() => {
    if (open) {
      setAnswers({
        fatigue: 4,
        courbatures: 4,
        sommeil: 4,
        stress: 4,
      });
      setHasInjury(false);
      setInjuryLevel(4);
      setInjuryLocation("");
      
      // Charger l'état actuel de la période menstruelle
      if (isFemale) {
        loadMenstrualPeriodStatus();
      }
    }
  }, [open, isFemale]);

  const loadMenstrualPeriodStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("user_profiles")
        .select("menstrual_period_active")
        .eq("id", user.id)
        .single();

      if (data) {
        setMenstrualPeriodActive(data.menstrual_period_active || false);
      }
    } catch (error) {
      console.error("Erreur chargement période menstruelle:", error);
    }
  };

  const handleMenstrualPeriodToggle = async (checked: boolean) => {
    setMenstrualPeriodActive(checked);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("user_profiles")
        .update({ menstrual_period_active: checked })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: checked ? "Période de règles activée" : "Période de règles désactivée",
        description: checked 
          ? "Ton coach sera informé de réduire l'intensité." 
          : "Ton coach ne verra plus l'indicateur.",
      });
    } catch (error) {
      console.error("Erreur mise à jour période menstruelle:", error);
      setMenstrualPeriodActive(!checked); // Revert on error
    }
  };

  const handleSliderChange = (id: string, value: number[]) => {
    setAnswers({ ...answers, [id]: value[0] });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const today = new Date().toISOString().split('T')[0];

      const insertData: any = {
        user_id: user.id,
        date: today,
        fatigue: answers.fatigue,
        courbatures: answers.courbatures,
        sommeil: 8 - answers.sommeil, // Inversé : 7/7 = très bonne nuit = 1 point
        stress: answers.stress,
      };

      if (includeInjuryQuestions) {
        insertData.has_injury = hasInjury;
        insertData.injury_level = hasInjury ? injuryLevel : null;
        insertData.injury_location = hasInjury && injuryLocation ? injuryLocation : null;
      }

      const { error } = await supabase
        .from("daily_fatigue_log")
        .insert(insertData);

      if (error) throw error;

      toast({
        title: "✅ Enregistré !",
        description: "Ton suivi de fatigue du jour a été enregistré.",
      });

      onClose();
    } catch (error: any) {
      console.error("Error saving fatigue log:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'enregistrer les données.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleSkip}>
      <DialogContent className="sm:max-w-[500px] max-h-[95vh] flex flex-col p-3 sm:p-6 gap-0 overflow-hidden">
        <DialogHeader className="pb-2 sm:pb-3 space-y-0.5">
          <DialogTitle className="text-base sm:text-xl">Suivi quotidien</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Évalue ton état du jour
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-5 flex-1 overflow-y-auto pr-1">
          {questions.map((question) => (
            <div key={question.id} className="space-y-1 sm:space-y-2">
              <Label className="text-xs sm:text-base font-medium block">{question.label}</Label>
              
              <Slider
                value={[answers[question.id]]}
                onValueChange={(value) => handleSliderChange(question.id, value)}
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
                <span className="inline-block px-2 py-0.5 sm:px-4 sm:py-1.5 bg-primary/10 text-primary rounded text-[10px] sm:text-sm font-medium">
                  {question.labels[answers[question.id] - 1]}
                </span>
              </div>
            </div>
          ))}

          {includeInjuryQuestions && (
            <>
              <div className="pt-2 sm:pt-3 border-t space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="has-injury" className="text-xs sm:text-base font-medium">
                    Blessure ou douleur ?
                  </Label>
                  <Switch
                    id="has-injury"
                    checked={hasInjury}
                    onCheckedChange={setHasInjury}
                  />
                </div>

                {hasInjury && (
                  <>
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
                      <Label htmlFor="injury-location" className="text-xs sm:text-base">
                        Localisation <span className="text-muted-foreground">(optionnel)</span>
                      </Label>
                      <Input
                        id="injury-location"
                        placeholder="Ex: Genou droit, épaule gauche..."
                        value={injuryLocation}
                        onChange={(e) => setInjuryLocation(e.target.value)}
                        className="text-xs sm:text-sm"
                      />
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* Bouton période de règles pour les femmes */}
          {isFemale && (
            <div className="pt-2 sm:pt-3 border-t">
              <button
                type="button"
                onClick={() => handleMenstrualPeriodToggle(!menstrualPeriodActive)}
                className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors ${
                  menstrualPeriodActive 
                    ? "bg-pink-500/20 text-pink-400 border border-pink-500/50" 
                    : "bg-muted/50 text-muted-foreground border border-muted hover:bg-muted"
                }`}
              >
                <Droplet className={`h-4 w-4 ${menstrualPeriodActive ? "fill-pink-400" : ""}`} />
                <span className="text-xs sm:text-sm font-medium">
                  Période de règles
                </span>
              </button>
              {menstrualPeriodActive && (
                <p className="text-[10px] sm:text-xs text-muted-foreground text-center mt-1">
                  Ton coach verra une indication pour adapter l'intensité
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-2 sm:pt-3 border-t mt-2 flex-shrink-0">
          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={isSubmitting}
            size="sm"
            className="text-xs sm:text-sm h-8 sm:h-9"
          >
            Passer
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            size="sm"
            className="text-xs sm:text-sm h-8 sm:h-9"
          >
            {isSubmitting ? "..." : "Valider"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
