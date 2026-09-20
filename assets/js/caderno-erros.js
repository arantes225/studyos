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

let preparedNewErrorImage =
  null;

let preparedNewErrorOriginalSize =
  null;


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


function normalizeErrorAgendaArea(
  value
) {
  const normalized =
    String(
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
      );

  if (
    !normalized
    || normalized === "sem area"
  ) {
    return "";
  }

  return normalized;
}


function sameErrorAgendaArea(
  first,
  second
) {
  return (
    normalizeErrorAgendaArea(
      first
    )
    ===
    normalizeErrorAgendaArea(
      second
    )
  );
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
  const mode =
    window.luriaStudyMode
    || "medicine";

  allErrorAreas =
    window.LuriaStudyMode
      ?.generalAreasFor(
        mode
      )
    || [];

  const select =
    document.getElementById(
      "error-area-filter"
    );

  if (!select) {
    return;
  }

  select.innerHTML =
    `<option value="">Todas as áreas</option>`
    + allErrorAreas
        .map(
          (area) => `
            <option value="${escapeErrorHtml(area)}">
              ${escapeErrorHtml(area)}
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



const LURIA_IMAGE_TARGET_BYTES =
  100 * 1024;

const LURIA_IMAGE_SOFT_MAX_BYTES =
  150 * 1024;

const LURIA_IMAGE_MAX_DIMENSION =
  1100;


async function compressLuriaImageBlob(
  sourceBlob
) {
  if (
    !sourceBlob
    || !sourceBlob.type
      ?.startsWith(
        "image/"
      )
  ) {
    return sourceBlob;
  }


  /*
    Se já estiver abaixo da meta, não recomprime.
    Evita perda de qualidade desnecessária.
  */
  if (
    sourceBlob.size
    <= LURIA_IMAGE_TARGET_BYTES
  ) {
    return sourceBlob;
  }


  try {
    const bitmap =
      await createImageBitmap(
        sourceBlob
      );


    const originalWidth =
      bitmap.width;

    const originalHeight =
      bitmap.height;


    const dimensionSteps =
      [
        1100,
        1000,
        900,
        820
      ];


    const qualitySteps =
      [
        0.82,
        0.76,
        0.70,
        0.64,
        0.58
      ];


    let bestReadable =
      null;

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
            / originalWidth,
          maxDimension
            / originalHeight
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


      context.imageSmoothingEnabled =
        true;

      context.imageSmoothingQuality =
        "high";

      context.fillStyle =
        "#ffffff";

      context.fillRect(
        0,
        0,
        width,
        height
      );

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
            (
              resolve
            ) => {
              canvas.toBlob(
                resolve,
                "image/webp",
                quality
              );
            }
          );


        if (!candidate) {
          continue;
        }


        if (
          !smallest
          || candidate.size
            < smallest.size
        ) {
          smallest =
            candidate;
        }


        /*
          Preserva um candidato nítido de até 150 KB.
          Só usamos algo mais agressivo se não houver
          opção legível nessa faixa.
        */
        if (
          candidate.size
            <= LURIA_IMAGE_SOFT_MAX_BYTES
          && quality >= 0.64
          && maxDimension >= 900
        ) {
          if (
            !bestReadable
            || candidate.size
              < bestReadable.size
          ) {
            bestReadable =
              candidate;
          }
        }


        if (
          candidate.size
          <= LURIA_IMAGE_TARGET_BYTES
        ) {
          bitmap.close?.();

          return candidate;
        }
      }
    }


    bitmap.close?.();


    /*
      Se 100 KB exigir perda excessiva,
      aceita até 150 KB para manter texto/diagramas nítidos.
    */
    if (bestReadable) {
      return bestReadable;
    }


    return smallest
      || sourceBlob;


  } catch (error) {
    console.warn(
      "Não foi possível otimizar a imagem:",
      error
    );

    return sourceBlob;
  }
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


  const blob =
    await compressLuriaImageBlob(
      file
    );


  if (
    blob === file
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
        blob.type
        || "image/webp",

      lastModified:
        Date.now()
    }
  );
}


function formatErrorFileSize(
  bytes
) {
  const value =
    Number(
      bytes
      || 0
    );


  if (
    value < 1024
  ) {
    return `${value} B`;
  }


  if (
    value < 1024 * 1024
  ) {
    return `${(
      value
      / 1024
    ).toFixed(0)} KB`;
  }


  return `${(
    value
    / (
      1024
      * 1024
    )
  ).toFixed(1)} MB`;
}


function setNewErrorImageInfo(
  text,
  type = ""
) {
  const element =
    document.getElementById(
      "new-error-image-info"
    );


  if (!element) {
    return;
  }


  element.textContent =
    text;


  element.className =
    `error-image-info ${type}`
      .trim();
}


async function prepareNewErrorImage(
  file
) {
  preparedNewErrorImage =
    null;

  preparedNewErrorOriginalSize =
    null;


  const extractButton =
    document.getElementById(
      "extract-error-image-text"
    );

  const removeButton =
    document.getElementById(
      "remove-new-error-image"
    );


  if (!file) {
    setNewErrorImageInfo(
      ""
    );


    if (extractButton) {
      extractButton.disabled =
        true;
    }

    if (removeButton) {
      removeButton.disabled =
        true;
    }


    return;
  }


  if (
    !file.type
      ?.startsWith(
        "image/"
      )
  ) {
    setNewErrorImageInfo(
      "Selecione um arquivo de imagem.",
      "error"
    );


    if (extractButton) {
      extractButton.disabled =
        true;
    }

    if (removeButton) {
      removeButton.disabled =
        true;
    }


    return;
  }


  if (extractButton) {
    extractButton.disabled =
      false;
  }

  if (removeButton) {
    removeButton.disabled =
      false;
  }


  preparedNewErrorOriginalSize =
    file.size;


  setNewErrorImageInfo(
    "Preparando e comprimindo imagem..."
  );


  try {
    preparedNewErrorImage =
      await compressErrorImage(
        file
      );


    const finalFile =
      preparedNewErrorImage
      || file;


    if (
      finalFile === file
      || (
        finalFile.size
        >= file.size
      )
    ) {
      setNewErrorImageInfo(
        `Imagem já otimizada: ${formatErrorFileSize(
          file.size
        )}. O arquivo original será mantido.`,
        "success"
      );

      return;
    }


    const reduction =
      Math.max(
        0,
        (
          1
          - (
            finalFile.size
            / file.size
          )
        )
        * 100
      );


    setNewErrorImageInfo(
      `Comprimida: ${formatErrorFileSize(
        file.size
      )} → ${formatErrorFileSize(
        finalFile.size
      )} (${reduction.toFixed(0)}% menor).`,
      "success"
    );


  } catch (error) {
    console.warn(
      error
    );


    preparedNewErrorImage =
      file;


    setNewErrorImageInfo(
      "Não foi possível comprimir; o original será usado.",
      "error"
    );
  }
}


function normalizeOcrText(
  value
) {
  return String(
    value
    || ""
  )
    .replace(
      /\r/g,
      ""
    )
    .replace(
      /[ \t]+\n/g,
      "\n"
    )
    .replace(
      /\n{3,}/g,
      "\n\n"
    )
    .replace(
      /[ \t]{2,}/g,
      " "
    )
    .trim();
}


async function extractTextFromErrorImage(
  imageSource,
  onProgress
) {
  if (
    !window.Tesseract
  ) {
    throw new Error(
      "O extrator de texto não carregou. Atualize a página e tente novamente."
    );
  }


  const worker =
    await window
      .Tesseract
      .createWorker(
        "por",
        1,
        {
          logger:
            (message) => {
              if (
                typeof onProgress
                !== "function"
              ) {
                return;
              }


              if (
                message.status
                === "recognizing text"
              ) {
                onProgress(
                  Math.round(
                    Number(
                      message.progress
                      || 0
                    )
                    * 100
                  )
                );
              }
            }
        }
      );


  try {
    const {
      data
    } =
      await worker
        .recognize(
          imageSource
        );


    const text =
      normalizeOcrText(
        data?.text
        || ""
      );


    if (!text) {
      throw new Error(
        "Nenhum texto legível foi identificado na imagem."
      );
    }


    return text;

  } finally {
    await worker
      .terminate();
  }
}


function applyExtractedText(
  textarea,
  text
) {
  if (!textarea) {
    return false;
  }


  if (
    textarea.value
      .trim()
  ) {
    const replace =
      window.confirm(
        "O campo Questão já possui texto. Deseja substituir pelo texto extraído da imagem?"
      );


    if (!replace) {
      return false;
    }
  }


  textarea.value =
    text;


  textarea.focus();


  return true;
}


function clearNewErrorSelectedImage(message = "") {
  preparedNewErrorImage = null;
  preparedNewErrorOriginalSize = null;

  const input = document.getElementById("new-error-image");
  if (input) input.value = "";

  [
    "extract-error-image-text",
    "remove-new-error-image"
  ].forEach((id) => {
    const button = document.getElementById(id);
    if (button) button.disabled = true;
  });

  const keepCheckbox =
    document.getElementById(
      "keep-new-error-image"
    );

  if (keepCheckbox) {
    keepCheckbox.checked = false;
  }

  setNewErrorImageInfo(message);
}


async function extractNewErrorImageText() {
  const input = document.getElementById("new-error-image");
  const primaryButton = document.getElementById("extract-error-image-text");
  const keepCheckbox = document.getElementById("keep-new-error-image");
  const keepImage = Boolean(keepCheckbox?.checked);
  const file = input?.files?.[0] || null;

  if (!file) {
    setNewErrorImageInfo("Selecione uma imagem primeiro.", "error");
    return;
  }

  if (primaryButton) primaryButton.disabled = true;

  try {
    setNewErrorImageInfo("Extraindo texto: 0%...");

    const source = preparedNewErrorImage || file;
    const text = await extractTextFromErrorImage(source, (progress) => {
      setNewErrorImageInfo(`Extraindo texto: ${progress}%...`);
    });

    const applied = applyExtractedText(
      document.getElementById("new-error-question"),
      text
    );

    if (applied && !keepImage) {
      clearNewErrorSelectedImage(
        `Texto extraído. ${text.length} caracteres adicionados e a imagem foi removida.`
      );
      return;
    }

    setNewErrorImageInfo(
      applied
        ? `Texto extraído. ${text.length} caracteres adicionados. A imagem será mantida.`
        : "Extração concluída; o texto existente foi mantido.",
      "success"
    );
  } catch (error) {
    console.error(error);
    setNewErrorImageInfo(
      error.message || "Não foi possível extrair o texto.",
      "error"
    );
  } finally {
    if (input?.files?.[0]) {
      if (primaryButton) primaryButton.disabled = false;
    }
  }
}

async function downloadStoredErrorImage(
  path
) {
  if (!path) {
    throw new Error(
      "Este item não possui imagem salva."
    );
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
      .download(
        path
      );


  if (error) {
    throw error;
  }


  return data;
}


async function deleteStoredErrorImage(item, options = {}) {
  if (!item?.question_image_path) return false;

  const questionText =
    document.getElementById("error-edit-question")?.value.trim()
    || item.question_text
    || "";

  if (!questionText) {
    throw new Error("Para excluir a imagem, mantenha algum texto no campo Questão.");
  }

  const oldPath = item.question_image_path;

  const { error: updateError } = await errorSb
    .from("error_notebook")
    .update({
      question_text: questionText,
      question_image_path: null
    })
    .eq("id", item.id);

  if (updateError) throw updateError;

  const { error: storageError } = await errorSb
    .storage
    .from("docmap")
    .remove([oldPath]);

  if (storageError) {
    console.warn(
      "A referência da imagem foi removida, mas o arquivo não pôde ser apagado do Storage:",
      storageError.message
    );
  }

  item.question_image_path = null;
  item.question_text = questionText;

  const tools = document.getElementById("error-edit-image-tools");
  if (tools) tools.hidden = true;

  if (!options.skipReload) {
    await Promise.all([loadErrorLibrary(), loadErrorQueue()]);
  }

  return true;
}


async function extractStoredErrorImageText(keepImage = false) {
  if (!editingErrorId) return;

  const item =
    errorLibraryItems.find((entry) => entry.id === editingErrorId)
    || errorQueue.find((entry) => entry.id === editingErrorId);

  if (!item?.question_image_path) return;

  const buttons = [
    document.getElementById("error-edit-extract-image"),
    document.getElementById("error-edit-extract-image-keep"),
    document.getElementById("error-edit-delete-image")
  ].filter(Boolean);

  const status = document.getElementById("error-edit-ocr-status");
  buttons.forEach((button) => { button.disabled = true; });

  try {
    status.textContent = "Baixando imagem...";
    status.className = "error-status";

    const blob = await downloadStoredErrorImage(item.question_image_path);
    const text = await extractTextFromErrorImage(blob, (progress) => {
      status.textContent = `Extraindo texto: ${progress}%...`;
    });

    const applied = applyExtractedText(
      document.getElementById("error-edit-question"),
      text
    );

    if (applied && !keepImage) {
      status.textContent = "Texto extraído. Removendo imagem...";
      await deleteStoredErrorImage(item, { skipReload: true });
      status.textContent = "Texto extraído e imagem removida do Caderno.";
    } else {
      status.textContent = applied
        ? "Texto extraído. A imagem foi mantida."
        : "Texto extraído; conteúdo existente mantido.";
    }

    status.className = "error-status success";
  } catch (error) {
    console.error(error);
    status.textContent = error.message || "Não foi possível extrair o texto.";
    status.className = "error-status error";
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}


async function deleteEditingErrorImage() {
  if (!editingErrorId) return;

  const item =
    errorLibraryItems.find((entry) => entry.id === editingErrorId)
    || errorQueue.find((entry) => entry.id === editingErrorId);

  if (!item?.question_image_path) return;

  const confirmed = window.confirm(
    "Excluir a imagem deste item? O arquivo será apagado do Storage."
  );
  if (!confirmed) return;

  const status = document.getElementById("error-edit-ocr-status");

  try {
    status.textContent = "Excluindo imagem...";
    await deleteStoredErrorImage(item);
    status.textContent = "Imagem excluída.";
    status.className = "error-status success";
  } catch (error) {
    console.error(error);
    status.textContent = error.message || "Não foi possível excluir a imagem.";
    status.className = "error-status error";
  }
}

async function uploadErrorImage(
  file,
  preparedFile = null
) {
  if (!file) {
    return null;
  }


  const finalFile =
    preparedFile
    || await compressErrorImage(
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


  preparedNewErrorImage =
    null;

  preparedNewErrorOriginalSize =
    null;


  const extractButton =
    document.getElementById(
      "extract-error-image-text"
    );


  if (extractButton) {
    extractButton.disabled =
      true;
  }

  const keepImage =
    document.getElementById(
      "keep-new-error-image"
    );

  if (keepImage) {
    keepImage.checked =
      false;
  }


  setNewErrorImageInfo(
    ""
  );


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


  const keepImage =
    Boolean(
      document
        .getElementById(
          "keep-new-error-image"
        )
        ?.checked
    );

  const imageFile =
    keepImage
      ? (
          document
            .getElementById(
              "new-error-image"
            )
            .files[0]
          || null
        )
      : null;


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
        imageFile,
        preparedNewErrorImage
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
      "new-error-image"
    )
    ?.addEventListener(
      "change",
      (event) =>
        prepareNewErrorImage(
          event.target
            .files?.[0]
          || null
        )
    );


  document
    .getElementById(
      "extract-error-image-text"
    )
    ?.addEventListener(
      "click",
      extractNewErrorImageText
    );

  document
    .getElementById(
      "remove-new-error-image"
    )
    ?.addEventListener(
      "click",
      () => clearNewErrorSelectedImage("Imagem removida.")
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
  const selectColumns =
    "id,area,materia,theme,ccq,question_text,question_image_path,correct_answer,what_i_thought,due_date,current_interval_days,stability_days,review_count,last_reviewed_at,created_at";


  let data =
    [];

  let error =
    null;


  /*
    Pela Agenda:
    1. busca todos os CCQs da data;
    2. filtra a área no JavaScript de forma normalizada.
       Isso evita o caso "Sem área" / null / espaços / acentos
       fazer a fila ficar vazia mesmo com CCQs na data.
  */
  if (
    errorAgendaDate
  ) {
    const exactResult =
      await errorSb
        .from(
          "error_notebook"
        )
        .select(
          selectColumns
        )
        .eq(
          "active",
          true
        )
        .eq(
          "due_date",
          errorAgendaDate
        )
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


    error =
      exactResult.error;


    if (
      !error
    ) {
      data =
        (
          exactResult.data
          || []
        )
          .filter(
            item =>
              sameErrorAgendaArea(
                item.area,
                errorAgendaArea
              )
          );
    }


    /*
      Recuperação para atividades movidas para HOJE em versões
      anteriores, quando a agenda podia mudar visualmente sem
      atualizar corretamente due_date.

      Se a fila exata estiver vazia, mostramos os CCQs vencidos
      da mesma área. Isso evita abrir a Ambientação em branco.
    */
    if (
      !error
      &&
      !data.length
      &&
      errorAgendaDate
      === errorTodayISO()
    ) {
      const fallbackResult =
        await errorSb
          .from(
            "error_notebook"
          )
          .select(
            selectColumns
          )
          .eq(
            "active",
            true
          )
          .lte(
            "due_date",
            errorAgendaDate
          )
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


      if (
        fallbackResult.error
      ) {
        error =
          fallbackResult.error;

      } else {
        data =
          (
            fallbackResult.data
            || []
          )
            .filter(
              item =>
                sameErrorAgendaArea(
                  item.area,
                  errorAgendaArea
                )
            );
      }
    }


  } else {
    let query =
      errorSb
        .from(
          "error_notebook"
        )
        .select(
          selectColumns
        )
        .eq(
          "active",
          true
        )
        .lte(
          "due_date",
          errorTodayISO()
        );


    const area =
      currentAreaFilter();


    if (
      area
    ) {
      query =
        query.eq(
          "area",
          area
        );
    }


    const result =
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


    data =
      result.data
      || [];

    error =
      result.error;
  }


  if (
    error
  ) {
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
    data
    || [];


  errorIndex =
    0;


  const selectedArea =
    currentAreaFilter();


  const emptyCopy =
    document.getElementById(
      "error-empty-copy"
    );


  if (
    emptyCopy
  ) {
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


    if (
      title
    ) {
      title.textContent =
        "Erros agendados";
    }


    if (
      copy
    ) {
      copy.textContent =
        `Revisão de ${formatErrorDate(
          errorAgendaDate
        )}${
          errorAgendaArea
            ? ` · ${errorAgendaArea}`
            : ""
        }.`;
    }
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

  const mode =
    window.luriaStudyMode
    || "medicine";

  const areas =
    window.LuriaStudyMode
      ?.generalAreasFor(
        mode
      )
    || [];

  select.innerHTML =
    `<option value="">Todas as áreas</option>`
    + areas
        .map(
          (area) => `
            <option value="${escapeErrorHtml(area)}">
              ${escapeErrorHtml(area)}
            </option>
          `
        )
        .join("");

  if (
    current
    && areas.includes(
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


  const imageTools =
    document.getElementById(
      "error-edit-image-tools"
    );


  const imageOcrStatus =
    document.getElementById(
      "error-edit-ocr-status"
    );


  if (imageTools) {
    imageTools.hidden =
      !item.question_image_path;
  }


  if (imageOcrStatus) {
    imageOcrStatus.textContent =
      "";

    imageOcrStatus.className =
      "error-status";
  }


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

  const exportButton =
    document.getElementById(
      "error-library-export-selected"
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

  if (exportButton) {
    exportButton.disabled =
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


async function errorPdfImageData(path) {
  if (!path) return null;

  try {
    const blob = await downloadStoredErrorImage(path);
    const dataUrl = await readImageDataUrl(blob);
    const image = await loadImageElement(dataUrl);

    const maxWidth = 1000;
    const scale = Math.min(1, maxWidth / image.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));

    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.78),
      width: canvas.width,
      height: canvas.height
    };
  } catch (error) {
    console.warn("Imagem não incluída no PDF do Caderno:", error);
    return null;
  }
}


function errorPdfAddImage(doc, imageData, state) {
  if (!imageData) return state;

  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = Math.min(95, pageWidth - margin * 2);
  const maxHeight = 75;

  const ratio = imageData.width / Math.max(1, imageData.height);
  let width = maxWidth;
  let height = width / ratio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }

  if (state.y + height + 8 > pageHeight - 14) {
    doc.addPage();
    state.y = 16;
  }

  const x = margin + Math.max(0, (pageWidth - margin * 2 - width) / 2);
  doc.addImage(imageData.dataUrl, "JPEG", x, state.y, width, height, undefined, "FAST");
  state.y += height + 6;
  return state;
}


function errorPdfAddWrappedText(doc, label, value, state) {
  if (!value) return state;

  const margin = 14;
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const labelLines = doc.splitTextToSize(`${label}:`, maxWidth);
  const valueLines = doc.splitTextToSize(String(value), maxWidth);
  const needed = (labelLines.length + valueLines.length + 1) * 5;

  if (state.y + needed > pageHeight - 14) {
    doc.addPage();
    state.y = 16;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(labelLines, margin, state.y);
  state.y += labelLines.length * 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(valueLines, margin, state.y);
  state.y += valueLines.length * 4.5 + 4;

  return state;
}


async function exportSelectedErrorsPdf() {
  const ids = Array.from(selectedErrorIds);
  if (!ids.length) return;

  if (!window.jspdf?.jsPDF) {
    setErrorLibraryStatus("Gerador de PDF não carregou. Atualize a página.", "error");
    return;
  }

  const items = errorLibraryItems.filter((item) => selectedErrorIds.has(item.id));
  if (!items.length) return;

  const button = document.getElementById("error-library-export-selected");
  if (button) button.disabled = true;
  setErrorLibraryStatus("Gerando PDF...");

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 14;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("LURIA — Caderno de Erros", margin, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `${items.length} item${items.length === 1 ? "" : "s"} selecionado${items.length === 1 ? "" : "s"}`,
      margin,
      23
    );

    let state = { y: 32 };

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];

      if (state.y > 250) {
        doc.addPage();
        state.y = 16;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(
        `${index + 1}. ${item.area || "Sem área"}${item.materia ? ` · ${item.materia}` : ""}`,
        margin,
        state.y
      );
      state.y += 7;

      state = errorPdfAddWrappedText(doc, "Tema", item.theme, state);
      state = errorPdfAddWrappedText(doc, "CCQ", item.ccq, state);
      state = errorPdfAddWrappedText(doc, "Questão", item.question_text, state);

      if (item.question_image_path) {
        setErrorLibraryStatus(`Preparando imagem ${index + 1} de ${items.length}...`);
        const imageData = await errorPdfImageData(item.question_image_path);
        state = errorPdfAddImage(doc, imageData, state);
      }

      state = errorPdfAddWrappedText(doc, "Resposta correta", item.correct_answer, state);
      state = errorPdfAddWrappedText(doc, "O que eu pensei", item.what_i_thought, state);

      state.y += 4;
      doc.setDrawColor(220);
      doc.line(margin, state.y, doc.internal.pageSize.getWidth() - margin, state.y);
      state.y += 8;
    }

    doc.save(`luria-caderno-erros-${errorTodayISO()}.pdf`);
    setErrorLibraryStatus("PDF exportado.", "success");
  } catch (error) {
    console.error(error);
    setErrorLibraryStatus(`Não foi possível gerar o PDF: ${error.message}`, "error");
  } finally {
    if (button) button.disabled = false;
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
      "error-library-export-selected"
    )
    ?.addEventListener(
      "click",
      exportSelectedErrorsPdf
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


  document
    .getElementById(
      "error-edit-extract-image"
    )
    ?.addEventListener(
      "click",
      () => extractStoredErrorImageText(false)
    );

  document
    .getElementById(
      "error-edit-extract-image-keep"
    )
    ?.addEventListener(
      "click",
      () => extractStoredErrorImageText(true)
    );

  document
    .getElementById(
      "error-edit-delete-image"
    )
    ?.addEventListener(
      "click",
      deleteEditingErrorImage
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

window.addEventListener(
  "luria:study-mode",
  () => {
    loadErrorAreas();
    populateLibraryAreas();
  }
);


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
