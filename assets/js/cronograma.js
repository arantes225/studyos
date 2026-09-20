const scheduleSb = window.supabaseClient;

const scheduleState = {
  user: null,
  file: null,
  parsedRows: [],
  detected: null,
  fileType: null,
  topics: [],
  events: [],
  existingTopicKeys: new Set(),
  existingEventKeys: new Set(),
  weekAnchor: startOfDaySchedule(new Date()),
  draggingTopicId: null,
  alreadyDoneTopicId: null,
  themeSearch: "",
  themeAreaFilter: "",
  themeDateFrom: "",
  themeDateTo: "",
  themeCompletionFilter: "all",

  studyMode:
    "medicine",

  theoryStudyWeekdays:
    [1, 3, 5],

  addMode:
    "automatic",

  selectedThemeIds:
    new Set()
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
  ],

  type: [
    "tipo",
    "tipo de atividade",
    "atividade",
    "categoria",
    "event type"
  ]
};


const SCHEDULE_KIND_LABELS = {
  lesson: "Aula",
  simulation: "Simulado programado",
  smart_simulation: "Simulado inteligente",
  full_exam: "Prova na íntegra",
  smart_review: "Revisão inteligente",
  external_review: "Revisão teórica",
  final_review: "Reta final",
  other: "Outro evento"
};


function scheduleKindLabel(kind) {
  return SCHEDULE_KIND_LABELS[kind]
    || SCHEDULE_KIND_LABELS.other;
}


function classifyScheduleKind(title, explicitType = "") {
  const source = normalizeHeader(
    `${explicitType} ${title}`
  );

  if (
    source.includes("simulado inteligente")
  ) {
    return "smart_simulation";
  }

  if (
    source.includes("simulado programado")
    || source.includes("simulado diagnostico")
  ) {
    return "simulation";
  }

  if (
    source.includes("prova na integra")
  ) {
    return "full_exam";
  }

  if (
    source.includes("revisao inteligente")
  ) {
    return "smart_review";
  }

  if (
    source.includes("revisao teorica")
  ) {
    return "external_review";
  }

  if (
    source.includes("reta final")
  ) {
    return "final_review";
  }

  if (
    source.includes("simulado")
  ) {
    return "simulation";
  }

  if (
    source.includes("prova")
    && explicitType
  ) {
    return "full_exam";
  }

  return "lesson";
}


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

