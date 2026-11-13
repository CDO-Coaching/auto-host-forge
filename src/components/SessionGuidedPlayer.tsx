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

type Serie = { reps: string; charge: string; rpe: string; tempo: string; recuperation: string; commentaire: string };

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
      commentaire: (d.commentaire || ex?.commentaire || "").toString(),
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
  const [orderedSteps, setOrderedSteps] = useState<GuidedStep[]>([]);

  // Reporter un (ou plusieurs, pour un superset) exercice(s) en fin de séance.
  const deferExercises = (exIds: string[]) => {
    const set = new Set(exIds);
    setOrderedSteps((prev) => {
      const block = prev.filter((s) => s.exId && set.has(s.exId));
      const rest = prev.filter((s) => !(s.exId && set.has(s.exId)));
      return [...rest, ...block];
    });
  };

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
    // Tableau dense sans trous (sinon JSON écrit des `null` qui plantent la vue coach).
    const details: any[] = [];
    for (let i = 0; i < arr.length; i++) {
      const s = arr[i] || {};
      details.push({
        rpe: s.rpe ?? null,
        actual_reps: s.actual_reps ?? null,
        actual_charge: s.actual_charge ?? null,
        modification_type: null,
      });
    }
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

    const libOf = (ex: any) => libByName[(ex?.exercice || "").trim().toLowerCase()] || {};
    const colorOf = (n: number) => EX_COLORS[((n % EX_COLORS.length) + EX_COLORS.length) % EX_COLORS.length];
    const emomOf = (ex: any, sData: Serie[]) => String(ex?.recuperation || "").trim().toLowerCase() === "emom"
      || sData.some((s) => String(s.recuperation || "").trim().toLowerCase() === "emom");
    const chargeInfo = (raw: string) => {
      const chargeRaw = String(raw || "").trim();
      const chargeNeedsInput = chargeRaw === "??" || /^(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)$/.test(chargeRaw);
      const isPct = /%/.test(chargeRaw);
      return {
        chargeNeedsInput,
        targetCharge: chargeNeedsInput || isPct ? "" : chargeRaw,
        refCharge: chargeNeedsInput ? "à définir" : (chargeRaw ? `${chargeRaw}${/^\d+(\.\d+)?$/.test(chargeRaw) ? " kg" : ""}` : undefined),
      };
    };
    const coachNoteOf = (ex: any, sd: Serie) => (sd?.commentaire || ex?.commentaire || "").trim();

    // ── Exercice simple ───────────────────────────────────────────────────────
    const pushExercise = (ex: any, number: number, congrats: string) => {
      const sData = seriesOf(ex);
      const isDur = ex?.is_duration === true;
      const perSide = ex?.per_side === true;
      const n = sData.length;
      const lib = libOf(ex);
      const color = colorOf(number - 1);
      const isEmom = emomOf(ex, sData);
      const autoChain = isDur || isEmom;

      sData.forEach((sd, i) => {
        const dur = isEmom ? 60 : (isDur ? (parseInt(String(sd.reps), 10) || 0) : 0);
        const firstSerie = i === 0;
        const lastSerie = i === n - 1;
        const nextLabel = lastSerie ? congrats : `Série ${i + 2}`;
        const coachNote = coachNoteOf(ex, sd);
        const base: Partial<GuidedStep> = {
          exName: ex.exercice, exNumber: number, exColor: color,
          serieLabel: `Série ${i + 1} / ${n}`,
          videoUrl: lib.video_url || undefined,
          isDistance: ex?.is_distance === true, perSide, exId: ex.id,
        };

        if (autoChain) {
          const restSec = recupSeconds(sd.recuperation);
          const structure = isEmom
            ? `${sd.reps || "?"} reps chaque minute × ${n}`
            : (perSide
              ? `${dur} s par côté (2 côtés) / ${restSec} s de récup × ${n}`
              : (restSec > 0 ? `${dur} s d'effort / ${restSec} s de récup × ${n}` : `${dur} s × ${n}`));
          const startDesc = [structure, lib.description].filter(Boolean).join("\n\n");
          const pushAutoWork = (id: string, phaseLabel: string, isFirstSide: boolean) => {
            const isStart = firstSerie && isFirstSide;
            out.push({
              ...(base as GuidedStep), id, type: "work", isDuration: true, seconds: dur,
              refRpe: sd.rpe ? String(sd.rpe) : undefined, refTempo: sd.tempo ? String(sd.tempo) : undefined,
              phaseLabel, phaseColor: "#52b788",
              autoStart: !isStart, autoAdvance: true, prepSeconds: isStart ? 10 : 3, compact: !isStart,
              onDefer: isStart ? () => deferExercises([ex.id]) : undefined,
              description: isStart ? startDesc : undefined,
              coachNote: isStart ? (coachNote || undefined) : undefined,
            });
          };
          if (perSide) {
            // Unilatéral : côté 1 puis côté 2 (chacun la durée), enchaînés, puis récup.
            pushAutoWork(`w_${ex.id}_${i}a`, "🔥 Côté 1", true);
            pushAutoWork(`w_${ex.id}_${i}b`, "🔥 Côté 2", false);
          } else {
            pushAutoWork(`w_${ex.id}_${i}`, isEmom ? `🔥 ${sd.reps || "?"} reps` : "🔥 Vas-y", true);
          }
          out.push(lastSerie
            ? { id: `r_${ex.id}_${i}`, exId: ex.id, type: "recup", seconds: 0, nextLabel, refRpe: sd.rpe ? String(sd.rpe) : undefined, videoUrl: lib.video_url || undefined, onRpe: (rpe) => setResult(ex.id, i, { rpe }), onComment: (t) => setResult(ex.id, i, { comment: t }) }
            : { id: `r_${ex.id}_${i}`, exId: ex.id, type: "recup", seconds: isEmom ? 0 : restSec, nextLabel, autoAdvance: true, videoUrl: lib.video_url || undefined });
          return;
        }

        // reps / charge classiques
        const ci = chargeInfo(sd.charge);
        const prev = out[out.length - 1];
        out.push({
          ...(base as GuidedStep), id: `w_${ex.id}_${i}`, type: "work", isDuration: false,
          targetReps: String(sd.reps || ""), targetCharge: ci.targetCharge, chargeNeedsInput: ci.chargeNeedsInput,
          refCharge: ci.refCharge, refRpe: sd.rpe ? String(sd.rpe) : undefined, refTempo: sd.tempo ? String(sd.tempo) : undefined,
          phaseColor: "#52b788", autoStart: !!prev && prev.type === "work",
          description: firstSerie ? (lib.description || undefined) : undefined,
          coachNote: firstSerie ? (coachNote || undefined) : undefined,
          onDefer: firstSerie ? () => deferExercises([ex.id]) : undefined,
          onDone: (d) => setResult(ex.id, i, { actual_reps: d.reps ?? null, actual_charge: d.charge ?? null }),
        });
        out.push({
          id: `r_${ex.id}_${i}`, exId: ex.id, type: "recup", seconds: lastSerie ? 0 : recupSeconds(sd.recuperation), nextLabel,
          refRpe: lastSerie && sd.rpe ? String(sd.rpe) : undefined,
          videoUrl: lib.video_url || undefined,
          onRpe: (rpe) => setResult(ex.id, i, { rpe }), onComment: (t) => setResult(ex.id, i, { comment: t }),
        });
      });
    };

    // ── Superset : alternance des exercices à chaque tour ─────────────────────
    const pushSuperset = (exs: any[], startNumber: number, congrats: string) => {
      const metas = exs.map((ex, k) => {
        const sData = seriesOf(ex);
        return { ex, sData, isDur: ex?.is_duration === true, isEmom: emomOf(ex, sData), lib: libOf(ex), color: colorOf(startNumber - 1 + k), number: startNumber + k };
      });
      const rounds = Math.max(1, ...metas.map((m) => m.sData.length));
      const groupIds = exs.map((e) => e.id);
      const titleColor = metas[0].color;

      // Écran d'intro du superset : liste des exercices + structure.
      const introLines = metas.map((m, k) => {
        const f = m.sData[0] || ({} as Serie);
        const kind = (m.isDur || m.isEmom)
          ? (m.isEmom ? `${f.reps || "?"} reps/min` : `${parseInt(String(f.reps), 10) || 0} s`)
          : `${f.reps || "?"} reps`;
        const ch = f.charge ? ` · ${f.charge}${/^\d+(\.\d+)?$/.test(String(f.charge).trim()) ? " kg" : ""}` : "";
        return `${k + 1}. ${m.ex.exercice} — ${kind}${ch}`;
      });
      out.push({
        id: `intro_${exs[0].id}`, type: "intro", exId: exs[0].id, exColor: titleColor,
        introTitle: `Superset · ${rounds} tour${rounds > 1 ? "s" : ""}`,
        exName: metas.map((m) => m.ex.exercice).join(" + "),
        description: `À faire en alternance, ${rounds} tour${rounds > 1 ? "s" : ""} :\n${introLines.join("\n")}`,
        onDefer: () => deferExercises(groupIds),
      });

      for (let r = 0; r < rounds; r++) {
        const lastRound = r === rounds - 1;
        metas.forEach((m, k) => {
          const sd = m.sData[r];
          if (!sd) return;
          const isTimed = m.isDur || m.isEmom;
          const dur = m.isEmom ? 60 : (m.isDur ? (parseInt(String(sd.reps), 10) || 0) : 0);
          const coachNote = r === 0 ? coachNoteOf(m.ex, sd) : "";
          const desc = r === 0 ? (m.lib.description || undefined) : undefined;
          const base: Partial<GuidedStep> = {
            exName: m.ex.exercice, exNumber: m.number, exColor: m.color,
            serieLabel: `Tour ${r + 1} / ${rounds}`, videoUrl: m.lib.video_url || undefined,
            isDistance: m.ex?.is_distance === true, perSide: m.ex?.per_side === true, exId: m.ex.id,
            description: desc, coachNote: coachNote || undefined,
          };
          const prev = out[out.length - 1];
          if (isTimed) {
            out.push({
              ...(base as GuidedStep), id: `w_${m.ex.id}_${r}`, type: "work", isDuration: true, seconds: dur,
              refRpe: sd.rpe ? String(sd.rpe) : undefined, refTempo: sd.tempo ? String(sd.tempo) : undefined,
              phaseLabel: m.isEmom ? `🔥 ${sd.reps || "?"} reps` : "🔥 Vas-y",
              phaseColor: "#52b788", autoStart: true, autoAdvance: true, prepSeconds: (r === 0 && k === 0) ? 5 : 3,
            });
          } else {
            const ci = chargeInfo(sd.charge);
            out.push({
              ...(base as GuidedStep), id: `w_${m.ex.id}_${r}`, type: "work", isDuration: false,
              targetReps: String(sd.reps || ""), targetCharge: ci.targetCharge, chargeNeedsInput: ci.chargeNeedsInput,
              refCharge: ci.refCharge, refRpe: sd.rpe ? String(sd.rpe) : undefined, refTempo: sd.tempo ? String(sd.tempo) : undefined,
              phaseColor: "#52b788", autoStart: !!prev && prev.type === "work",
              onDone: (d) => setResult(m.ex.id, r, { actual_reps: d.reps ?? null, actual_charge: d.charge ?? null }),
            });
          }
        });

        if (!lastRound) {
          const recSec = recupSeconds(metas[0].sData[r]?.recuperation || "") || 60;
          out.push({
            id: `rr_${exs[0].id}_${r}`, exId: exs[0].id, type: "recup", seconds: recSec,
            nextLabel: `Tour ${r + 2} / ${rounds}`, autoAdvance: metas.every((m) => m.isDur || m.isEmom),
          });
        } else {
          // Fin du superset : RPE + commentaire pour chaque exercice.
          metas.forEach((m, k) => {
            const lastIdx = Math.max(0, m.sData.length - 1);
            const isLast = k === metas.length - 1;
            const lastSd = m.sData[lastIdx] || ({} as Serie);
            out.push({
              id: `rpe_${m.ex.id}`, exId: m.ex.id, type: "recup", seconds: 0,
              exName: m.ex.exercice, exColor: m.color, videoUrl: m.lib.video_url || undefined,
              refRpe: lastSd.rpe ? String(lastSd.rpe) : undefined,
              nextLabel: isLast ? congrats : `RPE : ${metas[k + 1].ex.exercice}`,
              onRpe: (rpe) => setResult(m.ex.id, lastIdx, { rpe }),
              onComment: (t) => setResult(m.ex.id, lastIdx, { comment: t }),
            });
          });
        }
      }
    };

    // ── Découpage en blocs (exercice simple / superset) ───────────────────────
    const blocks: Array<{ type: "single"; ex: any } | { type: "superset"; exs: any[] }> = [];
    let i = 0;
    while (i < list.length) {
      const ex = list[i];
      if (ex?.super_set_group) {
        const g = [ex]; let j = i + 1;
        while (j < list.length && list[j]?.super_set_group === ex.super_set_group) { g.push(list[j]); j++; }
        blocks.push(g.length > 1 ? { type: "superset", exs: g } : { type: "single", ex: g[0] });
        i = j;
      } else { blocks.push({ type: "single", ex }); i++; }
    }

    let number = 0;
    blocks.forEach((block, bIdx) => {
      const last = bIdx === blocks.length - 1;
      const nextName = last ? "" : (blocks[bIdx + 1].type === "single"
        ? (blocks[bIdx + 1] as any).ex.exercice
        : (blocks[bIdx + 1] as any).exs.map((e: any) => e.exercice).join(" + "));
      const congrats = last ? "Bravo, séance terminée 🎉" : `Bravo ! 👏 Ensuite : ${nextName}`;
      if (block.type === "single") { number += 1; pushExercise(block.ex, number, congrats); }
      else { pushSuperset(block.exs, number + 1, congrats); number += block.exs.length; }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, exercises, libByName]);

  // Initialise l'ordre jouable (modifiable ensuite par « reporter l'exercice »).
  useEffect(() => { setOrderedSteps(steps); }, [steps]);

  if (!ready || orderedSteps.length === 0) return null;

  return (
    <GuidedOverlay
      steps={orderedSteps}
      onClose={onClose}
      onFinish={() => { onFinish?.(); }}
    />
  );
}
