const ambientacaoSb =
  window.supabaseClient;

let ambientacaoUser =
  null;

let pomodoroSettings = {
  focusMinutes: 25,
  breakMinutes: 5
};

let pomodoroState = {
  mode: "focus",
  running: false,
  sessionId: null,
  accumulatedSeconds: 0,
  remainingSeconds: 25 * 60,
  totalSeconds: 25 * 60,
  lastTickAt: null,
  timerId: null,
  finishing: false
};


function pomodoroStorageKey(userId) {
  return `docmap:pomodoro:${userId}`;
}


function getAmbientacaoParams() {
  return new URLSearchParams(
    window.location.search
  );
}


function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(
      String(value || "")
    );
}


function studyActivityKind() {
  const kind =
    getAmbientacaoParams()
      .get("kind");

  const map = {
    lesson: "lesson",
    subject_review: "subject_review",
    flashcards_batch: "flashcards",
    errors_batch: "error_notebook"
  };

  return (
    map[kind]
    || "free_study"
  );
}


function studySourceId() {
  const value =
    getAmbientacaoParams()
      .get("item_id");

  return isUuid(value)
    ? value
    : null;
}


function studyActivityLabel() {
  const params =
    getAmbientacaoParams();

  return (
    params.get("title")
    || "Estudo livre"
  );
}


function readPomodoroLocal() {
  if (!ambientacaoUser) {
    return null;
  }

  try {
    return JSON.parse(
      localStorage.getItem(
        pomodoroStorageKey(
          ambientacaoUser.id
        )
      )
      || "null"
    );
  } catch {
    return null;
  }
}


function writePomodoroLocal() {
  if (!ambientacaoUser) {
    return;
  }

  const params =
    getAmbientacaoParams();

  try {
    localStorage.setItem(
      pomodoroStorageKey(
        ambientacaoUser.id
      ),
      JSON.stringify({
        activityKey: [
          params.get("kind") || "",
          params.get("item_id") || "",
          params.get("date") || "",
          params.get("area") || "",
          params.get("title") || ""
        ].join("|"),

        mode:
          pomodoroState.mode,

        sessionId:
          pomodoroState.sessionId,

        accumulatedSeconds:
          Math.max(
            0,
            Math.floor(
              pomodoroState
                .accumulatedSeconds
            )
          ),

        remainingSeconds:
          Math.max(
            0,
            Math.floor(
              pomodoroState
                .remainingSeconds
            )
          ),

        totalSeconds:
          Math.max(
            1,
            Math.floor(
              pomodoroState
                .totalSeconds
            )
          )
      })
    );
  } catch {}
}


function clearPomodoroLocal() {
  if (!ambientacaoUser) {
    return;
  }

  try {
    localStorage.removeItem(
      pomodoroStorageKey(
        ambientacaoUser.id
      )
    );
  } catch {}
}


function currentActivityKey() {
  const params =
    getAmbientacaoParams();

  return [
    params.get("kind") || "",
    params.get("item_id") || "",
    params.get("date") || "",
    params.get("area") || "",
    params.get("title") || ""
  ].join("|");
}


function formatClock(seconds) {
  const safe =
    Math.max(
      0,
      Math.ceil(
        Number(seconds) || 0
      )
    );

  const minutes =
    Math.floor(
      safe / 60
    );

  const rest =
    String(
      safe % 60
    ).padStart(
      2,
      "0"
    );

  return `${minutes}:${rest}`;
}


function formatStudyDuration(seconds) {
  const safe =
    Math.max(
      0,
      Math.floor(
        Number(seconds) || 0
      )
    );

  const hours =
    Math.floor(
      safe / 3600
    );

  const minutes =
    Math.floor(
      (safe % 3600)
      / 60
    );

  if (hours) {
    return `${hours}h ${minutes}min`;
  }

  return `${minutes} min`;
}


function setPomodoroStatus(
  text,
  type = ""
) {
  const element =
    document.getElementById(
      "pomodoro-status"
    );

  if (!element) {
    return;
  }

  element.textContent =
    text;

  element.className =
    `pomodoro-status ${type}`
      .trim();
}


