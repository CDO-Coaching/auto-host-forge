import { AlertTriangle, AlertCircle, X, MessageCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAthleteFatigueAlert } from "@/hooks/useAthleteFatigueAlert";
import { useNavigate } from "react-router-dom";

// Descriptions pour le sommeil (score élevé = mauvaise nuit)
const getSleepDescription = (score: number): string => {
  if (score <= 2) return "correct";
  if (score === 3) return "légèrement perturbé";
  if (score === 4) return "perturbé";
  if (score === 5) return "assez perturbé";
  if (score === 6) return "très perturbé";
  return "très mauvais";
};

// Descriptions pour le stress (score élevé = stress élevé)
const getStressDescription = (score: number): string => {
  if (score <= 2) return "faible";
  if (score === 3) return "légèrement élevé";
  if (score === 4) return "modéré";
  if (score === 5) return "assez élevé";
  if (score === 6) return "élevé";
  return "très élevé";
};

export function AthleteFatigueAlert() {
  const { alertData, isLoading, dismissAlert } = useAthleteFatigueAlert();
  const navigate = useNavigate();

  if (isLoading || !alertData) {
    return null;
  }

  const isWarning = alertData.level === "warning";
  const isCritical = alertData.level === "critical";

  const sleepDesc = getSleepDescription(alertData.sommeil);
  const stressDesc = getStressDescription(alertData.stress);

  const handleContactCoach = () => {
    navigate("/sportif");
  };

  return (
    <Alert 
      className={`mb-4 relative ${
        isCritical 
          ? "border-destructive/50 bg-destructive/10 text-destructive" 
          : "border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-400"
      }`}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={dismissAlert}
      >
        <X className="h-4 w-4" />
      </Button>
      
      {isCritical ? (
        <AlertCircle className="h-5 w-5" />
      ) : (
        <AlertTriangle className="h-5 w-5" />
      )}
      
      <AlertTitle className="font-semibold pr-8">
        {isCritical ? "⚠️ Attention - Fatigue élevée détectée" : "💡 Vigilance recommandée"}
      </AlertTitle>
      
      <AlertDescription className="mt-2 space-y-2">
        {isCritical ? (
          <>
            <p>
              Nous remarquons que ton sommeil a été <strong>{sleepDesc}</strong> et que ton niveau de stress est <strong>{stressDesc}</strong>.
            </p>
            <p className="font-medium">
              Adapte ton entraînement aujourd'hui : réduis l'intensité et écoute ton corps.
            </p>
            <p className="text-sm opacity-80 italic">
              Rappel : prendre soin de ton corps, c'est éviter les blessures et progresser sur le long terme.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 border-destructive/30 hover:bg-destructive/10"
              onClick={handleContactCoach}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Contacter mon coach
            </Button>
          </>
        ) : (
          <>
            <p>
              Nous remarquons que ton sommeil a été <strong>{sleepDesc}</strong> et que ton niveau de stress est <strong>{stressDesc}</strong>.
            </p>
            <p className="font-medium">
              Fais attention à l'intensité de ta séance, reste bien concentré et écoute ton corps.
            </p>
            <p className="text-sm opacity-80 italic">
              Rappel : prendre soin de ton corps, c'est éviter les blessures et progresser sur le long terme.
            </p>
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}
