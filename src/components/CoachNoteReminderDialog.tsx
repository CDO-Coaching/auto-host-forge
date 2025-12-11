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
import { FileText, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CoachNoteReminderDialogProps {
  open: boolean;
  clientEmail: string;
  eventTitle: string;
  onAcknowledge: (navigateToNotes: boolean) => void;
}

export function CoachNoteReminderDialog({
  open,
  clientEmail,
  eventTitle,
  onAcknowledge,
}: CoachNoteReminderDialogProps) {
  const navigate = useNavigate();

  const handleMakeNote = () => {
    onAcknowledge(true);
    // Pass email via URL search params
    navigate(`/coach/notes?email=${encodeURIComponent(clientEmail)}`);
  };

  const handleLater = () => {
    onAcknowledge(false);
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Séance terminée
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Tu viens de terminer <strong>{eventTitle}</strong>.
            </p>
            <p className="text-muted-foreground">
              Client : <span className="font-medium">{clientEmail}</span>
            </p>
            <p>N'oublie pas de faire une note !</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={handleLater} className="flex items-center gap-2">
            <X className="h-4 w-4" />
            Plus tard
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleMakeNote} className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Faire une note
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
