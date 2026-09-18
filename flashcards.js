const flashSb = window.supabaseClient;

let flashUser = null;
let reviewQueue = [];
let reviewIndex = 0;
let importRows = [];
let libraryCards = [];

const REVIEW_GROWTH = { hard: 1.25, medium: 1.5, easy: 1.8 };

const flashPageParams =
  new URLSearchParams(
    window.location.search
  );

const flashAgendaDate =
  flashPageParams.get(
    "agenda_date"
  );


let flashSettings = {
  flashcard_intervals_hard: [1, 3, 7],
  flashcard_intervals_medium: [7, 21, 45],
  flashcard_intervals_easy: [15, 45, 70]
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayStartISO(offset = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString();
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function setStatus(id, text, type = "") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = `flash-status ${type}`.trim();
}

function truncate(text, max = 160) {
  const value = String(text ?? "");
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function formatDate(value) {
  if (!value) return "—";
  const [y, m, d] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(y, m - 1, d));
}

function setChip(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value || "";
  el.hidden = !value;
}

function switchTab(name) {
  document.querySelectorAll("[data-flash-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.flashTab === name);
  });

  document.querySelectorAll("[data-flash-section]").forEach((section) => {
    section.classList.toggle("active", section.dataset.flashSection === name);
  });

  if (name === "library") loadLibrary();
}

function prepareLibraryWithoutArchive() {
  const archivedFilter = document.getElementById("library-active");
  if (archivedFilter) archivedFilter.remove();

  const filters = document.querySelector('[data-flash-section="library"] .library-filters');
  if (filters) filters.style.gridTemplateColumns = "minmax(220px, 1fr) minmax(150px, .5fr)";

  const description = document.querySelector('[data-flash-section="library"] .panel-header p');
  if (description) description.textContent = "Pesquise todos os seus flashcards. Nenhum card é arquivado.";
}

async function loadSettings() {
  const { data, error } = await flashSb
    .from("user_settings")
    .select("flashcard_intervals_hard,flashcard_intervals_medium,flashcard_intervals_easy")
    .eq("user_id", flashUser.id)
    .maybeSingle();

  if (error) {
    console.warn("Intervalos não carregados:", error.message);
    return;
  }

  if (data) flashSettings = { ...flashSettings, ...data };
}

function nextInterval(card, rating) {
  const key = rating === "hard"
    ? "flashcard_intervals_hard"
    : rating === "medium"
      ? "flashcard_intervals_medium"
      : "flashcard_intervals_easy";

  const sequence = flashSettings[key] || [];
  const stage = Number(card?.review_count || 0) + 1;

  if (stage <= sequence.length) return Number(sequence[stage - 1]);

  const current = Math.max(1, Number(card?.current_interval_days || 1));
  return Math.min(3650, Math.max(current + 1, Math.round(current * REVIEW_GROWTH[rating])));
}

function updateRatingLabels(card) {
  ["hard", "medium", "easy"].forEach((rating) => {
    const el = document.querySelector(`[data-rating-days="${rating}"]`);
    if (!el) return;
    const days = nextInterval(card, rating);
    el.textContent = `≈ ${days} dia${days === 1 ? "" : "s"}`;
  });
}

async function loadMetrics() {
  const today = todayISO();
  const [due, overdue, reviews] = await Promise.all([
    flashSb.from("flashcards").select("id", { count: "exact", head: true }).lte("due_date", today),
    flashSb.from("flashcards").select("id", { count: "exact", head: true }).lt("due_date", today),
    flashSb.from("flashcard_reviews").select("was_correct").gte("reviewed_at", dayStartISO(0)).lt("reviewed_at", dayStartISO(1))
  ]);

  document.getElementById("metric-due").textContent = due.count ?? 0;
  document.getElementById("metric-overdue").textContent = overdue.count ?? 0;

  const rows = reviews.data || [];
  const correct = rows.filter((r) => r.was_correct === true).length;
  document.getElementById("metric-reviewed").textContent = rows.length;
  document.getElementById("metric-accuracy").textContent = rows.length ? `${Math.round((correct / rows.length) * 100)}%` : "—";
}

