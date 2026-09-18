const dashboardSb = window.supabaseClient;

const agendaState = {
  view: "week",
  anchorDate: startOfDay(new Date()),
  items: [],
  itemMap: new Map(),
  movingKey: null,
  loading: false
};

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, amount) {
  const copy = startOfDay(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function addMonths(date, amount) {
  const copy = startOfDay(date);
  copy.setDate(1);
  copy.setMonth(copy.getMonth() + amount);
  return copy;
}

function startOfWeek(date) {
  const copy = startOfDay(date);
  const day = copy.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  return addDays(copy, delta);
}

function endOfWeek(date) {
  return addDays(startOfWeek(date), 6);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseISODate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function sameDate(a, b) {
  return toISODate(a) === toISODate(b);
}

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short"
  }).format(date).replace(".", "");
}

function formatMonthYear(date) {
  return capitalize(
    new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric"
    }).format(date)
  );
}

function formatWeekRange(start, end) {
  if (start.getMonth() === end.getMonth()) {
    const monthYear = new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric"
    }).format(end);

    return `${start.getDate()}–${end.getDate()} de ${monthYear}`;
  }

  return `${formatShortDate(start)} – ${formatShortDate(end)} de ${end.getFullYear()}`;
}

function getVisibleRange() {
  if (agendaState.view === "week") {
    const start = startOfWeek(agendaState.anchorDate);
    return {
      displayStart: start,
      displayEnd: endOfWeek(agendaState.anchorDate),
      queryStart: start,
      queryEnd: endOfWeek(agendaState.anchorDate)
    };
  }

  const monthStart = startOfMonth(agendaState.anchorDate);
  const monthEnd = endOfMonth(agendaState.anchorDate);
  const gridStart = startOfWeek(monthStart);
  const finalWeekStart = startOfWeek(monthEnd);
  const gridEnd = addDays(finalWeekStart, 6);

  return {
    displayStart: monthStart,
    displayEnd: monthEnd,
    queryStart: gridStart,
    queryEnd: gridEnd
  };
}

function kindMeta(kind) {
  const map = {
    lesson: { label: "Aula", className: "lesson" },
    subject_review: { label: "Revisão", className: "subject-review" },
    flashcards_batch: { label: "Flashcards", className: "flashcards" },
    errors_batch: { label: "Caderno de erros", className: "errors" },
    simulation: { label: "Simulado", className: "exam" },
    smart_simulation: { label: "Simulado inteligente", className: "exam" },
    full_exam: { label: "Prova na íntegra", className: "exam" },
    smart_review: { label: "Revisão inteligente", className: "subject-review" },
    external_review: { label: "Revisão teórica", className: "subject-review" },
    final_review: { label: "Reta final", className: "lesson" },
    other: { label: "Evento", className: "default" },
    exam: { label: "Prova", className: "exam" },
    registration_deadline: { label: "Inscrição", className: "registration" }
  };

  return map[kind] || { label: "Atividade", className: "default" };
}

function activityCanStart(item) {
  return [
    "lesson",
    "subject_review",
    "flashcards_batch",
    "errors_batch"
  ].includes(item.kind);
}

function activityCanMove(item) {
  return item.movable === true;
}

function buildAmbientacaoUrl(item) {
  const params = new URLSearchParams({
    kind: item.kind,
    date: item.activity_date,
    title: item.title || "Atividade"
  });

  if (item.item_id) params.set("item_id", item.item_id);
  if (item.area) params.set("area", item.area);
  if (item.materia) params.set("materia", item.materia);
  if (item.subtitle) params.set("subtitle", item.subtitle);

  return `ambientacao.html?${params.toString()}`;
}

function escapeDashboardHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderActivityCard(item) {
  const meta = kindMeta(item.kind);
  const canMove = activityCanMove(item);
  const canStart = activityCanStart(item);

  const areaText = item.area
    ? `<span>${escapeDashboardHtml(item.area)}</span>`
    : "";

  const matterText = item.materia
    ? `<span>${escapeDashboardHtml(item.materia)}</span>`
    : "";

  const actions = [];

  if (canStart) {
    actions.push(
      `<a class="agenda-card-action primary-action" href="${escapeDashboardHtml(buildAmbientacaoUrl(item))}">Iniciar</a>`
    );
  } else if (item.kind === "exam" || item.kind === "registration_deadline") {
    const examUrl =
      item.item_id
        ? `editais.html?exam_id=${encodeURIComponent(item.item_id)}`
        : "editais.html";

    actions.push(
      `<a class="agenda-card-action" href="${escapeDashboardHtml(examUrl)}">Abrir</a>`
    );
  }

  if (canMove) {
    actions.push(
      `<button class="agenda-card-action move-action" type="button" data-move-key="${escapeDashboardHtml(item.agenda_key)}">Mover</button>`
    );
  }

  return `
    <article
      class="agenda-card ${meta.className}"
      ${canMove ? 'draggable="true"' : ""}
      data-agenda-key="${escapeDashboardHtml(item.agenda_key)}"
    >
      <div class="agenda-card-top">
        <span class="agenda-kind">${escapeDashboardHtml(meta.label)}</span>
        ${item.item_count > 1 ? `<span class="agenda-count">${item.item_count}</span>` : ""}
      </div>

      <strong class="agenda-title">${escapeDashboardHtml(item.title || meta.label)}</strong>

      <div class="agenda-meta">
        ${areaText}
        ${matterText}
      </div>

      <p class="agenda-subtitle">${escapeDashboardHtml(item.subtitle || "")}</p>

      <div class="agenda-card-actions">
        ${actions.join("")}
      </div>
    </article>
  `;
}

function itemsForDate(date) {
  const iso = toISODate(date);
  return agendaState.items.filter((item) => item.activity_date === iso);
}

function renderWeek() {
  const { displayStart } = getVisibleRange();
  const today = startOfDay(new Date());

  const days = Array.from({ length: 7 }, (_, index) => addDays(displayStart, index));

  return `
    <div class="week-calendar">
      ${days.map((date) => {
        const dayItems = itemsForDate(date);
        const isToday = sameDate(date, today);

        const weekday = capitalize(
          new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
            .format(date)
            .replace(".", "")
        );

        return `
          <section
            class="calendar-day ${isToday ? "today" : ""}"
            data-drop-date="${toISODate(date)}"
          >
            <header class="calendar-day-header">
              <span>${escapeDashboardHtml(weekday)}</span>
              <strong>${date.getDate()}</strong>
            </header>

            <div class="calendar-day-body">
              ${dayItems.length
                ? dayItems.map(renderActivityCard).join("")
                : '<div class="empty-day">Sem atividades</div>'}
            </div>
          </section>
        `;
      }).join("")}
    </div>
  `;
}

function renderMonth() {
  const { queryStart, queryEnd, displayStart } = getVisibleRange();
  const today = startOfDay(new Date());

  const days = [];
  let cursor = queryStart;

  while (cursor <= queryEnd) {
    days.push(startOfDay(cursor));
    cursor = addDays(cursor, 1);
  }

  const weekdayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return `
    <div class="month-calendar">
      <div class="month-weekdays">
        ${weekdayLabels.map((label) => `<span>${label}</span>`).join("")}
      </div>

      <div class="month-grid">
        ${days.map((date) => {
          const dayItems = itemsForDate(date);
          const outside = date.getMonth() !== displayStart.getMonth();
          const isToday = sameDate(date, today);

          return `
            <section
              class="month-day ${outside ? "outside" : ""} ${isToday ? "today" : ""}"
              data-drop-date="${toISODate(date)}"
            >
              <header>
                <span>${date.getDate()}</span>
              </header>

              <div class="month-day-items">
                ${dayItems.length
                  ? dayItems.map(renderActivityCard).join("")
                  : ""}
              </div>
            </section>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderCalendar() {
  const calendar = document.getElementById("calendar");
  const label = document.getElementById("calendar-range-label");

  if (!calendar || !label) return;

  const range = getVisibleRange();

  if (agendaState.view === "week") {
    label.textContent = formatWeekRange(range.displayStart, range.displayEnd);
    calendar.innerHTML = renderWeek();
  } else {
    label.textContent = formatMonthYear(range.displayStart);
    calendar.innerHTML = renderMonth();
  }

  wireCalendarInteractions();
}

function setCalendarStatus(text, type = "") {
  const element = document.getElementById("calendar-status");
  if (!element) return;

  element.textContent = text;
  element.className = `calendar-status ${type}`.trim();
}

function wireCalendarInteractions() {
  document.querySelectorAll(".agenda-card[draggable='true']").forEach((card) => {
    card.addEventListener("dragstart", (event) => {
      const key = card.dataset.agendaKey;
      event.dataTransfer.setData("text/plain", key);
      event.dataTransfer.effectAllowed = "move";
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      document.querySelectorAll("[data-drop-date].drop-target").forEach((el) => {
        el.classList.remove("drop-target");
      });
    });
  });

  document.querySelectorAll("[data-drop-date]").forEach((day) => {
    day.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      day.classList.add("drop-target");
    });

    day.addEventListener("dragleave", () => {
      day.classList.remove("drop-target");
    });

    day.addEventListener("drop", async (event) => {
      event.preventDefault();
      day.classList.remove("drop-target");

      const key = event.dataTransfer.getData("text/plain");
      const item = agendaState.itemMap.get(key);
      const newDate = day.dataset.dropDate;

      if (!item || !newDate || item.activity_date === newDate) return;

      await moveAgendaItem(item, newDate);
    });
  });

  document.querySelectorAll("[data-move-key]").forEach((button) => {
    button.addEventListener("click", () => {
      openMoveDialog(button.dataset.moveKey);
    });
  });
}

