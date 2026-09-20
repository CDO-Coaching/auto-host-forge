/**
 * AthleteRequestsMini — suivi compact des demandes de l'athlète, à afficher
 * dans la bulle de messagerie. Statut en temps réel (En attente / Vue / Traitée).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2, Clock, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { catMeta } from "@/components/NewRequestDialog";

interface Row {
  id: string; category: string; content: string; status: "open" | "done";
  seen_at: string | null; created_at: string;
}

export function AthleteRequestsMini() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("athlete_requests")
      .select("id, category, content, status, seen_at, created_at")
      .eq("athlete_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setRows((data as Row[]) || []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`mini_requests_${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "athlete_requests", filter: `athlete_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    /* eslint-disable-next-line */
  }, [user]);

  if (rows.length === 0) return null;
  const openCount = rows.filter((r) => r.status === "open").length;

  return (
    <div className="rounded-xl border border-border bg-muted/20 overflow-hidden shrink-0">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium">
        <span className="flex items-center gap-2">
          Mes demandes
          {openCount > 0 && <span className="text-[10px] font-bold text-primary-foreground bg-primary rounded-full px-1.5 py-0.5">{openCount} en cours</span>}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="max-h-40 overflow-y-auto px-2 pb-2 space-y-1.5">
          {rows.map((r) => {
            const m = catMeta(r.category);
            const done = r.status === "done";
            const seen = !done && !!r.seen_at;
            return (
              <div key={r.id} className="rounded-lg bg-background/60 border border-border/50 px-2.5 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1 shrink-0"
                    style={{ background: `${m.color}22`, color: m.color }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} /> {m.label}
                  </span>
                  <span className={`text-[10px] flex items-center gap-1 shrink-0 ${done ? "text-green-500" : seen ? "text-sky-400" : "text-muted-foreground"}`}>
                    {done ? <><CheckCircle2 className="h-3 w-3" /> Traitée</>
                      : seen ? <><Eye className="h-3 w-3" /> Vue</>
                      : <><Clock className="h-3 w-3" /> En attente</>}
                  </span>
                </div>
                <p className="text-xs mt-1 line-clamp-2 break-words text-muted-foreground">{r.content}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
