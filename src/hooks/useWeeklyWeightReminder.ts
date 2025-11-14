import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useWeeklyWeightReminder() {
  const [shouldShowReminder, setShouldShowReminder] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkWeeklyReminder();
  }, []);

  const checkWeeklyReminder = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsChecking(false);
        return;
      }

      // Vérifier si les rappels sont activés
      const reminderEnabled = localStorage.getItem(`weight_reminder_${user.id}`);
      if (reminderEnabled !== 'true') {
        setIsChecking(false);
        return;
      }

      // Obtenir le début de la semaine actuelle (lundi)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Si dimanche (0), alors 6 jours en arrière
      const monday = new Date(now);
      monday.setDate(now.getDate() - daysToMonday);
      monday.setHours(0, 0, 0, 0);

      // Vérifier la dernière entrée de poids
      const { data, error } = await supabase
        .from("weight_tracking")
        .select("recorded_at")
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error checking weight tracking:", error);
        setIsChecking(false);
        return;
      }

      // Si pas d'entrée cette semaine, afficher le rappel
      if (!data || new Date(data.recorded_at) < monday) {
        // Vérifier si on a déjà montré le rappel cette semaine
        const lastReminderShown = localStorage.getItem(`weight_reminder_shown_${user.id}`);
        const currentWeekKey = `${monday.getFullYear()}-W${getWeekNumber(monday)}`;
        
        if (lastReminderShown !== currentWeekKey) {
          setShouldShowReminder(true);
        }
      }
    } catch (error) {
      console.error("Error in checkWeeklyReminder:", error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleDismiss = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - daysToMonday);
      monday.setHours(0, 0, 0, 0);
      
      const currentWeekKey = `${monday.getFullYear()}-W${getWeekNumber(monday)}`;
      localStorage.setItem(`weight_reminder_shown_${user.id}`, currentWeekKey);
    }
    setShouldShowReminder(false);
  };

  return { shouldShowReminder, isChecking, handleDismiss };
}

// Fonction utilitaire pour obtenir le numéro de semaine
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
