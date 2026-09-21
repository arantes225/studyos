(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  const state = {
    rows: new Map(),
    cutoffColumnAvailable: true,
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

  function fmtScore(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";

    return `${n
      .toFixed(1)
      .replace(".", ",")}%`;
  }

  function normalizeHistory(value) {
    if (!Array.isArray(value)) return [];

    return value
      .map((item, index) => {
        const score = Number(item?.score);
        const year = String(item?.year ?? "").trim();

        return {
          year,
          score:
            Number.isFinite(score)
              ? Math.max(0, Math.min(100, score))
              : null,
          index
        };
      })
      .filter(item => item.score !== null)
      .sort((a, b) => {
        const ay = Number.parseInt(a.year, 10);
        const by = Number.parseInt(b.year, 10);

        if (
          Number.isFinite(ay)
          && Number.isFinite(by)
          && ay !== by
        ) {
          return by - ay;
        }

        if (Number.isFinite(ay) && !Number.isFinite(by)) {
          return -1;
        }

        if (!Number.isFinite(ay) && Number.isFinite(by)) {
          return 1;
        }

        return a.index - b.index;
      })
      .slice(0, 8)
      .map(({ year, score }) => ({ year, score }));
  }

  function localKey(examId) {
    const userId = window.docmapUser?.id || "local";

    return `resibulando:exam-cutoffs:${userId}:${examId}`;
  }

  function readLocalHistory(examId) {
    try {
      const raw = localStorage.getItem(localKey(examId));
      return normalizeHistory(raw ? JSON.parse(raw) : []);
    } catch {
      return [];
    }
  }

  function writeLocalHistory(examId, history) {
    try {
      localStorage.setItem(
        localKey(examId),
        JSON.stringify(normalizeHistory(history))
      );
    } catch {}
  }

  function removeLocalHistory(examId) {
    try {
      localStorage.removeItem(localKey(examId));
    } catch {}
  }

  function latestCutoff(history) {
    return normalizeHistory(history)[0] || null;
  }

  function comparisonClass(score, cutoff) {
    const result = Number(score);
    const reference = Number(cutoff);

    if (
      !Number.isFinite(result)
      || !Number.isFinite(reference)
    ) {
      return "";
    }

    const diff = result - reference;

    // Regras:
    // vermelho: 2 ou mais pontos abaixo
    // amarelo: entre -1,99 e +1,99
    // verde: 2 ou mais pontos acima
    if (diff <= -2) return "red";
    if (diff >= 2) return "green";
    return "yellow";
  }

  function differenceLabel(score, cutoff) {
    const result = Number(score);
    const reference = Number(cutoff);

    if (
      !Number.isFinite(result)
      || !Number.isFinite(reference)
    ) {
      return "";
    }

    const diff = result - reference;

    if (Math.abs(diff) < 0.05) {
      return "igual à última nota de corte";
    }

    return `${Math.abs(diff)
      .toFixed(1)
      .replace(".", ",")} p ${diff > 0 ? "acima" : "abaixo"} da corte`;
  }

  function cutoffCardText(history) {
    const rows = normalizeHistory(history);

    if (!rows.length) {
      return {
        main: "—",
        helper: "nenhuma nota cadastrada"
      };
    }

    const latest = rows[0];

    const older = rows
      .slice(1, 4)
      .map(item => `${item.year || "edição"} · ${fmtScore(item.score)}`)
      .join(" · ");

    return {
      main:
        `${latest.year ? `${latest.year} · ` : ""}${fmtScore(latest.score)}`,

      helper:
        older
        || (
          rows.length > 1
            ? `+${rows.length - 1} anterior${rows.length - 1 === 1 ? "" : "es"}`
            : "referência mais recente"
        )
    };
  }

  async function loadExamData() {
    let response = await sb
      .from("exams")
      .select("id,score_percent,cutoff_history");

    if (response.error) {
      state.cutoffColumnAvailable = false;

      response = await sb
        .from("exams")
        .select("id,score_percent");
    } else {
      state.cutoffColumnAvailable = true;
    }

    if (response.error) {
      console.warn(
        "Não foi possível carregar dados complementares das provas:",
        response.error.message
      );
      return;
    }

    const rows = response.data || [];

    state.rows = new Map(
      rows.map(row => {
        const local = readLocalHistory(row.id);
        const database = normalizeHistory(row.cutoff_history);

        const merged =
          database.length
            ? database
            : local;

        return [
          row.id,
          {
            ...row,
            cutoff_history: merged
          }
        ];
      })
    );

    // Se a migration já existe e há dados antigos salvos localmente,
    // migra silenciosamente para o Supabase.
    if (state.cutoffColumnAvailable) {
      for (const row of rows) {
        const database = normalizeHistory(row.cutoff_history);
        const local = readLocalHistory(row.id);

        if (!database.length && local.length) {
          const { error } = await sb
            .from("exams")
            .update({ cutoff_history: local })
            .eq("id", row.id);

          if (!error) {
            removeLocalHistory(row.id);

            const stateRow = state.rows.get(row.id);
            if (stateRow) {
              stateRow.cutoff_history = local;
            }
          }
        }
      }
    }

    decorateCards();
  }

  function ensureQuickDialog() {
    if ($("exam-score-quick-dialog")) return;

    document.body.insertAdjacentHTML(
      "beforeend",
      `
        <dialog
          id="exam-score-quick-dialog"
          class="exam-score-quick-dialog"
        >
          <form
            id="exam-score-quick-form"
            method="dialog"
          >
            <div class="exam-dialog-head">
              <div>
                <span class="badge accent">Resultado da prova</span>
                <h2>Resultado da prova</h2>
                <p
                  id="exam-score-quick-subtitle"
                  class="exam-score-dialog-subtitle"
                ></p>
              </div>

              <button
                id="exam-score-quick-close"
                class="exam-dialog-close"
                type="button"
                aria-label="Fechar"
              >×</button>
            </div>

            <input
              id="exam-score-quick-id"
              type="hidden"
            >

            <div class="exam-score-quick-grid">
              <label class="exam-field">
                <span>Sua nota (%)</span>

                <input
                  id="exam-score-quick-value"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="Ex.: 82,5"
                >
              </label>

              <div class="exam-cutoff-field">
                <div class="exam-cutoff-field-head">
                  <div>
                    <span>Última nota de corte</span>
                    <small>
                      Informe ano/edição e nota. A edição mais recente
                      é usada como referência do semáforo.
                    </small>
                  </div>

                  <button
                    id="exam-score-quick-cutoff-add"
                    class="button secondary exam-cutoff-add"
                    type="button"
                  >
                    + nota de corte
                  </button>
                </div>

                <div
                  id="exam-score-quick-cutoffs"
                  class="exam-cutoff-list"
                ></div>

                <div
                  id="exam-cutoff-storage-note"
                  class="exam-cutoff-storage-note"
                ></div>
              </div>
            </div>

            <div class="exam-score-legend">
              <span class="red">
                2 ou mais pontos abaixo
              </span>

              <span class="yellow">
                Entre −1,99 e +1,99
              </span>

              <span class="green">
                2 ou mais pontos acima
              </span>
            </div>

            <div class="exam-dialog-actions">
              <button
                id="exam-score-quick-cancel"
                class="button secondary"
                type="button"
              >
                Cancelar
              </button>

              <button
                id="exam-score-quick-save"
                class="button primary"
                type="submit"
              >
                Salvar nota
              </button>
            </div>

            <div
              id="exam-score-quick-status"
              class="exam-status-message"
              aria-live="polite"
            ></div>
          </form>
        </dialog>
      `
    );

    $("exam-score-quick-close")
      ?.addEventListener(
        "click",
        closeQuickDialog
      );

    $("exam-score-quick-cancel")
      ?.addEventListener(
        "click",
        closeQuickDialog
      );

    $("exam-score-quick-cutoff-add")
      ?.addEventListener(
        "click",
        () => addCutoffRow(
          "exam-score-quick-cutoffs"
        )
      );

    $("exam-score-quick-form")
      ?.addEventListener(
        "submit",
        async event => {
          event.preventDefault();
          await saveQuickScore();
        }
      );
  }

  function addCutoffRow(containerId, item = {}) {
    const container = $(containerId);
    if (!container) return;

    if (
      container.querySelectorAll(".exam-cutoff-row").length >= 8
    ) {
      return;
    }

    const row = document.createElement("div");
    row.className = "exam-cutoff-row";

    row.innerHTML = `
      <label>
        <span>Ano / edição</span>
        <input
          type="text"
          maxlength="30"
          data-v16-cutoff-year
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
          data-v16-cutoff-score
          placeholder="Ex.: 78,5"
          value="${
            item.score === null
            || item.score === undefined
            || item.score === ""
              ? ""
              : esc(item.score)
          }"
        >
      </label>

      <button
        class="exam-cutoff-remove"
        type="button"
        data-v16-cutoff-remove
        aria-label="Remover nota de corte"
      >×</button>
    `;

    container.appendChild(row);
  }

  function renderCutoffRows(containerId, history) {
    const container = $(containerId);
    if (!container) return;

    container.innerHTML = "";

    const rows = normalizeHistory(history);

    if (!rows.length) {
      addCutoffRow(
        containerId,
        {
          year: String(new Date().getFullYear() - 1),
          score: ""
        }
      );

      return;
    }

    rows.forEach(
      item => addCutoffRow(
        containerId,
        item
      )
    );
  }

  function readCutoffRows(containerId) {
    const container = $(containerId);
    if (!container) return [];

    return normalizeHistory(
      Array.from(
        container.querySelectorAll(".exam-cutoff-row")
      )
        .map(row => {
          const year =
            row
              .querySelector("[data-v16-cutoff-year]")
              ?.value
              .trim()
            || "";

          const scoreRaw =
            row
              .querySelector("[data-v16-cutoff-score]")
              ?.value
            ?? "";

          return {
            year,
            score:
              scoreRaw === ""
                ? null
                : Number(scoreRaw)
          };
        })
    );
  }

  function setQuickStatus(text, type = "") {
    const el = $("exam-score-quick-status");
    if (!el) return;

    el.textContent = text || "";
    el.className =
      `exam-status-message ${type}`.trim();
  }

  function openQuickDialog(examId, institution = "") {
    ensureQuickDialog();

    const row =
      state.rows.get(examId)
      || {
        id: examId,
        score_percent: null,
        cutoff_history: readLocalHistory(examId)
      };

    $("exam-score-quick-id").value = examId;
    $("exam-score-quick-value").value =
      row.score_percent ?? "";

    $("exam-score-quick-subtitle").textContent =
      institution || "Prova";

    renderCutoffRows(
      "exam-score-quick-cutoffs",
      row.cutoff_history
    );

    const storageNote = $("exam-cutoff-storage-note");

    if (storageNote) {
      storageNote.textContent =
        state.cutoffColumnAvailable
          ? "As notas de corte serão salvas na sua conta."
          : "A migration do banco ainda não foi aplicada; por enquanto as notas de corte ficam salvas neste navegador.";

      storageNote.classList.toggle(
        "local",
        !state.cutoffColumnAvailable
      );
    }

    setQuickStatus("");

    $("exam-score-quick-dialog")
      ?.showModal();

    setTimeout(
      () => {
        const input = $("exam-score-quick-value");
        input?.focus();
        input?.select();
      },
      40
    );
  }

  function closeQuickDialog() {
    $("exam-score-quick-dialog")
      ?.close();
  }

  async function saveQuickScore() {
    const examId =
      $("exam-score-quick-id")
        ?.value;

    if (!examId) return;

    const raw =
      $("exam-score-quick-value")
        ?.value
      ?? "";

    const score =
      raw === ""
        ? null
        : Number(raw);

    if (
      score !== null
      && (
        !Number.isFinite(score)
        || score < 0
        || score > 100
      )
    ) {
      setQuickStatus(
        "A nota deve estar entre 0 e 100.",
        "error"
      );
      return;
    }

    const history =
      readCutoffRows(
        "exam-score-quick-cutoffs"
      );

    const saveButton =
      $("exam-score-quick-save");

    if (saveButton) {
      saveButton.disabled = true;
    }

    setQuickStatus("Salvando...");

    let payload = {
      score_percent: score
    };

    if (state.cutoffColumnAvailable) {
      payload.cutoff_history = history;
    }

    let response = await sb
      .from("exams")
      .update(payload)
      .eq("id", examId);

    // Se o site foi atualizado antes da migration, a nota continua
    // funcionando e o histórico cai para localStorage.
    if (
      response.error
      && state.cutoffColumnAvailable
      && /cutoff_history|schema cache|column/i.test(
        response.error.message || ""
      )
    ) {
      state.cutoffColumnAvailable = false;

      response = await sb
        .from("exams")
        .update({
          score_percent: score
        })
        .eq("id", examId);
    }

    if (saveButton) {
      saveButton.disabled = false;
    }

    if (response.error) {
      console.error(response.error);

      setQuickStatus(
        `Não foi possível salvar: ${response.error.message}`,
        "error"
      );
      return;
    }

    if (state.cutoffColumnAvailable) {
      removeLocalHistory(examId);
    } else {
      writeLocalHistory(examId, history);
    }

    const row =
      state.rows.get(examId)
      || {};

    state.rows.set(
      examId,
      {
        ...row,
        id: examId,
        score_percent: score,
        cutoff_history: history
      }
    );

    closeQuickDialog();

    // Faz o JS original redesenhar a lista para refletir a nova nota.
    if (typeof window.loadExams === "function") {
      try {
        await window.loadExams();
      } catch {}
    }

    if (typeof window.loadExamMetrics === "function") {
      try {
        await window.loadExamMetrics();
      } catch {}
    }

    await loadExamData();
    decorateCards();
  }

  function menuHtml(examId) {
    return `
      <div class="exam-card-menu-wrap">
        <button
          class="exam-card-menu-trigger"
          type="button"
          data-v16-menu-trigger="${esc(examId)}"
          aria-label="Opções da prova"
          aria-expanded="false"
        >⋯</button>

        <div
          class="exam-card-menu"
          data-v16-menu="${esc(examId)}"
          hidden
        >
          <button
            type="button"
            data-v16-edit="${esc(examId)}"
          >
            Editar prova
          </button>

          <button
            class="danger"
            type="button"
            data-v16-delete="${esc(examId)}"
          >
            Excluir
          </button>
        </div>
      </div>
    `;
  }

  function closeMenus(except = null) {
    document
      .querySelectorAll("[data-v16-menu]")
      .forEach(menu => {
        if (menu === except) return;

        menu.hidden = true;

        const id = menu.dataset.v16Menu;

        document
          .querySelector(
            `[data-v16-menu-trigger="${CSS.escape(id)}"]`
          )
          ?.setAttribute(
            "aria-expanded",
            "false"
          );
      });
  }

  function decorateCard(card) {
    const examId =
      card.dataset.examCard;

    if (!examId) return;

    const row =
      state.rows.get(examId)
      || {
        id: examId,
        score_percent: null,
        cutoff_history: readLocalHistory(examId)
      };

    const history =
      normalizeHistory(
        row.cutoff_history
      );

    const latest =
      latestCutoff(
        history
      );

    const hasScore =
      row.score_percent !== null
      && row.score_percent !== undefined
      && row.score_percent !== ""
      && Number.isFinite(
        Number(
          row.score_percent
        )
      );

    const color =
      latest
      && hasScore
        ? comparisonClass(
            row.score_percent,
            latest.score
          )
        : "";

    card.classList.remove(
      "exam-score-state-red",
      "exam-score-state-yellow",
      "exam-score-state-green"
    );

    if (color) {
      card.classList.add(
        `exam-score-state-${color}`
      );
    }

    const fingerprint =
      JSON.stringify([
        row.score_percent ?? null,
        history
      ]);

    if (
      card.dataset.v16Fingerprint === fingerprint
      && card.querySelector(".exam-card-menu-wrap")
      && card.querySelector(".exam-cutoff-card")
    ) {
      return;
    }

    const top =
      card.querySelector(
        ".exam-card-top"
      );

    const status =
      card.querySelector(
        ".exam-quick-status"
      );

    let side =
      card.querySelector(
        ".exam-card-side"
      );

    if (!side && top) {
      side =
        document.createElement(
          "div"
        );

      side.className =
        "exam-card-side";

      if (status) {
        status.parentNode
          .insertBefore(
            side,
            status
          );

        side.appendChild(
          status
        );
      } else {
        top.appendChild(
          side
        );
      }
    }

    if (
      side
      && !side.querySelector(
        ".exam-card-menu-wrap"
      )
    ) {
      side.insertAdjacentHTML(
        "afterbegin",
        menuHtml(examId)
      );
    }

    const grid =
      card.querySelector(
        ".exam-card-grid"
      );

    if (!grid) return;

    let cutoffCard =
      grid.querySelector(
        ".exam-cutoff-card"
      );

    if (!cutoffCard) {
      cutoffCard =
        document.createElement(
          "div"
        );

      cutoffCard.className =
        "exam-card-info exam-cutoff-card";

      grid.appendChild(
        cutoffCard
      );
    }

    const cutoffText =
      cutoffCardText(
        history
      );

    cutoffCard.innerHTML = `
      <span>Última nota de corte</span>
      <div class="exam-inline-score">
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          inputmode="decimal"
          data-v16-cutoff-inline="${esc(examId)}"
          value="${
            latest
              ? esc(latest.score)
              : ""
          }"
          placeholder="—"
          aria-label="Última nota de corte"
        >
        <span>%</span>
      </div>
      <small>edite diretamente</small>
    `;

    cutoffCard.title =
      history
        .map(
          item =>
            `${item.year || "edição"}: ${fmtScore(item.score)}`
        )
        .join(" · ");

    const resultCard =
      Array.from(
        grid.querySelectorAll(
          ".exam-card-info"
        )
      )
        .find(
          item =>
            item.querySelector("span")
              ?.textContent
              ?.trim()
              ?.toLowerCase()
            === "resultado"
        );

    if (resultCard) {
      resultCard.classList.remove(
        "exam-score-comparison",
        "red",
        "yellow",
        "green"
      );

      resultCard.innerHTML = `
        <span>Sua nota</span>
        <div class="exam-inline-score">
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            inputmode="decimal"
            data-v16-score-inline="${esc(examId)}"
            value="${
              hasScore
                ? esc(row.score_percent)
                : ""
            }"
            placeholder="—"
            aria-label="Sua nota"
          >
          <span>%</span>
        </div>
      `;

      const helper =
        document.createElement(
          "small"
        );

      helper.className =
        "exam-score-delta";

      if (
        latest
        && hasScore
      ) {
        resultCard.classList.add(
          "exam-score-comparison",
          color
        );

        helper.textContent =
          differenceLabel(
            row.score_percent,
            latest.score
          );
      } else if (latest) {
        helper.textContent =
          "adicione sua nota para comparar";
      } else {
        helper.textContent =
          "sem nota de corte de referência";
      }

      resultCard.appendChild(
        helper
      );
    }

    card.dataset.v16Fingerprint =
      fingerprint;
  }

  function decorateCards() {
    if (state.decorating) return;
    state.decorating = true;

    try {
      // Segurança extra caso um HTML antigo ainda esteja em cache.
      document
        .querySelector(
          '[data-exam-mode="edit"]'
        )
        ?.remove();

      document
        .querySelectorAll(
          "[data-exam-card]"
        )
        .forEach(
          decorateCard
        );
    } finally {
      state.decorating = false;
    }
  }

  function observeList() {
    const list = $("exam-list");
    if (!list) return;

    state.observer
      ?.disconnect();

    state.observer =
      new MutationObserver(
        () => {
          queueMicrotask(
            decorateCards
          );
        }
      );

    state.observer.observe(
      list,
      {
        childList: true,
        subtree: true
      }
    );

    decorateCards();
  }

  function institutionFromCard(card) {
    return card
      ?.querySelector(
        ".exam-card-title h3"
      )
      ?.textContent
      ?.trim()
      || "Prova";
  }

  async function saveInlineScore(
    input,
    kind
  ) {
    const examId =
      kind === "score"
        ? input.dataset.v16ScoreInline
        : input.dataset.v16CutoffInline;

    if (!examId) return;

    const raw =
      input.value.trim();

    const value =
      raw === ""
        ? null
        : Number(raw);

    if (
      value !== null
      && (
        !Number.isFinite(value)
        || value < 0
        || value > 100
      )
    ) {
      input.classList.add(
        "invalid"
      );
      return;
    }

    input.classList.remove(
      "invalid"
    );

    input.disabled =
      true;

    const row =
      state.rows.get(examId)
      || {
        id: examId,
        score_percent: null,
        cutoff_history: []
      };

    const payload =
      kind === "score"
        ? {
            score_percent:
              value
          }
        : {
            cutoff_history:
              value === null
                ? []
                : [
                    {
                      year: "",
                      score: value
                    }
                  ]
          };

    const {
      error
    } =
      await sb
        .from("exams")
        .update(payload)
        .eq("id", examId);

    input.disabled =
      false;

    if (error) {
      console.error(
        error
      );

      input.classList.add(
        "invalid"
      );

      return;
    }

    state.rows.set(
      examId,
      {
        ...row,
        score_percent:
          kind === "score"
            ? value
            : row.score_percent,
        cutoff_history:
          kind === "cutoff"
            ? payload.cutoff_history
            : normalizeHistory(
                row.cutoff_history
              )
      }
    );

    if (
      kind === "score"
      && typeof window.loadExamMetrics
        === "function"
    ) {
      try {
        await window.loadExamMetrics();
      } catch {}
    }

    if (
      typeof window.loadExams
      === "function"
    ) {
      try {
        await window.loadExams();
      } catch {}
    }

    await loadExamData();
    decorateCards();
  }


  function wireEvents() {
    document.addEventListener(
      "click",
      event => {
        const trigger =
          event.target
            .closest(
              "[data-v16-menu-trigger]"
            );

        if (trigger) {
          event.preventDefault();
          event.stopPropagation();

          const examId =
            trigger.dataset
              .v16MenuTrigger;

          const menu =
            document.querySelector(
              `[data-v16-menu="${CSS.escape(examId)}"]`
            );

          if (!menu) return;

          const opening =
            menu.hidden;

          closeMenus(
            menu
          );

          menu.hidden =
            !opening;

          trigger.setAttribute(
            "aria-expanded",
            opening
              ? "true"
              : "false"
          );

          return;
        }

        const editAction =
          event.target
            .closest(
              "[data-v16-edit]"
            );

        if (editAction) {
          event.preventDefault();
          closeMenus();

          const card =
            editAction.closest(
              "[data-exam-card]"
            );

          const original =
            card?.querySelector(
              "[data-edit-exam]"
            );

          if (original) {
            original.click();
          } else if (
            typeof window.openExamDialog
            === "function"
          ) {
            window.openExamDialog(
              editAction.dataset
                .v16Edit
            );
          }

          return;
        }

        const deleteAction =
          event.target
            .closest(
              "[data-v16-delete]"
            );

        if (deleteAction) {
          event.preventDefault();
          closeMenus();

          const card =
            deleteAction.closest(
              "[data-exam-card]"
            );

          const original =
            card?.querySelector(
              "[data-delete-exam]"
            );

          if (original) {
            original.click();
          } else if (
            typeof window.deleteExam
            === "function"
          ) {
            window.deleteExam(
              deleteAction.dataset
                .v16Delete
            );
          }

          return;
        }

        const removeCutoff =
          event.target
            .closest(
              "[data-v16-cutoff-remove]"
            );

        if (removeCutoff) {
          event.preventDefault();

          const row =
            removeCutoff.closest(
              ".exam-cutoff-row"
            );

          const container =
            row?.parentElement;

          row?.remove();

          if (
            container
            && !container.querySelector(
              ".exam-cutoff-row"
            )
          ) {
            addCutoffRow(
              container.id
            );
          }

          return;
        }

        if (
          !event.target
            .closest(
              ".exam-card-menu-wrap"
            )
        ) {
          closeMenus();
        }
      }
    );

    document.addEventListener(
      "change",
      async event => {
        const scoreInput =
          event.target.closest(
            "[data-v16-score-inline]"
          );

        if (scoreInput) {
          await saveInlineScore(
            scoreInput,
            "score"
          );

          return;
        }

        const cutoffInput =
          event.target.closest(
            "[data-v16-cutoff-inline]"
          );

        if (cutoffInput) {
          await saveInlineScore(
            cutoffInput,
            "cutoff"
          );
        }
      }
    );


    document.addEventListener(
      "keydown",
      event => {
        if (event.key === "Escape") {
          closeMenus();
        }
      }
    );
  }

  /*
    API pública mínima para o módulo principal de Editais.
    Permite recarregar score/cutoff_history depois de criar ou editar
    uma prova sem depender de reload da página.
  */
  window.refreshExamV16 =
    async function refreshExamV16() {
      await loadExamData();
      decorateCards();
    };


  async function init() {
    wireEvents();
    observeList();

    await loadExamData();

    // O JS original carrega as provas de forma assíncrona.
    // Essas repetições cobrem o primeiro render sem depender da ordem da rede.
    setTimeout(decorateCards, 200);
    setTimeout(decorateCards, 800);
  }

  if (window.docmapUser) {
    init();
  } else {
    window.addEventListener(
      "docmap:ready",
      init,
      {
        once: true
      }
    );
  }
})();
