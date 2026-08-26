import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Users, Dumbbell, AlertTriangle, CalendarDays, Clock, ChevronRight, Activity, User, Timer, CheckCircle, Search, Wallet, ListChecks, ShieldAlert } from "lucide-react";
import { CoachSessionDetailDialog } from "@/components/CoachSessionDetailDialog";
import { AcwrDashboardCard } from "@/components/AcwrDashboardCard";
import { format, startOfWeek, endOfWeek, parseISO, getISOWeek, getYear, subHours, addHours } from "date-fns";
import { fr } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { getWeekNumber, getWeekYear } from "@/lib/weekUtils";

interface DashboardData {
  activeClients: number;
  pendingRequests: number;
  sessionsCompletedThisWeek: number;
  sessionsProgrammedThisWeek: number;
  unvalidatedAthletes: UnvalidatedAthlete[];
  upcomingSessions: UpcomingSession[];
  recentActivities: RecentActivity[];
  fatigueAlerts: FatigueAlert[];
  unpaid: UnpaidAthlete[];
}

interface UnpaidAthlete {
  athleteId: string;
  athleteName: string;
  count: number;
}

interface AthleteOption {
  id: string;
  name: string;
  email: string;
}

interface UpcomingSession {
  eventId: string;
  athleteId: string;
  athleteName: string;
  eventTitle: string;
  startTime: string;
  endTime: string;
}

