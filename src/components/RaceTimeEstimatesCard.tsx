import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Timer, Info, Activity, Sliders } from "lucide-react";

interface Props {
  athleteId: string;
  isCoachView?: boolean;
}

// Distances cibles (km)
const DISTANCES = [
  { d: 5,    label: "5 km" },
  { d: 10,   label: "10 km" },
  { d: 21.1, label: "Semi-marathon" },
  { d: 42.2, label: "Marathon" },
];

// Exposant de Riegel (référence: 1.06)
const RIEGEL_EXP = 1.06;

// Niveaux (repli manuel) et % de VMA tenable par distance
const LEVELS = [
  { key: "debutant",      label: "Débutant",      desc: "Première année, peu d'endurance spécifique" },
  { key: "intermediaire", label: "Intermédiaire", desc: "Pratique régulière, plusieurs courses au compteur" },
  { key: "confirme",      label: "Confirmé",      desc: "Entraînement structuré, bonne résistance à la fatigue" },
  { key: "elite",         label: "Élite",         desc: "Très haut niveau d'endurance et d'économie de course" },
] as const;

type LevelKey = typeof LEVELS[number]["key"];

const PCT_VMA: Record<LevelKey, Record<number, number>> = {
  debutant:      { 5: 0.88, 10: 0.84, 21.1: 0.78, 42.2: 0.70 },
  intermediaire: { 5: 0.91, 10: 0.87, 21.1: 0.82, 42.2: 0.75 },
  confirme:      { 5: 0.94, 10: 0.90, 21.1: 0.86, 42.2: 0.80 },
  elite:         { 5: 0.97, 10: 0.93, 21.1: 0.89, 42.2: 0.84 },
};

const RUN_TYPES = ["Run", "VirtualRun", "TrailRun"];

interface RefRun {
  dateISO: string;
  distanceKm: number;
  timeSec: number;
  speedKmh: number;
  avgHr: number | null;
}

function fmtTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function fmtPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

// Projection de Riegel : T2 = T1 * (D2/D1)^exp
function riegel(t1Sec: number, d1: number, d2: number): number {
  return t1Sec * Math.pow(d2 / d1, RIEGEL_EXP);
}

// % de VMA typiquement tenable selon la distance (athlète entraîné de référence).
// Interpolation linéaire entre points d'ancrage ; sert à juger si l'athlète
// se situe au-dessus / pile / en-dessous de ce qu'implique sa VMA.
const PCT_ANCHORS: [number, number][] = [
  [3, 0.96], [5, 0.92], [10, 0.89], [21.1, 0.84], [42.2, 0.79],
];
function expectedPctVma(distanceKm: number): number {
  const a = PCT_ANCHORS;
  if (distanceKm <= a[0][0]) return a[0][1];
  if (distanceKm >= a[a.length - 1][0]) return a[a.length - 1][1];
  for (let i = 0; i < a.length - 1; i++) {
    const [d1, p1] = a[i];
    const [d2, p2] = a[i + 1];
    if (distanceKm >= d1 && distanceKm <= d2) {
      return p1 + (p2 - p1) * ((distanceKm - d1) / (d2 - d1));
    }
  }
  return 0.88;
}

