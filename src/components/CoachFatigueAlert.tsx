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

export function CoachFatigueAlert({ athleteId, athleteName }: CoachFatigueAlertProps) {
  const [showAlert, setShowAlert] = useState(false);
  const [fatigueData, setFatigueData] = useState<FatigueData | null>(null);
  const [highScores, setHighScores] = useState<string[]>([]);

  useEffect(() => {
    checkLatestFatigue();
  }, [athleteId]);

  const checkLatestFatigue = async () => {
    try {
      // Récupérer la dernière entrée de fatigue
      const { data, error } = await supabase
        .from("daily_fatigue_log")
        .select("*")
        .eq("user_id", athleteId)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return;

      const today = new Date().toISOString().split('T')[0];
      const alertKey = `fatigue_alert_dismissed_${athleteId}_${data.date}`;
      
      // Vérifier si l'alerte a déjà été vue pour cette date
      if (localStorage.getItem(alertKey) === 'true') {
        return;
      }

      // Identifier les notes élevées
      const highScoresList: string[] = [];
      if (data.fatigue > 4) highScoresList.push(`Fatigue: ${data.fatigue}/7`);
      if (data.courbatures > 4) highScoresList.push(`Courbatures: ${data.courbatures}/7`);
      if (data.sommeil > 4) highScoresList.push(`Sommeil: ${data.sommeil}/7`);
      if (data.stress > 4) highScoresList.push(`Stress: ${data.stress}/7`);

      // Afficher l'alerte si au moins une condition est remplie
      if (highScoresList.length > 0 || data.score_total > 15) {
        setFatigueData(data);
        setHighScores(highScoresList);
        setShowAlert(true);
      }
    } catch (error) {
      console.error("Error checking fatigue:", error);
    }
  };

  const handleDismiss = () => {
    if (fatigueData) {
      const alertKey = `fatigue_alert_dismissed_${athleteId}_${fatigueData.date}`;
      localStorage.setItem(alertKey, 'true');
    }
    setShowAlert(false);
  };

  if (!fatigueData) return null;

  return (
    <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertCircle className="h-5 w-5" />
            Alerte de fatigue - {athleteName}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-foreground">
              <p className="text-sm">
                Les dernières données de fatigue indiquent un niveau élevé qui nécessite ton attention.
              </p>
              
              {highScores.length > 0 && (
                <div className="bg-orange-50 dark:bg-orange-950/30 p-3 rounded-md border border-orange-200 dark:border-orange-800">
                  <p className="font-medium text-sm mb-2">Notes individuelles élevées (&gt; 4) :</p>
                  <ul className="space-y-1">
                    {highScores.map((score, index) => (
                      <li key={index} className="text-sm flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                        {score}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {fatigueData.score_total > 15 && (
                <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-md border border-red-200 dark:border-red-800">
                  <p className="font-medium text-sm">
                    Score global élevé : <span className="text-lg font-bold">{fatigueData.score_total}/28</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    (Seuil d'alerte : &gt; 15)
                  </p>
                </div>
              )}

              <p className="text-xs text-muted-foreground italic">
                Date de l'évaluation : {new Date(fatigueData.date).toLocaleDateString('fr-FR', { 
                  day: 'numeric', 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </p>
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
