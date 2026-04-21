// Questionnaire SFMS - 54 questions oui/non sur le surentraînement
// Source: Société Française de Médecine du Sport
// Chaque question est associée à une dimension principale.

export type SfmsDimension =
  | "fatigue_physique"
  | "performance"
  | "psychologique"
  | "cognitif"
  | "sommeil_appetit"
  | "physiologique";

export interface SfmsQuestion {
  id: number;
  text: string;
  dimension: SfmsDimension;
}

export const SFMS_DIMENSIONS: Record<SfmsDimension, { label: string; color: string }> = {
  fatigue_physique: { label: "Fatigue physique", color: "hsl(var(--destructive))" },
  performance: { label: "Performance", color: "hsl(var(--primary))" },
  psychologique: { label: "État psychologique", color: "hsl(280 70% 55%)" },
  cognitif: { label: "Fonctions cognitives", color: "hsl(200 80% 50%)" },
  sommeil_appetit: { label: "Sommeil et appétit", color: "hsl(160 70% 45%)" },
  physiologique: { label: "Signes physiologiques", color: "hsl(30 90% 55%)" },
};

export const SFMS_QUESTIONS: SfmsQuestion[] = [
  { id: 1, text: "Mon niveau de performance sportive / mon état de forme a diminué", dimension: "performance" },
  { id: 2, text: "Je ne soutiens pas autant mon attention", dimension: "cognitif" },
  { id: 3, text: "Mes proches estiment que mon comportement a changé", dimension: "psychologique" },
  { id: 4, text: "J'ai une sensation de poids sur la poitrine", dimension: "physiologique" },
  { id: 5, text: "J'ai une sensation de palpitation", dimension: "physiologique" },
  { id: 6, text: "J'ai une sensation de gorge serrée", dimension: "physiologique" },
  { id: 7, text: "J'ai moins d'appétit qu'avant", dimension: "sommeil_appetit" },
  { id: 8, text: "Je mange davantage", dimension: "sommeil_appetit" },
  { id: 9, text: "Je dors moins bien", dimension: "sommeil_appetit" },
  { id: 10, text: "Je somnole et baille dans la journée", dimension: "fatigue_physique" },
  { id: 11, text: "Les séances me paraissent trop rapprochées", dimension: "performance" },
  { id: 12, text: "Mon désir sexuel a diminué", dimension: "physiologique" },
  { id: 13, text: "Je fais des contre-performances", dimension: "performance" },
  { id: 14, text: "Je m'enrhume fréquemment", dimension: "physiologique" },
  { id: 15, text: "J'ai des problèmes de mémoire", dimension: "cognitif" },
  { id: 16, text: "Je grossis", dimension: "sommeil_appetit" },
  { id: 17, text: "Je me sens souvent fatigué", dimension: "fatigue_physique" },
  { id: 18, text: "Je me sens en état d'infériorité", dimension: "psychologique" },
  { id: 19, text: "J'ai des crampes, douleurs musculaires fréquentes", dimension: "fatigue_physique" },
  { id: 20, text: "J'ai plus souvent mal à la tête", dimension: "physiologique" },
  { id: 21, text: "Je manque d'entrain", dimension: "psychologique" },
  { id: 22, text: "J'ai parfois des malaises ou des étourdissements", dimension: "physiologique" },
  { id: 23, text: "Je me confie moins facilement", dimension: "psychologique" },
  { id: 24, text: "Je suis souvent patraque", dimension: "physiologique" },
  { id: 25, text: "J'ai plus souvent mal à la gorge", dimension: "physiologique" },
  { id: 26, text: "Je me sens nerveux, tendu, inquiet", dimension: "psychologique" },
  { id: 27, text: "Je supporte moins bien mon entraînement", dimension: "performance" },
  { id: 28, text: "Mon cœur bat plus vite qu'avant au repos", dimension: "physiologique" },
  { id: 29, text: "Mon cœur bat plus vite qu'avant à l'effort", dimension: "physiologique" },
  { id: 30, text: "Je suis souvent mal fichu", dimension: "physiologique" },
  { id: 31, text: "Je me fatigue plus facilement", dimension: "fatigue_physique" },
  { id: 32, text: "J'ai souvent des troubles digestifs", dimension: "physiologique" },
  { id: 33, text: "J'ai envie de rester au lit", dimension: "fatigue_physique" },
  { id: 34, text: "J'ai moins confiance en moi", dimension: "psychologique" },
  { id: 35, text: "Je me blesse facilement", dimension: "fatigue_physique" },
  { id: 36, text: "J'ai plus de mal à rassembler mes idées", dimension: "cognitif" },
  { id: 37, text: "J'ai plus de mal à me concentrer dans mon activité sportive", dimension: "cognitif" },
  { id: 38, text: "Mes gestes sportifs sont moins précis, moins habiles", dimension: "performance" },
  { id: 39, text: "J'ai perdu de la force, du punch", dimension: "performance" },
  { id: 40, text: "J'ai l'impression de n'avoir personne de proche à qui parler", dimension: "psychologique" },
  { id: 41, text: "Je dors plus", dimension: "sommeil_appetit" },
  { id: 42, text: "Je tousse plus souvent", dimension: "physiologique" },
  { id: 43, text: "Je prends moins de plaisir à mon activité sportive", dimension: "psychologique" },
  { id: 44, text: "Je prends moins de plaisir à mes loisirs", dimension: "psychologique" },
  { id: 45, text: "Je m'irrite plus facilement", dimension: "psychologique" },
  { id: 46, text: "J'ai une baisse de rendement dans mon activité scolaire ou professionnelle", dimension: "performance" },
  { id: 47, text: "Mon entourage trouve que je deviens moins agréable à vivre", dimension: "psychologique" },
  { id: 48, text: "Les séances sportives me paraissent trop difficiles", dimension: "performance" },
  { id: 49, text: "C'est ma faute si je réussis moins bien", dimension: "psychologique" },
  { id: 50, text: "J'ai les jambes lourdes", dimension: "fatigue_physique" },
  { id: 51, text: "J'égare plus facilement les objets (clefs, etc.)", dimension: "cognitif" },
  { id: 52, text: "Je suis pessimiste, j'ai des idées noires", dimension: "psychologique" },
  { id: 53, text: "Je maigris", dimension: "sommeil_appetit" },
  { id: 54, text: "Je me sens moins motivé, j'ai moins de volonté, moins de ténacité", dimension: "psychologique" },
];

