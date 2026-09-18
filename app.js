const sb = window.supabaseClient;

const PAGE_INFO = {
  dashboard: { title: "Dashboard", eyebrow: "Visão geral" },
  cronograma: { title: "Cronograma", eyebrow: "Aulas e temas" },
  ambientacao: { title: "Ambientação", eyebrow: "Estudar" },
  flashcards: { title: "Flashcards", eyebrow: "Estudar" },
  erros: { title: "Caderno de erros", eyebrow: "Estudar" },
  questoes: { title: "Questões e Simulados", eyebrow: "Estudar" },
  estatisticas: { title: "Estatísticas", eyebrow: "Desempenho" },
  editais: { title: "Editais / Provas", eyebrow: "Planejamento" },
  configuracoes: { title: "Configurações", eyebrow: "Conta e preferências" }
};

const page = document.body.dataset.page || "dashboard";
let currentThemeSetting = "system";
let systemThemeListener = null;

function profileCacheKey(userId) {
  return `docmap:profile:${userId}`;
}

function themeCacheKey(userId) {
  return `docmap:theme:${userId}`;
}

function readLocalJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function writeLocalJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function readCachedProfile(userId) {
  return readLocalJson(profileCacheKey(userId));
}

function writeCachedProfile(userId, profile) {
  if (!profile) return;
  writeLocalJson(profileCacheKey(userId), profile);
}

function readCachedTheme(userId) {
  try {
    return localStorage.getItem(themeCacheKey(userId));
  } catch {
    return null;
  }
}

function writeCachedTheme(userId, theme) {
  try {
    localStorage.setItem(themeCacheKey(userId), theme);
  } catch {}
}

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
        <span class="brand-logo-stack" aria-hidden="true">
          <img
            class="brand-logo brand-logo-light"
            src="logo-icone-original.png"
            alt=""
          >
          <img
            class="brand-logo brand-logo-dark"
            src="logo-icone-azul-claro.png"
            alt=""
          >
          <img
            class="brand-logo brand-logo-pink"
            src="logo-icone-rosa-escuro.png"
            alt=""
          >
        </span>

        <span class="brand-copy">
          <strong>Resibulando</strong>
          <small>Mapa até a residência</small>
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
          <a class="nav-sublink ${page === "questoes" ? "active" : ""}" href="questoes-simulados.html">Questões e Simulados</a>
        </div>
      </div>

      <a class="nav-link ${page === "estatisticas" ? "active" : ""}" href="estatisticas.html">
        <span class="nav-icon">▥</span><span>Estatísticas</span>
      </a>

      <a class="nav-link ${page === "editais" ? "active" : ""}" href="editais.html">
        <span class="nav-icon">▤</span><span>Editais / Provas</span>
      </a>

      <a class="nav-link ${page === "configuracoes" ? "active" : ""}" href="configuracoes.html">
        <span class="nav-icon">⚙</span><span>Configurações</span>
      </a>
    </nav>

    <div class="sidebar-footer">
      <div class="sidebar-lofi" data-lofi-shell>
        <div class="sidebar-lofi-head">
          <button
            class="sidebar-lofi-toggle"
            type="button"
            data-lofi-toggle
            aria-label="Tocar lo-fi"
          >
            ▶
          </button>

          <div class="sidebar-lofi-copy">
            <strong data-lofi-title>Lofi 1</strong>
            <small data-lofi-status>carregando...</small>
          </div>
        </div>

        <select
          class="sidebar-lofi-select"
          data-lofi-select
          aria-label="Escolher som ambiente"
        >
          <option value="">Carregando sons...</option>
        </select>

        <div class="sidebar-lofi-volume">
          <span>♫</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value="0.45"
            data-lofi-volume
            aria-label="Volume do som ambiente"
          >
        </div>
      </div>

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
  const cached = readCachedProfile(userId);

  const { data, error } = await sb
    .from("profiles")
    .select("display_name, gender, specialty")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Não foi possível carregar o perfil:", error.message);
    return cached || null;
  }

  if (data) {
    writeCachedProfile(userId, data);
    return data;
  }

  return cached || null;
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
  const cachedTheme = readCachedTheme(userId);

  if (cachedTheme) {
    applyThemeSetting(cachedTheme);
  }

  const { data, error } = await sb
    .from("user_settings")
    .select("theme")
    .eq("user_id", userId)
    .maybeSingle();

  if (!error && data?.theme) {
    writeCachedTheme(userId, data.theme);
    applyThemeSetting(data.theme);
    return data.theme;
  }

  if (!cachedTheme) {
    applyThemeSetting("system");
  }

  return cachedTheme || "system";
}