async function signedImage(path) {
  if (!path || typeof path !== "string" || !path.trim()) return null;
  const { data, error } = await flashSb.storage.from("docmap").createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl || null;
}

async function showImage(id, path) {
  const img = document.getElementById(id);
  if (!img) return;

  img.hidden = true;
  img.style.display = "none";
  img.removeAttribute("src");
  img.onload = null;
  img.onerror = null;

  if (!path || typeof path !== "string" || !path.trim()) return;
  const url = await signedImage(path);
  if (!url) return;

  img.onload = () => {
    img.hidden = false;
    img.style.display = "block";
  };

  img.onerror = () => {
    img.hidden = true;
    img.style.display = "none";
    img.removeAttribute("src");
  };

  img.src = url;
}

async function renderReview() {
  const empty = document.getElementById("review-empty");
  const stage = document.getElementById("review-stage");

  if (reviewIndex >= reviewQueue.length) {
    stage.hidden = true;
    empty.hidden = false;
    document.getElementById("review-position").textContent = reviewQueue.length ? `${reviewQueue.length} / ${reviewQueue.length}` : "0 / 0";
    document.getElementById("review-session-copy").textContent = reviewQueue.length ? "sessão concluída" : "nenhum card pendente";
    return;
  }

  empty.hidden = true;
  stage.hidden = false;

  const card = reviewQueue[reviewIndex];
  const remaining = reviewQueue.length - reviewIndex;

  document.getElementById("review-position").textContent = `${reviewIndex + 1} / ${reviewQueue.length}`;
  document.getElementById("review-session-copy").textContent = `${remaining} restante${remaining === 1 ? "" : "s"}`;

  setChip("review-area", card.area);
  setChip("review-materia", card.materia);
  setChip("review-theme", card.theme);

  document.getElementById("review-front").textContent = card.front_text;
  document.getElementById("review-back").textContent = card.back_text;
  document.getElementById("review-answer").hidden = true;
  document.getElementById("rating-actions").hidden = true;
  document.getElementById("show-answer").hidden = false;
  setStatus("review-status", "");
  updateRatingLabels(card);

  await Promise.all([
    showImage("review-front-image", card.front_image_path),
    showImage("review-back-image", card.back_image_path)
  ]);
}

async function loadReviewQueue() {
  let query =
    flashSb
      .from("flashcards")
      .select(
        "id,area,materia,theme,front_text,back_text,front_image_path,back_image_path,due_date,current_interval_days,review_count,created_at"
      );

  /*
    Quando os flashcards são abertos
    a partir da Agenda dentro da
    Ambientação, carregamos exatamente
    o lote daquela data.

    Na página normal de Flashcards,
    continua mostrando tudo que está
    vencido até hoje.
  */

  if (flashAgendaDate) {
    query =
      query.eq(
        "due_date",
        flashAgendaDate
      );

  } else {
    query =
      query.lte(
        "due_date",
        todayISO()
      );
  }

  const {
    data,
    error
  } =
    await query
      .order(
        "due_date",
        {
          ascending: true
        }
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      )
      .limit(250);

  if (error) {
    console.error(error);

    setStatus(
      "review-status",
      `Não foi possível carregar os cards: ${error.message}`,
      "error"
    );

    return;
  }

  reviewQueue =
    data || [];

  reviewIndex =
    0;

  await renderReview();
}

function wireReview() {
  document.getElementById("show-answer").addEventListener("click", () => {
    document.getElementById("review-answer").hidden = false;
    document.getElementById("rating-actions").hidden = false;
    document.getElementById("show-answer").hidden = true;
  });

  document.querySelectorAll("[data-rating]").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = reviewQueue[reviewIndex];
      if (!card) return;

      const rating = button.dataset.rating;
      document.querySelectorAll("[data-rating]").forEach((b) => b.disabled = true);
      setStatus("review-status", "Salvando revisão...");

      const { error } = await flashSb.rpc("review_flashcard", {
        p_flashcard_id: card.id,
        p_rating: rating,
        p_was_correct: rating !== "hard"
      });

      document.querySelectorAll("[data-rating]").forEach((b) => b.disabled = false);

      if (error) {
        console.error(error);
        setStatus("review-status", `Não foi possível salvar: ${error.message}`, "error");
        return;
      }

      reviewIndex += 1;
      await Promise.all([renderReview(), loadMetrics()]);
    });
  });
}

