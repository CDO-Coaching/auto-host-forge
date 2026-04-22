import { useEffect, useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CoachSfmsRequestToggleProps {
  athleteId: string;
  athleteName: string;
}

interface PendingRequest {
  id: string;
  requested_at: string;
}

export function CoachSfmsRequestToggle({ athleteId, athleteName }: CoachSfmsRequestToggleProps) {
  const { toast } = useToast();
  const [coachId, setCoachId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id ?? null;
      if (!active) return;
      setCoachId(uid);
      if (!uid) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("sfms_questionnaire_requests")
        .select("id, requested_at")
        .eq("coach_id", uid)
        .eq("athlete_id", athleteId)
        .eq("status", "pending")
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!active) return;
      if (!error && data) setPending(data as PendingRequest);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [athleteId]);

  const handleToggle = async (checked: boolean) => {
    if (!coachId || updating) return;
    setUpdating(true);
    try {
      if (checked) {
        // Créer une demande
        const { data, error } = await supabase
          .from("sfms_questionnaire_requests")
          .insert({
            coach_id: coachId,
            athlete_id: athleteId,
            status: "pending",
          })
          .select("id, requested_at")
          .single();
        if (error) throw error;
        setPending(data as PendingRequest);
        toast({
          title: "Demande envoyée",
          description: `${athleteName} verra une invitation à remplir le questionnaire à sa prochaine connexion.`,
        });
      } else if (pending) {
        // Annuler la demande
        const { error } = await supabase
          .from("sfms_questionnaire_requests")
          .update({ status: "cancelled" })
          .eq("id", pending.id);
        if (error) throw error;
        setPending(null);
        toast({
          title: "Demande annulée",
          description: "L'athlète ne verra plus l'invitation.",
        });
      }
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message || "Action impossible.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex items-start sm:items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
      <div className="flex items-start gap-3 min-w-0">
        <ClipboardList className="h-5 w-5 mt-0.5 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="font-medium text-sm">
            Demander le questionnaire de surentraînement
          </p>
          <p className="text-xs text-muted-foreground">
            {pending
              ? "Demande active — l'athlète sera invité à le remplir à sa prochaine connexion."
              : "Active pour qu'il soit demandé à l'athlète à sa prochaine connexion."}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {(loading || updating) && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
        <Switch
          checked={!!pending}
          onCheckedChange={handleToggle}
          disabled={loading || updating || !coachId}
          aria-label="Demander le questionnaire de surentraînement"
        />
      </div>
    </div>
  );
}
