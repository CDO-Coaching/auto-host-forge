import { Bell, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { FloatingNotification } from "@/components/FloatingNotification";

interface PauseReminder {
  relationshipId: string;
  athleteId: string;
  athleteName: string;
  reminderDate: string;
}

interface CoachPauseReminderAlertProps {
  reminders: PauseReminder[];
  onDismiss: (relationshipId: string) => void;
  /** Offset for stacking with other notifications */
  stackOffset?: number;
}

export function CoachPauseReminderAlert({
  reminders,
  onDismiss,
  stackOffset = 0,
}: CoachPauseReminderAlertProps) {
  const navigate = useNavigate();

  if (reminders.length === 0) return null;

  // Show only the first reminder as a floating notification
  // Others will appear after dismissing this one
  const reminder = reminders[0];

  return (
    <FloatingNotification
      open={true}
      onDismiss={() => onDismiss(reminder.relationshipId)}
      icon={<Bell className="h-5 w-5 text-white" />}
      title="Rappel de recontact"
      description={
        <p>
          Pense à renvoyer un message à <strong>{reminder.athleteName}</strong>
        </p>
      }
      variant="amber"
      stackIndex={stackOffset}
      actions={
        <>
          <Button
            size="sm"
            variant="secondary"
            className="text-xs h-7 bg-white/20 hover:bg-white/30 text-white border-0"
            onClick={() => {
              onDismiss(reminder.relationshipId);
              navigate("/coach/messagerie");
            }}
          >
            <MessageSquare className="h-3 w-3 mr-1" />
            Envoyer un message
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="text-xs h-7 bg-white/20 hover:bg-white/30 text-white border-0"
            onClick={() => {
              onDismiss(reminder.relationshipId);
              navigate("/coach/mes-clients");
            }}
          >
            Voir les clients
          </Button>
        </>
      }
    />
  );
}
