const notebookSb =
  window.supabaseClient;


/* =========================================================
   EMOJIS
   ========================================================= */

const NOTEBOOK_EMOJIS = [
  "⚠️",
  "💡",
  "✅",
  "❌",
  "📌",
  "⭐",
  "🧠",
  "🫀",
  "🫁",
  "💊",
  "🩺",
  "🔬",
  "📚",
  "📝",
  "🔎",
  "➡️",
  "⬆️",
  "⬇️",
  "🔥",
  "🎯",
  "⏱️",
  "📖",
  "🧩",
  "❗"
];


/* =========================================================
   TAGS PERMITIDAS
   ========================================================= */

const NOTEBOOK_ALLOWED_TAGS =
  new Set([
    "P",
    "BR",
    "STRONG",
    "B",
    "EM",
    "I",
    "U",
    "H1",
    "H2",
    "H3",
    "UL",
    "OL",
    "LI",
    "DIV",
    "SPAN",
    "BLOCKQUOTE"
  ]);


/* =========================================================
   ESTADO
   ========================================================= */

const notebookState = {

  user:
    null,

  topics:
    [],

  notes:
    new Map(),

  selectedTopicId:
    null,

  search:
    "",

  saveTimer:
    null,

  saving:
    false,

  savedRange:
    null,

  loadingTopic:
    false

};



/* =========================================================
   UTILIDADES
   ========================================================= */

