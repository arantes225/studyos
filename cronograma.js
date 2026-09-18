const scheduleSb = window.supabaseClient;

const scheduleState = {
  user: null,
  file: null,
  parsedRows: [],
  detected: null,
  topics: [],
  weekAnchor: startOfDaySchedule(new Date()),
  draggingTopicId: null,
  alreadyDoneTopicId: null,
  themeSearch: "",
  themeAreaFilter: ""
};

const HEADER_ALIASES = {
  date: [
    "data",
    "date",
    "dia",
    "data aula",
    "data da aula",
    "data de estudo",
    "data estudo"
  ],

  area: [
    "area",
    "grande area",
    "macroarea",
    "macro area",
    "especialidade"
  ],

  materia: [
    "materia",
    "disciplina",
    "subarea",
    "sub area"
  ],

  theme: [
    "tema",
    "assunto",
    "conteudo",
    "conteudo da aula",
    "aula",
    "topico",
    "titulo",
    "titulo da aula"
  ],

  done: [
    "aula ja feita",
    "ja feita",
    "feito",
    "feita",
    "concluida",
    "concluido",
    "aula concluida",
    "aula concluido",
    "estudada",
    "estudado"
  ],

  studiedDate: [
    "data estudada",
    "data em que estudou",
    "data feita",
    "data concluida",
    "data da conclusao",
    "data de conclusao"
  ]
};

function normalizeHeader(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function escapeScheduleHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function startOfDaySchedule(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDaysSchedule(date, amount) {
  const copy = startOfDaySchedule(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function startOfWeekSchedule(date) {
  const copy = startOfDaySchedule(date);
  const day = copy.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  return addDaysSchedule(copy, delta);
}

function toISODateSchedule(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sameDateSchedule(a, b) {
  return toISODateSchedule(a) === toISODateSchedule(b);
}

function formatShortSchedule(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short"
  }).format(date).replace(".", "");
}

function formatWeekRangeSchedule(start, end) {
  if (start.getMonth() === end.getMonth()) {
    const monthYear = new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric"
    }).format(end);

    return `${start.getDate()}–${end.getDate()} de ${monthYear}`;
  }

  return `${formatShortSchedule(start)} – ${formatShortSchedule(end)} de ${end.getFullYear()}`;
}

function currentImportMode() {
  return document.querySelector('input[name="import-mode"]:checked')?.value || "dates";
}

function setImportStatus(text, type = "") {
  const el = document.getElementById("import-status");
  el.textContent = text;
  el.className = `import-status ${type}`.trim();
}

function findHeaderIndex(normalizedHeaders, aliases) {
  return normalizedHeaders.findIndex((header) => aliases.includes(header));
}

function detectHeaderRow(rows) {
  const maxScan = Math.min(rows.length, 12);

  let bestIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < maxScan; i += 1) {
    const normalized = (rows[i] || []).map(normalizeHeader);

    let score = 0;

    for (const aliases of Object.values(HEADER_ALIASES)) {
      if (normalized.some((header) => aliases.includes(header))) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function parseExcelDate(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toISODateSchedule(value);
  }

  if (typeof value === "number") {
    const decoded = window.XLSX?.SSF?.parse_date_code(value);

    if (decoded?.y && decoded?.m && decoded?.d) {
      return toISODateSchedule(
        new Date(decoded.y, decoded.m - 1, decoded.d)
      );
    }
  }

  const text = String(value).trim();

  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (match) {
    const [, y, m, d] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  match = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);

  if (match) {
    let [, d, m, y] = match;

    if (y.length === 2) {
      y = Number(y) >= 70 ? `19${y}` : `20${y}`;
    }

    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}

function parseBooleanCell(value) {
  if (typeof value === "boolean") return value;

  if (typeof value === "number") return value === 1;

  const normalized = normalizeHeader(value);

  return [
    "sim",
    "s",
    "yes",
    "y",
    "true",
    "1",
    "feito",
    "feita",
    "concluido",
    "concluida",
    "estudado",
    "estudada"
  ].includes(normalized);
}

function getCell(row, index) {
  if (index < 0) return "";
  return row[index] ?? "";
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function parseWorkbookRows(matrix, sheetName) {
  if (!matrix.length) {
    throw new Error("A planilha está vazia.");
  }

  const headerRowIndex = detectHeaderRow(matrix);
  const rawHeaders = matrix[headerRowIndex] || [];
  const normalizedHeaders = rawHeaders.map(normalizeHeader);

  const indexes = {
    date: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.date),
    area: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.area),
    materia: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.materia),
    theme: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.theme),
    done: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.done),
    studiedDate: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.studiedDate)
  };

  if (indexes.theme < 0) {
    throw new Error(
      'Não encontrei uma coluna de Tema/Assunto/Conteúdo/Aula.'
    );
  }

  const mode = currentImportMode();

  if (mode === "dates" && indexes.date < 0) {
    throw new Error(
      'No modo "Importar datas", a planilha precisa ter uma coluna Data.'
    );
  }

  const parsed = [];

  for (
    let rowIndex = headerRowIndex + 1;
    rowIndex < matrix.length;
    rowIndex += 1
  ) {
    const row = matrix[rowIndex] || [];

    const theme = cleanText(getCell(row, indexes.theme));
    const area = cleanText(getCell(row, indexes.area));
    const materia = cleanText(getCell(row, indexes.materia));

    const rawDate = getCell(row, indexes.date);
    const rawDone = getCell(row, indexes.done);
    const rawStudiedDate = getCell(row, indexes.studiedDate);

    const date = parseExcelDate(rawDate);
    const alreadyDone = indexes.done >= 0
      ? parseBooleanCell(rawDone)
      : false;

    const studiedDate = indexes.studiedDate >= 0
      ? parseExcelDate(rawStudiedDate)
      : null;

    const fullyBlank =
      !theme &&
      !area &&
      !materia &&
      !cleanText(rawDate) &&
      !cleanText(rawDone) &&
      !cleanText(rawStudiedDate);

    if (fullyBlank) continue;

    const errors = [];

    if (!theme) {
      errors.push("Tema ausente");
    }

    if (
      mode === "dates"
      && !alreadyDone
      && !date
    ) {
      errors.push("Data inválida/ausente");
    }

    if (
      indexes.studiedDate >= 0
      && cleanText(rawStudiedDate)
      && !studiedDate
    ) {
      errors.push("Data estudada inválida");
    }

    parsed.push({
      rowNumber: rowIndex + 1,
      date,
      area,
      materia,
      theme,
      alreadyDone,
      studiedDate,
      errors
    });
  }

  return {
    sheetName,
    headerRowIndex,
    rawHeaders,
    indexes,
    rows: parsed
  };
}

