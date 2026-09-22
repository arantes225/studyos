const examSb =
  window.supabaseClient;


let examUser =
  null;

let examRows =
  [];

const selectedExamIds =
  new Set();

let examPageMode =
  "list";

let examModeBeforeDialog =
  "list";

let examSimulationMetrics =
  new Map();


const examParams =
  new URLSearchParams(
    window.location.search
  );


const highlightedExamId =
  examParams.get(
    "exam_id"
  );


function normalizeNationalLabel(
  value
) {
  return String(
    value ?? ""
  )
    .replace(
      /\bNac\.(?=\s|$)/gi,
      "Nacional"
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function examEscape(
  value
) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}


function examIsUuid(
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


function examFormatDate(
  value
) {
  if (!value) {
    return "—";
  }


  const [
    year,
    month,
    day
  ] =
    value
      .split("-")
      .map(Number);


  return new Intl
    .DateTimeFormat(
      "pt-BR",
      {
        day:
          "2-digit",

        month:
          "2-digit",

        year:
          "numeric"
      }
    )
    .format(
      new Date(
        year,
        month - 1,
        day
      )
    );
}


function examFormatMoney(
  value
) {
  if (
    value === null
    || value === undefined
    || value === ""
  ) {
    return "—";
  }


  return new Intl
    .NumberFormat(
      "pt-BR",
      {
        style:
          "currency",

        currency:
          "BRL"
      }
    )
    .format(
      Number(value)
    );
}


function examStatusLabel(
  status
) {
  const map = {
    planned:
      "Planejada",

    registered:
      "Inscrita",

    taken:
      "Realizada",

    cancelled:
      "Cancelada"
  };


  return (
    map[status]
    || status
    || "Planejada"
  );
}


function examScoreLabel(
  value
) {
  if (
    value === null
    || value === undefined
  ) {
    return "—";
  }


  return `${Number(value)
    .toFixed(1)
    .replace(
      ".",
      ","
    )}%`;
}


function setExamFormStatus(
  text,
  type = ""
) {
  const element =
    document.getElementById(
      "exam-form-status"
    );


  if (!element) {
    return;
  }


  element.textContent =
    text;


  element.className =
    `exam-status-message ${type}`
      .trim();
}


function filteredExams() {
  const status =
    document
      .getElementById(
        "exam-status-filter"
      )
      ?.value
    || "";


  const search =
    document
      .getElementById(
        "exam-search"
      )
      ?.value
      .trim()
      .toLowerCase()
    || "";


  return examRows
    .filter(
      (exam) => {
        if (
          status
          && exam.status
            !== status
        ) {
          return false;
        }


        if (!search) {
          return true;
        }


        return [
          exam.institution,
          exam.board,
          exam.notes,
          exam.result_notes
        ]
          .filter(
            Boolean
          )
          .join(" ")
          .toLowerCase()
          .includes(
            search
          );
      }
    );
}


function examSortValue(
  exam
) {
  if (
    exam.status === "cancelled"
  ) {
    return 4;
  }


  if (
    exam.status === "taken"
  ) {
    return 3;
  }


  if (
    exam.status === "registered"
  ) {
    return 1;
  }


  return 0;
}



function updateExamBulkToolbar() {
  const visible =
    filteredExams()
      .map(
        (exam) =>
          exam.id
      );


  const selectedVisible =
    visible.filter(
      (id) =>
        selectedExamIds.has(
          id
        )
    ).length;


  const count =
    document.getElementById(
      "exam-selected-count"
    );


  const button =
    document.getElementById(
      "exam-delete-selected"
    );


  const selectAll =
    document.getElementById(
      "exam-select-all"
    );


  if (count) {
    count.textContent =
      `${selectedExamIds.size} selecionada${selectedExamIds.size === 1 ? "" : "s"}`;
  }


  if (button) {
    button.disabled =
      selectedExamIds.size === 0;
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


async function deleteSelectedExams() {
  const ids =
    Array.from(
      selectedExamIds
    );


  if (!ids.length) {
    return;
  }


  const confirmed = await window.LuriaDialog.confirm(
      `Excluir ${ids.length} prova${ids.length === 1 ? "" : "s"}? Os simulados vinculados não serão apagados.`
    );


  if (!confirmed) {
    return;
  }


  const {
    error
  } =
    await examSb
      .from(
        "exams"
      )
      .delete()
      .in(
        "id",
        ids
      );


  if (error) {
    window.LuriaDialog.alert(
      `Não foi possível excluir: ${error.message}`
    );

    return;
  }


  selectedExamIds.clear();


  await Promise.all([
    loadExams(),
    loadExamMetrics(),
    loadExamSimulationMetrics()
  ]);


  renderExams();
}



function setExamPageMode(
  mode
) {
  if (
    ![
      "list",
      "new",
      "edit"
    ].includes(
      mode
    )
  ) {
    mode =
      "list";
  }


  examPageMode =
    mode;


  document
    .querySelectorAll(
      "[data-exam-mode]"
    )
    .forEach(
      (button) => {
        button.classList.toggle(
          "active",
          button.dataset
            .examMode === mode
        );
      }
    );


  const ownContent =
    document.getElementById(
      "editais-own-content"
    );


  ownContent
    ?.classList
    .toggle(
      "exam-management-mode",
      mode === "edit"
    );


  if (
    mode !== "edit"
  ) {
    selectedExamIds.clear();


    const selectAll =
      document.getElementById(
        "exam-select-all"
      );


    if (selectAll) {
      selectAll.checked =
        false;

      selectAll.indeterminate =
        false;
    }
  }


  renderExams();
}


function openNewExamFromMenu() {
  examModeBeforeDialog =
    examPageMode === "edit"
      ? "edit"
      : "list";


  setExamPageMode(
    "new"
  );


  openExamDialog();
}


function returnFromExamDialog() {
  if (
    examPageMode === "new"
  ) {
    setExamPageMode(
      examModeBeforeDialog
      || "list"
    );
  }
}


async function updateExamStatusInline(
  examId,
  status,
  select
) {
  if (
    ![
      "planned",
      "registered",
      "taken",
      "cancelled"
    ].includes(
      status
    )
  ) {
    return;
  }

  const exam =
    examRows.find(
      (item) =>
        item.id === examId
    );

  if (!exam) {
    return;
  }

  const previous =
    exam.status;

  if (
    previous === status
  ) {
    return;
  }

  if (select) {
    select.disabled =
      true;
  }

  const {
    error
  } =
    await examSb
      .from(
        "exams"
      )
      .update({
        status
      })
      .eq(
        "id",
        examId
      );

  if (select) {
    select.disabled =
      false;
  }

  if (error) {
    console.error(
      error
    );

    if (select) {
      select.value =
        previous;
    }

    window.LuriaDialog.alert(
      `Não foi possível alterar o status: ${error.message}`
    );

    return;
  }

  exam.status =
    status;

  await loadExamMetrics();

  renderExams();
}


function renderExams() {
  const list =
    document.getElementById(
      "exam-list"
    );


  const empty =
    document.getElementById(
      "exam-empty"
    );


  if (
    !list
    || !empty
  ) {
    return;
  }


  const exams =
    filteredExams()
      .slice()
      .sort(
        (
          a,
          b
        ) => {
          const statusDiff =
            examSortValue(a)
            - examSortValue(b);


          if (
            statusDiff !== 0
          ) {
            return statusDiff;
          }


          return String(
            a.exam_date
            || "9999-12-31"
          )
            .localeCompare(
              String(
                b.exam_date
                || "9999-12-31"
              )
            );
        }
      );


  if (
    !exams.length
  ) {
    list.innerHTML =
      "";

    empty.hidden =
      false;

    updateExamBulkToolbar();

    return;
  }


  empty.hidden =
    true;


  list.innerHTML =
    exams
      .map(
        (exam) => {
          const metrics =
            examSimulationMetrics
              .get(
                exam.id
              );


          const simulationText =
            metrics
              ? `${metrics.simulation_count} ${
                  Number(
                    metrics.simulation_count
                  ) === 1
                    ? "simulado"
                    : "simulados"
                } · ${metrics.answered_questions} questões · ${
                  metrics.accuracy_percent === null
                  || metrics.accuracy_percent === undefined
                    ? "—"
                    : `${Number(
                        metrics.accuracy_percent
                      )
                        .toFixed(1)
                        .replace(
                          ".",
                          ","
                        )}%`
                } de acerto`
              : "Nenhum simulado vinculado ainda.";


          const highlighted =
            highlightedExamId
            === exam.id;

          return `
            <article
              class="exam-card ${
                highlighted
                  ? "highlight"
                  : ""
              }"
              data-exam-card="${examEscape(
                exam.id
              )}"
            >

              <label
                class="exam-card-select"
                aria-label="Selecionar prova"
              >
                <input
                  type="checkbox"
                  data-select-exam="${examEscape(
                    exam.id
                  )}"
                  ${selectedExamIds.has(exam.id) ? "checked" : ""}
                >
              </label>

              <div class="exam-card-top">

                <div class="exam-card-title">

                  <h3>
                    ${examEscape(
                      normalizeNationalLabel(
                        exam.institution
                      )
                    )}
                  </h3>

                  <p>
                    ${examEscape(
                      normalizeNationalLabel(
                        exam.board
                      )
                      || "Banca não informada"
                    )}
                  </p>

                </div>


                <label class="exam-quick-status">
                  <span>Status</span>

                  <select
                    data-exam-status-quick="${examEscape(exam.id)}"
                    aria-label="Alterar status de ${examEscape(exam.institution)}"
                  >
                    <option value="planned" ${exam.status === "planned" ? "selected" : ""}>
                      Planejada
                    </option>

                    <option value="registered" ${exam.status === "registered" ? "selected" : ""}>
                      Inscrita
                    </option>

                    <option value="taken" ${exam.status === "taken" ? "selected" : ""}>
                      Realizada
                    </option>

                    <option value="cancelled" ${exam.status === "cancelled" ? "selected" : ""}>
                      Cancelada
                    </option>
                  </select>
                </label>

              </div>


              <div class="exam-card-grid">

                <div class="exam-card-info">
                  <span>Inscrição</span>
                  <strong>
                    ${examEscape(
                      examFormatDate(
                        exam.registration_deadline
                      )
                    )}
                  </strong>
                </div>


                <div class="exam-card-info">
                  <span>Prova</span>
                  <strong>
                    ${examEscape(
                      examFormatDate(
                        exam.exam_date
                      )
                    )}
                  </strong>
                </div>


                <div class="exam-card-info">
                  <span>Taxa</span>
                  <strong>
                    ${examEscape(
                      examFormatMoney(
                        exam.fee
                      )
                    )}
                  </strong>
                </div>


                <div class="exam-card-info">
                  <span>Resultado</span>
                  <strong>
                    ${examEscape(
                      examScoreLabel(
                        exam.score_percent
                      )
                    )}
                  </strong>
                </div>

              </div>


              <div class="exam-simulation-summary">
                <strong>Simulados:</strong>
                ${examEscape(
                  simulationText
                )}
              </div>


              ${
                exam.notes
                  ? `
                    <p class="exam-notes">
                      ${examEscape(
                        exam.notes
                      )}
                    </p>
                  `
                  : ""
              }


              ${
                exam.result_notes
                  ? `
                    <p class="exam-notes">
                      <strong>Resultado:</strong>
                      ${examEscape(
                        exam.result_notes
                      )}
                    </p>
                  `
                  : ""
              }


              <div class="exam-card-actions">

                <button
                  class="button secondary"
                  type="button"
                  data-edit-exam="${examEscape(
                    exam.id
                  )}"
                >
                  Editar
                </button>


                ${
                  exam.edital_url
                    ? `
                      <a
                        class="exam-link-button"
                        href="${examEscape(
                          exam.edital_url
                        )}"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Edital
                      </a>
                    `
                    : ""
                }


                ${
                  exam.registration_url
                    ? `
                      <a
                        class="exam-link-button"
                        href="${examEscape(
                          exam.registration_url
                        )}"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Inscrição
                      </a>
                    `
                    : ""
                }


                <button
                  class="button secondary exam-delete"
                  type="button"
                  data-delete-exam="${examEscape(
                    exam.id
                  )}"
                >
                  Excluir
                </button>

              </div>

            </article>
          `;
        }
      )
      .join("");


  list
    .querySelectorAll(
      "[data-select-exam]"
    )
    .forEach(
      (input) => {
        input.addEventListener(
          "change",
          () => {
            const id =
              input.dataset
                .selectExam;


            if (input.checked) {
              selectedExamIds.add(
                id
              );

            } else {
              selectedExamIds.delete(
                id
              );
            }


            updateExamBulkToolbar();
          }
        );
      }
    );


  updateExamBulkToolbar();


  list
    .querySelectorAll(
      "[data-exam-status-quick]"
    )
    .forEach(
      (select) => {
        select.addEventListener(
          "change",
          () => {
            updateExamStatusInline(
              select.dataset
                .examStatusQuick,

              select.value,

              select
            );
          }
        );
      }
    );


  list
    .querySelectorAll(
      "[data-edit-exam]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            examModeBeforeDialog =
              examPageMode;

            openExamDialog(
              button
                .dataset
                .editExam
            );
          }
        );
      }
    );


  list
    .querySelectorAll(
      "[data-delete-exam]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            deleteExam(
              button
                .dataset
                .deleteExam
            );
          }
        );
      }
    );


  if (
    highlightedExamId
  ) {
    requestAnimationFrame(
      () => {
        const card =
          document.querySelector(
            `[data-exam-card="${CSS.escape(
              highlightedExamId
            )}"]`
          );


        card?.scrollIntoView({
          behavior:
            "smooth",

          block:
            "center"
        });
      }
    );
  }
}