function formatDateLabelSchedule(
  value
) {
  if (!value) {
    return "—";
  }

  let date;

  if (
    value instanceof Date
  ) {
    date =
      value;
  } else {
    const [
      year,
      month,
      day
    ] =
      String(value)
        .slice(0, 10)
        .split("-")
        .map(Number);

    date =
      new Date(
        year,
        month - 1,
        day
      );
  }

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric"
    }
  ).format(
    date
  );
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
    studiedDate: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.studiedDate),
    type: findHeaderIndex(normalizedHeaders, HEADER_ALIASES.type)
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
    const rawType = getCell(row, indexes.type);

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

    const kind =
      classifyScheduleKind(
        theme,
        cleanText(rawType)
      );

    if (
      (
        mode === "dates"
        || kind !== "lesson"
      )
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
      sourceLabel:
        `${sheetName} · linha ${rowIndex + 1}`,
      sourcePage: null,
      date,
      area,
      materia,
      theme,
      kind,
      alreadyDone,
      studiedDate,
      confidence: "high",
      include: true,
      duplicate: false,
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


function confidenceLabel(value) {
  const labels = {
    high: "Alta",
    medium: "Revisar",
    low: "Baixa"
  };

  return labels[value] || "Revisar";
}


function buildTopicKey(row) {
  return [
    row.date || "",
    normalizeHeader(row.theme)
  ].join("|");
}


function buildEventKey(row) {
  return [
    row.date || "",
    row.kind || "other",
    normalizeHeader(row.theme)
  ].join("|");
}


function refreshExistingKeys() {
  scheduleState.existingTopicKeys =
    new Set(
      scheduleState.topics
        .filter(
          (topic) =>
            topic.theme
            && (
              topic.scheduled_date
              || topic.original_date
            )
        )
        .map(
          (topic) =>
            [
              topic.scheduled_date
                || topic.original_date
                || "",
              normalizeHeader(
                topic.theme
              )
            ].join("|")
        )
    );

  scheduleState.existingEventKeys =
    new Set(
      scheduleState.events
        .filter(
          (event) =>
            event.title
            && event.event_date
        )
        .map(
          (event) =>
            [
              event.event_date,
              event.event_type,
              normalizeHeader(
                event.title
              )
            ].join("|")
        )
    );
}


function validateImportRow(row) {
  const errors = [];

  if (
    !cleanText(
      row.theme
    )
  ) {
    errors.push(
      "Conteúdo ausente"
    );
  }

  const mode =
    currentImportMode();

  if (
    (
      mode === "dates"
      || row.kind !== "lesson"
    )
    && !row.alreadyDone
    && !row.date
  ) {
    errors.push(
      "Data obrigatória"
    );
  }

  if (
    row.studiedDate
    && !parseExcelDate(
      row.studiedDate
    )
  ) {
    errors.push(
      "Data estudada inválida"
    );
  }

  row.errors =
    errors;

  row.duplicate =
    row.kind === "lesson"
      ? scheduleState
          .existingTopicKeys
          .has(
            buildTopicKey(
              row
            )
          )
      : scheduleState
          .existingEventKeys
          .has(
            buildEventKey(
              row
            )
          );

  if (
    row.duplicate
  ) {
    row.include =
      false;
  }
}


function applyDuplicateFlags() {
  refreshExistingKeys();

  for (
    const row
    of scheduleState.parsedRows
  ) {
    validateImportRow(
      row
    );
  }
}


function renderPreview() {
  const preview =
    document.getElementById(
      "import-preview"
    );

  const body =
    document.getElementById(
      "preview-body"
    );

  const summary =
    document.getElementById(
      "preview-summary"
    );

  const rows =
    scheduleState.parsedRows;


  if (!rows.length) {
    preview.classList.remove(
      "visible"
    );

    body.innerHTML =
      "";

    summary.textContent =
      "";

    return;
  }


  applyDuplicateFlags();


  const invalid =
    rows.filter(
      (row) =>
        row.errors.length > 0
    ).length;

  const duplicate =
    rows.filter(
      (row) =>
        row.duplicate
    ).length;

  const selected =
    rows.filter(
      (row) =>
        row.include
        && !row.duplicate
        && row.errors.length === 0
    ).length;


  summary.textContent =
    `${selected} selecionado${selected === 1 ? "" : "s"} · ${duplicate} já existente${duplicate === 1 ? "" : "s"} · ${invalid} com problema`;


  body.innerHTML =
    rows.map(
      (
        row,
        index
      ) => {
        const status =
          row.duplicate
            ? '<span class="duplicate-pill">Já existe</span>'
            : row.errors.length
              ? `<span class="row-error">${escapeScheduleHtml(
                  row.errors.join(
                    ", "
                  )
                )}</span>`
              : "Pronta";


        return `
          <tr data-preview-row="${index}">

            <td>
              <input
                class="preview-check"
                type="checkbox"
                data-preview-include="${index}"
                ${row.include && !row.duplicate ? "checked" : ""}
                ${row.duplicate ? "disabled" : ""}
                aria-label="Importar linha"
              >
            </td>

            <td>
              ${escapeScheduleHtml(
                row.sourceLabel
                || `Linha ${row.rowNumber || index + 1}`
              )}
            </td>

            <td>
              <input
                class="preview-input"
                type="date"
                value="${escapeScheduleHtml(
                  row.date
                  || ""
                )}"
                data-preview-field="date"
                data-preview-index="${index}"
              >
            </td>

            <td>
              <select
                class="preview-select"
                data-preview-field="kind"
                data-preview-index="${index}"
              >
                ${Object
                  .entries(
                    SCHEDULE_KIND_LABELS
                  )
                  .map(
                    (
                      [
                        value,
                        label
                      ]
                    ) => `
                      <option
                        value="${value}"
                        ${row.kind === value ? "selected" : ""}
                      >
                        ${escapeScheduleHtml(label)}
                      </option>
                    `
                  )
                  .join("")}
              </select>
            </td>

            <td>
              <input
                class="preview-input"
                type="text"
                value="${escapeScheduleHtml(
                  row.area
                  || ""
                )}"
                placeholder="Opcional"
                data-preview-field="area"
                data-preview-index="${index}"
              >
            </td>

            <td>
              <input
                class="preview-input"
                type="text"
                value="${escapeScheduleHtml(
                  row.materia
                  || ""
                )}"
                placeholder="Opcional"
                data-preview-field="materia"
                data-preview-index="${index}"
              >
            </td>

            <td>
              <input
                class="preview-input title-input"
                type="text"
                value="${escapeScheduleHtml(
                  row.theme
                  || ""
                )}"
                data-preview-field="theme"
                data-preview-index="${index}"
              >
            </td>

            <td>
              <input
                class="preview-check"
                type="checkbox"
                data-preview-field="alreadyDone"
                data-preview-index="${index}"
                ${row.alreadyDone ? "checked" : ""}
                ${row.kind !== "lesson" ? "disabled" : ""}
                aria-label="Aula já feita"
              >
            </td>

            <td>
              <input
                class="preview-input"
                type="date"
                value="${escapeScheduleHtml(
                  row.studiedDate
                  || ""
                )}"
                data-preview-field="studiedDate"
                data-preview-index="${index}"
                ${row.kind !== "lesson" ? "disabled" : ""}
              >
            </td>

            <td>
              <span class="confidence-pill ${escapeScheduleHtml(
                row.confidence
                || "medium"
              )}">
                ${escapeScheduleHtml(
                  confidenceLabel(
                    row.confidence
                  )
                )}
              </span>
            </td>

            <td>
              ${status}
            </td>

          </tr>
        `;
      }
    )
    .join("");


  preview.classList.add(
    "visible"
  );


  const confirm =
    document.getElementById(
      "confirm-import"
    );

  confirm.disabled =
    selected === 0;


  wirePreviewEditor();
}


function wirePreviewEditor() {
  document
    .querySelectorAll(
      "[data-preview-include]"
    )
    .forEach(
      (input) => {
        input.addEventListener(
          "change",
          () => {
            const index =
              Number(
                input.dataset
                  .previewInclude
              );

            const row =
              scheduleState
                .parsedRows[index];

            if (!row) return;

            row.include =
              input.checked;

            renderPreview();
          }
        );
      }
    );


  document
    .querySelectorAll(
      "[data-preview-field]"
    )
    .forEach(
      (input) => {
        input.addEventListener(
          "change",
          () => {
            const index =
              Number(
                input.dataset
                  .previewIndex
              );

            const field =
              input.dataset
                .previewField;

            const row =
              scheduleState
                .parsedRows[index];

            if (
              !row
              || !field
            ) {
              return;
            }


            if (
              field ===
              "alreadyDone"
            ) {
              row.alreadyDone =
                input.checked;

            } else {
              row[field] =
                input.value;
            }


            if (
              field === "kind"
              && row.kind
              !== "lesson"
            ) {
              row.alreadyDone =
                false;

              row.studiedDate =
                null;
            }


            if (
              row.duplicate
            ) {
              row.include =
                true;
            }


            validateImportRow(
              row
            );

            renderPreview();
          }
        );
      }
    );
}


function setPdfModeState(
  enabled
) {
  const dates =
    document.querySelector(
      'input[name="import-mode"][value="dates"]'
    );

  const deck =
    document.querySelector(
      'input[name="import-mode"][value="deck"]'
    );

  if (
    enabled
    && dates
  ) {
    dates.checked =
      true;
  }

  if (deck) {
    deck.disabled =
      enabled;
  }
}


function isPdfFile(
  file
) {
  return (
    file?.type ===
      "application/pdf"
    || /\.pdf$/i.test(
      file?.name
      || ""
    )
  );
}


function parseYearRangeText(
  text
) {
  const normalized =
    String(
      text
      || ""
    );

  const match =
    normalized.match(
      /(20\d{2})\D{0,12}(20\d{2})/
    );

  if (match) {
    return {
      startYear:
        Number(
          match[1]
        ),

      endYear:
        Number(
          match[2]
        )
    };
  }

  const single =
    normalized.match(
      /(20\d{2})/
    );

  const year =
    single
      ? Number(
          single[1]
        )
      : new Date()
          .getFullYear();

  return {
    startYear:
      year,

    endYear:
      year
  };
}


function pdfTokenTopY(
  item,
  viewport
) {
  return (
    viewport.height
    - Number(
        item.transform?.[5]
        || 0
      )
  );
}


function groupPdfTokensByY(
  tokens,
  tolerance = 3.8
) {
  const groups =
    [];

  const ordered =
    [...tokens]
      .sort(
        (
          a,
          b
        ) =>
          a.y - b.y
          || a.x - b.x
      );


  for (
    const token
    of ordered
  ) {
    const last =
      groups[
        groups.length - 1
      ];

    if (
      !last
      || Math.abs(
        token.y
        - last.y
      ) > tolerance
    ) {
      groups.push({
        y:
          token.y,

        tokens:
          [token]
      });

      continue;
    }


    last.tokens.push(
      token
    );

    last.y =
      last.tokens.reduce(
        (
          total,
          current
        ) =>
          total
          + current.y,
        0
      )
      / last.tokens.length;
  }


  return groups;
}


function pdfLineText(
  group
) {
  return cleanText(
    [...group.tokens]
      .sort(
        (
          a,
          b
        ) =>
          a.x - b.x
      )
      .map(
        (token) =>
          token.text
      )
      .join(" ")
  );
}


function shouldIgnorePdfLine(
  text
) {
  const normalized =
    normalizeHeader(
      text
    );

  if (!normalized) {
    return true;
  }

  if (
    normalized.startsWith(
      "se estiver em atraso"
    )
  ) {
    return true;
  }

  if (
    [
      "segunda",
      "terca",
      "quarta",
      "quinta",
      "sexta",
      "sabado",
      "domingo"
    ].includes(
      normalized
    )
  ) {
    return true;
  }

  if (
    /^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/\d{2}$/
      .test(
        normalized
      )
  ) {
    return true;
  }

  return false;
}


function isoFromPlannerDate(
  shortDate,
  pageMonth,
  pageYear
) {
  const match =
    String(
      shortDate
    )
      .match(
        /^(\d{1,2})\/(\d{1,2})$/
      );

  if (!match) {
    return null;
  }

  const day =
    Number(
      match[1]
    );

  const month =
    Number(
      match[2]
    );

  let year =
    pageYear;

  if (
    month
    < pageMonth - 6
  ) {
    year += 1;

  } else if (
    month
    > pageMonth + 6
  ) {
    year -= 1;
  }


  return [
    String(year)
      .padStart(
        4,
        "0"
      ),

    String(month)
      .padStart(
        2,
        "0"
      ),

    String(day)
      .padStart(
        2,
        "0"
      )
  ].join("-");
}


function makePdfRow({
  date,
  title,
  kind,
  pageNumber,
  confidence
}) {
  return {
    rowNumber:
      pageNumber,

    sourceLabel:
      `PDF · pág. ${pageNumber}`,

    sourcePage:
      pageNumber,

    date:
      date
      || null,

    area:
      "",

    materia:
      "",

    theme:
      cleanText(
        title
      ),

    kind:
      kind
      || classifyScheduleKind(
        title
      ),

    alreadyDone:
      false,

    studiedDate:
      null,

    confidence:
      confidence
      || "medium",

    include:
      true,

    duplicate:
      false,

    errors:
      []
  };
}


function dedupeParsedRows(
  rows
) {
  const seen =
    new Set();

  return (
    rows || []
  )
    .filter(
      (row) => {
        const key =
          [
            row.date
              || "",
            row.kind
              || "",
            normalizeHeader(
              row.theme
            )
          ].join("|");


        if (
          seen.has(
            key
          )
        ) {
          return false;
        }


        seen.add(
          key
        );

        return Boolean(
          row.theme
        );
      }
    );
}


async function extractPdfPageTokens(
  page
) {
  const viewport =
    page.getViewport({
      scale:
        1
    });

  const content =
    await page
      .getTextContent();

  return {
    width:
      viewport.width,

    height:
      viewport.height,

    tokens:
      content.items
        .map(
          (item) => ({
            text:
              cleanText(
                item.str
              ),

            x:
              Number(
                item.transform?.[4]
                || 0
              ),

            y:
              pdfTokenTopY(
                item,
                viewport
              ),

            width:
              Number(
                item.width
                || 0
              )
          })
        )
        .filter(
          (item) =>
            item.text
        )
  };
}


function parseMonthlyPlannerPage({
  tokens,
  width,
  height,
  pageNumber,
  calendarIndex,
  startYear
}) {
  const pageMonth =
    (
      calendarIndex
      % 12
    )
    + 1;

  const pageYear =
    startYear
    + Math.floor(
        calendarIndex
        / 12
      );


  const dateTokens =
    tokens.filter(
      (token) =>
        /^\d{1,2}\/\d{1,2}$/
          .test(
            token.text
          )
        && token.y
          > height * .18
        && token.y
          < height * .94
        && token.x
          > width * .08
        && token.x
          < width * .92
    );


  const dateGroups =
    groupPdfTokensByY(
      dateTokens,
      4.2
    )
      .filter(
        (group) =>
          group.tokens.length
          >= 5
      )
      .map(
        (group) => ({
          y:
            group.y,

          tokens:
            [...group.tokens]
              .sort(
                (
                  a,
                  b
                ) =>
                  a.x - b.x
              )
        })
      )
      .sort(
        (
          a,
          b
        ) =>
          a.y - b.y
      );


  if (
    dateGroups.length
    < 3
  ) {
    return [];
  }


  const rows =
    [];

  const rightThreshold =
    width * .66;


  for (
    let index = 0;
    index < dateGroups.length;
    index += 1
  ) {
    const dateGroup =
      dateGroups[index];

    const nextY =
      index + 1
        < dateGroups.length
          ? dateGroups[
              index + 1
            ].y
          : Math.min(
              height * .94,
              dateGroup.y
              + height * .15
            );


    const dates =
      dateGroup.tokens
        .slice(
          0,
          7
        )
        .map(
          (token) =>
            isoFromPlannerDate(
              token.text,
              pageMonth,
              pageYear
            )
        );


    if (
      dates.length
      < 7
    ) {
      continue;
    }


    const bandTokens =
      tokens.filter(
        (token) =>
          token.y
            > dateGroup.y + 7
          && token.y
            < nextY - 3
          && !/^\d{1,2}\/\d{1,2}$/
              .test(
                token.text
              )
      );


    const leftGroups =
      groupPdfTokensByY(
        bandTokens.filter(
          (token) =>
            token.x
            < rightThreshold
        )
      )
        .map(
          (group) =>
            pdfLineText(
              group
            )
        )
        .filter(
          (text) =>
            !shouldIgnorePdfLine(
              text
            )
        );


    const rightGroups =
      groupPdfTokensByY(
        bandTokens.filter(
          (token) =>
            token.x
            >= rightThreshold
        )
      )
        .map(
          (group) =>
            pdfLineText(
              group
            )
        )
        .filter(
          (text) =>
            !shouldIgnorePdfLine(
              text
            )
        );


    const left =
      leftGroups
        .filter(
          (text) =>
            !normalizeHeader(
              text
            ).startsWith(
              "se estiver"
            )
        );


    const rightTitle =
      cleanText(
        rightGroups.join(
          " "
        )
      );


    const rightKind =
      rightTitle
        ? classifyScheduleKind(
            rightTitle
          )
        : null;


    if (
      rightKind ===
      "simulation"
    ) {
      const leftSlots =
        [0, 3];

      left
        .slice(
          0,
          2
        )
        .forEach(
          (
            title,
            leftIndex
          ) => {
            rows.push(
              makePdfRow({
                date:
                  dates[
                    leftSlots[
                      leftIndex
                    ]
                  ],

                title,
                kind:
                  classifyScheduleKind(
                    title
                  ),

                pageNumber,
                confidence:
                  "high"
              })
            );
          }
        );


      rows.push(
        makePdfRow({
          date:
            dates[2],

          title:
            rightTitle,

          kind:
            rightKind,

          pageNumber,
          confidence:
            "high"
        })
      );

      continue;
    }


    if (
      rightKind ===
      "smart_simulation"
    ) {
      const leftSlots =
        [0, 2];

      left
        .slice(
          0,
          2
        )
        .forEach(
          (
            title,
            leftIndex
          ) => {
            rows.push(
              makePdfRow({
                date:
                  dates[
                    leftSlots[
                      leftIndex
                    ]
                  ],

                title,
                kind:
                  classifyScheduleKind(
                    title
                  ),

                pageNumber,
                confidence:
                  "high"
              })
            );
          }
        );


      rows.push(
        makePdfRow({
          date:
            dates[1],

          title:
            rightTitle,

          kind:
            rightKind,

          pageNumber,
          confidence:
            "high"
        })
      );

      continue;
    }


    if (
      rightKind ===
      "full_exam"
    ) {
      const hasReview =
        left.some(
          (title) =>
            [
              "smart_review",
              "external_review"
            ].includes(
              classifyScheduleKind(
                title
              )
            )
        );


      if (hasReview) {
        left
          .slice(
            0,
            2
          )
          .forEach(
            (
              title,
              leftIndex
            ) => {
              rows.push(
                makePdfRow({
                  date:
                    dates[
                      2 + leftIndex
                    ],

                  title,

                  kind:
                    classifyScheduleKind(
                      title
                    ),

                  pageNumber,
                  confidence:
                    "medium"
                })
              );
            }
          );

      } else {
        left
          .slice(
            0,
            1
          )
          .forEach(
            (title) => {
              rows.push(
                makePdfRow({
                  date:
                    dates[0],

                  title,

                  kind:
                    classifyScheduleKind(
                      title
                    ),

                  pageNumber,
                  confidence:
                    "medium"
                })
              );
            }
          );
      }


      rows.push(
        makePdfRow({
          date:
            dates[5],

          title:
            rightTitle,

          kind:
            rightKind,

          pageNumber,
          confidence:
            "medium"
        })
      );

      continue;
    }


    left
      .slice(
        0,
        3
      )
      .forEach(
        (
          title,
          leftIndex
        ) => {
          rows.push(
            makePdfRow({
              date:
                dates[
                  Math.min(
                    leftIndex * 2,
                    4
                  )
                ],

              title,

              kind:
                classifyScheduleKind(
                  title
                ),

              pageNumber,
              confidence:
                "low"
            })
          );
        }
      );


    if (rightTitle) {
      rows.push(
        makePdfRow({
          date:
            dates[5],

          title:
            rightTitle,

          kind:
            rightKind
            || "other",

          pageNumber,
          confidence:
            "low"
        })
      );
    }
  }


  return rows;
}


function parseGenericPdfLines({
  tokens,
  pageNumber
}) {
  const groups =
    groupPdfTokensByY(
      tokens,
      4.5
    );

  const rows =
    [];


  for (
    const group
    of groups
  ) {
    const text =
      pdfLineText(
        group
      );

    const dateMatch =
      text.match(
        /(?:^|\s)((?:\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})|(?:20\d{2}-\d{1,2}-\d{1,2}))(?:\s|$)/
      );


    if (!dateMatch) {
      continue;
    }


    const date =
      parseExcelDate(
        dateMatch[1]
      );

    const title =
      cleanText(
        text.replace(
          dateMatch[1],
          ""
        )
      );


    if (
      !date
      || !title
    ) {
      continue;
    }


    rows.push(
      makePdfRow({
        date,
        title,
        kind:
          classifyScheduleKind(
            title
          ),

        pageNumber,
        confidence:
          "medium"
      })
    );
  }


  return rows;
}


