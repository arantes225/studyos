const errorSb =
  window.supabaseClient;


let errorUser =
  null;

let errorQueue =
  [];

let errorIndex =
  0;

let allErrorAreas =
  [];

let errorLibraryItems =
  [];

let editingErrorId =
  null;

const selectedErrorIds =
  new Set();

let importedErrorRows =
  [];


const errorParams =
  new URLSearchParams(
    window.location.search
  );


const errorAgendaDate =
  errorParams.get(
    "agenda_date"
  );


const errorAgendaArea =
  errorParams.get(
    "agenda_area"
  );


/* =========================================================
   HELPERS
   ========================================================= */

function errorTodayISO() {
  const d =
    new Date();


  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(
    2,
    "0"
  )}-${String(
    d.getDate()
  ).padStart(
    2,
    "0"
  )}`;
}


function formatErrorDate(
  value
) {
  if (!value) {
    return "—";
  }


  const [
    year,
    month,
    day
  ] =
    value
      .split("-")
      .map(Number);


  return new Intl
    .DateTimeFormat(
      "pt-BR",
      {
        day:
          "2-digit",

        month:
          "2-digit",

        year:
          "numeric"
      }
    )
    .format(
      new Date(
        year,
        month - 1,
        day
      )
    );
}


function setErrorStatus(
  text,
  type = ""
) {
  const element =
    document.getElementById(
      "error-status"
    );


  if (!element) {
    return;
  }


  element.textContent =
    text;


  element.className =
    `error-status ${type}`
      .trim();
}


function setNewErrorStatus(
  text,
  type = ""
) {
  const element =
    document.getElementById(
      "new-error-status"
    );


  if (!element) {
    return;
  }


  element.textContent =
    text;


  element.className =
    `error-status ${type}`
      .trim();
}


function currentAreaFilter() {
  if (
    errorAgendaDate
  ) {
    return (
      errorAgendaArea
      || ""
    );
  }


  return (
    document
      .getElementById(
        "error-area-filter"
      )
      ?.value
    || ""
  );
}


function safeFileBase(
  name
) {
  return String(
    name
    || "imagem"
  )
    .replace(
      /\.[^.]+$/,
      ""
    )
    .replace(
      /[^a-zA-Z0-9_-]+/g,
      "-"
    )
    .replace(
      /-+/g,
      "-"
    )
    .replace(
      /^-|-$/g,
      ""
    )
    || "imagem";
}


/* =========================================================
   MÉTRICAS
   ========================================================= */

async function loadErrorMetrics() {
  const {
    data,
    error
  } =
    await errorSb
      .from(
        "error_notebook_metrics"
      )
      .select(
        "registered_errors,reviewed_errors,overdue_errors,retention_percent"
      )
      .maybeSingle();


  if (error) {
    console.warn(
      "Não foi possível carregar as métricas do Caderno de Erros:",
      error.message
    );

    return;
  }


  const metrics =
    data || {
      registered_errors:
        0,

      reviewed_errors:
        0,

      overdue_errors:
        0,

      retention_percent:
        null
    };


  document
    .getElementById(
      "error-metric-registered"
    )
    .textContent =
      Number(
        metrics
          .registered_errors
        || 0
      );


  document
    .getElementById(
      "error-metric-reviewed"
    )
    .textContent =
      Number(
        metrics
          .reviewed_errors
        || 0
      );


  document
    .getElementById(
      "error-metric-overdue"
    )
    .textContent =
      Number(
        metrics
          .overdue_errors
        || 0
      );


  const retention =
    metrics
      .retention_percent;


  document
    .getElementById(
      "error-metric-retention"
    )
    .textContent =
      retention === null
      || retention === undefined
        ? "—"
        : `${Number(
            retention
          )
            .toFixed(1)
            .replace(
              ".",
              ","
            )}%`;
}


/* =========================================================
   FILTRO POR ÁREA
   ========================================================= */

async function loadErrorAreas() {
  const {
    data,
    error
  } =
    await errorSb
      .from(
        "error_notebook"
      )
      .select(
        "area"
      )
      .eq(
        "active",
        true
      );


  if (error) {
    console.warn(
      "Não foi possível carregar as áreas:",
      error.message
    );

    return;
  }


  allErrorAreas =
    Array.from(
      new Set(
        (data || [])
          .map(
            (row) =>
              row.area
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


  const select =
    document.getElementById(
      "error-area-filter"
    );


  if (!select) {
    return;
  }


  select.innerHTML =
    `
      <option value="">
        Todas as áreas
      </option>
    `
    + allErrorAreas
        .map(
          (area) => `
            <option value="${String(area)
              .replaceAll("&", "&amp;")
              .replaceAll('"', "&quot;")}">
              ${String(area)
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")}
            </option>
          `
        )
        .join("");


  if (
    errorAgendaDate
  ) {
    select.value =
      errorAgendaArea
      || "";

    select.disabled =
      true;
  }
}


/* =========================================================
   IMAGEM — VISUALIZAÇÃO
   ========================================================= */

async function signedErrorImage(
  path
) {
  if (
    !path
    || typeof path
      !== "string"
    || !path.trim()
  ) {
    return null;
  }


  const {
    data,
    error
  } =
    await errorSb
      .storage
      .from(
        "docmap"
      )
      .createSignedUrl(
        path,
        3600
      );


  if (error) {
    return null;
  }


  return (
    data?.signedUrl
    || null
  );
}


async function showErrorImage(
  path
) {
  const image =
    document.getElementById(
      "error-question-image"
    );


  if (!image) {
    return;
  }


  image.hidden =
    true;

  image.style.display =
    "none";

  image.removeAttribute(
    "src"
  );

  image.onload =
    null;

  image.onerror =
    null;


  if (
    !path
    || typeof path
      !== "string"
    || !path.trim()
  ) {
    return;
  }


  const url =
    await signedErrorImage(
      path
    );


  if (!url) {
    return;
  }


  image.onload =
    () => {
      image.hidden =
        false;

      image.style.display =
        "block";
    };


  image.onerror =
    () => {
      image.hidden =
        true;

      image.style.display =
        "none";

      image.removeAttribute(
        "src"
      );
    };


  image.src =
    url;
}


/* =========================================================
   IMAGEM — COMPRESSÃO
   ========================================================= */

function readImageDataUrl(
  file
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
            reader.result
          );


      reader.onerror =
        () =>
          reject(
            new Error(
              "Não foi possível ler a imagem."
            )
          );


      reader.readAsDataURL(
        file
      );
    }
  );
}


function loadImageElement(
  dataUrl
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const image =
        new Image();


      image.onload =
        () =>
          resolve(
            image
          );


      image.onerror =
        () =>
          reject(
            new Error(
              "Não foi possível abrir a imagem."
            )
          );


      image.src =
        dataUrl;
    }
  );
}


function canvasToWebp(
  canvas,
  quality
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(
              blob
            );
          } else {
            reject(
              new Error(
                "Falha na compressão."
              )
            );
          }
        },

        "image/webp",

        quality
      );
    }
  );
}


async function compressErrorImage(
  file
) {
  if (
    !file
    || !file.type
      ?.startsWith(
        "image/"
      )
  ) {
    return file;
  }


  try {
    const dataUrl =
      await readImageDataUrl(
        file
      );


    const source =
      await loadImageElement(
        dataUrl
      );


    const maxDimension =
      1400;


    const scale =
      Math.min(
        1,
        maxDimension
          / source.width,
        maxDimension
          / source.height
      );


    const width =
      Math.max(
        1,
        Math.round(
          source.width
          * scale
        )
      );


    const height =
      Math.max(
        1,
        Math.round(
          source.height
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


    context.drawImage(
      source,
      0,
      0,
      width,
      height
    );


    let blob =
      await canvasToWebp(
        canvas,
        0.72
      );


    if (
      blob.size
      > 650 * 1024
    ) {
      blob =
        await canvasToWebp(
          canvas,
          0.62
        );
    }


    if (
      blob.size
      >= file.size
    ) {
      return file;
    }


    return new File(
      [
        blob
      ],

      `${safeFileBase(
        file.name
      )}.webp`,

      {
        type:
          "image/webp",

        lastModified:
          Date.now()
      }
    );


  } catch (error) {
    console.warn(
      "Compressão da imagem falhou; usando original.",
      error
    );


    return file;
  }
}


async function uploadErrorImage(
  file
) {
  if (!file) {
    return null;
  }


  const finalFile =
    await compressErrorImage(
      file
    );


  const extension =
    finalFile.name
      ?.includes(".")
      ? finalFile
          .name
          .split(".")
          .pop()
          .toLowerCase()
      : "bin";


  const path =
    `${errorUser.id}/errors/${crypto.randomUUID()}-${safeFileBase(
      finalFile.name
      || file.name
    )}.${extension}`;


  const {
    error
  } =
    await errorSb
      .storage
      .from(
        "docmap"
      )
      .upload(
        path,
        finalFile,
        {
          cacheControl:
            "3600",

          upsert:
            false,

          contentType:
            finalFile.type
            || file.type
            || undefined
        }
      );


  if (error) {
    throw error;
  }


  return path;
}


/* =========================================================
   ADICIONAR NOVO ERRO
   ========================================================= */

function toggleNewErrorForm(
  forceOpen = null
) {
  const form =
    document.getElementById(
      "error-create-form"
    );


  const button =
    document.getElementById(
      "toggle-error-form"
    );


  if (
    !form
    || !button
  ) {
    return;
  }


  const open =
    forceOpen === null
      ? form.hidden
      : Boolean(
          forceOpen
        );


  form.hidden =
    !open;


  button.textContent =
    open
      ? "Fechar"
      : "Adicionar";
}


function clearNewErrorForm() {
  [
    "new-error-area",
    "new-error-materia",
    "new-error-theme",
    "new-error-ccq",
    "new-error-question",
    "new-error-answer",
    "new-error-thought"
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


  const image =
    document.getElementById(
      "new-error-image"
    );


  if (image) {
    image.value =
      "";
  }


  setNewErrorStatus(
    ""
  );
}


async function saveNewError() {
  const button =
    document.getElementById(
      "save-new-error"
    );


  const area =
    document
      .getElementById(
        "new-error-area"
      )
      .value
      .trim();


  const materia =
    document
      .getElementById(
        "new-error-materia"
      )
      .value
      .trim();


  const theme =
    document
      .getElementById(
        "new-error-theme"
      )
      .value
      .trim();


  const ccq =
    document
      .getElementById(
        "new-error-ccq"
      )
      .value
      .trim();


  const question =
    document
      .getElementById(
        "new-error-question"
      )
      .value
      .trim();


  const answer =
    document
      .getElementById(
        "new-error-answer"
      )
      .value
      .trim();


  const thought =
    document
      .getElementById(
        "new-error-thought"
      )
      .value
      .trim();


  const imageFile =
    document
      .getElementById(
        "new-error-image"
      )
      .files[0]
    || null;


  if (!ccq) {
    setNewErrorStatus(
      "Preencha o CCQ.",
      "error"
    );

    return;
  }


  button.disabled =
    true;


  setNewErrorStatus(
    imageFile
      ? "Comprimindo imagem e salvando..."
      : "Salvando..."
  );


  let imagePath =
    null;


  try {
    imagePath =
      await uploadErrorImage(
        imageFile
      );


    const {
      error
    } =
      await errorSb.rpc(
        "create_error_entry",
        {
          p_area:
            area
            || null,

          p_materia:
            materia
            || null,

          p_theme:
            theme
            || null,

          p_ccq:
            ccq,

          p_question_text:
            question
            || null,

          p_correct_answer:
            answer
            || null,

          p_what_i_thought:
            thought
            || null,

          p_question_image_path:
            imagePath
        }
      );


    if (error) {
      throw error;
    }


    clearNewErrorForm();


    setNewErrorStatus(
      "Erro adicionado ao Caderno.",
      "success"
    );


    await Promise.all([
      loadErrorMetrics(),
      loadErrorAreas(),
      loadErrorLibrary(),
      loadErrorQueue()
    ]);


  } catch (error) {
    console.error(
      error
    );


    if (imagePath) {
      await errorSb
        .storage
        .from(
          "docmap"
        )
        .remove([
          imagePath
        ]);
    }


    setNewErrorStatus(
      `Não foi possível salvar: ${error.message}`,
      "error"
    );


  } finally {
    button.disabled =
      false;
  }
}


function wireNewError() {
  document
    .getElementById(
      "toggle-error-form"
    )
    ?.addEventListener(
      "click",
      () =>
        toggleNewErrorForm()
    );


  document
    .getElementById(
      "cancel-new-error"
    )
    ?.addEventListener(
      "click",
      () => {
        clearNewErrorForm();

        toggleNewErrorForm(
          false
        );
      }
    );


  document
    .getElementById(
      "save-new-error"
    )
    ?.addEventListener(
      "click",
      saveNewError
    );
}


/* =========================================================
   REVISÃO
   ========================================================= */

function renderErrorMeta(
  item
) {
  const pieces =
    [
      item.area,
      item.materia,
      item.theme
    ]
      .filter(
        Boolean
      );


  const element =
    document.getElementById(
      "error-meta"
    );


  if (element) {
    element.textContent =
      pieces.length
        ? pieces.join(
            " · "
          )
        : "Sem área definida";
  }
}


async function renderCurrentError() {
  const empty =
    document.getElementById(
      "error-empty"
    );


  const stage =
    document.getElementById(
      "error-stage"
    );


  if (
    errorIndex
    >= errorQueue.length
  ) {
    stage.hidden =
      true;


    empty.hidden =
      false;


    document
      .getElementById(
        "error-position"
      )
      .textContent =
        errorQueue.length
          ? `${errorQueue.length} / ${errorQueue.length}`
          : "0 / 0";


    document
      .getElementById(
        "error-progress-copy"
      )
      .textContent =
        "sem pendências";


    return;
  }


  empty.hidden =
    true;


  stage.hidden =
    false;


  const item =
    errorQueue[
      errorIndex
    ];


  const remaining =
    errorQueue.length
    - errorIndex;


  document
    .getElementById(
      "error-position"
    )
    .textContent =
      `${errorIndex + 1} / ${errorQueue.length}`;


  document
    .getElementById(
      "error-progress-copy"
    )
    .textContent =
      `${remaining} restante${
        remaining === 1
          ? ""
          : "s"
      }`;


  document
    .getElementById(
      "error-ccq"
    )
    .textContent =
      item.ccq
      || "Sem CCQ";


  renderErrorMeta(
    item
  );


  const question =
    document.getElementById(
      "error-question"
    );


  question.textContent =
    item.question_text
    || (
      item.question_image_path
        ? ""
        : "Questão não informada."
    );


  document
    .getElementById(
      "error-correct-answer"
    )
    .textContent =
      item.correct_answer
      || "—";


  const thoughtBlock =
    document.getElementById(
      "error-thought-block"
    );


  const thought =
    document.getElementById(
      "error-thought"
    );


  if (
    item.what_i_thought
  ) {
    thoughtBlock.hidden =
      false;


    thought.textContent =
      item.what_i_thought;


  } else {
    thoughtBlock.hidden =
      true;


    thought.textContent =
      "";
  }


  const details =
    document.getElementById(
      "error-details"
    );


  details.hidden =
    true;


  document
    .getElementById(
      "open-error"
    )
    .textContent =
      "Abrir";


  setErrorStatus(
    ""
  );


  await showErrorImage(
    item.question_image_path
  );
}


async function loadErrorQueue() {
  let query =
    errorSb
      .from(
        "error_notebook"
      )
      .select(
        "id,area,materia,theme,ccq,question_text,question_image_path,correct_answer,what_i_thought,due_date,current_interval_days,stability_days,review_count,last_reviewed_at,created_at"
      )
      .eq(
        "active",
        true
      );


  /*
    Pela Agenda:
    exatamente data + área.

    Página normal:
    itens vencidos até hoje,
    opcionalmente filtrados
    por área.
  */

  if (
    errorAgendaDate
  ) {
    query =
      query.eq(
        "due_date",
        errorAgendaDate
      );


    if (
      errorAgendaArea
    ) {
      query =
        query.eq(
          "area",
          errorAgendaArea
        );


    } else {
      query =
        query.is(
          "area",
          null
        );
    }


  } else {
    query =
      query.lte(
        "due_date",
        errorTodayISO()
      );


    const area =
      currentAreaFilter();


    if (area) {
      query =
        query.eq(
          "area",
          area
        );
    }
  }


  const {
    data,
    error
  } =
    await query
      .order(
        "due_date",
        {
          ascending:
            true
        }
      )
      .order(
        "created_at",
        {
          ascending:
            true
        }
      )
      .limit(
        250
      );


  if (error) {
    console.error(
      error
    );


    setErrorStatus(
      `Não foi possível carregar o Caderno de Erros: ${error.message}`,
      "error"
    );


    return;
  }


  errorQueue =
    data || [];


  errorIndex =
    0;


  const selectedArea =
    currentAreaFilter();


  const emptyCopy =
    document.getElementById(
      "error-empty-copy"
    );


  if (emptyCopy) {
    emptyCopy.textContent =
      selectedArea
        ? `Não há revisões pendentes em ${selectedArea}.`
        : "Não há itens programados para esta seleção.";
  }


  if (
    errorAgendaDate
  ) {
    const title =
      document.getElementById(
        "error-review-title"
      );


    const copy =
      document.getElementById(
        "error-review-copy"
      );


    title.textContent =
      "Erros agendados";


    copy.textContent =
      `Revisão de ${formatErrorDate(
        errorAgendaDate
      )}${
        errorAgendaArea
          ? ` · ${errorAgendaArea}`
          : ""
      }.`;
  }


  await renderCurrentError();
}


function toggleErrorDetails() {
  const details =
    document.getElementById(
      "error-details"
    );


  const button =
    document.getElementById(
      "open-error"
    );


  if (
    !details
    || !button
  ) {
    return;
  }


  const shouldOpen =
    details.hidden;


  details.hidden =
    !shouldOpen;


  button.textContent =
    shouldOpen
      ? "Fechar"
      : "Abrir";
}


async function markCurrentErrorRead() {
  const item =
    errorQueue[
      errorIndex
    ];


  if (!item) {
    return;
  }


  const button =
    document.getElementById(
      "mark-error-read"
    );


  button.disabled =
    true;


  document
    .getElementById(
      "open-error"
    )
    .disabled =
      true;


  setErrorStatus(
    "Agendando próxima revisão..."
  );


  const {
    data,
    error
  } =
    await errorSb.rpc(
      "review_error_entry",
      {
        p_error_id:
          item.id
      }
    );


  button.disabled =
    false;


  document
    .getElementById(
      "open-error"
    )
    .disabled =
      false;


  if (error) {
    console.error(
      error
    );


    setErrorStatus(
      `Não foi possível salvar: ${error.message}`,
      "error"
    );


    return;
  }


  const reviewed =
    Array.isArray(
      data
    )
      ? data[0]
      : data;


  setErrorStatus(
    reviewed?.due_date
      ? `Lido. Próxima revisão em ${formatErrorDate(
          reviewed.due_date
        )}.`
      : "Lido. Próxima revisão agendada.",
    "success"
  );


  /*
    O item atual já foi movido
    para a próxima revisão.
    Agora entra o próximo.
  */

  errorIndex +=
    1;


  await Promise.all([
    loadErrorMetrics(),
    loadErrorLibrary(),
    renderCurrentError()
  ]);
}


function wireErrorReview() {
  document
    .getElementById(
      "open-error"
    )
    ?.addEventListener(
      "click",
      toggleErrorDetails
    );


  document
    .getElementById(
      "mark-error-read"
    )
    ?.addEventListener(
      "click",
      markCurrentErrorRead
    );


  document
    .getElementById(
      "error-area-filter"
    )
    ?.addEventListener(
      "change",
      loadErrorQueue
    );
}



/* =========================================================
   BIBLIOTECA
   ========================================================= */

function errorLibraryEscape(
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


function populateLibraryAreas() {
  const select =
    document.getElementById(
      "error-library-area"
    );


  if (!select) {
    return;
  }


  const current =
    select.value;


  const areas =
    Array.from(
      new Set(
        errorLibraryItems
          .map(
            (item) =>
              item.area
              || "Sem área"
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


  select.innerHTML =
    `
      <option value="">
        Todas as áreas
      </option>
    `
    + areas
        .map(
          (area) => `
            <option value="${errorLibraryEscape(
              area
            )}">
              ${errorLibraryEscape(
                area
              )}
            </option>
          `
        )
        .join("");


  if (
    areas.includes(
      current
    )
  ) {
    select.value =
      current;
  }
}


function filteredErrorLibrary() {
  const area =
    document
      .getElementById(
        "error-library-area"
      )
      ?.value
    || "";


  const search =
    document
      .getElementById(
        "error-library-search"
      )
      ?.value
      .trim()
      .toLowerCase()
    || "";


  return errorLibraryItems
    .filter(
      (item) => {
        const itemArea =
          item.area
          || "Sem área";


        if (
          area
          && itemArea
            !== area
        ) {
          return false;
        }


        if (!search) {
          return true;
        }


        return [
          item.area,
          item.materia,
          item.theme,
          item.ccq,
          item.question_text,
          item.correct_answer,
          item.what_i_thought
        ]
          .filter(
            Boolean
          )
          .join(" ")
          .toLowerCase()
          .includes(
            search
          );
      }
    );
}



function setErrorLibraryStatus(
  text,
  type = ""
) {
  const element =
    document.getElementById(
      "error-library-status"
    );


  if (!element) {
    return;
  }


  element.textContent =
    text;


  element.className =
    `error-status ${type}`
      .trim();
}


function closeErrorLibraryMenus(
  exceptId = null
) {
  document
    .querySelectorAll(
      "[data-error-library-menu]"
    )
    .forEach(
      (menu) => {
        const id =
          menu.dataset
            .errorLibraryMenu;


        if (
          exceptId
          && id === exceptId
        ) {
          return;
        }


        menu.hidden =
          true;
      }
    );


  document
    .querySelectorAll(
      "[data-error-library-menu-trigger]"
    )
    .forEach(
      (button) => {
        const id =
          button.dataset
            .errorLibraryMenuTrigger;


        if (
          exceptId
          && id === exceptId
        ) {
          return;
        }


        button.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    );
}


function openErrorEditDialog(
  itemId
) {
  const item =
    errorLibraryItems
      .find(
        (entry) =>
          entry.id === itemId
      )
    || errorQueue.find(
      (entry) =>
        entry.id === itemId
    );


  if (!item) {
    return;
  }


  editingErrorId =
    item.id;


  const values = {
    "error-edit-area":
      item.area
      || "",

    "error-edit-materia":
      item.materia
      || "",

    "error-edit-theme":
      item.theme
      || "",

    "error-edit-ccq":
      item.ccq
      || "",

    "error-edit-question":
      item.question_text
      || "",

    "error-edit-answer":
      item.correct_answer
      || "",

    "error-edit-thought":
      item.what_i_thought
      || ""
  };


  Object
    .entries(
      values
    )
    .forEach(
      (
        [
          id,
          value
        ]
      ) => {
        const element =
          document.getElementById(
            id
          );


        if (element) {
          element.value =
            value;
        }
      }
    );


  const status =
    document.getElementById(
      "error-edit-status"
    );


  if (status) {
    status.textContent =
      "";

    status.className =
      "error-status";
  }


  const dialog =
    document.getElementById(
      "error-edit-dialog"
    );


  if (
    typeof dialog?.showModal
      === "function"
  ) {
    dialog.showModal();

  } else {
    dialog?.setAttribute(
      "open",
      ""
    );
  }
}


function closeErrorEditDialog() {
  editingErrorId =
    null;


  const dialog =
    document.getElementById(
      "error-edit-dialog"
    );


  if (!dialog) {
    return;
  }


  if (
    typeof dialog.close
      === "function"
  ) {
    dialog.close();

  } else {
    dialog.removeAttribute(
      "open"
    );
  }
}


function setErrorEditStatus(
  text,
  type = ""
) {
  const element =
    document.getElementById(
      "error-edit-status"
    );


  if (!element) {
    return;
  }


  element.textContent =
    text;


  element.className =
    `error-status ${type}`
      .trim();
}


async function saveEditedError() {
  if (!editingErrorId) {
    return;
  }


  const ccq =
    document
      .getElementById(
        "error-edit-ccq"
      )
      .value
      .trim();


  if (!ccq) {
    setErrorEditStatus(
      "O CCQ é obrigatório.",
      "error"
    );

    return;
  }


  const button =
    document.getElementById(
      "error-edit-save"
    );


  button.disabled =
    true;


  setErrorEditStatus(
    "Salvando..."
  );


  const {
    error
  } =
    await errorSb
      .from(
        "error_notebook"
      )
      .update({
        area:
          document
            .getElementById(
              "error-edit-area"
            )
            .value
            .trim()
          || null,

        materia:
          document
            .getElementById(
              "error-edit-materia"
            )
            .value
            .trim()
          || null,

        theme:
          document
            .getElementById(
              "error-edit-theme"
            )
            .value
            .trim()
          || null,

        ccq:
          ccq,

        question_text:
          document
            .getElementById(
              "error-edit-question"
            )
            .value
            .trim()
          || null,

        correct_answer:
          document
            .getElementById(
              "error-edit-answer"
            )
            .value
            .trim()
          || null,

        what_i_thought:
          document
            .getElementById(
              "error-edit-thought"
            )
            .value
            .trim()
          || null
      })
      .eq(
        "id",
        editingErrorId
      );


  button.disabled =
    false;


  if (error) {
    console.error(
      error
    );


    setErrorEditStatus(
      `Não foi possível salvar: ${error.message}`,
      "error"
    );

    return;
  }


  closeErrorEditDialog();


  setErrorLibraryStatus(
    "Item atualizado.",
    "success"
  );


  await Promise.all([
    loadErrorMetrics(),
    loadErrorAreas(),
    loadErrorLibrary(),
    loadErrorQueue()
  ]);
}


async function deleteErrorFromLibrary(
  itemId
) {
  const item =
    errorLibraryItems
      .find(
        (entry) =>
          entry.id === itemId
      )
    || errorQueue.find(
      (entry) =>
        entry.id === itemId
    );


  if (!item) {
    return;
  }


  const confirmed =
    window.confirm(
      "Excluir este item do Caderno de Erros permanentemente? Esta ação não pode ser desfeita."
    );


  if (!confirmed) {
    return;
  }


  setErrorLibraryStatus(
    "Excluindo item..."
  );


  const {
    error
  } =
    await errorSb
      .from(
        "error_notebook"
      )
      .delete()
      .eq(
        "id",
        itemId
      );


  if (error) {
    console.error(
      error
    );


    setErrorLibraryStatus(
      `Não foi possível excluir: ${error.message}`,
      "error"
    );

    return;
  }


  if (
    item.question_image_path
  ) {
    const {
      error:
        storageError
    } =
      await errorSb
        .storage
        .from(
          "docmap"
        )
        .remove([
          item.question_image_path
        ]);


    if (storageError) {
      console.warn(
        "Item excluído, mas a imagem antiga não pôde ser removida:",
        storageError.message
      );
    }
  }


  selectedErrorIds.delete(
    itemId
  );

  errorQueue =
    errorQueue.filter(
      (entry) =>
        entry.id !== itemId
    );

  if (
    errorIndex
    >= errorQueue.length
  ) {
    errorIndex =
      Math.max(
        0,
        errorQueue.length - 1
      );
  }


  setErrorLibraryStatus(
    "Item excluído do Caderno.",
    "success"
  );


  await Promise.all([
    loadErrorMetrics(),
    loadErrorAreas(),
    loadErrorLibrary(),
    loadErrorQueue()
  ]);
}



function switchErrorTab(
  name
) {
  document
    .querySelectorAll(
      "[data-error-tab]"
    )
    .forEach(
      (button) => {
        button.classList.toggle(
          "active",
          button.dataset
            .errorTab === name
        );
      }
    );


  document
    .querySelectorAll(
      "[data-error-section]"
    )
    .forEach(
      (section) => {
        section.classList.toggle(
          "active",
          section.dataset
            .errorSection === name
        );
      }
    );


  if (
    name === "create"
  ) {
    toggleNewErrorForm(
      true
    );
  }


  if (
    name === "library"
  ) {
    loadErrorLibrary();
  }
}


function currentErrorReviewItem() {
  return errorQueue[
    errorIndex
  ]
  || null;
}


function closeErrorReviewMenu() {
  const menu =
    document.getElementById(
      "error-review-menu"
    );

  const trigger =
    document.getElementById(
      "error-review-menu-trigger"
    );


  if (menu) {
    menu.hidden =
      true;
  }


  trigger?.setAttribute(
    "aria-expanded",
    "false"
  );
}


function updateErrorBulkToolbar() {
  const visible =
    filteredErrorLibrary()
      .map(
        (item) =>
          item.id
      );


  const selectedVisible =
    visible.filter(
      (id) =>
        selectedErrorIds.has(
          id
        )
    ).length;


  const count =
    document.getElementById(
      "error-library-selected"
    );


  const button =
    document.getElementById(
      "error-library-delete-selected"
    );


  const selectAll =
    document.getElementById(
      "error-library-select-all"
    );


  if (count) {
    count.textContent =
      `${selectedErrorIds.size} selecionado${selectedErrorIds.size === 1 ? "" : "s"}`;
  }


  if (button) {
    button.disabled =
      selectedErrorIds.size === 0;
  }


  if (selectAll) {
    selectAll.checked =
      visible.length > 0
      && selectedVisible === visible.length;

    selectAll.indeterminate =
      selectedVisible > 0
      && selectedVisible < visible.length;
  }
}


async function deleteSelectedErrors() {
  const ids =
    Array.from(
      selectedErrorIds
    );


  if (!ids.length) {
    return;
  }


  const confirmed =
    window.confirm(
      `Excluir ${ids.length} item${ids.length === 1 ? "" : "s"} do Caderno permanentemente?`
    );


  if (!confirmed) {
    return;
  }


  const items =
    errorLibraryItems.filter(
      (item) =>
        selectedErrorIds.has(
          item.id
        )
    );


  setErrorLibraryStatus(
    "Excluindo selecionados..."
  );


  const {
    error
  } =
    await errorSb
      .from(
        "error_notebook"
      )
      .delete()
      .in(
        "id",
        ids
      );


  if (error) {
    console.error(
      error
    );


    setErrorLibraryStatus(
      `Não foi possível excluir: ${error.message}`,
      "error"
    );

    return;
  }


  const paths =
    items
      .map(
        (item) =>
          item.question_image_path
      )
      .filter(
        Boolean
      );


  if (paths.length) {
    const {
      error:
        storageError
    } =
      await errorSb
        .storage
        .from(
          "docmap"
        )
        .remove(
          paths
        );


    if (storageError) {
      console.warn(
        storageError
      );
    }
  }


  errorQueue =
    errorQueue.filter(
      (item) =>
        !selectedErrorIds.has(
          item.id
        )
    );


  selectedErrorIds.clear();


  setErrorLibraryStatus(
    `${ids.length} item${ids.length === 1 ? "" : "s"} excluído${ids.length === 1 ? "" : "s"}.`,
    "success"
  );


  await Promise.all([
    loadErrorMetrics(),
    loadErrorAreas(),
    loadErrorLibrary(),
    loadErrorQueue()
  ]);
}


function normalizeErrorImportHeader(
  value
) {
  return String(
    value
    ?? ""
  )
    .trim()
    .toLowerCase()
    .normalize(
      "NFD"
    )
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .trim();
}


function errorImportValue(
  row,
  aliases
) {
  for (
    const [
      key,
      value
    ]
    of Object.entries(
      row
    )
  ) {
    const normalized =
      normalizeErrorImportHeader(
        key
      );


    if (
      aliases.includes(
        normalized
      )
    ) {
      return String(
        value
        ?? ""
      )
        .trim();
    }
  }


  return "";
}


function parseErrorImportRows(
  workbook
) {
  const rows =
    [];


  for (
    const sheetName
    of workbook.SheetNames
  ) {
    const sheet =
      workbook.Sheets[
        sheetName
      ];


    const data =
      XLSX.utils
        .sheet_to_json(
          sheet,
          {
            defval:
              ""
          }
        );


    for (
      const source
      of data
    ) {
      const item = {
        area:
          errorImportValue(
            source,
            [
              "area",
              "grande area"
            ]
          ),

        materia:
          errorImportValue(
            source,
            [
              "materia",
              "disciplina"
            ]
          ),

        theme:
          errorImportValue(
            source,
            [
              "tema",
              "assunto"
            ]
          ),

        ccq:
          errorImportValue(
            source,
            [
              "ccq",
              "conceito",
              "conceito central"
            ]
          ),

        question_text:
          errorImportValue(
            source,
            [
              "questao",
              "pergunta"
            ]
          ),

        correct_answer:
          errorImportValue(
            source,
            [
              "resposta",
              "resposta correta",
              "gabarito"
            ]
          ),

        what_i_thought:
          errorImportValue(
            source,
            [
              "o que eu pensei",
              "meu raciocinio",
              "raciocinio"
            ]
          )
      };


      if (
        item.ccq
      ) {
        rows.push(
          item
        );
      }
    }
  }


  return rows;
}


function renderErrorImportPreview() {
  const preview =
    document.getElementById(
      "error-import-preview"
    );

  const body =
    document.getElementById(
      "error-import-body"
    );

  const summary =
    document.getElementById(
      "error-import-summary"
    );

  const button =
    document.getElementById(
      "error-import-confirm"
    );


  if (
    !importedErrorRows.length
  ) {
    preview.hidden =
      true;

    body.innerHTML =
      "";

    summary.textContent =
      "";

    button.disabled =
      true;

    return;
  }


  preview.hidden =
    false;

  button.disabled =
    false;

  summary.textContent =
    `${importedErrorRows.length} item${importedErrorRows.length === 1 ? "" : "s"} válido${importedErrorRows.length === 1 ? "" : "s"}`;


  body.innerHTML =
    importedErrorRows
      .slice(
        0,
        20
      )
      .map(
        (row) => `
          <tr>
            <td>${errorLibraryEscape(row.area || "—")}</td>
            <td>${errorLibraryEscape(row.materia || "—")}</td>
            <td>${errorLibraryEscape(row.theme || "—")}</td>
            <td>${errorLibraryEscape(row.ccq)}</td>
            <td>${errorLibraryEscape(row.question_text || "—")}</td>
            <td>${errorLibraryEscape(row.correct_answer || "—")}</td>
          </tr>
        `
      )
      .join("");
}


async function importErrorRows() {
  if (
    !importedErrorRows.length
  ) {
    return;
  }


  const button =
    document.getElementById(
      "error-import-confirm"
    );


  button.disabled =
    true;


  const status =
    document.getElementById(
      "error-import-status"
    );


  status.textContent =
    "Importando...";

  status.className =
    "error-status";


  let created =
    0;


  try {
    for (
      const row
      of importedErrorRows
    ) {
      const {
        error
      } =
        await errorSb.rpc(
          "create_error_entry",
          {
            p_area:
              row.area
              || null,

            p_materia:
              row.materia
              || null,

            p_theme:
              row.theme
              || null,

            p_ccq:
              row.ccq,

            p_question_text:
              row.question_text
              || null,

            p_correct_answer:
              row.correct_answer
              || null,

            p_what_i_thought:
              row.what_i_thought
              || null,

            p_question_image_path:
              null
          }
        );


      if (error) {
        throw error;
      }


      created +=
        1;
    }


    importedErrorRows =
      [];


    document
      .getElementById(
        "error-import-file"
      )
      .value =
        "";


    renderErrorImportPreview();


    status.textContent =
      `${created} item${created === 1 ? "" : "s"} importado${created === 1 ? "" : "s"}.`;

    status.className =
      "error-status success";


    await Promise.all([
      loadErrorMetrics(),
      loadErrorAreas(),
      loadErrorLibrary(),
      loadErrorQueue()
    ]);


  } catch (error) {
    console.error(
      error
    );


    status.textContent =
      `Não foi possível concluir: ${error.message}`;

    status.className =
      "error-status error";


    button.disabled =
      false;
  }
}


function renderErrorLibrary() {
  const container =
    document.getElementById(
      "error-library"
    );


  const empty =
    document.getElementById(
      "error-library-empty"
    );


  const count =
    document.getElementById(
      "error-library-count"
    );


  if (
    !container
    || !empty
    || !count
  ) {
    return;
  }


  const items =
    filteredErrorLibrary();


  count.textContent =
    `${items.length} ${
      items.length === 1
        ? "erro"
        : "erros"
    }`;


  if (
    !items.length
  ) {
    container.innerHTML =
      "";

    empty.hidden =
      false;

    updateErrorBulkToolbar();

    return;
  }


  empty.hidden =
    true;


  const groups =
    new Map();


  items.forEach(
    (item) => {
      const area =
        item.area
        || "Sem área";


      if (
        !groups.has(
          area
        )
      ) {
        groups.set(
          area,
          []
        );
      }


      groups
        .get(area)
        .push(item);
    }
  );


  const sortedAreas =
    Array.from(
      groups.keys()
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


  container.innerHTML =
    sortedAreas
      .map(
        (area) => {
          const areaItems =
            groups.get(
              area
            );


          return `
            <section class="error-library-group">

              <div class="error-library-group-head">

                <h3>
                  ${errorLibraryEscape(
                    area
                  )}
                </h3>

                <span>
                  ${areaItems.length} ${
                    areaItems.length === 1
                      ? "erro"
                      : "erros"
                  }
                </span>

              </div>


              <div class="error-library-grid">

                ${areaItems
                  .map(
                    (item) => {
                      const meta =
                        [
                          item.materia,
                          item.theme
                        ]
                          .filter(
                            Boolean
                          )
                          .join(
                            " · "
                          );


                      return `
                        <article
                          class="error-library-card"
                          data-library-card="${errorLibraryEscape(
                            item.id
                          )}"
                        >

                          <label
                            class="error-library-select-wrap"
                            aria-label="Selecionar item"
                          >
                            <input
                              class="error-library-select-check"
                              type="checkbox"
                              data-error-library-select="${errorLibraryEscape(
                                item.id
                              )}"
                              ${selectedErrorIds.has(item.id) ? "checked" : ""}
                            >
                          </label>

                          <div class="error-library-menu-wrap">

                            <button
                              class="error-library-menu-trigger"
                              type="button"
                              data-error-library-menu-trigger="${errorLibraryEscape(
                                item.id
                              )}"
                              aria-label="Opções do item"
                              aria-expanded="false"
                            >
                              ⋯
                            </button>

                            <div
                              class="error-library-menu"
                              data-error-library-menu="${errorLibraryEscape(
                                item.id
                              )}"
                              hidden
                            >

                              <button
                                type="button"
                                data-error-library-edit="${errorLibraryEscape(
                                  item.id
                                )}"
                              >
                                Editar
                              </button>

                              <button
                                class="danger"
                                type="button"
                                data-error-library-delete="${errorLibraryEscape(
                                  item.id
                                )}"
                              >
                                Excluir
                              </button>

                            </div>

                          </div>


                          <div class="error-library-card-main">

                            <div class="error-library-card-ccq">
                              ${errorLibraryEscape(
                                item.ccq
                                || "Sem CCQ"
                              )}
                            </div>

                            <div class="error-library-card-meta">
                              ${errorLibraryEscape(
                                meta
                                || area
                              )}
                            </div>

                            <div class="error-library-card-stats">

                              <span>
                                Próxima:
                                ${errorLibraryEscape(
                                  formatErrorDate(
                                    item.due_date
                                  )
                                )}
                              </span>

                              <span>
                                ${Number(
                                  item.review_count
                                  || 0
                                )} ${
                                  Number(
                                    item.review_count
                                    || 0
                                  ) === 1
                                    ? "revisão"
                                    : "revisões"
                                }
                              </span>

                            </div>

                          </div>


                          <div class="error-library-card-actions">

                            <button
                              class="button secondary"
                              type="button"
                              data-library-open="${errorLibraryEscape(
                                item.id
                              )}"
                            >
                              Abrir
                            </button>

                          </div>


                          <div
                            class="error-library-card-details"
                            data-library-details="${errorLibraryEscape(
                              item.id
                            )}"
                            hidden
                          >

                            <div class="error-library-detail-block">
                              <span>Questão</span>
                              <div>
                                ${errorLibraryEscape(
                                  item.question_text
                                  || "—"
                                )}
                              </div>
                            </div>


                            <div class="error-library-detail-block">
                              <span>Resposta correta</span>
                              <div>
                                ${errorLibraryEscape(
                                  item.correct_answer
                                  || "—"
                                )}
                              </div>
                            </div>


                            ${
                              item.what_i_thought
                                ? `
                                  <div class="error-library-detail-block">
                                    <span>O que eu pensei</span>
                                    <div>
                                      ${errorLibraryEscape(
                                        item.what_i_thought
                                      )}
                                    </div>
                                  </div>
                                `
                                : ""
                            }

                          </div>

                        </article>
                      `;
                    }
                  )
                  .join("")}

              </div>

            </section>
          `;
        }
      )
      .join("");


  container
    .querySelectorAll(
      "[data-error-library-select]"
    )
    .forEach(
      (input) => {
        input.addEventListener(
          "change",
          () => {
            const id =
              input.dataset
                .errorLibrarySelect;


            if (input.checked) {
              selectedErrorIds.add(
                id
              );

            } else {
              selectedErrorIds.delete(
                id
              );
            }


            updateErrorBulkToolbar();
          }
        );
      }
    );


  updateErrorBulkToolbar();


  container
    .querySelectorAll(
      "[data-error-library-menu-trigger]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          (event) => {
            event.stopPropagation();


            const id =
              button
                .dataset
                .errorLibraryMenuTrigger;


            const menu =
              container.querySelector(
                `[data-error-library-menu="${CSS.escape(
                  id
                )}"]`
              );


            if (!menu) {
              return;
            }


            const willOpen =
              menu.hidden;


            closeErrorLibraryMenus();


            menu.hidden =
              !willOpen;


            button.setAttribute(
              "aria-expanded",
              willOpen
                ? "true"
                : "false"
            );
          }
        );
      }
    );


  container
    .querySelectorAll(
      "[data-error-library-menu]"
    )
    .forEach(
      (menu) => {
        menu.addEventListener(
          "click",
          (event) =>
            event.stopPropagation()
        );
      }
    );


  container
    .querySelectorAll(
      "[data-error-library-edit]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            closeErrorLibraryMenus();


            openErrorEditDialog(
              button
                .dataset
                .errorLibraryEdit
            );
          }
        );
      }
    );


  container
    .querySelectorAll(
      "[data-error-library-delete]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          async () => {
            closeErrorLibraryMenus();


            await deleteErrorFromLibrary(
              button
                .dataset
                .errorLibraryDelete
            );
          }
        );
      }
    );


  container
    .querySelectorAll(
      "[data-library-open]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            const id =
              button
                .dataset
                .libraryOpen;


            const details =
              container.querySelector(
                `[data-library-details="${CSS.escape(
                  id
                )}"]`
              );


            if (!details) {
              return;
            }


            const open =
              details.hidden;


            details.hidden =
              !open;


            button.textContent =
              open
                ? "Fechar"
                : "Abrir";
          }
        );
      }
    );
}


