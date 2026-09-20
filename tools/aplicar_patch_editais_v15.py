from pathlib import Path
import re
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
html_path = ROOT / "editais.html"

if not html_path.exists():
    raise SystemExit("Não encontrei editais.html. Rode este script na raiz do projeto ou passe a pasta como argumento.")

html = html_path.read_text(encoding="utf-8")

# Backup simples
backup = html_path.with_suffix(".html.bak-v15")
if not backup.exists():
    backup.write_text(html, encoding="utf-8")

# Remove a aba "Editar provas"
html = re.sub(
    r'\s*<button\s+class="exam-mode-tab"\s+type="button"\s+data-exam-mode="edit"\s*>\s*Editar provas\s*</button>',
    '',
    html,
    flags=re.I | re.S
)

# Injeta o CSS complementar
if "editais-v15.css" not in html:
    css_tag = '  <link rel="stylesheet" href="editais-v15.css?v=15.0">\n'
    m = re.search(
        r'(<link\s+rel="stylesheet"\s+href="editais\.css\?v=[^"]+"\s*>)',
        html,
        flags=re.I
    )

    if m:
        html = html[:m.end()] + "\n" + css_tag + html[m.end():]
    else:
        html = html.replace("</head>", css_tag + "</head>", 1)

# Injeta o JS complementar depois do editais.js atual
if "editais-v15.js" not in html:
    js_tag = '  <script src="editais-v15.js?v=15.0"></script>\n'
    m = re.search(
        r'(<script\s+src="editais\.js\?v=[^"]+"\s*></script>)',
        html,
        flags=re.I
    )

    if m:
        html = html[:m.end()] + "\n" + js_tag + html[m.end():]
    else:
        html = html.replace("</body>", js_tag + "</body>", 1)

html_path.write_text(html, encoding="utf-8")

print("Patch aplicado em editais.html.")
print("Backup:", backup.name)
print()
print("Confirme que estes arquivos estão na raiz:")
print(" - editais-v15.css")
print(" - editais-v15.js")
print()
print("E rode fase15_provas_notas_corte.sql no Supabase antes de usar as notas de corte.")
