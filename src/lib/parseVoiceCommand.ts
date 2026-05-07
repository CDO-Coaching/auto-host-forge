import Fuse from "fuse.js";

export interface ExerciseTarget {
  id: number;
  name: string;
}

export interface VoiceChanges {
  charge?: string;
  reps?: string;
  series?: string;
  rpe?: string;
  recuperation?: string;
  tempo?: string;
}

export interface ParsedVoiceCommand {
  exerciseId: number;
  exerciseName: string;         // nom trouvé dans la session
  matchedFrom: string;          // ce que le coach a dit
  matchScore: number;           // 0-1, 1 = parfait
  changes: VoiceChanges;
  rawTranscript: string;
}

/** Supprime les accents et met en minuscules */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[''`]/g, " ")
    .trim();
}

/**
 * Extrait un nombre depuis un texte (accepte virgule ou point comme séparateur décimal)
 */
function extractNumber(s: string): string | null {
  const m = s.match(/(\d+(?:[,\.]\d+)?)/);
  if (!m) return null;
  return m[1].replace(",", ".");
}

/**
 * Extrait un temps de récupération (ex: "1 minute 30", "90 secondes", "1:30", "2 minutes")
 */
function extractRecup(text: string): string | null {
  // Format mm:ss
  const mmss = text.match(/(\d+):(\d{2})/);
  if (mmss) return `${mmss[1]}:${mmss[2]}`;

  // X minute(s) Y seconde(s)
  const minSec = text.match(/(\d+)\s*min(?:utes?)?\s*(?:et\s*)?(\d+)\s*sec(?:ondes?)?/);
  if (minSec) {
    const total = parseInt(minSec[1]) * 60 + parseInt(minSec[2]);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  // X minutes
  const min = text.match(/(\d+)\s*min(?:utes?)?(?!\s*\d)/);
  if (min) {
    const m = parseInt(min[1]);
    return `${m}:00`;
  }

  // X secondes
  const sec = text.match(/(\d+)\s*sec(?:ondes?)?/);
  if (sec) {
    const s = parseInt(sec[1]);
    return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `0:${String(s).padStart(2, "0")}`;
  }

  return null;
}

/** Extrait les modifications depuis le texte transcrit */
function extractChanges(text: string): VoiceChanges {
  const t = normalize(text);
  const changes: VoiceChanges = {};

  // CHARGE — "charge à 45", "45 kg", "45 kilos", "poids 45"
  const chargePatterns = [
    /(?:charge|poids|kg|kilos?|kilogrammes?)\s*(?:a|à|de|:)?\s*(\d+(?:[,\.]\d+)?)/,
    /(\d+(?:[,\.]\d+)?)\s*(?:kg|kilos?|kilogrammes?)/,
    /(?:mets?|passe[sz]?|change[sz]?)\s+(?:la\s+charge|le\s+poids)\s+(?:a|à|de)?\s*(\d+(?:[,\.]\d+)?)/,
  ];
  for (const p of chargePatterns) {
    const m = t.match(p);
    if (m) { changes.charge = m[1].replace(",", "."); break; }
  }

  // REPS — "12 reps", "12 répétitions", "12 fois"
  const repsPatterns = [
    /(\d+)\s*(?:reps?|repetitions?|repet(?:itions?)?|fois)/,
    /(?:reps?|repetitions?|fois)\s*(?:a|à|de|:)?\s*(\d+)/,
  ];
  for (const p of repsPatterns) {
    const m = t.match(p);
    if (m) { changes.reps = m[1]; break; }
  }

  // SÉRIES — "4 séries", "4 sets"
  const seriesPatterns = [
    /(\d+)\s*(?:series?|sets?)/,
    /(?:series?|sets?)\s*(?:a|à|de|:)?\s*(\d+)/,
  ];
  for (const p of seriesPatterns) {
    const m = t.match(p);
    if (m) { changes.series = m[1]; break; }
  }

  // RPE — "rpe 7", "rpe à 7", "intensite 8"
  const rpePatterns = [
    /rpe\s*(?:a|à|de|:)?\s*(\d+(?:[,\.]\d+)?)/,
    /intensite\s*(?:a|à|de|:)?\s*(\d+(?:[,\.]\d+)?)/,
  ];
  for (const p of rpePatterns) {
    const m = t.match(p);
    if (m) { changes.rpe = m[1].replace(",", "."); break; }
  }

  // TEMPO — "tempo 3 0 1", "tempo 301", "tempo 3-0-1"
  const tempoM = t.match(/tempo\s*:?\s*([\d][\d\s\-\.]{1,8}[\d])/);
  if (tempoM) changes.tempo = tempoM[1].replace(/[\s\-\.]/g, "");

  // RÉCUPÉRATION — "récup 1 minute 30", "90 secondes de repos"
  const recupWindow = t.match(
    /(?:recup(?:eration)?|repos|rest)\s*(?:de\s*|:?\s*)([\d][\d\s:m-]+(?:sec(?:ondes?)?|min(?:utes?)?|:\d+)?)/
  );
  if (recupWindow) {
    const r = extractRecup(recupWindow[0]);
    if (r) changes.recuperation = r;
  }

  return changes;
}

/**
 * Parse une commande vocale et retourne les modifications à appliquer
 * sur les exercices de la session courante.
 */
export function parseVoiceCommand(
  transcript: string,
  exercises: ExerciseTarget[]
): ParsedVoiceCommand | null {
  if (!transcript.trim() || exercises.length === 0) return null;

  const normalizedTranscript = normalize(transcript);

  // Fuzzy search sur les noms d'exercices
  const fuse = new Fuse(exercises, {
    keys: ["name"],
    threshold: 0.5,            // tolérance: 0 = exact, 1 = tout accepter
    getFn: (obj, path) => normalize(obj[path as keyof ExerciseTarget] as string),
    includeScore: true,
    minMatchCharLength: 3,
  });

  const results = fuse.search(normalizedTranscript);
  if (results.length === 0) return null;

  const best = results[0];
  const exercise = best.item;
  const score = 1 - (best.score ?? 1); // fuse: 0=perfect → on inverse pour avoir 1=perfect

  const changes = extractChanges(transcript);
  if (Object.keys(changes).length === 0) return null;

  return {
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    matchedFrom: transcript,
    matchScore: score,
    changes,
    rawTranscript: transcript,
  };
}