async function loadAgenda() {
  if (agendaState.loading) return;

  agendaState.loading = true;
  setCalendarStatus("Carregando agenda...");

  const { queryStart, queryEnd } = getVisibleRange();

  const { data, error } = await dashboardSb
    .from("agenda_feed")
    .select("*")
    .gte("activity_date", toISODate(queryStart))
    .lte("activity_date", toISODate(queryEnd))
    .order("activity_date", { ascending: true });

  agendaState.loading = false;

  if (error) {
    console.error(error);
    agendaState.items = [];
    agendaState.itemMap = new Map();
    renderCalendar();
    setCalendarStatus("Não foi possível carregar a agenda.", "error");
    return;
  }

  agendaState.items = data || [];
  agendaState.itemMap = new Map(
    agendaState.items.map((item) => [item.agenda_key, item])
  );

  renderCalendar();

  const count = agendaState.items.length;
  setCalendarStatus(
    count
      ? `${count} atividade${count === 1 ? "" : "s"} neste período.`
      : "Nenhuma atividade neste período."
  );
}

async function moveAgendaItem(item, newDate) {
  if (!activityCanMove(item)) return;

  setCalendarStatus("Remarcando atividade...");

  const { error } = await dashboardSb.rpc("move_agenda_item", {
    p_kind: item.kind,
    p_item_id: item.item_id || null,
    p_from_date: item.activity_date,
    p_to_date: newDate,
    p_area: item.area || null
  });

  if (error) {
    console.error(error);
    setCalendarStatus(`Erro ao mover: ${error.message}`, "error");
    return;
  }

  setCalendarStatus("Atividade remarcada.", "success");
  await Promise.all([loadAgenda(), loadDashboardMetrics()]);
}

function openMoveDialog(key) {
  const item = agendaState.itemMap.get(key);
  const dialog = document.getElementById("move-dialog");

  if (!item || !dialog) return;

  agendaState.movingKey = key;

  document.getElementById("move-title").textContent =
    item.title || kindMeta(item.kind).label;

  document.getElementById("move-date").value = item.activity_date;

  dialog.showModal();
}

function closeMoveDialog() {
  const dialog = document.getElementById("move-dialog");

  agendaState.movingKey = null;

  if (dialog?.open) {
    dialog.close();
  }
}

async function handleMoveForm(event) {
  event.preventDefault();

  const item = agendaState.itemMap.get(agendaState.movingKey);
  const date = document.getElementById("move-date").value;

  if (!item || !date) return;

  closeMoveDialog();

  if (date === item.activity_date) return;

  await moveAgendaItem(item, date);
}

function formatHours(totalSeconds) {
  const seconds = Number(totalSeconds || 0);

  if (seconds <= 0) return "0h";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;

  return `${hours}h ${minutes}min`;
}

