import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, addWeeks, addDays, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface Phase {
  id: string;
  name: string;
  start_date: string;
  end_date?: string | null;
  color?: string | null;
}

interface Milestone {
  id: string;
  label: string;
  target_date?: string | null;
  completed: boolean;
  completed_at?: string | null;
  approval_status?: string | null;
}

const COLORS = ["#e8c466", "#5aa9e6", "#9c7bd6", "#5fbf82", "#e8974a", "#e56464"];

/**
 * Bannière inline en haut de l'onglet Prog : objectif principal + timeline
 * de validation (phases, jalons, échéance). Remplace l'ancienne bannière de
 * progression (phase / volume / intensité).
 */
export function ProgObjectiveBanner({ athleteId }: { athleteId: string }) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [objName, setObjName] = useState<string | null>(null);
  const [objCompleted, setObjCompleted] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: mesos } = await supabase
        .from("mesocycles")
        .select("id, name, start_date, end_date, color, macrocycle_id")
        .eq("athlete_id", athleteId)
        .is("macrocycle_id", null);
      setPhases((mesos || []).filter((m: any) => m.start_date).sort((a: any, b: any) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()));

      const { data: objRows } = await supabase
        .from("athlete_objectives")
        .select("main_objective, main_objective_deadline, main_completed")
        .eq("athlete_id", athleteId)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (objRows?.[0]) {
        setDeadline(objRows[0].main_objective_deadline || null);
        setObjName(objRows[0].main_objective || null);
        setObjCompleted(!!(objRows[0] as any).main_completed);
      }

      const { data: ms } = await supabase
        .from("objective_milestones")
        .select("id, label, target_date, completed, completed_at, approval_status")
        .eq("athlete_id", athleteId);
      setMilestones((ms || []).filter((m: Milestone) => m.approval_status !== "pending"));
      setLoaded(true);
    })();
  }, [athleteId]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const D = (s: string) => new Date(s + "T00:00:00");
  const dl = deadline ? D(deadline) : null;
  const endOf = (p: Phase) => (p.end_date ? D(p.end_date) : (dl || addDays(D(p.start_date), 14)));

  const msDate = (m: Milestone) => (m.completed ? m.completed_at || m.target_date : m.target_date) || null;
  const datedMs = milestones.map((m) => ({ m, d: msDate(m) })).filter((x) => x.d) as { m: Milestone; d: string }[];
  const weeksUntil = (d: string) => Math.ceil((D(d).getTime() - today.getTime()) / (7 * 86400000));
  const nextMs = datedMs
    .filter((x) => !x.m.completed && weeksUntil(x.d) >= 0)
    .sort((a, b) => D(a.d).getTime() - D(b.d).getTime())[0] || null;

  if (!loaded) return null;
  if (!objName && phases.length === 0 && datedMs.length === 0 && !dl) return null;

  const idxCurrent = phases.findIndex((p) => today >= D(p.start_date) && today <= endOf(p));

  // Échelle timeline
  const endCandidates = [
    ...phases.map((p) => endOf(p).getTime()),
    ...datedMs.map((x) => D(x.d).getTime()),
    ...(dl ? [dl.getTime()] : []),
  ];
  const rangeEnd = dl || new Date(endCandidates.length ? Math.max(...endCandidates) : addWeeks(today, 8).getTime());
  const startCandidates = [
    today.getTime(),
    ...phases.map((p) => D(p.start_date).getTime()),
    ...datedMs.map((x) => D(x.d).getTime()),
  ];
  const start0 = new Date(Math.min(...startCandidates));
  const totalMs = Math.max(1, rangeEnd.getTime() - start0.getTime());
  const pos = (ms: number) => Math.max(0, Math.min(100, ((ms - start0.getTime()) / totalMs) * 100));
  const todayPct = pos(today.getTime());

  return (
    <div className="rounded-xl border border-border/40 bg-card px-4 py-3 space-y-2.5">
      {/* Objectif principal + prochain jalon */}
      <div className="flex items-center gap-2 flex-wrap">
        <Target className="h-4 w-4 text-primary shrink-0" />
        {objName ? (
          <>
            <span className={cn("font-semibold text-sm truncate max-w-[60%]", objCompleted && "text-emerald-600")}>{objName}</span>
            {dl && !objCompleted && <span className="text-[11px] text-primary font-semibold shrink-0">dans {weeksUntil(deadline!)} sem.</span>}
            {objCompleted && <span className="text-[11px] text-emerald-600 font-semibold shrink-0">Atteint ✓</span>}
          </>
        ) : (
          <span className="text-sm text-muted-foreground italic">Aucun objectif défini</span>
        )}
        {nextMs && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
            <span className="truncate">{nextMs.m.label}</span>
            <span className="text-primary font-semibold shrink-0">dans {weeksUntil(nextMs.d)} sem.</span>
          </span>
        )}
      </div>

      {/* Timeline */}
      {(phases.length > 0 || datedMs.length > 0 || dl) && (
        <div>
          <div className="relative h-3 rounded-full bg-muted/40 overflow-hidden">
            {phases.map((p, i) => {
              const s = D(p.start_date).getTime();
              const e = endOf(p).getTime() + 86400000;
              const col = p.color || COLORS[i % COLORS.length];
              const range = `${format(D(p.start_date), "d MMM", { locale: fr })}${p.end_date ? ` → ${format(new Date(p.end_date), "d MMM", { locale: fr })}` : " → en cours"}`;
              return (
                <div key={p.id} className={cn("absolute top-0 h-full", i === idxCurrent ? "z-10" : "")}
                  style={{ left: `${pos(s)}%`, width: `${Math.max(2, pos(e) - pos(s))}%`, backgroundColor: col }}
                  title={`${p.name} · ${range}`} />
              );
            })}
            <div className="absolute top-0 h-full w-0.5 bg-white z-20" style={{ left: `${todayPct}%` }} title="Aujourd'hui" />
          </div>
          {/* Points jalons + objectif */}
          <div className="relative h-4 mt-0.5">
            {datedMs.map(({ m, d }) => (
              <span key={m.id}
                className={cn("absolute top-1 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-background", m.completed ? "bg-emerald-500" : "bg-primary")}
                style={{ left: `${pos(D(d).getTime())}%` }}
                title={`${m.label} · ${format(D(d), "d MMM yyyy", { locale: fr })}${m.completed ? " (validé)" : ` · dans ${weeksUntil(d)} sem.`}`} />
            ))}
            {dl && (
              <span className="absolute -top-0.5 -translate-x-1/2 text-[11px]" style={{ left: `${pos(dl.getTime())}%` }} title={`Objectif · ${format(dl, "d MMM yyyy", { locale: fr })}`}>🎯</span>
            )}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>Auj.</span>
            <span>{dl ? format(dl, "d MMM yyyy", { locale: fr }) : "Objectif"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
