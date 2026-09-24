const CACHE_VERSION = "luria-pwa-v104-admin-callouts-grid";
const STATIC_CACHE = CACHE_VERSION + "-static";
const RUNTIME_CACHE = CACHE_VERSION + "-runtime";

const APP_SHELL = [
  "/assets/vendor/supabase-2.110.6.js",
  "/assets/js/image-lightbox.js?v=1",
  "/assets/css/image-lightbox.css?v=1",
  "/",
  "/index.html",
  "/manifest.webmanifest?v=5",
  "/assets/img/logos/pwa-icon-180.png?v=pwa5",
  "/assets/img/logos/pwa-icon-512.png?v=pwa5",
  "/login/",
  "/configuracoes/",
  "/dashboard/",
  "/assets/css/style.css?v=16.6",
  "/assets/css/landing.css",
  "/assets/css/pwa-mobile.css?v=18",
  "/assets/css/luria-brand-v5.css",
  "/assets/js/luria-brand-v5.js?v=12",
  "/assets/js/app.js",
  "/assets/js/supabase.js?v=passkey1",
  "/assets/js/auth.js?v=auth3",
  "/assets/js/configuracoes.js?v=14.0",
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

  // Páginas e código do app: rede primeiro.
  // Isso evita que um deploy novo fique preso em versões antigas do HTML/JS/CSS.
  const isAppCode =
    url.pathname.endsWith(".js")
    || url.pathname.endsWith(".css")
    || url.pathname.endsWith(".html")
    || url.pathname.endsWith(".webmanifest");

  if (
    request.mode === "navigate"
    || isAppCode
  ) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((response) => {
          if (
            response
            && response.status === 200
          ) {
            const copy =
              response.clone();

            caches.open(
              RUNTIME_CACHE
            ).then(
              (cache) =>
                cache.put(
                  request,
                  copy
                )
            );
          }

          return response;
        })
        .catch(async () => {
          const cached =
            await caches.match(
              request
            );

          if (cached) {
            return cached;
          }

          if (
            request.mode
              === "navigate"
          ) {
            return (
              await caches.match(
                "/dashboard/"
              )
            ) || (
              await caches.match(
                "/login/"
              )
            );
          }

          throw new Error(
            "Recurso indisponível offline."
          );
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
