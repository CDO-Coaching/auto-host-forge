import { Bell, MessageSquare, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface PauseReminder {
  relationshipId: string;
  athleteId: string;
  athleteName: string;
  reminderDate: string;
}

interface CoachPauseReminderAlertProps {
  reminders: PauseReminder[];
  onDismiss: (relationshipId: string) => void;
}

export function CoachPauseReminderAlert({
  reminders,
  onDismiss,
}: CoachPauseReminderAlertProps) {
  const navigate = useNavigate();

  if (reminders.length === 0) return null;

  return (
    <div className="space-y-2">
      {reminders.map((reminder) => (
        <Alert
          key={reminder.relationshipId}
          className="border-amber-500/50 bg-amber-500/10"
        >
          <Bell className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-600 dark:text-amber-400 flex items-center justify-between">
            <span>Rappel de recontact</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onDismiss(reminder.relationshipId)}
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <p className="mb-2">
              Pense à renvoyer un message à <strong>{reminder.athleteName}</strong>
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => navigate("/coach/messagerie")}
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                Envoyer un message
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => navigate("/coach/mes-clients")}
              >
                Voir les clients
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
