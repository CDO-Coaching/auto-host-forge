import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FatigueAlertLevel = "warning" | "critical" | null;

interface FatigueAlertData {
  level: FatigueAlertLevel;
  sommeil: number;
  stress: number;
  total: number;
  date: string;
}

export function useAthleteFatigueAlert() {
  const [alertData, setAlertData] = useState<FatigueAlertData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    checkRecentFatigue();
  }, []);

  const checkRecentFatigue = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Récupérer les données d'aujourd'hui et d'hier
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const { data, error } = await supabase
        .from("daily_fatigue_log")
        .select("sommeil, stress, date")
        .eq("user_id", user.id)
        .gte("date", yesterday.toISOString().split('T')[0])
        .lt("date", tomorrow.toISOString().split('T')[0])
        .order("date", { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        setIsLoading(false);
        return;
      }

      // Prendre l'entrée la plus récente (hier ou avant-hier)
      const recentEntry = data[0];
      const total = recentEntry.sommeil + recentEntry.stress;

      // Vérifier si l'alerte a déjà été vue aujourd'hui
      const dismissKey = `fatigue_alert_dismissed_${user.id}_${today.toISOString().split('T')[0]}`;
      if (localStorage.getItem(dismissKey) === 'true') {
        setIsDismissed(true);
        setIsLoading(false);
        return;
      }

      // Déterminer le niveau d'alerte
      let level: FatigueAlertLevel = null;
      if (total >= 10) {
        level = "critical";
      } else if (total >= 6) {
        level = "warning";
      }

      if (level) {
        setAlertData({
          level,
          sommeil: recentEntry.sommeil,
          stress: recentEntry.stress,
          total,
          date: recentEntry.date,
        });
      }
    } catch (error) {
      console.error("Error checking athlete fatigue alert:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const dismissAlert = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const today = new Date().toISOString().split('T')[0];
      const dismissKey = `fatigue_alert_dismissed_${user.id}_${today}`;
      localStorage.setItem(dismissKey, 'true');
    }
    setIsDismissed(true);
  };

  return {
    alertData: isDismissed ? null : alertData,
    isLoading,
    dismissAlert,
  };
}
