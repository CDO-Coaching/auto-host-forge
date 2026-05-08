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
  name: string;
  charge: string;
  reps: string;
  series: string;
  rpe: string;
  recuperation: string;
  tempo: string;
}

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

function buildSystemPrompt(
  library: LibraryExercise[],
  sessionExercises: SessionExercise[],
): string {
  // Liste de la séance : IDs + noms (source de vérité pour modify/delete)
  const sessionList = sessionExercises
    .map((e) => {
      const vals = [
        e.charge && `charge:${e.charge}kg`,
        e.reps && `reps:${e.reps}`,
        e.series && `séries:${e.series}`,
        e.rpe && `rpe:${e.rpe}`,
      ].filter(Boolean).join(", ");
      return `id:${e.id} "${e.name}"${vals ? ` (${vals})` : ""}`;
    })
    .join(" | ");

  // Bibliothèque : noms uniquement, séparés par virgules (compact)
  const libraryNames = library.map((e) => e.name).join(", ");

  return `Coach sportif. Analyse la commande vocale et retourne uniquement du JSON.

SÉANCE (IDs pour modify/delete): ${sessionList || "vide"}
BIBLIOTHÈQUE (pour add): ${libraryNames || "vide"}

JSON à retourner:
[
  {"type":"modify","exerciseId":ID_ENTIER,"exerciseName":"NOM_EXACT_SÉANCE","changes":{"charge":"80","reps":"8","series":"4","rpe":"7","recuperation":"1:30","tempo":"301"}},
  {"type":"delete","exerciseId":ID_ENTIER,"exerciseName":"NOM_EXACT_SÉANCE"},
  {"type":"add","exerciseId":null,"exerciseName":"NOM_EXACT_BIBLIOTHÈQUE","changes":{"series":"3","reps":"10"}}
]

RÈGLES ABSOLUES:
1. modify/delete: exerciseId = l'ID exact de la SÉANCE. exerciseName = le nom exact de la SÉANCE. INTERDIT d'inventer.
2. add: exerciseName = nom le plus proche dans la BIBLIOTHÈQUE. Si absent, utilise le mot dicté.
3. changes: seulement les champs cités. Toutes valeurs en string. recuperation en "mm:ss".
4. Correspondances phonétiques/sémantiques: "squat devant"→Zercher Squat, "squat roumain"→Romanian Deadlift, "développé couché"→Bench Press, "soulevé de terre"→Deadlift, "tirage"→Row, etc.
5. Retourne UNIQUEMENT le JSON, sans texte autour.`;
}

/**
 * Envoie la transcription à Groq et retourne les commandes parsées.
 * Post-traitement : vérifie que les exerciseId de modify/delete existent bien en séance.
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
      max_tokens: 512,
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
  }> = JSON.parse(jsonMatch[0]);

  const sessionIds = new Set(sessionExercises.map((e) => e.id));

  return raw
    .filter((r) => ["modify", "add", "delete"].includes(r.type))
    .map((r) => {
      // Sécurité : pour modify/delete, vérifie que l'ID existe vraiment dans la séance
      let exerciseId: number | undefined = undefined;
      if (r.exerciseId != null && (r.type === "modify" || r.type === "delete")) {
        if (sessionIds.has(Number(r.exerciseId))) {
          exerciseId = Number(r.exerciseId);
        } else {
          // L'ID inventé par le LLM → cherche par nom dans la séance
          const byName = sessionExercises.find(
            (e) => e.name.toLowerCase() === (r.exerciseName ?? "").toLowerCase(),
          );
          if (byName) exerciseId = byName.id;
          else return null; // impossible à résoudre → on ignore
        }
      }

      const cmd: VoiceCommand = {
        type: r.type as VoiceCommand["type"],
        exerciseName: r.exerciseName ?? "Exercice",
        matchScore: 1,
      };
      if (exerciseId != null) cmd.exerciseId = exerciseId;
      if (r.changes && Object.keys(r.changes).length > 0) {
        cmd.changes = r.changes as VoiceChanges;
      }
      return cmd;
    })
    .filter((c): c is VoiceCommand => c !== null);
}
