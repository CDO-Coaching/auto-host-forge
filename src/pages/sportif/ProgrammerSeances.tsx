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
import { CalendarDays, ArrowLeft, Check, X, GripVertical } from "lucide-react";

interface SessionToSchedule {
  id: string;
  name: string;
  athlete_custom_name: string | null;
  session_type: string;
  session_number: number;
  scheduled_date: string | null;
  exerciseCount: number;
}

export default function ProgrammerSeances() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [sessions, setSessions] = useState<SessionToSchedule[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [weekId, setWeekId] = useState<string | null>(null);

  const now = new Date();
  const monday = getMondayOfWeek(now);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

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

    setWeekId(week.id);

    const { data: sessionsData } = await supabase
      .from("training_sessions")
      .select("id, name, athlete_custom_name, session_type, session_number, scheduled_date, duration_minutes, session_exercises(sportif_rpe, skipped)")
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
        (ex: any) => (ex.sportif_rpe !== null && ex.sportif_rpe !== undefined) || ex.skipped === true
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

    // Init assignments from existing data
    const initial: Record<string, string | null> = {};
    mapped.forEach(s => {
      initial[s.id] = s.scheduled_date || null;
    });
    setAssignments(initial);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const assignToDay = (sessionId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    setAssignments(prev => ({
      ...prev,
      [sessionId]: prev[sessionId] === dateStr ? null : dateStr,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(assignments).map(([sessionId, date]) =>
        supabase
          .from("training_sessions")
          .update({ scheduled_date: date })
          .eq("id", sessionId)
      );

      await Promise.all(updates);
      toast.success("Séances programmées avec succès !");
      navigate("/sportif/dashboard");
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la programmation");
    } finally {
      setSaving(false);
    }
  };

  const getSessionTypeBadge = (type: string) => {
    switch (type) {
      case "recup":
        return <Badge variant="outline" className="text-xs border-purple-500 text-purple-500">Récup</Badge>;
      case "cardio":
        return <Badge variant="outline" className="text-xs border-blue-500 text-blue-500">Cardio</Badge>;
      default:
        return <Badge variant="outline" className="text-xs border-primary text-primary">Renfo</Badge>;
    }
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isPast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
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
            <p className="text-muted-foreground">Aucune séance à programmer cette semaine.</p>
            <p className="text-sm text-muted-foreground mt-1">Toutes tes séances sont déjà complétées ! 💪</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/sportif/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Programmer mes séances
          </h1>
          <p className="text-sm text-muted-foreground">
            Choisis le jour pour chaque séance
          </p>
        </div>
      </div>

      {/* Days of the week */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {weekDays.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const assignedSessions = sessions.filter(s => assignments[s.id] === dateStr);
          const dayIsPast = isPast(day);
          const dayIsToday = isToday(day);

          return (
            <div
              key={dateStr}
              className={`text-center p-1.5 sm:p-2 rounded-lg border transition-colors ${
                dayIsToday
                  ? "border-primary bg-primary/10"
                  : dayIsPast
                  ? "border-border/30 bg-muted/30 opacity-50"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <p className={`text-xs font-medium capitalize ${dayIsToday ? "text-primary" : "text-muted-foreground"}`}>
                {format(day, "EEE", { locale: fr })}
              </p>
              <p className={`text-sm sm:text-base font-bold ${dayIsToday ? "text-primary" : ""}`}>
                {format(day, "d")}
              </p>
              {assignedSessions.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {assignedSessions.map(s => (
                    <div key={s.id} className="w-2 h-2 rounded-full bg-primary mx-auto" />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sessions to schedule */}
      <div className="space-y-3">
        {sessions.map((s) => {
          const displayName = s.athlete_custom_name || s.name;
          const assignedDate = assignments[s.id];

          return (
            <Card key={s.id} className={assignedDate ? "border-primary/40 bg-primary/5" : ""}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base truncate">{displayName}</h3>
                    {getSessionTypeBadge(s.session_type)}
                  </div>
                  {assignedDate && (
                    <Badge className="bg-primary text-primary-foreground text-xs flex-shrink-0">
                      <Check className="h-3 w-3 mr-1" />
                      {format(new Date(assignedDate), "EEE d", { locale: fr })}
                    </Badge>
                  )}
                </div>

                {/* Day selection buttons */}
                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const isSelected = assignedDate === dateStr;
                    const dayIsPast = isPast(day);

                    return (
                      <Button
                        key={dateStr}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        disabled={dayIsPast}
                        className={`h-8 sm:h-9 text-xs px-0 ${
                          isSelected ? "shadow-md" : ""
                        }`}
                        onClick={() => assignToDay(s.id, day)}
                      >
                        {format(day, "EEE", { locale: fr }).slice(0, 3)}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Save button */}
      <Button
        className="w-full h-12 text-base font-semibold"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Enregistrement..." : "Valider ma programmation"}
      </Button>
    </div>
  );
}
