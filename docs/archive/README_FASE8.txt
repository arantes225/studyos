DOCMAP — FASE 8: EDITAIS / PROVAS

ENTROU

1. PÁGINA EDITAIS / PROVAS FUNCIONAL
- Nova prova
- Editar
- Excluir
- Busca
- Filtro por status

Campos:
- Instituição
- Banca
- Status
- Prazo de inscrição
- Data da prova
- Taxa
- Resultado (%)
- Link do edital
- Link da inscrição
- Observações
- Observações do resultado

Status:
- Planejada
- Inscrita
- Realizada
- Cancelada

2. MINIDASHBOARD DA PÁGINA
- Próximas provas
- Inscrições
- Realizadas
- Média das provas realizadas

3. AGENDA
Inscrição e Prova continuam entrando automaticamente na Agenda.
Agora o botão "Abrir" da Agenda leva diretamente à prova correta.

4. QUESTÕES / SIMULADOS
Cada prova tem botão:
"Questões / Simulados"

Ao abrir por esse botão:
- aparece contexto da prova
- o novo simulado fica vinculado automaticamente à prova
- o nome do simulado já vem sugerido
- o fluxo de gabarito + CCQ + Caderno de Erros continua igual

5. DESEMPENHO POR PROVA
O card da prova mostra:
- quantidade de simulados vinculados
- questões respondidas
- aproveitamento dos simulados

SUPABASE
Rode UMA VEZ:
fase8_editais.sql

ARQUIVOS
Adicionar/substituir:
- editais.html
- editais.css
- editais.js
- questoes-simulados.html
- questoes-simulados.js
- dashboard.js

NÃO PRECISA ALTERAR
- app.js
- ambientacao.*
- caderno-erros.*
- flashcards.*
- configuracoes.*

PUBLICAÇÃO
git add -A
git commit -m "Fase 8 editais e provas"
git push origin main

Depois: Ctrl + F5

TESTE
1. Crie uma prova.
2. Defina prazo de inscrição e data.
3. Confira na Agenda.
4. Clique Abrir na Agenda.
5. Na prova, clique Questões / Simulados.
6. Importe um PDF.
7. Salve o gabarito.
8. Volte à prova e confira o desempenho vinculado.
