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
    ccq: "CCQ",
    flashcards: "Flashcards",
    questoes: "Questões",
    ia: "IA"
  };

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
                <span class="admin-plan-pill">${esc(customer.plan || "free")}</span>
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
                  ${esc(formatBytes(customer.storage_bytes || 0))}
                </span>
              </td>
              <td>${esc(formatDate(customer.last_access))}</td>
            </tr>
          `;
        })
        .join("");
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
      loadBadQuestionFolder(0),
      loadQuestionFactoryQuality()
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
              <button class="button secondary" type="button" data-qf-import-review="${Number(batch.batch_number)}:${n}">Importar auditoria</button>
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

      const finalMode = batch.final_review_mode === "chatgpt"
        ? "ChatGPT"
        : batch.final_review_mode === "perplexity"
          ? "Perplexity"
          : "ChatGPT + Perplexity";

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
            <strong>${esc(finalMode)}</strong>
            <div>
              ${batch.final_review_mode !== "perplexity" ? qfReviewPill("ChatGPT", batch.final_review_chatgpt_status) : ""}
              ${batch.final_review_mode !== "chatgpt" ? qfReviewPill("Perplexity", batch.final_review_perplexity_status) : ""}
            </div>
          </div>
          <div class="admin-qf-batch-actions">
            <button class="button secondary admin-qf-open-batch" type="button" data-qf-batch="${Number(batch.batch_number)}">Ver questões</button>
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
      if (n >= 95) return "Excelente";
      if (n >= 90) return "Aprovado";
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
      $("admin-qf-review-import-meta").textContent = mode === "lot"
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

    payload.batch_number = state.qfReviewImportBatch;

    const rpcName = state.qfReviewImportMode === "lot"
      ? "admin_import_question_factory_lot_review"
      : state.qfReviewImportMode === "correction"
        ? "admin_import_question_factory_corrections"
        : "admin_import_question_factory_review";

    if (state.qfReviewImportMode !== "lot") {
      payload.block_number = state.qfReviewImportBlock;
    }

    const { data, error } = await sb.rpc(rpcName, { p_payload: payload });
    if (error) {
      if (message) message.textContent = error.message || "Não foi possível importar.";
      return;
    }

    if (message) {
      message.textContent = state.qfReviewImportMode === "lot"
        ? (data?.ready ? "Revisão final importada. Lote marcado como pronto." : "Revisão final importada. O lote ainda possui etapa pendente.")
        : state.qfReviewImportMode === "correction"
          ? `Correções importadas: ${data?.corrected || 0}. Próxima etapa: reauditoria Perplexity.`
          : `Importadas ${data?.imported || 0}: ${data?.approved || 0} aprovadas, ${data?.needs_revision || 0} a rever.`;
    }

    await Promise.all([loadQuestionFactory(),loadQuestionFactoryStyles(),loadQuestionFactoryQuality(),loadBadQuestionFolder(0)]);
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
    await Promise.all([loadQuestionFactory(),loadQuestionFactoryStyles(),loadQuestionFactoryQuality()]);
  }

  function buildBoardSegmentPrompt(item, stage) {
    const style = item?.exam_style || "BANCA";
    const brief = item?.full_generation_brief || item?.generation_instructions || "";

    const common = `
BANCA / EXAM_STYLE: ${style}

CONTEXTO EDITORIAL DA BANCA
${brief}

REGRAS GERAIS
- Trabalhe sempre com question_id imutável.
- O formato canônico entre IAs e backend é JSON.
- Não use Excel como formato máquina-a-máquina.
- Corte mínimo de qualidade: 90/100.
- Mesmo com nota >=90, hard fail impede aprovação.
- Hard fails incluem: gabarito divergente, duas alternativas defensáveis, ambiguidade relevante, conduta potencialmente perigosa, dose/ponto de corte incorreto, fonte inexistente, fonte que não sustenta o gabarito, recomendação desatualizada ou questão reconhecível como cópia.
- Toda questão precisa de fonte específica do gabarito.
`;

    if (stage === "chatgpt_initial") return `PROMPT DE SEGMENTO 1 — CHECAGEM CHATGPT DO BLOCO DE 200
