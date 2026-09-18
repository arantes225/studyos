DOCMAP — AGENDA → AMBIENTAÇÃO LIMPA

ALTERAÇÃO

Quando você clicar em "Iniciar" pela Agenda:

FLASHCARDS
- mostra somente a atividade de revisão
- esconde métricas
- esconde abas
- esconde Criar / Importar / Biblioteca
- esconde "Revisões em dia"
- esconde cabeçalho redundante da página

CADERNO DE ERROS
- mostra somente o CCQ / atividade de revisão
- esconde minidashboard
- esconde Adicionar novo erro
- esconde Biblioteca
- esconde filtro/cabeçalho redundante
- esconde qualquer mensagem de "revisões em dia" / sem pendências

AULA
- agora aparece como atividade própria dentro da Ambientação
- mostra título + área + matéria + data
- botão "Concluir aula"
- ao concluir, usa complete_study_topic
- as revisões teóricas são agendadas automaticamente

A página normal de Flashcards e a página normal do Caderno de Erros
NÃO mudam. A limpeza acontece somente quando a atividade é aberta
pela Agenda dentro da Ambientação.

O Pomodoro, áudio e carrossel aleatório de CCQs da Ambientação
continuam funcionando normalmente.

NÃO PRECISA SQL.

SUBSTITUA:
- ambientacao.html
- ambientacao.css
- ambientacao.js

PUBLICAÇÃO:
git add -A
git commit -m "Limpa atividades da agenda na ambientacao"
git push origin main

Depois: Ctrl + F5
