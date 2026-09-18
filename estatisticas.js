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


function formatMinutesFromSeconds(
  seconds
) {
  const minutes =
    Math.round(
      Number(
        seconds
        || 0
      )
      / 60
    );

  if (
    minutes < 60
  ) {
    return `${minutes} min`;
  }

  return formatHours(
    seconds
  );
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

  const previousEnd =
    addDays(
      start,
      -1
    );

  const previousStart =
    addDays(
      previousEnd,
      -(days - 1)
    );

  return {
    start,
    end,
    previousStart,
    previousEnd,

    startISO:
      toISODate(
        start
      ),

    endISO:
      toISODate(
        end
      ),

    previousStartISO:
      toISODate(
        previousStart
      ),

    previousEndISO:
      toISODate(
        previousEnd
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
  value,
  digits = 0
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
  ).toFixed(
    digits
  )}%`;
}


function statsDeltaLabel(
  current,
  previous,
  suffix = "%"
) {
  const currentNumber =
    Number(
      current
    );

  const previousNumber =
    Number(
      previous
    );

  if (
    !Number.isFinite(
      currentNumber
    )
    || !Number.isFinite(
      previousNumber
    )
    || previousNumber === 0
  ) {
    return "sem comparação anterior";
  }

  const delta =
    (
      (
        currentNumber
        - previousNumber
      )
      / previousNumber
    )
    * 100;

  const sign =
    delta > 0
      ? "+"
      : "";

  return `${sign}${delta.toFixed(0)}${suffix} vs. período anterior`;
}


function statsPointDelta(
  current,
  previous
) {
  if (
    current === null
    || previous === null
    || current === undefined
    || previous === undefined
  ) {
    return "sem comparação anterior";
  }

  const delta =
    Number(
      current
    )
    - Number(
        previous
      );

  const sign =
    delta > 0
      ? "+"
      : "";

  return `${sign}${delta.toFixed(1)} p.p. vs. período anterior`;
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


function splitCurrentPrevious(
  rows,
  dateField,
  range
) {
  const current =
    [];

  const previous =
    [];


  for (
    const row
    of rows || []
  ) {
    const date =
      row[dateField];

    if (
      date >= range.startISO
      && date <= range.endISO
    ) {
      current.push(
        row
      );

    } else if (
      date >= range.previousStartISO
      && date <= range.previousEndISO
    ) {
      previous.push(
        row
      );
    }
  }


  return {
    current,
    previous
  };
}


function sumField(
  rows,
  field
) {
  return (
    rows || []
  )
    .reduce(
      (
        sum,
        row
      ) =>
        sum
        + Number(
            row[field]
            || 0
          ),
      0
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


function renderPerformanceBars(
  containerId,
  rows,
  dateField,
  numeratorField,
  denominatorField
) {
  const container =
    document.getElementById(
      containerId
    );

  if (!container) {
    return;
  }


  const start =
    statsDateDaysAgo(
      Math.max(
        0,
        statsState.days - 1
      )
    );


  const map =
    new Map(
      (rows || [])
        .map(
          (row) => [
            row[dateField],

            statsPercent(
              row[numeratorField],
              row[denominatorField]
            )
          ]
        )
    );


  const series =
    Array.from(
      {
        length:
          statsState.days
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
            map.has(
              iso
            )
              ? map.get(
                  iso
                )
              : null
        };
      }
    );


  container.innerHTML =
    series.map(
      (item) => {
        const value =
          item.value;

        const height =
          value === null
            ? 2
            : Math.max(
                4,
                Math.min(
                  100,
                  value
                )
              );


        return `
          <div
            class="performance-bar-column"
            title="${statsEscape(
              `${statsShortDay(
                item.date
              )}: ${
                value === null
                  ? "sem dados"
                  : statsPercentLabel(
                      value,
                      0
                    )
              }`
            )}"
          >
            <div
              class="performance-bar ${
                value === null
                  ? "empty"
                  : ""
              }"
              style="height:${height}%"
            ></div>
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


