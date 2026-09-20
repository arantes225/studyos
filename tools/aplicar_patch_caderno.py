from pathlib import Path
import re
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
html_path = ROOT / "caderno-erros.html"
js_path = ROOT / "caderno-erros.js"

if not html_path.exists() or not js_path.exists():
    raise SystemExit("Coloque este script na raiz do projeto ou passe a pasta do projeto como argumento.")

html = html_path.read_text(encoding="utf-8")
js = js_path.read_text(encoding="utf-8")

if "caderno-recursos.css" not in html:
    marker = '<link rel="stylesheet" href="resibulando-brand-v5.css?v=5">'
    injection = '  <link rel="stylesheet" href="caderno-recursos.css?v=14.0">\n'
    if marker in html:
        html = html.replace(marker, injection + marker, 1)
    else:
        html = html.replace("</head>", injection + "</head>", 1)

html = html.replace("Imagem da questão", "Imagem 1", 1)

new_block = r"""
              <div class="error-rich-builder" id="new-error-rich-builder">

                <section class="error-rich-section">
                  <div class="error-rich-section-head">
                    <div>
                      <h3>Imagem 2</h3>
                      <p>Opcional. O Caderno aceita no máximo duas imagens por item.</p>
                    </div>
                  </div>

                  <div class="error-rich-image-row">
                    <input id="new-error-image-2" type="file" accept="image/*">
                    <button id="remove-new-error-image-2" class="button secondary" type="button">Remover</button>
                  </div>

                  <span id="new-error-image-2-info" class="error-rich-status" aria-live="polite"></span>
                </section>

                <section class="error-rich-section">
                  <div class="error-rich-section-head">
                    <div>
                      <h3>Tabela</h3>
                      <p>Crie do zero ou reconheça uma tabela a partir da imagem 1 ou 2.</p>
                    </div>
                  </div>

                  <div class="rich-table-tools">
                    <button id="new-table-new" class="button secondary" type="button">Nova tabela</button>

                    <select id="new-table-image-source" aria-label="Imagem usada no leitor de tabelas">
                      <option value="1">Ler imagem 1</option>
                      <option value="2">Ler imagem 2</option>
                    </select>

                    <button id="new-table-from-image" class="button secondary" type="button">Reconhecer tabela</button>
                    <button id="new-table-add-row" class="button secondary" type="button">+ linha</button>
                    <button id="new-table-add-col" class="button secondary" type="button">+ coluna</button>
                    <button id="new-table-remove-row" class="button secondary" type="button">− linha</button>
                    <button id="new-table-remove-col" class="button secondary" type="button">− coluna</button>
                    <button id="new-table-clear" class="button secondary" type="button">Limpar</button>
                  </div>

                  <span id="new-table-status" class="error-rich-status" aria-live="polite"></span>
                  <div id="new-table-editor" class="rich-table-editor"></div>
                </section>

                <section class="error-rich-section">
                  <div class="error-rich-section-head">
                    <div>
                      <h3>Setas e fluxos</h3>
                      <p>Monte relações visuais entre conceitos, condutas ou etapas.</p>
                    </div>

                    <button id="new-arrow-add" class="button secondary" type="button">Adicionar seta</button>
                  </div>

                  <div id="new-arrow-list" class="rich-arrow-list"></div>
                </section>

              </div>
"""

if 'id="new-error-rich-builder"' not in html:
    marker = '\n            </div>\n\n\n            <datalist id="error-medical-areas"'
    if marker not in html:
        raise SystemExit("Não encontrei o fim do formulário de Novo erro.")
    html = html.replace(marker, "\n" + new_block + marker, 1)

if 'id="error-rich-content"' not in html:
    marker = '\n              <div class="error-card-actions">'
    rich_review = '\n              <div id="error-rich-content" class="error-rich-content"></div>\n'
    if marker not in html:
        raise SystemExit("Não encontrei os botões do cartão de revisão.")
    html = html.replace(marker, rich_review + marker, 1)

edit_block = r"""
      <div class="error-rich-edit-builder" id="error-rich-edit-builder">

        <section class="error-rich-section">
          <div class="error-rich-section-head">
            <div>
              <h3>Imagens</h3>
              <p>Mantenha, remova ou adicione imagens. Limite total: 2.</p>
            </div>
          </div>

          <div id="error-rich-edit-gallery" class="error-rich-edit-gallery"></div>

          <div class="error-rich-image-row">
            <input id="error-rich-edit-images" type="file" accept="image/*" multiple>
          </div>

          <span id="error-rich-edit-status" class="error-rich-status" aria-live="polite"></span>
        </section>

        <section class="error-rich-section">
          <div class="error-rich-section-head">
            <div>
              <h3>Tabela</h3>
              <p>Edite a tabela estruturada deste item.</p>
            </div>
          </div>

          <div class="rich-table-tools">
            <button id="edit-table-new" class="button secondary" type="button">Nova tabela</button>
            <button id="edit-table-add-row" class="button secondary" type="button">+ linha</button>
            <button id="edit-table-add-col" class="button secondary" type="button">+ coluna</button>
            <button id="edit-table-remove-row" class="button secondary" type="button">− linha</button>
            <button id="edit-table-remove-col" class="button secondary" type="button">− coluna</button>
            <button id="edit-table-clear" class="button secondary" type="button">Limpar</button>
          </div>

          <div id="edit-table-editor" class="rich-table-editor"></div>
        </section>

        <section class="error-rich-section">
          <div class="error-rich-section-head">
            <div>
              <h3>Setas e fluxos</h3>
              <p>Edite as relações visuais do item.</p>
            </div>

            <button id="edit-arrow-add" class="button secondary" type="button">Adicionar seta</button>
          </div>

          <div id="edit-arrow-list" class="rich-arrow-list"></div>
        </section>

      </div>
"""

if 'id="error-rich-edit-builder"' not in html:
    marker = '\n      <div class="error-edit-actions">'
    if marker in html:
        html = html.replace(marker, "\n" + edit_block + marker, 1)
    elif 'id="error-edit-dialog"' in html:
        # Fallback para versões com espaçamento diferente.
        match = re.search(r'\n\s*<div\s+class="error-edit-actions">', html)
        if match:
            html = html[:match.start()] + "\n" + edit_block + html[match.start():]
        else:
            print("Aviso: dialog de edição encontrado, mas não foi possível inserir o editor rico.")
    else:
        print("Aviso: esta versão não possui dialog de edição; criação/revisão continuam funcionando.")

if "caderno-recursos.js" not in html:
    pattern = r'(<script\s+src="caderno-erros\.js\?v=[^"]+"\s*></script>)'
    replacement = r'\1\n  <script src="caderno-recursos.js?v=14.0"></script>'
    new_html, count = re.subn(pattern, replacement, html, count=1)
    if count == 0:
        html = html.replace("</body>", '  <script src="caderno-recursos.js?v=14.0"></script>\n</body>', 1)
    else:
        html = new_html

hook = """  await showErrorImage(
    item.question_image_path
  );"""

if "renderRichErrorContent" not in js:
    replacement = hook + """

  window.__currentErrorRichId =
    item.id;

  await window
    .renderRichErrorContent?.(
      item
    );"""
    if hook not in js:
        raise SystemExit("Não encontrei showErrorImage no caderno-erros.js.")
    js = js.replace(hook, replacement, 1)

html_path.write_text(html, encoding="utf-8")
js_path.write_text(js, encoding="utf-8")

print("Patch aplicado com sucesso.")
print("Copie caderno-recursos.css e caderno-recursos.js para a raiz.")
print("Depois rode fase14_caderno_conteudo_rico.sql no Supabase.")
