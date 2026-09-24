# Fábrica de Questões LURIA — contrato 2.0

Atualizado em 23/09/2026. Este documento substitui as instruções operacionais anteriores. Histórico de pilotos e versões permanece no histórico do Git e nos registros de calibração; não constitui identidade de banca.

## Fontes únicas

- `assets/js/question-factory-prompts.js`: constrói geração, calibração, resolução cega, checagem, auditoria, adjudicação, correção e revisões finais.
- `public.question_exam_style_profiles`: perfil canônico e corpus documentado de cada banca.
- `db/question_factory_contract_v2.sql`: validação e transições do banco.
- Os cinco prompts genéricos em `admin.html` e `admin/index.html` são cópias geradas do mesmo módulo. O teste verifica igualdade. Não editá-los isoladamente.

Todos os botões de geração combinam perfil canônico, instruções complementares, cuidados, estratégia científica e contrato de saída. Uma página de instituição é ponto de partida, não prova de corpus analisado.

## Regras fixas

1. Exatamente quatro alternativas A–D em todas as bancas, inclusive AMP-PR. Nunca aplicar penalização editorial por adaptar o número de opções da prova oficial.
2. Uma única melhor resposta; enunciado autossuficiente; explicações A–D individualizadas; mensagem-chave; fontes reais.
3. Estilo e conteúdo científico têm referências independentes. Provas oficiais ensinam forma; fontes científicas sustentam respostas.
4. Distratores representam erros plausíveis no mesmo eixo decisório. Evitar alternativas caricatas, pistas de extensão e absolutos denunciadores.
5. Dificuldade é estimativa editorial até haver desempenho de candidatos. Tema raro ou narrativa longa não comprova dificuldade.
6. Não copiar nem reconstruir questão existente. Verificar duplicatas por conceito, decisão e cenário, além de texto.
7. Não impor matriz ENAMED, quotas de cálculo, dificuldade ou contexto SUS a todas as bancas. Planejar cobertura conforme o processo-alvo e registrar o fundamento.
8. JSON 2.0 é formato de intercâmbio. Excel é exportação humana opcional.

## Calibração editorial antes da produção

Registrar corpus em `primary_style_evidence[]`: `url`, `edition`, `sampled_items` e `observed_features`. Identificar acesso direto, modalidade correta, itens/páginas, tamanho da amostra, distribuição de formatos, operações cognitivas, extensão em palavras e limites da comparação.

Preferir pelo menos 20 itens oficiais de 2–3 edições quando disponíveis. Ausência de corpus suficiente = `NEEDS_MORE_PRIMARY_STYLE_DATA`; não inventar assinatura nem nota de estilo. Um edital não substitui questões oficiais.

Avaliar ao menos 15 questões brutas inéditas e variadas para avanço do prompt; amostras maiores aumentam a confiança da calibração. A nota é `FINAL_PROMPT_SCORE` (0–100), calculada por rubrica própria:

| Componente | Máximo |
|---|---:|
| Fidelidade ao corpus | 40 |
| Distratores | 20 |
| Adequação da dificuldade | 15 |
| Diversidade e ausência de pistas | 15 |
| Clareza e completude | 10 |

Avanço: soma >=84, zero hard fails, corpus documentado e `decision=PROMPT_APPROVED`. Fontes e correção científica devem ser checadas separadamente. Questões corrigidas não elevam retroativamente a nota da saída bruta. O importador valida estrutura e soma; a veracidade das evidências ainda requer auditoria humana/documental.

`style_score` descreve fidelidade observada em um conjunto de questões e não substitui `FINAL_PROMPT_SCORE`. Importar calibração pelo botão correspondente no admin.

## Orientação por banca

| Perfil | Delimitação obrigatória |
|---|---|
| ENAMED | Matriz e caderno INEP contemporâneos; contexto e competência funcionais. |
| SUS-SP | Processo SUS-SP atual; decisões e forma observadas no caderno. |
| SES-DF | Residência médica contemporânea; rede apenas quando modifica a decisão. |
| Santa Casa-SP | Processo médico/edição correta; formatos e densidade medidos nas provas. |
| UERJ | Residência UERJ/CEPUERJ, jamais vestibular; cálculo quando demonstrado e funcional. |
| PSU-GO | Corpus próprio; não substituir por PSU-MG. |
| PSU-MG | Corpus próprio AREMG; não presumir quota de MBE. |
| USP-SP | Residência médica FMUSP/FUVEST; prestígio não prova dificuldade. |
| UNIFESP | Residência médica EPM; não usar multiprofissional ou outra banca paulista. |
| AMP-PR | Prova Geral de acesso direto; variedade documentada, adaptada a A–D. |

Campos antigos de incidência/extensão sem evidência permanecem hipóteses, não regras de produção. Registros de auditoria diagnosticam o gerador; mudança de identidade exige fundamento no corpus.

## Geração e cobertura

Bloco administrativo = 200; lote = cinco blocos, 1.000. Execução pode ser repartida em partes de 20. Cada parte identifica IDs, sequência e cobertura; a consolidação confere 200 IDs únicos e posições 1–200 sem lacunas. Não declarar tarefa integral quando restarem partes.

A questão inclui ID imutável, código, banca, área, tema, subtema, dificuldade, enunciado, alternativas A–D, gabarito, explicações A–D, mensagem-chave, fonte geral, fonte específica do gabarito e versão 1/status generated.

Fonte específica: instituição, documento, ano, URL e seção/nota quando verificáveis. Conferir o trecho que sustenta dose, corte, indicação ou decisão. `SOURCE_VERIFICATION_PENDING` impede aprovação; fonte ampla/inacessível não é automaticamente fonte falsa.

