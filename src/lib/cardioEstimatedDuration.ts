import { calculateCardioSessionDuration, formatCardioSessionDuration } from "@/lib/cardioCalculations";

/**
 * Calcule la durée estimée d'une séance cardio à partir de ses exercices
 * Retourne la durée formatée ou null si pas de données cardio
 */
export function getCardioEstimatedDuration(
  exercises: any[],
  athleteVma: number | null
): string | null {
  if (!exercises || exercises.length === 0) return null;

  let totalSeconds = 0;

  for (const ex of exercises) {
    if (!ex.cardio_data) continue;

    let cardioData;
    try {
      cardioData =
        typeof ex.cardio_data === "string"
          ? JSON.parse(ex.cardio_data)
          : ex.cardio_data;
    } catch {
      continue;
    }

    totalSeconds += calculateCardioSessionDuration(cardioData, athleteVma);
  }

  if (totalSeconds <= 0) return null;
  return formatCardioSessionDuration(totalSeconds);
}

/**
 * Vérifie si une séance est de type cardio
 */
export function isCardioSession(session: any): boolean {
  if (!session) return false;
  const type = session.session_type;
  if (type === "cardio" || type === "course" || type === "velo" || type === "natation") return true;
  const exercises = session.session_exercises || [];
  return exercises.some(
    (ex: any) =>
      ex.cardio_sport === "course" ||
      ex.cardio_sport === "velo" ||
      ex.cardio_sport === "natation"
  );
}
