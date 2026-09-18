RESIBULANDO — IMPORTADOR MEDCOF + RECORTE AUTOMÁTICO DE IMAGENS

O QUE ESTA VERSÃO FAZ
- lê as questões do PDF com PDF.js
- reconhece o formato do MedCof
- detecta imagens raster embutidas no PDF
- identifica em qual questão cada imagem está
- renderiza a página em alta resolução
- recorta somente a figura
- salva o recorte como PNG no bucket privado docmap
- associa o PNG à questão
- mostra a figura dentro do simulado
- exclui as imagens do Storage quando o simulado é apagado

NO PDF DE TESTE ENVIADO
O esperado é encontrar imagens nas questões:
1, 2, 3, 4, 6, 11, 13 e 17.

Ou seja: 8 questões com figura.

OBSERVAÇÃO
Este sistema funciona especialmente bem quando as figuras são imagens
raster embutidas no PDF (como ECGs, tabelas e gráficos do PDF do MedCof).
Se um PDF usar desenhos 100% vetoriais, eles podem não ser identificados
como uma imagem separada nesta versão.

INSTALAÇÃO

1. PRIMEIRO rode no Supabase SQL Editor SOMENTE:
   fase11_15_question_images.sql

2. Depois substitua na raiz do projeto:
   - questoes-simulados.js
   - questoes-simulados.html

3. Publique:

git add -A
git commit -m "Adiciona recorte automatico de imagens dos simulados"
git pull --rebase origin main
git push origin main

4. Quando o GitHub Pages atualizar:
Ctrl + Shift + R

ARMAZENAMENTO
Os recortes ficam em:
docmap/<usuario>/question_sets/<simulado>/images/

Nenhum bucket novo é necessário.
