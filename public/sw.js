// public/sw.js — service worker de TPG Go.
// Rend l'app installable et sa coquille disponible hors-ligne.
// RÈGLE ABSOLUE : on ne met JAMAIS en cache /api/* (horaires toujours frais).

const VERSION = "tpg-go-v4";
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;
const MAX_ASSETS = 200;

// Écrans racines des onglets : disponibles hors-ligne dès la première visite.
const TAB_PAGES = ["/", "/search", "/settings"];
const SHELL = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Les appels API : toujours réseau, jamais de cache.
  if (url.pathname.startsWith("/api/")) return;

  // Navigation : réseau d'abord (HTML à jour), repli sur le cache hors-ligne.
  if (req.mode === "navigate") {
    event.respondWith(networkFirstPage(req));
    return;
  }

  // Assets immuables (chunks JS/CSS hashés, icônes, manifest) : cache d'abord.
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(req));
  }
  // Tout le reste (payloads RSC…) : comportement réseau par défaut.
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    /^\/(icon|apple-icon)[^/]*\.png$/.test(url.pathname)
  );
}

async function precache() {
  const pages = await caches.open(PAGES);
  const assets = await caches.open(ASSETS);
  await assets.addAll(SHELL);
  // On met les écrans des onglets en cache et on précharge les chunks qu'ils
  // référencent, pour que la coquille soit complète hors-ligne dès la 1re visite.
  const chunks = new Set();
  await Promise.all(
    TAB_PAGES.map(async (path) => {
      const res = await fetch(path, { cache: "reload" }).catch(() => null);
      if (!res?.ok) return;
      await pages.put(path, res.clone());
      const html = await res.text();
      for (const c of html.match(/\/_next\/static\/[^"'\s)]+/g) ?? []) chunks.add(c);
    }),
  );
  await Promise.all([...chunks].map((c) => assets.add(c).catch(() => {})));
}

async function networkFirstPage(req) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (
      (await cache.match(req)) ||
      (await cache.match(req, { ignoreSearch: true })) ||
      (await cache.match("/")) ||
      Response.error()
    );
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    await cache.put(req, res.clone());
    trim(cache);
  }
  return res;
}

/** Évite l'accumulation des chunks des anciens déploiements. */
async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ASSETS; i++) await cache.delete(keys[i]);
}
