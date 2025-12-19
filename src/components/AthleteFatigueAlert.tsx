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

// Seuil pour considérer un score comme "élevé"
const HIGH_THRESHOLD = 3;

// Générer le message en fonction des métriques élevées
const buildMessage = (
  sommeil: number,
  stress: number,
  isFromYesterday: boolean
): string => {
  const sleepHigh = sommeil >= HIGH_THRESHOLD;
  const stressHigh = stress >= HIGH_THRESHOLD;
  const sleepDesc = getSleepDescription(sommeil);
  const stressDesc = getStressDescription(stress);

  const timePrefix = isFromYesterday ? "hier" : "";
  const verbSleep = isFromYesterday ? "était" : "a été";
  const verbStress = isFromYesterday ? "était" : "est";

  if (sleepHigh && stressHigh) {
    if (isFromYesterday) {
      return `Attention, **hier** ton sommeil était **${sleepDesc}** et ton niveau de stress était **${stressDesc}**.`;
    }
    return `Nous remarquons que ton sommeil a été **${sleepDesc}** et que ton niveau de stress est **${stressDesc}**.`;
  } else if (sleepHigh) {
    if (isFromYesterday) {
      return `Attention, **hier** ton sommeil était **${sleepDesc}**.`;
    }
    return `Nous remarquons que ton sommeil a été **${sleepDesc}**.`;
  } else if (stressHigh) {
    if (isFromYesterday) {
      return `Attention, **hier** ton niveau de stress était **${stressDesc}**.`;
    }
    return `Nous remarquons que ton niveau de stress est **${stressDesc}**.`;
  }
  return "";
};

// Composant pour afficher le message avec du texte en gras
const FormattedMessage = ({ text }: { text: string }) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return part;
      })}
    </p>
  );
};

export function AthleteFatigueAlert() {
  const { alertData, isLoading, dismissAlert } = useAthleteFatigueAlert();
  const navigate = useNavigate();

  if (isLoading || !alertData) {
    return null;
  }

  const isCritical = alertData.level === "critical";
  const isRecovery = alertData.level === "recovery";

  // Vérifier si les données sont d'hier ou d'aujourd'hui
  const today = new Date().toISOString().split('T')[0];
  const isFromYesterday = alertData.date !== today;

  const handleContactCoach = () => {
    navigate("/sportif");
  };

  // Mode récupération : aujourd'hui va mieux mais hier était difficile
  if (isRecovery) {
    const yesterdaySleepHigh = (alertData.yesterdaySommeil || 0) >= HIGH_THRESHOLD;
    const yesterdayStressHigh = (alertData.yesterdayStress || 0) >= HIGH_THRESHOLD;
    const yesterdaySleepDesc = getSleepDescription(alertData.yesterdaySommeil || 0);
    const yesterdayStressDesc = getStressDescription(alertData.yesterdayStress || 0);

    let yesterdayMessage = "";
    if (yesterdaySleepHigh && yesterdayStressHigh) {
      yesterdayMessage = `Mais **hier**, ton sommeil était **${yesterdaySleepDesc}** et ton stress était **${yesterdayStressDesc}**.`;
    } else if (yesterdaySleepHigh) {
      yesterdayMessage = `Mais **hier**, ton sommeil était **${yesterdaySleepDesc}**.`;
    } else if (yesterdayStressHigh) {
      yesterdayMessage = `Mais **hier**, ton stress était **${yesterdayStressDesc}**.`;
    }

    return (
      <Alert className="mb-4 relative border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
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
            Aujourd'hui, ton sommeil et ton stress sont bons. <FormattedMessage text={yesterdayMessage} />
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

  const message = buildMessage(alertData.sommeil, alertData.stress, isFromYesterday);

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
        <FormattedMessage text={message} />
        <p className="font-medium">
          {isCritical 
            ? "Adapte ton entraînement aujourd'hui : réduis l'intensité et écoute ton corps."
            : "Fais attention à l'intensité de ta séance, reste bien concentré et écoute ton corps."
          }
        </p>
        <p className="text-sm opacity-80 italic">
          Rappel : prendre soin de ton corps, c'est éviter les blessures et progresser sur le long terme.
        </p>
        {isCritical && (
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2 border-destructive/30 hover:bg-destructive/10"
            onClick={handleContactCoach}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Contacter mon coach
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
