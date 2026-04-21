import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, X, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  SFMS_DIMENSIONS,
  type SfmsDimension,
} from "@/lib/sfmsQuestions";
import {
  getScoreRecommendation,
  DIMENSION_RECOMMENDATIONS,
} from "@/lib/sfmsRecommendations";

interface CoachSfmsAlertProps {
  athleteId: string;
  athleteName: string;
}

interface SfmsResult {
  id: string;
  completed_at: string;
  total_score: number;
  score_fatigue_physique: number;
  score_performance: number;
  score_psychologique: number;
  score_cognitif: number;
  score_sommeil_appetit: number;
  score_physiologique: number;
}

const DIMENSION_TOTALS: Record<SfmsDimension, number> = {
  fatigue_physique: 7,
  performance: 8,
  psychologique: 14,
  cognitif: 5,
  sommeil_appetit: 6,
  physiologique: 14,
};

const DIMENSION_KEYS: SfmsDimension[] = [
  "fatigue_physique",
  "performance",
  "psychologique",
  "cognitif",
  "sommeil_appetit",
  "physiologique",
];

export function CoachSfmsAlert({ athleteId, athleteName }: CoachSfmsAlertProps) {
  const [result, setResult] = useState<SfmsResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("sfms_questionnaire_results")
        .select(
          "id, completed_at, total_score, score_fatigue_physique, score_performance, score_psychologique, score_cognitif, score_sommeil_appetit, score_physiologique"
        )
        .eq("athlete_id", athleteId)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (error || !data) return;
      const key = `sfms_alert_dismissed_${athleteId}_${data.id}`;
      if (localStorage.getItem(key) === "true") {
        setDismissed(true);
      }
      setResult(data as SfmsResult);
    })();
    return () => {
      active = false;
    };
  }, [athleteId]);

  if (!result || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(`sfms_alert_dismissed_${athleteId}_${result.id}`, "true");
    setDismissed(true);
  };

  const scoreRec = getScoreRecommendation(result.total_score);

  // Calculer les ratios par dimension
  const scoresByDim: Record<SfmsDimension, number> = {
    fatigue_physique: result.score_fatigue_physique,
    performance: result.score_performance,
    psychologique: result.score_psychologique,
    cognitif: result.score_cognitif,
    sommeil_appetit: result.score_sommeil_appetit,
    physiologique: result.score_physiologique,
  };

  const sortedDimensions = DIMENSION_KEYS.map((k) => ({
    key: k,
    raw: scoresByDim[k],
    total: DIMENSION_TOTALS[k],
    ratio: DIMENSION_TOTALS[k] > 0 ? scoresByDim[k] / DIMENSION_TOTALS[k] : 0,
  }))
    .filter((d) => d.raw > 0)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 2);

  const levelStyles: Record<string, string> = {
    ok: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    watch: "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
    alert: "border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    critical: "border-destructive/50 bg-destructive/10 text-destructive",
  };

  const completedDate = new Date(result.completed_at).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Alert className={`mb-4 relative ${levelStyles[scoreRec.level]}`}>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>

      {scoreRec.level === "ok" ? (
        <ClipboardCheck className="h-5 w-5" />
      ) : (
        <AlertTriangle className="h-5 w-5" />
      )}

      <AlertTitle className="font-semibold pr-8">
        Questionnaire surentraînement (SFMS) — {athleteName}
      </AlertTitle>

      <AlertDescription className="mt-2 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-semibold">
            Score : {result.total_score}/54
          </Badge>
          <Badge variant="outline">{scoreRec.title}</Badge>
          <span className="text-xs opacity-80">Réalisé le {completedDate}</span>
        </div>

        <div>
          <p className="font-semibold mb-1">Recommandations selon le score global :</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {scoreRec.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>

        {sortedDimensions.length > 0 && (
          <>
            <Separator className="opacity-50" />
            <div className="space-y-3">
              <p className="font-semibold">
                Dimension{sortedDimensions.length > 1 ? "s" : ""} dominante
                {sortedDimensions.length > 1 ? "s" : ""} :
              </p>
              {sortedDimensions.map((dim, idx) => {
                const rec = DIMENSION_RECOMMENDATIONS[dim.key];
                return (
                  <div key={dim.key} className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        #{idx + 1}
                      </Badge>
                      <span className="font-medium">{rec.title}</span>
                      <span className="text-xs opacity-80">
                        ({dim.raw}/{dim.total} — {Math.round(dim.ratio * 100)}%)
                      </span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-sm pl-2">
                      {rec.recommendations.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}
