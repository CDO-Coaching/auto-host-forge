import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, getISOWeek } from "date-fns";
import { getWeekYear } from "@/lib/weekUtils";
import { Activity, MapPin, Clock, Heart, Gauge } from "lucide-react";
import { parsePaceToDecimal, formatPaceFromDecimal } from "@/lib/cardioCalculations";

interface Props {
  athleteId: string;
}

interface CardioSessionRow {
  id: string;
  name: string;
  session_type: string;
  completed_at: string | null;
  scheduled_date: string | null;
  cardio_total_distance_km: number | null;
  cardio_total_duration_minutes: number | null;
  cardio_average_intensity: number | null;
  week_label: string;
  // actual aggregated
  actualDistanceKm: number;
  actualDurationMin: number;
  actualPaceDecimal: number | null; // min/km weighted
  actualHeartRate: number | null;
  hasActual: boolean;
  isCustom: boolean;
}

export function CoachCardioSummaryCard({ athleteId }: Props) {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<CardioSessionRow[]>([]);
  const [vma, setVma] = useState<number | null>(null);
  const [fcMax, setFcMax] = useState<number | null>(null);

  useEffect(() => {
    if (!athleteId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId]);

  const load = async () => {
    setLoading(true);
    const today = new Date();
    const w1 = getISOWeek(today);
    const y1 = getWeekYear(today);
    let w0 = w1 - 1, y0 = y1;
    if (w0 <= 0) { w0 = 52; y0 = y1 - 1; }

    // profile
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("vma, fc_max")
      .eq("id", athleteId)
      .maybeSingle();
    if (profile) {
      setVma(profile.vma ?? null);
      setFcMax((profile as any).fc_max ?? null);
    }

    // weeks
    const { data: weeks } = await supabase
      .from("training_weeks")
      .select("id, week_number, year")
      .eq("athlete_id", athleteId)
      .or(`and(week_number.eq.${w1},year.eq.${y1}),and(week_number.eq.${w0},year.eq.${y0})`);

    const weekMap = new Map((weeks || []).map((w: any) => [w.id, `S${w.week_number}`]));

    let trainingRows: CardioSessionRow[] = [];
    if (weeks && weeks.length > 0) {
      const { data: sess } = await supabase
        .from("training_sessions")
        .select("id, name, session_type, completed_at, scheduled_date, week_id, cardio_total_distance_km, cardio_total_duration_minutes, cardio_average_intensity")
        .in("week_id", weeks.map((w: any) => w.id))
        .eq("session_type", "cardio");

      if (sess && sess.length > 0) {
        const sessionIds = sess.map((s: any) => s.id);
        const { data: exos } = await supabase
          .from("session_exercises")
          .select("session_id, actual_distance_km, actual_duration_minutes, actual_pace_min_per_km, actual_avg_heart_rate")
          .in("session_id", sessionIds);

        const exoBySession = new Map<string, any[]>();
        (exos || []).forEach((e: any) => {
          const arr = exoBySession.get(e.session_id) || [];
          arr.push(e);
          exoBySession.set(e.session_id, arr);
        });

        trainingRows = sess.map((s: any) => {
          const ex = exoBySession.get(s.id) || [];
          let dist = 0, dur = 0;
          let weightedPace = 0, paceDur = 0;
          let weightedHR = 0, hrDur = 0;
          let hasActual = false;
          ex.forEach((e: any) => {
            if (e.actual_distance_km) { dist += Number(e.actual_distance_km); hasActual = true; }
            if (e.actual_duration_minutes) { dur += Number(e.actual_duration_minutes); hasActual = true; }
            const p = parsePaceToDecimal(e.actual_pace_min_per_km);
            if (p && e.actual_duration_minutes) {
              weightedPace += p * Number(e.actual_duration_minutes);
              paceDur += Number(e.actual_duration_minutes);
            }
            if (e.actual_avg_heart_rate && e.actual_duration_minutes) {
              weightedHR += Number(e.actual_avg_heart_rate) * Number(e.actual_duration_minutes);
              hrDur += Number(e.actual_duration_minutes);
            }
          });
          return {
            id: s.id,
            name: s.name,
            session_type: s.session_type,
            completed_at: s.completed_at,
            scheduled_date: s.scheduled_date,
            cardio_total_distance_km: s.cardio_total_distance_km,
            cardio_total_duration_minutes: s.cardio_total_duration_minutes,
            cardio_average_intensity: s.cardio_average_intensity,
            week_label: weekMap.get(s.week_id) || "",
            actualDistanceKm: dist,
            actualDurationMin: dur,
            actualPaceDecimal: paceDur > 0 ? weightedPace / paceDur : null,
            actualHeartRate: hrDur > 0 ? Math.round(weightedHR / hrDur) : null,
            hasActual,
            isCustom: false,
          };
        });
      }
    }

    // Custom sessions (Perso) — fetch by date range of the 2 weeks
    // (today already defined above)
    const startThis = startOfWeek(today, { weekStartsOn: 1 });
    const endThis = endOfWeek(today, { weekStartsOn: 1 });
    const startPrev = new Date(startThis); startPrev.setDate(startPrev.getDate() - 7);

    const { data: customData } = await supabase
      .from("custom_sessions")
      .select("id, session_name, duration_minutes, completed_at, scheduled_date, distance_km, avg_pace, avg_heart_rate")
      .eq("user_id", athleteId)
      .gte("completed_at", startPrev.toISOString())
      .lte("completed_at", endThis.toISOString());

    const customRows: CardioSessionRow[] = (customData || [])
      .filter((cs: any) => {
        const d = cs.completed_at ? new Date(cs.completed_at) : null;
        return d && d >= startPrev && d <= endThis;
      })
      // Only keep rows with cardio info (distance OR pace OR HR)
      .filter((cs: any) => cs.distance_km || cs.avg_pace || cs.avg_heart_rate)
      .map((cs: any) => {
        const d = new Date(cs.completed_at);
        const isCurrent = d >= startThis;
        const dist = Number(cs.distance_km || 0);
        const dur = Number(cs.duration_minutes || 0);
        const paceDec = parsePaceToDecimal(cs.avg_pace);
        return {
          id: cs.id,
          name: cs.session_name,
          session_type: "perso",
          completed_at: cs.completed_at,
          scheduled_date: cs.scheduled_date,
          cardio_total_distance_km: dist || null,
          cardio_total_duration_minutes: dur || null,
          cardio_average_intensity: null,
          week_label: isCurrent ? `S${w1}` : `S${w0}`,
          actualDistanceKm: dist,
          actualDurationMin: dur,
          actualPaceDecimal: paceDec,
          actualHeartRate: cs.avg_heart_rate ? Number(cs.avg_heart_rate) : null,
          hasActual: !!(dist || dur),
          isCustom: true,
        };
      });

    setSessions([...trainingRows, ...customRows]);
    setLoading(false);
  };

  if (loading) return null;
  if (sessions.length === 0) return null;

  // Totals (use actual if any, else planned)
  let totalDist = 0, totalDur = 0;
  sessions.forEach((s) => {
    totalDist += s.hasActual ? s.actualDistanceKm : (s.cardio_total_distance_km || 0);
    totalDur += s.hasActual ? s.actualDurationMin : (s.cardio_total_duration_minutes || 0);
  });

  const formatDur = (min: number) => {
    if (!min) return "—";
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`;
  };

  const pctColor = (p: number | null) => {
    if (p === null) return "text-muted-foreground";
    if (p >= 90) return "text-destructive";
    if (p >= 75) return "text-orange-500";
    if (p >= 60) return "text-yellow-500";
    return "text-green-500";
  };

  return (
    <Card>
      <CardHeader className="pb-1 pt-3 px-3">
        <CardTitle className="text-xs flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-blue-500" />
          Volume cardio (2 dernières semaines)
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-3">
        {/* Totals */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded border bg-muted/20 p-2">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <MapPin className="h-3 w-3" /> Distance totale
            </div>
            <div className="text-sm font-bold">{totalDist.toFixed(1)} km</div>
          </div>
          <div className="rounded border bg-muted/20 p-2">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" /> Durée totale
            </div>
            <div className="text-sm font-bold">{formatDur(totalDur)}</div>
          </div>
        </div>

        {(!vma || !fcMax) && (
          <p className="text-[10px] text-muted-foreground italic">
            {!vma && "VMA non renseignée. "}
            {!fcMax && "FC max non renseignée. "}
            Les pourcentages ne sont pas tous calculables.
          </p>
        )}

        {/* Per-session breakdown */}
        <div className="space-y-1.5">
          {sessions.map((s) => {
            const dist = s.hasActual ? s.actualDistanceKm : (s.cardio_total_distance_km || 0);
            const dur = s.hasActual ? s.actualDurationMin : (s.cardio_total_duration_minutes || 0);
            // average speed km/h
            const avgSpeed = dur > 0 && dist > 0 ? (dist / (dur / 60)) : null;
            const pctVma = avgSpeed && vma ? Math.round((avgSpeed / vma) * 100) : null;
            const pctFc = s.actualHeartRate && fcMax ? Math.round((s.actualHeartRate / fcMax) * 100) : null;
            const paceLabel = s.actualPaceDecimal
              ? formatPaceFromDecimal(s.actualPaceDecimal)
              : (avgSpeed ? formatPaceFromDecimal(60 / avgSpeed) : null);

            return (
              <div key={s.id} className="rounded border bg-muted/10 p-2 text-xs">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Badge variant="outline" className="text-[9px] h-4 px-1">{s.week_label}</Badge>
                    {s.isCustom && (
                      <Badge className="text-[9px] h-4 px-1 bg-orange-500/20 text-orange-600 border-orange-500/30">Perso</Badge>
                    )}
                    <span className="truncate font-medium">{s.name}</span>
                  </div>
                  <Badge
                    className={`text-[9px] px-1.5 py-0 ${
                      s.completed_at
                        ? "bg-green-500/20 text-green-600 border-green-500/30"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.completed_at ? "Réalisée" : "Planifiée"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
                    <span>{dist > 0 ? `${dist.toFixed(2)} km` : "—"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                    <span>{formatDur(dur)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Gauge className="h-2.5 w-2.5 text-muted-foreground" />
                    <span>
                      {paceLabel || "—"}
                      {pctVma !== null && (
                        <span className={`ml-1 font-semibold ${pctColor(pctVma)}`}>
                          ({pctVma}% VMA)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart className="h-2.5 w-2.5 text-red-500" />
                    <span>
                      {s.actualHeartRate ? `${s.actualHeartRate} bpm` : "—"}
                      {pctFc !== null && (
                        <span className={`ml-1 font-semibold ${pctColor(pctFc)}`}>
                          ({pctFc}% FCmax)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