function safeBase(name) {
  return String(name || "imagem")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "imagem";
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível abrir a imagem."));
    img.src = dataUrl;
  });
}

function toWebp(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Falha na compressão.")), "image/webp", quality);
  });
}

async function compressImage(file) {
  if (!file || !file.type?.startsWith("image/")) return file;

  try {
    const source = await loadImage(await readAsDataUrl(file));
    const max = 1400;
    const scale = Math.min(1, max / source.width, max / source.height);
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);

    let blob = await toWebp(canvas, 0.72);
    if (blob.size > 650 * 1024) blob = await toWebp(canvas, 0.62);

    if (blob.size > 900 * 1024 && (width > 1050 || height > 1050)) {
      const smallScale = Math.min(1, 1050 / width, 1050 / height);
      const w = Math.max(1, Math.round(width * smallScale));
      const h = Math.max(1, Math.round(height * smallScale));
      const small = document.createElement("canvas");
      small.width = w;
      small.height = h;
      const smallCtx = small.getContext("2d", { alpha: false });
      smallCtx.fillStyle = "#ffffff";
      smallCtx.fillRect(0, 0, w, h);
      smallCtx.drawImage(canvas, 0, 0, w, h);
      blob = await toWebp(small, 0.60);
    }

    if (blob.size >= file.size) return file;

    return new File([blob], `${safeBase(file.name)}.webp`, {
      type: "image/webp",
      lastModified: Date.now()
    });
  } catch (error) {
    console.warn("Compressão falhou; usando original:", error);
    return file;
  }
}

async function uploadImage(file, side) {
  if (!file) return null;

  const finalFile = await compressImage(file);
  const name = finalFile.name || file.name || "imagem";
  const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "bin";
  const path = `${flashUser.id}/flashcards/${crypto.randomUUID()}-${side}-${safeBase(name)}.${extension}`;

  const { error } = await flashSb.storage.from("docmap").upload(path, finalFile, {
    cacheControl: "3600",
    upsert: false,
    contentType: finalFile.type || file.type || undefined
  });

  if (error) throw error;
  return path;
}

