(() => {
  "use strict";

  const sb =
    window.supabaseClient;

  const state = {
    days: 30,
    snapshot: null,
    logistics: null,
    costItems: [],
    storageBreakdown: null,
    databaseBreakdown: null,
    planPrices: [],
    planFeatures: [],
    customers: [],
    pinConfigured: false,
    pinUnlocked: false,
    wired: false,
    storageGuide: "",
    storageGuidePath: "",
    storageGuideError: "",
    questionFactory: null,
    qfBatchNumber: null,
    qfOffset: 0,
    qfPageSize: 100,
    qfTotal: 0,
    questionStyles: [],
    qfBadOffset: 0,
    qfBadPageSize: 50,
    qfBadTotal: 0,
    qfReviewImportBatch: null,
    qfReviewImportBlock: null,
    qfReviewImportMode: "block",
    qfQuality: null
  };

  const METRICS = [
    {
      key: "new_signups",
      label: "Novos cadastros",
      format: value => formatNumber(value),
      helper: data => `${formatNumber(data.new_signups_today)} hoje · ${formatNumber(data.new_signups_7d)} em 7 dias`
    },
    {
      key: "activation_rate",
      label: "Taxa de ativação",
      format: value => formatPercent(value),
      helper: () => "Criou cronograma + realizou uma ação relevante"
    },
    {
      key: "avg_activation_minutes",
      label: "Tempo até ativação",
      format: value => formatMinutes(value),
      helper: () => "Tempo médio até o primeiro “aha moment”"
    },
    {
      key: "dau",
      label: "DAU / WAU / MAU",
      format: value => formatNumber(value),
      helper: data => `${formatNumber(data.wau)} WAU · ${formatNumber(data.mau)} MAU`
    },
    {
      key: "dau_mau",
      label: "DAU / MAU",
      format: value => formatPercent(value),
      helper: () => "Frequência diária entre usuários mensais"
    },
    {
      key: "retention_d1",
      label: "Retenção D1 / D7 / D30",
      format: value => formatPercent(value),
      helper: data => `${formatPercent(data.retention_d7)} D7 · ${formatPercent(data.retention_d30)} D30`
    },
    {
      key: "churn",
      label: "Churn",
      format: value => formatPercent(value),
      helper: () => "Cancelamentos no mês sobre base pagante inicial"
    },
    {
      key: "free_to_paid_conversion",
      label: "Grátis → pago",
      format: value => formatPercent(value),
      helper: () => "Trials que converteram em assinatura"
    },
    {
      key: "mrr_cents",
      label: "MRR",
      format: value => formatMoney(value),
      helper: () => "Receita recorrente mensal ativa"
    },
    {
      key: "arpu_cents",
      label: "ARPU",
      format: value => formatMoney(value),
      helper: () => "Receita média por assinante pagante"
    },
    {
      key: "ai_tokens",
      label: "Uso de IA",
      format: value => formatNumber(value),
      helper: data => `${formatMoney(data.ai_cost_cents)} de custo no período`
    },
    {
      key: "paying_clients",
      label: "Assinantes pagantes",
      format: value => formatNumber(value),
      helper: data => `${formatPercent(data.paying_share)} da base total`
    }
  ];

  const FEATURE_LABELS = {
    cronograma: "Cronograma",
    caderno: "Caderno",
    ccq: "Pulo do Gato",
    flashcards: "Flashcards",
    questoes: "Questões",
    ia: "IA"
  };

  const PLAN_FEATURE_PLANS = [
    { slug: "essential", label: "Essencial" },
    { slug: "plus", label: "Plus" },
    { slug: "pro", label: "Pro" },
    { slug: "betatester", label: "Betatester" }
  ];

  const PLAN_FEATURE_CATALOG = [
    { key: "dashboard", label: "Dashboard", description: "Acesso ao painel principal." },
    { key: "agenda", label: "Agenda", description: "Agenda e gerenciamento de eventos." },
    { key: "cronograma", label: "Cronograma", description: "Acesso ao módulo de cronograma." },
    { key: "automatic_schedule", label: "Cronograma automático", description: "Importação e montagem automática do cronograma." },
    { key: "ambientacao", label: "Ambientação", description: "Ambiente de estudo." },
    { key: "caderno", label: "Caderno", description: "Acesso ao caderno de estudos." },
    { key: "notebook_images", label: "Imagens no caderno", description: "Quantidade máxima de imagens por caderno.", limit: true, max: 2, limitLabel: "imagens" },
    { key: "error_notebook", label: "Caderno de erros", description: "Acesso ao Caderno de Erros." },
    { key: "error_notebook_images", label: "Imagens no Caderno de Erros", description: "Quantidade máxima de imagens por item.", limit: true, max: 1, limitLabel: "imagens" },
    { key: "flashcards", label: "Flashcards", description: "Criação e revisão de flashcards." },
    { key: "flashcard_images", label: "Imagens em flashcards", description: "Quantidade máxima de imagens por flashcard.", limit: true, max: 2, limitLabel: "imagens" },
    { key: "flashcard_import", label: "Importação de flashcards", description: "Excel, CSV e Anki." },
    { key: "questions", label: "Questões", description: "Acesso ao módulo de questões." },
    { key: "automatic_questions", label: "Questões automáticas", description: "Geração/importação automática de questões." },
    { key: "question_import", label: "Importação de questões", description: "Importação em lote de questões." },
    { key: "simulations", label: "Simulados", description: "Criação e realização de simulados." },
    { key: "statistics_general", label: "Estatísticas gerais", description: "Resumo geral de desempenho." },
    { key: "advanced_statistics", label: "Estatísticas detalhadas", description: "Análises aprofundadas por módulo." },
    { key: "studyrats_accessories", label: "Acessórios dos ratinhos", description: "Libera uso de acessórios no StudyRats." },
    { key: "studyrats_variants", label: "Outros ratos", description: "Libera variantes além do rato azul base." },
    { key: "ai", label: "IA", description: "Recursos de inteligência artificial." }
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(date);
  }

  function formatPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return `${new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0
    }).format(number)}%`;
  }

  function formatMoney(cents) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(Number(cents || 0) / 100);
  }


  function formatBytes(bytes) {
    const value = Number(bytes);

    if (!Number.isFinite(value) || value < 0) {
      return "—";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = value;
    let unit = 0;

    while (
      size >= 1024
      && unit < units.length - 1
    ) {
      size /= 1024;
      unit += 1;
    }

    return `${new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits:
        unit >= 3 ? 2 : 1,
      minimumFractionDigits: 0
    }).format(size)} ${units[unit]}`;
  }

  function formatCustomerMemory(bytes) {
    const value =
      Math.max(
        0,
        Number(bytes || 0)
      );

    if (!Number.isFinite(value)) {
      return "—";
    }

    if (value === 0) {
      return "0 B";
    }

    const units = [
      "B",
      "KB",
      "MB",
      "GB",
      "TB"
    ];

    const unitIndex =
      Math.min(
        units.length - 1,
        Math.floor(
          Math.log(value)
          / Math.log(1024)
        )
      );

    const size =
      value
      / Math.pow(
        1024,
        unitIndex
      );

    return `${new Intl.NumberFormat(
      "pt-BR",
      {
        maximumFractionDigits:
          size < 10
            ? 2
            : size < 100
              ? 1
              : 0,
        minimumFractionDigits:
          0
      }
    ).format(size)} ${units[unitIndex]}`;
  }


  function usagePercent(used, quota) {
    const current = Number(used);
    const limit = Number(quota);

    if (
      !Number.isFinite(current)
      || !Number.isFinite(limit)
      || limit <= 0
    ) {
      return null;
    }

    return Math.max(
      0,
      Math.min(
        100,
        100 * current / limit
      )
    );
  }

  function formatMinutes(value) {
    const minutes = Number(value || 0);

    if (!Number.isFinite(minutes) || minutes <= 0) {
      return "—";
    }

    if (minutes < 60) {
      return `${Math.round(minutes)} min`;
    }

    const hours = Math.floor(minutes / 60);
    const rest = Math.round(minutes % 60);

    return rest
      ? `${hours}h ${rest}min`
      : `${hours}h`;
  }

  function formatHours(value) {
    const hours = Number(value || 0);

    return `${new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 1,
      minimumFractionDigits: hours > 0 && hours < 10 ? 1 : 0
    }).format(hours)}h`;
  }

  function formatDate(value) {
    if (!value) return "—";

    const date =
      new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit"
    }).format(date);
  }

  function formatSubscriptionTime(days) {
    const value =
      Math.max(0, Number(days || 0));

    if (!value) {
      return "—";
    }

    if (value < 30) {
      return `${value} dia${value === 1 ? "" : "s"}`;
    }

    if (value < 365) {
      const months =
        Math.max(1, Math.floor(value / 30));

      return `${months} mês${months === 1 ? "" : "es"}`;
    }

    const years =
      Math.floor(value / 365);

    const months =
      Math.floor((value % 365) / 30);

    return months
      ? `${years}a ${months}m`
      : `${years} ano${years === 1 ? "" : "s"}`;
  }

  function setStatus(text, type = "") {
    const element = $("admin-status");

    element.textContent =
      text;

    element.className =
      `admin-status ${type}`.trim();
  }

  function renderSummary(summary) {
    $("admin-total-clients").textContent =
      formatNumber(summary.total_clients);

    $("admin-plan-essential").textContent =
      formatNumber(summary.essential);

    $("admin-plan-plus").textContent =
      formatNumber(summary.plus);

    $("admin-plan-pro").textContent =
      formatNumber(summary.pro);
  }

  function renderMetrics(metrics) {
    $("admin-metrics-grid").innerHTML =
      METRICS
        .map(metric => `
          <article class="admin-metric-card">
            <span>${esc(metric.label)}</span>
            <strong>${esc(metric.format(metrics[metric.key]))}</strong>
            <small>${esc(metric.helper(metrics))}</small>
          </article>
        `)
        .join("");
  }

  function renderFeatures(features, metrics) {
    const values =
      Object.entries(FEATURE_LABELS)
        .map(([key, label]) => ({
          key,
          label,
          value: Number(features?.[key] || 0)
        }));

    const max =
      Math.max(
        1,
        Number(metrics?.mau || 0),
        ...values.map(item => item.value)
      );

    $("admin-feature-grid").innerHTML =
      values
        .map(item => {
          const share =
            Math.min(
              100,
              100 * item.value / max
            );

          return `
            <article class="admin-feature-card">
              <span>${esc(item.label)}</span>
              <strong>${formatNumber(item.value)}</strong>
              <small>usuários no período</small>
              <div class="admin-feature-bar" aria-hidden="true">
                <span style="width:${share.toFixed(1)}%"></span>
              </div>
            </article>
          `;
        })
        .join("");
  }

  function monthlyEquivalentCents(item, peopleCount) {
    const amount = Math.max(0, Number(item?.amount_cents || 0));
    const monthly = item?.cadence === "annual" ? amount / 12 : amount;
    return item?.scope === "per_person"
      ? monthly * Math.max(0, Number(peopleCount || 0))
      : monthly;
  }

  function renderCostEditor() {
    const list = $("admin-cost-editor-list");
    if (!list) return;
    list.innerHTML = state.costItems.map(item => `
      <div class="admin-cost-editor-row" data-cost-key="${esc(item.key)}">
        <strong>${esc(item.label)}</strong>
        <label class="admin-money-input">
          <span>R$</span>
          <input type="number" min="0" step="0.01" inputmode="decimal"
            data-cost-field="amount"
            value="${(Number(item.amount_cents || 0) / 100).toFixed(2)}"
            aria-label="Valor de ${esc(item.label)}">
        </label>
        <select data-cost-field="cadence" aria-label="Período de ${esc(item.label)}">
          <option value="monthly" ${item.cadence === "monthly" ? "selected" : ""}>Mensal</option>
          <option value="annual" ${item.cadence === "annual" ? "selected" : ""}>Anual</option>
        </select>
        <select data-cost-field="scope" aria-label="Aplicação de ${esc(item.label)}">
          <option value="general" ${item.scope === "general" ? "selected" : ""}>Geral</option>
          <option value="per_person" ${item.scope === "per_person" ? "selected" : ""}>Por pessoa</option>
        </select>
      </div>
    `).join("");
  }

  function renderStorageExpansionAlert() {
    const alert =
      $("admin-storage-expansion-alert");

    if (!alert) {
      return;
    }

    const storage =
      state.logistics?.storage
      || {};

    const percent =
      usagePercent(
        storage.used_bytes,
        storage.quota_bytes
      );

    const visible =
      percent !== null
      && percent >= 80;

    alert.hidden =
      !visible;

    if (!visible) {
      return;
    }

    const percentElement =
      $("admin-storage-expansion-percent");

    const summary =
      $("admin-storage-expansion-summary");

    const button =
      $("admin-storage-expansion-open");

    const content =
      $("admin-storage-expansion-content");

    const source =
      $("admin-storage-expansion-source");

    if (percentElement) {
      percentElement.textContent =
        formatPercent(
          percent
        );
    }

    if (summary) {
      summary.textContent =
        `${formatBytes(storage.used_bytes)} usados de ${formatBytes(storage.quota_bytes)}. O plano de expansão do Storage já está disponível.`;
    }

    if (source) {
      source.textContent =
        state.storageGuidePath
          ? `Guia privado: docmap/${state.storageGuidePath}`
          : state.storageGuideError
            ? "O guia não pôde ser carregado do Storage."
            : "Preparando guia privado no Storage...";
    }

    if (button) {
      button.disabled =
        !state.storageGuide;

      if (!state.storageGuide) {
        button.textContent =
          state.storageGuideError
            ? "Indisponível"
            : "Preparando...";
      } else if (
        content
        && !content.hidden
      ) {
        button.textContent =
          "Fechar";
      } else {
        button.textContent =
          "Abrir";
      }
    }

    if (
      content
      && state.storageGuide
      && !content.dataset.ready
    ) {
      content.textContent =
        state.storageGuide;

      content.dataset.ready =
        "true";
    }
  }


  async function loadStorageExpansionGuide() {
    try {
      state.storageGuideError =
        "";

      const {
        data,
        error
      } =
        await sb.functions.invoke(
          "admin-storage-guide",
          {
            body: {
              action:
                "ensure"
            }
          }
        );

      if (error) {
        throw error;
      }

      if (
        !data?.content
      ) {
        throw new Error(
          "O guia administrativo voltou sem conteúdo."
        );
      }

      state.storageGuide =
        String(
          data.content
        );

      state.storageGuidePath =
        String(
          data.path
          || "_admin/storage-expansion-guide.md"
        );

    } catch (error) {
      console.warn(
        "Não foi possível preparar o guia de expansão do Storage:",
        error
      );

      state.storageGuide =
        "";

      state.storageGuideError =
        error?.message
        || "Falha ao carregar o guia.";

    } finally {
      renderStorageExpansionAlert();
    }
  }


  function renderDatabaseBreakdown(data) {
    state.databaseBreakdown = data || {};
    const total = Number(data?.total_bytes || 0);
    const tables = Array.isArray(data?.tables) ? data.tables : [];

    if ($("admin-database-total")) {
      $("admin-database-total").textContent = formatBytes(total);
    }

    const summary = $("admin-database-summary");
    if (summary) {
      const totalRows = tables.reduce((sum,item) => sum + Number(item.rows || 0), 0);
      summary.innerHTML = `
        <span><small>Tabelas</small><strong>${esc(formatNumber(data?.table_count || tables.length))}</strong></span>
        <span><small>Registros estimados</small><strong>${esc(formatNumber(totalRows))}</strong></span>
        <span><small>Maior tabela</small><strong>${esc(tables[0]?.table || "—")}</strong></span>
      `;
    }

    const list = $("admin-database-breakdown-list");
    if (!list) return;

    if (!tables.length) {
      list.innerHTML = '<div class="admin-empty-mini">Nenhuma tabela encontrada.</div>';
      return;
    }

    list.innerHTML = tables.map(item => {
      const pct = Number(item.percent || 0);
      return `
        <div class="admin-database-row">
          <div class="admin-database-row-head">
            <div>
              <strong>${esc(item.table)}</strong>
              <small>${esc(item.category || "Sem categoria")}</small>
            </div>
            <span>${esc(formatBytes(item.bytes))} · ${esc(formatPercent(pct))}</span>
          </div>
          <div class="admin-database-type-track">
            <span style="width:${Math.min(100,pct).toFixed(2)}%"></span>
          </div>
          <small>${esc(formatNumber(item.rows || 0))} registro${Number(item.rows)===1?"":"s"}</small>
        </div>
      `;
    }).join("");
  }

  function renderStorageBreakdown(data) {
    state.storageBreakdown = data || {};
    const total = Number(data?.total_bytes || 0);
    if ($("admin-storage-total")) $("admin-storage-total").textContent = formatBytes(total);
    const list = $("admin-storage-breakdown-list");
    if (!list) return;
    const items = Array.isArray(data?.items) ? data.items : [];
    list.innerHTML = items.length ? items.map(item => {
      const pct = Number(item.percent || 0);
      return `<div class="admin-storage-row"><div class="admin-storage-row-head"><strong>${esc(item.category)}</strong><span>${esc(formatBytes(item.bytes))} · ${esc(formatPercent(pct))}</span></div><div class="admin-storage-type-track"><span style="width:${Math.min(100,pct).toFixed(2)}%"></span></div><small>${esc(formatNumber(item.objects))} arquivo${Number(item.objects)===1?"":"s"}</small></div>`;
    }).join("") : '<div class="admin-empty-mini">Nenhum arquivo no Storage.</div>';
  }

  function renderPlanPrices(items) {
    state.planPrices = Array.isArray(items) ? items : [];
    const grid = $("admin-plan-price-grid");
    if (!grid) return;
    const labels={free:"Free",essential:"Essential",plus:"Plus",pro:"Pro"};
    grid.innerHTML = state.planPrices.map(item => `<article class="admin-plan-price-card" data-plan="${esc(item.plan_slug)}"><strong>Plano ${esc(labels[item.plan_slug]||item.plan_slug)}</strong><label><span>Mensal</span><div class="admin-price-input"><b>R$</b><input data-price="monthly_price_cents" inputmode="decimal" value="${(Number(item.monthly_price_cents||0)/100).toFixed(2).replace(".",",")}"></div></label><label><span>Anual à vista</span><div class="admin-price-input"><b>R$</b><input data-price="annual_cash_price_cents" inputmode="decimal" value="${(Number(item.annual_cash_price_cents||0)/100).toFixed(2).replace(".",",")}"></div></label><label><span>Anual parcelado</span><div class="admin-price-input"><b>R$</b><input data-price="annual_installment_price_cents" inputmode="decimal" value="${(Number(item.annual_installment_price_cents||0)/100).toFixed(2).replace(".",",")}"></div></label><label><span>Parcelas</span><input class="admin-installments-input" data-price="annual_installments" type="number" min="1" max="24" value="${Number(item.annual_installments||12)}"></label></article>`).join("");
  }

  function moneyInputToCents(value) {
    const normalized=String(value||"0").replace(/\s/g,"").replace(/\./g,"").replace(",",".");
    return Math.max(0,Math.round((Number(normalized)||0)*100));
  }

  function renderLogistics(logistics, metrics) {
    state.logistics =
      logistics || {};

    const database =
      logistics?.database || {};

    const storage =
      logistics?.storage || {};

    const cache =
      logistics?.cache || {};

    const egress =
      logistics?.egress || {};

    const cachedEgress =
      logistics?.cached_egress || {};

    const infraCards = [
      {
        label: "Base de dados",
        value: formatBytes(database.used_bytes),
        helper:
          database.quota_bytes
            ? `${formatPercent(usagePercent(database.used_bytes, database.quota_bytes))} de ${formatBytes(database.quota_bytes)}`
            : "Uso atual do PostgreSQL",
        used: database.used_bytes,
        quota: database.quota_bytes,
        tone: "database"
      },
      {
        label: "Storage",
        value: formatBytes(storage.used_bytes),
        helper:
          `${formatPercent(usagePercent(storage.used_bytes, storage.quota_bytes))} de ${formatBytes(storage.quota_bytes)} · ${formatNumber(storage.objects)} arquivos`,
        used: storage.used_bytes,
        quota: storage.quota_bytes,
        tone: "storage"
      },
      {
        label: "Cache Postgres",
        value: formatBytes(cache.shared_buffers_bytes),
        helper:
          `${formatPercent(cache.hit_percent)} hit · cache efetivo ${formatBytes(cache.effective_cache_bytes)}`,
        percent:
          Number.isFinite(Number(cache.hit_percent))
            ? Number(cache.hit_percent)
            : null,
        tone: "cache"
      },
      {
        label: "Tráfego / egress",
        value:
          egress.measured
            ? formatBytes(egress.used_bytes)
            : "—",
        helper:
          egress.measured
            ? `${formatPercent(usagePercent(egress.used_bytes, egress.quota_bytes))} de ${formatBytes(egress.quota_bytes)}`
            : `não mensurado · limite ${formatBytes(egress.quota_bytes)}`,
        used:
          egress.measured
            ? egress.used_bytes
            : null,
        quota: egress.quota_bytes,
        tone: "egress"
      },
      {
        label: "Cache CDN",
        value:
          cachedEgress.measured
            ? formatBytes(cachedEgress.used_bytes)
            : "—",
        helper:
          cachedEgress.measured
            ? `${formatPercent(usagePercent(cachedEgress.used_bytes, cachedEgress.quota_bytes))} de ${formatBytes(cachedEgress.quota_bytes)}`
            : `não mensurado · limite ${formatBytes(cachedEgress.quota_bytes)}`,
        used:
          cachedEgress.measured
            ? cachedEgress.used_bytes
            : null,
        quota: cachedEgress.quota_bytes,
        tone: "cdn"
      }
    ];

    $("admin-infra-grid").innerHTML =
      infraCards
        .map(item => {
          const progress =
            item.percent !== undefined
              ? item.percent
              : usagePercent(
                  item.used,
                  item.quota
                );

          return `
            <article class="admin-infra-card ${esc(item.tone)}">
              <span>${esc(item.label)}</span>
              <strong>${esc(item.value)}</strong>
              <small>${esc(item.helper)}</small>
              ${
                progress === null
                || progress === undefined
                  ? '<div class="admin-usage-track unavailable" aria-hidden="true"><span></span></div>'
                  : `
                    <div class="admin-usage-track" aria-hidden="true">
                      <span style="width:${Math.min(100, progress).toFixed(1)}%"></span>
                    </div>
                  `
              }
            </article>
          `;
        })
        .join("");

    renderStorageExpansionAlert();

    const plan =
      String(
        logistics?.plan
        || "—"
      );

    $("admin-logistics-plan").textContent =
      `Supabase · ${plan.charAt(0).toUpperCase() + plan.slice(1)}`;

    $("admin-logistics-updated").textContent =
      logistics?.generated_at
        ? new Intl.DateTimeFormat(
            "pt-BR",
            {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit"
            }
          ).format(
            new Date(
              logistics.generated_at
            )
          )
        : "";

    const revenue =
      Number(
        metrics?.mrr_cents
        || 0
      );

    const peopleCount =
      Number(
        state.snapshot?.summary?.total_clients
        || 0
      );

    const costs =
      state.costItems.length
        ? state.costItems.reduce(
            (sum, item) => sum + monthlyEquivalentCents(item, peopleCount),
            0
          )
        : Number(
            logistics?.costs
              ?.total_cents
            || 0
          );

    const balance =
      revenue - costs;

    $("admin-projected-revenue").textContent =
      formatMoney(
        revenue
      );

    $("admin-projected-costs").textContent =
      formatMoney(
        costs
      );

    $("admin-projected-balance").textContent =
      formatMoney(
        balance
      );

    const margin =
      revenue > 0
        ? 100 * balance / revenue
        : null;

    $("admin-projected-margin").textContent =
      margin === null
        ? "Receita menos custos"
        : `${formatPercent(margin)} de margem projetada`;

    $("admin-projected-balance")
      ?.classList
      .toggle(
        "negative",
        balance < 0
      );

    const breakdown = state.costItems.length
      ? state.costItems
      : [
          { label: "Supabase", amount_cents: logistics?.costs?.supabase_cents, cadence: "monthly", scope: "general" },
          { label: "Hospedagem", amount_cents: logistics?.costs?.hosting_cents, cadence: "monthly", scope: "general" },
          { label: "IA / APIs", amount_cents: logistics?.costs?.ai_cents, cadence: "monthly", scope: "general" },
          { label: "Taxas de pagamento", amount_cents: logistics?.costs?.payment_fees_cents, cadence: "monthly", scope: "general" },
          { label: "Outros", amount_cents: logistics?.costs?.other_cents, cadence: "monthly", scope: "general" }
        ];

    $("admin-cost-breakdown").innerHTML = `
      <div class="admin-cost-items">
        ${breakdown.map(item => {
          const monthly = monthlyEquivalentCents(item, peopleCount);
          const cadence = item.cadence === "annual" ? "anual" : "mensal";
          const scope = item.scope === "per_person" ? "por pessoa" : "geral";
          return `
            <span>
              <small>${esc(item.label)}</small>
              <strong>${esc(formatMoney(monthly))}</strong>
              <em>${esc(cadence)} · ${esc(scope)}</em>
            </span>
          `;
        }).join("")}
      </div>
    `;

    renderCostEditor();
  }

  function setPlanFeaturesStatus(text, type = "") {
    const element = $("admin-plan-features-status");
    if (!element) return;
    element.textContent = text || "";
    element.className =
      `admin-plan-features-status ${type}`.trim();
  }

  function planFeatureValue(planSlug, featureKey) {
    return state.planFeatures.find(
      item =>
        item.plan_slug === planSlug
        && item.feature_key === featureKey
    ) || {
      plan_slug: planSlug,
      feature_key: featureKey,
      enabled: false,
      limit_value: null
    };
  }

  function renderPlanFeatures() {
    const grid = $("admin-plan-features-grid");
    if (!grid) return;

    const heads = [
      '<div class="admin-plan-feature-head">Funcionalidade</div>',
      ...PLAN_FEATURE_PLANS.map(
        plan =>
          `<div class="admin-plan-feature-head">${esc(plan.label)}</div>`
      )
    ].join("");

    const rows = PLAN_FEATURE_CATALOG.map(feature => {
      const cells = PLAN_FEATURE_PLANS.map(plan => {
        const value = planFeatureValue(plan.slug, feature.key);
        const enabled = value.enabled === true;
        const limitValue =
          value.limit_value === null
            || value.limit_value === undefined
            ? ""
            : Number(value.limit_value);

        return `
          <div
            class="admin-plan-feature-cell"
            data-plan-feature-cell
            data-plan="${esc(plan.slug)}"
            data-feature="${esc(feature.key)}"
          >
            <label class="admin-plan-feature-toggle">
              <input
                type="checkbox"
                data-plan-feature-enabled
                ${enabled ? "checked" : ""}
              >
              <span>${enabled ? "Liberado" : "Bloqueado"}</span>
            </label>
            ${feature.limit ? `
              <span class="admin-plan-feature-limit-label">Limite</span>
              <input
                class="admin-plan-limit"
                type="number"
                min="0"
                max="${feature.max ?? 99}"
                step="1"
                inputmode="numeric"
                data-plan-feature-limit
                value="${esc(limitValue)}"
                ${enabled ? "" : "disabled"}
                aria-label="Limite de ${esc(feature.label)} no plano ${esc(plan.label)}"
              >
            ` : ""}
          </div>
        `;
      }).join("");

      return `
        <div class="admin-plan-feature-label">
          <strong>${esc(feature.label)}</strong>
          <small>${esc(feature.description)}</small>
        </div>
        ${cells}
      `;
    }).join("");

    grid.innerHTML = heads + rows;

    grid.querySelectorAll("[data-plan-feature-enabled]")
      .forEach(input => {
        input.addEventListener("change", () => {
          const cell = input.closest("[data-plan-feature-cell]");
          const label = input.parentElement?.querySelector("span");
          const limit = cell?.querySelector("[data-plan-feature-limit]");
          if (label) {
            label.textContent = input.checked ? "Liberado" : "Bloqueado";
          }
          if (limit) {
            limit.disabled = !input.checked;
            if (!input.checked) {
              limit.value = "0";
            }
          }
        });
      });
  }

  async function loadPlanFeatures() {
    setPlanFeaturesStatus("Carregando permissões...");

    const { data, error } =
      await sb.rpc("admin_plan_features_snapshot");

    if (error) {
      throw error;
    }

    state.planFeatures =
      Array.isArray(data) ? data : [];

    renderPlanFeatures();
    setPlanFeaturesStatus("");
  }

  async function savePlanFeatures() {
    const button = $("admin-save-plan-features");
    const cells =
      Array.from(
        document.querySelectorAll("[data-plan-feature-cell]")
      );

    if (!cells.length) {
      return;
    }

    const items = cells.map(cell => {
      const enabled =
        Boolean(
          cell.querySelector("[data-plan-feature-enabled]")?.checked
        );
      const limitInput =
        cell.querySelector("[data-plan-feature-limit]");

      return {
        plan_slug: cell.dataset.plan,
        feature_key: cell.dataset.feature,
        enabled,
        limit_value:
          limitInput
            ? Math.max(
                0,
                Number(limitInput.value || 0)
              )
            : null
      };
    });

    if (button) {
      button.disabled = true;
      button.textContent = "Salvando...";
    }

    setPlanFeaturesStatus("Salvando permissões...");

    try {
      const { data, error } =
        await sb.rpc(
          "admin_save_plan_features",
          { p_items: items }
        );

      if (error) {
        throw error;
      }

      state.planFeatures =
        Array.isArray(data) ? data : [];

      renderPlanFeatures();
      setPlanFeaturesStatus(
        "Permissões salvas.",
        "success"
      );
    } catch (error) {
      console.error(error);
      setPlanFeaturesStatus(
        `Não foi possível salvar: ${error.message}`,
        "error"
      );
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Salvar permissões";
      }
    }
  }


  function filteredCustomers() {
    const query =
      $("admin-customer-search")
        ?.value
        .trim()
        .toLowerCase()
      || "";

    const plan =
      $("admin-customer-plan-filter")
        ?.value
        .trim()
        .toLowerCase()
      || "";

    const status =
      $("admin-customer-status-filter")
        ?.value
        .trim()
        .toLowerCase()
      || "";

    return state.customers.filter(customer => {
      const customerPlan =
        String(customer.plan || "free")
          .toLowerCase();

      const customerStatus =
        String(customer.status || "")
          .toLowerCase();

      if (
        plan
        && customerPlan !== plan
      ) {
        return false;
      }

      if (
        status
        && customerStatus !== status
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack =
        [
          customer.display_name,
          customer.email,
          customer.plan,
          customer.status
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

      return haystack.includes(query);
    });
  }

  function renderCustomers() {
    const customers =
      filteredCustomers();

    $("admin-customer-count").textContent =
      `${formatNumber(customers.length)} cliente${customers.length === 1 ? "" : "s"}`;

    const body =
      $("admin-customer-body");

    if (!customers.length) {
      body.innerHTML =
        '<tr><td colspan="10" class="admin-table-empty">Nenhum cliente encontrado.</td>';
      return;
    }

    body.innerHTML =
      customers
        .map(customer => {
          const retention =
            Math.max(
              0,
              Math.min(
                100,
                Number(customer.study_retention_percent || 0)
              )
            );

          return `
            <tr>
              <td>
                <div class="admin-customer-main">
                  <strong>${esc(customer.display_name || customer.email || "Cliente")}</strong>
                  <small>${esc(customer.email || "—")}</small>
                </div>
              </td>
              <td>
                ${
                  String(customer.plan || "").toLowerCase() === "admin"
                    ? '<span class="admin-plan-pill">admin</span>'
                    : `
                      <select
                        class="admin-customer-plan-select"
                        data-customer-plan
                        data-user-id="${esc(customer.user_id)}"
                        aria-label="Plano de ${esc(customer.display_name || customer.email || "cliente")}"
                      >
                        <option value="essential" ${customer.plan === "essential" ? "selected" : ""}>Essencial</option>
                        <option value="plus" ${customer.plan === "plus" ? "selected" : ""}>Plus</option>
                        <option value="pro" ${customer.plan === "pro" ? "selected" : ""}>Pro</option>
                        <option value="betatester" ${customer.plan === "betatester" ? "selected" : ""}>Betatester</option>
                      </select>
                    `
                }
              </td>
              <td>${esc(formatSubscriptionTime(customer.subscription_days))}</td>
              <td>${esc(formatHours(customer.study_hours_month))}</td>
              <td>${formatNumber(customer.new_flashcards_month)}</td>
              <td>${formatNumber(customer.new_ccq_month)}</td>
              <td>${formatNumber(customer.overdue_lessons)}</td>
              <td>
                <div class="admin-retention">
                  <span>${esc(formatPercent(retention))}</span>
                  <div class="admin-retention-track" aria-hidden="true">
                    <span style="width:${retention.toFixed(1)}%"></span>
                  </div>
                </div>
              </td>
              <td>
                <span class="admin-storage-usage" title="${esc(formatNumber(customer.storage_bytes || 0))} bytes">
                  ${esc(formatCustomerMemory(customer.storage_bytes || 0))}
                </span>
              </td>
              <td>${esc(formatDate(customer.last_access))}</td>
            </tr>
          `;
        })
        .join("");
  }

  async function updateCustomerPlan(select) {
    const userId = select?.dataset?.userId;
    const nextPlan = select?.value;
    const customer = state.customers.find(item => item.user_id === userId);

    if (!userId || !customer || !["essential","plus","pro","betatester"].includes(nextPlan)) return;

    const previousPlan = customer.plan || "essential";
    if (nextPlan === previousPlan) return;

    select.disabled = true;
    select.classList.add("is-saving");

    try {
      const { data, error } = await sb.rpc("admin_set_customer_plan", {
        p_user_id: userId,
        p_plan_slug: nextPlan
      });

      if (error) throw error;

      customer.plan = data?.plan || nextPlan;
      customer.status = data?.status || "complimentary";
      select.classList.remove("is-error");
      select.classList.add("is-saved");
      setTimeout(() => select.classList.remove("is-saved"), 1200);
    } catch (error) {
      console.error(error);
      customer.plan = previousPlan;
      select.value = previousPlan;
      select.classList.add("is-error");
      window.LuriaDialog?.alert(`Não foi possível alterar o plano: ${error.message}`);
    } finally {
      select.disabled = false;
      select.classList.remove("is-saving");
    }
  }

  function render(snapshot) {
    state.snapshot =
      snapshot;

    state.customers =
      Array.isArray(snapshot.customers)
        ? snapshot.customers
        : [];

    renderSummary(
      snapshot.summary || {}
    );

    renderMetrics(
      snapshot.metrics || {}
    );

    renderFeatures(
      snapshot.feature_usage || {},
      snapshot.metrics || {}
    );

    renderLogistics(
      state.logistics || {},
      snapshot.metrics || {}
    );

    renderCustomers();

    $("admin-generated-at").textContent =
      snapshot.generated_at
        ? `Atualizado em ${new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
          }).format(new Date(snapshot.generated_at))}`
        : "";
  }

  async function load() {
    setStatus(
      "Atualizando métricas administrativas..."
    );

    const [
      dashboardResponse,
      logisticsResponse,
      costItemsResponse,
      storageUsageResponse,
      storageBreakdownResponse,
      databaseBreakdownResponse,
      planPricesResponse
    ] =
      await Promise.all([
        sb.rpc(
          "admin_dashboard_snapshot",
          {
            p_days:
              state.days
          }
        ),
        sb.rpc(
          "admin_logistics_snapshot"
        ),
        sb.rpc(
          "admin_cost_items_snapshot"
        ),
        sb.rpc(
          "admin_customer_storage_usage"
        ),
        sb.rpc("admin_storage_breakdown"),
        sb.rpc("admin_database_breakdown"),
        sb.rpc("admin_plan_prices_snapshot")
      ]);

    const {
      data,
      error
    } =
      dashboardResponse;

    if (error) {
      console.error(error);

      if (
        String(error.message || "")
          .toLowerCase()
          .includes("admin")
        ||
        error.code === "42501"
      ) {
        setStatus(
          "Acesso restrito a administradores.",
          "error"
        );

        setTimeout(() => {
          window.location.replace(
            "/dashboard/"
          );
        }, 900);

        return;
      }

      setStatus(
        `Não foi possível carregar o dashboard: ${error.message}. Rode o SQL administrativo no Supabase.`,
        "error"
      );

      return;
    }

    if (
      logisticsResponse.error
    ) {
      console.warn(
        "Não foi possível carregar os dados logísticos:",
        logisticsResponse.error
      );

      state.logistics = {
        plan: "—",
        costs: {}
      };

    } else {
      state.logistics =
        logisticsResponse.data
        || {};
    }

    if (costItemsResponse?.error) {
      console.warn("Não foi possível carregar os custos editáveis:", costItemsResponse.error);
      state.costItems = [];
    } else {
      state.costItems = Array.isArray(costItemsResponse?.data)
        ? costItemsResponse.data
        : [];
    }

    if (storageBreakdownResponse?.error) console.warn("Falha no detalhamento do Storage:", storageBreakdownResponse.error);
    renderStorageBreakdown(storageBreakdownResponse?.data || {});

    if (databaseBreakdownResponse?.error) console.warn("Falha no detalhamento da base de dados:", databaseBreakdownResponse.error);
    renderDatabaseBreakdown(databaseBreakdownResponse?.data || {});

    if (planPricesResponse?.error) console.warn("Falha ao carregar preços dos planos:", planPricesResponse.error);
    renderPlanPrices(planPricesResponse?.data || []);

    const storageByUser =
      new Map(
        Array.isArray(
          storageUsageResponse?.data
        )
          ? storageUsageResponse.data.map(
              row => [
                row.user_id,
                Number(row.storage_bytes || 0)
              ]
            )
          : []
      );

    if (storageUsageResponse?.error) {
      console.warn(
        "Não foi possível carregar o consumo de memória por cliente:",
        storageUsageResponse.error
      );
    }

    const snapshot =
      data || {};

    if (
      Array.isArray(
        snapshot.customers
      )
    ) {
      snapshot.customers =
        snapshot.customers.map(
          customer => ({
            ...customer,
            storage_bytes:
              storageByUser.get(
                customer.user_id
              )
              || 0
          })
        );
    }

    render(
      snapshot
    );

    setStatus(
      "Dashboard atualizado.",
      "success"
    );
  }

  function normalizePin(value) {
    return String(value || "")
      .replace(/\D/g, "")
      .slice(0, 6);
  }

  function setPinMessage(text, type = "") {
    const message =
      $("admin-pin-message");

    if (!message) {
      return;
    }

    message.textContent =
      text;

    message.className =
      `admin-pin-message ${type}`.trim();
  }

  function setPinGateMode(hasPin) {
    state.pinConfigured =
      Boolean(hasPin);

    const fields =
      $("admin-pin-fields");

    const confirmWrap =
      $("admin-pin-confirm-wrap");

    const title =
      $("admin-pin-title");

    const description =
      $("admin-pin-description");

    const label =
      $("admin-pin-label");

    const submit =
      $("admin-pin-submit");

    if (fields) {
      fields.hidden =
        false;
    }

    if (confirmWrap) {
      confirmWrap.hidden =
        state.pinConfigured;
    }

    if (title) {
      title.textContent =
        state.pinConfigured
          ? "Digite seu PIN"
          : "Cadastre seu PIN";
    }

    if (description) {
      description.textContent =
        state.pinConfigured
          ? "Digite os 6 dígitos cadastrados para abrir o painel administrativo."
          : "Este é seu primeiro acesso protegido. Crie um PIN numérico de 6 dígitos para o Admin.";
    }

    if (label) {
      label.textContent =
        state.pinConfigured
          ? "PIN de 6 dígitos"
          : "Criar PIN";
    }

    if (submit) {
      submit.textContent =
        state.pinConfigured
          ? "Desbloquear Admin"
          : "Cadastrar PIN";
      submit.disabled =
        false;
    }

    setPinMessage(
      state.pinConfigured
        ? "O painel permanece bloqueado até a validação."
        : "O PIN será armazenado de forma protegida."
    );

    requestAnimationFrame(
      () => {
        $("admin-pin")
          ?.focus();
      }
    );
  }

  async function loadPinStatus() {
    const {
      data,
      error
    } =
      await sb.rpc(
        "admin_pin_status"
      );

    if (error) {
      throw error;
    }

    setPinGateMode(
      data?.has_pin === true
    );
  }

  async function unlockAdminPage() {
    state.pinUnlocked =
      true;

    const gate =
      $("admin-pin-gate");

    const app =
      $("admin-app");

    document.body.classList.remove(
      "admin-pin-locked"
    );

    document.body.classList.add(
      "admin-unlocked"
    );

    if (gate) {
      gate.hidden =
        true;
    }

    if (app) {
      app.hidden =
        false;
    }

    if (!state.wired) {
      wire();
      state.wired =
        true;
    }

    await Promise.all([
      load(),
      loadStorageExpansionGuide(),
      loadQuestionFactory(),
      loadQuestionFactoryStyles(),
      loadQuestionFactoryBlockTracker(),
      loadBadQuestionFolder(0),
      loadQuestionFactoryQuality(),
      window.LuriaAdminEditais?.load?.() || Promise.resolve()
    ]);
  }

  async function submitAdminPin(event) {
    event.preventDefault();

    const pinInput =
      $("admin-pin");

    const confirmInput =
      $("admin-pin-confirm");

    const submit =
      $("admin-pin-submit");

    const pin =
      normalizePin(
        pinInput?.value
      );

    const confirmPin =
      normalizePin(
        confirmInput?.value
      );

    if (pinInput) {
      pinInput.value =
        pin;
    }

    if (confirmInput) {
      confirmInput.value =
        confirmPin;
    }

    if (pin.length !== 6) {
      setPinMessage(
        "Digite exatamente 6 números.",
        "error"
      );

      pinInput?.focus();
      return;
    }

    if (
      !state.pinConfigured
      &&
      pin !== confirmPin
    ) {
      setPinMessage(
        "Os PINs digitados não coincidem.",
        "error"
      );

      confirmInput?.focus();
      return;
    }

    if (submit) {
      submit.disabled =
        true;

      submit.textContent =
        state.pinConfigured
          ? "Verificando..."
          : "Salvando...";
    }

    try {
      if (!state.pinConfigured) {
        const {
          data,
          error
        } =
          await sb.rpc(
            "admin_set_pin",
            {
              p_pin:
                pin
            }
          );

        if (
          error
          ||
          data !== true
        ) {
          throw error
          || new Error(
            "Não foi possível cadastrar o PIN."
          );
        }

        setPinMessage(
          "PIN cadastrado com sucesso.",
          "success"
        );

        await unlockAdminPage();
        return;
      }

      const {
        data,
        error
      } =
        await sb.rpc(
          "admin_verify_pin",
          {
            p_pin:
              pin
          }
        );

      if (error) {
        throw error;
      }

      if (data?.ok === true) {
        setPinMessage(
          "Acesso liberado.",
          "success"
        );

        await unlockAdminPage();
        return;
      }

      if (
        data?.reason ===
        "locked"
      ) {
        const seconds =
          Number(
            data.retry_after_seconds
            || 3600
          );

        const waitText =
          seconds >= 3600
            ? "1 hora"
            : `${Math.max(
                1,
                Math.ceil(
                  seconds / 60
                )
              )} min`;

        setPinMessage(
          `Muitas tentativas incorretas. Tente novamente em ${waitText}.`,
          "error"
        );

      } else if (
        data?.reason ===
        "incorrect"
      ) {
        setPinMessage(
          `PIN incorreto. ${Number(data.attempts_remaining || 0)} tentativa(s) restante(s).`,
          "error"
        );

      } else {
        setPinMessage(
          "Não foi possível validar o PIN.",
          "error"
        );
      }

      if (pinInput) {
        pinInput.value =
          "";

        pinInput.focus();
      }

    } catch (error) {
      console.error(
        error
      );

      setPinMessage(
        "Não foi possível validar o acesso administrativo.",
        "error"
      );

    } finally {
      if (
        submit
        &&
        !state.pinUnlocked
      ) {
        submit.disabled =
          false;

        submit.textContent =
          state.pinConfigured
            ? "Desbloquear Admin"
            : "Cadastrar PIN";
      }
    }
  }

  function setAdminView(view) {
    const next =
      ["metrics", "factory", "editais", "plans"].includes(view)
        ? view
        : "metrics";

    document.body.dataset.adminView = next;

    document.querySelectorAll("[data-admin-view]").forEach(section => {
      section.hidden = section.dataset.adminView !== next;
    });

    document.querySelectorAll("[data-admin-view-tab]").forEach(button => {
      const active = button.dataset.adminViewTab === next;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });

    const range = document.querySelector(".admin-range");
    if (range) range.hidden = next !== "metrics";

    if (
      next === "editais"
      && window.LuriaAdminEditais?.load
    ) {
      window.LuriaAdminEditais.load().catch(
        error => console.warn(
          "Não foi possível carregar os editais administrativos:",
          error
        )
      );
    }

    if (next === "plans") {
      loadPlanFeatures().catch(
        error => {
          console.error(error);
          setPlanFeaturesStatus(
            "Não foi possível carregar as permissões dos planos.",
            "error"
          );
        }
      );
    }

    try {
      sessionStorage.setItem("luria-admin-view", next);
    } catch (_) {}
  }

  function wireAdminViewMenu() {
    document.querySelectorAll("[data-admin-view-tab]").forEach(button => {
      button.addEventListener("click", () => {
        setAdminView(button.dataset.adminViewTab);
      });
    });

    let initial = "metrics";
    try {
      const saved = sessionStorage.getItem("luria-admin-view");
      if (["metrics", "factory", "editais", "plans"].includes(saved)) {
        initial = saved;
      }
    } catch (_) {}

    setAdminView(initial);
  }


  function wirePinGate() {
    [
      "admin-pin",
      "admin-pin-confirm"
    ]
      .forEach(
        (id) => {
          const input =
            $(id);

          input?.addEventListener(
            "input",
            () => {
              input.value =
                normalizePin(
                  input.value
                );
            }
          );
        }
      );

    $("admin-pin-form")
      ?.addEventListener(
        "submit",
        submitAdminPin
      );
  }


  function qfStatusLabel(value) {
    const labels = {
      building: "Construindo",
      perplexity_review: "Perplexity",
      needs_revision: "Correção",
      approved: "Aprovado",
      merged: "No lote",
      reviewing: "Revisão final",
      ready: "Pronto",
      published: "Publicado",
      pending: "Pendente",
      rejected: "Rejeitado"
    };
    return labels[String(value || "")] || "Pendente";
  }

  function qfReviewPill(label, status) {
    const tone = ["approved","needs_revision","rejected"].includes(status) ? status : "";
    return '<span class="admin-qf-review-pill '+esc(tone)+'">'+esc(label)+': '+esc(qfStatusLabel(status))+'</span>';
  }

  function renderQuestionFactory(snapshot) {
    state.questionFactory = snapshot || {};
    const totals = snapshot?.totals || {};
    if ($("admin-qf-total")) $("admin-qf-total").textContent = formatNumber(totals.questions);
    if ($("admin-qf-blocks")) $("admin-qf-blocks").textContent = formatNumber(totals.blocks);
    if ($("admin-qf-block-review")) $("admin-qf-block-review").textContent = formatNumber(totals.blocks_in_review);
    if ($("admin-qf-lots-ready")) $("admin-qf-lots-ready").textContent = formatNumber(totals.lots_ready_for_final_review);
    if ($("admin-qf-ready")) $("admin-qf-ready").textContent = formatNumber(totals.ready);
    if ($("admin-qf-published")) $("admin-qf-published").textContent = formatNumber(totals.published);

    const batches = Array.isArray(snapshot?.batches) ? snapshot.batches : [];
    if ($("admin-qf-batch-count")) $("admin-qf-batch-count").textContent =
      `${formatNumber(batches.length)} lote${batches.length === 1 ? "" : "s"}`;

    const wrap = $("admin-qf-batches");
    if (!wrap) return;
    if (!batches.length) {
      wrap.innerHTML = '<div class="admin-factory-empty-wide">Nenhum lote criado ainda.</div>';
      return;
    }

    wrap.innerHTML = batches.map(batch => {
      const blocks = Array.isArray(batch.blocks) ? batch.blocks : [];
      const progress = Math.min(100, (Number(batch.question_count || 0) / 1000) * 100);
      const blockCards = [1,2,3,4,5].map(n => {
        const block = blocks.find(x => Number(x.block_number) === n);
        const count = Number(block?.question_count || 0);
        const reviewed = Number(block?.reviewed_count || 0);
        const needs = Number(block?.needs_revision_count || 0);
        const rejected = Number(block?.rejected_count || 0);
        const approved = Number(block?.approved_count || 0);
        const human = block?.human_review_status || "";
        const status = block?.perplexity_review_status || block?.status || "building";
        const qMetric = Array.isArray(state.qfQuality?.blocks)
          ? state.qfQuality.blocks.find(x => Number(x.batch_number) === Number(batch.batch_number) && Number(x.block_number) === n)
          : null;
        const initialQ = qMetric?.initial_quality;
        const postQ = qMetric?.post_correction_quality;
        const finalQ = qMetric?.final_quality;

        return `
          <article class="admin-qf-block-mini admin-qf-block-workflow" data-block-status="${esc(status)}">
            <div class="admin-qf-block-mini-head">
              <div><strong>Bloco ${n}</strong><small>${count}/200 questões</small></div>
              <span class="admin-qf-block-state ${esc(status)}">${esc(qfStatusLabel(status))}</span>
            </div>

            <div class="admin-qf-block-mini-counts">
              <span><b>${reviewed}</b><small>auditadas</small></span>
              <span class="${needs ? "warn" : ""}"><b>${needs}</b><small>a rever</small></span>
              <span class="${rejected ? "danger" : ""}"><b>${rejected}</b><small>rejeitadas</small></span>
              <span><b>${approved}</b><small>OK IA</small></span>
            </div>

            <div class="admin-qf-block-quality-mini">
              <span>Inicial <b>${initialQ == null ? "—" : Number(initialQ).toLocaleString("pt-BR",{maximumFractionDigits:1})+"%"}</b></span>
              <span>Pós-correção <b>${postQ == null ? "—" : Number(postQ).toLocaleString("pt-BR",{maximumFractionDigits:1})+"%"}</b></span>
              <span>Final <b>${finalQ == null ? "—" : Number(finalQ).toLocaleString("pt-BR",{maximumFractionDigits:1})+"%"}</b></span>
            </div>
            <div class="admin-qf-block-pipeline">
              ${qfReviewPill("ChatGPT", block?.chatgpt_review_status)}
              ${qfReviewPill("Perplexity", block?.perplexity_review_status)}
              ${human ? qfReviewPill("Você", human) : '<span class="admin-qf-review-pill">Você: aguardando</span>'}
            </div>

            <div class="admin-qf-block-mini-actions">
              <button class="button secondary" type="button" data-qf-view-block="${Number(batch.batch_number)}:${n}">${needs || rejected ? "Ver pendências" : "Ver bloco"}</button>
              <button class="button secondary" type="button" data-qf-export="${Number(batch.batch_number)}:${n}:blind">Exportar prova cega</button>
              <button class="button secondary" type="button" data-qf-export="${Number(batch.batch_number)}:${n}:audit">Exportar auditoria e pareceres</button>
              <button class="button secondary" type="button" data-qf-import-review="${Number(batch.batch_number)}:${n}">Importar resolução, auditoria ou julgamento</button>
              ${needs || rejected ? `<button class="button secondary admin-qf-correction-import" type="button" data-qf-import-correction="${Number(batch.batch_number)}:${n}">Importar correção ChatGPT</button>` : ""}
            </div>

            ${human === "pending" ? `
              <div class="admin-qf-human-gate">
                <span>Sua validação</span>
                <div>
                  <button class="button primary" type="button" data-qf-human-review="${Number(batch.batch_number)}:${n}:approved">SIM · enviar ao lote</button>
                  <button class="button secondary" type="button" data-qf-human-review="${Number(batch.batch_number)}:${n}:rejected">NÃO</button>
                </div>
              </div>
            ` : human === "approved" ? '<div class="admin-qf-human-approved">✓ Aprovado por você · entrou no lote</div>' : ""}
          </article>
        `;
      }).join("");

      return `
        <article class="admin-qf-batch-card">
          <div class="admin-qf-batch-card-head">
            <div>
              <strong>Lote ${String(Number(batch.batch_number || 0)).padStart(3,"0")}</strong>
              <small>${formatNumber(batch.question_count)} de 1.000 questões</small>
            </div>
            <span class="admin-factory-badge">${esc(qfStatusLabel(batch.status))}</span>
          </div>
          <div class="admin-qf-batch-progress" aria-hidden="true"><span style="width:${progress.toFixed(1)}%"></span></div>
          <div class="admin-qf-block-grid">${blockCards}</div>
          <div class="admin-qf-final-review">
            <span>Revisão final</span>
            <strong>ChatGPT + Perplexity + Gemini</strong>
            <div>
              ${qfReviewPill("ChatGPT", batch.final_review_chatgpt_status)}
              ${qfReviewPill("Perplexity", batch.final_review_perplexity_status)}
              ${qfReviewPill("Gemini", batch.final_review_gemini_status)}
              ${qfReviewPill("Você", batch.final_human_review_status)}
            </div>
          </div>
          <div class="admin-qf-batch-actions">
            <button class="button secondary admin-qf-open-batch" type="button" data-qf-batch="${Number(batch.batch_number)}">Ver questões</button>
            <button class="button secondary" type="button" data-qf-export="${Number(batch.batch_number)}:0:audit">Exportar lote completo</button>
            ${batch.final_review_chatgpt_status === "approved" && batch.final_review_perplexity_status === "approved" && batch.final_review_gemini_status === "approved" && batch.final_human_review_status !== "approved" ? `<button class="button primary" type="button" data-qf-final-approve="${Number(batch.batch_number)}">Aprovar lote final</button>` : ""}
            <button class="button secondary" type="button" data-qf-import-lot="${Number(batch.batch_number)}">Importar revisão final</button>
          </div>
        </article>
      `;
    }).join("");
  }

  async function loadQuestionFactory() {
    const { data, error } = await sb.rpc("admin_question_factory_snapshot");
    if (error) {
      console.warn("Não foi possível carregar a fábrica de questões:", error);
      return;
    }
    renderQuestionFactory(data || {});
  }

  function renderQuestionFactoryQuality(data) {
    state.qfQuality = data || {};
    const overall = data?.overall || {};
    const pct = value => value == null ? "—" : Number(value).toLocaleString("pt-BR",{maximumFractionDigits:1})+"%";
    const qualityLabel = value => {
      if (value == null) return "Sem nota";
      const n = Number(value);
      if (n >= 98) return "Excelente";
      if (n >= 97) return "Aprovado";
      if (n >= 90) return "Quase lá · revisar";
      if (n >= 80) return "Bom · revisar";
      if (n >= 70) return "Atenção";
      return "Crítico";
    };

    if ($("admin-qf-quality-initial")) $("admin-qf-quality-initial").textContent = pct(overall.avg_initial_quality);
    if ($("admin-qf-quality-post")) $("admin-qf-quality-post").textContent = pct(overall.avg_post_correction_quality);
    if ($("admin-qf-quality-final")) $("admin-qf-quality-final").textContent = pct(overall.avg_final_quality);
    if ($("admin-qf-quality-first-pass")) $("admin-qf-quality-first-pass").textContent = pct(overall.first_pass_approval_rate);
    if ($("admin-qf-quality-reaudit")) $("admin-qf-quality-reaudit").textContent = pct(overall.reaudit_approval_rate);

    const wrap = $("admin-qf-quality-chart");
    const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
    if (wrap) {
      wrap.innerHTML = blocks.length ? blocks.map(b => {
        const initial = Number(b.initial_quality || 0);
        const post = Number(b.post_correction_quality || 0);
        const final = Number(b.final_quality || 0);
        const label = `L${String(Number(b.batch_number||0)).padStart(3,"0")} · Bloco ${Number(b.block_number||0)}`;
        return `
          <article class="admin-qf-quality-row">
            <div class="admin-qf-quality-row-head">
              <strong>${esc(label)}</strong>
              <span>${b.final_quality == null ? "Sem nota final" : pct(b.final_quality)+" · "+qualityLabel(b.final_quality)}</span>
            </div>
            <div class="admin-qf-quality-bars">
              <div><small>Inicial</small><span><i style="width:${Math.max(0,Math.min(100,initial))}%"></i></span><b>${b.initial_quality == null ? "—" : pct(b.initial_quality)}</b></div>
              <div><small>Pós-correção</small><span><i style="width:${Math.max(0,Math.min(100,post))}%"></i></span><b>${b.post_correction_quality == null ? "—" : pct(b.post_correction_quality)}</b></div>
              <div><small>Final</small><span><i style="width:${Math.max(0,Math.min(100,final))}%"></i></span><b>${b.final_quality == null ? "—" : pct(b.final_quality)}</b></div>
            </div>
            <div class="admin-qf-quality-row-meta">
              <span>${formatNumber(b.approved_count)} aprovadas</span>
              <span>${formatNumber(b.needs_revision_count)} a rever</span>
              <span>${formatNumber(b.rejected_count)} rejeitadas</span>
            </div>
          </article>
        `;
      }).join("") : '<div class="admin-factory-empty-wide">Ainda sem blocos auditados.</div>';
    }

    if (state.questionFactory) renderQuestionFactory(state.questionFactory);
  }

  async function loadQuestionFactoryQuality() {
    const { data, error } = await sb.rpc("admin_question_factory_quality_snapshot");
    if (error) {
      console.warn("Não foi possível carregar qualidade dos blocos:", error);
      return;
    }
    renderQuestionFactoryQuality(data || {});
  }

  async function openQuestionFactoryBlock(batchNumber, blockNumber, issuesOnly = false) {
    const { data, error } = await sb.rpc("admin_question_factory_block", {
      p_batch_number: Number(batchNumber),
      p_block_number: Number(blockNumber),
      p_only_issues: Boolean(issuesOnly)
    });
    const dialog = $("admin-qf-dialog");
    const list = $("admin-qf-question-list");
    if (dialog && !dialog.open) dialog.showModal();
    if (error) {
      if (list) list.innerHTML = '<div class="admin-factory-empty-wide">Não foi possível carregar este bloco.</div>';
      return;
    }

    const questions = Array.isArray(data?.questions) ? data.questions : [];
    if ($("admin-qf-dialog-title")) $("admin-qf-dialog-title").textContent = `Lote ${String(Number(batchNumber)).padStart(3,"0")} · Bloco ${blockNumber}`;
    if ($("admin-qf-dialog-meta")) {
      const c = data?.counts || {};
      $("admin-qf-dialog-meta").textContent = `${formatNumber(c.total)} questões · ${formatNumber(c.needs_revision)} a rever · ${formatNumber(c.rejected)} rejeitadas`;
    }
    if ($("admin-qf-page-info")) $("admin-qf-page-info").textContent = issuesOnly ? `${questions.length} pendências` : `${questions.length} questões`;

    if (list) {
      list.innerHTML = questions.length ? questions.map(q => {
        const review = q.latest_review || {};
        const score = q.quality_score == null ? "—" : Number(q.quality_score).toLocaleString("pt-BR",{maximumFractionDigits:1})+"%";
        return `
          <details class="admin-qf-question">
            <summary>
              <span class="admin-qf-question-code">${esc(q.question_code || q.question_id || "Questão")}</span>
              <div class="admin-qf-question-title">
                <strong>${esc(q.enunciado || "")}</strong>
                <small>${esc(q.exam_style || "—")} · ${esc(q.area || "—")} · v${esc(q.version || 1)}</small>
              </div>
              <div class="admin-qf-review-pills">
                <span class="admin-qf-review-pill ${esc(q.block_review_status || "")}">Qualidade: ${esc(score)}</span>
                ${qfReviewPill("Status", q.block_review_status)}
              </div>
            </summary>
            <div class="admin-qf-question-body">
              <p>${esc(q.enunciado || "")}</p>
              <div class="admin-qf-alternatives">
                ${["A","B","C","D"].map(letter => {
                  const val=q["alternativa_"+letter.toLowerCase()]||"";
                  return '<div class="admin-qf-alt '+(q.gabarito===letter?"correct":"")+'"><strong>'+letter+'</strong> — '+esc(val)+'</div>';
                }).join("")}
              </div>
              <div class="admin-qf-bad-reason">
                <strong>Parecer mais recente</strong>
                <span>${esc(review.suggested_correction || q.block_review_notes || "Sem observação registrada.")}</span>
                ${review.style_issue ? `<small>Estilo: ${esc(review.style_issue)}</small>` : ""}
                ${review.answer_source_issue ? `<small>Fonte do gabarito: ${esc(review.answer_source_issue)}</small>` : ""}
              </div>
              <div class="admin-qf-answer-source">
                <strong>Fonte do gabarito</strong>
                <span>${esc(q.answer_source_institution || "—")} · ${esc(q.answer_source_document || "—")} · ${esc(q.answer_source_year || "—")}</span>
              </div>
            </div>
          </details>
        `;
      }).join("") : '<div class="admin-factory-empty-wide">Nenhuma questão neste filtro.</div>';
    }
    if ($("admin-qf-prev")) $("admin-qf-prev").disabled = true;
    if ($("admin-qf-next")) $("admin-qf-next").disabled = true;
  }

  function openReviewImportDialog(batchNumber, blockNumber = null, mode = "block") {
    state.qfReviewImportBatch = Number(batchNumber);
    state.qfReviewImportBlock = blockNumber == null ? null : Number(blockNumber);
    state.qfReviewImportMode = mode;

    if ($("admin-qf-review-import-meta")) {
      $("admin-qf-review-import-meta").textContent = mode === "metrics"
        ? "Cole qualquer JSON da fábrica que contenha stage_metrics. Esta opção atualiza apenas a telemetria operacional."
        : mode === "calibration" ? "Cole a auditoria bruta do prompt com FINAL_PROMPT_SCORE, componentes e evidências primárias." : mode === "lot"
        ? `Lote ${String(Number(batchNumber)).padStart(3,"0")} · cole o JSON da revisão final das 1.000.`
        : mode === "correction"
          ? `Lote ${String(Number(batchNumber)).padStart(3,"0")} · Bloco ${blockNumber} · cole o JSON das correções do ChatGPT.`
          : `Lote ${String(Number(batchNumber)).padStart(3,"0")} · Bloco ${blockNumber} · cole o JSON da revisão.`;
    }
    if ($("admin-qf-review-import-json")) $("admin-qf-review-import-json").value = "";
    if ($("admin-qf-review-import-message")) $("admin-qf-review-import-message").textContent = "";
    $("admin-qf-review-import-dialog")?.showModal();
  }

  async function submitReviewImport() {
    const box = $("admin-qf-review-import-json");
    const message = $("admin-qf-review-import-message");
    let payload;
    try {
      payload = JSON.parse(box?.value || "");
    } catch {
      if (message) message.textContent = "JSON inválido.";
      return;
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      if (message) message.textContent = "Informe um objeto JSON.";
      return;
    }
    if (state.qfReviewImportMode === "metrics") {
      if (!payload.stage_metrics || typeof payload.stage_metrics !== "object") {
        if (message) message.textContent = "O JSON não contém stage_metrics.";
        return;
      }
      const { data: telemetryData, error: telemetryError } = await sb.rpc(
        "admin_import_question_factory_stage_metrics",
        { p_payload: payload }
      );
      if (telemetryError) {
        if (message) message.textContent = telemetryError.message || "Não foi possível atualizar a etapa.";
        return;
      }
      if (message) {
        message.textContent = telemetryData?.stored
          ? "Métricas da etapa atualizadas no Supabase e no dashboard."
          : "Nenhuma métrica foi gravada.";
      }
      await Promise.all([loadQuestionFactoryStyles(),loadQuestionFactoryBlockTracker(),loadQuestionFactoryQuality()]);
      return;
    }

    if (payload.review_stage !== "prompt_calibration" && (Number(payload.batch_number) !== state.qfReviewImportBatch || (state.qfReviewImportMode !== "lot" && Number(payload.block_number) !== state.qfReviewImportBlock))) {
      if (message) message.textContent = "O lote/bloco do JSON não corresponde ao selecionado. Confira o arquivo; os IDs não serão substituídos.";
      return;
    }

    const rpcName = payload.review_stage === "prompt_calibration"
      ? "admin_import_question_factory_calibration"
      : payload.review_stage === "chatgpt_adjudication"
        ? "admin_import_question_factory_adjudication"
        : state.qfReviewImportMode === "lot"
          ? "admin_import_question_factory_lot_review"
          : state.qfReviewImportMode === "correction"
            ? "admin_import_question_factory_corrections"
            : "admin_import_question_factory_review";

    const { data, error } = await sb.rpc(rpcName, { p_payload: payload });
    if (error) {
      if (message) message.textContent = error.message || "Não foi possível importar.";
      return;
    }

    let telemetryStored = false;
    if (payload.stage_metrics && typeof payload.stage_metrics === "object") {
      const { data: telemetryData, error: telemetryError } = await sb.rpc(
        "admin_import_question_factory_stage_metrics",
        { p_payload: payload }
      );
      if (telemetryError) {
        console.warn("Etapa importada, mas a telemetria não pôde ser registrada:", telemetryError);
      } else {
        telemetryStored = Boolean(telemetryData?.stored);
      }
    }

    if (
      payload.style_score != null
      || payload.style_confidence_score != null
    ) {
      const { error: calibrationError } = await sb.rpc(
        "admin_update_question_factory_style_calibration",
        { p_payload: payload }
      );

      if (calibrationError) {
        console.warn("Auditoria importada, mas a calibração editorial ao vivo não pôde ser atualizada:", calibrationError);
      }
    }

    if (message) {
      const baseMessage = payload.review_stage === "prompt_calibration" ? "Calibração registrada." : payload.review_stage === "chatgpt_adjudication" ? `Julgamentos importados: ${data?.decisions_imported || 0}.` : state.qfReviewImportMode === "lot"
        ? (data?.ready ? "Revisão final importada. Lote marcado como pronto." : "Revisão final importada. O lote ainda possui etapa pendente.")
        : state.qfReviewImportMode === "correction"
          ? `Correções importadas: ${data?.corrected || 0}. Próxima etapa: nova resolução cega e reauditoria Perplexity.`
          : `Importadas ${data?.imported || 0}: ${data?.approved || 0} aprovadas, ${data?.needs_revision || 0} a rever.`;
      message.textContent = telemetryStored
        ? `${baseMessage} Métricas da etapa atualizadas no dashboard.`
        : baseMessage;
    }

    await Promise.all([loadQuestionFactory(),loadQuestionFactoryStyles(),loadQuestionFactoryBlockTracker(),loadQuestionFactoryQuality(),loadBadQuestionFolder(0)]);
  }

  async function setHumanBlockReview(batchNumber, blockNumber, decision) {
    const yes = decision === "approved";
    const message = yes
      ? "Confirmar que este bloco está bom e pode entrar no lote de 1.000?"
      : "Marcar este bloco para nova correção?";
    if (!window.confirm(message)) return;

    const { error } = await sb.rpc("admin_set_question_factory_block_human_review", {
      p_batch_number: Number(batchNumber),
      p_block_number: Number(blockNumber),
      p_decision: decision,
      p_notes: null
    });
    if (error) {
      window.alert(error.message || "Não foi possível registrar sua decisão.");
      return;
    }
    await Promise.all([loadQuestionFactory(),loadQuestionFactoryStyles(),loadQuestionFactoryBlockTracker(),loadQuestionFactoryQuality()]);
  }

  function buildBoardGenerationPrompt(item, context = {}) {
    return window.LuriaQuestionPrompts.generation(item, context);
  }

  function buildBoardSegmentPrompt(item, stage, context = {}) {
    return window.LuriaQuestionPrompts.segment(item, stage, context);
  }

  function questionFactoryStageMeta(stage) {
    const map = {
      generation: { label: "Geração", provider: "chatgpt" },
      blind_resolution: { label: "Resolução cega", provider: "perplexity" },
      chatgpt_initial: { label: "Revisão adversarial", provider: "chatgpt" },
      perplexity_initial: { label: "Auditoria Perplexity", provider: "perplexity" },
      chatgpt_adjudication: { label: "Julgar parecer", provider: "chatgpt" },
      chatgpt_correction: { label: "Correção ChatGPT", provider: "chatgpt" },
      perplexity_reaudit: { label: "Reauditoria Perplexity", provider: "perplexity" },
      human_review: { label: "Aprovação humana", provider: null },
      block_complete: { label: "Bloco concluído", provider: null }
    };
    return map[stage] || { label: stage || "Pendente", provider: null };
  }

  function questionFactoryBlockPrompt(block) {
    const style = state.questionStyles.find(x => x.exam_style === block.exam_style);
    if (!style) return "";

    if (block.next_stage === "generation") {
      return buildBoardGenerationPrompt(style, block);
    }

    if (["human_review","block_complete"].includes(block.next_stage)) {
      return "";
    }

    return buildBoardSegmentPrompt(style, block.next_stage, block);
  }

  function renderQuestionFactoryBlockTracker(rows) {
    state.qfBlockTracker = Array.isArray(rows) ? rows : [];
    const wrap = $("admin-qf-block-tracker");
    const count = $("admin-qf-block-tracker-count");
    if (count) count.textContent = `${state.qfBlockTracker.length} bloco${state.qfBlockTracker.length === 1 ? "" : "s"}`;
    if (!wrap) return;

    if (!state.qfBlockTracker.length) {
      wrap.innerHTML = '<div class="admin-factory-empty-wide">Nenhum bloco criado ainda.</div>';
      return;
    }

    wrap.innerHTML = state.qfBlockTracker.map((block,index) => {
      const meta = questionFactoryStageMeta(block.next_stage);
      const prompt = questionFactoryBlockPrompt(block);
      const pid = `qf-next-block-${Number(block.batch_number||0)}-${Number(block.block_number||0)}-${index}`;
      const reliability = block.reliability_score == null
        ? "—"
        : `${Number(block.reliability_score).toLocaleString("pt-BR",{maximumFractionDigits:0})}%`;
      const styleScore = block.style_score == null
        ? "—"
        : `${Number(block.style_score).toLocaleString("pt-BR",{maximumFractionDigits:1})}/10`;
      const provider = block.next_provider || meta.provider;

      return `
        <article class="admin-qf-tracker-row">
          <div class="admin-qf-tracker-main">
            <strong>L${String(Number(block.batch_number||0)).padStart(3,"0")} · Bloco ${Number(block.block_number||0)}</strong>
            <small>${Number(block.question_count||0)}/${Number(block.target_size||200)} questões</small>
          </div>
          <div><span>Banca</span><strong>${esc(block.exam_style || "—")}</strong></div>
          <div><span>Fase</span><strong>${esc(block.phase || meta.label)}</strong></div>
          <div><span>Fidelidade</span><strong>${esc(styleScore)}</strong></div>
          <div><span>Confiabilidade</span><strong title="${esc(block.style_score_note || "")}">${esc(reliability)}</strong></div>
          <div class="admin-qf-tracker-next">
            <span>Próximo prompt</span>
            ${prompt ? `
              <div class="admin-qf-tracker-prompt-actions">
                <button class="button secondary admin-qf-copy-inline" type="button" data-inline-prompt="${esc(pid)}">${esc(meta.label)} · copiar</button>
                ${provider ? `<button class="button primary admin-qf-ai-inline" type="button" data-inline-prompt="${esc(pid)}" data-ai-provider="${esc(provider)}">Abrir ${provider === "gemini" ? "Gemini" : provider === "perplexity" ? "Perplexity" : "ChatGPT"}</button>` : ""}
              </div>
              <pre id="${esc(pid)}" class="admin-qf-prompt admin-qf-tracker-hidden-prompt">${esc(prompt)}</pre>
            ` : '<strong class="admin-qf-tracker-no-prompt">Sem prompt automático nesta fase</strong>'}
          </div>
        </article>
      `;
    }).join("");
  }

  async function loadQuestionFactoryBlockTracker() {
    const { data, error } = await sb.rpc("admin_question_factory_block_tracker");
    if (error) {
      console.warn("Não foi possível carregar o acompanhamento dos blocos:", error);
      return;
    }
    renderQuestionFactoryBlockTracker(data || []);
  }

  function renderQuestionFactoryStyles(styles) {
    state.questionStyles = Array.isArray(styles) ? styles : [];
    if (Array.isArray(state.qfBlockTracker)) {
      renderQuestionFactoryBlockTracker(state.qfBlockTracker);
    }

    const dash = $("admin-qf-style-dashboard");
    const manual = $("admin-qf-style-manual");
    const count = $("admin-qf-style-count");

    if (count) {
      count.textContent = `${state.questionStyles.length} banca${state.questionStyles.length === 1 ? "" : "s"}`;
    }

    if (dash) {
      dash.innerHTML = state.questionStyles.length ? state.questionStyles.map((item,index) => {
        const score = item.style_score == null ? "calibrando" : `${Number(item.style_score).toLocaleString("pt-BR",{maximumFractionDigits:1})}/10`;
        const reliability = item.style_confidence_score == null ? null : Number(item.style_confidence_score);
        const scoreValue = item.style_score == null ? "—" : Number(item.style_score).toLocaleString("pt-BR",{maximumFractionDigits:1});
        const confidenceValue = reliability == null ? "—" : `${reliability.toLocaleString("pt-BR",{maximumFractionDigits:0})}%`;
        const calibration = item.prompt_calibration && typeof item.prompt_calibration === "object" ? item.prompt_calibration : {};
        const roundLabel = calibration.round ? String(calibration.round) : "";
        const decision = String(calibration.decision || "").toUpperCase();
        const calibrated = item.final_prompt_score != null && Number(item.final_prompt_score) >= 84;
        const calibrationStatus = item.final_prompt_score == null
          ? "Calibração do prompt pendente"
          : (calibrated ? "Prompt calibrado · " : "Prompt a revisar · ") + item.final_prompt_score + "/100";
        const calibrationMeta = [
          roundLabel ? "Rodada " + roundLabel : "",
          decision || "",
          item.updated_at ? "Atualizado " + formatDateTime(item.updated_at) : ""
        ].filter(Boolean).join(" · ");
        const historicalBest = calibration.highest_historical_style_score != null
          ? "Melhor histórico: " + Number(calibration.highest_historical_style_score).toLocaleString("pt-BR",{maximumFractionDigits:1}) + "/100" + (calibration.highest_historical_version ? " · " + calibration.highest_historical_version : "")
          : "";
        const latestStage = item.latest_stage_metrics && typeof item.latest_stage_metrics === "object"
          ? item.latest_stage_metrics
          : null;
        const latestStageSummary = latestStage
          ? [
              latestStage.stage || "etapa",
              latestStage.provider || "",
              latestStage.score == null ? "" : Number(latestStage.score).toLocaleString("pt-BR",{maximumFractionDigits:1}) + "/100",
              latestStage.total_count ? Number(latestStage.total_count) + " itens" : "",
              latestStage.hard_reject_count ? Number(latestStage.hard_reject_count) + " hard reject" + (Number(latestStage.hard_reject_count) === 1 ? "" : "s") : "",
              latestStage.created_at ? formatDateTime(latestStage.created_at) : ""
            ].filter(Boolean).join(" · ")
          : "";
        const slug = String(item.exam_style || `banca-${index+1}`).replace(/[^a-z0-9]/gi,"-").toLowerCase();
        const masterPromptId = `qf-dashboard-${slug}-master`;
        const promptStages = [
          ["00","Calibrar prompt editorial","prompt_calibration","perplexity"],
          ["01","Prompt mestre · geração",null,"chatgpt"],
          ["02A","Perplexity · resolução cega","blind_resolution","perplexity"],
          ["02","ChatGPT · revisão adversarial","chatgpt_initial","chatgpt"],
          ["03","Perplexity · auditoria","perplexity_initial","perplexity"],
          ["04","ChatGPT · julgar parecer","chatgpt_adjudication","chatgpt"],
          ["05","ChatGPT · corrigir consenso","chatgpt_correction","chatgpt"],
          ["06","Perplexity · reauditoria","perplexity_reaudit","perplexity"],
          ["07A","ChatGPT · revisão global das 1.000","lot_chatgpt_final","chatgpt"],
          ["07B","Perplexity · auditoria final das 1.000","lot_perplexity_final","perplexity"],
                  ["07C","Gemini · auditoria adversarial","lot_gemini_final","gemini"]
        ];
        return `
          <article class="admin-qf-style-card">
            <div class="admin-qf-style-card-head">
              <div>
                <strong>${esc(item.exam_style)}</strong>
                <small>${esc(item.organizing_body || "Perfil editorial")}</small>
              </div>
              <div class="admin-qf-style-score-panel" title="${esc(item.style_score_note || "")}">
                <span class="admin-qf-style-score">
                  <small>Fidelidade editorial</small>
                  <strong>${esc(scoreValue)}<em>/10</em></strong>
                </span>
                <span class="admin-qf-style-score">
                  <small>Confiança da calibração</small>
                  <strong>${esc(confidenceValue)}</strong>
                </span>
                <span class="admin-qf-style-score-status">${esc(calibrationStatus)}</span>
                ${calibrationMeta ? `<span class="admin-qf-style-score-status">${esc(calibrationMeta)}</span>` : ""}
                ${historicalBest ? `<span class="admin-qf-style-score-status">${esc(historicalBest)}</span>` : ""}
                ${latestStageSummary ? `<span class="admin-qf-style-score-status">Última etapa · ${esc(latestStageSummary)}</span>` : ""}
              </div>
            </div>
            <div class="admin-qf-style-total">
              <strong>${formatNumber(item.total)}</strong>
              <span>questões</span>
            </div>
            <div class="admin-qf-style-stages">
              <span class="admin-qf-style-stage">
                <b>${formatNumber(item.generated)}</b>
                <small>Geradas</small>
              </span>
              <span class="admin-qf-style-stage">
                <b>${formatNumber(item.perplexity_seen)}</b>
                <small>Vistas pelo Perplexity</small>
              </span>
              <span class="admin-qf-style-stage correction">
                <b>${formatNumber(item.in_correction)}</b>
                <small>Em correção</small>
                ${Array.isArray(item.correction_blocks) && item.correction_blocks.length ? `
                  <em class="admin-qf-correction-blocks">
                    ${item.correction_blocks
                      .slice()
                      .sort((a,b)=>(Number(a.batch_number||0)-Number(b.batch_number||0)) || (Number(a.block_number||0)-Number(b.block_number||0)))
                      .map(x => `<i>L${String(Number(x.batch_number||0)).padStart(3,"0")} · B${Number(x.block_number||0)} <strong>${formatNumber(x.count)}</strong></i>`)
                      .join("")}
                  </em>
                ` : ""}
              </span>
              <span class="admin-qf-style-stage">
                <b>${formatNumber(item.blocks_ok)}</b>
                <small>Blocos OK</small>
              </span>
              <span class="admin-qf-style-stage">
                <b>${formatNumber(item.lots_in_final_review)}</b>
                <small>Lotes em revisão final</small>
              </span>
              <span class="admin-qf-style-stage ready">
                <b>${formatNumber(item.ready)}</b>
                <small>Prontas</small>
              </span>
            </div>

            <details class="admin-qf-style-prompts">
              <summary>
                <span>Prompts da banca</span>
                <small>Abrir geração, auditorias e revisões</small>
              </summary>
              <div class="admin-qf-style-prompts-body">
                ${promptStages.map(([num,label,stage,provider]) => {
                  const pid = stage
                    ? `qf-dashboard-${slug}-${stage}`
                    : masterPromptId;
                  const promptText = stage
                    ? buildBoardSegmentPrompt(item,stage)
                    : buildBoardGenerationPrompt(item);
                  return `
                    <details class="admin-qf-style-prompt-item">
                      <summary><b>${esc(num)}</b><span>${esc(label)}</span></summary>
                      <div>
                        <div class="admin-qf-style-prompt-actions">
                          <button class="button secondary admin-qf-copy-inline" type="button" data-inline-prompt="${esc(pid)}">Copiar</button>
                          <button class="button primary admin-qf-ai-inline" type="button" data-inline-prompt="${esc(pid)}" data-ai-provider="${provider}">Abrir ${provider === "gemini" ? "Gemini" : provider === "perplexity" ? "Perplexity" : "ChatGPT"}</button>
                        </div>
                        <pre id="${esc(pid)}" class="admin-qf-prompt">${esc(promptText)}</pre>
                      </div>
                    </details>
                  `;
                }).join("")}
              </div>
            </details>
          </article>
        `;
      }).join("") : '<div class="admin-factory-empty-wide">Nenhum perfil de banca configurado.</div>';
    }

    if (manual) {
      manual.innerHTML = state.questionStyles.length ? state.questionStyles.map((item,index) => {
        const score = item.style_score == null ? "Em calibração" : `Fidelidade atual: ${Number(item.style_score).toLocaleString("pt-BR",{maximumFractionDigits:1})}/10`;
        const url = String(item.style_reference_url || "").startsWith("https://") ? item.style_reference_url : "";
        return `
          <details class="admin-qf-board-manual">
            <summary>
              <div>
                <span class="admin-qf-board-index">${String(index+1).padStart(2,"0")}</span>
                <div>
                  <strong>${esc(item.exam_style)}</strong>
                  <small>${esc(item.organizing_body || "")}</small>
                </div>
              </div>
              <span class="admin-qf-board-score">${esc(score)}</span>
            </summary>
            <div class="admin-qf-board-content">
              <section class="admin-qf-board-origin">
                <div>
                  <span class="eyebrow">De onde aprender o estilo</span>
                  <p>${esc(item.calibration_source_note || "Usar provas públicas recentes e edital vigente.")}</p>
                  <small>Anos de referência: ${esc(item.reference_years || "atualizar antes da geração")}</small>
                </div>
                <div class="admin-qf-board-actions">
                  <button class="button primary admin-qf-copy-board" type="button" data-style-copy-index="${index}">Copiar tudo desta banca</button>
                  <button class="button secondary admin-qf-ai-open" type="button" data-style-ai-index="${index}" data-ai-provider="chatgpt">Abrir ChatGPT</button>
                  <button class="button secondary admin-qf-ai-open" type="button" data-style-ai-index="${index}" data-ai-provider="perplexity">Abrir Perplexity</button>
                  ${url ? `<a class="button secondary" href="${esc(url)}" target="_blank" rel="noopener">Fonte oficial</a>` : ""}
                </div>
              </section>

              <div class="admin-qf-board-specs">
                <article><span>Enunciado</span><strong>${esc(item.average_stem_length || "—")}</strong></article>
                <article><span>Casos clínicos</span><strong>${esc(item.case_based_question_rate || "—")}</strong></article>
                <article><span>Dificuldade</span><strong>${esc(item.average_difficulty || "—")}</strong></article>
                <article><span>Raciocínio</span><strong>${esc(item.clinical_reasoning_depth || "—")}</strong></article>
                <article><span>Alternativas</span><strong>${esc(item.typical_alternative_length || "—")}</strong></article>
                <article><span>Redação</span><strong>${esc(item.writing_style || "—")}</strong></article>
              </div>

              <div class="admin-qf-board-columns">
                <article>
                  <span class="eyebrow">O que essa banca costuma cobrar</span>
                  <p><b>Tipos:</b> ${esc(item.common_question_types || "—")}</p>
                  <p><b>Contextos:</b> ${esc(item.frequent_contexts || "—")}</p>
                  <p><b>Temas frequentes:</b> ${esc(item.frequent_topics || "—")}</p>
                </article>
                <article>
                  <span class="eyebrow">Como construir os distratores</span>
                  <p>${esc(item.distractor_style || "Usar alternativas plausíveis e apenas uma melhor resposta.")}</p>
                  <p><b>Regra:</b> nenhum distrator deve ser absurdo só para facilitar a questão.</p>
                </article>
              </div>

              <section class="admin-qf-board-instruction">
                <span class="eyebrow">Instrução para a IA gerar a questão</span>
                <p>${esc(item.generation_instructions || item.recommended_generation_rules || "—")}</p>
              </section>

              <section class="admin-qf-board-science">
                <span class="eyebrow">De onde tirar a resposta correta</span>
                <p>${esc(item.scientific_source_strategy || "Usar fontes científicas brasileiras atuais.")}</p>
              </section>

              <section class="admin-qf-board-avoid">
                <span class="eyebrow">O que evitar</span>
                <p>${esc(item.what_to_avoid || "Não copiar questões anteriores nem inventar referências.")}</p>
              </section>

              <section class="admin-qf-board-calibration">
                <span class="eyebrow">Estado da calibração</span>
                <p>${esc(item.calibration_notes || "Perfil ainda sem nota de calibração.")}</p>
              </section>

              <section class="admin-qf-board-master">
                <div class="admin-qf-board-master-head">
                  <div>
                    <span class="eyebrow">Bloco mestre copiável</span>
                    <strong>Prompt completo — ${esc(item.exam_style)}</strong>
                    <small>Este texto é autocontido: pode ser colado em uma nova conversa sem contexto anterior.</small>
                  </div>
                  <div class="admin-qf-master-actions">
                    <button class="button primary admin-qf-copy-board" type="button" data-style-copy-index="${index}">Copiar bloco inteiro</button>
                    <button class="button secondary admin-qf-ai-open" type="button" data-style-ai-index="${index}" data-ai-provider="chatgpt">ChatGPT</button>
                    <button class="button secondary admin-qf-ai-open" type="button" data-style-ai-index="${index}" data-ai-provider="perplexity">Perplexity</button>
                  </div>
                </div>
                <pre class="admin-qf-board-master-text">${esc(buildBoardGenerationPrompt(item))}</pre>
              </section>

              <section class="admin-qf-segment-sequence">
                <div class="admin-qf-segment-sequence-head">
                  <span class="eyebrow">Prompts de segmento · ordem operacional</span>
                  <strong>Fluxo do bloco de 200</strong>
                  <small>Use nesta ordem. Cada retorno JSON pode ser importado e vinculado ao bloco no Supabase.</small>
                </div>
                ${[
                  ["01","ChatGPT · checagem inicial","chatgpt_initial","chatgpt"],
                  ["01B","Perplexity · resolução cega","blind_resolution","perplexity"],
                  ["02","Perplexity · auditoria","perplexity_initial","perplexity"],
                  ["03","ChatGPT · julgar parecer","chatgpt_adjudication","chatgpt"],
                  ["04","ChatGPT · corrigir consenso","chatgpt_correction","chatgpt"],
                  ["05","Perplexity · reauditoria","perplexity_reaudit","perplexity"]
                ].map(([num,label,stage,provider]) => {
                  const pid=`qf-${String(item.exam_style||"style").replace(/[^a-z0-9]/gi,"-").toLowerCase()}-${stage}`;
                  return `
                    <details class="admin-qf-segment-card">
                      <summary><span>${num}</span><strong>${esc(label)}</strong></summary>
                      <div class="admin-qf-segment-card-body">
                        <div class="admin-qf-segment-actions">
                          <button class="button secondary admin-qf-copy-inline" type="button" data-inline-prompt="${esc(pid)}">Copiar</button>
                          <button class="button primary admin-qf-ai-inline" type="button" data-inline-prompt="${esc(pid)}" data-ai-provider="${provider}">Abrir ${provider === "gemini" ? "Gemini" : provider === "perplexity" ? "Perplexity" : "ChatGPT"}</button>
                        </div>
                        <pre id="${esc(pid)}" class="admin-qf-prompt">${esc(buildBoardSegmentPrompt(item,stage))}</pre>
                      </div>
                    </details>
                  `;
                }).join("")}
                <div class="admin-qf-segment-human">
                  <span>06</span>
                  <div><strong>Sua aprovação</strong><small>Quando as 200 estiverem aprovadas na reauditoria, o Admin libera SIM/NÃO. SIM envia o bloco ao lote de 1.000.</small></div>
                </div>
                <div class="admin-qf-segment-human final">
                  <span>07</span>
                  <div><strong>Revisão final das 1.000</strong><small>Somente depois dos cinco blocos aprovados por você. A revisão é global e olha o lote como conjunto.</small></div>
                </div>
                ${[
                  ["07A","ChatGPT · revisão global das 1.000","lot_chatgpt_final","chatgpt"],
                  ["07B","Perplexity · auditoria final das 1.000","lot_perplexity_final","perplexity"],
                  ["07C","Gemini · auditoria adversarial","lot_gemini_final","gemini"]
                ].map(([num,label,stage,provider]) => {
                  const pid=`qf-${String(item.exam_style||"style").replace(/[^a-z0-9]/gi,"-").toLowerCase()}-${stage}`;
                  return `
                    <details class="admin-qf-segment-card final">
                      <summary><span>${num}</span><strong>${esc(label)}</strong></summary>
                      <div class="admin-qf-segment-card-body">
                        <div class="admin-qf-segment-actions">
                          <button class="button secondary admin-qf-copy-inline" type="button" data-inline-prompt="${esc(pid)}">Copiar</button>
                          <button class="button primary admin-qf-ai-inline" type="button" data-inline-prompt="${esc(pid)}" data-ai-provider="${provider}">Abrir ${provider === "gemini" ? "Gemini" : provider === "perplexity" ? "Perplexity" : "ChatGPT"}</button>
                        </div>
                        <pre id="${esc(pid)}" class="admin-qf-prompt">${esc(buildBoardSegmentPrompt(item,stage))}</pre>
                      </div>
                    </details>
                  `;
                }).join("")}
              </section>
            </div>
          </details>
        `;
      }).join("") : '<div class="admin-factory-empty-wide">Nenhum perfil editorial disponível.</div>';
    }
  }

  async function loadQuestionFactoryStyles() {
    const { data, error } = await sb.rpc("admin_question_factory_style_snapshot");
    if (error) {
      console.warn("Não foi possível carregar os perfis de banca:", error);
      return;
    }
    renderQuestionFactoryStyles(data || []);
  }

  function renderQuestionFactoryBatch(data) {
    const questions = Array.isArray(data?.questions) ? data.questions : [];
    state.qfTotal = Number(data?.total || 0);
    const start = state.qfTotal ? Number(data?.offset || 0) + 1 : 0;
    const end = Math.min(Number(data?.offset || 0) + questions.length, state.qfTotal);

    if ($("admin-qf-dialog-title")) $("admin-qf-dialog-title").textContent =
      `Lote ${String(Number(data?.batch_number || 0)).padStart(3,"0")}`;
    if ($("admin-qf-dialog-meta")) $("admin-qf-dialog-meta").textContent =
      `${formatNumber(state.qfTotal)} questões · ${esc(data?.final_review_mode === "double" ? "revisão final dupla" : data?.final_review_mode || "revisão final")}`;
    if ($("admin-qf-page-info")) $("admin-qf-page-info").textContent = `${start}–${end} de ${state.qfTotal}`;

    const list = $("admin-qf-question-list");
    if (list) {
      list.innerHTML = questions.length ? questions.map(q => {
        const code = q.question_code || `Q${String(q.sequence_no || 0).padStart(4,"0")}`;
        const block = q.block_number ? `Bloco ${q.block_number} · ${q.block_sequence_no || "—"}/200` : "Sem bloco";
        return `
          <details class="admin-qf-question">
            <summary>
              <span class="admin-qf-question-code">${esc(code)}</span>
              <div class="admin-qf-question-title">
                <strong>${esc(q.enunciado)}</strong>
                <small>${esc(block)} · ${esc(q.area || "—")} · ${esc(q.tema || "—")}</small>
              </div>
              <div class="admin-qf-review-pills">
                ${qfReviewPill("Perplexity bloco", q.block_review_status)}
                ${qfReviewPill("ChatGPT lote", q.lot_review_chatgpt_status)}
                ${qfReviewPill("Perplexity lote", q.lot_review_perplexity_status)}
              </div>
            </summary>
            <div class="admin-qf-question-body">
              <p>${esc(q.enunciado)}</p>
              <div class="admin-qf-alternatives">
                ${["A","B","C","D"].map(letter => {
                  const val = q["alternativa_"+letter.toLowerCase()] || "";
                  return '<div class="admin-qf-alt '+(q.gabarito === letter ? "correct" : "")+'"><strong>'+letter+'</strong> — '+esc(val)+'</div>';
                }).join("")}
              </div>
              <div class="admin-qf-review-notes">
                <article><strong>Revisão do bloco · Perplexity</strong><small>${esc(q.block_review_notes || "Ainda sem parecer.")}</small></article>
                <article><strong>Revisão final · ChatGPT</strong><small>${esc(q.lot_review_chatgpt_notes || "Ainda sem parecer.")}</small></article>
                <article><strong>Revisão final · Perplexity</strong><small>${esc(q.lot_review_perplexity_notes || "Ainda sem parecer.")}</small></article>
              </div>
              <div class="admin-qf-source">
                <strong>Fonte geral</strong>
                <span>${esc(q.fonte_instituicao || "—")} · ${esc(q.fonte_documento || "—")} · ${esc(q.fonte_ano || "—")}</span>
              </div>
              <div class="admin-qf-answer-source">
                <strong>Fonte do gabarito</strong>
                <span>${esc(q.answer_source_institution || q.fonte_instituicao || "—")} · ${esc(q.answer_source_document || q.fonte_documento || "—")} · ${esc(q.answer_source_year || q.fonte_ano || "—")}</span>
                ${q.answer_source_section ? `<small>Seção: ${esc(q.answer_source_section)}</small>` : ""}
                ${q.answer_source_note ? `<small>${esc(q.answer_source_note)}</small>` : ""}
                ${String(q.answer_source_url || q.fonte_url || "").startsWith("https://") ? `<a href="${esc(q.answer_source_url || q.fonte_url)}" target="_blank" rel="noopener">Abrir fonte do gabarito</a>` : ""}
              </div>
            </div>
          </details>
        `;
      }).join("") : '<div class="admin-factory-empty-wide">Esse lote ainda não possui questões.</div>';
    }

    const prev = $("admin-qf-prev");
    const next = $("admin-qf-next");
    if (prev) prev.disabled = state.qfOffset <= 0;
    if (next) next.disabled = state.qfOffset + state.qfPageSize >= state.qfTotal;
  }

  async function openQuestionFactoryBatch(batchNumber, offset = 0) {
    state.qfBatchNumber = Number(batchNumber);
    state.qfOffset = Math.max(0, Number(offset || 0));
    const dialog = $("admin-qf-dialog");
    if (dialog && !dialog.open) dialog.showModal();
    const list = $("admin-qf-question-list");
    if (list) list.innerHTML = '<div class="admin-factory-empty-wide">Carregando questões...</div>';

    const { data, error } = await sb.rpc("admin_question_factory_batch", {
      p_batch_number: state.qfBatchNumber,
      p_limit: state.qfPageSize,
      p_offset: state.qfOffset
    });
    if (error) {
      console.error(error);
      if (list) list.innerHTML = '<div class="admin-factory-empty-wide">Não foi possível carregar este lote.</div>';
      return;
    }
    renderQuestionFactoryBatch(data || {});
  }

  async function writePromptClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    area.style.pointerEvents = "none";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }

  function openAIProvider(provider) {
    const url = provider === "gemini" ? "https://gemini.google.com/app" : provider === "perplexity"
      ? "https://www.perplexity.ai/"
      : "https://chatgpt.com/";
    return window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyAndOpenAI(text, provider, button) {
    const popup = openAIProvider(provider);
    const original = button?.textContent || (provider === "perplexity" ? "Abrir Perplexity" : "Abrir ChatGPT");

    try {
      await writePromptClipboard(text);
      if (button) {
        button.textContent = "Copiado — cole";
        button.classList.add("success");
        setTimeout(() => {
          button.textContent = original;
          button.classList.remove("success");
        }, 1800);
      }
    } catch (error) {
      console.warn("Falha ao copiar prompt:", error);
      if (button) {
        button.textContent = "Aberto — copie manualmente";
        setTimeout(() => button.textContent = original, 1800);
      }
    }

    if (!popup) {
      window.location.href = provider === "gemini" ? "https://gemini.google.com/app" : provider === "perplexity"
        ? "https://www.perplexity.ai/"
        : "https://chatgpt.com/";
    }
  }

  function enhancePromptLaunchButtons() {
    document.querySelectorAll(".admin-qf-prompt-wrap").forEach(wrap => {
      if (wrap.querySelector(".admin-qf-ai-actions")) return;
      const prompt = wrap.querySelector(".admin-qf-prompt");
      if (!prompt?.id) return;

      const actions = document.createElement("div");
      actions.className = "admin-qf-ai-actions";
      actions.innerHTML = `
        <button class="button secondary admin-qf-ai-prompt" type="button" data-ai-provider="chatgpt" data-ai-target="${esc(prompt.id)}">ChatGPT</button>
        <button class="button secondary admin-qf-ai-prompt" type="button" data-ai-provider="perplexity" data-ai-target="${esc(prompt.id)}">Perplexity</button>
      `;
      wrap.appendChild(actions);
    });
  }

  function renderBadQuestionFolder(data) {
    const total = Number(data?.total || 0);
    state.qfBadTotal = total;
    const items = Array.isArray(data?.items) ? data.items : [];
    const byStyle = Array.isArray(data?.by_style) ? data.by_style : [];
    const start = total ? state.qfBadOffset + 1 : 0;
    const end = Math.min(state.qfBadOffset + items.length, total);

    if ($("admin-qf-bad-count")) $("admin-qf-bad-count").textContent = formatNumber(total);
    if ($("admin-qf-bad-meta")) $("admin-qf-bad-meta").textContent = `${formatNumber(total)} questões arquivadas`;
    if ($("admin-qf-bad-page-info")) $("admin-qf-bad-page-info").textContent = `${start}–${end} de ${total}`;

    const styleBox = $("admin-qf-bad-by-style");
    if (styleBox) {
      styleBox.innerHTML = byStyle.length
        ? byStyle.map(x => `<span><b>${esc(x.exam_style)}</b> ${formatNumber(x.count)}</span>`).join("")
        : '<span class="admin-qf-bad-empty-chip">Nenhuma rejeitada ainda</span>';
    }

    const list = $("admin-qf-bad-list");
    if (list) {
      list.innerHTML = items.length ? items.map(item => {
        const q = item.question_snapshot || {};
        const code = item.question_code || item.question_id || "Questão";
        const stage = qfStatusLabel(item.failure_stage);
        return `
          <details class="admin-qf-question admin-qf-bad-question">
            <summary>
              <span class="admin-qf-question-code">${esc(code)}</span>
              <div class="admin-qf-question-title">
                <strong>${esc(q.enunciado || "Questão sem enunciado no snapshot")}</strong>
                <small>${esc(item.exam_style || "Sem banca")} · Lote ${esc(item.batch_number || "—")} · Bloco ${esc(item.block_number || "—")} · v${esc(item.item_version || 1)}</small>
              </div>
              <span class="admin-qf-review-pill rejected">Rejeitada</span>
            </summary>
            <div class="admin-qf-question-body">
              <div class="admin-qf-bad-reason">
                <strong>Por que foi para a pasta</strong>
                <span>${esc(item.failure_reason || "Rejeitada pela auditoria sem motivo textual registrado.")}</span>
                <small>Etapa: ${esc(item.failure_stage || stage)} · Arquivada em ${esc(formatDateTime(item.archived_at))}</small>
              </div>
              <p>${esc(q.enunciado || "")}</p>
              <div class="admin-qf-alternatives">
                ${["A","B","C","D"].map(letter => {
                  const val = q["alternativa_"+letter.toLowerCase()] || "";
                  return '<div class="admin-qf-alt '+(q.gabarito === letter ? "correct" : "")+'"><strong>'+letter+'</strong> — '+esc(val)+'</div>';
                }).join("")}
              </div>
              <div class="admin-qf-answer-source">
                <strong>Fonte do gabarito da versão rejeitada</strong>
                <span>${esc(q.answer_source_institution || q.fonte_instituicao || "—")} · ${esc(q.answer_source_document || q.fonte_documento || "—")} · ${esc(q.answer_source_year || q.fonte_ano || "—")}</span>
                ${q.answer_source_note ? `<small>${esc(q.answer_source_note)}</small>` : ""}
              </div>
            </div>
          </details>
        `;
      }).join("") : '<div class="admin-factory-empty-wide">Nenhuma questão ruim arquivada.</div>';
    }

    if ($("admin-qf-bad-prev")) $("admin-qf-bad-prev").disabled = state.qfBadOffset <= 0;
    if ($("admin-qf-bad-next")) $("admin-qf-bad-next").disabled = state.qfBadOffset + state.qfBadPageSize >= total;
  }

  async function loadBadQuestionFolder(offset = 0) {
    state.qfBadOffset = Math.max(0, Number(offset || 0));
    const { data, error } = await sb.rpc("admin_question_factory_bad_items", {
      p_limit: state.qfBadPageSize,
      p_offset: state.qfBadOffset
    });

    if (error) {
      console.warn("Não foi possível carregar a pasta de questões ruins:", error);
      return;
    }
    renderBadQuestionFolder(data || {});
  }

  async function copyAdminPrompt(targetId, button) {
    const target = $(targetId);
    if (!target) return;

    const text = target.textContent || "";
    const original = button?.textContent || "Copiar prompt";

    try {
      await writePromptClipboard(text);

      if (button) {
        button.textContent = "Copiado";
        button.classList.add("success");
        setTimeout(() => {
          button.textContent = original;
          button.classList.remove("success");
        }, 1200);
      }
    } catch (error) {
      console.warn("Falha ao copiar prompt:", error);
      if (button) {
        button.textContent = "Selecione e copie";
        setTimeout(() => {
          button.textContent = original;
        }, 1500);
      }
    }
  }

  function wire() {
    wireAdminViewMenu();
    $("admin-qf-style-manual")?.addEventListener("click", async event => {
      const aiButton = event.target.closest("[data-style-ai-index]");
      if (aiButton) {
        event.preventDefault();
        event.stopPropagation();
        const index = Number(aiButton.dataset.styleAiIndex);
        const item = state.questionStyles[index];
        if (!item) return;
        const text = buildBoardGenerationPrompt(item);
        await copyAndOpenAI(text, aiButton.dataset.aiProvider, aiButton);
        return;
      }

      const button = event.target.closest("[data-style-copy-index]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();

      const index = Number(button.dataset.styleCopyIndex);
      const item = state.questionStyles[index];
      if (!item) return;

      const text = buildBoardGenerationPrompt(item);
      const original = button.textContent || "Copiar tudo desta banca";

      try {
        await writePromptClipboard(text);

        document.querySelectorAll(`[data-style-copy-index="${index}"]`).forEach(el => {
          if (!el.dataset.originalLabel) el.dataset.originalLabel = el.textContent || "Copiar";
          el.textContent = "Bloco copiado";
          el.classList.add("success");
        });

        setTimeout(() => {
          document.querySelectorAll(`[data-style-copy-index="${index}"]`).forEach(el => {
            el.textContent = el.dataset.originalLabel || original;
            el.classList.remove("success");
          });
        }, 1400);
      } catch (error) {
        console.warn("Falha ao copiar bloco da banca:", error);
      }
    });

    enhancePromptLaunchButtons();

    document.querySelectorAll(".admin-qf-copy").forEach(button => {
      button.addEventListener("click", () => copyAdminPrompt(button.dataset.copyTarget, button));
    });

    document.querySelectorAll(".admin-qf-ai-prompt").forEach(button => {
      button.addEventListener("click", async () => {
        const target = $(button.dataset.aiTarget);
        if (!target) return;
        await copyAndOpenAI(target.textContent || "", button.dataset.aiProvider, button);
      });
    });

    ["admin-qf-style-dashboard","admin-qf-style-manual","admin-qf-block-tracker"].forEach(containerId => {
      $(containerId)?.addEventListener("click", async event => {
        const copy = event.target.closest("[data-inline-prompt].admin-qf-copy-inline");
        if (copy) {
          const target = $(copy.dataset.inlinePrompt);
          if (target) await copyAdminPrompt(copy.dataset.inlinePrompt, copy);
          return;
        }
        const ai = event.target.closest("[data-inline-prompt].admin-qf-ai-inline");
        if (ai) {
          const target = $(ai.dataset.inlinePrompt);
          if (target) await copyAndOpenAI(target.textContent || "", ai.dataset.aiProvider, ai);
        }
      });
    });

    $("admin-qf-bad-open")?.addEventListener("click", async () => {
      await loadBadQuestionFolder(0);
      $("admin-qf-bad-dialog")?.showModal();
    });
    $("admin-qf-bad-close")?.addEventListener("click", () => $("admin-qf-bad-dialog")?.close());
    $("admin-qf-bad-prev")?.addEventListener("click", () => loadBadQuestionFolder(Math.max(0,state.qfBadOffset-state.qfBadPageSize)));
    $("admin-qf-bad-next")?.addEventListener("click", () => loadBadQuestionFolder(state.qfBadOffset+state.qfBadPageSize));

    $("admin-qf-import-calibration")?.addEventListener("click", () => openReviewImportDialog(null, null, "calibration"));
    $("admin-qf-import-stage-metrics")?.addEventListener("click", () => openReviewImportDialog(null, null, "metrics"));
    $("admin-qf-batches")?.addEventListener("click", async event => {
      const exportButton = event.target.closest("[data-qf-export]");
      if (exportButton) {
        const [batch, block, mode] = exportButton.dataset.qfExport.split(":");
        const { data, error } = await sb.rpc("admin_export_question_factory", {p_batch_number:Number(batch),p_block_number:Number(block)||null,p_blind:mode==="blind"});
        if (error) { window.alert(error.message); return; }
        const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
        const url = URL.createObjectURL(blob); const link = document.createElement("a");
        link.href=url; link.download=`luria-lote-${batch}-bloco-${block}-${mode}.json`;
        document.body.appendChild(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
        return;
      }
      const finalButton = event.target.closest("[data-qf-final-approve]");
      if (finalButton) {
        if (!window.confirm("Confirmar aprovação humana final deste lote, após ChatGPT, Perplexity e Gemini?")) return;
        const {error} = await sb.rpc("admin_approve_question_factory_lot",{p_batch_number:Number(finalButton.dataset.qfFinalApprove)});
        if(error)window.alert(error.message); else await loadQuestionFactory();
        return;
      }
      const blockButton = event.target.closest("[data-qf-view-block]");
      if (blockButton) {
        const [batch,block] = blockButton.dataset.qfViewBlock.split(":");
        const issuesOnly = /pendências/i.test(blockButton.textContent || "");
        openQuestionFactoryBlock(batch,block,issuesOnly);
        return;
      }

      const importButton = event.target.closest("[data-qf-import-review]");
      if (importButton) {
        const [batch,block] = importButton.dataset.qfImportReview.split(":");
        openReviewImportDialog(batch,block,"block");
        return;
      }

      const lotImportButton = event.target.closest("[data-qf-import-lot]");
      if (lotImportButton) {
        openReviewImportDialog(lotImportButton.dataset.qfImportLot,null,"lot");
        return;
      }

      const correctionButton = event.target.closest("[data-qf-import-correction]");
      if (correctionButton) {
        const [batch,block] = correctionButton.dataset.qfImportCorrection.split(":");
        openReviewImportDialog(batch,block,"correction");
        return;
      }

      const humanButton = event.target.closest("[data-qf-human-review]");
      if (humanButton) {
        const [batch,block,decision] = humanButton.dataset.qfHumanReview.split(":");
        setHumanBlockReview(batch,block,decision);
        return;
      }

      const button = event.target.closest("[data-qf-batch]");
      if (!button) return;
      openQuestionFactoryBatch(button.dataset.qfBatch, 0);
    });

    $("admin-qf-review-import-close")?.addEventListener("click", () => $("admin-qf-review-import-dialog")?.close());
    $("admin-qf-review-import-cancel")?.addEventListener("click", () => $("admin-qf-review-import-dialog")?.close());
    $("admin-qf-review-import-submit")?.addEventListener("click", submitReviewImport);

    $("admin-qf-dialog-close")?.addEventListener("click", () => $("admin-qf-dialog")?.close());
    $("admin-qf-prev")?.addEventListener("click", () => {
      if (!state.qfBatchNumber) return;
      openQuestionFactoryBatch(state.qfBatchNumber, Math.max(0, state.qfOffset - state.qfPageSize));
    });
    $("admin-qf-next")?.addEventListener("click", () => {
      if (!state.qfBatchNumber) return;
      openQuestionFactoryBatch(state.qfBatchNumber, state.qfOffset + state.qfPageSize);
    });

    $("admin-storage-expansion-open")
      ?.addEventListener(
        "click",
        () => {
          const button =
            $("admin-storage-expansion-open");

          const content =
            $("admin-storage-expansion-content");

          if (
            !button
            || !content
            || !state.storageGuide
          ) {
            return;
          }

          const opening =
            content.hidden;

          content.hidden =
            !opening;

          button.setAttribute(
            "aria-expanded",
            String(
              opening
            )
          );

          button.textContent =
            opening
              ? "Fechar"
              : "Abrir";

          if (opening) {
            content.textContent =
              state.storageGuide;

            content.dataset.ready =
              "true";
          }
        }
      );

    $("admin-range")
      ?.addEventListener(
        "change",
        async event => {
          state.days =
            Number(event.target.value)
            || 30;

          await load();
        }
      );

    $("admin-customer-search")
      ?.addEventListener(
        "input",
        renderCustomers
      );

    $("admin-customer-body")
      ?.addEventListener(
        "change",
        event => {
          const select = event.target.closest("[data-customer-plan]");
          if (!select) return;
          updateCustomerPlan(select);
        }
      );

    [
      "admin-customer-plan-filter",
      "admin-customer-status-filter"
    ].forEach(id => {
      $(id)?.addEventListener(
        "change",
        renderCustomers
      );
    });

    $("admin-customer-filter-toggle")
      ?.addEventListener(
        "click",
        () => {
          const panel =
            $("admin-customer-filter-panel");

          const button =
            $("admin-customer-filter-toggle");

          if (!panel || !button) {
            return;
          }

          panel.hidden =
            !panel.hidden;

          button.setAttribute(
            "aria-expanded",
            String(!panel.hidden)
          );
        }
      );

    $("admin-customer-filter-clear")
      ?.addEventListener(
        "click",
        () => {
          const plan =
            $("admin-customer-plan-filter");

          const status =
            $("admin-customer-status-filter");

          if (plan) {
            plan.value = "";
          }

          if (status) {
            status.value = "";
          }

          renderCustomers();
        }
      );

    $("admin-save-plan-features")
      ?.addEventListener(
        "click",
        savePlanFeatures
      );

    $("admin-save-plan-prices")?.addEventListener("click", async () => {
      const button=$("admin-save-plan-prices");
      const items=Array.from(document.querySelectorAll(".admin-plan-price-card")).map(card=>({
        plan_slug:card.dataset.plan,
        monthly_price_cents:moneyInputToCents(card.querySelector('[data-price="monthly_price_cents"]')?.value),
        annual_cash_price_cents:moneyInputToCents(card.querySelector('[data-price="annual_cash_price_cents"]')?.value),
        annual_installment_price_cents:moneyInputToCents(card.querySelector('[data-price="annual_installment_price_cents"]')?.value),
        annual_installments:Math.max(1,Number(card.querySelector('[data-price="annual_installments"]')?.value||12))
      }));
      if(button){button.disabled=true;button.textContent="Salvando...";}
      try{
        const {data,error}=await sb.rpc("admin_save_plan_prices",{p_items:items});
        if(error) throw error;
        renderPlanPrices(data||items);
        if(button) button.textContent="Salvo";
        setTimeout(()=>{if(button)button.textContent="Salvar valores";},900);
      }catch(error){console.error(error);if(button)button.textContent="Erro ao salvar";}
      finally{if(button)button.disabled=false;}
    });

    $("admin-edit-costs")
      ?.addEventListener(
        "click",
        () => {
          renderCostEditor();
          $("admin-cost-editor")
            ?.showModal();
        }
      );

    $("admin-cost-close")
      ?.addEventListener(
        "click",
        () => {
          $("admin-cost-editor")
            ?.close();
        }
      );

    $("admin-cost-cancel")
      ?.addEventListener(
        "click",
        () => {
          $("admin-cost-editor")
            ?.close();
        }
      );

    $("admin-cost-form")
      ?.addEventListener(
        "submit",
        async event => {
          event.preventDefault();

          const rows =
            Array.from(
              document.querySelectorAll(
                ".admin-cost-editor-row"
              )
            );

          const items =
            rows.map(row => {
              const key =
                row.dataset.costKey;

              const amount =
                Number(
                  row.querySelector(
                    '[data-cost-field="amount"]'
                  )?.value
                  || 0
                );

              return {
                key,
                amount_cents:
                  Math.max(
                    0,
                    Math.round(
                      amount * 100
                    )
                  ),
                cadence:
                  row.querySelector(
                    '[data-cost-field="cadence"]'
                  )?.value
                  || "monthly",
                scope:
                  row.querySelector(
                    '[data-cost-field="scope"]'
                  )?.value
                  || "general"
              };
            });

          const save =
            $("admin-cost-save");

          const message =
            $("admin-cost-editor-message");

          if (save) {
            save.disabled = true;
            save.textContent =
              "Salvando...";
          }

          if (message) {
            message.textContent = "";
            message.className =
              "admin-cost-editor-message";
          }

          try {
            const {
              data,
              error
            } =
              await sb.rpc(
                "admin_save_cost_items",
                {
                  p_items:
                    items
                }
              );

            if (
              error
              || data !== true
            ) {
              throw error
              || new Error(
                "Não foi possível salvar os custos."
              );
            }

            const refreshed =
              await sb.rpc(
                "admin_cost_items_snapshot"
              );

            if (refreshed.error) {
              throw refreshed.error;
            }

            state.costItems =
              Array.isArray(refreshed.data)
                ? refreshed.data
                : [];

            renderLogistics(
              state.logistics || {},
              state.snapshot?.metrics || {}
            );

            if (message) {
              message.textContent =
                "Custos atualizados.";
              message.className =
                "admin-cost-editor-message success";
            }

            setTimeout(
              () => {
                $("admin-cost-editor")
                  ?.close();
              },
              350
            );

          } catch (error) {
            console.error(error);

            if (message) {
              message.textContent =
                "Não foi possível salvar os custos.";
              message.className =
                "admin-cost-editor-message error";
            }

          } finally {
            if (save) {
              save.disabled = false;
              save.textContent =
                "Salvar custos";
            }
          }
        }
      );

    document.addEventListener(
      "click",
      event => {
        const wrap =
          document.querySelector(
            ".admin-filter-wrap"
          );

        const panel =
          $("admin-customer-filter-panel");

        const button =
          $("admin-customer-filter-toggle");

        if (
          !wrap
          || !panel
          || panel.hidden
          || wrap.contains(event.target)
        ) {
          return;
        }

        panel.hidden =
          true;

        button?.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    );
  }

  async function ensureAdminAccess() {
    if (
      window.docmapIsAdmin === true
    ) {
      return true;
    }

    try {
      const {
        data,
        error
      } =
        await sb.rpc(
          "is_admin"
        );

      if (
        error
        || data !== true
      ) {
        window.location.replace(
          "/dashboard/"
        );

        return false;
      }

      window.docmapIsAdmin =
        true;

      return true;

    } catch (
      error
    ) {
      console.warn(
        "Não foi possível confirmar acesso administrativo:",
        error
      );

      window.location.replace(
        "/dashboard/"
      );

      return false;
    }
  }

  async function startAdminDashboard() {
    const allowed =
      await ensureAdminAccess();

    if (!allowed) {
      return;
    }

    wirePinGate();

    try {
      await loadPinStatus();

    } catch (error) {
      console.error(
        error
      );

      setPinMessage(
        "Não foi possível verificar a proteção do Admin.",
        "error"
      );

      const submit =
        $("admin-pin-submit");

      if (submit) {
        submit.disabled =
          true;
      }
    }
  }

  if (
    window.docmapUser
  ) {
    startAdminDashboard();
  } else {
    window.addEventListener(
      "docmap:ready",
      startAdminDashboard,
      {
        once: true
      }
    );
  }
})();
