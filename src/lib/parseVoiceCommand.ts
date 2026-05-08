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

export type VoiceCommandType = "modify" | "add" | "delete";

export interface VoiceCommand {
  type: VoiceCommandType;
  exerciseId?: number;    // pour modify / delete (exercice existant)
  exerciseName: string;   // nom matché ou nom dicté pour un add nouveau
  changes?: VoiceChanges; // pour modify / add
  matchScore: number;
}

export interface ParsedVoiceCommands {
  commands: VoiceCommand[];
  rawTranscript: string;
}

// ─── Ancienne interface (rétro-compatibilité) ────────────────────────────────
export interface ParsedVoiceCommand {
  exerciseId: number;
  exerciseName: string;
  matchedFrom: string;
  matchScore: number;
  changes: VoiceChanges;
  rawTranscript: string;
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────

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
 * Corrige les erreurs phonétiques courantes du Speech API fr-FR
 * sur les termes anglais du fitness (mal transcrits en mots français).
 */
function fixSpeechMishearings(text: string): string {
  return text
    .replace(/cr[eèêë]pes?/gi, "reps")
    .replace(/kr[eèêë]pes?/gi, "reps")
    .replace(/\bscala\b/gi, "squat")
    .replace(/\bscuat\b/gi, "squat")
    .replace(/\bdead\s+life\b/gi, "deadlift")
    .replace(/\bbanch\b/gi, "bench")
    .replace(/\b(?:areu\s*pe|arp[eé]|erp)\b/gi, "rpe")
    .replace(/\bse?ttes?\b/gi, "sets")
    .replace(/\bc[eè]ts?\b/gi, "sets");
}

/**
 * Extrait un temps de récupération
 */
function extractRecup(text: string): string | null {
  const mmss = text.match(/(\d+):(\d{2})/);
  if (mmss) return `${mmss[1]}:${mmss[2]}`;

  const minSec = text.match(/(\d+)\s*min(?:utes?)?\s*(?:et\s*)?(\d+)\s*sec(?:ondes?)?/);
  if (minSec) {
    const total = parseInt(minSec[1]) * 60 + parseInt(minSec[2]);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  const min = text.match(/(\d+)\s*min(?:utes?)?(?!\s*\d)/);
  if (min) return `${parseInt(min[1])}:00`;

  const sec = text.match(/(\d+)\s*sec(?:ondes?)?/);
  if (sec) {
    const s = parseInt(sec[1]);
    return s >= 60
      ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
      : `0:${String(s).padStart(2, "0")}`;
  }

  return null;
}

/** Extrait les modifications de valeurs depuis un segment de texte (déjà normalisé) */
function extractChanges(text: string): VoiceChanges {
  const t = normalize(fixSpeechMishearings(text));
  const changes: VoiceChanges = {};

  // CHARGE
  for (const p of [
    /(?:charge|poids|kg|kilos?|kilogrammes?)\s*(?:a|de|:)?\s*(\d+(?:[,\.]\d+)?)/,
    /(\d+(?:[,\.]\d+)?)\s*(?:kg|kilos?|kilogrammes?)/,
    /(?:mets?|passe[sz]?|change[sz]?)\s+(?:la\s+charge|le\s+poids)\s+(?:a|de)?\s*(\d+(?:[,\.]\d+)?)/,
  ]) {
    const m = t.match(p);
    if (m) { changes.charge = m[1].replace(",", "."); break; }
  }

  // REPS
  for (const p of [
    /(\d+)\s*(?:reps?|repetitions?|repet(?:itions?)?|fois)/,
    /(?:reps?|repetitions?|fois)\s*(?:a|de|:)?\s*(\d+)/,
  ]) {
    const m = t.match(p);
    if (m) { changes.reps = m[1]; break; }
  }

  // SÉRIES
  for (const p of [
    /(\d+)\s*(?:series?|sets?)/,
    /(?:series?|sets?)\s*(?:a|de|:)?\s*(\d+)/,
  ]) {
    const m = t.match(p);
    if (m) { changes.series = m[1]; break; }
  }

  // RPE
  for (const p of [
    /rpe\s*(?:a|de|:)?\s*(\d+(?:[,\.]\d+)?)/,
    /intensite\s*(?:a|de|:)?\s*(\d+(?:[,\.]\d+)?)/,
  ]) {
    const m = t.match(p);
    if (m) { changes.rpe = m[1].replace(",", "."); break; }
  }

  // TEMPO
  const tempoM = t.match(/tempo\s*:?\s*([\d][\d\s\-\.]{1,8}[\d])/);
  if (tempoM) changes.tempo = tempoM[1].replace(/[\s\-\.]/g, "");

  // RÉCUPÉRATION
  const recupW = t.match(
    /(?:recup(?:eration)?|repos|rest)\s*(?:de\s*|:?\s*)([\d][\d\s:m-]+(?:sec(?:ondes?)?|min(?:utes?)?|:\d+)?)/,
  );
  if (recupW) {
    const r = extractRecup(recupW[0]);
    if (r) changes.recuperation = r;
  }

  return changes;
}

// ─── Verbes d'action ─────────────────────────────────────────────────────────

const ADD_VERBS = new Set([
  "ajoute", "rajoute", "ajouter", "rajouter", "ajoutes", "rajoutes",
  "nouvelle", "nouveau", "cree", "insere", "creer", "inserer", "ajouter",
]);
const DELETE_VERBS = new Set([
  "supprime", "supprimes", "supprimez", "enleve", "enleves", "enlevez",
  "retire", "retires", "retirez", "efface", "effaces", "effacez",
  "supprimer", "enlever", "retirer", "effacer",
]);
const STOP_WORDS = new Set([
  "le", "la", "les", "un", "une", "des", "du", "de", "l", "d",
  "pour", "au", "aux", "et", "ou", "en", "sur", "avec", "par",
]);

function detectVerbType(words: string[], beforeIdx: number): VoiceCommandType {
  const lookback = words.slice(Math.max(0, beforeIdx - 6), beforeIdx);
  for (const w of lookback) {
    if (ADD_VERBS.has(w)) return "add";
    if (DELETE_VERBS.has(w)) return "delete";
  }
  return "modify";
}

// ─── Recherche fuzzy multi-n-grammes ─────────────────────────────────────────

function buildFuse(exercises: ExerciseTarget[]): Fuse<ExerciseTarget> {
  return new Fuse(exercises, {
    keys: ["name"],
    threshold: 0.45,
    getFn: (obj, path) => normalize(obj[path as keyof ExerciseTarget] as string),
    includeScore: true,
    minMatchCharLength: 3,
  });
}

interface Mention {
  exercise: ExerciseTarget;
  wordStart: number;
  wordEnd: number;
  score: number;
}

/**
 * Trouve toutes les occurrences d'exercices connus dans le tableau de mots,
 * sans chevauchement, en prenant les meilleurs scores.
 */
function findExerciseMentions(words: string[], fuse: Fuse<ExerciseTarget>): Mention[] {
  const candidates: Mention[] = [];

  for (let start = 0; start < words.length; start++) {
    for (let len = 1; len <= Math.min(5, words.length - start); len++) {
      const ngram = words.slice(start, start + len).join(" ");
      if (ngram.length < 3) continue;
      const results = fuse.search(ngram);
      if (results.length > 0) {
        const score = 1 - (results[0].score ?? 1);
        if (score >= 0.5) {
          candidates.push({ exercise: results[0].item, wordStart: start, wordEnd: start + len, score });
        }
      }
    }
  }

  // Tri par score décroissant, sélection sans chevauchement
  candidates.sort((a, b) => b.score - a.score);
  const covered = new Set<number>();
  const mentions: Mention[] = [];

  for (const c of candidates) {
    const overlaps = Array.from({ length: c.wordEnd - c.wordStart }, (_, i) => c.wordStart + i).some(
      (i) => covered.has(i),
    );
    if (!overlaps) {
      mentions.push(c);
      for (let i = c.wordStart; i < c.wordEnd; i++) covered.add(i);
    }
  }

  return mentions.sort((a, b) => a.wordStart - b.wordStart);
}

// ─── Parser principal ─────────────────────────────────────────────────────────

/**
 * Parse une ou plusieurs commandes vocales en une seule dictée.
 * Supporte : modifier un exercice, en ajouter un, en supprimer un.
 *
 * Exemples :
 *  "Squat charge à 80 et 12 reps, supprime le deadlift, ajoute rowing 3 séries"
 */
export function parseVoiceCommands(
  transcript: string,
  exercises: ExerciseTarget[],
): ParsedVoiceCommands | null {
  if (!transcript.trim() || exercises.length === 0) return null;

  const corrected = fixSpeechMishearings(transcript);
  const words = normalize(corrected).split(/\s+/).filter((w) => w.length > 0);

  const fuse = buildFuse(exercises);
  const mentions = findExerciseMentions(words, fuse);
  const commands: VoiceCommand[] = [];

  // Indices de mots couverts par un "add verb + mention" (pour exclure des add-inconnus)
  const coveredAddVerbIndices = new Set<number>();

  // ── Traitement des exercices connus trouvés ───────────────────────────────
  for (let i = 0; i < mentions.length; i++) {
    const m = mentions[i];
    const verb = detectVerbType(words, m.wordStart);

    // Marquer les add-verbes liés à cette mention comme couverts
    if (verb === "add") {
      for (let k = Math.max(0, m.wordStart - 6); k < m.wordStart; k++) {
        if (ADD_VERBS.has(words[k])) coveredAddVerbIndices.add(k);
      }
    }

    // Segment de valeurs = mots après le nom jusqu'au prochain exercice (ou fin)
    const segEnd = mentions[i + 1]?.wordStart ?? words.length;
    const segText = words.slice(m.wordEnd, segEnd).join(" ");

    if (verb === "delete") {
      commands.push({
        type: "delete",
        exerciseId: m.exercise.id,
        exerciseName: m.exercise.name,
        matchScore: m.score,
      });
    } else {
      // "add" connu ou "modify"
      const changes = extractChanges(segText);
      if (verb === "modify" && Object.keys(changes).length === 0) continue; // rien à faire
      commands.push({
        type: verb,
        exerciseId: verb === "modify" ? m.exercise.id : undefined,
        exerciseName: m.exercise.name,
        changes,
        matchScore: m.score,
      });
    }
  }

  // ── Ajout d'exercices inconnus ("ajoute rowing ...") ─────────────────────
  // On cherche les verbes "ajoute" non couverts par une mention connue
  for (let wi = 0; wi < words.length; wi++) {
    if (!ADD_VERBS.has(words[wi]) || coveredAddVerbIndices.has(wi)) continue;

    // Cherche le nom : premiers mots non-stopword après le verbe
    const nameWords: string[] = [];
    let j = wi + 1;
    while (j < words.length && nameWords.length < 3) {
      const w = words[j];
      // Stoppe si on rencontre un verbe d'action ou un chiffre (début des valeurs)
      if (ADD_VERBS.has(w) || DELETE_VERBS.has(w) || /^\d/.test(w)) break;
      if (!STOP_WORDS.has(w)) nameWords.push(w);
      j++;
    }

    if (nameWords.length === 0) continue;

    // Si ces mots matchent un exercice connu → déjà traité, on passe
    const testNgram = nameWords.join(" ");
    const testResults = fuse.search(testNgram);
    if (testResults.length > 0 && 1 - (testResults[0].score ?? 1) >= 0.5) continue;

    // Exercice inconnu → ajout libre
    const spokenName = nameWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    const segEnd = mentions.find((m) => m.wordStart > wi)?.wordStart ?? words.length;
    const segText = words.slice(j, segEnd).join(" ");
    const changes = extractChanges(segText);

    commands.push({
      type: "add",
      exerciseName: spokenName,
      changes,
      matchScore: 1,
    });
  }

  if (commands.length === 0) return null;
  return { commands, rawTranscript: transcript };
}

// ─── Rétro-compatibilité (ancienne API) ──────────────────────────────────────
export function parseVoiceCommand(
  transcript: string,
  exercises: ExerciseTarget[],
): ParsedVoiceCommand | null {
  const result = parseVoiceCommands(transcript, exercises);
  if (!result) return null;
  const cmd = result.commands.find((c) => c.type === "modify" && c.exerciseId && c.changes);
  if (!cmd || !cmd.exerciseId || !cmd.changes) return null;
  return {
    exerciseId: cmd.exerciseId,
    exerciseName: cmd.exerciseName,
    matchedFrom: transcript,
    matchScore: cmd.matchScore,
    changes: cmd.changes,
    rawTranscript: transcript,
  };
}
