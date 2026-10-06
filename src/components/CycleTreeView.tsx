/**
 * CycleTreeView — « Vue d'ensemble » en arbre (TEST, additif, lecture seule).
 * Réutilise les données existantes : Objectif (macro) → Phases/mésocycles →
 * Semaines/microcycles (training_weeks) → Séances/entraînements (training_sessions).
 * Ne remplace rien : c'est une vue de synthèse visuelle à côté de Prog & Feuille de route.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfISOWeek, setISOWeek, setISOWeekYear } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Target, Layers } from "lucide-react";

const SORA = { fontFamily: "'Sora', system-ui, sans-serif" } as const;
const PHASE_COLORS = ["#e8c466", "#5aa9e6", "#9c7bd6", "#5fbf82", "#e8974a", "#e56464"];

interface Phase { id: string; name: string; start_date: string; end_date: string | null; color: string | null; }
interface Week { id: string; week_number: number; year: number; monday: Date; }
interface Sess { week_id: string; session_type: string | null; completed_at: string | null; skipped: boolean | null; }

const D = (s: string) => new Date(/[T ]/.test(s) ? s : s + "T00:00:00");
const weekMonday = (year: number, wn: number) => startOfISOWeek(setISOWeek(setISOWeekYear(new Date(), year), wn));

const sessColor = (t: string | null): string => {
  const x = (t || "").toLowerCase();
  if (x === "renfo") return "#e8c466";
  if (x === "course" || x === "velo" || x === "natation" || x === "cardio" || x === "triathlon") return "#5aa9e6";
  if (x === "recup" || x === "récup" || x === "recuperation") return "#5fbf82";
  return "#9c7bd6";
};

export function CycleTreeView({ athleteId }: { athleteId: string }) {
  const [objName, setObjName] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [sessions, setSessions] = useState<Sess[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: objRows }, { data: mes }, { data: wk }] = await Promise.all([
        supabase.from("athlete_objectives").select("main_objective, main_objective_deadline").eq("athlete_id", athleteId).order("updated_at", { ascending: false }).limit(1),
        supabase.from("mesocycles").select("id, name, start_date, end_date, color, macrocycle_id").eq("athlete_id", athleteId).is("macrocycle_id", null),
        supabase.from("training_weeks").select("id, week_number, year").eq("athlete_id", athleteId),
      ]);
      setObjName(objRows?.[0]?.main_objective || null);
      setDeadline(objRows?.[0]?.main_objective_deadline || null);
      setPhases((((mes || []) as any[]).filter((m) => m.start_date)).map((m) => ({ id: m.id, name: m.name, start_date: m.start_date, end_date: m.end_date, color: m.color })));
      const wkList: Week[] = ((wk || []) as any[]).map((w) => ({ id: w.id, week_number: w.week_number, year: w.year, monday: weekMonday(w.year, w.week_number) }));
      setWeeks(wkList);
      if (wkList.length) {
        const { data: ss } = await supabase.from("training_sessions").select("week_id, session_type, completed_at, skipped").in("week_id", wkList.map((w) => w.id));
        setSessions((ss || []) as Sess[]);
      }
      setLoading(false);
    })();
  }, [athleteId]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const endOf = (p: Phase) => (p.end_date ? D(p.end_date) : addDaysLocal(D(p.start_date), 14));

  const sessByWeek = useMemo(() => {
    const m = new Map<string, Sess[]>();
    sessions.forEach((s) => { const a = m.get(s.week_id) || []; a.push(s); m.set(s.week_id, a); });
    return m;
  }, [sessions]);

  const orderedPhases = useMemo(() => [...phases].sort((a, b) => D(a.start_date).getTime() - D(b.start_date).getTime()), [phases]);

  // Regroupe les semaines par phase (selon le lundi de la semaine)
  const grouped = useMemo(() => {
    const used = new Set<string>();
    const byPhase = orderedPhases.map((p, i) => {
      const s = D(p.start_date).getTime(); const e = endOf(p).getTime() + 7 * 86400000;
      const ws = weeks.filter((w) => w.monday.getTime() >= s - 3 * 86400000 && w.monday.getTime() < e).sort((a, b) => a.monday.getTime() - b.monday.getTime());
      ws.forEach((w) => used.add(w.id));
      return { phase: p, idx: i, weeks: ws };
    });
    const orphans = weeks.filter((w) => !used.has(w.id)).sort((a, b) => a.monday.getTime() - b.monday.getTime());
    return { byPhase, orphans };
  }, [orderedPhases, weeks]);

  const phaseStatus = (p: Phase): "past" | "current" | "future" => {
    const s = D(p.start_date); const e = p.end_date ? D(p.end_date) : null;
    if (e && e < today) return "past";
    if (s <= today && (!e || e >= today)) return "current";
    return "future";
  };

  if (loading) return <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>;

  const totalWeeks = weeks.length;
  const dl = deadline ? D(deadline) : null;

  const WeekCard = ({ w }: { w: Week }) => {
    const ss = sessByWeek.get(w.id) || [];
    const done = ss.filter((s) => s.completed_at).length;
    const isCurrent = (() => { const start = w.monday.getTime(); const end = start + 7 * 86400000; return today.getTime() >= start && today.getTime() < end; })();
    const isPast = w.monday.getTime() + 7 * 86400000 <= today.getTime();
    return (
      <div className={cn("flex-1 min-w-0 rounded-lg border px-0.5 py-2 text-center flex flex-col", isCurrent ? "border-primary bg-primary/10" : isPast ? "border-border/50 bg-muted/10 opacity-60" : "border-border/50 bg-card/40")}
        title={`S${w.week_number} · ${format(w.monday, "d MMM yyyy", { locale: fr })} · ${done}/${ss.length} faites`}>
        <p className="text-[10px] font-bold leading-none truncate" style={SORA}>S{w.week_number}</p>
        <div className="flex items-end justify-center gap-[2px] flex-1 min-h-[64px] my-1.5">
          {ss.length === 0 ? (
            <span className="text-[9px] text-muted-foreground/40 self-center">—</span>
          ) : ss.slice(0, 7).map((s, i) => {
            const c = sessColor(s.session_type);
            const d = !!s.completed_at;
            return <span key={i} className="w-[4px] rounded-full" style={{ height: "100%", background: d ? c : "transparent", border: `1.5px solid ${c}`, opacity: s.skipped ? 0.4 : 1 }} />;
          })}
        </div>
        {ss.length > 0 && <p className="text-[9px] text-muted-foreground leading-none">{done}/{ss.length}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="px-2 py-0.5 rounded-full bg-muted border border-border">Vue en test</span>
        <span>Objectif → Phases → Semaines → Séances · lecture seule</span>
      </div>

      {/* ── MACROCYCLE ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-5 text-center text-black shadow-lg" style={{ background: "linear-gradient(90deg,#c79a3a,#e8c466)" }}>
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] opacity-70">Macrocycle</p>
        <h2 className="text-2xl font-black leading-tight" style={SORA}>{objName || "Objectif non défini"}</h2>
        <p className="text-sm font-semibold mt-0.5">
          {dl ? `Échéance : ${format(dl, "d MMMM yyyy", { locale: fr })}` : "Sans échéance"}
          {totalWeeks > 0 ? ` · ${totalWeeks} semaine${totalWeeks > 1 ? "s" : ""}` : ""}
        </p>
      </div>

      {/* ── MÉSOCYCLES (phases) + MICROCYCLES (semaines) + ENTRAÎNEMENTS ──── */}
      {orderedPhases.length === 0 && grouped.orphans.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">Aucune phase ni semaine pour l'instant.</p>
      )}

      {/* Mésocycles proportionnels qui REMPLISSENT la largeur de l'écran */}
      <div className="flex gap-1.5 items-stretch">
        {grouped.byPhase.map(({ phase, idx, weeks: ws }) => {
          const col = phase.color || PHASE_COLORS[idx % PHASE_COLORS.length];
          const st = phaseStatus(phase);
          return (
            <div key={phase.id} className="rounded-xl border border-border/50 overflow-hidden flex flex-col" style={{ flex: `${Math.max(1, ws.length)} 1 0`, minWidth: 0 }}>
              {/* Bande mésocycle */}
              <div className="px-2 py-1.5 text-black min-h-[46px] flex flex-col justify-center" style={{ background: col }}>
                <div className="flex items-center gap-1">
                  <span className="font-black text-[11px] uppercase tracking-tight truncate" style={SORA} title={phase.name}>{phase.name || "Phase"}</span>
                  <span className="text-[8px] font-bold px-1 py-0.5 rounded-full bg-black/15 shrink-0 whitespace-nowrap">
                    {st === "current" ? "EN COURS" : st === "past" ? "PASSÉ" : "À VENIR"}
                  </span>
                </div>
                <span className="text-[9px] font-semibold opacity-80 truncate">
                  {format(D(phase.start_date), "d MMM", { locale: fr })}{phase.end_date ? ` → ${format(D(phase.end_date), "d MMM", { locale: fr })}` : ""} · {ws.length} sem.
                </span>
              </div>
              {/* Semaines qui remplissent la largeur de la phase */}
              <div className="p-1.5 flex gap-1 bg-card/30 flex-1 items-stretch">
                {ws.length === 0 ? (
                  <span className="text-[9px] text-muted-foreground/40 self-center w-full text-center">vide</span>
                ) : ws.map((w) => <WeekCard key={w.id} w={w} />)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Semaines hors phase — rangée dédiée pleine largeur */}
      {grouped.orphans.length > 0 && (
        <div className="rounded-xl border border-dashed border-border/50 overflow-hidden">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground bg-muted/20">Semaines hors phase ({grouped.orphans.length})</div>
          <div className="p-1.5 flex gap-1 flex-wrap">
            {grouped.orphans.map((w) => <div key={w.id} className="w-[48px]"><WeekCard w={w} /></div>)}
          </div>
        </div>
      )}

      {/* Légende */}
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <Legend color="#e8c466" label="Renfo" />
        <Legend color="#5aa9e6" label="Cardio" />
        <Legend color="#5fbf82" label="Récup" />
        <span className="flex items-center gap-1"><span className="w-[6px] h-3 rounded-full bg-muted-foreground" /> faite</span>
        <span className="flex items-center gap-1"><span className="w-[6px] h-3 rounded-full border border-muted-foreground" /> à faire</span>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} /> {label}</span>;
}

function addDaysLocal(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
