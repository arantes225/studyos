DOCMAP — FASE 11.6
SIMULADOS MAIS VISUAIS + FLASHCARD EM DESTAQUE

QUESTÕES E SIMULADOS

1. REMOVIDO DA INTERFACE
- "Simulado vinculado à prova"
- "Vinculado à prova" nos cards do histórico

A associação com uma prova continua funcionando silenciosamente quando
o simulado é aberto a partir de Editais / Provas, para não quebrar os
dados já existentes. Apenas a informação visual foi removida.

2. MINIDASHBOARD EXPANDIDO
Além dos 4 cards existentes, agora há:

- gráfico circular de aproveitamento geral
- contagem visual de acertos x erros
- barra proporcional de acertos e erros
- resumo dos últimos 30 dias:
  * simulados
  * questões respondidas
  * percentual de acerto
- lista "Últimos resultados":
  * nome do simulado
  * questões respondidas
  * acertos
  * erros
  * data
  * percentual de acerto
  * barra visual de desempenho

Não precisa SQL: usa as views já existentes da Fase 10.

FLASHCARDS

1. CORRIGIDO O BLOCO "REVISÕES EM DIA"
O problema era visual:
algumas classes CSS possuíam "display" próprio e conseguiam sobrepor
o atributo HTML hidden.

Agora:
- se existe flashcard para revisar, o bloco "Revisões em dia" NÃO aparece
- se não existe flashcard, aparece apenas uma mensagem compacta

2. FLASHCARD EM DESTAQUE
- card maior
- largura máxima aumentada
- altura mínima aumentada
- texto da frente maior
- imagem pode ocupar mais espaço
- melhor aproveitamento da área central da tela

3. ÍCONE DE IMAGEM QUEBRADA
Corrigido.

Agora a imagem:
- fica realmente invisível quando não existe path
- só aparece depois de carregar com sucesso
- se a URL falhar, volta a ficar escondida
- não mostra mais o ícone de imagem corrompida

INSTALAÇÃO

NÃO PRECISA RODAR SQL.

SUBSTITUA:
- questoes-simulados.html
- questoes-simulados.js
- flashcards.html
- flashcards.css
- flashcards.js

PUBLICAÇÃO:

git add -A
git commit -m "Fase 11.6 simulados visuais e revisao de flashcards"
git push origin main

Depois:
Ctrl + F5
