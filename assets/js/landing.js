(() => {
  "use strict";

  const toggle = document.getElementById("mobile-nav-toggle");
  const mobileNav = document.getElementById("mobile-nav");

  function closeMobileNav() {
    if (!toggle || !mobileNav) return;
    mobileNav.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menu");
  }

  toggle?.addEventListener("click", () => {
    const open = mobileNav.hidden;
    mobileNav.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
  });

  mobileNav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMobileNav);
  });

  document.getElementById("footer-year").textContent =
    String(new Date().getFullYear());

  async function personalizeForSession() {
    const sb = window.supabaseClient;
    if (!sb) return;

    try {
      const { data, error } = await sb.auth.getSession();
      if (error || !data.session) return;

      window.location.replace("dashboard.html");
    } catch (error) {
      console.warn("Não foi possível verificar a sessão na landing page:", error);
    }
  }

  personalizeForSession();


})();
