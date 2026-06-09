// =============================================================================
// readinessAlgorithm.ts
// Détection d'état de forme athlète par fusion de signaux pondérés par fiabilité.
// Fonctions pures — aucune dépendance UI ni Supabase.
// =============================================================================

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type ReadinessState =
  | "peak"
  | "good"
  | "moderate"
  | "fatigued"
  | "overtraining"
  | "undertraining"
  | "insufficient";

export type SignalKey = "load" | "wellness" | "sfms" | "efficiency" | "performance";

export interface SignalResult {
  key: SignalKey;
  label: string;
  /** Score 0-100 (null si aucune donnée exploitable) */
  score: number | null;
  /** Confiance 0-1 */
  confidence: number;
  /** Texte explicatif concis en français */
  detail: string;
  /** true si le signal dispose d'assez de données pour être pris en compte */
  available: boolean;
}

export interface OverrideResult {
  /** État forcé par l'override */
  state: ReadinessState;
  /** Raison affichable en français */
  reason: string;
}

export interface ReadinessResult {
  state: ReadinessState;
  /** Score fusionné 0-100 (null si insufficient) */
  score: number | null;
  /** Confiance totale 0-1 (somme normalisée des poids × confiance) */
  totalConfidence: number;
  signals: SignalResult[];
  /** Overrides déclenchés, dans l'ordre de priorité */
  overrides: OverrideResult[];
  /** Recommandation finale en français */
  recommendation: string;
}

// --- Inputs ------------------------------------------------------------------

export interface SessionInput {
  /** ISO date string */
  completed_at: string;
  session_rpe: number | null;
  duration_minutes: number | null;
}

export interface FatigueLogInput {
  date: string;
  fatigue: number; // 1-7
  courbatures: number; // 1-7
  sommeil: number; // 1-7
  stress: number; // 1-7
  score_total: number; // 4-28
}

export interface SfmsInput {
  total_score: number; // 0-54
  completed_at: string;
}

export interface StravaActivityInput {
  start_date: string;
  distance_meters: number;
  moving_time_seconds: number;
  average_heartrate: number | null;
  sport_type: string;
}

export interface PerformanceTestInput {
  date: string;
  vma: number | null;
  fc_max: number | null;
  type: string;
}

export interface ReadinessInputs {
  /** Séances programmées + libres fusionnées (28 derniers jours) */
  sessions: SessionInput[];
  /** Logs Hooper (7 derniers jours) */
  fatigueLogs: FatigueLogInput[];
  /** Dernier questionnaire SFMS (ou null) */
  sfms: SfmsInput | null;
  /** Activités Strava (courses) */
  stravaActivities: StravaActivityInput[];
  /** Tests terrain (120 derniers jours) */
  performanceTests: PerformanceTestInput[];
  /** Date de référence (par défaut: maintenant) — utile pour tests */
  now?: Date;
}

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const WEIGHTS: Record<SignalKey, number> = {
  load: 0.3,
  wellness: 0.3,
  sfms: 0.2,
  efficiency: 0.1,
  performance: 0.1,
};

const MIN_TOTAL_CONFIDENCE = 0.12; // ~2 jours de Hooper sur 7 suffisent à activer le score

// -----------------------------------------------------------------------------
// Utilitaires
// -----------------------------------------------------------------------------

const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const daysBetween = (a: Date, b: Date): number =>
  Math.abs(a.getTime() - b.getTime()) / 86_400_000;

const dayKey = (d: Date): string => d.toISOString().slice(0, 10);

/** Numéro de semaine ISO sous forme "YYYY-Www" */
const isoWeekKey = (d: Date): string => {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // lundi = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // jeudi de la semaine
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week =
    1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};

const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;

/**
 * EMA d'une série journalière. `series` indexé par jour (0 = jour le plus ancien),
 * jours sans activité = 0. Halflife implicite via alpha = 2/(N+1).
 */
const ema = (series: number[], windowDays: number): number => {
  if (series.length === 0) return 0;
  const alpha = 2 / (windowDays + 1);
  let value = series[0];
  for (let i = 1; i < series.length; i++) {
    value = alpha * series[i] + (1 - alpha) * value;
  }
  return value;
};

