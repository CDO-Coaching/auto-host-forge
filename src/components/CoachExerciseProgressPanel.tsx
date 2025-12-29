import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getWeekNumber, getWeekYear } from "@/lib/weekUtils";

interface ExerciseWeekData {
  week: string;
  avgCharge: number;
  maxCharge: number;
  totalSets: number;
  totalReps: number;
  tonnage: number;
}

interface ExerciseProgressData {
  exerciseName: string;
  weeks: ExerciseWeekData[];
  avgWeeklyTonnage: number;
  totalReps: number;
}

interface CoachExerciseProgressPanelProps {
  athleteId: string;
}

export function CoachExerciseProgressPanel({ athleteId }: CoachExerciseProgressPanelProps) {
  const [loading, setLoading] = useState(true);
  const [exerciseProgress, setExerciseProgress] = useState<ExerciseProgressData[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState("");

  useEffect(() => {
    loadData();
  }, [athleteId]);

  const parseCharge = (chargeStr: string): number => {
    if (!chargeStr) return 0;
    // Format multiplication: "18*2" ou "18x2" signifie 2 haltères de 18kg = 36kg
    const multiMatch = chargeStr.match(/(\d+\.?\d*)\s*[*xX×]\s*(\d+)/);
    if (multiMatch) {
      const weight = parseFloat(multiMatch[1]);
      const multiplier = parseInt(multiMatch[2]);
      return weight * multiplier;
    }
    const num = parseFloat(chargeStr.replace(/[^0-9.,]/g, "").replace(",", "."));
    return isNaN(num) ? 0 : num;
  };

  const loadData = async () => {
    setLoading(true);

    try {
      const { data: sessions, error } = await supabase
        .from("training_sessions")
        .select(`
          id,
          session_type,
          session_exercises!inner(
            id,
            exercice,
            charge,
            reps,
            series,
            skipped
          ),
          training_weeks!inner(
            athlete_id,
            week_number,
            year
          )
        `)
        .eq("training_weeks.athlete_id", athleteId)
        .eq("session_type", "renfo");

      if (error) {
        console.error("Error loading strength sessions:", error);
        setLoading(false);
        return;
      }

      const now = new Date();
      const currentWeekNumber = getWeekNumber(now);
      const currentYear = getWeekYear(now);

      // Identifier les exercices des 2 dernières semaines
      const recentExercisesSet = new Set<string>();
      sessions?.forEach((session: any) => {
        const weekNumber = session.training_weeks.week_number;
        const year = session.training_weeks.year;
        const weeksDiff = (currentYear - year) * 52 + (currentWeekNumber - weekNumber);
        if (weeksDiff <= 2 && weeksDiff >= 0) {
          session.session_exercises?.forEach((ex: any) => {
            if (ex.exercice && !ex.skipped) {
              recentExercisesSet.add(ex.exercice);
            }
          });
        }
      });

      const exerciseDataMap = new Map<string, Map<string, { charges: number[]; sets: number; reps: number; tonnage: number }>>();

      sessions?.forEach((session: any) => {
        const weekNumber = session.training_weeks.week_number;
        const year = session.training_weeks.year;
        const weekKey = `${year}-W${weekNumber.toString().padStart(2, "0")}`;

        session.session_exercises?.forEach((exercise: any) => {
          if (exercise.skipped) return;

          const charge = parseCharge(exercise.charge);
          const series = parseInt(exercise.series?.replace(/[^0-9]/g, "") || "0", 10);
          const reps = parseInt(exercise.reps?.replace(/[^0-9]/g, "") || "0", 10);
          const totalReps = reps * series;
          const tonnage = charge * totalReps;

          if (recentExercisesSet.has(exercise.exercice) && charge > 0) {
            if (!exerciseDataMap.has(exercise.exercice)) {
              exerciseDataMap.set(exercise.exercice, new Map());
            }
            const exerciseWeeks = exerciseDataMap.get(exercise.exercice)!;

            if (exerciseWeeks.has(weekKey)) {
              const existing = exerciseWeeks.get(weekKey)!;
              existing.charges.push(charge);
              existing.sets += series;
              existing.reps += totalReps;
              existing.tonnage += tonnage;
            } else {
              exerciseWeeks.set(weekKey, { charges: [charge], sets: series, reps: totalReps, tonnage });
            }
          }
        });
      });

      const exerciseProgressArray: ExerciseProgressData[] = [];
      exerciseDataMap.forEach((weeks, exerciseName) => {
        const weeksArray: ExerciseWeekData[] = Array.from(weeks.entries())
          .map(([week, data]) => ({
            week,
            avgCharge: data.charges.reduce((a, b) => a + b, 0) / data.charges.length,
            maxCharge: Math.max(...data.charges),
            totalSets: data.sets,
            totalReps: data.reps,
            tonnage: data.tonnage,
          }))
          .sort((a, b) => a.week.localeCompare(b.week))
          .slice(-5); // Garder seulement les 5 dernières semaines

        if (weeksArray.length > 0) {
          const totalTonnage = weeksArray.reduce((sum, w) => sum + w.tonnage, 0);
          const totalReps = weeksArray.reduce((sum, w) => sum + w.totalReps, 0);
          exerciseProgressArray.push({
            exerciseName,
            weeks: weeksArray,
            avgWeeklyTonnage: totalTonnage / weeksArray.length,
            totalReps,
          });
        }
      });

      exerciseProgressArray.sort((a, b) => b.weeks.length - a.weeks.length);
      setExerciseProgress(exerciseProgressArray);
    } catch (error) {
      console.error("Error loading exercise data:", error);
    }

    setLoading(false);
  };

  const filteredExercises = exerciseProgress.filter((ex) =>
    ex.exerciseName.toLowerCase().includes(exerciseSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un exercice..."
          value={exerciseSearch}
          onChange={(e) => setExerciseSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filteredExercises.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          {exerciseSearch ? "Aucun exercice trouvé" : "Aucun exercice enregistré ces 2 dernières semaines"}
        </p>
      ) : (
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {filteredExercises.map((exercise) => {
            const lastWeekData = exercise.weeks[exercise.weeks.length - 1];
            const previousWeekData = exercise.weeks[exercise.weeks.length - 2];
            const chargeChange = previousWeekData
              ? ((lastWeekData.avgCharge - previousWeekData.avgCharge) / previousWeekData.avgCharge) * 100
              : null;

            return (
              <div key={exercise.exerciseName} className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium text-sm">{exercise.exerciseName}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      <strong>{lastWeekData.avgCharge.toFixed(1)}kg</strong>
                    </span>
                    {chargeChange !== null && (
                      <Badge variant={chargeChange >= 0 ? "default" : "secondary"} className="text-xs px-1.5 py-0">
                        {chargeChange >= 0 ? "+" : ""}{chargeChange.toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                  <span>Tonnage moy: <strong className="text-foreground">{(exercise.avgWeeklyTonnage / 1000).toFixed(2)}t/sem</strong></span>
                  <span>•</span>
                  <span>Reps totales: <strong className="text-foreground">{exercise.totalReps}</strong></span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {/* Graphique Charge */}
                  <div>
                    <p className="text-[10px] text-muted-foreground text-center mb-1">Charge (kg)</p>
                    <div className="h-[70px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={exercise.weeks}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="week"
                            tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                            tickFormatter={(value) => `S${value.split("-W")[1]}`}
                          />
                          <YAxis
                            tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                            width={25}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--background))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "6px",
                              fontSize: "10px",
                            }}
                            formatter={(value: number) => [`${value.toFixed(1)}kg`]}
                            labelFormatter={(label) => `S${label.split("-W")[1]}`}
                          />
                          <Line
                            type="monotone"
                            dataKey="avgCharge"
                            stroke="hsl(45, 93%, 47%)"
                            strokeWidth={2}
                            dot={{ fill: "hsl(45, 93%, 47%)", r: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Graphique Reps */}
                  <div>
                    <p className="text-[10px] text-muted-foreground text-center mb-1">Reps/sem</p>
                    <div className="h-[70px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={exercise.weeks}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="week"
                            tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                            tickFormatter={(value) => `S${value.split("-W")[1]}`}
                          />
                          <YAxis
                            tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                            width={25}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--background))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "6px",
                              fontSize: "10px",
                            }}
                            formatter={(value: number) => [`${value} reps`]}
                            labelFormatter={(label) => `S${label.split("-W")[1]}`}
                          />
                          <Bar
                            dataKey="totalReps"
                            fill="hsl(200, 80%, 55%)"
                            radius={[2, 2, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Graphique Tonnage */}
                  <div>
                    <p className="text-[10px] text-muted-foreground text-center mb-1">Tonnage/sem</p>
                    <div className="h-[70px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={exercise.weeks}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="week"
                            tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                            tickFormatter={(value) => `S${value.split("-W")[1]}`}
                          />
                          <YAxis
                            tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                            tickFormatter={(value) => `${(value / 1000).toFixed(1)}t`}
                            width={30}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--background))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "6px",
                              fontSize: "10px",
                            }}
                            formatter={(value: number) => [`${(value / 1000).toFixed(2)}t`]}
                            labelFormatter={(label) => `S${label.split("-W")[1]}`}
                          />
                          <Bar
                            dataKey="tonnage"
                            fill="hsl(160, 70%, 45%)"
                            radius={[2, 2, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
