DOCMAP — FASE 11.12

CRONOGRAMA

Alteração de posição:
- "Reorganizar aulas atrasadas" foi movido para logo abaixo do Planejador semanal.
- O funcionamento continua exatamente igual:
  - solicita data final
  - distribui de hoje até a data final
  - respeita dias de estudo teórico
  - respeita o máximo de aulas por dia definido em Configurações

A nova ordem fica:
1. Adicionar aulas
2. Planejador semanal
3. Reorganizar aulas atrasadas
4. Deck não programado
5. Lista de temas

INSTALAÇÃO

NÃO PRECISA RODAR SQL.
NÃO PRECISA TROCAR cronograma.js.

SUBSTITUA SOMENTE:
- cronograma.html

PUBLICAÇÃO:

git add -A
git commit -m "Move reorganizacao de atrasadas para baixo do planner"
git push origin main

Depois:
Ctrl + F5
