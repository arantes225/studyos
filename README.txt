DOCMAP — FASE 11.10
CRONOGRAMA — ADICIONAR AULAS + EXCLUSÃO EM GRUPO

1. ADICIONAR AULAS

O Importador inteligente e o cadastro manual agora ficam juntos
em um único fluxo visual chamado "Adicionar aulas".

Menu:
- Automaticamente
- Manualmente

AUTOMATICAMENTE
- mantém o Importador inteligente
- Excel
- CSV
- PDF
- prévia editável
- importação com datas ou como deck

MANUALMENTE
- Área
- Matéria
- Tema
- Data
- botão Adicionar aula

Nada foi removido do funcionamento anterior;
apenas a organização da página foi melhorada.

2. LISTA DE TEMAS

Agora cada aula possui checkbox.

Também foi adicionado:
- Selecionar visíveis
- quantidade de aulas selecionadas
- Excluir selecionadas

A exclusão em grupo:
- pede confirmação
- apaga permanentemente os registros selecionados
- respeita os filtros atuais para "Selecionar visíveis"

As ações existentes da Lista de temas continuam:
- Ver na semana / Ir para deck
- Remover para o deck
- Já feita

3. INSTALAÇÃO

NÃO PRECISA RODAR SQL.

SUBSTITUA:
- cronograma.html
- cronograma.js

PUBLICAÇÃO:

git add -A
git commit -m "Fase 11.10 menu adicionar aulas e exclusao em grupo"
git push origin main

Depois:
Ctrl + F5
