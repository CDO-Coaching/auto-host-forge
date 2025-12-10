import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Heart, X } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface CoachMenstrualRestAlertProps {
  athleteId: string;
  athleteName: string;
}

interface MenstrualRestPeriod {
  id: string;
  start_date: string;
  end_date: string;
  notes: string | null;
}

export function CoachMenstrualRestAlert({ athleteId, athleteName }: CoachMenstrualRestAlertProps) {
  const [activePeriods, setActivePeriods] = useState<MenstrualRestPeriod[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    checkActivePeriods();
    loadDismissedAlerts();
  }, [athleteId]);

  const loadDismissedAlerts = () => {
    const dismissedStr = localStorage.getItem(`menstrual_alert_dismissed_${athleteId}`);
    if (dismissedStr) {
      try {
        const parsed = JSON.parse(dismissedStr);
        setDismissed(parsed);
      } catch {
        setDismissed([]);
      }
    }
  };

  const checkActivePeriods = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Récupérer les périodes actives ou à venir (non encore terminées)
      const { data, error } = await supabase
        .from("menstrual_rest_periods")
        .select("*")
        .eq("athlete_id", athleteId)
        .gte("end_date", today)
        .order("start_date", { ascending: true });

      if (error) {
        console.error("Erreur lors de la vérification des périodes:", error);
        return;
      }

      setActivePeriods(data || []);
    } catch (error) {
      console.error("Error checking menstrual periods:", error);
    }
  };

  const handleDismiss = (periodId: string) => {
    const newDismissed = [...dismissed, periodId];
    setDismissed(newDismissed);
    localStorage.setItem(`menstrual_alert_dismissed_${athleteId}`, JSON.stringify(newDismissed));
  };

  // Filtrer les périodes non dismissées
  const visiblePeriods = activePeriods.filter(p => !dismissed.includes(p.id));

  if (visiblePeriods.length === 0) return null;

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-2">
      {visiblePeriods.map((period) => {
        const isActive = period.start_date <= today && period.end_date >= today;
        const isFuture = period.start_date > today;

        return (
          <Alert 
            key={period.id} 
            className="border-pink-300 bg-pink-50 dark:bg-pink-950/30 dark:border-pink-800"
          >
            <Heart className="h-4 w-4 text-pink-500" />
            <AlertTitle className="flex items-center justify-between pr-2">
              <span className="text-pink-700 dark:text-pink-400">
                {isActive ? "Période de repos en cours" : "Période de repos à venir"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDismiss(period.id)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </AlertTitle>
            <AlertDescription className="text-pink-600 dark:text-pink-300">
              <p className="font-medium">
                {athleteName} demande une réduction d'intensité du{" "}
                <span className="font-bold">
                  {format(new Date(period.start_date), "d MMMM", { locale: fr })}
                </span>{" "}
                au{" "}
                <span className="font-bold">
                  {format(new Date(period.end_date), "d MMMM yyyy", { locale: fr })}
                </span>
              </p>
              {period.notes && (
                <p className="text-xs mt-1 italic opacity-80">
                  "{period.notes}"
                </p>
              )}
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}
