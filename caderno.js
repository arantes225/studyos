const notebookSb = window.supabaseClient;

const NOTEBOOK_TEMPLATE = `
  <h2>Doença</h2>
  <p><br></p>

  <h2>Epidemiologia</h2>
  <p><br></p>

  <h2>Quadro clínico</h2>
  <p><br></p>

  <h2>Diagnóstico</h2>
  <p><br></p>

  <h2>Tratamento</h2>
  <p><br></p>

  <h2>Profilaxia</h2>
  <p><br></p>

  <h2>Observações</h2>
  <p><br></p>
`;

const NOTEBOOK_EMOJIS = [
  "⚠️", "💡", "✅", "❌", "📌", "⭐",
  "🧠", "🫀", "🫁", "💊", "🩺", "🔬",
  "📚", "📝", "🔎", "➡️", "⬆️", "⬇️",
  "🔥", "🎯", "⏱️", "📖", "🧩", "❗"
];

const NOTEBOOK_ALLOWED_TAGS = new Set([
  "P", "BR", "HR", "STRONG", "B", "EM", "I", "U",
  "H1", "H2", "H3", "UL", "OL", "LI",
  "DIV", "SPAN", "BLOCKQUOTE"
]);

const notebookState = {
  user: null,
  topics: [],
  notes: new Map(),
  activeView: "pages",
  selectedTopicId: null,
  editorDirty: false,
  saveTimer: null,
  savedRange: null,
  pagesSearch: "",
  topicSearch: "",
  librarySearch: "",
  librarySelected: new Set(),
  libraryActiveEditor: null,
  librarySavedRange: null
};

function notebookEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function notebookNormalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function notebookDateLabel(value) {
  if (!value) return "Sem data";

  const raw = String(value).slice(0, 10);
  const parts = raw.split("-");

  if (parts.length !== 3) return raw;

  const [year, month, day] = parts.map(Number);
  const date = new Date(year, month - 1, day);

  if (Number.isNaN(date.getTime())) return raw;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function setNotebookSaveStatus(text = "", type = "") {
  const element = document.getElementById("notebook-save-status");
  if (!element) return;

  element.textContent = text;
  element.className = `notebook-save-status ${type}`.trim();
}

function topicById(topicId) {
  return notebookState.topics.find((topic) => topic.id === topicId) || null;
}

function noteByTopicId(topicId) {
  return notebookState.notes.get(topicId) || null;
}

function topicDate(topic, note = null) {
  return topic?.scheduled_date
    || topic?.original_date
    || note?.created_at
    || null;
}

function noteTitle(note, topic) {
  return topic?.theme
    || note?.topic_title
    || "Tema sem título";
}

function noteArea(note, topic) {
  return topic?.area
    || note?.area
    || "Sem área";
}

function sanitizeNotebookHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");

  function clean(node) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.remove();
        continue;
      }

      if (child.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }

      const tag = child.tagName;

      if (!NOTEBOOK_ALLOWED_TAGS.has(tag)) {
        const fragment = document.createDocumentFragment();

        while (child.firstChild) {
          fragment.appendChild(child.firstChild);
        }

        child.replaceWith(fragment);
        clean(node);
        continue;
      }

      let keepClass = "";

      if (
        tag === "DIV"
        && child.classList.contains("notebook-study-block")
      ) {
        if (child.classList.contains("important")) {
          keepClass = "notebook-study-block important";
        } else if (child.classList.contains("warning")) {
          keepClass = "notebook-study-block warning";
        } else if (child.classList.contains("memory")) {
          keepClass = "notebook-study-block memory";
        }
      }

      for (const attribute of Array.from(child.attributes)) {
        child.removeAttribute(attribute.name);
      }

      if (keepClass) {
        child.className = keepClass;
      }

      clean(child);
    }
  }

  clean(template.content);
  return template.innerHTML;
}

function getNotebookEntries() {
  return Array.from(notebookState.notes.values())
    .map((note) => {
      const topic = topicById(note.topic_id);

      return {
        note,
        topic,
        title: noteTitle(note, topic),
        area: noteArea(note, topic),
        date: topicDate(topic, note)
      };
    })
    .sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
}

