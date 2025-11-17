import { CardioData, CardioStep, CardioBlock } from "@/components/CardioStepBuilder";

/**
 * Formate la durée en secondes
 * < 60 sec : affiche "Xsec"
 * >= 60 sec : affiche "Xmin" ou "XminYsec"
 */
export const formatCardioTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}sec`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}min`;
  }
  return `${minutes}min${remainingSeconds}sec`;
};

/**
 * Formate la distance
 * < 1000m : affiche "Xm"
 * >= 1000m : affiche "Xkm" ou "X.Ykm"
 */
export const formatCardioDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${meters}m`;
  }
  const km = meters / 1000;
  return km % 1 === 0 ? `${km}km` : `${km.toFixed(1)}km`;
};

/**
 * Calcule l'allure en min/km à partir du % VMA
 */
export const calculatePace = (vmaPercentage: number, athleteVma: number | null): string | null => {
  if (!athleteVma || vmaPercentage === 0) return null;
  const speed = athleteVma * (vmaPercentage / 100); // km/h
  const paceMinPerKm = 60 / speed; // min/km
  const minutes = Math.floor(paceMinPerKm);
  const seconds = Math.round((paceMinPerKm - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
};

/**
 * Calcule la durée totale estimée d'une séance cardio en secondes
 */
export const calculateCardioSessionDuration = (cardioData: CardioData, athleteVma: number | null): number => {
  let totalSeconds = 0;
  const steps = cardioData.steps || [];
  const blocks = cardioData.blocks || [];

  // Calculer la durée des blocs
  blocks.forEach((block: CardioBlock) => {
    const blockSteps = steps.filter((s: CardioStep) => s.block_id === block.id);
    let blockDuration = 0;
    
    blockSteps.forEach((step: CardioStep) => {
      if (step.effort_type === 'duration') {
        blockDuration += step.duration || 0;
      } else if (step.effort_type === 'distance' && athleteVma && step.vma_percentage) {
        // Calculer le temps basé sur la distance et l'allure
        const distanceKm = (step.distance || 0) / 1000;
        const speed = athleteVma * (step.vma_percentage / 100); // km/h
        const durationHours = distanceKm / speed;
        blockDuration += durationHours * 3600; // Convertir en secondes
      }
    });
    
    totalSeconds += blockDuration * block.repetitions;
  });

  // Calculer la durée des étapes individuelles
  steps.filter((s: CardioStep) => !s.block_id).forEach((step: CardioStep) => {
    if (step.effort_type === 'duration') {
      totalSeconds += step.duration || 0;
    } else if (step.effort_type === 'distance' && athleteVma && step.vma_percentage) {
      // Calculer le temps basé sur la distance et l'allure
      const distanceKm = (step.distance || 0) / 1000;
      const speed = athleteVma * (step.vma_percentage / 100); // km/h
      const durationHours = distanceKm / speed;
      totalSeconds += durationHours * 3600; // Convertir en secondes
    }
  });

  return Math.round(totalSeconds);
};

/**
 * Formate la durée totale de la séance en format lisible
 */
export const formatCardioSessionDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h${minutes}min`;
    }
    return `${hours}h`;
  }
  
  if (minutes > 0) {
    if (secs > 0) {
      return `${minutes}min${secs}sec`;
    }
    return `${minutes}min`;
  }
  
  return `${secs}sec`;
};
