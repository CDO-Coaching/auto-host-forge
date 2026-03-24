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
    const path = location.pathname;
    if (path.startsWith("/coach") || path.startsWith("/sportif")) {
      // Toujours sauvegarder le dashboard comme route de retour
      const dashboardRoute = path.startsWith("/coach") ? "/coach/dashboard" : "/sportif/dashboard";
      localStorage.setItem("last_route", dashboardRoute);
    }
  }, [location]);

  return null;
};
