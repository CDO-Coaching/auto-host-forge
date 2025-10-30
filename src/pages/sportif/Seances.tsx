import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Seances() {
  const { profile } = useUserProfile();
  const firstName = profile?.first_name || "champion";
  const [weeks, setWeeks] = useState<any[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWeeks();
  }, []);

  const loadWeeks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("training_weeks")
      .select("*")
      .eq("validated", true)
      .order("year", { ascending: false })
      .order("week_number", { ascending: false });

    if (error) {
      console.error("Erreur lors du chargement des semaines:", error);
    } else {
      setWeeks(data || []);
      if (data && data.length > 0) {
        loadWeekSessions(data[0].id);
        setSelectedWeek(data[0]);
      }
    }
    setLoading(false);
  };

  const loadWeekSessions = async (weekId: string) => {
    const { data: sessionsData, error: sessionsError } = await supabase
      .from("training_sessions")
      .select(`
        *,
        session_exercises (*)
      `)
      .eq("week_id", weekId)
      .order("session_number");

    if (sessionsError) {
      console.error("Erreur lors du chargement des séances:", sessionsError);
    } else {
      setSessions(sessionsData || []);
    }
  };

  const handleWeekChange = (weekId: string) => {
    const week = weeks.find(w => w.id === weekId);
    setSelectedWeek(week);
    setExpandedSessionId(null); // Réinitialiser la séance sélectionnée
    loadWeekSessions(weekId);
  };

  const toggleSession = (sessionId: string) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
    } else {
      setExpandedSessionId(sessionId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tes séances</h1>
        <p className="text-muted-foreground mt-2">
          {firstName}, voici ton programme d'entraînement personnalisé
        </p>
      </div>

      {weeks.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Aucune séance programmée</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {firstName}, ton coach n'a pas encore programmé de séances. 
              Reste motivé, elles arrivent bientôt ! 💪
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Sélectionner une semaine</CardTitle>
            </CardHeader>
            <CardContent>
              <select
                className="w-full p-2 border rounded-md"
                value={selectedWeek?.id || ""}
                onChange={(e) => handleWeekChange(e.target.value)}
              >
                {weeks.map((week) => (
                  <option key={week.id} value={week.id}>
                    Semaine {week.week_number} - {week.year}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          {selectedWeek && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Semaine d'entraînement n°{selectedWeek.week_number}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {sessions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Aucune séance pour cette semaine.
                  </p>
                ) : (
                  sessions.map((session) => (
                    <div key={session.id} className="border rounded-lg">
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleSession(session.id)}
                      >
                        <div className="flex items-center gap-3">
                          {expandedSessionId === session.id ? (
                            <ChevronDown className="h-5 w-5 text-primary" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                          <span className="font-semibold text-lg">{session.name}</span>
                        </div>
                        <Badge variant="outline">
                          {session.session_exercises?.length || 0} exercices
                        </Badge>
                      </div>

                      {expandedSessionId === session.id && (
                        <div className="border-t p-4 bg-muted/20">
                          {session.session_exercises && session.session_exercises.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left p-2">Exercice</th>
                                    <th className="text-left p-2">Récup</th>
                                    <th className="text-left p-2">Reps</th>
                                    <th className="text-left p-2">Séries</th>
                                    <th className="text-left p-2">Charge</th>
                                    <th className="text-left p-2">RPE</th>
                                    <th className="text-left p-2">Tempo</th>
                                    <th className="text-left p-2">Commentaire</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {session.session_exercises
                                    .sort((a: any, b: any) => a.exercise_order - b.exercise_order)
                                    .map((exercise: any) => (
                                      <tr key={exercise.id} className="border-b">
                                        <td className="p-2 font-medium">{exercise.exercice}</td>
                                        <td className="p-2">{exercise.recuperation || "-"}</td>
                                        <td className="p-2">{exercise.reps || "-"}</td>
                                        <td className="p-2">{exercise.series || "-"}</td>
                                        <td className="p-2">{exercise.charge || "-"}</td>
                                        <td className="p-2">{exercise.rpe || "-"}</td>
                                        <td className="p-2">{exercise.tempo || "-"}</td>
                                        <td className="p-2">{exercise.commentaire || "-"}</td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-muted-foreground text-sm text-center py-4">
                              Aucun exercice programmé pour cette séance.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
