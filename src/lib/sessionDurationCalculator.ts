/**
 * Calcule la durée totale estimée d'une séance de renforcement.
 *
 * Prend en compte :
 *  - Tempo (format "3010" ou "X-Y-Z-W" avec tirets, lettres X/x ignorées)
 *  - Par côté (per_side) → temps de set × 2
 *  - Supersets (super_set_group) → exos enchaînés, récup uniquement après le dernier
 *  - Séries depuis serie_details si disponible (plus précis que le champ "series")
 *  - Reps en fourchette "8-10" → utilise la valeur haute
 *  - Exercices à durée fixe (is_duration)
 *  - Montées en gamme pour exos polyarticulaires lourds
 *  - Temps d'installation, transition et marge de réalité
 */

export interface Exercise {
  exercice: string;
  recuperation: string;
  reps: string;
  series: string;
  tempo: string;
  super_set_group?: string | null;
  per_side?: boolean;
  is_duration?: boolean;
  is_distance?: boolean;
  charge?: string | number | null;
  serie_details?: SerieDetail[] | string | null;
}

interface SerieDetail {
  reps?: string | number;
  charge?: string | number;
  [key: string]: unknown;
}

// ─── Dictionnaire de temps par rep (secondes) ─────────────────────────────────
const EXERCISE_TIME_PER_REP: Record<string, number> = {
  // Polyarticulaires lourds (3-5 s/rep)
  "back squat": 4, "squat": 4, "front squat": 4,
  "deadlift": 5, "soulevé de terre": 5,
  "hip thrust": 4, "leg press": 3, "presse": 3,
  "romanian deadlift": 4, "rdl": 4,
  // Haut du corps polyarticulaire (2-4 s/rep)
  "bench press": 3, "développé couché": 3, "développé militaire": 3,
  "rowing": 3, "tirage": 3, "tractions": 3, "pull-up": 3,
  "chin-up": 3, "dips": 2, "pompes": 2, "push-up": 2,
  // Isolation (2-3 s/rep)
  "curl": 2, "biceps curl": 2, "hammer curl": 2,
  "triceps": 2, "extension triceps": 2,
  "leg curl": 2, "leg extension": 2, "mollets": 2, "calf raise": 2,
  // Fonctionnels / explosifs
  "kettlebell swing": 2, "swing": 2,
  "fentes": 3, "lunges": 3, "step-up": 3, "step up": 3,
  "bulgare": 3, "bulgarian": 3,
  "burpees": 4,
  "box jump": 3,
  // Gainage / abdos
  "crunch": 2, "planche": 1, "gainage": 1, "relevé de jambes": 2,
  "pallof": 3, "palof": 3, "anti-rotation": 3,
  // Course en salle (tapis/corde)
  "run": 0, "course": 0, "tapis": 0, "corde": 0,
};

