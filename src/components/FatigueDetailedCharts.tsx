import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";
import { format, subDays, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type ChartPeriod = "7d" | "1m" | "3m" | "6m";

interface FatigueLog {
  id: string;
  date: string;
  fatigue: number;
  courbatures: number;
  sommeil: number;
  stress: number;
  score_total: number;
  has_injury: boolean | null;
  injury_level: number | null;
  injury_location: string | null;
}

interface FatigueDetailedChartsProps {
  logs: FatigueLog[];
}

const METRICS = [
  { key: "fatigue", label: "Fatigue", color: "hsl(var(--primary))" },
  { key: "courbatures", label: "Courbatures", color: "hsl(25 95% 53%)" },
  { key: "sommeil", label: "Sommeil", color: "hsl(221 83% 53%)" },
  { key: "stress", label: "Stress", color: "hsl(280 65% 60%)" },
];

// Labels pour chaque métrique par valeur (1-7)
const METRIC_LABELS: Record<string, string[]> = {
  fatigue: ["Très frais", "Frais", "Légèrement fatigué", "Fatigué", "Très fatigué", "Épuisé", "Exténué"],
  courbatures: ["Aucune", "Très légères", "Légères", "Modérées", "Importantes", "Très importantes", "Sévères"],
  sommeil: ["Catastrophique", "Très mauvais", "Mauvais", "Moyen", "Bon", "Très bon", "Excellent"],
  stress: ["Très calme", "Calme", "Légèrement tendu", "Modéré", "Élevé", "Très élevé", "Extrême"],
};

const getStatusForValue = (value: number): { label: string; color: string } => {
  if (value >= 1 && value <= 3) {
    return { label: "OK", color: "hsl(142 76% 36%)" };
  } else if (value >= 4 && value <= 5) {
    return { label: "Vigilance", color: "hsl(45 93% 47%)" };
  } else {
    return { label: "Danger", color: "hsl(0 84% 60%)" };
  }
};

export function FatigueDetailedCharts({ logs }: FatigueDetailedChartsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [period, setPeriod] = useState<ChartPeriod>("7d");

  const filterByPeriod = (data: FatigueLog[], period: ChartPeriod) => {
    const now = new Date();
    let cutoffDate: Date;
    
    switch (period) {
      case "7d":
        cutoffDate = subDays(now, 7);
        break;
      case "1m":
        cutoffDate = subMonths(now, 1);
        break;
      case "3m":
        cutoffDate = subMonths(now, 3);
        break;
      case "6m":
        cutoffDate = subMonths(now, 6);
        break;
      default:
        cutoffDate = subDays(now, 7);
    }
    
    return data.filter(log => new Date(log.date) >= cutoffDate);
  };

  const chartData = useMemo(() => {
    const filteredLogs = filterByPeriod(logs, period);
    const reversedLogs = [...filteredLogs].reverse();
    
    return reversedLogs.map(log => ({
      date: format(new Date(log.date), "dd/MM", { locale: fr }),
      fatigue: log.fatigue,
      courbatures: log.courbatures,
      sommeil: log.sommeil,
      stress: log.stress,
    }));
  }, [logs, period]);

  if (logs.length === 0) return null;

  const CustomTooltip = ({ active, payload, metricKey }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value as number;
      const status = getStatusForValue(value);
      const labels = METRIC_LABELS[metricKey];
      const valueLabel = labels ? labels[value - 1] : "";
      
      return (
        <div style={{
          backgroundColor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '6px',
          fontSize: '10px',
          padding: '6px 8px',
        }}>
          <p style={{ fontWeight: 600, marginBottom: '4px' }}>{payload[0].payload.date}</p>
          <p><strong>{value}/7</strong> - {valueLabel}</p>
          <p style={{ color: status.color, fontWeight: 600 }}>{status.label}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="w-full">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg">Détails par métrique</CardTitle>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            <ToggleGroup
              type="single"
              value={period}
              onValueChange={(value) => value && setPeriod(value as ChartPeriod)}
              className="justify-start"
            >
              <ToggleGroupItem value="7d" size="sm" className="text-xs px-2 h-7">7j</ToggleGroupItem>
              <ToggleGroupItem value="1m" size="sm" className="text-xs px-2 h-7">1 mois</ToggleGroupItem>
              <ToggleGroupItem value="3m" size="sm" className="text-xs px-2 h-7">3 mois</ToggleGroupItem>
              <ToggleGroupItem value="6m" size="sm" className="text-xs px-2 h-7">6 mois</ToggleGroupItem>
            </ToggleGroup>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {METRICS.map((metric) => (
                <div key={metric.key} className="space-y-2">
                  <h4 className="text-sm font-medium">{metric.label}</h4>
                  <div style={{ width: '100%', height: '150px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ left: -25, right: 5, top: 5, bottom: 5 }}>
                        {/* Zones de couleur */}
                        <ReferenceArea y1={1} y2={3} fill="hsl(142 76% 36%)" fillOpacity={0.15} />
                        <ReferenceArea y1={3} y2={5} fill="hsl(45 93% 47%)" fillOpacity={0.15} />
                        <ReferenceArea y1={5} y2={7} fill="hsl(0 84% 60%)" fillOpacity={0.15} />
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                          height={20}
                          tickMargin={3}
                        />
                        <YAxis 
                          domain={[1, 7]}
                          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                          width={30}
                          tickMargin={3}
                          ticks={[1, 3, 5, 7]}
                        />
                        <Tooltip content={(props) => <CustomTooltip {...props} metricKey={metric.key} />} />
                        <Line 
                          type="monotone" 
                          dataKey={metric.key}
                          stroke={metric.color}
                          strokeWidth={2}
                          dot={{ fill: metric.color, r: 3, strokeWidth: 1.5, stroke: '#fff' }}
                          activeDot={{ r: 5 }}
                          name={metric.label}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}