DOCMAP — HOTFIX DE PERSISTÊNCIA

Problema corrigido:
- perfil parecia salvar, mas podia não existir linha para o usuário
- tema podia usar UPDATE sem gravar nada se user_settings não existisse
- ao recarregar, o site voltava ao padrão
- agora perfil/tema usam persistência robusta no Supabase + cache local

ORDEM

1. Supabase > SQL Editor
Rode:
persistencia_perfil_tema.sql

2. Substitua:
- app.js
- configuracoes.js
- configuracoes.html

3. Publique:
git add -A
git commit -m "Corrige persistencia de perfil e tema"
git push origin main

4. Faça Ctrl + F5.

TESTE
- Configurações > Perfil -> salve
- escolha Leila Mood ou outro tema
- vá para Dashboard
- atualize a página
- feche e abra o site

O perfil e o tema devem permanecer.

OBS:
O Supabase continua sendo a fonte oficial.
O cache local serve para evitar voltar visualmente ao padrão enquanto o banco carrega.
