/*
 * Rsolve GRC Platform service worker.
 *
 * A registered service worker with a `fetch` handler is one of Chrome's
 * requirements for PWA installability — and therefore for Chrome to mint a
 * WebAPK (the real Android package it installs from the browser).
 *
 * Strategy:
 *   - navigations: network-first, falling back to the cached app shell offline
 *   - same-origin static assets: stale-while-revalidate
 *   - API + cross-origin (e.g. Google Fonts, the backend): never cached, so
 *     authenticated/tenant data is never written to the Cache Storage.
 */

const CACHE_NAME = "privox-grc-shell-v1";
const OFFLINE_SHELL = "./index.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Best-effort: a missing optional file must not fail the install.
      await Promise.allSettled([
        cache.add("./"),
        cache.add(OFFLINE_SHELL),
        cache.add("./manifest.webmanifest"),
        cache.add("./icons/icon-192.png"),
        cache.add("./icons/icon-512.png"),
      ]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match(OFFLINE_SHELL)) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type === "basic") {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // backend API + external fonts

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

// Allows the page to activate an updated worker immediately when it prompts.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