async function loadExamMetrics() {
  const {
    data,
    error
  } =
    await examSb
      .from(
        "exam_metrics_overall"
      )
      .select(
        "total_exams,upcoming_exams,registered_exams,taken_exams,deadlines_next_30_days,average_score_percent"
      )
      .maybeSingle();


  if (error) {
    console.warn(
      "Não foi possível carregar as métricas de provas:",
      error.message
    );

    return;
  }


  const metrics =
    data || {
      upcoming_exams:
        0,

      registered_exams:
        0,

      taken_exams:
        0,

      average_score_percent:
        null
    };


  document
    .getElementById(
      "exam-metric-upcoming"
    )
    .textContent =
      Number(
        metrics.upcoming_exams
        || 0
      );


  document
    .getElementById(
      "exam-metric-registered"
    )
    .textContent =
      Number(
        metrics.registered_exams
        || 0
      );


  document
    .getElementById(
      "exam-metric-taken"
    )
    .textContent =
      Number(
        metrics.taken_exams
        || 0
      );


  document
    .getElementById(
      "exam-metric-score"
    )
    .textContent =
      metrics.average_score_percent === null
      || metrics.average_score_percent === undefined
        ? "—"
        : `${Number(
            metrics.average_score_percent
          )
            .toFixed(1)
            .replace(
              ".",
              ","
            )}%`;
}