function clearCreate() {
  ["create-area", "create-materia", "create-theme", "create-front", "create-back"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  document.getElementById("create-front-image").value = "";
  document.getElementById("create-back-image").value = "";
  setStatus("create-status", "");
}

function wireCreate() {
  document.getElementById("clear-create-card").addEventListener("click", clearCreate);

  document.getElementById("create-card").addEventListener("click", async () => {
    const button = document.getElementById("create-card");
    const area = document.getElementById("create-area").value.trim();
    const materia = document.getElementById("create-materia").value.trim();
    const theme = document.getElementById("create-theme").value.trim();
    const front = document.getElementById("create-front").value.trim();
    const back = document.getElementById("create-back").value.trim();
    const frontFile = document.getElementById("create-front-image").files[0] || null;
    const backFile = document.getElementById("create-back-image").files[0] || null;

    if (!front || !back) {
      setStatus("create-status", "Preencha a frente e o verso.", "error");
      return;
    }

    button.disabled = true;
    setStatus("create-status", "Comprimindo imagens e criando flashcard...");
    const uploaded = [];

    try {
      const [frontPath, backPath] = await Promise.all([
        uploadImage(frontFile, "front"),
        uploadImage(backFile, "back")
      ]);

      if (frontPath) uploaded.push(frontPath);
      if (backPath) uploaded.push(backPath);

      const { error } = await flashSb.rpc("create_flashcard_v2", {
        p_area: area || null,
        p_materia: materia || null,
        p_theme: theme || null,
        p_front_text: front,
        p_back_text: back,
        p_front_image_path: frontPath,
        p_back_image_path: backPath
      });

      if (error) throw error;

      clearCreate();
      setStatus("create-status", "Flashcard criado.", "success");
      await Promise.all([loadMetrics(), loadReviewQueue()]);
    } catch (error) {
      console.error(error);
      if (uploaded.length) await flashSb.storage.from("docmap").remove(uploaded);
      setStatus("create-status", `Não foi possível criar: ${error.message}`, "error");
    } finally {
      button.disabled = false;
    }
  });
}

function rowValue(row, aliases) {
  for (const [key, value] of Object.entries(row)) {
    if (aliases.includes(normalizeHeader(key))) return String(value ?? "").trim();
  }
  return "";
}

function normalizeRow(row) {
  return {
    area: rowValue(row, ["area"]),
    materia: rowValue(row, ["materia", "disciplina"]),
    theme: rowValue(row, ["tema", "theme", "assunto"]),
    front_text: rowValue(row, ["frente", "front", "pergunta", "questao"]),
    back_text: rowValue(row, ["verso", "back", "resposta", "answer"])
  };
}

function renderImportPreview() {
  const valid = importRows.filter((r) => r.front_text && r.back_text);
  const invalid = importRows.length - valid.length;
  const summary = document.getElementById("import-summary");

  summary.hidden = false;
  summary.textContent = `${valid.length} card${valid.length === 1 ? "" : "s"} válido${valid.length === 1 ? "" : "s"}`
    + (invalid ? ` · ${invalid} linha${invalid === 1 ? "" : "s"} ignorada${invalid === 1 ? "" : "s"}` : "");

  const wrap = document.getElementById("import-preview-wrap");
  const body = document.getElementById("import-preview-body");
  document.getElementById("import-cards").disabled = !valid.length;

  if (!valid.length) {
    wrap.hidden = true;
    body.innerHTML = "";
    return;
  }

  wrap.hidden = false;
  body.innerHTML = valid.slice(0, 8).map((r) => `
    <tr>
      <td>${esc(r.area || "—")}</td>
      <td>${esc(r.materia || "—")}</td>
      <td>${esc(r.theme || "—")}</td>
      <td>${esc(truncate(r.front_text, 100))}</td>
      <td>${esc(truncate(r.back_text, 100))}</td>
    </tr>
  `).join("");
}

function wireImport() {
  document.getElementById("import-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    importRows = [];
    document.getElementById("import-cards").disabled = true;
    document.getElementById("import-summary").hidden = true;
    document.getElementById("import-preview-wrap").hidden = true;
    setStatus("import-status", "");
    if (!file) return;

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      importRows = XLSX.utils.sheet_to_json(sheet, { defval: "" }).map(normalizeRow);
      renderImportPreview();
    } catch (error) {
      console.error(error);
      setStatus("import-status", "Não foi possível ler esse arquivo.", "error");
    }
  });

  document.getElementById("import-cards").addEventListener("click", async () => {
    const valid = importRows.filter((r) => r.front_text && r.back_text);
    if (!valid.length) return;

    const button = document.getElementById("import-cards");
    const file = document.getElementById("import-file").files[0];
    button.disabled = true;
    setStatus("import-status", "Importando...");

    const { data: entry, error: entryError } = await flashSb
      .from("flashcard_imports")
      .insert({
        user_id: flashUser.id,
        source_type: "excel",
        file_name: file?.name || null,
        status: "processing"
      })
      .select("id")
      .single();

    if (entryError) {
      setStatus("import-status", entryError.message, "error");
      button.disabled = false;
      return;
    }

    const { data: created, error } = await flashSb.rpc("bulk_create_flashcards", {
      p_cards: valid,
      p_import_id: entry.id
    });

    if (error) {
      setStatus("import-status", `Importação falhou: ${error.message}`, "error");
      button.disabled = false;
      return;
    }

    setStatus("import-status", `${created} flashcard${created === 1 ? "" : "s"} importado${created === 1 ? "" : "s"}.`, "success");
    document.getElementById("import-file").value = "";
    importRows = [];
    document.getElementById("import-summary").hidden = true;
    document.getElementById("import-preview-wrap").hidden = true;
    await Promise.all([loadMetrics(), loadReviewQueue()]);
  });
}

