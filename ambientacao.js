function parseAmbientacaoDate(value) {
  if (!value) return "";

  const [year, month, day] =
    value.split("-").map(Number);

  const date =
    new Date(
      year,
      month - 1,
      day
    );

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }
  ).format(date);
}


function resizeFlashcardsFrame(frame) {
  try {
    const doc =
      frame.contentDocument;

    if (!doc) return;

    const height =
      Math.max(
        620,
        doc.documentElement.scrollHeight,
        doc.body?.scrollHeight || 0
      );

    frame.style.height =
      `${height + 24}px`;

  } catch (error) {
    console.warn(
      "Não foi possível ajustar a altura dos flashcards:",
      error
    );
  }
}


function prepareEmbeddedFlashcards(frame) {
  try {
    const doc =
      frame.contentDocument;

    if (!doc) return;

    /*
      Esconde toda a estrutura duplicada
      da página de flashcards.
      Dentro da Ambientação mostramos
      somente a área de revisão.
    */

    [
      ".sidebar",
      ".sidebar-backdrop",
      ".topbar",
      ".flash-metrics",
      ".flash-tabs",
      '[data-flash-section="create"]',
      '[data-flash-section="import"]',
      '[data-flash-section="library"]'
    ].forEach((selector) => {
      doc
        .querySelectorAll(selector)
        .forEach((element) => {
          element.style.display =
            "none";
        });
    });

    const appShell =
      doc.querySelector(
        ".app-shell"
      );

    if (appShell) {
      appShell.style.display =
        "block";

      appShell.style.minHeight =
        "0";
    }

    const main =
      doc.querySelector(
        ".main"
      );

    if (main) {
      main.style.padding =
        "0";

      main.style.opacity =
        "1";

      main.style.minWidth =
        "0";
    }

    const page =
      doc.querySelector(
        ".page"
      );

    if (page) {
      page.style.maxWidth =
        "none";

      page.style.margin =
        "0";
    }

    const review =
      doc.querySelector(
        '[data-flash-section="review"]'
      );

    if (review) {
      review.classList.add(
        "active"
      );

      review.style.display =
        "block";
    }

    const reviewPanel =
      review?.querySelector(
        ".panel"
      );

    if (reviewPanel) {
      reviewPanel.style.marginTop =
        "0";

      reviewPanel.style.boxShadow =
        "none";
    }

    resizeFlashcardsFrame(
      frame
    );

    if (
      "ResizeObserver"
      in window
      && doc.body
    ) {
      const observer =
        new ResizeObserver(
          () => {
            resizeFlashcardsFrame(
              frame
            );
          }
        );

      observer.observe(
        doc.body
      );

      frame._docmapObserver =
        observer;
    }

  } catch (error) {
    console.warn(
      "Não foi possível preparar os flashcards dentro da Ambientação:",
      error
    );
  }
}


function openActivityWorkspace(params) {
  const kind =
    params.get("kind");

  const workspace =
    document.getElementById(
      "ambientacao-workspace"
    );

  const frame =
    document.getElementById(
      "ambientacao-flashcards-frame"
    );

  if (
    !workspace
    || !frame
  ) {
    return;
  }

  if (
    kind !== "flashcards_batch"
  ) {
    workspace.hidden =
      true;

    frame.removeAttribute(
      "src"
    );

    return;
  }

  const activityDate =
    params.get("date");

  const url =
    new URL(
      "flashcards.html",
      window.location.href
    );

  url.searchParams.set(
    "embed",
    "ambientacao"
  );

  if (activityDate) {
    url.searchParams.set(
      "agenda_date",
      activityDate
    );
  }

  workspace.hidden =
    false;

  frame.addEventListener(
    "load",
    () => {
      prepareEmbeddedFlashcards(
        frame
      );
    },
    {
      once: true
    }
  );

  frame.src =
    url.toString();
}


function initSelectedActivity() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  const title =
    params.get("title");

  const container =
    document.getElementById(
      "selected-activity"
    );

  if (title) {
    const titleElement =
      document.getElementById(
        "selected-activity-title"
      );

    const metaElement =
      document.getElementById(
        "selected-activity-meta"
      );

    const bits = [
      params.get("area"),
      params.get("materia"),
      parseAmbientacaoDate(
        params.get("date")
      )
    ].filter(Boolean);

    titleElement.textContent =
      title;

    metaElement.textContent =
      bits.join(" · ");

    container.hidden =
      false;
  }

  openActivityWorkspace(
    params
  );

  document
    .getElementById(
      "clear-selected-activity"
    )
    ?.addEventListener(
      "click",
      () => {
        window.history.replaceState(
          {},
          "",
          "ambientacao.html"
        );

        container.hidden =
          true;

        const workspace =
          document.getElementById(
            "ambientacao-workspace"
          );

        const frame =
          document.getElementById(
            "ambientacao-flashcards-frame"
          );

        if (workspace) {
          workspace.hidden =
            true;
        }

        if (frame) {
          frame.removeAttribute(
            "src"
          );
        }
      }
    );
}


if (window.docmapUser) {
  initSelectedActivity();

} else {
  window.addEventListener(
    "docmap:ready",
    initSelectedActivity,
    {
      once: true
    }
  );
}


function bindAmbientacaoLofi() {
  if (!window.docmapAudio) {
    return;
  }

  /*
    O app.js já conecta
    os controles de áudio.
  */
}


if (window.docmapAudio) {
  bindAmbientacaoLofi();

} else {
  window.addEventListener(
    "docmap:audio-ready",
    bindAmbientacaoLofi,
    {
      once: true
    }
  );
}
