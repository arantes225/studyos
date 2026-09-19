from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
BASE_COMMIT = "c00b6f7deb56f6472b18b538268944a122f2a487"
BACKUP_DIR = ROOT / "_backup_antes_v19"

FILES = [
    "ambientacao.html",
    "ambientacao.js",
    "ambientacao.css",
    "dashboard.html",
    "dashboard.js",
]


def run(cmd, check=True):
    result = subprocess.run(
        cmd,
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8"
    )

    if check and result.returncode != 0:
        raise RuntimeError(
            "$ " + " ".join(cmd) + "\n\n"
            + (result.stderr or result.stdout)
        )

    return result


def ensure_git_repo():
    result = run(
        ["git", "rev-parse", "--show-toplevel"],
        check=False
    )

    if result.returncode != 0:
        raise RuntimeError(
            "Este script precisa ser executado na raiz do repositório studyos.\n"
            "Abra o Codespace do projeto, coloque este arquivo na raiz e rode:\n"
            "python APLICAR_V19.py"
        )


def ensure_base_commit():
    result = run(
        ["git", "cat-file", "-e", f"{BASE_COMMIT}^{{commit}}"],
        check=False
    )

    if result.returncode == 0:
        return

    print("O commit-base não está no clone local. Tentando buscar no GitHub...")

    fetch = run(
        ["git", "fetch", "origin", BASE_COMMIT, "--depth=1"],
        check=False
    )

    if fetch.returncode != 0:
        raise RuntimeError(
            "Não consegui obter o commit estável usado para o reparo.\n\n"
            + (fetch.stderr or fetch.stdout)
        )


def git_show(path):
    result = run(
        ["git", "show", f"{BASE_COMMIT}:{path}"]
    )

    return result.stdout


def backup_current_files():
    BACKUP_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    for name in FILES:
        source = ROOT / name

        if source.exists():
            shutil.copy2(
                source,
                BACKUP_DIR / name
            )


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(
            f"Não encontrei o trecho necessário para: {label}"
        )

    return text.replace(
        old,
        new,
        1
    )


def insert_before_once(text, marker, addition, label):
    if marker not in text:
        raise RuntimeError(
            f"Não encontrei o marcador para: {label}"
        )

    return text.replace(
        marker,
        addition + marker,
        1
    )


def remove_html_section_by_class(html, class_names):
    marker = f'class="{class_names}"'
    marker_pos = html.find(marker)

    if marker_pos < 0:
        return html

    start = html.rfind(
        "<section",
        0,
        marker_pos
    )

    if start < 0:
        raise RuntimeError(
            f"Não encontrei o início do section {class_names}."
        )

    tag_pattern = re.compile(
        r"</?section\b[^>]*>",
        re.I
    )

    depth = 0

    for match in tag_pattern.finditer(
        html,
        start
    ):
        tag = match.group(0)

        if tag.lower().startswith(
            "</section"
        ):
            depth -= 1

            if depth == 0:
                return (
                    html[:start]
                    + html[match.end():]
                )
        else:
            depth += 1

    raise RuntimeError(
        f"Não encontrei o fim do section {class_names}."
    )


def remove_block_between_markers(
    text,
    start_phrase,
    next_phrase,
    label
):
    start_phrase_pos = text.find(
        start_phrase
    )

    if start_phrase_pos < 0:
        return text

    start = text.rfind(
        "/*",
        0,
        start_phrase_pos
    )

    next_phrase_pos = text.find(
        next_phrase,
        start_phrase_pos
    )

    if (
        start < 0
        or next_phrase_pos < 0
    ):
        raise RuntimeError(
            f"Não consegui remover o bloco: {label}"
        )

    end = text.rfind(
        "/*",
        0,
        next_phrase_pos
    )

    if end <= start:
        raise RuntimeError(
            f"Não consegui delimitar o bloco: {label}"
        )

    return (
        text[:start]
        + text[end:]
    )


