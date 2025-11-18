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
  durationMinutes: number;
  distanceKm: number;
  averageIntensity: number;
  sessionCount: number;
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

    // Charger les séances prévues (non validées) pour la semaine en cours
    const { data: plannedSessions, error } = await supabase
      .from("session_exercises")
      .select(`
        id,
        exercice,
        cardio_sport,
        cardio_content,
        sportif_rpe,
        training_sessions!inner(
          id,
          name,
          week_id,
          training_weeks!inner(
            athlete_id,
            week_number,
            year
          )
        )
      `)
      .eq("training_sessions.training_weeks.athlete_id", athleteId)
      .eq("training_sessions.training_weeks.week_number", currentWeekNumber)
      .eq("training_sessions.training_weeks.year", currentYear)
      .is("sportif_rpe", null)
      .not("cardio_content", "is", null);

    if (error) {
      console.error("Error loading planned sessions:", error);
      return;
    }

    // Calculer le volume prévu
    let totalDistance = 0;
    let totalDuration = 0;
    let totalVmaPercent = 0;
    let stepCount = 0;
    let sessionCount = 0;

    plannedSessions?.forEach((session: any) => {
      if (!session.cardio_content || session.cardio_sport !== "course") return;

      try {
        sessionCount++;
        const cardioData: CardioData = JSON.parse(session.cardio_content);
        const steps = cardioData.steps || [];
        const blocks = cardioData.blocks || [];

        // Calculer pour les blocs
        blocks.forEach((block) => {
          const blockSteps = steps.filter(s => s.block_id === block.id);
          blockSteps.forEach((step) => {
            if (step.movement_type === 'marche') return;
            
            for (let i = 0; i < block.repetitions; i++) {
              if (step.effort_type === 'distance') {
                totalDistance += step.distance || 0;
                if (vma && step.vma_percentage) {
                  const distanceKm = (step.distance || 0) / 1000;
                  const speed = vma * (step.vma_percentage / 100);
                  const durationHours = distanceKm / speed;
                  totalDuration += durationHours * 3600;
                }
              } else if (step.effort_type === 'duration') {
                totalDuration += step.duration || 0;
                if (vma && step.vma_percentage) {
                  const speed = vma * (step.vma_percentage / 100);
                  const durationHours = (step.duration || 0) / 3600;
                  const distanceKm = speed * durationHours;
                  totalDistance += distanceKm * 1000;
                }
              }
              
              if (step.vma_percentage) {
                totalVmaPercent += step.vma_percentage;
                stepCount++;
              }
            }
          });
        });

        // Calculer pour les steps sans bloc
        steps.filter(s => !s.block_id).forEach((step) => {
          if (step.movement_type === 'marche') return;
          
          if (step.effort_type === 'distance') {
            totalDistance += step.distance || 0;
            if (vma && step.vma_percentage) {
              const distanceKm = (step.distance || 0) / 1000;
              const speed = vma * (step.vma_percentage / 100);
              const durationHours = distanceKm / speed;
              totalDuration += durationHours * 3600;
            }
          } else if (step.effort_type === 'duration') {
            totalDuration += step.duration || 0;
            if (vma && step.vma_percentage) {
              const speed = vma * (step.vma_percentage / 100);
              const durationHours = (step.duration || 0) / 3600;
              const distanceKm = speed * durationHours;
              totalDistance += distanceKm * 1000;
            }
          }
          
          if (step.vma_percentage) {
            totalVmaPercent += step.vma_percentage;
            stepCount++;
          }
        });
      } catch (error) {
        console.error("Error parsing cardio content:", error);
      }
    });

    if (sessionCount > 0) {
      setPlannedVolume({
        durationMinutes: Math.round(totalDuration / 60),
        distanceKm: parseFloat((totalDistance / 1000).toFixed(2)),
        averageIntensity: stepCount > 0 ? Math.round(totalVmaPercent / stepCount) : 0,
        sessionCount
      });
    } else {
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

    // Charger toutes les séances cardio validées de l'athlète
    const { data: sessions, error } = await supabase
      .from("session_exercises")
      .select(`
        id,
        exercice,
        cardio_sport,
        cardio_content,
        sportif_rpe,
        sportif_feedback_at,
        training_sessions!inner(
          id,
          name,
          week_id,
          training_weeks!inner(
            athlete_id
          )
        )
      `)
      .eq("training_sessions.training_weeks.athlete_id", athleteId)
      .not("sportif_rpe", "is", null)
      .not("cardio_content", "is", null)
      .order("sportif_feedback_at", { ascending: true });

    if (error) {
      console.error("Error loading cardio sessions:", error);
      setLoading(false);
      return;
    }

    // Traiter les données et grouper par semaine
    const weeklyData = new Map<string, CardioSessionData>();
    
    sessions?.forEach((session: any) => {
      if (!session.cardio_content || session.cardio_sport !== "course") return;

      try {
        const cardioData: CardioData = JSON.parse(session.cardio_content);
        const steps = cardioData.steps || [];
        const blocks = cardioData.blocks || [];

        let totalDistance = 0;
        let totalDuration = 0;
        let totalVmaPercent = 0;
        let stepCount = 0;

        // Calculer pour les blocs
        blocks.forEach((block) => {
          const blockSteps = steps.filter(s => s.block_id === block.id);
          blockSteps.forEach((step) => {
            if (step.movement_type === 'marche') return;
            
            for (let i = 0; i < block.repetitions; i++) {
              if (step.effort_type === 'distance') {
                totalDistance += step.distance || 0;
                if (profileData?.vma && step.vma_percentage) {
                  const distanceKm = (step.distance || 0) / 1000;
                  const speed = profileData.vma * (step.vma_percentage / 100);
                  const durationHours = distanceKm / speed;
                  totalDuration += durationHours * 3600;
                }
              } else if (step.effort_type === 'duration') {
                totalDuration += step.duration || 0;
                if (profileData?.vma && step.vma_percentage) {
                  const speed = profileData.vma * (step.vma_percentage / 100);
                  const durationHours = (step.duration || 0) / 3600;
                  const distanceKm = speed * durationHours;
                  totalDistance += distanceKm * 1000;
                }
              }
              
              if (step.vma_percentage) {
                totalVmaPercent += step.vma_percentage;
                stepCount++;
              }
            }
          });
        });

        // Calculer pour les steps sans bloc
        steps.filter(s => !s.block_id).forEach((step) => {
          if (step.movement_type === 'marche') return;
          
          if (step.effort_type === 'distance') {
            totalDistance += step.distance || 0;
            if (profileData?.vma && step.vma_percentage) {
              const distanceKm = (step.distance || 0) / 1000;
              const speed = profileData.vma * (step.vma_percentage / 100);
              const durationHours = distanceKm / speed;
              totalDuration += durationHours * 3600;
            }
          } else if (step.effort_type === 'duration') {
            totalDuration += step.duration || 0;
            if (profileData?.vma && step.vma_percentage) {
              const speed = profileData.vma * (step.vma_percentage / 100);
              const durationHours = (step.duration || 0) / 3600;
              const distanceKm = speed * durationHours;
              totalDistance += distanceKm * 1000;
            }
          }
          
          if (step.vma_percentage) {
            totalVmaPercent += step.vma_percentage;
            stepCount++;
          }
        });

        // Déterminer la semaine de validation
        const feedbackDate = new Date(session.sportif_feedback_at);
        const weekNumber = getWeekNumber(feedbackDate);
        const year = feedbackDate.getFullYear();
        const weekKey = `${year}-W${weekNumber.toString().padStart(2, '0')}`;

        // Ajouter ou mettre à jour les données de la semaine
        if (weeklyData.has(weekKey)) {
          const existing = weeklyData.get(weekKey)!;
          const newSessionCount = existing.sessionCount + 1;
          weeklyData.set(weekKey, {
            ...existing,
            distanceKm: existing.distanceKm + (totalDistance / 1000),
            durationMinutes: existing.durationMinutes + Math.round(totalDuration / 60),
            averageIntensity: ((existing.averageIntensity * existing.sessionCount) + (stepCount > 0 ? totalVmaPercent / stepCount : 0)) / newSessionCount,
            sessionCount: newSessionCount
          });
        } else {
          weeklyData.set(weekKey, {
            week: weekKey,
            weekNumber,
            year,
            distanceKm: parseFloat((totalDistance / 1000).toFixed(2)),
            durationMinutes: Math.round(totalDuration / 60),
            averageIntensity: stepCount > 0 ? Math.round(totalVmaPercent / stepCount) : 0,
            sessionCount: 1
          });
        }
      } catch (error) {
        console.error("Error parsing cardio content:", error);
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
        <p className="text-lg font-medium">Aucune séance de course validée</p>
        <p className="text-sm text-muted-foreground mt-2">
          Les séances de course validées par {athleteName} apparaîtront ici
        </p>
      </div>
    );
  }

  const totalDistance = cardioSessions.reduce((sum, s) => sum + s.distanceKm, 0);
  const totalDuration = cardioSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalWeeks = cardioSessions.length;
  const avgIntensity = cardioSessions.reduce((sum, s) => sum + s.averageIntensity, 0) / totalWeeks;

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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Séances</p>
                <p className="text-2xl font-bold">{plannedVolume.sessionCount}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Distance totale</p>
                <p className="text-2xl font-bold">{plannedVolume.distanceKm.toFixed(1)} km</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Durée totale</p>
                <p className="text-2xl font-bold">{Math.floor(plannedVolume.durationMinutes / 60)}h{(plannedVolume.durationMinutes % 60).toString().padStart(2, '0')}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Intensité moyenne</p>
                <p className="text-2xl font-bold">{plannedVolume.averageIntensity}% VMA</p>
              </div>
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
            <div className="text-2xl font-bold">{totalDistance.toFixed(1)} km</div>
            <p className="text-xs text-muted-foreground">
              Moyenne: {(totalDistance / totalWeeks).toFixed(1)} km/semaine
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Durée totale</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.floor(totalDuration / 60)}h{(totalDuration % 60).toString().padStart(2, '0')}
            </div>
            <p className="text-xs text-muted-foreground">
              Moyenne: {Math.round(totalDuration / totalWeeks)} min/semaine
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Intensité moyenne</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(avgIntensity)}% VMA</div>
            <p className="text-xs text-muted-foreground">
              Sur toutes les semaines
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distance par semaine</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cardioSessions} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barSize={40}>
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
                          <p className="font-medium">{payload[0].payload.week}</p>
                          <p className="text-sm text-muted-foreground">
                            Distance: {payload[0].value} km
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="distanceKm" fill="hsl(var(--primary))" name="Distance (km)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Durée par semaine</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cardioSessions} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barSize={40}>
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
                      const minutes = payload[0].value as number;
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium">{payload[0].payload.week}</p>
                          <p className="text-sm text-muted-foreground">
                            Durée: {Math.floor(minutes / 60)}h{(minutes % 60).toString().padStart(2, '0')}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="durationMinutes" fill="hsl(var(--primary))" name="Durée (min)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Intensité moyenne par semaine</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={cardioSessions} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
                          <p className="font-medium">{payload[0].payload.week}</p>
                          <p className="text-sm text-muted-foreground">
                            Intensité: {payload[0].value}% VMA
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
                  dataKey="averageIntensity" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Intensité (% VMA)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
