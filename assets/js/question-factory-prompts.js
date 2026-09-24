/* Contrato único da fábrica. Não inserir resultados históricos como identidade editorial. */
(function (root) {
  'use strict';
  const VERSION = '2.3';
  const rubric = { scientific:25, answer_key:20, answer_source:15, distractors:10, explanations:10, style:10, writing:5, difficulty:5 };
  const editable = ['enunciado','alternativa_a','alternativa_b','alternativa_c','alternativa_d','gabarito','explicacao_a','explicacao_b','explicacao_c','explicacao_d','mensagem_chave','area','tema','subtema','dificuldade','fonte_instituicao','fonte_documento','fonte_ano','fonte_url','answer_source_institution','answer_source_document','answer_source_year','answer_source_url','answer_source_section','answer_source_note'];
  const stringify = value => JSON.stringify(value, null, 2);
  const rules = `CONTRATO LURIA ${VERSION}
Exatamente quatro alternativas A-D em TODAS as bancas; nunca penalizar essa adaptação.
Uma única melhor resposta; dados suficientes; contexto coerente; conteúdo autoral.
Todas as explicações A-D devem justificar especificamente a opção. Distratores devem permanecer no mesmo eixo decisório e representar erros médicos reais, próximos e plausíveis; não fabricar uma resposta madura contra três caricaturas.
CONCORRENTE FORTE OBRIGATÓRIO: em item médio/difícil, pelo menos um distrator deve continuar defensável após a leitura completa até que um dado discriminativo específico o derrube. Associação apenas temática não conta.
REGRA DE SOBREVIVÊNCIA MÍNIMA: além da correta, pelo menos DOIS distratores devem permanecer plausíveis após leitura superficial de comando + alternativas e só devem cair após uso de um dado funcional específico da vinheta. Se apenas um concorrente sobrevive e dois distratores morrem cedo, REJEITAR e regenerar as alternativas.
GATE DE DISTRATORES: antes de aceitar o item, verificar se pelo menos dois incorretos poderiam ser considerados por candidato parcialmente preparado e só caem por dado, indicação, timing, prioridade, contraindicação, sequência ou nuance técnica. Se 2–3 opções caem por absurdo, negligência, categoria incompatível ou linguagem denunciadora, REESCREVER.
TESTE CEGO DAS ALTERNATIVAS: antes de ler a vinheta, o revisor deve tentar prever a chave apenas pelo comando + opções. Se a forma, sofisticação, prudência ou completude apontar a correta com confiança média/alta, rejeitar automaticamente.
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
Antes da produção, exigir relatório de calibração bruta FINAL_PROMPT_SCORE >=84 e corpus documentado. Se ausente, realizar calibração ou informar exatamente o que falta; não substituir por nota de questão corrigida.
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
Gerar então problema completo, alternativas e explicações A-D. Incluir mensagem-chave, área, tema, subtema e dificuldade justificada. Fonte geral e fonte específica do gabarito: instituição, documento, ano, URL real, seção quando disponível e nota de suporte.
Identificar duplicatas por decisão/conceito e cenário, além de similaridade lexical; não apenas trocar idade ou nomes.
Gerar cada questão de forma independente. Não reutilizar caso-base, esqueleto semântico, conjunto de alternativas ou transformação mecânica entre bancas ou dentro do lote.
Antes de entregar cada item, o GERADOR executa apenas uma pré-checagem. A aprovação depende de REVISÃO ADVERSARIAL INDEPENDENTE: o revisor não recebe a justificativa interna do gerador como autoridade e testa formal cueing, assimetria lexical, melhor distrator, contrafactual, dependência da vinheta, single-best-answer e dificuldade observada. Qualquer HARD REJECT impede entrada no lote. A versão rejeitada não pode ser exportada para auditoria externa. Regenerar o conjunto de alternativas e, se necessário, a vinheta; a nova versão volta a uma nova revisão adversarial. Só entra no lote quando surface_guess não acerta a chave com confiança média/alta, lexical_asymmetry=PASS, contrafactual=PASS e vignette_dependency=PASS (para médio/difícil), além de single-best-answer=PASS.
Após fechar o conteúdo, embaralhar a posição da alternativa correta sem alterar seu texto.
PRÉ-FLIGHT DE LOTE antes da saída:
- para lote de calibração com 15 itens, aplicar exatamente A-B-C-D-A-B-C-D-A-B-C-D-A-B-C por reordenação das alternativas após fechamento semântico;
- validar automaticamente essa sequência antes da saída; se houver divergência, corrigir SOMENTE a posição das opções;
- verificar se o lote contém variedade real de dificuldade compatível com o perfil; se a banca prevê parte intermediária-alta e todos os itens forem fáceis/baixa-média, o lote FALHA;
- verificar se itens médios/difíceis têm pelo menos um concorrente forte e 2–3 dados funcionais; se não, regenerar esses itens;
- em MBE quantitativa, quando o perfil exigir aplicação, preferir cálculo + interpretação de magnitude/implicação, não mera aritmética.
SAÍDA (preencher os dados reais; null em lote/bloco exige identificação antes de importar):
${stringify({schema_version:VERSION,batch:{...context(item,ctx),question_count:200,part_number:1,part_count:10,profile_version:VERSION,reference_exam_years:[],generation_status:'generated'},primary_style_evidence:[],coverage_plan:[],questions:[sample],coverage:{expected:200,delivered:0,complete:false}})}
Validar quantidade, IDs, sequências 1–200 e posição global, A-D, campos obrigatórios, fontes, coerência e duplicatas. Nunca preencher status approved/published. Excel apenas quando solicitado para revisão humana.`;
  }
  function reviewExample(item,stage,ctx) {
    return {...context(item,ctx),review_stage:stage,reviewer:stage==='chatgpt_initial'?'ChatGPT':'Perplexity',reviews:[{question_id:'ID_IMUTAVEL',item_version:1,quality_score:null,component_scores:{...rubric,style:null},independent_answer:'A',original_answer:'A',status:'rejected',confidence:'high',ambiguity:false,single_best_answer:true,hard_fail:false,hard_fail_reasons:[],answer_source_issue:null,source_verification_status:'SOURCE_VERIFICATION_PENDING',style_evidence_status:'NEEDS_MORE_PRIMARY_STYLE_DATA',distractor_quality:'GOOD',alternative_granularity:'PASS',difficulty_alignment:'PASS',surface_guess_without_vignette:null,surface_guess_confidence:null,lexical_asymmetry:'PASS',best_distractor:null,best_distractor_rationale:null,counterfactual_change:null,vignette_dependency:'PASS',points_lost:[],scientific_issue:null,style_issue:null,explanation_issue:null,suggested_correction:null,verified_sources:[],proposed_change:{change_required:false,exact_replacement:{},reason:''}}],coverage:{reviewed_ids:[],pending_ids:[],complete:false}};
  }
  function segment(item={},stage,ctx={}) {
    const common=`${rules}\n\n${profile(item)}\n`;
    if(stage==='generation')return generation(item,ctx);
    if(stage==='prompt_calibration')return `${common}
AUDITORIA DO PROMPT EDITORIAL: avaliar saída BRUTA inédita, antes de correções. Receber registro da resolução cega; depois conferir gabaritos/fontes. Comparar com corpus primário e registrar evidências por item. Distinguir falha científica pontual, falha do gerador, falha de validador e desvio de identidade.
FINAL_PROMPT_SCORE usa rubrica própria: fidelidade 40, distratores 20, dificuldade 15, diversidade/ausência de pistas 15, clareza/completude 10. Somar componentes; corte 84. Informar ciência e gabarito em flags separados; hard fail impede avanço. Sem corpus suficiente, nota=null e NEEDS_MORE_PRIMARY_STYLE_DATA. Amostra sentinela não substitui teste de generalização; testar ao menos 30 itens novos em áreas variadas e informar limites amostrais. Não usar correções para elevar esta nota.
${stringify({schema_version:VERSION,review_stage:'prompt_calibration',exam_style:item.exam_style||null,profile_version:VERSION,FINAL_PROMPT_SCORE:null,prompt_component_scores:{fidelity:null,distractors:null,difficulty:null,diversity:null,clarity:null},hard_fail_count:0,sample_size:0,primary_style_evidence:[],decision:'NEEDS_MORE_PRIMARY_STYLE_DATA',findings:[]})}`;
    if(stage==='blind_resolution')return `${rules}
RESOLUÇÃO CEGA. Abrir SOMENTE prova-cega.json, sem gabaritos, explicações, fontes da resposta ou pareceres prévios. Se esses dados foram expostos na conversa, iniciar nova conversa limpa. Resolver todos os IDs recebidos; não inventar uma letra quando não houver resposta única. Importar este registro antes de abrir o pacote completo.
${stringify({...context(item,ctx),review_stage:'blind_resolution',reviewer:'Perplexity',reviews:[{question_id:'ID_IMUTAVEL',item_version:1,independent_answer:null,ambiguity:false,single_best_answer:false,reason:'Registrar raciocínio e dado decisivo; null se irresolúvel.'}]})}`;
    if(['chatgpt_initial','perplexity_initial','perplexity_reaudit'].includes(stage))return `${common}
${rubricText}
TAREFA: ${stage==='chatgpt_initial'?'REVISÃO ADVERSARIAL INDEPENDENTE do bloco. Não aceite autoavaliação do gerador. Primeiro faça um passe formal ignorando os dados clínicos da vinheta: tente prever a chave por comando + alternativas e registre surface_guess_without_vignette e confiança. Depois leia a vinheta, identifique o melhor distrator, explique por que é plausível e forneça uma mudança contrafactual concreta que o tornaria correto/mais defensável. Avalie assimetria lexical, dependência real da vinheta, single-best-answer e dificuldade observada. Falha relevante em qualquer gate = needs_revision.':'Auditoria científica e editorial independente de TODOS os itens recebidos. Usar a resposta cega já registrada para a MESMA versão. Não alterá-la para coincidir com o gabarito.'}
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