function renderPreview() {
  const preview = document.getElementById("import-preview");
  const body = document.getElementById("preview-body");
  const summary = document.getElementById("preview-summary");
  const mode = currentImportMode();

  const rows = scheduleState.parsedRows;

  if (!rows.length) {
    preview.classList.remove("visible");
    body.innerHTML = "";
    summary.textContent = "";
    return;
  }

  const invalid = rows.filter((row) => row.errors.length > 0).length;
  const done = rows.filter((row) => row.alreadyDone).length;
  const valid = rows.length - invalid;

  summary.textContent =
    `${valid} válida${valid === 1 ? "" : "s"} · ${done} já feita${done === 1 ? "" : "s"} · ${invalid} com problema`;

  body.innerHTML = rows.slice(0, 15).map((row) => {
    const status = row.errors.length
      ? `<span class="row-error">${escapeScheduleHtml(row.errors.join(", "))}</span>`
      : "Pronta";

    const doneCell = row.alreadyDone
      ? '<span class="done-pill">Sim</span>'
      : "Não";

    return `
      <tr>
        <td>${row.rowNumber}</td>
        <td>${row.alreadyDone ? "—" : (mode === "deck" ? "Ignorada" : escapeScheduleHtml(row.date || "—"))}</td>
        <td>${escapeScheduleHtml(row.area || "—")}</td>
        <td>${escapeScheduleHtml(row.materia || "—")}</td>
        <td>${escapeScheduleHtml(row.theme || "—")}</td>
        <td>${doneCell}</td>
        <td>${escapeScheduleHtml(row.studiedDate || "—")}</td>
        <td>${status}</td>
      </tr>
    `;
  }).join("");

  preview.classList.add("visible");

  const confirm = document.getElementById("confirm-import");
  confirm.disabled = invalid > 0 || valid === 0;

  if (rows.length > 15) {
    setImportStatus(`Mostrando 15 de ${rows.length} linhas na prévia.`);
  } else {
    setImportStatus("");
  }
}

