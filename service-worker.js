const CACHE_VERSION = "luria-pwa-v122-web-init-hotfix";
const PLANTAO_IMAGE_CACHE = "luria-plantao-images-v1";
const PLANTAO_IMAGE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
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
  "/plantao/",
  "/assets/css/style.css?v=16.6",
  "/assets/css/landing.css",
  "/assets/css/pwa-mobile.css?v=18",
  "/assets/css/luria-brand-v5.css",
  "/assets/js/luria-brand-v5.js?v=12",
  "/assets/js/app.js",
  "/assets/js/supabase.js?v=passkey1",
  "/assets/js/auth.js?v=auth3",
  "/assets/js/configuracoes.js?v=13.1",
  "/assets/js/exam-priority-data.js?v=1",
  "/assets/js/exam-priority.js?v=1",
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

  // Imagens de pacientes do Plantão: cache-first por 7 dias.
  // Depois do primeiro uso, a mesma imagem volta do cache e evita novo download.
  if (url.pathname.startsWith("/assets/img/plantao/")) {
    event.respondWith((async () => {
      const cache = await caches.open(PLANTAO_IMAGE_CACHE);
      const cached = await cache.match(request);
      if (cached) {
        const cachedAt = Number(cached.headers.get("sw-cached-at") || 0);
        if (cachedAt && (Date.now() - cachedAt) < PLANTAO_IMAGE_MAX_AGE_MS) return cached;
      }
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const body = await response.clone().blob();
          const headers = new Headers(response.headers);
          headers.set("sw-cached-at", String(Date.now()));
          await cache.put(request, new Response(body, { status: response.status, statusText: response.statusText, headers }));
        }
        return response;
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    })());
    return;
  }

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