// -----------------------------------------------------------------------------
// Signal 1 — Charge d'entraînement (ACWR)
// -----------------------------------------------------------------------------

interface LoadComputation extends SignalResult {
  acwr: number | null;
}

const computeLoadSignal = (sessions: SessionInput[], now: Date): LoadComputation => {
  const label = "Charge d'entraînement";
  const valid = sessions.filter(
    (s) => s.session_rpe != null && s.duration_minutes != null && s.duration_minutes > 0
  );

  const confidence = clamp(valid.length / 8, 0, 1);

  if (valid.length === 0) {
    return {
      key: "load",
      label,
      score: null,
      confidence: 0,
      detail: "Aucune séance avec RPE renseigné sur les 28 derniers jours.",
      available: false,
      acwr: null,
    };
  }

  // sRPE journalier sur 28 jours.
  const horizon = 28;
  const byDay = new Map<string, number>();
  for (const s of valid) {
    const d = new Date(s.completed_at);
    if (daysBetween(now, d) > horizon) continue;
    const srpe = (s.session_rpe as number) * (s.duration_minutes as number);
    byDay.set(dayKey(d), (byDay.get(dayKey(d)) ?? 0) + srpe);
  }

  // Série chronologique j-27 → j0.
  const series: number[] = [];
  for (let i = horizon - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    series.push(byDay.get(dayKey(d)) ?? 0);
  }

  const atl = ema(series, 7); // charge aiguë (EMA 7j sur toute la série)
  const ctl = ema(series, 28); // charge chronique (EMA 28j)
  const acwr = ctl > 0 ? atl / ctl : null;

  let score: number;
  if (acwr == null) {
    score = 50;
  } else if (acwr < 0.5) {
    score = 20;
  } else if (acwr < 0.8) {
    score = lerp(20, 80, (acwr - 0.5) / 0.3);
  } else if (acwr <= 1.3) {
    score = lerp(90, 80, (acwr - 0.8) / 0.5);
  } else if (acwr <= 1.5) {
    score = lerp(80, 15, (acwr - 1.3) / 0.2);
  } else {
    score = 15;
  }
  score = clamp(score, 0, 100);

  const detail =
    acwr == null
      ? `${valid.length} séance(s) — charge chronique insuffisante pour un ACWR fiable.`
      : `ACWR ${acwr.toFixed(2)} (charge aiguë/chronique sur ${valid.length} séances). ` +
        (acwr < 0.8
          ? "Charge sous-optimale."
          : acwr <= 1.3
            ? "Charge dans la zone optimale."
            : "Pic de charge — risque accru.");

  return {
    key: "load",
    label,
    score,
    confidence,
    detail,
    available: confidence > 0,
    acwr,
  };
};

// -----------------------------------------------------------------------------
// Signal 2 — Bien-être Hooper
// -----------------------------------------------------------------------------

interface WellnessComputation extends SignalResult {
  /** Jours consécutifs récents avec score_total > 20 */
  consecutiveHighDays: number;
}

const normalizeHooper = (scoreTotal: number): number =>
  clamp(lerp(100, 0, (scoreTotal - 4) / 24), 0, 100);

const computeWellnessSignal = (
  logs: FatigueLogInput[],
  now: Date
): WellnessComputation => {
  const label = "Bien-être (Hooper)";
  const recent = logs
    .filter((l) => daysBetween(now, new Date(l.date)) <= 7)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date)); // plus récent d'abord

  const confidence = clamp(recent.length / 7, 0, 1);

  if (recent.length === 0) {
    return {
      key: "wellness",
      label,
      score: null,
      confidence: 0,
      detail: "Aucun questionnaire Hooper sur les 7 derniers jours.",
      available: false,
      consecutiveHighDays: 0,
    };
  }

  const last3 = recent.slice(0, 3);
  const baseScore = normalizeHooper(mean(last3.map((l) => l.score_total)));

  // Bonus tendance ±10 : moitié récente vs moitié ancienne (chronologique).
  const chrono = [...recent].reverse();
  let trendBonus = 0;
  if (chrono.length >= 4) {
    const half = Math.floor(chrono.length / 2);
    const older = mean(chrono.slice(0, half).map((l) => l.score_total));
    const newer = mean(chrono.slice(chrono.length - half).map((l) => l.score_total));
    // Score Hooper bas = mieux → amélioration = newer < older.
    const delta = older - newer; // >0 = amélioration
    trendBonus = clamp(delta * 2, -10, 10);
  }

  const score = clamp(baseScore + trendBonus, 0, 100);

  // Jours consécutifs récents > 20.
  let consecutiveHighDays = 0;
  for (const l of recent) {
    if (l.score_total > 20) consecutiveHighDays++;
    else break;
  }

  const trendTxt =
    trendBonus > 1 ? " ↑ en amélioration" : trendBonus < -1 ? " ↓ en dégradation" : "";
  const detail =
    `Score Hooper moyen ${mean(last3.map((l) => l.score_total)).toFixed(0)}/28 ` +
    `sur ${last3.length} jour(s)${trendTxt}. ${recent.length}/7 logs disponibles.`;

  return {
    key: "wellness",
    label,
    score,
    confidence,
    detail,
    available: confidence > 0,
    consecutiveHighDays,
  };
};

