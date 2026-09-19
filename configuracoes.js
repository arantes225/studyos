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

function settingsProfileCacheKey(userId) {
  return `docmap:profile:${userId}`;
}

function cacheProfile(userId, profile) {
  try {
    localStorage.setItem(
      settingsProfileCacheKey(userId),
      JSON.stringify(profile)
    );
  } catch {}
}


function profileTitle(gender) {
  if (gender === "male") return "Dr.";
  if (gender === "female") return "Dra.";
  return "";
}

function setProfileStatus(text, type = "") {
  const element = document.getElementById("profile-status");
  element.textContent = text;
  element.className = `profile-status ${type}`.trim();
}

function updateProfilePreview() {
  const name =
    document.getElementById("profile-name").value.trim()
    || "Seu nome";

  const gender =
    document.getElementById("profile-gender").value;

  const specialty =
    document.getElementById("profile-specialty").value.trim()
    || "Sua especialidade";

  const title = profileTitle(gender);

  document.getElementById("profile-preview-name").textContent =
    title ? `${title} ${name}` : name;

  document.getElementById("profile-preview-specialty").textContent =
    specialty;

  document.getElementById("profile-preview-avatar").textContent =
    name.charAt(0).toUpperCase() || "U";
}

async function loadProfileSettings() {
  const { data, error } = await settingsSb
    .from("profiles")
    .select("display_name, gender, specialty")
    .eq("user_id", settingsUser.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    setProfileStatus(
      `Não foi possível carregar o perfil: ${error.message}`,
      "error"
    );
    return;
  }

  document.getElementById("profile-name").value =
    data?.display_name || "";

  document.getElementById("profile-gender").value =
    data?.gender || "";

  document.getElementById("profile-specialty").value =
    data?.specialty || "";

  updateProfilePreview();
}

async function saveProfileSettings() {
  const name =
    document.getElementById("profile-name").value.trim();

  const gender =
    document.getElementById("profile-gender").value || null;

  const specialty =
    document.getElementById("profile-specialty").value.trim();

  if (!name) {
    setProfileStatus(
      "Informe o nome que deve aparecer no DocMap.",
      "error"
    );
    return;
  }

  const button = document.getElementById("save-profile");
  button.disabled = true;
  setProfileStatus("Salvando...");

  const { data, error } = await settingsSb
    .from("profiles")
    .upsert(
      {
        user_id: settingsUser.id,
        display_name: name,
        gender,
        specialty: specialty || null
      },
      {
        onConflict: "user_id"
      }
    )
    .select("display_name, gender, specialty")
    .single();

  button.disabled = false;

  if (error) {
    console.error(error);
    setProfileStatus(
      `Não foi possível salvar o perfil: ${error.message}`,
      "error"
    );
    return;
  }

  if (!data) {
    setProfileStatus(
      "O perfil não foi gravado. Atualize a página e tente novamente.",
      "error"
    );
    return;
  }

  cacheProfile(settingsUser.id, data);

  setProfileStatus(
    "Perfil salvo. Atualizando menu lateral...",
    "success"
  );

  updateProfilePreview();

  setTimeout(() => {
    window.location.reload();
  }, 450);
}

function wireProfileSettings() {
  [
    "profile-name",
    "profile-gender",
    "profile-specialty"
  ].forEach((id) => {
    const element = document.getElementById(id);

    element.addEventListener(
      id === "profile-gender" ? "change" : "input",
      updateProfilePreview
    );
  });

  document
    .getElementById("save-profile")
    .addEventListener(
      "click",
      saveProfileSettings
    );
}


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


function setFlashcardIntervalsStatus(text, type = "") {
  const element =
    document.getElementById("flashcard-intervals-status");

  if (!element) return;

  element.textContent = text;
  element.className =
    `settings-save-status ${type}`.trim();
}

