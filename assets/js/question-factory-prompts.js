/* Contrato único da fábrica. Não inserir resultados históricos como identidade editorial. */
(function (root) {
  'use strict';
  const VERSION = '2.0';
  const rubric = { scientific:25, answer_key:20, answer_source:15, distractors:10, explanations:10, style:10, writing:5, difficulty:5 };
  const editable = ['enunciado','alternativa_a','alternativa_b','alternativa_c','alternativa_d','gabarito','explicacao_a','explicacao_b','explicacao_c','explicacao_d','mensagem_chave','area','tema','subtema','dificuldade','fonte_instituicao','fonte_documento','fonte_ano','fonte_url','answer_source_institution','answer_source_document','answer_source_year','answer_source_url','answer_source_section','answer_source_note'];
  const stringify = value => JSON.stringify(value, null, 2);
  const rules = `CONTRATO LURIA ${VERSION}
Exatamente quatro alternativas A-D em TODAS as bancas; nunca penalizar essa adaptação.
Uma única melhor resposta; dados suficientes; contexto coerente; conteúdo autoral.
Todas as explicações A-D devem justificar especificamente a opção. Distratores do mesmo eixo, baseados em erros plausíveis e elimináveis pelos dados.
Dificuldade depende do raciocínio exigido e da competição entre alternativas. Evitar pistas de comprimento, absolutos denunciadores, repetição de moldes e rotação mecânica de gabarito.
Estilo vem de cadernos oficiais do processo-alvo; ciência vem de fontes científicas independentes. Edital sozinho não demonstra arquitetura dos itens.
Não inventar documento, edição, URL, seção, dados de corpus ou característica de banca. Falta de acesso = SOURCE_VERIFICATION_PENDING; falta de corpus = NEEDS_MORE_PRIMARY_STYLE_DATA; ambas impedem declarar aprovação correspondente.
Usar fonte atual aplicável à pergunta e ao cenário brasileiro. Fonte internacional adequada não perde pontos por nacionalidade. Conflitos entre recomendações exigem contexto explícito que assegure resposta única.
CALIBRAÇÃO DO PROMPT: FINAL_PROMPT_SCORE >=94/100 na saída bruta inédita, antes de correções; não confundir com style_score.
QUESTÃO FINAL: quality_score >=97/100, style >=9.7/10, rubrica completa, fontes verificadas, sem hard fail, sem ambiguidade e com única melhor resposta. Nota alta não compensa falha eliminatória.
Feedback sobre distratores, clareza e segurança pode melhorar regras gerais; só alterar a identidade da banca com evidência primária documentada.
JSON válido é o contrato máquina-a-máquina. Não preencher aprovações, fontes verificadas ou notas sem executar a avaliação. IDs são imutáveis; toda revisão informa item_version e toda correção informa expected_version.`;
  const rubricText = `RUBRICA FINAL (pesos máximos; soma exata = quality_score):\n${stringify(rubric)}
scientific: exatidão e atualização; answer_key: gabarito e univocidade; answer_source: suporte documental específico; distractors: plausibilidade/discriminação; explanations: justificativas A-D; style: aderência demonstrada ao corpus; writing: clareza; difficulty: adequação ao perfil.
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
Não incorporar calibration_notes, style_score_note ou resultados de lotes anteriores à identidade. Campos históricos de extensão, incidência e dificuldade só viram regras após conferência no corpus.
Antes de gerar: registrar edição, URL oficial, IDs/páginas dos itens analisados, n amostrado, comprimento em palavras, formatos, operações cognitivas, alternativas e limites da amostra. Preferir >=20 itens e 2–3 edições quando disponíveis; não inventar edições inexistentes. Se insuficiente, retornar pendência de calibração, sem prometer fidelidade.`;
  }
  function context(item, ctx={}) {
    return { schema_version:VERSION, batch_number:ctx.batch_number ?? null, block_number:ctx.block_number ?? null, exam_style:item?.exam_style || null };
  }
  function generation(item={},ctx={}) {
    const sample = Object.fromEntries(editable.map(k=>[k,'']));
    Object.assign(sample,{question_id:'ID_IMUTAVEL',question_code:'CODIGO_UNICO',exam_style:item.exam_style||null,block_sequence_no:1,sequence_no:1,dificuldade:'Médio',gabarito:'A',version:1,status:'generated'});
    return `${rules}\n\n${profile(item)}
TAREFA: gerar bloco administrativo de 200 questões. Pode executar em partes de 20, preservando IDs, sequência, cobertura planejada e conferência final das 200. Não fingir entrega completa quando houver parte pendente.
Antes da produção, exigir relatório de calibração bruta FINAL_PROMPT_SCORE >=94 e corpus documentado. Se ausente, realizar calibração ou informar exatamente o que falta; não substituir por nota de questão corrigida.
Definir matriz de cobertura a partir da prova-alvo; não impor sete áreas ENAMED nem quotas universais a outras bancas. Frequências observadas orientam o conjunto, sem criar sequência temática artificial.
Gerar problema completo, alternativas e explicações A-D. Incluir mensagem-chave, área, tema, subtema e dificuldade justificada. Fonte geral e fonte específica do gabarito: instituição, documento, ano, URL real, seção quando disponível e nota de suporte.
Identificar duplicatas por decisão/conceito e cenário, além de similaridade lexical; não apenas trocar idade ou nomes.
SAÍDA (preencher os dados reais; null em lote/bloco exige identificação antes de importar):
${stringify({schema_version:VERSION,batch:{...context(item,ctx),question_count:200,part_number:1,part_count:10,profile_version:VERSION,reference_exam_years:[],generation_status:'generated'},primary_style_evidence:[],coverage_plan:[],questions:[sample],coverage:{expected:200,delivered:0,complete:false}})}
Validar quantidade, IDs, sequências 1–200 e posição global, A-D, campos obrigatórios, fontes, coerência e duplicatas. Nunca preencher status approved/published. Excel apenas quando solicitado para revisão humana.`;
  }
  function reviewExample(item,stage,ctx) {
    return {...context(item,ctx),review_stage:stage,reviewer:stage==='chatgpt_initial'?'ChatGPT':'Perplexity',reviews:[{question_id:'ID_IMUTAVEL',item_version:1,quality_score:null,component_scores:{...rubric,style:null},independent_answer:'A',original_answer:'A',status:'needs_revision',confidence:'high',ambiguity:false,single_best_answer:true,hard_fail:false,hard_fail_reasons:[],answer_source_issue:null,source_verification_status:'SOURCE_VERIFICATION_PENDING',style_evidence_status:'NEEDS_MORE_PRIMARY_STYLE_DATA',distractor_quality:'GOOD',alternative_granularity:'PASS',difficulty_alignment:'PASS',points_lost:[],scientific_issue:null,style_issue:null,explanation_issue:null,suggested_correction:null,verified_sources:[],proposed_change:{change_required:false,exact_replacement:{},reason:''}}],coverage:{reviewed_ids:[],pending_ids:[],complete:false}};
  }
  function segment(item={},stage,ctx={}) {
    const common=`${rules}\n\n${profile(item)}\n`;
    if(stage==='generation')return generation(item,ctx);
    if(stage==='prompt_calibration')return `${common}
AUDITORIA DO PROMPT EDITORIAL: avaliar saída BRUTA inédita, antes de correções. Receber registro da resolução cega; depois conferir gabaritos/fontes. Comparar com corpus primário e registrar evidências por item. Distinguir falha científica pontual, falha do gerador, falha de validador e desvio de identidade.
FINAL_PROMPT_SCORE usa rubrica própria: fidelidade 40, distratores 20, dificuldade 15, diversidade/ausência de pistas 15, clareza/completude 10. Somar componentes; corte 94. Informar ciência e gabarito em flags separados; hard fail impede avanço. Sem corpus suficiente, nota=null e NEEDS_MORE_PRIMARY_STYLE_DATA. Amostra sentinela não substitui teste de generalização; testar ao menos 30 itens novos em áreas variadas e informar limites amostrais. Não usar correções para elevar esta nota.
${stringify({schema_version:VERSION,review_stage:'prompt_calibration',exam_style:item.exam_style||null,profile_version:VERSION,FINAL_PROMPT_SCORE:null,prompt_component_scores:{fidelity:null,distractors:null,difficulty:null,diversity:null,clarity:null},hard_fail_count:0,sample_size:0,primary_style_evidence:[],decision:'NEEDS_MORE_PRIMARY_STYLE_DATA',findings:[]})}`;
    if(stage==='blind_resolution')return `${rules}
RESOLUÇÃO CEGA. Abrir SOMENTE prova-cega.json, sem gabaritos, explicações, fontes da resposta ou pareceres prévios. Se esses dados foram expostos na conversa, iniciar nova conversa limpa. Resolver todos os IDs recebidos; não inventar uma letra quando não houver resposta única. Importar este registro antes de abrir o pacote completo.
${stringify({...context(item,ctx),review_stage:'blind_resolution',reviewer:'Perplexity',reviews:[{question_id:'ID_IMUTAVEL',item_version:1,independent_answer:null,ambiguity:false,single_best_answer:false,reason:'Registrar raciocínio e dado decisivo; null se irresolúvel.'}]})}`;
    if(['chatgpt_initial','perplexity_initial','perplexity_reaudit'].includes(stage))return `${common}
${rubricText}
TAREFA: ${stage==='chatgpt_initial'?'Checagem estrutural e científica inicial do bloco.':'Auditoria científica e editorial independente de TODOS os itens recebidos. Usar a resposta cega já registrada para a MESMA versão. Não alterá-la para coincidir com o gabarito.'}
${stage==='perplexity_reaudit'?'Rever as versões corrigidas ou pendentes. Não atribuir nota global ao bloco usando apenas este subconjunto. Notas globais são agregadas pelo sistema a partir de todas as versões atuais.':''}
Abrir fontes e comparar a recomendação exata. verified_sources exige institution, document, year, url e section/note quando disponíveis. Relatar falha de acesso como pendência.
Não modificar itens. Para todo needs_revision/rejected, propor substituições completas APENAS de campos necessários em proposed_change.exact_replacement; não inventar correção quando faltarem evidências. Campos permitidos: ${editable.join(', ')}.
Informar cobertura; trabalhar em partes identificadas se necessário, sem marcar bloco completo até revisar todos os IDs. Recalcular soma/estatísticas por código quando disponível. Números no exemplo são tetos, não notas pré-atribuídas.
${stringify(reviewExample(item,stage,ctx))}`;
    if(stage==='chatgpt_adjudication')return `${common}
JULGAR parecer mais recente e versão atual. Resolver e conferir fontes. Classificar agree, partially_agree ou disagree, com justificativa. Não corrigir nesta etapa.
Para agree/partially_agree: approved_patch contém EXATAMENTE campos e textos autorizados; mudanças na fonte, gabarito e explicações devem ser coerentes. Só estes valores poderão ser aplicados. Para disagree: approved_patch={} e rebuttal_to_perplexity obrigatório. Incerteza sem evidência não autoriza alteração; registrar pendência.
${stringify({...context(item,ctx),review_stage:stage,decisions:[{question_id:'ID_IMUTAVEL',item_version:1,review_id:'UUID_DO_PARECER_EXPORTADO',agreement_status:'disagree',agreement_reason:'',approved_patch:{},rebuttal_to_perplexity:'Fundamentar discordância e pedir reavaliação.'}]})}`;
    if(stage==='chatgpt_correction')return `${common}
Aplicar somente approved_patch da adjudicação da MESMA versão e review_id. agree/partially_agree autorizam apenas os valores explícitos. disagree ou ausência de adjudicação impedem alteração. Não modificar itens publicados.
Preservar ID/banca; expected_version deve corresponder à versão recebida. O backend incrementa versão, limpa aprovações e exige nova resolução cega e reauditoria. Não aumentar versão manualmente. Campos não alterados não entram no patch.
${stringify({...context(item,ctx),review_stage:'chatgpt_correction_review',questions:[{question_id:'ID_IMUTAVEL',expected_version:1,review_id:'UUID_DO_PARECER_EXPORTADO',patch:{}}]})}`;
    if(['lot_chatgpt_final','lot_perplexity_final','lot_gemini_final'].includes(stage))return `${common}
AUDITORIA GLOBAL DAS 1.000. Revisar todas para duplicação semântica, padrão de letras, concentração temática, pistas formais, cobertura da prova-alvo e consistência editorial. Não presumir sete áreas universais.
Rechecagem científica: todos os itens com version>1, todas as questões antes sinalizadas, todas as doses/cutoffs/alto risco e uma amostra adicional de pelo menos 20% das restantes, estratificada por bloco, área e dificuldade, com semente/método registrados. Se não houver classificação de risco confiável, reexaminar todos. Registrar IDs rechecados e cobertura; nunca apresentar amostragem como revisão científica integral.
${stage==='lot_gemini_final'?'Gemini é auditor adversarial após ChatGPT e Perplexity. Apenas sinaliza; não modifica.':'Revisão independente: não receber conclusão dos outros revisores como autoridade.'}
Copiar integralmente version_manifest do pacote. Se qualquer versão mudar, todas as revisões finais e aprovação humana precisam ser renovadas. Cada questão sinalizada deve identificar ID/versão e motivo; mudanças seguem adjudicação, correção e reauditoria. Arrays de achados não podem coexistir com approved.
${stringify({...context(item,ctx),review_stage:stage,reviewer:stage==='lot_gemini_final'?'Gemini':stage==='lot_chatgpt_final'?'ChatGPT':'Perplexity',lote_status:'needs_revision',version_manifest:[],coverage:{global_reviewed_ids:[],scientific_rechecked_ids:[],sampling_method:'',all_high_risk_rechecked:false},questions_flagged:[],duplicate_clusters:[],answer_source_problems:[],coverage_gaps:[],comments:[]})}
Após as três aprovações da versão atual, aguardar aprovação humana final no admin. Não publicar.`;
    throw new Error('Etapa desconhecida: '+stage);
  }
  function blind(questions) {
    const fields=['question_id','version','enunciado','alternativa_a','alternativa_b','alternativa_c','alternativa_d'];
    return questions.map(q=>Object.fromEntries(fields.map(k=>[k,q[k]])));
  }
  const api={VERSION,rubric,editable,generation,segment,blind};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.LuriaQuestionPrompts=api;
})(typeof window!=='undefined'?window:globalThis);
