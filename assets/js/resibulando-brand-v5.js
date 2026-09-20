
(() => {
  "use strict";

  const LOGOS = {
    light: "assets/img/logo-icone-original.png?v=resibulando5",
    dark: "assets/img/logo-icone-azul-claro.png?v=resibulando5",
    "leila-mood": "assets/img/logo-icone-rosa-escuro.png?v=resibulando5"
  };

  function getTheme() {
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

  function getLogoSource() {
    return LOGOS[getTheme()];
  }

  function getBrand() {
    return (
      document.querySelector("#sidebar .brand")
      || document.querySelector(".sidebar .brand")
      || document.querySelector("a.brand")
    );
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

    if (
      title.textContent
      !== "Resibulando"
    ) {
      title.textContent =
        "Resibulando";
    }

    let subtitle =
      copy.querySelector("small");

    if (!subtitle) {
      subtitle =
        document.createElement("small");

      copy.appendChild(subtitle);
    }

    if (
      subtitle.textContent
      !== "Mapa até a residência"
    ) {
      subtitle.textContent =
        "Mapa até a residência";
    }
  }

  function removeOldBrandElements(
    brand,
    keepLogo
  ) {
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
          element !== keepLogo
          && !element.classList.contains(
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
          image !== keepLogo
          && !image.classList.contains(
            "resibulando-theme-logo"
          )
        ) {
          image.remove();
        }
      });
  }

  function applyBrand() {
    const brand =
      getBrand();

    if (!brand) {
      return false;
    }

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

    removeOldBrandElements(
      brand,
      logo
    );

    const source =
      getLogoSource();

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

    return true;
  }

  function applyFavicon() {
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

    const source =
      "assets/img/favicon.png?v=resibulando5";

    if (
      favicon.getAttribute("href")
      !== source
    ) {
      favicon.setAttribute(
        "href",
        source
      );
    }
  }

  function run() {
    applyFavicon();
    applyBrand();
  }

  function retryUntilSidebarExists() {
    let attempts = 0;

    const tryApply = () => {
      attempts += 1;

      if (applyBrand()) {
        return;
      }

      if (attempts < 20) {
        window.setTimeout(
          tryApply,
          150
        );
      }
    };

    tryApply();
  }

  /*
    Observamos SOMENTE mudança do tema no <html>.
    Não observamos o body inteiro para evitar loop infinito.
  */
  const themeObserver =
    new MutationObserver(
      () => {
        applyBrand();
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

  if (
    document.readyState
    === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        run();
        retryUntilSidebarExists();
      },
      {
        once: true
      }
    );
  } else {
    run();
    retryUntilSidebarExists();
  }

  /*
    O app dispara este evento quando termina de montar a interface.
    Usamos o evento para aplicar a marca uma vez, sem observer no body.
  */
  document.addEventListener(
    "docmap:ready",
    () => {
      run();
    }
  );

  window.addEventListener(
    "pageshow",
    () => {
      run();
    }
  );
})();
