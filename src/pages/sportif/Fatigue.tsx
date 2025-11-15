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
  const [injuryTrackingEnabled, setInjuryTrackingEnabled] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [canAnswerToday, setCanAnswerToday] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadFatigueLogs();
    loadNotificationPreference();
    loadInjuryTrackingPreference();
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

  const loadInjuryTrackingPreference = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const preference = localStorage.getItem(`injury_tracking_${user.id}`);
      setInjuryTrackingEnabled(preference === 'true');
    } catch (error) {
      console.error("Error loading injury tracking preference:", error);
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

  const handleInjuryTrackingToggle = async (checked: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      localStorage.setItem(`injury_tracking_${user.id}`, checked.toString());
      setInjuryTrackingEnabled(checked);
      
      toast({
        title: checked ? "Suivi blessures activé" : "Suivi blessures désactivé",
        description: checked 
          ? "Des questions sur les blessures seront ajoutées au questionnaire." 
          : "Les questions sur les blessures ne seront plus posées.",
      });
    } catch (error) {
      console.error("Error saving injury tracking preference:", error);
    }
  };

  const handleDialogClose = () => {
    setShowDialog(false);
    loadFatigueLogs();
    checkIfCanAnswerToday();
  };

  const chartData = [...logs]
    .reverse()
    .map(log => ({
      date: format(new Date(log.date), "dd/MM", { locale: fr }),
      score: log.score_total,
      injury: log.has_injury && log.injury_level ? log.injury_level : null,
    }));

  const injuryLogs = logs.filter(log => log.has_injury && log.injury_level);

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Ton suivi fatigue</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
            {firstName}, suis ton niveau de fatigue pour optimiser tes performances
          </p>
        </div>
        {canAnswerToday && (
          <Button onClick={() => setShowDialog(true)} size="sm" className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Répondre aujourd'hui
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-lg sm:text-xl">Paramètres</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="notifications" className="text-sm sm:text-base">
                Notifications quotidiennes
              </Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Recevoir le questionnaire automatiquement à chaque connexion
              </p>
            </div>
            <Switch
              id="notifications"
              checked={notificationsEnabled}
              onCheckedChange={handleNotificationToggle}
              className="self-start sm:self-auto"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="injury-tracking" className="text-sm sm:text-base">
                Suivi blessures/douleurs
              </Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Ajouter des questions sur les blessures dans le questionnaire
              </p>
            </div>
            <Switch
              id="injury-tracking"
              checked={injuryTrackingEnabled}
              onCheckedChange={handleInjuryTrackingToggle}
              className="self-start sm:self-auto"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-muted-foreground text-center">Chargement...</p>
          </CardContent>
        </Card>
      ) : logs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Aucune donnée</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {firstName}, commence à enregistrer tes données de fatigue pour que ton coach 
              puisse adapter ton programme. L'écoute de ton corps est essentielle ! 🎯
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="px-3 py-4 sm:px-6 sm:py-6">
              <CardTitle className="text-base sm:text-lg md:text-xl">Évolution du score total</CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <div className="w-full h-[220px] sm:h-[280px] md:h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ left: 0, right: 8, top: 5, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      height={30}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      domain={[4, 28]}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      width={28}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: '11px',
                        padding: '8px',
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                      name="Score fatigue"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {injuryTrackingEnabled && injuryLogs.length > 0 && (
            <Card>
              <CardHeader className="px-3 py-4 sm:px-6 sm:py-6">
                <CardTitle className="text-base sm:text-lg md:text-xl">Suivi des blessures/douleurs</CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                <div className="w-full h-[220px] sm:h-[280px] md:h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ left: 0, right: 8, top: 5, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                        height={30}
                        interval="preserveStartEnd"
                      />
                      <YAxis 
                        domain={[0, 7]}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                        width={28}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                          fontSize: '11px',
                          padding: '8px',
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="injury" 
                        stroke="hsl(var(--destructive))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--destructive))', r: 3 }}
                        name="Niveau de douleur"
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 px-3 sm:px-0 space-y-2">
                  {injuryLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="flex justify-between items-start text-xs sm:text-sm border-l-2 border-destructive pl-2 sm:pl-3 py-1">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">
                          <span className="sm:hidden">{format(new Date(log.date), "dd/MM/yy", { locale: fr })}</span>
                          <span className="hidden sm:inline">{format(new Date(log.date), "dd MMMM yyyy", { locale: fr })}</span>
                        </p>
                        {log.injury_location && (
                          <p className="text-muted-foreground text-[10px] sm:text-xs truncate">{log.injury_location}</p>
                        )}
                      </div>
                      <span className="text-destructive font-medium ml-2 flex-shrink-0 text-xs sm:text-sm">{log.injury_level}/7</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="px-3 py-4 sm:px-6 sm:py-6">
              <CardTitle className="text-base sm:text-lg md:text-xl">Historique</CardTitle>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              <div className="w-full overflow-x-auto">
                <div className="min-w-[600px] px-3 sm:px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] sm:text-xs md:text-sm px-2 sm:px-4">Date</TableHead>
                        <TableHead className="text-[10px] sm:text-xs md:text-sm px-2 sm:px-4">Fatigue</TableHead>
                        <TableHead className="text-[10px] sm:text-xs md:text-sm px-2 sm:px-4">Courbatures</TableHead>
                        <TableHead className="text-[10px] sm:text-xs md:text-sm px-2 sm:px-4">Sommeil</TableHead>
                        <TableHead className="text-[10px] sm:text-xs md:text-sm px-2 sm:px-4">Stress</TableHead>
                        <TableHead className="text-[10px] sm:text-xs md:text-sm px-2 sm:px-4">Score total</TableHead>
                        {injuryTrackingEnabled && <TableHead className="text-[10px] sm:text-xs md:text-sm px-2 sm:px-4">Douleur</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium text-[10px] sm:text-xs md:text-sm px-2 sm:px-4 whitespace-nowrap">
                            <span className="sm:hidden">{format(new Date(log.date), "dd/MM/yy", { locale: fr })}</span>
                            <span className="hidden sm:inline">{format(new Date(log.date), "dd MMMM yyyy", { locale: fr })}</span>
                          </TableCell>
                          <TableCell className="text-[10px] sm:text-xs md:text-sm px-2 sm:px-4">{log.fatigue}/7</TableCell>
                          <TableCell className="text-[10px] sm:text-xs md:text-sm px-2 sm:px-4">{log.courbatures}/7</TableCell>
                          <TableCell className="text-[10px] sm:text-xs md:text-sm px-2 sm:px-4">{log.sommeil}/7</TableCell>
                          <TableCell className="text-[10px] sm:text-xs md:text-sm px-2 sm:px-4">{log.stress}/7</TableCell>
                          <TableCell className="font-bold text-[10px] sm:text-xs md:text-sm px-2 sm:px-4">{log.score_total}/28</TableCell>
                          {injuryTrackingEnabled && (
                            <TableCell className="text-[10px] sm:text-xs md:text-sm px-2 sm:px-4">
                              {log.has_injury ? (
                                <span className="text-destructive font-medium">{log.injury_level}/7</span>
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
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <DailyFatigueDialog 
        open={showDialog} 
        onClose={handleDialogClose}
        includeInjuryQuestions={injuryTrackingEnabled}
      />
    </div>
  );
}