async function salvarTema(theme) {
  const { data: sessionData } = await sb.auth.getSession();
  const userId = sessionData.session?.user?.id;

  if (!userId) {
    throw new Error("Usuário não autenticado.");
  }

  const { data, error } = await sb
    .from("user_settings")
    .upsert(
      {
        user_id: userId,
        theme
      },
      {
        onConflict: "user_id"
      }
    )
    .select("theme")
    .single();

  if (error) throw error;

  const savedTheme = data?.theme || theme;

  writeCachedTheme(userId, savedTheme);
  applyThemeSetting(savedTheme);
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


function lofiStateKey(userId) {
  return `docmap:lofi:${userId}`;
}

function readLofiState(userId) {
  return readLocalJson(lofiStateKey(userId)) || {};
}

function writeLofiState(userId, state) {
  writeLocalJson(
    lofiStateKey(userId),
    state
  );
}

function formatAudioTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, "0");

  return `${minutes}:${rest}`;
}

async function carregarAudioTracks() {
  const { data, error } = await sb
    .from("app_audio_tracks")
    .select(
      "id,title,storage_bucket,storage_path,loop_enabled,active,sort_order"
    )
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn(
      "Não foi possível carregar os sons do Resibulando:",
      error.message
    );
    return [];
  }

  return data || [];
}

async function carregarAudioPreferido(userId) {
  const { data, error } = await sb
    .from("user_settings")
    .select("preferred_audio_track_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn(
      "Não foi possível carregar o som preferido:",
      error.message
    );
    return null;
  }

  return data?.preferred_audio_track_id || null;
}

async function salvarAudioPreferido(userId, trackId) {
  const { error } = await sb
    .from("user_settings")
    .upsert(
      {
        user_id: userId,
        preferred_audio_track_id: trackId
      },
      {
        onConflict: "user_id"
      }
    );

  if (error) {
    console.warn(
      "Não foi possível salvar o som preferido:",
      error.message
    );
  }
}

function updateLofiControls(manager) {
  const audio = manager.audio;

  document.querySelectorAll("[data-lofi-title]").forEach((el) => {
    el.textContent =
      manager.track?.title || "Lofi 1";
  });

  document.querySelectorAll("[data-lofi-status]").forEach((el) => {
    if (manager.error) {
      el.textContent = "áudio indisponível";
      return;
    }

    if (!manager.ready) {
      el.textContent = "carregando...";
      return;
    }

    el.textContent =
      audio.paused
        ? "pausado · loop"
        : "tocando · loop";
  });

  document.querySelectorAll("[data-lofi-toggle]").forEach((button) => {
    button.textContent =
      audio.paused ? "▶" : "❚❚";

    button.setAttribute(
      "aria-label",
      audio.paused
        ? "Tocar lo-fi"
        : "Pausar lo-fi"
    );

    button.disabled =
      !manager.track || Boolean(manager.error);
  });

  document.querySelectorAll("[data-lofi-select]").forEach((select) => {
    const currentValue = select.value;

    select.innerHTML = manager.tracks.length
      ? manager.tracks.map((track) => `
          <option value="${track.id}">
            ${track.title}
          </option>
        `).join("")
      : '<option value="">Nenhum som disponível</option>';

    if (manager.track?.id) {
      select.value = manager.track.id;
    } else if (currentValue) {
      select.value = currentValue;
    }

    select.disabled =
      !manager.tracks.length || Boolean(manager.error);
  });

  document.querySelectorAll("[data-lofi-volume]").forEach((input) => {
    if (document.activeElement !== input) {
      input.value = String(audio.volume);
    }
  });

  document.querySelectorAll("[data-lofi-current]").forEach((el) => {
    el.textContent =
      formatAudioTime(audio.currentTime);
  });

  document.querySelectorAll("[data-lofi-duration]").forEach((el) => {
    el.textContent =
      formatAudioTime(audio.duration);
  });

  document.querySelectorAll("[data-lofi-progress]").forEach((input) => {
    input.max =
      Number.isFinite(audio.duration)
        ? String(audio.duration)
        : "0";

    if (document.activeElement !== input) {
      input.value =
        Number.isFinite(audio.currentTime)
          ? String(audio.currentTime)
          : "0";
    }

    input.disabled =
      !manager.ready
      || !Number.isFinite(audio.duration);
  });
}


