from pathlib import Path
import re
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()

def inject_css(html, href):
    if href in html:
        return html

    tag = f'  <link rel="stylesheet" href="{href}">\n'

    if "</head>" not in html:
        raise RuntimeError("Não encontrei </head>.")

    return html.replace("</head>", tag + "</head>", 1)

def inject_js(html, src, after_pattern=None):
    if src in html:
        return html

    tag = f'  <script src="{src}"></script>\n'

    if after_pattern:
        match = re.search(after_pattern, html, flags=re.I)
        if match:
            return html[:match.end()] + "\n" + tag + html[match.end():]

    if "</body>" not in html:
        raise RuntimeError("Não encontrei </body>.")

    return html.replace("</body>", tag + "</body>", 1)

# =========================================================
# QUESTÕES / SIMULADOS
# =========================================================
qs_path = ROOT / "questoes-simulados.html"

if not qs_path.exists():
    raise SystemExit("Não encontrei questoes-simulados.html na pasta informada.")

qs_html = qs_path.read_text(encoding="utf-8")

backup = ROOT / "questoes-simulados.html.bak-v17"
if not backup.exists():
    backup.write_text(qs_html, encoding="utf-8")

qs_html = inject_css(
    qs_html,
    "questoes-simulados-v17.css?v=17.0"
)

qs_html = inject_js(
    qs_html,
    "questoes-simulados-v17.js?v=17.0",
    r'<script\s+src="questoes-simulados\.js\?v=[^"]+"\s*></script>'
)

qs_path.write_text(qs_html, encoding="utf-8")


# =========================================================
# ESTATÍSTICAS
# =========================================================
stats_path = ROOT / "estatisticas.html"

if not stats_path.exists():
    raise SystemExit("Não encontrei estatisticas.html na pasta informada.")

stats_html = stats_path.read_text(encoding="utf-8")

backup = ROOT / "estatisticas.html.bak-v17"
if not backup.exists():
    backup.write_text(stats_html, encoding="utf-8")

stats_html = inject_css(
    stats_html,
    "estatisticas-v17.css?v=17.0"
)

stats_html = inject_js(
    stats_html,
    "estatisticas-v17.js?v=17.0",
    r'<script\s+src="estatisticas\.js\?v=[^"]+"\s*></script>'
)

# Deixa a opção explícita no próprio HTML também.
stats_html = re.sub(
    r'(<button[^>]*data-range="all"[^>]*>)\s*Tudo\s*(</button>)',
    r'\1Desde sempre\2',
    stats_html,
    count=1,
    flags=re.I
)

stats_path.write_text(stats_html, encoding="utf-8")

print("Atualização v17 aplicada com sucesso.")
print()
print("Questões / Simulados:")
print(" - dashboard reduzido a 3 indicadores + gráfico linear")
print(" - botão 'Iniciar lista ou simulado' para ambientacao.html")
print()
print("Estatísticas:")
print(" - 3 x 3 callouts pequenos por aba")
print(" - apenas 9 indicadores principais")
print(" - temporalidade 'Desde sempre'")
print(" - textos redundantes de período removidos dos callouts")
print()
print("Arquivos de backup:")
print(" - questoes-simulados.html.bak-v17")
print(" - estatisticas.html.bak-v17")
