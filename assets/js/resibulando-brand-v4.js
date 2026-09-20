
(() => {
  "use strict";

  const LOGOS = {
    light: "assets/img/logo-icone-original.png?v=resibulando4",
    dark: "assets/img/logo-icone-azul-claro.png?v=resibulando4",
    "leila-mood": "assets/img/logo-icone-rosa-escuro.png?v=resibulando4"
  };

  function resolvedTheme() {
    const theme =
      document.documentElement.dataset.theme
      || "light";

    if (theme === "dark") {
      return "dark";
    }

    if (theme === "leila-mood") {
      return "leila-mood";
    }

    return "light";
  }

  function currentLogoSource() {
    return LOGOS[resolvedTheme()];
  }

  function ensureBrandCopy(brand) {
    let copy =
      brand.querySelector(".brand-copy");

    if (!copy) {
      copy =
        document.createElement("span");

      copy.className =
        "brand-copy";

      brand.appendChild(copy);
    }

    let title =
      copy.querySelector("strong");

    if (!title) {
      title =
        document.createElement("strong");

      copy.prepend(title);
    }

    title.textContent =
      "Resibulando";

    let subtitle =
      copy.querySelector("small");

    if (!subtitle) {
      subtitle =
        document.createElement("small");

      copy.appendChild(subtitle);
    }

    subtitle.textContent =
      "Mapa até a residência";
  }

  function cleanOldBrandElements(brand) {
    brand
      .querySelectorAll(
        [
          ".brand-mark",
          ".brand-logo-stack",
          ".brand-logo-single",
          ".brand-logo"
        ].join(",")
      )
      .forEach((element) => {
        if (
          !element.classList.contains(
            "resibulando-theme-logo"
          )
        ) {
          element.remove();
        }
      });

    brand
      .querySelectorAll("img")
      .forEach((image) => {
        if (
          !image.classList.contains(
            "resibulando-theme-logo"
          )
        ) {
          image.remove();
        }
      });
  }

  function fixBrand() {
    const brand =
      document.querySelector(
        "#sidebar .brand"
      )
      || document.querySelector(
        ".sidebar .brand"
      )
      || document.querySelector(
        "a.brand"
      );

    if (!brand) {
      return;
    }

    cleanOldBrandElements(
      brand
    );

    let logo =
      brand.querySelector(
        ".resibulando-theme-logo"
      );

    if (!logo) {
      logo =
        document.createElement("img");

      logo.className =
        "resibulando-theme-logo";

      logo.alt =
        "Logo Resibulando";

      const copy =
        brand.querySelector(
          ".brand-copy"
        );

      if (copy) {
        brand.insertBefore(
          logo,
          copy
        );
      } else {
        brand.prepend(
          logo
        );
      }
    }

    const source =
      currentLogoSource();

    if (
      logo.getAttribute("src")
      !== source
    ) {
      logo.setAttribute(
        "src",
        source
      );
    }

    ensureBrandCopy(
      brand
    );
  }

  function fixFavicon() {
    let favicon =
      document.querySelector(
        'link[rel~="icon"]'
      );

    if (!favicon) {
      favicon =
        document.createElement(
          "link"
        );

      favicon.rel =
        "icon";

      document.head.appendChild(
        favicon
      );
    }

    favicon.type =
      "image/png";

    favicon.href =
      "assets/img/favicon.png?v=resibulando4";
  }

  function run() {
    fixBrand();
    fixFavicon();
  }

  const themeObserver =
    new MutationObserver(
      () => {
        fixBrand();
      }
    );

  themeObserver.observe(
    document.documentElement,
    {
      attributes: true,
      attributeFilter: [
        "data-theme"
      ]
    }
  );

  const bodyObserver =
    new MutationObserver(
      () => {
        fixBrand();
      }
    );

  function startBodyObserver() {
    if (!document.body) {
      return;
    }

    bodyObserver.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );

    run();
  }

  if (
    document.readyState
    === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      startBodyObserver,
      {
        once: true
      }
    );
  } else {
    startBodyObserver();
  }

  window.addEventListener(
    "load",
    run,
    {
      once: true
    }
  );
})();
