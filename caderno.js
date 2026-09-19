const notebookSb = window.supabaseClient;

const NOTEBOOK_TEMPLATE = `
  <h2>Doença</h2><p><br></p>
  <h2>Epidemiologia</h2><p><br></p>
  <h2>Quadro clínico</h2><p><br></p>
  <h2>Diagnóstico</h2><p><br></p>
  <h2>Tratamento</h2><p><br></p>
  <h2>Profilaxia</h2><p><br></p>
  <h2>Observações</h2><p><br></p>
`;

const NOTEBOOK_EMOJIS = [
  "⚠️", "💡", "✅", "❌", "📌", "⭐",
  "🧠", "🫀", "🫁", "💊", "🩺", "🔬",
  "📚", "📝", "🔎", "➡️", "⬆️", "⬇️",
  "🔥", "🎯", "⏱️", "📖", "🧩", "❗"
];

const ALLOWED_TAGS = new Set([
  "P", "BR", "HR", "STRONG", "B", "EM", "I", "U",
  "H1", "H2", "H3", "UL", "OL", "LI",
  "DIV", "SPAN", "BLOCKQUOTE",
  "TABLE", "THEAD", "TBODY", "TR", "TH", "TD"
]);

const notebookState = {
  user: null,

  topics: [],

  notesByTopic:
    new Map(),

  notesById:
    new Map(),

  activeView:
    "editor",

  selectedType:
    null,

  selectedTopicId:
    null,

  selectedNoteId:
    null,

  topicSearch:
    "",

  topicAreaFilter:
    "",

  librarySearch:
    "",

  libraryAreaFilter:
    "",

  librarySelected:
    new Set(),

  editorEditable:
    false,

  lockedNoteIds:
    new Set(),

  editorDirty:
    false,

  saveTimer:
    null,

  savedRange:
    null
};


/* =========================================================
   HELPERS
   ========================================================= */

function escapeHtml(
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


function normalizeText(
  value
) {

  return String(
    value || ""
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


function formatDate(
  value
) {

  if (!value) {
    return "Sem data";
  }


  const raw =
    String(
      value
    )
      .slice(
        0,
        10
      );


  const parts =
    raw.split(
      "-"
    );


  if (
    parts.length !==
    3
  ) {

    return raw;

  }


  const [
    year,
    month,
    day
  ] =
    parts.map(
      Number
    );


  const date =
    new Date(
      year,
      month - 1,
      day
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return raw;

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


function topicDate(
  topic,
  note = null
) {

  return (
    topic?.scheduled_date
    ||
    topic?.original_date
    ||
    note?.created_at
    ||
    null
  );

}


function topicById(
  id
) {

  return notebookState.topics.find(
    (topic) =>
      topic.id ===
      id
  ) || null;

}


function noteByTopicId(
  id
) {

  return notebookState
    .notesByTopic
    .get(
      id
    )
    ||
    null;

}


function noteById(
  id
) {

  return notebookState
    .notesById
    .get(
      id
    )
    ||
    null;

}


function setSaveStatus(
  text = "",
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


function getCurrentDocument() {

  if (
    notebookState.selectedType ===
    "lesson"
  ) {

    const topic =
      topicById(
        notebookState.selectedTopicId
      );


    if (!topic) {
      return null;
    }


    return {
      type:
        "lesson",

      topic,

      note:
        noteByTopicId(
          topic.id
        ),

      title:
        topic.theme ||
        "Tema sem título",

      area:
        topic.area ||
        topic.materia ||
        "Sem área",

      date:
        topicDate(
          topic
        )
    };

  }


  if (
    notebookState.selectedType ===
    "free"
  ) {

    const note =
      noteById(
        notebookState.selectedNoteId
      );


    if (!note) {
      return null;
    }


    return {
      type:
        "free",

      topic:
        null,

      note,

      title:
        note.topic_title ||
        "Página sem título",

      area:
        note.area ||
        "Página livre",

      date:
        note.created_at ||
        null
    };

  }


  return null;

}


/* =========================================================
   SANITIZAÇÃO
   ========================================================= */

function sanitizeHtml(
  html
) {

  const template =
    document.createElement(
      "template"
    );


  template.innerHTML =
    String(
      html || ""
    );


  function clean(
    node
  ) {

    for (
      const child
      of
      Array.from(
        node.childNodes
      )
    ) {

      if (
        child.nodeType ===
        Node.COMMENT_NODE
      ) {

        child.remove();

        continue;

      }


      if (
        child.nodeType !==
        Node.ELEMENT_NODE
      ) {

        continue;

      }


      if (
        !ALLOWED_TAGS.has(
          child.tagName
        )
      ) {

        const fragment =
          document.createDocumentFragment();


        while (
          child.firstChild
        ) {

          fragment.appendChild(
            child.firstChild
          );

        }


        child.replaceWith(
          fragment
        );


        clean(
          node
        );


        continue;

      }


      let keepClass =
        "";

      let keepStyle =
        "";

      if (
        child.tagName ===
        "SPAN"
      ) {
        const color =
          child.style.color
          || "";

        const backgroundColor =
          child.style.backgroundColor
          || "";

        const safeStyle = [];

        if (color) {
          safeStyle.push(
            `color: ${color}`
          );
        }

        if (backgroundColor) {
          safeStyle.push(
            `background-color: ${backgroundColor}`
          );
        }

        keepStyle =
          safeStyle.join(
            "; "
          );
      }


      if (
        child.tagName ===
        "DIV"
        &&
        child.classList.contains(
          "notebook-study-block"
        )
      ) {

        if (
          child.classList.contains(
            "important"
          )
        ) {

          keepClass =
            "notebook-study-block important";

        }

        else if (
          child.classList.contains(
            "warning"
          )
        ) {

          keepClass =
            "notebook-study-block warning";

        }

        else if (
          child.classList.contains(
            "memory"
          )
        ) {

          keepClass =
            "notebook-study-block memory";

        }

      }


      for (
        const attribute
        of
        Array.from(
          child.attributes
        )
      ) {

        child.removeAttribute(
          attribute.name
        );

      }


      if (
        keepClass
      ) {

        child.className =
          keepClass;

      }

      if (
        keepStyle
      ) {
        child.setAttribute(
          "style",
          keepStyle
        );
      }


      clean(
        child
      );

    }

  }


  clean(
    template.content
  );


  return template.innerHTML;

}


/* =========================================================
   ABAS
   ========================================================= */

async function switchView(
  view,
  keepUrl = false
) {

  if (
    notebookState.activeView ===
    "editor"
    &&
    view !==
    "editor"
    &&
    notebookState.editorDirty
  ) {

    await saveCurrentNotebook(
      true
    );

  }


  notebookState.activeView =
    view;


  document
    .querySelectorAll(
      "[data-notebook-tab]"
    )
    .forEach(
      (button) => {

        button.classList.toggle(
          "active",
          button.dataset
            .notebookTab ===
            view
        );

      }
    );


  document
    .querySelectorAll(
      ".notebook-view"
    )
    .forEach(
      (section) => {

        section.hidden =
          section.id !==
          `notebook-view-${view}`;

      }
    );


  if (
    view ===
    "editor"
  ) {

    renderTopicList();

    renderDocument();

  }

  else if (
    view ===
    "library"
  ) {

    setSaveStatus(
      ""
    );


    renderLibrary();

  }


  if (
    !keepUrl
  ) {

    const url =
      new URL(
        window.location.href
      );


    url.searchParams.set(
      "view",
      view
    );


    if (
      view !==
      "editor"
    ) {

      url.searchParams.delete(
        "topic_id"
      );


      url.searchParams.delete(
        "note_id"
      );

    }


    window.history.replaceState(
      {},
      "",
      url
    );

  }

}


/* =========================================================
   FILTRO POR ÁREA
   ========================================================= */

function populateAreaFilter() {

  const select =
    document.getElementById(
      "notebook-area-filter"
    );


  const datalist =
    document.getElementById(
      "notebook-free-area-options"
    );


  const areas =
    Array.from(
      new Set(
        [
          ...notebookState.topics
            .map(
              (topic) =>
                String(
                  topic.area ||
                  ""
                )
                  .trim()
            ),

          ...Array.from(
            notebookState
              .notesById
              .values()
          )
            .map(
              (note) =>
                String(
                  note.area ||
                  ""
                )
                  .trim()
            )
        ]
          .filter(
            Boolean
          )
      )
    )
      .sort(
        (
          a,
          b
        ) =>
          a.localeCompare(
            b,
            "pt-BR"
          )
      );


  if (
    select
  ) {

    select.innerHTML =
      `
        <option value="">
          Todas as áreas
        </option>

        ${
          areas
            .map(
              (area) =>
                `
                  <option
                    value="${escapeHtml(
                      area
                    )}"
                  >
                    ${escapeHtml(
                      area
                    )}
                  </option>
                `
            )
            .join(
              ""
            )
        }
      `;


    select.value =
      notebookState.topicAreaFilter;

  }


  if (
    datalist
  ) {

    datalist.innerHTML =
      areas
        .map(
          (area) =>
            `
              <option
                value="${escapeHtml(
                  area
                )}"
              ></option>
            `
        )
        .join(
          ""
        );

  }


  const librarySelect =
    document.getElementById(
      "notebook-library-area-filter"
    );

  if (
    librarySelect
  ) {
    librarySelect.innerHTML =
      `
        <option value="">
          Todas as áreas
        </option>

        ${
          areas
            .map(
              (area) =>
                `
                  <option
                    value="${escapeHtml(
                      area
                    )}"
                  >
                    ${escapeHtml(
                      area
                    )}
                  </option>
                `
            )
            .join(
              ""
            )
        }
      `;

    librarySelect.value =
      notebookState.libraryAreaFilter;
  }

}


function updateFilterButtonState() {

  const button =
    document.getElementById(
      "notebook-filter-toggle"
    );


  if (!button) {
    return;
  }


  button.classList.toggle(
    "active",
    Boolean(
      notebookState
        .topicAreaFilter
    )
  );

}


function openFilterMenu() {

  const menu =
    document.getElementById(
      "notebook-filter-menu"
    );


  const toggle =
    document.getElementById(
      "notebook-filter-toggle"
    );


  if (
    !menu ||
    !toggle
  ) {

    return;

  }


  menu.hidden =
    false;


  toggle.setAttribute(
    "aria-expanded",
    "true"
  );

}


function closeFilterMenu() {

  const menu =
    document.getElementById(
      "notebook-filter-menu"
    );


  const toggle =
    document.getElementById(
      "notebook-filter-toggle"
    );


  if (menu) {
    menu.hidden =
      true;
  }


  if (toggle) {

    toggle.setAttribute(
      "aria-expanded",
      "false"
    );

  }

}


function toggleFilterMenu() {

  const menu =
    document.getElementById(
      "notebook-filter-menu"
    );


  if (!menu) {
    return;
  }


  if (
    menu.hidden
  ) {

    openFilterMenu();

  }

  else {

    closeFilterMenu();

  }

}


/* =========================================================
   LISTA DE TEMAS
   ========================================================= */

function renderTopicList() {

  const list =
    document.getElementById(
      "notebook-topic-list"
    );


  const count =
    document.getElementById(
      "notebook-topic-count"
    );


  if (!list) {
    return;
  }


  const query =
    normalizeText(
      notebookState.topicSearch
    );


  const areaFilter =
    normalizeText(
      notebookState.topicAreaFilter
    );


  const topics =
    notebookState.topics.filter(
      (topic) => {

        const matchesSearch =
          !query
          ||
          normalizeText(
            [
              topic.theme,
              topic.area,
              topic.materia,
              formatDate(
                topicDate(
                  topic
                )
              )
            ]
              .filter(
                Boolean
              )
              .join(
                " "
              )
          )
            .includes(
              query
            );


        const matchesArea =
          !areaFilter
          ||
          normalizeText(
            topic.area
          ) ===
          areaFilter;


        return (
          matchesSearch
          &&
          matchesArea
        );

      }
    );


  if (
    count
  ) {

    count.textContent =
      topics.length;

  }


  if (
    !topics.length
  ) {

    list.innerHTML =
      `
        <div class="notebook-empty-small">
          Nenhum tema encontrado.
        </div>
      `;


    return;

  }


  list.innerHTML =
    topics
      .map(
        (topic) => {

          const note =
            noteByTopicId(
              topic.id
            );


          const active =
            (
              notebookState.selectedType ===
              "lesson"
              &&
              topic.id ===
              notebookState.selectedTopicId
            );


          return `
            <button
              class="
                notebook-topic-item
                ${active ? "active" : ""}
              "
              type="button"
              data-topic-id="${escapeHtml(
                topic.id
              )}"
            >

              <strong>
                ${escapeHtml(
                  topic.theme ||
                  "Tema sem título"
                )}
              </strong>

              <small>
                ${escapeHtml(
                  [
                    topic.area,
                    topic.materia,
                    formatDate(
                      topicDate(
                        topic
                      )
                    )
                  ]
                    .filter(
                      Boolean
                    )
                    .join(
                      " · "
                    )
                )}
              </small>

              <span class="notebook-topic-flags">

                ${
                  note
                    ?.content_html
                    ?.trim()
                    ? `
                      <span class="
                        notebook-topic-flag
                        has-note
                      ">
                        com anotações
                      </span>
                    `
                    : ""
                }

                ${
                  topic.completed_at
                    ? `
                      <span class="
                        notebook-topic-flag
                        completed
                      ">
                        concluída
                      </span>
                    `
                    : ""
                }

              </span>

            </button>
          `;

        }
      )
      .join(
        ""
      );


  list
    .querySelectorAll(
      "[data-topic-id]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            openTopic(
              button.dataset
                .topicId
            );

          }
        );

      }
    );

}


