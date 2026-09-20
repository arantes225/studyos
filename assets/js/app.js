const sb = window.supabaseClient;

const PAGE_INFO = {
  dashboard: { title: "Dashboard", eyebrow: "Visão geral" },
  cronograma: { title: "Cronograma", eyebrow: "Aulas e temas" },
  ambientacao: { title: "Ambientação", eyebrow: "Estudar" },
  caderno: { title: "Caderno", eyebrow: "Estudar" },
  flashcards: { title: "Flashcards", eyebrow: "Estudar" },
  erros: { title: "Caderno de erros", eyebrow: "Estudar" },
  questoes: { title: "Questões e Simulados", eyebrow: "Estudar" },
  estatisticas: { title: "Estatísticas", eyebrow: "Desempenho" },
  editais: { title: "Editais / Provas", eyebrow: "Planejamento" },
  configuracoes: { title: "Configurações", eyebrow: "Conta e preferências" },
  admin: { title: "Admin", eyebrow: "Métricas do produto" }
};


const PAGE_FEATURES = {
  dashboard: "dashboard",
  cronograma: "cronograma",
  ambientacao: "ambientacao",
  caderno: "caderno",
  flashcards: "flashcards",
  erros: "error_notebook",
  questoes: "questions",
  estatisticas: "advanced_statistics"
};

