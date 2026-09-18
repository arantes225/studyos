const supabase = window.studyos.supabase;

const typeMeta = {
  flashcard: { label: "Flashcards", icon: "FC" },
  caderno_erros: { label: "Caderno de erros", icon: "CE" },
  revisao_materia: { label: "Revisão de matéria", icon: "RM" },
  aula: { label: "Aulas", icon: "AU" },
  edital: { label: "Editais", icon: "ED" }
};

async function init() {
  const session = await window.studyos.requireAuth();
  if (!session) return;

  document.getElementById("usuario-email").textContent = session.user.email;
  document.querySelector("[data-logout]").addEventListener("click", window.studyos.signOut);

  await window.studyos.ensureDefaultSettings();
  await loadDashboard();
}

async function loadDashboard() {
  const resumo = document.getElementById("resumo");
  const pendenciasEl = document.getElementById("pendencias");

  const { data, error } = await supabase
    .from("dashboard_pendencias")
    .select("*")
    .order("data", { ascending: true });

  if (error) {
    pendenciasEl.innerHTML = `<p class="message error">${window.studyos.escapeHtml(error.message)}</p>`;
    return;
  }

  const items = data || [];
  const counts = {
    flashcard: 0,
    caderno_erros: 0,
    revisao_materia: 0,
    aula: 0,
    edital: 0
  };

  items.forEach(item => {
    if (Object.hasOwn(counts, item.tipo)) counts[item.tipo] += 1;
  });

  resumo.innerHTML = Object.entries(counts).map(([type, count]) => `
    <div class="stat-card">
      <span class="stat-label">${typeMeta[type].label}</span>
      <strong>${count}</strong>
    </div>
  `).join("");

  if (!items.length) {
    pendenciasEl.innerHTML = `<div class="empty">Nenhuma pendência para hoje.</div>`;
    return;
  }

  pendenciasEl.innerHTML = items.map(item => `
    <article class="list-item">
      <div>
        <div class="list-meta">
          <span class="badge">${typeMeta[item.tipo]?.label || item.tipo}</span>
          ${item.status === "atrasado" ? '<span class="badge danger">Atrasado</span>' : '<span class="badge success">Hoje</span>'}
        </div>
        <h3>${window.studyos.escapeHtml(item.titulo || "")}</h3>
        <p>${window.studyos.escapeHtml(item.categoria || "")}</p>
      </div>
      <time>${window.studyos.formatDate(item.data)}</time>
    </article>
  `).join("");
}

init();