import { cn } from "@/lib/utils";

interface QuickRatingInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  labels?: string[];
  emojis?: string[];
  activeLabel?: string;
  variant?: "primary" | "destructive";
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
}: QuickRatingInputProps) {
  const count = max - min + 1;
  const values = Array.from({ length: count }, (_, i) => min + i);

  const displayLabel = activeLabel || (labels ? labels[value - min] : undefined);

  const isPrimary = variant === "primary";

  const emoji = emojis ? emojis[value - min] : undefined;

  return (
    <div className="space-y-1.5">
      {/* Clickable rating buttons with emojis */}
      <div className="flex gap-1">
        {values.map((v) => {
          const isActive = v === value;
          const emojiForValue = emojis ? emojis[v - min] : undefined;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={cn(
                "flex-1 rounded-md font-medium transition-all min-h-[40px] sm:min-h-[44px] flex flex-col items-center justify-center gap-0.5",
                "border focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isActive
                  ? isPrimary
                    ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                    : "bg-destructive text-destructive-foreground border-destructive shadow-sm scale-105"
                  : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
              )}
            >
              {emojiForValue && <span className="text-base sm:text-lg leading-none">{emojiForValue}</span>}
              <span className="text-[10px] sm:text-xs leading-none">{v}</span>
            </button>
          );
        })}
      </div>

      {/* Active label */}
      {displayLabel && (
        <div className="text-center">
          <span
            className={cn(
              "inline-block px-2 py-0.5 sm:px-4 sm:py-1 rounded text-[10px] sm:text-sm font-medium",
              isPrimary
                ? "bg-primary/10 text-primary"
                : "bg-destructive/10 text-destructive"
            )}
          >
            {displayLabel}
          </span>
        </div>
      )}
    </div>
  );
}
