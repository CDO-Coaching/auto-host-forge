import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, Activity, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FatigueDetailedCharts } from "@/components/FatigueDetailedCharts";
import { CoachSfmsRequestToggle } from "@/components/CoachSfmsRequestToggle";

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

interface MonotonyPoint {
  date: string;
  monotony: number;
  strain: number;
  weeklyLoad: number;
}

interface MonotonyData {
  dailyLoads: DailyLoad[];
  monotonyHistory: MonotonyPoint[];
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
  const [acwrData, setAcwrData] = useState<{ acwr: number | null; acute: number; chronic: number } | null>(null);

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
      // Récupérer 35 jours pour calculer la monotonie glissante sur 14 jours + ACWR (28j chronique)
      const thirtyFiveDaysAgo = subDays(today, 34);

      // Récupérer les semaines de l'athlète
      const { data: weeks, error: weeksError } = await supabase
        .from("training_weeks")
        .select("id")
        .eq("athlete_id", athleteId);

      if (weeksError) throw weeksError;

      const weekIds = (weeks || []).map(w => w.id);

      if (weekIds.length === 0) {
        setMonotonyData(null);
        setAcwrData(null);
        return;
      }

      // Récupérer les sessions des 35 derniers jours via week_id
      const { data, error } = await supabase
        .from("training_sessions")
        .select("id, completed_at, duration_minutes, session_rpe")
        .in("week_id", weekIds)
        .not("completed_at", "is", null)
        .gte("completed_at", startOfDay(thirtyFiveDaysAgo).toISOString())
        .lte("completed_at", endOfDay(today).toISOString());

      if (error) throw error;

      const sessions = (data || []) as TrainingSession[];

      // Calculer les charges journalières pour tous les 35 jours
      const allDailyLoadsMap = new Map<string, { load: number; sessions: number }>();

      for (let i = 34; i >= 0; i--) {
        const date = format(subDays(today, i), "yyyy-MM-dd");
        allDailyLoadsMap.set(date, { load: 0, sessions: 0 });
      }

      sessions.forEach(session => {
        if (session.duration_minutes && session.session_rpe) {
          const date = format(new Date(session.completed_at), "yyyy-MM-dd");
          const load = session.duration_minutes * session.session_rpe;
          const current = allDailyLoadsMap.get(date) || { load: 0, sessions: 0 };
          allDailyLoadsMap.set(date, { 
            load: current.load + load, 
            sessions: current.sessions + 1 
          });
        }
      });

