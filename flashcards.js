const flashSb = window.supabaseClient;

let flashUser = null;

let reviewQueue = [];
let reviewIndex = 0;

let importRows = [];

let importFileKind =
  "spreadsheet";

let ankiDeckAreaMap =
  new Map();

let ankiImportStats = {
  packageFormat: null,
  sourceDecks: [],
  mediaReferences: 0
};

let libraryCards = [];

let editingFlashcardId =
  null;

const selectedFlashcardIds =
  new Set();

let flashSettings = {
  flashcard_intervals_hard: [1, 3, 7],
  flashcard_intervals_medium: [7, 21, 45],
  flashcard_intervals_easy: [15, 45, 70]
};

function todayISO() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    now.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function startOfTodayISO() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);

  return date.toISOString();
}

function startOfTomorrowISO() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(
    date.getDate() + 1
  );

  return date.toISOString();
}

function escapeFlashHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function setFlashStatus(
  id,
  text,
  type = ""
) {
  const element =
    document.getElementById(id);

  if (!element) return;

  element.textContent =
    text;

  element.className =
    `flash-status ${type}`
      .trim();
}

function truncateText(
  text,
  max = 160
) {
  const value =
    String(text ?? "");

  if (value.length <= max) {
    return value;
  }

  return (
    value.slice(
      0,
      max - 1
    )
    + "…"
  );
}

function formatDueDate(value) {
  if (!value) return "—";

  const [year, month, day] =
    value.split("-").map(Number);

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  ).format(
    new Date(
      year,
      month - 1,
      day
    )
  );
}

function setTaxonomyChip(
  id,
  value
) {
  const element =
    document.getElementById(id);

  if (!element) return;

  if (!value) {
    element.hidden = true;
    element.textContent = "";
    return;
  }

  element.hidden = false;
  element.textContent = value;
}

function switchFlashTab(tabName) {
  document
    .querySelectorAll(
      "[data-flash-tab]"
    )
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.flashTab
          === tabName
      );
    });

  document
    .querySelectorAll(
      "[data-flash-section]"
    )
    .forEach((section) => {
      section.classList.toggle(
        "active",
        section.dataset.flashSection
          === tabName
      );
    });

  if (tabName === "library") {
    loadLibrary();
  }
}

function wireTabs() {
  document
    .querySelectorAll(
      "[data-flash-tab]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          switchFlashTab(
            button.dataset.flashTab
          );
        }
      );
    });
}

async function loadFlashSettings() {
  const {
    data,
    error
  } = await flashSb
    .from("user_settings")
    .select(`
      flashcard_intervals_hard,
      flashcard_intervals_medium,
      flashcard_intervals_easy
    `)
    .eq(
      "user_id",
      flashUser.id
    )
    .maybeSingle();

  if (error) {
    console.warn(
      "Não foi possível carregar os intervalos:",
      error.message
    );

    return;
  }

  if (data) {
    flashSettings = {
      ...flashSettings,
      ...data
    };
  }
}

function intervalForCard(
  card,
  rating
) {
  const field =
    rating === "hard"
      ? "flashcard_intervals_hard"
      : rating === "medium"
        ? "flashcard_intervals_medium"
        : "flashcard_intervals_easy";

  const list =
    flashSettings[field]
    || [];

  if (!list.length) {
    return null;
  }

  const stage =
    Number(
      card?.review_count
      || 0
    ) + 1;

  const index =
    Math.min(
      stage,
      list.length
    ) - 1;

  return list[index];
}

function updateRatingLabels(card) {
  ["hard", "medium", "easy"]
    .forEach((rating) => {
      const element =
        document.querySelector(
          `[data-rating-days="${rating}"]`
        );

      if (!element) return;

      const days =
        intervalForCard(
          card,
          rating
        );

      element.textContent =
        days
          ? `≈ ${days} dia${days === 1 ? "" : "s"}`
          : "—";
    });
}

async function loadMetrics() {
  const today =
    todayISO();

  const [
    dueResult,
    overdueResult,
    reviewResult
  ] = await Promise.all([
    flashSb
      .from("flashcards")
      .select(
        "id",
        {
          count: "exact",
          head: true
        }
      )
      .eq(
        "active",
        true
      )
      .lte(
        "due_date",
        today
      ),

    flashSb
      .from("flashcards")
      .select(
        "id",
        {
          count: "exact",
          head: true
        }
      )
      .eq(
        "active",
        true
      )
      .lt(
        "due_date",
        today
      ),

    flashSb
      .from("flashcard_reviews")
      .select(
        "was_correct"
      )
      .gte(
        "reviewed_at",
        startOfTodayISO()
      )
      .lt(
        "reviewed_at",
        startOfTomorrowISO()
      )
  ]);

  document
    .getElementById(
      "metric-due"
    )
    .textContent =
      dueResult.count ?? 0;

  document
    .getElementById(
      "metric-overdue"
    )
    .textContent =
      overdueResult.count ?? 0;

  const reviews =
    reviewResult.data || [];

  document
    .getElementById(
      "metric-reviewed"
    )
    .textContent =
      reviews.length;

  const correct =
    reviews.filter(
      (row) =>
        row.was_correct
          === true
    ).length;

  document
    .getElementById(
      "metric-accuracy"
    )
    .textContent =
      reviews.length
        ? `${Math.round(
            100
            * correct
            / reviews.length
          )}%`
        : "—";
}

async function signedFlashImage(path) {
  if (!path) {
    return null;
  }

  const {
    data,
    error
  } = await flashSb
    .storage
    .from("docmap")
    .createSignedUrl(
      path,
      60 * 60
    );

  if (error) {
    console.warn(
      "Imagem do flashcard indisponível:",
      error.message
    );

    return null;
  }

  return data?.signedUrl || null;
}

