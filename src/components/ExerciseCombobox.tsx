import { useState, useEffect, useMemo, type ReactNode } from "react";
import { Check, ChevronsUpDown, Plus, Clock, VideoOff, SlidersHorizontal, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MuscleBodyFilter } from "@/components/MuscleBodySelector";
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
  category?: string | null;
  equipment?: string | null;
  load_coefficient?: number | null;
}

// Options de filtre (alignées sur la bibliothèque)
const EQUIP_FILTERS = ["Barre", "Haltères", "Kettlebell", "Poids du corps", "Machine", "Barre à traction", "Élastique", "Ergo / Cardio"];
const CAT_FILTERS: { value: string; label: string }[] = [
  { value: "cardio", label: "🏃 Cardio" },
  { value: "mobilité-souplesse", label: "🧘 Mobilité" },
  { value: "renfo", label: "🏋️ Renfo" },
  { value: "explosivité-vitesse", label: "⚡ Explosivité" },
];
const COEF_FILTERS = [0.3, 0.6, 1.0, 1.2, 1.5, 2.0];

// Regroupement des muscles par région du corps (pastille de couleur + sous-titre)
const MUSCLE_REGIONS: { title: string; color: string; muscles: string[] }[] = [
  { title: "Haut du corps", color: "#f2d98a", muscles: ["PEC", "DOS", "DELTOÏDES", "TRAPÈZES", "BICEPS", "TRICEPS", "AVANT-BRAS"] },
  { title: "Tronc", color: "#e8974a", muscles: ["ABDOS", "OBLIQUES", "LOMBAIRES"] },
  { title: "Bas du corps", color: "#5aa9e6", muscles: ["FESSIERS", "PETITS ET MOYENS FESSIERS", "QUADRICEPS", "ISCHIOS", "MOLLETS", "ADDUCTEURS", "FLÉCHISSEURS DE HANCHES"] },
];
const regionOf = (m: string) => MUSCLE_REGIONS.find((r) => r.muscles.includes(m));

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
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [recentNames, setRecentNames] = useState<string[]>([]);
  // Filtres multi-critères
  const [muscleView, setMuscleView] = useState<"body" | "list">("body");
  const [filtersOpen, setFiltersOpen] = useState(false); // replié par défaut (surtout mobile)
  const [fMuscles, setFMuscles] = useState<string[]>([]);
  const [fEquip, setFEquip] = useState<string[]>([]);
  const [fCats, setFCats] = useState<string[]>([]);
  const [fCoef, setFCoef] = useState<number[]>([]);
  const activeFilterCount = fMuscles.length + fEquip.length + fCats.length + fCoef.length;

  const clearFilters = () => { setFMuscles([]); setFEquip([]); setFCats([]); setFCoef([]); };
  const toggleIn = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  // Auto-open on keyboard nav
  useEffect(() => {
    if (autoOpen && !disabled) { setOpen(true); onAutoOpenHandled?.(); }
  }, [autoOpen, disabled, onAutoOpenHandled]);

  // Reset state when popover opens
  useEffect(() => {
    if (open) { setRecentNames(getRecent()); setSearch(""); setFiltersOpen(false); }
  }, [open]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const muscles = useMemo(
    () => Array.from(new Set(exercises.flatMap((e) => [e.muscle_principal, ...(e.muscles_second || [])]).filter(Boolean))).sort() as string[],
    [exercises],
  );

  const displayedExercises = useMemo(() => {
    let list = exercises;
    // Muscles : l'exo doit contenir TOUS les muscles sélectionnés (principal ou secondaire)
    if (fMuscles.length) {
      list = list.filter((e) => {
        const set = new Set([e.muscle_principal, ...(e.muscles_second || [])].filter(Boolean) as string[]);
        return fMuscles.every((m) => set.has(m));
      });
    }
    // Matériel : au moins un des matériels sélectionnés
    if (fEquip.length) {
      list = list.filter((e) => {
        const eq = (e.equipment || "").toLowerCase();
        return fEquip.some((m) => eq.includes(m.toLowerCase()));
      });
    }
    // Type : dans les catégories sélectionnées
    if (fCats.length) list = list.filter((e) => e.category && fCats.includes(e.category));
    // Intensité (coefficient)
    if (fCoef.length) list = list.filter((e) => fCoef.some((c) => Math.abs((e.load_coefficient ?? 1) - c) < 0.05));
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
  }, [exercises, fMuscles, fEquip, fCats, fCoef, search]);

  const recentExercises = useMemo(
    () => recentNames.map((n) => exercises.find((e) => e.name === n)).filter(Boolean) as LibraryExercise[],
    [recentNames, exercises],
  );

  const showRecents = !search.trim() && activeFilterCount === 0 && recentExercises.length > 0;
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
    <>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span className="truncate">{value || "Sélectionner un exercice..."}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 gap-0 max-w-[95vw] sm:max-w-[1100px] top-[6%] translate-y-0">
          <Command shouldFilter={false}>
          {/* Search */}
          <CommandInput
            placeholder="Rechercher un exercice..."
            value={search}
            onValueChange={setSearch}
          />

          <div className="sm:flex sm:items-stretch">
          {/* Filtres — tout visible, sans repli */}
          <div className={cn("border-b sm:border-b-0 sm:border-r sm:shrink-0 sm:max-h-[72vh] sm:overflow-y-auto px-2 py-2 space-y-2", muscleView === "body" ? "sm:w-[620px]" : "sm:w-[360px]")}>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setFiltersOpen((v) => !v)} className="flex items-center gap-1 sm:pointer-events-none">
                <SlidersHorizontal className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Filtres{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform sm:hidden", filtersOpen && "rotate-180")} />
              </button>
              <span className="text-[11px] text-muted-foreground">· {displayedExercises.length} exo</span>
              {activeFilterCount > 0 && (
                <button type="button" onClick={clearFilters} className="ml-auto text-[11px] text-primary underline underline-offset-2">
                  Effacer
                </button>
              )}
            </div>

            <div className={cn("space-y-2", !filtersOpen && "hidden sm:block")}>
            {/* Bascule Silhouette/Liste — desktop uniquement */}
            <div className="hidden sm:flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Muscles</p>
              <div className="ml-auto flex rounded-md border p-0.5">
                <button type="button" onClick={() => setMuscleView("body")}
                  className={cn("rounded px-2 py-0.5 text-[10px] font-medium", muscleView === "body" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                  Silhouette
                </button>
                <button type="button" onClick={() => setMuscleView("list")}
                  className={cn("rounded px-2 py-0.5 text-[10px] font-medium", muscleView === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                  Liste
                </button>
              </div>
            </div>

            {/* Silhouette : desktop seulement, quand mode "body" */}
            {muscleView === "body" && (
              <div className="hidden sm:block">
                <MuscleBodyFilter selected={fMuscles} onToggle={(m) => toggleIn(fMuscles, m, setFMuscles)} />
              </div>
            )}

            {/* Liste : toujours sur mobile, sur desktop seulement en mode "list" */}
            <div className={cn("space-y-2", muscleView === "body" && "sm:hidden")}>
              {MUSCLE_REGIONS.map((region) => {
                const items = region.muscles.filter((m) => muscles.includes(m));
                if (!items.length) return null;
                return (
                  <FilterRow key={region.title} title={region.title} dot={region.color}>
                    {items.map((m) => (
                      <MuscleChip key={m} label={m} dotColor={region.color} active={fMuscles.includes(m)} onClick={() => toggleIn(fMuscles, m, setFMuscles)} />
                    ))}
                  </FilterRow>
                );
              })}
              {(() => {
                const others = muscles.filter((m) => !regionOf(m));
                if (!others.length) return null;
                return (
                  <FilterRow title="Autre">
                    {others.map((m) => (
                      <MuscleChip key={m} label={m} active={fMuscles.includes(m)} onClick={() => toggleIn(fMuscles, m, setFMuscles)} />
                    ))}
                  </FilterRow>
                );
              })()}
            </div>
            <FilterRow title="Matériel">
              {EQUIP_FILTERS.map((m) => (
                <MuscleChip key={m} label={m} active={fEquip.includes(m)} onClick={() => toggleIn(fEquip, m, setFEquip)} />
              ))}
            </FilterRow>
            <FilterRow title="Type">
              {CAT_FILTERS.map((c) => (
                <MuscleChip key={c.value} label={c.label} active={fCats.includes(c.value)} onClick={() => toggleIn(fCats, c.value, setFCats)} />
              ))}
            </FilterRow>
            <FilterRow title="Intensité (coef.)">
              {COEF_FILTERS.map((c) => (
                <MuscleChip
                  key={c}
                  label={`×${c}`}
                  active={fCoef.includes(c)}
                  onClick={() => setFCoef(fCoef.includes(c) ? fCoef.filter((x) => x !== c) : [...fCoef, c])}
                />
              ))}
            </FilterRow>
            </div>
          </div>

          <CommandList className="max-h-[280px] sm:max-h-[72vh] sm:flex-1">
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
          </div>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── MuscleChip ───────────────────────────────────────────────────────────────

function FilterRow({ title, children, dot }: { title: string; children: ReactNode; dot?: string }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {dot && <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />}
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function MuscleChip({ label, active, onClick, dotColor }: { label: string; active: boolean; onClick: () => void; dotColor?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all whitespace-nowrap",
        active
          ? "bg-primary text-primary-foreground border-primary font-medium"
          : "border-border/60 text-muted-foreground hover:border-foreground/40 hover:text-foreground",
      )}
    >
      {dotColor && !active && <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: dotColor }} />}
      {label}
    </button>
  );
}