// -----------------------------------------------------------------------------
// Signal 3 — SFMS (surentraînement)
// -----------------------------------------------------------------------------

const computeSfmsSignal = (sfms: SfmsInput | null, now: Date): SignalResult => {
  const label = "SFMS (surentraînement)";

  if (!sfms) {
    return {
      key: "sfms",
      label,
      score: null,
      confidence: 0,
      detail: "Aucun questionnaire SFMS renseigné.",
      available: false,
    };
  }

  const age = daysBetween(now, new Date(sfms.completed_at));
  let confidence: number;
  if (age < 7) confidence = 1;
  else if (age <= 30) confidence = lerp(1, 0.5, (age - 7) / 23);
  else if (age <= 60) confidence = lerp(0.5, 0, (age - 30) / 30);
  else confidence = 0;
  confidence = clamp(confidence, 0, 1);

  const score = clamp(lerp(100, 0, sfms.total_score / 54), 0, 100);

  const detail =
    `Score SFMS ${sfms.total_score}/54 (il y a ${Math.round(age)} j). ` +
    (sfms.total_score > 35
      ? "Signes de surmenage."
      : sfms.total_score > 20
        ? "Vigilance."
        : "Pas de signe de surmenage.");

  return {
    key: "sfms",
    label,
    score,
    confidence,
    detail,
    available: confidence > 0,
  };
};

// -----------------------------------------------------------------------------
// Signal 4 — Efficience aérobie
// -----------------------------------------------------------------------------

const RUN_TYPES = new Set([
  "Run",
  "TrailRun",
  "VirtualRun",
  "run",
  "trail_run",
  "running",
]);

const computeEfficiencySignal = (
  activities: StravaActivityInput[],
  now: Date
): SignalResult => {
  const label = "Efficience aérobie";

  const runs = activities.filter(
    (a) =>
      RUN_TYPES.has(a.sport_type) &&
      a.average_heartrate != null &&
      a.average_heartrate > 0 &&
      a.moving_time_seconds > 0 &&
      a.distance_meters > 0
  );

  // Efficience par activité = (m/min) / bpm.
  const byWeek = new Map<string, { sum: number; count: number; date: Date }>();
  for (const a of runs) {
    const d = new Date(a.start_date);
    const speedMperMin = (a.distance_meters / a.moving_time_seconds) * 60;
    const eff = speedMperMin / (a.average_heartrate as number);
    const wk = isoWeekKey(d);
    const cur = byWeek.get(wk) ?? { sum: 0, count: 0, date: d };
    cur.sum += eff;
    cur.count += 1;
    if (d > cur.date) cur.date = d;
    byWeek.set(wk, cur);
  }

  const weeks = [...byWeek.values()]
    .map((w) => ({ eff: w.sum / w.count, date: w.date }))
    .sort((a, b) => +a.date - +b.date); // chronologique

  const nWeeks = weeks.length;

  if (nWeeks < 3) {
    return {
      key: "efficiency",
      label,
      score: null,
      confidence: 0,
      detail: `Efficience indisponible (${nWeeks} semaine(s) de course avec FC, minimum 3).`,
      available: false,
    };
  }

  const confidence = clamp(nWeeks / 8, 0, 1);

  const recent = weeks.slice(-2);
  const recentEff = mean(recent.map((w) => w.eff));
  const historyEff = mean(weeks.slice(0, -2).map((w) => w.eff));
  const delta = historyEff > 0 ? (recentEff - historyEff) / historyEff : 0; // ratio

  // delta +5% → 85, 0 → 70, -5% → 50.
  let score: number;
  const pct = delta * 100;
  if (pct >= 5) score = 85;
  else if (pct >= 0) score = lerp(70, 85, pct / 5);
  else if (pct >= -5) score = lerp(70, 50, -pct / 5);
  else score = 50;
  score = clamp(score, 0, 100);

  const detail =
    `Efficience récente ${recentEff.toFixed(3)} m/min/bpm vs ${historyEff.toFixed(3)} ` +
    `historique (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%, ${nWeeks} semaines).`;

  return {
    key: "efficiency",
    label,
    score,
    confidence,
    detail,
    available: confidence > 0,
  };
};

