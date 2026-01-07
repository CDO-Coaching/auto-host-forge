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
  series?: number;
  reps?: string;
  charge?: string;
  commentaire?: string;
  count: number; // nombre d'entrées groupées
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
        // Données sur 6 dernières semaines (42 jours)
        const sixWeeksAgo = subDays(new Date(), 42);
        sixWeeksAgo.setHours(0, 0, 0, 0);

        const safeName = exerciseName.trim();

        // Recherche EXACTE par nom d'exercice (pas de ilike avec %)
        const { data, error } = await supabase
          .from("session_exercises")
          .select(`
            id,
            exercice,
            sportif_rpe,
            sportif_feedback_at,
            series,
            reps,
            charge,
            commentaire,
            sportif_comment,
            training_sessions!inner(
              id,
              training_weeks!inner(athlete_id)
            )
          `)
          .eq("training_sessions.training_weeks.athlete_id", user.id)
          .eq("exercice", safeName)
          .not("sportif_feedback_at", "is", null)
          .not("sportif_rpe", "is", null)
          .gte("sportif_feedback_at", sixWeeksAgo.toISOString())
          .order("sportif_feedback_at", { ascending: true });

        if (error) {
          console.error("Erreur lors de la récupération de l'historique RPE exercice:", error);
          return;
        }

        // Grouper par date pour éviter les doublons
        interface GroupedData {
          rpes: number[];
          fullDate: string;
          series: number[];
          reps: string[];
          charges: string[];
          commentaires: string[];
        }
        const groupedByDate = new Map<string, GroupedData>();
        
        (data ?? []).forEach((ex) => {
          const d = new Date(ex.sportif_feedback_at!);
          const dateKey = format(d, "dd/MM", { locale: fr });
          const fullDate = format(d, "EEEE d MMMM", { locale: fr });
          
          if (!groupedByDate.has(dateKey)) {
            groupedByDate.set(dateKey, { 
              rpes: [], 
              fullDate, 
              series: [], 
              reps: [], 
              charges: [], 
              commentaires: [] 
            });
          }
          const group = groupedByDate.get(dateKey)!;
          group.rpes.push(ex.sportif_rpe!);
          if (ex.series) group.series.push(ex.series);
          if (ex.reps) group.reps.push(ex.reps);
          if (ex.charge) group.charges.push(ex.charge);
          // Prendre sportif_comment (commentaire athlète) en priorité, sinon commentaire coach
          const comment = ex.sportif_comment || ex.commentaire;
          if (comment) group.commentaires.push(comment);
        });

        // Calculer la moyenne par jour et garder les détails
        const formattedData: ExerciseRPEData[] = Array.from(groupedByDate.entries()).map(
          ([date, group]) => ({
            date,
            fullDate: group.fullDate,
            rpe: Math.round(group.rpes.reduce((a, b) => a + b, 0) / group.rpes.length),
            series: group.series.length > 0 ? Math.max(...group.series) : undefined,
            reps: group.reps.length > 0 ? group.reps[group.reps.length - 1] : undefined,
            charge: group.charges.length > 0 ? group.charges[group.charges.length - 1] : undefined,
            commentaire: group.commentaires.length > 0 ? group.commentaires[group.commentaires.length - 1] : undefined,
            count: group.rpes.length,
          })
        );

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
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg text-xs space-y-1 max-w-[200px]">
          <p className="text-muted-foreground capitalize font-medium">{data.fullDate}</p>
          <p>
            RPE: <span className="font-bold text-primary">{data.rpe}</span>
            {data.count > 1 && <span className="text-muted-foreground ml-1">({data.count} entrées)</span>}
          </p>
          {data.series && (
            <p>Séries: <span className="font-medium">{data.series}</span></p>
          )}
          {data.reps && (
            <p>Reps: <span className="font-medium">{data.reps}</span></p>
          )}
          {data.charge && (
            <p>Charge: <span className="font-medium">{data.charge}</span></p>
          )}
          {data.commentaire && (
            <p className="text-muted-foreground italic border-t border-border pt-1 mt-1">
              "{data.commentaire}"
            </p>
          )}
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
            <>
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
              {/* Légende des couleurs */}
              <div className="flex justify-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(142, 76%, 36%)" }} />
                  <span>1-3</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(48, 96%, 53%)" }} />
                  <span>4-5</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(38, 92%, 50%)" }} />
                  <span>6-7</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(0, 84%, 60%)" }} />
                  <span>8-10</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
