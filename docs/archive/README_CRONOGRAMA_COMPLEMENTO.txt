DOCMAP — COMPLEMENTO DO CRONOGRAMA

NÃO PRECISA RODAR SQL NOVO.

Substitua:
- cronograma.html
- cronograma.js

O que foi adicionado:

1. ADICIONAR NOVA AULA MANUALMENTE
Campos:
- Área
- Matéria (opcional)
- Tema
- Data (opcional)

Se a Data estiver vazia:
-> entra no Deck

Se preencher a Data:
-> entra diretamente naquela data do cronograma/agenda

2. LISTA DE TEMAS EMBAIXO DO DECK
Mostra todas as aulas ainda não concluídas.

Tem:
- pesquisa por Tema, Matéria ou Área
- filtro por Área
- Data / "No deck"

Ação:
- aula agendada -> "Ver na semana"
- aula no deck -> "Ir para deck"

Isso facilita encontrar aulas que estão muitas semanas à frente sem precisar
navegar semana por semana.

PUBLICAR:
git add -A
git commit -m "Melhora cronograma com aulas manuais e lista de temas"
git push origin main

Depois faça Ctrl + F5.
