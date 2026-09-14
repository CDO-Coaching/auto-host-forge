import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QuickRatingInput } from "./QuickRatingInput";
import bodyImg from "@/assets/muscles-body.png";

const injuryLevelLabels = ["Gêne", "Très légère", "Légère", "Modérée", "Gênante", "Importante", "Très forte"];
const injuryLevelEmojis = ["🩹", "😕", "😣", "😖", "😫", "🤕", "🚑"];

// Marqueurs de zones dans l'espace de la planche anatomique (image 2000 x 1657).
// bx < 1000 = corps de FACE (gauche) ; bx >= 1000 = corps de DOS (droite).
type Marker = { zone: string; bx: number; by: number; sideable?: boolean; sideHint?: "gauche" | "droite" };

const FRONT_CX = 366;
const BACK_CX = 1336;

// Duplique les marqueurs latéralisables des deux côtés du corps pour qu'on puisse
// cliquer aussi bien le côté gauche que le côté droit du personnage.
function expandSides(markers: Marker[], cx: number): Marker[] {
  const out: Marker[] = [];
  for (const m of markers) {
    if (!m.sideable) { out.push(m); continue; }
    const a = m.bx;
    const b = 2 * cx - m.bx; // reflet
    const leftX = Math.min(a, b), rightX = Math.max(a, b);
    out.push({ ...m, bx: leftX, sideHint: "gauche" });
    out.push({ ...m, bx: rightX, sideHint: "droite" });
  }
  return out;
}

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
  { zone: "Genou (avant / rotule)", bx: 328, by: 1080, sideable: true },
  { zone: "Tibia (périostite)", bx: 334, by: 1230, sideable: true },
  { zone: "Cheville", bx: 336, by: 1380, sideable: true },
  { zone: "Pied (plantaire)", bx: 340, by: 1470, sideable: true },
  { zone: "Orteils", bx: 352, by: 1510, sideable: true },
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

