/**
 * AthleteRequestPanel — « mode demande » côté athlète.
 * L'athlète crée une demande d'action (catégorie + texte) et suit son statut.
 * Le chat libre reste dans la Messagerie ; ici ce sont des tâches pour le coach.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, Plus, CheckCircle2, Clock, Eye } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { NewRequestDialog, catMeta } from "@/components/NewRequestDialog";

const SORA = { fontFamily: "'Sora', system-ui, sans-serif" } as const;

interface RequestRow {
  id: string; category: string; content: string; status: "open" | "done";
  created_at: string; resolved_at: string | null; seen_at: string | null;
}

export function AthleteRequestPanel({ coachId, coachName }: { coachId: string; coachName: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("athlete_requests")
      .select("id, category, content, status, created_at, resolved_at, seen_at")
      .eq("athlete_id", user.id)
      .order("created_at", { ascending: false });
    setRows((data as RequestRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`athlete_requests_${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "athlete_requests", filter: `athlete_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    /* eslint-disable-next-line */
  }, [user]);

  const weekAgo = Date.now() - 7 * 864e5;
  const openRows = rows.filter((r) => r.status === "open");
  // Les demandes traitées s'effacent au bout d'une semaine
  const doneRows = rows.filter((r) => r.status === "done" && r.resolved_at && new Date(r.resolved_at).getTime() >= weekAgo);

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold" style={SORA}>Mes demandes</h2>
          </div>
          <Button size="sm" className="gap-1.5 h-9" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Faire une demande
          </Button>
        </div>

        <NewRequestDialog open={open} onOpenChange={setOpen} onCreated={load} />

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune demande. Utilise « Faire une demande » pour une modif de prog, un décalage de séance…
          </p>
        ) : (
          <div className="space-y-2">
            {openRows.map((r) => <RequestLine key={r.id} r={r} />)}
            {doneRows.length > 0 && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 pt-2">Traitées</p>
                {doneRows.slice(0, 8).map((r) => <RequestLine key={r.id} r={r} />)}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RequestLine({ r }: { r: RequestRow }) {
  const m = catMeta(r.category);
  const done = r.status === "done";
  const seen = !done && !!r.seen_at;
  return (
    <div className={`rounded-xl border p-3 ${done ? "border-border/50 bg-muted/10 opacity-70" : "border-border bg-muted/20"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1.5"
          style={{ background: `${m.color}22`, color: m.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} /> {m.label}
        </span>
        <span className={`text-[11px] flex items-center gap-1 ${done ? "text-green-500" : seen ? "text-sky-400" : "text-muted-foreground"}`}>
          {done ? <><CheckCircle2 className="h-3.5 w-3.5" /> Traitée</>
            : seen ? <><Eye className="h-3.5 w-3.5" /> Vue par ton coach</>
            : <><Clock className="h-3.5 w-3.5" /> En attente</>}
        </span>
      </div>
      <p className="text-sm mt-1.5 whitespace-pre-wrap break-words">{r.content}</p>
      <p className="text-[10px] text-muted-foreground/60 mt-1">
        {format(parseISO(r.created_at), "d MMM yyyy · HH:mm", { locale: fr })}
      </p>
    </div>
  );
}
