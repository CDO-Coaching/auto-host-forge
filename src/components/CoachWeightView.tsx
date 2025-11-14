import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Scale } from "lucide-react";

interface WeightLog {
  id: string;
  weight_kg: number;
  recorded_at: string;
  notes: string | null;
}

interface CoachWeightViewProps {
  athleteId: string;
  athleteName: string;
}

export function CoachWeightView({ athleteId, athleteName }: CoachWeightViewProps) {
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWeightLogs();
  }, [athleteId]);

  const loadWeightLogs = async () => {
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("weight_tracking")
        .select("*")
        .eq("user_id", athleteId)
        .gte("recorded_at", thirtyDaysAgo.toISOString())
        .order("recorded_at", { ascending: true });

      if (error) {
        console.error("Erreur lors du chargement des poids:", error);
      } else {
        setLogs(data || []);
      }
    } catch (err) {
      console.error("Erreur:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Chargement des données de poids...</p>
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Suivi du poids
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {athleteName} n'a pas encore enregistré de données de poids.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = logs.map((log) => ({
    date: new Date(log.recorded_at).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    }),
    poids: log.weight_kg,
  }));

  const currentWeight = logs[logs.length - 1]?.weight_kg;
  const firstWeight = logs[0]?.weight_kg;
  const weightChange = currentWeight && firstWeight ? currentWeight - firstWeight : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Évolution du poids
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Poids actuel</p>
              <p className="text-2xl font-bold text-primary">{currentWeight} kg</p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Variation (30j)</p>
              <p className={`text-2xl font-bold ${weightChange > 0 ? "text-orange-500" : weightChange < 0 ? "text-green-500" : "text-muted-foreground"}`}>
                {weightChange > 0 ? "+" : ""}{weightChange.toFixed(1)} kg
              </p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Nombre d'entrées</p>
              <p className="text-2xl font-bold text-foreground">{logs.length}</p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs" 
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis 
                domain={["dataMin - 2", "dataMax + 2"]}
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="poids"
                name="Poids (kg)"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique détaillé (30 derniers jours)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Poids (kg)</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.slice().reverse().map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {new Date(log.recorded_at).toLocaleDateString("fr-FR", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {log.weight_kg} kg
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {log.notes || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
