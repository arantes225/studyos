DOCMAP — FASE 11.1
IMPORTADOR INTELIGENTE DE CRONOGRAMAS

O QUE ENTROU

1. IMPORTAÇÃO DE PDF
- aceita PDF com texto selecionável
- usa PDF.js no navegador
- lê texto + posição dos elementos
- reconhece planners mensais semelhantes ao Aristo
- tenta reconstruir cada semana

2. ARISTO 2026/2027
O parser foi testado contra o planner enviado nesta conversa.
Na validação local ele reconheceu:
- 128 aulas
- 37 simulados programados/diagnóstico
- 36 simulados inteligentes
- 20 provas na íntegra
- 14 blocos de reta final
- 11 revisões inteligentes
- 11 revisões teóricas
TOTAL: 257 itens

3. EXCEL / CSV MELHORADOS
- continua aceitando XLSX / XLS / CSV
- tenta ler mais de uma aba
- aliases de cabeçalho continuam funcionando
- detecta Tipo/Categoria quando existe
- também identifica simulados pelo nome

4. PRÉVIA EDITÁVEL
Antes de importar você pode alterar:
- data
- tipo
- área
- matéria
- conteúdo
- aula já feita
- data estudada

Confiança:
- Alta = padrão bem reconhecido
- Revisar = heurística provável
- Baixa = confira antes de importar

5. DUPLICADOS
O DocMap compara o arquivo com o que já existe.
Itens já existentes ficam desmarcados automaticamente.

6. EVENTOS NÃO VIRAM AULAS
Simulados, provas externas, revisões do planner e reta final são gravados
em public.schedule_events. Assim eles aparecem na Agenda sem gerar
revisões automáticas de matéria.

7. CRONOGRAMA
Eventos importados também aparecem no planejador semanal.

ARQUIVOS

RODE PRIMEIRO:
- fase11_importador_inteligente.sql

SUBSTITUA:
- cronograma.html
- cronograma.js
- dashboard.js

NÃO RODE SQL MESTRE / RESET.

PUBLICAÇÃO

git add -A
git commit -m "Fase 11 importador inteligente de cronogramas"
git push origin main

Depois:
Ctrl + F5

TESTE RECOMENDADO

1. Abra Cronograma.
2. Importe o PDF do Planner Aristo 2026/2027.
3. Aguarde a leitura das páginas.
4. Confira a prévia.
5. Itens de baixa/média confiança podem ser corrigidos ali mesmo.
6. Clique em "Importar selecionados".
7. Verifique Cronograma e Dashboard/Agenda.

LIMITAÇÃO INTENCIONAL

O PDF Aristo não informa explicitamente a Grande Área de cada aula.
O DocMap NÃO inventa a área. Ela fica vazia, a menos que você preencha
na prévia ou o arquivo original traga essa coluna.

PDF escaneado como imagem, sem camada de texto, ainda não usa OCR.
