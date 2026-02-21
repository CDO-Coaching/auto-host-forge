import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Sauvegarde la route courante dans localStorage pour la restaurer
 * quand l'utilisateur revient dans l'app (mobile PWA).
 * Ne sauvegarde que les routes coach/sportif (pas auth, landing, etc.)
 */
export const RouteTracker = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname + location.search + location.hash;
    if (path.startsWith("/coach") || path.startsWith("/sportif")) {
      localStorage.setItem("last_route", path);
    }
  }, [location]);

  return null;
};
