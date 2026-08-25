import { NavLink } from "react-router-dom";
import { LucideIcon } from "lucide-react";

export interface HubTile {
  title: string;
  description?: string;
  url: string;
  icon: LucideIcon;
}

/**
 * Grille de tuiles tap-friendly pour les pages « hub » du menu sportif
 * (Mon suivi, Mon compte). Chaque tuile redirige vers une page réelle.
 */
export function HubGrid({ title, tiles }: { title: string; tiles: HubTile[] }) {
  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold">{title}</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {tiles.map((tile) => (
          <NavLink
            key={tile.url}
            to={tile.url}
            className="group flex flex-col items-start gap-2 rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-all active:scale-[0.98] hover:border-primary/40 hover:shadow-md app-tap"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
              <tile.icon className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold leading-tight">{tile.title}</span>
            {tile.description && (
              <span className="text-xs text-muted-foreground leading-snug">{tile.description}</span>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