// -----------------------------------------------------------------------------
// Signal 5 — Tendance performances (VMA)
// -----------------------------------------------------------------------------

const computePerformanceSignal = (
  tests: PerformanceTestInput[],
  now: Date
): SignalResult => {
  const label = "Tendance performances";

  const valid = tests
    .filter((t) => t.vma != null && daysBetween(now, new Date(t.date)) <= 120)
    .sort((a, b) => +new Date(a.date) - +new Date(b.date)); // chronologique

  const nTests = valid.length;

  if (nTests < 2) {
    return {
      key: "performance",
      label,
      score: null,
      confidence: 0,
      detail: `Tendance VMA indisponible (${nTests} test(s) sur 120 j, minimum 2).`,
      available: false,
    };
  }

  const first = valid[0];
  const last = valid[valid.length - 1];
  const firstVma = first.vma as number;
  const lastVma = last.vma as number;
  const delta = firstVma > 0 ? (lastVma - firstVma) / firstVma : 0;
  const pct = delta * 100;

  // delta +3% → 85, 0 → 70, -3% → 50.
  let score: number;
  if (pct >= 3) score = 85;
  else if (pct >= 0) score = lerp(70, 85, pct / 3);
  else if (pct >= -3) score = lerp(70, 50, -pct / 3);
  else score = 50;
  score = clamp(score, 0, 100);

  const ageLast = daysBetween(now, new Date(last.date));
  const recencyBonus = ageLast < 30 ? 1 : ageLast < 60 ? 0.7 : 0.4;
  const confidence = clamp((nTests / 3) * recencyBonus, 0, 1);

  const detail =
    `VMA ${firstVma.toFixed(1)} → ${lastVma.toFixed(1)} km/h ` +
    `(${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%, ${nTests} tests, dernier il y a ${Math.round(ageLast)} j).`;

  return {
    key: "performance",
    label,
    score,
    confidence,
    detail,
    available: confidence > 0,
  };
};

// -----------------------------------------------------------------------------
// État + recommandation
// -----------------------------------------------------------------------------

export const STATE_LABELS: Record<ReadinessState, string> = {
  peak: "Pic de forme",
  good: "Bonne forme",
  moderate: "Fatigue modérée",
  fatigued: "Fatigue accumulée",
  overtraining: "Surmenage",
  undertraining: "Sous-entraînement",
  insufficient: "Données insuffisantes",
};

const scoreToState = (score: number): ReadinessState => {
  if (score >= 85) return "peak";
  if (score >= 70) return "good";
  if (score >= 55) return "moderate";
  if (score >= 40) return "fatigued";
  return "overtraining";
};

const recommend = (state: ReadinessState): string => {
  switch (state) {
    case "peak":
      return "Forme optimale : c'est le moment pour une séance clé ou une compétition.";
    case "good":
      return "Bonne forme : poursuivre la planification prévue.";
    case "moderate":
      return "Fatigue modérée : maintenir la charge mais surveiller la récupération.";
    case "fatigued":
      return "Fatigue accumulée : alléger la charge et prioriser le sommeil sur 2-3 jours.";
    case "overtraining":
      return "Surmenage : décharge marquée ou repos. Réévaluer après quelques jours.";
    case "undertraining":
      return "Charge très faible : possibilité d'augmenter progressivement le volume.";
    case "insufficient":
      return "Données insuffisantes : compléter le suivi quotidien pour activer le diagnostic.";
  }
};

