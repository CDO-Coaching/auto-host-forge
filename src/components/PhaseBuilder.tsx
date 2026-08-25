import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, addWeeks, addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, Trash2, NotebookPen, Infinity as InfinityIcon, ChevronDown, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BuilderPhase {
  id: string;
  name: string;
  start_date: string;
  end_date?: string | null; // null = phase "en cours" (sans fin définie)
  coach_note?: string | null;
  color?: string | null;
}

const PHASE_COLORS = ["#e8c466", "#5aa9e6", "#9c7bd6", "#5fbf82", "#e8974a", "#e56464"];

const phaseWeeks = (p: BuilderPhase): number | null =>
  p.end_date ? Math.max(1, Math.round((differenceInCalendarDays(new Date(p.end_date), new Date(p.start_date)) + 1) / 7)) : null;

/**
 * Builder de phases lié à l'objectif.
 * - Le cadre = aujourd'hui → échéance de l'objectif.
 * - Chaque phase démarre à la fin de la précédente (la 1re démarre aujourd'hui).
 * - Une phase "sans durée" (end_date null) reste en cours jusqu'à la phase suivante.
 */
export function PhaseBuilder({
  athleteId, deadline, phases, onReload,
}: {
  athleteId: string;
  deadline?: string | null;
  phases: BuilderPhase[];
  onReload: () => void;
}) {
  const ordered = [...phases].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  const [newFocus, setNewFocus] = useState("");
  const [newWeeks, setNewWeeks] = useState<number | null>(4); // null = sans durée
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false); // n'affiche que la 1re phase par défaut
  const [busy, setBusy] = useState(false);

  const today = startOfDay(new Date());
  const dl = deadline ? new Date(deadline) : null;

  // Fixe la date de début d'une phase et ré-enchaîne les suivantes.
  const setPhaseStart = async (idx: number, date: Date) => {
    setBusy(true);
    try {
      let cursor = startOfDay(date);
      for (let i = idx; i < ordered.length; i++) {
        const w = phaseWeeks(ordered[i]);
        const start = new Date(cursor);
        const end = w ? addDays(addWeeks(start, w), -1) : null;
        if (end) cursor = addDays(end, 1);
        await supabase.from("mesocycles").update({
          start_date: format(start, "yyyy-MM-dd"),
          end_date: end ? format(end, "yyyy-MM-dd") : null,
          updated_at: new Date().toISOString(),
        }).eq("id", ordered[i].id);
      }
      onReload();
    } catch { toast.error("Erreur"); }
    finally { setBusy(false); }
  };

  // Recalcule les dates en chaîne depuis aujourd'hui et persiste.
  const persistChain = async (list: { id: string; weeks: number | null }[]) => {
    let cursor = new Date(today);
    for (const item of list) {
      const start = new Date(cursor);
      const end = item.weeks ? addDays(addWeeks(start, item.weeks), -1) : null;
      if (end) cursor = addDays(end, 1);
      await supabase.from("mesocycles").update({
        start_date: format(start, "yyyy-MM-dd"),
        end_date: end ? format(end, "yyyy-MM-dd") : null,
        updated_at: new Date().toISOString(),
      }).eq("id", item.id);
    }
  };

  const handleAdd = async () => {
    if (!newFocus.trim()) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("no user");

      // Fermer la dernière phase si elle est "en cours" (sans fin)
      const last = ordered[ordered.length - 1];
      let start = new Date(today);
      if (last) {
        if (!last.end_date) {
          // la phase ouverte se termine hier, la nouvelle démarre aujourd'hui
          await supabase.from("mesocycles").update({ end_date: format(addDays(today, -1), "yyyy-MM-dd") }).eq("id", last.id);
          start = new Date(today);
        } else {
          start = addDays(new Date(last.end_date), 1);
        }
      }
      const end = newWeeks ? addDays(addWeeks(start, newWeeks), -1) : null;
      const color = PHASE_COLORS[ordered.length % PHASE_COLORS.length];
      const { error } = await supabase.from("mesocycles").insert({
        athlete_id: athleteId, coach_id: user.id, macrocycle_id: null,
        name: newFocus.trim(), phase_type: "custom", color,
        start_date: format(start, "yyyy-MM-dd"), end_date: end ? format(end, "yyyy-MM-dd") : null,
        volume_target: 3, intensity_target: 3,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setNewFocus(""); setNewWeeks(4);
      onReload();
    } catch { toast.error("Impossible d'ajouter la phase"); }
    finally { setBusy(false); }
  };

  const setWeeksAt = async (idx: number, weeks: number | null) => {
    setBusy(true);
    try {
      const list = ordered.map((p) => ({ id: p.id, weeks: phaseWeeks(p) }));
      list[idx].weeks = weeks;
      await persistChain(list);
      onReload();
    } catch { toast.error("Erreur"); }
    finally { setBusy(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette phase ?")) return;
    setBusy(true);
    try {
      await supabase.from("mesocycles").delete().eq("id", id);
      const rest = ordered.filter((p) => p.id !== id).map((p) => ({ id: p.id, weeks: phaseWeeks(p) }));
      await persistChain(rest);
      onReload();
    } catch { toast.error("Erreur"); }
    finally { setBusy(false); }
  };

  const handleFocusBlur = async (id: string, name: string) => {
    await supabase.from("mesocycles").update({ name, updated_at: new Date().toISOString() }).eq("id", id);
  };
  const handleNoteBlur = async (id: string, note: string) => {
    await supabase.from("mesocycles").update({ coach_note: note || null, updated_at: new Date().toISOString() }).eq("id", id);
  };

  // Barre visuelle (proportions) si on a une échéance
  const coveredWeeks = ordered.reduce((a, p) => a + (phaseWeeks(p) ?? 0), 0);
  const totalDays = dl ? Math.max(1, differenceInCalendarDays(dl, today) + 1) : null;

  return (
    <div className="space-y-4">
      {/* Barre visuelle */}
      {ordered.length > 0 && (
        <div>
          <div className="flex h-6 overflow-hidden rounded-lg border border-border/40 bg-muted/40">
            {ordered.map((p, i) => {
              const w = phaseWeeks(p);
              const days = w ? w * 7 : 14; // les phases ouvertes prennent une part indicative
              return (
                <div key={p.id} className={cn("flex items-center justify-center text-[9px] font-bold text-black/80 overflow-hidden whitespace-nowrap", !w && "opacity-70")}
                  style={{ flex: `${days} 0 0`, backgroundColor: p.color || PHASE_COLORS[i % PHASE_COLORS.length] }}>
                  P{i + 1}
                </div>
              );
            })}
            {totalDays && totalDays - coveredWeeks * 7 > 3 && (
              <div className="flex-none" style={{ flex: `${totalDays - coveredWeeks * 7} 0 0`, background: "repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(0,0,0,0.06) 5px,rgba(0,0,0,0.06) 10px)" }} />
            )}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1 tabular-nums">
            <span>Aujourd'hui</span>
            <span>{dl ? `Objectif · ${format(dl, "d MMM yyyy", { locale: fr })}` : "Sans échéance"}</span>
          </div>
        </div>
      )}

      {/* Liste des phases */}
      <div className="space-y-2.5">
        {ordered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">Aucune phase — ajoute la première ci-dessous.</p>
        )}
        {ordered.map((p, i) => {
          if (!expanded && i > 0) return null; // seule la Phase 1 visible par défaut
          const color = p.color || PHASE_COLORS[i % PHASE_COLORS.length];
          const w = phaseWeeks(p);
          return (
            <div key={p.id} className="rounded-xl border border-border/60 bg-card/40 p-3">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[11px] font-bold text-muted-foreground/60 w-12 shrink-0">Phase {i + 1}</span>
                <Input
                  defaultValue={p.name}
                  onBlur={(e) => handleFocusBlur(p.id, e.target.value)}
                  placeholder="Objectif secondaire / focus…"
                  className="flex-1 h-9 font-semibold border-transparent bg-transparent hover:border-border focus-visible:border-border px-2"
                />
                {w ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="outline" size="icon" className="h-7 w-7" disabled={busy || w <= 1} onClick={() => setWeeksAt(i, w - 1)}>−</Button>
                    <span className="w-6 text-center font-bold tabular-nums text-sm">{w}</span>
                    <span className="text-[10px] text-muted-foreground">sem.</span>
                    <Button variant="outline" size="icon" className="h-7 w-7" disabled={busy} onClick={() => setWeeksAt(i, w + 1)}>+</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Sans durée (en cours)" disabled={busy} onClick={() => setWeeksAt(i, null)}><InfinityIcon className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] font-semibold text-primary">En cours</span>
                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled={busy} onClick={() => setWeeksAt(i, 2)}>Définir une durée</Button>
                  </div>
                )}
                <button className="text-muted-foreground/60 hover:text-destructive shrink-0 p-1" onClick={() => handleDelete(p.id)} title="Supprimer"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="flex items-center justify-between gap-2 pl-[4.4rem] mt-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground tabular-nums" title="Modifier la date de début">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {format(new Date(p.start_date), "d MMM", { locale: fr })}
                      {p.end_date ? ` → ${format(new Date(p.end_date), "d MMM yyyy", { locale: fr })}` : " → en cours"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="px-3 pt-2 text-[11px] text-muted-foreground">Date de début — les phases suivantes se décalent.</div>
                    <Calendar mode="single" selected={new Date(p.start_date)} onSelect={(d) => d && setPhaseStart(i, d)} locale={fr} weekStartsOn={1} className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <button onClick={() => setOpenNote(openNote === p.id ? null : p.id)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                  <NotebookPen className="h-3.5 w-3.5" /> {p.coach_note ? "Note" : "Ajouter une note"}
                </button>
              </div>
              {(openNote === p.id || p.coach_note) && (
                <div className="pl-[4.4rem] mt-2">
                  <Textarea
                    defaultValue={p.coach_note || ""}
                    onBlur={(e) => handleNoteBlur(p.id, e.target.value)}
                    placeholder="Note / commentaires pour cette phase…"
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
              )}
            </div>
          );
        })}
        {/* Déplier / replier les phases suivantes */}
        {ordered.length > 1 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/60 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
            {expanded ? "Réduire" : `Voir les ${ordered.length - 1} autre${ordered.length - 1 > 1 ? "s" : ""} phase${ordered.length - 1 > 1 ? "s" : ""}`}
          </button>
        )}
      </div>

      {/* Ajouter une phase */}
      <div className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.03] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={newFocus}
            onChange={(e) => setNewFocus(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            placeholder="Objectif secondaire — ex : Adaptation à l'allure du 10 km"
            className="flex-1 min-w-[200px] h-10"
          />
          {newWeeks ? (
            <div className="flex items-center gap-1.5 rounded-lg border px-2 py-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" disabled={newWeeks <= 1} onClick={() => setNewWeeks((w) => Math.max(1, (w ?? 1) - 1))}>−</Button>
              <span className="w-6 text-center font-bold tabular-nums">{newWeeks}</span>
              <span className="text-[10px] text-muted-foreground">sem.</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" disabled={newWeeks >= 12} onClick={() => setNewWeeks((w) => Math.min(12, (w ?? 1) + 1))}>+</Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" title="Sans durée" onClick={() => setNewWeeks(null)}><InfinityIcon className="h-4 w-4" /></Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setNewWeeks(4)}>Sans durée · définir</Button>
          )}
          <Button onClick={handleAdd} disabled={busy || !newFocus.trim()} className="gap-1">
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">Démarre aujourd'hui (ou à la fin de la phase précédente). {newWeeks ? "" : "Sans durée : reste « en cours » jusqu'à la phase suivante."}</p>
      </div>
    </div>
  );
}
