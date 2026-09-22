# Prompts de Auditoria Perplexity — Fábrica de Questões LURIA

> Documento operacional permanente. Atualizado em 22/09/2026.
>
> Regra estrutural imutável: o LURIA usa exatamente quatro alternativas A–D. Diferença em relação ao número de alternativas da prova original NÃO reduz style, board_fidelity, difficulty ou quality_score.

## Rubrica oficial imutável

- Scientific correctness: 25
- Answer key / single-best-answer: 20
- Answer-specific source: 15
- Distractors: 10
- Explanations A–D: 10
- Board fidelity / style: 10
- Writing / clarity: 5
- Difficulty / discrimination: 5

Total = 100.

Aprovação somente quando:
- quality_score >= 97
- hard_fail = false
- ambiguity = false
- single_best_answer = true
- answer_source_issue = null

O auditor NÃO pode redistribuir pesos, criar rubrica alternativa ou penalizar o padrão A–D.

## Hard fail

Marcar hard_fail quando houver gabarito incorreto, duas respostas defensáveis, informação essencial ausente, conduta insegura, dose/cutoff incorreto, recomendação desatualizada, fonte inexistente ou que não sustente a resposta, contradição entre gabarito e explicação, erro matemático relevante ou reprodução reconhecível de questão anterior.

## Regra de resolução independente

Para cada questão:
1. Resolver antes de consultar o gabarito.
2. Registrar independent_answer.
3. Comparar com original_answer.
4. Procurar deliberadamente uma segunda alternativa defensável.
5. Conferir ciência, fonte, explicações A–D, distratores, estilo, redação e dificuldade.
6. Verificar material externo real da banca; perfil interno não basta.

## Fontes

Uma fonte de produção deve ser definitiva, não “fonte candidata”.

Para 15/15, exigir quando disponível:
- instituição;
- documento real;
- ano;
- URL real;
- seção/capítulo/tabela/recomendação;
- nota curta explicando por que a referência sustenta o gabarito.

Nunca inventar seção ou URL.

Hierarquia: MS/PCDT/CONITEC/INCA/PNI/legislação brasileira quando aplicável → sociedades brasileiras → guideline internacional primária atual → revisão sistemática/literatura.

Fonte internacional adequada não perde ponto apenas por ser internacional.

## Explicações A–D

É proibido usar como explicação final apenas frases genéricas como:
“a alternativa não corresponde à melhor interpretação/conduta”.

Cada alternativa deve ter justificativa própria:
- por que a correta está correta;
- qual conceito/diagnóstico/conduta torna cada incorreta errada.

## Distratores

Sempre que clinicamente possível, pelo menos dois dos três distratores devem ser erros médicos plausíveis: diagnóstico diferencial real, exame concorrente, mecanismo próximo, conduta parcialmente correta ou erro frequente.

Evitar alternativas preenchitivas/irrelevantes e absolutismos denunciadores (“sempre”, “nunca”, “obrigatoriamente”, “exclusivamente”, “inevitavelmente”) quando usados apenas para facilitar eliminação.

## Writing e style

Writing só perde ponto por defeito real de redação: ambiguidade textual, gramática, informação desnecessária, formulação inadequada ou clareza insuficiente.

Style só perde ponto por divergência editorial/cognitiva real em relação à banca. O número de alternativas do LURIA não entra nessa penalização.

## Santa Casa-SP — prompt de auditoria

Audite todas as questões do bloco Santa Casa-SP com a rubrica oficial imutável.

Foco:
- técnico-conceitual;
- fisiopatologia;
- critérios;
- mini-vinhetas curtas;
- variedade entre caso curto, questão conceitual, CORRETA/INCORRETA/NÃO/EXCETO quando comprovadamente compatível;
- distratores tecnicamente próximos;
- não transformar em ENAMED.

Verifique especialmente:
- se o candidato acerta porque sabe ou porque três opções são ruins;
- se há repetição excessiva de “Paciente X apresenta...”;
- se a banca foi comparada com material externo real;
- se a fonte específica sustenta o gabarito;
- se explicações A–D são individualizadas.

No T5, ignorar qualquer recomendação de migrar A–D para A–E: A–D é regra fixa da plataforma.



