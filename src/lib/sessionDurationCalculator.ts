/**
 * Calcule la durée totale estimée d'une séance de renforcement
 * Basé sur des conditions réelles de salle de sport commerciale
 * pour un pratiquant intermédiaire sans chronométrage strict
 */

interface Exercise {
  exercice: string;
  recuperation: string;
  reps: string;
  series: string;
  tempo: string;
  session_type?: "renfo" | "cardio";
  super_set_group?: string | null;
  is_duration?: boolean;
}

// Temps moyens par répétition selon le type d'exercice (en secondes)
const EXERCISE_TIME_PER_REP: Record<string, number> = {
  // Exercices polyarticulaires lourds (3-5 sec/rep)
  squat: 4,
  "back squat": 4,
  "front squat": 4,
  deadlift: 5,
  "soulevé de terre": 5,
  "hip thrust": 4,
  "leg press": 3,
  presse: 3,
  
  // Exercices polyarticulaires haut du corps (2-4 sec/rep)
  "bench press": 3,
  "développé couché": 3,
  "développé militaire": 3,
  "rowing": 3,
  "tirage": 3,
  "tractions": 3,
  "pull-up": 3,
  "chin-up": 3,
  dips: 2,
  pompes: 2,
  "push-ups": 2,
  
  // Exercices d'isolation (2-3 sec/rep)
  curl: 2,
  "biceps curl": 2,
  "hammer curl": 2,
  triceps: 2,
  "extension triceps": 2,
  "leg curl": 2,
  "leg extension": 2,
  "mollets": 2,
  "calf raise": 2,
  
  // Exercices fonctionnels/explosifs (2-3 sec/rep)
  "kettlebell swing": 2,
  swing: 2,
  fentes: 3,
  lunges: 3,
  "step-up": 3,
  burpees: 4,
  
  // Exercices abdominaux (2-3 sec/rep)
  crunch: 2,
  planche: 2, // statique, sera géré différemment
  gainage: 2,
  "relevé de jambes": 2,
};

// Catégories d'exercices pour estimation par défaut
const HEAVY_COMPOUND_KEYWORDS = ["squat", "deadlift", "soulevé", "hip thrust", "presse", "bench", "développé"];
const COMPOUND_KEYWORDS = ["rowing", "tirage", "tractions", "pull", "chin", "dips", "pompes", "push"];
const ISOLATION_KEYWORDS = ["curl", "extension", "mollet", "calf", "leg curl", "leg extension", "biceps", "triceps"];

/**
 * Estime le temps par répétition selon le type d'exercice
 */
function getTimePerRep(exerciseName: string): number {
  const name = exerciseName.toLowerCase();
  
  // Chercher dans le dictionnaire
  for (const [key, value] of Object.entries(EXERCISE_TIME_PER_REP)) {
    if (name.includes(key.toLowerCase())) {
      return value;
    }
  }
  
  // Estimation par catégorie de mots-clés
  if (HEAVY_COMPOUND_KEYWORDS.some(kw => name.includes(kw.toLowerCase()))) {
    return 4; // Exercices lourds polyarticulaires
  }
  if (COMPOUND_KEYWORDS.some(kw => name.includes(kw.toLowerCase()))) {
    return 3; // Exercices polyarticulaires
  }
  if (ISOLATION_KEYWORDS.some(kw => name.includes(kw.toLowerCase()))) {
    return 2; // Exercices d'isolation
  }
  
  // Défaut pour exercice inconnu
  return 3;
}

/**
 * Parse le tempo (ex: "3030" -> 6 secondes par rep, "3131" -> 8 secondes par rep)
 */
function parseTempoSeconds(tempo: string): number {
  if (!tempo || tempo.length !== 4) return 0;
  
  const digits = tempo.split('').map(d => parseInt(d));
  if (digits.some(isNaN)) return 0;
  
  // Somme des 4 phases du tempo
  return digits.reduce((sum, digit) => sum + digit, 0);
}

/**
 * Parse les répétitions et retourne la durée d'effort par série
 */
function parseRepsDuration(reps: string, tempo: string, exerciseName: string, isDuration?: boolean): number {
  if (!reps) return 0;
  
  // Si c'est une durée (mode is_duration)
  if (isDuration) {
    const durationMatch = reps.match(/(\d+)/);
    if (durationMatch) {
      return parseInt(durationMatch[1]);
    }
  }
  
  // Si les reps se terminent par "sec" (ex: "20sec")
  const secMatch = reps.match(/(\d+)\s*sec/i);
  if (secMatch) {
    return parseInt(secMatch[1]);
  }
  
  // Si c'est un nombre de répétitions
  const repsMatch = reps.match(/(\d+)/);
  if (repsMatch) {
    const numReps = parseInt(repsMatch[1]);
    
    // Si tempo existe, utiliser la durée du tempo
    const tempoSeconds = parseTempoSeconds(tempo);
    if (tempoSeconds > 0) {
      return numReps * tempoSeconds;
    }
    
    // Sinon, utiliser le temps par rep selon le type d'exercice
    const timePerRep = getTimePerRep(exerciseName);
    return numReps * timePerRep;
  }
  
  return 0;
}