// La planche est cliquable directement (pas de points). On repère la position du clic
// dans l'espace de l'image, puis le parent propose la/les zone(s) la/les plus proche(s).
function BodyPlate({ vb, point, onClickPoint }: {
  vb: [number, number, number, number]; point: { bx: number; by: number } | null; onClickPoint: (x: number, y: number) => void;
}) {
  const [vx, vy, vw, vh] = vb;
  const handle = (e: MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    onClickPoint(vx + nx * vw, vy + ny * vh);
  };
  return (
    <svg viewBox={vb.join(" ")} onClick={handle}
      className="w-full h-auto select-none cursor-crosshair" preserveAspectRatio="xMidYMid meet">
      <image href={bodyImg} x="0" y="0" width="2000" height="1657" />
      {/* Repère affiché là où l'athlète a cliqué */}
      {point && (
        <>
          <circle cx={point.bx} cy={point.by} r={74} fill={RED} opacity={0.3} />
          <circle cx={point.bx} cy={point.by} r={30} fill={RED} stroke="#fff" strokeWidth={6} />
        </>
      )}
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
  const [candidates, setCandidates] = useState<string[]>([]);
  const [side, setSide] = useState<"" | "gauche" | "droite" | "les deux">("");
  const [level, setLevel] = useState<number>(3);
  const [point, setPoint] = useState<{ bx: number; by: number } | null>(null);

  const frontMarkers = useMemo(() => expandSides(MARKERS.filter((m) => m.bx < 1000), FRONT_CX), []);
  const backMarkers = useMemo(() => expandSides(MARKERS.filter((m) => m.bx >= 1000), BACK_CX), []);
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
    setCandidates(z ? [z] : []);
    setSide(s);
    setLevel(initialLevel && initialLevel >= 1 ? initialLevel : 3);
    setView(backZones.has(z) && !frontZones.has(z) ? "back" : "front");
    // Repère : marqueur de la zone (côté choisi si connu)
    const all = [...frontMarkers, ...backMarkers];
    const mk = all.find((m) => m.zone === z && (s === "gauche" || s === "droite" ? m.sideHint === s : true));
    setPoint(mk ? { bx: mk.bx, by: mk.by } : null);
  }, [open, initialLocation, initialLevel, backZones, frontZones, frontMarkers, backMarkers]);

  const current = useMemo(() => MARKERS.find((m) => m.zone === zone), [zone]);
  const canSide = !!current?.sideable;

  // Clic sur le corps → zone la plus proche + côté déduit du point cliqué
  const handleClickPoint = (x: number, y: number) => {
    const ms = view === "front" ? frontMarkers : backMarkers;
    const withD = ms
      .map((m) => ({ m, d: Math.hypot(m.bx - x, m.by - y) }))
      .sort((a, b) => a.d - b.d);
    if (withD.length === 0) return;
    const nearest = withD[0].m;
    // Zones voisines à proposer (dédupliquées), dans une marge de ~150
    const near: string[] = [];
    for (const w of withD) {
      if (w.d > withD[0].d + 150) break;
      if (!near.includes(w.m.zone)) near.push(w.m.zone);
      if (near.length >= 3) break;
    }
    setZone(nearest.zone);
    setSide(nearest.sideHint || "");
    setCandidates(near);
    setPoint({ bx: nearest.bx, by: nearest.by });
  };

  // Choix d'une zone voisine (chip) : garde le côté, replace le repère
  const pickCandidate = (z: string) => {
    setZone(z);
    const ms = view === "front" ? frontMarkers : backMarkers;
    const mk = ms.find((m) => m.zone === z && (side === "gauche" || side === "droite" ? m.sideHint === side : true));
    if (mk) setPoint({ bx: mk.bx, by: mk.by });
  };

  const validate = () => {
    if (!zone) return;
    onValidate(canSide && side ? `${zone} ${side}` : zone, level);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel?.(); onOpenChange(o); }}>
      <DialogContent className="max-w-[94vw] sm:max-w-md max-h-[94vh] overflow-y-auto p-4">
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

        <div className="w-full rounded-2xl overflow-hidden bg-black/20">
          {view === "front"
            ? <BodyPlate vb={[-190, 135, 1120, 1370]} point={point} onClickPoint={handleClickPoint} />
            : <BodyPlate vb={[910, 135, 1300, 1370]} point={point} onClickPoint={handleClickPoint} />}
        </div>

        {zone ? (
          <div className="space-y-2">
            {/* Zone la plus proche + alternatives voisines à préciser */}
            {candidates.length > 1 ? (
              <div className="space-y-1.5">
                <p className="text-center text-xs text-muted-foreground">Précise la zone :</p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {candidates.map((c) => (
                    <button key={c} type="button" onClick={() => pickCandidate(c)}
                      className={`px-3 h-8 rounded-full text-[13px] font-semibold border transition-colors ${zone === c ? "border-[#ff7a5c] bg-[rgba(239,90,60,0.16)] text-[#ff9a80]" : "border-border text-muted-foreground"}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-center text-sm font-semibold">{zone}</p>
            )}
            {canSide && (
              <div className="flex gap-2">
                {(["gauche", "droite", "les deux"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => {
                    setSide((p) => (p === s ? "" : s));
                    if (s === "gauche" || s === "droite") {
                      const ms = view === "front" ? frontMarkers : backMarkers;
                      const mk = ms.find((m) => m.zone === zone && m.sideHint === s);
                      if (mk) setPoint({ bx: mk.bx, by: mk.by });
                    }
                  }}
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
          <div className="space-y-1">
            <p className="text-[13px] font-semibold">À quel point&nbsp;?</p>
            <QuickRatingInput value={level} onChange={setLevel} min={1} max={7} labels={injuryLevelLabels} emojis={injuryLevelEmojis} variant="destructive" compact />
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
