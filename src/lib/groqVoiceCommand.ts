import { supabase } from "@/integrations/supabase/client";
import type { VoiceCommand, VoiceChanges } from "./parseVoiceCommand";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LibraryExercise {
  id: string;
  name: string;
}

export interface SessionExercise {
  id: number;
  name: string;
  charge: string;
  reps: string;
  series: string;
  rpe: string;
  recuperation: string;
  tempo: string;
}

// ─── Valeurs exactes de récupération (correspondant au Select de l'UI) ────────

export const RECUP_OPTIONS: { value: string; label: string; seconds: number }[] = [
  { value: "0s",      label: "Aucune",       seconds: 0   },
  { value: "30s",     label: "30 secondes",  seconds: 30  },
  { value: "35s",     label: "35 secondes",  seconds: 35  },
  { value: "40s",     label: "40 secondes",  seconds: 40  },
  { value: "45s",     label: "45 secondes",  seconds: 45  },
  { value: "50s",     label: "50 secondes",  seconds: 50  },
  { value: "55s",     label: "55 secondes",  seconds: 55  },
  { value: "1min",    label: "1 minute",     seconds: 60  },
  { value: "1min30s", label: "1 min 30 sec", seconds: 90  },
  { value: "2min",    label: "2 minutes",    seconds: 120 },
  { value: "2min30s", label: "2 min 30 sec", seconds: 150 },
  { value: "3min",    label: "3 minutes",    seconds: 180 },
  { value: "3min30s", label: "3 min 30 sec", seconds: 210 },
  { value: "4min",    label: "4 minutes",    seconds: 240 },
  { value: "4min30s", label: "4 min 30 sec", seconds: 270 },
  { value: "5min",    label: "5 minutes",    seconds: 300 },
  { value: "emom",    label: "EMOM",         seconds: -1  },
];

// ─── Cache bibliothèque ───────────────────────────────────────────────────────

let libraryCache: LibraryExercise[] | null = null;

export async function getExerciseLibrary(): Promise<LibraryExercise[]> {
  if (libraryCache) return libraryCache;
  const { data, error } = await supabase
    .from("exercise_library")
    .select("id, name")
    .order("name");
  if (error || !data) {
    console.warn("[groqVoiceCommand] Impossible de charger la bibliothèque:", error);
    return [];
  }
  libraryCache = data;
  return data;
}

// ─── Appel Groq ──────────────────────────────────────────────────────────────

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const RECUP_VALUES_STR = RECUP_OPTIONS.map((o) => `"${o.value}"=${o.label}`).join(", ");

function buildSystemPrompt(
  library: LibraryExercise[],
  sessionExercises: SessionExercise[],
): string {
  const sessionList = sessionExercises
    .map((e, idx) => {
      const vals = [
        e.charge && `charge:${e.charge}kg`,
        e.reps && `reps:${e.reps}`,
        e.series && `séries:${e.series}`,
        e.rpe && `rpe:${e.rpe}`,
        e.recuperation && `recup:${e.recuperation}`,
      ].filter(Boolean).join(", ");
      return `#${idx + 1} id:${e.id} "${e.name}"${vals ? ` (${vals})` : ""}`;
    })
    .join(" | ");

  const libraryNames = library.map((e) => e.name).join(", ");

  return `Coach sportif. Analyse la commande vocale et retourne uniquement du JSON.

SÉANCE (IDs pour modify/delete): ${sessionList || "vide"}
BIBLIOTHÈQUE (pour add): ${libraryNames || "vide"}

JSON à retourner:
[
  {"type":"modify","exerciseId":3,"exerciseName":"Back Squat","changes":{"charge":"80","reps":"4","series":"3","rpe":"7","recuperation":"2min","tempo":"301"},"seriesOverrides":{"2":{"reps":"5","charge":"85"}}},
  {"type":"delete","exerciseId":5,"exerciseName":"Bench Press"},
  {"type":"add","exerciseId":null,"exerciseName":"Romanian Deadlift","changes":{"series":"3","reps":"10","charge":"60","recuperation":"1min30s"}}
]

RÈGLES ABSOLUES:
1. modify/delete: exerciseId = ID exact de la SÉANCE. exerciseName = nom exact de la SÉANCE. INTERDIT d'inventer.
2. add: exerciseId = null. exerciseName = nom le plus proche dans la BIBLIOTHÈQUE (ou mot dicté si absent).
3. changes: seulement les champs cités (charge, reps, series, rpe, recuperation, tempo). Toutes valeurs en string.
4. recuperation: utilise UNIQUEMENT ces valeurs exactes: ${RECUP_VALUES_STR}.
   "1 minute" → "1min", "1 minute 30" → "1min30s", "2 minutes" → "2min", "90 secondes" → "1min30s", "30 secondes" → "30s", etc.
5. seriesOverrides (OPTIONNEL): objet dont les clés sont les numéros de séries (entiers, 1=première série).
   Utilise UNIQUEMENT si le coach demande des exceptions pour des séries spécifiques.
   Ex: "4 reps sauf la série 2 à 5 reps" → changes:{reps:"4"}, seriesOverrides:{"2":{reps:"5"}}
   Ex: "3 séries: série 1 à 100kg, série 2 à 110kg, série 3 à 120kg" → seriesOverrides:{"1":{charge:"100"},"2":{charge:"110"},"3":{charge:"120"}}
6. Correspondances phonétiques/sémantiques: "squat devant"→Zercher Squat, "squat roumain"→Romanian Deadlift, "développé couché"→Bench Press, "soulevé de terre"→Deadlift, etc.
7. Références positionnelles: "exercice 1", "exercice numéro 1", "le premier", "1er", "l'exo 1" → exercice #1 de la SÉANCE. "exercice 2", "deuxième", "2ème", "le second" → #2. "exercice 3", "troisième", "3ème" → #3. Etc. Utilise l'id et le nom exacts de l'exercice à cette position.
8. Retourne UNIQUEMENT le JSON, sans texte autour.`;
}

