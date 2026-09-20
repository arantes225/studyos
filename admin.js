(() => {
  "use strict";

  const sb =
    window.supabaseClient;

  const state = {
    days: 30,
    snapshot: null,
    customers: []
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

  function filteredCustomers() {
    const query =
      $("admin-customer-search")
        .value
        .trim()
        .toLowerCase();

    if (!query) {
      return state.customers;
    }

    return state.customers.filter(customer => {
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
        '<tr><td colspan="9" class="admin-table-empty">Nenhum cliente encontrado.</td>';
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

    const {
      data,
      error
    } =
      await sb.rpc(
        "admin_dashboard_snapshot",
        {
          p_days:
            state.days
        }
      );

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
            "dashboard.html"
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

    render(
      data || {}
    );

    setStatus(
      "Dashboard atualizado.",
      "success"
    );
  }

  function wire() {
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
  }

  window.addEventListener(
    "docmap:ready",
    async () => {
      wire();
      await load();
    },
    {
      once: true
    }
  );
})();
