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

    dentistry: [
      "Dentística",
      "Endodontia",
      "Periodontia",
      "Cirurgia e Traumatologia Bucomaxilofacial",
      "Prótese Dentária",
      "Ortodontia",
      "Odontopediatria",
      "Estomatologia",
      "Patologia Oral e Maxilofacial",
      "Radiologia e Imaginologia Odontológica",
      "Implantodontia",
      "Disfunção Temporomandibular e Dor Orofacial",
      "Odontogeriatria",
      "Odontologia para Pacientes com Necessidades Especiais",
      "Odontologia Hospitalar",
      "Saúde Coletiva / Saúde Bucal Coletiva",
      "Odontologia Legal",
      "Anestesiologia e Farmacologia",
      "Urgências e Emergências em Odontologia",
      "Anatomia, Fisiologia e Ciências Básicas Aplicadas à Odontologia",
      "Cariologia e Odontologia Preventiva",
      "Materiais Dentários"
    ]
  };

  const GENERAL_AREAS = {
    medicine: [
      "Clínica Médica",
      "Ginecologia e Obstetrícia",
      "Cirurgia Geral",
      "Pediatria",
      "Preventiva"
    ],

    dentistry: [
      ...AREAS.dentistry
    ]
  };

  function normalizeMode(value) {
    return value === "dentistry"
      ? "dentistry"
      : "medicine";
  }

  function modeLabel(mode) {
    return normalizeMode(mode) === "dentistry"
      ? "Odontologia"
      : "Medicina";
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
    const dentistry =
      normalizeMode(mode)
      === "dentistry";

    document
      .querySelectorAll(
        'input[list][data-luria-area-input], input[list][data-luria-general-area-input], input[list="medical-areas"], input[list="error-medical-areas"], input[list="manual-area-options"]'
      )
      .forEach(
        (input) => {
          input.placeholder =
            dentistry
              ? "Ex.: Dentística"
              : "Ex.: Clínica Médica";
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
    const user =
      window.docmapUser;

    if (!user) {
      return apply(
        "medicine"
      );
    }

    try {
      const {
        data,
        error
      } =
        await window
          .supabaseClient
          .from(
            "user_settings"
          )
          .select(
            "study_mode"
          )
          .eq(
            "user_id",
            user.id
          )
          .maybeSingle();

      if (error) {
        console.warn(
          "Não foi possível carregar o modo de estudo:",
          error.message
        );
      }

      return apply(
        data?.study_mode
        || "medicine"
      );

    } catch (error) {
      console.warn(
        error
      );

      return apply(
        "medicine"
      );
    }
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
