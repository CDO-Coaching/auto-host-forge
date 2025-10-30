import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Dumbbell, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Exercise {
  id: string;
  name: string;
  category: string | null;
  sub_category: string | null;
  video_url: string | null;
  description: string | null;
  muscles_worked: string[] | null;
  equipment: string | null;
  muscle: string | null;
  created_at: string;
}

export default function BibliothequeExercices() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newExercise, setNewExercise] = useState({
    name: "",
    category: "",
    sub_category: "",
    video_url: "",
    description: "",
    equipment: "",
    muscle: "",
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
          ex.muscle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ex.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedMuscle !== "all") {
      filtered = filtered.filter((ex) => ex.muscle === selectedMuscle);
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

    const { error } = await supabase.from("exercise_library").insert([newExercise]);

    if (error) {
      toast.error("Erreur lors de l'ajout de l'exercice");
      console.error(error);
    } else {
      toast.success("Exercice ajouté avec succès");
      setDialogOpen(false);
      setNewExercise({
        name: "",
        category: "",
        sub_category: "",
        video_url: "",
        description: "",
        equipment: "",
        muscle: "",
      });
      loadExercises();
    }
  };

  const muscles = Array.from(new Set(exercises.map((ex) => ex.muscle).filter(Boolean))).sort();

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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Catégorie</Label>
                  <Input
                    id="category"
                    value={newExercise.category}
                    onChange={(e) => setNewExercise({ ...newExercise, category: e.target.value })}
                    placeholder="Ex: Force"
                  />
                </div>
                <div>
                  <Label htmlFor="sub_category">Sous-catégorie</Label>
                  <Input
                    id="sub_category"
                    value={newExercise.sub_category}
                    onChange={(e) => setNewExercise({ ...newExercise, sub_category: e.target.value })}
                    placeholder="Ex: Jambes"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="muscle">Muscle principal</Label>
                <Input
                  id="muscle"
                  value={newExercise.muscle}
                  onChange={(e) => setNewExercise({ ...newExercise, muscle: e.target.value })}
                  placeholder="Ex: Quadriceps"
                />
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
                  <TableHead>Muscle principal</TableHead>
                  <TableHead>Lien vidéo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExercises.map((exercise) => (
                  <TableRow key={exercise.id}>
                    <TableCell className="font-medium">{exercise.name}</TableCell>
                    <TableCell>{exercise.muscle || "-"}</TableCell>
                    <TableCell>
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
                            Voir la vidéo
                          </a>
                        </Button>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
