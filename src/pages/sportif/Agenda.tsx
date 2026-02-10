import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { 
  Calendar as CalendarIcon, 
  Dumbbell,
  ChevronRight,
  RefreshCw,
  Clock
} from "lucide-react";
import { format, isSameDay, parseISO, subMonths, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { fr } from "date-fns/locale";

interface AgendaSession {
  id: string;
  name: string;
  week_id: string;
  session_type: string;
  date: string;
  session_rpe: number | null;
  isCustom?: boolean;
  isCompleted: boolean;
}

export default function Agenda() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [agendaSessions, setAgendaSessions] = useState<AgendaSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isSessionCompleted = (s: any): boolean => {
    if (s.session_type === "recup") {
      return s.duration_minutes !== null && s.duration_minutes !== undefined;
    }
    const exercises = s.session_exercises || [];
    if (exercises.length === 0) return false;
    return exercises.every(
      (ex: any) => (ex.sportif_rpe !== null && ex.sportif_rpe !== undefined) || ex.skipped === true,
    );
  };

  const fetchSessions = useCallback(async () => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    try {
      // Fetch all training sessions for the athlete
      const { data: trainingSessions, error: trainingError } = await supabase
        .from("training_sessions")
        .select(`
          id,
          name,
          week_id,
          session_type,
          completed_at,
          scheduled_date,
          session_rpe,
          duration_minutes,
          session_exercises(sportif_rpe, skipped),
          training_weeks!inner(athlete_id)
        `)
        .eq("training_weeks.athlete_id", session.user.id);

      if (trainingError) throw trainingError;

      // Fetch custom sessions (both completed and planned)
      const { data: customSessions, error: customError } = await (supabase.from("custom_sessions") as any)
        .select("id, session_name, completed_at, duration_minutes, scheduled_date")
        .eq("user_id", session.user.id);

      if (customError) throw customError;

      const allSessions: AgendaSession[] = [];

      // Process training sessions
      (trainingSessions || []).forEach((s: any) => {
        const completed = isSessionCompleted(s);
        
        // Add completed sessions (with completed_at date)
        if (completed && s.completed_at) {
          allSessions.push({
            id: s.id,
            name: s.name,
            week_id: s.week_id,
            session_type: s.session_type,
            date: s.completed_at,
            session_rpe: s.session_rpe,
            isCustom: false,
            isCompleted: true
          });
        }
        
        // Add scheduled sessions (not completed, with scheduled_date)
        if (!completed && s.scheduled_date) {
          allSessions.push({
            id: s.id,
            name: s.name,
            week_id: s.week_id,
            session_type: s.session_type,
            date: s.scheduled_date,
            session_rpe: null,
            isCustom: false,
            isCompleted: false
          });
        }
      });

      // Add custom sessions (completed or planned)
      (customSessions || []).forEach((s: any) => {
        const isCompleted = !!s.completed_at;
        const date = isCompleted ? s.completed_at : s.scheduled_date;
        if (!date) return;
        allSessions.push({
          id: s.id,
          name: s.session_name,
          week_id: "",
          session_type: "custom",
          date,
          session_rpe: null,
          isCustom: true,
          isCompleted
        });
      });

      setAgendaSessions(allSessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      toast.error("Erreur lors du chargement des séances");
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Get sessions for a specific date
  const getSessionsForDate = (date: Date): AgendaSession[] => {
    return agendaSessions.filter(s => {
      const sessionDate = s.date.includes("T") ? parseISO(s.date) : new Date(s.date);
      return isSameDay(sessionDate, date);
    });
  };

  // Get dates with completed sessions
  const datesWithCompletedSessions = agendaSessions
    .filter(s => s.isCompleted)
    .map(s => s.date.includes("T") ? parseISO(s.date) : new Date(s.date));

  // Get dates with scheduled sessions (not completed)
  const datesWithScheduledSessions = agendaSessions
    .filter(s => !s.isCompleted)
    .map(s => new Date(s.date));

  // Sessions for the selected date
  const selectedDateSessions = getSessionsForDate(selectedDate);

  // Navigate to session detail
  const handleSessionClick = (agendaSession: AgendaSession) => {
    if (agendaSession.isCustom) {
      toast.info("Séance personnalisée : " + agendaSession.name);
    } else {
      navigate(`/sportif/seance/${agendaSession.week_id}/${agendaSession.id}`);
    }
  };

  // Calendar range: from last month to next month (to show scheduled sessions)
  const fromDate = startOfMonth(subMonths(new Date(), 1));
  const toDate = endOfMonth(addMonths(new Date(), 1));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Mon Agenda</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchSessions}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-success" />
          <span>Séance faite</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span>Séance programmée</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <Card>
          <CardContent className="p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              locale={fr}
              fromDate={fromDate}
              toDate={toDate}
              className="pointer-events-auto"
              modifiers={{
                completed: datesWithCompletedSessions,
                scheduled: datesWithScheduledSessions
              }}
              modifiersStyles={{
                completed: {
                  backgroundColor: "hsl(var(--success) / 0.2)",
                  borderRadius: "50%",
                  border: "2px solid hsl(var(--success))"
                },
                scheduled: {
                  backgroundColor: "hsl(24 95% 53% / 0.2)",
                  borderRadius: "50%",
                  border: "2px solid hsl(24 95% 53%)"
                }
              }}
            />
          </CardContent>
        </Card>

        {/* Selected date details */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold mb-4">
              {format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })}
            </h2>

            {isLoading ? (
              <p className="text-muted-foreground">Chargement...</p>
            ) : selectedDateSessions.length === 0 ? (
              <p className="text-muted-foreground">Aucune séance ce jour</p>
            ) : (
              <div className="space-y-3">
                {selectedDateSessions.map((agendaSession) => (
                  <button
                    key={agendaSession.id}
                    onClick={() => handleSessionClick(agendaSession)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors text-left ${
                      agendaSession.isCompleted 
                        ? "bg-success/10 hover:bg-success/20" 
                        : "bg-orange-500/10 hover:bg-orange-500/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {agendaSession.isCompleted ? (
                        <Dumbbell className="h-5 w-5 text-success" />
                      ) : (
                        <Clock className="h-5 w-5 text-orange-500" />
                      )}
                      <div>
                        <p className={`font-medium ${agendaSession.isCompleted ? "text-success" : "text-orange-500"}`}>
                          {agendaSession.name}
                        </p>
                        {agendaSession.isCompleted && agendaSession.session_rpe && (
                          <p className="text-xs text-muted-foreground">
                            RPE: {agendaSession.session_rpe}/10
                          </p>
                        )}
                        {!agendaSession.isCompleted && (
                          <p className="text-xs text-muted-foreground">À faire</p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className={`h-5 w-5 ${agendaSession.isCompleted ? "text-success" : "text-orange-500"}`} />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
