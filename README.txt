DOCMAP — CADERNO DE ERROS NA AMBIENTAÇÃO

SEM SQL.

Substitua/adiciona:
- ambientacao.html
- ambientacao.js
- flashcards.js
- caderno-erros.html
- caderno-erros.css
- caderno-erros.js

FLUXO
Agenda -> Caderno de erros -> Iniciar -> Ambientação
                                      -> Pomodoro
                                      -> Áudio
                                      -> lote de erros daquela data + área

REVISÃO
1. Mostra CCQ + questão
2. Clique "Mostrar resposta"
3. Mostra resposta correta + "o que eu pensei"
4. Clique "Revisado"
5. Chama review_error_entry no Supabase
6. Passa ao próximo item

A página Caderno de erros aberta pelo menu lateral também funciona:
mostra todos os itens vencidos até hoje.

Também corrige o filtro dos flashcards da Agenda para respeitar
DATA + ÁREA, exatamente como a agenda agrupa os lotes.
