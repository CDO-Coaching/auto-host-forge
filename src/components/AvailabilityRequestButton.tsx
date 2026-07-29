import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarClock, Loader2 } from "lucide-react";
import { getNextWeeks } from "@/lib/weekUtils";
import { subDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

/**
 * Bouton coach : envoie à TOUS ses athlètes une demande de disponibilités pour
 * les semaines sélectionnées. L'athlète voit la demande à partir du mercredi de
 * la semaine précédant la 1re semaine demandée.
 */
export function AvailabilityRequestButton() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, { week: number; year: number; monday: Date }>>({});
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const weeks = useMemo(() => getNextWeeks(12), []);
  const selectedList = Object.values(selected).sort((a, b) => a.monday.getTime() - b.monday.getTime());

  const toggle = (w: { week: number; year: number; monday: Date }) => {
    const key = `${w.year}-${w.week}`;
    setSelected((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key]; else next[key] = { week: w.week, year: w.year, monday: w.monday };
      return next;
    });
  };

  const send = async () => {
    if (selectedList.length === 0) { toast.error("Sélectionne au moins une semaine"); return; }
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");
      // Mercredi de la semaine précédant la 1re semaine demandée (lundi - 5 jours)
      const firstMonday = selectedList[0].monday;
      const visibleFrom = format(subDays(firstMonday, 5), "yyyy-MM-dd");
      const { error } = await supabase.from("availability_requests").insert({
        coach_id: user.id,
        target_weeks: selectedList.map((w) => ({ week: w.week, year: w.year })) as any,
        visible_from: visibleFrom,
        message: message.trim() || null,
      } as any);
      if (error) throw error;
      toast.success(`Demande envoyée · visible par les athlètes dès le ${format(subDays(firstMonday, 5), "d MMM", { locale: fr })}`);
      setOpen(false);
      setMessage("");
      setSelected({});
    } catch (e: any) {
      toast.error(`Erreur : ${e?.message || e}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CalendarClock className="h-4 w-4 mr-2" />
        Demander les dispos
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" /> Demander les disponibilités
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sélectionne les semaines concernées. Tes athlètes recevront la demande à partir du
              mercredi de la semaine précédant la 1re semaine choisie.
            </p>

            <div className="space-y-1">
              <Label className="text-xs">Semaines concernées</Label>
              <div className="grid grid-cols-2 gap-2">
                {weeks.map((w) => {
                  const key = `${w.year}-${w.week}`;
                  const isSel = !!selected[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggle(w)}
                      className={cn(
                        "text-left text-xs rounded-lg border px-3 py-2 transition-colors",
                        isSel ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border hover:border-foreground/40"
                      )}
                    >
                      <div>S{w.week} — {w.year}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {format(w.monday, "d MMM", { locale: fr })} - {format(w.sunday, "d MMM", { locale: fr })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedList.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Visible par les athlètes dès le <strong>{format(subDays(selectedList[0].monday, 5), "EEEE d MMM", { locale: fr })}</strong>.
              </p>
            )}

            <div className="space-y-1">
              <Label htmlFor="msg" className="text-xs">Message (optionnel)</Label>
              <Textarea id="msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
                placeholder="Ex : Dis-moi tes dispos pour le prochain bloc 💪" />
            </div>

            <Button onClick={send} disabled={sending} className="w-full">
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Envoyer à tous mes athlètes actifs
              {selectedList.length > 0 ? ` · ${selectedList.length} semaine${selectedList.length > 1 ? "s" : ""}` : ""}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
