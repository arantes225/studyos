(() => {
  "use strict";

  const sb = window.supabaseClient;

  const state = {
    loaded: false,
    loading: false,
    items: [],
    pendingCount: 0
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

  function dateValue(value) {
    return value ? String(value).slice(0, 10) : "";
  }

  function moneyValue(value) {
    if (value === null || value === undefined || value === "") return "";
    const number = Number(value);
    return Number.isFinite(number) ? String(number) : "";
  }

  function setBadge() {
    const badge = $("admin-editais-pending-badge");
    const notice = $("admin-editais-notice");
    const noticeText = $("admin-editais-notice-text");

    if (badge) {
      badge.hidden = state.pendingCount <= 0;
      badge.textContent = state.pendingCount > 99 ? "99+" : String(state.pendingCount);
    }

    if (notice) {
      notice.hidden = state.pendingCount <= 0;
    }

    if (noticeText) {
      noticeText.textContent =
        state.pendingCount === 1
          ? "1 novo edital aguarda sua revisão."
          : `${state.pendingCount} novos editais aguardam sua revisão.`;
    }
  }

  function filteredItems() {
    const search = ($("admin-editais-search")?.value || "").trim().toLowerCase();
    const status = $("admin-editais-filter")?.value || "";

    return state.items.filter((item) => {
      if (status && item.review_status !== status) return false;
      if (!search) return true;

      return [
        item.institution,
        item.uf,
        item.board,
        item.status_text
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }

  function render() {
    setBadge();

    const list = $("admin-editais-list");
    const empty = $("admin-editais-empty");
    const count = $("admin-editais-count");

    if (!list || !empty) return;

    const items = filteredItems();

    if (count) {
      count.textContent = `${items.length} edital${items.length === 1 ? "" : "is"}`;
    }

    if (!items.length) {
      list.innerHTML = "";
      empty.hidden = false;
      return;
    }

    empty.hidden = true;

    list.innerHTML = items.map((item) => {
      const pending = item.review_status === "pending";
      const awaitingPublish = !pending && item.published !== true;
      const published = item.published === true;

      return `
        <article class="admin-edital-card ${pending ? "pending" : ""}" data-admin-edital-card="${esc(item.id)}">
          <div class="admin-edital-card-head">
            <div>
              <div class="admin-edital-card-meta">
                <span class="admin-edital-status ${pending || awaitingPublish ? "pending" : "reviewed"}">
                  ${pending ? "Novo · revisar" : awaitingPublish ? "Revisado · aguardando publicação" : "Publicado"}
                </span>
                ${item.uf ? `<span>${esc(item.uf)}</span>` : ""}
              </div>
              <h3>${esc(item.institution || "Edital")}</h3>
              <small>
                Detectado em ${item.first_seen_at ? new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short"
                }).format(new Date(item.first_seen_at)) : "—"}
              </small>
            </div>

            <div class="admin-edital-source-actions">
              ${item.source_edital_url ? `
                <a
                  class="button secondary"
                  href="${esc(item.source_edital_url)}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver PDF encontrado
                </a>
                <button
                  class="button secondary"
                  type="button"
                  data-use-source-edital="${esc(item.id)}"
                >
                  Usar esse link
                </button>
              ` : ""}
            </div>
          </div>

          <form class="admin-edital-form" data-admin-edital-form="${esc(item.id)}">
            <div class="admin-edital-grid">
              <label class="wide">
                <span>Instituição</span>
                <input name="institution" type="text" value="${esc(item.institution || "")}" required>
              </label>

              <label>
                <span>UF</span>
                <input name="uf" type="text" maxlength="8" value="${esc(item.uf || "")}">
              </label>

              <label>
                <span>Banca</span>
                <input name="board" type="text" value="${esc(item.board || "")}">
              </label>

              <label>
                <span>Início inscrição</span>
                <input name="registration_start" type="date" value="${esc(dateValue(item.registration_start))}">
              </label>

              <label>
                <span>Fim inscrição</span>
                <input name="registration_end" type="date" value="${esc(dateValue(item.registration_end))}">
              </label>

              <label>
                <span>Data da prova</span>
                <input name="exam_date" type="date" value="${esc(dateValue(item.exam_date))}">
              </label>

              <label>
                <span>Gabarito</span>
                <input name="answer_key_date" type="date" value="${esc(dateValue(item.answer_key_date))}">
              </label>

              <label>
                <span>Taxa</span>
                <input name="fee" type="number" min="0" step="0.01" value="${esc(moneyValue(item.fee))}">
              </label>

              <label class="wide">
                <span>Link oficial do edital</span>
                <input
                  name="edital_url"
                  type="url"
                  value="${esc(item.edital_url || "")}"
                  placeholder="Cole aqui o link que deve aparecer para os usuários"
                >
              </label>

              <label class="wide">
                <span>Link oficial de inscrição</span>
                <input
                  name="registration_url"
                  type="url"
                  value="${esc(item.registration_url || "")}"
                  placeholder="https://..."
                >
              </label>

              <label class="wide">
                <span>Observação administrativa</span>
                <textarea name="admin_notes" rows="2" placeholder="Notas internas; não aparecem para os usuários.">${esc(item.admin_notes || "")}</textarea>
              </label>
            </div>

            <div class="admin-edital-footer">
              <small>
                O PDF capturado automaticamente serve apenas como referência no Admin.
                Só o link salvo por você em “Link oficial do edital” aparece no LURIA.
              </small>

              <div class="admin-edital-publish-actions">
                <button class="button secondary" type="submit">
                  ${pending ? "Salvar e revisar" : "Salvar alterações"}
                </button>

                ${!published ? `
                  <button
                    class="button primary"
                    type="button"
                    data-publish-edital="${esc(item.id)}"
                    ${pending || !item.edital_url ? "disabled" : ""}
                  >
                    Confirmar publicação
                  </button>
                ` : `
                  <span class="admin-edital-published-note">Publicado</span>
                `}
              </div>
            </div>

            <div class="admin-edital-form-status" aria-live="polite"></div>
          </form>
        </article>
      `;
    }).join("");
  }

  async function load(force = false) {
    if (state.loading) return;
    if (state.loaded && !force) {
      render();
      return;
    }

    state.loading = true;

    const status = $("admin-editais-status");
    if (status) status.textContent = "Carregando editais...";

    try {
      const { data, error } = await sb.rpc("admin_exam_catalog_snapshot");

      if (error) throw error;

      state.items = Array.isArray(data?.items) ? data.items : [];
      state.pendingCount = Number(data?.pending_count || 0);
      state.loaded = true;

      if (status) {
        status.textContent =
          state.pendingCount > 0
            ? "Há editais aguardando revisão ou confirmação de publicação."
            : "Nenhuma pendência de edital.";
      }

      render();
    } catch (error) {
      console.error("Falha ao carregar editais do Admin:", error);
      if (status) status.textContent = "Não foi possível carregar os editais.";
    } finally {
      state.loading = false;
    }
  }

  async function saveForm(form) {
    const id = form.dataset.adminEditalForm;
    const button = form.querySelector('button[type="submit"]');
    const status = form.querySelector(".admin-edital-form-status");

    if (!id) return;

    const value = (name) => form.elements.namedItem(name)?.value?.trim() || "";
    const nullableDate = (name) => value(name) || null;
    const feeRaw = value("fee");

    if (button) {
      button.disabled = true;
      button.textContent = "Salvando...";
    }

    if (status) {
      status.textContent = "Salvando...";
      status.className = "admin-edital-form-status";
    }

    try {
      const { data, error } = await sb.rpc("admin_update_exam_catalog", {
        p_id: id,
        p_institution: value("institution"),
        p_uf: value("uf") || null,
        p_board: value("board") || null,
        p_registration_start: nullableDate("registration_start"),
        p_registration_end: nullableDate("registration_end"),
        p_exam_date: nullableDate("exam_date"),
        p_answer_key_date: nullableDate("answer_key_date"),
        p_fee: feeRaw === "" ? null : Number(feeRaw),
        p_edital_url: value("edital_url") || null,
        p_registration_url: value("registration_url") || null,
        p_admin_notes: value("admin_notes") || null
      });

      if (error || data !== true) {
        throw error || new Error("Não foi possível salvar o edital.");
      }

      if (status) {
        status.textContent = "Edital revisado e salvo.";
        status.className = "admin-edital-form-status success";
      }

      await load(true);
    } catch (error) {
      console.error(error);

      if (status) {
        status.textContent = "Não foi possível salvar o edital.";
        status.className = "admin-edital-form-status error";
      }

      if (button) {
        button.disabled = false;
        button.textContent = "Tentar novamente";
      }
    }
  }

  document.addEventListener("submit", (event) => {
    const form = event.target.closest?.("[data-admin-edital-form]");
    if (!form) return;

    event.preventDefault();
    saveForm(form);
  });

  document.addEventListener("click", async (event) => {
    const publishButton = event.target.closest?.("[data-publish-edital]");

    if (publishButton) {
      const id = publishButton.dataset.publishEdital;
      const item = state.items.find((row) => row.id === id);

      if (!item) return;

      if (item.review_status !== "reviewed") {
        window.LuriaDialog?.alert?.("Salve a revisão do edital antes de publicar.");
        return;
      }

      if (!item.edital_url) {
        window.LuriaDialog?.alert?.("Informe o link oficial do edital antes de publicar.");
        return;
      }

      const confirmed = await window.LuriaDialog?.confirm?.(
        `Publicar "${item.institution}" na Central de editais?`
      );

      if (confirmed === false) return;

      publishButton.disabled = true;
      const original = publishButton.textContent;
      publishButton.textContent = "Publicando...";

      try {
        const { data, error } = await sb.rpc(
          "admin_publish_exam_catalog",
          { p_id: id }
        );

        if (error || data !== true) {
          throw error || new Error("Não foi possível publicar.");
        }

        await load(true);
      } catch (error) {
        console.error(error);
        publishButton.disabled = false;
        publishButton.textContent = original;
        window.LuriaDialog?.alert?.("Não foi possível publicar o edital.");
      }

      return;
    }

    const button = event.target.closest?.("[data-use-source-edital]");
    if (!button) return;

    const id = button.dataset.useSourceEdital;
    const item = state.items.find((row) => row.id === id);
    const form = document.querySelector(`[data-admin-edital-form="${CSS.escape(id)}"]`);
    const input = form?.elements?.namedItem("edital_url");

    if (item?.source_edital_url && input) {
      input.value = item.source_edital_url;
      input.focus();
    }
  });

  $("admin-editais-search")?.addEventListener("input", render);
  $("admin-editais-filter")?.addEventListener("change", render);

  window.LuriaAdminEditais = {
    load,
    refresh: () => load(true),
    get pendingCount() {
      return state.pendingCount;
    }
  };
})();
