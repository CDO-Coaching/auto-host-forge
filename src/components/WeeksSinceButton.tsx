import { useState, useCallback } from "react";
import { differenceInCalendarWeeks } from "date-fns";
import { getMondayOfWeek } from "@/lib/weekUtils";
import { cn } from "@/lib/utils";
import { RefreshCw, CheckCircle2 } from "lucide-react";

/**
 * Bouton-compteur par athlète : nombre de semaines écoulées depuis le dernier clic.
 * Clic → remet à 0 (semaine en cours). Chaque semaine sans clic → +1.
 * Persisté en localStorage (par athlète).
 */
export function WeeksSinceButton({ athleteId }: { athleteId: string }) {
  const key = `weeks-since-${athleteId}`;

  const readCount = useCallback(() => {
    try {
      const stored = localStorage.getItem(key);
      const thisMonday = getMondayOfWeek(new Date());
      if (!stored) {
        // Première fois : on initialise sur la semaine en cours (compteur 0)
        localStorage.setItem(key, thisMonday.toISOString());
        return 0;
      }
      return Math.max(0, differenceInCalendarWeeks(thisMonday, new Date(stored), { weekStartsOn: 1 }));
    } catch {
      return 0;
    }
  }, [key]);

  const [count, setCount] = useState<number>(readCount);

  const reset = () => {
    try { localStorage.setItem(key, getMondayOfWeek(new Date()).toISOString()); } catch { /* ignore */ }
    setCount(0);
  };

  const done = count === 0;
  return (
    <button
      type="button"
      onClick={reset}
      title={done ? "Fait cette semaine — clique pour réinitialiser" : `${count} semaine(s) sans action — clique quand c'est fait`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-3 h-9 text-xs font-medium transition-colors shrink-0",
        done
          ? "border-green-500/40 bg-green-500/10 text-green-500 hover:bg-green-500/20"
          : count >= 3
            ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
            : "border-amber-500/40 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20",
      )}
    >
      {done ? <CheckCircle2 className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
      {done ? "Fait" : `${count} sem.`}
    </button>
  );
}
