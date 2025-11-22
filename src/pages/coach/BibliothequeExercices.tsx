import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Dumbbell, ExternalLink, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface Exercise {
  id: string;
  name: string;
  category: string | null;
  muscle_principal: string | null;
  muscles_second: string[] | null;
  video_url: string | null;
  description: string | null;
  equipment: string | null;
  created_at: string;
}

const MUSCLE_GROUPS = [
  'TRICEPS',
  'BICEPS',
  'AVANT-BRAS',
  'DELTOÏDES',
  'TRAPÈZES',
  'DOS',
  'LOMBAIRES',
  'PEC',
  'ABDOS',
  'OBLIQUES',
  'FESSIERS',
  'QUADRICEPS',
  'ISCHIOS',
  'MOLLETS',
  'HIP',
  'HALTÉRO',
  'CORE'
] as const;

const CATEGORIES = [
  'cardio',
  'mobilité-souplesse',
  'renfo',
  'explosivité-vitesse'
] as const;

export default function BibliothequeExercices() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [newExercise, setNewExercise] = useState({
    name: "",
    category: "",
    muscle_principal: "",
    muscles_second: [] as string[],
    video_url: "",
    description: "",
    equipment: "",
  });

  useEffect(() => {
    loadExercises();
  }, []);

  useEffect(() => {
    filterExercises();
  }, [exercises, searchTerm, selectedMuscle]);

  const loadExercises = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("exercise_library")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erreur lors du chargement des exercices");
      console.error(error);
    } else {
      setExercises(data || []);
    }
    setLoading(false);
  };

  const filterExercises = () => {
    let filtered = exercises;

    if (searchTerm) {
      filtered = filtered.filter(
        (ex) =>
          ex.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ex.muscle_principal?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ex.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedMuscle !== "all") {
      filtered = filtered.filter((ex) => ex.muscle_principal === selectedMuscle);
    }

    // Tri alphabétique par nom
    filtered = filtered.sort((a, b) => a.name.localeCompare(b.name));

    setFilteredExercises(filtered);
  };

  const handleAddExercise = async () => {
    if (!newExercise.name) {
      toast.error("Le nom de l'exercice est obligatoire");
      return;
    }

    if (!newExercise.muscle_principal) {
      toast.error("Le muscle principal est obligatoire");
      return;
    }

    const { error } = await supabase.from("exercise_library").insert([{
      ...newExercise,
      muscles_second: newExercise.muscles_second.length > 0 ? newExercise.muscles_second : null
    }]);

    if (error) {
      toast.error("Erreur lors de l'ajout de l'exercice");
      console.error(error);
    } else {
      toast.success("Exercice ajouté avec succès");
      setDialogOpen(false);
      setNewExercise({
        name: "",
        category: "",
        muscle_principal: "",
        muscles_second: [],
        video_url: "",
        description: "",
        equipment: "",
      });
      loadExercises();
    }
  };

  const handleEditExercise = async () => {
    if (!editingExercise) return;

    if (!editingExercise.name) {
      toast.error("Le nom de l'exercice est obligatoire");
      return;
    }

    if (!editingExercise.muscle_principal) {
      toast.error("Le muscle principal est obligatoire");
      return;
    }

    const { error } = await supabase
      .from("exercise_library")
      .update({
        name: editingExercise.name,
        category: editingExercise.category,
        muscle_principal: editingExercise.muscle_principal,
        muscles_second: editingExercise.muscles_second && editingExercise.muscles_second.length > 0 
          ? editingExercise.muscles_second 
          : null,
        video_url: editingExercise.video_url,
        description: editingExercise.description,
        equipment: editingExercise.equipment,
      })
      .eq("id", editingExercise.id);

    if (error) {
      toast.error("Erreur lors de la modification de l'exercice");
      console.error(error);
    } else {
      toast.success("Exercice modifié avec succès");
      setEditDialogOpen(false);
      setEditingExercise(null);
      loadExercises();
    }
  };

  const openEditDialog = (exercise: Exercise) => {
    setEditingExercise({...exercise});
    setEditDialogOpen(true);
  };

  const toggleSecondaryMuscle = (muscle: string, isEditing: boolean = false) => {
    if (isEditing && editingExercise) {
      const current = editingExercise.muscles_second || [];
      const updated = current.includes(muscle)
        ? current.filter(m => m !== muscle)
        : [...current, muscle];
      setEditingExercise({ ...editingExercise, muscles_second: updated });
    } else {
      const current = newExercise.muscles_second || [];
      const updated = current.includes(muscle)
        ? current.filter(m => m !== muscle)
        : [...current, muscle];
      setNewExercise({ ...newExercise, muscles_second: updated });
    }
  };

  const muscles = Array.from(new Set(exercises.map((ex) => ex.muscle_principal).filter(Boolean))).sort();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Bibliothèque d'exercices</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un exercice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nouvel exercice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nom de l'exercice *</Label>
                <Input
                  id="name"
                  value={newExercise.name}
                  onChange={(e) => setNewExercise({ ...newExercise, name: e.target.value })}
                  placeholder="Ex: Squat"
                />
              </div>
              <div>
                <Label>Catégories</Label>
                <div className="grid grid-cols-2 gap-3 mt-2 p-3 border rounded-md">
                  {CATEGORIES.map((category) => (
                    <div key={category} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category}`}
                        checked={newExercise.category === category}
                        onCheckedChange={(checked) => {
                          setNewExercise({ 
                            ...newExercise, 
                            category: checked ? category : "" 
                          });
                        }}
                      />
                      <label
                        htmlFor={`category-${category}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 cursor-pointer capitalize"
                      >
                        {category}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="muscle_principal">Muscle principal *</Label>
                <Select
                  value={newExercise.muscle_principal}
                  onValueChange={(value) => setNewExercise({ ...newExercise, muscle_principal: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un muscle" />
                  </SelectTrigger>
                  <SelectContent>
                    {MUSCLE_GROUPS.map((muscle) => (
                      <SelectItem key={muscle} value={muscle}>
                        {muscle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Muscles secondaires</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2 max-h-48 overflow-y-auto p-3 border rounded-md">
                  {MUSCLE_GROUPS.map((muscle) => (
                    <div key={muscle} className="flex items-center space-x-2">
                      <Checkbox
                        id={`muscle-${muscle}`}
                        checked={newExercise.muscles_second.includes(muscle)}
                        onCheckedChange={() => toggleSecondaryMuscle(muscle, false)}
                        disabled={newExercise.muscle_principal === muscle}
                      />
                      <label
                        htmlFor={`muscle-${muscle}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 cursor-pointer"
                      >
                        {muscle}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="equipment">Équipement</Label>
                <Input
                  id="equipment"
                  value={newExercise.equipment}
                  onChange={(e) => setNewExercise({ ...newExercise, equipment: e.target.value })}
                  placeholder="Ex: Barre, Poids du corps"
                />
              </div>
              <div>
                <Label htmlFor="video_url">URL de la vidéo</Label>
                <Input
                  id="video_url"
                  value={newExercise.video_url}
                  onChange={(e) => setNewExercise({ ...newExercise, video_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newExercise.description}
                  onChange={(e) => setNewExercise({ ...newExercise, description: e.target.value })}
                  placeholder="Décris l'exercice, les points techniques..."
                  rows={4}
                />
              </div>
              <Button onClick={handleAddExercise} className="w-full">
                Ajouter l'exercice
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rechercher et filtrer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un exercice..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <div>
            <p className="text-sm font-medium mb-3">Filtrer par muscle :</p>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={selectedMuscle === "all" ? "default" : "outline"}
                className="cursor-pointer hover:bg-primary/10"
                onClick={() => setSelectedMuscle("all")}
              >
                Tous
              </Badge>
              {muscles.map((muscle) => (
                <Badge
                  key={muscle}
                  variant={selectedMuscle === muscle ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/10"
                  onClick={() => setSelectedMuscle(muscle!)}
                >
                  {muscle}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      ) : filteredExercises.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Dumbbell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {exercises.length === 0
                ? "Aucun exercice dans ta bibliothèque. Commence par en ajouter un !"
                : "Aucun exercice ne correspond à ta recherche."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Muscle Principal</TableHead>
                  <TableHead>Muscles Secondaires</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Lien vidéo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExercises.map((exercise) => (
                  <TableRow key={exercise.id}>
                    <TableCell className="font-medium">{exercise.name}</TableCell>
                    <TableCell>{exercise.muscle_principal || "-"}</TableCell>
                    <TableCell>
                      {exercise.muscles_second && exercise.muscles_second.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {exercise.muscles_second.map((muscle, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {muscle}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{exercise.category || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {exercise.video_url ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            asChild
                          >
                            <a 
                              href={exercise.video_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Voir
                            </a>
                          </Button>
                        ) : (
                          "-"
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(exercise)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog de modification */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier l'exercice</DialogTitle>
          </DialogHeader>
          {editingExercise && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Nom de l'exercice *</Label>
                <Input
                  id="edit-name"
                  value={editingExercise.name}
                  onChange={(e) => setEditingExercise({ ...editingExercise, name: e.target.value })}
                  placeholder="Ex: Squat"
                />
              </div>
              <div>
                <Label>Catégories</Label>
                <div className="grid grid-cols-2 gap-3 mt-2 p-3 border rounded-md">
                  {CATEGORIES.map((category) => (
                    <div key={category} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-category-${category}`}
                        checked={editingExercise.category === category}
                        onCheckedChange={(checked) => {
                          setEditingExercise({ 
                            ...editingExercise, 
                            category: checked ? category : "" 
                          });
                        }}
                      />
                      <label
                        htmlFor={`edit-category-${category}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 cursor-pointer capitalize"
                      >
                        {category}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="edit-muscle-principal">Muscle principal *</Label>
                <Select
                  value={editingExercise.muscle_principal || ""}
                  onValueChange={(value) => setEditingExercise({ ...editingExercise, muscle_principal: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un muscle" />
                  </SelectTrigger>
                  <SelectContent>
                    {MUSCLE_GROUPS.map((muscle) => (
                      <SelectItem key={muscle} value={muscle}>
                        {muscle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Muscles secondaires</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2 max-h-48 overflow-y-auto p-3 border rounded-md">
                  {MUSCLE_GROUPS.map((muscle) => (
                    <div key={muscle} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-muscle-${muscle}`}
                        checked={(editingExercise.muscles_second || []).includes(muscle)}
                        onCheckedChange={() => toggleSecondaryMuscle(muscle, true)}
                        disabled={editingExercise.muscle_principal === muscle}
                      />
                      <label
                        htmlFor={`edit-muscle-${muscle}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 cursor-pointer"
                      >
                        {muscle}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="edit-equipment">Équipement</Label>
                <Input
                  id="edit-equipment"
                  value={editingExercise.equipment || ""}
                  onChange={(e) => setEditingExercise({ ...editingExercise, equipment: e.target.value })}
                  placeholder="Ex: Barre, Poids du corps"
                />
              </div>
              <div>
                <Label htmlFor="edit-video-url">URL de la vidéo</Label>
                <Input
                  id="edit-video-url"
                  value={editingExercise.video_url || ""}
                  onChange={(e) => setEditingExercise({ ...editingExercise, video_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editingExercise.description || ""}
                  onChange={(e) => setEditingExercise({ ...editingExercise, description: e.target.value })}
                  placeholder="Décris l'exercice, les points techniques..."
                  rows={4}
                />
              </div>
              <Button onClick={handleEditExercise} className="w-full">
                Enregistrer les modifications
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
