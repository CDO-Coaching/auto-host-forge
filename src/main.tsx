import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Enregistrer le service worker pour PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/service-worker.js");
      console.log("Service Worker enregistré:", registration);

      // Vérifie périodiquement s'il y a une nouvelle version
      registration.update();

      // Quand un nouveau SW prend le contrôle, on recharge pour éviter un "écran noir"
      // dû à un bundle JS/HTML désynchronisé.
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });

      // Déclenche le controllerchange dès qu'une nouvelle version est installée
      registration.addEventListener("updatefound", () => {
        const sw = registration.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            // Le nouveau SW est installé; il prendra la main et déclenchera controllerchange
            // (et donc reload) juste après.
          }
        });
      });
    } catch (error) {
      console.log("Erreur Service Worker:", error);
    }
  });
}

