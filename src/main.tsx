import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Enregistrer le service worker UNIQUEMENT en production
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/service-worker.js");
      console.log("Service Worker enregistré:", registration);

      // Gestion des mises à jour du SW — avec protection contre InvalidStateError
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            console.log("Nouvelle version disponible");
          }
        });
      });

      // Vérifie les mises à jour toutes les 5 minutes (pas chaque minute)
      // avec try/catch pour éviter InvalidStateError
      setInterval(() => {
        try {
          registration.update().catch(() => {
            // SW update failed silently — will retry next interval
          });
        } catch {
          // InvalidStateError — SW is in a bad state, ignore
        }
      }, 5 * 60 * 1000);
    } catch (error) {
      console.error("Erreur Service Worker:", error);
      // Si le SW est dans un état invalide, le désenregistrer pour repartir propre
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      } catch {
        // ignore
      }
    }
  });
} else if ("serviceWorker" in navigator && !import.meta.env.PROD) {
  // En dev/preview: nettoyer les SW existants
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
    });
  });

  // Vider le cache
  if ("caches" in window) {
    caches.keys().then((names) => {
      names.forEach((name) => {
        caches.delete(name);
      });
    });
  }
}
