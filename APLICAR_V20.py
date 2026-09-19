from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
BASE_COMMIT = "c00b6f7deb56f6472b18b538268944a122f2a487"
BACKUP_DIR = ROOT / "_backup_antes_v20"
FILES = [
    "dashboard.html",
    "dashboard.js",
    "ambientacao.html",
    "ambientacao.js",
    "ambientacao.css",
]


def run(cmd, check=True):
    result = subprocess.run(
        cmd,
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if check and result.returncode != 0:
        raise RuntimeError(
            "$ " + " ".join(cmd) + "\n\n" + (result.stderr or result.stdout)
        )
    return result


def ensure_git_repo():
    result = run(["git", "rev-parse", "--show-toplevel"], check=False)
    if result.returncode != 0:
        raise RuntimeError("Execute este arquivo na raiz do repositório studyos.")


def ensure_base_commit():
    result = run(["git", "cat-file", "-e", f"{BASE_COMMIT}^{{commit}}"], check=False)
    if result.returncode == 0:
        return

    print("Baixando histórico necessário...")
    shallow = run(["git", "rev-parse", "--is-shallow-repository"], check=False)

    if shallow.stdout.strip() == "true":
        run(["git", "fetch", "--unshallow", "origin"], check=False)
    else:
        run(["git", "fetch", "origin"], check=False)

    result = run(["git", "cat-file", "-e", f"{BASE_COMMIT}^{{commit}}"], check=False)
    if result.returncode != 0:
        fetch_sha = run(["git", "fetch", "origin", BASE_COMMIT], check=False)
        if fetch_sha.returncode != 0:
            raise RuntimeError("Não consegui acessar a versão estável no histórico Git.")


def git_show(path):
    return run(["git", "show", f"{BASE_COMMIT}:{path}"]).stdout


def backup_current_files():
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        source = ROOT / name
        if source.exists():
            shutil.copy2(source, BACKUP_DIR / name)


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"Trecho não encontrado: {label}")
    return text.replace(old, new, 1)


def insert_before_once(text, marker, addition, label):
    if marker not in text:
        raise RuntimeError(f"Marcador não encontrado: {label}")
    return text.replace(marker, addition + marker, 1)


def remove_html_section_by_class(html, class_names):
    marker = f'class="{class_names}"'
    marker_pos = html.find(marker)
    if marker_pos < 0:
        return html

    start = html.rfind("<section", 0, marker_pos)
    if start < 0:
        raise RuntimeError(f"Início do section não encontrado: {class_names}")

    pattern = re.compile(r"</?section\b[^>]*>", re.I)
    depth = 0

    for match in pattern.finditer(html, start):
        tag = match.group(0)
        if tag.lower().startswith("</section"):
            depth -= 1
            if depth == 0:
                return html[:start] + html[match.end():]
        else:
            depth += 1

    raise RuntimeError(f"Fim do section não encontrado: {class_names}")


def remove_css_block(css, start_phrase, next_phrase):
    pos = css.find(start_phrase)
    if pos < 0:
        return css

    start = css.rfind("/*", 0, pos)
    next_pos = css.find(next_phrase, pos)
    end = css.rfind("/*", 0, next_pos)

    if start < 0 or next_pos < 0 or end <= start:
        raise RuntimeError("Não consegui remover o CSS antigo do CCQ.")

    return css[:start] + css[end:]


def replace_metric_card(html, identifying_text, replacement):
    marker_pos = html.find(identifying_text)
    if marker_pos < 0:
        raise RuntimeError(f"Card não encontrado: {identifying_text}")

    start = html.rfind('<article class="metric-card">', 0, marker_pos)
    end = html.find("</article>", marker_pos)

    if start < 0 or end < 0:
        raise RuntimeError(f"Não consegui delimitar o card: {identifying_text}")

    end += len("</article>")
    return html[:start] + replacement + html[end:]


