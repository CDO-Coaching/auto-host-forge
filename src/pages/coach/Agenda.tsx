import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { 
  RefreshCw, 
  Clock, 
  MapPin, 
  Users,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Dumbbell,
  Calendar,
  CheckCircle2
} from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks, isToday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

const N8N_WEBHOOK_URL = "https://n8n-i4coc8gkwgok0s4k0gsscsgw.168.231.84.252.sslip.io/webhook/64ef905d-e4d8-49be-b4f9-f008823baa66";

interface CalendarEvent {
  id: string;
  title: string;
  summary?: string;
  description?: string;
  start: string | { dateTime?: string; date?: string };
  end: string | { dateTime?: string; date?: string };
  location?: string;
  htmlLink?: string;
  isAllDay?: boolean;
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
}

interface AthleteSession {
  id: string;
  athleteId: string;
  athleteName: string;
  sessionName: string;
  sessionType: string;
  completedAt: Date | null;
  weekNumber: number;
}

// Normalize event to extract start/end as string
const normalizeEvent = (event: any): CalendarEvent | null => {
  const startStr = typeof event.start === 'object' 
    ? (event.start?.dateTime || event.start?.date) 
    : event.start;
  const endStr = typeof event.end === 'object' 
    ? (event.end?.dateTime || event.end?.date) 
    : event.end;
  
  if (!startStr) return null;
  
  return {
    id: event.id,
    title: event.summary || event.title || 'Sans titre',
    description: event.description,
    start: startStr,
    end: endStr,
    location: event.location,
    htmlLink: event.htmlLink,
    isAllDay: typeof event.start === 'object' && !!event.start?.date && !event.start?.dateTime,
    attendees: event.attendees || [],
  };
};