async function parseSelectedFile(file) {
  if (!file) return;

  scheduleState.file = file;
  document.getElementById("file-name").textContent = file.name;
  setImportStatus("Lendo planilha...");

  try {
    const buffer = await file.arrayBuffer();

    const workbook = XLSX.read(buffer, {
      type: "array",
      cellDates: true
    });

    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      throw new Error("Não encontrei nenhuma aba na planilha.");
    }

    const worksheet = workbook.Sheets[sheetName];

    const matrix = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      raw: true
    });

    const detected = parseWorkbookRows(matrix, sheetName);

    scheduleState.detected = detected;
    scheduleState.parsedRows = detected.rows;

    renderPreview();

    setImportStatus(
      `Aba "${sheetName}" reconhecida. Confira a prévia antes de importar.`,
      "success"
    );
  } catch (error) {
    console.error(error);
    scheduleState.parsedRows = [];
    scheduleState.detected = null;
    renderPreview();
    setImportStatus(
      error.message || "Não foi possível ler a planilha.",
      "error"
    );
  }
}

function resetImport() {
  scheduleState.file = null;
  scheduleState.parsedRows = [];
  scheduleState.detected = null;

  document.getElementById("schedule-file").value = "";
  document.getElementById("file-name").textContent = "Selecione uma planilha";
  document.getElementById("import-preview").classList.remove("visible");
  document.getElementById("preview-body").innerHTML = "";
  document.getElementById("preview-summary").textContent = "";
  setImportStatus("");
}

