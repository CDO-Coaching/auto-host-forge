import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, addWeeks, addDays, differenceInCalendarDays, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { X, ChevronDown, ChevronUp, Layers } from "lucide-react";
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
 * Panneau flottant affiché dans l'onglet Prog : timeline + phase actuelle
 * avec le nombre de semaines restantes.
 */
export function ProgPhaseFloating({ athleteId }: { athleteId: string }) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [objName, setObjName] = useState<string | null>(null);
  const [objCompleted, setObjCompleted] = useState(false);
  // Fermeture mémorisée par semaine : s'il est fermé une fois, il reste fermé le reste de la semaine
  const weekKey = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const dismissKey = `perio_dismissed_${athleteId}_${weekKey}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(dismissKey) === "1"; } catch { return false; }
  });
  const closePanel = () => { try { localStorage.setItem(dismissKey, "1"); } catch { /* ignore */ } setDismissed(true); };
  const [collapsed, setCollapsed] = useState(false);
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
  // Parse les dates "yyyy-MM-dd" en heure LOCALE (sinon décalage UTC → phase du jour vue comme future)
  const D = (s: string) => new Date(s + "T00:00:00");
  const dl = deadline ? D(deadline) : null;
  const endOf = (p: Phase) => (p.end_date ? D(p.end_date) : (dl || addDays(D(p.start_date), 14)));

  // Jalons datés (validation si atteint, sinon date cible)
  const msDate = (m: Milestone) => (m.completed ? m.completed_at || m.target_date : m.target_date) || null;
  const datedMs = milestones.map((m) => ({ m, d: msDate(m) })).filter((x) => x.d) as { m: Milestone; d: string }[];
  const weeksUntil = (d: string) => Math.ceil((D(d).getTime() - today.getTime()) / (7 * 86400000));
  const nextMs = datedMs
    .filter((x) => !x.m.completed && weeksUntil(x.d) >= 0)
    .sort((a, b) => D(a.d).getTime() - D(b.d).getTime())[0] || null;

  if (dismissed || !loaded || (phases.length === 0 && datedMs.length === 0 && !dl)) return null;

  // Phase en cours
  const idxCurrent = phases.findIndex((p) => today >= D(p.start_date) && today <= endOf(p));
  const current = idxCurrent >= 0 ? phases[idxCurrent] : null;
  const currentColor = current ? (current.color || COLORS[idxCurrent % COLORS.length]) : null;

  let weekInfo: { current: number; total: number; remaining: number } | null = null;
  if (current) {
    const s = D(current.start_date), e = endOf(current);
    const total = Math.max(1, Math.round((differenceInCalendarDays(e, s) + 1) / 7));
    const done = Math.max(0, Math.floor(differenceInCalendarDays(today, s) / 7));
    const remaining = Math.max(0, Math.ceil((differenceInCalendarDays(e, today) + 1) / 7));
    weekInfo = { current: Math.min(total, done + 1), total, remaining };
  }
  // Prochaine phase si aucune en cours
  const next = !current ? phases.find((p) => D(p.start_date) > today) : null;

  // Échelle timeline (phases + jalons + objectif)
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
    <div className="fixed z-40 bottom-4 right-4 left-4 sm:left-auto sm:w-[360px]">
      <div className="rounded-2xl border border-primary/30 bg-card shadow-xl shadow-black/30 overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border/40 bg-card">
          <Layers className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold flex-1 truncate">Périodisation</span>
          <button onClick={() => setCollapsed((v) => !v)} className="p-1 text-muted-foreground hover:text-foreground">
            {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button onClick={closePanel} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!collapsed && (
          <div className="p-3.5 space-y-3">
            {/* Phase actuelle */}
            {current ? (
              <div className="rounded-xl border p-3" style={{ borderColor: `${currentColor}55`, backgroundColor: `${currentColor}12` }}>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: currentColor! }} />
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Phase en cours</p>
                </div>
                <p className="font-semibold text-sm mt-1 leading-tight">{current.name}</p>
                {weekInfo && (
                  <div className="flex items-baseline gap-2 mt-1.5">
                    <span className="text-2xl font-bold tabular-nums" style={{ color: currentColor! }}>{weekInfo.remaining}</span>
                    <span className="text-xs text-muted-foreground">semaine{weekInfo.remaining > 1 ? "s" : ""} restante{weekInfo.remaining > 1 ? "s" : ""}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">Sem. {weekInfo.current}/{weekInfo.total}</span>
                  </div>
                )}
              </div>
            ) : next ? (
              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Prochaine phase</p>
                <p className="font-semibold text-sm mt-1">{next.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Démarre le {format(D(next.start_date), "d MMM yyyy", { locale: fr })}</p>
              </div>
            ) : phases.length > 0 ? (
              <p className="text-sm text-muted-foreground text-center py-1">Aucune phase en cours.</p>
            ) : null}

            {/* Objectif principal */}
            {objName && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-base">🎯</span>
                <span className={cn("font-semibold truncate flex-1", objCompleted && "text-emerald-600")}>{objName}</span>
                {dl && !objCompleted && <span className="text-[11px] text-primary font-semibold shrink-0">dans {weeksUntil(deadline!)} sem.</span>}
                {objCompleted && <span className="text-[11px] text-emerald-600 font-semibold shrink-0">Atteint ✓</span>}
              </div>
            )}

            {/* Prochain jalon */}
            {nextMs && (
              <div className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none">Prochain sous-objectif</p>
                  <p className="font-medium truncate leading-tight">{nextMs.m.label}</p>
                </div>
                <span className="text-[11px] text-primary font-semibold shrink-0">dans {weeksUntil(nextMs.d)} sem.</span>
              </div>
            )}

            {/* Mini timeline */}
            <div>
              <div className="relative h-3.5 rounded-full bg-muted/40 overflow-hidden">
                {phases.map((p, i) => {
                  const s = D(p.start_date).getTime();
                  // fin étendue au jour suivant pour toucher la phase suivante (pas de blanc d'1 jour)
                  const e = endOf(p).getTime() + 86400000;
                  const col = p.color || COLORS[i % COLORS.length];
                  const range = `${format(D(p.start_date), "d MMM", { locale: fr })}${p.end_date ? ` → ${format(new Date(p.end_date), "d MMM", { locale: fr })}` : " → en cours"}`;
                  return (
                    <div key={p.id} className={cn("absolute top-0 h-full", i === idxCurrent ? "z-10" : "")}
                      style={{ left: `${pos(s)}%`, width: `${Math.max(2, pos(e) - pos(s))}%`, backgroundColor: col }}
                      title={`${p.name} · ${range}`} />
                  );
                })}
                {/* curseur aujourd'hui */}
                <div className="absolute top-0 h-full w-0.5 bg-white z-20" style={{ left: `${todayPct}%` }} title="Aujourd'hui" />
              </div>
              {/* Points objectif + jalons */}
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
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                <span>Auj.</span>
                <span>{dl ? format(dl, "d MMM yyyy", { locale: fr }) : "Objectif"}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