function renderWeekdays(
  studyRows
) {
  const container =
    document.getElementById(
      "weekday-study-list"
    );

  if (!container) {
    return;
  }


  const labels = [
    "Dom",
    "Seg",
    "Ter",
    "Qua",
    "Qui",
    "Sex",
    "Sáb"
  ];


  const totals =
    Array(
      7
    )
    .fill(
      0
    );


  for (
    const row
    of studyRows || []
  ) {
    const date =
      parseISODate(
        row.study_date
      );

    totals[
      date.getDay()
    ] +=
      Number(
        row.total_seconds
        || 0
      );
  }


  const ordered =
    [
      1,2,3,4,5,6,0
    ]
    .map(
      (dayIndex) => ({
        label:
          labels[
            dayIndex
          ],

        seconds:
          totals[
            dayIndex
          ]
      })
    );


  const maxValue =
    Math.max(
      1,
      ...ordered.map(
        (item) =>
          item.seconds
      )
    );


  container.innerHTML =
    ordered.map(
      (item) => {
        const percent =
          item.seconds
            ? (
                item.seconds
                / maxValue
              )
              * 100
            : 0;


        return `
          <div class="analytics-row">

            <div class="analytics-row-copy">
              <strong>
                ${item.label}
              </strong>
            </div>

            <div class="analytics-progress">
              <span
                style="width:${Math.max(
                  1,
                  percent
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
        8
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
        8
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


function detailCard(
  label,
  value,
  helper = ""
) {
  return `
    <div class="stat-detail">
      <span>
        ${statsEscape(
          label
        )}
      </span>

      <strong>
        ${statsEscape(
          value
        )}
      </strong>

      ${
        helper
          ? `
            <small>
              ${statsEscape(
                helper
              )}
            </small>
          `
          : ""
      }
    </div>
  `;
}


function renderErrorNotebookOverview(
  metrics
) {
  const container =
    document.getElementById(
      "error-notebook-overview"
    );

  if (!container) {
    return;
  }


  const data =
    metrics
    || {};


  container.innerHTML =
    [
      detailCard(
        "Registrados",
        Number(
          data.registered_errors
          || 0
        ),
        "CCQs ativos"
      ),

      detailCard(
        "Já revisados",
        Number(
          data.reviewed_errors
          || 0
        ),
        "ao menos uma leitura"
      ),

      detailCard(
        "Atrasados",
        Number(
          data.overdue_errors
          || 0
        ),
        "data anterior a hoje"
      ),

      detailCard(
        "Retenção",
        statsPercentLabel(
          data.retention_percent,
          0
        ),
        "estimativa atual"
      )
    ]
    .join("");
}


function renderScheduleOverview(
  topics,
  reviews
) {
  const container =
    document.getElementById(
      "schedule-overview"
    );

  if (!container) {
    return;
  }


  const totalTopics =
    (topics || [])
      .length;


  const completedTopics =
    (topics || [])
      .filter(
        (item) =>
          item.status === "completed"
      )
      .length;


  const scheduledTopics =
    (topics || [])
      .filter(
        (item) =>
          item.status === "scheduled"
      )
      .length;


  const deckTopics =
    (topics || [])
      .filter(
        (item) =>
          item.status === "deck"
      )
      .length;


  const completedReviews =
    (reviews || [])
      .filter(
        (item) =>
          Boolean(
            item.completed_at
          )
      )
      .length;


  const pendingReviews =
    (reviews || [])
      .filter(
        (item) =>
          !item.completed_at
      )
      .length;


  const progress =
    totalTopics
      ? (
          completedTopics
          / totalTopics
        )
        * 100
      : null;


  container.innerHTML =
    [
      detailCard(
        "Aulas concluídas",
        `${completedTopics}/${totalTopics}`,
        progress === null
          ? "sem temas"
          : `${progress.toFixed(0)}% do cronograma`
      ),

      detailCard(
        "Programadas",
        scheduledTopics,
        "aulas com data"
      ),

      detailCard(
        "No deck",
        deckTopics,
        "ainda sem data"
      ),

      detailCard(
        "Revisões",
        `${completedReviews}/${completedReviews + pendingReviews}`,
        `${pendingReviews} pendentes`
      )
    ]
    .join("");
}


function renderSimulationOverview(
  metrics
) {
  const container =
    document.getElementById(
      "simulations-overview"
    );

  if (!container) {
    return;
  }


  const data =
    metrics
    || {};


  container.innerHTML =
    [
      detailCard(
        "Simulados concluídos",
        `${Number(
          data.completed_sets
          || 0
        )}/${Number(
          data.total_sets
          || 0
        )}`,
        "concluídos / cadastrados"
      ),

      detailCard(
        "Questões",
        Number(
          data.answered_questions
          || 0
        ),
        "respondidas"
      ),

      detailCard(
        "Acertos",
        Number(
          data.correct_questions
          || 0
        ),
        `${Number(
          data.wrong_questions
          || 0
        )} erros`
      ),

      detailCard(
        "Aproveitamento",
        statsPercentLabel(
          data.accuracy_percent,
          1
        ),
        `${Number(
          data.sent_to_error_count
          || 0
        )} enviados ao Caderno`
      )
    ]
    .join("");
}


function renderExamOverview(
  metrics
) {
  const container =
    document.getElementById(
      "exams-overview"
    );

  if (!container) {
    return;
  }


  const data =
    metrics
    || {};


  container.innerHTML =
    [
      detailCard(
        "Próximas",
        Number(
          data.upcoming_exams
          || 0
        ),
        "planejadas ou inscritas"
      ),

      detailCard(
        "Inscritas",
        Number(
          data.registered_exams
          || 0
        ),
        "status registrado"
      ),

      detailCard(
        "Realizadas",
        Number(
          data.taken_exams
          || 0
        ),
        "provas concluídas"
      ),

      detailCard(
        "Média das provas",
        statsPercentLabel(
          data.average_score_percent,
          1
        ),
        `${Number(
          data.deadlines_next_30_days
          || 0
        )} inscrições vencem em até 30 dias`
      )
    ]
    .join("");
}


function renderInsights({
  studyRows,
  questionRows,
  flashRows,
  retentionRows,
  questionAreaRows,
  errorAreaRows,
  errorMetrics,
  simulationMetrics,
  examMetrics,
  topics,
  reviews
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


  const totalStudy =
    sumField(
      studyRows,
      "total_seconds"
    );


  if (
    activeDays > 0
  ) {
    insights.push({
      title:
        "Ritmo",

      text:
        `Você registrou estudo em ${activeDays} de ${statsState.days} dias, somando ${formatHours(
          totalStudy
        )}.`
    });
  }


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
    insights.push({
      title:
        "Memória",

      text:
        `A menor retenção estimada entre matérias com pelo menos 2 evidências é ${retention.subject}, com ${Number(
          retention.retention_percent
        ).toFixed(0)}%.`
    });
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
    insights.push({
      title:
        "Erros",

      text:
        `A maior concentração atual está em ${highestError[0]}, com ${highestError[1]} registros somando simulados e Caderno.`
    });
  }


  const questionAnswered =
    sumField(
      questionRows,
      "answered_questions"
    );


  const flashReviewed =
    sumField(
      flashRows,
      "total_reviews"
    );


  if (
    questionAnswered
    || flashReviewed
  ) {
    insights.push({
      title:
        "Volume",

      text:
        `No período foram registradas ${questionAnswered} questões respondidas e ${flashReviewed} revisões de flashcards.`
    });
  }


  const overdueErrors =
    Number(
      errorMetrics
        ?.overdue_errors
      || 0
    );


  if (
    overdueErrors > 0
  ) {
    insights.push({
      title:
        "Caderno de Erros",

      text:
        `${overdueErrors} CCQ${overdueErrors === 1 ? "" : "s"} está${overdueErrors === 1 ? "" : "o"} atrasado${overdueErrors === 1 ? "" : "s"} neste momento.`
    });
  }


  const totalTopics =
    (topics || [])
      .length;

  const completedTopics =
    (topics || [])
      .filter(
        (item) =>
          item.status === "completed"
      )
      .length;


  if (
    totalTopics > 0
  ) {
    insights.push({
      title:
        "Cronograma",

      text:
        `${completedTopics} de ${totalTopics} aulas do cronograma estão concluídas (${(
          completedTopics
          / totalTopics
          * 100
        ).toFixed(0)}%).`
    });
  }


  const pendingReviews =
    (reviews || [])
      .filter(
        (item) =>
          !item.completed_at
      )
      .length;


  if (
    pendingReviews > 0
  ) {
    insights.push({
      title:
        "Revisões teóricas",

      text:
        `Há ${pendingReviews} revisão${pendingReviews === 1 ? "" : "ões"} teórica${pendingReviews === 1 ? "" : "s"} ainda não concluída${pendingReviews === 1 ? "" : "s"}.`
    });
  }


  const simAccuracy =
    simulationMetrics
      ?.accuracy_percent;


  if (
    simAccuracy !== null
    && simAccuracy !== undefined
  ) {
    insights.push({
      title:
        "Simulados",

      text:
        `O aproveitamento acumulado nos simulados é de ${Number(
          simAccuracy
        ).toFixed(1)}%.`
    });
  }


  const upcoming =
    Number(
      examMetrics
        ?.upcoming_exams
      || 0
    );


  if (
    upcoming > 0
  ) {
    insights.push({
      title:
        "Provas",

      text:
        `Há ${upcoming} prova${upcoming === 1 ? "" : "s"} futura${upcoming === 1 ? "" : "s"} ou em planejamento no DocMap.`
    });
  }


  if (
    !insights.length
  ) {
    container.innerHTML =
      '<div class="analytics-empty">O DocMap ainda precisa de mais dados para gerar uma leitura útil.</div>';

    return;
  }


  container.innerHTML =
    insights
      .slice(
        0,
        10
      )
      .map(
        (item) =>
          `
            <div class="analytics-insight">
              <strong>
                ${statsEscape(
                  item.title
                )}
              </strong>

              <span>
                ${statsEscape(
                  item.text
                )}
              </span>
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

  const today =
    toISODate(
      new Date()
    );


  const [
    studyResult,
    activityResult,
    questionResult,
    flashResult,
    retentionResult,
    questionAreaResult,
    errorAreaResult,
    errorMetricsResult,
    simulationMetricsResult,
    examMetricsResult,
    topicsResult,
    reviewsResult,
    pendingFlashResult,
    pendingErrorsResult
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
          range.previousStartISO
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
          range.previousStartISO
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
          range.previousStartISO
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
          30
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
          30
        ),

      statsSb
        .from(
          "error_notebook_metrics"
        )
        .select(
          "registered_errors,reviewed_errors,overdue_errors,retention_percent"
        )
        .maybeSingle(),

      statsSb
        .from(
          "question_metrics_overall"
        )
        .select(
          "completed_sets,total_sets,answered_questions,correct_questions,wrong_questions,sent_to_error_count,accuracy_percent"
        )
        .maybeSingle(),

      statsSb
        .from(
          "exam_metrics_overall"
        )
        .select(
          "total_exams,upcoming_exams,registered_exams,taken_exams,deadlines_next_30_days,average_score_percent"
        )
        .maybeSingle(),

      statsSb
        .from(
          "study_topics"
        )
        .select(
          "id,status,scheduled_date,completed_at,already_done"
        ),

      statsSb
        .from(
          "subject_reviews"
        )
        .select(
          "id,scheduled_date,completed_at,stage"
        ),

      statsSb
        .from(
          "flashcards"
        )
        .select(
          "id",
          {
            count:
              "exact",
            head:
              true
          }
        )
        .eq(
          "active",
          true
        )
        .lte(
          "due_date",
          today
        ),

      statsSb
        .from(
          "error_notebook"
        )
        .select(
          "id",
          {
            count:
              "exact",
            head:
              true
          }
        )
        .eq(
          "active",
          true
        )
        .lte(
          "due_date",
          today
        )
    ]);


  const results =
    [
      studyResult,
      activityResult,
      questionResult,
      flashResult,
      retentionResult,
      questionAreaResult,
      errorAreaResult,
      errorMetricsResult,
      simulationMetricsResult,
      examMetricsResult,
      topicsResult,
      reviewsResult,
      pendingFlashResult,
      pendingErrorsResult
    ];


  results.forEach(
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


  const studySplit =
    splitCurrentPrevious(
      studyResult.data || [],
      "study_date",
      range
    );


  const questionSplit =
    splitCurrentPrevious(
      questionResult.data || [],
      "answer_date",
      range
    );


  const flashSplit =
    splitCurrentPrevious(
      flashResult.data || [],
      "review_date",
      range
    );


  const studyRows =
    studySplit.current;

  const previousStudyRows =
    studySplit.previous;

  const activityRows =
    activityResult.data
    || [];

  const questionRows =
    questionSplit.current;

  const previousQuestionRows =
    questionSplit.previous;

  const flashRows =
    flashSplit.current;

  const previousFlashRows =
    flashSplit.previous;

  const retentionRows =
    retentionResult.data
    || [];

  const questionAreaRows =
    questionAreaResult.data
    || [];

  const errorAreaRows =
    errorAreaResult.data
    || [];

  const errorMetrics =
    errorMetricsResult.data
    || null;

  const simulationMetrics =
    simulationMetricsResult.data
    || null;

  const examMetrics =
    examMetricsResult.data
    || null;

  const topics =
    topicsResult.data
    || [];

  const reviews =
    reviewsResult.data
    || [];


  const totalStudySeconds =
    sumField(
      studyRows,
      "total_seconds"
    );


  const previousStudySeconds =
    sumField(
      previousStudyRows,
      "total_seconds"
    );


  const activeStudyDays =
    studyRows.filter(
      (row) =>
        Number(
          row.total_seconds
          || 0
        ) > 0
    ).length;


  const totalSessions =
    sumField(
      studyRows,
      "session_count"
    );


  const averageSessionSeconds =
    totalSessions
      ? totalStudySeconds
        / totalSessions
      : 0;


  const averageActiveDaySeconds =
    activeStudyDays
      ? totalStudySeconds
        / activeStudyDays
      : 0;


  const totalQuestions =
    sumField(
      questionRows,
      "answered_questions"
    );


  const correctQuestions =
    sumField(
      questionRows,
      "correct_questions"
    );


  const previousQuestions =
    sumField(
      previousQuestionRows,
      "answered_questions"
    );


  const previousCorrectQuestions =
    sumField(
      previousQuestionRows,
      "correct_questions"
    );


  const totalFlashReviews =
    sumField(
      flashRows,
      "total_reviews"
    );


  const correctFlash =
    sumField(
      flashRows,
      "correct"
    );


  const previousFlashReviews =
    sumField(
      previousFlashRows,
      "total_reviews"
    );


  const previousCorrectFlash =
    sumField(
      previousFlashRows,
      "correct"
    );


  const questionAccuracy =
    statsPercent(
      correctQuestions,
      totalQuestions
    );


  const previousQuestionAccuracy =
    statsPercent(
      previousCorrectQuestions,
      previousQuestions
    );


  const flashAccuracy =
    statsPercent(
      correctFlash,
      totalFlashReviews
    );


  const previousFlashAccuracy =
    statsPercent(
      previousCorrectFlash,
      previousFlashReviews
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
      statsDeltaLabel(
        totalStudySeconds,
        previousStudySeconds
      );


  document
    .getElementById(
      "analytics-average-active-day"
    )
    .textContent =
      formatHours(
        averageActiveDaySeconds
      );


  document
    .getElementById(
      "analytics-average-active-day-helper"
    )
    .textContent =
      activeStudyDays
        ? `${activeStudyDays} dia${activeStudyDays === 1 ? "" : "s"} com estudo`
        : "sem dias ativos";


  document
    .getElementById(
      "analytics-sessions"
    )
    .textContent =
      totalSessions;


  document
    .getElementById(
      "analytics-sessions-helper"
    )
    .textContent =
      totalSessions
        ? `média de ${formatMinutesFromSeconds(
            averageSessionSeconds
          )}`
        : "sem sessões";


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
      `${(
        activeStudyDays
        / statsState.days
        * 100
      ).toFixed(0)}% dos dias`;


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
        ? `${totalQuestions} questões · ${statsPointDelta(
            questionAccuracy,
            previousQuestionAccuracy
          )}`
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
        ? `${totalFlashReviews} revisões · ${statsPointDelta(
            flashAccuracy,
            previousFlashAccuracy
          )}`
        : "sem revisões no período";


  document
    .getElementById(
      "analytics-error-retention"
    )
    .textContent =
      statsPercentLabel(
        errorMetrics
          ?.retention_percent,
        0
      );


  document
    .getElementById(
      "analytics-error-retention-helper"
    )
    .textContent =
      errorMetrics
        ? `${Number(
            errorMetrics.registered_errors
            || 0
          )} CCQs ativos`
        : "sem dados";


  document
    .getElementById(
      "analytics-simulation-accuracy"
    )
    .textContent =
      statsPercentLabel(
        simulationMetrics
          ?.accuracy_percent,
        1
      );


  document
    .getElementById(
      "analytics-simulation-helper"
    )
    .textContent =
      simulationMetrics
        ? `${Number(
            simulationMetrics.completed_sets
            || 0
          )} simulados concluídos`
        : "sem dados";


  document
    .getElementById(
      "pending-flashcards"
    )
    .textContent =
      pendingFlashResult.count
      ?? 0;


  document
    .getElementById(
      "pending-errors"
    )
    .textContent =
      pendingErrorsResult.count
      ?? 0;


  const pendingReviews =
    reviews.filter(
      (item) =>
        !item.completed_at
        && item.scheduled_date
        <= today
    ).length;


  const pendingLessons =
    topics.filter(
      (item) =>
        item.status === "scheduled"
        && item.scheduled_date
        && item.scheduled_date
        <= today
    ).length;


  document
    .getElementById(
      "pending-subject-reviews"
    )
    .textContent =
      pendingReviews;


  document
    .getElementById(
      "pending-lessons"
    )
    .textContent =
      pendingLessons;


  const trendCopy =
    document.getElementById(
      "study-trend-copy"
    );


  if (trendCopy) {
    trendCopy.textContent =
      previousStudySeconds > 0
        ? `Tempo efetivo por dia · ${statsDeltaLabel(
            totalStudySeconds,
            previousStudySeconds
          )}.`
        : "Tempo efetivo registrado por dia.";
  }


  const questionTrend =
    document.getElementById(
      "question-trend-summary"
    );


  if (questionTrend) {
    questionTrend.textContent =
      totalQuestions
        ? `${statsPercentLabel(
            questionAccuracy
          )} · ${totalQuestions} questões`
        : "sem dados";
  }


  const flashTrend =
    document.getElementById(
      "flash-trend-summary"
    );


  if (flashTrend) {
    flashTrend.textContent =
      totalFlashReviews
        ? `${statsPercentLabel(
            flashAccuracy
          )} · ${totalFlashReviews} revisões`
        : "sem dados";
  }


  renderStudyBars(
    studyRows
  );


  renderPerformanceBars(
    "question-performance-bars",
    questionRows,
    "answer_date",
    "correct_questions",
    "answered_questions"
  );


  renderPerformanceBars(
    "flash-performance-bars",
    flashRows,
    "review_date",
    "correct",
    "total_reviews"
  );


  renderActivity(
    activityRows
  );


  renderWeekdays(
    studyRows
  );


  renderRetention(
    retentionRows
  );


  renderErrors(
    questionAreaRows,
    errorAreaRows
  );


  renderErrorNotebookOverview(
    errorMetrics
  );


  renderScheduleOverview(
    topics,
    reviews
  );


  renderSimulationOverview(
    simulationMetrics
  );


  renderExamOverview(
    examMetrics
  );


  renderInsights({
    studyRows,
    questionRows,
    flashRows,
    retentionRows,
    questionAreaRows,
    errorAreaRows,
    errorMetrics,
    simulationMetrics,
    examMetrics,
    topics,
    reviews
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