def patch_dashboard_html(html):
    ccq_card = '''<article class="metric-card dashboard-passive-ccq-card">
            <div class="dashboard-ccq-head">
              <span class="metric-label">Revisão passiva</span>
              <span class="dashboard-ccq-auto">CCQ · 30s</span>
            </div>

            <div id="dashboard-passive-ccq-empty" class="dashboard-passive-ccq-empty">
              Carregando CCQs...
            </div>

            <div
              id="dashboard-passive-ccq-stage"
              class="dashboard-passive-ccq-stage"
              hidden
              aria-live="polite"
            >
              <div id="dashboard-passive-ccq-text" class="dashboard-passive-ccq-text"></div>
              <div id="dashboard-passive-ccq-meta" class="dashboard-passive-ccq-meta"></div>
            </div>

            <div class="dashboard-passive-ccq-progress">
              <span id="dashboard-passive-ccq-progress"></span>
            </div>
          </article>'''

    html = replace_metric_card(html, "Maior dificuldade", ccq_card)

    style = '''
  <style id="dashboard-ccq-inline">
    .dashboard-passive-ccq-card {
      position: relative;
      overflow: hidden;
      display: grid;
      align-content: start;
      gap: 10px;
      min-height: 150px;
    }

    .dashboard-ccq-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .dashboard-ccq-head .metric-label { margin: 0; }

    .dashboard-ccq-auto {
      color: var(--muted);
      font-size: 8px;
      font-weight: 800;
      white-space: nowrap;
    }

    .dashboard-passive-ccq-stage {
      min-height: 80px;
      display: grid;
      align-content: center;
      justify-items: center;
      gap: 8px;
      padding: 2px 4px;
      text-align: center;
      transform: translateX(0);
      opacity: 1;
      transition: transform 300ms ease, opacity 300ms ease;
    }

    .dashboard-passive-ccq-stage.is-leaving {
      transform: translateX(-24px);
      opacity: 0;
    }

    .dashboard-passive-ccq-stage.is-entering {
      transform: translateX(24px);
      opacity: 0;
    }

    .dashboard-passive-ccq-text {
      width: 100%;
      display: -webkit-box;
      overflow: hidden;
      color: var(--text);
      font-size: 14.5px;
      font-weight: 820;
      line-height: 1.4;
      letter-spacing: -.012em;
      text-align: center;
      -webkit-line-clamp: 4;
      -webkit-box-orient: vertical;
    }

    .dashboard-passive-ccq-meta {
      width: 100%;
      overflow: hidden;
      color: var(--muted);
      font-size: 8.5px;
      font-weight: 700;
      text-align: center;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .dashboard-passive-ccq-empty {
      min-height: 80px;
      display: grid;
      place-items: center;
      color: var(--muted);
      font-size: 10px;
      line-height: 1.45;
      text-align: center;
    }

    .dashboard-passive-ccq-progress {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 3px;
      overflow: hidden;
      background: var(--border);
    }

    .dashboard-passive-ccq-progress > span {
      display: block;
      width: 0%;
      height: 100%;
      background: var(--accent);
    }

    @media (prefers-reduced-motion: reduce) {
      .dashboard-passive-ccq-stage { transition: none; }
    }
  </style>
'''

    html = insert_before_once(html, "</head>", style, "CSS do CCQ no Dashboard")
    html = html.replace("dashboard.js?v=11.7", "dashboard.js?v=20.0")
    return html