      const allDailyLoads = Array.from(allDailyLoadsMap.entries())
        .map(([date, data]) => ({
          date,
          load: data.load,
          sessions: data.sessions
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Calculer ACWR
      // acute = somme des 7 derniers jours, chronic = somme des 28 derniers jours / 4
      const last35 = allDailyLoads; // 35 days sorted asc
      const acuteLoads = last35.slice(-7).map(d => d.load);
      const chronicLoads = last35.slice(-28).map(d => d.load);
      const acuteSum = acuteLoads.reduce((s, l) => s + l, 0);
      const chronicSum = chronicLoads.reduce((s, l) => s + l, 0);
      const chronic = chronicSum / 4;
      const acwr = chronic > 0 ? acuteSum / chronic : null;
      setAcwrData({ acwr, acute: acuteSum, chronic });

      // Calculer la monotonie glissante pour les 14 derniers jours
      // On utilise seulement les 21 derniers jours pour la fenêtre glissante (index 14..34)
      const monotonyHistory: MonotonyPoint[] = [];

      for (let i = 20; i <= 34; i++) {
        const windowLoads = allDailyLoads.slice(i - 6, i + 1).map(d => d.load);
        const windowWeeklyLoad = windowLoads.reduce((sum, l) => sum + l, 0);
        const windowMeanLoad = windowWeeklyLoad / 7;
        
        const squaredDiffs = windowLoads.map(l => Math.pow(l - windowMeanLoad, 2));
        const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / 7;
        const stdDev = Math.sqrt(variance);
        
        const windowMonotony = stdDev > 0 ? windowMeanLoad / stdDev : 0;
        const windowStrain = windowWeeklyLoad * windowMonotony;
        
        monotonyHistory.push({
          date: allDailyLoads[i].date,
          monotony: windowMonotony,
          strain: windowStrain,
          weeklyLoad: windowWeeklyLoad
        });
      }

      // Données actuelles pour la carte Monotonie (7 derniers jours)
      const currentDailyLoads = allDailyLoads.slice(-7);
      const loads = currentDailyLoads.map(d => d.load);
      const weeklyLoad = loads.reduce((sum, l) => sum + l, 0);
      const meanLoad = weeklyLoad / 7;

      const squaredDiffs = loads.map(l => Math.pow(l - meanLoad, 2));
      const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / 7;
      const stdDev = Math.sqrt(variance);

      const monotony = stdDev > 0 ? meanLoad / stdDev : 0;
      const strain = weeklyLoad * monotony;

      setMonotonyData({
        dailyLoads: currentDailyLoads,
        monotonyHistory,
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
      <div className="space-y-4">
        <CoachSfmsRequestToggle athleteId={athleteId} athleteName={athleteName} />
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
      </div>
    );
  }

  // Score de préparation
  const readinessScore = (() => {
    if (logs.length === 0 || !monotonyData) return null;

    // ACWR (30%)
    let acwrScore = 50;
    if (acwrData?.acwr !== null && acwrData?.acwr !== undefined) {
      const r = acwrData.acwr;
      if (r >= 0.8 && r <= 1.3) acwrScore = 100;
      else if (r >= 0.6 && r < 0.8) acwrScore = 70;
      else if (r > 1.3 && r <= 1.5) acwrScore = 70;
      else acwrScore = 30;
    }

    // Monotonie (25%)
    let monotonyScore = 50;
    if (monotonyData?.monotony !== undefined) {
      const m = monotonyData.monotony;
      if (m < 1.5) monotonyScore = 100;
      else if (m < 2) monotonyScore = 60;
      else monotonyScore = 20;
    }

    // Fatigue questionnaire (25%)
    let fatigueScore = 50;
    if (logs.length > 0) {
      const latest = logs[0];
      const normalized = (28 - latest.score_total) / 24 * 100;
      fatigueScore = Math.max(0, Math.min(100, normalized));
    }

    // Sommeil (20%)
    let sommeilScore = 50;
    if (logs.length > 0) {
      const recent = logs.slice(0, 7);
      const avgSommeil = recent.reduce((s, l) => s + l.sommeil, 0) / recent.length;
      sommeilScore = Math.max(0, Math.min(100, (7 - avgSommeil) / 6 * 100));
    }

    return {
      score: Math.round(acwrScore * 0.30 + monotonyScore * 0.25 + fatigueScore * 0.25 + sommeilScore * 0.20),
      acwrScore,
      monotonyScore,
      fatigueScore,
      sommeilScore,
    };
  })();

  return (
    <div className="space-y-6">
      {/* Score de préparation */}
      {readinessScore && (
        <Card className={
          readinessScore.score >= 80 ? "border-green-500/50 bg-green-500/5" :
          readinessScore.score >= 60 ? "border-orange-500/50 bg-orange-500/5" :
          "border-red-500/50 bg-red-500/5"
        }>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Score de préparation
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    <p>Score synthétique 0-100 combinant : ACWR (30%), Monotonie (25%), Fatigue subjective (25%), Sommeil (20%). ⚠️ Nécessite au moins 4 semaines de données et ≥ 4 jours/semaine de saisie pour être fiable. Un score élevé avec peu de données n'est pas significatif.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6 mb-4">
              <p className={`text-5xl font-bold ${
                readinessScore.score >= 80 ? "text-green-500" :
                readinessScore.score >= 60 ? "text-orange-500" :
                "text-red-500"
              }`}>{readinessScore.score}<span className="text-2xl text-muted-foreground">/100</span></p>
              <p className={`text-lg font-medium ${
                readinessScore.score >= 80 ? "text-green-500" :
                readinessScore.score >= 60 ? "text-orange-500" :
                "text-red-500"
              }`}>
                {readinessScore.score >= 80 ? "Prêt à performer" :
                 readinessScore.score >= 60 ? "Entraînement modéré conseillé" :
                 "Récupération recommandée"}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "ACWR", score: readinessScore.acwrScore, weight: "30%" },
                { label: "Monotonie", score: readinessScore.monotonyScore, weight: "25%" },
                { label: "Fatigue", score: readinessScore.fatigueScore, weight: "25%" },
                { label: "Sommeil", score: readinessScore.sommeilScore, weight: "20%" },
              ].map(({ label, score, weight }) => (
                <div key={label} className="text-center p-3 rounded-lg bg-muted/50">
                  <p className={`text-xl font-bold ${
                    score >= 80 ? "text-green-500" :
                    score >= 60 ? "text-orange-500" :
                    "text-red-500"
                  }`}>{Math.round(score)}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground/60">{weight}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <CoachSfmsRequestToggle athleteId={athleteId} athleteName={athleteName} />

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
          <CardTitle className="flex items-center gap-2">
            Évolution du score de fatigue
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help shrink-0" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  <p>Score Cooper 28 (questionnaire Hooper) : 4 items × 7 points max = 28. Score &lt; 12 = bien récupéré, 12-20 = fatigue modérée, &gt; 20 = fatigue élevée. Fiable si renseigné chaque matin avant l'entraînement.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
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
              <RechartsTooltip
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
                <RechartsTooltip
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

      {/* ACWR */}
      {acwrData && acwrData.chronic > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ACWR — Ratio Charge Aiguë / Chronique
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    <p>Ratio charge des 7 derniers jours / charge des 28 derniers jours (basé sur sRPE). Zone verte 0.8-1.3 = optimal. ⚠️ Nécessite 28 jours de RPE renseignés pour être fiable. En reprise d'arrêt ou blessure, l'ACWR peut monter brutalement : c'est normal, mais c'est aussi là que le risque de rechute est le plus élevé.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{acwrData.acute.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Charge 7j (UA)</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{acwrData.chronic.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Charge chronique (UA)</p>
              </div>
              <div className={`text-center p-3 rounded-lg ${
                acwrData.acwr === null ? 'bg-muted/50' :
                acwrData.acwr > 1.5 || acwrData.acwr < 0.6 ? 'bg-red-500/10 border border-red-500/30' :
                acwrData.acwr > 1.3 ? 'bg-orange-500/10 border border-orange-500/30' :
                'bg-green-500/10 border border-green-500/30'
              }`}>
                <p className={`text-2xl font-bold ${
                  acwrData.acwr === null ? 'text-muted-foreground' :
                  acwrData.acwr > 1.5 || acwrData.acwr < 0.6 ? 'text-red-500' :
                  acwrData.acwr > 1.3 ? 'text-orange-500' :
                  'text-green-500'
                }`}>{acwrData.acwr?.toFixed(2) ?? '—'}</p>
                <p className="text-xs text-muted-foreground">ACWR</p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><span className="text-green-500 font-medium">0.8 – 1.3</span> : Zone optimale</p>
              <p><span className="text-orange-500 font-medium">1.3 – 1.5</span> : Attention</p>
              <p><span className="text-red-500 font-medium">&gt;1.5 ou &lt;0.6</span> : Risque de blessure</p>
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    <p>Monotonie = Charge moy. / Écart-type. Mesure la répétitivité. Contrainte = Charge totale × Monotonie. ⚠️ Les jours sans saisie de séance comptent comme repos (charge = 0), ce qui peut artificiellement baisser la monotonie. Interpréter avec le taux de saisie des RPE.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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

            {/* Graphique de l'évolution de la monotonie */}
            <div>
              <p className="text-sm font-medium mb-2">Évolution de la monotonie (14 derniers jours)</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monotonyData.monotonyHistory.map(d => ({
                  ...d,
                  date: format(new Date(d.date), "dd/MM", { locale: fr }),
                  monotonyDisplay: Number(d.monotony.toFixed(2))
                }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    domain={[0, 'auto']}
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <ReferenceLine y={1.5} stroke="hsl(38 92% 50%)" strokeDasharray="5 5" />
                  <ReferenceLine y={2} stroke="hsl(var(--destructive))" strokeDasharray="5 5" />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'monotonyDisplay') return [value.toFixed(2), 'Monotonie'];
                      return [value, name];
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="monotonyDisplay" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                    name="monotonyDisplay"
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex gap-4 text-xs text-muted-foreground mt-1 justify-center">
                <span className="flex items-center gap-1">
                  <span className="w-4 h-0.5 bg-orange-500"></span> Seuil attention (1.5)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-4 h-0.5 bg-destructive"></span> Seuil risque (2.0)
                </span>
              </div>
            </div>

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