function setIntervalInputs(field, values) {
  const safeValues =
    Array.isArray(values) && values.length
      ? values
      : [1, 1, 1];

  document
    .querySelectorAll(
      `[data-interval-field="${field}"]`
    )
    .forEach((input) => {
      const index =
        Number(input.dataset.intervalIndex);

      input.value =
        safeValues[
          Math.min(
            index,
            safeValues.length - 1
          )
        ] ?? 1;
    });
}

function readIntervalInputs(field) {
  const inputs =
    Array.from(
      document.querySelectorAll(
        `[data-interval-field="${field}"]`
      )
    ).sort(
      (a, b) =>
        Number(a.dataset.intervalIndex)
        - Number(b.dataset.intervalIndex)
    );

  const values =
    inputs.map(
      (input) =>
        Number(input.value)
    );

  if (
    values.some(
      (value) =>
        !Number.isInteger(value)
        || value < 1
        || value > 3650
    )
  ) {
    return null;
  }

  return values;
}

async function saveFlashcardIntervals() {
  const hard =
    readIntervalInputs(
      "flashcard_intervals_hard"
    );

  const medium =
    readIntervalInputs(
      "flashcard_intervals_medium"
    );

  const easy =
    readIntervalInputs(
      "flashcard_intervals_easy"
    );

  if (!hard || !medium || !easy) {
    setFlashcardIntervalsStatus(
      "Use apenas dias inteiros entre 1 e 3650.",
      "error"
    );

    return;
  }

  const button =
    document.getElementById(
      "save-flashcard-intervals"
    );

  button.disabled = true;

  setFlashcardIntervalsStatus(
    "Salvando..."
  );

  const {
    error
  } = await settingsSb
    .from("user_settings")
    .upsert(
      {
        user_id:
          settingsUser.id,

        flashcard_intervals_hard:
          hard,

        flashcard_intervals_medium:
          medium,

        flashcard_intervals_easy:
          easy
      },
      {
        onConflict:
          "user_id"
      }
    );

  button.disabled = false;

  if (error) {
    console.error(error);

    setFlashcardIntervalsStatus(
      `Não foi possível salvar: ${error.message}`,
      "error"
    );

    return;
  }

  setFlashcardIntervalsStatus(
    "Intervalos salvos.",
    "success"
  );
}


function setStudyModeStatus(text, type = "") {
  const element = document.getElementById("study-mode-status");
  if (!element) return;
  element.textContent = text;
  element.className = `settings-save-status ${type}`.trim();
}

async function loadStudyModeSetting() {
  const { data, error } = await settingsSb
    .from("user_settings")
    .select("study_mode")
    .eq("user_id", settingsUser.id)
    .maybeSingle();

  if (error) console.warn(error);

  const mode = data?.study_mode === "dentistry" ? "dentistry" : "medicine";
  const radio = document.querySelector(`input[name="study-mode"][value="${mode}"]`);
  if (radio) radio.checked = true;
  window.ResibulandoStudyMode?.apply(mode);
}

