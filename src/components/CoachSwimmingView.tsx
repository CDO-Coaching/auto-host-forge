import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LabelList } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Waves, Clock, MapPin, TrendingUp, Calendar } from "lucide-react";
import { InfoButton } from "@/components/InfoButton";
import { getWeekNumber, getWeekYear, getDateFromWeekNumber } from "@/lib/weekUtils";
import { parsePaceToDecimal, calculateCardioMetrics } from "@/lib/cardioCalculations";
import { CardioData } from "@/components/CardioStepBuilder";

interface IntensityZones {
  zoneLow: number;
  zoneMid: number;
  zoneHigh: number;
}

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
  actualAveragePace: number | null;
  actualAverageHeartRate: number | null;
  actualAverageRpe: number | null;
  intensityZones: IntensityZones;
  actualLoadUA: number;
  edwardsLoad: number;
  // Sessions avec RPE renseigné (pour fiabilité)
  actualSessionsWithRpe: number;
}

interface PlannedVolume {
  durationMinutes: number;
  distanceKm: number;
  averageIntensity: number;
  sessionCount: number;
}

interface CoachSwimmingViewProps {
  athleteId: string;
  athleteName: string;
}

export function CoachSwimmingView({ athleteId, athleteName }: CoachSwimmingViewProps) {
  const [loading, setLoading] = useState(true);
  const [cardioSessions, setCardioSessions] = useState<CardioSessionData[]>([]);
  const [plannedVolume, setPlannedVolume] = useState<PlannedVolume | null>(null);

  useEffect(() => {
    loadData();
  }, [athleteId]);

  const loadPlannedVolume = async (athleteId: string) => {
    const now = new Date();
    const currentWeekNumber = getWeekNumber(now);
    const currentYear = getWeekYear(now);

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
        .eq('session_exercises.cardio_sport', 'natation')
        .not('cardio_total_distance_km', 'is', null);

      if (error) {
        console.error("Error loading planned swimming sessions:", error);
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
      console.error('Erreur lors du chargement du volume prévu natation:', error);
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
          cardio_content,
          sportif_rpe,
          sportif_feedback_at,
          actual_distance_km,
          actual_duration_minutes,
          actual_pace_min_per_km,
          actual_avg_heart_rate,
          actual_heart_rate_zones
        ),
        training_weeks!inner(
          athlete_id,
          week_number,
          year
        )
      `)
      .eq("training_weeks.athlete_id", athleteId)
      .eq("session_exercises.cardio_sport", "natation")
      .not("cardio_total_distance_km", "is", null);

    if (error) {
      console.error("Error loading swimming sessions:", error);
      setLoading(false);
      return;
    }

    const weeklyData = new Map<string, CardioSessionData>();
    
    sessions?.forEach((session: any) => {
      const weekNumber = session.training_weeks.week_number;
      const dbYear = session.training_weeks.year;
      
      // Recalculer l'année ISO correcte pour cette semaine
      const dateForWeek = getDateFromWeekNumber(weekNumber, dbYear);
      const isoYear = getWeekYear(dateForWeek);
      
      const weekKey = `${isoYear}-W${weekNumber.toString().padStart(2, '0')}`;

      let computedPlannedDistance = 0;
      let computedPlannedDuration = 0;
      let computedIntensityWeighted = 0;
      let computedDurationForIntensity = 0;
      (session.session_exercises || []).forEach((ex: any) => {
        if (ex.cardio_sport !== "natation" || !ex.cardio_content) return;
        try {
          const cardioData = JSON.parse(ex.cardio_content) as CardioData;
          const m = calculateCardioMetrics(cardioData, null);
          computedPlannedDistance += m.totalDistanceKm;
          computedPlannedDuration += m.totalDurationMinutes;
          if (m.averageIntensity > 0) {
            computedIntensityWeighted += m.averageIntensity * m.totalDurationMinutes;
            computedDurationForIntensity += m.totalDurationMinutes;
          }
        } catch (_) {}
      });
      const plannedDistance = computedPlannedDistance > 0 ? computedPlannedDistance : (session.cardio_total_distance_km || 0);
      const plannedDuration = computedPlannedDuration > 0 ? computedPlannedDuration : (session.cardio_total_duration_minutes || 0);
      const plannedIntensity = computedDurationForIntensity > 0
        ? Math.round(computedIntensityWeighted / computedDurationForIntensity)
        : (session.cardio_average_intensity || 0);

      const exerciseWithData = session.session_exercises?.find((ex: any) =>
        ex.actual_distance_km !== null ||
        ex.actual_duration_minutes !== null ||
        ex.actual_avg_heart_rate !== null ||
        ex.sportif_rpe !== null
      ) || session.session_exercises?.[0];
      const exercise = exerciseWithData;
      const isValidated = exercise && !exercise.skipped && (
        exercise.sportif_rpe !== null ||
        exercise.actual_distance_km !== null ||
        exercise.actual_duration_minutes !== null ||
        exercise.actual_avg_heart_rate !== null
      );

      let actualDistance = 0;
      let actualDuration = 0;
      let actualIntensity = 0;
      let actualPace = 0;
      let actualHeartRate = 0;
      let actualRpe = 0;

      if (isValidated) {
        actualDistance = exercise.actual_distance_km ?? 0;
        actualDuration = exercise.actual_duration_minutes ?? 0;
        actualIntensity = plannedIntensity;
        
        if (exercise.actual_pace_min_per_km) {
          const parsedPace = parsePaceToDecimal(exercise.actual_pace_min_per_km);
          if (parsedPace !== null) {
            actualPace = parsedPace;
          }
        }
        if (exercise.actual_avg_heart_rate) {
          actualHeartRate = exercise.actual_avg_heart_rate;
        }
        if (exercise.sportif_rpe) {
          actualRpe = exercise.sportif_rpe;
        }
      }

      // Compute Edwards score from actual_heart_rate_zones
      let edwardsScore = 0;
      if (exercise?.actual_heart_rate_zones && Array.isArray(exercise.actual_heart_rate_zones)) {
        for (const zone of exercise.actual_heart_rate_zones) {
          const minutes = (zone.time_seconds || 0) / 60;
          const multiplier = zone.zone;
          edwardsScore += minutes * multiplier;
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
          
          if (actualPace > 0) {
            const currentPaceCount = existing.actualAveragePace ? existing.actualSessionCount - 1 : 0;
            const currentPaceSum = (existing.actualAveragePace || 0) * currentPaceCount;
            existing.actualAveragePace = (currentPaceSum + actualPace) / (currentPaceCount + 1);
          }
          
          if (actualHeartRate > 0) {
            const currentHRCount = existing.actualAverageHeartRate ? existing.actualSessionCount - 1 : 0;
            const currentHRSum = (existing.actualAverageHeartRate || 0) * currentHRCount;
            existing.actualAverageHeartRate = Math.round((currentHRSum + actualHeartRate) / (currentHRCount + 1));
          }

          // Zone basée sur intensité VMA programmée
          const sessionDuration = actualDuration || plannedDuration;
          if (plannedIntensity < 70) {
            existing.intensityZones.zoneLow += sessionDuration;
          } else if (plannedIntensity <= 90) {
            existing.intensityZones.zoneMid += sessionDuration;
          } else {
            existing.intensityZones.zoneHigh += sessionDuration;
          }
          
          if (actualRpe > 0) {
            const currentRpeCount = existing.actualAverageRpe ? existing.actualSessionCount - 1 : 0;
            const currentRpeSum = (existing.actualAverageRpe || 0) * currentRpeCount;
            existing.actualAverageRpe = Math.round((currentRpeSum + actualRpe) / (currentRpeCount + 1));
          }

          // Charge sRPE
          if (actualDuration > 0 && actualRpe > 0) {
            existing.actualLoadUA += actualDuration * actualRpe;
            existing.actualSessionsWithRpe++;
          }

          // Charge Edwards
          if (edwardsScore > 0) existing.edwardsLoad += edwardsScore;
        }
      } else {
        const intensityZones: IntensityZones = { zoneLow: 0, zoneMid: 0, zoneHigh: 0 };
        if (isValidated) {
          const sessionDuration = actualDuration || plannedDuration;
          if (plannedIntensity < 70) {
            intensityZones.zoneLow = sessionDuration;
          } else if (plannedIntensity <= 90) {
            intensityZones.zoneMid = sessionDuration;
          } else {
            intensityZones.zoneHigh = sessionDuration;
          }
        }

        weeklyData.set(weekKey, {
          week: weekKey, weekNumber, year: isoYear,
          plannedDistanceKm: plannedDistance, plannedDurationMinutes: plannedDuration,
          plannedAverageIntensity: plannedIntensity, plannedSessionCount: 1,
          actualDistanceKm: actualDistance, actualDurationMinutes: actualDuration,
          actualAverageIntensity: actualIntensity, actualSessionCount: isValidated ? 1 : 0,
          actualAveragePace: actualPace > 0 ? actualPace : null,
          actualAverageHeartRate: actualHeartRate > 0 ? actualHeartRate : null,
          actualAverageRpe: actualRpe > 0 ? actualRpe : null,
          intensityZones,
          actualLoadUA: (isValidated && actualDuration > 0 && actualRpe > 0) ? actualDuration * actualRpe : 0,
          edwardsLoad: edwardsScore,
          actualSessionsWithRpe: (isValidated && actualRpe > 0) ? 1 : 0,
        });
      }
    });

    // Séances perso natation
    const { data: customData } = await supabase
      .from("custom_sessions")
      .select("id, session_name, duration_minutes, completed_at, scheduled_date, distance_km, avg_pace, avg_heart_rate, cardio_type, session_rpe")
      .eq("user_id", athleteId)
      .eq("cardio_type", "natation")
      .not("completed_at", "is", null);

    (customData || []).forEach((cs: any) => {
      if (!cs.duration_minutes && !cs.distance_km) return;
      const dateStr = cs.completed_at ? cs.completed_at.split("T")[0] : cs.scheduled_date;
      if (!dateStr) return;
      const date = new Date(dateStr + "T12:00:00");
      const weekNumber = getWeekNumber(date);
      const isoYear = getWeekYear(date);
      const weekKey = `${isoYear}-W${weekNumber.toString().padStart(2, "0")}`;
      const dist = Number(cs.distance_km || 0);
      const dur = Number(cs.duration_minutes || 0);
      const rpe = cs.session_rpe ? Number(cs.session_rpe) : 0;
      const pace = cs.avg_pace ? parsePaceToDecimal(cs.avg_pace) : null;
      const hr = cs.avg_heart_rate ? Number(cs.avg_heart_rate) : 0;
      const loadUA = (dur > 0 && rpe > 0) ? dur * rpe : 0;

      if (weeklyData.has(weekKey)) {
        const existing = weeklyData.get(weekKey)!;
        existing.actualDistanceKm += dist;
        existing.actualDurationMinutes += dur;
        if (dur > 0) existing.actualSessionCount++;
        if (loadUA > 0) {
          existing.actualLoadUA += loadUA;
          existing.actualSessionsWithRpe++;
        }
        if (pace !== null && pace > 0) {
          const prevPace = existing.actualAveragePace ?? 0;
          const prevCount = existing.actualAveragePace ? existing.actualSessionCount - 1 : 0;
          existing.actualAveragePace = (prevPace * prevCount + pace) / (prevCount + 1);
        }
        if (hr > 0) {
          const prevHR = existing.actualAverageHeartRate ?? 0;
          const prevCount = existing.actualAverageHeartRate ? existing.actualSessionCount - 1 : 0;
          existing.actualAverageHeartRate = Math.round((prevHR * prevCount + hr) / (prevCount + 1));
        }
        if (rpe > 0) {
          const prevRpe = existing.actualAverageRpe ?? 0;
          const prevCount = existing.actualAverageRpe ? existing.actualSessionCount - 1 : 0;
          existing.actualAverageRpe = Math.round((prevRpe * prevCount + rpe) / (prevCount + 1));
        }
      } else {
        weeklyData.set(weekKey, {
          week: weekKey,
          weekNumber,
          year: isoYear,
          plannedDistanceKm: 0,
          plannedDurationMinutes: 0,
          plannedAverageIntensity: 0,
          plannedSessionCount: 0,
          actualDistanceKm: dist,
          actualDurationMinutes: dur,
          actualAverageIntensity: 0,
          actualSessionCount: dur > 0 ? 1 : 0,
          actualAveragePace: (pace !== null && pace > 0) ? pace : null,
          actualAverageHeartRate: hr > 0 ? hr : null,
          actualAverageRpe: rpe > 0 ? rpe : null,
          intensityZones: { zoneLow: 0, zoneMid: 0, zoneHigh: 0 },
          actualLoadUA: loadUA,
          edwardsLoad: 0,
          actualSessionsWithRpe: (loadUA > 0) ? 1 : 0,
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

  // Formater l'allure pour natation (min/100m)
  const formatSwimPace = (pacePerKm: number): string => {
    const pacePer100m = pacePerKm / 10;
    const minutes = Math.floor(pacePer100m);
    const seconds = Math.round((pacePer100m - minutes) * 60);
    return `${minutes}'${seconds.toString().padStart(2, '0')}/100m`;
  };

  // Formater distance en mètres pour natation
  const formatSwimDistance = (km: number): string => {
    const meters = km * 1000;
    if (meters >= 1000) {
      return `${km.toFixed(2)} km`;
    }
    return `${Math.round(meters)} m`;
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
        <Waves className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium">Aucune séance de natation</p>
        <p className="text-sm text-muted-foreground mt-2">
          Les séances de natation de {athleteName} apparaîtront ici
        </p>
      </div>
    );
  }

  const totalPlannedDistance = cardioSessions.reduce((sum, s) => sum + s.plannedDistanceKm, 0);
  const totalPlannedDuration = cardioSessions.reduce((sum, s) => sum + s.plannedDurationMinutes, 0);
  const totalActualDistance = cardioSessions.reduce((sum, s) => sum + s.actualDistanceKm, 0);
  const totalActualDuration = cardioSessions.reduce((sum, s) => sum + s.actualDurationMinutes, 0);
  const totalWeeks = cardioSessions.length;

  // A. Fiabilité RPE : % des séances validées avec RPE renseigné
  const totalValidatedSessions = cardioSessions.reduce((s, w) => s + w.actualSessionCount, 0);
  const totalSessionsWithRpe = cardioSessions.reduce((s, w) => s + w.actualSessionsWithRpe, 0);
  const rpeReliabilityPct = totalValidatedSessions > 0 ? Math.round((totalSessionsWithRpe / totalValidatedSessions) * 100) : 0;
  const rpeReliabilityLabel = rpeReliabilityPct >= 80 ? "good" : rpeReliabilityPct >= 50 ? "partial" : "poor";

  const avgPlannedIntensityRaw = totalWeeks > 0 ? cardioSessions.reduce((sum, s) => sum + s.plannedAverageIntensity, 0) / totalWeeks : 0;
  const avgPlannedIntensity = isNaN(avgPlannedIntensityRaw) ? 0 : avgPlannedIntensityRaw;
  const avgActualIntensityRaw = totalWeeks > 0 ? cardioSessions.reduce((sum, s) => sum + s.actualAverageIntensity, 0) / totalWeeks : 0;
  const avgActualIntensity = isNaN(avgActualIntensityRaw) ? 0 : avgActualIntensityRaw;

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Suivi natation - {athleteName}</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Distance par semaine
              <InfoButton text="Évolution des distances par semaine. Règle des 10% : ne pas augmenter de plus de 10%/semaine pour éviter les blessures." />
            </CardTitle>
            {distanceChangeVsPlanned && previousWeek && (
              <p className="text-sm text-muted-foreground mt-1">
                {formatSwimDistance(previousWeek.actualDistanceKm)} réalisé ({previousWeek.week}) vs {formatSwimDistance(lastWeek.plannedDistanceKm)} programmé ({lastWeek.week})
                <span className={distanceChangeVsPlanned.isIncrease ? "text-green-600 ml-2" : "text-red-600 ml-2"}>
                  {distanceChangeVsPlanned.isIncrease ? "↑" : "↓"} {distanceChangeVsPlanned.value.toFixed(1)}%
                </span>
              </p>
            )}
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={cardioSessions} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis tickFormatter={(value) => `${(value * 1000).toFixed(0)}m`} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium mb-2">{payload[0].payload.week}</p>
                          <p className="text-sm text-yellow-600">Programmée: {formatSwimDistance(payload[0].payload.plannedDistanceKm)}</p>
                          <p className="text-sm text-green-600">Réalisée: {formatSwimDistance(payload[0].payload.actualDistanceKm)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="plannedDistanceKm" fill="hsl(48 100% 50%)" name="Programmée (m)" />
                <Bar dataKey="actualDistanceKm" fill="hsl(142 71% 45%)" name="Réalisée (m)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Durée par semaine
              <InfoButton text="Cumul du temps de natation par semaine. Même règle des 10% que pour la distance." />
            </CardTitle>
            {durationChangeVsPlanned && previousWeek && (
              <p className="text-sm text-muted-foreground mt-1">
                {Math.floor(previousWeek.actualDurationMinutes / 60)}h{Math.round(previousWeek.actualDurationMinutes % 60).toString().padStart(2, '0')} réalisé vs {Math.floor(lastWeek.plannedDurationMinutes / 60)}h{Math.round(lastWeek.plannedDurationMinutes % 60).toString().padStart(2, '0')} programmé
                <span className={durationChangeVsPlanned.isIncrease ? "text-green-600 ml-2" : "text-red-600 ml-2"}>
                  {durationChangeVsPlanned.isIncrease ? "↑" : "↓"} {durationChangeVsPlanned.value.toFixed(1)}%
                </span>
              </p>
            )}
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={cardioSessions} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const plannedMinutes = payload[0].payload.plannedDurationMinutes;
                      const actualMinutes = payload[0].payload.actualDurationMinutes;
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium mb-2">{payload[0].payload.week}</p>
                          <p className="text-sm text-yellow-600">Programmée: {Math.floor(plannedMinutes / 60)}h{Math.round(plannedMinutes % 60).toString().padStart(2, '0')}</p>
                          <p className="text-sm text-green-600">Réalisée: {Math.floor(actualMinutes / 60)}h{Math.round(actualMinutes % 60).toString().padStart(2, '0')}</p>
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

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Allure moyenne par semaine
              <InfoButton text="Allure réalisée en natation (min/100m). Une allure plus rapide que prévue peut indiquer des zones sous-estimées ou que l'athlète force." />
            </CardTitle>
            <p className="text-sm text-muted-foreground">Données saisies par le sportif</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={cardioSessions.filter(s => s.actualAveragePace)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} tickFormatter={(value) => `${(value / 10).toFixed(1)}`} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const pace = payload[0].payload.actualAveragePace;
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium mb-2">{payload[0].payload.week}</p>
                          <p className="text-sm text-blue-600">Allure: {formatSwimPace(pace)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="actualAveragePace" stroke="hsl(221 83% 53%)" strokeWidth={2} dot={{ fill: 'hsl(221 83% 53%)', r: 4 }} name="Allure (min/100m)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              FC moyenne par semaine
              <InfoButton text="Fréquence cardiaque moyenne réalisée. Comparée à la FC max, elle indique l'intensité réelle de l'entraînement." />
            </CardTitle>
            <p className="text-sm text-muted-foreground">Fréquence cardiaque moyenne</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={cardioSessions.filter(s => s.actualAverageHeartRate)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis domain={['dataMin - 10', 'dataMax + 10']} />
                <RechartsTooltip
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
            <CardTitle className="flex items-center gap-2">
              RPE moyen par semaine
              <InfoButton text="Perception subjective de l'effort (1-10). < 6 = léger, 6-8 = modéré, > 8 = élevé. Fiable si l'athlète renseigne systématiquement après chaque séance." />
            </CardTitle>
            <p className="text-sm text-muted-foreground">Effort perçu</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={cardioSessions.filter(s => s.actualAverageRpe)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis domain={[0, 10]} />
                <RechartsTooltip
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

      {/* Charge sRPE hebdomadaire */}
      {(() => {
        const srpeData = cardioSessions.filter(s => s.actualLoadUA > 0);
        if (srpeData.length === 0) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 flex-wrap">
                Charge d'entraînement hebdo (sRPE)
                <InfoButton text="Charge = Σ(Durée × RPE) par séance. Méthode validée scientifiquement (Foster 2001). Zone cible : 800-1200 UA/semaine pour un athlète entraîné. ⚠️ Fiable uniquement si le RPE est renseigné après chaque séance." />
                <Badge className={
                  rpeReliabilityLabel === "good"
                    ? "bg-green-500/20 text-green-500 border-green-500/50 text-xs"
                    : rpeReliabilityLabel === "partial"
                      ? "bg-orange-500/20 text-orange-500 border-orange-500/50 text-xs"
                      : "bg-red-500/20 text-red-500 border-red-500/50 text-xs"
                }>
                  {rpeReliabilityPct >= 80 ? `✓ RPE fiable (${rpeReliabilityPct}%)` :
                   rpeReliabilityPct >= 50 ? `⚠ Partiel (${rpeReliabilityPct}%)` :
                   `✗ Insuffisant (${rpeReliabilityPct}%)`}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={srpeData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis label={{ value: "UA", angle: -90, position: "insideLeft", offset: 10 }} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-medium mb-2">{payload[0].payload.week}</p>
                            <p className="text-sm" style={{ color: "hsl(262 80% 60%)" }}>
                              Charge sRPE: {Math.round(payload[0].payload.actualLoadUA)} UA
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="actualLoadUA" fill="hsl(262 80% 60%)" name="Charge sRPE (UA)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })()}

      {/* Charge Edwards hebdomadaire */}
      {(() => {
        const edwardsData = cardioSessions.filter(s => s.edwardsLoad > 0);
        if (edwardsData.length === 0) {
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Charge Edwards (zones cardiaques)
                  <InfoButton text="Score basé sur le temps dans chaque zone cardiaque : Z1×1 + Z2×2 + Z3×3 + Z4×4 + Z5×5. Plus précis que le sRPE car objectif. Nécessite un capteur FC connecté à Strava." />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Connectez Strava pour voir la charge Edwards</p>
              </CardContent>
            </Card>
          );
        }
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Charge Edwards (zones cardiaques)
                <InfoButton text="Score basé sur le temps dans chaque zone cardiaque : Z1×1 + Z2×2 + Z3×3 + Z4×4 + Z5×5. Plus précis que le sRPE car objectif. Nécessite un capteur FC connecté à Strava." />
              </CardTitle>
              <p className="text-xs text-muted-foreground">Score = Σ(min en zone × multiplicateur : Z1×1, Z2×2, Z3×3, Z4×4, Z5×5)</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={edwardsData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-medium mb-2">{payload[0].payload.week}</p>
                            <p className="text-sm" style={{ color: "hsl(25 95% 53%)" }}>
                              Score Edwards: {Math.round(payload[0].payload.edwardsLoad)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="edwardsLoad" fill="hsl(25 95% 53%)" name="Charge Edwards" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })()}

      {/* Répartition des zones d'intensité par semaine */}
      {(() => {
        const filteredData = cardioSessions.filter(s => {
          const total = s.intensityZones.zoneLow + s.intensityZones.zoneMid + s.intensityZones.zoneHigh;
          return s.plannedAverageIntensity > 0 && total > 0;
        });
        if (filteredData.length === 0) return null;

        const zoneColors = { low: "#22c55e", mid: "#eab308", high: "#ef4444" };

        const stackedData = filteredData.map(week => {
          const total = week.intensityZones.zoneLow + week.intensityZones.zoneMid + week.intensityZones.zoneHigh;
          const avgIntensity = week.plannedAverageIntensity;
          const z1z2Ratio = total > 0 ? week.intensityZones.zoneLow / total : 0;
          const z3z4Ratio = total > 0 ? week.intensityZones.zoneMid / total : 0;
          const z5Ratio = total > 0 ? week.intensityZones.zoneHigh / total : 0;
          return {
            week: week.week,
            avgIntensity,
            z1z2Height: Math.round(z1z2Ratio * avgIntensity),
            z3z4Height: Math.round(z3z4Ratio * avgIntensity),
            z5Height: Math.round(z5Ratio * avgIntensity),
            z1z2Label: Math.round(z1z2Ratio * 100),
            z3z4Label: Math.round(z3z4Ratio * 100),
            z5Label: Math.round(z5Ratio * 100),
            zoneLowMinutes: week.intensityZones.zoneLow,
            zoneMidMinutes: week.intensityZones.zoneMid,
            zoneHighMinutes: week.intensityZones.zoneHigh,
            totalMinutes: total,
          };
        });

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Répartition des zones d'intensité par semaine
                <InfoButton text="Distribution idéale : 80% du temps en Z1-Z2 (vert) et 20% en Z3-Z5. Si trop de Z3-Z4 (jaune) = entraînement 'gris' risquant la fatigue chronique sans progression optimale." />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stackedData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }} barSize={30}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <RechartsTooltip content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium mb-2">{data.week} - Intensité moyenne: {data.avgIntensity}%</p>
                          <p className="text-sm text-muted-foreground mb-2">Temps total: {data.totalMinutes} min</p>
                          <p className="text-sm" style={{ color: zoneColors.low }}>Z1-Z2 (&lt;70%): {data.z1z2Label}% ({data.zoneLowMinutes} min)</p>
                          <p className="text-sm" style={{ color: zoneColors.mid }}>Z3-Z4 (70-90%): {data.z3z4Label}% ({data.zoneMidMinutes} min)</p>
                          <p className="text-sm" style={{ color: zoneColors.high }}>Z5 (&gt;90%): {data.z5Label}% ({data.zoneHighMinutes} min)</p>
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Legend content={() => (
                    <div className="flex flex-wrap justify-center gap-4 mt-2 text-xs">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: zoneColors.low }}></span>Z1-Z2 (&lt;70%)</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: zoneColors.mid }}></span>Z3-Z4 (70-90%)</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: zoneColors.high }}></span>Z5 (&gt;90%)</span>
                    </div>
                  )} />
                  <Bar dataKey="z1z2Height" stackId="zones" fill={zoneColors.low} name="Z1-Z2">
                    <LabelList dataKey="z1z2Label" position="center" fill="#fff" fontSize={10} fontWeight="bold" formatter={(value: number) => value > 10 ? `${value}%` : ''} />
                  </Bar>
                  <Bar dataKey="z3z4Height" stackId="zones" fill={zoneColors.mid} name="Z3-Z4">
                    <LabelList dataKey="z3z4Label" position="center" fill="#fff" fontSize={10} fontWeight="bold" formatter={(value: number) => value > 10 ? `${value}%` : ''} />
                  </Bar>
                  <Bar dataKey="z5Height" stackId="zones" fill={zoneColors.high} name="Z5" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="z5Label" position="center" fill="#fff" fontSize={10} fontWeight="bold" formatter={(value: number) => value > 10 ? `${value}%` : ''} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })()}

      {/* Volume prévu cette semaine (depuis la DB) */}
      {plannedVolume && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-yellow-500/5 border-yellow-500/20 col-span-2 md:col-span-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-yellow-600">
                <Calendar className="h-4 w-4" />
                Volume prévu cette semaine
                <InfoButton text="Données calculées depuis le programme de la semaine en cours. Permet d'anticiper la récupération et la nutrition." />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-yellow-500/5 border-yellow-500/20">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-yellow-600">Séances prévues</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{plannedVolume.sessionCount}</div><p className="text-xs text-muted-foreground">Cette semaine</p></CardContent>
          </Card>
          <Card className="bg-yellow-500/5 border-yellow-500/20">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-yellow-600">Distance prévue</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatSwimDistance(plannedVolume.distanceKm)}</div><p className="text-xs text-muted-foreground">Cette semaine</p></CardContent>
          </Card>
          <Card className="bg-yellow-500/5 border-yellow-500/20">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-yellow-600">Durée prévue</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{Math.floor(plannedVolume.durationMinutes / 60)}h{Math.round(plannedVolume.durationMinutes % 60).toString().padStart(2, '0')}</div><p className="text-xs text-muted-foreground">Cette semaine</p></CardContent>
          </Card>
          <Card className="bg-yellow-500/5 border-yellow-500/20">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-yellow-600">Intensité prévue</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{plannedVolume.averageIntensity}% RPE</div><p className="text-xs text-muted-foreground">Cette semaine</p></CardContent>
          </Card>
        </div>
      )}

      {/* Statistiques globales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              Semaines d'entraînement
              <InfoButton text="Nombre de semaines où au moins une séance a été validée par l'athlète." />
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWeeks}</div>
            <p className="text-xs text-muted-foreground">Total de semaines</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              Distance totale
              <InfoButton text="Total des distances réalisées depuis le début (en m ou km). Comparé au volume prévu pour mesurer l'adhérence au programme." />
            </CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatSwimDistance(totalActualDistance)}</div>
            <p className="text-xs text-muted-foreground">
              Réalisé · Prévu: {formatSwimDistance(totalPlannedDistance)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              Durée totale
              <InfoButton text="Temps total d'entraînement réalisé. Indicateur de volume global saison." />
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {Math.floor(totalActualDuration / 60)}h{Math.round(totalActualDuration % 60).toString().padStart(2, '0')}
            </div>
            <p className="text-xs text-muted-foreground">
              Réalisé · Prévu: {Math.floor(totalPlannedDuration / 60)}h{Math.round(totalPlannedDuration % 60).toString().padStart(2, '0')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              Intensité moyenne
              <InfoButton text="Moyenne pondérée par la durée des séances. Indicateur de l'intensité globale de la saison de natation." />
            </CardTitle>
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
    </div>
  );
}
