DOCMAP — CRONOGRAMA v4.4

ALTERAÇÕES

1. PLANEJADOR
Cada aula agendada agora tem:
- Iniciar
- Concluir
- Aula já feita
- Remover

"Remover" NÃO exclui a aula.
Ele tira a data da aula e envia o tema para o Deck não programado.

2. DECK NÃO PROGRAMADO
O bloco só aparece quando existem aulas sem data.

Ou seja:
- importou Excel COM datas -> Deck não aparece
- adicionou aula manualmente -> precisa informar data -> Deck não aparece
- importou Excel SEM datas / modo deck -> Deck aparece
- clicou "Remover" em uma aula do planejador -> Deck aparece
- agendou o último tema do Deck -> Deck some automaticamente

3. ADICIONAR NOVA AULA MANUALMENTE
A Data agora é obrigatória.
Isso impede que aulas manuais criem o Deck por acidente.

4. LISTA DE TEMAS
Continua visível mesmo quando o Deck está oculto.
Mantém:
- pesquisa
- filtro por área
- "Ver na semana"
- "Ir para deck" quando houver tema sem data

NÃO PRECISA RODAR SQL.

Substitua:
- cronograma.html
- cronograma.js

PUBLICAR:
git add -A
git commit -m "Ajusta deck e remocao de aulas do planejador"
git push origin main

Depois faça Ctrl + F5.