async function loadErrorLibrary() {
  const {
    data,
    error
  } =
    await errorSb
      .from(
        "error_notebook"
      )
      .select(
        "id,area,materia,theme,ccq,question_text,question_image_path,correct_answer,what_i_thought,due_date,review_count,created_at"
      )
      .eq(
        "active",
        true
      )
      .order(
        "area",
        {
          ascending:
            true,

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
      )
      .limit(
        1000
      );


  if (error) {
    console.warn(
      "Não foi possível carregar a biblioteca do Caderno de Erros:",
      error.message
    );

    return;
  }


  errorLibraryItems =
    data || [];


  populateLibraryAreas();

  renderErrorLibrary();
}




function wireErrorLibrary() {
  document
    .querySelectorAll(
      "[data-error-tab]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () =>
            switchErrorTab(
              button.dataset
                .errorTab
            )
        );
      }
    );


  document
    .getElementById(
      "error-library-area"
    )
    ?.addEventListener(
      "change",
      renderErrorLibrary
    );


  document
    .getElementById(
      "error-library-search"
    )
    ?.addEventListener(
      "input",
      renderErrorLibrary
    );


  document
    .getElementById(
      "error-library-select-all"
    )
    ?.addEventListener(
      "change",
      (event) => {
        const ids =
          filteredErrorLibrary()
            .map(
              (item) =>
                item.id
            );


        for (
          const id
          of ids
        ) {
          if (
            event.target.checked
          ) {
            selectedErrorIds.add(
              id
            );

          } else {
            selectedErrorIds.delete(
              id
            );
          }
        }


        renderErrorLibrary();
      }
    );


  document
    .getElementById(
      "error-library-delete-selected"
    )
    ?.addEventListener(
      "click",
      deleteSelectedErrors
    );


  document
    .getElementById(
      "error-edit-save"
    )
    ?.addEventListener(
      "click",
      saveEditedError
    );


  [
    "error-edit-close",
    "error-edit-cancel"
  ].forEach(
    (id) => {
      document
        .getElementById(
          id
        )
        ?.addEventListener(
          "click",
          closeErrorEditDialog
        );
    }
  );


  const reviewTrigger =
    document.getElementById(
      "error-review-menu-trigger"
    );

  const reviewMenu =
    document.getElementById(
      "error-review-menu"
    );


  reviewTrigger?.addEventListener(
    "click",
    (event) => {
      event.stopPropagation();


      const open =
        reviewMenu?.hidden;


      closeErrorReviewMenu();


      if (
        reviewMenu
      ) {
        reviewMenu.hidden =
          !open;
      }


      reviewTrigger.setAttribute(
        "aria-expanded",
        open
          ? "true"
          : "false"
      );
    }
  );


  reviewMenu?.addEventListener(
    "click",
    (event) =>
      event.stopPropagation()
  );


  document
    .getElementById(
      "error-review-edit"
    )
    ?.addEventListener(
      "click",
      () => {
        const item =
          currentErrorReviewItem();


        closeErrorReviewMenu();


        if (item) {
          openErrorEditDialog(
            item.id
          );
        }
      }
    );


  document
    .getElementById(
      "error-review-delete"
    )
    ?.addEventListener(
      "click",
      async () => {
        const item =
          currentErrorReviewItem();


        closeErrorReviewMenu();


        if (item) {
          await deleteErrorFromLibrary(
            item.id
          );

          await renderCurrentError();
        }
      }
    );


  document
    .getElementById(
      "error-import-file"
    )
    ?.addEventListener(
      "change",
      async (event) => {
        const file =
          event.target
            .files?.[0]
          || null;


        importedErrorRows =
          [];


        renderErrorImportPreview();


        if (!file) {
          return;
        }


        const status =
          document.getElementById(
            "error-import-status"
          );


        try {
          status.textContent =
            "Lendo planilha...";

          status.className =
            "error-status";


          const workbook =
            XLSX.read(
              await file.arrayBuffer(),
              {
                type:
                  "array"
              }
            );


          importedErrorRows =
            parseErrorImportRows(
              workbook
            );


          if (
            !importedErrorRows.length
          ) {
            throw new Error(
              "Nenhuma linha com CCQ foi encontrada."
            );
          }


          renderErrorImportPreview();


          status.textContent =
            `${importedErrorRows.length} item${importedErrorRows.length === 1 ? "" : "s"} pronto${importedErrorRows.length === 1 ? "" : "s"} para importar.`;

          status.className =
            "error-status success";


        } catch (error) {
          console.error(
            error
          );


          status.textContent =
            error.message
            || "Não foi possível ler o arquivo.";

          status.className =
            "error-status error";
        }
      }
    );


  document
    .getElementById(
      "error-import-confirm"
    )
    ?.addEventListener(
      "click",
      importErrorRows
    );


  document.addEventListener(
    "click",
    () => {
      closeErrorLibraryMenus();
      closeErrorReviewMenu();
    }
  );


  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key ===
        "Escape"
      ) {
        closeErrorLibraryMenus();
        closeErrorReviewMenu();
      }
    }
  );
}




/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

async function initErrorNotebook() {
  errorUser =
    window.docmapUser;


  wireNewError();

  wireErrorReview();

  wireErrorLibrary();


  await Promise.all([
    loadErrorMetrics(),
    loadErrorAreas(),
    loadErrorLibrary()
  ]);


  await loadErrorQueue();
}


if (
  window.docmapUser
) {
  initErrorNotebook();


} else {
  window.addEventListener(
    "docmap:ready",
    initErrorNotebook,
    {
      once:
        true
    }
  );
}