async function parsePdfFile(
  file
) {
  if (
    !window.pdfjsLib
  ) {
    throw new Error(
      "O leitor de PDF não carregou. Atualize a página e tente novamente."
    );
  }


  window.pdfjsLib
    .GlobalWorkerOptions
    .workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";


  const buffer =
    await file
      .arrayBuffer();

  const pdf =
    await window
      .pdfjsLib
      .getDocument({
        data:
          buffer
      })
      .promise;


  const firstPagesText =
    [];


  for (
    let pageNumber = 1;
    pageNumber
      <= Math.min(
        2,
        pdf.numPages
      );
    pageNumber += 1
  ) {
    const page =
      await pdf.getPage(
        pageNumber
      );

    const content =
      await page
        .getTextContent();

    firstPagesText.push(
      content.items
        .map(
          (item) =>
            item.str
        )
        .join(
          " "
        )
    );
  }


  const yearRange =
    parseYearRangeText(
      `${file.name} ${firstPagesText.join(" ")}`
    );


  const rows =
    [];

  let calendarIndex =
    0;

  let plannerPages =
    0;


  for (
    let pageNumber = 1;
    pageNumber
      <= pdf.numPages;
    pageNumber += 1
  ) {
    setImportStatus(
      `Lendo PDF: página ${pageNumber} de ${pdf.numPages}...`
    );


    const page =
      await pdf.getPage(
        pageNumber
      );

    const pageData =
      await extractPdfPageTokens(
        page
      );


    const normalizedText =
      normalizeHeader(
        pageData.tokens
          .map(
            (token) =>
              token.text
          )
          .join(
            " "
          )
      );


    const shortDateCount =
      pageData.tokens
        .filter(
          (token) =>
            /^\d{1,2}\/\d{1,2}$/
              .test(
                token.text
              )
        )
        .length;


    const looksLikePlanner =
      normalizedText.includes(
        "segunda"
      )
      && normalizedText.includes(
        "terca"
      )
      && normalizedText.includes(
        "quarta"
      )
      && shortDateCount
        >= 14;


    if (
      looksLikePlanner
    ) {
      plannerPages += 1;

      rows.push(
        ...parseMonthlyPlannerPage({
          ...pageData,
          pageNumber,
          calendarIndex,
          startYear:
            yearRange
              .startYear
        })
      );

      calendarIndex += 1;

      continue;
    }


    rows.push(
      ...parseGenericPdfLines({
        ...pageData,
        pageNumber
      })
    );
  }


  const deduped =
    dedupeParsedRows(
      rows
    );


  if (
    deduped.length
    < 2
  ) {
    throw new Error(
      "Não consegui reconstruir este PDF automaticamente. Tente Excel/CSV ou outro PDF com texto selecionável."
    );
  }


  return {
    rows:
      deduped,

    detected: {
      parser:
        plannerPages
          ? "monthly-planner"
          : "generic-pdf",

      plannerPages,

      pageCount:
        pdf.numPages,

      startYear:
        yearRange
          .startYear,

      endYear:
        yearRange
          .endYear
    }
  };
}


async function parseWorkbookFile(
  file
) {
  const buffer =
    await file
      .arrayBuffer();

  const workbook =
    XLSX.read(
      buffer,
      {
        type:
          "array",

        cellDates:
          true
      }
    );


  if (
    !workbook
      .SheetNames
      .length
  ) {
    throw new Error(
      "Não encontrei nenhuma aba na planilha."
    );
  }


  const accepted =
    [];

  const skipped =
    [];


  for (
    const sheetName
    of workbook
      .SheetNames
  ) {
    const worksheet =
      workbook
        .Sheets[
          sheetName
        ];

    const matrix =
      XLSX.utils
        .sheet_to_json(
          worksheet,
          {
            header:
              1,

            defval:
              "",

            raw:
              true
          }
        );


    try {
      const detected =
        parseWorkbookRows(
          matrix,
          sheetName
        );

      if (
        detected.rows.length
      ) {
        accepted.push(
          detected
        );
      }

    } catch (error) {
      skipped.push({
        sheetName,
        message:
          error.message
      });
    }
  }


  if (
    !accepted.length
  ) {
    throw new Error(
      skipped[0]
        ?.message
      || "Não encontrei uma aba com colunas reconhecíveis."
    );
  }


  return {
    rows:
      dedupeParsedRows(
        accepted.flatMap(
          (item) =>
            item.rows
        )
      ),

    detected: {
      parser:
        "spreadsheet",

      sheets:
        accepted.map(
          (item) => ({
            sheetName:
              item.sheetName,

            headerRowIndex:
              item.headerRowIndex,

            rawHeaders:
              item.rawHeaders
          })
        ),

      skippedSheets:
        skipped
    }
  };
}


async function parseSelectedFile(
  file
) {
  if (!file) {
    return;
  }


  scheduleState.file =
    file;

  scheduleState.fileType =
    isPdfFile(
      file
    )
      ? "pdf"
      : "spreadsheet";


  document
    .getElementById(
      "file-name"
    )
    .textContent =
      file.name;


  setPdfModeState(
    scheduleState.fileType
      === "pdf"
  );


  setImportStatus(
    scheduleState.fileType
      === "pdf"
        ? "Analisando estrutura do PDF..."
        : "Lendo planilha..."
  );


  try {
    const result =
      scheduleState.fileType
        === "pdf"
          ? await parsePdfFile(
              file
            )
          : await parseWorkbookFile(
              file
            );


    scheduleState.detected =
      result.detected;

    scheduleState.parsedRows =
      result.rows;


    applyDuplicateFlags();

    renderPreview();


    const counts =
      scheduleState.parsedRows
        .reduce(
          (
            acc,
            row
          ) => {
            acc[
              row.kind
            ] =
              (
                acc[
                  row.kind
                ]
                || 0
              )
              + 1;

            return acc;
          },
          {}
        );


    const lessons =
      counts.lesson
      || 0;

    const events =
      scheduleState.parsedRows.length
      - lessons;


    setImportStatus(
      `${scheduleState.parsedRows.length} itens reconhecidos · ${lessons} aulas · ${events} eventos. Confira a prévia antes de importar.`,
      "success"
    );

  } catch (error) {
    console.error(
      error
    );

    scheduleState
      .parsedRows =
        [];

    scheduleState
      .detected =
        null;

    renderPreview();

    setImportStatus(
      error.message
      || "Não foi possível ler o arquivo.",
      "error"
    );
  }
}


function resetImport() {
  scheduleState.file =
    null;

  scheduleState.fileType =
    null;

  scheduleState.parsedRows =
    [];

  scheduleState.detected =
    null;


  setPdfModeState(
    false
  );


  document
    .getElementById(
      "schedule-file"
    )
    .value =
      "";

  document
    .getElementById(
      "file-name"
    )
    .textContent =
      "Selecione um cronograma";

  document
    .getElementById(
      "import-preview"
    )
    .classList
    .remove(
      "visible"
    );

  document
    .getElementById(
      "preview-body"
    )
    .innerHTML =
      "";

  document
    .getElementById(
      "preview-summary"
    )
    .textContent =
      "";

  const confirm =
    document.getElementById(
      "confirm-import"
    );

  if (confirm) {
    confirm.disabled =
      true;
  }

  setImportStatus(
    ""
  );
}

