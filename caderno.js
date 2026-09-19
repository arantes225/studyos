const notebookSb =
  window.supabaseClient;


const NOTE_FIELDS = [
  "disease",
  "epidemiology",
  "clinical_picture",
  "diagnosis",
  "treatment",
  "prophylaxis",
  "observations"
];


const notebookState = {
  user:
    null,

  topics:
    [],

  notesByTopic:
    new Map(),

  selectedTopicId:
    null,

  search:
    "",

  status:
    "all",

  dirty:
    false,

  saving:
    false,

  saveTimer:
    null,

  loadToken:
    0
};


function escapeNotebookHtml(
  value
) {
  return String(
    value
    ?? ""
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


function parseNotebookDate(
  value
) {
  if (!value) {
    return null;
  }

  const [
    year,
    month,
    day
  ] =
    String(value)
      .slice(
        0,
        10
      )
      .split("-")
      .map(Number);

  if (
    !year
    || !month
    || !day
  ) {
    return null;
  }

  return new Date(
    year,
    month - 1,
    day
  );
}


function formatNotebookDate(
  value
) {
  const date =
    parseNotebookDate(
      value
    );

  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric"
    }
  ).format(
    date
  );
}


function normalizeNotebookText(
  value
) {
  return String(
    value
    ?? ""
  )
    .normalize(
      "NFD"
    )
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim();
}


function currentTopic() {
  return notebookState.topics
    .find(
      (topic) =>
        topic.id
        === notebookState
          .selectedTopicId
    )
    || null;
}


function currentNote() {
  if (
    !notebookState
      .selectedTopicId
  ) {
    return null;
  }

  return notebookState
    .notesByTopic
    .get(
      notebookState
        .selectedTopicId
    )
    || null;
}


function noteHasContent(
  note
) {
  if (!note) {
    return false;
  }

  return NOTE_FIELDS.some(
    (field) =>
      Boolean(
        String(
          note[
            field
          ]
          ?? ""
        ).trim()
      )
  );
}


function setNotebookSaveStatus(
  text,
  type = ""
) {
  const element =
    document.getElementById(
      "notebook-save-status"
    );

  if (!element) {
    return;
  }

  element.textContent =
    text;

  element.className =
    `notebook-save-status ${type}`
      .trim();
}


function setNotebookEditorEnabled(
  enabled
) {
  document
    .querySelectorAll(
      "[data-note-field]"
    )
    .forEach(
      (textarea) => {
        textarea.disabled =
          !enabled;
      }
    );

  const saveButton =
    document.getElementById(
      "notebook-save"
    );

  if (saveButton) {
    saveButton.disabled =
      !enabled
      || notebookState.saving;
  }
}


function filteredTopics() {
  const search =
    normalizeNotebookText(
      notebookState.search
    );

  return notebookState.topics
    .filter(
      (topic) => {
        const completed =
          Boolean(
            topic.completed_at
          );

        if (
          notebookState.status
          === "completed"
          && !completed
        ) {
          return false;
        }

        if (
          notebookState.status
          === "pending"
          && completed
        ) {
          return false;
        }

        if (
          notebookState.status
          === "with-notes"
          && !noteHasContent(
            notebookState
              .notesByTopic
              .get(
                topic.id
              )
          )
        ) {
          return false;
        }

        if (!search) {
          return true;
        }

        const haystack =
          normalizeNotebookText(
            [
              topic.theme,
              topic.area,
              topic.materia
            ]
              .filter(
                Boolean
              )
              .join(" ")
          );

        return haystack.includes(
          search
        );
      }
    );
}


function topicSortValue(
  topic
) {
  if (
    topic.scheduled_date
  ) {
    return topic.scheduled_date;
  }

  return "9999-12-31";
}


function renderNotebookCount() {
  const count =
    Array.from(
      notebookState
        .notesByTopic
        .values()
    )
      .filter(
        noteHasContent
      )
      .length;

  const element =
    document.getElementById(
      "notebook-note-count"
    );

  if (element) {
    element.textContent =
      count;
  }
}


