import { CardioData, CardioStep, CardioBlock } from "@/components/CardioStepBuilder";

// Constante globale pour la vitesse de marche (6 km/h = 10:00/km)
export const WALKING_SPEED_KMH = 6;
export const WALKING_PACE = "10:00/km";

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
 * Calcule l'allure en min/km à partir du % VMA ou retourne l'allure de marche
 */
export const calculatePace = (vmaPercentage: number | undefined, athleteVma: number | null, isWalking?: boolean): string | null => {
  if (isWalking) {
    return WALKING_PACE;
  }
  if (!athleteVma || !vmaPercentage || vmaPercentage === 0) return null;
  const speed = athleteVma * (vmaPercentage / 100); // km/h
  const paceMinPerKm = 60 / speed; // min/km
  const minutes = Math.floor(paceMinPerKm);
  const seconds = Math.round((paceMinPerKm - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
};

/**
 * Obtient la vitesse en km/h pour un step (marche ou course)
 */
export const getStepSpeed = (step: CardioStep, athleteVma: number | null): number => {
  if (step.movement_type === 'marche') {
    return WALKING_SPEED_KMH;
  }
  if (athleteVma && step.vma_percentage) {
    return athleteVma * (step.vma_percentage / 100);
  }
  return 0;
};

/**
 * Calcule la durée totale estimée d'une séance cardio en secondes
 */
export const calculateCardioSessionDuration = (cardioData: CardioData, athleteVma: number | null): number => {
  let totalSeconds = 0;
  const steps = cardioData.steps || [];
  const blocks = cardioData.blocks || [];

  const calculateStepDuration = (step: CardioStep): number => {
    if (step.effort_type === 'duration') {
      return step.duration || 0;
    } else if (step.effort_type === 'distance') {
      const speed = getStepSpeed(step, athleteVma);
      if (speed > 0) {
        const distanceKm = (step.distance || 0) / 1000;
        return (distanceKm / speed) * 3600; // Convertir en secondes
      }
    }
    return 0;
  };

  // Calculer la durée des blocs
  blocks.forEach((block: CardioBlock) => {
    const blockSteps = steps.filter((s: CardioStep) => s.block_id === block.id);
    let blockDuration = 0;
    
    blockSteps.forEach((step: CardioStep) => {
      blockDuration += calculateStepDuration(step);
    });
    
    totalSeconds += blockDuration * block.repetitions;
  });

  // Calculer la durée des étapes individuelles
  steps.filter((s: CardioStep) => !s.block_id).forEach((step: CardioStep) => {
    totalSeconds += calculateStepDuration(step);
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
  if (secs > 0) {
    return `${minutes}min${secs}sec`;
  }
  return `${minutes}min`;
};

/**
 * Interface pour les métriques cardio calculées
 */
export interface CardioMetrics {
  totalDistanceKm: number;
  totalDurationMinutes: number;
  averageIntensity: number;
}

/**
 * Calcule les métriques complètes d'une séance cardio
 * Prend en compte la marche à 6 km/h (10:00/km) et la course basée sur VMA
 */
export const calculateCardioMetrics = (cardioData: CardioData, athleteVma: number | null): CardioMetrics => {
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;
  let totalIntensityWeighted = 0; // Somme (intensité * durée) pour moyenne pondérée
  let totalRunningDuration = 0; // Durée de course uniquement pour la moyenne d'intensité
  
  const steps = cardioData.steps || [];
  const blocks = cardioData.blocks || [];

  // Fonction helper pour calculer les métriques d'un step
  const calculateStepMetrics = (step: CardioStep) => {
    const isWalking = step.movement_type === 'marche';
    const speed = getStepSpeed(step, athleteVma);
    let stepDuration = 0;
    let stepDistance = 0;
    
    if (step.effort_type === 'duration') {
      // Durée fixe
      stepDuration = step.duration || 0;
      // Calculer la distance basée sur la vitesse
      if (speed > 0) {
        stepDistance = (speed * (stepDuration / 3600)) * 1000; // en mètres
      }
    } else if (step.effort_type === 'distance') {
      // Distance fixe
      stepDistance = step.distance || 0;
      // Calculer la durée basée sur la vitesse
      if (speed > 0) {
        stepDuration = (stepDistance / 1000 / speed) * 3600; // en secondes
      }
    }
    
    // Ajouter à l'intensité pondérée (seulement pour la course)
    if (!isWalking && step.vma_percentage) {
      totalIntensityWeighted += step.vma_percentage * stepDuration;
      totalRunningDuration += stepDuration;
    }
    
    return { stepDuration, stepDistance };
  };

  // Calculer les métriques des blocs
  blocks.forEach((block: CardioBlock) => {
    const blockSteps = steps.filter((s: CardioStep) => s.block_id === block.id);
    let blockDuration = 0;
    let blockDistance = 0;
    
    blockSteps.forEach((step: CardioStep) => {
      const { stepDuration, stepDistance } = calculateStepMetrics(step);
      blockDuration += stepDuration;
      blockDistance += stepDistance;
    });
    
    // Multiplier par le nombre de répétitions
    totalDurationSeconds += blockDuration * block.repetitions;
    totalDistanceMeters += blockDistance * block.repetitions;
  });

  // Calculer les métriques des étapes individuelles (sans bloc)
  steps.filter((s: CardioStep) => !s.block_id).forEach((step: CardioStep) => {
    const { stepDuration, stepDistance } = calculateStepMetrics(step);
    totalDurationSeconds += stepDuration;
    totalDistanceMeters += stepDistance;
  });

  // Calculer l'intensité moyenne pondérée par la durée (seulement pour les steps de course)
  const averageIntensity = totalRunningDuration > 0 
    ? Math.round(totalIntensityWeighted / totalRunningDuration) 
    : 0;

  return {
    totalDistanceKm: Number((totalDistanceMeters / 1000).toFixed(2)),
    totalDurationMinutes: Number((totalDurationSeconds / 60).toFixed(2)),
    averageIntensity
  };
};
