import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CancellationNotification {
  id: string;
  athleteName: string;
  productName: string;
  cancelledAt: string;
  expiresAt: string | null;
}

export function useCoachCancellationNotifications(coachId: string | undefined) {
  const [pendingCancellations, setPendingCancellations] = useState<CancellationNotification[]>([]);

  useEffect(() => {
    if (!coachId) return;
    loadPendingCancellations();
  }, [coachId]);

  const loadPendingCancellations = async () => {
    if (!coachId) return;

    try {
      // Récupérer les athlètes du coach
      const { data: relationships, error: relError } = await supabase
        .from("coach_athlete_relationships")
        .select("athlete_id")
        .eq("coach_id", coachId)
        .in("status", ["approved", "paused"]);

      if (relError || !relationships?.length) return;

      const athleteIds = relationships.map((r) => r.athlete_id);

      // Récupérer les désabonnements non notifiés des dernières 24h
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: cancellations, error: cancelError } = await supabase
        .from("athlete_subscriptions")
        .select("id, athlete_id, product_name, cancelled_at, cancelled_notified, expires_at")
        .in("athlete_id", athleteIds)
        .eq("cancelled_notified", false)
        .eq("status", "cancelled")
        .not("cancelled_at", "is", null)
        .gte("cancelled_at", twentyFourHoursAgo)
        .order("cancelled_at", { ascending: false });

      if (cancelError || !cancellations?.length) return;

      // Récupérer les profils des athlètes
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name")
        .in("id", cancellations.map((c) => c.athlete_id));

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      const notifications: CancellationNotification[] = cancellations.map((c) => {
        const profile = profileMap.get(c.athlete_id);
        return {
          id: c.id,
          athleteName: profile
            ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
            : "Athlète",
          productName: c.product_name,
          cancelledAt: c.cancelled_at,
          expiresAt: c.expires_at,
        };
      });

      setPendingCancellations(notifications);
    } catch (error) {
      console.error("Error loading cancellation notifications:", error);
    }
  };

  const dismissCancellation = async (subscriptionId: string) => {
    try {
      await supabase
        .from("athlete_subscriptions")
        .update({ cancelled_notified: true })
        .eq("id", subscriptionId);

      setPendingCancellations((prev) =>
        prev.filter((n) => n.id !== subscriptionId)
      );
    } catch (error) {
      console.error("Error dismissing cancellation:", error);
    }
  };

  const dismissAllCancellations = async () => {
    try {
      const ids = pendingCancellations.map((n) => n.id);
      await supabase
        .from("athlete_subscriptions")
        .update({ cancelled_notified: true })
        .in("id", ids);

      setPendingCancellations([]);
    } catch (error) {
      console.error("Error dismissing all cancellations:", error);
    }
  };

  return { pendingCancellations, dismissCancellation, dismissAllCancellations };
}
