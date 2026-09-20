(() => {
  const allowedPages = new Set([
    "caderno",
    "erros",
    "flashcards"
  ]);

  if (!allowedPages.has(document.body?.dataset?.page)) {
    return;
  }

  function isContentImage(img) {
    if (!(img instanceof HTMLImageElement)) return false;

    if (
      img.closest(
        "#sidebar, .sidebar, .brand, .image-lightbox"
      )
    ) {
      return false;
    }

    if (
      img.id === "luria-brand-logo"
      || img.classList.contains("luria-theme-logo")
      || img.classList.contains("brand-logo-single")
    ) {
      return false;
    }

    const src =
      img.currentSrc
      || img.src
      || "";

    return Boolean(src);
  }

  function ensureLightbox() {
    let lightbox =
      document.getElementById(
        "image-lightbox"
      );

    if (lightbox) {
      return lightbox;
    }

    lightbox =
      document.createElement(
        "div"
      );

    lightbox.id =
      "image-lightbox";

    lightbox.className =
      "image-lightbox";

    lightbox.hidden =
      true;

    lightbox.innerHTML = `
      <button
        class="image-lightbox-close"
        type="button"
        aria-label="Fechar imagem ampliada"
      >×</button>

      <div
        class="image-lightbox-stage"
        role="dialog"
        aria-modal="true"
        aria-label="Imagem ampliada"
      >
        <img
          class="image-lightbox-image"
          alt=""
        >
      </div>
    `;

    document.body.appendChild(
      lightbox
    );

    const close =
      () => {
        lightbox.hidden =
          true;

        document.body.classList.remove(
          "image-lightbox-open"
        );

        const image =
          lightbox.querySelector(
            ".image-lightbox-image"
          );

        if (image) {
          image.removeAttribute(
            "src"
          );
        }
      };

    lightbox
      .querySelector(
        ".image-lightbox-close"
      )
      ?.addEventListener(
        "click",
        close
      );

    lightbox.addEventListener(
      "click",
      event => {
        if (
          event.target === lightbox
          || event.target?.classList?.contains(
            "image-lightbox-stage"
          )
        ) {
          close();
        }
      }
    );

    document.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "Escape"
          && !lightbox.hidden
        ) {
          close();
        }
      }
    );

    return lightbox;
  }

  function openImage(img) {
    const lightbox =
      ensureLightbox();

    const target =
      lightbox.querySelector(
        ".image-lightbox-image"
      );

    if (!target) return;

    target.src =
      img.currentSrc
      || img.src;

    target.alt =
      img.alt
      || "Imagem ampliada";

    lightbox.hidden =
      false;

    document.body.classList.add(
      "image-lightbox-open"
    );
  }

  document.addEventListener(
    "click",
    event => {
      const img =
        event.target?.closest?.(
          "img"
        );

      if (
        !isContentImage(
          img
        )
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      openImage(
        img
      );
    }
  );

  document.addEventListener(
    "keydown",
    event => {
      if (
        event.key !== "Enter"
        && event.key !== " "
      ) {
        return;
      }

      const img =
        event.target;

      if (
        !isContentImage(
          img
        )
      ) {
        return;
      }

      event.preventDefault();

      openImage(
        img
      );
    }
  );

  function markImages(scope = document) {
    scope
      .querySelectorAll(
        "img"
      )
      .forEach(
        img => {
          if (
            !isContentImage(
              img
            )
          ) {
            return;
          }

          img.classList.add(
            "image-zoomable"
          );

          if (
            !img.hasAttribute(
              "tabindex"
            )
          ) {
            img.tabIndex =
              0;
          }

          if (
            !img.hasAttribute(
              "role"
            )
          ) {
            img.setAttribute(
              "role",
              "button"
            );
          }

          img.setAttribute(
            "aria-label",
            img.alt
              ? `Ampliar imagem: ${img.alt}`
              : "Ampliar imagem"
          );
        }
      );
  }

  markImages();

  const observer =
    new MutationObserver(
      mutations => {
        for (
          const mutation
          of mutations
        ) {
          mutation.addedNodes
            .forEach(
              node => {
                if (
                  !(node instanceof Element)
                ) {
                  return;
                }

                if (
                  node.matches(
                    "img"
                  )
                ) {
                  markImages(
                    node.parentElement
                    || document
                  );
                } else {
                  markImages(
                    node
                  );
                }
              }
            );
        }
      }
    );

  observer.observe(
    document.body,
    {
      childList:
        true,
      subtree:
        true
    }
  );
})();