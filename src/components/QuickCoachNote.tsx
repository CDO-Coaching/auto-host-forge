import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StickyNote, Check, ChevronsUpDown, Loader2, Pencil, Plus, Sparkles } from "lucide-react";
import { polishCoachNote, structureCoachNote } from "@/lib/groqSessionReport";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { fetchCoachAppointments, lastStartedAppointment } from "@/lib/coachAppointments";
import { startOfDay, endOfDay, format } from "date-fns";
import { fr } from "date-fns/locale";

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase() || "?";

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  isExternal?: boolean;
}

/**
 * Bouton flottant présent sur toutes les pages coach (mobile) : enregistrer
 * rapidement une note de coaching rattachée à un client. À l'ouverture, la
 * dernière personne coachée (dernier RDV Google Calendar passé) est
 * pré-sélectionnée, et les autres coachings du jour sans note sont proposés en
 * accès rapide. La note apparaît ensuite sur la fiche du client.
 */
export function QuickCoachNote() {
  const { profile } = useUserProfile();
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [isExternal, setIsExternal] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const autoPickedRef = useRef(false);
  // Coachings du jour (puces de sélection rapide), avec indicateur "déjà noté"
  const [dayPending, setDayPending] = useState<{ id: string; name: string; noted: boolean }[]>([]);

  useEffect(() => {
    if (!open || !profile?.id || clients.length > 0) return;
    const load = async () => {
      const { data: rels } = await supabase
        .from("coach_athlete_relationships")
        .select("athlete_id")
        .eq("coach_id", profile.id)
        .eq("status", "approved");

      let athletes: Client[] = [];
      if (rels && rels.length > 0) {
        const ids = rels.map((r) => r.athlete_id);
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("id, first_name, last_name, email")
          .in("id", ids);
        athletes = (profiles || []).map((p) => ({ id: p.id, first_name: p.first_name || "", last_name: p.last_name || "", email: p.email, isExternal: false }));
      }

      const { data: ext } = await supabase
        .from("external_clients")
        .select("id, first_name, last_name")
        .eq("coach_id", profile.id)
        .eq("is_active", true);
      const externals: Client[] = (ext || []).map((c) => ({ id: c.id, first_name: c.first_name, last_name: c.last_name, isExternal: true }));

      setClients([...athletes, ...externals].sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)));
    };
    load();
  }, [open, profile?.id, clients.length]);

  // À l'ouverture, pré-sélectionner la dernière personne faite (dernier RDV
  // Google Calendar dont le début est passé). Ne remplace pas un choix manuel.
  useEffect(() => {
    if (!open) { autoPickedRef.current = false; return; }
    if (autoPickedRef.current || clients.length === 0 || !profile?.id) return;
    autoPickedRef.current = true;
    const run = async () => {
      const athletes = clients.filter((c) => !c.isExternal);
      if (athletes.length === 0) return;
      const now = new Date();
      const appts = await fetchCoachAppointments(athletes, startOfDay(now), endOfDay(now));
      if (appts.length === 0) return;

      // Athlètes ayant déjà une note aujourd'hui
      const { data: todayNotes } = await supabase
        .from("coach_notes")
        .select("athlete_id")
        .eq("coach_id", profile.id)
        .gte("created_at", startOfDay(now).toISOString());
      const notedIds = new Set((todayNotes || []).map((n: any) => n.athlete_id).filter(Boolean));

      // Dernière personne faite (début du créneau déjà passé) → pré-sélection
      const last = lastStartedAppointment(appts, now);
      if (last && !selectedClientId && clients.some((c) => c.id === last.athleteId && !c.isExternal)) {
        setSelectedClientId(last.athleteId);
        setIsExternal(false);
      }

      // Coachings du jour (dédupliqués, triés par heure), avec flag "déjà noté"
      const seen = new Set<string>();
      const pending: { id: string; name: string; noted: boolean }[] = [];
      appts.forEach((a) => {
        if (seen.has(a.athleteId)) return;
        seen.add(a.athleteId);
        pending.push({ id: a.athleteId, name: a.athleteName, noted: notedIds.has(a.athleteId) });
      });
      setDayPending(pending);
    };
    run();
  }, [open, clients, profile?.id]);

  const selected = clients.find((c) => c.id === selectedClientId);

  const polish = async () => {
    const text = note.trim();
    if (!text) return;
    setPolishing(true);
    try {
      const cleaned = await polishCoachNote(text);
      if (!cleaned) throw new Error("Réponse vide");
      const before = note;
      setNote(cleaned);
      toast.success("Note améliorée", {
        action: { label: "Annuler", onClick: () => setNote(before) },
      });
    } catch (e: any) {
      toast.error(`Erreur IA : ${e?.message || e}`);
    } finally {
      setPolishing(false);
    }
  };

  const save = async () => {
    if (!profile?.id || !selectedClientId || !note.trim()) {
      toast.error("Sélectionne un client et écris une note");
      return;
    }
    setSaving(true);
    const insertData: Record<string, unknown> = { coach_id: profile.id, content: note.trim() };
    insertData[isExternal ? "external_client_id" : "athlete_id"] = selectedClientId;
    // Reconstruction au propre (compte-rendu structuré) — non bloquant si l'IA échoue
    try {
      const structured = await structureCoachNote(note.trim());
      if (structured) insertData.structured_content = structured;
    } catch (e) {
      console.error("Structuration note échouée:", e);
    }
    let { error } = await supabase.from("coach_notes").insert(insertData);
    // Repli si la colonne structured_content n'existe pas encore (migration non lancée)
    if (error && insertData.structured_content) {
      delete insertData.structured_content;
      ({ error } = await supabase.from("coach_notes").insert(insertData));
    }
    setSaving(false);
    if (error) { toast.error("Erreur lors de l'enregistrement"); return; }
    toast.success("Note enregistrée");
    setNote("");
    setSelectedClientId("");
    setOpen(false);
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="icon"
        className="sm:hidden fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-4 z-50 h-14 w-14 rounded-full shadow-lg"
        aria-label="Enregistrer une note de coaching"
        title="Enregistrer une note de coaching"
      >
        <StickyNote className="h-6 w-6" />
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setSelectedClientId(""); setDayPending([]); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-4 sm:p-5 gap-0">
          <DialogHeader className="space-y-0 text-left">
            <DialogTitle className="flex items-center gap-2.5">
              <span className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <StickyNote className="h-5 w-5 text-primary" />
              </span>
              <span className="flex flex-col">
                <span className="text-base font-semibold leading-tight">Note de coaching</span>
                <span className="text-xs font-normal text-muted-foreground capitalize">
                  {format(new Date(), "EEEE d MMMM", { locale: fr })}
                </span>
              </span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Enregistrer une note de coaching rattachée à un client.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Client concerné */}
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Client concerné</p>
              {selected ? (
                <button
                  type="button"
                  onClick={() => setComboOpen(true)}
                  className="flex w-full items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3 text-left transition-colors active:bg-primary/10"
                >
                  <span className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                    {initialsOf(`${selected.first_name} ${selected.last_name}`)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-foreground truncate">
                      {selected.first_name} {selected.last_name}
                    </span>
                    {selected.isExternal && <Badge variant="outline" className="mt-0.5 text-[10px]">Externe</Badge>}
                  </span>
                  <Pencil className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ) : (
                <Button variant="outline" className="w-full justify-between h-12 rounded-xl" onClick={() => setComboOpen(true)}>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Plus className="h-4 w-4" /> Choisir un client
                  </span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              )}

              <CommandDialog open={comboOpen} onOpenChange={setComboOpen}>
                <CommandInput placeholder="Rechercher un client..." />
                <CommandList>
                  <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                  <CommandGroup heading="Athlètes">
                    {clients.filter((c) => !c.isExternal).map((c) => (
                      <CommandItem key={c.id} value={`${c.last_name} ${c.first_name}`} onSelect={() => { setSelectedClientId(c.id); setIsExternal(false); setComboOpen(false); }}>
                        <Check className={cn("mr-2 h-4 w-4", selectedClientId === c.id ? "opacity-100" : "opacity-0")} />
                        {c.first_name} {c.last_name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandGroup heading="Clients externes">
                    {clients.filter((c) => c.isExternal).map((c) => (
                      <CommandItem key={c.id} value={`${c.last_name} ${c.first_name} ext`} onSelect={() => { setSelectedClientId(c.id); setIsExternal(true); setComboOpen(false); }}>
                        <Check className={cn("mr-2 h-4 w-4", selectedClientId === c.id ? "opacity-100" : "opacity-0")} />
                        {c.first_name} {c.last_name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </CommandDialog>

              {/* Autres coachings du jour sans note : accès rapide */}
              {dayPending.filter((d) => !d.noted && d.id !== selectedClientId).length > 0 && (
                <div className="space-y-1.5 pt-0.5">
                  <p className="text-[11px] text-muted-foreground">Autres coachings du jour sans note</p>
                  <div className="flex flex-wrap gap-1.5">
                    {dayPending.filter((d) => !d.noted && d.id !== selectedClientId).map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => { setSelectedClientId(d.id); setIsExternal(false); }}
                        className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 py-1 pl-1 pr-2.5 text-xs font-medium text-foreground transition-all hover:bg-secondary active:scale-95"
                      >
                        <span className="h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[9px] font-semibold">
                          {initialsOf(d.name)}
                        </span>
                        {d.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Note (dictée clavier directement dans le champ) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Note</p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={polish}
                  disabled={polishing || !note.trim()}
                  className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
                >
                  {polishing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                  {polishing ? "Amélioration…" : "Améliorer"}
                </Button>
              </div>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Écris ou dicte ta note de coaching…"
                rows={8}
                className="min-h-[34vh] rounded-xl text-base leading-relaxed resize-none"
              />
            </div>

            <Button
              onClick={save}
              disabled={saving || !selectedClientId || !note.trim()}
              className="w-full h-12 rounded-xl text-base font-semibold"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Enregistrer la note
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
