/**
 * Web Push (VAPID) — abonnement côté client.
 * La clé publique est publique par nature (cohérent avec l'URL Supabase en dur).
 * La clé privée correspondante reste secrète côté Edge Function.
 */
import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY =
  "BKGnX_WagdGtmaye8AXAQqEHBfFG933E9EEnNJFGOxkS1xPO2g59EUfYYYnnH5lXZAiJCGyIX9j8-UV_4UtRN_U";

/** Le navigateur supporte-t-il le Web Push ? */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** L'app tourne-t-elle en mode "installée" (écran d'accueil) ? */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari expose navigator.standalone
    (window.navigator as any).standalone === true
  );
}

/** Appareil iOS / iPadOS ? */
export function isIOS(): boolean {
  const ua = window.navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS récents se présentent comme Mac mais ont du tactile
    (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1)
  );
}

/**
 * Sur iPhone/iPad, le push n'est disponible QUE si l'app est lancée
 * depuis l'écran d'accueil (mode standalone). Ailleurs il suffit du support navigateur.
 */
export function canEnablePush(): boolean {
  if (!isPushSupported()) return false;
  if (isIOS() && !isStandalone()) return false;
  return true;
}

/** Le fuseau horaire de l'utilisateur (ex: "Europe/Paris"). */
export function getUserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris";
  } catch {
    return "Europe/Paris";
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * Demande la permission, crée/réutilise l'abonnement push et l'enregistre en base.
 * Renvoie true si l'abonnement est actif.
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!canEnablePush()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const endpoint = subscription.endpoint;
  const p256dh = json.keys?.p256dh || arrayBufferToBase64(subscription.getKey("p256dh"));
  const auth = json.keys?.auth || arrayBufferToBase64(subscription.getKey("auth"));

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );
  if (error) {
    console.error("push subscribe save error", error);
    return false;
  }
  return true;
}

/** Désabonne l'appareil courant et supprime la ligne en base. */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => {});
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
