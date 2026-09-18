const supabase = window.studyos.supabase;

function parseIntervals(value) {
  const arr = value
    .split(",")
    .map(v => Number(v.trim()))
    .filter(v => Number.isInteger(v) && v > 0);

  return [...new Set(arr)];
}

async function init() {
  const session = await window.studyos.requireAuth();
  if (!session) return;

  document.querySelector("[data-logout]").addEventListener("click", window.studyos.signOut);
  document.getElementById("cfg-salvar").addEventListener("click", saveSettings);

  await window.studyos.ensureDefaultSettings();
  await loadSettings();
}

async function loadSettings() {
  const { data, error } = await supabase
    .from("configuracoes_revisao")
    .select("tipo,intervalos");

  if (error) {
    document.getElementById("cfg-msg").textContent = error.message;
    return;
  }

  const map = Object.fromEntries((data || []).map(row => [row.tipo, row.intervalos]));

  document.getElementById("cfg-flashcard").value = (map.flashcard || [1,3,7,15,30]).join(",");
  document.getElementById("cfg-erros").value = (map.caderno_erros || [3,7,15,30]).join(",");
  document.getElementById("cfg-materia").value = (map.materia || [7,14,30]).join(",");
}

async function saveSettings() {
  const session = await window.studyos.getSession();
  const msg = document.getElementById("cfg-msg");

  const values = [
    ["flashcard", parseIntervals(document.getElementById("cfg-flashcard").value)],
    ["caderno_erros", parseIntervals(document.getElementById("cfg-erros").value)],
    ["materia", parseIntervals(document.getElementById("cfg-materia").value)]
  ];

  if (values.some(([, arr]) => !arr.length)) {
    msg.textContent = "Informe pelo menos um intervalo válido em cada campo.";
    msg.className = "message error";
    return;
  }

  const rows = values.map(([tipo, intervalos]) => ({
    user_id: session.user.id,
    tipo,
    intervalos
  }));

  const { error } = await supabase
    .from("configuracoes_revisao")
    .upsert(rows, { onConflict: "user_id,tipo" });

  if (error) {
    msg.textContent = error.message;
    msg.className = "message error";
    return;
  }

  msg.textContent = "Configurações salvas.";
  msg.className = "message success";
}

init();