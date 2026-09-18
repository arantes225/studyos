DOCMAP — FASE 7 + MÉTRICAS DE QUESTÕES/SIMULADOS

ESTE PACOTE JÁ INCLUI AS ALTERAÇÕES QUE VOCÊ PEDIU ANTES DE SEGUIR.

1. FASE 7 — CCQs NA AMBIENTAÇÃO
- CCQs do Caderno de Erros aparecem automaticamente na Ambientação.
- Mostra Área / Matéria / Tema.
- Anterior / Próximo.
- Rotação automática a cada 30 segundos.
- Começa em um ponto diferente a cada dia.
- Não altera as datas de revisão do Caderno de Erros.

2. QUESTÕES E SIMULADOS — MÉTRICAS
No topo da página:
- Simulados realizados
- Questões respondidas
- Aproveitamento geral
- Erros enviados ao Caderno de Erros

O histórico continua mostrando os números de cada simulado.

3. DASHBOARD — SIMULADOS
Novo card:
- quantidade de simulados concluídos
- total de questões
- aproveitamento geral

Novo painel:
- Simulados recentes
- últimos 4 gabaritos
- aproveitamento
- acertos / erros
- progresso de questões respondidas

4. CCQ AO ENVIAR ERROS
Cada questão marcada como errada agora tem um campo:
CCQ

Ele é obrigatório SOMENTE para enviar ao Caderno de Erros.
Você ainda pode salvar o gabarito sem preencher o CCQ.

O CCQ digitado é salvo em question_attempts e enviado para
error_notebook por create_error_entry.

SUPABASE
Rode UMA VEZ:
fase7_ccq_metricas.sql

ARQUIVOS A SUBSTITUIR/ADICIONAR
- ambientacao.html
- ambientacao.js
- ambientacao.css
- questoes-simulados.html
- questoes-simulados.js
- dashboard.html
- dashboard.js

NÃO PRECISA ALTERAR
- app.js
- style.css
- flashcards.js
- caderno-erros.js
- configuracoes.js

PUBLICAÇÃO
git add -A
git commit -m "Fase 7 CCQs e metricas de simulados"
git push origin main

Depois faça Ctrl + F5.

TESTE RÁPIDO
1. Rode o SQL.
2. Questões e Simulados:
   - abra um simulado;
   - marque uma questão como erro;
   - salve o gabarito;
   - preencha o CCQ;
   - envie ao Caderno de Erros.
3. Volte à página e confira as métricas do topo.
4. Abra o Dashboard e confira Simulados + Simulados recentes.
5. Abra a Ambientação e confira os CCQs em rotação.

OBSERVAÇÃO
O pedido anterior de “campo CCQ quando envio ao Caderno de Erros”
foi aplicado ao fluxo de Questões e Simulados, que é o fluxo atual
que chama create_error_entry. Se você também tiver outro formulário
separado dentro de Editais/Provas que envia questões ao Caderno,
ele pode receber o mesmo campo depois sem mudar este pacote.
