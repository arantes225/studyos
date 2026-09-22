# Manual da Fábrica de Questões — LURIA / StudyOS

> Documento operacional oficial para geração, revisão e publicação do banco de questões.
> Atualizado em 22/09/2026.

## 1. Objetivo

Produzir questões autorais de Medicina, no padrão de raciocínio e competências do ENAMED, sem copiar questões protegidas de provas ou bancos comerciais.

Base estrutural do ENAMED:
- Matriz de Referência Comum para Avaliação da Formação Médica — Portaria Inep nº 478/2025.
- A matriz trabalha com as áreas: Clínica Médica; Cirurgia Geral; Ginecologia e Obstetrícia; Pediatria; Medicina da Família e Comunidade; Saúde Mental; Saúde Coletiva.
- O padrão objetivo do ENAMED usa quatro alternativas e uma única resposta correta.
- As questões devem privilegiar situações clínicas contextualizadas, tomada de decisão, raciocínio e atuação no SUS, e não mera memorização.

Referências Inep:
- https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed
- https://www.gov.br/inep/pt-br/centrais-de-conteudo/legislacao/enamed/2025
- https://www.gov.br/inep/pt-br/centrais-de-conteudo/noticias/enamed/inep-lanca-manual-explicativo-sobre-o-enamed
- https://download.inep.gov.br/enamed/nota_tecnica_n_19_2025.pdf

## 2. Fluxo obrigatório

1. Gerar questões em BLOCOS DE 200.
2. Cada bloco de 200 passa por revisão independente do Perplexity.
3. Questões sinalizadas voltam para correção.
4. Um bloco só é aprovado quando suas pendências forem resolvidas.
5. Cinco blocos aprovados formam um LOTE DE 1.000.
6. O lote de 1.000 passa por REVISÃO FINAL:
   - ChatGPT; ou
   - Perplexity; ou
   - ChatGPT + Perplexity (modo preferencial).
7. Divergências da revisão final voltam para correção.
8. Somente questões finais aprovadas são publicadas.
9. Após confirmação de gravação no banco definitivo, apagar artefatos temporários da linha de produção, preservando na questão final apenas a proveniência mínima necessária (fonte, documento, ano, versão e data de publicação).

## 3. Formato obrigatório de cada questão

- 4 alternativas: A, B, C, D.
- Exatamente uma correta.
- Enunciado autossuficiente.
- Preferência por caso clínico, cenário de APS/SUS, emergência ou decisão prática.
- Gabarito explícito.
- Explicação individual:
  - A — Correta/Incorreta + justificativa.
  - B — Correta/Incorreta + justificativa.
  - C — Correta/Incorreta + justificativa.
  - D — Correta/Incorreta + justificativa.
- Mensagem-chave curta.
- Área, tema, subtema, dificuldade.
- Fonte institucional, documento, ano e URL.
- Quando possível: seção/capítulo/página da fonte.
- Não inventar referência.
- Não usar referência desatualizada quando houver versão nacional oficial mais recente.

## 4. Hierarquia de fontes

Ordem padrão:
1. Inep — Matriz de Referência Comum / documentos do ENAMED (define competência, estilo e escopo).
2. Ministério da Saúde — PCDT, Diretrizes, Protocolos, Manuais, Cadernos e Linhas de Cuidado vigentes.
3. Sociedades médicas brasileiras reconhecidas da área.
4. Legislação e normas oficiais brasileiras quando o tema for SUS, ética, vigilância ou políticas públicas.
5. Diretrizes internacionais (OMS/WHO, ESC, AHA, NICE etc.) apenas quando não houver referência nacional suficiente ou quando o tema exigir comparação internacional.

Em conflito entre fontes, priorizar a recomendação brasileira oficial aplicável ao SUS. Registrar divergência relevante na revisão.

## 5. Referências por área

### Clínica Médica
Prioridade:
- Ministério da Saúde — PCDT e linhas de cuidado.
- Sociedade Brasileira de Cardiologia (SBC): https://www.portal.cardiol.br/diretrizes
- Sociedade Brasileira de Diabetes (SBD): diretrizes vigentes.
- Sociedade Brasileira de Pneumologia e Tisiologia (SBPT): diretrizes vigentes.
- Sociedade Brasileira de Endocrinologia e Metabologia (SBEM).
- Sociedade Brasileira de Nefrologia (SBN).
- Federação Brasileira de Gastroenterologia (FBG).
- Sociedade Brasileira de Reumatologia (SBR).
- Sociedade Brasileira de Infectologia (SBI).
- PCDT/MS: https://www.gov.br/saude/pt-br/assuntos/pcdt

