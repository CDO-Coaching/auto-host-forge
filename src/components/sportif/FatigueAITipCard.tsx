import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";

interface Log {
  date: string;
  fatigue: number;
  courbatures: number;
  sommeil: number;
  stress: number;
  score_total: number;
}

/**
 * Conseil du jour basé sur les 4-7 derniers jours de fatigue.
 * Heuristique simple côté client (pas d'IA pour rester gratuit / instantané).
 */
export function FatigueAITipCard({ logs }: { logs: Log[] }) {
  const tip = useMemo(() => {
    const window = logs.slice(0, 7);
    if (window.length < 3) {
      return {
        title: "Continue à remplir ton suivi",
        body: "Encore quelques jours et je pourrai te donner une recommandation personnalisée.",
        tone: "neutral" as const,
      };
    }
    const avg = (k: keyof Log) =>
      window.reduce((s, l) => s + (Number(l[k]) || 0), 0) / window.length;
    const sleep = avg("sommeil");
    const fatigue = avg("fatigue");
    const muscle = avg("courbatures");
    const stress = avg("stress");
    const total = avg("score_total");

    if (sleep >= 5)
      return {
        title: "Ton sommeil se dégrade",
        body: "Vise 8h de sommeil cette nuit et coupe les écrans 30 min avant le coucher. Demain, garde l'intensité modérée (RPE ≤ 7).",
        tone: "warning" as const,
      };
    if (muscle >= 5)
      return {
        title: "Courbatures importantes",
        body: "Privilégie un travail technique léger ou une séance de mobilité aujourd'hui. Hydrate-toi bien.",
        tone: "warning" as const,
      };
    if (stress >= 5)
      return {
        title: "Stress élevé",
        body: "Pense à 10 minutes de méditation ou de cohérence cardiaque avant ta prochaine séance.",
        tone: "warning" as const,
      };
    if (total >= 20)
      return {
        title: "Fatigue globale élevée",
        body: "Réduis le volume cette semaine de 20-30% et prévois 1 jour de récupération active.",
        tone: "warning" as const,
      };
    if (fatigue <= 2 && total <= 12)
      return {
        title: "Excellente forme !",
        body: "C'est le moment idéal pour pousser un peu plus fort sur ta prochaine séance ou tester un nouveau record.",
        tone: "positive" as const,
      };
    return {
      title: "Forme correcte",
      body: "Continue sur ce rythme. Reste à l'écoute de tes sensations en début de séance.",
      tone: "neutral" as const,
    };
  }, [logs]);

  const toneClasses =
    tip.tone === "warning"
      ? "border-orange-500/30 bg-orange-500/5"
      : tip.tone === "positive"
      ? "border-green-500/30 bg-green-500/5"
      : "border-primary/20 bg-primary/5";
  const iconColor =
    tip.tone === "warning"
      ? "text-orange-500"
      : tip.tone === "positive"
      ? "text-green-500"
      : "text-primary";

  return (
    <Card className={toneClasses}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <Lightbulb className={`h-5 w-5 mt-0.5 shrink-0 ${iconColor}`} />
          <div className="min-w-0">
            <p className="font-semibold text-sm sm:text-base">{tip.title}</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{tip.body}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