async function switchNotebookView(view, options = {}) {
  if (
    notebookState.activeView === "editor"
    && view !== "editor"
    && notebookState.editorDirty
  ) {
    await saveCurrentNotebook({ silent: true });
  }

  notebookState.activeView = view;

  document.querySelectorAll("[data-notebook-tab]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.notebookTab === view
    );
  });

  document.querySelectorAll(".notebook-view").forEach((section) => {
    section.hidden = section.id !== `notebook-view-${view}`;
  });

  if (view === "pages") {
    setNotebookSaveStatus("");
    renderNotebookPages();
  }

  if (view === "editor") {
    if (!notebookState.selectedTopicId) {
      setNotebookSaveStatus("");
    } else {
      const note = noteByTopicId(notebookState.selectedTopicId);
      setNotebookSaveStatus(
        note ? "Salvo" : "Novo caderno",
        note ? "saved" : ""
      );
    }
  }

  if (view === "library") {
    setNotebookSaveStatus("");
    renderNotebookLibrary();
  }

  if (!options.keepUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);

    if (view !== "editor") {
      url.searchParams.delete("topic_id");
    }

    window.history.replaceState({}, "", url);
  }
}

/* =========================================================
   PÁGINAS
   ========================================================= */

function renderNotebookPages() {
  const list = document.getElementById("notebook-pages-list");
  if (!list) return;

  const search = notebookNormalize(notebookState.pagesSearch);

  const entries = getNotebookEntries().filter((entry) => {
    if (!search) return true;

    return notebookNormalize([
      entry.title,
      entry.area,
      notebookDateLabel(entry.date)
    ].join(" ")).includes(search);
  });

  if (!entries.length) {
    list.innerHTML = `
      <div class="notebook-empty-small">
        ${search
          ? "Nenhuma página encontrada."
          : "Você ainda não criou nenhum caderno."
        }
      </div>
    `;
    return;
  }

  list.innerHTML = entries.map((entry) => `
    <div class="notebook-page-row">
      <strong>${notebookEscape(entry.title)}</strong>

      <span class="notebook-page-area">
        ${notebookEscape(entry.area)}
      </span>

      <span class="notebook-page-date">
        ${notebookEscape(notebookDateLabel(entry.date))}
      </span>

      <button
        class="notebook-open-button"
        type="button"
        data-open-notebook="${notebookEscape(entry.note.topic_id)}"
      >
        Abrir
      </button>
    </div>
  `).join("");

  list.querySelectorAll("[data-open-notebook]").forEach((button) => {
    button.addEventListener("click", () => {
      openNotebookTopic(button.dataset.openNotebook);
    });
  });
}

/* =========================================================
   BUSCA DE AULAS / EDITOR
   ========================================================= */

function renderTopicSearchResults() {
  const results = document.getElementById(
    "notebook-topic-search-results"
  );

  if (!results) return;

  const search = notebookNormalize(notebookState.topicSearch);

  if (!search) {
    results.hidden = true;
    results.innerHTML = "";
    return;
  }

  const topics = notebookState.topics
    .filter((topic) => {
      const haystack = notebookNormalize([
        topic.theme,
        topic.area,
        topic.materia,
        notebookDateLabel(topicDate(topic))
      ].filter(Boolean).join(" "));

      return haystack.includes(search);
    })
    .slice(0, 15);

  results.hidden = false;

  if (!topics.length) {
    results.innerHTML = `
      <div class="notebook-empty-small">
        Nenhuma aula encontrada.
      </div>
    `;
    return;
  }

  results.innerHTML = topics.map((topic) => {
    const existing = noteByTopicId(topic.id);

    return `
      <button
        class="notebook-search-result"
        type="button"
        data-select-topic="${notebookEscape(topic.id)}"
      >
        <span>
          <strong>
            ${notebookEscape(topic.theme || "Tema sem título")}
          </strong>

          <small>
            ${notebookEscape(
              [topic.area, topic.materia]
                .filter(Boolean)
                .join(" · ")
            )}
          </small>
        </span>

        <span>
          ${
            existing
              ? "Abrir"
              : notebookEscape(
                  notebookDateLabel(topicDate(topic))
                )
          }
        </span>
      </button>
    `;
  }).join("");

  results.querySelectorAll("[data-select-topic]").forEach((button) => {
    button.addEventListener("click", () => {
      openNotebookTopic(button.dataset.selectTopic);
    });
  });
}

