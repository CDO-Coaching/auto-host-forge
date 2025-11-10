/**
 * Calcule le 1RM théorique basé sur la charge, les reps et le RPE
 * Utilise la formule de Brzycki ajustée par le RIR (Reps In Reserve)
 */
export function calculate1RM(weight: number, reps: number, rpe: number): number {
  // Ajuster les reps selon le RPE (RIR = Reps In Reserve)
  const rir = 10 - rpe;
  const adjustedReps = reps + rir;
  
  // Formule de Brzycki: 1RM = weight × (36 / (37 - reps))
  // On limite à 30 reps pour éviter des résultats aberrants
  const effectiveReps = Math.min(adjustedReps, 30);
  const oneRM = weight * (36 / (37 - effectiveReps));
  
  // Arrondir à une décimale
  return Math.round(oneRM * 10) / 10;
}

/**
 * Parse une charge au format "70kg" ou "70" en nombre
 */
export function parseWeight(charge: string): number | null {
  const match = charge.match(/(\d+\.?\d*)/);
  if (!match) return null;
  return parseFloat(match[1]);
}

/**
 * Parse les reps au format "10" ou "8-12" (prend la valeur min)
 */
export function parseReps(repsStr: string): number | null {
  const match = repsStr.match(/(\d+)/);
  if (!match) return null;
  return parseInt(match[1]);
}

/**
 * Vérifie si un max doit être enregistré
 * Conditions: RPE >= 7, charge définie, reps définies
 */
export function shouldRecordMax(
  charge: string | null,
  reps: string | null,
  rpe: number | null
): boolean {
  if (!charge || !reps || !rpe) return false;
  
  const weight = parseWeight(charge);
  const repsValue = parseReps(reps);
  
  // Enregistrer uniquement si RPE >= 7 (effort significatif)
  // et si les valeurs sont valides
  return weight !== null && repsValue !== null && rpe >= 7;
}
