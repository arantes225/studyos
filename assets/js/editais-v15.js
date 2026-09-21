(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  const examV15 = {
    rows: new Map(),
    loaded: false,
    observer: null,
    decorating: false
  };

  const $ = (id) => document.getElementById(id);

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmt(value, digits = 1) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return `${n.toFixed(digits).replace(".", ",")}%`;
  }

  function normalizeHistory(value) {
    if (!Array.isArray(value)) return [];

    const rows = value
      .map((item, index) => {
        const score = Number(item?.score);
        const year = String(item?.year ?? "").trim();

        return {
          year,
          score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null,
          _index: index
        };
      })
      .filter(item => item.score !== null);

    return rows
      .sort((a, b) => {
        const ay = Number.parseInt(a.year, 10);
        const by = Number.parseInt(b.year, 10);

        if (Number.isFinite(ay) && Number.isFinite(by) && ay !== by) {
          return by - ay;
        }

        if (Number.isFinite(ay) && !Number.isFinite(by)) return -1;
        if (!Number.isFinite(ay) && Number.isFinite(by)) return 1;

        return a._index - b._index;
      })
      .map(({ year, score }) => ({ year, score }))
      .slice(0, 8);
  }

  function latestCutoff(history) {
    return normalizeHistory(history)[0] || null;
  }

  function comparisonClass(score, cutoff) {
    const s = Number(score);
    const c = Number(cutoff);

    if (!Number.isFinite(s) || !Number.isFinite(c)) return "";

    const diff = s - c;

    if (diff < -2) return "red";
    if (diff >= 2) return "green";
    return "yellow";
  }

  function deltaText(score, cutoff) {
    const s = Number(score);
    const c = Number(cutoff);

    if (!Number.isFinite(s) || !Number.isFinite(c)) return "";

    const diff = s - c;

    if (Math.abs(diff) < 0.05) return "igual à última nota de corte";

    return `${Math.abs(diff).toFixed(1).replace(".", ",")} p ${
      diff > 0 ? "acima" : "abaixo"
    } da corte`;
  }

  async function loadDecorData() {
    const { data, error } = await sb
      .from("exams")
      .select("id,score_percent,cutoff_history");

    if (error) {
      console.warn(
        "Não foi possível carregar as notas de corte. Rode fase15_provas_notas_corte.sql:",
        error.message
      );
      examV15.rows = new Map();
      examV15.loaded = false;
      decorateCards();
      return;
    }

    examV15.rows = new Map(
      (data || []).map(row => [row.id, row])
    );
    examV15.loaded = true;

    decorateCards();
  }

  function removeLegacyManagementUi() {
    document.querySelector('[data-exam-mode="edit"]')?.remove();
    document.querySelector(".exam-bulk-toolbar")?.remove();

    document
      .querySelectorAll(".exam-card-select")
      .forEach(el => el.remove());

    try {
      window.setExamPageMode?.("list");
    } catch {}
  }

  function menuHtml(id) {
    return `
      <div class="exam-card-menu-wrap">
        <button
          class="exam-card-menu-trigger"
          type="button"
          data-exam-menu-trigger="${esc(id)}"
          aria-label="Opções da prova"
          aria-expanded="false"
        >⋯</button>

        <div
          class="exam-card-menu"
          data-exam-menu="${esc(id)}"
          hidden
        >
          <button type="button" data-exam-score-edit="${esc(id)}">
            Registrar / editar nota
          </button>

          <button type="button" data-exam-edit-v15="${esc(id)}">
            Editar prova
          </button>

          <button class="danger" type="button" data-exam-delete-v15="${esc(id)}">
            Excluir
          </button>
        </div>
      </div>
    `;
  }

  function cutoffTitle(history) {
    const normalized = normalizeHistory(history);
    if (!normalized.length) return "";

    return normalized
      .map(item => `${item.year || "sem ano"}: ${fmt(item.score)}`)
      .join(" · ");
  }

  function decorateCard(card) {
    const id = card?.dataset?.examCard;
    if (!id) return;

    const row = examV15.rows.get(id);
    const fingerprint = JSON.stringify([
      row?.score_percent ?? null,
      normalizeHistory(row?.cutoff_history)
    ]);

    if (
      card.dataset.v15Fingerprint === fingerprint
      && card.querySelector(".exam-card-menu-wrap")
      && card.querySelector(".exam-cutoff-info")
    ) {
      return;
    }

    const status = card.querySelector(".exam-quick-status");

    if (status && !card.querySelector(".exam-card-side")) {
      const side = document.createElement("div");
      side.className = "exam-card-side";

      status.parentNode.insertBefore(side, status);
      side.insertAdjacentHTML("afterbegin", menuHtml(id));
      side.appendChild(status);
    } else if (!status && !card.querySelector(".exam-card-menu-wrap")) {
      const top = card.querySelector(".exam-card-top");
      if (top) {
        top.insertAdjacentHTML("beforeend", menuHtml(id));
      }
    }

    const grid = card.querySelector(".exam-card-grid");

    if (!grid) return;

    let cutoffInfo = grid.querySelector(".exam-cutoff-info");

    if (!cutoffInfo) {
      cutoffInfo = document.createElement("div");
      cutoffInfo.className = "exam-card-info exam-cutoff-info";
      grid.appendChild(cutoffInfo);
    }

    const history = normalizeHistory(row?.cutoff_history);
    const latest = history[0] || null;

    cutoffInfo.title = cutoffTitle(history);

    cutoffInfo.innerHTML = `
      <span>Última nota de corte</span>
      <strong>${latest ? fmt(latest.score) : "—"}</strong>
      <small>${
        latest
          ? `${esc(latest.year || "edição mais recente")}${
              history.length > 1 ? ` · +${history.length - 1} anterior${history.length - 1 === 1 ? "" : "es"}` : ""
            }`
          : "adicione no menu de edição"
      }</small>
    `;

    const infoCards = Array.from(grid.querySelectorAll(".exam-card-info"));
    const resultInfo = infoCards.find(info =>
      info.querySelector("span")?.textContent?.trim().toLowerCase() === "resultado"
    );

    if (!resultInfo) return;

    resultInfo.classList.remove(
      "exam-score-comparison",
      "red",
      "yellow",
      "green"
    );

    resultInfo.querySelector(".exam-score-delta")?.remove();

    const score = row?.score_percent;

    if (
      Number.isFinite(Number(score))
      && latest
      && Number.isFinite(Number(latest.score))
    ) {
      const cls = comparisonClass(score, latest.score);

      resultInfo.classList.add(
        "exam-score-comparison",
        cls
      );

      const delta = document.createElement("small");
      delta.className = "exam-score-delta";
      delta.textContent = deltaText(score, latest.score);
      resultInfo.appendChild(delta);
    }

    card.dataset.v15Fingerprint = fingerprint;
  }

  function decorateCards() {
    if (examV15.decorating) return;
    examV15.decorating = true;

    try {
      removeLegacyManagementUi();

      document
        .querySelectorAll("[data-exam-card]")
        .forEach(decorateCard);
    } finally {
      examV15.decorating = false;
    }
  }

  function observeCards() {
    const list = $("exam-list");
    if (!list) return;

    examV15.observer?.disconnect();

    examV15.observer = new MutationObserver(() => {
      queueMicrotask(decorateCards);
    });

    examV15.observer.observe(list, {
      childList: true,
      subtree: true
    });

    decorateCards();
  }

  function cutoffEditorHtml() {
    return `
      <div id="exam-cutoff-editor" class="exam-cutoff-editor">
        <div class="exam-cutoff-editor-head">
          <div>
            <strong>Últimas notas de corte</strong>
            <small>
              Cadastre as notas de corte de anos/edições anteriores.
              A mais recente será usada para comparar sua nota:
              vermelho &lt; −2 pontos, amarelo entre −2 e +2,
              e verde a partir de +2 pontos.
            </small>
          </div>

          <button
            id="exam-cutoff-add"
            class="button secondary exam-cutoff-add"
            type="button"
          >
            + nota de corte
          </button>
        </div>

        <div id="exam-cutoff-rows" class="exam-cutoff-rows"></div>

        <div id="exam-cutoff-reference" class="exam-cutoff-reference">
          A nota de corte mais recente será destacada nos cards.
        </div>
      </div>
    `;
  }

  function ensureCutoffEditor() {
    if ($("exam-cutoff-editor")) return;

    const scoreInput = $("exam-score");
    const scoreField = scoreInput?.closest(".exam-field");

    if (!scoreField) return;

    scoreField.insertAdjacentHTML("afterend", cutoffEditorHtml());

    $("exam-cutoff-add")?.addEventListener("click", () => {
      addCutoffRow({
        year: "",
        score: ""
      });
    });
  }

  function addCutoffRow(item = {}) {
    const rows = $("exam-cutoff-rows");
    if (!rows) return;

    const currentCount = rows.querySelectorAll(".exam-cutoff-row").length;
    if (currentCount >= 8) return;

    const row = document.createElement("div");
    row.className = "exam-cutoff-row";

    row.innerHTML = `
      <label>
        <span>Ano / edição</span>
        <input
          type="text"
          maxlength="30"
          data-cutoff-year
          placeholder="Ex.: 2025"
          value="${esc(item.year || "")}"
        >
      </label>

      <label>
        <span>Nota de corte (%)</span>
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          data-cutoff-score
          placeholder="Ex.: 78,5"
          value="${
            item.score === null || item.score === undefined || item.score === ""
              ? ""
              : esc(item.score)
          }"
        >
      </label>

      <button
        class="exam-cutoff-remove"
        type="button"
        data-cutoff-remove
        aria-label="Remover nota de corte"
      >×</button>
    `;

    rows.appendChild(row);
    updateCutoffReference();
  }

  function renderCutoffRows(history) {
    ensureCutoffEditor();

    const rows = $("exam-cutoff-rows");
    if (!rows) return;

    rows.innerHTML = "";

    const normalized = normalizeHistory(history);

    if (normalized.length) {
      normalized.forEach(addCutoffRow);
    } else {
      addCutoffRow({
        year: String(new Date().getFullYear() - 1),
        score: ""
      });
    }

    updateCutoffReference();
  }

  function readCutoffRows() {
    const rows = Array.from(
      document.querySelectorAll(".exam-cutoff-row")
    );

    return normalizeHistory(
      rows.map(row => ({
        year: row.querySelector("[data-cutoff-year]")?.value.trim() || "",
        score: row.querySelector("[data-cutoff-score]")?.value === ""
          ? null
          : Number(row.querySelector("[data-cutoff-score]")?.value)
      }))
    );
  }

  function updateCutoffReference() {
    const el = $("exam-cutoff-reference");
    if (!el) return;

    const latest = latestCutoff(readCutoffRows());

    el.textContent = latest
      ? `Referência atual: ${latest.year || "edição mais recente"} · ${fmt(latest.score)}.`
      : "Preencha ao menos uma nota de corte para ativar a comparação visual.";
  }

  async function hydrateDialogCutoffs() {
    ensureCutoffEditor();

    const id = $("exam-id")?.value || "";

    if (!id) {
      renderCutoffRows([]);
      return;
    }

    const cached = examV15.rows.get(id);

    if (cached) {
      renderCutoffRows(cached.cutoff_history);
      return;
    }

    const { data, error } = await sb
      .from("exams")
      .select("id,cutoff_history")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.warn(error);
      renderCutoffRows([]);
      return;
    }

    renderCutoffRows(data?.cutoff_history || []);
  }

  function watchDialog() {
    const dialog = $("exam-dialog");
    if (!dialog) return;

    ensureCutoffEditor();

    const observer = new MutationObserver(() => {
      if (dialog.hasAttribute("open")) {
        hydrateDialogCutoffs();
      }
    });

    observer.observe(dialog, {
      attributes: true,
      attributeFilter: ["open"]
    });
  }

  function setFormStatus(text, type = "") {
    const el = $("exam-form-status");
    if (!el) return;

    el.textContent = text || "";
    el.className = `exam-status-message ${type}`.trim();
  }

  function field(id) {
    return $(id)?.value ?? "";
  }

  async function refreshPageData() {
    await loadDecorData();

    const jobs = [];

    if (typeof window.loadExamMetrics === "function") {
      jobs.push(window.loadExamMetrics());
    }

    if (typeof window.loadExamSimulationMetrics === "function") {
      jobs.push(window.loadExamSimulationMetrics());
    }

    if (typeof window.loadExams === "function") {
      jobs.push(window.loadExams());
    }

    if (jobs.length) {
      await Promise.all(jobs);
      setTimeout(decorateCards, 50);
    } else {
      window.location.reload();
    }
  }

  async function saveExamV15(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const id = field("exam-id");
    const institution = field("exam-institution").trim();

    if (!institution) {
      setFormStatus("Informe a instituição.", "error");
      return;
    }

    const feeRaw = field("exam-fee");
    const scoreRaw = field("exam-score");

    const payload = {
      user_id: window.docmapUser?.id,
      institution,
      board: field("exam-board").trim() || null,
      status: field("exam-status") || "planned",
      registration_deadline: field("exam-registration-deadline") || null,
      exam_date: field("exam-date") || null,
      fee: feeRaw === "" ? null : Number(feeRaw),
      score_percent: scoreRaw === "" ? null : Number(scoreRaw),
      edital_url: field("exam-edital-url").trim() || null,
      registration_url: field("exam-registration-url").trim() || null,
      notes: field("exam-notes").trim() || null,
      result_notes: field("exam-result-notes").trim() || null,
      cutoff_history: readCutoffRows()
    };

    if (!payload.user_id) {
      setFormStatus("Usuário não autenticado.", "error");
      return;
    }

    if (
      payload.score_percent !== null
      && (
        !Number.isFinite(payload.score_percent)
        || payload.score_percent < 0
        || payload.score_percent > 100
      )
    ) {
      setFormStatus("A nota deve estar entre 0 e 100.", "error");
      return;
    }

    const button = $("exam-save");
    if (button) button.disabled = true;

    setFormStatus("Salvando...");

    try {
      let result;

      if (id) {
        result = await sb
          .from("exams")
          .update(payload)
          .eq("id", id);
      } else {
        result = await sb
          .from("exams")
          .insert(payload);
      }

      if (result.error) {
        if (/cutoff_history/i.test(result.error.message || "")) {
          throw new Error(
            "O campo de notas de corte ainda não existe. Rode fase15_provas_notas_corte.sql no Supabase."
          );
        }

        throw result.error;
      }

      setFormStatus("Prova salva.", "success");

      $("exam-dialog")?.close();

      try {
        window.setExamPageMode?.("list");
      } catch {}

      await refreshPageData();
    } catch (error) {
      console.error(error);
      setFormStatus(
        error.message || "Não foi possível salvar.",
        "error"
      );
    } finally {
      if (button) button.disabled = false;
    }
  }

  function openExamEditor(id, focusScore = false) {
    if (typeof window.openExamDialog !== "function") {
      window.LuriaDialog.alert("Não foi possível abrir a edição desta prova.");
      return;
    }

    try {
      window.setExamPageMode?.("list");
    } catch {}

    window.openExamDialog(id);

    if (focusScore) {
      setTimeout(() => {
        const score = $("exam-score");
        score?.focus();
        score?.select();
      }, 80);
    }
  }

  async function deleteExamV15(id) {
    const { data } = await sb
      .from("exams")
      .select("institution")
      .eq("id", id)
      .maybeSingle();

    const label = data?.institution || "esta prova";

    const confirmed = await window.LuriaDialog.confirm(
      `Excluir "${label}"?\n\nOs simulados vinculados não serão apagados; apenas deixarão de ficar vinculados à prova.`
    );

    if (!confirmed) return;

    const { error } = await sb
      .from("exams")
      .delete()
      .eq("id", id);

    if (error) {
      window.LuriaDialog.alert(`Não foi possível excluir: ${error.message}`);
      return;
    }

    await refreshPageData();
  }

  function closeMenus(except = null) {
    document
      .querySelectorAll("[data-exam-menu]")
      .forEach(menu => {
        if (menu !== except) {
          menu.hidden = true;
          const id = menu.dataset.examMenu;
          document
            .querySelector(`[data-exam-menu-trigger="${CSS.escape(id)}"]`)
            ?.setAttribute("aria-expanded", "false");
        }
      });
  }

  function wireDelegation() {
    document.addEventListener("click", event => {
      const trigger = event.target.closest("[data-exam-menu-trigger]");

      if (trigger) {
        event.preventDefault();
        event.stopPropagation();

        const id = trigger.dataset.examMenuTrigger;
        const menu = document.querySelector(
          `[data-exam-menu="${CSS.escape(id)}"]`
        );

        if (!menu) return;

        const willOpen = menu.hidden;
        closeMenus(menu);
        menu.hidden = !willOpen;
        trigger.setAttribute(
          "aria-expanded",
          willOpen ? "true" : "false"
        );

        return;
      }

      const scoreEdit = event.target.closest("[data-exam-score-edit]");
      if (scoreEdit) {
        event.preventDefault();
        closeMenus();
        openExamEditor(scoreEdit.dataset.examScoreEdit, true);
        return;
      }

      const edit = event.target.closest("[data-exam-edit-v15]");
      if (edit) {
        event.preventDefault();
        closeMenus();
        openExamEditor(edit.dataset.examEditV15, false);
        return;
      }

      const del = event.target.closest("[data-exam-delete-v15]");
      if (del) {
        event.preventDefault();
        closeMenus();
        deleteExamV15(del.dataset.examDeleteV15);
        return;
      }

      const cutoffRemove = event.target.closest("[data-cutoff-remove]");
      if (cutoffRemove) {
        event.preventDefault();

        const rows = document.querySelectorAll(".exam-cutoff-row");

        if (rows.length <= 1) {
          const row = cutoffRemove.closest(".exam-cutoff-row");
          row?.querySelector("[data-cutoff-year]")?.setAttribute("value", "");
          const score = row?.querySelector("[data-cutoff-score]");
          const year = row?.querySelector("[data-cutoff-year]");
          if (score) score.value = "";
          if (year) year.value = "";
        } else {
          cutoffRemove.closest(".exam-cutoff-row")?.remove();
        }

        updateCutoffReference();
        return;
      }

      if (!event.target.closest(".exam-card-menu-wrap")) {
        closeMenus();
      }
    });

    document.addEventListener("input", event => {
      if (
        event.target.matches("[data-cutoff-year]")
        || event.target.matches("[data-cutoff-score]")
      ) {
        updateCutoffReference();
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeMenus();
      }
    });
  }

  function wireFormCapture() {
    const form = $("exam-form");
    if (!form) return;

    form.addEventListener(
      "submit",
      saveExamV15,
      true
    );
  }

  async function init() {
    removeLegacyManagementUi();
    ensureCutoffEditor();
    wireFormCapture();
    wireDelegation();
    watchDialog();
    observeCards();

    await loadDecorData();

    setTimeout(decorateCards, 100);
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
