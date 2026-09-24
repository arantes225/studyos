# Auditoria automática Perplexity — Fábrica de Questões

## Objetivo
Executar a auditoria clínica/editorial LURIA 3.4 de forma retomável e idempotente, persistindo um parecer individual por questão e versão atual.

## Fluxo
1. O Admin divide o bloco em faixas Q001–Q050, Q051–Q100, Q101–Q150 e Q151–Q200.
2. Para cada questão, a Edge Function `question-factory-perplexity-audit` busca a versão atual.
3. Se ainda não houver resolução cega da versão, envia somente enunciado e alternativas ao Perplexity e persiste `blind_resolution`.
4. Na chamada seguinte, usa a resposta cega imutável para executar a auditoria completa com pesquisa web e verificação de fontes.
5. O JSON é normalizado e validado pelo banco.
6. O parecer é persistido somente por `admin_import_question_factory_stage`; não há escrita direta na tabela de reviews pelo cliente.
7. A cobertura é relida por `admin_question_factory_review_coverage`.
8. Métricas cumulativas são registradas por `admin_import_question_factory_stage_metrics`.
9. A faixa só é concluída quando todos os itens elegíveis da versão atual possuem review persistido.

## Idempotência
A chave lógica das etapas Perplexity é:

`item_id + item_version + review_stage + reviewer`

O índice parcial `question_factory_reviews_perplexity_logical_uq` impede duplicação de `blind_resolution`, `perplexity_initial` e `perplexity_reaudit`.

## Validação LURIA 3.4
O validador `private.qf_assert_perplexity_review_v34` exige, entre outros:
- resposta independente e concordância;
- single-best-answer, ambiguidade e hard fails;
- surface guess sem vinheta;
- assimetria lexical e dependência da vinheta;
- melhor distrator e contrafactual;
- dois functional killers distintos;
- avaliação A–D das explicações;
- validação da mensagem-chave;
- fontes verificadas;
- proposed_change estruturado;
- problemas científicos, de fonte, redação, estilo e dificuldade.

Campos adicionais permanecem estruturados dentro de `raw_payload`, enquanto os campos centrais também são persistidos nas colunas próprias de `question_factory_reviews`.

## Verificação de fontes
A Edge Function não aceita apenas a URL declarada pela questão/modelo como prova. Uma fonte marcada como VERIFIED precisa:
- estar acessível;
- aparecer nas evidências retornadas pelo mecanismo de busca/fetch do Perplexity;
- ter título/ano/seção confirmados;
- sustentar a resposta.

Se isso não puder ser confirmado, o parecer recebe `SOURCE_VERIFICATION_PENDING` ou `SOURCE_VERIFICATION_FAILED` e não pode ser aprovado.

## Reauditoria
Quando o ChatGPT corrige uma questão e incrementa a versão, a nova versão precisa de uma nova resolução cega antes de `perplexity_reaudit`. A cobertura de reauditoria conta apenas versões efetivamente corrigidas/eligíveis, e não exige 50 pareceres quando somente um subconjunto da faixa mudou.

## Segredo do provedor
A Edge Function espera `PERPLEXITY_API_KEY` nos Secrets das Edge Functions do Supabase. A chave nunca deve ser colocada no JavaScript do cliente, em payload de review ou commitada no GitHub.

## Critério de conclusão
Exemplo Q001–Q050:
- `range.expected = 50`
- `persisted = 50`
- `pending_ids = []`
- `complete = true`

O bloco inicial Q001–Q200 só avança quando a cobertura atual do Perplexity atingir 200/200.