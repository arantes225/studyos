(() => {
  "use strict";

  const KEEP = {
    "general-summary": [
      "Tempo estudado",
      "Consistência",
      "Aderência às aulas",
      "Aproveitamento em questões",
      "Progresso das aulas",
      "Revisões de flashcards",
      "Retenção dos flashcards",
      "CCQs ativos",
      "Ofensiva"
    ],

    "lesson-summary": [
      "Aulas concluídas",
      "Progresso total",
      "Aderência",
      "Aulas atrasadas",
      "Pontualidade",
      "Tempo em aulas",
      "Dias com aula",
      "Revisões concluídas",
      "Área mais pendente"
    ],

    "flash-summary": [
      "Cards ativos",
      "Revisões realizadas",
      "Taxa de acerto",
      "Retenção atual",
      "Novos cards",
      "Únicos revisados",
      "Média por dia ativo",
      "Atrasados",
      "Estabilidade média"
    ],

    "error-summary": [
      "CCQs ativos",
      "Revisões realizadas",
      "Retenção atual",
      "Atrasados",
      "CCQs criados",
      "Únicos revisados",
      "Nunca revisados",
      "Estabilidade média",
      "Área com mais CCQs"
    ],

    "question-summary": [
      "Simulados realizados",
      "Questões respondidas",
      "Aproveitamento",
      "Erros enviados ao Caderno",
      "Acertos",
      "Erros",
      "Conversão para o Caderno",
      "Melhor área",
      "Área mais frágil"
    ]
  };

  function cleanTemporalHelper(text) {
    let value =
      String(text || "")
        .replace(/\s+/g, " ")
        .trim();

    value = value
      .replace(
        /^(?:14|30|90)\s+dias\s*·\s*/i,
        ""
      )
      .replace(
        /^todo o histórico\s*·\s*/i,
        ""
      )
      .replace(
        /\b(?:no|em)\s+(?:14|30|90)\s+dias\b/gi,
        ""
      )
      .replace(
        /\bno período\b/gi,
        ""
      )
      .replace(
        /\btodo o histórico\b/gi,
        ""
      )
      .replace(
        /\s*·\s*$/g,
        ""
      )
      .replace(
        /\s{2,}/g,
        " "
      )
      .trim();

    return value;
  }

  function normalizeGrid(gridId) {
    const grid =
      document.getElementById(
        gridId
      );

    if (!grid) return;

    const wanted =
      new Set(
        KEEP[gridId]
        || []
      );

    Array.from(
      grid.children
    )
      .forEach(
        card => {
          if (
            !card.classList
              .contains(
                "stats-summary-card"
              )
          ) {
            return;
          }

          const label =
            card
              .querySelector(
                ":scope > span"
              )
              ?.textContent
              ?.trim()
            || "";

          card.classList.toggle(
            "stats-v17-hidden",
            !wanted.has(
              label
            )
          );

          const helper =
            card.querySelector(
              ":scope > small"
            );

          if (helper) {
            const cleaned =
              cleanTemporalHelper(
                helper.textContent
              );

            if (
              helper.textContent
                .trim()
              !== cleaned
            ) {
              helper.textContent =
                cleaned;
            }
          }
        }
      );
  }

  function normalizeAll() {
    Object.keys(
      KEEP
    )
      .forEach(
        normalizeGrid
      );

    const allButton =
      document.querySelector(
        '[data-range="all"]'
      );

    if (
      allButton
      && allButton.textContent
        .trim()
        !== "Desde sempre"
    ) {
      allButton.textContent =
        "Desde sempre";
    }

    const generalDescription =
      document.querySelector(
        '[data-stats-panel="geral"] .stats-summary-box .stats-section-head p'
      );

    if (
      generalDescription
      && /quatro indicadores/i
        .test(
          generalDescription
            .textContent
        )
    ) {
      generalDescription.textContent =
        "Nove indicadores principais do período selecionado.";
    }
  }

  function observeGrid(gridId) {
    const grid =
      document.getElementById(
        gridId
      );

    if (!grid) return;

    const observer =
      new MutationObserver(
        () => {
          requestAnimationFrame(
            () =>
              normalizeGrid(
                gridId
              )
          );
        }
      );

    observer.observe(
      grid,
      {
        childList: true,
        subtree: true,
        characterData: true
      }
    );
  }

  function init() {
    Object.keys(
      KEEP
    )
      .forEach(
        observeGrid
      );

    normalizeAll();

    document
      .querySelectorAll(
        "[data-range]"
      )
      .forEach(
        button => {
          button.addEventListener(
            "click",
            () => {
              setTimeout(
                normalizeAll,
                80
              );

              setTimeout(
                normalizeAll,
                400
              );
            }
          );
        }
      );

    setTimeout(
      normalizeAll,
      250
    );

    setTimeout(
      normalizeAll,
      900
    );
  }

  if (
    document.readyState
    === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }
})();
