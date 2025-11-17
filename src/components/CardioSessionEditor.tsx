import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import RunningSessionEditor from "@/components/RunningSessionEditor";

interface Exercise {
  id: number;
  exercice: string;
  cardio_sport?: "course" | "natation" | "vélo" | "yoga" | "hiit" | "";
  cardio_content?: string;
  cardio_pace?: string;
  vma?: number;
  rpe: string;
  commentaire: string;
  recuperation: string;
  reps: string;
  series: string;
  charge: string;
  tempo: string;
  super_set_group?: string | null;
}

interface CardioSessionEditorProps {
  exercises: Exercise[];
  isValidated: boolean;
  onExerciseChange: (exerciseId: number, field: string, value: any) => void;
  onDeleteExercise: (exerciseId: number) => void;
  onAddExercise: () => void;
}

export default function CardioSessionEditor({
  exercises,
  isValidated,
  onExerciseChange,
  onDeleteExercise,
  onAddExercise,
}: CardioSessionEditorProps) {
  return (
    <div className="space-y-3">
      {exercises.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          Aucune séance cardio ajoutée. Clique sur "Ajouter une séance cardio" pour commencer.
        </div>
      ) : (
        exercises.map((exercise) => (
          <div key={exercise.id} className="border rounded-lg p-4 bg-background space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">Séance Cardio {exercise.id}</h4>
              {!isValidated && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteExercise(exercise.id)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Sport</label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={exercise.cardio_sport || ""}
                onChange={(e) => onExerciseChange(exercise.id, "cardio_sport", e.target.value)}
                disabled={isValidated}
              >
                <option value="">Sélectionner...</option>
                <option value="course">Course</option>
                <option value="natation">Natation</option>
                <option value="vélo">Vélo</option>
                <option value="yoga">Yoga (balance)</option>
                <option value="hiit">HIIT</option>
              </select>
            </div>

            {exercise.cardio_sport === "course" && (
              <div className="space-y-4 border-t pt-4">
                <div className="max-w-xs">
                  <label className="text-sm font-medium mb-1 block">VMA de l'athlète (km/h)</label>
                  <Input
                    type="number"
                    min="8"
                    max="25"
                    step="0.5"
                    value={exercise.vma || ""}
                    onChange={(e) => onExerciseChange(exercise.id, "vma", parseFloat(e.target.value) || 0)}
                    placeholder="ex: 14.5"
                    disabled={isValidated}
                  />
                </div>
                {exercise.vma && exercise.vma > 0 ? (
                  <RunningSessionEditor
                    vma={exercise.vma}
                    onStepsChange={(steps) => {
                      onExerciseChange(exercise.id, "cardio_content", JSON.stringify(steps));
                    }}
                  />
                ) : (
                  <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded">
                    Renseigne la VMA de l'athlète pour créer une séance avec calcul automatique des allures.
                  </div>
                )}
              </div>
            )}

            {exercise.cardio_sport && exercise.cardio_sport !== "course" && (
              <>
                <div>
                  <label className="text-sm font-medium mb-1 block">Contenu</label>
                  <textarea
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={exercise.cardio_content || ""}
                    onChange={(e) => onExerciseChange(exercise.id, "cardio_content", e.target.value)}
                    placeholder="Décris le contenu de la séance..."
                    disabled={isValidated}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">RPE</label>
                    <Input
                      value={exercise.rpe || ""}
                      onChange={(e) => onExerciseChange(exercise.id, "rpe", e.target.value)}
                      placeholder="ex: 7"
                      disabled={isValidated}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Commentaire</label>
                    <Input
                      value={exercise.commentaire || ""}
                      onChange={(e) => onExerciseChange(exercise.id, "commentaire", e.target.value)}
                      placeholder="Notes..."
                      disabled={isValidated}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        ))
      )}
      {!isValidated && (
        <Button variant="outline" onClick={onAddExercise} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une séance cardio
        </Button>
      )}
    </div>
  );
}
