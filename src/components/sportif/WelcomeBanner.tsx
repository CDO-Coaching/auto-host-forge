import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  firstName: string;
  recoveryPercent?: number | null;
  subtitle?: string;
}

export function WelcomeBanner({ firstName, recoveryPercent, subtitle }: Props) {
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
      (supabase as any).from("daily_fatigue_log").select("date").eq("user_id", user.id).gte("date", sinceISO),
      (supabase as any).from("training_sessions").select("completed_at").eq("athlete_id", user.id).not("completed_at", "is", null).gte("completed_at", since.toISOString()),
      (supabase as any).from("custom_sessions").select("completed_at").eq("user_id", user.id).gte("completed_at", since.toISOString()),
    ]);

    const days = new Set<string>();
    (fatigueRes.data as any[] | null)?.forEach((r) => r?.date && days.add(r.date));
    (sessionsRes.data as any[] | null)?.forEach((r) => {
      if (r?.completed_at) days.add(new Date(r.completed_at).toISOString().split("T")[0]);
    });
    (customRes.data as any[] | null)?.forEach((r) => {
      if (r?.completed_at) days.add(new Date(r.completed_at).toISOString().split("T")[0]);
    });

    let count = 0;
    const cur = new Date();
    for (let i = 0; i < 60; i++) {
      const iso = cur.toISOString().split("T")[0];
      if (days.has(iso)) {
        count++;
        cur.setDate(cur.getDate() - 1);
      } else if (i === 0) {
        cur.setDate(cur.getDate() - 1);
      } else {
        break;
      }
    }
    setStreak(count);
  };

  const moodEmoji =
    recoveryPercent == null ? "👋"
    : recoveryPercent >= 68 ? "💪"
    : recoveryPercent >= 50 ? "👋"
    : recoveryPercent >= 36 ? "😐"
    : recoveryPercent >= 22 ? "😟"
    : "🥵";

  const today = format(new Date(), "EEEE d MMMM", { locale: fr });

  return (
    <div className="px-1 pt-1 pb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[.12em] text-muted-foreground mb-1.5">
          {today}
        </p>
        <h2
          className="font-black leading-[1.05] tracking-tight text-[30px]"
          style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
        >
          <span className="text-foreground">Salut,</span>
          <br />
          <span className="text-primary">{firstName}</span>
          <span className="ml-2" aria-hidden>{moodEmoji}</span>
        </h2>
        {subtitle && (
          <p className="text-[13px] text-muted-foreground font-normal mt-1.5 leading-snug">
            {subtitle}
          </p>
        )}
      </div>

      {streak > 0 && (
        <div
          className="shrink-0 flex flex-col items-center justify-center rounded-2xl bg-orange-500/10 border border-orange-500/25 px-3 py-2 min-w-[52px] mt-1"
          title={`${streak} jour${streak > 1 ? "s" : ""} d'affilée`}
        >
          <Flame className="h-4 w-4 text-orange-500" />
          <span className="text-[18px] font-black leading-none mt-0.5 text-orange-500" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
            {streak}
          </span>
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground mt-0.5">
            j.
          </span>
        </div>
      )}
    </div>
  );
}
