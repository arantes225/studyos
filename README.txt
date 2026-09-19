RESIBULANDO — FASE 12.5
DASHBOARD DE QUESTÕES ALINHADO COM "MEUS SIMULADOS"

CORREÇÃO
Os 9 cards do dashboard agora usam 100% da mesma largura disponível
do retângulo "Meus simulados" logo abaixo.

Desktop:
[ 1 ] [ 2 ] [ 3 ]
[ 4 ] [ 5 ] [ 6 ]
[ 7 ] [ 8 ] [ 9 ]

As bordas esquerda e direita ficam alinhadas ao bloco inferior.

Para evitar que os cards voltem a ficar gigantes, eles têm altura compacta
de aproximadamente 205 px no desktop.

ARQUIVOS PARA SUBSTITUIR
- questoes-simulados.html
- questoes-simulados.js

NÃO PRECISA RODAR SQL.

PUBLICAR
git add -A
git commit -m "Alinha dashboard de questoes"
git pull --rebase origin main
git push origin main

Depois:
Ctrl + Shift + R
