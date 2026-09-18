const sb = window.supabaseClient;

const PAGE_INFO = {
  dashboard: { title: "Dashboard", eyebrow: "Visão geral" },
  cronograma: { title: "Cronograma", eyebrow: "Aulas e temas" },
  ambientacao: { title: "Ambientação", eyebrow: "Estudar" },
  flashcards: { title: "Flashcards", eyebrow: "Estudar" },
  erros: { title: "Caderno de erros", eyebrow: "Estudar" },
  editais: { title: "Editais / Provas", eyebrow: "Planejamento" },
  configuracoes: { title: "Configurações", eyebrow: "Conta e preferências" }
};

const page = document.body.dataset.page || "dashboard";
let currentThemeSetting = "system";
let systemThemeListener = null;

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getProfileTitle(gender) {
  if (gender === "male") return "Dr.";
  if (gender === "female") return "Dra.";
  return "";
}

function sidebarMarkup(user, profile = null) {
  const fallbackName = user.email
    ? user.email.split("@")[0]
    : "Usuário";

  const rawName =
    profile?.display_name?.trim()
    || fallbackName;

  const specialty =
    profile?.specialty?.trim()
    || "Especialidade não definida";

  const title = getProfileTitle(profile?.gender);

  const sidebarName =
    title
      ? `${title} ${rawName}`
      : rawName;

  const initial =
    rawName.charAt(0).toUpperCase() || "U";

  return `
    <div class="sidebar-top">
      <a class="brand" href="dashboard.html">
        <span class="brand-mark">D</span>
        <span class="brand-copy">
          <strong>DocMap</strong>
          <small>Study workspace</small>
        </span>
      </a>
      <button class="sidebar-close" id="sidebar-close" type="button" aria-label="Fechar menu">×</button>
    </div>

    <nav class="nav">
      <a class="nav-link ${page === "dashboard" ? "active" : ""}" href="dashboard.html">
        <span class="nav-icon">◫</span><span>Dashboard</span>
      </a>

      <a class="nav-link ${page === "cronograma" ? "active" : ""}" href="cronograma.html">
        <span class="nav-icon">▦</span><span>Cronograma</span>
      </a>

      <div class="nav-group">
        <div class="nav-group-label">
          <span class="nav-icon">◉</span><span>Estudar</span>
        </div>

        <div class="nav-submenu">
          <a class="nav-sublink ${page === "ambientacao" ? "active" : ""}" href="ambientacao.html">Ambientação</a>
          <a class="nav-sublink ${page === "flashcards" ? "active" : ""}" href="flashcards.html">Flashcards</a>
          <a class="nav-sublink ${page === "erros" ? "active" : ""}" href="caderno-erros.html">Caderno de erros</a>
        </div>
      </div>

      <a class="nav-link ${page === "editais" ? "active" : ""}" href="editais.html">
        <span class="nav-icon">▤</span><span>Editais / Provas</span>
      </a>

      <a class="nav-link ${page === "configuracoes" ? "active" : ""}" href="configuracoes.html">
        <span class="nav-icon">⚙</span><span>Configurações</span>
      </a>
    </nav>

    <div class="sidebar-footer">
      <div class="streak-mini">
        <span>🔥</span>
        <div>
          <strong><span data-streak-value>—</span> dias</strong>
          <small>ofensiva atual</small>
        </div>
      </div>

      <div class="user-mini">
        <div class="user-avatar">${escapeHtml(initial)}</div>

        <div class="user-copy">
          <strong>${escapeHtml(sidebarName)}</strong>
          <small>${escapeHtml(specialty)}</small>
        </div>
      </div>

      <button id="logout" class="logout-button" type="button">Sair</button>
    </div>
  `;
}

async function carregarPerfil(userId) {
  const { data, error } = await sb
    .from("profiles")
    .select("display_name, gender, specialty")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Não foi possível carregar o perfil:", error.message);
    return null;
  }

  return data || null;
}

function applyResolvedTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

