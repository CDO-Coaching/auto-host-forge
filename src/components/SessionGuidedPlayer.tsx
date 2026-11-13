import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GuidedOverlay, type GuidedStep } from "@/components/GuidedOverlay";

const EX_COLORS = ["#e8c466", "#5aa9e6", "#9c7bd6", "#5fbf82", "#e8974a", "#e56464"];

/** Parse "90s" / "1min30" / "0s" / "90" → secondes. */
function recupSeconds(raw: string | null | undefined): number {
  if (!raw) return 0;
  const t = String(raw).trim().toLowerCase();
  if (t === "emom" || t === "0s" || t === "0" || t === "") return 0;
  let tot = 0;
  const m = t.match(/(\d+)\s*min/);
  if (m) tot += parseInt(m[1], 10) * 60;
  const s = t.match(/(\d+)\s*s/);
  if (s) tot += parseInt(s[1], 10);
  if (tot === 0) { const n = parseInt(t, 10); if (!isNaN(n)) tot = n; }
  return tot;
}

type Serie = { reps: string; charge: string; rpe: string; tempo: string; recuperation: string };

function seriesOf(ex: any): Serie[] {
  let details: any[] = [];
  if (ex?.serie_details) {
    try { details = typeof ex.serie_details === "string" ? JSON.parse(ex.serie_details) : ex.serie_details; } catch { details = []; }
  }
  if (!Array.isArray(details)) details = [];
  const bySeries = ex?.series ? parseInt(ex.series, 10) || 0 : 0;
  const total = Math.max(bySeries, details.length, 1);
  const out: Serie[] = [];
  for (let i = 0; i < total; i++) {
    const d = details[i] || {};
    out.push({
      reps: (d.reps || ex?.reps || "").toString(),
      charge: (d.charge || ex?.charge || "").toString(),
      rpe: (d.rpe || ex?.rpe || "").toString(),
      tempo: (d.tempo || ex?.tempo || "").toString(),
      recuperation: (d.recuperation || ex?.recuperation || "").toString(),
    });
  }
  return out;
}

type SerieResult = { rpe?: number | null; actual_reps?: string | null; actual_charge?: string | null; comment?: string };

/**
 * Lecteur guidé de séance complète (renfo) : enchaîne tous les exercices et
 * toutes leurs séries dans un seul GuidedOverlay, et sauvegarde les retours
 * (reps/charge/RPE/commentaire) par exercice dans session_exercises.
 */
