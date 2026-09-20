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

  const isCompactStudyBatch =
    item.kind === "flashcards_batch"
    || item.kind === "errors_batch";

  if (isCompactStudyBatch) {
    const count =
      Number(
        item.item_count
        || 0
      );

    const quantityLabel =
      item.kind === "flashcards_batch"
        ? `${count} flashcard${count === 1 ? "" : "s"}`
        : `${count} CCQ${count === 1 ? "" : "s"}`;

    const areaLabel =
      item.area
        ? escapeDashboardHtml(item.area)
        : "Sem área";

    return `
      <article
        class="agenda-card ${meta.className} compact-study-batch"
        ${canMove ? 'draggable="true"' : ""}
        data-agenda-key="${escapeDashboardHtml(item.agenda_key)}"
      >
        <div class="agenda-card-top">
          <span class="agenda-kind">${escapeDashboardHtml(meta.label)}</span>
        </div>

        <strong class="agenda-title compact-batch-quantity">
          ${escapeDashboardHtml(quantityLabel)}
        </strong>

        <div class="agenda-meta compact-batch-area">
          <span>${areaLabel}</span>
        </div>

        <div class="agenda-card-actions">
          ${actions.join("")}
        </div>
      </article>
    `;
  }

  const areaText = item.area
    ? `<span>${escapeDashboardHtml(item.area)}</span>`
    : "";

  const matterText = item.materia
    ? `<span>${escapeDashboardHtml(item.materia)}</span>`
    : "";

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

function normalizeAgendaAreaValue(
  value
) {
  const normalized =
    String(
      value
      ?? ""
    )
      .trim()
      .toLowerCase()
      .normalize(
        "NFD"
      )
      .replace(
        /[\u0300-\u036f]/g,
        ""
      );

  if (
    !normalized
    || normalized === "sem area"
  ) {
    return "";
  }

  return normalized;
}


function sameAgendaArea(
  first,
  second
) {
  return (
    normalizeAgendaAreaValue(
      first
    )
    ===
    normalizeAgendaAreaValue(
      second
    )
  );
}


async function moveAgendaReviewSource(
  item,
  newDate
) {
  /*
    Revisões não devem ser apenas "movidas visualmente" na agenda.
    A data real da próxima revisão precisa acompanhar o drag.
    Isso também garante que, ao clicar em Iniciar, a fila daquela
    data encontre os itens corretos.
  */

  if (
    item.kind ===
    "subject_review"
  ) {
    if (
      !item.item_id
    ) {
      throw new Error(
        "Revisão sem identificador."
      );
    }

    const {
      data,
      error
    } =
      await dashboardSb
        .from(
          "subject_reviews"
        )
        .update({
          scheduled_date:
            newDate
        })
        .eq(
          "id",
          item.item_id
        )
        .select(
          "id"
        );

    if (
      error
    ) {
      throw error;
    }

    if (
      !data?.length
    ) {
      throw new Error(
        "A revisão não foi encontrada para remarcação."
      );
    }

    return true;
  }


  const isFlashcards =
    item.kind ===
    "flashcards_batch";

  const isErrors =
    item.kind ===
    "errors_batch";

  if (
    !isFlashcards
    && !isErrors
  ) {
    return false;
  }


  const table =
    isFlashcards
      ? "flashcards"
      : "error_notebook";


  /*
    Não filtramos a área diretamente no SQL, porque a agenda
    pode representar área nula como "Sem área" e também pode
    haver diferenças de espaços/acentos. Primeiro buscamos os
    itens da data original e depois comparamos a área de forma
    normalizada.
  */
  const {
    data:
      sourceRows,
    error:
      sourceError
  } =
    await dashboardSb
      .from(
        table
      )
      .select(
        "id,area,due_date"
      )
      .eq(
        "active",
        true
      )
      .eq(
        "due_date",
        item.activity_date
      );


  if (
    sourceError
  ) {
    throw sourceError;
  }


  const matchingIds =
    (
      sourceRows
      || []
    )
      .filter(
        row =>
          sameAgendaArea(
            row.area,
            item.area
          )
      )
      .map(
        row =>
          row.id
      );


  if (
    !matchingIds.length
  ) {
    throw new Error(
      isFlashcards
        ? "Não encontrei os flashcards dessa atividade na data original."
        : "Não encontrei os CCQs dessa atividade na data original."
    );
  }


  const {
    data:
      updatedRows,
    error:
      updateError
  } =
    await dashboardSb
      .from(
        table
      )
      .update({
        due_date:
          newDate
      })
      .in(
        "id",
        matchingIds
      )
      .select(
        "id,due_date"
      );


  if (
    updateError
  ) {
    throw updateError;
  }


  const updatedIds =
    new Set(
      (
        updatedRows
        || []
      )
        .filter(
          row =>
            row.due_date
            === newDate
        )
        .map(
          row =>
            row.id
        )
    );


  if (
    updatedIds.size
    !== matchingIds.length
  ) {
    throw new Error(
      isFlashcards
        ? "A nova data não foi aplicada a todos os flashcards."
        : "A nova data não foi aplicada a todos os CCQs."
    );
  }


  return true;
}