function stopSystemThemeListener() {
  if (systemThemeListener) {
    const { media, handler } = systemThemeListener;
    media.removeEventListener("change", handler);
    systemThemeListener = null;
  }
}

function applyThemeSetting(setting) {
  currentThemeSetting = setting || "system";
  stopSystemThemeListener();

  if (currentThemeSetting === "system") {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => applyResolvedTheme(media.matches ? "dark" : "light");
    apply();
    media.addEventListener("change", apply);
    systemThemeListener = { media, handler: apply };
    return;
  }

  applyResolvedTheme(currentThemeSetting);
}

async function carregarTema(userId) {
  const { data, error } = await sb
    .from("user_settings")
    .select("theme")
    .eq("user_id", userId)
    .single();

  if (!error && data?.theme) {
    applyThemeSetting(data.theme);
  } else {
    applyThemeSetting("system");
  }
}

async function salvarTema(theme) {
  const { data: sessionData } = await sb.auth.getSession();
  const userId = sessionData.session?.user?.id;

  if (!userId) return;

  const { error } = await sb
    .from("user_settings")
    .update({ theme })
    .eq("user_id", userId);

  if (error) throw error;

  applyThemeSetting(theme);
}

function prepararConfiguracoes() {
  const form = document.getElementById("theme-form");
  const status = document.getElementById("theme-status");

  if (!form) return;

  const radio = form.querySelector(`input[name="theme"][value="${currentThemeSetting}"]`);
  if (radio) radio.checked = true;

  form.addEventListener("change", async (event) => {
    if (event.target.name !== "theme") return;

    status.textContent = "Salvando...";

    try {
      await salvarTema(event.target.value);
      status.textContent = "Tema salvo.";
    } catch (error) {
      console.error(error);
      status.textContent = "Não foi possível salvar o tema.";
    }
  });
}

async function registrarAcessoDiario() {
  const { data, error } = await sb.rpc("register_daily_access");

  if (error) {
    console.warn("Não foi possível registrar acesso diário:", error.message);
    return;
  }

  const streak = Array.isArray(data) ? data[0] : data;
  if (!streak) return;

  document.querySelectorAll("[data-streak-value]").forEach((el) => {
    el.textContent = streak.current_streak ?? 0;
  });

  document.querySelectorAll("[data-longest-streak]").forEach((el) => {
    el.textContent = streak.longest_streak ?? 0;
  });
}

function prepararMobileMenu() {
  const open = document.getElementById("menu-open");
  const close = document.getElementById("sidebar-close");
  const backdrop = document.getElementById("sidebar-backdrop");

  const abrir = () => document.body.classList.add("sidebar-open");
  const fechar = () => document.body.classList.remove("sidebar-open");

  open?.addEventListener("click", abrir);
  close?.addEventListener("click", fechar);
  backdrop?.addEventListener("click", fechar);
}

async function iniciarApp() {
  const { data, error } = await sb.auth.getSession();

  if (error || !data.session) {
    window.location.replace("login.html");
    return;
  }

  const user = data.session.user;

  const [profile] = await Promise.all([
    carregarPerfil(user.id),
    carregarTema(user.id)
  ]);

  document.getElementById("sidebar").innerHTML =
    sidebarMarkup(user, profile);

  const info = PAGE_INFO[page] || PAGE_INFO.dashboard;

  document.querySelectorAll("[data-page-title]").forEach((el) => {
    el.textContent = info.title;
  });

  document.querySelectorAll("[data-page-eyebrow]").forEach((el) => {
    el.textContent = info.eyebrow;
  });

  document.getElementById("logout")?.addEventListener("click", async () => {
    await sb.auth.signOut();
    window.location.replace("login.html");
  });

  prepararMobileMenu();
  await registrarAcessoDiario();
  prepararConfiguracoes();

  document.body.classList.add("app-ready");

  window.docmapUser = user;
  window.docmapSession = data.session;
  window.docmapProfile = profile;

  window.dispatchEvent(
    new CustomEvent("docmap:ready", {
      detail: { user, session: data.session }
    })
  );
}

iniciarApp();
