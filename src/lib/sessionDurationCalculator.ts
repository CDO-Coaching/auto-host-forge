/**
 * Calcule la durée totale estimée d'une séance de renforcement
 * en fonction des exercices ajoutés
 */

interface Exercise {
  exercice: string;
  recuperation: string;
  reps: string;
  series: string;
  tempo: string;
  session_type?: "renfo" | "cardio";
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
function parseRepsDuration(reps: string, tempo: string): number {
  if (!reps) return 0;
  
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
    
    // Sinon, estimation de 2 secondes par rep
    return numReps * 2;
  }
  
  return 0;
}

/**
 * Parse le temps de récupération (ex: "1min 30s", "45sec", "1min")
 */
function parseRecuperationSeconds(recuperation: string): number {
  if (!recuperation) return 0;
  
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
  
  return totalSeconds;
}

/**
 * Calcule la durée d'un exercice individuel
 */
function calculateExerciseDuration(exercise: Exercise): number {
  // Si pas de séries, pas de durée
  const seriesMatch = exercise.series?.match(/(\d+)/);
  if (!seriesMatch) return 0;
  
  const numSeries = parseInt(seriesMatch[1]);
  
  // Durée d'une répétition complète
  const repsDuration = parseRepsDuration(exercise.reps, exercise.tempo);
  
  // Temps de récupération entre séries
  const recuperationTime = parseRecuperationSeconds(exercise.recuperation);
  
  // Durée d'une série = durée des reps + temps de récupération
  const singleSetDuration = repsDuration + recuperationTime;
  
  // Durée totale de l'exercice
  // (durée d'une série × nombre de séries)
  // + 60 secondes de temps d'installation/chauffe par exercice
  const exerciseDuration = (singleSetDuration * numSeries) + 60;
  
  return exerciseDuration;
}

/**
 * Calcule la durée totale d'une séance
 */
export function calculateSessionDuration(exercises: Exercise[]): number {
  if (!exercises || exercises.length === 0) return 0;
  
  // Calculer la durée de chaque exercice
  let totalSeconds = 0;
  
  exercises.forEach(exercise => {
    totalSeconds += calculateExerciseDuration(exercise);
  });
  
  // Ajouter un temps de transition entre exercices (45 secondes par exercice)
  if (exercises.length > 1) {
    totalSeconds += (exercises.length - 1) * 45;
  }
  
  // Ajouter une marge de sécurité de +15%
  totalSeconds = Math.round(totalSeconds * 1.15);
  
  return totalSeconds;
}

/**
 * Formate la durée en minutes
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
