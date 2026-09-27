// public/sw.js — service worker minimal pour rendre l'app installable et
// disponible hors-ligne (coquille de l'app). On NE met PAS en cache les
// réponses de /api/* : on veut toujours des horaires frais.

const CACHE = "tpg-shell-v1";
const SHELL = ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Les appels API : toujours réseau, jamais de cache.
  if (url.pathname.startsWith("/api/")) return;

  // Navigation : réseau d'abord, repli sur le cache si hors-ligne.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/"))
    );
    return;
  }

  // Assets statiques : cache d'abord.
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request))
  );
});
