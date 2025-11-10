import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Seances() {
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const firstName = profile?.first_name || "champion";
  const [weeks, setWeeks] = useState<any[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
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
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentWeekNumber = getWeekNumber(now);

      const filteredWeeks = (data || []).filter((week: any) => {
        if (week.year < currentYear) return true;
        if (week.year > currentYear) return false;
        return week.week_number <= currentWeekNumber;
      });

      setWeeks(filteredWeeks);
      
      // Chercher la semaine actuelle
      const currentWeek = filteredWeeks.find(
        (week: any) => week.week_number === currentWeekNumber && week.year === currentYear
      );

      if (currentWeek) {
        // La semaine actuelle existe, l'afficher
        loadWeekSessions(currentWeek.id);
        setSelectedWeek(currentWeek);
      } else if (filteredWeeks && filteredWeeks.length > 0) {
        // La semaine actuelle n'existe pas, afficher la plus récente
        loadWeekSessions(filteredWeeks[0].id);
        setSelectedWeek(filteredWeeks[0]);
      } else {
        // Aucune semaine disponible
        setSelectedWeek(null);
      }
    }
    setLoading(false);
  };

  const getWeekNumber = (date: Date): number => {
    const newDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = newDate.getUTCDay() || 7;
    newDate.setUTCDate(newDate.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(newDate.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((newDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return weekNo;
  };

  const loadWeekSessions = async (weekId: string) => {
    const { data: sessionsData, error: sessionsError } = await supabase
      .from("training_sessions")
      .select(
        `
        *,
        session_exercises (*)
      `,
      )
      .eq("week_id", weekId)
      .order("session_number");

    if (sessionsError) {
      console.error("Erreur lors du chargement des séances:", sessionsError);
    } else {
      const sorted = (sessionsData || []).sort((a: any, b: any) => {
        const aCompleted = isSessionCompleted(a);
        const bCompleted = isSessionCompleted(b);

        if (aCompleted === bCompleted) {
          return a.session_number - b.session_number;
        }
        return aCompleted ? 1 : -1;
      });

      setSessions(sorted);
    }
  };

  const handleWeekChange = (weekId: string) => {
    const week = weeks.find((w) => w.id === weekId);
    setSelectedWeek(week);
    loadWeekSessions(weekId);
  };

  const isSessionCompleted = (session: any) => {
    if (!session.session_exercises || session.session_exercises.length === 0) return false;
    return session.session_exercises.every((ex: any) => ex.sportif_rpe !== null && ex.sportif_rpe !== undefined);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentWeekNumber = getWeekNumber(now);
  const isCurrentWeekAvailable = weeks.some(
    (week) => week.week_number === currentWeekNumber && week.year === currentYear
  );

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Tes séances</h1>
          <p className="text-muted-foreground mt-2">{firstName}, voici ton programme personnalisé</p>
        </div>

        {weeks.length > 0 && (
          <div className="flex flex-col items-end gap-1 min-w-[140px]">
            <label className="text-xs text-muted-foreground">Semaine</label>
            <select
              className="text-sm p-2 border rounded-md bg-background text-foreground border-input focus:outline-none focus:ring-1 focus:ring-ring"
              value={selectedWeek?.id || ""}
              onChange={(e) => handleWeekChange(e.target.value)}
            >
              {weeks.map((week) => (
                <option key={week.id} value={week.id}>
                  S{week.week_number} - {week.year}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!isCurrentWeekAvailable && weeks.length > 0 && (
        <Card className="border-orange-500 bg-orange-500/10">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-orange-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-orange-700 dark:text-orange-400">
                  Semaine {currentWeekNumber} en cours de création
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {firstName}, ton coach prépare ta semaine de sport. En attendant, tu peux consulter tes semaines précédentes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {weeks.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Aucune séance programmée</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {firstName}, ton coach n'a pas encore programmé de séances. Reste motivé, elles arrivent bientôt ! 💪
            </p>
          </CardContent>
        </Card>
      ) : (
        selectedWeek && (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Semaine {selectedWeek.week_number}</h2>
            {sessions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Aucune séance pour cette semaine.</p>
            ) : (
              sessions.map((session, index) => {
                const completed = isSessionCompleted(session);
                const isFirstToDo = index === 0 && !completed;

                return (
                  <Card
                    key={session.id}
                    className={`cursor-pointer transition-all ${
                      completed
                        ? "border-green-500 bg-green-500/10"
                        : isFirstToDo
                          ? "border-primary border-2 bg-primary/5 animate-pulse shadow-lg"
                          : "hover:border-primary hover:shadow-md"
                    }`}
                    onClick={() => navigate(`/sportif/seance/${selectedWeek.id}/${session.id}`)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-bold text-2xl flex items-center gap-2">
                              {session.name}
                              {completed && (
                                <div className="flex items-center gap-1 text-green-500 text-sm font-normal">
                                  <CheckCircle2 className="h-5 w-5" />
                                  {session.duration_minutes && (
                                    <span className="flex items-center gap-1 text-green-400 text-xs">
                                      <Clock className="h-4 w-4" />
                                      {session.duration_minutes} min
                                    </span>
                                  )}
                                </div>
                              )}
                            </h3>

                            {isFirstToDo && (
                              <Badge variant="default" className="bg-primary text-primary-foreground animate-bounce">
                                À faire
                              </Badge>
                            )}
                          </div>

                          <Badge variant={completed ? "secondary" : "outline"} className="text-sm px-3 py-1">
                            {session.session_exercises?.length || 0} exercices
                          </Badge>
                        </div>

                        <ChevronRight
                          className={`h-7 w-7 ${
                            completed ? "text-green-500" : isFirstToDo ? "text-primary" : "text-muted-foreground"
                          }`}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )
      )}
    </div>
  );
}