function setPomodoroStateBadge() {
  const badge =
    document.getElementById(
      "pomodoro-session-state"
    );

  if (!badge) {
    return;
  }

  badge.className =
    "pomodoro-state";

  if (
    pomodoroState.running
  ) {
    badge.textContent =
      pomodoroState.mode
        === "focus"
        ? "estudando"
        : "pausa";

    badge.classList.add(
      "running"
    );

    return;
  }

  if (
    pomodoroState.sessionId
    && pomodoroState.mode
      === "focus"
  ) {
    badge.textContent =
      "pausado";

    badge.classList.add(
      "paused"
    );

    return;
  }

  badge.textContent =
    "pronto";
}


function renderPomodoro() {
  const clock =
    document.getElementById(
      "pomodoro-clock"
    );

  const progress =
    document.getElementById(
      "pomodoro-progress-bar"
    );

  const modeCopy =
    document.getElementById(
      "pomodoro-mode-copy"
    );

  const durationCopy =
    document.getElementById(
      "pomodoro-duration-copy"
    );

  const effective =
    document.getElementById(
      "pomodoro-effective-time"
    );

  const start =
    document.getElementById(
      "pomodoro-start"
    );

  const pause =
    document.getElementById(
      "pomodoro-pause"
    );

  const finish =
    document.getElementById(
      "pomodoro-finish"
    );


  if (clock) {
    clock.textContent =
      formatClock(
        pomodoroState
          .remainingSeconds
      );
  }


  const completed =
    Math.max(
      0,
      pomodoroState.totalSeconds
      - pomodoroState.remainingSeconds
    );

  const percent =
    Math.max(
      0,
      Math.min(
        100,
        (
          completed
          / Math.max(
              1,
              pomodoroState.totalSeconds
            )
        ) * 100
      )
    );


  if (progress) {
    progress.style.width =
      `${percent}%`;
  }


  if (modeCopy) {
    modeCopy.textContent =
      pomodoroState.mode
        === "focus"
        ? "Foco"
        : "Pausa";
  }


  if (durationCopy) {
    durationCopy.textContent =
      `${
        Math.round(
          pomodoroState
            .totalSeconds
          / 60
        )
      } min`;
  }


  if (effective) {
    effective.textContent =
      formatStudyDuration(
        pomodoroState
          .accumulatedSeconds
      );
  }


  document
    .querySelectorAll(
      "[data-pomodoro-mode]"
    )
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button
          .dataset
          .pomodoroMode
          === pomodoroState.mode
      );

      button.disabled =
        pomodoroState.running
        || (
          pomodoroState.mode
            === "focus"
          && Boolean(
            pomodoroState
              .sessionId
          )
        );
    });


  if (start) {
    start.disabled =
      pomodoroState.running
      || pomodoroState.finishing;

    start.textContent =
      pomodoroState.mode
        === "focus"
        && pomodoroState.sessionId
          ? "Continuar"
          : "Iniciar";
  }


  if (pause) {
    pause.disabled =
      !pomodoroState.running
      || pomodoroState.finishing;
  }


  if (finish) {
    finish.disabled =
      !pomodoroState.sessionId
      || pomodoroState.finishing
      || pomodoroState.mode
        !== "focus";
  }


  setPomodoroStateBadge();
}


function applyRunningDelta() {
  if (
    !pomodoroState.running
    || !pomodoroState.lastTickAt
  ) {
    return;
  }

  const now =
    Date.now();

  const delta =
    Math.max(
      0,
      (
        now
        - pomodoroState.lastTickAt
      )
      / 1000
    );

  pomodoroState.lastTickAt =
    now;

  pomodoroState.remainingSeconds =
    Math.max(
      0,
      pomodoroState
        .remainingSeconds
      - delta
    );

  if (
    pomodoroState.mode
      === "focus"
  ) {
    pomodoroState.accumulatedSeconds +=
      delta;
  }
}