export function SessionGuidedPlayer({
  exercises,
  onClose,
  onFinish,
}: {
  exercises: any[]; // lignes session_exercises brutes, ordonnées (hors cardio)
  onClose: () => void;
  onFinish?: () => void;
}) {
  const [libByName, setLibByName] = useState<Record<string, { video_url?: string; description?: string }>>({});
  const [ready, setReady] = useState(false);
  const resultsRef = useRef<Record<string, SerieResult[]>>({});

  // Charge vidéos + descriptions depuis la bibliothèque (par nom).
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("exercise_library").select("name, video_url, description");
      const map: Record<string, { video_url?: string; description?: string }> = {};
      (data || []).forEach((l: any) => { map[(l.name || "").trim().toLowerCase()] = { video_url: l.video_url, description: l.description }; });
      setLibByName(map);
      setReady(true);
    })();
  }, []);

  const persist = async (exId: string) => {
    const arr = resultsRef.current[exId] || [];
    const details = arr.map((s) => ({
      rpe: s?.rpe ?? null,
      actual_reps: s?.actual_reps ?? null,
      actual_charge: s?.actual_charge ?? null,
      modification_type: null,
    }));
    const rpes = arr.filter((s) => s && s.rpe != null).map((s) => s!.rpe as number);
    const avg = rpes.length ? Math.round(rpes.reduce((a, b) => a + b, 0) / rpes.length) : null;
    const comments = arr.map((s, i) => (s?.comment?.trim() ? `- Série ${i + 1} : ${s.comment.trim()}` : null)).filter(Boolean);
    const update: any = {
      serie_rpe_details: details,
      sportif_rpe: avg,
      sportif_feedback_at: new Date().toISOString(),
      skipped: false,
    };
    if (comments.length) update.sportif_comment = comments.join("\n");
    await supabase.from("session_exercises").update(update).eq("id", exId);
  };

  const setResult = (exId: string, i: number, patch: Partial<SerieResult>) => {
    const arr = resultsRef.current[exId] || (resultsRef.current[exId] = []);
    arr[i] = { ...(arr[i] || {}), ...patch };
    void persist(exId);
  };

  const steps = useMemo<GuidedStep[]>(() => {
    if (!ready) return [];
    const out: GuidedStep[] = [];
    const list = (exercises || []).filter((ex) => (ex?.exercice || "").trim().length > 0 && !ex?.cardio_sport);
    list.forEach((ex, exIdx) => {
      const sData = seriesOf(ex);
      const isDur = ex?.is_duration === true;
      const perSide = ex?.per_side === true;
      const n = sData.length;
      const key = (ex?.exercice || "").trim().toLowerCase();
      const lib = libByName[key] || {};
      const color = EX_COLORS[exIdx % EX_COLORS.length];

      const isEmom = String(ex?.recuperation || "").trim().toLowerCase() === "emom"
        || sData.some((s) => String(s.recuperation || "").trim().toLowerCase() === "emom");
      // Auto-enchaînement : exos en temps de travail (durée) ou en EMOM.
      const autoChain = isDur || isEmom;

      sData.forEach((sd, i) => {
        const chargeRaw = String(sd.charge || "").trim();
        const chargeNeedsInput = chargeRaw === "??" || /^(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)$/.test(chargeRaw);
        const isPct = /%/.test(chargeRaw);
        const dur = isEmom ? 60 : (isDur ? (parseInt(String(sd.reps), 10) || 0) : 0);
        const firstSerieOfExercise = i === 0;
        const lastOfSession = exIdx === list.length - 1 && i === n - 1;
        const lastOfExercise = i === n - 1;
        const nextLabel = lastOfSession
          ? "Fin de la séance"
          : lastOfExercise
            ? `Exercice suivant : ${list[exIdx + 1]?.exercice || ""}`
            : `Série ${i + 2}`;

        const base: Partial<GuidedStep> = {
          exName: ex.exercice,
          exNumber: exIdx + 1,
          exColor: color,
          serieLabel: `Série ${i + 1} / ${n}`,
          videoUrl: lib.video_url || undefined,
          isDistance: ex?.is_distance === true,
          perSide,
          description: i === 0 ? (lib.description || undefined) : undefined,
        };

        if (autoChain) {
          // ── Exercice auto-enchaîné (durée / EMOM) ──────────────────────────
          const workPhase = isEmom ? `🔥 ${sd.reps || "?"} reps` : "🔥 Vas-y";
          const pushAutoWork = (id: string, phaseLabel: string, isFirstSide: boolean) => {
            out.push({
              ...(base as GuidedStep),
              id, type: "work", isDuration: true, seconds: dur,
              refRpe: sd.rpe ? String(sd.rpe) : undefined,
              refTempo: sd.tempo ? String(sd.tempo) : undefined,
              phaseLabel, phaseColor: "#52b788",
              autoStart: true, autoAdvance: true,
              prepSeconds: firstSerieOfExercise && isFirstSide ? 10 : 3,
            });
          };
          if (isDur && perSide) {
            pushAutoWork(`w${exIdx}_${i}a`, "🔥 Côté 1", true);
            pushAutoWork(`w${exIdx}_${i}b`, "🔥 Côté 2", false);
          } else {
            pushAutoWork(`w${exIdx}_${i}`, workPhase, true);
          }
          if (lastOfExercise) {
            // Fin de l'exercice : on note le RPE + commentaire (pas d'auto-avance).
            out.push({
              id: `r${exIdx}_${i}`, type: "recup", seconds: 0, nextLabel,
              onRpe: (rpe) => setResult(ex.id, i, { rpe }),
              onComment: (text) => setResult(ex.id, i, { comment: text }),
            });
          } else {
            // Repos auto entre séries (EMOM : la minute inclut le repos → 0).
            out.push({
              id: `r${exIdx}_${i}`, type: "recup",
              seconds: isEmom ? 0 : recupSeconds(sd.recuperation),
              nextLabel, autoAdvance: true,
            });
          }
          return;
        }

        // ── Exercice classique (reps/charge) : validation + RPE par série ─────
        const workBase: Partial<GuidedStep> = {
          ...base,
          isDuration: false,
          targetReps: String(sd.reps || ""),
          targetCharge: chargeNeedsInput || isPct ? "" : chargeRaw,
          chargeNeedsInput,
          refCharge: chargeNeedsInput ? "à définir" : (chargeRaw ? `${chargeRaw}${/^\d+(\.\d+)?$/.test(chargeRaw) ? " kg" : ""}` : undefined),
          refRpe: sd.rpe ? String(sd.rpe) : undefined,
          refTempo: sd.tempo ? String(sd.tempo) : undefined,
        };
        const prev = out[out.length - 1];
        out.push({
          ...(workBase as GuidedStep),
          id: `w${exIdx}_${i}`, type: "work", phaseColor: "#52b788",
          autoStart: !!prev && prev.type === "work",
          prepSeconds: 0,
          onDone: (d) => setResult(ex.id, i, { actual_reps: d.reps ?? null, actual_charge: d.charge ?? null }),
        });
        const recSec = lastOfSession ? 0 : lastOfExercise ? (recupSeconds(sd.recuperation) || 30) : recupSeconds(sd.recuperation);
        out.push({
          id: `r${exIdx}_${i}`, type: "recup", seconds: recSec, nextLabel,
          onRpe: (rpe) => setResult(ex.id, i, { rpe }),
          onComment: (text) => setResult(ex.id, i, { comment: text }),
        });
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, exercises, libByName]);

  if (!ready || steps.length === 0) return null;

  return (
    <GuidedOverlay
      steps={steps}
      onClose={onClose}
      onFinish={() => { onFinish?.(); }}
    />
  );
}
