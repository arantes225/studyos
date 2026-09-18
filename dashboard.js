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
  const { data, error } = await dashboardSb
    .from("retention_by_subject")
    .select("retention_percent,total_evidence")
    .gt("total_evidence", 0);

  if (error) {
    console.warn(error);
    return;
  }

  const valid = (data || []).filter(
    (row) =>
      row.retention_percent !== null &&
      Number(row.total_evidence) > 0
  );

  const value = document.getElementById("metric-retention");
  const helper = document.getElementById("metric-retention-helper");

  if (!valid.length) {
    value.textContent = "—";
    helper.textContent = "Sem dados suficientes";
    return;
  }

  const totalEvidence = valid.reduce(
    (sum, row) => sum + Number(row.total_evidence),
    0
  );

  const weighted = valid.reduce(
    (sum, row) =>
      sum +
      Number(row.retention_percent) *
      Number(row.total_evidence),
    0
  ) / totalEvidence;

  value.textContent = `${weighted.toFixed(0)}%`;
  helper.textContent =
    `${totalEvidence} evidência${totalEvidence === 1 ? "" : "s"} de memória`;
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

  const recent =
    document.getElementById(
      "simulations-recent"
    );

  const overviewCopy =
    document.getElementById(
      "simulations-overview-copy"
    );


  if (
    !value
    || !helper
    || !recent
  ) {
    return;
  }


  const [
    overallResult,
    recentResult
  ] =
    await Promise.all([
      dashboardSb
        .from(
          "question_metrics_overall"
        )
        .select(
          "completed_sets,total_sets,answered_questions,correct_questions,wrong_questions,accuracy_percent"
        )
        .maybeSingle(),

      dashboardSb
        .from(
          "question_set_metrics"
        )
        .select(
          "set_id,title,total_questions,answered_count,correct_count,wrong_count,accuracy_percent,completed,created_at,last_answered_at"
        )
        .gt(
          "answered_count",
          0
        )
        .order(
          "last_answered_at",
          {
            ascending: false,
            nullsFirst: false
          }
        )
        .limit(
          4
        )
    ]);


  if (
    overallResult.error
  ) {
    console.warn(
      overallResult.error
    );

    value.textContent =
      "—";

    helper.textContent =
      "Sem dados de simulados";

  } else {
    const overall =
      overallResult.data
      || {
        completed_sets: 0,
        answered_questions: 0,
        accuracy_percent: null
      };


    const completed =
      Number(
        overall.completed_sets
        || 0
      );

    const answered =
      Number(
        overall.answered_questions
        || 0
      );


    value.textContent =
      completed;


    helper.textContent =
      answered
        ? `${answered} questões · ${formatSimulationAccuracy(
            overall.accuracy_percent
          )} de acerto`
        : "Nenhum gabarito salvo";
  }


  if (
    recentResult.error
  ) {
    console.warn(
      recentResult.error
    );

    recent.innerHTML =
      `
        <div class="simulations-empty">
          Não foi possível carregar os simulados recentes.
        </div>
      `;

    return;
  }


  const rows =
    recentResult.data
    || [];


  if (
    !rows.length
  ) {
    recent.innerHTML =
      `
        <div class="simulations-empty">
          Seus últimos simulados aparecerão aqui depois que você salvar um gabarito.
        </div>
      `;

    if (overviewCopy) {
      overviewCopy.textContent =
        "Ainda não há gabaritos salvos.";
    }

    return;
  }


  const totalAnswered =
    rows.reduce(
      (sum, row) =>
        sum
        + Number(
            row.answered_count
            || 0
          ),
      0
    );


  if (overviewCopy) {
    overviewCopy.textContent =
      `${rows.length} simulado${
        rows.length === 1
          ? ""
          : "s"
      } recente${
        rows.length === 1
          ? ""
          : "s"
      } · ${totalAnswered} questões respondidas`;
  }


  recent.innerHTML =
    rows.map(
      (row) => {
        const answered =
          Number(
            row.answered_count
            || 0
          );

        const total =
          Number(
            row.total_questions
            || 0
          );

        const correct =
          Number(
            row.correct_count
            || 0
          );

        const wrong =
          Number(
            row.wrong_count
            || 0
          );


        return `
          <article class="simulation-mini-card">
            <strong>
              ${dashboardEscapeHtml(
                row.title
                || "Simulado"
              )}
            </strong>

            <span class="simulation-mini-score">
              ${formatSimulationAccuracy(
                row.accuracy_percent
              )}
            </span>

            <small>
              ${answered}/${total || answered} respondidas
              · ${correct} acertos
              · ${wrong} erros
            </small>
          </article>
        `;
      }
    ).join("");
}




