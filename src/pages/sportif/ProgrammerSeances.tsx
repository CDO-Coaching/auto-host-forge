import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getCardioEstimatedDuration, isCardioSession as checkCardio } from "@/lib/cardioEstimatedDuration";
import { getWeekNumber, getWeekYear, getMondayOfWeek } from "@/lib/weekUtils";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CalendarDays,
  ArrowLeft,
  Plus,
  X,
  ArrowUp,
  ArrowDown,
  Dumbbell,
  CalendarClock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Construit le lien "Ajouter à Google Agenda" (heure locale, pas de compte requis)
function googleCalendarUrl(title: string, start: Date, durationMin: number, details?: string) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const end = new Date(start.getTime() + durationMin * 60000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${fmt(start)}/${fmt(end)}`,
  });
  if (details) params.set("details", details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

interface SessionToSchedule {
  id: string;
  name: string;
  athlete_custom_name: string | null;
  session_type: string;
  session_number: number;
  scheduled_date: string | null;
  exerciseCount: number;
  estimatedDuration: string | null;
}

// Assignments: day -> ordered list of session ids
type DayAssignments = Record<string, string[]>;

export default function ProgrammerSeances() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [sessions, setSessions] = useState<SessionToSchedule[]>([]);
  const [customSessions, setCustomSessions] = useState<any[]>([]);
  const [dayAssignments, setDayAssignments] = useState<DayAssignments>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickingDay, setPickingDay] = useState<string | null>(null); // session id being placed
  const [orderDialogDay, setOrderDialogDay] = useState<string | null>(null);
  const [agendaTarget, setAgendaTarget] = useState<{ title: string; estimatedDuration: string | null; defaultDate: string | null } | null>(null);

  const now = new Date();
  const monday = getMondayOfWeek(now);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();
  const isPast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const loadSessions = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);

    // Fetch VMA for cardio duration
    let athleteVma: number | null = null;
    const { data: profileData } = await supabase.from("user_profiles").select("vma").eq("id", session.user.id).single();
    if (profileData?.vma) athleteVma = profileData.vma;

    const weekNumber = getWeekNumber(now);
    const year = getWeekYear(now);

    const { data: week } = await supabase
      .from("training_weeks")
      .select("id")
      .eq("week_number", weekNumber)
      .eq("year", year)
      .eq("validated", true)
      .maybeSingle();

    if (!week) {
      setLoading(false);
      return;
    }

    const { data: sessionsData } = await supabase
      .from("training_sessions")
      .select(
        "id, name, athlete_custom_name, session_type, session_number, scheduled_date, duration_minutes, session_exercises(sportif_rpe, skipped, cardio_content, cardio_sport)"
      )
      .eq("week_id", week.id)
      .order("session_number");

    // Fetch planned custom sessions for this week
    const mondayStr = format(monday, "yyyy-MM-dd");
    const sundayStr = format(addDays(monday, 6), "yyyy-MM-dd");
    const { data: customData } = await (supabase.from("custom_sessions") as any)
      .select("*")
      .eq("user_id", session.user.id)
      .is("completed_at", null)
      .gte("scheduled_date", mondayStr)
      .lte("scheduled_date", sundayStr);

    setCustomSessions(customData || []);

    if (!sessionsData) {
      setLoading(false);
      return;
    }

    // Filter out completed sessions
    const uncompleted = sessionsData.filter((s: any) => {
      if (s.session_type === "recup") {
        return !(s.duration_minutes !== null && s.duration_minutes !== undefined);
      }
      const exercises = s.session_exercises || [];
      if (exercises.length === 0) return true;
      return !exercises.every(
        (ex: any) =>
          (ex.sportif_rpe !== null && ex.sportif_rpe !== undefined) ||
          ex.skipped === true
      );
    });

    const mapped: SessionToSchedule[] = uncompleted.map((s: any) => ({
      id: s.id,
      name: s.name,
      athlete_custom_name: s.athlete_custom_name,
      session_type: s.session_type,
      session_number: s.session_number,
      scheduled_date: s.scheduled_date,
      exerciseCount: s.session_exercises?.length || 0,
      estimatedDuration: checkCardio(s) ? getCardioEstimatedDuration(s.session_exercises || [], athleteVma) : null,
    }));

    setSessions(mapped);

    // Build initial day assignments from existing scheduled_date
    const initial: DayAssignments = {};
    mapped.forEach((s) => {
      if (s.scheduled_date) {
        if (!initial[s.scheduled_date]) initial[s.scheduled_date] = [];
        initial[s.scheduled_date].push(s.id);
      }
    });
    setDayAssignments(initial);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Get unassigned sessions
  const assignedIds = new Set(Object.values(dayAssignments).flat());
  const unassigned = sessions.filter((s) => !assignedIds.has(s.id));

  const getSession = (id: string) => sessions.find((s) => s.id === id);

  const getTypeColor = (type: string) => {
    switch (type) {
      case "recup":
        return "border-purple-500/50 bg-purple-500/10 text-purple-600 dark:text-purple-400";
      case "cardio":
        return "border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400";
      default:
        return "border-primary/50 bg-primary/10 text-primary";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "recup": return "Récup";
      case "cardio": return "Cardio";
      default: return "Renfo";
    }
  };

  // Place a session on a day
  const placeSession = (sessionId: string, dateStr: string) => {
    // Remove from any existing day
    const newAssignments = { ...dayAssignments };
    Object.keys(newAssignments).forEach((key) => {
      newAssignments[key] = newAssignments[key].filter((id) => id !== sessionId);
      if (newAssignments[key].length === 0) delete newAssignments[key];
    });

    // Add to the new day
    if (!newAssignments[dateStr]) newAssignments[dateStr] = [];
    newAssignments[dateStr].push(sessionId);

    setDayAssignments(newAssignments);
    setPickingDay(null);

    // If there are now 2+ sessions on that day, open order dialog
    if (newAssignments[dateStr].length >= 2) {
      setOrderDialogDay(dateStr);
    }
  };

  // Remove a session from a day
  const removeFromDay = (sessionId: string) => {
    const newAssignments = { ...dayAssignments };
    Object.keys(newAssignments).forEach((key) => {
      newAssignments[key] = newAssignments[key].filter((id) => id !== sessionId);
      if (newAssignments[key].length === 0) delete newAssignments[key];
    });
    setDayAssignments(newAssignments);
  };

  // Move session up/down in the day order
  const moveInDay = (dateStr: string, sessionId: string, direction: "up" | "down") => {
    const list = [...(dayAssignments[dateStr] || [])];
    const idx = list.indexOf(sessionId);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= list.length) return;
    [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
    setDayAssignments({ ...dayAssignments, [dateStr]: list });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build a map: sessionId -> date (or null)
      const sessionDateMap: Record<string, string | null> = {};
      sessions.forEach((s) => (sessionDateMap[s.id] = null));
      Object.entries(dayAssignments).forEach(([dateStr, ids]) => {
        ids.forEach((id) => (sessionDateMap[id] = dateStr));
      });

      // Build ordered session number: sessions ordered by their scheduled date then position in day
      const orderedIds: string[] = [];
      const allDates = Object.keys(dayAssignments).sort();
      allDates.forEach((dateStr) => {
        dayAssignments[dateStr].forEach((id) => orderedIds.push(id));
      });
      // Append unassigned sessions at the end
      sessions.forEach((s) => {
        if (!orderedIds.includes(s.id)) orderedIds.push(s.id);
      });

      const updates = orderedIds.map((sessionId, index) =>
        supabase
          .from("training_sessions")
          .update({
            scheduled_date: sessionDateMap[sessionId],
            session_number: index + 1,
          })
          .eq("id", sessionId)
      );

      await Promise.all(updates);
      toast.success("Séances programmées ! 🎯");
      navigate("/sportif/dashboard");
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la programmation");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/sportif/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <Card>
          <CardContent className="p-6 text-center">
            <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              Aucune séance à programmer cette semaine.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Toutes tes séances sont déjà complétées ! 💪
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/sportif/dashboard")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Programmer ma semaine</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Choisis une séance et ajoute-la à ton agenda
          </p>
        </div>
      </div>

      {/* Liste de toutes les séances (coach + perso) */}
      <div className="space-y-2">
        {sessions.map((s) => {
          const title = s.athlete_custom_name || s.name;
          return (
            <div
              key={s.id}
              className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 ${getTypeColor(s.session_type)}`}
            >
              <Dumbbell className="h-4 w-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold block leading-tight truncate">{title}</span>
                <span className="text-[11px] opacity-70">
                  {getTypeLabel(s.session_type)}{s.estimatedDuration && ` • ⏱ ${s.estimatedDuration}`}
                </span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="h-8 shrink-0 gap-1.5"
                onClick={() => setAgendaTarget({ title, estimatedDuration: s.estimatedDuration, defaultDate: s.scheduled_date })}
              >
                <CalendarClock className="h-4 w-4" />
                <span className="text-xs">Agenda</span>
              </Button>
            </div>
          );
        })}

        {customSessions.map((cs: any) => {
          const est = cs.duration_minutes ? `${cs.duration_minutes}min` : null;
          return (
            <div
              key={cs.id}
              className="flex items-center gap-3 rounded-xl border-2 border-orange-500/50 bg-orange-500/10 text-orange-600 dark:text-orange-400 px-3 py-2.5"
            >
              <Dumbbell className="h-4 w-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold block leading-tight truncate">{cs.session_name}</span>
                <span className="text-[11px] opacity-70">Perso{est && ` • ⏱ ${est}`}</span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="h-8 shrink-0 gap-1.5"
                onClick={() => setAgendaTarget({ title: cs.session_name, estimatedDuration: est, defaultDate: cs.scheduled_date })}
              >
                <CalendarClock className="h-4 w-4" />
                <span className="text-xs">Agenda</span>
              </Button>
            </div>
          );
        })}

        {sessions.length === 0 && customSessions.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Aucune séance disponible.</p>
        )}
      </div>

      {/* Google Agenda dialog */}
      <GoogleAgendaDialog
        target={agendaTarget}
        onClose={() => setAgendaTarget(null)}
      />
    </div>
  );
}

