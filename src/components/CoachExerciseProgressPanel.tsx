import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getWeekNumber } from "@/lib/weekUtils";

interface ExerciseProgressData {
  exerciseName: string;
  weeks: { week: string; avgCharge: number; maxCharge: number; totalSets: number }[];
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
      const currentYear = now.getFullYear();

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

      const exerciseDataMap = new Map<string, Map<string, { charges: number[]; sets: number }>>();

      sessions?.forEach((session: any) => {
        const weekNumber = session.training_weeks.week_number;
        const year = session.training_weeks.year;
        const weekKey = `${year}-W${weekNumber.toString().padStart(2, "0")}`;

        session.session_exercises?.forEach((exercise: any) => {
          if (exercise.skipped) return;

          const charge = parseCharge(exercise.charge);
          const series = parseInt(exercise.series?.replace(/[^0-9]/g, "") || "0", 10);

          if (recentExercisesSet.has(exercise.exercice) && charge > 0) {
            if (!exerciseDataMap.has(exercise.exercice)) {
              exerciseDataMap.set(exercise.exercice, new Map());
            }
            const exerciseWeeks = exerciseDataMap.get(exercise.exercice)!;

            if (exerciseWeeks.has(weekKey)) {
              const existing = exerciseWeeks.get(weekKey)!;
              existing.charges.push(charge);
              existing.sets += series;
            } else {
              exerciseWeeks.set(weekKey, { charges: [charge], sets: series });
            }
          }
        });
      });

      const exerciseProgressArray: ExerciseProgressData[] = [];
      exerciseDataMap.forEach((weeks, exerciseName) => {
        const weeksArray = Array.from(weeks.entries())
          .map(([week, data]) => ({
            week,
            avgCharge: data.charges.reduce((a, b) => a + b, 0) / data.charges.length,
            maxCharge: Math.max(...data.charges),
            totalSets: data.sets,
          }))
          .sort((a, b) => a.week.localeCompare(b.week));

        if (weeksArray.length > 0) {
          exerciseProgressArray.push({ exerciseName, weeks: weeksArray });
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
                <div className="flex items-center justify-between mb-2">
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
                <div className="h-[80px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={exercise.weeks}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="week"
                        tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                        tickFormatter={(value) => `S${value.split("-W")[1]}`}
                      />
                      <YAxis
                        tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                        tickFormatter={(value) => `${value}kg`}
                        width={35}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                        formatter={(value: number, name: string) => [
                          `${value.toFixed(1)}kg`,
                          name === "avgCharge" ? "Moy" : "Max",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgCharge"
                        stroke="hsl(45, 93%, 47%)"
                        strokeWidth={2}
                        dot={{ fill: "hsl(45, 93%, 47%)", r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="maxCharge"
                        stroke="hsl(200, 80%, 55%)"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={{ fill: "hsl(200, 80%, 55%)", r: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
