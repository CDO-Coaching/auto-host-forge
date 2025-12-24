import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WeightReminderConfig {
  enabled: boolean;
  dayOfWeek: number; // 0 = dimanche, 1 = lundi, ..., 6 = samedi
  frequency: 1 | 2; // 1 = chaque semaine, 2 = toutes les 2 semaines
}

const DEFAULT_CONFIG: WeightReminderConfig = {
  enabled: false,
  dayOfWeek: 1, // Lundi par défaut
  frequency: 1,
};

export function useWeeklyWeightReminder() {
  const [shouldShowReminder, setShouldShowReminder] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [config, setConfig] = useState<WeightReminderConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    loadConfigAndCheckReminder();
  }, []);

  const loadConfigAndCheckReminder = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsChecking(false);
        return;
      }

      // Charger la configuration
      const savedConfig = localStorage.getItem(`weight_reminder_config_${user.id}`);
      let currentConfig = DEFAULT_CONFIG;
      
      if (savedConfig) {
        currentConfig = JSON.parse(savedConfig);
        setConfig(currentConfig);
      }

      // Si les rappels ne sont pas activés, ne rien faire
      if (!currentConfig.enabled) {
        setIsChecking(false);
        return;
      }

      // Vérifier si aujourd'hui est le jour configuré
      const today = new Date();
      const todayDayOfWeek = today.getDay();
      
      if (todayDayOfWeek !== currentConfig.dayOfWeek) {
        // Pas le bon jour
        setIsChecking(false);
        return;
      }

      // Vérifier la fréquence (toutes les 2 semaines)
      if (currentConfig.frequency === 2) {
        const weekNumber = getWeekNumber(today);
        // Afficher uniquement les semaines paires
        if (weekNumber % 2 !== 0) {
          setIsChecking(false);
          return;
        }
      }

      // Vérifier si déjà enregistré cette semaine
      const monday = getMondayOfWeek(today);
      
      const { data, error } = await supabase
        .from("weight_tracking")
        .select("recorded_at")
        .eq("user_id", user.id)
        .gte("recorded_at", monday.toISOString())
        .limit(1);

      if (error) {
        console.error("Error checking weight tracking:", error);
        setIsChecking(false);
        return;
      }

      // Si pas d'entrée cette semaine, vérifier si déjà affiché aujourd'hui
      if (!data || data.length === 0) {
        const lastShown = localStorage.getItem(`weight_reminder_shown_${user.id}`);
        const todayKey = today.toISOString().split('T')[0];
        
        if (lastShown !== todayKey) {
          setShouldShowReminder(true);
        }
      }
    } catch (error) {
      console.error("Error in loadConfigAndCheckReminder:", error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleDismiss = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const todayKey = new Date().toISOString().split('T')[0];
      localStorage.setItem(`weight_reminder_shown_${user.id}`, todayKey);
    }
    setShouldShowReminder(false);
  };

  const saveConfig = async (newConfig: WeightReminderConfig) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      localStorage.setItem(`weight_reminder_config_${user.id}`, JSON.stringify(newConfig));
      setConfig(newConfig);
    }
  };

  const loadConfig = async (): Promise<WeightReminderConfig> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const savedConfig = localStorage.getItem(`weight_reminder_config_${user.id}`);
      if (savedConfig) {
        return JSON.parse(savedConfig);
      }
    }
    return DEFAULT_CONFIG;
  };

  return { 
    shouldShowReminder, 
    isChecking, 
    handleDismiss, 
    config, 
    saveConfig, 
    loadConfig 
  };
}

// Fonction utilitaire pour obtenir le numéro de semaine
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Obtenir le lundi de la semaine
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setDate(d.getDate() - daysToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}