// -----------------------------------------------------------------------------
// Fonction principale
// -----------------------------------------------------------------------------

export const computeReadiness = (inputs: ReadinessInputs): ReadinessResult => {
  const now = inputs.now ?? new Date();

  const load = computeLoadSignal(inputs.sessions ?? [], now);
  const wellness = computeWellnessSignal(inputs.fatigueLogs ?? [], now);
  const sfms = computeSfmsSignal(inputs.sfms ?? null, now);
  const efficiency = computeEfficiencySignal(inputs.stravaActivities ?? [], now);
  const performance = computePerformanceSignal(inputs.performanceTests ?? [], now);

  const signalsFull = [load, wellness, sfms, efficiency, performance];
  const signals: SignalResult[] = signalsFull.map((s) => ({
    key: s.key,
    label: s.label,
    score: s.score,
    confidence: s.confidence,
    detail: s.detail,
    available: s.available,
  }));

  // --- Fusion pondérée -------------------------------------------------------
  let numerator = 0;
  let denominator = 0;
  let weightSum = 0;

  for (const s of signalsFull) {
    const w = WEIGHTS[s.key];
    weightSum += w;
    if (s.score == null || s.confidence <= 0) continue;
    const c = s.confidence;
    numerator += s.score * c * w;
    denominator += c * w;
  }

  // Confiance totale normalisée par la somme des poids (= 1.0 en théorie).
  const totalConfidence = weightSum > 0 ? denominator / weightSum : 0;
  const fusedScore = denominator > 0 ? numerator / denominator : null;

  // --- Overrides absolus (priorité décroissante) -----------------------------
  const overrides: OverrideResult[] = [];

  // ACWR > 1.5 → overtraining.
  if (load.acwr != null && load.acwr > 1.5) {
    overrides.push({
      state: "overtraining",
      reason: `ACWR critique (${load.acwr.toFixed(2)} > 1.5) : pic de charge dangereux.`,
    });
  }
  // SFMS > 35 → overtraining.
  if (inputs.sfms && inputs.sfms.total_score > 35) {
    overrides.push({
      state: "overtraining",
      reason: `Score SFMS élevé (${inputs.sfms.total_score}/54 > 35) : surmenage avéré.`,
    });
  }
  // Hooper > 20 pendant 3+ jours → fatigued.
  if (wellness.consecutiveHighDays >= 3) {
    overrides.push({
      state: "fatigued",
      reason: `Score Hooper > 20 sur ${wellness.consecutiveHighDays} jours consécutifs : fatigue persistante.`,
    });
  }

  // --- Détermination de l'état ----------------------------------------------
  let state: ReadinessState;
  let score: number | null = fusedScore;

  if (totalConfidence < MIN_TOTAL_CONFIDENCE || fusedScore == null) {
    state = "insufficient";
    score = null;
  } else {
    // Priorité : overtraining (ACWR/SFMS) > sous-entraînement > fatigued (Hooper) > score brut.
    const hasOvertraining = overrides.some((o) => o.state === "overtraining");
    const hasFatigued = overrides.some((o) => o.state === "fatigued");

    // Sous-entraînement : charge très faible + bien-être normal.
    const loadLow = load.score != null && load.available && load.score < 25;
    const wellnessOk =
      wellness.score != null && wellness.available && wellness.score > 65;

    if (hasOvertraining) {
      state = "overtraining";
    } else if (loadLow && wellnessOk) {
      // Charge faible mais récupération bonne : sous-entraînement, pas surmenage.
      state = "undertraining";
    } else if (hasFatigued) {
      // Override Hooper : force exactement "fatigued", sauf si le score brut est pire.
      const baseState = scoreToState(fusedScore);
      state = baseState === "overtraining" ? "overtraining" : "fatigued";
    } else {
      state = scoreToState(fusedScore);
    }
  }

  return {
    state,
    score: score == null ? null : Math.round(score),
    totalConfidence,
    signals,
    overrides,
    recommendation: recommend(state),
  };
};
