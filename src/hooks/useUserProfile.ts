import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  approved: boolean | null;
  role: string | null;
}

export const useUserProfile = () => {
  const { session, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!session) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let isCancelled = false;

    const loadProfile = async () => {
      setLoading(true);

      const { data } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!isCancelled) {
        setProfile((data as UserProfile) ?? null);
        setLoading(false);
      }
    };

    loadProfile();

    const channel = supabase
      .channel(`profile-changes-${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_profiles",
          filter: `id=eq.${session.user.id}`,
        },
        (payload) => {
          if (!isCancelled) {
            setProfile(payload.new as UserProfile);
          }
        }
      )
      .subscribe();

    return () => {
      isCancelled = true;
      supabase.removeChannel(channel);
    };
  }, [session?.user.id, authLoading]);

  return { profile, loading: loading || authLoading };
};