export interface SfmsInterpretation {
  level: "ok" | "watch" | "alert" | "critical";
  label: string;
  description: string;
  colorClass: string;
}

export function getSfmsInterpretation(score: number): SfmsInterpretation {
  if (score < 10) {
    return {
      level: "ok",
      label: "Pas de signe particulier",
      description: "Ton score est rassurant. Continue ainsi en restant à l'écoute de ton corps.",
      colorClass: "text-emerald-600 dark:text-emerald-400",
    };
  }
  if (score < 20) {
    return {
      level: "watch",
      label: "Fatigue à surveiller",
      description: "Quelques signes de fatigue apparaissent. Sois vigilant sur ton sommeil, ta récupération et ta charge d'entraînement.",
      colorClass: "text-yellow-600 dark:text-yellow-400",
    };
  }
  if (score < 27) {
    return {
      level: "alert",
      label: "Seuil d'alerte – possible surentraînement",
      description: "Tes signaux de fatigue deviennent importants. Parles-en à ton coach et envisage une phase de récupération.",
      colorClass: "text-orange-600 dark:text-orange-400",
    };
  }
  return {
    level: "critical",
    label: "Surentraînement probable",
    description: "Ton score traduit un état de surentraînement probable. Contacte rapidement ton coach et envisage un avis médical.",
    colorClass: "text-destructive",
  };
}

export function computeDimensionScores(answers: Record<number, boolean>) {
  const scores: Record<SfmsDimension, number> = {
    fatigue_physique: 0,
    performance: 0,
    psychologique: 0,
    cognitif: 0,
    sommeil_appetit: 0,
    physiologique: 0,
  };
  const totals: Record<SfmsDimension, number> = {
    fatigue_physique: 0,
    performance: 0,
    psychologique: 0,
    cognitif: 0,
    sommeil_appetit: 0,
    physiologique: 0,
  };
  SFMS_QUESTIONS.forEach((q) => {
    totals[q.dimension] += 1;
    if (answers[q.id]) scores[q.dimension] += 1;
  });
  return { scores, totals };
}
