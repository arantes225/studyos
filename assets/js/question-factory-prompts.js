/* Contrato único da fábrica. Não inserir resultados históricos como identidade editorial. */
(function (root) {
  'use strict';
  const VERSION = '3.7';
  const SCHEMA_VERSION = '2.0';
  const rubric = { scientific:25, answer_key:20, answer_source:15, distractors:10, explanations:10, style:10, writing:5, difficulty:5 };
  const editable = ['enunciado','alternativa_a','alternativa_b','alternativa_c','alternativa_d','gabarito','explicacao_a','explicacao_b','explicacao_c','explicacao_d','mensagem_chave','area','tema','subtema','dificuldade','fonte_instituicao','fonte_documento','fonte_ano','fonte_url','answer_source_institution','answer_source_document','answer_source_year','answer_source_url','answer_source_section','answer_source_note'];
  const stringify = value => JSON.stringify(value, null, 2);
  const rules = `CONTRATO LURIA ${VERSION}
Exatamente quatro alternativas A-D em TODAS as bancas; nunca penalizar essa adaptação.
Uma única melhor resposta; dados suficientes; contexto coerente; conteúdo autoral.
PULO DO GATO OBRIGATÓRIO: toda questão deve conter mensagem_chave preenchida como o “Pulo do Gato” — UMA frase curta, específica e memorável que, se o aluno tivesse acabado de ouvir antes da prova, seria suficiente para levá-lo à resposta correta daquela questão. Não escrever resumo genérico, definição ampla, repetição do gabarito ou conselho vago; capturar exatamente o discriminador decisivo do item.
EXPLICAÇÃO OBRIGATÓRIA DAS ALTERNATIVAS: explicar individualmente por que a alternativa correta está certa E por que cada uma das outras três está errada naquele caso. As explicações A-D devem ser específicas para a vinheta, o comando e a alternativa, deixando claro o dado que confirma a correta e o erro clínico/conceitual de cada distrator. “Incorreta”, “não é a melhor” ou justificativa genérica não são aceitas.
HARD REJECT 10 — PULO DO GATO / EXPLICAÇÕES INCOMPLETAS: se mensagem_chave estiver vazia, genérica, não permitiria acertar o item após ser ouvida, ou se qualquer uma das explicações A-D não disser concretamente por que aquela opção está certa/errada, o item não pode ser aprovado e deve voltar para correção.
RELATÓRIO QUESTÃO POR QUESTÃO OBRIGATÓRIO: toda etapa de revisão, auditoria, reauditoria ou revisão final deve produzir também uma seção humana sequencial, um item por linha/bloco, sem agrupar questões. Formato mínimo: “42 — REJEITADA — motivo: ...”, “43 — APROVADA — motivo: ...” ou “44 — REVISAR — motivo: ...”. Sempre usar número/ID da questão, status explícito e motivo concreto. Não aceitar apenas totais agregados. Mesmo quando o JSON estruturado já contiver reviews[], repetir um resumo legível questão por questão para facilitar conferência humana.
STATUS PADRÃO DO RELATÓRIO POR ITEM: APROVADA | REVISAR | REJEITADA. Se REJEITADA, indicar o hard reject ou falha principal; se REVISAR, dizer exatamente o que precisa mudar; se APROVADA, registrar brevemente por que passou.
Distratores devem permanecer no mesmo eixo decisório e representar erros médicos reais, próximos e plausíveis; não fabricar uma resposta madura contra três caricaturas.
CONCORRENTE FORTE OBRIGATÓRIO: em item médio/difícil, pelo menos um distrator deve continuar defensável após a leitura completa até que um dado discriminativo específico o derrube. Associação apenas temática não conta.
REGRA DE SOBREVIVÊNCIA MÍNIMA: além da correta, pelo menos DOIS distratores devem permanecer plausíveis após leitura superficial de comando + alternativas e só devem cair após uso de um dado funcional específico da vinheta. Se apenas um concorrente sobrevive e dois distratores morrem cedo, REJEITAR e regenerar as alternativas.
GATE DE DISTRATORES: antes de aceitar o item, verificar se pelo menos dois incorretos poderiam ser considerados por candidato parcialmente preparado e só caem por dado, indicação, timing, prioridade, contraindicação, sequência ou nuance técnica. Se 2–3 opções caem por absurdo, negligência, categoria incompatível ou linguagem denunciadora, REESCREVER.
TESTE CEGO DAS ALTERNATIVAS: antes de ler a vinheta, o revisor deve tentar prever a chave apenas pelo comando + opções. Se a forma, sofisticação, prudência ou completude apontar a correta com confiança média/alta, rejeitar automaticamente.
BLIND-OPTIONS HARD REJECT: o teste comando + alternativas sem vinheta é eliminatório. Se a chave puder ser prevista com confiança média/alta por completude, prudência, condicionalidade, número de ações, tecnicidade ou sofisticação textual, o item é REJECTED; não registrar como mera observação de estilo.
PASSE CEGO OBRIGATÓRIO DAS OPÇÕES: apresentar ao revisor apenas comando + alternativas, sem vinheta. Se ele conseguir prever a chave com confiança alta por sofisticação, extensão, prudência, cautela ou completude textual, REJEITAR e regenerar SOMENTE as alternativas.
HARD REJECT 1 — SURFACE GUESS: o revisor independente deve examinar comando + alternativas sem usar a vinheta. Se surface_guess_without_vignette == gabarito com confiança média ou alta, o item é REJECTED, não apenas needs_revision. Regenerar as alternativas do zero e submeter novamente à revisão.
VALIDADOR DE ASSIMETRIA ESTRUTURAL: rejeitar automaticamente quando a correta for a única alternativa com linguagem de avaliação/consideração/monitorização/individualização, ressalva condicional, combinação de duas ações ou maior completude técnica, enquanto os distratores forem mais curtos, absolutos ou unidimensionais.
HARD REJECT 2 — ASSIMETRIA LEXICAL: se lexical_asymmetry == FAIL, o item é REJECTED. Não corrigir apenas trocando uma palavra; regenerar o conjunto de alternativas preservando o eixo clínico. Exceção somente quando o absoluto for exatamente o conhecimento científico avaliado e o revisor registrar justificativa explícita.
HARD REJECT 5 — ELIMINAÇÃO SUPERFICIAL: se DUAS OU MAIS alternativas puderem ser descartadas sem uso material dos dados funcionais da vinheta, por absurdo, categoria errada, negligência, extremismo, incompletude grosseira ou tom formal, o item é REJECTED e deve ser regenerado. Exceção: item fácil deliberadamente direto, desde que as quatro alternativas permaneçam clinicamente homogêneas e sem caricaturas.
HARD REJECT 6 — ASSIMETRIA DE SOFISTICAÇÃO: comparar correta versus distratores em comprimento, cautela, condicionalidade, tecnicidade, completude e número de ações. Se a chave for a única alternativa claramente mais madura, individualizada, protetora ou tecnicamente completa, o item é REJECTED e as alternativas devem ser regeneradas.
GATE DE ESPECIFICIDADE: quando os dados permitem decisão concreta, não aceitar chave protetora/genérica como 'tratamento adequado', 'reversão apropriada', 'avaliar e tratar conforme gravidade' ou 'escalonar conforme controle'. Cobrar a decisão discriminativa.
DISTRATORES DO MESMO NÓ DECISÓRIO: priorizar erros de limiar, timing, indicação parcialmente satisfeita, prioridade invertida, interpretação errada de dado funcional ou sequência terapêutica incorreta. Evitar condutas genericamente ruins ou apenas tematicamente relacionadas.
HARD REJECT 3 — CONTRAFACTUAL: em item médio/difícil, se o melhor distrator só se tornar correto mediante mudança do diagnóstico inteiro, alteração da própria alternativa ou cenário distante, o item é REJECTED. Exigir pequena mudança clinicamente plausível da vinheta que torne o melhor distrator correto ou claramente mais defensável.
HARD REJECT 7 — SBA INDEPENDENTE: um segundo resolvedor independente deve responder sem conhecer a chave. Se independent_answer != gabarito, suspender automaticamente o item para revisão científica/SBA; nunca assumir que o resolvedor errou. Se houver mais de uma estratégia clinicamente aceita sem dado de desempate explícito, REJECTED.
FUNCTIONAL_KILLER OBRIGATÓRIO: para os dois melhores distratores, registrar explicitamente functional_killer_1 e functional_killer_2 no parecer. Cada campo deve citar um dado concreto da vinheta e completar a frase “esta alternativa seria defensável, exceto porque a vinheta informa ___”. Campo vazio, genérico ou baseado apenas em regra abstrata = REJECTED.
HARD REJECT 8 — DADO DE ELIMINAÇÃO DOS DOIS MELHORES DISTRATORES: para cada um dos dois melhores distratores, o revisor deve completar “esta alternativa só cai porque a vinheta informa ___”. Se não houver dado específico e funcional para ambos, REJECTED.
HARD REJECT 9 — MÚLTIPLAS CORRETAS: se a defesa da chave depender apenas de “mais usual”, “mais completa”, “em geral preferível” ou preferência entre estratégias aceitas, REJECTED; fechar melhor o cenário antes de nova revisão.
HARD REJECT 4 — DEPENDÊNCIA DA VINHETA: em item médio/difícil, se vignette_dependency == FAIL ou se nenhum dado concreto explicar por que a chave vence o melhor distrator, o item é REJECTED. Cada dado destacado deve apoiar/afastar diagnóstico ou mudar gravidade, prioridade, indicação, contraindicação, timing, sequência, cálculo ou decisão.
GATE DE PADRÃO CLÁSSICO: item moderado/difícil não pode se resumir a achado clássico → resposta clássica contra três absurdos. A dificuldade deve emergir de alternativas concorrentes e contexto, não do nome do tema.
GATE DE LOTE: depois da validação individual, um revisor deve procurar padrões transversais de quadro clássico + conduta óbvia, correta madura contra três extremos, universalizadores concentrados nos distratores, mesma operação cognitiva, mesmo nível de atenção e esqueleto semântico repetido. Se o padrão aparecer em série, reescrever os itens responsáveis mesmo que isoladamente sejam aceitáveis. Não usar quotas universais.
GATE DE POSIÇÃO: a letra correta é atributo de apresentação, não identidade editorial. Em LOTES DE CALIBRAÇÃO com 15 itens, depois de fechar integralmente conteúdo e alternativas, reordenar SOMENTE as posições para que o gabarito siga exatamente A-B-C-D-A-B-C-D-A-B-C-D-A-B-C. Nunca alterar o conteúdo médico para fabricar a letra. No site, as questões poderão ser misturadas posteriormente.
Dificuldade depende do raciocínio exigido e da competição entre alternativas, e deve ser atribuída/revalidada somente após o item completo. Não usar tema, gravidade, quantidade de dados ou contagem rígida de 'etapas cognitivas' como proxy. Evitar pistas de comprimento, absolutos denunciadores, repetição de moldes e rotação mecânica de gabarito.
Estilo vem de cadernos oficiais do processo-alvo; ciência vem de fontes científicas independentes. Edital sozinho não demonstra arquitetura dos itens.
Não inventar documento, edição, URL, seção, dados de corpus ou característica de banca. Falta de acesso = SOURCE_VERIFICATION_PENDING; falta de corpus = NEEDS_MORE_PRIMARY_STYLE_DATA; ambas impedem declarar aprovação correspondente.
Usar fonte atual aplicável à pergunta e ao cenário brasileiro. Fonte internacional adequada não perde pontos por nacionalidade. Conflitos entre recomendações exigem contexto explícito que assegure resposta única.
CALIBRAÇÃO DO PROMPT: FINAL_PROMPT_SCORE >=84/100 na saída bruta inédita, antes de correções; não confundir com style_score.
QUESTÃO FINAL: quality_score >=97/100, style >=9.7/10, rubrica completa, fontes verificadas, sem hard fail, sem ambiguidade e com única melhor resposta. Nota alta não compensa falha eliminatória.
Feedback sobre distratores, clareza e segurança pode melhorar regras gerais; só alterar a identidade da banca com evidência primária documentada.
PERSISTÊNCIA FLEXÍVEL E INCREMENTAL — RESULTADO DA ETAPA:
- Para perplexity_initial e perplexity_reaudit, a FONTE DE VERDADE DE LEITURA é a página pública temporária da Fábrica de Questões informada no ENDEREÇO OPERACIONAL do prompt. O Perplexity deve abrir esse endereço no navegador, selecionar o bloco correto e trabalhar somente sobre as versões exibidas ali.
- O Perplexity NÃO deve depender de conector Supabase, SQL, RPC, API key, service_role, anon key, JWT ou acesso ao Admin para executar essas duas etapas.
- O resultado deve ser enviado pelo FORMULÁRIO "Enviar resultado" da própria página pública, em JSON completo, preservando question_id + item_version. O formulário registra o pacote em uma caixa de entrada isolada para validação posterior; ele NÃO altera diretamente a questão principal.
- Não existe tamanho obrigatório de lote por envio: pode enviar 1 questão, pequenos grupos ou um grupo maior, desde que reviews[] esteja completo e todos os itens pertençam ao mesmo bloco/etapa.
- Se um envio falhar, mantenha o JSON localmente, corrija apenas o problema apontado e reenvie. Nunca invente confirmação.
- stage_metrics, totais agregados e relatório textual NÃO substituem reviews individuais.
- Para etapas executadas pelo ChatGPT dentro do ambiente administrativo, permanecem válidos os importadores/RPCs controlados já definidos para a etapa.
CONFIRMAÇÃO APÓS ENVIO DO PERPLEXITY:
- Só declarar "ENVIADO AO BRIDGE" quando a própria página retornar protocolo/receipt_id.
- Esse protocolo confirma RECEBIMENTO no bridge, não importação definitiva na Fábrica. Nunca declarar "persistido no Supabase", "coverage completo" ou "etapa concluída no banco" com base apenas no formulário.
- A validação/importação definitiva é feita depois pelo fluxo administrativo da LURIA.
TELEMETRIA OBRIGATÓRIA POR ETAPA: toda saída JSON deve incluir um objeto top-level stage_metrics. Ele é lido pelo Admin e persistido no Supabase para atualizar o dashboard automaticamente. Preencher com dados REAIS da etapa; nunca estimar contagens. Estrutura obrigatória:
stage_metrics = {
  exam_style: banca atual,
  batch_number: lote atual ou null,
  batch_code: ID humano do lote no formato L001 quando houver lote,
  block_number: bloco atual ou null,
  block_code: ID humano do bloco no formato L001-B01 quando houver bloco,
  stage: nome exato da etapa,
  provider: ChatGPT | Perplexity | Human,
  run_label: identificador curto opcional da rodada/parte,
  total_count: quantidade realmente processada nesta resposta,
  approved_count: quantidade aprovada nesta etapa,
  needs_revision_count: quantidade que precisa revisão,
  rejected_count: quantidade rejeitada,
  hard_reject_count: quantidade com hard reject,
  agreement_count: quantidade em que resposta independente concordou com o gabarito quando aplicável,
  score: nota agregada REAL da etapa quando existir, senão null,
  status: estado agregado da etapa,
  metrics: objeto livre com métricas adicionais úteis,
  notes: resumo operacional curto
}.
TELEMETRIA / DESTINO:
- Se provider=Perplexity e stage for perplexity_initial ou perplexity_reaudit, NÃO tentar gravar stage_metrics diretamente no Supabase. Incluir stage_metrics no MESMO JSON enviado pelo formulário público. Registrar bridge_write={attempted:true,received:true,receipt_id:<protocolo>} somente se a página confirmar o protocolo; se falhar, bridge_write={attempted:true,received:false,error:<erro real>}.
- Se provider=ChatGPT e o ambiente administrativo tiver acesso autorizado ao Supabase, a telemetria pode continuar usando SOMENTE a função controlada private.qf_record_stage_metrics(...), conforme o fluxo interno.
- Nunca fazer INSERT/UPDATE/DELETE direto para telemetria ou reviews.
- Nunca pedir, imprimir, armazenar ou inventar service_role, senha, token, anon key, publishable key, JWT ou chave do Supabase.
JSON válido é o contrato máquina-a-máquina. Não preencher aprovações, fontes verificadas ou notas sem executar a avaliação. IDs são imutáveis; toda revisão informa item_version e toda correção informa expected_version.`;
  const rubricText = `RUBRICA FINAL (pesos máximos; soma exata = quality_score):\n${stringify(rubric)}
scientific: exatidão e atualização; answer_key: gabarito e univocidade; answer_source: suporte documental específico; distractors: plausibilidade/discriminação; explanations: justificativas A-D completas + Pulo do Gato discriminativo; style: aderência demonstrada ao corpus; writing: clareza; difficulty: adequação ao perfil.
Cada perda precisa de motivo observável; respeitar os tetos. Sem corpus suficiente, style=null, quality_score=null e status=needs_revision; registrar a pendência sem inventar nota baixa de fidelidade.
Hard fail: gabarito errado, múltiplas respostas defensáveis, dado essencial ausente, conduta insegura, dose/cutoff incorreto, recomendação desatualizada, fonte falsa ou incompatível, explicação contraditória, erro matemático relevante, cópia reconhecível.
Fonte ampla ou temporariamente inacessível bloqueia aprovação, mas não é automaticamente fonte falsa.
Requisitos finais adicionais: distractor_quality GOOD ou EXCELLENT (pelo menos dois distratores competitivos, sem opção caricata); alternative_granularity PASS (opções respondem ao mesmo comando e nível de decisão); difficulty_alignment PASS (classificação sustentada pela tarefa e corpus).`;
  function profile(item={}) {
    return `BANCA: ${item.exam_style || 'INFORMAR BANCA CADASTRADA'}
PERFIL CANÔNICO\n${item.full_generation_brief || ''}
INSTRUÇÕES DE GERAÇÃO\n${item.generation_instructions || ''}
REGRAS COMPLEMENTARES\n${item.recommended_generation_rules || ''}
CUIDADOS\n${item.what_to_avoid || ''}
FONTES CIENTÍFICAS\n${item.scientific_source_strategy || 'Documento primário atual que sustente a decisão exata, incluindo seção quando verificável.'}
PONTO DE PARTIDA PARA CORPUS (não equivale a prova analisada): ${item.style_reference_url || 'a localizar'}
CORPUS VERIFICADO: ${stringify(item.primary_style_evidence || [])}
ESTADO DE CALIBRAÇÃO: ${stringify(item.prompt_calibration || {})}
Não incorporar calibration_notes, style_score_note ou resultados de lotes anteriores à identidade.
Se prompt_calibration.status == "CALIBRATED_FROZEN" OU prompt_calibration.identity_status == "FROZEN" OU (prompt_calibration.decision == "PROMPT_APPROVED" e final_prompt_score >=84), o perfil já é canônico para produção: NÃO reabrir calibração, NÃO exigir novo corpus antes de gerar e NÃO alterar identidade editorial por resultados do lote em produção. O corpus pode ser enriquecido depois sem bloquear produção.
Somente perfis ainda não aprovados devem registrar edição, URL oficial, IDs/páginas, n amostrado, formatos e limites da amostra antes de declarar fidelidade. Preferir >=20 itens e 2–3 edições quando disponíveis; não inventar edições inexistentes.`;
  }
  function context(item, ctx={}) {
    const batchNumber = ctx.batch_number ?? null;
    const blockNumber = ctx.block_number ?? null;
    const batchCode = ctx.batch_code || (batchNumber == null ? null : 'L'+String(Number(batchNumber)).padStart(3,'0'));
    const blockCode = ctx.block_code || (batchCode && blockNumber != null ? batchCode+'-B'+String(Number(blockNumber)).padStart(2,'0') : null);
    return {
      schema_version:SCHEMA_VERSION,
      batch_number:batchNumber,
      batch_code:batchCode,
      block_number:blockNumber,
      block_code:blockCode,
      operational_address:blockCode || batchCode || null,
      exam_style:item?.exam_style || null
    };
  }

  function operationalAccess(ctx={}, stage='') {
    const batchNumber = ctx.batch_number ?? null;
    const blockNumber = ctx.block_number ?? null;
    const batchCode = ctx.batch_code || (batchNumber == null ? null : 'L'+String(Number(batchNumber)).padStart(3,'0'));
    const blockCode = ctx.block_code || (batchCode && blockNumber != null ? batchCode+'-B'+String(Number(blockNumber)).padStart(2,'0') : null);
    const operationalAddress = blockCode || batchCode || null;
    const isPerplexityBridgeStage = ['perplexity_initial','perplexity_reaudit'].includes(stage);
    const bridgeBase = 'https://raw.githubusercontent.com/arantes225/studyos/main/qf-r8K2mV7qL4x9P1cF/';
    const bridgeUrl = blockCode ? bridgeBase + blockCode + '.json' : bridgeBase;
    const bridgeSubmitBase = 'https://www.resibulando.online/qf-r8K2mV7qL4x9P1cF/';
    const bridgeSubmitUrl = blockCode ? bridgeSubmitBase + '?block=' + encodeURIComponent(blockCode) : bridgeSubmitBase;
    const workspace = ctx.prompt_workspace_url || ctx.workspace_url || (isPerplexityBridgeStage ? bridgeUrl : 'https://www.resibulando.online/admin/');
    const source = ctx.prompt_source_instruction || (isPerplexityBridgeStage
      ? (blockCode
          ? `Abra EXATAMENTE ${bridgeUrl}. Esse endereço é o arquivo RAW público do GitHub e retorna JSON direto do bloco ${blockCode}, sem depender de JavaScript, login, GitHub UI ou sessão autenticada. Use EXCLUSIVAMENTE esse JSON como fonte de leitura. NÃO use anexos, arquivos enviados no chat, pasted_text, exportações anteriores ou histórico da conversa como substituto.`
          : 'Este prompt do Perplexity está sem block_code concreto. NÃO executar até receber um bloco L001-B01 a L001-B05.')
      : (blockCode
          ? `Entre no Admin da LURIA/Resibulando → Fábrica de questões → Produção em tempo real → lote ${batchCode} → bloco ${blockCode}. Leia exclusivamente as questões e versões atuais desse bloco.`
          : batchCode
            ? `Entre no Admin da LURIA/Resibulando → Fábrica de questões → Produção em tempo real → lote ${batchCode}. Trabalhe exclusivamente nesse lote.`
            : 'Este é um prompt-modelo sem lote/bloco vinculado. NÃO executar nem persistir até receber um endereço operacional concreto.'));
    const destination = ctx.prompt_return_instruction || (isPerplexityBridgeStage
      ? (blockCode
          ? `Depois de auditar a partir de ${bridgeUrl}, abra EXATAMENTE ${bridgeSubmitUrl} e use o formulário "Enviar resultado". Cole o JSON completo desta etapa e clique em "Enviar parecer". Só considere recebido se a página retornar um protocolo/receipt_id. O formulário é uma caixa de entrada isolada e NÃO modifica diretamente a questão principal.`
          : 'Sem bloco concreto: não enviar nada.')
      : (blockCode
          ? `Grave o resultado exclusivamente no lote ${batchCode}, bloco ${blockCode}, na etapa indicada. Nunca escrever em outro bloco.`
          : batchCode
            ? `Grave o resultado exclusivamente no lote ${batchCode}, na etapa indicada. Nunca escrever em outro lote.`
            : 'Sem destino operacional: não gravar nada.'));

    const stagePersistence = {
      blind_resolution: `PERSISTÊNCIA DESTA ETAPA — PERPLEXITY / RESOLUÇÃO CEGA:
- Gravar SOMENTE o registro de resolução cega/parecer separado associado a question_id + item_version + ${blockCode || 'bloco atual'}.
- PROIBIDO alterar enunciado, alternativas, gabarito, explicações, mensagem_chave, fontes ou version da questão principal.
- A resolução cega deve permanecer isolada para ser confrontada posteriormente com o gabarito.`,
      perplexity_initial: `DESTINO DESTA ETAPA — PERPLEXITY / AUDITORIA:
- Ler o bloco exclusivamente pela página pública temporária indicada acima.
- NÃO usar conector Supabase, SQL, RPC, Admin ou API do Perplexity para obter as questões.
- Para cada item, preservar exatamente question_id e item_version mostrados na página.
- Gerar reviews[] completos da etapa perplexity_initial.
- PROIBIDO aplicar proposed_change diretamente na questão principal ou inventar nova version.
- proposed_change.exact_replacement é apenas RECOMENDAÇÃO para adjudicação posterior pelo ChatGPT.
- Enviar o JSON pelo formulário "Enviar resultado" da MESMA página.
- Pode enviar 1 questão ou qualquer grupo conveniente; cada envio deve conter somente itens deste bloco e desta etapa.
- Só afirmar "ENVIADO AO BRIDGE" quando a página retornar receipt_id. Esse recibo NÃO significa importação final no banco.
- O parecer deve permanecer separado da questão principal para evitar contaminação.`,
      perplexity_reaudit: `DESTINO DESTA ETAPA — PERPLEXITY / REAUDITORIA:
- Reabrir a página pública temporária indicada acima e recarregar o bloco antes de começar, para obter a versão ATUAL.
- NÃO usar conector Supabase, SQL, RPC ou cópia antiga como fonte da questão.
- Reauditar somente question_id + item_version atuais recebidos na página.
- PROIBIDO modificar a questão principal, inclusive quando ainda houver erro.
- Se houver nova falha, registrar needs_revision/rejected no parecer; a correção continua sendo responsabilidade do ChatGPT em etapa posterior.
- Se a reauditoria responder a uma discordância sem patch, mantenha a MESMA item_version exibida na página.
- Enviar o JSON pelo formulário "Enviar resultado" da própria página e guardar o receipt_id.
- O recibo confirma apenas recebimento no bridge; não declarar coverage completo nem importação definitiva.`,
      lot_perplexity_final: `PERSISTÊNCIA DESTA ETAPA — PERPLEXITY / REVISÃO FINAL DO LOTE:
- Gravar a auditoria final do Perplexity em registro separado do lote, preservando version_manifest e findings.
- PROIBIDO alterar diretamente qualquer uma das 1.000 questões.
- Achados do Perplexity são parecer independente; qualquer mudança na questão exige adjudicação/correção posterior pelo ChatGPT e nova validação.`,
      chatgpt_adjudication: `PERSISTÊNCIA DESTA ETAPA — CHATGPT / ADJUDICAÇÃO:
- Ler a questão principal na versão atual E o parecer separado mais recente do Perplexity para a MESMA question_id + item_version.
- Decidir item por item: agree | partially_agree | disagree.
- Gravar a DECISÃO DE ADJUDICAÇÃO separadamente, sempre preservando o review_id do parecer julgado.
- Nesta etapa, PROIBIDO alterar a questão principal.
- agree/partially_agree podem autorizar approved_patch; disagree deve manter approved_patch={} e registrar rebuttal_to_reviewer.`,
      chatgpt_correction: `PERSISTÊNCIA DESTA ETAPA — CHATGPT / CORREÇÃO:
- Aplicar na QUESTÃO PRINCIPAL somente approved_patch previamente autorizado na adjudicação da MESMA item_version e review_id.
- Se a adjudicação for disagree, não alterar a questão.
- Ao aplicar mudança, preservar question_id, criar/incrementar a nova versão pelo mecanismo do backend e manter histórico da versão anterior.
- Após a correção, limpar aprovações incompatíveis com a versão antiga e encaminhar a nova versão para nova resolução/reauditoria conforme o pipeline.`,
      chatgpt_initial: `PERSISTÊNCIA DESTA ETAPA — CHATGPT / REVISÃO INICIAL:
- O ChatGPT pode autocorrigir a questão principal conforme o contrato desta etapa.
- Toda alteração deve preservar question_id, respeitar expected_version e criar a nova versão pelo mecanismo de importação/autocorreção.
- Manter histórico da versão original e da versão corrigida; nunca sobrescrever silenciosamente.`
    }[stage] || `PERSISTÊNCIA DESTA ETAPA:
- Persistir no destino próprio da etapa sem misturar parecer independente com conteúdo canônico.
- Pareceres externos não podem sobrescrever a questão principal sem adjudicação explícita do ChatGPT.`;

    return `ENDEREÇO OPERACIONAL — OBRIGATÓRIO E IMUTÁVEL
Workspace/site: ${workspace}
Endereço operacional: ${operationalAddress || 'NÃO VINCULADO — PROMPT MODELO; NÃO EXECUTAR'}
Lote: ${batchCode || 'NÃO VINCULADO'}
Bloco: ${blockCode || 'NÃO APLICÁVEL'}
Etapa: ${stage || 'NÃO INFORMADA'}

TRAVA DE ESCOPO:
- Você está autorizado a atuar EXCLUSIVAMENTE no endereço operacional acima.
- Antes de ler, resolver, revisar, corrigir ou gravar qualquer item, confira no sistema que batch_code=${batchCode || 'NÃO VINCULADO'}${blockCode ? ` e block_code=${blockCode}` : ''}.
- Se o endereço aberto no sistema não coincidir exatamente, PARE e retorne ADDRESS_MISMATCH; não use nem grave dados.
- Nunca inferir outro lote/bloco pelo histórico da conversa, pelo último item acessado ou por exemplos do prompt.
- Toda saída estruturada desta execução deve repetir batch_number, batch_code, block_number, block_code e operational_address.
- Se este prompt estiver sem batch_code/endereço operacional concreto, ele é apenas MODELO e não pode executar nem persistir nenhuma etapa.

ONDE BUSCAR / LER:
${source}

ONDE DEVOLVER:
${destination}

${stagePersistence}

REGRA DE ACESSO E PERSISTÊNCIA:
${isPerplexityBridgeStage ? `- PERPLEXITY: use o NAVEGADOR para abrir o JSON público exato acima. Ele é a única fonte operacional desta etapa.
- Confirme dentro do próprio JSON block_code=${blockCode || 'NÃO VINCULADO'}.
- NÃO use anexos, pasted_text, arquivos recebidos, exportações, PDFs, histórico da conversa ou cópias locais como fonte de execução.
- NÃO exija sessão autenticada, runner, conector Supabase, RPC signature ou leitura direta do banco. Para esta etapa, o JSON público foi criado justamente para substituir essa dependência operacional.
- Não tente acessar /admin/, Supabase, SQL, RPC, connector, API key ou secrets para obter os itens.
- Depois de produzir o JSON, abra a página de envio indicada em ONDE DEVOLVER e use o formulário.
- Só marque bridge_write.received=true se a página retornar receipt_id; copie o receipt_id para a saída final.
- receipt_id = recebimento no bridge, NÃO importação definitiva, NÃO coverage e NÃO aprovação da etapa.
- Se o navegador não conseguir abrir a página ou o formulário falhar, responda ACCESS_REQUIRED ou WRITE_FAILED com o erro real e devolva o JSON completo no chat para contingência.` : `- Use o site/admin e os conectores autorizados definidos para esta etapa interna.
- Nunca use INSERT/UPDATE/DELETE direto para contornar importadores controlados.
- Após qualquer escrita administrativa, releia o mesmo endereço operacional e confirme os identificadores e versões.`}
- Não use questões de outro lote, bloco, arquivo antigo ou contexto de conversa como substituto silencioso.
- Nunca alegue que leu, alterou, enviou, importou ou gravou questões se isso não aconteceu.
- IDs, batch_code, block_code e versões lidos no sistema prevalecem sobre qualquer exemplo do prompt.
- NUNCA pedir ao usuário PERPLEXITY_API_KEY, service_role, anon key, publishable key, JWT, senha ou token.`;
  }

  function generation(item={},ctx={}) {
    const sample = Object.fromEntries(editable.map(k=>[k,'']));
    Object.assign(sample,{question_id:'ID_IMUTAVEL',question_code:'CODIGO_UNICO',exam_style:item.exam_style||null,block_sequence_no:1,sequence_no:1,dificuldade:'Médio',gabarito:'A',version:1,status:'generated'});
    const enamedAnswerFormat = String(item.exam_style || '').toUpperCase() === 'ENAMED' ? `
FORMATO DE RESPOSTA OBRIGATÓRIO — ENAMED
Além do JSON estruturado exigido pelo sistema, apresentar abaixo de CADA questão um bloco humano de resposta exatamente nesta ordem:

Gabarito: [LETRA] — [TEXTO INTEGRAL DA ALTERNATIVA CORRETA]

Justificativa do gabarito:
[Explicar de forma objetiva, específica para a vinheta e clinicamente suficiente por que essa alternativa é a única melhor resposta. Esta justificativa deve ser semanticamente consistente com a explicação da alternativa correta no JSON; não criar uma segunda justificativa divergente.]

Pulo do Gato:
[UMA única frase curta, específica e memorável. Deve conter exatamente o discriminador decisivo da questão: se o aluno tivesse acabado de ouvir essa frase antes da prova, teria informação suficiente para identificar corretamente a resposta. Não usar resumo genérico, definição ampla, repetição literal do gabarito ou conselho vago.]

Alternativa A:
[Justificar individualmente por que A está certa ou errada NESTE caso, citando o dado da vinheta ou o erro clínico/conceitual relevante.]

Alternativa B:
[Justificar individualmente por que B está certa ou errada NESTE caso.]

Alternativa C:
[Justificar individualmente por que C está certa ou errada NESTE caso.]

Alternativa D:
[Justificar individualmente por que D está certa ou errada NESTE caso.]

REGRAS DE CONSISTÊNCIA DO BLOCO ENAMED:
- Gabarito deve mostrar simultaneamente a LETRA e o TEXTO da alternativa correta.
- Justificativa do gabarito não substitui as justificativas A-D; ambas são obrigatórias.
- Pulo do Gato = mensagem_chave no JSON.
- Alternativa A/B/C/D = explicacao_a/explicacao_b/explicacao_c/explicacao_d no JSON.
- A justificativa da alternativa correta deve explicar por que ela é correta; as outras três devem explicar concretamente por que estão erradas naquele cenário.
- Não aceitar “incorreta”, “não é a melhor”, “pouco provável” ou frases genéricas sem apontar o discriminador clínico/conceitual.
- O bloco humano deve refletir exatamente o mesmo conteúdo do JSON; nunca haver discrepância entre gabarito, Pulo do Gato e explicações.
` : '';
    return `${rules}\n\n${profile(item)}
${operationalAccess(ctx,'generation')}
${enamedAnswerFormat}
TAREFA: gerar o bloco administrativo COMPLETO de 200 questões em uma única execução. Não dividir em partes de 20, não fracionar a entrega e não encerrar antes de produzir e validar as 200 questões. Preservar IDs, sequência 1–200, cobertura planejada e conferência final integral do bloco.
Antes da produção, verificar o estado do perfil. Se estiver CALIBRATED_FROZEN/PROMPT_APPROVED com FINAL_PROMPT_SCORE >=84, usar o perfil congelado e iniciar produção sem reabrir calibração. Só exigir nova calibração/corpus quando a banca ainda não estiver aprovada.
Definir matriz de cobertura a partir da prova-alvo; não impor sete áreas ENAMED nem quotas universais a outras bancas. Frequências observadas orientam o conjunto, sem criar sequência temática artificial.
MÉTODO DE CONSTRUÇÃO ADAPTATIVO:
1. Primeiro definir a operação cognitiva e a dificuldade pretendida conforme o perfil da banca.
2. Item fácil/direto pode cobrar conhecimento técnico legítimo sem fabricar disputa artificial; ainda assim, alternativas devem ser homogêneas e não caricatas.
3. Item médio/difícil deve conter uma disputa real entre pelo menos duas alternativas plausíveis do mesmo eixo.
4. Nos itens médios/difíceis, definir 2–3 dados funcionalmente necessários que façam a correta superar o melhor distrator; evitar um único marcador praticamente determinístico.
5. Criar os demais distratores no mesmo eixo, baseados em erros médicos reais.
6. Rodar teste contrafactual do melhor distrator nos itens médios/difíceis.
7. Rodar teste adversarial sem vinheta; se a chave for previsível por forma, reescrever alternativas antes da saída.
8. Classificar a dificuldade somente depois do item completo, pela integração exigida e pela competição entre alternativas.
Gerar então problema completo, alternativas e explicações A-D. Para cada item:
- mensagem_chave = PULO DO GATO: uma única frase curta que contém o ponto discriminativo que faria o aluno acertar a questão se tivesse acabado de ouvi-la;
- explicacao da alternativa correta: dizer por que está certa com base na vinheta;
- explicacao de cada alternativa incorreta: dizer por que está errada especificamente naquele caso e qual detalhe impediria escolhê-la.
Incluir também área, tema, subtema e dificuldade justificada. Fonte geral e fonte específica do gabarito: instituição, documento, ano, URL real, seção quando disponível e nota de suporte.
Identificar duplicatas por decisão/conceito e cenário, além de similaridade lexical; não apenas trocar idade ou nomes.
DIVERSIDADE TEMÁTICA OBRIGATÓRIA DO BLOCO: as 200 questões devem variar de forma real entre áreas, temas, subtemas, cenários, decisões clínicas e operações cognitivas compatíveis com o perfil da banca. É proibido concentrar o bloco em poucos assuntos quando o perfil/corpus da banca tiver maior amplitude.
- Construir antes da geração uma matriz de cobertura temática do bloco.
- Evitar repetição sequencial do mesmo tema/subtema.
- Não reutilizar a mesma doença, decisão clínica, armadilha, estrutura de caso ou eixo terapêutico em série.
- Nenhum tema deve dominar o bloco sem justificativa explícita no perfil da banca/corpus primário.
- Quando houver múltiplas áreas oficiais ou recorrentes na prova-alvo, todas devem aparecer em proporção compatível com a evidência disponível.
- Dentro de uma mesma área, variar entre diagnóstico, conduta, prevenção, rastreamento, interpretação de exames, complicações, farmacologia, seguimento e raciocínio prognóstico quando aplicável.
- Repetir um assunto só é aceitável se a banca realmente o cobra com alta frequência E se os itens exigirem decisões clínicas diferentes.
- Se a matriz final revelar concentração excessiva, repetição de subtema ou blocos temáticos em sequência, o lote FALHA e deve ser rebalanceado antes da entrega.
Gerar cada questão de forma independente. Não reutilizar caso-base, esqueleto semântico, conjunto de alternativas ou transformação mecânica entre bancas ou dentro do lote.
Antes de entregar cada item, o GERADOR executa apenas uma pré-checagem. A aprovação depende de REVISÃO ADVERSARIAL INDEPENDENTE: o revisor não recebe a justificativa interna do gerador como autoridade e testa formal cueing, assimetria lexical, melhor distrator, contrafactual, dependência da vinheta, single-best-answer e dificuldade observada. Qualquer HARD REJECT impede entrada no lote. A versão rejeitada não pode ser exportada para auditoria externa. Regenerar o conjunto de alternativas e, se necessário, a vinheta; a nova versão volta a uma nova revisão adversarial. Só entra no lote quando surface_guess não acerta a chave com confiança média/alta, lexical_asymmetry=PASS, contrafactual=PASS e vignette_dependency=PASS (para médio/difícil), além de single-best-answer=PASS.
Após fechar o conteúdo, embaralhar a posição da alternativa correta sem alterar seu texto.
PRÉ-FLIGHT DE LOTE antes da saída:
- validar diversidade temática real das 200 questões contra a matriz de cobertura planejada;
- contar distribuição por área, tema e subtema e detectar concentração excessiva;
- reprovar o bloco se houver repetição mecânica do mesmo assunto, cenário, doença, decisão clínica ou estrutura de caso;
- confirmar que questões consecutivas não formam sequências artificiais do mesmo tema, salvo se isso reproduzir explicitamente o perfil da prova-alvo;
- para lote de calibração com 15 itens, aplicar exatamente A-B-C-D-A-B-C-D-A-B-C-D-A-B-C por reordenação das alternativas após fechamento semântico;
- validar automaticamente essa sequência antes da saída; se houver divergência, corrigir SOMENTE a posição das opções;
- verificar se o lote contém variedade real de dificuldade compatível com o perfil; se a banca prevê parte intermediária-alta e todos os itens forem fáceis/baixa-média, o lote FALHA;
- verificar se itens médios/difíceis têm pelo menos um concorrente forte e 2–3 dados funcionais; se não, regenerar esses itens;
- em MBE quantitativa, quando o perfil exigir aplicação, preferir cálculo + interpretação de magnitude/implicação, não mera aritmética.
SAÍDA (preencher os dados reais; null em lote/bloco exige identificação antes de importar):
${stringify({schema_version:SCHEMA_VERSION,batch:{...context(item,ctx),question_count:200,profile_version:VERSION,reference_exam_years:[],generation_status:'generated'},primary_style_evidence:[],coverage_plan:[],questions:[sample],coverage:{expected:200,delivered:0,complete:false},stage_metrics:{exam_style:item.exam_style||null,batch_number:ctx.batch_number??null,block_number:ctx.block_number??null,stage:'generation',provider:'ChatGPT',run_label:'bloco-completo-200',total_count:0,approved_count:0,needs_revision_count:0,rejected_count:0,hard_reject_count:0,agreement_count:0,score:null,status:'generated_complete',metrics:{expected_count:200},notes:''}})}
Validar quantidade, IDs, sequências 1–200 e posição global, A-D, campos obrigatórios, fontes, coerência e duplicatas. Nunca preencher status approved/published. Excel apenas quando solicitado para revisão humana.`;
  }
  function reviewExample(item,stage,ctx) {
    return {...context(item,ctx),review_stage:stage,reviewer:stage==='chatgpt_initial'?'ChatGPT':'Perplexity',reviews:[{
      question_id:'ID_IMUTAVEL',
      item_version:1,
      quality_score:null,
      component_scores:{...rubric,style:null},
      independent_answer:'A',
      original_answer:'A',
      answer_agreement:'agree',
      status:'rejected',
      confidence:'high',
      ambiguity:false,
      single_best_answer:true,
      hard_fail:false,
      hard_fail_reasons:[],
      source_verification_status:'SOURCE_VERIFICATION_PENDING',
      style_evidence_status:'NEEDS_MORE_PRIMARY_STYLE_DATA',
      verified_sources:[],
      source_checks:[{
        institution:'INSTITUICAO_A_VERIFICAR',
        document:'DOCUMENTO_A_VERIFICAR',
        year:'2026',
        url:'https://example.org/a-verificar',
        section:'',
        verification_status:'PENDING',
        url_reachable:false,
        title_match:false,
        year_match:false,
        section_found:false,
        supports_answer:false,
        note:'Substituir por fonte real aberta e verificada.'
      }],
      surface_guess_without_vignette:null,
      surface_guess_confidence:'low',
      lexical_asymmetry:'PASS',
      best_distractor:'B',
      best_distractor_rationale:'Explicar por que este é o concorrente mais plausível.',
      counterfactual_change:'Descrever pequena mudança clínica que tornaria o distrator defensável.',
      functional_killer_1_option:'B',
      functional_killer_1:'Dado concreto da vinheta que elimina B.',
      functional_killer_2_option:'C',
      functional_killer_2:'Dado concreto da vinheta que elimina C.',
      vignette_dependency:'PASS',
      distractor_quality:'GOOD',
      alternative_granularity:'PASS',
      difficulty_alignment:'PASS',
      explanation_checks:{
        A:{status:'PASS',reason:'Justificativa específica da alternativa A.'},
        B:{status:'PASS',reason:'Justificativa específica da alternativa B.'},
        C:{status:'PASS',reason:'Justificativa específica da alternativa C.'},
        D:{status:'PASS',reason:'Justificativa específica da alternativa D.'}
      },
      message_key_check:{status:'PASS',reason:'É específica e discriminativa.',decisive_feature:'Dado decisivo da questão.'},
      points_lost:[],
      scientific_issue:null,
      source_issue:'Fonte ainda não verificada.',
      answer_source_issue:'Fonte ainda não verificada.',
      explanation_issue:null,
      distractor_issue:null,
      style_issue:null,
      wording_issue:null,
      difficulty_issue:null,
      suggested_correction:null,
      proposed_change:{change_required:false,exact_replacement:{},reason:''}
    }],coverage:{reviewed_ids:[],pending_ids:[],complete:false},stage_metrics:{exam_style:item.exam_style||null,batch_number:ctx.batch_number??null,block_number:ctx.block_number??null,stage,provider:stage==='chatgpt_initial'?'ChatGPT':'Perplexity',run_label:null,total_count:0,approved_count:0,needs_revision_count:0,rejected_count:0,hard_reject_count:0,agreement_count:0,score:null,status:'completed',metrics:{},notes:''}};
  }
  function segment(item={},stage,ctx={}) {
    if(stage==='perplexity_cycle') return perplexityCycle(item,ctx,false);
    if(stage==='chatgpt_correction_cycle') return chatgptCorrectionCycle(item,ctx);
    const common=`${rules}\n\n${profile(item)}\n${operationalAccess(ctx,stage)}\n`;
    if(stage==='generation')return generation(item,ctx);
    if(stage==='prompt_calibration')return `${common}
AUDITORIA DO PROMPT EDITORIAL: avaliar saída BRUTA inédita, antes de correções. Receber registro da resolução cega; depois conferir gabaritos/fontes. Comparar com corpus primário e registrar evidências por item. Distinguir falha científica pontual, falha do gerador, falha de validador e desvio de identidade.
FINAL_PROMPT_SCORE usa rubrica própria: fidelidade 40, distratores 20, dificuldade 15, diversidade/ausência de pistas 15, clareza/completude 10. Somar componentes; corte 84. Informar ciência e gabarito em flags separados; hard fail impede avanço. Sem corpus suficiente, nota=null e NEEDS_MORE_PRIMARY_STYLE_DATA. Amostra sentinela não substitui teste de generalização; testar ao menos 30 itens novos em áreas variadas e informar limites amostrais. Não usar correções para elevar esta nota.
${stringify({schema_version:SCHEMA_VERSION,review_stage:'prompt_calibration',exam_style:item.exam_style||null,profile_version:VERSION,FINAL_PROMPT_SCORE:null,prompt_component_scores:{fidelity:null,distractors:null,difficulty:null,diversity:null,clarity:null},hard_fail_count:0,sample_size:0,primary_style_evidence:[],decision:'NEEDS_MORE_PRIMARY_STYLE_DATA',findings:[]})}`;
    if(stage==='blind_resolution')return `${rules}
${operationalAccess(ctx,'blind_resolution')}
RESOLUÇÃO CEGA. Abrir SOMENTE prova-cega.json, sem gabaritos, explicações, fontes da resposta ou pareceres prévios. Se esses dados foram expostos na conversa, iniciar nova conversa limpa. Resolver todos os IDs recebidos; não inventar uma letra quando não houver resposta única. Importar este registro antes de abrir o pacote completo.
${stringify({...context(item,ctx),review_stage:'blind_resolution',reviewer:'Perplexity',reviews:[{question_id:'ID_IMUTAVEL',item_version:1,independent_answer:null,ambiguity:false,single_best_answer:false,reason:'Registrar raciocínio e dado decisivo; null se irresolúvel.'}],stage_metrics:{exam_style:item.exam_style||null,batch_number:ctx.batch_number??null,block_number:ctx.block_number??null,stage:'blind_resolution',provider:'Perplexity',run_label:null,total_count:0,approved_count:0,needs_revision_count:0,rejected_count:0,hard_reject_count:0,agreement_count:0,score:null,status:'completed',metrics:{},notes:''}})}`;
    if(['chatgpt_initial','perplexity_initial','perplexity_reaudit'].includes(stage))return `${common}
${rubricText}
TAREFA: ${stage==='chatgpt_initial'?'REVISÃO ADVERSARIAL + AUTOCORREÇÃO IMEDIATA do bloco. Não aceite autoavaliação do gerador. Para CADA questão: (1) audite a versão recebida; (2) se APROVADA, mantenha-a; (3) se REVISAR ou REJEITADA, corrija/regenerate imediatamente APENAS os campos necessários, preservando o ID; (4) incremente a versão proposta em +1; (5) faça NOVA revisão adversarial completa da versão corrigida; (6) só marque final_status=approved se a versão corrigida passar todos os gates. Não envie ao Perplexity uma questão que você mesmo ainda considera ruim. Preserve obrigatoriamente o histórico v1→v2, com status e motivo de cada tentativa. Primeiro faça o passe formal ignorando os dados clínicos da vinheta: tente prever a chave por comando + alternativas e registre surface_guess_without_vignette e confiança. Depois leia a vinheta, identifique o melhor distrator, explique por que é plausível e forneça uma mudança contrafactual concreta que o tornaria correto/mais defensável. Avalie assimetria lexical, dependência real da vinheta, single-best-answer e dificuldade observada.':'Auditoria científica e editorial independente de TODOS os itens recebidos. Antes de confrontar o gabarito, resolver cada item de forma independente e registrar independent_answer no MESMO review; não alterar essa resposta para coincidir com o gabarito.'}
${stage==='perplexity_reaudit'?'Rever as versões corrigidas ou pendentes. Não atribuir nota global ao bloco usando apenas este subconjunto. Notas globais são agregadas pelo sistema a partir de todas as versões atuais.':''}
Abrir fontes e comparar a recomendação exata. verified_sources exige institution, document, year, url e section/note quando disponíveis. Relatar falha de acesso como pendência.
Antes de aprovar cada item, validar também:
1. mensagem_chave realmente funciona como Pulo do Gato: se o aluno a tivesse acabado de ouvir, teria informação suficiente para reconhecer a resposta correta;
2. a explicação da alternativa correta diz por que está certa;
3. as três explicações restantes dizem individualmente por que cada alternativa está errada naquele caso.
Falha em qualquer um desses quatro componentes = needs_revision; ausência, genericidade ou explicação vazia = HARD REJECT 10.
${stage==='chatgpt_initial'
? `Na etapa ChatGPT inicial, MODIFICAR imediatamente itens needs_revision/rejected com CORREÇÃO RÍGIDA: não fazer remendo cosmético, não suavizar achado do revisor e não aprovar por aproximação. Corrigir a causa-raiz de cada falha apontada, inclusive reescrevendo completamente enunciado, alternativas, explicações ou Pulo do Gato quando necessário. Depois da correção, submeter a nova versão a TODOS os hard rejects e gates como se fosse uma questão inédita. Se qualquer falha permanecer, corrigir novamente antes de marcar approved. Devolver patch completo apenas dos campos necessários, aplicar mentalmente a nova versão e reavaliá-la antes da saída. Campos permitidos: ${editable.join(', ')}. O JSON deve trazer initial_reviews, autocorrections e final_reviews. Cada autocorrection deve conter question_id, expected_version, new_version=expected_version+1, original_status, reason e patch. final_reviews deve avaliar a versão NOVA já corrigida. Se não houver correção segura possível, manter final_status rejected/needs_revision e explicar por quê.`
: `Não modificar itens. Para todo needs_revision/rejected, propor substituições completas APENAS de campos necessários em proposed_change.exact_replacement; não inventar correção quando faltarem evidências. Campos permitidos: ${editable.join(', ')}. IMPORTANTE: proposed_change é parecer, não patch executável nesta etapa. Persistir o parecer em registro separado; nunca escrever essas propostas na questão principal.`}
Informar cobertura; trabalhar em partes identificadas se necessário, sem marcar bloco completo até revisar todos os IDs. Recalcular soma/estatísticas por código quando disponível. Números no exemplo são tetos, não notas pré-atribuídas.
Ao final, emitir obrigatoriamente “RELATÓRIO QUESTÃO POR QUESTÃO”, preservando a ordem dos IDs recebidos. Exemplo:
42 — REJEITADA — motivo: hard reject por duas respostas defensáveis.
43 — APROVADA — motivo: SBA clara, dois distratores funcionais e fontes verificadas.
44 — REVISAR — motivo: Pulo do Gato genérico; reescrever mensagem_chave.
Não omitir nenhuma questão processada.
${stage==='chatgpt_initial' ? stringify({
  ...context(item,ctx),
  review_stage:'chatgpt_initial',
  reviewer:'ChatGPT',
  initial_reviews:[reviewExample(item,'chatgpt_initial',ctx).reviews[0]],
  autocorrections:[{
    question_id:'ID_IMUTAVEL',
    expected_version:1,
    new_version:2,
    original_status:'rejected',
    reason:'Motivo concreto da rejeição/revisão.',
    patch:{alternativa_a:'Texto corrigido apenas se necessário'}
  }],
  final_reviews:[{
    ...reviewExample(item,'chatgpt_initial',ctx).reviews[0],
    item_version:2,
    status:'approved',
    proposed_change:{change_required:false,exact_replacement:{},reason:''}
  }],
  coverage:{reviewed_ids:[],corrected_ids:[],pending_ids:[],complete:false},
  stage_metrics:{
    exam_style:item.exam_style||null,
    batch_number:ctx.batch_number??null,
    batch_code:ctx.batch_code||null,
    block_number:ctx.block_number??null,
    block_code:ctx.block_code||null,
    stage:'chatgpt_initial',
    provider:'ChatGPT',
    run_label:null,
    total_count:0,
    approved_count:0,
    needs_revision_count:0,
    rejected_count:0,
    hard_reject_count:0,
    agreement_count:0,
    score:null,
    status:'completed_after_autocorrection',
    metrics:{corrected_count:0,second_pass_fail_count:0},
    notes:''
  }
}) : stringify(reviewExample(item,stage,ctx))}`;
    if(stage==='chatgpt_adjudication')return `${common}
JULGAR parecer mais recente e versão atual. Resolver e conferir fontes. Classificar agree, partially_agree ou disagree, com justificativa. Não corrigir nesta etapa.
Para agree/partially_agree: approved_patch contém EXATAMENTE campos e textos autorizados; mudanças na fonte, gabarito e explicações devem ser coerentes. Só estes valores poderão ser aplicados. Para disagree: approved_patch={} e rebuttal_to_perplexity obrigatório. Incerteza sem evidência não autoriza alteração; registrar pendência.
${stringify({...context(item,ctx),review_stage:stage,decisions:[{question_id:'ID_IMUTAVEL',item_version:1,review_id:'UUID_DO_PARECER_EXPORTADO',agreement_status:'disagree',agreement_reason:'',approved_patch:{},rebuttal_to_perplexity:'Fundamentar discordância e pedir reavaliação.'}],stage_metrics:{exam_style:item.exam_style||null,batch_number:ctx.batch_number??null,block_number:ctx.block_number??null,stage:'chatgpt_adjudication',provider:'ChatGPT',run_label:null,total_count:0,approved_count:0,needs_revision_count:0,rejected_count:0,hard_reject_count:0,agreement_count:0,score:null,status:'completed',metrics:{},notes:''}})}`;
    if(stage==='chatgpt_correction')return `${common}
Aplicar somente approved_patch da adjudicação da MESMA versão e review_id. agree/partially_agree autorizam apenas os valores explícitos. disagree ou ausência de adjudicação impedem alteração. Não modificar itens publicados.
Preservar ID/banca; expected_version deve corresponder à versão recebida. O backend incrementa versão, limpa aprovações e exige nova resolução cega e reauditoria. Não aumentar versão manualmente. Campos não alterados não entram no patch.
${stringify({...context(item,ctx),review_stage:'chatgpt_correction_review',questions:[{question_id:'ID_IMUTAVEL',expected_version:1,review_id:'UUID_DO_PARECER_EXPORTADO',patch:{}}],stage_metrics:{exam_style:item.exam_style||null,batch_number:ctx.batch_number??null,block_number:ctx.block_number??null,stage:'chatgpt_correction',provider:'ChatGPT',run_label:null,total_count:0,approved_count:0,needs_revision_count:0,rejected_count:0,hard_reject_count:0,agreement_count:0,score:null,status:'completed',metrics:{},notes:''}})}`;
    if(['lot_chatgpt_final','lot_perplexity_final'].includes(stage))return `${common}
AUDITORIA GLOBAL DAS 1.000. Revisar todas para duplicação semântica, padrão de letras, concentração temática, pistas formais, cobertura da prova-alvo e consistência editorial. Não presumir sete áreas universais.
Rechecagem científica: todos os itens com version>1, todas as questões antes sinalizadas, todas as doses/cutoffs/alto risco e uma amostra adicional de pelo menos 20% das restantes, estratificada por bloco, área e dificuldade, com semente/método registrados. Se não houver classificação de risco confiável, reexaminar todos. Registrar IDs rechecados e cobertura; nunca apresentar amostragem como revisão científica integral.
Revisão independente: não receber conclusão do outro revisor como autoridade.
Copiar integralmente version_manifest do pacote. Se qualquer versão mudar, todas as revisões finais e aprovação humana precisam ser renovadas. Cada questão sinalizada deve identificar ID/versão e motivo; mudanças seguem adjudicação, correção e reauditoria. Arrays de achados não podem coexistir com approved.
Além dos agregados, produzir relatório humano questão por questão para TODOS os itens efetivamente revisados, no formato “ID — APROVADA/REVISAR/REJEITADA — motivo: ...”. Nenhum item revisado pode desaparecer no resumo.
${stringify({...context(item,ctx),review_stage:stage,reviewer:stage==='lot_chatgpt_final'?'ChatGPT':'Perplexity',lote_status:'needs_revision',version_manifest:[],coverage:{global_reviewed_ids:[],scientific_rechecked_ids:[],sampling_method:'',all_high_risk_rechecked:false},questions_flagged:[],duplicate_clusters:[],answer_source_problems:[],coverage_gaps:[],comments:[],stage_metrics:{exam_style:item.exam_style||null,batch_number:ctx.batch_number??null,block_number:null,stage,provider:stage==='lot_chatgpt_final'?'ChatGPT':'Perplexity',run_label:null,total_count:0,approved_count:0,needs_revision_count:0,rejected_count:0,hard_reject_count:0,agreement_count:0,score:null,status:'completed',metrics:{},notes:''}})}
Após as três aprovações da versão atual, aguardar aprovação humana final no admin. Não publicar.`;
    throw new Error('Etapa desconhecida: '+stage);
  }
  function perplexityCycle(item={},ctx={},isReaudit=false) {
    const blockNumber = ctx.block_number ?? null;
    const batchNumber = ctx.batch_number ?? null;
    const batchCode = ctx.batch_code || (batchNumber == null ? null : 'L'+String(Number(batchNumber)).padStart(3,'0'));
    const blockCode = ctx.block_code || (batchCode && blockNumber != null ? batchCode+'-B'+String(Number(blockNumber)).padStart(2,'0') : null);
    const bridgeBase = 'https://raw.githubusercontent.com/arantes225/studyos/main/qf-r8K2mV7qL4x9P1cF/';
    const bridgeUrl = blockCode ? bridgeBase + blockCode + '.json' : bridgeBase;
    const bridgeSubmitBase = 'https://www.resibulando.online/qf-r8K2mV7qL4x9P1cF/';
    const bridgeSubmitUrl = blockCode ? bridgeSubmitBase + '?block=' + encodeURIComponent(blockCode) : bridgeSubmitBase;
    const stage = isReaudit ? 'perplexity_reaudit' : 'perplexity_initial';

    return `FLUXO OPERACIONAL — PERPLEXITY · ${isReaudit ? 'REAUDITORIA' : 'AUDITORIA INDEPENDENTE'}
NÃO USE SUPABASE, SQL, RPC, ADMIN, CONNECTOR OU API KEY PARA OBTER AS QUESTÕES.
USE SOMENTE A PÁGINA PÚBLICA TEMPORÁRIA DA LURIA.

URL EXATA:
${bridgeUrl}

ENDEREÇO ESPERADO:
batch_code=${batchCode || 'NÃO VINCULADO'}
block_code=${blockCode || 'NÃO VINCULADO'}
review_stage=${stage}

PASSO A PASSO:
1. Abra a URL exata acima no navegador. Ela é um endereço raw.githubusercontent.com e termina em .json; deve abrir diretamente o conteúdo bruto do bloco, sem login e sem JavaScript. NÃO troque esse URL por www.resibulando.online para a leitura.
2. Confirme dentro do JSON que block_code=${blockCode || 'esperado'}. Se não coincidir, PARE e retorne ADDRESS_MISMATCH.
3. NÃO use arquivo anexado, pasted_text, export, PDF, texto colado ou memória da conversa. Mesmo que exista um anexo, ignore-o para execução.
4. NÃO peça runner autenticado, sessão Supabase, connector, RPC signature ou acesso ao banco. Nesta etapa, o JSON público é deliberadamente a fonte operacional fornecida pela LURIA.
5. Use EXCLUSIVAMENTE os itens presentes nesse JSON público.
6. Para cada questão, preserve exatamente question_id e item_version.
7. ${isReaudit ? 'Reavalie a versão atual exibida. Se a pendência veio de discordância sem patch, mantenha a mesma item_version; não crie versão artificial.' : 'Antes de confrontar o gabarito, resolva independentemente o item usando enunciado + alternativas e registre independent_answer no próprio review.'}
8. Faça a auditoria completa: ciência; gabarito; SBA; ambiguidade; dependência da vinheta; surface_guess_without_vignette; surface_guess_confidence; lexical_asymmetry; melhor distrator; best_distractor_rationale; counterfactual_change; functional_killer_1/2; qualidade dos distratores; explicações A-D; Pulo do Gato; dificuldade; estilo; fontes e proposed_change.
9. Fonte só pode ser VERIFIED se realmente checada. Caso contrário use SOURCE_VERIFICATION_PENDING ou SOURCE_VERIFICATION_FAILED.
10. Status por item: approved | needs_revision | rejected.
11. Monte um JSON válido com schema_version, review_stage="${stage}", reviewer="Perplexity", batch_number, block_number, reviews[] e stage_metrics.
12. Não altere a questão principal. proposed_change é recomendação, não edição.
13. Abra a página de envio: ${bridgeSubmitUrl}
14. No formulário "Enviar resultado", cole o JSON completo e clique em "Enviar parecer".
15. Se a página retornar protocolo/receipt_id, registre bridge_write={attempted:true,received:true,receipt_id:"..."}.
16. Se o envio falhar, registre bridge_write={attempted:true,received:false,error:"ERRO REAL"} e devolva também o JSON completo no chat.
17. NÃO declare "persistido no Supabase", "coverage completo", "200/200 no banco" ou "etapa finalizada" apenas porque recebeu receipt_id. O formulário é uma caixa de entrada isolada para validação/importação posterior.

REGRAS DE ESCOPO:
- Nunca trabalhar em outro bloco além de ${blockCode || 'NÃO VINCULADO'}.
- Nunca misturar versões antigas.
- Nunca inventar receipt_id.
- Nunca pedir credenciais/chaves.
- Pode enviar 1 questão ou qualquer quantidade conveniente por formulário; todos os reviews do envio devem pertencer ao mesmo bloco e à mesma etapa.

${segment(item,stage,ctx)}

TRAVA CONTRA RESPOSTA ERRADA:
- É INCORRETO responder SOURCE_NOT_AUTHORITATIVE_FOR_EXECUTION apenas porque existe um arquivo/anexo no chat.
- É INCORRETO exigir leitura direta do Supabase, sessão autenticada, runner ou confirmação de RPC para iniciar esta etapa.
- A fonte operacional desta etapa é exatamente o JSON RAW público em ${bridgeUrl}. Se o domínio resibulando.online falhar, isso NÃO bloqueia a leitura: use este raw.githubusercontent.com como origem canônica de leitura.
- Se esse URL abrir e o block_code estiver correto, execute a auditoria normalmente.

SAÍDA HUMANA OBRIGATÓRIA:
Além do JSON, produza relatório questão por questão: "ID — APROVADA/REVISAR/REJEITADA — motivo: ...".
Ao final, informe somente o estado real do bridge: ENVIADO AO BRIDGE + receipt_id, ou ENVIO FALHOU + erro.`;
  }
  function chatgptCorrectionCycle(item={},ctx={}) {
    return `FLUXO OPERACIONAL ÚNICO — CHATGPT · JULGAR PARECER + CORRIGIR
Este é UM envio operacional. Execute adjudicação e correção em sequência no MESMO bloco. Não obrigue o usuário a abrir dois prompts separados.

SUBETAPA 4A — JULGAR O PARECER DO PERPLEXITY
1. Leia a questão atual e o parecer Perplexity mais recente da MESMA question_id + item_version.
2. Classifique agree | partially_agree | disagree com justificativa.
3. Persista a adjudicação antes de qualquer alteração.

${segment(item,'chatgpt_adjudication',ctx)}

SUBETAPA 4B — APLICAR AS CORREÇÕES AUTORIZADAS
Somente após a adjudicação estar persistida:
1. Para agree/partially_agree, aplique exatamente o approved_patch autorizado.
2. CORREÇÃO RÍGIDA OBRIGATÓRIA: não faça alteração mínima apenas para “passar”. Corrija integralmente a causa-raiz do parecer. Se o problema for estrutural, reescreva por completo os campos necessários; se for distrator fraco, regenere o conjunto necessário; se houver ambiguidade, feche o cenário; se Pulo do Gato ou explicações estiverem genéricos, reescreva-os de forma específica para a vinheta.
3. Após aplicar a correção, reavalie a NOVA versão contra todos os hard rejects, SBA, dependência da vinheta, assimetria, concorrência dos distratores, fontes, explicações A-D e Pulo do Gato. Qualquer falha remanescente impede aprovação.
4. Se a primeira correção não passar integralmente, faça nova correção antes de encerrar a etapa; não devolver item parcialmente corrigido como aprovado.
5. Para disagree, não altere a questão.
6. Preserve question_id, gere nova versão pelo backend e invalide aprovações antigas conforme o fluxo.
7. Persista as correções como chatgpt_correction_review.

${segment(item,'chatgpt_correction',ctx)}

REGRA DE SAÍDA:
- Depois de qualquer correção, o próximo passo obrigatório é Perplexity · confirmar correções.
- Se o Perplexity ainda apontar erro, este MESMO ciclo deve ser executado novamente apenas nas pendências atuais.
- Nunca liberar aprovação humana enquanto houver questão pendente.`;
  }

  function blind(questions) {
    const fields=['question_id','version','enunciado','alternativa_a','alternativa_b','alternativa_c','alternativa_d'];
    return questions.map(q=>Object.fromEntries(fields.map(k=>[k,q[k]])));
  }
  const globalContract=()=>rules;
  const api={VERSION,rubric,editable,generation,segment,perplexityCycle,chatgptCorrectionCycle,blind,globalContract};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.LuriaQuestionPrompts=api;
})(typeof window!=='undefined'?window:globalThis);