/* =========================================================
   EDITOR
   ========================================================= */

function setEditorEnabled(
  enabled
) {

  [
    "notebook-block-style",
    "notebook-bold",
    "notebook-italic",
    "notebook-underline",
    "notebook-text-color",
    "notebook-highlight-color",
    "notebook-list-toggle",
    "notebook-template",
    "notebook-break",
    "notebook-divider",
    "notebook-table-toggle",
    "notebook-emoji-toggle",
    "notebook-callout-toggle",
    "notebook-save-now"
  ]
    .forEach(
      (id) => {

        const element =
          document.getElementById(
            id
          );

        if (
          element
        ) {
          element.disabled =
            !enabled;
        }

      }
    );


  document
    .querySelectorAll(
      "[data-study-block]"
    )
    .forEach(
      (button) => {
        button.disabled =
          !enabled;
      }
    );


  const editor =
    document.getElementById(
      "notebook-editor"
    );

  if (
    editor
  ) {
    editor.contentEditable =
      enabled
        ? "true"
        : "false";

    editor.setAttribute(
      "aria-readonly",
      enabled
        ? "false"
        : "true"
    );

    editor.classList.toggle(
      "is-editing",
      enabled
    );
  }


  const editButton =
    document.getElementById(
      "notebook-document-edit"
    );

  if (
    editButton
  ) {
    editButton.textContent =
      enabled
        ? "Concluir edição"
        : "Editar";
  }


  if (
    !enabled
  ) {
    closeNotebookToolMenus();
    closeEmojiMenu();
  }

}


function setNotebookEditMode(
  enabled
) {
  notebookState.editorEditable =
    Boolean(
      enabled
    );

  setEditorEnabled(
    notebookState.editorEditable
  );

  const editButton =
    document.getElementById(
      "notebook-document-edit"
    );

  if (
    editButton
  ) {
    editButton.textContent =
      notebookState.editorEditable
        ? "Concluir edição"
        : "Editar";
  }

  const menu =
    document.getElementById(
      "notebook-document-menu"
    );

  const toggle =
    document.getElementById(
      "notebook-document-menu-toggle"
    );

  if (
    menu
  ) {
    menu.hidden =
      true;
  }

  if (
    toggle
  ) {
    toggle.setAttribute(
      "aria-expanded",
      "false"
    );
  }

  if (
    notebookState.editorEditable
  ) {
    requestAnimationFrame(
      () => {
        document
          .getElementById(
            "notebook-editor"
          )
          ?.focus();
      }
    );
  }
}


function renderDocument() {

  const current =
    getCurrentDocument();


  const wrap =
    document.getElementById(
      "notebook-document-wrap"
    );


  const hint =
    document.getElementById(
      "notebook-editor-hint"
    );


  const editor =
    document.getElementById(
      "notebook-editor"
    );


  if (
    !current
  ) {

    if (
      wrap
    ) {

      wrap.hidden =
        true;

    }


    if (
      hint
    ) {

      hint.hidden =
        false;

    }


    setEditorEnabled(
      false
    );


    setSaveStatus(
      ""
    );


    return;

  }


  if (
    wrap
  ) {

    wrap.hidden =
      false;

  }


  if (
    hint
  ) {

    hint.hidden =
      true;

  }


  notebookState.editorEditable =
    false;

  const storedContent =
    String(
      current.note
        ?.content_html
      || ""
    )
      .trim();

  const lockedInSession =
    Boolean(
      current.note?.id
      &&
      notebookState
        .lockedNoteIds
        .has(
          current.note.id
        )
    );

  /*
    Primeira mexida:
    - aula sem caderno salvo -> abre editável;
    - página/caderno ainda vazio -> abre editável;
    - depois de Salvar explicitamente -> trava.
  */
  notebookState.editorEditable =
    (
      !current.note
      ||
      (
        !storedContent
        &&
        !lockedInSession
      )
    );

  setEditorEnabled(
    notebookState.editorEditable
  );


  const title =
    document.getElementById(
      "notebook-document-title"
    );


  const area =
    document.getElementById(
      "notebook-document-area"
    );


  const date =
    document.getElementById(
      "notebook-document-date"
    );


  if (
    title
  ) {

    title.textContent =
      current.title;

  }


  if (
    area
  ) {

    area.textContent =
      current.area;

  }


  if (
    date
  ) {

    date.textContent =
      formatDate(
        current.date
      );

  }


  if (
    editor
  ) {

    editor.innerHTML =
      sanitizeHtml(
        current.note
          ?.content_html
        ||
        ""
      );

  }


  notebookState.editorDirty =
    false;


  notebookState.savedRange =
    null;


  if (
    current.note
  ) {

    setSaveStatus(
      "Salvo",
      "saved"
    );

  }

  else {

    setSaveStatus(
      "Novo caderno"
    );

  }

}


async function openTopic(
  topicId
) {

  const topic =
    topicById(
      topicId
    );


  if (
    !topic
  ) {

    return;

  }


  if (
    notebookState.editorDirty
  ) {

    await saveCurrentNotebook(
      true
    );

  }


  notebookState.selectedType =
    "lesson";


  notebookState.selectedTopicId =
    topicId;


  notebookState.selectedNoteId =
    null;


  await switchView(
    "editor",
    true
  );


  renderTopicList();

  renderDocument();


  const url =
    new URL(
      window.location.href
    );


  url.searchParams.set(
    "view",
    "editor"
  );


  url.searchParams.set(
    "topic_id",
    topicId
  );


  url.searchParams.delete(
    "note_id"
  );


  window.history.replaceState(
    {},
    "",
    url
  );


}


async function openFreeNote(
  noteId
) {

  const note =
    noteById(
      noteId
    );


  if (
    !note ||
    note.topic_id
  ) {

    return;

  }


  if (
    notebookState.editorDirty
  ) {

    await saveCurrentNotebook(
      true
    );

  }


  notebookState.selectedType =
    "free";


  notebookState.selectedTopicId =
    null;


  notebookState.selectedNoteId =
    noteId;


  await switchView(
    "editor",
    true
  );


  renderTopicList();

  renderDocument();


  const url =
    new URL(
      window.location.href
    );


  url.searchParams.set(
    "view",
    "editor"
  );


  url.searchParams.set(
    "note_id",
    noteId
  );


  url.searchParams.delete(
    "topic_id"
  );


  window.history.replaceState(
    {},
    "",
    url
  );


}


/* =========================================================
   PÁGINA LIVRE
   ========================================================= */

function openFreePageModal() {

  const modal =
    document.getElementById(
      "notebook-free-modal"
    );


  const title =
    document.getElementById(
      "notebook-free-title"
    );


  const area =
    document.getElementById(
      "notebook-free-area"
    );


  if (
    !modal
  ) {

    return;

  }


  if (
    title
  ) {

    title.value =
      "";

  }


  if (
    area
  ) {

    area.value =
      "";

  }


  modal.hidden =
    false;


  requestAnimationFrame(
    () => {

      title?.focus();

    }
  );

}


function closeFreePageModal() {

  const modal =
    document.getElementById(
      "notebook-free-modal"
    );


  if (
    modal
  ) {

    modal.hidden =
      true;

  }

}


async function createFreePage() {

  const titleInput =
    document.getElementById(
      "notebook-free-title"
    );


  const areaInput =
    document.getElementById(
      "notebook-free-area"
    );


  const button =
    document.getElementById(
      "notebook-free-create"
    );


  const title =
    String(
      titleInput?.value ||
      ""
    )
      .trim();


  const area =
    String(
      areaInput?.value ||
      ""
    )
      .trim();


  if (
    !title
  ) {

    titleInput?.focus();

    return;

  }


  if (
    button
  ) {

    button.disabled =
      true;


    button.textContent =
      "Criando...";

  }


  const {
    data,
    error
  } =
    await notebookSb
      .from(
        "study_notes"
      )
      .insert({
        user_id:
          notebookState.user.id,

        topic_id:
          null,

        topic_title:
          title,

        area:
          area ||
          "Página livre",

        materia:
          null,

        content_html:
          ""
      })
      .select(
        "id,user_id,topic_id,topic_title,area,materia,content_html,created_at,updated_at"
      )
      .single();


  if (
    button
  ) {

    button.disabled =
      false;


    button.textContent =
      "Criar página";

  }


  if (
    error
  ) {

    console.error(
      error
    );


    alert(
      `Não foi possível criar a página: ${error.message}`
    );


    return;

  }


  notebookState
    .notesById
    .set(
      data.id,
      data
    );


  closeFreePageModal();


  renderLibrary();


  await openFreeNote(
    data.id
  );

}


/* =========================================================
   SALVAR
   ========================================================= */

async function saveCurrentNotebook(
  silent = false
) {

  if (
    !notebookState.user
  ) {

    return;

  }


  const current =
    getCurrentDocument();


  const editor =
    document.getElementById(
      "notebook-editor"
    );


  if (
    !current ||
    !editor
  ) {

    return;

  }


  if (
    !silent
  ) {

    setSaveStatus(
      "Salvando...",
      "saving"
    );

  }


  const contentHtml =
    sanitizeHtml(
      editor.innerHTML
    );


  let result;


  if (
    current.type ===
    "lesson"
  ) {

    const payload = {
      user_id:
        notebookState.user.id,

      topic_id:
        current.topic.id,

      topic_title:
        current.title,

      area:
        current.topic.area ||
        null,

      materia:
        current.topic.materia ||
        null,

      content_html:
        contentHtml
    };


    if (
      current.note?.id
    ) {

      result =
        await notebookSb
          .from(
            "study_notes"
          )
          .update(
            payload
          )
          .eq(
            "id",
            current.note.id
          )
          .eq(
            "user_id",
            notebookState.user.id
          )
          .select(
            "id,user_id,topic_id,topic_title,area,materia,content_html,created_at,updated_at"
          )
          .single();

    }

    else {

      result =
        await notebookSb
          .from(
            "study_notes"
          )
          .insert(
            payload
          )
          .select(
            "id,user_id,topic_id,topic_title,area,materia,content_html,created_at,updated_at"
          )
          .single();

    }

  }

  else {

    result =
      await notebookSb
        .from(
          "study_notes"
        )
        .update({
          content_html:
            contentHtml
        })
        .eq(
          "id",
          current.note.id
        )
        .eq(
          "user_id",
          notebookState.user.id
        )
        .select(
          "id,user_id,topic_id,topic_title,area,materia,content_html,created_at,updated_at"
        )
        .single();

  }


  if (
    result.error
  ) {

    console.error(
      result.error
    );


    setSaveStatus(
      `Erro ao salvar: ${result.error.message}`,
      "error"
    );


    return;

  }


  notebookState
    .notesById
    .set(
      result.data.id,
      result.data
    );


  if (
    result.data.topic_id
  ) {

    notebookState
      .notesByTopic
      .set(
        result.data.topic_id,
        result.data
      );

  }


  notebookState.editorDirty =
    false;


  renderTopicList();

  renderLibrary();


  setSaveStatus(
    "Salvo",
    "saved"
  );

}