async function openNotebookTopic(topicId) {
  const topic = topicById(topicId);

  if (!topic) return;

  if (
    notebookState.selectedTopicId
    && notebookState.selectedTopicId !== topicId
    && notebookState.editorDirty
  ) {
    await saveCurrentNotebook({
      silent: true
    });
  }

  notebookState.selectedTopicId = topicId;
  notebookState.editorDirty = false;

  await switchNotebookView(
    "editor",
    {
      keepUrl: true
    }
  );

  const searchInput =
    document.getElementById(
      "notebook-topic-search"
    );

  const searchResults =
    document.getElementById(
      "notebook-topic-search-results"
    );

  if (searchInput) {
    searchInput.value = "";
  }

  if (searchResults) {
    searchResults.hidden = true;
    searchResults.innerHTML = "";
  }

  notebookState.topicSearch = "";

  const empty =
    document.getElementById(
      "notebook-editor-empty"
    );

  const documentArea =
    document.getElementById(
      "notebook-document-area"
    );

  if (empty) {
    empty.hidden = true;
  }

  if (documentArea) {
    documentArea.hidden = false;
  }

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

  if (title) {
    title.textContent =
      topic.theme ||
      "Tema sem título";
  }

  if (area) {
    area.textContent =
      topic.area ||
      "Sem área";
  }

  if (date) {
    date.textContent =
      notebookDateLabel(
        topicDate(topic)
      );
  }

  const editor =
    document.getElementById(
      "notebook-editor"
    );

  const note =
    noteByTopicId(
      topicId
    );

  if (!editor) return;

  editor.innerHTML =
    sanitizeNotebookHtml(
      note?.content_html ||
      ""
    );

  setNotebookSaveStatus(
    note
      ? "Salvo"
      : "Novo caderno",

    note
      ? "saved"
      : ""
  );

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

  window.history.replaceState(
    {},
    "",
    url
  );

  window.requestAnimationFrame(
    () => {
      editor.focus();
    }
  );
}

/* =========================================================
   SALVAMENTO
   ========================================================= */

async function saveCurrentNotebook({
  silent = false
} = {}) {

  if (
    !notebookState.user ||
    !notebookState.selectedTopicId
  ) {
    return;
  }

  const topic =
    topicById(
      notebookState.selectedTopicId
    );

  const editor =
    document.getElementById(
      "notebook-editor"
    );

  if (
    !topic ||
    !editor
  ) {
    return;
  }

  if (!silent) {
    setNotebookSaveStatus(
      "Salvando...",
      "saving"
    );
  }

  const payload = {
    user_id:
      notebookState.user.id,

    topic_id:
      topic.id,

    topic_title:
      topic.theme ||
      "Tema sem título",

    area:
      topic.area ||
      null,

    materia:
      topic.materia ||
      null,

    content_html:
      sanitizeNotebookHtml(
        editor.innerHTML
      )
  };

  const existing =
    noteByTopicId(
      topic.id
    );

  let result;

  if (existing?.id) {

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
          existing.id
        )
        .eq(
          "user_id",
          notebookState.user.id
        )
        .select(
          "id,user_id,topic_id,topic_title,area,materia,content_html,created_at,updated_at"
        )
        .single();

  } else {

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

  if (result.error) {

    console.error(
      result.error
    );

    setNotebookSaveStatus(
      `Erro ao salvar: ${result.error.message}`,
      "error"
    );

    return;
  }

  notebookState.notes.set(
    topic.id,
    result.data
  );

  notebookState.editorDirty =
    false;

  setNotebookSaveStatus(
    "Salvo",
    "saved"
  );

  renderNotebookPages();
  renderNotebookLibrary();
}

