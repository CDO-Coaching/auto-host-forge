import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
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
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SessionToSchedule {
  id: string;
  name: string;
  athlete_custom_name: string | null;
  session_type: string;
  session_number: number;
  scheduled_date: string | null;
  exerciseCount: number;
}

// Assignments: day -> ordered list of session ids
type DayAssignments = Record<string, string[]>;

export default function ProgrammerSeances() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [sessions, setSessions] = useState<SessionToSchedule[]>([]);
  const [dayAssignments, setDayAssignments] = useState<DayAssignments>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickingDay, setPickingDay] = useState<string | null>(null); // session id being placed
  const [orderDialogDay, setOrderDialogDay] = useState<string | null>(null);

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
        "id, name, athlete_custom_name, session_type, session_number, scheduled_date, duration_minutes, session_exercises(sportif_rpe, skipped)"
      )
      .eq("week_id", week.id)
      .order("session_number");

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
            Place chaque séance sur le jour qui t'arrange
          </p>
        </div>
      </div>

      {/* Unassigned sessions pool */}
      {unassigned.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Séances à placer ({unassigned.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((s) => {
              const isActive = pickingDay === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setPickingDay(isActive ? null : s.id)}
                  className={`
                    flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all text-left
                    ${isActive
                      ? "border-primary bg-primary/15 shadow-lg shadow-primary/20 scale-105"
                      : `${getTypeColor(s.session_type)} hover:scale-[1.02]`
                    }
                  `}
                >
                  <Dumbbell className="h-4 w-4 flex-shrink-0" />
                  <div>
                    <span className="text-sm font-semibold block leading-tight">
                      {s.athlete_custom_name || s.name}
                    </span>
                    <span className="text-[11px] opacity-70">{getTypeLabel(s.session_type)}</span>
                  </div>
                </button>
              );
            })}
          </div>
          {pickingDay && (
            <p className="text-xs text-primary font-medium animate-pulse">
              👇 Touche le jour où tu veux placer cette séance
            </p>
          )}
        </div>
      )}

      {/* Week days */}
      <div className="space-y-2">
        {weekDays.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayPast = isPast(day);
          const dayIsToday = isToday(day);
          const sessionsOnDay = (dayAssignments[dateStr] || [])
            .map(getSession)
            .filter(Boolean) as SessionToSchedule[];

          return (
            <Card
              key={dateStr}
              className={`overflow-hidden transition-all ${
                pickingDay && !dayPast
                  ? "ring-2 ring-primary/40 cursor-pointer hover:ring-primary hover:bg-primary/5"
                  : ""
              } ${dayIsToday ? "border-primary/50" : ""} ${dayPast ? "opacity-40" : ""}`}
              onClick={() => {
                if (pickingDay && !dayPast) {
                  placeSession(pickingDay, dateStr);
                }
              }}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  {/* Day label */}
                  <div
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
                      dayIsToday
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <span className="text-[10px] sm:text-xs font-medium uppercase leading-tight">
                      {format(day, "EEE", { locale: fr })}
                    </span>
                    <span className="text-lg sm:text-xl font-bold leading-tight">
                      {format(day, "d")}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {sessionsOnDay.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">
                        {dayPast ? "Passé" : "Aucune séance"}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {sessionsOnDay.map((s, idx) => (
                          <div
                            key={s.id}
                            className={`flex items-center gap-2 p-1.5 rounded-lg ${getTypeColor(s.session_type)}`}
                          >
                            {sessionsOnDay.length > 1 && (
                              <span className="text-xs font-bold opacity-60 w-4 text-center">
                                {idx + 1}
                              </span>
                            )}
                            <span className="text-sm font-medium truncate flex-1">
                              {s.athlete_custom_name || s.name}
                            </span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-current opacity-60">
                              {getTypeLabel(s.session_type)}
                            </Badge>
                            {!dayPast && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFromDay(s.id);
                                }}
                                className="p-0.5 rounded hover:bg-destructive/20 transition-colors"
                              >
                                <X className="h-3.5 w-3.5 text-destructive" />
                              </button>
                            )}
                          </div>
                        ))}
                        {sessionsOnDay.length >= 2 && !dayPast && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOrderDialogDay(dateStr);
                            }}
                            className="text-[11px] text-primary font-medium hover:underline"
                          >
                            Changer l'ordre
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Add button for unassigned */}
                  {!dayPast && sessionsOnDay.length === 0 && !pickingDay && unassigned.length > 0 && (
                    <div className="flex-shrink-0">
                      <Plus className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Save */}
      <Button
        className="w-full h-12 text-base font-semibold"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Enregistrement..." : "Valider ma programmation"}
      </Button>

      {/* Order dialog */}
      <OrderDialog
        open={!!orderDialogDay}
        dateStr={orderDialogDay}
        sessionIds={orderDialogDay ? dayAssignments[orderDialogDay] || [] : []}
        sessions={sessions}
        onMove={(id, dir) => orderDialogDay && moveInDay(orderDialogDay, id, dir)}
        onClose={() => setOrderDialogDay(null)}
      />
    </div>
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
