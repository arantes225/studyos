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


const PROFILE_GENDER_OPTIONS = [
  { value: "", label: "Selecione" },
  { value: "male", label: "Masculino" },
  { value: "female", label: "Feminino" },
  { value: "other", label: "Outro" },
  { value: "prefer_not_to_say", label: "Prefiro não informar" }
];

function profileSpecialtyOptions() {
  return Array.from(
    document.querySelectorAll(
      "#specialty-options option"
    )
  )
    .map((option) => option.value)
    .filter(Boolean);
}

function closeProfilePickers(except = null) {
  [
    ["profile-gender-menu", "profile-gender-toggle"],
    ["profile-specialty-menu", "profile-specialty-toggle"]
  ].forEach(([menuId, toggleId]) => {
    if (except === menuId) return;
    const menu = document.getElementById(menuId);
    const toggle = document.getElementById(toggleId);
    if (menu) menu.hidden = true;
    toggle?.setAttribute("aria-expanded", "false");
  });
}

function syncProfilePickerLabels() {
  const gender = document.getElementById("profile-gender")?.value || "";
  const genderLabel = document.getElementById("profile-gender-label");
  if (genderLabel) {
    genderLabel.textContent =
      PROFILE_GENDER_OPTIONS.find((item) => item.value === gender)?.label
      || "Selecione";
  }

  const specialty = document.getElementById("profile-specialty")?.value || "";
  const specialtyLabel = document.getElementById("profile-specialty-label");
  if (specialtyLabel) {
    specialtyLabel.textContent = specialty || "Selecione";
  }
}

function buildProfilePicker(menuId, toggleId, options, onSelect) {
  const menu = document.getElementById(menuId);
  const toggle = document.getElementById(toggleId);
  if (!menu || !toggle) return;

  menu.innerHTML = "";

  options.forEach((item) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "profile-picker-option";
    option.textContent = item.label;
    option.dataset.value = item.value;

    option.addEventListener("click", (event) => {
      event.stopPropagation();
      onSelect(item.value);
      menu.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      syncProfilePickerLabels();
      updateProfilePreview();
    });

    menu.appendChild(option);
  });

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = menu.hidden;
    closeProfilePickers(open ? menuId : null);
    menu.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
}

