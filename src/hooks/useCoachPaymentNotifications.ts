import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PaymentNotification {
  id: string;
  athleteName: string;
  productName: string;
  paidAt: string;
}

export function useCoachPaymentNotifications(coachId: string | undefined) {
  const [pendingNotifications, setPendingNotifications] = useState<PaymentNotification[]>([]);

  useEffect(() => {
    if (!coachId) return;
    loadPendingNotifications();
  }, [coachId]);

  const loadPendingNotifications = async () => {
    if (!coachId) return;

    try {
      // Récupérer les athlètes du coach
      const { data: relationships, error: relError } = await supabase
        .from("coach_athlete_relationships")
        .select("athlete_id")
        .eq("coach_id", coachId)
        .eq("status", "approved");

      if (relError || !relationships?.length) return;

      const athleteIds = relationships.map((r) => r.athlete_id);

      // Récupérer les paiements non notifiés des dernières 24h
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: payments, error: payError } = await supabase
        .from("athlete_subscriptions")
        .select("id, athlete_id, product_name, paid_at, coach_notified")
        .in("athlete_id", athleteIds)
        .eq("coach_notified", false)
        .eq("status", "active")
        .gte("paid_at", twentyFourHoursAgo)
        .order("paid_at", { ascending: false });

      if (payError || !payments?.length) return;

      // Récupérer les profils des athlètes
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name")
        .in("id", payments.map((p) => p.athlete_id));

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      const notifications: PaymentNotification[] = payments.map((p) => {
        const profile = profileMap.get(p.athlete_id);
        return {
          id: p.id,
          athleteName: profile
            ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
            : "Athlète",
          productName: p.product_name,
          paidAt: p.paid_at,
        };
      });

      setPendingNotifications(notifications);
    } catch (error) {
      console.error("Error loading payment notifications:", error);
    }
  };

  const dismissNotification = async (paymentId: string) => {
    try {
      await supabase
        .from("athlete_subscriptions")
        .update({ coach_notified: true })
        .eq("id", paymentId);

      setPendingNotifications((prev) =>
        prev.filter((n) => n.id !== paymentId)
      );
    } catch (error) {
      console.error("Error dismissing notification:", error);
    }
  };

  const dismissAll = async () => {
    try {
      const ids = pendingNotifications.map((n) => n.id);
      await supabase
        .from("athlete_subscriptions")
        .update({ coach_notified: true })
        .in("id", ids);

      setPendingNotifications([]);
    } catch (error) {
      console.error("Error dismissing all notifications:", error);
    }
  };

  return { pendingNotifications, dismissNotification, dismissAll };
}
