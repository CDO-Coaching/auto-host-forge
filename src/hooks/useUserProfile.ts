import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  siret: string | null;
  phone: string | null;
}

export const useUserProfile = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error("Erreur récupération profil utilisateur:", error);
        setLoading(false);
        return;
      }

      if (data) {
        setProfile(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();

    const recoverOnVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void loadProfile();
      }
    };

    const recoverOnOnline = () => {
      void loadProfile();
    };

    const channel = supabase
      .channel("profile-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_profiles",
        },
        (payload) => {
          const next = payload.new as UserProfile;
          if (next?.id) {
            setProfile(next);
          }
        }
      )
      .subscribe();

    document.addEventListener("visibilitychange", recoverOnVisibility);
    window.addEventListener("online", recoverOnOnline);

    return () => {
      document.removeEventListener("visibilitychange", recoverOnVisibility);
      window.removeEventListener("online", recoverOnOnline);
      supabase.removeChannel(channel);
    };
  }, [loadProfile]);

  return { profile, loading };
};
