DOCMAP — ESTATÍSTICAS EM PÁGINA PRÓPRIA

ALTERAÇÃO
O Hub de Estatísticas saiu do Dashboard e virou uma página própria.

MENU LATERAL
A nova ordem inclui:

...
Questões e Simulados
Estatísticas
Editais / Provas
Configurações

Ou seja, Estatísticas fica imediatamente acima de Editais / Provas.

A PÁGINA ESTATÍSTICAS MANTÉM
- 14 / 30 / 90 dias
- tempo estudado
- consistência
- aproveitamento em questões
- aproveitamento em flashcards
- ritmo diário de estudo
- distribuição do tempo por atividade
- memória por matéria
- erros por área
- leitura automática dos dados

DASHBOARD
O bloco grande de Estatísticas foi removido do Dashboard.
O restante do Dashboard continua:
- cards superiores
- simulados recentes
- agenda

SQL
NÃO PRECISA RODAR SQL.
A Fase 10 já criou as views necessárias.

ARQUIVOS
Substitua:
- app.js
- dashboard.html
- dashboard.js

Adicione:
- estatisticas.html
- estatisticas.css
- estatisticas.js

PUBLICAÇÃO
git add -A
git commit -m "Move estatisticas para pagina propria"
git push origin main

Depois:
Ctrl + F5
