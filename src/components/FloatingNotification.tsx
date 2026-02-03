import { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingNotificationProps {
  open: boolean;
  onDismiss: () => void;
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  variant?: "default" | "amber" | "primary" | "orange";
  /** Position in the stack (0 = top, 1 = second, etc.) */
  stackIndex?: number;
}

export function FloatingNotification({
  open,
  onDismiss,
  icon,
  title,
  description,
  actions,
  variant = "default",
  stackIndex = 0,
}: FloatingNotificationProps) {
  if (!open) return null;

  const variantStyles = {
    default: "bg-card border-border text-foreground",
    amber: "bg-amber-500 border-amber-600 text-white",
    primary: "bg-primary border-primary text-primary-foreground",
    orange: "bg-orange-500 border-orange-600 text-white",
  };

  const titleStyles = {
    default: "text-foreground",
    amber: "text-white",
    primary: "text-primary-foreground",
    orange: "text-white",
  };

  const descStyles = {
    default: "text-muted-foreground",
    amber: "text-white/90",
    primary: "text-primary-foreground/90",
    orange: "text-white/90",
  };

  const closeStyles = {
    default: "text-muted-foreground hover:text-foreground",
    amber: "text-white/70 hover:text-white",
    primary: "text-primary-foreground/70 hover:text-primary-foreground",
    orange: "text-white/70 hover:text-white",
  };

  // Calculer la position verticale en fonction de l'index dans la stack
  const topOffset = 16 + stackIndex * 90; // 16px de base + 90px par notification

  const node = (
    <div
      className={cn(
        "fixed right-4 z-[100] w-80 max-w-[calc(100vw-2rem)] rounded-lg border-2 shadow-xl cursor-pointer animate-in slide-in-from-right duration-300",
        variantStyles[variant]
      )}
      style={{ top: `${topOffset}px` }}
      onClick={onDismiss}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onDismiss();
      }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {icon && <div className="flex-shrink-0 mt-0.5">{icon}</div>}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className={cn("font-semibold text-sm", titleStyles[variant])}>
                {title}
              </h4>
              <button
                type="button"
                className={cn(
                  "flex-shrink-0 p-1 rounded-full transition-colors",
                  closeStyles[variant]
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {description && (
              <div className={cn("text-sm mt-1", descStyles[variant])}>
                {description}
              </div>
            )}
            {actions && (
              <div
                className="mt-3 flex flex-wrap gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                {actions}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Render in a portal to avoid being clipped by any transformed/overflow ancestors.
  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}