async function loadExamSimulationMetrics() {
  const {
    data,
    error
  } =
    await examSb
      .from(
        "exam_simulation_metrics"
      )
      .select(
        "exam_id,simulation_count,answered_questions,correct_questions,wrong_questions,accuracy_percent"
      );


  if (error) {
    console.warn(
      "Não foi possível carregar os simulados vinculados:",
      error.message
    );

    examSimulationMetrics =
      new Map();

    return;
  }


  examSimulationMetrics =
    new Map(
      (data || [])
        .map(
          (row) => [
            row.exam_id,
            row
          ]
        )
    );
}


async function loadExams() {
  const {
    data,
    error
  } =
    await examSb
      .from(
        "exams"
      )
      .select(
        "id,institution,board,exam_date,registration_deadline,fee,notes,status,edital_url,registration_url,score_percent,result_notes,cutoff_history,created_at,updated_at"
      )
      .order(
        "exam_date",
        {
          ascending:
            true,

          nullsFirst:
            false
        }
      );


  if (error) {
    console.error(
      error
    );

    return;
  }


  examRows =
    data || [];


  renderExams();
}


function examLatestCutoffValue(
  history
) {
  if (
    !Array.isArray(history)
    || !history.length
  ) {
    return "";
  }

  const first =
    history[0];

  const value =
    Number(
      first?.score
    );

  return Number.isFinite(
    value
  )
    ? value
    : "";
}


