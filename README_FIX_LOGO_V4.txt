RESIBULANDO — FIX DE LOGO V4

Este patch corrige de forma definitiva as páginas que ainda exibiam
logo antiga ou logo incorreta.

PÁGINAS COBERTAS
- Dashboard
- Ambientação
- Caderno de erros
- Estatísticas
- Editais / Provas
- Configurações
- Cronograma
- Flashcards
- Questões e Simulados
- Login
- Tela inicial

O QUE FOI MUDADO
1. Todas as páginas passam a carregar:
   - resibulando-brand-v4.css
   - resibulando-brand-v4.js

2. O branding V4 corrige a sidebar mesmo se um app.js antigo estiver
   em cache ou ainda tentar desenhar a logo velha.

3. Ele remove automaticamente:
   - o antigo "D"
   - logo antiga
   - stacks com 3 logos

4. Mantém apenas UMA logo visível.

MAPEAMENTO CORRETO
- Tema claro:
  logo-icone-original.png
  (azul escuro)

- Tema escuro:
  logo-icone-azul-claro.png
  (azul claro)

- Tema rosa:
  logo-icone-rosa-escuro.png
  (rosa)

IMPORTANTE
Este V4 usa exatamente o trio final de logos que você escolheu.

COMO INSTALAR
1. Extraia o ZIP.
2. Copie TODOS os arquivos para a raiz do projeto.
3. Substitua os arquivos existentes quando for perguntado.
4. Não precisa rodar SQL.

Depois rode:

git add -A
git commit -m "Corrige definitivamente logos Resibulando"
git pull --rebase origin main
git push origin main

Após o GitHub Pages atualizar:
Ctrl + Shift + R

ou:
Ctrl + F5
