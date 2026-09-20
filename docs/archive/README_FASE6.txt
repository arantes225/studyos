DOCMAP — FASE 6: POMODORO + TEMPO REAL DE ESTUDO

O QUE ENTROU
- Pomodoro funcional na Ambientação
- Foco e pausa
- Iniciar / pausar / continuar / finalizar
- Pausas NÃO entram no tempo estudado
- Tempo efetivo é salvo em study_sessions
- Dashboard passa a receber esse tempo pela view study_hours_daily
- Ao completar um ciclo de foco, a sessão é registrada automaticamente
- Depois do foco, prepara a pausa
- Se recarregar a página, a sessão volta PAUSADA
- Não conta o tempo em que o site ficou fechado
- Se a aba ficar em segundo plano, o foco continua contando
- Configurações: duração do foco e da pausa
- Atividade da Agenda é vinculada à sessão:
  lesson -> lesson
  subject_review -> subject_review
  flashcards_batch -> flashcards
  errors_batch -> error_notebook
  sem atividade -> free_study

INSTALAÇÃO

1. SUPABASE
Rode UMA VEZ:
fase6_pomodoro.sql

Não rode o SQL mestre numa atualização normal.
docmap_sql_mestre_fase6.sql é o backup consolidado.

2. GITHUB
Substitua/adiciona:
- ambientacao.html
- ambientacao.js
- ambientacao.css
- configuracoes.html
- configuracoes.js

Não precisa mexer em:
- app.js
- style.css
- flashcards.js
- caderno-erros.js
- dashboard.js

3. PUBLICAÇÃO
git add -A
git commit -m "Fase 6 Pomodoro e tempo de estudo"
git push origin main

4. Ctrl + F5

TESTE
1. Configurações -> Pomodoro -> coloque foco 1 min e pausa 1 min para testar.
2. Abra Ambientação ou Iniciar numa atividade da Agenda.
3. Inicie o foco.
4. Pause alguns segundos.
5. Continue.
6. Finalize.
7. Dashboard deve contabilizar somente o tempo efetivo de foco.

IMPORTANTE
- Finalizar uma sessão NÃO marca aula/revisão como concluída.
- Nesta fase registramos TEMPO DE ESTUDO.
- Conclusão e outros refinamentos podem permanecer para fases específicas/backlog.
