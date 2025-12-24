import { Bell } from "lucide-react";
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

interface WeightReminderDialogProps {
  open: boolean;
  onDismiss: () => void;
}

export function WeightReminderDialog({ open, onDismiss }: WeightReminderDialogProps) {
  const navigate = useNavigate();

  const handleRecord = () => {
    onDismiss();
    navigate("/sportif/poids");
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Rappel poids
          </AlertDialogTitle>
          <AlertDialogDescription>
            C'est le moment d'enregistrer ton poids ! Cela ne prend que quelques secondes. 📊
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDismiss}>Plus tard</AlertDialogCancel>
          <AlertDialogAction onClick={handleRecord}>
            Enregistrer maintenant
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
