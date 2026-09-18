const statsSb =
  window.supabaseClient;


const statsState = {
  days:
    30
};


function startOfDay(
  date
) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}


function addDays(
  date,
  amount
) {
  const copy =
    startOfDay(
      date
    );

  copy.setDate(
    copy.getDate()
    + amount
  );

  return copy;
}


function toISODate(
  date
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth()
      + 1
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


function parseISODate(
  value
) {
  const [
    year,
    month,
    day
  ] =
    String(
      value
    )
    .split("-")
    .map(
      Number
    );

  return new Date(
    year,
    month - 1,
    day
  );
}


function formatHours(
  totalSeconds
) {
  const seconds =
    Number(
      totalSeconds
      || 0
    );

  if (
    seconds <= 0
  ) {
    return "0h";
  }


  const hours =
    Math.floor(
      seconds / 3600
    );

  const minutes =
    Math.round(
      (
        seconds % 3600
      )
      / 60
    );


  if (
    hours === 0
  ) {
    return `${minutes}min`;
  }


  if (
    minutes === 0
  ) {
    return `${hours}h`;
  }


  return `${hours}h ${minutes}min`;
}


function statsEscape(
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


function statsDateDaysAgo(
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


function statsDateRange(
  days
) {
  const end =
    startOfDay(
      new Date()
    );

  const start =
    statsDateDaysAgo(
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


function statsPercent(
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


function statsPercentLabel(
  value
) {
  if (
    value === null
    || value === undefined
    || Number.isNaN(
      Number(
        value
      )
    )
  ) {
    return "—";
  }

  return `${Number(
    value
  ).toFixed(0)}%`;
}


function statsActivityLabel(
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


function statsShortDay(
  isoDate
) {
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
      parseISODate(
        isoDate
      )
    );
}


function statsBuildDailySeries(
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
    statsDateDaysAgo(
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


function renderStudyBars(
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
    statsBuildDailySeries(
      studyRows,
      "study_date",
      "total_seconds",
      statsState.days
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
      series.length
      * 22
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
            title="${statsEscape(
              `${statsShortDay(
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
                    ${statsEscape(
                      statsShortDay(
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


function renderActivity(
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
                ${statsEscape(
                  statsActivityLabel(
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
              ${statsEscape(
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


function renderRetention(
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
                ${statsEscape(
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


function renderErrors(
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
                ${statsEscape(
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


function renderInsights({
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
    `Estudo registrado em ${activeDays} de ${statsState.days} dias do período.`
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
            ${statsEscape(
              text
            )}
          </div>
        `
    )
    .join("");
}


async function loadStatistics() {
  const range =
    statsDateRange(
      statsState.days
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

      statsSb
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

      statsSb
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

      statsSb
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

      statsSb
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

      statsSb
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

      statsSb
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

      statsSb
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
    statsPercent(
      correctQuestions,
      totalQuestions
    );


  const flashAccuracy =
    statsPercent(
      correctFlash,
      totalFlashReviews
    );


  document
    .getElementById(
      "analytics-study-time"
    )
    .textContent =
      formatHours(
        totalStudySeconds
      );


  document
    .getElementById(
      "analytics-study-time-helper"
    )
    .textContent =
      `${statsState.days} dias selecionados`;


  document
    .getElementById(
      "analytics-consistency"
    )
    .textContent =
      `${activeStudyDays}/${statsState.days}`;


  document
    .getElementById(
      "analytics-consistency-helper"
    )
    .textContent =
      activeStudyDays === 1
        ? "1 dia com estudo"
        : `${activeStudyDays} dias com estudo`;


  document
    .getElementById(
      "analytics-question-accuracy"
    )
    .textContent =
      statsPercentLabel(
        questionAccuracy
      );


  document
    .getElementById(
      "analytics-question-helper"
    )
    .textContent =
      totalQuestions
        ? `${totalQuestions} questões`
        : "sem questões no período";


  document
    .getElementById(
      "analytics-flash-accuracy"
    )
    .textContent =
      statsPercentLabel(
        flashAccuracy
      );


  document
    .getElementById(
      "analytics-flash-helper"
    )
    .textContent =
      totalFlashReviews
        ? `${totalFlashReviews} revisões`
        : "sem revisões no período";


  renderStudyBars(
    studyRows
  );


  renderActivity(
    activityRows
  );


  renderRetention(
    retentionRows
  );


  renderErrors(
    questionAreaRows,
    errorAreaRows
  );


  renderInsights({
    studyRows,
    questionRows,
    flashRows,
    retentionRows,
    questionAreaRows,
    errorAreaRows
  });
}


function wireStatisticsControls() {
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


            statsState.days =
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


            await loadStatistics();
          }
        );
      }
    );
}


async function initStatistics() {
  wireStatisticsControls();

  await loadStatistics();
}


if (
  window.docmapUser
) {
  initStatistics();

} else {
  window.addEventListener(
    "docmap:ready",
    initStatistics,
    {
      once:
        true
    }
  );
}
