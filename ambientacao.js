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


function resizeStudyFrame(frame) {
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
      "Não foi possível ajustar a altura da sessão de estudo:",
      error
    );
  }
}


function prepareEmbeddedStudyPage(
  frame,
  kind
) {
  try {
    const doc =
      frame.contentDocument;

    if (!doc) return;

    /*
      Remove a navegação duplicada da página
      carregada dentro da Ambientação.
    */

    [
      ".sidebar",
      ".sidebar-backdrop",
      ".topbar"
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


    /*
      FLASHCARDS
    */

    if (
      kind === "flashcards_batch"
    ) {
      [
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
    }


    /*
      CADERNO DE ERROS
    */

    if (
      kind === "errors_batch"
    ) {
      const intro =
        doc.querySelector(
          ".error-intro"
        );

      if (intro) {
        intro.style.display =
          "none";
      }

      const reviewPanel =
        doc.querySelector(
          ".error-review-panel"
        );

      if (reviewPanel) {
        reviewPanel.style.marginTop =
          "0";

        reviewPanel.style.boxShadow =
          "none";
      }
    }


    resizeStudyFrame(
      frame
    );


    if (
      "ResizeObserver"
      in window
      && doc.body
    ) {
      if (
        frame._docmapObserver
      ) {
        frame
          ._docmapObserver
          .disconnect();
      }

      const observer =
        new ResizeObserver(
          () => {
            resizeStudyFrame(
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
      "Não foi possível preparar a atividade dentro da Ambientação:",
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
      "ambientacao-study-frame"
    );

  const title =
    document.getElementById(
      "ambientacao-workspace-title"
    );

  const copy =
    document.getElementById(
      "ambientacao-workspace-copy"
    );

  if (
    !workspace
    || !frame
  ) {
    return;
  }


  const supported = [
    "flashcards_batch",
    "errors_batch"
  ];

  if (
    !supported.includes(
      kind
    )
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

  const activityArea =
    params.get("area");


  let pageName =
    "";

  if (
    kind === "flashcards_batch"
  ) {
    pageName =
      "flashcards.html";

    if (title) {
      title.textContent =
        "Flashcards";
    }

    if (copy) {
      copy.textContent =
        "Revise os flashcards programados na agenda sem sair da Ambientação.";
    }

    frame.title =
      "Revisão de flashcards";
  }


  if (
    kind === "errors_batch"
  ) {
    pageName =
      "caderno-erros.html";

    if (title) {
      title.textContent =
        "Caderno de erros";
    }

    if (copy) {
      copy.textContent =
        "Revise os erros programados na agenda sem sair da Ambientação.";
    }

    frame.title =
      "Revisão do caderno de erros";
  }


  const url =
    new URL(
      pageName,
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


  if (activityArea) {
    url.searchParams.set(
      "agenda_area",
      activityArea
    );
  }


  workspace.hidden =
    false;


  frame.addEventListener(
    "load",
    () => {
      prepareEmbeddedStudyPage(
        frame,
        kind
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
            "ambientacao-study-frame"
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
