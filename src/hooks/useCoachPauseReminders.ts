import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PauseReminder {
  relationshipId: string;
  athleteId: string;
  athleteName: string;
  reminderDate: string;
}

export function useCoachPauseReminders(coachId: string | undefined) {
  const [reminders, setReminders] = useState<PauseReminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coachId) {
      setLoading(false);
      return;
    }

    const checkReminders = async () => {
      const today = new Date().toISOString().split("T")[0];

      // Get paused relationships with reminder_date = today
      const { data: relationships, error } = await supabase
        .from("coach_athlete_relationships")
        .select("id, athlete_id, reminder_date")
        .eq("coach_id", coachId)
        .eq("status", "paused")
        .eq("reminder_date", today);

      if (error) {
        console.error("Error fetching pause reminders:", error);
        setLoading(false);
        return;
      }

      if (!relationships || relationships.length === 0) {
        setReminders([]);
        setLoading(false);
        return;
      }

      // Get athlete profiles
      const athleteIds = relationships.map((r) => r.athlete_id);
      const { data: athletes } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name")
        .in("id", athleteIds);

      const athleteMap = new Map(
        athletes?.map((a) => [a.id, `${a.first_name || ""} ${a.last_name || ""}`.trim()]) || []
      );

      // Check which reminders have already been dismissed today
      const dismissedKey = `dismissed_pause_reminders_${today}`;
      const dismissedIds = JSON.parse(localStorage.getItem(dismissedKey) || "[]");

      const activeReminders = relationships
        .filter((r) => !dismissedIds.includes(r.id))
        .map((r) => ({
          relationshipId: r.id,
          athleteId: r.athlete_id,
          athleteName: athleteMap.get(r.athlete_id) || "Athlète",
          reminderDate: r.reminder_date,
        }));

      setReminders(activeReminders);
      setLoading(false);
    };

    checkReminders();
  }, [coachId]);

  const dismissReminder = (relationshipId: string) => {
    const today = new Date().toISOString().split("T")[0];
    const dismissedKey = `dismissed_pause_reminders_${today}`;
    const dismissedIds = JSON.parse(localStorage.getItem(dismissedKey) || "[]");
    
    if (!dismissedIds.includes(relationshipId)) {
      dismissedIds.push(relationshipId);
      localStorage.setItem(dismissedKey, JSON.stringify(dismissedIds));
    }

    setReminders((prev) => prev.filter((r) => r.relationshipId !== relationshipId));
  };

  return { reminders, loading, dismissReminder };
}
