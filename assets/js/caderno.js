const notebookSb = window.supabaseClient;

const NOTEBOOK_TEMPLATES = {
  disease: `
    <h2>Doença</h2><p><br></p>
    <h2>Epidemiologia</h2><p><br></p>
    <h2>Fatores de risco</h2><p><br></p>
    <h2>Fisiopatologia</h2><p><br></p>
    <h2>Quadro clínico</h2><p><br></p>
    <h2>Diagnóstico</h2><p><br></p>
    <h2>Tratamento</h2><p><br></p>
    <h2>Profilaxia</h2><p><br></p>
    <h2>Complicações</h2><p><br></p>
    <h2>Observações</h2><p><br></p>
  `,

  "illness-script": `
    <h2>Condições predisponentes</h2><p><br></p>
    <h2>Mecanismo / fisiopatologia</h2><p><br></p>
    <h2>Consequências clínicas</h2><p><br></p>
    <h2>Pistas-chave</h2><p><br></p>
    <h2>Achados que afastam</h2><p><br></p>
    <h2>Diagnósticos diferenciais</h2><p><br></p>
    <h2>Confirmação diagnóstica</h2><p><br></p>
    <h2>Conduta inicial</h2><p><br></p>
  `,

  "clinical-reasoning": `
    <h2>Representação do problema</h2><p><br></p>
    <h2>Hipóteses diagnósticas</h2><p><br></p>
    <h2>Achados a favor</h2><p><br></p>
    <h2>Achados contra</h2><p><br></p>
    <h2>Exames que mudam a conduta</h2><p><br></p>
    <h2>Red flags</h2><p><br></p>
    <h2>Conduta</h2><p><br></p>
    <h2>Ponto de aprendizagem</h2><p><br></p>
  `,

  soap: `
    <h2>Subjetivo</h2><p><br></p>
    <h2>Objetivo</h2><p><br></p>
    <h2>Avaliação</h2><p><br></p>
    <h2>Plano</h2><p><br></p>
  `,

  "rapid-review": `
    <h2>Definição em uma frase</h2><p><br></p>
    <h2>Clássico de prova</h2><p><br></p>
    <h2>Diagnóstico</h2><p><br></p>
    <h2>Conduta</h2><p><br></p>
    <h2>Pegadinhas</h2><p><br></p>
    <h2>Red flags</h2><p><br></p>
    <h2>Resumo final</h2><p><br></p>
  `
};

const NOTEBOOK_EMOJIS = [
  "⚠️", "💡", "✅", "❌", "📌", "⭐",
  "🧠", "🫀", "🫁", "💊", "🩺", "🔬",
  "📚", "📝", "🔎", "➡️", "⬆️", "⬇️",
  "🔥", "🎯", "⏱️", "📖", "🧩", "❗"
];