async function loadStudyHours() {
  const start = startOfWeek(new Date());
  const today = startOfDay(new Date());

  const { data, error } = await dashboardSb
    .from("study_hours_daily")
    .select("total_seconds")
    .gte("study_date", toISODate(start))
    .lte("study_date", toISODate(today));

  if (error) {
    console.warn(error);
    return;
  }

  const seconds = (data || []).reduce(
    (sum, row) => sum + Number(row.total_seconds || 0),
    0
  );

  document.getElementById("metric-hours").textContent = formatHours(seconds);
}

async function loadRetention() {
  const value =
    document.getElementById(
      "metric-retention"
    );

  const helper =
    document.getElementById(
      "metric-retention-helper"
    );


  const {
    data,
    error
  } =
    await dashboardSb
      .from(
        "flashcard_retention_overall"
      )
      .select(
        "reviewed_cards,retention_percent"
      )
      .maybeSingle();


  if (error) {
    console.warn(
      error
    );

    if (value) {
      value.textContent =
        "—";
    }

    if (helper) {
      helper.textContent =
        "Sem dados suficientes";
    }

    return;
  }


  if (
    !data
    || data.retention_percent
      === null
  ) {
    if (value) {
      value.textContent =
        "—";
    }

    if (helper) {
      helper.textContent =
        "Revise flashcards para estimar";
    }

    return;
  }


  const retention =
    Number(
      data.retention_percent
      || 0
    );

  const reviewed =
    Number(
      data.reviewed_cards
      || 0
    );


  if (value) {
    value.textContent =
      `${retention.toFixed(0)}%`;
  }


  if (helper) {
    helper.textContent =
      `${reviewed} card${reviewed === 1 ? "" : "s"} com memória estimada`;
  }
}


async function loadLessonMetrics() {
  const today =
    toISODate(
      new Date()
    );


  const [
    totalResult,
    completedResult,
    overdueResult
  ] =
    await Promise.all([

      dashboardSb
        .from(
          "study_topics"
        )
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true
          }
        ),

      dashboardSb
        .from(
          "study_topics"
        )
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true
          }
        )
        .eq(
          "status",
          "completed"
        ),

      dashboardSb
        .from(
          "study_topics"
        )
        .select(
          "id",
          {
            count:
              "exact",

            head:
              true
          }
        )
        .eq(
          "status",
          "scheduled"
        )
        .is(
          "completed_at",
          null
        )
        .lt(
          "scheduled_date",
          today
        )
    ]);


  [
    totalResult,
    completedResult,
    overdueResult
  ].forEach(
    (result) => {
      if (result.error) {
        console.warn(
          result.error
        );
      }
    }
  );


  const total =
    totalResult.count
    ?? 0;

  const completed =
    completedResult.count
    ?? 0;

  const overdue =
    overdueResult.count
    ?? 0;

  const progress =
    total > 0
      ? (
          completed
          / total
        )
        * 100
      : 0;


  const overdueValue =
    document.getElementById(
      "metric-overdue-lessons"
    );

  const overdueHelper =
    document.getElementById(
      "metric-overdue-lessons-helper"
    );


  if (overdueValue) {
    overdueValue.textContent =
      overdue;
  }


  if (overdueHelper) {
    overdueHelper.textContent =
      overdue === 0
        ? "Cronograma em dia"
        : `${overdue} aula${overdue === 1 ? "" : "s"} com data anterior a hoje`;
  }


  const progressValue =
    document.getElementById(
      "metric-lessons-progress"
    );

  const progressCopy =
    document.getElementById(
      "metric-lessons-progress-copy"
    );

  const progressHelper =
    document.getElementById(
      "metric-lessons-progress-helper"
    );

  const progressRing =
    document.getElementById(
      "lesson-progress-ring"
    );


  if (progressValue) {
    progressValue.textContent =
      `${progress.toFixed(0)}%`;
  }


  if (progressCopy) {
    progressCopy.textContent =
      `${completed}/${total}`;
  }


  if (progressHelper) {
    progressHelper.textContent =
      total
        ? "Aulas feitas / aulas totais"
        : "Nenhuma aula cadastrada";
  }


  if (progressRing) {
    progressRing.style
      .setProperty(
        "--metric-ring-value",
        Math.max(
          0,
          Math.min(
            100,
            progress
          )
        )
      );
  }
}


