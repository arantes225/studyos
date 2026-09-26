/* Contrato único da fábrica. Não inserir resultados históricos como identidade editorial. */
(function (root) {
  'use strict';
  const VERSION = '3.8';
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
FLUXO MANUAL DAS ETAPAS CHATGPT — JSON COLADO:
- Nas etapas executadas pelo revisor independente, a FONTE DE VERDADE é EXCLUSIVAMENTE o JSON COMPLETO colado pelo usuário junto deste prompt.
- NÃO abrir página da Fábrica, bridge, GitHub RAW, Admin, Supabase, URL operacional ou arquivo externo para obter as questões.
- NÃO usar snippets, anexos antigos, histórico da conversa, arquivos anteriores ou memória como substituto do JSON colado nesta execução.
- Antes de auditar, leia e valide o JSON colado por inteiro: batch_code, block_code, question_id, question_code, sequence_no e item_version/version.
- Preserve exatamente question_id + item_version/version recebidos no JSON.
- Se o JSON colado não contiver os itens necessários, estiver truncado ou estruturalmente inválido, informe JSON_INPUT_INVALID com o problema concreto; NÃO tente completar buscando dados em outro lugar.
- O resultado desta etapa deve ser DEVOLVIDO como um único JSON completo, pronto para o usuário colar no botão “Colar JSON de resposta” do Admin.
- NÃO tente persistir, enviar ao bridge, chamar RPC, SQL, formulário, API ou Supabase.
- NÃO declare persistência, receipt_id, coverage no banco ou conclusão administrativa. A importação será feita pelo usuário no Admin após esta resposta.
- stage_metrics, totais agregados e relatório textual NÃO substituem reviews individuais exigidos pela etapa.
- Para etapas executadas pelo ChatGPT dentro do ambiente administrativo, permanecem válidos os importadores/RPCs controlados definidos no fluxo interno.
TELEMETRIA OBRIGATÓRIA POR ETAPA: toda saída JSON deve incluir um objeto top-level stage_metrics. Ele é lido pelo Admin e persistido no Supabase para atualizar o dashboard automaticamente. Preencher com dados REAIS da etapa; nunca estimar contagens. Estrutura obrigatória:
stage_metrics = {
  exam_style: banca atual,
  batch_number: lote atual ou null,
  batch_code: ID humano do lote no formato L001 quando houver lote,
  block_number: bloco atual ou null,
  block_code: ID humano do bloco no formato L001-B01 quando houver bloco,
  stage: nome exato da etapa,
  provider: ChatGPT | revisor independente | Human,
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
- Se provider=revisor independente, incluir stage_metrics no MESMO JSON final devolvido ao usuário.
- Para revisor independente, NÃO tentar gravar stage_metrics nem reviews no Supabase e NÃO gerar bridge_write/receipt_id. A resposta deve ser apenas o JSON completo pronto para colar no Admin.
- Se provider=ChatGPT e o ambiente administrativo tiver acesso autorizado ao Supabase, a telemetria pode continuar usando SOMENTE a função controlada private.qf_record_stage_metrics(...), conforme o fluxo interno.
- Nunca fazer INSERT/UPDATE/DELETE direto para telemetria ou reviews fora dos importadores administrativos autorizados.
- Nunca pedir, imprimir, armazenar ou inventar service_role, senha, token, anon key, publishable key, JWT ou chave do Supabase.
JSON válido é o contrato máquina-a-máquina. Não preencher aprovações, fontes verificadas ou notas sem executar a avaliação. IDs são imutáveis; toda revisão informa item_version e toda correção informa expected_version.`;
  const rubricText = `RUBRICA FINAL (pesos máximos; soma exata = quality_score):\n${stringify(rubric)}
scientific: exatidão e atualização; answer_key: gabarito e univocidade; answer_source: suporte documental específico; distractors: plausibilidade/discriminação; explanations: justificativas A-D completas + Pulo do Gato discriminativo; style: aderência demonstrada ao corpus; writing: clareza; difficulty: adequação ao perfil.
Cada perda precisa de motivo observável; respeitar os tetos. Sem corpus suficiente, style=null, quality_score=null e status=needs_revision; registrar a pendência sem inventar nota baixa de fidelidade.
Hard fail: gabarito errado, múltiplas respostas defensáveis, dado essencial ausente, conduta insegura, dose/cutoff incorreto, recomendação desatualizada, fonte falsa ou incompatível, explicação contraditória, erro matemático relevante, cópia reconhecível.
Fonte ampla ou temporariamente inacessível bloqueia aprovação, mas não é automaticamente fonte falsa.
HIERARQUIA DE FONTE NO CONTEXTO BRASILEIRO: priorizar Ministério da Saúde/CONITEC/PCDT, ANVISA quando pertinente e sociedades brasileiras reconhecidas da área. Para conteúdo não coberto ou quando necessário para atualização/contraste, usar diretrizes internacionais e literatura primária de alta qualidade. A memória do modelo nunca conta como fonte.
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
    const isIndependentChatGPTStage = ['blind_resolution','perplexity_initial','perplexity_reaudit','lot_perplexity_final'].includes(stage);
    const workspace = ctx.prompt_workspace_url || ctx.workspace_url || 'https://www.resibulando.online/admin/';
    const source = ctx.prompt_source_instruction || (blockCode
      ? `Entre no Admin da LURIA → Fábrica de questões → lote ${batchCode} → bloco ${blockCode}. Leia somente as questões e versões atuais necessárias à etapa. Em revisão independente, ignore memória e qualquer parecer/conclusão anterior.`
      : batchCode
        ? `Entre no Admin da LURIA → Fábrica de questões → lote ${batchCode}. Trabalhe exclusivamente nesse lote e nas versões atuais.`
        : 'Prompt-modelo sem lote/bloco vinculado: não executar nem persistir até receber endereço operacional concreto.');
    const destination = ctx.prompt_return_instruction || (blockCode
      ? `Grave o resultado exclusivamente no lote ${batchCode}, bloco ${blockCode}, na etapa indicada, usando apenas o importador/RPC controlado da Fábrica.`
      : batchCode
        ? `Grave o resultado exclusivamente no lote ${batchCode}, na etapa indicada.`
        : 'Sem destino operacional: não gravar nada.');

    const stagePersistence = {
      blind_resolution: `PERSISTÊNCIA DESTA ETAPA — CHATGPT / RESOLUÇÃO CEGA INDEPENDENTE:
- IGNORE MEMÓRIA e qualquer contexto/revisão anterior.
- Leia apenas comando + alternativas da versão atual; não consulte gabarito, explicações ou pareceres antes de registrar independent_answer.
- Grave SOMENTE o registro de resolução cega separado para question_id + item_version.
- PROIBIDO alterar a questão principal.
- Depois de registrada, a resposta cega é imutável para a mesma versão.`,
      perplexity_initial: `PERSISTÊNCIA DESTA ETAPA — CHATGPT / REVISÃO INDEPENDENTE 2:
- IGNORE MEMÓRIA, parecer da revisão 1, scores, status e correções anteriores.
- Trabalhe na versão atual e confronte o gabarito somente DEPOIS de preservar a resposta cega.
- Audite ciência, SBA, distratores, explicações, Pulo do Gato, estilo e fontes.
- Priorize fontes brasileiras oficiais/sociedades; use busca externa em itens sinalizados ou sensíveis a atualização.
- proposed_change é apenas recomendação; não altere a questão principal nesta etapa.
- Grave o parecer separado na etapa técnica perplexity_initial (nome legado interno do banco).`,
      perplexity_reaudit: `PERSISTÊNCIA DESTA ETAPA — CHATGPT / CONFIRMAÇÃO CEGA APÓS CORREÇÃO:
- IGNORE MEMÓRIA e todas as conclusões anteriores.
- Reavalie somente a versão atual corrigida como questão inédita.
- Faça nova resolução independente antes de confrontar o gabarito e reexecute todos os hard rejects.
- Faça checagem científica externa quando houver risco, dose/cutoff, divergência ou conteúdo atualizado, priorizando fontes brasileiras.
- PROIBIDO corrigir silenciosamente nesta etapa; se houver falha, registre needs_revision/rejected.
- Grave o parecer separado na etapa técnica perplexity_reaudit (nome legado interno do banco).`,
      lot_perplexity_final: `PERSISTÊNCIA DESTA ETAPA — CHATGPT / REVISÃO FINAL INDEPENDENTE B:
- IGNORE MEMÓRIA e o resultado da revisão final A.
- Reavalie o lote atual de modo independente, usando o version_manifest atual.
- Não altere diretamente questões; registre achados separados.
- O nome técnico lot_perplexity_final é legado interno do banco; o revisor operacional é ChatGPT.`,
      chatgpt_adjudication: `PERSISTÊNCIA DESTA ETAPA — CHATGPT / ADJUDICAÇÃO:
- Ler a questão principal na versão atual E o parecer separado mais recente do revisor independente para a MESMA question_id + item_version.
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
- ${source}
- ${destination}
- IDs, lote, bloco e versões presentes no JSON/ambiente atual prevalecem sobre exemplos do prompt.
- Nunca invente leitura, gravação, versão, receipt_id ou confirmação.

${stagePersistence}`;
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
    return {...context(item,ctx),review_stage:stage,reviewer:'ChatGPT',reviews:[{
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
    }],coverage:{reviewed_ids:[],pending_ids:[],complete:false},stage_metrics:{exam_style:item.exam_style||null,batch_number:ctx.batch_number??null,block_number:ctx.block_number??null,stage,provider:'ChatGPT',run_label:null,total_count:0,approved_count:0,needs_revision_count:0,rejected_count:0,hard_reject_count:0,agreement_count:0,score:null,status:'completed',metrics:{},notes:''}};
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
RESOLUÇÃO CEGA INDEPENDENTE — CHATGPT. IGNORE COMPLETAMENTE A MEMÓRIA, o histórico da conversa, revisões, scores e conclusões anteriores. Trabalhe como se cada item fosse visto pela primeira vez. Leia SOMENTE comando + alternativas da versão atual, sem gabarito, explicações, fontes da resposta ou pareceres prévios. A memória do modelo não é fonte.

ENTRADA OBRIGATÓRIA:
- Este prompt operacional deve vir acompanhado, ao final, de um bloco chamado INPUT_JSON_CEGO.
- INPUT_JSON_CEGO é a ÚNICA fonte de verdade desta execução.
- Cada item real estará em questions[] com question_id, version, enunciado e alternativas A-D.
- O pacote da etapa cega NÃO deve conter gabarito, explicações, fontes, pareceres ou respostas anteriores.
- Resolva TODOS e SOMENTE os itens presentes em questions[].
- Use question_id exatamente como recebido e copie version para item_version.
- Se questions[] estiver ausente ou vazio, devolva JSON_INPUT_INVALID; não use exemplos, memória, Admin, Supabase, arquivos antigos ou histórico para completar.

SAÍDA OBRIGATÓRIA:
- Devolva UM ÚNICO JSON válido, pronto para “Colar JSON de resposta”.
- reviews[] deve conter exatamente um review para cada questão recebida, sem ID extra e sem omissão.
- independent_answer deve ser A, B, C, D ou null se realmente não houver resposta única.
- ambiguity e single_best_answer devem refletir a resolução independente.
- reason deve registrar de forma curta o raciocínio e o dado decisivo.
- stage_metrics.total_count deve ser igual ao número real de reviews desta resposta; não deixe contagens do modelo abaixo em zero.
- Não tente persistir nada fora do JSON devolvido.

MODELO DE SAÍDA — APENAS ESQUEMA, NÃO É ENTRADA E NÃO CONTÉM QUESTÃO REAL:
${stringify({...context(item,ctx),review_stage:'blind_resolution',reviewer:'ChatGPT',reviews:[],stage_metrics:{exam_style:item.exam_style||null,batch_number:ctx.batch_number??null,batch_code:ctx.batch_code||null,block_number:ctx.block_number??null,block_code:ctx.block_code||null,stage:'blind_resolution',provider:'ChatGPT',run_label:null,total_count:0,approved_count:0,needs_revision_count:0,rejected_count:0,hard_reject_count:0,agreement_count:0,score:null,status:'completed',metrics:{},notes:''}})}`;
    if(['chatgpt_initial','perplexity_initial','perplexity_reaudit'].includes(stage))return `${common}
${rubricText}
TAREFA: ${stage==='chatgpt_initial'?'REVISÃO ADVERSARIAL + AUTOCORREÇÃO IMEDIATA do bloco. Não aceite autoavaliação do gerador. Para CADA questão: (1) audite a versão recebida; (2) se APROVADA, mantenha-a; (3) se REVISAR ou REJEITADA, corrija/regenerate imediatamente APENAS os campos necessários, preservando o ID; (4) incremente a versão proposta em +1; (5) faça NOVA revisão adversarial completa da versão corrigida; (6) só marque final_status=approved se a versão corrigida passar todos os gates. Não envie ao revisor independente uma questão que você mesmo ainda considera ruim. Preserve obrigatoriamente o histórico v1→v2, com status e motivo de cada tentativa. Primeiro faça o passe formal ignorando os dados clínicos da vinheta: tente prever a chave por comando + alternativas e registre surface_guess_without_vignette e confiança. Depois leia a vinheta, identifique o melhor distrator, explique por que é plausível e forneça uma mudança contrafactual concreta que o tornaria correto/mais defensável. Avalie assimetria lexical, dependência real da vinheta, single-best-answer e dificuldade observada.':'REVISÃO CEGA E INDEPENDENTE de TODOS os itens. IGNORE COMPLETAMENTE memória, contexto, pareceres, notas, status e conclusões de etapas anteriores. Avalie a versão atual como inédita. Antes de confrontar o gabarito, preserve a independent_answer da resolução cega; não altere essa resposta para coincidir com o gabarito. A memória do modelo não é fonte. Para dúvida científica ou conteúdo atualizável, verificar fonte aberta nesta etapa, priorizando Ministério da Saúde/CONITEC/PCDT, ANVISA quando pertinente e sociedades brasileiras da especialidade (FEBRASGO, SBP, SBC, CBC, AMB etc.).'}
${stage==='perplexity_reaudit'?'CONFIRMAÇÃO PÓS-CORREÇÃO: ignore memória e qualquer justificativa anterior; trate a versão corrigida como inédita. Não atribuir nota global ao bloco usando apenas este subconjunto.':''}
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
JULGAR o parecer independente mais recente e a versão atual. Resolver e conferir fontes do zero, IGNORANDO MEMÓRIA e sem assumir que o parecer anterior está certo. Classificar agree, partially_agree ou disagree, com justificativa. Não corrigir nesta etapa.
Para agree/partially_agree: approved_patch contém EXATAMENTE campos e textos autorizados; mudanças na fonte, gabarito e explicações devem ser coerentes. Só estes valores poderão ser aplicados. Para disagree: approved_patch={} e rebuttal_to_reviewer obrigatório. Incerteza sem evidência não autoriza alteração; registrar pendência.
${stringify({...context(item,ctx),review_stage:stage,decisions:[{question_id:'ID_IMUTAVEL',item_version:1,review_id:'UUID_DO_PARECER_EXPORTADO',agreement_status:'disagree',agreement_reason:'',approved_patch:{},rebuttal_to_reviewer:'Fundamentar discordância e pedir reavaliação.'}],stage_metrics:{exam_style:item.exam_style||null,batch_number:ctx.batch_number??null,block_number:ctx.block_number??null,stage:'chatgpt_adjudication',provider:'ChatGPT',run_label:null,total_count:0,approved_count:0,needs_revision_count:0,rejected_count:0,hard_reject_count:0,agreement_count:0,score:null,status:'completed',metrics:{},notes:''}})}`;
    if(stage==='chatgpt_correction')return `${common}
Aplicar somente approved_patch da adjudicação da MESMA versão e review_id. agree/partially_agree autorizam apenas os valores explícitos. disagree ou ausência de adjudicação impedem alteração. Não modificar itens publicados.
Preservar ID/banca; expected_version deve corresponder à versão recebida. O backend incrementa versão, limpa aprovações e exige nova resolução cega e reauditoria. Não aumentar versão manualmente. Campos não alterados não entram no patch.
${stringify({...context(item,ctx),review_stage:'chatgpt_correction_review',questions:[{question_id:'ID_IMUTAVEL',expected_version:1,review_id:'UUID_DO_PARECER_EXPORTADO',patch:{}}],stage_metrics:{exam_style:item.exam_style||null,batch_number:ctx.batch_number??null,block_number:ctx.block_number??null,stage:'chatgpt_correction',provider:'ChatGPT',run_label:null,total_count:0,approved_count:0,needs_revision_count:0,rejected_count:0,hard_reject_count:0,agreement_count:0,score:null,status:'completed',metrics:{},notes:''}})}`;
    if(['lot_chatgpt_final','lot_perplexity_final'].includes(stage))return `${common}
AUDITORIA GLOBAL DAS 1.000. Revisar todas para duplicação semântica, padrão de letras, concentração temática, pistas formais, cobertura da prova-alvo e consistência editorial. Não presumir sete áreas universais.
Rechecagem científica: todos os itens com version>1, todas as questões antes sinalizadas, todas as doses/cutoffs/alto risco e uma amostra adicional de pelo menos 20% das restantes, estratificada por bloco, área e dificuldade, com semente/método registrados. Se não houver classificação de risco confiável, reexaminar todos. Registrar IDs rechecados e cobertura; nunca apresentar amostragem como revisão científica integral.
Revisão independente: IGNORE MEMÓRIA, histórico, notas e conclusão da outra passada. Avalie como se o lote fosse novo. A memória do modelo não é fonte.
Copiar integralmente version_manifest do pacote. Se qualquer versão mudar, todas as revisões finais e aprovação humana precisam ser renovadas. Cada questão sinalizada deve identificar ID/versão e motivo; mudanças seguem adjudicação, correção e reauditoria. Arrays de achados não podem coexistir com approved.
Além dos agregados, produzir relatório humano questão por questão para TODOS os itens efetivamente revisados, no formato “ID — APROVADA/REVISAR/REJEITADA — motivo: ...”. Nenhum item revisado pode desaparecer no resumo.
${stringify({...context(item,ctx),review_stage:stage,reviewer:'ChatGPT',lote_status:'needs_revision',version_manifest:[],coverage:{global_reviewed_ids:[],scientific_rechecked_ids:[],sampling_method:'',all_high_risk_rechecked:false},questions_flagged:[],duplicate_clusters:[],answer_source_problems:[],coverage_gaps:[],comments:[],stage_metrics:{exam_style:item.exam_style||null,batch_number:ctx.batch_number??null,block_number:null,stage,provider:'ChatGPT',run_label:null,total_count:0,approved_count:0,needs_revision_count:0,rejected_count:0,hard_reject_count:0,agreement_count:0,score:null,status:'completed',metrics:{},notes:''}})}
Após as três aprovações da versão atual, aguardar aprovação humana final no admin. Não publicar.`;
    throw new Error('Etapa desconhecida: '+stage);
  }
  function perplexityCycle(item={},ctx={},isReaudit=false) {
    const blockNumber = ctx.block_number ?? null;
    const batchNumber = ctx.batch_number ?? null;
    const batchCode = ctx.batch_code || (batchNumber == null ? null : 'L'+String(Number(batchNumber)).padStart(3,'0'));
    const blockCode = ctx.block_code || (batchCode && blockNumber != null ? batchCode+'-B'+String(Number(blockNumber)).padStart(2,'0') : null);
    const stage = isReaudit ? 'perplexity_reaudit' : 'perplexity_initial';

    return `FLUXO OPERACIONAL — CHATGPT · ${isReaudit ? 'CONFIRMAÇÃO CEGA PÓS-CORREÇÃO' : 'REVISÃO CEGA INDEPENDENTE 2'}

REGRA MÁXIMA — REVISÃO CEGA:
- IGNORE COMPLETAMENTE memória, histórico da conversa, avaliações anteriores, scores, status, patches, justificativas e conclusões de outras etapas.
- Trate cada versão atual como se estivesse vendo-a pela primeira vez.
- A memória do modelo NÃO é fonte.
- Não tente confirmar nem contradizer deliberadamente o parecer anterior.
- Use somente a versão atual consultada nesta execução, o Contrato LURIA e fontes verificáveis abertas nesta execução.

ENDEREÇO:
- Lote: ${batchCode || 'NÃO VINCULADO'}
- Bloco: ${blockCode || 'NÃO VINCULADO'}
- Etapa técnica interna: ${stage} (nome legado do banco; o revisor operacional é ChatGPT).

EXECUÇÃO:
1. Acesse o Admin/Supabase autorizado e confirme batch_code, block_code, question_id e item_version atuais.
2. Trabalhe SOMENTE nas versões atuais do bloco.
3. Preserve a resolução cega já registrada da mesma versão; se a etapa exigir nova resolução após correção, resolva antes de confrontar o gabarito.
4. Audite ciência, gabarito, SBA, ambiguidade, dependência da vinheta, surface guess, assimetria lexical, dois melhores distratores, functional_killer_1/2, contrafactual, explicações A-D, Pulo do Gato, dificuldade, estilo e fontes.
5. Para ciência: priorize Ministério da Saúde, CONITEC/PCDT, ANVISA quando pertinente, FEBRASGO, SBP, SBC, CBC, AMB e sociedades brasileiras reconhecidas. Use diretriz/literatura internacional de alta qualidade quando a fonte brasileira não resolver a decisão exata.
6. Faça busca externa aprofundada sobretudo em itens sinalizados, doses, cutoffs, contraindicações, alto risco, divergência de gabarito ou conteúdo potencialmente atualizado.
7. Fonte só pode ser VERIFIED se realmente checada nesta execução.
8. Não altere a questão principal nesta etapa. proposed_change é parecer separado.
9. Persista o resultado exclusivamente pelo importador/RPC controlado da Fábrica. Nunca faça INSERT/UPDATE direto em questão/review.
10. Só marque approved se todos os hard gates passarem.

${segment(item,stage,ctx)}

SAÍDA OPERACIONAL:
- Confirme quantos itens foram processados e persistidos.
- Não declare cobertura completa sem verificar o tracker após a persistência.
- Se a execução precisar ser dividida, use partes determinísticas de até 50 questões e não repita nem pule question_id.
- Se acesso/fonte estiver indisponível, registre a pendência real; não invente sucesso.`;
  }

  const independentReviewCycle = perplexityCycle;

  function chatgptCorrectionCycle(item={},ctx={}) {
    return `FLUXO OPERACIONAL ÚNICO — CHATGPT · JULGAR PARECER + CORRIGIR
Este é UM envio operacional. Execute adjudicação e correção em sequência no MESMO bloco. Não obrigue o usuário a abrir dois prompts separados.

SUBETAPA 4A — JULGAR O PARECER DO CHATGPT
1. Leia a questão atual e o parecer independente mais recente da MESMA question_id + item_version.
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
- Depois de qualquer correção, o próximo passo obrigatório é ChatGPT · confirmar correções.
- Se o revisor independente ainda apontar erro, este MESMO ciclo deve ser executado novamente apenas nas pendências atuais.
- Nunca liberar aprovação humana enquanto houver questão pendente.`;
  }

  function blind(questions) {
    const fields=['question_id','version','enunciado','alternativa_a','alternativa_b','alternativa_c','alternativa_d'];
    return questions.map(q=>Object.fromEntries(fields.map(k=>[k,q[k]])));
  }
  const globalContract=()=>rules;
  const api={VERSION,rubric,editable,generation,segment,perplexityCycle,independentReviewCycle,chatgptCorrectionCycle,blind,globalContract};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.LuriaQuestionPrompts=api;
})(typeof window!=='undefined'?window:globalThis);
