import { useNavigate } from "react-router-dom";
import { FloatingNotification } from "@/components/FloatingNotification";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

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
    navigate(`/coach/notes?email=${encodeURIComponent(clientEmail)}`);
  };

  const handleDismiss = () => {
    onAcknowledge(false);
  };

  return (
    <FloatingNotification
      open={open}
      onDismiss={handleDismiss}
      icon={<FileText className="h-5 w-5 text-primary" />}
      title="Séance terminée"
      description={
        <div className="space-y-1">
          <p>Tu viens de terminer <strong>{eventTitle}</strong>.</p>
          <p className="text-xs">Client : {clientEmail}</p>
        </div>
      }
      variant="primary"
      actions={
        <Button size="sm" onClick={handleMakeNote} className="text-xs h-7">
          <FileText className="h-3 w-3 mr-1" />
          Faire une note
        </Button>
      }
    />
  );
}