async function createImportRecord(mode) {
  const metadata = {
    sheet_name: scheduleState.detected?.sheetName || null,
    detected_headers: scheduleState.detected?.rawHeaders || []
  };

  const { data, error } = await scheduleSb
    .from("schedule_imports")
    .insert({
      user_id: scheduleState.user.id,
      file_name: scheduleState.file?.name || null,
      mode,
      status: "processing",
      row_count: scheduleState.parsedRows.length,
      metadata
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

async function updateImportRecord(importId, values) {
  const { error } = await scheduleSb
    .from("schedule_imports")
    .update(values)
    .eq("id", importId);

  if (error) throw error;
}

function chunkArray(array, size) {
  const chunks = [];

  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }

  return chunks;
}

async function insertAlreadyDoneRow(row, importRecord, mode) {
  const { data: topic, error: insertError } = await scheduleSb
    .from("study_topics")
    .insert({
      user_id: scheduleState.user.id,
      import_id: importRecord.id,
      area: row.area || null,
      materia: row.materia || null,
      theme: row.theme,
      original_date: row.date || null,
      scheduled_date: mode === "dates" ? row.date : null,
      status: mode === "dates" && row.date ? "scheduled" : "deck"
    })
    .select()
    .single();

  if (insertError) throw insertError;

  const { error: doneError } = await scheduleSb.rpc(
    "mark_topic_already_done",
    {
      p_topic_id: topic.id,
      p_studied_on: row.studiedDate || null
    }
  );

  if (doneError) throw doneError;
}

async function confirmImport() {
  const mode = currentImportMode();
  const rows = scheduleState.parsedRows;

  if (!scheduleState.file || !rows.length) {
    setImportStatus("Selecione uma planilha primeiro.", "error");
    return;
  }

  const invalid = rows.filter((row) => row.errors.length > 0);

  if (invalid.length) {
    setImportStatus(
      "Corrija as linhas marcadas na planilha antes de importar.",
      "error"
    );
    return;
  }

  const button = document.getElementById("confirm-import");
  button.disabled = true;
  setImportStatus("Importando cronograma...");

  let importRecord = null;

  try {
    importRecord = await createImportRecord(mode);

    const regularRows = rows.filter((row) => !row.alreadyDone);
    const alreadyDoneRows = rows.filter((row) => row.alreadyDone);

    const payload = regularRows.map((row, index) => ({
      user_id: scheduleState.user.id,
      import_id: importRecord.id,
      area: row.area || null,
      materia: row.materia || null,
      theme: row.theme,
      original_date: row.date || null,
      scheduled_date: mode === "dates" ? row.date : null,
      deck_order: mode === "deck" ? index + 1 : null,
      status: mode === "dates" ? "scheduled" : "deck"
    }));

    for (const chunk of chunkArray(payload, 200)) {
      if (!chunk.length) continue;

      const { error } = await scheduleSb
        .from("study_topics")
        .insert(chunk);

      if (error) throw error;
    }

    for (const row of alreadyDoneRows) {
      await insertAlreadyDoneRow(
        row,
        importRecord,
        mode
      );
    }

    await updateImportRecord(importRecord.id, {
      status: "completed",
      row_count: rows.length,
      metadata: {
        ...importRecord.metadata,
        imported_rows: rows.length,
        already_done_rows: alreadyDoneRows.length
      }
    });

    const doneCount = alreadyDoneRows.length;

    resetImport();

    setImportStatus(
      `${rows.length} tema${rows.length === 1 ? "" : "s"} importado${rows.length === 1 ? "" : "s"} com sucesso` +
      (doneCount ? ` · ${doneCount} já distribuído${doneCount === 1 ? "" : "s"} para revisão.` : "."),
      "success"
    );

    await loadTopics();
  } catch (error) {
    console.error(error);

    if (importRecord?.id) {
      try {
        await updateImportRecord(importRecord.id, {
          status: "failed",
          error_message: error.message || "Erro desconhecido"
        });
      } catch (secondaryError) {
        console.error(secondaryError);
      }
    }

    setImportStatus(
      error.message || "Não foi possível importar o cronograma.",
      "error"
    );

    button.disabled = false;
  }
}

function topicMeta(topic) {
  return [topic.area, topic.materia].filter(Boolean).join(" · ");
}

function renderTopicCard(topic, compact = false) {
  const meta = topicMeta(topic);

  const startParams = new URLSearchParams({
    kind: "lesson",
    item_id: topic.id,
    title: topic.theme,
    date: topic.scheduled_date || ""
  });

  if (topic.area) startParams.set("area", topic.area);
  if (topic.materia) startParams.set("materia", topic.materia);

  return `
    <article
      class="topic-card"
      draggable="true"
      data-topic-id="${escapeScheduleHtml(topic.id)}"
    >
      <h3>${escapeScheduleHtml(topic.theme)}</h3>

      ${meta ? `<div class="topic-meta">${escapeScheduleHtml(meta)}</div>` : ""}

      <div class="topic-actions">
        <a
          class="topic-action primary"
          href="ambientacao.html?${escapeScheduleHtml(startParams.toString())}"
        >
          Iniciar
        </a>

        <button
          class="topic-action"
          type="button"
          data-complete-topic="${escapeScheduleHtml(topic.id)}"
        >
          Concluir
        </button>

        <button
          class="topic-action done"
          type="button"
          data-already-done-topic="${escapeScheduleHtml(topic.id)}"
        >
          Aula já feita
        </button>

        ${!compact ? `
          <button
            class="topic-action danger"
            type="button"
            data-delete-topic="${escapeScheduleHtml(topic.id)}"
          >
            Excluir
          </button>
        ` : ""}
      </div>
    </article>
  `;
}

function renderDeckCard(topic) {
  const meta = topicMeta(topic);

  return `
    <article
      class="deck-card"
      draggable="true"
      data-topic-id="${escapeScheduleHtml(topic.id)}"
    >
      <h3>${escapeScheduleHtml(topic.theme)}</h3>
      <p>${escapeScheduleHtml(meta || "Sem área/matéria")}</p>

      <div class="deck-schedule">
        <input
          type="date"
          data-deck-date="${escapeScheduleHtml(topic.id)}"
          aria-label="Data para ${escapeScheduleHtml(topic.theme)}"
        >

        <button
          type="button"
          data-schedule-topic="${escapeScheduleHtml(topic.id)}"
        >
          Agendar
        </button>
      </div>

      <div class="topic-actions">
        <button
          class="topic-action done"
          type="button"
          data-already-done-topic="${escapeScheduleHtml(topic.id)}"
        >
          Aula já feita
        </button>

        <button
          class="topic-action danger"
          type="button"
          data-delete-topic="${escapeScheduleHtml(topic.id)}"
        >
          Excluir
        </button>
      </div>
    </article>
  `;
}

function topicsOnDate(date) {
  const iso = toISODateSchedule(date);

  return scheduleState.topics.filter(
    (topic) =>
      topic.status === "scheduled" &&
      topic.completed_at === null &&
      topic.scheduled_date === iso
  );
}

function renderSummary() {
  const deck = scheduleState.topics.filter(
    (topic) =>
      topic.status === "deck" &&
      !topic.completed_at
  ).length;

  const scheduled = scheduleState.topics.filter(
    (topic) =>
      topic.status === "scheduled" &&
      !topic.completed_at
  ).length;

  const completed = scheduleState.topics.filter(
    (topic) => Boolean(topic.completed_at)
  ).length;

  document.getElementById("summary-deck").textContent = deck;
  document.getElementById("summary-scheduled").textContent = scheduled;
  document.getElementById("summary-completed").textContent = completed;
}

function renderPlanner() {
  const planner = document.getElementById("week-planner");
  const start = startOfWeekSchedule(scheduleState.weekAnchor);
  const end = addDaysSchedule(start, 6);
  const today = startOfDaySchedule(new Date());

  document.getElementById("planner-range").textContent =
    formatWeekRangeSchedule(start, end);

  const days = Array.from(
    { length: 7 },
    (_, index) => addDaysSchedule(start, index)
  );

  planner.innerHTML = days.map((date) => {
    const topics = topicsOnDate(date);

    const weekday = new Intl.DateTimeFormat("pt-BR", {
      weekday: "short"
    }).format(date).replace(".", "");

    return `
      <section
        class="planner-day ${sameDateSchedule(date, today) ? "today" : ""}"
        data-planner-date="${toISODateSchedule(date)}"
      >
        <header class="planner-day-header">
          <span>${escapeScheduleHtml(weekday)}</span>
          <strong>${date.getDate()}</strong>
        </header>

        <div class="planner-day-body">
          ${
            topics.length
              ? topics.map((topic) => renderTopicCard(topic, true)).join("")
              : '<div class="empty-planner">Solte uma aula aqui</div>'
          }
        </div>
      </section>
    `;
  }).join("");
}

function renderDeck() {
  const deck = scheduleState.topics
    .filter(
      (topic) =>
        topic.status === "deck" &&
        !topic.completed_at
    )
    .sort(
      (a, b) =>
        (a.deck_order ?? 999999) - (b.deck_order ?? 999999)
    );

  document.getElementById("deck-count").textContent =
    `${deck.length} tema${deck.length === 1 ? "" : "s"}`;

  document.getElementById("deck-list").innerHTML =
    deck.length
      ? deck.map(renderDeckCard).join("")
      : '<div class="empty-deck">Nenhum tema aguardando programação.</div>';
}


function setManualStatus(text, type = "") {
  const element =
    document.getElementById("manual-topic-status");

  if (!element) return;

  element.textContent = text;
  element.className =
    `manual-status ${type}`.trim();
}

async function addManualTopic(event) {
  event.preventDefault();

  const area =
    document.getElementById("manual-area").value.trim();

  const materia =
    document.getElementById("manual-materia").value.trim();

  const theme =
    document.getElementById("manual-theme").value.trim();

  const date =
    document.getElementById("manual-date").value || null;

  if (!theme) {
    setManualStatus(
      "Informe o tema da aula.",
      "error"
    );
    return;
  }

  const button =
    document.getElementById("manual-add-topic");

  button.disabled = true;
  setManualStatus("Adicionando...");

  const { error } = await scheduleSb.rpc(
    "create_study_topic",
    {
      p_area: area || null,
      p_materia: materia || null,
      p_theme: theme,
      p_original_date: date,
      p_scheduled_date: date,
      p_import_id: null,
      p_deck_order: null
    }
  );

  button.disabled = false;

  if (error) {
    console.error(error);

    setManualStatus(
      `Não foi possível adicionar: ${error.message}`,
      "error"
    );

    return;
  }

  document.getElementById("manual-topic-form").reset();

  setManualStatus(
    date
      ? "Aula adicionada ao cronograma."
      : "Aula adicionada ao deck.",
    "success"
  );

  await loadTopics();
}

function getActiveTopicsForLibrary() {
  return scheduleState.topics.filter(
    (topic) => !topic.completed_at
  );
}

function populateAreaFilter() {
  const select =
    document.getElementById("theme-area-filter");

  if (!select) return;

  const current =
    scheduleState.themeAreaFilter;

  const areas =
    Array.from(
      new Set(
        getActiveTopicsForLibrary()
          .map((topic) => topic.area?.trim())
          .filter(Boolean)
      )
    ).sort((a, b) =>
      a.localeCompare(
        b,
        "pt-BR",
        { sensitivity: "base" }
      )
    );

  select.innerHTML = `
    <option value="">Todas as áreas</option>
    ${areas.map((area) => `
      <option value="${escapeScheduleHtml(area)}">
        ${escapeScheduleHtml(area)}
      </option>
    `).join("")}
  `;

  select.value = areas.includes(current)
    ? current
    : "";
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatTopicDate(topic) {
  if (
    topic.status === "deck"
    || !topic.scheduled_date
  ) {
    return "No deck";
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  ).format(
    parseISODateForLibrary(
      topic.scheduled_date
    )
  );
}

function parseISODateForLibrary(value) {
  const [year, month, day] =
    String(value).split("-").map(Number);

  return new Date(
    year,
    month - 1,
    day
  );
}

function filteredLibraryTopics() {
  const search =
    normalizeSearchText(
      scheduleState.themeSearch
    );

  const areaFilter =
    scheduleState.themeAreaFilter;

  return getActiveTopicsForLibrary()
    .filter((topic) => {
      if (
        areaFilter
        && topic.area !== areaFilter
      ) {
        return false;
      }

      if (!search) return true;

      const haystack =
        normalizeSearchText(
          [
            topic.theme,
            topic.materia,
            topic.area
          ]
            .filter(Boolean)
            .join(" ")
        );

      return haystack.includes(search);
    })
    .sort((a, b) => {
      const aDeck =
        !a.scheduled_date ? 1 : 0;

      const bDeck =
        !b.scheduled_date ? 1 : 0;

      if (aDeck !== bDeck) {
        return aDeck - bDeck;
      }

      if (
        a.scheduled_date
        && b.scheduled_date
        && a.scheduled_date !== b.scheduled_date
      ) {
        return a.scheduled_date.localeCompare(
          b.scheduled_date
        );
      }

      return String(a.theme).localeCompare(
        String(b.theme),
        "pt-BR",
        { sensitivity: "base" }
      );
    });
}

function renderThemeLibrary() {
  const container =
    document.getElementById("theme-library-list");

  const count =
    document.getElementById("theme-list-count");

  if (!container || !count) return;

  populateAreaFilter();

  const topics =
    filteredLibraryTopics();

  count.textContent =
    `${topics.length} ${
      topics.length === 1
        ? "aula"
        : "aulas"
    }`;

  if (!topics.length) {
    container.innerHTML = `
      <div class="theme-library-empty">
        Nenhuma aula encontrada com esse filtro.
      </div>
    `;
    return;
  }

  container.innerHTML =
    topics.map((topic) => {
      const isDeck =
        topic.status === "deck"
        || !topic.scheduled_date;

      return `
        <article class="theme-library-row">
          <div class="theme-library-title">
            <strong>${escapeScheduleHtml(topic.theme)}</strong>
            <small>
              ${escapeScheduleHtml(
                topic.materia
                || "Sem matéria"
              )}
            </small>
          </div>

          <div class="theme-library-cell hide-medium">
            ${escapeScheduleHtml(
              topic.area
              || "Sem área"
            )}
          </div>

          <div class="theme-library-cell hide-medium">
            ${escapeScheduleHtml(
              topic.materia
              || "—"
            )}
          </div>

          <div class="theme-library-date ${isDeck ? "deck" : ""}">
            ${escapeScheduleHtml(
              formatTopicDate(topic)
            )}
          </div>

          <button
            class="theme-library-action"
            type="button"
            data-library-topic="${escapeScheduleHtml(topic.id)}"
          >
            ${isDeck ? "Ir para deck" : "Ver na semana"}
          </button>
        </article>
      `;
    }).join("");

  document
    .querySelectorAll("[data-library-topic]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        focusLibraryTopic(
          button.dataset.libraryTopic
        );
      });
    });
}