async function setReviewImage(
  imageId,
  path
) {
  const image =
    document.getElementById(
      imageId
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


  if (!path) {
    return;
  }


  const url =
    await signedFlashImage(
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

async function renderCurrentReview() {
  const empty =
    document.getElementById(
      "review-empty"
    );

  const stage =
    document.getElementById(
      "review-stage"
    );

  if (
    reviewIndex
    >= reviewQueue.length
  ) {
    stage.hidden = true;
    empty.hidden = false;

    document
      .getElementById(
        "review-position"
      )
      .textContent =
        reviewQueue.length
          ? `${reviewQueue.length} / ${reviewQueue.length}`
          : "0 / 0";

    document
      .getElementById(
        "review-session-copy"
      )
      .textContent =
        reviewQueue.length
          ? "sessão concluída"
          : "nenhum card pendente";

    return;
  }

  empty.hidden = true;
  stage.hidden = false;

  const card =
    reviewQueue[
      reviewIndex
    ];

  document
    .getElementById(
      "review-position"
    )
    .textContent =
      `${reviewIndex + 1} / ${reviewQueue.length}`;

  document
    .getElementById(
      "review-session-copy"
    )
    .textContent =
      `${reviewQueue.length - reviewIndex} restante${reviewQueue.length - reviewIndex === 1 ? "" : "s"}`;

  setTaxonomyChip(
    "review-area",
    card.area
  );

  setTaxonomyChip(
    "review-materia",
    card.materia
  );

  setTaxonomyChip(
    "review-theme",
    card.theme
  );

  document
    .getElementById(
      "review-front"
    )
    .textContent =
      card.front_text;

  document
    .getElementById(
      "review-back"
    )
    .textContent =
      card.back_text;

  document
    .getElementById(
      "review-answer"
    )
    .hidden = true;

  document
    .getElementById(
      "rating-actions"
    )
    .hidden = true;

  document
    .getElementById(
      "show-answer"
    )
    .hidden = false;

  setFlashStatus(
    "review-status",
    ""
  );

  updateRatingLabels(
    card
  );

  await Promise.all([
    setReviewImage(
      "review-front-image",
      card.front_image_path
    ),
    setReviewImage(
      "review-back-image",
      card.back_image_path
    )
  ]);
}

async function loadReviewQueue() {
  const {
    data,
    error
  } = await flashSb
    .from("flashcards")
    .select(`
      id,
      area,
      materia,
      theme,
      front_text,
      back_text,
      front_image_path,
      back_image_path,
      due_date,
      review_count
    `)
    .eq(
      "active",
      true
    )
    .lte(
      "due_date",
      todayISO()
    )
    .order(
      "due_date",
      {
        ascending: true
      }
    )
    .order(
      "created_at",
      {
        ascending: true
      }
    )
    .limit(250);

  if (error) {
    console.error(error);

    setFlashStatus(
      "review-status",
      `Não foi possível carregar os cards: ${error.message}`,
      "error"
    );

    return;
  }

  reviewQueue =
    data || [];

  reviewIndex = 0;

  await renderCurrentReview();
}

function wireReview() {
  document
    .getElementById(
      "show-answer"
    )
    .addEventListener(
      "click",
      () => {
        document
          .getElementById(
            "review-answer"
          )
          .hidden = false;

        document
          .getElementById(
            "rating-actions"
          )
          .hidden = false;

        document
          .getElementById(
            "show-answer"
          )
          .hidden = true;
      }
    );

  document
    .querySelectorAll(
      "[data-rating]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          const card =
            reviewQueue[
              reviewIndex
            ];

          if (!card) return;

          const rating =
            button.dataset.rating;

          document
            .querySelectorAll(
              "[data-rating]"
            )
            .forEach((item) => {
              item.disabled = true;
            });

          setFlashStatus(
            "review-status",
            "Salvando revisão..."
          );

          const {
            error
          } = await flashSb.rpc(
            "review_flashcard",
            {
              p_flashcard_id:
                card.id,

              p_rating:
                rating,

              p_was_correct:
                rating !== "hard"
            }
          );

          document
            .querySelectorAll(
              "[data-rating]"
            )
            .forEach((item) => {
              item.disabled = false;
            });

          if (error) {
            console.error(error);

            setFlashStatus(
              "review-status",
              `Não foi possível salvar: ${error.message}`,
              "error"
            );

            return;
          }

          reviewIndex += 1;

          await Promise.all([
            renderCurrentReview(),
            loadMetrics()
          ]);
        }
      );
    });
}

async function uploadFlashImage(
  file,
  side
) {
  if (!file) return null;

  const safeName =
    String(file.name)
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        "-"
      );

  const path =
    `${flashUser.id}/flashcards/${crypto.randomUUID()}-${side}-${safeName}`;

  const {
    error
  } = await flashSb
    .storage
    .from("docmap")
    .upload(
      path,
      file,
      {
        cacheControl: "3600",
        upsert: false,
        contentType:
          file.type
          || undefined
      }
    );

  if (error) {
    throw error;
  }

  return path;
}

function clearCreateForm() {
  [
    "create-area",
    "create-materia",
    "create-theme",
    "create-front",
    "create-back"
  ].forEach((id) => {
    document
      .getElementById(id)
      .value = "";
  });

  document
    .getElementById(
      "create-front-image"
    )
    .value = "";

  document
    .getElementById(
      "create-back-image"
    )
    .value = "";

  setFlashStatus(
    "create-status",
    ""
  );
}

function wireCreate() {
  document
    .getElementById(
      "clear-create-card"
    )
    .addEventListener(
      "click",
      clearCreateForm
    );

  document
    .getElementById(
      "create-card"
    )
    .addEventListener(
      "click",
      async () => {
        const button =
          document.getElementById(
            "create-card"
          );

        const area =
          document.getElementById(
            "create-area"
          ).value.trim();

        const materia =
          document.getElementById(
            "create-materia"
          ).value.trim();

        const theme =
          document.getElementById(
            "create-theme"
          ).value.trim();

        const front =
          document.getElementById(
            "create-front"
          ).value.trim();

        const back =
          document.getElementById(
            "create-back"
          ).value.trim();

        const frontFile =
          document.getElementById(
            "create-front-image"
          ).files[0]
          || null;

        const backFile =
          document.getElementById(
            "create-back-image"
          ).files[0]
          || null;

        if (!front || !back) {
          setFlashStatus(
            "create-status",
            "Preencha a frente e o verso.",
            "error"
          );

          return;
        }

        button.disabled = true;

        setFlashStatus(
          "create-status",
          "Criando flashcard..."
        );

        const uploadedPaths = [];

        try {
          const [
            frontImagePath,
            backImagePath
          ] = await Promise.all([
            uploadFlashImage(
              frontFile,
              "front"
            ),
            uploadFlashImage(
              backFile,
              "back"
            )
          ]);

          if (frontImagePath) {
            uploadedPaths.push(
              frontImagePath
            );
          }

          if (backImagePath) {
            uploadedPaths.push(
              backImagePath
            );
          }

          const {
            error
          } = await flashSb.rpc(
            "create_flashcard_v2",
            {
              p_area:
                area || null,

              p_materia:
                materia || null,

              p_theme:
                theme || null,

              p_front_text:
                front,

              p_back_text:
                back,

              p_front_image_path:
                frontImagePath,

              p_back_image_path:
                backImagePath
            }
          );

          if (error) {
            throw error;
          }

          clearCreateForm();

          setFlashStatus(
            "create-status",
            "Flashcard criado.",
            "success"
          );

          await Promise.all([
            loadMetrics(),
            loadReviewQueue()
          ]);

        } catch (error) {
          console.error(error);

          if (uploadedPaths.length) {
            await flashSb
              .storage
              .from("docmap")
              .remove(
                uploadedPaths
              );
          }

          setFlashStatus(
            "create-status",
            `Não foi possível criar: ${error.message}`,
            "error"
          );

        } finally {
          button.disabled = false;
        }
      }
    );
}

function valueFromRow(
  row,
  aliases
) {
  const entries =
    Object.entries(row);

  for (
    const [key, value]
    of entries
  ) {
    const normalized =
      normalizeHeader(key);

    if (
      aliases.includes(
        normalized
      )
    ) {
      return String(
        value ?? ""
      ).trim();
    }
  }

  return "";
}

function normalizeImportedRow(row) {
  return {
    area:
      valueFromRow(
        row,
        [
          "area"
        ]
      ),

    materia:
      valueFromRow(
        row,
        [
          "materia",
          "disciplina"
        ]
      ),

    theme:
      valueFromRow(
        row,
        [
          "tema",
          "theme",
          "assunto"
        ]
      ),

    front_text:
      valueFromRow(
        row,
        [
          "frente",
          "front",
          "pergunta",
          "questao"
        ]
      ),

    back_text:
      valueFromRow(
        row,
        [
          "verso",
          "back",
          "resposta",
          "answer"
        ]
      )
  };
}


