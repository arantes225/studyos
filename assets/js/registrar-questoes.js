const questionsSb = window.supabaseClient;

const questionsState = {
  user: null,
  sessions: [],
  questionWeekdays: [1,2,3,4,5,6,7]
};

function localISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalISODate(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfWeek(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + delta);
  return d;
}

function addDays(date, amount) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function isoWeekday(date = new Date()) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function escapeQuestionHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDateBR(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(parseLocalISODate(value));
}

function formatAccuracy(correct, total) {
  if (!total) return "—";

  return `${((correct / total) * 100).toFixed(1).replace(".", ",")}%`;
}

function setQuestionStatus(text, type = "") {
  const element = document.getElementById("question-status");
  element.textContent = text;
  element.className = `question-status ${type}`.trim();
}

function readInteger(id) {
  const value = document.getElementById(id).value;

  if (value === "") return null;

  const number = Number(value);

  if (!Number.isInteger(number)) return null;

  return number;
}

function updateLiveResult() {
  const total = readInteger("question-total") ?? 0;
  const correct = readInteger("question-correct") ?? 0;
  const wrong = Math.max(0, total - correct);

  document.getElementById("question-wrong").value =
    total >= 0 && correct >= 0 ? wrong : 0;

  document.getElementById("live-total").textContent = total;
  document.getElementById("live-wrong").textContent = wrong;

  document.getElementById("live-accuracy").textContent =
    total > 0 && correct <= total
      ? formatAccuracy(correct, total)
      : "—";
}

async function loadQuestionSettings() {
  const { data, error } = await questionsSb
    .from("user_settings")
    .select("question_weekdays")
    .eq("user_id", questionsState.user.id)
    .single();

  if (!error && Array.isArray(data?.question_weekdays)) {
    questionsState.questionWeekdays = data.question_weekdays.map(Number);
  }

  renderQuestionDayBanner();
}

function renderQuestionDayBanner() {
  const banner = document.getElementById("question-day-banner");
  const title = document.getElementById("question-day-title");
  const copy = document.getElementById("question-day-copy");
  const badge = document.getElementById("question-day-badge");

  const allowed =
    questionsState.questionWeekdays.includes(isoWeekday(new Date()));

  const formatter = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long"
  });

  const weekdayName = formatter.format(new Date());

  banner.classList.toggle("allowed", allowed);

  if (allowed) {
    title.textContent = "Hoje está configurado como dia de questões";
    copy.textContent = `${weekdayName} faz parte da sua rotina de questões.`;
    badge.textContent = "Dia de questões";
  } else {
    title.textContent = "Hoje não está configurado como dia de questões";
    copy.textContent =
      "Você pode registrar normalmente. Essa configuração serve para organizar sua rotina.";
    badge.textContent = "Dia livre";
  }
}

async function loadQuestionSessions() {
  const { data, error } = await questionsSb
    .from("question_sessions")
    .select("*")
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error(error);

    setQuestionStatus(
      `Não foi possível carregar as sessões: ${error.message}`,
      "error"
    );

    return;
  }

  questionsState.sessions = data || [];

  renderQuestionMetrics();
  renderAreaBreakdown();
  renderHistory();
}

function sessionsBetween(startDate, endDate) {
  const start = localISODate(startDate);
  const end = localISODate(endDate);

  return questionsState.sessions.filter(
    (session) =>
      session.session_date >= start
      && session.session_date <= end
  );
}

function aggregateSessions(sessions) {
  return sessions.reduce(
    (acc, session) => {
      acc.sessions += 1;
      acc.total += Number(session.total_questions || 0);
      acc.correct += Number(session.correct_answers || 0);
      acc.wrong += Number(session.wrong_answers || 0);
      return acc;
    },
    {
      sessions: 0,
      total: 0,
      correct: 0,
      wrong: 0
    }
  );
}

function renderQuestionMetrics() {
  const weekStart = startOfWeek(new Date());
  const weekEnd = addDays(weekStart, 6);

  const week = aggregateSessions(
    sessionsBetween(weekStart, weekEnd)
  );

  document.getElementById("metric-total").textContent =
    week.total;

  document.getElementById("metric-correct").textContent =
    week.correct;

  document.getElementById("metric-wrong").textContent =
    week.wrong;

  document.getElementById("metric-accuracy").textContent =
    formatAccuracy(week.correct, week.total);

  document.getElementById("metric-sessions").textContent =
    `${week.sessions} ${week.sessions === 1 ? "sessão" : "sessões"}`;
}

function renderAreaBreakdown() {
  const container = document.getElementById("area-breakdown");

  const today = new Date();
  const thirtyDaysAgo = addDays(today, -29);

  const recent = sessionsBetween(thirtyDaysAgo, today);

  const byArea = new Map();

  for (const session of recent) {
    const area =
      session.area?.trim()
      || "Sem área";

    if (!byArea.has(area)) {
      byArea.set(area, {
        total: 0,
        correct: 0
      });
    }

    const item = byArea.get(area);

    item.total += Number(session.total_questions || 0);
    item.correct += Number(session.correct_answers || 0);
  }

  const rows = Array.from(byArea.entries())
    .map(([area, values]) => ({
      area,
      total: values.total,
      correct: values.correct,
      accuracy:
        values.total > 0
          ? (values.correct / values.total) * 100
          : 0
    }))
    .sort((a, b) => b.total - a.total);

  if (!rows.length) {
    container.innerHTML =
      '<div class="empty-breakdown">Ainda não há questões registradas nos últimos 30 dias.</div>';
    return;
  }

  container.innerHTML = rows.map((row) => `
    <div class="area-row">
      <div class="area-row-head">
        <strong>${escapeQuestionHtml(row.area)}</strong>
        <span>
          ${row.total} questões ·
          ${row.accuracy.toFixed(1).replace(".", ",")}%
        </span>
      </div>

      <div class="area-bar">
        <span style="--accuracy: ${Math.max(0, Math.min(100, row.accuracy))}%"></span>
      </div>
    </div>
  `).join("");
}