DASHBOARD_CCQ_JS = r'''
/* =========================================================
   REVISÃO PASSIVA — DASHBOARD
   ========================================================= */

const DASHBOARD_CCQ_ROTATION_MS = 30000;

const dashboardCcqState = {
  items: [],
  currentIndex: -1,
  bag: [],
  timerId: null,
  transitionId: null
};

function shuffleDashboardCcqIndexes(count) {
  const indexes = Array.from({ length: count }, (_, index) => index);

  for (let i = indexes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }

  return indexes;
}

function refillDashboardCcqBag() {
  dashboardCcqState.bag = shuffleDashboardCcqIndexes(dashboardCcqState.items.length);

  if (
    dashboardCcqState.items.length > 1
    && dashboardCcqState.currentIndex >= 0
    && dashboardCcqState.bag[dashboardCcqState.bag.length - 1] === dashboardCcqState.currentIndex
  ) {
    [
      dashboardCcqState.bag[0],
      dashboardCcqState.bag[dashboardCcqState.bag.length - 1]
    ] = [
      dashboardCcqState.bag[dashboardCcqState.bag.length - 1],
      dashboardCcqState.bag[0]
    ];
  }
}

function nextDashboardCcqIndex() {
  if (!dashboardCcqState.items.length) return -1;
  if (dashboardCcqState.items.length === 1) return 0;
  if (!dashboardCcqState.bag.length) refillDashboardCcqBag();

  let index = dashboardCcqState.bag.pop();

  if (index === dashboardCcqState.currentIndex && dashboardCcqState.bag.length) {
    const alternative = dashboardCcqState.bag.pop();
    dashboardCcqState.bag.push(index);
    index = alternative;
  }

  return index;
}

function resetDashboardCcqProgress() {
  const bar = document.getElementById("dashboard-passive-ccq-progress");
  if (!bar) return;

  bar.style.transition = "none";
  bar.style.width = "0%";
  void bar.offsetWidth;
  bar.style.transition = `width ${DASHBOARD_CCQ_ROTATION_MS}ms linear`;

  requestAnimationFrame(() => {
    bar.style.width = "100%";
  });
}

function writeDashboardCcq(item) {
  const text = document.getElementById("dashboard-passive-ccq-text");
  const meta = document.getElementById("dashboard-passive-ccq-meta");

  if (text) text.textContent = item?.ccq || "";

  if (meta) {
    const metaText = [item?.area, item?.materia, item?.theme]
      .filter(Boolean)
      .join(" · ");

    meta.textContent = metaText;
    meta.hidden = !metaText;
  }
}

function showNextDashboardCcq(animate = true) {
  if (!dashboardCcqState.items.length) return;

  const stage = document.getElementById("dashboard-passive-ccq-stage");
  const nextIndex = nextDashboardCcqIndex();
  if (nextIndex < 0) return;

  const item = dashboardCcqState.items[nextIndex];
  window.clearTimeout(dashboardCcqState.transitionId);

  if (!animate || !stage) {
    dashboardCcqState.currentIndex = nextIndex;
    writeDashboardCcq(item);
    resetDashboardCcqProgress();
    return;
  }

  stage.classList.add("is-leaving");

  dashboardCcqState.transitionId = window.setTimeout(() => {
    dashboardCcqState.currentIndex = nextIndex;
    writeDashboardCcq(item);

    stage.classList.remove("is-leaving");
    stage.classList.add("is-entering");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        stage.classList.remove("is-entering");
      });
    });

    resetDashboardCcqProgress();
  }, 300);
}

function stopDashboardCcqRotation() {
  if (dashboardCcqState.timerId) {
    clearInterval(dashboardCcqState.timerId);
    dashboardCcqState.timerId = null;
  }

  window.clearTimeout(dashboardCcqState.transitionId);
}

function startDashboardCcqRotation() {
  stopDashboardCcqRotation();
  if (dashboardCcqState.items.length < 2) return;

  dashboardCcqState.timerId = window.setInterval(() => {
    if (!document.hidden) showNextDashboardCcq(true);
  }, DASHBOARD_CCQ_ROTATION_MS);
}

async function loadDashboardPassiveCcqs() {
  const empty = document.getElementById("dashboard-passive-ccq-empty");
  const stage = document.getElementById("dashboard-passive-ccq-stage");
  if (!empty || !stage) return;

  const { data, error } = await dashboardSb
    .from("error_notebook")
    .select("id,area,materia,theme,ccq,due_date,review_count,created_at")
    .eq("active", true)
    .not("ccq", "is", null)
    .limit(100);

  if (error) {
    console.warn("Não foi possível carregar os CCQs no Dashboard:", error.message);
    empty.hidden = false;
    empty.textContent = "Sem CCQs disponíveis.";
    stage.hidden = true;
    return;
  }

  dashboardCcqState.items = (data || []).filter(
    (item) => String(item.ccq || "").trim()
  );

  dashboardCcqState.currentIndex = -1;
  dashboardCcqState.bag = [];

  if (!dashboardCcqState.items.length) {
    empty.hidden = false;
    empty.textContent = "Nenhum CCQ ativo no Caderno de Erros.";
    stage.hidden = true;
    return;
  }

  empty.hidden = true;
  stage.hidden = false;
  showNextDashboardCcq(false);
  startDashboardCcqRotation();
}

function initDashboardPassiveCcq() {
  loadDashboardPassiveCcqs();

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && dashboardCcqState.items.length) {
      resetDashboardCcqProgress();
      startDashboardCcqRotation();
    }
  });

  window.addEventListener("pagehide", stopDashboardCcqRotation);
}


'''


