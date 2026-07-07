import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { VoiceNoteAI } from "@/components/VoiceNoteAI";
import { StickyNote, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  isExternal?: boolean;
}

/**
 * Bouton flottant présent sur toutes les pages coach : enregistrer une note
 * de coaching (dictée vocale → compte-rendu IA) rattachée à un client. La note
 * apparaît ensuite sur la fiche du client.
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
          .select("id, first_name, last_name")
          .in("id", ids);
        athletes = (profiles || []).map((p) => ({ id: p.id, first_name: p.first_name || "", last_name: p.last_name || "", isExternal: false }));
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

  const selected = clients.find((c) => c.id === selectedClientId);

  const save = async () => {
    if (!profile?.id || !selectedClientId || !note.trim()) {
      toast.error("Sélectionne un client et écris une note");
      return;
    }
    setSaving(true);
    const insertData: Record<string, unknown> = { coach_id: profile.id, content: note.trim() };
    insertData[isExternal ? "external_client_id" : "athlete_id"] = selectedClientId;
    const { error } = await supabase.from("coach_notes").insert(insertData);
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
        className="sm:hidden fixed bottom-24 right-4 z-50 h-14 w-14 rounded-full shadow-lg"
        aria-label="Enregistrer une note de coaching"
        title="Enregistrer une note de coaching"
      >
        <StickyNote className="h-6 w-6" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5" /> Note de coaching
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Client concerné</label>
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between">
                    {selected ? (
                      <span className="flex items-center gap-2">
                        {selected.last_name} {selected.first_name}
                        {selected.isExternal && <Badge variant="outline" className="text-xs">Externe</Badge>}
                      </span>
                    ) : "Choisir un client..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Rechercher un client..." />
                    <CommandList>
                      <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                      <CommandGroup heading="Athlètes">
                        {clients.filter((c) => !c.isExternal).map((c) => (
                          <CommandItem key={c.id} value={`${c.last_name} ${c.first_name}`} onSelect={() => { setSelectedClientId(c.id); setIsExternal(false); setComboOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", selectedClientId === c.id ? "opacity-100" : "opacity-0")} />
                            {c.last_name} {c.first_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      <CommandGroup heading="Clients externes">
                        {clients.filter((c) => c.isExternal).map((c) => (
                          <CommandItem key={c.id} value={`${c.last_name} ${c.first_name} ext`} onSelect={() => { setSelectedClientId(c.id); setIsExternal(true); setComboOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", selectedClientId === c.id ? "opacity-100" : "opacity-0")} />
                            {c.last_name} {c.first_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <VoiceNoteAI onResult={setNote} />

            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Écris ou dicte ta note de coaching…"
              rows={6}
              className="min-h-[140px] text-base"
            />

            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Enregistrer la note
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
