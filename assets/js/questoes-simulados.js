const qsSb = window.supabaseClient;

const qsState = {
  user: null,
  file: null,
  sets: [],
  currentSet: null,

  selectedSetIds:
    new Set(),

  pageMode:
    "mine",

  addMode:
    "automatic",

  editingSetId:
    null,

  items: [],
  attempts: new Map(),

  /*
    Imagem escolhida para cada questão errada.
    key   = question_item.id
    value = image_path da galeria
  */
  imageSelections:
    new Map(),

  /*
    Galeria temporária com TODOS os recortes detectados.
    Pode haver mais de uma imagem por questão e não fazemos
    deduplicação automática de candidatos sobrepostos/ruins.
  */
  imageGallery:
    [],

  /*
    Questões erradas que o usuário decidiu NÃO enviar
    ao Caderno de Erros. Fica persistido localmente por simulado.
  */
  errorNotebookSkips:
    new Set(),

  /*
    Prints do gabarito/respostas são mantidos
    SOMENTE na memória do navegador.
    Nunca são enviados ao Supabase.
  */
  answerScreenshotFiles: [],
  answerScreenshotUrls: [],
  answerImportRows: []
};

const qsResolutionState = {
  currentIndex: 0,
  selectedById: new Map(),
  confirmedById: new Set(),
  highlighterEnabled: false,
  highlightColor: "yellow"
};

let AREA_OPTIONS =
  window.LuriaStudyMode
    ?.generalAreasFor(
      window.luriaStudyMode
      || "medicine"
    )
  || [
    "Clínica Médica",
    "Pediatria",
    "Ginecologia e Obstetrícia",
    "Cirurgia Geral",
    "Preventiva"
  ];


const qsPageParams =
  new URLSearchParams(
    window.location.search
  );


const linkedExamId =
  qsPageParams.get(
    "exam_id"
  );


const linkedExamTitle =
  qsPageParams.get(
    "exam_title"
  );


function qsIsUuid(
  value
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(
      String(
        value
        || ""
      )
    );
}


function applyExamContext() {
  if (
    !qsIsUuid(
      linkedExamId
    )
  ) {
    return;
  }


  const titleInput =
    document.getElementById(
      "qs-title"
    );


  if (
    titleInput
    && !titleInput.value
    && linkedExamTitle
  ) {
    titleInput.value =
      `Simulado - ${linkedExamTitle}`;
  }
}




function switchQsMode(
  mode
) {
  if (
    ![
      "mine",
      "add",
      "library"
    ].includes(
      mode
    )
  ) {
    mode =
      "mine";
  }


  qsState.pageMode =
    mode;


  document
    .querySelectorAll(
      "[data-qs-mode]"
    )
    .forEach(
      (button) => {
        button.classList.toggle(
          "active",
          button.dataset
            .qsMode === mode
        );
      }
    );


  document
    .querySelectorAll(
      "[data-qs-section]"
    )
    .forEach(
      (section) => {
        section.classList.toggle(
          "active",
          section.dataset
            .qsSection === mode
        );
      }
    );


  if (
    mode === "library"
  ) {
    renderSimulationLibrary();
  }


  if (
    mode !== "library"
  ) {
    qsState
      .selectedSetIds
      .clear();

    updateSetBulkToolbar();
  }
}


function switchQsAddMode(
  mode
) {
  const automaticAllowed =
    window.LuriaEntitlements?.enabled(
      "automatic_questions"
    ) === true;

  if (
    mode === "automatic"
    && !automaticAllowed
  ) {
    mode =
      "manual";
  }

  if (
    ![
      "automatic",
      "manual"
    ].includes(
      mode
    )
  ) {
    mode =
      automaticAllowed
        ? "automatic"
        : "manual";
  }


  qsState.addMode =
    mode;


  document
    .querySelectorAll(
      "[data-qs-add-mode]"
    )
    .forEach(
      (button) => {
        button.classList.toggle(
          "active",
          button.dataset
            .qsAddMode === mode
        );
      }
    );


  document
    .querySelectorAll(
      "[data-qs-add-section]"
    )
    .forEach(
      (section) => {
        section.classList.toggle(
          "active",
          section.dataset
            .qsAddSection === mode
        );
      }
    );
}


function setManualStatus(
  text,
  type = ""
) {
  const element =
    document.getElementById(
      "qs-manual-status"
    );


  if (!element) {
    return;
  }


  element.textContent =
    text;


  element.className =
    `qs-status ${type}`
      .trim();
}


function setEditStatus(
  text,
  type = ""
) {
  const element =
    document.getElementById(
      "qs-edit-status"
    );


  if (!element) {
    return;
  }


  element.textContent =
    text;


  element.className =
    `qs-status ${type}`
      .trim();
}


function closeSimulationLibraryMenus() {
  document
    .querySelectorAll(
      "[data-qs-library-menu]"
    )
    .forEach(
      (menu) => {
        menu.hidden =
          true;
      }
    );


  document
    .querySelectorAll(
      "[data-qs-library-menu-trigger]"
    )
    .forEach(
      (button) => {
        button.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    );
}


function qsEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setImportStatus(text, type = "") {
  const el = document.getElementById("qs-import-status");
  el.textContent = text;
  el.className = `qs-status ${type}`.trim();
}

function setAnswerStatus(text, type = "") {
  const el = document.getElementById("qs-answer-status");
  el.textContent = text;
  el.className = `qs-status ${type}`.trim();
}

function cleanFileTitle(name) {
  return String(name || "")
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeStorageName(name) {
  return String(name || "simulado.pdf")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_");
}

function accuracy(correct, total) {
  if (!total) return "—";
  return `${((correct / total) * 100).toFixed(1).replace(".", ",")}%`;
}

function areaOptionsHtml(selected = "") {
  return `
    <option value="">Selecione a área</option>
    ${AREA_OPTIONS.map((area) => `
      <option value="${qsEscape(area)}" ${area === selected ? "selected" : ""}>
        ${qsEscape(area)}
      </option>
    `).join("")}
  `;
}

function correctOptionHtml(selected = "") {
  return `
    <option value="">Resposta correta</option>
    ${["A","B","C","D","E"].map((letter) => `
      <option value="${letter}" ${letter === selected ? "selected" : ""}>
        ${letter}
      </option>
    `).join("")}
  `;
}

const QS_SOURCE_PROFILES = {
  general: {
    label: "Geral",
    headers: []
  },
  medcof: {
    label: "MEDCOF",
    headers: [
      /medcof\s*qbank/i,
      /prova gerada pelo medcof/i
    ]
  },
  aristo: {
    label: "Aristo",
    headers: [
      /^aristo$/i,
      /atividade:/i,
      /impresso em:/i
    ]
  },
  medway: {
    label: "Medway",
    headers: [
      /medway/i
    ]
  },
  "estrategia-med": {
    label: "Estratégia MED",
    headers: [
      /estrat[eé]gia\s*med/i
    ]
  },
  medcurso: {
    label: "Medcurso",
    headers: [
      /medcurso/i,
      /medgrupo/i
    ]
  },
  other: {
    label: "Outro",
    headers: []
  }
};

function currentExtractionSettings() {
  return {
    mode:
      document.getElementById("qs-extraction-mode")?.value
      || "detailed",
    source:
      document.getElementById("qs-source-profile")?.value
      || "general"
  };
}

function sourceProfileLabel(source) {
  return QS_SOURCE_PROFILES[source]?.label
    || QS_SOURCE_PROFILES.general.label;
}

function normalizeSourceSpecificLine(line, source) {
  const value = normalizeLine(line);

  if (!value) {
    return value;
  }

  if (
    ["aristo", "medway", "estrategia-med", "medcurso"]
      .includes(source)
  ) {
    const match =
      value.match(
        /^(?:quest[aã]o|questao|q)\s*(\d{1,3})\s*(?:[\)\.\-:]\s*)?(.*)$/i
      );

    if (match) {
      return `${match[1]}) ${match[2] || ""}`
        .trim();
    }
  }

  return value;
}

function isSourceSpecificHeaderLine(line, source) {
  const profile =
    QS_SOURCE_PROFILES[source]
    || QS_SOURCE_PROFILES.general;

  return profile.headers.some(
    (pattern) =>
      pattern.test(
        normalizeLine(line)
      )
  );
}

function questionSetConfidence(questions) {
  if (!questions?.length) {
    return -Infinity;
  }

  let score =
    questions.length * 100;

  for (const question of questions) {
    const alternatives =
      Object.keys(
        question.alternatives
        || {}
      ).length;

    score +=
      Math.min(
        alternatives,
        5
      ) * 4;

    if (question.stem) {
      score += 4;
    }

    if (
      question.raw_text
      && question.raw_text.length > 80
    ) {
      score += 2;
    }
  }

  return score;
}

function normalizeLine(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function groupTextItemsIntoLines(items) {
  const rows = [];

  for (const item of items) {
    const text = normalizeLine(item.str);
    if (!text) continue;

    const x = Number(item.transform?.[4] || 0);
    const y = Number(item.transform?.[5] || 0);

    let row = rows.find(
      (candidate) => Math.abs(candidate.y - y) <= 2.5
    );

    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }

    row.items.push({ x, text });
  }

  rows.sort((a, b) => b.y - a.y);

  return rows
    .map((row) => {
      row.items.sort((a, b) => a.x - b.x);

      return normalizeLine(
        row.items.map((item) => item.text).join(" ")
      );
    })
    .filter(Boolean);
}


function groupTextItemsIntoLineRecords(
  items,
  viewport
) {
  const rows =
    [];


  for (
    const item
    of items
  ) {
    const text =
      normalizeLine(
        item.str
      );


    if (!text) {
      continue;
    }


    const transform =
      window.pdfjsLib
        .Util
        .transform(
          viewport.transform,
          item.transform
        );


    const x =
      Number(
        transform[4]
        || 0
      );


    const baselineY =
      Number(
        transform[5]
        || 0
      );


    const fontHeight =
      Math.max(
        5,
        Math.hypot(
          Number(
            transform[2]
            || 0
          ),
          Number(
            transform[3]
            || 0
          )
        )
      );


    const width =
      Math.max(
        1,
        Number(
          item.width
          || 0
        )
        * Number(
            viewport.scale
            || 1
          )
      );


    const top =
      baselineY
      - fontHeight
      * 0.88;


    const bottom =
      baselineY
      + fontHeight
      * 0.20;


    let row =
      rows.find(
        candidate =>
          Math.abs(
            candidate.baselineY
            - baselineY
          )
          <= Math.max(
              3,
              Math.min(
                candidate.fontHeight,
                fontHeight
              ) * 0.42
            )
      );


    if (!row) {
      row = {
        baselineY,
        fontHeight,
        items:
          []
      };


      rows.push(
        row
      );
    }


    row.items.push({
      x,
      right:
        x + width,
      top,
      bottom,
      text,
      fontHeight
    });


    row.baselineY =
      row.items.reduce(
        (
          sum,
          current
        ) =>
          sum
          + (
              current.top
              + current.bottom
            ) / 2,
        0
      )
      / row.items.length;


    row.fontHeight =
      Math.max(
        row.fontHeight,
        fontHeight
      );
  }


  return rows
    .map(
      row => {
        row.items.sort(
          (
            a,
            b
          ) =>
            a.x - b.x
        );


        return {
          text:
            normalizeLine(
              row.items
                .map(
                  item =>
                    item.text
                )
                .join(
                  " "
                )
            ),

          left:
            Math.min(
              ...row.items.map(
                item =>
                  item.x
              )
            ),

          right:
            Math.max(
              ...row.items.map(
                item =>
                  item.right
              )
            ),

          top:
            Math.min(
              ...row.items.map(
                item =>
                  item.top
              )
            ),

          bottom:
            Math.max(
              ...row.items.map(
                item =>
                  item.bottom
              )
            ),

          fontHeight:
            row.fontHeight
        };
      }
    )
    .filter(
      row =>
        row.text
    )
    .sort(
      (
        a,
        b
      ) =>
        a.top - b.top
        ||
        a.left - b.left
    );
}

function isPdfHeaderLine(line) {
  const normalized =
    normalizeLine(line)
      .toLowerCase();

  if (!normalized) {
    return true;
  }

  return (
    normalized === "aristo"
    || (
      normalized.includes("atividade:")
      && normalized.includes("impresso em:")
    )
    || normalized.includes(
      "prova gerada pelo medcof qbank"
    )
    || (
      normalized.includes("| página ")
      && normalized.includes(" de ")
    )
    || /^página\s+\d+\s+de\s+\d+$/i.test(
      normalized
    )
  );
}


function isAnswerKeyStart(line) {
  const normalized =
    normalizeLine(line)
      .toUpperCase();

  return (
    normalized === "GABARITO"
    || normalized.startsWith(
      "GABARITO "
    )
  );
}


function questionStartMatch(line) {
  return normalizeLine(line).match(
    /^(\d{1,3})\s*[\.\)]\s*(?:\[([^\]]+)\])?\s*(.*)$/
  );
}


function alternativeStartMatch(
  line
) {
  const value =
    normalizeLine(
      line
    );


  const atStart =
    value.match(
      /^([A-E])\s*[\)\.\-:]\s*(.*)$/i
    );


  if (
    atStart
  ) {
    return atStart;
  }


  /*
    Alguns PDFs (como o MedCof enviado para teste) retornam
    visualmente "A) texto", mas a ordem interna do texto vem
    como "texto A)". Tratamos os dois formatos.
  */
  const atEnd =
    value.match(
      /^(.*?)\s+([A-E])\s*[\)\.\-:]\s*$/i
    );


  if (
    atEnd
  ) {
    return [
      atEnd[0],
      atEnd[2],
      atEnd[1]
    ];
  }


  return null;
}


function parseQuestionBlock(
  lines,
  orderIndex,
  defaultSourceLabel = null
) {
  const first =
    normalizeLine(
      lines[0] || ""
    );

  const match =
    questionStartMatch(first);

  if (!match) {
    return null;
  }

  const number =
    Number(match[1]);

  const sourceLabel =
    (match[2] || "").trim()
    || defaultSourceLabel
    || null;

  const firstStem =
    (match[3] || "").trim();

  const contentLines = [
    firstStem,
    ...lines.slice(1)
  ]
    .map(normalizeLine)
    .filter(Boolean);

  const stemLines = [];
  const alternatives = {};

  let currentAlternative =
    null;

  for (const line of contentLines) {
    const alternativeMatch =
      alternativeStartMatch(line);

    if (alternativeMatch) {
      currentAlternative =
        alternativeMatch[1]
          .toUpperCase();

      alternatives[
        currentAlternative
      ] =
        (
          alternativeMatch[2]
          || ""
        ).trim();

      continue;
    }

    if (currentAlternative) {
      alternatives[
        currentAlternative
      ] =
        normalizeLine(
          `${
            alternatives[
              currentAlternative
            ] || ""
          } ${line}`
        );

      continue;
    }

    stemLines.push(line);
  }

  const rawText = [
    `${number}) ${
      sourceLabel
        ? `[${sourceLabel}] `
        : ""
    }${firstStem}`.trim(),
    ...lines.slice(1)
      .map(normalizeLine)
      .filter(Boolean)
  ]
    .join("\n")
    .trim();

  return {
    question_number: number,
    order_index: orderIndex,
    source_label: sourceLabel,
    stem:
      stemLines
        .join(" ")
        .trim()
      || null,
    alternatives,
    raw_text: rawText
  };
}


function extractQuestionBlocks(
  allLines
) {
  const blocks = [];

  let current =
    null;

  for (const rawLine of allLines) {
    const line =
      normalizeLine(rawLine);

    if (!line) {
      continue;
    }

    /*
      A partir de GABARITO, não anexamos mais
      conteúdo à última questão.
    */
    if (
      isAnswerKeyStart(line)
    ) {
      if (
        current?.lines?.length
      ) {
        blocks.push(
          current
        );
      }

      current =
        null;

      break;
    }

    const startMatch =
      questionStartMatch(line);

    if (startMatch) {
      if (
        current?.lines?.length
      ) {
        blocks.push(
          current
        );
      }

      current = {
        number:
          Number(
            startMatch[1]
          ),
        lines: [
          line
        ]
      };

      continue;
    }

    if (current) {
      current.lines.push(
        line
      );
    }
  }

  if (
    current?.lines?.length
  ) {
    blocks.push(
      current
    );
  }

  return blocks;
}


function extractMedCofAnswerKey(
  allLines
) {
  const answerKey = {};

  const startIndex =
    allLines.findIndex(
      (line) =>
        isAnswerKeyStart(
          line
        )
    );

  if (startIndex < 0) {
    return answerKey;
  }

  const answerText =
    allLines
      .slice(
        startIndex + 1
      )
      .join(" ");

  const regex =
    /(\d{1,3})\s*\)\s*([A-E]|X)\b/gi;

  let match;

  while (
    (
      match =
        regex.exec(
          answerText
        )
    )
  ) {
    answerKey[
      Number(match[1])
    ] =
      match[2]
        .toUpperCase();
  }

  return answerKey;
}


function questionsFromBlocks(
  blocks,
  defaultSourceLabel
) {
  return blocks
    .map(
      (block, index) =>
        parseQuestionBlock(
          block.lines,
          index + 1,
          defaultSourceLabel
        )
    )
    .filter(Boolean);
}


function buildLooseTextLines(
  pagesText
) {
  /*
    Fallback para PDFs em que a coordenada Y
    vem fragmentada e o agrupamento visual por
    linha não funciona bem.

    Junta o texto da página e cria quebras antes
    de números de questão e alternativas.
  */
  const combined =
    pagesText
      .join("\n")
      .replace(
        /(\d{1,3})\s*\)/g,
        "\n$1)"
      )
      .replace(
        /\s+([A-E])\s*\)/g,
        "\n$1)"
      )
      .replace(
        /\s+(GABARITO)\b/gi,
        "\n$1\n"
      );

  return combined
    .split(/\n+/)
    .map(normalizeLine)
    .filter(Boolean);
}


function multiplyPdfMatrices(left, right) {
  const [
    a1, b1, c1,
    d1, e1, f1
  ] = left;

  const [
    a2, b2, c2,
    d2, e2, f2
  ] = right;

  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1
  ];
}


function applyPdfMatrix(
  matrix,
  x,
  y
) {
  return [
    matrix[0] * x
      + matrix[2] * y
      + matrix[4],

    matrix[1] * x
      + matrix[3] * y
      + matrix[5]
  ];
}


function imageRectFromCtm(
  ctm,
  viewport
) {
  const corners = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1]
  ]
    .map(
      ([x, y]) =>
        applyPdfMatrix(
          ctm,
          x,
          y
        )
    )
    .map(
      (point) =>
        window.pdfjsLib
          .Util
          .applyTransform(
            point,
            viewport.transform
          )
    );

  const xs =
    corners.map(
      (point) =>
        point[0]
    );

  const ys =
    corners.map(
      (point) =>
        point[1]
    );

  const left =
    Math.min(...xs);

  const right =
    Math.max(...xs);

  const top =
    Math.min(...ys);

  const bottom =
    Math.max(...ys);

  return {
    left,
    top,
    right,
    bottom,
    width:
      Math.max(
        0,
        right - left
      ),
    height:
      Math.max(
        0,
        bottom - top
      )
  };
}


function isUsefulQuestionImageRect(
  rect,
  viewport,
  relaxed = false
) {
  if (
    !rect
  ) {
    return false;
  }


  const minWidth =
    relaxed
      ? 48
      : 110;

  const minHeight =
    relaxed
      ? 24
      : 45;

  const minArea =
    relaxed
      ? 2200
      : 12000;


  if (
    rect.width < minWidth
    || rect.height < minHeight
    || rect.width * rect.height < minArea
  ) {
    return false;
  }


  /*
    Em modo relaxado, não descartamos imagens próximas
    do topo/rodapé tão agressivamente. Alguns bancos de
    questões posicionam figuras bem perto dessas áreas.
  */
  if (
    !relaxed
    &&
    (
      rect.top
        < viewport.height * 0.025
      ||
      rect.bottom
        > viewport.height * 0.92
    )
  ) {
    return false;
  }


  /*
    Continua ignorando fundos/páginas inteiras.
  */
  if (
    rect.width
      > viewport.width * 0.94
    &&
    rect.height
      > viewport.height * 0.84
  ) {
    return false;
  }


  return true;
}


async function extractEmbeddedImageRects(
  page,
  viewport,
  relaxed = false
) {
  const operatorList =
    await page
      .getOperatorList();

  const OPS =
    window.pdfjsLib.OPS;

  const stack =
    [];

  let ctm =
    [
      1,
      0,
      0,
      1,
      0,
      0
    ];

  const rects =
    [];


  for (
    let index = 0;
    index < operatorList.fnArray.length;
    index += 1
  ) {
    const fn =
      operatorList.fnArray[
        index
      ];

    const args =
      operatorList.argsArray[
        index
      ]
      || [];


    if (
      fn === OPS.save
    ) {
      stack.push(
        ctm.slice()
      );

      continue;
    }


    if (
      fn === OPS.restore
    ) {
      ctm =
        stack.length
          ? stack.pop()
          : [
              1,
              0,
              0,
              1,
              0,
              0
            ];

      continue;
    }


    if (
      fn === OPS.transform
    ) {
      ctm =
        multiplyPdfMatrices(
          ctm,
          args
        );

      continue;
    }


    const imageOps =
      [
        OPS.paintImageXObject,
        OPS.paintInlineImageXObject,
        OPS.paintJpegXObject,
        OPS.paintInlineImageXObjectGroup,
        OPS.paintImageXObjectRepeat,
        OPS.paintImageMaskXObject,
        OPS.paintImageMaskXObjectGroup,
        OPS.paintImageMaskXObjectRepeat
      ]
        .filter(
          Number.isFinite
        );


    if (
      !imageOps.includes(
        fn
      )
    ) {
      continue;
    }


    const rect =
      imageRectFromCtm(
        ctm,
        viewport
      );


    const intrinsicWidth =
      Number(
        args?.[1]
        || args?.[0]?.width
        || 0
      );


    const intrinsicHeight =
      Number(
        args?.[2]
        || args?.[0]?.height
        || 0
      );


    /*
      Logos/marcas d'água deste tipo de PDF costumam ser
      imagens pequenas (ex.: ~150x53) ampliadas na página.
      Não devem virar "imagem da questão".
    */
    const obviousSmallLogo =
      intrinsicWidth > 0
      &&
      intrinsicHeight > 0
      &&
      intrinsicWidth <= 190
      &&
      intrinsicHeight <= 90;


    if (
      obviousSmallLogo
    ) {
      continue;
    }


    if (
      isUsefulQuestionImageRect(
        rect,
        viewport,
        relaxed
      )
    ) {
      rects.push({
        ...rect,

        intrinsicWidth,
        intrinsicHeight
      });
    }
  }


  return rects.filter(
    (
      rect,
      index
    ) =>
      !rects
        .slice(
          0,
          index
        )
        .some(
          previous =>
            Math.abs(
              previous.left
              - rect.left
            ) < 3
            &&
            Math.abs(
              previous.top
              - rect.top
            ) < 3
            &&
            Math.abs(
              previous.width
              - rect.width
            ) < 5
            &&
            Math.abs(
              previous.height
              - rect.height
            ) < 5
        )
  );
}


function questionStartsForPage(
  lineRecords
) {
  const answerKeyIndex =
    lineRecords.findIndex(
      (line) =>
        isAnswerKeyStart(
          line.text
        )
    );

  if (
    answerKeyIndex >= 0
  ) {
    return [];
  }

  return lineRecords
    .map(
      (line) => {
        const match =
          questionStartMatch(
            line.text
          );

        if (!match) {
          return null;
        }

        return {
          number:
            Number(
              match[1]
            ),
          top:
            line.top,
          bottom:
            line.bottom
        };
      }
    )
    .filter(Boolean)
    .sort(
      (a, b) =>
        a.top - b.top
    );
}


function matchImageRectToQuestion(
  rect,
  questionStarts
) {
  if (
    !questionStarts.length
  ) {
    return null;
  }

  const centerY =
    rect.top
    + rect.height / 2;

  let matched =
    null;

  for (
    let index = 0;
    index < questionStarts.length;
    index += 1
  ) {
    const current =
      questionStarts[index];

    const next =
      questionStarts[
        index + 1
      ];

    const startY =
      current.top - 8;

    const endY =
      next
        ? next.top - 4
        : Number.POSITIVE_INFINITY;

    if (
      centerY >= startY
      && centerY < endY
    ) {
      matched =
        current.number;

      break;
    }
  }

  return matched;
}


function canvasToPngBlob(
  canvas
) {
  return new Promise(
    (resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(
              new Error(
                "Não foi possível gerar o recorte PNG."
              )
            );

            return;
          }

          resolve(blob);
        },
        "image/png",
        0.96
      );
    }
  );
}


async function questionImageRectUnion(
  first,
  second
) {
  const left =
    Math.min(
      first.left,
      second.left
    );

  const top =
    Math.min(
      first.top,
      second.top
    );

  const right =
    Math.max(
      first.right,
      second.right
    );

  const bottom =
    Math.max(
      first.bottom,
      second.bottom
    );

  return {
    left,
    top,
    right,
    bottom,
    width:
      Math.max(
        1,
        right - left
      ),
    height:
      Math.max(
        1,
        bottom - top
      )
  };
}


function questionImageRectOverlap(
  first,
  second
) {
  const left =
    Math.max(
      first.left,
      second.left
    );

  const top =
    Math.max(
      first.top,
      second.top
    );

  const right =
    Math.min(
      first.right,
      second.right
    );

  const bottom =
    Math.min(
      first.bottom,
      second.bottom
    );

  const width =
    Math.max(
      0,
      right - left
    );

  const height =
    Math.max(
      0,
      bottom - top
    );

  return {
    width,
    height,
    area:
      width * height
  };
}


function shouldMergeQuestionImageRects(
  first,
  second,
  viewport
) {
  const overlap =
    questionImageRectOverlap(
      first,
      second
    );

  if (
    overlap.area > 0
  ) {
    return true;
  }


  const horizontalOverlap =
    Math.max(
      0,
      Math.min(
        first.right,
        second.right
      )
      -
      Math.max(
        first.left,
        second.left
      )
    );


  const verticalOverlap =
    Math.max(
      0,
      Math.min(
        first.bottom,
        second.bottom
      )
      -
      Math.max(
        first.top,
        second.top
      )
    );


  const horizontalOverlapRatio =
    horizontalOverlap
    /
    Math.max(
      1,
      Math.min(
        first.width,
        second.width
      )
    );


  const verticalOverlapRatio =
    verticalOverlap
    /
    Math.max(
      1,
      Math.min(
        first.height,
        second.height
      )
    );


  const verticalGap =
    Math.max(
      0,
      Math.max(
        first.top,
        second.top
      )
      -
      Math.min(
        first.bottom,
        second.bottom
      )
    );


  const horizontalGap =
    Math.max(
      0,
      Math.max(
        first.left,
        second.left
      )
      -
      Math.min(
        first.right,
        second.right
      )
    );


  const nearGap =
    Math.max(
      12,
      viewport.width * 0.012
    );


  if (
    verticalGap <= nearGap
    &&
    horizontalOverlapRatio >= 0.38
  ) {
    return true;
  }


  if (
    horizontalGap <= nearGap
    &&
    verticalOverlapRatio >= 0.55
  ) {
    return true;
  }


  return false;
}


function scaleQuestionImageRect(
  rect,
  factor
) {
  return {
    left:
      rect.left * factor,

    top:
      rect.top * factor,

    right:
      rect.right * factor,

    bottom:
      rect.bottom * factor,

    width:
      rect.width * factor,

    height:
      rect.height * factor
  };
}


function groupQuestionImageRects(
  entries,
  viewport
) {
  const groups =
    [];


  for (
    const entry
    of entries
  ) {
    let target =
      groups.find(
        group =>
          group.question_number
            === entry.question_number
          &&
          shouldMergeQuestionImageRects(
            group.rect,
            entry.rect,
            viewport
          )
      );


    if (
      !target
    ) {
      target = {
        question_number:
          entry.question_number,

        rect:
          {
            ...entry.rect
          }
      };


      groups.push(
        target
      );


    } else {
      target.rect =
        questionImageRectUnion(
          target.rect,
          entry.rect
        );
    }


    let merged =
      true;


    while (
      merged
    ) {
      merged =
        false;


      for (
        let index = groups.length - 1;
        index >= 0;
        index -= 1
      ) {
        const other =
          groups[index];


        if (
          other === target
          ||
          other.question_number
            !== target.question_number
        ) {
          continue;
        }


        if (
          shouldMergeQuestionImageRects(
            target.rect,
            other.rect,
            viewport
          )
        ) {
          target.rect =
            questionImageRectUnion(
              target.rect,
              other.rect
            );


          groups.splice(
            index,
            1
          );


          merged =
            true;
        }
      }
    }
  }


  return groups.sort(
    (
      a,
      b
    ) =>
      a.question_number
      - b.question_number
      ||
      a.rect.top
      - b.rect.top
      ||
      a.rect.left
      - b.rect.left
  );
}


