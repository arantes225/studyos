DOCMAP — FASE 4.2 NOVA: QUESTÕES E SIMULADOS

ESTA FASE SUBSTITUI a antiga tela "Registrar questões".

ORDEM:

1) SUPABASE
Rode UMA VEZ:
fase4_2_questoes_simulados.sql

Se você algum dia precisar recriar o banco inteiro do zero,
o arquivo atualizado é:
docmap_sql_mestre_v4_2.sql

2) REPOSITÓRIO
Substitua:
- app.js
- dashboard.html
- dashboard.js

Adicione:
- questoes-simulados.html
- questoes-simulados.js

Os antigos:
- registrar-questoes.html
- registrar-questoes.js
podem ser apagados, porque não serão mais usados.

3) PUBLICAR
git add -A
git commit -m "Fase 4.2 - questoes e simulados"
git push origin main

Depois:
Ctrl + F5


COMO FUNCIONA

1. Envie um PDF.
2. O DocMap extrai as questões do texto do PDF.
3. O simulado fica salvo no histórico.
4. Abra o simulado.
5. Marque SOMENTE as questões que você errou.
6. Para cada erro:
   - selecione a Área
   - Matéria é opcional
   - selecione a alternativa correta
   - "O que pensei" é opcional
7. Clique "Salvar gabarito".
8. Clique "Enviar erros ao Caderno de Erros".

A questão completa é enviada automaticamente para o Caderno de Erros.
O CCQ inicial fica como:
"Questão X - Nome do simulado"

Você pode aprimorar esse CCQ depois no Caderno de Erros.


DASHBOARD

Foi adicionado:
MAIOR DIFICULDADE

A métrica usa as áreas das QUESTÕES ERRADAS classificadas.
Como as questões corretas não precisam ser classificadas, ela NÃO é apresentada
como "taxa de acerto por área".

Exemplo:
Cirurgia Geral
14 erros · 35% dos erros classificados

Com menos de 3 erros na área, o Dashboard mostra "poucos dados".


PDF

Nesta versão, o parser funciona com PDFs que possuem texto selecionável,
como o exemplo Aristo usado no desenvolvimento.

PDFs que sejam apenas imagens/scans ainda não passam por OCR automático.
Isso pode ser adicionado depois.

DETECÇÃO DE CORES

Ainda não está ativa nesta versão.
Primeiro deixamos o fluxo confiável:
PDF -> gabarito rápido -> erros -> Caderno de Erros.

Depois podemos adicionar:
PDF/print corrigido -> detectar vermelho/verde -> pré-marcar os erros.
