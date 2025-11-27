import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { format, startOfMonth, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

interface MonthlyData {
  month: string;
  monthLabel: string;
  transfers: number;
  cash: number;
  total: number;
}

export default function SuiviSalaire() {
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMonthlyData();
  }, []);

  const loadMonthlyData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Charger les 12 derniers mois
      const months: MonthlyData[] = [];
      for (let i = 11; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthStr = format(startOfMonth(monthDate), "yyyy-MM-01");
        const monthLabel = format(monthDate, "MMM yy", { locale: fr });

        // Charger les entrées comptables pour ce mois
        const { data: entries } = await supabase
          .from("accounting_entries")
          .select("amount_cash, amount_transfer")
          .eq("coach_id", session.user.id)
          .eq("month", monthStr);

        const cash = entries?.reduce((sum, e) => sum + (parseFloat(e.amount_cash?.toString() || "0") || 0), 0) || 0;
        const transfers = entries?.reduce((sum, e) => sum + (parseFloat(e.amount_transfer?.toString() || "0") || 0), 0) || 0;

        months.push({
          month: monthStr,
          monthLabel,
          transfers,
          cash,
          total: transfers + cash
        });
      }

      setMonthlyData(months);
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  // Composant personnalisé pour dessiner les chandelles
  const CandlestickBar = (props: any) => {
    const { x, y, width, height, transfers, cash } = props;
    
    // Si pas de données, ne rien afficher
    if (!transfers && !cash) return null;

    const total = transfers + cash;
    const barWidth = Math.min(width * 0.6, 40);
    const centerX = x + width / 2;

    // Calculer les hauteurs proportionnelles
    const transferHeight = (transfers / total) * height;
    const cashHeight = (cash / total) * height;

    return (
      <g>
        {/* Partie basse - Virements (bleu) */}
        {transfers > 0 && (
          <rect
            x={centerX - barWidth / 2}
            y={y + height - transferHeight}
            width={barWidth}
            height={transferHeight}
            fill="hsl(var(--chart-1))"
            stroke="hsl(var(--border))"
            strokeWidth={1}
            rx={2}
          />
        )}
        
        {/* Partie haute - Espèces (vert) */}
        {cash > 0 && (
          <rect
            x={centerX - barWidth / 2}
            y={y + height - transferHeight - cashHeight}
            width={barWidth}
            height={cashHeight}
            fill="hsl(var(--chart-2))"
            stroke="hsl(var(--border))"
            strokeWidth={1}
            rx={2}
          />
        )}
      </g>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-semibold mb-2">{data.monthLabel}</p>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(var(--chart-2))" }}></div>
              <span className="text-muted-foreground">Espèces:</span>
              <span className="font-semibold">{data.cash.toFixed(2)} €</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(var(--chart-1))" }}></div>
              <span className="text-muted-foreground">Virements:</span>
              <span className="font-semibold">{data.transfers.toFixed(2)} €</span>
            </div>
            <div className="pt-2 border-t flex justify-between gap-4">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-bold">{data.total.toFixed(2)} €</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const totalRevenue = monthlyData.reduce((sum, m) => sum + m.total, 0);
  const averageMonthly = monthlyData.length > 0 ? totalRevenue / monthlyData.length : 0;
  const maxMonth = monthlyData.reduce((max, m) => m.total > max.total ? m : max, monthlyData[0] || { total: 0, monthLabel: "" });

  return (
    <div className="container mx-auto p-2 md:p-4 space-y-4 md:space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold">Suivi du salaire</h1>

      {loading ? (
        <div className="text-center py-8">Chargement...</div>
      ) : (
        <>
          {/* Statistiques récapitulatives */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total 12 mois</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl md:text-3xl font-bold">{totalRevenue.toFixed(2)} €</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Moyenne mensuelle</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl md:text-3xl font-bold">{averageMonthly.toFixed(2)} €</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Meilleur mois</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg md:text-xl font-semibold">{maxMonth.monthLabel}</p>
                <p className="text-xl md:text-2xl font-bold text-primary">{maxMonth.total.toFixed(2)} €</p>
              </CardContent>
            </Card>
          </div>

          {/* Graphique */}
          <Card>
            <CardHeader>
              <CardTitle>Évolution mensuelle</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full h-[400px] md:h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={monthlyData}
                    margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="monthLabel" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(value) => `${value}€`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="total" 
                      shape={<CandlestickBar />}
                      isAnimationActive={true}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Légende personnalisée */}
              <div className="flex items-center justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: "hsl(var(--chart-2))" }}></div>
                  <span className="text-sm text-muted-foreground">Espèces</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: "hsl(var(--chart-1))" }}></div>
                  <span className="text-sm text-muted-foreground">Virements</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tableau détaillé */}
          <Card>
            <CardHeader>
              <CardTitle>Détail mensuel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {monthlyData.slice().reverse().map((month) => (
                  <div 
                    key={month.month} 
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-semibold capitalize">{format(new Date(month.month), "MMMM yyyy", { locale: fr })}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs">Espèces</p>
                        <p className="font-semibold" style={{ color: "hsl(var(--chart-2))" }}>{month.cash.toFixed(2)} €</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs">Virements</p>
                        <p className="font-semibold" style={{ color: "hsl(var(--chart-1))" }}>{month.transfers.toFixed(2)} €</p>
                      </div>
                      <div className="text-right min-w-[100px]">
                        <p className="text-muted-foreground text-xs">Total</p>
                        <p className="font-bold text-lg">{month.total.toFixed(2)} €</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
