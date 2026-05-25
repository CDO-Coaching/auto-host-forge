import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, TrendingUp, ChevronLeft } from "lucide-react";
import { MaxDialog } from "@/components/MaxDialog";
import { MaxesList } from "@/components/MaxesList";
import { MaxProgressChart } from "@/components/MaxProgressChart";
import { ExerciseFilterCombobox } from "@/components/ExerciseFilterCombobox";
import { VmaCard } from "@/components/VmaCard";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Max {
  id: string;
  exercise_id: string;
  exercise_name: string;
  muscle: string;
  max_type: string;
  weight_kg: number;
  recorded_at: string;
  notes: string | null;
  previous_weight?: number;
}

interface MaxHistory {
  recorded_at: string;
  weight_kg: number;
  max_type: string;
}

export default function Maxes() {
  const navigate = useNavigate();
  const [maxes, setMaxes] = useState<Max[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMax, setEditingMax] = useState<Max | null>(null);
  const [filterExerciseId, setFilterExerciseId] = useState<string>("");
  const [selectedExerciseForChart, setSelectedExerciseForChart] = useState<string>("");
  const [chartData, setChartData] = useState<MaxHistory[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [maxToDelete, setMaxToDelete] = useState<string | null>(null);
  const [exercisesList, setExercisesList] = useState<Array<{ id: string; name: string }>>([]);
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    const getUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    getUserId();
    loadMaxes();
    loadExercisesList();
  }, []);

  const loadExercisesList = async () => {
    const { data } = await supabase
      .from("exercise_library")
      .select("id, name")
      .order("name");
    
    if (data) {
      setExercisesList(data);
    }
  };

  const loadMaxes = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Récupérer tous les maxes avec les détails des exercices
      const { data: maxesData, error } = await supabase
        .from("exercise_maxes")
        .select(`
          id,
          exercise_id,
          max_type,
          weight_kg,
          recorded_at,
          notes,
          exercise_library (
            name,
            muscle_principal
          )
        `)
        .eq("athlete_id", user.id)
        .order("recorded_at", { ascending: false });

      if (error) throw error;

      // Filtrer pour exclure les max théoriques à la baisse (uniquement côté sportif) - DÉSACTIVÉ
      // On garde maintenant tous les max pour permettre le suivi des performances même en baisse
      const validMaxesData = maxesData;

      // Transformer et enrichir les données
      const enrichedMaxes = await Promise.all(
        validMaxesData.map(async (max: any) => {
          // Chercher le max précédent pour le même exercice
          const { data: previousMax } = await supabase
            .from("exercise_maxes")
            .select("weight_kg")
            .eq("athlete_id", user.id)
            .eq("exercise_id", max.exercise_id)
            .eq("max_type", max.max_type)
            .lt("recorded_at", max.recorded_at)
            .order("recorded_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: max.id,
            exercise_id: max.exercise_id,
            exercise_name: max.exercise_library.name,
            muscle: max.exercise_library.muscle_principal,
            max_type: max.max_type,
            weight_kg: max.weight_kg,
            recorded_at: max.recorded_at,
            notes: max.notes,
            previous_weight: previousMax?.weight_kg,
          };
        })
      );

      setMaxes(enrichedMaxes);

      // Sélectionner automatiquement le premier exercice pour le graphique
      if (enrichedMaxes.length > 0 && !selectedExerciseForChart) {
        setSelectedExerciseForChart(enrichedMaxes[0].exercise_id);
        loadChartData(enrichedMaxes[0].exercise_id);
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des maxes");
    } finally {
      setLoading(false);
    }
  };

  const loadChartData = async (exerciseId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("exercise_maxes")
      .select("recorded_at, weight_kg, max_type")
      .eq("athlete_id", user.id)
      .eq("exercise_id", exerciseId)
      .order("recorded_at", { ascending: true });

    if (data) {
      setChartData(data);
    }
  };

  const handleEditMax = (max: Max) => {
    setEditingMax(max);
    setDialogOpen(true);
  };

  const handleDeleteMax = (id: string) => {
    setMaxToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!maxToDelete) return;

    try {
      const { error } = await supabase
        .from("exercise_maxes")
        .delete()
        .eq("id", maxToDelete);

      if (error) throw error;

      toast.success("Max supprimé");
      loadMaxes();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleteDialogOpen(false);
      setMaxToDelete(null);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingMax(null);
  };

  // Filtrer par exercice si sélectionné
  const filteredMaxes = filterExerciseId 
    ? maxes.filter((m) => m.exercise_id === filterExerciseId)
    : maxes;

  // Grouper par exercice pour obtenir le max le plus récent de chaque
  const latestMaxes = filteredMaxes.reduce((acc, max) => {
    const key = `${max.exercise_id}-${max.max_type}`;
    if (!acc[key] || new Date(max.recorded_at) > new Date(acc[key].recorded_at)) {
      acc[key] = max;
    }
    return acc;
  }, {} as Record<string, Max>);

  const uniqueMaxes = Object.values(latestMaxes);
  
  // Si un exercice est sélectionné, charger automatiquement son chart
  useEffect(() => {
    if (filterExerciseId) {
      setSelectedExerciseForChart(filterExerciseId);
      loadChartData(filterExerciseId);
    } else {
      setSelectedExerciseForChart("");
      setChartData([]);
    }
  }, [filterExerciseId]);

  const selectedExercise = maxes.find((m) => m.exercise_id === selectedExerciseForChart);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Mes Max</h1>
        <Card>
          <CardContent className="py-8 text-center">
            Chargement...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {userId && <VmaCard athleteId={userId} />}
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Mes Max</h1>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau max
        </Button>
      </div>

      {maxes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Statistiques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold text-primary">{uniqueMaxes.length}</div>
                <div className="text-sm text-muted-foreground">Exercices suivis</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary">{maxes.length}</div>
                <div className="text-sm text-muted-foreground">Maxes enregistrés</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary">
                  {maxes.filter((m) => m.previous_weight && m.weight_kg > m.previous_weight).length}
                </div>
                <div className="text-sm text-muted-foreground">Records battus</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {maxes.length > 0 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Filtrer par exercice</label>
            <ExerciseFilterCombobox
              value={filterExerciseId}
              onChange={setFilterExerciseId}
              exercises={exercisesList}
            />
          </div>

          {filterExerciseId && selectedExercise && chartData.length > 0 && (
            <MaxProgressChart
              data={chartData}
              exerciseName={selectedExercise.exercise_name}
            />
          )}
        </div>
      )}

      <MaxesList
        maxes={uniqueMaxes}
        onEdit={handleEditMax}
        onDelete={handleDeleteMax}
      />

      <MaxDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        onSuccess={loadMaxes}
        editMax={editingMax}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce max ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le max sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
