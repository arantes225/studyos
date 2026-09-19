RESIBULANDO — FASE 13.3
RECUPERAÇÃO DO CRONOGRAMA

Esta versão NÃO foi construída em cima da 13.1/13.2.

Ela foi reconstruída a partir da base 12.8, que era a base anterior
estável do Cronograma, e recebeu somente as alterações solicitadas:

1. Um único ícone de filtro contendo:
   - Área
   - Feitos e não feitos
   - Não feitos
   - Feitos
   - Data inicial
   - Data final

2. Menu de 3 pontos para aulas selecionadas:
   - Remover para o deck
   - Marcar selecionadas como já feitas
   - Excluir selecionadas

3. A Lista de temas continua mostrando aulas concluídas.

O cronograma genérico e o reorganizador da base 12.8 foram preservados.

VALIDAÇÕES
- sintaxe de cronograma.js: OK
- sintaxe de cronograma-base-data.js: OK
- integridade básica do HTML: OK
- nenhum marcador de conflito Git
- todos os IDs usados por getElementById no JS existem no HTML

ARQUIVOS PARA SUBSTITUIR
- cronograma.html
- cronograma.js
- cronograma-base-data.js

NÃO PRECISA RODAR SQL.

IMPORTANTE
Substitua os 3 arquivos juntos. Não misture cronograma.html de uma fase
com cronograma.js de outra.

Depois publique e faça Ctrl + Shift + R.
