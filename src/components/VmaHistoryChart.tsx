/**
 * VmaHistoryChart — évolution de la VMA dans le temps, deux courbes :
 *  - VMA saisie manuellement
 *  - VMA issue du calibrage allure↔FC
 * Lit l'historique via le RPC get_vma_history (table vma_history).
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface Props { athleteId: string; }

interface Point {
  ts: number;
  label: string;
  manual: number | null;
  calibration: number | null;
}

export function VmaHistoryChart({ athleteId }: Props) {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_vma_history", { p_athlete_id: athleteId } as any);
      if (!error && Array.isArray(data)) {
        const pts: Point[] = (data as any[]).map((r) => {
          const d = new Date(r.recorded_at);
          return {
            ts: d.getTime(),
            label: format(d, "dd MMM yy", { locale: fr }),
            manual: r.source === "manual" ? Number(r.vma) : null,
            calibration: r.source === "calibration" ? Number(r.vma) : null,
          };
        });
        setPoints(pts);
      } else {
        setPoints([]);
      }
      setLoading(false);
    })();
  }, [athleteId]);

  if (loading) {
    return <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Chargement…</div>;
  }
  if (points.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Aucun historique de VMA pour l'instant. Il se construit à chaque saisie manuelle
        ou application d'une VMA calibrée.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={points} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
          <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} unit=" " />
          <Tooltip
            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
            formatter={(value: any, name: string) => [`${value} km/h`, name]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="manual" name="VMA manuelle" stroke="#eab308" strokeWidth={2} connectNulls dot={{ r: 3 }} />
          <Line type="monotone" dataKey="calibration" name="VMA calibrée" stroke="#22c55e" strokeWidth={2} connectNulls dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[11px] text-muted-foreground text-center">
        Jaune = VMA saisie manuellement · Vert = VMA issue du calibrage allure↔FC
      </p>
    </div>
  );
}
