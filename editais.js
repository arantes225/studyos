const supabase = window.studyos.supabase;

async function init() {
  const session = await window.studyos.requireAuth();
  if (!session) return;

  document.querySelector("[data-logout]").addEventListener("click", window.studyos.signOut);
  document.getElementById("ed-salvar").addEventListener("click", () => createExam(session.user.id));

  await loadExams();
}

async function createExam(userId) {
  const nome = document.getElementById("ed-nome").value.trim();
  const instituicao = document.getElementById("ed-instituicao").value.trim();
  const data = document.getElementById("ed-data").value;
  const msg = document.getElementById("ed-msg");

  if (!nome) {
    msg.textContent = "Informe o nome do edital.";
    msg.className = "message error";
    return;
  }

  const { error } = await supabase.from("editais").insert({
    user_id: userId,
    nome,
    instituicao: instituicao || null,
    data_prova: data || null,
    ativo: true
  });

  if (error) {
    msg.textContent = error.message;
    msg.className = "message error";
    return;
  }

  document.getElementById("ed-nome").value = "";
  document.getElementById("ed-instituicao").value = "";
  document.getElementById("ed-data").value = "";

  msg.textContent = "Edital salvo.";
  msg.className = "message success";

  await loadExams();
}

async function loadExams() {
  const list = document.getElementById("ed-lista");

  const { data, error } = await supabase
    .from("editais")
    .select("*")
    .order("data_prova", { ascending: true, nullsFirst: false });

  if (error) {
    list.innerHTML = `<p class="message error">${window.studyos.escapeHtml(error.message)}</p>`;
    return;
  }

  if (!data?.length) {
    list.innerHTML = `<div class="empty">Nenhum edital cadastrado.</div>`;
    return;
  }

  list.innerHTML = data.map(item => `
    <article class="list-item">
      <div>
        <h3>${window.studyos.escapeHtml(item.nome)}</h3>
        <p>${window.studyos.escapeHtml(item.instituicao || "")}</p>
      </div>
      <time>${item.data_prova ? window.studyos.formatDate(item.data_prova) : "Sem data"}</time>
    </article>
  `).join("");
}

init();