function focusLibraryTopic(topicId) {
  const topic =
    scheduleState.topics.find(
      (item) => item.id === topicId
    );

  if (!topic) return;

  if (
    topic.status === "deck"
    || !topic.scheduled_date
  ) {
    document
      .getElementById("deck-dropzone")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

    return;
  }

  scheduleState.weekAnchor =
    parseISODateForLibrary(
      topic.scheduled_date
    );

  renderSchedule();

  document
    .getElementById("week-planner")
    ?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
}

function wireManualTopicForm() {
  document
    .getElementById("manual-topic-form")
    ?.addEventListener(
      "submit",
      addManualTopic
    );
}

function wireThemeLibraryFilters() {
  const search =
    document.getElementById("theme-search");

  const area =
    document.getElementById("theme-area-filter");

  search?.addEventListener(
    "input",
    () => {
      scheduleState.themeSearch =
        search.value;

      renderThemeLibrary();
    }
  );

  area?.addEventListener(
    "change",
    () => {
      scheduleState.themeAreaFilter =
        area.value;

      renderThemeLibrary();
    }
  );
}

function renderSchedule() {
  renderSummary();
  renderPlanner();
  renderDeck();
  renderThemeLibrary();
  wireDynamicInteractions();
}

function wireDynamicInteractions() {
  document
    .querySelectorAll("[data-topic-id][draggable='true']")
    .forEach((card) => {
      card.addEventListener("dragstart", (event) => {
        const topicId = card.dataset.topicId;
        scheduleState.draggingTopicId = topicId;
        event.dataTransfer.setData("text/plain", topicId);
        event.dataTransfer.effectAllowed = "move";
        card.classList.add("dragging");
      });

      card.addEventListener("dragend", () => {
        scheduleState.draggingTopicId = null;
        card.classList.remove("dragging");

        document
          .querySelectorAll(".drop-target")
          .forEach((element) => element.classList.remove("drop-target"));
      });
    });

  document.querySelectorAll("[data-planner-date]").forEach((day) => {
    day.addEventListener("dragover", (event) => {
      event.preventDefault();
      day.classList.add("drop-target");
    });

    day.addEventListener("dragleave", () => {
      day.classList.remove("drop-target");
    });

    day.addEventListener("drop", async (event) => {
      event.preventDefault();
      day.classList.remove("drop-target");

      const topicId =
        event.dataTransfer.getData("text/plain") ||
        scheduleState.draggingTopicId;

      if (!topicId) return;

      await scheduleTopic(
        topicId,
        day.dataset.plannerDate
      );
    });
  });

  document.querySelectorAll("[data-schedule-topic]").forEach((button) => {
    button.addEventListener("click", async () => {
      const topicId = button.dataset.scheduleTopic;

      const input = document.querySelector(
        `[data-deck-date="${CSS.escape(topicId)}"]`
      );

      const date = input?.value;

      if (!date) {
        alert("Escolha uma data.");
        return;
      }

      await scheduleTopic(topicId, date);
    });
  });

  document.querySelectorAll("[data-complete-topic]").forEach((button) => {
    button.addEventListener("click", async () => {
      await completeTopic(button.dataset.completeTopic);
    });
  });

  document.querySelectorAll("[data-already-done-topic]").forEach((button) => {
    button.addEventListener("click", () => {
      openAlreadyDoneDialog(
        button.dataset.alreadyDoneTopic
      );
    });
  });

  document.querySelectorAll("[data-delete-topic]").forEach((button) => {
    button.addEventListener("click", async () => {
      await deleteTopic(button.dataset.deleteTopic);
    });
  });
}

