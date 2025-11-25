import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useCoachDailyPaymentReminder() {
  const [shouldShowReminder, setShouldShowReminder] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkDailyReminder();
  }, []);

  const checkDailyReminder = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsChecking(false);
        return;
      }

      // Vérifier le rôle de l'utilisateur
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || profile.role !== "coach") {
        setIsChecking(false);
        return;
      }

      // Vérifier si le rappel a déjà été montré aujourd'hui
      const today = new Date().toISOString().split('T')[0];
      const lastReminderShown = localStorage.getItem(`payment_reminder_shown_${user.id}`);

      if (lastReminderShown !== today) {
        setShouldShowReminder(true);
      }
    } catch (error) {
      console.error("Error in checkDailyReminder:", error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleDismiss = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem(`payment_reminder_shown_${user.id}`, today);
    }
    setShouldShowReminder(false);
  };

  return { shouldShowReminder, isChecking, handleDismiss };
}
