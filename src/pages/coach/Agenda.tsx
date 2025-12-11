import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Calendar as CalendarIcon, 
  RefreshCw, 
  Clock, 
  MapPin, 
  Users,
  ChevronLeft,
  ChevronRight,
  Search,
  ExternalLink
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

const N8N_WEBHOOK_URL = "https://n8n-i4coc8gkwgok0s4k0gsscsgw.168.231.84.252.sslip.io/webhook/64ef905d-e4d8-49be-b4f9-f008823baa66";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  htmlLink?: string;
  isAllDay?: boolean;
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
}

export default function Agenda() {
  const [loading, setLoading] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch events from n8n webhook
  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const timeMin = startOfMonth(currentMonth).toISOString();
      const timeMax = endOfMonth(currentMonth).toISOString();

      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeMin,
          timeMax,
          searchQuery: searchQuery || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle different response formats from n8n
      let eventsList: CalendarEvent[] = [];
      if (Array.isArray(data)) {
        eventsList = data;
      } else if (data.events && Array.isArray(data.events)) {
        eventsList = data.events;
      } else if (data.items && Array.isArray(data.items)) {
        // Google Calendar API format
        eventsList = data.items.map((item: any) => ({
          id: item.id,
          title: item.summary || 'Sans titre',
          description: item.description,
          start: item.start?.dateTime || item.start?.date,
          end: item.end?.dateTime || item.end?.date,
          location: item.location,
          htmlLink: item.htmlLink,
          isAllDay: !!item.start?.date && !item.start?.dateTime,
          attendees: item.attendees || [],
        }));
      }

      setEvents(eventsList);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error("Erreur lors de la récupération des événements");
    } finally {
      setLoadingEvents(false);
      setLoading(false);
    }
  }, [currentMonth, searchQuery]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Get events for a specific day
  const getEventsForDay = (date: Date) => {
    return events.filter(event => {
      if (!event.start) return false;
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
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => fetchEvents()}
          disabled={loadingEvents}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loadingEvents ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

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
                        {!event.isAllDay && event.start && event.end && (
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
                        {event.attendees && event.attendees.length > 0 && (
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
    </div>
  );
}