async function moveAgendaItem(item, newDate) {
  if (!activityCanMove(item)) return;

  setCalendarStatus("Remarcando atividade...");

  try {
    const movedReviewSource =
      await moveAgendaReviewSource(
        item,
        newDate
      );


    if (
      !movedReviewSource
    ) {
      const {
        error
      } =
        await dashboardSb.rpc(
          "move_agenda_item",
          {
            p_kind:
              item.kind,

            p_item_id:
              item.item_id
              || null,

            p_from_date:
              item.activity_date,

            p_to_date:
              newDate,

            p_area:
              item.area
              || null
          }
        );

      if (
        error
      ) {
        throw error;
      }
    }


    setCalendarStatus(
      "Atividade remarcada. A próxima revisão foi atualizada.",
      "success"
    );


    await Promise.all([
      loadAgenda(),
      loadDashboardMetrics()
    ]);

  } catch (
    error
  ) {
    console.error(
      error
    );

    setCalendarStatus(
      `Erro ao mover: ${error.message}`,
      "error"
    );
  }
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

  return `${hours}h${minutes}min`;
}


function setDashboardText(
  id,
  value
) {
  const element =
    document.getElementById(
      id
    );

  if (!element) {
    return;
  }

  element.textContent =
    value === null
    || value === undefined
      ? "—"
      : String(value);
}


function dashboardTrendText(
  current,
  previous
) {
  const currentValue =
    Number(current);

  const previousValue =
    Number(previous);

  if (
    !Number.isFinite(currentValue)
    || !Number.isFinite(previousValue)
    || previousValue <= 0
  ) {
    return "—";
  }

  const change =
    (
      (
        currentValue
        - previousValue
      )
      / previousValue
    )
    * 100;

  if (
    Math.abs(change)
    < 0.5
  ) {
    return "estável";
  }

  return `${
    change > 0
      ? "↑"
      : "↓"
  } ${Math.abs(
    Math.round(change)
  )}%`;
}

async function loadStudyHours() {
  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today);
  const previousStart = addDays(weekStart, -7);
  const previousEnd = addDays(previousStart, Math.round((today - weekStart) / 86400000));

  const { data, error } = await dashboardSb
    .from("study_hours_daily")
    .select("study_date,total_seconds")
    .gte("study_date", toISODate(previousStart))
    .lte("study_date", toISODate(today));

  if (error) {
    console.warn(error);
    return;
  }

  const rows = data || [];

  const current = rows
    .filter((row) => row.study_date >= toISODate(weekStart))
    .reduce((sum, row) => sum + Number(row.total_seconds || 0), 0);

  const previous = rows
    .filter(
      (row) =>
        row.study_date >= toISODate(previousStart)
        && row.study_date <= toISODate(previousEnd)
    )
    .reduce((sum, row) => sum + Number(row.total_seconds || 0), 0);

  const formatted = formatHours(current);
  const helper =
    previous > 0
      ? `${dashboardTrendText(current, previous)} vs semana passada`
      : "Nesta semana";

  setDashboardText("metric-hours", formatted);
  setDashboardText("metric-hours-helper", helper);
  setDashboardText("summary-hours", formatted);
}


