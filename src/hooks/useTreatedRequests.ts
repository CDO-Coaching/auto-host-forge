import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Compte les demandes de l'athlète récemment TRAITÉES qu'il n'a pas encore vues.
 * Le « vu » est mémorisé localement (localStorage) — pas de migration nécessaire.
 * markSeen() est appelé quand l'athlète ouvre la messagerie.
 */
const KEY = "seen_done_requests";

const readSeen = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return new Set(); }
};
const writeSeen = (s: Set<string>) => {
  try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch { /* ignore */ }
};

export function useTreatedRequests() {
  const { user } = useAuth();
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [count, setCount] = useState(0);

  const recompute = useCallback((ids: string[]) => {
    const seen = readSeen();
    setCount(ids.filter((id) => !seen.has(id)).length);
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    const { data } = await supabase
      .from("athlete_requests")
      .select("id")
      .eq("athlete_id", user.id).eq("status", "done")
      .gte("resolved_at", weekAgo);
    const ids = (data || []).map((r: any) => r.id as string);
    setDoneIds(ids);
    recompute(ids);
  }, [user, recompute]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`treated_requests_${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "athlete_requests", filter: `athlete_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  const markSeen = useCallback(() => {
    const seen = readSeen();
    doneIds.forEach((id) => seen.add(id));
    writeSeen(seen);
    setCount(0);
  }, [doneIds]);

  return { count, markSeen };
}