function wireProfilePickers() {
  buildProfilePicker(
    "profile-gender-menu",
    "profile-gender-toggle",
    PROFILE_GENDER_OPTIONS,
    (value) => {
      const input = document.getElementById("profile-gender");
      if (input) input.value = value;
    }
  );

  buildProfilePicker(
    "profile-specialty-menu",
    "profile-specialty-toggle",
    profileSpecialtyOptions().map((value) => ({ value, label: value })),
    (value) => {
      const input = document.getElementById("profile-specialty");
      if (input) input.value = value;
    }
  );

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".profile-picker")) {
      closeProfilePickers();
    }
  });

  syncProfilePickerLabels();
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

  syncProfilePickerLabels();
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
  wireProfilePickers();

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
      error_review_intervals,
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


  setIntervalInputs(
    "error_review_intervals",
    settings.error_review_intervals
      || [7,21,21,21,21,21]
  );

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
  const intervals =
    readIntervalInputs(
      "error_review_intervals"
    );

  if (
    !intervals
    || intervals.length !== 6
  ) {
    setErrorReviewSettingsStatus(
      "Preencha os 6 intervalos com dias inteiros entre 1 e 3650.",
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

          error_review_intervals:
            intervals,

          /*
            Mantido por compatibilidade com versões antigas.
            O novo agendamento usa error_review_intervals.
          */
          error_review_interval_days:
            intervals[
              intervals.length - 1
            ]
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
    `Sequência salva: ${intervals.join(" + ")} dias.`,
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


function setPasskeyStatus(text, type = "") {
  const element = document.getElementById("passkey-status");
  if (!element) return;
  element.textContent = text;
  element.className = `settings-save-status ${type}`.trim();
}

function passkeySupported() {
  return Boolean(
    window.PublicKeyCredential
    && settingsSb?.auth?.registerPasskey
    && settingsSb?.auth?.passkey
  );
}

async function loadPasskeys() {
  const list = document.getElementById("passkey-list");
  const button = document.getElementById("register-passkey");
  if (!list || !button) return;

  if (!passkeySupported()) {
    button.disabled = true;
    list.textContent = "Passkeys não são compatíveis com este navegador/dispositivo.";
    return;
  }

  const { data, error } = await settingsSb.auth.passkey.list();

  if (error) {
    const message = String(error.message || error);
    if (message.toLowerCase().includes("passkey_disabled")) {
      list.textContent = "O servidor ainda não está aceitando Passkeys.";
    } else {
      list.textContent = "Não foi possível carregar as Passkeys cadastradas.";
    }
    return;
  }

  const passkeys = Array.isArray(data) ? data : [];
  if (!passkeys.length) {
    list.textContent = "Nenhuma Passkey cadastrada nesta conta.";
    return;
  }

  list.innerHTML = "";
  passkeys.forEach((passkey) => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "space-between";
    row.style.gap = "10px";
    row.style.padding = "8px 0";
    row.style.borderBottom = "1px solid var(--border)";

    const label = document.createElement("span");
    label.textContent = passkey.friendly_name || "Passkey cadastrada";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "button secondary";
    remove.textContent = "Remover";
    remove.addEventListener("click", async () => {
      remove.disabled = true;
      setPasskeyStatus("Removendo Passkey...");
      const { error: deleteError } = await settingsSb.auth.passkey.delete({
        passkeyId: passkey.id
      });

      if (deleteError) {
        remove.disabled = false;
        setPasskeyStatus(
          `Não foi possível remover: ${deleteError.message}`,
          "error"
        );
        return;
      }

      setPasskeyStatus("Passkey removida.", "success");
      await loadPasskeys();
    });

    row.append(label, remove);
    list.appendChild(row);
  });
}

async function registerPasskey() {
  const button = document.getElementById("register-passkey");
  if (!button) return;

  if (!passkeySupported()) {
    setPasskeyStatus(
      "Este navegador ou dispositivo não oferece suporte a Passkeys.",
      "error"
    );
    return;
  }

  button.disabled = true;
  setPasskeyStatus("Confirme sua identidade no dispositivo...");

  try {
    const { data, error } = await settingsSb.auth.registerPasskey();

    if (error) {
      const message = String(error.message || error);
      setPasskeyStatus(
        message.toLowerCase().includes("passkey_disabled")
          ? "Passkeys ainda não estão habilitadas no servidor."
          : message,
        "error"
      );
      return;
    }

    setPasskeyStatus(
      `Passkey ativada${data?.friendly_name ? `: ${data.friendly_name}` : ""}.`,
      "success"
    );
    await loadPasskeys();
  } catch (error) {
    setPasskeyStatus(
      String(error?.name || "") === "NotAllowedError"
        ? "Cadastro cancelado ou não autorizado no dispositivo."
        : "Não foi possível cadastrar a Passkey.",
      "error"
    );
  } finally {
    button.disabled = false;
  }
}

function wirePasskeySettings() {
  const button = document.getElementById("register-passkey");
  if (!button) return;

  if (!passkeySupported()) {
    button.disabled = true;
    return;
  }

  button.addEventListener("click", registerPasskey);
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



function setTargetExamsStatus(text, type = "") {
  const el = document.getElementById("target-exams-status");
  if (!el) return;
  el.textContent = text;
  el.className = `settings-save-status ${type}`.trim();
}

function selectedTargetExams() {
  return Array.from(
    document.querySelectorAll('#target-exam-grid input[type="checkbox"]:checked')
  ).map((input) => input.value);
}

function updateTargetExamCount() {
  const count = document.getElementById("target-exam-count");
  if (count) count.textContent = `${selectedTargetExams().length}/3`;
}

function renderTargetExamOptions() {
  const grid = document.getElementById("target-exam-grid");
  const exams = window.LuriaExamPriority?.exams || [];
  if (!grid) return;

  grid.innerHTML = exams.map((exam) => `
    <label class="target-exam-option">
      <input type="checkbox" value="${exam}">
      <span>${exam}</span>
    </label>
  `).join("");

  grid.addEventListener("change", (event) => {
    const input = event.target.closest('input[type="checkbox"]');
    if (!input) return;

    const selected = selectedTargetExams();
    if (selected.length > 3) {
      input.checked = false;
      setTargetExamsStatus("Você pode escolher no máximo 3 provas.", "error");
    } else {
      setTargetExamsStatus("");
    }
    updateTargetExamCount();
  });

  updateTargetExamCount();
}

async function loadTargetExams() {
  const grid = document.getElementById("target-exam-grid");
  if (!grid || !settingsUser) return;

  const { data, error } = await settingsSb
    .from("user_settings")
    .select("target_exams")
    .eq("user_id", settingsUser.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    setTargetExamsStatus(`Não foi possível carregar: ${error.message}`, "error");
    return;
  }

  const selected = window.LuriaExamPriority?.sanitizeExams(data?.target_exams || []) || [];
  grid.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.checked = selected.includes(input.value);
  });
  updateTargetExamCount();
}