function notebookEscape(
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



function notebookNormalize(
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



function notebookDateLabel(
  value
) {

  if (!value) {
    return "Sem data";
  }


  const [
    year,
    month,
    day
  ] =
    String(
      value
    )
      .slice(
        0,
        10
      )
      .split(
        "-"
      )
      .map(
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

    return String(
      value
    );

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



function currentNotebookTopic() {

  return notebookState.topics.find(
    (topic) =>
      topic.id ===
      notebookState.selectedTopicId
  ) || null;

}



/* =========================================================
   SANITIZAÇÃO
   ========================================================= */

function sanitizeNotebookHtml(
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


      const tag =
        child.tagName;


      if (
        !NOTEBOOK_ALLOWED_TAGS.has(
          tag
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


      if (
        tag === "DIV" &&
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
   LISTA DE AULAS
   ========================================================= */

function renderNotebookTopicList() {

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


  const search =
    notebookNormalize(
      notebookState.search
    );


  const visible =
    notebookState.topics.filter(
      (topic) => {

        if (!search) {
          return true;
        }


        const haystack =
          notebookNormalize(
            [
              topic.theme,
              topic.materia,
              topic.area
            ]
              .filter(
                Boolean
              )
              .join(
                " "
              )
          );


        return haystack.includes(
          search
        );

      }
    );


  if (count) {

    count.textContent =
      visible.length;

  }


  if (
    !visible.length
  ) {

    list.innerHTML =
      `
        <div class="notebook-empty-small">
          Nenhuma aula encontrada.
        </div>
      `;

    return;

  }


  list.innerHTML =
    visible
      .map(
        (topic) => {

          const note =
            notebookState.notes.get(
              topic.id
            );


          const hasNote =
            Boolean(
              note?.content_html
                ?.trim()
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
              data-notebook-topic="${notebookEscape(
                topic.id
              )}"
            >

              <strong>
                ${notebookEscape(
                  topic.theme ||
                  "Tema sem título"
                )}
              </strong>

              <small>
                ${notebookEscape(
                  [
                    topic.area,
                    topic.materia,
                    notebookDateLabel(
                      topic.scheduled_date
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
                  hasNote
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



/* =========================================================
   ATIVAR / DESATIVAR FERRAMENTAS
   ========================================================= */

function setNotebookToolsEnabled(
  enabled
) {

  [
    "notebook-block-style",
    "notebook-bold",
    "notebook-italic",
    "notebook-underline",
    "notebook-list",
    "notebook-numbered-list",
    "notebook-emoji-toggle",
    "notebook-save-now"
  ]
    .forEach(
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
   RENDERIZAR DOCUMENTO
   ========================================================= */

function renderNotebookDocument() {

  const topic =
    currentNotebookTopic();


  const empty =
    document.getElementById(
      "notebook-empty-state"
    );


  const wrap =
    document.getElementById(
      "notebook-document-wrap"
    );


  const editor =
    document.getElementById(
      "notebook-editor"
    );


  if (!topic) {

    if (empty) {

      empty.hidden =
        false;

    }


    if (wrap) {

      wrap.hidden =
        true;

    }


    setNotebookToolsEnabled(
      false
    );


    setNotebookSaveStatus(
      "Selecione uma aula"
    );


    return;

  }



  if (empty) {

    empty.hidden =
      true;

  }


  if (wrap) {

    wrap.hidden =
      false;

  }


  setNotebookToolsEnabled(
    true
  );



  const title =
    document.getElementById(
      "notebook-document-title"
    );


  const breadcrumb =
    document.getElementById(
      "notebook-document-breadcrumb"
    );


  const meta =
    document.getElementById(
      "notebook-document-meta"
    );



  if (title) {

    title.textContent =
      topic.theme ||
      "Tema sem título";

  }


  if (breadcrumb) {

    breadcrumb.textContent =
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
      ||
      "Caderno de estudos";

  }


  if (meta) {

    meta.textContent =
      [
        notebookDateLabel(
          topic.scheduled_date
        ),

        topic.completed_at
          ? "Aula concluída"
          : null
      ]
        .filter(
          Boolean
        )
        .join(
          " · "
        );

  }



  const note =
    notebookState.notes.get(
      topic.id
    );


  let content =
    sanitizeNotebookHtml(
      note?.content_html ||
      ""
    );



  /*
   * Compatibilidade com o protótipo
   * que salvava no localStorage.
   */
  if (
    !content
  ) {

    try {

      const legacy =
        localStorage.getItem(
          `studyos:caderno:${topic.id}`
        );


      if (legacy) {

        content =
          sanitizeNotebookHtml(
            legacy
          );

      }

    }
    catch {}

  }



  notebookState.loadingTopic =
    true;


  editor.innerHTML =
    content;


  notebookState.loadingTopic =
    false;



  if (note) {

    setNotebookSaveStatus(
      "Salvo",
      "saved"
    );

  }

  else if (content) {

    setNotebookSaveStatus(
      "Rascunho local",
      "saving"
    );

  }

  else {

    setNotebookSaveStatus(
      "Novo caderno"
    );

  }

}



/* =========================================================
   SELECIONAR AULA
   ========================================================= */

async function selectNotebookTopic(
  topicId
) {

  if (!topicId) {
    return;
  }


  if (
    topicId ===
    notebookState.selectedTopicId
  ) {

    return;

  }


  clearTimeout(
    notebookState.saveTimer
  );


  if (
    notebookState.selectedTopicId
  ) {

    await saveCurrentNotebook({
      silent:
        true
    });

  }


  notebookState.selectedTopicId =
    topicId;


  renderNotebookTopicList();


  renderNotebookDocument();



  const url =
    new URL(
      window.location.href
    );


  url.searchParams.set(
    "topic_id",
    topicId
  );


  /*
   * Remove parâmetro do
   * protótipo antigo.
   */
  url.searchParams.delete(
    "aula_id"
  );


  window.history.replaceState(
    {},
    "",
    url
  );


  window.requestAnimationFrame(
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
   SALVAR
   ========================================================= */

async function saveCurrentNotebook({
  silent = false
} = {}) {

  if (
    notebookState.saving ||
    !notebookState.user
  ) {

    return;

  }


  const topic =
    currentNotebookTopic();


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


  notebookState.saving =
    true;


  if (!silent) {

    setNotebookSaveStatus(
      "Salvando...",
      "saving"
    );

  }



  const contentHtml =
    sanitizeNotebookHtml(
      editor.innerHTML
    );


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
      contentHtml

  };


  const existing =
    notebookState.notes.get(
      topic.id
    );


  let result;


  /*
   * Atualiza caso a nota já exista.
   *
   * Assim não dependemos de
   * UNIQUE(user_id, topic_id)
   * para o funcionamento básico.
   */
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
          `
            id,
            user_id,
            topic_id,
            topic_title,
            area,
            materia,
            content_html,
            created_at,
            updated_at
          `
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
          `
            id,
            user_id,
            topic_id,
            topic_title,
            area,
            materia,
            content_html,
            created_at,
            updated_at
          `
        )
        .single();

  }



  notebookState.saving =
    false;



  if (
    result.error
  ) {

    console.error(
      result.error
    );


    setNotebookSaveStatus(
      `Erro: ${result.error.message}`,
      "error"
    );


    return;

  }



  notebookState.notes.set(
    topic.id,
    result.data
  );


  /*
   * Se havia um rascunho da versão
   * local antiga, ele agora pode ser
   * removido.
   */
  try {

    localStorage.removeItem(
      `studyos:caderno:${topic.id}`
    );

  }
  catch {}



  renderNotebookTopicList();


  setNotebookSaveStatus(
    "Salvo",
    "saved"
  );

}



/* =========================================================
   AUTOSAVE
   ========================================================= */

function scheduleNotebookSave() {

  if (
    notebookState.loadingTopic
  ) {

    return;

  }


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
      650
    );

}



/* =========================================================
   SELEÇÃO DO EDITOR
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


  if (!editor) {
    return;
  }


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



/* =========================================================
   COMANDOS DO EDITOR
   ========================================================= */

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



/* =========================================================
   EMOJI
   ========================================================= */

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
    !toggle ||
    toggle.disabled
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
            data-notebook-emoji="${emoji}"
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
          () =>
            insertNotebookEmoji(
              button.dataset
                .notebookEmoji
            )
        );

      }
    );

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


  if (
    !labels[type]
  ) {

    return;

  }


  restoreNotebookSelection();


  const selection =
    window.getSelection();


  let selectedText =
    "";


  if (
    selection
  ) {

    selectedText =
      selection
        .toString()
        .trim();

  }


  const text =
    selectedText
      ? notebookEscape(
          selectedText
        )
      : "Escreva aqui...";


  const html =
    `
      <div
        class="notebook-study-block ${type}"
      >
        <strong>
          ${labels[type]}
        </strong>

        <div>
          ${text}
        </div>
      </div>

      <p><br></p>
    `;


  document.execCommand(
    "insertHTML",
    false,
    html
  );


  saveNotebookSelection();


  scheduleNotebookSave();

}



/* =========================================================
   EDITOR
   ========================================================= */

function wireNotebookEditor() {

  const editor =
    document.getElementById(
      "notebook-editor"
    );


  const blockStyle =
    document.getElementById(
      "notebook-block-style"
    );


  const bold =
    document.getElementById(
      "notebook-bold"
    );


  const italic =
    document.getElementById(
      "notebook-italic"
    );


  const underline =
    document.getElementById(
      "notebook-underline"
    );


  const list =
    document.getElementById(
      "notebook-list"
    );


  const numberedList =
    document.getElementById(
      "notebook-numbered-list"
    );


  const emoji =
    document.getElementById(
      "notebook-emoji-toggle"
    );



  /* =======================================================
     DIGITAÇÃO
     ======================================================= */

  editor?.addEventListener(
    "input",
    () => {

      saveNotebookSelection();


      scheduleNotebookSave();

    }
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



  /* =======================================================
     COLAR TEXTO
     ======================================================= */

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

      }

      else {

        document.execCommand(
          "insertText",
          false,
          text
        );

      }


      saveNotebookSelection();


      scheduleNotebookSave();

    }
  );



  /* =======================================================
     ESTILO
     ======================================================= */

  blockStyle?.addEventListener(
    "change",
    () => {

      const tag =
        blockStyle.value ||
        "p";


      applyNotebookCommand(
        "formatBlock",
        tag
      );


      blockStyle.value =
        "p";

    }
  );



  /*
   * Evita que clicar na toolbar
   * destrua a seleção atual.
   */
  [
    bold,
    italic,
    underline,
    list,
    numberedList,
    emoji
  ]
    .forEach(
      (button) => {

        button?.addEventListener(
          "mousedown",
          (event) =>
            event.preventDefault()
        );

      }
    );



  bold?.addEventListener(
    "click",
    () =>
      applyNotebookCommand(
        "bold"
      )
  );


  italic?.addEventListener(
    "click",
    () =>
      applyNotebookCommand(
        "italic"
      )
  );


  underline?.addEventListener(
    "click",
    () =>
      applyNotebookCommand(
        "underline"
      )
  );


  list?.addEventListener(
    "click",
    () =>
      applyNotebookCommand(
        "insertUnorderedList"
      )
  );


  numberedList?.addEventListener(
    "click",
    () =>
      applyNotebookCommand(
        "insertOrderedList"
      )
  );


  emoji?.addEventListener(
    "click",
    toggleNotebookEmojiMenu
  );



  /* =======================================================
     BLOCOS DE ESTUDO
     ======================================================= */

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



  /* =======================================================
     SALVAR AGORA
     ======================================================= */

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



  /* =======================================================
     PESQUISA
     ======================================================= */

  document
    .getElementById(
      "notebook-topic-search"
    )
    ?.addEventListener(
      "input",
      (event) => {

        notebookState.search =
          event.target.value;


        renderNotebookTopicList();

      }
    );



  /* =======================================================
     FECHAR EMOJIS
     ======================================================= */

  document.addEventListener(
    "click",
    (event) => {

      const wrap =
        document.querySelector(
          ".notebook-emoji-wrap"
        );


      if (
        wrap &&
        !wrap.contains(
          event.target
        )
      ) {

        closeNotebookEmojiMenu();

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

        closeNotebookEmojiMenu();

      }

    }
  );



  /* =======================================================
     TENTAR SALVAR AO SAIR DA ABA
     ======================================================= */

  document.addEventListener(
    "visibilitychange",
    () => {

      if (
        document.hidden &&
        notebookState.selectedTopicId
      ) {

        clearTimeout(
          notebookState.saveTimer
        );


        saveCurrentNotebook({
          silent:
            true
        });

      }

    }
  );

}



/* =========================================================
   CARREGAR DADOS
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
          `
            id,
            user_id,
            area,
            materia,
            theme,
            scheduled_date,
            completed_at,
            status,
            created_at
          `
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
          `
            id,
            user_id,
            topic_id,
            topic_title,
            area,
            materia,
            content_html,
            created_at,
            updated_at
          `
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


  renderNotebookEmojiMenu();


  wireNotebookEditor();


  setNotebookToolsEnabled(
    false
  );


  try {

    await loadNotebookData();


    renderNotebookTopicList();



    const params =
      new URLSearchParams(
        window.location.search
      );


    /*
     * topic_id é o identificador
     * oficial do sistema.
     *
     * aula_id fica apenas por
     * compatibilidade com o
     * protótipo anterior.
     */
    const requested =
      params.get(
        "topic_id"
      )
      ||
      params.get(
        "aula_id"
      );


    const requestedExists =
      notebookState.topics.some(
        (topic) =>
          topic.id ===
          requested
      );



    if (
      requestedExists
    ) {

      notebookState.selectedTopicId =
        requested;

    }

    else if (
      notebookState.topics.length ===
      1
    ) {

      notebookState.selectedTopicId =
        notebookState.topics[0].id;

    }



    renderNotebookTopicList();


    renderNotebookDocument();



    if (
      notebookState.selectedTopicId
    ) {

      const url =
        new URL(
          window.location.href
        );


      url.searchParams.set(
        "topic_id",
        notebookState.selectedTopicId
      );


      url.searchParams.delete(
        "aula_id"
      );


      window.history.replaceState(
        {},
        "",
        url
      );

    }

  }

  catch (
    error
  ) {

    console.error(
      error
    );


    setNotebookSaveStatus(
      `Erro ao carregar: ${error.message}`,
      "error"
    );


    const list =
      document.getElementById(
        "notebook-topic-list"
      );


    if (list) {

      list.innerHTML =
        `
          <div class="notebook-empty-small">
            Não foi possível carregar seus cadernos.
          </div>
        `;

    }

  }

}



/* =========================================================
   APP JÁ CARREGOU?
   ========================================================= */

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