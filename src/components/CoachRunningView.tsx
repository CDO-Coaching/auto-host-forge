import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell, LabelList } from "recharts";
import { Badge } from "@/components/ui/badge";
import { formatCardioTime, formatCardioDistance, parsePaceToDecimal, calculateCardioMetrics } from "@/lib/cardioCalculations";
import { CardioData } from "@/components/CardioStepBuilder";
import { Activity, Clock, MapPin, TrendingUp, Calendar } from "lucide-react";
import { AerobicEfficiencyCard } from "@/components/AerobicEfficiencyCard";
import { InfoButton } from "@/components/InfoButton";
import { getWeekNumber, getWeekYear, getDateFromWeekNumber } from "@/lib/weekUtils";
import { isPlausibleDistanceKm, isPlausibleDurationMin } from "@/lib/sessionMetrics";

interface IntensityZones {
  zoneLow: number;  // < 70% - temps en minutes
  zoneMid: number;  // 70-90% - temps en minutes
  zoneHigh: number; // > 90% - temps en minutes
}

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
  // Temps passé dans chaque zone d'intensité
  intensityZones: IntensityZones;
  // Charge sRPE (Σ durée_min × RPE)
  actualLoadUA: number;
  // Charge Edwards (zones cardiaques)
  edwardsLoad: number;
  // Sessions avec RPE renseigné (pour fiabilité)
  actualSessionsWithRpe: number;
  // Flag pour indiquer si c'est la semaine en cours de programmation
  isProgramming?: boolean;
}

interface PlannedVolume {
  durationMinutes: number;
  distanceKm: number;
  averageIntensity: number;
  sessionCount: number;
}

// Interface pour les sessions en cours de programmation
interface ProgrammingSession {
  id: number;
  name: string;
  session_type: "renfo" | "cardio" | "recup";
}

interface ProgrammingExercise {
  cardio_sport?: "course" | "natation" | "velo" | "yoga" | "hiit" | "";
  cardio_content?: string;
}

interface CoachRunningViewProps {
  athleteId: string;
  athleteName: string;
  // Props optionnelles pour afficher les données en temps réel pendant la programmation
  programmingWeek?: { week: number; year: number } | null;
  programmingSessions?: ProgrammingSession[];
  programmingExercises?: Record<number, ProgrammingExercise[]>;
  athleteVmaOverride?: number | null;
}