def patch_ambientacao_html(html):
    html = remove_html_section_by_class(
        html,
        "panel ccq-showcase-panel"
    )

    html = html.replace(
        "ambientacao.css?v=12.9",
        "ambientacao.css?v=19.0"
    )

    html = html.replace(
        "ambientacao.js?v=12.9",
        "ambientacao.js?v=19.0"
    )

    return html


def patch_ambientacao_css(css):
    css = remove_block_between_markers(
        css,
        "FASE 7.1 — CCQs COMO MOSTRADOR AUTOMÁTICO",
        "AGENDA → AMBIENTAÇÃO",
        "CSS do CCQ na Ambientação"
    )

    css += r'''

/* =========================================================
   V19 — AULA DISCRETA + CADERNO INCORPORADO
   ========================================================= */

body.ambientacao-lesson-active .selected-activity {
  min-height: 0;
  margin-bottom: 10px;
  padding: 9px 12px;
  gap: 10px;
  border-radius: 11px;
}

body.ambientacao-lesson-active .selected-activity .badge {
  display: none;
}

body.ambientacao-lesson-active .selected-activity h2 {
  margin: 0;
  font-size: 14px;
  line-height: 1.25;
  letter-spacing: -.015em;
}

body.ambientacao-lesson-active .selected-activity p {
  margin: 3px 0 0;
  font-size: 9px;
  line-height: 1.35;
}

body.ambientacao-lesson-active #clear-selected-activity {
  min-height: 30px;
  padding: 0 10px;
  font-size: 9px;
}

body.ambientacao-lesson-active #ambientacao-workspace {
  padding: 12px;
  overflow: visible;
}

body.ambientacao-lesson-active
#ambientacao-workspace > .panel-header {
  display: none;
}

body.ambientacao-lesson-active
.agenda-lesson-activity {
  margin-bottom: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--surface-2);
}

body.ambientacao-lesson-active
.agenda-lesson-activity > .badge {
  display: none;
}

body.ambientacao-lesson-active
.agenda-lesson-activity h3 {
  margin: 0;
  font-size: 15px;
  line-height: 1.3;
  letter-spacing: -.015em;
}

body.ambientacao-lesson-active
.agenda-lesson-meta {
  margin-top: 3px;
  font-size: 9px;
  font-weight: 700;
}

body.ambientacao-lesson-active
.agenda-lesson-subtitle {
  margin: 5px 0 0;
  font-size: 9px;
  line-height: 1.4;
}

body.ambientacao-lesson-active
.agenda-lesson-actions {
  margin-top: 8px;
  gap: 8px;
}

body.ambientacao-lesson-active
.agenda-lesson-actions .button {
  min-height: 31px;
  padding: 0 11px;
  font-size: 9px;
}

body.ambientacao-lesson-active
.agenda-lesson-status {
  min-height: 0;
  font-size: 9px;
}

body.ambientacao-lesson-active
.ambientacao-workspace-frame {
  width: 100%;
  min-height: 820px;
  margin: 0;
  border-radius: 10px;
}

@media (max-width: 760px) {
  body.ambientacao-lesson-active
  #ambientacao-workspace {
    padding: 8px;
  }

  body.ambientacao-lesson-active
  .ambientacao-workspace-frame {
    min-height: 720px;
  }
}
'''

    return css


