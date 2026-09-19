(() => {
  "use strict";

  const AREAS = {
    medicine: ["Clínica Médica", "Pediatria", "Ginecologia e Obstetrícia", "Cirurgia Geral", "Preventiva"],
    dentistry: ["Dentística", "Endodontia", "Periodontia", "Cirurgia e Traumatologia Bucomaxilofacial", "Prótese Dentária", "Ortodontia", "Odontopediatria", "Estomatologia", "Patologia Oral e Maxilofacial", "Radiologia e Imaginologia Odontológica", "Implantodontia", "Disfunção Temporomandibular e Dor Orofacial", "Odontogeriatria", "Odontologia para Pacientes com Necessidades Especiais", "Odontologia Hospitalar", "Saúde Coletiva / Saúde Bucal Coletiva", "Odontologia Legal", "Anestesiologia e Farmacologia", "Urgências e Emergências em Odontologia", "Anatomia, Fisiologia e Ciências Básicas Aplicadas à Odontologia", "Cariologia e Odontologia Preventiva", "Materiais Dentários"]
  };

  function normalizeMode(value) {
    return value === "dentistry" ? "dentistry" : "medicine";
  }

  function modeLabel(mode) {
    return normalizeMode(mode) === "dentistry" ? "Odontologia" : "Medicina";
  }

  function areasFor(mode) {
    return AREAS[normalizeMode(mode)];
  }

  function escapeOption(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  }

  function applyAreaLists(mode) {
    const resolved = normalizeMode(mode);
    const areas = areasFor(resolved);

    window.resibulandoStudyMode = resolved;
    document.documentElement.dataset.studyMode = resolved;

    document.querySelectorAll("[data-resibulando-area-list]").forEach((list) => {
      list.innerHTML = areas.map((area) => `<option value="${escapeOption(area)}"></option>`).join("");
      const id = list.id;
      if (!id) return;
      document.querySelectorAll(`input[list="${CSS.escape(id)}"]`).forEach((input) => {
        if (!input.value) {
          input.placeholder = resolved === "dentistry" ? "Ex.: Dentística" : "Ex.: Clínica Médica";
        }
      });
    });

    document.querySelectorAll("[data-study-mode-label]").forEach((element) => {
      element.textContent = modeLabel(resolved);
    });

    window.dispatchEvent(new CustomEvent("resibulando:study-mode", { detail: { mode: resolved, areas } }));
  }

  async function loadStudyMode() {
    const user = window.docmapUser;
    if (!user) {
      applyAreaLists("medicine");
      return "medicine";
    }

    try {
      const { data, error } = await window.supabaseClient
        .from("user_settings")
        .select("study_mode")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) console.warn("Não foi possível carregar o modo de estudo:", error.message);
      const mode = normalizeMode(data?.study_mode || "medicine");
      applyAreaLists(mode);
      return mode;
    } catch (error) {
      console.warn(error);
      applyAreaLists("medicine");
      return "medicine";
    }
  }

  window.ResibulandoStudyMode = { AREAS, normalizeMode, modeLabel, areasFor, apply: applyAreaLists, load: loadStudyMode };

  if (window.docmapUser) {
    loadStudyMode();
  } else {
    window.addEventListener("docmap:ready", loadStudyMode, { once: true });
  }
})();
