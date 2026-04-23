import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dumbbell,
  Activity,
  TrendingUp,
  Scale,
  Calendar,
  MessageCircle,
  Timer,
  Heart,
  HelpCircle,
  Smartphone,
  Bell,
  Stethoscope,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  User,
  Zap,
  Target,
  RotateCcw,
  Lightbulb,
  ExternalLink,
} from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";

interface Step {
  icon: React.ReactNode;
  badge: string;
  title: string;
  description: string;
  tip?: string;
  testRoute?: string;
  testLabel?: string;
}

const STORAGE_KEY = "aide-tutorial-step";

export default function Aide() {
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const firstName = profile?.first_name || "champion";
  const [currentStep, setCurrentStep] = useState(0);

  // Restaurer l'étape depuis localStorage au chargement
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed)) setCurrentStep(parsed);
    }
  }, []);

  // Sauvegarder l'étape dès qu'elle change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, currentStep.toString());
  }, [currentStep]);

  const steps: Step[] = [
    {
      icon: <Sparkles className="h-8 w-8" />,
      badge: "Bienvenue",
      title: `Salut ${firstName} ! 👋`,
      description:
        "On va découvrir ensemble l'application, étape par étape. Prends le temps de bien comprendre chaque écran avant de passer au suivant.",
      tip: "Tu peux revenir à ce tutoriel à tout moment, on reprendra exactement là où tu t'étais arrêté.",
    },
    {
      icon: <User className="h-8 w-8" />,
      badge: "Étape 1 — Profil",
      title: "Complète ton profil",
      description:
        "Rends-toi dans 'Mon profil' pour renseigner tes informations personnelles : date de naissance, taille, poids et objectifs.",
      tip: "Plus ton profil est complet, mieux ton coach pourra te suivre.",
      testRoute: "/sportif/profil",
      testLabel: "Aller à Mon profil",
    },
    {
      icon: <TrendingUp className="h-8 w-8" />,
      badge: "Étape 2 — Tes données",
      title: "Renseigne tes max",
      description:
        "Dans 'Mes max', entre tes performances de référence : tes 1RM en force, ta VMA si tu cours, ta FC max et FC repos.",
      tip: "Ces valeurs seront utiles à ton coach pour personnaliser ta programmation. Si tu ne les connais pas, pas de souci, tu pourras les voir plus tard avec lui.",
      testRoute: "/sportif/maxes",
      testLabel: "Aller à Mes max",
    },
    {
      icon: <Smartphone className="h-8 w-8" />,
      badge: "Étape 3 — Installation",
      title: "Installe l'app sur ton téléphone",
      description:
        "Sur iPhone : Safari → Partager → 'Sur l'écran d'accueil'. Sur Android : Chrome → menu → 'Installer l'application'.",
      tip: "Tu auras une vraie icône d'app sur ton écran d'accueil.",
    },
    {
      icon: <Activity className="h-8 w-8" />,
      badge: "Étape 4 — Quotidien",
      title: "Fais ton check-up tous les matins",
      description:
        "Chaque jour, ouvre 'Suivi fatigue' et note ton sommeil, ton stress, ta fatigue et tes courbatures sur 7.",
      tip: "30 secondes par jour suffisent et permettent à ton coach d'adapter tes séances.",
      testRoute: "/sportif/fatigue",
      testLabel: "Aller au Suivi fatigue",
    },
    {
      icon: <Dumbbell className="h-8 w-8" />,
      badge: "Étape 5 — Séances",
      title: "Consulte ta séance du jour",
      description:
        "Dans 'Mes séances', tu verras le programme prévu par ton coach : exercices, séries, répétitions, charges et commentaires.",
      tip: "Lis bien les commentaires de ton coach avant de commencer.",
      testRoute: "/sportif/seances",
      testLabel: "Aller à Mes séances",
    },
    {
      icon: <CheckCircle2 className="h-8 w-8" />,
      badge: "Étape 6 — Validation",
      title: "Valide chaque série en temps réel",
      description:
        "Pendant l'entraînement, valide chaque série dès qu'elle est terminée. Le minuteur de récupération se lance automatiquement.",
      tip: "Ne remplis pas tout à la fin : fais-le série par série pour ne rien oublier.",
      testRoute: "/sportif/seances",
      testLabel: "Voir Mes séances",
    },
    {
      icon: <Target className="h-8 w-8" />,
      badge: "Étape 7 — RPE",
      title: "Donne ton RPE après chaque exercice",
      description:
        "Le RPE (effort ressenti) va de 1 à 10. 1 = très facile, 5 = modéré, 8 = difficile, 10 = effort maximal.",
      tip: "Sois honnête : c'est ce qui permet à ton coach d'ajuster la suite.",
    },
    {
      icon: <Timer className="h-8 w-8" />,
      badge: "Étape 8 — Minuteur",
      title: "Utilise le minuteur universel",
      description:
        "Plusieurs modes disponibles : chronomètre, compte à rebours, EMOM (signal chaque minute), Tabata (travail/repos).",
      tip: "L'écran reste allumé pendant ta séance pour ne pas te bloquer.",
    },
    {
      icon: <Heart className="h-8 w-8" />,
      badge: "Étape 9 — Cardio",
      title: "Réalise tes séances cardio",
      description:
        "Pour la course, le vélo ou la natation, suis les étapes programmées avec les allures cibles, puis enregistre tes données réelles.",
      tip: "Tes performances prévues vs réalisées s'affichent côte à côte.",
      testRoute: "/sportif/seances",
      testLabel: "Voir Mes séances",
    },
    {
      icon: <Zap className="h-8 w-8" />,
      badge: "Étape 10 — Supersets",
      title: "Enchaîne les supersets",
      description:
        "Pour les supersets, avance round par round avec le bouton +. Donne ton RPE uniquement à la fin du superset complet.",
    },
    {
      icon: <CheckCircle2 className="h-8 w-8" />,
      badge: "Étape 11 — Fin de séance",
      title: "Termine et valide ta séance",
      description:
        "Clique sur 'Séance terminée', confirme la durée réelle et donne ton RPE global. Laisse un commentaire si besoin.",
      tip: "C'est obligatoire pour que ton coach voie que la séance est faite.",
    },
    {
      icon: <Scale className="h-8 w-8" />,
      badge: "Étape 12 — Poids",
      title: "Pèse-toi une fois par semaine",
      description:
        "Dans 'Mon poids', enregistre ta valeur. Idéalement le matin à jeun, toujours le même jour de la semaine.",
      tip: "Active le rappel hebdomadaire pour ne pas oublier.",
      testRoute: "/sportif/poids",
      testLabel: "Aller à Mon poids",
    },
    {
      icon: <Calendar className="h-8 w-8" />,
      badge: "Étape 13 — Agenda",
      title: "Organise ton planning",
      description:
        "'Mon agenda' affiche le calendrier de tes séances et rendez-vous. Les séances faites apparaissent en vert.",
      tip: "Tu peux aussi créer des séances personnelles avec le bouton +.",
      testRoute: "/sportif/agenda",
      testLabel: "Aller à Mon agenda",
    },
    {
      icon: <Stethoscope className="h-8 w-8" />,
      badge: "Étape 14 — SFMS",
      title: "Questionnaire de surentraînement",
      description:
        "Quand ton coach te le demande, tu reçois un questionnaire SFMS pour détecter une éventuelle fatigue excessive.",
      tip: "Échange ensuite avec ton coach pour interpréter le résultat ensemble.",
    },
    {
      icon: <Bell className="h-8 w-8" />,
      badge: "Étape 15 — Alertes",
      title: "Signale tes douleurs",
      description:
        "Dans le questionnaire de fatigue, active le suivi des douleurs pour indiquer leur emplacement et leur intensité.",
      tip: "Ton coach est automatiquement alerté pour adapter ta programmation.",
      testRoute: "/sportif/fatigue",
      testLabel: "Aller au Suivi fatigue",
    },
    {
      icon: <RotateCcw className="h-8 w-8" />,
      badge: "Étape 16 — Adaptation",
      title: "Active la période d'adaptation",
      description:
        "Si tu es fatigué, stressé ou en retour de blessure, active la période d'adaptation (légère, moyenne ou grosse).",
      tip: "Ton coach adaptera l'intensité de ta programmation en conséquence.",
    },
    {
      icon: <MessageCircle className="h-8 w-8" />,
      badge: "Étape 17 — Échange",
      title: "Communique avec ton coach",
      description:
        "Utilise la messagerie pour les questions générales, ou laisse un commentaire directement sur un exercice pour une question précise.",
      tip: "Plus tu communiques, mieux ton coach peut t'accompagner.",
      testRoute: "/sportif/messagerie",
      testLabel: "Aller à la Messagerie",
    },
    {
      icon: <Sparkles className="h-8 w-8" />,
      badge: "Bravo !",
      title: "Tu es prêt à progresser 🎉",
      description:
        "Tu connais maintenant l'essentiel de l'application. La clé du succès : régularité, honnêteté dans tes RPE, et communication avec ton coach.",
      tip: "Reviens dans ce tutoriel à tout moment si tu as un doute.",
    },
  ];

  const totalSteps = steps.length;
  const step = steps[currentStep];
  const progress = ((currentStep + 1) / totalSteps) * 100;
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  const handleReset = () => {
    setCurrentStep(0);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="w-full min-h-screen overflow-x-hidden">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header avec progression */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="font-medium text-muted-foreground">
              {currentStep + 1} / {totalSteps}
            </span>
            <button
              onClick={handleReset}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Recommencer
            </button>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Carte principale */}
        <Card className="border-2 border-primary/20 shadow-lg">
          <CardContent className="p-6 sm:p-10 space-y-6">
            {/* Badge */}
            <div className="flex justify-center">
              <Badge variant="secondary" className="text-xs">
                {step.badge}
              </Badge>
            </div>

            {/* Icône */}
            <div className="flex justify-center">
              <div className="p-5 rounded-full bg-primary/10 text-primary">
                {step.icon}
              </div>
            </div>

            {/* Titre */}
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-center text-balance">
              {step.title}
            </h1>

            {/* Description */}
            <p className="text-sm sm:text-base text-muted-foreground text-center text-balance leading-relaxed">
              {step.description}
            </p>

            {/* Astuce */}
            {step.tip && (
              <div className="flex items-start gap-3 rounded-lg bg-primary/5 border border-primary/20 p-4">
                <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm text-foreground/80">
                  <span className="font-semibold">Astuce :</span> {step.tip}
                </p>
              </div>
            )}

            {/* Bouton Tester la fonctionnalité */}
            {step.testRoute && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  className="w-full border-primary/40 hover:bg-primary/5"
                  onClick={() => navigate(step.testRoute!)}
                >
                  <ExternalLink className="h-4 w-4" />
                  {step.testLabel || "Tester maintenant"}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center mt-2">
                  Reviens ici quand tu veux, tu reprendras à cette étape.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={isFirst}
            className="flex-1 sm:flex-none"
          >
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </Button>

          {/* Indicateurs (points) */}
          <div className="hidden sm:flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentStep
                    ? "w-6 bg-primary"
                    : idx < currentStep
                      ? "w-1.5 bg-primary/40"
                      : "w-1.5 bg-muted"
                }`}
                aria-label={`Aller à l'étape ${idx + 1}`}
              />
            ))}
          </div>

          {isLast ? (
            <Button onClick={handleReset} className="flex-1 sm:flex-none">
              <RotateCcw className="h-4 w-4" />
              Recommencer
            </Button>
          ) : (
            <Button
              onClick={() => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1))}
              className="flex-1 sm:flex-none"
            >
              Suivant
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