async function loadRetention() {
  const start30 = addDays(startOfDay(new Date()), -29);

  const [retentionResult, reviewResult] = await Promise.all([
    dashboardSb
      .from("flashcard_retention_overall")
      .select("retention_percent")
      .maybeSingle(),

    dashboardSb
      .from("flashcard_metrics_daily")
      .select("total_reviews")
      .gte("review_date", toISODate(start30))
  ]);

  if (retentionResult.error) console.warn(retentionResult.error);
  if (reviewResult.error) console.warn(reviewResult.error);

  const retention =
    retentionResult.data?.retention_percent === null
    || retentionResult.data?.retention_percent === undefined
      ? null
      : Number(retentionResult.data.retention_percent);

  const reviews = (reviewResult.data || []).reduce(
    (sum, row) => sum + Number(row.total_reviews || 0),
    0
  );

  setDashboardText(
    "metric-retention",
    retention === null ? "—" : `${retention.toFixed(0)}%`
  );

  setDashboardText(
    "metric-retention-helper",
    `${reviews} revis${reviews === 1 ? "ão" : "ões"}`
  );
}


async function loadLessonMetrics() {
  const today = startOfDay(new Date());
  const todayIso = toISODate(today);
  const weekStartIso = toISODate(startOfWeek(today));

  const { data, error } = await dashboardSb
    .from("study_topics")
    .select("id,status,scheduled_date,completed_at");

  if (error) {
    console.warn(error);
    return;
  }

  const rows = data || [];
  const total = rows.length;

  const completed = rows.filter(
    (row) => row.status === "completed" || Boolean(row.completed_at)
  );

  const overdue = rows.filter(
    (row) =>
      row.scheduled_date
      && row.scheduled_date < todayIso
      && !row.completed_at
      && row.status !== "completed"
  ).length;

  const overdueAtWeekStart = rows.filter(
    (row) =>
      row.scheduled_date
      && row.scheduled_date < weekStartIso
      && (
        !row.completed_at
        || String(row.completed_at).slice(0, 10) >= weekStartIso
      )
  ).length;

  const completedThisWeek = completed.filter(
    (row) =>
      row.completed_at
      && String(row.completed_at).slice(0, 10) >= weekStartIso
  ).length;

  const progress = total > 0 ? (completed.length / total) * 100 : 0;
  const overdueDelta = overdue - overdueAtWeekStart;

  setDashboardText("metric-overdue-lessons", overdue);
  setDashboardText("summary-overdue-lessons", overdue);

  setDashboardText(
    "metric-overdue-lessons-helper",
    `${overdueDelta > 0 ? "+" : ""}${overdueDelta} nesta semana`
  );

  setDashboardText(
    "metric-lessons-progress-copy",
    `${completed.length}/${total}`
  );

  const progressRing =
    document.getElementById(
      "dashboard-progress-ring-value"
    );

  if (progressRing) {
    const circumference =
      2
      * Math.PI
      * 52;

    const ratio =
      total > 0
        ? Math.min(
            1,
            completed.length / total
          )
        : 0;

    progressRing.style.strokeDasharray =
      String(circumference);

    progressRing.style.strokeDashoffset =
      String(
        circumference
        * (
          1
          - ratio
        )
      );
  }

  setDashboardText(
    "metric-lessons-progress",
    `${progress.toFixed(0)}%`
  );

  setDashboardText(
    "summary-progress",
    `${progress.toFixed(0)}%`
  );

  setDashboardText(
    "metric-lessons-progress-helper",
    ""
  );
}