def patch_dashboard_js(js):
    js = js.replace("    loadQuestionDifficulty(),\n", "")

    js = insert_before_once(
        js,
        "async function loadDashboardMetrics()",
        DASHBOARD_CCQ_JS,
        "lógica CCQ do Dashboard",
    )

    js = replace_once(
        js,
        '''async function initDashboard() {
  wireDashboardControls();

  await Promise.all([''',
        '''async function initDashboard() {
  wireDashboardControls();

  initDashboardPassiveCcq();

  await Promise.all([''',
        "inicialização do Dashboard",
    )

    return js


def patch_ambientacao_html(html):
    html = remove_html_section_by_class(html, "panel ccq-showcase-panel")
    html = html.replace("ambientacao.css?v=12.9", "ambientacao.css?v=20.0")
    html = html.replace("ambientacao.js?v=12.9", "ambientacao.js?v=20.0")
    return html


def patch_ambientacao_css(css):
    css = remove_css_block(
        css,
        "FASE 7.1 — CCQs COMO MOSTRADOR AUTOMÁTICO",
        "AGENDA → AMBIENTAÇÃO",
    )

    css += r'''

/* =========================================================
   AULA + CADERNO NA AMBIENTAÇÃO
   ========================================================= */

#ambientacao-workspace:has(#ambientacao-lesson-activity:not([hidden])) {
  padding: 12px;
  overflow: visible;
}

#ambientacao-workspace:has(#ambientacao-lesson-activity:not([hidden])) > .panel-header {
  display: none;
}

#ambientacao-workspace:has(#ambientacao-lesson-activity:not([hidden])) .agenda-lesson-activity {
  margin-bottom: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--surface-2);
}

#ambientacao-workspace:has(#ambientacao-lesson-activity:not([hidden])) .agenda-lesson-activity > .badge {
  display: none;
}

#ambientacao-workspace:has(#ambientacao-lesson-activity:not([hidden])) .agenda-lesson-activity h3 {
  margin: 0;
  font-size: 15px;
  line-height: 1.3;
}

#ambientacao-workspace:has(#ambientacao-lesson-activity:not([hidden])) .agenda-lesson-meta {
  margin-top: 3px;
  font-size: 9px;
}

#ambientacao-workspace:has(#ambientacao-lesson-activity:not([hidden])) .agenda-lesson-subtitle {
  margin: 5px 0 0;
  font-size: 9px;
  line-height: 1.4;
}

#ambientacao-workspace:has(#ambientacao-lesson-activity:not([hidden])) .agenda-lesson-actions {
  margin-top: 8px;
  gap: 8px;
}

#ambientacao-workspace:has(#ambientacao-lesson-activity:not([hidden])) .agenda-lesson-actions .button {
  min-height: 31px;
  padding: 0 11px;
  font-size: 9px;
}

#ambientacao-workspace:has(#ambientacao-lesson-activity:not([hidden])) .ambientacao-workspace-frame {
  width: 100%;
  min-height: 820px;
  margin: 0;
  border-radius: 10px;
}

@media (max-width: 760px) {
  #ambientacao-workspace:has(#ambientacao-lesson-activity:not([hidden])) {
    padding: 8px;
  }

  #ambientacao-workspace:has(#ambientacao-lesson-activity:not([hidden])) .ambientacao-workspace-frame {
    min-height: 720px;
  }
}
'''

    return css


