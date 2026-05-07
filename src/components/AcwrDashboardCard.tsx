import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Activity, TrendingUp, AlertTriangle, ChevronRight, RefreshCw } from "lucide-react";
import { subDays, format, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";

interface AthleteAcwr {
  athleteId: string;
  athleteName: string;
  acwr: number | null;
  acuteLoad: number; // 7-day TRIMP sum
  chronicLoad: number; // 28-day TRIMP / 4 (weekly average)
  sessionsLast7: number;
  sessionsLast28: number;
}

interface AcwrDashboardCardProps {
  athleteIds: string[];
  profileMap: Map<string, { first_name: string; last_name: string }>;
}

function acwrLabel(acwr: number | null): { label: string; color: string; bg: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (acwr === null) return { label: "Données manquantes", color: "text-muted-foreground", bg: "bg-muted/40", variant: "secondary" };
  if (acwr < 0.8) return { label: "Sous-chargé", color: "text-blue-700", bg: "bg-blue-50", variant: "secondary" };
  if (acwr <= 1.3) return { label: "Zone optimale", color: "text-green-700", bg: "bg-green-50", variant: "default" };
  if (acwr <= 1.5) return { label: "Charge élevée", color: "text-orange-700", bg: "bg-orange-50", variant: "outline" };
  return { label: "Zone danger !", color: "text-red-700", bg: "bg-red-50", variant: "destructive" };
}

function acwrBarColor(acwr: number | null): string {
  if (acwr === null) return "bg-muted";
  if (acwr < 0.8) return "bg-blue-400";
  if (acwr <= 1.3) return "bg-green-500";
  if (acwr <= 1.5) return "bg-orange-500";
  return "bg-red-500";
}

/**
 * ACWR = Acute:Chronic Workload Ratio
 * Acute  = sum of TRIMP (RPE × duration_minutes) over last 7 days
 * Chronic = (sum of TRIMP over last 28 days) / 4  (= average weekly load)
 *
 * If session has no RPE or no duration, we fall back to counting sessions
 * (each session = 60 TRIMP units as default).
 */
export function AcwrDashboardCard({ athleteIds, profileMap }: AcwrDashboardCardProps) {
  const navigate = useNavigate();
  const [athletes, setAthletes] = useState<AthleteAcwr[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (athleteIds.length > 0) {
      loadAcwr();
    } else {
      setLoading(false);
    }
  }, [athleteIds]);

  const loadAcwr = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const day28Ago = format(subDays(now, 27), "yyyy-MM-dd");

      // 1. Fetch all training sessions (from programming) completed in last 28 days
      const { data: trainingSessions } = await supabase
        .from("training_sessions")
        .select("id, completed_at, session_rpe, duration_minutes, training_weeks!inner(athlete_id)")
        .in("training_weeks.athlete_id", athleteIds)
        .gte("completed_at", day28Ago + "T00:00:00")
        .not("completed_at", "is", null);

      // 2. Fetch custom sessions completed in last 28 days
      const { data: customSessions } = await (supabase.from("custom_sessions") as any)
        .select("id, completed_at, session_rpe, duration_minutes, user_id")
        .in("user_id", athleteIds)
        .gte("completed_at", day28Ago + "T00:00:00")
        .not("completed_at", "is", null);

      // Build per-athlete daily load map
      interface DayLoad { trimp: number; sessions: number }
      const athleteLoadMap = new Map<string, Map<string, DayLoad>>();

      const addLoad = (athleteId: string, dateStr: string, rpe: number | null, duration: number | null) => {
        if (!athleteLoadMap.has(athleteId)) athleteLoadMap.set(athleteId, new Map());
        const dayMap = athleteLoadMap.get(athleteId)!;
        const existing = dayMap.get(dateStr) || { trimp: 0, sessions: 0 };
        const trimp = (rpe && duration) ? rpe * duration : 60; // fallback 60 TRIMP units
        dayMap.set(dateStr, { trimp: existing.trimp + trimp, sessions: existing.sessions + 1 });
      };

      (trainingSessions || []).forEach((s: any) => {
        const athleteId = (s.training_weeks as any)?.athlete_id;
        if (!athleteId) return;
        const dateStr = format(new Date(s.completed_at), "yyyy-MM-dd");
        addLoad(athleteId, dateStr, s.session_rpe, s.duration_minutes);
      });

      (customSessions || []).forEach((s: any) => {
        const dateStr = format(new Date(s.completed_at), "yyyy-MM-dd");
        addLoad(s.user_id, dateStr, s.session_rpe, s.duration_minutes);
      });

      // Compute ACWR per athlete
      const today = now;
      const day7Ago = subDays(today, 6);

      const result: AthleteAcwr[] = athleteIds.map((id) => {
        const profile = profileMap.get(id);
        const dayMap = athleteLoadMap.get(id) || new Map();

        let acute = 0;
        let chronic = 0;
        let sessions7 = 0;
        let sessions28 = 0;

        dayMap.forEach((dayLoad, dateStr) => {
          const d = new Date(dateStr + "T12:00:00");
          if (d >= startOfDay(subDays(today, 27)) && d <= today) {
            chronic += dayLoad.trimp;
            sessions28 += dayLoad.sessions;
          }
          if (d >= startOfDay(day7Ago) && d <= today) {
            acute += dayLoad.trimp;
            sessions7 += dayLoad.sessions;
          }
        });

        const weeklyAvg = chronic / 4;
        const acwr = weeklyAvg > 0 ? Math.round((acute / weeklyAvg) * 100) / 100 : null;

        return {
          athleteId: id,
          athleteName: profile ? `${profile.first_name} ${profile.last_name}` : "Athlète",
          acwr,
          acuteLoad: Math.round(acute),
          chronicLoad: Math.round(weeklyAvg),
          sessionsLast7: sessions7,
          sessionsLast28: sessions28,
        };
      });

      // Sort: danger first, then by ACWR descending
      result.sort((a, b) => {
        const aVal = a.acwr ?? -1;
        const bVal = b.acwr ?? -1;
        if (bVal > 1.5 && aVal <= 1.5) return 1;
        if (aVal > 1.5 && bVal <= 1.5) return -1;
        return bVal - aVal;
      });

      setAthletes(result);
    } catch (e) {
      console.error("[AcwrDashboardCard]", e);
    } finally {
      setLoading(false);
    }
  };

  const dangerCount = athletes.filter((a) => a.acwr !== null && a.acwr > 1.5).length;
  const highCount = athletes.filter((a) => a.acwr !== null && a.acwr > 1.3 && a.acwr <= 1.5).length;

  if (athleteIds.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Charge ACWR — Sportifs
            {dangerCount > 0 && (
              <Badge variant="destructive" className="h-5 text-[10px]">
                <AlertTriangle className="h-3 w-3 mr-0.5" />
                {dangerCount} en danger
              </Badge>
            )}
            {highCount > 0 && dangerCount === 0 && (
              <Badge variant="outline" className="h-5 text-[10px] border-orange-400 text-orange-700">
                {highCount} élevé
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={loadAcwr}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ratio Charge Aiguë / Chronique (7j / moy. 28j). Optimal : 0,8 – 1,3
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Calcul en cours…</p>
        ) : athletes.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Aucun sportif actif.</p>
        ) : (
          <div className="space-y-2">
            {athletes.map((a) => {
              const status = acwrLabel(a.acwr);
              const barWidth = a.acwr !== null ? Math.min(Math.round((a.acwr / 2) * 100), 100) : 0;
              return (
                <div
                  key={a.athleteId}
                  className={`rounded-lg border p-3 cursor-pointer hover:border-primary/40 transition-colors ${status.bg}`}
                  onClick={() => navigate(`/coach/client/${a.athleteId}`)}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-sm truncate">{a.athleteName}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-lg font-bold ${status.color}`}>
                        {a.acwr !== null ? a.acwr.toFixed(2) : "—"}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  {/* ACWR bar */}
                  <div className="relative h-1.5 rounded-full bg-muted/60 overflow-hidden">
                    {/* Optimal zone indicator */}
                    <div
                      className="absolute top-0 h-full bg-green-200/50"
                      style={{ left: "40%", width: "25%" }}
                    />
                    {a.acwr !== null && (
                      <div
                        className={`h-full rounded-full transition-all ${acwrBarColor(a.acwr)}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    )}
                    {/* Zone marker at 0.8 and 1.3 */}
                    <div className="absolute top-0 left-[40%] h-full w-px bg-green-400/60" />
                    <div className="absolute top-0 left-[65%] h-full w-px bg-orange-400/60" />
                    <div className="absolute top-0 left-[75%] h-full w-px bg-red-400/60" />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>{a.sessionsLast7} séance(s) / 7j</span>
                    <span>{a.sessionsLast28} séance(s) / 28j</span>
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-muted-foreground pt-1 text-center">
              Charge = RPE × durée (ou 60 pts/séance si non renseigné)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