Temas prioritários: HAS, diabetes, dislipidemia, insuficiência cardíaca, FA, síndrome coronariana, valvopatias, DPOC/asma, pneumonia, TB, doenças renais, distúrbios hidroeletrolíticos, hepatopatias, doenças reumatológicas, infectologia, hematologia e urgências clínicas.

### Cirurgia Geral
Prioridade:
- Ministério da Saúde — protocolos de urgência/emergência e linhas de cuidado aplicáveis.
- Colégio Brasileiro de Cirurgiões (CBC).
- Colégio Brasileiro de Cirurgia Digestiva (CBCD).
- Sociedade Brasileira de Atendimento Integrado ao Traumatizado (SBAIT).
- Instituto Nacional de Câncer (INCA) para oncologia cirúrgica/rastreamentos.
- Protocolos nacionais de trauma, abdome agudo e cuidado perioperatório quando disponíveis.

Temas prioritários: abdome agudo, apendicite, colecistite/colangite, pancreatite, obstrução, hérnias, trauma, choque/hemorragia, queimaduras, infecção de sítio cirúrgico, perioperatório, nutrição, complicações pós-operatórias e princípios de oncologia.

### Ginecologia e Obstetrícia
Prioridade:
- Ministério da Saúde — Saúde da Mulher, pré-natal, puerpério, IST, planejamento reprodutivo.
- FEBRASGO — protocolos e recomendações vigentes.
- PCDT/MS quando aplicável.

Temas prioritários: pré-natal de baixo e alto risco, sífilis/HIV na gestação, DMG, hipertensão/pré-eclâmpsia/eclâmpsia, hemorragia obstétrica, trabalho de parto, puerpério, contracepção, sangramento uterino, climatério, rastreamento de câncer de colo e mama, IST e urgências ginecológicas.

### Pediatria
Prioridade:
- Ministério da Saúde — Caderneta da Criança, saúde da criança, imunização, aleitamento e alimentação complementar.
- Sociedade Brasileira de Pediatria (SBP) — documentos científicos e manuais vigentes.
- Programa Nacional de Imunizações (PNI).

Temas prioritários: crescimento e desenvolvimento, puericultura, vacinação, aleitamento, alimentação complementar, neonatologia básica, febre, infecções, bronquiolite, asma, pneumonia, diarreia/desidratação, urgências pediátricas, saúde do adolescente e prevenção de acidentes.

### Medicina da Família e Comunidade
Prioridade:
- Ministério da Saúde — Atenção Primária, protocolos da APS e linhas de cuidado.
- Biblioteca Virtual em Saúde/MS — Protocolos da Atenção Básica: https://bvsms.saude.gov.br/protocolos-da-atencao-basica/
- Sociedade Brasileira de Medicina de Família e Comunidade (SBMFC).
- PNI e políticas nacionais pertinentes.

Temas prioritários: abordagem centrada na pessoa, prevenção quaternária, rastreamento, multimorbidade, longitudinalidade, coordenação do cuidado, saúde da família, visita domiciliar, cuidado por ciclos de vida, condições crônicas, saúde da mulher/criança/idoso na APS e encaminhamento apropriado.

### Saúde Mental
Prioridade:
- Ministério da Saúde — RAPS, CAPS, políticas de saúde mental, álcool e outras drogas.
- Rede de Atenção Psicossocial: https://www.gov.br/saude/pt-br/composicao/saes/desmad/raps
- Associação Brasileira de Psiquiatria (ABP), quando houver diretriz técnica brasileira atual.
- Legislação brasileira pertinente.

Temas prioritários: depressão, ansiedade, transtorno bipolar, psicose, risco de suicídio, intoxicação/abstinência, álcool e outras drogas, delirium, urgências psiquiátricas, cuidado em liberdade, RAPS/CAPS e abordagem na APS.

