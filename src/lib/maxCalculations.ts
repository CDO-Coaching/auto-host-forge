/**
 * Parse un tempo au format "4211", "3010", etc. et retourne le temps total par rep en secondes
 * Format: [excentrique][pause bas][concentrique][pause haut]
 * Exemple: "4211" = 4+2+1+1 = 8 secondes
 */
export function parseTempo(tempo: string | null | undefined): number | null {
  if (!tempo || tempo.trim() === "") return null;
  
  // Nettoyer le tempo
  const cleaned = tempo.replace(/[^0-9]/g, "");
  
  // Format attendu: 4 chiffres
  if (cleaned.length !== 4) return null;
  
  const times = cleaned.split("").map(Number);
  const totalTime = times.reduce((sum, t) => sum + t, 0);
  
  return totalTime > 0 ? totalTime : null;
}

/**
 * Retourne le coefficient d'ajustement basé sur le temps sous tension par rep
 * Plus le tempo est long, plus l'exercice est difficile pour une même charge
 * Donc on augmente le 1RM estimé pour compenser
 */
export function getTempoCoefficient(tempoSeconds: number | null): number {
  if (tempoSeconds === null) return 1.00; // Pas de tempo = coefficient neutre
  
  if (tempoSeconds <= 4) return 1.00;      // Tempo rapide
  if (tempoSeconds <= 6) return 1.03;      // Tempo modéré (inverse de 0.97)
  if (tempoSeconds <= 8) return 1.065;     // Tempo contrôlé (inverse de 0.94)
  if (tempoSeconds <= 10) return 1.11;     // Tempo lent (inverse de 0.90)
  return 1.18;                              // Tempo très lent (inverse de 0.85)
}

/**
 * Calcule le 1RM théorique basé sur la charge, les reps, le RPE et le tempo
 * Utilise la formule de Brzycki ajustée par le RIR (Reps In Reserve)
 * Le tempo augmente la difficulté, donc on ajuste le 1RM à la hausse
 */
export function calculate1RM(weight: number, reps: number, rpe: number, tempo?: string | null): number {
  // Ajuster les reps selon le RPE (RIR = Reps In Reserve)
  const rir = 10 - rpe;
  const adjustedReps = reps + rir;
  
  // Formule de Brzycki: 1RM = weight × (36 / (37 - reps))
  // On limite à 30 reps pour éviter des résultats aberrants
  const effectiveReps = Math.min(adjustedReps, 30);
  const oneRM = weight * (36 / (37 - effectiveReps));
  
  // Appliquer le coefficient de tempo
  const tempoSeconds = parseTempo(tempo);
  const tempoCoeff = getTempoCoefficient(tempoSeconds);
  const adjustedRM = oneRM * tempoCoeff;
  
  // Arrondir à une décimale
  return Math.round(adjustedRM * 10) / 10;
}

/**
 * Parse une charge au format "70kg", "70", ou "18*2" (deux haltères) en nombre
 * "18*2" signifie deux poids de 18kg = 36kg total
 */
export function parseWeight(charge: string): number | null {
  // Format multiplication: "18*2" ou "18x2" ou "18 x 2"
  const multiMatch = charge.match(/(\d+\.?\d*)\s*[*xX×]\s*(\d+)/);
  if (multiMatch) {
    const weight = parseFloat(multiMatch[1]);
    const multiplier = parseInt(multiMatch[2]);
    return weight * multiplier;
  }
  
  // Format simple: "70" ou "70kg"
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
