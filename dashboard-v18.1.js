(() => {
  "use strict";

  const sb = window.supabaseClient;
  const ROTATION_MS = 30000;
  const STYLE_ID = "resibulando-dashboard-v18-style";

  const ccqState = {
    items: [],
    currentIndex: -1,
    bag: [],
    timerId: null,
    transitionId: null
  };

  function injectDashboardStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;

    style.textContent = `
      /* =====================================================
         RESIBULANDO V18 — DASHBOARD
         ===================================================== */

      /* -----------------------------------------------------
         CCQ PASSIVO — ocupa o antigo card "Maior dificuldade"
         ----------------------------------------------------- */

      .metric-card.dashboard-passive-ccq-card {
        position: relative;
        overflow: hidden;
        display: grid;
        align-content: start;
        gap: 9px;
        min-height: 150px;
      }

      .dashboard-ccq-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .dashboard-ccq-head .metric-label {
        margin: 0;
      }

      .dashboard-ccq-auto {
        color: var(--muted);
        font-size: 8px;
        font-weight: 800;
        white-space: nowrap;
      }

      .dashboard-passive-ccq-stage {
        min-height: 74px;
        display: grid;
        align-content: center;
        gap: 7px;
        transform: translateX(0);
        opacity: 1;
        transition:
          transform 300ms ease,
          opacity 300ms ease;
      }

      .dashboard-passive-ccq-stage.is-leaving {
        transform: translateX(-24px);
        opacity: 0;
      }

      .dashboard-passive-ccq-stage.is-entering {
        transform: translateX(24px);
        opacity: 0;
      }

      .dashboard-passive-ccq-text {
        display: -webkit-box;
        overflow: hidden;
        color: var(--text);
        font-size: 13px;
        font-weight: 820;
        line-height: 1.35;
        letter-spacing: -.012em;
        -webkit-line-clamp: 4;
        -webkit-box-orient: vertical;
      }

      .dashboard-passive-ccq-meta {
        overflow: hidden;
        color: var(--muted);
        font-size: 8px;
        font-weight: 700;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .dashboard-passive-ccq-empty {
        display: grid;
        place-items: center;
        min-height: 74px;
        color: var(--muted);
        font-size: 10px;
        text-align: center;
      }

      .dashboard-passive-ccq-progress {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 3px;
        overflow: hidden;
        background: var(--border);
      }

      .dashboard-passive-ccq-progress > span {
        display: block;
        width: 0%;
        height: 100%;
        background: var(--accent);
      }

      /* -----------------------------------------------------
         OFENSIVA
         ----------------------------------------------------- */

      .metric-card.streak-card-v18 {
        position: relative;
        overflow: hidden;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-areas:
          "label flame"
          "value flame"
          "helper flame";
        align-items: center;
        column-gap: 12px;
      }

      .streak-card-v18 > .metric-label {
        grid-area: label;
      }

      .streak-card-v18 > .metric-value {
        grid-area: value;
      }

      .streak-card-v18 > .metric-helper {
        grid-area: helper;
      }

      .streak-flame-wrap {
        grid-area: flame;
        position: relative;
        width: 78px;
        height: 90px;
        display: grid;
        place-items: center;
        justify-self: end;
      }

      .streak-flame-aura {
        position: absolute;
        width: calc(var(--flame-size, 38px) * 1.3);
        height: calc(var(--flame-size, 38px) * 1.3);
        border-radius: 50%;
        background: var(--flame-main, #f59e0b);
        opacity: .10;
        filter: blur(13px);
        transition:
          width .35s ease,
          height .35s ease,
          background .35s ease,
          opacity .35s ease;
      }

      .streak-flame-svg {
        position: relative;
        z-index: 1;
        width: var(--flame-size, 38px);
        height: var(--flame-size, 38px);
        overflow: visible;
        color: var(--flame-main, #f59e0b);
        filter:
          drop-shadow(
            0 6px
            var(--flame-glow, rgba(245, 158, 11, .22))
          );
        transition:
          width .35s ease,
          height .35s ease,
          color .35s ease,
          filter .35s ease;
        transform-origin: 50% 85%;
        animation: streakFlamePulse 2.5s ease-in-out infinite;
      }

      .streak-flame-core {
        fill: var(--flame-core, #fde68a);
        transition: fill .35s ease;
      }

      .streak-stage-label {
        grid-column: 1 / -1;
        margin-top: 7px;
        color: var(--flame-main, var(--muted));
        font-size: 8px;
        font-weight: 850;
        text-transform: uppercase;
        letter-spacing: .055em;
        transition: color .35s ease;
      }

      .streak-card-v18[data-streak-tier="0"] {
        --flame-size: 32px;
        --flame-main: #94a3b8;
        --flame-core: #cbd5e1;
        --flame-glow: rgba(148, 163, 184, .15);
      }

      .streak-card-v18[data-streak-tier="1"] {
        --flame-size: 38px;
        --flame-main: #f5a524;
        --flame-core: #fde68a;
        --flame-glow: rgba(245, 165, 36, .24);
      }

      .streak-card-v18[data-streak-tier="2"] {
        --flame-size: 45px;
        --flame-main: #ff7a1a;
        --flame-core: #ffd166;
        --flame-glow: rgba(255, 122, 26, .30);
      }

      .streak-card-v18[data-streak-tier="3"] {
        --flame-size: 52px;
        --flame-main: #ff4d2e;
        --flame-core: #ffb347;
        --flame-glow: rgba(255, 77, 46, .34);
      }

      .streak-card-v18[data-streak-tier="4"] {
        --flame-size: 58px;
        --flame-main: #e43dff;
        --flame-core: #ff9bf0;
        --flame-glow: rgba(228, 61, 255, .32);
      }

      .streak-card-v18[data-streak-tier="5"] {
        --flame-size: 64px;
        --flame-main: #7c4dff;
        --flame-core: #c7b8ff;
        --flame-glow: rgba(124, 77, 255, .34);
      }

      .streak-card-v18[data-streak-tier="6"] {
        --flame-size: 70px;
        --flame-main: #169bff;
        --flame-core: #8fddff;
        --flame-glow: rgba(22, 155, 255, .38);
      }

      @keyframes streakFlamePulse {
        0%,
        100% {
          transform: translateY(1px) scale(.97) rotate(-1deg);
        }

        50% {
          transform: translateY(-2px) scale(1.035) rotate(1deg);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .streak-flame-svg {
          animation: none;
        }

        .dashboard-passive-ccq-stage {
          transition: none;
        }
      }

      @media (max-width: 680px) {
        .streak-flame-wrap {
          width: 62px;
        }

        .dashboard-passive-ccq-text {
          font-size: 12px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function installPassiveCcqCard() {
    const oldValue = document.getElementById("metric-difficulty");
    const card = oldValue?.closest(".metric-card");

    if (!card) return null;

    card.classList.add("dashboard-passive-ccq-card");

    card.innerHTML = `
      <div class="dashboard-ccq-head">
        <span class="metric-label">
          Revisão passiva
        </span>

        <span class="dashboard-ccq-auto">
          CCQ · 30s
        </span>
      </div>

      <div
        id="dashboard-passive-ccq-empty"
        class="dashboard-passive-ccq-empty"
      >
        Carregando CCQs...
      </div>

      <div
        id="dashboard-passive-ccq-stage"
        class="dashboard-passive-ccq-stage"
        hidden
        aria-live="polite"
      >
        <div
          id="dashboard-passive-ccq-text"
          class="dashboard-passive-ccq-text"
        ></div>

        <div
          id="dashboard-passive-ccq-meta"
          class="dashboard-passive-ccq-meta"
        ></div>
      </div>

      <div class="dashboard-passive-ccq-progress">
        <span id="dashboard-passive-ccq-progress"></span>
      </div>
    `;

    return card;
  }

  function shuffleIndexes(count) {
    const indexes = Array.from(
      { length: count },
      (_, index) => index
    );

    for (let i = indexes.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));

      [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
    }

    return indexes;
  }

  function refillBag() {
    ccqState.bag = shuffleIndexes(ccqState.items.length);

    if (
      ccqState.items.length > 1
      && ccqState.currentIndex >= 0
      && ccqState.bag[ccqState.bag.length - 1] === ccqState.currentIndex
    ) {
      [ccqState.bag[0], ccqState.bag[ccqState.bag.length - 1]] = [
        ccqState.bag[ccqState.bag.length - 1],
        ccqState.bag[0]
      ];
    }
  }

  function nextCcqIndex() {
    if (!ccqState.items.length) return -1;
    if (ccqState.items.length === 1) return 0;

    if (!ccqState.bag.length) {
      refillBag();
    }

    let index = ccqState.bag.pop();

    if (
      index === ccqState.currentIndex
      && ccqState.bag.length
    ) {
      const alternative = ccqState.bag.pop();
      ccqState.bag.push(index);
      index = alternative;
    }

    return index;
  }

  function metaText(item) {
    return [
      item.area,
      item.materia,
      item.theme
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function resetProgress() {
    const bar = document.getElementById(
      "dashboard-passive-ccq-progress"
    );

    if (!bar) return;

    bar.style.transition = "none";
    bar.style.width = "0%";

    void bar.offsetWidth;

    bar.style.transition =
      `width ${ROTATION_MS}ms linear`;

    requestAnimationFrame(() => {
      bar.style.width = "100%";
    });
  }

  function writeCcq(item) {
    const text = document.getElementById(
      "dashboard-passive-ccq-text"
    );

    const meta = document.getElementById(
      "dashboard-passive-ccq-meta"
    );

    if (text) {
      text.textContent = item?.ccq || "";
    }

    if (meta) {
      const value = metaText(item);
      meta.textContent = value;
      meta.hidden = !value;
    }
  }

  function showNextCcq(animate = true) {
    if (!ccqState.items.length) return;

    const stage = document.getElementById(
      "dashboard-passive-ccq-stage"
    );

    const nextIndex = nextCcqIndex();

    if (nextIndex < 0) return;

    const item = ccqState.items[nextIndex];

    clearTimeout(ccqState.transitionId);

    if (!animate || !stage) {
      ccqState.currentIndex = nextIndex;
      writeCcq(item);
      resetProgress();
      return;
    }

    stage.classList.add("is-leaving");

    ccqState.transitionId = window.setTimeout(() => {
      ccqState.currentIndex = nextIndex;

      writeCcq(item);

      stage.classList.remove("is-leaving");
      stage.classList.add("is-entering");

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          stage.classList.remove("is-entering");
        });
      });

      resetProgress();
    }, 300);
  }

  function startRotation() {
    clearInterval(ccqState.timerId);

    if (ccqState.items.length < 2) return;

    ccqState.timerId = window.setInterval(() => {
      if (!document.hidden) {
        showNextCcq(true);
      }
    }, ROTATION_MS);
  }

  async function loadPassiveCcqs() {
    const empty = document.getElementById(
      "dashboard-passive-ccq-empty"
    );

    const stage = document.getElementById(
      "dashboard-passive-ccq-stage"
    );

    if (!empty || !stage || !sb) return;

    const { data, error } = await sb
      .from("error_notebook")
      .select(
        "id,area,materia,theme,ccq,due_date,review_count,created_at"
      )
      .eq("active", true)
      .not("ccq", "is", null)
      .limit(100);

    if (error) {
      console.warn(
        "Não foi possível carregar os CCQs no Dashboard:",
        error.message
      );

      empty.hidden = false;
      empty.textContent = "Sem CCQs disponíveis.";
      stage.hidden = true;
      return;
    }

    ccqState.items = (data || []).filter((item) =>
      String(item.ccq || "").trim()
    );

    ccqState.currentIndex = -1;
    ccqState.bag = [];

    if (!ccqState.items.length) {
      empty.hidden = false;
      empty.textContent = "Nenhum CCQ ativo no Caderno de Erros.";
      stage.hidden = true;
      return;
    }

    empty.hidden = true;
    stage.hidden = false;

    showNextCcq(false);
    startRotation();
  }

  function streakTier(days) {
    if (days <= 0) {
      return {
        tier: "0",
        label: "Comece hoje"
      };
    }

    if (days < 7) {
      return {
        tier: "1",
        label: "Aquecendo"
      };
    }

    if (days < 30) {
      return {
        tier: "2",
        label: "1 semana+"
      };
    }

    if (days < 90) {
      return {
        tier: "3",
        label: "1 mês+"
      };
    }

    if (days < 180) {
      return {
        tier: "4",
        label: "3 meses+"
      };
    }

    if (days < 365) {
      return {
        tier: "5",
        label: "6 meses+"
      };
    }

    return {
      tier: "6",
      label: "1 ano+"
    };
  }

  function installStreakCard() {
    const value = document.querySelector(
      ".metric-card [data-streak-value]"
    );

    const card = value?.closest(".metric-card");

    if (!value || !card) return;

    card.classList.add("streak-card-v18");

    if (!card.querySelector(".streak-flame-wrap")) {
      card.insertAdjacentHTML(
        "beforeend",
        `
          <div
            class="streak-flame-wrap"
            aria-hidden="true"
          >
            <span class="streak-flame-aura"></span>

            <svg
              class="streak-flame-svg"
              viewBox="0 0 64 80"
              role="img"
              aria-label="Chama da ofensiva"
            >
              <path
                fill="currentColor"
                d="
                  M34 3
                  C35 15 26 19 26 29
                  C26 35 30 38 33 40
                  C27 40 22 35 21 29
                  C13 37 8 46 8 56
                  C8 69 18 77 32 77
                  C46 77 56 68 56 54
                  C56 41 48 30 40 22
                  C39 30 36 34 32 36
                  C35 27 43 18 34 3
                  Z
                "
              />

              <path
                class="streak-flame-core"
                d="
                  M33 40
                  C27 47 23 52 23 59
                  C23 67 27 71 33 71
                  C40 71 44 66 44 59
                  C44 52 39 47 35 43
                  C35 48 33 51 30 53
                  C31 48 34 45 33 40
                  Z
                "
              />
            </svg>
          </div>

          <div
            class="streak-stage-label"
            data-streak-stage-label
          ></div>
        `
      );
    }

    const stageLabel = card.querySelector(
      "[data-streak-stage-label]"
    );

    const update = () => {
      const days = Number(
        String(value.textContent || "0")
          .replace(/[^\d]/g, "")
      ) || 0;

      const info = streakTier(days);

      card.dataset.streakTier = info.tier;

      if (stageLabel) {
        stageLabel.textContent = info.label;
      }

      card.setAttribute(
        "aria-label",
        `Ofensiva atual: ${days} dia${days === 1 ? "" : "s"}`
      );
    };

    const observer = new MutationObserver(update);

    observer.observe(
      value,
      {
        childList: true,
        characterData: true,
        subtree: true
      }
    );

    update();
  }

  function bootVisuals() {
    injectDashboardStyles();
    installPassiveCcqCard();
    installStreakCard();
  }

  async function bootData() {
    await loadPassiveCcqs();
  }

  // O HTML já foi carregado porque este script entra depois de dashboard.js.
  bootVisuals();

  if (window.docmapUser) {
    bootData();
  } else {
    window.addEventListener(
      "docmap:ready",
      bootData,
      { once: true }
    );
  }
})();
