-- PSU-MG / AREMG — perfil editorial restaurado e calibração R4
-- Reproduz no banco o estado canônico aprovado em 2026-09-23.
-- Ciência permanece separada da identidade editorial.

update public.question_exam_style_profiles
set
full_generation_brief = $a$PERFIL EDITORIAL PSU-MG — RESTAURADO A PARTIR DO PERFIL INICIAL

IDENTIDADE CENTRAL
- casos objetivos e técnicos;
- enunciados curtos a médios;
- conhecimento clássico combinado com aplicação clínica;
- densidade clínica suficiente para discriminar entre alternativas próximas;
- mistura natural de questões diretas e itens multi-etapas;
- espaço para critérios, epidemiologia e MBE quantitativa quando pertinentes;
- dificuldade intermediária a alta em parte do caderno, sem artificialidade;
- distratores tecnicamente discriminativos, preferencialmente derivados de erros plausíveis de interpretação, indicação, timing, critério ou cálculo.

DENSIDADE CLÍNICA
Questões clínicas não devem depender apenas de um marcador prototípico quando a operação cognitiva pretendida for intermediária ou alta. Nesses casos, combinar 2–3 dados funcionalmente relevantes que precisem ser integrados para separar hipóteses/condutas próximas.

DIRETAS VS MULTI-ETAPAS
Itens diretos são permitidos e fazem parte do perfil. O lote deve também demonstrar capacidade de integração em parte dos itens.

MBE / EPIDEMIOLOGIA
Usar quando pertinente ao conteúdo. Não impor quota fixa. Quando houver cálculo, preferir situações em que o resultado precise ser interpretado, e não apenas obter uma operação aritmética trivial.

ALTERNATIVAS
Distratores devem permanecer no mesmo eixo técnico da correta e competir de forma realista. Evitar que a resposta correta seja a única opção clinicamente sofisticada, completa ou plausível.

EVIDÊNCIA
Características finas de frequência de cálculo, distribuição de dificuldade e proporção direto/multi-etapas continuam dependentes de corpus primário PSU-MG/AREMG.$a$,

generation_instructions = $a$Gerar questões PSU-MG objetivas e técnicas, com enunciados curtos a médios. Alternar naturalmente conhecimento clássico, aplicação clínica, critérios, interpretação de exames, epidemiologia e MBE quando pertinentes.

CONSTRUÇÃO ADAPTATIVA
- Itens fáceis/diretos podem permanecer diretos: não fabricar complexidade nem disputa artificial quando o conhecimento técnico é o próprio alvo.
- Itens médios/difíceis devem exigir integração real: usar 2–3 dados funcionalmente necessários e pelo menos um concorrente forte do mesmo eixo.
- Evitar que um único marcador prototípico entregue sozinho a resposta quando o item pretende ser médio/difícil.
- A dificuldade deve nascer da competição entre alternativas e da interpretação dos dados, não do tamanho do texto, raridade ou gravidade do tema.

DISTRATORES
Construir alternativas de mesma categoria e granularidade. O melhor distrator deve representar erro técnico plausível de interpretação, critério, indicação, timing, sequência ou cálculo. Evitar correta isoladamente mais longa, completa, prudente ou sofisticada.

MBE
Quando houver cálculo e o item não for deliberadamente básico, exigir também interpretação da magnitude ou implicação do resultado.

LOTE
Antes da saída, conferir se há variedade real de dificuldade compatível com o perfil, se os itens médios/difíceis possuem concorrente forte e se a distribuição de letras foi recalculada a partir dos gabaritos. Concentração extrema ou letra ausente deve ser corrigida apenas por reembaralhamento das alternativas, sem alterar conteúdo médico.

Não impor quotas fixas de dificuldade, cálculo ou multi-etapas.$a$,

recommended_generation_rules = $a$PSU-MG: objetivo e técnico; enunciado curto-médio; conhecimento clássico + aplicação clínica; densidade clínica real; mistura natural de diretas e multi-etapas; critérios/epidemiologia/MBE quando pertinentes; parte do lote com dificuldade intermediária-alta; distratores tecnicamente discriminativos; cálculo deve ter função interpretativa quando possível; sem quotas rígidas.$a$,

what_to_avoid = $a$Evitar transformar PSU-MG em sequência de reconhecimento de marcador clássico. Evitar lotes dominados por itens fáceis de uma etapa. Evitar MBE reduzida apenas a aritmética elementar quando a questão pretende ser intermediária. Evitar correta claramente mais sofisticada que os distratores, alternativas caricatas, pistas lexicais e repetição da mesma operação cognitiva. Não impor frequência de MBE/cálculo sem evidência e não usar sequência artificial de gabaritos. Não usar PSU-GO como identidade substituta.$a$,

final_prompt_score = 84.2,
calibration_notes = 'R4 pós-restauração editorial: PASS em calibração bruta. 15/15 concordância cega com gabarito, 0 falhas científicas, 0 ambiguidades materiais, 0 falhas de single-best-answer. Mean style score 84,2; mediana 86; 66,7% dos itens >=84. Distribuição de letras A2/B3/C5/D5. Identidade PSU-MG congelada. Limitações residuais pertencem ao gerador/validador global: excesso de itens fáceis, poucos concorrentes fortes, pistas formais localizadas e MBE ainda pouco interpretativa.',
calibrated_at = now(),
style_score_updated_at = now(),
prompt_calibration = jsonb_build_object(
  'round','R4',
  'final_prompt_score',84.2,
  'cutoff',84,
  'decision','PROMPT_APPROVED',
  'sample_size',15,
  'answer_key_match',15,
  'scientific_fail_count',0,
  'ambiguity_count',0,
  'single_best_answer_failure_count',0,
  'mean_style_score',84.2,
  'median_style_score',86,
  'percent_style_ge_84',66.7,
  'answer_distribution',jsonb_build_object('A',2,'B',3,'C',5,'D',5),
  'profile_status','FROZEN',
  'causal_diagnosis',jsonb_build_array('VALIDATOR_GLOBAL','LOTE_AMOSTRAL')
),
updated_at = now()
where exam_style='PSU-MG';
