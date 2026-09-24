(() => {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches
    || window.navigator.standalone === true;

  if (standalone) {
    document.documentElement.classList.add("pwa-standalone");
    document.documentElement.dataset.pwa = "standalone";
  }

  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(
        "/service-worker.js",
        {
          scope: "/",
          updateViaCache: "none"
        }
      )
      .then(
        (registration) =>
          registration.update()
      )
      .catch((error) => {
        console.warn("Não foi possível ativar o modo PWA do LURIA:", error);
      });
  });
})();