function stopPomodoroInterval() {
  if (
    pomodoroState.timerId
  ) {
    clearInterval(
      pomodoroState.timerId
    );

    pomodoroState.timerId =
      null;
  }
}


function startPomodoroInterval() {
  stopPomodoroInterval();

  pomodoroState.timerId =
    window.setInterval(
      async () => {
        applyRunningDelta();

        if (
          pomodoroState.remainingSeconds
          <= 0
        ) {
          pomodoroState.remainingSeconds =
            0;

          pomodoroState.running =
            false;

          pomodoroState.lastTickAt =
            null;

          stopPomodoroInterval();

          renderPomodoro();

          if (
            pomodoroState.mode
            === "focus"
          ) {
            await finishFocusSession(
              true
            );

          } else {
            setPomodoroStatus(
              "Pausa concluída. Pode voltar ao foco.",
              "success"
            );

            switchPomodoroMode(
              "focus"
            );
          }

          return;
        }

        writePomodoroLocal();
        renderPomodoro();

      },
      250
    );
}


async function loadPomodoroSettings() {
  const {
    data,
    error
  } =
    await ambientacaoSb
      .from(
        "user_settings"
      )
      .select(
        "pomodoro_focus_minutes,pomodoro_break_minutes"
      )
      .eq(
        "user_id",
        ambientacaoUser.id
      )
      .maybeSingle();


  if (error) {
    console.warn(
      "Não foi possível carregar as configurações do Pomodoro:",
      error.message
    );

    return;
  }


  pomodoroSettings = {
    focusMinutes:
      Math.max(
        1,
        Number(
          data
            ?.pomodoro_focus_minutes
          || 25
        )
      ),

    breakMinutes:
      Math.max(
        1,
        Number(
          data
            ?.pomodoro_break_minutes
          || 5
        )
      )
  };
}


async function loadTodayStudyTime() {
  if (!ambientacaoUser) {
    return;
  }

  const today =
    new Date();

  const localDate =
    `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(
      2,
      "0"
    )}-${String(
      today.getDate()
    ).padStart(
      2,
      "0"
    )}`;


  const {
    data,
    error
  } =
    await ambientacaoSb
      .from(
        "study_hours_daily"
      )
      .select(
        "total_seconds"
      )
      .eq(
        "user_id",
        ambientacaoUser.id
      )
      .eq(
        "study_date",
        localDate
      )
      .maybeSingle();


  if (error) {
    console.warn(
      "Não foi possível carregar o tempo estudado hoje:",
      error.message
    );

    return;
  }


  const element =
    document.getElementById(
      "pomodoro-today-time"
    );


  if (element) {
    element.textContent =
      formatStudyDuration(
        data?.total_seconds
        || 0
      );
  }
}


async function closeStoredSessionIfNeeded(
  stored
) {
  if (
    !stored?.sessionId
    || stored.activityKey
      === currentActivityKey()
  ) {
    return;
  }


  try {
    await ambientacaoSb.rpc(
      "finish_study_session_v2",
      {
        p_session_id:
          stored.sessionId,

        p_duration_seconds:
          Math.max(
            0,
            Math.floor(
              Number(
                stored
                  .accumulatedSeconds
              )
              || 0
            )
          )
      }
    );

  } catch (error) {
    console.warn(
      "Não foi possível encerrar a sessão anterior:",
      error
    );
  }


  clearPomodoroLocal();
}


