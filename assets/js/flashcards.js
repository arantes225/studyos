const flashSb = window.supabaseClient;

let flashUser = null;

let reviewQueue = [];
let reviewIndex = 0;
let reviewMode = "scheduled";
let reviewModeLabel = "";

let importRows = [];

let importFileKind =
  "spreadsheet";

let ankiDeckAreaMap =
  new Map();

let ankiDeckSubjectMap =
  new Map();

let ankiDeckThemeMap =
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


const flashParams =
  new URLSearchParams(
    window.location.search
  );


const flashAgendaDate =
  flashParams.get(
    "agenda_date"
  );


const flashAgendaArea =
  flashParams.get(
    "agenda_area"
  );


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
    sharedDueResult,
    sharedOverdueResult,
    reviewResult,
    retentionResult
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
        "user_id",
        flashUser.id
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
        "user_id",
        flashUser.id
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
      .from("flashcard_shared_state")
      .select(
        "flashcard_id",
        {
          count: "exact",
          head: true
        }
      )
      .eq(
        "user_id",
        flashUser.id
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
      .from("flashcard_shared_state")
      .select(
        "flashcard_id",
        {
          count: "exact",
          head: true
        }
      )
      .eq(
        "user_id",
        flashUser.id
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
        "id,rating,was_correct,reviewed_at"
      )
      .gte(
        "reviewed_at",
        startOfTodayISO()
      )
      .lt(
        "reviewed_at",
        startOfTomorrowISO()
      ),

    flashSb
      .from(
        "flashcard_retention_overall"
      )
      .select(
        "reviewed_cards,retention_percent"
      )
      .maybeSingle()
  ]);

  if (dueResult.error) {
    console.warn(
      dueResult.error
    );
  }

  if (overdueResult.error) {
    console.warn(
      overdueResult.error
    );
  }

  if (reviewResult.error) {
    console.warn(
      reviewResult.error
    );
  }

  const due =
    Number(
      dueResult.count
      || 0
    )
    +
    Number(
      sharedDueResult.count
      || 0
    );

  const overdue =
    Number(
      overdueResult.count
      || 0
    )
    +
    Number(
      sharedOverdueResult.count
      || 0
    );

  const reviews =
    reviewResult.data
    || [];

  const correct =
    reviews.filter(
      (row) =>
        row.was_correct
        === true
    ).length;

  const accuracy =
    reviews.length
      ? (
          100
          * correct
          / reviews.length
        )
      : null;

  document
    .getElementById(
      "metric-due"
    )
    .textContent =
      due;

  document
    .getElementById(
      "metric-overdue"
    )
    .textContent =
      overdue;

  document
    .getElementById(
      "metric-reviewed"
    )
    .textContent =
      reviews.length;

  document
    .getElementById(
      "metric-accuracy"
    )
    .textContent =
      accuracy === null
        ? "—"
        : `${Math.round(
            accuracy
          )}%`;

  const dueBase =
    Math.max(
      1,
      due
    );

  const dueBar =
    document.getElementById(
      "flash-due-bar"
    );

  const overdueBar =
    document.getElementById(
      "flash-overdue-bar"
    );

  const reviewedFill =
    document.getElementById(
      "flash-reviewed-fill"
    );

  if (dueBar) {
    dueBar.style.width =
      due
        ? "100%"
        : "0%";
  }

  if (overdueBar) {
    overdueBar.style.width =
      `${Math.min(
        100,
        100
        * overdue
        / dueBase
      )}%`;
  }

  if (reviewedFill) {
    reviewedFill.style.width =
      `${Math.min(
        100,
        reviews.length
        * 5
      )}%`;
  }

  const accuracyRing =
    document.getElementById(
      "flash-accuracy-ring"
    );

  if (accuracyRing) {
    accuracyRing.style
      .setProperty(
        "--accuracy",
        accuracy === null
          ? 0
          : Math.max(
              0,
              Math.min(
                100,
                accuracy
              )
            )
      );
  }

  const retentionValue =
    document.getElementById(
      "metric-retention"
    );

  const retentionHelper =
    document.getElementById(
      "metric-retention-helper"
    );

  const retentionRing =
    document.getElementById(
      "flash-retention-ring"
    );

  if (
    retentionResult.error
    || !retentionResult.data
    || retentionResult.data
      .retention_percent
      === null
  ) {
    if (retentionResult.error) {
      console.warn(
        "Retenção dos flashcards indisponível:",
        retentionResult.error.message
      );
    }

    if (retentionValue) {
      retentionValue.textContent =
        "—";
    }

    if (retentionHelper) {
      retentionHelper.textContent =
        "Revise flashcards para estimar a retenção do conteúdo.";
    }

    if (retentionRing) {
      retentionRing.style
        .setProperty(
          "--retention",
          0
        );
    }

    return;
  }

  const retention =
    Number(
      retentionResult.data
        .retention_percent
    );

  const reviewedCards =
    Number(
      retentionResult.data
        .reviewed_cards
      || 0
    );

  if (retentionValue) {
    retentionValue.textContent =
      `${retention
        .toFixed(1)
        .replace(
          ".",
          ","
        )}%`;
  }

  if (retentionHelper) {
    retentionHelper.textContent =
      `${reviewedCards} flashcard${reviewedCards === 1 ? "" : "s"} com histórico de revisão.`;
  }

  if (retentionRing) {
    retentionRing.style
      .setProperty(
        "--retention",
        Math.max(
          0,
          Math.min(
            100,
            retention
          )
        )
      );
  }
}

