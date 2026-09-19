const notebookSb = window.supabaseClient;

const NOTEBOOK_EMOJIS = [
  "⚠️", "💡", "✅", "❌", "📌", "⭐",
  "🧠", "🫀", "🫁", "💊", "🩺", "🔬",
  "📚", "📝", "🔎", "➡️", "⬆️", "⬇️",
  "🔥", "🎯", "⏱️", "📖", "🧩", "❗"
];

const NOTEBOOK_ALLOWED_TAGS = new Set([
  "P", "BR", "STRONG", "B", "EM", "I", "U",
  "H1", "H2", "H3", "UL", "OL", "LI",
  "DIV", "SPAN", "BLOCKQUOTE"
]);

const notebookState = {
  user: null,
  topics: [],
  notes: new Map(),
  selectedTopicId: null,
  search: "",
  saveTimer: null,
  saving: false,
  savedRange: null,
  loadingTopic: false
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
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function setNotebookSaveStatus(text, type = "") {
  const el = document.getElementById("notebook-save-status");
  if (!el) return;
  el.textContent = text;
  el.className = `notebook-save-status ${type}`.trim();
}

function currentNotebookTopic() {
  return notebookState.topics.find(
    (topic) => topic.id === notebookState.selectedTopicId
  ) || null;
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

      const keepPostit =
        tag === "DIV"
        && child.classList.contains("notebook-postit");

      for (const attr of Array.from(child.attributes)) {
        child.removeAttribute(attr.name);
      }

      if (keepPostit) {
        child.className = "notebook-postit";
      }

      clean(child);
    }
  }

  clean(template.content);
  return template.innerHTML;
}

function renderNotebookTopicList() {
  const list = document.getElementById("notebook-topic-list");
  const count = document.getElementById("notebook-topic-count");
  if (!list) return;

  const search = notebookNormalize(notebookState.search);

  const visible = notebookState.topics.filter((topic) => {
    if (!search) return true;
    const haystack = notebookNormalize([
      topic.theme,
      topic.materia,
      topic.area
    ].filter(Boolean).join(" "));
    return haystack.includes(search);
  });

  if (count) {
    count.textContent = visible.length;
  }

  if (!visible.length) {
    list.innerHTML = '<div class="notebook-empty-small">Nenhum tópico encontrado.</div>';
    return;
  }

  list.innerHTML = visible.map((topic) => {
    const note = notebookState.notes.get(topic.id);
    const hasNote = Boolean(note?.content_html && note.content_html.trim());
    const active = topic.id === notebookState.selectedTopicId;

    return `
      <button
        class="notebook-topic-item ${active ? "active" : ""}"
        type="button"
        data-notebook-topic="${notebookEscape(topic.id)}"
      >
        <strong>${notebookEscape(topic.theme || "Tema sem título")}</strong>
        <small>${notebookEscape([topic.area, topic.materia, notebookDateLabel(topic.scheduled_date)].filter(Boolean).join(" · "))}</small>
        <span class="notebook-topic-flags">
          ${hasNote ? '<span class="notebook-topic-flag has-note">com anotações</span>' : ''}
          ${topic.completed_at ? '<span class="notebook-topic-flag completed">concluída</span>' : ''}
        </span>
      </button>
    `;
  }).join("");

  list.querySelectorAll("[data-notebook-topic]").forEach((button) => {
    button.addEventListener("click", () => {
      selectNotebookTopic(button.dataset.notebookTopic);
    });
  });
}

function setNotebookToolsEnabled(enabled) {
  [
    "notebook-block-style",
    "notebook-bold",
    "notebook-emoji-toggle",
    "notebook-postit",
    "notebook-save-now"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !enabled;
  });
}

function renderNotebookDocument() {
  const topic = currentNotebookTopic();
  const empty = document.getElementById("notebook-empty-state");
  const wrap = document.getElementById("notebook-document-wrap");
  const editor = document.getElementById("notebook-editor");

  if (!topic) {
    if (empty) empty.hidden = false;
    if (wrap) wrap.hidden = true;
    setNotebookToolsEnabled(false);
    setNotebookSaveStatus("Selecione uma aula");
    return;
  }

  if (empty) empty.hidden = true;
  if (wrap) wrap.hidden = false;
  setNotebookToolsEnabled(true);

  const title = document.getElementById("notebook-document-title");
  const breadcrumb = document.getElementById("notebook-document-breadcrumb");
  const meta = document.getElementById("notebook-document-meta");

  if (title) title.textContent = topic.theme || "Tema sem título";
  if (breadcrumb) breadcrumb.textContent = topic.area || "Caderno de estudos";
  if (meta) {
    meta.textContent = [
      topic.materia,
      notebookDateLabel(topic.scheduled_date),
      topic.completed_at ? "Aula concluída" : null
    ].filter(Boolean).join(" · ");
  }

  const note = notebookState.notes.get(topic.id);
  const content = sanitizeNotebookHtml(note?.content_html || "");

  notebookState.loadingTopic = true;
  editor.innerHTML = content;
  notebookState.loadingTopic = false;

  setNotebookSaveStatus(
    note ? "Salvo" : "Novo caderno",
    note ? "saved" : ""
  );
}