function safeQuestionImageCropRect(
  rect,
  lineRecords,
  viewport
) {
  const padding =
    Math.max(
      3,
      Math.round(
        viewport.scale * 1.5
      )
    );


  let left =
    Math.max(
      0,
      rect.left - padding
    );

  let top =
    Math.max(
      0,
      rect.top - padding
    );

  let right =
    Math.min(
      viewport.width,
      rect.right + padding
    );

  let bottom =
    Math.min(
      viewport.height,
      rect.bottom + padding
    );


  for (
    const line
    of lineRecords
  ) {
    const horizontalOverlap =
      Math.max(
        0,
        Math.min(
          right,
          line.right
        )
        -
        Math.max(
          left,
          line.left
        )
      );


    if (
      horizontalOverlap
      <
      Math.min(
        right - left,
        line.right - line.left
      ) * 0.18
    ) {
      continue;
    }


    if (
      line.bottom <= rect.top
      &&
      rect.top - line.bottom
        <= padding * 2.5
    ) {
      top =
        Math.max(
          top,
          line.bottom + 1
        );
    }


    if (
      line.top >= rect.bottom
      &&
      line.top - rect.bottom
        <= padding * 2.5
    ) {
      bottom =
        Math.min(
          bottom,
          line.top - 1
        );
    }
  }


  return {
    left,
    top,
    right,
    bottom,
    width:
      Math.max(
        1,
        right - left
      ),
    height:
      Math.max(
        1,
        bottom - top
      )
  };
}


function cropRenderedPage(
  pageCanvas,
  rect
) {
  const left =
    Math.max(
      0,
      Math.floor(
        rect.left
      )
    );

  const top =
    Math.max(
      0,
      Math.floor(
        rect.top
      )
    );

  const right =
    Math.min(
      pageCanvas.width,
      Math.ceil(
        rect.right
      )
    );

  const bottom =
    Math.min(
      pageCanvas.height,
      Math.ceil(
        rect.bottom
      )
    );

  const width =
    Math.max(
      1,
      right - left
    );

  const height =
    Math.max(
      1,
      bottom - top
    );

  const crop =
    document.createElement(
      "canvas"
    );

  crop.width =
    width;

  crop.height =
    height;

  const context =
    crop.getContext(
      "2d",
      {
        alpha:
          false
      }
    );

  context.fillStyle =
    "#ffffff";

  context.fillRect(
    0,
    0,
    width,
    height
  );

  context.imageSmoothingEnabled =
    true;

  context.imageSmoothingQuality =
    "high";

  context.drawImage(
    pageCanvas,
    left,
    top,
    width,
    height,
    0,
    0,
    width,
    height
  );

  return canvasToPngBlob(
    crop
  );
}


async function mergeQuestionImageBlobs(
  blobs
) {
  if (
    blobs.length === 1
  ) {
    return blobs[0];
  }

  const images = [];

  for (const blob of blobs) {
    const bitmap =
      await createImageBitmap(
        blob
      );

    images.push(
      bitmap
    );
  }

  const gap =
    12;

  const width =
    Math.max(
      ...images.map(
        (image) =>
          image.width
      )
    );

  const height =
    images.reduce(
      (
        total,
        image
      ) =>
        total
        + image.height,
      0
    )
    + gap
      * (
        images.length
        - 1
      );

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    width;

  canvas.height =
    height;

  const context =
    canvas.getContext(
      "2d",
      {
        alpha: false
      }
    );

  context.fillStyle =
    "#ffffff";

  context.fillRect(
    0,
    0,
    width,
    height
  );

  let y = 0;

  for (const image of images) {
    const x =
      Math.floor(
        (width - image.width)
        / 2
      );

    context.drawImage(
      image,
      x,
      y
    );

    y +=
      image.height
      + gap;

    image.close?.();
  }

  return canvasToPngBlob(
    canvas
  );
}


function questionHasImageCue(
  text
) {
  return /(?:\bfigura\b|\bimagem\b|\btabela\b|\bgr[aá]fico\b|\becg\b|eletrocardiograma|tra[cç]ado|radiografia|tomografia|resson[aâ]ncia|ultrassom|exames? laboratoriais?)/i
    .test(
      String(
        text
        || ""
      )
    );
}


function isQuestionFooterLine(
  text
) {
  const value =
    String(
      text
      || ""
    )
      .trim();

  return (
    /p[aá]gina\s+\d+\s+de\s+\d+/i
      .test(
        value
      )
    ||
    /prova gerada pelo/i
      .test(
        value
      )
    ||
    /todos os direitos reservados/i
      .test(
        value
      )
  );
}


function questionLineGroupsForPage(
  lineRecords,
  questionStarts
) {
  return questionStarts.map(
    (
      question,
      index
    ) => {
      const next =
        questionStarts[
          index + 1
        ];

      const endY =
        next
          ? next.top
          : Number.POSITIVE_INFINITY;

      const lines =
        lineRecords
          .filter(
            line =>
              line.top
                >= question.top - 3
              &&
              line.top
                < endY - 3
              &&
              !isQuestionFooterLine(
                line.text
              )
          )
          .sort(
            (
              a,
              b
            ) =>
              a.top - b.top
          );

      return {
        number:
          question.number,

        top:
          question.top,

        bottom:
          next
            ? next.top
            : (
                lines[
                  lines.length - 1
                ]?.bottom
                || question.bottom
              ),

        lines,

        text:
          lines
            .map(
              line =>
                line.text
            )
            .join(
              " "
            )
      };
    }
  );
}


function strongVisualPixel(
  pixels,
  offset
) {
  const r =
    pixels[
      offset
    ];

  const g =
    pixels[
      offset + 1
    ];

  const b =
    pixels[
      offset + 2
    ];

  const minChannel =
    Math.min(
      r,
      g,
      b
    );

  const maxChannel =
    Math.max(
      r,
      g,
      b
    );

  const luminance =
    r * 0.299
    + g * 0.587
    + b * 0.114;

  /*
    Ignora fundos quase brancos e a marca d'água rosa muito clara,
    mas mantém traçados, grades, tabelas, ECGs e imagens clínicas.
  */
  return (
    luminance < 188
    ||
    (
      luminance < 215
      &&
      maxChannel - minChannel > 55
    )
  );
}


function visualBlockInsideGap(
  pageCanvas,
  gap
) {
  const context =
    pageCanvas.getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
    );

  const left =
    Math.max(
      0,
      Math.floor(
        gap.left
      )
    );

  const top =
    Math.max(
      0,
      Math.floor(
        gap.top
      )
    );

  const right =
    Math.min(
      pageCanvas.width,
      Math.ceil(
        gap.right
      )
    );

  const bottom =
    Math.min(
      pageCanvas.height,
      Math.ceil(
        gap.bottom
      )
    );

  const width =
    Math.max(
      1,
      right - left
    );

  const height =
    Math.max(
      1,
      bottom - top
    );

  if (
    width < 40
    ||
    height < 20
  ) {
    return null;
  }

  const image =
    context.getImageData(
      left,
      top,
      width,
      height
    );

  let minX =
    width;

  let minY =
    height;

  let maxX =
    -1;

  let maxY =
    -1;

  let strongCount =
    0;

  const step =
    1;

  for (
    let y = 0;
    y < height;
    y += step
  ) {
    for (
      let x = 0;
      x < width;
      x += step
    ) {
      const offset =
        (
          y * width
          + x
        ) * 4;

      if (
        !strongVisualPixel(
          image.data,
          offset
        )
      ) {
        continue;
      }

      strongCount +=
        1;

      minX =
        Math.min(
          minX,
          x
        );

      minY =
        Math.min(
          minY,
          y
        );

      maxX =
        Math.max(
          maxX,
          x
        );

      maxY =
        Math.max(
          maxY,
          y
        );
    }
  }

  if (
    strongCount < 180
    ||
    maxX < minX
    ||
    maxY < minY
  ) {
    return null;
  }

  const visualWidth =
    maxX - minX + 1;

  const visualHeight =
    maxY - minY + 1;

  const visualArea =
    Math.max(
      1,
      visualWidth
      * visualHeight
    );

  const density =
    strongCount
    / visualArea;

  if (
    visualWidth
      < Math.max(
          80,
          pageCanvas.width * 0.08
        )
    ||
    visualHeight < 24
    ||
    density < 0.012
  ) {
    return null;
  }

  const padding =
    Math.max(
      5,
      Math.round(
        Math.min(
          visualWidth,
          visualHeight
        ) * 0.025
      )
    );

  return {
    left:
      Math.max(
        0,
        left
        + minX
        - padding
      ),

    top:
      Math.max(
        0,
        top
        + minY
        - padding
      ),

    right:
      Math.min(
        pageCanvas.width,
        left
        + maxX
        + 1
        + padding
      ),

    bottom:
      Math.min(
        pageCanvas.height,
        top
        + maxY
        + 1
        + padding
      ),

    width:
      Math.min(
        pageCanvas.width,
        left
        + maxX
        + 1
        + padding
      )
      -
      Math.max(
        0,
        left
        + minX
        - padding
      ),

    height:
      Math.min(
        pageCanvas.height,
        top
        + maxY
        + 1
        + padding
      )
      -
      Math.max(
        0,
        top
        + minY
        - padding
      ),

    density,
    strongCount
  };
}


function detectQuestionImagesFromTextGaps(
  pageCanvas,
  lineRecords,
  questionStarts
) {
  const questions =
    questionLineGroupsForPage(
      lineRecords,
      questionStarts
    );

  const results =
    [];

  for (
    const question
    of questions
  ) {
    if (
      !questionHasImageCue(
        question.text
      )
    ) {
      continue;
    }

    const lines =
      question.lines;

    if (
      lines.length < 2
    ) {
      continue;
    }

    const candidateGaps =
      [];

    for (
      let index = 0;
      index < lines.length - 1;
      index += 1
    ) {
      const current =
        lines[index];

      const next =
        lines[
          index + 1
        ];

      const gapTop =
        current.bottom
        + 3;

      const gapBottom =
        next.top
        - 3;

      const gapHeight =
        gapBottom
        - gapTop;

      if (
        gapHeight
        < Math.max(
            34,
            pageCanvas.height * 0.018
          )
      ) {
        continue;
      }

      candidateGaps.push({
        top:
          gapTop,

        bottom:
          gapBottom,

        height:
          gapHeight
      });
    }

    candidateGaps
      .sort(
        (
          a,
          b
        ) =>
          b.height - a.height
      );

    for (
      const gap
      of candidateGaps
    ) {
      const block =
        visualBlockInsideGap(
          pageCanvas,
          {
            left:
              pageCanvas.width
              * 0.055,

            right:
              pageCanvas.width
              * 0.945,

            top:
              gap.top,

            bottom:
              gap.bottom
          }
        );

      if (!block) {
        continue;
      }

      results.push({
        question_number:
          question.number,

        rect:
          block,

        source:
          "text-gap"
      });

      /*
        Um grande bloco visual por lacuna já resolve a maioria
        dos PDFs de banco de questões. Se houver mais de uma
        imagem real na mesma questão, consolidateQuestionImages
        continuará aceitando os candidatos vindos de XObject.
      */
      break;
    }
  }

  return results;
}


function questionRegionsFromTextLayout(
  lineRecords,
  viewport
) {
  const starts =
    questionStartsForPage(
      lineRecords
    );


  if (
    !starts.length
  ) {
    return [];
  }


  const pageWidth =
    Number(
      viewport?.width
      || 0
    );


  const regions =
    [];


  for (
    let questionIndex = 0;
    questionIndex < starts.length;
    questionIndex += 1
  ) {
    const start =
      starts[
        questionIndex
      ];


    const nextQuestion =
      starts[
        questionIndex + 1
      ];


    const questionLimit =
      nextQuestion
        ? nextQuestion.top - 2
        : Number.POSITIVE_INFINITY;


    const lines =
      lineRecords
        .filter(
          line =>
            line.top
              >= start.top - 3
            &&
            line.top
              < questionLimit
            &&
            !isQuestionFooterLine(
              line.text
            )
        )
        .sort(
          (
            a,
            b
          ) =>
            a.top - b.top
            ||
            a.left - b.left
        );


    if (
      lines.length < 2
    ) {
      continue;
    }


    /*
      Preferimos explicitamente a alternativa A porque ela
      marca o começo das alternativas. Se o PDF tiver a letra
      separada do texto, cai no primeiro padrão de alternativa.
    */
    let alternativeIndex =
      lines.findIndex(
        line => {
          const match =
            alternativeStartMatch(
              line.text
            );


          return (
            match
            &&
            String(
              match[1]
              || ""
            )
              .toUpperCase()
            === "A"
          );
        }
      );


    if (
      alternativeIndex < 0
    ) {
      alternativeIndex =
        lines.findIndex(
          line =>
            Boolean(
              alternativeStartMatch(
                line.text
              )
            )
        );
    }


    if (
      alternativeIndex <= 0
    ) {
      continue;
    }


    const firstAlternative =
      lines[
        alternativeIndex
      ];


    const stemLines =
      lines.slice(
        0,
        alternativeIndex
      );


    const gaps =
      [];


    /*
      Examina cada quebra vertical dentro do enunciado.
      A maior quebra é o ponto mais provável onde existe
      ECG/tabela/radiografia/gráfico, mesmo que haja texto
      depois da imagem e antes das alternativas.
    */
    for (
      let index = 0;
      index < stemLines.length;
      index += 1
    ) {
      const current =
        stemLines[
          index
        ];


      const nextLine =
        index
          < stemLines.length - 1
            ? stemLines[
                index + 1
              ]
            : firstAlternative;


      const top =
        current.bottom + 1;


      const bottom =
        nextLine.top - 1;


      const height =
        bottom - top;


      if (
        height > 0
      ) {
        gaps.push({
          top,
          bottom,
          height,
          index
        });
      }
    }


    let bestGap =
      gaps
        .slice()
        .sort(
          (
            a,
            b
          ) =>
            b.height - a.height
        )[0]
      || null;


    /*
      Garantia absoluta: se não houver quebra relevante,
      ainda cria uma faixa imediatamente acima da alternativa A.
      Assim toda questão recebe captura, com imagem ou sem imagem.
    */
    if (
      !bestGap
      ||
      bestGap.height < 8
    ) {
      const fallbackHeight =
        Math.max(
          30,
          Number(
            viewport?.scale
            || 1
          ) * 12
        );


      bestGap = {
        bottom:
          firstAlternative.top - 1,

        top:
          Math.max(
            start.bottom + 1,
            firstAlternative.top
            - fallbackHeight
          )
      };


      bestGap.height =
        Math.max(
          1,
          bestGap.bottom
          - bestGap.top
        );
    }


    /*
      Usa quase toda a largura da página, e não apenas a
      largura do texto. Isso impede cortar ECG/tabela centralizados.
    */
    const left =
      pageWidth > 0
        ? pageWidth * 0.03
        : 0;


    const right =
      pageWidth > 0
        ? pageWidth * 0.97
        : Math.max(
            ...lines.map(
              line =>
                line.right
            )
          )
          + 12;


    regions.push({
      question_number:
        start.number,

      left,

      right,

      top:
        bestGap.top,

      bottom:
        bestGap.bottom,

      width:
        Math.max(
          1,
          right - left
        ),

      height:
        Math.max(
          1,
          bestGap.bottom
          - bestGap.top
        ),

      source:
        "question-gap-screenshot"
    });
  }


  return regions;
}


function isQuestionAlternativeLine(
  text
) {
  return Boolean(
    alternativeStartMatch(
      text
    )
  );
}


function isQuestionPageFooterLine(
  text
) {
  const value =
    normalizeLine(
      text
    );

  return (
    /p[aá]gina\s+\d+\s+de\s+\d+/i
      .test(
        value
      )
    ||
    /prova gerada pelo/i
      .test(
        value
      )
    ||
    /todos os direitos reservados/i
      .test(
        value
      )
  );
}


