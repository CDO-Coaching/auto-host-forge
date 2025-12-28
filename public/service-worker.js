// Service Worker pour PWA
// Objectif: cache uniquement l'app shell / assets statiques, jamais les appels API.

const CACHE_NAME = 'cdo-coaching-v2';
const urlsToCache = [
  '/',
  '/sportif/seances',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)));
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

  // Ne jamais mettre en cache les requêtes non-GET (PATCH/POST/etc.)
  if (req.method !== 'GET') {
    event.respondWith(fetch(req));
    return;
  }

  // Ne jamais mettre en cache les requêtes cross-origin (ex: Supabase REST/Auth)
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(req));
    return;
  }

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

