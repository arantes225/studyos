DOCMAP — FASE 4: CRONOGRAMA

SUBSTITUA/ADICIONE:
- cronograma.html       substituir
- cronograma.js         novo

NÃO PRECISA RODAR SQL NOVO.
A Fase 1 já criou:
- schedule_imports
- study_topics
- subject_reviews
- schedule_study_topic()
- complete_study_topic()

O QUE FUNCIONA:
1. Importar planilhas .xlsx, .xls e .csv
2. Detectar automaticamente Data, Área, Matéria e Tema
3. Prévia antes da importação
4. Modo "Importar datas"
5. Modo "Importar como deck"
6. Deck de aulas não programadas
7. Arrastar card do deck para um dia da semana
8. Arrastar aula entre dias
9. Devolver uma aula para o deck
10. Escolher uma data manualmente no card
11. Iniciar aula pela Ambientação
12. Concluir aula
13. Ao concluir, revisões de matéria são criadas automaticamente
14. Excluir aula
15. Aulas agendadas aparecem automaticamente na Agenda do Dashboard

COLUNAS RECONHECIDAS:
Data:
- Data
- Date
- Dia
- Data Aula
- Data da Aula
- Data de Estudo

Área:
- Área
- Grande Área
- Macroárea
- Especialidade

Matéria:
- Matéria
- Disciplina
- Subárea

Tema:
- Tema
- Assunto
- Conteúdo
- Aula
- Tópico
- Título

IMPORTANTE:
No modo "Importar datas", toda linha precisa ter Tema e uma Data válida.
No modo "Deck", a coluna de Data é opcional e ignorada para o agendamento.
