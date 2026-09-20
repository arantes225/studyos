const CACHE_VERSION = "luria-pwa-v3";
const STATIC_CACHE = CACHE_VERSION + "-static";
const RUNTIME_CACHE = CACHE_VERSION + "-runtime";

const APP_SHELL = [
  "/",
  "/index.html",
  "//login/",
  "//dashboard/",
  "/assets/css/style.css",
  "/assets/css/landing.css",
  "/assets/css/luria-brand-v5.css",
  "/assets/js/app.js",
  "/assets/js/pwa.js",
  "/assets/img/favicon.png",
  "/assets/img/logo-icone-original.png",
  "/assets/img/logo-principal.png",
  "/assets/img/pwa-icon-180.png",
  "/assets/img/pwa-icon-192.png",
  "/assets/img/pwa-icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("luria-pwa-") && ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          return (await caches.match(request))
            || (await caches.match("//dashboard/"))
            || (await caches.match("//login/"));
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
