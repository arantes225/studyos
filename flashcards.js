const flashSb = window.supabaseClient;

let flashUser = null;

let reviewQueue = [];
let reviewIndex = 0;

let importRows = [];

let libraryCards = [];

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

  image.hidden = true;
  image.removeAttribute("src");

  if (!path) return;

  const url =
    await signedFlashImage(
      path
    );

  if (!url) return;

  image.src = url;
  image.hidden = false;
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

function renderImportPreview() {
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

  summary.hidden = false;

  summary.textContent =
    `${valid.length} card${valid.length === 1 ? "" : "s"} válido${valid.length === 1 ? "" : "s"}`
    + (
      invalidCount
        ? ` · ${invalidCount} linha${invalidCount === 1 ? "" : "s"} ignorada${invalidCount === 1 ? "" : "s"} por falta de frente/verso`
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
    previewWrap.hidden = true;
    body.innerHTML = "";

    document
      .getElementById(
        "import-cards"
      )
      .disabled = true;

    return;
  }

  previewWrap.hidden = false;

  body.innerHTML =
    valid
      .slice(0, 8)
      .map((row) => `
        <tr>
          <td>${escapeFlashHtml(row.area || "—")}</td>
          <td>${escapeFlashHtml(row.materia || "—")}</td>
          <td>${escapeFlashHtml(row.theme || "—")}</td>
          <td>${escapeFlashHtml(truncateText(row.front_text, 100))}</td>
          <td>${escapeFlashHtml(truncateText(row.back_text, 100))}</td>
        </tr>
      `)
      .join("");

  document
    .getElementById(
      "import-cards"
    )
    .disabled = false;
}

async function parseImportFile(file) {
  const buffer =
    await file.arrayBuffer();

  const workbook =
    XLSX.read(
      buffer,
      {
        type: "array"
      }
    );

  const sheet =
    workbook.Sheets[
      workbook.SheetNames[0]
    ];

  const raw =
    XLSX.utils.sheet_to_json(
      sheet,
      {
        defval: ""
      }
    );

  importRows =
    raw.map(
      normalizeImportedRow
    );

  renderImportPreview();
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
          event.target.files[0];

        importRows = [];

        document
          .getElementById(
            "import-cards"
          )
          .disabled = true;

        document
          .getElementById(
            "import-summary"
          )
          .hidden = true;

        document
          .getElementById(
            "import-preview-wrap"
          )
          .hidden = true;

        setFlashStatus(
          "import-status",
          ""
        );

        if (!file) return;

        try {
          await parseImportFile(
            file
          );

        } catch (error) {
          console.error(error);

          setFlashStatus(
            "import-status",
            "Não foi possível ler esse arquivo.",
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

        const button =
          document.getElementById(
            "import-cards"
          );

        button.disabled = true;

        setFlashStatus(
          "import-status",
          "Importando..."
        );

        const file =
          document.getElementById(
            "import-file"
          ).files[0];

        const {
          data: importEntry,
          error: importError
        } = await flashSb
          .from("flashcard_imports")
          .insert({
            user_id:
              flashUser.id,

            source_type:
              "excel",

            file_name:
              file?.name
              || null,

            status:
              "processing"
          })
          .select("id")
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

          button.disabled = false;
          return;
        }

        const {
          data: created,
          error
        } = await flashSb.rpc(
          "bulk_create_flashcards",
          {
            p_cards:
              valid,

            p_import_id:
              importEntry.id
          }
        );

        if (error) {
          console.error(error);

          setFlashStatus(
            "import-status",
            `Importação falhou: ${error.message}`,
            "error"
          );

          button.disabled = false;
          return;
        }

        setFlashStatus(
          "import-status",
          `${created} flashcard${created === 1 ? "" : "s"} importado${created === 1 ? "" : "s"}.`,
          "success"
        );

        document
          .getElementById(
            "import-file"
          )
          .value = "";

        importRows = [];

        document
          .getElementById(
            "import-summary"
          )
          .hidden = true;

        document
          .getElementById(
            "import-preview-wrap"
          )
          .hidden = true;

        await Promise.all([
          loadMetrics(),
          loadReviewQueue()
        ]);
      }
    );
}

function populateLibraryAreas() {
  const select =
    document.getElementById(
      "library-area"
    );

  const current =
    select.value;

  const areas =
    Array.from(
      new Set(
        libraryCards
          .map(
            (card) =>
              card.area
          )
          .filter(Boolean)
      )
    ).sort(
      (a, b) =>
        a.localeCompare(
          b,
          "pt-BR"
        )
    );

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
    areas.includes(
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
      .value;

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
    list.innerHTML = "";
    empty.hidden = false;
    return;
  }

  empty.hidden = true;

  list.innerHTML =
    cards
      .map(
        (card) => `
          <article
            class="library-card"
            data-library-card="${card.id}"
          >

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

            <div class="library-card-actions">

              <button
                type="button"
                data-toggle-card="${card.id}"
                data-next-active="${card.active ? "false" : "true"}"
              >
                ${card.active ? "Arquivar" : "Restaurar"}
              </button>

            </div>

          </article>
        `
      )
      .join("");

  document
    .querySelectorAll(
      "[data-toggle-card]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          button.disabled = true;

          const nextActive =
            button.dataset.nextActive
              === "true";

          const {
            error
          } = await flashSb
            .from("flashcards")
            .update({
              active:
                nextActive
            })
            .eq(
              "id",
              button.dataset.toggleCard
            );

          if (error) {
            console.error(error);
            button.disabled = false;
            return;
          }

          await Promise.all([
            loadLibrary(),
            loadMetrics(),
            loadReviewQueue()
          ]);
        }
      );
    });
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

function wireLibrary() {
  [
    "library-search",
    "library-area",
    "library-active"
  ].forEach((id) => {
    const element =
      document.getElementById(id);

    element.addEventListener(
      id === "library-search"
        ? "input"
        : "change",
      renderLibrary
    );
  });
}

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
