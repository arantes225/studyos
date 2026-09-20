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

      const targets = [
        document.getElementById("header-cta"),
        document.getElementById("hero-cta"),
        document.getElementById("bottom-cta")
      ].filter(Boolean);

      targets.forEach((link) => {
        link.href = "dashboard.html";
      });

      const header = document.getElementById("header-cta");
      const hero = document.getElementById("hero-cta");
      const bottom = document.getElementById("bottom-cta");
      const login = document.getElementById("login-link");

      if (header) header.textContent = "Abrir plataforma";
      if (hero) hero.innerHTML = 'Abrir plataforma <span aria-hidden="true">→</span>';
      if (bottom) bottom.innerHTML = 'Abrir plataforma <span aria-hidden="true">→</span>';

      if (login) {
        login.href = "dashboard.html";
        login.textContent = "Minha conta";
      }
    } catch (error) {
      console.warn("Não foi possível verificar a sessão na landing page:", error);
    }
  }

  personalizeForSession();
})();