async function loadTopics() {
  const { data, error } = await scheduleSb
    .from("study_topics")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    setImportStatus(
      `Não foi possível carregar os temas: ${error.message}`,
      "error"
    );
    return;
  }

  scheduleState.topics = data || [];
  renderSchedule();
}

async function scheduleTopic(topicId, date) {
  const { error } = await scheduleSb.rpc("schedule_study_topic", {
    p_topic_id: topicId,
    p_date: date
  });

  if (error) {
    console.error(error);
    alert(`Não foi possível agendar: ${error.message}`);
    return;
  }

  await loadTopics();
}

async function returnTopicToDeck(topicId) {
  const topic = scheduleState.topics.find((item) => item.id === topicId);

  if (!topic || topic.completed_at) return;

  const { error } = await scheduleSb
    .from("study_topics")
    .update({
      scheduled_date: null,
      status: "deck"
    })
    .eq("id", topicId);

  if (error) {
    console.error(error);
    alert(`Não foi possível devolver ao deck: ${error.message}`);
    return;
  }

  await loadTopics();
}

async function completeTopic(topicId) {
  const topic = scheduleState.topics.find((item) => item.id === topicId);

  if (!topic) return;

  const confirmed = window.confirm(
    `Concluir "${topic.theme}"? As revisões da matéria serão distribuídas automaticamente.`
  );

  if (!confirmed) return;

  const { error } = await scheduleSb.rpc("complete_study_topic", {
    p_topic_id: topicId
  });

  if (error) {
    console.error(error);
    alert(`Não foi possível concluir: ${error.message}`);
    return;
  }

  await loadTopics();
}

