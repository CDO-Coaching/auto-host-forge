import { FloatingNotification } from "@/components/FloatingNotification";
import { Button } from "@/components/ui/button";
import { CreditCard, Check } from "lucide-react";

interface PaymentNotification {
  id: string;
  athleteName: string;
  productName: string;
  paidAt: string;
}

interface CoachAthletePaymentAlertProps {
  notifications: PaymentNotification[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  /** Offset for stacking with other notifications */
  stackOffset?: number;
}

export function CoachAthletePaymentAlert({
  notifications,
  onDismiss,
  onDismissAll,
  stackOffset = 0,
}: CoachAthletePaymentAlertProps) {
  if (notifications.length === 0) return null;

  // Afficher le premier paiement en notification flottante
  const firstNotification = notifications[0];
  const hasMore = notifications.length > 1;

  return (
    <FloatingNotification
      open
      onDismiss={() => (hasMore ? onDismissAll() : onDismiss(firstNotification.id))}
      icon={<CreditCard className="h-5 w-5 text-primary-foreground" />}
      title="Nouveau paiement reçu !"
      description={
        hasMore
          ? `${notifications.length} paiements reçus de tes athlètes`
          : `${firstNotification.athleteName} a payé "${firstNotification.productName}"`
      }
      variant="primary"
      stackIndex={stackOffset}
      actions={
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => (hasMore ? onDismissAll() : onDismiss(firstNotification.id))}
            className="text-xs h-7 bg-white/20 hover:bg-white/30 text-white border-0"
          >
            <Check className="h-3 w-3 mr-1" />
            {hasMore ? "Tout marquer comme vu" : "OK"}
          </Button>
        </div>
      }
    />
  );
}
