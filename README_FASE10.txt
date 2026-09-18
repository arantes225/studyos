DOCMAP — FASE 10: ESTATÍSTICAS E INTELIGÊNCIA

ENTROU NO DASHBOARD

1. PERÍODO SELECIONÁVEL
- 14 dias
- 30 dias
- 90 dias

2. RESUMO DO PERÍODO
- tempo total estudado
- consistência: quantos dias tiveram estudo
- aproveitamento em questões
- aproveitamento em flashcards

3. RITMO DE ESTUDO
- gráfico diário do tempo efetivo registrado no Pomodoro / sessões
- usa os dados reais de study_sessions

4. DISTRIBUIÇÃO DO ESTUDO
- Aulas
- Flashcards
- Caderno de erros
- Revisão teórica
- Estudo livre
- Ambientação
Mostra quanto tempo foi dedicado a cada tipo.

5. MEMÓRIA POR MATÉRIA
- usa retention_by_subject
- mostra as matérias com menor retenção estimada
- mantém a fórmula de retenção já usada pelo DocMap
- mostra também a quantidade de evidências

6. ERROS POR ÁREA
Combina visualmente:
- erros classificados nos simulados
- itens ativos do Caderno de Erros

7. LEITURA DOS DADOS
Resumo automático e descritivo:
- dias estudados no período
- menor retenção com pelo menos 2 evidências
- maior concentração atual de erros
- volume de questões e flashcards

BANCO
Rode UMA VEZ:
fase10_estatisticas.sql

Ele cria somente views:
- question_metrics_daily
- study_activity_daily
- error_area_metrics

Não apaga nem modifica histórico.

ARQUIVOS
Substitua:
- dashboard.html
- dashboard.js

SQL mestre de referência:
- docmap_sql_mestre_fase10.sql

PUBLICAÇÃO
git add -A
git commit -m "Fase 10 estatisticas e inteligencia"
git push origin main

Depois:
Ctrl + F5

OBSERVAÇÃO
A Fase 10 usa os dados já existentes. No começo alguns gráficos podem
ficar vazios até o DocMap acumular sessões, revisões e questões.
