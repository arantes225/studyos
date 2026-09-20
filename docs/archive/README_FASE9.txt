DOCMAP — FASE 9: CONFIGURAÇÕES COMPLETAS

ENTROU

1. CADERNO DE ERROS
- intervalo configurável
- padrão: 21 dias
- usado quando um CCQ é criado ou marcado como Lido
- datas já agendadas não são alteradas retroativamente

2. REVISÃO DE MATÉRIAS
- 1ª revisão configurável
- 2ª revisão configurável
- 3ª revisão configurável
- padrão: 7 / 14 / 30 dias
- exige intervalos crescentes
- continua respeitando:
  - dias permitidos
  - limite máximo de revisões por dia
- revisões antigas não são movidas automaticamente

3. LOGIN E SEGURANÇA
- mostra o e-mail conectado
- alteração de senha
- confirmação da nova senha
- mínimo de 8 caracteres
- usa Supabase Auth

4. JÁ EXISTIAM E CONTINUAM FUNCIONANDO
- Perfil
- Tema claro / escuro / sistema / Leila Mood
- Dias de estudo
- Limite diário de revisões
- Pomodoro
- Intervalos dos flashcards

SQL
NÃO PRECISA RODAR SQL para a Fase 9.
Os campos necessários já existem no banco atual.

Foi incluído apenas:
docmap_sql_mestre_fase9.sql
para manter a versão consolidada atualizada, incluindo também
o ajuste v7.4 do Caderno de Erros.

SUBSTITUA:
- configuracoes.html
- configuracoes.js

PUBLICAÇÃO:
git add -A
git commit -m "Fase 9 configuracoes completas"
git push origin main

Depois:
Ctrl + F5

TESTE
1. Altere intervalo do Caderno de Erros e salve.
2. Altere revisões teóricas para 5 / 15 / 30 e salve.
3. Atualize a página e confira se persistiram.
4. Teste Pomodoro e intervalos dos flashcards.
5. Altere a senha e faça login novamente com a nova senha.
