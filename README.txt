RESIBULANDO — RECONHECIMENTO DO GABARITO PELA COR

Esta versão foi feita para prints como o exemplo enviado:

- quadrado VERDE em volta do número = ACERTO
- quadrado ROSA/VERMELHO em volta do número = ERRO
- quadrado AZUL = questão atualmente selecionada

O sistema NÃO depende mais de encontrar "1 A", "2 B" etc.

COMO FUNCIONA
1. O navegador procura os blocos coloridos da grade.
2. Remove elementos que não parecem botões:
   - barra azul de progresso
   - ícones pequenos do cabeçalho
3. Ordena os blocos por linha e coluna.
4. Se a grade inteira estiver visível, associa a ordem aos números das questões.
5. Verde vira "Acerto".
6. Vermelho/rosa vira "Erro".
7. Se houver uma questão azul, tenta ler apenas o resumo superior para descobrir
   se aquela questão selecionada era acerto ou erro.
8. A tela de prévia permite corrigir manualmente qualquer classificação antes de aplicar.

NO PRINT ENVIADO
O esperado é:
- 20 botões reconhecidos
- questões 2 e 18 = acerto
- demais = erro
- questão 20 aparece azul, mas é inferida como erro porque o resumo mostra
  2 acertos e 18 erros.

PRIVACIDADE / LIMPEZA DOS PRINTS
Continua igual à versão anterior:
- o print NÃO é enviado ao Supabase;
- fica apenas na memória do navegador;
- depois de clicar "Aplicar resultados", é apagado da memória;
- se cancelar/fechar, também é apagado.

SQL
Nenhum SQL novo.
Mantenha apenas o patch anterior que adicionou:
question_items.official_answer

INSTALAÇÃO
Substitua:
- questoes-simulados.html
- questoes-simulados.js

Depois:

git add -A
git commit -m "Reconhece resultado do gabarito pelas cores"
git pull --rebase origin main
git push origin main

Depois que o GitHub Pages atualizar:
Ctrl + Shift + R