async function trocarFaixaLofi(manager, trackId) {
  const nextTrack =
    manager.tracks.find(
      (track) => track.id === trackId
    );

  if (!nextTrack) return;

  const wasPlaying =
    !manager.audio.paused;

  manager.track = nextTrack;
  manager.ready = false;
  manager.error = null;

  manager.audio.pause();
  manager.audio.currentTime = 0;
  manager.audio.loop =
    nextTrack.loop_enabled !== false;

  const publicUrl =
    sb.storage
      .from(nextTrack.storage_bucket)
      .getPublicUrl(nextTrack.storage_path)
      .data
      .publicUrl;

  manager.audio.src = publicUrl;
  manager.audio.load();

  writeLofiState(
    manager.userId,
    {
      ...readLofiState(manager.userId),
      trackId: nextTrack.id,
      currentTime: 0,
      volume: manager.audio.volume
    }
  );

  salvarAudioPreferido(
    manager.userId,
    nextTrack.id
  );

  updateLofiControls(manager);

  if (wasPlaying) {
    try {
      await manager.audio.play();
    } catch (error) {
      console.warn(
        "O navegador bloqueou a reprodução após trocar de faixa:",
        error
      );
    }
  }
}

function bindLofiControls(manager) {
  document.querySelectorAll("[data-lofi-select]").forEach((select) => {
    if (select.dataset.lofiBound === "1") return;
    select.dataset.lofiBound = "1";

    select.addEventListener("change", () => {
      trocarFaixaLofi(
        manager,
        select.value
      );
    });
  });

  document.querySelectorAll("[data-lofi-toggle]").forEach((button) => {
    if (button.dataset.lofiBound === "1") return;
    button.dataset.lofiBound = "1";

    button.addEventListener("click", async () => {
      if (!manager.track || manager.error) return;

      try {
        if (manager.audio.paused) {
          await manager.audio.play();
        } else {
          manager.audio.pause();
        }
      } catch (error) {
        console.warn(
          "O navegador bloqueou a reprodução do áudio:",
          error
        );
      }
    });
  });

  document.querySelectorAll("[data-lofi-volume]").forEach((input) => {
    if (input.dataset.lofiBound === "1") return;
    input.dataset.lofiBound = "1";

    input.addEventListener("input", () => {
      const volume =
        Math.max(
          0,
          Math.min(
            1,
            Number(input.value)
          )
        );

      manager.audio.volume = volume;

      writeLofiState(
        manager.userId,
        {
          ...readLofiState(manager.userId),
          volume,
          currentTime:
            manager.audio.currentTime || 0
        }
      );

      updateLofiControls(manager);
    });
  });

  document.querySelectorAll("[data-lofi-progress]").forEach((input) => {
    if (input.dataset.lofiBound === "1") return;
    input.dataset.lofiBound = "1";

    input.addEventListener("input", () => {
      if (!manager.ready) return;

      const target =
        Number(input.value);

      if (Number.isFinite(target)) {
        manager.audio.currentTime = target;
      }
    });
  });

  updateLofiControls(manager);
}

