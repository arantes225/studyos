const errorSb =
  window.supabaseClient;

let errorUser =
  null;

let errorQueue =
  [];

let errorIndex =
  0;


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


function formatErrorDate(value) {
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


function setErrorChip(
  id,
  value
) {
  const element =
    document.getElementById(
      id
    );

  if (!element) {
    return;
  }

  element.textContent =
    value || "";

  element.hidden =
    !value;
}


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
    console.warn(
      "Imagem do caderno de erros indisponível:",
      error.message
    );

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
        errorQueue.length
          ? "sessão concluída"
          : "nenhum item pendente";

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


  setErrorChip(
    "error-area",
    item.area
  );


  setErrorChip(
    "error-materia",
    item.materia
  );


  setErrorChip(
    "error-theme",
    item.theme
  );


  document
    .getElementById(
      "error-ccq"
    )
    .textContent =
      item.ccq
      || "Sem CCQ";


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


  document
    .getElementById(
      "error-answer"
    )
    .hidden =
      true;


  document
    .getElementById(
      "show-error-answer"
    )
    .hidden =
      false;


  document
    .getElementById(
      "complete-error-review"
    )
    .hidden =
      true;


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
        "id,area,materia,theme,ccq,question_text,question_image_path,correct_answer,what_i_thought,due_date,current_interval_days,review_count,created_at"
      )
      .eq(
        "active",
        true
      );


  /*
    Pela Agenda:
    carrega exatamente o lote
    da data + área.

    Pela página normal:
    carrega tudo que venceu
    até hoje.
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
      `Não foi possível carregar o caderno de erros: ${error.message}`,
      "error"
    );

    return;
  }


  errorQueue =
    data || [];

  errorIndex =
    0;


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


function wireErrorReview() {
  document
    .getElementById(
      "show-error-answer"
    )
    .addEventListener(
      "click",
      () => {
        document
          .getElementById(
            "error-answer"
          )
          .hidden =
            false;


        document
          .getElementById(
            "show-error-answer"
          )
          .hidden =
            true;


        document
          .getElementById(
            "complete-error-review"
          )
          .hidden =
            false;
      }
    );


  document
    .getElementById(
      "complete-error-review"
    )
    .addEventListener(
      "click",
      async () => {
        const item =
          errorQueue[
            errorIndex
          ];


        if (!item) {
          return;
        }


        const button =
          document.getElementById(
            "complete-error-review"
          );


        button.disabled =
          true;


        setErrorStatus(
          "Salvando revisão..."
        );


        const {
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


        errorIndex +=
          1;


        await renderCurrentError();
      }
    );
}


async function initErrorNotebook() {
  errorUser =
    window.docmapUser;


  wireErrorReview();


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
      once: true
    }
  );
}