function renderHistory() {
  const body = document.getElementById("history-body");
  const count = document.getElementById("history-count");

  const sessions = questionsState.sessions.slice(0, 30);

  count.textContent =
    `${questionsState.sessions.length} ${
      questionsState.sessions.length === 1
        ? "sessão"
        : "sessões"
    }`;

  if (!sessions.length) {
    body.innerHTML = `
      <tr>
        <td colspan="9" class="empty-history">
          Nenhuma sessão registrada ainda.
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = sessions.map((session) => {
    const areaMateria =
      [session.area, session.materia]
        .filter(Boolean)
        .join(" · ")
      || "—";

    return `
      <tr>
        <td>${formatDateBR(session.session_date)}</td>
        <td>${escapeQuestionHtml(session.platform || "—")}</td>
        <td>${escapeQuestionHtml(areaMateria)}</td>
        <td>${escapeQuestionHtml(session.theme || "—")}</td>
        <td>${session.total_questions}</td>
        <td>${session.correct_answers}</td>
        <td>${session.wrong_answers}</td>
        <td class="history-performance">
          ${formatAccuracy(
            Number(session.correct_answers),
            Number(session.total_questions)
          )}
        </td>
        <td>
          <button
            class="history-delete"
            type="button"
            data-delete-question-session="${escapeQuestionHtml(session.id)}"
          >
            Excluir
          </button>
        </td>
      </tr>
    `;
  }).join("");

  document
    .querySelectorAll("[data-delete-question-session]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        deleteQuestionSession(
          button.dataset.deleteQuestionSession
        );
      });
    });
}

async function saveQuestionSession(event) {
  event.preventDefault();

  const total = readInteger("question-total");
  const correct = readInteger("question-correct");
  const durationMinutes = readInteger("question-duration");

  if (!total || total < 1) {
    setQuestionStatus(
      "Informe quantas questões foram realizadas.",
      "error"
    );
    return;
  }

  if (
    correct === null
    || correct < 0
    || correct > total
  ) {
    setQuestionStatus(
      "Os acertos precisam estar entre 0 e o total de questões.",
      "error"
    );
    return;
  }

  if (
    durationMinutes !== null
    && durationMinutes < 0
  ) {
    setQuestionStatus(
      "O tempo não pode ser negativo.",
      "error"
    );
    return;
  }

  const wrong = total - correct;

  const payload = {
    user_id: questionsState.user.id,
    session_date:
      document.getElementById("question-date").value
      || localISODate(),
    platform:
      document.getElementById("question-platform").value.trim()
      || null,
    area:
      document.getElementById("question-area").value.trim()
      || null,
    materia:
      document.getElementById("question-materia").value.trim()
      || null,
    theme:
      document.getElementById("question-theme").value.trim()
      || null,
    total_questions: total,
    correct_answers: correct,
    wrong_answers: wrong,
    duration_seconds:
      durationMinutes === null
        ? null
        : durationMinutes * 60,
    notes:
      document.getElementById("question-notes").value.trim()
      || null
  };

  const button =
    document.getElementById("save-question-session");

  button.disabled = true;
  setQuestionStatus("Salvando...");

  const { error } = await questionsSb
    .from("question_sessions")
    .insert(payload);

  button.disabled = false;

  if (error) {
    console.error(error);

    setQuestionStatus(
      `Não foi possível registrar: ${error.message}`,
      "error"
    );

    return;
  }

  setQuestionStatus(
    "Sessão registrada.",
    "success"
  );

  const form = document.getElementById("question-form");
  form.reset();

  document.getElementById("question-date").value =
    localISODate();

  updateLiveResult();

  await loadQuestionSessions();
}

async function deleteQuestionSession(sessionId) {
  const session =
    questionsState.sessions.find(
      (item) => item.id === sessionId
    );

  if (!session) return;

  const confirmed = window.confirm(
    `Excluir o registro de ${session.total_questions} questões de ${formatDateBR(session.session_date)}?`
  );

  if (!confirmed) return;

  const { error } = await questionsSb
    .from("question_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) {
    console.error(error);

    setQuestionStatus(
      `Não foi possível excluir: ${error.message}`,
      "error"
    );

    return;
  }

  setQuestionStatus(
    "Registro excluído.",
    "success"
  );

  await loadQuestionSessions();
}

function wireQuestionForm() {
  document.getElementById("question-date").value =
    localISODate();

  ["question-total", "question-correct"].forEach((id) => {
    document
      .getElementById(id)
      .addEventListener("input", updateLiveResult);
  });

  document
    .getElementById("question-form")
    .addEventListener(
      "submit",
      saveQuestionSession
    );

  updateLiveResult();
}

async function initQuestions() {
  questionsState.user = window.docmapUser;

  wireQuestionForm();

  await Promise.all([
    loadQuestionSettings(),
    loadQuestionSessions()
  ]);
}

if (window.docmapUser) {
  initQuestions();
} else {
  window.addEventListener(
    "docmap:ready",
    initQuestions,
    { once: true }
  );
}
