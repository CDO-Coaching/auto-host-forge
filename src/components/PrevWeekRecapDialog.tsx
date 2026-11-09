import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, PlusCircle, CalendarRange } from "lucide-react";
import { subWeeks, format } from "date-fns";
import { fr } from "date-fns/locale";
import { getWeekNumber, getWeekYear, getMondayOfWeek, getSundayOfWeek } from "@/lib/weekUtils";

interface Item { id: string; name: string; type: string; }

/**
 * Bilan de la semaine précédente, affiché en fenêtre flottante le LUNDI
 * (desktop uniquement), une seule fois par athlète et par semaine :
 * séances validées, non faites, et séances ajoutées par l'athlète.
 */
export function PrevWeekRecapDialog({ athleteId, athleteName }: { athleteId: string; athleteName: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<Item[]>([]);
  const [missed, setMissed] = useState<Item[]>([]);
  const [added, setAdded] = useState<Item[]>([]);

  useEffect(() => {
    if (!athleteId) return;
    const now = new Date();
    if (now.getDay() !== 1) return; // Lundi uniquement (0=dimanche, 1=lundi)

    const prevRef = subWeeks(now, 1);
    const week = getWeekNumber(prevRef);
    const year = getWeekYear(prevRef);
    const dismissKey = `prevweek-recap-${athleteId}-${year}-${week}`;
    try { if (localStorage.getItem(dismissKey)) return; } catch { /* ignore */ }

    const monday = format(getMondayOfWeek(prevRef), "yyyy-MM-dd");
    const sunday = format(getSundayOfWeek(prevRef), "yyyy-MM-dd");

    (async () => {
      // Séances programmées par le coach pour la semaine précédente
      const { data: ts } = await supabase
        .from("training_sessions")
        .select("id, name, session_type, completed_at, training_weeks!inner(athlete_id, week_number, year)")
        .eq("training_weeks.athlete_id", athleteId)
        .eq("training_weeks.week_number", week)
        .eq("training_weeks.year", year);

      const d: Item[] = [];
      const m: Item[] = [];
      (ts || []).forEach((s: any) => {
        const item = { id: s.id, name: s.name || "Séance", type: s.session_type || "" };
        if (s.completed_at) d.push(item); else m.push(item);
      });

      // Séances ajoutées par l'athlète (custom) sur la semaine
      const { data: cs } = await supabase
        .from("custom_sessions")
        .select("id, session_name, completed_at, scheduled_date, user_id")
        .eq("user_id", athleteId)
        .or(
          `and(completed_at.gte.${monday}T00:00:00,completed_at.lte.${sunday}T23:59:59),` +
          `and(scheduled_date.gte.${monday},scheduled_date.lte.${sunday})`,
        );
      const a: Item[] = (cs || []).map((s: any) => ({ id: s.id, name: s.session_name || "Séance perso", type: "custom" }));

      // Rien à montrer → ne pas ouvrir
      if (d.length === 0 && m.length === 0 && a.length === 0) return;

      setDone(d); setMissed(m); setAdded(a);
      setOpen(true);
      try { localStorage.setItem(dismissKey, "1"); } catch { /* ignore */ }
    })();
  }, [athleteId]);

  const prevRef = subWeeks(new Date(), 1);
  const totalProg = done.length + missed.length;

  const Row = ({ item, color }: { item: Item; color: string }) => (
    <div className="flex items-center gap-2 py-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      <span className="text-sm text-foreground truncate flex-1">{item.name}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="h-5 w-5 text-primary" />
            Semaine dernière — {athleteName}
          </DialogTitle>
          <DialogDescription className="capitalize">
            {format(getMondayOfWeek(prevRef), "d MMM", { locale: fr })} – {format(getSundayOfWeek(prevRef), "d MMM yyyy", { locale: fr })}
            {totalProg > 0 && ` · ${done.length}/${totalProg} séance${totalProg > 1 ? "s" : ""} faite${done.length > 1 ? "s" : ""}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          <section>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm font-semibold">Validées</span>
              <Badge variant="outline" className="ml-auto text-xs">{done.length}</Badge>
            </div>
            {done.length === 0
              ? <p className="text-xs text-muted-foreground pl-6">Aucune</p>
              : done.map((i) => <Row key={i.id} item={i} color="bg-green-500" />)}
          </section>

          <section>
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-semibold">Non faites</span>
              <Badge variant="outline" className="ml-auto text-xs">{missed.length}</Badge>
            </div>
            {missed.length === 0
              ? <p className="text-xs text-muted-foreground pl-6">Aucune</p>
              : missed.map((i) => <Row key={i.id} item={i} color="bg-destructive" />)}
          </section>

          {added.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-1">
                <PlusCircle className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Ajoutées par l'athlète</span>
                <Badge variant="outline" className="ml-auto text-xs">{added.length}</Badge>
              </div>
              {added.map((i) => <Row key={i.id} item={i} color="bg-primary" />)}
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
