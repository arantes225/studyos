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
  "DIV", "SPAN", "BLOCKQUOTE"
]);

const notebookState = {
  user: null,
  topics: [],
  notes: new Map(),
  activeView: "editor",
  selectedTopicId: null,
  topicSearch: "",
  librarySearch: "",
  librarySelected: new Set(),
  editorDirty: false,
  saveTimer: null,
  savedRange: null
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDate(value) {
  if (!value) return "Sem data";

  const raw = String(value).slice(0, 10);
  const parts = raw.split("-");

  if (parts.length !== 3) {
    return raw;
  }

  const [year, month, day] = parts.map(Number);

  const date = new Date(
    year,
    month - 1,
    day
  );

  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  ).format(date);
}

function topicDate(topic, note = null) {
  return (
    topic?.scheduled_date
    || topic?.original_date
    || note?.created_at
    || null
  );
}

function topicById(id) {
  return notebookState.topics.find(
    (topic) => topic.id === id
  ) || null;
}

function noteByTopicId(id) {
  return notebookState.notes.get(id) || null;
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

  element.textContent = text;

  element.className =
    `notebook-save-status ${type}`.trim();
}

/* =========================================================
   SANITIZAÇÃO
   ========================================================= */

function sanitizeHtml(html) {
  const template =
    document.createElement(
      "template"
    );

  template.innerHTML =
    String(html || "");

  function clean(node) {
    for (
      const child
      of
      Array.from(node.childNodes)
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

        child.replaceWith(fragment);

        clean(node);

        continue;
      }

      let keepClass = "";

      if (
        child.tagName === "DIV"
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

      if (keepClass) {
        child.className =
          keepClass;
      }

      clean(child);
    }
  }

  clean(template.content);

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
    view !== "editor"
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
    view === "editor"
  ) {
    renderTopicList();
    renderDocument();
  }

  else if (
    view === "library"
  ) {
    setSaveStatus("");
    renderLibrary();
  }

  if (!keepUrl) {
    const url =
      new URL(
        window.location.href
      );

    url.searchParams.set(
      "view",
      view
    );

    if (
      view !== "editor"
    ) {
      url.searchParams.delete(
        "topic_id"
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

  const topics =
    notebookState.topics.filter(
      (topic) => {
        if (!query) {
          return true;
        }

        return normalizeText(
          [
            topic.theme,
            topic.area,
            topic.materia,
            formatDate(
              topicDate(topic)
            )
          ]
            .filter(Boolean)
            .join(" ")
        ).includes(query);
      }
    );

  if (count) {
    count.textContent =
      topics.length;
  }

  if (
    !topics.length
  ) {
    list.innerHTML = `
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
            topic.id ===
            notebookState.selectedTopicId;

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
                      topicDate(topic)
                    )
                  ]
                    .filter(Boolean)
                    .join(" · ")
                )}
              </small>

              <span class="notebook-topic-flags">

                ${
                  note?.content_html?.trim()
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
      .join("");

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
   ATIVAR / DESATIVAR EDITOR
   ========================================================= */

function setEditorEnabled(
  enabled
) {
  [
    "notebook-block-style",
    "notebook-bold",
    "notebook-italic",
    "notebook-underline",
    "notebook-list",
    "notebook-numbered-list",
    "notebook-template",
    "notebook-break",
    "notebook-divider",
    "notebook-emoji-toggle",
    "notebook-save-now"
  ].forEach(
    (id) => {
      const element =
        document.getElementById(
          id
        );

      if (element) {
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
}

/* =========================================================
   DOCUMENTO
   ========================================================= */

function renderDocument() {
  const topic =
    topicById(
      notebookState.selectedTopicId
    );

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

  if (!topic) {
    if (wrap) {
      wrap.hidden =
        true;
    }

    if (hint) {
      hint.hidden =
        false;
    }

    setEditorEnabled(
      false
    );

    setSaveStatus("");

    return;
  }

  if (wrap) {
    wrap.hidden =
      false;
  }

  if (hint) {
    hint.hidden =
      true;
  }

  setEditorEnabled(
    true
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

  if (title) {
    title.textContent =
      topic.theme ||
      "Tema sem título";
  }

  if (area) {
    area.textContent =
      topic.area ||
      topic.materia ||
      "Sem área";
  }

  if (date) {
    date.textContent =
      formatDate(
        topicDate(topic)
      );
  }

  const note =
    noteByTopicId(
      topic.id
    );

  if (editor) {
    editor.innerHTML =
      sanitizeHtml(
        note?.content_html ||
        ""
      );
  }

  notebookState.editorDirty =
    false;

  notebookState.savedRange =
    null;

  setSaveStatus(
    note
      ? "Salvo"
      : "Novo caderno",

    note
      ? "saved"
      : ""
  );
}

async function openTopic(
  topicId
) {
  if (
    !topicById(topicId)
  ) {
    return;
  }

  if (
    notebookState.selectedTopicId
    &&
    notebookState.selectedTopicId !==
      topicId
    &&
    notebookState.editorDirty
  ) {
    await saveCurrentNotebook(
      true
    );
  }

  notebookState.selectedTopicId =
    topicId;

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

  window.history.replaceState(
    {},
    "",
    url
  );

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

/* =========================================================
   SALVAMENTO
   ========================================================= */

async function saveCurrentNotebook(
  silent = false
) {
  if (
    !notebookState.user
    ||
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
    setSaveStatus(
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
      sanitizeHtml(
        editor.innerHTML
      )
  };

  const existing =
    noteByTopicId(
      topic.id
    );

  let result;

  if (
    existing?.id
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

  notebookState.notes.set(
    topic.id,
    result.data
  );

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
   SELEÇÃO DE TEXTO
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

  if (!editor) {
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

/* =========================================================
   COMANDOS
   ========================================================= */

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

/* =========================================================
   ESTRUTURA
   ========================================================= */

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

/* =========================================================
   QUEBRA
   ========================================================= */

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

/* =========================================================
   LINHA
   ========================================================= */

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
   BLOCOS DE ESTUDO
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

  if (!menu) {
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
      .join("");

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

/* =========================================================
   BIBLIOTECA
   ========================================================= */

function getLibraryEntries() {
  return Array
    .from(
      notebookState.notes.values()
    )
    .map(
      (note) => {
        const topic =
          topicById(
            note.topic_id
          );

        return {
          note,

          topic,

          title:
            topic?.theme
            ||
            note.topic_title
            ||
            "Tema sem título",

          area:
            topic?.area
            ||
            note.area
            ||
            "Sem área",

          date:
            topicDate(
              topic,
              note
            )
        };
      }
    )
    .sort(
      (a, b) => {
        const aTime =
          a.date
            ? new Date(
                a.date
              ).getTime()
            : 0;

        const bTime =
          b.date
            ? new Date(
                b.date
              ).getTime()
            : 0;

        return bTime - aTime;
      }
    );
}

function filteredLibraryEntries() {
  const query =
    normalizeText(
      notebookState.librarySearch
    );

  return getLibraryEntries()
    .filter(
      (entry) => {
        if (!query) {
          return true;
        }

        return normalizeText(
          [
            entry.title,
            entry.area,
            formatDate(
              entry.date
            )
          ].join(" ")
        ).includes(
          query
        );
      }
    );
}

function renderLibrary() {
  const list =
    document.getElementById(
      "notebook-library-list"
    );

  if (!list) {
    return;
  }

  const entries =
    filteredLibraryEntries();

  if (
    !entries.length
  ) {
    list.innerHTML = `
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
                notebookState.librarySelected.has(
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
              data-open-topic="${escapeHtml(
                entry.note.topic_id
              )}"
            >
              Abrir
            </button>

          </div>
        `
      )
      .join("");

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
      "[data-open-topic]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            openTopic(
              button.dataset
                .openTopic
            );
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

  if (countElement) {
    countElement.textContent =
      `${count} selecionado${
        count === 1
          ? ""
          : "s"
      }`;
  }

  if (exportButton) {
    exportButton.disabled =
      count === 0;
  }

  if (deleteButton) {
    deleteButton.disabled =
      count === 0;
  }

  if (selectAll) {
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

  const blocks = [];

  function add(
    text,
    type = "text"
  ) {
    const clean =
      String(
        text || ""
      ).trim();

    if (clean) {
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
      Array
        .from(
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
        + 2;

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
   APAGAR CADERNOS
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
      notebookState
        .notes
        .delete(
          entry.note.topic_id
        );
    }
  );

  notebookState
    .librarySelected
    .clear();

  if (
    entries.some(
      (entry) =>
        entry.note.topic_id ===
        notebookState.selectedTopicId
    )
  ) {
    notebookState.selectedTopicId =
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

  const editor =
    document.getElementById(
      "notebook-editor"
    );

  editor?.addEventListener(
    "input",
    scheduleSave
  );

  editor?.addEventListener(
    "keyup",
    saveSelection
  );

  editor?.addEventListener(
    "mouseup",
    saveSelection
  );

  editor?.addEventListener(
    "focus",
    saveSelection
  );

  editor?.addEventListener(
    "paste",
    (event) => {
      event.preventDefault();

      const html =
        event
          .clipboardData
          ?.getData(
            "text/html"
          );

      const text =
        event
          .clipboardData
          ?.getData(
            "text/plain"
          )
        ||
        "";

      if (html) {
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
            () => {
              execEditorCommand(
                command
              );
            }
          );
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

        saveCurrentNotebook(
          false
        );
      }
    );

  document.addEventListener(
    "click",
    (event) => {
      const emojiWrap =
        document.querySelector(
          ".notebook-emoji-wrap"
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
   CARREGAR SUPABASE
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

  notebookState.notes =
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
}

/* =========================================================
   INICIAR
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

    if (topicList) {
      topicList.innerHTML = `
        <div class="notebook-empty-small">
          Não foi possível carregar os temas.
        </div>
      `;
    }

    if (libraryList) {
      libraryList.innerHTML = `
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