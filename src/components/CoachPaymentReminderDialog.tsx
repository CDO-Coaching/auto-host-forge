import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

  const handleNo = () => {
    onDismiss();
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Règlements à enregistrer ?</AlertDialogTitle>
          <AlertDialogDescription>
            Avez-vous des règlements à enregistrer aujourd'hui ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleNo}>Non</AlertDialogCancel>
          <AlertDialogAction onClick={handleYes}>
            Oui, aller à la comptabilité
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