function scheduleNotebookSave() {

  notebookState.editorDirty =
    true;

  clearTimeout(
    notebookState.saveTimer
  );

  setNotebookSaveStatus(
    "Alterações não salvas",
    "saving"
  );

  notebookState.saveTimer =
    window.setTimeout(
      () => {
        saveCurrentNotebook();
      },
      700
    );
}

/* =========================================================
   TOOLBAR DO EDITOR
   ========================================================= */

function saveNotebookSelection() {

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

function restoreNotebookSelection() {

  const editor =
    document.getElementById(
      "notebook-editor"
    );

  if (!editor) return;

  editor.focus();

  if (
    !notebookState.savedRange
  ) {
    return;
  }

  const selection =
    window.getSelection();

  selection.removeAllRanges();

  selection.addRange(
    notebookState.savedRange
  );
}

function applyNotebookCommand(
  command,
  value = null
) {

  restoreNotebookSelection();

  document.execCommand(
    command,
    false,
    value
  );

  saveNotebookSelection();

  scheduleNotebookSave();
}

function insertNotebookEmoji(
  emoji
) {

  restoreNotebookSelection();

  document.execCommand(
    "insertText",
    false,
    emoji
  );

  saveNotebookSelection();

  scheduleNotebookSave();

  closeNotebookEmojiMenu();
}

function closeNotebookEmojiMenu() {

  const menu =
    document.getElementById(
      "notebook-emoji-menu"
    );

  const toggle =
    document.getElementById(
      "notebook-emoji-toggle"
    );

  if (menu) {
    menu.hidden = true;
  }

  if (toggle) {
    toggle.setAttribute(
      "aria-expanded",
      "false"
    );
  }
}

function toggleNotebookEmojiMenu() {

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
    !toggle
  ) {
    return;
  }

  const open =
    menu.hidden;

  menu.hidden =
    !open;

  toggle.setAttribute(
    "aria-expanded",
    open
      ? "true"
      : "false"
  );
}

function renderNotebookEmojiMenu() {

  const menu =
    document.getElementById(
      "notebook-emoji-menu"
    );

  if (!menu) return;

  menu.innerHTML =
    NOTEBOOK_EMOJIS
      .map(
        (emoji) => `
          <button
            class="notebook-emoji-button"
            type="button"
            data-notebook-emoji="${emoji}"
            title="Inserir ${emoji}"
          >
            ${emoji}
          </button>
        `
      )
      .join("");

  menu
    .querySelectorAll(
      "[data-notebook-emoji]"
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
            insertNotebookEmoji(
              button.dataset
                .notebookEmoji
            );
          }
        );
      }
    );
}

/* =========================================================
   BOTÃO + ESTRUTURA
   ========================================================= */

function insertNotebookTemplate() {

  restoreNotebookSelection();

  document.execCommand(
    "insertHTML",
    false,
    NOTEBOOK_TEMPLATE
  );

  saveNotebookSelection();

  scheduleNotebookSave();
}

/* =========================================================
   QUEBRA DE TEXTO
   ========================================================= */

function insertNotebookBreak() {

  restoreNotebookSelection();

  document.execCommand(
    "insertHTML",
    false,
    "<p><br></p><p><br></p>"
  );

  saveNotebookSelection();

  scheduleNotebookSave();
}

/* =========================================================
   LINHA DIVISÓRIA
   ========================================================= */

function insertNotebookDivider() {

  restoreNotebookSelection();

  document.execCommand(
    "insertHTML",
    false,
    '<hr class="notebook-content-divider"><p><br></p>'
  );

  saveNotebookSelection();

  scheduleNotebookSave();
}

