import { useNavigate } from "react-router-dom";
import { FloatingNotification } from "@/components/FloatingNotification";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";

interface CoachPaymentReminderDialogProps {
  open: boolean;
  onDismiss: () => void;
}

export function CoachPaymentReminderDialog({
  open,
  onDismiss,
}: CoachPaymentReminderDialogProps) {
  const navigate = useNavigate();

  const handleYes = () => {
    onDismiss();
    navigate("/coach/comptabilite");
  };

  return (
    <FloatingNotification
      open={open}
      onDismiss={onDismiss}
      icon={<CreditCard className="h-5 w-5 text-primary" />}
      title="Règlements à enregistrer ?"
      description="Avez-vous des règlements à enregistrer aujourd'hui ?"
      variant="primary"
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onDismiss} className="text-xs h-7">
            Plus tard
          </Button>
          <Button size="sm" onClick={handleYes} className="text-xs h-7">
            Aller à la comptabilité
          </Button>
        </div>
      }
    />
  );
}
