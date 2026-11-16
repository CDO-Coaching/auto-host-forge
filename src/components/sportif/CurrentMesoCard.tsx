import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarClock, Flag, Target, MessageSquare, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

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

export function CurrentMesoCard({ athleteId }: { athleteId: string }) {
  const navigate = useNavigate();
  const [meso, setMeso] = useState<MesoInfo | null>(null);
  const [nextMilestone, setNextMilestone] = useState<MilestoneInfo | null>(null);
  const [objective, setObjective] = useState<ObjectiveInfo | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!athleteId) return;
    (async () => {
      const today = new Date().toISOString().split("T")[0];

      // Méso en cours : start_date ≤ aujourd'hui, prend le plus récent
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

      // Si aucun en cours, prendre le prochain à venir
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

      // Prochain jalon non validé
      const { data: msData } = await supabase
        .from("objective_milestones")
        .select("id, label, target_date, notes")
        .eq("athlete_id", athleteId)
        .eq("completed", false)
        .gte("target_date", today)
        .order("target_date", { ascending: true })
        .limit(1);
      setNextMilestone(msData?.[0] ?? null);

      // Objectif principal non atteint
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

  const color = meso?.color || "#e8c466";
  const comment = meso?.coach_note || meso?.description;

  const isUpcoming = meso ? D(meso.start_date) > today : false;
  const daysToEnd = meso?.end_date ? daysLeft(meso.end_date) : null;

  return (
    <div
      className="rounded-[22px] border overflow-hidden cursor-pointer active:opacity-[0.85] transition-opacity"
      style={{ borderColor: `${color}44` }}
      onClick={() => navigate("/sportif/objectifs")}
    >
      {/* ── Bloc méso en cours ── */}
      {meso && (
        <div className="px-4 pt-4 pb-3 space-y-2.5" style={{ background: `${color}12` }}>
          {/* Titre + badge temps restant */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {isUpcoming ? "Prochaine phase" : "Phase en cours"}
              </span>
            </div>
            {daysToEnd != null && daysToEnd >= 0 && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{ color, background: `${color}22`, border: `1px solid ${color}44` }}
              >
                <CalendarClock className="h-3 w-3" />
                encore {fmtLeft(daysToEnd)}
              </span>
            )}
            {daysToEnd != null && daysToEnd < 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                Terminée
              </span>
            )}
          </div>

          {/* Nom méso */}
          <p
            className="font-black text-[17px] leading-tight"
            style={{ fontFamily: "'Sora', system-ui, sans-serif", color }}
          >
            {meso.name}
          </p>

          {/* Dates */}
          <p className="text-[11px] text-muted-foreground">
            {format(D(meso.start_date), "d MMM", { locale: fr })}
            {meso.end_date && ` → ${format(D(meso.end_date), "d MMM yyyy", { locale: fr })}`}
          </p>

          {/* Commentaire coach */}
          {comment && (
            <div
              className="flex items-start gap-2 rounded-xl px-3 py-2.5"
              style={{ background: `${color}18`, border: `1px solid ${color}2e` }}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color }} />
              <p className="text-[12.5px] leading-relaxed text-foreground/85">{comment}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Jalons + objectif ── */}
      {(nextMilestone || objective) && (
        <div className="divide-y divide-border/30">
          {nextMilestone?.target_date && (
            <div className="px-4 py-3 flex items-start gap-3">
              <div
                className="mt-0.5 h-6 w-6 rounded-full flex items-center justify-center shrink-0"
                style={{ background: `${color}18` }}
              >
                <Flag className="h-3.5 w-3.5" style={{ color }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5">
                  Prochaine étape
                </p>
                <p className="text-sm font-semibold leading-snug">{nextMilestone.label}</p>
                {nextMilestone.notes && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                    {nextMilestone.notes}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right ml-2">
                <span
                  className={cn(
                    "inline-flex text-[11px] font-bold px-2 py-0.5 rounded-full",
                    daysLeft(nextMilestone.target_date) <= 14
                      ? "bg-orange-500/15 text-orange-400"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {format(D(nextMilestone.target_date), "d MMM", { locale: fr })}
                </span>
                <p className="text-[10px] text-muted-foreground mt-0.5 text-center">
                  {fmtLeft(daysLeft(nextMilestone.target_date))}
                </p>
              </div>
            </div>
          )}

          {objective?.main_objective && objective.main_objective_deadline && (
            <div className="px-4 py-3 flex items-start gap-3">
              <div className="mt-0.5 h-6 w-6 rounded-full flex items-center justify-center shrink-0 bg-primary/10">
                <Target className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-0.5">
                  Objectif final
                </p>
                <p className="text-sm font-semibold leading-snug line-clamp-2">
                  {objective.main_objective}
                </p>
              </div>
              <div className="shrink-0 text-right ml-2">
                <span className="inline-flex text-[11px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {format(D(objective.main_objective_deadline), "d MMM yy", { locale: fr })}
                </span>
                <p className="text-[10px] text-muted-foreground mt-0.5 text-center">
                  {fmtLeft(daysLeft(objective.main_objective_deadline))}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 flex items-center justify-end gap-1 border-t border-border/30 bg-muted/20">
        <span className="text-[11px] text-muted-foreground">Voir mes objectifs</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    </div>
  );
}
