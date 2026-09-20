(() => {
  "use strict";

  const sb = window.supabaseClient;
  if (!sb) return;

  const richState = {
    editId: null,
    editExistingPaths: [],
    editRemovedPaths: new Set()
  };

  const ARROWS = {
    right: "→",
    left: "←",
    both: "↔",
    down: "↓",
    up: "↑"
  };

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function qs(id) {
    return document.getElementById(id);
  }

  function setStatus(id, text, type = "") {
    const el = qs(id);
    if (!el) return;
    el.textContent = text || "";
    el.className = `error-rich-status ${type}`.trim();
  }

  function rowsToTableData(rows, hasHeader = true) {
    const cleaned = (rows || [])
      .map(row => (row || []).map(cell => String(cell ?? "").trim()))
      .filter(row => row.some(Boolean));

    if (!cleaned.length) return null;

    const width = Math.max(...cleaned.map(row => row.length));
    const normalized = cleaned.map(row => [
      ...row,
      ...Array(Math.max(0, width - row.length)).fill("")
    ]);

    return { has_header: Boolean(hasHeader), rows: normalized };
  }

  function normalizeTableData(value) {
    if (!value || typeof value !== "object" || !Array.isArray(value.rows)) return null;
    return rowsToTableData(value.rows, value.has_header !== false);
  }

  function renderTableEditor(containerId, data = null) {
    const container = qs(containerId);
    if (!container) return;

    const table = normalizeTableData(data);
    if (!table) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = `
      <table data-rich-table>
        <tbody>
          ${table.rows.map((row, rowIndex) => `
            <tr>
              ${row.map(cell => {
                const tag = table.has_header && rowIndex === 0 ? "th" : "td";
                return `<${tag} contenteditable="true">${esc(cell)}</${tag}>`;
              }).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function readTableEditor(containerId) {
    const container = qs(containerId);
    const table = container?.querySelector("table[data-rich-table]");
    if (!table) return null;

    const rows = Array.from(table.rows).map(row =>
      Array.from(row.cells).map(cell => cell.innerText.trim())
    );

    return rowsToTableData(rows, true);
  }

  function tableDimensions(containerId) {
    const table = qs(containerId)?.querySelector("table[data-rich-table]");
    return {
      rows: table?.rows?.length || 0,
      cols: table?.rows?.[0]?.cells?.length || 0
    };
  }

  function addTableRow(containerId) {
    const table = qs(containerId)?.querySelector("table[data-rich-table]");
    if (!table) {
      renderTableEditor(containerId, {
        has_header: true,
        rows: [["Coluna 1", "Coluna 2", "Coluna 3"], ["", "", ""]]
      });
      return;
    }

    const cols = table.rows[0]?.cells?.length || 1;
    const row = table.insertRow();
    for (let i = 0; i < cols; i++) {
      const cell = row.insertCell();
      cell.contentEditable = "true";
    }
  }

  function addTableCol(containerId) {
    const table = qs(containerId)?.querySelector("table[data-rich-table]");
    if (!table) {
      renderTableEditor(containerId, {
        has_header: true,
        rows: [["Coluna 1", "Coluna 2"], ["", ""]]
      });
      return;
    }

    Array.from(table.rows).forEach((row, index) => {
      const cell = index === 0
        ? document.createElement("th")
        : document.createElement("td");

      cell.contentEditable = "true";
      if (index === 0) cell.textContent = `Coluna ${row.cells.length + 1}`;
      row.appendChild(cell);
    });
  }

  function removeTableRow(containerId) {
    const table = qs(containerId)?.querySelector("table[data-rich-table]");
    if (!table) return;
    if (table.rows.length <= 1) {
      qs(containerId).innerHTML = "";
      return;
    }
    table.deleteRow(table.rows.length - 1);
  }

  function removeTableCol(containerId) {
    const table = qs(containerId)?.querySelector("table[data-rich-table]");
    if (!table) return;

    const cols = table.rows[0]?.cells?.length || 0;
    if (cols <= 1) {
      qs(containerId).innerHTML = "";
      return;
    }

    Array.from(table.rows).forEach(row => row.deleteCell(cols - 1));
  }

  function clearTable(containerId) {
    const el = qs(containerId);
    if (el) el.innerHTML = "";
  }

  function arrowRowHtml(item = {}) {
    const direction = item.direction || "right";
    return `
      <div class="rich-arrow-row" data-rich-arrow-row>
        <input type="text" data-arrow-from placeholder="Origem" value="${esc(item.from_text || "")}">
        <select data-arrow-direction>
          ${Object.entries(ARROWS).map(([key, symbol]) => `
            <option value="${key}" ${direction === key ? "selected" : ""}>${symbol}</option>
          `).join("")}
        </select>
        <input type="text" data-arrow-to placeholder="Destino" value="${esc(item.to_text || "")}">
        <input type="text" data-arrow-label placeholder="Legenda (opcional)" value="${esc(item.label || "")}">
        <button type="button" data-remove-arrow aria-label="Remover seta">×</button>
      </div>
    `;
  }

  function addArrow(listId, item = {}) {
    const list = qs(listId);
    if (!list) return;
    list.insertAdjacentHTML("beforeend", arrowRowHtml(item));
  }

  function readArrows(listId) {
    return Array.from(qs(listId)?.querySelectorAll("[data-rich-arrow-row]") || [])
      .map(row => ({
        from_text: row.querySelector("[data-arrow-from]")?.value.trim() || "",
        direction: row.querySelector("[data-arrow-direction]")?.value || "right",
        to_text: row.querySelector("[data-arrow-to]")?.value.trim() || "",
        label: row.querySelector("[data-arrow-label]")?.value.trim() || ""
      }))
      .filter(item => item.from_text || item.to_text || item.label);
  }

  function renderArrowEditor(listId, items = []) {
    const list = qs(listId);
    if (!list) return;
    list.innerHTML = "";
    (Array.isArray(items) ? items : []).forEach(item => addArrow(listId, item));
  }

  async function compressImage(file) {
    if (!file || !file.type?.startsWith("image/")) return file;
    if (file.size <= 130 * 1024) return file;

    try {
      const bitmap = await createImageBitmap(file);
      const maxDimension = 1100;
      const scale = Math.min(1, maxDimension / bitmap.width, maxDimension / bitmap.height);
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, width, height);

      bitmap.close?.();

      let best = file;

      for (const quality of [0.82, 0.74, 0.66, 0.58]) {
        const blob = await new Promise(resolve =>
          canvas.toBlob(resolve, "image/webp", quality)
        );

        if (!blob) continue;
        if (blob.size < best.size) best = blob;
        if (blob.size <= 110 * 1024) break;
      }

      if (best === file) return file;

      return new File(
        [best],
        `${String(file.name || "imagem").replace(/\.[^.]+$/, "")}.webp`,
        { type: "image/webp", lastModified: Date.now() }
      );
    } catch (error) {
      console.warn("Falha ao comprimir imagem:", error);
      return file;
    }
  }

  async function uploadImage(file) {
    if (!file) return null;

    const user = window.docmapUser;
    if (!user?.id) throw new Error("Usuário não autenticado.");

    const finalFile = await compressImage(file);
    const ext = finalFile.type === "image/webp"
      ? "webp"
      : (finalFile.name?.split(".").pop()?.toLowerCase() || "bin");

    const path = `${user.id}/errors/${crypto.randomUUID()}.${ext}`;

    const { error } = await sb.storage
      .from("docmap")
      .upload(path, finalFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: finalFile.type || undefined
      });

    if (error) throw error;
    return path;
  }

  async function signedUrl(path) {
    if (!path) return null;
    const { data, error } = await sb.storage
      .from("docmap")
      .createSignedUrl(path, 3600);

    return error ? null : data?.signedUrl || null;
  }

  function uniqueImagePaths(row) {
    const list = Array.isArray(row?.image_paths) ? row.image_paths : [];
    const merged = [row?.question_image_path, ...list].filter(Boolean);
    return [...new Set(merged)].slice(0, 2);
  }

  async function renderGallery(paths, className = "error-rich-gallery") {
    const urls = [];

    for (const path of paths) {
      const url = await signedUrl(path);
      if (url) urls.push({ path, url });
    }

    if (!urls.length) return "";

    return `
      <div class="${className}">
        ${urls.map((item, index) => `
          <figure>
            <img src="${esc(item.url)}" alt="Imagem ${index + 1} do Caderno">
          </figure>
        `).join("")}
      </div>
    `;
  }

  function renderStructuredTable(tableData) {
    const table = normalizeTableData(tableData);
    if (!table) return "";

    return `
      <div class="error-rich-table-wrap">
        <table class="error-rich-render-table">
          <tbody>
            ${table.rows.map((row, rowIndex) => `
              <tr>
                ${row.map(cell => {
                  const tag = table.has_header && rowIndex === 0 ? "th" : "td";
                  return `<${tag}>${esc(cell)}</${tag}>`;
                }).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderArrows(items) {
    if (!Array.isArray(items) || !items.length) return "";

    return `
      <div class="error-rich-arrow-render">
        ${items.map(item => `
          <div class="error-rich-arrow-card">
            <strong>${esc(item.from_text || "—")}</strong>
            <span class="arrow-symbol">${esc(ARROWS[item.direction] || "→")}</span>
            <strong>${esc(item.to_text || "—")}</strong>
            ${item.label ? `<small>${esc(item.label)}</small>` : ""}
          </div>
        `).join("")}
      </div>
    `;
  }

  async function loadRichRow(id) {
    const { data, error } = await sb
      .from("error_notebook")
      .select("id,question_image_path,image_paths,table_data,arrows_data")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  window.renderRichErrorContent = async function renderRichErrorContent(item) {
    const container = qs("error-rich-content");
    if (!container || !item?.id) return;

    try {
      const row = await loadRichRow(item.id);
      if (!row) {
        container.innerHTML = "";
        return;
      }

      const paths = uniqueImagePaths(row);
      const html = [
        await renderGallery(paths),
        renderStructuredTable(row.table_data),
        renderArrows(row.arrows_data)
      ].filter(Boolean).join("");

      container.innerHTML = html;

      if (paths.length) {
        const legacy = qs("error-question-image");
        if (legacy) {
          legacy.hidden = true;
          legacy.style.display = "none";
        }
      }
    } catch (error) {
      console.warn("Não foi possível renderizar conteúdo rico:", error);
      container.innerHTML = "";
    }
  };

  async function hydrateLibraryItem(id, details) {
    if (!id || !details) return;

    let holder = details.querySelector("[data-rich-library-content]");
    if (!holder) {
      holder = document.createElement("div");
      holder.dataset.richLibraryContent = id;
      holder.className = "error-rich-content";
      details.appendChild(holder);
    }

    try {
      const row = await loadRichRow(id);
      if (!row) return;

      holder.innerHTML = [
        await renderGallery(uniqueImagePaths(row)),
        renderStructuredTable(row.table_data),
        renderArrows(row.arrows_data)
      ].filter(Boolean).join("");
    } catch (error) {
      console.warn(error);
    }
  }

  async function fileToAnalysisCanvas(file) {
    const bitmap = await createImageBitmap(file);
    const max = 1800;
    const scale = Math.min(1, max / bitmap.width, max / bitmap.height);

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    return canvas;
  }

  function clusterIndices(indices, gap = 3) {
    if (!indices.length) return [];

    const clusters = [];
    let current = [indices[0]];

    for (let i = 1; i < indices.length; i++) {
      if (indices[i] - indices[i - 1] <= gap) {
        current.push(indices[i]);
      } else {
        clusters.push(current);
        current = [indices[i]];
      }
    }

    clusters.push(current);
    return clusters.map(group => Math.round(mean(group)));
  }

  function mean(values) {
    const nums = values.map(Number).filter(Number.isFinite);
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  }

  function detectGridLines(canvas) {
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;

    const rowScore = new Uint32Array(height);
    const colScore = new Uint32Array(width);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const gray = .299 * data[i] + .587 * data[i + 1] + .114 * data[i + 2];

        if (gray < 165) {
          rowScore[y]++;
          colScore[x]++;
        }
      }
    }

    const horizontal = [];
    const vertical = [];

    for (let y = 0; y < height; y++) {
      if (rowScore[y] / width >= .38) horizontal.push(y);
    }

    for (let x = 0; x < width; x++) {
      if (colScore[x] / height >= .38) vertical.push(x);
    }

    let h = clusterIndices(horizontal, 4);
    let v = clusterIndices(vertical, 4);

    if (h.length >= 2) {
      if (h[0] > 12) h.unshift(0);
      if (h[h.length - 1] < height - 12) h.push(height - 1);
    }

    if (v.length >= 2) {
      if (v[0] > 12) v.unshift(0);
      if (v[v.length - 1] < width - 12) v.push(width - 1);
    }

    return { horizontal: h, vertical: v };
  }

  async function ocrCanvas(worker, canvas) {
    const { data } = await worker.recognize(canvas);
    return String(data?.text || "")
      .replace(/\r/g, "")
      .replace(/\n+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  async function recognizeTableFromImage(file, onProgress) {
    if (!window.Tesseract) {
      throw new Error("O leitor OCR não carregou. Atualize a página.");
    }

    const canvas = await fileToAnalysisCanvas(file);
    const grid = detectGridLines(canvas);

    const worker = await window.Tesseract.createWorker("por", 1, {
      logger: msg => {
        if (msg.status === "recognizing text" && typeof onProgress === "function") {
          onProgress(Math.round(Number(msg.progress || 0) * 100), "OCR");
        }
      }
    });

    try {
      const rows = grid.horizontal.length - 1;
      const cols = grid.vertical.length - 1;

      if (rows >= 1 && cols >= 2 && rows <= 15 && cols <= 8 && rows * cols <= 64) {
        const result = [];
        let done = 0;
        const total = rows * cols;

        for (let r = 0; r < rows; r++) {
          const row = [];

          for (let c = 0; c < cols; c++) {
            const x1 = Math.max(0, grid.vertical[c] + 2);
            const x2 = Math.min(canvas.width, grid.vertical[c + 1] - 2);
            const y1 = Math.max(0, grid.horizontal[r] + 2);
            const y2 = Math.min(canvas.height, grid.horizontal[r + 1] - 2);

            const w = Math.max(1, x2 - x1);
            const h = Math.max(1, y2 - y1);

            const cell = document.createElement("canvas");
            cell.width = w;
            cell.height = h;
            cell.getContext("2d").drawImage(canvas, x1, y1, w, h, 0, 0, w, h);

            row.push(await ocrCanvas(worker, cell));

            done++;
            if (typeof onProgress === "function") {
              onProgress(Math.round(done / total * 100), `Célula ${done}/${total}`);
            }
          }

          result.push(row);
        }

        return rowsToTableData(result, true);
      }

      // Fallback: lê a imagem inteira. Se houver pipes/tabs/espaços largos,
      // tenta reconstruir as colunas. Caso contrário, entrega uma coluna editável.
      const { data } = await worker.recognize(canvas);
      const lines = String(data?.text || "")
        .replace(/\r/g, "")
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean);

      if (!lines.length) {
        throw new Error("Não foi possível identificar texto legível.");
      }

      const parsed = lines.map(line => {
        const byPipe = line.split(/\s*\|\s*/).filter(Boolean);
        if (byPipe.length > 1) return byPipe;

        const byTab = line.split(/\t+/).filter(Boolean);
        if (byTab.length > 1) return byTab;

        const bySpaces = line.split(/\s{2,}/).filter(Boolean);
        if (bySpaces.length > 1) return bySpaces;

        return [line];
      });

      return rowsToTableData(parsed, true);
    } finally {
      await worker.terminate();
    }
  }

  function getNewImageFiles() {
    return [
      qs("new-error-image")?.files?.[0] || null,
      qs("new-error-image-2")?.files?.[0] || null
    ].filter(Boolean).slice(0, 2);
  }

  async function readNewTableFromImage() {
    const source = qs("new-table-image-source")?.value || "1";
    const file = source === "2"
      ? qs("new-error-image-2")?.files?.[0]
      : qs("new-error-image")?.files?.[0];

    if (!file) {
      setStatus("new-table-status", `Selecione a imagem ${source} primeiro.`, "error");
      return;
    }

    const button = qs("new-table-from-image");
    if (button) button.disabled = true;

    try {
      setStatus("new-table-status", "Analisando linhas e colunas...");
      const table = await recognizeTableFromImage(file, (progress, label) => {
        setStatus("new-table-status", `${label}: ${progress}%...`);
      });

      renderTableEditor("new-table-editor", table);
      setStatus(
        "new-table-status",
        `Tabela reconhecida: ${table.rows.length} linhas × ${table.rows[0]?.length || 0} colunas. Revise antes de salvar.`,
        "success"
      );
    } catch (error) {
      console.error(error);
      setStatus("new-table-status", error.message || "Não foi possível reconhecer a tabela.", "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function removeStoragePaths(paths) {
    const clean = [...new Set((paths || []).filter(Boolean))];
    if (!clean.length) return;

    const { error } = await sb.storage.from("docmap").remove(clean);
    if (error) console.warn("Não foi possível remover arquivo(s):", error.message);
  }

  async function saveNewRichError(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const button = qs("save-new-error");
    const ccq = qs("new-error-ccq")?.value.trim() || "";

    if (!ccq) {
      window.setNewErrorStatus?.("Preencha o CCQ.", "error");
      return;
    }

    const files = getNewImageFiles();
    const tableData = readTableEditor("new-table-editor");
    const arrows = readArrows("new-arrow-list");

    const payload = {
      user_id: window.docmapUser?.id,
      area: qs("new-error-area")?.value.trim() || null,
      materia: qs("new-error-materia")?.value.trim() || null,
      theme: qs("new-error-theme")?.value.trim() || null,
      ccq,
      question_text: qs("new-error-question")?.value.trim() || null,
      correct_answer: qs("new-error-answer")?.value.trim() || "—",
      what_i_thought: qs("new-error-thought")?.value.trim() || null,
      table_data: tableData,
      arrows_data: arrows,
      image_paths: []
    };

    if (!payload.question_text && !files.length && !tableData && !arrows.length) {
      window.setNewErrorStatus?.(
        "Adicione texto de questão, imagem, tabela ou seta/fluxo.",
        "error"
      );
      return;
    }

    if (button) button.disabled = true;
    window.setNewErrorStatus?.("Salvando conteúdo do Caderno...");

    const uploaded = [];

    try {
      for (const file of files) {
        const path = await uploadImage(file);
        if (path) uploaded.push(path);
      }

      payload.image_paths = uploaded;
      payload.question_image_path = uploaded[0] || null;

      const { error } = await sb
        .from("error_notebook")
        .insert(payload);

      if (error) {
        if (/table_data|arrows_data|image_paths/i.test(error.message || "")) {
          throw new Error(
            "As novas colunas ainda não existem no banco. Rode fase14_caderno_conteudo_rico.sql no Supabase."
          );
        }
        throw error;
      }

      window.clearNewErrorForm?.();
      clearRichNewForm();
      window.setNewErrorStatus?.("Erro adicionado ao Caderno.", "success");

      await Promise.all([
        window.loadErrorMetrics?.(),
        window.loadErrorAreas?.(),
        window.loadErrorLibrary?.(),
        window.loadErrorQueue?.()
      ]);
    } catch (error) {
      console.error(error);
      await removeStoragePaths(uploaded);
      window.setNewErrorStatus?.(`Não foi possível salvar: ${error.message}`, "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function clearRichNewForm() {
    const image2 = qs("new-error-image-2");
    if (image2) image2.value = "";

    clearTable("new-table-editor");
    renderArrowEditor("new-arrow-list", []);
    setStatus("new-table-status", "");
    setStatus("new-error-image-2-info", "");
  }

  async function renderEditGallery() {
    const el = qs("error-rich-edit-gallery");
    if (!el) return;

    const kept = richState.editExistingPaths
      .filter(path => !richState.editRemovedPaths.has(path))
      .slice(0, 2);

    if (!kept.length) {
      el.innerHTML = '<div class="error-rich-status">Nenhuma imagem mantida.</div>';
      return;
    }

    const parts = [];

    for (const path of kept) {
      const url = await signedUrl(path);
      if (!url) continue;

      parts.push(`
        <div class="error-rich-edit-image" data-edit-image-path="${esc(path)}">
          <img src="${esc(url)}" alt="Imagem do Caderno">
          <button type="button" data-remove-edit-image="${esc(path)}" aria-label="Remover imagem">×</button>
        </div>
      `);
    }

    el.innerHTML = parts.join("");
  }

  async function loadRichEdit(id) {
    if (!id) return;

    richState.editId = id;
    richState.editRemovedPaths.clear();

    try {
      const { data, error } = await sb
        .from("error_notebook")
        .select("id,question_image_path,image_paths,table_data,arrows_data")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return;

      richState.editExistingPaths = uniqueImagePaths(data);
      await renderEditGallery();

      renderTableEditor("edit-table-editor", data.table_data);
      renderArrowEditor("edit-arrow-list", data.arrows_data || []);

      const input = qs("error-rich-edit-images");
      if (input) input.value = "";
      setStatus("error-rich-edit-status", "");
    } catch (error) {
      console.error(error);
      setStatus("error-rich-edit-status", error.message || "Não foi possível carregar o conteúdo visual.", "error");
    }
  }

  async function saveRichEdit(event) {
    if (!richState.editId) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const button = qs("error-edit-save");
    if (button) button.disabled = true;

    setStatus("error-rich-edit-status", "Salvando alterações...");

    const kept = richState.editExistingPaths
      .filter(path => !richState.editRemovedPaths.has(path));

    const newFiles = Array.from(qs("error-rich-edit-images")?.files || []);
    if (kept.length + newFiles.length > 2) {
      setStatus("error-rich-edit-status", "O limite é de 2 imagens por item.", "error");
      if (button) button.disabled = false;
      return;
    }

    const uploaded = [];

    try {
      for (const file of newFiles) {
        const path = await uploadImage(file);
        if (path) uploaded.push(path);
      }

      const finalPaths = [...kept, ...uploaded].slice(0, 2);
      const tableData = readTableEditor("edit-table-editor");
      const arrows = readArrows("edit-arrow-list");

      const ccq = qs("error-edit-ccq")?.value.trim() || "";
      if (!ccq) throw new Error("Preencha o CCQ.");

      const questionText = qs("error-edit-question")?.value.trim() || null;

      if (!questionText && !finalPaths.length && !tableData && !arrows.length) {
        throw new Error("Mantenha texto, imagem, tabela ou seta/fluxo no item.");
      }

      const update = {
        area: qs("error-edit-area")?.value.trim() || null,
        materia: qs("error-edit-materia")?.value.trim() || null,
        theme: qs("error-edit-theme")?.value.trim() || null,
        ccq,
        question_text: questionText,
        correct_answer: qs("error-edit-answer")?.value.trim() || "—",
        what_i_thought: qs("error-edit-thought")?.value.trim() || null,
        question_image_path: finalPaths[0] || null,
        image_paths: finalPaths,
        table_data: tableData,
        arrows_data: arrows
      };

      const { error } = await sb
        .from("error_notebook")
        .update(update)
        .eq("id", richState.editId);

      if (error) throw error;

      await removeStoragePaths([...richState.editRemovedPaths]);

      window.closeErrorEditDialog?.();

      await Promise.all([
        window.loadErrorMetrics?.(),
        window.loadErrorLibrary?.(),
        window.loadErrorQueue?.()
      ]);

      setStatus("error-rich-edit-status", "");
    } catch (error) {
      console.error(error);
      await removeStoragePaths(uploaded);
      setStatus("error-rich-edit-status", error.message || "Não foi possível salvar.", "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function bindTableToolbar(prefix) {
    qs(`${prefix}-table-new`)?.addEventListener("click", () => {
      renderTableEditor(`${prefix}-table-editor`, {
        has_header: true,
        rows: [
          ["Coluna 1", "Coluna 2", "Coluna 3"],
          ["", "", ""],
          ["", "", ""]
        ]
      });
    });

    qs(`${prefix}-table-add-row`)?.addEventListener("click", () => addTableRow(`${prefix}-table-editor`));
    qs(`${prefix}-table-add-col`)?.addEventListener("click", () => addTableCol(`${prefix}-table-editor`));
    qs(`${prefix}-table-remove-row`)?.addEventListener("click", () => removeTableRow(`${prefix}-table-editor`));
    qs(`${prefix}-table-remove-col`)?.addEventListener("click", () => removeTableCol(`${prefix}-table-editor`));
    qs(`${prefix}-table-clear`)?.addEventListener("click", () => clearTable(`${prefix}-table-editor`));
  }

  function wire() {
    bindTableToolbar("new");
    bindTableToolbar("edit");

    qs("new-table-from-image")?.addEventListener("click", readNewTableFromImage);
    qs("new-arrow-add")?.addEventListener("click", () => addArrow("new-arrow-list"));
    qs("edit-arrow-add")?.addEventListener("click", () => addArrow("edit-arrow-list"));

    qs("remove-new-error-image-2")?.addEventListener("click", () => {
      const input = qs("new-error-image-2");
      if (input) input.value = "";
      setStatus("new-error-image-2-info", "Imagem 2 removida.");
    });

    qs("new-error-image-2")?.addEventListener("change", event => {
      const file = event.target.files?.[0];
      setStatus(
        "new-error-image-2-info",
        file ? `${file.name} · pronta para salvar` : "",
        file ? "success" : ""
      );
    });

    document.addEventListener("click", event => {
      const removeArrow = event.target.closest("[data-remove-arrow]");
      if (removeArrow) {
        removeArrow.closest("[data-rich-arrow-row]")?.remove();
      }

      const open = event.target.closest("[data-library-open]");
      if (open) {
        const id = open.dataset.libraryOpen;
        setTimeout(() => {
          const details = document.querySelector(
            `[data-library-details="${CSS.escape(id)}"]`
          );
          if (details && !details.hidden) hydrateLibraryItem(id, details);
        }, 0);
      }

      const editLibrary = event.target.closest("[data-error-library-edit]");
      if (editLibrary) {
        setTimeout(() => loadRichEdit(editLibrary.dataset.errorLibraryEdit), 0);
      }

      if (event.target.closest("#error-review-edit")) {
        setTimeout(async () => {
          if (window.__currentErrorRichId) {
            loadRichEdit(window.__currentErrorRichId);
            return;
          }

          const ccq = qs("error-ccq")?.textContent?.trim();
          if (!ccq) return;

          const { data } = await sb
            .from("error_notebook")
            .select("id")
            .eq("ccq", ccq)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (data?.id) loadRichEdit(data.id);
        }, 0);
      }

      const removeEdit = event.target.closest("[data-remove-edit-image]");
      if (removeEdit) {
        richState.editRemovedPaths.add(removeEdit.dataset.removeEditImage);
        renderEditGallery();
      }

      if (event.target.closest("#cancel-new-error")) {
        clearRichNewForm();
      }
    });

    // Captura antes dos listeners antigos.
    qs("save-new-error")?.addEventListener("click", saveNewRichError, true);
    qs("error-edit-save")?.addEventListener("click", saveRichEdit, true);

    qs("error-rich-edit-images")?.addEventListener("change", event => {
      const files = Array.from(event.target.files || []);
      const kept = richState.editExistingPaths.filter(
        path => !richState.editRemovedPaths.has(path)
      );

      if (files.length + kept.length > 2) {
        event.target.value = "";
        setStatus("error-rich-edit-status", "Você pode manter no máximo 2 imagens.", "error");
      } else {
        setStatus("error-rich-edit-status", files.length ? `${files.length} nova(s) imagem(ns) selecionada(s).` : "");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire, { once: true });
  } else {
    wire();
  }
})();
