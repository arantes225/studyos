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

let simpleTimerState = {
  running:
    false,

  sessionId:
    null,

  accumulatedSeconds:
    0,

  lastTickAt:
    null,

  timerId:
    null,

  finishing:
    false
};


let studyTimerView =
  "simple";


function simpleTimerStorageKey(
  userId
) {
  return `docmap:simple-timer:${userId}`;
}


function studyTimerViewStorageKey(
  userId
) {
  return `docmap:ambientacao-timer-view:${userId}`;
}



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


  const formatted =
    formatStudyDuration(
      data?.total_seconds
      || 0
    );


  [
    "pomodoro-today-time",
    "simple-today-time"
  ]
    .forEach(
      (id) => {
        const element =
          document.getElementById(
            id
          );

        if (element) {
          element.textContent =
            formatted;
        }
      }
    );
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



function readSimpleTimerLocal() {
  if (!ambientacaoUser) {
    return null;
  }

  try {
    return JSON.parse(
      localStorage.getItem(
        simpleTimerStorageKey(
          ambientacaoUser.id
        )
      )
      || "null"
    );
  } catch {
    return null;
  }
}


function writeSimpleTimerLocal() {
  if (!ambientacaoUser) {
    return;
  }

  try {
    localStorage.setItem(
      simpleTimerStorageKey(
        ambientacaoUser.id
      ),
      JSON.stringify({
        activityKey:
          currentActivityKey(),

        sessionId:
          simpleTimerState
            .sessionId,

        accumulatedSeconds:
          Math.max(
            0,
            Number(
              simpleTimerState
                .accumulatedSeconds
            )
            || 0
          )
      })
    );
  } catch {}
}


function clearSimpleTimerLocal() {
  if (!ambientacaoUser) {
    return;
  }

  try {
    localStorage.removeItem(
      simpleTimerStorageKey(
        ambientacaoUser.id
      )
    );
  } catch {}
}


function formatElapsedClock(
  seconds
) {
  const safe =
    Math.max(
      0,
      Math.floor(
        Number(seconds)
        || 0
      )
    );

  const hours =
    Math.floor(
      safe / 3600
    );

  const minutes =
    Math.floor(
      (
        safe % 3600
      )
      / 60
    );

  const rest =
    safe % 60;

  if (hours > 0) {
    return `${hours}:${String(
      minutes
    ).padStart(
      2,
      "0"
    )}:${String(
      rest
    ).padStart(
      2,
      "0"
    )}`;
  }

  return `${String(
    minutes
  ).padStart(
    2,
    "0"
  )}:${String(
    rest
  ).padStart(
    2,
    "0"
  )}`;
}


function currentSimpleTimerSeconds() {
  let seconds =
    Math.max(
      0,
      Number(
        simpleTimerState
          .accumulatedSeconds
      )
      || 0
    );

  if (
    simpleTimerState.running
    && simpleTimerState
      .lastTickAt
  ) {
    seconds +=
      Math.max(
        0,
        (
          Date.now()
          - simpleTimerState
              .lastTickAt
        )
        / 1000
      );
  }

  return seconds;
}