/* =========================================================
   BLOCOS IMPORTANTES
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

  if (!labels[type]) {
    return;
  }

  restoreNotebookSelection();

  const selection =
    window.getSelection();

  const selectedText =
    selection
      ?.toString()
      .trim()
    || "";

  const content =
    selectedText
      ? notebookEscape(
          selectedText
        )
      : "Escreva aqui...";

  document.execCommand(
    "insertHTML",
    false,
    `
      <div class="notebook-study-block ${type}">
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

  saveNotebookSelection();

  scheduleNotebookSave();
}

/* =========================================================
   BIBLIOTECA
   ========================================================= */

function filteredLibraryEntries() {

  const search =
    notebookNormalize(
      notebookState.librarySearch
    );

  return getNotebookEntries()
    .filter(
      (entry) => {

        if (!search) {
          return true;
        }

        return notebookNormalize(
          [
            entry.title,
            entry.area,
            notebookDateLabel(
              entry.date
            )
          ].join(" ")
        ).includes(
          search
        );
      }
    );
}

function renderNotebookLibrary() {

  const list =
    document.getElementById(
      "notebook-library-list"
    );

  if (!list) return;

  const entries =
    filteredLibraryEntries();

  if (!entries.length) {

    list.innerHTML = `
      <div class="notebook-empty-small">
        ${
          notebookState.librarySearch
            ? "Nenhum caderno encontrado."
            : "Sua biblioteca ainda está vazia."
        }
      </div>
    `;

  } else {

    list.innerHTML =
      entries
        .map(
          (entry) => `
            <label class="notebook-library-row">

              <input
                class="notebook-library-check"
                type="checkbox"
                value="${notebookEscape(entry.note.id)}"
                data-library-note="${notebookEscape(entry.note.id)}"
                ${
                  notebookState.librarySelected.has(
                    entry.note.id
                  )
                    ? "checked"
                    : ""
                }
              >

              <strong>
                ${notebookEscape(entry.title)}
              </strong>

              <span class="notebook-page-area">
                ${notebookEscape(entry.area)}
              </span>

              <span class="notebook-page-date">
                ${notebookEscape(
                  notebookDateLabel(
                    entry.date
                  )
                )}
              </span>

            </label>
          `
        )
        .join("");

    list
      .querySelectorAll(
        "[data-library-note]"
      )
      .forEach(
        (checkbox) => {

          checkbox.addEventListener(
            "change",
            () => {

              if (
                checkbox.checked
              ) {

                notebookState
                  .librarySelected
                  .add(
                    checkbox.dataset
                      .libraryNote
                  );

              } else {

                notebookState
                  .librarySelected
                  .delete(
                    checkbox.dataset
                      .libraryNote
                  );
              }

              updateLibraryActions();
            }
          );
        }
      );
  }

  updateLibraryActions();
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

  const editButton =
    document.getElementById(
      "notebook-library-edit"
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

  if (countElement) {

    countElement.textContent =
      `${count} selecionado${
        count === 1
          ? ""
          : "s"
      }`;
  }

  [
    editButton,
    exportButton,
    deleteButton
  ].forEach(
    (button) => {

      if (button) {
        button.disabled =
          count === 0;
      }
    }
  );

  if (selectAll) {

    const visible =
      filteredLibraryEntries();

    selectAll.checked =
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

    selectAll.indeterminate =
      !selectAll.checked
      &&
      visible.some(
        (entry) =>
          notebookState
            .librarySelected
            .has(
              entry.note.id
            )
      );
  }
}

function selectedLibraryEntries() {

  return getNotebookEntries()
    .filter(
      (entry) =>
        notebookState
          .librarySelected
          .has(
            entry.note.id
          )
    );
}

function openBatchEditor() {

  const section =
    document.getElementById(
      "notebook-batch-editor"
    );

  const container =
    document.getElementById(
      "notebook-batch-editors"
    );

  if (
    !section ||
    !container
  ) {
    return;
  }

  const entries =
    selectedLibraryEntries();

  if (!entries.length) {
    return;
  }

  container.innerHTML =
    entries
      .map(
        (entry) => `
          <article class="notebook-batch-card">

            <header class="notebook-batch-card-head">

              <strong>
                ${notebookEscape(entry.title)}
              </strong>

              <small>
                ${notebookEscape(entry.area)}
                ·
                ${notebookEscape(
                  notebookDateLabel(
                    entry.date
                  )
                )}
              </small>

            </header>

            <div
              class="notebook-batch-content"
              contenteditable="true"
              spellcheck="true"
              data-batch-editor="${notebookEscape(entry.note.id)}"
            >${sanitizeNotebookHtml(entry.note.content_html || "")}</div>

          </article>
        `
      )
      .join("");

  section.hidden =
    false;

  container
    .querySelectorAll(
      "[data-batch-editor]"
    )
    .forEach(
      (editor) => {

        [
          "focus",
          "keyup",
          "mouseup"
        ].forEach(
          (eventName) => {

            editor.addEventListener(
              eventName,
              () => {
                saveLibrarySelection(
                  editor
                );
              }
            );
          }
        );
      }
    );

  section.scrollIntoView({
    behavior:
      "smooth",

    block:
      "start"
  });
}

function closeBatchEditor() {

  const section =
    document.getElementById(
      "notebook-batch-editor"
    );

  if (section) {
    section.hidden = true;
  }

  notebookState.libraryActiveEditor =
    null;

  notebookState.librarySavedRange =
    null;
}

function saveLibrarySelection(
  editor
) {

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

  notebookState.libraryActiveEditor =
    editor;

  notebookState.librarySavedRange =
    range.cloneRange();
}

function restoreLibrarySelection() {

  const editor =
    notebookState
      .libraryActiveEditor;

  const range =
    notebookState
      .librarySavedRange;

  if (!editor) {
    return false;
  }

  editor.focus();

  if (range) {

    const selection =
      window.getSelection();

    selection.removeAllRanges();

    selection.addRange(
      range
    );
  }

  return true;
}

function applyBatchCommand(
  command,
  value = null
) {

  if (
    !restoreLibrarySelection()
  ) {
    return;
  }

  document.execCommand(
    command,
    false,
    value
  );

  saveLibrarySelection(
    notebookState
      .libraryActiveEditor
  );
}

async function saveBatchEditors() {

  const editors =
    Array.from(
      document.querySelectorAll(
        "[data-batch-editor]"
      )
    );

  if (!editors.length) {
    return;
  }

  const button =
    document.getElementById(
      "notebook-batch-save"
    );

  if (button) {

    button.disabled =
      true;

    button.textContent =
      "Salvando...";
  }

  try {

    for (
      const editor
      of
      editors
    ) {

      const noteId =
        editor.dataset
          .batchEditor;

      const entry =
        getNotebookEntries()
          .find(
            (item) =>
              item.note.id ===
              noteId
          );

      if (!entry) {
        continue;
      }

      const contentHtml =
        sanitizeNotebookHtml(
          editor.innerHTML
        );

      const {
        data,
        error
      } =
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
            noteId
          )
          .eq(
            "user_id",
            notebookState.user.id
          )
          .select(
            "id,user_id,topic_id,topic_title,area,materia,content_html,created_at,updated_at"
          )
          .single();

      if (error) {
        throw error;
      }

      notebookState.notes.set(
        data.topic_id,
        data
      );
    }

    renderNotebookPages();
    renderNotebookLibrary();

    if (button) {
      button.textContent =
        "Salvo";
    }

    window.setTimeout(
      () => {

        if (button) {

          button.textContent =
            "Salvar todos";
        }
      },
      1200
    );

  } catch (error) {

    console.error(
      error
    );

    alert(
      `Não foi possível salvar: ${error.message}`
    );

  } finally {

    if (button) {
      button.disabled = false;
    }
  }
}

