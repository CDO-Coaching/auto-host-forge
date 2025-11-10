import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Exercise {
  id: string;
  name: string;
}

interface ExerciseFilterComboboxProps {
  value: string;
  onChange: (value: string) => void;
  exercises: Exercise[];
}

// Exercices prioritaires à afficher en premier
const PRIORITY_EXERCISES = [
  "DEV COUCHÉ",
  "BACK SQUAT",
  "SOULEVÉ DE TERRE",
  "STRICT PRESS",
  "ARRACHÉ",
  "ÉPAULÉ",
  "FRONT SQUAT",
];

export function ExerciseFilterCombobox({ value, onChange, exercises }: ExerciseFilterComboboxProps) {
  const [open, setOpen] = useState(false);

  // Séparer exercices prioritaires et autres
  const priorityExercises = exercises.filter((ex) =>
    PRIORITY_EXERCISES.some((priority) => ex.name.toUpperCase().includes(priority))
  );

  const otherExercises = exercises.filter(
    (ex) => !PRIORITY_EXERCISES.some((priority) => ex.name.toUpperCase().includes(priority))
  );

  // Trier les autres exercices alphabétiquement
  const sortedOtherExercises = [...otherExercises].sort((a, b) => a.name.localeCompare(b.name));

  // Auto-focus le champ de recherche quand le popover s'ouvre
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        const searchInput = document.querySelector('[cmdk-input]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }, 0);
    }
  }, [open]);

  const selectedExercise = exercises.find((ex) => ex.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedExercise ? selectedExercise.name : "Tous les exercices"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher un exercice..." />
          <CommandList>
            <CommandEmpty>Aucun exercice trouvé.</CommandEmpty>
            
            <CommandGroup heading="Tous">
              <CommandItem
                value="all"
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === "" ? "opacity-100" : "opacity-0"
                  )}
                />
                Tous les exercices
              </CommandItem>
            </CommandGroup>

            {priorityExercises.length > 0 && (
              <CommandGroup heading="Exercices principaux">
                {priorityExercises.map((exercise) => (
                  <CommandItem
                    key={exercise.id}
                    value={exercise.name}
                    onSelect={() => {
                      onChange(exercise.id);
                      setOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === exercise.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <Star className="mr-2 h-3 w-3 text-yellow-500 fill-yellow-500" />
                    {exercise.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {sortedOtherExercises.length > 0 && (
              <CommandGroup heading="Autres exercices">
                {sortedOtherExercises.map((exercise) => (
                  <CommandItem
                    key={exercise.id}
                    value={exercise.name}
                    onSelect={() => {
                      onChange(exercise.id);
                      setOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === exercise.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {exercise.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
