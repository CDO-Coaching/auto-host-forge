import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dumbbell, 
  Activity, 
  TrendingUp, 
  Scale, 
  Calendar, 
  MessageCircle,
  Target,
  Timer,
  Heart,
  Zap,
  HelpCircle,
  ChevronRight,
  Rocket,
  PlayCircle,
  CheckCircle2,
  Smartphone,
  Bell,
  Stethoscope,
  GraduationCap,
  BookOpen,
  Sparkles,
  ArrowRight,
  Lightbulb,
  FileText
} from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";

interface TutorialStepProps {
  number: number;
  title: string;
  description: string;
  actions: string[];
  tip?: string;
}

function TutorialStep({ number, title, description, actions, tip }: TutorialStepProps) {
  return (
    <div className="relative pl-10 pb-6 last:pb-0">
      {/* Ligne verticale */}
      <div className="absolute left-3 top-8 bottom-0 w-0.5 bg-border last:hidden" />
      
      {/* Numéro */}
      <div className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-sm">
        {number}
      </div>

      <div className="space-y-2">
        <h4 className="font-semibold text-sm sm:text-base">{title}</h4>
        <p className="text-xs sm:text-sm text-muted-foreground">{description}</p>
        
        <ul className="space-y-1.5 mt-2">
          {actions.map((action, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm">
              <ArrowRight className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <span>{action}</span>
            </li>
          ))}
        </ul>

        {tip && (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-primary/5 border border-primary/20 p-2.5">
            <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-foreground/80"><span className="font-medium">Astuce :</span> {tip}</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  details: string[];
  badge?: string;
}

function FeatureCard({ icon, title, description, details, badge }: FeatureCardProps) {
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
            <CardTitle className="text-sm sm:text-base flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 flex-wrap">
                {title}
                {badge && <Badge variant="secondary" className="text-[10px] h-4">{badge}</Badge>}
              </span>
              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`} />
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

// ===== TUTORIEL : PREMIERS PAS =====
const firstStepsTutorial: TutorialStepProps[] = [
  {
    number: 1,
    title: "Complète ton profil",
    description: "Rends-toi dans 'Mon profil' pour renseigner tes informations personnelles.",
    actions: [
      "Ajoute ta date de naissance, taille et poids",
      "Renseigne tes objectifs sportifs",
      "Active les notifications pour ne rien manquer"
    ],
    tip: "Plus ton profil est complet, plus ton coach pourra personnaliser ta programmation."
  },
  {
    number: 2,
    title: "Renseigne tes données de référence",
    description: "Va dans 'Mes max' pour entrer tes performances de base.",
    actions: [
      "Saisis tes 1RM (max sur 1 répétition) sur tes exercices principaux",
      "Renseigne ta VMA (vitesse maximale aérobie) si tu cours",
      "Entre ta FC max et FC repos pour le suivi cardio précis"
    ],
    tip: "Ces données servent à calculer automatiquement tes charges et allures cibles."
  },
  {
    number: 3,
    title: "Installe l'app sur ton téléphone",
    description: "Pour une meilleure expérience, installe l'application en mode PWA.",
    actions: [
      "Sur iPhone : ouvre Safari → Partager → 'Sur l'écran d'accueil'",
      "Sur Android : Chrome → menu → 'Installer l'application'",
      "Tu auras une icône comme une vraie app"
    ],
    tip: "L'installation permet aussi de recevoir les notifications push."
  },
  {
    number: 4,
    title: "Active ton abonnement",
    description: "Pour accéder à tes séances programmées, souscris à un abonnement.",
    actions: [
      "Va dans 'Paiement' depuis le menu",
      "Choisis la formule adaptée à ton coaching",
      "Le paiement est sécurisé via Stripe"
    ]
  }
];

// ===== TUTORIEL : ROUTINE QUOTIDIENNE =====
const dailyRoutineTutorial: TutorialStepProps[] = [
  {
    number: 1,
    title: "Le matin : questionnaire de fatigue",
    description: "Dès le réveil, prends 30 secondes pour évaluer ton état de forme.",
    actions: [
      "Note ton sommeil, stress, fatigue et courbatures (1-7)",
      "Signale d'éventuelles douleurs ou blessures",
      "Active la période d'adaptation si tu te sens trop fatigué"
    ],
    tip: "Cette routine quotidienne permet à ton coach d'adapter tes séances en temps réel."
  },
  {
    number: 2,
    title: "Avant la séance : consulte le programme",
    description: "Ouvre 'Mes séances' pour découvrir ce qui est prévu aujourd'hui.",
    actions: [
      "Lis attentivement les commentaires de ton coach",
      "Visualise les vidéos de démonstration si présentes",
      "Note les charges et le nombre de séries prévus"
    ]
  },
  {
    number: 3,
    title: "Pendant la séance : valide en temps réel",
    description: "Utilise l'app comme ton carnet d'entraînement vivant.",
    actions: [
      "Valide chaque série au fur et à mesure",
      "Ajuste le RPE par série si nécessaire",
      "Le minuteur de récupération se lance automatiquement",
      "Utilise le minuteur universel pour les EMOM/Tabata"
    ],
    tip: "L'écran reste allumé pendant la séance grâce au Wake Lock."
  },
  {
    number: 4,
    title: "Après la séance : valide-la",
    description: "Termine ta séance pour faire remonter les données à ton coach.",
    actions: [
      "Clique sur 'Séance terminée'",
      "Confirme la durée réelle de l'entraînement",
      "Donne ton RPE global (effort ressenti sur 1-10)",
      "Laisse un commentaire si quelque chose à signaler"
    ],
    tip: "Plus tu donnes de feedback, mieux ton coach peut adapter la suite."
  },
  {
    number: 5,
    title: "Le soir : pèse-toi (1x/semaine)",
    description: "Pour suivre ton évolution corporelle.",
    actions: [
      "Va dans 'Mon poids' et enregistre ta valeur",
      "Idéalement le matin à jeun, toujours le même jour",
      "Active le rappel hebdomadaire pour ne pas oublier"
    ]
  }
];

// ===== TUTORIEL : EXPLOITER LES OUTILS =====
const advancedTutorial: TutorialStepProps[] = [
  {
    number: 1,
    title: "Maîtriser le minuteur universel",
    description: "Plusieurs modes pour s'adapter à tous tes formats d'entraînement.",
    actions: [
      "Chronomètre : compte à partir de 0",
      "Compte à rebours : pour les temps fixes",
      "EMOM : signal sonore à chaque minute",
      "Tabata : alternance travail/repos configurable",
      "Mode PiP : garde le timer visible dans une mini-fenêtre"
    ]
  },
  {
    number: 2,
    title: "Communiquer efficacement avec ton coach",
    description: "La messagerie est ton meilleur allié pour progresser.",
    actions: [
      "Pose des questions sur tes exercices via les commentaires",
      "Envoie une vidéo si ton coach te la demande",
      "Utilise la messagerie pour les questions générales",
      "Consulte la section 'Questions' pour les FAQ"
    ]
  },
  {
    number: 3,
    title: "Suivre ta progression",
    description: "Plusieurs outils pour visualiser tes évolutions.",
    actions: [
      "'Mes max' : graphiques de progression par exercice",
      "'Mon poids' : courbe de poids sur différentes périodes",
      "'Suivi fatigue' : analyse de ton état de forme dans le temps",
      "Tableau de bord : résumé de la semaine en cours"
    ],
    tip: "Compare les périodes pour voir tes progrès sur 1 mois, 3 mois ou 1 an."
  },
  {
    number: 4,
    title: "Gérer ton agenda",
    description: "Organise ton emploi du temps sportif.",
    actions: [
      "Visualise tes séances programmées dans la vue mensuelle",
      "Crée des séances personnelles pour t'entraîner librement",
      "Programme tes propres créneaux d'entraînement",
      "Consulte tes rendez-vous avec ton coach"
    ]
  }
];

// ===== FONCTIONNALITÉS DÉTAILLÉES =====
const features: FeatureCardProps[] = [
  {
    icon: <Dumbbell className="h-5 w-5" />,
    title: "Mes séances",
    description: "Consulte et réalise tes entraînements programmés",
    badge: "Essentiel",
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
    description: "Évalue quotidiennement ton état de forme",
    badge: "Quotidien",
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
    icon: <Stethoscope className="h-5 w-5" />,
    title: "Questionnaire SFMS",
    description: "Détecte le surentraînement quand ton coach te le demande",
    badge: "Sur demande",
    details: [
      "Tu reçois une notification quand ton coach demande le questionnaire",
      "Réponds aux questions par oui/non sur 6 dimensions",
      "Obtiens une analyse personnalisée de ton état",
      "Ton coach reçoit un retour détaillé pour t'accompagner",
      "Échange ensuite avec lui via la messagerie pour interpréter"
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
    description: "Visualise ton planning et tes rendez-vous",
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
    description: "Plusieurs modes de minuterie pour tes entraînements",
    details: [
      "Chronomètre classique pour mesurer tes temps",
      "Compte à rebours personnalisable",
      "Mode EMOM (Every Minute On the Minute)",
      "Mode Tabata avec temps de travail et repos configurables",
      "Mode Picture-in-Picture pour garder le timer visible",
      "L'écran reste allumé pendant l'utilisation"
    ]
  },
  {
    icon: <Heart className="h-5 w-5" />,
    title: "Séances cardio",
    description: "Course, vélo ou natation guidées",
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
    description: "Enchaîne plusieurs exercices efficacement",
    details: [
      "Visualise tous les exercices du superset",
      "Avance round par round avec le bouton +",
      "Le timer de récupération se lance automatiquement",
      "Donne ton RPE à la fin du superset complet"
    ]
  },
  {
    icon: <MessageCircle className="h-5 w-5" />,
    title: "Messagerie",
    description: "Reste en contact direct avec ton coach",
    details: [
      "Envoie des messages texte à ton coach",
      "Partage des photos et vidéos",
      "Reçois des notifications de nouveaux messages",
      "Consulte l'historique complet des échanges"
    ]
  },
  {
    icon: <FileText className="h-5 w-5" />,
    title: "Mes factures",
    description: "Accède à tes documents de paiement",
    details: [
      "Consulte la liste de toutes tes factures",
      "Télécharge les factures au format PDF",
      "Vérifie l'historique de tes paiements",
      "Documents conformes pour ta comptabilité"
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
    question: "Comment utiliser le mode Tabata ?",
    answer: "Le Tabata alterne périodes de travail intense et repos courts. Configure le temps de travail (ex: 20s) et de repos (ex: 10s), puis le nombre de rounds. Le timer émet des signaux sonores à chaque transition."
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
    answer: "Pour éviter que ton téléphone ne se mette en veille pendant un exercice, l'application maintient l'écran actif (Wake Lock API). Cela te permet de consulter les instructions sans devoir déverrouiller ton téléphone."
  },
  {
    question: "Qu'est-ce que le mode Picture-in-Picture du timer ?",
    answer: "Le mode PiP affiche le minuteur dans une petite fenêtre flottante qui reste visible même si tu changes d'application. Pratique pour suivre le temps tout en regardant une vidéo ou en consultant tes notes."
  },
  {
    question: "Comment contacter mon coach ?",
    answer: "Utilise la messagerie intégrée accessible depuis le menu. Tu peux aussi laisser des commentaires sur chaque exercice pour poser des questions spécifiques."
  },
  {
    question: "Que faire si je rate une séance ?",
    answer: "Pas de panique ! Tu peux la valider plus tard en sélectionnant la date réelle. Si tu ne peux vraiment pas la faire, signale-le à ton coach via la messagerie pour qu'il puisse adapter la suite."
  },
  {
    question: "Comment installer l'app sur mon téléphone ?",
    answer: "Sur iPhone : ouvre le site dans Safari, appuie sur le bouton Partager puis 'Sur l'écran d'accueil'. Sur Android : ouvre dans Chrome, menu (3 points) → 'Installer l'application'. Tu auras une vraie icône d'app."
  },
  {
    question: "Mes données sont-elles sécurisées ?",
    answer: "Oui, toutes tes données sont stockées de manière sécurisée et chiffrée. Seul ton coach et toi y avez accès. Tu peux consulter notre politique RGPD pour plus de détails."
  }
];

export default function Aide() {
  const { profile } = useUserProfile();
  const firstName = profile?.first_name || "champion";

  return (
    <div className="w-full min-h-screen overflow-x-hidden">
      <div className="space-y-6 pb-6 px-3 sm:px-4 max-w-5xl mx-auto">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <GraduationCap className="h-5 w-5" />
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Tutoriel & Guide d'utilisation</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Salut {firstName} ! Voici ton guide complet pour maîtriser l'application de A à Z 🚀
          </p>
        </div>

        {/* Carte d'introduction */}
        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-semibold text-sm sm:text-base">Bienvenue dans ton espace d'entraînement !</p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Cette application est ton compagnon quotidien pour atteindre tes objectifs sportifs. 
                  Suis ce tutoriel pour découvrir étape par étape comment tirer le meilleur de chaque fonctionnalité.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tutoriel principal avec onglets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Tutoriel pas à pas
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Trois parcours pour apprendre l'application selon ton niveau
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="debutant" className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-auto">
                <TabsTrigger value="debutant" className="text-xs sm:text-sm py-2 flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
                  <Rocket className="h-4 w-4" />
                  <span>Débuter</span>
                </TabsTrigger>
                <TabsTrigger value="quotidien" className="text-xs sm:text-sm py-2 flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
                  <PlayCircle className="h-4 w-4" />
                  <span>Au quotidien</span>
                </TabsTrigger>
                <TabsTrigger value="avance" className="text-xs sm:text-sm py-2 flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span>Aller plus loin</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="debutant" className="mt-6">
                <div className="mb-4 p-3 rounded-lg bg-muted/50">
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">🎯 Objectif :</span> Configurer ton compte et préparer ton environnement d'entraînement
                  </p>
                </div>
                <div className="space-y-1">
                  {firstStepsTutorial.map((step) => (
                    <TutorialStep key={step.number} {...step} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="quotidien" className="mt-6">
                <div className="mb-4 p-3 rounded-lg bg-muted/50">
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">🎯 Objectif :</span> Adopter les bonnes habitudes pour progresser efficacement
                  </p>
                </div>
                <div className="space-y-1">
                  {dailyRoutineTutorial.map((step) => (
                    <TutorialStep key={step.number} {...step} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="avance" className="mt-6">
                <div className="mb-4 p-3 rounded-lg bg-muted/50">
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">🎯 Objectif :</span> Exploiter toutes les fonctionnalités pour optimiser ta progression
                  </p>
                </div>
                <div className="space-y-1">
                  {advancedTutorial.map((step) => (
                    <TutorialStep key={step.number} {...step} />
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Section : Bonnes pratiques */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Les 5 règles d'or
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Pour tirer le meilleur de l'application et de ton coaching
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { icon: <Bell className="h-4 w-4" />, title: "Réponds tous les jours au questionnaire de fatigue", desc: "30 secondes par jour pour un suivi optimal" },
              { icon: <CheckCircle2 className="h-4 w-4" />, title: "Valide tes séances en temps réel", desc: "Ne remplis pas tout à la fin, fais-le série par série" },
              { icon: <MessageCircle className="h-4 w-4" />, title: "Communique avec ton coach", desc: "Pose des questions, partage tes ressentis, signale les douleurs" },
              { icon: <Smartphone className="h-4 w-4" />, title: "Installe l'app sur ton téléphone", desc: "Plus pratique et tu reçois les notifications" },
              { icon: <Target className="h-4 w-4" />, title: "Sois honnête sur ton RPE", desc: "C'est ce qui permet à ton coach d'ajuster la programmation" }
            ].map((rule, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                  {rule.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{rule.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{rule.desc}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Section fonctionnalités détaillées */}
        <div className="space-y-3">
          <div>
            <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Toutes les fonctionnalités en détail
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Clique sur une fonctionnalité pour en savoir plus
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {features.map((feature, index) => (
              <FeatureCard key={index} {...feature} />
            ))}
          </div>
        </div>

        {/* Section FAQ */}
        <div className="space-y-3">
          <div>
            <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Questions fréquentes
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Les réponses aux questions les plus courantes
            </p>
          </div>
          <Card>
            <CardContent className="p-0">
              <Accordion type="single" collapsible className="w-full">
                {faqItems.map((item, index) => (
                  <AccordionItem key={index} value={`item-${index}`} className="border-b last:border-b-0 px-4">
                    <AccordionTrigger className="py-3 text-left text-xs sm:text-sm hover:no-underline">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-3 text-xs sm:text-sm text-muted-foreground">
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
                <p className="font-medium text-sm">Une question qui n'est pas dans la liste ?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  N'hésite pas à contacter ton coach via la messagerie ou à lui en parler lors de ton prochain rendez-vous. 
                  Il est là pour t'accompagner !
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
