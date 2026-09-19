RESIBULANDO — FASE 12.8

IMPLEMENTADO

1. CADERNO DE ERROS -> CONFIGURAÇÕES
Sequência de revisão:
7 + 21 + 21 + 21 + 21 + 21 dias

- 1ª revisão: +7 dias
- 2ª: +21
- 3ª: +21
- 4ª: +21
- 5ª: +21
- 6ª e seguintes: +21
- continua respeitando os dias permitidos do Caderno de Erros.

2. EDITAIS / PROVAS
Na aba normal "Provas", cada card agora possui um seletor de Status:
- Planejada
- Inscrita
- Realizada
- Cancelada

A mudança é salva imediatamente, sem precisar entrar no modo Editar provas.

3. FLASHCARDS
Novo painel visual:
- Retenção de conteúdo com indicador circular.
- Para revisar com barra visual.
- Atrasados com barra visual.
- Revisados hoje com indicador visual.
- Acerto hoje com indicador circular.

A retenção utiliza a mesma estimativa de memória já usada pelo Resibulando.

4. CRONOGRAMA
Lista de temas:
- agora mostra também as aulas concluídas;
- concluídas ficam visualmente identificadas;
- continuam podendo ser selecionadas para exclusão;
- não aparecem ações de "Já feita" / "Remover para deck" em itens concluídos.

Reorganizar aulas atrasadas:
- usa os dias configurados em "Estudo teórico";
- respeita "Máximo de aulas teóricas por dia";
- o diálogo mostra quais dias e qual limite serão usados.

5. OFENSIVA
A ofensiva passa a ser garantida no banco por DIA:
- 1 acesso hoje = 1 dia
- 20 acessos hoje = continua sendo 1 dia
- amanhã, ao acessar = +1 dia

O patch também remove somente eventuais registros duplicados históricos
do mesmo usuário no mesmo dia.

INSTALAÇÃO

1. Rode SOMENTE este SQL uma vez:
   fase12_8_ajustes.sql

2. Substitua os arquivos:
   configuracoes.html
   configuracoes.js

   editais.html
   editais.js
   editais.css

   flashcards.html
   flashcards.js
   flashcards.css

   cronograma.html
   cronograma.js
   cronograma-base-data.js

3. Publique:

git add -A
git commit -m "Implementa ajustes fase 12.8"
git pull --rebase origin main
git push origin main

4. Depois:
Ctrl + Shift + R

NÃO rode SQL mestre.
