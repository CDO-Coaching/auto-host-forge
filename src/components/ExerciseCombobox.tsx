import { useState, useEffect, useMemo } from "react";
import { Check, ChevronsUpDown, Plus, Clock, VideoOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Accent-insensitive normalization ────────────────────────────────────────
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// ─── Recent exercises (localStorage) ─────────────────────────────────────────

const RECENT_KEY = "exercise-recent";
const RECENT_MAX = 8;

// Exercises created on the fly that need completion in BibliothequeExercices
export const PENDING_COMPLETION_KEY = "exercises-pending-completion";
export function pushPendingCompletion(id: string) {
  try {
    const existing: string[] = JSON.parse(localStorage.getItem(PENDING_COMPLETION_KEY) ?? "[]");
    if (!existing.includes(id)) localStorage.setItem(PENDING_COMPLETION_KEY, JSON.stringify([...existing, id]));
  } catch {}
}

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); } catch { return []; }
}
function pushRecent(name: string) {
  const list = [name, ...getRecent().filter((n) => n !== name)].slice(0, RECENT_MAX);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LibraryExercise {
  id: string;
  name: string;
  muscle_principal?: string | null;
  muscles_second?: string[] | null;
  video_url?: string | null;
}

interface ExerciseComboboxProps {
  value: string;
  onChange: (value: string) => void;
  exercises: LibraryExercise[];
  disabled?: boolean;
  autoOpen?: boolean;
  onAutoOpenHandled?: () => void;
  onExerciseCreated?: (ex: LibraryExercise) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExerciseCombobox({
  value, onChange, exercises, disabled,
  autoOpen, onAutoOpenHandled, onExerciseCreated,
}: ExerciseComboboxProps) {
  const [open, setOpen] = useState(false);
  const [selectedMuscle, setSelectedMuscle] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [recentNames, setRecentNames] = useState<string[]>([]);

  // Auto-open on keyboard nav
  useEffect(() => {
    if (autoOpen && !disabled) { setOpen(true); onAutoOpenHandled?.(); }
  }, [autoOpen, disabled, onAutoOpenHandled]);

  // Reset state when popover opens
  useEffect(() => {
    if (open) { setRecentNames(getRecent()); setSearch(""); setSelectedMuscle("all"); }
  }, [open]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const muscles = useMemo(
    () => Array.from(new Set(exercises.map((e) => e.muscle_principal).filter(Boolean))).sort() as string[],
    [exercises],
  );

  const displayedExercises = useMemo(() => {
    let list = exercises;
    if (selectedMuscle !== "all") list = list.filter((e) => e.muscle_principal === selectedMuscle);
    if (search.trim()) {
      const s = norm(search.trim());
      list = list
        .filter((e) => {
          const n = norm(e.name);
          return n.startsWith(s) || n.split(/\s+/).some((w) => w.startsWith(s)) || n.includes(s);
        })
        .sort((a, b) => {
          const an = norm(a.name), bn = norm(b.name);
          if (an.startsWith(s) && !bn.startsWith(s)) return -1;
          if (bn.startsWith(s) && !an.startsWith(s)) return 1;
          return an.localeCompare(bn);
        });
    }
    return list;
  }, [exercises, selectedMuscle, search]);

  const recentExercises = useMemo(
    () => recentNames.map((n) => exercises.find((e) => e.name === n)).filter(Boolean) as LibraryExercise[],
    [recentNames, exercises],
  );

  const showRecents = !search.trim() && selectedMuscle === "all" && recentExercises.length > 0;
  const noResults = displayedExercises.length === 0;

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSelect = (name: string) => {
    onChange(name);
    pushRecent(name);
    setOpen(false);
    setSearch("");
  };

  const handleCreate = async () => {
    const trimmed = search.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("exercise_library")
        .insert({ name: trimmed })
        .select("id, name, muscle_principal, muscles_second")
        .single();
      if (error) throw error;
      onExerciseCreated?.(data as LibraryExercise);
      pushPendingCompletion(data.id);
      handleSelect(data.name);
      toast.success(`"${data.name}" ajouté — complète la fiche dans la Bibliothèque`);
    } catch {
      toast.error("Impossible de créer l'exercice");
    } finally {
      setCreating(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

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
          <span className="truncate">{value || "Sélectionner un exercice..."}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[370px] p-0" align="start">
        <Command shouldFilter={false}>
          {/* Search */}
          <CommandInput
            placeholder="Rechercher un exercice..."
            value={search}
            onValueChange={setSearch}
          />

          {/* Muscle pills */}
          <div className="flex gap-1.5 px-2 py-2 overflow-x-auto border-b scrollbar-none">
            <MuscleChip label="Tout" active={selectedMuscle === "all"} onClick={() => setSelectedMuscle("all")} />
            {muscles.map((m) => (
              <MuscleChip
                key={m}
                label={m}
                active={selectedMuscle === m}
                onClick={() => setSelectedMuscle(selectedMuscle === m ? "all" : m)}
              />
            ))}
          </div>

          <CommandList className="max-h-[280px]">
            {/* Recent */}
            {showRecents && (
              <CommandGroup
                heading={
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                    <Clock className="h-3 w-3" /> Récents
                  </span>
                }
              >
                {recentExercises.map((ex) => (
                  <CommandItem
                    key={`recent-${ex.id}`}
                    value={`recent-${ex.name}`}
                    onSelect={() => handleSelect(ex.name)}
                    className="flex items-center gap-2 py-1.5"
                  >
                    <Check className={cn("h-4 w-4 shrink-0", value === ex.name ? "opacity-100" : "opacity-0")} />
                    <span className="font-medium uppercase text-sm flex-1 truncate">{ex.name}</span>
                    {!ex.video_url && (
                      <VideoOff className="h-3.5 w-3.5 shrink-0 text-amber-500" title="Pas de vidéo" />
                    )}
                    {ex.muscle_principal && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">
                        {ex.muscle_principal}
                      </Badge>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Main list */}
            {!noResults && (
              <CommandGroup heading={search ? "Résultats" : showRecents ? "Tous" : undefined}>
                {displayedExercises.map((ex) => (
                  <CommandItem
                    key={ex.id}
                    value={ex.name}
                    onSelect={() => handleSelect(ex.name)}
                    className="flex items-start gap-2 py-1.5"
                  >
                    <Check className={cn("h-4 w-4 mt-0.5 shrink-0", value === ex.name ? "opacity-100" : "opacity-0")} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium uppercase text-sm">{ex.name}</span>
                        {!ex.video_url && (
                          <VideoOff className="h-3.5 w-3.5 shrink-0 text-amber-500" title="Pas de vidéo" />
                        )}
                      </div>
                      {ex.muscles_second && ex.muscles_second.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {ex.muscles_second.map((m, i) => (
                            <Badge key={i} variant="secondary" className="text-[9px] px-1 py-0 h-4">{m}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Empty state + create on the fly */}
            {noResults && (
              <div className="py-6 text-center space-y-3">
                {search.trim() ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Aucun exercice pour <span className="font-medium">«&nbsp;{search}&nbsp;»</span>
                    </p>
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={creating}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      {creating ? "Création…" : `Créer "${search.trim()}"`}
                    </button>
                    <p className="text-[10px] text-muted-foreground/60">
                      L'exercice sera ajouté à ta bibliothèque
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun exercice dans cette catégorie.</p>
                )}
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── MuscleChip ───────────────────────────────────────────────────────────────

function MuscleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 text-xs px-2.5 py-1 rounded-full border transition-all whitespace-nowrap",
        active
          ? "bg-primary text-primary-foreground border-primary font-medium"
          : "border-border/60 text-muted-foreground hover:border-foreground/40 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