function clearExamForm() {
  document
    .getElementById(
      "exam-id"
    )
    .value =
      "";


  document
    .getElementById(
      "exam-institution"
    )
    .value =
      "";


  document
    .getElementById(
      "exam-board"
    )
    .value =
      "";


  document
    .getElementById(
      "exam-status"
    )
    .value =
      "planned";


  [
    "exam-registration-deadline",
    "exam-date",
    "exam-fee",
    "exam-score",
    "exam-cutoff",
    "exam-edital-url",
    "exam-registration-url",
    "exam-notes",
    "exam-result-notes"
  ].forEach(
    (id) => {
      document
        .getElementById(
          id
        )
        .value =
          "";
    }
  );


  setExamFormStatus(
    ""
  );
}


function openExamDialog(
  examId = null
) {
  const dialog =
    document.getElementById(
      "exam-dialog"
    );


  clearExamForm();


  if (
    examId
  ) {
    const exam =
      examRows.find(
        (item) =>
          item.id
          === examId
      );


    if (!exam) {
      return;
    }


    document
      .getElementById(
        "exam-dialog-title"
      )
      .textContent =
        "Editar prova";


    document
      .getElementById(
        "exam-id"
      )
      .value =
        exam.id;


    document
      .getElementById(
        "exam-institution"
      )
      .value =
        normalizeNationalLabel(
          exam.institution
        )
        || "";


    document
      .getElementById(
        "exam-board"
      )
      .value =
        normalizeNationalLabel(
          exam.board
        )
        || "";


    document
      .getElementById(
        "exam-status"
      )
      .value =
        exam.status
        || "planned";


    document
      .getElementById(
        "exam-registration-deadline"
      )
      .value =
        exam.registration_deadline
        || "";


    document
      .getElementById(
        "exam-date"
      )
      .value =
        exam.exam_date
        || "";


    document
      .getElementById(
        "exam-fee"
      )
      .value =
        exam.fee
        ?? "";


    document
      .getElementById(
        "exam-score"
      )
      .value =
        exam.score_percent
        ?? "";


    document
      .getElementById(
        "exam-cutoff"
      )
      .value =
        examLatestCutoffValue(
          exam.cutoff_history
        );


    document
      .getElementById(
        "exam-edital-url"
      )
      .value =
        exam.edital_url
        || "";


    document
      .getElementById(
        "exam-registration-url"
      )
      .value =
        exam.registration_url
        || "";


    document
      .getElementById(
        "exam-notes"
      )
      .value =
        exam.notes
        || "";


    document
      .getElementById(
        "exam-result-notes"
      )
      .value =
        exam.result_notes
        || "";


  } else {
    document
      .getElementById(
        "exam-dialog-title"
      )
      .textContent =
        "Nova prova";
  }


  dialog.showModal();
}


