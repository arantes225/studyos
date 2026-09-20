(() => {
  "use strict";

  const sb =
    window.supabaseClient;

  const state = {
    days: 30,
    snapshot: null,
    logistics: null,
    customers: [],
    pinConfigured: false,
    pinUnlocked: false,
    wired: false
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

    const costs =
      Number(
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

    const breakdown = [
      ["Supabase", logistics?.costs?.supabase_cents],
      ["Hospedagem", logistics?.costs?.hosting_cents],
      ["IA / APIs", logistics?.costs?.ai_cents],
      ["Taxas de pagamento", logistics?.costs?.payment_fees_cents],
      ["Outros", logistics?.costs?.other_cents]
    ];

    $("admin-cost-breakdown").innerHTML =
      `
        <div class="admin-cost-title">
          <strong>Composição dos custos mensais</strong>
          <small>Valores atualmente cadastrados para projeção</small>
        </div>
        <div class="admin-cost-items">
          ${breakdown
            .map(([label, value]) => `
              <span>
                <small>${esc(label)}</small>
                <strong>${esc(formatMoney(value))}</strong>
              </span>
            `)
            .join("")}
        </div>
      `;
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
      logisticsResponse
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
        )
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

    render(
      data || {}
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

    await load();
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
          "dashboard.html"
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
        "dashboard.html"
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