export function CoachRunningView({ 
  athleteId, 
  athleteName,
  programmingWeek,
  programmingSessions,
  programmingExercises,
  athleteVmaOverride
}: CoachRunningViewProps) {
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
    const currentYear = getWeekYear(now);

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

    // Charger la VMA et FCmax de l'athlète
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
      const dbYear = session.training_weeks.year;
      
      // Recalculer l'année ISO correcte pour cette semaine
      // La semaine 1 qui commence fin décembre appartient à l'année suivante en ISO
      const dateForWeek = getDateFromWeekNumber(weekNumber, dbYear);
      const isoYear = getWeekYear(dateForWeek);
      
      const weekKey = `${isoYear}-W${weekNumber.toString().padStart(2, '0')}`;

      // Recalculer les métriques planifiées depuis les exercices (cardio_content)
      // pour éviter de lire cardio_total_duration_minutes qui peut avoir été
      // écrasé par Strava lors d'une liaison (bug antérieur, maintenant corrigé).
      // Utiliser la VMA locale (pas le state React qui est encore null au premier render)
      const vma = profileData?.vma || null;
      let computedPlannedDistance = 0;
      let computedPlannedDuration = 0;
      let computedIntensityWeighted = 0;
      let computedDurationForIntensity = 0;
      (session.session_exercises || []).forEach((ex: any) => {
        if (ex.cardio_sport !== "course" || !ex.cardio_content) return;
        try {
          const cardioData = JSON.parse(ex.cardio_content) as CardioData;
          const m = calculateCardioMetrics(cardioData, vma);
          computedPlannedDistance += m.totalDistanceKm;
          computedPlannedDuration += m.totalDurationMinutes;
          if (m.averageIntensity > 0) {
            computedIntensityWeighted += m.averageIntensity * m.totalDurationMinutes;
            computedDurationForIntensity += m.totalDurationMinutes;
          }
        } catch (_) { /* ignorer les erreurs de parsing */ }
      });
      // Fallback sur les valeurs DB si aucun cardio_content exploitable
      const plannedDistance = computedPlannedDistance > 0 ? computedPlannedDistance : (session.cardio_total_distance_km || 0);
      const plannedDuration = computedPlannedDuration > 0 ? computedPlannedDuration : (session.cardio_total_duration_minutes || 0);
      const plannedIntensity = computedDurationForIntensity > 0
        ? Math.round(computedIntensityWeighted / computedDurationForIntensity)
        : (session.cardio_average_intensity || 0);

      // Trouver l'exercice qui a des données réelles (Strava ou saisie manuelle)
      // La session peut avoir plusieurs exercices (blocs), on prend celui avec le plus de données
      const exerciseWithData = session.session_exercises?.find((ex: any) =>
        ex.actual_distance_km !== null ||
        ex.actual_duration_minutes !== null ||
        ex.actual_pace_min_per_km !== null ||
        ex.actual_avg_heart_rate !== null ||
        ex.sportif_rpe !== null
      ) || session.session_exercises?.[0];
      const exercise = exerciseWithData;
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
        // Utiliser uniquement les données réelles (Strava ou saisie manuelle)
        // Ne PAS fallback sur les valeurs planifiées pour ne pas biaiser le graphique
        // On ignore les valeurs aberrantes (saisie erronée) pour ne pas casser l'échelle du graphe
        actualDistance = isPlausibleDistanceKm(exercise.actual_distance_km) ? (exercise.actual_distance_km ?? 0) : 0;
        actualDuration = isPlausibleDurationMin(exercise.actual_duration_minutes) ? (exercise.actual_duration_minutes ?? 0) : 0;
        actualIntensity = plannedIntensity; // L'intensité reste celle programmée sauf si calculée autrement
        
        if (exercise.actual_pace_min_per_km) {
          const parsedPace = parsePaceToDecimal(exercise.actual_pace_min_per_km);
          if (parsedPace !== null) {
            actualPace = parsedPace;
            validatedSessionsWithPace = 1;
          }
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

      // Compute Edwards score from actual_heart_rate_zones
      let edwardsScore = 0;
      if (exercise?.actual_heart_rate_zones && Array.isArray(exercise.actual_heart_rate_zones)) {
        for (const zone of exercise.actual_heart_rate_zones) {
          const minutes = (zone.time_seconds || 0) / 60;
          const multiplier = zone.zone; // Z1=1, Z2=2, Z3=3, Z4=4, Z5=5
          edwardsScore += minutes * multiplier;
        }
      }

      if (weeklyData.has(weekKey)) {
        const existing = weeklyData.get(weekKey)!;

        // Cumuler les données programmées
        existing.plannedDistanceKm += plannedDistance;
        existing.plannedDurationMinutes += plannedDuration;
        const totalPlannedDuration = existing.plannedDurationMinutes;
        existing.plannedAverageIntensity = totalPlannedDuration > 0 ? Math.round(
          ((existing.plannedAverageIntensity * (totalPlannedDuration - plannedDuration)) + (plannedIntensity * plannedDuration)) / totalPlannedDuration
        ) : existing.plannedAverageIntensity;
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

          // Zone basée sur intensité VMA programmée
          const sessionDuration = actualDuration || plannedDuration;
          if (plannedIntensity < 70) {
            existing.intensityZones.zoneLow += sessionDuration;
          } else if (plannedIntensity <= 90) {
            existing.intensityZones.zoneMid += sessionDuration;
          } else {
            existing.intensityZones.zoneHigh += sessionDuration;
          }
          
          // Cumuler RPE moyen
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
        // Initialiser les zones d'intensité basées sur VMA%
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
          week: weekKey,
          weekNumber,
          year: isoYear,
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
          actualAverageRpe: actualRpe > 0 ? actualRpe : null,
          intensityZones,
          actualLoadUA: (isValidated && actualDuration > 0 && actualRpe > 0) ? actualDuration * actualRpe : 0,
          edwardsLoad: edwardsScore,
          actualSessionsWithRpe: (isValidated && actualRpe > 0) ? 1 : 0,
        });
      }
    });

    // Ajouter les séances perso (custom_sessions) au graphique
    // Elles contribuent uniquement à la barre verte (réalisé), pas à la jaune (planifié)
    const { data: customData } = await supabase
      .from("custom_sessions")
      .select("id, session_name, duration_minutes, completed_at, scheduled_date, distance_km, avg_pace, avg_heart_rate, cardio_type, session_rpe")
      .eq("user_id", athleteId)
      .eq("cardio_type", "course")
      .not("completed_at", "is", null);

    (customData || []).forEach((cs: any) => {
      if (!cs.duration_minutes && !cs.distance_km) return;
      const dateStr = cs.completed_at ? cs.completed_at.split("T")[0] : cs.scheduled_date;
      if (!dateStr) return;
      const date = new Date(dateStr + "T12:00:00");
      const weekNumber = getWeekNumber(date);
      const isoYear = getWeekYear(date);
      const weekKey = `${isoYear}-W${weekNumber.toString().padStart(2, "0")}`;
      const distRaw = Number(cs.distance_km || 0);
      const dist = isPlausibleDistanceKm(distRaw) ? distRaw : 0;
      const durRaw = Number(cs.duration_minutes || 0);
      const dur = isPlausibleDurationMin(durRaw) ? durRaw : 0;
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

    // Convertir en tableau et trier par semaine
    const sortedWeeklyData = Array.from(weeklyData.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.weekNumber - b.weekNumber;
    });

    setCardioSessions(sortedWeeklyData);
    setLoading(false);
  };

  // Calculer les métriques de la semaine en cours de programmation en temps réel
  const programmingWeekMetrics = useMemo(() => {
    if (!programmingWeek || !programmingSessions || !programmingExercises) {
      return null;
    }

    const vma = athleteVmaOverride ?? athleteVma;
    let totalDistance = 0;
    let totalDuration = 0;
    let totalIntensityWeighted = 0;
    let totalDurationForIntensity = 0;
    let sessionCount = 0;

    // Parcourir les sessions cardio de course
    programmingSessions.forEach((session) => {
      if (session.session_type !== "cardio") return;

      const exercises = programmingExercises[session.id] || [];
      exercises.forEach((exercise) => {
        if (exercise.cardio_sport !== "course" || !exercise.cardio_content) return;

        try {
          const cardioData = JSON.parse(exercise.cardio_content) as CardioData;
          const metrics = calculateCardioMetrics(cardioData, vma);
          
          totalDistance += metrics.totalDistanceKm;
          totalDuration += metrics.totalDurationMinutes;
          if (metrics.averageIntensity > 0) {
            totalIntensityWeighted += metrics.averageIntensity * metrics.totalDurationMinutes;
            totalDurationForIntensity += metrics.totalDurationMinutes;
          }
          sessionCount++;
        } catch (e) {
          // Ignorer les erreurs de parsing
        }
      });
    });

    if (sessionCount === 0) {
      return null;
    }

    const averageIntensity = totalDurationForIntensity > 0
      ? Math.round(totalIntensityWeighted / totalDurationForIntensity)
      : 0;

    return {
      weekNumber: programmingWeek.week,
      year: programmingWeek.year,
      weekKey: `${programmingWeek.year}-W${programmingWeek.week.toString().padStart(2, '0')}`,
      distanceKm: Number(totalDistance.toFixed(2)),
      durationMinutes: Number(totalDuration.toFixed(2)),
      averageIntensity,
      sessionCount
    };
  }, [programmingWeek, programmingSessions, programmingExercises, athleteVma, athleteVmaOverride]);

  // Fusionner les données existantes avec les données de programmation en temps réel
  const mergedCardioSessions = useMemo(() => {
    if (!programmingWeekMetrics) {
      return cardioSessions;
    }

    const programmingWeekKey = programmingWeekMetrics.weekKey;
    
    // Créer une copie des données existantes
    const merged = [...cardioSessions];
    
    // Chercher si la semaine existe déjà
    const existingIndex = merged.findIndex(
      (s) => s.weekNumber === programmingWeekMetrics.weekNumber && s.year === programmingWeekMetrics.year
    );

    const programmingData: CardioSessionData = {
      week: programmingWeekKey,
      weekNumber: programmingWeekMetrics.weekNumber,
      year: programmingWeekMetrics.year,
      plannedDistanceKm: programmingWeekMetrics.distanceKm,
      plannedDurationMinutes: programmingWeekMetrics.durationMinutes,
      plannedAverageIntensity: programmingWeekMetrics.averageIntensity,
      plannedSessionCount: programmingWeekMetrics.sessionCount,
      actualDistanceKm: 0,
      actualDurationMinutes: 0,
      actualAverageIntensity: 0,
      actualSessionCount: 0,
      actualAveragePace: null,
      actualAverageHeartRate: null,
      actualAverageRpe: null,
      intensityZones: { zoneLow: 0, zoneMid: 0, zoneHigh: 0 },
      actualLoadUA: 0,
      edwardsLoad: 0,
      actualSessionsWithRpe: 0,
      isProgramming: true
    };

    if (existingIndex >= 0) {
      // Mettre à jour les données programmées de la semaine existante
      merged[existingIndex] = {
        ...merged[existingIndex],
        plannedDistanceKm: programmingWeekMetrics.distanceKm,
        plannedDurationMinutes: programmingWeekMetrics.durationMinutes,
        plannedAverageIntensity: programmingWeekMetrics.averageIntensity,
        plannedSessionCount: programmingWeekMetrics.sessionCount,
        isProgramming: true
      };
    } else {
      // Ajouter la nouvelle semaine et trier
      merged.push(programmingData);
      merged.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.weekNumber - b.weekNumber;
      });
    }

    return merged;
  }, [cardioSessions, programmingWeekMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  // Afficher même s'il n'y a que des données de programmation en cours
  const hasData = mergedCardioSessions.length > 0;
  
  if (!hasData) {
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

  const totalPlannedDistance = mergedCardioSessions.reduce((sum, s) => sum + s.plannedDistanceKm, 0);
  const totalPlannedDuration = mergedCardioSessions.reduce((sum, s) => sum + s.plannedDurationMinutes, 0);
  const totalActualDistance = mergedCardioSessions.reduce((sum, s) => sum + s.actualDistanceKm, 0);
  const totalActualDuration = mergedCardioSessions.reduce((sum, s) => sum + s.actualDurationMinutes, 0);
  const totalWeeks = mergedCardioSessions.length;
  const avgPlannedIntensityRaw = totalWeeks > 0 ? mergedCardioSessions.reduce((sum, s) => sum + s.plannedAverageIntensity, 0) / totalWeeks : 0;
  const avgPlannedIntensity = isNaN(avgPlannedIntensityRaw) ? 0 : avgPlannedIntensityRaw;
  const avgActualIntensityRaw = totalWeeks > 0 ? mergedCardioSessions.reduce((sum, s) => sum + s.actualAverageIntensity, 0) / totalWeeks : 0;
  const avgActualIntensity = isNaN(avgActualIntensityRaw) ? 0 : avgActualIntensityRaw;

  // A. Fiabilité RPE : % des séances validées avec RPE renseigné
  const totalValidatedSessions = mergedCardioSessions.reduce((s, w) => s + w.actualSessionCount, 0);
  const totalSessionsWithRpe = mergedCardioSessions.reduce((s, w) => s + w.actualSessionsWithRpe, 0);
  const rpeReliabilityPct = totalValidatedSessions > 0 ? Math.round((totalSessionsWithRpe / totalValidatedSessions) * 100) : 0;
  const rpeReliabilityLabel = rpeReliabilityPct >= 80 ? "good" : rpeReliabilityPct >= 50 ? "partial" : "poor";

  // Calculer les métriques de la semaine précédente pour comparaison
  const lastWeek = mergedCardioSessions[mergedCardioSessions.length - 1];
  const previousWeek = mergedCardioSessions[mergedCardioSessions.length - 2];
  
  const calculatePercentChange = (current: number, previous: number): { value: number; isIncrease: boolean } => {
    if (!previous || previous === 0) return { value: 0, isIncrease: true };
    const percentChange = ((current - previous) / previous) * 100;
    return { value: Math.abs(percentChange), isIncrease: percentChange >= 0 };
  };

  // Comparer km réalisés de la semaine précédente avec km programmés de la dernière semaine
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-muted-foreground">Suivi de course — {athleteName}</h2>
      </div>

      {/* Volume en cours de programmation (temps réel) — compact */}
      {programmingWeekMetrics && (
        <div className="flex flex-wrap items-center gap-3 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-yellow-500">
            <Activity className="h-3.5 w-3.5" />
            S{programmingWeekMetrics.weekNumber} · En direct
          </span>
          <span className="text-muted-foreground">Séances <span className="font-medium text-yellow-500">{programmingWeekMetrics.sessionCount}</span></span>
          <span className="text-muted-foreground">Distance <span className="font-medium text-yellow-500">{programmingWeekMetrics.distanceKm.toFixed(1)} km</span></span>
          <span className="text-muted-foreground">Durée <span className="font-medium text-yellow-500">{Math.floor(programmingWeekMetrics.durationMinutes / 60)}h{Math.round(programmingWeekMetrics.durationMinutes % 60).toString().padStart(2, '0')}</span></span>
          <span className="text-muted-foreground">Intensité moy. <span className="font-medium text-yellow-500">{programmingWeekMetrics.averageIntensity}% VMA</span></span>
        </div>
      )}

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2">
              Distance par semaine
              <InfoButton text="Évolution des km par semaine. Règle des 10% : ne pas augmenter de plus de 10%/semaine pour éviter les blessures. Barres jaunes = semaine en cours de programmation." />
            </CardTitle>
            {distanceChangeVsPlanned && previousWeek && (
              <p className="text-sm text-muted-foreground mt-1">
                Dernière semaine : {previousWeek.actualDistanceKm.toFixed(1)} km (réalisée, {previousWeek.week}) vs {lastWeek.plannedDistanceKm.toFixed(1)} km (programmée, {lastWeek.week})
                <span className={distanceChangeVsPlanned.isIncrease ? "text-green-600 ml-2" : "text-red-600 ml-2"}>
                  {distanceChangeVsPlanned.isIncrease ? "↑" : "↓"} {distanceChangeVsPlanned.value.toFixed(1)}%
                </span>
              </p>
            )}
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={mergedCardioSessions} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const isProgramming = payload[0].payload.isProgramming;
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium mb-2">
                            {payload[0].payload.week}
                            {isProgramming && <Badge variant="outline" className="ml-2 text-xs">En cours</Badge>}
                          </p>
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
                <Bar dataKey="plannedDistanceKm" name="Programmée (km)">
                  {mergedCardioSessions.map((entry, index) => (
                    <Cell 
                      key={`cell-planned-dist-${index}`} 
                      fill={entry.isProgramming ? "hsl(48 100% 60%)" : "hsl(48 100% 50%)"}
                      stroke={entry.isProgramming ? "hsl(48 100% 40%)" : undefined}
                      strokeWidth={entry.isProgramming ? 2 : 0}
                    />
                  ))}
                </Bar>
                <Bar dataKey="actualDistanceKm" fill="hsl(142 71% 45%)" name="Réalisée (km)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2">
              Durée par semaine
              <InfoButton text="Cumul du temps de course par semaine. Même règle des 10% que pour la distance." />
            </CardTitle>
            {durationChangeVsPlanned && previousWeek && (
              <p className="text-sm text-muted-foreground mt-1">
                Dernière semaine : {Math.floor(previousWeek.actualDurationMinutes / 60)}h{Math.round(previousWeek.actualDurationMinutes % 60).toString().padStart(2, '0')} (réalisée, {previousWeek.week}) vs {Math.floor(lastWeek.plannedDurationMinutes / 60)}h{Math.round(lastWeek.plannedDurationMinutes % 60).toString().padStart(2, '0')} (programmée, {lastWeek.week})
                <span className={durationChangeVsPlanned.isIncrease ? "text-green-600 ml-2" : "text-red-600 ml-2"}>
                  {durationChangeVsPlanned.isIncrease ? "↑" : "↓"} {durationChangeVsPlanned.value.toFixed(1)}%
                </span>
              </p>
            )}
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={mergedCardioSessions} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const plannedMinutes = payload[0].payload.plannedDurationMinutes;
                      const actualMinutes = payload[0].payload.actualDurationMinutes;
                      const isProgramming = payload[0].payload.isProgramming;
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium mb-2">
                            {payload[0].payload.week}
                            {isProgramming && <Badge variant="outline" className="ml-2 text-xs">En cours</Badge>}
                          </p>
                          <p className="text-sm text-yellow-600">
                            Programmée: {Math.floor(plannedMinutes / 60)}h{Math.round(plannedMinutes % 60).toString().padStart(2, '0')}
                          </p>
                          <p className="text-sm text-green-600">
                            Réalisée: {Math.floor(actualMinutes / 60)}h{Math.round(actualMinutes % 60).toString().padStart(2, '0')}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="plannedDurationMinutes" name="Programmée (min)">
                  {mergedCardioSessions.map((entry, index) => (
                    <Cell 
                      key={`cell-planned-dur-${index}`} 
                      fill={entry.isProgramming ? "hsl(48 100% 60%)" : "hsl(48 100% 50%)"}
                      stroke={entry.isProgramming ? "hsl(48 100% 40%)" : undefined}
                      strokeWidth={entry.isProgramming ? 2 : 0}
                    />
                  ))}
                </Bar>
                <Bar dataKey="actualDurationMinutes" fill="hsl(142 71% 45%)" name="Réalisée (min)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>

      {/* Graphiques des retours sportif */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2">
              Allure moyenne par semaine
              <InfoButton text="Allure réalisée vs programmée. Une allure plus rapide que prévue indique que les zones sont peut-être sous-estimées ou que l'athlète force." />
            </CardTitle>
            <p className="text-sm text-muted-foreground">Données saisies par le sportif</p>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={cardioSessions.filter(s => s.actualAveragePace)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="week" 
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  domain={['dataMin - 0.5', 'dataMax + 0.5']}
                  tickFormatter={(value) => `${value.toFixed(2)}`}
                />
                <RechartsTooltip
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
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2">
              FC moyenne par semaine
              <InfoButton text="Fréquence cardiaque moyenne réalisée. Comparée à la FC max, elle indique l'intensité réelle de l'entraînement." />
            </CardTitle>
            <p className="text-sm text-muted-foreground">Fréquence cardiaque moyenne</p>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={cardioSessions.filter(s => s.actualAverageHeartRate)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="week" 
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis domain={['dataMin - 10', 'dataMax + 10']} />
                <RechartsTooltip
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
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2">
              RPE moyen par semaine
              <InfoButton text="Perception subjective de l'effort (1-10). < 6 = léger, 6-8 = modéré, > 8 = élevé. Fiable si l'athlète renseigne systématiquement après chaque séance." />
            </CardTitle>
            <p className="text-sm text-muted-foreground">Effort perçu</p>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={cardioSessions.filter(s => s.actualAverageRpe)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="week" 
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis domain={[0, 10]} />
                <RechartsTooltip
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

      {/* Charge sRPE hebdomadaire */}
      {(() => {
        const srpeData = mergedCardioSessions.filter(s => s.actualLoadUA > 0);
        if (srpeData.length === 0) return null;
        return (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
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
            <CardContent className="px-4 pb-4">
              <ResponsiveContainer width="100%" height={150}>
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
        const edwardsData = mergedCardioSessions.filter(s => s.edwardsLoad > 0);
        if (edwardsData.length === 0) {
          return (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="flex items-center gap-2">
                  Charge Edwards (zones cardiaques)
                  <InfoButton text="Score basé sur le temps dans chaque zone cardiaque : Z1×1 + Z2×2 + Z3×3 + Z4×4 + Z5×5. Plus précis que le sRPE car objectif. Nécessite un capteur FC connecté à Strava." />
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm text-muted-foreground">Connectez Strava pour voir la charge Edwards</p>
              </CardContent>
            </Card>
          );
        }
        return (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="flex items-center gap-2">
                Charge Edwards (zones cardiaques)
                <InfoButton text="Score basé sur le temps dans chaque zone cardiaque : Z1×1 + Z2×2 + Z3×3 + Z4×4 + Z5×5. Plus précis que le sRPE car objectif. Nécessite un capteur FC connecté à Strava." />
              </CardTitle>
              <p className="text-xs text-muted-foreground">Score = Σ(min en zone × multiplicateur : Z1×1, Z2×2, Z3×3, Z4×4, Z5×5)</p>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ResponsiveContainer width="100%" height={150}>
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
        const filteredData = mergedCardioSessions.filter(s => {
          const total = s.intensityZones.zoneLow + s.intensityZones.zoneMid + s.intensityZones.zoneHigh;
          return s.plannedAverageIntensity > 0 && total > 0;
        });
        if (filteredData.length === 0) return null;

        const zoneColors = {
          low: "#22c55e",
          mid: "#eab308",
          high: "#ef4444",
        };

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
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="flex items-center gap-2">
                Répartition des zones d'intensité par semaine
                <InfoButton text="Distribution idéale : 80% du temps en Z1-Z2 (vert) et 20% en Z3-Z5. Si trop de Z3-Z4 (jaune) = entraînement 'gris' risquant la fatigue chronique sans progression optimale." />
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={stackedData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }} barSize={30}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-medium mb-2">{data.week} - Intensité moyenne: {data.avgIntensity}% VMA</p>
                            <p className="text-sm text-muted-foreground mb-2">Temps total: {data.totalMinutes} min</p>
                            <p className="text-sm" style={{ color: zoneColors.low }}>Z1-Z2 (&lt;70%): {data.z1z2Label}% ({data.zoneLowMinutes} min)</p>
                            <p className="text-sm" style={{ color: zoneColors.mid }}>Z3-Z4 (70-90%): {data.z3z4Label}% ({data.zoneMidMinutes} min)</p>
                            <p className="text-sm" style={{ color: zoneColors.high }}>Z5 (&gt;90%): {data.z5Label}% ({data.zoneHighMinutes} min)</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    content={() => (
                      <div className="flex flex-wrap justify-center gap-4 mt-2 text-xs">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: zoneColors.low }}></span>Z1-Z2 (&lt;70%)</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: zoneColors.mid }}></span>Z3-Z4 (70-90%)</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: zoneColors.high }}></span>Z5 (&gt;90%)</span>
                      </div>
                    )}
                  />
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
      {plannedVolume && !programmingWeekMetrics && (
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
            <CardContent className="px-4 pb-4"><div className="text-2xl font-bold">{plannedVolume.sessionCount}</div><p className="text-xs text-muted-foreground">Cette semaine</p></CardContent>
          </Card>
          <Card className="bg-yellow-500/5 border-yellow-500/20">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-yellow-600">Distance prévue</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4"><div className="text-2xl font-bold">{plannedVolume.distanceKm.toFixed(1)} km</div><p className="text-xs text-muted-foreground">Cette semaine</p></CardContent>
          </Card>
          <Card className="bg-yellow-500/5 border-yellow-500/20">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-yellow-600">Durée prévue</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4"><div className="text-2xl font-bold">{Math.floor(plannedVolume.durationMinutes / 60)}h{Math.round(plannedVolume.durationMinutes % 60).toString().padStart(2, '0')}</div><p className="text-xs text-muted-foreground">Cette semaine</p></CardContent>
          </Card>
          <Card className="bg-yellow-500/5 border-yellow-500/20">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-yellow-600">Intensité prévue</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4"><div className="text-2xl font-bold">{plannedVolume.averageIntensity}% VMA</div><p className="text-xs text-muted-foreground">Cette semaine</p></CardContent>
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
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{totalWeeks}</div>
            <p className="text-xs text-muted-foreground">
              Total de semaines complétées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              Distance totale
              <InfoButton text="Total des kilomètres réalisés depuis le début. Comparé au volume prévu pour mesurer l'adhérence au programme." />
            </CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-green-600">{totalActualDistance.toFixed(1)} km</div>
            <p className="text-xs text-muted-foreground">
              Réalisé · Prévu: {totalPlannedDistance.toFixed(1)} km
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
          <CardContent className="px-4 pb-4">
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
              <InfoButton text="Moyenne pondérée par la durée des séances. Idéalement 65-75% VMA pour un entraînement à dominante aérobie." />
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-green-600">{Math.round(avgActualIntensity)}% VMA</div>
            <p className="text-xs text-muted-foreground">
              Réalisé · Prévu: {Math.round(avgPlannedIntensity)}% VMA
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Efficience aérobie Strava */}
      <AerobicEfficiencyCard athleteId={athleteId} />

    </div>
  );
}
