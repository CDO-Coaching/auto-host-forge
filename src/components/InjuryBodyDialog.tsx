import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QuickRatingInput } from "./QuickRatingInput";
import bodyImg from "@/assets/muscles-body.png";

const injuryLevelLabels = ["Gêne", "Très légère", "Légère", "Modérée", "Gênante", "Importante", "Très forte"];
const injuryLevelEmojis = ["🩹", "😕", "😣", "😖", "😫", "🤕", "🚑"];

// Marqueurs de zones dans l'espace de la planche anatomique (image 2000 x 1657).
// bx < 1000 = corps de FACE (gauche) ; bx >= 1000 = corps de DOS (droite).
type Marker = { zone: string; bx: number; by: number; sideable?: boolean };

const MARKERS: Marker[] = [
  // ── FACE ──
  { zone: "Nuque / cervicales", bx: 366, by: 335 },
  { zone: "Trapèzes", bx: 322, by: 398 },
  { zone: "Épaule", bx: 268, by: 448, sideable: true },
  { zone: "Pectoral", bx: 366, by: 505 },
  { zone: "Biceps", bx: 236, by: 548, sideable: true },
  { zone: "Coude", bx: 214, by: 640, sideable: true },
  { zone: "Avant-bras / poignet", bx: 202, by: 720, sideable: true },
  { zone: "Abdominaux", bx: 366, by: 625 },
  { zone: "Hanche (flexeur)", bx: 322, by: 755, sideable: true },
  { zone: "Pubis / aine", bx: 366, by: 820 },
  { zone: "Adducteurs", bx: 360, by: 885, sideable: true },
  { zone: "Quadriceps", bx: 322, by: 945, sideable: true },
  { zone: "Genou (avant / rotule)", bx: 330, by: 1055, sideable: true },
  { zone: "Tibia (périostite)", bx: 335, by: 1185, sideable: true },
  { zone: "Cheville", bx: 335, by: 1320, sideable: true },
  { zone: "Pied (plantaire)", bx: 338, by: 1420, sideable: true },
  { zone: "Orteils", bx: 348, by: 1470, sideable: true },
  // ── DOS ──
  { zone: "Nuque / cervicales", bx: 1336, by: 335 },
  { zone: "Trapèzes", bx: 1292, by: 410 },
  { zone: "Épaule", bx: 1414, by: 455, sideable: true },
  { zone: "Triceps", bx: 1152, by: 560, sideable: true },
  { zone: "Dos (milieu / thoracique)", bx: 1336, by: 565 },
  { zone: "Bas du dos (lombaires)", bx: 1300, by: 690 },
  { zone: "Fessier", bx: 1316, by: 800, sideable: true },
  { zone: "Ischio-jambiers", bx: 1256, by: 955, sideable: true },
  { zone: "Mollet", bx: 1336, by: 1155, sideable: true },
  { zone: "Péroné", bx: 1298, by: 1160, sideable: true },
  { zone: "Tendon d'Achille", bx: 1336, by: 1325, sideable: true },
];

const RED = "#ef5a3c";

function BodyPlate({ viewBox, markers, selected, onPick }: {
  viewBox: string; markers: Marker[]; selected: string; onPick: (zone: string) => void;
}) {
  return (
    <svg viewBox={viewBox} className="w-full h-auto select-none" preserveAspectRatio="xMidYMid meet">
      <image href={bodyImg} x="0" y="0" width="2000" height="1657" />
      {markers.map((mk) => {
        const active = mk.zone === selected;
        return (
          <g key={mk.zone + mk.bx} onClick={() => onPick(mk.zone)} className="cursor-pointer">
            {active && <circle cx={mk.bx} cy={mk.by} r={70} fill={RED} opacity={0.28} />}
            <circle cx={mk.bx} cy={mk.by} r={active ? 30 : 22}
              fill={active ? RED : "rgba(239,90,60,0.4)"}
              stroke={active ? "#fff" : "rgba(239,90,60,0.75)"} strokeWidth={active ? 6 : 4} />
          </g>
        );
      })}
    </svg>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLocation?: string;
  initialLevel?: number;
  onValidate: (location: string, level: number) => void;
  onCancel?: () => void;
}

export function InjuryBodyDialog({ open, onOpenChange, initialLocation, initialLevel, onValidate, onCancel }: Props) {
  const [view, setView] = useState<"front" | "back">("front");
  const [zone, setZone] = useState<string>("");
  const [side, setSide] = useState<"" | "gauche" | "droite" | "les deux">("");
  const [level, setLevel] = useState<number>(3);

  const frontMarkers = useMemo(() => MARKERS.filter((m) => m.bx < 1000), []);
  const backMarkers = useMemo(() => MARKERS.filter((m) => m.bx >= 1000), []);
  const backZones = useMemo(() => new Set(backMarkers.map((m) => m.zone)), [backMarkers]);
  const frontZones = useMemo(() => new Set(frontMarkers.map((m) => m.zone)), [frontMarkers]);

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
    setView(backZones.has(z) && !frontZones.has(z) ? "back" : "front");
  }, [open, initialLocation, initialLevel, backZones, frontZones]);

  const current = useMemo(() => MARKERS.find((m) => m.zone === zone), [zone]);
  const canSide = !!current?.sideable;

  const validate = () => {
    if (!zone) return;
    onValidate(canSide && side ? `${zone} ${side}` : zone, level);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel?.(); onOpenChange(o); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Où as-tu mal&nbsp;?</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 justify-center">
          {(["front", "back"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)}
              className={`px-4 h-8 rounded-full text-xs font-semibold border transition-colors ${view === v ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>
              {v === "front" ? "Face" : "Dos"}
            </button>
          ))}
        </div>

        <div className="flex justify-center max-h-[38vh]">
          {view === "front"
            ? <BodyPlate viewBox="-360 120 1360 1360" markers={frontMarkers} selected={zone} onPick={setZone} />
            : <BodyPlate viewBox="780 120 1580 1360" markers={backMarkers} selected={zone} onPick={setZone} />}
        </div>

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
