const CACHE_VERSION = "luria-pwa-v81";
const STATIC_CACHE = CACHE_VERSION + "-static";
const RUNTIME_CACHE = CACHE_VERSION + "-runtime";

const APP_SHELL = [
  "/assets/vendor/supabase-2.110.6.js",
  "/assets/js/image-lightbox.js?v=1",
  "/assets/css/image-lightbox.css?v=1",
  "/",
  "/index.html",
  "/login/",
  "/dashboard/",
  "/amigos/",
  "/assets/css/style.css?v=16.4",
  "/assets/css/landing.css",
  "/assets/css/pwa-mobile.css?v=13",
  "/assets/css/luria-brand-v5.css",
  "/assets/js/app.js?v=16.9",
  "/assets/js/onboarding.js?v=2.4",
  "/assets/css/onboarding.css?v=1.9",
  "/assets/js/storage-router.js?v=1.0.0",
  "/assets/js/pwa.js",
  "/assets/css/amigos.css?v=23",
  "/assets/js/studyrats.js?v=21",
  "/assets/img/studyrats/ratinhos/ratinho_verde_radioativo.webp?v=16",
  "/assets/img/studyrats/ratinhos/ratinho_laranja.webp?v=16",
  "/assets/img/studyrats/ratinhos/ratinho_tigrado.webp?v=16",
  "/assets/img/studyrats/ratinhos/ratinho_rosa_choque.webp?v=16",
  "/assets/img/studyrats/ratinhos/ratinho_marrom.webp?v=16",
  "/assets/img/studyrats/ratinhos/ratinho_branco.webp?v=16",
  "/assets/img/studyrats/ratinhos/ratinho_preto.webp?v=16",
  "/assets/img/studyrats/ratinhos/ratinho_cinza.webp?v=16",
  "/assets/img/studyrats/ratinhos/ratinho_azul.webp?v=16",
  "/assets/img/studyrats/ratinhos/ratinho_lavanda_manchado.webp?v=16",
  "/assets/img/studyrats/acessórios/cabeça/cabeça/colorful-cap.webp?v=16",
  "/assets/img/studyrats/acessórios/cabeça/cabeça/cowboy-hat.webp?v=16",
  "/assets/img/studyrats/acessórios/cabeça/cabeça/crown.webp?v=16",
  "/assets/img/studyrats/acessórios/cabeça/cabeça/gamer-headset.webp?v=16",
  "/assets/img/studyrats/acessórios/cabeça/cabeça/magic-top-hat.webp?v=16",
  "/assets/img/studyrats/acessórios/cabeça/cabeça/mouse-ears-headband.webp?v=16",
  "/assets/img/studyrats/acessórios/cabeça/cabeça/pink-bow-hat.webp?v=16",
  "/assets/img/studyrats/acessórios/cabeça/cabeça/santa-hat.webp?v=16",
  "/assets/img/studyrats/acessórios/cabeça/cabeça/unicorn-headband.webp?v=16",
  "/assets/img/studyrats/acessórios/cabeça/cabeça/viking-helmet.webp?v=16",
  "/assets/img/studyrats/acessórios/cabeça/cabeça/wizard-hat.webp?v=16",
  "/assets/img/studyrats/acessórios/rosto/cyberpunk-visor.webp?v=16",
  "/assets/img/studyrats/acessórios/rosto/pink-round-glasses.webp?v=16",
  "/assets/img/studyrats/acessórios/rosto/round-nerd-glasses.webp?v=16",
  "/assets/img/studyrats/acessórios/costas/angel-wings.webp?v=16",
  "/assets/img/studyrats/acessórios/atras/atras/rocket-flame.webp?v=16",
  "/assets/img/studyrats/acessórios/atras/capacete-astronauta.png?v=16",
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
