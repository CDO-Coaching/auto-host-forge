import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { formatCardioTime, formatCardioDistance, calculateCardioSessionDuration } from "@/lib/cardioCalculations";
import { CardioData } from "@/components/CardioStepBuilder";

interface CardioSessionData {
  week: string;
  weekNumber: number;
  year: number;
  durationMinutes: number;
  distanceKm: number;
  averageIntensity: number; // Pourcentage VMA moyen
  sessionCount: number;
}

export default function SuiviCourse() {
  const [loading, setLoading] = useState(true);
  const [cardioSessions, setCardioSessions] = useState<CardioSessionData[]>([]);
  const [athleteVma, setAthleteVma] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      setLoading(false);
      return;
    }

    // Charger la VMA de l'athlète
    const { data: profileData } = await supabase
      .from("user_profiles")
      .select("vma")
      .eq("id", user.id)
      .single();
    
    if (profileData?.vma) {
      setAthleteVma(profileData.vma);
    }

    // Charger toutes les séances cardio validées avec les métriques pré-calculées
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
          sportif_feedback_at
        ),
        training_weeks!inner(
          athlete_id,
          week_number,
          year
        )
      `)
      .eq("training_weeks.athlete_id", user.id)
      .eq("session_exercises.cardio_sport", "course")
      .not("session_exercises.sportif_rpe", "is", null)
      .not("cardio_total_distance_km", "is", null)
      .order("session_exercises.sportif_feedback_at", { foreignTable: "session_exercises", ascending: true });

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
      const weekKey = `${year}-W${weekNumber}`;

      if (weeklyData.has(weekKey)) {
        const existing = weeklyData.get(weekKey)!;
        existing.distanceKm += session.cardio_total_distance_km || 0;
        existing.durationMinutes += session.cardio_total_duration_minutes || 0;
        
        // Calculer la moyenne pondérée de l'intensité
        const totalDuration = existing.durationMinutes;
        const newIntensity = session.cardio_average_intensity || 0;
        const newDuration = session.cardio_total_duration_minutes || 0;
        
        existing.averageIntensity = Math.round(
          ((existing.averageIntensity * (totalDuration - newDuration)) + (newIntensity * newDuration)) / totalDuration
        );
        existing.sessionCount++;
      } else {
        weeklyData.set(weekKey, {
          week: weekKey,
          weekNumber,
          year,
          distanceKm: session.cardio_total_distance_km || 0,
          durationMinutes: session.cardio_total_duration_minutes || 0,
          averageIntensity: session.cardio_average_intensity || 0,
          sessionCount: 1
        });
      }
    });

    // Convertir en tableau et trier par date
    const sortedSessions = Array.from(weeklyData.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.weekNumber - b.weekNumber;
    });

    setCardioSessions(sortedSessions);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (cardioSessions.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold mb-2">Suivi de Course</h1>
          <p className="text-muted-foreground">
            Visualisez l'évolution de votre volume d'entraînement en course
          </p>
        </div>
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              Aucune séance de course validée pour le moment.
              <br />
              Complétez vos premières séances pour voir vos statistiques ici !
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculer les totaux
  const totalDistance = cardioSessions.reduce((acc, s) => acc + s.distanceKm, 0);
  const totalTime = cardioSessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  const avgIntensity = cardioSessions.reduce((acc, s) => acc + s.averageIntensity, 0) / cardioSessions.length;

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Suivi de Course</h1>
        <p className="text-muted-foreground">
          Évolution de votre volume d'entraînement
        </p>
      </div>

      {/* Statistiques globales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Distance totale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{totalDistance.toFixed(1)} km</div>
            <p className="text-xs text-muted-foreground mt-1">Sur {cardioSessions.length} semaines</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Temps total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {Math.floor(totalTime / 60)}h{totalTime % 60 > 0 ? `${totalTime % 60}min` : ''}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Temps cumulé</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Intensité moyenne</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{Math.round(avgIntensity)}% VMA</div>
            <p className="text-xs text-muted-foreground mt-1">Intensité globale</p>
          </CardContent>
        </Card>
      </div>

      {/* Graphique Distance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Distance par semaine</span>
            <Badge variant="outline" className="ml-2">km</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cardioSessions} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
              <XAxis 
                dataKey="week" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                label={{ value: 'km', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))' } }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                formatter={(value: number) => [`${value.toFixed(2)} km`, 'Distance']}
              />
              <Bar 
                dataKey="distanceKm" 
                fill="hsl(var(--primary))" 
                name="Distance"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Graphique Durée */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Durée par semaine</span>
            <Badge variant="outline" className="ml-2">min</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cardioSessions} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
              <XAxis 
                dataKey="week" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                label={{ value: 'min', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))' } }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                formatter={(value: number) => [`${value} min`, 'Durée']}
              />
              <Bar 
                dataKey="durationMinutes" 
                fill="hsl(var(--chart-2))" 
                name="Durée"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Graphique Intensité */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Intensité moyenne par semaine</span>
            <Badge variant="outline" className="ml-2">% VMA</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cardioSessions} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" opacity={0.3} />
              <XAxis 
                dataKey="week" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                domain={[0, 100]}
                label={{ value: '% VMA', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))' } }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                formatter={(value: number) => [`${value}% VMA`, 'Intensité']}
              />
              <Line 
                type="monotone" 
                dataKey="averageIntensity" 
                stroke="hsl(var(--chart-3))" 
                strokeWidth={3}
                name="Intensité"
                dot={{ fill: 'hsl(var(--chart-3))', r: 5, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                activeDot={{ r: 7, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
