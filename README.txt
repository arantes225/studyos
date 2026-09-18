RESIBULANDO — HOTFIX LOGOS

CORRIGE:
- Cronograma mostrando 3 logos ao mesmo tempo.
- Dashboard mostrando logo antiga.

A correção agora usa UMA ÚNICA imagem no menu lateral.
O app.js troca o arquivo de acordo com o tema:

Claro:
logo-icone-original.png

Escuro:
logo-icone-azul-claro.png

Rosa:
logo-icone-rosa-escuro.png

Também alterei a versão carregada em TODAS as páginas para:
style.css?v=resibulando2
app.js?v=resibulando2

Isso evita que o navegador use o CSS/JS antigo em cache.

COMO INSTALAR

1. Extraia o ZIP.
2. Copie TODOS os arquivos para a raiz do projeto.
3. Escolha substituir quando solicitado.
4. Confirme que os PNGs continuam na raiz.

Depois:

git add -A
git commit -m "Corrige logos Resibulando por tema"
git pull --rebase origin main
git push origin main

Depois que o GitHub Pages atualizar:
Ctrl + Shift + R

Se preferir:
Ctrl + F5

NÃO PRECISA RODAR SQL.