/* =========================================================
   FASE 10 — ESTATÍSTICAS E INTELIGÊNCIA
   ========================================================= */

const analyticsState = {
  days: 30
};


function analyticsDateDaysAgo(
  daysAgo
) {
  const date =
    startOfDay(
      new Date()
    );

  date.setDate(
    date.getDate()
    - daysAgo
  );

  return date;
}


function analyticsDateRange(
  days
) {
  const end =
    startOfDay(
      new Date()
    );

  const start =
    analyticsDateDaysAgo(
      Math.max(
        0,
        days - 1
      )
    );

  return {
    start,
    end,
    startISO:
      toISODate(
        start
      ),

    endISO:
      toISODate(
        end
      )
  };
}


function analyticsPercent(
  numerator,
  denominator
) {
  const total =
    Number(
      denominator
      || 0
    );

  if (
    total <= 0
  ) {
    return null;
  }

  return (
    Number(
      numerator
      || 0
    )
    / total
  )
  * 100;
}


function analyticsPercentLabel(
  value
) {
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
    .toFixed(0)}%`;
}


function analyticsActivityLabel(
  kind
) {
  const labels = {
    lesson:
      "Aulas",

    flashcards:
      "Flashcards",

    error_notebook:
      "Caderno de erros",

    subject_review:
      "Revisão teórica",

    free_study:
      "Estudo livre",

    ambientacao:
      "Ambientação"
  };

  return (
    labels[kind]
    || kind
    || "Outros"
  );
}


function analyticsShortDay(
  isoDate
) {
  const date =
    parseISODate(
      isoDate
    );

  return new Intl
    .DateTimeFormat(
      "pt-BR",
      {
        day:
          "2-digit",

        month:
          "2-digit"
      }
    )
    .format(
      date
    );
}


function analyticsBuildDailySeries(
  rows,
  dateField,
  valueField,
  days
) {
  const map =
    new Map(
      (rows || [])
        .map(
          (row) => [
            row[dateField],
            Number(
              row[valueField]
              || 0
            )
          ]
        )
    );


  const start =
    analyticsDateDaysAgo(
      Math.max(
        0,
        days - 1
      )
    );


  return Array.from(
    {
      length:
        days
    },
    (
      _,
      index
    ) => {
      const date =
        addDays(
          start,
          index
        );

      const iso =
        toISODate(
          date
        );

      return {
        date:
          iso,

        value:
          map.get(
            iso
          )
          || 0
      };
    }
  );
}


function renderAnalyticsStudyBars(
  studyRows
) {
  const container =
    document.getElementById(
      "analytics-study-bars"
    );

  if (!container) {
    return;
  }


  const series =
    analyticsBuildDailySeries(
      studyRows,
      "study_date",
      "total_seconds",
      analyticsState.days
    );


  const maxValue =
    Math.max(
      1,
      ...series.map(
        (item) =>
          item.value
      )
    );


  container.style.minWidth =
    `${Math.max(
      100,
      series.length * 22
    )}px`;


  container.innerHTML =
    series.map(
      (
        item,
        index
      ) => {
        const percent =
          item.value > 0
            ? Math.max(
                3,
                (
                  item.value
                  / maxValue
                )
                * 100
              )
            : 1;


        const showLabel =
          series.length <= 14
          || index % (
            series.length <= 30
              ? 3
              : 7
          ) === 0
          || index === series.length - 1;


        return `
          <div
            class="analytics-bar-column"
            title="${dashboardEscapeHtml(
              `${analyticsShortDay(
                item.date
              )}: ${formatHours(
                item.value
              )}`
            )}"
          >
            <div
              class="analytics-bar ${
                item.value > 0
                  ? ""
                  : "muted"
              }"
              style="height:${percent}%"
            ></div>

            ${
              showLabel
                ? `
                  <small>
                    ${dashboardEscapeHtml(
                      analyticsShortDay(
                        item.date
                      )
                    )}
                  </small>
                `
                : ""
            }
          </div>
        `;
      }
    )
    .join("");
}


function renderAnalyticsActivity(
  rows
) {
  const container =
    document.getElementById(
      "analytics-activity-list"
    );

  if (!container) {
    return;
  }


  const grouped =
    new Map();


  for (
    const row
    of rows || []
  ) {
    const kind =
      row.activity_kind
      || "other";

    grouped.set(
      kind,
      (
        grouped.get(
          kind
        )
        || 0
      )
      + Number(
          row.total_seconds
          || 0
        )
    );
  }


  const data =
    Array.from(
      grouped.entries()
    )
    .map(
      (
        [
          kind,
          seconds
        ]
      ) => ({
        kind,
        seconds
      })
    )
    .sort(
      (
        a,
        b
      ) =>
        b.seconds
        - a.seconds
    );


  if (
    !data.length
  ) {
    container.innerHTML =
      '<div class="analytics-empty">Ainda não há sessões concluídas neste período.</div>';

    return;
  }


  const total =
    data.reduce(
      (
        sum,
        item
      ) =>
        sum
        + item.seconds,
      0
    );


  container.innerHTML =
    data.map(
      (item) => {
        const share =
          total
            ? (
                item.seconds
                / total
              )
              * 100
            : 0;

        return `
          <div class="analytics-activity-row">

            <div class="analytics-row-copy">
              <strong>
                ${dashboardEscapeHtml(
                  analyticsActivityLabel(
                    item.kind
                  )
                )}
              </strong>
            </div>

            <div class="analytics-progress">
              <span
                style="width:${Math.max(
                  2,
                  share
                )}%"
              ></span>
            </div>

            <div class="analytics-row-value">
              ${dashboardEscapeHtml(
                formatHours(
                  item.seconds
                )
              )}
            </div>

          </div>
        `;
      }
    )
    .join("");
}


function renderAnalyticsRetention(
  rows
) {
  const container =
    document.getElementById(
      "analytics-retention-list"
    );

  if (!container) {
    return;
  }


  const data =
    (rows || [])
      .filter(
        (row) =>
          row.retention_percent
            !== null
          && Number(
            row.total_evidence
            || 0
          ) > 0
      )
      .sort(
        (
          a,
          b
        ) =>
          Number(
            a.retention_percent
          )
          - Number(
              b.retention_percent
            )
      )
      .slice(
        0,
        6
      );


  if (
    !data.length
  ) {
    container.innerHTML =
      '<div class="analytics-empty">Ainda não há evidência suficiente de memória.</div>';

    return;
  }


  container.innerHTML =
    data.map(
      (row) => {
        const retention =
          Math.max(
            0,
            Math.min(
              100,
              Number(
                row.retention_percent
                || 0
              )
            )
          );

        return `
          <div class="analytics-row">

            <div class="analytics-row-copy">
              <strong>
                ${dashboardEscapeHtml(
                  row.subject
                  || "Sem matéria"
                )}
              </strong>

              <small>
                ${Number(
                  row.total_evidence
                  || 0
                )} evidência${
                  Number(
                    row.total_evidence
                    || 0
                  ) === 1
                    ? ""
                    : "s"
                }
              </small>
            </div>

            <div class="analytics-progress">
              <span
                style="width:${retention}%"
              ></span>
            </div>

            <div class="analytics-row-value">
              ${retention.toFixed(0)}%
            </div>

          </div>
        `;
      }
    )
    .join("");
}


function renderAnalyticsErrors(
  questionRows,
  errorRows
) {
  const container =
    document.getElementById(
      "analytics-error-list"
    );

  if (!container) {
    return;
  }


  const combined =
    new Map();


  for (
    const row
    of questionRows || []
  ) {
    const area =
      row.area
      || "Sem área";

    const current =
      combined.get(
        area
      )
      || {
        area,
        questions:
          0,
        notebook:
          0
      };

    current.questions +=
      Number(
        row.wrong_count
        || 0
      );

    combined.set(
      area,
      current
    );
  }


  for (
    const row
    of errorRows || []
  ) {
    const area =
      row.area
      || "Sem área";

    const current =
      combined.get(
        area
      )
      || {
        area,
        questions:
          0,
        notebook:
          0
      };

    current.notebook +=
      Number(
        row.active_count
        || 0
      );

    combined.set(
      area,
      current
    );
  }


  const data =
    Array.from(
      combined.values()
    )
    .map(
      (item) => ({
        ...item,
        total:
          item.questions
          + item.notebook
      })
    )
    .filter(
      (item) =>
        item.total > 0
    )
    .sort(
      (
        a,
        b
      ) =>
        b.total
        - a.total
    )
    .slice(
      0,
      6
    );


  if (
    !data.length
  ) {
    container.innerHTML =
      '<div class="analytics-empty">Nenhum erro classificado por área ainda.</div>';

    return;
  }


  const maxValue =
    Math.max(
      1,
      ...data.map(
        (item) =>
          item.total
      )
    );


  container.innerHTML =
    data.map(
      (item) => {
        const percent =
          (
            item.total
            / maxValue
          )
          * 100;

        return `
          <div class="analytics-row">

            <div class="analytics-row-copy">
              <strong>
                ${dashboardEscapeHtml(
                  item.area
                )}
              </strong>

              <small>
                Simulados: ${item.questions}
                · Caderno: ${item.notebook}
              </small>
            </div>

            <div class="analytics-progress">
              <span
                style="width:${percent}%"
              ></span>
            </div>

            <div class="analytics-row-value">
              ${item.total}
            </div>

          </div>
        `;
      }
    )
    .join("");
}


function renderAnalyticsInsights({
  studyRows,
  questionRows,
  flashRows,
  retentionRows,
  questionAreaRows,
  errorAreaRows
}) {
  const container =
    document.getElementById(
      "analytics-insights"
    );

  if (!container) {
    return;
  }


  const insights =
    [];


  const activeDays =
    new Set(
      (studyRows || [])
        .filter(
          (row) =>
            Number(
              row.total_seconds
              || 0
            ) > 0
        )
        .map(
          (row) =>
            row.study_date
        )
    )
    .size;


  insights.push(
    `Estudo registrado em ${activeDays} de ${analyticsState.days} dias do período.`
  );


  const retention =
    (retentionRows || [])
      .filter(
        (row) =>
          row.retention_percent
            !== null
          && Number(
            row.total_evidence
            || 0
          ) >= 2
      )
      .sort(
        (
          a,
          b
        ) =>
          Number(
            a.retention_percent
          )
          - Number(
              b.retention_percent
            )
      )[0];


  if (retention) {
    insights.push(
      `Menor retenção estimada: ${retention.subject} (${Number(
        retention.retention_percent
      ).toFixed(0)}%).`
    );
  }


  const errorMap =
    new Map();


  for (
    const row
    of questionAreaRows || []
  ) {
    const area =
      row.area
      || "Sem área";

    errorMap.set(
      area,
      (
        errorMap.get(
          area
        )
        || 0
      )
      + Number(
          row.wrong_count
          || 0
        )
    );
  }


  for (
    const row
    of errorAreaRows || []
  ) {
    const area =
      row.area
      || "Sem área";

    errorMap.set(
      area,
      (
        errorMap.get(
          area
        )
        || 0
      )
      + Number(
          row.active_count
          || 0
        )
    );
  }


  const highestError =
    Array.from(
      errorMap.entries()
    )
    .sort(
      (
        a,
        b
      ) =>
        b[1]
        - a[1]
    )[0];


  if (
    highestError
    && highestError[1] > 0
  ) {
    insights.push(
      `Maior concentração atual de erros: ${highestError[0]} (${highestError[1]} registros somados).`
    );
  }


  const questionAnswered =
    (questionRows || [])
      .reduce(
        (
          sum,
          row
        ) =>
          sum
          + Number(
              row.answered_questions
              || 0
            ),
        0
      );


  const flashReviewed =
    (flashRows || [])
      .reduce(
        (
          sum,
          row
        ) =>
          sum
          + Number(
              row.total_reviews
              || 0
            ),
        0
      );


  if (
    questionAnswered
    || flashReviewed
  ) {
    insights.push(
      `No período: ${questionAnswered} questões respondidas e ${flashReviewed} revisões de flashcards.`
    );
  }


  container.innerHTML =
    insights.map(
      (text) =>
        `
          <div class="analytics-insight">
            ${dashboardEscapeHtml(
              text
            )}
          </div>
        `
    )
    .join("");
}


async function loadAnalytics() {
  const range =
    analyticsDateRange(
      analyticsState.days
    );


  const [
    studyResult,
    activityResult,
    questionResult,
    flashResult,
    retentionResult,
    questionAreaResult,
    errorAreaResult
  ] =
    await Promise.all([

      dashboardSb
        .from(
          "study_hours_daily"
        )
        .select(
          "study_date,total_seconds,session_count"
        )
        .gte(
          "study_date",
          range.startISO
        )
        .lte(
          "study_date",
          range.endISO
        )
        .order(
          "study_date",
          {
            ascending:
              true
          }
        ),

      dashboardSb
        .from(
          "study_activity_daily"
        )
        .select(
          "study_date,activity_kind,total_seconds,session_count"
        )
        .gte(
          "study_date",
          range.startISO
        )
        .lte(
          "study_date",
          range.endISO
        ),

      dashboardSb
        .from(
          "question_metrics_daily"
        )
        .select(
          "answer_date,answered_questions,correct_questions,wrong_questions,accuracy_percent"
        )
        .gte(
          "answer_date",
          range.startISO
        )
        .lte(
          "answer_date",
          range.endISO
        )
        .order(
          "answer_date",
          {
            ascending:
              true
          }
        ),

      dashboardSb
        .from(
          "flashcard_metrics_daily"
        )
        .select(
          "review_date,total_reviews,correct,incorrect"
        )
        .gte(
          "review_date",
          range.startISO
        )
        .lte(
          "review_date",
          range.endISO
        )
        .order(
          "review_date",
          {
            ascending:
              true
          }
        ),

      dashboardSb
        .from(
          "retention_by_subject"
        )
        .select(
          "subject,retention_percent,total_evidence"
        )
        .gt(
          "total_evidence",
          0
        ),

      dashboardSb
        .from(
          "question_area_difficulty"
        )
        .select(
          "area,wrong_count,set_count,error_share_percent"
        )
        .order(
          "wrong_count",
          {
            ascending:
              false
          }
        )
        .limit(
          20
        ),

      dashboardSb
        .from(
          "error_area_metrics"
        )
        .select(
          "area,active_count,reviewed_count,overdue_count,retention_percent"
        )
        .order(
          "active_count",
          {
            ascending:
              false
          }
        )
        .limit(
          20
        )
    ]);


  [
    studyResult,
    activityResult,
    questionResult,
    flashResult,
    retentionResult,
    questionAreaResult,
    errorAreaResult
  ].forEach(
    (result) => {
      if (
        result.error
      ) {
        console.warn(
          result.error
        );
      }
    }
  );


  const studyRows =
    studyResult.data
    || [];

  const activityRows =
    activityResult.data
    || [];

  const questionRows =
    questionResult.data
    || [];

  const flashRows =
    flashResult.data
    || [];

  const retentionRows =
    retentionResult.data
    || [];

  const questionAreaRows =
    questionAreaResult.data
    || [];

  const errorAreaRows =
    errorAreaResult.data
    || [];


  const totalStudySeconds =
    studyRows.reduce(
      (
        sum,
        row
      ) =>
        sum
        + Number(
            row.total_seconds
            || 0
          ),
      0
    );


  const activeStudyDays =
    studyRows.filter(
      (row) =>
        Number(
          row.total_seconds
          || 0
        ) > 0
    ).length;


  const totalQuestions =
    questionRows.reduce(
      (
        sum,
        row
      ) =>
        sum
        + Number(
            row.answered_questions
            || 0
          ),
      0
    );


  const correctQuestions =
    questionRows.reduce(
      (
        sum,
        row
      ) =>
        sum
        + Number(
            row.correct_questions
            || 0
          ),
      0
    );


  const totalFlashReviews =
    flashRows.reduce(
      (
        sum,
        row
      ) =>
        sum
        + Number(
            row.total_reviews
            || 0
          ),
      0
    );


  const correctFlash =
    flashRows.reduce(
      (
        sum,
        row
      ) =>
        sum
        + Number(
            row.correct
            || 0
          ),
      0
    );


  const questionAccuracy =
    analyticsPercent(
      correctQuestions,
      totalQuestions
    );


  const flashAccuracy =
    analyticsPercent(
      correctFlash,
      totalFlashReviews
    );


  const studyTime =
    document.getElementById(
      "analytics-study-time"
    );


  const studyTimeHelper =
    document.getElementById(
      "analytics-study-time-helper"
    );


  const consistency =
    document.getElementById(
      "analytics-consistency"
    );


  const consistencyHelper =
    document.getElementById(
      "analytics-consistency-helper"
    );


  const questionAccuracyElement =
    document.getElementById(
      "analytics-question-accuracy"
    );


  const questionHelper =
    document.getElementById(
      "analytics-question-helper"
    );


  const flashAccuracyElement =
    document.getElementById(
      "analytics-flash-accuracy"
    );


  const flashHelper =
    document.getElementById(
      "analytics-flash-helper"
    );


  if (studyTime) {
    studyTime.textContent =
      formatHours(
        totalStudySeconds
      );
  }


  if (studyTimeHelper) {
    studyTimeHelper.textContent =
      `${analyticsState.days} dias selecionados`;
  }


  if (consistency) {
    consistency.textContent =
      `${activeStudyDays}/${analyticsState.days}`;
  }


  if (consistencyHelper) {
    consistencyHelper.textContent =
      activeStudyDays === 1
        ? "1 dia com estudo"
        : `${activeStudyDays} dias com estudo`;
  }


  if (questionAccuracyElement) {
    questionAccuracyElement.textContent =
      analyticsPercentLabel(
        questionAccuracy
      );
  }


  if (questionHelper) {
    questionHelper.textContent =
      totalQuestions
        ? `${totalQuestions} questões`
        : "sem questões no período";
  }


  if (flashAccuracyElement) {
    flashAccuracyElement.textContent =
      analyticsPercentLabel(
        flashAccuracy
      );
  }


  if (flashHelper) {
    flashHelper.textContent =
      totalFlashReviews
        ? `${totalFlashReviews} revisões`
        : "sem revisões no período";
  }


  renderAnalyticsStudyBars(
    studyRows
  );


  renderAnalyticsActivity(
    activityRows
  );


  renderAnalyticsRetention(
    retentionRows
  );


  renderAnalyticsErrors(
    questionAreaRows,
    errorAreaRows
  );


  renderAnalyticsInsights({
    studyRows,
    questionRows,
    flashRows,
    retentionRows,
    questionAreaRows,
    errorAreaRows
  });
}


function wireAnalyticsControls() {
  document
    .querySelectorAll(
      "[data-analytics-days]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          async () => {
            const days =
              Number(
                button
                  .dataset
                  .analyticsDays
              );


            if (
              ![14,30,90]
                .includes(
                  days
                )
            ) {
              return;
            }


            analyticsState.days =
              days;


            document
              .querySelectorAll(
                "[data-analytics-days]"
              )
              .forEach(
                (item) => {
                  item.classList.toggle(
                    "active",
                    Number(
                      item
                        .dataset
                        .analyticsDays
                    )
                    === days
                  );
                }
              );


            await loadAnalytics();
          }
        );
      }
    );
}



async function loadDashboardMetrics() {
  await Promise.all([
    loadStudyHours(),
    loadRetention(),
    loadFlashcardMetrics(),
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
  wireAnalyticsControls();

  await Promise.all([
    loadDashboardMetrics(),
    loadAnalytics(),
    loadAgenda()
  ]);
}

if (window.docmapUser) {
  initDashboard();
} else {
  window.addEventListener("docmap:ready", initDashboard, { once: true });
}
