import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, addWeeks, addDays, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Target, Flag, Layers, CalendarClock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const SORA = { fontFamily: "'Sora', system-ui, sans-serif" } as const;
const COLORS = ["#e8c466", "#5aa9e6", "#9c7bd6", "#5fbf82", "#e8974a", "#e56464"];
const D = (s: string) => new Date(/[T ]/.test(s) ? s : s + "T00:00:00");

interface Meso { id: string; name: string; start_date: string; end_date: string | null; color: string | null; }
interface Micro { id: string; name: string; start_date: string; end_date: string | null; mesocycle_id: string; }

/**
 * Bandeau de contexte en haut de l'onglet Prog (côté coach) : 3 tuiles
 *  1) Microcycle en cours  2) Objectif principal + compte à rebours  3) Prochain sous-objectif.
 * Lecture seule, alimenté par le macrocycle ACTIF (non archivé) — cohérent avec Vue d'ensemble.
 */
export function ProgContextHeader({ athleteId, onGoToOverview }: { athleteId: string; onGoToOverview?: () => void }) {
  const [mesos, setMesos] = useState<Meso[]>([]);
  const [micros, setMicros] = useState<Micro[]>([]);
  const [hasMacro, setHasMacro] = useState(false);
  const [objName, setObjName] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<{ label: string; target_date: string }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: macroRows } = await supabase.from("macrocycles").select("id").eq("athlete_id", athleteId).is("archived_at", null).order("start_date", { ascending: false }).limit(1);
      const mac = (macroRows || [])[0] as any;
      setHasMacro(!!mac);
      let mz: any[] = [];
      if (mac) {
        const { data } = await supabase.from("mesocycles").select("id, name, start_date, end_date, color").eq("athlete_id", athleteId).eq("macrocycle_id", mac.id);
        mz = (data || []).filter((m: any) => m.start_date);
      } else {
        const { data } = await supabase.from("mesocycles").select("id, name, start_date, end_date, color").eq("athlete_id", athleteId).is("macrocycle_id", null);
        mz = (data || []).filter((m: any) => m.start_date);
      }
      setMesos(mz);
      if (mz.length) {
        const { data: mc } = await supabase.from("microcycles").select("id, name, start_date, end_date, mesocycle_id").in("mesocycle_id", mz.map((m) => m.id));
        setMicros((mc || []) as Micro[]);
      }
      const { data: objRows } = await supabase.from("athlete_objectives").select("main_objective, main_objective_deadline").eq("athlete_id", athleteId).order("updated_at", { ascending: false }).limit(1);
      setObjName(objRows?.[0]?.main_objective || null);
      setDeadline(objRows?.[0]?.main_objective_deadline || null);
      const { data: ms } = await supabase.from("objective_milestones").select("label, target_date, completed, approval_status").eq("athlete_id", athleteId);
      setMilestones((ms || []).filter((m: any) => m.target_date && !m.completed && m.approval_status !== "pending").map((m: any) => ({ label: m.label, target_date: m.target_date })));
      setLoaded(true);
    })();
  }, [athleteId]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weeksUntil = (d: string) => Math.ceil((D(d).getTime() - today.getTime()) / (7 * 86400000));
  const fmtLeft = (days: number) => { if (days <= 0) return "dernier jour"; const w = Math.floor(days / 7), d = days % 7; return [w ? `${w} sem.` : "", d ? `${d} j` : ""].filter(Boolean).join(" · ") || `${days} j`; };

  // Méso + micro en cours (par position dans le méso, robuste aux dates décalées)
  const curMeso = mesos.find((m) => { const e = m.end_date ? D(m.end_date) : addDays(D(m.start_date), 28); return today >= D(m.start_date) && today <= e; }) || null;
  let curMicro: { name: string; start: Date; end: Date } | null = null;
  if (curMeso) {
    const list = micros.filter((m) => m.mesocycle_id === curMeso.id).sort((a, b) => D(a.start_date).getTime() - D(b.start_date).getTime());
    let acc = 0;
    for (const mc of list) {
      const mw = mc.end_date ? Math.max(1, Math.round((differenceInCalendarDays(D(mc.end_date), D(mc.start_date)) + 1) / 7)) : 1;
      const s = addWeeks(D(curMeso.start_date), acc); const e = addDays(addWeeks(D(curMeso.start_date), acc + mw), -1);
      if (today >= s && today <= e) { curMicro = { name: mc.name, start: s, end: e }; break; }
      acc += mw;
    }
  }
  const mesoColor = curMeso ? (curMeso.color || COLORS[Math.max(0, mesos.findIndex((m) => m.id === curMeso.id)) % COLORS.length]) : "#e8c466";
  const nextMs = milestones.filter((m) => weeksUntil(m.target_date) >= 0).sort((a, b) => D(a.target_date).getTime() - D(b.target_date).getTime())[0] || null;
  const objWeeks = deadline ? weeksUntil(deadline) : null;

  if (!loaded) return null;

  const Tile = ({ children, tone }: { children: React.ReactNode; tone?: string }) => (
    <div className="flex-1 min-w-[180px] rounded-xl border bg-card/60 px-3 py-2.5" style={{ borderColor: tone ? `${tone}44` : undefined }}>{children}</div>
  );

  return (
    <div className="flex gap-2 flex-wrap">
      {/* Tuile 1 — Microcycle en cours */}
      <Tile tone={curMicro ? mesoColor : undefined}>
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          <Layers className="h-3.5 w-3.5" style={{ color: mesoColor }} /> Microcycle
        </div>
        {curMicro ? (
          <>
            <p className="text-base font-black leading-tight mt-0.5 truncate" style={SORA}>{curMicro.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {curMeso && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: mesoColor, background: `${mesoColor}22` }}>{curMeso.name}</span>}
              <span className="text-[10px] font-bold text-primary inline-flex items-center gap-0.5"><CalendarClock className="h-3 w-3" /> {fmtLeft(Math.max(0, differenceInCalendarDays(curMicro.end, today)))}</span>
            </div>
          </>
        ) : (
          <button type="button" onClick={onGoToOverview} className="mt-1 text-[12px] text-amber-500 font-medium inline-flex items-center gap-1 hover:underline">
            <AlertTriangle className="h-3.5 w-3.5" /> Aucun microcycle en cours · programmer
          </button>
        )}
      </Tile>

      {/* Tuile 2 — Objectif principal */}
      <Tile tone="#e8c466">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          <Target className="h-3.5 w-3.5 text-primary" /> Objectif
        </div>
        {objName ? (
          <>
            <p className="text-base font-black leading-tight mt-0.5 truncate" style={SORA}>{objName}</p>
            {objWeeks != null && (
              <span className={cn("text-[11px] font-bold inline-flex items-center gap-1 mt-0.5", objWeeks < 0 ? "text-red-400" : objWeeks <= 3 ? "text-orange-400" : "text-primary")}>
                <CalendarClock className="h-3 w-3" /> {objWeeks < 0 ? `dépassé · ${Math.abs(objWeeks)} sem.` : objWeeks === 0 ? "cette semaine !" : `dans ${objWeeks} sem.`}
              </span>
            )}
          </>
        ) : <p className="text-sm text-muted-foreground italic mt-1">Aucun objectif défini</p>}
      </Tile>

      {/* Tuile 3 — Prochain sous-objectif */}
      <Tile tone="#5aa9e6">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          <Flag className="h-3.5 w-3.5" style={{ color: "#5aa9e6" }} /> Prochain sous-objectif
        </div>
        {nextMs ? (
          <>
            <p className="text-base font-black leading-tight mt-0.5 truncate" style={SORA}>{nextMs.label}</p>
            <span className={cn("text-[11px] font-bold inline-flex items-center gap-1 mt-0.5", weeksUntil(nextMs.target_date) <= 1 ? "text-orange-400" : "text-foreground")}>
              <CalendarClock className="h-3 w-3" /> {weeksUntil(nextMs.target_date) === 0 ? "cette semaine !" : `dans ${weeksUntil(nextMs.target_date)} sem.`}
              <span className="text-muted-foreground font-normal">· {format(D(nextMs.target_date), "d MMM", { locale: fr })}</span>
            </span>
          </>
        ) : <p className="text-sm text-muted-foreground italic mt-1">Aucun sous-objectif à venir</p>}
      </Tile>
    </div>
  );
}
