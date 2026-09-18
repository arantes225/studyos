const examSb =
  window.supabaseClient;


let examUser =
  null;

let examRows =
  [];

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


          const questionUrl =
            `questoes-simulados.html?exam_id=${encodeURIComponent(
              exam.id
            )}&exam_title=${encodeURIComponent(
              exam.institution
            )}`;


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

              <div class="exam-card-top">

                <div class="exam-card-title">

                  <h3>
                    ${examEscape(
                      exam.institution
                    )}
                  </h3>

                  <p>
                    ${examEscape(
                      exam.board
                      || "Banca não informada"
                    )}
                  </p>

                </div>


                <span class="exam-status-badge ${examEscape(
                  exam.status
                )}">
                  ${examEscape(
                    examStatusLabel(
                      exam.status
                    )
                  )}
                </span>

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


                <a
                  class="exam-link-button"
                  href="${examEscape(
                    questionUrl
                  )}"
                >
                  Questões / Simulados
                </a>


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
      "[data-edit-exam]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
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
        "id,institution,board,exam_date,registration_deadline,fee,notes,status,edital_url,registration_url,score_percent,result_notes,created_at,updated_at"
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
        exam.institution
        || "";


    document
      .getElementById(
        "exam-board"
      )
      .value =
        exam.board
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
}


async function saveExam() {
  const id =
    document
      .getElementById(
        "exam-id"
      )
      .value;


  const institution =
    document
      .getElementById(
        "exam-institution"
      )
      .value
      .trim();


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


  const payload = {
    user_id:
      examUser.id,

    institution,

    board:
      document
        .getElementById(
          "exam-board"
        )
        .value
        .trim()
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


  renderExams();
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


  const confirmed =
    window.confirm(
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
    window.alert(
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


async function initExams() {
  examUser =
    window.docmapUser;


  wireExams();


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