async function saveStudyModeSetting() {
  const mode = document.querySelector('input[name="study-mode"]:checked')?.value || "medicine";
  const button = document.getElementById("save-study-mode");
  if (button) button.disabled = true;
  setStudyModeStatus("Salvando...");

  const { error } = await settingsSb
    .from("user_settings")
    .upsert({ user_id: settingsUser.id, study_mode: mode }, { onConflict: "user_id" });

  if (button) button.disabled = false;

  if (error) {
    console.error(error);
    setStudyModeStatus(`Não foi possível salvar: ${error.message}`, "error");
    return;
  }

  window.ResibulandoStudyMode?.apply(mode);
  setStudyModeStatus(mode === "dentistry" ? "Modo Odontologia salvo." : "Modo Medicina salvo.", "success");
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
      max_lessons_per_day,
      max_subject_reviews_per_day,
      flashcard_intervals_hard,
      flashcard_intervals_medium,
      flashcard_intervals_easy,
      error_review_interval_days,
      subject_review_intervals,
      pomodoro_focus_minutes,
      pomodoro_break_minutes
    `)
    .eq("user_id", settingsUser.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    setStudyDaysStatus(
      `Não foi possível carregar as configurações: ${error.message}`,
      "error"
    );
    return;
  }

  const settings = data || {};

  SETTINGS_FIELDS.forEach((field) => {
    setSelectedDays(field, settings[field]);
  });

  document.getElementById("max-lessons-per-day").value =
    settings.max_lessons_per_day ?? 1;

  document.getElementById("max-subject-reviews").value =
    settings.max_subject_reviews_per_day ?? 3;

  setIntervalInputs(
    "flashcard_intervals_hard",
    settings.flashcard_intervals_hard || [1,3,7]
  );

  setIntervalInputs(
    "flashcard_intervals_medium",
    settings.flashcard_intervals_medium || [7,21,45]
  );

  setIntervalInputs(
    "flashcard_intervals_easy",
    settings.flashcard_intervals_easy || [15,45,70]
  );


  const errorReviewInterval =
    document.getElementById(
      "error-review-interval"
    );

  if (errorReviewInterval) {
    errorReviewInterval.value =
      settings.error_review_interval_days
      ?? 21;
  }

  setIntervalInputs(
    "subject_review_intervals",
    settings.subject_review_intervals
      || [7,14,30]
  );

  const pomodoroFocus =
    document.getElementById(
      "pomodoro-focus-minutes"
    );

  const pomodoroBreak =
    document.getElementById(
      "pomodoro-break-minutes"
    );

  if (pomodoroFocus) {
    pomodoroFocus.value =
      settings.pomodoro_focus_minutes
      ?? 25;
  }

  if (pomodoroBreak) {
    pomodoroBreak.value =
      settings.pomodoro_break_minutes
      ?? 5;
  }
}


function setPomodoroSettingsStatus(
  text,
  type = ""
) {
  const element =
    document.getElementById(
      "pomodoro-settings-status"
    );

  if (!element) return;

  element.textContent =
    text;

  element.className =
    `settings-save-status ${type}`
      .trim();
}


async function savePomodoroSettings() {
  const focus =
    Number(
      document
        .getElementById(
          "pomodoro-focus-minutes"
        )
        ?.value
    );

  const pause =
    Number(
      document
        .getElementById(
          "pomodoro-break-minutes"
        )
        ?.value
    );


  if (
    !Number.isInteger(focus)
    || focus < 1
    || focus > 240
    || !Number.isInteger(pause)
    || pause < 1
    || pause > 120
  ) {
    setPomodoroSettingsStatus(
      "Use foco entre 1 e 240 min e pausa entre 1 e 120 min.",
      "error"
    );

    return;
  }


  const button =
    document.getElementById(
      "save-pomodoro-settings"
    );

  if (button) {
    button.disabled =
      true;
  }


  setPomodoroSettingsStatus(
    "Salvando..."
  );


  const {
    error
  } =
    await settingsSb
      .from(
        "user_settings"
      )
      .upsert(
        {
          user_id:
            settingsUser.id,

          pomodoro_focus_minutes:
            focus,

          pomodoro_break_minutes:
            pause
        },
        {
          onConflict:
            "user_id"
        }
      );


  if (button) {
    button.disabled =
      false;
  }


  if (error) {
    console.error(
      error
    );

    setPomodoroSettingsStatus(
      `Não foi possível salvar: ${error.message}`,
      "error"
    );

    return;
  }


  setPomodoroSettingsStatus(
    "Pomodoro salvo.",
    "success"
  );
}



function setErrorReviewSettingsStatus(
  text,
  type = ""
) {
  const element =
    document.getElementById(
      "error-review-settings-status"
    );

  if (!element) return;

  element.textContent =
    text;

  element.className =
    `settings-save-status ${type}`
      .trim();
}


async function saveErrorReviewSettings() {
  const interval =
    Number(
      document
        .getElementById(
          "error-review-interval"
        )
        ?.value
    );


  if (
    !Number.isInteger(
      interval
    )
    || interval < 1
    || interval > 3650
  ) {
    setErrorReviewSettingsStatus(
      "Use um intervalo entre 1 e 3650 dias.",
      "error"
    );

    return;
  }


  const button =
    document.getElementById(
      "save-error-review-settings"
    );


  if (button) {
    button.disabled =
      true;
  }


  setErrorReviewSettingsStatus(
    "Salvando..."
  );


  const {
    error
  } =
    await settingsSb
      .from(
        "user_settings"
      )
      .upsert(
        {
          user_id:
            settingsUser.id,

          error_review_interval_days:
            interval
        },
        {
          onConflict:
            "user_id"
        }
      );


  if (button) {
    button.disabled =
      false;
  }


  if (error) {
    console.error(
      error
    );

    setErrorReviewSettingsStatus(
      `Não foi possível salvar: ${error.message}`,
      "error"
    );

    return;
  }


  setErrorReviewSettingsStatus(
    "Intervalo salvo.",
    "success"
  );
}


function setSubjectReviewSettingsStatus(
  text,
  type = ""
) {
  const element =
    document.getElementById(
      "subject-review-settings-status"
    );

  if (!element) return;

  element.textContent =
    text;

  element.className =
    `settings-save-status ${type}`
      .trim();
}


async function saveSubjectReviewSettings() {
  const intervals =
    readIntervalInputs(
      "subject_review_intervals"
    );


  if (
    !intervals
    || intervals.length !== 3
  ) {
    setSubjectReviewSettingsStatus(
      "Use três intervalos inteiros entre 1 e 3650 dias.",
      "error"
    );

    return;
  }


  if (
    !(
      intervals[0]
      < intervals[1]
      && intervals[1]
      < intervals[2]
    )
  ) {
    setSubjectReviewSettingsStatus(
      "Os intervalos devem crescer: 1ª < 2ª < 3ª revisão.",
      "error"
    );

    return;
  }


  const button =
    document.getElementById(
      "save-subject-review-settings"
    );


  if (button) {
    button.disabled =
      true;
  }


  setSubjectReviewSettingsStatus(
    "Salvando..."
  );


  const {
    error
  } =
    await settingsSb
      .from(
        "user_settings"
      )
      .upsert(
        {
          user_id:
            settingsUser.id,

          subject_review_intervals:
            intervals
        },
        {
          onConflict:
            "user_id"
        }
      );


  if (button) {
    button.disabled =
      false;
  }


  if (error) {
    console.error(
      error
    );

    setSubjectReviewSettingsStatus(
      `Não foi possível salvar: ${error.message}`,
      "error"
    );

    return;
  }


  setSubjectReviewSettingsStatus(
    "Revisões teóricas salvas.",
    "success"
  );
}


function setPasswordStatus(
  text,
  type = ""
) {
  const element =
    document.getElementById(
      "password-status"
    );

  if (!element) return;

  element.textContent =
    text;

  element.className =
    `settings-save-status ${type}`
      .trim();
}


function loadAccountSecurity() {
  const email =
    document.getElementById(
      "account-email"
    );

  if (email) {
    email.textContent =
      settingsUser?.email
      || "E-mail não disponível";
  }
}


async function savePassword() {
  const currentPassword =
    document
      .getElementById(
        "current-password"
      )
      ?.value
    || "";


  const password =
    document
      .getElementById(
        "new-password"
      )
      ?.value
    || "";


  const confirm =
    document
      .getElementById(
        "confirm-password"
      )
      ?.value
    || "";


  const email =
    settingsUser?.email
    || "";


  if (
    !currentPassword
  ) {
    setPasswordStatus(
      "Digite sua senha atual.",
      "error"
    );

    return;
  }


  if (
    password.length < 8
  ) {
    setPasswordStatus(
      "A nova senha deve ter pelo menos 8 caracteres.",
      "error"
    );

    return;
  }


  if (
    password !== confirm
  ) {
    setPasswordStatus(
      "As novas senhas não coincidem.",
      "error"
    );

    return;
  }


  if (
    currentPassword === password
  ) {
    setPasswordStatus(
      "A nova senha deve ser diferente da senha atual.",
      "error"
    );

    return;
  }


  if (!email) {
    setPasswordStatus(
      "Não foi possível identificar o e-mail da conta.",
      "error"
    );

    return;
  }


  const button =
    document.getElementById(
      "save-password"
    );


  if (button) {
    button.disabled =
      true;
  }


  setPasswordStatus(
    "Confirmando senha atual..."
  );


  /*
    O Supabase não exige a senha atual diretamente no updateUser.
    Para o DocMap exigir essa confirmação, fazemos uma nova
    autenticação com o e-mail da sessão + senha atual antes de
    permitir a troca.
  */

  const {
    data:
      reauthData,

    error:
      reauthError
  } =
    await settingsSb.auth
      .signInWithPassword({
        email,
        password:
          currentPassword
      });


  if (reauthError) {
    if (button) {
      button.disabled =
        false;
    }


    console.error(
      reauthError
    );


    setPasswordStatus(
      "Senha atual incorreta.",
      "error"
    );

    return;
  }


  if (
    reauthData?.user?.id
    !== settingsUser.id
  ) {
    if (button) {
      button.disabled =
        false;
    }


    setPasswordStatus(
      "Não foi possível confirmar esta conta.",
      "error"
    );

    return;
  }


  setPasswordStatus(
    "Alterando senha..."
  );


  const {
    error
  } =
    await settingsSb.auth
      .updateUser({
        password
      });


  if (button) {
    button.disabled =
      false;
  }


  if (error) {
    console.error(
      error
    );

    setPasswordStatus(
      `Não foi possível alterar a senha: ${error.message}`,
      "error"
    );

    return;
  }


  [
    "current-password",
    "new-password",
    "confirm-password"
  ].forEach(
    (id) => {
      const element =
        document.getElementById(
          id
        );


      if (element) {
        element.value =
          "";
      }
    }
  );


  setPasswordStatus(
    "Senha alterada com sucesso.",
    "success"
  );
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

  const maxLessons =
    Number(
      document
        .getElementById(
          "max-lessons-per-day"
        )
        .value
    );


  if (
    !Number.isInteger(maxLessons)
    || maxLessons < 1
    || maxLessons > 50
  ) {
    setStudyDaysStatus(
      "O máximo de aulas por dia deve ser um número entre 1 e 50.",
      "error"
    );

    return;
  }


  payload.max_lessons_per_day =
    maxLessons;


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
    .upsert(
      {
        user_id: settingsUser.id,
        ...payload
      },
      {
        onConflict: "user_id"
      }
    );

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
  wireProfileSettings();

  document
    .getElementById("save-study-days")
    .addEventListener("click", saveStudySettings);

  document
    .getElementById("save-study-mode")
    ?.addEventListener("click", saveStudyModeSetting);

  document
    .getElementById("save-flashcard-intervals")
    ?.addEventListener(
      "click",
      saveFlashcardIntervals
    );

  document
    .getElementById("save-pomodoro-settings")
    ?.addEventListener(
      "click",
      savePomodoroSettings
    );

  document
    .getElementById(
      "save-error-review-settings"
    )
    ?.addEventListener(
      "click",
      saveErrorReviewSettings
    );

  document
    .getElementById(
      "save-subject-review-settings"
    )
    ?.addEventListener(
      "click",
      saveSubjectReviewSettings
    );

  document
    .getElementById(
      "save-password"
    )
    ?.addEventListener(
      "click",
      savePassword
    );

  loadAccountSecurity();

  await Promise.all([
    loadProfileSettings(),
    loadStudySettings(),
    loadStudyModeSetting()
  ]);
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