function closeExamDialog() {
  document
    .getElementById(
      "exam-dialog"
    )
    ?.close();


  returnFromExamDialog();
}


async function saveExam() {
  const id =
    document
      .getElementById(
        "exam-id"
      )
      .value;


  const wasCreating =
    !id;


  const institution =
    normalizeNationalLabel(
      document
        .getElementById(
          "exam-institution"
        )
        .value
    );


  if (!institution) {
    setExamFormStatus(
      "Informe a instituição.",
      "error"
    );

    return;
  }


  const feeRaw =
    document
      .getElementById(
        "exam-fee"
      )
      .value;


  const scoreRaw =
    document
      .getElementById(
        "exam-score"
      )
      .value;


  const cutoffRaw =
    document
      .getElementById(
        "exam-cutoff"
      )
      .value;


  const payload = {
    user_id:
      examUser.id,

    institution,

    board:
      normalizeNationalLabel(
        document
          .getElementById(
            "exam-board"
          )
          .value
      )
      || null,

    status:
      document
        .getElementById(
          "exam-status"
        )
        .value,

    registration_deadline:
      document
        .getElementById(
          "exam-registration-deadline"
        )
        .value
      || null,

    exam_date:
      document
        .getElementById(
          "exam-date"
        )
        .value
      || null,

    fee:
      feeRaw === ""
        ? null
        : Number(
            feeRaw
          ),

    score_percent:
      scoreRaw === ""
        ? null
        : Number(
            scoreRaw
          ),


    cutoff_history:
      cutoffRaw === ""
        ? []
        : [
            {
              year: "",
              score:
                Number(
                  cutoffRaw
                )
            }
          ],

    edital_url:
      document
        .getElementById(
          "exam-edital-url"
        )
        .value
        .trim()
      || null,

    registration_url:
      document
        .getElementById(
          "exam-registration-url"
        )
        .value
        .trim()
      || null,

    notes:
      document
        .getElementById(
          "exam-notes"
        )
        .value
        .trim()
      || null,

    result_notes:
      document
        .getElementById(
          "exam-result-notes"
        )
        .value
        .trim()
      || null
  };


  const button =
    document.getElementById(
      "exam-save"
    );


  button.disabled =
    true;


  setExamFormStatus(
    "Salvando..."
  );


  let result;


  if (id) {
    result =
      await examSb
        .from(
          "exams"
        )
        .update(
          payload
        )
        .eq(
          "id",
          id
        );


  } else {
    result =
      await examSb
        .from(
          "exams"
        )
        .insert(
          payload
        );
  }


  button.disabled =
    false;


  if (
    result.error
  ) {
    console.error(
      result.error
    );


    setExamFormStatus(
      `Não foi possível salvar: ${result.error.message}`,
      "error"
    );


    return;
  }


  closeExamDialog();


  await Promise.all([
    loadExams(),
    loadExamMetrics(),
    loadExamSimulationMetrics()
  ]);

  /*
    O módulo visual v16 mantém um cache próprio das notas de corte.
    Após criar/editar uma prova, sincroniza esse cache antes de
    redesenhar os cards para que a nota de corte apareça imediatamente.
  */
  if (
    typeof window.refreshExamV16 ===
    "function"
  ) {
    try {
      await window.refreshExamV16();
    } catch (error) {
      console.warn(
        "Não foi possível atualizar a nota de corte no card:",
        error
      );
    }
  }


  if (
    wasCreating
  ) {
    setExamPageMode(
      "list"
    );

  } else {
    renderExams();
  }
}


