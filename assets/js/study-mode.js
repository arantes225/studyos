(() => {
  "use strict";

  const AREAS = {
    medicine: [
      "Alergia e Imunologia",
      "Anestesiologia",
      "Angiologia",
      "Cardiologia",
      "Cirurgia Cardiovascular",
      "Cirurgia da Mão",
      "Cirurgia de Cabeça e Pescoço",
      "Cirurgia do Aparelho Digestivo",
      "Cirurgia Geral",
      "Cirurgia Oncológica",
      "Cirurgia Pediátrica",
      "Cirurgia Plástica",
      "Cirurgia Torácica",
      "Cirurgia Vascular",
      "Clínica Médica",
      "Coloproctologia",
      "Dermatologia",
      "Endocrinologia e Metabologia",
      "Endoscopia",
      "Gastroenterologia",
      "Genética Médica",
      "Geriatria",
      "Ginecologia e Obstetrícia",
      "Hematologia e Hemoterapia",
      "Homeopatia",
      "Infectologia",
      "Mastologia",
      "Medicina de Emergência",
      "Medicina de Família e Comunidade",
      "Medicina do Esporte",
      "Medicina do Trabalho",
      "Medicina Física e Reabilitação",
      "Medicina Intensiva",
      "Medicina Legal e Perícia Médica",
      "Medicina Nuclear",
      "Medicina Preventiva",
      "Nefrologia",
      "Neurocirurgia",
      "Neurologia",
      "Nutrologia",
      "Oftalmologia",
      "Oncologia Clínica",
      "Ortopedia e Traumatologia",
      "Otorrinolaringologia",
      "Patologia",
      "Patologia Clínica / Medicina Laboratorial",
      "Pediatria",
      "Pneumologia",
      "Psiquiatria",
      "Radiologia e Diagnóstico por Imagem",
      "Radioterapia",
      "Reumatologia",
      "Urologia"
    ],

  };

  const GENERAL_AREAS = {
    medicine: [
      "Clínica Médica",
      "Ginecologia e Obstetrícia",
      "Cirurgia Geral",
      "Pediatria",
      "Preventiva"
    ],

  };

  function normalizeMode() {
    return "medicine";
  }

  function modeLabel() {
    return "Medicina";
  }

  function areasFor(mode) {
    return [
      ...AREAS[
        normalizeMode(mode)
      ]
    ];
  }

  function generalAreasFor(mode) {
    return [
      ...GENERAL_AREAS[
        normalizeMode(mode)
      ]
    ];
  }

  function escapeOption(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function fillAreaDatalists(mode) {
    const areas =
      areasFor(mode);

    document
      .querySelectorAll(
        "[data-luria-area-list]"
      )
      .forEach(
        (list) => {
          list.innerHTML =
            areas
              .map(
                (area) =>
                  `<option value="${escapeOption(area)}"></option>`
              )
              .join("");
        }
      );
  }

  function fillGeneralAreaDatalists(mode) {
    const areas =
      generalAreasFor(mode);

    document
      .querySelectorAll(
        "[data-luria-general-area-list]"
      )
      .forEach(
        (list) => {
          list.innerHTML =
            areas
              .map(
                (area) =>
                  `<option value="${escapeOption(area)}"></option>`
              )
              .join("");
        }
      );
  }

  function fillGeneralAreaSelects(mode) {
    const areas =
      generalAreasFor(mode);

    document
      .querySelectorAll(
        "[data-luria-general-area-select]"
      )
      .forEach(
        (select) => {
          const previous =
            select.value;

          const blankLabel =
            select.dataset
              .blankLabel
            || "Todas as áreas";

          select.innerHTML =
            `<option value="">${escapeOption(blankLabel)}</option>`
            + areas
                .map(
                  (area) => `
                    <option value="${escapeOption(area)}">
                      ${escapeOption(area)}
                    </option>
                  `
                )
                .join("");

          if (
            previous
            && areas.includes(
              previous
            )
          ) {
            select.value =
              previous;
          }
        }
      );
  }

  function fillAreaSelects(mode) {
    const areas =
      areasFor(mode);

    document
      .querySelectorAll(
        "[data-luria-area-select]"
      )
      .forEach(
        (select) => {
          const previous =
            select.value;

          const blankLabel =
            select.dataset
              .blankLabel
            || "Todas as áreas";

          select.innerHTML =
            `<option value="">${escapeOption(blankLabel)}</option>`
            + areas
                .map(
                  (area) => `
                    <option value="${escapeOption(area)}">
                      ${escapeOption(area)}
                    </option>
                  `
                )
                .join("");

          if (
            previous
            && areas.includes(
              previous
            )
          ) {
            select.value =
              previous;
          }
        }
      );
  }

  function updateAreaPlaceholders(mode) {
    const dentistry = false;

    document
      .querySelectorAll(
        'input[list][data-luria-area-input], input[list][data-luria-general-area-input], input[list="medical-areas"], input[list="error-medical-areas"], input[list="manual-area-options"]'
      )
      .forEach(
        (input) => {
          input.placeholder =
            "Ex.: Clínica Médica";
        }
      );
  }

  function apply(mode) {
    const resolved =
      normalizeMode(mode);

    window.luriaStudyMode =
      resolved;

    document.documentElement
      .dataset.studyMode =
        resolved;

    fillAreaDatalists(
      resolved
    );

    fillAreaSelects(
      resolved
    );

    fillGeneralAreaDatalists(
      resolved
    );

    fillGeneralAreaSelects(
      resolved
    );

    updateAreaPlaceholders(
      resolved
    );

    document
      .querySelectorAll(
        "[data-study-mode-label]"
      )
      .forEach(
        (element) => {
          element.textContent =
            modeLabel(
              resolved
            );
        }
      );

    const detail = {
      mode:
        resolved,

      areas:
        areasFor(
          resolved
        ),

      generalAreas:
        generalAreasFor(
          resolved
        )
    };

    window.dispatchEvent(
      new CustomEvent(
        "luria:study-mode",
        {
          detail
        }
      )
    );

    return resolved;
  }

  async function load() {
    return apply("medicine");
  }

  window.LuriaStudyMode = {
    AREAS,
    GENERAL_AREAS,
    normalizeMode,
    modeLabel,
    areasFor,
    generalAreasFor,
    apply,
    load
  };

  if (
    window.docmapUser
  ) {
    load();
  } else {
    window.addEventListener(
      "docmap:ready",
      load,
      {
        once:
          true
      }
    );
  }
})();