/**
 * Envoie la transcription à Groq et retourne les commandes parsées.
 */
export async function parseWithGroq(
  transcript: string,
  sessionExercises: SessionExercise[],
): Promise<VoiceCommand[]> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("Clé Groq manquante — redémarre le serveur local");

  const library = await getExerciseLibrary();
  const systemPrompt = buildSystemPrompt(library, sessionExercises);

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript },
      ],
      temperature: 0,
      max_tokens: 768,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";

  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Réponse Groq invalide — pas de JSON trouvé");

  const raw: Array<{
    type: string;
    exerciseId?: number | null;
    exerciseName?: string;
    changes?: Record<string, string>;
    seriesOverrides?: Record<string, Record<string, string>>;
  }> = JSON.parse(jsonMatch[0]);

  const sessionIds = new Set(sessionExercises.map((e) => e.id));
  const validRecupValues = new Set(RECUP_OPTIONS.map((o) => o.value));

  return raw
    .filter((r) => ["modify", "add", "delete"].includes(r.type))
    .map((r) => {
      // Vérification exerciseId pour modify/delete
      let exerciseId: number | undefined;
      if (r.exerciseId != null && (r.type === "modify" || r.type === "delete")) {
        if (sessionIds.has(Number(r.exerciseId))) {
          exerciseId = Number(r.exerciseId);
        } else {
          const byName = sessionExercises.find(
            (e) => e.name.toLowerCase() === (r.exerciseName ?? "").toLowerCase(),
          );
          if (byName) exerciseId = byName.id;
          else return null;
        }
      }

      // Nettoyage des changes : valider recuperation
      const changes: VoiceChanges = {};
      if (r.changes) {
        for (const [k, v] of Object.entries(r.changes)) {
          if (k === "recuperation") {
            if (validRecupValues.has(v)) (changes as any)[k] = v;
            // sinon on ignore la valeur invalide
          } else {
            (changes as any)[k] = v;
          }
        }
      }

      // Nettoyage des seriesOverrides
      let seriesOverrides: Record<number, Partial<VoiceChanges>> | undefined;
      if (r.seriesOverrides && Object.keys(r.seriesOverrides).length > 0) {
        seriesOverrides = {};
        for (const [serieNumStr, overrideRaw] of Object.entries(r.seriesOverrides)) {
          const serieNum = parseInt(serieNumStr);
          if (isNaN(serieNum) || serieNum < 1) continue;
          const override: Partial<VoiceChanges> = {};
          for (const [k, v] of Object.entries(overrideRaw)) {
            if (k === "recuperation") {
              if (validRecupValues.has(v)) (override as any)[k] = v;
            } else {
              (override as any)[k] = v;
            }
          }
          if (Object.keys(override).length > 0) seriesOverrides[serieNum] = override;
        }
        if (Object.keys(seriesOverrides).length === 0) seriesOverrides = undefined;
      }

      const cmd: VoiceCommand = {
        type: r.type as VoiceCommand["type"],
        exerciseName: r.exerciseName ?? "Exercice",
        matchScore: 1,
      };
      if (exerciseId != null) cmd.exerciseId = exerciseId;
      if (Object.keys(changes).length > 0) cmd.changes = changes;
      if (seriesOverrides) cmd.seriesOverrides = seriesOverrides;
      return cmd;
    })
    .filter((c): c is VoiceCommand => c !== null);
}
