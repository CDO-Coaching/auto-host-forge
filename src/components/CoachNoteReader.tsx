import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StickyNote, ChevronLeft, ChevronRight, Check, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface CoachNote {
  id: string;
  content: string;
  structured_content: string | null;
  created_at: string;
  read_at: string | null;
}

const SECTIONS = ["Séance faite", "Points clés", "Points de vigilance", "À faire la prochaine fois", "Consignes athlète"];

/** Rend un compte-rendu structuré (titres de section + puces "- ") lisiblement. */
function StructuredNote({ text }: { text: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const blocks: { title: string | null; items: string[] }[] = [];
  let current: { title: string | null; items: string[] } | null = null;

  for (const line of lines) {
    const isBullet = /^[-•]\s+/.test(line);
    if (isBullet) {
      if (!current) current = { title: null, items: [] };
      current.items.push(line.replace(/^[-•]\s+/, ""));
    } else {
      // Nouvelle section (titre) : on clôt la précédente
      if (current) blocks.push(current);
      current = { title: line.replace(/:$/, ""), items: [] };
    }
  }
  if (current) blocks.push(current);

  return (
    <div className="space-y-4">
      {blocks.map((b, i) => (
        <div key={i}>
          {b.title && (
            <p className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${
              SECTIONS.some((s) => s.toLowerCase() === b.title!.toLowerCase()) ? "text-primary" : "text-foreground"
            }`}>
              {b.title}
            </p>
          )}
          {b.items.length > 0 ? (
            <ul className="space-y-1">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2 text-sm leading-relaxed">
                  <span className="text-primary/70 shrink-0 mt-0.5">•</span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Lecteur de notes de coaching sur la fiche d'un athlète (côté coach) :
 * - pastille flottante indiquant les notes NON LUES ;
 * - clic → modale centrée affichant la note reconstruite au propre, sans
 *   quitter la page ; ouverture/fermeture à volonté ;
 * - marque comme lu à l'ouverture, avec possibilité de remettre en non-lu.
 */
export function CoachNoteReader({ athleteId, athleteName }: { athleteId: string; athleteName: string }) {
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const load = useCallback(async () => {
    if (!athleteId) return;
    const { data, error } = await supabase
      .from("coach_notes")
      .select("id, content, structured_content, read_at, created_at")
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false });
    if (!error) {
      setNotes((data as any) || []);
      return;
    }
    // Repli si structured_content/read_at n'existent pas encore (migration non lancée)
    const retry = await supabase
      .from("coach_notes")
      .select("id, content, created_at")
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false });
    if (!retry.error) {
      setNotes((retry.data || []).map((n: any) => ({ ...n, structured_content: null, read_at: null })));
    }
  }, [athleteId]);

  useEffect(() => { load(); }, [load]);

  const unreadCount = notes.filter((n) => !n.read_at).length;

  const markRead = async (ids: string[]) => {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    setNotes((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: now } : n)));
    await supabase.from("coach_notes").update({ read_at: now }).in("id", ids);
  };

  const markUnread = async (id: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: null } : n)));
    await supabase.from("coach_notes").update({ read_at: null }).eq("id", id);
  };

  const openReader = () => {
    // Ouvre sur la première note non lue si possible, sinon la plus récente
    const firstUnread = notes.findIndex((n) => !n.read_at);
    setIndex(firstUnread >= 0 ? firstUnread : 0);
    setOpen(true);
    const unreadIds = notes.filter((n) => !n.read_at).map((n) => n.id);
    markRead(unreadIds);
  };

  if (notes.length === 0) return null;

  const note = notes[index];

  return (
    <>
      {/* Pastille flottante */}
      <button
        type="button"
        onClick={openReader}
        className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2 rounded-full border border-primary/40 bg-card/95 px-4 py-2.5 shadow-lg backdrop-blur transition-transform hover:scale-105 active:scale-95"
        aria-label="Ouvrir les notes de coaching"
      >
        <span className="relative flex items-center justify-center">
          <StickyNote className="h-5 w-5 text-primary" />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </span>
        <span className="text-sm font-medium">
          {unreadCount > 0 ? `${unreadCount} note${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}` : "Notes"}
        </span>
        {unreadCount > 0 && (
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/20" />
        )}
      </button>

      {/* Modale centrée */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/60 text-left space-y-0">
            <DialogTitle className="flex items-center gap-2.5">
              <span className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <StickyNote className="h-5 w-5 text-primary" />
              </span>
              <span className="flex flex-col min-w-0">
                <span className="text-base font-semibold leading-tight truncate">Note — {athleteName}</span>
                {note && (
                  <span className="text-xs font-normal text-muted-foreground capitalize">
                    {format(new Date(note.created_at), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
                  </span>
                )}
              </span>
            </DialogTitle>
          </DialogHeader>

          {note && (
            <ScrollArea className="max-h-[55vh]">
              <div className="px-5 py-4">
                {note.structured_content ? (
                  <StructuredNote text={note.structured_content} />
                ) : (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{note.content}</p>
                )}
              </div>
            </ScrollArea>
          )}

          {/* Pied : navigation entre notes + remettre en non-lu */}
          <div className="flex items-center justify-between gap-2 border-t border-border/60 px-4 py-3">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={index >= notes.length - 1}
                onClick={() => setIndex((i) => Math.min(notes.length - 1, i + 1))}
                aria-label="Note précédente"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {index + 1} / {notes.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={index <= 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                aria-label="Note suivante"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {note && (note.read_at ? (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => markUnread(note.id)}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Marquer non lue
              </Button>
            ) : (
              <span className="flex items-center gap-1 text-xs text-primary">
                <Check className="h-3.5 w-3.5" /> Non lue
              </span>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
