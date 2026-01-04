import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Cake, X } from "lucide-react";

interface BirthdayAthlete {
  id: string;
  first_name: string;
  last_name: string;
  age: number;
}

interface CoachBirthdayAlertProps {
  athletes: BirthdayAthlete[];
  onDismiss: (athleteId: string) => void;
}

export function CoachBirthdayAlert({ athletes, onDismiss }: CoachBirthdayAlertProps) {
  if (athletes.length === 0) return null;

  return (
    <div className="space-y-3">
      {athletes.map((athlete) => (
        <Alert
          key={athlete.id}
          className="border-pink-500/50 bg-pink-500/10 relative"
        >
          <Cake className="h-5 w-5 text-pink-500" />
          <AlertTitle className="text-lg font-semibold flex items-center gap-2">
            🎂 Joyeux anniversaire !
          </AlertTitle>
          <AlertDescription className="mt-2">
            <span className="font-medium">
              {athlete.first_name} {athlete.last_name}
            </span>{" "}
            fête ses <span className="font-semibold">{athlete.age} ans</span> aujourd'hui !
            N'oublie pas de lui souhaiter 🎉
          </AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => onDismiss(athlete.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </Alert>
      ))}
    </div>
  );
}
