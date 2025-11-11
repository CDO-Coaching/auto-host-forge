import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DailyFatigueDialogProps {
  open: boolean;
  onClose: () => void;
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
    labels: ["Excellent", "Très bon", "Bon", "Moyen", "Agité", "Mauvais", "Très mauvais"],
  },
  {
    id: "stress",
    label: "Niveau de stress",
    labels: ["Zen", "Calme", "Détendu", "Neutre", "Tendu", "Stressé", "Très stressé"],
  },
];

export function DailyFatigueDialog({ open, onClose }: DailyFatigueDialogProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({
    fatigue: 4,
    courbatures: 4,
    sommeil: 4,
    stress: 4,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSliderChange = (id: string, value: number[]) => {
    setAnswers({ ...answers, [id]: value[0] });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const today = new Date().toISOString().split('T')[0];

      const { error } = await supabase
        .from("daily_fatigue_log")
        .insert({
          user_id: user.id,
          date: today,
          fatigue: answers.fatigue,
          courbatures: answers.courbatures,
          sommeil: answers.sommeil,
          stress: answers.stress,
        });

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
      <DialogContent className="sm:max-w-[500px] max-h-[95vh] flex flex-col p-3 sm:p-6 gap-0">
        <button
          onClick={handleSkip}
          className="absolute right-2 top-2 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none z-50"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Passer</span>
        </button>

        <DialogHeader className="pb-2 sm:pb-3 space-y-0.5">
          <DialogTitle className="text-base sm:text-xl">Suivi quotidien</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Évalue ton état du jour
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-5 flex-1 overflow-hidden">
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
        </div>

        <div className="flex justify-between items-center pt-2 sm:pt-4 border-t mt-2 sm:mt-3">
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
