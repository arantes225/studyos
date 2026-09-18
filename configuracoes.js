const settingsSb = window.supabaseClient;

const WEEKDAYS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 7, label: "Dom" }
];

const SETTINGS_FIELDS = [
  "flashcard_weekdays",
  "theory_study_weekdays",
  "theory_review_weekdays",
  "error_weekdays",
  "question_weekdays"
];

let settingsUser = null;

function renderWeekdayGroups() {
  document.querySelectorAll("[data-weekday-group]").forEach((container) => {
    const field = container.dataset.weekdayGroup;

    container.innerHTML = WEEKDAYS.map((day) => `
      <label class="weekday-option">
        <input
          type="checkbox"
          value="${day.value}"
          data-weekday-field="${field}"
        >
        <span>${day.label}</span>
      </label>
    `).join("");
  });
}

function getSelectedDays(field) {
  return Array.from(
    document.querySelectorAll(
      `[data-weekday-field="${field}"]:checked`
    )
  )
    .map((input) => Number(input.value))
    .sort((a, b) => a - b);
}

function setSelectedDays(field, days) {
  const selected = new Set(
    Array.isArray(days) && days.length
      ? days.map(Number)
      : [1,2,3,4,5,6,7]
  );

  document.querySelectorAll(
    `[data-weekday-field="${field}"]`
  ).forEach((input) => {
    input.checked = selected.has(Number(input.value));
  });
}

function setStudyDaysStatus(text, type = "") {
  const el = document.getElementById("study-days-status");
  el.textContent = text;
  el.className = `settings-save-status ${type}`.trim();
}

async function loadStudySettings() {
  const { data, error } = await settingsSb
    .from("user_settings")
    .select(`
      flashcard_weekdays,
      theory_study_weekdays,
      theory_review_weekdays,
      error_weekdays,
      question_weekdays,
      max_subject_reviews_per_day
    `)
    .eq("user_id", settingsUser.id)
    .single();

  if (error) {
    console.error(error);
    setStudyDaysStatus(
      `Não foi possível carregar as configurações: ${error.message}`,
      "error"
    );
    return;
  }

  SETTINGS_FIELDS.forEach((field) => {
    setSelectedDays(field, data[field]);
  });

  document.getElementById("max-subject-reviews").value =
    data.max_subject_reviews_per_day ?? 3;
}

async function saveStudySettings() {
  const payload = {};

  for (const field of SETTINGS_FIELDS) {
    const days = getSelectedDays(field);

    if (!days.length) {
      setStudyDaysStatus(
        "Cada categoria precisa ter pelo menos um dia selecionado.",
        "error"
      );
      return;
    }

    payload[field] = days;
  }

  const maxReviews =
    Number(document.getElementById("max-subject-reviews").value);

  if (
    !Number.isInteger(maxReviews)
    || maxReviews < 1
    || maxReviews > 50
  ) {
    setStudyDaysStatus(
      "O limite diário deve ser um número entre 1 e 50.",
      "error"
    );
    return;
  }

  payload.max_subject_reviews_per_day = maxReviews;

  const button = document.getElementById("save-study-days");
  button.disabled = true;

  setStudyDaysStatus("Salvando...");

  const { error } = await settingsSb
    .from("user_settings")
    .update(payload)
    .eq("user_id", settingsUser.id);

  button.disabled = false;

  if (error) {
    console.error(error);
    setStudyDaysStatus(
      `Não foi possível salvar: ${error.message}`,
      "error"
    );
    return;
  }

  setStudyDaysStatus(
    "Dias de estudo salvos.",
    "success"
  );
}

async function initStudySettings() {
  settingsUser = window.docmapUser;

  renderWeekdayGroups();

  document
    .getElementById("save-study-days")
    .addEventListener("click", saveStudySettings);

  await loadStudySettings();
}

if (window.docmapUser) {
  initStudySettings();
} else {
  window.addEventListener(
    "docmap:ready",
    initStudySettings,
    { once: true }
  );
}