async function loadErrorMetrics() {
  const value =
    document.getElementById(
      "metric-errors"
    );

  const helper =
    document.getElementById(
      "metric-errors-helper"
    );

  const retentionValue =
    document.getElementById(
      "metric-error-retention"
    );

  const ring =
    document.getElementById(
      "error-retention-ring"
    );


  const {
    data,
    error
  } =
    await dashboardSb
      .from(
        "error_notebook_metrics"
      )
      .select(
        "registered_errors,reviewed_errors,overdue_errors,retention_percent"
      )
      .maybeSingle();


  if (error) {
    console.warn(
      error
    );

    if (value) {
      value.textContent =
        "—";
    }

    if (helper) {
      helper.textContent =
        "Sem dados do Caderno";
    }

    if (retentionValue) {
      retentionValue.textContent =
        "—";
    }

    return;
  }


  const overdue =
    Number(
      data?.overdue_errors
      || 0
    );

  const total =
    Number(
      data?.registered_errors
      || 0
    );

  const retention =
    data?.retention_percent
      === null
      || data?.retention_percent
        === undefined
        ? null
        : Number(
            data.retention_percent
          );


  if (value) {
    value.textContent =
      overdue === 1
        ? "1 atrasado"
        : `${overdue} atrasados`;
  }


  if (helper) {
    helper.textContent =
      `${total} CCQ${total === 1 ? "" : "s"} ativo${total === 1 ? "" : "s"}`;
  }


  if (retentionValue) {
    retentionValue.textContent =
      retention === null
        ? "—"
        : `${retention.toFixed(0)}%`;
  }


  if (ring) {
    ring.style
      .setProperty(
        "--metric-ring-value",
        retention === null
          ? 0
          : Math.max(
              0,
              Math.min(
                100,
                retention
              )
            )
      );
  }
}

async function loadFlashcardMetrics() {
  const today = toISODate(new Date());

  const [pendingResult, dailyResult] = await Promise.all([
    dashboardSb
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .lte("due_date", today),

    dashboardSb
      .from("flashcard_metrics_daily")
      .select("total_reviews,correct,incorrect")
      .eq("review_date", today)
      .maybeSingle()
  ]);

  if (pendingResult.error) {
    console.warn(pendingResult.error);
  }

  if (dailyResult.error) {
    console.warn(dailyResult.error);
  }

  const pending = pendingResult.count ?? 0;
  const daily = dailyResult.data || {
    total_reviews: 0,
    correct: 0,
    incorrect: 0
  };

  document.getElementById("metric-flashcards").textContent =
    `${pending} pendente${pending === 1 ? "" : "s"}`;

  document.getElementById("metric-flashcards-helper").textContent =
    `Hoje: ${daily.correct || 0} acertos · ${daily.incorrect || 0} erros`;
}


async function loadQuestionDifficulty() {
  const value =
    document.getElementById("metric-difficulty");

  const helper =
    document.getElementById("metric-difficulty-helper");

  if (!value || !helper) return;

  const { data, error } = await dashboardSb
    .from("question_area_difficulty")
    .select("area,wrong_count,set_count,error_share_percent")
    .order("wrong_count", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(error);
    value.textContent = "—";
    helper.textContent = "Sem dados de simulados";
    return;
  }

  if (!data) {
    value.textContent = "—";
    helper.textContent = "Classifique os erros dos simulados";
    return;
  }

  value.textContent = data.area;

  const wrongCount =
    Number(data.wrong_count || 0);

  const share =
    Number(data.error_share_percent || 0);

  if (wrongCount < 3) {
    helper.textContent =
      `${wrongCount} ${wrongCount === 1 ? "erro classificado" : "erros classificados"} · poucos dados`;
    return;
  }

  helper.textContent =
    `${wrongCount} erros · ${share.toFixed(0)}% dos erros classificados`;
}



function dashboardEscapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}



function formatSimulationAccuracy(value) {
  if (
    value === null
    || value === undefined
    || Number.isNaN(
      Number(value)
    )
  ) {
    return "—";
  }

  return `${Number(value)
    .toFixed(1)
    .replace(".", ",")}%`;
}


