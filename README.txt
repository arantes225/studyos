DOCMAP — FASE 11.2
DASHBOARD + CRONOGRAMA + IMPORTAÇÃO ANKI

=========================================================
1. DASHBOARD INICIAL
=========================================================

NOVOS QUADRADOS:

- Aulas atrasadas
  Mostra quantas aulas do cronograma estão com data anterior a hoje
  e ainda não foram concluídas.

- Progresso das aulas
  Mostra aulas feitas / aulas totais e uma porcentagem em gráfico circular.

- Retenção dos flashcards
  Agora usa uma métrica específica de flashcards.
  O título foi ajustado para não confundir com retenção geral.

- Caderno de erros
  Mostra:
  * quantidade de CCQs atrasados
  * quantidade total ativa
  * retenção estimada em gráfico circular

- Simulados · 30 dias
  Mostra:
  * quantidade de simulados respondidos nos últimos 30 dias
  * % de acerto ponderada pelas questões respondidas
  * gráfico circular

A área "Simulados recentes" continua abaixo.

=========================================================
2. CRONOGRAMA
=========================================================

- Novo card "Aulas atrasadas" no topo.

- Novo botão:
  "Reorganizar atrasadas"

  Ele distribui TODAS as aulas atrasadas:
  * 1 aula por semana
  * começando de hoje em diante
  * respeitando os dias permitidos em
    Configurações > Dias de estudo > Estudo teórico

- Lista de temas agora tem:
  * Ver na semana / Ir para deck
  * Remover para o deck
  * Já feita

- Aulas atrasadas ficam visualmente destacadas.

- No planejador semanal, o botão "Remover" passou a se chamar
  "Remover para o deck".

=========================================================
3. FLASHCARDS — ANKI
=========================================================

O importador agora aceita:

- .xlsx
- .xls
- .csv
- .apkg
- .colpkg

Para pacotes Anki:

1. O DocMap abre o pacote no próprio navegador.
2. Lê collection.anki2 / collection.anki21.
3. Também tenta abrir o formato moderno collection.anki21b
   comprimido com Zstandard.
4. Identifica os decks existentes.
5. Mostra cada deck com um campo "Área no DocMap".
6. Você pode, por exemplo:
   Anki: Cirurgia
   -> Área no DocMap: Cirurgia Geral
7. Só depois os flashcards são importados.

Decks hierárquicos do Anki, como:
Residência::Cirurgia::Trauma
recebem por padrão a última parte:
Trauma

Você pode alterar antes de importar.

OBSERVAÇÃO SOBRE ANKI:
- O DocMap importa o conteúdo textual.
- Referências a imagens e áudios são detectadas,
  mas a mídia ainda não é copiada nesta etapa.
- Notas do tipo Cloze são convertidas para uma versão textual
  de frente/verso.
- Uma nota do Anki vira um flashcard no DocMap.

=========================================================
4. INSTALAÇÃO
=========================================================

PASSO 1 — SUPABASE

Rode UMA VEZ:

fase11_2_dashboard_cronograma_anki.sql

NÃO rode SQL mestre/reset.

PASSO 2 — SUBSTITUA

- dashboard.html
- dashboard.js
- cronograma.html
- cronograma.js
- flashcards.html
- flashcards.js
- flashcards.css

PASSO 3 — PUBLICAR

git add -A
git commit -m "Fase 11.2 dashboard cronograma e importacao Anki"
git push origin main

Depois:
Ctrl + F5

=========================================================
5. TESTES RECOMENDADOS
=========================================================

DASHBOARD:
- confira aulas atrasadas
- confira progresso
- confira Caderno de Erros
- confira simulados 30 dias

CRONOGRAMA:
- deixe uma aula em data anterior
- clique em Reorganizar atrasadas
- veja se ela foi movida para semana futura
- teste Remover para o deck na Lista de temas
- teste Já feita

ANKI:
- importe primeiro um .apkg pequeno
- confira os decks detectados
- escolha a Área de destino
- importe
- abra Biblioteca e confira a Área
- depois teste .colpkg