function scheduleSave() {

  if (
    !notebookState.editorEditable
  ) {
    return;
  }

  notebookState.editorDirty =
    true;


  clearTimeout(
    notebookState.saveTimer
  );


  setSaveStatus(
    "Alterações não salvas",
    "saving"
  );


  notebookState.saveTimer =
    setTimeout(
      () => {

        saveCurrentNotebook(
          false
        );

      },
      700
    );

}


/* =========================================================
   SELEÇÃO / FORMATAÇÃO
   ========================================================= */

function saveSelection() {

  const editor =
    document.getElementById(
      "notebook-editor"
    );


  const selection =
    window.getSelection();


  if (
    !editor ||
    !selection ||
    !selection.rangeCount
  ) {

    return;

  }


  const range =
    selection.getRangeAt(
      0
    );


  if (
    !editor.contains(
      range.commonAncestorContainer
    )
  ) {

    return;

  }


  notebookState.savedRange =
    range.cloneRange();

}


function restoreSelection() {

  const editor =
    document.getElementById(
      "notebook-editor"
    );


  if (
    !editor
  ) {

    return;

  }


  editor.focus();


  const selection =
    window.getSelection();


  selection.removeAllRanges();


  if (
    notebookState.savedRange
  ) {

    selection.addRange(
      notebookState.savedRange
    );


    return;

  }


  const range =
    document.createRange();


  range.selectNodeContents(
    editor
  );


  range.collapse(
    false
  );


  selection.addRange(
    range
  );

}


function execEditorCommand(
  command,
  value = null
) {

  restoreSelection();


  document.execCommand(
    command,
    false,
    value
  );


  saveSelection();


  scheduleSave();

}


function insertTemplate() {

  restoreSelection();


  document.execCommand(
    "insertHTML",
    false,
    NOTEBOOK_TEMPLATE
  );


  saveSelection();


  scheduleSave();

}


function insertBreak() {

  restoreSelection();


  document.execCommand(
    "insertHTML",
    false,
    "<p><br></p><p><br></p>"
  );


  saveSelection();


  scheduleSave();

}


function insertDivider() {

  restoreSelection();


  document.execCommand(
    "insertHTML",
    false,
    "<hr><p><br></p>"
  );


  saveSelection();


  scheduleSave();

}



/* =========================================================
   CORES E GRIFO
   ========================================================= */

function applyTextColor(
  color
) {
  if (
    !notebookState.editorEditable
    || !color
  ) {
    return;
  }

  execEditorCommand(
    "foreColor",
    color
  );
}


function applyHighlightColor(
  color
) {
  if (
    !notebookState.editorEditable
    || !color
  ) {
    return;
  }

  restoreSelection();

  const supported =
    document.queryCommandSupported?.(
      "hiliteColor"
    );

  document.execCommand(
    supported
      ? "hiliteColor"
      : "backColor",
    false,
    color
  );

  saveSelection();
  scheduleSave();
}


/* =========================================================
   TABELAS
   ========================================================= */

function setNotebookTableStatus(
  text = "",
  type = ""
) {
  const element =
    document.getElementById(
      "notebook-table-status"
    );

  if (!element) {
    return;
  }

  element.textContent =
    text;

  element.className =
    `notebook-table-status ${type}`
      .trim();
}


