const CACHE_VERSION = "luria-pwa-v56";
const STATIC_CACHE = CACHE_VERSION + "-static";
const RUNTIME_CACHE = CACHE_VERSION + "-runtime";

const APP_SHELL = [
  "/assets/js/image-lightbox.js?v=1",
  "/assets/css/image-lightbox.css?v=1",
  "/",
  "/index.html",
  "/login/",
  "/dashboard/",
  "/amigos/",
  "/assets/css/style.css?v=16.4",
  "/assets/css/landing.css",
  "/assets/css/pwa-mobile.css?v=9",
  "/assets/css/luria-brand-v5.css",
  "/assets/js/app.js?v=16.8",
  "/assets/js/onboarding.js?v=2.4",
  "/assets/css/onboarding.css?v=1.9",
  "/assets/js/storage-router.js?v=1.0.0",
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
            || (await caches.match("/dashboard/"))
            || (await caches.match("/login/"));
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
