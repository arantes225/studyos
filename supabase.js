const SUPABASE_URL = "https://ietitoxjojsdiuridrfk.supabase.co";
const SUPABASE_KEY = "sb_publishable_4q_xxpp87T5OCPIrkszEng_mLSLGAhP";

window.studyos = {};

window.studyos.supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

window.studyos.getSession = async function () {
  const { data, error } = await window.studyos.supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};

window.studyos.requireAuth = async function () {
  const session = await window.studyos.getSession();

  if (!session) {
    window.location.href = "login.html";
    return null;
  }

  return session;
};

window.studyos.signOut = async function () {
  await window.studyos.supabase.auth.signOut();
  window.location.href = "login.html";
};

window.studyos.ensureDefaultSettings = async function () {
  const { error } = await window.studyos.supabase.rpc("criar_configuracoes_padrao");

  if (error) {
    console.warn("Não foi possível criar configurações padrão:", error.message);
  }
};

window.studyos.todayISO = function () {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

window.studyos.formatDate = function (dateString) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
};

window.studyos.escapeHtml = function (value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};