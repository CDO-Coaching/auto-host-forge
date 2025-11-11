import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
    options: [
      { value: "1", label: "Excellent" },
      { value: "2", label: "Très bon" },
      { value: "3", label: "Bon" },
      { value: "4", label: "Moyen" },
      { value: "5", label: "Assez élevé" },
      { value: "6", label: "Important" },
      { value: "7", label: "Très fort" },
    ],
  },
  {
    id: "courbatures",
    label: "Quel est ton niveau de courbatures aujourd'hui ?",
    options: [
      { value: "1", label: "Aucun" },
      { value: "2", label: "Très léger" },
      { value: "3", label: "Léger" },
      { value: "4", label: "Moyen" },
      { value: "5", label: "Assez élevé" },
      { value: "6", label: "Important" },
      { value: "7", label: "Très fort" },
    ],
  },
  {
    id: "sommeil",
    label: "Comment as-tu dormi cette nuit ?",
    options: [
      { value: "1", label: "Excellent" },
      { value: "2", label: "Très bon" },
      { value: "3", label: "Bon" },
      { value: "4", label: "Moyen" },
      { value: "5", label: "Assez mauvais" },
      { value: "6", label: "Mauvais" },
      { value: "7", label: "Très mauvais" },
    ],
  },
  {
    id: "stress",
    label: "Comment est ton niveau de stress aujourd'hui ?",
    options: [
      { value: "1", label: "Très léger" },
      { value: "2", label: "Très bon" },
      { value: "3", label: "Bon" },
      { value: "4", label: "Moyen" },
      { value: "5", label: "Assez élevé" },
      { value: "6", label: "Important" },
      { value: "7", label: "Très fort" },
    ],
  },
];

export function DailyFatigueDialog({ open, onClose }: DailyFatigueDialogProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const currentQuestion = questions[currentStep];
  const isLastQuestion = currentStep === questions.length - 1;

  const handleAnswer = (value: string) => {
    setAnswers({ ...answers, [currentQuestion.id]: value });
  };

  const handleNext = () => {
    if (!answers[currentQuestion.id]) {
      toast({
        title: "Sélectionne une réponse",
        description: "Merci de choisir une option avant de continuer.",
        variant: "destructive",
      });
      return;
    }

    if (isLastQuestion) {
      handleSubmit();
    } else {
      setCurrentStep(currentStep + 1);
    }
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
          fatigue: parseInt(answers.fatigue),
          courbatures: parseInt(answers.courbatures),
          sommeil: parseInt(answers.sommeil),
          stress: parseInt(answers.stress),
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
    setAnswers({});
    setCurrentStep(0);
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
          <DialogTitle>Suivi quotidien</DialogTitle>
          <DialogDescription>
            Question {currentStep + 1} sur {questions.length}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <Label className="text-base font-medium">{currentQuestion.label}</Label>
          
          <RadioGroup
            value={answers[currentQuestion.id]}
            onValueChange={handleAnswer}
            className="space-y-3"
          >
            {currentQuestion.options.map((option) => (
              <div key={option.value} className="flex items-center space-x-3">
                <RadioGroupItem value={option.value} id={`${currentQuestion.id}-${option.value}`} />
                <Label
                  htmlFor={`${currentQuestion.id}-${option.value}`}
                  className="font-normal cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="flex justify-between items-center pt-4">
          <Button
            variant="ghost"
            onClick={handleSkip}
          >
            Passer
          </Button>
          <Button
            onClick={handleNext}
            disabled={!answers[currentQuestion.id] || isSubmitting}
          >
            {isSubmitting ? "Enregistrement..." : isLastQuestion ? "Terminer" : "Suivant"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
