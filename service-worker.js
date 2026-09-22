const CACHE_VERSION = "luria-pwa-v94";
const STATIC_CACHE = CACHE_VERSION + "-static";
const RUNTIME_CACHE = CACHE_VERSION + "-runtime";

const APP_SHELL = [
  "/assets/vendor/supabase-2.110.6.js",
  "/assets/js/image-lightbox.js?v=1",
  "/assets/css/image-lightbox.css?v=1",
  "/",
  "/index.html",
  "/manifest.webmanifest?v=4",
  "/assets/img/logos/logo-icone-original.png?v=pwa4",
  "/login/",
  "/dashboard/",
  "/assets/css/style.css?v=16.4",
  "/assets/css/landing.css",
  "/assets/css/pwa-mobile.css?v=13",
  "/assets/css/luria-brand-v5.css",
  "/assets/js/luria-brand-v5.js?v=11",
  "/assets/js/app.js?v=16.9",
  "/assets/js/onboarding.js?v=2.4",
  "/assets/css/onboarding.css?v=1.9",
  "/assets/js/storage-router.js?v=1.0.0",
  "/assets/js/pwa.js",
  "/assets/img/logos/logo-principal.png",
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

  // Arquivos críticos de inicialização: sempre tenta a rede primeiro.
  // Evita o app.js antigo ficar preso no cache e causar tela vazia/atraso entre páginas.
  if (url.pathname === "/assets/js/app.js") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

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
