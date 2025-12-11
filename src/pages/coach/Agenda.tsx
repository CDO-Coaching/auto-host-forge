import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Calendar as CalendarIcon, 
  RefreshCw, 
  Link2, 
  Link2Off, 
  Clock, 
  MapPin, 
  Users,
  ChevronLeft,
  ChevronRight,
  Search,
  ExternalLink
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: string;
  end: string;
  location: string;
  htmlLink: string;
  isAllDay: boolean;
  attendees: { email: string; displayName?: string; responseStatus?: string }[];
}

export default function Agenda() {
  const { session } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [searchQuery, setSearchQuery] = useState("");

  // Check connection status
  const checkConnection = useCallback(async () => {
    if (!session?.access_token) return;
    
    try {
      const response = await fetch(
        `https://supabasekong.cdocoaching.com/functions/v1/google-calendar-auth`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      setIsConnected(data.connected);
    } catch (error) {
      console.error('Error checking connection:', error);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    if (!session?.access_token || !isConnected) return;

    setLoadingEvents(true);
    try {
      const timeMin = startOfMonth(currentMonth).toISOString();
      const timeMax = endOfMonth(currentMonth).toISOString();

      const url = new URL(`https://supabasekong.cdocoaching.com/functions/v1/google-calendar-events`);
      url.searchParams.set('timeMin', timeMin);
      url.searchParams.set('timeMax', timeMax);
      if (searchQuery) {
        url.searchParams.set('q', searchQuery);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.error) {
        if (data.error.includes('reconnect')) {
          setIsConnected(false);
          toast.error("Session expirée, veuillez reconnecter Google Calendar");
        } else {
          toast.error(data.error);
        }
        return;
      }

      setEvents(data.events || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error("Erreur lors de la récupération des événements");
    } finally {
      setLoadingEvents(false);
    }
  }, [session?.access_token, isConnected, currentMonth, searchQuery]);

  // Connect to Google Calendar
  const handleConnect = async () => {
    if (!session?.access_token) return;

    try {
      const response = await fetch(
        `https://supabasekong.cdocoaching.com/functions/v1/google-calendar-auth`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            frontendUrl: window.location.href,
          }),
        }
      );

      const data = await response.json();
      
      if (data.authUrl) {
        // Open OAuth popup
        const popup = window.open(data.authUrl, 'google-oauth', 'width=600,height=700');
        
        // Listen for message from popup
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'google-calendar-connected') {
            setIsConnected(true);
            toast.success("Google Calendar connecté !");
            window.removeEventListener('message', handleMessage);
          }
        };
        window.addEventListener('message', handleMessage);
      }
    } catch (error) {
      console.error('Error connecting:', error);
      toast.error("Erreur de connexion à Google Calendar");
    }
  };

  // Disconnect from Google Calendar
  const handleDisconnect = async () => {
    if (!session?.access_token) return;

    try {
      const response = await fetch(
        `https://supabasekong.cdocoaching.com/functions/v1/google-calendar-auth`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        setIsConnected(false);
        setEvents([]);
        toast.success("Google Calendar déconnecté");
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error("Erreur de déconnexion");
    }
  };

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    if (isConnected) {
      fetchEvents();
    }
  }, [isConnected, fetchEvents]);

  // Get events for a specific day
  const getEventsForDay = (date: Date) => {
    return events.filter(event => {
      const eventDate = parseISO(event.start);
      return isSameDay(eventDate, date);
    });
  };

  // Get events for selected date
  const selectedDateEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  // Calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Day names
  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  // Get starting day offset (Monday = 0)
  const startDayOffset = (monthStart.getDay() + 6) % 7;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold">Agenda</h1>
        
        {isConnected ? (
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => fetchEvents()}
              disabled={loadingEvents}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingEvents ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={handleDisconnect}
            >
              <Link2Off className="h-4 w-4 mr-2" />
              Déconnecter
            </Button>
          </div>
        ) : (
          <Button onClick={handleConnect}>
            <Link2 className="h-4 w-4 mr-2" />
            Connecter Google Calendar
          </Button>
        )}
      </div>

      {!isConnected ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <CalendarIcon className="h-16 w-16 mx-auto text-muted-foreground" />
              <h2 className="text-lg font-semibold">Connectez votre Google Calendar</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Synchronisez vos rendez-vous de coaching depuis Google Calendar pour les voir directement dans l'application.
              </p>
              <Button onClick={handleConnect} size="lg">
                <Link2 className="h-5 w-5 mr-2" />
                Connecter Google Calendar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Calendar view */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <CardTitle className="text-lg capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: fr })}
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Search */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filtrer par mot-clé (coaching, séance...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchEvents()}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Day names */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {dayNames.map(day => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells for offset */}
                {Array.from({ length: startDayOffset }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                
                {/* Days */}
                {monthDays.map(day => {
                  const dayEvents = getEventsForDay(day);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isCurrentDay = isToday(day);
                  
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDate(day)}
                      className={`
                        aspect-square p-1 rounded-lg text-sm relative transition-colors
                        ${isSelected ? 'bg-primary text-primary-foreground' : ''}
                        ${isCurrentDay && !isSelected ? 'bg-primary/20 font-bold' : ''}
                        ${!isSelected && !isCurrentDay ? 'hover:bg-muted' : ''}
                      `}
                    >
                      <span>{format(day, 'd')}</span>
                      {dayEvents.length > 0 && (
                        <div className={`
                          absolute bottom-1 left-1/2 -translate-x-1/2 
                          w-1.5 h-1.5 rounded-full
                          ${isSelected ? 'bg-primary-foreground' : 'bg-primary'}
                        `} />
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Events list */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">
                {selectedDate 
                  ? format(selectedDate, "EEEE d MMMM", { locale: fr })
                  : "Sélectionnez une date"
                }
              </CardTitle>
              {selectedDateEvents.length > 0 && (
                <Badge variant="secondary">{selectedDateEvents.length} événement(s)</Badge>
              )}
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                {selectedDateEvents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Aucun événement ce jour
                  </p>
                ) : (
                  <div className="space-y-3">
                    {selectedDateEvents.map(event => (
                      <div 
                        key={event.id} 
                        className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-medium text-sm">{event.title}</h3>
                          {event.htmlLink && (
                            <a
                              href={event.htmlLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                        
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {!event.isAllDay && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(parseISO(event.start), 'HH:mm')} - {format(parseISO(event.end), 'HH:mm')}
                            </div>
                          )}
                          {event.isAllDay && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Toute la journée
                            </div>
                          )}
                          {event.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </div>
                          )}
                          {event.attendees.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {event.attendees.length} participant(s)
                            </div>
                          )}
                        </div>

                        {event.description && (
                          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                            {event.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