### Ajuste pós-T6 — SUS-SP
- O T6 confirmou a identidade SUS-SP/VUNESP com boa generalização clínica.
- Recalcular métricas globais a partir dos escores finais por item quando o relatório tiver corrigido divergências intermediárias.
- Métricas T6 corrigidas: média 97,58; mediana 98; 41/50 >=97; 32/50 >=98; 0 com 100.
- Itens abaixo de 97: 01, 03, 11, 14, 19, 27, 29, 34 e 43.
- O item 49 tem score 97: não deve ser classificado como abaixo do corte.
- Rejeitar valores fora da rubrica fixa, como difficulty>5.
- No próximo lote, quebrar blocos temáticos perfeitamente regulares, misturar áreas/temas, reduzir respostas corretas mais longas e absolutos denunciadores e exigir fontes que sustentem a decisão exata.
- AI_PATTERN_RISK deve cair de high antes de READY_FOR_200.

## SES-DF — prompt de auditoria

Audite todas as questões SES-DF com a rubrica oficial e corte >=97.

REFERÊNCIA EDITORIAL PRIORITÁRIA
- Use prioritariamente provas/documentos oficiais contemporâneos da RM-1/SES-DF organizados pelo IADES.
- A edição oficial 2026 utiliza múltipla escolha com quatro alternativas A–D e uma única correta.
- NÃO penalize A–D.
- NÃO use o formato CERTO/ERRADO de processos históricos como referência dominante se ele conflitar com a edição contemporânea.
- Material histórico é apenas complementar.

O QUE TESTAR EM CADA ITEM
1. correção da conduta/diagnóstico;
2. existência de única melhor resposta;
3. se APS/RAS/regulação/vigilância/RAPS aparecem apenas quando realmente mudam a decisão;
4. se uma questão estritamente clínica foi artificialmente “vestida de rede”;
5. se a alternativa correta é previsível por ser a mais longa, completa, humanizada ou multiprofissional;
6. se pelo menos dois dos três distratores são plausíveis quando o tema permite;
7. se documento local é usado somente para organização local;
8. se a fonte clínica sustenta diretamente o gabarito;
9. se A, B, C e D têm explicações específicas;
10. se o lote preserva medicina clínica real e não vira prova administrativa do SUS.

REGRA DE REDE
- NÃO exigir APS/RAS em toda questão.
- Itens de diagnóstico, fisiopatologia, exames, urgência e terapêutica podem permanecer estritamente médicos.
- A rede deve entrar quando alterar encaminhamento, continuidade, vigilância, regulação ou segurança.

DISTRATORES
- Evite “não fazer nada”, “internar todos”, “suspender tudo”, “não registrar” e equivalentes usados apenas para entregar o gabarito.
- Prefira nível de atenção errado, momento inadequado do encaminhamento, conduta incompleta, exame concorrente, tratamento certo no contexto errado ou falha realista de continuidade.

FONTE
- Fonte clínica = conteúdo clínico.
- Documento SES-DF = organização/fluxo local quando isso for objeto da questão.
- Não usar portaria distrital para justificar farmacologia, diagnóstico ou tratamento se ela não disser isso diretamente.
- answer_source_issue diferente de null impede aprovação.

Perguntas de controle:
1. “O candidato precisa saber medicina ou basta escolher a resposta mais humanizada?”
2. “A rede realmente modifica esta decisão?”
3. “O item parece SES-DF contemporânea ou apenas uma questão genérica de SUS?”
4. “O perfil generalizou sem transformar APS/RAS em fórmula de gabarito?”

Na análise global, quantifique:
- proporção de itens estritamente clínicos;
- proporção com componente de rede realmente necessário;
- proporção com rede artificial;
- frequência em que a correta é a alternativa mais longa/completa;
- frequência de distratores caricatos;
- AI_PATTERN_RISK.

Uma boa questão SES-DF pode receber style=10 mesmo sem mencionar APS/RAS, se sua forma cognitiva/editorial for compatível com a prova contemporânea.

## UERJ — prompt de auditoria

Audite todas as questões UERJ com a rubrica oficial e corte >=97.

