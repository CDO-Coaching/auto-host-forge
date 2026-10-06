/**
 * CycleTreeView — « Vue d'ensemble » en arbre (TEST, additif, lecture seule).
 * Réutilise les données existantes : Objectif (macro) → Phases/mésocycles →
 * Semaines/microcycles (training_weeks) → Séances/entraînements (training_sessions).
 * Ne remplace rien : c'est une vue de synthèse visuelle à côté de Prog & Feuille de route.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfISOWeek, setISOWeek, setISOWeekYear, differenceInCalendarDays, addWeeks, addMonths, differenceInMonths, differenceInWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Layers, Pencil, Trash2, CalendarDays, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

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

interface Macro { id: string; name: string; start_date: string; end_date: string | null; }

export function CycleTreeView({ athleteId }: { athleteId: string }) {
  const [objName, setObjName] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [macro, setMacro] = useState<Macro | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [sessions, setSessions] = useState<Sess[]>([]);
  const [loading, setLoading] = useState(true);
  const [macroDlg, setMacroDlg] = useState<null | { id?: string; name: string; start: Date; end: Date | null }>(null);
  const [busy, setBusy] = useState(false);

  const loadAll = async () => {
      const [{ data: objRows }, { data: macroRows }, { data: wk }] = await Promise.all([
        supabase.from("athlete_objectives").select("main_objective, main_objective_deadline").eq("athlete_id", athleteId).order("updated_at", { ascending: false }).limit(1),
        supabase.from("macrocycles").select("id, name, start_date, end_date").eq("athlete_id", athleteId).order("start_date", { ascending: false }).limit(1),
        supabase.from("training_weeks").select("id, week_number, year").eq("athlete_id", athleteId),
      ]);
      setObjName(objRows?.[0]?.main_objective || null);
      setDeadline(objRows?.[0]?.main_objective_deadline || null);
      const mac = (macroRows?.[0] as any) || null;
      setMacro(mac);
      // Le tree ne montre que les mésocycles RATTACHÉS au macro courant → un nouveau macro = vierge
      let mes: any[] = [];
      if (mac) {
        const { data } = await supabase.from("mesocycles").select("id, name, start_date, end_date, color, macrocycle_id").eq("athlete_id", athleteId).eq("macrocycle_id", mac.id);
        mes = data || [];
      }
      setPhases(((mes as any[]).filter((m) => m.start_date)).map((m) => ({ id: m.id, name: m.name, start_date: m.start_date, end_date: m.end_date, color: m.color })));
      let wkList: Week[] = ((wk || []) as any[]).map((w) => ({ id: w.id, week_number: w.week_number, year: w.year, monday: weekMonday(w.year, w.week_number) }));
      // On ne garde que les semaines DANS la période du macro (sinon vierge)
      if (mac) {
        const ms = D(mac.start_date).getTime() - 6 * 86400000;
        const me = (mac.end_date ? D(mac.end_date).getTime() : ms + 365 * 86400000) + 6 * 86400000;
        wkList = wkList.filter((w) => w.monday.getTime() >= ms && w.monday.getTime() <= me);
      } else {
        wkList = [];
      }
      setWeeks(wkList);
      if (wkList.length) {
        const { data: ss } = await supabase.from("training_sessions").select("week_id, session_type, completed_at, skipped").in("week_id", wkList.map((w) => w.id));
        setSessions((ss || []) as Sess[]);
      }
      setLoading(false);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [athleteId]);

  // Format détaillé « 3 mois · 2 sem · 4 j »
  const fmtDuration = (from: Date, to: Date): string => {
    const totalDays = Math.max(0, differenceInCalendarDays(to, from));
    if (totalDays <= 28) {
      const w = Math.floor(totalDays / 7); const d = totalDays % 7;
      return [w ? `${w} sem.` : "", d ? `${d} j` : ""].filter(Boolean).join(" · ") || "0 j";
    }
    const months = differenceInMonths(to, from);
    const afterMonths = addMonths(from, months);
    const remDays = Math.max(0, differenceInCalendarDays(to, afterMonths));
    const weeks = Math.floor(remDays / 7); const days = remDays % 7;
    return [months ? `${months} mois` : "", weeks ? `${weeks} sem.` : "", days ? `${days} j` : ""].filter(Boolean).join(" · ") || "0 j";
  };

  const openMacro = () => {
    if (macro) setMacroDlg({ id: macro.id, name: macro.name, start: D(macro.start_date), end: macro.end_date ? D(macro.end_date) : null });
    else setMacroDlg({ name: "", start: new Date(new Date().setHours(0, 0, 0, 0)), end: null });
  };

  const saveMacro = async () => {
    if (!macroDlg || !macroDlg.name.trim()) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        name: macroDlg.name.trim(),
        start_date: format(macroDlg.start, "yyyy-MM-dd"),
        end_date: macroDlg.end ? format(macroDlg.end, "yyyy-MM-dd") : null,
        updated_at: new Date().toISOString(),
      };
      if (macroDlg.id) await supabase.from("macrocycles").update(payload).eq("id", macroDlg.id);
      else await supabase.from("macrocycles").insert({ ...payload, athlete_id: athleteId, coach_id: user?.id, color: "#c79a3a" });
      setMacroDlg(null); toast.success("Macrocycle enregistré"); loadAll();
    } catch (e) { console.error(e); toast.error("Enregistrement impossible"); }
    finally { setBusy(false); }
  };

  const deleteMacro = async () => {
    if (!macro) return;
    await supabase.from("macrocycles").delete().eq("id", macro.id);
    setMacroDlg(null); loadAll();
  };

  // ── Mésocycles sous le macro (étape 2) ─────────────────────────────────────
  const [mesoDlg, setMesoDlg] = useState<null | { id?: string; name: string; weeks: number }>(null);
  const openNewMeso = () => setMesoDlg({ name: "", weeks: 4 });
  const openEditMeso = (p: Phase) => setMesoDlg({ id: p.id, name: p.name, weeks: p.end_date ? Math.max(1, Math.round((differenceInCalendarDays(D(p.end_date), D(p.start_date)) + 1) / 7)) : 4 });

  const saveMeso = async () => {
    if (!mesoDlg || !mesoDlg.name.trim() || !macro) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ordered = [...phases].sort((a, b) => D(a.start_date).getTime() - D(b.start_date).getTime());
      if (mesoDlg.id) {
        const p = phases.find((x) => x.id === mesoDlg.id)!;
        const start = D(p.start_date);
        const end = addDaysLocal(addWeeks(start, mesoDlg.weeks), -1);
        await supabase.from("mesocycles").update({ name: mesoDlg.name.trim(), end_date: format(end, "yyyy-MM-dd"), updated_at: new Date().toISOString() }).eq("id", p.id);
      } else {
        const last = ordered[ordered.length - 1];
        const start = last?.end_date ? addDaysLocal(D(last.end_date), 1) : D(macro.start_date);
        const end = addDaysLocal(addWeeks(start, mesoDlg.weeks), -1);
        await supabase.from("mesocycles").insert({
          athlete_id: athleteId, coach_id: user?.id, macrocycle_id: macro.id,
          name: mesoDlg.name.trim(), phase_type: "custom", color: PHASE_COLORS[phases.length % PHASE_COLORS.length],
          start_date: format(start, "yyyy-MM-dd"), end_date: format(end, "yyyy-MM-dd"),
          volume_target: 3, intensity_target: 3, updated_at: new Date().toISOString(),
        });
      }
      setMesoDlg(null); toast.success("Mésocycle enregistré"); loadAll();
    } catch (e) { console.error(e); toast.error("Enregistrement impossible"); }
    finally { setBusy(false); }
  };

  const deleteMeso = async (id: string) => {
    await supabase.from("mesocycles").delete().eq("id", id);
    setMesoDlg(null); loadAll();
  };

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

      {/* ── MACROCYCLE (cliquable : créer / éditer) ──────────────────────── */}
      <button type="button" onClick={openMacro} className="group w-full rounded-2xl p-5 text-center text-black shadow-lg relative active:scale-[0.998] transition-transform" style={{ background: "linear-gradient(90deg,#c79a3a,#e8c466)" }}>
        <span className="absolute top-3 right-3 opacity-50 group-hover:opacity-100 transition-opacity">
          <Pencil className="h-4 w-4" />
        </span>
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] opacity-70">Macrocycle</p>
        {macro ? (
          <>
            <h2 className="text-2xl font-black leading-tight" style={SORA}>{macro.name}</h2>
            <p className="text-sm font-semibold mt-0.5">
              {format(D(macro.start_date), "d MMM yyyy", { locale: fr })}
              {macro.end_date ? ` → ${format(D(macro.end_date), "d MMM yyyy", { locale: fr })} · ${fmtDuration(D(macro.start_date), D(macro.end_date))}` : " · sans fin"}
            </p>
            {macro.end_date && D(macro.end_date) >= today && (
              <p className="text-[12px] font-bold mt-0.5 opacity-80">⏳ {fmtDuration(today, D(macro.end_date))} restantes</p>
            )}
          </>
        ) : (
          <>
            <h2 className="text-xl font-black leading-tight" style={SORA}>+ Créer un macrocycle</h2>
            <p className="text-sm font-medium mt-0.5 opacity-80">Un grand bloc d'entraînement (distinct de l'objectif)</p>
          </>
        )}
      </button>

      {/* ── MÉSOCYCLES sous le macro ──────────────────────────────────────── */}
      {macro && (
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground/70">Mésocycles</h3>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={openNewMeso}><Plus className="h-4 w-4 text-primary" /> Ajouter un mésocycle</Button>
        </div>
      )}
      {macro && orderedPhases.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-3 rounded-xl border border-dashed border-border/60">Macro vierge — ajoute ton premier mésocycle.</p>
      )}

      {/* Mésocycles proportionnels qui REMPLISSENT la largeur de l'écran */}
      <div className="flex gap-1.5 items-stretch">
        {grouped.byPhase.map(({ phase, idx, weeks: ws }) => {
          const col = phase.color || PHASE_COLORS[idx % PHASE_COLORS.length];
          const st = phaseStatus(phase);
          return (
            <div key={phase.id} className="rounded-xl border border-border/50 overflow-hidden flex flex-col" style={{ flex: `${Math.max(1, ws.length)} 1 0`, minWidth: 0 }}>
              {/* Bande mésocycle (clic = éditer) */}
              <div role="button" onClick={() => openEditMeso(phase)} className="px-2 py-1.5 text-black min-h-[46px] flex flex-col justify-center cursor-pointer hover:brightness-105" style={{ background: col }}>
                <div className="flex items-center gap-1">
                  <span className="font-black text-[11px] shrink-0" style={SORA}>P{idx + 1}</span>
                  <span className="font-bold text-[11px] uppercase tracking-tight truncate" style={SORA} title={phase.name}>{phase.name || "Phase"}</span>
                  <span className="text-[8px] font-bold px-1 py-0.5 rounded-full bg-black/15 shrink-0 whitespace-nowrap ml-auto">
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

      {/* Liste des phases (noms complets, lisibles même si la bande est étroite) */}
      {orderedPhases.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {orderedPhases.map((p, i) => {
            const col = p.color || PHASE_COLORS[i % PHASE_COLORS.length];
            const st = phaseStatus(p);
            return (
              <div key={p.id} className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/40 px-2.5 py-1.5">
                <span className="h-5 w-5 shrink-0 rounded-md grid place-items-center text-[10px] font-black text-black" style={{ background: col }}>P{i + 1}</span>
                <span className="text-sm font-semibold truncate flex-1 min-w-0">{p.name || "Phase"}</span>
                <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">{format(D(p.start_date), "d MMM", { locale: fr })}{p.end_date ? `→${format(D(p.end_date), "d MMM", { locale: fr })}` : ""}</span>
                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0", st === "current" ? "bg-primary/20 text-primary" : st === "past" ? "bg-muted text-muted-foreground" : "bg-muted/50 text-muted-foreground/70")}>
                  {st === "current" ? "EN COURS" : st === "past" ? "PASSÉ" : "À VENIR"}
                </span>
              </div>
            );
          })}
        </div>
      )}

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

      {/* Fenêtre mésocycle */}
      {mesoDlg && (
        <Dialog open onOpenChange={(o) => !o && setMesoDlg(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{mesoDlg.id ? "Modifier le mésocycle" : "Nouveau mésocycle"}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-1">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Nom / focus</label>
                <Input autoFocus value={mesoDlg.name} onChange={(e) => setMesoDlg({ ...mesoDlg, name: e.target.value })} placeholder="Ex : Développement · Intensification · Affûtage" className="h-10" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground">Durée</label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setMesoDlg({ ...mesoDlg, weeks: Math.max(1, mesoDlg.weeks - 1) })}>−</Button>
                  <span className="w-16 text-center font-bold tabular-nums">{mesoDlg.weeks} sem.</span>
                  <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setMesoDlg({ ...mesoDlg, weeks: mesoDlg.weeks + 1 })}>+</Button>
                </div>
                <span className="text-[11px] text-muted-foreground">≈ {fmtDuration(new Date(), addWeeks(new Date(), mesoDlg.weeks))}</span>
              </div>

              {/* Volume par rapport au macro */}
              {(() => {
                if (!macro?.end_date) return null;
                const macroWeeks = Math.max(1, Math.round((differenceInCalendarDays(D(macro.end_date), D(macro.start_date)) + 1) / 7));
                const used = phases.filter((p) => !(mesoDlg.id && p.id === mesoDlg.id)).reduce((s, p) => s + (p.end_date ? Math.max(1, Math.round((differenceInCalendarDays(D(p.end_date), D(p.start_date)) + 1) / 7)) : 0), 0);
                const nw = mesoDlg.weeks;
                const total = used + nw;
                const remaining = macroWeeks - total;
                const pct = Math.round((nw / macroWeeks) * 100);
                const usedPct = Math.min(100, (used / macroWeeks) * 100);
                const newPct = Math.min(100 - usedPct, (nw / macroWeeks) * 100);
                return (
                  <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-muted-foreground">Ce mésocycle</span>
                      <span className="font-bold">{nw} sem. · <span className="text-primary">{pct}%</span> du macro</span>
                    </div>
                    {/* barre : déjà réparti (gris) + ce méso (doré) + restant (vide) */}
                    <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden flex">
                      <div className="h-full bg-muted-foreground/40" style={{ width: `${usedPct}%` }} />
                      <div className="h-full bg-primary" style={{ width: `${newPct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Réparti : <span className="font-semibold text-foreground">{total}</span> / {macroWeeks} sem.</span>
                      <span className={cn("font-semibold", remaining < 0 ? "text-red-400" : "text-emerald-500")}>
                        {remaining < 0 ? `Dépasse de ${Math.abs(remaining)} sem.` : `Restant : ${remaining} sem.`}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
            <DialogFooter className="sm:justify-between">
              {mesoDlg.id ? <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteMeso(mesoDlg.id!)}><Trash2 className="h-4 w-4 mr-1" /> Supprimer</Button> : <span />}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMesoDlg(null)}>Annuler</Button>
                <Button onClick={saveMeso} disabled={busy || !mesoDlg.name.trim()} className="gap-1.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Enregistrer</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Fenêtre macrocycle */}
      {macroDlg && (
        <Dialog open onOpenChange={(o) => !o && setMacroDlg(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{macroDlg.id ? "Modifier le macrocycle" : "Nouveau macrocycle"}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-1">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Nom du bloc</label>
                <Input autoFocus value={macroDlg.name} onChange={(e) => setMacroDlg({ ...macroDlg, name: e.target.value })} placeholder="Ex : Prépa trek · Base hivernale…" className="h-10" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Début</label>
                  <MiniDate value={macroDlg.start} onChange={(d) => setMacroDlg({ ...macroDlg, start: d })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fin</label>
                  <MiniDate value={macroDlg.end} onChange={(d) => setMacroDlg({ ...macroDlg, end: d })} placeholder="Choisir" />
                </div>
              </div>
              {macroDlg.end && (
                <p className="text-[12px] text-muted-foreground">Durée : <span className="font-semibold text-foreground">{fmtDuration(macroDlg.start, macroDlg.end)}</span></p>
              )}
            </div>
            <DialogFooter className="flex items-center justify-between sm:justify-between">
              {macroDlg.id ? (
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={deleteMacro}><Trash2 className="h-4 w-4 mr-1" /> Supprimer</Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMacroDlg(null)}>Annuler</Button>
                <Button onClick={saveMacro} disabled={busy || !macroDlg.name.trim()} className="gap-1.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Enregistrer</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function MiniDate({ value, onChange, placeholder }: { value: Date | null; onChange: (d: Date) => void; placeholder?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start h-10 font-normal px-2.5">
          <CalendarDays className="h-4 w-4 mr-1.5 text-muted-foreground shrink-0" />
          <span className="truncate">{value ? format(value, "d MMM yyyy", { locale: fr }) : <span className="text-muted-foreground">{placeholder || "Date"}</span>}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value || undefined} onSelect={(d) => d && onChange(d)} locale={fr} weekStartsOn={1} className="pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} /> {label}</span>;
}

function addDaysLocal(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
