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

      // Vérifie périodiquement s'il y a une nouvelle version
      setInterval(() => {
        registration.update();
      }, 60000); // Vérifie toutes les minutes

      // Gestion des mises à jour du SW
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // Nouvelle version disponible - informer l'utilisateur au lieu de recharger automatiquement
            console.log("Nouvelle version disponible");
            // Vous pouvez afficher une notification à l'utilisateur ici
          }
        });
      });
    } catch (error) {
      console.error("Erreur Service Worker:", error);
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
