-- SUS-SP — recuperação do perfil editorial inicial
-- Mantém ciência separada do estilo e recupera pontos fortes do piloto inicial.

update public.question_exam_style_profiles
set
generation_instructions = $a$Gerar predominantemente casos clínicos de extensão média, com dados suficientes e foco em decisão prática. Variar entre urgência, enfermaria, ambulatório e APS/SUS, mantendo esses contextos funcionais e não decorativos.

Priorizar diagnóstico, conduta imediata, encaminhamento e prevenção. Quando a questão for de manejo, formular decisão concreta em vez de resposta genérica/protetora. Quando pertinente, incluir 1–2 dados laboratoriais ou clínicos adicionais que realmente mudem diagnóstico, gravidade, indicação, timing ou prioridade.

Raciocínio típico em 2–3 etapas, sem obrigatoriedade rígida. Itens diretos continuam permitidos quando coerentes. Manter pequena parcela conceitual/fisiopatológica.

Evitar excesso de detalhes secundários, histórias longas, pseudo-contextualização de SUS e alternativas caricatas. A dificuldade deve vir da decisão clínica e da competição entre alternativas, não do tamanho do texto.$a$,

recommended_generation_rules = $a$SUS-SP: casos clínicos predominantes; enunciado médio; decisão prática concreta; urgência, enfermaria, APS e SUS em presença relevante; raciocínio frequentemente em 2–3 etapas; 1–2 dados adicionais funcionais quando úteis; alternativas curtas a médias; pequena parcela conceitual/fisiopatológica; sem quotas rígidas.$a$,

what_to_avoid = $a$Evitar transformar SUS-SP em ENAMED por excesso de contextualização. Evitar histórias mais longas que o necessário, SUS/APS decorativo, respostas genéricas de manejo, excesso de dados irrelevantes e três distratores absurdos. Evitar usar um único marcador clássico para resolver itens médios/difíceis.$a$,

updated_at = now()
where exam_style='SUS-SP';
