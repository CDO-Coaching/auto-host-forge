import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Target } from "lucide-react";

interface PendingByAthlete {
  athleteId: string;
  athleteName: string;
  count: number;
}

/**
 * Bandeau global côté coach : liste les sous-objectifs proposés par les
 * sportifs et en attente d'approbation, avec un lien vers chaque athlète.
 */
export function CoachPendingObjectivesBanner() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PendingByAthlete[]>([]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("objective_milestones")
      .select("id, athlete_id")
      .eq("coach_id", user.id)
      .eq("approval_status", "pending");
    if (!data || data.length === 0) { setItems([]); return; }

    const byAthlete: Record<string, number> = {};
    data.forEach((m: { athlete_id: string }) => { byAthlete[m.athlete_id] = (byAthlete[m.athlete_id] || 0) + 1; });
    const ids = Object.keys(byAthlete);

    const { data: profs } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name")
      .in("id", ids);

    const nameOf = (id: string) => {
      const p = profs?.find((x: { id: string }) => x.id === id) as { first_name?: string; last_name?: string } | undefined;
      const n = p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() : "";
      return n || "Athlète";
    };

    setItems(ids.map((id) => ({ athleteId: id, athleteName: nameOf(id), count: byAthlete[id] })));
  };

  if (items.length === 0) return null;
  const total = items.reduce((a, b) => a + b.count, 0);

  return (
    <Alert className="mb-4 sm:mb-6 border-amber-500 bg-amber-500/10">
      <Target className="h-5 w-5 text-amber-500" />
      <AlertTitle className="text-base font-semibold text-amber-600">
        {total} sous-objectif{total > 1 ? "s" : ""} proposé{total > 1 ? "s" : ""} à valider
      </AlertTitle>
      <AlertDescription className="mt-2 flex flex-wrap gap-2">
        {items.map((it) => (
          <Button key={it.athleteId} size="sm" variant="outline" onClick={() => navigate(`/coach/client/${it.athleteId}`)}>
            {it.athleteName} ({it.count})
          </Button>
        ))}
      </AlertDescription>
    </Alert>
  );
}