function openAlreadyDoneDialog(topicId) {
  const topic = scheduleState.topics.find((item) => item.id === topicId);

  if (!topic) return;

  scheduleState.alreadyDoneTopicId = topicId;

  document.getElementById("already-done-title").textContent =
    topic.theme;

  document.getElementById("already-done-date").value = "";

  document.getElementById("already-done-dialog").showModal();
}

function closeAlreadyDoneDialog() {
  scheduleState.alreadyDoneTopicId = null;

  const dialog = document.getElementById("already-done-dialog");

  if (dialog.open) {
    dialog.close();
  }
}

async function submitAlreadyDone(event) {
  event.preventDefault();

  const topicId = scheduleState.alreadyDoneTopicId;
  const studiedOn =
    document.getElementById("already-done-date").value || null;

  if (!topicId) return;

  const topic = scheduleState.topics.find((item) => item.id === topicId);

  closeAlreadyDoneDialog();

  const { error } = await scheduleSb.rpc(
    "mark_topic_already_done",
    {
      p_topic_id: topicId,
      p_studied_on: studiedOn
    }
  );

  if (error) {
    console.error(error);
    alert(`Não foi possível marcar como já feita: ${error.message}`);
    return;
  }

  alert(
    `"${topic?.theme || "Aula"}" foi marcada como já feita. As revisões foram distribuídas na agenda.`
  );

  await loadTopics();
}

