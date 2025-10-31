import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight } from "lucide-react";
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
      // Filtrer pour ne garder que les semaines en cours ou passées
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentWeekNumber = getWeekNumber(now);
      
      const filteredWeeks = (data || []).filter((week: any) => {
        // Si l'année est passée, on garde la semaine
        if (week.year < currentYear) return true;
        // Si l'année est future, on ne garde pas
        if (week.year > currentYear) return false;
        // Si c'est l'année en cours, on compare les numéros de semaine
        return week.week_number <= currentWeekNumber;
      });
      
      setWeeks(filteredWeeks);
      if (filteredWeeks && filteredWeeks.length > 0) {
        loadWeekSessions(filteredWeeks[0].id);
        setSelectedWeek(filteredWeeks[0]);
      }
    }
    setLoading(false);
  };

  // Fonction pour obtenir le numéro de semaine
  const getWeekNumber = (date: Date): number => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
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
    loadWeekSessions(weekId);
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
                className="w-full p-3 border rounded-md bg-background text-foreground border-input focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
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
              <CardContent className="space-y-2">
                {sessions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Aucune séance pour cette semaine.
                  </p>
                ) : (
                  sessions.map((session) => (
                    <Card
                      key={session.id}
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => navigate(`/sportif/seance/${selectedWeek.id}/${session.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{session.name}</h3>
                            <Badge variant="outline" className="mt-1">
                              {session.session_exercises?.length || 0} exercices
                            </Badge>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
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
