import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";
import { AthleteMilestoneDialog } from "@/components/AthleteMilestoneDialog";
import { 
  RefreshCw, 
  Calendar as CalendarIcon, 
  Dumbbell,
  User,
  Clock,
  MapPin,
  ChevronRight,
  Target,
  Plus,
  Edit2
} from "lucide-react";
import { format, startOfMonth, endOfMonth, isSameDay, parseISO, isAfter, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";

const N8N_WEBHOOK_URL = "https://n8n-i4coc8gkwgok0s4k0gsscsgw.168.231.84.252.sslip.io/webhook/64ef905d-e4d8-49be-b4f9-f008823baa66";

interface TrainingSession {
  id: string;
  name: string;
  week_id: string;
  session_type: string;
  completed_at: string;
  isCustom?: boolean;
  isScheduled?: boolean;
  scheduled_date?: string;
  athlete_custom_name?: string;
}

interface TrainingDay {
  date: Date;
  sessions: TrainingSession[];
}

interface Appointment {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  coachName: string;
}

interface Milestone {
  id: string;
  label: string;
  target_date: string;
  notes: string | null;
  completed: boolean;
}

export default function Agenda() {
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [trainingDays, setTrainingDays] = useState<TrainingDay[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [coachName, setCoachName] = useState<string>("");
  const [showMilestoneDialog, setShowMilestoneDialog] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);

  // Fetch coach name
  useEffect(() => {
    const fetchCoachName = async () => {
      if (!profile?.id) return;

      const { data: relationship } = await supabase
        .from("coach_athlete_relationships")
        .select("coach_id")
        .eq("athlete_id", profile.id)
        .eq("status", "approved")
        .single();

      if (relationship) {
        const { data: coachProfile } = await supabase
          .from("user_profiles")
          .select("first_name")
          .eq("id", relationship.coach_id)
          .single();

        if (coachProfile) {
          setCoachName(coachProfile.first_name);
        }
      }
    };

    fetchCoachName();
  }, [profile?.id]);

  // Fetch milestones
  const fetchMilestones = useCallback(async () => {
    if (!profile?.id) return;

    const { data, error } = await supabase
      .from("objective_milestones")
      .select("*")
      .eq("athlete_id", profile.id)
      .order("target_date", { ascending: true });

    if (!error && data) {
      setMilestones(data);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  // Fetch training sessions, custom sessions and scheduled sessions for the month
  useEffect(() => {
    const fetchAllSessions = async () => {
      if (!profile?.id) return;

      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      
      // Use date strings for comparison (YYYY-MM-DD format)
      const monthStartStr = format(monthStart, "yyyy-MM-dd");
      const monthEndStr = format(monthEnd, "yyyy-MM-dd");

      // First get athlete's weeks
      const { data: weeks, error: weeksError } = await supabase
        .from("training_weeks")
        .select("id")
        .eq("athlete_id", profile.id);

      const weekIds = weeks?.map(w => w.id) || [];

      // Fetch regular sessions (completed) if we have weeks
      let regularSessions: any[] = [];
      let scheduledSessions: any[] = [];
      
      if (weekIds.length > 0) {
        // Completed sessions
        const { data: completed, error } = await supabase
          .from("training_sessions")
          .select("id, name, week_id, session_type, completed_at, athlete_custom_name")
          .in("week_id", weekIds)
          .not("completed_at", "is", null)
          .gte("completed_at", `${monthStartStr}T00:00:00`)
          .lte("completed_at", `${monthEndStr}T23:59:59`);

        if (!error && completed) {
          regularSessions = completed;
        }

        // Scheduled sessions (not completed yet)
        const { data: scheduled, error: scheduledError } = await supabase
          .from("training_sessions")
          .select("id, name, week_id, session_type, scheduled_date, athlete_custom_name")
          .in("week_id", weekIds)
          .is("completed_at", null)
          .not("scheduled_date", "is", null)
          .gte("scheduled_date", monthStartStr)
          .lte("scheduled_date", monthEndStr);

        if (!scheduledError && scheduled) {
          scheduledSessions = scheduled;
        }
      }

      // Fetch custom sessions - use broader date filtering
      const { data: customSessions, error: customError } = await supabase
        .from("custom_sessions")
        .select("id, session_name, completed_at")
        .eq("user_id", profile.id)
        .not("completed_at", "is", null)
        .gte("completed_at", `${monthStartStr}T00:00:00`)
        .lte("completed_at", `${monthEndStr}T23:59:59`);

      if (customError) {
        console.error("Error fetching custom sessions:", customError);
      }

      // Group all sessions by date
      const dayMap = new Map<string, TrainingSession[]>();
      
      // Add completed regular sessions
      regularSessions.forEach(session => {
        if (session.completed_at) {
          const dateKey = format(new Date(session.completed_at), "yyyy-MM-dd");
          const existing = dayMap.get(dateKey) || [];
          existing.push({
            id: session.id,
            name: session.athlete_custom_name || session.name || 'Séance',
            week_id: session.week_id,
            session_type: session.session_type || 'renfo',
            completed_at: session.completed_at,
            isCustom: false,
            isScheduled: false
          });
          dayMap.set(dateKey, existing);
        }
      });

      // Add scheduled sessions
      scheduledSessions.forEach(session => {
        if (session.scheduled_date) {
          const dateKey = session.scheduled_date;
          const existing = dayMap.get(dateKey) || [];
          existing.push({
            id: session.id,
            name: session.athlete_custom_name || session.name || 'Séance',
            week_id: session.week_id,
            session_type: session.session_type || 'renfo',
            completed_at: '',
            isCustom: false,
            isScheduled: true,
            scheduled_date: session.scheduled_date,
            athlete_custom_name: session.athlete_custom_name
          });
          dayMap.set(dateKey, existing);
        }
      });

      // Add custom sessions
      if (customSessions) {
        customSessions.forEach(session => {
          if (session.completed_at) {
            const dateKey = format(new Date(session.completed_at), "yyyy-MM-dd");
            const existing = dayMap.get(dateKey) || [];
            existing.push({
              id: session.id,
              name: session.session_name || 'Séance perso',
              week_id: '',
              session_type: 'renfo', // Custom sessions default to renfo
              completed_at: session.completed_at,
              isCustom: true,
              isScheduled: false
            });
            dayMap.set(dateKey, existing);
          }
        });
      }

      const trainingDaysArray: TrainingDay[] = [];
      dayMap.forEach((sessionsForDay, dateKey) => {
        trainingDaysArray.push({
          date: new Date(dateKey),
          sessions: sessionsForDay
        });
      });

      setTrainingDays(trainingDaysArray);
    };

    fetchAllSessions();
  }, [profile?.id, currentMonth]);

  // Fetch appointments from Google Calendar
  const fetchAppointments = useCallback(async () => {
    if (!profile?.email) {
      setLoading(false);
      return;
    }

    try {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeMin: monthStart.toISOString(),
          timeMax: monthEnd.toISOString(),
        }),
      });

      if (!response.ok) {
        setLoading(false);
        return;
      }

      const data = await response.json();
      let events: any[] = [];

      if (Array.isArray(data)) {
        events = data;
      } else if (data.events) {
        events = data.events;
      } else if (data.items) {
        events = data.items;
      }

      // Filter events where the athlete is an attendee and it's a PT session
      const athleteEmail = profile.email.toLowerCase();
      const filteredAppointments: Appointment[] = events
        .filter(event => {
          const title = (event.summary || event.title || '').toLowerCase();
          const attendees = event.attendees || [];
          const isAttendee = attendees.some((a: any) => 
            a.email?.toLowerCase() === athleteEmail
          );
          return title.startsWith('pt') && isAttendee;
        })
        .map(event => {
          const startStr = typeof event.start === 'object' 
            ? (event.start?.dateTime || event.start?.date) 
            : event.start;
          const endStr = typeof event.end === 'object' 
            ? (event.end?.dateTime || event.end?.date) 
            : event.end;

          return {
            id: event.id,
            title: event.summary || event.title || 'Rendez-vous',
            start: startStr,
            end: endStr,
            location: event.location,
            coachName: coachName || 'ton coach'
          };
        })
        .filter(apt => {
          // Only show future appointments
          const aptDate = parseISO(apt.start);
          return isAfter(aptDate, startOfDay(new Date()));
        });

      setAppointments(filteredAppointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    } finally {
      setLoading(false);
    }
  }, [profile?.email, currentMonth, coachName]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Check if a date has training
  const getTrainingForDate = (date: Date) => {
    return trainingDays.find(td => isSameDay(td.date, date));
  };

  // Get appointments for a date
  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter(apt => {
      try {
        return isSameDay(parseISO(apt.start), date);
      } catch {
        return false;
      }
    });
  };

  // Get milestones for a date
  const getMilestonesForDate = (date: Date) => {
    return milestones.filter(m => {
      try {
        return isSameDay(parseISO(m.target_date), date);
      } catch {
        return false;
      }
    });
  };

  // Custom day render for calendar
  const scheduledDates = trainingDays
    .filter(td => td.sessions.some(s => s.isScheduled))
    .map(td => td.date);
  
  const completedDates = trainingDays
    .filter(td => td.sessions.some(s => !s.isScheduled && !s.isCustom))
    .map(td => td.date);

  const milestoneDates = milestones.map(m => {
    try {
      return parseISO(m.target_date);
    } catch {
      return new Date(0);
    }
  });

  const modifiers = {
    training: completedDates,
    scheduled: scheduledDates,
    appointment: appointments.map(apt => {
      try {
        return parseISO(apt.start);
      } catch {
        return new Date(0);
      }
    }),
    milestone: milestoneDates
  };

  const modifiersStyles = {
    training: {
      border: '2px solid hsl(142 76% 36%)',
      borderRadius: '50%'
    },
    scheduled: {
      border: '2px solid hsl(25 95% 53%)',
      borderRadius: '50%',
      backgroundColor: 'hsl(25 95% 53% / 0.1)'
    },
    appointment: {
      border: '2px solid hsl(var(--destructive))',
      borderRadius: '50%'
    },
    milestone: {
      border: '2px solid hsl(280 70% 50%)',
      borderRadius: '50%',
      backgroundColor: 'hsl(280 70% 50% / 0.15)'
    }
  };

  // Get info for selected date
  const selectedTraining = selectedDate ? getTrainingForDate(selectedDate) : null;
  const selectedAppointments = selectedDate ? getAppointmentsForDate(selectedDate) : [];
  const selectedMilestones = selectedDate ? getMilestonesForDate(selectedDate) : [];

  return (
    <div className="space-y-4 p-2 sm:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <CalendarIcon className="h-6 w-6" />
          Mon Agenda
        </h1>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            setLoading(true);
            fetchAppointments();
          }}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-green-600" />
          <span>Séance faite</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-orange-500 bg-orange-500/10" />
          <span>Séance programmée</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-destructive" />
          <span>Rendez-vous coach</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 bg-purple-500/15" style={{ borderColor: 'hsl(280 70% 50%)' }} />
          <span>Objectif</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Calendar */}
        <Card>
          <CardContent className="p-3 sm:p-6">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              locale={fr}
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
              className="w-full pointer-events-auto"
            />
          </CardContent>
        </Card>

        {/* Selected day details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg capitalize">
              {selectedDate 
                ? format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })
                : "Sélectionne un jour"
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-4">
                {/* Training info */}
                {selectedTraining && selectedTraining.sessions.length > 0 && (
                  <div className="space-y-2">
                    {selectedTraining.sessions.map(session => {
                      const getSessionRoute = () => {
                        if (session.isCustom) return null;
                        if (session.session_type === 'recup') {
                          return `/sportif/recup/${session.week_id}/${session.id}`;
                        }
                        return `/sportif/seance/${session.week_id}/${session.id}`;
                      };

                      const route = getSessionRoute();

                      if (session.isCustom) {
                        // Séance perso - non cliquable
                        return (
                          <div
                            key={session.id}
                            className="w-full p-4 rounded-lg bg-blue-500/10 border border-blue-600/30"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-blue-600 font-medium">
                                <Dumbbell className="h-5 w-5" />
                                <span>{session.name}</span>
                              </div>
                              <Badge variant="outline" className="border-blue-600 text-blue-600 text-xs">
                                Perso
                              </Badge>
                            </div>
                          </div>
                        );
                      }

                      if (session.isScheduled) {
                        // Séance programmée - à faire
                        return (
                          <button
                            key={session.id}
                            onClick={() => route && navigate(route)}
                            className="w-full p-4 rounded-lg bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20 transition-colors text-left"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-medium">
                                <Dumbbell className="h-5 w-5" />
                                <span>{session.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="border-orange-500 text-orange-600 dark:text-orange-400 text-xs">
                                  À faire
                                </Badge>
                                <ChevronRight className="h-5 w-5 text-orange-500" />
                              </div>
                            </div>
                          </button>
                        );
                      }

                      // Séance complétée
                      return (
                        <button
                          key={session.id}
                          onClick={() => route && navigate(route)}
                          className="w-full p-4 rounded-lg bg-green-500/10 border border-green-600/30 hover:bg-green-500/20 transition-colors text-left"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-green-600 font-medium">
                              <Dumbbell className="h-5 w-5" />
                              <span>{session.name}</span>
                            </div>
                            <ChevronRight className="h-5 w-5 text-green-600" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Appointments */}
                {selectedAppointments.length > 0 && (
                  <div className="space-y-3">
                    {selectedAppointments.map(apt => (
                      <div 
                        key={apt.id}
                        className="p-4 rounded-lg bg-destructive/10 border border-destructive/30"
                      >
                        <div className="flex items-center gap-2 text-destructive font-medium">
                          <User className="h-5 w-5" />
                          <span>Rendez-vous avec {coachName || 'ton coach'}</span>
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>
                              {format(parseISO(apt.start), 'HH:mm')} - {format(parseISO(apt.end), 'HH:mm')}
                            </span>
                          </div>
                          {apt.location && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              <span className="truncate">{apt.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Milestones for selected day */}
                {selectedMilestones.length > 0 && (
                  <div className="space-y-2">
                    {selectedMilestones.map(milestone => (
                      <button
                        key={milestone.id}
                        onClick={() => {
                          setEditingMilestone(milestone);
                          setShowMilestoneDialog(true);
                        }}
                        className="w-full p-4 rounded-lg bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-colors text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-medium">
                            <Target className="h-5 w-5" />
                            <span>{milestone.label}</span>
                          </div>
                          <Edit2 className="h-4 w-4 text-purple-500" />
                        </div>
                        {milestone.notes && (
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                            {milestone.notes}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* No events */}
                {!selectedTraining && selectedAppointments.length === 0 && selectedMilestones.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Rien de prévu ce jour</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming appointments section */}
      {appointments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-destructive" />
              Tes prochains rendez-vous
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {appointments
                .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
                .map(apt => (
                  <div 
                    key={apt.id}
                    className="p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          Tu as rendez-vous avec {coachName || 'ton coach'}
                        </p>
                        <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="h-4 w-4" />
                            {format(parseISO(apt.start), "EEEE d MMMM", { locale: fr })}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {format(parseISO(apt.start), 'HH:mm')}
                          </div>
                          {apt.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              <span className="truncate max-w-[150px]">{apt.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 border-destructive text-destructive">
                        RDV
                      </Badge>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Objectives section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-500" />
              Mes dates d'objectifs
            </CardTitle>
            <Button
              size="sm"
              onClick={() => {
                setEditingMilestone(null);
                setShowMilestoneDialog(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {milestones.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Target className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Aucune date d'objectif définie</p>
              <p className="text-sm mt-1">Ajoute tes prochaines échéances importantes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {milestones
                .sort((a, b) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime())
                .map(milestone => {
                  const targetDate = parseISO(milestone.target_date);
                  const isPast = targetDate < startOfDay(new Date());
                  
                  return (
                    <button
                      key={milestone.id}
                      onClick={() => {
                        setEditingMilestone(milestone);
                        setShowMilestoneDialog(true);
                      }}
                      className={`w-full p-4 rounded-lg border transition-colors text-left ${
                        isPast 
                          ? 'bg-muted/50 border-muted-foreground/20 opacity-60' 
                          : 'bg-purple-500/5 border-purple-500/20 hover:bg-purple-500/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-medium flex items-center gap-2">
                            <Target className="h-4 w-4 text-purple-500" />
                            {milestone.label}
                          </p>
                          <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <CalendarIcon className="h-4 w-4" />
                              {format(targetDate, "EEEE d MMMM yyyy", { locale: fr })}
                            </div>
                          </div>
                          {milestone.notes && (
                            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                              {milestone.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isPast ? (
                            <Badge variant="secondary" className="shrink-0">Passé</Badge>
                          ) : (
                            <Badge variant="outline" className="shrink-0 border-purple-500 text-purple-600 dark:text-purple-400">
                              Objectif
                            </Badge>
                          )}
                          <Edit2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Milestone Dialog */}
      <AthleteMilestoneDialog
        open={showMilestoneDialog}
        onOpenChange={setShowMilestoneDialog}
        milestone={editingMilestone}
        onSaved={fetchMilestones}
      />
    </div>
  );
}