IDENTIDADE
- Preserve UERJ como banca analítica, porém não quantitativa por padrão.
- A dificuldade deve vir principalmente de integração médica, fisiologia, laboratório, critérios e decisão.
- Cálculo explícito deve ser minoritário e clinicamente funcional.

REFaÇA INDEPENDENTEMENTE TODOS OS CÁLCULOS quando aplicável:
- fórmula de Winter;
- ânion gap;
- gap osmolar;
- correção de sódio;
- odds/probabilidade pós-teste;
- razão de verossimilhança;
- NNT/NNH;
- hazard ratio;
- eletrólitos e compensações.

Para cada questão com cálculo, exija:
1. fórmula;
2. resultado;
3. significado clínico.

Não penalize um item por “falta de cálculo” quando a pergunta não exige esse cálculo para haver uma única melhor resposta.

AMBIGUIDADE
- Só marque ambiguity=true se existirem duas respostas defensáveis ou faltar dado que realmente impeça a decisão.
- Comentário insuficientemente detalhado NÃO transforma automaticamente um stem correto em ambíguo.
- Confira o texto original antes de alegar ausência de dado.

DISTRATORES
- Em itens numéricos, cada distrator deve derivar de um erro real previsível.
- Em itens clínicos, priorize diagnósticos, mecanismos, exames ou condutas próximas.
- Números aleatórios ou opções sem relação devem perder pontos.

UTILIDADE CLÍNICA
Pergunte: “Este cálculo modifica diagnóstico, classificação, prognóstico ou conduta?”
Se não modificar, considere se o item está artificialmente quantitativo.

ANÁLISE GLOBAL
Quantifique:
- percentage_calculation_questions;
- percentage_lab_interpretation;
- percentage_pure_clinical;
- percentage_management;
- percentage_diagnostic;
- percentage_epidemiology.

Como referência flexível pós-T5, cerca de 10–20% de cálculo explícito pode ser compatível se as provas oficiais recentes sustentarem isso; NÃO trate como quota fixa.

FONTES E EXPLICAÇÕES
- Fonte definitiva: documento real + ano + URL + seção/recomendação quando confirmável.
- “Fonte candidata” bloqueia aprovação.
- Explicações A–D específicas.
- Nos itens numéricos, explicar também qual erro de cálculo/raciocínio levaria a cada distrator.

Pergunta de controle:
“A identidade analítica da UERJ está sendo medida por raciocínio médico ou por matemática decorativa?”

## PSU-GO — prompt de auditoria

Audite todas as questões PSU-GO com rigor máximo e corte >=97.

STATUS ATUAL
- PSU-GO permanece em calibração.
- O T5 confirmou ciência e gabaritos razoáveis, mas não demonstrou identidade editorial própria com evidência primária suficiente.
- Não use PSU-MG como proxy silencioso apenas porque há apoio/organização da AREMG.

EVIDÊNCIA PRIMÁRIA
Antes de afirmar fidelidade forte:
- localizar questões oficiais PSU-GO;
- registrar years_available;
- registrar number_of_questions_sampled;
- registrar primary_sources_found;
- registrar organizing_body;
- registrar confidence_in_style_profile.
Preferência operacional: >=20 questões oficiais distribuídas em 2–3 edições recentes, quando disponíveis.

Se a amostra primária não existir ou for insuficiente:
- reduza style_confidence;
- não invente assinatura de banca;
- não transforme estrutura de edital em evidência de estilo interno.

DIFICULDADE
Compare dificuldade declarada com dificuldade real.
Meta global de geração do LURIA:
- ~20% fácil;
- ~55–60% média;
- ~20–25% difícil.
Não é quota rígida, mas easy+very_easy não deve dominar.
Tema raro não significa difícil.

DISTRATORES
- Sempre que possível, pelo menos dois dos três distratores devem ser plausíveis.
- Evite opções caricatas como “nenhum exame”, “alta imediata”, “antibiótico sempre”, “internar todos”.
- Se o item puder ser resolvido eliminando três absurdos, reduza distractors e difficulty.

FONTES E EXPLICAÇÕES
- “Fonte candidata” bloqueia aprovação.
- Exigir fonte definitiva com documento/ano/URL/seção quando confirmável.
- A, B, C e D devem ter explicações específicas.
- É proibido usar apenas “não corresponde à melhor interpretação”.

