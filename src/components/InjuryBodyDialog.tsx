import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QuickRatingInput } from "./QuickRatingInput";
const injuryLevelLabels = ["Gêne", "Très légère", "Légère", "Modérée", "Gênante", "Importante", "Très forte"];
const injuryLevelEmojis = ["🩹", "😕", "😣", "😖", "😫", "🤕", "🚑"];

// Grandes régions du corps → zones précises
const REGIONS: { category: string; emoji: string; zones: string[] }[] = [
  { category: "Pied & cheville", emoji: "🦶", zones: ["Cheville", "Tendon d'Achille", "Pied (plantaire)", "Orteils"] },
  { category: "Jambe", emoji: "🦵", zones: ["Quadriceps", "Ischio-jambiers", "Adducteurs", "Genou (avant / rotule)", "Genou (interne)", "Genou (externe / bandelette IT)", "Mollet", "Tibia (périostite)", "Péroné"] },
  { category: "Bras", emoji: "💪", zones: ["Épaule", "Biceps", "Triceps", "Coude", "Avant-bras / poignet"] },
  { category: "Buste", emoji: "👕", zones: ["Pectoral", "Abdominaux"] },
  { category: "Dos", emoji: "🔙", zones: ["Nuque / cervicales", "Trapèzes", "Dos (milieu / thoracique)", "Bas du dos (lombaires)"] },
  { category: "Hanches", emoji: "🦴", zones: ["Hanche (flexeur)", "Hanche (abducteur)", "Fessier", "Pubis / aine"] },
];

// Zones non latéralisables (pas de gauche/droite)
const NON_SIDED = new Set([
  "Abdominaux", "Pubis / aine", "Bas du dos (lombaires)", "Dos (milieu / thoracique)",
  "Nuque / cervicales", "Trapèzes", "Pectoral",
]);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLocation?: string;
  initialLevel?: number;
  onValidate: (location: string, level: number) => void;
  onCancel?: () => void;
}

export function InjuryBodyDialog({ open, onOpenChange, initialLocation, initialLevel, onValidate, onCancel }: Props) {
  const [region, setRegion] = useState<string>("");
  const [zone, setZone] = useState<string>("");
  const [side, setSide] = useState<"" | "gauche" | "droite" | "les deux">("");
  const [level, setLevel] = useState<number>(3);

  const zoneToRegion = useMemo(() => {
    const map: Record<string, string> = {};
    REGIONS.forEach((g) => g.zones.forEach((z) => { map[z] = g.category; }));
    return map;
  }, []);

  useEffect(() => {
    if (!open) return;
    const val = (initialLocation || "").trim();
    let z = val, s: typeof side = "";
    for (const suf of ["gauche", "droite", "les deux"] as const) {
      if (val.toLowerCase().endsWith(" " + suf)) { z = val.slice(0, -(suf.length + 1)); s = suf; break; }
    }
    setZone(z);
    setRegion(zoneToRegion[z] || "");
    setSide(s);
    setLevel(initialLevel && initialLevel >= 1 ? initialLevel : 3);
  }, [open, initialLocation, initialLevel, zoneToRegion]);

  const canSide = !!zone && !NON_SIDED.has(zone);
  const currentZones = REGIONS.find((g) => g.category === region)?.zones || [];

  const validate = () => {
    if (!zone) return;
    onValidate(canSide && side ? `${zone} ${side}` : zone, level);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel?.(); onOpenChange(o); }}>
      <DialogContent className="max-w-[94vw] sm:max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Où as-tu mal&nbsp;?</DialogTitle>
        </DialogHeader>

        {/* Étape 1 : grande région */}
        <div className="space-y-2">
          <p className="text-[13px] font-semibold text-muted-foreground">1. Quelle partie du corps&nbsp;?</p>
          <div className="grid grid-cols-3 gap-2">
            {REGIONS.map((g) => {
              const active = region === g.category;
              return (
                <button key={g.category} type="button"
                  onClick={() => { setRegion(g.category); setZone(""); setSide(""); }}
                  className={`flex flex-col items-center justify-center gap-1 rounded-2xl border-2 py-3 transition-all ${active ? "border-[#ff7a5c] bg-[rgba(239,90,60,0.14)]" : "border-border bg-card/40 active:scale-[0.98]"}`}>
                  <span className="text-2xl leading-none">{g.emoji}</span>
                  <span className={`text-[11px] font-semibold leading-tight text-center ${active ? "text-[#ff9a80]" : "text-foreground"}`}>{g.category}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Étape 2 : zone précise */}
        {region && (
          <div className="space-y-2">
            <p className="text-[13px] font-semibold text-muted-foreground">2. Précise l'endroit</p>
            <div className="flex flex-wrap gap-1.5">
              {currentZones.map((z) => {
                const active = zone === z;
                return (
                  <button key={z} type="button" onClick={() => { setZone(z); if (NON_SIDED.has(z)) setSide(""); }}
                    className={`px-3 h-9 rounded-xl border text-[13px] font-semibold transition-colors ${active ? "border-[#ff7a5c] bg-[rgba(239,90,60,0.16)] text-[#ff9a80]" : "border-border text-muted-foreground"}`}>
                    {z}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Côté */}
        {canSide && (
          <div className="space-y-1.5">
            <p className="text-[13px] font-semibold text-muted-foreground">Quel côté&nbsp;?</p>
            <div className="flex gap-2">
              {(["gauche", "droite", "les deux"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setSide((p) => (p === s ? "" : s))}
                  className={`flex-1 h-10 rounded-xl border text-sm font-medium capitalize transition-colors ${side === s ? "border-[#ff7a5c] bg-[rgba(239,90,60,0.16)] text-[#ff9a80]" : "border-border text-muted-foreground"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Étape 3 : intensité */}
        {zone && (
          <div className="space-y-1.5">
            <p className="text-[13px] font-semibold text-muted-foreground">3. À quel point&nbsp;?</p>
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
