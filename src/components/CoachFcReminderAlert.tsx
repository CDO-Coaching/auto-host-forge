import React, { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Heart, X, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CoachFcReminderAlertProps {
  athleteId: string;
  athleteName: string;
  onNavigateToMax: () => void;
}

interface FcData {
  fc_max: number | null;
  fc_repos: number | null;
}

export const CoachFcReminderAlert: React.FC<CoachFcReminderAlertProps> = ({
  athleteId,
  athleteName,
  onNavigateToMax,
}) => {
  const [fcData, setFcData] = useState<FcData | null>(null);
  const [showReminder, setShowReminder] = useState(false);
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkFcData();
  }, [athleteId]);

  const checkFcData = async () => {
    try {
      // Vérifier si le rappel est snooze
      const snoozeKey = `fc-reminder-snooze-${athleteId}`;
      const snoozedUntil = localStorage.getItem(snoozeKey);
      
      if (snoozedUntil) {
        const snoozeDate = new Date(snoozedUntil);
        if (snoozeDate > new Date()) {
          setShowReminder(false);
          setLoading(false);
          return;
        } else {
          // Snooze expiré, le supprimer
          localStorage.removeItem(snoozeKey);
        }
      }

      // Charger les données FC
      const { data, error } = await supabase
        .from("user_profiles")
        .select("fc_max, fc_repos")
        .eq("id", athleteId)
        .single();

      if (error) {
        console.error("Erreur lors du chargement FC:", error);
        setLoading(false);
        return;
      }

      setFcData(data);

      // Afficher le rappel si FC max ou FC repos n'est pas renseigné
      const needsReminder = !data?.fc_max || !data?.fc_repos;
      setShowReminder(needsReminder);
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSnooze = (days: number) => {
    const snoozeKey = `fc-reminder-snooze-${athleteId}`;
    const snoozeDate = new Date();
    snoozeDate.setDate(snoozeDate.getDate() + days);
    localStorage.setItem(snoozeKey, snoozeDate.toISOString());
    setShowReminder(false);
    setShowSnoozeOptions(false);
  };

  const handleDismissToday = () => {
    handleSnooze(1);
  };

  const handleGoToMax = () => {
    onNavigateToMax();
    setShowReminder(false);
  };

  if (loading || !showReminder) {
    return null;
  }

  const missingFields: string[] = [];
  if (!fcData?.fc_max) missingFields.push("FC max");
  if (!fcData?.fc_repos) missingFields.push("FC repos");

  return (
    <Alert className="border-orange-500/50 bg-orange-500/10 mb-4">
      <Heart className="h-4 w-4 text-orange-500" />
      <AlertTitle className="text-orange-500 font-medium">
        Données cardio manquantes
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="text-sm text-muted-foreground mb-3">
          {missingFields.join(" et ")} non renseigné{missingFields.length > 1 ? "s" : ""} pour {athleteName}.
        </p>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={handleGoToMax}
            className="bg-orange-500 hover:bg-orange-600"
          >
            Renseigner maintenant
          </Button>

          {!showSnoozeOptions ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowSnoozeOptions(true)}
              className="text-muted-foreground"
            >
              <Clock className="h-3 w-3 mr-1" />
              Reporter
            </Button>
          ) : (
            <Select onValueChange={(value) => handleSnooze(parseInt(value))}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Reporter de..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 jour</SelectItem>
                <SelectItem value="3">3 jours</SelectItem>
                <SelectItem value="7">1 semaine</SelectItem>
                <SelectItem value="14">2 semaines</SelectItem>
                <SelectItem value="30">1 mois</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismissToday}
            className="text-muted-foreground ml-auto"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};
