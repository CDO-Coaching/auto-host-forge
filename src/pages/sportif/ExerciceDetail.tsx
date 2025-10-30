import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function ExerciceDetail() {
  const { exerciceId } = useParams();
  const navigate = useNavigate();
  const [exercise, setExercise] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExerciseDetail();
  }, [exerciceId]);

  const loadExerciseDetail = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from("session_exercises")
      .select("*")
      .eq("id", exerciceId)
      .single();

    if (error) {
      console.error("Erreur lors du chargement de l'exercice:", error);
    } else {
      setExercise(data);
    }
    
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="min-h-screen p-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <p className="text-center text-muted-foreground mt-8">Exercice introuvable</p>
      </div>
    );
  }

  const InfoItem = ({ label, value }: { label: string; value: string | null }) => {
    if (!value) return null;
    
    return (
      <div className="py-3">
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p className="text-lg font-medium">{value}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background border-b p-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
      </div>

      <div className="p-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{exercise.exercice}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <InfoItem label="Séries" value={exercise.series} />
            <Separator />
            
            <InfoItem label="Répétitions" value={exercise.reps} />
            <Separator />
            
            <InfoItem label="Charge" value={exercise.charge} />
            <Separator />
            
            <InfoItem label="Récupération" value={exercise.recuperation} />
            <Separator />
            
            <InfoItem label="RPE (effort perçu)" value={exercise.rpe} />
            <Separator />
            
            <InfoItem label="Tempo" value={exercise.tempo} />
            
            {exercise.commentaire && (
              <>
                <Separator />
                <div className="py-3">
                  <p className="text-sm text-muted-foreground mb-2">Notes du coach</p>
                  <p className="text-base leading-relaxed">{exercise.commentaire}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