function questionTextCropBand(
  lineRecords,
  questionStarts,
  questionIndex,
  pageHeight
) {
  const question =
    questionStarts[
      questionIndex
    ];


  const nextQuestion =
    questionStarts[
      questionIndex + 1
    ]
    || null;


  let endY =
    nextQuestion
      ? nextQuestion.top
      : pageHeight;


  /*
    No último item da página, não deixa rodapé entrar
    na região da questão.
  */
  const footerTop =
    lineRecords
      .filter(
        line =>
          line.top
          > question.top
          &&
          isQuestionPageFooterLine(
            line.text
          )
      )
      .map(
        line =>
          line.top
      )
      .sort(
        (
          a,
          b
        ) =>
          a - b
      )[0];


  if (
    Number.isFinite(
      footerTop
    )
  ) {
    endY =
      Math.min(
        endY,
        footerTop
      );
  }


  const lines =
    lineRecords
      .filter(
        line =>
          line.top
          >= question.top - 3
          &&
          line.top
          < endY - 2
          &&
          !isQuestionPageFooterLine(
            line.text
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          a.top - b.top
      );


  const firstAlternativeIndex =
    lines.findIndex(
      line =>
        isQuestionAlternativeLine(
          line.text
        )
    );


  if (
    firstAlternativeIndex <= 0
  ) {
    return null;
  }


  const firstAlternative =
    lines[
      firstAlternativeIndex
    ];


  const beforeAlternative =
    lines.slice(
      0,
      firstAlternativeIndex
    );


  if (
    !beforeAlternative.length
  ) {
    return null;
  }


  /*
    Inclui a primeira alternativa só como limite inferior.
    Assim conseguimos medir todos os "vazios" do enunciado
    até o início das respostas.
  */
  const sequence = [
    ...beforeAlternative,
    firstAlternative
  ];


  const gaps =
    [];


  for (
    let index = 0;
    index < sequence.length - 1;
    index += 1
  ) {
    const current =
      sequence[
        index
      ];


    const next =
      sequence[
        index + 1
      ];


    const height =
      next.top
      - current.bottom;


    if (
      height > 1
    ) {
      gaps.push({
        top:
          current.bottom,

        bottom:
          next.top,

        height,

        beforeAlternative:
          index
          === sequence.length - 2
      });
    }
  }


  if (
    !gaps.length
  ) {
    return null;
  }


  const positiveHeights =
    gaps
      .map(
        gap =>
          gap.height
      )
      .filter(
        height =>
          height > 0
      )
      .sort(
        (
          a,
          b
        ) =>
          a - b
      );


  const medianGap =
    positiveHeights.length
      ? positiveHeights[
          Math.floor(
            positiveHeights.length / 2
          )
        ]
      : 0;


  const typicalFontHeight =
    beforeAlternative.length
      ? beforeAlternative
          .map(
            line =>
              Number(
                line.fontHeight
                || 0
              )
          )
          .filter(
            Number.isFinite
          )
          .sort(
            (
              a,
              b
            ) =>
              a - b
          )[
            Math.floor(
              beforeAlternative.length / 2
            )
          ]
          || 0
      : 0;


  const largestGap =
    gaps
      .slice()
      .sort(
        (
          a,
          b
        ) =>
          b.height - a.height
      )[0];


  const lastGap =
    gaps[
      gaps.length - 1
    ];


  /*
    Se há um vão muito maior que o espaçamento normal,
    assumimos que é onde está ECG/tabela/figura.
    Caso contrário, usamos literalmente o espaço logo
    acima da primeira alternativa — mesmo se estiver vazio.
  */
  const significantThreshold =
    Math.max(
      48,
      typicalFontHeight * 2.1,
      medianGap * 2.4
    );


  const chosen =
    largestGap.height
      >= significantThreshold
        ? largestGap
        : lastGap;


  const verticalPadding =
    Math.max(
      3,
      typicalFontHeight * 0.12
    );


  const top =
    Math.max(
      question.top,
      chosen.top
      + verticalPadding
    );


  const bottom =
    Math.min(
      firstAlternative.top,
      chosen.bottom
      - verticalPadding
    );


  if (
    bottom <= top
  ) {
    return null;
  }


  return {
    top,
    bottom,
    height:
      bottom - top,

    significant:
      chosen
      === largestGap
      &&
      largestGap.height
        >= significantThreshold
  };
}


function cropQuestionBandOrVisual(
  pageCanvas,
  band
) {
  const broadRect = {
    left:
      pageCanvas.width
      * 0.045,

    right:
      pageCanvas.width
      * 0.955,

    top:
      band.top,

    bottom:
      band.bottom
  };


  /*
    Primeiro tenta APENAS aparar margens brancas.
    A faixa vertical já foi decidida pelo texto, não pela
    detecção de imagem. Se não houver conteúdo visual,
    mantém a faixa completa como o usuário pediu.
  */
  const trimmed =
    visualBlockInsideGap(
      pageCanvas,
      broadRect
    );


  if (
    trimmed
  ) {
    return trimmed;
  }


  return {
    ...broadRect,

    width:
      broadRect.right
      - broadRect.left,

    height:
      broadRect.bottom
      - broadRect.top
  };
}


async function ocrQuestionLineRecordsFromCanvas(
  canvas,
  pageNumber
) {
  if (
    !window.Tesseract
  ) {
    return [];
  }

  setImportStatus(
    `OCR de apoio: lendo a página ${pageNumber} para localizar questão e alternativas...`
  );

  try {
    const {
      data
    } =
      await window.Tesseract
        .recognize(
          canvas,
          "por"
        );

    const words =
      (data?.words || [])
        .map(
          word => {
            const text =
              normalizeLine(
                word.text
              );

            const bbox =
              word.bbox;

            if (
              !text
              || !bbox
            ) {
              return null;
            }

            return {
              text,
              left:
                Number(bbox.x0 || 0),
              top:
                Number(bbox.y0 || 0),
              right:
                Number(bbox.x1 || 0),
              bottom:
                Number(bbox.y1 || 0)
            };
          }
        )
        .filter(Boolean);

    const rows =
      [];

    for (
      const word
      of words
    ) {
      const centerY =
        (
          word.top
          + word.bottom
        )
        / 2;

      let row =
        rows.find(
          candidate =>
            Math.abs(
              candidate.centerY
              - centerY
            )
            <= Math.max(
              7,
              (
                word.bottom
                - word.top
              )
              * 0.55
            )
        );

      if (
        !row
      ) {
        row = {
          centerY,
          words:
            []
        };

        rows.push(
          row
        );
      }

      row.words.push(
        word
      );

      row.centerY =
        row.words.reduce(
          (
            sum,
            current
          ) =>
            sum
            + (
                current.top
                + current.bottom
              )
              / 2,
          0
        )
        / row.words.length;
    }

    return rows
      .map(
        row => {
          row.words.sort(
            (
              a,
              b
            ) =>
              a.left - b.left
          );

          return {
            text:
              normalizeLine(
                row.words
                  .map(
                    word =>
                      word.text
                  )
                  .join(
                    " "
                  )
              ),
            left:
              Math.min(
                ...row.words.map(
                  word =>
                    word.left
                )
              ),
            right:
              Math.max(
                ...row.words.map(
                  word =>
                    word.right
                )
              ),
            top:
              Math.min(
                ...row.words.map(
                  word =>
                    word.top
                )
              ),
            bottom:
              Math.max(
                ...row.words.map(
                  word =>
                    word.bottom
                )
              ),
            fontHeight:
              Math.max(
                ...row.words.map(
                  word =>
                    word.bottom
                    - word.top
                )
              )
          };
        }
      )
      .filter(
        row =>
          row.text
      )
      .sort(
        (
          a,
          b
        ) =>
          a.top - b.top
          ||
          a.left - b.left
      );

  } catch (
    error
  ) {
    console.warn(
      `OCR de apoio falhou na página ${pageNumber}:`,
      error
    );

    return [];
  }
}


async function extractQuestionImagesQuick(
  page,
  content,
  pageNumber
) {
  const viewport =
    page.getViewport({
      scale: 2
    });

  const lineRecords =
    groupTextItemsIntoLineRecords(
      content.items,
      viewport
    );

  const regions =
    questionRegionsFromTextLayout(
      lineRecords,
      viewport
    );

  if (!regions.length) {
    return [];
  }

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    Math.ceil(
      viewport.width
    );

  canvas.height =
    Math.ceil(
      viewport.height
    );

  const context =
    canvas.getContext(
      "2d",
      {
        alpha: false
      }
    );

  context.fillStyle =
    "#ffffff";

  context.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  await page
    .render({
      canvasContext:
        context,
      viewport
    })
    .promise;

  const results =
    [];

  for (
    const region
    of regions
  ) {
    setImportStatus(
      `Extração rápida: recortando questão ${region.question_number} — página ${pageNumber}...`
    );

    const blob =
      await cropRenderedPage(
        canvas,
        region
      );

    results.push({
      question_number:
        region.question_number,
      blob,
      source_rect:
        region,
      source:
        "quick-text-gap",
      page_number:
        pageNumber
    });
  }

  return results;
}


async function extractQuestionImagesFromPage(
  page,
  content,
  pageNumber
) {
  /*
    Duas passagens independentes:

    1) TEXTO / OCR estrutural:
       usa a camada de texto do PDF para localizar o fim do
       enunciado e o início das alternativas. Captura a faixa
       intermediária inteira.

    2) IMAGEM / XOBJECT:
       procura objetos de imagem incorporados no PDF e os associa
       à questão pela posição vertical.

    IMPORTANTE:
    não removemos candidatos ruins, repetidos ou sobrepostos.
    A decisão final fica com o usuário na galeria.
  */
  const renderScale =
    3;

  const viewport =
    page.getViewport({
      scale:
        renderScale
    });

  let lineRecords =
    groupTextItemsIntoLineRecords(
      content.items,
      viewport
    );

  let questionStarts =
    questionStartsForPage(
      lineRecords
    );

  let regions =
    questionRegionsFromTextLayout(
      lineRecords,
      viewport
    );

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    Math.ceil(
      viewport.width
    );

  canvas.height =
    Math.ceil(
      viewport.height
    );

  const context =
    canvas.getContext(
      "2d",
      {
        alpha:
          false
      }
    );

  context.fillStyle =
    "#ffffff";

  context.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  context.imageSmoothingEnabled =
    true;

  context.imageSmoothingQuality =
    "high";

  await page
    .render({
      canvasContext:
        context,
      viewport
    })
    .promise;

  /*
    Se a camada de texto do PDF não delimitar bem a questão,
    fazemos OCR somente como fallback. Assim PDFs normais
    continuam rápidos e PDFs escaneados ganham coordenadas.
  */
  if (
    !questionStarts.length
    || !regions.length
  ) {
    const ocrRecords =
      await ocrQuestionLineRecordsFromCanvas(
        canvas,
        pageNumber
      );

    if (
      ocrRecords.length
    ) {
      lineRecords =
        ocrRecords;

      questionStarts =
        questionStartsForPage(
          lineRecords
        );

      regions =
        questionRegionsFromTextLayout(
          lineRecords,
          viewport
        );
    }
  }

  const results =
    [];

  /*
    PASSAGEM 1 — faixa entre enunciado e alternativas.
    Mesmo se o recorte não parecer perfeito, preservamos.
  */
  for (
    const region
    of regions
  ) {
    setImportStatus(
      `Passagem 1/2: recortando questão ${region.question_number} — página ${pageNumber}...`
    );

    const blob =
      await cropRenderedPage(
        canvas,
        region
      );

    results.push({
      question_number:
        region.question_number,
      blob,
      source_rect:
        region,
      source:
        "text-gap",
      page_number:
        pageNumber
    });
  }

  /*
    PASSAGEM 2 — imagens incorporadas/objetos visuais do PDF.
    Não fazemos merge nem eliminamos sobreposição.
  */
  try {
    const embeddedRects =
      await extractEmbeddedImageRects(
        page,
        viewport,
        true
      );

    for (
      const rect
      of embeddedRects
    ) {
      const questionNumber =
        matchImageRectToQuestion(
          rect,
          questionStarts
        );

      if (
        !questionNumber
      ) {
        continue;
      }

      setImportStatus(
        `Passagem 2/2: detectando imagens da questão ${questionNumber} — página ${pageNumber}...`
      );

      const safeRect =
        safeQuestionImageCropRect(
          rect,
          lineRecords,
          viewport
        );

      const blob =
        await cropRenderedPage(
          canvas,
          safeRect
        );

      results.push({
        question_number:
          questionNumber,
        blob,
        source_rect:
          safeRect,
        source:
          "embedded-image",
        page_number:
          pageNumber
      });
    }
  } catch (
    imageError
  ) {
    console.warn(
      `Passagem visual falhou na página ${pageNumber}:`,
      imageError
    );
  }

  console.debug(
    `[Questões] Página ${pageNumber}: ${results.length} candidato(s) de imagem preservado(s).`
  );

  return results;
}


async function consolidateQuestionImages(
  imageEntries
) {
  const grouped =
    new Map();

  for (const entry of imageEntries) {
    if (
      !grouped.has(
        entry.question_number
      )
    ) {
      grouped.set(
        entry.question_number,
        []
      );
    }

    grouped
      .get(
        entry.question_number
      )
      .push(
        entry.blob
      );
  }

  const consolidated = [];

  for (
    const [
      questionNumber,
      blobs
    ]
    of grouped.entries()
  ) {
    consolidated.push({
      question_number:
        questionNumber,
      blob:
        await mergeQuestionImageBlobs(
          blobs
        )
    });
  }

  return consolidated;
}


async function extractQuestionsFromPdf(
  file,
  options = {}
) {
  if (!window.pdfjsLib) {
    throw new Error(
      "Leitor de PDF não carregou. Atualize a página e tente novamente."
    );
  }

  const extractionMode =
    options.mode
    || "detailed";

  const sourceProfile =
    options.source
    || "general";

  window.pdfjsLib
    .GlobalWorkerOptions
    .workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const buffer =
    await file.arrayBuffer();

  const pdf =
    await window.pdfjsLib
      .getDocument({
        data: buffer
      })
      .promise;

  const allLines = [];
  const pagesText = [];
  const extractedImageEntries = [];

  let medCofDetected =
    sourceProfile === "medcof";

  for (
    let pageNumber = 1;
    pageNumber <= pdf.numPages;
    pageNumber += 1
  ) {
    setImportStatus(
      `${extractionMode === "quick" ? "Extração rápida" : "Extração detalhada"} · ${sourceProfileLabel(sourceProfile)} · página ${pageNumber} de ${pdf.numPages}...`
    );

    const page =
      await pdf.getPage(
        pageNumber
      );

    const content =
      await page
        .getTextContent();

    const rawPageText =
      normalizeLine(
        content.items
          .map(
            (item) =>
              item.str || ""
          )
          .join(" ")
      );

    pagesText.push(
      rawPageText
    );

    if (
      /medcof\s*qbank/i
        .test(
          rawPageText
        )
    ) {
      medCofDetected =
        true;
    }

    const lines =
      groupTextItemsIntoLines(
        content.items
      )
        .map(
          (line) =>
            normalizeSourceSpecificLine(
              line,
              sourceProfile
            )
        )
        .filter(
          (line) =>
            !isPdfHeaderLine(
              line
            )
            && !isSourceSpecificHeaderLine(
              line,
              sourceProfile
            )
        );

    allLines.push(
      ...lines
    );

    try {
      const pageImages =
        extractionMode === "quick"
          ? await extractQuestionImagesQuick(
              page,
              content,
              pageNumber
            )
          : await extractQuestionImagesFromPage(
              page,
              content,
              pageNumber
            );

      extractedImageEntries.push(
        ...pageImages
      );
    } catch (imageError) {
      console.warn(
        `Não foi possível recortar imagens da página ${pageNumber}:`,
        imageError
      );
    }
  }

  const defaultSourceLabel =
    sourceProfile !== "general"
      && sourceProfile !== "other"
        ? sourceProfileLabel(
            sourceProfile
          )
        : medCofDetected
          ? "MEDCOF"
          : null;

  const strategies =
    [];

  const standardBlocks =
    extractQuestionBlocks(
      allLines
    );

  const standardQuestions =
    questionsFromBlocks(
      standardBlocks,
      defaultSourceLabel
    );

  strategies.push({
    name: "estrutura principal",
    questions:
      standardQuestions
  });

  if (
    extractionMode === "detailed"
  ) {
    const looseLines =
      buildLooseTextLines(
        pagesText
      )
        .map(
          (line) =>
            normalizeSourceSpecificLine(
              line,
              sourceProfile
            )
        )
        .filter(
          (line) =>
            !isPdfHeaderLine(
              line
            )
            && !isSourceSpecificHeaderLine(
              line,
              sourceProfile
            )
        );

    const looseQuestions =
      questionsFromBlocks(
        extractQuestionBlocks(
          looseLines
        ),
        defaultSourceLabel
      );

    strategies.push({
      name: "texto reconstruído",
      questions:
        looseQuestions
    });

    const profileLines =
      allLines
        .map(
          (line) =>
            normalizeSourceSpecificLine(
              line,
              sourceProfile
            )
        );

    const profileQuestions =
      questionsFromBlocks(
        extractQuestionBlocks(
          profileLines
        ),
        defaultSourceLabel
      );

    strategies.push({
      name: `perfil ${sourceProfileLabel(sourceProfile)}`,
      questions:
        profileQuestions
    });
  }

  const bestStrategy =
    strategies
      .slice()
      .sort(
        (a, b) =>
          questionSetConfidence(
            b.questions
          )
          - questionSetConfidence(
              a.questions
            )
      )[0];

  const questions =
    bestStrategy?.questions
    || [];

  if (
    questions.length < 2
  ) {
    throw new Error(
      "Não consegui identificar as questões deste PDF. Tente a Extração detalhada ou selecione o cursinho correto."
    );
  }

  const answerKey =
    extractMedCofAnswerKey(
      allLines
    );

  const questionImages =
    extractedImageEntries
      .slice()
      .sort(
        (a, b) =>
          Number(a.question_number || 0)
          - Number(b.question_number || 0)
          ||
          Number(a.page_number || 0)
          - Number(b.page_number || 0)
      );

  if (
    extractionMode === "detailed"
  ) {
    setImportStatus(
      `Extração detalhada concluída com ${bestStrategy?.name || "estratégia principal"}: ${questions.length} questões e ${questionImages.length} recorte(s). Salvando...`
    );
  } else {
    setImportStatus(
      `Extração rápida concluída: ${questions.length} questões e ${questionImages.length} recorte(s). Salvando...`
    );
  }

  return {
    questions,
    questionImages,
    answerKey,
    extractionMode,
    sourceProfile,
    strategy:
      bestStrategy?.name
      || "estrutura principal"
  };
}


async function createManualSimulation() {
  const title =
    document
      .getElementById(
        "qs-manual-title"
      )
      ?.value
      .trim()
    || "";


  const total =
    Number(
      document
        .getElementById(
          "qs-manual-count"
        )
        ?.value
      || 0
    );


  if (!title) {
    setManualStatus(
      "Digite o nome do simulado.",
      "error"
    );

    return;
  }


  if (
    !Number.isInteger(total)
    || total < 1
    || total > 500
  ) {
    setManualStatus(
      "Informe uma quantidade entre 1 e 500 questões.",
      "error"
    );

    return;
  }


  const button =
    document.getElementById(
      "qs-create-manual"
    );


  button.disabled =
    true;


  setManualStatus(
    "Criando simulado..."
  );


  let setRecord =
    null;


  try {
    const {
      data,
      error
    } =
      await qsSb
        .from(
          "question_sets"
        )
        .insert({
          user_id:
            qsState.user.id,

          title,

          source_file_name:
            null,

          total_questions:
            total,

          status:
            "ready",

          exam_id:
            qsIsUuid(
              linkedExamId
            )
              ? linkedExamId
              : null
        })
        .select()
        .single();


    if (error) {
      throw error;
    }


    setRecord =
      data;


    const rows =
      Array.from(
        {
          length:
            total
        },
        (
          _value,
          index
        ) => ({
          user_id:
            qsState.user.id,

          set_id:
            setRecord.id,

          question_number:
            index + 1,

          order_index:
            index + 1,

          source_label:
            "Cadastro manual",

          stem:
            null,

          alternatives:
            {},

          raw_text:
            `Questão ${index + 1}`
        })
      );


    for (
      const chunk
      of chunkArray(
        rows,
        150
      )
    ) {
      const {
        error:
          itemsError
      } =
        await qsSb
          .from(
            "question_items"
          )
          .insert(
            chunk
          );


      if (itemsError) {
        throw itemsError;
      }
    }


    document
      .getElementById(
        "qs-manual-title"
      )
      .value =
        "";


    setManualStatus(
      `${total} questões criadas. Simulado pronto para o gabarito.`,
      "success"
    );


    await loadSets();


    switchQsMode(
      "mine"
    );


    await openSet(
      setRecord.id
    );


  } catch (error) {
    console.error(
      error
    );


    if (
      setRecord?.id
    ) {
      await qsSb
        .from(
          "question_sets"
        )
        .delete()
        .eq(
          "id",
          setRecord.id
        );
    }


    setManualStatus(
      error.message
      || "Não foi possível criar o simulado.",
      "error"
    );


  } finally {
    button.disabled =
      false;
  }
}


async function createQuestionSet(title, file) {
  const { data, error } = await qsSb
    .from("question_sets")
    .insert({
      user_id: qsState.user.id,
      title,
      source_file_name: file.name,
      status: "processing",
      exam_id:
        qsIsUuid(
          linkedExamId
        )
          ? linkedExamId
          : null
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

/*
  PDFs brutos não são enviados ao Supabase.
  A leitura ocorre localmente no navegador.
*/

const LURIA_IMAGE_TARGET_BYTES =
  100 * 1024;

const LURIA_IMAGE_SOFT_MAX_BYTES =
  150 * 1024;

const LURIA_IMAGE_MAX_DIMENSION =
  1100;


async function compressLuriaImageBlob(
  sourceBlob
) {
  if (
    !sourceBlob
    || !sourceBlob.type
      ?.startsWith(
        "image/"
      )
  ) {
    return sourceBlob;
  }


  /*
    Se já estiver abaixo da meta, não recomprime.
    Evita perda de qualidade desnecessária.
  */
  if (
    sourceBlob.size
    <= LURIA_IMAGE_TARGET_BYTES
  ) {
    return sourceBlob;
  }


  try {
    const bitmap =
      await createImageBitmap(
        sourceBlob
      );


    const originalWidth =
      bitmap.width;

    const originalHeight =
      bitmap.height;


    const dimensionSteps =
      [
        1100,
        1000,
        900,
        820
      ];


    const qualitySteps =
      [
        0.82,
        0.76,
        0.70,
        0.64,
        0.58
      ];


    let bestReadable =
      null;

    let smallest =
      null;


    for (
      const maxDimension
      of dimensionSteps
    ) {
      const scale =
        Math.min(
          1,
          maxDimension
            / originalWidth,
          maxDimension
            / originalHeight
        );


      const width =
        Math.max(
          1,
          Math.round(
            originalWidth
            * scale
          )
        );


      const height =
        Math.max(
          1,
          Math.round(
            originalHeight
            * scale
          )
        );


      const canvas =
        document.createElement(
          "canvas"
        );


      canvas.width =
        width;

      canvas.height =
        height;


      const context =
        canvas.getContext(
          "2d",
          {
            alpha:
              false
          }
        );


      context.imageSmoothingEnabled =
        true;

      context.imageSmoothingQuality =
        "high";

      context.fillStyle =
        "#ffffff";

      context.fillRect(
        0,
        0,
        width,
        height
      );

      context.drawImage(
        bitmap,
        0,
        0,
        width,
        height
      );


      for (
        const quality
        of qualitySteps
      ) {
        const candidate =
          await new Promise(
            (
              resolve
            ) => {
              canvas.toBlob(
                resolve,
                "image/webp",
                quality
              );
            }
          );


        if (!candidate) {
          continue;
        }


        if (
          !smallest
          || candidate.size
            < smallest.size
        ) {
          smallest =
            candidate;
        }


        /*
          Preserva um candidato nítido de até 150 KB.
          Só usamos algo mais agressivo se não houver
          opção legível nessa faixa.
        */
        if (
          candidate.size
            <= LURIA_IMAGE_SOFT_MAX_BYTES
          && quality >= 0.64
          && maxDimension >= 900
        ) {
          if (
            !bestReadable
            || candidate.size
              < bestReadable.size
          ) {
            bestReadable =
              candidate;
          }
        }


        if (
          candidate.size
          <= LURIA_IMAGE_TARGET_BYTES
        ) {
          bitmap.close?.();

          return candidate;
        }
      }
    }


    bitmap.close?.();


    /*
      Se 100 KB exigir perda excessiva,
      aceita até 150 KB para manter texto/diagramas nítidos.
    */
    if (bestReadable) {
      return bestReadable;
    }


    return smallest
      || sourceBlob;


  } catch (error) {
    console.warn(
      "Não foi possível otimizar a imagem:",
      error
    );

    return sourceBlob;
  }
}


async function loadQuestionImageDrawable(
  sourceBlob
) {
  if (
    typeof createImageBitmap
    === "function"
  ) {
    try {
      const bitmap =
        await createImageBitmap(
          sourceBlob
        );

      return {
        source:
          bitmap,

        width:
          bitmap.width,

        height:
          bitmap.height,

        cleanup:
          () =>
            bitmap.close?.()
      };
    } catch (
      error
    ) {
      console.warn(
        "createImageBitmap indisponível para esta imagem; usando fallback compatível:",
        error
      );
    }
  }


  const objectUrl =
    URL.createObjectURL(
      sourceBlob
    );


  const image =
    new Image();


  try {
    await new Promise(
      (
        resolve,
        reject
      ) => {
        image.onload =
          resolve;

        image.onerror =
          () =>
            reject(
              new Error(
                "Não foi possível decodificar a imagem da questão."
              )
            );

        image.src =
          objectUrl;
      }
    );


    return {
      source:
        image,

      width:
        image.naturalWidth
        || image.width,

      height:
        image.naturalHeight
        || image.height,

      cleanup:
        () =>
          URL.revokeObjectURL(
            objectUrl
          )
    };
  } catch (
    error
  ) {
    URL.revokeObjectURL(
      objectUrl
    );

    throw error;
  }
}


function canvasBlob(
  canvas,
  type,
  quality
) {
  return new Promise(
    resolve => {
      canvas.toBlob(
        resolve,
        type,
        quality
      );
    }
  );
}


async function compressQuestionFigureBlob(
  sourceBlob
) {
  if (
    !sourceBlob
    ||
    !sourceBlob.type
      ?.startsWith(
        "image/"
      )
  ) {
    return sourceBlob;
  }


  /*
    Regras das imagens de questões:
    - teto interno de 128 KiB (margem abaixo de 130 KB);
    - nunca reduzir o maior lado abaixo de 800 px;
    - priorizar resolução e só então reduzir qualidade.
    Imagens originalmente menores que 800 px não são ampliadas.
  */
  const maxBytes =
    128 * 1024;

  const minLongestSide =
    800;


  if (
    sourceBlob.size
    <= maxBytes
  ) {
    return sourceBlob;
  }


  const drawable =
    await loadQuestionImageDrawable(
      sourceBlob
    );


  try {
    const originalWidth =
      Number(
        drawable.width
      );

    const originalHeight =
      Number(
        drawable.height
      );


    if (
      !originalWidth
      || !originalHeight
    ) {
      throw new Error(
        "Imagem sem dimensões válidas."
      );
    }


    const originalLongestSide =
      Math.max(
        originalWidth,
        originalHeight
      );


    /*
      Nunca reduz abaixo de 800 px.
      Se a imagem original já tiver menos que 800 px,
      preserva a resolução original e trabalha apenas
      com a compressão de qualidade/formato.
    */
    const dimensionSteps =
      originalLongestSide
        <= minLongestSide
          ? [
              originalLongestSide
            ]
          : [
              originalLongestSide,
              1800,
              1600,
              1450,
              1300,
              1150,
              1000,
              900,
              850,
              800
            ]
              .filter(
                (
                  value,
                  index,
                  array
                ) =>
                  value
                    <= originalLongestSide
                  &&
                  value
                    >= minLongestSide
                  &&
                  array.indexOf(
                    value
                  )
                    === index
              );


    const qualitySteps = [
      0.92,
      0.88,
      0.84,
      0.80,
      0.76,
      0.72,
      0.68,
      0.64,
      0.60,
      0.56,
      0.52,
      0.48,
      0.44,
      0.40,
      0.36,
      0.32,
      0.28,
      0.24,
      0.20,
      0.16,
      0.12,
      0.09,
      0.07,
      0.05,
      0.03,
      0.01
    ];


    let smallest =
      null;


    for (
      const maxDimension
      of dimensionSteps
    ) {
      const scale =
        Math.min(
          1,
          maxDimension
          /
          originalLongestSide
        );


      const width =
        Math.max(
          1,
          Math.round(
            originalWidth
            * scale
          )
        );


      const height =
        Math.max(
          1,
          Math.round(
            originalHeight
            * scale
          )
        );


      /*
        Proteção explícita: uma imagem que começou com
        >= 800 px nunca pode sair deste algoritmo com
        o maior lado abaixo de 800 px.
      */
      if (
        originalLongestSide
          >= minLongestSide
        &&
        Math.max(
          width,
          height
        )
          < minLongestSide
      ) {
        continue;
      }


      const canvas =
        document.createElement(
          "canvas"
        );


      canvas.width =
        width;

      canvas.height =
        height;


      const context =
        canvas.getContext(
          "2d",
          {
            alpha:
              false
          }
        );


      if (!context) {
        continue;
      }


      context.fillStyle =
        "#ffffff";

      context.fillRect(
        0,
        0,
        width,
        height
      );


      context.imageSmoothingEnabled =
        true;

      context.imageSmoothingQuality =
        "high";


      context.drawImage(
        drawable.source,
        0,
        0,
        width,
        height
      );


      for (
        const quality
        of qualitySteps
      ) {
        let candidate =
          await canvasBlob(
            canvas,
            "image/webp",
            quality
          );


        /*
          Safari/iOS: se WebP não for produzido corretamente,
          usa JPEG sem alterar a resolução escolhida.
        */
        if (
          !candidate
          ||
          candidate.type
            !== "image/webp"
        ) {
          candidate =
            await canvasBlob(
              canvas,
              "image/jpeg",
              quality
            );
        }


        if (!candidate) {
          continue;
        }


        if (
          !smallest
          ||
          candidate.size
          < smallest.size
        ) {
          smallest =
            candidate;
        }


        if (
          candidate.size
          <= maxBytes
        ) {
          return candidate;
        }
      }
    }


    /*
      Segunda passagem exclusivamente na resolução mínima
      permitida. Não reduz dimensão abaixo de 800 px:
      insiste apenas na qualidade JPEG para cumprir o teto.
    */
    const finalLongestSide =
      originalLongestSide
        >= minLongestSide
          ? minLongestSide
          : originalLongestSide;


    const finalScale =
      Math.min(
        1,
        finalLongestSide
        /
        originalLongestSide
      );


    const finalWidth =
      Math.max(
        1,
        Math.round(
          originalWidth
          * finalScale
        )
      );


    const finalHeight =
      Math.max(
        1,
        Math.round(
          originalHeight
          * finalScale
        )
      );


    const finalCanvas =
      document.createElement(
        "canvas"
      );


    finalCanvas.width =
      finalWidth;

    finalCanvas.height =
      finalHeight;


    const finalContext =
      finalCanvas.getContext(
        "2d",
        {
          alpha:
            false
        }
      );


    if (!finalContext) {
      throw new Error(
        "Não foi possível processar a imagem."
      );
    }


    finalContext.fillStyle =
      "#ffffff";

    finalContext.fillRect(
      0,
      0,
      finalWidth,
      finalHeight
    );


    finalContext.imageSmoothingEnabled =
      true;

    finalContext.imageSmoothingQuality =
      "high";


    finalContext.drawImage(
      drawable.source,
      0,
      0,
      finalWidth,
      finalHeight
    );


    for (
      const quality
      of [
        0.025,
        0.02,
        0.015,
        0.01
      ]
    ) {
      const candidate =
        await canvasBlob(
          finalCanvas,
          "image/jpeg",
          quality
        );


      if (!candidate) {
        continue;
      }


      if (
        !smallest
        ||
        candidate.size
        < smallest.size
      ) {
        smallest =
          candidate;
      }


      if (
        candidate.size
        <= maxBytes
      ) {
        return candidate;
      }
    }


    /*
      Não existe fallback abaixo de 800 px.
      Em navegadores normais, JPEG/WebP a 800 px e qualidade
      mínima fica bem abaixo do teto. Caso o encoder falhe,
      retorna o menor resultado obtido sem violar resolução.
    */
    if (smallest) {
      return smallest;
    }


    throw new Error(
      "Não foi possível processar a imagem."
    );


  } finally {
    drawable.cleanup?.();
  }
}

async function uploadExtractedQuestionImages(
  setId,
  questionImages
) {
  const primaryPaths =
    {};

  const candidateRows =
    [];

  const perQuestionCounter =
    new Map();

  for (
    let index = 0;
    index < questionImages.length;
    index += 1
  ) {
    const image =
      questionImages[
        index
      ];

    const questionNumber =
      Number(
        image.question_number
      );

    const candidateIndex =
      (
        perQuestionCounter.get(
          questionNumber
        )
        || 0
      )
      + 1;

    perQuestionCounter.set(
      questionNumber,
      candidateIndex
    );

    setImportStatus(
      `Otimizando imagem ${candidateIndex} da questão ${questionNumber}...`
    );

    const optimizedBlob =
      await compressQuestionFigureBlob(
        image.blob
      );

    const extension =
      optimizedBlob.type
        === "image/webp"
          ? "webp"
          : optimizedBlob.type
              === "image/jpeg"
            ? "jpg"
            : "png";


    const path =
      `${qsState.user.id}/question_sets/${setId}/images/question-${questionNumber}-candidate-${candidateIndex}.${extension}`;

    setImportStatus(
      `Enviando imagem ${candidateIndex} da questão ${questionNumber}...`
    );

    const {
      error
    } =
      await qsSb
        .storage
        .from(
          "docmap"
        )
        .upload(
          path,
          optimizedBlob,
          {
            contentType:
              optimizedBlob.type
              || "image/webp",
            upsert:
              true
          }
        );

    if (error) {
      throw error;
    }

    if (
      !primaryPaths[
        questionNumber
      ]
    ) {
      primaryPaths[
        questionNumber
      ] =
        path;
    }

    candidateRows.push({
      user_id:
        qsState.user.id,
      set_id:
        setId,
      question_number:
        questionNumber,
      image_path:
        path,
      source:
        image.source
        || "unknown",
      candidate_index:
        candidateIndex
    });
  }

  if (
    candidateRows.length
  ) {
    const {
      error:
        galleryError
    } =
      await qsSb
        .from(
          "question_image_candidates"
        )
        .insert(
          candidateRows
        );

    if (
      galleryError
    ) {
      throw galleryError;
    }
  }

  return primaryPaths;
}


function chunkArray(array, size) {
  const chunks = [];

  for (let i = 0; i < array.length; i += size) {
    chunks.push(
      array.slice(i, i + size)
    );
  }

  return chunks;
}

async function importPdf() {
  const file =
    qsState.file;

  if (!file) {
    setImportStatus(
      "Selecione um PDF.",
      "error"
    );

    return;
  }


  const title =
    document
      .getElementById(
        "qs-title"
      )
      .value
      .trim()
    || cleanFileTitle(
        file.name
      )
    || "Simulado";


  const button =
    document.getElementById(
      "qs-import"
    );


  button.disabled =
    true;


  let setRecord =
    null;


  try {
    /*
      Primeiro reconhece tudo localmente.
      Nenhum PDF bruto é enviado ao Storage/Supabase.
    */
    setImportStatus(
      "Lendo PDF localmente e reconhecendo as questões..."
    );


    const extractionSettings =
      currentExtractionSettings();

    const extraction =
      await extractQuestionsFromPdf(
        file,
        extractionSettings
      );


    const {
      questions,
      questionImages,
      answerKey
    } =
      extraction;


    setImportStatus(
      "Questões reconhecidas. Salvando somente os dados extraídos..."
    );


    setRecord =
      await createQuestionSet(
        title,
        file
      );


    const imagePaths =
      await uploadExtractedQuestionImages(
        setRecord.id,
        questionImages
      );


    const payload =
      questions.map(
        question => ({
          user_id:
            qsState.user.id,

          set_id:
            setRecord.id,

          ...question,

          official_answer:
            answerKey[
              question.question_number
            ]
            || null,

          image_path:
            imagePaths[
              question.question_number
            ]
            || null
        })
      );


    for (
      const chunk
      of chunkArray(
        payload,
        150
      )
    ) {
      const {
        error
      } =
        await qsSb
          .from(
            "question_items"
          )
          .insert(
            chunk
          );


      if (
        error
      ) {
        throw error;
      }
    }


    const {
      error:
        updateError
    } =
      await qsSb
        .from(
          "question_sets"
        )
        .update({
          source_file_path:
            null,

          total_questions:
            questions.length,

          status:
            "ready",

          error_message:
            null
        })
        .eq(
          "id",
          setRecord.id
        );


    if (
      updateError
    ) {
      throw updateError;
    }


    setImportStatus(
      `${questions.length} questões extraídas com sucesso em ${extraction.extractionMode === "quick" ? "Extração rápida" : "Extração detalhada"} · ${sourceProfileLabel(extraction.sourceProfile)}. ${questionImages.length} recorte(s) de imagem preservado(s). O PDF original não foi armazenado.`,
      "success"
    );


    document
      .getElementById(
        "qs-title"
      )
      .value =
        "";


    await loadSets();


    switchQsMode(
      "mine"
    );


    await openSet(
      setRecord.id
    );


  } catch (
    error
  ) {
    console.error(
      error
    );


    if (
      setRecord?.id
    ) {
      await qsSb
        .from(
          "question_sets"
        )
        .update({
          status:
            "failed",

          source_file_path:
            null,

          error_message:
            error.message
            || "Erro ao importar"
        })
        .eq(
          "id",
          setRecord.id
        );
    }


    setImportStatus(
      error.message
      || "Não foi possível importar o PDF.",
      "error"
    );


  } finally {
    /*
      Sucesso ou erro: libera o arquivo bruto do navegador.
    */
    qsState.file =
      null;


    const input =
      document.getElementById(
        "qs-file"
      );


    if (
      input
    ) {
      input.value =
        "";
    }


    const fileName =
      document.getElementById(
        "qs-file-name"
      );


    if (
      fileName
    ) {
      fileName.textContent =
        "Selecione um PDF";
    }


    button.disabled =
      false;
  }
}



function qsDate30DaysAgoISO() {
  const date =
    new Date();

  date.setDate(
    date.getDate()
    - 29
  );

  date.setHours(
    0,
    0,
    0,
    0
  );

  return date
    .toISOString()
    .slice(
      0,
      10
    );
}


function qsFormatRecentDate(
  value
) {
  if (!value) {
    return "sem data";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "sem data";
  }


  return new Intl
    .DateTimeFormat(
      "pt-BR",
      {
        day:
          "2-digit",

        month:
          "2-digit",

        year:
          "2-digit"
      }
    )
    .format(
      date
    );
}


function renderRecentSimulationResults(
  rows
) {
  const container =
    document.getElementById(
      "qs-recent-results"
    );

  const count =
    document.getElementById(
      "qs-recent-count"
    );


  if (!container) {
    return;
  }


  const data =
    rows
    || [];


  if (count) {
    count.textContent =
      `${data.length} resultado${data.length === 1 ? "" : "s"}`;
  }


  if (!data.length) {
    container.innerHTML =
      '<div class="qs-empty">Nenhum gabarito salvo ainda.</div>';

    return;
  }


  container.innerHTML =
    data.map(
      (row) => {
        const accuracyValue =
          row.accuracy_percent === null
          || row.accuracy_percent === undefined
            ? 0
            : Number(
                row.accuracy_percent
              );


        return `
          <div class="qs-recent-row">

            <div class="qs-recent-copy">

              <strong>
                ${qsEscape(
                  row.title
                  || "Simulado"
                )}
              </strong>

              <small>
                ${Number(
                  row.answered_count
                  || 0
                )} respondidas
                · ${Number(
                  row.correct_count
                  || 0
                )} acertos
                · ${Number(
                  row.wrong_count
                  || 0
                )} erros
                · ${qsEscape(
                  qsFormatRecentDate(
                    row.last_answered_at
                    || row.created_at
                  )
                )}
              </small>

            </div>

            <div class="qs-recent-progress">
              <span
                style="width:${Math.max(
                  0,
                  Math.min(
                    100,
                    accuracyValue
                  )
                )}%"
              ></span>
            </div>

            <div class="qs-recent-score">
              ${
                row.accuracy_percent === null
                || row.accuracy_percent === undefined
                  ? "—"
                  : `${accuracyValue.toFixed(1).replace(".", ",")}%`
              }
            </div>

          </div>
        `;
      }
    )
    .join("");
}



function qsIsoDateLocal(
  date
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    )
      .padStart(
        2,
        "0"
      );

  const day =
    String(
      date.getDate()
    )
      .padStart(
        2,
        "0"
      );


  return `${year}-${month}-${day}`;
}


function qsMonthStartISO(
  date = new Date()
) {
  return qsIsoDateLocal(
    new Date(
      date.getFullYear(),
      date.getMonth(),
      1
    )
  );
}


function qsTwelveMonthsStartISO() {
  const now =
    new Date();


  return qsIsoDateLocal(
    new Date(
      now.getFullYear(),
      now.getMonth() - 11,
      1
    )
  );
}


function qsMonthKey(
  value
) {
  const text =
    String(
      value
      || ""
    );


  return text.slice(
    0,
    7
  );
}


function qsBuildMonthlySeries(
  rows
) {
  const now =
    new Date();

  const months =
    [];


  for (
    let offset = 11;
    offset >= 0;
    offset -= 1
  ) {
    const date =
      new Date(
        now.getFullYear(),
        now.getMonth() - offset,
        1
      );


    const key =
      `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(
        2,
        "0"
      )}`;


    months.push({
      key,

      label:
        new Intl
          .DateTimeFormat(
            "pt-BR",
            {
              month:
                "short"
            }
          )
          .format(
            date
          )
          .replace(
            ".",
            ""
          ),

      answered:
        0,

      correct:
        0
    });
  }


  const map =
    new Map(
      months.map(
        (month) => [
          month.key,
          month
        ]
      )
    );


  for (
    const row
    of rows
    || []
  ) {
    const month =
      map.get(
        qsMonthKey(
          row.answer_date
        )
      );


    if (!month) {
      continue;
    }


    month.answered +=
      Number(
        row.answered_questions
        || 0
      );


    month.correct +=
      Number(
        row.correct_questions
        || 0
      );
  }


  return months.map(
    (month) => ({
      ...month,

      accuracy:
        month.answered > 0
          ? (
              month.correct
              / month.answered
            )
            * 100
          : null
    })
  );
}


function renderMonthlyAccuracyChart(
  series
) {
  const container =
    document.getElementById(
      "qs-monthly-chart"
    );


  const current =
    document.getElementById(
      "qs-trend-current"
    );


  if (!container) {
    return;
  }


  const data =
    series
    || [];


  const currentMonth =
    data[
      data.length - 1
    ];


  if (current) {
    current.textContent =
      currentMonth?.accuracy === null
      || currentMonth?.accuracy === undefined
        ? "Mês atual · —"
        : `Mês atual · ${currentMonth.accuracy
            .toFixed(1)
            .replace(".", ",")}%`;
  }


  const valid =
    data.filter(
      (item) =>
        item.accuracy !== null
    );


  if (!valid.length) {
    container.innerHTML =
      '<div class="qs-empty">Ainda não há dados mensais suficientes para o gráfico.</div>';

    return;
  }


  const width =
    700;

  const height =
    220;

  const left =
    42;

  const right =
    16;

  const top =
    22;

  const bottom =
    36;

  const chartWidth =
    width
    - left
    - right;

  const chartHeight =
    height
    - top
    - bottom;


  const xFor =
    (index) =>
      left
      + (
          data.length === 1
            ? chartWidth / 2
            : (
                index
                / (
                  data.length - 1
                )
              )
              * chartWidth
        );


  const yFor =
    (accuracyValue) =>
      top
      + (
          1
          - (
            accuracyValue
            / 100
          )
        )
        * chartHeight;


  const points =
    data
      .map(
        (
          item,
          index
        ) => {
          if (
            item.accuracy === null
          ) {
            return null;
          }


          return {
            ...item,
            index,
            x:
              xFor(
                index
              ),
            y:
              yFor(
                item.accuracy
              )
          };
        }
      )
      .filter(
        Boolean
      );


  const polyline =
    points
      .map(
        (point) =>
          `${point.x.toFixed(1)},${point.y.toFixed(1)}`
      )
      .join(
        " "
      );


  const gridValues =
    [
      0,
      25,
      50,
      75,
      100
    ];


  const grid =
    gridValues.map(
      (value) => {
        const y =
          yFor(
            value
          );


        return `
          <line
            class="qs-chart-grid"
            x1="${left}"
            y1="${y}"
            x2="${width - right}"
            y2="${y}"
          ></line>

          <text
            class="qs-chart-axis-text"
            x="${left - 7}"
            y="${y + 3}"
            text-anchor="end"
          >
            ${value}%
          </text>
        `;
      }
    )
    .join("");


  const months =
    data.map(
      (
        item,
        index
      ) => `
        <text
          class="qs-chart-month"
          x="${xFor(index)}"
          y="${height - 10}"
          text-anchor="middle"
        >
          ${qsEscape(item.label)}
        </text>
      `
    )
    .join("");


  const dots =
    points.map(
      (point) => `
        <circle
          class="qs-chart-dot"
          cx="${point.x}"
          cy="${point.y}"
          r="4"
        ></circle>

        <text
          class="qs-chart-value"
          x="${point.x}"
          y="${Math.max(
            12,
            point.y - 9
          )}"
          text-anchor="middle"
        >
          ${point.accuracy.toFixed(0)}%
        </text>
      `
    )
    .join("");


  container.innerHTML = `
    <svg
      viewBox="0 0 ${width} ${height}"
      aria-hidden="true"
    >
      ${grid}

      ${
        points.length > 1
          ? `
            <polyline
              class="qs-chart-line"
              points="${polyline}"
            ></polyline>
          `
          : ""
      }

      ${dots}
      ${months}
    </svg>
  `;
}


function qsWeekStartISO(
  date = new Date()
) {
  const day =
    date.getDay();

  const diff =
    day === 0
      ? -6
      : 1 - day;

  return qsIsoDateLocal(
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + diff
    )
  );
}


function qsFortnightStartISO(
  date = new Date()
) {
  return qsIsoDateLocal(
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() - 13
    )
  );
}


function qsDateFromISO(
  value
) {
  const [
    year,
    month,
    day
  ] =
    String(value)
      .slice(0, 10)
      .split("-")
      .map(Number);

  return new Date(
    year,
    month - 1,
    day
  );
}


function qsBuildFortnightSeries(
  rows
) {
  const now =
    new Date();

  const days = [];

  for (
    let offset = 13;
    offset >= 0;
    offset -= 1
  ) {
    const date =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - offset
      );

    days.push({
      key:
        qsIsoDateLocal(
          date
        ),

      label:
        String(
          date.getDate()
        ).padStart(
          2,
          "0"
        ),

      answered:
        0,

      correct:
        0,

      accuracy:
        null
    });
  }

  const map =
    new Map(
      days.map(
        (day) => [
          day.key,
          day
        ]
      )
    );

  for (
    const row
    of rows || []
  ) {
    const day =
      map.get(
        String(
          row.answer_date
          || ""
        ).slice(
          0,
          10
        )
      );

    if (!day) {
      continue;
    }

    day.answered +=
      Number(
        row.answered_questions
        || 0
      );

    day.correct +=
      Number(
        row.correct_questions
        || 0
      );
  }

  return days.map(
    (day) => ({
      ...day,

      accuracy:
        day.answered > 0
          ? (
              day.correct
              / day.answered
            )
            * 100
          : null
    })
  );
}


