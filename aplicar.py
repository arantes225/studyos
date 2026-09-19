from pathlib import Path

ROOT = Path(__file__).resolve().parent

def add_after(path, marker, line):
    p = ROOT / path
    text = p.read_text(encoding="utf-8")

    if line in text:
        print(f"{path}: já configurado")
        return

    if marker not in text:
        raise RuntimeError(
            f"Não encontrei em {path}: {marker}"
        )

    text = text.replace(
        marker,
        marker + "\n" + line,
        1
    )

    p.write_text(
        text,
        encoding="utf-8"
    )

    print(f"{path}: atualizado")


add_after(
    "ambientacao.html",
    '<script src="ambientacao.js?v=12.9"></script>',
    '<script src="ambientacao-v18.js?v=18.0"></script>'
)

add_after(
    "dashboard.html",
    '<script src="dashboard.js?v=11.7"></script>',
    '<script src="dashboard-v18.js?v=18.0"></script>'
)

print("")
print("Pronto. Agora faça commit/push e recarregue com Ctrl+Shift+R.")