async function deleteExam(
  id
) {
  const exam =
    examRows.find(
      (item) =>
        item.id
        === id
    );


  if (!exam) {
    return;
  }


  const confirmed = await window.LuriaDialog.confirm(
      `Excluir "${exam.institution}"?\n\nOs simulados vinculados não serão apagados; apenas deixarão de ficar vinculados à prova.`
    );


  if (!confirmed) {
    return;
  }


  const {
    error
  } =
    await examSb
      .from(
        "exams"
      )
      .delete()
      .eq(
        "id",
        id
      );


  if (error) {
    window.LuriaDialog.alert(
      `Não foi possível excluir: ${error.message}`
    );

    return;
  }


  await Promise.all([
    loadExams(),
    loadExamMetrics(),
    loadExamSimulationMetrics()
  ]);


  renderExams();
}


function wireExams() {

  document
    .querySelectorAll(
      "[data-exam-mode]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            const mode =
              button.dataset
                .examMode;


            if (
              mode === "new"
            ) {
              openNewExamFromMenu();

              return;
            }


            setExamPageMode(
              mode
            );
          }
        );
      }
    );


  document
    .getElementById(
      "exam-select-all"
    )
    ?.addEventListener(
      "change",
      (event) => {
        const ids =
          filteredExams()
            .map(
              (exam) =>
                exam.id
            );


        for (
          const id
          of ids
        ) {
          if (
            event.target.checked
          ) {
            selectedExamIds.add(
              id
            );

          } else {
            selectedExamIds.delete(
              id
            );
          }
        }


        renderExams();
      }
    );


  document
    .getElementById(
      "exam-delete-selected"
    )
    ?.addEventListener(
      "click",
      deleteSelectedExams
    );


  document
    .getElementById(
      "new-exam"
    )
    ?.addEventListener(
      "click",
      () =>
        openExamDialog()
    );


  document
    .getElementById(
      "exam-dialog-close"
    )
    ?.addEventListener(
      "click",
      closeExamDialog
    );


  document
    .getElementById(
      "exam-cancel"
    )
    ?.addEventListener(
      "click",
      closeExamDialog
    );


  document
    .getElementById(
      "exam-form"
    )
    ?.addEventListener(
      "submit",
      async (
        event
      ) => {
        event.preventDefault();

        await saveExam();
      }
    );


  document
    .getElementById(
      "exam-status-filter"
    )
    ?.addEventListener(
      "change",
      renderExams
    );


  document
    .getElementById(
      "exam-search"
    )
    ?.addEventListener(
      "input",
      renderExams
    );
}



