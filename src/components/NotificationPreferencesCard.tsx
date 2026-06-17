import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Smartphone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  subscribeToPush,
  unsubscribeFromPush,
  canEnablePush,
  isPushSupported,
  isIOS,
  isStandalone,
  getUserTimeZone,
} from "@/lib/pushNotifications";

export function NotificationPreferencesCard({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState("19:00");

  const supported = isPushSupported();
  const needsInstall = isIOS() && !isStandalone();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("enabled, reminder_time")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) {
        setEnabled(!!data.enabled);
        if (data.reminder_time) setTime(String(data.reminder_time).slice(0, 5));
      }
      setLoading(false);
    })();
  }, [userId]);

  const savePrefs = async (nextEnabled: boolean, resetSchedule = false) => {
    const payload: Record<string, unknown> = {
      user_id: userId,
      enabled: nextEnabled,
      reminder_time: time,
      timezone: getUserTimeZone(),
      updated_at: new Date().toISOString(),
    };
    // Ré-arme l'envoi du jour : permet de recevoir le rappel à la nouvelle heure
    // même si un rappel a déjà été envoyé aujourd'hui.
    if (resetSchedule) payload.last_sent_at = null;
    const { error } = await supabase
      .from("notification_preferences")
      .upsert(payload, { onConflict: "user_id" });
    if (error) throw error;
  };

  const handleToggle = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (next) {
        const ok = await subscribeToPush(userId);
        if (!ok) {
          toast.error("Permission refusée ou notifications indisponibles sur cet appareil.");
          setBusy(false);
          return;
        }
        await savePrefs(true, true);
        setEnabled(true);
        toast.success("Rappels activés sur cet appareil.");
      } else {
        await unsubscribeFromPush();
        await savePrefs(false);
        setEnabled(false);
        toast.success("Rappels désactivés.");
      }
    } catch (e: any) {
      toast.error(`Erreur : ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveTime = async () => {
    setBusy(true);
    try {
      await savePrefs(enabled, true);
      toast.success("Heure de rappel enregistrée.");
    } catch (e: any) {
      toast.error(`Erreur : ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          Rappels & notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!supported ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <BellOff className="h-4 w-4" />
            Ton navigateur ne supporte pas les notifications.
          </p>
        ) : needsInstall ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground flex items-start gap-2">
              <Smartphone className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              Sur iPhone/iPad, les rappels ne fonctionnent que si l'app est ajoutée à
              l'écran d'accueil et ouverte depuis son icône.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/sportif/install">Voir comment installer l'app</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Activer les rappels</p>
                <p className="text-xs text-muted-foreground">
                  Un rappel quotidien pour remplir tes données.
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={handleToggle} disabled={busy || !canEnablePush()} />
            </div>

            {enabled && (
              <div className="space-y-2 border-t border-border pt-3">
                <Label htmlFor="reminder-time" className="text-xs">Heure du rappel</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="reminder-time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-32"
                  />
                  <Button size="sm" variant="outline" onClick={handleSaveTime} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Fuseau : {getUserTimeZone()}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
