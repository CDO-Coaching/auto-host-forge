import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { formatCardioTime, formatCardioDistance } from "@/lib/cardioCalculations";
import { CardioData } from "@/components/CardioStepBuilder";
import { Activity, Clock, MapPin, TrendingUp } from "lucide-react";

interface CardioSessionData {
  week: string;
  weekNumber: number;
  year: number;
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

  useEffect(() => {
    loadData();
  }, [athleteId]);

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

        // Calculer pour les étapes hors blocs
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

        // Déterminer la semaine ISO
        const feedbackDate = new Date(session.sportif_feedback_at);
        const weekNumber = getISOWeek(feedbackDate);
        const year = feedbackDate.getFullYear();
        const weekKey = `${year}-W${String(weekNumber).padStart(2, '0')}`;

        const distanceKm = totalDistance / 1000;
        const durationMinutes = totalDuration / 60;
        const avgIntensity = stepCount > 0 ? totalVmaPercent / stepCount : 0;

        if (weeklyData.has(weekKey)) {
          const existing = weeklyData.get(weekKey)!;
          existing.distanceKm += distanceKm;
          existing.durationMinutes += durationMinutes;
          existing.averageIntensity = (existing.averageIntensity * existing.sessionCount + avgIntensity) / (existing.sessionCount + 1);
          existing.sessionCount += 1;
        } else {
          weeklyData.set(weekKey, {
            week: weekKey,
            weekNumber,
            year,
            distanceKm,
            durationMinutes,
            averageIntensity: avgIntensity,
            sessionCount: 1
          });
        }
      } catch (e) {
        console.error("Error parsing cardio content:", e);
      }
    });

    const sortedWeeklyData = Array.from(weeklyData.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.weekNumber - b.weekNumber;
    });

    setCardioSessions(sortedWeeklyData);
    setLoading(false);
  };

  const getISOWeek = (date: Date): number => {
    const tempDate = new Date(date.getTime());
    tempDate.setHours(0, 0, 0, 0);
    tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
    const week1 = new Date(tempDate.getFullYear(), 0, 4);
    return 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  if (cardioSessions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            Aucune séance de course validée pour {athleteName}
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalDistance = cardioSessions.reduce((sum, s) => sum + s.distanceKm, 0);
  const totalDuration = cardioSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalWeeks = cardioSessions.length;
  const avgIntensity = cardioSessions.reduce((sum, s) => sum + s.averageIntensity, 0) / totalWeeks;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Semaines</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWeeks}</div>
            <p className="text-xs text-muted-foreground">semaines d'entraînement</p>
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
              Moy: {(totalDistance / totalWeeks).toFixed(1)} km/semaine
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Temps total</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.floor(totalDuration)} min</div>
            <p className="text-xs text-muted-foreground">
              Moy: {Math.floor(totalDuration / totalWeeks)} min/semaine
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Intensité moy.</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgIntensity.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">de la VMA</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Distance hebdomadaire (km)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cardioSessions} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
              <XAxis 
                dataKey="week" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))' }}
                label={{ value: 'Distance (km)', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--foreground))' } }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  color: 'hsl(var(--foreground))'
                }}
                formatter={(value: number) => [`${value.toFixed(2)} km`, 'Distance']}
                labelFormatter={(label) => `Semaine ${label}`}
              />
              <Bar dataKey="distanceKm" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Durée hebdomadaire (minutes)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cardioSessions} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
              <XAxis 
                dataKey="week" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))' }}
                label={{ value: 'Durée (min)', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--foreground))' } }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  color: 'hsl(var(--foreground))'
                }}
                formatter={(value: number) => [`${Math.round(value)} min`, 'Durée']}
                labelFormatter={(label) => `Semaine ${label}`}
              />
              <Bar dataKey="durationMinutes" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Intensité hebdomadaire (% VMA)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cardioSessions} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
              <XAxis 
                dataKey="week" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))' }}
                label={{ value: 'Intensité (% VMA)', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--foreground))' } }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  color: 'hsl(var(--foreground))'
                }}
                formatter={(value: number) => [`${value.toFixed(0)}% VMA`, 'Intensité']}
                labelFormatter={(label) => `Semaine ${label}`}
              />
              <Line 
                type="monotone" 
                dataKey="averageIntensity" 
                stroke="hsl(var(--chart-3))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--chart-3))', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