/* =========================================================
   CENTRAL DE EDITAIS
   ========================================================= */

let catalogLegacyFrameLoaded =
  false;


function activateEditaisSource(
  source
) {
  const own =
    document.getElementById(
      "editais-own-content"
    );


  const catalog =
    document.getElementById(
      "editais-catalog-content"
    );


  document
    .querySelectorAll(
      "[data-editais-source]"
    )
    .forEach(
      (button) => {
        button.classList.toggle(
          "active",
          button
            .dataset
            .editaisSource
            === source
        );
      }
    );


  if (own) {
    own.hidden =
      source
      !== "mine";
  }


  if (catalog) {
    catalog.hidden =
      source
      !== "catalog";
  }


  if (
    source
    === "catalog"
  ) {
    if (
      typeof window.loadLuriaExamCatalog
      === "function"
    ) {
      window
        .loadLuriaExamCatalog()
        .catch(
          (error) => {
            console.warn(
              "Não foi possível carregar a central de editais:",
              error
            );
          }
        );
    }
  }


  try {
    localStorage.setItem(
      "docmap:editais-source",
      source
    );
  } catch {}
}


function wireEditaisSources() {
  document
    .querySelectorAll(
      "[data-editais-source]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            activateEditaisSource(
              button
                .dataset
                .editaisSource
            );
          }
        );
      }
    );


  let initial =
    "mine";


  try {
    const saved =
      localStorage.getItem(
        "docmap:editais-source"
      );


    if (
      saved === "catalog"
      || saved === "mine"
    ) {
      initial =
        saved;
    }
  } catch {}


  /*
    Quando a Agenda abre uma
    prova específica, sempre
    priorizamos "Minhas provas".
  */

  if (
    highlightedExamId
  ) {
    initial =
      "mine";
  }


  activateEditaisSource(
    initial
  );
}




async function initExams() {
  examUser =
    window.docmapUser;


  wireEditaisSources();

  wireExams();
  setExamPageMode("list");


  await Promise.all([
    loadExamMetrics(),
    loadExamSimulationMetrics(),
    loadExams()
  ]);


  renderExams();
}


if (
  window.docmapUser
) {
  initExams();


} else {
  window.addEventListener(
    "docmap:ready",
    initExams,
    {
      once:
        true
    }
  );
}