async function deleteTopic(topicId) {
  const topic = scheduleState.topics.find((item) => item.id === topicId);

  if (!topic) return;

  const confirmed = window.confirm(
    `Excluir "${topic.theme}" do cronograma?`
  );

  if (!confirmed) return;

  const { error } = await scheduleSb
    .from("study_topics")
    .delete()
    .eq("id", topicId);

  if (error) {
    console.error(error);
    alert(`Não foi possível excluir: ${error.message}`);
    return;
  }

  await loadTopics();
}

function wireImportControls() {
  const fileInput = document.getElementById("schedule-file");
  const fileDrop = document.getElementById("file-drop");

  fileInput.addEventListener("change", () => {
    parseSelectedFile(fileInput.files?.[0] || null);
  });

  fileDrop.addEventListener("dragover", (event) => {
    event.preventDefault();
    fileDrop.classList.add("dragover");
  });

  fileDrop.addEventListener("dragleave", () => {
    fileDrop.classList.remove("dragover");
  });

  fileDrop.addEventListener("drop", (event) => {
    event.preventDefault();
    fileDrop.classList.remove("dragover");

    const file = event.dataTransfer.files?.[0];

    if (file) {
      parseSelectedFile(file);
    }
  });

  document
    .querySelectorAll('input[name="import-mode"]')
    .forEach((radio) => {
      radio.addEventListener("change", async () => {
        if (scheduleState.file) {
          await parseSelectedFile(scheduleState.file);
        }
      });
    });

  document
    .getElementById("cancel-import")
    .addEventListener("click", resetImport);

  document
    .getElementById("confirm-import")
    .addEventListener("click", confirmImport);
}

function wirePlannerNavigation() {
  document.getElementById("week-prev").addEventListener("click", () => {
    scheduleState.weekAnchor =
      addDaysSchedule(scheduleState.weekAnchor, -7);

    renderSchedule();
  });

  document.getElementById("week-next").addEventListener("click", () => {
    scheduleState.weekAnchor =
      addDaysSchedule(scheduleState.weekAnchor, 7);

    renderSchedule();
  });

  document.getElementById("week-today").addEventListener("click", () => {
    scheduleState.weekAnchor = startOfDaySchedule(new Date());

    renderSchedule();
  });
}

function wireDeckDropzone() {
  const deckZone = document.getElementById("deck-dropzone");

  deckZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    deckZone.classList.add("drop-target");
  });

  deckZone.addEventListener("dragleave", () => {
    deckZone.classList.remove("drop-target");
  });

  deckZone.addEventListener("drop", async (event) => {
    event.preventDefault();
    deckZone.classList.remove("drop-target");

    const topicId =
      event.dataTransfer.getData("text/plain") ||
      scheduleState.draggingTopicId;

    if (!topicId) return;

    await returnTopicToDeck(topicId);
  });
}

function wireAlreadyDoneDialog() {
  document
    .getElementById("already-done-form")
    .addEventListener("submit", submitAlreadyDone);

  document
    .getElementById("already-done-cancel")
    .addEventListener("click", closeAlreadyDoneDialog);
}

async function initCronograma() {
  scheduleState.user = window.docmapUser;

  wireImportControls();
  wirePlannerNavigation();
  wireDeckDropzone();
  wireAlreadyDoneDialog();
  wireManualTopicForm();
  wireThemeLibraryFilters();

  await loadTopics();
}

if (window.docmapUser) {
  initCronograma();
} else {
  window.addEventListener(
    "docmap:ready",
    initCronograma,
    { once: true }
  );
}
