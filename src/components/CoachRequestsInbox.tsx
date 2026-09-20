/**
 * CoachRequestsInbox — « à traiter » : les demandes des athlètes.
 * Affiché en haut de Mes athlètes. Chaque demande ouverte peut être ouverte en
 * discussion ou marquée traitée → elle disparaît (conservée en historique).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Inbox, Check, MessageCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { catMeta } from "@/components/AthleteRequestPanel";

const SORA = { fontFamily: "'Sora', system-ui, sans-serif" } as const;

interface Row {
  id: string; athlete_id: string; category: string; content: string;
  status: "open" | "done"; created_at: string;
  athlete?: { first_name: string | null; last_name: string | null };
}

export function CoachRequestsInbox() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("athlete_requests")
      .select("id, athlete_id, category, content, status, created_at")
      .eq("coach_id", user.id)
      .eq("status", "open")
      .order("created_at", { ascending: false });
    const list = (data as Row[]) || [];
    // noms des athlètes
    const ids = [...new Set(list.map((r) => r.athlete_id))];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("user_profiles").select("id, first_name, last_name").in("id", ids);
      const map = new Map((profs || []).map((p: any) => [p.id, p]));
      list.forEach((r) => { r.athlete = map.get(r.athlete_id); });
    }
    setRows(list);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`coach_requests_${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "athlete_requests", filter: `coach_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    /* eslint-disable-next-line */
  }, [user]);

  const markDone = async (r: Row) => {
    setBusy(r.id);
    const { error } = await supabase
      .from("athlete_requests")
      .update({ status: "done", resolved_at: new Date().toISOString(), resolved_by: user!.id })
      .eq("id", r.id);
    setBusy(null);
    if (error) { console.error(error); toast.error("Action impossible"); return; }
    setRows((prev) => prev.filter((x) => x.id !== r.id));
    toast.success("Demande traitée");
  };

  if (loading || rows.length === 0) return null;

  return (
    <Card className="border-primary/40">
      <CardContent className="pt-4 pb-3">
        <button type="button" onClick={() => setCollapsed((v) => !v)}
          className="w-full flex items-center justify-between gap-2 mb-2">
          <span className="flex items-center gap-2 text-base font-semibold" style={SORA}>
            <Inbox className="h-5 w-5 text-primary" />
            Demandes à traiter
            <span className="text-xs font-bold text-primary-foreground bg-primary rounded-full px-2 py-0.5">{rows.length}</span>
          </span>
          {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
        </button>

        {!collapsed && (
          <div className="space-y-2">
            {rows.map((r) => {
              const m = catMeta(r.category);
              const name = `${r.athlete?.first_name || ""} ${r.athlete?.last_name || ""}`.trim() || "Athlète";
              return (
                <div key={r.id} className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold truncate" style={SORA}>{name}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 flex items-center gap-1.5"
                        style={{ background: `${m.color}22`, color: m.color }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} /> {m.label}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">
                      {format(parseISO(r.created_at), "d MMM · HH:mm", { locale: fr })}
                    </span>
                  </div>
                  <p className="text-sm mt-1.5 whitespace-pre-wrap break-words">{r.content}</p>
                  <div className="flex items-center gap-2 mt-2.5">
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 flex-1"
                      onClick={() => navigate(`/coach/client/${r.athlete_id}`)}>
                      <MessageCircle className="h-3.5 w-3.5" /> Voir l'athlète
                    </Button>
                    <Button size="sm" className="h-8 gap-1.5 flex-1" disabled={busy === r.id}
                      onClick={() => markDone(r)}>
                      {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Marquer traité
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
