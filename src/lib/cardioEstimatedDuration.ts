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
    // The DB column is cardio_content (not cardio_data)
    const rawData = ex.cardio_content || ex.cardio_data;
    if (!rawData) continue;

    let cardioData;
    try {
      cardioData = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
      // Handle array format
      if (Array.isArray(cardioData)) {
        cardioData = { steps: cardioData, blocks: [] };
      }
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
      ex.cardio_sport === "natation" ||
      ex.cardio_content
  );
}