IDENTIDADE
Pergunta principal:
“Esta questão parece PSU-GO por evidência externa ou apenas uma boa questão genérica de residência?”

Não atribua style=10 sem confronto real com itens oficiais.
Não classifique como “distintiva PSU-GO” com falsa precisão quando não houver amostra primária suficiente.

DECISÃO FINAL
READY_FOR_200 | NEEDS_ONE_MORE_CALIBRATION | NOT_ENOUGH_PRIMARY_EVIDENCE.

No estado atual pós-T5, a hipótese de trabalho é NEEDS_ONE_MORE_CALIBRATION até que uma nova rodada com fonte de estilo primária mostre generalização consistente.



### Critério operacional do próximo teste PSU-GO
Na próxima auditoria PSU-GO, NÃO reutilize o T5 como evidência de estilo. O T5 serve apenas como diagnóstico do gerador.

Exija que o novo lote:
- seja composto por 30 questões inéditas;
- tenha sido gerado após análise primária oficial;
- tenha fontes definitivas;
- tenha explicações A–D específicas;
- use distratores plausíveis;
- não concentre easy/very_easy.

Só recomendar `READY_FOR_200` se, após correção e reauditoria:
- >=90% das 30 questões atingirem >=97;
- 0 hard fails;
- 0 ambiguidades relevantes;
- style_confidence >= medium-high sustentado por fonte primária;
- não houver padrão sistêmico de dificuldade baixa ou estilo genérico.

## PSU-MG — prompt de auditoria

Audite todas as questões PSU-MG com a rubrica oficial e corte >=97.

STATUS ATUAL
- NEEDS_MORE_PRIMARY_STYLE_DATA.
- Não trate PSU-MG como “prova mineira genérica”.
- Não inferir identidade por temas comuns de residência.
- A–D é regra fixa LURIA e não deve ser penalizada.

EVIDÊNCIA PRIMÁRIA
Antes de atribuir fidelidade forte:
- localizar material oficial verificável;
- registrar years_available;
- organizing_body;
- primary_sources_found;
- number_of_questions_sampled;
- confidence_in_style_profile.
Preferência operacional: >=20 questões oficiais e idealmente 2–3 cadernos/edições recentes quando disponíveis.

Sem amostra primária:
- style_confidence=low;
- não afirmar assinatura editorial;
- não recomendar READY_FOR_200.

FONTES — REGRA CORRIGIDA
- “Fonte candidata” ou fonte ampla bloqueia aprovação via answer_source_issue.
- Isso NÃO gera hard_fail automaticamente.
- Hard fail de fonte somente se a referência for inexistente, falsa, errada ou não sustentar o gabarito.
- Fonte real porém pouco específica NÃO deve receber automaticamente 0/15; pontuar proporcionalmente à rastreabilidade.

DIFICULDADE
- Classificar dificuldade real.
- Meta global aproximada do LURIA: ~20% fácil, 55–60% média, 20–25% difícil.
- Se easy+very_easy dominar sem evidência da banca, marcar falha sistêmica.

MBE
- Não assumir que MBE/cálculo é marca PSU-MG.
- Comparar frequência com prova oficial.
- Evitar checklist artificial de NNT, OR, sensibilidade, especificidade e rastreamento.

DISTRATORES E EXPLICAÇÕES
- Sempre que possível, pelo menos dois dos três distratores devem ser tecnicamente competitivos.
- Explicações A–D específicas.
- Proibido usar apenas “não corresponde à melhor interpretação”.

PADRÕES DE IA
- Detectar sequência previsível de gabarito, especialmente A-B-C-D repetido.
- Detectar dificuldade uniforme.
- Detectar sintaxe repetida.
- Penalizar padrões sistêmicos de geração artificial.

DECISÃO
READY_FOR_200 | NEEDS_PROMPT_REFINEMENT | NEEDS_MORE_PRIMARY_STYLE_DATA.

No estado atual, só alterar para READY_FOR_200 após evidência primária suficiente + novo lote inédito + correção/reauditoria com corte 97.

## Estrutura mínima por questão

