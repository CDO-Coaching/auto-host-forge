import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock, Heart, TrendingUp } from "lucide-react";
import { getWeekNumber } from "@/lib/weekUtils";

interface TriathlonWeeklyData {
  week: string;
  weekNumber: number;
  year: number;
  // Durée totale en minutes
  totalDurationMinutes: number;
  // Intensité VMA% moyenne programmée
  avgPlannedIntensity: number | null;
  plannedIntensityCount: number;
  // RPE moyen
  avgRpe: number | null;
  rpeCount: number;
  // FC moyenne
  avgHeartRate: number | null;
  hrCount: number;
  // Compteurs par sport
  runningCount: number;
  cyclingCount: number;
  swimmingCount: number;
  // Répartition des zones VMA% (en minutes)
  zoneZ1Z2Minutes: number; // <70%
  zoneZ3Z4Minutes: number; // 70-90%
  zoneZ5Minutes: number;   // >90%
}

interface CoachTriathlonViewProps {
  athleteId: string;
  athleteName: string;
}

export function CoachTriathlonView({ athleteId, athleteName }: CoachTriathlonViewProps) {
  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<TriathlonWeeklyData[]>([]);

  useEffect(() => {
    loadData();
  }, [athleteId]);

  const loadData = async () => {
    setLoading(true);

    // Charger toutes les séances cardio (course, vélo, natation) validées
    const { data: sessions, error } = await supabase
      .from("training_sessions")
      .select(`
        id,
        name,
        cardio_total_duration_minutes,
        cardio_average_intensity,
        week_id,
        session_exercises!inner(
          id,
          cardio_sport,
          sportif_rpe,
          sportif_feedback_at,
          actual_duration_minutes,
          actual_avg_heart_rate,
          skipped
        ),
        training_weeks!inner(
          athlete_id,
          week_number,
          year
        )
      `)
      .eq("training_weeks.athlete_id", athleteId)
      .in("session_exercises.cardio_sport", ["course", "velo", "natation"]);

    if (error) {
      console.error("Error loading triathlon sessions:", error);
      setLoading(false);
      return;
    }

    // Traiter les données et grouper par semaine
    const weeklyMap = new Map<string, TriathlonWeeklyData>();
    
    sessions?.forEach((session: any) => {
      const weekNumber = session.training_weeks.week_number;
      const year = session.training_weeks.year;
      const weekKey = `${year}-W${weekNumber.toString().padStart(2, '0')}`;

      const exercise = session.session_exercises?.[0];
      if (!exercise || exercise.skipped) return;
      
      // Vérifier si la séance est validée
      const isValidated = exercise && (
        exercise.sportif_rpe !== null || 
        exercise.actual_duration_minutes !== null ||
        exercise.actual_avg_heart_rate !== null
      );
      
      if (!isValidated) return;

      const sport = exercise.cardio_sport;
      const actualDuration = exercise.actual_duration_minutes || session.cardio_total_duration_minutes || 0;
      const actualHeartRate = exercise.actual_avg_heart_rate || 0;
      const actualRpe = exercise.sportif_rpe || 0;
      const plannedIntensity = session.cardio_average_intensity || 0;

      if (weeklyMap.has(weekKey)) {
        const existing = weeklyMap.get(weekKey)!;

        existing.totalDurationMinutes += actualDuration;

        // Cumuler FC moyenne
        if (actualHeartRate > 0) {
          const currentHRSum = (existing.avgHeartRate || 0) * existing.hrCount;
          existing.hrCount++;
          existing.avgHeartRate = Math.round((currentHRSum + actualHeartRate) / existing.hrCount);
        }

        // Cumuler intensité VMA% programmée
        if (plannedIntensity > 0) {
          const currentIntensitySum = (existing.avgPlannedIntensity || 0) * existing.plannedIntensityCount;
          existing.plannedIntensityCount++;
          existing.avgPlannedIntensity = Math.round((currentIntensitySum + plannedIntensity) / existing.plannedIntensityCount);

          // Ajouter aux zones appropriées
          if (plannedIntensity < 70) existing.zoneZ1Z2Minutes += actualDuration;
          else if (plannedIntensity <= 90) existing.zoneZ3Z4Minutes += actualDuration;
          else existing.zoneZ5Minutes += actualDuration;
        }

        // Cumuler RPE moyen
        if (actualRpe > 0) {
          const currentRpeSum = (existing.avgRpe || 0) * existing.rpeCount;
          existing.rpeCount++;
          existing.avgRpe = Math.round(((currentRpeSum + actualRpe) / existing.rpeCount) * 10) / 10;
        }

        // Incrémenter compteur sport
        if (sport === 'course') existing.runningCount++;
        else if (sport === 'velo') existing.cyclingCount++;
        else if (sport === 'natation') existing.swimmingCount++;

      } else {
        // Déterminer la zone pour cette séance
        let zoneZ1Z2 = 0, zoneZ3Z4 = 0, zoneZ5 = 0;
        if (plannedIntensity > 0) {
          if (plannedIntensity < 70) zoneZ1Z2 = actualDuration;
          else if (plannedIntensity <= 90) zoneZ3Z4 = actualDuration;
          else zoneZ5 = actualDuration;
        }

        weeklyMap.set(weekKey, {
          week: weekKey,
          weekNumber,
          year,
          totalDurationMinutes: actualDuration,
          avgPlannedIntensity: plannedIntensity > 0 ? plannedIntensity : null,
          plannedIntensityCount: plannedIntensity > 0 ? 1 : 0,
          avgRpe: actualRpe > 0 ? actualRpe : null,
          rpeCount: actualRpe > 0 ? 1 : 0,
          avgHeartRate: actualHeartRate > 0 ? actualHeartRate : null,
          hrCount: actualHeartRate > 0 ? 1 : 0,
          runningCount: sport === 'course' ? 1 : 0,
          cyclingCount: sport === 'velo' ? 1 : 0,
          swimmingCount: sport === 'natation' ? 1 : 0,
          zoneZ1Z2Minutes: zoneZ1Z2,
          zoneZ3Z4Minutes: zoneZ3Z4,
          zoneZ5Minutes: zoneZ5,
        });
      }
    });

    // Convertir en tableau et trier par semaine
    const sortedWeeklyData = Array.from(weeklyMap.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.weekNumber - b.weekNumber;
    });

    setWeeklyData(sortedWeeklyData);
    setLoading(false);
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h${mins > 0 ? mins.toString().padStart(2, '0') : ''}`;
    }
    return `${mins}min`;
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
        <Activity className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium">Aucune séance de triathlon</p>
        <p className="text-sm text-muted-foreground mt-2">
          Les séances de course, vélo et natation de {athleteName} apparaîtront ici
        </p>
      </div>
    );
  }

  // Calculer les totaux
  const totalDuration = weeklyData.reduce((sum, w) => sum + w.totalDurationMinutes, 0);
  const totalWeeks = weeklyData.length;

  // Moyenne des métriques
  const weeksWithPlannedIntensity = weeklyData.filter(w => w.avgPlannedIntensity !== null);
  const avgPlannedIntensity = weeksWithPlannedIntensity.length > 0
    ? Math.round(weeksWithPlannedIntensity.reduce((sum, w) => sum + (w.avgPlannedIntensity || 0), 0) / weeksWithPlannedIntensity.length)
    : null;

  const weeksWithRpe = weeklyData.filter(w => w.avgRpe !== null);
  const avgRpe = weeksWithRpe.length > 0
    ? Math.round(weeksWithRpe.reduce((sum, w) => sum + (w.avgRpe || 0), 0) / weeksWithRpe.length * 10) / 10
    : null;
    
  const weeksWithHr = weeklyData.filter(w => w.avgHeartRate !== null);
  const avgHr = weeksWithHr.length > 0
    ? Math.round(weeksWithHr.reduce((sum, w) => sum + (w.avgHeartRate || 0), 0) / weeksWithHr.length)
    : null;

  const totalRunning = weeklyData.reduce((sum, w) => sum + w.runningCount, 0);
  const totalCycling = weeklyData.reduce((sum, w) => sum + w.cyclingCount, 0);
  const totalSwimming = weeklyData.reduce((sum, w) => sum + w.swimmingCount, 0);

  // Préparer données pour le graphique de durée
  const chartData = weeklyData.map(w => ({
    week: `S${w.weekNumber}`,
    duration: Math.round(w.totalDurationMinutes),
    rpe: w.avgRpe,
    hr: w.avgHeartRate,
  }));

  // Préparer données pour le graphique d'intensité avec zones
  const intensityChartData = weeklyData.map(w => {
    const totalZoneMinutes = w.zoneZ1Z2Minutes + w.zoneZ3Z4Minutes + w.zoneZ5Minutes;
    const avgIntensity = w.avgPlannedIntensity || 0;

    if (totalZoneMinutes === 0 || avgIntensity === 0) {
      return {
        week: `S${w.weekNumber}`,
        avgIntensity: 0,
        z1z2Percent: 0,
        z3z4Percent: 0,
        z5Percent: 0,
        z1z2Label: 0,
        z3z4Label: 0,
        z5Label: 0,
      };
    }

    const z1z2Ratio = w.zoneZ1Z2Minutes / totalZoneMinutes;
    const z3z4Ratio = w.zoneZ3Z4Minutes / totalZoneMinutes;
    const z5Ratio = w.zoneZ5Minutes / totalZoneMinutes;

    return {
      week: `S${w.weekNumber}`,
      avgIntensity,
      z1z2Percent: Math.round(z1z2Ratio * avgIntensity),
      z3z4Percent: Math.round(z3z4Ratio * avgIntensity),
      z5Percent: Math.round(z5Ratio * avgIntensity),
      z1z2Label: Math.round(z1z2Ratio * 100),
      z3z4Label: Math.round(z3z4Ratio * 100),
      z5Label: Math.round(z5Ratio * 100),
    };
  });

  return (
    <div className="space-y-6">
      {/* Cartes résumé */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Durée totale</span>
            </div>
            <p className="text-2xl font-bold">{formatDuration(totalDuration)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              sur {totalWeeks} semaines
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Intensité moyenne</span>
            </div>
            <p className="text-2xl font-bold">
              {avgPlannedIntensity !== null ? `${avgPlannedIntensity}%` : '-'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">% VMA programmé</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Activity className="h-4 w-4" />
              <span className="text-sm">RPE moyen</span>
            </div>
            <p className="text-2xl font-bold">
              {avgRpe !== null ? avgRpe.toFixed(1) : '-'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">/10</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Heart className="h-4 w-4" />
              <span className="text-sm">FC moyenne</span>
            </div>
            <p className="text-2xl font-bold">
              {avgHr !== null ? `${avgHr}` : '-'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">bpm</p>
          </CardContent>
        </Card>
      </div>

      {/* Badges répartition sports */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">
          🏃 Course: {totalRunning} séances
        </Badge>
        <Badge variant="secondary">
          🚴 Vélo: {totalCycling} séances
        </Badge>
        <Badge variant="secondary">
          🏊 Natation: {totalSwimming} séances
        </Badge>
      </div>

      {/* Graphique durée par semaine */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Durée totale par semaine (min)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'duration') return [`${formatDuration(value)}`, 'Durée'];
                  if (name === 'rpe') return [value, 'RPE'];
                  if (name === 'hr') return [`${value} bpm`, 'FC'];
                  return [value, name];
                }}
              />
              <Legend />
              <Bar 
                dataKey="duration" 
                name="Durée (min)" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
              >
                <LabelList 
                  dataKey="duration" 
                  position="top" 
                  formatter={(value: number) => formatDuration(value)}
                  style={{ fontSize: 10 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Graphique intensité avec répartition des zones */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Répartition des zones d'intensité par semaine</CardTitle>
          <p className="text-sm text-muted-foreground">
            {intensityChartData.length >= 2 && intensityChartData[intensityChartData.length - 2]?.avgIntensity && intensityChartData[intensityChartData.length - 1]?.avgIntensity ? (
              <>
                {intensityChartData[intensityChartData.length - 2].avgIntensity}% ({weeklyData[weeklyData.length - 2]?.week}) vs {intensityChartData[intensityChartData.length - 1].avgIntensity}% ({weeklyData[weeklyData.length - 1]?.week})
                {' '}
                {(() => {
                  const prev = intensityChartData[intensityChartData.length - 2].avgIntensity;
                  const curr = intensityChartData[intensityChartData.length - 1].avgIntensity;
                  const diff = ((curr - prev) / prev * 100).toFixed(1);
                  return prev < curr 
                    ? <span className="text-green-500">↑ {diff}%</span>
                    : <span className="text-red-500">↓ {Math.abs(Number(diff))}%</span>;
                })()}
              </>
            ) : null}
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={intensityChartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                formatter={(value: number, name: string, props: any) => {
                  const data = props.payload;
                  if (name === 'Z1-Z2 (<70%)') return [`${data.z1z2Label}%`, name];
                  if (name === 'Z3-Z4 (70-90%)') return [`${data.z3z4Label}%`, name];
                  if (name === 'Z5 (>90%)') return [`${data.z5Label}%`, name];
                  return [value, name];
                }}
                labelFormatter={(label) => {
                  const data = intensityChartData.find(d => d.week === label);
                  return `${label} - Intensité moyenne: ${data?.avgIntensity || 0}%`;
                }}
              />
              <Legend />
              <Bar 
                dataKey="z1z2Percent" 
                name="Z1-Z2 (<70%)" 
                stackId="intensity"
                fill="#22c55e"
              >
                <LabelList 
                  dataKey="z1z2Label" 
                  position="center" 
                  formatter={(value: number) => value > 10 ? `${value}%` : ''}
                  style={{ fontSize: 10, fill: 'white', fontWeight: 'bold' }}
                />
              </Bar>
              <Bar 
                dataKey="z3z4Percent" 
                name="Z3-Z4 (70-90%)" 
                stackId="intensity"
                fill="#eab308"
              >
                <LabelList 
                  dataKey="z3z4Label" 
                  position="center" 
                  formatter={(value: number) => value > 10 ? `${value}%` : ''}
                  style={{ fontSize: 10, fill: 'white', fontWeight: 'bold' }}
                />
              </Bar>
              <Bar 
                dataKey="z5Percent" 
                name="Z5 (>90%)" 
                stackId="intensity"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
              >
                <LabelList 
                  dataKey="z5Label" 
                  position="center" 
                  formatter={(value: number) => value > 10 ? `${value}%` : ''}
                  style={{ fontSize: 10, fill: 'white', fontWeight: 'bold' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
