import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, endOfWeek, getISOWeek } from "date-fns";
import { getWeekYear } from "@/lib/weekUtils";
import { Activity, MapPin, Clock, Heart, Gauge } from "lucide-react";
import { parsePaceToDecimal, formatPaceFromDecimal } from "@/lib/cardioCalculations";

interface Props {
  athleteId: string;
}

type SportType = "course" | "velo" | "natation" | "other";

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
  sport: SportType;
  // actual aggregated
  actualDistanceKm: number;
  actualDurationMin: number;
  actualPaceDecimal: number | null; // min/km weighted (course/natation)
  actualSpeedKmh: number | null;    // km/h (velo)
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
    // Only last week (w0)
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

    // Only fetch last week
    const { data: weeks } = await supabase
      .from("training_weeks")
      .select("id, week_number, year")
      .eq("athlete_id", athleteId)
      .eq("week_number", w0)
      .eq("year", y0);

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
          .select("session_id, actual_distance_km, actual_duration_minutes, actual_pace_min_per_km, actual_avg_heart_rate, cardio_sport")
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
          // Detect sport from first exercise that has cardio_sport
          const sportRaw = ex.find((e: any) => e.cardio_sport)?.cardio_sport ?? null;
          const sport: SportType = sportRaw === "velo" ? "velo" : sportRaw === "natation" ? "natation" : sportRaw === "course" || sportRaw === "marche" ? "course" : "other";
          const speedKmh = dur > 0 && dist > 0 ? dist / (dur / 60) : null;
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
            sport,
            actualDistanceKm: dist,
            actualDurationMin: dur,
            actualPaceDecimal: paceDur > 0 ? weightedPace / paceDur : null,
            actualSpeedKmh: sport === "velo" ? speedKmh : null,
            actualHeartRate: hrDur > 0 ? Math.round(weightedHR / hrDur) : null,
            hasActual,
            isCustom: false,
          };
        });
      }
    }

    // Custom sessions (Perso) — only last week
    const startThis = startOfWeek(today, { weekStartsOn: 1 });
    const startPrev = new Date(startThis); startPrev.setDate(startPrev.getDate() - 7);
    const endPrev = new Date(startThis); endPrev.setDate(endPrev.getDate() - 1);

    const { data: customData } = await supabase
      .from("custom_sessions")
      .select("id, session_name, duration_minutes, completed_at, scheduled_date, distance_km, avg_pace, avg_heart_rate, cardio_type")
      .eq("user_id", athleteId)
      .gte("completed_at", startPrev.toISOString())
      .lte("completed_at", endPrev.toISOString());

    const customRows: CardioSessionRow[] = (customData || [])
      .filter((cs: any) => {
        const d = cs.completed_at ? new Date(cs.completed_at) : null;
        return d && d >= startPrev && d <= endPrev;
      })
      // Only keep rows with cardio info (distance OR pace OR HR)
      .filter((cs: any) => cs.distance_km || cs.avg_pace || cs.avg_heart_rate)
      .map((cs: any) => {
        const dist = Number(cs.distance_km || 0);
        const dur = Number(cs.duration_minutes || 0);
        const sportRaw = cs.cardio_type ?? "course";
        const sport: SportType = sportRaw === "velo" ? "velo" : sportRaw === "natation" ? "natation" : "course";
        // For vélo, avg_pace stores speed in km/h as string
        const speedKmh = sport === "velo" && cs.avg_pace ? Number(cs.avg_pace) || null : null;
        const paceDec = sport !== "velo" ? parsePaceToDecimal(cs.avg_pace) : null;
        return {
          id: cs.id,
          name: cs.session_name,
          session_type: "perso",
          completed_at: cs.completed_at,
          scheduled_date: cs.scheduled_date,
          cardio_total_distance_km: dist || null,
          cardio_total_duration_minutes: dur || null,
          cardio_average_intensity: null,
          week_label: `S${w0}`,
          sport,
          actualDistanceKm: dist,
          actualDurationMin: dur,
          actualPaceDecimal: paceDec,
          actualSpeedKmh: speedKmh,
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

  const sportEmoji = (sport: SportType) =>
    sport === "velo" ? "🚴" : sport === "natation" ? "🏊" : "🏃";

  const sportLabel = (sport: SportType) =>
    sport === "velo" ? "Vélo" : sport === "natation" ? "Natation" : "Course";

  // Group sessions by sport, preserve insertion order
  const sportOrder: SportType[] = [];
  const grouped: Record<SportType, CardioSessionRow[]> = { course: [], velo: [], natation: [], other: [] };
  sessions.forEach((s) => {
    if (!sportOrder.includes(s.sport)) sportOrder.push(s.sport);
    grouped[s.sport].push(s);
  });

  const renderSession = (s: CardioSessionRow) => {
    const dist = s.hasActual ? s.actualDistanceKm : (s.cardio_total_distance_km || 0);
    const dur = s.hasActual ? s.actualDurationMin : (s.cardio_total_duration_minutes || 0);
    const isVelo = s.sport === "velo";
    const isNatation = s.sport === "natation";

    const speedKmh = s.actualSpeedKmh ?? (dur > 0 && dist > 0 ? dist / (dur / 60) : null);
    const pctVma = speedKmh && vma ? Math.round((speedKmh / vma) * 100) : null;
    const pctFc = s.actualHeartRate && fcMax ? Math.round((s.actualHeartRate / fcMax) * 100) : null;

    let metricLabel: string;
    if (isVelo) {
      metricLabel = speedKmh ? `${speedKmh.toFixed(1)} km/h` : "—";
    } else if (isNatation) {
      const paceDec = s.actualPaceDecimal ?? (speedKmh ? 60 / speedKmh / 10 : null);
      if (paceDec) {
        const min = Math.floor(paceDec);
        const sec = Math.round((paceDec - min) * 60);
        metricLabel = `${min}:${sec.toString().padStart(2, "0")}/100m`;
      } else {
        metricLabel = "—";
      }
    } else {
      const paceLabel = s.actualPaceDecimal
        ? formatPaceFromDecimal(s.actualPaceDecimal)
        : (speedKmh ? formatPaceFromDecimal(60 / speedKmh) : null);
      metricLabel = paceLabel || "—";
    }

    const distLabel = isNatation
      ? (dist > 0 ? `${Math.round(dist * 1000)} m` : "—")
      : (dist > 0 ? `${dist.toFixed(2)} km` : "—");

    return (
      <div key={s.id} className="rounded border bg-muted/10 p-2 text-xs">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {s.isCustom && (
              <Badge className="text-[9px] h-4 px-1 bg-orange-500/20 text-orange-600 border-orange-500/30">Perso</Badge>
            )}
            <span className="truncate font-medium">{s.name}</span>
          </div>
          <Badge
            className={`text-[9px] px-1.5 py-0 shrink-0 ${
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
            <span>{distLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5 text-muted-foreground" />
            <span>{formatDur(dur)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Gauge className="h-2.5 w-2.5 text-muted-foreground" />
            <span>
              {metricLabel}
              {!isVelo && !isNatation && pctVma !== null && (
                <span className={`ml-1 font-semibold ${pctColor(pctVma)}`}>({pctVma}% VMA)</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Heart className="h-2.5 w-2.5 text-red-500" />
            <span>
              {s.actualHeartRate ? `${s.actualHeartRate} bpm` : "—"}
              {pctFc !== null && (
                <span className={`ml-1 font-semibold ${pctColor(pctFc)}`}>({pctFc}% FCmax)</span>
              )}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-1 pt-3 px-3">
        <CardTitle className="text-xs flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-blue-500" />
          Volume cardio (semaine dernière)
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-4">
        {(!vma || !fcMax) && (
          <p className="text-[10px] text-muted-foreground italic">
            {!vma && "VMA non renseignée. "}
            {!fcMax && "FC max non renseignée. "}
            Les pourcentages ne sont pas tous calculables.
          </p>
        )}

        {/* Groupé par sport */}
        {sportOrder.map((sport) => {
          const sportSessions = grouped[sport];
          const totalDist = sportSessions.reduce((acc, s) => acc + (s.hasActual ? s.actualDistanceKm : (s.cardio_total_distance_km || 0)), 0);
          const totalDur = sportSessions.reduce((acc, s) => acc + (s.hasActual ? s.actualDurationMin : (s.cardio_total_duration_minutes || 0)), 0);
          const distTotalLabel = sport === "natation"
            ? `${Math.round(totalDist * 1000)} m`
            : `${totalDist.toFixed(1)} km`;

          return (
            <div key={sport} className="space-y-2">
              {/* En-tête sport + totaux */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1">
                  <span className="text-sm">{sportEmoji(sport)}</span>
                  {sportLabel(sport)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {distTotalLabel} · {formatDur(totalDur)}
                </span>
              </div>
              {/* Séances */}
              <div className="space-y-1.5">
                {sportSessions.map(renderSession)}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
