import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfWeek, endOfWeek, getISOWeek, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { getWeekYear } from "@/lib/weekUtils";
import { Heart, CheckCircle2, Clock, Calendar, AlertTriangle, Target, Flag } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";

interface CoachClientSummaryViewProps {
  athleteId: string;
  athleteName: string;
}

interface FatigueEntry {
  date: string;
  sleep_quality: number;
  stress_level: number;
  fatigue_level: number;
  soreness_level: number;
  has_injury: boolean;
  injury_level: number | null;
  injury_location: string | null;
}

interface SessionInfo {
  id: string;
  name: string;
  session_type: string;
  completed_at: string | null;
  session_rpe: number | null;
  duration_minutes: number | null;
  scheduled_date: string | null;
  isCustom?: boolean;
}

interface Milestone {
  id: string;
  name: string;
  target_date: string;
  completed: boolean;
}

export function CoachClientSummaryView({ athleteId, athleteName }: CoachClientSummaryViewProps) {
  const [fatigueData, setFatigueData] = useState<FatigueEntry[]>([]);
  const [currentWeekSessions, setCurrentWeekSessions] = useState<SessionInfo[]>([]);
  const [previousWeekSessions, setPreviousWeekSessions] = useState<SessionInfo[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const currentWeekNumber = getISOWeek(today);
  const currentYear = getWeekYear(today);
  let previousWeekNumber = currentWeekNumber - 1;
  let previousYear = currentYear;
  if (previousWeekNumber <= 0) { previousWeekNumber = 52; previousYear = currentYear - 1; }

  useEffect(() => {
    if (!athleteId) return;
    loadAll();
  }, [athleteId]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      loadFatigue(),
      loadWeekSessions(currentWeekNumber, currentYear, setCurrentWeekSessions),
      loadWeekSessions(previousWeekNumber, previousYear, setPreviousWeekSessions),
      loadMilestones(),
    ]);
    setLoading(false);
  };

  const loadFatigue = async () => {
    const thirtyDaysAgo = format(subDays(today, 30), "yyyy-MM-dd");
    const todayStr = format(today, "yyyy-MM-dd");
    const { data } = await supabase
      .from("daily_fatigue_log")
      .select("date, sleep_quality, stress_level, fatigue_level, soreness_level, has_injury, injury_level, injury_location")
      .eq("user_id", athleteId)
      .gte("date", thirtyDaysAgo)
      .lte("date", todayStr)
      .order("date", { ascending: true });
    if (data) setFatigueData(data as FatigueEntry[]);
  };

  const loadMilestones = async () => {
    const { data } = await supabase
      .from("objective_milestones")
      .select("id, name, target_date, completed")
      .eq("athlete_id", athleteId)
      .eq("completed", false)
      .order("target_date", { ascending: true })
      .limit(3);
    if (data) setMilestones(data);
  };

  const loadWeekSessions = async (weekNum: number, year: number, setter: React.Dispatch<React.SetStateAction<SessionInfo[]>>) => {
    const { data: weeks } = await supabase
      .from("training_weeks").select("id").eq("athlete_id", athleteId).eq("week_number", weekNum).eq("year", year);
    let coachSessions: SessionInfo[] = [];
    if (weeks && weeks.length > 0) {
      const { data: sessions } = await supabase
        .from("training_sessions")
        .select("id, name, session_type, completed_at, session_rpe, duration_minutes, scheduled_date")
        .in("week_id", weeks.map(w => w.id)).order("session_number");
      if (sessions) coachSessions = sessions.map(s => ({ ...s, isCustom: false }));
    }
    const weekStart = startOfWeek(new Date(year, 0, 1 + (weekNum - 1) * 7), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const { data: customData } = await supabase
      .from("custom_sessions")
      .select("id, session_name, duration_minutes, completed_at, scheduled_date")
      .eq("user_id", athleteId)
      .or(`completed_at.gte.${weekStart.toISOString()},scheduled_date.gte.${format(weekStart, "yyyy-MM-dd")}`)
      .or(`completed_at.lte.${weekEnd.toISOString()},scheduled_date.lte.${format(weekEnd, "yyyy-MM-dd")}`);
    let custom: SessionInfo[] = [];
    if (customData) {
      custom = customData.filter(cs => {
        const d = cs.completed_at ? new Date(cs.completed_at) : cs.scheduled_date ? new Date(cs.scheduled_date + "T00:00:00") : null;
        return d && d >= weekStart && d <= weekEnd;
      }).map(cs => ({ id: cs.id, name: cs.session_name, session_type: "custom", completed_at: cs.completed_at, session_rpe: null, duration_minutes: cs.duration_minutes, scheduled_date: cs.scheduled_date, isCustom: true }));
    }
    setter([...coachSessions, ...custom]);
  };

  // Chart data: total fatigue score (sum of 4 metrics, sleep inverted)
  const chartData = fatigueData.map(e => {
    const invertedSleep = 8 - e.sleep_quality;
    const total = invertedSleep + e.stress_level + e.fatigue_level + e.soreness_level;
    return { date: format(new Date(e.date + "T00:00:00"), "dd/MM", { locale: fr }), score: total };
  });

  // Injury data
  const injuryEntries = fatigueData.filter(e => e.has_injury && e.injury_level !== null && e.injury_level > 0);
  const latestInjury = injuryEntries.length > 0 ? injuryEntries[injuryEntries.length - 1] : null;
  const injuryChartData = injuryEntries.map(e => ({
    date: format(new Date(e.date + "T00:00:00"), "dd/MM", { locale: fr }),
    douleur: e.injury_level || 0,
  }));

  // Recovery %
  const last5 = fatigueData.slice(-5);
  const recovery = last5.length > 0 ? (() => {
    const avg = last5.reduce((s, e) => s + (8 - e.sleep_quality) + e.stress_level + e.fatigue_level + e.soreness_level, 0) / last5.length;
    return Math.max(0, Math.min(100, Math.round(((28 - avg) / (28 - 4)) * 100)));
  })() : null;

  const completedCurrent = currentWeekSessions.filter(s => s.completed_at).length;
  const completedPrevious = previousWeekSessions.filter(s => s.completed_at).length;

  const getTypeBadge = (s: SessionInfo) => {
    if (s.isCustom) return <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30 text-[9px] px-1.5 py-0">Perso</Badge>;
    if (s.session_type === "cardio") return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30 text-[9px] px-1.5 py-0">Cardio</Badge>;
    if (s.session_type === "recup") return <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-[9px] px-1.5 py-0">Récup</Badge>;
    return <Badge className="bg-purple-500/20 text-purple-600 border-purple-500/30 text-[9px] px-1.5 py-0">Renfo</Badge>;
  };

  const ScoreTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-card border rounded-md p-1.5 text-xs shadow-md">
        <p className="font-semibold">{d.date}</p>
        <p className="text-primary">Score fatigue : {d.score}</p>
      </div>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[200px]"><p className="text-muted-foreground text-sm">Chargement...</p></div>;
  }

  const renderSessionCompact = (sessions: SessionInfo[], label: string, completed: number) => (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium">{label}</span>
        <Badge variant="outline" className="text-[9px] h-4">{completed}/{sessions.length}</Badge>
      </div>
      {sessions.length === 0 ? (
        <p className="text-[10px] text-muted-foreground text-center py-1">Aucune séance</p>
      ) : (
        <div className="space-y-1">
          {sessions.map(s => (
            <div key={s.id} className={`flex items-center justify-between px-2 py-1.5 rounded border text-xs ${s.completed_at ? "bg-green-500/5 border-green-500/20" : "bg-muted/20 border-border"}`}>
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {s.completed_at ? <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" /> : <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                <span className="truncate">{s.name}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {s.duration_minutes && <span className="text-[9px] text-muted-foreground">{s.duration_minutes}min</span>}
                {getTypeBadge(s)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* LEFT COLUMN: Fatigue chart + Injury */}
      <div className="space-y-3">
        {/* Fatigue score chart */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 text-red-500" />
                Évolution du score de fatigue
              </span>
              {recovery !== null && (
                <span className={`text-sm font-bold ${recovery >= 70 ? "text-green-500" : recovery >= 40 ? "text-orange-500" : "text-destructive"}`}>
                  {recovery}%
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-1 pb-2">
            {chartData.length > 0 ? (
              <div style={{ width: "100%", height: "140px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ left: -15, right: 5, top: 5, bottom: 0 }}>
                    <ReferenceArea y1={4} y2={12} fill="hsl(142 76% 36%)" fillOpacity={0.08} />
                    <ReferenceArea y1={12} y2={20} fill="hsl(45 93% 47%)" fillOpacity={0.08} />
                    <ReferenceArea y1={20} y2={28} fill="hsl(0 84% 60%)" fillOpacity={0.08} />
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                    <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 8 }} height={18} interval="preserveStartEnd" />
                    <YAxis domain={[4, 28]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 8 }} width={25} ticks={[4, 10, 16, 22, 28]} />
                    <Tooltip content={<ScoreTooltip />} />
                    <Line type="monotone" dataKey="score" stroke="hsl(45 93% 47%)" strokeWidth={2.5} dot={{ r: 2.5, fill: "hsl(45 93% 47%)", stroke: "hsl(45 93% 47%)" }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground text-center py-6">Aucune donnée de fatigue</p>
            )}
          </CardContent>
        </Card>

        {/* Injury chart (conditional) */}
        {latestInjury && injuryChartData.length > 0 && (
          <Card className="overflow-hidden">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                Douleur — {latestInjury.injury_location || "Non précisé"}
                <Badge variant="destructive" className="text-[9px] ml-auto">{latestInjury.injury_level}/7</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-1 pb-2">
              <div style={{ width: "100%", height: "90px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={injuryChartData} margin={{ left: -15, right: 5, top: 5, bottom: 0 }}>
                    <ReferenceArea y1={0} y2={2} fill="hsl(142 76% 36%)" fillOpacity={0.08} />
                    <ReferenceArea y1={2} y2={4} fill="hsl(45 93% 47%)" fillOpacity={0.08} />
                    <ReferenceArea y1={4} y2={7} fill="hsl(0 84% 60%)" fillOpacity={0.08} />
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                    <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 8 }} height={18} interval="preserveStartEnd" />
                    <YAxis domain={[0, 7]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 8 }} width={20} ticks={[0, 3, 7]} />
                    <Line type="monotone" dataKey="douleur" stroke="hsl(0 84% 60%)" strokeWidth={2} dot={{ r: 2.5, fill: "hsl(0 84% 60%)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Milestones */}
        {milestones.length > 0 && (
          <Card>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-primary" />
                Prochains objectifs
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="space-y-1.5">
                {milestones.map(m => {
                  const diff = differenceInDays(new Date(m.target_date + "T00:00:00"), today);
                  const label = diff < 0 ? `+${Math.abs(diff)}j` : diff === 0 ? "Auj." : `J-${diff}`;
                  const color = diff < 0 ? "text-destructive" : diff <= 7 ? "text-orange-600" : "text-muted-foreground";
                  return (
                    <div key={m.id} className="flex items-center justify-between px-2 py-1.5 rounded border bg-muted/20 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Flag className="h-3 w-3 text-primary flex-shrink-0" />
                        <span className="truncate">{m.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[9px] text-muted-foreground">{format(new Date(m.target_date + "T00:00:00"), "d MMM", { locale: fr })}</span>
                        <Badge variant="outline" className={`text-[9px] h-4 ${color}`}>{label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* RIGHT COLUMN: Sessions */}
      <div className="space-y-3">
        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Séances
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-4">
            {renderSessionCompact(currentWeekSessions, `S${currentWeekNumber} — en cours`, completedCurrent)}
            <div className="border-t pt-3">
              {renderSessionCompact(previousWeekSessions, `S${previousWeekNumber} — précédente`, completedPrevious)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