function htmlToPdfText(
  html
) {

  const container =
    document.createElement(
      "div"
    );

  container.innerHTML =
    sanitizeNotebookHtml(
      html
    );

  const blocks =
    [];

  for (
    const child
    of
    Array.from(
      container.children
    )
  ) {

    const text =
      child.innerText
        .trim();

    if (!text) {
      continue;
    }

    blocks.push({
      type:
        /^H[1-3]$/.test(
          child.tagName
        )
          ? "heading"
          : "text",

      text
    });
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

  let y =
    layout.y;

  const isHeading =
    block.type ===
    "heading";

  const fontSize =
    isHeading
      ? 13
      : 10;

  const lineHeight =
    isHeading
      ? 6.2
      : 5;

  doc.setFont(
    "helvetica",
    isHeading
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
      y >
      layout.height
      -
      margin
    ) {

      doc.addPage();

      y =
        margin;
    }

    doc.text(
      line,
      margin,
      y
    );

    y +=
      lineHeight;
  }

  y +=
    isHeading
      ? 2
      : 3;

  layout.y =
    y;
}

async function exportSelectedPdf() {

  const entries =
    selectedLibraryEntries();

  if (!entries.length) {
    return;
  }

  const jsPDF =
    window.jspdf?.jsPDF;

  if (!jsPDF) {

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

      doc.text(
        entry.title,
        layout.margin,
        layout.y
      );

      layout.y +=
        8;

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(
        9
      );

      doc.text(
        `${entry.area} · ${notebookDateLabel(entry.date)}`,
        layout.margin,
        layout.y
      );

      layout.y +=
        10;

      const blocks =
        htmlToPdfText(
          entry.note
            .content_html
          || ""
        );

      blocks.forEach(
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

async function deleteSelectedNotes() {

  const entries =
    selectedLibraryEntries();

  if (!entries.length) {
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

  if (!confirmed) {
    return;
  }

  const ids =
    entries.map(
      (entry) =>
        entry.note.id
    );

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

  if (error) {

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

      notebookState.notes.delete(
        entry.note.topic_id
      );
    }
  );

  notebookState.librarySelected.clear();

  closeBatchEditor();

  renderNotebookPages();

  renderNotebookLibrary();
}

/* =========================================================
   EVENTOS
   ========================================================= */

function wireNotebookEvents() {

  document
    .querySelectorAll(
      "[data-notebook-tab]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            switchNotebookView(
              button.dataset
                .notebookTab
            );
          }
        );
      }
    );

  document
    .getElementById(
      "notebook-pages-search"
    )
    ?.addEventListener(
      "input",
      (event) => {

        notebookState.pagesSearch =
          event.target.value;

        renderNotebookPages();
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

        renderTopicSearchResults();
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

        renderNotebookLibrary();
      }
    );

  const editor =
    document.getElementById(
      "notebook-editor"
    );

  editor?.addEventListener(
    "input",
    scheduleNotebookSave
  );

  editor?.addEventListener(
    "keyup",
    saveNotebookSelection
  );

  editor?.addEventListener(
    "mouseup",
    saveNotebookSelection
  );

  editor?.addEventListener(
    "focus",
    saveNotebookSelection
  );

  editor?.addEventListener(
    "paste",
    (event) => {

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
        || "";

      if (html) {

        document.execCommand(
          "insertHTML",
          false,
          sanitizeNotebookHtml(
            html
          )
        );

      } else {

        document.execCommand(
          "insertText",
          false,
          text
        );
      }

      scheduleNotebookSave();
    }
  );

  document
    .getElementById(
      "notebook-block-style"
    )
    ?.addEventListener(
      "change",
      (event) => {

        applyNotebookCommand(
          "formatBlock",
          event.target.value
          ||
          "p"
        );

        event.target.value =
          "p";
      }
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
  ].forEach(
    (button) => {

      button?.addEventListener(
        "mousedown",
        (event) => {

          event.preventDefault();
        }
      );
    }
  );

  templateButton?.addEventListener(
    "click",
    insertNotebookTemplate
  );

  breakButton?.addEventListener(
    "click",
    insertNotebookBreak
  );

  dividerButton?.addEventListener(
    "click",
    insertNotebookDivider
  );

  const toolbarButtons = [
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
  ];

  toolbarButtons.forEach(
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

      button?.addEventListener(
        "mousedown",
        (event) => {

          event.preventDefault();
        }
      );

      button?.addEventListener(
        "click",
        () => {

          applyNotebookCommand(
            command
          );
        }
      );
    }
  );

  document
    .getElementById(
      "notebook-emoji-toggle"
    )
    ?.addEventListener(
      "mousedown",
      (event) =>
        event.preventDefault()
    );

  document
    .getElementById(
      "notebook-emoji-toggle"
    )
    ?.addEventListener(
      "click",
      toggleNotebookEmojiMenu
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
      () => {

        clearTimeout(
          notebookState.saveTimer
        );

        saveCurrentNotebook();
      }
    );

  document.addEventListener(
    "click",
    (event) => {

      const emojiWrap =
        document.querySelector(
          ".notebook-emoji-wrap"
        );

      const searchShell =
        document.querySelector(
          ".notebook-topic-search-shell"
        );

      if (
        emojiWrap
        &&
        !emojiWrap.contains(
          event.target
        )
      ) {
        closeNotebookEmojiMenu();
      }

      if (
        searchShell
        &&
        !searchShell.contains(
          event.target
        )
      ) {

        const results =
          document.getElementById(
            "notebook-topic-search-results"
          );

        if (results) {
          results.hidden = true;
        }
      }
    }
  );

  document
    .getElementById(
      "notebook-library-select-all"
    )
    ?.addEventListener(
      "change",
      (event) => {

        const visible =
          filteredLibraryEntries();

        visible.forEach(
          (entry) => {

            if (
              event.target.checked
            ) {

              notebookState
                .librarySelected
                .add(
                  entry.note.id
                );

            } else {

              notebookState
                .librarySelected
                .delete(
                  entry.note.id
                );
            }
          }
        );

        renderNotebookLibrary();
      }
    );

  document
    .getElementById(
      "notebook-library-edit"
    )
    ?.addEventListener(
      "click",
      openBatchEditor
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

  document
    .getElementById(
      "notebook-batch-close"
    )
    ?.addEventListener(
      "click",
      closeBatchEditor
    );

  document
    .getElementById(
      "notebook-batch-save"
    )
    ?.addEventListener(
      "click",
      saveBatchEditors
    );

  document
    .querySelectorAll(
      "[data-batch-command]"
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

            applyBatchCommand(
              button.dataset
                .batchCommand
            );
          }
        );
      }
    );

  document
    .getElementById(
      "notebook-batch-block-style"
    )
    ?.addEventListener(
      "change",
      (event) => {

        applyBatchCommand(
          "formatBlock",
          event.target.value
          ||
          "p"
        );

        event.target.value =
          "p";
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

        saveCurrentNotebook({
          silent: true
        });
      }
    }
  );
}