async function signedFlashImage(path) {
  if (!path) {
    return null;
  }

  const {
    data,
    error
  } = await window.LuriaStorage.createSignedUrl("flashcard_images",
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

  const reviewEdit =
    document.getElementById(
      "review-card-edit"
    );

  const reviewDelete =
    document.getElementById(
      "review-card-delete"
    );

  if (reviewEdit) {
    reviewEdit.hidden =
      Boolean(
        card.shared
      );
  }

  if (reviewDelete) {
    reviewDelete.textContent =
      card.shared
        ? "Remover da biblioteca"
        : "Excluir";
  }

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
  reviewMode = "scheduled";
  reviewModeLabel = "";

  let query =
    flashSb
      .from(
        "flashcards"
      )
      .select(`
        id,
        user_id,
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
      .eq("user_id", flashUser.id)
      .eq(
        "active",
        true
      );


  /*
    Pela Agenda:
    carrega exatamente os cards remarcados para aquela
    data e área. Assim uma revisão movida para amanhã
    não depende de "due_date <= hoje".

    Página normal:
    continua mostrando todos os cards vencidos até hoje.
  */
  if (
    flashAgendaDate
  ) {
    query =
      query.eq(
        "due_date",
        flashAgendaDate
      );


    if (
      flashAgendaArea
    ) {
      query =
        query.eq(
          "area",
          flashAgendaArea
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
        todayISO()
      );
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
    console.error(error);

    setFlashStatus(
      "review-status",
      `Não foi possível carregar os cards: ${error.message}`,
      "error"
    );

    return;
  }


  const sharedDueCards =
    (await loadSharedFlashcards())
      .filter(card => {
        if (!card.active) {
          return false;
        }

        if (flashAgendaDate) {
          if (card.due_date !== flashAgendaDate) {
            return false;
          }

          return flashAgendaArea
            ? card.area === flashAgendaArea
            : !card.area;
        }

        return card.due_date <= todayISO();
      });

  reviewQueue = [
    ...(data || []).map(card => ({
      ...card,
      shared: false,
      owner_user_id: card.user_id
    })),
    ...sharedDueCards
  ]
    .sort(
      (a,b) =>
        String(a.due_date || "").localeCompare(String(b.due_date || ""))
    );


  reviewIndex =
    0;


  const sessionCopy =
    document.getElementById(
      "review-session-copy"
    );


  if (
    flashAgendaDate
    && sessionCopy
  ) {
    sessionCopy.textContent =
      flashAgendaArea
        ? `Agendados para ${flashAgendaDate} · ${flashAgendaArea}`
        : `Agendados para ${flashAgendaDate}`;
  }


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

          const rpcName =
            reviewMode === "extra"
              ? "review_flashcard_extra"
              : card.shared
                ? "review_shared_flashcard"
                : "review_flashcard";

          const {
            error
          } = await flashSb.rpc(
            rpcName,
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

  const { error, reference } = await window.LuriaStorage.upload("flashcard_images",
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

  return reference || path;
}


const FLASHCARD_SUBJECTS_BY_AREA = {
  "Clínica Médica": [
    "Cardiologia",
    "Pneumologia",
    "Gastroenterologia",
    "Hepatologia",
    "Nefrologia",
    "Endocrinologia e Metabologia",
    "Hematologia e Hemoterapia",
    "Reumatologia",
    "Infectologia",
    "Neurologia",
    "Dermatologia",
    "Geriatria",
    "Psiquiatria",
    "Oncologia Clínica",
    "Alergia e Imunologia",
    "Medicina Intensiva",
    "Urgência e Emergência",
    "Toxicologia",
    "Distúrbios hidroeletrolíticos e ácido-base",
    "Nutrologia",
    "Cuidados Paliativos",
    "Doenças Raras e Genética Clínica"
  ],

  "Pediatria": [
    "Neonatologia",
    "Puericultura",
    "Crescimento e Desenvolvimento",
    "Aleitamento Materno",
    "Nutrição Infantil",
    "Imunizações",
    "Infectologia Pediátrica",
    "Pneumologia Pediátrica",
    "Cardiologia Pediátrica",
    "Gastroenterologia Pediátrica",
    "Hepatologia Pediátrica",
    "Nefrologia Pediátrica",
    "Urologia Pediátrica",
    "Endocrinologia Pediátrica",
    "Neurologia Pediátrica",
    "Hematologia Pediátrica",
    "Oncologia Pediátrica",
    "Reumatologia Pediátrica",
    "Alergia e Imunologia Pediátrica",
    "Dermatologia Pediátrica",
    "Genética Médica",
    "Adolescência",
    "Emergências Pediátricas",
    "Terapia Intensiva Pediátrica",
    "Cirurgia Pediátrica",
    "Doenças Respiratórias da Infância",
    "Diarreia e Desidratação",
    "Febre sem sinais localizatórios",
    "Violência e Maus-tratos",
    "Desenvolvimento Neuropsicomotor"
  ],

  "Ginecologia e Obstetrícia": [
    "Pré-natal de baixo risco",
    "Pré-natal de alto risco",
    "Medicina Fetal",
    "Trabalho de Parto",
    "Assistência ao Parto",
    "Puerpério",
    "Hemorragias da Gestação",
    "Hemorragia Pós-parto",
    "Síndromes Hipertensivas da Gestação",
    "Diabetes na Gestação",
    "Prematuridade",
    "Rotura Prematura de Membranas",
    "Infecções na Gestação",
    "Isoimunização Rh",
    "Gestação Múltipla",
    "Restrição de Crescimento Fetal",
    "Doença Trofoblástica Gestacional",
    "Contracepção",
    "Planejamento Reprodutivo",
    "Infertilidade e Reprodução Humana",
    "Endocrinologia Ginecológica",
    "Puberdade e Amenorreias",
    "Sangramento Uterino Anormal",
    "Climatério e Menopausa",
    "Dor Pélvica e Endometriose",
    "Infecções Ginecológicas e IST",
    "Uroginecologia",
    "Prolapso Genital",
    "Patologia do Trato Genital Inferior",
    "Oncologia Ginecológica",
    "Patologia Mamária e Mastologia",
    "Massas Pélvicas e Tumores Ovarianos",
    "Sexualidade e Disfunções Sexuais",
    "Cirurgia Ginecológica"
  ],

  "Cirurgia Geral": [
    "Princípios de Cirurgia",
    "Pré-operatório e Risco Cirúrgico",
    "Pós-operatório e Complicações",
    "Choque e Reposição Volêmica",
    "Nutrição em Cirurgia",
    "Infecção e Antibioticoprofilaxia",
    "Trauma",
    "ATLS e Atendimento Inicial ao Politraumatizado",
    "Trauma Cranioencefálico",
    "Trauma Torácico",
    "Trauma Abdominal",
    "Trauma Pélvico",
    "Queimaduras",
    "Abdome Agudo",
    "Abdome Agudo Inflamatório",
    "Abdome Agudo Obstrutivo",
    "Abdome Agudo Perfurativo",
    "Abdome Agudo Hemorrágico",
    "Abdome Agudo Vascular",
    "Apendicite",
    "Obstrução Intestinal",
    "Perfuração de Víscera Oca",
    "Hemorragia Digestiva",
    "Doença do Refluxo e Esôfago",
    "Cirurgia Gástrica",
    "Cirurgia Bariátrica e Metabólica",
    "Intestino Delgado",
    "Coloproctologia",
    "Doença Diverticular",
    "Doenças Anorretais",
    "Fígado",
    "Vias Biliares",
    "Pâncreas",
    "Baço",
    "Hérnias e Parede Abdominal",
    "Cirurgia Vascular",
    "Cirurgia Torácica",
    "Cirurgia de Cabeça e Pescoço",
    "Urologia",
    "Cirurgia Oncológica",
    "Cirurgia Pediátrica",
    "Cirurgia Plástica",
    "Anestesiologia",
    "Ortopedia e Traumatologia",
    "Cirurgia do Aparelho Digestivo",
    "Acessos, Drenos e Procedimentos",
    "Transplantes"
  ],

  "Preventiva": [
    "Epidemiologia",
    "Bioestatística",
    "Medicina Baseada em Evidências",
    "SUS: Princípios e Diretrizes",
    "Legislação do SUS",
    "Leis 8.080 e 8.142",
    "Atenção Primária à Saúde",
    "Estratégia Saúde da Família",
    "Medicina de Família e Comunidade",
    "Territorialização e Adscrição",
    "Promoção da Saúde",
    "Prevenção e Rastreamento",
    "Vigilância Epidemiológica",
    "Vigilância Sanitária",
    "Vigilância em Saúde Ambiental",
    "Vigilância em Saúde do Trabalhador",
    "Imunizações e Calendário Vacinal",
    "Doenças de Notificação Compulsória",
    "Indicadores de Saúde",
    "Demografia e Transição Epidemiológica",
    "Sistemas de Informação em Saúde",
    "Planejamento e Gestão em Saúde",
    "Financiamento do SUS",
    "Redes de Atenção à Saúde",
    "Regulação em Saúde",
    "Saúde Coletiva",
    "Saúde do Trabalhador",
    "Saúde Ambiental e Saneamento",
    "Ética Médica",
    "Bioética",
    "Atestados, Declarações e Documentos Médicos",
    "Segurança do Paciente",
    "Epidemiologia Clínica",
    "Testes Diagnósticos",
    "Estudos Observacionais",
    "Ensaios Clínicos",
    "Revisões Sistemáticas e Metanálises",
    "Medidas de Frequência e Associação",
    "Políticas Nacionais de Saúde",
    "Equidade e Determinantes Sociais da Saúde"
  ]
};

function normalizeFlashAreaName(value) {
  const raw =
    String(value || "")
      .trim();

  const normalized =
    raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const aliases = {
    "clinica medica":
      "Clínica Médica",
    "pediatria":
      "Pediatria",
    "ginecologia e obstetricia":
      "Ginecologia e Obstetrícia",
    "ginecologia obstetricia":
      "Ginecologia e Obstetrícia",
    "go":
      "Ginecologia e Obstetrícia",
    "cirurgia geral":
      "Cirurgia Geral",
    "preventiva":
      "Preventiva",
    "medicina preventiva":
      "Preventiva",
    "medicina preventiva e social":
      "Preventiva",
    "saude coletiva":
      "Preventiva"
  };

  return aliases[normalized]
    || raw;
}

const FLASHCARD_AREAS = [
  "Clínica Médica",
  "Pediatria",
  "Ginecologia e Obstetrícia",
  "Cirurgia Geral",
  "Preventiva"
];

function wireCreateAreaPicker() {
  const input = document.getElementById("create-area");
  const toggle = document.getElementById("create-area-toggle");
  const label = document.getElementById("create-area-label");
  const menu = document.getElementById("create-area-menu");
  if (!input || !toggle || !label || !menu) return;

  menu.innerHTML = "";
  FLASHCARD_AREAS.forEach(area => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "flash-area-option";
    option.setAttribute("role", "option");
    option.textContent = area;
    option.addEventListener("click", event => {
      event.stopPropagation();
      input.value = area;
      label.textContent = area;
      menu.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    menu.appendChild(option);
  });

  toggle.addEventListener("click", event => {
    event.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  document.addEventListener("click", event => {
    if (!event.target.closest(".flash-area-picker")) {
      menu.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

function updateCreateSubjectOptions() {
  const areaInput =
    document.getElementById(
      "create-area"
    );

  const subjectInput =
    document.getElementById(
      "create-materia"
    );

  const subjectToggle =
    document.getElementById(
      "create-materia-toggle"
    );

  const subjectLabel =
    document.getElementById(
      "create-materia-label"
    );

  const subjectMenu =
    document.getElementById(
      "create-materia-menu"
    );

  if (
    !areaInput
    ||
    !subjectInput
    ||
    !subjectToggle
    ||
    !subjectLabel
    ||
    !subjectMenu
  ) {
    return;
  }

  const current =
    subjectInput.value;

  const area =
    normalizeFlashAreaName(
      areaInput.value
    );

  const subjects =
    FLASHCARD_SUBJECTS_BY_AREA[
      area
    ]
    || [];

  subjectMenu.innerHTML =
    "";

  if (!subjects.length) {
    subjectInput.value =
      "";

    subjectLabel.textContent =
      "Selecione primeiro a área";

    subjectToggle.disabled =
      true;

    subjectMenu.hidden =
      true;

    subjectToggle.setAttribute(
      "aria-expanded",
      "false"
    );

    return;
  }

  subjectToggle.disabled =
    false;

  const options =
    [
      ...subjects,
      "Outra matéria"
    ];

  for (
    const subject
    of options
  ) {
    const option =
      document.createElement(
        "button"
      );

    option.type =
      "button";

    option.className =
      "flash-subject-option";

    option.setAttribute(
      "role",
      "option"
    );

    option.dataset.value =
      subject;

    option.textContent =
      subject;

    option.addEventListener(
      "click",
      event => {
        event.stopPropagation();

        subjectInput.value =
          subject;

        subjectLabel.textContent =
          subject;

        subjectMenu.hidden =
          true;

        subjectToggle.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    );

    subjectMenu.appendChild(
      option
    );
  }

  if (
    subjects.includes(
      current
    )
    ||
    current ===
      "Outra matéria"
  ) {
    subjectInput.value =
      current;

    subjectLabel.textContent =
      current;
  } else {
    subjectInput.value =
      "";

    subjectLabel.textContent =
      "Selecione a matéria";
  }
}

function wireCreateTaxonomy() {
  wireCreateAreaPicker();

  const areaInput =
    document.getElementById(
      "create-area"
    );

  const subjectToggle =
    document.getElementById(
      "create-materia-toggle"
    );

  const subjectMenu =
    document.getElementById(
      "create-materia-menu"
    );

  if (!areaInput) {
    return;
  }

  areaInput.addEventListener(
    "change",
    updateCreateSubjectOptions
  );

  subjectToggle
    ?.addEventListener(
      "click",
      event => {
        event.stopPropagation();

        if (
          subjectToggle.disabled
          ||
          !subjectMenu
        ) {
          return;
        }

        const willOpen =
          subjectMenu.hidden;

        subjectMenu.hidden =
          !willOpen;

        subjectToggle.setAttribute(
          "aria-expanded",
          willOpen
            ? "true"
            : "false"
        );
      }
    );

  document.addEventListener(
    "click",
    event => {
      if (
        !event.target.closest(
          ".flash-subject-picker"
        )
        &&
        subjectMenu
      ) {
        subjectMenu.hidden =
          true;

        subjectToggle
          ?.setAttribute(
            "aria-expanded",
            "false"
          );
      }
    }
  );

  updateCreateSubjectOptions();
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

  const areaLabel = document.getElementById("create-area-label");
  if (areaLabel) areaLabel.textContent = "Selecione a área";

  updateCreateSubjectOptions();

  setFlashStatus(
    "create-status",
    ""
  );
}

function wireCreate() {
  wireCreateTaxonomy();

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

        if (!area) {
          setFlashStatus(
            "create-status",
            "Selecione uma área.",
            "error"
          );

          document
            .getElementById(
              "create-area"
            )
            ?.focus();

          return;
        }

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
            await window.LuriaStorage.remove("flashcard_images",
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
          ankiDeckSubjectMap.get(
            sourceDeck
          )
          || "",

        theme:
          ankiDeckThemeMap.get(
            sourceDeck
          )
          || "",

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
        ) => {
          const area =
            ankiDeckAreaMap.get(
              deck
            )
            || sourceDeckDefaultArea(
              deck
            );

          const subjects =
            FLASHCARD_SUBJECTS_BY_AREA[
              normalizeFlashAreaName(
                area
              )
            ]
            || [];

          const selectedSubject =
            ankiDeckSubjectMap.get(
              deck
            )
            || "";

          const selectedTheme =
            ankiDeckThemeMap.get(
              deck
            )
            || "";

          return `
          <div class="anki-deck-row">

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

            <label class="anki-deck-field">
              <span>Área</span>
              <input
                type="text"
                value="${escapeFlashHtml(
                  area
                )}"
                data-anki-deck-area="${index}"
                list="medical-areas"
                data-luria-area-input
                placeholder="Área no LURIA"
              >
            </label>

            <label class="anki-deck-field">
              <span>Matéria</span>
              <select
                data-anki-deck-subject="${index}"
                ${subjects.length ? "" : "disabled"}
              >
                <option value="">
                  ${subjects.length ? "Selecione a matéria" : "Escolha a área primeiro"}
                </option>
                ${subjects
                  .map(
                    subject => `
                      <option
                        value="${escapeFlashHtml(subject)}"
                        ${subject === selectedSubject ? "selected" : ""}
                      >
                        ${escapeFlashHtml(subject)}
                      </option>
                    `
                  )
                  .join("")}
              </select>
            </label>

            <label class="anki-deck-field">
              <span>Tema / subtema</span>
              <input
                type="text"
                value="${escapeFlashHtml(
                  selectedTheme
                )}"
                data-anki-deck-theme="${index}"
                placeholder="Ex.: Insuficiência cardíaca"
              >
            </label>

            <span class="anki-deck-count">
              ${counts.get(deck) || 0} cards
            </span>

          </div>
        `;
        }
      )
      .join("");


  document
    .querySelectorAll(
      "[data-anki-deck-area]"
    )
    .forEach(
      (input) => {
        input.addEventListener(
          "change",
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

            ankiDeckSubjectMap.set(
              deck,
              ""
            );

            importRows =
              importRows.map(
                (row) =>
                  row.source_deck
                    === deck
                      ? {
                          ...row,
                          area,
                          materia:
                            ""
                        }
                      : row
              );

            renderImportPreview();
          }
        );
      }
    );


  document
    .querySelectorAll(
      "[data-anki-deck-subject]"
    )
    .forEach(
      (select) => {
        select.addEventListener(
          "change",
          () => {
            const index =
              Number(
                select.dataset
                  .ankiDeckSubject
              );

            const deck =
              ankiImportStats
                .sourceDecks[
                  index
                ];

            if (!deck) {
              return;
            }

            const materia =
              select.value
                .trim();

            ankiDeckSubjectMap.set(
              deck,
              materia
            );

            importRows =
              importRows.map(
                (row) =>
                  row.source_deck
                    === deck
                      ? {
                          ...row,
                          materia
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


  document
    .querySelectorAll(
      "[data-anki-deck-theme]"
    )
    .forEach(
      (input) => {
        const updateTheme =
          () => {
            const index =
              Number(
                input.dataset
                  .ankiDeckTheme
              );

            const deck =
              ankiImportStats
                .sourceDecks[
                  index
                ];

            if (!deck) {
              return;
            }

            const theme =
              input.value
                .trim();

            ankiDeckThemeMap.set(
              deck,
              theme
            );

            importRows =
              importRows.map(
                (row) =>
                  row.source_deck
                    === deck
                      ? {
                          ...row,
                          theme
                        }
                      : row
              );

            renderImportPreview(
              false
            );
          };

        input.addEventListener(
          "input",
          updateTheme
        );

        input.addEventListener(
          "change",
          updateTheme
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

  ankiDeckSubjectMap =
    new Map();

  ankiDeckThemeMap =
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

  ankiDeckSubjectMap =
    new Map();

  ankiDeckThemeMap =
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
                importFileKind ===
                  "anki"
                    ? (
                        ankiDeckSubjectMap
                          .get(
                            row.source_deck
                          )
                        || row.materia
                        || null
                      )
                    : (
                        row.materia
                        || null
                      ),

              theme:
                importFileKind ===
                  "anki"
                    ? (
                        ankiDeckThemeMap
                          .get(
                            row.source_deck
                          )
                        || row.theme
                        || null
                      )
                    : (
                        row.theme
                        || null
                      ),

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

  const materia =
    document
      .getElementById(
        "library-materia"
      )
      ?.value
    || "";

  const theme =
    document
      .getElementById(
        "library-theme"
      )
      ?.value
    || "";

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
        materia
        && card.materia !== materia
      ) {
        return false;
      }

      if (
        theme
        && card.theme !== theme
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
      item =>
        item.id === cardId
    )
    || reviewQueue.find(
      item =>
        item.id === cardId
    );


  if (!card) {
    return;
  }


  if (card.shared) {
    const confirmed = await window.LuriaDialog.confirm(
        "Remover este flashcard compartilhado da sua biblioteca? O original continuará com o autor."
      );


    if (!confirmed) {
      return;
    }


    setLibraryStatus(
      "Removendo flashcard compartilhado..."
    );


    const {
      error
    } =
      await flashSb
        .from(
          "flashcard_shared_state"
        )
        .delete()
        .eq(
          "user_id",
          flashUser.id
        )
        .eq(
          "flashcard_id",
          cardId
        );


    if (error) {
      console.error(error);

      setLibraryStatus(
        `Não foi possível remover: ${error.message}`,
        "error"
      );

      return;
    }


    selectedFlashcardIds.delete(
      cardId
    );


    setLibraryStatus(
      "Flashcard compartilhado removido da sua biblioteca.",
      "success"
    );


    await Promise.all([
      loadLibrary(),
      loadMetrics(),
      loadReviewQueue()
    ]);

    return;
  }


  const confirmed = await window.LuriaDialog.confirm(
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
      )
      .eq(
        "user_id",
        flashUser.id
      );


  if (error) {
    console.error(error);

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
      .filter(Boolean);


  if (storagePaths.length) {
    const {
      error:
        storageError
    } =
      await window.LuriaStorage.remove("flashcard_images",
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

  const shareButton =
    document.getElementById(
      "flash-library-share-selected"
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

  if (shareButton) {
    const selectedOwned =
      libraryCards.filter(
        card =>
          selectedFlashcardIds.has(
            card.id
          )
          &&
          !card.shared
      ).length;

    shareButton.disabled =
      selectedOwned === 0;
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
    const { data: blob, error } = await window.LuriaStorage.download("flashcard_images",path);

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
      dataUrl: canvas.toDataURL("image/jpeg", 0.9),
      width: canvas.width,
      height: canvas.height
    };
  } catch (error) {
    console.warn("Imagem não incluída no PDF dos Flashcards:", error);
    return null;
  }
}


function flashPdfNewPage(
  doc,
  state
) {
  doc.addPage();

  window.LuriaPdfBranding
    ?.decoratePage(
      doc,
      state.assets,
      {
        title:
          "Flashcards",
        subtitle:
          state.headerSubtitle
          || ""
      }
    );

  state.y =
    29;

  return state;
}


function flashPdfAddImage(doc, imageData, state) {
  if (!imageData) return state;

  const margin = 16;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = Math.min(105, pageWidth - margin * 2);
  const maxHeight = 76;

  const ratio = imageData.width / Math.max(1, imageData.height);
  let width = maxWidth;
  let height = width / ratio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }

  if (state.y + height + 10 > pageHeight - 16) {
    state =
      flashPdfNewPage(
        doc,
        state
      );
  }

  const x =
    margin
    + Math.max(
        0,
        (
          pageWidth
          - margin * 2
          - width
        ) / 2
      );

  doc.setDrawColor(
    218,
    230,
    244
  );

  doc.setFillColor(
    248,
    250,
    252
  );

  doc.roundedRect(
    x - 2,
    state.y - 2,
    width + 4,
    height + 4,
    2.4,
    2.4,
    "FD"
  );

  doc.addImage(
    imageData.dataUrl,
    "JPEG",
    x,
    state.y,
    width,
    height,
    undefined,
    "MEDIUM"
  );

  state.y +=
    height + 8;

  return state;
}


function flashPdfAddBlock(doc, label, value, state) {
  if (!value) return state;

  const margin = 16;
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const valueLines = doc.splitTextToSize(String(value), maxWidth - 4);
  const needed = 5.5 + valueLines.length * 4.8 + 4.5;

  if (state.y + needed > pageHeight - 16) {
    state =
      flashPdfNewPage(
        doc,
        state
      );
  }

  doc.setTextColor(
    24,
    72,
    136
  );

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(
    8.2
  );

  doc.text(
    String(label).toUpperCase(),
    margin,
    state.y
  );

  state.y +=
    4.7;

  doc.setTextColor(
    30,
    41,
    59
  );

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(
    9.7
  );

  doc.text(
    valueLines,
    margin,
    state.y
  );

  state.y +=
    valueLines.length * 4.8
    + 5;

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
    const doc = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
      compress: true
    });

    const assets =
      await window.LuriaPdfBranding
        ?.getAssets?.();

    const headerSubtitle =
      `${cards.length} flashcard${cards.length === 1 ? "" : "s"} selecionado${cards.length === 1 ? "" : "s"}`;

    window.LuriaPdfBranding
      ?.decoratePage(
        doc,
        assets,
        {
          title:
            "Flashcards",
          subtitle:
            headerSubtitle
        }
      );

    const margin = 16;

    let state = {
      y: 29,
      assets,
      headerSubtitle
    };

    for (let index = 0; index < cards.length; index += 1) {
      const card = cards[index];

      if (state.y > 252) {
        state =
          flashPdfNewPage(
            doc,
            state
          );
      }

      doc.setFillColor(
        238,
        244,
        251
      );

      doc.setDrawColor(
        218,
        230,
        244
      );

      doc.roundedRect(
        margin,
        state.y - 4.2,
        doc.internal.pageSize.getWidth() - margin * 2,
        11,
        2.4,
        2.4,
        "FD"
      );

      doc.setTextColor(
        18,
        48,
        85
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(
        11.2
      );

      const heading =
        `${index + 1}. ${card.area || "Sem área"}${card.materia ? ` · ${card.materia}` : ""}`;

      doc.text(
        doc.splitTextToSize(
          heading,
          doc.internal.pageSize.getWidth() - margin * 2 - 8
        )[0],
        margin + 4,
        state.y + 2.3
      );

      state.y +=
        12;

      state =
        flashPdfAddBlock(
          doc,
          "Tema",
          card.theme,
          state
        );

      state =
        flashPdfAddBlock(
          doc,
          "Frente",
          card.front_text,
          state
        );

      if (card.front_image_path) {
        setLibraryStatus(`Preparando mídia ${index + 1} de ${cards.length}...`);

        const frontImage =
          await flashPdfImageData(
            card.front_image_path
          );

        state =
          flashPdfAddImage(
            doc,
            frontImage,
            state
          );
      }

      state =
        flashPdfAddBlock(
          doc,
          "Verso",
          card.back_text,
          state
        );

      if (card.back_image_path) {
        const backImage =
          await flashPdfImageData(
            card.back_image_path
          );

        state =
          flashPdfAddImage(
            doc,
            backImage,
            state
          );
      }

      state.y +=
        1.5;

      doc.setDrawColor(
        218,
        230,
        244
      );

      doc.setLineWidth(
        0.25
      );

      doc.line(
        margin,
        state.y,
        doc.internal.pageSize.getWidth() - margin,
        state.y
      );

      state.y +=
        7;
    }

    window.LuriaPdfBranding
      ?.finalize(
        doc
      );

    doc.save(`luria-flashcards-${todayISO()}.pdf`);
    setLibraryStatus("PDF exportado.", "success");
  } catch (error) {
    console.error(error);
    setLibraryStatus(`Não foi possível gerar o PDF: ${error.message}`, "error");
  } finally {
    if (button) button.disabled = false;
  }
}


async function deleteSelectedFlashcards() {
  const cards =
    libraryCards.filter(
      card =>
        selectedFlashcardIds.has(
          card.id
        )
    );


  if (!cards.length) {
    return;
  }


  const owned =
    cards.filter(
      card =>
        !card.shared
    );


  const shared =
    cards.filter(
      card =>
        card.shared
    );


  const parts = [];

  if (owned.length) {
    parts.push(
      `${owned.length} flashcard${owned.length === 1 ? "" : "s"} seu${owned.length === 1 ? "" : "s"} será${owned.length === 1 ? "" : "ão"} excluído${owned.length === 1 ? "" : "s"} permanentemente`
    );
  }

  if (shared.length) {
    parts.push(
      `${shared.length} compartilhado${shared.length === 1 ? "" : "s"} será${shared.length === 1 ? "" : "ão"} apenas removido${shared.length === 1 ? "" : "s"} da sua biblioteca`
    );
  }


  if (
    !await window.LuriaDialog.confirm(
      `${parts.join(". ")}. Continuar?`
    )
  ) {
    return;
  }


  setLibraryStatus(
    "Atualizando biblioteca..."
  );


  if (owned.length) {
    const ownedIds =
      owned.map(
        card =>
          card.id
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
          "user_id",
          flashUser.id
        )
        .in(
          "id",
          ownedIds
        );


    if (error) {
      console.error(error);

      setLibraryStatus(
        `Não foi possível excluir seus flashcards: ${error.message}`,
        "error"
      );

      return;
    }


    const paths =
      owned
        .flatMap(
          card => [
            card.front_image_path,
            card.back_image_path
          ]
        )
        .filter(Boolean);


    if (paths.length) {
      const {
        error:
          storageError
      } =
        await window.LuriaStorage.remove("flashcard_images",
            paths
          );


      if (storageError) {
        console.warn(
          storageError
        );
      }
    }
  }


  if (shared.length) {
    const sharedIds =
      shared.map(
        card =>
          card.id
      );


    const {
      error
    } =
      await flashSb
        .from(
          "flashcard_shared_state"
        )
        .delete()
        .eq(
          "user_id",
          flashUser.id
        )
        .in(
          "flashcard_id",
          sharedIds
        );


    if (error) {
      console.error(error);

      setLibraryStatus(
        `Não foi possível remover os compartilhados: ${error.message}`,
        "error"
      );

      return;
    }
  }


  selectedFlashcardIds.clear();


  setLibraryStatus(
    "Biblioteca atualizada.",
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
    renderLibraryDecks();

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

                ${
                  card.shared
                    ? ""
                    : `
                      <button
                        type="button"
                        data-flash-edit="${escapeFlashHtml(card.id)}"
                      >
                        Editar
                      </button>
                    `
                }

                <button
                  class="danger"
                  type="button"
                  data-flash-delete="${escapeFlashHtml(card.id)}"
                >
                  ${card.shared ? "Remover da biblioteca" : "Excluir"}
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

                ${
                  card.shared
                    ? '<span class="flash-shared-badge">Compartilhado</span>'
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
  renderLibraryDecks();


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

async function loadSharedFlashcards() {
  const {
    data,
    error
  } = await flashSb
    .from("flashcard_shared_state")
    .select(`
      flashcard_id,
      share_id,
      due_date,
      review_count,
      active,
      current_interval_days,
      stability_days,
      last_reviewed_at,
      last_rating,
      flashcards (
        id,
        user_id,
        area,
        materia,
        theme,
        front_text,
        back_text,
        front_image_path,
        back_image_path,
        created_at
      )
    `)
    .eq("user_id", flashUser.id);

  if (error) {
    console.warn("Não foi possível carregar flashcards compartilhados:", error.message);
    return [];
  }

  return (data || [])
    .filter((row) => row.flashcards)
    .map((row) => ({
      ...row.flashcards,
      due_date: row.due_date,
      review_count: row.review_count,
      active: row.active,
      current_interval_days: row.current_interval_days,
      stability_days: row.stability_days,
      last_reviewed_at: row.last_reviewed_at,
      last_rating: row.last_rating,
      shared: true,
      share_id: row.share_id,
      owner_user_id: row.flashcards.user_id
    }));
}

function flashDeckKey(card) {
  return [
    card.area || "Sem área",
    card.materia || "Sem matéria",
    card.theme || "Sem tema"
  ].join("|||");
}

function flashDeckLabel(card) {
  return [
    card.area,
    card.materia,
    card.theme
  ].filter(Boolean).join(" · ") || "Deck sem classificação";
}

function populateLibraryTaxonomyFilters() {
  const area =
    document.getElementById("library-area")?.value || "";

  const materiaSelect =
    document.getElementById("library-materia");

  const themeSelect =
    document.getElementById("library-theme");

  if (!materiaSelect || !themeSelect) {
    return;
  }

  const previousMateria = materiaSelect.value;
  const previousTheme = themeSelect.value;

  const areaCards =
    libraryCards.filter(
      card => !area || card.area === area
    );

  const materias =
    [...new Set(
      areaCards
        .map(card => card.materia)
        .filter(Boolean)
    )].sort((a,b) => a.localeCompare(b,"pt-BR"));

  materiaSelect.innerHTML =
    '<option value="">Todas as matérias</option>'
    + materias.map(
        value => `<option value="${escapeFlashHtml(value)}">${escapeFlashHtml(value)}</option>`
      ).join("");

  if (materias.includes(previousMateria)) {
    materiaSelect.value = previousMateria;
  }

  const materia =
    materiaSelect.value;

  const themes =
    [...new Set(
      areaCards
        .filter(card => !materia || card.materia === materia)
        .map(card => card.theme)
        .filter(Boolean)
    )].sort((a,b) => a.localeCompare(b,"pt-BR"));

  themeSelect.innerHTML =
    '<option value="">Todos os temas</option>'
    + themes.map(
        value => `<option value="${escapeFlashHtml(value)}">${escapeFlashHtml(value)}</option>`
      ).join("");

  if (themes.includes(previousTheme)) {
    themeSelect.value = previousTheme;
  }
}

function renderLibraryDecks() {
  const host =
    document.getElementById("library-decks");

  if (!host) {
    return;
  }

  const cards =
    filteredLibraryCards();

  const groups =
    new Map();

  for (const card of cards) {
    const key =
      flashDeckKey(card);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(card);
  }

  if (!groups.size) {
    host.innerHTML = "";
    return;
  }

  host.innerHTML =
    [...groups.values()]
      .map(deck => {
        const sample = deck[0];
        const owned = deck.filter(card => !card.shared);
        const sharedCount = deck.length - owned.length;

        return `
          <article class="flash-deck-card">
            <div class="flash-deck-taxonomy">
              ${sample.area ? `<span class="taxonomy-chip">${escapeFlashHtml(sample.area)}</span>` : ""}
              ${sample.materia ? `<span class="taxonomy-chip">${escapeFlashHtml(sample.materia)}</span>` : ""}
              ${sample.theme ? `<span class="taxonomy-chip accent">${escapeFlashHtml(sample.theme)}</span>` : ""}
              ${sharedCount ? `<span class="flash-shared-badge">${sharedCount} compartilhado${sharedCount === 1 ? "" : "s"}</span>` : ""}
            </div>
            <strong>${escapeFlashHtml(flashDeckLabel(sample))}</strong>
            <small>${deck.length} flashcard${deck.length === 1 ? "" : "s"}</small>
            <div class="flash-deck-buttons">
              <button class="button primary" type="button" data-review-deck="${escapeFlashHtml(flashDeckKey(sample))}">
                Revisar agora
              </button>
              ${owned.length ? `
                <button class="button secondary" type="button" data-share-deck="${escapeFlashHtml(flashDeckKey(sample))}">
                  Compartilhar
                </button>
              ` : ""}
            </div>
          </article>
        `;
      })
      .join("");

  host.querySelectorAll("[data-review-deck]")
    .forEach(button => {
      button.addEventListener("click", () => {
        const key = button.dataset.reviewDeck;
        startExtraReview(
          cards.filter(card => flashDeckKey(card) === key),
          flashDeckLabel(
            cards.find(card => flashDeckKey(card) === key)
          )
        );
      });
    });

  host.querySelectorAll("[data-share-deck]")
    .forEach(button => {
      button.addEventListener("click", async () => {
        const key = button.dataset.shareDeck;
        const deck = cards.filter(
          card => flashDeckKey(card) === key && !card.shared
        );

        await shareFlashcardDeck(
          deck,
          flashDeckLabel(deck[0])
        );
      });
    });
}

async function createFlashcardShareToken(cards, title) {
  const owned =
    (cards || []).filter(
      card =>
        !card.shared
    );

  if (!owned.length) {
    throw new Error(
      "A seleção não contém flashcards seus para compartilhar."
    );
  }

  const {
    data,
    error
  } = await flashSb.rpc(
    "create_flashcard_deck_share",
    {
      p_flashcard_ids:
        owned.map(
          card =>
            card.id
        ),

      p_title:
        title
        || "Deck LURIA"
    }
  );

  if (error) {
    throw error;
  }

  return data;
}


async function exportFlashcardCards(
  cards
) {
  const previous =
    new Set(
      selectedFlashcardIds
    );

  selectedFlashcardIds.clear();

  for (
    const card
    of cards
  ) {
    selectedFlashcardIds.add(
      card.id
    );
  }

  try {
    await exportSelectedFlashcardsPdf();
  } finally {
    selectedFlashcardIds.clear();

    for (
      const id
      of previous
    ) {
      selectedFlashcardIds.add(
        id
      );
    }

    updateFlashBulkToolbar();
  }
}


async function openFlashShareDialog(
  cards,
  title
) {
  const owned =
    (cards || []).filter(
      card =>
        !card.shared
    );

  if (!owned.length) {
    setLibraryStatus(
      "A seleção não contém flashcards seus para compartilhar.",
      "error"
    );

    return;
  }

  if (!window.LuriaSharing) {
    setLibraryStatus(
      "O compartilhamento não carregou. Atualize a página.",
      "error"
    );

    return;
  }

  let cachedToken =
    null;

  const getToken =
    async () => {
      if (!cachedToken) {
        cachedToken =
          await createFlashcardShareToken(
            owned,
            title
          );
      }

      return cachedToken;
    };

  await window.LuriaSharing.open({
    title:
      title
      || "Flashcards selecionados",

    count:
      owned.length,

    onLink:
      async () => {
        const token =
          await getToken();

        const url =
          new URL(
            "/flashcards/",
            window.location.origin
          );

        url.searchParams.set(
          "share",
          token
        );

        try {
          await navigator.clipboard
            .writeText(
              url.toString()
            );

          setLibraryStatus(
            "Link copiado. Os flashcards serão compartilhados por referência.",
            "success"
          );

        } catch {
          await window.LuriaDialog.prompt(
            "Copie o link:",
            url.toString()
          );
        }
      },

    onFriend:
      async (
        friendUserId
      ) => {
        const token =
          await getToken();

        const {
          error
        } =
          await flashSb.rpc(
            "send_direct_share",
            {
              p_friend_user_id:
                friendUserId,

              p_resource_type:
                "flashcard_deck",

              p_share_token:
                token,

              p_title:
                title
                || "Deck de Flashcards"
            }
          );

        if (error) {
          throw error;
        }

        setLibraryStatus(
          "Deck enviado dentro do LURIA.",
          "success"
        );
      },

    onExport:
      async () => {
        await exportFlashcardCards(
          owned
        );
      }
  });
}


async function shareFlashcardDeck(
  cards,
  title
) {
  return openFlashShareDialog(
    cards,
    title
  );
}

async function redeemFlashcardShareFromUrl() {
  const url =
    new URL(window.location.href);

  const token =
    url.searchParams.get("share");

  if (!token) {
    return;
  }

  setFlashStatus("review-status", "Adicionando deck compartilhado...");

  const {
    data,
    error
  } = await flashSb.rpc(
    "redeem_flashcard_deck_share",
    {
      p_token: token
    }
  );

  if (error) {
    console.error(error);
    setFlashStatus("review-status", `Não foi possível adicionar o deck: ${error.message}`, "error");
    return;
  }

  url.searchParams.delete("share");
  window.history.replaceState({}, "", url);

  setFlashStatus(
    "review-status",
    `${Number(data || 0)} flashcard${Number(data || 0) === 1 ? "" : "s"} adicionado${Number(data || 0) === 1 ? "" : "s"} por referência.`,
    "success"
  );
}

function startExtraReview(cards, label = "revisão extraordinária") {
  const activeCards =
    (cards || []).filter(card => card.active !== false);

  if (!activeCards.length) {
    setLibraryStatus("Nenhum flashcard ativo nesta seleção.", "error");
    return;
  }

  reviewMode = "extra";
  reviewModeLabel = label;
  reviewQueue = activeCards;
  reviewIndex = 0;

  switchFlashTab("review");

  const sessionCopy =
    document.getElementById("review-session-copy");

  if (sessionCopy) {
    sessionCopy.textContent =
      `Revisão extra · ${label}`;
  }

  renderCurrentReview();
}

async function loadLibrary() {
  const [
    ownedResult,
    sharedCards
  ] = await Promise.all([
    flashSb
      .from("flashcards")
      .select(`
        id,
        user_id,
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
      .eq("user_id", flashUser.id)
      .order("created_at", { ascending: false })
      .limit(500),
    loadSharedFlashcards()
  ]);

  if (ownedResult.error) {
    console.error(ownedResult.error);
    return;
  }

  libraryCards = [
    ...(ownedResult.data || []).map(card => ({
      ...card,
      shared: false,
      owner_user_id: card.user_id
    })),
    ...sharedCards
  ];

  populateLibraryAreas();
  populateLibraryTaxonomyFilters();
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
      () => {
        populateLibraryTaxonomyFilters();
        renderLibrary();
      }
    );

  document
    .getElementById(
      "library-materia"
    )
    ?.addEventListener(
      "change",
      () => {
        populateLibraryTaxonomyFilters();
        renderLibrary();
      }
    );

  document
    .getElementById(
      "library-theme"
    )
    ?.addEventListener(
      "change",
      renderLibrary
    );

  document
    .getElementById(
      "flash-review-filtered"
    )
    ?.addEventListener(
      "click",
      () => {
        const cards = filteredLibraryCards();
        const area = document.getElementById("library-area")?.value;
        const materia = document.getElementById("library-materia")?.value;
        const theme = document.getElementById("library-theme")?.value;

        startExtraReview(
          cards,
          [area,materia,theme].filter(Boolean).join(" · ") || "Biblioteca"
        );
      }
    );

  document
    .getElementById(
      "flash-share-filtered"
    )
    ?.addEventListener(
      "click",
      async () => {
        const cards =
          filteredLibraryCards()
            .filter(card => !card.shared);

        const area = document.getElementById("library-area")?.value;
        const materia = document.getElementById("library-materia")?.value;
        const theme = document.getElementById("library-theme")?.value;

        await shareFlashcardDeck(
          cards,
          [area,materia,theme].filter(Boolean).join(" · ") || "Deck LURIA"
        );
      }
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
      "flash-library-share-selected"
    )
    ?.addEventListener(
      "click",
      async () => {
        const cards =
          libraryCards.filter(
            card =>
              selectedFlashcardIds.has(
                card.id
              )
              &&
              !card.shared
          );

        await openFlashShareDialog(
          cards,
          cards.length === 1
            ? "Flashcard selecionado"
            : "Flashcards selecionados"
        );
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
  "luria:study-mode",
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
  await redeemFlashcardShareFromUrl();

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
