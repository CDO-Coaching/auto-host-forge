import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";

interface FatigueLog {
  id: string;
  date: string;
  fatigue: number;
  courbatures: number;
  sommeil: number;
  stress: number;
  score_total: number;
  has_injury: boolean | null;
  injury_level: number | null;
  injury_location: string | null;
}

interface CoachFatigueViewProps {
  athleteId: string;
  athleteName: string;
}

export function CoachFatigueView({ athleteId, athleteName }: CoachFatigueViewProps) {
  const [logs, setLogs] = useState<FatigueLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasInjuryTracking, setHasInjuryTracking] = useState(false);

  useEffect(() => {
    loadFatigueLogs();
  }, [athleteId]);

  const loadFatigueLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("daily_fatigue_log")
        .select("*")
        .eq("user_id", athleteId)
        .order("date", { ascending: false })
        .limit(30);

      if (error) throw error;
      
      const logs = data || [];
      setLogs(logs);
      
      // Vérifier si le suivi blessures est utilisé
      const hasInjuries = logs.some(log => log.has_injury);
      setHasInjuryTracking(hasInjuries);
    } catch (error) {
      console.error("Error loading fatigue logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = [...logs]
    .reverse()
    .map(log => ({
      date: format(new Date(log.date), "dd/MM", { locale: fr }),
      score: log.score_total,
      injury: log.has_injury && log.injury_level ? log.injury_level : null,
    }));

  const injuryLogs = logs.filter(log => log.has_injury && log.injury_level);
  const recentHighFatigue = logs.slice(0, 5).filter(log => log.score_total > 20);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-muted-foreground text-center">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aucune donnée</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {athleteName} n'a pas encore enregistré de données de fatigue.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {recentHighFatigue.length > 0 && (
        <Card className="border-orange-500/50 bg-orange-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="h-5 w-5" />
              Alertes fatigue élevée
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {athleteName} a signalé un niveau de fatigue élevé (score &gt; 20) ces derniers jours :
            </p>
            <div className="space-y-2">
              {recentHighFatigue.map((log) => (
                <div key={log.id} className="flex justify-between items-center text-sm border-l-2 border-orange-500 pl-3 py-1">
                  <span className="font-medium">
                    {format(new Date(log.date), "dd MMMM yyyy", { locale: fr })}
                  </span>
                  <Badge variant="destructive">{log.score_total}/28</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Évolution du score de fatigue</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                domain={[4, 28]}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
              />
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))' }}
                name="Score fatigue"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {hasInjuryTracking && injuryLogs.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Blessures / Douleurs signalées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  domain={[0, 7]}
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="injury" 
                  stroke="hsl(var(--destructive))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--destructive))' }}
                  name="Niveau de douleur"
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              <h4 className="font-medium text-sm">Dernières blessures signalées :</h4>
              {injuryLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex justify-between items-start text-sm border-l-2 border-destructive pl-3 py-1">
                  <div>
                    <p className="font-medium">
                      {format(new Date(log.date), "dd MMMM yyyy", { locale: fr })}
                    </p>
                    {log.injury_location && (
                      <p className="text-muted-foreground text-xs">{log.injury_location}</p>
                    )}
                  </div>
                  <Badge variant="destructive">{log.injury_level}/7</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Historique détaillé (30 derniers jours)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Fatigue</TableHead>
                <TableHead>Courbatures</TableHead>
                <TableHead>Sommeil</TableHead>
                <TableHead>Stress</TableHead>
                <TableHead>Score total</TableHead>
                {hasInjuryTracking && <TableHead>Douleur</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">
                    {format(new Date(log.date), "dd MMM yyyy", { locale: fr })}
                  </TableCell>
                  <TableCell>{log.fatigue}/7</TableCell>
                  <TableCell>{log.courbatures}/7</TableCell>
                  <TableCell>{log.sommeil}/7</TableCell>
                  <TableCell>{log.stress}/7</TableCell>
                  <TableCell>
                    <Badge variant={log.score_total > 20 ? "destructive" : "secondary"}>
                      {log.score_total}/28
                    </Badge>
                  </TableCell>
                  {hasInjuryTracking && (
                    <TableCell>
                      {log.has_injury ? (
                        <Badge variant="destructive">{log.injury_level}/7</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