function setSimpleTimerStatus(
  text = "",
  type = ""
) {
  const element =
    document.getElementById(
      "simple-timer-status"
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


function renderSimpleTimer() {
  const seconds =
    currentSimpleTimerSeconds();

  const panel =
    document.getElementById(
      "simple-timer-panel"
    );

  const clock =
    document.getElementById(
      "simple-timer-clock"
    );

  const state =
    document.getElementById(
      "simple-timer-state"
    );

  const effective =
    document.getElementById(
      "simple-timer-effective-time"
    );

  const start =
    document.getElementById(
      "simple-timer-start"
    );

  const pause =
    document.getElementById(
      "simple-timer-pause"
    );

  const finish =
    document.getElementById(
      "simple-timer-finish"
    );


  if (clock) {
    clock.textContent =
      formatElapsedClock(
        seconds
      );
  }


  if (effective) {
    effective.textContent =
      formatStudyDuration(
        seconds
      );
  }


  if (panel) {
    panel.classList.toggle(
      "running",
      simpleTimerState.running
    );
  }


  if (state) {
    state.textContent =
      simpleTimerState.running
        ? "rodando"
        : simpleTimerState
            .sessionId
          ? "pausado"
          : "pronto";

    state.className =
      `pomodoro-state ${
        simpleTimerState.running
          ? "running"
          : simpleTimerState
              .sessionId
            ? "paused"
            : ""
      }`.trim();
  }


  if (start) {
    start.disabled =
      simpleTimerState.running
      || simpleTimerState.finishing;

    start.textContent =
      simpleTimerState
        .sessionId
        ? "Continuar"
        : "Iniciar";
  }


  if (pause) {
    pause.disabled =
      !simpleTimerState.running
      || simpleTimerState.finishing;
  }


  if (finish) {
    finish.disabled =
      !simpleTimerState
        .sessionId
      || simpleTimerState.finishing;
  }
}


function applySimpleTimerDelta() {
  if (
    !simpleTimerState.running
    || !simpleTimerState
      .lastTickAt
  ) {
    return;
  }

  const now =
    Date.now();

  simpleTimerState
    .accumulatedSeconds +=
      Math.max(
        0,
        (
          now
          - simpleTimerState
              .lastTickAt
        )
        / 1000
      );

  simpleTimerState
    .lastTickAt =
      now;
}


function stopSimpleTimerInterval() {
  if (
    simpleTimerState.timerId
  ) {
    clearInterval(
      simpleTimerState.timerId
    );

    simpleTimerState.timerId =
      null;
  }
}


function startSimpleTimerInterval() {
  stopSimpleTimerInterval();

  simpleTimerState.timerId =
    window.setInterval(
      () => {
        applySimpleTimerDelta();

        writeSimpleTimerLocal();

        renderSimpleTimer();
      },
      1000
    );
}


async function closeStoredSimpleTimerIfNeeded(
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
      "Não foi possível encerrar o cronômetro anterior:",
      error
    );
  }

  clearSimpleTimerLocal();
}


function restoreSimpleTimerState() {
  const stored =
    readSimpleTimerLocal();

  if (
    !stored
    || stored.activityKey
      !== currentActivityKey()
  ) {
    simpleTimerState.running =
      false;

    simpleTimerState.sessionId =
      null;

    simpleTimerState
      .accumulatedSeconds =
        0;

    simpleTimerState.lastTickAt =
      null;

    simpleTimerState.timerId =
      null;

    simpleTimerState.finishing =
      false;

    return;
  }

  simpleTimerState.running =
    false;

  simpleTimerState.sessionId =
    stored.sessionId
    || null;

  simpleTimerState
    .accumulatedSeconds =
      Math.max(
        0,
        Number(
          stored
            .accumulatedSeconds
        )
        || 0
      );

  simpleTimerState.lastTickAt =
    null;

  simpleTimerState.timerId =
    null;

  simpleTimerState.finishing =
    false;
}


async function startSimpleStudySessionIfNeeded() {
  if (
    simpleTimerState.sessionId
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
          params.get(
            "area"
          )
          || null,

        p_materia:
          params.get(
            "materia"
          )
          || null
      }
    );

  if (error) {
    throw error;
  }

  simpleTimerState.sessionId =
    data?.id
    || null;

  writeSimpleTimerLocal();
}


async function startSimpleTimer() {
  if (
    simpleTimerState.running
    || simpleTimerState.finishing
  ) {
    return;
  }

  setSimpleTimerStatus(
    "Iniciando sessão..."
  );

  try {
    await startSimpleStudySessionIfNeeded();

    simpleTimerState.running =
      true;

    simpleTimerState.lastTickAt =
      Date.now();

    writeSimpleTimerLocal();

    startSimpleTimerInterval();

    renderSimpleTimer();

    setSimpleTimerStatus(
      "Cronômetro em andamento. O tempo está sendo contabilizado."
    );

  } catch (error) {
    console.error(
      error
    );

    setSimpleTimerStatus(
      `Não foi possível iniciar: ${error.message}`,
      "error"
    );
  }
}


function pauseSimpleTimer() {
  if (
    !simpleTimerState.running
  ) {
    return;
  }

  applySimpleTimerDelta();

  simpleTimerState.running =
    false;

  simpleTimerState.lastTickAt =
    null;

  stopSimpleTimerInterval();

  writeSimpleTimerLocal();

  renderSimpleTimer();

  setSimpleTimerStatus(
    "Cronômetro pausado. O tempo pausado não é contabilizado."
  );
}