async function loadErrorMetrics() {
  const { data, error } = await dashboardSb
    .from("error_notebook_metrics")
    .select("registered_errors,reviewed_errors,overdue_errors,retention_percent")
    .maybeSingle();

  if (error) {
    console.warn(error);
    setDashboardText("metric-errors", "—");
    setDashboardText("summary-errors", "—");
    setDashboardText("metric-errors-helper", "Sem dados do Caderno");
    return;
  }

  const active = Number(data?.registered_errors || 0);
  const reviewed = Number(data?.reviewed_errors || 0);
  const overdue = Number(data?.overdue_errors || 0);

  setDashboardText(
    "metric-errors",
    `${active} CCQ${active === 1 ? "" : "s"} ativo${active === 1 ? "" : "s"}`
  );

  setDashboardText(
    "summary-errors",
    `${active} CCQ${active === 1 ? "" : "s"}`
  );

  setDashboardText(
    "metric-errors-helper",
    `${reviewed} dominado${reviewed === 1 ? "" : "s"} · ${overdue} atrasado${overdue === 1 ? "" : "s"}`
  );
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

  if (pendingResult.error) console.warn(pendingResult.error);
  if (dailyResult.error) console.warn(dailyResult.error);

  const pending = pendingResult.count ?? 0;
  const daily = dailyResult.data || {
    total_reviews: 0,
    correct: 0,
    incorrect: 0
  };

  const totalReviews = Number(daily.total_reviews || 0);
  const correct = Number(daily.correct || 0);
  const accuracy =
    totalReviews > 0 ? Math.round((correct / totalReviews) * 100) : 0;

  const pendingText =
    `${pending} pendente${pending === 1 ? "" : "s"}`;

  setDashboardText("metric-flashcards", pendingText);
  setDashboardText("summary-flashcards", pendingText);

  setDashboardText(
    "metric-flashcards-helper",
    totalReviews
      ? `${totalReviews} revisados hoje · ${accuracy}%`
      : "0 revisados hoje"
  );
}


function formatSimulationAccuracy(value) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return "—";
  }

  return `${Number(value).toFixed(1).replace(".", ",")}%`;
}

async function loadSimulationMetrics() {
  const today = startOfDay(new Date());
  const currentStart = addDays(today, -29);
  const previousStart = addDays(today, -59);
  const previousEnd = addDays(today, -30);

  const { data, error } = await dashboardSb
    .from("question_set_metrics")
    .select("set_id,answered_count,correct_count,last_answered_at")
    .gt("answered_count", 0)
    .gte("last_answered_at", previousStart.toISOString());

  if (error) {
    console.warn(error);
    setDashboardText("metric-simulations", "0");
    setDashboardText("metric-simulations-accuracy", "—");
    setDashboardText("metric-simulations-helper", "Não foi possível carregar");
    return;
  }

  const rows = data || [];

  const currentRows = rows.filter(
    (row) => new Date(row.last_answered_at) >= currentStart
  );

  const previousRows = rows.filter((row) => {
    const date = new Date(row.last_answered_at);
    return date >= previousStart && date <= previousEnd;
  });

  const summarize = (source) => {
    const answered = source.reduce(
      (sum, row) => sum + Number(row.answered_count || 0),
      0
    );

    const correct = source.reduce(
      (sum, row) => sum + Number(row.correct_count || 0),
      0
    );

    return {
      count: source.length,
      accuracy: answered > 0 ? (correct / answered) * 100 : null
    };
  };

  const current = summarize(currentRows);
  const previous = summarize(previousRows);

  const accuracyText =
    current.accuracy === null
      ? "—"
      : `${current.accuracy.toFixed(0)}%`;

  let trend = "";

  if (
    current.accuracy !== null
    && previous.accuracy !== null
  ) {
    const delta =
      Math.round(
        current.accuracy
        - previous.accuracy
      );

    trend =
      delta === 0
        ? " · estável"
        : ` · ${delta > 0 ? "↑" : "↓"} ${Math.abs(delta)}%`;
  }

  setDashboardText(
    "metric-simulations",
    String(current.count)
  );

  setDashboardText(
    "metric-simulations-accuracy",
    accuracyText
  );

  setDashboardText(
    "metric-simulations-helper",
    `${current.count} simulado${current.count === 1 ? "" : "s"}${trend}`
  );
}


/* =========================================================
   CCQ — REVISÃO PASSIVA
   ========================================================= */

const DASHBOARD_CCQ_ROTATION_MS = 15000;

const dashboardCcqState = {
  items: [],
  currentIndex: -1,
  bag: [],
  timerId: null
};

function shuffleCcqIndexes(count) {
  const indexes = Array.from({ length: count }, (_, index) => index);

  for (let i = indexes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }

  return indexes;
}

function refillCcqBag() {
  dashboardCcqState.bag = shuffleCcqIndexes(dashboardCcqState.items.length);
}

function nextCcqIndex() {
  if (!dashboardCcqState.items.length) return -1;
  if (dashboardCcqState.items.length === 1) return 0;

  if (!dashboardCcqState.bag.length) {
    refillCcqBag();
  }

  let index = dashboardCcqState.bag.pop();

  if (
    index === dashboardCcqState.currentIndex &&
    dashboardCcqState.bag.length
  ) {
    const alternative = dashboardCcqState.bag.pop();
    dashboardCcqState.bag.push(index);
    index = alternative;
  }

  return index;
}