def patch_ambientacao_js(js):
    ccq_phrase = "FASE 7.1 — CCQs COMO MOSTRADOR AUTOMÁTICO"
    pos = js.find(ccq_phrase)

    if pos >= 0:
        start = js.rfind("/*", 0, pos)
        end = js.find("function bindAmbientacaoLofi", pos)

        if start < 0 or end < 0:
            raise RuntimeError("Não consegui remover a lógica antiga do CCQ.")

        js = js[:start] + js[end:]

    flash_marker = '''    /*
      FLASHCARDS
    */
'''

    lesson_embed = r'''    /*
      CADERNO DA AULA
      Exibe somente o editor dentro da Ambientação.
    */

    if (
      kind === "lesson"
    ) {
      [
        ".notebook-tabs",
        ".notebook-topic-panel",
        "#notebook-view-library"
      ].forEach((selector) => {
        doc
          .querySelectorAll(selector)
          .forEach((element) => {
            element.style.display = "none";
          });
      });

      const editorView =
        doc.querySelector(
          "#notebook-view-editor"
        );

      if (editorView) {
        editorView.hidden = false;
        editorView.style.display = "block";
      }

      const notebookWorkspace =
        doc.querySelector(
          ".notebook-workspace"
        );

      if (notebookWorkspace) {
        notebookWorkspace.style.display = "block";
        notebookWorkspace.style.gridTemplateColumns = "1fr";
      }

      const editorColumn =
        doc.querySelector(
          ".notebook-editor-column"
        );

      if (editorColumn) {
        editorColumn.style.width = "100%";
        editorColumn.style.minWidth = "0";
      }

      const toolbar =
        doc.querySelector(
          ".notebook-toolbar"
        );

      if (toolbar) {
        toolbar.style.top = "0";
        toolbar.style.marginTop = "0";
      }

      const wrap =
        doc.querySelector(
          ".notebook-document-wrap"
        );

      if (wrap) {
        wrap.style.paddingTop = "0";
      }

      const paper =
        doc.querySelector(
          ".notebook-paper"
        );

      if (paper) {
        paper.style.width = "min(100%, 980px)";
        paper.style.maxWidth = "980px";
        paper.style.margin = "0 auto";
      }

      let embedStyle =
        doc.getElementById(
          "ambientacao-notebook-embed-style"
        );

      if (!embedStyle) {
        embedStyle = doc.createElement("style");
        embedStyle.id = "ambientacao-notebook-embed-style";
        embedStyle.textContent = `
          html, body {
            min-height: 0 !important;
            background: transparent !important;
          }

          .notebook-main-shell,
          .notebook-page {
            min-height: 0 !important;
          }

          .notebook-toolbar {
            position: sticky !important;
            top: 0 !important;
            z-index: 40 !important;
          }

          .notebook-document-wrap {
            padding: 0 0 24px !important;
          }

          .notebook-paper {
            min-height: 880px !important;
          }

          @media (max-width: 760px) {
            .notebook-paper {
              min-height: 720px !important;
            }
          }
        `;

        doc.head.appendChild(embedStyle);
      }
    }


'''

    js = insert_before_once(
        js,
        flash_marker,
        lesson_embed,
        "Caderno embutido",
    )

    old_lesson = '''    renderAgendaLesson(
      params
    );


    return;
'''

    new_lesson = '''    renderAgendaLesson(
      params
    );


    const itemId =
      params.get(
        "item_id"
      );


    if (
      isUuid(
        itemId
      )
    ) {
      frame.hidden =
        false;


      frame.title =
        "Caderno da aula";


      const notebookUrl =
        new URL(
          "caderno.html",
          window.location.href
        );


      notebookUrl.searchParams.set(
        "topic_id",
        itemId
      );


      notebookUrl.searchParams.set(
        "view",
        "editor"
      );


      frame.addEventListener(
        "load",
        () => {
          prepareEmbeddedStudyPage(
            frame,
            "lesson"
          );
        },
        {
          once: true
        }
      );


      frame.src =
        notebookUrl.toString();
    }


    return;
'''

    js = replace_once(
        js,
        old_lesson,
        new_lesson,
        "abertura do Caderno da aula",
    )

    return js


