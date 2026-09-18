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
        "id,area,materia,theme,ccq,question_text,correct_answer,what_i_thought,due_date,review_count,created_at"
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