function renderFortnightAccuracyChart(
  series
) {
  const container =
    document.getElementById(
      "qs-fortnight-chart"
    );

  const current =
    document.getElementById(
      "qs-fortnight-current"
    );

  const helper =
    document.getElementById(
      "qs-fortnight-helper"
    );

  if (!container) {
    return;
  }

  const active =
    (series || [])
      .filter(
        (day) =>
          day.accuracy !== null
      );

  if (!active.length) {
    container.innerHTML =
      '<div class="qs-empty">Sem respostas nos últimos 14 dias.</div>';

    if (current) {
      current.textContent =
        "—";
    }

    if (helper) {
      helper.textContent =
        "Sem atividade na quinzena";
    }

    return;
  }

  const last =
    active[
      active.length - 1
    ];

  if (current) {
    current.textContent =
      `${last.accuracy
        .toFixed(0)}%`;
  }

  const answered =
    active.reduce(
      (
        total,
        day
      ) =>
        total
        + day.answered,
      0
    );

  if (helper) {
    helper.textContent =
      `${answered} questão${answered === 1 ? "" : "ões"} respondida${answered === 1 ? "" : "s"} nos últimos 14 dias`;
  }

  const width =
    260;

  const height =
    125;

  const left =
    14;

  const right =
    8;

  const top =
    12;

  const bottom =
    20;

  const chartWidth =
    width
    - left
    - right;

  const chartHeight =
    height
    - top
    - bottom;

  const validPoints =
    [];

  series.forEach(
    (
      day,
      index
    ) => {
      if (
        day.accuracy === null
      ) {
        return;
      }

      const x =
        left
        + (
            index
            / Math.max(
                1,
                series.length - 1
              )
          )
          * chartWidth;

      const y =
        top
        + (
            1
            - Math.max(
                0,
                Math.min(
                  100,
                  day.accuracy
                )
              )
              / 100
          )
          * chartHeight;

      validPoints.push({
        ...day,
        x,
        y
      });
    }
  );

  const polyline =
    validPoints
      .map(
        (point) =>
          `${point.x},${point.y}`
      )
      .join(" ");

  const grid =
    [25, 50, 75]
      .map(
        (value) => {
          const y =
            top
            + (
                1
                - value / 100
              )
              * chartHeight;

          return `
            <line
              class="grid-line"
              x1="${left}"
              x2="${width - right}"
              y1="${y}"
              y2="${y}"
            ></line>
          `;
        }
      )
      .join("");

  const dots =
    validPoints
      .map(
        (point) => `
          <circle
            class="dot"
            cx="${point.x}"
            cy="${point.y}"
            r="3.2"
          ></circle>
        `
      )
      .join("");

  const labels =
    series
      .map(
        (
          day,
          index
        ) => {
          if (
            ![
              0,
              6,
              13
            ].includes(
              index
            )
          ) {
            return "";
          }

          const x =
            left
            + (
                index
                / Math.max(
                    1,
                    series.length - 1
                  )
              )
              * chartWidth;

          return `
            <text
              class="axis-label"
              x="${x}"
              y="${height - 5}"
              text-anchor="middle"
            >
              ${day.label}
            </text>
          `;
        }
      )
      .join("");

  container.innerHTML = `
    <svg
      viewBox="0 0 ${width} ${height}"
      aria-hidden="true"
    >
      ${grid}

      ${
        validPoints.length > 1
          ? `
            <polyline
              class="line"
              points="${polyline}"
            ></polyline>
          `
          : ""
      }

      ${dots}
      ${labels}
    </svg>
  `;
}


async function loadQuestionOverview() {
  const weekStart =
    qsWeekStartISO();

  const monthStart =
    qsMonthStartISO();

  const fortnightStart =
    qsFortnightStartISO();


  const [
    overallResult,
    weekResult,
    monthResult,
    fortnightResult
  ] =
    await Promise.all([

      qsSb
        .from(
          "question_metrics_overall"
        )
        .select(
          "completed_sets,total_sets,answered_questions,correct_questions,wrong_questions,sent_to_error_count,accuracy_percent"
        )
        .maybeSingle(),

      qsSb
        .from(
          "question_metrics_daily"
        )
        .select(
          "answer_date,answered_questions,correct_questions,wrong_questions,accuracy_percent"
        )
        .gte(
          "answer_date",
          weekStart
        )
        .order(
          "answer_date",
          {
            ascending:
              true
          }
        ),

      qsSb
        .from(
          "question_metrics_daily"
        )
        .select(
          "answer_date,answered_questions,correct_questions,wrong_questions,accuracy_percent"
        )
        .gte(
          "answer_date",
          monthStart
        )
        .order(
          "answer_date",
          {
            ascending:
              true
          }
        ),

      qsSb
        .from(
          "question_metrics_daily"
        )
        .select(
          "answer_date,answered_questions,correct_questions,wrong_questions,accuracy_percent"
        )
        .gte(
          "answer_date",
          fortnightStart
        )
        .order(
          "answer_date",
          {
            ascending:
              true
          }
        )
    ]);


  [
    overallResult,
    weekResult,
    monthResult,
    fortnightResult
  ]
    .forEach(
      (result) => {
        if (
          result?.error
        ) {
          console.warn(
            result.error
          );
        }
      }
    );


  const metrics =
    overallResult.data
    || {
      completed_sets:
        0,

      total_sets:
        0,

      answered_questions:
        0,

      correct_questions:
        0,

      wrong_questions:
        0,

      sent_to_error_count:
        0,

      accuracy_percent:
        null
    };


  const totalAnswered =
    Number(
      metrics.answered_questions
      || 0
    );

  const totalCorrect =
    Number(
      metrics.correct_questions
      || 0
    );

  const totalWrong =
    Number(
      metrics.wrong_questions
      || 0
    );


  const weekRows =
    weekResult.data
    || [];

  const weekAnswered =
    weekRows.reduce(
      (
        total,
        row
      ) =>
        total
        + Number(
            row.answered_questions
            || 0
          ),
      0
    );

  const weekCorrect =
    weekRows.reduce(
      (
        total,
        row
      ) =>
        total
        + Number(
            row.correct_questions
            || 0
          ),
      0
    );

  const weekWrong =
    weekRows.reduce(
      (
        total,
        row
      ) =>
        total
        + Number(
            row.wrong_questions
            || 0
          ),
      0
    );

  const weekAccuracy =
    weekAnswered > 0
      ? (
          weekCorrect
          / weekAnswered
        )
        * 100
      : null;


  const monthRows =
    monthResult.data
    || [];

  const monthAnswered =
    monthRows.reduce(
      (
        total,
        row
      ) =>
        total
        + Number(
            row.answered_questions
            || 0
          ),
      0
    );

  const monthCorrect =
    monthRows.reduce(
      (
        total,
        row
      ) =>
        total
        + Number(
            row.correct_questions
            || 0
          ),
      0
    );

  const monthAccuracy =
    monthAnswered > 0
      ? (
          monthCorrect
          / monthAnswered
        )
        * 100
      : null;


  /*
    "Simulados no mês":
    conta os simulados cadastrados no mês atual.
    Usa qsState.sets, que já foi carregado antes deste dashboard.
  */
  const monthSimulationCount =
    (qsState.sets || [])
      .filter(
        (set) => {
          const created =
            String(
              set.created_at
              || ""
            ).slice(
              0,
              10
            );

          return (
            created
            && created >= monthStart
          );
        }
      )
      .length;


  const setText =
    (
      id,
      value
    ) => {
      const element =
        document.getElementById(
          id
        );

      if (element) {
        element.textContent =
          value;
      }
    };


  setText(
    "qs-week-questions",
    weekAnswered
  );

  setText(
    "qs-week-correct",
    weekCorrect
  );

  setText(
    "qs-week-wrong",
    weekWrong
  );


  const weekCorrectShare =
    weekAnswered > 0
      ? (
          weekCorrect
          / weekAnswered
        )
        * 100
      : 0;

  const weekWrongShare =
    weekAnswered > 0
      ? (
          weekWrong
          / weekAnswered
        )
        * 100
      : 0;


  const weekCorrectBar =
    document.getElementById(
      "qs-week-bar-correct"
    );

  const weekWrongBar =
    document.getElementById(
      "qs-week-bar-wrong"
    );

  if (weekCorrectBar) {
    weekCorrectBar.style.width =
      `${weekCorrectShare}%`;
  }

  if (weekWrongBar) {
    weekWrongBar.style.width =
      `${weekWrongShare}%`;
  }


  setText(
    "qs-week-helper",
    weekAnswered > 0
      ? `${weekCorrectShare
          .toFixed(1)
          .replace(".", ",")}% acertos · ${weekWrongShare
          .toFixed(1)
          .replace(".", ",")}% erros`
      : "Sem questões nesta semana"
  );


  setText(
    "qs-week-accuracy",
    weekAccuracy === null
      ? "—"
      : `${weekAccuracy
          .toFixed(1)
          .replace(".", ",")}%`
  );


  const weekRing =
    document.getElementById(
      "qs-week-ring"
    );

  if (weekRing) {
    weekRing.style
      .setProperty(
        "--qs-ring-value",
        weekAccuracy === null
          ? 0
          : Math.max(
              0,
              Math.min(
                100,
                weekAccuracy
              )
            )
      );
  }


  setText(
    "qs-total-questions",
    totalAnswered
  );

  setText(
    "qs-total-questions-helper",
    `${totalCorrect} acertos · ${totalWrong} erros`
  );


  setText(
    "qs-month-simulations",
    monthSimulationCount
  );

  setText(
    "qs-month-simulations-helper",
    monthSimulationCount
      ? `${monthSimulationCount} simulado${monthSimulationCount === 1 ? "" : "s"} cadastrado${monthSimulationCount === 1 ? "" : "s"} neste mês`
      : "Nenhum simulado cadastrado neste mês"
  );


  setText(
    "qs-month-questions-compact",
    monthAnswered
  );

  setText(
    "qs-month-questions-compact-helper",
    monthAnswered
      ? `${monthCorrect} acertos neste mês`
      : "Sem questões respondidas neste mês"
  );


  setText(
    "qs-month-accuracy-compact",
    monthAccuracy === null
      ? "—"
      : `${monthAccuracy
          .toFixed(1)
          .replace(".", ",")}%`
  );

  setText(
    "qs-month-accuracy-compact-helper",
    monthAnswered
      ? `${monthAnswered} questões consideradas`
      : "Sem atividade neste mês"
  );


  setText(
    "qs-total-correct",
    totalCorrect
  );

  setText(
    "qs-total-wrong",
    totalWrong
  );


  const totalCorrectShare =
    totalAnswered > 0
      ? (
          totalCorrect
          / totalAnswered
        )
        * 100
      : 0;

  const totalWrongShare =
    totalAnswered > 0
      ? (
          totalWrong
          / totalAnswered
        )
        * 100
      : 0;


  const totalCorrectBar =
    document.getElementById(
      "qs-total-bar-correct"
    );

  const totalWrongBar =
    document.getElementById(
      "qs-total-bar-wrong"
    );

  if (totalCorrectBar) {
    totalCorrectBar.style.width =
      `${totalCorrectShare}%`;
  }

  if (totalWrongBar) {
    totalWrongBar.style.width =
      `${totalWrongShare}%`;
  }


  setText(
    "qs-total-split-helper",
    totalAnswered > 0
      ? `${totalCorrectShare
          .toFixed(1)
          .replace(".", ",")}% corretas · ${totalWrongShare
          .toFixed(1)
          .replace(".", ",")}% erradas`
      : "Sem respostas salvas"
  );


  setText(
    "qs-total-sent-errors",
    Number(
      metrics.sent_to_error_count
      || 0
    )
  );


  renderFortnightAccuracyChart(
    qsBuildFortnightSeries(
      fortnightResult.data
      || []
    )
  );
}

async function loadSets() {
  const [
    setsResult,
    itemsResult,
    attemptsResult,
    galleryResult
  ] = await Promise.all([
    qsSb
      .from("question_sets")
      .select("*")
      .neq("status", "archived")
      .order("created_at", { ascending: false }),

    qsSb
      .from("question_items")
      .select("id,set_id"),

    qsSb
      .from("question_attempts")
      .select("question_item_id,result,sent_to_error"),

    qsSb
      .from("question_image_candidates")
      .select("*")
      .order("question_number", { ascending: true })
      .order("candidate_index", { ascending: true })
  ]);

  if (setsResult.error) {
    console.error(setsResult.error);
    setImportStatus(
      `Não foi possível carregar seus simulados: ${setsResult.error.message}`,
      "error"
    );
    return;
  }

  if (itemsResult.error) {
    console.error(itemsResult.error);
  }

  if (attemptsResult.error) {
    console.error(attemptsResult.error);
  }

  // Na biblioteca, imagens não são necessárias para calcular métricas.
  // Evita assinar dezenas de arquivos privados durante o carregamento inicial.
  const items =
    itemsResult.data || [];

  qsState.imageGallery = [];
  const attempts = attemptsResult.data || [];

  const itemToSet = new Map(
    items.map((item) => [
      item.id,
      item.set_id
    ])
  );

  const metrics = new Map();

  for (const set of setsResult.data || []) {
    metrics.set(set.id, {
      answered: 0,
      correct: 0,
      wrong: 0,
      annulled: 0,
      sent: 0
    });
  }

  for (const attempt of attempts) {
    const setId =
      itemToSet.get(
        attempt.question_item_id
      );

    if (!setId || !metrics.has(setId)) continue;

    const metric = metrics.get(setId);

    metric.answered += 1;

    if (attempt.result === "correct") {
      metric.correct += 1;
    }

    if (attempt.result === "wrong") {
      metric.wrong += 1;
    }

    if (attempt.result === "annulled") {
      metric.annulled += 1;
    }

    if (
      attempt.result === "wrong"
      && attempt.sent_to_error === true
    ) {
      metric.sent += 1;
    }
  }

  qsState.sets = (setsResult.data || []).map((set) => ({
    ...set,
    metrics: metrics.get(set.id) || {
      answered: 0,
      correct: 0,
      wrong: 0,
      annulled: 0,
      sent: 0
    }
  }));

  renderSetHistory();

  await loadQuestionOverview();
}



function renderSimulationLibrary() {
  const container =
    document.getElementById(
      "qs-library"
    );

  const count =
    document.getElementById(
      "qs-library-count"
    );


  if (!container) {
    return;
  }


  if (count) {
    count.textContent =
      `${qsState.sets.length} ${
        qsState.sets.length === 1
          ? "simulado"
          : "simulados"
      }`;
  }


  if (
    !qsState.sets.length
  ) {
    container.innerHTML =
      '<div class="qs-empty">Nenhum simulado na biblioteca.</div>';

    updateSetBulkToolbar();

    return;
  }


  container.innerHTML =
    qsState.sets.map(
      (set) => {
        const m =
          set.metrics;


        return `
          <article class="qs-library-card">

            <label
              class="qs-library-check"
              aria-label="Selecionar simulado"
            >
              <input
                type="checkbox"
                data-select-set="${qsEscape(
                  set.id
                )}"
                ${qsState.selectedSetIds.has(set.id) ? "checked" : ""}
              >
            </label>


            <div class="qs-library-main">

              <strong>
                ${qsEscape(
                  set.title
                )}
              </strong>

              <small>
                ${Number(
                  set.total_questions
                  || 0
                )} questões
                · ${Number(
                  m.answered
                  || 0
                )} respondidas
                · ${accuracy(
                  m.correct,
                  m.correct + m.wrong
                )} de acerto
              </small>

            </div>


            <div class="qs-library-menu-wrap">

              <button
                class="qs-library-menu-trigger"
                type="button"
                data-qs-library-menu-trigger="${qsEscape(
                  set.id
                )}"
                aria-label="Opções do simulado"
                aria-expanded="false"
              >
                ⋯
              </button>

              <div
                class="qs-library-menu"
                data-qs-library-menu="${qsEscape(
                  set.id
                )}"
                hidden
              >

                <button
                  type="button"
                  data-edit-set="${qsEscape(
                    set.id
                  )}"
                >
                  Editar
                </button>

                <button
                  class="danger"
                  type="button"
                  data-delete-set-library="${qsEscape(
                    set.id
                  )}"
                >
                  Excluir
                </button>

              </div>

            </div>

          </article>
        `;
      }
    )
    .join("");


  container
    .querySelectorAll(
      "[data-select-set]"
    )
    .forEach(
      (input) => {
        input.addEventListener(
          "change",
          () => {
            const id =
              input.dataset
                .selectSet;


            if (input.checked) {
              qsState
                .selectedSetIds
                .add(
                  id
                );

            } else {
              qsState
                .selectedSetIds
                .delete(
                  id
                );
            }


            updateSetBulkToolbar();
          }
        );
      }
    );


  container
    .querySelectorAll(
      "[data-qs-library-menu-trigger]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          (event) => {
            event.stopPropagation();


            const id =
              button.dataset
                .qsLibraryMenuTrigger;


            const menu =
              container.querySelector(
                `[data-qs-library-menu="${CSS.escape(
                  id
                )}"]`
              );


            if (!menu) {
              return;
            }


            const open =
              menu.hidden;


            closeSimulationLibraryMenus();


            menu.hidden =
              !open;


            button.setAttribute(
              "aria-expanded",
              open
                ? "true"
                : "false"
            );
          }
        );
      }
    );


  container
    .querySelectorAll(
      "[data-qs-library-menu]"
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


  container
    .querySelectorAll(
      "[data-edit-set]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            closeSimulationLibraryMenus();


            openSimulationEditDialog(
              button.dataset
                .editSet
            );
          }
        );
      }
    );


  container
    .querySelectorAll(
      "[data-delete-set-library]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          async () => {
            closeSimulationLibraryMenus();


            await deleteSet(
              button.dataset
                .deleteSetLibrary
            );


            renderSimulationLibrary();
          }
        );
      }
    );


  updateSetBulkToolbar();
}


function openSimulationEditDialog(
  setId
) {
  const set =
    qsState.sets.find(
      (item) =>
        item.id === setId
    );


  if (!set) {
    return;
  }


  qsState.editingSetId =
    setId;


  document
    .getElementById(
      "qs-edit-title"
    )
    .value =
      set.title
      || "";


  setEditStatus(
    ""
  );


  const dialog =
    document.getElementById(
      "qs-edit-dialog"
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


function closeSimulationEditDialog() {
  qsState.editingSetId =
    null;


  const dialog =
    document.getElementById(
      "qs-edit-dialog"
    );


  if (
    typeof dialog?.close
      === "function"
  ) {
    dialog.close();

  } else {
    dialog?.removeAttribute(
      "open"
    );
  }
}


async function saveSimulationEdit() {
  const setId =
    qsState.editingSetId;


  const title =
    document
      .getElementById(
        "qs-edit-title"
      )
      ?.value
      .trim()
    || "";


  if (!setId) {
    return;
  }


  if (!title) {
    setEditStatus(
      "O nome do simulado é obrigatório.",
      "error"
    );

    return;
  }


  const button =
    document.getElementById(
      "qs-edit-save"
    );


  button.disabled =
    true;


  setEditStatus(
    "Salvando..."
  );


  const {
    error
  } =
    await qsSb
      .from(
        "question_sets"
      )
      .update({
        title
      })
      .eq(
        "id",
        setId
      );


  button.disabled =
    false;


  if (error) {
    console.error(
      error
    );


    setEditStatus(
      `Não foi possível salvar: ${error.message}`,
      "error"
    );

    return;
  }


  closeSimulationEditDialog();


  await loadSets();


  renderSimulationLibrary();
}


function updateSetBulkToolbar() {
  const visible =
    qsState.sets
      .map(
        (set) =>
          set.id
      );


  const selectedVisible =
    visible.filter(
      (id) =>
        qsState
          .selectedSetIds
          .has(
            id
          )
    ).length;


  const count =
    document.getElementById(
      "qs-selected-count"
    );


  const button =
    document.getElementById(
      "qs-delete-selected"
    );


  const selectAll =
    document.getElementById(
      "qs-select-all"
    );


  if (count) {
    count.textContent =
      `${qsState.selectedSetIds.size} selecionado${qsState.selectedSetIds.size === 1 ? "" : "s"}`;
  }


  if (button) {
    button.disabled =
      qsState.selectedSetIds.size === 0;
  }


  if (selectAll) {
    selectAll.checked =
      visible.length > 0
      && selectedVisible === visible.length;

    selectAll.indeterminate =
      selectedVisible > 0
      && selectedVisible < visible.length;
  }
}


async function deleteSelectedSets() {
  const ids =
    Array.from(
      qsState
        .selectedSetIds
    );


  if (!ids.length) {
    return;
  }


  const confirmed =
    await window.LuriaDialog.confirm(
      `Excluir ${ids.length} simulado${ids.length === 1 ? "" : "s"} e seus gabaritos?`
    );


  if (!confirmed) {
    return;
  }


  const selected =
    qsState.sets.filter(
      (set) =>
        qsState
          .selectedSetIds
          .has(
            set.id
          )
    );


  const {
    data:
      imageRows
  } =
    await qsSb
      .from(
        "question_items"
      )
      .select(
        "image_path"
      )
      .in(
        "set_id",
        ids
      );


  const paths = [
    ...selected
      .map(
        (set) =>
          set.source_file_path
      )
      .filter(
        Boolean
      ),

    ...(imageRows || [])
      .map(
        item =>
          item.image_path
      ),
    ...(candidateRows || [])
      .map(
        item =>
          item.image_path
      )
      .filter(
        Boolean
      )
  ];


  if (paths.length) {
    const {
      error:
        storageError
    } =
      await qsSb
        .storage
        .from(
          "docmap"
        )
        .remove(
          paths
        );


    if (storageError) {
      console.warn(
        storageError
      );
    }
  }


  const {
    error
  } =
    await qsSb
      .from(
        "question_sets"
      )
      .delete()
      .in(
        "id",
        ids
      );


  if (error) {
    console.error(
      error
    );


    setImportStatus(
      `Não foi possível excluir: ${error.message}`,
      "error"
    );

    return;
  }


  if (
    qsState.currentSet
    && qsState
      .selectedSetIds
      .has(
        qsState.currentSet.id
      )
  ) {
    closeCurrentSet();
  }


  qsState
    .selectedSetIds
    .clear();


  await Promise.all([
    loadSets(),
    loadQuestionOverview()
  ]);
}



function renderSetHistory() {
  const container =
    document.getElementById(
      "qs-history"
    );

  const count =
    document.getElementById(
      "qs-set-count"
    );


  if (!container) {
    return;
  }


  if (count) {
    count.textContent =
      `${qsState.sets.length} ${
        qsState.sets.length === 1
          ? "simulado"
          : "simulados"
      }`;
  }


  if (
    !qsState.sets.length
  ) {
    container.innerHTML =
      '<div class="qs-empty">Nenhum simulado cadastrado ainda.</div>';

    return;
  }


  container.innerHTML =
    qsState.sets.map(
      (set) => {
        const m =
          set.metrics;

        const isActive =
          qsState.currentSet?.id
          === set.id;


        return `
          <article
            class="qs-set-card ${isActive ? "active" : ""}"
          >

            <h3>
              ${qsEscape(
                set.title
              )}
            </h3>

            <p>
              ${set.total_questions || 0} questões
              · ${set.status === "ready" ? "pronto" : qsEscape(set.status)}
            </p>

            <div class="qs-set-metrics">

              <div>
                <span>Acertos</span>
                <strong>${m.correct}</strong>
              </div>

              <div>
                <span>Erros</span>
                <strong>${m.wrong}</strong>
              </div>

              <div>
                <span>Acerto</span>
                <strong>
                  ${accuracy(
                    m.correct,
                    m.correct + m.wrong
                  )}
                </strong>
              </div>

            </div>

            <div class="qs-set-actions">

              <button
                class="qs-mini-button primary"
                type="button"
                data-open-set="${qsEscape(
                  set.id
                )}"
              >
                Abrir
              </button>

            </div>

          </article>
        `;
      }
    )
    .join("");


  document
    .querySelectorAll(
      "[data-open-set]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            openSet(
              button.dataset
                .openSet
            );
          }
        );
      }
    );
}

