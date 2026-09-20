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


  function applyLuriaWordmark(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("script, style, textarea, input, option, .luria-wordmark")) return NodeFilter.FILTER_REJECT;
        return /\\bLuria\\b/.test(node.nodeValue || "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const parts = node.nodeValue.split(/(\\bLuria\\b)/g);
      const fragment = document.createDocumentFragment();
      parts.forEach((part) => {
        if (part === "Luria") {
          const span = document.createElement("span");
          span.className = "luria-wordmark";
          span.textContent = part;
          fragment.appendChild(span);
        } else if (part) {
          fragment.appendChild(document.createTextNode(part));
        }
      });
      node.replaceWith(fragment);
    });
  }

  function watchLuriaWordmark() {
    applyLuriaWordmark();
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) applyLuriaWordmark(node.parentElement);
        else if (node.nodeType === Node.ELEMENT_NODE) applyLuriaWordmark(node);
      }));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchLuriaWordmark, { once: true });
  } else {
    watchLuriaWordmark();
  }

})();