def validate(files):
    dashboard_html = files["dashboard.html"]
    dashboard_js = files["dashboard.js"]
    ambientacao_html = files["ambientacao.html"]
    ambientacao_js = files["ambientacao.js"]

    checks = {
        "Agenda: agendaState": "const agendaState" in dashboard_js,
        "Agenda: loadAgenda": "loadAgenda()" in dashboard_js,
        "Agenda: Semana/Mês": (
            'document.getElementById("view-week")' in dashboard_js
            and 'document.getElementById("view-month")' in dashboard_js
        ),
        "Dashboard: CCQ": (
            "dashboard-passive-ccq-card" in dashboard_html
            and "loadDashboardPassiveCcqs" in dashboard_js
        ),
        "Dashboard: maior dificuldade removida": "Maior dificuldade" not in dashboard_html,
        "Ambientação: Pomodoro preservado": "initPomodoro" in ambientacao_js,
        "Ambientação: CCQ removido": (
            "ccq-showcase-panel" not in ambientacao_html
            and "loadCcqRotation" not in ambientacao_js
        ),
        "Ambientação: Caderno da aula": (
            '"caderno.html"' in ambientacao_js
            and '"topic_id"' in ambientacao_js
            and '"Caderno da aula"' in ambientacao_js
        ),
    }

    failed = [name for name, ok in checks.items() if not ok]
    if failed:
        raise RuntimeError("Validação falhou:\n- " + "\n- ".join(failed))

    return checks


def node_check(path):
    node = shutil.which("node")
    if not node:
        return "Node não encontrado; validação estrutural concluída."

    result = run([node, "--check", str(path)], check=False)
    if result.returncode != 0:
        raise RuntimeError(
            f"Erro de sintaxe em {path.name}:\n" + (result.stderr or result.stdout)
        )

    return f"{path.name}: sintaxe OK"


def main():
    print()
    print("RESIBULANDO V20 — BASE ESTÁVEL")
    print("===============================")
    print()

    ensure_git_repo()
    ensure_base_commit()

    print("1/6 Criando backup...")
    backup_current_files()

    print("2/6 Recuperando a versão estável...")
    files = {name: git_show(name) for name in FILES}

    print("3/6 Aplicando CCQ no Dashboard...")
    files["dashboard.html"] = patch_dashboard_html(files["dashboard.html"])
    files["dashboard.js"] = patch_dashboard_js(files["dashboard.js"])

    print("4/6 Integrando Caderno na Ambientação...")
    files["ambientacao.html"] = patch_ambientacao_html(files["ambientacao.html"])
    files["ambientacao.css"] = patch_ambientacao_css(files["ambientacao.css"])
    files["ambientacao.js"] = patch_ambientacao_js(files["ambientacao.js"])

    print("5/6 Validando...")
    checks = validate(files)

    for name in FILES:
        (ROOT / name).write_text(files[name], encoding="utf-8")

    js_messages = [
        node_check(ROOT / "dashboard.js"),
        node_check(ROOT / "ambientacao.js"),
    ]

    print("6/6 Pronto.")
    print()

    for name in checks:
        print("✓", name)

    for message in js_messages:
        print("✓", message)

    print()
    print("Backup:", BACKUP_DIR)
    print()
    print("Agora rode:")
    print("git add dashboard.html dashboard.js ambientacao.html ambientacao.js ambientacao.css")
    print('git commit -m "Restaura agenda e integra CCQ e caderno"')
    print("git push")
    print()
    print("Depois faça Ctrl + Shift + R.")
    print()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print()
        print("ERRO:")
        print(error)
        print()
        print("Não faça commit enquanto esse erro não for corrigido.")
        sys.exit(1)