async function attachPrivateImageUrls(
  rows
) {
  const ownPrefix =
    `${qsState.user.id}/`;

  const sourceRows =
    rows || [];

  const validPaths =
    [...new Set(
      sourceRows
        .map(row => row?.image_path)
        .filter(path =>
          path
          && String(path).startsWith(ownPrefix)
        )
    )];

  if (!validPaths.length) {
    return sourceRows.map(row => ({
      ...row,
      image_url: null
    }));
  }

  const {
    data,
    error
  } =
    await qsSb
      .storage
      .from("docmap")
      .createSignedUrls(
        validPaths,
        300
      );

  if (error) {
    console.warn(
      "Não foi possível assinar as imagens privadas em lote:",
      error
    );

    return sourceRows.map(row => ({
      ...row,
      image_url: null
    }));
  }

  const signedByPath =
    new Map(
      (data || []).map(item => [
        item.path,
        item.signedUrl || null
      ])
    );

  return sourceRows.map(row => ({
    ...row,
    image_url:
      row?.image_path
      && String(row.image_path).startsWith(ownPrefix)
        ? signedByPath.get(row.image_path) || null
        : null
  }));
}


async function attachQuestionImageUrls(
  items
) {
  return attachPrivateImageUrls(
    items || []
  );
}


async function attachGalleryImageUrls(
  rows
) {
  return attachPrivateImageUrls(
    rows || []
  );
}


async function extractOfficialAnswerKeyFromPdfBlob(
  blob
) {
  if (!window.pdfjsLib) {
    return {};
  }

  const buffer =
    await blob.arrayBuffer();

  const pdf =
    await window.pdfjsLib
      .getDocument({
        data: buffer
      })
      .promise;

  const lines = [];
  const pageTexts = [];

  for (
    let pageNumber = 1;
    pageNumber <= pdf.numPages;
    pageNumber += 1
  ) {
    const page =
      await pdf.getPage(
        pageNumber
      );

    const content =
      await page
        .getTextContent();

    const pageText =
      normalizeLine(
        content.items
          .map(
            (item) =>
              item.str || ""
          )
          .join(" ")
      );

    pageTexts.push(
      pageText
    );

    lines.push(
      ...groupTextItemsIntoLines(
        content.items
      )
    );
  }

  const direct =
    extractMedCofAnswerKey(
      lines
    );

  if (
    Object.keys(
      direct
    ).length
  ) {
    return direct;
  }

  return extractMedCofAnswerKey(
    buildLooseTextLines(
      pageTexts
    )
  );
}


async function backfillOfficialAnswerKeyFromSourcePdf() {
  if (
    !qsState.currentSet?.source_file_path
  ) {
    return 0;
  }

  const {
    data: pdfBlob,
    error
  } =
    await qsSb
      .storage
      .from(
        "docmap"
      )
      .download(
        qsState.currentSet
          .source_file_path
      );

  if (error) {
    console.warn(
      "Não foi possível baixar o PDF original para recuperar o gabarito:",
      error
    );

    return 0;
  }

  const answerKey =
    await extractOfficialAnswerKeyFromPdfBlob(
      pdfBlob
    );

  const rows =
    qsState.items
      .map(
        (item) => ({
          id: item.id,
          official_answer:
            answerKey[
              item.question_number
            ]
            || null
        })
      )
      .filter(
        (row) =>
          Boolean(
            row.official_answer
          )
      );

  if (!rows.length) {
    return 0;
  }

  let updated = 0;

  for (const row of rows) {
    const {
      error: updateError
    } =
      await qsSb
        .from(
          "question_items"
        )
        .update({
          official_answer:
            row.official_answer
        })
        .eq(
          "id",
          row.id
        );

    if (!updateError) {
      updated += 1;

      const localItem =
        qsState.items.find(
          (item) =>
            item.id === row.id
        );

      if (localItem) {
        localItem.official_answer =
          row.official_answer;
      }
    }
  }

  return updated;
}


async function ensureOfficialAnswerKey() {
  const known =
    qsState.items
      .filter(
        (item) =>
          Boolean(
            item.official_answer
          )
      )
      .length;

  if (
    known
    >= Math.max(
      1,
      qsState.items.length - 1
    )
  ) {
    return known;
  }

  try {
    const recovered =
      await backfillOfficialAnswerKeyFromSourcePdf();

    return Math.max(
      known,
      recovered
    );
  } catch (error) {
    console.warn(
      "Falha ao recuperar gabarito oficial:",
      error
    );

    return known;
  }
}


async function openSet(setId) {
  const set =
    qsState.sets.find(
      (item) => item.id === setId
    );

  if (!set) return;

  setAnswerStatus("Carregando questões...");

  const [
    itemsResult,
    attemptsResult,
    galleryResult
  ] = await Promise.all([
    qsSb
      .from("question_items")
      .select("*")
      .eq("set_id", setId)
      .order("order_index", { ascending: true }),

    qsSb
      .from("question_attempts")
      .select("*"),

    qsSb
      .from("question_image_candidates")
      .select("*")
      .eq("set_id", setId)
      .order("question_number", { ascending: true })
      .order("candidate_index", { ascending: true })
  ]);

  if (itemsResult.error) {
    console.error(itemsResult.error);
    setAnswerStatus(
      `Não foi possível carregar as questões: ${itemsResult.error.message}`,
      "error"
    );
    return;
  }

  if (attemptsResult.error) {
    console.error(attemptsResult.error);
  }

  const changingSet =
    qsState.currentSet?.id
    && qsState.currentSet.id
      !== setId;

  if (changingSet) {
    qsState.imageSelections.clear();
    clearAnswerScreenshotMemory();
  }

  const items =
    await attachQuestionImageUrls(
      itemsResult.data || []
    );

  if (
    galleryResult?.error
  ) {
    console.warn(
      "Não foi possível carregar a galeria de imagens:",
      galleryResult.error
    );

    qsState.imageGallery =
      [];

  } else {
    qsState.imageGallery =
      await attachGalleryImageUrls(
        galleryResult?.data
        || []
      );
  }

  const itemIds = new Set(
    items.map((item) => item.id)
  );

  const attempts = (attemptsResult.data || [])
    .filter((attempt) =>
      itemIds.has(attempt.question_item_id)
    );

  qsState.currentSet = set;
  qsState.items = items;
  qsState.attempts = new Map(
    attempts.map((attempt) => [
      attempt.question_item_id,
      attempt
    ])
  );

  qsResolutionState.currentIndex = 0;
  qsResolutionState.selectedById.clear();
  qsResolutionState.confirmedById.clear();

  attempts.forEach((attempt) => {
    const selected =
      String(
        attempt.selected_option
        || ""
      )
        .trim()
        .toUpperCase();

    if (/^[A-D]$/.test(selected)) {
      qsResolutionState.selectedById.set(
        attempt.question_item_id,
        selected
      );

      if (
        attempt.result === "correct"
        || attempt.result === "wrong"
      ) {
        qsResolutionState.confirmedById.add(
          attempt.question_item_id
        );
      }
    }
  });

  loadErrorNotebookSkips();

  document.getElementById("qs-current-title").textContent =
    set.title;

  document.getElementById("qs-answer-panel").hidden =
    false;

  renderQuestions();
  renderSetHistory();

  setAnswerStatus("");

  document
    .getElementById("qs-answer-panel")
    .scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
}

function questionExcerpt(item) {
  const text =
    item.stem?.trim()
    || item.raw_text?.trim()
    || "Questão";

  if (text.length <= 145) return text;

  return `${text.slice(0, 142)}...`;
}

function availableSimulationImages() {
  const gallery =
    (qsState.imageGallery || [])
      .filter(
        item =>
          item.image_path
          && item.image_url
      );

  if (
    gallery.length
  ) {
    return gallery;
  }

  /*
    Compatibilidade com simulados antigos que tinham
    apenas uma imagem em question_items.image_path.
  */
  return qsState.items
    .filter(
      item =>
        item.image_path
        && item.image_url
    )
    .map(
      (item) => ({
        id:
          `legacy-${item.id}`,
        question_number:
          item.question_number,
        image_path:
          item.image_path,
        image_url:
          item.image_url,
        source:
          "legacy",
        candidate_index:
          1
      })
    );
}


function imageSourceLabel(
  source
) {
  if (
    source === "text-gap"
  ) {
    return "Recorte por texto";
  }

  if (
    source === "embedded-image"
  ) {
    return "Imagem detectada";
  }

  if (
    source === "user-upload"
  ) {
    return "Adicionada por você";
  }

  return "Imagem";
}


async function uploadManualQuestionImages(
  item,
  files
) {
  if (
    !item
    || !qsState.currentSet?.id
    || !files?.length
  ) {
    return;
  }

  const imageFiles =
    Array.from(files)
      .filter(
        file =>
          file?.type
            ?.startsWith("image/")
      )
      .slice(
        0,
        1
      );

  if (!imageFiles.length) {
    setAnswerStatus(
      "Selecione uma imagem válida.",
      "error"
    );
    return;
  }

  const existingForQuestion =
    (qsState.imageGallery || [])
      .filter(
        candidate =>
          Number(candidate.question_number)
          === Number(item.question_number)
      );

  const existingManual =
    existingForQuestion.find(
      candidate =>
        candidate.source
        === "user-upload"
    );

  if (
    existingManual
  ) {
    setAnswerStatus(
      "Esta questão já possui uma imagem adicionada manualmente.",
      "error"
    );

    return;
  }

  let nextIndex =
    existingForQuestion.reduce(
      (max, candidate) =>
        Math.max(
          max,
          Number(candidate.candidate_index || 0)
        ),
      0
    ) + 1;

  let lastUploadedPath = null;

  for (const file of imageFiles) {
    setAnswerStatus(
      "Compactando imagem da questão "
      + item.question_number
      + "..."
    );

    const compressed =
      await compressQuestionFigureBlob(file);

    if (!compressed) {
      throw new Error(
        "Não foi possível processar a imagem."
      );
    }

    const extension =
      compressed.type === "image/png"
        ? "png"
        : compressed.type === "image/jpeg"
          ? "jpg"
          : "webp";

    const unique =
      Date.now()
      + "-"
      + Math.random().toString(36).slice(2, 8);

    const path =
      qsState.user.id
      + "/question_sets/"
      + qsState.currentSet.id
      + "/images/question-"
      + item.question_number
      + "-manual-"
      + nextIndex
      + "-"
      + unique
      + "."
      + extension;

    setAnswerStatus(
      "Enviando imagem da questão "
      + item.question_number
      + "..."
    );

    const { error: uploadError } =
      await qsSb
        .storage
        .from("docmap")
        .upload(
          path,
          compressed,
          {
            contentType:
              compressed.type
              || "image/webp",
            upsert: false
          }
        );

    if (uploadError) {
      throw uploadError;
    }

    const {
      data: inserted,
      error: insertError
    } =
      await qsSb
        .from("question_image_candidates")
        .insert({
          user_id: qsState.user.id,
          set_id: qsState.currentSet.id,
          question_number:
            Number(item.question_number),
          image_path: path,
          source: "user-upload",
          candidate_index: nextIndex
        })
        .select("*")
        .single();

    if (insertError) {
      await qsSb
        .storage
        .from("docmap")
        .remove([path]);

      throw insertError;
    }

    const signedRows =
      await attachGalleryImageUrls([inserted]);

    const signed =
      signedRows?.[0];

    if (signed) {
      qsState.imageGallery.push(signed);

      qsState.imageGallery.sort(
        (a, b) =>
          Number(a.question_number || 0)
          - Number(b.question_number || 0)
          ||
          Number(a.candidate_index || 0)
          - Number(b.candidate_index || 0)
      );
    }

    lastUploadedPath = path;
    nextIndex += 1;
  }

  if (lastUploadedPath) {
    qsState.imageSelections.set(
      item.id,
      lastUploadedPath
    );
  }

  setAnswerStatus(
    "Imagem adicionada e compactada para menos de 130 KB.",
    "success"
  );

  refreshErrorImagePicker(item.id);
}

function renderErrorImagePicker(
  item
) {
  const images =
    availableSimulationImages();

  if (!images.length) {
    return `
      <div class="qs-error-image-picker full">
        <div class="qs-error-image-picker-head">
          <div>
            <strong>Imagem para o Caderno de Erros</strong>
            <small>Nenhuma imagem detectada. Você pode adicionar uma imagem por conta própria.</small>
          </div>

          <label class="qs-manual-image-button">
            Adicionar imagem
            <input
              type="file"
              accept="image/*"
                            data-manual-question-image="${qsEscape(item.id)}"
            >
          </label>
        </div>
      </div>
    `;
  }

  const selectedPath =
    qsState.imageSelections.get(
      item.id
    )
    || "";

  const groups =
    new Map();

  for (
    const galleryItem
    of images
  ) {
    const number =
      Number(
        galleryItem.question_number
      );

    if (
      !groups.has(
        number
      )
    ) {
      groups.set(
        number,
        []
      );
    }

    groups
      .get(
        number
      )
      .push(
        galleryItem
      );
  }

  const groupedHtml =
    Array.from(
      groups.entries()
    )
      .sort(
        (
          a,
          b
        ) =>
          a[0] - b[0]
      )
      .map(
        (
          [
            questionNumber,
            questionImages
          ]
        ) => `
          <section class="qs-error-image-group">
            <div class="qs-error-image-group-title">
              <strong>Imagens questão ${questionNumber}</strong>
              <small>${questionImages.length} candidato${questionImages.length === 1 ? "" : "s"}</small>
            </div>

            <div class="qs-error-image-gallery">
              ${
                questionImages
                  .map(
                    (
                      galleryItem,
                      galleryIndex
                    ) => {
                      const selected =
                        selectedPath
                          === galleryItem.image_path;

                      return `
                        <button
                          class="qs-error-image-option ${selected ? "selected" : ""}"
                          type="button"
                          data-error-image-select="${qsEscape(item.id)}"
                          data-image-path="${qsEscape(galleryItem.image_path)}"
                          aria-pressed="${selected ? "true" : "false"}"
                          title="Selecionar imagem ${galleryIndex + 1} da questão ${questionNumber}"
                        >
                          <img
                            src="${qsEscape(galleryItem.image_url)}"
                            alt="Imagem ${galleryIndex + 1} da questão ${questionNumber}"
                            loading="lazy"
                          >

                          <span>
                            Imagem ${galleryIndex + 1}
                          </span>

                          <small>
                            ${qsEscape(imageSourceLabel(galleryItem.source))}
                            · ${selected ? "Selecionada" : "Selecionar"}
                          </small>
                        </button>
                      `;
                    }
                  )
                  .join("")
              }
            </div>
          </section>
        `
      )
      .join("");

  return `
    <div class="qs-error-image-picker full">
      <div class="qs-error-image-picker-head">
        <div>
          <strong>Imagem para o Caderno de Erros</strong>
          <small>
            Escolha livremente entre todos os recortes detectados. O LURIA mantém inclusive imagens repetidas, ruins ou sobrepostas para você decidir.
          </small>
        </div>

        <div class="qs-error-image-picker-actions">
          <label class="qs-manual-image-button">
            Adicionar imagem
            <input
              type="file"
              accept="image/*"
                            data-manual-question-image="${qsEscape(item.id)}"
            >
          </label>

          ${
            selectedPath
              ? `
                <button
                  class="qs-clear-error-image"
                  type="button"
                  data-clear-error-image="${qsEscape(item.id)}"
                >
                  Remover seleção
                </button>
              `
              : ""
          }
        </div>
      </div>

      <div
        class="qs-error-image-groups"
        data-error-image-gallery="${qsEscape(item.id)}"
      >
        ${groupedHtml}
      </div>

      <p class="qs-error-image-note">
        A galeria fica disponível até o envio dos erros ao Caderno. A imagem selecionada é copiada antes da limpeza.
      </p>
    </div>
  `;
}


function refreshErrorImagePicker(
  itemId
) {
  const card =
    document.querySelector(
      `[data-question-id="${CSS.escape(itemId)}"]`
    );

  if (!card) {
    return;
  }

  const target =
    card.querySelector(
      ".qs-error-image-picker"
    );

  const item =
    qsState.items.find(
      (candidate) =>
        candidate.id === itemId
    );

  if (
    !target
    || !item
  ) {
    return;
  }

  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.innerHTML =
    renderErrorImagePicker(
      item
    );

  target.replaceWith(
    wrapper.firstElementChild
  );

  bindErrorImagePickerEvents(
    card
  );
}


function bindErrorImagePickerEvents(
  scope = document
) {
  scope
    .querySelectorAll(
      "[data-error-image-select]"
    )
    .forEach(
      (button) => {
        if (
          button.dataset.boundImagePicker
          === "1"
        ) {
          return;
        }

        button.dataset.boundImagePicker =
          "1";

        button.addEventListener(
          "click",
          () => {
            const itemId =
              button.dataset
                .errorImageSelect;

            const imagePath =
              button.dataset
                .imagePath;

            const current =
              qsState
                .imageSelections
                .get(
                  itemId
                );

            if (
              current === imagePath
            ) {
              qsState
                .imageSelections
                .delete(
                  itemId
                );
            } else {
              qsState
                .imageSelections
                .set(
                  itemId,
                  imagePath
                );
            }

            refreshErrorImagePicker(
              itemId
            );
          }
        );
      }
    );

  scope
    .querySelectorAll(
      "[data-manual-question-image]"
    )
    .forEach(
      input => {
        if (
          input.dataset.boundManualQuestionImage
          === "1"
        ) {
          return;
        }

        input.dataset.boundManualQuestionImage =
          "1";

        input.addEventListener(
          "change",
          async () => {
            const itemId =
              input.dataset.manualQuestionImage;

            const item =
              qsState.items.find(
                candidate =>
                  candidate.id === itemId
              );

            if (
              !item
              || !input.files?.length
            ) {
              input.value = "";
              return;
            }

            input.disabled = true;

            try {
              await uploadManualQuestionImages(
                item,
                input.files
              );
            } catch (error) {
              console.error(error);

              setAnswerStatus(
                error.message
                || "Não foi possível adicionar a imagem.",
                "error"
              );
            } finally {
              input.value = "";
              input.disabled = false;
            }
          }
        );
      }
    );

  scope
    .querySelectorAll(
      "[data-clear-error-image]"
    )
    .forEach(
      (button) => {
        if (
          button.dataset.boundClearImage
          === "1"
        ) {
          return;
        }

        button.dataset.boundClearImage =
          "1";

        button.addEventListener(
          "click",
          () => {
            const itemId =
              button.dataset
                .clearErrorImage;

            qsState
              .imageSelections
              .delete(
                itemId
              );

            refreshErrorImagePicker(
              itemId
            );
          }
        );
      }
    );
}


function releaseAnswerScreenshotSourceFiles() {
  /*
    Os prints do gabarito nunca são enviados ao Supabase.
    Após a tentativa de leitura, descartamos os arquivos
    originais e Object URLs, mas preservamos o resultado
    reconhecido para o usuário revisar/aplicar.
  */
  for (
    const url
    of qsState.answerScreenshotUrls
  ) {
    try {
      URL.revokeObjectURL(
        url
      );
    } catch {}
  }


  qsState.answerScreenshotFiles =
    [];


  qsState.answerScreenshotUrls =
    [];


  const input =
    document.getElementById(
      "qs-answer-screenshot-files"
    );


  if (
    input
  ) {
    input.value =
      "";
  }


  const preview =
    document.getElementById(
      "qs-answer-screenshot-preview"
    );


  if (
    preview
  ) {
    preview.innerHTML =
      "";
  }
}


function clearAnswerScreenshotMemory() {
  for (
    const url
    of qsState.answerScreenshotUrls
  ) {
    try {
      URL.revokeObjectURL(
        url
      );
    } catch {}
  }

  qsState.answerScreenshotFiles =
    [];

  qsState.answerScreenshotUrls =
    [];

  qsState.answerImportRows =
    [];

  const input =
    document.getElementById(
      "qs-answer-screenshot-files"
    );

  if (input) {
    input.value = "";
  }

  const preview =
    document.getElementById(
      "qs-answer-screenshot-preview"
    );

  if (preview) {
    preview.innerHTML = "";
  }

  const table =
    document.getElementById(
      "qs-answer-import-table"
    );

  if (table) {
    table.innerHTML = "";
  }

  const applyButton =
    document.getElementById(
      "qs-apply-answer-import"
    );

  if (applyButton) {
    applyButton.disabled =
      true;
  }
}


function setAnswerImportStatus(
  message,
  type = ""
) {
  const element =
    document.getElementById(
      "qs-answer-import-status"
    );

  if (!element) {
    return;
  }

  element.textContent =
    message || "";

  element.className =
    `qs-status ${
      type
        ? type
        : ""
    }`;
}



/* =========================================================
   LEITOR DE GABARITO POR NÚMERO + COR
   ---------------------------------------------------------
   Fluxo:
   1. OCR procura APENAS a numeração das questões.
   2. Depois de localizar cada número, analisa a cor ao redor.
   3. Verde    = acerto
      Vermelho = erro
      Branco   = anulada
   4. Azul/amarelo = questão selecionada -> pedir conferência.
   5. Não procura A/B/C/D/E no print.
   ========================================================= */


function extractQuestionNumbersFromOcr(
  ocrData,
  expectedNumbers
) {
  const words =
    ocrData?.words
    || [];

  const candidates =
    [];

  for (
    const word
    of words
  ) {
    const raw =
      String(
        word.text
        || ""
      )
        .trim();

    /*
      O leitor de print aceita somente números.
      Letras, alternativas e palavras são ignoradas.
    */
    const cleaned =
      raw.replace(
        /[^\d]/g,
        ""
      );

    if (
      !cleaned
      || cleaned.length > 3
    ) {
      continue;
    }

    /*
      Evita aceitar textos longos que apenas
      contenham algum algarismo.
    */
    if (
      raw.length
      > cleaned.length + 2
    ) {
      continue;
    }

    const number =
      Number(
        cleaned
      );

    if (
      !Number.isInteger(
        number
      )
      || !expectedNumbers.has(
        number
      )
    ) {
      continue;
    }

    const bbox =
      word.bbox;

    if (
      !bbox
      || !Number.isFinite(
        Number(
          bbox.x0
        )
      )
      || !Number.isFinite(
        Number(
          bbox.y0
        )
      )
      || !Number.isFinite(
        Number(
          bbox.x1
        )
      )
      || !Number.isFinite(
        Number(
          bbox.y1
        )
      )
    ) {
      continue;
    }

    const width =
      Math.max(
        1,
        Number(
          bbox.x1
        )
        - Number(
            bbox.x0
          )
      );

    const height =
      Math.max(
        1,
        Number(
          bbox.y1
        )
        - Number(
            bbox.y0
          )
      );

    /*
      Filtra ruído minúsculo, mas mantém números
      pequenos em screenshots compactos.
    */
    if (
      width < 3
      || height < 5
    ) {
      continue;
    }

    candidates.push({
      question_number:
        number,

      confidence:
        Number(
          word.confidence
          || 0
        ),

      bbox: {
        x0:
          Number(
            bbox.x0
          ),

        y0:
          Number(
            bbox.y0
          ),

        x1:
          Number(
            bbox.x1
          ),

        y1:
          Number(
            bbox.y1
          )
      }
    });
  }

  /*
    Se um mesmo número aparecer mais de uma vez,
    conserva a leitura de maior confiança.
  */
  const best =
    new Map();

  for (
    const item
    of candidates
  ) {
    const previous =
      best.get(
        item.question_number
      );

    if (
      !previous
      || item.confidence
        > previous.confidence
    ) {
      best.set(
        item.question_number,
        item
      );
    }
  }

  return Array.from(
    best.values()
  )
    .sort(
      (a, b) =>
        a.question_number
        - b.question_number
    );
}


function createInvertedNumberOcrCanvas(
  source
) {
  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    source.width;

  canvas.height =
    source.height;

  const input =
    source.getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
    );

  const output =
    canvas.getContext(
      "2d",
      {
        alpha: false,
        willReadFrequently:
          true
      }
    );

  const image =
    input.getImageData(
      0,
      0,
      source.width,
      source.height
    );

  const data =
    image.data;

  /*
    Passagem invertida:
    ajuda o OCR a ler algarismos brancos
    desenhados sobre círculos verdes/vermelhos.
  */
  for (
    let i = 0;
    i < data.length;
    i += 4
  ) {
    data[i] =
      255 - data[i];

    data[i + 1] =
      255 - data[i + 1];

    data[i + 2] =
      255 - data[i + 2];

    data[i + 3] =
      255;
  }

  output.putImageData(
    image,
    0,
    0
  );

  return canvas;
}


function mergeNumberOcrDetections(
  first,
  second
) {
  const best =
    new Map();

  for (
    const item
    of [
      ...(first || []),
      ...(second || [])
    ]
  ) {
    const previous =
      best.get(
        item.question_number
      );

    if (
      !previous
      || Number(
          item.confidence
          || 0
        )
        > Number(
            previous.confidence
            || 0
          )
    ) {
      best.set(
        item.question_number,
        item
      );
    }
  }

  return Array.from(
    best.values()
  )
    .sort(
      (a, b) =>
        a.question_number
        - b.question_number
    );
}


function answerPixelClass(
  red,
  green,
  blue
) {
  const r =
    Number(red);

  const g =
    Number(green);

  const b =
    Number(blue);

  const max =
    Math.max(
      r,
      g,
      b
    );

  const min =
    Math.min(
      r,
      g,
      b
    );

  const chroma =
    max - min;


  /* Verde saturado: ex. #22C55E */
  if (
    g >= 120
    && (
      g - r >= 25
      || g >= r * 1.22
    )
    && g - b >= 12
  ) {
    return "green";
  }


  /* Vermelho saturado: ex. #EF4444 */
  if (
    r >= 150
    && r - g >= 35
    && r - b >= 28
  ) {
    return "red";
  }


  /* Azul de seleção: ex. #3B82F6 */
  if (
    b >= 135
    && b - r >= 28
    && b - g >= 12
  ) {
    return "blue";
  }


  /*
    Amarelo / creme usado pelo botão selecionado.
    Deve ser reconhecido ANTES de branco.
  */
  if (
    r >= 225
    && g >= 200
    && b >= 135
    && b <= 238
    && r - b >= 14
  ) {
    return "yellow";
  }


  if (
    r >= 228
    && g >= 228
    && b >= 228
    && chroma <= 24
  ) {
    return "white";
  }


  if (
    chroma <= 28
    && r >= 65
    && r <= 228
  ) {
    return "gray";
  }


  if (
    r <= 80
    && g <= 80
    && b <= 80
  ) {
    return "dark";
  }


  return "other";
}


function samplePixelClass(
  context,
  x,
  y,
  width,
  height
) {
  const px =
    Math.max(
      0,
      Math.min(
        width - 1,
        Math.round(x)
      )
    );

  const py =
    Math.max(
      0,
      Math.min(
        height - 1,
        Math.round(y)
      )
    );

  const data =
    context.getImageData(
      px,
      py,
      1,
      1
    ).data;

  return answerPixelClass(
    data[0],
    data[1],
    data[2]
  );
}


function circularBorderScore(
  context,
  centerX,
  centerY,
  minRadius,
  maxRadius,
  width,
  height,
  acceptedClasses
) {
  let best =
    0;

  const start =
    Math.max(
      5,
      Math.floor(
        minRadius
      )
    );

  const end =
    Math.max(
      start,
      Math.ceil(
        maxRadius
      )
    );

  const radiusStep =
    Math.max(
      1,
      Math.floor(
        (
          end - start
        )
        / 10
      )
    );

  for (
    let radius = start;
    radius <= end;
    radius += radiusStep
  ) {
    let hits =
      0;

    let samples =
      0;

    for (
      let degree = 0;
      degree < 360;
      degree += 6
    ) {
      const angle =
        degree
        * Math.PI
        / 180;

      const x =
        centerX
        + Math.cos(
            angle
          )
          * radius;

      const y =
        centerY
        + Math.sin(
            angle
          )
          * radius;

      if (
        x < 0
        || y < 0
        || x >= width
        || y >= height
      ) {
        continue;
      }

      const cls =
        samplePixelClass(
          context,
          x,
          y,
          width,
          height
        );

      samples +=
        1;

      if (
        acceptedClasses.has(
          cls
        )
      ) {
        hits +=
          1;
      }
    }

    if (samples) {
      best =
        Math.max(
          best,
          hits / samples
        );
    }
  }

  return best;
}