function restorePomodoroState() {
  const stored =
    readPomodoroLocal();


  if (
    !stored
    || stored.activityKey
      !== currentActivityKey()
  ) {
    pomodoroState.mode =
      "focus";

    pomodoroState.totalSeconds =
      pomodoroSettings
        .focusMinutes
      * 60;

    pomodoroState.remainingSeconds =
      pomodoroState
        .totalSeconds;

    pomodoroState.accumulatedSeconds =
      0;

    pomodoroState.sessionId =
      null;

    pomodoroState.running =
      false;

    return;
  }


  pomodoroState.mode =
    stored.mode
      === "break"
        ? "break"
        : "focus";

  pomodoroState.sessionId =
    stored.sessionId
    || null;

  pomodoroState.accumulatedSeconds =
    Math.max(
      0,
      Number(
        stored
          .accumulatedSeconds
      )
      || 0
    );

  pomodoroState.totalSeconds =
    Math.max(
      1,
      Number(
        stored
          .totalSeconds
      )
      || (
        pomodoroState.mode
          === "focus"
          ? pomodoroSettings
              .focusMinutes
          : pomodoroSettings
              .breakMinutes
      ) * 60
    );

  pomodoroState.remainingSeconds =
    Math.max(
      0,
      Math.min(
        pomodoroState
          .totalSeconds,
        Number(
          stored
            .remainingSeconds
        )
        || pomodoroState
          .totalSeconds
      )
    );

  /*
    Após recarregar a página,
    a sessão volta pausada.
    Assim o DocMap não conta
    tempo enquanto o navegador
    ficou fechado.
  */

  pomodoroState.running =
    false;

  pomodoroState.lastTickAt =
    null;
}


async function startStudySessionIfNeeded() {
  if (
    pomodoroState.sessionId
    || pomodoroState.mode
      !== "focus"
  ) {
    return;
  }


  const params =
    getAmbientacaoParams();


  const {
    data,
    error
  } =
    await ambientacaoSb.rpc(
      "start_study_session",
      {
        p_activity_kind:
          studyActivityKind(),

        p_source_id:
          studySourceId(),

        p_area:
          params.get("area")
          || null,

        p_materia:
          params.get("materia")
          || null
      }
    );


  if (error) {
    throw error;
  }


  pomodoroState.sessionId =
    data?.id
    || null;


  writePomodoroLocal();
}


async function startPomodoro() {
  if (
    pomodoroState.running
  ) {
    return;
  }


  setPomodoroStatus(
    pomodoroState.mode
      === "focus"
        ? "Iniciando sessão..."
        : ""
  );


  try {
    if (
      pomodoroState.mode
      === "focus"
    ) {
      await startStudySessionIfNeeded();
    }


    pomodoroState.running =
      true;

    pomodoroState.lastTickAt =
      Date.now();

    writePomodoroLocal();

    startPomodoroInterval();

    renderPomodoro();

    setPomodoroStatus(
      pomodoroState.mode
        === "focus"
          ? "Tempo de foco sendo contabilizado."
          : "Pausa em andamento."
    );

  } catch (error) {
    console.error(
      error
    );

    setPomodoroStatus(
      `Não foi possível iniciar: ${error.message}`,
      "error"
    );
  }
}


function pausePomodoro() {
  if (
    !pomodoroState.running
  ) {
    return;
  }


  applyRunningDelta();

  pomodoroState.running =
    false;

  pomodoroState.lastTickAt =
    null;

  stopPomodoroInterval();

  writePomodoroLocal();

  renderPomodoro();

  setPomodoroStatus(
    pomodoroState.mode
      === "focus"
        ? "Sessão pausada. O tempo pausado não é contabilizado."
        : "Pausa interrompida."
  );
}


function switchPomodoroMode(mode) {
  if (
    pomodoroState.running
  ) {
    return;
  }


  if (
    pomodoroState.sessionId
    && mode !== "focus"
  ) {
    setPomodoroStatus(
      "Finalize a sessão de foco antes de iniciar a pausa.",
      "error"
    );

    return;
  }


  pomodoroState.mode =
    mode;


  const minutes =
    mode === "focus"
      ? pomodoroSettings
          .focusMinutes
      : pomodoroSettings
          .breakMinutes;


  pomodoroState.totalSeconds =
    minutes * 60;

  pomodoroState.remainingSeconds =
    pomodoroState
      .totalSeconds;


  if (
    mode === "focus"
  ) {
    pomodoroState.accumulatedSeconds =
      0;

    pomodoroState.sessionId =
      null;
  }


  writePomodoroLocal();

  renderPomodoro();

  setPomodoroStatus(
    ""
  );
}


