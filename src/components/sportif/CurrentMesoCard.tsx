import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarClock, Flag, Target, MessageSquare, X, ChevronRight, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface MesoInfo {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  description: string | null;
  coach_note: string | null;
  color: string | null;
}

interface MilestoneInfo {
  id: string;
  label: string;
  target_date: string | null;
  notes: string | null;
}

interface ObjectiveInfo {
  main_objective: string | null;
  main_objective_deadline: string | null;
}

type Sheet = "meso" | "milestone" | "objective" | null;

function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col justify-end"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative rounded-t-3xl bg-card border-t border-border shadow-2xl px-5 pt-5 pb-8 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function CurrentMesoCard({ athleteId }: { athleteId: string }) {
  const [meso, setMeso] = useState<MesoInfo | null>(null);
  const [nextMilestone, setNextMilestone] = useState<MilestoneInfo | null>(null);
  const [objective, setObjective] = useState<ObjectiveInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);

  useEffect(() => {
    if (!athleteId) return;
    (async () => {
      const today = new Date().toISOString().split("T")[0];

      const { data: past } = await supabase
        .from("mesocycles")
        .select("id, name, start_date, end_date, description, coach_note, color")
        .eq("athlete_id", athleteId)
        .lte("start_date", today)
        .order("start_date", { ascending: false })
        .limit(10);

      let current: MesoInfo | null = null;
      for (const m of past ?? []) {
        const end = m.end_date ?? "9999-12-31";
        if (today <= end) { current = m; break; }
      }
      if (!current) {
        const { data: upcoming } = await supabase
          .from("mesocycles")
          .select("id, name, start_date, end_date, description, coach_note, color")
          .eq("athlete_id", athleteId)
          .gte("start_date", today)
          .order("start_date", { ascending: true })
          .limit(1);
        current = upcoming?.[0] ?? null;
      }
      setMeso(current);

      const { data: msData } = await supabase
        .from("objective_milestones")
        .select("id, label, target_date, notes")
        .eq("athlete_id", athleteId)
        .eq("completed", false)
        .gte("target_date", today)
        .order("target_date", { ascending: true })
        .limit(1);
      setNextMilestone(msData?.[0] ?? null);

      const { data: objData } = await supabase
        .from("athlete_objectives")
        .select("main_objective, main_objective_deadline, main_completed")
        .eq("athlete_id", athleteId)
        .order("updated_at", { ascending: false })
        .limit(1);
      const obj = objData?.[0];
      if (obj && !obj.main_completed) {
        setObjective({ main_objective: obj.main_objective, main_objective_deadline: obj.main_objective_deadline });
      }
      setLoaded(true);
    })();
  }, [athleteId]);

  if (!loaded) return null;
  if (!meso && !nextMilestone && !objective) return null;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const D = (s: string) => new Date(/[T ]/.test(s) ? s : s + "T00:00:00");
  const daysLeft = (d: string) => differenceInCalendarDays(D(d), today);
  const fmtLeft = (days: number) => {
    if (days <= 0) return "aujourd'hui";
    if (days === 1) return "1 j";
    const w = Math.floor(days / 7), d = days % 7;
    if (w === 0) return `${d} j`;
    return d > 0 ? `${w} sem. ${d} j` : `${w} sem.`;
  };

  const color = meso?.color || "#c9944a";
  const comment = meso?.coach_note || meso?.description;
  const isUpcoming = meso ? D(meso.start_date) > today : false;
  const daysToEnd = meso?.end_date ? daysLeft(meso.end_date) : null;

  return (
    <>
      {/* ══════════════════════════════════════════════════
          BLOC 1 — PHASE / MÉSOCYCLE
      ══════════════════════════════════════════════════ */}
      {meso && (
        <button
          onClick={() => setSheet("meso")}
          className="w-full text-left rounded-[20px] border overflow-hidden active:opacity-80 transition-opacity"
          style={{ borderColor: `${color}55` }}
        >
          <div className="px-4 pt-3.5 pb-3.5 flex items-center gap-3" style={{ background: `${color}16` }}>
            {/* Pastille couleur + label */}
            <div
              className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: `${color}25` }}
            >
              <Layers className="h-5 w-5" style={{ color }} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-1">
                {isUpcoming ? "Prochaine phase" : "Phase en cours"}
              </p>
              <p
                className="font-black text-[18px] leading-none truncate"
                style={{ fontFamily: "'Sora', system-ui, sans-serif", color }}
              >
                {meso.name}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {format(D(meso.start_date), "d MMM", { locale: fr })}
                {meso.end_date && ` → ${format(D(meso.end_date), "d MMM", { locale: fr })}`}
              </p>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-1">
              {daysToEnd != null && daysToEnd >= 0 && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={{ color, background: `${color}22`, border: `1px solid ${color}44` }}
                >
                  <CalendarClock className="h-3 w-3" />
                  {fmtLeft(daysToEnd)}
                </span>
              )}
              {comment && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <MessageSquare className="h-3 w-3" />
                  commentaire
                </span>
              )}
            </div>
          </div>
        </button>
      )}

      {/* ══════════════════════════════════════════════════
          BLOC 2 — PROCHAINE ÉTAPE (jalon)
      ══════════════════════════════════════════════════ */}
      {nextMilestone?.target_date && (
        <button
          onClick={() => setSheet("milestone")}
          className="w-full text-left rounded-[20px] border border-border/60 bg-card overflow-hidden active:opacity-80 transition-opacity"
        >
          <div className="px-4 py-3.5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 bg-primary/10">
              <Flag className="h-5 w-5 text-primary" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-1">
                Prochaine étape
              </p>
              <p className="font-bold text-[14px] leading-snug truncate text-foreground">
                {nextMilestone.label}
              </p>
              {nextMilestone.notes && (
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {nextMilestone.notes}
                </p>
              )}
            </div>

            <div className="shrink-0 flex flex-col items-end gap-0.5 ml-2">
              <span
                className={cn(
                  "inline-flex text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap",
                  daysLeft(nextMilestone.target_date) <= 14
                    ? "bg-orange-500/15 text-orange-400"
                    : "bg-primary/10 text-primary",
                )}
              >
                {format(D(nextMilestone.target_date), "d MMM", { locale: fr })}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {fmtLeft(daysLeft(nextMilestone.target_date))}
              </span>
            </div>
          </div>
        </button>
      )}

      {/* ══════════════════════════════════════════════════
          BLOC 3 — OBJECTIF FINAL
      ══════════════════════════════════════════════════ */}
      {objective?.main_objective && objective.main_objective_deadline && (
        <button
          onClick={() => setSheet("objective")}
          className="w-full text-left rounded-[20px] border border-border/60 bg-card overflow-hidden active:opacity-80 transition-opacity"
        >
          <div className="px-4 py-3.5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 bg-amber-500/10">
              <Target className="h-5 w-5 text-amber-500" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none mb-1">
                Objectif final
              </p>
              <p className="font-bold text-[14px] leading-snug line-clamp-2 text-foreground">
                {objective.main_objective}
              </p>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-0.5 ml-2">
              <span className="inline-flex text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-amber-500/10 text-amber-500">
                {format(D(objective.main_objective_deadline), "d MMM yy", { locale: fr })}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {fmtLeft(daysLeft(objective.main_objective_deadline))}
              </span>
            </div>
          </div>
        </button>
      )}

      {/* ══════════════════════════════════════════════════
          BOTTOM SHEETS
      ══════════════════════════════════════════════════ */}

      {/* Sheet méso */}
      <BottomSheet open={sheet === "meso"} onClose={() => setSheet(null)}>
        {meso && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div
                className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: `${color}25` }}
              >
                <Layers className="h-5 w-5" style={{ color }} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {isUpcoming ? "Prochaine phase" : "Phase en cours"}
                </p>
                <p
                  className="font-black text-[20px] leading-tight"
                  style={{ fontFamily: "'Sora', system-ui, sans-serif", color }}
                >
                  {meso.name}
                </p>
              </div>
            </div>

            {/* Dates + durée restante */}
            <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] text-muted-foreground">Début</p>
                <p className="text-sm font-semibold">
                  {format(D(meso.start_date), "EEEE d MMMM yyyy", { locale: fr })}
                </p>
              </div>
              {meso.end_date && (
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">Fin</p>
                  <p className="text-sm font-semibold">
                    {format(D(meso.end_date), "EEEE d MMMM yyyy", { locale: fr })}
                  </p>
                </div>
              )}
            </div>

            {daysToEnd != null && daysToEnd >= 0 && (
              <div
                className="rounded-xl px-4 py-3 flex items-center gap-2"
                style={{ background: `${color}18`, border: `1px solid ${color}33` }}
              >
                <CalendarClock className="h-4 w-4 shrink-0" style={{ color }} />
                <p className="text-sm font-semibold" style={{ color }}>
                  Encore {fmtLeft(daysToEnd)} dans cette phase
                </p>
              </div>
            )}

            {/* Commentaire */}
            {comment ? (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Commentaire de ton coach
                </p>
                <div
                  className="rounded-xl px-4 py-3"
                  style={{ background: `${color}12`, border: `1px solid ${color}2e` }}
                >
                  <p className="text-sm leading-relaxed text-foreground/90">{comment}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic text-center py-2">
                Aucun commentaire pour cette phase.
              </p>
            )}
          </div>
        )}
      </BottomSheet>

      {/* Sheet jalon */}
      <BottomSheet open={sheet === "milestone"} onClose={() => setSheet(null)}>
        {nextMilestone && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 bg-primary/10">
                <Flag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Prochaine étape
                </p>
                <p
                  className="font-black text-[18px] leading-tight text-foreground"
                  style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
                >
                  {nextMilestone.label}
                </p>
              </div>
            </div>

            {nextMilestone.target_date && (
              <div
                className={cn(
                  "rounded-xl px-4 py-3 flex items-center gap-2",
                  daysLeft(nextMilestone.target_date) <= 14
                    ? "bg-orange-500/10 border border-orange-500/30"
                    : "bg-primary/10 border border-primary/20"
                )}
              >
                <CalendarClock
                  className={cn(
                    "h-4 w-4 shrink-0",
                    daysLeft(nextMilestone.target_date) <= 14 ? "text-orange-400" : "text-primary"
                  )}
                />
                <div>
                  <p
                    className={cn(
                      "text-sm font-bold",
                      daysLeft(nextMilestone.target_date) <= 14 ? "text-orange-400" : "text-primary"
                    )}
                  >
                    {format(D(nextMilestone.target_date), "EEEE d MMMM yyyy", { locale: fr })}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Dans {fmtLeft(daysLeft(nextMilestone.target_date))}
                  </p>
                </div>
              </div>
            )}

            {nextMilestone.notes ? (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Critères de validation
                </p>
                <div className="rounded-xl bg-muted/40 border border-border px-4 py-3">
                  <p className="text-sm leading-relaxed text-foreground/90">{nextMilestone.notes}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic text-center py-2">
                Pas de critères définis pour cette étape.
              </p>
            )}
          </div>
        )}
      </BottomSheet>

      {/* Sheet objectif */}
      <BottomSheet open={sheet === "objective"} onClose={() => setSheet(null)}>
        {objective?.main_objective && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 bg-amber-500/10">
                <Target className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Objectif final
                </p>
                <p
                  className="font-black text-[18px] leading-tight text-amber-500"
                  style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
                >
                  🎯 Objectif
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-4 py-4">
              <p className="text-[15px] font-semibold leading-snug text-foreground">
                {objective.main_objective}
              </p>
            </div>

            {objective.main_objective_deadline && (
              <div className="rounded-xl bg-muted/40 border border-border px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] text-muted-foreground">Deadline</p>
                  <p className="text-sm font-bold text-amber-500">
                    {format(D(objective.main_objective_deadline), "EEEE d MMMM yyyy", { locale: fr })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">Temps restant</p>
                  <p className="text-sm font-bold text-foreground">
                    {fmtLeft(daysLeft(objective.main_objective_deadline))}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </BottomSheet>
    </>
  );
}