async function iniciarLofiGlobal(userId) {
  const [tracks, preferredFromDb] =
    await Promise.all([
      carregarAudioTracks(),
      carregarAudioPreferido(userId)
    ]);

  const saved =
    readLofiState(userId);

  const preferredId =
    saved.trackId
    || preferredFromDb
    || tracks[0]?.id
    || null;

  const track =
    tracks.find(
      (item) => item.id === preferredId
    )
    || tracks[0]
    || null;

  const manager = {
    userId,
    tracks,
    track,
    audio: new Audio(),
    ready: false,
    error: null,
    lastSavedSecond: -1
  };

  window.docmapAudio = manager;

  manager.audio.preload = "metadata";
  manager.audio.volume =
    Number.isFinite(Number(saved.volume))
      ? Math.max(
          0,
          Math.min(
            1,
            Number(saved.volume)
          )
        )
      : 0.45;

  manager.audio.loop =
    track?.loop_enabled !== false;

  if (!track) {
    manager.error =
      "Nenhuma faixa configurada.";
    bindLofiControls(manager);

    window.dispatchEvent(
      new CustomEvent(
        "docmap:audio-ready",
        { detail: manager }
      )
    );

    return manager;
  }

  writeLofiState(
    userId,
    {
      ...saved,
      trackId: track.id
    }
  );

  const publicUrl =
    sb.storage
      .from(track.storage_bucket)
      .getPublicUrl(track.storage_path)
      .data
      .publicUrl;

  manager.audio.src = publicUrl;

  manager.audio.addEventListener(
    "loadedmetadata",
    () => {
      manager.ready = true;

      const savedTime =
        saved.trackId === manager.track?.id
          ? Number(saved.currentTime || 0)
          : 0;

      if (
        Number.isFinite(savedTime)
        && savedTime > 0
        && savedTime < manager.audio.duration
      ) {
        manager.audio.currentTime =
          savedTime;
      }

      updateLofiControls(manager);
    }
  );

  manager.audio.addEventListener(
    "play",
    () => updateLofiControls(manager)
  );

  manager.audio.addEventListener(
    "pause",
    () => {
      writeLofiState(
        userId,
        {
          trackId: manager.track?.id || null,
          volume: manager.audio.volume,
          currentTime:
            manager.audio.currentTime || 0
        }
      );

      updateLofiControls(manager);
    }
  );

  manager.audio.addEventListener(
    "timeupdate",
    () => {
      const second =
        Math.floor(
          manager.audio.currentTime || 0
        );

      if (
        second !== manager.lastSavedSecond
        && second % 5 === 0
      ) {
        manager.lastSavedSecond = second;

        writeLofiState(
          userId,
          {
            volume: manager.audio.volume,
            currentTime:
              manager.audio.currentTime || 0
          }
        );
      }

      updateLofiControls(manager);
    }
  );

  manager.audio.addEventListener(
    "volumechange",
    () => updateLofiControls(manager)
  );

  manager.audio.addEventListener(
    "error",
    () => {
      manager.error =
        "Arquivo de áudio não encontrado.";
      manager.ready = false;

      updateLofiControls(manager);
    }
  );

  window.addEventListener(
    "pagehide",
    () => {
      writeLofiState(
        userId,
        {
          trackId: manager.track?.id || null,
          volume: manager.audio.volume,
          currentTime:
            manager.audio.currentTime || 0
        }
      );
    }
  );

  bindLofiControls(manager);

  window.dispatchEvent(
    new CustomEvent(
      "docmap:audio-ready",
      { detail: manager }
    )
  );

  return manager;
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

  const cachedTheme = readCachedTheme(user.id);
  if (cachedTheme) {
    applyThemeSetting(cachedTheme);
  }

  const [profile] = await Promise.all([
    carregarPerfil(user.id),
    carregarTema(user.id)
  ]);

  document.getElementById("sidebar").innerHTML =
    sidebarMarkup(user, profile);

  iniciarLofiGlobal(user.id).catch((error) => {
    console.warn(
      "Não foi possível iniciar o player de lo-fi:",
      error
    );
  });

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
