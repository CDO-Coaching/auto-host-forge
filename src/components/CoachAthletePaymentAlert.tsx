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
}

export function CoachAthletePaymentAlert({
  notifications,
  onDismiss,
  onDismissAll,
}: CoachAthletePaymentAlertProps) {
  if (notifications.length === 0) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Afficher le premier paiement en notification flottante
  const firstNotification = notifications[0];
  const hasMore = notifications.length > 1;

  return (
    <FloatingNotification
      open
      onDismiss={() => (hasMore ? onDismissAll() : onDismiss(firstNotification.id))}
      icon={<CreditCard className="h-5 w-5 text-primary" />}
      title="Nouveau paiement reçu !"
      description={
        hasMore
          ? `${notifications.length} paiements reçus de tes athlètes`
          : `${firstNotification.athleteName} a payé "${firstNotification.productName}"`
      }
      variant="primary"
      actions={
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => (hasMore ? onDismissAll() : onDismiss(firstNotification.id))}
            className="text-xs h-7"
          >
            <Check className="h-3 w-3 mr-1" />
            {hasMore ? "Tout marquer comme vu" : "OK"}
          </Button>
        </div>
      }
    />
  );
}
