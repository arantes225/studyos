RESIBULANDO — IMPORTAR PRINT DO GABARITO

NOVO FLUXO
1. Abra um simulado.
2. Clique em "Importar print do gabarito".
3. Selecione um ou mais prints.
4. Clique em "Ler print(s)".
5. O Resibulando usa OCR no navegador.
6. Ele compara a resposta reconhecida com o gabarito oficial extraído do PDF.
7. Uma prévia mostra:
   - questão
   - resposta reconhecida
   - resposta oficial
   - acerto / erro / anulada
8. Você pode corrigir manualmente qualquer letra reconhecida.
9. Clique em "Aplicar resultados".
10. Acertos e erros são preenchidos automaticamente no simulado.

IMPORTANTE SOBRE OS PRINTS
- Os prints NÃO são enviados ao Supabase.
- Eles são processados localmente no navegador.
- Ao clicar em "Aplicar resultados", os arquivos são descartados da memória.
- Ao clicar em "Cancelar" ou fechar o simulado, também são descartados.
- Portanto não ficam salvos no Storage.

GABARITO OFICIAL
A partir desta versão, o gabarito encontrado no PDF do MedCof é salvo em:
question_items.official_answer

Para simulados MedCof antigos, ao usar o importador de print, o sistema tenta
baixar o PDF original já salvo no bucket docmap, recuperar o gabarito e preencher
official_answer automaticamente.

QUESTÕES ANULADAS
X no gabarito oficial é mostrado como "Anulada" e não é tratado como erro.
Na estrutura atual de métricas ela é persistida como correta para não penalizar
o usuário.

OCR
O recurso usa Tesseract.js diretamente no navegador.
Reconhece formatos como:
- 1 A
- 1) A
- 1. A
- Q1 A
- Questão 1: A
- várias questões no mesmo print

Também tenta reconhecer textos como:
- Questão 1 correta
- Questão 2 errada

Se alguma linha sair errada, corrija a letra na prévia antes de aplicar.

INSTALAÇÃO
1. No Supabase SQL Editor, rode SOMENTE:
   fase11_17_answer_screenshot.sql

2. Substitua na raiz do projeto:
   - questoes-simulados.html
   - questoes-simulados.js

3. Publique:

git add -A
git commit -m "Adiciona correcao de simulado por print"
git pull --rebase origin main
git push origin main

4. Depois do GitHub Pages atualizar:
Ctrl + Shift + R

NÃO precisa criar bucket novo.