async function createImportRecord(mode) {
  const metadata = {
    file_type:
      scheduleState.fileType,
    parser:
      scheduleState.detected?.parser
      || null,
    detected:
      scheduleState.detected
      || null
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


async function insertAlreadyDoneRow(
  row,
  importRecord,
  mode
) {
  const {
    data:
      topic,

    error:
      insertError
  } =
    await scheduleSb
      .from(
        "study_topics"
      )
      .insert({
        user_id:
          scheduleState.user.id,

        import_id:
          importRecord.id,

        area:
          row.area
          || null,

        materia:
          row.materia
          || null,

        theme:
          row.theme,

        original_date:
          row.date
          || null,

        scheduled_date:
          mode === "dates"
            ? row.date
            : null,

        status:
          mode === "dates"
          && row.date
            ? "scheduled"
            : "deck"
      })
      .select()
      .single();


  if (insertError) {
    throw insertError;
  }


  const {
    error:
      doneError
  } =
    await scheduleSb
      .rpc(
        "mark_topic_already_done",
        {
          p_topic_id:
            topic.id,

          p_studied_on:
            row.studiedDate
            || null
        }
      );


  if (doneError) {
    throw doneError;
  }
}


async function confirmImport() {
  const mode =
    currentImportMode();

  const rows =
    scheduleState
      .parsedRows;


  if (
    !scheduleState.file
    || !rows.length
  ) {
    setImportStatus(
      "Selecione um arquivo primeiro.",
      "error"
    );

    return;
  }


  applyDuplicateFlags();


  const selectedRows =
    rows.filter(
      (row) =>
        row.include
        && !row.duplicate
    );


  const invalid =
    selectedRows.filter(
      (row) =>
        row.errors.length
        > 0
    );


  if (
    invalid.length
  ) {
    setImportStatus(
      "Há itens selecionados com problema. Corrija a prévia ou desmarque esses itens.",
      "error"
    );

    return;
  }


  if (
    !selectedRows.length
  ) {
    setImportStatus(
      "Nenhum item novo selecionado.",
      "error"
    );

    return;
  }


  const button =
    document.getElementById(
      "confirm-import"
    );

  button.disabled =
    true;

  setImportStatus(
    "Importando cronograma..."
  );


  let importRecord =
    null;


  try {
    importRecord =
      await createImportRecord(
        mode
      );


    const lessonRows =
      selectedRows.filter(
        (row) =>
          row.kind ===
          "lesson"
      );


    const eventRows =
      selectedRows.filter(
        (row) =>
          row.kind !==
          "lesson"
      );


    const regularLessons =
      lessonRows.filter(
        (row) =>
          !row.alreadyDone
      );


    const alreadyDoneRows =
      lessonRows.filter(
        (row) =>
          row.alreadyDone
      );


    const lessonPayload =
      regularLessons.map(
        (
          row,
          index
        ) => ({
          user_id:
            scheduleState.user.id,

          import_id:
            importRecord.id,

          area:
            row.area
            || null,

          materia:
            row.materia
            || null,

          theme:
            row.theme,

          original_date:
            row.date
            || null,

          scheduled_date:
            mode === "dates"
              ? row.date
              : null,

          deck_order:
            mode === "deck"
              ? index + 1
              : null,

          status:
            mode === "dates"
              ? "scheduled"
              : "deck"
        })
      );


    for (
      const chunk
      of chunkArray(
        lessonPayload,
        200
      )
    ) {
      if (!chunk.length) {
        continue;
      }


      const {
        error
      } =
        await scheduleSb
          .from(
            "study_topics"
          )
          .insert(
            chunk
          );


      if (error) {
        throw error;
      }
    }


    for (
      const row
      of alreadyDoneRows
    ) {
      await insertAlreadyDoneRow(
        row,
        importRecord,
        mode
      );
    }


    const eventPayload =
      eventRows.map(
        (row) => ({
          user_id:
            scheduleState.user.id,

          import_id:
            importRecord.id,

          title:
            row.theme,

          event_type:
            row.kind,

          event_date:
            row.date,

          area:
            row.area
            || null,

          materia:
            row.materia
            || null,

          source:
            scheduleState.file
              ?.name
            || null,

          source_page:
            row.sourcePage
            || null,

          confidence:
            row.confidence
            || "medium",

          metadata: {
            source_label:
              row.sourceLabel
              || null,

            parser:
              scheduleState
                .detected
                ?.parser
              || null
          }
        })
      );


    for (
      const chunk
      of chunkArray(
        eventPayload,
        200
      )
    ) {
      if (!chunk.length) {
        continue;
      }


      const {
        error
      } =
        await scheduleSb
          .from(
            "schedule_events"
          )
          .insert(
            chunk
          );


      if (error) {
        throw error;
      }
    }


    await updateImportRecord(
      importRecord.id,
      {
        status:
          "completed",

        row_count:
          selectedRows.length,

        metadata: {
          ...importRecord.metadata,

          imported_rows:
            selectedRows.length,

          imported_lessons:
            lessonRows.length,

          imported_events:
            eventRows.length,

          already_done_rows:
            alreadyDoneRows.length,

          skipped_existing:
            rows.filter(
              (row) =>
                row.duplicate
            ).length
        }
      }
    );


    const lessonCount =
      lessonRows.length;

    const eventCount =
      eventRows.length;


    resetImport();


    setImportStatus(
      `${lessonCount} aula${lessonCount === 1 ? "" : "s"} e ${eventCount} evento${eventCount === 1 ? "" : "s"} importado${lessonCount + eventCount === 1 ? "" : "s"} com sucesso.`,
      "success"
    );


    await loadTopics();

  } catch (error) {
    console.error(
      error
    );


    if (
      importRecord?.id
    ) {
      try {
        await updateImportRecord(
          importRecord.id,
          {
            status:
              "failed",

            error_message:
              error.message
              || "Erro desconhecido"
          }
        );

      } catch (
        secondaryError
      ) {
        console.error(
          secondaryError
        );
      }
    }


    setImportStatus(
      error.message
      || "Não foi possível importar o cronograma.",
      "error"
    );


    button.disabled =
      false;
  }
}


function renderScheduleEventCard(
  event
) {
  const meta =
    [
      event.area,
      event.materia
    ]
      .filter(
        Boolean
      )
      .join(
        " · "
      );


  return `
    <article
      class="schedule-event-card"
      data-schedule-event-id="${escapeScheduleHtml(
        event.id
      )}"
    >
      <h3>
        ${escapeScheduleHtml(
          event.title
        )}
      </h3>

      <span class="schedule-event-type">
        ${escapeScheduleHtml(
          scheduleKindLabel(
            event.event_type
          )
        )}
      </span>

      ${
        meta
          ? `
            <div class="topic-meta">
              ${escapeScheduleHtml(
                meta
              )}
            </div>
          `
          : ""
      }

      <div class="topic-actions">
        <button
          class="topic-action danger"
          type="button"
          data-delete-schedule-event="${escapeScheduleHtml(
            event.id
          )}"
        >
          Excluir
        </button>
      </div>
    </article>
  `;
}


function eventsOnDate(
  date
) {
  const iso =
    toISODateSchedule(
      date
    );

  return scheduleState.events
    .filter(
      (event) =>
        event.event_date
        === iso
    );
}


function todayScheduleISO() {
  return toISODateSchedule(
    new Date()
  );
}


function isTopicOverdue(
  topic
) {
  return (
    topic?.status ===
      "scheduled"
    && !topic?.completed_at
    && Boolean(
      topic?.scheduled_date
    )
    && topic.scheduled_date
      < todayScheduleISO()
  );
}


function setReorganizeStatus(
  text,
  type = ""
) {
  const element =
    document.getElementById(
      "reorganize-overdue-status"
    );

  if (!element) {
    return;
  }

  element.textContent =
    text;

  element.className =
    `manual-status ${type}`
      .trim();
}


function topicMeta(topic) {
  return [topic.area, topic.materia].filter(Boolean).join(" · ");
}


function renderTopicCard(
  topic,
  compact = false
) {
  const meta =
    topicMeta(
      topic
    );


  const startParams =
    new URLSearchParams({
      kind:
        "lesson",

      item_id:
        topic.id,

      title:
        topic.theme,

      date:
        topic.scheduled_date
        || ""
    });


  if (topic.area) {
    startParams.set(
      "area",
      topic.area
    );
  }


  if (topic.materia) {
    startParams.set(
      "materia",
      topic.materia
    );
  }


  const overflow =
    compact
      ? `
        <div class="topic-overflow-wrap">

          <button
            class="topic-overflow-trigger"
            type="button"
            data-topic-overflow-trigger="${escapeScheduleHtml(
              topic.id
            )}"
            aria-label="Mais opções"
            aria-expanded="false"
          >
            ⋯
          </button>

          <div
            class="topic-overflow-menu"
            data-topic-overflow="${escapeScheduleHtml(
              topic.id
            )}"
            hidden
          >

            <button
              type="button"
              data-complete-topic="${escapeScheduleHtml(
                topic.id
              )}"
            >
              Concluir
            </button>

            <button
              type="button"
              data-already-done-topic="${escapeScheduleHtml(
                topic.id
              )}"
            >
              Aula já feita
            </button>

            <button
              class="danger"
              type="button"
              data-remove-from-date="${escapeScheduleHtml(
                topic.id
              )}"
            >
              Remover para o deck
            </button>

          </div>

        </div>
      `
      : "";


  return `
    <article
      class="topic-card ${isTopicOverdue(topic) ? "is-overdue" : ""}"
      draggable="true"
      data-topic-id="${escapeScheduleHtml(topic.id)}"
    >

      ${overflow}

      <div class="topic-card-head">
        <h3>
          ${escapeScheduleHtml(topic.theme)}
        </h3>
      </div>

      ${
        meta
          ? `
            <div class="topic-meta">
              ${escapeScheduleHtml(meta)}
            </div>
          `
          : ""
      }

      ${
        isTopicOverdue(topic)
          ? '<span class="topic-overdue-label">Atrasada</span>'
          : ""
      }

      ${
        compact
          ? `
            <div class="topic-actions planner-primary-action">

              <a
                class="topic-action primary"
                href="ambientacao.html?${escapeScheduleHtml(
                  startParams.toString()
                )}"
              >
                Iniciar
              </a>

            </div>
          `
          : `
            <div class="topic-actions">

              <a
                class="topic-action primary"
                href="ambientacao.html?${escapeScheduleHtml(
                  startParams.toString()
                )}"
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

              <button
                class="topic-action danger"
                type="button"
                data-delete-topic="${escapeScheduleHtml(topic.id)}"
              >
                Excluir
              </button>

            </div>
          `
      }

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

  const overdue =
    scheduleState.topics
      .filter(
        isTopicOverdue
      )
      .length;

  const events =
    scheduleState.events.length;

  document.getElementById("summary-deck").textContent = deck;
  document.getElementById("summary-scheduled").textContent = scheduled;

  const overdueSummary =
    document.getElementById(
      "summary-overdue"
    );

  if (overdueSummary) {
    overdueSummary.textContent =
      overdue;
  }

  document.getElementById("summary-completed").textContent = completed;

  const eventSummary =
    document.getElementById("summary-events");

  if (eventSummary) {
    eventSummary.textContent = events;
  }
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
    const events = eventsOnDate(date);

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
            topics.length || events.length
              ? [
                  ...topics.map(
                    (topic) =>
                      renderTopicCard(
                        topic,
                        true
                      )
                  ),

                  ...events.map(
                    renderScheduleEventCard
                  )
                ].join("")
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

  const panel = document.getElementById("deck-panel");
  const count = document.getElementById("deck-count");
  const list = document.getElementById("deck-list");

  if (!panel || !count || !list) return;

  // O Deck só existe visualmente quando há aulas realmente sem data.
  // Isso acontece ao importar sem datas ou ao usar "Remover" no planejador.
  panel.hidden = deck.length === 0;

  if (!deck.length) {
    count.textContent = "0 temas";
    list.innerHTML = "";
    return;
  }

  count.textContent =
    `${deck.length} tema${deck.length === 1 ? "" : "s"}`;

  list.innerHTML =
    deck.map(renderDeckCard).join("");
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

  if (!date) {
    setManualStatus(
      "Escolha a data da aula.",
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
    "Aula adicionada ao cronograma.",
    "success"
  );

  await loadTopics();
}


const BASE_WEEKDAY_LABELS = { 1:"Seg", 2:"Ter", 3:"Qua", 4:"Qui", 5:"Sex", 6:"Sáb", 7:"Dom" };

function setBaseScheduleStatus(text, type = "") {
  const element = document.getElementById("base-schedule-status");
  if (!element) return;
  element.textContent = text;
  element.className = `manual-status ${type}`.trim();
}

async function loadSchedulePreferences() {
  const { data, error } = await scheduleSb
    .from("user_settings")
    .select("study_mode,theory_study_weekdays")
    .eq("user_id", scheduleState.user.id)
    .maybeSingle();

  if (error) console.warn("Não foi possível carregar preferências do cronograma:", error.message);

  scheduleState.studyMode = data?.study_mode === "dentistry" ? "dentistry" : "medicine";
  const configuredDays = Array.isArray(data?.theory_study_weekdays)
    ? data.theory_study_weekdays.map(Number).filter((day) => day >= 1 && day <= 7)
    : [];

  scheduleState.theoryStudyWeekdays = (configuredDays.length ? configuredDays : [1,3,5]).slice(0,3);
  window.LuriaStudyMode?.apply(scheduleState.studyMode);
  renderBaseSchedulePreview();
}

function currentBaseScheduleRows() {
  const data = window.LURIA_BASE_SCHEDULES || {};
  return data[scheduleState.studyMode] || data.medicine || [];
}

function currentBaseStudyDays() {
  const configured =
    Array.from(
      new Set(
        (
          scheduleState.theoryStudyWeekdays
          || []
        )
          .map(Number)
          .filter(
            (day) =>
              day >= 1
              && day <= 7
          )
      )
    )
      .sort(
        (a, b) =>
          a - b
      );

  if (!configured.length) {
    return [1, 3, 5];
  }

  if (configured.length <= 3) {
    return configured;
  }

  const preferred =
    [1, 3, 5]
      .filter(
        (day) =>
          configured.includes(day)
      );

  if (preferred.length === 3) {
    return preferred;
  }

  const indexes = [
    0,
    Math.floor(
      (configured.length - 1)
      / 2
    ),
    configured.length - 1
  ];

  return Array.from(
    new Set(
      indexes.map(
        (index) =>
          configured[index]
      )
    )
  ).slice(0, 3);
}

function renderBaseSchedulePreview() {
  const container = document.getElementById("base-schedule-deck");
  const count = document.getElementById("base-schedule-count");
  const daysLabel = document.getElementById("base-schedule-days-label");
  if (!container || !count) return;

  const rows = currentBaseScheduleRows();
  count.textContent = `${rows.length} aulas`;
  if (daysLabel) daysLabel.textContent = currentBaseStudyDays().map((day) => BASE_WEEKDAY_LABELS[day]).join(" · ");

  container.innerHTML = rows.map((row) => `
    <article class="base-schedule-card">
      <span>Aula ${Number(row.aula || 0)}</span>
      <strong>${escapeScheduleHtml(row.theme)}</strong>
      <small>${escapeScheduleHtml(row.area)}</small>
    </article>
  `).join("");
}

function isoWeekdayForBase(date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function baseEligibleDates(startDate, endDate) {
  const allowed = new Set(currentBaseStudyDays());
  const dates = [];
  let cursor = startOfDaySchedule(startDate);
  const end = startOfDaySchedule(endDate);

  while (cursor <= end) {
    if (allowed.has(isoWeekdayForBase(cursor))) dates.push(toISODateSchedule(cursor));
    cursor = addDaysSchedule(cursor, 1);
  }
  return dates;
}

function baseTopicKey(area, theme) {
  return normalizeSearchText(`${area || ""}|${theme || ""}`);
}

function spreadBaseRowsAcrossDates(rows, dates) {
  if (!rows.length || !dates.length) return [];
  return rows.map((row, index) => {
    const dateIndex = Math.min(dates.length - 1, Math.floor((index * dates.length) / rows.length));
    return { ...row, scheduled_date: dates[dateIndex] };
  });
}

function genericScheduleSleep(
  milliseconds
) {
  return new Promise(
    (resolve) =>
      window.setTimeout(
        resolve,
        milliseconds
      )
  );
}


async function createGenericTopicWithExistingRpc(
  row,
  index
) {
  const {
    error
  } =
    await scheduleSb.rpc(
      "create_study_topic",
      {
        p_area:
          row.area
          || null,

        p_materia:
          null,

        p_theme:
          row.theme,

        p_original_date:
          row.scheduled_date,

        p_scheduled_date:
          row.scheduled_date,

        p_import_id:
          null,

        p_deck_order:
          Number(
            row.aula
            || index + 1
          )
      }
    );

  if (error) {
    throw error;
  }
}


async function applyBaseSchedule() {
  scheduleState.user =
    scheduleState.user
    || window.docmapUser;

  if (!scheduleState.user) {
    setBaseScheduleStatus(
      "Sua sessão ainda não carregou. Atualize a página e tente novamente.",
      "error"
    );

    return;
  }


  const button =
    document.getElementById(
      "apply-base-schedule"
    );

  const endInput =
    document.getElementById(
      "base-schedule-end-date"
    );

  const endValue =
    endInput?.value
    || "";

  const today =
    todayScheduleISO();


  if (!endValue) {
    setBaseScheduleStatus(
      "Escolha a data limite antes de adicionar o cronograma.",
      "error"
    );

    endInput?.focus();

    return;
  }


  if (endValue < today) {
    setBaseScheduleStatus(
      "A data limite não pode ser anterior a hoje.",
      "error"
    );

    endInput?.focus();

    return;
  }


  try {
    await loadTopics();
  } catch (error) {
    console.warn(
      "Falha ao atualizar tópicos antes da inserção:",
      error
    );
  }


  const allRows =
    currentBaseScheduleRows();


  if (!allRows.length) {
    setBaseScheduleStatus(
      "A lista do cronograma genérico não foi carregada. Faça Ctrl + Shift + R e tente novamente.",
      "error"
    );

    return;
  }


  const existingKeys =
    new Set(
      scheduleState.topics
        .map(
          (topic) =>
            baseTopicKey(
              topic.area,
              topic.theme
            )
        )
    );


  const missingRows =
    allRows.filter(
      (row) =>
        !existingKeys.has(
          baseTopicKey(
            row.area,
            row.theme
          )
        )
    );


  if (!missingRows.length) {
    setBaseScheduleStatus(
      "Todas as aulas deste cronograma genérico já estão no seu cronograma.",
      "success"
    );

    return;
  }


  const endDate =
    parseISODateForLibrary(
      endValue
    );


  const eligibleDates =
    baseEligibleDates(
      new Date(),
      endDate
    );


  if (!eligibleDates.length) {
    setBaseScheduleStatus(
      "Não há dias de aula disponíveis até a data limite.",
      "error"
    );

    return;
  }


  const distributed =
    spreadBaseRowsAcrossDates(
      missingRows,
      eligibleDates
    );


  const modeLabel =
    scheduleState.studyMode
    === "dentistry"
      ? "Odontologia"
      : "Medicina";


  const studyDaysLabel =
    currentBaseStudyDays()
      .map(
        (day) =>
          BASE_WEEKDAY_LABELS[
            day
          ]
      )
      .join(", ");


  const confirmed =
    window.confirm(
      `Adicionar ${distributed.length} aula${distributed.length === 1 ? "" : "s"} do cronograma genérico de ${modeLabel}?\n\nDias de aula: ${studyDaysLabel}\nData limite: ${formatDateLabelSchedule(endValue)}`
    );


  if (!confirmed) {
    return;
  }


  if (button) {
    button.disabled =
      true;

    button.textContent =
      "Adicionando...";
  }


  let inserted =
    0;


  try {
    /*
      Usa SOMENTE create_study_topic,
      a mesma RPC usada pelo formulário manual.
    */
    for (
      let index = 0;
      index < distributed.length;
      index += 1
    ) {
      const row =
        distributed[index];


      setBaseScheduleStatus(
        `Adicionando aulas... ${inserted}/${distributed.length}`
      );


      try {
        await createGenericTopicWithExistingRpc(
          row,
          index
        );

        inserted += 1;

      } catch (error) {
        const lessonNumber =
          Number(
            row.aula
            || index + 1
          );

        throw new Error(
          `Falha na aula ${lessonNumber} — ${row.theme}: ${error.message || "erro do Supabase"}`
        );
      }


      if (
        inserted > 0
        && inserted % 20 === 0
      ) {
        await genericScheduleSleep(
          80
        );
      }
    }


    await loadTopics();


    setBaseScheduleStatus(
      `${inserted} aula${inserted === 1 ? "" : "s"} do cronograma genérico de ${modeLabel} adicionada${inserted === 1 ? "" : "s"} com sucesso.`,
      "success"
    );


    if (
      distributed[0]
        ?.scheduled_date
    ) {
      scheduleState.weekAnchor =
        parseISODateForLibrary(
          distributed[0]
            .scheduled_date
        );

      renderSchedule();
    }


    document
      .getElementById(
        "week-planner"
      )
      ?.scrollIntoView({
        behavior:
          "smooth",

        block:
          "start"
      });


  } catch (error) {
    console.error(
      "Erro ao adicionar cronograma genérico:",
      error
    );


    try {
      await loadTopics();
    } catch {}


    setBaseScheduleStatus(
      inserted > 0
        ? `${inserted} aula${inserted === 1 ? "" : "s"} foram adicionadas antes do erro. ${error.message}`
        : `Não foi possível adicionar o cronograma: ${error.message}`,
      "error"
    );


  } finally {
    if (button) {
      button.disabled =
        false;

      button.textContent =
        "Adicionar cronograma genérico";
    }
  }
}


window.applyLuriaGenericSchedule =
  async function applyLuriaGenericScheduleSafe() {
    try {
      await applyBaseSchedule();
    } catch (error) {
      console.error(
        "Falha não tratada no cronograma genérico:",
        error
      );

      setBaseScheduleStatus(
        `Erro interno ao adicionar cronograma: ${error.message || "erro desconhecido"}`,
        "error"
      );
    }
  };


function wireBaseSchedule() {
  const endInput =
    document.getElementById(
      "base-schedule-end-date"
    );

  if (endInput) {
    endInput.min =
      todayScheduleISO();

    if (!endInput.value) {
      endInput.value =
        toISODateSchedule(
          addDaysSchedule(
            new Date(),
            270
          )
        );
    }
  }


  window.addEventListener(
    "luria:study-mode",
    (event) => {
      scheduleState.studyMode =
        event.detail?.mode
        === "dentistry"
          ? "dentistry"
          : "medicine";

      renderBaseSchedulePreview();
    }
  );
}

function getActiveTopicsForLibrary() {
  /*
    A Biblioteca/Lista de temas mostra também
    conteúdos já concluídos.
  */
  return scheduleState.topics.slice();
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

  const dateFrom =
    scheduleState.themeDateFrom;

  const dateTo =
    scheduleState.themeDateTo;

  const completionFilter =
    scheduleState
      .themeCompletionFilter;

  return getActiveTopicsForLibrary()
    .filter((topic) => {
      if (
        areaFilter
        && topic.area !== areaFilter
      ) {
        return false;
      }

      if (
        dateFrom
        && (
          !topic.scheduled_date
          || topic.scheduled_date < dateFrom
        )
      ) {
        return false;
      }

      if (
        dateTo
        && (
          !topic.scheduled_date
          || topic.scheduled_date > dateTo
        )
      ) {
        return false;
      }

      if (
        completionFilter
        === "completed"
        && !topic.completed_at
      ) {
        return false;
      }


      if (
        completionFilter
        === "pending"
        && topic.completed_at
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


function visibleThemeIds() {
  return filteredLibraryTopics()
    .map(
      (topic) =>
        topic.id
    );
}


function updateThemeBulkToolbar() {
  const visibleIds =
    visibleThemeIds();


  const selectedVisible =
    visibleIds.filter(
      (id) =>
        scheduleState
          .selectedThemeIds
          .has(
            id
          )
    ).length;


  const selectedTopics =
    scheduleState.topics
      .filter(
        (topic) =>
          scheduleState
            .selectedThemeIds
            .has(
              topic.id
            )
      );


  const selectedCount =
    selectedTopics.length;


  const canMoveToDeck =
    selectedTopics.some(
      (topic) =>
        !topic.completed_at
        && Boolean(
          topic.scheduled_date
        )
    );


  const canMarkDone =
    selectedTopics.some(
      (topic) =>
        !topic.completed_at
        && Boolean(
          topic.scheduled_date
        )
    );


  const count =
    document.getElementById(
      "theme-selected-count"
    );


  const deleteButton =
    document.getElementById(
      "theme-delete-selected"
    );


  const doneButton =
    document.getElementById(
      "theme-done-selected"
    );


  const deckButton =
    document.getElementById(
      "theme-deck-selected"
    );


  const menuToggle =
    document.getElementById(
      "theme-bulk-menu-toggle"
    );


  const selectAll =
    document.getElementById(
      "theme-select-all"
    );


  if (count) {
    count.textContent =
      `${selectedCount} selecionada${selectedCount === 1 ? "" : "s"}`;
  }


  if (deleteButton) {
    deleteButton.disabled =
      selectedCount === 0;
  }


  if (doneButton) {
    doneButton.disabled =
      !canMarkDone;
  }


  if (deckButton) {
    deckButton.disabled =
      !canMoveToDeck;
  }


  if (menuToggle) {
    menuToggle.disabled =
      selectedCount === 0;

    if (
      selectedCount === 0
    ) {
      closeThemeBulkMenu();
    }
  }


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
}

function closeThemeBulkMenu() {
  const menu =
    document.getElementById(
      "theme-bulk-menu"
    );

  const toggle =
    document.getElementById(
      "theme-bulk-menu-toggle"
    );

  if (menu) {
    menu.hidden =
      true;
  }

  if (toggle) {
    toggle.setAttribute(
      "aria-expanded",
      "false"
    );
  }
}


function toggleThemeBulkMenu() {
  const menu =
    document.getElementById(
      "theme-bulk-menu"
    );

  const toggle =
    document.getElementById(
      "theme-bulk-menu-toggle"
    );

  if (
    !menu
    || !toggle
    || toggle.disabled
  ) {
    return;
  }

  const open =
    menu.hidden;

  menu.hidden =
    !open;

  toggle.setAttribute(
    "aria-expanded",
    open
      ? "true"
      : "false"
  );
}


async function returnSelectedThemesToDeck() {
  const eligible =
    scheduleState.topics
      .filter(
        (topic) =>
          scheduleState
            .selectedThemeIds
            .has(
              topic.id
            )
          && !topic.completed_at
          && Boolean(
            topic.scheduled_date
          )
      );

  if (!eligible.length) {
    window.alert(
      "Nenhuma das aulas selecionadas pode ser removida para o deck."
    );

    closeThemeBulkMenu();

    return;
  }


  const confirmed =
    window.confirm(
      `Remover ${eligible.length} aula${eligible.length === 1 ? "" : "s"} selecionada${eligible.length === 1 ? "" : "s"} das datas atuais e enviar para o Deck não programado?`
    );


  if (!confirmed) {
    return;
  }


  const button =
    document.getElementById(
      "theme-deck-selected"
    );


  if (button) {
    button.disabled =
      true;
  }


  const {
    error
  } =
    await scheduleSb
      .from(
        "study_topics"
      )
      .update({
        scheduled_date:
          null,

        status:
          "deck"
      })
      .in(
        "id",
        eligible.map(
          (topic) =>
            topic.id
        )
      );


  if (error) {
    console.error(
      error
    );

    window.alert(
      `Não foi possível remover as aulas para o deck: ${error.message}`
    );

    if (button) {
      button.disabled =
        false;
    }

    return;
  }


  scheduleState
    .selectedThemeIds
    .clear();


  closeThemeBulkMenu();

  await loadTopics();
}


async function markSelectedThemesAlreadyDone() {
  const ids = Array.from(scheduleState.selectedThemeIds);
  if (!ids.length) return;

  const selectedTopics = scheduleState.topics.filter((topic) => scheduleState.selectedThemeIds.has(topic.id));
  const withDate = selectedTopics.filter((topic) => Boolean(topic.scheduled_date));

  if (!withDate.length) {
    window.alert("As aulas selecionadas estão no deck e não possuem data no cronograma.");
    return;
  }

  const confirmed = window.confirm(`Marcar ${withDate.length} aula${withDate.length === 1 ? "" : "s"} como já feita${withDate.length === 1 ? "" : "s"} usando exatamente as datas em que estão agendadas no cronograma?`);
  if (!confirmed) return;

  const button = document.getElementById("theme-done-selected");
  if (button) button.disabled = true;

  try {
    const { data, error } = await scheduleSb.rpc("mark_topics_already_done_on_schedule", { p_topic_ids: ids });
    if (error) throw error;

    const marked = Number(data?.marked || 0);
    const skipped = Number(data?.skipped || 0);
    scheduleState.selectedThemeIds.clear();
    closeThemeBulkMenu();
    window.alert(`${marked} aula${marked === 1 ? "" : "s"} marcada${marked === 1 ? "" : "s"} como já feita${marked === 1 ? "" : "s"}.${skipped ? ` ${skipped} selecionada${skipped === 1 ? "" : "s"} não tinham data ou já estavam concluídas.` : ""}`);
    await loadTopics();
  } catch (error) {
    console.error(error);
    window.alert(`Não foi possível marcar as aulas: ${error.message}`);
  } finally {
    if (button) button.disabled = false;
  }
}

async function deleteSelectedThemes() {
  const ids =
    Array.from(
      scheduleState
        .selectedThemeIds
    );


  if (!ids.length) {
    return;
  }


  const confirmed =
    window.confirm(
      `Excluir ${ids.length} aula${ids.length === 1 ? "" : "s"} permanentemente do cronograma?`
    );


  if (!confirmed) {
    return;
  }


  const button =
    document.getElementById(
      "theme-delete-selected"
    );


  if (button) {
    button.disabled =
      true;
  }


  const {
    error
  } =
    await scheduleSb
      .from(
        "study_topics"
      )
      .delete()
      .in(
        "id",
        ids
      );


  if (button) {
    button.disabled =
      false;
  }


  if (error) {
    console.error(
      error
    );


    window.alert(
      `Não foi possível excluir as aulas selecionadas: ${error.message}`
    );


    return;
  }


  scheduleState
    .selectedThemeIds
    .clear();


  closeThemeBulkMenu();

  await loadTopics();
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

    updateThemeBulkToolbar();

    return;
  }

  container.innerHTML =
    topics.map((topic) => {
      const isCompleted =
        Boolean(
          topic.completed_at
        );

      const isDeck =
        !isCompleted
        && (
          topic.status === "deck"
          || !topic.scheduled_date
        );

      const dateLabel =
        isCompleted
          ? `Concluída · ${formatTopicDate(topic)}`
          : formatTopicDate(topic);

      return `
        <article class="theme-library-row with-selection ${isCompleted ? "completed" : ""}">

          <label
            class="theme-library-select"
            aria-label="Selecionar aula"
          >
            <input
              class="theme-library-select-check"
              type="checkbox"
              data-theme-select="${escapeScheduleHtml(
                topic.id
              )}"
              ${scheduleState.selectedThemeIds.has(topic.id) ? "checked" : ""}
            >
          </label>

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

          <div class="theme-library-date ${isDeck ? "deck" : ""} ${isCompleted ? "completed" : ""}">
            ${escapeScheduleHtml(
              dateLabel
            )}
          </div>

          <div class="theme-library-actions">

            ${
              isCompleted
                ? `
                  <span class="theme-library-completed-badge">
                    Concluída
                  </span>
                `
                : `
                  <button
                    class="theme-library-action"
                    type="button"
                    data-library-topic="${escapeScheduleHtml(topic.id)}"
                  >
                    ${isDeck ? "Ir para deck" : "Ver na semana"}
                  </button>

                  ${
                    isDeck
                      ? ""
                      : `
                        <button
                          class="theme-library-action to-deck"
                          type="button"
                          data-library-to-deck="${escapeScheduleHtml(topic.id)}"
                        >
                          Remover para o deck
                        </button>
                      `
                  }

                  <button
                    class="theme-library-action done"
                    type="button"
                    data-library-done="${escapeScheduleHtml(topic.id)}"
                  >
                    Já feita
                  </button>
                `
            }

          </div>
        </article>
      `;
    }).join("");

  container
    .querySelectorAll(
      "[data-theme-select]"
    )
    .forEach(
      (input) => {
        input.addEventListener(
          "change",
          () => {
            const id =
              input.dataset
                .themeSelect;


            if (input.checked) {
              scheduleState
                .selectedThemeIds
                .add(
                  id
                );

            } else {
              scheduleState
                .selectedThemeIds
                .delete(
                  id
                );
            }


            updateThemeBulkToolbar();
          }
        );
      }
    );


  updateThemeBulkToolbar();


  document
    .querySelectorAll("[data-library-topic]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        focusLibraryTopic(
          button.dataset.libraryTopic
        );
      });
    });


  document
    .querySelectorAll("[data-library-to-deck]")
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          const topicId =
            button.dataset
              .libraryToDeck;

          const topic =
            scheduleState
              .topics
              .find(
                (item) =>
                  item.id
                  === topicId
              );

          if (!topic) {
            return;
          }


          const confirmed =
            window.confirm(
              `Remover "${topic.theme}" da data atual e enviar para o Deck não programado?`
            );


          if (!confirmed) {
            return;
          }


          await returnTopicToDeck(
            topicId
          );
        }
      );
    });


  document
    .querySelectorAll("[data-library-done]")
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          openAlreadyDoneDialog(
            button.dataset
              .libraryDone
          );
        }
      );
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


function switchScheduleAddMode(
  mode
) {
  if (
    ![
      "automatic",
      "manual",
      "base"
    ].includes(
      mode
    )
  ) {
    mode =
      "automatic";
  }


  scheduleState.addMode =
    mode;


  document
    .querySelectorAll(
      "[data-schedule-add-mode]"
    )
    .forEach(
      (button) => {
        button.classList.toggle(
          "active",
          button.dataset
            .scheduleAddMode === mode
        );
      }
    );


  document
    .querySelectorAll(
      "[data-schedule-add-section]"
    )
    .forEach(
      (section) => {
        section.classList.toggle(
          "active",
          section.dataset
            .scheduleAddSection === mode
        );
      }
    );
}


function wireScheduleAddMode() {
  document
    .querySelectorAll(
      "[data-schedule-add-mode]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            switchScheduleAddMode(
              button.dataset
                .scheduleAddMode
            );
          }
        );
      }
    );
}


function wireManualTopicForm() {
  document
    .getElementById("manual-topic-form")
    ?.addEventListener(
      "submit",
      addManualTopic
    );
}


function wireThemeLibraryBulkActions() {
  document
    .getElementById(
      "theme-select-all"
    )
    ?.addEventListener(
      "change",
      (event) => {
        const ids =
          visibleThemeIds();


        for (
          const id
          of ids
        ) {
          if (
            event.target.checked
          ) {
            scheduleState
              .selectedThemeIds
              .add(
                id
              );

          } else {
            scheduleState
              .selectedThemeIds
              .delete(
                id
              );
          }
        }


        renderThemeLibrary();
      }
    );


  document
    .getElementById(
      "theme-bulk-menu-toggle"
    )
    ?.addEventListener(
      "click",
      (event) => {
        event.stopPropagation();

        toggleThemeBulkMenu();
      }
    );


  document
    .getElementById(
      "theme-deck-selected"
    )
    ?.addEventListener(
      "click",
      returnSelectedThemesToDeck
    );


  document
    .getElementById(
      "theme-done-selected"
    )
    ?.addEventListener(
      "click",
      markSelectedThemesAlreadyDone
    );


  document
    .getElementById(
      "theme-delete-selected"
    )
    ?.addEventListener(
      "click",
      deleteSelectedThemes
    );


  document.addEventListener(
    "click",
    (event) => {
      const wrap =
        document.querySelector(
          ".theme-bulk-menu-wrap"
        );

      if (
        wrap
        && !wrap.contains(
          event.target
        )
      ) {
        closeThemeBulkMenu();
      }
    }
  );


  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape"
      ) {
        closeThemeBulkMenu();
      }
    }
  );
}

function themeFiltersAreActive() {
  return Boolean(
    scheduleState.themeAreaFilter
    || scheduleState.themeDateFrom
    || scheduleState.themeDateTo
    || (
      scheduleState.themeCompletionFilter
      && scheduleState.themeCompletionFilter
        !== "all"
    )
  );
}


function updateThemeFilterButtonState() {
  const button =
    document.getElementById(
      "theme-filter-menu-toggle"
    );

  if (!button) {
    return;
  }

  const active =
    themeFiltersAreActive();

  button.classList.toggle(
    "has-active-filter",
    active
  );

  button.title =
    active
      ? "Filtros ativos"
      : "Filtros";
}


function closeThemeFilterMenu() {
  const menu =
    document.getElementById(
      "theme-filter-menu"
    );

  const toggle =
    document.getElementById(
      "theme-filter-menu-toggle"
    );

  if (menu) {
    menu.hidden =
      true;
  }

  if (toggle) {
    toggle.setAttribute(
      "aria-expanded",
      "false"
    );
  }
}


function toggleThemeFilterMenu() {
  const menu =
    document.getElementById(
      "theme-filter-menu"
    );

  const toggle =
    document.getElementById(
      "theme-filter-menu-toggle"
    );

  if (
    !menu
    || !toggle
  ) {
    return;
  }

  const opening =
    menu.hidden;

  menu.hidden =
    !opening;

  toggle.setAttribute(
    "aria-expanded",
    opening
      ? "true"
      : "false"
  );
}


function wireThemeLibraryFilters() {
  const search =
    document.getElementById(
      "theme-search"
    );

  const area =
    document.getElementById(
      "theme-area-filter"
    );

  const completion =
    document.getElementById(
      "theme-completion-filter"
    );

  const dateFrom =
    document.getElementById(
      "theme-date-from"
    );

  const dateTo =
    document.getElementById(
      "theme-date-to"
    );


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

      updateThemeFilterButtonState();
      renderThemeLibrary();
    }
  );


  completion?.addEventListener(
    "change",
    () => {
      scheduleState.themeCompletionFilter =
        completion.value
        || "all";

      updateThemeFilterButtonState();
      renderThemeLibrary();
    }
  );


  dateFrom?.addEventListener(
    "change",
    () => {
      scheduleState.themeDateFrom =
        dateFrom.value
        || "";

      updateThemeFilterButtonState();
      renderThemeLibrary();
    }
  );


  dateTo?.addEventListener(
    "change",
    () => {
      scheduleState.themeDateTo =
        dateTo.value
        || "";

      updateThemeFilterButtonState();
      renderThemeLibrary();
    }
  );


  document
    .getElementById(
      "theme-filter-menu-toggle"
    )
    ?.addEventListener(
      "click",
      (event) => {
        event.stopPropagation();

        toggleThemeFilterMenu();
      }
    );


  document
    .getElementById(
      "theme-filter-menu-close"
    )
    ?.addEventListener(
      "click",
      closeThemeFilterMenu
    );


  document
    .getElementById(
      "theme-filter-apply"
    )
    ?.addEventListener(
      "click",
      () => {
        closeThemeFilterMenu();
        renderThemeLibrary();
      }
    );


  document
    .getElementById(
      "theme-clear-date-filter"
    )
    ?.addEventListener(
      "click",
      () => {
        scheduleState.themeAreaFilter =
          "";

        scheduleState.themeCompletionFilter =
          "all";

        scheduleState.themeDateFrom =
          "";

        scheduleState.themeDateTo =
          "";


        if (area) {
          area.value =
            "";
        }

        if (completion) {
          completion.value =
            "all";
        }

        if (dateFrom) {
          dateFrom.value =
            "";
        }

        if (dateTo) {
          dateTo.value =
            "";
        }


        updateThemeFilterButtonState();
        renderThemeLibrary();
      }
    );


  document.addEventListener(
    "click",
    (event) => {
      const wrap =
        document.querySelector(
          ".theme-filter-menu-wrap"
        );

      if (
        wrap
        && !wrap.contains(
          event.target
        )
      ) {
        closeThemeFilterMenu();
      }
    }
  );


  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape"
      ) {
        closeThemeFilterMenu();
      }
    }
  );


  updateThemeFilterButtonState();
}


function renderSchedule() {
  renderSummary();
  renderPlanner();
  renderDeck();
  renderThemeLibrary();
  wireDynamicInteractions();
}


function closeTopicOverflowMenus(
  exceptId = null
) {
  document
    .querySelectorAll(
      "[data-topic-overflow]"
    )
    .forEach(
      (menu) => {
        const id =
          menu.dataset
            .topicOverflow;


        if (
          exceptId
          && id === exceptId
        ) {
          return;
        }


        menu.hidden =
          true;
      }
    );


  document
    .querySelectorAll(
      "[data-topic-overflow-trigger]"
    )
    .forEach(
      (button) => {
        const id =
          button.dataset
            .topicOverflowTrigger;


        if (
          exceptId
          && id === exceptId
        ) {
          return;
        }


        button.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    );
}


function wireDynamicInteractions() {

  document
    .querySelectorAll(
      "[data-topic-overflow-trigger]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          (event) => {
            event.preventDefault();
            event.stopPropagation();


            const id =
              button
                .dataset
                .topicOverflowTrigger;


            const menu =
              document.querySelector(
                `[data-topic-overflow="${CSS.escape(
                  id
                )}"]`
              );


            if (!menu) {
              return;
            }


            const willOpen =
              menu.hidden;


            closeTopicOverflowMenus();


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


  document
    .querySelectorAll(
      "[data-topic-overflow]"
    )
    .forEach(
      (menu) => {
        menu.addEventListener(
          "click",
          (event) =>
            event.stopPropagation()
        );
      }
    );


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


  document.querySelectorAll("[data-remove-from-date]").forEach((button) => {
    button.addEventListener("click", async () => {
      const topicId = button.dataset.removeFromDate;

      const topic = scheduleState.topics.find(
        (item) => item.id === topicId
      );

      if (!topic) return;

      const confirmed = window.confirm(
        `Remover "${topic.theme}" desta data e enviar para o Deck não programado?`
      );

      if (!confirmed) return;

      await returnTopicToDeck(topicId);
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

  document
    .querySelectorAll("[data-delete-schedule-event]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        await deleteScheduleEvent(
          button.dataset.deleteScheduleEvent
        );
      });
    });
}

