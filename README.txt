RESIBULANDO — FASE 13.1
FILTROS COMPACTOS + OTIMIZAÇÃO DE IMAGENS

1. CRONOGRAMA — FILTRO
Os filtros da Lista de temas foram condensados em um único ícone.

Ao clicar no ícone, aparecem:
- Área
- Feitos e não feitos / Não feitos / Feitos
- Data inicial
- Data final
- Limpar
- Aplicar

A busca textual continua visível.
Quando existir filtro ativo, o ícone fica destacado.

2. OTIMIZAÇÃO DE IMAGENS
Padronização aplicada a:
- Caderno de Erros
- Flashcards
- figuras extraídas de PDFs em Questões/Simulados
- imagens enviadas de Questões/Simulados para o Caderno de Erros

ESTRATÉGIA
- formato preferencial: WebP
- dimensão máxima inicial: 1100 px
- meta: 100 KB por imagem
- teto suave: aproximadamente 150 KB quando reduzir mais prejudicaria
  nitidez de textos, tabelas, radiografias, diagramas e prints
- qualidade reduzida progressivamente
- dimensões também reduzem progressivamente somente quando necessário
- imagens que já estão abaixo de 100 KB não são recomprimidas

A ideia é economizar bastante Storage sem transformar prints com texto
em imagens borradas.

ARQUIVOS PARA SUBSTITUIR

Cronograma:
- cronograma.html
- cronograma.js
- cronograma-base-data.js

Caderno de Erros:
- caderno-erros.html
- caderno-erros.js
- caderno-erros.css

Flashcards:
- flashcards.html
- flashcards.js
- flashcards.css

Questões / Simulados:
- questoes-simulados.html
- questoes-simulados.js

SQL
NÃO PRECISA RODAR SQL NOVO.

PUBLICAR
git add -A
git commit -m "Compacta filtros e otimiza imagens"
git pull --rebase origin main
git push origin main

Depois:
Ctrl + Shift + R
