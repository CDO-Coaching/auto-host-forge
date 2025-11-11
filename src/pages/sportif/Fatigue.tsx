import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface FatigueLog {
  id: string;
  date: string;
  fatigue: number;
  courbatures: number;
  sommeil: number;
  stress: number;
  score_total: number;
}

export default function Fatigue() {
  const { profile } = useUserProfile();
  const firstName = profile?.first_name || "champion";
  const [logs, setLogs] = useState<FatigueLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFatigueLogs();
  }, []);

  const loadFatigueLogs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("daily_fatigue_log")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error loading fatigue logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = [...logs]
    .reverse()
    .map(log => ({
      date: format(new Date(log.date), "dd/MM", { locale: fr }),
      score: log.score_total,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ton suivi fatigue</h1>
        <p className="text-muted-foreground mt-2">
          {firstName}, suis ton niveau de fatigue pour optimiser tes performances
        </p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-muted-foreground text-center">Chargement...</p>
          </CardContent>
        </Card>
      ) : logs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Aucune donnée</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {firstName}, commence à enregistrer tes données de fatigue pour que ton coach 
              puisse adapter ton programme. L'écoute de ton corps est essentielle ! 🎯
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Évolution du score total</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    domain={[4, 28]}
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historique</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Fatigue</TableHead>
                    <TableHead>Courbatures</TableHead>
                    <TableHead>Sommeil</TableHead>
                    <TableHead>Stress</TableHead>
                    <TableHead>Score total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">
                        {format(new Date(log.date), "dd MMMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>{log.fatigue}/7</TableCell>
                      <TableCell>{log.courbatures}/7</TableCell>
                      <TableCell>{log.sommeil}/7</TableCell>
                      <TableCell>{log.stress}/7</TableCell>
                      <TableCell className="font-bold">{log.score_total}/28</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
