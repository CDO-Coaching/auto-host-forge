import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getWeekNumber, getWeekYear } from "@/lib/weekUtils";
import { ChevronLeft, Clock, Activity } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

interface WeekData {
  label: string;      // "S12"
  duration: number;   // minutes
  course: number;     // km
  velo: number;       // km
  natation: number;   // m (distance_km * 1000)
}

function getMondayISO(week: number, year: number): string {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  return monday.toISOString().split("T")[0];
}

function getSundayISO(week: number, year: number): string {
  const mon = getMondayISO(week, year);
  const d = new Date(mon);
  d.setDate(d.getDate() + 6);
  return d.toISOString().split("T")[0];
}

export default function Bilan() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<WeekData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    setLoading(true);
    const now = new Date();
    const currentWeek = getWeekNumber(now);
    const currentYear = getWeekYear(now);

    // Build list of last 12 weeks
    const weeks: { week: number; year: number }[] = [];
    let w = currentWeek, y = currentYear;
    for (let i = 0; i < 12; i++) {
      weeks.unshift({ week: w, year: y });
      w--;
      if (w <= 0) { w = 52; y--; }
    }

    const results: WeekData[] = [];

    for (const { week, year } of weeks) {
      const mondayISO = getMondayISO(week, year);
      const sundayISO = getSundayISO(week, year);

      let duration = 0;
      let course = 0, velo = 0, natation = 0;

      // Training sessions
      const { data: weekRow } = await supabase
        .from("training_weeks")
        .select("id")
        .eq("week_number", week)
        .eq("year", year)
        .eq("athlete_id", user!.id)
        .maybeSingle();

      if (weekRow) {
        const { data: sessions } = await supabase
          .from("training_sessions")
          .select("id, duration_minutes, session_type, cardio_total_distance_km, cardio_total_duration_minutes, session_exercises(actual_distance_km, actual_duration_minutes, cardio_sport)")
          .eq("week_id", weekRow.id)
          .not("completed_at", "is", null);

        if (sessions) {
          for (const s of sessions) {
            const ex = s.session_exercises?.[0];
            duration += ex?.actual_duration_minutes ?? s.duration_minutes ?? s.cardio_total_duration_minutes ?? 0;
            if (s.session_type === "cardio") {
              const dist = ex?.actual_distance_km ?? s.cardio_total_distance_km ?? 0;
              const sport = ex?.cardio_sport ?? "course";
              if (sport === "velo") velo += dist;
              else if (sport === "natation") natation += dist * 1000;
              else course += dist;
            }
          }
        }
      }

      // Custom sessions
      const { data: customs } = await supabase
        .from("custom_sessions")
        .select("duration_minutes, distance_km, cardio_type")
        .eq("user_id", user!.id)
        .not("completed_at", "is", null)
        .gte("completed_at", `${mondayISO}T00:00:00`)
        .lte("completed_at", `${sundayISO}T23:59:59`);

      if (customs) {
        for (const c of customs) {
          duration += c.duration_minutes ?? 0;
          const dist = c.distance_km ?? 0;
          if (dist > 0) {
            const sport = c.cardio_type ?? "course";
            if (sport === "velo") velo += dist;
            else if (sport === "natation") natation += dist * 1000;
            else course += dist;
          }
        }
      }

      results.push({
        label: `S${week}`,
        duration: Math.round(duration),
        course: Math.round(course * 100) / 100,
        velo: Math.round(velo * 100) / 100,
        natation: Math.round(natation),
      });
    }

    setData(results);
    setLoading(false);
  };

  const hasCourse   = data.some((d) => d.course > 0);
  const hasVelo     = data.some((d) => d.velo > 0);
  const hasNatation = data.some((d) => d.natation > 0);

  const formatDur = (min: number) => {
    if (!min) return "0 min";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${min} min`;
  };

  const chartConfig = [
    {
      key: "duration" as const,
      title: "Durée d'entraînement",
      icon: <Clock className="h-4 w-4 text-primary" />,
      color: "hsl(45 93% 47%)",
      unit: "min",
      show: true,
      tooltip: (v: number) => formatDur(v),
      yTickFormat: (v: number) => v >= 60 ? `${Math.floor(v / 60)}h` : `${v}m`,
    },
    {
      key: "course" as const,
      title: "🏃 Course à pied",
      icon: null,
      color: "#22c55e",
      unit: "km",
      show: hasCourse,
      tooltip: (v: number) => `${v} km`,
      yTickFormat: (v: number) => `${v}`,
    },
    {
      key: "velo" as const,
      title: "🚴 Vélo",
      icon: null,
      color: "#3b82f6",
      unit: "km",
      show: hasVelo,
      tooltip: (v: number) => `${v} km`,
      yTickFormat: (v: number) => `${v}`,
    },
    {
      key: "natation" as const,
      title: "🏊 Natation",
      icon: null,
      color: "#06b6d4",
      unit: "m",
      show: hasNatation,
      tooltip: (v: number) => `${v} m`,
      yTickFormat: (v: number) => `${v}`,
    },
  ].filter((c) => c.show);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/40 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h1 className="font-semibold text-base">Bilan — 12 dernières semaines</h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        {loading ? (
          <p className="text-center text-muted-foreground py-12">Chargement…</p>
        ) : (
          chartConfig.map((cfg) => (
            <Card key={cfg.key}>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  {cfg.icon}
                  {cfg.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={data} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={cfg.yTickFormat}
                      width={32}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: number) => [cfg.tooltip(value), cfg.title]}
                      labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey={cfg.key}
                      stroke={cfg.color}
                      strokeWidth={2}
                      dot={{ r: 3, fill: cfg.color, strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