${common}

TAREFA
Receba o bloco recém-gerado e faça uma verificação estrutural/editorial antes de enviá-lo ao Perplexity.

Verifique:
1. exatamente 200 questões;
2. IDs únicos e sequências corretas;
3. quatro alternativas A-D;
4. apenas uma melhor resposta aparente;
5. explicações A-D completas;
6. fonte geral e fonte específica do gabarito preenchidas;
7. distribuição de dificuldade;
8. repetição ou quase duplicação;
9. aderência ao perfil ${style};
10. problemas óbvios de ciência, gabarito ou segurança.

Não substitua a auditoria independente do Perplexity.

SAÍDA JSON
{
  "schema_version":"1.0",
  "review_stage":"chatgpt_initial",
  "batch_number":N,
  "block_number":N,
  "exam_style":"${style}",
  "reviewer":"ChatGPT",
  "reviews":[
    {
      "question_id":"...",
      "quality_score":0-100,
      "component_scores":{},
      "independent_answer":"A|B|C|D",
      "original_answer":"A|B|C|D",
      "status":"approved|needs_revision|rejected",
      "confidence":"high|medium|low",
      "ambiguity":false,
      "single_best_answer":true,
      "hard_fail":false,
      "hard_fail_reasons":[],
      "scientific_issue":null,
      "source_issue":null,
      "answer_source_issue":null,
      "explanation_issue":null,
      "distractor_issue":null,
      "style_issue":null,
      "suggested_correction":null,
      "verified_sources":[]
    }
  ]
}

Não publique. Não altere silenciosamente as questões.`;

    if (stage === "perplexity_initial") return `PROMPT DE SEGMENTO 2 — AUDITORIA INDEPENDENTE PERPLEXITY
${common}

TAREFA
Audite cientificamente TODAS as 200 questões de forma independente.
Resolva antes de olhar o gabarito.
Abra e confira as fontes.
Dê quality_score 0–100 para cada item.

PESOS RECOMENDADOS
- correção científica: 30
- gabarito + única melhor resposta: 20
- fonte específica do gabarito: 15
- distratores: 10
- explicações A-D: 10
- fidelidade ao estilo: 10
- clareza/redação: 5

APROVAÇÃO
approved somente se:
quality_score >= 90
AND hard_fail=false
AND ambiguity=false
AND single_best_answer=true
AND answer_source_issue=null.

Abaixo de 90 = needs_revision.
Erro estrutural grave/irrecuperável = rejected.

SAÍDA JSON EXATA
{
  "schema_version":"1.0",
  "review_stage":"perplexity_initial",
  "batch_number":N,
  "block_number":N,
  "exam_style":"${style}",
  "auditor":"Perplexity",
  "reviews":[
    {
      "question_id":"...",
      "quality_score":0-100,
      "component_scores":{
        "scientific":0-30,
        "answer":0-20,
        "answer_source":0-15,
        "distractors":0-10,
        "explanations":0-10,
        "style":0-10,
        "writing":0-5
      },
      "independent_answer":"A|B|C|D",
      "original_answer":"A|B|C|D",
      "status":"approved|needs_revision|rejected",
      "confidence":"high|medium|low",
      "ambiguity":false,
      "single_best_answer":true,
      "hard_fail":false,
      "hard_fail_reasons":[],
      "scientific_issue":null,
      "source_issue":null,
      "answer_source_issue":null,
      "explanation_issue":null,
      "distractor_issue":null,
      "style_issue":null,
      "suggested_correction":null,
      "verified_sources":[{"institution":"","document":"","year":"","url":"","section":null}]
    }
  ],
  "summary":{"total":200,"approved":0,"needs_revision":0,"rejected":0}
}

O JSON será importado no Supabase e vinculado ao question_id + bloco. Não inclua texto fora do JSON.`;

    if (stage === "chatgpt_correction") return `PROMPT DE SEGMENTO 3 — CORREÇÃO CHATGPT A PARTIR DO SUPABASE
${common}