export default function Agenda() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [athleteSessions, setAthleteSessions] = useState<AthleteSession[]>([]);
  const [activeTab, setActiveTab] = useState("rdv");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  // Fetch athlete sessions completed during the current week
  const fetchAthleteSessions = useCallback(async () => {
    if (!user) return;

    try {
      const weekStart = currentWeekStart;
      const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
      const weekStartStr = format(weekStart, "yyyy-MM-dd");
      const weekEndStr = format(weekEnd, "yyyy-MM-dd");

      // Get coach's athletes
      const { data: relationships } = await supabase
        .from("coach_athlete_relationships")
        .select("athlete_id")
        .eq("coach_id", user.id)
        .eq("status", "approved");

      if (!relationships || relationships.length === 0) {
        setAthleteSessions([]);
        return;
      }

      const athleteIds = relationships.map((r) => r.athlete_id);

      // Get athlete profiles
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name")
        .in("id", athleteIds);

      const profileMap = new Map(
        profiles?.map((p) => [p.id, `${p.first_name} ${p.last_name}`]) || []
      );

      // Get all sessions completed this calendar week for these athletes
      const { data: sessionsData, error: sessionsError } = await supabase
        .from("training_sessions")
        .select(
          `
          id,
          name,
          session_type,
          completed_at,
          athlete_custom_name,
          training_weeks!inner(
            athlete_id,
            week_number
          )
        `
        )
        .in("training_weeks.athlete_id", athleteIds)
        .not("completed_at", "is", null)
        .gte("completed_at", `${weekStartStr}T00:00:00`)
        .lte("completed_at", `${weekEndStr}T23:59:59`);

      if (sessionsError || !sessionsData) {
        console.error("Error fetching athlete sessions:", sessionsError);
        setAthleteSessions([]);
        return;
      }

      const sessions: AthleteSession[] = sessionsData.map((session: any) => {
        const athleteId = session.training_weeks.athlete_id;
        const athleteName = profileMap.get(athleteId) || "Inconnu";
        return {
          id: session.id,
          athleteId,
          athleteName,
          sessionName: session.athlete_custom_name || session.name,
          sessionType: session.session_type,
          completedAt: session.completed_at ? new Date(session.completed_at) : null,
          weekNumber: session.training_weeks.week_number,
        };
      });

      setAthleteSessions(sessions);
    } catch (error) {
      console.error("Error fetching athlete sessions:", error);
      setAthleteSessions([]);
    }
  }, [user, currentWeekStart]);

  // Fetch events from n8n webhook
  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const timeMin = currentWeekStart.toISOString();
      const timeMax = endOfWeek(currentWeekStart, { weekStartsOn: 1 }).toISOString();

      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeMin,
          timeMax,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('N8N Response:', data);
      
      // Handle different response formats from n8n
      let eventsList: CalendarEvent[] = [];
      
      if (Array.isArray(data)) {
        // n8n returns array of items directly
        eventsList = data
          .map((item: any) => normalizeEvent(item))
          .filter((e): e is CalendarEvent => e !== null);
      } else if (data.events && Array.isArray(data.events)) {
        eventsList = data.events
          .map((item: any) => normalizeEvent(item))
          .filter((e): e is CalendarEvent => e !== null);
      } else if (data.items && Array.isArray(data.items)) {
        eventsList = data.items
          .map((item: any) => normalizeEvent(item))
          .filter((e): e is CalendarEvent => e !== null);
      } else if (data.id && (data.start || data.summary)) {
        // Single event returned
        const normalized = normalizeEvent(data);
        if (normalized) eventsList = [normalized];
      }

      setEvents(eventsList);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error("Erreur lors de la récupération des événements");
    } finally {
      setLoadingEvents(false);
      setLoading(false);
    }
  }, [currentWeekStart]);

  useEffect(() => {
    fetchEvents();
    fetchAthleteSessions();
  }, [fetchEvents, fetchAthleteSessions]);

  // Filter PT events only
  const ptEvents = events.filter(event => 
    event.title.toLowerCase().startsWith('pt')
  );

  // Get PT events for a specific day
  const getPtEventsForDay = (date: Date) => {
    return ptEvents.filter(event => {
      if (!event.start) return false;
      try {
        const eventDate = parseISO(event.start as string);
        return isSameDay(eventDate, date);
      } catch {
        return false;
      }
    });
  };

  // Get athlete sessions by completion date
  const getSessionsForDay = (date: Date) => {
    return athleteSessions.filter(session => {
      if (!session.completedAt) return false;
      return isSameDay(session.completedAt, date);
    });
  };

  // Group sessions by athlete
  const sessionsByAthlete = athleteSessions.reduce((acc, session) => {
    if (!acc[session.athleteId]) {
      acc[session.athleteId] = {
        athleteName: session.athleteName,
        sessions: []
      };
    }
    acc[session.athleteId].sessions.push(session);
    return acc;
  }, {} as Record<string, { athleteName: string; sessions: AthleteSession[] }>);

  // Week days - today first, then following days
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const allWeekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });
  
  // Reorder: put today first, then sort remaining days
  const today = new Date();
  const todayInThisWeek = allWeekDays.find(d => isSameDay(d, today));
  
  let weekDays = allWeekDays;
  if (todayInThisWeek) {
    // Today is in this week - show from today onwards, then days before
    const todayIndex = allWeekDays.findIndex(d => isSameDay(d, today));
    weekDays = [...allWeekDays.slice(todayIndex), ...allWeekDays.slice(0, todayIndex)];
  }
  
  // Filter out days with PT events
  const daysWithPtEvents = weekDays.filter(day => getPtEventsForDay(day).length > 0);

  const goToPreviousWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  const goToNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  const goToToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Get session type badge variant
  const getSessionTypeBadge = (type: string) => {
    switch (type) {
      case 'renfo': return { label: 'Renfo', className: 'bg-blue-500/20 text-blue-700 dark:text-blue-300' };
      case 'course': return { label: 'Course', className: 'bg-green-500/20 text-green-700 dark:text-green-300' };
      case 'velo': return { label: 'Vélo', className: 'bg-purple-500/20 text-purple-700 dark:text-purple-300' };
      case 'natation': return { label: 'Natation', className: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300' };
      case 'recup': return { label: 'Récup', className: 'bg-orange-500/20 text-orange-700 dark:text-orange-300' };
      default: return { label: type, className: 'bg-muted' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-2 sm:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Agenda</h1>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={goToToday}
          >
            Aujourd'hui
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => {
              fetchEvents();
              fetchAthleteSessions();
            }}
            disabled={loadingEvents}
          >
            <RefreshCw className={`h-4 w-4 ${loadingEvents ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Week navigation */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={goToPreviousWeek}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <CardTitle className="text-base sm:text-lg capitalize text-center">
              Semaine du {format(currentWeekStart, "d MMM", { locale: fr })} au {format(weekEnd, "d MMM yyyy", { locale: fr })}
            </CardTitle>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={goToNextWeek}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="rdv" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Rendez-vous PT</span>
            <span className="sm:hidden">RDV</span>
          </TabsTrigger>
          <TabsTrigger value="seances" className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4" />
            <span className="hidden sm:inline">Séances sportifs</span>
            <span className="sm:hidden">Séances</span>
          </TabsTrigger>
        </TabsList>

        {/* PT Events Tab */}
        <TabsContent value="rdv" className="mt-4">
          <div className="grid grid-cols-1 gap-3">
            {daysWithPtEvents.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Aucun rendez-vous PT cette semaine
                </CardContent>
              </Card>
            ) : daysWithPtEvents.map(day => {
              const dayEvents = getPtEventsForDay(day);
              const isCurrentDay = isToday(day);
              
              return (
                <Card 
                  key={day.toISOString()} 
                  className={`${isCurrentDay ? 'ring-2 ring-primary' : ''}`}
                >
                  <CardHeader className="py-3 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className={`text-sm sm:text-base capitalize ${isCurrentDay ? 'text-primary' : ''}`}>
                        {format(day, "EEEE d MMMM", { locale: fr })}
                      </CardTitle>
                      {dayEvents.length > 0 && (
                        <Badge variant="secondary">{dayEvents.length}</Badge>
                      )}
                      {isCurrentDay && (
                        <Badge variant="default" className="ml-2">Aujourd'hui</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ScrollArea className={dayEvents.length > 3 ? "h-[200px]" : ""}>
                      <div className="space-y-2">
                        {dayEvents.map(event => (
                          <div 
                            key={event.id} 
                            className="p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-medium text-sm">{event.title}</h3>
                              {event.htmlLink && (
                                <a
                                  href={event.htmlLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-primary shrink-0"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              )}
                            </div>
                            
                            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                              {!event.isAllDay && event.start && event.end && (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(parseISO(event.start as string), 'HH:mm')} - {format(parseISO(event.end as string), 'HH:mm')}
                                </div>
                              )}
                              {event.location && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  <span className="truncate max-w-[150px]">{event.location}</span>
                                </div>
                              )}
                              {event.attendees && event.attendees.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {event.attendees.length}
                                </div>
                              )}
                            </div>

                            {event.description && (
                              <p className="mt-2 text-xs text-muted-foreground line-clamp-1">
                                {event.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Athlete Sessions Tab */}
        <TabsContent value="seances" className="mt-4">
          {/* Compact week calendar grid */}
          <Card className="mb-4">
            <CardContent className="p-3">
              <div className="grid grid-cols-7 gap-1">
                {allWeekDays.map(day => {
                  const daySessions = getSessionsForDay(day);
                  const isCurrentDay = isToday(day);
                  const isSelected = selectedDay && isSameDay(day, selectedDay);
                  const hasCompletedSessions = daySessions.length > 0;
                  
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDay(isSelected ? null : day)}
                      className={`
                        flex flex-col items-center p-2 rounded-lg transition-all cursor-pointer
                        ${isSelected ? 'ring-2 ring-primary bg-primary/10' : ''}
                        ${isCurrentDay && !isSelected ? 'bg-primary/5' : ''}
                        ${!isSelected && !isCurrentDay ? 'hover:bg-muted/50' : ''}
                      `}
                    >
                      <span className={`text-xs font-medium capitalize ${isCurrentDay ? 'text-primary' : 'text-muted-foreground'}`}>
                        {format(day, "EEE", { locale: fr })}
                      </span>
                      <span className={`text-lg font-bold ${isCurrentDay ? 'text-primary' : ''}`}>
                        {format(day, "d")}
                      </span>
                      {hasCompletedSessions ? (
                        <div className="flex items-center gap-1 mt-1">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                            {daySessions.length}
                          </span>
                        </div>
                      ) : (
                        <div className="h-4 mt-1" />
                      )}
                    </button>
                  );
                })}
              </div>
              
              {/* Total count */}
              <div className="mt-3 pt-3 border-t flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>
                  {athleteSessions.length} séance{athleteSessions.length > 1 ? 's' : ''} validée{athleteSessions.length > 1 ? 's' : ''} cette semaine
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Selected day details */}
          {selectedDay && (
            <Card>
              <CardHeader className="py-3 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm sm:text-base capitalize">
                    {format(selectedDay, "EEEE d MMMM", { locale: fr })}
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedDay(null)}
                    className="h-8 w-8 p-0"
                  >
                    ×
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {getSessionsForDay(selectedDay).length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">
                    Aucune séance validée ce jour
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {getSessionsForDay(selectedDay).map(session => {
                      const typeBadge = getSessionTypeBadge(session.sessionType);
                      
                      return (
                        <div 
                          key={session.id}
                          className="p-2 rounded-lg border bg-green-500/10 border-green-500/30"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                              <span className="font-medium text-sm">{session.athleteName}</span>
                            </div>
                            <Badge className={`${typeBadge.className} text-xs px-1.5 py-0`} variant="secondary">
                              {typeBadge.label}
                            </Badge>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground pl-5">
                            <span>{session.sessionName}</span>
                            {session.completedAt && (
                              <span>{format(session.completedAt, "HH:mm")}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* No day selected - show hint */}
          {!selectedDay && athleteSessions.length > 0 && (
            <p className="text-center text-sm text-muted-foreground">
              Cliquez sur un jour pour voir les détails
            </p>
          )}

          {/* No sessions this week */}
          {athleteSessions.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Aucune séance validée cette semaine
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