function analyzeAnswerColorAroundNumber(
  canvas,
  bbox
) {
  const context =
    canvas.getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
    );

  const centerX =
    (
      Number(
        bbox.x0
      )
      + Number(
          bbox.x1
        )
    ) / 2;

  const centerY =
    (
      Number(
        bbox.y0
      )
      + Number(
          bbox.y1
        )
    ) / 2;

  const textWidth =
    Math.max(
      5,
      Number(
        bbox.x1
      )
      - Number(
          bbox.x0
        )
    );

  const textHeight =
    Math.max(
      7,
      Number(
        bbox.y1
      )
      - Number(
          bbox.y0
        )
    );

  /*
    O círculo é maior que o caractere.
    O limite evita engolir círculos vizinhos.
  */
  const radius =
    Math.max(
      16,
      Math.min(
        58,
        Math.max(
          textHeight * 2.15,
          textWidth * 1.55
        )
      )
    );

  const innerRadius =
    Math.max(
      4,
      Math.min(
        textHeight,
        textWidth
      ) * 0.45
    );

  const left =
    Math.max(
      0,
      Math.floor(
        centerX - radius
      )
    );

  const top =
    Math.max(
      0,
      Math.floor(
        centerY - radius
      )
    );

  const right =
    Math.min(
      canvas.width,
      Math.ceil(
        centerX + radius
      )
    );

  const bottom =
    Math.min(
      canvas.height,
      Math.ceil(
        centerY + radius
      )
    );

  const width =
    Math.max(
      1,
      right - left
    );

  const height =
    Math.max(
      1,
      bottom - top
    );

  const image =
    context.getImageData(
      left,
      top,
      width,
      height
    );

  const counts = {
    green: 0,
    red: 0,
    blue: 0,
    yellow: 0,
    white: 0,
    gray: 0,
    dark: 0,
    other: 0
  };

  let sampled =
    0;

  /*
    Analisa uma coroa em volta do número.
    O centro do caractere é ignorado para
    o branco/preto do próprio número não
    distorcer a cor do botão.
  */
  for (
    let y = 0;
    y < height;
    y += 1
  ) {
    for (
      let x = 0;
      x < width;
      x += 1
    ) {
      const globalX =
        left + x;

      const globalY =
        top + y;

      const dx =
        globalX - centerX;

      const dy =
        globalY - centerY;

      const distance =
        Math.sqrt(
          dx * dx
          + dy * dy
        );

      if (
        distance > radius
        || distance < innerRadius
      ) {
        continue;
      }

      const offset =
        (
          y * width
          + x
        ) * 4;

      const cls =
        answerPixelClass(
          image.data[
            offset
          ],
          image.data[
            offset + 1
          ],
          image.data[
            offset + 2
          ]
        );

      counts[
        cls
      ] +=
        1;

      sampled +=
        1;
    }
  }

  const total =
    Math.max(
      1,
      sampled
    );

  const ratio =
    key =>
      counts[key]
      / total;

  const greenRatio =
    ratio(
      "green"
    );

  const redRatio =
    ratio(
      "red"
    );

  const blueRatio =
    ratio(
      "blue"
    );

  const yellowRatio =
    ratio(
      "yellow"
    );

  const whiteRatio =
    ratio(
      "white"
    );

  const selectedRatio =
    blueRatio
    + yellowRatio;

  /*
    Uma questão branca/anulada pode ter o mesmo
    fundo branco da página. Por isso exigimos
    uma borda circular cinza em volta do número.
  */
  const grayRing =
    circularBorderScore(
      context,
      centerX,
      centerY,
      Math.max(
        textHeight * 1.0,
        8
      ),
      radius * 0.92,
      canvas.width,
      canvas.height,
      new Set([
        "gray"
      ])
    );

  const blueRing =
    circularBorderScore(
      context,
      centerX,
      centerY,
      Math.max(
        textHeight * 1.0,
        8
      ),
      radius * 0.92,
      canvas.width,
      canvas.height,
      new Set([
        "blue"
      ])
    );


  if (
    greenRatio >= 0.13
    && greenRatio
      > redRatio * 1.25
  ) {
    return {
      color:
        "green",

      result:
        "correct",

      confidence:
        Math.min(
          1,
          greenRatio / 0.34
        )
    };
  }


  if (
    redRatio >= 0.13
    && redRatio
      > greenRatio * 1.25
  ) {
    return {
      color:
        "red",

      result:
        "wrong",

      confidence:
        Math.min(
          1,
          redRatio / 0.34
        )
    };
  }


  /*
    Azul/amarelo significa apenas que a questão
    está selecionada na plataforma de origem.
    Não inferimos acerto, erro ou anulação.
  */
  if (
    selectedRatio >= 0.035
    || blueRing >= 0.14
  ) {
    return {
      color:
        "selected",

      result:
        null,

      confidence:
        Math.min(
          1,
          Math.max(
            selectedRatio / 0.14,
            blueRing / 0.35
          )
        )
    };
  }


  /*
    Branco = anulada, mas somente quando há
    evidência de uma bolinha/círculo delimitado.
    Isso evita considerar qualquer número solto
    no fundo branco como questão anulada.
  */
  if (
    whiteRatio >= 0.43
    && grayRing >= 0.10
  ) {
    return {
      color:
        "white",

      result:
        "annulled",

      confidence:
        Math.min(
          1,
          (
            whiteRatio
            + grayRing
          )
          / 1.05
        )
    };
  }


  return {
    color:
      "unknown",

    result:
      null,

    confidence:
      Math.min(
        1,
        Math.max(
          greenRatio,
          redRatio,
          selectedRatio,
          grayRing
        )
      )
  };
}




/* =========================================================
   LEITOR DE GABARITO — FORMAS PRIMEIRO
   ---------------------------------------------------------
   Fluxo novo:
   1. Detecta bolinhas/quadradinhos pela geometria e cor.
   2. Classifica verde/vermelho/branco/selecionada.
   3. Recorta CADA forma e tenta OCR somente do número.
   4. Se o número falhar, deduz a sequência pela ordem visual.
   5. Não procura A/B/C/D/E em nenhum momento.
   ========================================================= */


function answerMedianNumber(
  values
) {
  const clean =
    (values || [])
      .map(Number)
      .filter(
        value =>
          Number.isFinite(
            value
          )
      )
      .sort(
        (a, b) =>
          a - b
      );

  if (!clean.length) {
    return 0;
  }

  const middle =
    Math.floor(
      clean.length / 2
    );

  return clean.length % 2
    ? clean[middle]
    : (
        clean[middle - 1]
        + clean[middle]
      ) / 2;
}


function answerShapePixelCode(
  red,
  green,
  blue
) {
  const r = Number(red);
  const g = Number(green);
  const b = Number(blue);

  const max =
    Math.max(
      r,
      g,
      b
    );

  const min =
    Math.min(
      r,
      g,
      b
    );

  const chroma =
    max - min;

  /* Verde = acerto */
  if (
    g >= 110
    && (
      g - r >= 20
      || g >= r * 1.18
    )
    && g - b >= 8
  ) {
    return 1;
  }

  /* Vermelho = erro */
  if (
    r >= 140
    && r - g >= 28
    && r - b >= 20
  ) {
    return 2;
  }

  /* Azul = borda/estado selecionado */
  if (
    b >= 125
    && b - r >= 22
    && b - g >= 8
  ) {
    return 3;
  }

  /* Amarelo/creme = interior selecionado */
  if (
    r >= 215
    && g >= 185
    && b >= 115
    && b <= 242
    && r - b >= 10
  ) {
    return 4;
  }

  /*
    Cinza neutro usado nas bordas de bolinhas brancas.
    Branco puro da página NÃO entra.
  */
  if (
    chroma <= 24
    && r >= 95
    && r <= 246
  ) {
    return 5;
  }

  return 0;
}


function answerShapeInteriorIsWhite(
  canvas,
  component
) {
  const context =
    canvas.getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
    );

  const insetX =
    Math.max(
      2,
      Math.round(
        component.width * 0.20
      )
    );

  const insetY =
    Math.max(
      2,
      Math.round(
        component.height * 0.20
      )
    );

  const left =
    Math.max(
      0,
      component.left + insetX
    );

  const top =
    Math.max(
      0,
      component.top + insetY
    );

  const right =
    Math.min(
      canvas.width - 1,
      component.right - insetX
    );

  const bottom =
    Math.min(
      canvas.height - 1,
      component.bottom - insetY
    );

  if (
    right <= left
    || bottom <= top
  ) {
    return false;
  }

  const image =
    context.getImageData(
      left,
      top,
      right - left + 1,
      bottom - top + 1
    );

  let light =
    0;

  let sampled =
    0;

  for (
    let index = 0;
    index < image.data.length;
    index += 16
  ) {
    const r =
      image.data[index];

    const g =
      image.data[index + 1];

    const b =
      image.data[index + 2];

    const max =
      Math.max(
        r,
        g,
        b
      );

    const min =
      Math.min(
        r,
        g,
        b
      );

    if (
      r >= 220
      && g >= 220
      && b >= 220
      && max - min <= 28
    ) {
      light +=
        1;
    }

    sampled +=
      1;
  }

  return (
    sampled > 0
    && light / sampled >= 0.42
  );
}


function detectAnswerShapeComponents(
  canvas
) {
  const context =
    canvas.getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
    );

  const width =
    canvas.width;

  const height =
    canvas.height;

  const image =
    context.getImageData(
      0,
      0,
      width,
      height
    );

  const mask =
    new Uint8Array(
      width * height
    );

  for (
    let pixel = 0;
    pixel < width * height;
    pixel += 1
  ) {
    const offset =
      pixel * 4;

    mask[pixel] =
      answerShapePixelCode(
        image.data[offset],
        image.data[offset + 1],
        image.data[offset + 2]
      );
  }

  const minDimension =
    Math.min(
      width,
      height
    );

  const minSide =
    Math.max(
      10,
      Math.floor(
        minDimension * 0.012
      )
    );

  const maxSide =
    Math.max(
      86,
      Math.floor(
        minDimension * 0.31
      )
    );

  const components =
    [];

  for (
    let start = 0;
    start < mask.length;
    start += 1
  ) {
    const code =
      mask[start];

    if (!code) {
      continue;
    }

    const stack = [
      start
    ];

    mask[start] =
      0;

    let count =
      0;

    let minX =
      width;

    let maxX =
      0;

    let minY =
      height;

    let maxY =
      0;

    while (
      stack.length
    ) {
      const current =
        stack.pop();

      const y =
        Math.floor(
          current / width
        );

      const x =
        current
        - y * width;

      count +=
        1;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      for (
        let dy = -1;
        dy <= 1;
        dy += 1
      ) {
        for (
          let dx = -1;
          dx <= 1;
          dx += 1
        ) {
          if (
            dx === 0
            && dy === 0
          ) {
            continue;
          }

          const nx =
            x + dx;

          const ny =
            y + dy;

          if (
            nx < 0
            || ny < 0
            || nx >= width
            || ny >= height
          ) {
            continue;
          }

          const next =
            ny * width
            + nx;

          if (
            mask[next]
            === code
          ) {
            mask[next] =
              0;

            stack.push(
              next
            );
          }
        }
      }
    }

    const componentWidth =
      maxX - minX + 1;

    const componentHeight =
      maxY - minY + 1;

    const ratio =
      componentWidth
      / Math.max(
          1,
          componentHeight
        );

    const fill =
      count
      / Math.max(
          1,
          componentWidth
          * componentHeight
        );

    if (
      componentWidth < minSide
      || componentHeight < minSide
      || componentWidth > maxSide
      || componentHeight > maxSide
      || ratio < 0.52
      || ratio > 1.90
    ) {
      continue;
    }

    /*
      Formas coloridas são preenchidas.
      A anulada branca aparece principalmente como borda,
      então aceita preenchimento bem menor.
    */
    if (
      code === 5
    ) {
      if (
        fill < 0.012
        || fill > 0.48
      ) {
        continue;
      }
    } else if (
      fill < 0.14
    ) {
      continue;
    }

    const component = {
      left:
        minX,

      top:
        minY,

      right:
        maxX,

      bottom:
        maxY,

      width:
        componentWidth,

      height:
        componentHeight,

      centerX:
        (
          minX
          + maxX
        ) / 2,

      centerY:
        (
          minY
          + maxY
        ) / 2,

      code,

      fill
    };

    if (
      code === 5
      && !answerShapeInteriorIsWhite(
        canvas,
        component
      )
    ) {
      continue;
    }

    component.color_status =
      code === 1
        ? "green"
        : code === 2
          ? "red"
          : code === 5
            ? "white"
            : "selected";

    component.status_hint =
      code === 1
        ? "correct"
        : code === 2
          ? "wrong"
          : code === 5
            ? "annulled"
            : null;

    components.push(
      component
    );
  }

  return components;
}


function detectAnswerShapesByGeometry(
  canvas
) {
  const components =
    detectAnswerShapeComponents(
      canvas
    );

  if (
    !components.length
  ) {
    return [];
  }

  /*
    Primeiro calcula o tamanho típico usando as formas
    preenchidas, que são muito mais confiáveis.
  */
  const strong =
    components.filter(
      item =>
        item.code !== 5
    );

  const typicalSide =
    answerMedianNumber(
      (
        strong.length
          ? strong
          : components
      )
        .map(
          item =>
            (
              item.width
              + item.height
            ) / 2
        )
    );

  let filtered =
    components.filter(
      item => {
        if (
          !typicalSide
        ) {
          return true;
        }

        const side =
          (
            item.width
            + item.height
          ) / 2;

        return (
          side >= typicalSide * 0.58
          && side <= typicalSide * 1.55
        );
      }
    );

  /*
    Azul + amarelo da questão selecionada podem formar
    dois componentes na mesma bolinha. Remove duplicados.
  */
  filtered =
    filtered
      .slice()
      .sort(
        (a, b) => {
          const priorityA =
            (
              a.code === 3
              || a.code === 4
            )
              ? 3
              : a.code === 5
                ? 1
                : 2;

          const priorityB =
            (
              b.code === 3
              || b.code === 4
            )
              ? 3
              : b.code === 5
                ? 1
                : 2;

          return (
            priorityB - priorityA
            ||
            (
              b.width
              * b.height
            )
            -
            (
              a.width
              * a.height
            )
          );
        }
      );

  const deduped =
    [];

  for (
    const candidate
    of filtered
  ) {
    const duplicate =
      deduped.some(
        existing => {
          const dx =
            existing.centerX
            - candidate.centerX;

          const dy =
            existing.centerY
            - candidate.centerY;

          const distance =
            Math.sqrt(
              dx * dx
              + dy * dy
            );

          const reference =
            Math.max(
              10,
              Math.min(
                existing.width,
                existing.height,
                candidate.width,
                candidate.height
              )
            );

          return (
            distance
            <= reference * 0.52
          );
        }
      );

    if (
      !duplicate
    ) {
      deduped.push(
        candidate
      );
    }
  }

  return deduped;
}


function sortAnswerShapesAsGrid(
  shapes
) {
  if (
    !shapes.length
  ) {
    return [];
  }

  const rowTolerance =
    Math.max(
      8,
      answerMedianNumber(
        shapes.map(
          item =>
            item.height
        )
      ) * 0.62
    );

  const rows =
    [];

  for (
    const shape
    of shapes
      .slice()
      .sort(
        (a, b) =>
          a.centerY
          - b.centerY
      )
  ) {
    let row =
      rows.find(
        candidate =>
          Math.abs(
            candidate.centerY
            - shape.centerY
          )
          <= rowTolerance
      );

    if (
      !row
    ) {
      row = {
        centerY:
          shape.centerY,

        shapes:
          []
      };

      rows.push(
        row
      );
    }

    row.shapes.push(
      shape
    );

    row.centerY =
      row.shapes.reduce(
        (
          sum,
          item
        ) =>
          sum
          + item.centerY,
        0
      )
      / row.shapes.length;
  }

  rows.sort(
    (a, b) =>
      a.centerY
      - b.centerY
  );

  return rows.flatMap(
    row =>
      row.shapes
        .sort(
          (a, b) =>
            a.centerX
            - b.centerX
        )
  );
}


function createAnswerDigitCrop(
  source,
  shape
) {
  const sourceContext =
    source.getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
    );

  const cropLeft =
    Math.max(
      0,
      Math.floor(
        shape.left
      )
    );

  const cropTop =
    Math.max(
      0,
      Math.floor(
        shape.top
      )
    );

  const cropRight =
    Math.min(
      source.width,
      Math.ceil(
        shape.right + 1
      )
    );

  const cropBottom =
    Math.min(
      source.height,
      Math.ceil(
        shape.bottom + 1
      )
    );

  const cropWidth =
    Math.max(
      1,
      cropRight - cropLeft
    );

  const cropHeight =
    Math.max(
      1,
      cropBottom - cropTop
    );

  const image =
    sourceContext.getImageData(
      cropLeft,
      cropTop,
      cropWidth,
      cropHeight
    );

  const outputSize =
    Math.max(
      140,
      Math.min(
        260,
        Math.round(
          Math.max(
            cropWidth,
            cropHeight
          ) * 4
        )
      )
    );

  const small =
    document.createElement(
      "canvas"
    );

  small.width =
    cropWidth;

  small.height =
    cropHeight;

  const smallContext =
    small.getContext(
      "2d",
      {
        alpha:
          false
      }
    );

  const output =
    smallContext.createImageData(
      cropWidth,
      cropHeight
    );

  const centerX =
    cropWidth / 2;

  const centerY =
    cropHeight / 2;

  const radiusX =
    Math.max(
      1,
      cropWidth * 0.42
    );

  const radiusY =
    Math.max(
      1,
      cropHeight * 0.42
    );

  for (
    let y = 0;
    y < cropHeight;
    y += 1
  ) {
    for (
      let x = 0;
      x < cropWidth;
      x += 1
    ) {
      const index =
        (
          y * cropWidth
          + x
        ) * 4;

      const r =
        image.data[index];

      const g =
        image.data[index + 1];

      const b =
        image.data[index + 2];

      const max =
        Math.max(
          r,
          g,
          b
        );

      const min =
        Math.min(
          r,
          g,
          b
        );

      const chroma =
        max - min;

      const luminance =
        (
          r * 0.299
          + g * 0.587
          + b * 0.114
        );

      const normalized =
        (
          (
            x - centerX
          )
          / radiusX
        ) ** 2
        +
        (
          (
            y - centerY
          )
          / radiusY
        ) ** 2;

      let digit =
        false;

      /*
        Só olha para a região central da forma.
        Assim o fundo branco externo não vira "número".
      */
      if (
        normalized <= 1.15
      ) {
        if (
          shape.color_status === "green"
          || shape.color_status === "red"
        ) {
          /*
            Números brancos sobre fundo saturado.
            Pixels quase neutros e claros = algarismo.
          */
          digit =
            luminance >= 145
            && chroma <= 105;
        }

        else {
          /*
            Número escuro em bolinha branca/amarela.
          */
          digit =
            luminance <= 170
            && chroma <= 105;
        }
      }

      const value =
        digit
          ? 0
          : 255;

      output.data[index] =
        value;

      output.data[index + 1] =
        value;

      output.data[index + 2] =
        value;

      output.data[index + 3] =
        255;
    }
  }

  smallContext.putImageData(
    output,
    0,
    0
  );

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    outputSize;

  canvas.height =
    outputSize;

  const context =
    canvas.getContext(
      "2d",
      {
        alpha:
          false
      }
    );

  context.fillStyle =
    "#ffffff";

  context.fillRect(
    0,
    0,
    outputSize,
    outputSize
  );

  const margin =
    Math.round(
      outputSize * 0.14
    );

  context.imageSmoothingEnabled =
    false;

  context.drawImage(
    small,
    margin,
    margin,
    outputSize - margin * 2,
    outputSize - margin * 2
  );

  return canvas;
}


function parseAnswerDigitText(
  value,
  expectedNumbers
) {
  const cleaned =
    String(
      value
      || ""
    )
      .replace(
        /[^0-9]/g,
        ""
      )
      .slice(
        0,
        3
      );

  if (
    !cleaned
  ) {
    return null;
  }

  const number =
    Number(
      cleaned
    );

  if (
    !Number.isInteger(
      number
    )
    || !expectedNumbers.has(
      number
    )
  ) {
    return null;
  }

  return number;
}


async function createAnswerDigitWorker() {
  if (
    !window.Tesseract
  ) {
    return null;
  }

  try {
    const worker =
      await window.Tesseract
        .createWorker(
          "eng"
        );

    await worker
      .setParameters({
        tessedit_char_whitelist:
          "0123456789",

        /*
          SINGLE_WORD: permite 1, 10, 20, 100 etc.
        */
        tessedit_pageseg_mode:
          "8"
      });

    return worker;

  } catch (
    error
  ) {
    console.warn(
      "Não foi possível iniciar OCR local de números:",
      error
    );

    return null;
  }
}


async function readNumberInsideAnswerShape(
  worker,
  canvas,
  shape,
  expectedNumbers
) {
  if (
    !worker
  ) {
    return null;
  }

  try {
    const crop =
      createAnswerDigitCrop(
        canvas,
        shape
      );

    const result =
      await worker.recognize(
        crop
      );

    const number =
      parseAnswerDigitText(
        result?.data?.text,
        expectedNumbers
      );

    if (
      !number
    ) {
      return null;
    }

    return {
      question_number:
        number,

      confidence:
        Number(
          result?.data?.confidence
          || 0
        )
    };

  } catch (
    error
  ) {
    console.warn(
      "Falha ao ler número dentro da forma:",
      error
    );

    return null;
  }
}


function answerSequenceOffsetFromAnchors(
  orderedShapes,
  expectedItems
) {
  const expectedIndex =
    new Map(
      expectedItems.map(
        (
          item,
          index
        ) => [
          Number(
            item.question_number
          ),
          index
        ]
      )
    );

  const scores =
    new Map();

  orderedShapes.forEach(
    (
      shape,
      shapeIndex
    ) => {
      const number =
        Number(
          shape.ocr_number
        );

      if (
        !expectedIndex.has(
          number
        )
      ) {
        return;
      }

      const offset =
        expectedIndex.get(
          number
        )
        - shapeIndex;

      const weight =
        Math.max(
          1,
          Number(
            shape.ocr_confidence
            || 0
          ) / 20
        );

      scores.set(
        offset,
        (
          scores.get(
            offset
          )
          || 0
        )
        + weight
      );
    }
  );

  if (
    !scores.size
  ) {
    return null;
  }

  return Array.from(
    scores.entries()
  )
    .sort(
      (
        a,
        b
      ) =>
        b[1] - a[1]
    )[0][0];
}


function buildAnswerDetectionsFromShapes(
  orderedShapes,
  expectedItems,
  sequenceStartIndex
) {
  let offset =
    answerSequenceOffsetFromAnchors(
      orderedShapes,
      expectedItems
    );

  let inferred =
    false;

  /*
    Se nenhum número foi legível:
    - usa o cursor dos prints anteriores;
    - no primeiro print, começa na primeira questão.
  */
  if (
    offset === null
  ) {
    offset =
      Math.max(
        0,
        Number(
          sequenceStartIndex
          || 0
        )
      );

    inferred =
      true;
  }

  const detections =
    [];

  orderedShapes.forEach(
    (
      shape,
      shapeIndex
    ) => {
      const itemIndex =
        offset
        + shapeIndex;

      const item =
        expectedItems[
          itemIndex
        ];

      /*
        Se a sequência estourou o simulado, ainda preserva
        eventual OCR local válido daquela forma.
      */
      const ocrItem =
        shape.ocr_number
          ? expectedItems.find(
              candidate =>
                Number(
                  candidate.question_number
                )
                === Number(
                    shape.ocr_number
                  )
            )
          : null;

      const resolved =
        item
        || ocrItem;

      if (
        !resolved
      ) {
        return;
      }

      detections.push({
        question_number:
          Number(
            resolved.question_number
          ),

        user_answer:
          null,

        status_hint:
          shape.status_hint,

        color_status:
          shape.color_status,

        confidence:
          shape.status_hint
            ? 1
            : 0.75,

        ocr_confidence:
          Number(
            shape.ocr_confidence
            || 0
          ),

        inferred_from_order:
          inferred
          || !shape.ocr_number
      });
    }
  );

  return {
    detections,

    offset,

    inferred,

    nextSequenceIndex:
      Math.min(
        expectedItems.length,
        Math.max(
          0,
          offset
        )
        + orderedShapes.length
      )
  };
}


async function recognizeAnswerGridByNumber(
  file,
  fileIndex,
  fileCount,
  sequenceStartIndex = 0
) {
  if (
    !window.Tesseract
  ) {
    throw new Error(
      "Leitor OCR não carregou. Atualize a página e tente novamente."
    );
  }

  setAnswerImportStatus(
    `Detectando bolinhas/quadradinhos — print ${fileIndex + 1} de ${fileCount}...`
  );

  const canvas =
    await prepareScreenshotForOcr(
      file
    );

  const expectedItems =
    [...qsState.items]
      .sort(
        (
          a,
          b
        ) =>
          Number(
            a.order_index
            || a.question_number
            || 0
          )
          -
          Number(
            b.order_index
            || b.question_number
            || 0
          )
      );

  const expectedNumbers =
    new Set(
      expectedItems.map(
        item =>
          Number(
            item.question_number
          )
      )
    );

  /*
    CAMINHO PRINCIPAL:
    não depende de OCR dos números.

    1. encontra bolinhas/quadradinhos;
    2. ordena da esquerda para a direita e de cima para baixo;
    3. aplica a sequência das questões;
    4. usa apenas a COR para definir acerto/erro/anulada.

    O OCR passa a ser apenas um fallback quando nenhuma forma
    é encontrada.
  */
  const orderedShapes =
    sortAnswerShapesAsGrid(
      detectAnswerShapesByGeometry(
        canvas
      )
    );

  if (
    orderedShapes.length
  ) {
    const remaining =
      Math.max(
        0,
        expectedItems.length
        - Math.max(
            0,
            Number(
              sequenceStartIndex
              || 0
            )
          )
      );

    /*
      Se por algum motivo apareceram mais formas que questões
      restantes, não inventamos uma sequência. Nesse caso,
      caímos no OCR global abaixo.
    */
    if (
      orderedShapes.length
      <= remaining
    ) {
      const mapped =
        buildAnswerDetectionsFromShapes(
          orderedShapes,
          expectedItems,
          sequenceStartIndex
        );

      if (
        mapped.detections.length
        === orderedShapes.length
      ) {
        setAnswerImportStatus(
          `${orderedShapes.length} bolinha(s)/quadradinho(s) reconhecido(s). Aplicando as cores pela ordem visual...`
        );

        return {
          detections:
            mapped.detections.map(
              item => ({
                ...item,

                /*
                  Marca explicitamente que a numeração veio
                  da posição da forma, não do OCR.
                */
                inferred_from_order:
                  true,

                ocr_confidence:
                  0
              })
            ),

          /*
            Para o restante da interface, cada forma mapeada
            equivale a uma questão localizada.
          */
          numberCount:
            mapped.detections.length,

          shapeCount:
            orderedShapes.length,

          inferredFromOrder:
            true,

          nextSequenceIndex:
            mapped.nextSequenceIndex
        };
      }
    }
  }


  /*
    FALLBACK 2:
    Se encontramos formas, mas a sequência não pôde ser fechada,
    tenta ler somente alguns números dentro delas para criar
    âncoras. Não é mais o caminho normal.
  */
  if (
    orderedShapes.length
  ) {
    setAnswerImportStatus(
      `Formas encontradas, mas preciso confirmar a sequência — print ${fileIndex + 1} de ${fileCount}...`
    );

    const worker =
      await createAnswerDigitWorker();

    if (
      worker
    ) {
      try {
        /*
          Lê no máximo três âncoras:
          primeira, meio e última forma.
          Isso é muito mais rápido e robusto que OCR em todas.
        */
        const anchorIndexes =
          Array.from(
            new Set([
              0,
              Math.floor(
                orderedShapes.length / 2
              ),
              orderedShapes.length - 1
            ])
          )
            .filter(
              index =>
                index >= 0
                && index < orderedShapes.length
            );

        for (
          const index
          of anchorIndexes
        ) {
          const shape =
            orderedShapes[index];

          const local =
            await readNumberInsideAnswerShape(
              worker,
              canvas,
              shape,
              expectedNumbers
            );

          if (
            local
          ) {
            shape.ocr_number =
              local.question_number;

            shape.ocr_confidence =
              local.confidence;
          }
        }
      } finally {
        try {
          await worker.terminate();
        } catch {
          /* sem ação */
        }
      }
    }

    const anchored =
      buildAnswerDetectionsFromShapes(
        orderedShapes,
        expectedItems,
        sequenceStartIndex
      );

    if (
      anchored.detections.length
      === orderedShapes.length
    ) {
      setAnswerImportStatus(
        `Sequência confirmada pelas bolinhas — print ${fileIndex + 1} de ${fileCount}...`
      );

      return {
        detections:
          anchored.detections,

        numberCount:
          anchored.detections.length,

        shapeCount:
          orderedShapes.length,

        inferredFromOrder:
          true,

        nextSequenceIndex:
          anchored.nextSequenceIndex
      };
    }
  }


  /*
    ÚLTIMO fallback:
    só chega aqui se NÃO foi possível resolver pelas formas.
    Tenta OCR global apenas dos números e analisa a cor ao redor.
  */
  setAnswerImportStatus(
    `Não consegui fechar a grade por formas. Tentando OCR global — print ${fileIndex + 1} de ${fileCount}...`
  );

  const originalResult =
    await window.Tesseract
      .recognize(
        canvas,
        "eng"
      );

  let detectedNumbers =
    extractQuestionNumbersFromOcr(
      originalResult?.data,
      expectedNumbers
    );

  if (
    detectedNumbers.length
    < Math.max(
        2,
        Math.ceil(
          expectedNumbers.size
          * 0.50
        )
      )
  ) {
    const inverted =
      createInvertedNumberOcrCanvas(
        canvas
      );

    const invertedResult =
      await window.Tesseract
        .recognize(
          inverted,
          "eng"
        );

    detectedNumbers =
      mergeNumberOcrDetections(
        detectedNumbers,
        extractQuestionNumbersFromOcr(
          invertedResult?.data,
          expectedNumbers
        )
      );
  }

  const detections =
    detectedNumbers.map(
      numberData => {
        const color =
          analyzeAnswerColorAroundNumber(
            canvas,
            numberData.bbox
          );

        return {
          question_number:
            numberData.question_number,

          user_answer:
            null,

          status_hint:
            color.result,

          color_status:
            color.color,

          confidence:
            color.confidence,

          ocr_confidence:
            Number(
              numberData.confidence
              || 0
            ),

          inferred_from_order:
            false
        };
      }
    );

  return {
    detections,

    numberCount:
      detectedNumbers.length,

    shapeCount:
      orderedShapes.length,

    inferredFromOrder:
      false,

    nextSequenceIndex:
      sequenceStartIndex
  };
}


