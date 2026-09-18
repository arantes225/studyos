DOCMAP — CADERNO DE ERROS v7.4

ALTERAÇÃO
Agora SOMENTE o CCQ é obrigatório ao adicionar um novo erro.

Passam a ser opcionais:
- Área
- Matéria
- Tema
- Questão
- Imagem
- Resposta correta
- O que eu pensei

O fluxo de revisão continua funcionando.
Se não houver questão ou resposta cadastrada, ao abrir os detalhes
o DocMap simplesmente mostra que aquela informação não foi preenchida.

IMPORTANTE
É necessário rodar o SQL desta versão, porque o banco antigo ainda
exigia resposta correta e também exigia questão ou imagem.

INSTALAÇÃO

1. Rode UMA VEZ no Supabase:
caderno_erros_v7_4.sql

2. Substitua:
- caderno-erros.html
- caderno-erros.css
- caderno-erros.js

3. Publique:
git add -A
git commit -m "Deixa apenas CCQ obrigatorio no caderno de erros"
git push origin main

4. Ctrl + F5

Não precisa alterar Ambientação, Dashboard ou Agenda.