def patch_ambientacao_js(js):
    ccq_phrase = (
        "FASE 7.1 — CCQs COMO MOSTRADOR AUTOMÁTICO"
    )

    pos = js.find(
        ccq_phrase
    )

    if pos >= 0:
        start = js.rfind(
            "/*",
            0,
            pos
        )

        end = js.find(
            "function bindAmbientacaoLofi",
            pos
        )

        if start < 0 or end < 0:
            raise RuntimeError(
                "Não consegui delimitar a lógica antiga do CCQ na Ambientação."
            )

        js = (
            js[:start]
            + js[end:]
        )

    flash_marker = r'''    /*
      FLASHCARDS
    */
'''

    lesson_embed = r'''    /*
      CADERNO DA AULA
      Exibe somente o editor, sem lista lateral,
      abas ou navegação duplicada.
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
            element.style.display =
              "none";
          });
      });


      const editorView =
        doc.querySelector(
          "#notebook-view-editor"
        );


      if (editorView) {
        editorView.hidden =
          false;

        editorView.style.display =
          "block";
      }


      const notebookWorkspace =
        doc.querySelector(
          ".notebook-workspace"
        );


      if (notebookWorkspace) {
        notebookWorkspace.style.display =
          "block";

        notebookWorkspace.style.gridTemplateColumns =
          "1fr";
      }


      const editorColumn =
        doc.querySelector(
          ".notebook-editor-column"
        );


      if (editorColumn) {
        editorColumn.style.width =
          "100%";

        editorColumn.style.minWidth =
          "0";
      }


      const toolbar =
        doc.querySelector(
          ".notebook-toolbar"
        );


      if (toolbar) {
        toolbar.style.top =
          "0";

        toolbar.style.marginTop =
          "0";
      }


      const wrap =
        doc.querySelector(
          ".notebook-document-wrap"
        );


      if (wrap) {
        wrap.style.paddingTop =
          "0";
      }


      const paper =
        doc.querySelector(
          ".notebook-paper"
        );


      if (paper) {
        paper.style.width =
          "min(100%, 980px)";

        paper.style.maxWidth =
          "980px";

        paper.style.margin =
          "0 auto";
      }


      let embedStyle =
        doc.getElementById(
          "ambientacao-notebook-embed-style"
        );


      if (!embedStyle) {
        embedStyle =
          doc.createElement(
            "style"
          );

        embedStyle.id =
          "ambientacao-notebook-embed-style";

        embedStyle.textContent =
          `
            html,
            body {
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

        doc.head.appendChild(
          embedStyle
        );
      }
    }


'''

    js = insert_before_once(
        js,
        flash_marker,
        lesson_embed,
        "integração visual do Caderno na Ambientação"
    )

    workspace_guard = r'''  if (
    !workspace
    || !frame
  ) {
    return;
  }


  const supported = [
'''

    workspace_guard_new = r'''  if (
    !workspace
    || !frame
  ) {
    return;
  }


  document.body.classList.toggle(
    "ambientacao-lesson-active",
    kind === "lesson"
  );


  const supported = [
'''

    js = replace_once(
        js,
        workspace_guard,
        workspace_guard_new,
        "classe visual da aula"
    )

    old_lesson_end = r'''    renderAgendaLesson(
      params
    );


    return;
'''

    new_lesson_end = r'''    renderAgendaLesson(
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


      notebookUrl.searchParams.set(
        "embed",
        "ambientacao"
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
        old_lesson_end,
        new_lesson_end,
        "abertura do Caderno da aula"
    )

    clear_marker = r'''        container.hidden =
          true;


        const workspace =
'''

    clear_new = r'''        container.hidden =
          true;


        document.body.classList.remove(
          "ambientacao-lesson-active"
        );


        const workspace =
