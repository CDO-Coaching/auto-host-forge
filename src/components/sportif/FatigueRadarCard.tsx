import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

interface Log {
  date: string;
  fatigue: number;
  courbatures: number;
  sommeil: number;
  stress: number;
}

/**
 * Radar hebdomadaire de l'état de forme.
 * Les valeurs sont normalisées en "fraicheur" (7 = top, 1 = mauvais)
 * pour que plus le polygone est grand = meilleur état.
 */
export function FatigueRadarCard({ logs }: { logs: Log[] }) {
  const data = useMemo(() => {
    const last7 = logs.slice(0, 7);
    if (last7.length === 0) return [];
    const avg = (k: keyof Log) =>
      last7.reduce((s, l) => s + (Number(l[k]) || 0), 0) / last7.length;
    // Inverse: original 1=top, 7=mauvais → 8-x for "fraicheur"
    const inv = (v: number) => Math.max(0, Math.min(7, 8 - v));
    return [
      { axis: "Énergie", value: inv(avg("fatigue")) },
      { axis: "Muscles", value: inv(avg("courbatures")) },
      { axis: "Sommeil", value: inv(avg("sommeil")) },
      { axis: "Mental", value: inv(avg("stress")) },
    ];
  }, [logs]);

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base sm:text-lg">Profil de forme — 7 jours</CardTitle>
      </CardHeader>
      <CardContent className="p-2 sm:p-4">
        <div className="h-56 sm:h-64 w-full">
          <ResponsiveContainer>
            <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="axis" tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} />
              <PolarRadiusAxis domain={[0, 7]} tick={false} axisLine={false} />
              <Radar
                dataKey="value"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.4}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-muted-foreground text-center mt-1">
          Plus le polygone est grand, mieux tu vas.
        </p>
      </CardContent>
    </Card>
  );
}
