import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseISO, isBefore } from "date-fns";

const N8N_WEBHOOK_URL = "https://n8n-i4coc8gkwgok0s4k0gsscsgw.168.231.84.252.sslip.io/webhook/64ef905d-e4d8-49be-b4f9-f008823baa66";

interface CalendarEvent {
  id: string;
  title?: string;
  summary?: string;
  start: string | { dateTime?: string; date?: string };
  end: string | { dateTime?: string; date?: string };
  attendees?: { email: string; displayName?: string }[];
}

interface NoteReminder {
  eventId: string;
  eventTitle: string;
  clientEmail: string;
  endTime: Date;
}

export function useCoachNoteReminder() {
  const [pendingReminder, setPendingReminder] = useState<NoteReminder | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkForReminders = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Verify coach role
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || profile.role !== "coach") {
        setIsLoading(false);
        return;
      }

      // Fetch today's events
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeMin: startOfDay.toISOString(),
          timeMax: endOfDay.toISOString(),
        }),
      });

      if (!response.ok) {
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      let events: CalendarEvent[] = [];

      if (Array.isArray(data)) {
        events = data;
      } else if (data.events) {
        events = data.events;
      } else if (data.items) {
        events = data.items;
      }

      // Filter events starting with "Pt" (case insensitive) that have ended
      const ptEvents = events.filter(event => {
        const title = event.summary || event.title || '';
        return title.toLowerCase().startsWith('pt');
      });

      // Find completed PT events not yet acknowledged
      for (const event of ptEvents) {
        const endStr = typeof event.end === 'object' 
          ? ((event.end as any)?.dateTime || (event.end as any)?.date) 
          : event.end;
        
        if (!endStr) continue;

        const eventEnd = parseISO(endStr);
        const eventId = event.id;

        // Check if event has ended
        if (!isBefore(eventEnd, now)) continue;

        // Check if already acknowledged today
        const acknowledgedKey = `note_reminder_${user.id}_${eventId}`;
        if (localStorage.getItem(acknowledgedKey)) continue;

        // Get the second attendee's email (index 1, coach is usually index 0)
        const attendees = event.attendees || [];
        const secondAttendee = attendees.length > 1 ? attendees[1] : attendees[0];
        const clientEmail = secondAttendee?.email || '';

        if (clientEmail) {
          setPendingReminder({
            eventId,
            eventTitle: event.summary || event.title || 'Séance PT',
            clientEmail,
            endTime: eventEnd,
          });
          break; // Show one reminder at a time
        }
      }
    } catch (error) {
      console.error("Error checking for note reminders:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkForReminders();
  }, [checkForReminders]);

  const acknowledgeReminder = async (navigateToNotes: boolean) => {
    if (!pendingReminder) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const acknowledgedKey = `note_reminder_${user.id}_${pendingReminder.eventId}`;
      localStorage.setItem(acknowledgedKey, 'true');
    }

    setPendingReminder(null);
    return navigateToNotes;
  };

  return {
    pendingReminder,
    isLoading,
    acknowledgeReminder,
  };
}