function renderNotebookTableBuilder(
  rows = null
) {
  const container =
    document.getElementById(
      "notebook-table-editor"
    );

  if (!container) {
    return;
  }

  const data =
    Array.isArray(
      rows
    )
    && rows.length
      ? rows
      : [
          ["Coluna 1", "Coluna 2", "Coluna 3"],
          ["", "", ""],
          ["", "", ""]
        ];

  const width =
    Math.max(
      1,
      ...data.map(
        row =>
          Array.isArray(
            row
          )
            ? row.length
            : 0
      )
    );

  const normalized =
    data.map(
      row => [
        ...(Array.isArray(row)
          ? row
          : []),
        ...Array(
          Math.max(
            0,
            width
            - (
              Array.isArray(row)
                ? row.length
                : 0
            )
          )
        ).fill("")
      ]
    );

  container.innerHTML =
    `
      <table data-notebook-table-builder>
        <tbody>
          ${
            normalized
              .map(
                (row, rowIndex) =>
                  `
                    <tr>
                      ${
                        row
                          .map(
                            cell => {
                              const tag =
                                rowIndex === 0
                                  ? "th"
                                  : "td";

                              return `
                                <${tag}
                                  contenteditable="true"
                                >${escapeHtml(
                                  cell
                                )}</${tag}>
                              `;
                            }
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


function openNotebookTableModal(
  mode = "manual"
) {
  if (
    !notebookState.editorEditable
  ) {
    return;
  }

  saveSelection();

  const modal =
    document.getElementById(
      "notebook-table-modal"
    );

  if (!modal) {
    return;
  }

  modal.hidden =
    false;

  setNotebookTableStatus(
    ""
  );

  if (
    mode === "manual"
  ) {
    renderNotebookTableBuilder();
  }

  if (
    mode === "reader"
  ) {
    const input =
      document.getElementById(
        "notebook-table-image"
      );

    if (
      input
    ) {
      input.value =
        "";
    }

    renderNotebookTableBuilder();
  }
}


function closeNotebookTableModal() {
  const modal =
    document.getElementById(
      "notebook-table-modal"
    );

  if (
    modal
  ) {
    modal.hidden =
      true;
  }

  setNotebookTableStatus(
    ""
  );
}


function getNotebookTableElement() {
  return document
    .getElementById(
      "notebook-table-editor"
    )
    ?.querySelector(
      "table[data-notebook-table-builder]"
    )
    || null;
}


function addNotebookTableRow() {
  const table =
    getNotebookTableElement();

  if (!table) {
    renderNotebookTableBuilder();
    return;
  }

  const cols =
    table.rows[0]
      ?.cells
      ?.length
    || 1;

  const row =
    table.insertRow();

  for (
    let index = 0;
    index < cols;
    index += 1
  ) {
    const cell =
      row.insertCell();

    cell.contentEditable =
      "true";
  }
}


function removeNotebookTableRow() {
  const table =
    getNotebookTableElement();

  if (
    !table
    || table.rows.length <= 1
  ) {
    return;
  }

  table.deleteRow(
    table.rows.length - 1
  );
}


function addNotebookTableColumn() {
  const table =
    getNotebookTableElement();

  if (!table) {
    renderNotebookTableBuilder();
    return;
  }

  Array.from(
    table.rows
  )
    .forEach(
      (
        row,
        rowIndex
      ) => {
        const tag =
          rowIndex === 0
            ? "th"
            : "td";

        const cell =
          document.createElement(
            tag
          );

        cell.contentEditable =
          "true";

        if (
          rowIndex === 0
        ) {
          cell.textContent =
            `Coluna ${row.cells.length + 1}`;
        }

        row.appendChild(
          cell
        );
      }
    );
}


function removeNotebookTableColumn() {
  const table =
    getNotebookTableElement();

  if (!table) {
    return;
  }

  const cols =
    table.rows[0]
      ?.cells
      ?.length
    || 0;

  if (
    cols <= 1
  ) {
    return;
  }

  Array.from(
    table.rows
  )
    .forEach(
      row =>
        row.deleteCell(
          cols - 1
        )
    );
}


function notebookTableHtmlFromBuilder() {
  const table =
    getNotebookTableElement();

  if (!table) {
    return "";
  }

  const rows =
    Array.from(
      table.rows
    );

  if (!rows.length) {
    return "";
  }

  return `
    <table>
      <tbody>
        ${
          rows
            .map(
              (
                row,
                rowIndex
              ) =>
                `
                  <tr>
                    ${
                      Array.from(
                        row.cells
                      )
                        .map(
                          cell => {
                            const tag =
                              rowIndex === 0
                                ? "th"
                                : "td";

                            return `
                              <${tag}>
                                ${escapeHtml(
                                  cell.innerText
                                    ?.trim()
                                  || ""
                                )}
                              </${tag}>
                            `;
                          }
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
    <p><br></p>
  `;
}


function insertNotebookTable() {
  const html =
    notebookTableHtmlFromBuilder();

  if (!html) {
    setNotebookTableStatus(
      "Crie ou reconheça uma tabela primeiro.",
      "error"
    );

    return;
  }

  restoreSelection();

  document.execCommand(
    "insertHTML",
    false,
    html
  );

  saveSelection();
  scheduleSave();
  closeNotebookTableModal();
}


function medianNotebookNumber(
  values
) {
  const clean =
    (values || [])
      .filter(
        value =>
          Number.isFinite(
            Number(
              value
            )
          )
      )
      .map(Number)
      .sort(
        (a, b) =>
          a - b
      );

  if (!clean.length) {
    return 0;
  }

  const middle =
    Math.floor(
      clean.length / 2
    );

  return clean.length % 2
    ? clean[middle]
    : (
        clean[middle - 1]
        + clean[middle]
      ) / 2;
}


function notebookTableWordData(
  words
) {
  return (words || [])
    .filter(
      word => {
        const text =
          String(
            word.text
            || ""
          )
            .replace(
              /\s+/g,
              " "
            )
            .trim();

        return (
          text
          &&
          word.bbox
          &&
          Number.isFinite(
            Number(
              word.bbox.x0
            )
          )
          &&
          Number.isFinite(
            Number(
              word.bbox.y0
            )
          )
          &&
          Number.isFinite(
            Number(
              word.bbox.x1
            )
          )
          &&
          Number.isFinite(
            Number(
              word.bbox.y1
            )
          )
        );
      }
    )
    .map(
      word => {
        const x0 =
          Number(
            word.bbox.x0
          );

        const y0 =
          Number(
            word.bbox.y0
          );

        const x1 =
          Number(
            word.bbox.x1
          );

        const y1 =
          Number(
            word.bbox.y1
          );

        return {
          text:
            String(
              word.text
              || ""
            )
              .replace(
                /\s+/g,
                " "
              )
              .trim(),

          confidence:
            Number(
              word.confidence
              || 0
            ),

          x0,
          y0,
          x1,
          y1,

          x:
            (
              x0
              + x1
            ) / 2,

          y:
            (
              y0
              + y1
            ) / 2,

          width:
            Math.max(
              1,
              x1 - x0
            ),

          height:
            Math.max(
              1,
              y1 - y0
            )
        };
      }
    )
    .filter(
      word =>
        word.width >= 2
        &&
        word.height >= 3
    );
}


async function prepareNotebookTableCanvas(
  file
) {
  const bitmap =
    await createImageBitmap(
      file
    );

  /*
    Tabelas de print costumam ter texto pequeno.
    Sempre ampliamos imagens pequenas, mas limitamos
    o lado maior para não estourar memória no celular.
  */
  const longestSide =
    Math.max(
      bitmap.width,
      bitmap.height
    );

  const scale =
    Math.max(
      1,
      Math.min(
        3.2,
        2400
        / Math.max(
            1,
            longestSide
          )
      )
    );

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    Math.max(
      1,
      Math.round(
        bitmap.width
        * scale
      )
    );

  canvas.height =
    Math.max(
      1,
      Math.round(
        bitmap.height
        * scale
      )
    );

  const context =
    canvas.getContext(
      "2d",
      {
        alpha:
          false,
        willReadFrequently:
          true
      }
    );

  context.fillStyle =
    "#ffffff";

  context.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  context.imageSmoothingEnabled =
    true;

  context.imageSmoothingQuality =
    "high";

  context.drawImage(
    bitmap,
    0,
    0,
    canvas.width,
    canvas.height
  );

  bitmap.close?.();

  return canvas;
}


function groupNotebookLinePositions(
  positions,
  maxGap = 3
) {
  if (
    !positions.length
  ) {
    return [];
  }

  const groups = [];
  let current = [
    positions[0]
  ];

  for (
    let index = 1;
    index < positions.length;
    index += 1
  ) {
    const value =
      positions[index];

    const previous =
      positions[index - 1];

    if (
      value - previous
      <= maxGap
    ) {
      current.push(
        value
      );
    } else {
      groups.push(
        current
      );

      current = [
        value
      ];
    }
  }

  groups.push(
    current
  );

  return groups.map(
    group =>
      Math.round(
        group.reduce(
          (
            sum,
            value
          ) =>
            sum + value,
          0
        )
        / group.length
      )
  );
}


function longestDarkRunInRow(
  pixels,
  width,
  y,
  threshold
) {
  let longest =
    0;

  let current =
    0;

  for (
    let x = 0;
    x < width;
    x += 1
  ) {
    const offset =
      (
        y * width
        + x
      ) * 4;

    const red =
      pixels[offset];

    const green =
      pixels[offset + 1];

    const blue =
      pixels[offset + 2];

    const luminance =
      (
        red * 0.299
        + green * 0.587
        + blue * 0.114
      );

    if (
      luminance
      <= threshold
    ) {
      current +=
        1;

      if (
        current > longest
      ) {
        longest =
          current;
      }
    } else {
      current =
        0;
    }
  }

  return longest;
}


function longestDarkRunInColumn(
  pixels,
  width,
  height,
  x,
  threshold
) {
  let longest =
    0;

  let current =
    0;

  for (
    let y = 0;
    y < height;
    y += 1
  ) {
    const offset =
      (
        y * width
        + x
      ) * 4;

    const red =
      pixels[offset];

    const green =
      pixels[offset + 1];

    const blue =
      pixels[offset + 2];

    const luminance =
      (
        red * 0.299
        + green * 0.587
        + blue * 0.114
      );

    if (
      luminance
      <= threshold
    ) {
      current +=
        1;

      if (
        current > longest
      ) {
        longest =
          current;
      }
    } else {
      current =
        0;
    }
  }

  return longest;
}


function notebookPixelDifference(
  pixels,
  firstOffset,
  secondOffset
) {
  return Math.max(
    Math.abs(
      pixels[firstOffset]
      - pixels[secondOffset]
    ),
    Math.abs(
      pixels[firstOffset + 1]
      - pixels[secondOffset + 1]
    ),
    Math.abs(
      pixels[firstOffset + 2]
      - pixels[secondOffset + 2]
    )
  );
}


function detectNotebookGridByEdges(
  pixels,
  width,
  height
) {
  /*
    As bordas de tabelas reais muitas vezes são muito claras
    (#d9d9d9, azul-claro etc.). Em vez de procurar "linha escura",
    medimos a mudança de cor entre pixels vizinhos.

    Uma divisória vertical verdadeira provoca essa mudança em
    muitos Y consecutivos. Letras também criam bordas, mas por
    poucos pixels de altura.
  */
  const differenceThreshold =
    12;

  const verticalCandidates =
    [];

  const minVerticalRun =
    Math.max(
      12,
      Math.round(
        height * 0.04
      )
    );

  const minVerticalFraction =
    0.10;

  for (
    let x = 1;
    x < width;
    x += 1
  ) {
    let hits =
      0;

    let run =
      0;

    let longestRun =
      0;

    for (
      let y = 0;
      y < height;
      y += 1
    ) {
      const current =
        (
          y * width
          + x
        ) * 4;

      const previous =
        (
          y * width
          + (
            x - 1
          )
        ) * 4;

      const edge =
        notebookPixelDifference(
          pixels,
          current,
          previous
        )
        >= differenceThreshold;

      if (
        edge
      ) {
        hits +=
          1;

        run +=
          1;

        if (
          run > longestRun
        ) {
          longestRun =
            run;
        }
      } else {
        run =
          0;
      }
    }

    if (
      hits / height
        >= minVerticalFraction
      &&
      longestRun
        >= minVerticalRun
    ) {
      verticalCandidates.push(
        x
      );
    }
  }


  const horizontalCandidates =
    [];

  const minHorizontalFraction =
    0.52;

  const minHorizontalRun =
    Math.max(
      55,
      Math.round(
        width * 0.22
      )
    );

  for (
    let y = 1;
    y < height;
    y += 1
  ) {
    let hits =
      0;

    let run =
      0;

    let longestRun =
      0;

    for (
      let x = 0;
      x < width;
      x += 1
    ) {
      const current =
        (
          y * width
          + x
        ) * 4;

      const previous =
        (
          (
            y - 1
          ) * width
          + x
        ) * 4;

      const edge =
        notebookPixelDifference(
          pixels,
          current,
          previous
        )
        >= differenceThreshold;

      if (
        edge
      ) {
        hits +=
          1;

        run +=
          1;

        if (
          run > longestRun
        ) {
          longestRun =
            run;
        }
      } else {
        run =
          0;
      }
    }

    if (
      hits / width
        >= minHorizontalFraction
      &&
      longestRun
        >= minHorizontalRun
    ) {
      horizontalCandidates.push(
        y
      );
    }
  }


  const groupingGap =
    Math.max(
      4,
      Math.round(
        Math.min(
          width,
          height
        ) * 0.004
      )
    );

  const vertical =
    groupNotebookLinePositions(
      verticalCandidates,
      groupingGap
    );

  const horizontal =
    groupNotebookLinePositions(
      horizontalCandidates,
      groupingGap
    );


  if (
    vertical.length < 2
    ||
    horizontal.length < 2
    ||
    vertical.length > 16
    ||
    horizontal.length > 60
  ) {
    return null;
  }


  return {
    vertical,
    horizontal,
    method:
      "edges"
  };
}


function detectNotebookGridByDarkRuns(
  pixels,
  width,
  height
) {
  /*
    Fallback para tabelas com linhas pretas/cinza-escuras.
  */
  const thresholds = [
    205,
    222,
    235
  ];

  let best = {
    vertical: [],
    horizontal: []
  };

  for (
    const threshold
    of thresholds
  ) {
    const horizontalCandidates =
      [];

    const verticalCandidates =
      [];

    const minHorizontalRun =
      Math.max(
        70,
        width * 0.28
      );

    const minVerticalRun =
      Math.max(
        50,
        height * 0.20
      );

    for (
      let y = 0;
      y < height;
      y += 1
    ) {
      if (
        longestDarkRunInRow(
          pixels,
          width,
          y,
          threshold
        )
        >= minHorizontalRun
      ) {
        horizontalCandidates.push(
          y
        );
      }
    }

    for (
      let x = 0;
      x < width;
      x += 1
    ) {
      if (
        longestDarkRunInColumn(
          pixels,
          width,
          height,
          x,
          threshold
        )
        >= minVerticalRun
      ) {
        verticalCandidates.push(
          x
        );
      }
    }

    const horizontal =
      groupNotebookLinePositions(
        horizontalCandidates,
        4
      );

    const vertical =
      groupNotebookLinePositions(
        verticalCandidates,
        4
      );

    if (
      horizontal.length
      * vertical.length
      >
      best.horizontal.length
      * best.vertical.length
    ) {
      best = {
        horizontal,
        vertical
      };
    }

    if (
      horizontal.length >= 2
      &&
      vertical.length >= 2
    ) {
      break;
    }
  }

  if (
    best.vertical.length < 2
    ||
    best.horizontal.length < 2
    ||
    best.vertical.length > 16
    ||
    best.horizontal.length > 60
  ) {
    return null;
  }

  return {
    ...best,
    method:
      "dark"
  };
}


function normalizeNotebookGridLines(
  values,
  minSpacing
) {
  const result =
    [];

  for (
    const value
    of values
      .slice()
      .sort(
        (a, b) =>
          a - b
      )
  ) {
    if (
      !result.length
      ||
      value
      - result[
          result.length - 1
        ]
      >= minSpacing
    ) {
      result.push(
        value
      );
    } else {
      /*
        Se duas bordas fazem parte da mesma linha grossa,
        usa o ponto médio em vez de manter duas colunas.
      */
      const lastIndex =
        result.length - 1;

      result[
        lastIndex
      ] =
        Math.round(
          (
            result[
              lastIndex
            ]
            + value
          ) / 2
        );
    }
  }

  return result;
}


function detectNotebookTableGrid(
  canvas
) {
  const context =
    canvas.getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
    );

  const width =
    canvas.width;

  const height =
    canvas.height;

  const image =
    context.getImageData(
      0,
      0,
      width,
      height
    );

  const pixels =
    image.data;


  /*
    PRIMEIRA ESCOLHA: bordas por diferença de cor.
    Isso foi feito para tabelas com linhas muito claras,
    fundos azuis/cinzas e cabeçalhos coloridos.
  */
  let grid =
    detectNotebookGridByEdges(
      pixels,
      width,
      height
    );


  /*
    Se a borda é escura e o detector de diferenças não
    conseguiu montar uma grade coerente, usa o método antigo.
  */
  if (
    !grid
  ) {
    grid =
      detectNotebookGridByDarkRuns(
        pixels,
        width,
        height
      );
  }


  if (
    !grid
  ) {
    return null;
  }


  const minVerticalSpacing =
    Math.max(
      9,
      Math.round(
        width * 0.012
      )
    );

  const minHorizontalSpacing =
    Math.max(
      8,
      Math.round(
        height * 0.018
      )
    );


  grid.vertical =
    normalizeNotebookGridLines(
      grid.vertical,
      minVerticalSpacing
    );

  grid.horizontal =
    normalizeNotebookGridLines(
      grid.horizontal,
      minHorizontalSpacing
    );


  if (
    grid.vertical.length < 2
    ||
    grid.horizontal.length < 2
    ||
    grid.vertical.length > 16
    ||
    grid.horizontal.length > 60
  ) {
    return null;
  }


  return grid;
}


function createNotebookTableOcrCanvas(
  source,
  grid = null
) {
  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    source.width;

  canvas.height =
    source.height;

  const sourceContext =
    source.getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
    );

  const targetContext =
    canvas.getContext(
      "2d",
      {
        alpha:
          false,
        willReadFrequently:
          true
      }
    );

  const image =
    sourceContext.getImageData(
      0,
      0,
      source.width,
      source.height
    );

  const data =
    image.data;

  /*
    Contraste forte, mas sem binarização totalmente rígida.
    Preserva letras finas e reduz fundos cinza/coloridos.
  */
  for (
    let index = 0;
    index < data.length;
    index += 4
  ) {
    const luminance =
      (
        data[index] * 0.299
        + data[index + 1] * 0.587
        + data[index + 2] * 0.114
      );

    let value;

    if (
      luminance < 95
    ) {
      value =
        0;
    } else if (
      luminance > 225
    ) {
      value =
        255;
    } else {
      value =
        Math.max(
          0,
          Math.min(
            255,
            Math.round(
              (
                luminance - 95
              )
              * 1.96
            )
          )
        );
    }

    data[index] =
      value;

    data[index + 1] =
      value;

    data[index + 2] =
      value;

    data[index + 3] =
      255;
  }

  targetContext.putImageData(
    image,
    0,
    0
  );

  /*
    Quando existe grade, apagamos as linhas antes do OCR.
    Isso evita o Tesseract confundir bordas com caracteres
    ou quebrar palavras encostadas na célula.
  */
  if (
    grid
  ) {
    targetContext.fillStyle =
      "#ffffff";

    for (
      const x
      of grid.vertical
    ) {
      targetContext.fillRect(
        Math.max(
          0,
          x - 3
        ),
        0,
        7,
        canvas.height
      );
    }

    for (
      const y
      of grid.horizontal
    ) {
      targetContext.fillRect(
        0,
        Math.max(
          0,
          y - 3
        ),
        canvas.width,
        7
      );
    }
  }

  return canvas;
}


function rowsFromNotebookGrid(
  words,
  grid
) {
  if (
    !grid
    ||
    grid.vertical.length < 2
    ||
    grid.horizontal.length < 2
  ) {
    return [];
  }

  const vertical =
    grid.vertical
      .slice()
      .sort(
        (a, b) =>
          a - b
      );

  const horizontal =
    grid.horizontal
      .slice()
      .sort(
        (a, b) =>
          a - b
      );

  const rowCount =
    horizontal.length - 1;

  const colCount =
    vertical.length - 1;

  if (
    rowCount < 1
    ||
    colCount < 1
    ||
    colCount > 15
    ||
    rowCount > 50
  ) {
    return [];
  }

  const buckets =
    Array.from(
      {
        length:
          rowCount
      },
      () =>
        Array.from(
          {
            length:
              colCount
          },
          () => []
        )
    );

  const normalizedWords =
    notebookTableWordData(
      words
    );

  for (
    const word
    of normalizedWords
  ) {
    let rowIndex =
      -1;

    let colIndex =
      -1;

    for (
      let row = 0;
      row < rowCount;
      row += 1
    ) {
      if (
        word.y
        > horizontal[row]
        &&
        word.y
        < horizontal[
            row + 1
          ]
      ) {
        rowIndex =
          row;

        break;
      }
    }

    for (
      let col = 0;
      col < colCount;
      col += 1
    ) {
      if (
        word.x
        > vertical[col]
        &&
        word.x
        < vertical[
            col + 1
          ]
      ) {
        colIndex =
          col;

        break;
      }
    }

    if (
      rowIndex >= 0
      &&
      colIndex >= 0
    ) {
      buckets[
        rowIndex
      ][
        colIndex
      ].push(
        word
      );
    }
  }

  const rows =
    buckets.map(
      cells =>
        cells.map(
          cellWords => {
            if (
              !cellWords.length
            ) {
              return "";
            }

            const lineTolerance =
              Math.max(
                6,
                medianNotebookNumber(
                  cellWords.map(
                    word =>
                      word.height
                  )
                ) * 0.65
              );

            const lines =
              [];

            for (
              const word
              of cellWords
                .slice()
                .sort(
                  (a, b) =>
                    a.y - b.y
                    ||
                    a.x - b.x
                )
            ) {
              let line =
                lines.find(
                  candidate =>
                    Math.abs(
                      candidate.y
                      - word.y
                    )
                    <= lineTolerance
                );

              if (
                !line
              ) {
                line = {
                  y:
                    word.y,
                  words: []
                };

                lines.push(
                  line
                );
              }

              line.words.push(
                word
              );
            }

            return lines
              .sort(
                (a, b) =>
                  a.y - b.y
              )
              .map(
                line =>
                  line.words
                    .sort(
                      (a, b) =>
                        a.x - b.x
                    )
                    .map(
                      word =>
                        word.text
                    )
                    .join(
                      " "
                    )
              )
              .join(
                " "
              )
              .replace(
                /\s+/g,
                " "
              )
              .trim();
          }
        )
    );

  /*
    Remove linhas/colunas completamente vazias, que podem
    aparecer quando há uma borda decorativa fora da tabela.
  */
  let cleaned =
    rows.filter(
      row =>
        row.some(
          cell =>
            String(
              cell
              || ""
            ).trim()
        )
    );

  if (
    !cleaned.length
  ) {
    return [];
  }

  const usedColumns =
    Array(
      colCount
    ).fill(
      false
    );

  cleaned.forEach(
    row =>
      row.forEach(
        (
          cell,
          index
        ) => {
          if (
            String(
              cell
              || ""
            ).trim()
          ) {
            usedColumns[index] =
              true;
          }
        }
      )
  );

  cleaned =
    cleaned.map(
      row =>
        row.filter(
          (
            _cell,
            index
          ) =>
            usedColumns[index]
        )
    );

  return cleaned;
}


function tableRowsFromOcrWords(
  words
) {
  const usable =
    notebookTableWordData(
      words
    );

  if (
    !usable.length
  ) {
    return [];
  }

  const typicalHeight =
    Math.max(
      6,
      medianNotebookNumber(
        usable.map(
          word =>
            word.height
        )
      )
    );

  const rowTolerance =
    Math.max(
      7,
      typicalHeight * 0.72
    );

  const visualRows =
    [];

  for (
    const word
    of usable
      .slice()
      .sort(
        (a, b) =>
          a.y - b.y
          ||
          a.x0 - b.x0
      )
  ) {
    let row =
      visualRows.find(
        candidate =>
          Math.abs(
            candidate.y
            - word.y
          )
          <= rowTolerance
      );

    if (
      !row
    ) {
      row = {
        y:
          word.y,
        words: []
      };

      visualRows.push(
        row
      );
    }

    row.words.push(
      word
    );

    row.y =
      row.words.reduce(
        (
          sum,
          item
        ) =>
          sum + item.y,
        0
      )
      / row.words.length;
  }

  visualRows.forEach(
    row =>
      row.words.sort(
        (a, b) =>
          a.x0 - b.x0
      )
  );

  /*
    Primeiro separamos células de cada linha pelos grandes
    espaços horizontais. Isso é mais confiável que usar cada
    palavra como uma coluna.
  */
  const allPositiveGaps =
    [];

  visualRows.forEach(
    row => {
      for (
        let index = 1;
        index < row.words.length;
        index += 1
      ) {
        const gap =
          row.words[index].x0
          - row.words[
              index - 1
            ].x1;

        if (
          gap > 1
        ) {
          allPositiveGaps.push(
            gap
          );
        }
      }
    }
  );

  const normalWordGap =
    medianNotebookNumber(
      allPositiveGaps
        .filter(
          gap =>
            gap
            <= typicalHeight * 3
        )
    )
    ||
    typicalHeight * 0.6;

  const cellGap =
    Math.max(
      typicalHeight * 2.2,
      normalWordGap * 2.8,
      22
    );

  const segmentedRows =
    visualRows.map(
      row => {
        const segments =
          [];

        let current =
          [];

        row.words.forEach(
          (
            word,
            index
          ) => {
            if (
              index > 0
            ) {
              const previous =
                row.words[
                  index - 1
                ];

              const gap =
                word.x0
                - previous.x1;

              if (
                gap >= cellGap
                &&
                current.length
              ) {
                segments.push(
                  current
                );

                current =
                  [];
              }
            }

            current.push(
              word
            );
          }
        );

        if (
          current.length
        ) {
          segments.push(
            current
          );
        }

        return segments.map(
          segment => ({
            x0:
              Math.min(
                ...segment.map(
                  word =>
                    word.x0
                )
              ),

            x1:
              Math.max(
                ...segment.map(
                  word =>
                    word.x1
                )
              ),

            x:
              (
                Math.min(
                  ...segment.map(
                    word =>
                      word.x0
                  )
                )
                +
                Math.max(
                  ...segment.map(
                    word =>
                      word.x1
                  )
                )
              ) / 2,

            text:
              segment
                .map(
                  word =>
                    word.text
                )
                .join(
                  " "
                )
                .replace(
                  /\s+/g,
                  " "
                )
                .trim()
          })
        );
      }
    )
    .filter(
      segments =>
        segments.length
    );

  if (
    !segmentedRows.length
  ) {
    return [];
  }

  /*
    Número provável de colunas = valor mais recorrente entre
    as linhas, dando preferência às linhas com 2+ células.
  */
  const counts =
    new Map();

  segmentedRows.forEach(
    segments => {
      const count =
        Math.min(
          10,
          segments.length
        );

      counts.set(
        count,
        (
          counts.get(
            count
          )
          || 0
        )
        + 1
      );
    }
  );

  const targetColumns =
    Array.from(
      counts.entries()
    )
      .sort(
        (
          a,
          b
        ) =>
          b[1] - a[1]
          ||
          b[0] - a[0]
      )[0]?.[0]
    || 1;

  /*
    Usa a linha cuja quantidade mais se aproxima do número de
    colunas esperado para definir os centros-base.
  */
  const reference =
    segmentedRows
      .slice()
      .sort(
        (
          a,
          b
        ) =>
          Math.abs(
            a.length
            - targetColumns
          )
          -
          Math.abs(
            b.length
            - targetColumns
          )
          ||
          b.length
          - a.length
      )[0];

  const anchors =
    reference
      .slice(
        0,
        targetColumns
      )
      .map(
        segment =>
          segment.x
      )
      .sort(
        (a, b) =>
          a - b
      );

  if (
    !anchors.length
  ) {
    return [];
  }

  return segmentedRows
    .map(
      segments => {
        const cells =
          Array(
            anchors.length
          ).fill("");

        for (
          const segment
          of segments
        ) {
          let bestIndex =
            0;

          let bestDistance =
            Number.POSITIVE_INFINITY;

          anchors.forEach(
            (
              anchor,
              index
            ) => {
              const distance =
                Math.abs(
                  anchor
                  - segment.x
                );

              if (
                distance
                < bestDistance
              ) {
                bestDistance =
                  distance;

                bestIndex =
                  index;
              }
            }
          );

          cells[
            bestIndex
          ] =
            [
              cells[
                bestIndex
              ],
              segment.text
            ]
              .filter(
                Boolean
              )
              .join(
                " "
              )
              .trim();
        }

        return cells;
      }
    )
    .filter(
      row =>
        row.some(
          cell =>
            String(
              cell
              || ""
            ).trim()
        )
    );
}


function notebookOcrScore(
  result
) {
  const words =
    notebookTableWordData(
      result?.data?.words
      || []
    );

  if (
    !words.length
  ) {
    return 0;
  }

  const averageConfidence =
    words.reduce(
      (
        sum,
        word
      ) =>
        sum
        + Math.max(
            0,
            word.confidence
          ),
      0
    )
    / words.length;

  return (
    words.length * 3
    + averageConfidence
  );
}


async function readNotebookTableImage() {
  const input =
    document.getElementById(
      "notebook-table-image"
    );

  const file =
    input?.files?.[0]
    || null;

  if (!file) {
    setNotebookTableStatus(
      "Selecione uma imagem da tabela.",
      "error"
    );

    return;
  }

  if (
    !window.Tesseract
  ) {
    setNotebookTableStatus(
      "O leitor OCR não carregou. Atualize a página e tente novamente.",
      "error"
    );

    return;
  }

  const button =
    document.getElementById(
      "notebook-table-read-image"
    );

  if (
    button
  ) {
    button.disabled =
      true;
  }

  try {
    setNotebookTableStatus(
      "Preparando a imagem e procurando a grade..."
    );

    const sourceCanvas =
      await prepareNotebookTableCanvas(
        file
      );

    const grid =
      detectNotebookTableGrid(
        sourceCanvas
      );

    const ocrCanvas =
      createNotebookTableOcrCanvas(
        sourceCanvas,
        grid
      );

    setNotebookTableStatus(
      grid
        ? `Grade detectada: ${grid.horizontal.length - 1} linha(s) × ${grid.vertical.length - 1} coluna(s). Lendo o texto...`
        : "Grade sem bordas claras. Lendo o texto e reconstruindo colunas..."
    );

    /*
      Primeira leitura: versão ampliada, com contraste melhorado
      e linhas da grade apagadas.
    */
    const enhancedResult =
      await window.Tesseract
        .recognize(
          ocrCanvas,
          "por"
        );

    let bestResult =
      enhancedResult;

    const enhancedScore =
      notebookOcrScore(
        enhancedResult
      );

    /*
      Segunda passagem somente quando a primeira parece fraca.
      O original ampliado preserva detalhes que um filtro de
      contraste pode eventualmente apagar.
    */
    if (
      enhancedScore < 115
    ) {
      setNotebookTableStatus(
        "Refinando a leitura do texto..."
      );

      const originalResult =
        await window.Tesseract
          .recognize(
            sourceCanvas,
            "por"
          );

      if (
        notebookOcrScore(
          originalResult
        )
        > enhancedScore
      ) {
        bestResult =
          originalResult;
      }
    }

    const words =
      bestResult
        ?.data
        ?.words
      || [];

    let rows =
      grid
        ? rowsFromNotebookGrid(
            words,
            grid
          )
        : [];

    let method =
      rows.length
        ? "grade"
        : "alinhamento";

    /*
      Se a grade foi detectada mas a leitura caiu fora das
      células, usa o reconstruidor sem bordas como fallback.
    */
    if (
      rows.length < 2
    ) {
      rows =
        tableRowsFromOcrWords(
          words
        );

      method =
        "alinhamento";
    }

    if (
      rows.length < 2
    ) {
      rows =
        String(
          bestResult
            ?.data
            ?.text
          || ""
        )
          .split(
            /\n+/
          )
          .map(
            line =>
              line
                .trim()
          )
          .filter(
            Boolean
          )
          .map(
            line =>
              line
                .split(
                  /\t+|\s{3,}/
                )
                .map(
                  cell =>
                    cell.trim()
                )
                .filter(
                  Boolean
                )
          )
          .filter(
            row =>
              row.length
          );

      method =
        "texto";
    }

    if (
      !rows.length
    ) {
      throw new Error(
        "Nenhuma célula foi reconhecida."
      );
    }

    const maxColumns =
      Math.max(
        ...rows.map(
          row =>
            row.length
        )
      );

    const normalizedRows =
      rows.map(
        row => [
          ...row,
          ...Array(
            Math.max(
              0,
              maxColumns
              - row.length
            )
          ).fill("")
        ]
      );

    renderNotebookTableBuilder(
      normalizedRows
    );

    setNotebookTableStatus(
      `Tabela reconhecida por ${method}: ${normalizedRows.length} linha(s) × ${maxColumns} coluna(s). Revise as células antes de inserir.`,
      "success"
    );

  } catch (
    error
  ) {
    console.error(
      error
    );

    setNotebookTableStatus(
      `Não foi possível ler a tabela: ${error.message || "erro desconhecido"}`,
      "error"
    );

  } finally {
    if (
      button
    ) {
      button.disabled =
        false;
    }
  }
}


/* =========================================================
   BLOCOS
   ========================================================= */

function insertStudyBlock(
  type
) {

  const labels = {
    important:
      "★ Importante",

    warning:
      "⚠ Pegadinha de prova",

    memory:
      "🧠 Decore"
  };


  if (
    !labels[type]
  ) {

    return;

  }


  restoreSelection();


  const selected =
    window
      .getSelection()
      ?.toString()
      .trim()
    ||
    "";


  const content =
    selected
      ? escapeHtml(
          selected
        )
      : "Escreva aqui...";


  document.execCommand(
    "insertHTML",
    false,
    `
      <div
        class="notebook-study-block ${type}"
      >
        <strong>
          ${labels[type]}
        </strong>

        <div>
          ${content}
        </div>
      </div>

      <p><br></p>
    `
  );


  saveSelection();


  scheduleSave();

}


/* =========================================================
   EMOJIS
   ========================================================= */

function renderEmojiMenu() {

  const menu =
    document.getElementById(
      "notebook-emoji-menu"
    );


  if (
    !menu
  ) {

    return;

  }


  menu.innerHTML =
    NOTEBOOK_EMOJIS
      .map(
        (emoji) => `
          <button
            class="notebook-emoji-button"
            type="button"
            data-emoji="${emoji}"
            title="Inserir ${emoji}"
          >
            ${emoji}
          </button>
        `
      )
      .join(
        ""
      );


  menu
    .querySelectorAll(
      "[data-emoji]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "mousedown",
          (event) =>
            event.preventDefault()
        );


        button.addEventListener(
          "click",
          () => {

            restoreSelection();


            document.execCommand(
              "insertText",
              false,
              button.dataset.emoji
            );


            saveSelection();


            scheduleSave();


            closeEmojiMenu();

          }
        );

      }
    );

}


function toggleEmojiMenu() {

  const menu =
    document.getElementById(
      "notebook-emoji-menu"
    );


  const toggle =
    document.getElementById(
      "notebook-emoji-toggle"
    );


  if (
    !menu ||
    !toggle ||
    toggle.disabled
  ) {

    return;

  }


  const opening =
    menu.hidden;

  if (
    opening
  ) {
    closeNotebookToolMenus();
  }


  menu.hidden =
    !opening;


  toggle.setAttribute(
    "aria-expanded",
    opening
      ? "true"
      : "false"
  );

}


function closeEmojiMenu() {

  const menu =
    document.getElementById(
      "notebook-emoji-menu"
    );


  const toggle =
    document.getElementById(
      "notebook-emoji-toggle"
    );


  if (
    menu
  ) {

    menu.hidden =
      true;

  }


  if (
    toggle
  ) {

    toggle.setAttribute(
      "aria-expanded",
      "false"
    );

  }

}



/* =========================================================
   MENUS COMPACTOS DA BARRA
   ========================================================= */

function closeNotebookToolMenus(
  except = null
) {
  [
    "list",
    "table",
    "callout"
  ]
    .forEach(
      (name) => {
        if (
          name === except
        ) {
          return;
        }

        const menu =
          document.getElementById(
            `notebook-${name}-menu`
          );

        const toggle =
          document.getElementById(
            `notebook-${name}-toggle`
          );

        if (
          menu
        ) {
          menu.hidden =
            true;
        }

        if (
          toggle
        ) {
          toggle.setAttribute(
            "aria-expanded",
            "false"
          );
        }
      }
    );
}


function toggleNotebookToolMenu(
  name
) {
  const menu =
    document.getElementById(
      `notebook-${name}-menu`
    );

  const toggle =
    document.getElementById(
      `notebook-${name}-toggle`
    );

  if (
    !menu
    || !toggle
    || toggle.disabled
  ) {
    return;
  }

  const opening =
    menu.hidden;

  closeNotebookToolMenus(
    opening
      ? name
      : null
  );

  closeEmojiMenu();

  menu.hidden =
    !opening;

  toggle.setAttribute(
    "aria-expanded",
    opening
      ? "true"
      : "false"
  );
}


/* =========================================================
   BIBLIOTECA
   ========================================================= */

function getLibraryEntries() {

  return Array.from(
    notebookState
      .notesById
      .values()
  )
    .map(
      (note) => {

        const topic =
          note.topic_id
            ? topicById(
                note.topic_id
              )
            : null;


        const isFree =
          !note.topic_id;


        return {
          note,

          topic,

          isFree,

          title:
            topic?.theme
            ||
            note.topic_title
            ||
            "Página sem título",

          area:
            topic?.area
            ||
            note.area
            ||
            (
              isFree
                ? "Página livre"
                : "Sem área"
            ),

          date:
            topicDate(
              topic,
              note
            )
        };

      }
    )
    .sort(
      (
        a,
        b
      ) => {

        const aTime =
          a.date
            ? new Date(
                a.date
              )
                .getTime()
            : 0;


        const bTime =
          b.date
            ? new Date(
                b.date
              )
                .getTime()
            : 0;


        return (
          bTime -
          aTime
        );

      }
    );

}


function filteredLibraryEntries() {

  const query =
    normalizeText(
      notebookState.librarySearch
    );

  const areaFilter =
    normalizeText(
      notebookState.libraryAreaFilter
    );


  return getLibraryEntries()
    .filter(
      (entry) => {

        const matchesSearch =
          !query
          ||
          normalizeText(
            [
              entry.title,
              entry.area,
              formatDate(
                entry.date
              )
            ]
              .join(
                " "
              )
          )
            .includes(
              query
            );

        const matchesArea =
          !areaFilter
          ||
          normalizeText(
            entry.area
          ) ===
          areaFilter;

        return (
          matchesSearch
          &&
          matchesArea
        );

      }
    );

}


function renderLibrary() {

  const list =
    document.getElementById(
      "notebook-library-list"
    );


  if (
    !list
  ) {

    return;

  }


  const entries =
    filteredLibraryEntries();


  if (
    !entries.length
  ) {

    list.innerHTML =
      `
        <div class="notebook-empty-small">
          ${
            notebookState.librarySearch
              ? "Nenhum caderno encontrado."
              : "Sua biblioteca ainda está vazia."
          }
        </div>
      `;


    updateLibraryActions();


    return;

  }


  list.innerHTML =
    entries
      .map(
        (entry) => `
          <div class="notebook-library-row">

            <input
              class="notebook-library-check"
              type="checkbox"
              data-note-id="${escapeHtml(
                entry.note.id
              )}"
              ${
                notebookState
                  .librarySelected
                  .has(
                    entry.note.id
                  )
                  ? "checked"
                  : ""
              }
            >

            <strong>
              ${escapeHtml(
                entry.title
              )}

              ${
                entry.isFree
                  ? `
                    <span class="notebook-free-badge">
                      Livre
                    </span>
                  `
                  : ""
              }
            </strong>

            <span class="notebook-page-area">
              ${escapeHtml(
                entry.area
              )}
            </span>

            <span class="notebook-page-date">
              ${escapeHtml(
                formatDate(
                  entry.date
                )
              )}
            </span>

            <button
              class="notebook-open-button"
              type="button"
              data-open-note="${escapeHtml(
                entry.note.id
              )}"
            >
              Abrir
            </button>

          </div>
        `
      )
      .join(
        ""
      );


  list
    .querySelectorAll(
      "[data-note-id]"
    )
    .forEach(
      (checkbox) => {

        checkbox.addEventListener(
          "change",
          () => {

            const noteId =
              checkbox.dataset
                .noteId;


            if (
              checkbox.checked
            ) {

              notebookState
                .librarySelected
                .add(
                  noteId
                );

            }

            else {

              notebookState
                .librarySelected
                .delete(
                  noteId
                );

            }


            updateLibraryActions();

          }
        );

      }
    );


  list
    .querySelectorAll(
      "[data-open-note]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const note =
              noteById(
                button.dataset
                  .openNote
              );


            if (
              !note
            ) {

              return;

            }


            if (
              note.topic_id
            ) {

              openTopic(
                note.topic_id
              );

            }

            else {

              openFreeNote(
                note.id
              );

            }

          }
        );

      }
    );


  updateLibraryActions();

}


function selectedEntries() {

  return getLibraryEntries()
    .filter(
      (entry) =>
        notebookState
          .librarySelected
          .has(
            entry.note.id
          )
    );

}


function updateLibraryActions() {

  const count =
    notebookState
      .librarySelected
      .size;


  const countElement =
    document.getElementById(
      "notebook-library-selected-count"
    );


  const exportButton =
    document.getElementById(
      "notebook-library-export"
    );


  const deleteButton =
    document.getElementById(
      "notebook-library-delete"
    );


  const selectAll =
    document.getElementById(
      "notebook-library-select-all"
    );


  if (
    countElement
  ) {

    countElement.textContent =
      `${count} selecionado${
        count === 1
          ? ""
          : "s"
      }`;

  }


  if (
    exportButton
  ) {

    exportButton.disabled =
      count === 0;

  }


  if (
    deleteButton
  ) {

    deleteButton.disabled =
      count === 0;

  }


  if (
    selectAll
  ) {

    const visible =
      filteredLibraryEntries();


    const allChecked =
      visible.length > 0
      &&
      visible.every(
        (entry) =>
          notebookState
            .librarySelected
            .has(
              entry.note.id
            )
      );


    const someChecked =
      visible.some(
        (entry) =>
          notebookState
            .librarySelected
            .has(
              entry.note.id
            )
      );


    selectAll.checked =
      allChecked;


    selectAll.indeterminate =
      !allChecked
      &&
      someChecked;

  }

}


/* =========================================================
   PDF
   ========================================================= */

function htmlToPdfBlocks(
  html
) {

  const container =
    document.createElement(
      "div"
    );


  container.innerHTML =
    sanitizeHtml(
      html
    );


  const blocks =
    [];


  function add(
    text,
    type = "text"
  ) {

    const clean =
      String(
        text ||
        ""
      )
        .trim();


    if (
      clean
    ) {

      blocks.push({
        type,
        text:
          clean
      });

    }

  }


  for (
    const child
    of
    Array.from(
      container.children
    )
  ) {

    if (
      child.tagName ===
      "HR"
    ) {

      blocks.push({
        type:
          "divider",

        text:
          ""
      });


      continue;

    }


    if (
      /^H[1-3]$/.test(
        child.tagName
      )
    ) {

      add(
        child.innerText,
        "heading"
      );


      continue;

    }


    if (
      child.tagName ===
      "UL"
      ||
      child.tagName ===
      "OL"
    ) {

      Array.from(
        child.children
      )
        .forEach(
          (
            item,
            index
          ) => {

            const prefix =
              child.tagName ===
              "OL"
                ? `${index + 1}. `
                : "• ";


            add(
              `${prefix}${item.innerText}`
            );

          }
        );


      continue;

    }


    add(
      child.innerText
    );

  }


  return blocks;

}


function writePdfBlock(
  doc,
  block,
  layout
) {

  const margin =
    layout.margin;


  const maxWidth =
    layout.width
    -
    (
      margin * 2
    );


  if (
    block.type ===
    "divider"
  ) {

    if (
      layout.y >
      layout.height
      -
      margin
      -
      8
    ) {

      doc.addPage();


      layout.y =
        margin;

    }


    doc.setDrawColor(
      190
    );


    doc.line(
      margin,
      layout.y,
      layout.width - margin,
      layout.y
    );


    layout.y +=
      8;


    return;

  }


  const heading =
    block.type ===
    "heading";


  const fontSize =
    heading
      ? 13
      : 10;


  const lineHeight =
    heading
      ? 6.5
      : 5.2;


  doc.setFont(
    "helvetica",
    heading
      ? "bold"
      : "normal"
  );


  doc.setFontSize(
    fontSize
  );


  const lines =
    doc.splitTextToSize(
      block.text,
      maxWidth
    );


  for (
    const line
    of
    lines
  ) {

    if (
      layout.y >
      layout.height
      -
      margin
    ) {

      doc.addPage();


      layout.y =
        margin;

    }


    doc.text(
      line,
      margin,
      layout.y
    );


    layout.y +=
      lineHeight;

  }


  layout.y +=
    heading
      ? 2.5
      : 3;

}


async function exportSelectedPdf() {

  const entries =
    selectedEntries();


  if (
    !entries.length
  ) {

    return;

  }


  const jsPDF =
    window.jspdf?.jsPDF;


  if (
    !jsPDF
  ) {

    alert(
      "Não foi possível carregar o exportador de PDF."
    );


    return;

  }


  const doc =
    new jsPDF({
      unit:
        "mm",

      format:
        "a4"
    });


  const layout = {
    margin:
      18,

    width:
      210,

    height:
      297,

    y:
      18
  };


  entries.forEach(
    (
      entry,
      index
    ) => {

      if (
        index >
        0
      ) {

        doc.addPage();


        layout.y =
          layout.margin;

      }


      doc.setFont(
        "helvetica",
        "bold"
      );


      doc.setFontSize(
        17
      );


      const titleLines =
        doc.splitTextToSize(
          entry.title,
          layout.width
          -
          (
            layout.margin * 2
          )
        );


      doc.text(
        titleLines,
        layout.margin,
        layout.y
      );


      layout.y +=
        (
          titleLines.length
          * 7
        )
        +
        2;


      doc.setFont(
        "helvetica",
        "normal"
      );


      doc.setFontSize(
        9
      );


      doc.text(
        `${entry.area} · ${formatDate(
          entry.date
        )}`,
        layout.margin,
        layout.y
      );


      layout.y +=
        10;


      htmlToPdfBlocks(
        entry.note.content_html ||
        ""
      )
        .forEach(
          (block) => {

            writePdfBlock(
              doc,
              block,
              layout
            );

          }
        );

    }
  );


  doc.save(
    "resibulando-cadernos.pdf"
  );

}



/* =========================================================
   MENU DO DOCUMENTO
   ========================================================= */

function toggleDocumentMenu() {
  const menu =
    document.getElementById(
      "notebook-document-menu"
    );

  const toggle =
    document.getElementById(
      "notebook-document-menu-toggle"
    );

  if (
    !menu
    || !toggle
  ) {
    return;
  }

  const opening =
    menu.hidden;

  menu.hidden =
    !opening;

  toggle.setAttribute(
    "aria-expanded",
    opening
      ? "true"
      : "false"
  );
}


function closeDocumentMenu() {
  const menu =
    document.getElementById(
      "notebook-document-menu"
    );

  const toggle =
    document.getElementById(
      "notebook-document-menu-toggle"
    );

  if (
    menu
  ) {
    menu.hidden =
      true;
  }

  if (
    toggle
  ) {
    toggle.setAttribute(
      "aria-expanded",
      "false"
    );
  }
}


async function toggleCurrentDocumentEdit() {
  const current =
    getCurrentDocument();

  if (!current) {
    return;
  }

  if (
    notebookState.editorEditable
  ) {
    clearTimeout(
      notebookState.saveTimer
    );

    await saveCurrentNotebook(
      false
    );

    const savedNoteId =
      getCurrentDocument()
        ?.note
        ?.id
      || null;

    if (
      savedNoteId
    ) {
      notebookState
        .lockedNoteIds
        .add(
          savedNoteId
        );
    }

    setNotebookEditMode(
      false
    );

    return;
  }

  setNotebookEditMode(
    true
  );
}


async function deleteCurrentNotebook() {
  const current =
    getCurrentDocument();

  if (
    !current?.note?.id
  ) {
    alert(
      "Este caderno ainda não possui conteúdo salvo para apagar."
    );

    closeDocumentMenu();

    return;
  }

  const confirmed =
    window.confirm(
      `Apagar "${current.title}"? Esta ação não pode ser desfeita.`
    );

  if (!confirmed) {
    return;
  }

  const noteId =
    current.note.id;

  const topicId =
    current.note.topic_id
    || null;

  const {
    error
  } =
    await notebookSb
      .from(
        "study_notes"
      )
      .delete()
      .eq(
        "id",
        noteId
      )
      .eq(
        "user_id",
        notebookState.user.id
      );

  if (
    error
  ) {
    console.error(
      error
    );

    alert(
      `Não foi possível apagar: ${error.message}`
    );

    return;
  }

  notebookState
    .notesById
    .delete(
      noteId
    );

  if (
    topicId
  ) {
    notebookState
      .notesByTopic
      .delete(
        topicId
      );
  }

  notebookState
    .librarySelected
    .delete(
      noteId
    );

  notebookState.editorEditable =
    false;

  notebookState.editorDirty =
    false;

  closeDocumentMenu();

  /*
    Página de aula: mantém o tema selecionado e volta
    a mostrar um caderno vazio.
    Página livre: fecha o documento apagado.
  */
  if (
    current.type ===
    "free"
  ) {
    notebookState.selectedType =
      null;

    notebookState.selectedNoteId =
      null;

    notebookState.selectedTopicId =
      null;
  }

  renderTopicList();
  renderLibrary();
  renderDocument();
}


function updateLibraryFilterButtonState() {
  const button =
    document.getElementById(
      "notebook-library-filter-toggle"
    );

  if (
    button
  ) {
    button.classList.toggle(
      "active",
      Boolean(
        notebookState.libraryAreaFilter
      )
    );
  }
}


function toggleLibraryFilterMenu() {
  const menu =
    document.getElementById(
      "notebook-library-filter-menu"
    );

  const toggle =
    document.getElementById(
      "notebook-library-filter-toggle"
    );

  if (
    !menu
    || !toggle
  ) {
    return;
  }

  const opening =
    menu.hidden;

  menu.hidden =
    !opening;

  toggle.setAttribute(
    "aria-expanded",
    opening
      ? "true"
      : "false"
  );
}


function closeLibraryFilterMenu() {
  const menu =
    document.getElementById(
      "notebook-library-filter-menu"
    );

  const toggle =
    document.getElementById(
      "notebook-library-filter-toggle"
    );

  if (
    menu
  ) {
    menu.hidden =
      true;
  }

  if (
    toggle
  ) {
    toggle.setAttribute(
      "aria-expanded",
      "false"
    );
  }
}


/* =========================================================
   APAGAR
   ========================================================= */

async function deleteSelectedNotes() {

  const entries =
    selectedEntries();


  if (
    !entries.length
  ) {

    return;

  }


  const confirmed =
    window.confirm(
      `Apagar ${entries.length} caderno${
        entries.length === 1
          ? ""
          : "s"
      }? As aulas do cronograma não serão apagadas.`
    );


  if (
    !confirmed
  ) {

    return;

  }


  const ids =
    entries.map(
      (entry) =>
        entry.note.id
    );


  const currentNoteId =
    getCurrentDocument()
      ?.note
      ?.id
    ||
    null;


  const {
    error
  } =
    await notebookSb
      .from(
        "study_notes"
      )
      .delete()
      .in(
        "id",
        ids
      )
      .eq(
        "user_id",
        notebookState.user.id
      );


  if (
    error
  ) {

    console.error(
      error
    );


    alert(
      `Não foi possível apagar: ${error.message}`
    );


    return;

  }


  entries.forEach(
    (entry) => {

      notebookState
        .notesById
        .delete(
          entry.note.id
        );


      if (
        entry.note.topic_id
      ) {

        notebookState
          .notesByTopic
          .delete(
            entry.note.topic_id
          );

      }

    }
  );


  notebookState
    .librarySelected
    .clear();


  if (
    currentNoteId
    &&
    ids.includes(
      currentNoteId
    )
  ) {

    notebookState.selectedType =
      null;


    notebookState.selectedTopicId =
      null;


    notebookState.selectedNoteId =
      null;


    renderDocument();

  }


  renderTopicList();

  renderLibrary();

}


/* =========================================================
   EVENTOS
   ========================================================= */

function wireEvents() {

  document
    .querySelectorAll(
      "[data-notebook-tab]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            switchView(
              button.dataset
                .notebookTab
            );

          }
        );

      }
    );


  document
    .getElementById(
      "notebook-topic-search"
    )
    ?.addEventListener(
      "input",
      (event) => {

        notebookState.topicSearch =
          event.target.value;


        renderTopicList();

      }
    );


  document
    .getElementById(
      "notebook-filter-toggle"
    )
    ?.addEventListener(
      "click",
      toggleFilterMenu
    );


  document
    .getElementById(
      "notebook-filter-close"
    )
    ?.addEventListener(
      "click",
      closeFilterMenu
    );


  document
    .getElementById(
      "notebook-filter-clear"
    )
    ?.addEventListener(
      "click",
      () => {

        notebookState.topicAreaFilter =
          "";


        const select =
          document.getElementById(
            "notebook-area-filter"
          );


        if (
          select
        ) {

          select.value =
            "";

        }


        updateFilterButtonState();

        renderTopicList();

        closeFilterMenu();

      }
    );


  document
    .getElementById(
      "notebook-filter-apply"
    )
    ?.addEventListener(
      "click",
      () => {

        const select =
          document.getElementById(
            "notebook-area-filter"
          );


        notebookState.topicAreaFilter =
          select?.value ||
          "";


        updateFilterButtonState();

        renderTopicList();

        closeFilterMenu();

      }
    );


  document
    .getElementById(
      "notebook-new-free-page"
    )
    ?.addEventListener(
      "click",
      openFreePageModal
    );


  document
    .getElementById(
      "notebook-free-close"
    )
    ?.addEventListener(
      "click",
      closeFreePageModal
    );


  document
    .getElementById(
      "notebook-free-cancel"
    )
    ?.addEventListener(
      "click",
      closeFreePageModal
    );


  document
    .getElementById(
      "notebook-free-create"
    )
    ?.addEventListener(
      "click",
      createFreePage
    );


  document
    .getElementById(
      "notebook-free-title"
    )
    ?.addEventListener(
      "keydown",
      (event) => {

        if (
          event.key ===
          "Enter"
        ) {

          createFreePage();

        }

      }
    );


  document
    .getElementById(
      "notebook-library-search"
    )
    ?.addEventListener(
      "input",
      (event) => {

        notebookState.librarySearch =
          event.target.value;


        renderLibrary();

      }
    );


  document
    .getElementById(
      "notebook-library-filter-toggle"
    )
    ?.addEventListener(
      "click",
      toggleLibraryFilterMenu
    );


  document
    .getElementById(
      "notebook-library-filter-close"
    )
    ?.addEventListener(
      "click",
      closeLibraryFilterMenu
    );


  document
    .getElementById(
      "notebook-library-filter-clear"
    )
    ?.addEventListener(
      "click",
      () => {
        notebookState.libraryAreaFilter =
          "";

        const select =
          document.getElementById(
            "notebook-library-area-filter"
          );

        if (
          select
        ) {
          select.value =
            "";
        }

        updateLibraryFilterButtonState();
        renderLibrary();
        closeLibraryFilterMenu();
      }
    );


  document
    .getElementById(
      "notebook-library-filter-apply"
    )
    ?.addEventListener(
      "click",
      () => {
        notebookState.libraryAreaFilter =
          document
            .getElementById(
              "notebook-library-area-filter"
            )
            ?.value
          || "";

        updateLibraryFilterButtonState();
        renderLibrary();
        closeLibraryFilterMenu();
      }
    );


  const editor =
    document.getElementById(
      "notebook-editor"
    );


  editor
    ?.addEventListener(
      "input",
      scheduleSave
    );


  editor
    ?.addEventListener(
      "keyup",
      saveSelection
    );


  editor
    ?.addEventListener(
      "mouseup",
      saveSelection
    );


  editor
    ?.addEventListener(
      "focus",
      saveSelection
    );


  editor
    ?.addEventListener(
      "paste",
      (event) => {

        if (
          !notebookState.editorEditable
        ) {
          event.preventDefault();
          return;
        }

        event.preventDefault();


        const html =
          event.clipboardData
            ?.getData(
              "text/html"
            );


        const text =
          event.clipboardData
            ?.getData(
              "text/plain"
            )
          ||
          "";


        if (
          html
        ) {

          document.execCommand(
            "insertHTML",
            false,
            sanitizeHtml(
              html
            )
          );

        }

        else {

          document.execCommand(
            "insertText",
            false,
            text
          );

        }


        scheduleSave();

      }
    );


  document
    .getElementById(
      "notebook-block-style"
    )
    ?.addEventListener(
      "change",
      (event) => {

        execEditorCommand(
          "formatBlock",
          event.target.value ||
          "p"
        );


        event.target.value =
          "p";

      }
    );


  [
    [
      "notebook-bold",
      "bold"
    ],

    [
      "notebook-italic",
      "italic"
    ],

    [
      "notebook-underline",
      "underline"
    ]
  ]
    .forEach(
      (
        [
          id,
          command
        ]
      ) => {

        const button =
          document.getElementById(
            id
          );


        button
          ?.addEventListener(
            "mousedown",
            (event) =>
              event.preventDefault()
          );


        button
          ?.addEventListener(
            "click",
            () =>
              execEditorCommand(
                command
              )
          );

      }
    );


  document
    .getElementById(
      "notebook-text-color"
    )
    ?.addEventListener(
      "input",
      (event) =>
        applyTextColor(
          event.target.value
        )
    );


  document
    .getElementById(
      "notebook-highlight-color"
    )
    ?.addEventListener(
      "input",
      (event) =>
        applyHighlightColor(
          event.target.value
        )
    );


  [
    "list",
    "table",
    "callout"
  ]
    .forEach(
      (name) => {
        const toggle =
          document.getElementById(
            `notebook-${name}-toggle`
          );

        toggle
          ?.addEventListener(
            "mousedown",
            (event) =>
              event.preventDefault()
          );

        toggle
          ?.addEventListener(
            "click",
            (event) => {
              event.stopPropagation();

              saveSelection();

              toggleNotebookToolMenu(
                name
              );
            }
          );
      }
    );


  document
    .querySelectorAll(
      "[data-list-command]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "mousedown",
          (event) =>
            event.preventDefault()
        );

        button.addEventListener(
          "click",
          () => {
            execEditorCommand(
              button.dataset
                .listCommand
            );

            closeNotebookToolMenus();
          }
        );
      }
    );


  document
    .querySelectorAll(
      "[data-table-action]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "mousedown",
          (event) =>
            event.preventDefault()
        );

        button.addEventListener(
          "click",
          () => {
            const mode =
              button.dataset
                .tableAction;

            closeNotebookToolMenus();

            openNotebookTableModal(
              mode
            );
          }
        );
      }
    );


  document
    .getElementById(
      "notebook-table-new"
    )
    ?.addEventListener(
      "click",
      () =>
        renderNotebookTableBuilder()
    );


  document
    .getElementById(
      "notebook-table-add-row"
    )
    ?.addEventListener(
      "click",
      addNotebookTableRow
    );


  document
    .getElementById(
      "notebook-table-remove-row"
    )
    ?.addEventListener(
      "click",
      removeNotebookTableRow
    );


  document
    .getElementById(
      "notebook-table-add-col"
    )
    ?.addEventListener(
      "click",
      addNotebookTableColumn
    );


  document
    .getElementById(
      "notebook-table-remove-col"
    )
    ?.addEventListener(
      "click",
      removeNotebookTableColumn
    );


  document
    .getElementById(
      "notebook-table-read-image"
    )
    ?.addEventListener(
      "click",
      readNotebookTableImage
    );


  document
    .getElementById(
      "notebook-table-insert"
    )
    ?.addEventListener(
      "click",
      insertNotebookTable
    );


  [
    "notebook-table-close",
    "notebook-table-cancel"
  ]
    .forEach(
      id =>
        document
          .getElementById(
            id
          )
          ?.addEventListener(
            "click",
            closeNotebookTableModal
          )
    );


  document
    .getElementById(
      "notebook-document-menu-toggle"
    )
    ?.addEventListener(
      "click",
      (event) => {
        event.stopPropagation();
        toggleDocumentMenu();
      }
    );


  document
    .getElementById(
      "notebook-document-edit"
    )
    ?.addEventListener(
      "click",
      toggleCurrentDocumentEdit
    );


  document
    .getElementById(
      "notebook-document-delete"
    )
    ?.addEventListener(
      "click",
      deleteCurrentNotebook
    );


  const templateButton =
    document.getElementById(
      "notebook-template"
    );


  const breakButton =
    document.getElementById(
      "notebook-break"
    );


  const dividerButton =
    document.getElementById(
      "notebook-divider"
    );


  [
    templateButton,
    breakButton,
    dividerButton
  ]
    .forEach(
      (button) => {

        button
          ?.addEventListener(
            "mousedown",
            (event) =>
              event.preventDefault()
          );

      }
    );


  templateButton
    ?.addEventListener(
      "click",
      insertTemplate
    );


  breakButton
    ?.addEventListener(
      "click",
      insertBreak
    );


  dividerButton
    ?.addEventListener(
      "click",
      insertDivider
    );


  const emojiToggle =
    document.getElementById(
      "notebook-emoji-toggle"
    );


  emojiToggle
    ?.addEventListener(
      "mousedown",
      (event) =>
        event.preventDefault()
    );


  emojiToggle
    ?.addEventListener(
      "click",
      toggleEmojiMenu
    );


  document
    .querySelectorAll(
      "[data-study-block]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "mousedown",
          (event) =>
            event.preventDefault()
        );


        button.addEventListener(
          "click",
          () => {
            insertStudyBlock(
              button.dataset
                .studyBlock
            );

            closeNotebookToolMenus();
          }
        );

      }
    );


  document
    .getElementById(
      "notebook-save-now"
    )
    ?.addEventListener(
      "click",
      async () => {

        clearTimeout(
          notebookState.saveTimer
        );


        await saveCurrentNotebook(
          false
        );


        const savedNoteId =
          getCurrentDocument()
            ?.note
            ?.id
          || null;


        if (
          savedNoteId
        ) {
          notebookState
            .lockedNoteIds
            .add(
              savedNoteId
            );
        }


        setNotebookEditMode(
          false
        );

      }
    );


  document
    .getElementById(
      "notebook-library-select-all"
    )
    ?.addEventListener(
      "change",
      (event) => {

        filteredLibraryEntries()
          .forEach(
            (entry) => {

              if (
                event.target.checked
              ) {

                notebookState
                  .librarySelected
                  .add(
                    entry.note.id
                  );

              }

              else {

                notebookState
                  .librarySelected
                  .delete(
                    entry.note.id
                  );

              }

            }
          );


        renderLibrary();

      }
    );


  document
    .getElementById(
      "notebook-library-export"
    )
    ?.addEventListener(
      "click",
      exportSelectedPdf
    );


  document
    .getElementById(
      "notebook-library-delete"
    )
    ?.addEventListener(
      "click",
      deleteSelectedNotes
    );


  document.addEventListener(
    "click",
    (event) => {

      const emojiWrap =
        document.querySelector(
          ".notebook-emoji-wrap"
        );


      const filterWrap =
        document.querySelector(
          ".notebook-topic-panel .notebook-filter-wrap"
        );

      const libraryFilterWrap =
        document.querySelector(
          ".notebook-library-filter-wrap"
        );

      const documentMenuWrap =
        document.querySelector(
          ".notebook-document-menu-wrap"
        );

      const tableModal =
        document.getElementById(
          "notebook-table-modal"
        );

      const insideToolMenu =
        event.target
          ?.closest
          ?.(
            ".notebook-tool-menu-wrap"
          );


      const freeModal =
        document.getElementById(
          "notebook-free-modal"
        );


      if (
        emojiWrap
        &&
        !emojiWrap.contains(
          event.target
        )
      ) {

        closeEmojiMenu();

      }


      if (
        filterWrap
        &&
        !filterWrap.contains(
          event.target
        )
      ) {

        closeFilterMenu();

      }

      if (
        libraryFilterWrap
        &&
        !libraryFilterWrap.contains(
          event.target
        )
      ) {
        closeLibraryFilterMenu();
      }

      if (
        documentMenuWrap
        &&
        !documentMenuWrap.contains(
          event.target
        )
      ) {
        closeDocumentMenu();
      }

      if (
        !insideToolMenu
      ) {
        closeNotebookToolMenus();
      }

      if (
        tableModal
        &&
        !tableModal.hidden
        &&
        event.target ===
        tableModal
      ) {
        closeNotebookTableModal();
      }


      if (
        freeModal
        &&
        !freeModal.hidden
        &&
        event.target ===
        freeModal
      ) {

        closeFreePageModal();

      }

    }
  );


  document.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key ===
        "Escape"
      ) {

        closeEmojiMenu();

        closeNotebookToolMenus();

        closeFilterMenu();

        closeLibraryFilterMenu();

        closeDocumentMenu();

        closeNotebookTableModal();

        closeFreePageModal();

      }

    }
  );


  document.addEventListener(
    "visibilitychange",
    () => {

      if (
        document.hidden
        &&
        notebookState.activeView ===
        "editor"
        &&
        notebookState.editorDirty
      ) {

        clearTimeout(
          notebookState.saveTimer
        );


        saveCurrentNotebook(
          true
        );

      }

    }
  );

}


/* =========================================================
   DADOS
   ========================================================= */

async function loadData() {

  const userId =
    notebookState.user.id;


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
          "id,user_id,area,materia,theme,scheduled_date,original_date,completed_at,status,created_at"
        )
        .eq(
          "user_id",
          userId
        )
        .order(
          "scheduled_date",
          {
            ascending:
              false,

            nullsFirst:
              false
          }
        )
        .order(
          "created_at",
          {
            ascending:
              false
          }
        ),


      notebookSb
        .from(
          "study_notes"
        )
        .select(
          "id,user_id,topic_id,topic_title,area,materia,content_html,created_at,updated_at"
        )
        .eq(
          "user_id",
          userId
        )
        .order(
          "updated_at",
          {
            ascending:
              false
          }
        )

    ]);


  if (
    topicsResult.error
  ) {

    throw topicsResult.error;

  }


  if (
    notesResult.error
  ) {

    throw notesResult.error;

  }


  notebookState.topics =
    topicsResult.data ||
    [];


  notebookState.notesByTopic =
    new Map(
      (
        notesResult.data ||
        []
      )
        .filter(
          (note) =>
            note.topic_id
        )
        .map(
          (note) => [
            note.topic_id,
            note
          ]
        )
    );


  notebookState.notesById =
    new Map(
      (
        notesResult.data ||
        []
      )
        .map(
          (note) => [
            note.id,
            note
          ]
        )
    );


  populateAreaFilter();

  updateFilterButtonState();

  updateLibraryFilterButtonState();

}


/* =========================================================
   INIT
   ========================================================= */

async function initNotebook() {

  notebookState.user =
    window.docmapUser;


  if (
    !notebookState.user
  ) {

    return;

  }


  renderEmojiMenu();

  wireEvents();

  setEditorEnabled(
    false
  );


  try {

    await loadData();


    renderTopicList();

    renderLibrary();


    const params =
      new URLSearchParams(
        window.location.search
      );


    const requestedTopic =
      params.get(
        "topic_id"
      );


    const requestedNote =
      params.get(
        "note_id"
      );


    const requestedView =
      params.get(
        "view"
      );


    if (
      requestedTopic
      &&
      notebookState.topics.some(
        (topic) =>
          topic.id ===
          requestedTopic
      )
    ) {

      await openTopic(
        requestedTopic
      );


      return;

    }


    if (
      requestedNote
      &&
      noteById(
        requestedNote
      )
      &&
      !noteById(
        requestedNote
      ).topic_id
    ) {

      await openFreeNote(
        requestedNote
      );


      return;

    }


    await switchView(
      requestedView ===
      "library"
        ? "library"
        : "editor",

      true
    );


    renderDocument();

  }

  catch (
    error
  ) {

    console.error(
      error
    );


    setSaveStatus(
      `Erro ao carregar: ${error.message}`,
      "error"
    );


    const topicList =
      document.getElementById(
        "notebook-topic-list"
      );


    const libraryList =
      document.getElementById(
        "notebook-library-list"
      );


    if (
      topicList
    ) {

      topicList.innerHTML =
        `
          <div class="notebook-empty-small">
            Não foi possível carregar os temas.
          </div>
        `;

    }


    if (
      libraryList
    ) {

      libraryList.innerHTML =
        `
          <div class="notebook-empty-small">
            Não foi possível carregar a biblioteca.
          </div>
        `;

    }

  }

}


if (
  window.docmapUser
) {

  initNotebook();

}

else {

  window.addEventListener(
    "docmap:ready",
    initNotebook,
    {
      once:
        true
    }
  );

}