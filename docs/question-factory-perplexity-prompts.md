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