const HEAVY_COMPOUND = ["squat", "deadlift", "soulevé", "hip thrust", "presse", "bench", "développé", "rdl", "romanian"];
const COMPOUND      = ["rowing", "tirage", "tractions", "pull", "chin", "dips", "pompes", "push", "fentes", "lunges", "step", "bulgare", "bulgarian"];
const ISOLATION     = ["curl", "extension", "mollet", "calf", "leg curl", "leg extension", "biceps", "triceps", "pallof", "palof", "anti-rotation"];
const ISOMETRIC     = ["planche", "gainage", "pallof", "palof", "anti-rotation", "hollow", "dead bug"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTimePerRep(name: string): number {
  const n = name.toLowerCase();
  for (const [key, val] of Object.entries(EXERCISE_TIME_PER_REP)) {
    if (n.includes(key)) return val;
  }
  if (HEAVY_COMPOUND.some((k) => n.includes(k))) return 4;
  if (COMPOUND.some((k) => n.includes(k))) return 3;
  if (ISOLATION.some((k) => n.includes(k))) return 2;
  return 3;
}

function isIsometric(name: string): boolean {
  return ISOMETRIC.some((k) => name.toLowerCase().includes(k));
}

/**
 * Parse le tempo : "3010", "3-0-1-0", "X010", "1-15-1-1" → secondes par rep
 * Retourne 0 si non parsable (utilisera getTimePerRep à la place).
 */
function parseTempoSeconds(tempo: string): number {
  if (!tempo) return 0;

  // Remplacer les lettres X/x par 0 (explosion), puis séparer par tirets ou espaces
  const cleaned = tempo.replace(/[xX]/gi, "0");

  // Format avec tirets "3-0-1-0" ou "1-15-1-1"
  if (cleaned.includes("-")) {
    const parts = cleaned.split("-").map((p) => parseInt(p.trim(), 10));
    if (parts.length >= 2 && parts.every((p) => !isNaN(p))) {
      return parts.reduce((s, v) => s + v, 0);
    }
    return 0;
  }

  // Format 4 chiffres contigus "3010"
  if (/^\d{4}$/.test(cleaned)) {
    return cleaned.split("").reduce((s, d) => s + parseInt(d, 10), 0);
  }

  return 0;
}

const RUNNING_KEYWORDS = ["run", "course", "sprint", "tapis", "corde à sauter", "rowing machine", "vélo", "bike", "ergomètre"];

/**
 * Détecte si l'exercice est une course/cardio basé sur le nom.
 */
function isRunningExercise(name: string): boolean {
  return RUNNING_KEYWORDS.some((k) => name.toLowerCase().includes(k));
}

/**
 * Parse une distance dans les reps : "2000m", "400m", "1.5km", "5000m"
 * Retourne la distance en mètres, ou null si pas une distance.
 */
function parseDistance(reps: string): number | null {
  // Format "Xkm" ou "X km"
  const kmMatch = reps.match(/(\d+(?:[.,]\d+)?)\s*km/i);
  if (kmMatch) return parseFloat(kmMatch[1].replace(",", ".")) * 1000;

  // Format "Xm" ou "X m" (mais pas "Xmin")
  const mMatch = reps.match(/(\d+)\s*m(?!in)(?!\w)/i);
  if (mMatch) return parseInt(mMatch[1], 10);

  return null;
}

/**
 * Estime la durée en secondes pour une distance de course.
 * Allure par défaut : 5:30/km (330 s/km) — allure de footing modéré.
 * Sprint (<400m) : 3:30/km (210 s/km)
 * Endurance (>3000m) : 6:00/km (360 s/km)
 */
function estimateRunDuration(distanceMeters: number): number {
  const km = distanceMeters / 1000;
  let paceSecPerKm: number;
  if (distanceMeters < 400) {
    paceSecPerKm = 210; // ~3:30/km sprint
  } else if (distanceMeters <= 1000) {
    paceSecPerKm = 270; // ~4:30/km fractionné
  } else if (distanceMeters <= 3000) {
    paceSecPerKm = 330; // ~5:30/km tempo/footing
  } else {
    paceSecPerKm = 360; // ~6:00/km endurance
  }
  return Math.round(km * paceSecPerKm);
}

/**
 * Parse les reps : "10", "8-10", "15 sec", "20sec", "2000m", "1km" → secondes d'effort.
 * Si is_duration → la valeur est directement en secondes.
 * Si per_side → le temps est doublé ici.
 */
function parseRepsDuration(
  reps: string,
  tempo: string,
  exerciseName: string,
  isDuration?: boolean,
  perSide?: boolean,
  isDistance?: boolean,
): number {
  if (!reps) return 0;

  const multiplier = perSide ? 2 : 1;

  // Distance déclarée (case "distance" cochée) : la valeur est en mètres,
  // même sans suffixe. Ex. "400" → 400 m. "1.5km" reste géré aussi.
  if (isDistance) {
    const distExplicit = parseDistance(reps);
    if (distExplicit !== null) return estimateRunDuration(distExplicit);
    const numM = parseFloat(reps.replace(",", "."));
    if (!isNaN(numM) && numM > 0) return estimateRunDuration(numM);
  }

  // Distance explicite dans les reps ("2000m", "400m", "1km", "1.5km")
  const distanceM = parseDistance(reps);
  if (distanceM !== null) return estimateRunDuration(distanceM); // pas de multiplier pour la course

  // Durée directe (is_duration activé)
  if (isDuration) {
    const m = reps.match(/(\d+)/);
    return m ? parseInt(m[1], 10) * multiplier : 0;
  }

  // Si c'est un exercice de course et les reps ne contiennent pas de distance reconnue
  // → traiter comme durée en secondes (ex: "8" reps sur tapis = 8 sec ?)
  // On laisse tomber vers la logique standard ci-dessous.

  // Durée en minutes "5min", "2min30", "1min30s"
  const minMatch = reps.match(/(\d+)\s*min(?:utes?)?\s*(?:(\d+)\s*s(?:ec)?)?/i);
  if (minMatch) {
    const mins = parseInt(minMatch[1], 10);
    const secs = minMatch[2] ? parseInt(minMatch[2], 10) : 0;
    return (mins * 60 + secs) * multiplier;
  }

  // Valeur en secondes explicite "20sec", "20s"
  const secMatch = reps.match(/(\d+)\s*s(?:ec)?(?!\w)/i);
  if (secMatch) return parseInt(secMatch[1], 10) * multiplier;

  // Fourchette "8-10" → on prend la valeur haute (estimation conservatrice)
  const rangeMatch = reps.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (rangeMatch) {
    const hi = parseInt(rangeMatch[2], 10);
    const tempoSec = parseTempoSeconds(tempo);
    const secPerRep = tempoSec > 0 ? tempoSec : getTimePerRep(exerciseName);
    if (isIsometric(exerciseName)) return hi * multiplier;
    return hi * secPerRep * multiplier;
  }

  // Nombre de reps simple
  const numMatch = reps.match(/(\d+)/);
  if (numMatch) {
    const numReps = parseInt(numMatch[1], 10);
    // Exercice de course avec nombre simple : traiter comme durée en secondes
    if (isRunningExercise(exerciseName)) return numReps * multiplier;
    if (isIsometric(exerciseName)) return numReps * multiplier;
    const tempoSec = parseTempoSeconds(tempo);
    const secPerRep = tempoSec > 0 ? tempoSec : getTimePerRep(exerciseName);
    return numReps * secPerRep * multiplier;
  }

  return 0;
}

/**
 * Parse le temps de récupération avec latence humaine (15 s).
 */
function parseRecuperationSeconds(recuperation: string): number {
  if (!recuperation) return 75; // ~1 min + latence
  const low = recuperation.toLowerCase();
  if (low.includes("emom")) return 0;
  // Récup explicitement nulle
  if (/aucun|pas de|sans|^0$|^non$/.test(low.trim())) return 0;

  let total = 0;
  const minMatch = recuperation.match(/(\d+)\s*min/i);
  if (minMatch) total += parseInt(minMatch[1], 10) * 60;
  const secMatch = recuperation.match(/(\d+)\s*s(?:ec)?(?!\w)/i);
  if (secMatch) total += parseInt(secMatch[1], 10);

  if (total === 0) total = 60;
  return total + 8; // petite latence humaine (installation série suivante)
}

/**
 * Retourne le nombre de séries réel : preferring serie_details.length,
 * fallback sur le champ "series".
 */
function getSeriesCount(ex: Exercise): number {
  // serie_details peut être un tableau ou une chaîne JSON
  let details: unknown[] | null = null;
  if (Array.isArray(ex.serie_details)) {
    details = ex.serie_details;
  } else if (typeof ex.serie_details === "string") {
    try {
      const parsed = JSON.parse(ex.serie_details);
      if (Array.isArray(parsed)) details = parsed;
    } catch { /* ignore */ }
  }
  if (details && details.length > 0) return details.length;

  const m = ex.series?.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * Montées en gamme pour exos polyarticulaires (premier exo du bloc seulement).
 */
function estimateWarmupSets(numSeries: number, exerciseName: string): number {
  const n = exerciseName.toLowerCase();
  if (HEAVY_COMPOUND.some((k) => n.includes(k))) return Math.min(4, Math.max(2, Math.floor(numSeries / 2) + 1));
  if (COMPOUND.some((k) => n.includes(k))) return Math.min(2, Math.max(1, Math.floor(numSeries / 3)));
  return 0;
}

// ─── Durée d'un exercice isolé ─────────────────────────────────────────────────

function calcExerciseDuration(ex: Exercise, isFirst: boolean): number {
  const numSeries = getSeriesCount(ex);
  if (numSeries === 0) return 0;

  const repsDur = parseRepsDuration(ex.reps, ex.tempo, ex.exercice, ex.is_duration, ex.per_side, ex.is_distance);
  const recup = parseRecuperationSeconds(ex.recuperation);

  // Séries de travail : (reps × séries) + récup × (séries - 1)
  const workDur = repsDur * numSeries + recup * Math.max(0, numSeries - 1);

  // Montées en gamme (premier exo du bloc) — uniquement pour la muscu à charge,
  // pas pour les exercices à durée fixe (tapis, vélo, gainage chronométré…).
  const isDurationLike = ex.is_duration || isRunningExercise(ex.exercice);
  let warmup = 0;
  if (isFirst && !isDurationLike) {
    const warmupSets = estimateWarmupSets(numSeries, ex.exercice);
    if (warmupSets > 0) {
      const warmupRepsDur = Math.round(repsDur * 0.6);
      warmup = (warmupRepsDur + 35) * warmupSets;
    }
  }

  // Temps d'installation / passage à l'exercice (déplacement + réglage charges).
  const install = isDurationLike ? (isFirst ? 40 : 25) : (isFirst ? 60 : 45);

  return workDur + warmup + install;
}

// ─── Durée d'un superset ──────────────────────────────────────────────────────

function calcSupersetDuration(exos: Exercise[], isFirst: boolean): number {
  if (exos.length === 0) return 0;

  // Nombre de séries : celui du premier exo (série commune)
  const numSeries = getSeriesCount(exos[0]);
  if (numSeries === 0) return 0;

  // Durée d'un round : somme des efforts + micro-transitions (8 s entre exos)
  let roundDur = 0;
  exos.forEach((ex, i) => {
    roundDur += parseRepsDuration(ex.reps, ex.tempo, ex.exercice, ex.is_duration, ex.per_side, ex.is_distance);
    if (i < exos.length - 1) roundDur += 8; // transition entre exos dans le superset
  });

  // Récup après le round complet (récup du dernier exo du superset)
  const lastEx = exos[exos.length - 1];
  const recup = parseRecuperationSeconds(lastEx.recuperation);

  const workDur = roundDur * numSeries + recup * Math.max(0, numSeries - 1);

  // Légère chauffe pour le superset si premier bloc — pas pour un bloc 100 % durée.
  const allDurationLike = exos.every((e) => e.is_duration || isRunningExercise(e.exercice));
  let warmup = 0;
  if (isFirst && !allDurationLike) {
    const warmupRounds = Math.min(2, Math.floor(numSeries / 3) + 1);
    warmup = (roundDur * 0.5 + 30) * warmupRounds;
  }

  // Installation : chaque poste du superset
  const install = exos.reduce((s, e) => s + ((e.is_duration || isRunningExercise(e.exercice)) ? 25 : 45), 0);

  return workDur + warmup + install;
}

// ─── Calcul principal ─────────────────────────────────────────────────────────

export function calculateSessionDuration(exercises: Exercise[]): number {
  if (!exercises || exercises.length === 0) return 0;

  let totalSeconds = 0;
  const processed = new Set<number>();
  let blockCount = 0;
  let isFirst = true;

  for (let i = 0; i < exercises.length; i++) {
    if (processed.has(i)) continue;

    const ex = exercises[i];

    if (ex.super_set_group) {
      // Collecter tous les exos du même superset (contigus)
      const group: Exercise[] = [];
      for (let j = i; j < exercises.length; j++) {
        if (exercises[j].super_set_group === ex.super_set_group) {
          group.push(exercises[j]);
          processed.add(j);
        }
      }
      totalSeconds += calcSupersetDuration(group, isFirst);
    } else {
      totalSeconds += calcExerciseDuration(ex, isFirst);
      processed.add(i);
    }

    blockCount++;
    isFirst = false;
  }

  // Le passage entre exercices est déjà compté dans "install" (pas de transition
  // supplémentaire ici, sinon on double le temps de déplacement).

  // Séance 100 % durée fixe (tapis/vélo/rameur/gainage chronométré) : la durée est
  // déjà exacte → chauffe générale réduite et marge de réalité moindre.
  const allDurationLike = exercises.every((e) => e.is_duration || isRunningExercise(e.exercice));

  // Échauffement général proportionnel à la taille de la séance : ~3 min + 0,5 min/bloc,
  // borné entre 4 et 8 min (une petite séance n'a pas 10 min de chauffe).
  const generalWarmup = allDurationLike
    ? 120 // 2 min
    : Math.round(Math.min(8, Math.max(4, 3 + blockCount * 0.5))) * 60;
  totalSeconds += generalWarmup;

  // Marge de réalité : +7% (muscu) / +3% (durée fixe)
  return Math.round(totalSeconds * (allDurationLike ? 1.03 : 1.07));
}

// ─── Formatage ────────────────────────────────────────────────────────────────

export function formatSessionDuration(seconds: number): string {
  if (seconds === 0) return "0min";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m}min`;
}

export function formatSessionDurationRange(seconds: number): string {
  if (seconds === 0) return "0min";
  const lo = Math.round((seconds * 0.92) / 60);
  const hi = Math.round((seconds * 1.08) / 60);
  const fmt = (min: number) => {
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h}h` : `${h}h${m}`;
  };
  return `${fmt(lo)}-${fmt(hi)}`;
}
