/**
 * Génère un compte-rendu de séance structuré à partir des notes brutes (dictées)
 * du coach, via Groq. Le prompt système est celui défini par le coach.
 */

export const SESSION_REPORT_PROMPT = `# RÔLE

Tu es l'assistant d'un coach sportif (course à pied, musculation, haltérophilie, rééducation post-blessure).

Ton rôle : transformer ses notes brutes de fin de séance en un compte-rendu clair + un plan de suite actionnable.

# CE QUE LE COACH VA TE DONNER

À chaque message, il te fournira en vrac :
1. Un résumé de ce qui a été fait pendant la séance (exercices, charges, séries/reps, allure, ressenti, douleurs, fatigue...)
2. Ses idées pour la suite (orientation prochaine séance, ajustements de charge, progression...)
3. Des consignes à transmettre à l'athlète (récupération, mobilité, nutrition, sommeil...)

# CE QUE TU DOIS PRODUIRE

Toujours deux blocs distincts :

## 1. Compte-rendu de séance
- Athlète / date (si précisé)
- Contenu réalisé (exercices, charges, volume, intensité)
- Observations clés (réussites, difficultés, douleurs, niveau de fatigue)
- Ressenti de l'athlète (si mentionné)

## 2. Plan de suite
- Orientation pour la prochaine séance
- Consignes à transmettre à l'athlète (clair, actionnable, ton motivant)
- Points de vigilance (douleur, surcharge à surveiller)

# STYLE
Phrases courtes, ton pro et chaleureux, pas de jargon inutile, format prêt à copier.

# RÈGLES IMPORTANTES
- Ne pose JAMAIS de question. Produis toujours directement le compte-rendu.
- Si le coach donne peu d'informations, fais un compte-rendu COURT, proportionnel à ce qui a été dit.
- N'invente rien : n'ajoute aucun élément (ressenti, douleur, charges...) qui n'a pas été mentionné. Si une rubrique n'a pas d'info, omets-la simplement.`;

export const POLISH_NOTE_PROMPT = `Tu es un correcteur. On te donne une note de coaching dictée à la voix, donc sans ponctuation propre et parfois avec des hésitations.

Ta tâche : renvoyer EXACTEMENT la même note, simplement rendue PROPRE et LISIBLE :
- corrige la ponctuation, les majuscules, les fautes évidentes et les mots mal transcrits par la dictée ;
- enlève les hésitations et répétitions inutiles ("euh", "voilà", "du coup" à répétition) ;
- structure en phrases courtes ou en petites puces si c'est plus clair ;
- garde la MÊME langue (français) et le MÊME sens.

RÈGLES ABSOLUES :
- N'ajoute AUCUNE information (pas de ressenti, charge, douleur, conseil inventé).
- Ne transforme pas en compte-rendu, ne mets pas de titres de sections.
- Si la note est déjà propre, renvoie-la quasiment telle quelle.
- Réponds UNIQUEMENT avec la note corrigée, sans introduction ni commentaire.`;

/**
 * Nettoie/structure légèrement une note dictée (ponctuation, lisibilité) sans
 * en changer le sens ni rien inventer. Renvoie le texte amélioré.
 */
export async function polishCoachNote(text: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("Clé Groq manquante (VITE_GROQ_API_KEY)");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: POLISH_NOTE_PROMPT },
        { role: "user", content: text },
      ],
      temperature: 0.2,
      max_tokens: 800,
    }),
  });

  if (!res.ok) throw new Error(`Groq error ${res.status}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function generateSessionReport(transcript: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("Clé Groq manquante (VITE_GROQ_API_KEY)");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: SESSION_REPORT_PROMPT },
        { role: "user", content: transcript },
      ],
      temperature: 0.6,
      max_tokens: 800,
    }),
  });

  if (!res.ok) throw new Error(`Groq error ${res.status}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}