async function finishFocusSession(
  completedCycle = false
) {
  if (
    pomodoroState.finishing
  ) {
    return;
  }


  if (
    pomodoroState.running
  ) {
    applyRunningDelta();

    pomodoroState.running =
      false;

    pomodoroState.lastTickAt =
      null;

    stopPomodoroInterval();
  }


  if (
    !pomodoroState.sessionId
  ) {
    if (completedCycle) {
      switchPomodoroMode(
        "break"
      );
    }

    return;
  }


  pomodoroState.finishing =
    true;

  renderPomodoro();

  setPomodoroStatus(
    "Registrando tempo de estudo..."
  );


  const effectiveSeconds =
    Math.max(
      0,
      Math.floor(
        pomodoroState
          .accumulatedSeconds
      )
    );


  const {
    error
  } =
    await ambientacaoSb.rpc(
      "finish_study_session_v2",
      {
        p_session_id:
          pomodoroState
            .sessionId,

        p_duration_seconds:
          effectiveSeconds
      }
    );


  pomodoroState.finishing =
    false;


  if (error) {
    console.error(
      error
    );

    renderPomodoro();

    setPomodoroStatus(
      `Não foi possível registrar: ${error.message}`,
      "error"
    );

    return;
  }


  pomodoroState.sessionId =
    null;

  clearPomodoroLocal();

  await loadTodayStudyTime();


  if (completedCycle) {
    setPomodoroStatus(
      "Ciclo de foco concluído e registrado.",
      "success"
    );

    pomodoroState.mode =
      "break";

    pomodoroState.totalSeconds =
      pomodoroSettings
        .breakMinutes
      * 60;

    pomodoroState.remainingSeconds =
      pomodoroState
        .totalSeconds;

    pomodoroState.accumulatedSeconds =
      0;

    writePomodoroLocal();

    renderPomodoro();

    return;
  }


  setPomodoroStatus(
    `Sessão registrada: ${formatStudyDuration(
      effectiveSeconds
    )}.`,
    "success"
  );


  pomodoroState.mode =
    "focus";

  pomodoroState.totalSeconds =
    pomodoroSettings
      .focusMinutes
    * 60;

  pomodoroState.remainingSeconds =
    pomodoroState
      .totalSeconds;

  pomodoroState.accumulatedSeconds =
    0;

  writePomodoroLocal();

  renderPomodoro();
}


function wirePomodoro() {
  const activityCopy =
    document.getElementById(
      "pomodoro-activity-copy"
    );


  if (activityCopy) {
    const label =
      studyActivityLabel();

    activityCopy.textContent =
      getAmbientacaoParams()
        .get("title")
        ? `Atividade: ${label}. O tempo efetivo de foco será registrado no Dashboard.`
        : "Estudo livre. O tempo efetivo de foco será registrado no Dashboard.";
  }


  document
    .getElementById(
      "pomodoro-start"
    )
    ?.addEventListener(
      "click",
      startPomodoro
    );


  document
    .getElementById(
      "pomodoro-pause"
    )
    ?.addEventListener(
      "click",
      pausePomodoro
    );


  document
    .getElementById(
      "pomodoro-finish"
    )
    ?.addEventListener(
      "click",
      () =>
        finishFocusSession(
          false
        )
    );


  document
    .querySelectorAll(
      "[data-pomodoro-mode]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          switchPomodoroMode(
            button
              .dataset
              .pomodoroMode
          );
        }
      );
    });


  document.addEventListener(
    "visibilitychange",
    () => {
      /*
        Não pausamos quando a aba
        fica em segundo plano:
        o aluno pode estar usando
        outro material. O cálculo
        usa Date.now(), então não
        depende da frequência do
        setInterval.
      */

      if (
        !document.hidden
        && pomodoroState.running
      ) {
        applyRunningDelta();

        renderPomodoro();
      }
    }
  );


  window.addEventListener(
    "pagehide",
    () => {
      if (
        pomodoroState.running
      ) {
        applyRunningDelta();
      }

      /*
        Ao voltar, a sessão será
        restaurada pausada. Assim
        não contamos o período em
        que o site ficou fechado.
      */

      writePomodoroLocal();
    }
  );
}


