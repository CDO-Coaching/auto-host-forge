/**
 * NewRequestDialog — dialogue de création d'une demande (côté athlète).
 * Réutilisé par le panneau Messagerie et par le bouton contextuel d'une séance.
 * Charge le coach de l'athlète lui-même (découplé).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

export const REQUEST_CATEGORIES: { value: string; label: string; color: string }[] = [
  { value: "programmation", label: "Modifier ma prog", color: "#FFCF2E" },
  { value: "planning", label: "Décaler une séance", color: "#38bdf8" },
  { value: "question", label: "Question", color: "#a78bfa" },
  { value: "autre", label: "Autre", color: "#94a3b8" },
];
export const catMeta = (v: string) => REQUEST_CATEGORIES.find((c) => c.value === v) || REQUEST_CATEGORIES[3];

export function NewRequestDialog({
  open, onOpenChange, defaultCategory = "programmation", relatedSessionId, contextLabel, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultCategory?: string;
  relatedSessionId?: string;
  contextLabel?: string;      // ex. « Séance : Renfo haut du corps »
  onCreated?: () => void;
}) {
  const { user } = useAuth();
  const [coachId, setCoachId] = useState<string | null>(null);
  const [coachName, setCoachName] = useState("ton coach");
  const [category, setCategory] = useState(defaultCategory);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => { if (open) setCategory(defaultCategory); }, [open, defaultCategory]);

  useEffect(() => {
    if (!user || !open) return;
    (async () => {
      const { data: rel } = await supabase
        .from("coach_athlete_relationships")
        .select("coach_id").eq("athlete_id", user.id).eq("status", "approved").single();
      if (rel?.coach_id) {
        setCoachId(rel.coach_id);
        const { data: p } = await supabase.from("user_profiles").select("first_name, last_name").eq("id", rel.coach_id).single();
        if (p) setCoachName(`${p.first_name || ""} ${p.last_name || ""}`.trim() || "ton coach");
      }
    })();
  }, [user, open]);

  const submit = async () => {
    if (!content.trim() || !user || !coachId) return;
    setSending(true);
    // Max 3 demandes en cours (non traitées)
    const { count } = await supabase
      .from("athlete_requests")
      .select("id", { count: "exact", head: true })
      .eq("athlete_id", user.id).eq("status", "open");
    if ((count ?? 0) >= 3) {
      setSending(false);
      toast.error("Tu as déjà 3 demandes en cours. Attends qu'une soit traitée avant d'en envoyer une nouvelle.");
      return;
    }
    const { error } = await supabase.from("athlete_requests").insert({
      athlete_id: user.id, coach_id: coachId, category, content: content.trim(),
      related_session_id: relatedSessionId ?? null,
    });
    setSending(false);
    if (error) { console.error(error); toast.error("Envoi impossible"); return; }
    toast.success("Demande envoyée à " + coachName);
    setContent(""); onOpenChange(false); onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Faire une demande à {coachName}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          {contextLabel && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">{contextLabel}</p>
          )}
          <div>
            <p className="text-sm font-medium mb-2">Type de demande</p>
            <div className="flex flex-wrap gap-2">
              {REQUEST_CATEGORIES.map((c) => (
                <button key={c.value} type="button" onClick={() => setCategory(c.value)}
                  className={`px-3 h-8 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                    category === c.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}>
                  <span className="w-2 h-2 rounded-full" style={{ background: c.color }} /> {c.label}
                </button>
              ))}
            </div>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Décris ta demande (ex. « peux-tu décaler ma séance de jeudi à vendredi ? »)…"
            className="min-h-[110px] resize-y text-sm"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={!content.trim() || sending || !coachId} className="gap-1.5">
            {sending && <Loader2 className="h-4 w-4 animate-spin" />} Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
