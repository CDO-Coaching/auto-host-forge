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
    label: "Quel est ton niveau de fatigue aujourd'hui ?",
    labels: ["Excellent", "Très bon", "Bon", "Moyen", "Assez élevé", "Important", "Très fort"],
  },
  {
    id: "courbatures",
    label: "Quel est ton niveau de courbatures aujourd'hui ?",
    labels: ["Aucun", "Très léger", "Léger", "Moyen", "Assez élevé", "Important", "Très fort"],
  },
  {
    id: "sommeil",
    label: "Comment as-tu dormi cette nuit ?",
    labels: ["Excellent", "Très bon", "Bon", "Moyen", "Assez mauvais", "Mauvais", "Très mauvais"],
  },
  {
    id: "stress",
    label: "Comment est ton niveau de stress aujourd'hui ?",
    labels: ["Très léger", "Très bon", "Bon", "Moyen", "Assez élevé", "Important", "Très fort"],
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
      <DialogContent className="sm:max-w-[500px]">
        <button
          onClick={handleSkip}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none z-50"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Passer</span>
        </button>

        <DialogHeader>
          <DialogTitle>Suivi quotidien de fatigue</DialogTitle>
          <DialogDescription>
            Évalue ton état du jour pour optimiser ton entraînement
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 py-6 max-h-[60vh] overflow-y-auto">
          {questions.map((question) => (
            <div key={question.id} className="space-y-4">
              <Label className="text-base font-medium">{question.label}</Label>
              
              <div className="space-y-3">
                <Slider
                  value={[answers[question.id]]}
                  onValueChange={(value) => handleSliderChange(question.id, value)}
                  min={1}
                  max={7}
                  step={1}
                  className="w-full"
                />
                
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                  <span>6</span>
                  <span>7</span>
                </div>
                
                <div className="text-center">
                  <span className="inline-block px-4 py-2 bg-primary/10 text-primary rounded-md font-medium">
                    {question.labels[answers[question.id] - 1]}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={isSubmitting}
          >
            Passer
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Enregistrement..." : "Valider"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
