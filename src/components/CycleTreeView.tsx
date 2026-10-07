/**
 * CycleTreeView — « Vue d'ensemble » en arbre (TEST, additif, lecture seule).
 * Réutilise les données existantes : Objectif (macro) → Phases/mésocycles →
 * Semaines/microcycles (training_weeks) → Séances/entraînements (training_sessions).
 * Ne remplace rien : c'est une vue de synthèse visuelle à côté de Prog & Feuille de route.
 */
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfISOWeek, setISOWeek, setISOWeekYear, differenceInCalendarDays, addWeeks, addMonths, differenceInMonths, differenceInWeeks, getISOWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Layers, Pencil, Trash2, CalendarDays, Loader2, Plus, Archive, History, ChevronDown, ChevronRight, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const SORA = { fontFamily: "'Sora', system-ui, sans-serif" } as const;
const PHASE_COLORS = ["#e8c466", "#5aa9e6", "#9c7bd6", "#5fbf82", "#e8974a", "#e56464"];

interface Phase { id: string; name: string; start_date: string; end_date: string | null; color: string | null; coach_note?: string | null; }
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
interface Micro { id: string; name: string; start_date: string; end_date: string | null; mesocycle_id: string; coach_note: string | null; }

export function CycleTreeView({ athleteId }: { athleteId: string }) {
  const [objName, setObjName] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [targets, setTargets] = useState<{ label: string; date: string; isObjective: boolean }[]>([]);
  const [macro, setMacro] = useState<Macro | null>(null);
  const [archivedMacros, setArchivedMacros] = useState<(Macro & { archived_at: string })[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyMacro, setHistoryMacro] = useState<(Macro & { archived_at: string }) | null>(null);
  const [orphanMode, setOrphanMode] = useState(false); // mésos sans macro → placeholder « ?? »
  const [phases, setPhases] = useState<Phase[]>([]);
  const [micros, setMicros] = useState<Micro[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [sessions, setSessions] = useState<Sess[]>([]);
  const [loading, setLoading] = useState(true);
  const [macroDlg, setMacroDlg] = useState<null | { id?: string; name: string; start: Date; end: Date | null }>(null);
  const [busy, setBusy] = useState(false);

  const loadAll = async () => {
      const [{ data: objRows }, { data: macroRows }, { data: wk }] = await Promise.all([
        supabase.from("athlete_objectives").select("main_objective, main_objective_deadline").eq("athlete_id", athleteId).order("updated_at", { ascending: false }).limit(1),
        supabase.from("macrocycles").select("id, name, start_date, end_date").eq("athlete_id", athleteId).is("archived_at", null).order("start_date", { ascending: false }).limit(1),
        supabase.from("training_weeks").select("id, week_number, year").eq("athlete_id", athleteId),
      ]);
      setObjName(objRows?.[0]?.main_objective || null);
      setDeadline(objRows?.[0]?.main_objective_deadline || null);
      // Objectif principal + sous-objectifs datés → points sur les semaines concordantes
      const { data: msRows } = await supabase.from("objective_milestones").select("label, target_date, is_objective, approval_status").eq("athlete_id", athleteId);
      const tg: { label: string; date: string; isObjective: boolean }[] = [];
      if (objRows?.[0]?.main_objective && objRows?.[0]?.main_objective_deadline) tg.push({ label: objRows[0].main_objective, date: objRows[0].main_objective_deadline, isObjective: true });
      (msRows || []).forEach((m: any) => { if (m.target_date && m.approval_status !== "pending") tg.push({ label: m.label, date: m.target_date, isObjective: !!m.is_objective }); });
      setTargets(tg);
      let mac = (macroRows?.[0] as any) || null;
      // Clôture automatique : si la date de fin est passée, on archive et la base repart vierge
      const todayLocal = new Date(); todayLocal.setHours(0, 0, 0, 0);
      if (mac && mac.end_date && D(mac.end_date) < todayLocal) {
        await supabase.from("macrocycles").update({ archived_at: new Date().toISOString() }).eq("id", mac.id);
        mac = null;
      }
      // Historique : macrocycles terminés (archivés) — après la clôture auto ci-dessus
      const { data: arch } = await supabase.from("macrocycles").select("id, name, start_date, end_date, archived_at").eq("athlete_id", athleteId).not("archived_at", "is", null).order("archived_at", { ascending: false });
      setArchivedMacros((arch || []) as any);
      // Mésocycles du macro courant. Sinon, mésos « orphelins » (sans macro) → placeholder « ?? »
      let mes: any[] = [];
      let orphan = false;
      if (mac) {
        const { data } = await supabase.from("mesocycles").select("id, name, start_date, end_date, color, macrocycle_id, coach_note").eq("athlete_id", athleteId).eq("macrocycle_id", mac.id);
        mes = data || [];
      } else {
        const { data } = await supabase.from("mesocycles").select("id, name, start_date, end_date, color, macrocycle_id, coach_note").eq("athlete_id", athleteId).is("macrocycle_id", null);
        const orphans = (data || []).filter((m: any) => m.start_date);
        if (orphans.length) {
          mes = orphans;
          orphan = true;
          // Macro virtuel « ?? » couvrant la période des phases existantes
          const starts = orphans.map((m: any) => D(m.start_date).getTime());
          const ends = orphans.map((m: any) => (m.end_date ? D(m.end_date).getTime() : D(m.start_date).getTime()));
          mac = { id: "", name: "??", start_date: format(new Date(Math.min(...starts)), "yyyy-MM-dd"), end_date: format(new Date(Math.max(...ends)), "yyyy-MM-dd") };
        }
      }
      setOrphanMode(orphan);
      setMacro(mac);
      const phaseList = ((mes as any[]).filter((m) => m.start_date)).map((m) => ({ id: m.id, name: m.name, start_date: m.start_date, end_date: m.end_date, color: m.color, coach_note: m.coach_note ?? null }));
      setPhases(phaseList);
      // Microcycles rattachés aux mésos du macro
      if (phaseList.length) {
        const { data: mic } = await supabase.from("microcycles").select("id, name, start_date, end_date, mesocycle_id, coach_note").in("mesocycle_id", phaseList.map((p) => p.id));
        setMicros((mic || []) as Micro[]);
      } else setMicros([]);
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
    // macro.id vide = placeholder « ?? » (phases orphelines) → on ouvre la CRÉATION, pré-remplie sur leur période
    if (macro && macro.id) setMacroDlg({ id: macro.id, name: macro.name, start: D(macro.start_date), end: macro.end_date ? D(macro.end_date) : null });
    else if (macro) setMacroDlg({ name: "", start: D(macro.start_date), end: macro.end_date ? D(macro.end_date) : null });
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
      if (macroDlg.id) {
        await supabase.from("macrocycles").update(payload).eq("id", macroDlg.id);
      } else {
        const { data: created } = await supabase.from("macrocycles").insert({ ...payload, athlete_id: athleteId, coach_id: user?.id, color: "#c79a3a" }).select("id").single();
        // Si on était en mode « ?? » (phases orphelines), on les rattache au nouveau macro
        if (orphanMode && created?.id) {
          await supabase.from("mesocycles").update({ macrocycle_id: created.id }).eq("athlete_id", athleteId).is("macrocycle_id", null);
          toast.success("Macrocycle créé — les phases existantes y ont été rattachées");
        }
      }
      setMacroDlg(null); if (!orphanMode) toast.success("Macrocycle enregistré"); loadAll();
    } catch (e) { console.error(e); toast.error("Enregistrement impossible"); }
    finally { setBusy(false); }
  };

  const deleteMacro = async () => {
    if (!macro) return;
    await supabase.from("macrocycles").delete().eq("id", macro.id);
    setMacroDlg(null); loadAll();
  };

  const archiveMacro = async () => {
    if (!macro) return;
    setBusy(true);
    try {
      await supabase.from("macrocycles").update({ archived_at: new Date().toISOString() }).eq("id", macro.id);
      setMacroDlg(null); toast.success("Macrocycle terminé et archivé — la base repart vierge"); loadAll();
    } catch (e) { console.error(e); toast.error("Archivage impossible"); }
    finally { setBusy(false); }
  };

  // ── Mésocycles sous le macro (étape 2) ─────────────────────────────────────
  const [mesoDlg, setMesoDlg] = useState<null | { id?: string; name: string; start: Date; end: Date | null; note: string }>(null);
  const openNewMeso = () => {
    const ordered = [...phases].sort((a, b) => D(a.start_date).getTime() - D(b.start_date).getTime());
    const last = ordered[ordered.length - 1];
    const start = last?.end_date ? addDaysLocal(D(last.end_date), 1) : (macro ? D(macro.start_date) : new Date(new Date().setHours(0, 0, 0, 0)));
    setMesoDlg({ name: "", start, end: addDaysLocal(addWeeks(start, 4), -1), note: "" });
  };
  const openEditMeso = (p: Phase) => setMesoDlg({ id: p.id, name: p.name, note: p.coach_note || "", start: D(p.start_date), end: p.end_date ? D(p.end_date) : null });
  // Nouveau méso pré-rempli sur une plage libre (clic sur un espace vide)
  const openNewMesoAt = (start: Date, end: Date) => setMesoDlg({ name: "", start, end, note: "" });

  const saveMeso = async () => {
    if (!mesoDlg || !mesoDlg.name.trim() || !macro) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        name: mesoDlg.name.trim(), coach_note: mesoDlg.note.trim() || null,
        start_date: format(mesoDlg.start, "yyyy-MM-dd"),
        end_date: mesoDlg.end ? format(mesoDlg.end, "yyyy-MM-dd") : null,
        updated_at: new Date().toISOString(),
      };
      if (mesoDlg.id) {
        await supabase.from("mesocycles").update(payload).eq("id", mesoDlg.id);
      } else {
        await supabase.from("mesocycles").insert({
          ...payload, athlete_id: athleteId, coach_id: user?.id, macrocycle_id: macro.id || null,
          phase_type: "custom", color: PHASE_COLORS[phases.length % PHASE_COLORS.length],
          volume_target: 3, intensity_target: 3,
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

  // ── Microcycles sous un mésocycle (étape 3) ────────────────────────────────
  const [microDlg, setMicroDlg] = useState<null | { id?: string; mesoId: string; name: string; weeks: number; note: string }>(null);
  const microsOf = (mesoId: string) => micros.filter((m) => m.mesocycle_id === mesoId).sort((a, b) => D(a.start_date).getTime() - D(b.start_date).getTime());
  const openNewMicro = (mesoId: string) => setMicroDlg({ mesoId, name: "", weeks: 1, note: "" });
  const openEditMicro = (m: Micro) => setMicroDlg({ id: m.id, mesoId: m.mesocycle_id, name: m.name, note: m.coach_note || "", weeks: m.end_date ? Math.max(1, Math.round((differenceInCalendarDays(D(m.end_date), D(m.start_date)) + 1) / 7)) : 1 });

  const saveMicro = async () => {
    if (!microDlg || !microDlg.name.trim()) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const meso = phases.find((p) => p.id === microDlg.mesoId);
      if (!meso) throw new Error("meso introuvable");
      if (microDlg.id) {
        const cur = micros.find((x) => x.id === microDlg.id)!;
        const start = D(cur.start_date);
        const end = addDaysLocal(addWeeks(start, microDlg.weeks), -1);
        await supabase.from("microcycles").update({ name: microDlg.name.trim(), coach_note: microDlg.note.trim() || null, end_date: format(end, "yyyy-MM-dd"), updated_at: new Date().toISOString() }).eq("id", cur.id);
      } else {
        const existing = microsOf(microDlg.mesoId);
        const last = existing[existing.length - 1];
        const start = last?.end_date ? addDaysLocal(D(last.end_date), 1) : D(meso.start_date);
        const end = addDaysLocal(addWeeks(start, microDlg.weeks), -1);
        await supabase.from("microcycles").insert({
          athlete_id: athleteId, coach_id: user?.id, mesocycle_id: microDlg.mesoId,
          name: microDlg.name.trim(), coach_note: microDlg.note.trim() || null, phase_type: "custom",
          start_date: format(start, "yyyy-MM-dd"), end_date: format(end, "yyyy-MM-dd"),
          volume_target: 3, intensity_target: 3, updated_at: new Date().toISOString(),
        });
      }
      setMicroDlg(null); toast.success("Microcycle enregistré"); loadAll();
    } catch (e) { console.error(e); toast.error("Enregistrement impossible"); }
    finally { setBusy(false); }
  };

  const deleteMicro = async (id: string) => {
    await supabase.from("microcycles").delete().eq("id", id);
    setMicroDlg(null); loadAll();
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

  const totalWeeks = weeks.length;
  const dl = deadline ? D(deadline) : null;
  const macroWeeks = macro?.end_date ? Math.max(1, Math.round((differenceInCalendarDays(D(macro.end_date), D(macro.start_date)) + 1) / 7)) : null;
  const allocatedWeeks = phases.reduce((s, p) => s + (p.end_date ? Math.max(1, Math.round((differenceInCalendarDays(D(p.end_date), D(p.start_date)) + 1) / 7)) : 2), 0);
  const lastPhaseEndDate = orderedPhases.length && orderedPhases[orderedPhases.length - 1].end_date ? D(orderedPhases[orderedPhases.length - 1].end_date!) : null;
  const trailingWeeks = macro?.end_date && lastPhaseEndDate ? Math.max(0, Math.round(differenceInCalendarDays(D(macro.end_date), lastPhaseEndDate) / 7)) : 0;
  const trailingFreePct = macroWeeks ? (trailingWeeks / macroWeeks) * 100 : 0;

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

  // ── Branches « arbre généalogique » : vraies lignes orthogonales en SVG ──────
  const treeRef = useRef<HTMLDivElement>(null);
  const [links, setLinks] = useState<{ d: string; cur: boolean; color: string }[]>([]);
  useLayoutEffect(() => {
    const el = treeRef.current;
    if (!el) return;
    const compute = () => {
      const root = el.getBoundingClientRect();
      const out: { d: string; cur: boolean; color: string }[] = [];
      type P = { x: number; y: number };
      const pt = (r: DOMRect, edge: "top" | "bottom"): P => ({ x: r.left - root.left + r.width / 2, y: (edge === "top" ? r.top : r.bottom) - root.top });
      // Connecteur orthogonal « arbre généalogique » : tige → rail → descente, coins arrondis.
      const ortho = (from: P, to: P, busY: number): string => {
        if (Math.abs(to.x - from.x) < 1) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
        const dir = to.x >= from.x ? 1 : -1;
        const r = Math.min(8, Math.abs(busY - from.y) / 2, Math.abs(to.x - from.x) / 2, Math.abs(to.y - busY) / 2);
        return `M ${from.x} ${from.y} L ${from.x} ${busY - r} Q ${from.x} ${busY} ${from.x + dir * r} ${busY} L ${to.x - dir * r} ${busY} Q ${to.x} ${busY} ${to.x} ${busY + r} L ${to.x} ${to.y}`;
      };
      const group = (from: P, kids: { pt: P; cur: boolean }[], color: string) => {
        if (!kids.length) return;
        const busY = from.y + (Math.min(...kids.map((k) => k.pt.y)) - from.y) / 2;
        kids.forEach((k) => out.push({ d: ortho(from, k.pt, busY), cur: k.cur, color }));
      };
      // macro → mésos
      const macroEl = el.querySelector<HTMLElement>('[data-node="macro"]');
      if (macroEl) {
        const from = pt(macroEl.getBoundingClientRect(), "bottom");
        const kids = Array.from(el.querySelectorAll<HTMLElement>("[data-meso]")).map((node) => ({
          pt: pt(node.getBoundingClientRect(), "top"), cur: node.dataset.cur === "1", color: node.dataset.color || "#888",
        }));
        group(from, kids, "#9a9a9a");
      }
      // méso → micros (couleur du méso)
      el.querySelectorAll<HTMLElement>("[data-meso]").forEach((node) => {
        const id = node.dataset.meso;
        const color = node.dataset.color || "#888";
        const mesoCur = node.dataset.cur === "1";
        const from = pt(node.getBoundingClientRect(), "bottom");
        const kids = Array.from(el.querySelectorAll<HTMLElement>(`[data-micro][data-parent="${id}"]`)).map((mnode) => ({
          pt: pt(mnode.getBoundingClientRect(), "top"), cur: mesoCur && mnode.dataset.cur === "1",
        }));
        group(from, kids, color);
      });
      setLinks(out);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener("resize", compute);
    const t = setTimeout(compute, 60);
    return () => { ro.disconnect(); window.removeEventListener("resize", compute); clearTimeout(t); };
  }, [grouped, phases, micros, macro]);

  if (loading) return <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="px-2 py-0.5 rounded-full bg-muted border border-border">Vue en test</span>
        <span>Objectif → Phases → Semaines → Séances · lecture seule</span>
      </div>

      {/* ── ARBRE : macro → mésos → micros, reliés par de vraies courbes SVG ── */}
      <div ref={treeRef} className="relative space-y-6">
      {/* Calque des branches (derrière les blocs) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ overflow: "visible" }}>
        {links.filter((l) => !l.cur).map((l, i) => (
          <path key={`b${i}`} d={l.d} fill="none" stroke={l.color} strokeOpacity={0.5} strokeWidth={1.5} />
        ))}
        {links.filter((l) => l.cur).map((l, i) => (
          <path key={`c${i}`} d={l.d} fill="none" stroke="#e8c466" strokeWidth={2.5} strokeLinecap="round" style={{ filter: "drop-shadow(0 0 3px rgba(232,196,102,0.6))" }} />
        ))}
      </svg>

      {/* ── MACROCYCLE (cliquable : créer / éditer) ──────────────────────── */}
      <button data-node="macro" type="button" onClick={openMacro} className="group w-full rounded-2xl p-5 text-center text-black shadow-lg relative z-10 active:scale-[0.998] transition-transform" style={{ background: "linear-gradient(90deg,#c79a3a,#e8c466)" }}>
        <span className="absolute top-3 right-3 opacity-50 group-hover:opacity-100 transition-opacity">
          <Pencil className="h-4 w-4" />
        </span>
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] opacity-70">Macrocycle</p>
        {orphanMode ? (
          <>
            <h2 className="text-3xl font-black leading-tight" style={SORA}>??</h2>
            <p className="text-sm font-bold mt-0.5">Phases existantes non rattachées à un macrocycle</p>
            <p className="text-[12px] font-semibold mt-0.5 opacity-80">Clique pour créer le macrocycle — tes phases y seront automatiquement reliées</p>
          </>
        ) : macro ? (
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
        <div className="relative z-10 flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground/70">Mésocycles</h3>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={openNewMeso}><Plus className="h-4 w-4 text-primary" /> Ajouter un mésocycle</Button>
        </div>
      )}
      {macro && orderedPhases.length === 0 && (
        <p className="relative z-10 text-sm text-muted-foreground text-center py-3 rounded-xl border border-dashed border-border/60">Macro vierge — ajoute ton premier mésocycle.</p>
      )}

      {/* Mésocycles à l'échelle du MACRO : largeur = part réelle de chaque méso */}
      <div className="relative z-10 flex gap-1.5 items-stretch">
        {grouped.byPhase.map(({ phase, idx }) => {
          const col = PHASE_COLORS[idx % PHASE_COLORS.length]; // couleur distincte par méso
          const st = phaseStatus(phase);
          const mlist = microsOf(phase.id);
          const durWeeks = phase.end_date ? Math.max(1, Math.round((differenceInCalendarDays(D(phase.end_date), D(phase.start_date)) + 1) / 7)) : 2;
          const pct = macroWeeks ? Math.min(100, (durWeeks / macroWeeks) * 100) : 100 / Math.max(1, grouped.byPhase.length);
          // Espace « libre » avant ce méso = temps réel entre le méso précédent (ou le début du macro) et son début
          const prevPhase = idx > 0 ? orderedPhases[idx - 1] : null;
          const prevBoundary = prevPhase?.end_date ? addDaysLocal(D(prevPhase.end_date), 1) : (macro ? D(macro.start_date) : D(phase.start_date));
          const gapDays = differenceInCalendarDays(D(phase.start_date), prevBoundary);
          const gapWeeks = Math.round(gapDays / 7);
          const gapPct = macroWeeks && gapWeeks > 0 ? (gapWeeks / macroWeeks) * 100 : 0;
          return (
            <Fragment key={phase.id}>
            {gapPct > 0.5 && (
              <button type="button" onClick={() => openNewMesoAt(prevBoundary, addDaysLocal(D(phase.start_date), -1))}
                className="self-stretch rounded-xl border border-dashed border-border/40 flex items-center justify-center text-[9px] text-muted-foreground/50 hover:border-primary/60 hover:text-primary hover:bg-primary/5 transition-colors"
                style={{ flex: `0 0 ${gapPct}%`, minWidth: 24 }} title={`Ajouter un mésocycle ici · ${gapWeeks} sem. libre`}>
                <span className="flex items-center gap-1"><Plus className="h-3 w-3" /> {gapWeeks} sem.</span>
              </button>
            )}
            <div className="flex flex-col gap-6" style={{ width: `${pct}%`, flex: `0 0 ${pct}%`, minWidth: 40 }}>
              {/* Bande mésocycle (clic = éditer) */}
              <div data-meso={phase.id} data-cur={st === "current" ? "1" : "0"} data-color={col} role="button" onClick={() => openEditMeso(phase)} title={phase.coach_note ? `${phase.name}\n\n${phase.coach_note}` : phase.name} className="rounded-xl px-2 py-1.5 text-black min-h-[46px] flex flex-col justify-center cursor-pointer hover:brightness-105" style={{ background: col }}>
                <div className="flex items-center gap-1">
                  <span className="font-black text-[11px] shrink-0" style={SORA}>P{idx + 1}</span>
                  <span className="font-bold text-[11px] uppercase tracking-tight truncate" style={SORA}>{phase.name || "Phase"}</span>
                  {phase.coach_note && <span className="text-[10px] shrink-0" title="Commentaire">📝</span>}
                  <span className="text-[8px] font-bold px-1 py-0.5 rounded-full bg-black/15 shrink-0 whitespace-nowrap ml-auto">
                    {st === "current" ? "EN COURS" : st === "past" ? "PASSÉ" : "À VENIR"}
                  </span>
                </div>
                <span className="text-[9px] font-semibold opacity-80 truncate">
                  {format(D(phase.start_date), "d MMM", { locale: fr })}{phase.end_date ? ` → ${format(D(phase.end_date), "d MMM", { locale: fr })}` : ""} · {durWeeks} sem.
                </span>
              </div>
              {/* Microcycles (reliés au méso par une branche SVG) */}
              <div className="rounded-xl border border-border/50 p-1.5 flex gap-1 bg-card/30 flex-1 items-stretch">
                {(() => { let acc = 0; return mlist.map((mc) => {
                  const mw = mc.end_date ? Math.max(1, Math.round((differenceInCalendarDays(D(mc.end_date), D(mc.start_date)) + 1) / 7)) : 1;
                  // Position réelle dans le méso (robuste si les dates du micro sont décalées par rapport au méso)
                  const slotStart = addWeeks(D(phase.start_date), acc);
                  const slotEnd = addDaysLocal(addWeeks(D(phase.start_date), acc + mw), -1);
                  acc += mw;
                  const mcCur = today >= slotStart && today <= slotEnd;
                  return (
                    <button key={mc.id} data-micro={mc.id} data-parent={phase.id} data-cur={mcCur ? "1" : "0"} type="button" onClick={() => openEditMicro(mc)}
                      title={`${mc.name}${mc.coach_note ? `\n\n${mc.coach_note}` : ""}`}
                      className={cn("rounded-md border px-1 py-1.5 text-center hover:border-primary/60 min-w-0 flex flex-col justify-center", mcCur && "ring-2 ring-primary")}
                      style={{ flex: `0 0 ${(mw / Math.max(1, durWeeks)) * 100}%`, borderColor: mcCur ? "#e8c466" : `${col}66`, background: mcCur ? `${col}26` : `${col}14` }}>
                      <p className="text-[10px] font-bold leading-tight truncate" style={SORA}>{mc.name}</p>
                      <p className="text-[8px] text-muted-foreground">{mw} sem.{mc.coach_note ? " 📝" : ""}</p>
                    </button>
                  );
                }); })()}
                {(() => {
                  const allocated = mlist.reduce((s, mc) => s + (mc.end_date ? Math.max(1, Math.round((differenceInCalendarDays(D(mc.end_date), D(mc.start_date)) + 1) / 7)) : 1), 0);
                  if (allocated >= durWeeks) return null; // méso plein → pas de +
                  const freeW = Math.max(0, durWeeks - allocated);
                  return (
                    <button type="button" onClick={() => openNewMicro(phase.id)}
                      className="rounded-md border border-dashed border-border/60 text-muted-foreground hover:text-primary hover:border-primary/60 px-2 flex flex-col items-center justify-center gap-0.5"
                      style={{ flex: `1 1 ${(freeW / Math.max(1, durWeeks)) * 100}%`, minWidth: 28 }}
                      title={`Ajouter un microcycle · ${freeW} sem. libre${freeW > 1 ? "s" : ""}`}>
                      <Plus className="h-4 w-4" />
                      {freeW > 0 && <span className="text-[8px] leading-none">{freeW} sem.</span>}
                    </button>
                  );
                })()}
              </div>
              {/* Semaines correspondantes (numéros de semaine ISO) + points objectifs/sous-objectifs */}
              <div className="flex gap-0.5 items-stretch">
                {Array.from({ length: durWeeks }).map((_, wi) => {
                  const d = addWeeks(D(phase.start_date), wi);
                  const cellEnd = addDaysLocal(d, 7);
                  const wCur = getISOWeek(d) === getISOWeek(today) && d.getFullYear() === today.getFullYear();
                  const hits = targets.filter((t) => { const td = D(t.date); return td >= d && td < cellEnd; });
                  return (
                    <div key={wi} className={cn("relative flex-1 min-w-0 text-center text-[8px] font-semibold tabular-nums rounded py-0.5 border", wCur ? "bg-primary/20 text-primary border-primary/60" : "text-muted-foreground/70 bg-muted/30 border-border/30")}>
                      S{getISOWeek(d)}
                      {hits.length > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button type="button" title="Objectif / sous-objectif cette semaine"
                              className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full border border-background shadow"
                              style={{ background: hits.some((h) => h.isObjective) ? "#e8c466" : "#5aa9e6" }} />
                          </PopoverTrigger>
                          <PopoverContent className="w-auto max-w-[220px] p-2" align="center">
                            <div className="space-y-1">
                              {hits.map((h, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-[12px]">
                                  <span className="shrink-0">{h.isObjective ? "🎯" : "🚩"}</span>
                                  <div className="min-w-0">
                                    <p className="font-semibold leading-tight">{h.label}</p>
                                    <p className="text-[10px] text-muted-foreground">{format(D(h.date), "d MMM yyyy", { locale: fr })}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            </Fragment>
          );
        })}

        {/* Temps du macro restant APRÈS le dernier méso (fin réelle) — cliquable */}
        {trailingFreePct > 0.5 && macro?.end_date && lastPhaseEndDate && (
          <button type="button" onClick={() => openNewMesoAt(addDaysLocal(lastPhaseEndDate, 1), D(macro.end_date!))}
            className="self-stretch rounded-xl border border-dashed border-border/40 flex items-center justify-center text-[10px] text-muted-foreground/60 hover:border-primary/60 hover:text-primary hover:bg-primary/5 transition-colors"
            style={{ flex: `0 0 ${trailingFreePct}%`, minWidth: 40 }}
            title={`Ajouter un mésocycle ici · ${trailingWeeks} sem. libre`}>
            <span className="flex items-center gap-1"><Plus className="h-3 w-3" /> libre · {trailingWeeks} sem.</span>
          </button>
        )}
      </div>
      </div>

      {/* ── HISTORIQUE des macrocycles terminés ───────────────────────────── */}
      {archivedMacros.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card/30">
          <button type="button" onClick={() => setShowHistory((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/20 rounded-2xl">
            <History className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-bold">Historique des macrocycles</span>
            <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{archivedMacros.length}</span>
            {showHistory ? <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" /> : <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />}
          </button>
          {showHistory && (
            <div className="px-3 pb-3 space-y-2">
              {archivedMacros.map((m) => (
                <button key={m.id} type="button" onClick={() => setHistoryMacro(m)}
                  className="w-full text-left rounded-xl border border-border/50 bg-muted/10 px-3 py-3 flex items-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-colors group">
                  <Archive className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate" style={SORA}>{m.name}</p>
                    {/* Dates mises en avant */}
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[13px] font-bold text-foreground tabular-nums bg-primary/10 border border-primary/30 rounded-lg px-2 py-0.5">
                        <CalendarDays className="h-3.5 w-3.5 text-primary" />
                        {format(D(m.start_date), "d MMM yyyy", { locale: fr })}
                        {m.end_date ? ` → ${format(D(m.end_date), "d MMM yyyy", { locale: fr })}` : ""}
                      </span>
                      {m.end_date && <span className="text-[11px] font-semibold text-muted-foreground">{fmtDuration(D(m.start_date), D(m.end_date))}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-muted-foreground/70 whitespace-nowrap">Terminé le {format(D(m.archived_at), "d MMM yyyy", { locale: fr })}</span>
                    <span className="text-[11px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> Voir l'arbre</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fenêtre microcycle */}
      {microDlg && (
        <Dialog open onOpenChange={(o) => !o && setMicroDlg(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{microDlg.id ? "Modifier le microcycle" : "Nouveau microcycle"}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-1">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Nom / focus de la période</label>
                <Input autoFocus value={microDlg.name} onChange={(e) => setMicroDlg({ ...microDlg, name: e.target.value })} placeholder="Ex : Semaine d'adaptation · Choc · Récup" className="h-10" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground">Durée</label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setMicroDlg({ ...microDlg, weeks: Math.max(1, microDlg.weeks - 1) })}>−</Button>
                  <span className="w-16 text-center font-bold tabular-nums">{microDlg.weeks} sem.</span>
                  <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setMicroDlg({ ...microDlg, weeks: microDlg.weeks + 1 })}>+</Button>
                </div>
              </div>

              {/* Période (du … au …) + volume vs le mésocycle parent */}
              {(() => {
                const meso = phases.find((p) => p.id === microDlg.mesoId);
                if (!meso) return null;
                let start: Date;
                if (microDlg.id) {
                  const cur = micros.find((x) => x.id === microDlg.id);
                  start = cur ? D(cur.start_date) : D(meso.start_date);
                } else {
                  const existing = microsOf(microDlg.mesoId);
                  const last = existing[existing.length - 1];
                  start = last?.end_date ? addDaysLocal(D(last.end_date), 1) : D(meso.start_date);
                }
                const end = addDaysLocal(addWeeks(start, microDlg.weeks), -1);
                const mesoWeeks = meso.end_date ? Math.max(1, Math.round((differenceInCalendarDays(D(meso.end_date), D(meso.start_date)) + 1) / 7)) : null;
                const used = microsOf(microDlg.mesoId).filter((m) => m.id !== microDlg.id).reduce((s, m) => s + (m.end_date ? Math.max(1, Math.round((differenceInCalendarDays(D(m.end_date), D(m.start_date)) + 1) / 7)) : 1), 0);
                const nw = microDlg.weeks;
                const total = used + nw;
                return (
                  <>
                    <p className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-primary" />
                      Du <span className="font-semibold text-foreground">{format(start, "d MMM yyyy", { locale: fr })}</span>
                      au <span className="font-semibold text-foreground">{format(end, "d MMM yyyy", { locale: fr })}</span>
                    </p>
                    {mesoWeeks && (
                      <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="text-muted-foreground">Ce microcycle</span>
                          <span className="font-bold">{nw} sem. · <span className="text-primary">{Math.round((nw / mesoWeeks) * 100)}%</span> du méso</span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden flex">
                          <div className="h-full bg-muted-foreground/40" style={{ width: `${Math.min(100, (used / mesoWeeks) * 100)}%` }} />
                          <div className="h-full bg-primary" style={{ width: `${Math.min(100 - Math.min(100, (used / mesoWeeks) * 100), (nw / mesoWeeks) * 100)}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Réparti : <span className="font-semibold text-foreground">{total}</span> / {mesoWeeks} sem.</span>
                          <span className={cn("font-semibold", mesoWeeks - total < 0 ? "text-red-400" : "text-emerald-500")}>
                            {mesoWeeks - total < 0 ? `Dépasse de ${Math.abs(mesoWeeks - total)} sem.` : `Restant : ${mesoWeeks - total} sem.`}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Commentaire <span className="font-normal normal-case">(consignes…)</span></label>
                <Textarea value={microDlg.note} onChange={(e) => setMicroDlg({ ...microDlg, note: e.target.value })} placeholder="Détails de la semaine…" className="min-h-[60px] resize-y text-sm" />
              </div>
            </div>
            <DialogFooter className="sm:justify-between">
              {microDlg.id ? <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteMicro(microDlg.id!)}><Trash2 className="h-4 w-4 mr-1" /> Supprimer</Button> : <span />}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMicroDlg(null)}>Annuler</Button>
                <Button onClick={saveMicro} disabled={busy || !microDlg.name.trim()} className="gap-1.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Enregistrer</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
              {/* Dates précises + durée calculée + raccourcis */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Début</label>
                  <MiniDate value={mesoDlg.start} onChange={(d) => setMesoDlg({ ...mesoDlg, start: d, end: mesoDlg.end && mesoDlg.end < d ? d : mesoDlg.end })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fin</label>
                  <MiniDate value={mesoDlg.end} onChange={(d) => setMesoDlg({ ...mesoDlg, end: d })} placeholder="Choisir" />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12px] text-muted-foreground">Durée : <span className="font-semibold text-foreground">{mesoDlg.end ? fmtDuration(mesoDlg.start, addDaysLocal(mesoDlg.end, 1)) : "—"}</span></span>
                <span className="text-[11px] text-muted-foreground">·</span>
                {[2, 3, 4, 6, 8].map((w) => (
                  <button key={w} type="button" onClick={() => setMesoDlg({ ...mesoDlg, end: addDaysLocal(addWeeks(mesoDlg.start, w), -1) })}
                    className="text-[11px] px-2 h-6 rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary">{w} sem.</button>
                ))}
              </div>

              {/* Volume par rapport au macro */}
              {(() => {
                if (!macro?.end_date) return null;
                const macroDays = differenceInCalendarDays(D(macro.end_date), D(macro.start_date)) + 1;
                const macroWeeks = Math.max(1, Math.round(macroDays / 7));
                const used = phases.filter((p) => !(mesoDlg.id && p.id === mesoDlg.id)).reduce((s, p) => s + (p.end_date ? Math.max(1, Math.round((differenceInCalendarDays(D(p.end_date), D(p.start_date)) + 1) / 7)) : 0), 0);
                const nw = mesoDlg.end ? Math.max(1, Math.round((differenceInCalendarDays(mesoDlg.end, mesoDlg.start) + 1) / 7)) : 0;
                const total = used + nw;
                const remaining = macroWeeks - total;
                const pct = Math.round((nw / macroWeeks) * 100);
                // position réelle dans le temps : décalage = jours entre le début du macro et le début du méso
                const offsetDays = Math.max(0, differenceInCalendarDays(mesoDlg.start, D(macro.start_date)));
                const offsetPct = Math.min(100, (offsetDays / macroDays) * 100);
                const newPct = Math.min(100 - offsetPct, mesoDlg.end ? ((differenceInCalendarDays(mesoDlg.end, mesoDlg.start) + 1) / macroDays) * 100 : 0);
                return (
                  <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-muted-foreground">Ce mésocycle</span>
                      <span className="font-bold">{nw} sem. · <span className="text-primary">{pct}%</span> du macro</span>
                    </div>
                    {/* barre : déjà réparti (gris) + ce méso (doré) + restant (vide) */}
                    <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden flex">
                      <div className="h-full bg-muted-foreground/25" style={{ width: `${offsetPct}%` }} />
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

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Commentaire <span className="font-normal normal-case">(objectifs, consignes…)</span></label>
                <Textarea value={mesoDlg.note} onChange={(e) => setMesoDlg({ ...mesoDlg, note: e.target.value })} placeholder={"Ce qu'on travaille, comment, points d'attention…"} className="min-h-[70px] resize-y text-sm" />
              </div>
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
            {macroDlg.id && (
              <button type="button" disabled={busy}
                onClick={() => { if (window.confirm("Terminer ce macrocycle ?\n\nIl sera rangé dans l'historique et la vue repartira vierge pour construire le prochain cycle.")) archiveMacro(); }}
                className="w-full rounded-xl border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 px-3 py-2.5 flex items-center justify-center gap-2 text-sm font-semibold transition-colors">
                <Flag className="h-4 w-4" /> Terminer & archiver ce macrocycle
              </button>
            )}
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

      {/* Fenêtre flottante : arbre complet d'un macrocycle archivé (lecture seule) */}
      {historyMacro && (
        <Dialog open onOpenChange={(o) => !o && setHistoryMacro(null)}>
          <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Archive className="h-4 w-4 text-primary" /> {historyMacro.name} · archivé</DialogTitle></DialogHeader>
            <ArchivedMacroTree macro={historyMacro} athleteId={athleteId} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── Arbre complet d'un macrocycle archivé (lecture seule, même visuel que la vue) ──
function ArchivedMacroTree({ macro, athleteId }: { macro: Macro; athleteId: string }) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [micros, setMicros] = useState<Micro[]>([]);
  const [loading, setLoading] = useState(true);
  const treeRef = useRef<HTMLDivElement>(null);
  const [links, setLinks] = useState<{ d: string; color: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: mes } = await supabase.from("mesocycles").select("id, name, start_date, end_date, color, macrocycle_id, coach_note").eq("athlete_id", athleteId).eq("macrocycle_id", macro.id);
      const phaseList = ((mes || []) as any[]).filter((m) => m.start_date).map((m) => ({ id: m.id, name: m.name, start_date: m.start_date, end_date: m.end_date, color: m.color, coach_note: m.coach_note ?? null }));
      setPhases(phaseList);
      if (phaseList.length) {
        const { data: mic } = await supabase.from("microcycles").select("id, name, start_date, end_date, mesocycle_id, coach_note").in("mesocycle_id", phaseList.map((p) => p.id));
        setMicros((mic || []) as Micro[]);
      }
      setLoading(false);
    })();
  }, [macro.id, athleteId]);

  const ordered = useMemo(() => [...phases].sort((a, b) => D(a.start_date).getTime() - D(b.start_date).getTime()), [phases]);
  const macroWeeks = macro.end_date ? Math.max(1, Math.round((differenceInCalendarDays(D(macro.end_date), D(macro.start_date)) + 1) / 7)) : null;
  const microsOf = (mid: string) => micros.filter((m) => m.mesocycle_id === mid).sort((a, b) => D(a.start_date).getTime() - D(b.start_date).getTime());

  useLayoutEffect(() => {
    const el = treeRef.current;
    if (!el) return;
    const compute = () => {
      const root = el.getBoundingClientRect();
      const out: { d: string; color: string }[] = [];
      type P = { x: number; y: number };
      const pt = (r: DOMRect, edge: "top" | "bottom"): P => ({ x: r.left - root.left + r.width / 2, y: (edge === "top" ? r.top : r.bottom) - root.top });
      const ortho = (from: P, to: P, busY: number): string => {
        if (Math.abs(to.x - from.x) < 1) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
        const dir = to.x >= from.x ? 1 : -1;
        const r = Math.min(8, Math.abs(busY - from.y) / 2, Math.abs(to.x - from.x) / 2, Math.abs(to.y - busY) / 2);
        return `M ${from.x} ${from.y} L ${from.x} ${busY - r} Q ${from.x} ${busY} ${from.x + dir * r} ${busY} L ${to.x - dir * r} ${busY} Q ${to.x} ${busY} ${to.x} ${busY + r} L ${to.x} ${to.y}`;
      };
      const group = (from: P, kids: P[], color: string) => {
        if (!kids.length) return;
        const busY = from.y + (Math.min(...kids.map((k) => k.y)) - from.y) / 2;
        kids.forEach((k) => out.push({ d: ortho(from, k, busY), color }));
      };
      const macroEl = el.querySelector<HTMLElement>('[data-node="macro"]');
      if (macroEl) group(pt(macroEl.getBoundingClientRect(), "bottom"), Array.from(el.querySelectorAll<HTMLElement>("[data-meso]")).map((n) => pt(n.getBoundingClientRect(), "top")), "#9a9a9a");
      el.querySelectorAll<HTMLElement>("[data-meso]").forEach((node) => {
        const id = node.dataset.meso;
        group(pt(node.getBoundingClientRect(), "bottom"), Array.from(el.querySelectorAll<HTMLElement>(`[data-micro][data-parent="${id}"]`)).map((n) => pt(n.getBoundingClientRect(), "top")), node.dataset.color || "#888");
      });
      setLinks(out);
    };
    compute();
    const ro = new ResizeObserver(compute); ro.observe(el);
    const t = setTimeout(compute, 60);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [phases, micros]);

  if (loading) return <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>;

  return (
    <div ref={treeRef} className="relative space-y-6 pt-1">
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ overflow: "visible" }}>
        {links.map((l, i) => <path key={i} d={l.d} fill="none" stroke={l.color} strokeOpacity={0.5} strokeWidth={1.5} />)}
      </svg>
      {/* Macro */}
      <div data-node="macro" className="relative z-10 w-full rounded-2xl p-4 text-center text-black shadow-lg" style={{ background: "linear-gradient(90deg,#c79a3a,#e8c466)" }}>
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] opacity-70">Macrocycle</p>
        <h2 className="text-xl font-black leading-tight" style={SORA}>{macro.name}</h2>
        <p className="text-sm font-semibold mt-0.5">
          {format(D(macro.start_date), "d MMM yyyy", { locale: fr })}
          {macro.end_date ? ` → ${format(D(macro.end_date), "d MMM yyyy", { locale: fr })}` : ""}
        </p>
      </div>
      {ordered.length === 0 ? (
        <p className="relative z-10 text-sm text-muted-foreground text-center py-4">Aucun mésocycle enregistré pour ce macro.</p>
      ) : (
        <div className="relative z-10 flex gap-1.5 items-stretch">
          {ordered.map((phase, idx) => {
            const col = PHASE_COLORS[idx % PHASE_COLORS.length];
            const mlist = microsOf(phase.id);
            const durWeeks = phase.end_date ? Math.max(1, Math.round((differenceInCalendarDays(D(phase.end_date), D(phase.start_date)) + 1) / 7)) : 2;
            const pct = macroWeeks ? Math.min(100, (durWeeks / macroWeeks) * 100) : 100 / Math.max(1, ordered.length);
            return (
              <div key={phase.id} className="flex flex-col gap-6" style={{ width: `${pct}%`, flex: `0 0 ${pct}%`, minWidth: 40 }}>
                <div data-meso={phase.id} data-color={col} title={phase.coach_note ? `${phase.name}\n\n${phase.coach_note}` : phase.name} className="rounded-xl px-2 py-1.5 text-black min-h-[46px] flex flex-col justify-center" style={{ background: col }}>
                  <div className="flex items-center gap-1">
                    <span className="font-black text-[11px] shrink-0" style={SORA}>P{idx + 1}</span>
                    <span className="font-bold text-[11px] uppercase tracking-tight truncate" style={SORA}>{phase.name || "Phase"}</span>
                    {phase.coach_note && <span className="text-[10px] shrink-0">📝</span>}
                  </div>
                  <span className="text-[9px] font-semibold opacity-80 truncate">
                    {format(D(phase.start_date), "d MMM", { locale: fr })}{phase.end_date ? ` → ${format(D(phase.end_date), "d MMM", { locale: fr })}` : ""} · {durWeeks} sem.
                  </span>
                </div>
                <div className="rounded-xl border border-border/50 p-1.5 flex gap-1 bg-card/30 flex-1 items-stretch">
                  {mlist.length === 0 ? <span className="text-[9px] text-muted-foreground/50 self-center mx-auto">—</span> : mlist.map((mc) => {
                    const mw = mc.end_date ? Math.max(1, Math.round((differenceInCalendarDays(D(mc.end_date), D(mc.start_date)) + 1) / 7)) : 1;
                    return (
                      <div key={mc.id} data-micro={mc.id} data-parent={phase.id} title={`${mc.name}${mc.coach_note ? `\n\n${mc.coach_note}` : ""}`}
                        className="rounded-md border px-1 py-1.5 text-center min-w-0 flex flex-col justify-center"
                        style={{ flex: `0 0 ${(mw / Math.max(1, durWeeks)) * 100}%`, borderColor: `${col}66`, background: `${col}14` }}>
                        <p className="text-[10px] font-bold leading-tight truncate" style={SORA}>{mc.name}</p>
                        <p className="text-[8px] text-muted-foreground">{mw} sem.{mc.coach_note ? " 📝" : ""}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-0.5 items-stretch">
                  {Array.from({ length: durWeeks }).map((_, wi) => (
                    <div key={wi} className="flex-1 min-w-0 text-center text-[8px] font-semibold text-muted-foreground/70 tabular-nums rounded bg-muted/30 py-0.5 border border-border/30">
                      S{getISOWeek(addWeeks(D(phase.start_date), wi))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
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
