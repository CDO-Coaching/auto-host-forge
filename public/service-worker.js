// Service Worker pour PWA
// Objectif: cache uniquement l'app shell / assets statiques, jamais les appels API.

const CACHE_NAME = 'cdo-coaching-v5';
const urlsToCache = [
  '/',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .catch(() => {
        // Installation failure — continue without cache
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
          return undefined;
        }),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ne jamais mettre en cache les requêtes non-GET
  if (req.method !== 'GET') return;

  // Ne jamais intercepter les requêtes Supabase (auth, rest, realtime, storage)
  if (url.hostname.includes('supabase') || url.hostname.includes('supabasekong')) return;

  // Ne jamais mettre en cache les requêtes cross-origin
  if (url.origin !== self.location.origin) return;

  // Pour les navigations (index.html / routes), on préfère le réseau puis fallback cache.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/'))),
    );
    return;
  }

  // Pour les assets same-origin: cache-first.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      });
    }),
  );
});

// ───────────────────────── Notifications push ─────────────────────────
// Réception d'une notification poussée par le serveur.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'CDO Coaching', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'CDO Coaching';
  const options = {
    body: payload.body || "N'oublie pas de remplir tes données du jour 💪",
    icon: payload.icon || '/web-app-manifest-192x192.png',
    badge: payload.badge || '/web-app-manifest-192x192.png',
    tag: payload.tag || 'cdo-reminder',
    renotify: true,
    data: { url: payload.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Clic sur la notification : focus l'app si ouverte (et lui demander de naviguer
// via le routeur), sinon l'ouvrir directement sur la bonne page.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        if ('focus' in client) {
          await client.focus();
          // L'app est déjà ouverte : on lui demande de changer de page via React Router
          // (plus fiable que client.navigate, notamment en PWA iOS).
          client.postMessage({ type: 'notification-navigate', url: targetUrl });
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
    })(),
  );
});
