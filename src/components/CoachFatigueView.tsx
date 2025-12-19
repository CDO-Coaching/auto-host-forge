import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, Activity } from "lucide-react";
import { FatigueDetailedCharts } from "@/components/FatigueDetailedCharts";

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

interface TrainingSession {
  id: string;
  completed_at: string;
  duration_minutes: number | null;
  session_rpe: number | null;
}

interface DailyLoad {
  date: string;
  load: number;
  sessions: number;
}

interface MonotonyData {
  dailyLoads: DailyLoad[];
  weeklyLoad: number;
  meanLoad: number;
  stdDev: number;
  monotony: number;
  strain: number;
}

interface CoachFatigueViewProps {
  athleteId: string;
  athleteName: string;
}

export function CoachFatigueView({ athleteId, athleteName }: CoachFatigueViewProps) {
  const [logs, setLogs] = useState<FatigueLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasInjuryTracking, setHasInjuryTracking] = useState(false);
  const [monotonyData, setMonotonyData] = useState<MonotonyData | null>(null);

  useEffect(() => {
    loadFatigueLogs();
    loadMonotonyData();
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

  const loadMonotonyData = async () => {
    try {
      const today = new Date();
      const sevenDaysAgo = subDays(today, 6);

      const { data, error } = await supabase
        .from("training_sessions")
        .select("id, completed_at, duration_minutes, session_rpe")
        .eq("athlete_id", athleteId)
        .not("completed_at", "is", null)
        .gte("completed_at", startOfDay(sevenDaysAgo).toISOString())
        .lte("completed_at", endOfDay(today).toISOString());

      if (error) throw error;

      const sessions = (data || []) as TrainingSession[];
      
      // Calculer les charges journalières
      const dailyLoadsMap = new Map<string, { load: number; sessions: number }>();
      
      // Initialiser les 7 jours
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(today, i), "yyyy-MM-dd");
        dailyLoadsMap.set(date, { load: 0, sessions: 0 });
      }

      // Ajouter les charges des sessions
      sessions.forEach(session => {
        if (session.duration_minutes && session.session_rpe) {
          const date = format(new Date(session.completed_at), "yyyy-MM-dd");
          const load = session.duration_minutes * session.session_rpe;
          const current = dailyLoadsMap.get(date) || { load: 0, sessions: 0 };
          dailyLoadsMap.set(date, { 
            load: current.load + load, 
            sessions: current.sessions + 1 
          });
        }
      });

      const dailyLoads: DailyLoad[] = Array.from(dailyLoadsMap.entries())
        .map(([date, data]) => ({
          date,
          load: data.load,
          sessions: data.sessions
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const loads = dailyLoads.map(d => d.load);
      const weeklyLoad = loads.reduce((sum, l) => sum + l, 0);
      const meanLoad = weeklyLoad / 7;

      // Calcul de l'écart-type
      const squaredDiffs = loads.map(l => Math.pow(l - meanLoad, 2));
      const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / 7;
      const stdDev = Math.sqrt(variance);

      // Monotonie et contrainte
      const monotony = stdDev > 0 ? meanLoad / stdDev : 0;
      const strain = weeklyLoad * monotony;

      setMonotonyData({
        dailyLoads,
        weeklyLoad,
        meanLoad,
        stdDev,
        monotony,
        strain
      });
    } catch (error) {
      console.error("Error loading monotony data:", error);
    }
  };

  const chartData = [...logs]
    .reverse()
    .map(log => ({
      date: format(new Date(log.date), "dd/MM", { locale: fr }),
      score: log.score_total,
      // Si pas de douleur ce jour-là, considérer comme 0 (pour que la courbe descende)
      injury:
        log.injury_level !== null && log.injury_level !== undefined
          ? log.injury_level
          : log.has_injury === false
            ? 0
            : null,
    }));

  // Inclure les entrées avec douleur active OU douleur terminée (niveau 0)
  const injuryLogs = logs.filter(log => log.injury_level !== null && log.injury_level !== undefined);
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
              <h4 className="font-medium text-sm">Dernières entrées douleur :</h4>
              {injuryLogs.slice(0, 5).map((log) => (
                <div 
                  key={log.id} 
                  className={`flex justify-between items-start text-sm border-l-2 pl-3 py-1 ${
                    log.injury_level === 0 ? 'border-green-500' : 'border-destructive'
                  }`}
                >
                  <div>
                    <p className="font-medium">
                      {format(new Date(log.date), "dd MMMM yyyy", { locale: fr })}
                    </p>
                    {log.injury_location && log.injury_level !== 0 && (
                      <p className="text-muted-foreground text-xs">{log.injury_location}</p>
                    )}
                  </div>
                  {log.injury_level === 0 ? (
                    <Badge className="bg-green-500/20 text-green-500 border-green-500/50">Terminée</Badge>
                  ) : (
                    <Badge variant="destructive">{log.injury_level}/7</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Indice de Monotonie */}
      {monotonyData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Indice de Monotonie (7 derniers jours)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Métriques principales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-primary">{monotonyData.weeklyLoad.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Charge hebdo (UA)</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-primary">{monotonyData.meanLoad.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Charge moy./jour</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className={`text-2xl font-bold ${
                  monotonyData.monotony > 2 ? 'text-destructive' : 
                  monotonyData.monotony > 1.5 ? 'text-orange-500' : 'text-green-500'
                }`}>
                  {monotonyData.monotony.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">Monotonie</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className={`text-2xl font-bold ${
                  monotonyData.strain > 6000 ? 'text-destructive' : 
                  monotonyData.strain > 4000 ? 'text-orange-500' : 'text-green-500'
                }`}>
                  {monotonyData.strain.toFixed(0)}
                </p>
                <p className="text-xs text-muted-foreground">Contrainte</p>
              </div>
            </div>

            {/* Interprétation */}
            <div className="p-3 rounded-lg bg-muted/30 text-sm">
              <p className="font-medium mb-1">Interprétation :</p>
              <ul className="text-muted-foreground space-y-1 text-xs">
                <li>• <span className="text-green-500 font-medium">Monotonie &lt; 1.5</span> : Bonne variabilité</li>
                <li>• <span className="text-orange-500 font-medium">Monotonie 1.5-2</span> : À surveiller</li>
                <li>• <span className="text-destructive font-medium">Monotonie &gt; 2</span> : Risque de surentraînement</li>
              </ul>
            </div>

            {/* Graphique des charges journalières */}
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monotonyData.dailyLoads.map(d => ({
                ...d,
                date: format(new Date(d.date), "EEE dd/MM", { locale: fr })
              }))}>
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
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                  formatter={(value: number) => [`${value} UA`, 'Charge']}
                />
                <Line 
                  type="monotone" 
                  dataKey="load" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                  name="Charge"
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Tableau détaillé */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jour</TableHead>
                  <TableHead className="text-center">Sessions</TableHead>
                  <TableHead className="text-right">Charge (UA)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monotonyData.dailyLoads.map((day) => (
                  <TableRow key={day.date}>
                    <TableCell className="font-medium">
                      {format(new Date(day.date), "EEEE dd MMM", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-center">
                      {day.sessions > 0 ? (
                        <Badge variant="secondary">{day.sessions}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {day.load > 0 ? (
                        <Badge variant={day.load > monotonyData.meanLoad * 1.5 ? "destructive" : "outline"}>
                          {day.load}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Repos</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <p className="text-xs text-muted-foreground">
              UA = Unités Arbitraires (Durée × RPE). La monotonie mesure la variabilité de l'entraînement.
            </p>
          </CardContent>
        </Card>
      )}

      <FatigueDetailedCharts logs={logs} />

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
                      {log.injury_level !== null && log.injury_level !== undefined ? (
                        log.injury_level === 0 ? (
                          <Badge className="bg-green-500/20 text-green-500 border-green-500/50">Terminée</Badge>
                        ) : (
                          <Badge variant="destructive">{log.injury_level}/7</Badge>
                        )
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
