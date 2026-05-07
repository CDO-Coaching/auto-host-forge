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

/**
 * Corrige les erreurs phonétiques courantes du Speech API fr-FR
 * sur les termes anglais du fitness (mal transcrits en mots français).
 */
function fixSpeechMishearings(text: string): string {
  return text
    // "reps" / "rep" → souvent entendu comme "crêpe", "crèpe", "crepe", "crêpes"
    .replace(/cr[eèêë]pes?/gi, "reps")
    .replace(/kr[eèêë]pes?/gi, "reps")
    // "squat" → parfois "scala", "scuat"
    .replace(/\bscala\b/gi, "squat")
    .replace(/\bscuat\b/gi, "squat")
    // "deadlift" → "dead life", "dead lift" (garder comme tel, mais normaliser)
    .replace(/\bdead\s+life\b/gi, "deadlift")
    // "bench" → "banch", "bench press" bien géré
    .replace(/\bbanch\b/gi, "bench")
    // "RPE" → "areu pé", "erp", "arpé"
    .replace(/\b(?:areu\s*pe|arp[eé]|erp)\b/gi, "rpe")
    // "sets" → "cet", "sète"
    .replace(/\bse?ttes?\b/gi, "sets")
    .replace(/\bc[eè]ts?\b/gi, "sets")
    // "tempo" → généralement bien reconnu
    // "kg" → "kilo" bien reconnu
    ;
}

/** Extrait les modifications depuis le texte transcrit */
function extractChanges(text: string): VoiceChanges {
  const corrected = fixSpeechMishearings(text);
  const t = normalize(corrected);
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
 * Génère tous les n-grammes (1 à maxN mots) d'une phrase normalisée.
 * Permet de trouver un nom d'exercice court au sein d'une longue phrase.
 */
function getNgrams(text: string, maxN = 5): string[] {
  const words = text.split(/\s+/).filter((w) => w.length >= 2);
  const ngrams: string[] = [];
  for (let n = 1; n <= Math.min(maxN, words.length); n++) {
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.push(words.slice(i, i + n).join(" "));
    }
  }
  return ngrams;
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

  const correctedTranscript = fixSpeechMishearings(transcript);
  const normalizedTranscript = normalize(correctedTranscript);

  // Fuzzy search : on teste chaque n-gramme de la phrase contre les noms d'exercices
  // pour trouver le meilleur match même si la phrase est longue.
  const fuse = new Fuse(exercises, {
    keys: ["name"],
    threshold: 0.45,
    getFn: (obj, path) => normalize(obj[path as keyof ExerciseTarget] as string),
    includeScore: true,
    minMatchCharLength: 3,
  });

  const ngrams = getNgrams(normalizedTranscript);
  let bestMatch: { item: ExerciseTarget; score: number } | null = null;

  for (const ngram of ngrams) {
    const results = fuse.search(ngram);
    if (results.length > 0) {
      const score = 1 - (results[0].score ?? 1);
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { item: results[0].item, score };
      }
    }
  }

  if (!bestMatch || bestMatch.score < 0.5) return null;

  const changes = extractChanges(correctedTranscript);
  if (Object.keys(changes).length === 0) return null;

  return {
    exerciseId: bestMatch.item.id,
    exerciseName: bestMatch.item.name,
    matchedFrom: transcript,
    matchScore: bestMatch.score,
    changes,
    rawTranscript: transcript,
  };
}