function resetCcqProgress() {
  const bar = document.getElementById("dashboard-passive-ccq-progress");
  if (!bar) return;

  bar.style.transition = "none";
  bar.style.width = "0%";

  void bar.offsetWidth;

  bar.style.transition =
    `width ${DASHBOARD_CCQ_ROTATION_MS}ms linear`;

  requestAnimationFrame(() => {
    bar.style.width = "100%";
  });
}

function showDashboardCcq() {
  if (!dashboardCcqState.items.length) return;

  const index = nextCcqIndex();
  if (index < 0) return;

  dashboardCcqState.currentIndex = index;

  const item = dashboardCcqState.items[index];
  const text = document.getElementById("dashboard-passive-ccq-text");

  if (text) {
    text.textContent = item.ccq || "";
  }

  const summaryText =
    document.getElementById(
      "summary-ccq-text"
    );

  if (
    summaryText
  ) {
    summaryText.textContent =
      item.ccq
      || "—";
  }

  resetCcqProgress();
}

function startDashboardCcqRotation() {
  if (dashboardCcqState.timerId) {
    clearInterval(dashboardCcqState.timerId);
  }

  if (dashboardCcqState.items.length < 2) return;

  dashboardCcqState.timerId = setInterval(() => {
    if (!document.hidden) {
      showDashboardCcq();
    }
  }, DASHBOARD_CCQ_ROTATION_MS);
}

async function loadDashboardPassiveCcq() {
  const empty = document.getElementById("dashboard-passive-ccq-empty");
  const stage = document.getElementById("dashboard-passive-ccq-stage");

  if (!empty || !stage) return;

  const { data, error } = await dashboardSb
    .from("error_notebook")
    .select("id,area,materia,theme,ccq,due_date,review_count,created_at")
    .eq("active", true)
    .not("ccq", "is", null)
    .limit(100);

  if (error) {
    console.warn(error);
    empty.textContent = "Sem CCQs disponíveis.";
    empty.hidden = false;
    stage.hidden = true;

    const summaryText =
      document.getElementById(
        "summary-ccq-text"
      );

    if (
      summaryText
    ) {
      summaryText.textContent =
        "Sem CCQs disponíveis";
    }

    return;
  }

  dashboardCcqState.items = (data || []).filter(
    (item) => String(item.ccq || "").trim()
  );

  if (!dashboardCcqState.items.length) {
    empty.textContent = "Nenhum CCQ ativo no Caderno de Erros.";
    empty.hidden = false;
    stage.hidden = true;

    const summaryText =
      document.getElementById(
        "summary-ccq-text"
      );

    if (
      summaryText
    ) {
      summaryText.textContent =
        "Nenhum CCQ ativo";
    }

    return;
  }

  empty.hidden = true;
  stage.hidden = false;

  refillCcqBag();
  showDashboardCcq();
  startDashboardCcqRotation();
}


/* =========================================================
   OFENSIVA — CHAMA PROGRESSIVA
   ========================================================= */

