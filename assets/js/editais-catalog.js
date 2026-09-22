(() => {
  "use strict";

  const sb = window.supabaseClient;
  let loaded = false;
  let loadingPromise = null;
  let rows = [];

  const $ = (id) => document.getElementById(id);

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(value) {
    if (!value) return "A definir";
    const [y, m, d] = String(value).split("-").map(Number);
    if (!y || !m || !d) return "A definir";
    return new Intl.DateTimeFormat("pt-BR").format(new Date(y, m - 1, d));
  }

  function formatRegistration(row) {
    if (row.registration_start && row.registration_end) {
      const start = formatDate(row.registration_start);
      const end = formatDate(row.registration_end);
      return start === end ? end : `${start} a ${end}`;
    }
    return row.registration_text || "A definir";
  }

  function statusClass(row) {
    if (row.edital_url) return "available";
    if (/breve/i.test(String(row.status_text || ""))) return "soon";
    return "monitoring";
  }

  function filteredRows() {
    const search = ($("catalog-search")?.value || "").trim().toLowerCase();
    const uf = $("catalog-uf")?.value || "";

    return rows.filter((row) => {
      if (uf && row.uf !== uf) return false;
      if (!search) return true;

      return [
        row.institution,
        row.board,
        row.uf,
        row.status_text
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }

  function renderCatalog() {
    const list = $("catalog-list");
    const empty = $("catalog-empty");
    const count = $("catalog-count");
    if (!list || !empty) return;

    const visible = filteredRows();

    if (count) {
      count.textContent = `${visible.length} edital${visible.length === 1 ? "" : "is"}`;
    }

    if (!visible.length) {
      list.innerHTML = "";
      empty.hidden = false;
      return;
    }

    empty.hidden = true;

    list.innerHTML = visible.map((row) => {
      const status = row.status_text || (row.edital_url ? "Edital disponível" : "Monitorando");
      const fee = row.fee_text || (row.fee != null
        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(row.fee))
        : "A definir");

      return `
        <article class="catalog-card">
          <div class="catalog-card-head">
            <div>
              <div class="catalog-card-meta">
                ${row.uf ? `<span class="catalog-uf">${escapeHtml(row.uf)}</span>` : ""}
                <span class="catalog-status ${statusClass(row)}">${escapeHtml(status)}</span>
              </div>
              <h3>${escapeHtml(row.institution)}</h3>
              <p>${escapeHtml(row.board || "Banca a confirmar")}</p>
            </div>
          </div>

          <div class="catalog-card-grid">
            <div>
              <span>Inscrição</span>
              <strong>${escapeHtml(formatRegistration(row))}</strong>
            </div>
            <div>
              <span>Prova</span>
              <strong>${escapeHtml(formatDate(row.exam_date))}</strong>
            </div>
            <div>
              <span>Gabarito</span>
              <strong>${escapeHtml(formatDate(row.answer_key_date))}</strong>
            </div>
            <div>
              <span>Taxa</span>
              <strong>${escapeHtml(fee)}</strong>
            </div>
          </div>

          <div class="catalog-card-actions">
            <button
              class="button primary"
              type="button"
              data-catalog-add="${escapeHtml(row.id)}"
            >
              Adicionar às minhas provas
            </button>

            ${row.edital_url ? `
              <a
                class="button secondary"
                href="${escapeHtml(row.edital_url)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir edital
              </a>
            ` : ""}

            <a
              class="catalog-source-link"
              href="${escapeHtml(row.source_url || "https://aristo.com.br/editais/")}"
              target="_blank"
              rel="noopener noreferrer"
            >
              Fonte Aristo
            </a>
          </div>
        </article>
      `;
    }).join("");

    list.querySelectorAll("[data-catalog-add]").forEach((button) => {
      button.addEventListener("click", async () => {
        const row = rows.find((item) => item.id === button.dataset.catalogAdd);
        if (!row || !window.docmapUser?.id) return;

        button.disabled = true;
        const original = button.textContent;
        button.textContent = "Adicionando...";

        try {
          const { data: existing, error: lookupError } = await sb
            .from("exams")
            .select("id")
            .eq("institution", row.institution)
            .limit(1)
            .maybeSingle();

          if (lookupError) throw lookupError;

          if (existing?.id) {
            button.textContent = "Já adicionada";
            return;
          }

          const { error } = await sb
            .from("exams")
            .insert({
              user_id: window.docmapUser.id,
              institution: row.institution,
              board: row.board || null,
              exam_date: row.exam_date || null,
              registration_deadline: row.registration_end || null,
              fee: row.fee ?? null,
              notes: "Importado automaticamente da Central de editais Aristo.",
              status: "planned",
              edital_url: row.edital_url || null,
              registration_url: row.registration_url || null
            });

          if (error) throw error;

          button.textContent = "Adicionada";

          if (typeof window.loadExams === "function") {
            await window.loadExams();
          }
          if (typeof window.loadExamMetrics === "function") {
            await window.loadExamMetrics();
          }
        } catch (error) {
          console.error(error);
          button.disabled = false;
          button.textContent = original;
          window.LuriaDialog?.alert?.("Não foi possível adicionar este edital às suas provas.");
        }
      });
    });
  }

  function populateUfFilter() {
    const select = $("catalog-uf");
    if (!select) return;

    const values = Array.from(new Set(rows.map((row) => row.uf).filter(Boolean)))
      .sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));

    select.innerHTML =
      '<option value="">Todos os estados</option>' +
      values.map((uf) => `<option value="${escapeHtml(uf)}">${escapeHtml(uf)}</option>`).join("");
  }

  async function loadCatalog() {
    if (loaded) {
      renderCatalog();
      return rows;
    }

    if (loadingPromise) return loadingPromise;

    const status = $("catalog-loading");
    if (status) {
      status.hidden = false;
      status.textContent = "Atualizando central de editais...";
    }

    loadingPromise = (async () => {
      try {
        const { data, error } = await sb
          .from("exam_catalog")
          .select("id,institution,uf,registration_text,registration_start,registration_end,exam_date,answer_key_date,fee_text,fee,board,edital_url,registration_url,source_url,status_text,last_seen_at")
          .eq("active", true)
          .order("exam_date", { ascending: true, nullsFirst: false })
          .order("institution", { ascending: true });

        if (error) throw error;

        rows = data || [];
        loaded = true;
        populateUfFilter();
        renderCatalog();

        if (status) {
          const latest = rows
            .map((row) => row.last_seen_at)
            .filter(Boolean)
            .sort()
            .at(-1);

          status.textContent = latest
            ? `Atualizado automaticamente em ${new Intl.DateTimeFormat("pt-BR", {
                dateStyle: "short",
                timeStyle: "short"
              }).format(new Date(latest))}.`
            : "Dados sincronizados automaticamente.";
        }

        return rows;
      } catch (error) {
        console.error(error);
        if (status) {
          status.textContent = "Não foi possível carregar a central de editais.";
        }
        throw error;
      } finally {
        loadingPromise = null;
      }
    })();

    return loadingPromise;
  }

  window.loadLuriaExamCatalog = loadCatalog;

  $("catalog-search")?.addEventListener("input", renderCatalog);
  $("catalog-uf")?.addEventListener("change", renderCatalog);

  document.querySelector('[data-editais-source="aristo"]')
    ?.addEventListener("click", () => {
      loadCatalog().catch(() => {});
    });

  function maybeLoadInitial() {
    const section = $("editais-aristo-content");
    if (section && !section.hidden) {
      loadCatalog().catch(() => {});
    }
  }

  if (window.docmapUser) {
    maybeLoadInitial();
  } else {
    window.addEventListener("docmap:ready", maybeLoadInitial, { once: true });
  }
})();
