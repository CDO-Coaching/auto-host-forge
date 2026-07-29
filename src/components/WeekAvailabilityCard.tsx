import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarClock, X } from "lucide-react";

interface WeekData {
  week: number; year: number;
  renfo: number; course: number; natation: number; velo: number;
  comment: string | null;
}

/** Disponibilités déclarées par l'athlète pour UNE semaine précise (affiché dans Prog). */
export function WeekAvailabilityCard({ athleteId, week, year }: { athleteId: string; week: number; year: number }) {
  const [data, setData] = useState<WeekData | null>(null);
  const dismissKey = `dispo_card_dismissed_${athleteId}_${year}_${week}`;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(dismissKey) === "1");
  }, [dismissKey]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: resp } = await supabase
        .from("availability_responses")
        .select("weeks_data, created_at")
        .eq("athlete_id", athleteId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (cancelled) return;
      // Cherche la réponse la plus récente qui couvre cette semaine
      let found: WeekData | null = null;
      for (const r of (resp || []) as any[]) {
        const wd = Array.isArray(r.weeks_data) ? r.weeks_data : [];
        const match = wd.find((w: any) => w.week === week && w.year === year);
        if (match) { found = match; break; }
      }
      setData(found);
    };
    load();
    return () => { cancelled = true; };
  }, [athleteId, week, year]);

  if (!data || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(dismissKey, "1");
    setDismissed(true);
  };

  const chip = (icon: string, n: number, label: string) =>
    n > 0 ? (
      <span key={label} className="inline-flex items-center gap-1 text-xs rounded-full border border-primary/40 px-2 py-0.5">
        {icon} <span className="font-semibold">{n}</span> {label}
      </span>
    ) : null;

  const total = data.renfo + data.course + data.natation + data.velo;

  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Disponibilités déclarées — S{data.week}</span>
        <button type="button" onClick={dismiss} aria-label="Masquer" className="ml-auto text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chip("🏋️", data.renfo, "Renfo")}
        {chip("🏃", data.course, "Course")}
        {chip("🏊", data.natation, "Natation")}
        {chip("🚴", data.velo, "Vélo")}
        {total === 0 && <span className="text-xs text-muted-foreground">Aucune séance demandée</span>}
      </div>
      {data.comment && <p className="text-sm italic text-muted-foreground">"{data.comment}"</p>}
    </div>
  );
}
