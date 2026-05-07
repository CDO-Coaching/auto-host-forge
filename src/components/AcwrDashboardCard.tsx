import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Activity, AlertTriangle, ChevronRight, RefreshCw } from "lucide-react";
import { subDays, format, startOfDay } from "date-fns";

interface AthleteAcwr {
  athleteId: string;
  athleteName: string;
  acwr: number | null;
  acuteLoad: number;
  chronicLoad: number;
  sessionsLast7: number;
  sessionsLast28: number;
}

interface AcwrDashboardCardProps {
  athleteIds: string[];
  profileMap: Map<string, { first_name: string; last_name: string }>;
}

interface ZoneStyle {
  label: string;
  textColor: string;
  barColor: string;
  bg: string;
  border: string;
}

function getZone(acwr: number | null): ZoneStyle {
  if (acwr === null) return { label: "Pas de données", textColor: "text-muted-foreground", barColor: "bg-muted", bg: "bg-secondary/30", border: "border-border/40" };
  if (acwr < 0.8)    return { label: "Sous-chargé",    textColor: "text-blue-400",           barColor: "bg-blue-400",    bg: "bg-blue-400/10",    border: "border-blue-400/30" };
  if (acwr <= 1.3)   return { label: "Zone optimale",  textColor: "text-emerald-400",         barColor: "bg-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/30" };
  if (acwr <= 1.5)   return { label: "Charge élevée",  textColor: "text-orange-400",          barColor: "bg-orange-400",  bg: "bg-orange-400/10",  border: "border-orange-400/30" };
  return               { label: "Zone danger !",        textColor: "text-red-400",             barColor: "bg-red-400",     bg: "bg-red-400/10",     border: "border-red-400/30" };
}

export function AcwrDashboardCard({ athleteIds, profileMap }: AcwrDashboardCardProps) {
  const navigate = useNavigate();
  const [athletes, setAthletes] = useState<AthleteAcwr[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (athleteIds.length > 0) loadAcwr();
    else setLoading(false);
  }, [athleteIds]);

  const loadAcwr = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const day28Ago = format(subDays(now, 27), "yyyy-MM-dd");

      const [{ data: trainingSessions }, { data: customSessions }] = await Promise.all([
        supabase
          .from("training_sessions")
          .select("id, completed_at, session_rpe, duration_minutes, training_weeks!inner(athlete_id)")
          .in("training_weeks.athlete_id", athleteIds)
          .gte("completed_at", day28Ago + "T00:00:00")
          .not("completed_at", "is", null),
        (supabase.from("custom_sessions") as any)
          .select("id, completed_at, session_rpe, duration_minutes, user_id")
          .in("user_id", athleteIds)
          .gte("completed_at", day28Ago + "T00:00:00")
          .not("completed_at", "is", null),
      ]);

      interface DayLoad { trimp: number; sessions: number }
      const loadMap = new Map<string, Map<string, DayLoad>>();

      const addLoad = (athleteId: string, dateStr: string, rpe: number | null, dur: number | null) => {
        if (!loadMap.has(athleteId)) loadMap.set(athleteId, new Map());
        const dm = loadMap.get(athleteId)!;
        const prev = dm.get(dateStr) || { trimp: 0, sessions: 0 };
        dm.set(dateStr, { trimp: prev.trimp + ((rpe && dur) ? rpe * dur : 60), sessions: prev.sessions + 1 });
      };

      (trainingSessions || []).forEach((s: any) => {
        const id = (s.training_weeks as any)?.athlete_id;
        if (id) addLoad(id, format(new Date(s.completed_at), "yyyy-MM-dd"), s.session_rpe, s.duration_minutes);
      });
      (customSessions || []).forEach((s: any) => {
        addLoad(s.user_id, format(new Date(s.completed_at), "yyyy-MM-dd"), s.session_rpe, s.duration_minutes);
      });

      const day7Ago = startOfDay(subDays(now, 6));
      const day28AgoDate = startOfDay(subDays(now, 27));

      const result: AthleteAcwr[] = athleteIds.map((id) => {
        const profile = profileMap.get(id);
        const dm = loadMap.get(id) || new Map();
        let acute = 0, chronic = 0, s7 = 0, s28 = 0;
        dm.forEach((dl, dateStr) => {
          const d = new Date(dateStr + "T12:00:00");
          if (d >= day28AgoDate && d <= now) { chronic += dl.trimp; s28 += dl.sessions; }
          if (d >= day7Ago && d <= now)      { acute += dl.trimp;   s7  += dl.sessions; }
        });
        const weekly = chronic / 4;
        return {
          athleteId: id,
          athleteName: profile ? `${profile.first_name} ${profile.last_name}` : "Athlète",
          acwr: weekly > 0 ? Math.round((acute / weekly) * 100) / 100 : null,
          acuteLoad: Math.round(acute),
          chronicLoad: Math.round(weekly),
          sessionsLast7: s7,
          sessionsLast28: s28,
        };
      });

      result.sort((a, b) => {
        const av = a.acwr ?? -1, bv = b.acwr ?? -1;
        if (bv > 1.5 && av <= 1.5) return 1;
        if (av > 1.5 && bv <= 1.5) return -1;
        return bv - av;
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
              <span className="text-[10px] font-semibold text-orange-400 border border-orange-400/40 rounded-full px-1.5 py-0.5">
                {highCount} élevé
              </span>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={loadAcwr}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ratio Charge Aiguë / Chronique (7j / moy. 28j) · Optimal : 0,8 – 1,3
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
              const z = getZone(a.acwr);
              const barW = a.acwr !== null ? Math.min(Math.round((a.acwr / 2) * 100), 100) : 0;
              return (
                <div
                  key={a.athleteId}
                  className={`rounded-lg border ${z.border} ${z.bg} p-3 cursor-pointer hover:border-primary/40 transition-colors`}
                  onClick={() => navigate(`/coach/client/${a.athleteId}`)}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-sm text-foreground truncate">{a.athleteName}</span>
                      <span className={`text-[10px] font-semibold shrink-0 ${z.textColor}`}>
                        {z.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-lg font-bold ${z.textColor}`}>
                        {a.acwr !== null ? a.acwr.toFixed(2) : "—"}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="relative h-1.5 rounded-full bg-muted/50 overflow-hidden">
                    <div className="absolute top-0 left-[40%] h-full w-px bg-emerald-400/50" />
                    <div className="absolute top-0 left-[65%] h-full w-px bg-orange-400/50" />
                    <div className="absolute top-0 left-[75%] h-full w-px bg-red-400/50" />
                    {a.acwr !== null && (
                      <div className={`h-full rounded-full transition-all ${z.barColor}`} style={{ width: `${barW}%` }} />
                    )}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>{a.sessionsLast7} séance(s) / 7j</span>
                    <span>{a.sessionsLast28} séance(s) / 28j</span>
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-muted-foreground text-center pt-1">
              Charge = RPE × durée (ou 60 pts/séance si non renseigné)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
