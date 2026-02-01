import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AthleteSubscriptionStatus {
  athleteId: string;
  hasActiveSubscription: boolean;
  hasCancelledRecently: boolean; // désabonné dans les 7 derniers jours
  hasNewPayment: boolean; // paiement non notifié
}

export function useAthleteSubscriptionStatus(coachId: string | undefined) {
  const [statuses, setStatuses] = useState<Map<string, AthleteSubscriptionStatus>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coachId) return;
    loadSubscriptionStatuses();
  }, [coachId]);

  const loadSubscriptionStatuses = async () => {
    if (!coachId) return;
    
    try {
      // Récupérer les athlètes du coach
      const { data: relationships, error: relError } = await supabase
        .from("coach_athlete_relationships")
        .select("athlete_id")
        .eq("coach_id", coachId)
        .in("status", ["approved", "paused"]);

      if (relError || !relationships?.length) {
        setLoading(false);
        return;
      }

      const athleteIds = relationships.map((r) => r.athlete_id);

      // Récupérer tous les abonnements de ces athlètes
      const { data: subscriptions, error: subError } = await supabase
        .from("athlete_subscriptions")
        .select("id, athlete_id, status, paid_at, cancelled_at, coach_notified, cancelled_notified")
        .in("athlete_id", athleteIds)
        .order("paid_at", { ascending: false });

      if (subError) {
        console.error("Error loading subscription statuses:", subError);
        setLoading(false);
        return;
      }

      const statusMap = new Map<string, AthleteSubscriptionStatus>();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      athleteIds.forEach((athleteId) => {
        const athleteSubs = subscriptions?.filter((s) => s.athlete_id === athleteId) || [];
        
        const hasActiveSubscription = athleteSubs.some((s) => s.status === "active");
        
        const hasCancelledRecently = athleteSubs.some((s) => {
          if (s.status !== "cancelled" || !s.cancelled_at) return false;
          return new Date(s.cancelled_at) >= sevenDaysAgo;
        });
        
        const hasNewPayment = athleteSubs.some((s) => 
          s.status === "active" && s.coach_notified === false
        );

        statusMap.set(athleteId, {
          athleteId,
          hasActiveSubscription,
          hasCancelledRecently,
          hasNewPayment,
        });
      });

      setStatuses(statusMap);
    } catch (error) {
      console.error("Error loading subscription statuses:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshStatuses = () => {
    loadSubscriptionStatuses();
  };

  return { statuses, loading, refreshStatuses };
}