TAREFA
Consulte/receba somente as questões do bloco cujo latest review esteja needs_revision ou rejected/recuperável.
Para cada questão, leia o parecer mais recente salvo no Supabase:
- quality_score
- hard_fail e razões
- scientific_issue
- source_issue
- answer_source_issue
- explanation_issue
- distractor_issue
- style_issue
- suggested_correction
- verified_sources.

Corrija exatamente os problemas apontados.
Preserve question_id e exam_style.
Incremente version em +1.
Atualize a fonte do gabarito quando a correção alterar o fundamento científico.
Não mexa desnecessariamente em questão já aprovada.
Toda questão corrigida precisa voltar para reauditoria.

SAÍDA JSON
{
  "schema_version":"1.0",
  "review_stage":"chatgpt_correction_review",
  "batch_number":N,
  "block_number":N,
  "exam_style":"${style}",
  "questions":[
    { "question_id":"...", "...questão completa corrigida...":"" }
  ],
  "changes":[
    {
      "question_id":"...",
      "old_version":1,
      "new_version":2,
      "changes_made":[],
      "source_changed":false,
      "needs_reaudit":true
    }
  ]
}

Ao terminar, informe quantas foram corrigidas e quais continuam inseguras. Não marque como approved por conta própria.`;

    if (stage === "perplexity_reaudit") return `PROMPT DE SEGMENTO 4 — REAUDITORIA PERPLEXITY APÓS CORREÇÃO
${common}

TAREFA
Reaudite APENAS as questões corrigidas na versão mais recente.
Ignore o parecer anterior como autoridade: resolva novamente.
Confira novamente a fonte específica do gabarito.
Use o mesmo corte >=90 e os mesmos hard fails.

SAÍDA JSON
{
  "schema_version":"1.0",
  "review_stage":"perplexity_reaudit",
  "batch_number":N,
  "block_number":N,
  "exam_style":"${style}",
  "auditor":"Perplexity",
  "reviews":[
    {
      "question_id":"...",
      "quality_score":0-100,
      "component_scores":{},
      "independent_answer":"A|B|C|D",
      "original_answer":"A|B|C|D",
      "status":"approved|needs_revision|rejected",
      "confidence":"high|medium|low",
      "ambiguity":false,
      "single_best_answer":true,
      "hard_fail":false,
      "hard_fail_reasons":[],
      "scientific_issue":null,
      "source_issue":null,
      "answer_source_issue":null,
      "explanation_issue":null,
      "distractor_issue":null,
      "style_issue":null,
      "suggested_correction":null,
      "verified_sources":[]
    }
  ]
}

O resultado será importado novamente no Supabase. Só depois que as 200 estiverem machine-approved o Admin deve liberar a aprovação humana do bloco.`;

    if (stage === "lot_chatgpt_final") return `PROMPT DE SEGMENTO 6A — REVISÃO FINAL CHATGPT DO LOTE DE 1.000
${common}

CONTEXTO
Os cinco blocos de 200 já passaram por:
- geração;
- checagem ChatGPT;
- auditoria independente Perplexity;
- correção das questões abaixo de 90 ou com hard fail;
- reauditoria Perplexity;
- aprovação humana bloco a bloco.

TAREFA
Audite o LOTE INTEIRO de 1.000 como conjunto.
Verifique:
- duplicatas e quase duplicatas;
- concentração temática;
- curva de dificuldade;
- distribuição de letras;
- aderência global ao estilo ${style};
- cobertura das áreas;
- questões excessivamente semelhantes entre blocos;
- consistência das fontes;
- itens de alto risco;
- questões corrigidas em versões >1;
- equilíbrio entre diagnóstico, conduta, prevenção, seguimento, urgência e epidemiologia.

Não reescreva silenciosamente.
Sinalize tudo que precisar voltar.

SAÍDA JSON
{
  "schema_version":"1.0",
  "review_stage":"lot_chatgpt_final",
  "batch_number":N,
  "reviewer":"ChatGPT",
  "lote_status":"approved|needs_revision",
  "questions_flagged":[],
  "duplicate_clusters":[],
  "answer_source_problems":[],
  "outdated_sources":[],
  "guideline_conflicts":[],
  "coverage_gaps":[],
  "style_problems":[],
  "difficulty_findings":[],
  "answer_letter_distribution":{},
  "comments":[]
}

