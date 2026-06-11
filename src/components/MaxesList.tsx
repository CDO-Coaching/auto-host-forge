import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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

interface MaxesListProps {
  maxes: Max[];
  onEdit?: (max: Max) => void;
  onDelete?: (id: string) => void;
  readOnly?: boolean;
  /** Affichage en petites cartes sur une grille (tient à l'écran sans scroll). */
  compact?: boolean;
}

const muscleColors: Record<string, string> = {
  Pectoraux: "bg-red-500/10 text-red-500 border-red-500/20",
  Dos: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  Épaules: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  Jambes: "bg-green-500/10 text-green-500 border-green-500/20",
  Bras: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  Abdominaux: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  Cardio: "bg-pink-500/10 text-pink-500 border-pink-500/20",
};

export function MaxesList({ maxes, onEdit, onDelete, readOnly, compact }: MaxesListProps) {
  const calculatePercentages = (weight: number) => {
    return {
      "70%": Math.round(weight * 0.7 * 2) / 2,
      "80%": Math.round(weight * 0.8 * 2) / 2,
      "90%": Math.round(weight * 0.9 * 2) / 2,
    };
  };

  if (maxes.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Aucun max enregistré pour le moment
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {maxes.map((max) => {
          const improvement = max.previous_weight ? Math.round((max.weight_kg - max.previous_weight) * 10) / 10 : 0;
          return (
            <Card key={max.id} className="group hover:shadow-md transition-shadow h-fit">
              <CardContent className="p-3 space-y-1">
                <div className="flex items-start justify-between gap-1">
                  <h3 className="font-semibold text-xs uppercase leading-tight line-clamp-2 flex-1">
                    {max.exercise_name}
                  </h3>
                  {!readOnly && (onEdit || onDelete) && (
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {onEdit && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(max)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDelete(max.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-primary leading-none">{max.weight_kg}</span>
                  <span className="text-xs text-muted-foreground">kg</span>
                  {improvement > 0 && (
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20 ml-auto text-[10px] px-1 py-0 h-4">
                      +{improvement}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{max.max_type}</span>
                  <span>{format(new Date(max.recorded_at), "dd MMM yy", { locale: fr })}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {maxes.map((max) => {
        const percentages = calculatePercentages(max.weight_kg);
        const improvement = max.previous_weight
          ? Math.round((max.weight_kg - max.previous_weight) * 10) / 10
          : 0;

        return (
          <Card key={max.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-lg uppercase">{max.exercise_name}</h3>
                    <Badge
                      variant="outline"
                      className={muscleColors[max.muscle] || ""}
                    >
                      {max.muscle}
                    </Badge>
                    <Badge variant="secondary">{max.max_type}</Badge>
                    {improvement > 0 && (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                        <TrendingUp className="mr-1 h-3 w-3" />
                        +{improvement}kg
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-primary">
                      {max.weight_kg}
                    </span>
                    <span className="text-muted-foreground">kg</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {format(new Date(max.recorded_at), "dd MMM yyyy", {
                        locale: fr,
                      })}
                    </span>
                  </div>

                  {max.max_type === "1RM" && (
                    <div className="flex gap-3 text-sm">
                      <span className="text-muted-foreground">
                        70%: <span className="font-medium">{percentages["70%"]}kg</span>
                      </span>
                      <span className="text-muted-foreground">
                        80%: <span className="font-medium">{percentages["80%"]}kg</span>
                      </span>
                      <span className="text-muted-foreground">
                        90%: <span className="font-medium">{percentages["90%"]}kg</span>
                      </span>
                    </div>
                  )}

                  {max.notes && (
                    <p className="text-sm text-muted-foreground italic">
                      {max.notes}
                    </p>
                  )}
                </div>

                {!readOnly && (
                  <div className="flex gap-2">
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(max)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(max.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