async function finishSimpleTimer() {
  if (
    simpleTimerState.finishing
  ) {
    return;
  }

  if (
    simpleTimerState.running
  ) {
    applySimpleTimerDelta();

    simpleTimerState.running =
      false;

    simpleTimerState.lastTickAt =
      null;

    stopSimpleTimerInterval();
  }

  if (
    !simpleTimerState.sessionId
  ) {
    renderSimpleTimer();

    return;
  }

  simpleTimerState.finishing =
    true;

  renderSimpleTimer();

  setSimpleTimerStatus(
    "Registrando tempo de estudo..."
  );

  const effectiveSeconds =
    Math.max(
      0,
      Math.floor(
        simpleTimerState
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
          simpleTimerState
            .sessionId,

        p_duration_seconds:
          effectiveSeconds
      }
    );

  simpleTimerState.finishing =
    false;

  if (error) {
    console.error(
      error
    );

    renderSimpleTimer();

    setSimpleTimerStatus(
      `Não foi possível registrar: ${error.message}`,
      "error"
    );

    return;
  }

  simpleTimerState.sessionId =
    null;

  simpleTimerState
    .accumulatedSeconds =
      0;

  clearSimpleTimerLocal();

  renderSimpleTimer();

  await loadTodayStudyTime();

  setSimpleTimerStatus(
    `Sessão registrada: ${formatStudyDuration(
      effectiveSeconds
    )}.`,
    "success"
  );
}


function readStudyTimerView() {
  if (!ambientacaoUser) {
    return "simple";
  }

  try {
    return localStorage.getItem(
      studyTimerViewStorageKey(
        ambientacaoUser.id
      )
    ) === "pomodoro"
      ? "pomodoro"
      : "simple";

  } catch {
    return "simple";
  }
}


function writeStudyTimerView(
  view
) {
  if (!ambientacaoUser) {
    return;
  }

  try {
    localStorage.setItem(
      studyTimerViewStorageKey(
        ambientacaoUser.id
      ),
      view
    );
  } catch {}
}


function renderStudyTimerView() {
  document
    .querySelectorAll(
      "[data-timer-panel]"
    )
    .forEach(
      (panel) => {
        panel.hidden =
          panel.dataset
            .timerPanel
          !== studyTimerView;
      }
    );


  document
    .querySelectorAll(
      "[data-timer-view]"
    )
    .forEach(
      (button) => {
        const active =
          button.dataset
            .timerView
          === studyTimerView;

        button.classList.toggle(
          "active",
          active
        );

        button.setAttribute(
          "aria-selected",
          active
            ? "true"
            : "false"
        );
      }
    );
}


function switchStudyTimerView(
  view
) {
  const next =
    view === "pomodoro"
      ? "pomodoro"
      : "simple";

  if (
    next === studyTimerView
  ) {
    return;
  }

  if (
    next === "simple"
    && (
      pomodoroState.running
      || pomodoroState
        .sessionId
    )
  ) {
    setPomodoroStatus(
      "Finalize a sessão de Pomodoro antes de trocar para o cronômetro simples.",
      "error"
    );

    return;
  }

  if (
    next === "pomodoro"
    && (
      simpleTimerState.running
      || simpleTimerState
        .sessionId
    )
  ) {
    setSimpleTimerStatus(
      "Finalize o cronômetro simples antes de trocar para o Pomodoro.",
      "error"
    );

    return;
  }

  studyTimerView =
    next;

  writeStudyTimerView(
    studyTimerView
  );

  renderStudyTimerView();
}


function wireStudyTimerViewMenu() {
  document
    .querySelectorAll(
      "[data-timer-view]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            switchStudyTimerView(
              button.dataset
                .timerView
            );
          }
        );
      }
    );
}


