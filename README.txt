DOCMAP — FASE 11.9
MENU DE SIMULADOS

NOVO MENU SUPERIOR
- Meus simulados
- Adicionar simulado
- Biblioteca

MEUS SIMULADOS
- mantém o minidashboard de desempenho
- mostra seus simulados
- botão Abrir para preencher/revisar o gabarito
- sem botões de excluir poluindo os cards

ADICIONAR SIMULADO

1. AUTOMATICAMENTE
- envia PDF
- DocMap extrai as questões
- cria o gabarito rápido
- comportamento já existente preservado

2. MANUALMENTE
- informa nome do simulado
- informa quantidade de questões
- DocMap cria automaticamente as questões numeradas
- depois abre direto o gabarito rápido
- quantidade permitida: 1 a 500

BIBLIOTECA
- lista todos os simulados
- checkbox por simulado
- selecionar todos
- excluir vários em grupo
- menu ⋯ em cada simulado:
  - Editar
  - Excluir

EDIÇÃO
- nesta etapa permite alterar com segurança o nome do simulado
- quantidade de questões não é alterada pela edição para não quebrar
  gabaritos já respondidos

EXCLUSÃO
- continua removendo o PDF privado associado quando existir
- exclusão pede confirmação

INSTALAÇÃO
NÃO PRECISA RODAR SQL.

SUBSTITUA:
- questoes-simulados.html
- questoes-simulados.js

PUBLICAÇÃO:
git add -A
git commit -m "Fase 11.9 menu e biblioteca de simulados"
git push origin main

Depois:
Ctrl + F5
