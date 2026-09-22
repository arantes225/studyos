(() => {
  "use strict";

  const sb = window.supabaseClient;
  let loaded = false;
  let loadingPromise = null;
  let rows = [];
  let pendingEnamedRow = null;
  let pendingEnamedButton = null;
  let cutoffOptionsLoaded = false;

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


  function isEnamedOrEnare(row) {
    const haystack = [
      row?.institution,
      row?.board,
      row?.status_text
    ]
      .filter(Boolean)
      .join(" ");

    return /\b(?:ENAMED|ENARE)\b/i.test(haystack);
  }

  async function ensureCutoffOptions() {
    if (cutoffOptionsLoaded) return;

    const { data, error } = await sb.rpc("get_enare_cutoff_options");
    if (error) throw error;

    const hospitals = Array.isArray(data?.hospitals) ? data.hospitals : [];
    const specialties = Array.isArray(data?.specialties) ? data.specialties : [];

    const hospitalList = $("enamed-hospital-options");
    const specialtyList = $("enamed-specialty-options");

    if (hospitalList) {
      hospitalList.innerHTML = hospitals
        .map((value) => `<option value="${escapeHtml(value)}"></option>`)
        .join("");
    }

    if (specialtyList) {
      specialtyList.innerHTML = specialties
        .map((value) => `<option value="${escapeHtml(value)}"></option>`)
        .join("");
    }

    cutoffOptionsLoaded = true;
  }

  function closeEnamedDialog() {
    $("enamed-target-dialog")?.close();
    pendingEnamedRow = null;
    pendingEnamedButton = null;
  }

  async function addCatalogExam(row, button, extra = {}) {
    button.disabled = true;
    const original = button.dataset.originalLabel || button.textContent;
    button.dataset.originalLabel = original;
    button.textContent = "Adicionando...";

    try {
      let existingQuery = sb
        .from("exams")
        .select("id")
        .eq("institution", row.institution);

      if (extra.target_specialty) {
        existingQuery = existingQuery.eq(
          "target_specialty",
          extra.target_specialty
        );
      }

      if (extra.target_hospital) {
        existingQuery = existingQuery.eq(
          "target_hospital",
          extra.target_hospital
        );
      }

      const { data: existing, error: lookupError } =
        await existingQuery
          .limit(1)
          .maybeSingle();

      if (lookupError) throw lookupError;

      if (existing?.id) {
        button.textContent = "Já adicionada";
        return true;
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
          notes: "Importado automaticamente da Central de editais.",
          status: "planned",
          edital_url: row.edital_url || null,
          registration_url: row.registration_url || null,
          target_specialty: extra.target_specialty || null,
          target_hospital: extra.target_hospital || null,
          cutoff_history: Array.isArray(extra.cutoff_history)
            ? extra.cutoff_history
            : []
        });

      if (error) throw error;

      button.textContent = "Adicionada";

      if (typeof window.loadExams === "function") {
        await window.loadExams();
      }

      if (typeof window.loadExamMetrics === "function") {
        await window.loadExamMetrics();
      }

      if (typeof window.refreshExamV16 === "function") {
        await window.refreshExamV16();
      }

      return true;
    } catch (error) {
      console.error(error);
      button.disabled = false;
      button.textContent = original;
      window.LuriaDialog?.alert?.("Não foi possível adicionar este edital às suas provas.");
      return false;
    }
  }

  async function openEnamedDialog(row, button) {
    pendingEnamedRow = row;
    pendingEnamedButton = button;

    const hospital = $("enamed-target-hospital");
    const specialty = $("enamed-target-specialty");
    const status = $("enamed-target-status");

    if (hospital) hospital.value = "";
    if (specialty) specialty.value = "";
    if (status) {
      status.textContent = "";
      status.className = "enamed-target-status";
    }

    $("enamed-target-dialog")?.showModal();

    try {
      await ensureCutoffOptions();
    } catch (error) {
      console.warn("Não foi possível carregar as sugestões de ENARE:", error);
    }

    requestAnimationFrame(() => specialty?.focus());
  }

  async function submitEnamedTarget(event) {
    event.preventDefault();

    const row = pendingEnamedRow;
    const button = pendingEnamedButton;
    const hospital = $("enamed-target-hospital")?.value.trim() || "";
    const specialty = $("enamed-target-specialty")?.value.trim() || "";
    const submit = $("enamed-target-submit");
    const status = $("enamed-target-status");

    if (!row || !button) {
      closeEnamedDialog();
      return;
    }

    if (!specialty || !hospital) {
      if (status) {
        status.textContent = "Informe a especialidade pretendida e o hospital.";
        status.className = "enamed-target-status error";
      }
      return;
    }

    if (submit) {
      submit.disabled = true;
      submit.textContent = "Buscando notas...";
    }

    if (status) {
      status.textContent = "Buscando histórico de notas de corte...";
      status.className = "enamed-target-status";
    }

    try {
      const { data, error } = await sb.rpc("search_enare_cutoffs", {
        p_hospital: hospital,
        p_specialty: specialty
      });

      if (error) throw error;

      const historyRaw = Array.isArray(data?.history) ? data.history : [];

      if (!historyRaw.length) {
        if (status) {
          status.textContent =
            "Não encontrei notas para essa combinação. Confira o nome da especialidade e do hospital.";
          status.className = "enamed-target-status error";
        }
        return;
      }

      const history = historyRaw
        .map((item) => ({
          year: String(item.year || ""),
          score: Number(item.score) / 10
        }))
        .filter((item) =>
          item.year &&
          Number.isFinite(item.score) &&
          item.score >= 0 &&
          item.score <= 100
        )
        .slice(0, 8);

      const added = await addCatalogExam(row, button, {
        target_specialty: data?.specialty || specialty,
        target_hospital: data?.hospital || hospital,
        cutoff_history: history
      });

      if (added) {
        $("enamed-target-dialog")?.close();
        pendingEnamedRow = null;
        pendingEnamedButton = null;
      }
    } catch (error) {
      console.error(error);
      if (status) {
        status.textContent = "Não foi possível buscar as notas de corte agora.";
        status.className = "enamed-target-status error";
      }
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = "Buscar notas e adicionar";
      }
    }
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

            
          </div>
        </article>
      `;
    }).join("");

    list.querySelectorAll("[data-catalog-add]").forEach((button) => {
      button.addEventListener("click", async () => {
        const row = rows.find((item) => item.id === button.dataset.catalogAdd);
        if (!row || !window.docmapUser?.id) return;

        if (isEnamedOrEnare(row)) {
          await openEnamedDialog(row, button);
          return;
        }

        await addCatalogExam(row, button);
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
          .rpc("get_exam_catalog_public");

        if (error) throw error;

        rows = Array.isArray(data) ? data : [];
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

  $("enamed-target-form")?.addEventListener("submit", submitEnamedTarget);
  $("enamed-target-close")?.addEventListener("click", closeEnamedDialog);
  $("enamed-target-cancel")?.addEventListener("click", closeEnamedDialog);

  $("catalog-search")?.addEventListener("input", renderCatalog);
  $("catalog-uf")?.addEventListener("change", renderCatalog);

  document.querySelector('[data-editais-source="catalog"]')
    ?.addEventListener("click", () => {
      loadCatalog().catch(() => {});
    });

  function maybeLoadInitial() {
    const section = $("editais-catalog-content");
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
