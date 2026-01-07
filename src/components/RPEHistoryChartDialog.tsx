import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BarChart3, ArrowLeft, Clock, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface RPEData {
  date: string;
  sessionName: string;
  rpe: number;
  fullDate: string;
  sessionId: string;
}

interface SessionDetail {
  id: string;
  name: string;
  session_type: string;
  completed_at: string;
  duration_minutes: number | null;
  session_rpe: number | null;
  session_comment: string | null;
  session_exercises: {
    id: string;
    exercice: string;
    series: string;
    reps: string;
    charge: string;
    sportif_rpe: number | null;
    sportif_comment: string | null;
  }[];
}

export function RPEHistoryChartDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [rpeHistory, setRpeHistory] = useState<RPEData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    const fetchRPEHistory = async () => {
      if (!open || !user?.id) return;

      setLoading(true);
      try {
        // 3 dernières semaines (21 jours) - début de journée pour inclure aujourd'hui
        const threeWeeksAgo = subDays(new Date(), 21);
        threeWeeksAgo.setHours(0, 0, 0, 0);

        // Récupérer les séances via training_weeks pour s'assurer que c'est bien le sportif connecté
        const { data, error } = await supabase
          .from("training_sessions")
          .select(`
            id,
            name,
            session_rpe,
            completed_at,
            training_weeks!inner(athlete_id)
          `)
          .eq("training_weeks.athlete_id", user.id)
          .not("completed_at", "is", null)
          .not("session_rpe", "is", null)
          .gte("completed_at", threeWeeksAgo.toISOString())
          .order("completed_at", { ascending: true });

        if (error) {
          console.error("Erreur lors de la récupération de l'historique RPE:", error);
          return;
        }

        const formattedData: RPEData[] = (data ?? []).map((session) => ({
          date: format(new Date(session.completed_at!), "dd/MM", { locale: fr }),
          fullDate: format(new Date(session.completed_at!), "EEEE d MMMM yyyy", { locale: fr }),
          sessionName: session.name || "Séance",
          rpe: session.session_rpe!,
          sessionId: session.id,
        }));

        setRpeHistory(formattedData);
      } catch (err) {
        console.error("Erreur:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRPEHistory();
  }, [open, user?.id]);

  const handleBarClick = async (data: RPEData) => {
    if (!data.sessionId) return;
    
    setLoadingDetail(true);
    try {
      const { data: sessionData, error } = await supabase
        .from("training_sessions")
        .select(`
          id,
          name,
          session_type,
          completed_at,
          duration_minutes,
          session_rpe,
          session_comment,
          session_exercises(
            id,
            exercice,
            series,
            reps,
            charge,
            sportif_rpe,
            sportif_comment
          )
        `)
        .eq("id", data.sessionId)
        .maybeSingle();

      if (error) {
        console.error("Erreur lors de la récupération des détails:", error);
        return;
      }

      if (sessionData) {
        setSelectedSession(sessionData as SessionDetail);
      }
    } catch (err) {
      console.error("Erreur:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const getRPEColor = (rpe: number) => {
    if (rpe <= 3) return "hsl(142, 76%, 36%)"; // vert
    if (rpe <= 5) return "hsl(48, 96%, 53%)"; // jaune
    if (rpe <= 7) return "hsl(38, 92%, 50%)"; // orange
    return "hsl(0, 84%, 60%)"; // rouge
  };

  const getSessionTypeLabel = (type: string) => {
    switch (type) {
      case "cardio": return "Cardio";
      case "renfo": return "Renforcement";
      case "recup": return "Récupération";
      default: return type;
    }
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
          <p className="text-xs text-primary mt-1">Cliquer pour voir les détails</p>
        </div>
      );
    }
    return null;
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedSession(null);
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

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedSession ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setSelectedSession(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <span>{selectedSession.name}</span>
                </div>
              ) : (
                "Historique RPE (3 dernières semaines)"
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {selectedSession 
                ? `Détails de la séance ${selectedSession.name}`
                : "Graphique des RPE sur les 21 derniers jours pour toutes tes séances terminées."
              }
            </DialogDescription>
          </DialogHeader>

          {selectedSession ? (
            // Vue détaillée de la séance
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {getSessionTypeLabel(selectedSession.session_type)}
                  </Badge>
                  {selectedSession.duration_minutes && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {selectedSession.duration_minutes} min
                    </Badge>
                  )}
                  {selectedSession.session_rpe && (
                    <Badge 
                      style={{ backgroundColor: getRPEColor(selectedSession.session_rpe), color: "white" }}
                    >
                      RPE: {selectedSession.session_rpe}
                    </Badge>
                  )}
                </div>

                <p className="text-sm text-muted-foreground capitalize">
                  {format(new Date(selectedSession.completed_at), "EEEE d MMMM yyyy", { locale: fr })}
                </p>

                {selectedSession.session_comment && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm italic">"{selectedSession.session_comment}"</p>
                  </div>
                )}

                {selectedSession.session_exercises.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Dumbbell className="h-4 w-4" />
                      Exercices ({selectedSession.session_exercises.length})
                    </h4>
                    <div className="space-y-2">
                      {selectedSession.session_exercises.map((ex) => (
                        <div key={ex.id} className="bg-muted/30 p-2 rounded-lg text-sm">
                          <p className="font-medium">{ex.exercice}</p>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-1">
                            {ex.series && <span>{ex.series} séries</span>}
                            {ex.reps && <span>• {ex.reps} reps</span>}
                            {ex.charge && <span>• {ex.charge}</span>}
                            {ex.sportif_rpe && (
                              <Badge 
                                variant="outline" 
                                className="text-xs py-0"
                                style={{ borderColor: getRPEColor(ex.sportif_rpe) }}
                              >
                                RPE: {ex.sportif_rpe}
                              </Badge>
                            )}
                          </div>
                          {ex.sportif_comment && (
                            <p className="text-xs italic mt-1 text-muted-foreground">
                              💬 {ex.sportif_comment}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : loadingDetail ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : rpeHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucune séance complétée ces 3 dernières semaines
            </div>
          ) : (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={rpeHistory} 
                    margin={{ top: 10, right: 10, left: -10, bottom: 40 }}
                    onClick={(e) => {
                      if (e?.activePayload?.[0]?.payload) {
                        handleBarClick(e.activePayload[0].payload);
                      }
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} ticks={[0, 2, 4, 6, 8, 10]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="rpe" radius={[4, 4, 0, 0]}>
                      {rpeHistory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getRPEColor(entry.rpe)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

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
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
