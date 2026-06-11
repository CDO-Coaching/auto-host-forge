import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";
import { format, subDays, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, ChevronDown, Pencil } from "lucide-react";
import { DailyFatigueDialog } from "@/components/DailyFatigueDialog";
import { EditFatigueDialog } from "@/components/EditFatigueDialog";
import { useToast } from "@/hooks/use-toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FatigueDetailedCharts } from "@/components/FatigueDetailedCharts";
import { FatigueRadarCard } from "@/components/sportif/FatigueRadarCard";
import { FatigueAITipCard } from "@/components/sportif/FatigueAITipCard";
import { AthleteSfmsResults } from "@/components/AthleteSfmsResults";

type ChartPeriod = "7d" | "1m" | "3m" | "6m";


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

export default function Fatigue() {
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const firstName = profile?.first_name || "champion";
  const [logs, setLogs] = useState<FatigueLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  
  const [fatigueAlertEnabled, setFatigueAlertEnabled] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingLog, setEditingLog] = useState<FatigueLog | null>(null);
  const [canAnswerToday, setCanAnswerToday] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("7d");
  const [injuryChartPeriod, setInjuryChartPeriod] = useState<ChartPeriod>("7d");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadFatigueLogs();
    loadNotificationPreference();
    loadNotificationPreference();
    loadFatigueAlertPreference();
    checkIfCanAnswerToday();
  }, []);

  const checkIfCanAnswerToday = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from("daily_fatigue_log")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      setCanAnswerToday(!data);
    } catch (error) {
      console.error("Error checking today's log:", error);
    }
  };

  const loadNotificationPreference = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const preference = localStorage.getItem(`fatigue_notifications_${user.id}`);
      setNotificationsEnabled(preference !== 'false');
    } catch (error) {
      console.error("Error loading notification preference:", error);
    }
  };


  const loadFatigueAlertPreference = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const preference = localStorage.getItem(`fatigue_alert_${user.id}`);
      setFatigueAlertEnabled(preference !== 'false');
    } catch (error) {
      console.error("Error loading fatigue alert preference:", error);
    }
  };

  const handleFatigueAlertToggle = async (checked: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      localStorage.setItem(`fatigue_alert_${user.id}`, checked.toString());
      setFatigueAlertEnabled(checked);
      
      toast({
        title: checked ? "Alerte fatigue activée" : "Alerte fatigue désactivée",
        description: checked 
          ? "Tu recevras des alertes basées sur ton sommeil et stress." 
          : "Les alertes de fatigue ne seront plus affichées.",
      });
    } catch (error) {
      console.error("Error saving fatigue alert preference:", error);
    }
  };

  const loadFatigueLogs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("daily_fatigue_log")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error loading fatigue logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationToggle = async (checked: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      localStorage.setItem(`fatigue_notifications_${user.id}`, checked.toString());
      setNotificationsEnabled(checked);
      
      toast({
        title: checked ? "Notifications activées" : "Notifications désactivées",
        description: checked 
          ? "Tu recevras le questionnaire quotidien à ta connexion." 
          : "Tu ne recevras plus le questionnaire automatiquement.",
      });
    } catch (error) {
      console.error("Error saving notification preference:", error);
    }
  };

  const handleDialogClose = () => {
    setShowDialog(false);
    loadFatigueLogs();
    checkIfCanAnswerToday();
  };

  const handleEditDialogClose = () => {
    setShowEditDialog(false);
    setEditingLog(null);
    loadFatigueLogs();
  };

  const handleEditLog = (log: FatigueLog) => {
    setEditingLog(log);
    setShowEditDialog(true);
  };

  // Fonction pour filtrer les données par période
  const filterByPeriod = (data: FatigueLog[], period: ChartPeriod) => {
    const now = new Date();
    let cutoffDate: Date;
    
    switch (period) {
      case "7d":
        cutoffDate = subDays(now, 7);
        break;
      case "1m":
        cutoffDate = subMonths(now, 1);
        break;
      case "3m":
        cutoffDate = subMonths(now, 3);
        break;
      case "6m":
        cutoffDate = subMonths(now, 6);
        break;
      default:
        cutoffDate = subDays(now, 7);
    }
    
    return data.filter(log => new Date(log.date) >= cutoffDate);
  };

  // Données filtrées pour le graphique de fatigue
  const getChartData = useMemo(() => {
    const filteredLogs = filterByPeriod(logs, chartPeriod);
    const reversedLogs = [...filteredLogs].reverse();
    
    return reversedLogs.map(log => ({
      date: format(new Date(log.date), "dd/MM", { locale: fr }),
      score: log.score_total,
      // Si pas de douleur ce jour-là, considérer comme 0 (pour que la courbe descende)
      injury:
        log.injury_level !== null && log.injury_level !== undefined
          ? log.injury_level
          : log.has_injury === false
            ? 0
            : null,
      injuryLocation: log.injury_location || null,
    }));
  }, [logs, chartPeriod]);

  const getInjuryChartData = useMemo(() => {
    const filteredLogs = filterByPeriod(logs, injuryChartPeriod);
    const reversedLogs = [...filteredLogs].reverse();
    
    return reversedLogs.map(log => ({
      date: format(new Date(log.date), "dd/MM", { locale: fr }),
      score: log.score_total,
      // Si pas de douleur ce jour-là, considérer comme 0 (pour que la courbe descende)
      injury:
        log.injury_level !== null && log.injury_level !== undefined
          ? log.injury_level
          : log.has_injury === false
            ? 0
            : null,
      injuryLocation: log.injury_location || null,
    }));
  }, [logs, injuryChartPeriod]);

  // Historique limité ou complet
  const historyLogs = useMemo(() => {
    if (showAllHistory) return logs;
    return logs.slice(0, 7);
  }, [logs, showAllHistory]);

  // Tooltip personnalisé pour le graphique des blessures
  const CustomInjuryTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div 
          style={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
            padding: '8px 10px',
            fontSize: '11px',
          }}
        >
          <p style={{ fontWeight: 600, marginBottom: '4px' }}>{data.date}</p>
          {data.injury !== null ? (
            data.injury === 0 ? (
              <p style={{ color: 'hsl(142 76% 36%)', fontWeight: 600 }}>
                Terminée ✓
              </p>
            ) : (
              <>
                <p style={{ color: 'hsl(var(--destructive))', fontWeight: 600 }}>
                  Douleur: {data.injury}/7
                </p>
                {data.injuryLocation && (
                  <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '10px', marginTop: '4px' }}>
                    {data.injuryLocation}
                  </p>
                )}
              </>
            )
          ) : (
            <p style={{ color: 'hsl(var(--muted-foreground))' }}>Aucune douleur</p>
          )}
        </div>
      );
    }
    return null;
  };

  const chartData = getChartData;
  const injuryChartData = getInjuryChartData;
  // Inclure les entrées avec douleur active OU douleur terminée (niveau 0)
  const injuryLogs = logs.filter(log => log.injury_level !== null && log.injury_level !== undefined);

  return (
    <div className="w-full min-h-screen overflow-x-hidden">
      <div className="space-y-4 pb-6 px-3 sm:px-4">
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Ton suivi fatigue</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {firstName}, suis ton niveau de fatigue pour optimiser tes performances
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {canAnswerToday && (
              <Button onClick={() => setShowDialog(true)} size="sm" className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Répondre aujourd'hui
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => navigate("/sportif/questionnaire-surentrainement")}
            >
              Questionnaire surentraînement
            </Button>
          </div>
        </div>

        {loading ? (
          <Card className="w-full">
            <CardContent className="py-8">
              <p className="text-muted-foreground text-center text-sm">Chargement...</p>
            </CardContent>
          </Card>
        ) : logs.length === 0 ? (
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Aucune donnée</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {firstName}, commence à enregistrer tes données de fatigue pour que ton coach 
                puisse adapter ton programme. L'écoute de ton corps est essentielle ! 🎯
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="w-full">
              <CardHeader className="pb-2">
                <div className="flex flex-col gap-2">
                  <CardTitle className="text-base sm:text-lg">Évolution du score total</CardTitle>
                  <ToggleGroup
                    type="single"
                    value={chartPeriod}
                    onValueChange={(value) => value && setChartPeriod(value as ChartPeriod)}
                    className="justify-start"
                  >
                    <ToggleGroupItem value="7d" size="sm" className="text-xs px-2 h-7">7j</ToggleGroupItem>
                    <ToggleGroupItem value="1m" size="sm" className="text-xs px-2 h-7">1 mois</ToggleGroupItem>
                    <ToggleGroupItem value="3m" size="sm" className="text-xs px-2 h-7">3 mois</ToggleGroupItem>
                    <ToggleGroupItem value="6m" size="sm" className="text-xs px-2 h-7">6 mois</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </CardHeader>
              <CardContent className="pb-4" style={{ width: '100%', padding: '0 8px 16px 8px' }}>
                <div style={{ width: '100%', height: '200px', maxWidth: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ left: -25, right: 5, top: 10, bottom: 5 }}>
                      {/* Zones de couleur pour le score total */}
                      <ReferenceArea y1={4} y2={9} fill="hsl(142 76% 36%)" fillOpacity={0.15} />
                      <ReferenceArea y1={9} y2={14} fill="hsl(142 76% 36%)" fillOpacity={0.1} />
                      <ReferenceArea y1={14} y2={18} fill="hsl(45 93% 47%)" fillOpacity={0.15} />
                      <ReferenceArea y1={18} y2={22} fill="hsl(0 84% 60%)" fillOpacity={0.15} />
                      <ReferenceArea y1={22} y2={28} fill="hsl(0 84% 60%)" fillOpacity={0.25} />
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                        height={25}
                        tickMargin={5}
                      />
                      <YAxis 
                        domain={[4, 28]}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                        width={30}
                        tickMargin={5}
                        ticks={[4, 9, 14, 18, 22, 28]}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const score = payload[0].value as number;
                            let status = "";
                            let statusColor = "";
                            if (score >= 4 && score <= 9) {
                              status = "Très bon";
                              statusColor = "hsl(142 76% 36%)";
                            } else if (score >= 10 && score <= 14) {
                              status = "Bon";
                              statusColor = "hsl(142 76% 36%)";
                            } else if (score >= 15 && score <= 18) {
                              status = "Alerte";
                              statusColor = "hsl(45 93% 47%)";
                            } else if (score >= 19 && score <= 22) {
                              status = "Risque";
                              statusColor = "hsl(0 84% 60%)";
                            } else if (score >= 23) {
                              status = "Critique";
                              statusColor = "hsl(0 84% 45%)";
                            }
                            return (
                              <div style={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '6px',
                                fontSize: '10px',
                                padding: '6px 8px',
                              }}>
                                <p style={{ fontWeight: 600, marginBottom: '4px' }}>{payload[0].payload.date}</p>
                                <p>Score: <strong>{score}/28</strong></p>
                                <p style={{ color: statusColor, fontWeight: 600 }}>{status}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="score" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2.5}
                        dot={{ fill: 'hsl(var(--primary))', r: 4, strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6 }}
                        name="Score"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {injuryLogs.length > 0 && (
              <Card className="w-full">
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-2">
                    <CardTitle className="text-base sm:text-lg">Suivi des douleurs</CardTitle>
                    <ToggleGroup
                      type="single"
                      value={injuryChartPeriod}
                      onValueChange={(value) => value && setInjuryChartPeriod(value as ChartPeriod)}
                      className="justify-start"
                    >
                      <ToggleGroupItem value="7d" size="sm" className="text-xs px-2 h-7">7j</ToggleGroupItem>
                      <ToggleGroupItem value="1m" size="sm" className="text-xs px-2 h-7">1 mois</ToggleGroupItem>
                      <ToggleGroupItem value="3m" size="sm" className="text-xs px-2 h-7">3 mois</ToggleGroupItem>
                      <ToggleGroupItem value="6m" size="sm" className="text-xs px-2 h-7">6 mois</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </CardHeader>
                <CardContent className="pb-4" style={{ width: '100%', padding: '0 8px 16px 8px' }}>
                  <div style={{ width: '100%', height: '200px', maxWidth: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={injuryChartData} margin={{ left: -25, right: 5, top: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                          height={25}
                          tickMargin={5}
                        />
                        <YAxis 
                          domain={[0, 7]}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                          width={30}
                          tickMargin={5}
                        />
                        <Tooltip content={<CustomInjuryTooltip />} />
                        <Line 
                          type="monotone" 
                          dataKey="injury" 
                          stroke="hsl(var(--destructive))" 
                          strokeWidth={2.5}
                          dot={{ fill: 'hsl(var(--destructive))', r: 4, strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 6 }}
                          name="Douleur"
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 space-y-2" style={{ padding: '0 8px' }}>
                    {injuryLogs.slice(0, 3).map((log) => (
                      <div 
                        key={log.id} 
                        className={`flex justify-between items-start text-xs border-l-3 pl-2 py-1.5 rounded-r ${
                          log.injury_level === 0 
                            ? 'border-green-500 bg-green-500/5' 
                            : 'border-destructive bg-destructive/5'
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="font-medium text-[11px]">
                            {format(new Date(log.date), "dd/MM/yy", { locale: fr })}
                          </p>
                          {log.injury_location && log.injury_level !== 0 && (
                            <p className="text-muted-foreground text-[10px] truncate mt-0.5">
                              {log.injury_location}
                            </p>
                          )}
                        </div>
                        <span className={`font-bold shrink-0 text-xs ${
                          log.injury_level === 0 ? 'text-green-500' : 'text-destructive'
                        }`}>
                          {log.injury_level === 0 ? 'Terminée ✓' : `${log.injury_level}/7`}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <FatigueAITipCard logs={logs as any} />

            <div className="grid gap-4 md:grid-cols-2">
              <FatigueRadarCard logs={logs as any} />
              <FatigueDetailedCharts logs={logs} />
            </div>

            <Card className="w-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">Historique</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {showAllHistory ? "Toutes les entrées" : "7 dernières entrées"}
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="w-full overflow-x-auto" style={{ maxWidth: '100%' }}>
                  <Table style={{ minWidth: '100%' }}>
                    <TableHeader>
                      <TableRow className="border-b">
                        <TableHead className="text-[10px] px-2 py-2 sticky left-0 bg-card z-10 w-[60px]">Date</TableHead>
                        <TableHead className="text-[10px] px-1 py-2 text-center w-[45px]">Fat.</TableHead>
                        <TableHead className="text-[10px] px-1 py-2 text-center w-[45px]">Cou.</TableHead>
                        <TableHead className="text-[10px] px-1 py-2 text-center w-[45px]">Som.</TableHead>
                        <TableHead className="text-[10px] px-1 py-2 text-center w-[45px]">Str.</TableHead>
                        <TableHead className="text-[10px] px-1 py-2 text-center font-bold w-[50px]">Total</TableHead>
                        <TableHead className="text-[10px] px-1 py-2 text-center w-[50px]">Doul.</TableHead>
                        <TableHead className="text-[10px] px-1 py-2 text-center w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyLogs.map((log) => (
                        <TableRow key={log.id} className="border-b">
                          <TableCell className="text-[10px] px-2 py-2 font-medium sticky left-0 bg-card z-10 whitespace-nowrap">
                            {format(new Date(log.date), "dd/MM", { locale: fr })}
                          </TableCell>
                          <TableCell className="text-[10px] px-1 py-2 text-center">{log.fatigue}</TableCell>
                          <TableCell className="text-[10px] px-1 py-2 text-center">{log.courbatures}</TableCell>
                          <TableCell className="text-[10px] px-1 py-2 text-center">{log.sommeil}</TableCell>
                          <TableCell className="text-[10px] px-1 py-2 text-center">{log.stress}</TableCell>
                          <TableCell className="text-[10px] px-1 py-2 text-center font-bold">
                            {log.score_total}
                          </TableCell>
                          <TableCell className="text-[10px] px-1 py-2 text-center">
                            {log.has_injury ? (
                              <span className="text-destructive font-bold">{log.injury_level}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-[10px] px-1 py-2 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleEditLog(log)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {logs.length > 7 && (
                  <div className="p-3 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-muted-foreground"
                      onClick={() => setShowAllHistory(!showAllHistory)}
                    >
                      <ChevronDown className={`h-4 w-4 mr-1 transition-transform ${showAllHistory ? "rotate-180" : ""}`} />
                      {showAllHistory ? "Afficher moins" : `Voir tout l'historique (${logs.length} entrées)`}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <Card className="w-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Paramètres</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5 flex-1 min-w-0">
                <Label htmlFor="notifications" className="text-sm font-medium">
                  Notifications quotidiennes
                </Label>
                <p className="text-xs text-muted-foreground leading-snug">
                  Recevoir le questionnaire à chaque connexion
                </p>
              </div>
              <Switch
                id="notifications"
                checked={notificationsEnabled}
                onCheckedChange={handleNotificationToggle}
                className="shrink-0"
              />
            </div>
            <div className="flex items-start justify-between gap-3 pt-2 border-t">
              <div className="space-y-0.5 flex-1 min-w-0">
                <Label htmlFor="fatigue-alert" className="text-sm font-medium">
                  Alertes de fatigue
                </Label>
                <p className="text-xs text-muted-foreground leading-snug">
                  Afficher des alertes basées sur ton sommeil et stress
                </p>
              </div>
              <Switch
                id="fatigue-alert"
                checked={fatigueAlertEnabled}
                onCheckedChange={handleFatigueAlertToggle}
                className="shrink-0"
              />
            </div>
          </CardContent>
        </Card>

        {profile?.id && <AthleteSfmsResults athleteId={profile.id} />}

        <DailyFatigueDialog 
          open={showDialog} 
          onClose={handleDialogClose}
          includeInjuryQuestions={true}
          isFemale={profile?.gender === 'female'}
        />

        <EditFatigueDialog
          open={showEditDialog}
          onClose={handleEditDialogClose}
          logs={logs}
          initialLog={editingLog}
        />
      </div>
    </div>
  );
}