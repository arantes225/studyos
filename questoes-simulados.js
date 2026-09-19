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
    Prints do gabarito/respostas são mantidos
    SOMENTE na memória do navegador.
    Nunca são enviados ao Supabase.
  */
  answerScreenshotFiles: [],
  answerScreenshotUrls: [],
  answerImportRows: []
};

let AREA_OPTIONS = [
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
  if (
    ![
      "automatic",
      "manual"
    ].includes(
      mode
    )
  ) {
    mode =
      "automatic";
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


function alternativeStartMatch(line) {
  return normalizeLine(line).match(
    /^([A-E])\s*[\)\.\-:]\s*(.*)$/i
  );
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
  viewport
) {
  if (
    !rect
    || rect.width < 110
    || rect.height < 45
  ) {
    return false;
  }

  if (
    rect.width * rect.height
    < 12000
  ) {
    return false;
  }

  /*
    Ignora cabeçalho/rodapé/logos.
  */
  if (
    rect.top
    < viewport.height * 0.025
    || rect.bottom
    > viewport.height * 0.92
  ) {
    return false;
  }

  /*
    Evita capturar uma página inteira
    renderizada como fundo.
  */
  if (
    rect.width
      > viewport.width * 0.92
    && rect.height
      > viewport.height * 0.80
  ) {
    return false;
  }

  return true;
}


async function extractEmbeddedImageRects(
  page,
  viewport
) {
  const operatorList =
    await page
      .getOperatorList();

  const OPS =
    window.pdfjsLib.OPS;

  const stack = [];

  let ctm =
    [1, 0, 0, 1, 0, 0];

  const rects = [];

  for (
    let index = 0;
    index < operatorList.fnArray.length;
    index += 1
  ) {
    const fn =
      operatorList.fnArray[index];

    const args =
      operatorList.argsArray[index]
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
          : [1, 0, 0, 1, 0, 0];

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

    const isImage =
      fn === OPS.paintImageXObject
      || fn === OPS.paintInlineImageXObject
      || fn === OPS.paintJpegXObject;

    if (!isImage) {
      continue;
    }

    const rect =
      imageRectFromCtm(
        ctm,
        viewport
      );

    if (
      isUsefulQuestionImageRect(
        rect,
        viewport
      )
    ) {
      rects.push(
        rect
      );
    }
  }

  /*
    Remove retângulos praticamente idênticos.
  */
  return rects.filter(
    (rect, index) =>
      !rects
        .slice(
          0,
          index
        )
        .some(
          (previous) =>
            Math.abs(
              previous.left
              - rect.left
            ) < 3
            && Math.abs(
              previous.top
              - rect.top
            ) < 3
            && Math.abs(
              previous.width
              - rect.width
            ) < 5
            && Math.abs(
              previous.height
              - rect.height
            ) < 5
        )
  );
}


function groupTextItemsIntoLineRecords(
  items,
  viewport
) {
  const rows = [];

  for (const item of items) {
    const text =
      normalizeLine(
        item.str
      );

    if (!text) {
      continue;
    }

    const tx =
      window.pdfjsLib
        .Util
        .transform(
          viewport.transform,
          item.transform
        );

    const x =
      Number(
        tx[4] || 0
      );

    const baselineY =
      Number(
        tx[5] || 0
      );

    const height =
      Math.max(
        1,
        Math.hypot(
          tx[2] || 0,
          tx[3] || 0
        )
      );

    const width =
      Math.max(
        1,
        Math.abs(
          Number(
            item.width || 0
          )
          * viewport.scale
        )
      );

    const top =
      baselineY - height;

    const bottom =
      baselineY + 2;

    let row =
      rows.find(
        (candidate) =>
          Math.abs(
            candidate.baselineY
            - baselineY
          ) <= 5
      );

    if (!row) {
      row = {
        baselineY,
        items: []
      };

      rows.push(
        row
      );
    }

    row.items.push({
      x,
      top,
      bottom,
      width,
      text
    });
  }

  rows.sort(
    (a, b) =>
      a.baselineY
      - b.baselineY
  );

  return rows
    .map(
      (row) => {
        row.items.sort(
          (a, b) =>
            a.x - b.x
        );

        const text =
          normalizeLine(
            row.items
              .map(
                (item) =>
                  item.text
              )
              .join(" ")
          );

        const left =
          Math.min(
            ...row.items
              .map(
                (item) =>
                  item.x
              )
          );

        const right =
          Math.max(
            ...row.items
              .map(
                (item) =>
                  item.x
                  + item.width
              )
          );

        const top =
          Math.min(
            ...row.items
              .map(
                (item) =>
                  item.top
              )
          );

        const bottom =
          Math.max(
            ...row.items
              .map(
                (item) =>
                  item.bottom
              )
          );

        return {
          text,
          left,
          right,
          top,
          bottom,
          baselineY:
            row.baselineY
        };
      }
    )
    .filter(
      (row) =>
        Boolean(
          row.text
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


async function cropRenderedPage(
  pageCanvas,
  rect
) {
  const padding = 12;

  const left =
    Math.max(
      0,
      Math.floor(
        rect.left - padding
      )
    );

  const top =
    Math.max(
      0,
      Math.floor(
        rect.top - padding
      )
    );

  const right =
    Math.min(
      pageCanvas.width,
      Math.ceil(
        rect.right + padding
      )
    );

  const bottom =
    Math.min(
      pageCanvas.height,
      Math.ceil(
        rect.bottom + padding
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


async function extractQuestionImagesFromPage(
  page,
  content,
  pageNumber
) {
  const scale =
    2;

  const viewport =
    page.getViewport({
      scale
    });

  const lineRecords =
    groupTextItemsIntoLineRecords(
      content.items,
      viewport
    );

  const questionStarts =
    questionStartsForPage(
      lineRecords
    );

  if (
    !questionStarts.length
  ) {
    return [];
  }

  const imageRects =
    await extractEmbeddedImageRects(
      page,
      viewport
    );

  if (
    !imageRects.length
  ) {
    return [];
  }

  const matchedRects =
    imageRects
      .map(
        (rect) => ({
          rect,
          question_number:
            matchImageRectToQuestion(
              rect,
              questionStarts
            )
        })
      )
      .filter(
        (item) =>
          Number.isInteger(
            item.question_number
          )
      );

  if (
    !matchedRects.length
  ) {
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

  await page
    .render({
      canvasContext:
        context,
      viewport
    })
    .promise;

  const results = [];

  for (
    let index = 0;
    index < matchedRects.length;
    index += 1
  ) {
    const item =
      matchedRects[index];

    setImportStatus(
      `Recortando figura da questão ${item.question_number} — página ${pageNumber}...`
    );

    const blob =
      await cropRenderedPage(
        canvas,
        item.rect
      );

    results.push({
      question_number:
        item.question_number,
      blob
    });
  }

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
  file
) {
  if (!window.pdfjsLib) {
    throw new Error(
      "Leitor de PDF não carregou. Atualize a página e tente novamente."
    );
  }

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
    false;

  for (
    let pageNumber = 1;
    pageNumber <= pdf.numPages;
    pageNumber += 1
  ) {
    setImportStatus(
      `Lendo PDF: página ${pageNumber} de ${pdf.numPages}...`
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
        .filter(
          (line) =>
            !isPdfHeaderLine(
              line
            )
        );

    allLines.push(
      ...lines
    );

    /*
      Detecta imagens raster embutidas e recorta
      diretamente da página renderizada.
      Cabeçalhos, rodapés e logos são ignorados
      por tamanho e posição.
    */
    try {
      const pageImages =
        await extractQuestionImagesFromPage(
          page,
          content,
          pageNumber
        );

      extractedImageEntries.push(
        ...pageImages
      );
    } catch (imageError) {
      /*
        Falhar no recorte nunca deve impedir
        a importação do texto.
      */
      console.warn(
        `Não foi possível recortar imagens da página ${pageNumber}:`,
        imageError
      );
    }
  }

  const defaultSourceLabel =
    medCofDetected
      ? "MedCof QBank"
      : null;

  let blocks =
    extractQuestionBlocks(
      allLines
    );

  let questions =
    questionsFromBlocks(
      blocks,
      defaultSourceLabel
    );

  if (
    questions.length < 2
  ) {
    const looseLines =
      buildLooseTextLines(
        pagesText
      )
        .filter(
          (line) =>
            !isPdfHeaderLine(
              line
            )
        );

    blocks =
      extractQuestionBlocks(
        looseLines
      );

    questions =
      questionsFromBlocks(
        blocks,
        defaultSourceLabel
      );
  }

  if (
    questions.length < 2
  ) {
    throw new Error(
      "Não consegui identificar as questões deste PDF. O arquivo pode estar totalmente escaneado como imagem ou usar uma estrutura ainda não reconhecida."
    );
  }

  const answerKey =
    extractMedCofAnswerKey(
      allLines
    );

  const questionImages =
    await consolidateQuestionImages(
      extractedImageEntries
    );

  if (
    medCofDetected
    && Object.keys(
      answerKey
    ).length
  ) {
    setImportStatus(
      `MedCof reconhecido: ${questions.length} questões, ${Object.keys(answerKey).length} respostas no gabarito e ${questionImages.length} questão(ões) com figura detectada(s). Salvando...`
    );
  } else if (
    questionImages.length
  ) {
    setImportStatus(
      `${questions.length} questões e ${questionImages.length} figura(s) detectadas. Salvando simulado...`
    );
  }

  return {
    questions,
    questionImages,
    answerKey
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

async function uploadQuestionPdf(setId, file) {
  const path =
    `${qsState.user.id}/question_sets/${setId}/${Date.now()}_${safeStorageName(file.name)}`;

  const { error } = await qsSb.storage
    .from("docmap")
    .upload(path, file, {
      contentType: "application/pdf",
      upsert: false
    });

  if (error) throw error;

  return path;
}

async function uploadExtractedQuestionImages(
  setId,
  questionImages
) {
  const paths = {};

  for (
    let index = 0;
    index < questionImages.length;
    index += 1
  ) {
    const image =
      questionImages[index];

    const questionNumber =
      image.question_number;

    setImportStatus(
      `Enviando figura da questão ${questionNumber}...`
    );

    const path =
      `${qsState.user.id}/question_sets/${setId}/images/question-${questionNumber}.png`;

    const {
      error
    } =
      await qsSb
        .storage
        .from("docmap")
        .upload(
          path,
          image.blob,
          {
            contentType:
              "image/png",
            upsert:
              true
          }
        );

    if (error) {
      throw error;
    }

    paths[
      questionNumber
    ] =
      path;
  }

  return paths;
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
  const file = qsState.file;

  if (!file) {
    setImportStatus("Selecione um PDF.", "error");
    return;
  }

  const title =
    document.getElementById("qs-title").value.trim()
    || cleanFileTitle(file.name)
    || "Simulado";

  const button = document.getElementById("qs-import");
  button.disabled = true;

  let setRecord = null;

  try {
    setImportStatus("Criando simulado...");

    setRecord = await createQuestionSet(
      title,
      file
    );

    const [extraction, filePath] = await Promise.all([
      extractQuestionsFromPdf(file),
      uploadQuestionPdf(setRecord.id, file)
    ]);

    const {
      questions,
      questionImages,
      answerKey
    } =
      extraction;

    const imagePaths =
      await uploadExtractedQuestionImages(
        setRecord.id,
        questionImages
      );

    const payload = questions.map((question) => ({
      user_id: qsState.user.id,
      set_id: setRecord.id,
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
    }));

    for (const chunk of chunkArray(payload, 150)) {
      const { error } = await qsSb
        .from("question_items")
        .insert(chunk);

      if (error) throw error;
    }

    const { error: updateError } = await qsSb
      .from("question_sets")
      .update({
        source_file_path: filePath,
        total_questions: questions.length,
        status: "ready",
        error_message: null
      })
      .eq("id", setRecord.id);

    if (updateError) throw updateError;

    setImportStatus(
      `${questions.length} questões extraídas com sucesso. ${questionImages.length} questão(ões) com figura(s) recortada(s).`,
      "success"
    );

    qsState.file = null;
    document.getElementById("qs-file").value = "";
    document.getElementById("qs-file-name").textContent =
      "Selecione um PDF";
    document.getElementById("qs-title").value = "";

    await loadSets();

    switchQsMode(
      "mine"
    );

    await openSet(
      setRecord.id
    );
  } catch (error) {
    console.error(error);

    if (setRecord?.id) {
      await qsSb
        .from("question_sets")
        .update({
          status: "failed",
          error_message: error.message || "Erro ao importar"
        })
        .eq("id", setRecord.id);
    }

    setImportStatus(
      error.message || "Não foi possível importar o PDF.",
      "error"
    );
  } finally {
    button.disabled = false;
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


async function loadQuestionOverview() {
  const monthStart =
    qsMonthStartISO();


  const twelveMonthsStart =
    qsTwelveMonthsStartISO();


  const [
    overallResult,
    monthResult,
    trendResult
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
          monthStart
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
          twelveMonthsStart
        )
        .order(
          "answer_date",
          {
            ascending:
              true
          }
        )
    ]);


  if (
    overallResult.error
  ) {
    console.warn(
      overallResult.error
    );
  }


  if (
    monthResult.error
  ) {
    console.warn(
      monthResult.error
    );
  }


  if (
    trendResult.error
  ) {
    console.warn(
      trendResult.error
    );
  }


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


  const answered =
    Number(
      metrics.answered_questions
      || 0
    );


  const correct =
    Number(
      metrics.correct_questions
      || 0
    );


  const wrong =
    Number(
      metrics.wrong_questions
      || 0
    );


  const generalAccuracy =
    metrics.accuracy_percent === null
    || metrics.accuracy_percent === undefined
      ? null
      : Number(
          metrics.accuracy_percent
        );


  const monthRows =
    monthResult.data
    || [];


  const monthAnswered =
    monthRows.reduce(
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


  const monthCorrect =
    monthRows.reduce(
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


  const monthAccuracy =
    monthAnswered > 0
      ? (
          monthCorrect
          / monthAnswered
        )
        * 100
      : null;


  const setValue =
    document.getElementById(
      "qs-overview-sets"
    );

  const setHelper =
    document.getElementById(
      "qs-overview-sets-helper"
    );

  const questionValue =
    document.getElementById(
      "qs-overview-questions"
    );

  const questionHelper =
    document.getElementById(
      "qs-overview-questions-helper"
    );

  const accuracyValue =
    document.getElementById(
      "qs-overview-accuracy"
    );

  const accuracyHelper =
    document.getElementById(
      "qs-overview-accuracy-helper"
    );

  const monthQuestionValue =
    document.getElementById(
      "qs-month-questions"
    );

  const monthQuestionHelper =
    document.getElementById(
      "qs-month-questions-helper"
    );

  const monthAccuracyValue =
    document.getElementById(
      "qs-month-accuracy"
    );

  const monthAccuracyHelper =
    document.getElementById(
      "qs-month-accuracy-helper"
    );

  const errorValue =
    document.getElementById(
      "qs-overview-errors"
    );

  const errorHelper =
    document.getElementById(
      "qs-overview-errors-helper"
    );


  if (setValue) {
    setValue.textContent =
      Number(
        metrics.completed_sets
        || 0
      );
  }


  if (setHelper) {
    const total =
      Number(
        metrics.total_sets
        || 0
      );


    setHelper.textContent =
      `${total} simulado${total === 1 ? "" : "s"} cadastrado${total === 1 ? "" : "s"}`;
  }


  if (questionValue) {
    questionValue.textContent =
      answered;
  }


  if (questionHelper) {
    questionHelper.textContent =
      `${correct} acertos · ${wrong} erros`;
  }


  if (accuracyValue) {
    accuracyValue.textContent =
      generalAccuracy === null
        ? "—"
        : `${generalAccuracy
            .toFixed(1)
            .replace(".", ",")}%`;
  }


  if (accuracyHelper) {
    accuracyHelper.textContent =
      answered
        ? "Aproveitamento acumulado"
        : "Sem gabaritos ainda";
  }


  if (monthQuestionValue) {
    monthQuestionValue.textContent =
      monthAnswered;
  }


  if (monthQuestionHelper) {
    monthQuestionHelper.textContent =
      `${monthCorrect} acertos no mês atual`;
  }


  if (monthAccuracyValue) {
    monthAccuracyValue.textContent =
      monthAccuracy === null
        ? "—"
        : `${monthAccuracy
            .toFixed(1)
            .replace(".", ",")}%`;
  }


  if (monthAccuracyHelper) {
    monthAccuracyHelper.textContent =
      monthAnswered
        ? `${monthAnswered} questões consideradas`
        : "Sem questões respondidas neste mês";
  }


  if (errorValue) {
    errorValue.textContent =
      Number(
        metrics.sent_to_error_count
        || 0
      );
  }


  if (errorHelper) {
    errorHelper.textContent =
      Number(
        metrics.sent_to_error_count
        || 0
      )
        ? "Questões enviadas desde sempre"
        : "Nenhuma questão enviada ainda";
  }


  const ring =
    document.getElementById(
      "qs-overall-ring"
    );

  const ringValue =
    document.getElementById(
      "qs-overall-ring-value"
    );


  if (ringValue) {
    ringValue.textContent =
      generalAccuracy === null
        ? "—"
        : `${generalAccuracy.toFixed(0)}%`;
  }


  if (ring) {
    ring.style
      .setProperty(
        "--qs-donut-value",
        generalAccuracy === null
          ? 0
          : Math.max(
              0,
              Math.min(
                100,
                generalAccuracy
              )
            )
      );
  }


  const visualCorrect =
    document.getElementById(
      "qs-visual-correct"
    );

  const visualWrong =
    document.getElementById(
      "qs-visual-wrong"
    );

  const correctBar =
    document.getElementById(
      "qs-answer-bar-correct"
    );

  const wrongBar =
    document.getElementById(
      "qs-answer-bar-wrong"
    );

  const barCopy =
    document.getElementById(
      "qs-answer-bar-copy"
    );


  if (visualCorrect) {
    visualCorrect.textContent =
      correct;
  }


  if (visualWrong) {
    visualWrong.textContent =
      wrong;
  }


  const correctShare =
    answered > 0
      ? (
          correct
          / answered
        )
        * 100
      : 0;


  const wrongShare =
    answered > 0
      ? (
          wrong
          / answered
        )
        * 100
      : 0;


  if (correctBar) {
    correctBar.style.width =
      `${correctShare}%`;
  }


  if (wrongBar) {
    wrongBar.style.width =
      `${wrongShare}%`;
  }


  if (barCopy) {
    barCopy.textContent =
      answered > 0
        ? `${correctShare
            .toFixed(1)
            .replace(".", ",")}% corretas · ${wrongShare
            .toFixed(1)
            .replace(".", ",")}% erradas`
        : "Sem respostas salvas.";
  }


  const monthCardQuestions =
    document.getElementById(
      "qs-month-card-questions"
    );

  const monthCardCorrect =
    document.getElementById(
      "qs-month-card-correct"
    );

  const monthCardAccuracy =
    document.getElementById(
      "qs-month-card-accuracy"
    );

  const monthCardCopy =
    document.getElementById(
      "qs-month-card-copy"
    );


  if (monthCardQuestions) {
    monthCardQuestions.textContent =
      monthAnswered;
  }


  if (monthCardCorrect) {
    monthCardCorrect.textContent =
      monthCorrect;
  }


  if (monthCardAccuracy) {
    monthCardAccuracy.textContent =
      monthAccuracy === null
        ? "—"
        : `${monthAccuracy
            .toFixed(1)
            .replace(".", ",")}%`;
  }


  if (monthCardCopy) {
    monthCardCopy.textContent =
      monthAnswered > 0
        ? `${monthCorrect} acertos em ${monthAnswered} questões neste mês.`
        : "Sem atividade no mês.";
  }


  renderMonthlyAccuracyChart(
    qsBuildMonthlySeries(
      trendResult.data
      || []
    )
  );
}


async function loadSets() {
  const [
    setsResult,
    itemsResult,
    attemptsResult
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
      .select("question_item_id,result,sent_to_error")
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

  const items =
    await attachQuestionImageUrls(
      itemsResult.data || []
    );
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

    if (attempt.sent_to_error === true) {
      metric.sent += 1;
    }
  }

  qsState.sets = (setsResult.data || []).map((set) => ({
    ...set,
    metrics: metrics.get(set.id) || {
      answered: 0,
      correct: 0,
      wrong: 0,
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
                  m.answered
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
    window.confirm(
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
        (item) =>
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
                    m.answered
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

async function attachQuestionImageUrls(
  items
) {
  return Promise.all(
    items.map(
      async (item) => {
        if (
          !item.image_path
        ) {
          return {
            ...item,
            image_url: null
          };
        }

        const {
          data,
          error
        } =
          await qsSb
            .storage
            .from("docmap")
            .createSignedUrl(
              item.image_path,
              3600
            );

        if (error) {
          console.warn(
            "Não foi possível abrir a imagem da questão:",
            error
          );

          return {
            ...item,
            image_url: null
          };
        }

        return {
          ...item,
          image_url:
            data?.signedUrl
            || null
        };
      }
    )
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
    attemptsResult
  ] = await Promise.all([
    qsSb
      .from("question_items")
      .select("*")
      .eq("set_id", setId)
      .order("order_index", { ascending: true }),

    qsSb
      .from("question_attempts")
      .select("*")
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
  return qsState.items
    .filter(
      (item) =>
        item.image_path
        && item.image_url
    );
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
            <small>Nenhuma imagem detectada neste simulado.</small>
          </div>
        </div>
      </div>
    `;
  }

  const selectedPath =
    qsState.imageSelections.get(
      item.id
    )
    || "";

  return `
    <div class="qs-error-image-picker full">
      <div class="qs-error-image-picker-head">
        <div>
          <strong>Imagem para o Caderno de Erros</strong>
          <small>
            Opcional. Escolha uma imagem da galeria somente se ela ajudar a revisar este erro.
          </small>
        </div>

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

      <div
        class="qs-error-image-gallery"
        data-error-image-gallery="${qsEscape(item.id)}"
      >
        ${
          images.map(
            (galleryItem) => {
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
                  title="Usar imagem detectada na questão ${galleryItem.question_number}"
                >
                  <img
                    src="${qsEscape(galleryItem.image_url)}"
                    alt="Imagem detectada na questão ${galleryItem.question_number}"
                    loading="lazy"
                  >

                  <span>
                    Questão ${galleryItem.question_number}
                  </span>

                  <small>
                    ${selected ? "Selecionada" : "Selecionar"}
                  </small>
                </button>
              `;
            }
          ).join("")
        }
      </div>

      <p class="qs-error-image-note">
        Depois que os erros forem enviados ao Caderno, esta galeria do simulado será apagada. Imagens selecionadas serão copiadas para o Caderno antes da limpeza.
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


function normalizeOcrAnswerText(
  text
) {
  return String(
    text || ""
  )
    .replace(
      /[|]/g,
      " "
    )
    .replace(
      /[–—]/g,
      "-"
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function parseAnswerPairsFromOcr(
  rawText
) {
  const text =
    normalizeOcrAnswerText(
      rawText
    );

  const found =
    new Map();

  /*
    Exemplos aceitos:
    1 A
    1) A
    1. A
    Q1 A
    Questão 1: A
    1 - A
    e várias duplas na mesma linha.
  */
  const pairRegex =
    /(?:QUEST(?:Ã|A)O\s*|QUESTAO\s*|Q\s*)?(\d{1,3})\s*[\)\.\-:\s]\s*([A-E])\b/gi;

  let match;

  while (
    (
      match =
        pairRegex.exec(
          text
        )
    )
  ) {
    const number =
      Number(
        match[1]
      );

    const answer =
      match[2]
        .toUpperCase();

    if (
      number > 0
      && number <= 500
    ) {
      found.set(
        number,
        {
          question_number:
            number,
          user_answer:
            answer,
          status_hint:
            null
        }
      );
    }
  }

  /*
    Alguns sistemas mostram apenas:
    Questão 12 correta
    Questão 13 errada
  */
  const statusRegex =
    /(?:QUEST(?:Ã|A)O\s*|QUESTAO\s*|Q\s*)?(\d{1,3})\s*[\)\.\-:\s]*.*?\b(CORRETA|CORRETO|CERTA|CERTO|ERRADA|ERRADO|INCORRETA|INCORRETO)\b/gi;

  while (
    (
      match =
        statusRegex.exec(
          text
        )
    )
  ) {
    const number =
      Number(
        match[1]
      );

    const word =
      match[2]
        .toUpperCase();

    const status =
      /ERRAD|INCORRET/
        .test(
          word
        )
        ? "wrong"
        : "correct";

    const previous =
      found.get(
        number
      );

    found.set(
      number,
      {
        question_number:
          number,
        user_answer:
          previous?.user_answer
          || null,
        status_hint:
          status
      }
    );
  }

  return Array.from(
    found.values()
  );
}


function classifyAnswerTilePixel(
  red,
  green,
  blue
) {
  /*
    Verde = acerto.
    Rosa/vermelho claro = erro.
    Azul = questão atualmente selecionada
    no QBank (o resultado pode estar escondido
    pela seleção).
  */

  if (
    green >= 145
    && red >= 85
    && blue >= 85
    && green >= red + 8
    && green >= blue + 5
  ) {
    return 2;
  }

  if (
    red >= 175
    && green >= 105
    && blue >= 105
    && red >= green + 8
    && red >= blue + 8
  ) {
    return 1;
  }

  if (
    blue >= 145
    && blue >= red + 30
    && blue >= green + 18
    && red <= 180
  ) {
    return 3;
  }

  return 0;
}


async function prepareScreenshotForColorAnalysis(
  file
) {
  const bitmap =
    await createImageBitmap(
      file
    );

  const maxSide =
    1200;

  const scale =
    Math.min(
      1,
      maxSide
      / Math.max(
        bitmap.width,
        bitmap.height
      )
    );

  const width =
    Math.max(
      1,
      Math.round(
        bitmap.width
        * scale
      )
    );

  const height =
    Math.max(
      1,
      Math.round(
        bitmap.height
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
        alpha: false,
        willReadFrequently:
          true
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


function medianNumber(
  values
) {
  if (!values.length) {
    return 0;
  }

  const sorted =
    [...values]
      .sort(
        (a, b) =>
          a - b
      );

  const middle =
    Math.floor(
      sorted.length / 2
    );

  if (
    sorted.length % 2
  ) {
    return sorted[
      middle
    ];
  }

  return (
    sorted[
      middle - 1
    ]
    + sorted[
      middle
    ]
  ) / 2;
}


function findColoredAnswerTiles(
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

  const {
    data
  } =
    context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );

  const width =
    canvas.width;

  const height =
    canvas.height;

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
      classifyAnswerTilePixel(
        data[offset],
        data[offset + 1],
        data[offset + 2]
      );
  }

  const components = [];

  const minSide =
    Math.max(
      16,
      Math.floor(
        Math.min(
          width,
          height
        ) * 0.025
      )
    );

  const maxSide =
    Math.max(
      70,
      Math.floor(
        Math.min(
          width,
          height
        ) * 0.32
      )
    );

  for (
    let start = 0;
    start < mask.length;
    start += 1
  ) {
    const colorCode =
      mask[start];

    if (!colorCode) {
      continue;
    }

    const stack = [
      start
    ];

    mask[start] =
      0;

    let count = 0;

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

      count += 1;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (x > 0) {
        const left =
          current - 1;

        if (
          mask[left]
          === colorCode
        ) {
          mask[left] = 0;
          stack.push(left);
        }
      }

      if (
        x < width - 1
      ) {
        const right =
          current + 1;

        if (
          mask[right]
          === colorCode
        ) {
          mask[right] = 0;
          stack.push(right);
        }
      }

      if (y > 0) {
        const up =
          current - width;

        if (
          mask[up]
          === colorCode
        ) {
          mask[up] = 0;
          stack.push(up);
        }
      }

      if (
        y < height - 1
      ) {
        const down =
          current + width;

        if (
          mask[down]
          === colorCode
        ) {
          mask[down] = 0;
          stack.push(down);
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

    /*
      Remove:
      - ícones pequenos do cabeçalho;
      - barra azul de progresso;
      - áreas grandes que não são botões.
    */
    if (
      componentWidth < minSide
      || componentHeight < minSide
      || componentWidth > maxSide
      || componentHeight > maxSide
      || ratio < 0.62
      || ratio > 1.55
      || fill < 0.42
    ) {
      continue;
    }

    components.push({
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
          minX + maxX
        ) / 2,
      centerY:
        (
          minY + maxY
        ) / 2,
      color_code:
        colorCode,
      status_hint:
        colorCode === 2
          ? "correct"
          : colorCode === 1
            ? "wrong"
            : "selected"
    });
  }

  return components;
}


function sortAnswerTilesAsGrid(
  tiles
) {
  if (!tiles.length) {
    return [];
  }

  const rowTolerance =
    Math.max(
      10,
      medianNumber(
        tiles.map(
          (tile) =>
            tile.height
        )
      ) * 0.65
    );

  const byY =
    [...tiles]
      .sort(
        (a, b) =>
          a.centerY
          - b.centerY
      );

  const rows = [];

  for (
    const tile
    of byY
  ) {
    let row =
      rows.find(
        (candidate) =>
          Math.abs(
            candidate.centerY
            - tile.centerY
          ) <= rowTolerance
      );

    if (!row) {
      row = {
        centerY:
          tile.centerY,
        tiles: []
      };

      rows.push(
        row
      );
    }

    row.tiles.push(
      tile
    );

    row.centerY =
      row.tiles.reduce(
        (
          total,
          item
        ) =>
          total
          + item.centerY,
        0
      )
      / row.tiles.length;
  }

  rows.sort(
    (a, b) =>
      a.centerY
      - b.centerY
  );

  return rows.flatMap(
    (row) =>
      row.tiles
        .sort(
          (a, b) =>
            a.centerX
            - b.centerX
        )
  );
}


function parseAnswerSummaryCounts(
  rawText,
  fallbackTotal
) {
  const text =
    normalizeOcrAnswerText(
      rawText
    );

  const fraction =
    text.match(
      /(\d{1,3})\s*\/\s*(\d{1,3})/
    );

  const total =
    fraction
      ? Number(
          fraction[2]
        )
      : Number(
          fallbackTotal
          || 0
        );

  if (!total) {
    return null;
  }

  const afterFraction =
    fraction
      ? text.slice(
          fraction.index
          + fraction[0].length
        )
      : text;

  const numbers =
    (
      afterFraction.match(
        /\d{1,3}/g
      )
      || []
    )
      .map(Number)
      .filter(
        (value) =>
          value >= 0
          && value <= total
      );

  /*
    Procura um par cujo total seja igual ao
    número de questões concluídas.
    No exemplo:
    20/20   ✓ 2   × 18   10%
  */
  for (
    let first = 0;
    first < numbers.length;
    first += 1
  ) {
    for (
      let second =
        first + 1;
      second < numbers.length;
      second += 1
    ) {
      const correct =
        numbers[first];

      const wrong =
        numbers[second];

      if (
        correct + wrong
        === total
      ) {
        return {
          total,
          correct,
          wrong
        };
      }
    }
  }

  return null;
}


function matchOcrNumbersToTiles(
  tiles,
  ocrData
) {
  const words =
    ocrData?.words
    || [];

  const matches =
    new Map();

  for (
    const word
    of words
  ) {
    const cleaned =
      String(
        word.text
        || ""
      )
        .replace(
          /[^\d]/g,
          ""
        );

    if (!cleaned) {
      continue;
    }

    const number =
      Number(
        cleaned
      );

    if (
      number < 1
      || number > 500
    ) {
      continue;
    }

    const bbox =
      word.bbox;

    if (!bbox) {
      continue;
    }

    const centerX =
      (
        bbox.x0
        + bbox.x1
      ) / 2;

    const centerY =
      (
        bbox.y0
        + bbox.y1
      ) / 2;

    const tile =
      tiles.find(
        (candidate) =>
          centerX
            >= candidate.left - 3
          && centerX
            <= candidate.right + 3
          && centerY
            >= candidate.top - 3
          && centerY
            <= candidate.bottom + 3
      );

    if (tile) {
      matches.set(
        tile,
        number
      );
    }
  }

  return matches;
}


function resolveSelectedTileColors(
  mapped,
  summary
) {
  if (!summary) {
    return mapped;
  }

  const correctKnown =
    mapped.filter(
      (item) =>
        item.status_hint
        === "correct"
    ).length;

  const wrongKnown =
    mapped.filter(
      (item) =>
        item.status_hint
        === "wrong"
    ).length;

  const selected =
    mapped.filter(
      (item) =>
        item.status_hint
        === "selected"
    );

  if (!selected.length) {
    return mapped;
  }

  const missingCorrect =
    Math.max(
      0,
      summary.correct
      - correctKnown
    );

  const missingWrong =
    Math.max(
      0,
      summary.wrong
      - wrongKnown
    );

  if (
    missingCorrect
      + missingWrong
    !== selected.length
  ) {
    return mapped;
  }

  /*
    Normalmente existe uma única questão azul:
    a questão ativa. Se o resumo diz 2 acertos
    e já encontramos 2 verdes, ela só pode
    ser um erro.
  */
  if (
    missingCorrect === 0
  ) {
    selected.forEach(
      (item) => {
        item.status_hint =
          "wrong";

        item.inferred_from_summary =
          true;
      }
    );

    return mapped;
  }

  if (
    missingWrong === 0
  ) {
    selected.forEach(
      (item) => {
        item.status_hint =
          "correct";

        item.inferred_from_summary =
          true;
      }
    );

    return mapped;
  }

  return mapped;
}


async function recognizeColoredAnswerGrid(
  file,
  fileIndex,
  fileCount
) {
  const canvas =
    await prepareScreenshotForColorAnalysis(
      file
    );

  const tiles =
    sortAnswerTilesAsGrid(
      findColoredAnswerTiles(
        canvas
      )
    );

  if (
    tiles.length < 2
  ) {
    return {
      detections: [],
      tileCount: 0,
      summary: null,
      ocrText: ""
    };
  }

  const expectedItems =
    [...qsState.items]
      .sort(
        (a, b) =>
          a.question_number
          - b.question_number
      );

  let ocrResult =
    null;

  const needsOcr =
    tiles.some(
      (tile) =>
        tile.status_hint
        === "selected"
    )
    || tiles.length
      !== expectedItems.length;

  if (
    needsOcr
    && window.Tesseract
  ) {
    setAnswerImportStatus(
      `Reconhecendo grade por cores — print ${fileIndex + 1} de ${fileCount}...`
    );

    ocrResult =
      await window
        .Tesseract
        .recognize(
          canvas,
          "eng"
        );
  }

  const numberMatches =
    ocrResult
      ? matchOcrNumbersToTiles(
          tiles,
          ocrResult.data
        )
      : new Map();

  let mapped = [];

  /*
    Se a imagem contém exatamente a grade inteira,
    a ordem visual já corresponde à ordem das
    questões. Isso evita depender de OCR.
  */
  if (
    tiles.length
    === expectedItems.length
  ) {
    mapped =
      tiles.map(
        (tile, index) => ({
          ...tile,
          question_number:
            numberMatches.get(
              tile
            )
            || expectedItems[
              index
            ]?.question_number
            || index + 1
        })
      );
  } else {
    mapped =
      tiles
        .map(
          (tile) => ({
            ...tile,
            question_number:
              numberMatches.get(
                tile
              )
              || null
          })
        )
        .filter(
          (tile) =>
            Number.isInteger(
              tile.question_number
            )
        );
  }

  const summary =
    ocrResult
      ? parseAnswerSummaryCounts(
          ocrResult.data?.text
          || "",
          expectedItems.length
        )
      : null;

  mapped =
    resolveSelectedTileColors(
      mapped,
      summary
    );

  return {
    detections:
      mapped.map(
        (tile) => ({
          question_number:
            tile.question_number,

          user_answer:
            null,

          status_hint:
            (
              tile.status_hint
              === "correct"
              || tile.status_hint
                === "wrong"
            )
              ? tile.status_hint
              : null,

          color_status:
            tile.color_code
            === 2
              ? "green"
              : tile.color_code
                === 1
                  ? "red"
                  : "blue",

          inferred_from_summary:
            Boolean(
              tile.inferred_from_summary
            )
        })
      ),

    tileCount:
      tiles.length,

    summary,

    ocrText:
      ocrResult?.data?.text
      || ""
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
  const official =
    item.official_answer
    || null;

  const userAnswer =
    detected?.user_answer
    || null;

  const statusHint =
    detected?.status_hint
    || null;

  let result =
    null;

  if (
    official === "X"
  ) {
    result =
      "annulled";
  } else if (
    statusHint
    === "correct"
    || statusHint
    === "wrong"
  ) {
    result =
      statusHint;
  } else if (
    official
    && userAnswer
  ) {
    result =
      official === userAnswer
        ? "correct"
        : "wrong";
  }

  return {
    item_id:
      item.id,
    question_number:
      item.question_number,
    official_answer:
      official,
    user_answer:
      userAnswer,

    detected_status:
      statusHint,

    color_status:
      detected?.color_status
      || null,

    inferred_from_summary:
      Boolean(
        detected
          ?.inferred_from_summary
      ),

    result
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

  const recognized =
    rows.filter(
      (row) =>
        Boolean(
          row.user_answer
          || row.result
        )
    );

  table.innerHTML = `
    <div class="qs-answer-import-grid qs-answer-import-head">
      <span>Questão</span>
      <span>Reconhecida</span>
      <span>Oficial</span>
      <span>Resultado</span>
    </div>

    ${
      rows.map(
        (row) => {
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

          return `
            <div
              class="qs-answer-import-grid qs-answer-import-row ${statusClass}"
              data-import-question="${row.question_number}"
            >
              <strong>
                ${row.question_number}
              </strong>

              ${
                row.detected_status
                  ? `
                    <select
                      data-import-result-status="${row.question_number}"
                      aria-label="Resultado reconhecido da questão ${row.question_number}"
                    >
                      <option value="">Revisar</option>
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
                    </select>

                    <small class="qs-color-read-note">
                      ${
                        row.color_status === "green"
                          ? "cor verde"
                          : row.color_status === "red"
                            ? "cor vermelha"
                            : row.inferred_from_summary
                              ? "azul resolvido pelo resumo"
                              : "cor azul"
                      }
                    </small>
                  `
                  : `
                    <select
                      data-import-user-answer="${row.question_number}"
                      aria-label="Resposta reconhecida da questão ${row.question_number}"
                    >
                      <option value="">—</option>
                      ${
                        ["A","B","C","D","E"]
                          .map(
                            (option) => `
                              <option
                                value="${option}"
                                ${row.user_answer === option ? "selected" : ""}
                              >
                                ${option}
                              </option>
                            `
                          )
                          .join("")
                      }
                    </select>
                  `
              }

              <span class="qs-answer-official">
                ${row.official_answer || "—"}
              </span>

              <span class="qs-answer-import-result">
                ${statusLabel}
              </span>
            </div>
          `;
        }
      ).join("")
    }
  `;

  table
    .querySelectorAll(
      "[data-import-user-answer]"
    )
    .forEach(
      (select) => {
        select.addEventListener(
          "change",
          () => {
            const number =
              Number(
                select.dataset
                  .importUserAnswer
              );

            const row =
              qsState
                .answerImportRows
                .find(
                  (candidate) =>
                    candidate
                      .question_number
                    === number
                );

            if (!row) {
              return;
            }

            row.user_answer =
              select.value
              || null;

            if (
              row.official_answer
              === "X"
            ) {
              row.result =
                "annulled";
            } else if (
              row.official_answer
              && row.user_answer
            ) {
              row.result =
                row.official_answer
                === row.user_answer
                  ? "correct"
                  : "wrong";
            } else {
              row.result =
                null;
            }

            renderAnswerImportPreview();
          }
        );
      }
    );

  table
    .querySelectorAll(
      "[data-import-result-status]"
    )
    .forEach(
      (select) => {
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
                  (candidate) =>
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
      !recognized.some(
        (row) =>
          row.result
          === "correct"
          || row.result
          === "wrong"
          || row.result
          === "annulled"
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
    setAnswerImportStatus(
      "Preparando gabarito oficial..."
    );

    await ensureOfficialAnswerKey();

    const detected =
      new Map();

    let colorTilesFound =
      0;

    for (
      let index = 0;
      index < files.length;
      index += 1
    ) {
      const file =
        files[index];

      setAnswerImportStatus(
        `Analisando cores — print ${index + 1} de ${files.length}...`
      );

      /*
        MÉTODO PRINCIPAL:
        detecta o fundo verde/vermelho dos botões.
        Não depende de ler A/B/C/D/E.
      */
      const colorResult =
        await recognizeColoredAnswerGrid(
          file,
          index,
          files.length
        );

      colorTilesFound +=
        colorResult.tileCount;

      for (
        const item
        of colorResult.detections
      ) {
        if (
          item.status_hint
        ) {
          detected.set(
            item.question_number,
            item
          );
        }
      }

      /*
        FALLBACK:
        se não encontrou uma grade colorida,
        tenta o método textual antigo.
      */
      if (
        colorResult.tileCount < 2
        && window.Tesseract
      ) {
        setAnswerImportStatus(
          `Cores não reconhecidas. Tentando leitura de texto — print ${index + 1} de ${files.length}...`
        );

        const canvas =
          await prepareScreenshotForOcr(
            file
          );

        const result =
          await window
            .Tesseract
            .recognize(
              canvas,
              "eng"
            );

        const pairs =
          parseAnswerPairsFromOcr(
            result?.data?.text
            || ""
          );

        for (
          const pair
          of pairs
        ) {
          detected.set(
            pair.question_number,
            pair
          );
        }
      }
    }

    qsState.answerImportRows =
      qsState.items
        .map(
          (item) =>
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
          (row) =>
            row.result
            === "correct"
            || row.result
            === "wrong"
            || row.result
            === "annulled"
        )
        .length;

    const unresolvedCount =
      qsState.answerImportRows
        .filter(
          (row) =>
            !row.result
        )
        .length;

    if (
      recognizedCount
    ) {
      setAnswerImportStatus(
        `${recognizedCount} resultado(s) reconhecido(s) pela cor.${
          colorTilesFound
            ? ` ${colorTilesFound} botão(ões) colorido(s) detectado(s).`
            : ""
        }${
          unresolvedCount
            ? ` ${unresolvedCount} questão(ões) precisam de conferência.`
            : " Confira a prévia e aplique."
        }`,
        "success"
      );
    } else {
      setAnswerImportStatus(
        "Não consegui reconhecer o padrão de cores deste print. Tente recortar a imagem deixando a grade de questões visível.",
        "error"
      );
    }
  } catch (error) {
    console.error(error);

    setAnswerImportStatus(
      `Não foi possível analisar o print: ${error.message || "erro desconhecido"}`,
      "error"
    );
  } finally {
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
        (row) =>
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
        (row) => {
          const item =
            qsState.items.find(
              (candidate) =>
                candidate.id
                === row.item_id
            );

          const previous =
            qsState.attempts.get(
              row.item_id
            );

          const treatedAsCorrect =
            row.result
            === "correct"
            || row.result
            === "annulled";

          return {
            user_id:
              qsState.user.id,

            question_item_id:
              row.item_id,

            result:
              treatedAsCorrect
                ? "correct"
                : "wrong",

            area:
              treatedAsCorrect
                ? null
                : previous?.area
                  || null,

            materia:
              treatedAsCorrect
                ? null
                : previous?.materia
                  || null,

            correct_option:
              row.result
              === "wrong"
              && row.official_answer
              && row.official_answer
                !== "X"
                ? row.official_answer
                : null,

            ccq:
              treatedAsCorrect
                ? null
                : previous?.ccq
                  || null,

            what_i_thought:
              treatedAsCorrect
                ? null
                : previous
                    ?.what_i_thought
                  || null,

            sent_to_error:
              previous
                ?.sent_to_error
              || false,

            error_entry_id:
              previous
                ?.error_entry_id
              || null,

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

    /*
      PRIVACIDADE:
      depois de usado, o print é descartado.
      Ele nunca foi enviado ao Supabase.
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

    await Promise.all([
      loadSets(),
      openSet(
        qsState.currentSet.id
      ),
      loadQuestionOverview()
    ]);

    setAnswerStatus(
      `${appliedCount} resultado(s) importado(s) do print. Os arquivos de imagem foram descartados do navegador.`,
      "success"
    );
  } catch (error) {
    console.error(error);

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


function renderQuestions() {
  const container =
    document.getElementById("qs-question-list");

  container.innerHTML =
    qsState.items.map((item) => {
      const attempt =
        qsState.attempts.get(item.id);

      const wrong =
        attempt?.result === "wrong";

      const sent =
        attempt?.sent_to_error === true;

      return `
        <article
          class="qs-question ${wrong ? "wrong" : ""} ${sent ? "sent" : ""}"
          data-question-id="${qsEscape(item.id)}"
        >
          <div class="qs-question-main">
            <div class="qs-number">${item.question_number}</div>

            <div class="qs-question-title">
              <strong>${qsEscape(questionExcerpt(item))}</strong>
              <small>${qsEscape(item.source_label || "Sem identificação de banca")}</small>
            </div>

            <label class="qs-wrong-toggle">
              <input
                type="checkbox"
                data-wrong-toggle="${qsEscape(item.id)}"
                ${wrong ? "checked" : ""}
              >
              <span>Errei</span>
            </label>
          </div>

          <details>
            <summary>Ver questão extraída</summary>
            <pre class="qs-question-text">${qsEscape(item.raw_text)}</pre>
          </details>

          <div class="qs-error-fields">
            <label class="qs-field">
              <span>Área *</span>
              <select data-error-area="${qsEscape(item.id)}">
                ${areaOptionsHtml(attempt?.area || "")}
              </select>
            </label>

            <label class="qs-field">
              <span>Matéria <small>(opcional)</small></span>
              <input
                type="text"
                data-error-materia="${qsEscape(item.id)}"
                value="${qsEscape(attempt?.materia || "")}"
                placeholder="Ex.: Cardiologia"
              >
            </label>

            <label class="qs-field">
              <span>Resposta correta *</span>
              <select data-correct-option="${qsEscape(item.id)}">
                ${correctOptionHtml(attempt?.correct_option || "")}
              </select>
            </label>

            <label class="qs-field full">
              <span>CCQ <small>(obrigatório para enviar ao Caderno de Erros)</small></span>
              <input
                type="text"
                data-error-ccq="${qsEscape(item.id)}"
                value="${qsEscape(attempt?.ccq || "")}"
                placeholder="Ex.: Quando indicar sulfato de magnésio na eclâmpsia?"
              >
            </label>

            <label class="qs-field full">
              <span>O que pensei <small>(opcional)</small></span>
              <textarea
                data-thought="${qsEscape(item.id)}"
                placeholder="Se quiser, registre rapidamente por que errou."
              >${qsEscape(attempt?.what_i_thought || "")}</textarea>
            </label>

            ${renderErrorImagePicker(item)}
          </div>

          <span class="qs-sent-badge">
            Já enviado ao Caderno de Erros
          </span>
        </article>
      `;
    }).join("");

  document
    .querySelectorAll("[data-wrong-toggle]")
    .forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const card =
          checkbox.closest(".qs-question");

        card.classList.toggle(
          "wrong",
          checkbox.checked
        );

        updateLiveSummary();
      });
    });

  bindErrorImagePickerEvents(
    container
  );

  updateLiveSummary();
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

  const wrong =
    currentWrongIds().length;

  const correct =
    Math.max(0, total - wrong);

  document.getElementById("qs-summary-total").textContent =
    total;

  document.getElementById("qs-summary-correct").textContent =
    correct;

  document.getElementById("qs-summary-wrong").textContent =
    wrong;

  document.getElementById("qs-summary-accuracy").textContent =
    accuracy(correct, total);
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

  return {
    area,
    materia,
    correctOption,
    ccq,
    thought,
    imagePath
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
          result: "correct",
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

      if (!metadata.area || !metadata.correctOption) {
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

async function compressNotebookGalleryBlob(blob) {
  if (!blob || !blob.type?.startsWith("image/")) return blob;

  try {
    const bitmap = await createImageBitmap(blob);
    const maxDimension = 1100;
    const scale = Math.min(
      1,
      maxDimension / bitmap.width,
      maxDimension / bitmap.height
    );

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const toBlob = (quality) =>
      new Promise((resolve) =>
        canvas.toBlob(resolve, "image/webp", quality)
      );

    let result = await toBlob(0.68);
    if (result && result.size > 420 * 1024) {
      result = await toBlob(0.55);
    }

    return result || blob;
  } catch (error) {
    console.warn("Não foi possível comprimir a imagem do Caderno:", error);
    return blob;
  }
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

  const destinationPath =
    `${qsState.user.id}/error_notebook/${errorEntryId}/question.webp`;

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

  const {
    data: rows,
    error: fetchError
  } =
    await qsSb
      .from(
        "question_items"
      )
      .select(
        "id,image_path"
      )
      .eq(
        "set_id",
        qsState.currentSet.id
      );

  if (fetchError) {
    throw fetchError;
  }

  const imageRows =
    (rows || [])
      .filter(
        (row) =>
          Boolean(
            row.image_path
          )
      );

  if (
    !imageRows.length
  ) {
    qsState.imageSelections.clear();

    return {
      removed: 0,
      storageWarning: false
    };
  }

  /*
    Primeiro tira as imagens da galeria no banco.
    Assim elas somem da interface mesmo se o Storage
    demorar ou falhar ao apagar um arquivo órfão.
  */
  const {
    error: updateError
  } =
    await qsSb
      .from(
        "question_items"
      )
      .update({
        image_path: null
      })
      .in(
        "id",
        imageRows.map(
          (row) =>
            row.id
        )
      );

  if (updateError) {
    throw updateError;
  }

  const paths =
    Array.from(
      new Set(
        imageRows.map(
          (row) =>
            row.image_path
        )
      )
    );

  const {
    error: storageError
  } =
    await qsSb
      .storage
      .from(
        "docmap"
      )
      .remove(
        paths
      );

  qsState.imageSelections.clear();

  return {
    removed:
      paths.length,
    storageWarning:
      Boolean(
        storageError
      )
  };
}


async function sendErrorsToNotebook() {
  if (!qsState.currentSet) return;


  const wrongAttempts =
    Array.from(
      qsState.attempts.values()
    ).filter(
      (attempt) =>
        attempt.result === "wrong"
        && !attempt.sent_to_error
    );


  if (!wrongAttempts.length) {
    setAnswerStatus(
      "Não há erros novos para enviar. Salve o gabarito primeiro.",
      "error"
    );

    return;
  }


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
      `Preencha o CCQ nas questões: ${missingCcq.join(", ")}.`,
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
        Salva o CCQ e eventuais
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
      `${sent} ${
        sent === 1
          ? "erro enviado"
          : "erros enviados"
      } ao Caderno de Erros.${
        galleryCleanup.removed
          ? ` Galeria temporária limpa (${galleryCleanup.removed} imagem${galleryCleanup.removed === 1 ? "" : "s"}).`
          : ""
      }${
        galleryCleanup.storageWarning
          ? " Algumas imagens antigas podem permanecer no Storage, mas não ficam mais visíveis na galeria."
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
    window.confirm(
      `Excluir "${set.title}" e o gabarito associado?`
    );

  if (!confirmed) return;

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
      .eq(
        "set_id",
        setId
      );


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
  qsState.attempts = new Map();

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
    await window.ResibulandoStudyMode
      ?.load?.();

  if (
    window.ResibulandoStudyMode
      ?.areasFor
  ) {
    AREA_OPTIONS =
      window.ResibulandoStudyMode
        .areasFor(
          mode
          || window.resibulandoStudyMode
          || "medicine"
        );
  }

  window.addEventListener(
    "resibulando:study-mode",
    (event) => {
      AREA_OPTIONS =
        event.detail?.areas
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

  switchQsAddMode(
    "automatic"
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
