DOCMAP — FASE 5: FLASHCARDS

ENTREGA
- Revisão diária de flashcards
- Frente/verso
- Imagem opcional na frente e no verso
- Área > Matéria > Tema
- Difícil / Intermediário / Fácil
- Intervalos editáveis em Configurações
- Histórico continua indo para flashcard_reviews
- Próxima revisão calculada pelo banco
- Respeita flashcard_weekdays
- Importação Excel/CSV em lote
- Biblioteca com busca/filtro e arquivar/restaurar
- Métricas do dia

ARQUIVOS A ADICIONAR/SUBSTITUIR
1. flashcards.html
2. flashcards.js
3. flashcards.css
4. configuracoes.html
5. configuracoes.js

SUPABASE
Rode UMA VEZ:
fase5_flashcards.sql

Não rode o SQL mestre para uma atualização normal.
docmap_sql_mestre_fase5.sql é o backup consolidado/reset completo.

MODELO DE IMPORTAÇÃO
Área | Matéria | Tema | Frente | Verso

Também reconhece:
- disciplina -> Matéria
- assunto -> Tema
- pergunta/questão -> Frente
- resposta -> Verso

IMAGENS
As imagens manuais são enviadas ao bucket privado:
docmap/<user-id>/flashcards/...

O frontend usa URL assinada para mostrá-las.

PUBLICAÇÃO
git add -A
git commit -m "Fase 5 flashcards"
git push origin main

Depois faça Ctrl + F5.

TESTE RÁPIDO
1. Crie um card manual.
2. Veja se aparece em Revisar.
3. Clique Mostrar resposta.
4. Marque Intermediário.
5. Confira se o card sai da fila e ganha nova data.
6. Vá em Configurações e altere um intervalo.
7. Teste uma planilha simples com 2 cards.