async function loadTopics() {
  const [
    topicsResult,
    eventsResult
  ] = await Promise.all([
    scheduleSb
      .from("study_topics")
      .select("*")
      .order("created_at", { ascending: true }),

    scheduleSb
      .from("schedule_events")
      .select("*")
      .order("event_date", { ascending: true })
      .order("created_at", { ascending: true })
  ]);

  if (topicsResult.error) {
    console.error(topicsResult.error);
    setImportStatus(
      `Não foi possível carregar os temas: ${topicsResult.error.message}`,
      "error"
    );
    return;
  }

  if (eventsResult.error) {
    console.error(eventsResult.error);
    setImportStatus(
      `Não foi possível carregar os eventos: ${eventsResult.error.message}`,
      "error"
    );
    return;
  }

  scheduleState.topics =
    topicsResult.data
    || [];

  scheduleState.events =
    eventsResult.data
    || [];

  refreshExistingKeys();

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


async function deleteScheduleEvent(
  eventId
) {
  const event =
    scheduleState.events
      .find(
        (item) =>
          item.id
          === eventId
      );

  if (!event) {
    return;
  }


  const confirmed =
    window.confirm(
      `Excluir "${event.title}" do cronograma?`
    );


  if (!confirmed) {
    return;
  }


  const {
    error
  } =
    await scheduleSb
      .from(
        "schedule_events"
      )
      .delete()
      .eq(
        "id",
        eventId
      );


  if (error) {
    console.error(
      error
    );

    alert(
      `Não foi possível excluir: ${error.message}`
    );

    return;
  }


  await loadTopics();
}




function closeReorganizeOverdueDialog() {
  const dialog =
    document.getElementById(
      "reorganize-overdue-dialog"
    );


  if (!dialog) {
    return;
  }


  if (
    typeof dialog.close
      === "function"
  ) {
    dialog.close();

  } else {
    dialog.removeAttribute(
      "open"
    );
  }
}


async function openReorganizeOverdueDialog() {
  const overdue =
    scheduleState.topics
      .filter(
        isTopicOverdue
      );


  if (!overdue.length) {
    setReorganizeStatus(
      "Não há aulas atrasadas. Use “Reorganizar aulas adiantadas” se quiser puxar o conteúdo para frente.",
      "success"
    );

    return;
  }


  const endDate =
    document.getElementById(
      "reorganize-overdue-end-date"
    );


  const today =
    todayScheduleISO();


  if (endDate) {
    endDate.min =
      today;


    if (
      !endDate.value
      || endDate.value < today
    ) {
      endDate.value =
        toISODateSchedule(
          addDaysSchedule(
            new Date(),
            30
          )
        );
    }
  }


  const capacity =
    document.getElementById(
      "reorganize-overdue-capacity"
    );


  if (capacity) {
    capacity.textContent =
      "Carregando configuração...";
  }


  const {
    data,
    error
  } =
    await scheduleSb
      .from(
        "user_settings"
      )
      .select(
        "theory_study_weekdays,max_lessons_per_day"
      )
      .eq(
        "user_id",
        scheduleState.user.id
      )
      .maybeSingle();


  if (capacity) {
    const maxLessons =
      Number(
        data?.max_lessons_per_day
        || 1
      );


    const weekdays =
      Array.isArray(
        data?.theory_study_weekdays
      )
        ? data.theory_study_weekdays
            .map(Number)
            .filter(
              (day) =>
                BASE_WEEKDAY_LABELS[
                  day
                ]
            )
        : [];

    const daysLabel =
      weekdays.length
        ? weekdays
            .map(
              (day) =>
                BASE_WEEKDAY_LABELS[
                  day
                ]
            )
            .join(
              " · "
            )
        : "todos os dias";

    capacity.textContent =
      error
        ? `${overdue.length} aula${overdue.length === 1 ? "" : "s"} atrasada${overdue.length === 1 ? "" : "s"}.`
        : `${overdue.length} aula${overdue.length === 1 ? "" : "s"} atrasada${overdue.length === 1 ? "" : "s"} · dias: ${daysLabel} · máximo de ${maxLessons} aula${maxLessons === 1 ? "" : "s"} por dia.`;
  }


  const dialog =
    document.getElementById(
      "reorganize-overdue-dialog"
    );


  if (
    typeof dialog?.showModal
      === "function"
  ) {
    dialog.showModal();

  } else {
    dialog?.setAttribute(
      "open",
      ""
    );
  }
}


async function reorganizeOverdueLessons() {
  const overdue =
    scheduleState.topics
      .filter(
        isTopicOverdue
      );


  const endDate =
    document
      .getElementById(
        "reorganize-overdue-end-date"
      )
      ?.value
    || "";


  const today =
    todayScheduleISO();


  if (
    !endDate
    || endDate < today
  ) {
    setReorganizeStatus(
      "Escolha uma data final igual ou posterior a hoje.",
      "error"
    );

    return;
  }


  const button =
    document.getElementById(
      "confirm-reorganize-overdue"
    );


  if (button) {
    button.disabled =
      true;
  }


  setReorganizeStatus(
    "Reorganizando aulas atrasadas..."
  );


  const {
    data,
    error
  } =
    await scheduleSb.rpc(
      "reorganize_overdue_lessons_range",
      {
        p_end_date:
          endDate,

        p_start_date:
          today
      }
    );


  if (button) {
    button.disabled =
      false;
  }


  if (error) {
    console.error(
      error
    );

    setReorganizeStatus(
      `Não foi possível reorganizar: ${error.message}`,
      "error"
    );

    return;
  }


  closeReorganizeOverdueDialog();

  const moved =
    Number(
      data?.moved
      || 0
    );

  const remaining =
    Number(
      data?.remaining
      || 0
    );

  const maxLessons =
    Number(
      data?.max_lessons_per_day
      || 1
    );

  setReorganizeStatus(
    remaining > 0
      ? `${moved} aula${moved === 1 ? "" : "s"} atrasada${moved === 1 ? "" : "s"} reorganizada${moved === 1 ? "" : "s"}. ${remaining} não couberam até ${formatDateLabelSchedule(endDate)}.`
      : moved > 0
        ? `${moved} aula${moved === 1 ? "" : "s"} atrasada${moved === 1 ? "" : "s"} reorganizada${moved === 1 ? "" : "s"} até ${formatDateLabelSchedule(endDate)}. Limite diário: ${maxLessons}.`
        : "Não havia aulas atrasadas para mover.",
    remaining > 0
      ? "error"
      : "success"
  );

  await loadTopics();
}



async function reorganizeAdvancedLessons() {
  const button =
    document.getElementById(
      "reorganize-advanced"
    );

  const overdueCount =
    scheduleState.topics
      .filter(
        isTopicOverdue
      )
      .length;

  if (
    overdueCount > 0
  ) {
    setReorganizeStatus(
      `Existem ${overdueCount} aula${overdueCount === 1 ? "" : "s"} atrasada${overdueCount === 1 ? "" : "s"}. Reorganize as atrasadas antes de adiantar o cronograma.`,
      "error"
    );

    return;
  }

  const confirmed =
    window.confirm(
      "Adiantar o cronograma agora? O Luria compactará as aulas futuras para frente, usando no máximo 3 dias de aula por semana e respeitando o máximo diário configurado."
    );

  if (!confirmed) {
    return;
  }

  if (button) {
    button.disabled =
      true;
  }

  setReorganizeStatus(
    "Reorganizando aulas adiantadas..."
  );

  try {
    const {
      data,
      error
    } =
      await scheduleSb.rpc(
        "reorganize_advanced_lessons"
      );

    if (error) {
      throw error;
    }

    if (
      data?.blocked_by_overdue
    ) {
      setReorganizeStatus(
        `Existem ${Number(data?.overdue_count || 0)} aula(s) atrasada(s). Reorganize-as primeiro.`,
        "error"
      );

      return;
    }

    const moved =
      Number(
        data?.moved
        || 0
      );

    const daysPerWeek =
      Number(
        data?.days_per_week
        || 3
      );

    const maxPerDay =
      Number(
        data?.max_lessons_per_day
        || 1
      );

    setReorganizeStatus(
      moved > 0
        ? `${moved} aula${moved === 1 ? "" : "s"} futura${moved === 1 ? "" : "s"} reorganizada${moved === 1 ? "" : "s"} para frente. Máximo de ${daysPerWeek} dias de aula por semana e ${maxPerDay} aula${maxPerDay === 1 ? "" : "s"} por dia.`
        : "O cronograma futuro já está compacto dentro do limite de até 3 dias de aula por semana.",
      "success"
    );

    await loadTopics();

  } catch (error) {
    console.error(
      error
    );

    setReorganizeStatus(
      `Não foi possível reorganizar as aulas adiantadas: ${error.message}`,
      "error"
    );

  } finally {
    if (button) {
      button.disabled =
        false;
    }
  }
}


function wireOverdueOrganizer() {
  document
    .getElementById(
      "reorganize-overdue"
    )
    ?.addEventListener(
      "click",
      openReorganizeOverdueDialog
    );


  document
    .getElementById(
      "reorganize-advanced"
    )
    ?.addEventListener(
      "click",
      reorganizeAdvancedLessons
    );


  document
    .getElementById(
      "confirm-reorganize-overdue"
    )
    ?.addEventListener(
      "click",
      reorganizeOverdueLessons
    );


  [
    "close-reorganize-overdue",
    "cancel-reorganize-overdue"
  ].forEach(
    (id) => {
      document
        .getElementById(
          id
        )
        ?.addEventListener(
          "click",
          closeReorganizeOverdueDialog
        );
    }
  );
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
  wireScheduleAddMode();
  wireThemeLibraryFilters();
  wireThemeLibraryBulkActions();
  wireOverdueOrganizer();
  wireBaseSchedule();

  await loadSchedulePreferences();

  switchScheduleAddMode(
    "automatic"
  );

  document.addEventListener(
    "click",
    () =>
      closeTopicOverflowMenus()
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key ===
        "Escape"
      ) {
        closeTopicOverflowMenus();
      }
    }
  );

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
