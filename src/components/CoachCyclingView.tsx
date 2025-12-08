import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Bike, Clock, MapPin, TrendingUp, Calendar } from "lucide-react";
import { getWeekNumber } from "@/lib/weekUtils";

interface CardioSessionData {
  week: string;
  weekNumber: number;
  year: number;
  plannedDurationMinutes: number;
  plannedDistanceKm: number;
  plannedAverageIntensity: number;
  plannedSessionCount: number;
  actualDurationMinutes: number;
  actualDistanceKm: number;
  actualAverageIntensity: number;
  actualSessionCount: number;
  actualAverageSpeed: number | null;
  actualAverageHeartRate: number | null;
  actualAverageRpe: number | null;
}

interface PlannedVolume {
  durationMinutes: number;
  distanceKm: number;
  averageIntensity: number;
  sessionCount: number;
}

interface CoachCyclingViewProps {
  athleteId: string;
  athleteName: string;
}

export function CoachCyclingView({ athleteId, athleteName }: CoachCyclingViewProps) {
  const [loading, setLoading] = useState(true);
  const [cardioSessions, setCardioSessions] = useState<CardioSessionData[]>([]);
  const [plannedVolume, setPlannedVolume] = useState<PlannedVolume | null>(null);

  useEffect(() => {
    loadData();
  }, [athleteId]);

  const loadPlannedVolume = async (athleteId: string) => {
    const now = new Date();
    const currentWeekNumber = getWeekNumber(now);
    const currentYear = now.getFullYear();

    try {
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
        .eq('session_exercises.cardio_sport', 'velo')
        .not('cardio_total_distance_km', 'is', null);

      if (error) {
        console.error("Error loading planned cycling sessions:", error);
        return;
      }

      if (!sessions || sessions.length === 0) {
        setPlannedVolume(null);
        return;
      }

      const totalDistance = sessions.reduce((sum, session) => 
        sum + (session.cardio_total_distance_km || 0), 0
      );
      
      const totalDuration = sessions.reduce((sum, session) => 
        sum + (session.cardio_total_duration_minutes || 0), 0
      );

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
      console.error('Erreur lors du chargement du volume prévu vélo:', error);
      setPlannedVolume(null);
    }
  };

  const loadData = async () => {
    setLoading(true);

    await loadPlannedVolume(athleteId);

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
      .eq("session_exercises.cardio_sport", "velo")
      .not("cardio_total_distance_km", "is", null);

    if (error) {
      console.error("Error loading cycling sessions:", error);
      setLoading(false);
      return;
    }

    const weeklyData = new Map<string, CardioSessionData>();
    
    sessions?.forEach((session: any) => {
      const weekNumber = session.training_weeks.week_number;
      const year = session.training_weeks.year;
      const weekKey = `${year}-W${weekNumber.toString().padStart(2, '0')}`;

      const plannedDistance = session.cardio_total_distance_km || 0;
      const plannedDuration = session.cardio_total_duration_minutes || 0;
      const plannedIntensity = session.cardio_average_intensity || 0;

      const exercise = session.session_exercises?.[0];
      const isValidated = exercise && !exercise.skipped && (
        exercise.sportif_rpe !== null || 
        exercise.actual_distance_km !== null ||
        exercise.actual_duration_minutes !== null ||
        exercise.actual_avg_heart_rate !== null
      );

      let actualDistance = 0;
      let actualDuration = 0;
      let actualIntensity = 0;
      let actualSpeed = 0;
      let actualHeartRate = 0;
      let actualRpe = 0;
      
      if (isValidated) {
        actualDistance = exercise.actual_distance_km || plannedDistance;
        actualDuration = exercise.actual_duration_minutes || plannedDuration;
        actualIntensity = plannedIntensity;
        
        // Calculer vitesse moyenne en km/h si on a distance et durée
        if (actualDistance > 0 && actualDuration > 0) {
          actualSpeed = (actualDistance / actualDuration) * 60;
        }
        if (exercise.actual_avg_heart_rate) {
          actualHeartRate = exercise.actual_avg_heart_rate;
        }
        if (exercise.sportif_rpe) {
          actualRpe = exercise.sportif_rpe;
        }
      }

      if (weeklyData.has(weekKey)) {
        const existing = weeklyData.get(weekKey)!;
        
        existing.plannedDistanceKm += plannedDistance;
        existing.plannedDurationMinutes += plannedDuration;
        const totalPlannedDuration = existing.plannedDurationMinutes;
        existing.plannedAverageIntensity = Math.round(
          ((existing.plannedAverageIntensity * (totalPlannedDuration - plannedDuration)) + (plannedIntensity * plannedDuration)) / totalPlannedDuration
        );
        existing.plannedSessionCount++;

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
          
          if (actualSpeed > 0) {
            const currentSpeedCount = existing.actualAverageSpeed ? existing.actualSessionCount - 1 : 0;
            const currentSpeedSum = (existing.actualAverageSpeed || 0) * currentSpeedCount;
            existing.actualAverageSpeed = (currentSpeedSum + actualSpeed) / (currentSpeedCount + 1);
          }
          
          if (actualHeartRate > 0) {
            const currentHRCount = existing.actualAverageHeartRate ? existing.actualSessionCount - 1 : 0;
            const currentHRSum = (existing.actualAverageHeartRate || 0) * currentHRCount;
            existing.actualAverageHeartRate = Math.round((currentHRSum + actualHeartRate) / (currentHRCount + 1));
          }
          
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
          actualAverageSpeed: actualSpeed > 0 ? actualSpeed : null,
          actualAverageHeartRate: actualHeartRate > 0 ? actualHeartRate : null,
          actualAverageRpe: actualRpe > 0 ? actualRpe : null
        });
      }
    });

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
        <Bike className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium">Aucune séance de vélo</p>
        <p className="text-sm text-muted-foreground mt-2">
          Les séances de vélo de {athleteName} apparaîtront ici
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

  const lastWeek = cardioSessions[cardioSessions.length - 1];
  const previousWeek = cardioSessions[cardioSessions.length - 2];

  const distanceChangeVsPlanned = lastWeek && previousWeek && previousWeek.actualDistanceKm > 0
    ? {
        value: Math.abs(((lastWeek.plannedDistanceKm - previousWeek.actualDistanceKm) / previousWeek.actualDistanceKm) * 100),
        isIncrease: lastWeek.plannedDistanceKm >= previousWeek.actualDistanceKm
      }
    : null;

  const durationChangeVsPlanned = lastWeek && previousWeek && previousWeek.actualDurationMinutes > 0
    ? {
        value: Math.abs(((lastWeek.plannedDurationMinutes - previousWeek.actualDurationMinutes) / previousWeek.actualDurationMinutes) * 100),
        isIncrease: lastWeek.plannedDurationMinutes >= previousWeek.actualDurationMinutes
      }
    : null;

  const intensityChangeVsPlanned = lastWeek && previousWeek && previousWeek.actualAverageIntensity > 0
    ? {
        value: Math.abs(((lastWeek.plannedAverageIntensity - previousWeek.actualAverageIntensity) / previousWeek.actualAverageIntensity) * 100),
        isIncrease: lastWeek.plannedAverageIntensity >= previousWeek.actualAverageIntensity
      }
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Suivi vélo - {athleteName}</h2>
      </div>

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
                    <td className="py-3 px-4 text-lg font-bold">{plannedVolume.averageIntensity}% RPE</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Semaines d'entraînement</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWeeks}</div>
            <p className="text-xs text-muted-foreground">Total de semaines</p>
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
            <div className="text-2xl font-bold text-green-600">{Math.round(avgActualIntensity)}% RPE</div>
            <p className="text-xs text-muted-foreground">
              Réalisé · Prévu: {Math.round(avgPlannedIntensity)}% RPE
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distance par semaine</CardTitle>
            {distanceChangeVsPlanned && previousWeek && (
              <p className="text-sm text-muted-foreground mt-1">
                {previousWeek.actualDistanceKm.toFixed(1)} km réalisé ({previousWeek.week}) vs {lastWeek.plannedDistanceKm.toFixed(1)} km programmé ({lastWeek.week})
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
                <XAxis dataKey="week" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium mb-2">{payload[0].payload.week}</p>
                          <p className="text-sm text-yellow-600">Programmée: {payload[0].payload.plannedDistanceKm.toFixed(1)} km</p>
                          <p className="text-sm text-green-600">Réalisée: {payload[0].payload.actualDistanceKm.toFixed(1)} km</p>
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
            {durationChangeVsPlanned && previousWeek && (
              <p className="text-sm text-muted-foreground mt-1">
                {Math.floor(previousWeek.actualDurationMinutes / 60)}h{(previousWeek.actualDurationMinutes % 60).toString().padStart(2, '0')} réalisé vs {Math.floor(lastWeek.plannedDurationMinutes / 60)}h{(lastWeek.plannedDurationMinutes % 60).toString().padStart(2, '0')} programmé
                <span className={durationChangeVsPlanned.isIncrease ? "text-green-600 ml-2" : "text-red-600 ml-2"}>
                  {durationChangeVsPlanned.isIncrease ? "↑" : "↓"} {durationChangeVsPlanned.value.toFixed(1)}%
                </span>
              </p>
            )}
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cardioSessions} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const plannedMinutes = payload[0].payload.plannedDurationMinutes;
                      const actualMinutes = payload[0].payload.actualDurationMinutes;
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium mb-2">{payload[0].payload.week}</p>
                          <p className="text-sm text-yellow-600">Programmée: {Math.floor(plannedMinutes / 60)}h{(plannedMinutes % 60).toString().padStart(2, '0')}</p>
                          <p className="text-sm text-green-600">Réalisée: {Math.floor(actualMinutes / 60)}h{(actualMinutes % 60).toString().padStart(2, '0')}</p>
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
            {intensityChangeVsPlanned && previousWeek && (
              <p className="text-sm text-muted-foreground mt-1">
                {previousWeek.actualAverageIntensity}% RPE réalisé vs {lastWeek.plannedAverageIntensity}% RPE programmé
                <span className={intensityChangeVsPlanned.isIncrease ? "text-green-600 ml-2" : "text-red-600 ml-2"}>
                  {intensityChangeVsPlanned.isIncrease ? "↑" : "↓"} {intensityChangeVsPlanned.value.toFixed(1)}%
                </span>
              </p>
            )}
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cardioSessions} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
                <YAxis domain={[0, 100]} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium mb-2">{payload[0].payload.week}</p>
                          <p className="text-sm text-yellow-600">Programmée: {payload[0].payload.plannedAverageIntensity}% RPE</p>
                          <p className="text-sm text-green-600">Réalisée: {payload[0].payload.actualAverageIntensity}% RPE</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="plannedAverageIntensity" fill="hsl(48 100% 50%)" name="Programmée (% RPE)" />
                <Bar dataKey="actualAverageIntensity" fill="hsl(142 71% 45%)" name="Réalisée (% RPE)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Vitesse moyenne par semaine</CardTitle>
            <p className="text-sm text-muted-foreground">Données saisies par le sportif</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={cardioSessions.filter(s => s.actualAverageSpeed)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium mb-2">{payload[0].payload.week}</p>
                          <p className="text-sm text-blue-600">Vitesse: {payload[0].payload.actualAverageSpeed?.toFixed(1)} km/h</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="actualAverageSpeed" stroke="hsl(221 83% 53%)" strokeWidth={2} dot={{ fill: 'hsl(221 83% 53%)', r: 4 }} name="Vitesse (km/h)" />
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
                <XAxis dataKey="week" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
                <YAxis domain={['dataMin - 10', 'dataMax + 10']} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium mb-2">{payload[0].payload.week}</p>
                          <p className="text-sm text-red-600">FC moy: {payload[0].payload.actualAverageHeartRate} bpm</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="actualAverageHeartRate" stroke="hsl(0 84% 60%)" strokeWidth={2} dot={{ fill: 'hsl(0 84% 60%)', r: 4 }} name="FC moy (bpm)" />
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
                <XAxis dataKey="week" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
                <YAxis domain={[0, 10]} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium mb-2">{payload[0].payload.week}</p>
                          <p className="text-sm text-purple-600">RPE moy: {payload[0].payload.actualAverageRpe}/10</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="actualAverageRpe" stroke="hsl(280 87% 65%)" strokeWidth={2} dot={{ fill: 'hsl(280 87% 65%)', r: 4 }} name="RPE moyen" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
