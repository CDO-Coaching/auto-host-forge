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
  RefreshCw
} from "lucide-react";
import { format, isSameDay, parseISO, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

interface CompletedSession {
  id: string;
  name: string;
  week_id: string;
  session_type: string;
  completed_at: string;
  session_rpe: number | null;
  isCustom?: boolean;
}

export default function Agenda() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch completed sessions (training_sessions + custom_sessions)
  const fetchCompletedSessions = useCallback(async () => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    try {
      // Fetch training sessions completed by the athlete
      // Must have completed_at AND (duration_minutes for non-recup sessions, or be a recup with duration_minutes)
      const { data: trainingSessions, error: trainingError } = await supabase
        .from("training_sessions")
        .select(`
          id,
          name,
          week_id,
          session_type,
          completed_at,
          session_rpe,
          duration_minutes,
          session_exercises(sportif_rpe, skipped),
          training_weeks!inner(athlete_id)
        `)
        .eq("training_weeks.athlete_id", session.user.id)
        .not("completed_at", "is", null);

      // Filter to only truly completed sessions (not invalidated)
      const reallyCompletedSessions = (trainingSessions || []).filter(s => {
        // For recup sessions: check duration_minutes
        if (s.session_type === "recup") {
          return s.duration_minutes !== null && s.duration_minutes !== undefined;
        }
        // For cardio sessions: all exercises must have RPE or be skipped
        if (s.session_type === "cardio") {
          const exercises = s.session_exercises || [];
          if (exercises.length === 0) return false;
          return exercises.every((ex: any) => 
            (ex.sportif_rpe !== null && ex.sportif_rpe !== undefined) || ex.skipped === true
          );
        }
        // For other sessions: must have duration_minutes set (set when completing the session)
        return s.duration_minutes !== null && s.duration_minutes !== undefined;
      });

      if (trainingError) throw trainingError;

      // Fetch custom sessions created by the athlete
      const { data: customSessions, error: customError } = await supabase
        .from("custom_sessions")
        .select("id, session_name, completed_at, duration_minutes")
        .eq("user_id", session.user.id);

      if (customError) throw customError;

      // Combine both types
      const allSessions: CompletedSession[] = [
        ...reallyCompletedSessions.map(s => ({
          id: s.id,
          name: s.name,
          week_id: s.week_id,
          session_type: s.session_type,
          completed_at: s.completed_at!,
          session_rpe: s.session_rpe,
          isCustom: false
        })),
        ...(customSessions || []).map(s => ({
          id: s.id,
          name: s.session_name,
          week_id: "",
          session_type: "custom",
          completed_at: s.completed_at,
          session_rpe: null,
          isCustom: true
        }))
      ];

      setCompletedSessions(allSessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      toast.error("Erreur lors du chargement des séances");
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchCompletedSessions();
  }, [fetchCompletedSessions]);

  // Get sessions for a specific date
  const getSessionsForDate = (date: Date): CompletedSession[] => {
    return completedSessions.filter(session => {
      const sessionDate = parseISO(session.completed_at);
      return isSameDay(sessionDate, date);
    });
  };

  // Get dates that have sessions (for calendar markers)
  const datesWithSessions = completedSessions.map(s => parseISO(s.completed_at));

  // Sessions for the selected date
  const selectedDateSessions = getSessionsForDate(selectedDate);

  // Navigate to session detail
  const handleSessionClick = (session: CompletedSession) => {
    if (session.isCustom) {
      // Custom sessions don't have a detail page for now
      toast.info("Séance personnalisée : " + session.name);
    } else {
      navigate(`/sportif/seance/${session.week_id}/${session.id}`);
    }
  };

  // Calendar range: from last month to current month
  const fromDate = startOfMonth(subMonths(new Date(), 1));
  const toDate = endOfMonth(new Date());

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
          onClick={fetchCompletedSessions}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Séance faite</span>
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
                hasSession: datesWithSessions
              }}
              modifiersStyles={{
                hasSession: {
                  backgroundColor: "hsl(142 76% 36% / 0.2)",
                  borderRadius: "50%",
                  border: "2px solid hsl(142 76% 36%)"
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
                {selectedDateSessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => handleSessionClick(session)}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Dumbbell className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-primary">{session.name}</p>
                        {session.session_rpe && (
                          <p className="text-xs text-muted-foreground">
                            RPE: {session.session_rpe}/10
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-primary" />
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
