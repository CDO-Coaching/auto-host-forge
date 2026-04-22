import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getScoreRecommendation } from "@/lib/sfmsRecommendations";

interface AthleteSfmsResultsProps {
  athleteId: string;
}

interface SfmsResult {
  id: string;
  completed_at: string;
  total_score: number;
}

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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!athleteId) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("sfms_questionnaire_results")
        .select("id, completed_at, total_score")
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
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full text-left">
          <CardHeader className="hover:bg-muted/40 transition-colors rounded-t-lg">
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                Mes derniers questionnaires de surentraînement
              </span>
              <ChevronDown
                className={`h-5 w-5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
              />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3">
            {results.map((r) => {
              const rec = getScoreRecommendation(r.total_score);
              return (
                <div key={r.id} className={`rounded-lg border p-4 ${levelStyles[rec.level]}`}>
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
                </div>
              );
            })}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
