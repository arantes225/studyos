DOCMAP — FASE 11.7

DASHBOARD
- Removido o bloco inferior de resultados/simulados recentes.
- Mantido o quadrado de Simulados dos últimos 30 dias.
- A Agenda fica mais direta logo após as métricas.

CRONOGRAMA
Ao clicar em "Reorganizar atrasadas":
- solicita uma Data final
- usa o intervalo de hoje até essa data
- respeita os dias de Estudo teórico
- respeita o máximo de aulas teóricas por dia
- considera aulas que já estão agendadas no dia
- espalha as atrasadas ao longo de todo o intervalo
- nunca ultrapassa o limite diário

Se o período escolhido não comportar todas as aulas:
- move apenas as que cabem
- informa quantas continuaram atrasadas

CONFIGURAÇÕES
Novo campo:
- Máximo de aulas teóricas por dia

Padrão: 1 aula/dia.

INSTALAÇÃO

1. Rode UMA VEZ:
fase11_7_reorganizacao_aulas.sql

2. Substitua:
dashboard.html
dashboard.js
cronograma.html
cronograma.js
configuracoes.html
configuracoes.js

3. Publique:
git add -A
git commit -m "Fase 11.7 reorganizacao de aulas por intervalo"
git push origin main

Depois:
Ctrl + F5