Retornar:
- question_id
- exam_style
- independent_answer
- original_answer
- component_scores completos 25/20/15/10/10/10/5/5
- quality_score
- status
- confidence
- style_confidence
- ambiguity
- single_best_answer
- hard_fail
- hard_fail_reasons
- points_lost[]
- scientific_issue
- answer_source_issue
- distractor_issue
- explanation_issue
- style_issue
- difficulty_issue
- wording_issue
- strongest_point
- remaining_minor_risk
- optional_polish
- proposed_change quando <97

Para toda questão <97, proposed_change deve conter substituição textual exata, não apenas “melhorar”.

## Adjudicação ChatGPT após Perplexity

Nenhuma sugestão do auditor é aplicada automaticamente.

Cada crítica deve receber:
- agree;
- partially_agree;
- disagree.

Se discordar, manter a questão e registrar rebuttal_to_perplexity.

Exemplos de críticas que devem ser rejeitadas:
- penalizar A–D porque a prova original usa A–E;
- reduzir writing por um problema que pertence a fonte/dificuldade/distrator;
- reduzir style por nacionalidade da guideline científica;
- sugerir conduta ou fisiopatologia incorreta em nome de “dificuldade”.

## Revisão final de 1.000

Após os cinco blocos de 200:
1. revisão global ChatGPT;
2. revisão global Perplexity;
3. se ambas aprovarem, enviar o arquivo completo ao Gemini para auditoria adversarial;
4. Gemini apenas sinaliza inconsistências; não altera questões;
5. achados do Gemini voltam à adjudicação;
6. somente depois ocorre a aprovação humana final.

Focos do Gemini:
- duplicatas e quase duplicatas;
- gabaritos conflitantes;
- inconsistência entre explicação e alternativa;
- fontes que não sustentam resposta;
- distribuição anormal de gabaritos;
- repetição excessiva de temas/estrutura;
- conduta potencialmente desatualizada;
- padrões sistêmicos invisíveis na revisão por item.


### Ajuste pós-T6 — SES-DF
- Decisão atual: `NEEDS_ONE_MORE_CALIBRATION`.
- T6: média 98,08; mediana 98; 90% >=97; 84% >=98; 0 hard fails; 1 ambiguidade.
- O T5 melhorou, mas não foi totalmente corrigido.
- Rede artificial ainda ~32%; clínica pura ~42%.
- A correta é a mais longa em ~82% dos itens.
- AI_PATTERN_RISK permanece high.
- Próximo lote deve remover contexto de rede ornamental e quebrar sintaxe repetitiva.
- “Em serviço da rede do DF”, “considerando continuidade” e equivalentes devem ser removidos se não mudarem a decisão.
- A alternativa correta não pode concentrar múltiplas cláusulas enquanto distratores permanecem curtos.
- Substituir absolutos denunciadores por alternativas tecnicamente concorrentes.
- Em vacinação e neonatologia, exigir seção/tabela/protocolo específico.
- Questões protocolodependentes devem declarar o protocolo ou fornecer critério que produza uma única melhor resposta.
- Só recomendar READY_FOR_200 quando network_artificial for residual, AI_PATTERN_RISK deixar de ser high e a correta não for previsível pelo comprimento.


## USP-SP — prompt de auditoria inicial

Audite apenas questões USP-SP.

STATUS:
CALIBRACAO_INICIAL.

Use material primário FUVEST/COREME-FMUSP.
A edição COREME/FM nº 02/2026 confirma prova objetiva com 4 alternativas e uma correta.

Antes de pontuar style:
- localizar questões oficiais;
- registrar years_available;
- number_of_questions_sampled;
- primary_sources_found;
- confidence_in_style_profile.

Não assumir que prova USP é necessariamente longa, obscura ou excessivamente difícil.
Style mede fidelidade observável, não prestígio institucional.

Decisão:
READY_FOR_PILOT | NEEDS_MORE_PRIMARY_STYLE_DATA | NEEDS_PROMPT_REFINEMENT.

## UNIFESP — prompt de auditoria inicial

Audite apenas questões UNIFESP.

STATUS:
NEEDS_PRIMARY_STYLE_DATA.

Não use residência multiprofissional como proxy.
Não use USP, SUS-SP ou outra prova paulista como identidade substituta.