async function loadSimulationMetrics() {
  const value =
    document.getElementById(
      "metric-simulations"
    );

  const helper =
    document.getElementById(
      "metric-simulations-helper"
    );

  const accuracyElement =
    document.getElementById(
      "metric-simulations-accuracy"
    );

  const accuracyRing =
    document.getElementById(
      "simulation-accuracy-ring"
    );


  if (
    !value
    || !helper
  ) {
    return;
  }


  const start30 =
    new Date();

  start30.setDate(
    start30.getDate()
    - 29
  );

  start30.setHours(
    0,
    0,
    0,
    0
  );


  const {
    data,
    error
  } =
    await dashboardSb
      .from(
        "question_set_metrics"
      )
      .select(
        "set_id,answered_count,correct_count,last_answered_at"
      )
      .gt(
        "answered_count",
        0
      )
      .gte(
        "last_answered_at",
        start30.toISOString()
      );


  if (error) {
    console.warn(
      error
    );

    value.textContent =
      "—";

    helper.textContent =
      "Não foi possível carregar";

    if (accuracyElement) {
      accuracyElement.textContent =
        "—";
    }

    if (accuracyRing) {
      accuracyRing.style
        .setProperty(
          "--metric-ring-value",
          0
        );
    }

    return;
  }


  const rows =
    data
    || [];


  const setCount =
    rows.length;


  const answered30 =
    rows.reduce(
      (
        sum,
        row
      ) =>
        sum
        + Number(
            row.answered_count
            || 0
          ),
      0
    );


  const correct30 =
    rows.reduce(
      (
        sum,
        row
      ) =>
        sum
        + Number(
            row.correct_count
            || 0
          ),
      0
    );


  const accuracy30 =
    answered30 > 0
      ? (
          correct30
          / answered30
        )
        * 100
      : null;


  value.textContent =
    setCount;


  helper.textContent =
    setCount
      ? `${setCount} simulado${setCount === 1 ? "" : "s"} nos últimos 30 dias`
      : "Nenhum simulado nos últimos 30 dias";


  if (accuracyElement) {
    accuracyElement.textContent =
      accuracy30 === null
        ? "—"
        : `${accuracy30.toFixed(0)}%`;
  }


  if (accuracyRing) {
    accuracyRing.style
      .setProperty(
        "--metric-ring-value",
        accuracy30 === null
          ? 0
          : Math.max(
              0,
              Math.min(
                100,
                accuracy30
              )
            )
      );
  }
}

async function loadDashboardMetrics() {
  await Promise.all([
    loadStudyHours(),
    loadLessonMetrics(),
    loadRetention(),
    loadFlashcardMetrics(),
    loadErrorMetrics(),
    loadQuestionDifficulty(),
    loadSimulationMetrics()
  ]);
}

function wireDashboardControls() {
  const weekButton = document.getElementById("view-week");
  const monthButton = document.getElementById("view-month");

  weekButton.addEventListener("click", async () => {
    if (agendaState.view === "week") return;

    agendaState.view = "week";
    weekButton.classList.add("active");
    monthButton.classList.remove("active");

    await loadAgenda();
  });

  monthButton.addEventListener("click", async () => {
    if (agendaState.view === "month") return;

    agendaState.view = "month";
    monthButton.classList.add("active");
    weekButton.classList.remove("active");

    await loadAgenda();
  });

  document.getElementById("calendar-prev").addEventListener("click", async () => {
    agendaState.anchorDate =
      agendaState.view === "week"
        ? addDays(agendaState.anchorDate, -7)
        : addMonths(agendaState.anchorDate, -1);

    await loadAgenda();
  });

  document.getElementById("calendar-next").addEventListener("click", async () => {
    agendaState.anchorDate =
      agendaState.view === "week"
        ? addDays(agendaState.anchorDate, 7)
        : addMonths(agendaState.anchorDate, 1);

    await loadAgenda();
  });

  document.getElementById("calendar-today").addEventListener("click", async () => {
    agendaState.anchorDate = startOfDay(new Date());
    await loadAgenda();
  });

  document.getElementById("move-form").addEventListener("submit", handleMoveForm);
  document.getElementById("move-cancel").addEventListener("click", closeMoveDialog);
  document.getElementById("move-close").addEventListener("click", closeMoveDialog);
}

async function initDashboard() {
  wireDashboardControls();

  await Promise.all([
    loadDashboardMetrics(),
    loadAgenda()
  ]);
}

if (window.docmapUser) {
  initDashboard();
} else {
  window.addEventListener("docmap:ready", initDashboard, { once: true });
}
