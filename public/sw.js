// Service Worker — SONABHY Portail
// Stratégie : Network-first avec cache de secours.
// IMPORTANT : incrémenter CACHE_VERSION à chaque déploiement majeur
//             pour forcer le vidage du cache sur tous les clients.
const CACHE_VERSION = 'sonabhy-v4';

// ── Installation : activation immédiate ──────────────────────────────────────
self.addEventListener('install', () => {
  self.skipWaiting();
});

// ── Activation : purger les anciens caches ───────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch : Network-first ─────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Ignorer les appels API (jamais mis en cache)
  if (url.pathname.startsWith('/api')) return;

  // Ignorer les WebSocket (HMR Vite en dev)
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;

  // Ignorer les chunks JS hachés en développement (évite les conflits HMR)
  // Reconnaissables par leur nom : chunk-XXXXXXXX.js
  if (/\/chunk-[A-Z0-9]+\.js$/i.test(url.pathname)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Mettre en cache uniquement les réponses valides
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        // Réseau indisponible → tentative depuis le cache
        const cached = await caches.match(event.request);
        if (cached) return cached;

        // Ni réseau ni cache → réponse d'erreur propre (évite l'erreur "undefined" du SW)
        return new Response(
          JSON.stringify({ error: 'Hors ligne et ressource non disponible en cache' }),
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
  );
});