function renderTopicList() {
  const container =
    document.getElementById(
      "notebook-topic-list"
    );

  if (!container) {
    return;
  }


  const topics =
    filteredTopics();


  if (!topics.length) {
    container.innerHTML = `
      <div class="notebook-list-empty">
        Nenhum tema encontrado com esses filtros.
      </div>
    `;

    return;
  }


  container.innerHTML =
    topics
      .map(
        (topic) => {
          const completed =
            Boolean(
              topic.completed_at
            );

          const note =
            notebookState
              .notesByTopic
              .get(
                topic.id
              );

          const metadata =
            [
              topic.area,
              topic.materia
            ]
              .filter(
                Boolean
              )
              .join(
                " · "
              )
            || "Sem área";


          return `
            <button
              class="notebook-topic ${
                topic.id
                === notebookState
                  .selectedTopicId
                  ? "active"
                  : ""
              }"
              type="button"
              data-notebook-topic="${escapeNotebookHtml(
                topic.id
              )}"
            >

              <span class="notebook-topic-copy">

                <strong>
                  ${escapeNotebookHtml(
                    topic.theme
                  )}
                </strong>

                <small>
                  ${escapeNotebookHtml(
                    metadata
                  )}
                </small>

              </span>


              <span class="notebook-topic-side">

                <span
                  class="notebook-topic-state ${
                    completed
                      ? "completed"
                      : ""
                  }"
                >
                  ${
                    completed
                      ? "Feita"
                      : topic.status
                        === "deck"
                        ? "Deck"
                        : "Pendente"
                  }
                </span>

                <span
                  class="notebook-topic-note-dot ${
                    noteHasContent(
                      note
                    )
                      ? "visible"
                      : ""
                  }"
                  title="${
                    noteHasContent(
                      note
                    )
                      ? "Possui anotações"
                      : ""
                  }"
                ></span>

              </span>

            </button>
          `;
        }
      )
      .join("");


  container
    .querySelectorAll(
      "[data-notebook-topic]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            selectNotebookTopic(
              button.dataset
                .notebookTopic
            );
          }
        );
      }
    );
}


function clearEditorFields() {
  document
    .querySelectorAll(
      "[data-note-field]"
    )
    .forEach(
      (textarea) => {
        textarea.value =
          "";
      }
    );
}


function fillEditorFields(
  note
) {
  NOTE_FIELDS.forEach(
    (field) => {
      const textarea =
        document.querySelector(
          `[data-note-field="${field}"]`
        );

      if (textarea) {
        textarea.value =
          note?.[
            field
          ]
          || "";
      }
    }
  );
}


function renderSelectedTopic() {
  const topic =
    currentTopic();

  const empty =
    document.getElementById(
      "notebook-empty"
    );

  const content =
    document.getElementById(
      "notebook-content"
    );


  if (!topic) {
    if (empty) {
      empty.hidden =
        false;
    }

    if (content) {
      content.hidden =
        true;
    }

    return;
  }


  if (empty) {
    empty.hidden =
      true;
  }

  if (content) {
    content.hidden =
      false;
  }


  const title =
    document.getElementById(
      "notebook-topic-title"
    );

  const area =
    document.getElementById(
      "notebook-area"
    );

  const materia =
    document.getElementById(
      "notebook-materia"
    );

  const state =
    document.getElementById(
      "notebook-topic-state"
    );

  const date =
    document.getElementById(
      "notebook-topic-date"
    );


  if (title) {
    title.textContent =
      topic.theme;
  }


  if (area) {
    area.textContent =
      topic.area
      || "Sem área";
  }


  if (materia) {
    materia.hidden =
      !topic.materia;

    materia.textContent =
      topic.materia
      || "";
  }


  if (state) {
    const completed =
      Boolean(
        topic.completed_at
      );

    state.textContent =
      completed
        ? "Feita"
        : topic.status
          === "deck"
          ? "Deck"
          : "Não feita";

    state.className =
      `notebook-chip subtle ${
        completed
          ? "completed"
          : ""
      }`.trim();
  }


  if (date) {
    date.textContent =
      topic.scheduled_date
        ? `Aula programada para ${formatNotebookDate(
            topic.scheduled_date
          )}`
        : "Tema sem data programada";
  }


  fillEditorFields(
    currentNote()
  );


  notebookState.dirty =
    false;

  setNotebookSaveStatus(
    currentNote()
      ? "Salvo"
      : "Novo",
    currentNote()
      ? "saved"
      : ""
  );

  setNotebookEditorEnabled(
    true
  );
}


