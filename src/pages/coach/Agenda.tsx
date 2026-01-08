import { useState, useEffect, useCallback, useMemo } from "react";
import { Calendar, ChevronLeft, ChevronRight, RefreshCw, Dumbbell, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface AthleteProfile {
  id: string;
  firstName: string;
  lastName: string;
}
interface AthleteSession {
  id: string;
  sessionName: string;
  sessionType: string;
  completedAt: string;
  sessionRpe: number | null;
  athleteId: string;
  athleteFirstName: string;
  athleteLastName: string;
}

export default function Agenda() {
  const { session } = useAuth();
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [sessions, setSessions] = useState<AthleteSession[]>([]);
  const [allAthletes, setAllAthletes] = useState<AthleteProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    if (!session?.user?.id) return;

    const weekStart = currentWeekStart;
    const weekEndDate = endOfWeek(weekStart, { weekStartsOn: 1 });

    setIsLoading(true);
    try {
      // Get all athletes for this coach
      const { data: relationships, error: relError } = await supabase
        .from("coach_athlete_relationships")
        .select("athlete_id")
        .eq("coach_id", session.user.id)
        .eq("status", "approved");

      if (relError) throw relError;

      const athleteIds = relationships?.map(r => r.athlete_id) || [];
      
      if (athleteIds.length === 0) {
        setSessions([]);
        setIsLoading(false);
        return;
      }

      // Fetch athlete profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name")
        .in("id", athleteIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      // Store all athletes for the summary
      setAllAthletes((profiles || []).map(p => ({
        id: p.id,
        firstName: p.first_name || "",
        lastName: p.last_name || ""
      })));

      // Fetch completed training sessions for the week
      const weekStartStr = format(weekStart, "yyyy-MM-dd");
      const weekEndStr = format(weekEndDate, "yyyy-MM-dd");

      const { data: trainingSessions, error: tsError } = await supabase
        .from("training_sessions")
        .select(`
          id,
          name,
          session_type,
          completed_at,
          session_rpe,
          training_weeks!inner(athlete_id)
        `)
        .in("training_weeks.athlete_id", athleteIds)
        .not("completed_at", "is", null)
        .gte("completed_at", weekStartStr)
        .lte("completed_at", weekEndStr + "T23:59:59");

      if (tsError) throw tsError;

      // Fetch custom sessions for the week
      const { data: customSessions, error: csError } = await supabase
        .from("custom_sessions")
        .select("id, session_name, completed_at, user_id")
        .in("user_id", athleteIds)
        .gte("completed_at", weekStartStr)
        .lte("completed_at", weekEndStr + "T23:59:59");

      if (csError) throw csError;

      const allSessions: AthleteSession[] = [];

      // Process training sessions
      (trainingSessions || []).forEach((ts: any) => {
        const athleteId = ts.training_weeks?.athlete_id;
        const profile = profileMap.get(athleteId);
        if (profile && ts.completed_at) {
          allSessions.push({
            id: ts.id,
            sessionName: ts.name,
            sessionType: ts.session_type,
            completedAt: ts.completed_at,
            sessionRpe: ts.session_rpe,
            athleteId,
            athleteFirstName: profile.first_name || "",
            athleteLastName: profile.last_name || ""
          });
        }
      });

      // Process custom sessions
      (customSessions || []).forEach((cs: any) => {
        const profile = profileMap.get(cs.user_id);
        if (profile && cs.completed_at) {
          allSessions.push({
            id: cs.id,
            sessionName: cs.session_name,
            sessionType: "custom",
            completedAt: cs.completed_at,
            sessionRpe: null,
            athleteId: cs.user_id,
            athleteFirstName: profile.first_name || "",
            athleteLastName: profile.last_name || ""
          });
        }
      });

      setSessions(allSessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      toast.error("Erreur lors du chargement des séances");
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, currentWeekStart]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const getSessionsForDay = (day: Date): AthleteSession[] => {
    return sessions
      .filter(s => {
        const sessionDate = parseISO(s.completedAt);
        return isSameDay(sessionDate, day);
      })
      .sort((a, b) => parseISO(a.completedAt).getTime() - parseISO(b.completedAt).getTime());
  };

  const goToPreviousWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  const goToNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  const goToCurrentWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const getSessionTypeLabel = (type: string) => {
    switch (type) {
      case "muscu": return "Muscu";
      case "cardio": return "Cardio";
      case "recup": return "Récup";
      case "custom": return "Perso";
      default: return type;
    }
  };

  const getSessionTypeColor = (type: string) => {
    switch (type) {
      case "muscu": return "bg-blue-500/20 text-blue-600 border-blue-500/30";
      case "cardio": return "bg-orange-500/20 text-orange-600 border-orange-500/30";
      case "recup": return "bg-green-500/20 text-green-600 border-green-500/30";
      case "custom": return "bg-purple-500/20 text-purple-600 border-purple-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const isToday = (day: Date) => isSameDay(day, new Date());

  // Calculate sessions per athlete, sorted by count (highest first, 0 at bottom)
  const athleteSessionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    
    // Initialize all athletes with 0
    allAthletes.forEach(athlete => {
      counts.set(athlete.id, 0);
    });
    
    // Count sessions per athlete
    sessions.forEach(session => {
      counts.set(session.athleteId, (counts.get(session.athleteId) || 0) + 1);
    });
    
    // Create sorted list: athletes with sessions first (sorted desc), then athletes with 0 sessions
    return allAthletes
      .map(athlete => ({
        ...athlete,
        sessionCount: counts.get(athlete.id) || 0
      }))
      .sort((a, b) => {
        // Both have 0: alphabetical order
        if (a.sessionCount === 0 && b.sessionCount === 0) {
          return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        }
        // One has 0: put it at the bottom
        if (a.sessionCount === 0) return 1;
        if (b.sessionCount === 0) return -1;
        // Both have sessions: highest first
        return b.sessionCount - a.sessionCount;
      });
  }, [sessions, allAthletes]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Agenda</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
            Aujourd'hui
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSessions}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={goToPreviousWeek}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold text-center">
          {format(currentWeekStart, "d MMM", { locale: fr })} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), "d MMM yyyy", { locale: fr })}
        </h2>
        <Button variant="ghost" size="icon" onClick={goToNextWeek}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Week grid - 7 columns on all screen sizes */}
      <div className="grid grid-cols-7 gap-1 md:gap-3">
        {eachDayOfInterval({ start: currentWeekStart, end: endOfWeek(currentWeekStart, { weekStartsOn: 1 }) }).map((day) => {
          const daySessions = getSessionsForDay(day);
          const dayIsToday = isToday(day);
          
          return (
            <Card 
              key={day.toISOString()} 
              className={`min-h-[120px] md:min-h-[150px] ${dayIsToday ? "ring-2 ring-primary" : ""}`}
            >
              <CardContent className="p-1 md:p-3">
                <div className={`text-center mb-1 md:mb-3 pb-1 md:pb-2 border-b ${dayIsToday ? "text-primary font-bold" : ""}`}>
                  <div className="text-[9px] md:text-xs uppercase text-muted-foreground">
                    {format(day, "EEEEE", { locale: fr })}
                  </div>
                  <div className={`text-sm md:text-lg ${dayIsToday ? "bg-primary text-primary-foreground rounded-full w-6 h-6 md:w-8 md:h-8 flex items-center justify-center mx-auto text-xs md:text-lg" : ""}`}>
                    {format(day, "d")}
                  </div>
                </div>

                {isLoading ? (
                  <div className="text-[8px] md:text-xs text-muted-foreground text-center">...</div>
                ) : daySessions.length === 0 ? (
                  <div className="text-[8px] md:text-xs text-muted-foreground text-center italic hidden md:block">
                    -
                  </div>
                ) : (
                  <div className="space-y-1 md:space-y-2">
                    {daySessions.slice(0, 3).map((s) => (
                      <div
                        key={s.id}
                        className={`p-1 md:p-2 rounded-md border text-[8px] md:text-xs ${getSessionTypeColor(s.sessionType)}`}
                      >
                        {/* Mobile: compact view */}
                        <div className="md:hidden">
                          <div className="font-medium truncate">
                            {s.athleteFirstName?.charAt(0)}{s.athleteLastName?.charAt(0)}
                          </div>
                          {s.sessionRpe && (
                            <div className="text-[7px] opacity-75">{s.sessionRpe}</div>
                          )}
                        </div>
                        
                        {/* Desktop: full view */}
                        <div className="hidden md:block">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span className="font-medium truncate">
                                {s.athleteFirstName} {s.athleteLastName?.charAt(0)}.
                              </span>
                            </div>
                            <span className="text-[10px] opacity-75">
                              {format(parseISO(s.completedAt), "HH:mm")}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Dumbbell className="h-3 w-3" />
                            <span className="truncate">{s.sessionName}</span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] opacity-75">
                              {getSessionTypeLabel(s.sessionType)}
                            </span>
                            {s.sessionRpe && (
                              <span className="text-[10px] opacity-75">
                                RPE: {s.sessionRpe}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {daySessions.length > 3 && (
                      <div className="text-[8px] md:text-[10px] text-muted-foreground text-center">
                        +{daySessions.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary */}
      {!isLoading && allAthletes.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Résumé de la semaine</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {sessions.length} séance{sessions.length > 1 ? "s" : ""} réalisée{sessions.length > 1 ? "s" : ""} par vos athlètes cette semaine
            </p>
            
            <div className="space-y-2">
              {athleteSessionCounts.map((athlete) => (
                <div 
                  key={athlete.id}
                  className={`flex items-center justify-between p-2 rounded-md ${
                    athlete.sessionCount === 0 
                      ? "bg-muted/50 text-muted-foreground" 
                      : "bg-primary/10"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className={athlete.sessionCount === 0 ? "" : "font-medium"}>
                      {athlete.firstName} {athlete.lastName}
                    </span>
                  </div>
                  <span className={`text-sm ${
                    athlete.sessionCount === 0 
                      ? "text-muted-foreground" 
                      : "font-semibold text-primary"
                  }`}>
                    {athlete.sessionCount} séance{athlete.sessionCount > 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
