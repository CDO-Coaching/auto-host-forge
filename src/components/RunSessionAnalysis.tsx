/**
 * Bande d'analyse compacte d'une séance de course :
 * écart au prescrit (allure + zone FC), charge sRPE, efficience aérobie,
 * GAP (allure ajustée au dénivelé) et cadence contextualisée.
 */

interface Props {
  durationMin: number | null;
  distanceKm: number | null;
  paceMinPerKm: string | null;      // ex "5:30"
  avgHr: number | null;
  rpe: number | null;
  elevationGain?: number | null;
  cadence?: number | null;
  cardioContent?: string | null;    // JSON des steps prévus
  vma?: number | null;
  fcMax?: number | null;
  fcRepos?: number | null;
}

type Chip = { label: string; value: string; tone: "ok" | "warn" | "bad" | "neutral" };

const fmtPace = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

const parsePace = (s: string | null | undefined) => {
  const m = String(s || "").match(/(\d+)[:'](\d{1,2})/);
  return m ? (+m[1]) * 60 + (+m[2]) : null;
};

export function RunSessionAnalysis({
  durationMin, distanceKm, paceMinPerKm, avgHr, rpe,
  elevationGain = 0, cadence = null, cardioContent = null,
  vma = null, fcMax = null, fcRepos = null,
}: Props) {
  // Cible prescrite (depuis le plan cardio)
  let targetPct: number | null = null;
  let targetZone: number | null = null;
  if (cardioContent) {
    try {
      const p = JSON.parse(cardioContent);
      const steps = Array.isArray(p) ? p : (p.steps || []);
      for (const s of steps) {
        if (targetPct == null && s.vma_percentage) targetPct = s.vma_percentage;
        if (targetZone == null && s.target_heart_rate) targetZone = parseInt(String(s.target_heart_rate).replace(/\D/g, "")) || null;
      }
    } catch { /* ignore */ }
  }

  const chips: Chip[] = [];

  // 1. Allure cible vs réelle
  const actualPaceSec = parsePace(paceMinPerKm);
  if (vma && targetPct && actualPaceSec) {
    const targetPaceSec = 3600 / (vma * targetPct / 100);
    const delta = actualPaceSec - targetPaceSec; // <0 = plus rapide
    const tone: Chip["tone"] = Math.abs(delta) <= 12 ? "ok" : "warn";
    const verdict = Math.abs(delta) <= 12 ? "conforme" : delta < 0 ? `+${fmtPace(-delta)} trop rapide` : `${fmtPace(delta)} trop lent`;
    chips.push({ label: `Allure (cible ${fmtPace(targetPaceSec)}/km)`, value: verdict, tone });
  }

  // 2. Zone FC cible vs FC moyenne
  if (avgHr && targetZone && fcMax && fcRepos) {
    const fcr = fcMax - fcRepos;
    const low = fcRepos + fcr * (40 + targetZone * 10) / 100;
    const high = fcRepos + fcr * (50 + targetZone * 10) / 100;
    const tone: Chip["tone"] = avgHr < low ? "warn" : avgHr > high ? "bad" : "ok";
    const verdict = avgHr < low ? "trop facile" : avgHr > high ? "trop intense" : "dans la cible";
    chips.push({ label: `Zone Z${targetZone} (${Math.round(low)}–${Math.round(high)})`, value: verdict, tone });
  }

  // 3. Charge sRPE
  if (durationMin && rpe) chips.push({ label: "Charge", value: `${Math.round(durationMin * rpe)} UA`, tone: "neutral" });

  // 4. Efficience aérobie
  if (durationMin && distanceKm && avgHr) {
    const ratio = (distanceKm * 1000 / durationMin) / avgHr;
    chips.push({ label: "Efficience", value: `${ratio.toFixed(2)} m/min·bpm`, tone: "neutral" });
  }

  // 5. GAP (dénivelé significatif uniquement)
  if (durationMin && distanceKm && (elevationGain ?? 0) >= 40) {
    const equivKm = distanceKm + (elevationGain as number) * 0.0075;
    chips.push({ label: "GAP (estimé)", value: `${fmtPace((durationMin * 60) / equivKm)}/km`, tone: "neutral" });
  }

  // 6. Cadence
  if (cadence) {
    const ppm = cadence < 130 ? Math.round(cadence * 2) : Math.round(cadence);
    const tone: Chip["tone"] = ppm >= 170 && ppm <= 185 ? "ok" : ppm < 160 ? "warn" : "neutral";
    chips.push({ label: "Cadence", value: `${ppm} ppm`, tone });
  }

  if (chips.length === 0) return null;

  const toneClass: Record<Chip["tone"], string> = {
    ok: "border-emerald-500/40 text-emerald-400",
    warn: "border-amber-500/40 text-amber-400",
    bad: "border-red-500/40 text-red-400",
    neutral: "border-border text-muted-foreground",
  };

  return (
    <div className="mt-2 pt-2 border-t border-emerald-500/20">
      <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider mb-1.5">Analyse</p>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c, i) => (
          <span key={i} className={`text-[10px] rounded-md border px-1.5 py-0.5 ${toneClass[c.tone]}`}>
            <span className="opacity-70">{c.label} ·</span> <span className="font-semibold">{c.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