Antes de gerar ou pontuar estilo:
- localizar edital médico vigente;
- localizar caderno/prova oficial;
- registrar >=20 questões oficiais quando possível;
- medir formato, extensão, comandos, casos, dificuldade e distratores.

Sem fonte médica primária suficiente:
style_confidence=low.

Decisão:
READY_FOR_PILOT | NEEDS_MORE_PRIMARY_STYLE_DATA.

## AMP-PR — prompt de auditoria inicial

Audite apenas questões AMP-PR.

STATUS:
CALIBRACAO_INICIAL.

Usar material AMP/UCAMP.
A AMP confirma 25ª edição em 2026, com prova geral e específica.
Não misturar acesso direto com prova de pré-requisito.

Antes de pontuar style:
- amostrar preferencialmente >=20 questões da prova geral;
- usar 2023–2025 como base primária quando acessível;
- registrar years_available, number_of_questions_sampled e confidence_in_style_profile.

Não tratar “prova do Paraná” como perfil genérico regional.

Decisão:
READY_FOR_PILOT | NEEDS_MORE_PRIMARY_STYLE_DATA | NEEDS_PROMPT_REFINEMENT.


### Ajuste pós-calibração inicial — USP-SP
- Decisão: `NEEDS_MORE_PRIMARY_STYLE_DATA`.
- Métricas do lote USPSP_CAL_01–30: média 92,5; mediana 92; 0/30 >=97; 0 hard fails; 0 ambiguidades; 30/30 single-best-answer.
- Scientific e answer_key foram fortes; perdas reais concentraram-se em answer_source, distractors, explanations, style e dificuldade.
- O formato institucional FUVEST/FMUSP foi confirmado, mas a auditoria não amostrou textualmente questões oficiais suficientes.
- Não inferir dificuldade alta, maior fisiopatologia, stems densos ou distratores complexos apenas por ser USP-SP.
- Antes do segundo teste, exigir >=20 questões oficiais, idealmente de 2–3 edições.
- O primeiro lote ficou homogêneo demais: 100% case-based, 80% management, 0% pure concept e 26,7% multistep.
- Próximo lote deve quebrar blocos temáticos e variar tipo de raciocínio somente após observar a frequência real nas provas oficiais.


### Ajuste pós-calibração inicial — UNIFESP
- Decisão: `NEEDS_MORE_PRIMARY_STYLE_DATA`.
- Métricas: média 87,5; mediana 88; 0/30 >=97; 0 hard fails; 0 ambiguidades; 30/30 single-best-answer.
- Scientific e answer_key ficaram máximos em média; perdas principais em style, distractors, explanations, answer_source e difficulty.
- Processo oficial UNIFESP/EPM/COREME e prova teórica foram confirmados, mas 0 questões médicas oficiais foram amostradas textualmente nesta execução.
- Portanto, todos os campos de identidade fina permanecem `NOT_ENOUGH_PRIMARY_DATA`.
- Não usar residência multiprofissional, USP-SP, SUS-SP, Santa Casa-SP ou outra prova paulista como proxy.
- Os números do piloto (100% case-based, 53,3% management, 30% diagnostic, 30% concept, 26,7% multistep, 0% calculation) descrevem somente o lote gerado e NÃO devem virar regras UNIFESP.
- AI_PATTERN_RISK do piloto = high; gabarito A=11, B=3, C=8, D=8.
- Antes do próximo lote, exigir >=20 questões médicas oficiais, idealmente de 2–3 edições recentes.


### Ajuste pós-calibração inicial — AMP-PR
- Decisão: `NEEDS_MORE_PRIMARY_STYLE_DATA`.
- Evidência formal forte: Prova Geral AMP com 100 questões e seis áreas básicas equilibradas.
- Incorporar matriz, variedade de formatos, mistura de stems e distratores mais competitivos.
- NÃO incorporar A–E: a regra LURIA permanece exatamente A–D.
- É proibido penalizar style, difficulty ou quality porque a AMP oficial use cinco alternativas.
- É proibido recomendar converter o LURIA para cinco alternativas.
- O primeiro lote foi artificial: só Clínica/Cirurgia/Pediatria, blocos temáticos, sintaxe repetitiva, AI_PATTERN_RISK high e correta frequentemente mais completa.
- Próximo lote AMP deve representar as seis áreas e manter A–D.
