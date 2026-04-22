import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DimensionScores {
  fatigue_physique: number;
  performance: number;
  psychologique: number;
  cognitif: number;
  sommeil_appetit: number;
  physiologique: number;
}

const DIMENSION_TOTALS: DimensionScores = {
  fatigue_physique: 7,
  performance: 8,
  psychologique: 14,
  cognitif: 5,
  sommeil_appetit: 6,
  physiologique: 14,
};

const DIMENSION_LABELS: Record<keyof DimensionScores, string> = {
  fatigue_physique: "Fatigue physique",
  performance: "Performance",
  psychologique: "Psychologique",
  cognitif: "Cognitive",
  sommeil_appetit: "Sommeil / appétit",
  physiologique: "Physiologique",
};

function buildPrompt(totalScore: number, scores: DimensionScores) {
  const ratios = (Object.keys(scores) as (keyof DimensionScores)[])
    .map((k) => ({
      key: k,
      label: DIMENSION_LABELS[k],
      raw: scores[k],
      total: DIMENSION_TOTALS[k],
      ratio: scores[k] / DIMENSION_TOTALS[k],
    }))
    .sort((a, b) => b.ratio - a.ratio);

  const detail = ratios
    .map(
      (r) =>
        `- ${r.label}: ${r.raw}/${r.total} (${Math.round(r.ratio * 100)}%)`,
    )
    .join("\n");

  let scoreBucket = "";
  if (totalScore < 10) scoreBucket = "Score < 10 → état normal, optimisation légère";
  else if (totalScore < 20) scoreBucket = "Score 10–19 → fatigue légère à surveiller";
  else if (totalScore < 27) scoreBucket = "Score 20–26 → seuil d'alerte, surcharge probable";
  else scoreBucket = "Score ≥ 27 → surentraînement probable, état critique";

  return `Tu es un coach sportif expert en physiologie et en prévention du surentraînement.
Tu analyses un questionnaire SFMS (Société Française de Médecine du Sport) rempli par un sportif.

DONNÉES :
- Score global : ${totalScore}/54
- Catégorie : ${scoreBucket}
- Scores par dimension (du plus dominant au plus faible) :
${detail}

CONSIGNES STRICTES :
1. Tutoie le sportif.
2. Commence par "D'après tes réponses…".
3. Identifie la ou les dimensions dominantes (ratio ≥ 50% ou nettement plus élevé que les autres). Si plusieurs sont élevées, fais une analyse combinée. Si aucune ne ressort, parle de fatigue diffuse. Si le score global est faible mais une dimension est très marquée (>= 60%), fais de la prévention ciblée. Si physiologique est dominante avec un score élevé, mets une alerte médicale prioritaire.
4. Structure ta réponse exactement comme ceci en Markdown :

**Observation personnalisée**
(2-3 phrases qui commencent par "D'après tes réponses…")

**Analyse des dominantes**
(Explique ce qui ressort, en nommant clairement la/les dimension(s))

**Interprétation simple**
(Explique concrètement ce que ça veut dire pour le sportif, sans jargon médical)

**Ce que tu dois faire maintenant :**
- (recommandation concrète 1, adaptée à la dimension dominante ET au niveau de score)
- (recommandation 2)
- (recommandation 3)
- (recommandation 4)
- (recommandation 5 si nécessaire)

ADAPTATION DES RECOMMANDATIONS :
- Fatigue physique → réduire volume, éviter échec musculaire, augmenter sommeil/mobilité
- Performance → supprimer séances intensives, éviter tests/max, revoir planification
- Psychologique → réduire pression sport+vie, remettre du plaisir, repos mental
- Cognitive → réduire complexité technique, limiter surcharge mentale, récupération nerveuse
- Sommeil/appétit → routine sommeil stricte, limiter écrans, adapter nutrition
- Physiologique → réduire fortement ou arrêter, consultation médicale si score élevé

ADAPTATION SELON LE SCORE :
- < 10 : maintien + optimisation légère
- 10–19 : réduction modérée (-20 à -30%) + prévention
- 20–26 : décharge (-40 à -60%) + suppression intensité élevée
- ≥ 27 : arrêt ou forte réduction + priorité santé + consultation médicale

STYLE :
- Professionnel mais accessible
- Phrases courtes et directes
- Évite les généralités, sois ultra spécifique aux scores donnés
- Pas plus de 250 mots au total
- Pas d'introduction ni de conclusion hors structure demandée

Génère maintenant le retour personnalisé.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { totalScore, scores } = await req.json();

    if (typeof totalScore !== "number" || !scores) {
      return new Response(
        JSON.stringify({ error: "totalScore et scores requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY manquant" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const prompt = buildPrompt(totalScore, scores);

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "Tu es un coach sportif expert qui produit des retours personnalisés et actionnables à partir de questionnaires de surentraînement SFMS. Jamais de réponses génériques.",
            },
            { role: "user", content: prompt },
          ],
        }),
      },
    );

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "Trop de requêtes, réessaie dans un instant." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (response.status === 402) {
      return new Response(
        JSON.stringify({ error: "Crédits IA épuisés. Recharge ton workspace Lovable." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "Erreur du service IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const feedback: string = data.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ feedback }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-sfms-feedback error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
