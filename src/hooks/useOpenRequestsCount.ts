import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Nombre de demandes d'athlètes « à traiter » pour le coach connecté (temps réel). */
export function useOpenRequestsCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      const { count: c } = await supabase
        .from("athlete_requests")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", user.id)
        .eq("status", "open");
      if (active && typeof c === "number") setCount(c);
    };
    load();
    const ch = supabase
      .channel(`coach_requests_count_${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "athlete_requests", filter: `coach_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [user]);

  return count;
}