O lote só pode seguir se não houver pendência relevante.`;

    if (stage === "lot_perplexity_final") return `PROMPT DE SEGMENTO 6B — REVISÃO FINAL PERPLEXITY DO LOTE DE 1.000
${common}

CONTEXTO
Este lote de 1.000 já foi aprovado bloco a bloco e passou pela revisão final do ChatGPT.

TAREFA
Faça auditoria final independente, orientada por evidência.
Priorize:
1. todas as questões sinalizadas anteriormente;
2. todas com version >1;
3. todas de alto risco clínico;
4. todas com alteração de fonte/gabarito;
5. uma amostra ampla e distribuída das demais;
6. atualização recente de diretrizes;
7. conflitos de guideline;
8. duplicações;
9. problemas de fidelidade editorial do conjunto.

Confirme novamente se a fonte específica do gabarito sustenta a resposta.

SAÍDA JSON
{
  "schema_version":"1.0",
  "review_stage":"lot_perplexity_final",
  "batch_number":N,
  "reviewer":"Perplexity",
  "lote_status":"approved|needs_revision",
  "questions_flagged":[],
  "answer_key_disagreements":[],
  "answer_source_problems":[],
  "outdated_sources":[],
  "guideline_conflicts":[],
  "duplicate_or_near_duplicate":[],
  "high_risk_rechecks":[],
  "coverage_gaps":[],
  "style_problems":[],
  "comments":[]
}

