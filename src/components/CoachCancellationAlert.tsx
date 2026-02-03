import React from "react";
import { createPortal } from "react-dom";
import { X, UserX } from "lucide-react";

interface CancellationNotification {
  id: string;
  athleteName: string;
  productName: string;
  cancelledAt: string;
  expiresAt: string | null;
}

interface CoachCancellationAlertProps {
  notifications: CancellationNotification[];
  onDismiss: (id: string) => void;
}

export function CoachCancellationAlert({ notifications, onDismiss }: CoachCancellationAlertProps) {
  if (notifications.length === 0) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    });
  };

  const alertContent = (
    <div className="fixed top-16 right-4 z-[100] space-y-2 max-w-sm">
      {notifications.slice(0, 3).map((notification) => (
        <div
          key={notification.id}
          className="bg-orange-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-start gap-3 animate-in slide-in-from-right cursor-pointer hover:bg-orange-600 transition-colors"
          onClick={() => onDismiss(notification.id)}
        >
          <UserX className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">
              {notification.athleteName} s'est désabonné(e)
            </p>
            <p className="text-xs text-white/80 truncate">
              {notification.productName} • désabo le {formatDate(notification.cancelledAt)}
            </p>
            {notification.expiresAt && (
              <p className="text-xs text-white font-semibold mt-0.5">
                ⏰ Programmation jusqu'au {formatDate(notification.expiresAt)}
              </p>
            )}
          </div>
          <X className="h-4 w-4 flex-shrink-0 opacity-70 hover:opacity-100" />
        </div>
      ))}
      {notifications.length > 3 && (
        <p className="text-xs text-muted-foreground text-right">
          +{notifications.length - 3} autre(s)
        </p>
      )}
    </div>
  );

  return createPortal(alertContent, document.body);
}