async function selectNotebookTopic(topicId) {
  if (!topicId || topicId === notebookState.selectedTopicId) return;

  clearTimeout(notebookState.saveTimer);
  if (notebookState.selectedTopicId) {
    await saveCurrentNotebook({ silent: true });
  }

  notebookState.selectedTopicId = topicId;
  renderNotebookTopicList();
  renderNotebookDocument();

  const url = new URL(window.location.href);
  url.searchParams.set("topic_id", topicId);
  window.history.replaceState({}, "", url);

  window.requestAnimationFrame(() => {
    document.getElementById("notebook-editor")?.focus();
  });
}

async function saveCurrentNotebook({ silent = false } = {}) {
  if (notebookState.saving || !notebookState.user) return;
  const topic = currentNotebookTopic();
  const editor = document.getElementById("notebook-editor");
  if (!topic || !editor) return;

  notebookState.saving = true;
  if (!silent) setNotebookSaveStatus("Salvando...", "saving");

  const contentHtml = sanitizeNotebookHtml(editor.innerHTML);

  const payload = {
    user_id: notebookState.user.id,
    topic_id: topic.id,
    topic_title: topic.theme || "Tema sem título",
    area: topic.area || null,
    materia: topic.materia || null,
    content_html: contentHtml
  };

  const { data, error } = await notebookSb
    .from("study_notes")
    .upsert(payload, { onConflict: "user_id,topic_id" })
    .select("id,user_id,topic_id,topic_title,area,materia,content_html,created_at,updated_at")
    .single();

  notebookState.saving = false;

  if (error) {
    console.error(error);
    setNotebookSaveStatus(`Erro ao salvar: ${error.message}`, "error");
    return;
  }

  notebookState.notes.set(topic.id, data);
  renderNotebookTopicList();
  setNotebookSaveStatus("Salvo", "saved");
}

function scheduleNotebookSave() {
  if (notebookState.loadingTopic) return;
  clearTimeout(notebookState.saveTimer);
  setNotebookSaveStatus("Alterações não salvas", "saving");
  notebookState.saveTimer = window.setTimeout(() => {
    saveCurrentNotebook();
  }, 650);
}

function saveNotebookSelection() {
  const editor = document.getElementById("notebook-editor");
  const selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;
  notebookState.savedRange = range.cloneRange();
}

function restoreNotebookSelection() {
  const editor = document.getElementById("notebook-editor");
  if (!editor) return;
  editor.focus();

  if (!notebookState.savedRange) return;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(notebookState.savedRange);
}

function applyNotebookCommand(command, value = null) {
  restoreNotebookSelection();
  document.execCommand(command, false, value);
  saveNotebookSelection();
  scheduleNotebookSave();
}

function insertNotebookEmoji(emoji) {
  restoreNotebookSelection();
  document.execCommand("insertText", false, emoji);
  saveNotebookSelection();
  scheduleNotebookSave();
  closeNotebookEmojiMenu();
}

function insertNotebookPostit() {
  restoreNotebookSelection();
  document.execCommand(
    "insertHTML",
    false,
    '<div class="notebook-postit"><strong>⚠️ Atenção</strong><p>Digite aqui o ponto importante.</p></div><p><br></p>'
  );
  saveNotebookSelection();
  scheduleNotebookSave();
}

function closeNotebookEmojiMenu() {
  const menu = document.getElementById("notebook-emoji-menu");
  const toggle = document.getElementById("notebook-emoji-toggle");
  if (menu) menu.hidden = true;
  if (toggle) toggle.setAttribute("aria-expanded", "false");
}

function toggleNotebookEmojiMenu() {
  const menu = document.getElementById("notebook-emoji-menu");
  const toggle = document.getElementById("notebook-emoji-toggle");
  if (!menu || !toggle || toggle.disabled) return;
  const open = menu.hidden;
  menu.hidden = !open;
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
}

