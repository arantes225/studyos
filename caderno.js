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
        notebookState.topics
          .map(
            (topic) =>
              String(
                topic.area ||
                ""
              )
                .trim()
          )
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
    "notebook-list",
    "notebook-numbered-list",
    "notebook-template",
    "notebook-break",
    "notebook-divider",
    "notebook-table-manual",
    "notebook-table-reader",
    "notebook-emoji-toggle",
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

  notebookState.editorEditable =
    false;

  setEditorEnabled(
    false
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


function tableRowsFromOcrWords(
  words
) {
  const usable =
    (words || [])
      .filter(
        word =>
          String(
            word.text
            || ""
          ).trim()
          && word.bbox
      )
      .map(
        word => ({
          text:
            String(
              word.text
              || ""
            ).trim(),

          x:
            (
              Number(
                word.bbox.x0
              )
              + Number(
                  word.bbox.x1
                )
            ) / 2,

          y:
            (
              Number(
                word.bbox.y0
              )
              + Number(
                  word.bbox.y1
                )
            ) / 2,

          height:
            Math.max(
              1,
              Number(
                word.bbox.y1
              )
              - Number(
                  word.bbox.y0
                )
            )
        })
      );

  if (!usable.length) {
    return [];
  }

  const rowTolerance =
    Math.max(
      8,
      medianNotebookNumber(
        usable.map(
          item =>
            item.height
        )
      ) * 0.8
    );

  const rows = [];

  for (
    const word
    of usable
      .slice()
      .sort(
        (a, b) =>
          a.y - b.y
      )
  ) {
    let row =
      rows.find(
        candidate =>
          Math.abs(
            candidate.y
            - word.y
          )
          <= rowTolerance
      );

    if (!row) {
      row = {
        y:
          word.y,

        words: []
      };

      rows.push(
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

  rows.forEach(
    row =>
      row.words.sort(
        (a, b) =>
          a.x - b.x
      )
  );

  /*
    Estima as colunas a partir das posições X
    que se repetem entre as linhas.
  */
  const allX =
    usable
      .map(
        item =>
          item.x
      )
      .sort(
        (a, b) =>
          a - b
      );

  const xTolerance =
    Math.max(
      28,
      medianNotebookNumber(
        usable.map(
          item =>
            item.height
        )
      ) * 2.4
    );

  const columns = [];

  for (
    const x
    of allX
  ) {
    let column =
      columns.find(
        candidate =>
          Math.abs(
            candidate.x
            - x
          )
          <= xTolerance
      );

    if (!column) {
      column = {
        x,
        values: []
      };

      columns.push(
        column
      );
    }

    column.values.push(
      x
    );

    column.x =
      column.values.reduce(
        (
          sum,
          value
        ) =>
          sum + value,
        0
      )
      / column.values.length;
  }

  columns.sort(
    (a, b) =>
      a.x - b.x
  );

  /*
    Evita grades absurdamente largas causadas por
    frases corridas. Em tabelas comuns, 2–10 colunas
    cobre praticamente todos os casos.
  */
  const maxColumns =
    Math.min(
      10,
      Math.max(
        1,
        Math.round(
          medianNotebookNumber(
            rows.map(
              row =>
                row.words.length
            )
          )
        )
      )
    );

  let normalizedColumns =
    columns;

  if (
    columns.length > maxColumns
  ) {
    /*
      Fallback mais conservador: usa a linha com
      maior número de palavras como referência.
    */
    const referenceRow =
      rows
        .slice()
        .sort(
          (a, b) =>
            b.words.length
            - a.words.length
        )[0];

    normalizedColumns =
      referenceRow.words
        .slice(
          0,
          maxColumns
        )
        .map(
          word => ({
            x:
              word.x
          })
        );
  }

  return rows
    .map(
      row => {
        const cells =
          Array(
            normalizedColumns.length
          ).fill("");

        for (
          const word
          of row.words
        ) {
          let bestIndex =
            0;

          let bestDistance =
            Number.POSITIVE_INFINITY;

          normalizedColumns
            .forEach(
              (
                column,
                index
              ) => {
                const distance =
                  Math.abs(
                    column.x
                    - word.x
                  );

                if (
                  distance < bestDistance
                ) {
                  bestDistance =
                    distance;

                  bestIndex =
                    index;
                }
              }
            );

          cells[bestIndex] =
            [
              cells[bestIndex],
              word.text
            ]
              .filter(
                Boolean
              )
              .join(
                " "
              );
        }

        return cells;
      }
    )
    .filter(
      row =>
        row.some(
          Boolean
        )
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
      "Lendo a tabela da imagem..."
    );

    const result =
      await window.Tesseract
        .recognize(
          file,
          "por"
        );

    let rows =
      tableRowsFromOcrWords(
        result?.data?.words
        || []
      );

    if (
      rows.length < 2
    ) {
      /*
        Fallback: divide o texto em linhas e tabulações.
      */
      rows =
        String(
          result?.data?.text
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
                  /\t+|\s{2,}/
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
    }

    if (
      !rows.length
    ) {
      throw new Error(
        "Nenhuma célula foi reconhecida."
      );
    }

    renderNotebookTableBuilder(
      rows
    );

    setNotebookTableStatus(
      "Tabela reconhecida. Revise as células antes de inserir.",
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

    if (
      notebookState.editorDirty
    ) {
      await saveCurrentNotebook(
        false
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
    ],

    [
      "notebook-list",
      "insertUnorderedList"
    ],

    [
      "notebook-numbered-list",
      "insertOrderedList"
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


  document
    .getElementById(
      "notebook-table-manual"
    )
    ?.addEventListener(
      "click",
      () =>
        openNotebookTableModal(
          "manual"
        )
    );


  document
    .getElementById(
      "notebook-table-reader"
    )
    ?.addEventListener(
      "click",
      () =>
        openNotebookTableModal(
          "reader"
        )
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
          () =>
            insertStudyBlock(
              button.dataset
                .studyBlock
            )
        );

      }
    );


  document
    .getElementById(
      "notebook-save-now"
    )
    ?.addEventListener(
      "click",
      () => {

        clearTimeout(
          notebookState.saveTimer
        );


        saveCurrentNotebook(
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