import { ReactNode, useRef, useState, useCallback } from "react";
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
  const [swipeX, setSwipeX] = useState(0);
  const [isDismissing, setIsDismissing] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwipingRef = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwipingRef.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    // Only swipe horizontally if horizontal movement > vertical
    if (!isSwipingRef.current && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      isSwipingRef.current = true;
    }

    if (isSwipingRef.current) {
      e.preventDefault();
      setSwipeX(Math.max(0, deltaX));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (swipeX > 100) {
      setIsDismissing(true);
      setSwipeX(400);
      setTimeout(() => {
        onDismiss();
        setSwipeX(0);
        setIsDismissing(false);
      }, 200);
    } else {
      setSwipeX(0);
    }
    isSwipingRef.current = false;
  }, [swipeX, onDismiss]);

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

  // Position below the header (h-14 = 56px) + safe area + spacing
  const topOffset = 72 + stackIndex * 90;

  const node = (
    <div
      className={cn(
        "fixed right-4 z-[100] w-80 max-w-[calc(100vw-2rem)] rounded-lg border-2 shadow-xl cursor-pointer",
        !isDismissing && swipeX === 0 && "animate-in slide-in-from-right duration-300",
        variantStyles[variant]
      )}
      style={{
        top: `${topOffset}px`,
        transform: `translateX(${swipeX}px)`,
        opacity: isDismissing ? 0 : swipeX > 0 ? Math.max(0, 1 - swipeX / 200) : 1,
        transition: isSwipingRef.current ? "none" : "transform 0.2s ease-out, opacity 0.2s ease-out",
      }}
      onClick={() => {
        if (!isSwipingRef.current && swipeX === 0) onDismiss();
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
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
                  "flex-shrink-0 p-2 -m-1 rounded-full transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center",
                  closeStyles[variant]
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
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

  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}
