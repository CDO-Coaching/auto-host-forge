import { AlertTriangle, AlertCircle, X, MessageCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAthleteFatigueAlert } from "@/hooks/useAthleteFatigueAlert";
import { useNavigate } from "react-router-dom";

export function AthleteFatigueAlert() {
  const { alertData, isLoading, dismissAlert } = useAthleteFatigueAlert();
  const navigate = useNavigate();

  if (isLoading || !alertData) {
    return null;
  }

  const isWarning = alertData.level === "warning";
  const isCritical = alertData.level === "critical";

  const handleContactCoach = () => {
    // Navigate to messages or dashboard where they can contact coach
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
              Ton sommeil ({alertData.sommeil}/7) et ton stress ({alertData.stress}/7) indiquent une fatigue importante.
            </p>
            <p className="font-medium">
              Adapte ton entraînement aujourd'hui : réduis l'intensité et écoute ton corps.
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
              Tes scores de sommeil ({alertData.sommeil}/7) et stress ({alertData.stress}/7) sont légèrement élevés.
            </p>
            <p className="font-medium">
              Fais attention à l'intensité de ta séance et reste bien concentré.
            </p>
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}
