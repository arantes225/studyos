const supabase = window.studyos.supabase;

async function init() {
  const session = await window.studyos.requireAuth();
  if (!session) return;

  document.querySelector("[data-logout]").addEventListener("click", window.studyos.signOut);
  document.getElementById("cr-salvar").addEventListener("click", () => createClass(session.user.id));

  await loadClasses();
}

async function createClass(userId) {
  const materia = document.getElementById("cr-materia").value.trim();
  const tema = document.getElementById("cr-tema").value.trim();
  const data = document.getElementById("cr-data").value;
  const msg = document.getElementById("cr-msg");

  if (!tema || !data) {
    msg.textContent = "Preencha tema e data.";
    msg.className = "message error";
    return;
  }

  const { error } = await supabase.from("cronograma").insert({
    user_id: userId,
    materia: materia || null,
    tema,
    data_aula: data,
    concluido: false
  });

  if (error) {
    msg.textContent = error.message;
    msg.className = "message error";
    return;
  }

  document.getElementById("cr-materia").value = "";
  document.getElementById("cr-tema").value = "";
  document.getElementById("cr-data").value = "";

  msg.textContent = "Aula salva.";
  msg.className = "message success";

  await loadClasses();
}

async function loadClasses() {
  const list = document.getElementById("cr-lista");

  const { data, error } = await supabase
    .from("cronograma")
    .select("*")
    .order("data_aula", { ascending: true });

  if (error) {
    list.innerHTML = `<p class="message error">${window.studyos.escapeHtml(error.message)}</p>`;
    return;
  }

  if (!data?.length) {
    list.innerHTML = `<div class="empty">Nenhuma aula cadastrada.</div>`;
    return;
  }

  list.innerHTML = data.map(item => `
    <article class="list-item">
      <div>
        <span class="badge">${window.studyos.formatDate(item.data_aula)}</span>
        <h3>${window.studyos.escapeHtml(item.tema)}</h3>
        <p>${window.studyos.escapeHtml(item.materia || "Sem matéria")}</p>
      </div>
      <button class="btn small ${item.concluido ? "secondary" : "primary"}"
              onclick="toggleClass('${item.id}', ${item.concluido})">
        ${item.concluido ? "Reabrir" : "Concluir"}
      </button>
    </article>
  `).join("");
}

async function toggleClass(id, current) {
  const { error } = await supabase
    .from("cronograma")
    .update({
      concluido: !current,
      concluido_em: !current ? new Date().toISOString() : null
    })
    .eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  await loadClasses();
}

window.toggleClass = toggleClass;
init();