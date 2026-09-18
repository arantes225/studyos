# StudyOS

Frontend limpo em HTML/CSS/JavaScript + Supabase.

## Arquivos principais

- `index.html` — redireciona para login ou dashboard
- `login.html` / `auth.js` — autenticação
- `dashboard.html` / `dashboard.js` — pendências do dia
- `flashcards.html` / `flashcards.js` — criar, listar e revisar flashcards
- `configuracoes.html` / `configuracoes.js` — intervalos de revisão
- `cronograma.html` / `cronograma.js` — cronograma principal
- `caderno-erros.html` / `caderno-erros.js` — caderno de erros
- `editais.html` / `editais.js` — cadastro de editais
- `supabase.js` — cliente e utilidades comuns
- `style.css` — visual base
- `storage_setup.sql` — bucket/policies para imagens dos flashcards

## Como publicar

1. Apague os arquivos antigos do repositório ou use uma branch nova.
2. Envie todos estes arquivos para a raiz do repositório `studyos`.
3. Faça commit e push.
4. No GitHub Pages, publique a branch `main` pela raiz `/`.
5. Abra:
   `https://arantes225.github.io/studyos/`

## Supabase

O projeto já está configurado com o Project URL e a chave `sb_publishable_...`.

O frontend espera as tabelas/funções que já foram criadas:
- flashcards
- configuracoes_revisao
- materias
- temas
- revisoes_materia
- caderno_erros
- cronograma
- editais
- edital_temas
- dashboard_pendencias
- revisar_flashcard(uuid)
- revisar_erro(uuid)
- criar_configuracoes_padrao()

## Imagens

Para upload de imagem nos flashcards, rode `storage_setup.sql` no SQL Editor do Supabase uma vez.