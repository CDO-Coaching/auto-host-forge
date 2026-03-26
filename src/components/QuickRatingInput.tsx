import { Slider } from "@/components/ui/slider";
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
  activeLabel,
  variant = "primary",
}: QuickRatingInputProps) {
  const count = max - min + 1;
  const values = Array.from({ length: count }, (_, i) => min + i);

  const displayLabel = activeLabel || (labels ? labels[value - min] : undefined);

  const isPrimary = variant === "primary";

  return (
    <div className="space-y-1.5">
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        min={min}
        max={max}
        step={1}
        className="w-full"
      />

      {/* Clickable rating buttons */}
      <div className="flex gap-1">
        {values.map((v) => {
          const isActive = v === value;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={cn(
                "flex-1 rounded-md text-xs sm:text-sm font-medium transition-all min-h-[32px] sm:min-h-[36px]",
                "border focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isActive
                  ? isPrimary
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-destructive text-destructive-foreground border-destructive shadow-sm"
                  : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
              )}
            >
              {v}
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
