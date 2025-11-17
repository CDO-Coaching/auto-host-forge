/**
 * Calculs d'allures et de durées pour les séances de course basées sur la VMA
 */

export interface RunningStep {
  id: string;
  type: "warmup" | "interval" | "recovery" | "cooldown" | "repeat";
  vma_percentage: number;
  stop_rule_type: "duration" | "distance";
  stop_rule_value: number; // en minutes pour durée, en mètres pour distance
  repetitions?: number;
  recovery_duration?: number; // en secondes
  recovery_distance?: number; // en mètres
}

/**
 * Calcule l'allure en min/km basée sur la VMA et le pourcentage
 * Formule: Allure = 60 / (VMA × (%/100))
 */
export function calculatePace(vma: number, percentage: number): number {
  if (!vma || vma <= 0 || !percentage || percentage <= 0) return 0;
  
  const speed = vma * (percentage / 100);
  const paceMinPerKm = 60 / speed;
  
  return paceMinPerKm;
}

/**
 * Calcule la vitesse en km/h
 * Formule: Vitesse = VMA × (%/100)
 */
export function calculateSpeed(vma: number, percentage: number): number {
  if (!vma || vma <= 0 || !percentage || percentage <= 0) return 0;
  
  return vma * (percentage / 100);
}

/**
 * Calcule la durée d'une étape en secondes
 */
export function calculateStepDuration(
  step: RunningStep,
  vma: number
): number {
  if (!vma || vma <= 0) return 0;
  
  const speed = calculateSpeed(vma, step.vma_percentage);
  
  if (step.stop_rule_type === "duration") {
    // Durée directe en minutes → convertir en secondes
    return step.stop_rule_value * 60;
  } else {
    // Distance en mètres → calculer la durée
    // durée (en heures) = distance (km) / vitesse (km/h)
    const distanceKm = step.stop_rule_value / 1000;
    const durationHours = distanceKm / speed;
    const durationSeconds = durationHours * 3600;
    
    return durationSeconds;
  }
}

/**
 * Calcule la durée totale d'une étape avec répétitions
 */
export function calculateTotalStepDuration(
  step: RunningStep,
  vma: number
): number {
  const singleStepDuration = calculateStepDuration(step, vma);
  
  if (step.type === "repeat" && step.repetitions && step.repetitions > 1) {
    // Durée totale = (durée effort × nb répétitions) + (récup × (nb répétitions - 1))
    const effortDuration = singleStepDuration * step.repetitions;
    
    let recoveryDuration = 0;
    if (step.recovery_duration) {
      recoveryDuration = step.recovery_duration;
    } else if (step.recovery_distance && vma > 0) {
      // Calculer durée de récup basée sur distance (à allure de récup ~60% VMA)
      const recoverySpeed = calculateSpeed(vma, 60);
      const recoveryDistanceKm = step.recovery_distance / 1000;
      recoveryDuration = (recoveryDistanceKm / recoverySpeed) * 3600;
    }
    
    const totalRecoveryDuration = recoveryDuration * (step.repetitions - 1);
    
    return effortDuration + totalRecoveryDuration;
  }
  
  return singleStepDuration;
}

/**
 * Calcule la durée totale d'une séance de course en secondes
 */
export function calculateRunningSessionDuration(
  steps: RunningStep[],
  vma: number
): number {
  if (!steps || steps.length === 0 || !vma || vma <= 0) return 0;
  
  let totalSeconds = 0;
  
  steps.forEach(step => {
    totalSeconds += calculateTotalStepDuration(step, vma);
  });
  
  return totalSeconds;
}

/**
 * Formate l'allure en format min:sec/km
 */
export function formatPace(paceMinPerKm: number): string {
  if (!paceMinPerKm || paceMinPerKm <= 0) return "0:00/km";
  
  const minutes = Math.floor(paceMinPerKm);
  const seconds = Math.round((paceMinPerKm - minutes) * 60);
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
}

/**
 * Formate la vitesse avec 1 décimale
 */
export function formatSpeed(speed: number): string {
  if (!speed || speed <= 0) return "0.0 km/h";
  
  return `${speed.toFixed(1)} km/h`;
}

/**
 * Formate la durée en format lisible (mm:ss ou hh:mm:ss)
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formate la distance en format lisible (m ou km)
 */
export function formatDistance(meters: number): string {
  if (!meters || meters <= 0) return "0 m";
  
  if (meters < 1000) {
    return `${meters} m`;
  }
  
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}
