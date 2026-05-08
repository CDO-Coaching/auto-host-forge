import { supabase } from "@/integrations/supabase/client";
import type { VoiceCommand, VoiceChanges } from "./parseVoiceCommand";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LibraryExercise {
  id: string;
  name: string;
  muscle_principal?: string | null;
}

export interface SessionExercise {
  id: number;
  name: string;   // nom actuel dans la séance (ex: "Zercher Squat")
  charge: string;
  reps: string;
  series: string;
  rpe: string;
  recuperation: string;
  tempo: string;
}

// ─── Cache bibliothèque (chargée une seule fois par session navigateur) ───────

let libraryCache: LibraryExercise[] | null = null;

export async function getExerciseLibrary(): Promise<LibraryExercise[]> {
  if (libraryCache) return libraryCache;

  const { data, error } = await supabase
    .from("exercise_library")
    .select("id, name, muscle_principal")
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
const GROQ_MODEL = "llama-3.1-8b-instant"; // rapide + gratuit

function buildSystemPrompt(
  library: LibraryExercise[],
  sessionExercises: SessionExercise[],
): string {
  const libraryList = library
    .map((e) => `- "${e.name}"${e.muscle_principal ? ` (${e.muscle_principal})` : ""}`)
    .join("\n");

  const sessionList = sessionExercises
    .map((e) => {
      const vals = [
        e.charge && `charge:${e.charge}kg`,
        e.reps && `reps:${e.reps}`,
        e.series && `séries:${e.series}`,
        e.rpe && `rpe:${e.rpe}`,
      ]
        .filter(Boolean)
        .join(", ");
      return `- id:${e.id} "${e.name}"${vals ? ` (${vals})` : ""}`;
    })
    .join("\n");

  return `Tu es un assistant coach sportif francophone. Un coach dicte des modifications pour une séance de renforcement musculaire.

BIBLIOTHÈQUE D'EXERCICES DISPONIBLE:
${libraryList || "(vide)"}

EXERCICES ACTUELS DE LA SÉANCE (avec leurs IDs):
${sessionList || "(aucun exercice pour l'instant)"}

Ta tâche: analyser la commande vocale du coach et retourner un tableau JSON d'actions.

FORMAT DE RÉPONSE (JSON uniquement, sans markdown ni explication):
[
  {
    "type": "modify",
    "exerciseId": 3,
    "exerciseName": "Zercher Squat",
    "changes": { "charge": "80", "reps": "8", "series": "4", "rpe": "7", "recuperation": "2:00", "tempo": "301" }
  },
  {
    "type": "delete",
    "exerciseId": 5,
    "exerciseName": "Bench Press"
  },
  {
    "type": "add",
    "exerciseId": null,
    "exerciseName": "Romanian Deadlift",
    "changes": { "series": "3", "reps": "10", "charge": "60" }
  }
]

RÈGLES:
- "type" vaut "modify", "add" ou "delete"
- Pour "modify": exerciseId = l'ID de l'exercice dans la séance (nombre entier)
- Pour "delete": exerciseId = l'ID dans la séance, pas de champ "changes"
- Pour "add": exerciseId = null, exerciseName = nom exact de la bibliothèque si correspondance, sinon nom dicté mis en forme
- Dans "changes": uniquement les champs mentionnés (charge, reps, series, rpe, recuperation, tempo) — toutes des strings
- La récupération est au format "mm:ss" (ex: "1:30", "2:00", "0:45")
- Gère les erreurs phonétiques et le langage naturel: "squat devant" = "Zercher Squat", "squat roumain" = "Romanian Deadlift", "soulevé de terre" = "Deadlift", "développé couché" = "Bench Press", etc.
- Si l'exercice est dans la séance, utilise son exerciseId. Sinon, c'est un "add".
- Retourne UNIQUEMENT du JSON valide.`;
}

/**
 * Envoie la transcription à Groq et retourne les commandes parsées.
 */
export async function parseWithGroq(
  transcript: string,
  sessionExercises: SessionExercise[],
): Promise<VoiceCommand[]> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("Clé Groq manquante (VITE_GROQ_API_KEY)");

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
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";

  // Extraire le JSON (au cas où il y aurait du texte autour)
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Réponse Groq invalide: pas de JSON trouvé");

  const raw: Array<{
    type: string;
    exerciseId?: number | null;
    exerciseName?: string;
    changes?: Record<string, string>;
  }> = JSON.parse(jsonMatch[0]);

  // Normaliser en VoiceCommand[]
  return raw
    .filter((r) => ["modify", "add", "delete"].includes(r.type))
    .map((r) => {
      const cmd: VoiceCommand = {
        type: r.type as VoiceCommand["type"],
        exerciseName: r.exerciseName ?? "Exercice",
        matchScore: 1,
      };
      if (r.exerciseId != null) cmd.exerciseId = r.exerciseId;
      if (r.changes && Object.keys(r.changes).length > 0) {
        cmd.changes = r.changes as VoiceChanges;
      }
      return cmd;
    });
}