async function selectNotebookTopic(
  topicId
) {
  if (
    notebookState
      .selectedTopicId
      === topicId
  ) {
    return;
  }


  if (
    notebookState.dirty
    && notebookState
      .selectedTopicId
  ) {
    await saveNotebookNote({
      silent:
        true
    });
  }


  notebookState
    .selectedTopicId =
      topicId;


  renderTopicList();

  renderSelectedTopic();


  const params =
    new URLSearchParams(
      window.location.search
    );

  params.set(
    "topic_id",
    topicId
  );


  const nextUrl =
    `${window.location.pathname}?${params.toString()}`;


  window.history.replaceState(
    null,
    "",
    nextUrl
  );


  if (
    window.matchMedia(
      "(max-width: 820px)"
    ).matches
  ) {
    document
      .querySelector(
        ".notebook-editor"
      )
      ?.scrollIntoView({
        behavior:
          "smooth",

        block:
          "start"
      });
  }
}


function collectNotePayload() {
  const payload =
    {};


  NOTE_FIELDS.forEach(
    (field) => {
      const textarea =
        document.querySelector(
          `[data-note-field="${field}"]`
        );

      payload[
        field
      ] =
        textarea?.value
        || "";
    }
  );


  return payload;
}


function scheduleNotebookAutosave() {
  if (
    notebookState.saveTimer
  ) {
    clearTimeout(
      notebookState.saveTimer
    );
  }


  notebookState.dirty =
    true;


  setNotebookSaveStatus(
    "Não salvo"
  );


  notebookState.saveTimer =
    window.setTimeout(
      () => {
        saveNotebookNote({
          silent:
            true
        });
      },
      900
    );
}


async function saveNotebookNote({
  silent = false
} = {}) {
  const topic =
    currentTopic();


  if (
    !topic
    || !notebookState.user
    || notebookState.saving
  ) {
    return;
  }


  if (
    notebookState.saveTimer
  ) {
    clearTimeout(
      notebookState.saveTimer
    );

    notebookState.saveTimer =
      null;
  }


  notebookState.saving =
    true;


  setNotebookEditorEnabled(
    false
  );


  setNotebookSaveStatus(
    "Salvando...",
    "saving"
  );


  const fields =
    collectNotePayload();


  const payload = {
    user_id:
      notebookState.user.id,

    topic_id:
      topic.id,

    ...fields
  };


  const {
    data,
    error
  } =
    await notebookSb
      .from(
        "study_notes"
      )
      .upsert(
        payload,
        {
          onConflict:
            "user_id,topic_id"
        }
      )
      .select(
        "id,user_id,topic_id,disease,epidemiology,clinical_picture,diagnosis,treatment,prophylaxis,observations,created_at,updated_at"
      )
      .single();


  notebookState.saving =
    false;


  setNotebookEditorEnabled(
    true
  );


  if (error) {
    console.error(
      "Erro ao salvar caderno:",
      error
    );

    notebookState.dirty =
      true;


    setNotebookSaveStatus(
      "Erro ao salvar",
      "error"
    );


    if (!silent) {
      window.alert(
        `Não foi possível salvar o caderno: ${error.message}`
      );
    }

    return;
  }


  notebookState
    .notesByTopic
    .set(
      topic.id,
      data
    );


  notebookState.dirty =
    false;


  setNotebookSaveStatus(
    "Salvo",
    "saved"
  );


  renderNotebookCount();

  renderTopicList();
}