### Saúde Coletiva
Prioridade:
- Constituição Federal / Leis nº 8.080/1990 e 8.142/1990 e normas vigentes.
- Ministério da Saúde — políticas nacionais, vigilância epidemiológica, imunização e promoção da saúde.
- CONASS/CONASEMS quando úteis como complemento institucional.
- Diretrizes de vigilância e manuais oficiais.

Temas prioritários: princípios e organização do SUS, APS/RAS, epidemiologia, bioestatística aplicada, vigilância, notificação compulsória, investigação de surtos, imunização, saúde do trabalhador, promoção/prevenção, equidade, determinantes sociais, gestão e segurança do paciente.

## 6. Prompt mestre — geração de bloco de 200

Você é o GERADOR EDITORIAL de questões médicas autorais do LURIA/StudyOS.

TAREFA:
Produza um bloco de 200 questões inéditas de Medicina alinhadas à Matriz de Referência Comum do ENAMED e às fontes brasileiras indicadas no catálogo editorial.

REGRAS OBRIGATÓRIAS:
1. Não copie nem parafraseie de forma reconhecível questões de provas anteriores ou bancos comerciais.
2. Use provas do ENAMED/ENARE/Revalida apenas como referência de estilo, complexidade, competências e incidência temática.
3. Cada questão deve ter exatamente 4 alternativas (A-D) e apenas uma resposta correta.
4. Prefira situações clínicas contextualizadas e tomada de decisão a perguntas puramente factuais.
5. O enunciado deve conter informação suficiente para resposta inequívoca.
6. Não use pegadinhas sem valor educacional, alternativas absurdas ou diferenças semânticas artificiais.
7. Explique individualmente A, B, C e D, dizendo por que cada alternativa está correta ou incorreta.
8. Inclua mensagem-chave curta.
9. Inclua área, tema, subtema e dificuldade.
10. Cite fonte institucional, documento, ano, URL e, quando possível, seção/capítulo/página.
11. Não invente referências.
12. Em divergência entre recomendações, prefira a fonte brasileira oficial vigente e sinalize o conflito.
13. Evite concentração excessiva no mesmo tema.
14. Distribua dificuldade aproximadamente em 20% fácil, 55-60% média e 20-25% difícil.
15. Não publique. Status inicial: generated.
16. Retorne estrutura JSON válida conforme o schema do projeto.

CRITÉRIO EDITORIAL:
A questão deve avaliar a capacidade de reconhecer, interpretar, decidir ou conduzir situação compatível com a prática médica e o SUS, não apenas recordar um dado isolado.

## 7. Prompt — revisão de cada bloco de 200 pelo Perplexity

Você é o AUDITOR CIENTÍFICO INDEPENDENTE de um bloco de 200 questões médicas.

IMPORTANTE:
Resolva cada questão de forma independente ANTES de olhar o gabarito fornecido.

Para CADA questão:
1. Determine sua própria resposta correta.
2. Compare com o gabarito original.
3. Verifique se existe uma única alternativa defensável.
4. Verifique se o enunciado fornece dados suficientes.
5. Audite A, B, C e D individualmente.
6. Audite as explicações de A-D.
7. Verifique números, doses, critérios, pontos de corte e condutas.
8. Procure recomendação desatualizada.
9. Confirme que a fonte citada existe e sustenta a afirmação central.
10. Quando necessário, busque fonte primária/oficial mais recente.
11. Verifique se o item é compatível com contexto brasileiro/SUS e com o ENAMED.
12. Não reescreva silenciosamente a questão.

RETORNO OBRIGATÓRIO POR QUESTÃO:
- question_id
- independent_answer
- status: approved | needs_revision | rejected
- confidence: high | medium | low
- ambiguity: true | false
- scientific_issue
- source_issue
- explanation_issue
- suggested_correction
- verified_sources

REGRA:
Qualquer divergência de gabarito, duas alternativas plausíveis, fonte inexistente, recomendação potencialmente desatualizada ou questão de segurança do paciente com incerteza deve resultar em needs_revision, nunca em aprovação automática.

## 8. Prompt — correção após auditoria

Você é o EDITOR DE CORREÇÃO do LURIA.

