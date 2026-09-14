import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QuickRatingInput } from "./QuickRatingInput";

const injuryLevelLabels = ["Gêne", "Très légère", "Légère", "Modérée", "Gênante", "Importante", "Très forte"];
const injuryLevelEmojis = ["🩹", "😕", "😣", "😖", "😫", "🤕", "🚑"];

// Marqueurs de zones sur la silhouette (x,y sur un viewBox 0 0 200 440)
type Marker = { zone: string; x: number; y: number; sideable?: boolean };

const FRONT: Marker[] = [
  { zone: "Nuque / cervicales", x: 100, y: 40 },
  { zone: "Épaule", x: 70, y: 86, sideable: true },
  { zone: "Trapèzes", x: 118, y: 74 },
  { zone: "Pectoral", x: 100, y: 108 },
  { zone: "Biceps", x: 60, y: 122, sideable: true },
  { zone: "Coude", x: 55, y: 156, sideable: true },
  { zone: "Avant-bras / poignet", x: 49, y: 190, sideable: true },
  { zone: "Abdominaux", x: 100, y: 150 },
  { zone: "Hanche (flexeur)", x: 78, y: 188, sideable: true },
  { zone: "Pubis / aine", x: 100, y: 196 },
  { zone: "Adducteurs", x: 92, y: 220, sideable: true },
  { zone: "Quadriceps", x: 84, y: 250, sideable: true },
  { zone: "Genou (avant / rotule)", x: 84, y: 300, sideable: true },
  { zone: "Tibia (périostite)", x: 84, y: 336, sideable: true },
  { zone: "Cheville", x: 84, y: 384, sideable: true },
  { zone: "Pied (plantaire)", x: 84, y: 410, sideable: true },
];

const BACK: Marker[] = [
  { zone: "Nuque / cervicales", x: 100, y: 40 },
  { zone: "Dos (milieu / thoracique)", x: 100, y: 118 },
  { zone: "Bas du dos (lombaires)", x: 100, y: 158 },
  { zone: "Fessier", x: 88, y: 192, sideable: true },
  { zone: "Ischio-jambiers", x: 84, y: 250, sideable: true },
  { zone: "Mollet", x: 84, y: 322, sideable: true },
  { zone: "Péroné", x: 72, y: 322, sideable: true },
  { zone: "Tendon d'Achille", x: 84, y: 378, sideable: true },
];

// Silhouette simple (tronc + tête + membres), la même de face/dos
function Silhouette() {
  return (
    <path
      d="M100 12c11 0 19 9 19 21 0 9-4 15-10 18 8 2 15 6 20 12 6 8 8 20 8 34v26c0 8-1 14-4 20l-6 40c-1 8-2 14-2 22l3 46c1 10 2 22 2 34 0 8-1 15-3 22-5 2-11 2-15 0-2-9-3-19-3-28l-3-40-2-26h-6l-2 26-3 40c0 9-1 19-3 28-4 2-10 2-15 0-2-7-3-14-3-22 0-12 1-24 2-34l3-46c0-8-1-14-2-22l-6-40c-3-6-4-12-4-20V97c0-14 2-26 8-34 5-6 12-10 20-12-6-3-10-9-10-18 0-12 8-21 19-21Z"
      fill="hsl(var(--muted))"
      stroke="hsl(var(--border))"
      strokeWidth={1.5}
    />
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLocation?: string;
  initialLevel?: number;
  onValidate: (location: string, level: number) => void;
  onCancel?: () => void; // douleur non signalée finalement (remet le toggle à off)
}

export function InjuryBodyDialog({ open, onOpenChange, initialLocation, initialLevel, onValidate, onCancel }: Props) {
  const [view, setView] = useState<"front" | "back">("front");
  const [zone, setZone] = useState<string>("");
  const [side, setSide] = useState<"" | "gauche" | "droite" | "les deux">("");
  const [level, setLevel] = useState<number>(3);

  // Retrouver zone + côté depuis une valeur existante à l'ouverture
  useEffect(() => {
    if (!open) return;
    const val = (initialLocation || "").trim();
    let z = val, s: typeof side = "";
    for (const suf of ["gauche", "droite", "les deux"] as const) {
      if (val.toLowerCase().endsWith(" " + suf)) { z = val.slice(0, -(suf.length + 1)); s = suf; break; }
    }
    setZone(z);
    setSide(s);
    setLevel(initialLevel && initialLevel >= 1 ? initialLevel : 3);
    setView(BACK.some((m) => m.zone === z) && !FRONT.some((m) => m.zone === z) ? "back" : "front");
  }, [open, initialLocation, initialLevel]);

  const markers = view === "front" ? FRONT : BACK;
  const current = useMemo(() => [...FRONT, ...BACK].find((m) => m.zone === zone), [zone]);
  const canSide = !!current?.sideable;

  const validate = () => {
    if (!zone) return;
    const loc = canSide && side ? `${zone} ${side}` : zone;
    onValidate(loc, level);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel?.(); onOpenChange(o); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Où as-tu mal&nbsp;?</DialogTitle>
        </DialogHeader>

        {/* Bascule face / dos */}
        <div className="flex gap-2 justify-center">
          {(["front", "back"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)}
              className={`px-4 h-8 rounded-full text-xs font-semibold border transition-colors ${view === v ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>
              {v === "front" ? "Face" : "Dos"}
            </button>
          ))}
        </div>

        {/* Silhouette + marqueurs tappables */}
        <div className="flex justify-center">
          <svg viewBox="0 0 200 440" className="h-[300px] w-auto select-none">
            <Silhouette />
            {markers.map((m) => {
              const active = m.zone === zone;
              return (
                <g key={m.zone} onClick={() => setZone(m.zone)} className="cursor-pointer">
                  <circle cx={m.x} cy={m.y} r={active ? 13 : 9}
                    fill={active ? "#ef5a3c" : "rgba(239,90,60,0.35)"}
                    stroke={active ? "#fff" : "rgba(239,90,60,0.6)"} strokeWidth={active ? 2 : 1} />
                  {active && <circle cx={m.x} cy={m.y} r={20} fill="none" stroke="#ef5a3c" strokeWidth={1.5} opacity={0.5} />}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Zone choisie + côté */}
        {zone ? (
          <div className="space-y-2">
            <p className="text-center text-sm font-semibold">{zone}</p>
            {canSide && (
              <div className="flex gap-2">
                {(["gauche", "droite", "les deux"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setSide((p) => (p === s ? "" : s))}
                    className={`flex-1 h-10 rounded-xl border text-sm font-medium capitalize transition-colors ${side === s ? "border-[#ff7a5c] bg-[rgba(239,90,60,0.16)] text-[#ff9a80]" : "border-border text-muted-foreground"}`}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground">Touche la zone concernée sur le schéma.</p>
        )}

        {/* Gravité */}
        {zone && (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold">À quel point&nbsp;?</p>
            <QuickRatingInput value={level} onChange={setLevel} min={1} max={7} labels={injuryLevelLabels} emojis={injuryLevelEmojis} variant="destructive" />
          </div>
        )}

        <DialogFooter className="flex-col gap-2">
          <Button onClick={validate} disabled={!zone} className="w-full">Valider ma douleur</Button>
          <Button variant="ghost" onClick={() => { onCancel?.(); onOpenChange(false); }} className="w-full text-muted-foreground">
            Finalement, pas de douleur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