const ALLOWED_TAGS = new Set([
  "P", "BR", "HR", "STRONG", "B", "EM", "I", "U",
  "H1", "H2", "H3", "UL", "OL", "LI",
  "DIV", "SPAN", "BLOCKQUOTE", "IMG",
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
    null,

  topicPanelCollapsed:
    false,

  sharedMemberships:
    new Map(),

  overlays:
    new Map()
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


function notebookTopicPanelKey() {
  return notebookState.user?.id
    ? `luria:notebook-topic-panel:${notebookState.user.id}`
    : "luria:notebook-topic-panel";
}


function applyNotebookTopicPanelState(
  collapsed,
  persist = true
) {
  notebookState.topicPanelCollapsed =
    Boolean(
      collapsed
    );


  const workspace =
    document.querySelector(
      ".notebook-workspace"
    );


  const panel =
    document.querySelector(
      ".notebook-topic-panel"
    );


  const button =
    document.getElementById(
      "notebook-topic-panel-toggle"
    );


  workspace
    ?.classList
    .toggle(
      "topic-panel-collapsed",
      notebookState.topicPanelCollapsed
    );


  panel
    ?.classList
    .toggle(
      "is-collapsed",
      notebookState.topicPanelCollapsed
    );


  if (
    button
  ) {
    const arrow =
      button.querySelector(
        "#notebook-topic-panel-arrow"
      );

    if (arrow) {
      arrow.textContent =
        notebookState.topicPanelCollapsed
          ? "›"
          : "‹";
    }


    button.setAttribute(
      "aria-expanded",
      notebookState.topicPanelCollapsed
        ? "false"
        : "true"
    );


    button.setAttribute(
      "aria-label",
      notebookState.topicPanelCollapsed
        ? "Abrir lista de temas"
        : "Recolher lista de temas"
    );


    button.title =
      notebookState.topicPanelCollapsed
        ? "Abrir lista de temas"
        : "Recolher lista de temas";
  }


  if (
    persist
  ) {
    try {
      localStorage.setItem(
        notebookTopicPanelKey(),
        notebookState.topicPanelCollapsed
          ? "1"
          : "0"
      );
    } catch {}
  }
}


function initNotebookTopicPanelState() {
  let collapsed =
    false;


  try {
    collapsed =
      localStorage.getItem(
        notebookTopicPanelKey()
      ) === "1";
  } catch {}


  applyNotebookTopicPanelState(
    collapsed,
    false
  );
}


function toggleNotebookTopicPanel() {
  applyNotebookTopicPanelState(
    !notebookState.topicPanelCollapsed
  );
}


async function notebookHashText(value) {
  try {
    const data =
      new TextEncoder()
        .encode(
          String(value || "")
        );

    const digest =
      await crypto.subtle.digest(
        "SHA-256",
        data
      );

    return Array.from(
      new Uint8Array(digest)
    )
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

function sharedMembershipFor(noteId) {
  return notebookState.sharedMemberships.get(noteId) || null;
}

function sharedOverlayFor(noteId) {
  return notebookState.overlays.get(noteId) || null;
}

function applySharedNotebookPatch(note) {
  const base =
    String(
      note?.content_html
      || ""
    );

  const overlay =
    sharedOverlayFor(
      note?.id
    );

  if (
    !overlay?.patch_text
    || typeof window.diff_match_patch !== "function"
  ) {
    return base;
  }

  try {
    const dmp =
      new window.diff_match_patch();

    const patches =
      dmp.patch_fromText(
        overlay.patch_text
      );

    const [
      result
    ] =
      dmp.patch_apply(
        patches,
        base
      );

    return result;
  } catch (error) {
    console.warn(
      "Não foi possível reaplicar a personalização do caderno:",
      error
    );

    return base;
  }
}

async function saveSharedNotebookOverlay(
  note,
  personalizedHtml
) {
  const membership =
    sharedMembershipFor(
      note.id
    );

  if (
    !membership
    || membership.mode !== "overlay"
  ) {
    throw new Error(
      "Este material compartilhado está somente para leitura."
    );
  }

  if (
    typeof window.diff_match_patch !== "function"
  ) {
    throw new Error(
      "O mecanismo de personalização não carregou."
    );
  }

  const base =
    String(
      note.content_html
      || ""
    );

  const dmp =
    new window.diff_match_patch();

  const patchText =
    dmp.patch_toText(
      dmp.patch_make(
        base,
        personalizedHtml
      )
    );

  const baseHash =
    await notebookHashText(
      base
    );

  const payload = {
    note_id:
      note.id,

    user_id:
      notebookState.user.id,

    share_id:
      membership.share_id,

    patch_text:
      patchText,

    base_hash:
      baseHash,

    updated_at:
      new Date()
        .toISOString()
  };

  const {
    data,
    error
  } =
    await notebookSb
      .from(
        "study_note_overlays"
      )
      .upsert(
        payload,
        {
          onConflict:
            "note_id,user_id"
        }
      )
      .select(
        "note_id,user_id,share_id,patch_text,base_hash,updated_at"
      )
      .single();

  if (error) {
    throw error;
  }

  notebookState.overlays.set(
    note.id,
    data
  );

  return data;
}

async function createNotebookShareLink(
  noteId
) {
  const note =
    noteById(
      noteId
    );

  if (
    !note
    || note.is_shared
  ) {
    return;
  }

  const {
    data,
    error
  } =
    await notebookSb.rpc(
      "create_study_note_share",
      {
        p_note_id:
          noteId
      }
    );

  if (error) {
    console.error(error);
    alert(
      `Não foi possível compartilhar: ${error.message}`
    );
    return;
  }

  const url =
    new URL(
      "/caderno/",
      window.location.origin
    );

  url.searchParams.set(
    "share",
    data
  );

  try {
    await navigator.clipboard
      .writeText(
        url.toString()
      );

    setSaveStatus(
      "Link de compartilhamento copiado",
      "saved"
    );
  } catch {
    window.prompt(
      "Copie o link do material:",
      url.toString()
    );
  }
}

async function notebookDataImageBlob(
  dataUrl
) {
  const response =
    await fetch(
      dataUrl
    );

  return response.blob();
}


function notebookImageExtension(
  mimeType
) {
  const mime =
    String(
      mimeType
      || ""
    )
      .toLowerCase();

  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";

  return "jpg";
}


async function syncNotebookImageRefsFromHtml(
  noteId,
  html
) {
  if (!noteId) {
    return;
  }

  const host =
    document.createElement(
      "div"
    );

  host.innerHTML =
    String(
      html
      || ""
    );

  const assetIds =
    Array.from(
      host.querySelectorAll(
        "img[data-luria-asset-id]"
      )
    )
      .map(
        image =>
          String(
            image.getAttribute(
              "data-luria-asset-id"
            )
            || ""
          )
      )
      .filter(
        value =>
          /^[0-9a-f-]{36}$/i
            .test(
              value
            )
      );

  const {
    data:
      orphanPaths,
    error
  } =
    await notebookSb.rpc(
      "sync_study_note_image_refs",
      {
        p_note_id:
          noteId,

        p_asset_ids:
          assetIds
      }
    );

  if (error) {
    throw error;
  }

  if (
    Array.isArray(
      orphanPaths
    )
    &&
    orphanPaths.length
  ) {
    const {
      error:
        removeError
    } =
      await notebookSb
        .storage
        .from(
          "docmap-assets"
        )
        .remove(
          orphanPaths
        );

    if (
      removeError
    ) {
      console.warn(
        "Não foi possível limpar imagens sem referência:",
        removeError
      );
      return;
    }

    const {
      error:
        cleanupError
    } =
      await notebookSb.rpc(
        "delete_orphan_study_note_assets",
        {
          p_paths:
            orphanPaths
        }
      );

    if (
      cleanupError
    ) {
      console.warn(
        "Não foi possível limpar metadados de imagens:",
        cleanupError
      );
    }
  }
}


async function materializeNotebookImagesForShare(
  note
) {
  if (
    !note?.id
    ||
    note.is_shared
  ) {
    return note;
  }

  const host =
    document.createElement(
      "div"
    );

  host.innerHTML =
    String(
      note.content_html
      || ""
    );

  const images =
    Array.from(
      host.querySelectorAll(
        "img"
      )
    );

  const assetIds =
    [];

  let changed =
    false;

  for (
    const image
    of images
  ) {
    const existingId =
      String(
        image.getAttribute(
          "data-luria-asset-id"
        )
        || ""
      );

    if (
      /^[0-9a-f-]{36}$/i
        .test(
          existingId
        )
    ) {
      assetIds.push(
        existingId
      );

      continue;
    }

    const src =
      String(
        image.getAttribute(
          "src"
        )
        || ""
      );

    if (
      !/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/i
        .test(
          src
        )
    ) {
      continue;
    }

    const hash =
      await notebookHashText(
        src
      );

    if (!hash) {
      continue;
    }

    const blob =
      await notebookDataImageBlob(
        src
      );

    const mimeType =
      blob.type
      || "image/jpeg";

    const extension =
      notebookImageExtension(
        mimeType
      );

    const storagePath =
      `notebook-assets/${hash}.${extension}`;

    const uploadResult =
      await notebookSb
        .storage
        .from(
          "docmap-assets"
        )
        .upload(
          storagePath,
          blob,
          {
            upsert:
              false,

            contentType:
              mimeType,

            cacheControl:
              "31536000"
          }
        );

    if (
      uploadResult.error
      &&
      !/already exists|duplicate|409/i
        .test(
          String(
            uploadResult.error.message
            || ""
          )
        )
    ) {
      throw uploadResult.error;
    }

    const publicUrl =
      notebookSb
        .storage
        .from(
          "docmap-assets"
        )
        .getPublicUrl(
          storagePath
        )
        .data
        .publicUrl;

    const {
      data:
        assetId,
      error:
        assetError
    } =
      await notebookSb.rpc(
        "register_study_note_image_asset",
        {
          p_note_id:
            note.id,

          p_hash:
            hash,

          p_storage_path:
            storagePath,

          p_mime_type:
            mimeType
        }
      );

    if (assetError) {
      throw assetError;
    }

    image.setAttribute(
      "src",
      publicUrl
    );

    image.setAttribute(
      "data-luria-asset-id",
      assetId
    );

    assetIds.push(
      assetId
    );

    changed =
      true;
  }

  const normalizedHtml =
    sanitizeHtml(
      host.innerHTML
    );

  if (changed) {
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
            normalizedHtml
        })
        .eq(
          "id",
          note.id
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

    Object.assign(
      note,
      data
    );
  }

  const {
    error:
      syncError
  } =
    await notebookSb.rpc(
      "sync_study_note_image_refs",
      {
        p_note_id:
          note.id,

        p_asset_ids:
          assetIds
      }
    );

  if (syncError) {
    throw syncError;
  }

  return note;
}


async function createNotebookBundleToken(
  entries,
  title = "Cadernos LURIA",
  mode = "view"
) {
  const owned =
    (entries || []).filter(
      entry =>
        !entry.note.is_shared
    );

  if (!owned.length) {
    throw new Error(
      "A seleção não contém cadernos seus para compartilhar."
    );
  }

  for (
    const entry
    of owned
  ) {
    await materializeNotebookImagesForShare(
      entry.note
    );
  }

  const {
    data,
    error
  } =
    await notebookSb.rpc(
      "create_study_note_bundle_share_v2",
      {
        p_note_ids:
          owned.map(
            entry =>
              entry.note.id
          ),

        p_title:
          title,

        p_mode:
          mode
      }
    );

  if (error) {
    throw error;
  }

  return data;
}


async function openNotebookShareDialog(
  entries,
  title = "Cadernos selecionados"
) {
  const owned =
    (entries || []).filter(
      entry =>
        !entry.note.is_shared
    );

  if (!owned.length) {
    setSaveStatus(
      "A seleção não contém cadernos seus para compartilhar.",
      "error"
    );

    return;
  }

  if (!window.LuriaSharing) {
    setSaveStatus(
      "O compartilhamento não carregou. Atualize a página.",
      "error"
    );

    return;
  }

  const cachedTokens =
    new Map();

  const getToken =
    async (
      mode = "view"
    ) => {
      if (
        !cachedTokens.has(
          mode
        )
      ) {
        cachedTokens.set(
          mode,
          await createNotebookBundleToken(
            owned,
            title,
            mode
          )
        );
      }

      return cachedTokens.get(
        mode
      );
    };

  await window.LuriaSharing.open({
    title,

    count:
      owned.length,

    modes: [
      {
        value: "view",
        title: "Sincronizado · somente visualizar",
        description: "Recebe suas atualizações, mas não pode editar."
      },
      {
        value: "overlay",
        title: "Sincronizado · personalizar",
        description: "Recebe suas atualizações e pode fazer anotações privadas por cima."
      },
      {
        value: "edit",
        title: "Sincronizado · editar comigo",
        description: "Edita o mesmo caderno original e as alterações aparecem para todos."
      },
      {
        value: "copy",
        title: "Enviar uma cópia",
        description: "Cria um caderno independente; imagens são reutilizadas sem duplicação."
      }
    ],

    onLink:
      async (
        mode
      ) => {
        const token =
          await getToken(
            mode
          );

        const url =
          new URL(
            "/caderno/",
            window.location.origin
          );

        url.searchParams.set(
          "bundle",
          token
        );

        try {
          await navigator.clipboard
            .writeText(
              url.toString()
            );

          setSaveStatus(
            "Link dos cadernos copiado",
            "saved"
          );

        } catch {
          window.prompt(
            "Copie o link:",
            url.toString()
          );
        }
      },

    onFriend:
      async (
        friendUserId,
        mode
      ) => {
        const token =
          await getToken(
            mode
          );

        const {
          error
        } =
          await notebookSb.rpc(
            "send_direct_share",
            {
              p_friend_user_id:
                friendUserId,

              p_resource_type:
                "study_note_bundle",

              p_share_token:
                token,

              p_title:
                title
            }
          );

        if (error) {
          throw error;
        }

        setSaveStatus(
          "Material enviado dentro do LURIA",
          "saved"
        );
      },

    onExport:
      async () => {
        const previous =
          new Set(
            notebookState.librarySelected
          );

        notebookState.librarySelected =
          new Set(
            owned.map(
              entry =>
                entry.note.id
            )
          );

        try {
          await exportSelectedPdf();
        } finally {
          notebookState.librarySelected =
            previous;

          updateLibraryActions();
        }
      }
  });
}


async function redeemNotebookBundleFromUrl() {
  const url =
    new URL(
      window.location.href
    );

  const token =
    url.searchParams.get(
      "bundle"
    );

  if (!token) {
    return null;
  }

  const {
    data,
    error
  } =
    await notebookSb.rpc(
      "redeem_study_note_bundle_share",
      {
        p_token:
          token,

        p_mode:
          "view"
      }
    );

  if (error) {
    console.error(error);

    alert(
      `Não foi possível adicionar os cadernos: ${error.message}`
    );

    return null;
  }

  url.searchParams.delete(
    "bundle"
  );

  url.searchParams.set(
    "view",
    "library"
  );

  window.history.replaceState(
    {},
    "",
    url
  );

  return data;
}


async function redeemNotebookShareFromUrl() {
  const url =
    new URL(
      window.location.href
    );

  const token =
    url.searchParams.get(
      "share"
    );

  if (!token) {
    return null;
  }

  const personalize =
    window.confirm(
      "Deseja personalizar este material?\n\nOK = adicionar e editar em cima\nCancelar = adicionar somente para leitura"
    );

  const {
    data,
    error
  } =
    await notebookSb.rpc(
      "redeem_study_note_share",
      {
        p_token:
          token,

        p_mode:
          personalize
            ? "overlay"
            : "view"
      }
    );

  if (error) {
    console.error(error);
    alert(
      `Não foi possível adicionar o material: ${error.message}`
    );
    return null;
  }

  url.searchParams.delete(
    "share"
  );

  url.searchParams.set(
    "view",
    "library"
  );

  window.history.replaceState(
    {},
    "",
    url
  );

  return data;
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


  let keptImages =
    0;


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

      let keepColspan =
        "";

      let keepImageSrc =
        "";

      let keepImageAlt =
        "";

      let keepImageAssetId =
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

        const fontFamily =
          child.style.fontFamily
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

        const allowedFontFamilies = [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Arial",
          "Helvetica",
          "Times New Roman",
          "Times",
          "Georgia",
          "Verdana",
          "Geneva",
          "sans-serif",
          "serif"
        ];

        const normalizedFontFamily =
          fontFamily
            .replaceAll(
              '"',
              ""
            )
            .split(
              ","
            )
            .map(
              part =>
                part.trim()
            )
            .filter(
              part =>
                allowedFontFamilies
                  .includes(
                    part
                  )
            )
            .join(
              ", "
            );

        if (normalizedFontFamily) {
          safeStyle.push(
            `font-family: ${normalizedFontFamily}`
          );
        }

        keepStyle =
          safeStyle.join(
            "; "
          );
      }


      if (
        [
          "P",
          "H1",
          "H2",
          "H3",
          "LI",
          "BLOCKQUOTE",
          "TD",
          "TH"
        ]
          .includes(
            child.tagName
          )
      ) {
        const safeStyle = [];

        const textAlign =
          child.style.textAlign
          || "";

        const lineHeight =
          child.style.lineHeight
          || "";


        if (
          [
            "left",
            "center",
            "right",
            "justify"
          ]
            .includes(
              textAlign
            )
        ) {
          safeStyle.push(
            `text-align: ${textAlign}`
          );
        }


        if (
          [
            "1",
            "1.15",
            "1.5",
            "2"
          ]
            .includes(
              lineHeight
            )
        ) {
          safeStyle.push(
            `line-height: ${lineHeight}`
          );
        }


        if (
          safeStyle.length
        ) {
          keepStyle =
            safeStyle.join(
              "; "
            );
        }
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


      if (
        child.tagName ===
          "HR"
        &&
        child.classList.contains(
          "notebook-divider"
        )
      ) {
        keepClass =
          child.classList.contains(
            "dotted"
          )
            ? "notebook-divider dotted"
            : "notebook-divider solid";
      }


      if (
        child.tagName ===
          "DIV"
        &&
        child.classList.contains(
          "notebook-divider"
        )
        &&
        child.classList.contains(
          "arabesque"
        )
      ) {
        keepClass =
          "notebook-divider arabesque";
      }


      if (
        (
          child.tagName ===
            "TD"
          ||
          child.tagName ===
            "TH"
        )
        &&
        Number(
          child.colSpan
        ) > 1
      ) {
        keepColspan =
          String(
            Math.min(
              24,
              Math.max(
                2,
                Number(
                  child.colSpan
                )
              )
            )
          );
      }


      if (
        child.tagName ===
        "IMG"
      ) {
        const src =
          String(
            child.getAttribute(
              "src"
            )
            || ""
          )
            .trim();

        const validDataImage =
          /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/i
            .test(
              src
            );

        const validSharedImage =
          /^https:\/\/[^/]+\/storage\/v1\/object\/public\/docmap-assets\/notebook-assets\//i
            .test(
              src
            );

        keepImageAssetId =
          String(
            child.getAttribute(
              "data-luria-asset-id"
            )
            || ""
          )
            .trim();

        if (
          (
            !validDataImage
            &&
            !validSharedImage
          )
          ||
          keptImages >= 2
        ) {
          child.remove();
          continue;
        }

        keptImages +=
          1;

        keepImageSrc =
          src;

        keepImageAlt =
          String(
            child.getAttribute(
              "alt"
            )
            || "Imagem do caderno"
          )
            .slice(
              0,
              180
            );
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

      if (
        keepColspan
      ) {
        child.setAttribute(
          "colspan",
          keepColspan
        );
      }

      if (
        keepImageSrc
      ) {
        child.setAttribute(
          "src",
          keepImageSrc
        );

        child.setAttribute(
          "alt",
          keepImageAlt
        );

        if (
          child.tagName === "IMG"
          &&
          /^[0-9a-f-]{36}$/i.test(
            keepImageAssetId
          )
        ) {
          child.setAttribute(
            "data-luria-asset-id",
            keepImageAssetId
          );
        }
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

            applyNotebookTopicPanelState(
              true
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
    "notebook-font-family",
    "notebook-align-toggle",
    "notebook-line-spacing",
    "notebook-bold",
    "notebook-italic",
    "notebook-underline",
    "notebook-text-color",
    "notebook-highlight-color",
    "notebook-list-toggle",
    "notebook-template",
    "notebook-divider",
    "notebook-table-toggle",
    "notebook-image-add",
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
      ".notebook-tool-menu"
    )
    .forEach(
      menu => {
        menu.addEventListener(
          "click",
          event =>
            event.stopPropagation()
        );

        menu.addEventListener(
          "pointerdown",
          event =>
            event.stopPropagation()
        );
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

  const sharedMembership =
    current.note?.is_shared
      ? sharedMembershipFor(
          current.note.id
        )
      : null;


  const effectiveContent =
    current.note?.is_shared
      ? applySharedNotebookPatch(
          current.note
        )
      : String(
          current.note
            ?.content_html
          || ""
        );


  const storedContent =
    String(
      effectiveContent
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
    current.note?.is_shared
      ? (
          sharedMembership?.mode === "overlay"
          ||
          sharedMembership?.mode === "edit"
        )
      : (
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
        effectiveContent
        || ""
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
      current.note.is_shared
        ? (
            sharedMembership?.mode === "overlay"
              ? "Compartilhado · suas alterações são privadas"
              : (
                  sharedMembership?.mode === "edit"
                    ? "Compartilhado · edição sincronizada"
                    : "Compartilhado · somente leitura"
                )
          )
        : "Salvo",
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
    !note
    ||
    (
      note.topic_id
      && !note.is_shared
    )
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


  if (
    current.note?.is_shared
  ) {
    const membership =
      sharedMembershipFor(
        current.note.id
      );

    try {
      if (
        membership?.mode === "edit"
      ) {
        const {
          data:
            savedRows,
          error
        } =
          await notebookSb.rpc(
            "save_shared_study_note_edit",
            {
              p_note_id:
                current.note.id,

              p_content_html:
                contentHtml
            }
          );

        if (error) {
          throw error;
        }

        const data =
          Array.isArray(
            savedRows
          )
            ? savedRows[0]
            : savedRows;

        if (!data?.id) {
          throw new Error(
            "O caderno compartilhado não retornou a versão salva."
          );
        }

        Object.assign(
          current.note,
          data,
          {
            is_shared:
              true
          }
        );

        await syncNotebookImageRefsFromHtml(
          current.note.id,
          data.content_html
        );

        notebookState.editorDirty =
          false;

        setSaveStatus(
          "Alterações sincronizadas com o caderno original",
          "saved"
        );
      } else {
        await saveSharedNotebookOverlay(
          current.note,
          contentHtml
        );

        notebookState.editorDirty =
          false;

        setSaveStatus(
          "Personalização salva sobre o material original",
          "saved"
        );
      }

      renderLibrary();

    } catch (error) {
      console.error(error);

      setSaveStatus(
        `Erro ao salvar: ${error.message}`,
        "error"
      );
    }

    return;
  }


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


  try {
    await syncNotebookImageRefsFromHtml(
      result.data.id,
      result.data.content_html
    );
  } catch (imageSyncError) {
    console.warn(
      "Não foi possível sincronizar referências de imagem:",
      imageSyncError
    );
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


function insertTemplate(
  type = "disease"
) {
  const template =
    NOTEBOOK_TEMPLATES[
      type
    ]
    || NOTEBOOK_TEMPLATES
      .disease;


  restoreSelection();


  document.execCommand(
    "insertHTML",
    false,
    template
  );


  saveSelection();


  scheduleSave();
}


function insertDivider(
  style = "solid"
) {
  restoreSelection();


  const safeStyle =
    [
      "solid",
      "dotted",
      "arabesque"
    ]
      .includes(
        style
      )
      ? style
      : "solid";


  const html =
    safeStyle ===
      "arabesque"
      ? `
          <div class="notebook-divider arabesque" contenteditable="false"><span class="notebook-divider-luria" aria-hidden="true"></span></div>
          <p><br></p>
        `
      : `
          <hr class="notebook-divider ${safeStyle}">
          <p><br></p>
        `;


  document.execCommand(
    "insertHTML",
    false,
    html
  );


  saveSelection();


  scheduleSave();
}


function applyNotebookFont(
  fontFamily
) {
  const allowedFonts =
    new Map([
      [
        "default",
        "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
      ],
      [
        "Times New Roman",
        "\"Times New Roman\", Times, serif"
      ],
      [
        "Georgia",
        "Georgia, \"Times New Roman\", serif"
      ],
      [
        "Verdana",
        "Verdana, Geneva, sans-serif"
      ]
    ]);


  if (
    !allowedFonts.has(
      fontFamily
    )
  ) {
    return;
  }


  restoreSelection();


  document.execCommand(
    "fontName",
    false,
    fontFamily
  );


  const editor =
    document.getElementById(
      "notebook-editor"
    );


  editor
    ?.querySelectorAll(
      "font[face]"
    )
    .forEach(
      element => {
        const face =
          element.getAttribute(
            "face"
          )
          || fontFamily;


        const span =
          document.createElement(
            "span"
          );


        span.style.fontFamily =
          allowedFonts.get(
            face
          )
          || allowedFonts.get(
            fontFamily
          );


        while (
          element.firstChild
        ) {
          span.appendChild(
            element.firstChild
          );
        }


        element.replaceWith(
          span
        );
      }
    );


  saveSelection();


  scheduleSave();
}

function notebookSelectedTextBlocks() {
  const editor =
    document.getElementById(
      "notebook-editor"
    );

  const selection =
    window.getSelection();


  if (
    !editor
    || !selection
    || !selection.rangeCount
  ) {
    return [];
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
    return [];
  }


  const selector =
    "p,h1,h2,h3,li,blockquote,td,th";


  if (
    selection.isCollapsed
  ) {
    let node =
      selection.anchorNode;


    if (
      node?.nodeType ===
      Node.TEXT_NODE
    ) {
      node =
        node.parentElement;
    }


    const block =
      node
        ?.closest
        ?.(selector);


    return (
      block
      && editor.contains(
        block
      )
    )
      ? [block]
      : [];
  }


  return Array.from(
    editor.querySelectorAll(
      selector
    )
  )
    .filter(
      block => {
        try {
          return range.intersectsNode(
            block
          );
        } catch {
          return false;
        }
      }
    );
}


function applyNotebookAlignment(
  alignment
) {
  const allowed =
    new Set([
      "left",
      "center",
      "right",
      "justify"
    ]);


  if (
    !allowed.has(
      alignment
    )
  ) {
    return;
  }


  restoreSelection();


  const blocks =
    notebookSelectedTextBlocks();


  if (
    blocks.length
  ) {
    blocks.forEach(
      block => {
        block.style.textAlign =
          alignment;
      }
    );
  } else {
    const command =
      {
        left:
          "justifyLeft",
        center:
          "justifyCenter",
        right:
          "justifyRight",
        justify:
          "justifyFull"
      }[
        alignment
      ];


    document.execCommand(
      command,
      false
    );
  }


  saveSelection();


  scheduleSave();
}


function applyNotebookLineSpacing(
  spacing
) {
  const allowed =
    new Set([
      "1",
      "1.15",
      "1.5",
      "2"
    ]);


  if (
    !allowed.has(
      String(
        spacing
      )
    )
  ) {
    return;
  }


  restoreSelection();


  let blocks =
    notebookSelectedTextBlocks();


  if (
    !blocks.length
  ) {
    document.execCommand(
      "formatBlock",
      false,
      "p"
    );


    blocks =
      notebookSelectedTextBlocks();
  }


  blocks.forEach(
    block => {
      block.style.lineHeight =
        String(
          spacing
        );
    }
  );


  saveSelection();


  scheduleSave();
}


function notebookEditorSelectionElement() {
  const editor =
    document.getElementById(
      "notebook-editor"
    );

  const selection =
    window.getSelection();

  if (
    !editor
    || !selection
    || !selection.rangeCount
  ) {
    return null;
  }

  let node =
    selection.anchorNode;

  if (
    node?.nodeType ===
      Node.TEXT_NODE
  ) {
    node =
      node.parentElement;
  }

  if (
    !(node instanceof Element)
  ) {
    return null;
  }

  if (
    !editor.contains(
      node
    )
  ) {
    return null;
  }

  return node;
}


function notebookEditorCurrentTableRow() {
  const element =
    notebookEditorSelectionElement();

  return (
    element
      ?.closest(
        "tr"
      )
    || null
  );
}


function notebookEditorCurrentTable() {
  return (
    notebookEditorCurrentTableRow()
      ?.closest(
        "table"
      )
    || null
  );
}


function mergeCurrentNotebookEditorTableRow() {
  if (
    !notebookState.editorEditable
  ) {
    return;
  }

  restoreSelection();

  const row =
    notebookEditorCurrentTableRow();

  const table =
    row
      ?.closest(
        "table"
      );

  if (
    !row
    || !table
  ) {
    return;
  }

  const columns =
    notebookTableLogicalColumnCount(
      table
    );

  const text =
    Array.from(
      row.cells
    )
      .map(
        cell =>
          cell.innerText
            ?.trim()
          || ""
      )
      .filter(
        Boolean
      )
      .join(
        " "
      );

  row.innerHTML =
    "";

  const cell =
    document.createElement(
      "th"
    );

  cell.colSpan =
    columns;

  cell.textContent =
    text;

  row.appendChild(
    cell
  );

  focusNotebookCell(
    cell
  );

  saveSelection();
  scheduleSave();
}


function splitCurrentNotebookEditorTableRow() {
  if (
    !notebookState.editorEditable
  ) {
    return;
  }

  restoreSelection();

  const row =
    notebookEditorCurrentTableRow();

  const table =
    row
      ?.closest(
        "table"
      );

  if (
    !row
    || !table
    || row.cells.length !== 1
    || Number(
      row.cells[0].colSpan
      || 1
    ) <= 1
  ) {
    return;
  }

  const columns =
    Math.max(
      2,
      Number(
        row.cells[0].colSpan
        || 1
      ),
      notebookTableLogicalColumnCount(
        table
      )
    );

  const text =
    row.cells[0]
      .innerText
      ?.trim()
    || "";

  row.innerHTML =
    "";

  for (
    let index = 0;
    index < columns;
    index += 1
  ) {
    const cell =
      document.createElement(
        "td"
      );

    if (
      index === 0
    ) {
      cell.textContent =
        text;
    }

    row.appendChild(
      cell
    );
  }

  focusNotebookCell(
    row.cells[0]
  );

  saveSelection();
  scheduleSave();
}


function notebookTableRowIsBlank(
  row
) {
  if (!row) {
    return false;
  }


  return Array.from(
    row.cells
    || []
  )
    .every(
      cell => {
        const text =
          String(
            cell.innerText
            || cell.textContent
            || ""
          )
            .replace(
              /\u00a0/g,
              " "
            )
            .trim();


        const hasMeaningfulContent =
          Boolean(
            cell.querySelector(
              "img,table,hr,ul,ol"
            )
          );


        return (
          !text
          &&
          !hasMeaningfulContent
        );
      }
    );
}


function removeBlankNotebookTableRowAndFocusPrevious(
  row,
  preferredCellIndex = 0
) {
  const table =
    row
      ?.closest(
        "table"
      );


  if (
    !row
    || !table
    || !notebookTableRowIsBlank(
      row
    )
  ) {
    return false;
  }


  const rowIndex =
    row.rowIndex;


  if (
    rowIndex <= 0
  ) {
    return false;
  }


  const previousRow =
    table.rows[
      rowIndex - 1
    ];


  if (!previousRow) {
    return false;
  }


  row.remove();


  const targetIndex =
    Math.max(
      0,
      Math.min(
        Number(
          preferredCellIndex
          || 0
        ),
        previousRow.cells.length - 1
      )
    );


  focusNotebookCell(
    previousRow.cells[
      targetIndex
    ]
    || previousRow.cells[
      previousRow.cells.length - 1
    ]
  );


  return true;
}


function notebookAtomicDividerFromNode(
  node
) {
  const element =
    node?.nodeType === Node.ELEMENT_NODE
      ? node
      : node?.parentElement;


  return element
    ?.closest?.(
      ".notebook-divider"
    )
    || null;
}


function keepCaretOutsideNotebookDivider(
  event
) {
  if (
    !notebookState.editorEditable
  ) {
    return;
  }


  const selection =
    window.getSelection();


  if (
    !selection
    || !selection.rangeCount
  ) {
    return;
  }


  const divider =
    notebookAtomicDividerFromNode(
      selection.anchorNode
    );


  if (!divider) {
    return;
  }


  event?.preventDefault();


  const target =
    event?.key === "ArrowUp"
      ? divider.previousElementSibling
      : divider.nextElementSibling;


  const paragraph =
    target
    || document.createElement(
      "p"
    );


  if (!target) {
    paragraph.innerHTML =
      "<br>";

    divider.after(
      paragraph
    );
  }


  const range =
    document.createRange();


  range.selectNodeContents(
    paragraph
  );


  range.collapse(
    event?.key === "ArrowUp"
      ? false
      : true
  );


  selection.removeAllRanges();
  selection.addRange(
    range
  );


  saveSelection();
}


function removeAdjacentNotebookDivider(
  event
) {
  if (
    !notebookState.editorEditable
    || ![
      "Backspace",
      "Delete"
    ].includes(event.key)
  ) {
    return false;
  }

  const selection =
    window.getSelection();

  if (
    !selection
    || !selection.rangeCount
    || !selection.isCollapsed
  ) {
    return false;
  }

  const editor =
    document.getElementById(
      "notebook-editor"
    );

  const range =
    selection.getRangeAt(0);

  let block =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer
      : range.startContainer.parentElement;

  block =
    block?.closest?.(
      "p,h1,h2,h3,li,blockquote,div"
    );

  if (
    !editor
    || !block
    || block === editor
    || !editor.contains(block)
    || block.classList.contains("notebook-divider")
  ) {
    return false;
  }

  const probe =
    document.createRange();

  probe.selectNodeContents(block);

  const before =
    probe.cloneRange();

  before.setEnd(
    range.startContainer,
    range.startOffset
  );

  const after =
    probe.cloneRange();

  after.setStart(
    range.startContainer,
    range.startOffset
  );

  const atStart =
    before.toString().length === 0;

  const atEnd =
    after.toString().length === 0;

  const divider =
    event.key === "Backspace" && atStart
      ? block.previousElementSibling
      : event.key === "Delete" && atEnd
        ? block.nextElementSibling
        : null;

  if (
    !divider?.classList?.contains(
      "notebook-divider"
    )
  ) {
    return false;
  }

  event.preventDefault();
  divider.remove();

  saveSelection();
  scheduleSave();

  return true;
}




function handleNotebookEditorTableBackspace(
  event
) {
  if (
    event.key !== "Backspace"
    || !notebookState.editorEditable
  ) {
    return;
  }


  const element =
    notebookEditorSelectionElement();


  const cell =
    element
      ?.closest(
        "td,th"
      );


  const row =
    cell
      ?.closest(
        "tr"
      );


  if (
    !cell
    || !row
    || !notebookTableRowIsBlank(
      row
    )
  ) {
    return;
  }


  const selection =
    window.getSelection();


  if (
    selection
    &&
    !selection.isCollapsed
  ) {
    return;
  }


  event.preventDefault();


  if (
    removeBlankNotebookTableRowAndFocusPrevious(
      row,
      cell.cellIndex
    )
  ) {
    saveSelection();
    scheduleSave();
  }
}


function handleNotebookEditorTableEnter(
  event
) {
  if (
    event.key !== "Enter"
    || event.shiftKey
    || !notebookState.editorEditable
  ) {
    return;
  }

  const row =
    notebookEditorCurrentTableRow();

  const table =
    row
      ?.closest(
        "table"
      );

  if (
    !row
    || !table
    || row !==
      table.rows[
        table.rows.length - 1
      ]
  ) {
    return;
  }

  event.preventDefault();

  const newRow =
    document.createElement(
      "tr"
    );

  const columns =
    notebookTableLogicalColumnCount(
      table
    );

  for (
    let index = 0;
    index < columns;
    index += 1
  ) {
    newRow.appendChild(
      document.createElement(
        "td"
      )
    );
  }

  row.after(
    newRow
  );

  focusNotebookCell(
    newRow.cells[0]
  );

  saveSelection();
  scheduleSave();
}


/* =========================================================
   IMAGENS DO CADERNO
   ========================================================= */

function notebookImageCount() {
  const editor =
    document.getElementById(
      "notebook-editor"
    );

  return editor
    ? editor.querySelectorAll(
        "img"
      ).length
    : 0;
}


async function compressNotebookImageBlob(
  sourceBlob
) {
  const maxBytes =
    128 * 1024;


  if (
    !sourceBlob
    ||
    !sourceBlob.type
      ?.startsWith(
        "image/"
      )
  ) {
    throw new Error(
      "Arquivo de imagem inválido."
    );
  }


  if (
    sourceBlob.size
    <= maxBytes
  ) {
    return sourceBlob;
  }


  const bitmap =
    await createImageBitmap(
      sourceBlob
    );


  try {
    const originalWidth =
      bitmap.width;

    const originalHeight =
      bitmap.height;


    const dimensionSteps = [
      1600,
      1400,
      1200,
      1000,
      900,
      800,
      700,
      620,
      540,
      460
    ];


    const qualitySteps = [
      0.90,
      0.84,
      0.78,
      0.72,
      0.66,
      0.60,
      0.54,
      0.48,
      0.42
    ];


    let smallest =
      null;


    for (
      const maxDimension
      of dimensionSteps
    ) {
      const scale =
        Math.min(
          1,
          maxDimension
          /
          Math.max(
            originalWidth,
            originalHeight
          )
        );


      const width =
        Math.max(
          1,
          Math.round(
            originalWidth
            * scale
          )
        );


      const height =
        Math.max(
          1,
          Math.round(
            originalHeight
            * scale
          )
        );


      const canvas =
        document.createElement(
          "canvas"
        );


      canvas.width =
        width;

      canvas.height =
        height;


      const context =
        canvas.getContext(
          "2d",
          {
            alpha:
              false
          }
        );


      context.fillStyle =
        "#ffffff";

      context.fillRect(
        0,
        0,
        width,
        height
      );


      context.imageSmoothingEnabled =
        true;

      context.imageSmoothingQuality =
        "high";


      context.drawImage(
        bitmap,
        0,
        0,
        width,
        height
      );


      for (
        const quality
        of qualitySteps
      ) {
        const candidate =
          await new Promise(
            resolve =>
              canvas.toBlob(
                resolve,
                "image/webp",
                quality
              )
          );


        if (!candidate) {
          continue;
        }


        if (
          !smallest
          ||
          candidate.size
          < smallest.size
        ) {
          smallest =
            candidate;
        }


        if (
          candidate.size
          <= maxBytes
        ) {
          return candidate;
        }
      }
    }


    return smallest
      || sourceBlob;


  } finally {
    bitmap.close?.();
  }
}


function notebookBlobToDataUrl(
  blob
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const reader =
        new FileReader();


      reader.onload =
        () =>
          resolve(
            String(
              reader.result
              || ""
            )
          );


      reader.onerror =
        () =>
          reject(
            new Error(
              "Não foi possível ler a imagem."
            )
          );


      reader.readAsDataURL(
        blob
      );
    }
  );
}


async function addNotebookImages(
  files
) {
  if (
    !notebookState.editorEditable
  ) {
    return;
  }


  const editor =
    document.getElementById(
      "notebook-editor"
    );


  if (!editor) {
    return;
  }


  const currentCount =
    notebookImageCount();


  const remaining =
    Math.max(
      0,
      2 - currentCount
    );


  if (
    remaining <= 0
  ) {
    alert(
      "Este caderno já possui o máximo de 2 imagens."
    );

    return;
  }


  const selected =
    Array.from(
      files
      || []
    )
      .filter(
        file =>
          file.type
            ?.startsWith(
              "image/"
            )
      )
      .slice(
        0,
        remaining
      );


  if (
    !selected.length
  ) {
    return;
  }


  if (
    Array.from(
      files
      || []
    ).length
    > remaining
  ) {
    alert(
      `Você pode adicionar no máximo 2 imagens por caderno. Serão inseridas apenas ${remaining}.`
    );
  }


  setSaveStatus(
    "Preparando imagem...",
    "saving"
  );


  const htmlParts =
    [];


  for (
    const file
    of selected
  ) {
    const compressed =
      await compressNotebookImageBlob(
        file
      );


    const dataUrl =
      await notebookBlobToDataUrl(
        compressed
      );


    htmlParts.push(
      `<p><img src="${dataUrl}" alt="Imagem do caderno"></p><p><br></p>`
    );
  }


  restoreSelection();


  document.execCommand(
    "insertHTML",
    false,
    htmlParts.join(
      ""
    )
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


function normalizeNotebookTableBuilderData(
  input
) {
  if (
    input
    &&
    !Array.isArray(
      input
    )
    &&
    Array.isArray(
      input.rows
    )
  ) {
    const baseColumns =
      Math.max(
        1,
        Number(
          input.baseColumns
          || 1
        )
      );

    return {
      baseColumns,

      rows:
        input.rows.map(
          (
            row,
            rowIndex
          ) => {
            const cells =
              Array.isArray(
                row?.cells
              )
                ? row.cells
                : [];

            if (
              !cells.length
            ) {
              return {
                cells: [
                  {
                    text: "",
                    colspan:
                      baseColumns,
                    header:
                      rowIndex === 0
                  }
                ]
              };
            }

            return {
              cells:
                cells.map(
                  cell => ({
                    text:
                      String(
                        cell?.text
                        ?? ""
                      ),

                    colspan:
                      Math.max(
                        1,
                        Number(
                          cell?.colspan
                          || 1
                        )
                      ),

                    header:
                      cell?.header
                      === true
                      ||
                      rowIndex === 0
                  })
                )
            };
          }
        )
    };
  }


  const data =
    Array.isArray(
      input
    )
    && input.length
      ? input
      : [
          [
            "Coluna 1",
            "Coluna 2",
            "Coluna 3"
          ],
          [
            "",
            "",
            ""
          ],
          [
            "",
            "",
            ""
          ]
        ];


  const baseColumns =
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


  return {
    baseColumns,

    rows:
      data.map(
        (
          row,
          rowIndex
        ) => ({
          cells:
            (
              Array.isArray(
                row
              )
                ? row
                : []
            )
              .map(
                cell => ({
                  text:
                    String(
                      cell
                      ?? ""
                    ),

                  colspan:
                    1,

                  header:
                    rowIndex === 0
                })
              )
        })
      )
  };
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


  const structure =
    normalizeNotebookTableBuilderData(
      rows
    );


  container.innerHTML =
    `
      <table
        data-notebook-table-builder
        data-base-cols="${structure.baseColumns}"
      >
        <tbody>
          ${
            structure.rows
              .map(
                row =>
                  `
                    <tr>
                      ${
                        row.cells
                          .map(
                            cell => {
                              const tag =
                                cell.header
                                  ? "th"
                                  : "td";

                              const colspan =
                                Math.max(
                                  1,
                                  Number(
                                    cell.colspan
                                    || 1
                                  )
                                );

                              const colspanAttr =
                                colspan > 1
                                  ? ` colspan="${colspan}"`
                                  : "";

                              return `
                                <${tag}
                                  contenteditable="true"
                                  ${colspanAttr}
                                >${escapeHtml(
                                  cell.text
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



function notebookTableLogicalColumnCount(
  table
) {
  if (!table) {
    return 1;
  }

  const declared =
    Number(
      table.dataset
        ?.baseCols
      || 0
    );

  const calculated =
    Math.max(
      1,
      ...Array.from(
        table.rows
        || []
      )
        .map(
          row =>
            Array.from(
              row.cells
              || []
            )
              .reduce(
                (
                  total,
                  cell
                ) =>
                  total
                  + Math.max(
                      1,
                      Number(
                        cell.colSpan
                        || 1
                      )
                    ),
                0
              )
        )
    );

  return Math.max(
    1,
    declared,
    calculated
  );
}


function setNotebookTableBaseColumns(
  table,
  count
) {
  if (!table) {
    return;
  }

  table.dataset.baseCols =
    String(
      Math.max(
        1,
        Number(
          count
          || 1
        )
      )
    );
}


function focusNotebookCell(
  cell
) {
  if (!cell) {
    return;
  }

  cell.focus?.();

  const range =
    document.createRange();

  range.selectNodeContents(
    cell
  );

  range.collapse(
    false
  );

  const selection =
    window.getSelection();

  selection.removeAllRanges();
  selection.addRange(
    range
  );
}


function getActiveNotebookTableBuilderRow() {
  const table =
    getNotebookTableElement();

  if (!table) {
    return null;
  }

  const active =
    document.activeElement
      ?.closest
      ?.(
        "tr"
      );

  if (
    active
    &&
    table.contains(
      active
    )
  ) {
    return active;
  }

  return (
    table.querySelector(
      "tr.notebook-table-row-active"
    )
    ||
    table.rows[
      table.rows.length - 1
    ]
    ||
    null
  );
}


function markNotebookTableBuilderRow(
  row
) {
  const table =
    getNotebookTableElement();

  if (!table) {
    return;
  }

  Array.from(
    table.rows
  )
    .forEach(
      item =>
        item.classList
          .toggle(
            "notebook-table-row-active",
            item === row
          )
    );
}


function mergeNotebookTableBuilderRow() {
  const table =
    getNotebookTableElement();

  const row =
    getActiveNotebookTableBuilderRow();

  if (
    !table
    || !row
  ) {
    return;
  }

  const columns =
    notebookTableLogicalColumnCount(
      table
    );

  const text =
    Array.from(
      row.cells
    )
      .map(
        cell =>
          cell.innerText
            ?.trim()
          || ""
      )
      .filter(
        Boolean
      )
      .join(
        " "
      );

  row.innerHTML =
    "";

  const cell =
    document.createElement(
      "th"
    );

  cell.colSpan =
    columns;

  cell.contentEditable =
    "true";

  cell.textContent =
    text;

  row.appendChild(
    cell
  );

  markNotebookTableBuilderRow(
    row
  );

  focusNotebookCell(
    cell
  );
}


function splitNotebookTableBuilderRow() {
  const table =
    getNotebookTableElement();

  const row =
    getActiveNotebookTableBuilderRow();

  if (
    !table
    || !row
  ) {
    return;
  }

  const columns =
    notebookTableLogicalColumnCount(
      table
    );

  if (
    row.cells.length !== 1
    || Number(
      row.cells[0].colSpan
      || 1
    ) <= 1
  ) {
    return;
  }

  const previousText =
    row.cells[0]
      .innerText
      ?.trim()
    || "";

  const useHeader =
    row.rowIndex === 0;

  row.innerHTML =
    "";

  for (
    let index = 0;
    index < columns;
    index += 1
  ) {
    const cell =
      document.createElement(
        useHeader
          ? "th"
          : "td"
      );

    cell.contentEditable =
      "true";

    if (
      index === 0
    ) {
      cell.textContent =
        previousText;
    }

    row.appendChild(
      cell
    );
  }

  markNotebookTableBuilderRow(
    row
  );

  focusNotebookCell(
    row.cells[0]
  );
}


function appendNotebookTableRow(
  table,
  focus = false
) {
  if (!table) {
    return null;
  }

  const columns =
    notebookTableLogicalColumnCount(
      table
    );

  setNotebookTableBaseColumns(
    table,
    columns
  );

  const row =
    table.insertRow();

  for (
    let index = 0;
    index < columns;
    index += 1
  ) {
    const cell =
      row.insertCell();

    cell.contentEditable =
      "true";
  }

  if (
    table.hasAttribute(
      "data-notebook-table-builder"
    )
  ) {
    markNotebookTableBuilderRow(
      row
    );
  }

  if (
    focus
  ) {
    focusNotebookCell(
      row.cells[0]
    );
  }

  return row;
}


function addNotebookTableRow() {
  const table =
    getNotebookTableElement();

  if (!table) {
    renderNotebookTableBuilder();
    return;
  }

  appendNotebookTableRow(
    table,
    true
  );
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

  const previousColumns =
    notebookTableLogicalColumnCount(
      table
    );

  const newColumns =
    previousColumns + 1;

  Array.from(
    table.rows
  )
    .forEach(
      (
        row,
        rowIndex
      ) => {
        if (
          row.cells.length === 1
          &&
          Number(
            row.cells[0].colSpan
            || 1
          ) >= previousColumns
        ) {
          row.cells[0].colSpan =
            newColumns;

          return;
        }

        const cell =
          document.createElement(
            rowIndex === 0
              ? "th"
              : "td"
          );

        cell.contentEditable =
          "true";

        if (
          rowIndex === 0
        ) {
          cell.textContent =
            `Coluna ${newColumns}`;
        }

        row.appendChild(
          cell
        );
      }
    );

  setNotebookTableBaseColumns(
    table,
    newColumns
  );
}


function removeNotebookTableColumn() {
  const table =
    getNotebookTableElement();

  if (!table) {
    return;
  }

  const previousColumns =
    notebookTableLogicalColumnCount(
      table
    );

  if (
    previousColumns <= 1
  ) {
    return;
  }

  const newColumns =
    previousColumns - 1;

  Array.from(
    table.rows
  )
    .forEach(
      row => {
        if (
          row.cells.length === 1
          &&
          Number(
            row.cells[0].colSpan
            || 1
          ) > 1
        ) {
          row.cells[0].colSpan =
            Math.max(
              1,
              newColumns
            );

          return;
        }

        if (
          row.cells.length > newColumns
        ) {
          row.deleteCell(
            row.cells.length - 1
          );
        }
      }
    );

  setNotebookTableBaseColumns(
    table,
    newColumns
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
              row =>
                `
                  <tr>
                    ${
                      Array.from(
                        row.cells
                      )
                        .map(
                          cell => {
                            const tag =
                              cell.tagName
                                ?.toLowerCase()
                              === "th"
                                ? "th"
                                : "td";

                            const colspan =
                              Math.max(
                                1,
                                Number(
                                  cell.colSpan
                                  || 1
                                )
                              );

                            const colspanAttribute =
                              colspan > 1
                                ? ` colspan="${colspan}"`
                                : "";

                            return `
                              <${tag}${colspanAttribute}>
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


function notebookOcrWordsFromData(
  data
) {
  if (
    Array.isArray(
      data?.words
    )
    &&
    data.words.length
  ) {
    return data.words;
  }


  /*
    Algumas versões/configurações do Tesseract retornam o
    texto e TSV, mas não preenchem data.words. O leitor antigo
    interpretava isso como "nenhuma palavra" e falhava mesmo
    tendo reconhecido o conteúdo.
  */
  if (
    typeof data?.tsv === "string"
    &&
    data.tsv.trim()
  ) {
    const rows =
      data.tsv
        .split(
          /\r?\n/
        );


    const words =
      [];


    for (
      let index = 1;
      index < rows.length;
      index += 1
    ) {
      const columns =
        rows[index]
          .split(
            "\t"
          );


      if (
        columns.length < 12
      ) {
        continue;
      }


      const level =
        Number(
          columns[0]
        );


      const left =
        Number(
          columns[6]
        );

      const top =
        Number(
          columns[7]
        );

      const width =
        Number(
          columns[8]
        );

      const height =
        Number(
          columns[9]
        );

      const confidence =
        Number(
          columns[10]
        );

      const text =
        columns
          .slice(
            11
          )
          .join(
            "\t"
          )
          .trim();


      if (
        level !== 5
        ||
        !text
        ||
        !Number.isFinite(
          left
        )
        ||
        !Number.isFinite(
          top
        )
        ||
        !Number.isFinite(
          width
        )
        ||
        !Number.isFinite(
          height
        )
      ) {
        continue;
      }


      words.push({
        text,
        confidence,

        bbox: {
          x0:
            left,

          y0:
            top,

          x1:
            left + width,

          y1:
            top + height
        }
      });
    }


    if (
      words.length
    ) {
      return words;
    }
  }


  /*
    Fallback para saídas estruturadas em blocks.
  */
  const structured =
    [];


  const blocks =
    Array.isArray(
      data?.blocks
    )
      ? data.blocks
      : [];


  blocks.forEach(
    block =>
      (
        block.paragraphs
        || []
      )
        .forEach(
          paragraph =>
            (
              paragraph.lines
              || []
            )
              .forEach(
                line =>
                  (
                    line.words
                    || []
                  )
                    .forEach(
                      word => {
                        if (
                          word?.text
                          &&
                          word?.bbox
                        ) {
                          structured.push(
                            word
                          );
                        }
                      }
                    )
              )
        )
  );


  return structured;
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


function notebookVerticalEdgeSupport(
  canvas,
  x,
  y0,
  y1
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

  const safeX =
    Math.max(
      2,
      Math.min(
        width - 3,
        Math.round(
          x
        )
      )
    );

  const top =
    Math.max(
      0,
      Math.round(
        y0
      )
    );

  const bottom =
    Math.min(
      height - 1,
      Math.round(
        y1
      )
    );

  if (
    bottom <= top
  ) {
    return 0;
  }


  const image =
    context.getImageData(
      0,
      top,
      width,
      bottom - top + 1
    );

  const pixels =
    image.data;

  let hits =
    0;

  let total =
    0;


  for (
    let localY = 0;
    localY <= bottom - top;
    localY += 1
  ) {
    let strongest =
      0;


    for (
      let dx = -2;
      dx <= 2;
      dx += 1
    ) {
      const currentX =
        safeX + dx;

      const leftOffset =
        (
          localY * width
          + (
            currentX - 1
          )
        ) * 4;

      const rightOffset =
        (
          localY * width
          + currentX
        ) * 4;

      const diff =
        notebookPixelDifference(
          pixels,
          leftOffset,
          rightOffset
        );

      if (
        diff > strongest
      ) {
        strongest =
          diff;
      }
    }


    if (
      strongest >= 10
    ) {
      hits +=
        1;
    }

    total +=
      1;
  }


  return total
    ? hits / total
    : 0;
}


function notebookRowBoundaries(
  canvas,
  globalVertical,
  y0,
  y1
) {
  if (
    !canvas
    ||
    !Array.isArray(
      globalVertical
    )
    ||
    globalVertical.length < 2
  ) {
    return [];
  }


  const outerLeft =
    globalVertical[0];

  const outerRight =
    globalVertical[
      globalVertical.length - 1
    ];


  const rowHeight =
    Math.max(
      1,
      y1 - y0
    );


  const margin =
    Math.min(
      Math.max(
        2,
        rowHeight * 0.12
      ),
      10
    );


  const scanTop =
    y0 + margin;

  const scanBottom =
    y1 - margin;


  const boundaries = [
    outerLeft
  ];


  for (
    let index = 1;
    index < globalVertical.length - 1;
    index += 1
  ) {
    const x =
      globalVertical[index];


    const support =
      notebookVerticalEdgeSupport(
        canvas,
        x,
        scanTop,
        scanBottom
      );


    /*
      A divisória precisa existir nesta linha.
      Não propagamos uma divisão das linhas inferiores
      para um cabeçalho que é uma célula única.
    */
    if (
      support >= 0.28
    ) {
      boundaries.push(
        x
      );
    }
  }


  boundaries.push(
    outerRight
  );


  return boundaries;
}


function groupNotebookWordsIntoVisualLines(
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


  const tolerance =
    Math.max(
      5,
      typicalHeight * 0.62
    );


  const lines =
    [];


  for (
    const word
    of usable
      .slice()
      .sort(
        (
          a,
          b
        ) =>
          a.y - b.y
          ||
          a.x0 - b.x0
      )
  ) {
    let line =
      lines.find(
        candidate =>
          Math.abs(
            candidate.y
            - word.y
          )
          <= tolerance
      );


    if (
      !line
    ) {
      line = {
        y:
          word.y,

        top:
          word.y0,

        bottom:
          word.y1,

        words:
          []
      };


      lines.push(
        line
      );
    }


    line.words.push(
      word
    );


    line.y =
      line.words.reduce(
        (
          sum,
          item
        ) =>
          sum + item.y,
        0
      )
      / line.words.length;


    line.top =
      Math.min(
        line.top,
        word.y0
      );


    line.bottom =
      Math.max(
        line.bottom,
        word.y1
      );
  }


  lines.forEach(
    line =>
      line.words.sort(
        (
          a,
          b
        ) =>
          a.x0 - b.x0
      )
  );


  return lines.sort(
    (
      a,
      b
    ) =>
      a.y - b.y
  );
}


function notebookPhraseSegments(
  words
) {
  const usable =
    notebookTableWordData(
      words
    )
      .sort(
        (
          a,
          b
        ) =>
          a.x0 - b.x0
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


  const gaps =
    [];


  for (
    let index = 1;
    index < usable.length;
    index += 1
  ) {
    const gap =
      usable[index].x0
      - usable[
          index - 1
        ].x1;


    if (
      gap > 0
    ) {
      gaps.push(
        gap
      );
    }
  }


  const ordinaryGap =
    medianNotebookNumber(
      gaps.filter(
        gap =>
          gap
          <= typicalHeight * 1.8
      )
    )
    ||
    typicalHeight * 0.45;


  const splitGap =
    Math.max(
      12,
      typicalHeight * 1.45,
      ordinaryGap * 2.7
    );


  const isIsolatedNumber =
    value =>
      /^[-+]?\d+(?:[.,]\d+)?%?$/
        .test(
          String(
            value
            || ""
          )
            .trim()
        );


  const groups =
    [];

  let current =
    [];


  usable.forEach(
    (
      word,
      index
    ) => {
      if (
        index > 0
      ) {
        const previous =
          usable[
            index - 1
          ];


        const gap =
          word.x0
          - previous.x1;


        const separatedNumbers =
          isIsolatedNumber(
            previous.text
          )
          &&
          isIsolatedNumber(
            word.text
          )
          &&
          gap >=
            Math.max(
              6,
              typicalHeight * 0.48
            );


        const shortTokensFarApart =
          String(
            previous.text
            || ""
          ).length <= 4
          &&
          String(
            word.text
            || ""
          ).length <= 4
          &&
          gap >=
            Math.max(
              9,
              typicalHeight * 0.9
            );


        if (
          (
            gap >= splitGap
            ||
            separatedNumbers
            ||
            shortTokensFarApart
          )
          &&
          current.length
        ) {
          groups.push(
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
    groups.push(
      current
    );
  }


  return groups.map(
    group => {
      const x0 =
        Math.min(
          ...group.map(
            word =>
              word.x0
          )
        );


      const x1 =
        Math.max(
          ...group.map(
            word =>
              word.x1
          )
        );


      return {
        x0,
        x1,

        x:
          (
            x0 + x1
          ) / 2,

        text:
          group
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
            .trim(),

        words:
          group
      };
    }
  );
}


function notebookCellTextFromWords(
  words
) {
  if (
    !words.length
  ) {
    return "";
  }


  const lines =
    groupNotebookWordsIntoVisualLines(
      words
    );


  return lines
    .map(
      line =>
        line.words
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


function buildNotebookRowBands(
  words,
  grid,
  canvas
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


  const minWordTop =
    Math.min(
      ...usable.map(
        word =>
          word.y0
      )
    );


  const maxWordBottom =
    Math.max(
      ...usable.map(
        word =>
          word.y1
      )
    );


  if (
    grid?.horizontal
      ?.length
  ) {
    const separators =
      grid.horizontal
        .slice()
        .sort(
          (
            a,
            b
          ) =>
            a - b
        );


    const boundaries =
      separators.slice();


    /*
      Se houver texto acima da primeira linha horizontal,
      cria um limite sintético para NÃO perder o cabeçalho.
      Esse era o principal motivo da primeira linha sumir.
    */
    if (
      minWordTop
      <
      separators[0]
      - typicalHeight * 0.25
    ) {
      boundaries.unshift(
        Math.max(
          0,
          minWordTop
          - typicalHeight * 0.8
        )
      );
    }


    if (
      maxWordBottom
      >
      separators[
        separators.length - 1
      ]
      + typicalHeight * 0.25
    ) {
      boundaries.push(
        Math.min(
          canvas?.height
          || maxWordBottom
            + typicalHeight,
          maxWordBottom
          + typicalHeight * 0.8
        )
      );
    }


    const bands =
      [];


    for (
      let index = 0;
      index < boundaries.length - 1;
      index += 1
    ) {
      const top =
        boundaries[index];

      const bottom =
        boundaries[
          index + 1
        ];


      const rowWords =
        usable.filter(
          word =>
            word.y > top
            &&
            word.y < bottom
        );


      if (
        !rowWords.length
      ) {
        continue;
      }


      bands.push({
        top,
        bottom,
        words:
          rowWords
      });
    }


    if (
      bands.length
    ) {
      return bands;
    }
  }


  /*
    Sem linhas horizontais confiáveis:
    cada faixa de texto vira uma linha candidata.
    Frases e números isolados na MESMA altura continuam
    juntos para ajudar a descobrir as colunas.
  */
  const visualLines =
    groupNotebookWordsIntoVisualLines(
      usable
    );


  return visualLines.map(
    (
      line,
      index
    ) => {
      const previous =
        visualLines[
          index - 1
        ];


      const next =
        visualLines[
          index + 1
        ];


      const top =
        previous
          ? (
              previous.bottom
              + line.top
            ) / 2
          : Math.max(
              0,
              line.top
              - typicalHeight * 0.8
            );


      const bottom =
        next
          ? (
              line.bottom
              + next.top
            ) / 2
          : line.bottom
            + typicalHeight * 0.8;


      return {
        top,
        bottom,
        words:
          line.words
      };
    }
  );
}


function analyzeNotebookRow(
  band,
  grid,
  canvas
) {
  const rowWords =
    band.words
    || [];


  const visualLines =
    groupNotebookWordsIntoVisualLines(
      rowWords
    );


  const lineSegments =
    visualLines.map(
      line =>
        notebookPhraseSegments(
          line.words
        )
    );


  const bestPhraseLine =
    lineSegments
      .slice()
      .sort(
        (
          a,
          b
        ) =>
          b.length
          - a.length
      )[0]
    || [];


  const vertical =
    grid?.vertical
      ?.slice()
      ?.sort(
        (
          a,
          b
        ) =>
          a - b
      )
    || [];


  const boundaries =
    notebookRowBoundaries(
      canvas,
      vertical,
      band.top,
      band.bottom
    );


  const dividerCells =
    boundaries.length >= 2
      ? boundaries.length - 1
      : 0;


  /*
    A estrutura de uma linha usa DUAS fontes:
    - divisórias visuais;
    - frases/números separados horizontalmente.

    Se o OCR encontra "10     20     30", isso é evidência
    de 3 células mesmo que a linha vertical esteja fraca.
  */
  const phraseCells =
    bestPhraseLine.length;


  const inferredCount =
    Math.max(
      1,
      dividerCells,
      phraseCells
    );


  return {
    ...band,
    visualLines,
    lineSegments,
    phraseReference:
      bestPhraseLine,
    boundaries,
    dividerCells,
    phraseCells,
    inferredCount
  };
}


function notebookRowCellsFromPhrases(
  descriptor
) {
  const reference =
    descriptor
      .phraseReference
    || [];


  if (
    !reference.length
  ) {
    return [];
  }


  if (
    reference.length === 1
  ) {
    return [
      {
        x:
          reference[0].x,

        text:
          notebookCellTextFromWords(
            descriptor.words
          )
      }
    ];
  }


  const anchors =
    reference.map(
      segment =>
        segment.x
    );


  const buckets =
    anchors.map(
      () =>
        []
    );


  descriptor
    .lineSegments
    .forEach(
      segments => {
        segments.forEach(
          segment => {
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
                  distance < bestDistance
                ) {
                  bestDistance =
                    distance;

                  bestIndex =
                    index;
                }
              }
            );


            buckets[
              bestIndex
            ].push(
              segment
            );
          }
        );
      }
    );


  return buckets.map(
    (
      segments,
      index
    ) => ({
      x:
        anchors[index],

      text:
        segments
          .sort(
            (
              a,
              b
            ) =>
              a.words?.[0]?.y
              - b.words?.[0]?.y
              ||
              a.x0 - b.x0
          )
          .map(
            segment =>
              segment.text
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


function notebookRowCellsFromDividers(
  descriptor
) {
  const boundaries =
    descriptor.boundaries
    || [];


  if (
    boundaries.length < 2
  ) {
    return [];
  }


  const cells =
    [];


  for (
    let index = 0;
    index < boundaries.length - 1;
    index += 1
  ) {
    const left =
      boundaries[
        index
      ];

    const right =
      boundaries[
        index + 1
      ];


    const words =
      descriptor.words.filter(
        word =>
          word.x > left
          &&
          word.x < right
      );


    cells.push({
      x:
        (
          left + right
        ) / 2,

      text:
        notebookCellTextFromWords(
          words
        )
    });
  }


  return cells;
}


function notebookReferenceAnchors(
  descriptors,
  baseColumns
) {
  const candidates =
    descriptors
      .map(
        descriptor => {
          const divider =
            notebookRowCellsFromDividers(
              descriptor
            );


          const phrases =
            notebookRowCellsFromPhrases(
              descriptor
            );


          const cells =
            divider.length
            >= phrases.length
              ? divider
              : phrases;


          return cells;
        }
      )
      .filter(
        cells =>
          cells.length
          === baseColumns
      );


  if (
    candidates.length
  ) {
    const best =
      candidates
        .slice()
        .sort(
          (
            a,
            b
          ) =>
            (
              b[
                b.length - 1
              ].x
              - b[0].x
            )
            -
            (
              a[
                a.length - 1
              ].x
              - a[0].x
            )
        )[0];


    return best.map(
      cell =>
        cell.x
    );
  }


  const allCenters =
    descriptors
      .flatMap(
        descriptor =>
          descriptor
            .phraseReference
            .map(
              segment =>
                segment.x
            )
      )
      .sort(
        (
          a,
          b
        ) =>
          a - b
      );


  if (
    !allCenters.length
  ) {
    return Array.from(
      {
        length:
          baseColumns
      },
      (
        _,
        index
      ) =>
        index
    );
  }


  const min =
    allCenters[0];

  const max =
    allCenters[
      allCenters.length - 1
    ];


  if (
    baseColumns === 1
  ) {
    return [
      (
        min + max
      ) / 2
    ];
  }


  return Array.from(
    {
      length:
        baseColumns
    },
    (
      _,
      index
    ) =>
      min
      + (
          max - min
        )
        * index
        / (
            baseColumns - 1
          )
  );
}


function mapNotebookCellsToLogicalColumns(
  cells,
  anchors,
  baseColumns
) {
  if (
    !cells.length
  ) {
    return [];
  }


  if (
    cells.length === 1
  ) {
    return [
      {
        text:
          cells[0].text,

        colspan:
          baseColumns
      }
    ];
  }


  const mappedIndexes =
    cells.map(
      cell => {
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
                - cell.x
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


        return bestIndex;
      }
    );


  /*
    Garante ordem crescente e evita duas células caírem
    na mesma coluna lógica.
  */
  for (
    let index = 1;
    index < mappedIndexes.length;
    index += 1
  ) {
    mappedIndexes[index] =
      Math.max(
        mappedIndexes[index],
        mappedIndexes[
          index - 1
        ] + 1
      );
  }


  for (
    let index = mappedIndexes.length - 1;
    index >= 0;
    index -= 1
  ) {
    const maxAllowed =
      baseColumns
      - (
          mappedIndexes.length
          - index
        );


    mappedIndexes[index] =
      Math.min(
        mappedIndexes[index],
        maxAllowed
      );
  }


  return cells.map(
    (
      cell,
      index
    ) => {
      const start =
        Math.max(
          0,
          mappedIndexes[index]
        );


      const next =
        index
        < cells.length - 1
          ? Math.max(
              start + 1,
              mappedIndexes[
                index + 1
              ]
            )
          : baseColumns;


      return {
        text:
          cell.text,

        colspan:
          Math.max(
            1,
            next - start
          )
      };
    }
  );
}


function notebookAtomicTokenType(
  value
) {
  const text =
    String(
      value
      || ""
    )
      .trim();


  if (
    !text
  ) {
    return null;
  }


  if (
    /^[-+]?\d+(?:[.,]\d+)?%?$/
      .test(
        text
      )
  ) {
    return "number";
  }


  if (
    /^[A-Za-zÀ-ÿ]$/
      .test(
        text
      )
  ) {
    return "letter";
  }


  if (
    /^(?:[<>]=?|[≤≥=±]|\+|-)$/
      .test(
        text
      )
  ) {
    return "symbol";
  }


  return null;
}


function notebookTableBounds(
  words,
  grid,
  canvas
) {
  const usable =
    notebookTableWordData(
      words
    );


  const vertical =
    grid?.vertical
      ?.slice()
      ?.sort(
        (
          a,
          b
        ) =>
          a - b
      )
    || [];


  if (
    vertical.length >= 2
  ) {
    return {
      left:
        vertical[0],

      right:
        vertical[
          vertical.length - 1
        ],

      width:
        Math.max(
          1,
          vertical[
            vertical.length - 1
          ]
          - vertical[0]
        )
    };
  }


  if (
    usable.length
  ) {
    const left =
      Math.min(
        ...usable.map(
          word =>
            word.x0
        )
      );


    const right =
      Math.max(
        ...usable.map(
          word =>
            word.x1
        )
      );


    return {
      left,
      right,
      width:
        Math.max(
          1,
          right - left
        )
    };
  }


  return {
    left:
      0,

    right:
      canvas?.width
      || 1,

    width:
      canvas?.width
      || 1
  };
}


function clusterNotebookXPositions(
  candidates,
  tolerance
) {
  if (
    !candidates.length
  ) {
    return [];
  }


  const ordered =
    candidates
      .slice()
      .sort(
        (
          a,
          b
        ) =>
          a.x - b.x
      );


  const clusters =
    [];


  for (
    const candidate
    of ordered
  ) {
    let cluster =
      clusters.find(
        item =>
          Math.abs(
            item.x
            - candidate.x
          )
          <= tolerance
      );


    if (
      !cluster
    ) {
      cluster = {
        x:
          candidate.x,

        weight:
          0,

        lines:
          new Set(),

        atomicWeight:
          0,

        values:
          []
      };


      clusters.push(
        cluster
      );
    }


    cluster.values.push(
      candidate
    );


    cluster.weight +=
      Number(
        candidate.weight
        || 1
      );


    if (
      candidate.atomic
    ) {
      cluster.atomicWeight +=
        Number(
          candidate.weight
          || 1
        );
    }


    if (
      Number.isInteger(
        candidate.lineIndex
      )
    ) {
      cluster.lines.add(
        candidate.lineIndex
      );
    }


    const totalWeight =
      cluster.values.reduce(
        (
          sum,
          item
        ) =>
          sum
          + Number(
              item.weight
              || 1
            ),
        0
      );


    cluster.x =
      cluster.values.reduce(
        (
          sum,
          item
        ) =>
          sum
          + item.x
          * Number(
              item.weight
              || 1
            ),
        0
      )
      / Math.max(
          1,
          totalWeight
        );
  }


  return clusters;
}


function notebookTextColumnAnchors(
  words,
  grid,
  canvas
) {
  const usable =
    notebookTableWordData(
      words
    );


  if (
    !usable.length
  ) {
    return {
      anchors: [],
      source:
        "none"
    };
  }


  const bounds =
    notebookTableBounds(
      usable,
      grid,
      canvas
    );


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


  const lines =
    groupNotebookWordsIntoVisualLines(
      usable
    );


  const candidates =
    [];


  lines.forEach(
    (
      line,
      lineIndex
    ) => {
      const segments =
        notebookPhraseSegments(
          line.words
        );


      segments.forEach(
        segment => {
          candidates.push({
            x:
              segment.x,

            weight:
              segments.length >= 2
                ? 1.8
                : 0.45,

            lineIndex,

            atomic:
              false,

            text:
              segment.text
          });
        }
      );


      line.words.forEach(
        (
          word,
          wordIndex
        ) => {
          const atomicType =
            notebookAtomicTokenType(
              word.text
            );


          if (
            !atomicType
          ) {
            return;
          }


          const previous =
            line.words[
              wordIndex - 1
            ]
            || null;


          const next =
            line.words[
              wordIndex + 1
            ]
            || null;


          const leftGap =
            previous
              ? word.x0
                - previous.x1
              : Number.POSITIVE_INFINITY;


          const rightGap =
            next
              ? next.x0
                - word.x1
              : Number.POSITIVE_INFINITY;


          /*
            Letras soltas só contam como coluna quando estão
            realmente isoladas. Assim, um "e" no meio de uma
            frase não vira uma coluna falsa.
          */
          const visiblyIsolated =
            (
              leftGap >=
                Math.max(
                  8,
                  typicalHeight * 0.75
                )
              ||
              !previous
            )
            &&
            (
              rightGap >=
                Math.max(
                  8,
                  typicalHeight * 0.75
                )
              ||
              !next
            );


          if (
            atomicType !== "number"
            &&
            !visiblyIsolated
          ) {
            return;
          }


          /*
            Números isolados são a evidência mais forte.
            Letras/símbolos isolados também ajudam a formar
            colunas, mas com peso um pouco menor.
          */
          candidates.push({
            x:
              word.x,

            weight:
              atomicType === "number"
                ? 4.5
                : 3.1,

            lineIndex,

            atomic:
              true,

            text:
              word.text
          });
        }
      );
    }
  );


  const tolerance =
    Math.max(
      10,
      typicalHeight * 1.5,
      bounds.width * 0.025
    );


  const clusters =
    clusterNotebookXPositions(
      candidates,
      tolerance
    );


  /*
    Âncoras de colunas à direita precisam se repetir em linhas
    diferentes OU ter forte evidência de números/letras.
  */
  const repeated =
    clusters
      .filter(
        cluster =>
          cluster.lines.size >= 2
          ||
          cluster.atomicWeight >= 7
      )
      .filter(
        cluster =>
          cluster.x
          >
          bounds.left
          + bounds.width * 0.16
      )
      .sort(
        (
          a,
          b
        ) =>
          a.x - b.x
      );


  /*
    Agrupa novamente clusters vizinhos, pois a palavra
    "Original" e os números abaixo podem ter centros
    ligeiramente diferentes.
  */
  const rightAnchors =
    [];


  repeated.forEach(
    cluster => {
      const previous =
        rightAnchors[
          rightAnchors.length - 1
        ];


      if (
        previous
        &&
        Math.abs(
          previous.x
          - cluster.x
        )
        <= tolerance * 1.35
      ) {
        const total =
          previous.weight
          + cluster.weight;


        previous.x =
          (
            previous.x
            * previous.weight
            + cluster.x
            * cluster.weight
          )
          / Math.max(
              1,
              total
            );


        previous.weight =
          total;


        previous.lines =
          new Set([
            ...previous.lines,
            ...cluster.lines
          ]);

      } else {
        rightAnchors.push({
          ...cluster,

          lines:
            new Set(
              cluster.lines
            )
        });
      }
    }
  );


  /*
    Primeira coluna é a coluna textual. Seu centro não é
    confiável porque frases têm comprimentos diferentes.
    Usamos a mediana dos inícios de linha.
  */
  const firstStarts =
    lines
      .map(
        line =>
          line.words[0]
            ?.x0
      )
      .filter(
        Number.isFinite
      );


  const firstAnchor =
    firstStarts.length
      ? medianNotebookNumber(
          firstStarts
        )
        + typicalHeight * 2
      : bounds.left
        + typicalHeight * 2;


  let anchors = [
    firstAnchor,
    ...rightAnchors.map(
      cluster =>
        cluster.x
    )
  ];


  /*
    Se a grade vertical parece consistente e indica MAIS
    colunas do que o texto, usa seus centros como apoio.
    Nunca reduz as colunas encontradas pelo texto.
  */
  const vertical =
    grid?.vertical
      ?.slice()
      ?.sort(
        (
          a,
          b
        ) =>
          a - b
      )
    || [];


  if (
    anchors.length <= 1
    &&
    vertical.length >= 3
  ) {
    /*
      A grade NÃO pode mais substituir uma estrutura descoberta
      pelas frases/números. Só entra como último fallback quando
      o conteúdo não conseguiu achar colunas.
    */
    const gridAnchors =
      [];


    for (
      let index = 0;
      index < vertical.length - 1;
      index += 1
    ) {
      gridAnchors.push(
        (
          vertical[index]
          + vertical[
              index + 1
            ]
        ) / 2
      );
    }


    anchors =
      gridAnchors;
  }


  anchors =
    anchors
      .sort(
        (
          a,
          b
        ) =>
          a - b
      )
      .filter(
        (
          value,
          index,
          array
        ) =>
          index === 0
          ||
          value
          - array[
              index - 1
            ]
          >
          tolerance * 0.9
      );


  /*
    Limite seguro: evita uma tabela de 8 colunas causada por
    números internos da própria frase.
  */
  if (
    anchors.length > 6
  ) {
    const scoredRight =
      rightAnchors
        .slice()
        .sort(
          (
            a,
            b
          ) =>
            (
              b.lines.size * 5
              + b.atomicWeight
            )
            -
            (
              a.lines.size * 5
              + a.atomicWeight
            )
        )
        .slice(
          0,
          5
        )
        .sort(
          (
            a,
            b
          ) =>
            a.x - b.x
        );


    anchors = [
      firstAnchor,
      ...scoredRight.map(
        item =>
          item.x
      )
    ];
  }


  return {
    anchors,

    source:
      rightAnchors.length
        ? "texto repetido"
        : vertical.length >= 3
          ? "grade"
          : "texto"
  };
}


function notebookColumnCuts(
  anchors
) {
  const cuts =
    [];


  for (
    let index = 0;
    index < anchors.length - 1;
    index += 1
  ) {
    cuts.push(
      (
        anchors[index]
        + anchors[
            index + 1
          ]
      ) / 2
    );
  }


  return cuts;
}


function notebookAssignWordsToAnchors(
  words,
  anchors
) {
  if (
    !anchors.length
  ) {
    return [
      notebookCellTextFromWords(
        words
      )
    ];
  }


  const cuts =
    notebookColumnCuts(
      anchors
    );


  const buckets =
    anchors.map(
      () =>
        []
    );


  notebookTableWordData(
    words
  )
    .forEach(
      word => {
        let index =
          0;


        while (
          index < cuts.length
          &&
          word.x > cuts[index]
        ) {
          index +=
            1;
        }


        buckets[
          Math.min(
            buckets.length - 1,
            index
          )
        ].push(
          word
        );
      }
    );


  return buckets.map(
    bucket =>
      notebookCellTextFromWords(
        bucket
      )
  );
}


function notebookBandVerticalEvidence(
  band,
  grid,
  canvas
) {
  const vertical =
    grid?.vertical
      ?.slice()
      ?.sort(
        (
          a,
          b
        ) =>
          a - b
      )
    || [];


  if (
    vertical.length < 3
  ) {
    return 1;
  }


  let count =
    1;


  for (
    let index = 1;
    index < vertical.length - 1;
    index += 1
  ) {
    const support =
      notebookVerticalEdgeSupport(
        canvas,
        vertical[index],
        band.top,
        band.bottom
      );


    if (
      support >= 0.24
    ) {
      count +=
        1;
    }
  }


  return count;
}


function buildNotebookTableStructureFromText(
  words,
  grid,
  canvas
) {
  const usable =
    notebookTableWordData(
      words
    );


  if (
    !usable.length
  ) {
    return null;
  }


  /*
    Descobre as colunas globais pela repetição de posições
    de frases, números e letras soltas.
  */
  const anchorInfo =
    notebookTextColumnAnchors(
      usable,
      grid,
      canvas
    );


  let anchors =
    anchorInfo.anchors
      ?.slice()
    || [];


  /*
    Fallback estrutural seguro:
    se o texto só encontrou 1 coluna, mas a grade realmente
    possui várias divisões verticais, usa os centros da grade.
    Se o texto já encontrou 2+ colunas, a grade NÃO sobrescreve.
  */
  if (
    anchors.length <= 1
    &&
    grid?.vertical
      ?.length >= 3
  ) {
    const vertical =
      grid.vertical
        .slice()
        .sort(
          (
            a,
            b
          ) =>
            a - b
        );


    anchors =
      [];


    for (
      let index = 0;
      index < vertical.length - 1;
      index += 1
    ) {
      anchors.push(
        (
          vertical[index]
          +
          vertical[
            index + 1
          ]
        ) / 2
      );
    }
  }


  if (
    !anchors.length
  ) {
    return null;
  }


  const baseColumns =
    Math.max(
      1,
      anchors.length
    );


  /*
    Quando temos linhas horizontais confiáveis, cada faixa
    corresponde a uma linha da tabela. Isso evita o OCR unir
    duas linhas diferentes ou ignorar o cabeçalho.
  */
  let bands =
    buildNotebookRowBands(
      usable,
      grid,
      canvas
    );


  if (
    !bands.length
  ) {
    bands =
      groupNotebookWordsIntoVisualLines(
        usable
      )
        .map(
          line => ({
            top:
              line.top,

            bottom:
              line.bottom,

            words:
              line.words
          })
        );
  }


  if (
    !bands.length
  ) {
    return null;
  }


  const rows =
    [];


  bands.forEach(
    (
      band,
      rowIndex
    ) => {
      const visualLines =
        groupNotebookWordsIntoVisualLines(
          band.words
        );


      const phraseGroups =
        visualLines
          .map(
            line =>
              notebookPhraseSegments(
                line.words
              )
          );


      const maxPhraseCells =
        Math.max(
          1,
          ...phraseGroups.map(
            groups =>
              groups.length
          )
        );


      const cellTexts =
        notebookAssignWordsToAnchors(
          band.words,
          anchors
        );


      const nonEmpty =
        cellTexts
          .map(
            (
              text,
              index
            ) => ({
              index,

              text:
                String(
                  text
                  || ""
                )
                  .replace(
                    /\s+/g,
                    " "
                  )
                  .trim()
            })
          )
          .filter(
            item =>
              item.text
          );


      if (
        !nonEmpty.length
      ) {
        return;
      }


      /*
        Conta quantas divisórias verticais existem DE FATO
        nesta linha. Em título/cabeçalho mesclado, as linhas
        verticais internas podem desaparecer.
       */
      const verticalEvidence =
        notebookBandVerticalEvidence(
          band,
          grid,
          canvas
        );


      /*
        Frases separadas e números/letras em posições distintas
        têm prioridade para provar que a linha possui colunas.
        Ex.: "Escore de Genebra   Original   Simplificado"
        continua sendo 3 células mesmo sem bordas verticais.
      */
      const contentEvidence =
        Math.max(
          maxPhraseCells,
          nonEmpty.length
        );


      const rowColumnEvidence =
        Math.max(
          verticalEvidence,
          contentEvidence
        );


      /*
        Linha realmente única: vira célula mesclada.
      */
      if (
        rowColumnEvidence <= 1
        &&
        baseColumns > 1
      ) {
        rows.push({
          cells: [
            {
              text:
                nonEmpty
                  .map(
                    item =>
                      item.text
                  )
                  .join(
                    " "
                  )
                  .trim(),

              colspan:
                baseColumns,

              header:
                rowIndex === 0
            }
          ]
        });


        return;
      }


      /*
        Para linha com colunas, sempre cria a quantidade global
        de células. Isso preserva células vazias e impede valores
        da direita de serem colados no texto da primeira coluna.
      */
      const cells =
        Array.from(
          {
            length:
              baseColumns
          },
          (
            _,
            index
          ) => ({
            text:
              String(
                cellTexts[index]
                || ""
              )
                .replace(
                  /\s+/g,
                  " "
                )
                .trim(),

            colspan:
              1,

            header:
              rowIndex === 0
          })
        );


      /*
        Se os anchors globais não separaram uma linha que o
        próprio texto claramente dividiu, usa os segmentos da
        linha mais informativa como recuperação local.
      */
      if (
        nonEmpty.length <= 1
        &&
        maxPhraseCells >= 2
      ) {
        const bestGroups =
          phraseGroups
            .slice()
            .sort(
              (
                a,
                b
              ) =>
                b.length - a.length
            )[0]
          || [];


        if (
          bestGroups.length >= 2
        ) {
          const localTexts =
            bestGroups.map(
              group =>
                group.text
            );


          for (
            let index = 0;
            index < Math.min(
              baseColumns,
              localTexts.length
            );
            index += 1
          ) {
            cells[index].text =
              localTexts[index];
          }
        }
      }


      rows.push({
        cells
      });
    }
  );


  if (
    !rows.length
  ) {
    return null;
  }


  return {
    baseColumns,
    rows,
    anchorSource:
      anchorInfo.source
  };
}


function buildNotebookTableStructureLineByLine(
  words,
  grid,
  canvas
) {
  /*
    A partir da v26, o TEXTO é a fonte principal:
    - frases separadas;
    - números isolados;
    - letras isoladas;
    - repetição de posições X entre linhas.

    A grade serve apenas de confirmação.
  */
  return buildNotebookTableStructureFromText(
    words,
    grid,
    canvas
  );
}


function rowsFromNotebookGrid(
  words,
  grid,
  canvas
) {
  return buildNotebookTableStructureLineByLine(
    words,
    grid,
    canvas
  );
}


function tableRowsFromOcrWords(
  words,
  canvas = null
) {
  return buildNotebookTableStructureLineByLine(
    words,
    null,
    canvas
  );
}


function mergeNotebookOcrWords(
  firstWords,
  secondWords
) {
  const merged =
    [];


  const add =
    word => {
      if (
        !word?.bbox
        ||
        !String(
          word.text
          || ""
        ).trim()
      ) {
        return;
      }


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


      const centerX =
        (
          x0 + x1
        ) / 2;

      const centerY =
        (
          y0 + y1
        ) / 2;


      const width =
        Math.max(
          1,
          x1 - x0
        );

      const height =
        Math.max(
          1,
          y1 - y0
        );


      const duplicateIndex =
        merged.findIndex(
          current => {
            const bbox =
              current.bbox;


            const currentCenterX =
              (
                Number(
                  bbox.x0
                )
                + Number(
                    bbox.x1
                  )
              ) / 2;


            const currentCenterY =
              (
                Number(
                  bbox.y0
                )
                + Number(
                    bbox.y1
                  )
              ) / 2;


            const currentWidth =
              Math.max(
                1,
                Number(
                  bbox.x1
                )
                - Number(
                    bbox.x0
                  )
              );


            const currentHeight =
              Math.max(
                1,
                Number(
                  bbox.y1
                )
                - Number(
                    bbox.y0
                  )
              );


            return (
              Math.abs(
                currentCenterX
                - centerX
              )
              <=
              Math.max(
                width,
                currentWidth
              ) * 0.45
              &&
              Math.abs(
                currentCenterY
                - centerY
              )
              <=
              Math.max(
                height,
                currentHeight
              ) * 0.55
            );
          }
        );


      if (
        duplicateIndex < 0
      ) {
        merged.push(
          word
        );

        return;
      }


      if (
        Number(
          word.confidence
          || 0
        )
        >
        Number(
          merged[
            duplicateIndex
          ].confidence
          || 0
        )
      ) {
        merged[
          duplicateIndex
        ] =
          word;
      }
    };


  (
    firstWords
    || []
  )
    .forEach(
      add
    );


  (
    secondWords
    || []
  )
    .forEach(
      add
    );


  return merged;
}



function notebookDominantRowColor(
  source,
  left,
  top,
  width,
  height
) {
  const context =
    source.getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
    );


  const image =
    context.getImageData(
      left,
      top,
      width,
      height
    );


  const counts =
    new Map();


  const step =
    Math.max(
      1,
      Math.floor(
        Math.min(
          width,
          height
        ) / 40
      )
    );


  for (
    let y = 0;
    y < height;
    y += step
  ) {
    for (
      let x = 0;
      x < width;
      x += step
    ) {
      const offset =
        (
          y * width
          + x
        ) * 4;


      const r =
        image.data[
          offset
        ];

      const g =
        image.data[
          offset + 1
        ];

      const b =
        image.data[
          offset + 2
        ];


      const qr =
        Math.floor(
          r / 16
        ) * 16;

      const qg =
        Math.floor(
          g / 16
        ) * 16;

      const qb =
        Math.floor(
          b / 16
        ) * 16;


      const key =
        `${qr},${qg},${qb}`;


      counts.set(
        key,
        (
          counts.get(
            key
          )
          || 0
        ) + 1
      );
    }
  }


  const best =
    Array.from(
      counts.entries()
    )
      .sort(
        (
          a,
          b
        ) =>
          b[1] - a[1]
      )[0]?.[0]
    || "240,240,240";


  const [
    r,
    g,
    b
  ] =
    best
      .split(",")
      .map(Number);


  return {
    r:
      Math.min(
        255,
        r + 8
      ),

    g:
      Math.min(
        255,
        g + 8
      ),

    b:
      Math.min(
        255,
        b + 8
      )
  };
}


function createNotebookRowOcrCanvas(
  source,
  rowTop,
  rowBottom,
  grid = null
) {
  const vertical =
    grid?.vertical
      ?.slice()
      ?.sort(
        (
          a,
          b
        ) =>
          a - b
      )
    || [];


  const left =
    vertical.length >= 2
      ? Math.max(
          0,
          Math.floor(
            vertical[0] + 2
          )
        )
      : 0;


  const right =
    vertical.length >= 2
      ? Math.min(
          source.width,
          Math.ceil(
            vertical[
              vertical.length - 1
            ] - 2
          )
        )
      : source.width;


  const top =
    Math.max(
      0,
      Math.floor(
        rowTop + 2
      )
    );


  const bottom =
    Math.min(
      source.height,
      Math.ceil(
        rowBottom - 2
      )
    );


  const cropWidth =
    Math.max(
      1,
      right - left
    );


  const cropHeight =
    Math.max(
      1,
      bottom - top
    );


  const context =
    source.getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
    );


  const image =
    context.getImageData(
      left,
      top,
      cropWidth,
      cropHeight
    );


  const background =
    notebookDominantRowColor(
      source,
      left,
      top,
      cropWidth,
      cropHeight
    );


  const binary =
    document.createElement(
      "canvas"
    );


  binary.width =
    cropWidth;

  binary.height =
    cropHeight;


  const binaryContext =
    binary.getContext(
      "2d",
      {
        alpha:
          false,
        willReadFrequently:
          true
      }
    );


  const output =
    binaryContext.createImageData(
      cropWidth,
      cropHeight
    );


  for (
    let offset = 0;
    offset < image.data.length;
    offset += 4
  ) {
    const r =
      image.data[
        offset
      ];

    const g =
      image.data[
        offset + 1
      ];

    const b =
      image.data[
        offset + 2
      ];


    const distance =
      Math.sqrt(
        (
          r - background.r
        ) ** 2
        +
        (
          g - background.g
        ) ** 2
        +
        (
          b - background.b
        ) ** 2
      );


    /*
      O fundo dominante vira branco.
      Tudo que destoa do fundo vira tinta preta.
      Isso funciona tanto para:
      - texto preto em fundo branco/cinza;
      - texto branco em cabeçalho azul.
    */
    const ink =
      distance >= 28;


    const value =
      ink
        ? 0
        : 255;


    output.data[
      offset
    ] =
      value;

    output.data[
      offset + 1
    ] =
      value;

    output.data[
      offset + 2
    ] =
      value;

    output.data[
      offset + 3
    ] =
      255;
  }


  binaryContext.putImageData(
    output,
    0,
    0
  );


  /*
    Apaga linhas verticais conhecidas para o OCR não
    transformá-las em I, l, | etc.
  */
  if (
    vertical.length
  ) {
    binaryContext.fillStyle =
      "#ffffff";


    for (
      const x
      of vertical
    ) {
      const localX =
        x - left;


      if (
        localX > 0
        &&
        localX < cropWidth
      ) {
        binaryContext.fillRect(
          Math.max(
            0,
            localX - 3
          ),
          0,
          7,
          cropHeight
        );
      }
    }
  }


  const targetHeight =
    Math.max(
      72,
      Math.min(
        120,
        cropHeight * 2.2
      )
    );


  const scale =
    Math.max(
      1,
      targetHeight
      / Math.max(
          1,
          cropHeight
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
        cropWidth * scale
      )
    );


  canvas.height =
    Math.max(
      1,
      Math.round(
        cropHeight * scale
      )
    );


  const canvasContext =
    canvas.getContext(
      "2d",
      {
        alpha:
          false,
        willReadFrequently:
          true
      }
    );


  canvasContext.fillStyle =
    "#ffffff";


  canvasContext.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  canvasContext.imageSmoothingEnabled =
    false;


  canvasContext.drawImage(
    binary,
    0,
    0,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );


  return {
    canvas,
    left,
    top,
    scale
  };
}


function notebookGridRowRanges(
  grid,
  canvas
) {
  const horizontal =
    grid?.horizontal
      ?.slice()
      ?.sort(
        (
          a,
          b
        ) =>
          a - b
      )
    || [];


  if (
    horizontal.length < 2
  ) {
    return [];
  }


  const ranges =
    [];


  for (
    let index = 0;
    index < horizontal.length - 1;
    index += 1
  ) {
    const top =
      horizontal[index];

    const bottom =
      horizontal[
        index + 1
      ];


    if (
      bottom - top >= 5
    ) {
      ranges.push({
        top,
        bottom
      });
    }
  }


  return ranges;
}


async function createNotebookTableWorker() {
  if (
    !window.Tesseract
      ?.createWorker
  ) {
    return null;
  }


  try {
    const worker =
      await window.Tesseract
        .createWorker(
          "por"
        );


    try {
      await worker
        .setParameters({
          tessedit_pageseg_mode:
            "6",

          preserve_interword_spaces:
            "1"
        });
    } catch {}


    return worker;

  } catch (
    error
  ) {
    console.warn(
      "Worker OCR por linha indisponível:",
      error
    );


    return null;
  }
}


function notebookWordsBackToSource(
  words,
  mapping
) {
  return (
    words
    || []
  )
    .filter(
      word =>
        word?.bbox
        &&
        String(
          word.text
          || ""
        ).trim()
    )
    .map(
      word => {
        const bbox =
          word.bbox;


        return {
          ...word,

          bbox: {
            x0:
              mapping.left
              +
              Number(
                bbox.x0
              )
              / mapping.scale,

            y0:
              mapping.top
              +
              Number(
                bbox.y0
              )
              / mapping.scale,

            x1:
              mapping.left
              +
              Number(
                bbox.x1
              )
              / mapping.scale,

            y1:
              mapping.top
              +
              Number(
                bbox.y1
              )
              / mapping.scale
          }
        };
      }
    );
}


async function recognizeNotebookRowsIndividually(
  source,
  grid
) {
  const ranges =
    notebookGridRowRanges(
      grid,
      source
    );


  if (
    !ranges.length
  ) {
    return [];
  }


  const worker =
    await createNotebookTableWorker();


  const allWords =
    [];


  try {
    for (
      let index = 0;
      index < ranges.length;
      index += 1
    ) {
      const range =
        ranges[index];


      setNotebookTableStatus(
        `Lendo linha ${index + 1} de ${ranges.length}...`
      );


      const prepared =
        createNotebookRowOcrCanvas(
          source,
          range.top,
          range.bottom,
          grid
        );


      let result;


      if (
        worker
      ) {
        result =
          await worker
            .recognize(
              prepared.canvas
            );

      } else {
        result =
          await window.Tesseract
            .recognize(
              prepared.canvas,
              "por"
            );
      }


      const mapped =
        notebookWordsBackToSource(
          notebookOcrWordsFromData(
            result?.data
          ),
          prepared
        );


      allWords.push(
        ...mapped
      );
    }


  } finally {
    if (
      worker
    ) {
      try {
        await worker
          .terminate();
      } catch {}
    }
  }


  return allWords;
}


function notebookLineHasIndependentColumnEvidence(
  line,
  grid,
  canvas
) {
  const segments =
    notebookPhraseSegments(
      line.words
    );


  if (
    segments.length >= 2
  ) {
    return true;
  }


  const vertical =
    grid?.vertical
      ?.slice()
      ?.sort(
        (
          a,
          b
        ) =>
          a - b
      )
    || [];


  if (
    vertical.length >= 3
  ) {
    const occupied =
      new Set();


    line.words
      .forEach(
        word => {
          for (
            let index = 0;
            index < vertical.length - 1;
            index += 1
          ) {
            if (
              word.x
              > vertical[index]
              &&
              word.x
              < vertical[
                  index + 1
                ]
            ) {
              occupied.add(
                index
              );

              break;
            }
          }
        }
      );


    if (
      occupied.size >= 2
    ) {
      return true;
    }
  }


  const isolatedNumbers =
    line.words.filter(
      word =>
        /^[-+]?\d+(?:[.,]\d+)?%?$/
          .test(
            String(
              word.text
              || ""
            )
              .trim()
          )
    );


  return isolatedNumbers.length >= 2;
}


function splitNotebookBandIntoLogicalRows(
  band,
  grid,
  canvas
) {
  const lines =
    groupNotebookWordsIntoVisualLines(
      band.words
    );


  if (
    lines.length <= 1
  ) {
    return [
      band
    ];
  }


  const groups =
    [];


  let current =
    [];


  let currentHasAnchor =
    false;


  for (
    const line
    of lines
  ) {
    const independent =
      notebookLineHasIndependentColumnEvidence(
        line,
        grid,
        canvas
      );


    if (
      independent
      &&
      current.length
      &&
      currentHasAnchor
    ) {
      groups.push(
        current
      );


      current =
        [];
      currentHasAnchor =
        false;
    }


    current.push(
      line
    );


    if (
      independent
    ) {
      currentHasAnchor =
        true;
    }
  }


  if (
    current.length
  ) {
    groups.push(
      current
    );
  }


  /*
    Se nenhum grupo ganhou evidência de colunas independentes,
    trata a faixa inteira como uma única linha com texto quebrado.
  */
  const evidenceCount =
    groups.filter(
      group =>
        group.some(
          line =>
            notebookLineHasIndependentColumnEvidence(
              line,
              grid,
              canvas
            )
        )
    ).length;


  if (
    evidenceCount <= 1
  ) {
    return [
      band
    ];
  }


  return groups.map(
    group => ({
      top:
        Math.min(
          ...group.map(
            line =>
              line.top
          )
        ),

      bottom:
        Math.max(
          ...group.map(
            line =>
              line.bottom
          )
        ),

      words:
        group.flatMap(
          line =>
            line.words
        )
    })
  );
}


function detectNotebookTableGeometryLoose(
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


  if (
    width < 20
    ||
    height < 20
  ) {
    return null;
  }


  const image =
    context.getImageData(
      0,
      0,
      width,
      height
    );


  const pixels =
    image.data;


  const horizontalCandidates =
    [];


  for (
    let y = 1;
    y < height;
    y += 1
  ) {
    let hits =
      0;

    let run =
      0;

    let longest =
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
        >= 6;


      if (
        edge
      ) {
        hits +=
          1;

        run +=
          1;

        longest =
          Math.max(
            longest,
            run
          );

      } else {
        run =
          0;
      }
    }


    if (
      (
        hits / width >= 0.32
      )
      ||
      longest >= width * 0.42
    ) {
      horizontalCandidates.push(
        y
      );
    }
  }


  const verticalCandidates =
    [];


  for (
    let x = 1;
    x < width;
    x += 1
  ) {
    let hits =
      0;

    let run =
      0;

    let longest =
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
        >= 6;


      if (
        edge
      ) {
        hits +=
          1;

        run +=
          1;

        longest =
          Math.max(
            longest,
            run
          );

      } else {
        run =
          0;
      }
    }


    if (
      (
        hits / height >= 0.10
        &&
        longest >= height * 0.055
      )
      ||
      longest >= height * 0.30
    ) {
      verticalCandidates.push(
        x
      );
    }
  }


  const gap =
    Math.max(
      3,
      Math.round(
        Math.min(
          width,
          height
        ) * 0.006
      )
    );


  let horizontal =
    groupNotebookLinePositions(
      horizontalCandidates,
      gap
    );


  let vertical =
    groupNotebookLinePositions(
      verticalCandidates,
      gap
    );


  const normalize =
    (
      values,
      minimumSpacing
    ) => {
      const result =
        [];


      values
        .slice()
        .sort(
          (
            a,
            b
          ) =>
            a - b
        )
        .forEach(
          value => {
            if (
              !result.length
              ||
              value
              - result[
                  result.length - 1
                ]
              >= minimumSpacing
            ) {
              result.push(
                value
              );

            } else {
              const last =
                result.length - 1;


              result[last] =
                Math.round(
                  (
                    result[last]
                    + value
                  ) / 2
                );
            }
          }
        );


      return result;
    };


  horizontal =
    normalize(
      horizontal,
      Math.max(
        5,
        Math.round(
          height * 0.018
        )
      )
    );


  vertical =
    normalize(
      vertical,
      Math.max(
        7,
        Math.round(
          width * 0.018
        )
      )
    );


  /*
    Bordas externas nem sempre geram diferença de pixel,
    porque ficam exatamente no limite da imagem.
  */
  if (
    !horizontal.length
    ||
    horizontal[0]
      > height * 0.05
  ) {
    horizontal.unshift(
      0
    );
  }


  if (
    horizontal[
      horizontal.length - 1
    ]
    < height * 0.95
  ) {
    horizontal.push(
      height - 1
    );
  }


  if (
    !vertical.length
    ||
    vertical[0]
      > width * 0.08
  ) {
    vertical.unshift(
      0
    );
  }


  if (
    vertical[
      vertical.length - 1
    ]
    < width * 0.92
  ) {
    vertical.push(
      width - 1
    );
  }


  horizontal =
    normalize(
      horizontal,
      Math.max(
        5,
        Math.round(
          height * 0.018
        )
      )
    );


  vertical =
    normalize(
      vertical,
      Math.max(
        7,
        Math.round(
          width * 0.018
        )
      )
    );


  if (
    horizontal.length < 2
    ||
    vertical.length < 2
    ||
    horizontal.length > 80
    ||
    vertical.length > 16
  ) {
    return null;
  }


  return {
    horizontal,
    vertical,
    method:
      "geometry-loose"
  };
}


function buildNotebookGeometryStructure(
  canvas,
  grid
) {
  if (
    !grid
    ||
    grid.horizontal.length < 2
    ||
    grid.vertical.length < 2
  ) {
    return null;
  }


  const horizontal =
    grid.horizontal
      .slice()
      .sort(
        (
          a,
          b
        ) =>
          a - b
      );


  const vertical =
    grid.vertical
      .slice()
      .sort(
        (
          a,
          b
        ) =>
          a - b
      );


  const baseColumns =
    vertical.length - 1;


  const rows =
    [];


  for (
    let rowIndex = 0;
    rowIndex < horizontal.length - 1;
    rowIndex += 1
  ) {
    const top =
      horizontal[
        rowIndex
      ];

    const bottom =
      horizontal[
        rowIndex + 1
      ];


    if (
      bottom - top < 5
    ) {
      continue;
    }


    const boundaries = [
      {
        x:
          vertical[0],

        logicalIndex:
          0
      }
    ];


    for (
      let columnIndex = 1;
      columnIndex < vertical.length - 1;
      columnIndex += 1
    ) {
      const x =
        vertical[
          columnIndex
        ];


      const support =
        notebookVerticalEdgeSupport(
          canvas,
          x,
          top + 2,
          bottom - 2
        );


      if (
        support >= 0.16
      ) {
        boundaries.push({
          x,
          logicalIndex:
            columnIndex
        });
      }
    }


    boundaries.push({
      x:
        vertical[
          vertical.length - 1
        ],

      logicalIndex:
        baseColumns
    });


    const cells =
      [];


    for (
      let index = 0;
      index < boundaries.length - 1;
      index += 1
    ) {
      const leftBoundary =
        boundaries[index];

      const rightBoundary =
        boundaries[
          index + 1
        ];


      cells.push({
        text:
          "",

        colspan:
          Math.max(
            1,
            rightBoundary.logicalIndex
            - leftBoundary.logicalIndex
          ),

        header:
          rowIndex === 0,

        sourceRect: {
          left:
            leftBoundary.x,

          top,

          right:
            rightBoundary.x,

          bottom
        }
      });
    }


    if (
      cells.length
    ) {
      rows.push({
        cells
      });
    }
  }


  if (
    !rows.length
  ) {
    return null;
  }


  return {
    baseColumns,
    rows,
    geometry:
      true
  };
}


function createNotebookCellOcrCanvas(
  source,
  rect
) {
  const inset =
    3;


  const left =
    Math.max(
      0,
      Math.floor(
        rect.left + inset
      )
    );


  const top =
    Math.max(
      0,
      Math.floor(
        rect.top + inset
      )
    );


  const right =
    Math.min(
      source.width,
      Math.ceil(
        rect.right - inset
      )
    );


  const bottom =
    Math.min(
      source.height,
      Math.ceil(
        rect.bottom - inset
      )
    );


  const width =
    Math.max(
      1,
      right - left
    );


  const height =
    Math.max(
      1,
      bottom - top
    );


  const sourceContext =
    source.getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
    );


  const image =
    sourceContext.getImageData(
      left,
      top,
      width,
      height
    );


  const background =
    notebookDominantRowColor(
      source,
      left,
      top,
      width,
      height
    );


  const binary =
    document.createElement(
      "canvas"
    );


  binary.width =
    width;

  binary.height =
    height;


  const outputContext =
    binary.getContext(
      "2d",
      {
        alpha:
          false,
        willReadFrequently:
          true
      }
    );


  const output =
    outputContext.createImageData(
      width,
      height
    );


  for (
    let offset = 0;
    offset < image.data.length;
    offset += 4
  ) {
    const r =
      image.data[
        offset
      ];

    const g =
      image.data[
        offset + 1
      ];

    const b =
      image.data[
        offset + 2
      ];


    const distance =
      Math.sqrt(
        (
          r - background.r
        ) ** 2
        +
        (
          g - background.g
        ) ** 2
        +
        (
          b - background.b
        ) ** 2
      );


    const luminance =
      (
        r * 0.299
        + g * 0.587
        + b * 0.114
      );


    const backgroundLuminance =
      (
        background.r * 0.299
        + background.g * 0.587
        + background.b * 0.114
      );


    /*
      Texto preto em fundo claro e texto branco em fundo azul
      viram ambos "tinta preta" no canvas OCR.
    */
    const ink =
      distance >= 24
      &&
      Math.abs(
        luminance
        - backgroundLuminance
      ) >= 18;


    const value =
      ink
        ? 0
        : 255;


    output.data[
      offset
    ] =
      value;

    output.data[
      offset + 1
    ] =
      value;

    output.data[
      offset + 2
    ] =
      value;

    output.data[
      offset + 3
    ] =
      255;
  }


  outputContext.putImageData(
    output,
    0,
    0
  );


  const targetHeight =
    Math.max(
      90,
      Math.min(
        150,
        height * 3
      )
    );


  const scale =
    Math.max(
      1,
      targetHeight
      /
      Math.max(
        1,
        height
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
        width * scale
      )
    );


  canvas.height =
    Math.max(
      1,
      Math.round(
        height * scale
      )
    );


  const context =
    canvas.getContext(
      "2d",
      {
        alpha:
          false
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
    false;


  context.drawImage(
    binary,
    0,
    0,
    width,
    height,
    0,
    0,
    canvas.width,
    canvas.height
  );


  return canvas;
}


function notebookOcrPlainText(
  data
) {
  const direct =
    String(
      data?.text
      || ""
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim();


  if (
    direct
  ) {
    return direct;
  }


  return notebookOcrWordsFromData(
    data
  )
    .map(
      word =>
        String(
          word.text
          || ""
        )
          .trim()
    )
    .filter(
      Boolean
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


async function recognizeNotebookGeometryCells(
  source,
  structure
) {
  const worker =
    await createNotebookTableWorker();


  let total =
    0;


  structure.rows
    .forEach(
      row =>
        row.cells
          .forEach(
            () => {
              total +=
                1;
            }
          )
    );


  let done =
    0;


  try {
    for (
      const row
      of structure.rows
    ) {
      for (
        const cell
        of row.cells
      ) {
        done +=
          1;


        setNotebookTableStatus(
          `Lendo célula ${done} de ${total}...`
        );


        const ocrCanvas =
          createNotebookCellOcrCanvas(
            source,
            cell.sourceRect
          );


        let result;


        if (
          worker
        ) {
          result =
            await worker
              .recognize(
                ocrCanvas
              );

        } else {
          result =
            await window.Tesseract
              .recognize(
                ocrCanvas,
                "por"
              );
        }


        cell.text =
          notebookOcrPlainText(
            result?.data
          );


        delete cell.sourceRect;
      }
    }


  } finally {
    if (
      worker
    ) {
      try {
        await worker
          .terminate();
      } catch {}
    }
  }


  return structure;
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
      "Detectando linhas e colunas pela própria imagem..."
    );


    const sourceCanvas =
      await prepareNotebookTableCanvas(
        file
      );


    /*
      NOVO CAMINHO:
      primeiro reconstrói a geometria da tabela pelos pixels.
      Só depois faz OCR dentro de cada célula.
      Não depende de data.words / TSV para descobrir estrutura.
    */
    let grid =
      detectNotebookTableGrid(
        sourceCanvas
      );


    if (
      !grid
    ) {
      grid =
        detectNotebookTableGeometryLoose(
          sourceCanvas
        );
    }


    let structure =
      buildNotebookGeometryStructure(
        sourceCanvas,
        grid
      );


    if (
      structure
      &&
      structure.rows.length
    ) {
      setNotebookTableStatus(
        `Estrutura detectada: ${structure.rows.length} linha(s), ${structure.baseColumns} coluna(s)-base. Agora lendo cada célula...`
      );


      structure =
        await recognizeNotebookGeometryCells(
          sourceCanvas,
          structure
        );


      renderNotebookTableBuilder(
        structure
      );


      const rowPattern =
        structure.rows
          .map(
            row =>
              row.cells.length
          )
          .join(
            " / "
          );


      setNotebookTableStatus(
        `Tabela reconstruída pela geometria: padrão ${rowPattern} célula(s) por linha. Revise o texto antes de inserir.`,
        "success"
      );


      return;
    }


    /*
      Fallback: se a imagem realmente não tiver grade detectável,
      usa o conteúdo textual antigo. Mas não é mais o caminho
      principal para tabelas com bordas/linhas.
    */
    setNotebookTableStatus(
      "Sem grade confiável. Tentando reconstrução pelo conteúdo..."
    );


    const enhancedCanvas =
      createNotebookTableOcrCanvas(
        sourceCanvas,
        null
      );


    const [
      originalResult,
      enhancedResult
    ] =
      await Promise.all([
        window.Tesseract
          .recognize(
            sourceCanvas,
            "por"
          ),

        window.Tesseract
          .recognize(
            enhancedCanvas,
            "por"
          )
      ]);


    const words =
      mergeNotebookOcrWords(
        notebookOcrWordsFromData(
          originalResult?.data
        ),
        notebookOcrWordsFromData(
          enhancedResult?.data
        )
      );


    structure =
      buildNotebookTableStructureFromText(
        words,
        null,
        sourceCanvas
      );


    if (
      !structure
      ||
      !structure.rows
        ?.length
    ) {
      /*
        Último recurso: não devolve erro vazio.
        Cria linhas editáveis a partir do texto OCR puro.
      */
      const plain =
        String(
          originalResult
            ?.data
            ?.text
          ||
          enhancedResult
            ?.data
            ?.text
          ||
          ""
        )
          .split(
            /\n+/
          )
          .map(
            line =>
              line.trim()
          )
          .filter(
            Boolean
          );


      if (
        !plain.length
      ) {
        throw new Error(
          "A imagem não contém uma grade ou texto legível suficiente."
        );
      }


      structure = {
        baseColumns:
          1,

        rows:
          plain.map(
            (
              text,
              rowIndex
            ) => ({
              cells: [
                {
                  text,
                  colspan:
                    1,
                  header:
                    rowIndex === 0
                }
              ]
            })
          )
      };
    }


    renderNotebookTableBuilder(
      structure
    );


    setNotebookTableStatus(
      "A grade não pôde ser detectada; montei uma versão editável pelo texto reconhecido.",
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
      "⚠ Atenção",

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

function notebookToolToggleId(
  name
) {
  return {
    list:
      "notebook-list-toggle",
    template:
      "notebook-template",
    divider:
      "notebook-divider",
    table:
      "notebook-table-toggle",
    image:
      "notebook-image-add",
    align:
      "notebook-align-toggle",
    callout:
      "notebook-callout-toggle"
  }[
    name
  ]
  || `notebook-${name}-toggle`;
}


function closeNotebookToolMenus(
  except = null
) {
  [
    "list",
    "template",
    "divider",
    "table",
    "image",
    "align",
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
            notebookToolToggleId(
              name
            )
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
      notebookToolToggleId(
        name
      )
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
          !note.topic_id
          || note.is_shared;


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
          <div class="notebook-library-row ${entry.note.is_shared ? "notebook-shared-note" : ""}">

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

              ${
                entry.note.is_shared
                  ? `
                    <span class="notebook-shared-badge">
                      ${sharedMembershipFor(entry.note.id)?.mode === "overlay" ? "Compartilhado · personalizado" : (sharedMembershipFor(entry.note.id)?.mode === "edit" ? "Compartilhado · edição" : "Compartilhado")}
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

            ${
              entry.note.is_shared
                ? ""
                : `
                  <button
                    class="notebook-share-button"
                    type="button"
                    data-share-note="${escapeHtml(entry.note.id)}"
                  >
                    Compartilhar
                  </button>
                `
            }

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
              && !note.is_shared
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


  list
    .querySelectorAll(
      "[data-share-note]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const entry =
              getLibraryEntries()
                .find(
                  item =>
                    item.note.id ===
                    button.dataset.shareNote
                );

            if (entry) {
              openNotebookShareDialog(
                [entry],
                entry.title || "Caderno LURIA"
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


  const shareButton =
    document.getElementById(
      "notebook-library-share"
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
    shareButton
  ) {
    const shareableCount =
      selectedEntries()
        .filter(
          entry =>
            !entry.note.is_shared
        )
        .length;

    shareButton.disabled =
      shareableCount === 0;
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

function createNotebookPdfPage(entry) {
  const host =
    document.createElement(
      "div"
    );

  host.className =
    "notebook-pdf-export-host";

  /*
    A exportação precisa ser independente do tema ativo.
    Sem isso, no modo escuro o navegador pode congelar
    texto branco e depois colocá-lo sobre uma folha branca.
  */
  host.style.setProperty(
    "color-scheme",
    "light"
  );

  host.style.setProperty(
    "--surface",
    "#ffffff"
  );

  host.style.setProperty(
    "--surface-2",
    "#f5f7fa"
  );

  host.style.setProperty(
    "--text",
    "#10243e"
  );

  host.style.setProperty(
    "--muted",
    "#64748b"
  );

  host.style.setProperty(
    "--border",
    "#d8e1eb"
  );

  host.style.setProperty(
    "--accent",
    "#184888"
  );

  host.style.setProperty(
    "--accent-soft",
    "#eaf0f8"
  );

  host.style.setProperty(
    "--success",
    "#18864b"
  );

  host.style.setProperty(
    "--danger",
    "#c33a3a"
  );

  const paper =
    document.createElement(
      "article"
    );

  paper.className =
    "notebook-paper notebook-pdf-paper";

  const head =
    document.createElement(
      "header"
    );

  head.className =
    "notebook-document-head";

  const headMain =
    document.createElement(
      "div"
    );

  headMain.className =
    "notebook-document-head-main";

  const area =
    document.createElement(
      "div"
    );

  area.className =
    "notebook-document-area";

  area.textContent =
    entry.area
    || "";

  const title =
    document.createElement(
      "h1"
    );

  title.textContent =
    entry.title
    || "Caderno";

  const date =
    document.createElement(
      "div"
    );

  date.className =
    "notebook-document-date";

  date.textContent =
    formatDate(
      entry.date
    );

  const editor =
    document.createElement(
      "div"
    );

  editor.className =
    "notebook-editor";

  editor.innerHTML =
    sanitizeHtml(
      entry.note?.is_shared
        ? applySharedNotebookPatch(
            entry.note
          )
        : (
            entry.note
              ?.content_html
            || ""
          )
    );

  headMain.append(
    area,
    title,
    date
  );

  head.appendChild(
    headMain
  );

  paper.append(
    head,
    editor
  );

  host.appendChild(
    paper
  );

  return {
    host,
    paper
  };
}


async function waitForPdfImages(root) {
  const images =
    Array.from(
      root.querySelectorAll(
        "img"
      )
    );

  await Promise.all(
    images.map(
      async (image) => {
        if (
          image.complete
          &&
          image.naturalWidth
        ) {
          return;
        }

        await new Promise(
          (resolve) => {
            const done =
              () => {
                image.removeEventListener(
                  "load",
                  done
                );

                image.removeEventListener(
                  "error",
                  done
                );

                resolve();
              };

            image.addEventListener(
              "load",
              done,
              {
                once: true
              }
            );

            image.addEventListener(
              "error",
              done,
              {
                once: true
              }
            );

            setTimeout(
              done,
              5000
            );
          }
        );
      }
    )
  );
}


function stabilizeNotebookPdfStyles(
  root
) {
  if (!root) {
    return;
  }

  const nodes =
    [
      root,
      ...root.querySelectorAll("*")
    ];

  for (
    const node
    of nodes
  ) {
    if (
      !(node instanceof HTMLElement)
    ) {
      continue;
    }

    const style =
      getComputedStyle(
        node
      );

    /*
      html2canvas 1.4.1 pode falhar no Safari/PWA ao
      interpretar color-mix()/cores modernas presentes
      nos estilos do app. Copiamos apenas valores já
      computados pelo navegador e removemos efeitos
      decorativos desnecessários para o PDF.
    */
    if (style.color) {
      node.style.color =
        style.color;
    }

    if (style.backgroundColor) {
      node.style.backgroundColor =
        style.backgroundColor;
    }

    if (
      style.borderTopColor
      &&
      style.borderTopStyle !== "none"
    ) {
      node.style.borderTopColor =
        style.borderTopColor;
    }

    if (
      style.borderRightColor
      &&
      style.borderRightStyle !== "none"
    ) {
      node.style.borderRightColor =
        style.borderRightColor;
    }

    if (
      style.borderBottomColor
      &&
      style.borderBottomStyle !== "none"
    ) {
      node.style.borderBottomColor =
        style.borderBottomColor;
    }

    if (
      style.borderLeftColor
      &&
      style.borderLeftStyle !== "none"
    ) {
      node.style.borderLeftColor =
        style.borderLeftColor;
    }

    node.style.boxShadow =
      "none";

    node.style.textShadow =
      "none";

    node.style.filter =
      "none";

    if (
      style.backgroundImage
      &&
      /color-mix\(|oklch\(|oklab\(/i
        .test(
          style.backgroundImage
        )
    ) {
      node.style.backgroundImage =
        "none";
    }
  }

  root.style.background =
    "#ffffff";

  root.style.color =
    "#10243e";

  root.style.boxShadow =
    "none";
}


function notebookPdfHasMeaningfulContent(
  entry
) {
  const html =
    String(
      entry?.note?.is_shared
        ? applySharedNotebookPatch(
            entry.note
          )
        : (
            entry?.note?.content_html
            || ""
          )
    );

  const probe =
    document.createElement(
      "div"
    );

  probe.innerHTML =
    sanitizeHtml(
      html
    );

  return Boolean(
    probe.textContent
      ?.trim()
    || probe.querySelector(
      "img,table,hr,.notebook-study-block"
    )
  );
}


function notebookPdfCanvasLooksBlank(
  canvas
) {
  if (
    !canvas
    || !canvas.width
    || !canvas.height
  ) {
    return true;
  }

  const sample =
    document.createElement(
      "canvas"
    );

  sample.width =
    48;

  sample.height =
    48;

  const context =
    sample.getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
    );

  context.drawImage(
    canvas,
    0,
    0,
    sample.width,
    sample.height
  );

  const pixels =
    context.getImageData(
      0,
      0,
      sample.width,
      sample.height
    ).data;

  let nonWhite =
    0;

  for (
    let index = 0;
    index < pixels.length;
    index += 4
  ) {
    const red =
      pixels[index];

    const green =
      pixels[index + 1];

    const blue =
      pixels[index + 2];

    const alpha =
      pixels[index + 3];

    if (
      alpha > 20
      &&
      (
        red < 246
        || green < 246
        || blue < 246
      )
    ) {
      nonWhite +=
        1;
    }
  }

  return (
    nonWhite
    <
    10
  );
}


async function renderNotebookPdfCanvasAttempt(
  paper,
  options = {}
) {
  const width =
    Math.max(
      940,
      Math.ceil(
        paper.scrollWidth
        || paper.getBoundingClientRect().width
        || 940
      )
    );

  const height =
    Math.max(
      1120,
      Math.ceil(
        paper.scrollHeight
        || paper.getBoundingClientRect().height
        || 1120
      )
    );

  return window.html2canvas(
    paper,
    {
      scale:
        options.scale
        || 2,

      useCORS:
        true,

      allowTaint:
        false,

      logging:
        false,

      backgroundColor:
        "#ffffff",

      width,
      height,

      windowWidth:
        width,

      windowHeight:
        height,

      scrollX:
        0,

      scrollY:
        0,

      imageTimeout:
        15000,

      removeContainer:
        true,

      foreignObjectRendering:
        Boolean(
          options.foreignObjectRendering
        ),

      onclone:
        (clonedDocument) => {
          const clonedHost =
            clonedDocument.querySelector(
              ".notebook-pdf-export-host"
            );

          if (clonedHost) {
            clonedHost.style.position =
              "absolute";
            clonedHost.style.left =
              "0";
            clonedHost.style.top =
              "0";
            clonedHost.style.zIndex =
              "0";
            clonedHost.style.visibility =
              "visible";
            clonedHost.style.opacity =
              "1";
          }

          const clonedPaper =
            clonedDocument.querySelector(
              ".notebook-pdf-paper"
            );

          if (clonedPaper) {
            clonedPaper.style.visibility =
              "visible";
            clonedPaper.style.opacity =
              "1";
            clonedPaper.style.transform =
              "none";
          }
        }
    }
  );
}


function collectNotebookPdfProtectedRanges(
  paper
) {
  if (!paper) {
    return [];
  }

  const paperRect =
    paper.getBoundingClientRect();

  return Array.from(
    paper.querySelectorAll(
      ".notebook-study-block"
    )
  )
    .map(
      block => {
        const rect =
          block.getBoundingClientRect();

        return {
          top:
            rect.top
            - paperRect.top,
          bottom:
            rect.bottom
            - paperRect.top
        };
      }
    )
    .filter(
      range =>
        Number.isFinite(
          range.top
        )
        &&
        Number.isFinite(
          range.bottom
        )
        &&
        range.bottom
        >
        range.top
    );
}


async function renderNotebookPdfCanvas(
  entry
) {
  if (
    !window.html2canvas
  ) {
    throw new Error(
      "O renderizador visual do PDF não foi carregado."
    );
  }

  const {
    host,
    paper
  } =
    createNotebookPdfPage(
      entry
    );

  document.body.appendChild(
    host
  );

  try {
    await document.fonts
      ?.ready;

    await waitForPdfImages(
      paper
    );

    /*
      Safari/iOS pode devolver canvas branco quando a folha está
      muito fora do viewport ou ainda não passou por um ciclo de layout.
      Forçamos layout e dois frames antes da captura.
    */
    void paper.offsetHeight;

    await new Promise(
      resolve =>
        requestAnimationFrame(
          () =>
            requestAnimationFrame(
              resolve
            )
        )
    );

    stabilizeNotebookPdfStyles(
      paper
    );

    void paper.offsetHeight;

    await new Promise(
      resolve =>
        requestAnimationFrame(
          resolve
        )
    );

    /*
      O canvas tradicional é mais confiável no Safari/PWA
      e preserva bem tabelas, callouts e estilos depois da
      estabilização acima. ForeignObject fica como fallback,
      pois em alguns WebKit ele pode retornar uma página
      totalmente branca sem lançar erro.
    */
    const hasContent =
      notebookPdfHasMeaningfulContent(
        entry
      );

    try {
      const canvas =
        await renderNotebookPdfCanvasAttempt(
          paper,
          {
            scale:
              2.1,

            foreignObjectRendering:
              false
          }
        );

      if (
        hasContent
        &&
        notebookPdfCanvasLooksBlank(
          canvas
        )
      ) {
        throw new Error(
          "A captura visual voltou vazia apesar de o caderno possuir conteúdo."
        );
      }

      return {
        canvas,
        protectedRanges:
          collectNotebookPdfProtectedRanges(
            paper
          ),
        sourceCssHeight:
          Math.max(
            1,
            paper.getBoundingClientRect().height
          )
      };

    } catch (
      canvasError
    ) {
      console.warn(
        "Captura canvas falhou ou voltou vazia; tentando ForeignObject:",
        canvasError
      );

      const fallbackCanvas =
        await renderNotebookPdfCanvasAttempt(
          paper,
          {
            scale:
              1.8,

            foreignObjectRendering:
              true
          }
        );

      if (
        hasContent
        &&
        notebookPdfCanvasLooksBlank(
          fallbackCanvas
        )
      ) {
        throw new Error(
          "Os dois métodos de captura retornaram uma página vazia."
        );
      }

      return {
        canvas:
          fallbackCanvas,
        protectedRanges:
          collectNotebookPdfProtectedRanges(
            paper
          ),
        sourceCssHeight:
          Math.max(
            1,
            paper.getBoundingClientRect().height
          )
      };
    }
  }

  finally {
    host.remove();
  }
}

function addNotebookCanvasToPdf(
  doc,
  canvas,
  firstPage = false,
  assets = null,
  protectedRanges = [],
  sourceCssHeight = null
) {
  const pageWidth =
    210;

  const pageHeight =
    297;

  const horizontalMargin =
    12;

  const contentTop =
    26;

  const contentBottom =
    16;

  const drawWidth =
    pageWidth
    -
    (
      horizontalMargin
      * 2
    );

  const drawHeight =
    pageHeight
    -
    contentTop
    -
    contentBottom;

  const sourcePageHeight =
    Math.floor(
      canvas.width
      *
      (
        drawHeight
        /
        drawWidth
      )
    );

  const canvasScaleY =
    sourceCssHeight
      ? (
          canvas.height
          /
          sourceCssHeight
        )
      : 1;

  const protectedCanvasRanges =
    protectedRanges
      .map(
        range => ({
          top:
            Math.max(
              0,
              Math.floor(
                range.top
                *
                canvasScaleY
              )
            ),
          bottom:
            Math.min(
              canvas.height,
              Math.ceil(
                range.bottom
                *
                canvasScaleY
              )
            )
        })
      )
      .filter(
        range =>
          range.bottom
          >
          range.top
      );

  let sourceY =
    0;

  let sliceIndex =
    0;

  while (
    sourceY
    <
    canvas.height
  ) {
    if (
      !firstPage
      ||
      sliceIndex
      >
      0
    ) {
      doc.addPage();
    }

    let sliceHeight =
      Math.min(
        sourcePageHeight,
        canvas.height
        -
        sourceY
      );

    let proposedEnd =
      sourceY
      +
      sliceHeight;

    /*
      Callouts são blocos atômicos na exportação.
      Se a quebra de página cair no meio de um callout,
      terminamos a página imediatamente antes dele e
      movemos o bloco inteiro para a página seguinte.
    */
    for (
      const range
      of protectedCanvasRanges
    ) {
      const cutsBlock =
        range.top
        >
        sourceY
        &&
        range.top
        <
        proposedEnd
        &&
        range.bottom
        >
        proposedEnd;

      if (
        cutsBlock
      ) {
        proposedEnd =
          range.top;

        sliceHeight =
          proposedEnd
          -
          sourceY;

        break;
      }
    }

    /*
      Proteção contra uma página vazia em casos extremos.
      Um callout maior que uma página inteira é mantido
      o máximo possível, mas não trava o exportador.
    */
    if (
      sliceHeight
      <=
      1
    ) {
      sliceHeight =
        Math.min(
          sourcePageHeight,
          canvas.height
          -
          sourceY
        );
    }

    const pageCanvas =
      document.createElement(
        "canvas"
      );

    pageCanvas.width =
      canvas.width;

    pageCanvas.height =
      sliceHeight;

    const context =
      pageCanvas.getContext(
        "2d",
        {
          alpha:
            false
        }
      );

    context.fillStyle =
      "#ffffff";

    context.fillRect(
      0,
      0,
      pageCanvas.width,
      pageCanvas.height
    );

    context.drawImage(
      canvas,
      0,
      sourceY,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight
    );

    const renderedHeight =
      drawWidth
      *
      (
        sliceHeight
        /
        canvas.width
      );

    doc.addImage(
      pageCanvas.toDataURL(
        "image/png"
      ),
      "PNG",
      horizontalMargin,
      contentTop,
      drawWidth,
      renderedHeight,
      undefined,
      "MEDIUM"
    );

    window.LuriaPdfBranding
      ?.decoratePage(
        doc,
        assets,
        {
          title:
            "Caderno",
          subtitle:
            "Exportação visual"
        }
      );

    sourceY +=
      sliceHeight;

    sliceIndex +=
      1;
  }
}


function notebookExportPlainText(
  entry
) {
  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.innerHTML =
    sanitizeHtml(
      entry.note?.is_shared
        ? applySharedNotebookPatch(
            entry.note
          )
        : (
            entry.note
              ?.content_html
            || ""
          )
    );

  wrapper
    .querySelectorAll(
      "br"
    )
    .forEach(
      br =>
        br.replaceWith(
          "\n"
        )
    );

  wrapper
    .querySelectorAll(
      "p,div,h1,h2,h3,h4,h5,h6,li,tr"
    )
    .forEach(
      node => {
        node.append(
          document.createTextNode(
            "\n"
          )
        );
      }
    );

  return String(
    wrapper.textContent
    || ""
  )
    .replace(
      /\n[ \t]+/g,
      "\n"
    )
    .replace(
      /\n{3,}/g,
      "\n\n"
    )
    .trim();
}


function addNotebookStructuredFallback(
  doc,
  entry,
  firstPage = false,
  assets = null
) {
  if (!firstPage) {
    doc.addPage();
  }

  const left =
    16;

  const right =
    16;

  const top =
    29;

  const bottom =
    18;

  const pageWidth =
    doc.internal.pageSize
      .getWidth();

  const pageHeight =
    doc.internal.pageSize
      .getHeight();

  const contentWidth =
    pageWidth
    -
    left
    -
    right;

  let y =
    top;

  const decorate =
    () => {
      window.LuriaPdfBranding
        ?.decoratePage(
          doc,
          assets,
          {
            title:
              "Caderno",
            subtitle:
              "Exportação compatível"
          }
        );
    };

  decorate();

  doc.setTextColor(
    16,
    36,
    62
  );

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(
    14
  );

  const title =
    entry.title
    || "Caderno";

  const titleLines =
    doc.splitTextToSize(
      title,
      contentWidth
    );

  doc.text(
    titleLines,
    left,
    y
  );

  y +=
    titleLines.length
    * 6
    +
    2;

  const meta =
    [
      entry.area,
      formatDate(
        entry.date
      )
    ]
      .filter(
        Boolean
      )
      .join(
        " · "
      );

  if (meta) {
    doc.setTextColor(
      100,
      116,
      139
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(
      8.5
    );

    doc.text(
      meta,
      left,
      y
    );

    y +=
      7;
  }

  const text =
    notebookExportPlainText(
      entry
    )
    || "Caderno sem conteúdo textual.";

  const paragraphs =
    text.split(
      /\n+/g
    )
      .map(
        item =>
          item.trim()
      )
      .filter(
        Boolean
      );

  doc.setTextColor(
    15,
    23,
    42
  );

  for (
    const paragraph
    of paragraphs
  ) {
    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(
      9.5
    );

    const lines =
      doc.splitTextToSize(
        paragraph,
        contentWidth
      );

    const blockHeight =
      lines.length
      * 4.6
      +
      2.5;

    if (
      y
      +
      blockHeight
      >
      pageHeight
      -
      bottom
    ) {
      doc.addPage();

      decorate();

      y =
        top;
    }

    doc.text(
      lines,
      left,
      y
    );

    y +=
      blockHeight;
  }
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

  const exportButton =
    document.getElementById(
      "notebook-library-export"
    );

  const originalLabel =
    exportButton
      ?.textContent
    || "";

  if (
    exportButton
  ) {
    exportButton.disabled =
      true;

    exportButton.textContent =
      "Gerando PDF...";
  }

  const doc =
    new jsPDF({
      unit:
        "mm",

      format:
        "a4",

      orientation:
        "portrait",

      compress:
        true
    });

  let assets =
    null;

  try {
    try {
      assets =
        await window.LuriaPdfBranding
          ?.getAssets?.();
    } catch (
      brandingError
    ) {
      console.warn(
        "Branding do PDF indisponível; exportando sem imagem de marca:",
        brandingError
      );

      assets =
        null;
    }

    for (
      let index = 0;
      index < entries.length;
      index += 1
    ) {
      const entry =
        entries[index];

      try {
        const visual =
          await renderNotebookPdfCanvas(
            entry
          );

        addNotebookCanvasToPdf(
          doc,
          visual.canvas,
          index === 0,
          assets,
          visual.protectedRanges,
          visual.sourceCssHeight
        );

      } catch (
        visualError
      ) {
        console.warn(
          "Captura visual do caderno falhou; usando exportação compatível:",
          visualError
        );

        addNotebookStructuredFallback(
          doc,
          entry,
          index === 0,
          assets
        );
      }
    }

    window.LuriaPdfBranding
      ?.finalize(
        doc
      );

    doc.save(
      "luria-cadernos.pdf"
    );
  }

  catch (error) {
    console.error(
      error
    );

    alert(
      `Não foi possível gerar o PDF: ${error.message || "erro desconhecido"}`
    );
  }

  finally {
    if (
      exportButton
    ) {
      exportButton.disabled =
        false;

      exportButton.textContent =
        originalLabel;
    }
  }
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
    current?.note?.is_shared
  ) {
    notebookState.librarySelected =
      new Set([
        current.note.id
      ]);

    await deleteSelectedNotes();

    closeDocumentMenu();

    return;
  }

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


  const sharedEntries =
    entries.filter(
      entry =>
        entry.note.is_shared
    );


  const ownedEntries =
    entries.filter(
      entry =>
        !entry.note.is_shared
    );


  const parts = [];

  if (ownedEntries.length) {
    parts.push(
      `${ownedEntries.length} caderno${ownedEntries.length === 1 ? "" : "s"} seu${ownedEntries.length === 1 ? "" : "s"} será${ownedEntries.length === 1 ? "" : "ão"} apagado${ownedEntries.length === 1 ? "" : "s"}`
    );
  }

  if (sharedEntries.length) {
    parts.push(
      `${sharedEntries.length} material${sharedEntries.length === 1 ? "" : "is"} compartilhado${sharedEntries.length === 1 ? "" : "s"} será${sharedEntries.length === 1 ? "" : "ão"} removido${sharedEntries.length === 1 ? "" : "s"} da sua biblioteca sem apagar o original`
    );
  }


  const confirmed =
    window.confirm(
      `${parts.join(". ")}. Continuar?`
    );


  if (!confirmed) {
    return;
  }


  const currentNoteId =
    getCurrentDocument()
      ?.note
      ?.id
    || null;


  if (ownedEntries.length) {
    const ownedIds =
      ownedEntries.map(
        entry =>
          entry.note.id
      );


    const {
      error:
        deleteOwnedError
    } =
      await notebookSb
        .from(
          "study_notes"
        )
        .delete()
        .in(
          "id",
          ownedIds
        )
        .eq(
          "user_id",
          notebookState.user.id
        );


    if (deleteOwnedError) {
      console.error(
        deleteOwnedError
      );

      alert(
        `Não foi possível apagar seus cadernos: ${deleteOwnedError.message}`
      );

      return;
    }
  }


  if (sharedEntries.length) {
    const sharedIds =
      sharedEntries.map(
        entry =>
          entry.note.id
      );


    const [
      overlayResult,
      memberResult
    ] =
      await Promise.all([
        notebookSb
          .from(
            "study_note_overlays"
          )
          .delete()
          .eq(
            "user_id",
            notebookState.user.id
          )
          .in(
            "note_id",
            sharedIds
          ),

        notebookSb
          .from(
            "study_note_members"
          )
          .delete()
          .eq(
            "user_id",
            notebookState.user.id
          )
          .in(
            "note_id",
            sharedIds
          )
      ]);


    if (
      overlayResult.error
      || memberResult.error
    ) {
      const error =
        overlayResult.error
        || memberResult.error;

      console.error(
        error
      );

      alert(
        `Não foi possível remover o material compartilhado: ${error.message}`
      );

      return;
    }
  }


  const ids =
    entries.map(
      entry =>
        entry.note.id
    );


  entries.forEach(
    entry => {
      notebookState
        .notesById
        .delete(
          entry.note.id
        );


      if (
        entry.note.topic_id
      ) {
        const mapped =
          notebookState
            .notesByTopic
            .get(
              entry.note.topic_id
            );


        if (
          mapped?.id ===
          entry.note.id
        ) {
          notebookState
            .notesByTopic
            .delete(
              entry.note.topic_id
            );
        }
      }


      notebookState
        .sharedMemberships
        .delete(
          entry.note.id
        );


      notebookState
        .overlays
        .delete(
          entry.note.id
        );
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
    .getElementById(
      "notebook-topic-panel-toggle"
    )
    ?.addEventListener(
      "click",
      toggleNotebookTopicPanel
    );


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
      "keydown",
      (event) => {
        if (
          removeAdjacentNotebookDivider(
            event
          )
        ) {
          return;
        }


        keepCaretOutsideNotebookDivider(
          event
        );


        if (
          event.defaultPrevented
        ) {
          return;
        }


        handleNotebookEditorTableBackspace(
          event
        );


        if (
          event.defaultPrevented
        ) {
          return;
        }


        handleNotebookEditorTableEnter(
          event
        );
      }
    );


  editor
    ?.addEventListener(
      "pointerdown",
      (event) => {
        const divider =
          event.target
            ?.closest?.(
              ".notebook-divider"
            );


        if (
          !divider
          || !notebookState.editorEditable
        ) {
          return;
        }


        event.preventDefault();


        const rect =
          divider.getBoundingClientRect();


        const goAbove =
          event.clientY
          <
          rect.top
          +
          rect.height / 2;


        let target =
          goAbove
            ? divider.previousElementSibling
            : divider.nextElementSibling;


        if (!target) {
          target =
            document.createElement(
              "p"
            );

          target.innerHTML =
            "<br>";


          if (goAbove) {
            divider.before(
              target
            );
          } else {
            divider.after(
              target
            );
          }
        }


        const selection =
          window.getSelection();


        const range =
          document.createRange();


        range.selectNodeContents(
          target
        );


        range.collapse(
          goAbove
            ? false
            : true
        );


        selection.removeAllRanges();
        selection.addRange(
          range
        );


        saveSelection();
      }
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


        event.target.title =
          event.target
            .selectedOptions?.[0]
            ?.textContent
            ?.trim()
          || "Estilo do texto";

      }
    );


  document
    .getElementById(
      "notebook-font-family"
    )
    ?.addEventListener(
      "change",
      (event) => {
        const font =
          event.target.value;


        if (font) {
          applyNotebookFont(
            font
          );
        }


        event.target.title =
          event.target
            .selectedOptions?.[0]
            ?.textContent
            ?.trim()
          || "Fonte";
      }
    );


  document
    .querySelectorAll(
      "[data-align]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "mousedown",
          event =>
            event.preventDefault()
        );


        button.addEventListener(
          "click",
          () => {
            const alignment =
              button.dataset
                .align;

            applyNotebookAlignment(
              alignment
            );

            const icon =
              document.getElementById(
                "notebook-align-current-icon"
              );

            const glyphs = {
              left:
                "☰",
              center:
                "≡",
              right:
                "☷",
              justify:
                "▤"
            };

            if (icon) {
              icon.textContent =
                glyphs[alignment]
                || "☰";
            }

            const toggle =
              document.getElementById(
                "notebook-align-toggle"
              );

            if (toggle) {
              const labels = {
                left:
                  "Alinhar à esquerda",
                center:
                  "Centralizar",
                right:
                  "Alinhar à direita",
                justify:
                  "Justificar"
              };

              toggle.title =
                labels[alignment]
                || "Alinhamento";
            }

            closeNotebookToolMenus();
          }
        );
      }
    );


  document
    .querySelectorAll(
      "[data-line-spacing]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "mousedown",
          event =>
            event.preventDefault()
        );

        button.addEventListener(
          "click",
          () => {
            const spacing =
              button.dataset
                .lineSpacing;

            if (!spacing) {
              return;
            }

            applyNotebookLineSpacing(
              spacing
            );

            const current =
              document.getElementById(
                "notebook-spacing-current"
              );

            if (current) {
              const labels = {
                "1":
                  "1,0",
                "1.15":
                  "1,15",
                "1.5":
                  "1,5",
                "2":
                  "2,0"
              };

              current.textContent =
                labels[spacing]
                || spacing;

              current.classList.add(
                "is-value"
              );
            }

            const toggle =
              document.getElementById(
                "notebook-line-spacing"
              );

            if (toggle) {
              toggle.title =
                `Espaçamento ${spacing.replace(".", ",")}`;
            }

            closeNotebookToolMenus();
          }
        );
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
            () => {
              execEditorCommand(
                command
              );

              let isActive =
                false;

              try {
                isActive =
                  document.queryCommandState(
                    command
                  );
              } catch (
                error
              ) {
                isActive =
                  button.classList.contains(
                    "is-active"
                  )
                  ? false
                  : true;
              }

              button.classList.toggle(
                "is-active",
                isActive
              );

              button.setAttribute(
                "aria-pressed",
                isActive
                  ? "true"
                  : "false"
              );
            }
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


  const notebookToolMenuToggles = {
    list:
      "notebook-list-toggle",
    template:
      "notebook-template",
    divider:
      "notebook-divider",
    table:
      "notebook-table-toggle",
    image:
      "notebook-image-add",
    align:
      "notebook-align-toggle",
    callout:
      "notebook-callout-toggle",
    spacing:
      "notebook-line-spacing"
  };

  // iOS/PWA: o WebKit instalado pode engolir o click sintetizado
  // depois de tocar em controles dentro da toolbar sticky. Tratamos touchend
  // como a ativação real e cancelamos o click fantasma subsequente.
  const notebookToolbar =
    document.querySelector(
      ".notebook-toolbar"
    );

  let notebookLastTouchActivation =
    0;

  notebookToolbar
    ?.addEventListener(
      "touchend",
      (event) => {
        const button =
          event.target
            ?.closest
            ?.(
              "button"
            );

        if (
          !button
          || button.disabled
          || !notebookToolbar.contains(
            button
          )
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        notebookLastTouchActivation =
          Date.now();

        button.click();
      },
      {
        passive: false
      }
    );

  notebookToolbar
    ?.addEventListener(
      "click",
      (event) => {
        if (
          event.isTrusted
          && Date.now()
            - notebookLastTouchActivation
            < 650
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      true
    );


  // iOS/PWA: preserve a seleção antes de qualquer toque na toolbar.
  // Sem isso o WebKit move o foco para o botão e comandos parecem não responder.
  document
    .querySelector(".notebook-toolbar")
    ?.addEventListener(
      "touchstart",
      () => {
        saveSelection();
      },
      {
        passive: true
      }
    );


  Object
    .entries(
      notebookToolMenuToggles
    )
    .forEach(
      (
        [
          name,
          toggleId
        ]
      ) => {
        const toggle =
          document.getElementById(
            toggleId
          );

        toggle
          ?.addEventListener(
            "pointerdown",
            (event) => {
              saveSelection();

              if (
                event.pointerType === "mouse"
              ) {
                event.preventDefault();
              }
            }
          );

        toggle
          ?.addEventListener(
            "click",
            (event) => {
              event.stopPropagation();

              if (
                toggle.disabled
              ) {
                return;
              }

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
      "[data-template-type]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "mousedown",
          event =>
            event.preventDefault()
        );


        button.addEventListener(
          "click",
          () => {
            insertTemplate(
              button.dataset
                .templateType
            );

            closeNotebookToolMenus();
          }
        );
      }
    );


  document
    .querySelectorAll(
      "[data-divider-style]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "mousedown",
          event =>
            event.preventDefault()
        );


        button.addEventListener(
          "click",
          () => {
            insertDivider(
              button.dataset
                .dividerStyle
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

            if (
              mode === "merge-row"
            ) {
              mergeCurrentNotebookEditorTableRow();
              return;
            }

            if (
              mode === "split-row"
            ) {
              splitCurrentNotebookEditorTableRow();
              return;
            }

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


  const tableBuilder =
    document.getElementById(
      "notebook-table-editor"
    );


  tableBuilder
    ?.addEventListener(
      "focusin",
      (event) => {
        const row =
          event.target
            ?.closest
            ?.(
              "tr"
            );

        if (
          row
        ) {
          markNotebookTableBuilderRow(
            row
          );
        }
      }
    );


  tableBuilder
    ?.addEventListener(
      "keydown",
      (event) => {
        const cell =
          event.target
            ?.closest
            ?.(
              "td,th"
            );


        const table =
          getNotebookTableElement();


        const row =
          cell
            ?.closest(
              "tr"
            );


        if (
          !table
          || !row
          || !cell
        ) {
          return;
        }


        if (
          event.key === "Backspace"
          &&
          notebookTableRowIsBlank(
            row
          )
        ) {
          event.preventDefault();


          if (
            removeBlankNotebookTableRowAndFocusPrevious(
              row,
              cell.cellIndex
            )
          ) {
            markNotebookTableBuilderRow(
              document.activeElement
                ?.closest
                ?.(
                  "tr"
                )
            );
          }


          return;
        }


        if (
          event.key !== "Enter"
          || event.shiftKey
          || row !==
            table.rows[
              table.rows.length - 1
            ]
        ) {
          return;
        }


        event.preventDefault();


        appendNotebookTableRow(
          table,
          true
        );
      }
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
      "notebook-table-merge-row"
    )
    ?.addEventListener(
      "click",
      mergeNotebookTableBuilderRow
    );


  document
    .getElementById(
      "notebook-table-split-row"
    )
    ?.addEventListener(
      "click",
      splitNotebookTableBuilderRow
    );


  document
    .getElementById(
      "notebook-table-insert"
    )
    ?.addEventListener(
      "click",
      insertNotebookTable
    );


  const imageButton =
    document.getElementById(
      "notebook-image-add"
    );


  imageButton
    ?.addEventListener(
      "mousedown",
      event =>
        event.preventDefault()
    );


  const notebookImageInputs =
    {
      camera:
        document.getElementById(
          "notebook-image-camera-input"
        ),

      gallery:
        document.getElementById(
          "notebook-image-gallery-input"
        ),

      file:
        document.getElementById(
          "notebook-image-file-input"
        )
    };


  document
    .querySelectorAll(
      "[data-image-source]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "mousedown",
          event =>
            event.preventDefault()
        );


        button.addEventListener(
          "click",
          () => {
            if (
              notebookImageCount()
              >= 2
            ) {
              alert(
                "Este caderno já possui o máximo de 2 imagens."
              );

              closeNotebookToolMenus();

              return;
            }


            saveSelection();


            const input =
              notebookImageInputs[
                button.dataset
                  .imageSource
              ];


            closeNotebookToolMenus();


            input?.click();
          }
        );
      }
    );


  Object
    .values(
      notebookImageInputs
    )
    .forEach(
      input => {
        input
          ?.addEventListener(
            "change",
            async () => {
              try {
                await addNotebookImages(
                  input.files
                );

              } catch (
                error
              ) {
                console.error(
                  error
                );

                setSaveStatus(
                  `Erro ao adicionar imagem: ${error.message}`,
                  "error"
                );

              } finally {
                input.value =
                  "";
              }
            }
          );
      }
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
      "notebook-library-share"
    )
    ?.addEventListener(
      "click",
      async () => {
        const entries =
          selectedEntries()
            .filter(
              entry =>
                !entry.note.is_shared
            );

        await openNotebookShareDialog(
          entries,
          entries.length === 1
            ? entries[0]?.title || "Caderno LURIA"
            : "Cadernos selecionados"
        );
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


  const membershipsResult =
    await notebookSb
      .from(
        "study_note_members"
      )
      .select(
        "note_id,share_id,user_id,mode,created_at"
      )
      .eq(
        "user_id",
        userId
      );


  if (
    membershipsResult.error
  ) {
    throw membershipsResult.error;
  }


  const memberships =
    membershipsResult.data
    || [];


  const sharedIds =
    memberships.map(
      item => item.note_id
    );


  let sharedNotes =
    [];


  if (
    sharedIds.length
  ) {
    const sharedResult =
      await notebookSb
        .from(
          "study_notes"
        )
        .select(
          "id,user_id,topic_id,topic_title,area,materia,content_html,created_at,updated_at"
        )
        .in(
          "id",
          sharedIds
        );


    if (
      sharedResult.error
    ) {
      throw sharedResult.error;
    }


    sharedNotes =
      (sharedResult.data || [])
        .map(
          note => ({
            ...note,
            is_shared:
              true
          })
        );
  }


  const overlaysResult =
    await notebookSb
      .from(
        "study_note_overlays"
      )
      .select(
        "note_id,user_id,share_id,patch_text,base_hash,updated_at"
      )
      .eq(
        "user_id",
        userId
      );


  if (
    overlaysResult.error
  ) {
    throw overlaysResult.error;
  }


  notebookState.sharedMemberships =
    new Map(
      memberships.map(
        item => [
          item.note_id,
          item
        ]
      )
    );


  notebookState.overlays =
    new Map(
      (overlaysResult.data || [])
        .map(
          item => [
            item.note_id,
            item
          ]
        )
    );


  const allNotes = [
    ...(notesResult.data || [])
      .map(
        note => ({
          ...note,
          is_shared:
            false
        })
      ),
    ...sharedNotes
  ];


  notebookState.topics =
    topicsResult.data ||
    [];


  notebookState.notesByTopic =
    new Map(
      (
        allNotes
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
        allNotes
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

  initNotebookTopicPanelState();

  setEditorEnabled(
    false
  );


  try {

    await redeemNotebookBundleFromUrl();
    await redeemNotebookShareFromUrl();

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
      (
        !noteById(
          requestedNote
        ).topic_id
        ||
        noteById(
          requestedNote
        ).is_shared
      )
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