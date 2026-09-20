(() => {
  "use strict";

  const AREAS = {
    medicine: [
      "Clínica Médica",
      "Pediatria",
      "Ginecologia e Obstetrícia",
      "Cirurgia Geral",
      "Preventiva"
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
        "[data-resibulando-area-list]"
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

  function fillAreaSelects(mode) {
    const areas =
      areasFor(mode);

    document
      .querySelectorAll(
        "[data-resibulando-area-select]"
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
        'input[list][data-resibulando-area-input], input[list="medical-areas"], input[list="error-medical-areas"], input[list="manual-area-options"]'
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

    window.resibulandoStudyMode =
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
        )
    };

    window.dispatchEvent(
      new CustomEvent(
        "resibulando:study-mode",
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

  window.ResibulandoStudyMode = {
    AREAS,
    normalizeMode,
    modeLabel,
    areasFor,
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
