import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { DailyFatigueDialog } from "@/components/DailyFatigueDialog";
import { useToast } from "@/hooks/use-toast";

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
  const firstName = profile?.first_name || "champion";
  const [logs, setLogs] = useState<FatigueLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [injuryTrackingEnabled, setInjuryTrackingEnabled] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [canAnswerToday, setCanAnswerToday] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadFatigueLogs();
    loadNotificationPreference();
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

  // Limiter les données du graphique pour mobile (7 derniers jours sur petit écran)
  const getChartData = () => {
    const reversedLogs = [...logs].reverse();
    const isMobile = window.innerWidth < 640;
    const dataToShow = isMobile ? reversedLogs.slice(-7) : reversedLogs;
    
    return dataToShow.map(log => ({
      date: format(new Date(log.date), isMobile ? "dd/MM" : "dd/MM", { locale: fr }),
      score: log.score_total,
      injury: log.has_injury && log.injury_level ? log.injury_level : null,
    }));
  };

  const chartData = getChartData();
  const injuryLogs = logs.filter(log => log.has_injury && log.injury_level);

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
          {canAnswerToday && (
            <Button onClick={() => setShowDialog(true)} size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Répondre aujourd'hui
            </Button>
          )}
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
                <CardTitle className="text-base sm:text-lg">Évolution du score total</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {window.innerWidth < 640 && logs.length > 7 ? "7 derniers jours" : "Tous les jours"}
                </p>
              </CardHeader>
              <CardContent className="pb-4" style={{ width: '100%', padding: '0 8px 16px 8px' }}>
                <div style={{ width: '100%', height: '200px', maxWidth: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ left: -25, right: 5, top: 10, bottom: 5 }}>
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
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                          fontSize: '10px',
                          padding: '6px 8px',
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

            {injuryTrackingEnabled && injuryLogs.length > 0 && (
              <Card className="w-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base sm:text-lg">Suivi des blessures</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {window.innerWidth < 640 && logs.length > 7 ? "7 derniers jours" : "Tous les jours"}
                  </p>
                </CardHeader>
                <CardContent className="pb-4" style={{ width: '100%', padding: '0 8px 16px 8px' }}>
                  <div style={{ width: '100%', height: '200px', maxWidth: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ left: -25, right: 5, top: 10, bottom: 5 }}>
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
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px',
                            fontSize: '10px',
                            padding: '6px 8px',
                          }}
                        />
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
                      <div key={log.id} className="flex justify-between items-start text-xs border-l-3 border-destructive pl-2 py-1.5 bg-destructive/5 rounded-r">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="font-medium text-[11px]">
                            {format(new Date(log.date), "dd/MM/yy", { locale: fr })}
                          </p>
                          {log.injury_location && (
                            <p className="text-muted-foreground text-[10px] truncate mt-0.5">
                              {log.injury_location}
                            </p>
                          )}
                        </div>
                        <span className="text-destructive font-bold shrink-0 text-xs">
                          {log.injury_level}/7
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="w-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">Historique</CardTitle>
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
                        {injuryTrackingEnabled && (
                          <TableHead className="text-[10px] px-1 py-2 text-center w-[50px]">Doul.</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
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
                          {injuryTrackingEnabled && (
                            <TableCell className="text-[10px] px-1 py-2 text-center">
                              {log.has_injury ? (
                                <span className="text-destructive font-bold">{log.injury_level}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Card className="w-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Paramètres</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <DailyFatigueDialog 
          open={showDialog} 
          onClose={handleDialogClose}
          includeInjuryQuestions={injuryTrackingEnabled}
        />
      </div>
    </div>
  );
}