'''

    js = replace_once(
        js,
        clear_marker,
        clear_new,
        "limpeza do modo aula"
    )

    return js


def replace_metric_card(
    html,
    identifying_text,
    replacement
):
    marker_pos = html.find(
        identifying_text
    )

    if marker_pos < 0:
        raise RuntimeError(
            f"Card não encontrado: {identifying_text}"
        )

    start = html.rfind(
        '<article class="metric-card">',
        0,
        marker_pos
    )

    if start < 0:
        raise RuntimeError(
            f"Início do card não encontrado: {identifying_text}"
        )

    end = html.find(
        "</article>",
        marker_pos
    )

    if end < 0:
        raise RuntimeError(
            f"Fim do card não encontrado: {identifying_text}"
        )

    end += len(
        "</article>"
    )

    return (
        html[:start]
        + replacement
        + html[end:]
    )


def patch_dashboard_html(html):
    ccq_card = r'''<article class="metric-card dashboard-passive-ccq-card">
            <div class="dashboard-ccq-head">
              <span class="metric-label">
                Revisão passiva
              </span>

              <span class="dashboard-ccq-auto">
                CCQ · 30s
              </span>
            </div>

            <div
              id="dashboard-passive-ccq-empty"
              class="dashboard-passive-ccq-empty"
            >
              Carregando CCQs...
            </div>

            <div
              id="dashboard-passive-ccq-stage"
              class="dashboard-passive-ccq-stage"
              hidden
              aria-live="polite"
            >
              <div
                id="dashboard-passive-ccq-text"
                class="dashboard-passive-ccq-text"
              ></div>

              <div
                id="dashboard-passive-ccq-meta"
                class="dashboard-passive-ccq-meta"
              ></div>
            </div>

            <div class="dashboard-passive-ccq-progress">
              <span id="dashboard-passive-ccq-progress"></span>
            </div>
          </article>'''

    html = replace_metric_card(
        html,
        "Maior dificuldade",
        ccq_card
    )

    streak_card = r'''<article
            id="dashboard-streak-card"
            class="metric-card streak-card-v19"
            data-streak-tier="0"
          >
            <span class="metric-label">
              Ofensiva
            </span>

            <strong class="metric-value">
              <span data-streak-value>—</span> dias
            </strong>

            <span class="metric-helper">
              Recorde:
              <span data-longest-streak>—</span> dias
            </span>

            <div
              class="streak-flame-wrap"
              aria-hidden="true"
            >
              <span class="streak-flame-aura"></span>

              <svg
                class="streak-flame-svg"
                viewBox="0 0 64 80"
              >
                <path
                  fill="currentColor"
                  d="M34 3C35 15 26 19 26 29C26 35 30 38 33 40C27 40 22 35 21 29C13 37 8 46 8 56C8 69 18 77 32 77C46 77 56 68 56 54C56 41 48 30 40 22C39 30 36 34 32 36C35 27 43 18 34 3Z"
                ></path>

                <path
                  class="streak-flame-core"
                  d="M33 40C27 47 23 52 23 59C23 67 27 71 33 71C40 71 44 66 44 59C44 52 39 47 35 43C35 48 33 51 30 53C31 48 34 45 33 40Z"
                ></path>
              </svg>
            </div>

            <div
              id="dashboard-streak-stage"
              class="streak-stage-label"
            >
              Comece hoje
            </div>
          </article>'''

    html = replace_metric_card(
        html,
        ">Ofensiva<",
        streak_card
    )

    dashboard_style = r'''
  <style id="dashboard-v19-inline">
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

    .dashboard-ccq-head .metric-label {
      margin: 0;
    }

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
      transition:
        transform 300ms ease,
        opacity 300ms ease;
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

    .streak-card-v19 {
      --flame-size: 32px;
      --flame-main: #94a3b8;
      --flame-core: #cbd5e1;
      --flame-glow: rgba(148, 163, 184, .15);
      position: relative;
      overflow: hidden;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas:
        "label flame"
        "value flame"
        "helper flame"
        "stage stage";
      align-items: center;
      column-gap: 12px;
    }

    .streak-card-v19 > .metric-label {
      grid-area: label;
    }

    .streak-card-v19 > .metric-value {
      grid-area: value;
    }

    .streak-card-v19 > .metric-helper {
      grid-area: helper;
    }

    .streak-flame-wrap {
      grid-area: flame;
      position: relative;
      width: 78px;
      height: 90px;
      display: grid;
      place-items: center;
      justify-self: end;
    }

    .streak-flame-aura {
      position: absolute;
      width: calc(var(--flame-size) * 1.3);
      height: calc(var(--flame-size) * 1.3);
      border-radius: 50%;
      background: var(--flame-main);
      opacity: .10;
      filter: blur(13px);
      transition:
        width .35s ease,
        height .35s ease,
        background .35s ease;
    }

    .streak-flame-svg {
      position: relative;
      z-index: 1;
      width: var(--flame-size);
      height: var(--flame-size);
      overflow: visible;
      color: var(--flame-main);
      filter: drop-shadow(0 6px var(--flame-glow));
      transform-origin: 50% 85%;
      transition:
        width .35s ease,
        height .35s ease,
        color .35s ease,
        filter .35s ease;
      animation: streakFlamePulse 2.5s ease-in-out infinite;
    }

    .streak-flame-core {
      fill: var(--flame-core);
      transition: fill .35s ease;
    }

    .streak-stage-label {
      grid-area: stage;
      margin-top: 7px;
      color: var(--flame-main);
      font-size: 8px;
      font-weight: 850;
      text-transform: uppercase;
      letter-spacing: .055em;
    }

    .streak-card-v19[data-streak-tier="1"] {
      --flame-size: 38px;
      --flame-main: #f5a524;
      --flame-core: #fde68a;
      --flame-glow: rgba(245, 165, 36, .24);
    }

    .streak-card-v19[data-streak-tier="2"] {
      --flame-size: 45px;
      --flame-main: #ff7a1a;
      --flame-core: #ffd166;
      --flame-glow: rgba(255, 122, 26, .30);
    }

    .streak-card-v19[data-streak-tier="3"] {
      --flame-size: 52px;
      --flame-main: #ff4d2e;
      --flame-core: #ffb347;
      --flame-glow: rgba(255, 77, 46, .34);
    }

    .streak-card-v19[data-streak-tier="4"] {
      --flame-size: 58px;
      --flame-main: #e43dff;
      --flame-core: #ff9bf0;
      --flame-glow: rgba(228, 61, 255, .32);
    }

    .streak-card-v19[data-streak-tier="5"] {
      --flame-size: 64px;
      --flame-main: #7c4dff;
      --flame-core: #c7b8ff;
      --flame-glow: rgba(124, 77, 255, .34);
    }

    .streak-card-v19[data-streak-tier="6"] {
      --flame-size: 70px;
      --flame-main: #169bff;
      --flame-core: #8fddff;
      --flame-glow: rgba(22, 155, 255, .38);
    }

    @keyframes streakFlamePulse {
      0%,
      100% {
        transform: translateY(1px) scale(.97) rotate(-1deg);
      }

      50% {
        transform: translateY(-2px) scale(1.035) rotate(1deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .streak-flame-svg {
        animation: none;
      }

      .dashboard-passive-ccq-stage {
        transition: none;
      }
    }
  </style>
'''

    html = insert_before_once(
        html,
        "</head>",
        dashboard_style,
        "CSS do Dashboard V19"
    )

    html = html.replace(
        "dashboard.js?v=11.7",
        "dashboard.js?v=19.0"
    )

    return html


def patch_dashboard_js(js):
    js = js.replace(
        "    loadQuestionDifficulty(),\n",
        ""
    )

    feature_marker = (
        "async function loadDashboardMetrics()"
    )

    dashboard_features = r'''
/* =========================================================
   V19 — CCQ FIXO NO DASHBOARD
   ========================================================= */

const DASHBOARD_CCQ_ROTATION_MS =
  30000;


const dashboardCcqState = {
  items: [],
  currentIndex: -1,
  bag: [],
  timerId: null,
  transitionId: null
};


function shuffleDashboardCcqIndexes(
  count
) {
  const indexes =
    Array.from(
      { length: count },
      (_, index) =>
        index
    );


  for (
    let i =
      indexes.length - 1;
    i > 0;
    i -= 1
  ) {
    const j =
      Math.floor(
        Math.random()
        * (
          i + 1
        )
      );


    [
      indexes[i],
      indexes[j]
    ] =
      [
        indexes[j],
        indexes[i]
      ];
  }


  return indexes;
}


function refillDashboardCcqBag() {
  dashboardCcqState.bag =
    shuffleDashboardCcqIndexes(
      dashboardCcqState.items.length
    );


  if (
    dashboardCcqState.items.length > 1
    &&
    dashboardCcqState.currentIndex >= 0
    &&
    dashboardCcqState.bag[
      dashboardCcqState.bag.length - 1
    ] ===
      dashboardCcqState.currentIndex
  ) {
    [
      dashboardCcqState.bag[0],
      dashboardCcqState.bag[
        dashboardCcqState.bag.length - 1
      ]
    ] =
      [
        dashboardCcqState.bag[
          dashboardCcqState.bag.length - 1
        ],
        dashboardCcqState.bag[0]
      ];
  }
}


function nextDashboardCcqIndex() {
  if (
    !dashboardCcqState.items.length
  ) {
    return -1;
  }


  if (
    dashboardCcqState.items.length ===
    1
  ) {
    return 0;
  }


  if (
    !dashboardCcqState.bag.length
  ) {
    refillDashboardCcqBag();
  }


  let index =
    dashboardCcqState.bag.pop();


  if (
    index ===
      dashboardCcqState.currentIndex
    &&
    dashboardCcqState.bag.length
  ) {
    const alternative =
      dashboardCcqState.bag.pop();


    dashboardCcqState.bag.push(
      index
    );


    index =
      alternative;
  }


  return index;
}


function resetDashboardCcqProgress() {
  const bar =
    document.getElementById(
      "dashboard-passive-ccq-progress"
    );


  if (!bar) {
    return;
  }


  bar.style.transition =
    "none";


  bar.style.width =
    "0%";


  void bar.offsetWidth;


  bar.style.transition =
    `width ${DASHBOARD_CCQ_ROTATION_MS}ms linear`;


  requestAnimationFrame(
    () => {
      bar.style.width =
        "100%";
    }
  );
}


function writeDashboardCcq(
  item
) {
  const text =
    document.getElementById(
      "dashboard-passive-ccq-text"
    );


  const meta =
    document.getElementById(
      "dashboard-passive-ccq-meta"
    );


  if (text) {
    text.textContent =
      item?.ccq ||
      "";
  }


  if (meta) {
    const metaText =
      [
        item?.area,
        item?.materia,
        item?.theme
      ]
        .filter(
          Boolean
        )
        .join(
          " · "
        );


    meta.textContent =
      metaText;


    meta.hidden =
      !metaText;
  }
}


function showNextDashboardCcq(
  animate = true
) {
  if (
    !dashboardCcqState.items.length
  ) {
    return;
  }


  const stage =
    document.getElementById(
      "dashboard-passive-ccq-stage"
    );


  const nextIndex =
    nextDashboardCcqIndex();


  if (
    nextIndex < 0
  ) {
    return;
  }


  const nextItem =
    dashboardCcqState.items[
      nextIndex
    ];


  window.clearTimeout(
    dashboardCcqState.transitionId
  );


  if (
    !animate ||
    !stage
  ) {
    dashboardCcqState.currentIndex =
      nextIndex;


    writeDashboardCcq(
      nextItem
    );


    resetDashboardCcqProgress();


    return;
  }


  stage.classList.add(
    "is-leaving"
  );


  dashboardCcqState.transitionId =
    window.setTimeout(
      () => {
        dashboardCcqState.currentIndex =
          nextIndex;


        writeDashboardCcq(
          nextItem
        );


        stage.classList.remove(
          "is-leaving"
        );


        stage.classList.add(
          "is-entering"
        );


        requestAnimationFrame(
          () => {
            requestAnimationFrame(
              () => {
                stage.classList.remove(
                  "is-entering"
                );
              }
            );
          }
        );


        resetDashboardCcqProgress();
      },
      300
    );
}


function startDashboardCcqRotation() {
  if (
    dashboardCcqState.timerId
  ) {
    clearInterval(
      dashboardCcqState.timerId
    );
  }


  if (
    dashboardCcqState.items.length < 2
  ) {
    dashboardCcqState.timerId =
      null;


    return;
  }


  dashboardCcqState.timerId =
    window.setInterval(
      () => {
        if (
          !document.hidden
        ) {
          showNextDashboardCcq(
            true
          );
        }
      },
      DASHBOARD_CCQ_ROTATION_MS
    );
}


async function loadDashboardPassiveCcqs() {
  const empty =
    document.getElementById(
      "dashboard-passive-ccq-empty"
    );


  const stage =
    document.getElementById(
      "dashboard-passive-ccq-stage"
    );


  if (
    !empty ||
    !stage
  ) {
    return;
  }


  const {
    data,
    error
  } =
    await dashboardSb
      .from(
        "error_notebook"
      )
      .select(
        "id,area,materia,theme,ccq,due_date,review_count,created_at"
      )
      .eq(
        "active",
        true
      )
      .not(
        "ccq",
        "is",
        null
      )
      .limit(
        100
      );


  if (error) {
    console.warn(
      "Não foi possível carregar os CCQs no Dashboard:",
      error.message
    );


    empty.hidden =
      false;


    empty.textContent =
      "Sem CCQs disponíveis.";


    stage.hidden =
      true;


    return;
  }


  dashboardCcqState.items =
    (data || [])
      .filter(
        (item) =>
          String(
            item.ccq ||
            ""
          ).trim()
      );


  dashboardCcqState.currentIndex =
    -1;


  dashboardCcqState.bag =
    [];


  if (
    !dashboardCcqState.items.length
  ) {
    empty.hidden =
      false;


    empty.textContent =
      "Nenhum CCQ ativo no Caderno de Erros.";


    stage.hidden =
      true;


    return;
  }


  empty.hidden =
    true;


  stage.hidden =
    false;


  showNextDashboardCcq(
    false
  );


  startDashboardCcqRotation();
}


function initDashboardPassiveCcq() {
  loadDashboardPassiveCcqs();


  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        !document.hidden
        &&
        dashboardCcqState.items.length
      ) {
        resetDashboardCcqProgress();

        startDashboardCcqRotation();
      }
    }
  );
}