/**
 * Parse le temps de récupération avec latence humaine réelle
 * En conditions réelles, ajouter 10-20 secondes de latence
 */
function parseRecuperationSeconds(recuperation: string): number {
  if (!recuperation) return 60; // Défaut 1 minute si non spécifié
  
  // EMOM = pas de récupération fixe, géré différemment
  if (recuperation.toLowerCase().includes("emom")) {
    return 0;
  }
  
  let totalSeconds = 0;
  
  // Chercher les minutes
  const minMatch = recuperation.match(/(\d+)\s*min/i);
  if (minMatch) {
    totalSeconds += parseInt(minMatch[1]) * 60;
  }
  
  // Chercher les secondes
  const secMatch = recuperation.match(/(\d+)\s*s(?:ec)?(?!\w)/i);
  if (secMatch) {
    totalSeconds += parseInt(secMatch[1]);
  }
  
  // Si aucune valeur trouvée, défaut 60 secondes
  if (totalSeconds === 0) {
    totalSeconds = 60;
  }
  
  // Ajouter latence humaine réelle (15 secondes en moyenne)
  // Comprend: regarder téléphone, ajuster équipement, boire, etc.
  const humanLatency = 15;
  
  return totalSeconds + humanLatency;
}

/**
 * Estime le nombre de séries de montée en gamme (échauffement spécifique)
 * basé sur le nombre de séries de travail
 */
function estimateWarmupSets(numWorkingSets: number, exerciseName: string): number {
  const name = exerciseName.toLowerCase();
  
  // Les exercices polyarticulaires lourds nécessitent plus de montées en gamme
  if (HEAVY_COMPOUND_KEYWORDS.some(kw => name.includes(kw.toLowerCase()))) {
    // 2-4 séries de montée en gamme pour les gros mouvements
    return Math.min(4, Math.max(2, Math.floor(numWorkingSets / 2) + 1));
  }
  
  // Les exercices polyarticulaires moyens
  if (COMPOUND_KEYWORDS.some(kw => name.includes(kw.toLowerCase()))) {
    return Math.min(2, Math.max(1, Math.floor(numWorkingSets / 3)));
  }
  
  // Pas de montée en gamme pour l'isolation
  return 0;
}

/**
 * Calcule la durée d'un exercice individuel avec montées en gamme
 */
function calculateExerciseDuration(exercise: Exercise, isFirstExercise: boolean): number {
  const seriesMatch = exercise.series?.match(/(\d+)/);
  if (!seriesMatch) return 0;
  
  const numSeries = parseInt(seriesMatch[1]);
  const exerciseName = exercise.exercice || "";
  
  // Durée d'une répétition complète
  const repsDuration = parseRepsDuration(exercise.reps, exercise.tempo, exerciseName, exercise.is_duration);
  
  // Temps de récupération entre séries (avec latence humaine)
  const recuperationTime = parseRecuperationSeconds(exercise.recuperation);
  
  // === SÉRIES DE TRAVAIL ===
  // Durée d'une série = durée des reps + temps de récupération
  // (sauf dernière série qui n'a pas de récup après)
  const workingSetsDuration = (repsDuration * numSeries) + (recuperationTime * (numSeries - 1));
  
  // === MONTÉES EN GAMME (échauffement spécifique) ===
  // Seulement pour le premier exercice d'un groupe musculaire
  let warmupSetsDuration = 0;
  if (isFirstExercise) {
    const warmupSets = estimateWarmupSets(numSeries, exerciseName);
    if (warmupSets > 0) {
      // Montées en gamme: moins de reps (60% des reps de travail), récup plus courte (30-45 sec)
      const warmupRepsDuration = Math.round(repsDuration * 0.6);
      const warmupRecuperation = 35; // 30-40 secondes entre séries de chauffe
      warmupSetsDuration = (warmupRepsDuration + warmupRecuperation) * warmupSets;
    }
  }
  
  // === TEMPS D'INSTALLATION ===
  // Inclut: déplacement vers la machine, ajustement des charges, réglages
  const installationTime = isFirstExercise ? 90 : 60; // Plus long pour le premier exercice
  
  const totalDuration = workingSetsDuration + warmupSetsDuration + installationTime;
  
  return totalDuration;
}

/**
 * Calcule la durée d'un superset (plusieurs exercices enchaînés)
 */