/* =========================================================
   DADOS
   ========================================================= */

async function loadNotebookData() {

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
    topicsResult.data
    ||
    [];

  notebookState.notes =
    new Map(
      (
        notesResult.data
        ||
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

  renderNotebookEmojiMenu();

  wireNotebookEvents();

  try {

    await loadNotebookData();

    renderNotebookPages();

    renderNotebookLibrary();

    const params =
      new URLSearchParams(
        window.location.search
      );

    const requestedTopic =
      params.get(
        "topic_id"
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

      await openNotebookTopic(
        requestedTopic
      );

      return;
    }

    const validView =
      [
        "pages",
        "editor",
        "library"
      ].includes(
        requestedView
      )
        ? requestedView
        : "pages";

    await switchNotebookView(
      validView,
      {
        keepUrl:
          true
      }
    );

  } catch (error) {

    console.error(
      error
    );

    setNotebookSaveStatus(
      `Erro ao carregar: ${error.message}`,
      "error"
    );

    const pagesList =
      document.getElementById(
        "notebook-pages-list"
      );

    const libraryList =
      document.getElementById(
        "notebook-library-list"
      );

    if (pagesList) {

      pagesList.innerHTML = `
        <div class="notebook-empty-small">
          Não foi possível carregar seus cadernos.
        </div>
      `;
    }

    if (libraryList) {

      libraryList.innerHTML = `
        <div class="notebook-empty-small">
          Não foi possível carregar sua biblioteca.
        </div>
      `;
    }
  }
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
      once: true
    }
  );
}