/* =========================================================
   V19 — OFENSIVA COM CHAMA PROGRESSIVA
   ========================================================= */

function dashboardStreakTier(
  days
) {
  if (days <= 0) {
    return {
      tier: "0",
      label: "Comece hoje"
    };
  }

  if (days < 7) {
    return {
      tier: "1",
      label: "Aquecendo"
    };
  }

  if (days < 30) {
    return {
      tier: "2",
      label: "1 semana+"
    };
  }

  if (days < 90) {
    return {
      tier: "3",
      label: "1 mês+"
    };
  }

  if (days < 180) {
    return {
      tier: "4",
      label: "3 meses+"
    };
  }

  if (days < 365) {
    return {
      tier: "5",
      label: "6 meses+"
    };
  }

  return {
    tier: "6",
    label: "1 ano+"
  };
}


function initDashboardStreakVisual() {
  const card =
    document.getElementById(
      "dashboard-streak-card"
    );


  const value =
    card?.querySelector(
      "[data-streak-value]"
    );


  const label =
    document.getElementById(
      "dashboard-streak-stage"
    );


  if (
    !card ||
    !value
  ) {
    return;
  }


  const update =
    () => {
      const days =
        Number(
          String(
            value.textContent ||
            "0"
          )
            .replace(
              /[^\d]/g,
              ""
            )
        )
        ||
        0;


      const info =
        dashboardStreakTier(
          days
        );


      card.dataset.streakTier =
        info.tier;


      if (label) {
        label.textContent =
          info.label;
      }
    };


  const observer =
    new MutationObserver(
      update
    );


  observer.observe(
    value,
    {
      childList: true,
      characterData: true,
      subtree: true
    }
  );


  update();
}


