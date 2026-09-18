DOCMAP — FASE 11.4
GESTÃO DE CARDS, CADERNO, SIMULADOS E PROVAS

=========================================================
FLASHCARDS
=========================================================

Tanto na REVISÃO quanto na BIBLIOTECA:
- menu ⋯ no canto superior direito
- Editar
- Excluir

Na Biblioteca:
- seleção por checkbox
- Selecionar visíveis
- Excluir selecionados em grupo

A edição permite:
Área, Matéria, Tema, Frente e Verso.

=========================================================
CADERNO DE ERROS
=========================================================

Novo minimenu superior:
- Revisar
- Novo erro
- Biblioteca
- Importar

Tanto na REVISÃO quanto na BIBLIOTECA:
- menu ⋯ no canto superior direito
- Editar
- Excluir

Na Biblioteca:
- seleção por checkbox
- Selecionar visíveis
- Excluir selecionados em grupo

Importação:
- .xlsx
- .xls
- .csv
- apenas CCQ é obrigatório
- reconhece Área, Matéria, Tema, CCQ, Questão,
  Resposta correta e O que eu pensei

=========================================================
EDITAIS / PROVAS
=========================================================

A opção individual de Excluir continua disponível.

Também foi adicionado:
- seleção de provas
- selecionar visíveis
- excluir várias provas em grupo

Simulados vinculados NÃO são apagados ao apagar uma prova;
eles apenas deixam de ficar vinculados à prova.

=========================================================
QUESTÕES E SIMULADOS
=========================================================

A opção individual de excluir simulado continua disponível.

Também foi adicionado:
- seleção por checkbox
- selecionar todos
- excluir vários simulados em grupo

Ao excluir, o PDF privado associado também é removido do Storage
quando possível.

=========================================================
CRONOGRAMA
=========================================================

Mantida a regra da Fase 11.3:

No PLANNER:
- somente "Iniciar" fica sempre visível

No menu ⋯:
- Concluir
- Aula já feita
- Remover para o deck

=========================================================
INSTALAÇÃO
=========================================================

NÃO PRECISA RODAR SQL.

SUBSTITUA:

flashcards.html
flashcards.css
flashcards.js

caderno-erros.html
caderno-erros.css
caderno-erros.js

editais.html
editais.css
editais.js

questoes-simulados.html
questoes-simulados.js

cronograma.html
cronograma.js

PUBLICAÇÃO:

git add -A
git commit -m "Fase 11.4 gestao de bibliotecas e exclusao em grupo"
git push origin main

Depois:
Ctrl + F5

=========================================================
OBSERVAÇÃO
=========================================================

Exclusão em grupo é permanente e sempre pede confirmação.
