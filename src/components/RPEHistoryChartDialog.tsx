import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";

interface RPEHistoryChartDialogProps {
  sportifId?: string;
}

interface RPEData {
  date: string;
  sessionName: string;
  rpe: number;
  fullDate: string;
}

export function RPEHistoryChartDialog({ sportifId }: RPEHistoryChartDialogProps) {
  const [open, setOpen] = useState(false);
  const [rpeHistory, setRpeHistory] = useState<RPEData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRPEHistory = async () => {
      if (!open || !sportifId) return;
      
      setLoading(true);
      try {
        const twoWeeksAgo = subDays(new Date(), 14);
        
        const { data, error } = await supabase
          .from("training_sessions")
          .select("name, session_rpe, completed_at")
          .eq("sportif_id", sportifId)
          .not("completed_at", "is", null)
          .not("session_rpe", "is", null)
          .gte("completed_at", twoWeeksAgo.toISOString())
          .order("completed_at", { ascending: true });

        if (error) {
          console.error("Erreur lors de la récupération de l'historique RPE:", error);
          return;
        }

        if (data) {
          const formattedData: RPEData[] = data.map((session) => ({
            date: format(new Date(session.completed_at!), "dd/MM", { locale: fr }),
            fullDate: format(new Date(session.completed_at!), "EEEE d MMMM", { locale: fr }),
            sessionName: session.name || "Séance",
            rpe: session.session_rpe!,
          }));
          setRpeHistory(formattedData);
        }
      } catch (err) {
        console.error("Erreur:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRPEHistory();
  }, [open, sportifId]);

  const getRPEColor = (rpe: number) => {
    if (rpe <= 3) return "hsl(142, 76%, 36%)"; // vert
    if (rpe <= 5) return "hsl(48, 96%, 53%)"; // jaune
    if (rpe <= 7) return "hsl(38, 92%, 50%)"; // orange
    return "hsl(0, 84%, 60%)"; // rouge
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as RPEData;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-sm">{data.sessionName}</p>
          <p className="text-xs text-muted-foreground capitalize">{data.fullDate}</p>
          <p className="text-sm mt-1">
            RPE: <span className="font-bold">{data.rpe}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => setOpen(true)}
        title="Voir l'historique des RPE"
      >
        <BarChart3 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Historique RPE (2 dernières semaines)</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : rpeHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucune séance complétée ces 2 dernières semaines
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rpeHistory} margin={{ top: 10, right: 10, left: -10, bottom: 40 }}>
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis 
                    domain={[0, 10]} 
                    tick={{ fontSize: 10 }}
                    ticks={[0, 2, 4, 6, 8, 10]}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="rpe" radius={[4, 4, 0, 0]}>
                    {rpeHistory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getRPEColor(entry.rpe)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="flex justify-center gap-4 text-xs text-muted-foreground pt-2">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(142, 76%, 36%)" }} />
              <span>1-3</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(48, 96%, 53%)" }} />
              <span>4-5</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(38, 92%, 50%)" }} />
              <span>6-7</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: "hsl(0, 84%, 60%)" }} />
              <span>8-10</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
