DOCMAP — HOTFIX FASE 3

O problema visual da agenda ocorre porque o navegador/GitHub Pages ainda está servindo
o style.css antigo em cache.

Este hotfix separa o CSS da agenda em fase3.css, evitando depender do cache antigo.

SUBSTITUA/ADICIONE:
- dashboard.html        substituir
- ambientacao.html      substituir
- dashboard.js          substituir
- ambientacao.js        substituir
- fase3.css             NOVO

NÃO apague style.css.
NÃO rode SQL.

Depois:
git add -A
git commit -m "Corrige estilos da agenda"
git push origin main

Depois abra o site e use Ctrl+F5 uma vez.
