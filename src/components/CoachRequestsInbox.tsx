/**
 * CoachRequestsInbox — « à traiter » : les demandes des athlètes.
 * Affiché en haut de Mes athlètes. Marquer traité (avec mot optionnel au client)
 * → la demande disparaît (conservée en historique, consultable + filtrable).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Inbox, Check, MessageCircle, Loader2, ChevronDown, ChevronUp, History } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { catMeta, REQUEST_CATEGORIES } from "@/components/NewRequestDialog";

const SORA = { fontFamily: "'Sora', system-ui, sans-serif" } as const;

interface Row {
  id: string; athlete_id: string; category: string; content: string;
  status: "open" | "done"; created_at: string; resolved_at: string | null;
  athlete?: { first_name: string | null; last_name: string | null };
}

export function CoachRequestsInbox() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  // Dialog « marquer traité »
  const [doneTarget, setDoneTarget] = useState<Row | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const namesFor = async (list: Row[]) => {
    const ids = [...new Set(list.map((r) => r.athlete_id))];
    if (!ids.length) return list;
    const { data: profs } = await supabase.from("user_profiles").select("id, first_name, last_name").in("id", ids);
    const map = new Map((profs || []).map((p: any) => [p.id, p]));
    list.forEach((r) => { r.athlete = map.get(r.athlete_id); });
    return list;
  };

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("athlete_requests")
      .select("id, athlete_id, category, content, status, created_at, resolved_at")
      .eq("coach_id", user.id).eq("status", "open")
      .order("created_at", { ascending: false });
    const list = await namesFor((data as Row[]) || []);
    setRows(list);
    setLoading(false);
  };

  // Accusé de lecture : uniquement quand le coach déplie la liste (clic sur la flèche)
  const markSeen = async () => {
    if (!user) return;
    await supabase.from("athlete_requests").update({ seen_at: new Date().toISOString() })
      .eq("coach_id", user.id).eq("status", "open").is("seen_at", null);
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (!next) markSeen(); // on vient d'ouvrir → marquer comme vues
      return next;
    });
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

  const confirmDone = async () => {
    if (!doneTarget || !user) return;
    setBusy(true);
    const { error } = await supabase.from("athlete_requests")
      .update({ status: "done", resolved_at: new Date().toISOString(), resolved_by: user.id })
      .eq("id", doneTarget.id);
    // Mot optionnel au client → message dans le chat
    if (!error && reply.trim()) {
      await supabase.from("messages").insert({
        sender_id: user.id, receiver_id: doneTarget.athlete_id,
        content: `✅ ${reply.trim()}`,
      });
    }
    setBusy(false);
    if (error) { console.error(error); toast.error("Action impossible"); return; }
    setRows((prev) => prev.filter((x) => x.id !== doneTarget.id));
    setDoneTarget(null); setReply("");
    toast.success("Demande traitée");
  };

  if (loading || rows.length === 0) {
    // Toujours donner accès à l'historique même sans demande ouverte
    return rows.length === 0 && !loading ? (
      <>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground" onClick={() => setShowHistory(true)}>
            <History className="h-3.5 w-3.5" /> Historique des demandes
          </Button>
        </div>
        <HistoryDialog open={showHistory} onOpenChange={setShowHistory} coachId={user?.id} namesFor={namesFor} onNavigate={(id) => navigate(`/coach/client/${id}`)} />
      </>
    ) : null;
  }

  return (
    <Card className="border-primary/40">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <button type="button" onClick={toggleCollapsed} className="flex items-center gap-2 text-base font-semibold" style={SORA}>
            <Inbox className="h-5 w-5 text-primary" />
            Demandes à traiter
            <span className="text-xs font-bold text-primary-foreground bg-primary rounded-full px-2 py-0.5">{rows.length}</span>
            {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
          </button>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground" onClick={() => setShowHistory(true)}>
            <History className="h-3.5 w-3.5" /> Historique
          </Button>
        </div>

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
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 flex-1" onClick={() => navigate(`/coach/client/${r.athlete_id}`)}>
                      <MessageCircle className="h-3.5 w-3.5" /> Voir l'athlète
                    </Button>
                    <Button size="sm" className="h-8 gap-1.5 flex-1" onClick={() => { setDoneTarget(r); setReply(""); }}>
                      <Check className="h-3.5 w-3.5" /> Marquer traité
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Dialog : marquer traité + mot optionnel */}
      <Dialog open={!!doneTarget} onOpenChange={(v) => { if (!v) { setDoneTarget(null); setReply(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Marquer la demande comme traitée</DialogTitle></DialogHeader>
          {doneTarget && <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">{doneTarget.content}</p>}
          <div className="space-y-1.5 py-1">
            <p className="text-sm font-medium">Mot au client <span className="text-muted-foreground font-normal">· optionnel, envoyé dans le chat</span></p>
            <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Ex. « C'est fait, séance décalée à vendredi »" className="h-10" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDoneTarget(null); setReply(""); }}>Annuler</Button>
            <Button onClick={confirmDone} disabled={busy} className="gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Valider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HistoryDialog open={showHistory} onOpenChange={setShowHistory} coachId={user?.id} namesFor={namesFor} onNavigate={(id) => navigate(`/coach/client/${id}`)} />
    </Card>
  );
}

// ── Historique (demandes traitées) avec filtre catégorie ─────────────────────
function HistoryDialog({
  open, onOpenChange, coachId, namesFor, onNavigate,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; coachId?: string;
  namesFor: (l: Row[]) => Promise<Row[]>; onNavigate: (athleteId: string) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [cat, setCat] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !coachId) return;
    setLoading(true);
    supabase.from("athlete_requests")
      .select("id, athlete_id, category, content, status, created_at, resolved_at")
      .eq("coach_id", coachId).eq("status", "done")
      .order("resolved_at", { ascending: false }).limit(100)
      .then(async ({ data }) => { setRows(await namesFor((data as Row[]) || [])); setLoading(false); });
  }, [open, coachId, namesFor]);

  const visible = cat === "all" ? rows : rows.filter((r) => r.category === cat);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Historique des demandes traitées</DialogTitle></DialogHeader>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setCat("all")}
            className={`px-3 h-7 rounded-full text-xs font-medium border ${cat === "all" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>Toutes</button>
          {REQUEST_CATEGORIES.map((c) => (
            <button key={c.value} type="button" onClick={() => setCat(c.value)}
              className={`px-3 h-7 rounded-full text-xs font-medium border flex items-center gap-1.5 ${cat === c.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} /> {c.label}
            </button>
          ))}
        </div>
        <div className="space-y-2 mt-1">
          {loading ? <p className="text-sm text-muted-foreground text-center py-6">Chargement…</p>
            : visible.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Aucune demande traitée.</p>
            : visible.map((r) => {
              const m = catMeta(r.category);
              const name = `${r.athlete?.first_name || ""} ${r.athlete?.last_name || ""}`.trim() || "Athlète";
              return (
                <button key={r.id} type="button" onClick={() => { onOpenChange(false); onNavigate(r.athlete_id); }}
                  className="w-full text-left rounded-xl border border-border/60 bg-muted/10 p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold" style={SORA}>{name}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1.5" style={{ background: `${m.color}22`, color: m.color }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} /> {m.label}
                    </span>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap break-words">{r.content}</p>
                  {r.resolved_at && <p className="text-[10px] text-muted-foreground/60 mt-1">Traitée le {format(parseISO(r.resolved_at), "d MMM yyyy · HH:mm", { locale: fr })}</p>}
                </button>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
