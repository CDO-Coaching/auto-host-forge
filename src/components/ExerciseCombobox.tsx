import { useState, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface ExerciseComboboxProps {
  value: string;
  onChange: (value: string) => void;
  exercises: Array<{ id: string; name: string; muscle_principal?: string | null; muscles_second?: string[] | null }>;
  disabled?: boolean;
  autoOpen?: boolean;
  onAutoOpenHandled?: () => void;
}

export function ExerciseCombobox({ value, onChange, exercises, disabled, autoOpen, onAutoOpenHandled }: ExerciseComboboxProps) {
  const [open, setOpen] = useState(false);
  
  // Ouvrir automatiquement si autoOpen est true
  useEffect(() => {
    if (autoOpen && !disabled) {
      setOpen(true);
      onAutoOpenHandled?.();
    }
  }, [autoOpen, disabled, onAutoOpenHandled]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Extraire les catégories uniques des exercices
  const categories = Array.from(new Set(exercises.map((ex) => ex.muscle_principal).filter(Boolean))).sort();

  // Filtrer les exercices par catégorie
  const filteredExercises = selectedCategory === "all" 
    ? exercises 
    : exercises.filter((ex) => ex.muscle_principal === selectedCategory);

  // Auto-focus le champ de recherche et scroll en haut quand le popover s'ouvre
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        const searchInput = document.querySelector('[cmdk-input]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
        // Scroller la liste en haut
        const commandList = document.querySelector('[cmdk-list]') as HTMLElement;
        if (commandList) {
          commandList.scrollTop = 0;
        }
      }, 0);
    }
  }, [open]);

  // Scroller en haut à chaque changement de catégorie ou recherche
  useEffect(() => {
    const commandList = document.querySelector('[cmdk-list]') as HTMLElement;
    if (commandList) {
      commandList.scrollTop = 0;
    }
  }, [selectedCategory, filteredExercises]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {value || "Sélectionner un exercice..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command
          filter={(value, search) => {
            const normalizedValue = value.toLowerCase();
            const normalizedSearch = search.toLowerCase();
            // Priorité haute si commence par la recherche
            if (normalizedValue.startsWith(normalizedSearch)) return 1;
            // Priorité moyenne si contient un mot qui commence par la recherche
            const words = normalizedValue.split(/\s+/);
            if (words.some(word => word.startsWith(normalizedSearch))) return 0.7;
            // Priorité basse si contient la recherche quelque part
            if (normalizedValue.includes(normalizedSearch)) return 0.5;
            return 0;
          }}
        >
          <div className="p-2 border-b">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filtrer par catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category!}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <CommandInput placeholder="Rechercher un exercice..." />
          <CommandList>
            <CommandEmpty>Aucun exercice trouvé.</CommandEmpty>
            <CommandGroup>
              {filteredExercises.map((exercise) => (
                <CommandItem
                  key={exercise.id}
                  value={exercise.name}
                  onSelect={(currentValue) => {
                    onChange(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                  className="flex items-start gap-2"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 mt-0.5 shrink-0",
                      value === exercise.name ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium uppercase">{exercise.name}</div>
                    {exercise.muscles_second && exercise.muscles_second.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {exercise.muscles_second.map((muscle, idx) => (
                          <Badge key={idx} variant="secondary" className="text-[10px] px-1 py-0 h-4">
                            {muscle}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
