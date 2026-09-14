interface QuickRatingInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  labels?: string[];
  emojis?: string[];
  activeLabel?: string;
  variant?: "primary" | "destructive";
  /** Mode dense : masque les repères d'extrêmes et le libellé sous l'échelle (affiché par le parent). */
  compact?: boolean;
  /**
   * Sens des couleurs de l'échelle (vert = bon, rouge = mauvais) :
   * - "goodToBad" : 1er = vert … dernier = rouge (fatigue, courbatures, stress)
   * - "badToGood" : 1er = rouge … dernier = vert (qualité du sommeil)
   * - "warn"      : jaune → rouge foncé (douleur / intensité)
   * Par défaut déduit du variant (destructive → warn, sinon goodToBad).
   */
  colorScale?: "goodToBad" | "badToGood" | "warn";
}

const RAMP_GOOD_TO_BAD = ["#22c55e", "#86c72a", "#d4c62e", "#f0b429", "#f97316", "#ef5a3c", "#ef4444"];
const RAMP_WARN = ["#facc15", "#f0b429", "#f97316", "#ef5a3c", "#ef4444", "#dc2626", "#b91c1c"];

/** Couleur d'une position sur l'échelle (index 0..count-1), selon le sens choisi. */
export function scaleColor(index: number, count: number, scale: "goodToBad" | "badToGood" | "warn"): string {
  const ramp = scale === "warn" ? RAMP_WARN : RAMP_GOOD_TO_BAD;
  // Ramener l'index sur la longueur de la rampe (7 pas par défaut)
  const t = count <= 1 ? 0 : index / (count - 1);
  const pos = scale === "badToGood" ? 1 - t : t;
  const i = Math.round(pos * (ramp.length - 1));
  return ramp[Math.max(0, Math.min(ramp.length - 1, i))];
}

export function QuickRatingInput({
  value,
  onChange,
  min = 1,
  max = 7,
  labels,
  emojis,
  activeLabel,
  variant = "primary",
  colorScale,
  compact = false,
}: QuickRatingInputProps) {
  const count = max - min + 1;
  const values = Array.from({ length: count }, (_, i) => min + i);
  const scale: "goodToBad" | "badToGood" | "warn" = colorScale ?? (variant === "destructive" ? "warn" : "goodToBad");

  const displayLabel = activeLabel || (labels ? labels[value - min] : undefined);
  const selectedColor = scaleColor(value - min, count, scale);

  return (
    <div className={compact ? "" : "space-y-2"}>
      {/* Boutons colorés vert → rouge : le sens (bien / mal) se lit d'un coup d'œil */}
      <div className="flex gap-1.5">
        {values.map((v, i) => {
          const isActive = v === value;
          const emojiForValue = emojis ? emojis[v - min] : undefined;
          const col = scaleColor(i, count, scale);
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              aria-label={labels ? labels[v - min] : String(v)}
              style={{
                borderColor: isActive ? col : `${col}55`,
                backgroundColor: isActive ? col : `${col}1f`,
                transform: isActive ? "scale(1.1)" : undefined,
              }}
              className={`flex-1 ${compact ? "min-h-[40px]" : "min-h-[44px]"} aspect-square rounded-[12px] border flex items-center justify-center transition-all focus:outline-none ${
                isActive ? "border-2 shadow-md" : "active:scale-95"
              }`}
            >
              {emojiForValue
                ? <span className={`${compact ? "text-base" : "text-lg sm:text-xl"} leading-none`}>{emojiForValue}</span>
                : <span className="text-xs font-bold leading-none" style={{ color: isActive ? "#121212" : col }}>{v}</span>}
            </button>
          );
        })}
      </div>

      {/* Repères des extrêmes */}
      {!compact && labels && labels.length >= count && (
        <div className="flex justify-between px-0.5">
          <span className="text-[10.5px] text-muted-foreground/70">{labels[0]}</span>
          <span className="text-[10.5px] text-muted-foreground/70">{labels[count - 1]}</span>
        </div>
      )}

      {/* Choix sélectionné mis en avant (masqué en mode compact : affiché par le parent) */}
      {!compact && displayLabel && (
        <div className="text-center">
          <span
            className="inline-block px-3 py-1 rounded-full text-[12.5px] font-bold"
            style={{ backgroundColor: selectedColor, color: "#121212" }}
          >
            {displayLabel}
          </span>
        </div>
      )}
    </div>
  );
}
