import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { formatCardioTime, formatCardioDistance, calculateCardioSessionDuration } from "@/lib/cardioCalculations";
import { CardioData } from "@/components/CardioStepBuilder";

interface CardioSessionData {
  date: string;
  sessionName: string;
  durationMinutes: number;
  distanceKm: number;
  averageIntensity: number; // Pourcentage VMA moyen
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
          weeks!inner(
            user_id
          )
        )
      `)
      .eq("training_sessions.weeks.user_id", user.id)
      .not("sportif_rpe", "is", null)
      .not("cardio_content", "is", null)
      .order("sportif_feedback_at", { ascending: true });

    if (error) {
      console.error("Error loading cardio sessions:", error);
      setLoading(false);
      return;
    }

    // Traiter les données
    const processedData: CardioSessionData[] = [];
    
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
          }
          if (step.vma_percentage) {
            totalVmaPercent += step.vma_percentage;
            stepCount++;
          }
        });

        const avgIntensity = stepCount > 0 ? totalVmaPercent / stepCount : 0;
        const date = session.sportif_feedback_at 
          ? new Date(session.sportif_feedback_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
          : new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

        processedData.push({
          date,
          sessionName: session.training_sessions.name || session.exercice,
          durationMinutes: Math.round(totalDuration / 60),
          distanceKm: Number((totalDistance / 1000).toFixed(2)),
          averageIntensity: Math.round(avgIntensity),
        });
      } catch (e) {
        console.error("Error parsing cardio data:", e);
      }
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
            <p className="text-xs text-muted-foreground mt-1">Sur {cardioSessions.length} séances</p>
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
          <CardTitle className="flex items-center gap-2">
            <span>Distance par séance</span>
            <Badge variant="outline">km</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cardioSessions}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Bar 
                dataKey="distanceKm" 
                fill="hsl(var(--primary))" 
                name="Distance (km)"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Graphique Durée */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Durée par séance</span>
            <Badge variant="outline">min</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cardioSessions}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Bar 
                dataKey="durationMinutes" 
                fill="hsl(var(--chart-2))" 
                name="Durée (min)"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Graphique Intensité */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>Intensité moyenne par séance</span>
            <Badge variant="outline">% VMA</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cardioSessions}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                domain={[0, 100]}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Line 
                type="monotone" 
                dataKey="averageIntensity" 
                stroke="hsl(var(--chart-3))" 
                strokeWidth={3}
                name="Intensité (% VMA)"
                dot={{ fill: 'hsl(var(--chart-3))', r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
