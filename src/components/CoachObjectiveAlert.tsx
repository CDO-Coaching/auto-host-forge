import React, { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Target, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CoachObjectiveAlertProps {
  athleteId: string;
  athleteName: string;
  onNavigateToObjectives?: () => void;
}

type AlertType = "none" | "no_objective" | "overdue";

export function CoachObjectiveAlert({ athleteId, athleteName, onNavigateToObjectives }: CoachObjectiveAlertProps) {
  const [alertType, setAlertType] = useState<AlertType>("none");
  const [daysOverdue, setDaysOverdue] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkObjectiveDeadline();
  }, [athleteId]);

  const checkObjectiveDeadline = async () => {
    try {
      const { data, error } = await supabase
        .from("athlete_objectives")
        .select("main_objective, main_objective_deadline")
        .eq("athlete_id", athleteId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Erreur lors de la vérification de l'objectif:", error);
        return;
      }

      // Pas d'objectif principal défini ou objectif vide
      if (!data || !data.main_objective || data.main_objective.trim() === "") {
        setAlertType("no_objective");
        setLoading(false);
        return;
      }

      // Objectif défini mais pas de deadline ou deadline dépassée
      if (data.main_objective_deadline) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const deadline = new Date(data.main_objective_deadline);
        deadline.setHours(0, 0, 0, 0);

        const diffTime = today.getTime() - deadline.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0) {
          setAlertType("overdue");
          setDaysOverdue(diffDays);
        } else {
          setAlertType("none");
        }
      } else {
        // Objectif défini mais pas de deadline
        setAlertType("no_objective");
      }
    } catch (error) {
      console.error("Erreur lors de la vérification:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || alertType === "none") {
    return null;
  }

  return (
    <Alert className="border-primary/50 bg-primary/5">
      <div className="flex items-start gap-3">
        <Bell className="h-5 w-5 text-primary mt-0.5" />
        <div className="flex-1 space-y-2">
          <AlertTitle className="text-base font-semibold flex items-center gap-2">
            {alertType === "no_objective" 
              ? `Objectif principal manquant pour ${athleteName}`
              : `Objectif principal atteint pour ${athleteName}`
            }
          </AlertTitle>
          <AlertDescription className="text-sm">
            {alertType === "no_objective" ? (
              <span>
                Aucun objectif principal n'est défini pour {athleteName}. 
                Définissez un objectif pour guider sa progression.
              </span>
            ) : daysOverdue === 0 ? (
              <span>
                La date cible de l'objectif principal a été atteinte aujourd'hui. 
                Il est temps de définir un nouvel objectif pour continuer la progression de {athleteName}.
              </span>
            ) : (
              <span>
                La date cible de l'objectif principal a été atteinte il y a {daysOverdue} jour{daysOverdue > 1 ? 's' : ''}. 
                Pensez à définir un nouvel objectif pour {athleteName}.
              </span>
            )}
          </AlertDescription>
          {onNavigateToObjectives && (
            <Button
              onClick={onNavigateToObjectives}
              variant="default"
              size="sm"
              className="mt-2"
            >
              <Target className="h-4 w-4 mr-2" />
              {alertType === "no_objective" ? "Définir un objectif" : "Définir un nouvel objectif"}
            </Button>
          )}
        </div>
      </div>
    </Alert>
  );
}
