import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, LabelList } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, TrendingUp, Activity, Target, Calendar, Search, Weight } from "lucide-react";
import { getWeekNumber } from "@/lib/weekUtils";
import { Input } from "@/components/ui/input";

interface WeeklyStrengthData {
  week: string;
  weekNumber: number;
  year: number;
  tonnage: number;
  totalSets: number;
  totalReps: number;
  averageRpe: number | null;
  rpeDeviation: number | null;
  sessionCount: number;
}

interface WeeklyWeightedVolumeData {
  week: string;
  weekNumber: number;
  year: number;
  totalWeightedVolume: number;
  sessions: { name: string; weightedVolume: number; percentage: number }[];
  [key: string]: any; // Pour les barres dynamiques
}

interface MuscleGroupData {
  name: string;
  sets: number;
  tonnage: number;
}

interface ExerciseProgressData {
  exerciseName: string;
  weeks: { week: string; avgCharge: number; maxCharge: number; totalSets: number }[];
}

interface CoachStrengthViewProps {
  athleteId: string;
  athleteName: string;
}

export function CoachStrengthView({ athleteId, athleteName }: CoachStrengthViewProps) {
  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<WeeklyStrengthData[]>([]);
  const [weeklyWeightedData, setWeeklyWeightedData] = useState<WeeklyWeightedVolumeData[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroupData[]>([]);
  const [exerciseProgress, setExerciseProgress] = useState<ExerciseProgressData[]>([]);
  const [recentExercises, setRecentExercises] = useState<string[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [allSessionNames, setAllSessionNames] = useState<string[]>([]);

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

  const parseReps = (repsStr: string): number => {
    if (!repsStr) return 0;
    const num = parseInt(repsStr.replace(/[^0-9]/g, ""), 10);
    return isNaN(num) ? 0 : num;
  };

  const parseSeries = (seriesStr: string): number => {
    if (!seriesStr) return 0;
    const num = parseInt(seriesStr.replace(/[^0-9]/g, ""), 10);
    return isNaN(num) ? 0 : num;
  };

  const loadData = async () => {
    setLoading(true);

    try {
      // Charger toutes les séances de renfo validées avec exercices
      const { data: sessions, error } = await supabase
        .from("training_sessions")
        .select(`
          id,
          name,
          session_type,
          week_id,
          session_exercises!inner(
            id,
            exercice,
            charge,
            reps,
            series,
            rpe,
            sportif_rpe,
            sportif_feedback_at,
            skipped,
            super_set_group
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

      // Charger la bibliothèque d'exercices pour les groupes musculaires et coefficients
      const { data: exerciseLibrary } = await supabase
        .from("exercise_library")
        .select("name, muscle_principal, load_coefficient");

      const muscleMap = new Map<string, string>();
      const coefficientMap = new Map<string, number>();
      exerciseLibrary?.forEach((ex) => {
        if (ex.name) {
          if (ex.muscle_principal) {
            muscleMap.set(ex.name.toLowerCase(), ex.muscle_principal);
          }
          coefficientMap.set(ex.name.toLowerCase(), ex.load_coefficient || 1.0);
        }
      });

      // Calculer la semaine actuelle
      const now = new Date();
      const currentWeekNumber = getWeekNumber(now);
      const currentYear = now.getFullYear();

      // Identifier les exercices des 2 dernières semaines
      const recentExercisesSet = new Set<string>();
      sessions?.forEach((session: any) => {
        const weekNumber = session.training_weeks.week_number;
        const year = session.training_weeks.year;
        
        // Vérifier si c'est dans les 2 dernières semaines
        const weeksDiff = (currentYear - year) * 52 + (currentWeekNumber - weekNumber);
        if (weeksDiff <= 2 && weeksDiff >= 0) {
          session.session_exercises?.forEach((ex: any) => {
            if (ex.exercice && !ex.skipped) {
              recentExercisesSet.add(ex.exercice);
            }
          });
        }
      });
      
      const recentExercisesList = Array.from(recentExercisesSet);
      setRecentExercises(recentExercisesList);

      // Traiter les données hebdomadaires
      const weeklyMap = new Map<string, WeeklyStrengthData>();
      const muscleGroupMap = new Map<string, { sets: number; tonnage: number }>();
      const exerciseDataMap = new Map<string, Map<string, { charges: number[]; sets: number }>>();
      
      // Données pour le volume pondéré par séance
      const weeklyWeightedMap = new Map<string, Map<string, number>>(); // weekKey -> sessionName -> weightedVolume

      sessions?.forEach((session: any) => {
        const weekNumber = session.training_weeks.week_number;
        const year = session.training_weeks.year;
        const weekKey = `${year}-W${weekNumber.toString().padStart(2, "0")}`;
        const sessionName = session.name || "Séance sans nom";

        session.session_exercises?.forEach((exercise: any) => {
          // Ne prendre que les exercices validés (avec sportif_rpe) et non skipped
          if (exercise.skipped) return;
          if (exercise.sportif_rpe === null || exercise.sportif_rpe === undefined) return;

          const charge = parseCharge(exercise.charge);
          const reps = parseReps(exercise.reps);
          const series = parseSeries(exercise.series);
          const tonnage = charge * reps * series;
          
          // Calculer le volume pondéré avec le coefficient
          const exerciseNameLower = exercise.exercice?.toLowerCase() || "";
          const coefficient = coefficientMap.get(exerciseNameLower) || 1.0;
          const sportifRpeValue = parseFloat(exercise.sportif_rpe);
          // Formule: séries × reps × charge × (RPE/10) × coefficient
          const weightedVolume = series * reps * charge * (sportifRpeValue / 10) * coefficient;
          const coachRpe = exercise.rpe ? parseFloat(exercise.rpe) : null;
          const sportifRpe = sportifRpeValue;

          // Données hebdomadaires
          if (weeklyMap.has(weekKey)) {
            const existing = weeklyMap.get(weekKey)!;
            existing.tonnage += tonnage;
            existing.totalSets += series;
            existing.totalReps += reps * series;
            
            if (sportifRpe !== null) {
              const currentCount = existing.averageRpe ? existing.sessionCount : 0;
              const currentSum = (existing.averageRpe || 0) * currentCount;
              existing.averageRpe = (currentSum + sportifRpe) / (currentCount + 1);
              
              if (coachRpe !== null) {
                const deviation = sportifRpe - coachRpe;
                const currentDeviationCount = existing.rpeDeviation !== null ? currentCount : 0;
                const currentDeviationSum = (existing.rpeDeviation || 0) * currentDeviationCount;
                existing.rpeDeviation = (currentDeviationSum + deviation) / (currentDeviationCount + 1);
              }
            }
            existing.sessionCount++;
          } else {
            weeklyMap.set(weekKey, {
              week: weekKey,
              weekNumber,
              year,
              tonnage,
              totalSets: series,
              totalReps: reps * series,
              averageRpe: sportifRpe,
              rpeDeviation: coachRpe !== null && sportifRpe !== null ? sportifRpe - coachRpe : null,
              sessionCount: 1,
            });
          }

          // Groupes musculaires
          const exerciseName = exercise.exercice?.toLowerCase() || "";
          const muscleGroup = muscleMap.get(exerciseName) || "Autre";
          
          if (muscleGroupMap.has(muscleGroup)) {
            const existing = muscleGroupMap.get(muscleGroup)!;
            existing.sets += series;
            existing.tonnage += tonnage;
          } else {
            muscleGroupMap.set(muscleGroup, { sets: series, tonnage });
          }

          // Volume pondéré par séance
          if (!weeklyWeightedMap.has(weekKey)) {
            weeklyWeightedMap.set(weekKey, new Map());
          }
          const sessionMap = weeklyWeightedMap.get(weekKey)!;
          sessionMap.set(sessionName, (sessionMap.get(sessionName) || 0) + weightedVolume);

          // Progression des exercices (uniquement ceux des 2 dernières semaines)
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

      // Convertir les données hebdomadaires
      const sortedWeeklyData = Array.from(weeklyMap.values())
        .sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.weekNumber - b.weekNumber;
        })
        .slice(-12); // Garder les 12 dernières semaines

      // Convertir les données de volume pondéré
      const allSessions = new Set<string>();
      weeklyWeightedMap.forEach((sessionMap) => {
        sessionMap.forEach((_, sessionName) => allSessions.add(sessionName));
      });
      const sessionNamesList = Array.from(allSessions).sort();
      setAllSessionNames(sessionNamesList);

      const sortedWeeklyWeightedData: WeeklyWeightedVolumeData[] = Array.from(weeklyWeightedMap.entries())
        .map(([weekKey, sessionMap]) => {
          const [yearStr, weekStr] = weekKey.split("-W");
          const totalWeightedVolume = Array.from(sessionMap.values()).reduce((sum, v) => sum + v, 0);
          const sessions = Array.from(sessionMap.entries()).map(([name, weightedVolume]) => ({
            name,
            weightedVolume,
            percentage: totalWeightedVolume > 0 ? (weightedVolume / totalWeightedVolume) * 100 : 0
          }));
          
          // Créer l'objet avec les clés dynamiques pour chaque séance (en pourcentage)
          const dataPoint: WeeklyWeightedVolumeData = {
            week: weekKey,
            weekNumber: parseInt(weekStr),
            year: parseInt(yearStr),
            totalWeightedVolume,
            sessions
          };
          
          // Ajouter chaque séance comme clé avec son pourcentage
          sessions.forEach((s) => {
            dataPoint[s.name] = s.percentage;
          });
          
          return dataPoint;
        })
        .sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.weekNumber - b.weekNumber;
        })
        .slice(-12);

      setWeeklyData(sortedWeeklyData);
      setWeeklyWeightedData(sortedWeeklyWeightedData);

      // Convertir les groupes musculaires
      const muscleGroupsArray = Array.from(muscleGroupMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.sets - a.sets);

      setMuscleGroups(muscleGroupsArray);

      // Convertir la progression des exercices
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
          exerciseProgressArray.push({
            exerciseName,
            weeks: weeksArray,
          });
        }
      });

      // Trier par nombre de semaines d'activité (les plus actifs en premier)
      exerciseProgressArray.sort((a, b) => b.weeks.length - a.weeks.length);

      setExerciseProgress(exerciseProgressArray.slice(0, 10)); // Top 10 exercices
    } catch (error) {
      console.error("Error loading strength data:", error);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (weeklyData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Dumbbell className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium">Aucune séance de renforcement</p>
        <p className="text-sm text-muted-foreground mt-2">
          Les séances de renfo de {athleteName} apparaîtront ici
        </p>
      </div>
    );
  }

  // Statistiques globales
  const totalTonnage = weeklyData.reduce((sum, w) => sum + w.tonnage, 0);
  const totalSets = weeklyData.reduce((sum, w) => sum + w.totalSets, 0);
  const totalReps = weeklyData.reduce((sum, w) => sum + w.totalReps, 0);
  const avgRpe = weeklyData.filter((w) => w.averageRpe).reduce((sum, w) => sum + (w.averageRpe || 0), 0) / 
    weeklyData.filter((w) => w.averageRpe).length || 0;

  // Comparaison avec la semaine précédente
  const lastWeek = weeklyData[weeklyData.length - 1];
  const previousWeek = weeklyData[weeklyData.length - 2];
  
  const tonnageChange = previousWeek
    ? { 
        value: Math.abs(((lastWeek.tonnage - previousWeek.tonnage) / previousWeek.tonnage) * 100),
        isIncrease: lastWeek.tonnage >= previousWeek.tonnage
      }
    : null;

  const MUSCLE_COLORS = [
    "hsl(45, 93%, 47%)",    // Jaune/Or (primary)
    "hsl(200, 80%, 55%)",   // Bleu clair
    "hsl(340, 75%, 55%)",   // Rose/Magenta
    "hsl(160, 70%, 45%)",   // Vert émeraude
    "hsl(280, 70%, 60%)",   // Violet
    "hsl(25, 90%, 55%)",    // Orange
    "hsl(180, 60%, 50%)",   // Cyan
    "hsl(60, 80%, 50%)",    // Jaune citron
    "hsl(320, 70%, 55%)",   // Fuchsia
    "hsl(100, 60%, 45%)",   // Vert lime
  ];

  const SESSION_COLORS = [
    "hsl(45, 93%, 47%)",    // Jaune/Or
    "hsl(200, 80%, 55%)",   // Bleu clair
    "hsl(340, 75%, 55%)",   // Rose
    "hsl(160, 70%, 45%)",   // Vert
    "hsl(280, 70%, 60%)",   // Violet
    "hsl(25, 90%, 55%)",    // Orange
    "hsl(180, 60%, 50%)",   // Cyan
    "hsl(60, 80%, 50%)",    // Jaune citron
    "hsl(320, 70%, 55%)",   // Fuchsia
    "hsl(100, 60%, 45%)",   // Vert lime
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Suivi renforcement - {athleteName}</h2>
      </div>

      {/* Statistiques globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Dumbbell className="h-4 w-4" />
              <span className="text-sm">Tonnage total</span>
            </div>
            <p className="text-2xl font-bold">{(totalTonnage / 1000).toFixed(1)}t</p>
            {tonnageChange && (
              <Badge variant={tonnageChange.isIncrease ? "default" : "secondary"} className="mt-1">
                {tonnageChange.isIncrease ? "+" : "-"}{tonnageChange.value.toFixed(0)}%
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              <span className="text-sm">Séries totales</span>
            </div>
            <p className="text-2xl font-bold">{totalSets}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Activity className="h-4 w-4" />
              <span className="text-sm">Reps totales</span>
            </div>
            <p className="text-2xl font-bold">{totalReps}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">RPE moyen</span>
            </div>
            <p className="text-2xl font-bold">{avgRpe ? avgRpe.toFixed(1) : "-"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Graphique tonnage hebdomadaire */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-primary" />
            Tonnage hebdomadaire
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="week" 
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(value) => `S${value.split("-W")[1]}`}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}t`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--background))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }}
                  formatter={(value: number) => [`${(value / 1000).toFixed(2)}t`, "Tonnage"]}
                  labelFormatter={(label) => `Semaine ${label.split("-W")[1]}`}
                />
                <Bar dataKey="tonnage" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Graphique volume pondéré par semaine */}
      {weeklyWeightedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Weight className="h-5 w-5 text-primary" />
              Volume pondéré par semaine (séances renfo)
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Formule: séries × reps × charge × (RPE/10) × coefficient
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyWeightedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="week" 
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(value) => `S${value.split("-W")[1]}`}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(value) => {
                      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                      if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                      return value.toFixed(0);
                    }}
                    domain={[0, 'auto']}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--background))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const weekData = weeklyWeightedData.find(d => d.week === label);
                      if (!weekData) return null;
                      
                      const formatVolume = (v: number) => {
                        if (v >= 1000000) return `${(v / 1000000).toFixed(2)}M`;
                        if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
                        return v.toFixed(0);
                      };
                      
                      return (
                        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                          <p className="font-semibold mb-2">Semaine {label.split("-W")[1]}</p>
                          <p className="text-lg font-bold text-primary mb-1">
                            {formatVolume(weekData.totalWeightedVolume)}
                          </p>
                          {weekData.sessions.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {weekData.sessions.map((s, i) => (
                                <p key={i} className="text-xs text-muted-foreground">
                                  {s.name}: {formatVolume(s.weightedVolume)}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Bar 
                    dataKey="totalWeightedVolume" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  >
                    <LabelList 
                      dataKey="totalWeightedVolume"
                      position="top"
                      formatter={(value: number) => {
                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                        if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                        return value.toFixed(0);
                      }}
                      style={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontWeight: "bold" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Graphique RPE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            RPE moyen par semaine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyData.filter((w) => w.averageRpe !== null)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="week" 
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(value) => `S${value.split("-W")[1]}`}
                />
                <YAxis 
                  domain={[0, 10]}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--background))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }}
                  formatter={(value: number) => [value.toFixed(1), "RPE"]}
                  labelFormatter={(label) => `Semaine ${label.split("-W")[1]}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="averageRpe" 
                  stroke="hsl(45, 93%, 47%)" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(45, 93%, 47%)", r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Répartition par groupe musculaire */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Répartition par groupe musculaire (séries)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={muscleGroups}
                    dataKey="sets"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {muscleGroups.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={MUSCLE_COLORS[index % MUSCLE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--background))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                    formatter={(value: number, name: string) => [`${value} séries`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 overflow-y-auto max-h-[300px]">
              {muscleGroups.map((muscle, index) => (
                <div key={muscle.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: MUSCLE_COLORS[index % MUSCLE_COLORS.length] }}
                    />
                    <span className="font-medium">{muscle.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold">{muscle.sets} séries</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      ({(muscle.tonnage / 1000).toFixed(1)}t)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progression des exercices récents */}
      {exerciseProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Progression des exercices (2 dernières semaines)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Seuls les exercices programmés ces 2 dernières semaines sont affichés
            </p>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un exercice..."
                value={exerciseSearch}
                onChange={(e) => setExerciseSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {exerciseProgress
                .filter((ex) => ex.exerciseName.toLowerCase().includes(exerciseSearch.toLowerCase()))
                .map((exercise) => {
                const lastWeekData = exercise.weeks[exercise.weeks.length - 1];
                const previousWeekData = exercise.weeks[exercise.weeks.length - 2];
                const chargeChange = previousWeekData
                  ? ((lastWeekData.avgCharge - previousWeekData.avgCharge) / previousWeekData.avgCharge) * 100
                  : null;

                return (
                  <div key={exercise.exerciseName} className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold">{exercise.exerciseName}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          Charge moy: <strong>{lastWeekData.avgCharge.toFixed(1)}kg</strong>
                        </span>
                        {chargeChange !== null && (
                          <Badge variant={chargeChange >= 0 ? "default" : "secondary"}>
                            {chargeChange >= 0 ? "+" : ""}{chargeChange.toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="h-[120px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={exercise.weeks}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis 
                            dataKey="week" 
                            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                            tickFormatter={(value) => `S${value.split("-W")[1]}`}
                          />
                          <YAxis 
                            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                            tickFormatter={(value) => `${value}kg`}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: "hsl(var(--background))", 
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px"
                            }}
                            formatter={(value: number, name: string) => [
                              `${value.toFixed(1)}kg`,
                              name === "avgCharge" ? "Charge moy" : "Charge max"
                            ]}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="avgCharge" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2}
                            dot={{ fill: "hsl(var(--primary))" }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="maxCharge" 
                            stroke="hsl(var(--chart-3))" 
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={{ fill: "hsl(var(--chart-3))" }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {exerciseProgress.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">
              Aucun exercice avec charge enregistré ces 2 dernières semaines
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
