(() => {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js", { scope: "/" })
      .catch((error) => {
        console.warn("Não foi possível ativar o modo PWA da LURIA:", error);
      });
  });
})();