async function saveTargetExams() {
  if (!settingsUser) return;

  const targetExams = window.LuriaExamPriority?.sanitizeExams(selectedTargetExams()) || [];
  if (targetExams.length > 3) {
    setTargetExamsStatus("Você pode escolher no máximo 3 provas.", "error");
    return;
  }

  const button = document.getElementById("save-target-exams");
  if (button) button.disabled = true;
  setTargetExamsStatus("Salvando...");

  const { error } = await settingsSb
    .from("user_settings")
    .upsert(
      { user_id: settingsUser.id, target_exams: targetExams },
      { onConflict: "user_id" }
    );

  if (button) button.disabled = false;

  if (error) {
    console.error(error);
    setTargetExamsStatus(`Não foi possível salvar: ${error.message}`, "error");
    return;
  }

  setTargetExamsStatus(
    targetExams.length
      ? `${targetExams.length} prova${targetExams.length === 1 ? "" : "s"} salva${targetExams.length === 1 ? "" : "s"}. O Cronograma Base usará essa prioridade.`
      : "Seleção limpa. O Cronograma Base volta à ordem padrão.",
    "success"
  );
}

const STUDY_DEFAULTS = Object.freeze({
  pomodoro: { focus: 25, pause: 5 },
  flashcards: {
    hard: [1, 3, 7],
    medium: [7, 21, 45],
    easy: [15, 45, 70]
  },
  errorReviews: [7, 21, 21, 21, 21, 21],
  subjectReviews: [7, 14, 30]
});

function restorePomodoroDefaults() {
  document.getElementById("pomodoro-focus-minutes").value = STUDY_DEFAULTS.pomodoro.focus;
  document.getElementById("pomodoro-break-minutes").value = STUDY_DEFAULTS.pomodoro.pause;
  setPomodoroSettingsStatus("Padrão restaurado. Clique em Salvar Pomodoro para confirmar.", "success");
}

function restoreFlashcardDefaults() {
  setIntervalInputs("flashcard_intervals_hard", STUDY_DEFAULTS.flashcards.hard);
  setIntervalInputs("flashcard_intervals_medium", STUDY_DEFAULTS.flashcards.medium);
  setIntervalInputs("flashcard_intervals_easy", STUDY_DEFAULTS.flashcards.easy);
  setFlashcardIntervalsStatus("Padrão restaurado. Clique em Salvar intervalos para confirmar.", "success");
}

function restoreErrorReviewDefaults() {
  setIntervalInputs("error_review_intervals", STUDY_DEFAULTS.errorReviews);
  setErrorReviewSettingsStatus("Padrão restaurado. Clique em Salvar Caderno de Erros para confirmar.", "success");
}

function restoreSubjectReviewDefaults() {
  setIntervalInputs("subject_review_intervals", STUDY_DEFAULTS.subjectReviews);
  setSubjectReviewSettingsStatus("Padrão restaurado. Clique em Salvar revisões teóricas para confirmar.", "success");
}

async function initStudySettings() {
  settingsUser = window.docmapUser;

  renderWeekdayGroups();
  renderTargetExamOptions();
  wireProfileSettings();

  document
    .getElementById("save-study-days")
    .addEventListener("click", saveStudySettings);

  document.getElementById("restore-pomodoro-settings")
    ?.addEventListener("click", restorePomodoroDefaults);
  document.getElementById("restore-flashcard-intervals")
    ?.addEventListener("click", restoreFlashcardDefaults);
  document.getElementById("restore-error-review-settings")
    ?.addEventListener("click", restoreErrorReviewDefaults);
  document.getElementById("restore-subject-review-settings")
    ?.addEventListener("click", restoreSubjectReviewDefaults);

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
  wirePasskeySettings();

  await Promise.all([
    loadProfileSettings(),
    loadStudySettings(),
    loadTargetExams(),
    loadPasskeys()
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
