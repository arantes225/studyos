RESIBULANDO — FIX V5

PROBLEMA CORRIGIDO
A versão V4 observava mudanças em TODO o body da página.
Como o próprio script alterava a sidebar, ele podia disparar
um ciclo contínuo de MutationObserver e travar o navegador.

SINTOMA
- Dashboard branco/preto
- Chrome mostrando "Página sem resposta"
- CPU alta / página travada

CORREÇÃO V5
- Remove completamente o observer do body.
- Observa apenas a mudança do atributo data-theme no <html>.
- Procura a sidebar por tentativas limitadas (máximo 20).
- Também aplica a logo quando o app dispara docmap:ready.
- Mantém uma única logo por tema.

MAPEAMENTO
Claro  -> logo-icone-original.png
Escuro -> logo-icone-azul-claro.png
Rosa   -> logo-icone-rosa-escuro.png

COMO INSTALAR
1. Extraia este ZIP.
2. Copie TODOS os arquivos para a raiz do projeto.
3. Substitua os existentes.

Depois:

git add -A
git commit -m "Corrige travamento da logo Resibulando"
git pull --rebase origin main
git push origin main

Depois que o GitHub Pages atualizar:
Ctrl + Shift + R

Se o Chrome ainda estiver com a aba travada:
- feche a aba
- abra novamente https://www.resibulando.online
- faça Ctrl + Shift + R

NÃO PRECISA RODAR SQL.
NÃO PRECISA ALTERAR DNS OU SUPABASE.
