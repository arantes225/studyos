function parseAmbientacaoDate(value) {
  if (!value) {
    return "";
  }

  const [
    year,
    month,
    day
  ] = value
    .split("-")
    .map(Number);

  const date =
    new Date(
      year,
      month - 1,
      day
    );

  return new Intl
    .DateTimeFormat(
      "pt-BR",
      {
        day: "2-digit",
        month: "long",
        year: "numeric"
      }
    )
    .format(date);
}

function initSelectedActivity() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  const title =
    params.get("title");

  if (!title) {
    return;
  }

  const container =
    document.getElementById(
      "selected-activity"
    );

  const titleElement =
    document.getElementById(
      "selected-activity-title"
    );

  const metaElement =
    document.getElementById(
      "selected-activity-meta"
    );

  const bits = [
    params.get("area"),
    params.get("materia"),
    parseAmbientacaoDate(
      params.get("date")
    )
  ].filter(Boolean);

  titleElement.textContent =
    title;

  metaElement.textContent =
    bits.join(" · ");

  container.hidden =
    false;

  document
    .getElementById(
      "clear-selected-activity"
    )
    .addEventListener(
      "click",
      () => {
        window.history
          .replaceState(
            {},
            "",
            "ambientacao.html"
          );

        container.hidden =
          true;
      }
    );
}

if (window.docmapUser) {
  initSelectedActivity();

} else {
  window.addEventListener(
    "docmap:ready",
    initSelectedActivity,
    {
      once: true
    }
  );
}

function bindAmbientacaoAudio() {
  if (!window.docmapAudio) {
    return;
  }

  /*
    Os controles de áudio são
    conectados pelo app.js.

    Este ponto fica disponível
    para futuras funções da
    Ambientação.
  */
}

if (window.docmapAudio) {
  bindAmbientacaoAudio();

} else {
  window.addEventListener(
    "docmap:audio-ready",
    bindAmbientacaoAudio,
    {
      once: true
    }
  );
}