const PLUS_NAV_FEATURES = {
  "/flashcards/": "flashcards",
  "/questoes-simulados/": "questions",
  "/registrar-questoes/": "questions",
  "/estatisticas/": "advanced_statistics"
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
      <a class="brand" href="/dashboard/">
        <img
          id="luria-brand-logo"
          class="brand-logo-single"
          src="assets/img/logo-icone-original.png?v=luria7"
          alt="Logo LURIA"
        >

        <span class="brand-copy">
          <strong>LURIA</strong>
          <small>Aprenda. Conecte. Consolide.</small>
        </span>
      </a>
      <div class="sidebar-top-actions">
        <button class="sidebar-close" id="sidebar-close" type="button" aria-label="Fechar menu">×</button>
      </div>
    </div>

    <nav class="nav">
      <a class="nav-link ${page === "dashboard" ? "active" : ""}" href="/dashboard/">
        <span class="nav-icon">◫</span><span>Dashboard</span>
      </a>

      <a class="nav-link ${page === "cronograma" ? "active" : ""}" href="/cronograma/">
        <span class="nav-icon">▦</span><span>Cronograma</span>
      </a>

      <div class="nav-group" id="study-nav-group">
        <button class="nav-group-label" id="study-nav-toggle" type="button" aria-expanded="true" aria-controls="study-nav-submenu">
          <span class="nav-icon">◉</span>
          <span class="nav-label-text">Estudar</span>
          <span class="nav-group-chevron" aria-hidden="true">⌄</span>
        </button>

        <div class="nav-submenu" id="study-nav-submenu">
          <a class="nav-sublink ${page === "ambientacao" ? "active" : ""}" href="/ambientacao/">Ambientação</a>
          <a class="nav-sublink ${page === "caderno" ? "active" : ""}" href="/caderno/">Caderno</a>
          <a class="nav-sublink ${page === "flashcards" ? "active" : ""}" href="/flashcards/">Flashcards</a>
          <a class="nav-sublink ${page === "erros" ? "active" : ""}" href="/caderno-erros/">Caderno de erros</a>
          <a class="nav-sublink ${page === "questoes" ? "active" : ""}" href="/questoes-simulados/">Questões e Simulados</a>
        </div>
      </div>

      <a class="nav-link ${page === "estatisticas" ? "active" : ""}" href="/estatisticas/">
        <span class="nav-icon">▥</span><span>Estatísticas</span>
      </a>

      <a class="nav-link ${page === "editais" ? "active" : ""}" href="/editais/">
        <span class="nav-icon">▤</span><span>Editais / Provas</span>
      </a>

      <a class="nav-link ${page === "configuracoes" ? "active" : ""}" href="/configuracoes/">
        <span class="nav-icon">⚙</span><span>Configurações</span>
      </a>

      <a
        id="admin-nav-link"
        class="nav-link ${page === "admin" ? "active" : ""}"
        href="/admin/"
        hidden
      >
        <span class="nav-icon">◆</span><span>Admin</span>
      </a>
    </nav>

    <div class="sidebar-footer">
      <div class="streak-mini" data-sidebar-streak-card>
        <div class="streak-mini-icon" aria-hidden="true">
          <span class="streak-mini-snow">❄</span>

          <svg class="streak-mini-flame" viewBox="0 0 64 80" role="presentation">
            <path
              fill="currentColor"
              d="M34 3C35 15 26 19 26 29C26 35 30 38 33 40C27 40 22 35 21 29C13 37 8 46 8 56C8 69 18 77 32 77C46 77 56 68 56 54C56 41 48 30 40 22C39 30 36 34 32 36C35 27 43 18 34 3Z"
            ></path>
            <path
              class="streak-mini-core"
              d="M33 40C27 47 23 52 23 59C23 67 27 71 33 71C40 71 44 66 44 59C44 52 39 47 35 43C35 48 33 51 30 53C31 48 34 45 33 40Z"
            ></path>
          </svg>
        </div>

        <div class="streak-mini-copy">
          <strong data-sidebar-streak-copy><span data-streak-value>—</span> dias</strong>
          <small data-sidebar-streak-status>Comece hoje</small>
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

function updateLuriaLogo(theme) {
  const logo =
    document.getElementById(
      "luria-brand-logo"
    );

  if (!logo) {
    return;
  }

  let source =
    "assets/img/logo-icone-original.png?v=luria7";

  if (theme === "dark") {
    source =
      "assets/img/logo-icone-azul-claro.png?v=luria2";
  }

  if (theme === "leila-mood") {
    source =
      "assets/img/logo-icone-rosa-escuro.png?v=luria2";
  }

  if (
    logo.getAttribute("src")
    !== source
  ) {
    logo.setAttribute(
      "src",
      source
    );
  }
}


function applyResolvedTheme(theme) {
  document.documentElement.dataset.theme =
    theme;

  updateLuriaLogo(
    theme
  );
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
      "Não foi possível carregar os sons do LURIA:",
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

  const currentDays =
    Number(
      streak.current_streak
      ?? 0
    );

  let status =
    "Esquentando";

  let tier =
    "snow";

  if (currentDays >= 4 && currentDays < 7) {
    status = "Aquecendo";
    tier = "1";
  } else if (currentDays >= 7 && currentDays < 30) {
    status = "Em ritmo";
    tier = "2";
  } else if (currentDays >= 30 && currentDays < 90) {
    status = "Em chamas";
    tier = "3";
  } else if (currentDays >= 90 && currentDays < 180) {
    status = "Imparável";
    tier = "4";
  } else if (currentDays >= 180 && currentDays < 365) {
    status = "Incendiário";
    tier = "5";
  } else if (currentDays >= 365) {
    status = "Lendário";
    tier = "6";
  }

  document
    .querySelectorAll(
      "[data-sidebar-streak-status]"
    )
    .forEach(
      el => {
        el.textContent =
          status;
      }
    );

  document
    .querySelectorAll(
      "[data-sidebar-streak-card]"
    )
    .forEach(
      el => {
        el.dataset.streakTier =
          tier;

        const copy =
          el.querySelector(
            "[data-sidebar-streak-copy]"
          );

        if (copy) {
          copy.textContent =
            currentDays
            + " dia"
            + (
              currentDays === 1
                ? ""
                : "s"
            )
            + (
              currentDays >= 4
                ? " de ofensiva"
                : ""
            );
        }
      }
    );
}


function sidebarCollapseKey(userId) {
  return `docmap:sidebar-hidden:${userId}`;
}


function prepararSidebarDesktop(
  userId
) {
  let button =
    document.getElementById(
      "sidebar-desktop-toggle"
    );


  if (!button) {
    button =
      document.createElement(
        "button"
      );


    button.id =
      "sidebar-desktop-toggle";


    button.className =
      "sidebar-desktop-toggle";


    button.type =
      "button";


    button.innerHTML =
      "<span aria-hidden=\"true\">☰</span>";


    document.body.appendChild(
      button
    );
  }


  const apply =
    (hidden) => {
      document.body
        .classList
        .toggle(
          "sidebar-hidden",
          hidden
        );


      button.setAttribute(
        "aria-label",
        hidden
          ? "Abrir menu lateral"
          : "Recolher menu lateral"
      );


      button.setAttribute(
        "aria-pressed",
        hidden
          ? "true"
          : "false"
      );


      button.title =
        hidden
          ? "Abrir menu lateral"
          : "Recolher menu lateral";


      try {
        localStorage.setItem(
          sidebarCollapseKey(
            userId
          ),
          hidden
            ? "1"
            : "0"
        );
      } catch {}
    };


  let initial =
    false;


  try {
    initial =
      localStorage.getItem(
        sidebarCollapseKey(
          userId
        )
      ) === "1";
  } catch {}


  apply(
    initial
  );


  button.addEventListener(
    "click",
    () => {
      if (
        window.matchMedia(
          "(max-width: 980px)"
        ).matches
      ) {
        return;
      }


      apply(
        !document.body
          .classList
          .contains(
            "sidebar-hidden"
          )
      );
    }
  );
}


function prepararStudyMenu(
  userId
) {
  const group =
    document.getElementById(
      "study-nav-group"
    );

  const toggle =
    document.getElementById(
      "study-nav-toggle"
    );

  const submenu =
    document.getElementById(
      "study-nav-submenu"
    );

  if (
    !group
    || !toggle
    || !submenu
  ) {
    return;
  }

  const pageInsideStudy =
    [
      "ambientacao",
      "flashcards",
      "erros",
      "questoes"
    ].includes(
      page
    );

  let open =
    pageInsideStudy;

  try {
    const saved =
      localStorage.getItem(
        studyNavKey(
          userId
        )
      );

    if (
      saved !== null
    ) {
      open =
        saved === "1";
    }
  } catch {}

  const apply =
    (nextOpen) => {
      group.classList.toggle(
        "nav-group-collapsed",
        !nextOpen
      );

      submenu.hidden =
        !nextOpen;

      toggle.setAttribute(
        "aria-expanded",
        nextOpen
          ? "true"
          : "false"
      );

      try {
        localStorage.setItem(
          studyNavKey(
            userId
          ),
          nextOpen
            ? "1"
            : "0"
        );
      } catch {}
    };

  apply(
    open
  );

  toggle.addEventListener(
    "click",
    (event) => {
      event.preventDefault();

      apply(
        toggle.getAttribute(
          "aria-expanded"
        ) !== "true"
      );
    }
  );

  submenu
    .querySelectorAll(
      ".nav-sublink"
    )
    .forEach(
      (link) => {
        link.addEventListener(
          "click",
          () => {
            apply(
              false
            );
          }
        );
      }
    );
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


function essentialEntitlementsFallback() {
  return {
    plan: "essential",
    source: "fallback",
    is_admin: false,
    complimentary: false,
    counts_as_paid: false,
    expires_at: null,
    features: {
      dashboard: { enabled: true, limit: null },
      agenda: { enabled: true, limit: null },
      cronograma: { enabled: true, limit: null },
      ambientacao: { enabled: true, limit: null },
      caderno: { enabled: true, limit: null },
      error_notebook: { enabled: true, limit: null },
      flashcards: { enabled: false, limit: 0 },
      flashcard_import: { enabled: false, limit: 0 },
      questions: { enabled: false, limit: 0 },
      question_import: { enabled: false, limit: 0 },
      simulations: { enabled: false, limit: 0 },
      advanced_statistics: { enabled: false, limit: 0 },
      ai: { enabled: false, limit: 0 }
    }
  };
}


async function carregarEntitlements() {
  try {
    const {
      data,
      error
    } =
      await sb.rpc(
        "get_my_entitlements"
      );

    if (
      error
      || !data
    ) {
      console.warn(
        "Não foi possível carregar o plano do usuário:",
        error?.message || "resposta vazia"
      );

      return essentialEntitlementsFallback();
    }

    return data;

  } catch (
    error
  ) {
    console.warn(
      "Não foi possível carregar o plano do usuário:",
      error
    );

    return essentialEntitlementsFallback();
  }
}


function temFeature(
  entitlements,
  featureKey
) {
  if (
    entitlements?.is_admin === true
  ) {
    return true;
  }

  return (
    entitlements
      ?.features
      ?.[featureKey]
      ?.enabled === true
  );
}


function aplicarEntitlementsNaNavegacao(
  entitlements
) {
  Object.entries(
    PLUS_NAV_FEATURES
  ).forEach(
    ([href, featureKey]) => {
      document
        .querySelectorAll(
          `a[href="${href}"]`
        )
        .forEach(
          (link) => {
            if (
              temFeature(
                entitlements,
                featureKey
              )
            ) {
              return;
            }

            link.classList.add(
              "nav-feature-locked"
            );

            link.setAttribute(
              "aria-disabled",
              "true"
            );

            link.title =
              "Disponível no plano Plus";

            if (
              !link.querySelector(
                ".nav-plan-badge"
              )
            ) {
              const badge =
                document.createElement(
                  "span"
                );

              badge.className =
                "nav-plan-badge";

              badge.textContent =
                "PLUS";

              link.appendChild(
                badge
              );
            }

            link.addEventListener(
              "click",
              (event) => {
                event.preventDefault();

                window.alert(
                  "Este recurso está disponível no plano Plus."
                );
              }
            );
          }
        );
    }
  );
}


async function verificarAcessoAdmin() {
  try {
    const {
      data,
      error
    } =
      await sb.rpc(
        "is_admin"
      );

    if (error) {
      console.warn(
        "Não foi possível verificar acesso administrativo:",
        error.message
      );

      return false;
    }

    return data === true;

  } catch (
    error
  ) {
    console.warn(
      "Não foi possível verificar acesso administrativo:",
      error
    );

    return false;
  }
}


async function prepararAdminNavigation(
  acessoAdmin = null
) {
  const link =
    document.getElementById(
      "admin-nav-link"
    );

  if (!link) {
    return false;
  }

  const isAdmin =
    typeof acessoAdmin === "boolean"
      ? acessoAdmin
      : await verificarAcessoAdmin();

  link.hidden =
    !isAdmin;

  return isAdmin;
}


async function iniciarApp() {
  const { data, error } = await sb.auth.getSession();

  if (error || !data.session) {
    window.location.replace("/login/");
    return;
  }

  const user = data.session.user;

  let acessoAdmin =
    null;

  if (
    page === "admin"
  ) {
    acessoAdmin =
      await verificarAcessoAdmin();

    if (
      !acessoAdmin
    ) {
      window.location.replace(
        "/dashboard/"
      );

      return;
    }
  }

  const entitlements =
    await carregarEntitlements();

  const requiredFeature =
    PAGE_FEATURES[page]
    || null;

  if (
    requiredFeature
    && !temFeature(
      entitlements,
      requiredFeature
    )
  ) {
    // Nunca redirecione o Dashboard para ele mesmo.
    // Se o RPC de entitlements vier incompleto/temporariamente indisponível,
    // manter o Dashboard acessível evita um loop infinito /dashboard/ -> /dashboard/.
    if (page !== "dashboard") {
      window.location.replace(
        "/dashboard/"
      );

      return;
    }

    console.warn(
      "Entitlement de dashboard ausente; mantendo o Dashboard acessível para evitar loop de redirecionamento."
    );
  }

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

  updateLuriaLogo(
    document.documentElement.dataset.theme
    || "light"
  );

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
    window.location.replace("/login/");
  });

  prepararMobileMenu();
  prepararSidebarDesktop(user.id);
  prepararStudyMenu(user.id);
  aplicarEntitlementsNaNavegacao(
    entitlements
  );

  acessoAdmin =
    await prepararAdminNavigation(
      acessoAdmin
    );

  await registrarAcessoDiario();
  prepararConfiguracoes();

  document.body.classList.add("app-ready");

  window.docmapUser = user;
  window.docmapSession = data.session;
  window.docmapProfile = profile;
  window.docmapEntitlements =
    entitlements;
  window.docmapPlan =
    entitlements?.plan
    || "essential";
  window.docmapIsAdmin =
    acessoAdmin === true;

  window.dispatchEvent(
    new CustomEvent("docmap:ready", {
      detail: {
        user,
        session: data.session,
        isAdmin:
          window.docmapIsAdmin,
        plan:
          window.docmapPlan,
        entitlements:
          window.docmapEntitlements
      }
    })
  );
}


iniciarApp();
