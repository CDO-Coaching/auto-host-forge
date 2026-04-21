import type { SfmsDimension } from "./sfmsQuestions";

export interface ScoreRecommendation {
  level: "ok" | "watch" | "alert" | "critical";
  title: string;
  recommendations: string[];
}

export function getScoreRecommendation(score: number): ScoreRecommendation {
  if (score < 10) {
    return {
      level: "ok",
      title: "Pas de signe particulier",
      recommendations: [
        "Maintenir la charge actuelle, continuer à écouter les signaux du corps.",
        "Refaire le test toutes les 4 à 6 semaines en période de charge élevée.",
      ],
    };
  }
  if (score < 20) {
    return {
      level: "watch",
      title: "Fatigue à surveiller",
      recommendations: [
        "Alléger la charge de 20 à 30% sur 1 à 2 semaines.",
        "Prioriser sommeil et nutrition.",
        "Intégrer une vraie journée OFF par semaine.",
        "Refaire le test dans 2 semaines.",
      ],
    };
  }
  if (score < 27) {
    return {
      level: "alert",
      title: "Seuil d'alerte",
      recommendations: [
        "Semaine de décharge obligatoire (récupération active légère uniquement).",
        "Consulter un médecin du sport.",
        "Bilan biologique conseillé (ferritine, cortisol, CPK, vitamine D).",
        "Revoir la planification sur les semaines à venir.",
      ],
    };
  }
  return {
    level: "critical",
    title: "Surentraînement probable",
    recommendations: [
      "Arrêt ou forte réduction de l'entraînement pendant 2 à 8 semaines selon l'état.",
      "Consultation médicale indispensable.",
      "Accompagnement psychologique si la sphère émotionnelle est touchée.",
      "Reprise très progressive, encadrée.",
    ],
  };
}

export interface DimensionRecommendation {
  title: string;
  recommendations: string[];
}

export const DIMENSION_RECOMMENDATIONS: Record<SfmsDimension, DimensionRecommendation> = {
  fatigue_physique: {
    title: "Fatigue physique générale dominante",
    recommendations: [
      "Réduire le volume avant l'intensité.",
      "Augmenter le sommeil (viser 8 à 9h).",
      "Vérifier les apports caloriques et en fer.",
      "Intégrer récupération active : marche, mobilité, sauna, massages.",
    ],
  },
  performance: {
    title: "Performance sportive dominante",
    recommendations: [
      "Arrêter de chercher la perf à tout prix.",
      "Semaine de décharge, puis reprise avec séances plus courtes et plaisantes.",
      "Revoir la périodisation : trop de séances difficiles rapprochées usent le système nerveux.",
    ],
  },
  psychologique: {
    title: "Psychologique / émotionnelle dominante",
    recommendations: [
      "C'est le signal le plus sérieux.",
      "Lever le pied sur l'entraînement ET sur les sollicitations extérieures (travail, réseaux).",
      "Consulter un psychologue du sport si idées noires, perte de plaisir ou isolement.",
      "Reconnecter avec des activités non sportives.",
    ],
  },
  cognitif: {
    title: "Cognitive dominante (concentration, mémoire)",
    recommendations: [
      "Souvent liée au manque de sommeil profond et à la surcharge mentale.",
      "Déconnexion écrans, sommeil prioritaire, réduction des tâches mentales intenses.",
      "Si ça persiste, consulter.",
    ],
  },
  sommeil_appetit: {
    title: "Sommeil et appétit dominant",
    recommendations: [
      "Hygiène de sommeil stricte : coucher régulier, pas d'écrans 1h avant, chambre fraîche.",
      "Bilan nutritionnel pour vérifier les apports.",
      "Limiter la caféine après midi.",
      "Consulter si perte d'appétit marquée ou troubles du sommeil persistants.",
    ],
  },
  physiologique: {
    title: "Physiologique / somatique dominante (palpitations, maux de tête, troubles digestifs)",
    recommendations: [
      "Consultation médicale directe recommandée.",
      "Ces signes peuvent indiquer une atteinte du système nerveux autonome.",
      "Arrêt de l'entraînement intensif en attendant le bilan.",
    ],
  },
};
