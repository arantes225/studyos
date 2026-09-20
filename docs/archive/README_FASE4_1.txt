DOCMAP — FASE 4.1

ORDEM:

1. No Supabase:
   rode o arquivo:
   fase4_1.sql

2. No GitHub/VS Code:
   substitua:
   - cronograma.html
   - cronograma.js
   - configuracoes.html

   adicione:
   - configuracoes.js

3. Git:
   git add -A
   git commit -m "Fase 4.1 - aulas feitas e dias de estudo"
   git push origin main


O QUE FOI ADICIONADO

CONFIGURAÇÕES
- Dias da semana para Flashcards
- Dias da semana para Estudo teórico
- Dias da semana para Revisão teórica
- Dias da semana para Caderno de erros
- Dias da semana para Questões
- Máximo de revisões teóricas por dia

AULAS JÁ FEITAS
- Botão "Aula já feita" em aulas agendadas e no deck
- Data em que estudou é opcional
- Se a data não for conhecida, o sistema não inventa uma data antiga
- O sistema distribui as revisões pelos próximos dias permitidos
- Respeita o máximo de revisões teóricas por dia

IMPORTAÇÃO
Além das colunas já reconhecidas, agora entende:
- Aula já feita
- Já feita
- Concluída
- Feita

E opcionalmente:
- Data estudada
- Data em que estudou
- Data de conclusão

Exemplo:
Data | Área | Matéria | Tema | Aula já feita | Data estudada
     | Clínica Médica | Cardio | HAS | Sim | 10/09/2026

Se "Aula já feita" = Sim, a Data normal da aula deixa de ser obrigatória.

DIAS PERMITIDOS
- Flashcards novos/revisados passam a cair apenas nos dias escolhidos
- Caderno de erros passa a cair apenas nos dias escolhidos
- Revisões teóricas passam a cair apenas nos dias escolhidos
- Movimentos MANUAIS na agenda continuam livres

QUESTÕES
A tabela question_sessions já é criada agora.
A tela "Registrar questões" entra na Fase 4.2.
