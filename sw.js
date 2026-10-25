// Offline support: always try the network first so updates show up right away; use the cache when offline.
const CACHE = "knit-v3";
const SHELL = [
  "./",
  "index.html",
  "app.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "vendor/pdf.min.js",
  "vendor/pdf.worker.min.js",
  "vendor/anthropic-sdk.mjs"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.includes("/api/")) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      // with a saved copy to fall back on, don't wait long on a weak connection
      const ctrl = new AbortController();
      const timer = cached ? setTimeout(() => ctrl.abort(), 4000) : null;
      try {
        const res = await fetch(req, { cache: "no-cache", signal: ctrl.signal });
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        if (cached) return cached;
        throw err;
      } finally {
        clearTimeout(timer);
      }
    })
  );
});
