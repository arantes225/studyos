const dashboardSb = window.supabaseClient;

const agendaState = {
  view: "week",
  anchorDate: startOfDay(new Date()),
  items: [],
  itemMap: new Map(),
  movingKey: null,
  loading: false,
  managedEvents: [],
  managerOpen: false,
  managerDateFrom: "",
  managerDateTo: "",
  selectedManagedEventIds: new Set(),
  editingEventId: null
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

function formatDayLabel(date) {
  return capitalize(
    new Intl.DateTimeFormat(
      "pt-BR",
      {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
      }
    ).format(date)
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
  if (agendaState.view === "day") {
    const day =
      startOfDay(
        agendaState.anchorDate
      );

    return {
      displayStart: day,
      displayEnd: day,
      queryStart: day,
      queryEnd: day
    };
  }

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
    registration_deadline: { label: "Inscrição", className: "registration" },
    personal_event: { label: "Evento", className: "personal-event" }
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

  return `/ambientacao/?${params.toString()}`;
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
        ? `/editais/?exam_id=${encodeURIComponent(item.item_id)}`
        : "/editais/";

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

function renderDay() {
  const date =
    startOfDay(
      agendaState.anchorDate
    );

  const today =
    startOfDay(
      new Date()
    );

  const dayItems =
    itemsForDate(
      date
    );

  const isToday =
    sameDate(
      date,
      today
    );

  const weekday =
    capitalize(
      new Intl.DateTimeFormat(
        "pt-BR",
        {
          weekday: "long"
        }
      )
        .format(
          date
        )
    );

  return `
    <div class="day-calendar">
      <section
        class="calendar-day ${isToday ? "today" : ""}"
        data-drop-date="${toISODate(date)}"
      >
        <header class="calendar-day-header">
          <span>${escapeDashboardHtml(weekday)}</span>
          <strong>${date.getDate()}</strong>
        </header>

        <div class="calendar-day-body">
          ${
            dayItems.length
              ? dayItems
                  .map(
                    renderActivityCard
                  )
                  .join("")
              : '<div class="empty-day">Sem atividades</div>'
          }
        </div>
      </section>
    </div>
  `;
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
              data-calendar-date="${toISODate(date)}"
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

function updateCalendarViewControls() {
  const dayButton =
    document.getElementById(
      "view-day"
    );

  const weekButton =
    document.getElementById(
      "view-week"
    );

  const monthButton =
    document.getElementById(
      "view-month"
    );

  const currentButton =
    document.getElementById(
      "calendar-today"
    );

  dayButton
    ?.classList
    .toggle(
      "active",
      agendaState.view === "day"
    );

  weekButton
    ?.classList
    .toggle(
      "active",
      agendaState.view === "week"
    );

  monthButton
    ?.classList
    .toggle(
      "active",
      agendaState.view === "month"
    );

  if (
    currentButton
  ) {
    currentButton.textContent =
      "Hoje";
  }
}

function renderCalendar() {
  const calendar = document.getElementById("calendar");
  const label = document.getElementById("calendar-range-label");

  if (!calendar || !label) return;

  const range = getVisibleRange();

  updateCalendarViewControls();

  if (
    agendaState.view === "day"
  ) {
    label.textContent =
      formatDayLabel(
        range.displayStart
      );

    calendar.innerHTML =
      renderDay();

  } else if (
    agendaState.view === "week"
  ) {
    label.textContent =
      formatWeekRange(
        range.displayStart,
        range.displayEnd
      );

    calendar.innerHTML =
      renderWeek();

  } else {
    label.textContent =
      formatMonthYear(
        range.displayStart
      );

    calendar.innerHTML =
      renderMonth();
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
  if (
    agendaState.view === "month"
  ) {
    document
      .querySelectorAll(
        "[data-calendar-date]"
      )
      .forEach(
        day => {
          day.addEventListener(
            "click",
            async event => {
              /*
                Cliques nos botões/links internos continuam executando
                a própria ação e não mudam a visualização.
              */
              if (
                event.target.closest(
                  "a,button,input,select,textarea"
                )
              ) {
                return;
              }

              const iso =
                day.dataset
                  .calendarDate;

              if (
                !iso
              ) {
                return;
              }

              const [
                year,
                month,
                date
              ] =
                iso
                  .split("-")
                  .map(Number);

              agendaState.anchorDate =
                new Date(
                  year,
                  month - 1,
                  date
                );

              agendaState.view =
                "week";

              await loadAgenda();
            }
          );
        }
      );
  }

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

function fitDashboardCcqText(element) {
  if (!element) return;

  const maxSize = 24;
  const minSize = 11;
  const stage = element.closest(".dashboard-passive-ccq-stage");

  element.style.fontSize = maxSize + "px";
  element.style.webkitLineClamp = "unset";
  element.style.display = "block";
  element.style.overflow = "visible";

  if (!stage) return;

  const meta = stage.querySelector(".dashboard-passive-ccq-meta");
  const availableHeight = Math.max(
    44,
    stage.clientHeight
      - (meta?.offsetHeight || 0)
      - 12
  );

  let size = maxSize;

  while (
    size > minSize
    && (
      element.scrollHeight > availableHeight
      || element.scrollWidth > element.clientWidth + 1
    )
  ) {
    size -= 0.5;
    element.style.fontSize = size + "px";
  }
}

function showDashboardCcq() {
  if (!dashboardCcqState.items.length) return;

  const index = nextCcqIndex();
  if (index < 0) return;

  dashboardCcqState.currentIndex = index;

  const item = dashboardCcqState.items[index];
  const text = document.getElementById("dashboard-passive-ccq-text");
  const meta = document.getElementById("dashboard-passive-ccq-meta");

  if (text) {
    text.textContent = item.ccq || "";
    requestAnimationFrame(() => fitDashboardCcqText(text));
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

  if (meta) {
    meta.textContent =
      item.area
      || "";
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
  if (days < 4) {
    return {
      tier: "snow",
      label: "Esquentando",
      title: "Sequência"
    };
  }

  if (days < 7) {
    return {
      tier: "1",
      label: "Aquecendo",
      title: "Ofensiva"
    };
  }

  if (days < 30) {
    return {
      tier: "2",
      label: "Em ritmo",
      title: "Ofensiva"
    };
  }

  if (days < 90) {
    return {
      tier: "3",
      label: "Em chamas",
      title: "Ofensiva"
    };
  }

  if (days < 180) {
    return {
      tier: "4",
      label: "Imparável",
      title: "Ofensiva"
    };
  }

  if (days < 365) {
    return {
      tier: "5",
      label: "Incendiário",
      title: "Ofensiva"
    };
  }

  return {
    tier: "6",
    label: "Lendário",
    title: "Ofensiva"
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

  const title =
    document.getElementById(
      "dashboard-streak-title"
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

      if (title) {
        title.textContent =
          info.title;
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

function openEventDialog(
  eventItem = null
) {
  const dialog =
    document.getElementById(
      "event-dialog"
    );

  const dateInput =
    document.getElementById(
      "event-date"
    );

  const nameInput =
    document.getElementById(
      "event-name"
    );

  const timeInput =
    document.getElementById(
      "event-time"
    );

  const title =
    document.getElementById(
      "event-dialog-title"
    );

  const submit =
    document.getElementById(
      "event-submit"
    );

  if (!dialog) return;

  agendaState.editingEventId =
    eventItem?.id
    || null;

  if (nameInput) {
    nameInput.value =
      eventItem?.title
      || "";
  }

  if (timeInput) {
    timeInput.value =
      eventItem?.event_time
        ? String(
            eventItem.event_time
          ).slice(0, 5)
        : "";
  }

  if (dateInput) {
    dateInput.value =
      eventItem?.event_date
      || toISODate(
        agendaState.anchorDate
        || new Date()
      );
  }

  if (title) {
    title.textContent =
      eventItem
        ? "Editar evento"
        : "Adicionar evento";
  }

  if (submit) {
    submit.textContent =
      eventItem
        ? "Salvar alterações"
        : "Adicionar evento";
  }

  dialog.showModal();

  requestAnimationFrame(
    () => nameInput?.focus()
  );
}


function closeEventDialog() {
  agendaState.editingEventId =
    null;

  document
    .getElementById(
      "event-dialog"
    )
    ?.close();
}


async function handleEventForm(
  event
) {
  event.preventDefault();

  const name =
    String(
      document
        .getElementById(
          "event-name"
        )
        ?.value
      || ""
    )
      .trim();

  const date =
    String(
      document
        .getElementById(
          "event-date"
        )
        ?.value
      || ""
    )
      .trim();

  const time =
    String(
      document
        .getElementById(
          "event-time"
        )
        ?.value
      || ""
    )
      .trim();

  if (!name) {
    document
      .getElementById(
        "event-name"
      )
      ?.focus();

    return;
  }

  if (!date) {
    document
      .getElementById(
        "event-date"
      )
      ?.focus();

    return;
  }

  const submit =
    document.querySelector(
      "#event-form button[type='submit']"
    );

  const wasEditing =
    Boolean(
      agendaState.editingEventId
    );

  if (submit) {
    submit.disabled = true;
    submit.textContent =
      wasEditing
        ? "Salvando..."
        : "Adicionando...";
  }

  const editingId =
    agendaState.editingEventId;

  let error = null;

  if (editingId) {
    const result =
      await dashboardSb
        .from(
          "schedule_events"
        )
        .update({
          title:
            name,

          event_date:
            date,

          event_time:
            time || null,

          updated_at:
            new Date()
              .toISOString()
        })
        .eq(
          "id",
          editingId
        )
        .eq(
          "user_id",
          window.docmapUser.id
        );

    error =
      result.error;

  } else {
    const result =
      await dashboardSb
        .from(
          "schedule_events"
        )
        .insert({
          user_id:
            window.docmapUser.id,

          title:
            name,

          event_type:
            "other",

          event_date:
            date,

          event_time:
            time || null,

          source:
            "manual",

          confidence:
            "high",

          metadata: {
            created_from:
              "agenda",
            personal_event:
              true
          }
        });

    error =
      result.error;
  }

  if (submit) {
    submit.disabled = false;
    submit.textContent =
      wasEditing
        ? "Salvar alterações"
        : "Adicionar evento";
  }

  if (error) {
    console.error(error);
    setCalendarStatus(
      "Não foi possível adicionar o evento.",
      "error"
    );
    return;
  }

  closeEventDialog();

  setCalendarStatus(
    wasEditing
      ? "Evento atualizado."
      : "Evento adicionado.",
    "success"
  );

  await loadAgenda();

  if (
    agendaState.managerOpen
  ) {
    await loadManagedEvents();
  }
}



function formatManagedEventDate(
  value
) {
  if (!value) {
    return "Sem data";
  }

  const parts =
    String(value)
      .slice(0, 10)
      .split("-")
      .map(Number);

  if (
    parts.length !== 3
    || parts.some(
      value => !Number.isFinite(value)
    )
  ) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  ).format(
    new Date(
      parts[0],
      parts[1] - 1,
      parts[2]
    )
  );
}


function managedEventTypeLabel(
  type
) {
  const labels = {
    simulation:
      "Simulado programado",
    smart_simulation:
      "Simulado inteligente",
    full_exam:
      "Prova na íntegra",
    smart_review:
      "Revisão inteligente",
    external_review:
      "Revisão teórica",
    final_review:
      "Reta final",
    other:
      "Outro evento"
  };

  return labels[type]
    || "Evento";
}


function filteredManagedEvents() {
  return agendaState
    .managedEvents
    .filter(
      item => {
        if (
          agendaState.managerDateFrom
          && item.event_date
            < agendaState.managerDateFrom
        ) {
          return false;
        }

        if (
          agendaState.managerDateTo
          && item.event_date
            > agendaState.managerDateTo
        ) {
          return false;
        }

        return true;
      }
    );
}


function closeManagedEventMenus(
  exceptId = null
) {
  document
    .querySelectorAll(
      "[data-managed-event-menu]"
    )
    .forEach(
      menu => {
        if (
          exceptId
          && menu.dataset
            .managedEventMenu
            === exceptId
        ) {
          return;
        }

        menu.hidden =
          true;
      }
    );
}


function updateManagedEventBulkState() {
  const visibleIds =
    filteredManagedEvents()
      .map(
        item =>
          item.id
      );

  const selectedVisible =
    visibleIds.filter(
      id =>
        agendaState
          .selectedManagedEventIds
          .has(
            id
          )
    ).length;

  const selectAll =
    document.getElementById(
      "agenda-manager-select-all"
    );

  const deleteButton =
    document.getElementById(
      "agenda-manager-delete-selected"
    );

  if (selectAll) {
    selectAll.checked =
      visibleIds.length > 0
      && selectedVisible
        === visibleIds.length;

    selectAll.indeterminate =
      selectedVisible > 0
      && selectedVisible
        < visibleIds.length;
  }

  if (deleteButton) {
    const totalSelected =
      agendaState
        .selectedManagedEventIds
        .size;

    deleteButton.disabled =
      totalSelected === 0;

    deleteButton.textContent =
      totalSelected
        ? `Apagar selecionados (${totalSelected})`
        : "Apagar selecionados";
  }
}


function renderManagedEvents() {
  const list =
    document.getElementById(
      "agenda-manager-list"
    );

  const count =
    document.getElementById(
      "agenda-manager-count"
    );

  if (!list || !count) {
    return;
  }

  const items =
    filteredManagedEvents();

  count.textContent =
    `${items.length} evento${items.length === 1 ? "" : "s"}`;

  const validIds =
    new Set(
      agendaState
        .managedEvents
        .map(
          item =>
            item.id
        )
    );

  for (
    const id
    of agendaState
      .selectedManagedEventIds
  ) {
    if (!validIds.has(id)) {
      agendaState
        .selectedManagedEventIds
        .delete(id);
    }
  }

  if (!items.length) {
    list.innerHTML = `
      <div class="agenda-manager-empty">
        Nenhum evento encontrado neste período.
      </div>
    `;

    updateManagedEventBulkState();
    return;
  }

  list.innerHTML =
    items.map(
      item => {
        const time =
          item.event_time
            ? ` · ${escapeDashboardHtml(
                String(
                  item.event_time
                ).slice(0, 5)
              )}`
            : "";

        return `
          <article class="agenda-manager-row">
            <label
              class="agenda-manager-row-select"
              aria-label="Selecionar evento"
            >
              <input
                type="checkbox"
                data-managed-event-select="${escapeDashboardHtml(
                  item.id
                )}"
                ${agendaState.selectedManagedEventIds.has(item.id) ? "checked" : ""}
              >
            </label>

            <div class="agenda-manager-copy">
              <strong>${escapeDashboardHtml(
                item.title
                || "Evento"
              )}</strong>
              <small>${escapeDashboardHtml(
                managedEventTypeLabel(
                  item.event_type
                )
              )}</small>
            </div>

            <div class="agenda-manager-date">
              ${escapeDashboardHtml(
                formatManagedEventDate(
                  item.event_date
                )
              )}${time}
            </div>

            <div class="agenda-manager-menu-wrap">
              <button
                class="agenda-manager-menu-toggle"
                type="button"
                aria-label="Ações do evento"
                aria-expanded="false"
                data-managed-event-menu-toggle="${escapeDashboardHtml(
                  item.id
                )}"
              >
                ⋯
              </button>

              <div
                class="agenda-manager-menu"
                data-managed-event-menu="${escapeDashboardHtml(
                  item.id
                )}"
                hidden
              >
                <button
                  type="button"
                  data-managed-event-edit="${escapeDashboardHtml(
                    item.id
                  )}"
                >
                  Editar
                </button>

                <button
                  class="danger"
                  type="button"
                  data-managed-event-delete="${escapeDashboardHtml(
                    item.id
                  )}"
                >
                  Apagar
                </button>
              </div>
            </div>
          </article>
        `;
      }
    ).join("");

  list
    .querySelectorAll(
      "[data-managed-event-select]"
    )
    .forEach(
      input => {
        input.addEventListener(
          "change",
          () => {
            const id =
              input.dataset
                .managedEventSelect;

            if (input.checked) {
              agendaState
                .selectedManagedEventIds
                .add(id);
            } else {
              agendaState
                .selectedManagedEventIds
                .delete(id);
            }

            updateManagedEventBulkState();
          }
        );
      }
    );

  list
    .querySelectorAll(
      "[data-managed-event-menu-toggle]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          event => {
            event.stopPropagation();

            const id =
              button.dataset
                .managedEventMenuToggle;

            const menu =
              list.querySelector(
                `[data-managed-event-menu="${CSS.escape(
                  id
                )}"]`
              );

            if (!menu) {
              return;
            }

            const willOpen =
              menu.hidden;

            closeManagedEventMenus();

            menu.hidden =
              !willOpen;

            button.setAttribute(
              "aria-expanded",
              willOpen
                ? "true"
                : "false"
            );
          }
        );
      }
    );

  list
    .querySelectorAll(
      "[data-managed-event-edit]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const item =
              agendaState
                .managedEvents
                .find(
                  event =>
                    event.id
                    === button.dataset
                      .managedEventEdit
                );

            if (!item) {
              return;
            }

            closeManagedEventMenus();
            openEventDialog(
              item
            );
          }
        );
      }
    );

  list
    .querySelectorAll(
      "[data-managed-event-delete]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          async () => {
            await deleteManagedEvent(
              button.dataset
                .managedEventDelete
            );
          }
        );
      }
    );

  updateManagedEventBulkState();
}


async function loadManagedEvents() {
  const list =
    document.getElementById(
      "agenda-manager-list"
    );

  if (list) {
    list.innerHTML = `
      <div class="agenda-manager-empty">
        Carregando eventos...
      </div>
    `;
  }

  const {
    data,
    error
  } =
    await dashboardSb
      .from(
        "schedule_events"
      )
      .select(
        "id,title,event_type,event_date,event_time,area,materia,source,metadata"
      )
      .eq(
        "user_id",
        window.docmapUser.id
      )
      .order(
        "event_date",
        {
          ascending:
            true
        }
      )
      .order(
        "event_time",
        {
          ascending:
            true,
          nullsFirst:
            false
        }
      );

  if (error) {
    console.error(error);

    if (list) {
      list.innerHTML = `
        <div class="agenda-manager-empty">
          Não foi possível carregar os eventos.
        </div>
      `;
    }

    return;
  }

  agendaState.managedEvents =
    data || [];

  renderManagedEvents();
}


async function deleteManagedEvent(
  eventId
) {
  const item =
    agendaState.managedEvents
      .find(
        event =>
          event.id
          === eventId
      );

  if (!item) {
    return;
  }

  closeManagedEventMenus();

  const confirmed =
    await window.LuriaDialog.confirm(
      `Apagar "${item.title || "Evento"}" da agenda?`
    );

  if (!confirmed) {
    return;
  }

  const {
    error
  } =
    await dashboardSb
      .from(
        "schedule_events"
      )
      .delete()
      .eq(
        "id",
        eventId
      )
      .eq(
        "user_id",
        window.docmapUser.id
      );

  if (error) {
    console.error(error);

    setCalendarStatus(
      "Não foi possível apagar o evento.",
      "error"
    );

    return;
  }

  setCalendarStatus(
    "Evento apagado.",
    "success"
  );

  await Promise.all([
    loadManagedEvents(),
    loadAgenda()
  ]);
}


async function deleteSelectedManagedEvents() {
  const ids =
    Array.from(
      agendaState
        .selectedManagedEventIds
    );

  if (!ids.length) {
    return;
  }

  const confirmed =
    await window.LuriaDialog.confirm(
      `Apagar ${ids.length} evento${ids.length === 1 ? "" : "s"} selecionado${ids.length === 1 ? "" : "s"}?`
    );

  if (!confirmed) {
    return;
  }

  const button =
    document.getElementById(
      "agenda-manager-delete-selected"
    );

  if (button) {
    button.disabled =
      true;
  }

  const {
    error
  } =
    await dashboardSb
      .from(
        "schedule_events"
      )
      .delete()
      .in(
        "id",
        ids
      )
      .eq(
        "user_id",
        window.docmapUser.id
      );

  if (error) {
    console.error(error);

    setCalendarStatus(
      "Não foi possível apagar os eventos selecionados.",
      "error"
    );

    updateManagedEventBulkState();
    return;
  }

  agendaState
    .selectedManagedEventIds
    .clear();

  setCalendarStatus(
    "Eventos selecionados apagados.",
    "success"
  );

  await Promise.all([
    loadManagedEvents(),
    loadAgenda()
  ]);
}


async function toggleEventManager() {
  const panel =
    document.getElementById(
      "agenda-manager"
    );

  const button =
    document.getElementById(
      "calendar-manage-events"
    );

  if (!panel || !button) {
    return;
  }

  agendaState.managerOpen =
    panel.hidden;

  panel.hidden =
    !agendaState.managerOpen;

  button.classList.toggle(
    "active",
    agendaState.managerOpen
  );

  button.setAttribute(
    "aria-expanded",
    agendaState.managerOpen
      ? "true"
      : "false"
  );

  if (
    agendaState.managerOpen
  ) {
    await loadManagedEvents();
  }
}


function wireDashboardControls() {
  const dayButton =
    document.getElementById(
      "view-day"
    );

  const weekButton =
    document.getElementById(
      "view-week"
    );

  const monthButton =
    document.getElementById(
      "view-month"
    );

  async function setAgendaView(
    view
  ) {
    if (
      agendaState.view === view
    ) {
      updateCalendarViewControls();
      return;
    }

    agendaState.view =
      view;

    updateCalendarViewControls();

    await loadAgenda();
  }

  dayButton
    ?.addEventListener(
      "click",
      async () => {
        await setAgendaView(
          "day"
        );
      }
    );

  weekButton
    ?.addEventListener(
      "click",
      async () => {
        await setAgendaView(
          "week"
        );
      }
    );

  monthButton
    ?.addEventListener(
      "click",
      async () => {
        await setAgendaView(
          "month"
        );
      }
    );

  document
    .getElementById(
      "calendar-prev"
    )
    .addEventListener(
      "click",
      async () => {
        agendaState.anchorDate =
          agendaState.view === "day"
            ? addDays(
                agendaState.anchorDate,
                -1
              )
            : agendaState.view === "week"
              ? addDays(
                  agendaState.anchorDate,
                  -7
                )
              : addMonths(
                  agendaState.anchorDate,
                  -1
                );

        await loadAgenda();
      }
    );

  document
    .getElementById(
      "calendar-next"
    )
    .addEventListener(
      "click",
      async () => {
        agendaState.anchorDate =
          agendaState.view === "day"
            ? addDays(
                agendaState.anchorDate,
                1
              )
            : agendaState.view === "week"
              ? addDays(
                  agendaState.anchorDate,
                  7
                )
              : addMonths(
                  agendaState.anchorDate,
                  1
                );

        await loadAgenda();
      }
    );

  document
    .getElementById(
      "calendar-add-event"
    )
    ?.addEventListener(
      "click",
      () =>
        openEventDialog()
    );

  document
    .getElementById(
      "calendar-manage-events"
    )
    ?.addEventListener(
      "click",
      toggleEventManager
    );

  document
    .getElementById(
      "agenda-manager-select-all"
    )
    ?.addEventListener(
      "change",
      event => {
        const ids =
          filteredManagedEvents()
            .map(
              item =>
                item.id
            );

        if (
          event.target.checked
        ) {
          ids.forEach(
            id =>
              agendaState
                .selectedManagedEventIds
                .add(id)
          );
        } else {
          ids.forEach(
            id =>
              agendaState
                .selectedManagedEventIds
                .delete(id)
          );
        }

        renderManagedEvents();
      }
    );

  document
    .getElementById(
      "agenda-manager-delete-selected"
    )
    ?.addEventListener(
      "click",
      deleteSelectedManagedEvents
    );

  document
    .getElementById(
      "agenda-manager-date-from"
    )
    ?.addEventListener(
      "change",
      event => {
        agendaState.managerDateFrom =
          event.target.value
          || "";

        renderManagedEvents();
      }
    );

  document
    .getElementById(
      "agenda-manager-date-to"
    )
    ?.addEventListener(
      "change",
      event => {
        agendaState.managerDateTo =
          event.target.value
          || "";

        renderManagedEvents();
      }
    );

  document
    .getElementById(
      "agenda-manager-clear"
    )
    ?.addEventListener(
      "click",
      () => {
        agendaState.managerDateFrom =
          "";

        agendaState.managerDateTo =
          "";

        const from =
          document.getElementById(
            "agenda-manager-date-from"
          );

        const to =
          document.getElementById(
            "agenda-manager-date-to"
          );

        if (from) {
          from.value = "";
        }

        if (to) {
          to.value = "";
        }

        renderManagedEvents();
      }
    );

  document
    .getElementById(
      "event-form"
    )
    ?.addEventListener(
      "submit",
      handleEventForm
    );

  document
    .getElementById(
      "event-cancel"
    )
    ?.addEventListener(
      "click",
      closeEventDialog
    );

  document
    .getElementById(
      "event-close"
    )
    ?.addEventListener(
      "click",
      closeEventDialog
    );


  document
    .getElementById(
      "calendar-today"
    )
    .addEventListener(
      "click",
      async () => {
        agendaState.anchorDate =
          startOfDay(
            new Date()
          );

        await loadAgenda();
      }
    );

  document
    .getElementById(
      "move-form"
    )
    .addEventListener(
      "submit",
      handleMoveForm
    );

  document
    .getElementById(
      "move-cancel"
    )
    .addEventListener(
      "click",
      closeMoveDialog
    );

  document
    .getElementById(
      "move-close"
    )
    .addEventListener(
      "click",
      closeMoveDialog
    );

  document.addEventListener(
    "click",
    () =>
      closeManagedEventMenus()
  );

  updateCalendarViewControls();
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
