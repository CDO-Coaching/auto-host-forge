import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { useAuth } from "@/contexts/AuthContext";

interface ExerciseRPEData {
  date: string;
  rpe: number;
  fullDate: string;
}

interface ExerciseRPEHistoryChartProps {
  exerciseName: string;
}

export function ExerciseRPEHistoryChart({ exerciseName }: ExerciseRPEHistoryChartProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [rpeHistory, setRpeHistory] = useState<ExerciseRPEData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchExerciseRPEHistory = async () => {
      if (!open || !user?.id || !exerciseName) return;

      setLoading(true);
      try {
        // 6 dernières semaines (42 jours)
        const sixWeeksAgo = subDays(new Date(), 42);
        sixWeeksAgo.setHours(0, 0, 0, 0);

        // Récupérer les exercices complétés avec RPE pour ce mouvement
        const { data, error } = await supabase
          .from("session_exercises")
          .select(`
            id,
            exercice,
            sportif_rpe,
            completed_at,
            training_sessions!inner(
              training_weeks!inner(athlete_id)
            )
          `)
          .eq("training_sessions.training_weeks.athlete_id", user.id)
          .eq("exercice", exerciseName)
          .not("completed_at", "is", null)
          .not("sportif_rpe", "is", null)
          .gte("completed_at", sixWeeksAgo.toISOString())
          .order("completed_at", { ascending: true });

        if (error) {
          console.error("Erreur lors de la récupération de l'historique RPE exercice:", error);
          return;
        }

        const formattedData: ExerciseRPEData[] = (data ?? []).map((ex) => ({
          date: format(new Date(ex.completed_at!), "dd/MM", { locale: fr }),
          fullDate: format(new Date(ex.completed_at!), "EEEE d MMMM", { locale: fr }),
          rpe: ex.sportif_rpe!,
        }));

        setRpeHistory(formattedData);
      } catch (err) {
        console.error("Erreur:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchExerciseRPEHistory();
  }, [open, user?.id, exerciseName]);

  const getRPEColor = (rpe: number) => {
    if (rpe <= 3) return "hsl(142, 76%, 36%)"; // vert
    if (rpe <= 5) return "hsl(48, 96%, 53%)"; // jaune
    if (rpe <= 7) return "hsl(38, 92%, 50%)"; // orange
    return "hsl(0, 84%, 60%)"; // rouge
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ExerciseRPEData;
      return (
        <div className="bg-background border border-border rounded-lg p-2 shadow-lg text-xs">
          <p className="text-muted-foreground capitalize">{data.fullDate}</p>
          <p className="font-medium">
            RPE: <span className="font-bold">{data.rpe}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => setOpen(true)}
        title="Voir l'historique des RPE pour cet exercice"
      >
        <BarChart3 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Historique RPE - {exerciseName}</DialogTitle>
            <DialogDescription>
              RPE sur les 6 dernières semaines pour cet exercice
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : rpeHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun RPE enregistré pour cet exercice
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={rpeHistory} 
                  margin={{ top: 10, right: 10, left: -10, bottom: 40 }}
                >
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    angle={-45}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis 
                    domain={[0, 10]} 
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    ticks={[2, 4, 6, 8, 10]}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="rpe" 
                    radius={[4, 4, 0, 0]}
                  >
                    {rpeHistory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getRPEColor(entry.rpe)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
