import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { SFMS_DIMENSIONS, type SfmsDimension } from "@/lib/sfmsQuestions";
import { getScoreRecommendation, DIMENSION_RECOMMENDATIONS } from "@/lib/sfmsRecommendations";

interface AthleteSfmsResultsProps {
  athleteId: string;
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

const levelStyles: Record<string, string> = {
  ok: "border-emerald-500/40 bg-emerald-500/5",
  watch: "border-yellow-500/40 bg-yellow-500/5",
  alert: "border-orange-500/40 bg-orange-500/5",
  critical: "border-destructive/40 bg-destructive/5",
};

const levelBadge: Record<string, string> = {
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  watch: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
  alert: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

export function AthleteSfmsResults({ athleteId }: AthleteSfmsResultsProps) {
  const [results, setResults] = useState<SfmsResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!athleteId) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("sfms_questionnaire_results")
        .select(
          "id, completed_at, total_score, score_fatigue_physique, score_performance, score_psychologique, score_cognitif, score_sommeil_appetit, score_physiologique"
        )
        .eq("athlete_id", athleteId)
        .order("completed_at", { ascending: false })
        .limit(2);
      if (!active) return;
      if (!error && data) setResults(data as SfmsResult[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [athleteId]);

  if (loading || results.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          Mes derniers questionnaires de surentraînement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {results.map((r) => {
          const rec = getScoreRecommendation(r.total_score);
          const scoresByDim: Record<SfmsDimension, number> = {
            fatigue_physique: r.score_fatigue_physique,
            performance: r.score_performance,
            psychologique: r.score_psychologique,
            cognitif: r.score_cognitif,
            sommeil_appetit: r.score_sommeil_appetit,
            physiologique: r.score_physiologique,
          };
          const sortedDims = DIMENSION_KEYS.map((k) => ({
            key: k,
            raw: scoresByDim[k],
            total: DIMENSION_TOTALS[k],
            ratio: DIMENSION_TOTALS[k] > 0 ? scoresByDim[k] / DIMENSION_TOTALS[k] : 0,
          }))
            .filter((d) => d.raw > 0)
            .sort((a, b) => b.ratio - a.ratio)
            .slice(0, 2);

          return (
            <div key={r.id} className={`rounded-lg border p-4 space-y-3 ${levelStyles[rec.level]}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {format(new Date(r.completed_at), "EEEE d MMMM yyyy 'à' HH'h'mm", { locale: fr })}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="font-semibold">
                    Score : {r.total_score}/54
                  </Badge>
                  <Badge variant="outline" className={levelBadge[rec.level]}>
                    {rec.title}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold mb-1">Recommandations :</p>
                <ul className="list-disc list-inside space-y-0.5 text-sm text-muted-foreground">
                  {rec.recommendations.map((txt, i) => (
                    <li key={i}>{txt}</li>
                  ))}
                </ul>
              </div>

              {sortedDims.length > 0 && (
                <>
                  <Separator className="opacity-50" />
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">
                      Dimension{sortedDims.length > 1 ? "s" : ""} dominante
                      {sortedDims.length > 1 ? "s" : ""} :
                    </p>
                    {sortedDims.map((dim, idx) => {
                      const drec = DIMENSION_RECOMMENDATIONS[dim.key];
                      return (
                        <div key={dim.key} className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-xs">
                              #{idx + 1}
                            </Badge>
                            <span className="text-sm font-medium">{drec.title}</span>
                            <span className="text-xs text-muted-foreground">
                              ({dim.raw}/{dim.total} — {Math.round(dim.ratio * 100)}%)
                            </span>
                          </div>
                          <ul className="list-disc list-inside space-y-0.5 text-sm text-muted-foreground pl-2">
                            {drec.recommendations.map((txt, i) => (
                              <li key={i}>{txt}</li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
