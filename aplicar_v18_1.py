from pathlib import Path
import subprocess
import re

ROOT = Path(__file__).resolve().parent

BASE_COMMIT = "c00b6f7deb56f6472b18b538268944a122f2a487"


def git_show(path):
    result = subprocess.run(
        ["git", "show", f"{BASE_COMMIT}:{path}"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8"
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"Não consegui recuperar {path} do histórico do Git.\n"
            f"{result.stderr}"
        )

    return result.stdout


def remove_html_section_by_class(html, class_name):
    marker = f'class="{class_name}"'
    marker_pos = html.find(marker)

    if marker_pos < 0:
        return html

    start = html.rfind("<section", 0, marker_pos)

    if start < 0:
        raise RuntimeError(
            f"Não encontrei o início do section {class_name}."
        )

    tag_pattern = re.compile(r"</?section\b[^>]*>", re.I)
    depth = 0

    for match in tag_pattern.finditer(html, start):
        tag = match.group(0)

        if tag.lower().startswith("</section"):
            depth -= 1

            if depth == 0:
                return html[:start] + html[match.end():]
        else:
            depth += 1

    raise RuntimeError(
        f"Não encontrei o fim do section {class_name}."
    )


def remove_ccq_logic_from_ambientacao(js):
    marker = "FASE 7.1 — CCQs COMO MOSTRADOR AUTOMÁTICO"
    pos = js.find(marker)

    if pos < 0:
        return js

    start = js.rfind("/*", 0, pos)
    end = js.find(
        "function bindAmbientacaoLofi",
        pos
    )

    if start < 0 or end < 0:
        raise RuntimeError(
            "Não consegui delimitar o bloco antigo de CCQ em ambientacao.js."
        )

    return js[:start] + js[end:]


def ensure_after(text, marker, addition):
    if addition in text:
        return text

    if marker not in text:
        raise RuntimeError(
            f"Marcador não encontrado: {marker}"
        )

    return text.replace(
        marker,
        marker + "\n" + addition,
        1
    )


print("1/5 Restaurando ambientacao.js e dashboard.js completos...")

ambientacao_js = git_show("ambientacao.js")
dashboard_js = git_show("dashboard.js")

ambientacao_js = remove_ccq_logic_from_ambientacao(
    ambientacao_js
)

(ROOT / "ambientacao.js").write_text(
    ambientacao_js,
    encoding="utf-8"
)

(ROOT / "dashboard.js").write_text(
    dashboard_js,
    encoding="utf-8"
)


print("2/5 Removendo o CCQ do HTML da Ambientação...")

ambientacao_html_path = ROOT / "ambientacao.html"
ambientacao_html = ambientacao_html_path.read_text(
    encoding="utf-8"
)

ambientacao_html = remove_html_section_by_class(
    ambientacao_html,
    "panel ccq-showcase-panel"
)

ambientacao_html = ensure_after(
    ambientacao_html,
    '<script src="ambientacao.js?v=12.9"></script>',
    '<script src="ambientacao-v18.1.js?v=18.1"></script>'
)

ambientacao_html_path.write_text(
    ambientacao_html,
    encoding="utf-8"
)


print("3/5 Mantendo o CCQ exclusivamente no Dashboard...")

dashboard_html_path = ROOT / "dashboard.html"
dashboard_html = dashboard_html_path.read_text(
    encoding="utf-8"
)

dashboard_html = ensure_after(
    dashboard_html,
    '<script src="dashboard.js?v=11.7"></script>',
    '<script src="dashboard-v18.1.js?v=18.1"></script>'
)

dashboard_html_path.write_text(
    dashboard_html,
    encoding="utf-8"
)


print("4/5 Validando...")

ambientacao_final = ambientacao_html_path.read_text(
    encoding="utf-8"
)

ambientacao_js_final = (
    ROOT / "ambientacao.js"
).read_text(
    encoding="utf-8"
)

dashboard_final = dashboard_html_path.read_text(
    encoding="utf-8"
)

checks = {
    "CCQ fora do HTML da Ambientação":
        "ccq-showcase-panel" not in ambientacao_final,

    "Lógica de rotação fora do JS da Ambientação":
        "loadCcqRotation" not in ambientacao_js_final
        and "initCcqRotation" not in ambientacao_js_final,

    "Caderno da aula carregado pela V18.1":
        "ambientacao-v18.1.js" in ambientacao_final,

    "Revisão passiva carregada pelo Dashboard":
        "dashboard-v18.1.js" in dashboard_final,
}

failed = [
    name
    for name, ok in checks.items()
    if not ok
]

if failed:
    raise RuntimeError(
        "Falhou a validação:\n- "
        + "\n- ".join(failed)
    )


print("5/5 Pronto.")
print("")
for name in checks:
    print(f"✓ {name}")

print("")
print("Agora faça commit/push e Ctrl + Shift + R.")