## Fluxo do bloco

1. Geração e checagem ChatGPT.
2. Exportar prova cega pelo admin. O arquivo contém somente ID, versão, enunciado e alternativas.
3. Perplexity resolve em conversa limpa e retorna `blind_resolution`, com `independent_answer`, `item_version` e `reason`. Se irresolúvel, resposta null. Importar antes de revelar as respostas. Registro cego não é sobrescrito na mesma versão.
4. Exportar pacote completo e auditar fontes, ciência, explicações e estilo. Preservar resposta cega; divergência impede aprovação.
5. Itens pendentes seguem para adjudicação ChatGPT. Informar `review_id`, `item_version`, `agreement_status`, justificativa e `approved_patch` exato.
6. `agree/partially_agree` autorizam exclusivamente os valores aprovados. `disagree` exige rebuttal e impede correção; retornar ao auditor. O importador verifica parecer e versão.
7. Correção envia ID, `expected_version`, `review_id` e `patch`. Banco incrementa versão em exatamente um e invalida aprovações anteriores, inclusive finais do lote.
8. Nova resolução cega da versão corrigida e reauditoria completa desses itens. Reauditoria é autocontida, com mesma rubrica. Não estimar estilo global usando apenas os corrigidos.
9. Somente 200 versões atuais machine-approved e perfil editorial calibrado >=84 permitem aprovação humana do bloco.

Não existe garantia técnica de que um auditor não viu o gabarito fora do sistema. A separação de arquivos e registro anterior reduz contaminação; a operação precisa usar conversa limpa.

## Rubrica final da questão

Scientific 25; answer_key 20; answer_source 15; distractors 10; explanations 10; style 10; writing 5; difficulty 5. Soma exata = quality_score.

Aprovação exige >=97, style >=9,7, componentes nos tetos, gabarito independente coincidente, hard_fail=false, ambiguity=false, single_best_answer=true, answer_source_issue=null, fontes e corpus VERIFIED e fontes verificadas preenchidas.

Requisitos adicionais: distractor_quality GOOD/EXCELLENT; alternative_granularity PASS (mesmo comando/nível de decisão); difficulty_alignment PASS (fundamento no item e no corpus).

Sem corpus suficiente, style=null/quality_score=null e needs_revision, sem inventar penalização numérica. Nota nula nunca aprova. Hard fails: erro de gabarito, segunda resposta defensável, dado essencial ausente, conduta insegura, dose/cutoff errado, fonte falsa/incompatível, desatualização relevante, contradição de explicação, erro matemático relevante ou cópia.

## Revisão global e publicação

ChatGPT e Perplexity revisam independentemente o lote atual. Os revisores sinalizam problemas; não editam silenciosamente.

Todos conferem o conjunto quanto a duplicatas, cobertura, pistas e consistência. O contrato descreve rechecagem de todos os itens de risco/corrigidos e amostra estratificada de pelo menos 20% dos demais. Enquanto não existir classificação estruturada confiável de risco no banco, a implementação exige rechecagem científica das 1.000 questões, explicitamente registrada em coverage.

A revisão final contém `version_manifest` integral copiado da exportação, `global_reviewed_ids`, `scientific_rechecked_ids`, método de seleção e declaração de riscos rechecados. Não chamar amostra de auditoria integral. Achados pendentes são incompatíveis com approved. Itens sinalizados retornam à adjudicação e invalidam as revisões do lote.

Aprovação humana final só fica disponível após as três revisões aprovadas da mesma versão e cinco blocos aprovados. `ready` não significa publicação automática. Nunca apagar fontes/histórico necessário para rastrear decisões antes de confirmar persistência final.

## Telemetria operacional por etapa

Toda saída de IA da fábrica deve incluir o objeto top-level `stage_metrics`. Ele contém banca, lote/bloco quando aplicável, etapa, provedor, total processado, aprovadas, a revisar, rejeitadas, hard rejects, concordâncias independentes, score agregado quando existir, status, métricas extras e nota curta.

### Persistência automática

Quando ChatGPT ou Perplexity estiverem rodando em um ambiente com conector Supabase autorizado e execução SQL disponível, a própria IA deve persistir `stage_metrics` ao terminar a etapa usando **somente**:

`select private.qf_record_stage_metrics('<STAGE_METRICS_JSON>'::jsonb);`

A função:
- valida banca, etapa, provedor, score e contagens;
- aceita apenas a telemetria operacional;
- usa `event_key`/run label para tornar retries idempotentes;
- atualiza o horário da banca para refletir a nova etapa no dashboard;
- não autoriza a IA a escrever diretamente em questões, perfis, lotes ou outras tabelas.

A IA nunca deve receber, pedir ou imprimir senha, service role, token ou chave do Supabase. A autenticação pertence ao conector já autorizado.

Se a gravação automática retornar `stored=true`, a IA registra o `event_key` retornado. Se a chamada falhar ou não houver conector, ela não inventa sucesso: devolve `stage_metrics` normalmente e o mesmo JSON pode ser importado pelo Admin pelo botão **Atualizar dados da etapa**.

O Supabase continua sendo a fonte de verdade; planilhas/CSV são apenas exportações do histórico.

## Operação e manutenção

Endpoints exigem administrador e sessão PIN válida; acesso anônimo é revogado. Exports e imports conferem lote/bloco sem reatribuir IDs silenciosamente. Não aceitar JSON de versão antiga como aprovação 2.0.

Executar `node --test tests/question-factory.test.cjs`. Testes SQL de contrato em `tests/question-factory.sql` devem rodar em transação com rollback. Atualizações de prompts e funções devem permanecer versionadas no Git.