async function prepareScreenshotForOcr(
  file
) {
  const bitmap =
    await createImageBitmap(
      file
    );

  const maxSide =
    2600;

  const scale =
    Math.min(
      2,
      maxSide
      / Math.max(
        bitmap.width,
        bitmap.height
      )
    );

  const width =
    Math.max(
      bitmap.width,
      Math.round(
        bitmap.width
        * Math.max(
          1,
          scale
        )
      )
    );

  const height =
    Math.max(
      bitmap.height,
      Math.round(
        bitmap.height
        * Math.max(
          1,
          scale
        )
      )
    );

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    width;

  canvas.height =
    height;

  const context =
    canvas.getContext(
      "2d",
      {
        alpha: false
      }
    );

  context.fillStyle =
    "#ffffff";

  context.fillRect(
    0,
    0,
    width,
    height
  );

  context.drawImage(
    bitmap,
    0,
    0,
    width,
    height
  );

  bitmap.close?.();

  return canvas;
}



function answerImportRowForItem(
  item,
  detected
) {
  const statusHint =
    detected?.status_hint
    || null;

  return {
    item_id:
      item.id,

    question_number:
      item.question_number,

    /*
      O leitor de print não tenta identificar
      A/B/C/D/E. O resultado vem somente da cor.
    */
    official_answer:
      item.official_answer
      || null,

    user_answer:
      null,

    detected_status:
      statusHint,

    color_status:
      detected?.color_status
      || null,

    confidence:
      Number(
        detected?.confidence
        || 0
      ),

    ocr_confidence:
      Number(
        detected?.ocr_confidence
        || 0
      ),

    result:
      [
        "correct",
        "wrong",
        "annulled"
      ].includes(
        statusHint
      )
        ? statusHint
        : null
  };
}



function renderAnswerImportPreview() {
  const table =
    document.getElementById(
      "qs-answer-import-table"
    );

  const applyButton =
    document.getElementById(
      "qs-apply-answer-import"
    );

  if (!table) {
    return;
  }

  const rows =
    qsState.answerImportRows;

  if (!rows.length) {
    table.innerHTML =
      '<div class="qs-answer-import-empty">Nenhuma questão reconhecida.</div>';

    if (applyButton) {
      applyButton.disabled =
        true;
    }

    return;
  }

  const colorLabel =
    row => {
      if (
        row.color_status
        === "green"
      ) {
        return "Verde";
      }

      if (
        row.color_status
        === "red"
      ) {
        return "Vermelho";
      }

      if (
        row.color_status
        === "white"
      ) {
        return "Branco";
      }

      if (
        row.color_status
        === "selected"
      ) {
        return "Selecionada";
      }

      return "Não reconhecida";
    };

  const colorSymbol =
    row => {
      if (
        row.color_status
        === "green"
      ) {
        return "●";
      }

      if (
        row.color_status
        === "red"
      ) {
        return "●";
      }

      if (
        row.color_status
        === "white"
      ) {
        return "○";
      }

      if (
        row.color_status
        === "selected"
      ) {
        return "◎";
      }

      return "·";
    };

  table.innerHTML = `
    <div class="qs-answer-import-grid qs-answer-import-head">
      <span>Questão</span>
      <span>Cor</span>
      <span>Resultado</span>
      <span>Confiança</span>
    </div>

    ${
      rows.map(
        row => {
          const statusLabel =
            row.result
            === "correct"
              ? "Acerto"
              : row.result
                === "wrong"
                  ? "Erro"
                  : row.result
                    === "annulled"
                      ? "Anulada"
                      : "Revisar";

          const statusClass =
            row.result
            || "unknown";

          const confidence =
            row.color_status
            && row.color_status
              !== "unknown"
              ? `${Math.round(
                  Math.max(
                    0,
                    Math.min(
                      1,
                      Number(
                        row.confidence
                        || 0
                      )
                    )
                  )
                  * 100
                )}%`
              : "—";

          return `
            <div
              class="qs-answer-import-grid qs-answer-import-row ${statusClass}"
              data-import-question="${row.question_number}"
            >
              <strong>
                ${row.question_number}
              </strong>

              <span
                class="qs-color-read-note"
                data-color="${qsEscape(row.color_status || "unknown")}"
              >
                ${colorSymbol(row)}
                ${qsEscape(colorLabel(row))}
              </span>

              <select
                data-import-result-status="${row.question_number}"
                aria-label="Resultado da questão ${row.question_number}"
              >
                <option
                  value=""
                  ${!row.result ? "selected" : ""}
                >
                  Revisar
                </option>

                <option
                  value="correct"
                  ${row.result === "correct" ? "selected" : ""}
                >
                  ✓ Acerto
                </option>

                <option
                  value="wrong"
                  ${row.result === "wrong" ? "selected" : ""}
                >
                  ✕ Erro
                </option>

                <option
                  value="annulled"
                  ${row.result === "annulled" ? "selected" : ""}
                >
                  ○ Anulada
                </option>
              </select>

              <span class="qs-answer-import-result">
                ${confidence}
              </span>
            </div>
          `;
        }
      ).join("")
    }
  `;

  table
    .querySelectorAll(
      "[data-import-result-status]"
    )
    .forEach(
      select => {
        select.addEventListener(
          "change",
          () => {
            const number =
              Number(
                select.dataset
                  .importResultStatus
              );

            const row =
              qsState
                .answerImportRows
                .find(
                  candidate =>
                    candidate
                      .question_number
                    === number
                );

            if (!row) {
              return;
            }

            row.result =
              select.value
              || null;

            row.detected_status =
              row.result;

            renderAnswerImportPreview();
          }
        );
      }
    );

  if (applyButton) {
    applyButton.disabled =
      !rows.some(
        row =>
          [
            "correct",
            "wrong",
            "annulled"
          ].includes(
            row.result
          )
      );
  }
}


function previewAnswerScreenshotFiles(
  files
) {
  const preview =
    document.getElementById(
      "qs-answer-screenshot-preview"
    );

  if (!preview) {
    return;
  }

  preview.innerHTML = "";

  qsState.answerScreenshotUrls =
    files.map(
      (file) =>
        URL.createObjectURL(
          file
        )
    );

  qsState.answerScreenshotUrls
    .forEach(
      (url, index) => {
        const figure =
          document.createElement(
            "figure"
          );

        figure.className =
          "qs-answer-shot-thumb";

        figure.innerHTML = `
          <img
            src="${qsEscape(url)}"
            alt="Print ${index + 1} do gabarito"
          >
          <figcaption>
            Print ${index + 1}
          </figcaption>
        `;

        preview.appendChild(
          figure
        );
      }
    );
}



async function readAnswerScreenshots() {
  const files =
    qsState.answerScreenshotFiles;

  if (!files.length) {
    setAnswerImportStatus(
      "Selecione pelo menos uma imagem.",
      "error"
    );

    return;
  }

  const button =
    document.getElementById(
      "qs-read-answer-screenshots"
    );

  if (button) {
    button.disabled =
      true;
  }

  try {
    const detected =
      new Map();

    let numbersFound =
      0;

    /*
      Cursor usado pelo fallback de ordem visual.
      Se o OCR não lê nenhum número, o primeiro print começa
      da primeira questão e os próximos continuam a sequência.
    */
    let sequenceCursor =
      0;

    /*
      Não lê alternativas A/B/C/D/E.
      Cada print é processado em duas etapas:
      número primeiro, cor depois.
    */
    for (
      let index = 0;
      index < files.length;
      index += 1
    ) {
      const result =
        await recognizeAnswerGridByNumber(
          files[index],
          index,
          files.length,
          sequenceCursor
        );

      if (
        Number.isFinite(
          Number(
            result.nextSequenceIndex
          )
        )
      ) {
        sequenceCursor =
          Math.max(
            sequenceCursor,
            Number(
              result.nextSequenceIndex
            )
          );
      }

      numbersFound +=
        result.numberCount;

      for (
        const item
        of result.detections
      ) {
        const previous =
          detected.get(
            item.question_number
          );

        /*
          Em vários prints, uma questão pode estar
          selecionada em um print e aparecer com a
          cor real em outro. O resultado resolvido
          sempre ganha do estado "selecionada".
        */
        if (
          !previous
          || (
            !previous.status_hint
            && item.status_hint
          )
          || (
            Boolean(
              item.status_hint
            )
            === Boolean(
              previous.status_hint
            )
            && Number(
                item.confidence
                || 0
              )
              > Number(
                  previous.confidence
                  || 0
                )
          )
        ) {
          detected.set(
            item.question_number,
            item
          );
        }
      }
    }

    qsState.answerImportRows =
      qsState.items.map(
        item =>
          answerImportRowForItem(
            item,
            detected.get(
              item.question_number
            )
          )
      );

    renderAnswerImportPreview();

    const recognizedCount =
      qsState.answerImportRows
        .filter(
          row =>
            [
              "correct",
              "wrong",
              "annulled"
            ].includes(
              row.result
            )
        )
        .length;

    const selectedCount =
      qsState.answerImportRows
        .filter(
          row =>
            row.color_status
            === "selected"
        )
        .length;

    const unresolvedCount =
      qsState.answerImportRows
        .filter(
          row =>
            !row.result
        )
        .length;

    if (
      recognizedCount
      || selectedCount
    ) {
      setAnswerImportStatus(
        `${recognizedCount} resultado(s) reconhecido(s). ${
          numbersFound
        } número(s) localizado(s).${
          selectedCount
            ? ` ${selectedCount} questão(ões) selecionada(s) precisam de conferência.`
            : ""
        }${
          unresolvedCount
            ? ` ${unresolvedCount} questão(ões) sem resultado definido.`
            : " Confira a prévia e aplique."
        }`,
        recognizedCount
          ? "success"
          : ""
      );
    } else {
      setAnswerImportStatus(
        "Não consegui localizar números de questões com cores válidas. Recorte o print deixando a grade numerada visível e tente novamente.",
        "error"
      );
    }

  } catch (error) {
    console.error(
      error
    );

    setAnswerImportStatus(
      `Não foi possível analisar o print: ${error.message || "erro desconhecido"}`,
      "error"
    );

  } finally {
    /*
      Sucesso ou erro: elimina os prints originais da memória
      do navegador. A tabela de resultados reconhecidos fica.
    */
    releaseAnswerScreenshotSourceFiles();


    if (button) {
      button.disabled =
        false;
    }
  }
}



async function applyAnswerScreenshotResults() {
  if (!qsState.currentSet) {
    return;
  }

  const rows =
    qsState.answerImportRows
      .filter(
        row =>
          [
            "correct",
            "wrong",
            "annulled"
          ].includes(
            row.result
          )
      );

  if (!rows.length) {
    setAnswerImportStatus(
      "Não há resultados válidos para aplicar.",
      "error"
    );

    return;
  }

  const button =
    document.getElementById(
      "qs-apply-answer-import"
    );

  if (button) {
    button.disabled =
      true;
  }

  setAnswerImportStatus(
    "Aplicando resultados..."
  );

  try {
    const attemptRows =
      rows.map(
        row => {
          const previous =
            qsState.attempts.get(
              row.item_id
            );

          const isWrong =
            row.result
            === "wrong";

          return {
            user_id:
              qsState.user.id,

            question_item_id:
              row.item_id,

            /*
              Agora anulada é salva como "annulled".
              Rode o SQL que acompanha este arquivo
              antes de usar o novo leitor.
            */
            result:
              row.result,

            area:
              isWrong
                ? previous?.area
                  || null
                : null,

            materia:
              isWrong
                ? previous?.materia
                  || null
                : null,

            correct_option:
              isWrong
                ? previous
                    ?.correct_option
                  || null
                : null,

            ccq:
              isWrong
                ? previous?.ccq
                  || null
                : null,

            what_i_thought:
              isWrong
                ? previous
                    ?.what_i_thought
                  || null
                : null,

            sent_to_error:
              isWrong
                ? previous
                    ?.sent_to_error
                  || false
                : false,

            error_entry_id:
              isWrong
                ? previous
                    ?.error_entry_id
                  || null
                : null,

            answered_at:
              new Date()
                .toISOString()
          };
        }
      );

    const {
      error
    } =
      await qsSb
        .from(
          "question_attempts"
        )
        .upsert(
          attemptRows,
          {
            onConflict:
              "user_id,question_item_id"
          }
        );

    if (error) {
      throw error;
    }

    const appliedCount =
      attemptRows.length;

    clearAnswerScreenshotMemory();

    const dialog =
      document.getElementById(
        "qs-answer-import-dialog"
      );

    if (
      dialog?.open
    ) {
      dialog.close();
    }

    await Promise.all([
      loadSets(),

      openSet(
        qsState.currentSet.id
      ),

      loadQuestionOverview()
    ]);

    setAnswerStatus(
      `${appliedCount} resultado(s) importado(s) do print. As imagens foram descartadas do navegador.`,
      "success"
    );

  } catch (error) {
    console.error(
      error
    );

    setAnswerImportStatus(
      `Não foi possível aplicar: ${error.message || "erro desconhecido"}`,
      "error"
    );

    if (button) {
      button.disabled =
        false;
    }
  }
}


function openAnswerImportDialog() {
  if (!qsState.currentSet) {
    return;
  }

  clearAnswerScreenshotMemory();

  const dialog =
    document.getElementById(
      "qs-answer-import-dialog"
    );

  if (
    dialog
    && !dialog.open
  ) {
    dialog.showModal();
  }
}


function closeAnswerImportDialog() {
  /*
    Cancelar também apaga imediatamente
    os prints da memória do navegador.
  */
  clearAnswerScreenshotMemory();

  const dialog =
    document.getElementById(
      "qs-answer-import-dialog"
    );

  if (
    dialog?.open
  ) {
    dialog.close();
  }

  setAnswerImportStatus("");
}


function wireAnswerScreenshotImporter() {
  const input =
    document.getElementById(
      "qs-answer-screenshot-files"
    );

  input?.addEventListener(
    "change",
    () => {
      for (
        const url
        of qsState.answerScreenshotUrls
      ) {
        try {
          URL.revokeObjectURL(
            url
          );
        } catch {}
      }

      qsState.answerScreenshotUrls =
        [];

      qsState.answerScreenshotFiles =
        Array.from(
          input.files
          || []
        ).filter(
          (file) =>
            file.type
              .startsWith(
                "image/"
              )
        );

      previewAnswerScreenshotFiles(
        qsState.answerScreenshotFiles
      );

      setAnswerImportStatus(
        qsState.answerScreenshotFiles.length
          ? `${qsState.answerScreenshotFiles.length} imagem(ns) selecionada(s).`
          : ""
      );
    }
  );

  document
    .getElementById(
      "qs-open-answer-import"
    )
    ?.addEventListener(
      "click",
      openAnswerImportDialog
    );

  document
    .getElementById(
      "qs-read-answer-screenshots"
    )
    ?.addEventListener(
      "click",
      readAnswerScreenshots
    );

  document
    .getElementById(
      "qs-apply-answer-import"
    )
    ?.addEventListener(
      "click",
      applyAnswerScreenshotResults
    );

  [
    "qs-answer-import-close",
    "qs-answer-import-cancel"
  ].forEach(
    (id) => {
      document
        .getElementById(
          id
        )
        ?.addEventListener(
          "click",
          closeAnswerImportDialog
        );
    }
  );

  document
    .getElementById(
      "qs-answer-import-dialog"
    )
    ?.addEventListener(
      "cancel",
      (event) => {
        event.preventDefault();
        closeAnswerImportDialog();
      }
    );
}


function normalizeResolutionLetter(
  value
) {
  const match =
    String(
      value
      || ""
    )
      .trim()
      .toUpperCase()
      .match(/[A-D]/);

  return match
    ? match[0]
    : "";
}


function alternativeTextValue(
  value
) {
  if (
    value == null
  ) {
    return "";
  }

  if (
    typeof value === "string"
  ) {
    return value.trim();
  }

  if (
    typeof value === "object"
  ) {
    return String(
      value.text
      || value.label
      || value.content
      || value.value
      || ""
    ).trim();
  }

  return String(
    value
  ).trim();
}


function parsedQuestionPresentation(
  item
) {
  const source =
    String(
      item.raw_text
      || item.stem
      || ""
    )
      .replace(/\s+/g, " ")
      .trim();

  const alternatives =
    item.alternatives;

  const letters =
    ["A", "B", "C", "D"];

  const options =
    [];

  if (
    Array.isArray(
      alternatives
    )
    && alternatives.length
  ) {
    alternatives
      .slice(
        0,
        4
      )
      .forEach(
        (
          value,
          index
        ) => {
          const text =
            alternativeTextValue(
              value
            );

          if (text) {
            options.push({
              letter:
                letters[index],
              text
            });
          }
        }
      );
  } else if (
    alternatives
    && typeof alternatives
      === "object"
  ) {
    letters.forEach(
      (letter) => {
        const text =
          alternativeTextValue(
            alternatives[letter]
            ?? alternatives[
              letter.toLowerCase()
            ]
          );

        if (text) {
          options.push({
            letter,
            text
          });
        }
      }
    );
  }

  let stem =
    String(
      item.stem
      || item.raw_text
      || ""
    ).trim();

  if (
    options.length < 2
    && source
  ) {
    const match =
      source.match(
        /\sA\s+([\s\S]+?)\s+B\s+([\s\S]+?)\s+C\s+([\s\S]+?)\s+D\s+([\s\S]+?)(?=\s+E\s+|$)/
      );

    if (match) {
      const marker =
        source.indexOf(
          match[0]
        );

      if (marker > 0) {
        stem =
          source
            .slice(
              0,
              marker
            )
            .trim();
      }

      options.length =
        0;

      letters.forEach(
        (
          letter,
          index
        ) => {
          const text =
            String(
              match[
                index + 1
              ]
              || ""
            ).trim();

          if (text) {
            options.push({
              letter,
              text
            });
          }
        }
      );
    }
  }

  if (
    options.length < 4
  ) {
    const existing =
      new Set(
        options.map(
          option =>
            option.letter
        )
      );

    letters.forEach(
      (letter) => {
        if (
          !existing.has(
            letter
          )
        ) {
          options.push({
            letter,
            text:
              `Alternativa ${letter}`
          });
        }
      }
    );

    options.sort(
      (
        a,
        b
      ) =>
        letters.indexOf(
          a.letter
        )
        -
        letters.indexOf(
          b.letter
        )
    );
  }

  return {
    stem:
      stem
      || "Enunciado da questão",
    options:
      options.slice(
        0,
        4
      )
  };
}


function resolutionExplanations(
  item
) {
  const raw =
    item.answer_explanations;

  if (
    raw
    && typeof raw === "object"
    && !Array.isArray(raw)
  ) {
    return raw;
  }

  if (
    typeof raw === "string"
    && raw.trim()
  ) {
    return {
      general:
        raw.trim()
    };
  }

  return {};
}


function renderResolutionFeedback(
  item,
  selected,
  confirmed,
  correct
) {
  if (!confirmed) {
    return "";
  }

  const hasKey =
    /^[A-D]$/.test(
      correct
    );

  const isCorrect =
    hasKey
    && selected
      === correct;

  const resultCopy =
    !hasKey
      ? "Resposta confirmada · gabarito ainda não disponível"
      : isCorrect
        ? "Resposta correta"
        : `Resposta incorreta · gabarito: ${correct}`;

  const resultClass =
    !hasKey
      ? ""
      : isCorrect
        ? "correct"
        : "wrong";

  const pulo =
    String(
      item.pulo_do_gato
      || ""
    ).trim();

  const explanations =
    resolutionExplanations(
      item
    );

  const presentation =
    parsedQuestionPresentation(
      item
    );

  const rows =
    presentation.options
      .map(
        (option) => {
          const explanation =
            String(
              explanations[
                option.letter
              ]
              || explanations[
                option.letter
                  .toLowerCase()
              ]
              || ""
            ).trim();

          const fallback =
            hasKey
              ? (
                  option.letter
                    === correct
                    ? "Esta é a alternativa correta. A justificativa detalhada será preenchida pela fonte de importação."
                    : "Esta alternativa está incorreta. A justificativa detalhada será preenchida pela fonte de importação."
                )
              : "A justificativa será exibida quando o gabarito e a explicação vierem na importação.";

          return `
            <div class="qs-justification-row">
              <span>${option.letter}</span>
              <p>${qsEscape(
                explanation
                || fallback
              )}</p>
            </div>
          `;
        }
      )
      .join("");

  const general =
    String(
      explanations.general
      || explanations.explanation
      || ""
    ).trim();

  return `
    <div class="qs-resolution-feedback" data-resolution-feedback>
      <div class="qs-resolution-result ${resultClass}">
        ${qsEscape(
          resultCopy
        )}
      </div>

      <div class="qs-pulo-card">
        <strong>Pulo do Gato</strong>
        <p>
          ${qsEscape(
            pulo
            || "O Pulo do Gato desta questão será exibido aqui quando vier junto da importação."
          )}
        </p>
      </div>

      <div class="qs-justification-card">
        <strong>Justificativa das alternativas</strong>
        ${
          general
            ? `<p>${qsEscape(general)}</p>`
            : ""
        }
        <div class="qs-justification-list">
          ${rows}
        </div>
      </div>
    </div>
  `;
}


function resolutionOptionClass(
  letter,
  selected,
  confirmed,
  correct
) {
  const classes =
    ["qs-resolution-option"];

  if (
    selected === letter
  ) {
    classes.push(
      "selected"
    );
  }

  if (
    confirmed
    && /^[A-D]$/.test(
      correct
    )
  ) {
    if (
      letter === correct
    ) {
      classes.push(
        "correct"
      );
    }

    if (
      selected === letter
      && letter !== correct
    ) {
      classes.push(
        "wrong"
      );
    }
  }

  return classes.join(
    " "
  );
}


function applyResolutionHighlight() {
  if (
    !qsResolutionState
      .highlighterEnabled
  ) {
    return;
  }

  const selection =
    window.getSelection();

  if (
    !selection
    || selection.isCollapsed
    || !selection.rangeCount
  ) {
    return;
  }

  const range =
    selection.getRangeAt(
      0
    );

  const root =
    document.getElementById(
      "qs-resolution-text"
    );

  if (
    !root
    || !root.contains(
      range.commonAncestorContainer
        .nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer
            .parentNode
        : range.commonAncestorContainer
    )
  ) {
    return;
  }

  const mark =
    document.createElement(
      "mark"
    );

  mark.dataset.highlight =
    qsResolutionState
      .highlightColor;

  try {
    const contents =
      range.extractContents();

    mark.appendChild(
      contents
    );

    range.insertNode(
      mark
    );

    selection.removeAllRanges();
  } catch (error) {
    console.warn(
      "Não foi possível aplicar o marca-texto:",
      error
    );
  }
}


async function confirmResolutionAnswer(
  itemId
) {
  const item =
    qsState.items.find(
      candidate =>
        candidate.id
        === itemId
    );

  if (!item) {
    return;
  }

  const selected =
    qsResolutionState
      .selectedById
      .get(
        itemId
      );

  if (
    !selected
  ) {
    setAnswerStatus(
      "Escolha uma alternativa antes de confirmar.",
      "error"
    );

    return;
  }

  const correct =
    normalizeResolutionLetter(
      item.official_answer
    );

  qsResolutionState
    .confirmedById
    .add(
      itemId
    );

  if (
    /^[A-D]$/.test(
      correct
    )
  ) {
    const previous =
      qsState.attempts.get(
        itemId
      );

    const result =
      selected === correct
        ? "correct"
        : "wrong";

    const row = {
      user_id:
        qsState.user.id,
      question_item_id:
        itemId,
      selected_option:
        selected,
      result,
      area:
        previous?.area
        || null,
      materia:
        previous?.materia
        || null,
      correct_option:
        correct,
      ccq:
        previous?.ccq
        || null,
      what_i_thought:
        previous?.what_i_thought
        || null,
      sent_to_error:
        previous?.sent_to_error
        || false,
      error_entry_id:
        previous?.error_entry_id
        || null,
      answered_at:
        new Date()
          .toISOString()
    };

    const {
      data,
      error
    } =
      await qsSb
        .from(
          "question_attempts"
        )
        .upsert(
          row,
          {
            onConflict:
              "user_id,question_item_id"
          }
        )
        .select("*")
        .single();

    if (error) {
      console.error(
        error
      );

      setAnswerStatus(
        `Não foi possível salvar a resposta: ${error.message}`,
        "error"
      );

      qsResolutionState
        .confirmedById
        .delete(
          itemId
        );

      renderQuestions();

      return;
    }

    qsState.attempts.set(
      itemId,
      data
      || row
    );
  }

  setAnswerStatus(
    /^[A-D]$/.test(
      correct
    )
      ? "Resposta registrada."
      : "Resposta confirmada. O gabarito será conectado quando estiver disponível.",
    "success"
  );

  renderQuestions();
  renderSetHistory();
}


function bindResolutionQuestionEvents(
  item
) {
  document
    .querySelectorAll(
      "[data-resolution-option]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            if (
              qsResolutionState
                .confirmedById
                .has(
                  item.id
                )
            ) {
              return;
            }

            qsResolutionState
              .selectedById
              .set(
                item.id,
                button.dataset
                  .resolutionOption
              );

            renderQuestions();
          }
        );
      }
    );

  document
    .getElementById(
      "qs-resolution-confirm"
    )
    ?.addEventListener(
      "click",
      () =>
        confirmResolutionAnswer(
          item.id
        )
    );

  document
    .getElementById(
      "qs-resolution-prev"
    )
    ?.addEventListener(
      "click",
      () => {
        qsResolutionState.currentIndex =
          Math.max(
            0,
            qsResolutionState
              .currentIndex
              - 1
          );

        setAnswerStatus(
          ""
        );

        renderQuestions();
      }
    );

  document
    .getElementById(
      "qs-resolution-next"
    )
    ?.addEventListener(
      "click",
      () => {
        qsResolutionState.currentIndex =
          Math.min(
            qsState.items.length
              - 1,
            qsResolutionState
              .currentIndex
              + 1
          );

        setAnswerStatus(
          ""
        );

        renderQuestions();
      }
    );

  document
    .getElementById(
      "qs-highlighter-toggle"
    )
    ?.addEventListener(
      "click",
      () => {
        qsResolutionState.highlighterEnabled =
          !qsResolutionState
            .highlighterEnabled;

        const palette =
          document.getElementById(
            "qs-highlighter-palette"
          );

        if (palette) {
          palette.hidden =
            !qsResolutionState
              .highlighterEnabled;
        }

        document
          .getElementById(
            "qs-highlighter-toggle"
          )
          ?.classList
          .toggle(
            "active",
            qsResolutionState
              .highlighterEnabled
          );
      }
    );

  document
    .querySelectorAll(
      "[data-highlight-color]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            qsResolutionState.highlightColor =
              button.dataset
                .highlightColor;

            document
              .querySelectorAll(
                "[data-highlight-color]"
              )
              .forEach(
                candidate =>
                  candidate.classList
                    .toggle(
                      "active",
                      candidate
                        === button
                    )
              );
          }
        );
      }
    );

  document
    .getElementById(
      "qs-resolution-text"
    )
    ?.addEventListener(
      "mouseup",
      applyResolutionHighlight
    );
}