async function initPomodoro() {
  ambientacaoUser =
    window.docmapUser;

  const stored =
    readPomodoroLocal();


  if (
    stored
    && stored.activityKey
      !== currentActivityKey()
  ) {
    await closeStoredSessionIfNeeded(
      stored
    );
  }


  await loadPomodoroSettings();

  restorePomodoroState();

  wirePomodoro();

  renderPomodoro();

  await loadTodayStudyTime();
}

function parseAmbientacaoDate(value) {
  if (!value) return "";

  const [year, month, day] =
    value.split("-").map(Number);

  const date =
    new Date(
      year,
      month - 1,
      day
    );

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }
  ).format(date);
}


function resizeStudyFrame(frame) {
  try {
    const doc =
      frame.contentDocument;

    if (!doc) return;

    const height =
      Math.max(
        620,
        doc.documentElement.scrollHeight,
        doc.body?.scrollHeight || 0
      );

    frame.style.height =
      `${height + 24}px`;

  } catch (error) {
    console.warn(
      "Não foi possível ajustar a altura da sessão de estudo:",
      error
    );
  }
}


function prepareEmbeddedStudyPage(
  frame,
  kind
) {
  try {
    const doc =
      frame.contentDocument;

    if (!doc) return;

    /*
      Remove a navegação duplicada da página
      carregada dentro da Ambientação.
    */

    [
      ".sidebar",
      ".sidebar-backdrop",
      ".topbar"
    ].forEach((selector) => {
      doc
        .querySelectorAll(selector)
        .forEach((element) => {
          element.style.display =
            "none";
        });
    });

    const appShell =
      doc.querySelector(
        ".app-shell"
      );

    if (appShell) {
      appShell.style.display =
        "block";

      appShell.style.minHeight =
        "0";
    }

    const main =
      doc.querySelector(
        ".main"
      );

    if (main) {
      main.style.padding =
        "0";

      main.style.opacity =
        "1";

      main.style.minWidth =
        "0";
    }

    const page =
      doc.querySelector(
        ".page"
      );

    if (page) {
      page.style.maxWidth =
        "none";

      page.style.margin =
        "0";
    }


    /*
      FLASHCARDS
    */

    if (
      kind === "flashcards_batch"
    ) {
      [
        ".flash-metrics",
        ".flash-tabs",
        '[data-flash-section="create"]',
        '[data-flash-section="import"]',
        '[data-flash-section="library"]'
      ].forEach((selector) => {
        doc
          .querySelectorAll(selector)
          .forEach((element) => {
            element.style.display =
              "none";
          });
      });

      const review =
        doc.querySelector(
          '[data-flash-section="review"]'
        );

      if (review) {
        review.classList.add(
          "active"
        );

        review.style.display =
          "block";
      }

      const reviewPanel =
        review?.querySelector(
          ".panel"
        );

      if (reviewPanel) {
        reviewPanel.style.marginTop =
          "0";

        reviewPanel.style.boxShadow =
          "none";
      }
    }


    /*
      CADERNO DE ERROS
    */

    if (
      kind === "errors_batch"
    ) {
      const intro =
        doc.querySelector(
          ".error-intro"
        );

      if (intro) {
        intro.style.display =
          "none";
      }

      const reviewPanel =
        doc.querySelector(
          ".error-review-panel"
        );

      if (reviewPanel) {
        reviewPanel.style.marginTop =
          "0";

        reviewPanel.style.boxShadow =
          "none";
      }
    }


    resizeStudyFrame(
      frame
    );


    if (
      "ResizeObserver"
      in window
      && doc.body
    ) {
      if (
        frame._docmapObserver
      ) {
        frame
          ._docmapObserver
          .disconnect();
      }

      const observer =
        new ResizeObserver(
          () => {
            resizeStudyFrame(
              frame
            );
          }
        );

      observer.observe(
        doc.body
      );

      frame._docmapObserver =
        observer;
    }

  } catch (error) {
    console.warn(
      "Não foi possível preparar a atividade dentro da Ambientação:",
      error
    );
  }
}