function calculateSupersetDuration(supersetExercises: Exercise[], isFirstBlock: boolean): number {
  if (supersetExercises.length === 0) return 0;
  
  const seriesMatch = supersetExercises[0].series?.match(/(\d+)/);
  if (!seriesMatch) return 0;
  
  const numSeries = parseInt(seriesMatch[1]);
  
  // Durée d'un round du superset = somme des durées de reps + mini transitions
  let singleRoundDuration = 0;
  supersetExercises.forEach((exercise, index) => {
    const exerciseName = exercise.exercice || "";
    const repsDuration = parseRepsDuration(exercise.reps, exercise.tempo, exerciseName, exercise.is_duration);
    singleRoundDuration += repsDuration;
    
    // Mini transition entre exercices du superset (5-10 sec)
    if (index < supersetExercises.length - 1) {
      singleRoundDuration += 8;
    }
  });
  
  // Temps de récupération après le round complet (on prend la récup du dernier exercice)
  const lastExercise = supersetExercises[supersetExercises.length - 1];
  const recuperationTime = parseRecuperationSeconds(lastExercise.recuperation);
  
  // Durée totale: (durée d'un round × séries) + (récup × (séries-1))
  const workingDuration = (singleRoundDuration * numSeries) + (recuperationTime * (numSeries - 1));
  
  // Montées en gamme pour superset (réduites car plusieurs exercices)
  let warmupDuration = 0;
  if (isFirstBlock) {
    // 1-2 rounds de chauffe pour le superset
    const warmupRounds = Math.min(2, Math.floor(numSeries / 3) + 1);
    warmupDuration = (singleRoundDuration * 0.5 + 30) * warmupRounds;
  }
  
  // Temps d'installation pour tous les postes du superset
  const installationTime = 45 * supersetExercises.length;
  
  return workingDuration + warmupDuration + installationTime;
}

/**
 * Calcule la durée totale d'une séance avec tous les facteurs réalistes
 */
export function calculateSessionDuration(exercises: Exercise[]): number {
  if (!exercises || exercises.length === 0) return 0;
  
  let totalSeconds = 0;
  const processedIndices = new Set<number>();
  let blockCount = 0;
  let isFirstBlock = true;
  
  // === ÉCHAUFFEMENT GÉNÉRAL ===
  // 8-12 minutes en conditions réelles (cardio léger, mobilité)
  const generalWarmup = 10 * 60; // 10 minutes
  totalSeconds += generalWarmup;
  
  // Parcourir tous les exercices
  for (let i = 0; i < exercises.length; i++) {
    if (processedIndices.has(i)) continue;
    
    const exercise = exercises[i];
    
    if (exercise.super_set_group) {
      // Trouver tous les exercices du même superset
      const supersetExercises: Exercise[] = [];
      for (let j = i; j < exercises.length; j++) {
        if (exercises[j].super_set_group === exercise.super_set_group) {
          supersetExercises.push(exercises[j]);
          processedIndices.add(j);
        } else if (supersetExercises.length > 0) {
          break;
        }
      }
      
      totalSeconds += calculateSupersetDuration(supersetExercises, isFirstBlock);
      blockCount++;
      isFirstBlock = false;
    } else {
      totalSeconds += calculateExerciseDuration(exercise, isFirstBlock);
      processedIndices.add(i);
      blockCount++;
      isFirstBlock = false;
    }
  }
  
  // === TEMPS DE TRANSITION ENTRE BLOCS ===
  // Déplacement, chargement, ajustements, discussions occasionnelles
  // 60-90 secondes par transition en conditions réelles
  if (blockCount > 1) {
    const transitionTime = 75; // 75 secondes par transition
    totalSeconds += (blockCount - 1) * transitionTime;
  }
  
  // === MARGE DE RÉALITÉ ===
  // 7% pour imprévus: discussions, attente équipement, fatigue, etc.
  const realityMargin = 1.07;
  totalSeconds = Math.round(totalSeconds * realityMargin);
  
  return totalSeconds;
}

/**
 * Formate la durée en minutes lisibles
 */
export function formatSessionDuration(seconds: number): string {
  if (seconds === 0) return "0min";
  
  const minutes = Math.round(seconds / 60);
  
  if (minutes < 60) {
    return `${minutes}min`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h${remainingMinutes}min`;
}

/**
 * Retourne une estimation avec fourchette (min-max)
 */
export function formatSessionDurationRange(seconds: number): string {
  if (seconds === 0) return "0min";
  
  const minMinutes = Math.round((seconds * 0.95) / 60);
  const maxMinutes = Math.round((seconds * 1.05) / 60);
  
  if (maxMinutes < 60) {
    return `${minMinutes}-${maxMinutes}min`;
  }
  
  const minHours = Math.floor(minMinutes / 60);
  const minRemainder = minMinutes % 60;
  const maxHours = Math.floor(maxMinutes / 60);
  const maxRemainder = maxMinutes % 60;
  
  const formatTime = (h: number, m: number) => {
    if (m === 0) return `${h}h`;
    return `${h}h${m}`;
  };
  
  return `${formatTime(minHours, minRemainder)}-${formatTime(maxHours, maxRemainder)}`;
}