function isAnkiPackageFile(
  file
) {
  return /\.(apkg|colpkg)$/i
    .test(
      file?.name
      || ""
    );
}


function stripAnkiHtml(
  value
) {
  let text =
    String(
      value
      ?? ""
    );


  text =
    text.replace(
      /\[sound:[^\]]+\]/gi,
      ""
    );


  text =
    text.replace(
      /<br\s*\/?>/gi,
      "\n"
    );


  text =
    text.replace(
      /<\/(?:div|p|li|tr|h[1-6])>/gi,
      "\n"
    );


  if (
    typeof document
      !== "undefined"
  ) {
    const element =
      document.createElement(
        "div"
      );

    element.innerHTML =
      text;

    text =
      element.textContent
      || element.innerText
      || "";
  } else {
    text =
      text.replace(
        /<[^>]+>/g,
        ""
      );
  }


  return text
    .replace(
      /\u00a0/g,
      " "
    )
    .replace(
      /\r/g,
      ""
    )
    .replace(
      /\n{3,}/g,
      "\n\n"
    )
    .trim();
}


function ankiMediaReferenceCount(
  value
) {
  const text =
    String(
      value
      ?? ""
    );

  const images =
    text.match(
      /<img\b[^>]*>/gi
    )
    || [];

  const sounds =
    text.match(
      /\[sound:[^\]]+\]/gi
    )
    || [];

  return (
    images.length
    + sounds.length
  );
}


function replaceClozeForFront(
  value
) {
  return String(
    value
    ?? ""
  )
    .replace(
      /\{\{c\d+::(.*?)(?:::(.*?))?\}\}/gi,
      (
        _match,
        _answer,
        hint
      ) =>
        hint
          ? `[${hint}]`
          : "[…]"
    );
}


function replaceClozeForBack(
  value
) {
  return String(
    value
    ?? ""
  )
    .replace(
      /\{\{c\d+::(.*?)(?:::(.*?))?\}\}/gi,
      "$1"
    );
}


