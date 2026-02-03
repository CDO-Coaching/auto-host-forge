import { UserX } from "lucide-react";
import { FloatingNotification } from "@/components/FloatingNotification";

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
  /** Offset for stacking with other notifications */
  stackOffset?: number;
}

export function CoachCancellationAlert({ 
  notifications, 
  onDismiss,
  stackOffset = 0,
}: CoachCancellationAlertProps) {
  if (notifications.length === 0) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    });
  };

  // Show only the first cancellation as a floating notification
  const notification = notifications[0];

  return (
    <FloatingNotification
      open={true}
      onDismiss={() => onDismiss(notification.id)}
      icon={<UserX className="h-5 w-5 text-white" />}
      title={`${notification.athleteName} s'est désabonné(e)`}
      description={
        <div>
          <p>{notification.productName} • désabo le {formatDate(notification.cancelledAt)}</p>
          {notification.expiresAt && (
            <p className="font-semibold mt-1">
              ⏰ Programmation jusqu'au {formatDate(notification.expiresAt)}
            </p>
          )}
        </div>
      }
      variant="orange"
      stackIndex={stackOffset}
    />
  );
}
