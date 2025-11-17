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

    // Charger toutes les séances cardio validées
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
      .eq("training_sessions.training_weeks.athlete_id", user.id)
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
            // Ignorer les étapes de marche
            if (step.movement_type === 'marche') return;
            
            for (let i = 0; i < block.repetitions; i++) {
              if (step.effort_type === 'distance') {
                totalDistance += step.distance || 0;
                // Estimer la durée basée sur la VMA
                if (athleteVma && step.vma_percentage) {
                  const distanceKm = (step.distance || 0) / 1000;
                  const speed = athleteVma * (step.vma_percentage / 100);
                  const durationHours = distanceKm / speed;
                  totalDuration += durationHours * 3600;
                }
              } else if (step.effort_type === 'duration') {
                totalDuration += step.duration || 0;
                // Estimer la distance basée sur la VMA et la durée
                if (athleteVma && step.vma_percentage) {
                  const speed = athleteVma * (step.vma_percentage / 100); // km/h
                  const durationHours = (step.duration || 0) / 3600;
                  const distance = speed * durationHours * 1000; // en mètres
                  totalDistance += distance;
                }
              }
              if (step.vma_percentage) {
                totalVmaPercent += step.vma_percentage;
                stepCount++;
              }
            }
          });
        });

        // Calculer pour les étapes individuelles
        steps.filter(s => !s.block_id).forEach((step) => {
          // Ignorer les étapes de marche
          if (step.movement_type === 'marche') return;
          
          if (step.effort_type === 'distance') {
            totalDistance += step.distance || 0;
            if (athleteVma && step.vma_percentage) {
              const distanceKm = (step.distance || 0) / 1000;
              const speed = athleteVma * (step.vma_percentage / 100);
              const durationHours = distanceKm / speed;
              totalDuration += durationHours * 3600;
            }
          } else if (step.effort_type === 'duration') {
            totalDuration += step.duration || 0;
            // Estimer la distance basée sur la VMA et la durée
            if (athleteVma && step.vma_percentage) {
              const speed = athleteVma * (step.vma_percentage / 100); // km/h
              const durationHours = (step.duration || 0) / 3600;
              const distance = speed * durationHours * 1000; // en mètres
              totalDistance += distance;
            }
          }
          if (step.vma_percentage) {
            totalVmaPercent += step.vma_percentage;
            stepCount++;
          }
        });

        const avgIntensity = stepCount > 0 ? totalVmaPercent / stepCount : 0;
        
        // Calculer le numéro de semaine
        const feedbackDate = session.sportif_feedback_at 
          ? new Date(session.sportif_feedback_at)
          : new Date();
        
        // Fonction pour obtenir le numéro de semaine ISO
        const getISOWeek = (date: Date) => {
          const target = new Date(date.valueOf());
          const dayNumber = (date.getDay() + 6) % 7;
          target.setDate(target.getDate() - dayNumber + 3);
          const firstThursday = target.valueOf();
          target.setMonth(0, 1);
          if (target.getDay() !== 4) {
            target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
          }
          return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
        };

        const weekNumber = getISOWeek(feedbackDate);
        const year = feedbackDate.getFullYear();
        const weekKey = `${year}-W${weekNumber}`;

        // Ajouter ou mettre à jour les données de la semaine
        const existingWeek = weeklyData.get(weekKey);
        if (existingWeek) {
          existingWeek.durationMinutes += Math.round(totalDuration / 60);
          existingWeek.distanceKm += Number((totalDistance / 1000).toFixed(2));
          existingWeek.averageIntensity = ((existingWeek.averageIntensity * existingWeek.sessionCount) + avgIntensity) / (existingWeek.sessionCount + 1);
          existingWeek.sessionCount += 1;
        } else {
          weeklyData.set(weekKey, {
            week: `S${weekNumber}`,
            weekNumber,
            year,
            durationMinutes: Math.round(totalDuration / 60),
            distanceKm: Number((totalDistance / 1000).toFixed(2)),
            averageIntensity: avgIntensity,
            sessionCount: 1,
          });
        }
      } catch (e) {
        console.error("Error parsing cardio data:", e);
      }
    });

    // Convertir la Map en array et trier par année puis semaine
    const processedData = Array.from(weeklyData.values())
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.weekNumber - b.weekNumber;
      });

    setCardioSessions(processedData);
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