function openActivityWorkspace(params) {
  const kind =
    params.get("kind");

  const workspace =
    document.getElementById(
      "ambientacao-workspace"
    );

  const frame =
    document.getElementById(
      "ambientacao-study-frame"
    );

  const title =
    document.getElementById(
      "ambientacao-workspace-title"
    );

  const copy =
    document.getElementById(
      "ambientacao-workspace-copy"
    );

  if (
    !workspace
    || !frame
  ) {
    return;
  }


  const supported = [
    "flashcards_batch",
    "errors_batch"
  ];

  if (
    !supported.includes(
      kind
    )
  ) {
    workspace.hidden =
      true;

    frame.removeAttribute(
      "src"
    );

    return;
  }


  const activityDate =
    params.get("date");

  const activityArea =
    params.get("area");


  let pageName =
    "";

  if (
    kind === "flashcards_batch"
  ) {
    pageName =
      "flashcards.html";

    if (title) {
      title.textContent =
        "Flashcards";
    }

    if (copy) {
      copy.textContent =
        "Revise os flashcards programados na agenda sem sair da Ambientação.";
    }

    frame.title =
      "Revisão de flashcards";
  }


  if (
    kind === "errors_batch"
  ) {
    pageName =
      "caderno-erros.html";

    if (title) {
      title.textContent =
        "Caderno de erros";
    }

    if (copy) {
      copy.textContent =
        "Revise os erros programados na agenda sem sair da Ambientação.";
    }

    frame.title =
      "Revisão do caderno de erros";
  }


  const url =
    new URL(
      pageName,
      window.location.href
    );

  url.searchParams.set(
    "embed",
    "ambientacao"
  );


  if (activityDate) {
    url.searchParams.set(
      "agenda_date",
      activityDate
    );
  }


  if (activityArea) {
    url.searchParams.set(
      "agenda_area",
      activityArea
    );
  }


  workspace.hidden =
    false;


  frame.addEventListener(
    "load",
    () => {
      prepareEmbeddedStudyPage(
        frame,
        kind
      );
    },
    {
      once: true
    }
  );


  frame.src =
    url.toString();
}


function initSelectedActivity() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  const title =
    params.get("title");

  const container =
    document.getElementById(
      "selected-activity"
    );


  if (title) {
    const titleElement =
      document.getElementById(
        "selected-activity-title"
      );

    const metaElement =
      document.getElementById(
        "selected-activity-meta"
      );

    const bits = [
      params.get("area"),
      params.get("materia"),
      parseAmbientacaoDate(
        params.get("date")
      )
    ].filter(Boolean);


    titleElement.textContent =
      title;

    metaElement.textContent =
      bits.join(" · ");

    container.hidden =
      false;
  }


  openActivityWorkspace(
    params
  );


  document
    .getElementById(
      "clear-selected-activity"
    )
    ?.addEventListener(
      "click",
      () => {
        window.history.replaceState(
          {},
          "",
          "ambientacao.html"
        );

        container.hidden =
          true;


        const workspace =
          document.getElementById(
            "ambientacao-workspace"
          );

        const frame =
          document.getElementById(
            "ambientacao-study-frame"
          );


        if (workspace) {
          workspace.hidden =
            true;
        }


        if (frame) {
          frame.removeAttribute(
            "src"
          );
        }
      }
    );
}


if (window.docmapUser) {
  initSelectedActivity();

} else {
  window.addEventListener(
    "docmap:ready",
    initSelectedActivity,
    {
      once: true
    }
  );
}



if (window.docmapUser) {
  initPomodoro();

} else {
  window.addEventListener(
    "docmap:ready",
    initPomodoro,
    {
      once: true
    }
  );
}


function bindAmbientacaoLofi() {
  if (!window.docmapAudio) {
    return;
  }

  /*
    O app.js já conecta
    os controles de áudio.
  */
}


if (window.docmapAudio) {
  bindAmbientacaoLofi();

} else {
  window.addEventListener(
    "docmap:audio-ready",
    bindAmbientacaoLofi,
    {
      once: true
    }
  );
}
