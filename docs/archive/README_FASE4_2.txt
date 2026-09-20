DOCMAP — FASE 4.2: REGISTRAR QUESTÕES

NÃO PRECISA RODAR SQL NOVO se você já executou o SQL mestre atualizado.
A tabela question_sessions já existe nele.

ARQUIVOS:
- app.js                  substituir
- registrar-questoes.html novo
- registrar-questoes.js   novo

O QUE FOI ADICIONADO:
- "Registrar questões" dentro do menu Estudar
- Registro de sessões feitas em plataformas externas
- Data
- Plataforma
- Área
- Matéria
- Tema
- Total de questões
- Acertos
- Erros calculados automaticamente
- Tempo gasto opcional
- Observações
- Métricas da semana:
  - total
  - acertos
  - erros
  - aproveitamento
- Desempenho por área nos últimos 30 dias
- Histórico das últimas sessões
- Exclusão de registro
- Aviso se hoje está ou não configurado como dia de questões

PUBLICAÇÃO:
git add -A
git commit -m "Fase 4.2 - registrar questoes"
git push origin main

Depois faça Ctrl + F5.
