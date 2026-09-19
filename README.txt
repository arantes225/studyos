RESIBULANDO — FASE 12.3
CORREÇÃO DO DASHBOARD DE QUESTÕES + CRONOGRAMA GENÉRICO

QUESTÕES E SIMULADOS
O problema dos blocos gigantes foi identificado: uma regra antiga do site
usava "display: block !important" para a seção ativa e estava vencendo o
novo CSS da grade.

Agora:
- desktop = 3 x 3 de verdade;
- 9 quadrados compactos;
- largura total aproximada de 860 px;
- tablet = 2 colunas;
- celular = 1 coluna;
- o gráfico quinzenal fica dentro do 9º quadrado.

IMPORTANTE:
No print enviado, o Chrome também parece estar com zoom reduzido.
Depois de publicar, pressione Ctrl + 0 para garantir zoom de 100%.

CRONOGRAMA GENÉRICO
A inserção foi refeita de forma mais simples e robusta.

Agora o botão insere DIRETAMENTE na tabela study_topics.
Ele não depende mais da criação de um registro em schedule_imports.

Isso corrige casos em que o botão confirmava a operação, mas nenhuma aula
era criada.

ARQUIVOS PARA SUBSTITUIR
- questoes-simulados.html
- questoes-simulados.js
- cronograma.html
- cronograma.js
- cronograma-base-data.js

NÃO PRECISA RODAR SQL NOVO.

PUBLICAR
git add -A
git commit -m "Corrige dashboard e cronograma generico"
git pull --rebase origin main
git push origin main

Depois:
Ctrl + Shift + R
Ctrl + 0
