import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, addWeeks, addDays, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Target, Flag, AlertTriangle, CheckCircle2, CalendarClock, Layers, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
export function ProgObjectiveBanner({ athleteId, heading, variant = "phases" }: { athleteId: string; heading?: string; variant?: "phases" | "clean" }) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [objName, setObjName] = useState<string | null>(null);
  const [objCompleted, setObjCompleted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dismissedMs, setDismissedMs] = useState<string[]>([]);
  const [validatingMs, setValidatingMs] = useState<string | null>(null);

  useEffect(() => {
    try { setDismissedMs(JSON.parse(localStorage.getItem(`ms_prompt_dismissed_${athleteId}`) || "[]")); } catch { /* ignore */ }
  }, [athleteId]);

  const dismissMsPrompt = (id: string) => {
    setDismissedMs((prev) => {
      const next = [...new Set([...prev, id])];
      try { localStorage.setItem(`ms_prompt_dismissed_${athleteId}`, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const validateMilestone = async (id: string) => {
    setValidatingMs(id);
    const { error } = await supabase
      .from("objective_milestones")
      .update({ completed: true, completed_at: new Date().toISOString() } as any)
      .eq("id", id);
    setValidatingMs(null);
    if (error) { console.error(error); toast.error("Validation impossible"); return; }
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, completed: true, completed_at: new Date().toISOString() } : m)));
    toast.success("Étape validée ✓");
  };

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

  // Jalons dont la date est aujourd'hui/passée, non validés, non masqués → à confirmer
  const duePrompts = variant === "phases"
    ? datedMs
        .filter((x) => !x.m.completed && x.m.approval_status !== "pending" && weeksUntil(x.d) <= 0 && !dismissedMs.includes(x.m.id))
        .sort((a, b) => D(b.d).getTime() - D(a.d).getTime())
    : [];
  const duePrompt = duePrompts[0] || null;

  return (
    <>
    <div className="rounded-xl border border-border/40 bg-card px-4 py-3 space-y-2.5">
      {heading && (
        <div className="flex items-center gap-2">
          <span className="font-bold text-[15px]" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>{heading}</span>
        </div>
      )}
      {/* ── Variante « clean » (sportif) : route verticale claire, sans phases ── */}
      {variant === "clean" ? (
        (() => {
          const items = [
            ...datedMs.map((x) => ({ key: x.m.id, label: x.m.label, date: x.d, done: x.m.completed, isObjective: false })),
            ...(objName ? [{ key: "obj", label: objName, date: deadline, done: objCompleted, isObjective: true }] : []),
          ].sort((a, b) => {
            if (!a.date) return 1;
            if (!b.date) return -1;
            return D(a.date).getTime() - D(b.date).getTime();
          });
          if (items.length === 0) {
            return <p className="text-sm text-muted-foreground italic">Aucun objectif défini pour l'instant.</p>;
          }
          return (
            <div className="relative pl-1">
              {items.map((it, i) => {
                const wk = it.date ? weeksUntil(it.date) : null;
                const isLast = i === items.length - 1;
                return (
                  <div key={it.key} className="relative flex items-start gap-3 pb-3 last:pb-0">
                    {/* Ligne verticale reliant les points */}
                    {!isLast && <span className="absolute left-[6px] top-4 bottom-0 w-px bg-border" />}
                    {/* Point */}
                    <span className={cn(
                      "relative z-10 mt-1 shrink-0 flex items-center justify-center rounded-full",
                      it.isObjective ? "h-3.5 w-3.5" : "h-3 w-3",
                      it.done ? "bg-emerald-500" : it.isObjective ? "bg-primary ring-2 ring-primary/25" : "bg-primary/70",
                    )} />
                    {/* Contenu */}
                    <div className="min-w-0 flex-1 flex items-baseline gap-2">
                      <span className={cn(
                        "truncate leading-tight",
                        it.isObjective ? "text-sm font-semibold" : "text-sm",
                        it.done && "text-emerald-600 line-through decoration-emerald-600/40",
                      )}>
                        {it.isObjective && "🎯 "}{it.label}
                      </span>
                      <span className={cn(
                        "ml-auto shrink-0 text-[11px] font-semibold tabular-nums",
                        it.done ? "text-emerald-600" : "text-primary",
                      )}>
                        {it.done
                          ? "validé ✓"
                          : wk == null
                            ? ""
                            : wk <= 0
                              ? (it.isObjective ? "aujourd'hui" : "cette semaine")
                              : `dans ${wk} sem.`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()
      ) : (
      <>
      {(() => {
        const objWeeks = deadline && !objCompleted ? weeksUntil(deadline) : null;
        const currentPhase = idxCurrent >= 0 ? phases[idxCurrent] : null;
        const currentPhaseColor = currentPhase ? (currentPhase.color || COLORS[idxCurrent % COLORS.length]) : null;
        const nextMsWeeks = nextMs ? weeksUntil(nextMs.d) : null;
        const overdueMs = datedMs.filter((x) => !x.m.completed && weeksUntil(x.d) < 0);
        const nothingPlanned = !currentPhase && !nextMs && (objCompleted || objWeeks == null || objWeeks < 0);

        // Pastille de statut d'une échéance en semaines
        const statusPill = (weeks: number | null, done: boolean) => {
          if (done) return { text: "Atteint", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", Icon: CheckCircle2 };
          if (weeks == null) return null;
          if (weeks < 0) return { text: `Dépassé · ${Math.abs(weeks)} sem.`, cls: "bg-red-500/15 text-red-400 border-red-500/40", Icon: AlertTriangle };
          if (weeks === 0) return { text: "Cette semaine !", cls: "bg-red-500/15 text-red-400 border-red-500/40 animate-pulse", Icon: AlertTriangle };
          if (weeks === 1) return { text: "Dans 1 semaine !", cls: "bg-orange-500/20 text-orange-400 border-orange-500/40 animate-pulse", Icon: AlertTriangle };
          if (weeks <= 3) return { text: `Dans ${weeks} sem.`, cls: "bg-amber-500/15 text-amber-500 border-amber-500/30", Icon: CalendarClock };
          return { text: `Dans ${weeks} sem.`, cls: "bg-primary/10 text-primary border-primary/30", Icon: CalendarClock };
        };
        const objPill = statusPill(objWeeks, objCompleted);

        return (
        <div className="space-y-2">
          {/* Ligne 1 — Objectif principal + statut bien visible */}
          <div className="flex items-center gap-2 flex-wrap">
            <Target className="h-4 w-4 text-primary shrink-0" />
            {objName ? (
              <span className={cn("font-semibold text-sm truncate max-w-[55%]", objCompleted && "text-emerald-500")}>{objName}</span>
            ) : (
              <span className="text-sm text-muted-foreground italic">Aucun objectif défini</span>
            )}
            {objPill && (
              <span className={cn("inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border", objPill.cls)}>
                <objPill.Icon className="h-3 w-3" /> {objPill.text}
              </span>
            )}
          </div>

          {/* Ligne 2 — Phase en cours + prochaine étape, en chips clairs */}
          <div className="flex items-center gap-2 flex-wrap">
            {currentPhase ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border"
                style={{ color: currentPhaseColor!, borderColor: `${currentPhaseColor}66`, background: `${currentPhaseColor}1f` }}>
                <span className="h-2 w-2 rounded-full" style={{ background: currentPhaseColor! }} />
                {currentPhase.name} · en cours
              </span>
            ) : phases.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground px-2 py-0.5 rounded-full border border-border">
                <Layers className="h-3 w-3" /> Aucune phase en cours
              </span>
            ) : null}

            {nextMs && (
              <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                <Flag className="h-3 w-3 text-primary" />
                Prochaine étape : <span className="font-semibold text-foreground truncate max-w-[160px]">{nextMs.m.label}</span>
                <span className={cn("font-bold", (nextMsWeeks ?? 9) <= 1 ? "text-orange-400" : "text-primary")}>
                  {nextMsWeeks === 0 ? "cette sem." : `dans ${nextMsWeeks} sem.`}
                </span>
              </span>
            )}
          </div>

          {/* Alertes claires */}
          {objPill && objWeeks != null && objWeeks >= 0 && objWeeks <= 1 && !objCompleted && (
            <div className="flex items-center gap-2 rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0" />
              <p className="text-sm font-medium">Objectif <span className="font-bold">{objWeeks === 0 ? "cette semaine" : "dans 1 semaine"}</span> : {objName}. Prépare la dernière ligne droite.</p>
            </div>
          )}
          {objWeeks != null && objWeeks < 0 && !objCompleted && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-sm font-medium">Échéance de l'objectif <span className="font-bold">dépassée</span> ({Math.abs(objWeeks)} sem.). Marque-le atteint ou fixe une nouvelle date.</p>
            </div>
          )}
          {overdueMs.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/[0.07] px-3 py-2">
              <Flag className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-sm">{overdueMs.length} étape{overdueMs.length > 1 ? "s" : ""} passée{overdueMs.length > 1 ? "s" : ""} non validée{overdueMs.length > 1 ? "s" : ""} : <span className="font-medium">{overdueMs.map((x) => x.m.label).join(", ")}</span></p>
            </div>
          )}
          {nothingPlanned && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-sm font-medium">Plus rien de prévu — pense à programmer la suite (nouvelle phase, étape ou objectif).</p>
            </div>
          )}
        </div>
        );
      })()}

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
                <div key={p.id} className={cn("absolute top-0 h-full", i === idxCurrent ? "z-10 ring-1 ring-white/70 ring-inset" : "opacity-70")}
                  style={{ left: `${pos(s)}%`, width: `${Math.max(2, pos(e) - pos(s))}%`, backgroundColor: col }}
                  title={`${p.name} · ${range}`} />
              );
            })}
            <div className="absolute top-0 h-full w-0.5 bg-white z-20" style={{ left: `${todayPct}%` }} title="Aujourd'hui" />
          </div>
          {/* Points jalons + objectif */}
          <div className="relative h-4 mt-0.5">
            {datedMs.map(({ m, d }) => {
              const w = weeksUntil(d);
              const col = m.completed ? "bg-emerald-500" : w < 0 ? "bg-red-500" : w <= 1 ? "bg-orange-400 animate-pulse" : "bg-primary";
              return (
                <span key={m.id}
                  className={cn("absolute top-1 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-background", col)}
                  style={{ left: `${pos(D(d).getTime())}%` }}
                  title={`${m.label} · ${format(D(d), "d MMM yyyy", { locale: fr })}${m.completed ? " (validé)" : w < 0 ? ` · dépassé (${Math.abs(w)} sem.)` : ` · dans ${w} sem.`}`} />
              );
            })}
            {dl && (
              <span className="absolute -top-0.5 -translate-x-1/2 text-[11px]" style={{ left: `${pos(dl.getTime())}%` }} title={`Objectif · ${format(dl, "d MMM yyyy", { locale: fr })}`}>🎯</span>
            )}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>Auj.</span>
            <span>{dl ? format(dl, "d MMM yyyy", { locale: fr }) : "Objectif"}</span>
          </div>

          {/* Légende : noms des phases et des jalons, sans chevauchement */}
          {(phases.length > 0 || datedMs.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
              {phases.map((p, i) => {
                const col = p.color || COLORS[i % COLORS.length];
                return (
                  <span key={`lg-${p.id}`} className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: col }} />
                    <span className={cn(i === idxCurrent ? "font-semibold text-foreground" : "text-muted-foreground")}>
                      {p.name}{i === idxCurrent ? " · en cours" : ""}
                    </span>
                  </span>
                );
              })}
              {datedMs.map(({ m, d }) => (
                <span key={`lgm-${m.id}`} className="inline-flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full shrink-0", m.completed ? "bg-emerald-500" : "bg-primary")} />
                  <span className={cn(m.completed ? "text-emerald-600 line-through decoration-emerald-600/40" : "text-muted-foreground")}>
                    {m.label}
                  </span>
                  <span className={cn("shrink-0 tabular-nums", m.completed ? "text-emerald-600" : "text-primary")}>
                    {m.completed ? "✓" : `${weeksUntil(d)} sem.`}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      </>
      )}
    </div>

    {/* Rappel flottant : jalon passé à confirmer */}
    {duePrompt && (
      <div className="fixed bottom-4 right-4 z-[80] w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-primary/40 bg-card shadow-2xl p-4 animate-in slide-in-from-bottom-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Flag className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-semibold" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Étape à confirmer</span>
          </div>
          <button type="button" onClick={() => dismissMsPrompt(duePrompt.m.id)} className="h-7 w-7 -mr-1 -mt-1 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Plus tard">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm mt-2 leading-snug">
          <span className="font-semibold">{duePrompt.m.label}</span> était prévu le {format(D(duePrompt.d), "d MMMM", { locale: fr })}. C'est fait ?
        </p>
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={() => dismissMsPrompt(duePrompt.m.id)}
            className="flex-1 h-9 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">
            Pas encore
          </button>
          <button type="button" onClick={() => validateMilestone(duePrompt.m.id)} disabled={validatingMs === duePrompt.m.id}
            className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98]">
            {validatingMs === duePrompt.m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Validé
          </button>
        </div>
      </div>
    )}
    </>
  );
}
