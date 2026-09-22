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

## SES-DF — prompt de auditoria

Audite todas as questões SES-DF com a rubrica oficial.

Verifique simultaneamente:
1. correção da conduta médica;
2. papel real da APS;
3. continuidade/referência/contrarreferência;
4. vigilância e notificação;
5. RAPS/CAPS quando aplicável;
6. se a rede aparece naturalmente, sem transformar o item em administração do SUS;
7. se não há padrão previsível “alternativa da rede = correta”.

Pergunta de controle:
“O lote mede medicina inserida na rede do DF ou apenas reconhecimento de respostas socialmente desejáveis sobre APS/rede?”

## UERJ — prompt de auditoria

Audite todas as questões UERJ com a rubrica oficial.

Refaça independentemente todos os cálculos:
- fórmula de Winter;
- ânion gap;
- gap osmolar;
- odds/probabilidade pós-teste;
- RV;
- NNT/NNH;
- hazard ratio;
- eletrólitos e compensações.

A dificuldade deve vir do raciocínio clínico, não de obscuridade matemática.

Compare proporção de itens numéricos/laboratoriais com provas reais e marque se o lote estiver artificialmente quantitativo.

## PSU-GO — prompt de auditoria

Audite todas as questões PSU-GO com rigor máximo de fidelidade.

Esta banca permanece sensível a circularidade de calibração.

Exigir:
- material primário específico da seleção;
- anos e provas efetivamente observadas;
- declaração explícita de proxy, quando usado;
- diferenciação entre “boa questão de residência” e “questão realmente PSU-GO”.

Classificar a força da identidade:
strong | moderate | weak.

Decisão final:
READY_FOR_200 | NEEDS_ONE_MORE_CALIBRATION | NOT_ENOUGH_PRIMARY_EVIDENCE.

## PSU-MG — prompt de auditoria

Audite todas as questões PSU-MG com a rubrica oficial.

Não tratar PSU-MG como “prova mineira genérica”.

Testar externamente a hipótese de perfil:
- técnico + aplicado;
- MBE contextualizada;
- cálculos simples com significado;
- casos objetivos;
- menos narrativa que ENAMED.

Comparar proporção real de MBE/cálculos com provas oficiais.

Retornar generalization_score_0_10 e:
READY_FOR_200 | NEEDS_PROMPT_REFINEMENT | NEEDS_MORE_PRIMARY_STYLE_DATA.

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