function wireSimpleTimer() {
  const activityCopy =
    document.getElementById(
      "simple-timer-activity-copy"
    );

  if (activityCopy) {
    const label =
      studyActivityLabel();

    activityCopy.textContent =
      getAmbientacaoParams()
        .get("title")
        ? `Atividade: ${label}. O tempo será registrado no Dashboard.`
        : "Estudo livre. O tempo será registrado no Dashboard.";
  }


  document
    .getElementById(
      "simple-timer-start"
    )
    ?.addEventListener(
      "click",
      startSimpleTimer
    );


  document
    .getElementById(
      "simple-timer-pause"
    )
    ?.addEventListener(
      "click",
      pauseSimpleTimer
    );


  document
    .getElementById(
      "simple-timer-finish"
    )
    ?.addEventListener(
      "click",
      finishSimpleTimer
    );


  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        !document.hidden
        && simpleTimerState.running
      ) {
        applySimpleTimerDelta();

        renderSimpleTimer();
      }
    }
  );


  window.addEventListener(
    "pagehide",
    () => {
      if (
        simpleTimerState.running
      ) {
        applySimpleTimerDelta();
      }

      writeSimpleTimerLocal();
    }
  );
}


async function initSimpleTimer() {
  const stored =
    readSimpleTimerLocal();

  if (
    stored
    && stored.activityKey
      !== currentActivityKey()
  ) {
    await closeStoredSimpleTimerIfNeeded(
      stored
    );
  }

  restoreSimpleTimerState();

  wireSimpleTimer();

  renderSimpleTimer();
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

  await initSimpleTimer();

  wireStudyTimerViewMenu();


  if (
    simpleTimerState.sessionId
  ) {
    studyTimerView =
      "simple";

  } else if (
    pomodoroState.sessionId
  ) {
    studyTimerView =
      "pomodoro";

  } else {
    studyTimerView =
      readStudyTimerView();
  }


  renderStudyTimerView();

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
        280,
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

      page.style.padding =
        "0";
    }


    if (doc.body) {
      doc.body.style.margin =
        "0";

      doc.body.style.padding =
        "0";

      doc.body.style.background =
        "transparent";
    }


    if (main) {
      main.style.marginLeft =
        "0";

      main.style.width =
        "100%";
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
        ".flash-review-header",
        "#review-empty",
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

        reviewPanel.style.border =
          "0";

        reviewPanel.style.background =
          "transparent";

        reviewPanel.style.padding =
          "0";

        reviewPanel.style.minHeight =
          "0";
      }
    }


    /*
      CADERNO DA REVISÃO
    */

    if (
      kind === "subject_review"
    ) {
      [
        ".notebook-tabs",
        ".notebook-topic-panel",
        "#notebook-view-library"
      ].forEach((selector) => {
        doc
          .querySelectorAll(
            selector
          )
          .forEach((element) => {
            element.style.display =
              "none";
          });
      });

      const editorView =
        doc.querySelector(
          "#notebook-view-editor"
        );

      if (editorView) {
        editorView.hidden =
          false;

        editorView.style.display =
          "block";
      }

      const workspace =
        doc.querySelector(
          ".notebook-workspace"
        );

      if (workspace) {
        workspace.style.display =
          "block";

        workspace.style.gridTemplateColumns =
          "1fr";
      }

      const column =
        doc.querySelector(
          ".notebook-editor-column"
        );

      if (column) {
        column.style.width =
          "100%";

        column.style.minWidth =
          "0";
      }

      const paper =
        doc.querySelector(
          ".notebook-paper"
        );

      if (paper) {
        paper.style.width =
          "min(100%, 980px)";

        paper.style.maxWidth =
          "980px";

        paper.style.margin =
          "0 auto";
      }
    }


    /*
      CADERNO DE ERROS
    */

    if (
      kind === "errors_batch"
    ) {
      [
        ".error-intro",
        ".error-metrics",
        ".error-create-panel",
        ".error-library-panel",
        ".error-review-header",
        "#error-empty"
      ].forEach((selector) => {
        doc
          .querySelectorAll(
            selector
          )
          .forEach((element) => {
            element.style.display =
              "none";
          });
      });


      const reviewPanel =
        doc.querySelector(
          ".error-review-panel"
        );


      if (reviewPanel) {
        reviewPanel.style.marginTop =
          "0";

        reviewPanel.style.boxShadow =
          "none";

        reviewPanel.style.border =
          "0";

        reviewPanel.style.background =
          "transparent";

        reviewPanel.style.padding =
          "0";

        reviewPanel.style.minHeight =
          "0";
      }


      const stage =
        doc.querySelector(
          "#error-stage"
        );


      if (stage) {
        stage.style.marginTop =
          "0";

        stage.style.maxWidth =
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



function setAgendaLessonStatus(
  text,
  type = ""
) {
  const element =
    document.getElementById(
      "agenda-lesson-status"
    );


  if (!element) {
    return;
  }


  element.textContent =
    text;


  element.className =
    `agenda-lesson-status ${type}`
      .trim();
}


function renderAgendaLesson(
  params
) {
  const container =
    document.getElementById(
      "ambientacao-lesson-activity"
    );


  const frame =
    document.getElementById(
      "ambientacao-study-frame"
    );


  if (!container) {
    return;
  }


  container.hidden =
    false;


  if (frame) {
    frame.hidden =
      true;

    frame.removeAttribute(
      "src"
    );
  }


  const title =
    params.get("title")
    || "Aula";


  const area =
    params.get("area");


  const materia =
    params.get("materia");


  const date =
    parseAmbientacaoDate(
      params.get("date")
    );


  const subtitle =
    params.get("subtitle");


  document
    .getElementById(
      "agenda-lesson-title"
    )
    .textContent =
      title;


  const meta =
    [
      area,
      materia,
      date
    ]
      .filter(
        Boolean
      )
      .join(
        " · "
      );


  document
    .getElementById(
      "agenda-lesson-meta"
    )
    .textContent =
      meta;


  const subtitleElement =
    document.getElementById(
      "agenda-lesson-subtitle"
    );


  if (subtitleElement) {
    subtitleElement.textContent =
      subtitle
      || "";

    subtitleElement.hidden =
      !subtitle;
  }


  const button =
    document.getElementById(
      "agenda-lesson-complete"
    );


  const itemId =
    params.get(
      "item_id"
    );


  if (button) {
    button.disabled =
      !isUuid(
        itemId
      );


    button.textContent =
      "Concluir aula";


    button.onclick =
      async () => {
        if (
          !isUuid(
            itemId
          )
        ) {
          setAgendaLessonStatus(
            "Não foi possível identificar esta aula.",
            "error"
          );

          return;
        }


        button.disabled =
          true;


        setAgendaLessonStatus(
          "Concluindo aula..."
        );


        const {
          error
        } =
          await ambientacaoSb.rpc(
            "complete_study_topic",
            {
              p_topic_id:
                itemId
            }
          );


        if (error) {
          console.error(
            error
          );


          button.disabled =
            false;


          setAgendaLessonStatus(
            `Não foi possível concluir: ${error.message}`,
            "error"
          );


          return;
        }


        button.textContent =
          "Aula concluída";


        setAgendaLessonStatus(
          "Concluída. As revisões teóricas foram agendadas.",
          "success"
        );
      };
  }


  setAgendaLessonStatus(
    ""
  );
}


async function renderAgendaSubjectReview(
  params
) {
  const container =
    document.getElementById(
      "ambientacao-lesson-activity"
    );

  const frame =
    document.getElementById(
      "ambientacao-study-frame"
    );

  if (
    !container
  ) {
    return;
  }

  container.hidden =
    false;

  if (
    frame
  ) {
    frame.hidden =
      true;

    frame.removeAttribute(
      "src"
    );
  }

  const itemId =
    params.get(
      "item_id"
    );

  const titleElement =
    document.getElementById(
      "agenda-lesson-title"
    );

  const metaElement =
    document.getElementById(
      "agenda-lesson-meta"
    );

  const subtitleElement =
    document.getElementById(
      "agenda-lesson-subtitle"
    );

  const button =
    document.getElementById(
      "agenda-lesson-complete"
    );

  if (
    titleElement
  ) {
    titleElement.textContent =
      params.get(
        "title"
      )
      || "Revisão";
  }

  if (
    metaElement
  ) {
    metaElement.textContent =
      [
        params.get(
          "area"
        ),
        params.get(
          "materia"
        ),
        parseAmbientacaoDate(
          params.get(
            "date"
          )
        )
      ]
        .filter(
          Boolean
        )
        .join(
          " · "
        );
  }

  if (
    subtitleElement
  ) {
    subtitleElement.textContent =
      params.get(
        "subtitle"
      )
      || "Revisão programada da matéria.";

    subtitleElement.hidden =
      false;
  }

  if (
    !isUuid(
      itemId
    )
  ) {
    if (
      button
    ) {
      button.disabled =
        true;

      button.textContent =
        "Concluir revisão";
    }

    setAgendaLessonStatus(
      "Não foi possível identificar esta revisão.",
      "error"
    );

    return;
  }

  const {
    data:
      review,
    error:
      reviewError
  } =
    await ambientacaoSb
      .from(
        "subject_reviews"
      )
      .select(
        "id,topic_id,stage,scheduled_date,completed_at"
      )
      .eq(
        "id",
        itemId
      )
      .maybeSingle();

  if (
    reviewError
  ) {
    console.error(
      reviewError
    );

    setAgendaLessonStatus(
      `Não foi possível carregar a revisão: ${reviewError.message}`,
      "error"
    );

    return;
  }

  if (
    review?.topic_id
  ) {
    const {
      data:
        topic
    } =
      await ambientacaoSb
        .from(
          "study_topics"
        )
        .select(
          "id,theme,area,materia"
        )
        .eq(
          "id",
          review.topic_id
        )
        .maybeSingle();

    if (
      topic
    ) {
      if (
        titleElement
      ) {
        titleElement.textContent =
          topic.theme
          || params.get(
            "title"
          )
          || "Revisão";
      }

      if (
        metaElement
      ) {
        metaElement.textContent =
          [
            topic.area
            || params.get(
              "area"
            ),
            topic.materia
            || params.get(
              "materia"
            ),
            parseAmbientacaoDate(
              review.scheduled_date
              || params.get(
                "date"
              )
            )
          ]
            .filter(
              Boolean
            )
            .join(
              " · "
            );
      }
    }

    if (
      frame
      && isUuid(
        review.topic_id
      )
    ) {
      const notebookUrl =
        new URL(
          "/caderno/",
          window.location.href
        );

      notebookUrl.searchParams.set(
        "embed",
        "ambientacao"
      );

      notebookUrl.searchParams.set(
        "topic_id",
        review.topic_id
      );

      frame.hidden =
        false;

      frame.title =
        "Caderno da matéria em revisão";

      frame.addEventListener(
        "load",
        () => {
          prepareEmbeddedStudyPage(
            frame,
            "subject_review"
          );
        },
        {
          once: true
        }
      );

      frame.src =
        notebookUrl.toString();
    }
  }

  if (
    button
  ) {
    button.textContent =
      review?.completed_at
        ? "Revisão concluída"
        : "Concluir revisão";

    button.disabled =
      Boolean(
        review?.completed_at
      );

    button.onclick =
      review?.completed_at
        ? null
        : async () => {
            button.disabled =
              true;

            setAgendaLessonStatus(
              "Concluindo revisão..."
            );

            const {
              error
            } =
              await ambientacaoSb
                .from(
                  "subject_reviews"
                )
                .update({
                  completed_at:
                    new Date()
                      .toISOString()
                })
                .eq(
                  "id",
                  itemId
                )
                .is(
                  "completed_at",
                  null
                );

            if (
              error
            ) {
              console.error(
                error
              );

              button.disabled =
                false;

              setAgendaLessonStatus(
                `Não foi possível concluir a revisão: ${error.message}`,
                "error"
              );

              return;
            }

            button.textContent =
              "Revisão concluída";

            setAgendaLessonStatus(
              "Revisão concluída.",
              "success"
            );
          };
  }

  if (
    review?.completed_at
  ) {
    setAgendaLessonStatus(
      "Esta revisão já foi concluída.",
      "success"
    );
  } else {
    setAgendaLessonStatus(
      ""
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


  const lesson =
    document.getElementById(
      "ambientacao-lesson-activity"
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
    "lesson",
    "subject_review",
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


    frame.hidden =
      true;


    frame.removeAttribute(
      "src"
    );


    if (lesson) {
      lesson.hidden =
        true;
    }


    return;
  }


  workspace.hidden =
    false;


  if (
    kind === "lesson"
  ) {
    if (title) {
      title.textContent =
        "Aula";
    }


    if (copy) {
      copy.textContent =
        "Atividade agendada.";
    }


    renderAgendaLesson(
      params
    );


    return;
  }


  if (
    kind === "subject_review"
  ) {
    if (
      title
    ) {
      title.textContent =
        "Revisão";
    }

    if (
      copy
    ) {
      copy.textContent =
        "Revisão agendada da matéria.";
    }

    workspace.classList.add(
      "lesson-with-notebook"
    );

    renderAgendaSubjectReview(
      params
    );

    return;
  }


  workspace.classList.remove(
    "lesson-with-notebook"
  );

  if (lesson) {
    lesson.hidden =
      true;
  }


  frame.hidden =
    false;


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
      "/flashcards/";


    if (title) {
      title.textContent =
        "Flashcards";
    }


    if (copy) {
      copy.textContent =
        "Flashcards agendados para esta atividade.";
    }


    frame.title =
      "Revisão de flashcards";
  }


  if (
    kind === "errors_batch"
  ) {
    pageName =
      "/caderno-erros/";


    if (title) {
      title.textContent =
        "Caderno de erros";
    }


    if (copy) {
      copy.textContent =
        "Pulos do Gato agendados para esta atividade.";
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
          "/ambientacao/"
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


        const lesson =
          document.getElementById(
            "ambientacao-lesson-activity"
          );


        if (workspace) {
          workspace.hidden =
            true;
        }


        if (frame) {
          frame.hidden =
            true;


          frame.removeAttribute(
            "src"
          );
        }


        if (lesson) {
          lesson.hidden =
            true;
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



/* =========================================================
   FASE 7.1 — CCQs COMO MOSTRADOR AUTOMÁTICO
   ========================================================= */

const CCQ_ROTATION_MS =
  30000;


const ccqState = {
  items: [],
  currentIndex: -1,
  bag: [],
  timerId: null,
  transitionId: null
};


function shuffleCcqIndexes(
  count
) {
  const indexes =
    Array.from(
      {
        length:
          count
      },
      (
        _,
        index
      ) =>
        index
    );


  for (
    let i =
      indexes.length - 1;

    i > 0;

    i -= 1
  ) {
    const j =
      Math.floor(
        Math.random()
        * (
          i + 1
        )
      );


    [
      indexes[i],
      indexes[j]
    ] =
      [
        indexes[j],
        indexes[i]
      ];
  }


  return indexes;
}


function refillCcqBag() {
  const count =
    ccqState.items.length;


  ccqState.bag =
    shuffleCcqIndexes(
      count
    );


  /*
    Evita repetir imediatamente
    o mesmo CCQ quando começa
    uma nova rodada.
  */

  if (
    count > 1
    && ccqState.currentIndex
      >= 0
    && ccqState.bag[
      ccqState.bag.length - 1
    ] === ccqState.currentIndex
  ) {
    const swapIndex =
      0;


    [
      ccqState.bag[
        swapIndex
      ],
      ccqState.bag[
        ccqState.bag.length - 1
      ]
    ] =
      [
        ccqState.bag[
          ccqState.bag.length - 1
        ],
        ccqState.bag[
          swapIndex
        ]
      ];
  }
}


function nextRandomCcqIndex() {
  if (
    !ccqState.items.length
  ) {
    return -1;
  }


  if (
    ccqState.items.length
    === 1
  ) {
    return 0;
  }


  if (
    !ccqState.bag.length
  ) {
    refillCcqBag();
  }


  let index =
    ccqState.bag.pop();


  if (
    index ===
      ccqState.currentIndex
    && ccqState.bag.length
  ) {
    const alternative =
      ccqState.bag.pop();


    ccqState.bag.push(
      index
    );


    index =
      alternative;
  }


  return index;
}


function ccqMetaText(
  item
) {
  return [
    item.area,
    item.materia,
    item.theme
  ]
    .filter(
      Boolean
    )
    .join(
      " · "
    );
}


function resetCcqProgress() {
  const bar =
    document.getElementById(
      "ccq-progress-bar"
    );


  if (!bar) {
    return;
  }


  bar.style.transition =
    "none";


  bar.style.width =
    "0%";


  void bar.offsetWidth;


  bar.style.transition =
    `width ${CCQ_ROTATION_MS}ms linear`;


  requestAnimationFrame(
    () => {
      bar.style.width =
        "100%";
    }
  );
}


function writeCcqContent(
  item
) {
  const text =
    document.getElementById(
      "ccq-text"
    );


  const meta =
    document.getElementById(
      "ccq-meta"
    );


  if (text) {
    text.textContent =
      item?.ccq
      || "";
  }


  if (meta) {
    const metaText =
      ccqMetaText(
        item
      );


    meta.textContent =
      metaText;


    meta.hidden =
      !metaText;
  }
}


function showRandomCcq(
  animate = true
) {
  if (
    !ccqState.items.length
  ) {
    return;
  }


  const slide =
    document.getElementById(
      "ccq-slide"
    );


  const nextIndex =
    nextRandomCcqIndex();


  if (
    nextIndex < 0
  ) {
    return;
  }


  const nextItem =
    ccqState.items[
      nextIndex
    ];


  window.clearTimeout(
    ccqState.transitionId
  );


  if (
    !animate
    || !slide
  ) {
    ccqState.currentIndex =
      nextIndex;


    writeCcqContent(
      nextItem
    );


    resetCcqProgress();

    return;
  }


  slide.classList.add(
    "is-leaving"
  );


  ccqState.transitionId =
    window.setTimeout(
      () => {
        ccqState.currentIndex =
          nextIndex;


        writeCcqContent(
          nextItem
        );


        slide.classList.remove(
          "is-leaving"
        );


        slide.classList.add(
          "is-entering"
        );


        requestAnimationFrame(
          () => {
            requestAnimationFrame(
              () => {
                slide.classList.remove(
                  "is-entering"
                );
              }
            );
          }
        );


        resetCcqProgress();

      },
      420
    );
}


function stopCcqRotation() {
  if (
    ccqState.timerId
  ) {
    clearInterval(
      ccqState.timerId
    );


    ccqState.timerId =
      null;
  }


  window.clearTimeout(
    ccqState.transitionId
  );
}


function startCcqRotation() {
  stopCcqRotation();


  if (
    ccqState.items.length
    < 2
  ) {
    return;
  }


  ccqState.timerId =
    window.setInterval(
      () => {
        if (
          document.hidden
        ) {
          return;
        }


        showRandomCcq(
          true
        );
      },
      CCQ_ROTATION_MS
    );
}


async function loadCcqRotation() {
  if (
    !window.docmapUser
  ) {
    return;
  }


  const showcase =
    document.getElementById(
      "ccq-showcase"
    );


  const empty =
    document.getElementById(
      "ccq-empty"
    );


  const {
    data,
    error
  } =
    await ambientacaoSb
      .from(
        "error_notebook"
      )
      .select(
        "id,area,materia,theme,ccq,due_date,review_count,created_at"
      )
      .eq(
        "active",
        true
      )
      .not(
        "ccq",
        "is",
        null
      )
      .limit(
        100
      );


  if (error) {
    console.warn(
      "Não foi possível carregar os Pulos do Gato:",
      error.message
    );


    ccqState.items =
      [];


    if (showcase) {
      showcase.hidden =
        true;
    }


    if (empty) {
      empty.hidden =
        false;
    }


    return;
  }


  ccqState.items =
    (data || [])
      .filter(
        (item) =>
          String(
            item.ccq
            || ""
          ).trim()
      );


  ccqState.currentIndex =
    -1;


  ccqState.bag =
    [];


  if (
    !ccqState.items.length
  ) {
    if (showcase) {
      showcase.hidden =
        true;
    }


    if (empty) {
      empty.hidden =
        false;
    }


    return;
  }


  if (empty) {
    empty.hidden =
      true;
  }


  if (showcase) {
    showcase.hidden =
      false;
  }


  showRandomCcq(
    false
  );


  startCcqRotation();
}


function wireCcqRotation() {
  /*
    Sem botões:
    funciona como um banner de
    site de compras, passando
    sozinho a cada 30 segundos.
  */


  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        document.hidden
      ) {
        return;
      }


      /*
        Ao voltar para a aba,
        reinicia os 30 segundos.
      */

      resetCcqProgress();

      startCcqRotation();
    }
  );


  window.addEventListener(
    "pagehide",
    stopCcqRotation
  );
}


async function initCcqRotation() {
  wireCcqRotation();


  await loadCcqRotation();
}


if (window.docmapUser) {
  initCcqRotation();

} else {
  window.addEventListener(
    "docmap:ready",
    initCcqRotation,
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