function renderNotebookEmojiMenu() {
  const menu = document.getElementById("notebook-emoji-menu");
  if (!menu) return;

  menu.innerHTML = NOTEBOOK_EMOJIS.map((emoji) => `
    <button
      class="notebook-emoji-button"
      type="button"
      data-notebook-emoji="${emoji}"
      title="Inserir ${emoji}"
    >${emoji}</button>
  `).join("");

  menu.querySelectorAll("[data-notebook-emoji]").forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => insertNotebookEmoji(button.dataset.notebookEmoji));
  });
}

function wireNotebookEditor() {
  const editor = document.getElementById("notebook-editor");
  const style = document.getElementById("notebook-block-style");
  const bold = document.getElementById("notebook-bold");
  const emoji = document.getElementById("notebook-emoji-toggle");
  const postit = document.getElementById("notebook-postit");

  editor?.addEventListener("input", () => {
    saveNotebookSelection();
    scheduleNotebookSave();
  });

  editor?.addEventListener("keyup", saveNotebookSelection);
  editor?.addEventListener("mouseup", saveNotebookSelection);
  editor?.addEventListener("focus", saveNotebookSelection);

  editor?.addEventListener("paste", (event) => {
    event.preventDefault();
    const html = event.clipboardData?.getData("text/html");
    const text = event.clipboardData?.getData("text/plain") || "";

    if (html) {
      document.execCommand("insertHTML", false, sanitizeNotebookHtml(html));
    } else {
      document.execCommand("insertText", false, text);
    }

    scheduleNotebookSave();
  });

  style?.addEventListener("change", () => {
    const tag = style.value || "p";
    applyNotebookCommand("formatBlock", tag);
    style.value = "p";
  });

  [bold, emoji, postit].forEach((button) => {
    button?.addEventListener("mousedown", (event) => event.preventDefault());
  });

  bold?.addEventListener("click", () => applyNotebookCommand("bold"));
  emoji?.addEventListener("click", toggleNotebookEmojiMenu);
  postit?.addEventListener("click", insertNotebookPostit);

  document.getElementById("notebook-save-now")?.addEventListener("click", () => {
    clearTimeout(notebookState.saveTimer);
    saveCurrentNotebook();
  });

  document.getElementById("notebook-topic-search")?.addEventListener("input", (event) => {
    notebookState.search = event.target.value;
    renderNotebookTopicList();
  });

  document.addEventListener("click", (event) => {
    const wrap = document.querySelector(".notebook-emoji-wrap");
    if (wrap && !wrap.contains(event.target)) closeNotebookEmojiMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeNotebookEmojiMenu();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && notebookState.selectedTopicId) {
      clearTimeout(notebookState.saveTimer);
      saveCurrentNotebook({ silent: true });
    }
  });
}

async function loadNotebookData() {
  const [topicsResult, notesResult] = await Promise.all([
    notebookSb
      .from("study_topics")
      .select("id,area,materia,theme,scheduled_date,completed_at,status,created_at")
      .order("scheduled_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),

    notebookSb
      .from("study_notes")
      .select("id,user_id,topic_id,topic_title,area,materia,content_html,created_at,updated_at")
      .order("updated_at", { ascending: false })
  ]);

  if (topicsResult.error) throw topicsResult.error;
  if (notesResult.error) throw notesResult.error;

  notebookState.topics = topicsResult.data || [];
  notebookState.notes = new Map(
    (notesResult.data || [])
      .filter((note) => note.topic_id)
      .map((note) => [note.topic_id, note])
  );
}

async function initNotebook() {
  notebookState.user = window.docmapUser;
  if (!notebookState.user) return;

  renderNotebookEmojiMenu();
  wireNotebookEditor();
  setNotebookToolsEnabled(false);

  try {
    await loadNotebookData();
    renderNotebookTopicList();

    const requested = new URLSearchParams(window.location.search).get("topic_id");
    const requestedExists = notebookState.topics.some((topic) => topic.id === requested);

    if (requestedExists) {
      notebookState.selectedTopicId = requested;
    } else if (notebookState.topics.length === 1) {
      notebookState.selectedTopicId = notebookState.topics[0].id;
    }

    renderNotebookTopicList();
    renderNotebookDocument();

  } catch (error) {
    console.error(error);
    setNotebookSaveStatus(`Não foi possível carregar o caderno: ${error.message}`, "error");
    const list = document.getElementById("notebook-topic-list");
    if (list) {
      list.innerHTML = '<div class="notebook-empty-small">Não foi possível carregar os tópicos.</div>';
    }
  }
}

if (window.docmapUser) {
  initNotebook();
} else {
  window.addEventListener("docmap:ready", initNotebook, { once: true });
}
