/**
 * Bornes de plausibilité pour les métriques de séance (anti-saisie aberrante).
 * Une séance unique ne peut pas dépasser ces limites — au-delà, c'est une
 * erreur de saisie (ex: 889 km au lieu de 8,89).
 */
export const MAX_SESSION_DISTANCE_KM = 100;   // au-delà = aberrant pour une séance
export const MAX_SESSION_DURATION_MIN = 600;  // 10 h

/**
 * Valide distance + durée d'une séance.
 * Renvoie un message d'erreur (string) si invalide, sinon null.
 */
export function validateSessionMetrics(opts: {
  distanceKm?: number | null;
  durationMin?: number | null;
}): string | null {
  const { distanceKm, durationMin } = opts;
  if (distanceKm != null && !isNaN(distanceKm)) {
    if (distanceKm < 0) return "La distance ne peut pas être négative.";
    if (distanceKm > MAX_SESSION_DISTANCE_KM)
      return `Distance trop élevée (max ${MAX_SESSION_DISTANCE_KM} km pour une séance). Vérifie la valeur.`;
  }
  if (durationMin != null && !isNaN(durationMin)) {
    if (durationMin < 0) return "La durée ne peut pas être négative.";
    if (durationMin > MAX_SESSION_DURATION_MIN)
      return `Durée trop élevée (max ${MAX_SESSION_DURATION_MIN} min pour une séance). Vérifie la valeur.`;
  }
  return null;
}

/** Une valeur de distance/durée est-elle plausible pour l'affichage (graphes) ? */
export function isPlausibleDistanceKm(d: number | null | undefined): boolean {
  return d != null && !isNaN(d) && d >= 0 && d <= MAX_SESSION_DISTANCE_KM;
}
export function isPlausibleDurationMin(m: number | null | undefined): boolean {
  return m != null && !isNaN(m) && m >= 0 && m <= MAX_SESSION_DURATION_MIN;
}
