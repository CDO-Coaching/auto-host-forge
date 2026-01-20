import { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingNotificationProps {
  open: boolean;
  onDismiss: () => void;
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  variant?: "default" | "amber" | "primary";
}

export function FloatingNotification({
  open,
  onDismiss,
  icon,
  title,
  description,
  actions,
  variant = "default",
}: FloatingNotificationProps) {
  if (!open) return null;

  const variantStyles = {
    default: "bg-card border-border",
    amber: "bg-amber-500/10 border-amber-500/50",
    primary: "bg-primary/10 border-primary/50",
  };

  const titleStyles = {
    default: "text-foreground",
    amber: "text-amber-600 dark:text-amber-400",
    primary: "text-primary",
  };

  return (
    <div
      className={cn(
        "fixed top-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-lg border shadow-lg backdrop-blur-sm cursor-pointer animate-fade-in",
        variantStyles[variant]
      )}
      onClick={onDismiss}
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
                className="flex-shrink-0 p-1 rounded-full hover:bg-muted/50 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            {description && (
              <div className="text-sm text-muted-foreground mt-1">
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
}
