import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Flame, CalendarCheck, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  firstName: string;
  recoveryPercent?: number | null;
}

/**
 * Bannière de bienvenue : date du jour, météo de la forme (emoji), streak de jours
 * actifs (séance validée OU fatigue renseignée).
 */
export function WelcomeBanner({ firstName, recoveryPercent }: Props) {
  const { user } = useAuth();
  const [streak, setStreak] = useState<number>(0);

  useEffect(() => {
    if (!user) return;
    void loadStreak();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadStreak = async () => {
    if (!user) return;
    const since = new Date();
    since.setDate(since.getDate() - 60);
    const sinceISO = since.toISOString().split("T")[0];

    const [fatigueRes, sessionsRes, customRes] = await Promise.all([
      supabase
        .from("daily_fatigue_log" as any)
        .select("date")
        .eq("user_id", user.id)
        .gte("date", sinceISO),
      supabase
        .from("training_sessions")
        .select("completed_at")
        .eq("athlete_id" as any, user.id)
        .not("completed_at", "is", null)
        .gte("completed_at", since.toISOString()),
      supabase
        .from("custom_sessions" as any)
        .select("completed_at")
        .eq("user_id", user.id)
        .gte("completed_at", since.toISOString()),
    ]);

    const days = new Set<string>();
    (fatigueRes.data as any[] | null)?.forEach((r) => r?.date && days.add(r.date));
    (sessionsRes.data as any[] | null)?.forEach((r) => {
      if (r?.completed_at) days.add(new Date(r.completed_at).toISOString().split("T")[0]);
    });
    (customRes.data as any[] | null)?.forEach((r) => {
      if (r?.completed_at) days.add(new Date(r.completed_at).toISOString().split("T")[0]);
    });

    // Count consecutive days back from today
    let count = 0;
    const cur = new Date();
    for (let i = 0; i < 60; i++) {
      const iso = cur.toISOString().split("T")[0];
      if (days.has(iso)) {
        count++;
        cur.setDate(cur.getDate() - 1);
      } else if (i === 0) {
        // tolerate today missing if yesterday counted
        cur.setDate(cur.getDate() - 1);
      } else {
        break;
      }
    }
    setStreak(count);
  };

  const moodEmoji =
    recoveryPercent == null
      ? "🙂"
      : recoveryPercent >= 68
      ? "💪"
      : recoveryPercent >= 50
      ? "🙂"
      : recoveryPercent >= 36
      ? "😐"
      : recoveryPercent >= 22
      ? "😟"
      : "🥵";

  const today = format(new Date(), "EEEE d MMMM", { locale: fr });

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <CalendarCheck className="h-3 w-3" />
              {today}
            </p>
            <h2 className="text-lg sm:text-2xl font-bold mt-0.5 flex items-center gap-2">
              <span className="truncate">Salut {firstName}</span>
              <span aria-hidden>{moodEmoji}</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-primary" />
              Prêt à donner le meilleur ?
            </p>
          </div>
          {streak > 0 && (
            <div
              className="shrink-0 flex flex-col items-center justify-center rounded-xl bg-orange-500/10 border border-orange-500/30 px-3 py-2 min-w-[64px]"
              title={`${streak} jour${streak > 1 ? "s" : ""} d'affilée`}
            >
              <Flame className="h-5 w-5 text-orange-500" />
              <span className="text-lg font-bold leading-none mt-0.5 text-orange-600">{streak}</span>
              <span className="text-[9px] uppercase tracking-wide text-muted-foreground mt-0.5">
                jour{streak > 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
