DOCMAP — FASE 11.11
DASHBOARD DE QUESTÕES E SIMULADOS

MEUS SIMULADOS
- removido definitivamente "Selecionar visíveis"
- removidos checkboxes e exclusão da tela principal
- a tela principal fica focada em desempenho e em abrir simulados

A exclusão continua SOMENTE em:
Biblioteca

NOVO DASHBOARD PRINCIPAL

Cards:
1. Simulados realizados
2. Questões totais realizadas
3. Porcentagem de acerto desde sempre
4. Questões realizadas no mês atual
5. Aproveitamento do mês atual
6. Questões enviadas ao Caderno de Erros

BLOCOS VISUAIS
- gráfico circular de aproveitamento geral
- distribuição de acertos x erros
- desempenho do mês
- gráfico linear de aproveitamento ao longo dos últimos 12 meses

GRÁFICO MENSAL
- usa a view question_metrics_daily já existente
- calcula o aproveitamento ponderado de cada mês
- mostra até 12 meses
- meses sem questões não inventam porcentagem

BIBLIOTECA
Continua sendo a única área de gestão:
- selecionar simulados
- excluir em grupo
- menu ⋯
- editar
- excluir

ADICIONAR SIMULADO
Permanece:
- Automaticamente por PDF
- Manualmente por quantidade de questões

INSTALAÇÃO
NÃO PRECISA RODAR SQL.

SUBSTITUA:
- questoes-simulados.html
- questoes-simulados.js

PUBLICAÇÃO:
git add -A
git commit -m "Fase 11.11 dashboard geral de simulados"
git push origin main

Depois:
Ctrl + F5
