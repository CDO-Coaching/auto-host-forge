import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  subscribeToPush,
  unsubscribeFromPush,
  canEnablePush,
  isPushSupported,
  isIOS,
  isStandalone,
  getUserTimeZone,
} from "@/lib/pushNotifications";

// Jours (dow Postgres : 0 = dimanche … 6 = samedi)
const DAYS = [
  { label: "L", dow: 1 },
  { label: "M", dow: 2 },
  { label: "M", dow: 3 },
  { label: "J", dow: 4 },
  { label: "V", dow: 5 },
  { label: "S", dow: 6 },
  { label: "D", dow: 0 },
];

type CatalogItem = { type: string; label: string; hint: string; instant?: boolean };

const CATALOG: Record<string, CatalogItem[]> = {
  sportif: [
    { type: "hooper", label: "Questionnaire de forme", hint: "Rappel si non rempli à l'heure choisie" },
    { type: "weight", label: "Pesée", hint: "Rappel si aucune pesée enregistrée ce jour" },
    { type: "message", label: "Messages", hint: "Quand tu reçois un message", instant: true },
  ],
  coach: [
    { type: "programmation", label: "Semaines à valider", hint: "Rappel s'il reste des semaines non validées" },
    { type: "message", label: "Messages", hint: "Quand un athlète t'envoie un message", instant: true },
  ],
};

interface Rule {
  enabled: boolean;
  days: number[];
  time: string;
}

const defaultRule = (): Rule => ({ enabled: false, days: [1, 2, 3, 4, 5, 6, 0], time: "19:00" });

export default function NotificationsSettings({ role }: { role: "sportif" | "coach" }) {
  const { user } = useAuth();
  const userId = user?.id || "";
  const catalog = CATALOG[role];

  const [loading, setLoading] = useState(true);
  const [master, setMaster] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState<Record<string, Rule>>(
    () => Object.fromEntries(catalog.map((c) => [c.type, defaultRule()]))
  );

  const supported = isPushSupported();
  const needsInstall = isIOS() && !isStandalone();

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [{ data: prefs }, { data: ruleRows }] = await Promise.all([
        supabase.from("notification_preferences").select("enabled").eq("user_id", userId).maybeSingle(),
        supabase.from("notification_rules").select("type, enabled, days, reminder_time").eq("user_id", userId),
      ]);
      if (prefs) setMaster(!!prefs.enabled);
      if (ruleRows) {
        setRules((prev) => {
          const next = { ...prev };
          for (const row of ruleRows as any[]) {
            if (!next[row.type]) continue;
            next[row.type] = {
              enabled: !!row.enabled,
              days: Array.isArray(row.days) ? row.days : defaultRule().days,
              time: row.reminder_time ? String(row.reminder_time).slice(0, 5) : "19:00",
            };
          }
          return next;
        });
      }
      setLoading(false);
    })();
  }, [userId]);

  const handleMaster = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (next) {
        const ok = await subscribeToPush(userId);
        if (!ok) {
          toast.error("Permission refusée ou notifications indisponibles sur cet appareil.");
          return;
        }
        const { error } = await supabase.from("notification_preferences").upsert(
          { user_id: userId, enabled: true, timezone: getUserTimeZone(), updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
        if (error) throw error;
        setMaster(true);
        toast.success("Notifications activées sur cet appareil.");
      } else {
        await unsubscribeFromPush();
        const { error } = await supabase.from("notification_preferences").upsert(
          { user_id: userId, enabled: false, timezone: getUserTimeZone(), updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
        if (error) throw error;
        setMaster(false);
        toast.success("Notifications désactivées.");
      }
    } catch (e: any) {
      toast.error(`Erreur : ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("send_test_notification");
      if (error) throw error;
      toast.success("Test envoyé — il arrivera dans la minute (si le déclencheur n8n est actif).");
    } catch (e: any) {
      toast.error(`Erreur : ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const saveRule = async (type: string, rule: Rule) => {
    const { error } = await supabase.from("notification_rules").upsert(
      {
        user_id: userId,
        type,
        enabled: rule.enabled,
        days: rule.days,
        reminder_time: rule.time,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,type" }
    );
    if (error) throw error;
  };

  const updateRule = async (type: string, patch: Partial<Rule>, notify = false) => {
    const next = { ...rules[type], ...patch };
    setRules((prev) => ({ ...prev, [type]: next }));
    try {
      await saveRule(type, next);
      if (notify) toast.success("Enregistré ✓");
    } catch (e: any) {
      toast.error(`Erreur : ${e?.message || e}`);
    }
  };

  const toggleDay = (type: string, dow: number) => {
    const cur = rules[type].days;
    const next = cur.includes(dow) ? cur.filter((d) => d !== dow) : [...cur, dow];
    updateRule(type, { days: next });
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-10 text-center">Chargement…</p>;
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Notifications</h1>
        <p className="text-sm text-muted-foreground">Choisis tes rappels, les jours et l'heure.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Notifications sur cet appareil
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!supported ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <BellOff className="h-4 w-4" /> Ton navigateur ne supporte pas les notifications.
            </p>
          ) : needsInstall ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground flex items-start gap-2">
                <Smartphone className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                Sur iPhone/iPad, les rappels ne fonctionnent que si l'app est ajoutée à l'écran
                d'accueil et ouverte depuis son icône.
              </p>
              {role === "sportif" && (
                <Button asChild variant="outline" size="sm">
                  <Link to="/sportif/install">Voir comment installer l'app</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Activer les notifications</p>
                <p className="text-xs text-muted-foreground">Fuseau : {getUserTimeZone()}</p>
              </div>
              <Switch checked={master} onCheckedChange={handleMaster} disabled={busy || !canEnablePush()} />
            </div>
          )}
          {master && supported && !needsInstall && (
            <Button variant="outline" size="sm" className="mt-4" onClick={sendTest} disabled={busy}>
              Envoyer une notification de test
            </Button>
          )}
        </CardContent>
      </Card>

      {master && supported && !needsInstall && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Mes rappels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {catalog.map((c) => {
              const rule = rules[c.type];
              return (
                <div key={c.type} className="space-y-3 border-b border-border pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{c.label}</p>
                      <p className="text-xs text-muted-foreground">{c.hint}</p>
                    </div>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(v) => updateRule(c.type, { enabled: v })}
                    />
                  </div>

                  {rule.enabled && !c.instant && (
                    <div className="space-y-3 pl-1">
                      <div className="flex flex-wrap gap-1.5">
                        {DAYS.map((day, i) => {
                          const active = rule.days.includes(day.dow);
                          return (
                            <button
                              key={i}
                              onClick={() => toggleDay(c.type, day.dow)}
                              className={`h-8 w-8 rounded-full text-xs font-medium transition-colors ${
                                active
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-muted-foreground hover:bg-secondary/70"
                              }`}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">à</span>
                        <Input
                          type="time"
                          value={rule.time}
                          onChange={(e) => setRules((p) => ({ ...p, [c.type]: { ...p[c.type], time: e.target.value } }))}
                          onBlur={() => updateRule(c.type, { time: rules[c.type].time }, true)}
                          className="w-28"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
