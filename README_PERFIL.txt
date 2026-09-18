DOCMAP — PERFIL DO USUÁRIO

Objetivo:
Adicionar nome, sexo e especialidade e mostrar no menu lateral.

Exemplo:
Dr. Luiz Arantes
Cirurgia Geral

ORDEM:

1. Supabase > SQL Editor
   Rode:
   perfil_usuario.sql

2. Substitua no repositório:
   app.js
   configuracoes.html
   configuracoes.js

3. Publique:
   git add -A
   git commit -m "Adiciona perfil do usuario"
   git push origin main

4. No site:
   Configurações > Perfil

Preencha:
- Nome de usuário
- Sexo
- Especialidade

Regras do título:
- Masculino -> Dr.
- Feminino -> Dra.
- Outro / Prefiro não informar -> exibe somente o nome

O e-mail continua sendo usado para login, mas deixa de ser o nome principal
mostrado no menu lateral.
