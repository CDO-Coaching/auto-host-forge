import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Search, Dumbbell, ExternalLink, Trash2,
  ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, Youtube,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { PENDING_COMPLETION_KEY } from "@/components/ExerciseCombobox";

// ─── Types & constants ────────────────────────────────────────────────────────

interface Exercise {
  id: string;
  name: string;
  category: string | null;
  muscle_principal: string | null;
  muscles_second: string[] | null;
  video_url: string | null;
  description: string | null;
  equipment: string | null;
  unilateral: boolean | null;
  load_coefficient: number | null;
  created_at: string;
}

const MUSCLE_GROUPS = [
  'TRICEPS','BICEPS','AVANT-BRAS','DELTOÏDES','TRAPÈZES','DOS',
  'LOMBAIRES','PEC','ABDOS','OBLIQUES','FESSIERS','QUADRICEPS',
  'ISCHIOS','MOLLETS','HIP','HALTÉRO','CORE',
] as const;

const CATEGORIES = ['cardio','mobilité-souplesse','renfo','explosivité-vitesse'] as const;

const toTitleCase = (str: string) =>
  str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// ─── Completeness helpers ─────────────────────────────────────────────────────

interface MissingField { key: string; label: string; required: boolean }

function getMissingFields(ex: Exercise): MissingField[] {
  const missing: MissingField[] = [];
  if (!ex.muscle_principal) missing.push({ key: "muscle_principal", label: "Muscle principal", required: true });
  if (!ex.category)         missing.push({ key: "category",         label: "Catégorie",        required: false });
  if (!ex.video_url)        missing.push({ key: "video_url",        label: "Vidéo YouTube",    required: false });
  return missing;
}

