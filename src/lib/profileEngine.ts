// Moteur de calcul de la "carte coureur" — pur, sans I/O.
import {
  type Distance, type Ambition, type StatCode, STAT_CODES,
  getWeights, getRef, RECOMMENDATIONS, STAT_LABELS,
} from "./profileReferentials";

export type { Distance, Ambition, StatCode };

export interface RawMeasures {
  vma?: number;             // km/h
  paceT12?: number;         // km/h (vitesse moyenne test 12 min)
  paceT30?: number;         // km/h (vitesse moyenne test 30 min)
  cardiacDrift?: number;    // % (ECO)
  paceFadeLongRun?: number; // % (MUS)
  rpeGap?: number;          // points (MEN)
  adherence?: number;       // % (REG)
}

export type Quality = "ok" | "estimated" | "insufficient";

export interface ProfileResult {
  overall: number;
  scores: Partial<Record<StatCode, number>>;
  measures: Partial<Record<StatCode, number>>; // mesure dérivée par stat
  strengths: StatCode[];
  weaknesses: StatCode[];
  recommendation: string;
  dataQuality: Partial<Record<StatCode, Quality>>;
}

/** Note 40→99 linéaire (gère les métriques inversées cible<plancher). */
export function computeScore(mesure: number, plancher: number, cible: number): number {
  const ratio = (mesure - plancher) / (cible - plancher);
  const score = 40 + ratio * 59;
  return Math.round(Math.min(99, Math.max(40, score)));
}

/** Index d'endurance (Péronnet-Thibault simplifié). v en km/h. */
export function enduranceIndex(paceT12: number, paceT30: number): number {
  return (paceT30 - paceT12) / (Math.log(30) - Math.log(12));
}

/** Renvoie la mesure dérivée d'une stat (ou undefined si donnée absente). */
function statMeasure(stat: StatCode, m: RawMeasures): number | undefined {
  switch (stat) {
    case "VMA": return m.vma;
    case "END": return m.paceT12 != null && m.paceT30 != null ? enduranceIndex(m.paceT12, m.paceT30) : undefined;
    case "SEU": return m.paceT30 != null && m.vma ? (m.paceT30 / m.vma) * 100 : undefined;
    case "ECO": return m.cardiacDrift;
    case "MUS": return m.paceFadeLongRun;
    case "MEN": return m.rpeGap;
    case "REG": return m.adherence;
  }
}

export function computeProfile(measures: RawMeasures, distance: Distance, ambition: Ambition): ProfileResult {
  const weights = getWeights(distance, ambition);
  const scores: Partial<Record<StatCode, number>> = {};
  const derived: Partial<Record<StatCode, number>> = {};
  const dataQuality: Partial<Record<StatCode, Quality>> = {};

  for (const stat of STAT_CODES) {
    const mesure = statMeasure(stat, measures);
    if (mesure == null || !Number.isFinite(mesure)) {
      dataQuality[stat] = "insufficient";
      continue;
    }
    const { cible, plancher } = getRef(stat, distance, ambition);
    scores[stat] = computeScore(mesure, plancher, cible);
    derived[stat] = Math.round(mesure * 100) / 100;
    dataQuality[stat] = "ok";
  }

  // Note globale : moyenne pondérée sur les stats disponibles (renormalisation)
  const present = STAT_CODES.filter((s) => scores[s] != null);
  let overall = 0;
  if (present.length) {
    const wsum = present.reduce((a, s) => a + weights[s], 0);
    overall = Math.round(present.reduce((a, s) => a + scores[s]! * weights[s], 0) / (wsum || 1));
  }

  // Moyenne des notes présentes (pour l'écart forces/faiblesses)
  const mean = present.length ? present.reduce((a, s) => a + scores[s]!, 0) / present.length : 0;

  // Points forts : 2 stats au plus grand écart positif ET note ≥ 75
  const strengths = present
    .filter((s) => scores[s]! >= 75 && scores[s]! - mean > 0)
    .sort((a, b) => (scores[b]! - mean) - (scores[a]! - mean))
    .slice(0, 2);

  // Points faibles : 2 notes les plus basses ET ≤ 65
  const weaknesses = present
    .filter((s) => scores[s]! <= 65)
    .sort((a, b) => scores[a]! - scores[b]!)
    .slice(0, 2);

  // Recommandation assemblée
  const recoParts = weaknesses.map((s) => RECOMMENDATIONS[s].short);
  let recommendation = recoParts.join(" + ");
  if (recommendation) recommendation += ".";
  if (strengths[0]) {
    recommendation += ` La ${STAT_LABELS[strengths[0]].toLowerCase()} est déjà un atout pour l'objectif.`;
  }
  if (!recommendation.trim()) recommendation = "Profil équilibré — continue sur ta lancée.";

  return { overall, scores, measures: derived, strengths, weaknesses, recommendation: recommendation.trim(), dataQuality };
}
