import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Dumbbell, 
  Activity, 
  TrendingUp, 
  Scale, 
  Calendar, 
  Clock, 
  MessageCircle,
  Target,
  Timer,
  Heart,
  Zap,
  HelpCircle,
  ChevronRight
} from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  details: string[];
}

function FeatureCard({ icon, title, description, details }: FeatureCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:shadow-md ${expanded ? 'ring-1 ring-primary/30' : ''}`}
      onClick={() => setExpanded(!expanded)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm sm:text-base flex items-center justify-between">
              {title}
              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <ul className="space-y-1.5 text-xs sm:text-sm text-muted-foreground">
            {details.map((detail, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                {detail}
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}

const features: FeatureCardProps[] = [
  {
    icon: <Dumbbell className="h-5 w-5" />,
    title: "Mes séances",
    description: "Consulte et réalise tes entraînements programmés par ton coach",
    details: [
      "Visualise ta semaine d'entraînement en cours",
      "Accède aux détails de chaque exercice (séries, répétitions, récupération)",
      "Suis les instructions et commentaires de ton coach",
      "Valide tes exercices au fur et à mesure",
      "Donne ton RPE (effort ressenti) à la fin de chaque séance",
      "Laisse des commentaires sur tes exercices pour ton coach"
    ]
  },
  {
    icon: <Activity className="h-5 w-5" />,
    title: "Suivi de fatigue",
    description: "Évalue quotidiennement ton état de forme pour optimiser tes performances",
    details: [
      "Réponds au questionnaire quotidien (fatigue, courbatures, sommeil, stress)",
      "Signale tes douleurs et blessures pour alerter ton coach",
      "Visualise l'évolution de ton score de fatigue sur plusieurs périodes",
      "Active/désactive la période d'adaptation si nécessaire",
      "Consulte les graphiques détaillés par métrique",
      "Modifie tes réponses passées si besoin"
    ]
  },
  {
    icon: <TrendingUp className="h-5 w-5" />,
    title: "Mes max",
    description: "Suis l'évolution de tes performances maximales",
    details: [
      "Consulte ton historique de max sur chaque exercice",
      "Visualise ta progression avec des graphiques",
      "Renseigne ta VMA pour le calcul des allures en course",
      "Entre ta FC max et FC repos pour le suivi cardio",
      "Compare tes performances dans le temps"
    ]
  },
  {
    icon: <Scale className="h-5 w-5" />,
    title: "Mon poids",
    description: "Suis l'évolution de ton poids corporel",
    details: [
      "Enregistre ton poids régulièrement",
      "Visualise ta courbe de poids sur différentes périodes",
      "Reçois un rappel hebdomadaire si tu l'actives",
      "Partage automatiquement les données avec ton coach"
    ]
  },
  {
    icon: <Calendar className="h-5 w-5" />,
    title: "Mon agenda",
    description: "Visualise ton planning d'entraînement et tes rendez-vous",
    details: [
      "Consulte le calendrier mensuel de tes séances",
      "Vois tes rendez-vous programmés avec ton coach",
      "Identifie rapidement les séances effectuées (en vert)",
      "Crée des séances personnelles si tu t'entraînes seul"
    ]
  },
  {
    icon: <Timer className="h-5 w-5" />,
    title: "Minuteur universel",
    description: "Utilise différents modes de minuterie pendant tes entraînements",
    details: [
      "Chronomètre classique pour mesurer tes temps",
      "Compte à rebours personnalisable",
      "Mode EMOM (Every Minute On the Minute)",
      "Mode Tabata avec temps de travail et repos configurables",
      "L'écran reste allumé pendant l'utilisation"
    ]
  },
  {
    icon: <Heart className="h-5 w-5" />,
    title: "Séances cardio",
    description: "Réalise tes séances de course, vélo ou natation",
    details: [
      "Suis les étapes programmées par ton coach",
      "Visualise les allures cibles basées sur ta VMA",
      "Entre tes données réelles après la séance (distance, durée, FC)",
      "Compare tes performances prévues vs réalisées"
    ]
  },
  {
    icon: <Zap className="h-5 w-5" />,
    title: "Supersets",
    description: "Enchaîne les exercices en superset efficacement",
    details: [
      "Visualise tous les exercices du superset",
      "Avance round par round avec le bouton +",
      "Le timer de récupération se lance automatiquement",
      "Donne ton RPE à la fin du superset complet"
    ]
  }
];

const faqItems = [
  {
    question: "Comment valider une séance ?",
    answer: "À la fin de chaque exercice ou séance, tu dois donner un RPE (Rating of Perceived Exertion) entre 1 et 10 qui représente l'effort ressenti. Clique sur 'Séance terminée' puis entre ton RPE et la date de réalisation."
  },
  {
    question: "Que signifie le RPE ?",
    answer: "Le RPE (Rating of Perceived Exertion) est une échelle de 1 à 10 pour évaluer l'intensité de ton effort. 1 = très facile, 5 = modéré, 8 = difficile, 10 = effort maximal. Ton coach utilise ces données pour adapter ta programmation."
  },
  {
    question: "Comment signaler une douleur ou blessure ?",
    answer: "Dans le questionnaire quotidien de fatigue, active le suivi des douleurs dans les paramètres. Tu pourras ensuite indiquer l'emplacement et l'intensité de ta douleur. Ton coach sera automatiquement alerté."
  },
  {
    question: "Comment fonctionne le suivi de fatigue ?",
    answer: "Chaque jour, réponds au questionnaire en évaluant ta fatigue, tes courbatures, ton sommeil et ton stress sur une échelle de 1 à 7. Le score total (entre 4 et 28) indique ton état de forme : plus il est bas, mieux tu te portes !"
  },
  {
    question: "Qu'est-ce que la période d'adaptation ?",
    answer: "Si tu traverses une période où tu dois réduire l'intensité (fatigue, stress, retour de blessure...), active la période d'adaptation dans le questionnaire. Choisis le niveau (légère, moyenne, grosse) pour que ton coach adapte ta programmation."
  },
  {
    question: "Comment créer une séance personnelle ?",
    answer: "Dans 'Mon agenda', clique sur le '+' pour créer une séance personnelle. Tu peux noter le type d'activité, la durée et tes commentaires. Ces séances apparaîtront dans ton historique."
  },
  {
    question: "Comment utiliser le minuteur EMOM ?",
    answer: "EMOM signifie 'Every Minute On the Minute'. Lance le minuteur depuis l'icône horloge. À chaque nouvelle minute, un signal sonore retentit. Tu dois réaliser les répétitions demandées puis te reposer jusqu'à la minute suivante."
  },
  {
    question: "Comment modifier mes données de fatigue passées ?",
    answer: "Dans la page 'Suivi fatigue', clique sur l'icône crayon à côté d'une entrée dans l'historique. Tu pourras modifier toutes les valeurs et enregistrer les changements."
  },
  {
    question: "Comment renseigner ma VMA ?",
    answer: "Va dans 'Mes max' et trouve la section VMA. Entre ta valeur en km/h. Cette donnée est utilisée pour calculer tes allures cibles en séances de course à pied."
  },
  {
    question: "Pourquoi l'écran reste allumé pendant les séances ?",
    answer: "Pour éviter que ton téléphone ne se mette en veille pendant un exercice, l'application maintient l'écran actif. Cela te permet de consulter les instructions sans devoir déverrouiller ton téléphone."
  },
  {
    question: "Comment contacter mon coach ?",
    answer: "Utilise la messagerie intégrée accessible depuis le menu. Tu peux aussi laisser des commentaires sur chaque exercice pour poser des questions spécifiques."
  }
];

export default function Aide() {
  const { profile } = useUserProfile();
  const firstName = profile?.first_name || "champion";

  return (
    <div className="w-full min-h-screen overflow-x-hidden">
      <div className="space-y-6 pb-6 px-3 sm:px-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Aide & Fonctionnalités</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {firstName}, découvre tout ce que tu peux faire avec l'application
          </p>
        </div>

        {/* Section fonctionnalités */}
        <div className="space-y-3">
          <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            Fonctionnalités
          </h2>
          <div className="grid gap-3">
            {features.map((feature, index) => (
              <FeatureCard key={index} {...feature} />
            ))}
          </div>
        </div>

        {/* Section FAQ */}
        <div className="space-y-3">
          <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
            <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            Questions fréquentes
          </h2>
          <Card>
            <CardContent className="p-0">
              <Accordion type="single" collapsible className="w-full">
                {faqItems.map((item, index) => (
                  <AccordionItem key={index} value={`item-${index}`} className="border-b last:border-b-0">
                    <AccordionTrigger className="px-4 py-3 text-left text-xs sm:text-sm hover:no-underline">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-3 text-xs sm:text-sm text-muted-foreground">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>

        {/* Contact */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <MessageCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Besoin d'aide ?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Si tu as d'autres questions, n'hésite pas à contacter ton coach via la messagerie ou à lui en parler lors de ton prochain rendez-vous !
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}