function renderQuestions() {
  const container =
    document.getElementById(
      "qs-question-list"
    );

  if (!container) {
    return;
  }

  if (
    !qsState.items.length
  ) {
    container.innerHTML =
      '<div class="qs-empty">Este simulado ainda não possui questões importadas.</div>';

    return;
  }

  qsResolutionState.currentIndex =
    Math.max(
      0,
      Math.min(
        qsResolutionState
          .currentIndex,
        qsState.items.length
          - 1
      )
    );

  const item =
    qsState.items[
      qsResolutionState
        .currentIndex
    ];

  const presentation =
    parsedQuestionPresentation(
      item
    );

  const selected =
    qsResolutionState
      .selectedById
      .get(
        item.id
      )
      || "";

  const confirmed =
    qsResolutionState
      .confirmedById
      .has(
        item.id
      );

  const correct =
    normalizeResolutionLetter(
      item.official_answer
    );

  const progress =
    (
      (
        qsResolutionState
          .currentIndex
        + 1
      )
      / qsState.items.length
    ) * 100;

  const optionHtml =
    presentation.options
      .map(
        (option) => `
          <button
            class="${resolutionOptionClass(
              option.letter,
              selected,
              confirmed,
              correct
            )}"
            type="button"
            data-resolution-option="${option.letter}"
            ${confirmed ? "disabled" : ""}
          >
            <span class="qs-resolution-letter">
              ${option.letter}
            </span>

            <span>
              ${qsEscape(
                option.text
              )}
            </span>
          </button>
        `
      )
      .join("");

  container.innerHTML =
    `
      <div class="qs-resolution-shell">
        <div class="qs-resolution-topbar">
          <div class="qs-resolution-progress-copy">
            <strong>
              Questão ${
                qsResolutionState
                  .currentIndex
                + 1
              } de ${qsState.items.length}
            </strong>
            <small>
              ${qsEscape(
                item.source_label
                || "Simulado"
              )}
            </small>
          </div>

          <div class="qs-highlighter">
            <button
              id="qs-highlighter-toggle"
              class="qs-highlighter-button ${qsResolutionState.highlighterEnabled ? "active" : ""}"
              type="button"
              aria-pressed="${qsResolutionState.highlighterEnabled ? "true" : "false"}"
            >
              ▰ Marca-texto
            </button>

            <div
              id="qs-highlighter-palette"
              class="qs-highlighter-palette"
              ${qsResolutionState.highlighterEnabled ? "" : "hidden"}
              aria-label="Cor do marca-texto"
            >
              ${[
                ["yellow", "Amarelo"],
                ["green", "Verde"],
                ["blue", "Azul"],
                ["orange", "Laranja"]
              ].map(
                ([color, label]) => `
                  <button
                    class="qs-highlight-color ${qsResolutionState.highlightColor === color ? "active" : ""}"
                    type="button"
                    data-highlight-color="${color}"
                    aria-label="${label}"
                    title="${label}"
                  ></button>
                `
              ).join("")}
            </div>
          </div>
        </div>

        <div class="qs-resolution-progress" aria-hidden="true">
          <span style="width:${progress}%"></span>
        </div>

        <article class="qs-resolution-card">
          <div class="qs-resolution-question-head">
            <div class="qs-number">
              ${item.question_number}
            </div>

            <div class="qs-resolution-question-title">
              <small>
                Questão ${item.question_number}
              </small>

              <div
                id="qs-resolution-text"
                class="qs-resolution-text"
              >
                <h3>
                  ${qsEscape(
                    presentation.stem
                  )}
                </h3>
              </div>
            </div>
          </div>

          ${
            item.image_url
              ? `
                <img
                  class="qs-resolution-image"
                  src="${qsEscape(
                    item.image_url
                  )}"
                  alt="Imagem da questão ${item.question_number}"
                >
              `
              : ""
          }

          <div class="qs-resolution-alternatives">
            ${optionHtml}
          </div>

          <div class="qs-resolution-confirm">
            <button
              id="qs-resolution-confirm"
              class="button primary"
              type="button"
              ${(
                !selected
                || confirmed
              ) ? "disabled" : ""}
            >
              ${confirmed ? "Confirmada" : "Confirmar"}
            </button>
          </div>

          ${renderResolutionFeedback(
            item,
            selected,
            confirmed,
            correct
          )}
        </article>

        <div class="qs-resolution-footer">
          <button
            id="qs-resolution-prev"
            class="qs-resolution-nav-button"
            type="button"
            ${qsResolutionState.currentIndex === 0 ? "disabled" : ""}
          >
            ← Anterior
          </button>

          <button
            id="qs-resolution-next"
            class="qs-resolution-nav-button"
            type="button"
            ${qsResolutionState.currentIndex >= qsState.items.length - 1 ? "disabled" : ""}
          >
            Próxima →
          </button>
        </div>
      </div>
    `;

  bindResolutionQuestionEvents(
    item
  );
}

function currentWrongIds() {
  return Array.from(
    document.querySelectorAll(
      "[data-wrong-toggle]:checked"
    )
  ).map((input) =>
    input.dataset.wrongToggle
  );
}


function updateLiveSummary() {
  const total =
    qsState.items.length;

  const wrongIds =
    new Set(
      currentWrongIds()
    );

  const annulled =
    qsState.items
      .filter(
        item =>
          !wrongIds.has(
            item.id
          )
          && qsState
            .attempts
            .get(
              item.id
            )
            ?.result
            === "annulled"
      )
      .length;

  const wrong =
    wrongIds.size;

  const scored =
    Math.max(
      0,
      total - annulled
    );

  const correct =
    Math.max(
      0,
      scored - wrong
    );

  document
    .getElementById(
      "qs-summary-total"
    )
    .textContent =
      total;

  document
    .getElementById(
      "qs-summary-correct"
    )
    .textContent =
      correct;

  document
    .getElementById(
      "qs-summary-wrong"
    )
    .textContent =
      wrong;

  document
    .getElementById(
      "qs-summary-accuracy"
    )
    .textContent =
      accuracy(
        correct,
        scored
      );
}


function errorNotebookSkipStorageKey(
  setId =
    qsState.currentSet?.id
) {
  if (
    !qsState.user?.id
    || !setId
  ) {
    return null;
  }

  return `luria:error-notebook-skips:${qsState.user.id}:${setId}`;
}


function loadErrorNotebookSkips() {
  qsState
    .errorNotebookSkips
    .clear();

  const key =
    errorNotebookSkipStorageKey();

  if (!key) {
    return;
  }

  try {
    const stored =
      JSON.parse(
        localStorage.getItem(
          key
        )
        || "[]"
      );

    const validIds =
      new Set(
        qsState.items.map(
          item =>
            item.id
        )
      );

    (
      Array.isArray(
        stored
      )
        ? stored
        : []
    )
      .filter(
        id =>
          validIds.has(
            id
          )
      )
      .forEach(
        id =>
          qsState
            .errorNotebookSkips
            .add(
              id
            )
      );

  } catch {
    qsState
      .errorNotebookSkips
      .clear();
  }
}


function persistErrorNotebookSkips() {
  const key =
    errorNotebookSkipStorageKey();

  if (!key) {
    return;
  }

  try {
    localStorage.setItem(
      key,
      JSON.stringify(
        Array.from(
          qsState.errorNotebookSkips
        )
      )
    );
  } catch {}
}


function isErrorNotebookSkipped(
  itemId
) {
  return qsState
    .errorNotebookSkips
    .has(
      itemId
    );
}


function setErrorNotebookSkipped(
  itemId,
  skipped
) {
  if (
    skipped
  ) {
    qsState
      .errorNotebookSkips
      .add(
        itemId
      );

    qsState
      .imageSelections
      .delete(
        itemId
      );

  } else {
    qsState
      .errorNotebookSkips
      .delete(
        itemId
      );
  }

  persistErrorNotebookSkips();
}


function readWrongMetadata(itemId) {
  const area =
    document.querySelector(
      `[data-error-area="${CSS.escape(itemId)}"]`
    )?.value?.trim() || "";

  const materia =
    document.querySelector(
      `[data-error-materia="${CSS.escape(itemId)}"]`
    )?.value?.trim() || "";

  const correctOption =
    document.querySelector(
      `[data-correct-option="${CSS.escape(itemId)}"]`
    )?.value || "";

  const ccq =
    document.querySelector(
      `[data-error-ccq="${CSS.escape(itemId)}"]`
    )?.value?.trim() || "";

  const thought =
    document.querySelector(
      `[data-thought="${CSS.escape(itemId)}"]`
    )?.value?.trim() || "";

  const imagePath =
    qsState
      .imageSelections
      .get(
        itemId
      )
    || null;

  const skipErrorNotebook =
    document.querySelector(
      `[data-skip-error-notebook="${CSS.escape(itemId)}"]`
    )?.checked
    ?? isErrorNotebookSkipped(
      itemId
    );

  return {
    area,
    materia,
    correctOption,
    ccq,
    thought,
    imagePath,
    skipErrorNotebook
  };
}

async function saveAnswerKey() {
  if (!qsState.currentSet) return;

  const wrongIds =
    new Set(currentWrongIds());

  const missing = [];

  const rows =
    qsState.items.map((item) => {
      const isWrong =
        wrongIds.has(item.id);

      const previous =
        qsState.attempts.get(item.id);

      if (!isWrong) {
        return {
          user_id: qsState.user.id,
          question_item_id: item.id,
          result:
            previous?.result === "annulled"
              ? "annulled"
              : "correct",
          area: null,
          materia: null,
          correct_option: null,
          ccq: null,
          what_i_thought: null,
          sent_to_error:
            previous?.sent_to_error || false,
          error_entry_id:
            previous?.error_entry_id || null,
          answered_at: new Date().toISOString()
        };
      }

      const metadata =
        readWrongMetadata(item.id);

      if (
        !metadata.skipErrorNotebook
        &&
        (
          !metadata.area
          || !metadata.correctOption
        )
      ) {
        missing.push(
          item.question_number
        );
      }

      return {
        user_id: qsState.user.id,
        question_item_id: item.id,
        result: "wrong",
        area: metadata.area || null,
        materia: metadata.materia || null,
        correct_option:
          metadata.correctOption || null,
        ccq:
          metadata.ccq || null,
        what_i_thought:
          metadata.thought || null,
        sent_to_error:
          previous?.sent_to_error || false,
        error_entry_id:
          previous?.error_entry_id || null,
        answered_at: new Date().toISOString()
      };
    });

  if (missing.length) {
    setAnswerStatus(
      `Preencha Área e Resposta correta nas questões: ${missing.join(", ")}.`,
      "error"
    );
    return;
  }

  const button =
    document.getElementById("qs-save-key");

  button.disabled = true;
  setAnswerStatus("Salvando gabarito...");

  const { error } = await qsSb
    .from("question_attempts")
    .upsert(
      rows,
      {
        onConflict:
          "user_id,question_item_id"
      }
    );

  button.disabled = false;

  if (error) {
    console.error(error);

    setAnswerStatus(
      `Não foi possível salvar: ${error.message}`,
      "error"
    );

    return;
  }

  setAnswerStatus(
    "Gabarito salvo.",
    "success"
  );

  await loadSets();
  await openSet(
    qsState.currentSet.id
  );
}

async function compressNotebookGalleryBlob(
  blob
) {
  return compressQuestionFigureBlob(
    blob
  );
}


async function copyGalleryImageToNotebook(
  sourcePath,
  errorEntryId
) {
  if (
    !sourcePath
    || !errorEntryId
  ) {
    return null;
  }

  const {
    data: imageBlob,
    error: downloadError
  } =
    await qsSb
      .storage
      .from(
        "docmap"
      )
      .download(
        sourcePath
      );

  if (downloadError) {
    throw downloadError;
  }

  const compressedBlob =
    await compressNotebookGalleryBlob(
      imageBlob
    );

  const extension =
    compressedBlob.type
      === "image/png"
        ? "png"
        : compressedBlob.type
          === "image/jpeg"
            ? "jpg"
            : "webp";


  const destinationPath =
    `${qsState.user.id}/error_notebook/${errorEntryId}/question.${extension}`;

  const {
    error: uploadError
  } =
    await qsSb
      .storage
      .from(
        "docmap"
      )
      .upload(
        destinationPath,
        compressedBlob,
        {
          contentType:
            compressedBlob.type
            || "image/webp",
          upsert:
            true
        }
      );

  if (uploadError) {
    throw uploadError;
  }

  return destinationPath;
}


async function attachImageToNotebookEntry(
  errorEntryId,
  sourcePath
) {
  if (
    !errorEntryId
    || !sourcePath
  ) {
    return null;
  }

  const destinationPath =
    await copyGalleryImageToNotebook(
      sourcePath,
      errorEntryId
    );

  const {
    error
  } =
    await qsSb
      .from(
        "error_notebook"
      )
      .update({
        question_image_path:
          destinationPath
      })
      .eq(
        "id",
        errorEntryId
      );

  if (error) {
    /*
      Evita deixar cópia órfã no Storage
      caso o banco não aceite a atualização.
    */
    await qsSb
      .storage
      .from(
        "docmap"
      )
      .remove([
        destinationPath
      ]);

    throw error;
  }

  return destinationPath;
}


async function clearCurrentSimulationImageGallery() {
  if (
    !qsState.currentSet?.id
  ) {
    return {
      removed: 0,
      storageWarning: false
    };
  }

  const [
    legacyResult,
    galleryResult
  ] =
    await Promise.all([
      qsSb
        .from(
          "question_items"
        )
        .select(
          "id,image_path"
        )
        .eq(
          "set_id",
          qsState.currentSet.id
        ),

      qsSb
        .from(
          "question_image_candidates"
        )
        .select(
          "id,image_path"
        )
        .eq(
          "set_id",
          qsState.currentSet.id
        )
    ]);

  if (
    legacyResult.error
  ) {
    throw legacyResult.error;
  }

  if (
    galleryResult.error
  ) {
    throw galleryResult.error;
  }

  const legacyRows =
    (legacyResult.data || [])
      .filter(
        row =>
          Boolean(
            row.image_path
          )
      );

  const galleryRows =
    (galleryResult.data || [])
      .filter(
        row =>
          Boolean(
            row.image_path
          )
      );

  const paths =
    Array.from(
      new Set(
        [
          ...legacyRows.map(
            row =>
              row.image_path
          ),
          ...galleryRows.map(
            row =>
              row.image_path
          )
        ]
      )
    );

  if (
    legacyRows.length
  ) {
    const {
      error:
        updateError
    } =
      await qsSb
        .from(
          "question_items"
        )
        .update({
          image_path:
            null
        })
        .in(
          "id",
          legacyRows.map(
            row =>
              row.id
          )
        );

    if (
      updateError
    ) {
      throw updateError;
    }
  }

  if (
    galleryRows.length
  ) {
    const {
      error:
        deleteError
    } =
      await qsSb
        .from(
          "question_image_candidates"
        )
        .delete()
        .eq(
          "set_id",
          qsState.currentSet.id
        );

    if (
      deleteError
    ) {
      throw deleteError;
    }
  }

  let storageError =
    null;

  if (
    paths.length
  ) {
    const result =
      await qsSb
        .storage
        .from(
          "docmap"
        )
        .remove(
          paths
        );

    storageError =
      result.error;
  }

  qsState.imageSelections.clear();
  qsState.imageGallery = [];

  return {
    removed:
      paths.length,
    storageWarning:
      Boolean(
        storageError
      )
  };
}


async function clearCurrentSimulationSourcePdf() {
  const set =
    qsState.currentSet;

  const sourcePath =
    set?.source_file_path
    || null;

  if (
    !set?.id
    || !sourcePath
  ) {
    return {
      removed:
        false,
      storageWarning:
        false,
      databaseWarning:
        false
    };
  }

  const {
    error:
      storageError
  } =
    await qsSb
      .storage
      .from(
        "docmap"
      )
      .remove([
        sourcePath
      ]);

  if (
    storageError
  ) {
    console.warn(
      "Não foi possível remover o PDF original:",
      storageError
    );

    return {
      removed:
        false,
      storageWarning:
        true,
      databaseWarning:
        false
    };
  }

  const {
    error:
      databaseError
  } =
    await qsSb
      .from(
        "question_sets"
      )
      .update({
        source_file_path:
          null
      })
      .eq(
        "id",
        set.id
      );

  if (
    databaseError
  ) {
    console.warn(
      "PDF removido do Storage, mas não foi possível limpar source_file_path:",
      databaseError
    );
  } else {
    set.source_file_path =
      null;

    const listedSet =
      qsState.sets.find(
        item =>
          item.id ===
          set.id
      );

    if (
      listedSet
    ) {
      listedSet.source_file_path =
        null;
    }
  }

  return {
    removed:
      true,
    storageWarning:
      false,
    databaseWarning:
      Boolean(
        databaseError
      )
  };
}


async function sendErrorsToNotebook() {
  if (!qsState.currentSet) return;


  const allWrongAttempts =
    Array.from(
      qsState.attempts.values()
    ).filter(
      attempt =>
        attempt.result === "wrong"
        && !attempt.sent_to_error
    );


  if (!allWrongAttempts.length) {
    setAnswerStatus(
      "Não há erros novos para enviar. Salve o gabarito primeiro.",
      "error"
    );

    return;
  }


  const wrongAttempts =
    allWrongAttempts.filter(
      attempt =>
        !isErrorNotebookSkipped(
          attempt.question_item_id
        )
    );


  const skippedCount =
    allWrongAttempts.length
    - wrongAttempts.length;


  const missingCcq = [];


  for (const attempt of wrongAttempts) {
    const item =
      qsState.items.find(
        (question) =>
          question.id
          === attempt.question_item_id
      );

    if (!item) continue;


    const metadata =
      readWrongMetadata(
        item.id
      );


    if (!metadata.ccq) {
      missingCcq.push(
        item.question_number
      );
    }
  }


  if (missingCcq.length) {
    setAnswerStatus(
      `Preencha o Pulo do Gato nas questões: ${missingCcq.join(", ")}.`,
      "error"
    );

    return;
  }


  const button =
    document.getElementById(
      "qs-send-errors"
    );

  button.disabled =
    true;


  let sent =
    0;


  try {
    for (
      const attempt
      of wrongAttempts
    ) {
      const item =
        qsState.items.find(
          (question) =>
            question.id
            === attempt.question_item_id
        );


      if (!item) continue;


      const metadata =
        readWrongMetadata(
          item.id
        );


      const area =
        metadata.area
        || attempt.area
        || "";

      const materia =
        metadata.materia
        || attempt.materia
        || null;

      const correctOption =
        metadata.correctOption
        || attempt.correct_option
        || "";

      const thought =
        metadata.thought
        || attempt.what_i_thought
        || null;

      const ccq =
        metadata.ccq;

      const selectedImagePath =
        metadata.imagePath
        || null;


      if (
        !area
        || !correctOption
      ) {
        throw new Error(
          `Questão ${item.question_number}: selecione Área e Resposta correta.`
        );
      }


      /*
        Salva o Pulo do Gato e eventuais
        ajustes feitos depois do
        gabarito, antes de criar
        a entrada no Caderno.
      */

      const {
        error: metadataError
      } =
        await qsSb
          .from(
            "question_attempts"
          )
          .update({
            area,
            materia,
            correct_option:
              correctOption,
            ccq,
            what_i_thought:
              thought
          })
          .eq(
            "id",
            attempt.id
          );


      if (metadataError) {
        throw metadataError;
      }


      const {
        data: errorEntry,
        error: createError
      } =
        await qsSb.rpc(
          "create_error_entry",
          {
            p_area:
              area,

            p_materia:
              materia,

            p_theme:
              qsState
                .currentSet
                .title,

            p_ccq:
              ccq,

            p_question_text:
              item.raw_text,

            p_correct_answer:
              `Alternativa ${correctOption}`,

            p_what_i_thought:
              thought,

            p_question_image_path:
              null
          }
        );


      if (createError) {
        throw createError;
      }


      const entry =
        Array.isArray(
          errorEntry
        )
          ? errorEntry[0]
          : errorEntry;


      if (
        selectedImagePath
        && entry?.id
      ) {
        setAnswerStatus(
          `Copiando imagem da questão ${item.question_number} para o Caderno de Erros...`
        );

        await attachImageToNotebookEntry(
          entry.id,
          selectedImagePath
        );
      }


      const {
        error: updateError
      } =
        await qsSb
          .from(
            "question_attempts"
          )
          .update({
            sent_to_error:
              true,

            error_entry_id:
              entry?.id
              || null
          })
          .eq(
            "id",
            attempt.id
          );


      if (updateError) {
        throw updateError;
      }


      sent +=
        1;
    }


    setAnswerStatus(
      "Limpando galeria temporária de imagens..."
    );

    let galleryCleanup = {
      removed: 0,
      storageWarning: false
    };

    try {
      galleryCleanup =
        await clearCurrentSimulationImageGallery();
    } catch (cleanupError) {
      console.warn(
        "Os erros foram enviados, mas não foi possível limpar toda a galeria:",
        cleanupError
      );

      galleryCleanup.storageWarning =
        true;
    }


    setAnswerStatus(
      "Apagando PDF original do Storage..."
    );


    let pdfCleanup = {
      removed:
        false,
      storageWarning:
        false,
      databaseWarning:
        false
    };


    try {
      pdfCleanup =
        await clearCurrentSimulationSourcePdf();
    } catch (pdfError) {
      console.warn(
        "Não foi possível apagar o PDF original:",
        pdfError
      );

      pdfCleanup.storageWarning =
        true;
    }


    setAnswerStatus(
      `${sent} ${
        sent === 1
          ? "erro enviado"
          : "erros enviados"
      } ao Caderno de Erros.${
        galleryCleanup.removed
          ? ` Galeria temporária limpa (${galleryCleanup.removed} imagem${galleryCleanup.removed === 1 ? "" : "s"}).`
          : ""
      }${
        skippedCount
          ? ` ${skippedCount} questão${skippedCount === 1 ? "" : "ões"} marcada${skippedCount === 1 ? "" : "s"} para não enviar.`
          : ""
      }${
        galleryCleanup.storageWarning
          ? " Algumas imagens antigas podem permanecer no Storage, mas não ficam mais visíveis na galeria."
          : ""
      }${
        pdfCleanup.removed
          ? " PDF original apagado."
          : ""
      }${
        pdfCleanup.storageWarning
          ? " Não foi possível apagar o PDF original do Storage."
          : ""
      }${
        pdfCleanup.databaseWarning
          ? " O arquivo foi apagado, mas o registro do caminho não pôde ser limpo."
          : ""
      }`,
      "success"
    );


    await Promise.all([
      loadSets(),
      openSet(
        qsState
          .currentSet
          .id
      ),
      loadQuestionOverview()
    ]);


  } catch (error) {
    console.error(
      error
    );


    setAnswerStatus(
      error.message
      || "Não foi possível enviar os erros.",
      "error"
    );


  } finally {
    button.disabled =
      false;
  }
}


async function deleteSet(setId) {
  const set =
    qsState.sets.find(
      (item) => item.id === setId
    );

  if (!set) return;

  const confirmed =
    await window.LuriaDialog.confirm(
      `Excluir "${set.title}" e o gabarito associado?`
    );

  if (!confirmed) return;

  const [
    {
      data:
        imageRows
    },
    {
      data:
        candidateRows
    }
  ] =
    await Promise.all([
      qsSb
        .from(
          "question_items"
        )
        .select(
          "image_path"
        )
        .eq(
          "set_id",
          setId
        ),

      qsSb
        .from(
          "question_image_candidates"
        )
        .select(
          "image_path"
        )
        .eq(
          "set_id",
          setId
        )
    ]);


  const storagePaths = [
    set.source_file_path,
    ...(imageRows || [])
      .map(
        (item) =>
          item.image_path
      )
  ]
    .filter(
      Boolean
    );


  if (
    storagePaths.length
  ) {
    const {
      error:
        storageError
    } =
      await qsSb
        .storage
        .from(
          "docmap"
        )
        .remove(
          storagePaths
        );

    if (storageError) {
      console.warn(
        storageError
      );
    }
  }

  const { error } = await qsSb
    .from("question_sets")
    .delete()
    .eq("id", setId);

  if (error) {
    console.error(error);

    setImportStatus(
      `Não foi possível excluir: ${error.message}`,
      "error"
    );

    return;
  }

  if (qsState.currentSet?.id === setId) {
    closeCurrentSet();
  }

  await Promise.all([
    loadSets(),
    loadQuestionOverview()
  ]);


  if (
    qsState.pageMode === "library"
  ) {
    renderSimulationLibrary();
  }
}

function closeCurrentSet() {
  clearAnswerScreenshotMemory();

  qsState.currentSet = null;
  qsState.items = [];
  qsState.imageGallery = [];
  qsState.attempts = new Map();
  qsState.errorNotebookSkips.clear();

  document.getElementById("qs-answer-panel").hidden =
    true;

  renderSetHistory();
}

function wireUpload() {
  const input =
    document.getElementById("qs-file");

  const drop =
    document.getElementById("qs-drop");

  input.addEventListener("change", () => {
    const file =
      input.files?.[0] || null;

    if (!file) return;

    qsState.file = file;

    document.getElementById("qs-file-name").textContent =
      file.name;

    if (
      !document.getElementById("qs-title").value.trim()
    ) {
      document.getElementById("qs-title").value =
        cleanFileTitle(file.name);
    }

    setImportStatus("");
  });

  drop.addEventListener("dragover", (event) => {
    event.preventDefault();
    drop.classList.add("dragover");
  });

  drop.addEventListener("dragleave", () => {
    drop.classList.remove("dragover");
  });

  drop.addEventListener("drop", (event) => {
    event.preventDefault();
    drop.classList.remove("dragover");

    const file =
      event.dataTransfer.files?.[0];

    if (!file) return;

    if (
      file.type !== "application/pdf"
      && !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setImportStatus(
        "Envie um arquivo PDF.",
        "error"
      );
      return;
    }

    qsState.file = file;

    document.getElementById("qs-file-name").textContent =
      file.name;

    if (
      !document.getElementById("qs-title").value.trim()
    ) {
      document.getElementById("qs-title").value =
        cleanFileTitle(file.name);
    }
  });

  document.getElementById("qs-import")
    .addEventListener(
      "click",
      importPdf
    );
}



function wireSetBulkActions() {
  document
    .getElementById(
      "qs-select-all"
    )
    ?.addEventListener(
      "change",
      (event) => {
        for (
          const set
          of qsState.sets
        ) {
          if (
            event.target.checked
          ) {
            qsState
              .selectedSetIds
              .add(
                set.id
              );

          } else {
            qsState
              .selectedSetIds
              .delete(
                set.id
              );
          }
        }


        renderSimulationLibrary();
      }
    );


  document
    .getElementById(
      "qs-delete-selected"
    )
    ?.addEventListener(
      "click",
      deleteSelectedSets
    );
}


function wireSimulationNavigation() {
  document
    .querySelectorAll(
      "[data-qs-mode]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            switchQsMode(
              button.dataset
                .qsMode
            );
          }
        );
      }
    );


  document
    .querySelectorAll(
      "[data-qs-add-mode]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            switchQsAddMode(
              button.dataset
                .qsAddMode
            );
          }
        );
      }
    );


  document
    .getElementById(
      "qs-create-manual"
    )
    ?.addEventListener(
      "click",
      createManualSimulation
    );


  document
    .getElementById(
      "qs-edit-save"
    )
    ?.addEventListener(
      "click",
      saveSimulationEdit
    );


  [
    "qs-edit-close",
    "qs-edit-cancel"
  ].forEach(
    (id) => {
      document
        .getElementById(
          id
        )
        ?.addEventListener(
          "click",
          closeSimulationEditDialog
        );
    }
  );


  document.addEventListener(
    "click",
    closeSimulationLibraryMenus
  );


  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape"
      ) {
        closeSimulationLibraryMenus();
      }
    }
  );
}


async function initQuestionSets() {
  wireSetBulkActions();
  wireSimulationNavigation();
  wireAnswerScreenshotImporter();

  qsState.user =
    window.docmapUser;

  const mode =
    await window.LuriaStudyMode
      ?.load?.();

  if (
    window.LuriaStudyMode
      ?.generalAreasFor
  ) {
    AREA_OPTIONS =
      window.LuriaStudyMode
        .generalAreasFor(
          mode
          || window.luriaStudyMode
          || "medicine"
        );
  }

  window.addEventListener(
    "luria:study-mode",
    (event) => {
      AREA_OPTIONS =
        event.detail?.generalAreas
        || AREA_OPTIONS;

      if (qsState.currentSet) {
        renderQuestions();
      }
    }
  );

  applyExamContext();

  wireUpload();

  document.getElementById("qs-save-key")
    .addEventListener(
      "click",
      saveAnswerKey
    );

  document.getElementById("qs-send-errors")
    .addEventListener(
      "click",
      sendErrorsToNotebook
    );

  document.getElementById("qs-close-set")
    .addEventListener(
      "click",
      closeCurrentSet
    );

  await loadSets();

  switchQsMode(
    "mine"
  );

  const automaticAllowed =
    window.LuriaEntitlements?.enabled(
      "automatic_questions"
    ) === true;

  const automaticButton =
    document.querySelector(
      '[data-qs-add-mode="automatic"]'
    );

  if (
    automaticButton
    && !automaticAllowed
  ) {
    automaticButton.hidden =
      true;
  }

  switchQsAddMode(
    automaticAllowed
      ? "automatic"
      : "manual"
  );
}

if (window.docmapUser) {
  initQuestionSets();
} else {
  window.addEventListener(
    "docmap:ready",
    initQuestionSets,
    { once: true }
  );
}