function CompletenessIndicator({ exercise, size = "sm" }: { exercise: Exercise; size?: "sm" | "lg" }) {
  const missing = getMissingFields(exercise);
  if (missing.length === 0)
    return <CheckCircle2 className={cn("text-emerald-500 shrink-0", size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} />;
  const hasRequired = missing.some((f) => f.required);
  return (
    <AlertTriangle className={cn(
      "shrink-0",
      size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
      hasRequired ? "text-destructive" : "text-amber-500",
    )} />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BibliothequeExercices() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<string>("all");
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [loading, setLoading] = useState(true);

  // Add dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newExercise, setNewExercise] = useState({
    name: "", category: "", muscle_principal: "", muscles_second: [] as string[],
    video_url: "", description: "", equipment: "", unilateral: false, load_coefficient: 1.0,
  });

  // Edit sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<Exercise | null>(null);

  const pendingHandled = useRef(false);

  useEffect(() => { loadExercises(); }, []);
  useEffect(() => { filterExercises(); }, [exercises, searchTerm, selectedMuscle, showIncomplete]);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadExercises = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("exercise_library").select("*").order("created_at", { ascending: false });
    if (error) { toast.error("Erreur lors du chargement"); console.error(error); }
    else {
      const list = data || [];
      setExercises(list);
      if (!pendingHandled.current) {
        try {
          const pending: string[] = JSON.parse(localStorage.getItem(PENDING_COMPLETION_KEY) ?? "[]");
          if (pending.length > 0) {
            const target = list.find((ex) => ex.id === pending[0]);
            if (target) {
              pendingHandled.current = true;
              localStorage.setItem(PENDING_COMPLETION_KEY, JSON.stringify(pending.slice(1)));
              setTimeout(() => openSheet(target, list), 300);
            }
          }
        } catch {}
      }
    }
    setLoading(false);
  };

  const filterExercises = () => {
    let filtered = exercises;
    if (searchTerm) filtered = filtered.filter((ex) =>
      ex.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ex.muscle_principal?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (selectedMuscle !== "all") filtered = filtered.filter((ex) => ex.muscle_principal === selectedMuscle);
    if (showIncomplete) filtered = filtered.filter((ex) => getMissingFields(ex).length > 0);
    filtered = [...filtered].sort((a, b) => {
      // Incomplete exercises first
      const aMissing = getMissingFields(a).length;
      const bMissing = getMissingFields(b).length;
      if (aMissing !== bMissing) return bMissing - aMissing;
      return a.name.localeCompare(b.name);
    });
    setFilteredExercises(filtered);
  };

  // ── Sheet navigation ──────────────────────────────────────────────────────────

  const openSheet = (exercise: Exercise, list?: Exercise[]) => {
    const source = list ?? filteredExercises;
    const idx = source.findIndex((e) => e.id === exercise.id);
    setEditingExercise({ ...exercise });
    setSheetIndex(idx >= 0 ? idx : 0);
    setSheetOpen(true);
  };

  const navigateSheet = (dir: -1 | 1) => {
    const newIdx = sheetIndex + dir;
    if (newIdx < 0 || newIdx >= filteredExercises.length) return;
    setEditingExercise({ ...filteredExercises[newIdx] });
    setSheetIndex(newIdx);
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────────

  const handleAddExercise = async () => {
    if (!newExercise.name) { toast.error("Le nom est obligatoire"); return; }
    if (!newExercise.muscle_principal) { toast.error("Le muscle principal est obligatoire"); return; }
    const { error } = await supabase.from("exercise_library").insert([{
      ...newExercise,
      muscles_second: newExercise.muscles_second.length > 0 ? newExercise.muscles_second : null,
    }]);
    if (error) { toast.error("Erreur lors de l'ajout"); }
    else {
      toast.success("Exercice ajouté");
      setDialogOpen(false);
      setNewExercise({ name:"", category:"", muscle_principal:"", muscles_second:[], video_url:"", description:"", equipment:"", unilateral:false, load_coefficient:1.0 });
      loadExercises();
    }
  };

  const handleEditExercise = async () => {
    if (!editingExercise) return;
    if (!editingExercise.name) { toast.error("Le nom est obligatoire"); return; }
    if (!editingExercise.muscle_principal) { toast.error("Le muscle principal est obligatoire"); return; }
    const { error } = await supabase.from("exercise_library").update({
      name: editingExercise.name,
      category: editingExercise.category,
      muscle_principal: editingExercise.muscle_principal,
      muscles_second: editingExercise.muscles_second?.length ? editingExercise.muscles_second : null,
      video_url: editingExercise.video_url,
      description: editingExercise.description,
      equipment: editingExercise.equipment,
      unilateral: editingExercise.unilateral,
      load_coefficient: editingExercise.load_coefficient,
    }).eq("id", editingExercise.id);
    if (error) { toast.error("Erreur lors de la modification"); }
    else {
      toast.success("Exercice mis à jour");
      setExercises((prev) => prev.map((e) => e.id === editingExercise.id ? { ...e, ...editingExercise } : e));
      // Stay in sheet, update filtered list too
      setFilteredExercises((prev) => prev.map((e) => e.id === editingExercise.id ? { ...e, ...editingExercise } : e));
    }
  };

  const handleDeleteExercise = async () => {
    if (!deleteConfirm) return;
    const { error } = await supabase.from("exercise_library").delete().eq("id", deleteConfirm.id);
    if (error) { toast.error("Erreur lors de la suppression"); }
    else {
      toast.success(`"${deleteConfirm.name}" supprimé`);
      setDeleteConfirm(null);
      if (editingExercise?.id === deleteConfirm.id) setSheetOpen(false);
      loadExercises();
    }
  };

  const toggleSecondaryMuscle = (muscle: string, isEditing = false) => {
    if (isEditing && editingExercise) {
      const current = editingExercise.muscles_second || [];
      setEditingExercise({ ...editingExercise, muscles_second: current.includes(muscle) ? current.filter((m) => m !== muscle) : [...current, muscle] });
    } else {
      const current = newExercise.muscles_second;
      setNewExercise({ ...newExercise, muscles_second: current.includes(muscle) ? current.filter((m) => m !== muscle) : [...current, muscle] });
    }
  };

  const muscles = Array.from(new Set(exercises.map((ex) => ex.muscle_principal).filter(Boolean))).sort() as string[];
  const incompleteCount = exercises.filter((ex) => getMissingFields(ex).length > 0).length;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-0">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Bibliothèque d'exercices</h1>
          {incompleteCount > 0 && (
            <p className="text-sm text-amber-500 mt-0.5 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              {incompleteCount} exercice{incompleteCount > 1 ? "s" : ""} avec des infos manquantes
            </p>
          )}
        </div>

        {/* Add dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" />Ajouter un exercice</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nouvel exercice</DialogTitle></DialogHeader>
            <ExerciseForm
              data={newExercise}
              onChange={setNewExercise}
              onToggleSecondary={(m) => toggleSecondaryMuscle(m, false)}
              onSubmit={handleAddExercise}
              submitLabel="Ajouter l'exercice"
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader><CardTitle>Rechercher et filtrer</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher un exercice..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={selectedMuscle === "all" && !showIncomplete ? "default" : "outline"} className="cursor-pointer" onClick={() => { setSelectedMuscle("all"); setShowIncomplete(false); }}>Tous</Badge>
            {incompleteCount > 0 && (
              <Badge
                variant={showIncomplete ? "default" : "outline"}
                className={cn("cursor-pointer gap-1", showIncomplete ? "bg-amber-500 border-amber-500 hover:bg-amber-600" : "border-amber-500 text-amber-600 hover:bg-amber-50")}
                onClick={() => { setShowIncomplete((v) => !v); setSelectedMuscle("all"); }}
              >
                <AlertTriangle className="h-3 w-3" />
                Incomplets ({incompleteCount})
              </Badge>
            )}
            {muscles.map((muscle) => (
              <Badge key={muscle} variant={selectedMuscle === muscle ? "default" : "outline"} className="cursor-pointer" onClick={() => { setSelectedMuscle(muscle); setShowIncomplete(false); }}>
                {muscle}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="text-center py-12"><p className="text-muted-foreground text-sm">Chargement…</p></div>
      ) : filteredExercises.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Dumbbell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">
              {exercises.length === 0 ? "Aucun exercice. Commence par en ajouter un !" : "Aucun exercice ne correspond à ta recherche."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="block sm:hidden space-y-2">
            {filteredExercises.map((exercise) => {
              const missing = getMissingFields(exercise);
              return (
                <Card
                  key={exercise.id}
                  className={cn("p-3 cursor-pointer hover:bg-muted/30 transition-colors", missing.some((f) => f.required) ? "border-destructive/40" : missing.length > 0 ? "border-amber-500/40" : "")}
                  onClick={() => openSheet(exercise)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <CompletenessIndicator exercise={exercise} />
                        <p className="font-semibold text-sm truncate">{toTitleCase(exercise.name)}</p>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {exercise.muscle_principal && <Badge variant="outline" className="text-xs">{exercise.muscle_principal}</Badge>}
                        {exercise.category && <Badge variant="secondary" className="text-xs capitalize">{exercise.category}</Badge>}
                        {missing.length > 0 && <Badge variant="outline" className="text-xs text-amber-500 border-amber-400">{missing.length} manquant{missing.length > 1 ? "s" : ""}</Badge>}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(exercise); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Desktop table */}
          <Card className="hidden sm:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-6" />
                    <TableHead>Nom</TableHead>
                    <TableHead>Muscle principal</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Équipement</TableHead>
                    <TableHead className="w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExercises.map((exercise) => {
                    const missing = getMissingFields(exercise);
                    return (
                      <TableRow
                        key={exercise.id}
                        className={cn("cursor-pointer", missing.some((f) => f.required) ? "bg-destructive/5" : missing.length > 0 ? "bg-amber-500/5" : "")}
                        onClick={() => openSheet(exercise)}
                      >
                        <TableCell className="py-2 pr-0">
                          <CompletenessIndicator exercise={exercise} />
                        </TableCell>
                        <TableCell className="font-medium py-2">
                          {toTitleCase(exercise.name)}
                          {missing.length > 0 && (
                            <span className="ml-2 text-[10px] text-amber-500">{missing.map((f) => f.label).join(", ")}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-2">{exercise.muscle_principal || <span className="text-destructive text-xs">Manquant</span>}</TableCell>
                        <TableCell className="py-2 capitalize">{exercise.category || <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                        <TableCell className="py-2">{exercise.equipment || <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {exercise.video_url && (
                              <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 text-red-500">
                                <a href={exercise.video_url} target="_blank" rel="noopener noreferrer"><Youtube className="h-4 w-4" /></a>
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteConfirm(exercise)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Edit Sheet ─────────────────────────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:w-[520px] overflow-y-auto flex flex-col p-0 gap-0">
          {editingExercise && (() => {
            const missing = getMissingFields(editingExercise);
            return (
              <>
                {/* Sheet header with navigation */}
                <SheetHeader className="px-5 py-4 border-b border-border/40 shrink-0">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={sheetIndex <= 0} onClick={() => navigateSheet(-1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground tabular-nums">{sheetIndex + 1} / {filteredExercises.length}</span>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={sheetIndex >= filteredExercises.length - 1} onClick={() => navigateSheet(1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <SheetTitle className="text-base font-bold truncate">{toTitleCase(editingExercise.name)}</SheetTitle>

                  {/* Completeness summary */}
                  {missing.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {missing.map((f) => (
                        <span key={f.key} className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium", f.required ? "border-destructive/50 text-destructive bg-destructive/5" : "border-amber-400/50 text-amber-600 bg-amber-50/10")}>
                          {f.required ? "⚠ " : "· "}{f.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-emerald-500 flex items-center gap-1 mt-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Fiche complète
                    </p>
                  )}
                </SheetHeader>

                {/* Form */}
                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nom</Label>
                    <Input value={editingExercise.name} onChange={(e) => setEditingExercise({ ...editingExercise, name: e.target.value })} />
                  </div>

                  {/* Muscle principal */}
                  <div className="space-y-1.5">
                    <Label className={cn("text-xs font-semibold uppercase tracking-wide", !editingExercise.muscle_principal ? "text-destructive" : "text-muted-foreground")}>
                      Muscle principal {!editingExercise.muscle_principal && "⚠ manquant"}
                    </Label>
                    <div className={cn("flex flex-wrap gap-1.5 p-3 rounded-lg border", !editingExercise.muscle_principal && "border-destructive/50 bg-destructive/5")}>
                      {MUSCLE_GROUPS.map((m) => (
                        <button key={m} type="button" onClick={() => setEditingExercise({ ...editingExercise, muscle_principal: editingExercise.muscle_principal === m ? null : m })}
                          className={cn("text-xs px-2.5 py-1 rounded-full border transition-all", editingExercise.muscle_principal === m ? "bg-primary text-primary-foreground border-primary font-medium" : "border-border/60 text-muted-foreground hover:border-foreground/40 hover:text-foreground")}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Muscles secondaires */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Muscles secondaires</Label>
                    <div className="flex flex-wrap gap-1.5 p-3 rounded-lg border border-border/40">
                      {MUSCLE_GROUPS.filter((m) => m !== editingExercise.muscle_principal).map((m) => (
                        <button key={m} type="button" onClick={() => toggleSecondaryMuscle(m, true)}
                          className={cn("text-xs px-2.5 py-1 rounded-full border transition-all", (editingExercise.muscles_second || []).includes(m) ? "bg-secondary text-foreground border-border font-medium" : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground")}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Catégorie */}
                  <div className="space-y-1.5">
                    <Label className={cn("text-xs font-semibold uppercase tracking-wide", !editingExercise.category ? "text-amber-500" : "text-muted-foreground")}>
                      Catégorie {!editingExercise.category && "· manquante"}
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORIES.map((cat) => (
                        <button key={cat} type="button" onClick={() => setEditingExercise({ ...editingExercise, category: editingExercise.category === cat ? null : cat })}
                          className={cn("text-xs px-3 py-1.5 rounded-lg border capitalize transition-all", editingExercise.category === cat ? "bg-primary text-primary-foreground border-primary font-medium" : "border-border/60 text-muted-foreground hover:border-foreground/40 hover:text-foreground")}>
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Vidéo */}
                  <div className="space-y-1.5">
                    <Label className={cn("text-xs font-semibold uppercase tracking-wide flex items-center gap-1", !editingExercise.video_url ? "text-amber-500" : "text-muted-foreground")}>
                      <Youtube className="h-3.5 w-3.5" /> Lien YouTube {!editingExercise.video_url && "· manquant"}
                    </Label>
                    <Input
                      value={editingExercise.video_url || ""}
                      onChange={(e) => setEditingExercise({ ...editingExercise, video_url: e.target.value })}
                      placeholder="https://youtube.com/..."
                      className={cn(!editingExercise.video_url && "border-amber-400/60 focus-visible:ring-amber-400/30")}
                    />
                    {editingExercise.video_url && (
                      <a href={editingExercise.video_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> Voir la vidéo
                      </a>
                    )}
                  </div>

                  {/* Équipement */}
                  <div className="space-y-1.5">
                    <Label className={cn("text-xs font-semibold uppercase tracking-wide", !editingExercise.equipment ? "text-amber-500" : "text-muted-foreground")}>
                      Équipement {!editingExercise.equipment && "· manquant"}
                    </Label>
                    <Input
                      value={editingExercise.equipment || ""}
                      onChange={(e) => setEditingExercise({ ...editingExercise, equipment: e.target.value })}
                      placeholder="Ex : Barre, Haltères, Poids du corps…"
                      className={cn(!editingExercise.equipment && "border-amber-400/60 focus-visible:ring-amber-400/30")}
                    />
                  </div>

                  {/* Unilatéral */}
                  <div className="flex items-center gap-2">
                    <Checkbox id="edit-unilateral" checked={editingExercise.unilateral || false}
                      onCheckedChange={(c) => setEditingExercise({ ...editingExercise, unilateral: c as boolean })} />
                    <label htmlFor="edit-unilateral" className="text-sm cursor-pointer">Exercice unilatéral</label>
                  </div>

                  {/* Coefficient */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coefficient de charge</Label>
                    <p className="text-xs text-muted-foreground">Squat/Deadlift : 1.5–2.0 · Press/Bench : 1.2 · Isolation : 0.5–0.7</p>
                    <Input type="number" step="0.1" min="0.1" max="3" value={editingExercise.load_coefficient || 1.0}
                      onChange={(e) => setEditingExercise({ ...editingExercise, load_coefficient: parseFloat(e.target.value) || 1.0 })} />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label className={cn("text-xs font-semibold uppercase tracking-wide", !editingExercise.description ? "text-amber-500" : "text-muted-foreground")}>
                      Description {!editingExercise.description && "· manquante"}
                    </Label>
                    <Textarea
                      value={editingExercise.description || ""}
                      onChange={(e) => setEditingExercise({ ...editingExercise, description: e.target.value })}
                      placeholder="Points techniques, variantes, erreurs courantes…"
                      rows={4}
                      className={cn(!editingExercise.description && "border-amber-400/60 focus-visible:ring-amber-400/30")}
                    />
                  </div>
                </div>

                {/* Footer actions */}
                <div className="px-5 py-4 border-t border-border/40 bg-card/50 flex gap-2 shrink-0">
                  <Button variant="destructive" size="sm" className="gap-1.5"
                    onClick={() => setDeleteConfirm(filteredExercises[sheetIndex])}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button className="flex-1" onClick={handleEditExercise}>Enregistrer</Button>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Supprimer l'exercice ?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">"{deleteConfirm?.name}"</span> sera définitivement supprimé. Cette action est irréversible.
          </p>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDeleteExercise}><Trash2 className="h-4 w-4 mr-2" />Supprimer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── ExerciseForm (used for Add dialog only) ──────────────────────────────────

function ExerciseForm({ data, onChange, onToggleSecondary, onSubmit, submitLabel }: {
  data: any; onChange: (d: any) => void;
  onToggleSecondary: (m: string) => void;
  onSubmit: () => void; submitLabel: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Nom *</Label>
        <Input value={data.name} onChange={(e) => onChange({ ...data, name: e.target.value })} placeholder="Ex : Squat" />
      </div>
      <div>
        <Label>Muscle principal *</Label>
        <div className="flex flex-wrap gap-1.5 mt-2 p-3 border rounded-lg">
          {MUSCLE_GROUPS.map((m) => (
            <button key={m} type="button" onClick={() => onChange({ ...data, muscle_principal: data.muscle_principal === m ? "" : m })}
              className={cn("text-xs px-2.5 py-1 rounded-full border transition-all", data.muscle_principal === m ? "bg-primary text-primary-foreground border-primary font-medium" : "border-border/60 text-muted-foreground hover:border-foreground/40")}>
              {m}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Muscles secondaires</Label>
        <div className="flex flex-wrap gap-1.5 mt-2 p-3 border rounded-lg">
          {MUSCLE_GROUPS.filter((m) => m !== data.muscle_principal).map((m) => (
            <button key={m} type="button" onClick={() => onToggleSecondary(m)}
              className={cn("text-xs px-2.5 py-1 rounded-full border transition-all", data.muscles_second.includes(m) ? "bg-secondary text-foreground border-border font-medium" : "border-border/40 text-muted-foreground hover:border-border")}>
              {m}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Catégorie</Label>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {CATEGORIES.map((cat) => (
            <button key={cat} type="button" onClick={() => onChange({ ...data, category: data.category === cat ? "" : cat })}
              className={cn("text-xs px-3 py-1.5 rounded-lg border capitalize transition-all", data.category === cat ? "bg-primary text-primary-foreground border-primary font-medium" : "border-border/60 text-muted-foreground hover:border-foreground/40")}>
              {cat}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Lien YouTube</Label>
        <Input value={data.video_url} onChange={(e) => onChange({ ...data, video_url: e.target.value })} placeholder="https://…" />
      </div>
      <div>
        <Label>Équipement</Label>
        <Input value={data.equipment} onChange={(e) => onChange({ ...data, equipment: e.target.value })} placeholder="Ex : Barre, Haltères…" />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="add-unilateral" checked={data.unilateral} onCheckedChange={(c) => onChange({ ...data, unilateral: c as boolean })} />
        <label htmlFor="add-unilateral" className="text-sm cursor-pointer">Exercice unilatéral</label>
      </div>
      <div>
        <Label>Description</Label>
        <Textarea value={data.description} onChange={(e) => onChange({ ...data, description: e.target.value })} placeholder="Points techniques, variantes…" rows={3} />
      </div>
      <Button onClick={onSubmit} className="w-full">{submitLabel}</Button>
    </div>
  );
}