'''

    js = insert_before_once(
        js,
        feature_marker,
        dashboard_features,
        "CCQ e ofensiva no Dashboard"
    )

    init_old = r'''async function initDashboard() {
  wireDashboardControls();

  await Promise.all([
'''

    init_new = r'''async function initDashboard() {
  wireDashboardControls();

  initDashboardPassiveCcq();
  initDashboardStreakVisual();

  await Promise.all([
'''

    js = replace_once(
        js,
        init_old,
        init_new,
        "inicialização do CCQ e ofensiva"
    )

    return js


def validate_files(files):
    ambient_html = files["ambientacao.html"]
    ambient_js = files["ambientacao.js"]
    dashboard_html = files["dashboard.html"]
    dashboard_js = files["dashboard.js"]

    checks = {
        "Agenda restaurada: agendaState":
            "const agendaState" in dashboard_js,

        "Agenda restaurada: loadAgenda":
            "loadAgenda()" in dashboard_js,

        "Agenda restaurada: controles semana/mês":
            'document.getElementById("view-week")' in dashboard_js
            and 'document.getElementById("view-month")' in dashboard_js,

        "CCQ removido do HTML da Ambientação":
            "ccq-showcase-panel" not in ambient_html,

        "CCQ removido da lógica da Ambientação":
            "loadCcqRotation" not in ambient_js
            and "initCcqRotation" not in ambient_js,

        "Caderno da aula na Ambientação":
            '"caderno.html"' in ambient_js
            and '"topic_id"' in ambient_js,

        "CCQ fixo no Dashboard":
            "dashboard-passive-ccq-card" in dashboard_html
            and "loadDashboardPassiveCcqs" in dashboard_js,

        "Maior dificuldade removida do HTML":
            "Maior dificuldade" not in dashboard_html,

        "Ofensiva com chama":
            "streak-flame-svg" in dashboard_html
            and "dashboardStreakTier" in dashboard_js,

        "CCQ centralizado e maior":
            "font-size: 14.5px" in dashboard_html
            and "text-align: center" in dashboard_html,
    }

    failed = [
        name
        for name, ok in checks.items()
        if not ok
    ]

    if failed:
        raise RuntimeError(
            "Validação falhou:\n- "
            + "\n- ".join(failed)
        )

    return checks


def node_check(path):
    node = shutil.which(
        "node"
    )

    if not node:
        return (
            False,
            "Node não instalado; validação JS por sintaxe foi pulada."
        )

    result = run(
        [
            node,
            "--check",
            str(path)
        ],
        check=False
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"Erro de sintaxe em {path.name}:\n"
            + (result.stderr or result.stdout)
        )

    return (
        True,
        f"{path.name}: sintaxe OK"
    )


def main():
    print("")
    print("RESIBULANDO V19 — REPARO COMPLETO")
    print("==================================")
    print("")

    ensure_git_repo()
    ensure_base_commit()

    print("1/6 Criando backup dos arquivos atuais...")
    backup_current_files()

    print("2/6 Recuperando a última versão estável...")
    files = {
        name: git_show(name)
        for name in FILES
    }

    print("3/6 Reconstruindo Ambientação...")
    files["ambientacao.html"] = patch_ambientacao_html(
        files["ambientacao.html"]
    )

    files["ambientacao.css"] = patch_ambientacao_css(
        files["ambientacao.css"]
    )

    files["ambientacao.js"] = patch_ambientacao_js(
        files["ambientacao.js"]
    )

    print("4/6 Reconstruindo Dashboard e Agenda...")
    files["dashboard.html"] = patch_dashboard_html(
        files["dashboard.html"]
    )

    files["dashboard.js"] = patch_dashboard_js(
        files["dashboard.js"]
    )

    print("5/6 Validando estrutura...")
    checks = validate_files(
        files
    )

    for name in FILES:
        (ROOT / name).write_text(
            files[name],
            encoding="utf-8"
        )

    js_results = [
        node_check(
            ROOT / "ambientacao.js"
        ),
        node_check(
            ROOT / "dashboard.js"
        ),
    ]

    print("6/6 Concluído.")
    print("")

    for name in checks:
        print("✓", name)

    for _, message in js_results:
        print("✓", message)

    print("")
    print("Backup salvo em:")
    print(BACKUP_DIR)
    print("")
    print("Agora rode:")
    print("  git add ambientacao.html ambientacao.css ambientacao.js dashboard.html dashboard.js")
    print('  git commit -m "Repara agenda, CCQ e ambientacao"')
    print("  git push")
    print("")
    print("Depois faça Ctrl + Shift + R no navegador.")
    print("")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("")
        print("ERRO:")
        print(error)
        print("")
        print("Não faça commit enquanto esse erro não for corrigido.")
        sys.exit(1)
