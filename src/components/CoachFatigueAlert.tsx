import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface CoachFatigueAlertProps {
  athleteId: string;
  athleteName: string;
}

interface FatigueData {
  date: string;
  fatigue: number;
  courbatures: number;
  sommeil: number;
  stress: number;
  score_total: number;
}

interface FatigueAlert {
  date: string;
  data: FatigueData;
  highScores: string[];
}

export function CoachFatigueAlert({ athleteId, athleteName }: CoachFatigueAlertProps) {
  const [showAlert, setShowAlert] = useState(false);
  const [fatigueAlerts, setFatigueAlerts] = useState<FatigueAlert[]>([]);

  useEffect(() => {
    checkLast7DaysFatigue();
  }, [athleteId]);

  const checkLast7DaysFatigue = async () => {
    try {
      // Calculer la date d'il y a 7 jours
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

      // Récupérer toutes les entrées des 7 derniers jours
      const { data, error } = await supabase
        .from("daily_fatigue_log")
        .select("*")
        .eq("user_id", athleteId)
        .gte("date", sevenDaysAgoStr)
        .order("date", { ascending: false });

      if (error || !data || data.length === 0) return;

      // Filtrer les entrées qui nécessitent une alerte et qui n'ont pas été validées
      const alertsToShow: FatigueAlert[] = [];
      
      for (const entry of data) {
        const alertKey = `fatigue_alert_dismissed_${athleteId}_${entry.date}`;
        
        // Vérifier si l'alerte a déjà été vue pour cette date
        if (localStorage.getItem(alertKey) === 'true') {
          continue;
        }

        // Identifier les notes élevées
        const highScoresList: string[] = [];
        if (entry.fatigue > 4) highScoresList.push(`Fatigue: ${entry.fatigue}/7`);
        if (entry.courbatures > 4) highScoresList.push(`Courbatures: ${entry.courbatures}/7`);
        if (entry.sommeil > 4) highScoresList.push(`Sommeil: ${entry.sommeil}/7`);
        if (entry.stress > 4) highScoresList.push(`Stress: ${entry.stress}/7`);

        // Ajouter à la liste si au moins une condition est remplie
        if (highScoresList.length > 0 || entry.score_total > 15) {
          alertsToShow.push({
            date: entry.date,
            data: entry,
            highScores: highScoresList,
          });
        }
      }

      if (alertsToShow.length > 0) {
        setFatigueAlerts(alertsToShow);
        setShowAlert(true);
      }
    } catch (error) {
      console.error("Error checking fatigue:", error);
    }
  };

  const handleDismiss = () => {
    // Marquer toutes les alertes comme vues
    fatigueAlerts.forEach((alert) => {
      const alertKey = `fatigue_alert_dismissed_${athleteId}_${alert.date}`;
      localStorage.setItem(alertKey, 'true');
    });
    setShowAlert(false);
  };

  if (fatigueAlerts.length === 0) return null;

  return (
    <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertCircle className="h-5 w-5" />
            Alertes de fatigue - {athleteName}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-foreground">
              <p className="text-sm">
                {fatigueAlerts.length} alerte{fatigueAlerts.length > 1 ? 's' : ''} détectée{fatigueAlerts.length > 1 ? 's' : ''} dans les 7 derniers jours nécessitant ton attention.
              </p>
              
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {fatigueAlerts.map((alert, index) => (
                    <div key={alert.date}>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-base">
                            {new Date(alert.date).toLocaleDateString('fr-FR', { 
                              weekday: 'long',
                              day: 'numeric', 
                              month: 'long', 
                              year: 'numeric' 
                            })}
                          </p>
                        </div>
                        
                        {alert.highScores.length > 0 && (
                          <div className="bg-orange-50 dark:bg-orange-950/30 p-3 rounded-md border border-orange-200 dark:border-orange-800">
                            <p className="font-medium text-sm mb-2">Notes individuelles élevées (&gt; 4) :</p>
                            <ul className="space-y-1">
                              {alert.highScores.map((score, scoreIndex) => (
                                <li key={scoreIndex} className="text-sm flex items-center gap-2">
                                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                                  {score}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {alert.data.score_total > 15 && (
                          <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-md border border-red-200 dark:border-red-800">
                            <p className="font-medium text-sm">
                              Score global élevé : <span className="text-lg font-bold">{alert.data.score_total}/28</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              (Seuil d'alerte : &gt; 15)
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {index < fatigueAlerts.length - 1 && (
                        <Separator className="my-4" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleDismiss}>OK, compris</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
