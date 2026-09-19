(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  function numberFromPercent(text) {
    const value = Number(
      String(text || "")
        .replace("%", "")
        .replace(",", ".")
        .trim()
    );

    return Number.isFinite(value)
      ? value
      : null;
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) return "—";

    return `${value
      .toFixed(1)
      .replace(".", ",")}%`;
  }

  function ensureStartButton() {
    const tabs = document.querySelector(".qs-mode-tabs");
    if (!tabs || tabs.querySelector(".qs-v17-start-button")) return;

    const link = document.createElement("a");
    link.className = "qs-v17-start-button";
    link.href = "ambientacao.html";
    link.textContent = "Iniciar lista ou simulado";
    link.setAttribute("aria-label", "Ir para a Ambientação e iniciar lista ou simulado");

    tabs.appendChild(link);
  }

  function ensureDashboard() {
    const section = document.querySelector(
      '.qs-compact-dashboard[data-qs-section="mine"]'
    );

    if (!section) return null;

    if (section.querySelector(".qs-v17-dashboard")) {
      section.classList.add("qs-v17-ready");
      return section;
    }

    section.insertAdjacentHTML(
      "afterbegin",
      `
        <div class="qs-v17-dashboard">
          <div class="qs-v17-top">
            <article class="qs-v17-stat">
              <span>Semana atual</span>
              <strong id="qs-v17-week-total">—</strong>
              <small>Questões respondidas</small>
            </article>

            <article class="qs-v17-stat accuracy">
              <span>Semana atual</span>
              <strong id="qs-v17-week-accuracy">—</strong>
              <small>Percentual de acertos</small>
            </article>

            <article class="qs-v17-stat error">
              <span>Semana atual</span>
              <strong id="qs-v17-week-error">—</strong>
              <small>Percentual de erros</small>
            </article>
          </div>

          <article class="qs-v17-trend">
            <div class="qs-v17-trend-head">
              <div>
                <span class="qs-compact-eyebrow">Desempenho</span>
                <h2>Desempenho ao longo do tempo</h2>
                <p>Aproveitamento das questões ao longo dos dias.</p>
              </div>

              <strong
                id="qs-v17-trend-current"
                class="qs-v17-trend-current"
              >—</strong>
            </div>

            <div
              id="qs-v17-chart"
              class="qs-v17-chart"
              role="img"
              aria-label="Gráfico linear de desempenho ao longo do tempo"
            ></div>
          </article>
        </div>
      `
    );

    section.classList.add("qs-v17-ready");

    return section;
  }

  function syncValues() {
    const oldTotal = $("qs-week-questions");
    const oldAccuracy = $("qs-week-accuracy");
    const oldCurrent = $("qs-fortnight-current");
    const oldChart = $("qs-fortnight-chart");

    const newTotal = $("qs-v17-week-total");
    const newAccuracy = $("qs-v17-week-accuracy");
    const newError = $("qs-v17-week-error");
    const newCurrent = $("qs-v17-trend-current");
    const newChart = $("qs-v17-chart");

    if (newTotal) {
      newTotal.textContent =
        oldTotal?.textContent?.trim()
        || "—";
    }

    const accuracy =
      numberFromPercent(
        oldAccuracy?.textContent
      );

    if (newAccuracy) {
      newAccuracy.textContent =
        accuracy === null
          ? "—"
          : formatPercent(accuracy);
    }

    if (newError) {
      newError.textContent =
        accuracy === null
          ? "—"
          : formatPercent(
              Math.max(
                0,
                Math.min(
                  100,
                  100 - accuracy
                )
              )
            );
    }

    if (newCurrent) {
      newCurrent.textContent =
        oldCurrent?.textContent?.trim()
        || (
          accuracy === null
            ? "—"
            : `Atual · ${formatPercent(accuracy)}`
        );
    }

    if (
      newChart
      && oldChart
      && newChart.dataset.sourceHtml
        !== oldChart.innerHTML
    ) {
      newChart.dataset.sourceHtml =
        oldChart.innerHTML;

      newChart.innerHTML =
        oldChart.innerHTML;
    }
  }

  function observeSource(id) {
    const source = $(id);
    if (!source) return;

    const observer =
      new MutationObserver(
        syncValues
      );

    observer.observe(
      source,
      {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
      }
    );
  }

  function init() {
    ensureStartButton();

    const section =
      ensureDashboard();

    if (!section) return;

    [
      "qs-week-questions",
      "qs-week-accuracy",
      "qs-fortnight-current",
      "qs-fortnight-chart"
    ].forEach(observeSource);

    syncValues();

    // Cobre o primeiro carregamento assíncrono do dashboard original.
    setTimeout(syncValues, 250);
    setTimeout(syncValues, 900);
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }
})();
