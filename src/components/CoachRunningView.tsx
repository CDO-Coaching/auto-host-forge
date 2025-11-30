import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { formatCardioTime, formatCardioDistance } from "@/lib/cardioCalculations";
import { CardioData } from "@/components/CardioStepBuilder";
import { Activity, Clock, MapPin, TrendingUp, Calendar } from "lucide-react";
import { getWeekNumber } from "@/lib/weekUtils";

interface CardioSessionData {
  week: string;
  weekNumber: number;
  year: number;
  // Données programmées
  plannedDurationMinutes: number;
  plannedDistanceKm: number;
  plannedAverageIntensity: number;
  plannedSessionCount: number;
  // Données réalisées
  actualDurationMinutes: number;
  actualDistanceKm: number;
  actualAverageIntensity: number;
  actualSessionCount: number;
  // Retours sportif
  actualAveragePace: number | null;
  actualAverageHeartRate: number | null;
  actualAverageRpe: number | null;
}

interface PlannedVolume {
  durationMinutes: number;
  distanceKm: number;
  averageIntensity: number;
  sessionCount: number;
}

interface CoachRunningViewProps {
  athleteId: string;
  athleteName: string;
}

export function CoachRunningView({ athleteId, athleteName }: CoachRunningViewProps) {
  const [loading, setLoading] = useState(true);
  const [cardioSessions, setCardioSessions] = useState<CardioSessionData[]>([]);
  const [athleteVma, setAthleteVma] = useState<number | null>(null);
  const [plannedVolume, setPlannedVolume] = useState<PlannedVolume | null>(null);

  useEffect(() => {
    loadData();
  }, [athleteId]);

  const loadPlannedVolume = async (athleteId: string, vma: number | null) => {
    // Obtenir la semaine en cours
    const now = new Date();
    const currentWeekNumber = getWeekNumber(now);
    const currentYear = now.getFullYear();

    try {
      // Récupérer les séances de cardio avec les métriques pré-calculées pour la semaine en cours
      const { data: sessions, error } = await supabase
        .from('training_sessions')
        .select(`
          id,
          name,
          cardio_total_distance_km,
          cardio_total_duration_minutes,
          cardio_average_intensity,
          session_exercises!inner(
            id,
            cardio_sport
          ),
          training_weeks!inner(
            week_number,
            year
          )
        `)
        .eq('training_weeks.athlete_id', athleteId)
        .eq('training_weeks.week_number', currentWeekNumber)
        .eq('training_weeks.year', currentYear)
        .eq('session_exercises.cardio_sport', 'course')
        .not('cardio_total_distance_km', 'is', null);

      if (error) {
        console.error("Error loading planned sessions:", error);
        return;
      }

      if (!sessions || sessions.length === 0) {
        setPlannedVolume(null);
        return;
      }

      // Agréger les métriques des séances avec métriques pré-calculées
      const totalDistance = sessions.reduce((sum, session) => 
        sum + (session.cardio_total_distance_km || 0), 0
      );
      
      const totalDuration = sessions.reduce((sum, session) => 
        sum + (session.cardio_total_duration_minutes || 0), 0
      );

      // Calculer l'intensité moyenne pondérée par la durée
      const totalIntensityWeighted = sessions.reduce((sum, session) => 
        sum + ((session.cardio_average_intensity || 0) * (session.cardio_total_duration_minutes || 0)), 0
      );

      const averageIntensity = totalDuration > 0 
        ? Math.round(totalIntensityWeighted / totalDuration)
        : 0;

      setPlannedVolume({
        sessionCount: sessions.length,
        distanceKm: totalDistance,
        durationMinutes: totalDuration,
        averageIntensity
      });

    } catch (error) {
      console.error('Erreur lors du chargement du volume prévu:', error);
      setPlannedVolume(null);
    }
  };

  const loadData = async () => {
    setLoading(true);

    // Charger la VMA de l'athlète
    const { data: profileData } = await supabase
      .from("user_profiles")
      .select("vma")
      .eq("id", athleteId)
      .single();
    
    if (profileData?.vma) {
      setAthleteVma(profileData.vma);
    }

    // Charger le volume prévu pour la semaine en cours
    await loadPlannedVolume(athleteId, profileData?.vma || null);

    // Charger toutes les séances cardio de course avec les métriques pré-calculées
    const { data: sessions, error } = await supabase
      .from("training_sessions")
      .select(`
        id,
        name,
        cardio_total_distance_km,
        cardio_total_duration_minutes,
        cardio_average_intensity,
        week_id,
        session_exercises!inner(
          id,
          cardio_sport,
          sportif_rpe,
          sportif_feedback_at,
          actual_distance_km,
          actual_duration_minutes,
          actual_pace_min_per_km,
          actual_avg_heart_rate
        ),
        training_weeks!inner(
          athlete_id,
          week_number,
          year
        )
      `)
      .eq("training_weeks.athlete_id", athleteId)
      .eq("session_exercises.cardio_sport", "course")
      .not("cardio_total_distance_km", "is", null);

    if (error) {
      console.error("Error loading cardio sessions:", error);
      setLoading(false);
      return;
    }

    // Traiter les données et grouper par semaine
    const weeklyData = new Map<string, CardioSessionData>();
    
    sessions?.forEach((session: any) => {
      const weekNumber = session.training_weeks.week_number;
      const year = session.training_weeks.year;
      const weekKey = `${year}-W${weekNumber.toString().padStart(2, '0')}`;

      // Données programmées (toujours incluses)
      const plannedDistance = session.cardio_total_distance_km || 0;
      const plannedDuration = session.cardio_total_duration_minutes || 0;
      const plannedIntensity = session.cardio_average_intensity || 0;

      // Vérifier si la séance est validée (a des données ET n'est pas skipped)
      const exercise = session.session_exercises?.[0];
      const isValidated = exercise && !exercise.skipped && (
        exercise.sportif_rpe !== null || 
        exercise.actual_distance_km !== null ||
        exercise.actual_duration_minutes !== null ||
        exercise.actual_pace_min_per_km !== null ||
        exercise.actual_avg_heart_rate !== null
      );

      // Données réalisées (seulement si validée)
      let actualDistance = 0;
      let actualDuration = 0;
      let actualIntensity = 0;
      let actualPace = 0;
      let actualHeartRate = 0;
      let actualRpe = 0;
      let validatedSessionsWithPace = 0;
      let validatedSessionsWithHR = 0;
      let validatedSessionsWithRpe = 0;
      
      if (isValidated) {
        // Prioriser les données réelles saisies par le sportif
        actualDistance = exercise.actual_distance_km || plannedDistance;
        actualDuration = exercise.actual_duration_minutes || plannedDuration;
        actualIntensity = plannedIntensity; // L'intensité reste celle programmée sauf si calculée autrement
        
        if (exercise.actual_pace_min_per_km) {
          actualPace = exercise.actual_pace_min_per_km;
          validatedSessionsWithPace = 1;
        }
        if (exercise.actual_avg_heart_rate) {
          actualHeartRate = exercise.actual_avg_heart_rate;
          validatedSessionsWithHR = 1;
        }
        if (exercise.sportif_rpe) {
          actualRpe = exercise.sportif_rpe;
          validatedSessionsWithRpe = 1;
        }
      }

      if (weeklyData.has(weekKey)) {
        const existing = weeklyData.get(weekKey)!;
        
        // Cumuler les données programmées
        existing.plannedDistanceKm += plannedDistance;
        existing.plannedDurationMinutes += plannedDuration;
        const totalPlannedDuration = existing.plannedDurationMinutes;
        existing.plannedAverageIntensity = Math.round(
          ((existing.plannedAverageIntensity * (totalPlannedDuration - plannedDuration)) + (plannedIntensity * plannedDuration)) / totalPlannedDuration
        );
        existing.plannedSessionCount++;

        // Cumuler les données réalisées
        if (isValidated) {
          existing.actualDistanceKm += actualDistance;
          existing.actualDurationMinutes += actualDuration;
          const totalActualDuration = existing.actualDurationMinutes;
          if (totalActualDuration > 0) {
            existing.actualAverageIntensity = Math.round(
              ((existing.actualAverageIntensity * (totalActualDuration - actualDuration)) + (actualIntensity * actualDuration)) / totalActualDuration
            );
          }
          existing.actualSessionCount++;
          
          // Cumuler allure moyenne
          if (actualPace > 0) {
            const currentPaceCount = existing.actualAveragePace ? existing.actualSessionCount - 1 : 0;
            const currentPaceSum = (existing.actualAveragePace || 0) * currentPaceCount;
            existing.actualAveragePace = (currentPaceSum + actualPace) / (currentPaceCount + 1);
          }
          
          // Cumuler FC moyenne
          if (actualHeartRate > 0) {
            const currentHRCount = existing.actualAverageHeartRate ? existing.actualSessionCount - 1 : 0;
            const currentHRSum = (existing.actualAverageHeartRate || 0) * currentHRCount;
            existing.actualAverageHeartRate = Math.round((currentHRSum + actualHeartRate) / (currentHRCount + 1));
          }
          
          // Cumuler RPE moyen
          if (actualRpe > 0) {
            const currentRpeCount = existing.actualAverageRpe ? existing.actualSessionCount - 1 : 0;
            const currentRpeSum = (existing.actualAverageRpe || 0) * currentRpeCount;
            existing.actualAverageRpe = Math.round((currentRpeSum + actualRpe) / (currentRpeCount + 1));
          }
        }
      } else {
        weeklyData.set(weekKey, {
          week: weekKey,
          weekNumber,
          year,
          plannedDistanceKm: plannedDistance,
          plannedDurationMinutes: plannedDuration,
          plannedAverageIntensity: plannedIntensity,
          plannedSessionCount: 1,
          actualDistanceKm: actualDistance,
          actualDurationMinutes: actualDuration,
          actualAverageIntensity: actualIntensity,
          actualSessionCount: isValidated ? 1 : 0,
          actualAveragePace: actualPace > 0 ? actualPace : null,
          actualAverageHeartRate: actualHeartRate > 0 ? actualHeartRate : null,
          actualAverageRpe: actualRpe > 0 ? actualRpe : null
        });
      }
    });

    // Convertir en tableau et trier par semaine
    const sortedWeeklyData = Array.from(weeklyData.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.weekNumber - b.weekNumber;
    });

    setCardioSessions(sortedWeeklyData);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (cardioSessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Activity className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium">Aucune séance de course à pied</p>
        <p className="text-sm text-muted-foreground mt-2">
          Les séances de course de {athleteName} apparaîtront ici
        </p>
      </div>
    );
  }

  const totalPlannedDistance = cardioSessions.reduce((sum, s) => sum + s.plannedDistanceKm, 0);
  const totalPlannedDuration = cardioSessions.reduce((sum, s) => sum + s.plannedDurationMinutes, 0);
  const totalActualDistance = cardioSessions.reduce((sum, s) => sum + s.actualDistanceKm, 0);
  const totalActualDuration = cardioSessions.reduce((sum, s) => sum + s.actualDurationMinutes, 0);
  const totalWeeks = cardioSessions.length;
  const avgPlannedIntensity = cardioSessions.reduce((sum, s) => sum + s.plannedAverageIntensity, 0) / totalWeeks;
  const avgActualIntensity = cardioSessions.reduce((sum, s) => sum + s.actualAverageIntensity, 0) / totalWeeks;

  // Calculer les métriques de la semaine précédente pour comparaison
  const lastWeek = cardioSessions[cardioSessions.length - 1];
  const previousWeek = cardioSessions[cardioSessions.length - 2];
  
  const calculatePercentChange = (current: number, previous: number): { value: number; isIncrease: boolean } => {
    if (!previous || previous === 0) return { value: 0, isIncrease: true };
    const percentChange = ((current - previous) / previous) * 100;
    return { value: Math.abs(percentChange), isIncrease: percentChange >= 0 };
  };

  // Calculer le pourcentage entre km réalisés semaine précédente et km programmés semaine actuelle
  const distanceChangeVsPlanned = previousWeek && plannedVolume && previousWeek.actualDistanceKm > 0
    ? {
        value: Math.abs(((plannedVolume.distanceKm - previousWeek.actualDistanceKm) / previousWeek.actualDistanceKm) * 100),
        isIncrease: plannedVolume.distanceKm >= previousWeek.actualDistanceKm
      }
    : null;

  const durationChange = previousWeek ? calculatePercentChange(lastWeek.actualDurationMinutes, previousWeek.actualDurationMinutes) : null;
  const intensityChange = previousWeek ? calculatePercentChange(lastWeek.actualAverageIntensity, previousWeek.actualAverageIntensity) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Suivi de course - {athleteName}</h2>
      </div>

      {/* Volume prévu cette semaine */}
      {plannedVolume && (
        <Card className="bg-muted/50 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Volume prévu cette semaine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-sm">Séances</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Distance totale</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Durée totale</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Intensité moyenne</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-3 px-4 text-lg font-bold">{plannedVolume.sessionCount}</td>
                    <td className="py-3 px-4 text-lg font-bold">{plannedVolume.distanceKm.toFixed(1)} km</td>
                    <td className="py-3 px-4 text-lg font-bold">
                      {Math.floor(plannedVolume.durationMinutes / 60)}h{(plannedVolume.durationMinutes % 60).toString().padStart(2, '0')}
                    </td>
                    <td className="py-3 px-4 text-lg font-bold">{plannedVolume.averageIntensity}% VMA</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistiques globales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Semaines d'entraînement</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWeeks}</div>
            <p className="text-xs text-muted-foreground">
              Total de semaines complétées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Distance totale</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalActualDistance.toFixed(1)} km</div>
            <p className="text-xs text-muted-foreground">
              Réalisé · Prévu: {totalPlannedDistance.toFixed(1)} km
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Durée totale</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {Math.floor(totalActualDuration / 60)}h{(totalActualDuration % 60).toString().padStart(2, '0')}
            </div>
            <p className="text-xs text-muted-foreground">
              Réalisé · Prévu: {Math.floor(totalPlannedDuration / 60)}h{(totalPlannedDuration % 60).toString().padStart(2, '0')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Intensité moyenne</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{Math.round(avgActualIntensity)}% VMA</div>
            <p className="text-xs text-muted-foreground">
              Réalisé · Prévu: {Math.round(avgPlannedIntensity)}% VMA
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distance par semaine</CardTitle>
            {distanceChangeVsPlanned && (
              <p className="text-sm text-muted-foreground mt-1">
                Semaine précédente : {previousWeek!.actualDistanceKm.toFixed(1)} km
                <span className={distanceChangeVsPlanned.isIncrease ? "text-green-600 ml-2" : "text-red-600 ml-2"}>
                  {distanceChangeVsPlanned.isIncrease ? "↑" : "↓"} {distanceChangeVsPlanned.value.toFixed(1)}%
                </span>
              </p>
            )}
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cardioSessions} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="week" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium mb-2">{payload[0].payload.week}</p>
                          <p className="text-sm text-yellow-600">
                            Programmée: {payload[0].payload.plannedDistanceKm.toFixed(1)} km
                          </p>
                          <p className="text-sm text-green-600">
                            Réalisée: {payload[0].payload.actualDistanceKm.toFixed(1)} km
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="plannedDistanceKm" fill="hsl(48 100% 50%)" name="Programmée (km)" />
                <Bar dataKey="actualDistanceKm" fill="hsl(142 71% 45%)" name="Réalisée (km)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Durée par semaine</CardTitle>
            {lastWeek && previousWeek && durationChange && (
              <p className="text-sm text-muted-foreground mt-1">
                Semaine précédente : {Math.floor(previousWeek.actualDurationMinutes / 60)}h{(previousWeek.actualDurationMinutes % 60).toString().padStart(2, '0')}
                <span className={durationChange.isIncrease ? "text-green-600 ml-2" : "text-red-600 ml-2"}>
                  {durationChange.isIncrease ? "↑" : "↓"} {durationChange.value.toFixed(1)}%
                </span>
              </p>
            )}
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cardioSessions} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="week" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const plannedMinutes = payload[0].payload.plannedDurationMinutes;
                      const actualMinutes = payload[0].payload.actualDurationMinutes;
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium mb-2">{payload[0].payload.week}</p>
                          <p className="text-sm text-yellow-600">
                            Programmée: {Math.floor(plannedMinutes / 60)}h{(plannedMinutes % 60).toString().padStart(2, '0')}
                          </p>
                          <p className="text-sm text-green-600">
                            Réalisée: {Math.floor(actualMinutes / 60)}h{(actualMinutes % 60).toString().padStart(2, '0')}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="plannedDurationMinutes" fill="hsl(48 100% 50%)" name="Programmée (min)" />
                <Bar dataKey="actualDurationMinutes" fill="hsl(142 71% 45%)" name="Réalisée (min)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Intensité moyenne par semaine</CardTitle>
            {lastWeek && previousWeek && intensityChange && (
              <p className="text-sm text-muted-foreground mt-1">
                Semaine précédente : {previousWeek.actualAverageIntensity}% VMA
                <span className={intensityChange.isIncrease ? "text-green-600 ml-2" : "text-red-600 ml-2"}>
                  {intensityChange.isIncrease ? "↑" : "↓"} {intensityChange.value.toFixed(1)}%
                </span>
              </p>
            )}
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cardioSessions} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="week" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis domain={[0, 100]} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium mb-2">{payload[0].payload.week}</p>
                          <p className="text-sm text-yellow-600">
                            Programmée: {payload[0].payload.plannedAverageIntensity}% VMA
                          </p>
                          <p className="text-sm text-green-600">
                            Réalisée: {payload[0].payload.actualAverageIntensity}% VMA
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="plannedAverageIntensity" fill="hsl(48 100% 50%)" name="Programmée (% VMA)" />
                <Bar dataKey="actualAverageIntensity" fill="hsl(142 71% 45%)" name="Réalisée (% VMA)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques des retours sportif */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Allure moyenne par semaine</CardTitle>
            <p className="text-sm text-muted-foreground">Données saisies par le sportif</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={cardioSessions.filter(s => s.actualAveragePace)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="week" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  domain={['dataMin - 0.5', 'dataMax + 0.5']}
                  tickFormatter={(value) => `${value.toFixed(2)}`}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const pace = payload[0].payload.actualAveragePace;
                      const minutes = Math.floor(pace);
                      const seconds = Math.round((pace - minutes) * 60);
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium mb-2">{payload[0].payload.week}</p>
                          <p className="text-sm text-blue-600">
                            Allure: {minutes}'{seconds.toString().padStart(2, '0')}/km
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="actualAveragePace" 
                  stroke="hsl(221 83% 53%)" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(221 83% 53%)', r: 4 }}
                  name="Allure (min/km)" 
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>FC moyenne par semaine</CardTitle>
            <p className="text-sm text-muted-foreground">Fréquence cardiaque moyenne</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={cardioSessions.filter(s => s.actualAverageHeartRate)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="week" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis domain={['dataMin - 10', 'dataMax + 10']} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium mb-2">{payload[0].payload.week}</p>
                          <p className="text-sm text-red-600">
                            FC moy: {payload[0].payload.actualAverageHeartRate} bpm
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="actualAverageHeartRate" 
                  stroke="hsl(0 84% 60%)" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(0 84% 60%)', r: 4 }}
                  name="FC moy (bpm)" 
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>RPE moyen par semaine</CardTitle>
            <p className="text-sm text-muted-foreground">Effort perçu</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={cardioSessions.filter(s => s.actualAverageRpe)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="week" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis domain={[0, 10]} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium mb-2">{payload[0].payload.week}</p>
                          <p className="text-sm text-purple-600">
                            RPE moy: {payload[0].payload.actualAverageRpe}/10
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="actualAverageRpe" 
                  stroke="hsl(280 87% 65%)" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(280 87% 65%)', r: 4 }}
                  name="RPE moyen" 
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
