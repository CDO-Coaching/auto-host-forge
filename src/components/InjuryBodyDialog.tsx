import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QuickRatingInput } from "./QuickRatingInput";

const injuryLevelLabels = ["Gêne", "Très légère", "Légère", "Modérée", "Gênante", "Importante", "Très forte"];
const injuryLevelEmojis = ["🩹", "😕", "😣", "😖", "😫", "🤕", "🚑"];

// Arbre de sélection : Haut / Milieu / Bas → sous-région → zone précise (2-3 clics)
const TREE: { key: string; emoji: string; subs: { key: string; zones: string[] }[] }[] = [
  {
    key: "Haut", emoji: "🙆",
    subs: [
      { key: "Nuque / épaules", zones: ["Nuque / cervicales", "Trapèzes", "Épaule"] },
      { key: "Bras", zones: ["Biceps", "Triceps", "Coude", "Avant-bras / poignet"] },
      { key: "Poitrine / haut du dos", zones: ["Pectoral", "Dos (milieu / thoracique)"] },
    ],
  },
  {
    key: "Milieu", emoji: "🧍",
    subs: [
      { key: "Ventre / lombaires", zones: ["Abdominaux", "Bas du dos (lombaires)"] },
      { key: "Hanche / bassin", zones: ["Hanche (flexeur)", "Hanche (abducteur)", "Pubis / aine", "Fessier"] },
    ],
  },
  {
    key: "Bas", emoji: "🦵",
    subs: [
      { key: "Cuisse", zones: ["Quadriceps", "Ischio-jambiers", "Adducteurs"] },
      { key: "Genou", zones: ["Genou (avant / rotule)", "Genou (interne)", "Genou (externe / bandelette IT)"] },
      { key: "Jambe", zones: ["Mollet", "Tibia (périostite)", "Péroné"] },
      { key: "Pied & cheville", zones: ["Cheville", "Tendon d'Achille", "Pied (plantaire)", "Orteils"] },
    ],
  },
];

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
  const [big, setBig] = useState<string>("");
  const [sub, setSub] = useState<string>("");
  const [zone, setZone] = useState<string>("");
  const [side, setSide] = useState<"" | "gauche" | "droite" | "les deux">("");
  const [level, setLevel] = useState<number>(3);

  // Retrouver big/sub depuis une zone (édition)
  const locate = useMemo(() => {
    const map: Record<string, { big: string; sub: string }> = {};
    TREE.forEach((b) => b.subs.forEach((s) => s.zones.forEach((z) => { map[z] = { big: b.key, sub: s.key }; })));
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
    setBig(locate[z]?.big || "");
    setSub(locate[z]?.sub || "");
    setSide(s);
    setLevel(initialLevel && initialLevel >= 1 ? initialLevel : 3);
  }, [open, initialLocation, initialLevel, locate]);

  const bigNode = TREE.find((b) => b.key === big);
  const subNode = bigNode?.subs.find((s) => s.key === sub);
  const canSide = !!zone && !NON_SIDED.has(zone);

  const pickSub = (s: { key: string; zones: string[] }) => {
    setSub(s.key);
    // Sous-région à une seule zone → on la choisit direct
    setZone(s.zones.length === 1 ? s.zones[0] : "");
    setSide("");
  };

  const validate = () => {
    if (!zone) return;
    onValidate(canSide && side ? `${zone} ${side}` : zone, level);
    onOpenChange(false);
  };

  const Chip = ({ label, active, onClick, big: isBig }: { label: string; active: boolean; onClick: () => void; big?: boolean }) => (
    <button type="button" onClick={onClick}
      className={`rounded-xl border font-semibold transition-all ${isBig ? "flex-1 flex flex-col items-center gap-1 py-3 border-2" : "px-3 h-9 text-[13px]"} ${active ? "border-[#ff7a5c] bg-[rgba(239,90,60,0.16)] text-[#ff9a80]" : `border-border ${isBig ? "bg-card/40 text-foreground active:scale-[0.98]" : "text-muted-foreground"}`}`}>
      {label}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel?.(); onOpenChange(o); }}>
      <DialogContent className="max-w-[94vw] sm:max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Où as-tu mal&nbsp;?</DialogTitle>
        </DialogHeader>

        {/* 1. Haut / Milieu / Bas */}
        <div className="flex gap-2">
          {TREE.map((b) => (
            <button key={b.key} type="button"
              onClick={() => { setBig(b.key); setSub(""); setZone(""); setSide(""); }}
              className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl border-2 font-semibold transition-all ${big === b.key ? "border-[#ff7a5c] bg-[rgba(239,90,60,0.14)] text-[#ff9a80]" : "border-border bg-card/40 text-foreground active:scale-[0.98]"}`}>
              <span className="text-2xl leading-none">{b.emoji}</span>
              <span className="text-[13px]">{b.key}</span>
            </button>
          ))}
        </div>

        {/* 2. Sous-région */}
        {bigNode && (
          <div className="flex flex-wrap gap-1.5">
            {bigNode.subs.map((s) => (
              <Chip key={s.key} label={s.key} active={sub === s.key} onClick={() => pickSub(s)} />
            ))}
          </div>
        )}

        {/* 3. Zone précise (si plusieurs) */}
        {subNode && subNode.zones.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {subNode.zones.map((z) => (
              <Chip key={z} label={z} active={zone === z} onClick={() => { setZone(z); if (NON_SIDED.has(z)) setSide(""); }} />
            ))}
          </div>
        )}

        {/* Côté */}
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

        {/* Intensité */}
        {zone && (
          <div className="space-y-1.5">
            <p className="text-[13px] font-semibold text-muted-foreground">À quel point&nbsp;?</p>
            <QuickRatingInput value={level} onChange={setLevel} min={1} max={7} labels={injuryLevelLabels} emojis={injuryLevelEmojis} variant="destructive" />
          </div>
        )}

        <DialogFooter className="flex-col gap-2">
          <Button onClick={validate} disabled={!zone} className="w-full">
            {zone ? "Valider ma douleur" : "Choisis la zone"}
          </Button>
          <Button variant="ghost" onClick={() => { onCancel?.(); onOpenChange(false); }} className="w-full text-muted-foreground">
            Finalement, pas de douleur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