function dashboardStreakTier(days) {
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


function initDashboardStreakVisual() {
  const card =
    document.getElementById(
      "dashboard-streak-card"
    );


  const value =
    card?.querySelector(
      "[data-streak-value]"
    );


  const label =
    document.getElementById(
      "dashboard-streak-stage"
    );


  if (
    !card ||
    !value
  ) {
    return;
  }


  const update =
    () => {
      const days =
        Number(
          String(
            value.textContent ||
            "0"
          )
            .replace(
              /[^\d]/g,
              ""
            )
        )
        ||
        0;


      const info =
        dashboardStreakTier(
          days
        );


      card.dataset.streakTier =
        info.tier;


      if (label) {
        label.textContent =
          info.label;
      }

    };


  const observer =
    new MutationObserver(
      update
    );


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


function dashboardCopyText(
  fromId,
  toId,
  transform = null
) {
  const from =
    document.getElementById(
      fromId
    );

  const to =
    document.getElementById(
      toId
    );

  if (
    !from
    || !to
  ) {
    return;
  }

  const value =
    from.textContent
      ?.trim()
    || "—";

  to.textContent =
    typeof transform
    === "function"
      ? transform(
          value
        )
      : value;
}


function updateDashboardSummaryFromDetails() {
  dashboardCopyText(
    "metric-overdue-lessons",
    "summary-overdue-lessons"
  );

  dashboardCopyText(
    "metric-flashcards",
    "summary-flashcards"
  );

  dashboardCopyText(
    "metric-lessons-progress",
    "summary-progress"
  );

  dashboardCopyText(
    "metric-hours",
    "summary-hours"
  );

  dashboardCopyText(
    "metric-simulations-accuracy",
    "summary-simulations"
  );

  const simulationCount =
    Number(
      document
        .getElementById(
          "metric-simulations"
        )
        ?.textContent
      || 0
    );

  const simulationHelper =
    document.getElementById(
      "summary-simulations-helper"
    );

  if (
    simulationHelper
  ) {
    simulationHelper.textContent =
      simulationCount
        + " prova"
        + (
          simulationCount === 1
            ? ""
            : "s"
        );
  }

  const errorValue =
    document.getElementById(
      "metric-errors"
    )
      ?.textContent
      ?.trim()
    || "";

  const summaryErrors =
    document.getElementById(
      "summary-errors"
    );

  if (
    summaryErrors
  ) {
    const match =
      errorValue.match(
        /(\d+)\s+CCQ/i
      );

    summaryErrors.textContent =
      match
        ? match[1]
          + " CCQ"
          + (
            Number(
              match[1]
            ) === 1
              ? ""
              : "s"
          )
        : (
            errorValue
            || "—"
          );
  }
}


async function loadTodaySummary() {
  const today =
    toISODate(
      new Date()
    );

  const [
    agendaResult,
    hoursResult
  ] =
    await Promise.all([
      dashboardSb
        .from(
          "agenda_feed"
        )
        .select(
          "kind,item_count"
        )
        .eq(
          "activity_date",
          today
        ),

      dashboardSb
        .from(
          "study_hours_daily"
        )
        .select(
          "total_seconds"
        )
        .eq(
          "study_date",
          today
        )
        .maybeSingle()
    ]);

  if (
    agendaResult.error
  ) {
    console.warn(
      agendaResult.error
    );
  }

  if (
    hoursResult.error
  ) {
    console.warn(
      hoursResult.error
    );
  }

  const items =
    agendaResult.data
    || [];

  const lessonCount =
    items
      .filter(
        item =>
          item.kind
          === "lesson"
      )
      .reduce(
        (
          sum,
          item
        ) =>
          sum
          + Math.max(
              1,
              Number(
                item.item_count
                || 1
              )
            ),
        0
      );

  const activityCount =
    items.reduce(
      (
        sum,
        item
      ) =>
        sum
        + Math.max(
            1,
            Number(
              item.item_count
              || 1
            )
          ),
      0
    );

  const primary =
    lessonCount > 0
      ? lessonCount
        + " aula"
        + (
          lessonCount === 1
            ? ""
            : "s"
        )
      : activityCount > 0
        ? activityCount
          + " atividade"
          + (
            activityCount === 1
              ? ""
              : "s"
          )
        : "Sem atividades";

  const main =
    document.getElementById(
      "summary-today"
    );

  const helper =
    document.getElementById(
      "summary-today-helper"
    );

  if (
    main
  ) {
    main.textContent =
      primary;
  }

  if (
    helper
  ) {
    helper.textContent =
      formatHours(
        Number(
          hoursResult.data
            ?.total_seconds
          || 0
        )
      )
      + " estudadas hoje";
  }
}


async function loadDashboardMetrics() {
  await Promise.all([
    loadStudyHours(),
    loadLessonMetrics(),
    loadRetention(),
    loadFlashcardMetrics(),
    loadErrorMetrics(),
    loadSimulationMetrics()
  ]);

  updateDashboardSummaryFromDetails();

  await loadTodaySummary();
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
  initDashboardStreakVisual();

  await Promise.all([
    loadDashboardMetrics(),
    loadAgenda(),
    loadDashboardPassiveCcq()
  ]);
}

if (window.docmapUser) {
  initDashboard();
} else {
  window.addEventListener("docmap:ready", initDashboard, { once: true });
}
