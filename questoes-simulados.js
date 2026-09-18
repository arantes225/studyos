const qsSb = window.supabaseClient;

const qsState = {
  user: null,
  file: null,
  sets: [],
  currentSet: null,
  items: [],
  attempts: new Map()
};

const AREA_OPTIONS = [
  "Clínica Médica",
  "Pediatria",
  "Ginecologia e Obstetrícia",
  "Cirurgia Geral",
  "Preventiva"
];

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
  const normalized = line.toLowerCase();

  return (
    normalized === "aristo"
    || (
      normalized.includes("atividade:")
      && normalized.includes("impresso em:")
    )
  );
}

function parseQuestionBlock(lines, orderIndex) {
  const first = lines[0] || "";

  const match = first.match(
    /^(\d{1,3})\.\s*(?:\[([^\]]+)\])?\s*(.*)$/
  );

  if (!match) return null;

  const number = Number(match[1]);
  const sourceLabel = (match[2] || "").trim() || null;
  const firstStem = (match[3] || "").trim();

  const contentLines = [
    firstStem,
    ...lines.slice(1)
  ].filter(Boolean);

  const stemLines = [];
  const alternatives = {};
  let currentAlternative = null;

  for (const line of contentLines) {
    const alternativeMatch = line.match(
      /^([A-E])(?:[\)\.\-:]|\s)\s*(.*)$/
    );

    if (alternativeMatch) {
      currentAlternative = alternativeMatch[1];
      alternatives[currentAlternative] =
        alternativeMatch[2].trim();
      continue;
    }

    if (currentAlternative) {
      alternatives[currentAlternative] =
        normalizeLine(
          `${alternatives[currentAlternative] || ""} ${line}`
        );
    } else {
      stemLines.push(line);
    }
  }

  const rawText = [
    `${number}. ${sourceLabel ? `[${sourceLabel}] ` : ""}${firstStem}`.trim(),
    ...lines.slice(1)
  ].join("\n");

  return {
    question_number: number,
    order_index: orderIndex,
    source_label: sourceLabel,
    stem: stemLines.join(" ").trim() || null,
    alternatives,
    raw_text: rawText.trim()
  };
}

async function extractQuestionsFromPdf(file) {
  if (!window.pdfjsLib) {
    throw new Error("Leitor de PDF não carregou. Atualize a página e tente novamente.");
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const buffer = await file.arrayBuffer();

  const pdf = await window.pdfjsLib
    .getDocument({ data: buffer })
    .promise;

  const allLines = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    setImportStatus(
      `Lendo PDF: página ${pageNumber} de ${pdf.numPages}...`
    );

    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const lines = groupTextItemsIntoLines(content.items)
      .filter((line) => !isPdfHeaderLine(line));

    allLines.push(...lines);
  }

  const blocks = [];
  let current = null;

  for (const line of allLines) {
    const startMatch = line.match(
      /^(\d{1,3})\.\s*(?:\[[^\]]+\])?/
    );

    if (startMatch) {
      if (current?.lines?.length) {
        blocks.push(current);
      }

      current = {
        number: Number(startMatch[1]),
        lines: [line]
      };

      continue;
    }

    if (current) {
      current.lines.push(line);
    }
  }

  if (current?.lines?.length) {
    blocks.push(current);
  }

  const questions = blocks
    .map((block, index) =>
      parseQuestionBlock(
        block.lines,
        index + 1
      )
    )
    .filter(Boolean);

  if (questions.length < 2) {
    throw new Error(
      "Não consegui identificar as questões. Este PDF pode ser escaneado como imagem; OCR automático entra numa etapa posterior."
    );
  }

  return questions;
}

