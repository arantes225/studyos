(() => {
  "use strict";

  const sb = window.supabaseClient;
  const charts = new Map();

  const state = {
    initialized: false,
    loading: false,
    range: 30,
    tab: "geral",
    bounds: null,
    settings: null,
    sourceErrors: [],
    static: {
      flashcards: [],
      errors: [],
      topics: [],
      subjectReviews: [],
      dailyAccess: [],
      questionSets: []
    },
    period: {
      sessions: [],
      flashReviews: [],
      errorReviews: [],
      questionAttempts: []
    }
  };

  const ACTIVITY = {
    ambientacao: "Ambientação",
    lesson: "Aulas",
    flashcards: "Flashcards",
    error_notebook: "Caderno de erros",
    subject_review: "Revisão teórica",
    free_study: "Estudo livre"
  };

  const $ = id => document.getElementById(id);
  const css = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

  function esc(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function startDay(d = new Date()) {
    return new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate()
    );
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return startDay(x);
  }

  function parseDate(v) {
    if (!v) return null;

    if (v instanceof Date) {
      return startDay(v);
    }

    const s = String(v);

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s
        .split("-")
        .map(Number);

      return new Date(
        y,
        m - 1,
        d
      );
    }

    const x = new Date(s);

    return Number.isNaN(
      x.getTime()
    )
      ? null
      : startDay(x);
  }

  function dateKey(v) {
    const d = parseDate(v);

    return d
      ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      : "";
  }

  function diffDays(a, b) {
    return Math.round(
      (
        startDay(a)
        - startDay(b)
      )
      / 86400000
    );
  }

  function isoStart(d) {
    return startDay(d).toISOString();
  }

  function isoEnd(d) {
    const x = startDay(d);

    x.setHours(
      23,
      59,
      59,
      999
    );

    return x.toISOString();
  }

  function fmtDate(v) {
    const d = parseDate(v);

    return d
      ? new Intl.DateTimeFormat(
          "pt-BR",
          {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit"
          }
        ).format(d)
      : "—";
  }

  function num(v, digits = 0) {
    return new Intl.NumberFormat(
      "pt-BR",
      {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits
      }
    ).format(
      Number(v || 0)
    );
  }

  function percent(v, digits = 0) {
    return Number.isFinite(
      Number(v)
    )
      ? `${num(Number(v), digits)}%`
      : "—";
  }

  function hours(seconds) {
    const s = Math.max(
      0,
      Math.round(
        Number(seconds || 0)
      )
    );

    const h = Math.floor(
      s / 3600
    );

    const m = Math.floor(
      (s % 3600) / 60
    );

    if (!h) {
      return `${m} min`;
    }

    return m
      ? `${h}h${pad(m)}`
      : `${h}h`;
  }

  function days(v, digits = 0) {
    return `${num(v, digits)} d`;
  }

  function pct(a, b) {
    return Number(b || 0)
      ? Number(a || 0)
          / Number(b)
          * 100
      : 0;
  }

  function clamp(
    v,
    min = 0,
    max = 100
  ) {
    return Math.max(
      min,
      Math.min(
        max,
        Number(v || 0)
      )
    );
  }

  function sum(rows, fn) {
    return (rows || [])
      .reduce(
        (acc, row) =>
          acc
          + Number(
              fn(row) || 0
            ),
        0
      );
  }

  function mean(values) {
    const a = (values || [])
      .map(Number)
      .filter(
        Number.isFinite
      );

    return a.length
      ? a.reduce(
          (x, y) =>
            x + y,
          0
        ) / a.length
      : 0;
  }

  function median(values) {
    const a = (values || [])
      .map(Number)
      .filter(
        Number.isFinite
      )
      .sort(
        (x, y) =>
          x - y
      );

    if (!a.length) {
      return 0;
    }

    const m = Math.floor(
      a.length / 2
    );

    return a.length % 2
      ? a[m]
      : (
          a[m - 1]
          + a[m]
        )
        / 2;
  }

  function group(rows, fn) {
    const map = new Map();

    for (
      const row
      of rows || []
    ) {
      const key = fn(row);

      if (!map.has(key)) {
        map.set(
          key,
          []
        );
      }

      map
        .get(key)
        .push(row);
    }

    return map;
  }

  function subject(row) {
    return String(
      row.materia
      || row.area
      || "Sem matéria"
    ).trim()
      || "Sem matéria";
  }

  function area(row) {
    return String(
      row.area
      || "Sem área"
    ).trim()
      || "Sem área";
  }

  function memory(
    lastReviewedAt,
    stabilityDays,
    asOf = new Date()
  ) {
    if (!lastReviewedAt) {
      return null;
    }

    const last =
      parseDate(
        lastReviewedAt
      );

    if (!last) {
      return null;
    }

    const stability =
      Math.max(
        Number(
          stabilityDays || 1
        ),
        1
      );

    const elapsed =
      Math.max(
        0,
        diffDays(
          startDay(asOf),
          last
        )
      );

    const value =
      Math.pow(
        1
        + (
            19 / 81
          )
          * (
              elapsed
              / stability
            ),
        -0.5
      );

    return Math.max(
      0,
      Math.min(
        1,
        value
      )
    );
  }

  function makeBounds(range) {
    const end =
      startDay(
        new Date()
      );

    if (
      range === "all"
    ) {
      return {
        start: null,
        end,
        prevStart: null,
        prevEnd: null
      };
    }

    const d =
      Number(range);

    const start =
      addDays(
        end,
        -(d - 1)
      );

    const prevEnd =
      addDays(
        start,
        -1
      );

    const prevStart =
      addDays(
        prevEnd,
        -(d - 1)
      );

    return {
      start,
      end,
      prevStart,
      prevEnd
    };
  }

  function inCurrent(v) {
    const d =
      parseDate(v);

    if (!d) {
      return false;
    }

    if (!state.bounds.start) {
      return d
        <= state.bounds.end;
    }

    return (
      d >= state.bounds.start
      && d <= state.bounds.end
    );
  }

  function inPrevious(v) {
    const d =
      parseDate(v);

    if (
      !d
      || !state.bounds.prevStart
    ) {
      return false;
    }

    return (
      d >= state.bounds.prevStart
      && d <= state.bounds.prevEnd
    );
  }

  function current(
    rows,
    prop
  ) {
    if (
      state.range === "all"
    ) {
      return rows || [];
    }

    return (rows || [])
      .filter(
        x =>
          inCurrent(
            x[prop]
          )
      );
  }

  function previous(
    rows,
    prop
  ) {
    if (
      state.range === "all"
    ) {
      return [];
    }

    return (rows || [])
      .filter(
        x =>
          inPrevious(
            x[prop]
          )
      );
  }

  function labelPeriod() {
    return state.range === "all"
      ? "todo o histórico"
      : `${state.range} dias`;
  }

  function compare(
    curr,
    prev,
    invert = false
  ) {
    if (
      state.range === "all"
    ) {
      return "";
    }

    curr =
      Number(
        curr || 0
      );

    prev =
      Number(
        prev || 0
      );

    if (
      !curr
      && !prev
    ) {
      return "sem mudança";
    }

    if (!prev) {
      return "novo no período";
    }

    const delta =
      (
        curr - prev
      )
      / Math.abs(prev)
      * 100;

    const good =
      invert
        ? delta <= 0
        : delta >= 0;

    return `${
      delta >= 0
        ? "↑"
        : "↓"
    } ${num(Math.abs(delta))}% vs anterior${
      good
        ? ""
        : ""
    }`;
  }

  function comparePP(
    curr,
    prev
  ) {
    if (
      state.range === "all"
      || !Number.isFinite(
        Number(prev)
      )
    ) {
      return "";
    }

    const d =
      Number(curr || 0)
      - Number(prev || 0);

    return `${
      d >= 0
        ? "↑"
        : "↓"
    } ${num(Math.abs(d), 1)} p.p.`;
  }

  async function fetchPaged(
    table,
    columns,
    apply = null
  ) {
    const page = 1000;
    const rows = [];
    let from = 0;

    while (true) {
      let q =
        sb
          .from(table)
          .select(columns);

      if (apply) {
        q = apply(q);
      }

      q =
        q.range(
          from,
          from + page - 1
        );

      const {
        data,
        error
      } = await q;

      if (error) {
        state.sourceErrors.push(
          `${table}: ${error.message}`
        );

        return [];
      }

      rows.push(
        ...(data || [])
      );

      if (
        !data
        || data.length < page
      ) {
        break;
      }

      from += page;
    }

    return rows;
  }

  async function loadStatic() {
    const [
      flashcards,
      errors,
      topics,
      subjectReviews,
      dailyAccess,
      questionSets,
      settings
    ] = await Promise.all([
      fetchPaged(
        "flashcards",
        "id,area,materia,front_text,due_date,current_interval_days,stability_days,review_count,last_reviewed_at,last_rating,active,created_at"
      ),

      fetchPaged(
        "error_notebook",
        "id,area,materia,theme,ccq,due_date,current_interval_days,stability_days,review_count,last_reviewed_at,active,created_at"
      ),

      fetchPaged(
        "study_topics",
        "id,area,materia,theme,original_date,scheduled_date,status,completed_at,already_done,studied_on,created_at"
      ),

      fetchPaged(
        "subject_reviews",
        "id,topic_id,stage,interval_days,scheduled_date,completed_at,rescheduled_manually,created_at"
      ),

      fetchPaged(
        "daily_access",
        "access_date,created_at",
        q =>
          q.order(
            "access_date",
            {
              ascending: true
            }
          )
      ),

      fetchPaged(
        "question_set_metrics",
        "set_id,title,status,total_questions,created_at,answered_count,correct_count,wrong_count,sent_to_error_count,accuracy_percent,completed,last_answered_at"
      ),

      sb
        .from(
          "user_settings"
        )
        .select(
          "flashcard_weekdays,theory_study_weekdays,theory_review_weekdays,error_weekdays,question_weekdays"
        )
        .maybeSingle()
    ]);

    state.static.flashcards =
      flashcards;

    state.static.errors =
      errors;

    state.static.topics =
      topics;

    state.static.subjectReviews =
      subjectReviews;

    state.static.dailyAccess =
      dailyAccess;

    state.static.questionSets =
      questionSets;

    if (
      settings.error
    ) {
      state.sourceErrors.push(
        `user_settings: ${settings.error.message}`
      );
    }

    state.settings =
      settings.data
      || {
        flashcard_weekdays: [
          1, 2, 3, 4, 5, 6, 7
        ],

        theory_study_weekdays: [
          1, 2, 3, 4, 5, 6, 7
        ],

        theory_review_weekdays: [
          1, 2, 3, 4, 5, 6, 7
        ],

        error_weekdays: [
          1, 2, 3, 4, 5, 6, 7
        ],

        question_weekdays: [
          1, 2, 3, 4, 5, 6, 7
        ]
      };
  }

  async function loadPeriod() {
    state.bounds =
      makeBounds(
        state.range
      );

    const start =
      state.range === "all"
        ? null
        : state.bounds.prevStart;

    const filter =
      (
        field,
        order = field
      ) =>
        q => {
          if (start) {
            q =
              q.gte(
                field,
                isoStart(start)
              );
          }

          return q
            .lte(
              field,
              isoEnd(
                state.bounds.end
              )
            )
            .order(
              order,
              {
                ascending: true
              }
            );
        };

    const [
      sessions,
      flashReviews,
      errorReviews,
      questionAttempts
    ] = await Promise.all([
      fetchPaged(
        "study_sessions",
        "id,activity_kind,source_id,area,materia,started_at,ended_at,duration_seconds",
        q => {
          q =
            q
              .not(
                "ended_at",
                "is",
                null
              )
              .not(
                "duration_seconds",
                "is",
                null
              );

          return filter(
            "started_at"
          )(q);
        }
      ),

      fetchPaged(
        "flashcard_reviews",
        "id,flashcard_id,reviewed_at,rating,was_correct,stage,scheduled_date_before,interval_before_days,interval_after_days,stability_before_days,stability_after_days,retrievability_before,next_due_date",
        filter(
          "reviewed_at"
        )
      ),

      fetchPaged(
        "error_reviews",
        "id,error_id,reviewed_at,scheduled_date_before,interval_days,retrievability_before,next_due_date",
        filter(
          "reviewed_at"
        )
      ),

      fetchPaged(
        "question_attempts",
        "id,question_item_id,result,area,materia,sent_to_error,error_entry_id,answered_at",
        filter(
          "answered_at"
        )
      )
    ]);

    state.period.sessions =
      sessions;

    state.period.flashReviews =
      flashReviews;

    state.period.errorReviews =
      errorReviews;

    state.period.questionAttempts =
      questionAttempts;
  }

  function activeFlash() {
    return state.static.flashcards
      .filter(
        x =>
          x.active === true
      );
  }

  function activeErrors() {
    return state.static.errors
      .filter(
        x =>
          x.active === true
      );
  }

  function earliestDate() {
    const all = [
      ...state.period.sessions
        .map(
          x =>
            parseDate(
              x.started_at
            )
        ),

      ...state.period.flashReviews
        .map(
          x =>
            parseDate(
              x.reviewed_at
            )
        ),

      ...state.period.errorReviews
        .map(
          x =>
            parseDate(
              x.reviewed_at
            )
        ),

      ...state.period.questionAttempts
        .map(
          x =>
            parseDate(
              x.answered_at
            )
        ),

      ...state.static.topics
        .map(
          x =>
            parseDate(
              x.created_at
            )
        )
    ]
      .filter(Boolean)
      .sort(
        (a, b) =>
          a - b
      );

    return all[0]
      || addDays(
        new Date(),
        -29
      );
  }

  function activeStart() {
    return state.bounds.start
      || earliestDate();
  }

  function dateSeries(
    rows,
    prop,
    valueFn = () => 1
  ) {
    const map =
      new Map();

    for (
      const row
      of rows || []
    ) {
      const d =
        parseDate(
          row[prop]
        );

      if (
        !d
        || d < activeStart()
        || d > state.bounds.end
      ) {
        continue;
      }

      const key =
        dateKey(d);

      map.set(
        key,
        (
          map.get(key)
          || 0
        )
        + Number(
          valueFn(row)
          || 0
        )
      );
    }

    const result = [];

    let d =
      activeStart();

    while (
      d <= state.bounds.end
    ) {
      const key =
        dateKey(d);

      result.push({
        date: key,

        label:
          new Intl.DateTimeFormat(
            "pt-BR",
            {
              day: "2-digit",
              month: "2-digit"
            }
          ).format(d),

        value:
          map.get(key)
          || 0
      });

      d =
        addDays(
          d,
          1
        );
    }

    return aggregateSeries(
      result
    );
  }

  function aggregateSeries(series) {
    if (
      series.length <= 35
    ) {
      return series;
    }

    const mode =
      series.length <= 120
        ? "week"
        : "month";

    const map =
      new Map();

    for (
      const item
      of series
    ) {
      const d =
        parseDate(
          item.date
        );

      let key;
      let label;

      if (
        mode === "week"
      ) {
        const isoDay =
          d.getDay()
          || 7;

        const monday =
          addDays(
            d,
            1 - isoDay
          );

        key =
          dateKey(
            monday
          );

        label =
          `sem ${
            new Intl.DateTimeFormat(
              "pt-BR",
              {
                day: "2-digit",
                month: "2-digit"
              }
            ).format(monday)
          }`;
      } else {
        key =
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

        label =
          new Intl.DateTimeFormat(
            "pt-BR",
            {
              month: "short",
              year: "2-digit"
            }
          )
            .format(d)
            .replace(
              ".",
              ""
            );
      }

      const old =
        map.get(key)
        || {
          date: key,
          label,
          value: 0
        };

      old.value +=
        item.value;

      map.set(
        key,
        old
      );
    }

    return Array.from(
      map.values()
    );
  }

  function eligibleDays(
    weekdays,
    start = activeStart(),
    end = state.bounds.end
  ) {
    const set =
      new Set(
        (
          weekdays
          || [
            1, 2, 3, 4, 5, 6, 7
          ]
        ).map(Number)
      );

    let count = 0;
    let d = start;

    while (
      d <= end
    ) {
      const iso =
        d.getDay() === 0
          ? 7
          : d.getDay();

      if (
        set.has(iso)
      ) {
        count += 1;
      }

      d =
        addDays(
          d,
          1
        );
    }

    return count;
  }

  function unionWeekdays() {
    const s =
      state.settings
      || {};

    return Array.from(
      new Set([
        ...(s.flashcard_weekdays || []),
        ...(s.theory_study_weekdays || []),
        ...(s.theory_review_weekdays || []),
        ...(s.error_weekdays || []),
        ...(s.question_weekdays || [])
      ])
    );
  }

  function currentStreak() {
    const dates =
      new Set(
        state.static.dailyAccess
          .map(
            x =>
              x.access_date
          )
      );

    let d =
      startDay(
        new Date()
      );

    let streak = 0;

    if (
      !dates.has(
        dateKey(d)
      )
    ) {
      d =
        addDays(
          d,
          -1
        );
    }

    while (
      dates.has(
        dateKey(d)
      )
    ) {
      streak++;

      d =
        addDays(
          d,
          -1
        );
    }

    return streak;
  }

  function longestStreak() {
    const dates =
      state.static.dailyAccess
        .map(
          x =>
            parseDate(
              x.access_date
            )
        )
        .filter(Boolean)
        .sort(
          (a, b) =>
            a - b
        );

    let best = 0;
    let run = 0;
    let prev = null;

    for (
      const d
      of dates
    ) {
      if (
        !prev
        || diffDays(
          d,
          prev
        ) === 1
      ) {
        run++;
      } else if (
        diffDays(
          d,
          prev
        ) !== 0
      ) {
        run = 1;
      }

      best =
        Math.max(
          best,
          run
        );

      prev = d;
    }

    return best;
  }

  function groupedRetention(
    rows,
    fn,
    minEvidence = 1
  ) {
    return Array.from(
      group(
        rows,
        fn
      ).entries()
    )
      .map(
        ([label, items]) => {
          const vals =
            items
              .map(
                x =>
                  memory(
                    x.last_reviewed_at,
                    x.stability_days
                  )
              )
              .filter(
                x =>
                  x !== null
              );

          return {
            label,
            items,
            evidence:
              vals.length,
            value:
              mean(vals)
              * 100
          };
        }
      )
      .filter(
        x =>
          x.evidence
          >= minEvidence
      )
      .sort(
        (a, b) =>
          a.value
          - b.value
      );
  }

  function viz(
    type,
    value,
    values = []
  ) {
    if (
      type === "ring"
    ) {
      return `
        <div
          class="mini-ring"
          style="--p:${clamp(value)}"
        ></div>
      `;
    }

    if (
      type === "stack"
    ) {
      const total =
        Math.max(
          1,
          values.reduce(
            (a, b) =>
              a
              + Number(
                  b || 0
                ),
            0
          )
        );

      return `
        <div class="mini-stack">
          ${
            values
              .map(
                v =>
                  `
                    <span
                      style="width:${pct(v,total)}%"
                    ></span>
                  `
              )
              .join("")
          }
        </div>
      `;
    }

    return `
      <div class="mini-bar">
        <span
          style="width:${clamp(value)}%"
        ></span>
      </div>
    `;
  }

  function renderCards(
    id,
    cards
  ) {
    const el =
      $(id);

    if (!el) {
      return;
    }

    el.innerHTML =
      cards
        .map(
          c => `
            <article class="stats-callout">
              <label>${esc(c.label)}</label>
              <strong>${esc(c.value)}</strong>
              <small>${esc(c.helper || "")}</small>

              <div class="mini-viz">
                ${
                  viz(
                    c.viz?.type
                    || "bar",
                    c.viz?.value
                    || 0,
                    c.viz?.values
                    || []
                  )
                }
              </div>
            </article>
          `
        )
        .join("");
  }

  function renderSummary(
    id,
    cards
  ) {
    const el =
      $(id);

    if (!el) {
      return;
    }

    el.innerHTML =
      cards
        .map(
          c => `
            <article class="stats-summary-card">
              <span>${esc(c.label)}</span>
              <strong>${esc(c.value)}</strong>
              <small>${esc(c.helper || "")}</small>

              <div class="stats-summary-viz">
                <div class="stats-mini-track">
                  <span
                    style="width:${clamp(c.progress ?? 0)}%"
                  ></span>
                </div>
              </div>
            </article>
          `
        )
        .join("");
  }

  function heatIntensity(
    value,
    max
  ) {
    if (
      !max
      || !value
    ) {
      return 0;
    }

    return Math.max(
      8,
      Math.min(
        100,
        Math.round(
          value / max * 100
        )
      )
    );
  }

  function renderWeekTimeHeatmap(
    id,
    sessions
  ) {
    const el =
      $(id);

    if (!el) {
      return;
    }

    const weekdays = [
      "Seg",
      "Ter",
      "Qua",
      "Qui",
      "Sex",
      "Sáb",
      "Dom"
    ];

    const periods = [
      {
        label: "Madrugada",
        start: 0,
        end: 6
      },
      {
        label: "Manhã",
        start: 6,
        end: 12
      },
      {
        label: "Tarde",
        start: 12,
        end: 18
      },
      {
        label: "Noite",
        start: 18,
        end: 24
      }
    ];

    const matrix =
      Array.from(
        {
          length: 7
        },
        () =>
          Array(4)
            .fill(0)
      );

    for (
      const row
      of sessions || []
    ) {
      const d =
        new Date(
          row.started_at
        );

      if (
        Number.isNaN(
          d.getTime()
        )
      ) {
        continue;
      }

      const weekday =
        (
          d.getDay()
          + 6
        )
        % 7;

      const hour =
        d.getHours();

      const period =
        periods.findIndex(
          p =>
            hour >= p.start
            && hour < p.end
        );

      if (
        period >= 0
      ) {
        matrix[weekday][period] +=
          Number(
            row.duration_seconds
            || 0
          )
          / 60;
      }
    }

    const max =
      Math.max(
        0,
        ...matrix.flat()
      );

    el.innerHTML = `
      <div class="heatmap-grid week-time">
        <div class="heatmap-head">
          Dia
        </div>

        ${
          periods
            .map(
              p =>
                `
                  <div class="heatmap-head">
                    ${esc(p.label)}
                  </div>
                `
            )
            .join("")
        }

        ${
          weekdays
            .map(
              (
                day,
                dayIndex
              ) => `
                <div class="heatmap-row-label">
                  ${day}
                </div>

                ${
                  matrix[dayIndex]
                    .map(
                      minutes => `
                        <div
                          class="heatmap-cell"
                          style="--heat:${heatIntensity(minutes,max)}"
                        >
                          <strong>
                            ${
                              minutes
                                ? hours(minutes * 60)
                                : "—"
                            }
                          </strong>

                          <small>
                            ${
                              minutes
                                ? `${num(minutes)} min`
                                : "sem registro"
                            }
                          </small>
                        </div>
                      `
                    )
                    .join("")
                }
              `
            )
            .join("")
        }
      </div>

      <div class="heatmap-legend">
        <span>menos</span>
        <span class="heatmap-legend-swatch"></span>
        <span>mais tempo</span>
      </div>
    `;
  }

  function renderQuestionAreaWeekHeatmap(
    id,
    attempts
  ) {
    const el =
      $(id);

    if (!el) {
      return;
    }

    const weekdays = [
      "Seg",
      "Ter",
      "Qua",
      "Qui",
      "Sex",
      "Sáb",
      "Dom"
    ];

    const grouped =
      new Map();

    for (
      const row
      of attempts || []
    ) {
      const label =
        area(row);

      const d =
        new Date(
          row.answered_at
        );

      if (
        Number.isNaN(
          d.getTime()
        )
      ) {
        continue;
      }

      const weekday =
        (
          d.getDay()
          + 6
        )
        % 7;

      if (
        !grouped.has(
          label
        )
      ) {
        grouped.set(
          label,
          Array.from(
            {
              length: 7
            },
            () => ({
              total: 0,
              correct: 0
            })
          )
        );
      }

      const cell =
        grouped
          .get(label)[weekday];

      cell.total += 1;

      if (
        row.result === "correct"
      ) {
        cell.correct += 1;
      }
    }

    const rows =
      Array.from(
        grouped.entries()
      )
        .map(
          ([label, cells]) => ({
            label,
            cells,
            total:
              cells.reduce(
                (
                  sum,
                  cell
                ) =>
                  sum
                  + cell.total,
                0
              )
          })
        )
        .sort(
          (a, b) =>
            b.total
            - a.total
        )
        .slice(
          0,
          10
        );

    if (!rows.length) {
      el.innerHTML =
        '<div class="stats-empty">Ainda não há questões suficientes para montar o mapa de calor.</div>';

      return;
    }

    const max =
      Math.max(
        1,
        ...rows.flatMap(
          row =>
            row.cells.map(
              cell =>
                cell.total
            )
        )
      );

    el.innerHTML = `
      <div class="heatmap-grid area-week">
        <div class="heatmap-head">
          Área
        </div>

        ${
          weekdays
            .map(
              day =>
                `
                  <div class="heatmap-head">
                    ${day}
                  </div>
                `
            )
            .join("")
        }

        ${
          rows
            .map(
              row => `
                <div class="heatmap-row-label">
                  ${esc(row.label)}
                </div>

                ${
                  row.cells
                    .map(
                      cell => {
                        const accuracy =
                          pct(
                            cell.correct,
                            cell.total
                          );

                        return `
                          <div
                            class="heatmap-cell"
                            style="--heat:${heatIntensity(cell.total,max)}"
                          >
                            <strong>
                              ${
                                cell.total
                                  ? percent(
                                      accuracy,
                                      0
                                    )
                                  : "—"
                              }
                            </strong>

                            <small>
                              ${
                                cell.total
                                  ? `${cell.total} q.`
                                  : "0 q."
                              }
                            </small>
                          </div>
                        `;
                      }
                    )
                    .join("")
                }
              `
            )
            .join("")
        }
      </div>

      <div class="heatmap-legend">
        <span>menos</span>
        <span class="heatmap-legend-swatch"></span>
        <span>mais questões</span>
      </div>
    `;
  }

  function renderMetricStrip(
    id,
    cards
  ) {
    const el =
      $(id);

    if (!el) {
      return;
    }

    el.innerHTML =
      cards
        .map(
          c => `
            <article class="metric-mini">
              <span>${esc(c.label)}</span>
              <strong>${esc(c.value)}</strong>
              <small>${esc(c.helper || "")}</small>
            </article>
          `
        )
        .join("");
  }

  function chart(
    id,
    type,
    labels,
    datasets,
    options = {}
  ) {
    const canvas =
      $(id);

    if (
      !canvas
      || !window.Chart
    ) {
      return;
    }

    if (
      charts.has(id)
    ) {
      charts
        .get(id)
        .destroy();
    }

    const accent =
      css(
        "--accent",
        "#5965d8"
      );

    const success =
      css(
        "--success",
        "#2f9d71"
      );

    const warning =
      css(
        "--warning",
        "#d39b27"
      );

    const danger =
      css(
        "--danger",
        "#d15555"
      );

    const muted =
      css(
        "--muted",
        "#7b8190"
      );

    const border =
      css(
        "--border",
        "#e0e3e8"
      );

    const palette = [
      accent,
      success,
      warning,
      danger,
      "#8b7cf6",
      "#55a6b8"
    ];

    datasets =
      datasets.map(
        (
          d,
          i
        ) => ({
          ...d,

          borderColor:
            d.borderColor
            || palette[
              i
              % palette.length
            ],

          backgroundColor:
            d.backgroundColor
            || palette[
              i
              % palette.length
            ],

          borderWidth:
            d.borderWidth
            ?? 2,

          tension:
            d.tension
            ?? .28,

          pointRadius:
            d.pointRadius
            ?? 2
        })
      );

    charts.set(
      id,
      new Chart(
        canvas,
        {
          type,

          data: {
            labels,
            datasets
          },

          options: {
            responsive: true,
            maintainAspectRatio: false,

            interaction: {
              intersect: false,
              mode: "index"
            },

            plugins: {
              legend: {
                display:
                  datasets.length > 1
                  || type === "doughnut",

                labels: {
                  color: muted,
                  boxWidth: 10,

                  font: {
                    size: 9
                  }
                }
              },

              tooltip: {
                padding: 9,

                titleFont: {
                  size: 10
                },

                bodyFont: {
                  size: 10
                }
              }
            },

            scales:
              type === "doughnut"
                ? undefined
                : {
                    x: {
                      ticks: {
                        color: muted,

                        font: {
                          size: 8
                        },

                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 12
                      },

                      grid: {
                        display: false
                      }
                    },

                    y: {
                      beginAtZero:
                        options.beginAtZero
                        !== false,

                      suggestedMax:
                        options.suggestedMax,

                      max:
                        options.max,

                      ticks: {
                        color: muted,

                        font: {
                          size: 8
                        }
                      },

                      grid: {
                        color: border
                      }
                    }
                  },

            ...options.extra
          }
        }
      )
    );
  }

  function progressList(
    id,
    rows,
    formatter =
      v =>
        percent(
          v,
          1
        ),
    max = 100
  ) {
    const el =
      $(id);

    if (!el) {
      return;
    }

    if (!rows.length) {
      el.innerHTML =
        '<div class="empty">Sem dados suficientes.</div>';

      return;
    }

    const localMax =
      max
      || Math.max(
        1,
        ...rows.map(
          x =>
            Number(
              x.value || 0
            )
        )
      );

    el.innerHTML = `
      <div class="progress-list">
        ${
          rows
            .map(
              x => `
                <div class="progress-row">
                  <div>
                    <strong>${esc(x.label)}</strong>
                    <small>${esc(x.helper || "")}</small>
                  </div>

                  <div class="track">
                    <span
                      style="width:${clamp(pct(x.value,localMax))}%"
                    ></span>
                  </div>

                  <div class="progress-value">
                    ${esc(formatter(x.value))}
                  </div>
                </div>
              `
            )
            .join("")
        }
      </div>
    `;
  }

  function insights(
    id,
    rows
  ) {
    const el =
      $(id);

    if (!el) {
      return;
    }

    if (!rows.length) {
      el.innerHTML =
        '<div class="empty">Ainda não há dados suficientes para gerar insights.</div>';

      return;
    }

    el.innerHTML = `
      <div class="insights">
        ${
          rows
            .map(
              x => `
                <div class="insight">
                  <strong>${esc(x.title)}</strong>
                  ${esc(x.text)}
                </div>
              `
            )
            .join("")
        }
      </div>
    `;
  }

  function table(
    id,
    headers,
    rows
  ) {
    const el =
      $(id);

    if (!el) {
      return;
    }

    if (!rows.length) {
      el.innerHTML =
        '<div class="empty">Sem dados suficientes.</div>';

      return;
    }

    el.innerHTML = `
      <table class="stats-table">
        <thead>
          <tr>
            ${
              headers
                .map(
                  h => `
                    <th
                      class="${h.num ? "num" : ""}"
                    >
                      ${esc(h.label)}
                    </th>
                  `
                )
                .join("")
            }
          </tr>
        </thead>

        <tbody>
          ${
            rows
              .map(
                row => `
                  <tr>
                    ${
                      row
                        .map(
                          (
                            cell,
                            i
                          ) => `
                            <td
                              class="${headers[i]?.num ? "num" : ""}"
                            >
                              ${cell}
                            </td>
                          `
                        )
                        .join("")
                    }
                  </tr>
                `
              )
              .join("")
          }
        </tbody>
      </table>
    `;
  }

  function completedTopic(topic) {
    return (
      topic.status === "completed"
      || !!topic.completed_at
    );
  }

  function scheduledInCurrent(topic) {
    if (
      !topic.scheduled_date
    ) {
      return false;
    }

    return state.range === "all"
      ? parseDate(
          topic.scheduled_date
        )
        <= state.bounds.end
      : inCurrent(
          topic.scheduled_date
        );
  }

  function reviewScheduledCurrent(review) {
    if (
      !review.scheduled_date
    ) {
      return false;
    }

    return state.range === "all"
      ? parseDate(
          review.scheduled_date
        )
        <= state.bounds.end
      : inCurrent(
          review.scheduled_date
        );
  }

  // =========================================================
  // GERAL
  // =========================================================

  function generalData() {
    const sessions =
      current(
        state.period.sessions,
        "started_at"
      );

    const prevSessions =
      previous(
        state.period.sessions,
        "started_at"
      );

    const questions =
      current(
        state.period.questionAttempts,
        "answered_at"
      );

    const prevQuestions =
      previous(
        state.period.questionAttempts,
        "answered_at"
      );

    const flashReviews =
      current(
        state.period.flashReviews,
        "reviewed_at"
      );

    const prevFlashReviews =
      previous(
        state.period.flashReviews,
        "reviewed_at"
      );

    const seconds =
      sum(
        sessions,
        x =>
          x.duration_seconds
      );

    const prevSeconds =
      sum(
        prevSessions,
        x =>
          x.duration_seconds
      );

    const activeDays =
      new Set(
        sessions.map(
          x =>
            dateKey(
              x.started_at
            )
        )
      ).size;

    const eligible =
      Math.max(
        1,
        eligibleDays(
          unionWeekdays()
        )
      );

    const consistency =
      pct(
        activeDays,
        eligible
      );

    const planned =
      state.static.topics
        .filter(
          scheduledInCurrent
        );

    const plannedDone =
      planned
        .filter(
          completedTopic
        );

    const adherence =
      pct(
        plannedDone.length,
        planned.length
      );

    const totalTopics =
      state.static.topics.length;

    const totalDone =
      state.static.topics
        .filter(
          completedTopic
        )
        .length;

    const progress =
      pct(
        totalDone,
        totalTopics
      );

    const donePeriod =
      state.static.topics
        .filter(
          x =>
            x.completed_at
            && (
              state.range === "all"
              || inCurrent(
                x.completed_at
              )
            )
        )
        .length;

    const correctQ =
      questions
        .filter(
          x =>
            x.result === "correct"
        )
        .length;

    const prevCorrectQ =
      prevQuestions
        .filter(
          x =>
            x.result === "correct"
        )
        .length;

    const accuracyQ =
      pct(
        correctQ,
        questions.length
      );

    const prevAccuracyQ =
      pct(
        prevCorrectQ,
        prevQuestions.length
      );

    const completedSets =
      state.static.questionSets
        .filter(
          x =>
            x.completed === true
            && x.last_answered_at
            && (
              state.range === "all"
              || inCurrent(
                x.last_answered_at
              )
            )
        )
        .length;

    const flashCorrect =
      flashReviews
        .filter(
          x =>
            x.was_correct === true
        )
        .length;

    const prevFlashCorrect =
      prevFlashReviews
        .filter(
          x =>
            x.was_correct === true
        )
        .length;

    const flashAccuracy =
      pct(
        flashCorrect,
        flashReviews.length
      );

    const prevFlashAccuracy =
      pct(
        prevFlashCorrect,
        prevFlashReviews.length
      );

    const reviewedCards =
      activeFlash()
        .filter(
          x =>
            x.review_count > 0
            && x.last_reviewed_at
        );

    const retention =
      mean(
        reviewedCards
          .map(
            x =>
              memory(
                x.last_reviewed_at,
                x.stability_days
              )
          )
          .filter(
            x =>
              x !== null
          )
      )
      * 100;

    const err =
      activeErrors();

    const overdueErr =
      err
        .filter(
          x =>
            parseDate(
              x.due_date
            )
            < startDay(
              new Date()
            )
        )
        .length;

    const scheduledReviews =
      state.static.subjectReviews
        .filter(
          reviewScheduledCurrent
        );

    const doneReviews =
      scheduledReviews
        .filter(
          x =>
            x.completed_at
            && parseDate(
              x.completed_at
            )
            <= state.bounds.end
        );

    const reviewRate =
      pct(
        doneReviews.length,
        scheduledReviews.length
      );

    return {
      sessions,
      prevSessions,
      questions,
      prevQuestions,
      flashReviews,
      prevFlashReviews,
      seconds,
      prevSeconds,
      activeDays,
      eligible,
      consistency,
      planned,
      plannedDone,
      adherence,
      totalTopics,
      totalDone,
      progress,
      donePeriod,
      correctQ,
      accuracyQ,
      prevAccuracyQ,
      completedSets,
      flashCorrect,
      flashAccuracy,
      prevFlashAccuracy,
      reviewedCards,
      retention,
      err,
      overdueErr,
      scheduledReviews,
      doneReviews,
      reviewRate
    };
  }

  function renderGeneral() {
    const m =
      generalData();

    renderSummary(
      "general-summary",
      [
        {
          label:
            "Tempo estudado",

          value:
            hours(
              m.seconds
            ),

          helper:
            compare(
              m.seconds,
              m.prevSeconds
            ),

          progress:
            Math.min(
              100,
              m.seconds
              / 108000
              * 100
            )
        },

        {
          label:
            "Consistência",

          value:
            percent(
              m.consistency
            ),

          helper:
            `${m.activeDays}/${m.eligible} dias planejados`,

          progress:
            m.consistency
        },

        {
          label:
            "Progresso das aulas",

          value:
            percent(
              m.progress,
              1
            ),

          helper:
            `${m.totalDone}/${m.totalTopics} concluídas`,

          progress:
            m.progress
        },

        {
          label:
            "Aderência às aulas",

          value:
            percent(
              m.adherence
            ),

          helper:
            `${m.plannedDone.length}/${m.planned.length} previstas`,

          progress:
            m.adherence
        },

        {
          label:
            "Aproveitamento em questões",

          value:
            percent(
              m.accuracyQ,
              1
            ),

          helper:
            comparePP(
              m.accuracyQ,
              m.prevAccuracyQ
            ),

          progress:
            m.accuracyQ
        },

        {
          label:
            "Revisões de flashcards",

          value:
            num(
              m.flashReviews.length
            ),

          helper:
            compare(
              m.flashReviews.length,
              m.prevFlashReviews.length
            ),

          progress:
            Math.min(
              100,
              m.flashReviews.length
              / 1500
              * 100
            )
        },

        {
          label:
            "Retenção dos flashcards",

          value:
            percent(
              m.retention,
              1
            ),

          helper:
            `${m.reviewedCards.length} cards estimados`,

          progress:
            m.retention
        },

        {
          label:
            "CCQs ativos",

          value:
            num(
              m.err.length
            ),

          helper:
            `${m.overdueErr} atrasados`,

          progress:
            pct(
              m.err.length,
              Math.max(
                1,
                state.static.errors.length
              )
            )
        },

        {
          label:
            "Ofensiva",

          value:
            `${currentStreak()} d`,

          helper:
            `recorde ${longestStreak()} dias`,

          progress:
            pct(
              currentStreak(),
              Math.max(
                1,
                longestStreak()
              )
            )
        }
      ]
    );

    renderMetricStrip(
      "general-habit-metrics",
      []
    );

    renderMetricStrip(
      "general-progress-metrics",
      []
    );

    const studySeries =
      dateSeries(
        m.sessions,
        "started_at",
        x =>
          Number(
            x.duration_seconds
            || 0
          )
          / 3600
      );

    chart(
      "chart-general-study",
      "bar",
      studySeries
        .map(
          x =>
            x.label
        ),
      [
        {
          label: "Horas",

          data:
            studySeries
              .map(
                x =>
                  Number(
                    x.value
                      .toFixed(2)
                  )
              )
        }
      ]
    );

    const activity =
      Array.from(
        group(
          m.sessions,
          x =>
            x.activity_kind
        ).entries()
      )
        .map(
          (
            [k, rows]
          ) => ({
            label:
              ACTIVITY[k]
              || k,

            value:
              sum(
                rows,
                x =>
                  x.duration_seconds
              )
          })
        )
        .filter(
          x =>
            x.value > 0
        )
        .sort(
          (a, b) =>
            b.value
            - a.value
        );

    chart(
      "chart-general-activity",
      "doughnut",
      activity
        .map(
          x =>
            x.label
        ),
      [
        {
          label: "Horas",

          data:
            activity
              .map(
                x =>
                  Number(
                    (
                      x.value
                      / 3600
                    )
                      .toFixed(2)
                  )
              )
        }
      ],
      {
        extra: {
          cutout: "64%"
        }
      }
    );

    renderWeekTimeHeatmap(
      "general-week-heatmap",
      m.sessions
    );

    renderGeneralAreaTable(m);
    renderGeneralInsights(m);
  }

  function renderGeneralAreaTable(m) {
    const areas =
      new Set();

    state.static.topics
      .forEach(
        x =>
          areas.add(
            area(x)
          )
      );

    activeFlash()
      .forEach(
        x =>
          areas.add(
            area(x)
          )
      );

    activeErrors()
      .forEach(
        x =>
          areas.add(
            area(x)
          )
      );

    m.questions
      .forEach(
        x =>
          areas.add(
            area(x)
          )
      );

    m.sessions
      .filter(
        x =>
          x.area
      )
      .forEach(
        x =>
          areas.add(
            area(x)
          )
      );

    const rows =
      Array.from(
        areas
      )
        .map(
          a => {
            const topics =
              state.static.topics
                .filter(
                  x =>
                    area(x) === a
                );

            const done =
              topics
                .filter(
                  completedTopic
                )
                .length;

            const qs =
              m.questions
                .filter(
                  x =>
                    area(x) === a
                );

            const cards =
              activeFlash()
                .filter(
                  x =>
                    area(x) === a
                    && x.review_count > 0
                    && x.last_reviewed_at
                );

            const retention =
              mean(
                cards
                  .map(
                    x =>
                      memory(
                        x.last_reviewed_at,
                        x.stability_days
                      )
                  )
                  .filter(
                    x =>
                      x !== null
                  )
              )
              * 100;

            const ccq =
              activeErrors()
                .filter(
                  x =>
                    area(x) === a
                )
                .length;

            const secs =
              sum(
                m.sessions
                  .filter(
                    x =>
                      x.area
                      && area(x) === a
                  ),
                x =>
                  x.duration_seconds
              );

            return {
              a,

              progress:
                pct(
                  done,
                  topics.length
                ),

              done,

              total:
                topics.length,

              questions:
                qs.length,

              accuracy:
                pct(
                  qs
                    .filter(
                      x =>
                        x.result === "correct"
                    )
                    .length,
                  qs.length
                ),

              retention,
              ccq,
              secs
            };
          }
        )
        .filter(
          x =>
            x.total
            || x.questions
            || x.ccq
            || x.secs
        )
        .sort(
          (a, b) =>
            b.secs
            - a.secs
            || b.questions
            - a.questions
        );

    table(
      "general-area-table",
      [
        {
          label: "Área"
        },
        {
          label: "Progresso aulas"
        },
        {
          label: "Questões",
          num: true
        },
        {
          label: "Acerto",
          num: true
        },
        {
          label: "Retenção FC",
          num: true
        },
        {
          label: "CCQs ativos",
          num: true
        },
        {
          label: "Tempo",
          num: true
        }
      ],
      rows.map(
        x => [
          `<strong>${esc(x.a)}</strong>`,

          `${percent(x.progress)} · ${x.done}/${x.total}`,

          num(
            x.questions
          ),

          x.questions
            ? percent(
                x.accuracy,
                1
              )
            : "—",

          x.retention
            ? percent(
                x.retention,
                1
              )
            : "—",

          num(
            x.ccq
          ),

          hours(
            x.secs
          )
        ]
      )
    );
  }

  function renderGeneralInsights(m) {
    const out = [];

    if (
      state.range !== "all"
    ) {
      out.push({
        title:
          "Ritmo de estudo",

        text:
          m.prevSeconds
            ? `O tempo estudado ${
                m.seconds >= m.prevSeconds
                  ? "aumentou"
                  : "caiu"
              } ${
                num(
                  Math.abs(
                    (
                      m.seconds
                      - m.prevSeconds
                    )
                    / m.prevSeconds
                    * 100
                  )
                )
              }% em relação ao período anterior.`

            : `${hours(m.seconds)} foram registrados neste período.`
      });
    }

    const weakestQ =
      Array.from(
        group(
          m.questions,
          area
        ).entries()
      )
        .map(
          (
            [label, rows]
          ) => ({
            label,

            n:
              rows.length,

            acc:
              pct(
                rows
                  .filter(
                    x =>
                      x.result === "correct"
                  )
                  .length,
                rows.length
              )
          })
        )
        .filter(
          x =>
            x.n >= 5
        )
        .sort(
          (a, b) =>
            a.acc
            - b.acc
        )[0];

    if (
      weakestQ
    ) {
      out.push({
        title:
          "Questões",

        text:
          `${weakestQ.label} tem o menor aproveitamento entre áreas com pelo menos 5 questões: ${percent(weakestQ.acc,1)} em ${weakestQ.n} questões.`
      });
    }

    const weakMemory =
      groupedRetention(
        activeFlash()
          .filter(
            x =>
              x.review_count > 0
          ),
        area,
        5
      )[0];

    if (
      weakMemory
    ) {
      out.push({
        title:
          "Memória",

        text:
          `${weakMemory.label} apresenta a menor retenção estimada entre áreas com evidência suficiente: ${percent(weakMemory.value,1)}.`
      });
    }

    const late =
      state.static.topics
        .filter(
          x =>
            !completedTopic(x)
            && x.scheduled_date
            && parseDate(
              x.scheduled_date
            )
            < startDay(
              new Date()
            )
        )
        .length;

    if (late) {
      out.push({
        title:
          "Cronograma",

        text:
          `${late} ${
            late === 1
              ? "aula está atrasada"
              : "aulas estão atrasadas"
          } neste momento.`
      });
    }

    if (
      m.overdueErr
    ) {
      out.push({
        title:
          "Caderno de Erros",

        text:
          `${m.overdueErr} CCQs estão vencidos (${percent(pct(m.overdueErr,m.err.length))} do caderno ativo).`
      });
    }

    insights(
      "general-insights",
      out
    );
  }

  // =========================================================
  // AULAS
  // =========================================================

  function lessonsData() {
    const topics =
      state.static.topics;

    const reviews =
      state.static.subjectReviews;

    const scheduled =
      topics.filter(
        scheduledInCurrent
      );

    const scheduledDone =
      scheduled.filter(
        completedTopic
      );

    const completedPeriod =
      topics.filter(
        x =>
          x.completed_at
          && (
            state.range === "all"
            || inCurrent(
              x.completed_at
            )
          )
      );

    const done =
      topics.filter(
        completedTopic
      );

    const progress =
      pct(
        done.length,
        topics.length
      );

    const adherence =
      pct(
        scheduledDone.length,
        scheduled.length
      );

    const overdue =
      topics.filter(
        x =>
          !completedTopic(x)
          && x.scheduled_date
          && parseDate(
            x.scheduled_date
          )
          < startDay(
            new Date()
          )
      );

    const future =
      topics.filter(
        x =>
          !completedTopic(x)
          && x.scheduled_date
          && parseDate(
            x.scheduled_date
          )
          >= startDay(
            new Date()
          )
      );

    const completedScheduled =
      topics.filter(
        x =>
          x.completed_at
          && x.scheduled_date
      );

    const delay =
      completedScheduled
        .map(
          x =>
            diffDays(
              parseDate(
                x.completed_at
              ),
              parseDate(
                x.scheduled_date
              )
            )
        );

    const lateDelay =
      delay.filter(
        x =>
          x > 0
      );

    const onTime =
      pct(
        delay
          .filter(
            x =>
              x <= 0
          )
          .length,
        delay.length
      );

    const moved =
      topics.filter(
        x =>
          x.original_date
          && x.scheduled_date
          && x.original_date
            !== x.scheduled_date
      );

    const movedDays =
      moved.map(
        x =>
          Math.abs(
            diffDays(
              parseDate(
                x.scheduled_date
              ),
              parseDate(
                x.original_date
              )
            )
          )
      );

    const lessonSessions =
      current(
        state.period.sessions,
        "started_at"
      )
        .filter(
          x =>
            x.activity_kind
            === "lesson"
        );

    const prevLessonSessions =
      previous(
        state.period.sessions,
        "started_at"
      )
        .filter(
          x =>
            x.activity_kind
            === "lesson"
        );

    const seconds =
      sum(
        lessonSessions,
        x =>
          x.duration_seconds
      );

    const prevSeconds =
      sum(
        prevLessonSessions,
        x =>
          x.duration_seconds
      );

    const scheduledReviews =
      reviews.filter(
        reviewScheduledCurrent
      );

    const completedReviews =
      scheduledReviews
        .filter(
          x =>
            x.completed_at
            && parseDate(
              x.completed_at
            )
            <= state.bounds.end
        );

    const reviewRate =
      pct(
        completedReviews.length,
        scheduledReviews.length
      );

    const overdueReviews =
      reviews.filter(
        x =>
          !x.completed_at
          && parseDate(
            x.scheduled_date
          )
          < startDay(
            new Date()
          )
      );

    const manualReviews =
      reviews.filter(
        x =>
          x.rescheduled_manually
      );

    const areaProgress =
      Array.from(
        group(
          topics,
          area
        ).entries()
      )
        .map(
          (
            [label, rows]
          ) => ({
            label,

            value:
              pct(
                rows
                  .filter(
                    completedTopic
                  )
                  .length,
                rows.length
              ),

            helper:
              `${
                rows
                  .filter(
                    completedTopic
                  )
                  .length
              }/${rows.length} aulas`
          })
        )
        .sort(
          (a, b) =>
            a.value
            - b.value
        );

    const subjectPending =
      Array.from(
        group(
          topics.filter(
            x =>
              !completedTopic(x)
          ),
          subject
        ).entries()
      )
        .map(
          (
            [label, rows]
          ) => ({
            label,
            count:
              rows.length
          })
        )
        .sort(
          (a, b) =>
            b.count
            - a.count
        )[0];

    return {
      topics,
      reviews,
      scheduled,
      scheduledDone,
      completedPeriod,
      done,
      progress,
      adherence,
      overdue,
      future,
      delay,
      lateDelay,
      onTime,
      moved,
      movedDays,
      lessonSessions,
      seconds,
      prevSeconds,
      scheduledReviews,
      completedReviews,
      reviewRate,
      overdueReviews,
      manualReviews,
      areaProgress,
      subjectPending
    };
  }

  function renderLessons() {
    const m =
      lessonsData();

    const studyDays =
      new Set(
        m.lessonSessions
          .map(
            x =>
              dateKey(
                x.started_at
              )
          )
      ).size;

    const best =
      [
        ...m.areaProgress
      ]
        .sort(
          (a, b) =>
            b.value
            - a.value
        )[0];

    const worst =
      m.areaProgress[0];

    renderSummary(
      "lesson-summary",
      [
        {
          label:
            "Aulas concluídas",

          value:
            num(
              m.done.length
            ),

          helper:
            `${percent(m.progress)} do total`,

          progress:
            m.progress
        },

        {
          label:
            "Progresso total",

          value:
            percent(
              m.progress,
              1
            ),

          helper:
            `${m.done.length}/${m.topics.length}`,

          progress:
            m.progress
        },

        {
          label:
            "Aderência",

          value:
            percent(
              m.adherence,
              1
            ),

          helper:
            `${m.scheduledDone.length}/${m.scheduled.length} previstas`,

          progress:
            m.adherence
        },

        {
          label:
            "Aulas atrasadas",

          value:
            num(
              m.overdue.length
            ),

          helper:
            "pendentes com data vencida",

          progress:
            pct(
              m.overdue.length,
              Math.max(
                1,
                m.topics.length
                - m.done.length
              )
            )
        },

        {
          label:
            "Pontualidade",

          value:
            percent(
              m.onTime,
              1
            ),

          helper:
            `${m.lateDelay.length} após o prazo`,

          progress:
            m.onTime
        },

        {
          label:
            "Tempo em aulas",

          value:
            hours(
              m.seconds
            ),

          helper:
            compare(
              m.seconds,
              m.prevSeconds
            ),

          progress:
            Math.min(
              100,
              m.seconds
              / 72000
              * 100
            )
        },

        {
          label:
            "Dias com aula",

          value:
            num(
              studyDays
            ),

          helper:
            `${
              percent(
                pct(
                  studyDays,
                  eligibleDays(
                    state.settings
                      ?.theory_study_weekdays
                  )
                )
              )
            } dos permitidos`,

          progress:
            pct(
              studyDays,
              eligibleDays(
                state.settings
                  ?.theory_study_weekdays
              )
            )
        },

        {
          label:
            "Revisões concluídas",

          value:
            num(
              m.completedReviews.length
            ),

          helper:
            `${percent(m.reviewRate)} das previstas`,

          progress:
            m.reviewRate
        },

        {
          label:
            "Área mais pendente",

          value:
            worst?.label
            || "—",

          helper:
            worst
              ? `${percent(worst.value)} concluído`
              : "sem dados",

          progress:
            worst?.value
            || 0
        }
      ]
    );

    renderMetricStrip(
      "lesson-volume-metrics",
      []
    );

    renderMetricStrip(
      "lesson-review-metrics",
      []
    );

    const plannedSeries =
      dateSeries(
        m.scheduled,
        "scheduled_date"
      );

    const doneSeries =
      dateSeries(
        m.completedPeriod,
        "completed_at"
      );

    const doneMap =
      new Map(
        doneSeries.map(
          x => [
            x.date,
            x.value
          ]
        )
      );

    chart(
      "chart-lessons-plan",
      "bar",
      plannedSeries.map(
        x =>
          x.label
      ),
      [
        {
          label:
            "Planejadas",

          data:
            plannedSeries.map(
              x =>
                x.value
            )
        },

        {
          label:
            "Concluídas",

          data:
            plannedSeries.map(
              x =>
                doneMap.get(
                  x.date
                )
                || 0
            )
        }
      ]
    );

    progressList(
      "lesson-area-progress",
      m.areaProgress
        .slice(
          0,
          12
        )
    );

    const stageRows =
      Array.from(
        group(
          m.reviews,
          x =>
            Number(
              x.stage || 0
            )
        ).entries()
      )
        .sort(
          (a, b) =>
            a[0]
            - b[0]
        )
        .map(
          (
            [stage, rows]
          ) => ({
            label:
              `Etapa ${stage}`,

            value:
              pct(
                rows
                  .filter(
                    x =>
                      x.completed_at
                  )
                  .length,
                rows.length
              ),

            helper:
              `${
                rows
                  .filter(
                    x =>
                      x.completed_at
                  )
                  .length
              }/${rows.length} concluídas`
          })
        );

    progressList(
      "lesson-review-progress",
      stageRows
    );

    const sessionPeriod =
      current(
        state.period.sessions,
        "started_at"
      )
        .filter(
          x =>
            x.activity_kind
            === "lesson"
        );

    const rows =
      Array.from(
        group(
          m.topics,
          subject
        ).entries()
      )
        .map(
          (
            [label, items]
          ) => {
            const ids =
              new Set(
                items.map(
                  x =>
                    x.id
                )
              );

            const rev =
              m.reviews
                .filter(
                  x =>
                    ids.has(
                      x.topic_id
                    )
                );

            const done =
              items
                .filter(
                  completedTopic
                )
                .length;

            const late =
              items
                .filter(
                  x =>
                    !completedTopic(x)
                    && x.scheduled_date
                    && parseDate(
                      x.scheduled_date
                    )
                    < startDay(
                      new Date()
                    )
                )
                .length;

            const secs =
              sum(
                sessionPeriod
                  .filter(
                    x =>
                      subject(x)
                      === label
                  ),
                x =>
                  x.duration_seconds
              );

            return {
              label,
              total:
                items.length,
              done,
              pending:
                items.length
                - done,
              progress:
                pct(
                  done,
                  items.length
                ),
              late,
              secs,
              revRate:
                pct(
                  rev
                    .filter(
                      x =>
                        x.completed_at
                    )
                    .length,
                  rev.length
                ),
              revN:
                rev.length
            };
          }
        )
        .sort(
          (a, b) =>
            b.total
            - a.total
        )
        .slice(
          0,
          40
        );

    table(
      "lesson-subject-table",
      [
        {
          label: "Matéria"
        },
        {
          label: "Progresso"
        },
        {
          label: "Concluídas",
          num: true
        },
        {
          label: "Pendentes",
          num: true
        },
        {
          label: "Atrasadas",
          num: true
        },
        {
          label: "Tempo",
          num: true
        },
        {
          label: "Revisões",
          num: true
        }
      ],
      rows.map(
        x => [
          `<strong>${esc(x.label)}</strong>`,

          `${percent(x.progress)} · ${x.done}/${x.total}`,

          num(
            x.done
          ),

          num(
            x.pending
          ),

          num(
            x.late
          ),

          hours(
            x.secs
          ),

          x.revN
            ? percent(
                x.revRate
              )
            : "—"
        ]
      )
    );

    const out = [];

    if (
      m.overdue.length
    ) {
      out.push({
        title:
          "Atrasos",

        text:
          `${m.overdue.length} aulas estão vencidas agora.`
      });
    }

    if (worst) {
      out.push({
        title:
          "Área mais pendente",

        text:
          `${worst.label} tem ${percent(worst.value)} das aulas concluídas.`
      });
    }

    if (best) {
      out.push({
        title:
          "Maior avanço",

        text:
          `${best.label} está com ${percent(best.value)} das aulas concluídas.`
      });
    }

    if (
      m.scheduledReviews.length
    ) {
      out.push({
        title:
          "Revisões teóricas",

        text:
          `${percent(m.reviewRate)} das revisões previstas foram concluídas.`
      });
    }

    if (
      m.moved.length
    ) {
      out.push({
        title:
          "Remanejamentos",

        text:
          `${m.moved.length} aulas mudaram de data, com deslocamento médio de ${days(mean(m.movedDays),1)}.`
      });
    }

    insights(
      "lesson-insights",
      out
    );
  }

  // =========================================================
  // FLASHCARDS
  // =========================================================

  function flashData() {
    const all =
      state.static.flashcards;

    const active =
      activeFlash();

    const reviews =
      current(
        state.period.flashReviews,
        "reviewed_at"
      );

    const prevReviews =
      previous(
        state.period.flashReviews,
        "reviewed_at"
      );

    const sessions =
      current(
        state.period.sessions,
        "started_at"
      )
        .filter(
          x =>
            x.activity_kind
            === "flashcards"
        );

    const prevSessions =
      previous(
        state.period.sessions,
        "started_at"
      )
        .filter(
          x =>
            x.activity_kind
            === "flashcards"
        );

    const created =
      all.filter(
        x =>
          state.range === "all"
          || inCurrent(
            x.created_at
          )
      );

    const unique =
      new Set(
        reviews.map(
          x =>
            x.flashcard_id
        )
      ).size;

    const correct =
      reviews
        .filter(
          x =>
            x.was_correct
        )
        .length;

    const accuracy =
      pct(
        correct,
        reviews.length
      );

    const prevAccuracy =
      pct(
        prevReviews
          .filter(
            x =>
              x.was_correct
          )
          .length,
        prevReviews.length
      );

    const easy =
      reviews
        .filter(
          x =>
            x.rating === "easy"
        )
        .length;

    const medium =
      reviews
        .filter(
          x =>
            x.rating === "medium"
        )
        .length;

    const hard =
      reviews
        .filter(
          x =>
            x.rating === "hard"
        )
        .length;

    const reviewed =
      active.filter(
        x =>
          x.review_count > 0
          && x.last_reviewed_at
      );

    const retVals =
      reviewed
        .map(
          x =>
            memory(
              x.last_reviewed_at,
              x.stability_days
            )
        )
        .filter(
          x =>
            x !== null
        );

    const retention =
      mean(
        retVals
      )
      * 100;

    const stability =
      reviewed
        .map(
          x =>
            Number(
              x.stability_days
              || 0
            )
        )
        .filter(
          x =>
            x > 0
        );

    const intervals =
      active
        .map(
          x =>
            Number(
              x.current_interval_days
              || 0
            )
        )
        .filter(
          x =>
            x > 0
        );

    const preR =
      reviews
        .map(
          x =>
            Number(
              x.retrievability_before
            )
        )
        .filter(
          Number.isFinite
        );

    const growth =
      reviews
        .map(
          x => {
            const a =
              Number(
                x.stability_before_days
              );

            const b =
              Number(
                x.stability_after_days
              );

            return (
              Number.isFinite(a)
              && a > 0
              && Number.isFinite(b)
            )
              ? (
                  b - a
                )
                / a
                * 100
              : null;
          }
        )
        .filter(
          x =>
            x !== null
        );

    const reviewDays =
      new Set(
        reviews.map(
          x =>
            dateKey(
              x.reviewed_at
            )
        )
      ).size;

    const today =
      startDay(
        new Date()
      );

    const todayKey =
      dateKey(
        today
      );

    const dueToday =
      active
        .filter(
          x =>
            dateKey(
              x.due_date
            )
            === todayKey
        )
        .length;

    const overdue =
      active
        .filter(
          x =>
            parseDate(
              x.due_date
            )
            < today
        )
        .length;

    const never =
      active
        .filter(
          x =>
            Number(
              x.review_count
              || 0
            ) === 0
        )
        .length;

    const next7 =
      active
        .filter(
          x => {
            const d =
              parseDate(
                x.due_date
              );

            return (
              d
              && d >= today
              && d <= addDays(
                today,
                7
              )
            );
          }
        )
        .length;

    const next30 =
      active
        .filter(
          x => {
            const d =
              parseDate(
                x.due_date
              );

            return (
              d
              && d >= today
              && d <= addDays(
                today,
                30
              )
            );
          }
        )
        .length;

    const fivePlus =
      active
        .filter(
          x =>
            x.review_count >= 5
        )
        .length;

    const low =
      reviewed
        .filter(
          x =>
            memory(
              x.last_reviewed_at,
              x.stability_days
            )
            < .70
        )
        .length;

    const high =
      reviewed
        .filter(
          x =>
            memory(
              x.last_reviewed_at,
              x.stability_days
            )
            >= .95
        )
        .length;

    const bySubject =
      groupedRetention(
        reviewed,
        subject,
        3
      );

    const byArea =
      groupedRetention(
        reviewed,
        area,
        3
      );

    const seconds =
      sum(
        sessions,
        x =>
          x.duration_seconds
      );

    const prevSeconds =
      sum(
        prevSessions,
        x =>
          x.duration_seconds
      );

    return {
      all,
      active,
      reviews,
      prevReviews,
      sessions,
      created,
      unique,
      correct,
      accuracy,
      prevAccuracy,
      easy,
      medium,
      hard,
      reviewed,
      retVals,
      retention,
      stability,
      intervals,
      preR,
      growth,
      reviewDays,
      dueToday,
      overdue,
      never,
      next7,
      next30,
      fivePlus,
      low,
      high,
      bySubject,
      byArea,
      weakSubject:
        bySubject[0],
      weakArea:
        byArea[0],
      seconds,
      prevSeconds,
      maxReview:
        active.length
          ? Math.max(
              ...active.map(
                x =>
                  Number(
                    x.review_count
                    || 0
                  )
              )
            )
          : 0
    };
  }

  function renderFlashcards() {
    const m =
      flashData();

    const incorrect =
      m.reviews.length
      - m.correct;

    renderSummary(
      "flash-summary",
      [
        {
          label:
            "Cards ativos",

          value:
            num(
              m.active.length
            ),

          helper:
            `${m.all.length} registrados`,

          progress:
            pct(
              m.active.length,
              m.all.length
            )
        },

        {
          label:
            "Revisões realizadas",

          value:
            num(
              m.reviews.length
            ),

          helper:
            compare(
              m.reviews.length,
              m.prevReviews.length
            ),

          progress:
            Math.min(
              100,
              m.reviews.length
              / 2000
              * 100
            )
        },

        {
          label:
            "Taxa de acerto",

          value:
            percent(
              m.accuracy,
              1
            ),

          helper:
            comparePP(
              m.accuracy,
              m.prevAccuracy
            ),

          progress:
            m.accuracy
        },

        {
          label:
            "Retenção atual",

          value:
            percent(
              m.retention,
              1
            ),

          helper:
            `${m.reviewed.length} cards estimados`,

          progress:
            m.retention
        },

        {
          label:
            "Novos cards",

          value:
            num(
              m.created.length
            ),

          helper:
            "criados",

          progress:
            Math.min(
              100,
              m.created.length
              / 300
              * 100
            )
        },

        {
          label:
            "Únicos revisados",

          value:
            num(
              m.unique
            ),

          helper:
            `${percent(pct(m.unique,m.active.length))} dos ativos`,

          progress:
            pct(
              m.unique,
              m.active.length
            )
        },

        {
          label:
            "Média por dia ativo",

          value:
            m.reviewDays
              ? num(
                  m.reviews.length
                  / m.reviewDays,
                  1
                )
              : "0",

          helper:
            "revisões/dia",

          progress:
            Math.min(
              100,
              (
                m.reviewDays
                  ? m.reviews.length
                    / m.reviewDays
                  : 0
              )
              / 150
              * 100
            )
        },

        {
          label:
            "Atrasados",

          value:
            num(
              m.overdue
            ),

          helper:
            `${percent(pct(m.overdue,m.active.length))} dos ativos`,

          progress:
            pct(
              m.overdue,
              m.active.length
            )
        },

        {
          label:
            "Estabilidade média",

          value:
            days(
              mean(
                m.stability
              ),
              1
            ),

          helper:
            `mediana ${days(median(m.stability),1)}`,

          progress:
            Math.min(
              100,
              mean(
                m.stability
              )
              / 90
              * 100
            )
        }
      ]
    );

    renderMetricStrip(
      "flash-volume-metrics",
      []
    );

    renderMetricStrip(
      "flash-quality-metrics",
      []
    );

    renderMetricStrip(
      "flash-load-metrics",
      []
    );

    renderMetricStrip(
      "flash-memory-metrics",
      []
    );

    const reviewSeries =
      dateSeries(
        m.reviews,
        "reviewed_at"
      );

    const accuracyByDate =
      Array.from(
        group(
          m.reviews,
          x =>
            dateKey(
              x.reviewed_at
            )
        ).entries()
      )
        .map(
          (
            [d, rows]
          ) => ({
            d,

            value:
              pct(
                rows
                  .filter(
                    x =>
                      x.was_correct
                  )
                  .length,
                rows.length
              )
          })
        );

    const accMap =
      new Map(
        accuracyByDate
          .map(
            x => [
              x.d,
              x.value
            ]
          )
      );

    chart(
      "chart-flash-reviews",
      "bar",
      reviewSeries.map(
        x =>
          x.label
      ),
      [
        {
          label:
            "Revisões",

          data:
            reviewSeries.map(
              x =>
                x.value
            )
        },

        {
          type:
            "line",

          label:
            "Acerto %",

          data:
            reviewSeries.map(
              x =>
                accMap.get(
                  x.date
                )
                ?? null
            )
        }
      ]
    );

    chart(
      "chart-flash-rating",
      "doughnut",
      [
        "Fácil",
        "Médio",
        "Difícil"
      ],
      [
        {
          label:
            "Respostas",

          data: [
            m.easy,
            m.medium,
            m.hard
          ]
        }
      ],
      {
        extra: {
          cutout: "64%"
        }
      }
    );

    const workload = [];

    for (
      let i = 0;
      i < 14;
      i++
    ) {
      const d =
        addDays(
          new Date(),
          i
        );

      const key =
        dateKey(d);

      workload.push({
        label:
          i === 0
            ? "hoje"
            : new Intl.DateTimeFormat(
                "pt-BR",
                {
                  day: "2-digit",
                  month: "2-digit"
                }
              ).format(d),

        value:
          m.active
            .filter(
              x =>
                dateKey(
                  x.due_date
                )
                === key
            )
            .length
      });
    }

    chart(
      "chart-flash-workload",
      "bar",
      workload.map(
        x =>
          x.label
      ),
      [
        {
          label:
            "Cards",

          data:
            workload.map(
              x =>
                x.value
            )
        }
      ]
    );

    progressList(
      "flash-area-retention",
      m.byArea
        .slice(
          0,
          12
        )
        .map(
          x => ({
            label:
              x.label,

            value:
              x.value,

            helper:
              `${x.evidence} cards`
          })
        )
    );

    const stabilityBins = [
      [
        "<3d",
        0,
        3
      ],
      [
        "3–7d",
        3,
        8
      ],
      [
        "8–21d",
        8,
        22
      ],
      [
        "22–45d",
        22,
        46
      ],
      [
        "46–90d",
        46,
        91
      ],
      [
        ">90d",
        91,
        Infinity
      ]
    ]
      .map(
        (
          [label, min, max]
        ) => ({
          label,

          value:
            m.reviewed
              .filter(
                x =>
                  Number(
                    x.stability_days
                  )
                  >= min
                  && Number(
                    x.stability_days
                  )
                  < max
              )
              .length
        })
      );

    chart(
      "chart-flash-stability",
      "bar",
      stabilityBins
        .map(
          x =>
            x.label
        ),
      [
        {
          label:
            "Cards",

          data:
            stabilityBins
              .map(
                x =>
                  x.value
              )
        }
      ]
    );

    const subjectRows =
      Array.from(
        group(
          m.active,
          subject
        ).entries()
      )
        .map(
          (
            [label, cards]
          ) => {
            const ids =
              new Set(
                cards.map(
                  x =>
                    x.id
                )
              );

            const rev =
              m.reviews
                .filter(
                  x =>
                    ids.has(
                      x.flashcard_id
                    )
                );

            const reviewed =
              cards.filter(
                x =>
                  x.review_count > 0
                  && x.last_reviewed_at
              );

            const ret =
              mean(
                reviewed
                  .map(
                    x =>
                      memory(
                        x.last_reviewed_at,
                        x.stability_days
                      )
                  )
                  .filter(
                    x =>
                      x !== null
                  )
              )
              * 100;

            const late =
              cards
                .filter(
                  x =>
                    parseDate(
                      x.due_date
                    )
                    < startDay(
                      new Date()
                    )
                )
                .length;

            return {
              label,

              cards:
                cards.length,

              reviews:
                rev.length,

              accuracy:
                pct(
                  rev
                    .filter(
                      x =>
                        x.was_correct
                    )
                    .length,
                  rev.length
                ),

              retention:
                ret,

              stability:
                mean(
                  reviewed.map(
                    x =>
                      x.stability_days
                  )
                ),

              interval:
                mean(
                  cards.map(
                    x =>
                      x.current_interval_days
                  )
                ),

              late
            };
          }
        )
        .sort(
          (a, b) =>
            b.cards
            - a.cards
        )
        .slice(
          0,
          50
        );

    table(
      "flash-subject-table",
      [
        {
          label: "Matéria"
        },
        {
          label: "Cards",
          num: true
        },
        {
          label: "Revisões",
          num: true
        },
        {
          label: "Acerto",
          num: true
        },
        {
          label: "Retenção",
          num: true
        },
        {
          label: "Estabilidade",
          num: true
        },
        {
          label: "Intervalo",
          num: true
        },
        {
          label: "Atrasados",
          num: true
        }
      ],
      subjectRows.map(
        x => [
          `<strong>${esc(x.label)}</strong>`,

          num(
            x.cards
          ),

          num(
            x.reviews
          ),

          x.reviews
            ? percent(
                x.accuracy,
                1
              )
            : "—",

          x.retention
            ? percent(
                x.retention,
                1
              )
            : "—",

          x.stability
            ? days(
                x.stability,
                1
              )
            : "—",

          x.interval
            ? days(
                x.interval,
                1
              )
            : "—",

          num(
            x.late
          )
        ]
      )
    );

    const fragile =
      m.reviewed
        .map(
          card => ({
            card,

            value:
              memory(
                card.last_reviewed_at,
                card.stability_days
              )
              * 100
          })
        )
        .sort(
          (a, b) =>
            a.value
            - b.value
        )
        .slice(
          0,
          10
        )
        .map(
          x => ({
            label:
              (
                x.card.front_text
                || "Flashcard"
              )
                .slice(
                  0,
                  72
                ),

            value:
              x.value,

            helper:
              `${subject(x.card)} · ${x.card.review_count} revisões`
          })
        );

    progressList(
      "flash-hardest",
      fragile,
      v =>
        percent(
          v,
          1
        )
    );

    const cardMap =
      new Map(
        m.all.map(
          x => [
            x.id,
            x
          ]
        )
      );

    const areaReview =
      Array.from(
        group(
          m.reviews,
          r => {
            const card =
              cardMap.get(
                r.flashcard_id
              );

            return card
              ? area(card)
              : "Sem área";
          }
        ).entries()
      )
        .map(
          (
            [label, rows]
          ) => ({
            label,
            value:
              rows.length
          })
        )
        .sort(
          (a, b) =>
            b.value
            - a.value
        )
        .slice(
          0,
          8
        );

    chart(
      "chart-flash-area",
      "bar",
      areaReview.map(
        x =>
          x.label
      ),
      [
        {
          label:
            "Revisões",

          data:
            areaReview.map(
              x =>
                x.value
            )
        }
      ]
    );

    const out = [];

    if (
      state.range !== "all"
    ) {
      out.push({
        title:
          "Volume",

        text:
          m.prevReviews.length
            ? `Foram ${
                num(
                  Math.abs(
                    (
                      m.reviews.length
                      - m.prevReviews.length
                    )
                    / m.prevReviews.length
                    * 100
                  )
                )
              }% ${
                m.reviews.length
                >= m.prevReviews.length
                  ? "mais"
                  : "menos"
              } revisões que no período anterior.`

            : `${m.reviews.length} revisões foram registradas no período.`
      });
    }

    if (
      m.weakArea
    ) {
      out.push({
        title:
          "Área mais frágil",

        text:
          `${m.weakArea.label} tem retenção estimada de ${percent(m.weakArea.value,1)} em ${m.weakArea.evidence} cards.`
      });
    }

    if (
      m.overdue
    ) {
      out.push({
        title:
          "Carga vencida",

        text:
          `${m.overdue} cards estão atrasados (${percent(pct(m.overdue,m.active.length))} dos ativos).`
      });
    }

    if (
      m.low
    ) {
      out.push({
        title:
          "Memória",

        text:
          `${m.low} cards têm recuperabilidade estimada abaixo de 70%.`
      });
    }

    if (
      m.growth.length
    ) {
      out.push({
        title:
          "Estabilidade",

        text:
          `A estabilidade cresceu em média ${num(mean(m.growth),1)}% nas revisões com dados antes/depois.`
      });
    }

    insights(
      "flash-insights",
      out
    );
  }

  // =========================================================
  // CADERNO DE ERROS
  // =========================================================

  function errorData() {
    const all =
      state.static.errors;

    const active =
      activeErrors();

    const reviews =
      current(
        state.period.errorReviews,
        "reviewed_at"
      );

    const prevReviews =
      previous(
        state.period.errorReviews,
        "reviewed_at"
      );

    const sessions =
      current(
        state.period.sessions,
        "started_at"
      )
        .filter(
          x =>
            x.activity_kind
            === "error_notebook"
        );

    const prevSessions =
      previous(
        state.period.sessions,
        "started_at"
      )
        .filter(
          x =>
            x.activity_kind
            === "error_notebook"
        );

    const created =
      all.filter(
        x =>
          state.range === "all"
          || inCurrent(
            x.created_at
          )
      );

    const unique =
      new Set(
        reviews.map(
          x =>
            x.error_id
        )
      ).size;

    const reviewed =
      active.filter(
        x =>
          x.review_count > 0
          && x.last_reviewed_at
      );

    const never =
      active
        .filter(
          x =>
            !x.review_count
        )
        .length;

    const today =
      startDay(
        new Date()
      );

    const overdue =
      active
        .filter(
          x =>
            parseDate(
              x.due_date
            )
            < today
        )
        .length;

    const dueToday =
      active
        .filter(
          x =>
            dateKey(
              x.due_date
            )
            === dateKey(today)
        )
        .length;

    const next7 =
      active
        .filter(
          x => {
            const d =
              parseDate(
                x.due_date
              );

            return (
              d
              && d >= today
              && d <= addDays(
                today,
                7
              )
            );
          }
        )
        .length;

    const next30 =
      active
        .filter(
          x => {
            const d =
              parseDate(
                x.due_date
              );

            return (
              d
              && d >= today
              && d <= addDays(
                today,
                30
              )
            );
          }
        )
        .length;

    const ret =
      mean(
        reviewed
          .map(
            x =>
              memory(
                x.last_reviewed_at,
                x.stability_days
              )
          )
          .filter(
            x =>
              x !== null
          )
      )
      * 100;

    const stability =
      reviewed
        .map(
          x =>
            Number(
              x.stability_days
              || 0
            )
        )
        .filter(
          x =>
            x > 0
        );

    const intervals =
      active
        .map(
          x =>
            Number(
              x.current_interval_days
              || 0
            )
        )
        .filter(
          x =>
            x > 0
        );

    const reviewDays =
      new Set(
        reviews.map(
          x =>
            dateKey(
              x.reviewed_at
            )
        )
      ).size;

    const threePlus =
      active
        .filter(
          x =>
            x.review_count >= 3
        )
        .length;

    const areaGroups =
      Array.from(
        group(
          active,
          area
        ).entries()
      )
        .map(
          (
            [label, rows]
          ) => ({
            label,
            count:
              rows.length
          })
        )
        .sort(
          (a, b) =>
            b.count
            - a.count
        );

    const subjectGroups =
      Array.from(
        group(
          active,
          subject
        ).entries()
      )
        .map(
          (
            [label, rows]
          ) => ({
            label,
            count:
              rows.length
          })
        )
        .sort(
          (a, b) =>
            b.count
            - a.count
        );

    const byArea =
      groupedRetention(
        reviewed,
        area,
        2
      );

    const bySubject =
      groupedRetention(
        reviewed,
        subject,
        2
      );

    const seconds =
      sum(
        sessions,
        x =>
          x.duration_seconds
      );

    const prevSeconds =
      sum(
        prevSessions,
        x =>
          x.duration_seconds
      );

    const originated =
      current(
        state.period.questionAttempts,
        "answered_at"
      )
        .filter(
          x =>
            x.sent_to_error
            && x.error_entry_id
        )
        .length;

    const createdDates =
      active
        .map(
          x =>
            parseDate(
              x.created_at
            )
        )
        .filter(Boolean)
        .sort(
          (a, b) =>
            a - b
        );

    return {
      all,
      active,
      reviews,
      prevReviews,
      sessions,
      created,
      unique,
      reviewed,
      never,
      overdue,
      dueToday,
      next7,
      next30,
      ret,
      stability,
      intervals,
      reviewDays,
      threePlus,
      areaGroups,
      subjectGroups,
      byArea,
      bySubject,
      seconds,
      prevSeconds,
      originated,
      oldest:
        createdDates[0],
      newest:
        createdDates.at(-1)
    };
  }

  function renderErrors() {
    const m =
      errorData();

    renderSummary(
      "error-summary",
      [
        {
          label:
            "CCQs ativos",

          value:
            num(
              m.active.length
            ),

          helper:
            `${m.all.length} registrados`,

          progress:
            pct(
              m.active.length,
              m.all.length
            )
        },

        {
          label:
            "Revisões realizadas",

          value:
            num(
              m.reviews.length
            ),

          helper:
            compare(
              m.reviews.length,
              m.prevReviews.length
            ),

          progress:
            Math.min(
              100,
              m.reviews.length
              / 500
              * 100
            )
        },

        {
          label:
            "Retenção atual",

          value:
            percent(
              m.ret,
              1
            ),

          helper:
            `${m.reviewed.length} CCQs estimados`,

          progress:
            m.ret
        },

        {
          label:
            "Atrasados",

          value:
            num(
              m.overdue
            ),

          helper:
            `${percent(pct(m.overdue,m.active.length))} dos ativos`,

          progress:
            pct(
              m.overdue,
              m.active.length
            )
        },

        {
          label:
            "CCQs criados",

          value:
            num(
              m.created.length
            ),

          helper:
            "novos registros",

          progress:
            Math.min(
              100,
              m.created.length
              / 100
              * 100
            )
        },

        {
          label:
            "Únicos revisados",

          value:
            num(
              m.unique
            ),

          helper:
            `${percent(pct(m.unique,m.active.length))} dos ativos`,

          progress:
            pct(
              m.unique,
              m.active.length
            )
        },

        {
          label:
            "Nunca revisados",

          value:
            num(
              m.never
            ),

          helper:
            `${percent(pct(m.never,m.active.length))} dos ativos`,

          progress:
            pct(
              m.never,
              m.active.length
            )
        },

        {
          label:
            "Estabilidade média",

          value:
            days(
              mean(
                m.stability
              ),
              1
            ),

          helper:
            `mediana ${days(median(m.stability),1)}`,

          progress:
            Math.min(
              100,
              mean(
                m.stability
              )
              / 90
              * 100
            )
        },

        {
          label:
            "Área com mais CCQs",

          value:
            m.areaGroups[0]
              ?.label
            || "—",

          helper:
            m.areaGroups[0]
              ? `${m.areaGroups[0].count} ativos`
              : "sem dados",

          progress:
            pct(
              m.areaGroups[0]?.count
              || 0,
              m.active.length
            )
        }
      ]
    );

    renderMetricStrip(
      "error-volume-metrics",
      []
    );

    renderMetricStrip(
      "error-load-metrics",
      []
    );

    renderMetricStrip(
      "error-memory-metrics",
      []
    );

    const createdSeries =
      dateSeries(
        m.created,
        "created_at"
      );

    const reviewSeries =
      dateSeries(
        m.reviews,
        "reviewed_at"
      );

    const reviewMap =
      new Map(
        reviewSeries.map(
          x => [
            x.date,
            x.value
          ]
        )
      );

    chart(
      "chart-error-flow",
      "bar",
      createdSeries.map(
        x =>
          x.label
      ),
      [
        {
          label:
            "Criados",

          data:
            createdSeries.map(
              x =>
                x.value
            )
        },

        {
          label:
            "Revisões",

          data:
            createdSeries.map(
              x =>
                reviewMap.get(
                  x.date
                )
                || 0
            )
        }
      ]
    );

    chart(
      "chart-error-area",
      "doughnut",
      m.areaGroups
        .slice(
          0,
          8
        )
        .map(
          x =>
            x.label
        ),
      [
        {
          label:
            "CCQs",

          data:
            m.areaGroups
              .slice(
                0,
                8
              )
              .map(
                x =>
                  x.count
              )
        }
      ],
      {
        extra: {
          cutout: "64%"
        }
      }
    );

    const workload = [];

    for (
      let i = 0;
      i < 14;
      i++
    ) {
      const d =
        addDays(
          new Date(),
          i
        );

      const key =
        dateKey(d);

      workload.push({
        label:
          i === 0
            ? "hoje"
            : new Intl.DateTimeFormat(
                "pt-BR",
                {
                  day: "2-digit",
                  month: "2-digit"
                }
              ).format(d),

        value:
          m.active
            .filter(
              x =>
                dateKey(
                  x.due_date
                )
                === key
            )
            .length
      });
    }

    chart(
      "chart-error-workload",
      "bar",
      workload.map(
        x =>
          x.label
      ),
      [
        {
          label:
            "CCQs",

          data:
            workload.map(
              x =>
                x.value
            )
        }
      ]
    );

    progressList(
      "error-area-retention",
      m.byArea
        .slice(
          0,
          12
        )
        .map(
          x => ({
            label:
              x.label,

            value:
              x.value,

            helper:
              `${x.evidence} CCQs`
          })
        )
    );

    const depth = [
      [
        "Nunca",
        m.active.filter(
          x =>
            x.review_count === 0
        ).length
      ],

      [
        "1x",
        m.active.filter(
          x =>
            x.review_count === 1
        ).length
      ],

      [
        "2x",
        m.active.filter(
          x =>
            x.review_count === 2
        ).length
      ],

      [
        "3x",
        m.active.filter(
          x =>
            x.review_count === 3
        ).length
      ],

      [
        "4x",
        m.active.filter(
          x =>
            x.review_count === 4
        ).length
      ],

      [
        "5+x",
        m.active.filter(
          x =>
            x.review_count >= 5
        ).length
      ]
    ];

    chart(
      "chart-error-depth",
      "bar",
      depth.map(
        x =>
          x[0]
      ),
      [
        {
          label:
            "CCQs",

          data:
            depth.map(
              x =>
                x[1]
            )
        }
      ]
    );

    const subjRows =
      Array.from(
        group(
          m.active,
          subject
        ).entries()
      )
        .map(
          (
            [label, items]
          ) => {
            const reviewed =
              items.filter(
                x =>
                  x.review_count > 0
                  && x.last_reviewed_at
              );

            const ret =
              mean(
                reviewed
                  .map(
                    x =>
                      memory(
                        x.last_reviewed_at,
                        x.stability_days
                      )
                  )
                  .filter(
                    x =>
                      x !== null
                  )
              )
              * 100;

            return {
              label,

              active:
                items.length,

              reviews:
                sum(
                  items,
                  x =>
                    x.review_count
                ),

              ret,

              stability:
                mean(
                  reviewed.map(
                    x =>
                      x.stability_days
                  )
                ),

              interval:
                mean(
                  items.map(
                    x =>
                      x.current_interval_days
                  )
                ),

              late:
                items
                  .filter(
                    x =>
                      parseDate(
                        x.due_date
                      )
                      < startDay(
                        new Date()
                      )
                  )
                  .length
            };
          }
        )
        .sort(
          (a, b) =>
            b.active
            - a.active
        )
        .slice(
          0,
          50
        );

    table(
      "error-subject-table",
      [
        {
          label:
            "Matéria"
        },
        {
          label:
            "CCQs ativos",
          num: true
        },
        {
          label:
            "Revisões",
          num: true
        },
        {
          label:
            "Retenção",
          num: true
        },
        {
          label:
            "Estabilidade",
          num: true
        },
        {
          label:
            "Intervalo",
          num: true
        },
        {
          label:
            "Atrasados",
          num: true
        }
      ],
      subjRows.map(
        x => [
          `<strong>${esc(x.label)}</strong>`,

          num(
            x.active
          ),

          num(
            x.reviews
          ),

          x.ret
            ? percent(
                x.ret,
                1
              )
            : "—",

          x.stability
            ? days(
                x.stability,
                1
              )
            : "—",

          x.interval
            ? days(
                x.interval,
                1
              )
            : "—",

          num(
            x.late
          )
        ]
      )
    );

    const persistent =
      m.active
        .slice()
        .sort(
          (a, b) =>
            b.review_count
            - a.review_count
        )
        .slice(
          0,
          10
        )
        .map(
          x => ({
            label:
              (
                x.ccq
                || x.theme
                || "CCQ"
              )
                .slice(
                  0,
                  78
                ),

            value:
              x.review_count,

            helper:
              `${subject(x)} · ${
                x.last_reviewed_at
                  ? `última ${fmtDate(x.last_reviewed_at)}`
                  : "nunca revisado"
              }`
          })
        );

    progressList(
      "error-most-reviewed",
      persistent,
      v =>
        `${num(v)}×`,
      Math.max(
        1,
        ...persistent.map(
          x =>
            x.value
        )
      )
    );

    chart(
      "chart-error-subject",
      "bar",
      m.subjectGroups
        .slice(
          0,
          10
        )
        .map(
          x =>
            x.label
        ),
      [
        {
          label:
            "CCQs ativos",

          data:
            m.subjectGroups
              .slice(
                0,
                10
              )
              .map(
                x =>
                  x.count
              )
        }
      ]
    );

    const out = [];

    if (
      m.areaGroups[0]
    ) {
      out.push({
        title:
          "Concentração",

        text:
          `${m.areaGroups[0].label} concentra ${m.areaGroups[0].count} CCQs ativos (${percent(pct(m.areaGroups[0].count,m.active.length))}).`
      });
    }

    if (
      m.overdue
    ) {
      out.push({
        title:
          "Revisões vencidas",

        text:
          `${m.overdue} CCQs estão atrasados (${percent(pct(m.overdue,m.active.length))} dos ativos).`
      });
    }

    if (
      m.byArea[0]
    ) {
      out.push({
        title:
          "Memória",

        text:
          `${m.byArea[0].label} apresenta a menor retenção estimada entre áreas com pelo menos 2 CCQs revisados: ${percent(m.byArea[0].value,1)}.`
      });
    }

    if (
      m.threePlus
    ) {
      out.push({
        title:
          "Profundidade",

        text:
          `${m.threePlus} CCQs já passaram por pelo menos 3 revisões.`
      });
    }

    if (
      m.originated
    ) {
      out.push({
        title:
          "Questões → Caderno",

        text:
          `${m.originated} erros de questões foram enviados ao Caderno no período.`
      });
    }

    insights(
      "error-insights",
      out
    );
  }

  function renderQuestions() {
    const attempts =
      current(
        state.period.questionAttempts,
        "answered_at"
      );

    const prevAttempts =
      previous(
        state.period.questionAttempts,
        "answered_at"
      );

    const correct =
      attempts
        .filter(
          x =>
            x.result === "correct"
        )
        .length;

    const wrong =
      attempts
        .filter(
          x =>
            x.result === "wrong"
        )
        .length;

    const accuracy =
      pct(
        correct,
        attempts.length
      );

    const prevAccuracy =
      pct(
        prevAttempts
          .filter(
            x =>
              x.result === "correct"
          )
          .length,
        prevAttempts.length
      );

    const sent =
      attempts
        .filter(
          x =>
            x.sent_to_error
            === true
        )
        .length;

    const conversion =
      pct(
        sent,
        wrong
      );

    const sets =
      state.static.questionSets
        .filter(
          x =>
            x.last_answered_at
            && (
              state.range === "all"
              || inCurrent(
                x.last_answered_at
              )
            )
        );

    const completedSets =
      sets
        .filter(
          x =>
            x.completed
            === true
        )
        .length;

    const setAccuracies =
      sets
        .map(
          x =>
            Number(
              x.accuracy_percent
            )
        )
        .filter(
          Number.isFinite
        );

    const areasPreview =
      Array.from(
        group(
          attempts,
          area
        ).entries()
      )
        .map(
          (
            [label, rows]
          ) => {
            const c =
              rows
                .filter(
                  x =>
                    x.result === "correct"
                )
                .length;

            return {
              label,

              total:
                rows.length,

              accuracy:
                pct(
                  c,
                  rows.length
                )
            };
          }
        )
        .filter(
          x =>
            x.total >= 1
        );

    const strongest =
      areasPreview
        .filter(
          x =>
            x.total >= 5
        )
        .slice()
        .sort(
          (a, b) =>
            b.accuracy
            - a.accuracy
        )[0];

    const weakest =
      areasPreview
        .filter(
          x =>
            x.total >= 5
        )
        .slice()
        .sort(
          (a, b) =>
            a.accuracy
            - b.accuracy
        )[0];

    const bestSet =
      sets
        .filter(
          x =>
            Number.isFinite(
              Number(
                x.accuracy_percent
              )
            )
        )
        .slice()
        .sort(
          (a, b) =>
            Number(
              b.accuracy_percent
            )
            - Number(
                a.accuracy_percent
              )
        )[0];

    renderSummary(
      "question-summary",
      [
        {
          label:
            "Simulados realizados",

          value:
            num(
              completedSets
            ),

          helper:
            `${sets.length} com atividade`,

          progress:
            Math.min(
              100,
              completedSets
              * 12
            )
        },

        {
          label:
            "Questões respondidas",

          value:
            num(
              attempts.length
            ),

          helper:
            compare(
              attempts.length,
              prevAttempts.length
            ),

          progress:
            Math.min(
              100,
              attempts.length
              / 500
              * 100
            )
        },

        {
          label:
            "Aproveitamento",

          value:
            percent(
              accuracy,
              1
            ),

          helper:
            comparePP(
              accuracy,
              prevAccuracy
            ),

          progress:
            accuracy
        },

        {
          label:
            "Acertos",

          value:
            num(
              correct
            ),

          helper:
            `${percent(accuracy,1)} das respostas`,

          progress:
            accuracy
        },

        {
          label:
            "Erros",

          value:
            num(
              wrong
            ),

          helper:
            `${percent(pct(wrong,attempts.length),1)} das respostas`,

          progress:
            pct(
              wrong,
              attempts.length
            )
        },

        {
          label:
            "Erros enviados ao Caderno",

          value:
            num(
              sent
            ),

          helper:
            `${percent(conversion,1)} dos erros`,

          progress:
            conversion
        },

        {
          label:
            "Conversão para o Caderno",

          value:
            percent(
              conversion,
              1
            ),

          helper:
            `${sent}/${wrong} erros`,

          progress:
            conversion
        },

        {
          label:
            "Melhor área",

          value:
            strongest?.label
            || "—",

          helper:
            strongest
              ? `${percent(strongest.accuracy,1)} · ${strongest.total} questões`
              : "mínimo 5 questões",

          progress:
            strongest?.accuracy
            || 0
        },

        {
          label:
            "Área mais frágil",

          value:
            weakest?.label
            || "—",

          helper:
            weakest
              ? `${percent(weakest.accuracy,1)} · ${weakest.total} questões`
              : "mínimo 5 questões",

          progress:
            weakest?.accuracy
            || 0
        }
      ]
    );

    renderMetricStrip(
      "question-performance-metrics",
      []
    );

    renderMetricStrip(
      "question-error-metrics",
      []
    );

    const series =
      dateSeries(
        attempts,
        "answered_at"
      );

    const dailyAcc =
      Array.from(
        group(
          attempts,
          x =>
            dateKey(
              x.answered_at
            )
        ).entries()
      )
        .map(
          (
            [key, rows]
          ) => [
            key,

            pct(
              rows
                .filter(
                  x =>
                    x.result === "correct"
                )
                .length,
              rows.length
            )
          ]
        );

    const accMap =
      new Map(
        dailyAcc
      );

    chart(
      "chart-question-trend",
      "bar",
      series.map(
        x =>
          x.label
      ),
      [
        {
          label:
            "Questões",

          data:
            series.map(
              x =>
                x.value
            )
        },

        {
          type:
            "line",

          label:
            "Acerto %",

          data:
            series.map(
              x =>
                accMap.get(
                  x.date
                )
                ?? null
            )
        }
      ]
    );

    const areas =
      Array.from(
        group(
          attempts,
          area
        ).entries()
      )
        .map(
          (
            [label, rows]
          ) => {
            const c =
              rows
                .filter(
                  x =>
                    x.result === "correct"
                )
                .length;

            const w =
              rows.length
              - c;

            const s =
              rows
                .filter(
                  x =>
                    x.sent_to_error
                )
                .length;

            return {
              label,

              total:
                rows.length,

              correct:
                c,

              wrong:
                w,

              sent:
                s,

              accuracy:
                pct(
                  c,
                  rows.length
                )
            };
          }
        )
        .sort(
          (a, b) =>
            b.total
            - a.total
        );

    chart(
      "chart-question-area",
      "bar",
      areas
        .slice(
          0,
          10
        )
        .map(
          x =>
            x.label
        ),
      [
        {
          label:
            "Acerto %",

          data:
            areas
              .slice(
                0,
                10
              )
              .map(
                x =>
                  Number(
                    x.accuracy
                      .toFixed(1)
                  )
              )
        }
      ],
      {
        max: 100
      }
    );

    table(
      "question-area-table",
      [
        {
          label: "Área"
        },
        {
          label: "Questões",
          num: true
        },
        {
          label: "Acertos",
          num: true
        },
        {
          label: "Erros",
          num: true
        },
        {
          label: "Aproveitamento",
          num: true
        },
        {
          label: "Enviados ao Caderno",
          num: true
        }
      ],
      areas.map(
        x => [
          `<strong>${esc(x.label)}</strong>`,

          num(
            x.total
          ),

          num(
            x.correct
          ),

          num(
            x.wrong
          ),

          percent(
            x.accuracy,
            1
          ),

          num(
            x.sent
          )
        ]
      )
    );

    table(
      "question-set-table",
      [
        {
          label:
            "Simulado"
        },
        {
          label:
            "Questões",
          num: true
        },
        {
          label:
            "Respondidas",
          num: true
        },
        {
          label:
            "Acertos",
          num: true
        },
        {
          label:
            "Erros",
          num: true
        },
        {
          label:
            "Aproveitamento",
          num: true
        },
        {
          label:
            "Ao Caderno",
          num: true
        }
      ],
      sets
        .slice()
        .sort(
          (a, b) =>
            String(
              b.last_answered_at
              || ""
            )
              .localeCompare(
                String(
                  a.last_answered_at
                  || ""
                )
              )
        )
        .map(
          x => [
            `<strong>${esc(x.title || "Simulado")}</strong>`,

            num(
              x.total_questions
            ),

            num(
              x.answered_count
            ),

            num(
              x.correct_count
            ),

            num(
              x.wrong_count
            ),

            x.accuracy_percent
            == null
              ? "—"
              : percent(
                  Number(
                    x.accuracy_percent
                  ),
                  1
                ),

            num(
              x.sent_to_error_count
            )
          ]
        )
    );

    const out = [];

    if (
      weakest
    ) {
      out.push({
        title:
          "Área com menor aproveitamento",

        text:
          `${weakest.label}: ${percent(weakest.accuracy,1)} em ${weakest.total} questões.`
      });
    }

    if (
      strongest
    ) {
      out.push({
        title:
          "Área com maior aproveitamento",

        text:
          `${strongest.label}: ${percent(strongest.accuracy,1)} em ${strongest.total} questões.`
      });
    }

    if (wrong) {
      out.push({
        title:
          "Conversão para o Caderno",

        text:
          `${sent} de ${wrong} erros foram transformados em revisão (${percent(conversion,1)}).`
      });
    }

    if (
      state.range !== "all"
      && prevAttempts.length
    ) {
      out.push({
        title:
          "Tendência",

        text:
          `O aproveitamento ${
            accuracy >= prevAccuracy
              ? "subiu"
              : "caiu"
          } ${num(Math.abs(accuracy-prevAccuracy),1)} p.p. em relação ao período anterior.`
      });
    }

    insights(
      "question-insights",
      out
    );

    renderQuestionAreaWeekHeatmap(
      "question-area-week-heatmap",
      attempts
    );
  }

  // =========================================================
  // CONTROLES / INICIALIZAÇÃO
  // =========================================================

  function renderAll() {
    renderGeneral();
    renderLessons();
    renderFlashcards();
    renderErrors();
    renderQuestions();

    const status =
      $("stats-status");

    if (
      state.sourceErrors.length
    ) {
      status.className =
        "stats-status error";

      status.textContent =
        `Dados carregados com ressalvas: ${state.sourceErrors.join(" | ")}`;
    } else {
      status.className =
        "stats-status";

      status.textContent =
        `Atualizado · período: ${labelPeriod()}`;
    }
  }

  function switchTab(tab) {
    state.tab = tab;

    document
      .querySelectorAll(
        "[data-tab]"
      )
      .forEach(
        x =>
          x.classList
            .toggle(
              "active",
              x.dataset.tab === tab
            )
      );

    document
      .querySelectorAll(
        "[data-stats-panel]"
      )
      .forEach(
        x =>
          x.hidden =
            x.dataset.statsPanel
            !== tab
      );

    setTimeout(
      () =>
        charts.forEach(
          c =>
            c.resize()
        ),
      30
    );
  }

  function setHeading() {
    const title =
      document.querySelector(
        "[data-page-title]"
      );

    const eye =
      document.querySelector(
        "[data-page-eyebrow]"
      );

    if (title) {
      title.textContent =
        "Estatísticas";
    }

    if (eye) {
      eye.textContent =
        "Análise de desempenho";
    }
  }

  async function refresh() {
    if (
      state.loading
    ) {
      return;
    }

    state.loading =
      true;

    state.sourceErrors =
      [];

    const status =
      $("stats-status");

    status.className =
      "stats-status";

    status.textContent =
      "Atualizando estatísticas...";

    try {
      await loadPeriod();
      renderAll();
    } catch (err) {
      console.error(err);

      status.className =
        "stats-status error";

      status.textContent =
        `Erro ao carregar estatísticas: ${err.message}`;
    } finally {
      state.loading =
        false;
    }
  }

  function wire() {
    document
      .querySelectorAll(
        "[data-tab]"
      )
      .forEach(
        btn => {
          btn.addEventListener(
            "click",
            () =>
              switchTab(
                btn.dataset.tab
              )
          );
        }
      );

    document
      .querySelectorAll(
        "[data-range]"
      )
      .forEach(
        btn => {
          btn.addEventListener(
            "click",
            async () => {
              const raw =
                btn.dataset.range;

              const value =
                raw === "all"
                  ? "all"
                  : Number(raw);

              if (
                ![
                  14,
                  30,
                  90,
                  "all"
                ].includes(value)
                || value === state.range
              ) {
                return;
              }

              state.range =
                value;

              document
                .querySelectorAll(
                  "[data-range]"
                )
                .forEach(
                  x => {
                    const xv =
                      x.dataset.range
                      === "all"
                        ? "all"
                        : Number(
                            x.dataset.range
                          );

                    x.classList.toggle(
                      "active",
                      xv === value
                    );
                  }
                );

              await refresh();
            }
          );
        }
      );
  }

  async function init() {
    if (
      state.initialized
      || !sb
    ) {
      return;
    }

    state.initialized =
      true;

    setHeading();
    wire();

    switchTab(
      "geral"
    );

    try {
      state.loading =
        true;

      state.bounds =
        makeBounds(
          state.range
        );

      await loadStatic();
      await loadPeriod();

      renderAll();
    } catch (err) {
      console.error(err);

      const status =
        $("stats-status");

      status.className =
        "stats-status error";

      status.textContent =
        `Não foi possível carregar a página: ${err.message}`;
    } finally {
      state.loading =
        false;
    }
  }

  if (
    window.docmapUser
  ) {
    init();
  } else {
    window.addEventListener(
      "docmap:ready",
      init,
      {
        once: true
      }
    );
  }

  setTimeout(
    setHeading,
    500
  );
})();