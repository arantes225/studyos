/* Contrato único da fábrica. Não inserir resultados históricos como identidade editorial. */
(function (root) {
  'use strict';
  const VERSION = '2.6';
  const rubric = { scientific:25, answer_key:20, answer_source:15, distractors:10, explanations:10, style:10, writing:5, difficulty:5 };
  const editable = ['enunciado','alternativa_a','alternativa_b','alternativa_c','alternativa_d','gabarito','explicacao_a','explicacao_b','explicacao_c','explicacao_d','mensagem_chave','area','tema','subtema','dificuldade','fonte_instituicao','fonte_documento','fonte_ano','fonte_url','answer_source_institution','answer_source_document','answer_source_year','answer_source_url','answer_source_section','answer_source_note'];
  const stringify = value => JSON.stringify(value, null, 2);
  const rules = `CONTRATO LURIA ${VERSION}
Exatamente quatro alternativas A-D em TODAS as bancas; nunca penalizar essa adaptação.
Uma única melhor resposta; dados suficientes; contexto coerente; conteúdo autoral.
PULO DO GATO OBRIGATÓRIO: toda questão deve conter mensagem_chave preenchida como o “Pulo do Gato” — UMA frase curta, específica e memorável que, se o aluno tivesse acabado de ouvir antes da prova, seria suficiente para levá-lo à resposta correta daquela questão. Não escrever resumo genérico, definição ampla, repetição do gabarito ou conselho vago; capturar exatamente o discriminador decisivo do item.
EXPLICAÇÃO OBRIGATÓRIA DAS ALTERNATIVAS: explicar individualmente por que a alternativa correta está certa E por que cada uma das outras três está errada naquele caso. As explicações A-D devem ser específicas para a vinheta, o comando e a alternativa, deixando claro o dado que confirma a correta e o erro clínico/conceitual de cada distrator. “Incorreta”, “não é a melhor” ou justificativa genérica não são aceitas.
HARD REJECT 10 — PULO DO GATO / EXPLICAÇÕES INCOMPLETAS: se mensagem_chave estiver vazia, genérica, não permitiria acertar o item após ser ouvida, ou se qualquer uma das explicações A-D não disser concretamente por que aquela opção está certa/errada, o item não pode ser aprovado e deve voltar para correção.
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
TELEMETRIA OBRIGATÓRIA POR ETAPA: toda saída JSON deve incluir um objeto top-level stage_metrics. Ele é lido pelo Admin e persistido no Supabase para atualizar o dashboard automaticamente. Preencher com dados REAIS da etapa; nunca estimar contagens. Estrutura obrigatória:
stage_metrics = {
  exam_style: banca atual,
  batch_number: lote atual ou null,
  block_number: bloco atual ou null,
  stage: nome exato da etapa,
  provider: ChatGPT | Perplexity | Gemini | Human,
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
PERSISTÊNCIA AUTOMÁTICA NO SUPABASE: se esta IA estiver executando em um ambiente com conector Supabase autorizado e capacidade de executar SQL no projeto da LURIA, após concluir a etapa deve gravar EXATAMENTE o objeto stage_metrics chamando SOMENTE a função controlada:
select private.qf_record_stage_metrics('<STAGE_METRICS_JSON>'::jsonb);
Não fazer INSERT/UPDATE/DELETE direto em tabelas para registrar telemetria. Não alterar questões, perfis, lotes ou qualquer outro dado por esse mecanismo. A função é o único destino permitido para telemetria automática.
Antes da chamada, preencher run_label de forma estável e identificável para que retries sejam idempotentes. Se a chamada retornar stored=true, registrar no resultado supabase_write={attempted:true,stored:true,event_key:<retornado>}. Se falhar, NÃO fingir sucesso: registrar supabase_write={attempted:true,stored:false,error:<erro real>} e ainda devolver stage_metrics completo para importação manual. Se não houver conector Supabase autorizado, registrar supabase_write={attempted:false,stored:false,reason:"SUPABASE_CONNECTOR_UNAVAILABLE"} e devolver stage_metrics normalmente.
Nunca pedir, imprimir, armazenar ou inventar service_role, senha, token ou chave do Supabase.
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
    return { schema_version:VERSION, batch_number:ctx.batch_number ?? null, block_number:ctx.block_number ?? null, exam_style:item?.exam_style || null };
  }
  function generation(item={},ctx={}) {
    const sample = Object.fromEntries(editable.map(k=>[k,'']));
    Object.assign(sample,{question_id:'ID_IMUTAVEL',question_code:'CODIGO_UNICO',exam_style:item.exam_style||null,block_sequence_no:1,sequence_no:1,dificuldade:'Médio',gabarito:'A',version:1,status:'generated'});
    return `${rules}\n\n${profile(item)}
TAREFA: gerar bloco administrativo de 200 questões. Pode executar em partes de 20, preservando IDs, sequência, cobertura planejada e conferência final das 200. Não fingir entrega completa quando houver parte pendente.
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
${stringify({schema_version:VERSION,batch:{...context(item,ctx),question_count:200,part_number:1,part_count:10,profile_version:VERSION,reference_exam_years:[],generation_status:'generated'},primary_style_evidence:[],coverage_plan:[],questions:[sample],coverage:{expected:200,delivered:0,complete:false},stage_metrics:{exam_style:item.exam_style||null,batch_number:ctx.batch_number??null,block_number:ctx.block_number??null,stage:'generation',provider:'ChatGPT',run_label:'parte-1',total_count:0,approved_count:0,needs_revision_count:0,rejected_count:0,hard_reject_count:0,agreement_count:0,score:null,status:'generated_partial',metrics:{part_number:1,part_count:10},notes:''}})}
Validar quantidade, IDs, sequências 1–200 e posição global, A-D, campos obrigatórios, fontes, coerência e duplicatas. Nunca preencher status approved/published. Excel apenas quando solicitado para revisão humana.`;
  }
  function reviewExample(item,stage,ctx) {
    return {...context(item,ctx),review_stage:stage,reviewer:stage==='chatgpt_initial'?'ChatGPT':'Perplexity',reviews:[{question_id:'ID_IMUTAVEL',item_version:1,quality_score:null,component_scores:{...rubric,style:null},independent_answer:'A',original_answer:'A',status:'rejected',confidence:'high',ambiguity:false,single_best_answer:true,hard_fail:false,hard_fail_reasons:[],answer_source_issue:null,source_verification_status:'SOURCE_VERIFICATION_PENDING',style_evidence_status:'NEEDS_MORE_PRIMARY_STYLE_DATA',distractor_quality:'GOOD',alternative_granularity:'PASS',difficulty_alignment:'PASS',surface_guess_without_vignette:null,surface_guess_confidence:null,lexical_asymmetry:'PASS',best_distractor:null,best_distractor_rationale:null,counterfactual_change:null,vignette_dependency:'PASS',points_lost:[],scientific_issue:null,style_issue:null,explanation_issue:null,suggested_correction:null,verified_sources:[],proposed_change:{change_required:false,exact_replacement:{},reason:''}}],coverage:{reviewed_ids:[],pending_ids:[],complete:false},stage_metrics:{exam_style:item.exam_style||null,batch_number:ctx.batch_number??null,block_number:ctx.block_number??null,stage,provider:stage==='chatgpt_initial'?'ChatGPT':'Perplexity',run_label:null,total_count:0,approved_count:0,needs_revision_count:0,rejected_count:0,hard_reject_count:0,agreement_count:0,score:null,status:'completed',metrics:{},notes:''}};
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
${stringify({...context(item,ctx),review_stage:'blind_resolution',reviewer:'Perplexity',reviews:[{question_id:'ID_IMUTAVEL',item_version:1,independent_answer:null,ambiguity:false,single_best_answer:false,reason:'Registrar raciocínio e dado decisivo; null se irresolúvel.'}],stage_metrics:{exam_style:item.exam_style||null,batch_number:ctx.batch_number??null,block_number:ctx.block_number??null,stage:'blind_resolution',provider:'Perplexity',run_label:null,total_count:0,approved_count:0,needs_revision_count:0,rejected_count:0,hard_reject_count:0,agreement_count:0,score:null,status:'completed',metrics:{},notes:''}})}`;
    if(['chatgpt_initial','perplexity_initial','perplexity_reaudit'].includes(stage))return `${common}
${rubricText}
TAREFA: ${stage==='chatgpt_initial'?'REVISÃO ADVERSARIAL INDEPENDENTE do bloco. Não aceite autoavaliação do gerador. Primeiro faça um passe formal ignorando os dados clínicos da vinheta: tente prever a chave por comando + alternativas e registre surface_guess_without_vignette e confiança. Depois leia a vinheta, identifique o melhor distrator, explique por que é plausível e forneça uma mudança contrafactual concreta que o tornaria correto/mais defensável. Avalie assimetria lexical, dependência real da vinheta, single-best-answer e dificuldade observada. Falha relevante em qualquer gate = needs_revision.':'Auditoria científica e editorial independente de TODOS os itens recebidos. Usar a resposta cega já registrada para a MESMA versão. Não alterá-la para coincidir com o gabarito.'}
${stage==='perplexity_reaudit'?'Rever as versões corrigidas ou pendentes. Não atribuir nota global ao bloco usando apenas este subconjunto. Notas globais são agregadas pelo sistema a partir de todas as versões atuais.':''}
Abrir fontes e comparar a recomendação exata. verified_sources exige institution, document, year, url e section/note quando disponíveis. Relatar falha de acesso como pendência.
Antes de aprovar cada item, validar também:
1. mensagem_chave realmente funciona como Pulo do Gato: se o aluno a tivesse acabado de ouvir, teria informação suficiente para reconhecer a resposta correta;
2. a explicação da alternativa correta diz por que está certa;
3. as três explicações restantes dizem individualmente por que cada alternativa está errada naquele caso.
Falha em qualquer um desses quatro componentes = needs_revision; ausência, genericidade ou explicação vazia = HARD REJECT 10.
Não modificar itens. Para todo needs_revision/rejected, propor substituições completas APENAS de campos necessários em proposed_change.exact_replacement; não inventar correção quando faltarem evidências. Campos permitidos: ${editable.join(', ')}.
Informar cobertura; trabalhar em partes identificadas se necessário, sem marcar bloco completo até revisar todos os IDs. Recalcular soma/estatísticas por código quando disponível. Números no exemplo são tetos, não notas pré-atribuídas.
${stringify(reviewExample(item,stage,ctx))}`;
    if(stage==='chatgpt_adjudication')return `${common}
JULGAR parecer mais recente e versão atual. Resolver e conferir fontes. Classificar agree, partially_agree ou disagree, com justificativa. Não corrigir nesta etapa.
Para agree/partially_agree: approved_patch contém EXATAMENTE campos e textos autorizados; mudanças na fonte, gabarito e explicações devem ser coerentes. Só estes valores poderão ser aplicados. Para disagree: approved_patch={} e rebuttal_to_perplexity obrigatório. Incerteza sem evidência não autoriza alteração; registrar pendência.
${stringify({...context(item,ctx),review_stage:stage,decisions:[{question_id:'ID_IMUTAVEL',item_version:1,review_id:'UUID_DO_PARECER_EXPORTADO',agreement_status:'disagree',agreement_reason:'',approved_patch:{},rebuttal_to_perplexity:'Fundamentar discordância e pedir reavaliação.'}],stage_metrics:{exam_style:item.exam_style||null,batch_number:ctx.batch_number??null,block_number:ctx.block_number??null,stage:'chatgpt_adjudication',provider:'ChatGPT',run_label:null,total_count:0,approved_count:0,needs_revision_count:0,rejected_count:0,hard_reject_count:0,agreement_count:0,score:null,status:'completed',metrics:{},notes:''}})}`;
    if(stage==='chatgpt_correction')return `${common}
Aplicar somente approved_patch da adjudicação da MESMA versão e review_id. agree/partially_agree autorizam apenas os valores explícitos. disagree ou ausência de adjudicação impedem alteração. Não modificar itens publicados.
Preservar ID/banca; expected_version deve corresponder à versão recebida. O backend incrementa versão, limpa aprovações e exige nova resolução cega e reauditoria. Não aumentar versão manualmente. Campos não alterados não entram no patch.
${stringify({...context(item,ctx),review_stage:'chatgpt_correction_review',questions:[{question_id:'ID_IMUTAVEL',expected_version:1,review_id:'UUID_DO_PARECER_EXPORTADO',patch:{}}],stage_metrics:{exam_style:item.exam_style||null,batch_number:ctx.batch_number??null,block_number:ctx.block_number??null,stage:'chatgpt_correction',provider:'ChatGPT',run_label:null,total_count:0,approved_count:0,needs_revision_count:0,rejected_count:0,hard_reject_count:0,agreement_count:0,score:null,status:'completed',metrics:{},notes:''}})}`;
    if(['lot_chatgpt_final','lot_perplexity_final','lot_gemini_final'].includes(stage))return `${common}
AUDITORIA GLOBAL DAS 1.000. Revisar todas para duplicação semântica, padrão de letras, concentração temática, pistas formais, cobertura da prova-alvo e consistência editorial. Não presumir sete áreas universais.
Rechecagem científica: todos os itens com version>1, todas as questões antes sinalizadas, todas as doses/cutoffs/alto risco e uma amostra adicional de pelo menos 20% das restantes, estratificada por bloco, área e dificuldade, com semente/método registrados. Se não houver classificação de risco confiável, reexaminar todos. Registrar IDs rechecados e cobertura; nunca apresentar amostragem como revisão científica integral.
${stage==='lot_gemini_final'?'Gemini é auditor adversarial após ChatGPT e Perplexity. Apenas sinaliza; não modifica.':'Revisão independente: não receber conclusão dos outros revisores como autoridade.'}
Copiar integralmente version_manifest do pacote. Se qualquer versão mudar, todas as revisões finais e aprovação humana precisam ser renovadas. Cada questão sinalizada deve identificar ID/versão e motivo; mudanças seguem adjudicação, correção e reauditoria. Arrays de achados não podem coexistir com approved.
${stringify({...context(item,ctx),review_stage:stage,reviewer:stage==='lot_gemini_final'?'Gemini':stage==='lot_chatgpt_final'?'ChatGPT':'Perplexity',lote_status:'needs_revision',version_manifest:[],coverage:{global_reviewed_ids:[],scientific_rechecked_ids:[],sampling_method:'',all_high_risk_rechecked:false},questions_flagged:[],duplicate_clusters:[],answer_source_problems:[],coverage_gaps:[],comments:[],stage_metrics:{exam_style:item.exam_style||null,batch_number:ctx.batch_number??null,block_number:null,stage,provider:stage==='lot_gemini_final'?'Gemini':stage==='lot_chatgpt_final'?'ChatGPT':'Perplexity',run_label:null,total_count:0,approved_count:0,needs_revision_count:0,rejected_count:0,hard_reject_count:0,agreement_count:0,score:null,status:'completed',metrics:{},notes:''}})}
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