interface UnvalidatedAthlete {
  athleteId: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface RecentActivity {
  id: string;
  type: "session_completed" | "payment" | "new_request";
  label: string;
  detail: string;
  date: string;
  athleteId?: string;
  sessionType?: string;
}

interface FatigueAlert {
  athleteId: string;
  athleteName: string;
  score: number;
  date: string;
}

export default function CoachDashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [data, setData] = useState<DashboardData>({
    activeClients: 0,
    pendingRequests: 0,
    sessionsCompletedThisWeek: 0,
    sessionsProgrammedThisWeek: 0,
    unvalidatedAthletes: [],
    upcomingSessions: [],
    recentActivities: [],
    fatigueAlerts: [],
    unpaid: [],
  });
  const [loading, setLoading] = useState(true);
  const [allAthletes, setAllAthletes] = useState<AthleteOption[]>([]);
  const [search, setSearch] = useState("");
  const [unpaidOpen, setUnpaidOpen] = useState(false);
  const [acwrAthleteIds, setAcwrAthleteIds] = useState<string[]>([]);
  const [acwrProfileMap, setAcwrProfileMap] = useState<Map<string, { first_name: string; last_name: string }>>(new Map());
  const [selectedSession, setSelectedSession] = useState<{
    id: string;
    athleteId: string;
    athleteName: string;
    sessionType: string;
  } | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      loadDashboardData();
    }
  }, [session?.user?.id]);

  const loadDashboardData = async () => {
    if (!session?.user?.id) return;
    setLoading(true);

    try {
      const coachId = session.user.id;

      const { data: relationships } = await supabase
        .from("coach_athlete_relationships")
        .select("athlete_id, status")
        .eq("coach_id", coachId);

      const approved = relationships?.filter(r => r.status === "approved") || [];
      const pending = relationships?.filter(r => r.status === "pending") || [];
      const athleteIds = approved.map(r => r.athlete_id);

      const profileMap = new Map<string, { first_name: string; last_name: string; email: string }>();
      if (athleteIds.length > 0) {
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("id, first_name, last_name, email")
          .in("id", athleteIds);
        (profiles || []).forEach(p => profileMap.set(p.id, {
          first_name: p.first_name || "",
          last_name: p.last_name || "",
          email: p.email || "",
        }));
      }

      // Liste d'athlètes pour la recherche rapide
      setAllAthletes(
        [...profileMap.entries()]
          .map(([id, p]) => ({ id, name: `${p.first_name} ${p.last_name}`.trim(), email: p.email }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );

      // Expose to ACWR card
      setAcwrAthleteIds(athleteIds);
      setAcwrProfileMap(new Map([...profileMap].map(([k, v]) => [k, { first_name: v.first_name, last_name: v.last_name }])));

      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const weekNumber = getISOWeek(weekStart);
      const weekYear = getYear(weekStart);
      const currentWeek = getWeekNumber(now);
      const currentYear = getWeekYear(now);

      let sessionsCompleted = 0;
      let sessionsProgrammed = 0;
      const recentActivities: RecentActivity[] = [];

      if (athleteIds.length > 0) {
        // Check which athletes have their current week validated by the coach
        const { data: validatedWeeks } = await supabase
          .from("training_weeks")
          .select("athlete_id, validated")
          .in("athlete_id", athleteIds)
          .eq("week_number", currentWeek)
          .eq("year", currentYear);

        const validatedAthleteIds = new Set(
          (validatedWeeks || []).filter((w: any) => w.validated).map((w: any) => w.athlete_id)
        );

        // Athletes whose current week is NOT validated
        const unvalidatedAthletes: UnvalidatedAthlete[] = athleteIds
          .filter(id => !validatedAthleteIds.has(id))
          .map(id => {
            const profile = profileMap.get(id);
            return {
              athleteId: id,
              firstName: profile?.first_name || "",
              lastName: profile?.last_name || "",
              email: profile?.email || "",
            };
          })
          .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
          .slice(0, 5);

        // Training sessions this week (for KPI)
        const { data: trainingSessions } = await supabase
          .from("training_sessions")
          .select("id, name, session_type, completed_at, training_weeks!inner(athlete_id, week_number, year)")
          .in("training_weeks.athlete_id", athleteIds)
          .eq("training_weeks.week_number", weekNumber)
          .eq("training_weeks.year", weekYear);

        sessionsProgrammed = trainingSessions?.length || 0;

        (trainingSessions || []).forEach((ts: any) => {
          if (ts.completed_at) {
            sessionsCompleted++;
            const athleteId = ts.training_weeks?.athlete_id;
            const profile = profileMap.get(athleteId);
            recentActivities.push({
              id: ts.id,
              type: "session_completed",
              label: profile ? `${profile.first_name} ${profile.last_name}` : "Athlète",
              detail: ts.name,
              date: ts.completed_at,
              athleteId,
              sessionType: ts.session_type || "renfo",
            });
          }
        });

        // Custom sessions this week
        const weekStartStr = format(weekStart, "yyyy-MM-dd");
        const weekEndStr = format(weekEnd, "yyyy-MM-dd");
        const { data: customSessions } = await supabase
          .from("custom_sessions")
          .select("id, session_name, completed_at, user_id")
          .in("user_id", athleteIds)
          .gte("completed_at", weekStartStr)
          .lte("completed_at", weekEndStr + "T23:59:59");

        (customSessions || []).forEach((cs: any) => {
          if (cs.completed_at) {
            sessionsCompleted++;
            sessionsProgrammed++;
          }
        });

        // Fetch Google Calendar events via n8n webhook (-5h to +24h)
        const timeMin = subHours(now, 5);
        const timeMax = addHours(now, 24);
        let upcomingSessions: UpcomingSession[] = [];
        try {
          const calResponse = await fetch(
            "https://n8n-i4coc8gkwgok0s4k0gsscsgw.168.231.84.252.sslip.io/webhook/64ef905d-e4d8-49be-b4f9-f008823baa66",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                timeMin: timeMin.toISOString(),
                timeMax: timeMax.toISOString(),
              }),
            }
          );
          if (calResponse.ok) {
            const calData = await calResponse.json();
            let events: any[] = [];
            if (Array.isArray(calData)) events = calData;
            else if (calData.events) events = calData.events;
            else if (calData.items) events = calData.items;

            // Build email -> athleteId map
            const emailToAthlete = new Map<string, { id: string; name: string }>();
            // Liste (id, nom complet normalisé) pour la correspondance par nom dans le titre
            const nameToAthlete: { id: string; name: string; norm: string; first: string; last: string }[] = [];
            const normalize = (s: string) =>
              (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
            profileMap.forEach((profile, id) => {
              const fullName = `${profile.first_name} ${profile.last_name}`.trim();
              if (profile.email) {
                emailToAthlete.set(profile.email.toLowerCase(), { id, name: fullName });
              }
              const first = normalize(profile.first_name);
              const last = normalize(profile.last_name);
              if (first || last) {
                nameToAthlete.push({ id, name: fullName, norm: normalize(fullName), first, last });
              }
            });

            for (const event of events) {
              const attendees = event.attendees || [];
              const startStr = typeof event.start === "object"
                ? (event.start?.dateTime || event.start?.date)
                : event.start;
              const endStr = typeof event.end === "object"
                ? (event.end?.dateTime || event.end?.date)
                : event.end;

              // Filter: only keep events whose start is within [-5h, +24h] local time
              if (startStr) {
                const eventStart = new Date(startStr);
                if (eventStart < timeMin || eventStart > timeMax) continue;
              }

              let matched: { id: string; name: string } | null = null;
              // 1) Correspondance par email d'invité
              for (const att of attendees) {
                const m = emailToAthlete.get(att.email?.toLowerCase());
                if (m) { matched = m; break; }
              }
              // 2) Sinon, correspondance par nom dans le titre/description de l'événement
              if (!matched) {
                const haystack = normalize(`${event.summary || event.title || ""} ${event.description || ""}`);
                if (haystack) {
                  const hit = nameToAthlete.find(a =>
                    (a.norm && haystack.includes(a.norm)) ||
                    (a.first && a.last && haystack.includes(`${a.first} ${a.last}`)) ||
                    (a.last && a.first && haystack.includes(`${a.last} ${a.first}`))
                  );
                  if (hit) matched = { id: hit.id, name: hit.name };
                }
              }

              if (matched) {
                upcomingSessions.push({
                  eventId: event.id,
                  athleteId: matched.id,
                  athleteName: matched.name,
                  eventTitle: event.summary || event.title || "RDV",
                  startTime: startStr || "",
                  endTime: endStr || "",
                });
              }
            }
            upcomingSessions.sort((a, b) => a.startTime.localeCompare(b.startTime));
          }
        } catch (calErr) {
          console.error("Calendar fetch error:", calErr);
        }

        // Fatigue alerts
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const { data: fatigueEntries } = await supabase
          .from("daily_fatigue_log" as any)
          .select("id, user_id, fatigue, stress, courbatures, date")
          .in("user_id", athleteIds)
          .gte("date", format(threeDaysAgo, "yyyy-MM-dd"))
          .order("date", { ascending: false });

        const fatigueAlerts: FatigueAlert[] = [];
        const seenAthletes = new Set<string>();
        (fatigueEntries || []).forEach((entry: any) => {
          const avgScore = Math.round(((entry.fatigue || 0) + (entry.stress || 0) + (entry.courbatures || 0)) / 3);
          if (avgScore >= 4 && !seenAthletes.has(entry.user_id)) {
            seenAthletes.add(entry.user_id);
            const profile = profileMap.get(entry.user_id);
            fatigueAlerts.push({
              athleteId: entry.user_id,
              athleteName: profile ? `${profile.first_name} ${profile.last_name}` : "Athlète",
              score: avgScore,
              date: entry.date,
            });
          }
        });

        // Recent payments
        const { data: recentPayments } = await supabase
          .from("athlete_subscriptions")
          .select("id, athlete_id, product_name, paid_at")
          .in("athlete_id", athleteIds)
          .order("paid_at", { ascending: false })
          .limit(5);

        (recentPayments || []).forEach((p: any) => {
          const profile = profileMap.get(p.athlete_id);
          recentActivities.push({
            id: p.id,
            type: "payment",
            label: profile ? `${profile.first_name} ${profile.last_name}` : "Athlète",
            detail: p.product_name,
            date: p.paid_at,
          });
        });

        // Impayés : déficit du mois courant non couvert par le crédit reporté
        // (même logique que la page Comptabilité).
        const unpaid: UnpaidAthlete[] = [];
        try {
          const monthStr = format(now, "yyyy-MM-01");
          // Toutes les entrées du coach pour le solde global (crédits reportés)
          const { data: allEntries } = await supabase
            .from("accounting_entries")
            .select("client_id, sessions_paid, sessions_done, month")
            .eq("coach_id", coachId);

          const balanceByClient = new Map<string, number>();
          (allEntries || []).forEach((e: any) => {
            if (!e.client_id) return;
            balanceByClient.set(
              e.client_id,
              (balanceByClient.get(e.client_id) || 0) + ((e.sessions_paid || 0) - (e.sessions_done || 0))
            );
          });

          (allEntries || [])
            .filter((e: any) => e.client_id && e.month === monthStr)
            .forEach((e: any) => {
              const balanceAll = balanceByClient.get(e.client_id) || 0;
              const creditBefore = balanceAll - ((e.sessions_paid || 0) - (e.sessions_done || 0));
              const needing = Math.max(0, (e.sessions_done || 0) - (e.sessions_paid || 0));
              const covered = Math.min(needing, Math.max(0, creditBefore));
              const uncovered = needing - covered;
              if (uncovered > 0) {
                const profile = profileMap.get(e.client_id);
                unpaid.push({
                  athleteId: e.client_id,
                  athleteName: profile ? `${profile.first_name} ${profile.last_name}` : "Client",
                  count: uncovered,
                });
              }
            });
        } catch (paidErr) {
          console.error("Impayés fetch error:", paidErr);
        }

        setData({
          activeClients: approved.length,
          pendingRequests: pending.length,
          sessionsCompletedThisWeek: sessionsCompleted,
          sessionsProgrammedThisWeek: sessionsProgrammed,
          unvalidatedAthletes,
          upcomingSessions,
          recentActivities: recentActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8),
          fatigueAlerts,
          unpaid,
        });
      } else {
        setData(prev => ({
          ...prev,
          activeClients: approved.length,
          pendingRequests: pending.length,
        }));
      }
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const completionRate = data.sessionsProgrammedThisWeek > 0
    ? Math.round((data.sessionsCompletedThisWeek / data.sessionsProgrammedThisWeek) * 100)
    : 0;

  const completionRateColor =
    completionRate >= 70 ? "text-green-500" :
    completionRate >= 30 ? "text-orange-400" :
    data.sessionsProgrammedThisWeek > 0 ? "text-red-500" : "text-muted-foreground";

  const handleValidateWeek = async (athleteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session?.user?.id) return;
    const currentWeek = getWeekNumber(new Date());
    const currentYear = getWeekYear(new Date());
    const { error } = await supabase
      .from("training_weeks")
      .upsert(
        { athlete_id: athleteId, coach_id: session.user.id, week_number: currentWeek, year: currentYear, validated: true },
        { onConflict: "athlete_id,week_number,year" }
      );
    if (!error) {
      setData(prev => ({
        ...prev,
        unvalidatedAthletes: prev.unvalidatedAthletes.filter(a => a.athleteId !== athleteId),
      }));
    }
  };

  const hasUnvalidated = data.unvalidatedAthletes.length > 0;
  const hasFatigueAlerts = data.fatigueAlerts.length > 0;
  const hasUpcoming = data.upcomingSessions.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Chargement du tableau de bord...</p>
      </div>
    );
  }

  // ---------------- Vue mobile dédiée ----------------
  if (isMobile) {
    const q = search.trim().toLowerCase();
    const searchResults = q
      ? allAthletes.filter(a => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)).slice(0, 6)
      : [];
    const hasUnpaid = data.unpaid.length > 0;
    const totalUnpaid = data.unpaid.reduce((s, u) => s + u.count, 0);
    const weekDone = data.recentActivities.filter(a => a.type === "session_completed");

    return (
      <div className="flex flex-col gap-2.5 h-[calc(100dvh-10.5rem)] min-h-[24rem] overflow-hidden">
        {/* Recherche athlète */}
        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un athlète…"
            className="pl-9 h-10"
          />
          {searchResults.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
              {searchResults.map(a => (
                <button
                  key={a.id}
                  className="flex w-full items-center gap-3 p-3 text-left hover:bg-secondary/50 transition-colors"
                  onClick={() => { setSearch(""); navigate(`/coach/client/${a.id}`); }}
                >
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{a.name || a.email}</p>
                    {a.name && <p className="text-xs text-muted-foreground truncate">{a.email}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Prog à traiter : semaines à valider */}
        {!hasUnvalidated ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/20 px-3 py-1.5 shrink-0">
            <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
            <span className="text-xs text-muted-foreground">Toutes les progs sont validées</span>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden shrink-0 max-h-[38vh] flex flex-col">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/20 shrink-0">
              <ListChecks className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-semibold">Progs à traiter</span>
              <Badge variant="secondary" className="ml-auto text-xs">{data.unvalidatedAthletes.length}</Badge>
            </div>
            <div className="overflow-y-auto divide-y divide-border/60">
              {data.unvalidatedAthletes.map(a => (
                <div
                  key={a.athleteId}
                  className="flex items-center gap-2.5 px-3 py-2"
                  onClick={() => navigate(`/coach/client/${a.athleteId}`)}
                >
                  <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground truncate flex-1">{a.firstName} {a.lastName}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs text-green-500 border-green-500/50 hover:bg-green-500/10 hover:text-green-400 shrink-0"
                    onClick={(e) => handleValidateWeek(a.athleteId, e)}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                    Valider
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Impayés : petite case dépliable */}
        {hasUnpaid && (
          <div className="rounded-lg border border-orange-400/30 bg-orange-500/5 overflow-hidden shrink-0 max-h-[30vh] flex flex-col">
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-left shrink-0"
              onClick={() => setUnpaidOpen(o => !o)}
            >
              <Wallet className="h-4 w-4 text-orange-400 shrink-0" />
              <span className="text-sm font-medium text-foreground">Impayés</span>
              <Badge variant="outline" className="text-xs text-orange-400 border-orange-400/40">
                {data.unpaid.length} client{data.unpaid.length > 1 ? "s" : ""} · {totalUnpaid} séance{totalUnpaid > 1 ? "s" : ""}
              </Badge>
              <ChevronRight className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${unpaidOpen ? "rotate-90" : ""}`} />
            </button>
            {unpaidOpen && (
              <div className="border-t border-orange-400/20 divide-y divide-orange-400/10 overflow-y-auto">
                {data.unpaid.map(u => (
                  <div
                    key={`pay-${u.athleteId}`}
                    className="flex items-center justify-between gap-2 px-3 py-2"
                    onClick={() => navigate(`/coach/comptabilite`)}
                  >
                    <p className="text-sm text-foreground truncate">{u.athleteName}</p>
                    <span className="text-xs font-semibold text-orange-400 shrink-0">
                      {u.count} séance{u.count > 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cette semaine : qui a fait quoi (scroll interne) */}
        <div className="rounded-lg border border-border overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/20 shrink-0">
            <Dumbbell className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-semibold">Cette semaine</span>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {data.sessionsCompletedThisWeek}/{data.sessionsProgrammedThisWeek} séances
            </span>
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-border/50">
            {weekDone.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Aucune séance réalisée cette semaine</p>
            ) : (
              weekDone.map(a => (
                <div
                  key={a.id}
                  className="flex items-center gap-2.5 px-3 py-2 active:bg-secondary/40 transition-colors"
                  onClick={() => {
                    if (a.athleteId) setSelectedSession({ id: a.id, athleteId: a.athleteId, athleteName: a.label, sessionType: a.sessionType || "renfo" });
                  }}
                >
                  <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground truncate">
                      <span className="font-medium">{a.label}</span>
                      <span className="text-muted-foreground"> — {a.detail}</span>
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{format(parseISO(a.date), "EEE HH:mm", { locale: fr })}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <CoachSessionDetailDialog
          open={!!selectedSession}
          onOpenChange={(open) => !open && setSelectedSession(null)}
          sessionId={selectedSession?.id || null}
          sessionType={selectedSession?.sessionType || "renfo"}
          athleteId={selectedSession?.athleteId || ""}
          athleteName={selectedSession?.athleteName || ""}
        />
      </div>
    );
  }

  // ---------------- Vue desktop (inchangée) ----------------
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">
          {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/coach/mes-clients")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-5 w-5 text-primary" />
              {data.pendingRequests > 0 && (
                <Badge variant="destructive" className="text-xs">{data.pendingRequests}</Badge>
              )}
            </div>
            <p className="text-2xl font-bold text-foreground">{data.activeClients}</p>
            <p className="text-xs text-muted-foreground">Clients actifs</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/coach/agenda")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Dumbbell className="h-5 w-5 text-primary" />
              <span className={`text-xs font-semibold ${completionRateColor}`}>{completionRate}%</span>
            </div>
            <p className={`text-2xl font-bold ${completionRateColor}`}>
              {data.sessionsCompletedThisWeek}/{data.sessionsProgrammedThisWeek}
            </p>
            <p className="text-xs text-muted-foreground">Séances cette semaine</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center mb-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <p className="text-2xl font-bold text-foreground">{data.fatigueAlerts.length}</p>
            <p className="text-xs text-muted-foreground">Alertes fatigue</p>
          </CardContent>
        </Card>
      </div>

      {/* Sections dynamiques */}
      {(hasUnvalidated || hasFatigueAlerts) && (
        <div className={`grid ${isMobile ? "grid-cols-1" : (hasUnvalidated && hasFatigueAlerts ? "grid-cols-2" : "grid-cols-1")} gap-4`}>
          {hasUnvalidated && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Semaines non validées
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.unvalidatedAthletes.map(a => (
                  <div
                    key={a.athleteId}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => navigate(`/coach/client/${a.athleteId}`)}
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {a.firstName} {a.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs text-green-500 border-green-500/50 hover:bg-green-500/10 hover:text-green-400"
                        onClick={(e) => handleValidateWeek(a.athleteId, e)}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Valider
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {hasFatigueAlerts && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-destructive" />
                  Alertes fatigue
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.fatigueAlerts.map(a => (
                  <div
                    key={a.athleteId}
                    className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 cursor-pointer hover:bg-destructive/20 transition-colors"
                    onClick={() => navigate(`/coach/client/${a.athleteId}`)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{a.athleteName}</p>
                      <p className="text-xs text-muted-foreground">{format(parseISO(a.date), "d MMM", { locale: fr })}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge variant="destructive" className="text-xs">{a.score}/7</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* RDV coaching à venir (Google Calendar) */}
      {hasUpcoming && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary" />
              RDV coaching à venir
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.upcomingSessions.map(s => {
              const startDate = s.startTime ? parseISO(s.startTime) : null;
              const endDate = s.endTime ? parseISO(s.endTime) : null;
              const isPast = endDate ? endDate < new Date() : false;
              return (
                <div
                  key={s.eventId}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:border-primary/50 transition-colors ${isPast ? "border-border opacity-60" : "border-border"}`}
                  onClick={() => navigate(`/coach/client/${s.athleteId}`)}
                >
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{s.athleteName}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.eventTitle}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {startDate && (
                      <Badge variant="outline" className="text-xs">
                        {format(startDate, "HH:mm", { locale: fr })}
                        {endDate && ` - ${format(endDate, "HH:mm", { locale: fr })}`}
                      </Badge>
                    )}
                    {isPast && (
                      <Badge variant="secondary" className="text-xs">Passé</Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}


      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Dernières activités
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.recentActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Aucune activité récente
            </p>
          ) : (
            data.recentActivities.map(a => (
              <div
                key={a.id}
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                  a.type === "session_completed"
                    ? "cursor-pointer hover:bg-secondary/50"
                    : "hover:bg-secondary/30"
                }`}
                onClick={() => {
                  if (a.type === "session_completed" && a.athleteId) {
                    setSelectedSession({
                      id: a.id,
                      athleteId: a.athleteId,
                      athleteName: a.label,
                      sessionType: a.sessionType || "renfo",
                    });
                  }
                }}
              >
                <div className={`h-2 w-2 rounded-full shrink-0 ${
                  a.type === "session_completed" ? "bg-green-500" :
                  a.type === "payment" ? "bg-primary" : "bg-blue-500"
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">
                    <span className="font-medium">{a.label}</span>
                    <span className="text-muted-foreground"> — {a.detail}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(a.date), "d MMM HH:mm", { locale: fr })}
                  </span>
                  {a.type === "session_completed" && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Session detail dialog */}
      <CoachSessionDetailDialog
        open={!!selectedSession}
        onOpenChange={(open) => !open && setSelectedSession(null)}
        sessionId={selectedSession?.id || null}
        sessionType={selectedSession?.sessionType || "renfo"}
        athleteId={selectedSession?.athleteId || ""}
        athleteName={selectedSession?.athleteName || ""}
      />
    </div>
  );
}