export function RaceTimeEstimatesCard({ athleteId, isCoachView = false }: Props) {
  const [vma, setVma] = useState<number | null>(null);
  const [level, setLevel] = useState<LevelKey>("intermediaire");
  const [saving, setSaving] = useState(false);
  const [refRuns, setRefRuns] = useState<RefRun[]>([]);
  const [mode, setMode] = useState<"auto" | "manual">("manual");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      // Profil (VMA + niveau)
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", athleteId)
        .single();
      const profileVma: number | null = (profile as any)?.vma ?? null;
      if (profileVma) setVma(profileVma);
      const lvl = (profile as any)?.running_level;
      if (lvl && LEVELS.some(l => l.key === lvl)) setLevel(lvl as LevelKey);

      // Sorties course des 90 derniers jours (Strava + séances saisies manuellement)
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const sinceISO = since.toISOString();

      const [stravaRes, customRes, trainingRes] = await Promise.all([
        supabase
          .from("strava_activities" as any)
          .select("start_date, distance_meters, moving_time_seconds, average_heartrate, sport_type")
          .eq("athlete_id", athleteId)
          .gte("start_date", sinceISO),
        supabase
          .from("custom_sessions" as any)
          .select("completed_at, distance_km, duration_minutes, avg_heart_rate, cardio_type")
          .eq("user_id", athleteId)
          .not("completed_at", "is", null)
          .gte("completed_at", sinceISO),
        supabase
          .from("training_sessions" as any)
          .select(`
            completed_at,
            session_exercises!inner(cardio_sport, actual_distance_km, actual_duration_minutes, actual_avg_heart_rate),
            training_weeks!inner(athlete_id)
          `)
          .eq("training_weeks.athlete_id", athleteId)
          .eq("session_exercises.cardio_sport", "course")
          .not("completed_at", "is", null)
          .gte("completed_at", sinceISO),
      ]);

      // Normalise toutes les sorties course en candidats {date, distKm, timeSec, hr}
      const candidates: { dateISO: string; distKm: number; timeSec: number; hr: number | null }[] = [];

      for (const a of ((stravaRes.data ?? []) as any[])) {
        if (!RUN_TYPES.includes(a.sport_type)) continue;
        candidates.push({
          dateISO: a.start_date,
          distKm: (a.distance_meters ?? 0) / 1000,
          timeSec: a.moving_time_seconds ?? 0,
          hr: a.average_heartrate ?? null,
        });
      }
      for (const c of ((customRes.data ?? []) as any[])) {
        const ct = (c.cardio_type ?? "").toLowerCase();
        if (ct !== "course" && ct !== "run" && ct !== "running") continue;
        candidates.push({
          dateISO: c.completed_at,
          distKm: c.distance_km ?? 0,
          timeSec: (c.duration_minutes ?? 0) * 60,
          hr: c.avg_heart_rate ?? null,
        });
      }
      for (const s of ((trainingRes.data ?? []) as any[])) {
        for (const ex of ((s.session_exercises ?? []) as any[])) {
          if (ex.cardio_sport !== "course") continue;
          candidates.push({
            dateISO: s.completed_at,
            distKm: ex.actual_distance_km ?? 0,
            timeSec: (ex.actual_duration_minutes ?? 0) * 60,
            hr: ex.actual_avg_heart_rate ?? null,
          });
        }
      }

      // Sorties soutenues valides (≥ 3 km, ≥ 12 min), avec garde-fous anti-données
      // aberrantes (saisies corrompues, mauvaises unités…), triées par perf 10 km.
      const valid: (RefRun & { proj10: number })[] = [];
      for (const c of candidates) {
        if (c.distKm < 3 || c.distKm > 60) continue;            // distance plausible
        if (c.timeSec < 720 || c.timeSec > 6 * 3600) continue;  // durée plausible (≤ 6 h)
        const speedKmh = c.distKm / (c.timeSec / 3600);
        if (speedKmh < 5 || speedKmh > 25) continue;            // allure humaine réaliste
        if (profileVma && speedKmh > profileVma * 1.05) continue; // impossible de tenir > VMA longtemps
        valid.push({
          dateISO: c.dateISO,
          distanceKm: c.distKm,
          timeSec: c.timeSec,
          speedKmh,
          avgHr: c.hr,
          proj10: riegel(c.timeSec, c.distKm, 10),
        });
      }
      // 3 meilleures références (10 km projeté le plus rapide)
      valid.sort((a, b) => a.proj10 - b.proj10);
      const top3 = valid.slice(0, 3).map(({ proj10, ...r }) => r);
      setRefRuns(top3);
      setMode(top3.length > 0 ? "auto" : "manual");
      setLoaded(true);
    })();
  }, [athleteId]);

  const handleChangeLevel = async (newLevel: LevelKey) => {
    const previous = level;
    setLevel(newLevel);
    if (!isCoachView) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("update_athlete_physio", {
        p_athlete_id: athleteId,
        p_running_level: newLevel,
      } as any);
      if (error) throw error;
    } catch (err) {
      console.error("Erreur sauvegarde niveau:", err);
      toast.error("Impossible d'enregistrer le niveau");
      setLevel(previous);
    } finally {
      setSaving(false);
    }
  };

  // Comparaison VMA annoncée ↔ performances réelles (indice d'endurance)
  const vmaCheck = (() => {
    if (!vma || refRuns.length === 0) return null;
    const best = refRuns[0];
    const actualPct = best.speedKmh / vma;          // % de VMA réellement tenu
    const expectedPct = expectedPctVma(best.distanceKm);
    const delta = actualPct - expectedPct;          // > 0 = sur-performe la VMA
    const status: "above" | "on" | "below" =
      delta > 0.025 ? "above" : delta < -0.025 ? "below" : "on";
    // VMA "impliquée" par la perf si l'athlète tenait le % attendu
    const impliedVma = best.speedKmh / expectedPct;
    return { actualPct, expectedPct, delta, status, impliedVma, best };
  })();

  // Lignes d'estimation selon le mode
  const rows = DISTANCES.map(({ d, label }) => {
    let totalSec: number | null = null;
    if (mode === "auto" && refRuns.length > 0) {
      // Meilleure projection Riegel parmi les références (jamais plus lent qu'une
      // perf réellement réalisée). refRuns est trié par perf décroissante.
      const projs = refRuns.map(r => riegel(r.timeSec, r.distanceKm, d));
      totalSec = Math.min(...projs);
    } else if (vma) {
      const speed = vma * PCT_VMA[level][d];
      totalSec = (d / speed) * 3600;
    }
    if (totalSec == null) return null;
    const paceSec = totalSec / d;
    const pctVma = vma ? (d / (totalSec / 3600)) / vma : null; // %VMA implicite de l'allure projetée
    return { label, totalSec, paceSec, pctVma };
  }).filter(Boolean) as { label: string; totalSec: number; paceSec: number; pctVma: number | null }[];

  return (
    <Card className="bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Timer className="h-5 w-5 text-primary" />
          Estimations de chrono
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sélecteur de mode (si au moins une sortie de référence existe) */}
        {refRuns.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setMode("auto")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                mode === "auto"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent border-border text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <Activity className="h-3.5 w-3.5" /> Calé sur tes sorties
            </button>
            <button
              onClick={() => setMode("manual")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                mode === "manual"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent border-border text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <Sliders className="h-3.5 w-3.5" /> Niveau manuel
            </button>
          </div>
        )}

        {/* Mode auto : sorties de référence (moyenne du top 3) */}
        {mode === "auto" && refRuns.length > 0 && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-[11px] text-muted-foreground space-y-1.5">
            <div className="text-sm font-medium text-foreground">
              Tes meilleures sorties récentes
            </div>
            <div className="space-y-0.5">
              {refRuns.map((r, i) => (
                <div key={i} className="flex flex-wrap gap-x-1.5">
                  <span className={i === 0 ? "text-primary font-semibold" : "text-foreground/80 font-medium"}>
                    {r.distanceKm.toFixed(1)} km en {fmtTime(r.timeSec)}
                  </span>
                  <span>· {fmtPace(r.timeSec / r.distanceKm)}</span>
                  {r.avgHr ? <span>· {Math.round(r.avgHr)} bpm</span> : null}
                  {vma ? <span>· {Math.round((r.speedKmh / vma) * 100)}% VMA</span> : null}
                  <span className="text-muted-foreground/70">· {new Date(r.dateISO).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                  {i === 0 ? <span className="text-primary">· référence</span> : null}
                </div>
              ))}
            </div>
            <div className="italic">Estimations basées sur ta meilleure projection (formule de Riegel) sur les 90 derniers jours.</div>
          </div>
        )}

        {/* Cohérence VMA annoncée ↔ performances réelles */}
        {mode === "auto" && vmaCheck && (
          <div className={`rounded-lg border px-3 py-2.5 space-y-1 ${
            vmaCheck.status === "above" ? "border-green-500/40 bg-green-500/5"
            : vmaCheck.status === "below" ? "border-orange-500/40 bg-orange-500/5"
            : "border-border bg-muted/30"
          }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {vmaCheck.status === "above" && "✅ Au-dessus de sa VMA"}
                {vmaCheck.status === "on" && "🎯 Pile sur sa VMA"}
                {vmaCheck.status === "below" && "⚠️ En-dessous de sa VMA"}
              </span>
              <span className={`text-sm font-bold ${
                vmaCheck.status === "above" ? "text-green-500"
                : vmaCheck.status === "below" ? "text-orange-500" : "text-foreground"
              }`}>
                {Math.round(vmaCheck.actualPct * 100)}% VMA tenu
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Sur sa meilleure sortie ({vmaCheck.best.distanceKm.toFixed(1)} km), elle tient{" "}
              {Math.round(vmaCheck.actualPct * 100)}% de sa VMA annoncée ({vma!.toFixed(1)} km/h),
              vs ~{Math.round(vmaCheck.expectedPct * 100)}% attendus à cette distance.
              {vmaCheck.status === "above" && " Profil endurant : elle sur-performe sa VMA (bonne économie de course / endurance)."}
              {vmaCheck.status === "on" && " Cohérent : sa VMA annoncée correspond bien à ses performances."}
              {vmaCheck.status === "below" && ` Profil peu endurant ou VMA surévaluée — ses perfs correspondraient plutôt à une VMA de ~${vmaCheck.impliedVma.toFixed(1)} km/h. À recroiser avec un test VMA direct.`}
            </p>
          </div>
        )}

        {/* Mode manuel : sélecteur de niveau */}
        {mode === "manual" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Niveau de l'athlète</p>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l.key}
                  onClick={() => handleChangeLevel(l.key)}
                  disabled={saving}
                  title={l.desc}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    level === l.key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {LEVELS.find(l => l.key === level)?.desc}
            </p>
          </div>
        )}

        {/* Estimations */}
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            {loaded
              ? "Renseigne la VMA (carte « Données Physiologiques ») ou connecte des sorties course pour obtenir les estimations."
              : "Chargement…"}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {rows.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
                >
                  <div>
                    <div className="text-sm font-medium">{r.label}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {fmtPace(r.paceSec)}{r.pctVma ? ` · ${Math.round(r.pctVma * 100)}% VMA` : ""}
                    </div>
                  </div>
                  <div className="text-xl font-bold text-primary tabular-nums">
                    {fmtTime(r.totalSec)}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {mode === "auto"
                ? "Estimations calées sur ta meilleure sortie récente (Riegel) — bien plus proches de ta forme réelle que la seule VMA. À ajuster selon le dénivelé et les conditions."
                : `Estimations théoriques (potentiel) depuis la VMA${vma ? ` (${vma.toFixed(1)} km/h)` : ""} et le niveau. À ajuster selon l'entraînement spécifique, le dénivelé et les conditions.`}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
