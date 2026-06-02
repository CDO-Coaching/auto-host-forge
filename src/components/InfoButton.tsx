/**
 * InfoButton — icône ℹ️ cliquable affichant une explication dans un Popover.
 * Fonctionne sur mobile (tap) et desktop (clic).
 * Remplace les Tooltip hover-only qui ne fonctionnent pas sur touch.
 */
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface InfoButtonProps {
  text: string;
  className?: string;
}

export function InfoButton({ text, className = "" }: InfoButtonProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0 ${className}`}
          aria-label="Plus d'informations"
        >
          <Info className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="text-xs text-muted-foreground max-w-xs" side="top">
        {text}
      </PopoverContent>
    </Popover>
  );
}
