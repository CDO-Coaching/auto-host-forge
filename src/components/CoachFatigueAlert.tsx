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
import { AlertCircle, Moon, Frown, Brain, Activity } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

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

interface HighMetric {
  name: string;
  value: number;
  icon: React.ReactNode;
}

interface FatigueAlert {
  date: string;
  data: FatigueData;
  highMetrics: HighMetric[];
}

const METRIC_THRESHOLD = 4; // Seuil d'alerte individuel ≥ 4/7

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

      // Filtrer les entrées qui nécessitent une alerte
      const alertsToShow: FatigueAlert[] = [];
      
      for (const entry of data) {
        const alertKey = `fatigue_alert_dismissed_${athleteId}_${entry.date}`;
        
        // Vérifier si l'alerte a déjà été vue pour cette date
        if (localStorage.getItem(alertKey) === 'true') {
          continue;
        }

        // Vérifier les métriques individuelles ≥ 4/7
        const highMetrics: HighMetric[] = [];
        
        if (entry.sommeil >= METRIC_THRESHOLD) {
          highMetrics.push({
            name: "Sommeil",
            value: entry.sommeil,
            icon: <Moon className="h-4 w-4" />,
          });
        }
        
        if (entry.fatigue >= METRIC_THRESHOLD) {
          highMetrics.push({
            name: "Fatigue",
            value: entry.fatigue,
            icon: <Frown className="h-4 w-4" />,
          });
        }
        
        if (entry.stress >= METRIC_THRESHOLD) {
          highMetrics.push({
            name: "Stress",
            value: entry.stress,
            icon: <Brain className="h-4 w-4" />,
          });
        }
        
        if (entry.courbatures >= METRIC_THRESHOLD) {
          highMetrics.push({
            name: "Courbatures",
            value: entry.courbatures,
            icon: <Activity className="h-4 w-4" />,
          });
        }

        // Ajouter à la liste si au moins une métrique est ≥ 4
        if (highMetrics.length > 0) {
          alertsToShow.push({
            date: entry.date,
            data: entry,
            highMetrics,
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

  // Compter le nombre total de métriques élevées
  const totalHighMetrics = fatigueAlerts.reduce((acc, alert) => acc + alert.highMetrics.length, 0);

  return (
    <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertCircle className="h-5 w-5" />
            Attention - {athleteName}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-foreground">
              <p className="text-sm">
                {totalHighMetrics} indicateur{totalHighMetrics > 1 ? 's' : ''} élevé{totalHighMetrics > 1 ? 's' : ''} (≥ 4/7) détecté{totalHighMetrics > 1 ? 's' : ''} dans les 7 derniers jours. À surveiller !
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
                          <Badge variant="outline" className="text-muted-foreground">
                            Score: {alert.data.score_total}/28
                          </Badge>
                        </div>
                        
                        <div className="bg-orange-50 dark:bg-orange-950/30 p-3 rounded-md border border-orange-200 dark:border-orange-800">
                          <div className="space-y-2">
                            {alert.highMetrics.map((metric, metricIndex) => (
                              <div 
                                key={metricIndex}
                                className="flex items-center gap-2 text-sm"
                              >
                                <span className="text-orange-600 dark:text-orange-400">
                                  {metric.icon}
                                </span>
                                <span className="font-medium">
                                  {metric.name}
                                </span>
                                <span className="text-orange-600 dark:text-orange-400 font-bold">
                                  {metric.value}/7
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
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