async function loadNotebookData() {
  const token =
    ++notebookState.loadToken;


  const [
    topicsResult,
    notesResult
  ] =
    await Promise.all([
      notebookSb
        .from(
          "study_topics"
        )
        .select(
          "id,area,materia,theme,scheduled_date,status,completed_at,created_at"
        ),

      notebookSb
        .from(
          "study_notes"
        )
        .select(
          "id,user_id,topic_id,disease,epidemiology,clinical_picture,diagnosis,treatment,prophylaxis,observations,created_at,updated_at"
        )
    ]);


  if (
    token
    !== notebookState.loadToken
  ) {
    return;
  }


  if (topicsResult.error) {
    console.error(
      topicsResult.error
    );

    const list =
      document.getElementById(
        "notebook-topic-list"
      );

    if (list) {
      list.innerHTML = `
        <div class="notebook-list-empty">
          Não foi possível carregar os temas.
        </div>
      `;
    }

    return;
  }


  if (notesResult.error) {
    console.error(
      notesResult.error
    );

    if (
      String(
        notesResult.error.message
        || ""
      )
        .toLowerCase()
        .includes(
          "study_notes"
        )
    ) {
      window.alert(
        "A tabela do Caderno ainda não foi criada. Rode o arquivo fase13_3_caderno.sql no Supabase."
      );
    }

    return;
  }


  notebookState.topics =
    (
      topicsResult.data
      || []
    )
      .sort(
        (a, b) => {
          const aDate =
            topicSortValue(
              a
            );

          const bDate =
            topicSortValue(
              b
            );

          if (
            aDate
            !== bDate
          ) {
            return aDate.localeCompare(
              bDate
            );
          }

          return String(
            a.theme
          ).localeCompare(
            String(
              b.theme
            ),
            "pt-BR"
          );
        }
      );


  notebookState
    .notesByTopic =
      new Map(
        (
          notesResult.data
          || []
        )
          .map(
            (note) => [
              note.topic_id,
              note
            ]
          )
      );


  renderNotebookCount();

  renderTopicList();


  const params =
    new URLSearchParams(
      window.location.search
    );


  const requestedTopic =
    params.get(
      "topic_id"
    );


  const topicToOpen =
    notebookState.topics
      .find(
        (topic) =>
          topic.id
          === requestedTopic
      )
      || notebookState.topics[
        0
      ]
      || null;


  if (topicToOpen) {
    await selectNotebookTopic(
      topicToOpen.id
    );
  }
}


function wireNotebookControls() {
  document
    .getElementById(
      "notebook-topic-search"
    )
    ?.addEventListener(
      "input",
      (event) => {
        notebookState.search =
          event.target.value;

        renderTopicList();
      }
    );


  document
    .getElementById(
      "notebook-topic-status"
    )
    ?.addEventListener(
      "change",
      (event) => {
        notebookState.status =
          event.target.value
          || "all";

        renderTopicList();
      }
    );


  document
    .querySelectorAll(
      "[data-note-field]"
    )
    .forEach(
      (textarea) => {
        textarea.addEventListener(
          "input",
          scheduleNotebookAutosave
        );
      }
    );


  document
    .getElementById(
      "notebook-save"
    )
    ?.addEventListener(
      "click",
      () => {
        saveNotebookNote();
      }
    );


  document
    .getElementById(
      "notebook-back-top"
    )
    ?.addEventListener(
      "click",
      () => {
        window.scrollTo({
          top:
            0,

          behavior:
            "smooth"
        });
      }
    );


  window.addEventListener(
    "beforeunload",
    (event) => {
      if (
        notebookState.dirty
        && !notebookState.saving
      ) {
        event.preventDefault();
        event.returnValue =
          "";
      }
    }
  );
}


async function initNotebook() {
  notebookState.user =
    window.docmapUser;


  if (
    !notebookState.user
  ) {
    return;
  }


  wireNotebookControls();


  await loadNotebookData();
}


if (
  window.docmapUser
) {
  initNotebook();

} else {
  window.addEventListener(
    "docmap:ready",
    initNotebook,
    {
      once:
        true
    }
  );
}