function fieldsToFlashcard(
  fields
) {
  const rawFields =
    fields
      .map(
        (field) =>
          String(
            field
            ?? ""
          )
      );


  if (!rawFields.length) {
    return null;
  }


  const first =
    rawFields[0]
    || "";


  const hasCloze =
    /\{\{c\d+::/i.test(
      first
    );


  let front =
    "";

  let back =
    "";


  if (hasCloze) {
    front =
      stripAnkiHtml(
        replaceClozeForFront(
          first
        )
      );

    back =
      stripAnkiHtml(
        replaceClozeForBack(
          first
        )
      );


    const extra =
      rawFields
        .slice(
          1
        )
        .map(
          stripAnkiHtml
        )
        .filter(Boolean);


    if (
      extra.length
    ) {
      back =
        [
          back,
          ...extra
        ]
          .filter(Boolean)
          .join(
            "\n\n"
          );
    }

  } else {
    front =
      stripAnkiHtml(
        first
      );


    back =
      rawFields
        .slice(
          1
        )
        .map(
          stripAnkiHtml
        )
        .filter(Boolean)
        .join(
          "\n\n"
        );
  }


  if (
    !front
    || !back
  ) {
    return null;
  }


  return {
    front,
    back,

    mediaReferences:
      rawFields.reduce(
        (
          total,
          field
        ) =>
          total
          + ankiMediaReferenceCount(
              field
            ),
        0
      )
  };
}


function sourceDeckDefaultArea(
  deckName
) {
  const parts =
    String(
      deckName
      || ""
    )
      .split(
        "::"
      )
      .map(
        (part) =>
          part.trim()
      )
      .filter(Boolean);

  return (
    parts[
      parts.length - 1
    ]
    || "Anki"
  );
}


function readSqlRows(
  database,
  sql
) {
  const result =
    database.exec(
      sql
    );


  if (
    !result.length
  ) {
    return [];
  }


  const {
    columns,
    values
  } =
    result[0];


  return values.map(
    (row) =>
      Object.fromEntries(
        columns.map(
          (
            column,
            index
          ) => [
            column,
            row[
              index
            ]
          ]
        )
      )
  );
}


function sqliteTableNames(
  database
) {
  return new Set(
    readSqlRows(
      database,
      `
        select name
        from sqlite_master
        where type = 'table'
      `
    )
      .map(
        (row) =>
          String(
            row.name
          )
      )
  );
}


function readAnkiDeckMap(
  database
) {
  const tables =
    sqliteTableNames(
      database
    );

  const map =
    new Map();


  if (
    tables.has(
      "decks"
    )
  ) {
    try {
      const rows =
        readSqlRows(
          database,
          `
            select
              id,
              name
            from decks
          `
        );


      for (
        const row
        of rows
      ) {
        map.set(
          String(
            row.id
          ),
          String(
            row.name
            || "Anki"
          )
        );
      }

    } catch (
      error
    ) {
      console.warn(
        "Tabela decks não pôde ser lida.",
        error
      );
    }
  }


  if (
    !map.size
    && tables.has(
      "col"
    )
  ) {
    try {
      const rows =
        readSqlRows(
          database,
          `
            select decks
            from col
            limit 1
          `
        );


      const raw =
        rows[0]
          ?.decks;


      if (raw) {
        const parsed =
          JSON.parse(
            raw
          );


        for (
          const [
            id,
            deck
          ]
          of Object.entries(
            parsed
          )
        ) {
          map.set(
            String(
              id
            ),
            String(
              deck?.name
              || "Anki"
            )
          );
        }
      }

    } catch (
      error
    ) {
      console.warn(
        "Mapa legado de decks não pôde ser lido.",
        error
      );
    }
  }


  return map;
}


async function openAnkiDatabase(
  file
) {
  if (
    !window.JSZip
    || !window.initSqlJs
  ) {
    throw new Error(
      "Os leitores de pacote Anki não carregaram. Atualize a página e tente novamente."
    );
  }


  const zip =
    await window.JSZip
      .loadAsync(
        await file
          .arrayBuffer()
      );


  const candidates =
    [
      {
        name:
          "collection.anki21b",

        compressed:
          true,

        label:
          "Anki moderno"
      },

      {
        name:
          "collection.anki21",

        compressed:
          false,

        label:
          "Anki 2.1"
      },

      {
        name:
          "collection.anki2",

        compressed:
          false,

        label:
          "Anki legado"
      }
    ];


  const candidate =
    candidates.find(
      (item) =>
        zip.file(
          item.name
        )
    );


  if (!candidate) {
    throw new Error(
      "Não encontrei o banco da coleção dentro deste pacote Anki."
    );
  }


  let bytes =
    new Uint8Array(
      await zip
        .file(
          candidate.name
        )
        .async(
          "uint8array"
        )
    );


  if (
    candidate.compressed
  ) {
    if (
      !window.fzstd
      ?.decompress
    ) {
      throw new Error(
        "Este é um pacote Anki moderno e o descompactador Zstandard não carregou."
      );
    }


    bytes =
      window.fzstd
        .decompress(
          bytes
        );
  }


  const SQL =
    await window.initSqlJs({
      locateFile:
        (name) =>
          `https://cdn.jsdelivr.net/npm/sql.js@1.11.0/dist/${name}`
    });


  const database =
    new SQL.Database(
      bytes
    );


  return {
    database,
    format:
      candidate.label
  };
}


async function parseAnkiPackage(
  file
) {
  setFlashStatus(
    "import-status",
    "Abrindo pacote do Anki..."
  );


  const {
    database,
    format
  } =
    await openAnkiDatabase(
      file
    );


  try {
    const tables =
      sqliteTableNames(
        database
      );


    if (
      !tables.has(
        "notes"
      )
      || !tables.has(
        "cards"
      )
    ) {
      throw new Error(
        "A coleção Anki não possui as tabelas de notas e cards esperadas."
      );
    }


    const deckMap =
      readAnkiDeckMap(
        database
      );


    const notes =
      readSqlRows(
        database,
        `
          select
            n.id as note_id,
            n.flds as flds,
            min(c.did) as deck_id
          from notes n
          left join cards c
            on c.nid = n.id
          group by
            n.id,
            n.flds
          order by n.id
        `
      );


    const rows =
      [];

    let mediaReferences =
      0;


    for (
      const note
      of notes
    ) {
      const fields =
        String(
          note.flds
          ?? ""
        )
          .split(
            "\u001f"
          );


      const converted =
        fieldsToFlashcard(
          fields
        );


      if (!converted) {
        continue;
      }


      const deckId =
        String(
          note.deck_id
          ?? ""
        );


      const sourceDeck =
        deckMap.get(
          deckId
        )
        || "Anki";


      if (
        !ankiDeckAreaMap.has(
          sourceDeck
        )
      ) {
        ankiDeckAreaMap.set(
          sourceDeck,
          sourceDeckDefaultArea(
            sourceDeck
          )
        );
      }


      mediaReferences +=
        converted
          .mediaReferences;


      rows.push({
        area:
          ankiDeckAreaMap.get(
            sourceDeck
          )
          || "",

        materia:
          "",

        theme:
          "",

        front_text:
          converted.front,

        back_text:
          converted.back,

        source_deck:
          sourceDeck
      });
    }


    if (
      !rows.length
    ) {
      throw new Error(
        "Não encontrei flashcards com frente e verso utilizáveis neste pacote."
      );
    }


    ankiImportStats = {
      packageFormat:
        format,

      sourceDecks:
        Array.from(
          new Set(
            rows.map(
              (row) =>
                row.source_deck
            )
          )
        ),

      mediaReferences
    };


    return rows;

  } finally {
    database.close();
  }
}


function renderAnkiDeckMap() {
  const panel =
    document.getElementById(
      "anki-deck-map"
    );

  const list =
    document.getElementById(
      "anki-deck-map-list"
    );

  const format =
    document.getElementById(
      "anki-import-format"
    );

  const mediaNote =
    document.getElementById(
      "anki-media-note"
    );


  if (
    !panel
    || !list
  ) {
    return;
  }


  if (
    importFileKind
      !== "anki"
    || !ankiImportStats
        .sourceDecks
        .length
  ) {
    panel.hidden =
      true;

    list.innerHTML =
      "";

    return;
  }


  panel.hidden =
    false;


  if (format) {
    format.textContent =
      ankiImportStats
        .packageFormat
      || "Anki";
  }


  const counts =
    new Map();


  for (
    const row
    of importRows
  ) {
    const deck =
      row.source_deck
      || "Anki";

    counts.set(
      deck,
      (
        counts.get(
          deck
        )
        || 0
      )
      + 1
    );
  }


  list.innerHTML =
    ankiImportStats
      .sourceDecks
      .map(
        (
          deck,
          index
        ) => `
          <label class="anki-deck-row">

            <span class="anki-deck-source">
              <strong>
                ${escapeFlashHtml(
                  deck
                )}
              </strong>

              <small>
                Deck original do Anki
              </small>
            </span>

            <input
              type="text"
              value="${escapeFlashHtml(
                ankiDeckAreaMap.get(
                  deck
                )
                || sourceDeckDefaultArea(
                  deck
                )
              )}"
              data-anki-deck-area="${index}"
              list="medical-areas"
              data-resibulando-area-input
              placeholder="Área no Resibulando"
            >

            <span class="anki-deck-count">
              ${counts.get(deck) || 0} cards
            </span>

          </label>
        `
      )
      .join("");


  document
    .querySelectorAll(
      "[data-anki-deck-area]"
    )
    .forEach(
      (input) => {
        input.addEventListener(
          "input",
          () => {
            const index =
              Number(
                input.dataset
                  .ankiDeckArea
              );

            const deck =
              ankiImportStats
                .sourceDecks[
                  index
                ];


            if (!deck) {
              return;
            }


            const area =
              input.value
                .trim();


            ankiDeckAreaMap.set(
              deck,
              area
            );


            importRows =
              importRows.map(
                (row) =>
                  row.source_deck
                    === deck
                      ? {
                          ...row,
                          area
                        }
                      : row
              );


            renderImportPreview(
              false
            );
          }
        );
      }
    );


  if (mediaNote) {
    const media =
      Number(
        ankiImportStats
          .mediaReferences
        || 0
      );


    mediaNote.hidden =
      media === 0;


    mediaNote.textContent =
      media
        ? `${media} referência${media === 1 ? "" : "s"} a imagem/áudio detectada${media === 1 ? "" : "s"}. Nesta etapa o DocMap importa o texto dos cards; a mídia do Anki não é copiada.`
        : "";
  }
}


function renderImportPreview(
  rerenderMap = true
) {
  const valid =
    importRows.filter(
      (row) =>
        row.front_text
        && row.back_text
    );

  const invalidCount =
    importRows.length
    - valid.length;

  const summary =
    document.getElementById(
      "import-summary"
    );

  summary.hidden =
    false;


  const deckCount =
    importFileKind ===
      "anki"
        ? ankiImportStats
            .sourceDecks
            .length
        : 0;


  summary.textContent =
    `${valid.length} card${valid.length === 1 ? "" : "s"} válido${valid.length === 1 ? "" : "s"}`
    + (
      deckCount
        ? ` · ${deckCount} deck${deckCount === 1 ? "" : "s"} do Anki`
        : ""
    )
    + (
      invalidCount
        ? ` · ${invalidCount} linha${invalidCount === 1 ? "" : "s"} ignorada${invalidCount === 1 ? "" : "s"}`
        : ""
    );


  const previewWrap =
    document.getElementById(
      "import-preview-wrap"
    );

  const body =
    document.getElementById(
      "import-preview-body"
    );


  if (!valid.length) {
    previewWrap.hidden =
      true;

    body.innerHTML =
      "";

    document
      .getElementById(
        "import-cards"
      )
      .disabled =
        true;

    if (rerenderMap) {
      renderAnkiDeckMap();
    }

    return;
  }


  previewWrap.hidden =
    false;


  body.innerHTML =
    valid
      .slice(
        0,
        12
      )
      .map(
        (row) => `
          <tr>

            <td>
              ${escapeFlashHtml(
                row.source_deck
                || "Planilha"
              )}
            </td>

            <td>
              ${escapeFlashHtml(
                row.area
                || "—"
              )}
            </td>

            <td>
              ${escapeFlashHtml(
                row.materia
                || "—"
              )}
            </td>

            <td>
              ${escapeFlashHtml(
                row.theme
                || "—"
              )}
            </td>

            <td>
              ${escapeFlashHtml(
                truncateText(
                  row.front_text,
                  100
                )
              )}
            </td>

            <td>
              ${escapeFlashHtml(
                truncateText(
                  row.back_text,
                  100
                )
              )}
            </td>

          </tr>
        `
      )
      .join("");


  document
    .getElementById(
      "import-cards"
    )
    .disabled =
      false;


  if (rerenderMap) {
    renderAnkiDeckMap();
  }
}


async function parseSpreadsheetImport(
  file
) {
  const buffer =
    await file.arrayBuffer();

  const workbook =
    XLSX.read(
      buffer,
      {
        type:
          "array"
      }
    );


  const rows =
    [];


  for (
    const sheetName
    of workbook
      .SheetNames
  ) {
    const sheet =
      workbook
        .Sheets[
          sheetName
        ];


    const raw =
      XLSX.utils
        .sheet_to_json(
          sheet,
          {
            defval:
              ""
          }
        );


    for (
      const rawRow
      of raw
    ) {
      rows.push({
        ...normalizeImportedRow(
          rawRow
        ),

        source_deck:
          sheetName
      });
    }
  }


  importRows =
    rows;

  importFileKind =
    "spreadsheet";

  ankiDeckAreaMap =
    new Map();

  ankiImportStats = {
    packageFormat:
      null,

    sourceDecks:
      [],

    mediaReferences:
      0
  };


  renderImportPreview();
}


async function parseImportFile(
  file
) {
  if (
    isAnkiPackageFile(
      file
    )
  ) {
    importFileKind =
      "anki";

    ankiDeckAreaMap =
      new Map();

    ankiImportStats = {
      packageFormat:
        null,

      sourceDecks:
        [],

      mediaReferences:
        0
    };


    importRows =
      await parseAnkiPackage(
        file
      );


    renderImportPreview();

    return;
  }


  await parseSpreadsheetImport(
    file
  );
}


function resetImportUi() {
  importRows =
    [];

  importFileKind =
    "spreadsheet";

  ankiDeckAreaMap =
    new Map();

  ankiImportStats = {
    packageFormat:
      null,

    sourceDecks:
      [],

    mediaReferences:
      0
  };


  const summary =
    document.getElementById(
      "import-summary"
    );

  const preview =
    document.getElementById(
      "import-preview-wrap"
    );

  const map =
    document.getElementById(
      "anki-deck-map"
    );

  const mapList =
    document.getElementById(
      "anki-deck-map-list"
    );


  if (summary) {
    summary.hidden =
      true;

    summary.textContent =
      "";
  }


  if (preview) {
    preview.hidden =
      true;
  }


  if (map) {
    map.hidden =
      true;
  }


  if (mapList) {
    mapList.innerHTML =
      "";
  }


  document
    .getElementById(
      "import-cards"
    )
    .disabled =
      true;
}


function wireImport() {
  document
    .getElementById(
      "import-file"
    )
    .addEventListener(
      "change",
      async (event) => {
        const file =
          event.target
            .files[0];


        resetImportUi();


        setFlashStatus(
          "import-status",
          ""
        );


        if (!file) {
          return;
        }


        try {
          setFlashStatus(
            "import-status",
            isAnkiPackageFile(
              file
            )
              ? "Lendo pacote do Anki..."
              : "Lendo planilha..."
          );


          await parseImportFile(
            file
          );


          setFlashStatus(
            "import-status",
            `${importRows.length} flashcard${importRows.length === 1 ? "" : "s"} encontrado${importRows.length === 1 ? "" : "s"}. Confira a prévia antes de importar.`,
            "success"
          );

        } catch (error) {
          console.error(
            error
          );


          resetImportUi();


          setFlashStatus(
            "import-status",
            error.message
            || "Não foi possível ler esse arquivo.",
            "error"
          );
        }
      }
    );


  document
    .getElementById(
      "import-cards"
    )
    .addEventListener(
      "click",
      async () => {
        const valid =
          importRows.filter(
            (row) =>
              row.front_text
              && row.back_text
          );


        if (!valid.length) {
          setFlashStatus(
            "import-status",
            "Nenhum flashcard válido para importar.",
            "error"
          );

          return;
        }


        const emptyAreaDeck =
          importFileKind ===
            "anki"
            ? ankiImportStats
                .sourceDecks
                .find(
                  (deck) =>
                    !String(
                      ankiDeckAreaMap
                        .get(
                          deck
                        )
                      || ""
                    )
                      .trim()
                )
            : null;


        if (emptyAreaDeck) {
          setFlashStatus(
            "import-status",
            `Defina uma Área para o deck "${emptyAreaDeck}".`,
            "error"
          );

          return;
        }


        const button =
          document.getElementById(
            "import-cards"
          );


        button.disabled =
          true;


        setFlashStatus(
          "import-status",
          "Importando..."
        );


        const file =
          document
            .getElementById(
              "import-file"
            )
            .files[0];


        const {
          data:
            importEntry,

          error:
            importError
        } =
          await flashSb
            .from(
              "flashcard_imports"
            )
            .insert({
              user_id:
                flashUser.id,

              source_type:
                importFileKind ===
                  "anki"
                    ? "anki"
                    : "excel",

              file_name:
                file?.name
                || null,

              status:
                "processing"
            })
            .select(
              "id"
            )
            .single();


        if (importError) {
          console.error(
            importError
          );


          setFlashStatus(
            "import-status",
            `Não foi possível iniciar a importação: ${importError.message}`,
            "error"
          );


          button.disabled =
            false;

          return;
        }


        const payload =
          valid.map(
            (row) => ({
              area:
                importFileKind ===
                  "anki"
                    ? (
                        ankiDeckAreaMap
                          .get(
                            row.source_deck
                          )
                        || row.area
                        || null
                      )
                    : (
                        row.area
                        || null
                      ),

              materia:
                row.materia
                || null,

              theme:
                row.theme
                || null,

              front_text:
                row.front_text,

              back_text:
                row.back_text
            })
          );


        const {
          data:
            created,

          error
        } =
          await flashSb.rpc(
            "bulk_create_flashcards",
            {
              p_cards:
                payload,

              p_import_id:
                importEntry.id
            }
          );


        if (error) {
          console.error(
            error
          );


          setFlashStatus(
            "import-status",
            `Importação falhou: ${error.message}`,
            "error"
          );


          button.disabled =
            false;

          return;
        }


        setFlashStatus(
          "import-status",
          `${created} flashcard${created === 1 ? "" : "s"} importado${created === 1 ? "" : "s"} com sucesso.`,
          "success"
        );


        document
          .getElementById(
            "import-file"
          )
          .value =
            "";


        resetImportUi();


        await Promise.all([
          loadMetrics(),
          loadReviewQueue(),
          loadLibrary()
        ]);
      }
    );
}

function populateLibraryAreas() {
  const select =
    document.getElementById(
      "library-area"
    );

  if (!select) {
    return;
  }

  const current =
    select.value;

  const mode =
    window.resibulandoStudyMode
    || "medicine";

  const areas =
    window.ResibulandoStudyMode
      ?.areasFor(
        mode
      )
    || [];

  select.innerHTML =
    `<option value="">Todas as áreas</option>`
    + areas
        .map(
          (area) => `
            <option value="${escapeFlashHtml(area)}">
              ${escapeFlashHtml(area)}
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

function filteredLibraryCards() {
  const search =
    document
      .getElementById(
        "library-search"
      )
      .value
      .trim()
      .toLowerCase();

  const area =
    document
      .getElementById(
        "library-area"
      )
      .value;

  const activeFilter =
    document
      .getElementById(
        "library-active"
      )
      ?.value
    || "active";

  return libraryCards.filter(
    (card) => {
      if (
        area
        && card.area
          !== area
      ) {
        return false;
      }

      if (
        activeFilter
          === "active"
        && !card.active
      ) {
        return false;
      }

      if (
        activeFilter
          === "archived"
        && card.active
      ) {
        return false;
      }

      if (!search) {
        return true;
      }

      const haystack =
        [
          card.area,
          card.materia,
          card.theme,
          card.front_text,
          card.back_text
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

      return haystack.includes(
        search
      );
    }
  );
}


function closeFlashcardMenus(
  exceptId = null
) {
  document
    .querySelectorAll(
      "[data-flash-menu]"
    )
    .forEach(
      (menu) => {
        const id =
          menu.dataset
            .flashMenu;

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
      "[data-flash-menu-trigger]"
    )
    .forEach(
      (button) => {
        const id =
          button.dataset
            .flashMenuTrigger;

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


function setLibraryStatus(
  text,
  type = ""
) {
  setFlashStatus(
    "library-status",
    text,
    type
  );
}


function openFlashEditDialog(
  cardId
) {
  const card =
    libraryCards.find(
      (item) =>
        item.id === cardId
    )
    || reviewQueue.find(
      (item) =>
        item.id === cardId
    );


  if (!card) {
    return;
  }


  editingFlashcardId =
    card.id;


  document
    .getElementById(
      "flash-edit-area"
    )
    .value =
      card.area
      || "";


  document
    .getElementById(
      "flash-edit-materia"
    )
    .value =
      card.materia
      || "";


  document
    .getElementById(
      "flash-edit-theme"
    )
    .value =
      card.theme
      || "";


  document
    .getElementById(
      "flash-edit-front"
    )
    .value =
      card.front_text
      || "";


  document
    .getElementById(
      "flash-edit-back"
    )
    .value =
      card.back_text
      || "";


  setFlashStatus(
    "flash-edit-status",
    ""
  );


  const dialog =
    document.getElementById(
      "flash-edit-dialog"
    );


  if (
    typeof dialog.showModal
      === "function"
  ) {
    dialog.showModal();

  } else {
    dialog.setAttribute(
      "open",
      ""
    );
  }
}


function closeFlashEditDialog() {
  const dialog =
    document.getElementById(
      "flash-edit-dialog"
    );


  editingFlashcardId =
    null;


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


async function saveEditedFlashcard() {
  if (!editingFlashcardId) {
    return;
  }


  const front =
    document
      .getElementById(
        "flash-edit-front"
      )
      .value
      .trim();


  const back =
    document
      .getElementById(
        "flash-edit-back"
      )
      .value
      .trim();


  if (
    !front
    || !back
  ) {
    setFlashStatus(
      "flash-edit-status",
      "Frente e verso são obrigatórios.",
      "error"
    );

    return;
  }


  const button =
    document.getElementById(
      "flash-edit-save"
    );


  button.disabled =
    true;


  setFlashStatus(
    "flash-edit-status",
    "Salvando..."
  );


  const {
    error
  } =
    await flashSb
      .from(
        "flashcards"
      )
      .update({
        area:
          document
            .getElementById(
              "flash-edit-area"
            )
            .value
            .trim()
          || null,

        materia:
          document
            .getElementById(
              "flash-edit-materia"
            )
            .value
            .trim()
          || null,

        theme:
          document
            .getElementById(
              "flash-edit-theme"
            )
            .value
            .trim()
          || null,

        front_text:
          front,

        back_text:
          back
      })
      .eq(
        "id",
        editingFlashcardId
      );


  button.disabled =
    false;


  if (error) {
    console.error(
      error
    );

    setFlashStatus(
      "flash-edit-status",
      `Não foi possível salvar: ${error.message}`,
      "error"
    );

    return;
  }


  closeFlashEditDialog();


  setLibraryStatus(
    "Flashcard atualizado.",
    "success"
  );


  await Promise.all([
    loadLibrary(),
    loadMetrics(),
    loadReviewQueue()
  ]);
}


async function toggleFlashcardActive(
  cardId,
  nextActive
) {
  const {
    error
  } =
    await flashSb
      .from(
        "flashcards"
      )
      .update({
        active:
          nextActive
      })
      .eq(
        "id",
        cardId
      );


  if (error) {
    console.error(
      error
    );

    setLibraryStatus(
      `Não foi possível atualizar: ${error.message}`,
      "error"
    );

    return;
  }


  setLibraryStatus(
    nextActive
      ? "Flashcard restaurado."
      : "Flashcard arquivado.",
    "success"
  );


  await Promise.all([
    loadLibrary(),
    loadMetrics(),
    loadReviewQueue()
  ]);
}


async function deleteFlashcardFromLibrary(
  cardId
) {
  const card =
    libraryCards.find(
      (item) =>
        item.id === cardId
    )
    || reviewQueue.find(
      (item) =>
        item.id === cardId
    );


  if (!card) {
    return;
  }


  const confirmed =
    window.confirm(
      "Excluir este flashcard permanentemente? Esta ação não pode ser desfeita."
    );


  if (!confirmed) {
    return;
  }


  setLibraryStatus(
    "Excluindo flashcard..."
  );


  const {
    error
  } =
    await flashSb
      .from(
        "flashcards"
      )
      .delete()
      .eq(
        "id",
        cardId
      );


  if (error) {
    console.error(
      error
    );

    setLibraryStatus(
      `Não foi possível excluir: ${error.message}`,
      "error"
    );

    return;
  }


  const storagePaths =
    [
      card.front_image_path,
      card.back_image_path
    ]
      .filter(
        Boolean
      );


  if (
    storagePaths.length
  ) {
    const {
      error:
        storageError
    } =
      await flashSb
        .storage
        .from(
          "docmap"
        )
        .remove(
          storagePaths
        );


    if (storageError) {
      console.warn(
        "Flashcard excluído, mas a mídia antiga não pôde ser removida:",
        storageError.message
      );
    }
  }


  selectedFlashcardIds.delete(
    cardId
  );

  reviewQueue =
    reviewQueue.filter(
      (item) =>
        item.id !== cardId
    );

  if (
    reviewIndex
    >= reviewQueue.length
  ) {
    reviewIndex =
      Math.max(
        0,
        reviewQueue.length - 1
      );
  }


  setLibraryStatus(
    "Flashcard excluído.",
    "success"
  );


  await Promise.all([
    loadLibrary(),
    loadMetrics(),
    loadReviewQueue()
  ]);
}



function updateFlashBulkToolbar() {
  const visibleIds =
    filteredLibraryCards()
      .map(
        (card) =>
          card.id
      );


  const selectedVisible =
    visibleIds.filter(
      (id) =>
        selectedFlashcardIds.has(
          id
        )
    ).length;


  const count =
    document.getElementById(
      "flash-library-selected"
    );


  const button =
    document.getElementById(
      "flash-library-delete-selected"
    );

  const exportButton =
    document.getElementById(
      "flash-library-export-selected"
    );


  const selectAll =
    document.getElementById(
      "flash-library-select-all"
    );


  if (count) {
    count.textContent =
      `${selectedFlashcardIds.size} selecionado${selectedFlashcardIds.size === 1 ? "" : "s"}`;
  }


  if (button) {
    button.disabled =
      selectedFlashcardIds.size === 0;
  }

  if (exportButton) {
    exportButton.disabled =
      selectedFlashcardIds.size === 0;
  }


  if (selectAll) {
    selectAll.checked =
      visibleIds.length > 0
      && selectedVisible === visibleIds.length;

    selectAll.indeterminate =
      selectedVisible > 0
      && selectedVisible < visibleIds.length;
  }
}


async function flashPdfImageData(path) {
  if (!path) return null;

  try {
    const { data: blob, error } = await flashSb
      .storage
      .from("docmap")
      .download(path);

    if (error) throw error;

    const bitmap = await createImageBitmap(blob);
    const maxWidth = 1000;
    const scale = Math.min(1, maxWidth / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.78),
      width: canvas.width,
      height: canvas.height
    };
  } catch (error) {
    console.warn("Imagem não incluída no PDF dos Flashcards:", error);
    return null;
  }
}


function flashPdfAddImage(doc, imageData, state) {
  if (!imageData) return state;

  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = Math.min(95, pageWidth - margin * 2);
  const maxHeight = 70;

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


function flashPdfAddBlock(doc, label, value, state) {
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


async function exportSelectedFlashcardsPdf() {
  const ids = Array.from(selectedFlashcardIds);
  if (!ids.length) return;

  if (!window.jspdf?.jsPDF) {
    setLibraryStatus("Gerador de PDF não carregou. Atualize a página.", "error");
    return;
  }

  const cards = libraryCards.filter((card) => selectedFlashcardIds.has(card.id));
  if (!cards.length) return;

  const button = document.getElementById("flash-library-export-selected");
  if (button) button.disabled = true;
  setLibraryStatus("Gerando PDF...");

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 14;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Resibulando — Flashcards", margin, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `${cards.length} flashcard${cards.length === 1 ? "" : "s"} selecionado${cards.length === 1 ? "" : "s"}`,
      margin,
      23
    );

    let state = { y: 32 };

    for (let index = 0; index < cards.length; index += 1) {
      const card = cards[index];

      if (state.y > 250) {
        doc.addPage();
        state.y = 16;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(
        `${index + 1}. ${card.area || "Sem área"}${card.materia ? ` · ${card.materia}` : ""}`,
        margin,
        state.y
      );
      state.y += 7;

      state = flashPdfAddBlock(doc, "Tema", card.theme, state);
      state = flashPdfAddBlock(doc, "Frente", card.front_text, state);

      if (card.front_image_path) {
        setLibraryStatus(`Preparando mídia ${index + 1} de ${cards.length}...`);
        const frontImage = await flashPdfImageData(card.front_image_path);
        state = flashPdfAddImage(doc, frontImage, state);
      }

      state = flashPdfAddBlock(doc, "Verso", card.back_text, state);

      if (card.back_image_path) {
        const backImage = await flashPdfImageData(card.back_image_path);
        state = flashPdfAddImage(doc, backImage, state);
      }

      state.y += 4;
      doc.setDrawColor(220);
      doc.line(margin, state.y, doc.internal.pageSize.getWidth() - margin, state.y);
      state.y += 8;
    }

    doc.save(`resibulando-flashcards-${todayISO()}.pdf`);
    setLibraryStatus("PDF exportado.", "success");
  } catch (error) {
    console.error(error);
    setLibraryStatus(`Não foi possível gerar o PDF: ${error.message}`, "error");
  } finally {
    if (button) button.disabled = false;
  }
}

async function deleteSelectedFlashcards() {
  const ids =
    Array.from(
      selectedFlashcardIds
    );


  if (!ids.length) {
    return;
  }


  const confirmed =
    window.confirm(
      `Excluir ${ids.length} flashcard${ids.length === 1 ? "" : "s"} permanentemente?`
    );


  if (!confirmed) {
    return;
  }


  const cards =
    libraryCards.filter(
      (card) =>
        selectedFlashcardIds.has(
          card.id
        )
    );


  setLibraryStatus(
    "Excluindo selecionados..."
  );


  const {
    error
  } =
    await flashSb
      .from(
        "flashcards"
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


    setLibraryStatus(
      `Não foi possível excluir: ${error.message}`,
      "error"
    );

    return;
  }


  const paths =
    cards
      .flatMap(
        (card) => [
          card.front_image_path,
          card.back_image_path
        ]
      )
      .filter(
        Boolean
      );


  if (paths.length) {
    const {
      error:
        storageError
    } =
      await flashSb
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


  reviewQueue =
    reviewQueue.filter(
      (card) =>
        !selectedFlashcardIds.has(
          card.id
        )
    );


  selectedFlashcardIds.clear();


  setLibraryStatus(
    `${ids.length} flashcard${ids.length === 1 ? "" : "s"} excluído${ids.length === 1 ? "" : "s"}.`,
    "success"
  );


  await Promise.all([
    loadLibrary(),
    loadMetrics(),
    loadReviewQueue()
  ]);
}


function renderLibrary() {
  const cards =
    filteredLibraryCards();

  const list =
    document.getElementById(
      "library-list"
    );

  const empty =
    document.getElementById(
      "library-empty"
    );


  document
    .getElementById(
      "library-count"
    )
    .textContent =
      `${cards.length} card${cards.length === 1 ? "" : "s"}`;


  if (!cards.length) {
    list.innerHTML =
      "";

    empty.hidden =
      false;

    updateFlashBulkToolbar();

    return;
  }


  empty.hidden =
    true;


  list.innerHTML =
    cards
      .map(
        (card) => `
          <article
            class="library-card"
            data-library-card="${escapeFlashHtml(card.id)}"
          >

            <label
              class="library-select-wrap"
              aria-label="Selecionar flashcard"
            >
              <input
                class="library-select-check"
                type="checkbox"
                data-flash-select="${escapeFlashHtml(card.id)}"
                ${selectedFlashcardIds.has(card.id) ? "checked" : ""}
              >
            </label>

            <div class="library-card-menu-wrap">

              <button
                class="card-menu-trigger"
                type="button"
                data-flash-menu-trigger="${escapeFlashHtml(card.id)}"
                aria-label="Opções do flashcard"
                aria-expanded="false"
              >
                ⋯
              </button>

              <div
                class="card-menu-popover"
                data-flash-menu="${escapeFlashHtml(card.id)}"
                hidden
              >

                <button
                  type="button"
                  data-flash-edit="${escapeFlashHtml(card.id)}"
                >
                  Editar
                </button>

                <button
                  class="danger"
                  type="button"
                  data-flash-delete="${escapeFlashHtml(card.id)}"
                >
                  Excluir
                </button>

              </div>

            </div>


            <div class="library-card-main">

              <div class="library-card-taxonomy">

                ${
                  card.area
                    ? `<span class="taxonomy-chip">${escapeFlashHtml(card.area)}</span>`
                    : ""
                }

                ${
                  card.materia
                    ? `<span class="taxonomy-chip">${escapeFlashHtml(card.materia)}</span>`
                    : ""
                }

                ${
                  card.theme
                    ? `<span class="taxonomy-chip accent">${escapeFlashHtml(card.theme)}</span>`
                    : ""
                }

              </div>

              <div class="library-card-front">
                ${escapeFlashHtml(truncateText(card.front_text, 220))}
              </div>

              <div class="library-card-back">
                ${escapeFlashHtml(truncateText(card.back_text, 220))}
              </div>

              <div class="library-card-meta">

                <span>
                  Próxima: ${formatDueDate(card.due_date)}
                </span>

                <span>
                  ${card.review_count || 0} revisão${Number(card.review_count || 0) === 1 ? "" : "ões"}
                </span>

                <span>
                  ${card.active ? "Ativo" : "Arquivado"}
                </span>

              </div>

            </div>

          </article>
        `
      )
      .join("");


  list
    .querySelectorAll(
      "[data-flash-select]"
    )
    .forEach(
      (input) => {
        input.addEventListener(
          "change",
          () => {
            const id =
              input.dataset
                .flashSelect;


            if (input.checked) {
              selectedFlashcardIds.add(
                id
              );

            } else {
              selectedFlashcardIds.delete(
                id
              );
            }


            updateFlashBulkToolbar();
          }
        );
      }
    );


  updateFlashBulkToolbar();


  list
    .querySelectorAll(
      "[data-flash-menu-trigger]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          (event) => {
            event.stopPropagation();


            const id =
              button.dataset
                .flashMenuTrigger;


            const menu =
              list.querySelector(
                `[data-flash-menu="${CSS.escape(id)}"]`
              );


            if (!menu) {
              return;
            }


            const willOpen =
              menu.hidden;


            closeFlashcardMenus();


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


  list
    .querySelectorAll(
      "[data-flash-menu]"
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


  list
    .querySelectorAll(
      "[data-flash-edit]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            closeFlashcardMenus();


            openFlashEditDialog(
              button.dataset
                .flashEdit
            );
          }
        );
      }
    );


  list
    .querySelectorAll(
      "[data-flash-delete]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          async () => {
            closeFlashcardMenus();


            await deleteFlashcardFromLibrary(
              button.dataset
                .flashDelete
            );
          }
        );
      }
    );
}

async function loadLibrary() {
  const {
    data,
    error
  } = await flashSb
    .from("flashcards")
    .select(`
      id,
      area,
      materia,
      theme,
      front_text,
      back_text,
      front_image_path,
      back_image_path,
      due_date,
      review_count,
      active,
      created_at
    `)
    .order(
      "created_at",
      {
        ascending: false
      }
    )
    .limit(500);

  if (error) {
    console.error(error);
    return;
  }

  libraryCards =
    data || [];

  populateLibraryAreas();
  renderLibrary();
}



function currentReviewCard() {
  return reviewQueue[
    reviewIndex
  ]
  || null;
}


function closeReviewCardMenu() {
  const menu =
    document.getElementById(
      "review-card-menu"
    );

  const trigger =
    document.getElementById(
      "review-card-menu-trigger"
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


function wireReviewCardMenu() {
  const trigger =
    document.getElementById(
      "review-card-menu-trigger"
    );

  const menu =
    document.getElementById(
      "review-card-menu"
    );


  trigger?.addEventListener(
    "click",
    (event) => {
      event.stopPropagation();


      if (!menu) {
        return;
      }


      const open =
        menu.hidden;


      closeReviewCardMenu();


      menu.hidden =
        !open;


      trigger.setAttribute(
        "aria-expanded",
        open
          ? "true"
          : "false"
      );
    }
  );


  menu?.addEventListener(
    "click",
    (event) =>
      event.stopPropagation()
  );


  document
    .getElementById(
      "review-card-edit"
    )
    ?.addEventListener(
      "click",
      () => {
        const card =
          currentReviewCard();


        closeReviewCardMenu();


        if (card) {
          openFlashEditDialog(
            card.id
          );
        }
      }
    );


  document
    .getElementById(
      "review-card-delete"
    )
    ?.addEventListener(
      "click",
      async () => {
        const card =
          currentReviewCard();


        closeReviewCardMenu();


        if (card) {
          await deleteFlashcardFromLibrary(
            card.id
          );

          await renderCurrentReview();
        }
      }
    );
}



function wireLibrary() {
  document
    .getElementById(
      "library-search"
    )
    ?.addEventListener(
      "input",
      renderLibrary
    );


  document
    .getElementById(
      "library-area"
    )
    ?.addEventListener(
      "change",
      renderLibrary
    );


  document
    .getElementById(
      "flash-library-select-all"
    )
    ?.addEventListener(
      "change",
      (event) => {
        const ids =
          filteredLibraryCards()
            .map(
              (card) =>
                card.id
            );


        for (
          const id
          of ids
        ) {
          if (
            event.target.checked
          ) {
            selectedFlashcardIds.add(
              id
            );

          } else {
            selectedFlashcardIds.delete(
              id
            );
          }
        }


        renderLibrary();
      }
    );


  document
    .getElementById(
      "flash-library-export-selected"
    )
    ?.addEventListener(
      "click",
      exportSelectedFlashcardsPdf
    );

  document
    .getElementById(
      "flash-library-delete-selected"
    )
    ?.addEventListener(
      "click",
      deleteSelectedFlashcards
    );


  document
    .getElementById(
      "flash-edit-save"
    )
    ?.addEventListener(
      "click",
      saveEditedFlashcard
    );


  [
    "flash-edit-close",
    "flash-edit-cancel"
  ].forEach(
    (id) => {
      document
        .getElementById(
          id
        )
        ?.addEventListener(
          "click",
          closeFlashEditDialog
        );
    }
  );


  wireReviewCardMenu();


  document.addEventListener(
    "click",
    () => {
      closeFlashcardMenus();
      closeReviewCardMenu();
    }
  );


  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key ===
        "Escape"
      ) {
        closeFlashcardMenus();
        closeReviewCardMenu();
      }
    }
  );
}

window.addEventListener(
  "resibulando:study-mode",
  () => {
    populateLibraryAreas();

    if (
      importFileKind
      === "anki"
    ) {
      renderAnkiDeckMap();
    }
  }
);


async function initFlashcards() {
  flashUser =
    window.docmapUser;

  wireTabs();
  wireReview();
  wireCreate();
  wireImport();
  wireLibrary();

  await loadFlashSettings();

  await Promise.all([
    loadMetrics(),
    loadReviewQueue()
  ]);
}

if (window.docmapUser) {
  initFlashcards();

} else {
  window.addEventListener(
    "docmap:ready",
    initFlashcards,
    {
      once: true
    }
  );
}
