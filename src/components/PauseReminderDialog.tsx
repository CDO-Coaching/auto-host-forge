import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface PauseReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  athleteName: string;
  onConfirm: (reminderDate: Date | null) => void;
}

export function PauseReminderDialog({
  open,
  onOpenChange,
  athleteName,
  onConfirm,
}: PauseReminderDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [noReminder, setNoReminder] = useState(false);

  const handleConfirm = () => {
    if (noReminder) {
      onConfirm(null);
    } else if (selectedDate) {
      onConfirm(selectedDate);
    }
    setSelectedDate(undefined);
    setNoReminder(false);
  };

  const handleNoReminder = () => {
    setNoReminder(true);
    setSelectedDate(undefined);
  };

  const handleSelectDate = (date: Date | undefined) => {
    setSelectedDate(date);
    setNoReminder(false);
  };

  const isConfirmDisabled = !selectedDate && !noReminder;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 sm:mx-auto max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">
            Mettre {athleteName} en pause
          </DialogTitle>
          <DialogDescription className="text-sm">
            Quand veux-tu que je te rappelle de le/la recontacter ?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={selectedDate ? "default" : "outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !selectedDate && !noReminder && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? (
                  format(selectedDate, "PPP", { locale: fr })
                ) : (
                  "Choisir une date de rappel"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleSelectDate}
                disabled={(date) => date < new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
                locale={fr}
              />
            </PopoverContent>
          </Popover>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <Button
            variant={noReminder ? "default" : "outline"}
            className="w-full"
            onClick={handleNoReminder}
          >
            Ne pas recontacter
          </Button>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className="w-full sm:w-auto"
          >
            Confirmer la mise en pause
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
