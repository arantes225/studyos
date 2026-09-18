const supabase = window.studyos.supabase;

async function init() {
  const session = await window.studyos.requireAuth();
  if (!session) return;

  document.querySelector("[data-logout]").addEventListener("click", window.studyos.signOut);
  document.getElementById("ce-salvar").addEventListener("click", () => createErrorItem(session.user.id));

  await window.studyos.ensureDefaultSettings();
  await loadItems();
}

async function createErrorItem(userId) {
  const materia = document.getElementById("ce-materia").value.trim();
  const tema = document.getElementById("ce-tema").value.trim();
  const pergunta = document.getElementById("ce-pergunta").value.trim();
  const resposta = document.getElementById("ce-resposta").value.trim();
  const comentario = document.getElementById("ce-comentario").value.trim();
  const msg = document.getElementById("ce-msg");

  if (!pergunta) {
    msg.textContent = "Preencha a questão ou descrição do erro.";
    msg.className = "message error";
    return;
  }

  const { error } = await supabase.from("caderno_erros").insert({
    user_id: userId,
    materia: materia || null,
    tema: tema || null,
    pergunta,
    resposta: resposta || null,
    comentario: comentario || null,
    proxima_revisao: window.studyos.todayISO(),
    etapa_revisao: 0,
    numero_revisoes: 0,
    ativo: true
  });

  if (error) {
    msg.textContent = error.message;
    msg.className = "message error";
    return;
  }

  ["ce-materia","ce-tema","ce-pergunta","ce-resposta","ce-comentario"].forEach(id => {
    document.getElementById(id).value = "";
  });

  msg.textContent = "Item salvo.";
  msg.className = "message success";

  await loadItems();
}

async function loadItems() {
  const list = document.getElementById("ce-lista");

  const { data, error } = await supabase
    .from("caderno_erros")
    .select("*")
    .eq("ativo", true)
    .order("created_at", { ascending: false });

  if (error) {
    list.innerHTML = `<p class="message error">${window.studyos.escapeHtml(error.message)}</p>`;
    return;
  }

  if (!data?.length) {
    list.innerHTML = `<div class="empty">Nenhum item no caderno de erros.</div>`;
    return;
  }

  list.innerHTML = data.map(item => `
    <article class="list-item">
      <div class="grow">
        <div class="list-meta">
          ${item.materia ? `<span class="badge">${window.studyos.escapeHtml(item.materia)}</span>` : ""}
          <span class="badge">${window.studyos.formatDate(item.proxima_revisao)}</span>
        </div>
        <h3>${window.studyos.escapeHtml(item.pergunta)}</h3>
        ${item.resposta ? `<p><strong>Resposta:</strong> ${window.studyos.escapeHtml(item.resposta)}</p>` : ""}
      </div>
      <button class="btn small primary" onclick="reviewError('${item.id}')">Revisado</button>
    </article>
  `).join("");
}

async function reviewError(id) {
  const { error } = await supabase.rpc("revisar_erro", { p_erro_id: id });

  if (error) {
    alert(error.message);
    return;
  }

  await loadItems();
}

window.reviewError = reviewError;
init();