function GoogleAgendaDialog({
  target,
  onClose,
}: {
  target: { title: string; estimatedDuration: string | null; defaultDate: string | null } | null;
  onClose: () => void;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("18:00");
  const [duration, setDuration] = useState("60");

  useEffect(() => {
    if (target) {
      setDate(target.defaultDate || format(new Date(), "yyyy-MM-dd"));
      setTime("18:00");
      // Durée estimée (ex: "34min", "1h05") → minutes, sinon 60
      const est = target.estimatedDuration || "";
      const hm = est.match(/(\d+)\s*h\s*(\d+)?/i);
      const mn = est.match(/(\d+)\s*min/i);
      const mins = hm ? Number(hm[1]) * 60 + Number(hm[2] || 0) : mn ? Number(mn[1]) : 60;
      setDuration(String(mins || 60));
    }
  }, [target]);

  if (!target) return null;

  const handleAdd = () => {
    if (!date) return;
    const [h, m] = time.split(":").map((n) => parseInt(n) || 0);
    const start = new Date(date + "T00:00:00");
    start.setHours(h, m, 0, 0);
    const url = googleCalendarUrl(target.title, start, parseInt(duration) || 60, "Séance planifiée depuis CDO Coaching");
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Ajouter à Google Agenda</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <p className="font-semibold text-sm">{target.title}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ga-date">Date</Label>
            <Input id="ga-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ga-time">Heure</Label>
              <Input id="ga-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ga-dur">Durée (min)</Label>
              <Input id="ga-dur" type="number" inputMode="numeric" min="5" max="600" value={duration}
                onChange={(e) => setDuration(e.target.value.replace(/[^0-9]/g, ""))} />
            </div>
          </div>
          <Button className="w-full h-11" onClick={handleAdd} disabled={!date}>
            <CalendarClock className="h-4 w-4 mr-1.5" />
            Ouvrir dans Google Agenda
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            Google Agenda s'ouvre avec l'événement pré-rempli — il te reste à confirmer.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OrderDialog({
  open,
  dateStr,
  sessionIds,
  sessions,
  onMove,
  onClose,
}: {
  open: boolean;
  dateStr: string | null;
  sessionIds: string[];
  sessions: SessionToSchedule[];
  onMove: (id: string, dir: "up" | "down") => void;
  onClose: () => void;
}) {
  const getSession = (id: string) => sessions.find((s) => s.id === id);
  const dayLabel = dateStr
    ? format(new Date(dateStr), "EEEE d MMMM", { locale: fr })
    : "";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[90vw] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">
            Ordre des séances
          </DialogTitle>
          <p className="text-sm text-muted-foreground text-center capitalize">
            {dayLabel}
          </p>
        </DialogHeader>
        <p className="text-xs text-muted-foreground text-center">
          Quelle séance feras-tu en premier ?
        </p>
        <div className="space-y-2 py-2">
          {sessionIds.map((id, idx) => {
            const s = getSession(id);
            if (!s) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-2 p-3 rounded-lg border bg-card"
              >
                <span className="text-lg font-bold text-primary w-6 text-center">
                  {idx + 1}
                </span>
                <span className="text-sm font-medium flex-1 truncate">
                  {s.athlete_custom_name || s.name}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={idx === 0}
                    onClick={() => onMove(id, "up")}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={idx === sessionIds.length - 1}
                    onClick={() => onMove(id, "down")}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <Button className="w-full" onClick={onClose}>
          C'est bon !
        </Button>
      </DialogContent>
    </Dialog>
  );
}