function populateAreas() {
  const select = document.getElementById("library-area");
  const current = select.value;
  const areas = [...new Set(libraryCards.map((c) => c.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  select.innerHTML = `<option value="">Todas as áreas</option>` + areas.map((area) => `<option value="${esc(area)}">${esc(area)}</option>`).join("");
  if (areas.includes(current)) select.value = current;
}

function filteredLibrary() {
  const search = document.getElementById("library-search").value.trim().toLowerCase();
  const area = document.getElementById("library-area").value;

  return libraryCards.filter((card) => {
    if (area && card.area !== area) return false;
    if (!search) return true;
    return [card.area, card.materia, card.theme, card.front_text, card.back_text]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
}

function renderLibrary() {
  const cards = filteredLibrary();
  const list = document.getElementById("library-list");
  const empty = document.getElementById("library-empty");
  document.getElementById("library-count").textContent = `${cards.length} card${cards.length === 1 ? "" : "s"}`;

  if (!cards.length) {
    list.innerHTML = "";
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  list.innerHTML = cards.map((card) => `
    <article class="library-card" style="grid-template-columns:1fr">
      <div class="library-card-main">
        <div class="library-card-taxonomy">
          ${card.area ? `<span class="taxonomy-chip">${esc(card.area)}</span>` : ""}
          ${card.materia ? `<span class="taxonomy-chip">${esc(card.materia)}</span>` : ""}
          ${card.theme ? `<span class="taxonomy-chip accent">${esc(card.theme)}</span>` : ""}
        </div>
        <div class="library-card-front">${esc(truncate(card.front_text, 220))}</div>
        <div class="library-card-back">${esc(truncate(card.back_text, 220))}</div>
        <div class="library-card-meta">
          <span>Próxima: ${formatDate(card.due_date)}</span>
          <span>Intervalo: ${Number(card.current_interval_days || 1)} dia${Number(card.current_interval_days || 1) === 1 ? "" : "s"}</span>
          <span>${card.review_count || 0} revisão${Number(card.review_count || 0) === 1 ? "" : "ões"}</span>
        </div>
      </div>
    </article>
  `).join("");
}

async function loadLibrary() {
  const { data, error } = await flashSb
    .from("flashcards")
    .select("id,area,materia,theme,front_text,back_text,due_date,current_interval_days,review_count,created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error(error);
    return;
  }

  libraryCards = data || [];
  populateAreas();
  renderLibrary();
}

function wireLibrary() {
  document.getElementById("library-search").addEventListener("input", renderLibrary);
  document.getElementById("library-area").addEventListener("change", renderLibrary);
}

async function initFlashcards() {
  flashUser = window.docmapUser;
  prepareLibraryWithoutArchive();

  if (flashAgendaDate) {
    const reviewTitle =
      document.querySelector(
        '[data-flash-section="review"] .panel-header h2'
      );

    const reviewCopy =
      document.querySelector(
        '[data-flash-section="review"] .panel-header p'
      );

    if (reviewTitle) {
      reviewTitle.textContent =
        "Flashcards agendados";
    }

    if (reviewCopy) {
      reviewCopy.textContent =
        `Revisão de ${formatDate(flashAgendaDate)}.`;
    }
  }

  document.querySelectorAll("[data-flash-tab]").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.flashTab));
  });

  wireReview();
  wireCreate();
  wireImport();
  wireLibrary();
  await loadSettings();
  await Promise.all([loadMetrics(), loadReviewQueue()]);
}

if (window.docmapUser) {
  initFlashcards();
} else {
  window.addEventListener("docmap:ready", initFlashcards, { once: true });
}