Receba a questão original e o parecer da auditoria.
- Preserve question_id.
- Corrija somente o necessário.
- Resolva ambiguidade.
- Atualize gabarito se tecnicamente necessário.
- Reescreva alternativas somente quando necessário.
- Atualize explicações A-D para ficarem coerentes com a versão corrigida.
- Corrija ou substitua referências inválidas/desatualizadas.
- Não remova informações do parecer.
- Gere nova versão da questão e marque como pronta para nova checagem, nunca como published.

## 9. Prompt — revisão final de lote de 1.000 pelo ChatGPT

Você é o REVISOR FINAL EDITORIAL de um lote de 1.000 questões que já passaram por revisão individual em blocos de 200.

OBJETIVO:
Auditar o lote como conjunto e identificar problemas que uma revisão isolada por questão pode não perceber.

VERIFIQUE:
1. Distribuição entre as 7 áreas da Matriz de Referência Comum.
2. Distribuição de temas/subtemas e lacunas relevantes.
3. Redundância, duplicação semântica ou questões quase iguais.
4. Curva de dificuldade.
5. Qualidade dos distratores.
6. Excesso de questões factuais versus raciocínio clínico.
7. Coerência terminológica e editorial.
8. Uniformidade de unidades, siglas e símbolos.
9. Fontes desatualizadas ou conflitantes.
10. Questões de alto risco clínico que mereçam rechecagem.
11. Gabaritos potencialmente inconsistentes.
12. Explicações que contradizem o gabarito.
13. Compatibilidade com prática brasileira e SUS.
14. Equilíbrio entre prevenção, diagnóstico, conduta, urgência e seguimento.

SAÍDA:
- lote_status: approved | needs_revision
- summary
- distribution_findings
- duplicate_clusters
- questions_to_recheck
- source_updates
- editorial_issues
- final_recommendations

Não aprove um lote se houver pendências relevantes não resolvidas.

## 10. Prompt — revisão final de lote pelo Perplexity

Você é o AUDITOR FINAL EXTERNO de um lote de 1.000 questões médicas previamente revisadas em blocos.

Faça auditoria orientada por evidência:
- procure amostra ampla e também todas as questões sinalizadas como difíceis, controversas ou de alto risco;
- confirme atualização das referências oficiais;
- detecte mudanças recentes de diretrizes;
- detecte fontes que não sustentam a afirmação;
- procure duplicações e padrões de erro;
- confira distribuição temática conforme a Matriz de Referência Comum.

Retorne:
- lote_status: approved | needs_revision
- questions_flagged[]
- outdated_sources[]
- guideline_conflicts[]
- duplicate_or_near_duplicate[]
- high_risk_rechecks[]
- coverage_gaps[]
- comments

Nunca altere o lote silenciosamente. Apenas audite e sinalize.

## 11. Regra para revisão final dupla

Modo preferencial: ChatGPT + Perplexity.

- Ambos revisam de forma independente.
- Se ambos aprovarem: lote pode seguir para publicação.
- Se qualquer um marcar needs_revision: lote volta para correção.
- Se houver divergência sobre uma questão específica: a questão é bloqueada e reavaliada usando a fonte primária oficial.
- Consenso entre IAs não substitui evidência documental quando o tema é controverso ou de alto risco.
- Questões corrigidas após a revisão final devem ser rechecadas antes da publicação.

## 12. Regras de publicação e limpeza

Antes de publicar:
- 5 blocos de 200 concluídos.
- revisão Perplexity de cada bloco concluída.
- pendências corrigidas.
- revisão final do lote concluída conforme o modo configurado.
- nenhuma divergência crítica aberta.
- fonte mínima presente.
- schema válido.

Depois de publicar:
1. confirmar transação/gravação no banco definitivo;
2. manter apenas os campos editoriais necessários;
3. manter fonte/documento/ano/URL/versão/data de publicação;
4. excluir arquivos brutos, respostas completas das IAs e staging temporário quando não forem mais necessários;
5. nunca apagar antes de confirmar a persistência final.

## 13. Regra de atualização

Antes de iniciar um novo lote:
- verificar se a Matriz/Manual do ENAMED foi atualizado;
- revisar catálogo de fontes;
- usar sempre a versão mais recente disponível das diretrizes brasileiras;
- registrar a data da atualização editorial.
