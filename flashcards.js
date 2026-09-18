const supabase = window.studyos.supabase;

let reviewQueue = [];
let currentCard = null;

async function init() {
  const session = await window.studyos.requireAuth();
  if (!session) return;

  document.querySelector("[data-logout]").addEventListener("click", window.studyos.signOut);
  document.getElementById("fc-salvar").addEventListener("click", () => createFlashcard(session.user.id));

  await window.studyos.ensureDefaultSettings();
  await Promise.all([loadFlashcards(), loadReviewQueue()]);
}

async function uploadImage(userId, file) {
  if (!file) return null;

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/flashcards/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("studyos")
    .upload(path, file, { upsert: false });

  if (error) throw error;
  return path;
}

async function signedImageUrl(path) {
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from("studyos")
    .createSignedUrl(path, 3600);

  if (error) return null;
  return data.signedUrl;
}

async function createFlashcard(userId) {
  const message = document.getElementById("fc-mensagem");
  const area = document.getElementById("fc-area").value.trim();
  const frente = document.getElementById("fc-frente").value.trim();
  const verso = document.getElementById("fc-verso").value.trim();
  const file = document.getElementById("fc-imagem").files[0];

  if (!frente || !verso) {
    message.textContent = "Preencha a frente e o verso.";
    message.className = "message error";
    return;
  }

  try {
    message.textContent = "Salvando...";
    message.className = "message";

    const imagePath = await uploadImage(userId, file);

    const { error } = await supabase.from("flashcards").insert({
      user_id: userId,
      frente,
      verso,
      imagem_url: imagePath,
      area: area || null,
      etapa_revisao: 0,
      numero_revisoes: 0,
      proxima_revisao: window.studyos.todayISO(),
      ativo: true
    });

    if (error) throw error;

    document.getElementById("fc-area").value = "";
    document.getElementById("fc-frente").value = "";
    document.getElementById("fc-verso").value = "";
    document.getElementById("fc-imagem").value = "";

    message.textContent = "Flashcard salvo.";
    message.className = "message success";

    await Promise.all([loadFlashcards(), loadReviewQueue()]);
  } catch (error) {
    message.textContent = error.message;
    message.className = "message error";
  }
}

async function loadFlashcards() {
  const list = document.getElementById("flashcards-list");

  const { data, error } = await supabase
    .from("flashcards")
    .select("*")
    .eq("ativo", true)
    .order("created_at", { ascending: false });

  if (error) {
    list.innerHTML = `<p class="message error">${window.studyos.escapeHtml(error.message)}</p>`;
    return;
  }

  if (!data?.length) {
    list.innerHTML = `<div class="empty">Nenhum flashcard criado ainda.</div>`;
    return;
  }

  const rows = await Promise.all(data.map(async card => {
    const url = await signedImageUrl(card.imagem_url);
    return `
      <article class="list-item">
        <div class="grow">
          <div class="list-meta">
            ${card.area ? `<span class="badge">${window.studyos.escapeHtml(card.area)}</span>` : ""}
            <span class="badge">${window.studyos.formatDate(card.proxima_revisao)}</span>
          </div>
          <h3>${window.studyos.escapeHtml(card.frente)}</h3>
          <p>${window.studyos.escapeHtml(card.verso)}</p>
          ${url ? `<img class="content-image" src="${url}" alt="Imagem do flashcard">` : ""}
        </div>
        <button class="btn small danger-outline" onclick="deleteFlashcard('${card.id}')">Excluir</button>
      </article>
    `;
  }));

  list.innerHTML = rows.join("");
}

async function deleteFlashcard(id) {
  if (!confirm("Excluir este flashcard?")) return;

  const { error } = await supabase
    .from("flashcards")
    .delete()
    .eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  await Promise.all([loadFlashcards(), loadReviewQueue()]);
}

window.deleteFlashcard = deleteFlashcard;

async function loadReviewQueue() {
  const today = window.studyos.todayISO();

  const { data, error } = await supabase
    .from("flashcards")
    .select("*")
    .eq("ativo", true)
    .lte("proxima_revisao", today)
    .order("proxima_revisao", { ascending: true });

  if (error) {
    document.getElementById("review-card").innerHTML =
      `<p class="message error">${window.studyos.escapeHtml(error.message)}</p>`;
    return;
  }

  reviewQueue = data || [];
  currentCard = reviewQueue[0] || null;

  document.getElementById("review-count").textContent =
    `${reviewQueue.length} para revisar`;

  await renderReviewCard();
}

async function renderReviewCard() {
  const el = document.getElementById("review-card");

  if (!currentCard) {
    el.innerHTML = `<div class="empty">Nenhum flashcard pendente agora.</div>`;
    return;
  }

  const url = await signedImageUrl(currentCard.imagem_url);

  el.innerHTML = `
    <div id="review-front">
      ${currentCard.area ? `<span class="badge">${window.studyos.escapeHtml(currentCard.area)}</span>` : ""}
      <h2>${window.studyos.escapeHtml(currentCard.frente)}</h2>
      ${url ? `<img class="content-image" src="${url}" alt="Imagem do flashcard">` : ""}
      <button class="btn primary" id="show-answer">Mostrar resposta</button>
    </div>

    <div id="review-back" hidden>
      <p class="eyebrow">Resposta</p>
      <div class="answer-box">${window.studyos.escapeHtml(currentCard.verso)}</div>
      <button class="btn primary" id="finish-review">Concluir revisão</button>
    </div>
  `;

  document.getElementById("show-answer").addEventListener("click", () => {
    document.getElementById("review-front").hidden = true;
    document.getElementById("review-back").hidden = false;
  });

  document.getElementById("finish-review").addEventListener("click", finishReview);
}

async function finishReview() {
  const { error } = await supabase.rpc("revisar_flashcard", {
    p_flashcard_id: currentCard.id
  });

  if (error) {
    alert(error.message);
    return;
  }

  await Promise.all([loadFlashcards(), loadReviewQueue()]);
}

init();