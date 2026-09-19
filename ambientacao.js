(() => {
  "use strict";

  const STYLE_ID = "resibulando-ambientacao-v18-style";

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(String(value || ""));
  }

  function injectAmbientacaoStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* =====================================================
         RESIBULANDO V18 — AMBIENTAÇÃO
         ===================================================== */

      /* CCQ sai da Ambientação e passa para o Dashboard. */
      .ccq-showcase-panel {
        display: none !important;
      }

      /* Atividade selecionada mais discreta durante uma aula. */
      body.ambientacao-lesson-active .selected-activity {
        min-height: 0 !important;
        margin-bottom: 10px !important;
        padding: 9px 12px !important;
        gap: 10px !important;
        border-radius: 11px !important;
        background: var(--surface) !important;
      }

      body.ambientacao-lesson-active .selected-activity .badge {
        display: none !important;
      }

      body.ambientacao-lesson-active .selected-activity h2 {
        margin: 0 !important;
        font-size: 14px !important;
        line-height: 1.25 !important;
        letter-spacing: -.015em !important;
      }

      body.ambientacao-lesson-active .selected-activity p {
        margin: 3px 0 0 !important;
        font-size: 9px !important;
        line-height: 1.35 !important;
      }

      body.ambientacao-lesson-active #clear-selected-activity {
        min-height: 30px !important;
        padding: 0 10px !important;
        font-size: 9px !important;
      }

      /* O painel passa a ser essencialmente o caderno. */
      .ambientacao-workspace.lesson-notebook-workspace {
        padding: 12px !important;
        margin-top: 12px !important;
        overflow: visible !important;
      }

      .ambientacao-workspace.lesson-notebook-workspace > .panel-header {
        display: none !important;
      }

      /* Bloco da aula compacto, sem competir com o caderno. */
      .lesson-notebook-workspace .agenda-lesson-activity {
        margin-bottom: 10px !important;
        padding: 10px 12px !important;
        border-radius: 10px !important;
        background: var(--surface-2) !important;
      }

      .lesson-notebook-workspace .agenda-lesson-activity > .badge {
        display: none !important;
      }

      .lesson-notebook-workspace .agenda-lesson-activity h3 {
        margin: 0 !important;
        font-size: 15px !important;
        line-height: 1.3 !important;
        letter-spacing: -.015em !important;
      }

      .lesson-notebook-workspace .agenda-lesson-meta {
        margin-top: 3px !important;
        font-size: 9px !important;
        font-weight: 700 !important;
      }

      .lesson-notebook-workspace .agenda-lesson-subtitle {
        margin: 5px 0 0 !important;
        font-size: 9px !important;
        line-height: 1.4 !important;
      }

      .lesson-notebook-workspace .agenda-lesson-actions {
        margin-top: 8px !important;
        gap: 8px !important;
      }

      .lesson-notebook-workspace .agenda-lesson-actions .button {
        min-height: 31px !important;
        padding: 0 11px !important;
        font-size: 9px !important;
      }

      .lesson-notebook-workspace .agenda-lesson-status {
        min-height: 0 !important;
        font-size: 9px !important;
      }

      .lesson-notebook-workspace .ambientacao-workspace-frame {
        width: 100% !important;
        min-height: 820px !important;
        margin: 0 !important;
        border: 0 !important;
        border-radius: 10px !important;
        background: transparent !important;
      }

      @media (max-width: 760px) {
        .ambientacao-workspace.lesson-notebook-workspace {
          padding: 8px !important;
        }

        body.ambientacao-lesson-active .selected-activity {
          align-items: stretch !important;
        }

        .lesson-notebook-workspace .ambientacao-workspace-frame {
          min-height: 720px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function resizeNotebookFrame(frame) {
    try {
      const doc = frame.contentDocument;
      if (!doc) return;

      const height = Math.max(
        720,
        doc.documentElement?.scrollHeight || 0,
        doc.body?.scrollHeight || 0
      );

      frame.style.height = `${height + 20}px`;
    } catch (error) {
      console.warn("Não foi possível ajustar o caderno incorporado:", error);
    }
  }

  function prepareNotebookFrame(frame) {
    try {
      const doc = frame.contentDocument;
      if (!doc) return;

      doc.documentElement.classList.add("ambientacao-notebook-embed");
      doc.body?.classList.add("ambientacao-notebook-embed");

      [
        ".sidebar",
        ".sidebar-backdrop",
        ".sidebar-desktop-toggle",
        ".topbar",
        ".notebook-tabs",
        ".notebook-topic-panel",
        "#notebook-view-library"
      ].forEach((selector) => {
        doc.querySelectorAll(selector).forEach((element) => {
          element.style.display = "none";
        });
      });

      const appShell = doc.querySelector(".app-shell");
      if (appShell) {
        appShell.style.display = "block";
        appShell.style.gridTemplateColumns = "1fr";
        appShell.style.minHeight = "0";
      }

      const main = doc.querySelector(".main");
      if (main) {
        main.style.padding = "0";
        main.style.margin = "0";
        main.style.opacity = "1";
        main.style.width = "100%";
        main.style.minWidth = "0";
      }

      const page = doc.querySelector(".notebook-page, .page");
      if (page) {
        page.style.maxWidth = "none";
        page.style.width = "100%";
        page.style.margin = "0";
        page.style.padding = "0";
      }

      const editorView = doc.querySelector("#notebook-view-editor");
      if (editorView) {
        editorView.hidden = false;
        editorView.style.display = "block";
      }

      const workspace = doc.querySelector(".notebook-workspace");
      if (workspace) {
        workspace.style.display = "block";
        workspace.style.gridTemplateColumns = "1fr";
      }

      const column = doc.querySelector(".notebook-editor-column");
      if (column) {
        column.style.width = "100%";
        column.style.minWidth = "0";
      }

      const toolbar = doc.querySelector(".notebook-toolbar");
      if (toolbar) {
        toolbar.style.top = "0";
        toolbar.style.marginTop = "0";
      }

      const wrap = doc.querySelector(".notebook-document-wrap");
      if (wrap) {
        wrap.style.paddingTop = "0";
      }

      const paper = doc.querySelector(".notebook-paper");
      if (paper) {
        paper.style.width = "min(100%, 980px)";
        paper.style.maxWidth = "980px";
      }

      if (doc.body) {
        doc.body.style.margin = "0";
        doc.body.style.padding = "0";
        doc.body.style.background = "transparent";
      }

      let embedStyle = doc.getElementById("ambientacao-notebook-frame-style");

      if (!embedStyle) {
        embedStyle = doc.createElement("style");
        embedStyle.id = "ambientacao-notebook-frame-style";
        embedStyle.textContent = `
          html,
          body {
            min-height: 0 !important;
            background: transparent !important;
          }

          .notebook-main-shell,
          .notebook-page {
            min-height: 0 !important;
          }

          .notebook-toolbar {
            position: sticky !important;
            top: 0 !important;
            z-index: 40 !important;
          }

          .notebook-document-wrap {
            padding: 0 0 24px !important;
          }

          .notebook-paper {
            margin: 0 auto !important;
            min-height: 880px !important;
          }

          @media (max-width: 760px) {
            .notebook-paper {
              min-height: 720px !important;
            }
          }
        `;
        doc.head.appendChild(embedStyle);
      }

      resizeNotebookFrame(frame);

      if ("ResizeObserver" in window && doc.body) {
        frame._resibulandoNotebookObserver?.disconnect?.();

        const observer = new ResizeObserver(() => {
          resizeNotebookFrame(frame);
        });

        observer.observe(doc.body);
        frame._resibulandoNotebookObserver = observer;
      }
    } catch (error) {
      console.warn("Não foi possível preparar o caderno da aula:", error);
    }
  }

  function openLessonNotebookInAmbientacao() {
    const params = new URLSearchParams(window.location.search);

    if (params.get("kind") !== "lesson") {
      document.body.classList.remove("ambientacao-lesson-active");
      return;
    }

    const topicId = params.get("item_id");

    if (!isUuid(topicId)) {
      return;
    }

    injectAmbientacaoStyles();
    document.body.classList.add("ambientacao-lesson-active");

    const workspace = document.getElementById("ambientacao-workspace");
    const lesson = document.getElementById("ambientacao-lesson-activity");
    const frame = document.getElementById("ambientacao-study-frame");

    if (!workspace || !frame) {
      return;
    }

    workspace.hidden = false;
    workspace.classList.add("lesson-notebook-workspace");

    if (lesson) {
      lesson.hidden = false;
    }

    frame.hidden = false;
    frame.title = "Caderno da aula";

    const url = new URL("caderno.html", window.location.href);
    url.searchParams.set("topic_id", topicId);
    url.searchParams.set("view", "editor");
    url.searchParams.set("embed", "ambientacao");

    const targetUrl = url.toString();

    frame.addEventListener(
      "load",
      () => {
        prepareNotebookFrame(frame);
      },
      { once: true }
    );

    if (frame.src !== targetUrl) {
      frame.src = targetUrl;
    }
  }

  function boot() {
    injectAmbientacaoStyles();

    // Executa depois da inicialização original da Ambientação.
    window.setTimeout(
      openLessonNotebookInAmbientacao,
      0
    );
  }

  if (window.docmapUser) {
    boot();
  } else {
    window.addEventListener(
      "docmap:ready",
      boot,
      { once: true }
    );
  }
})();