async function createQuestionSet(title, file) {
  const { data, error } = await qsSb
    .from("question_sets")
    .insert({
      user_id: qsState.user.id,
      title,
      source_file_name: file.name,
      status: "processing"
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

    const [questions, filePath] = await Promise.all([
      extractQuestionsFromPdf(file),
      uploadQuestionPdf(setRecord.id, file)
    ]);

    const payload = questions.map((question) => ({
      user_id: qsState.user.id,
      set_id: setRecord.id,
      ...question
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
      `${questions.length} questões extraídas com sucesso.`,
      "success"
    );

    qsState.file = null;
    document.getElementById("qs-file").value = "";
    document.getElementById("qs-file-name").textContent =
      "Selecione um PDF";
    document.getElementById("qs-title").value = "";

    await loadSets();
    await openSet(setRecord.id);
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


async function loadQuestionOverview() {
  const {
    data,
    error
  } = await qsSb
    .from("question_metrics_overall")
    .select(
      "completed_sets,total_sets,answered_questions,correct_questions,wrong_questions,sent_to_error_count,accuracy_percent"
    )
    .maybeSingle();


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

  const errorValue =
    document.getElementById(
      "qs-overview-errors"
    );

  const errorHelper =
    document.getElementById(
      "qs-overview-errors-helper"
    );


  if (error) {
    console.warn(
      "Não foi possível carregar as métricas de simulados:",
      error.message
    );

    if (setValue) setValue.textContent = "—";
    if (questionValue) questionValue.textContent = "—";
    if (accuracyValue) accuracyValue.textContent = "—";
    if (errorValue) errorValue.textContent = "—";

    return;
  }


  const metrics =
    data || {
      completed_sets: 0,
      total_sets: 0,
      answered_questions: 0,
      correct_questions: 0,
      wrong_questions: 0,
      sent_to_error_count: 0,
      accuracy_percent: null
    };


  if (setValue) {
    setValue.textContent =
      Number(
        metrics.completed_sets
        || 0
      );
  }


  if (setHelper) {
    const totalSets =
      Number(
        metrics.total_sets
        || 0
      );

    setHelper.textContent =
      `${totalSets} ${
        totalSets === 1
          ? "simulado importado"
          : "simulados importados"
      }`;
  }


  if (questionValue) {
    questionValue.textContent =
      Number(
        metrics.answered_questions
        || 0
      );
  }


  if (questionHelper) {
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

    questionHelper.textContent =
      `${correct} acertos · ${wrong} erros`;
  }


  if (accuracyValue) {
    accuracyValue.textContent =
      metrics.accuracy_percent === null
        || metrics.accuracy_percent === undefined
          ? "—"
          : `${Number(
              metrics.accuracy_percent
            ).toFixed(1)
             .replace(".", ",")}%`;
  }


  if (accuracyHelper) {
    accuracyHelper.textContent =
      Number(
        metrics.answered_questions
        || 0
      )
        ? "Aproveitamento de todos os gabaritos"
        : "Sem gabaritos ainda";
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
        ? "Erros já transformados em revisão"
        : "Nenhum erro enviado ainda";
  }
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

  const items = itemsResult.data || [];
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

function renderSetHistory() {
  const container =
    document.getElementById("qs-history");

  const count =
    document.getElementById("qs-set-count");

  count.textContent =
    `${qsState.sets.length} ${
      qsState.sets.length === 1
        ? "simulado"
        : "simulados"
    }`;

  if (!qsState.sets.length) {
    container.innerHTML =
      '<div class="qs-empty">Nenhum simulado importado ainda.</div>';
    return;
  }

  container.innerHTML =
    qsState.sets.map((set) => {
      const m = set.metrics;
      const isActive =
        qsState.currentSet?.id === set.id;

      return `
        <article class="qs-set-card ${isActive ? "active" : ""}">
          <h3>${qsEscape(set.title)}</h3>
          <p>
            ${set.total_questions || 0} questões ·
            ${set.status === "ready" ? "pronto" : qsEscape(set.status)}
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
              <strong>${accuracy(m.correct, m.answered)}</strong>
            </div>
          </div>

          <div class="qs-set-actions">
            <button
              class="qs-mini-button primary"
              type="button"
              data-open-set="${qsEscape(set.id)}"
            >
              Abrir
            </button>

            <button
              class="qs-mini-button danger"
              type="button"
              data-delete-set="${qsEscape(set.id)}"
            >
              Excluir
            </button>
          </div>
        </article>
      `;
    }).join("");

  document
    .querySelectorAll("[data-open-set]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        openSet(
          button.dataset.openSet
        );
      });
    });

  document
    .querySelectorAll("[data-delete-set]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        deleteSet(
          button.dataset.deleteSet
        );
      });
    });
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

  const items = itemsResult.data || [];
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

  return {
    area,
    materia,
    correctOption,
    ccq,
    thought
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
      `${sent} ${
        sent === 1
          ? "erro enviado"
          : "erros enviados"
      } ao Caderno de Erros.`,
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

  if (set.source_file_path) {
    const { error: storageError } =
      await qsSb.storage
        .from("docmap")
        .remove([
          set.source_file_path
        ]);

    if (storageError) {
      console.warn(storageError);
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
}

function closeCurrentSet() {
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

async function initQuestionSets() {
  qsState.user =
    window.docmapUser;

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
