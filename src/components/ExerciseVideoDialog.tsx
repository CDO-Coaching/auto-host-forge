import { useState, type ReactNode, type CSSProperties } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

/** Extrait l'id YouTube d'une URL (shorts, watch, youtu.be, embed). */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:shorts\/|watch\?v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

type Props = {
  url: string | null | undefined;
  title?: string;
  /** Contenu du bouton déclencheur (le visuel que l'athlète voit). */
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Si l'URL n'est pas une vidéo YouTube embarquable, on retombe sur un lien externe. */
  fallbackExternal?: boolean;
};

/**
 * Bouton qui ouvre la vidéo de démonstration DANS l'app (Dialog + iframe),
 * au lieu de rediriger vers l'application YouTube.
 */
export function ExerciseVideoDialog({ url, title, children, className, style, fallbackExternal = true }: Props) {
  const [open, setOpen] = useState(false);
  const id = youtubeId(url);

  if (!url) return null;

  // Pas d'id YouTube exploitable → lien externe classique (sécurité).
  if (!id) {
    if (!fallbackExternal) return null;
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={className} style={style} onClick={(e) => e.stopPropagation()}>
        {children}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        className={className}
        style={style}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true); }}
      >
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 overflow-hidden max-w-md w-[94vw]">
          <div className="aspect-[9/16] w-full bg-black">
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${id}`}
              title={title || "Démonstration"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
