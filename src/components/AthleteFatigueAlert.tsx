import { AlertTriangle, AlertCircle, X, MessageCircle, ThumbsUp } from "lucide-react";
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
  const isRecovery = alertData.level === "recovery";

  const sleepDesc = getSleepDescription(alertData.sommeil);
  const stressDesc = getStressDescription(alertData.stress);

  // Descriptions pour hier (mode recovery)
  const yesterdaySleepDesc = alertData.yesterdaySommeil ? getSleepDescription(alertData.yesterdaySommeil) : "";
  const yesterdayStressDesc = alertData.yesterdayStress ? getStressDescription(alertData.yesterdayStress) : "";

  // Vérifier si les données sont d'hier ou d'aujourd'hui
  const today = new Date().toISOString().split('T')[0];
  const isFromYesterday = alertData.date !== today;

  const handleContactCoach = () => {
    navigate("/sportif");
  };

  // Mode récupération : aujourd'hui va mieux mais hier était difficile
  if (isRecovery) {
    return (
      <Alert className="mb-4 relative border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6"
          onClick={dismissAlert}
        >
          <X className="h-4 w-4" />
        </Button>
        
        <ThumbsUp className="h-5 w-5" />
        
        <AlertTitle className="font-semibold pr-8">
          👍 Bonne nouvelle, tu vas mieux !
        </AlertTitle>
        
        <AlertDescription className="mt-2 space-y-2">
          <p>
            Aujourd'hui, ton sommeil et ton stress sont bons. Mais <strong>hier</strong>, ton sommeil était <strong>{yesterdaySleepDesc}</strong> et ton stress était <strong>{yesterdayStressDesc}</strong>.
          </p>
          <p className="font-medium">
            Prends quand même le temps de bien récupérer et vas-y tranquillement sur ta séance.
          </p>
          <p className="text-sm opacity-80 italic">
            Rappel : prendre soin de ton corps, c'est éviter les blessures et progresser sur le long terme.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

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
              {isFromYesterday ? (
                <>Attention, <strong>hier</strong> ton sommeil était <strong>{sleepDesc}</strong> et ton niveau de stress était <strong>{stressDesc}</strong>.</>
              ) : (
                <>Nous remarquons que ton sommeil a été <strong>{sleepDesc}</strong> et que ton niveau de stress est <strong>{stressDesc}</strong>.</>
              )}
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
              {isFromYesterday ? (
                <>Attention, <strong>hier</strong> ton sommeil était <strong>{sleepDesc}</strong> et ton niveau de stress était <strong>{stressDesc}</strong>.</>
              ) : (
                <>Nous remarquons que ton sommeil a été <strong>{sleepDesc}</strong> et que ton niveau de stress est <strong>{stressDesc}</strong>.</>
              )}
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