Não considere consenso entre modelos como evidência. Prefira fonte primária/oficial atual.`;

    return "";
  }

  function renderQuestionFactoryStyles(styles) {
    state.questionStyles = Array.isArray(styles) ? styles : [];

    const dash = $("admin-qf-style-dashboard");
    const manual = $("admin-qf-style-manual");
    const count = $("admin-qf-style-count");

    if (count) {
      count.textContent = `${state.questionStyles.length} banca${state.questionStyles.length === 1 ? "" : "s"}`;
    }

    if (dash) {
      dash.innerHTML = state.questionStyles.length ? state.questionStyles.map(item => {
        const score = item.style_score == null ? "calibrando" : `${Number(item.style_score).toLocaleString("pt-BR",{maximumFractionDigits:1})}/10`;
        return `
          <article class="admin-qf-style-card">
            <div class="admin-qf-style-card-head">
              <div>
                <strong>${esc(item.exam_style)}</strong>
                <small>${esc(item.organizing_body || "Perfil editorial")}</small>
              </div>
              <span>${esc(score)}</span>
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
          </article>
        `;
      }).join("") : '<div class="admin-factory-empty-wide">Nenhum perfil de banca configurado.</div>';
    }

    if (manual) {
      manual.innerHTML = state.questionStyles.length ? state.questionStyles.map((item,index) => {
        const score = item.style_score == null ? "Em calibração" : `Fidelidade atual: ${Number(item.style_score).toLocaleString("pt-BR",{maximumFractionDigits:1})}/10`;
        const url = String(item.style_reference_url || "").startsWith("https://") ? item.style_reference_url : "";
        return `
          <details class="admin-qf-board-manual" ${index === 0 ? "open" : ""}>
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
                <pre class="admin-qf-board-master-text">${esc(item.full_generation_brief || item.generation_instructions || "")}</pre>
              </section>

              <section class="admin-qf-segment-sequence">
                <div class="admin-qf-segment-sequence-head">
                  <span class="eyebrow">Prompts de segmento · ordem operacional</span>
                  <strong>Fluxo do bloco de 200</strong>
                  <small>Use nesta ordem. Cada retorno JSON pode ser importado e vinculado ao bloco no Supabase.</small>
                </div>
                ${[
                  ["01","ChatGPT · checagem inicial","chatgpt_initial","chatgpt"],
                  ["02","Perplexity · auditoria","perplexity_initial","perplexity"],
                  ["03","ChatGPT · correção","chatgpt_correction","chatgpt"],
                  ["04","Perplexity · reauditoria","perplexity_reaudit","perplexity"]
                ].map(([num,label,stage,provider]) => {
                  const pid=`qf-${String(item.exam_style||"style").replace(/[^a-z0-9]/gi,"-").toLowerCase()}-${stage}`;
                  return `
                    <details class="admin-qf-segment-card">
                      <summary><span>${num}</span><strong>${esc(label)}</strong></summary>
                      <div class="admin-qf-segment-card-body">
                        <div class="admin-qf-segment-actions">
                          <button class="button secondary admin-qf-copy-inline" type="button" data-inline-prompt="${esc(pid)}">Copiar</button>
                          <button class="button primary admin-qf-ai-inline" type="button" data-inline-prompt="${esc(pid)}" data-ai-provider="${provider}">Abrir ${provider === "perplexity" ? "Perplexity" : "ChatGPT"}</button>
                        </div>
                        <pre id="${esc(pid)}" class="admin-qf-prompt">${esc(buildBoardSegmentPrompt(item,stage))}</pre>
                      </div>
                    </details>
                  `;
                }).join("")}
                <div class="admin-qf-segment-human">
                  <span>05</span>
                  <div><strong>Sua aprovação</strong><small>Quando as 200 estiverem aprovadas na reauditoria, o Admin libera SIM/NÃO. SIM envia o bloco ao lote de 1.000.</small></div>
                </div>
                <div class="admin-qf-segment-human final">
                  <span>06</span>
                  <div><strong>Revisão final das 1.000</strong><small>Somente depois dos cinco blocos aprovados por você. A revisão é global e olha o lote como conjunto.</small></div>
                </div>
                ${[
                  ["06A","ChatGPT · revisão global das 1.000","lot_chatgpt_final","chatgpt"],
                  ["06B","Perplexity · auditoria final das 1.000","lot_perplexity_final","perplexity"]
                ].map(([num,label,stage,provider]) => {
                  const pid=`qf-${String(item.exam_style||"style").replace(/[^a-z0-9]/gi,"-").toLowerCase()}-${stage}`;
                  return `
                    <details class="admin-qf-segment-card final">
                      <summary><span>${num}</span><strong>${esc(label)}</strong></summary>
                      <div class="admin-qf-segment-card-body">
                        <div class="admin-qf-segment-actions">
                          <button class="button secondary admin-qf-copy-inline" type="button" data-inline-prompt="${esc(pid)}">Copiar</button>
                          <button class="button primary admin-qf-ai-inline" type="button" data-inline-prompt="${esc(pid)}" data-ai-provider="${provider}">Abrir ${provider === "perplexity" ? "Perplexity" : "ChatGPT"}</button>
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
    const url = provider === "perplexity"
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
      window.location.href = provider === "perplexity"
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
    $("admin-qf-style-manual")?.addEventListener("click", async event => {
      const aiButton = event.target.closest("[data-style-ai-index]");
      if (aiButton) {
        event.preventDefault();
        event.stopPropagation();
        const index = Number(aiButton.dataset.styleAiIndex);
        const item = state.questionStyles[index];
        if (!item) return;
        const text = item.full_generation_brief || item.generation_instructions || "";
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

      const text = item.full_generation_brief || item.generation_instructions || "";
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

    $("admin-qf-style-manual")?.addEventListener("click", async event => {
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

    $("admin-qf-bad-open")?.addEventListener("click", async () => {
      await loadBadQuestionFolder(0);
      $("admin-qf-bad-dialog")?.showModal();
    });
    $("admin-qf-bad-close")?.addEventListener("click", () => $("admin-qf-bad-dialog")?.close());
    $("admin-qf-bad-prev")?.addEventListener("click", () => loadBadQuestionFolder(Math.max(0,state.qfBadOffset-state.qfBadPageSize)));
    $("admin-qf-bad-next")?.addEventListener("click", () => loadBadQuestionFolder(state.qfBadOffset+state.qfBadPageSize));

    $("admin-qf-batches")?.addEventListener("click", event => {
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
