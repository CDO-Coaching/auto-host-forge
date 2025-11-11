import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useDailyFatigueCheck() {
  const [shouldShowDialog, setShouldShowDialog] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkDailyFatigue();
  }, []);

  const checkDailyFatigue = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsChecking(false);
        return;
      }

      // Vérifier si les notifications sont activées
      const notificationPreference = localStorage.getItem(`fatigue_notifications_${user.id}`);
      if (notificationPreference === 'false') {
        setIsChecking(false);
        return;
      }

      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from("daily_fatigue_log")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      if (error) {
        console.error("Error checking daily fatigue:", error);
        setIsChecking(false);
        return;
      }

      // Si aucune entrée pour aujourd'hui, afficher le dialog
      setShouldShowDialog(!data);
    } catch (error) {
      console.error("Error in checkDailyFatigue:", error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleClose = () => {
    setShouldShowDialog(false);
  };

  return { shouldShowDialog, isChecking, handleClose };
}
