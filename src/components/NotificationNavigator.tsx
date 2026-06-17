import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Écoute les messages du service worker (clic sur une notification push)
 * et navigue vers la page concernée via le routeur, même quand l'app est
 * déjà ouverte en arrière-plan.
 */
export function NotificationNavigator() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (data && data.type === "notification-navigate" && typeof data.url === "string") {
        try {
          const url = new URL(data.url, window.location.origin);
          if (url.origin === window.location.origin) {
            navigate(url.pathname + url.search + url.hash);
          }
        } catch {
          /* url invalide : on ignore */
        }
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [navigate]);

  return null;
}
