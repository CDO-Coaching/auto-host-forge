import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FatigueAlertLevel = "warning" | "critical" | "recovery" | null;

interface FatigueAlertData {
  level: FatigueAlertLevel;
  sommeil: number;
  stress: number;
  total: number;
  date: string;
  // Données d'hier si on est en mode "recovery"
  yesterdaySommeil?: number;
  yesterdayStress?: number;
  yesterdayTotal?: number;
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

      // Vérifier si les alertes sont activées
      const alertPreference = localStorage.getItem(`fatigue_alert_${user.id}`);
      if (alertPreference === 'false') {
        setIsLoading(false);
        return;
      }

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // Récupérer les données d'aujourd'hui ET d'hier
      const { data, error } = await supabase
        .from("daily_fatigue_log")
        .select("sommeil, stress, date")
        .eq("user_id", user.id)
        .gte("date", yesterdayStr)
        .lt("date", tomorrow.toISOString().split('T')[0])
        .order("date", { ascending: false });

      if (error || !data || data.length === 0) {
        setIsLoading(false);
        return;
      }

      // Vérifier si l'alerte a déjà été vue aujourd'hui
      const dismissKey = `fatigue_alert_dismissed_${user.id}_${todayStr}`;
      if (localStorage.getItem(dismissKey) === 'true') {
        setIsDismissed(true);
        setIsLoading(false);
        return;
      }

      // Séparer les données d'aujourd'hui et d'hier
      const todayEntry = data.find(d => d.date === todayStr);
      const yesterdayEntry = data.find(d => d.date === yesterdayStr);

      const todayTotal = todayEntry ? todayEntry.sommeil + todayEntry.stress : null;
      const yesterdayTotal = yesterdayEntry ? yesterdayEntry.sommeil + yesterdayEntry.stress : null;

      let level: FatigueAlertLevel = null;

      // Cas 1: Aujourd'hui est rempli et élevé
      if (todayTotal !== null && todayTotal >= 6) {
        level = todayTotal >= 10 ? "critical" : "warning";
        setAlertData({
          level,
          sommeil: todayEntry!.sommeil,
          stress: todayEntry!.stress,
          total: todayTotal,
          date: todayStr,
        });
      }
      // Cas 2: Aujourd'hui est bon MAIS hier était élevé → mode "recovery"
      else if (todayTotal !== null && todayTotal < 6 && yesterdayTotal !== null && yesterdayTotal >= 6) {
        setAlertData({
          level: "recovery",
          sommeil: todayEntry!.sommeil,
          stress: todayEntry!.stress,
          total: todayTotal,
          date: todayStr,
          yesterdaySommeil: yesterdayEntry!.sommeil,
          yesterdayStress: yesterdayEntry!.stress,
          yesterdayTotal: yesterdayTotal,
        });
      }
      // Cas 3: Pas de données aujourd'hui, mais hier était élevé
      else if (todayTotal === null && yesterdayTotal !== null && yesterdayTotal >= 6) {
        level = yesterdayTotal >= 10 ? "critical" : "warning";
        setAlertData({
          level,
          sommeil: yesterdayEntry!.sommeil,
          stress: yesterdayEntry!.stress,
          total: yesterdayTotal,
          date: yesterdayStr,
        });
      }
      // Sinon pas d'alerte
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
