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

## 5A. Perfil de prova / estilo editorial

Cada questão deve ter um campo separado `exam_style`. Esse campo representa o estilo da banca/prova, não a fonte científica.

Exemplos:
- ENAMED
- ENARE
- SES-DF
- SUS-SP
- REVALIDA
- RESIDÊNCIA-GERAL
- OUTRO

### Como calibrar um estilo

Para cada banca, usar preferencialmente as provas públicas mais recentes disponíveis e o edital/matriz vigente como amostra de calibração. O objetivo é extrair CARACTERÍSTICAS EDITORIAIS, não reutilizar o conteúdo das questões.

Mapear e registrar:
1. tamanho médio e distribuição do comprimento dos enunciados;
2. proporção de casos clínicos versus perguntas diretas;
3. profundidade média de raciocínio;
4. peso relativo de diagnóstico, conduta, prevenção, urgência, seguimento e epidemiologia;
5. número de etapas cognitivas exigidas;
6. padrão de distratores (plausibilidade, proximidade conceitual, armadilhas comuns);
7. nível médio de dificuldade;
8. frequência de dados laboratoriais, exames de imagem descritos e sinais vitais;
9. uso de contexto de APS/SUS/hospital/urgência;
10. temas e subtemas mais incidentes;
11. extensão média das alternativas;
12. grau de literalidade de diretrizes versus integração clínica;
13. terminologia e estilo de redação;
14. distribuição entre áreas.

O perfil deve ser recalibrado quando novas provas relevantes forem publicadas.

### Regra de geração por estilo

Ao gerar uma questão com `exam_style = SUS-SP`, por exemplo, a IA deve:
- usar o perfil estatístico/editorial extraído das provas recentes do SUS-SP;
- reproduzir aproximadamente comprimento, profundidade, dificuldade e tipo de raciocínio;
- manter quatro alternativas apenas quando esse for o formato-alvo definido para o banco;
- usar conteúdo científico autoral e atual;
- nunca copiar, adaptar de forma reconhecível ou reconstruir uma questão original da banca.

A mesma regra vale para SES-DF, ENARE, ENAMED, Revalida e outros perfis.

### Separação obrigatória

`exam_style` controla a FORMA.
As referências científicas controlam o CONTEÚDO.

Exemplo:
- exam_style: SUS-SP
- área: Clínica Médica
- tema: Insuficiência Cardíaca
- fonte científica: Diretriz SBC vigente
- perfil editorial: SUS-SP calibrado com provas recentes

Assim, uma mesma competência clínica pode originar questões diferentes nos estilos ENAMED, SUS-SP ou SES-DF sem alterar a base científica.

## 5B. Perfis de banca calibrados — lote piloto de 50 questões

Calibração editorial baseada no lote piloto auditado em 22/09/2026. As notas abaixo representam fidelidade de ESTILO, não qualidade científica absoluta.

### SUS-SP
- Nota de estilo do piloto: 9/10.
- Tamanho do enunciado: semelhante ao perfil recente.
- Profundidade: semelhante.
- Dificuldade: semelhante.
- Contextualização: adequada.
- Distratores: adequados e plausíveis.
- Perfil operacional:
  - casos clínicos predominantes;
  - foco forte em conduta prática;
  - presença relevante de urgência, APS e SUS;
  - raciocínio em 2–3 etapas;
  - enunciados médios, aproximadamente 3–7 linhas;
  - alternativas curtas a médias;
  - preferir decisões de diagnóstico, conduta imediata, encaminhamento e prevenção.
- Ajustes para novas gerações:
  - manter forte presença de casos clínicos;
  - preservar 20–30% de APS/SUS/Medicina Preventiva;
  - incluir pequena parcela de questões conceituais/fisiopatológicas;
  - evitar excesso de detalhes secundários.
- Pontos do piloto a aperfeiçoar:
  - SUSSP_02: reduzir detalhes não essenciais;
  - SUSSP_05: pode incluir 1–2 dados laboratoriais;
  - SUSSP_06: transformar em decisão concreta de manejo quando possível.

### ENARE
- Nota de estilo do piloto: 8/10.
- Tamanho do enunciado: ligeiramente menor que o perfil real.
- Profundidade: semelhante.
- Dificuldade: abaixo a semelhante.
- Contextualização: adequada.
- Perfil operacional:
  - casos clínicos de extensão moderada;
  - ampla cobertura das grandes áreas;
  - forte uso de diretrizes brasileiras;
  - equilíbrio entre diagnóstico, conduta, prevenção e SUS;
  - linguagem uniforme e nacional;
  - raciocínio em 2–3 etapas.
- Ajustes para novas gerações:
  - alongar parte dos casos;
  - elevar discretamente a dificuldade média;
  - aumentar raciocínio multi-etapas;
  - incluir mais prevenção/epidemiologia de complexidade intermediária.
- Observação importante:
  - quando o banco LURIA estiver em formato padrão de 4 alternativas, manter 4 alternativas por compatibilidade interna, mesmo que provas históricas do ENARE usem outro número.

### Santa Casa-SP
- Nota de estilo do piloto: 8/10.
- Tamanho do enunciado: semelhante.
- Profundidade: semelhante.
- Dificuldade: semelhante.
- Contextualização: insuficiente a adequada.
- Perfil operacional:
  - mistura de casos curtos e questões conceituais;
  - forte peso de clínica/cirurgia clássicas;
  - fisiopatologia, critérios e associações;
  - raciocínio frequentemente em 1–2 etapas;
  - enunciados curtos a médios;
  - distratores próximos e tecnicamente sutis;
  - menor dependência de storytelling.
- Ajustes para novas gerações:
  - aumentar itens conceituais;
  - usar ocasionalmente formatos EXCETO/INCORRETA/NÃO corresponde;
  - explorar critérios diagnósticos e fisiopatologia;
  - manter distratores muito próximos entre si.
- Pontos do piloto a aperfeiçoar:
  - coqueluche e genograma ficaram um pouco mais próximos de provas nacionais/APS do que do perfil técnico tradicional da Santa Casa.

### SES-DF
- Nota de estilo do piloto: 8,5/10.
- Tamanho do enunciado: semelhante.
- Profundidade: semelhante.
- Dificuldade: semelhante.
- Contextualização: adequada.
- Perfil operacional:
  - casos clínicos médios a longos;
  - forte integração APS → rede especializada/hospitalar;
  - foco em SUS, RAS e organização do cuidado;
  - perguntas de conduta prioritária;
  - cenários de UBS, UPA, hospitais e rede pública;
  - raciocínio em 2–3 etapas;
  - ênfase em classificação, encaminhamento e coordenação do cuidado.
- Ajustes para novas gerações:
  - aumentar alguns casos multi-etapas;
  - ampliar discretamente Saúde Coletiva/APS;
  - explorar linhas de cuidado e rede assistencial.

### UERJ
- Nota de estilo do piloto: 8,5/10.
- Tamanho do enunciado: semelhante.
- Profundidade: semelhante.
- Dificuldade: semelhante, com margem para elevação.
- Contextualização: adequada.
- Perfil operacional:
  - casos clínicos densos, mas objetivos;
  - alta concentração de dados discriminativos;
  - quatro alternativas;
  - forte cobrança de diagnóstico, conduta, critérios formais e epidemiologia;
  - distratores fortes;
  - enunciados de extensão média;
  - raciocínio em 2–3 etapas.
- Ajustes para novas gerações:
  - aumentar densidade de dados laboratoriais e achados discriminativos;
  - reduzir itens excessivamente fáceis;
  - usar critérios formais e detalhes que diferenciem alternativas próximas.

### Regra de uso dos perfis

Quando `exam_style` for informado:
1. carregar o perfil editorial correspondente;
2. aplicar comprimento, dificuldade, profundidade, tipo de distrator e padrão de contexto daquele estilo;
3. manter a base científica independente do estilo;
4. usar provas recentes somente como referência estatística/editorial;
5. nunca copiar ou reconstruir questão reconhecível de prova anterior;
6. recalibrar o perfil após novas provas relevantes ou novo lote piloto auditado.

## 5C. Manual operacional detalhado por banca

Esta seção existe para que qualquer IA, em qualquer conversa futura, entenda exatamente o que o usuário quer quando disser "faça no estilo X".

### Regra universal de calibração

Para qualquer `exam_style`:
1. localizar preferencialmente 2 a 3 provas públicas recentes da banca/processo;
2. verificar também o edital/matriz da edição vigente quando existir;
3. usar esses materiais SOMENTE para aprender forma, incidência e nível;
4. medir comprimento de enunciado, proporção de casos, dificuldade, etapas cognitivas, padrão de alternativas e uso de dados;
5. gerar novo conteúdo clínico do zero;
6. justificar gabarito por fontes científicas independentes da prova anterior;
7. nunca copiar, reconstruir ou parafrasear de modo reconhecível uma questão da banca.

### SUS-SP

**Onde observar o estilo**
- Provas recentes do processo SUS-SP/VUNESP.
- Preferir os 2–3 ciclos públicos mais recentes.
- Usar o edital vigente para confirmar formato da edição.

**Como deve parecer**
- Predomínio de casos clínicos.
- Enunciado médio, aproximadamente 3–7 linhas.
- Forte presença de pronto-socorro, enfermaria, APS e SUS.
- Raciocínio geralmente em 2–3 etapas.
- Perguntas frequentemente terminam em diagnóstico, próxima conduta, prioridade, encaminhamento ou prevenção.
- Distratores devem representar condutas plausíveis, mas incompletas, atrasadas ou inadequadas.
- Deve haver espaço para Saúde Coletiva/APS, sem transformar toda a prova em políticas públicas.

**Ajustes já aprendidos**
- Evitar histórias mais longas que o necessário.
- Quando a questão for de urgência, inserir tempos, gravidade ou dados que realmente mudem a conduta.
- Em obstetrícia e clínica, alguns dados laboratoriais podem aumentar fidelidade.
- Manter pequena parcela de itens conceituais puros.

**Não fazer**
- Não transformar SUS-SP em ENAMED com excesso de contextualização.
- Não criar quatro alternativas em que três são absurdas.
- Não copiar caso clínico anterior trocando idade/nome.

### ENARE

**Onde observar o estilo**
- Cadernos oficiais recentes do ENARE/HU Brasil.
- Edital/documentos da edição vigente.
- Provas anteriores servem para padrão nacional e incidência; não para fonte científica.

**Como deve parecer**
- Linguagem uniforme e nacional.
- Casos clínicos de comprimento moderado, geralmente mais desenvolvidos que perguntas diretas clássicas.
- Cobertura ampla das grandes áreas.
- Equilíbrio entre diagnóstico, conduta, prevenção, epidemiologia e SUS.
- Raciocínio em 2–3 etapas.
- Diretrizes nacionais aparecem implicitamente na decisão correta.

**Ajustes já aprendidos**
- Nosso primeiro piloto ficou um pouco curto/fácil.
- Nas novas gerações, aumentar levemente tamanho e dificuldade.
- Inserir mais decisões multi-etapas e epidemiologia/prevenção intermediária.

**Não fazer**
- Não deixar o bloco inteiro com perguntas fáceis de reconhecimento direto.
- Não deixar a banca com "cara" excessiva de prova estadual/local.

### Santa Casa-SP

**Onde observar o estilo**
- Provas e editais recentes da Santa Casa de São Paulo.
- Confirmar a banca da edição vigente antes de gerar um lote novo.

**Como deve parecer**
- Mais tradicional, técnico e acadêmico.
- Mistura relevante de casos clínicos curtos e questões conceituais puras.
- Enunciados curtos a médios.
- Raciocínio frequente em 1–2 etapas.
- Maior espaço para fisiopatologia, critérios, associações e conceitos clássicos.
- Pode usar formatos EXCETO, INCORRETA ou NÃO corresponde.
- Distratores próximos, mudando detalhe técnico, ponto de corte ou associação.

**Ajustes já aprendidos**
- Aumentar fisiopatologia, MBE e critérios.
- Reduzir storytelling em parte do bloco.
- Evitar deixar Pediatria/Preventiva com "cara de ENAMED" quando o objetivo for Santa Casa.

**Não fazer**
- Não usar EXCETO em excesso.
- Não criar pegadinha puramente semântica sem valor médico.

### SES-DF

**Onde observar o estilo**
- Provas recentes da residência SES-DF e documentos da banca da edição vigente.
- Usar cenários compatíveis com a rede pública, sem inventar regra local não documentada.

**Como deve parecer**
- Casos clínicos médios a longos.
- Forte integração APS → UPA/hospital → especialidade → retorno à APS.
- Perguntas de conduta prioritária, estratificação de risco, encaminhamento e organização do cuidado.
- Raciocínio 2–3 etapas.
- Saúde Coletiva e RAS devem aparecer com peso real.
- Cenários: UBS/ESF, UPA, hospital regional, vigilância e atenção domiciliar.

**Ajustes já aprendidos**
- Aumentar casos multi-etapas.
- Ampliar discretamente Saúde Coletiva.
- Dar atenção a coordenação, transição pós-alta e cuidado compartilhado.

**Não fazer**
- Não inventar fluxos específicos do DF sem fonte.
- Não reduzir a banca a leis do SUS; ela continua sendo clínica.

### UERJ

**Onde observar o estilo**
- Cadernos recentes da residência UERJ/CEPUERJ.
- Preferir provas de acesso direto para calibrar o banco geral.

**Como deve parecer**
- Quatro alternativas.
- Casos densos, porém objetivos.
- Alta informação discriminativa por linha.
- Uso frequente de laboratório, sinais, valores e critérios formais.
- Distratores fortes.
- Dificuldade média/alta.
- Boa presença de diagnóstico, conduta e epidemiologia/MBE.
- Raciocínio 2–3 etapas.

**Ajustes já aprendidos**
- Inserir mais dados laboratoriais que realmente diferenciem hipóteses.
- Evitar questões fáceis demais.
- Usar mais estratificação e critérios formais.

**Não fazer**
- Não tornar o enunciado longo apenas para parecer difícil.
- Não inserir dado redundante que não mude raciocínio.

### PSU-GO

**Estado**
- Perfil em calibração inicial no segundo lote piloto.

**Onde observar o estilo**
- Provas públicas recentes do PSU Goiás/AREMG.
- Editais e publicações oficiais da AREMG.
- Como há proximidade operacional com processos AREMG, NÃO assumir automaticamente que o estilo é idêntico ao PSU-MG; validar nos cadernos.

**Hipótese de perfil inicial**
- Enunciados curtos a médios.
- Mistura de casos clínicos e conceitos.
- Cobertura das grandes áreas.
- Questões objetivas de diagnóstico e conduta.
- Parte relevante de itens de reconhecimento direto.
- Distratores plausíveis, sem excesso de storytelling.

**O que a próxima auditoria deve medir**
- comprimento real médio;
- proporção caso/conceito;
- dificuldade;
- frequência de questões quantitativas;
- quanto se aproxima ou se afasta do PSU-MG;
- incidência por área.

### PSU-MG

**Estado**
- Perfil em calibração inicial no segundo lote piloto.

**Onde observar o estilo**
- Provas e gabaritos recentes do PSU Minas Gerais/AREMG.
- Editais oficiais da AREMG.
- Preferir cadernos gerais de entrada direta para calibrar o banco.

**Hipótese de perfil inicial**
- Casos objetivos e técnicos.
- Enunciados curtos a médios.
- Conhecimento clássico + aplicação clínica.
- Espaço para critérios, epidemiologia e MBE quantitativa.
- Dificuldade intermediária a alta em parte do caderno.
- Distratores tecnicamente discriminativos.

**O que a próxima auditoria deve medir**
- verdadeira densidade clínica;
- distribuição de questões diretas versus multi-etapas;
- frequência de cálculos/MBE;
- padrão de alternativas;
- diferença editorial real para PSU-GO.

## 5D. Como decidir a fonte científica

A IA deve seguir este raciocínio:
- A banca define "como perguntar".
- A área médica define "onde checar a resposta".
- A data da diretriz define "qual recomendação é atual".

Exemplos:
- `exam_style=SUS-SP`, tema IAM → estilo pelas provas SUS-SP; ciência pela SBC/MS.
- `exam_style=UERJ`, tema pré-eclâmpsia → estilo pelas provas UERJ; ciência por FEBRASGO/MS.
- `exam_style=SES-DF`, tema TB → estilo pela SES-DF; ciência pelo Ministério da Saúde.
- `exam_style=Santa Casa-SP`, tema MBE → estilo Santa Casa; conceito metodológico por referência oficial/metodológica apropriada.

## 5E. Regras mínimas de uma questão publicável

Toda questão final deve ter:
- uma única melhor resposta;
- quatro alternativas no padrão interno atual;
- explicação de A, B, C e D;
- mensagem-chave;
- área, tema, subtema e dificuldade;
- `exam_style`;
- fonte científica geral institucional/documento/ano/URL;
- fonte específica do gabarito: instituição, documento, ano, URL e, quando possível, seção/página/recomendação;
- versão;
- auditoria do bloco;
- auditoria final do lote;
- nenhuma pendência científica crítica.

## 5F. Contrato técnico obrigatório de troca de dados

O bloco copiável de qualquer banca deve incluir este contrato para que uma IA consiga gerar um arquivo importável sem contexto adicional.

### Formato canônico do pipeline

- **JSON estruturado é o formato oficial entre ChatGPT, Perplexity e backend/Supabase.**
- O fluxo automatizado deve usar `batch + questions[]` na geração e `reviews[]` na auditoria.
- Excel `.xlsx` é somente uma representação para revisão humana/exportação.
- CSV UTF-8 é apenas formato auxiliar.
- O banco definitivo é o Supabase/Postgres.

Estrutura raiz de geração:

```json
{
  "schema_version": "1.0",
  "batch": {
    "batch_number": 1,
    "block_number": 1,
    "exam_style": "ENARE",
    "question_count": 200,
    "profile_version": "string",
    "reference_exam_years": ["2024","2025","2026"],
    "generation_model": "string",
    "generation_status": "generated"
  },
  "questions": []
}
```

Estrutura raiz de auditoria:

```json
{
  "schema_version": "1.0",
  "review_stage": "block_review",
  "batch_number": 1,
  "block_number": 1,
  "exam_style": "ENARE",
  "auditor": "Perplexity",
  "reviews": [],
  "summary": {}
}
```

### Excel para revisão humana

Quando solicitado, gerar quatro abas a partir do JSON canônico:

1. `Questoes`
2. `Metadados_Lote`
3. `Guia_Campos`
4. `Auditoria`

### Abas obrigatórias

1. `Questoes`
2. `Metadados_Lote`
3. `Guia_Campos`
4. `Auditoria`

### Aba `Questoes` — ordem exata A–AR

A `question_id`  
B `batch_number`  
C `block_number`  
D `block_sequence_no`  
E `sequence_no`  
F `question_code`  
G `exam_style`  
H `area`  
I `tema`  
J `subtema`  
K `dificuldade`  
L `enunciado`  
M `alternativa_a`  
N `alternativa_b`  
O `alternativa_c`  
P `alternativa_d`  
Q `gabarito`  
R `explicacao_a`  
S `explicacao_b`  
T `explicacao_c`  
U `explicacao_d`  
V `mensagem_chave`  
W `fonte_instituicao`  
X `fonte_documento`  
Y `fonte_ano`  
Z `fonte_url`  
AA `fonte_secao`  
AB `answer_source_institution`  
AC `answer_source_document`  
AD `answer_source_year`  
AE `answer_source_url`  
AF `answer_source_section`  
AG `answer_source_note`  
AH `status`  
AI `block_review_status`  
AJ `block_review_answer`  
AK `block_review_notes`  
AL `lot_review_chatgpt_status`  
AM `lot_review_perplexity_status`  
AN `lot_review_chatgpt_notes`  
AO `lot_review_perplexity_notes`  
AP `version`  
AQ `created_at`  
AR `observacao_revisao`

### Regras críticas dos campos

- `question_id` e `question_code` são únicos.
- `block_number`: 1–5.
- `block_sequence_no`: 1–200 sem lacunas.
- `sequence_no`: posição global no lote de 1.000.
- `exam_style`: usar nome cadastrado exato.
- `dificuldade`: Fácil, Médio ou Difícil.
- `gabarito`: somente A/B/C/D.
- `status`: `generated` na geração inicial.
- campos de auditoria ficam vazios.
- `version`: 1 na primeira geração.
- `created_at`: preferir deixar para o banco salvo pedido em contrário.

### Fonte específica do gabarito

Toda questão deve informar de onde vem a informação que torna o gabarito correto.

Obrigatórios:
- `answer_source_institution`
- `answer_source_document`
- `answer_source_year`
- `answer_source_url`

Quando possível:
- `answer_source_section`
- `answer_source_note`

A fonte deve sustentar DIRETAMENTE o gabarito. Referência genérica sobre o tema não é suficiente. Se a resposta depende de dose, ponto de corte, idade, intervalo, contraindicação ou recomendação, localizar a recomendação correspondente. Nunca inventar página ou seção. Questão sem fonte verificável do gabarito não pode ser aprovada.

### Metadados_Lote

Estrutura `campo | valor` com:
- exam_style
- batch_number
- block_number
- question_count = 200
- generation_date
- generation_model
- profile_version
- reference_exam_years
- scientific_reference_policy
- difficulty_target
- generation_status = generated
- notes

### Guia_Campos

Colunas:
- campo
- tipo
- obrigatorio
- valores_permitidos
- descricao

Documentar todos os campos A–AR.

### Auditoria

Cabeçalho inicial:
- question_id
- auditor
- auditor_model
- review_stage
- independent_answer
- status
- confidence
- ambiguity
- scientific_issue
- source_issue
- answer_source_issue
- explanation_issue
- style_issue
- suggested_correction
- verified_sources
- reviewed_at

Não pré-preencher aprovação.

### Validações obrigatórias

Antes de entregar:
1. exatamente 200 questões;
2. IDs únicos;
3. sequências corretas;
4. quatro alternativas em todas;
5. um único gabarito A-D;
6. explicações A-D completas;
7. mensagem-chave completa;
8. fonte geral presente;
9. fonte específica do gabarito presente e coerente;
10. campos de auditoria vazios;
11. versão inicial = 1;
12. sem duplicatas/quase duplicatas;
13. dificuldade compatível com perfil;
14. temas razoavelmente distribuídos;
15. arquivo abre sem erro e o cabeçalho é exatamente A–AR.


## 5G. Fluxo operacional obrigatório por bloco e por lote

Cada bloco possui 200 questões e segue esta sequência:

1. **Geração ChatGPT** — cria as 200 questões no perfil da banca.
2. **Checagem inicial ChatGPT** — valida estrutura, duplicação, fontes e coerência antes da auditoria independente.
3. **Auditoria Perplexity** — resolve cada item de forma independente, atribui `quality_score` de 0 a 100 e verifica fonte do gabarito.
4. **Questões abaixo de 97 ou com hard fail** — entram em `needs_revision` e aparecem no Admin como “a rever”.
5. **Correção ChatGPT** — lê o parecer salvo no Supabase, corrige apenas as sinalizadas e incrementa `version`.
6. **Reauditoria Perplexity** — revisa a nova versão. Questão continua em correção enquanto não atingir >=97 sem hard fail.
7. **Aprovação humana** — somente quando as 200 estão machine-approved o Admin libera SIM/NÃO. SIM move o bloco para o lote.
8. Cinco blocos aprovados pelo administrador formam **1 lote de 1.000**.
9. **Revisão final ChatGPT das 1.000** — avalia o lote como conjunto: duplicações, cobertura, dificuldade, distribuição, fontes e consistência editorial.
10. **Revisão final Perplexity das 1.000** — auditoria final independente baseada em evidência.
11. Somente após a revisão final exigida pelo modo do lote as questões recebem status `ready`.

### Nota de qualidade

O corte operacional é 97/100. Nota alta não supera hard fail.

Hard fails incluem:
- gabarito incorreto ou divergente;
- duas alternativas defensáveis;
- ambiguidade relevante;
- fonte inexistente ou que não sustenta o gabarito;
- recomendação desatualizada;
- dose/ponto de corte incorreto;
- risco de segurança do paciente;
- questão reconhecível como cópia/adaptação indevida.

O Admin deve registrar e comparar:
- qualidade inicial do bloco;
- qualidade pós-correção;
- qualidade final da versão atual;
- taxa de aprovação na primeira passagem;
- taxa de aprovação após reauditoria;
- desempenho por banca;
- número de questões enviadas para correção.

Os dados devem servir para ajustar os prompts editoriais ao longo do tempo.


## 5H. Adjudicação ChatGPT × Perplexity

Quando o Perplexity reprovar ou atribuir menos de 97 a uma questão, ele deve obrigatoriamente propor uma mudança concreta, não apenas apontar o problema.

A proposta deve informar:
- quais campos precisam mudar;
- qual é o problema atual;
- texto substituto exato;
- por que a mudança seria melhor;
- fonte que sustenta a mudança;
- nota estimada após a correção.

Antes de aplicar qualquer mudança, o ChatGPT faz uma adjudicação independente:

- `agree`: concorda com a crítica e com a solução;
- `partially_agree`: concorda com o problema, mas propõe solução diferente;
- `disagree`: considera a crítica ou mudança incorreta.

Em caso de `disagree`, nenhuma alteração deve ser aplicada automaticamente. O ChatGPT deve gerar `rebuttal_to_perplexity`, contendo:
1. question_id;
2. ponto exato de discordância;
3. justificativa técnica;
4. fonte/diretriz que sustenta a discordância;
5. pedido objetivo para o Perplexity reavaliar aquele ponto.

O administrador pode então reenviar essa resposta ao Perplexity. Só após consenso ou nova decisão técnica a questão segue para correção.

## 6. Prompt mestre — geração de bloco de 200

Você é o GERADOR EDITORIAL de questões médicas autorais do LURIA/StudyOS.

TAREFA:
Produza um bloco de 200 questões inéditas de Medicina usando o perfil de prova solicitado e as fontes brasileiras indicadas no catálogo editorial.

Antes de gerar, leia o perfil editorial correspondente em exam_style. Use as provas públicas mais recentes daquela banca apenas para calibrar forma, comprimento, profundidade, dificuldade, incidência temática e padrão de distratores. Não copie nem reconstrua questões originais.

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


## 14. Regras permanentes após T5 — teste forte

O T5 com 30 questões por banca revelou padrões que lotes de 10 itens não mostraram com clareza suficiente.

### A–D é imutável
- O LURIA usa exatamente 4 alternativas: A, B, C e D.
- Auditor externo nunca pode reduzir style, board_fidelity, difficulty ou quality_score por a prova original usar 5 alternativas.
- Sugestões para migrar a A–E devem ser rejeitadas na adjudicação.

### Fonte já nasce definitiva
- Questão de produção não pode sair com “fonte candidata”.
- Gerar instituição, documento, ano, URL e seção/recomendação específica quando disponível.
- Nunca inventar seção, página ou URL para preencher campo.
- answer_source_issue diferente de null bloqueia aprovação.

### Explicações individualizadas
- Explicação genérica para alternativa incorreta não atende ao padrão LURIA.
- A, B, C e D precisam de justificativa específica.
- A explicação deve ensinar exatamente qual conceito torna a alternativa correta ou incorreta.

### Distratores
- Sempre que possível, pelo menos dois dos três distratores devem ser clinicamente plausíveis.
- Preferir diagnósticos diferenciais, exames concorrentes, mecanismos próximos, condutas parcialmente corretas e erros frequentes.
- Evitar opções meramente preenchitivas e termos absolutos usados para denunciar erro.

### Redação e estilo
- Writing perde ponto somente por problema real de escrita/clareza.
- Style perde ponto somente por divergência editorial/cognitiva real da banca.
- Fonte científica e estilo de banca continuam dimensões separadas.

### Diversidade textual
- Evitar lotes inteiros com a mesma sintaxe “Paciente X apresenta...”.
- Variar a forma apenas dentro dos formatos realmente observados na banca.
- Diversidade não pode criar formatos artificiais ausentes do material primário.

### Aprendizado específico Santa Casa-SP
- O T5 confirmou boa ciência e gabaritos, mas mostrou gargalos editoriais: fontes genéricas, explicações repetitivas e parte dos distratores pouco competitiva.
- A recomendação externa de mudar para cinco alternativas foi rejeitada.
- Antes de produção definitiva, a banca deve ser reavaliada após correção desses gargalos com a rubrica oficial 25/20/15/10/10/10/5/5.



### Aprendizado específico SES-DF após T5
- Priorizar como referência de forma a RM-1/SES-DF contemporânea organizada pelo IADES; a edição 2026 usa múltipla escolha A–D com uma única correta.
- Não usar o padrão CERTO/ERRADO histórico como referência dominante contra o formato atual.
- O T5 mostrou superuso de APS/RAS: rede não deve ser obrigatória em toda questão.
- Questões estritamente clínicas podem permanecer estritamente clínicas.
- APS, RAS, vigilância, regulação, RAPS, atenção domiciliar e transição entram quando realmente mudam a decisão.
- A resposta correta não pode ser sistematicamente a mais longa, completa, multiprofissional ou “humanizada”.
- Evitar distratores caricatos; sempre que possível, pelo menos dois dos três devem representar erros assistenciais plausíveis.
- Fonte clínica sustenta conteúdo clínico; documento distrital sustenta apenas fluxo/organização local quando pertinente.
- Explicações A–D devem ser específicas, nunca apenas frases genéricas.
- Corte operacional atual: 97/100.



### Aprendizado específico UERJ após T5
- O T5 confirmou identidade analítica equilibrada: clínica + fisiologia + laboratório + cálculo minoritário.
- Não transformar UERJ em prova quantitativa; cálculo só entra quando modifica interpretação ou decisão.
- Como referência flexível, cerca de 10–20% de cálculo explícito mostrou-se aceitável no T5, condicionado à confirmação em provas oficiais recentes.
- Distratores numéricos devem nascer de erros reais de cálculo/interpretação.
- Explicações de itens quantitativos devem mostrar fórmula, resultado e significado clínico.
- “Fonte candidata” e explicações genéricas continuam proibidas em produção.
- Ambiguidade exige segunda resposta defensável ou dado realmente ausente; comentário incompleto, por si só, não torna o item ambíguo.
- No T5_11, o enunciado já continha osmolaridade elevada; portanto a crítica de ausência desse dado foi rejeitada.
- T5_12 e T5_22 permanecem conceitualmente unívocas, embora suas explicações/distratores possam ser melhorados.
- Corte operacional: 97/100.



### Aprendizado específico PSU-GO após T5
- Decisão atual: NEEDS_ONE_MORE_CALIBRATION.
- Ciência e gabaritos ficaram globalmente sólidos, mas o lote teve dificuldade real baixa, distratores fracos, fontes candidatas e explicações genéricas.
- O achado mais importante é epistemológico: sem amostra de questões oficiais, a identidade PSU-GO não pode ser considerada demonstrada.
- Editais e apresentações oficiais comprovam a estrutura do processo, não a sintaxe, densidade nem arquitetura interna dos itens.
- O fato de AREMG apoiar/operacionalizar PSU-GO e PSU-MG não autoriza tratar os dois estilos como equivalentes.
- Antes de liberar 200, exigir preferencialmente >=20 questões oficiais de 2–3 edições recentes, se disponíveis, e registrar a amostra.
- Meta global de dificuldade do LURIA: ~20% fácil, 55–60% média, 20–25% difícil, com flexibilidade conforme a banca real.
- Evitar lotes em que >40% sejam easy/very_easy sem evidência de que isso reflete a banca.
- Pelo menos dois distratores plausíveis quando possível; explicações A–D específicas; fonte definitiva na geração.
- Corte operacional: 97/100.



### Protocolo do próximo teste PSU-GO
Status atual: `NEEDS_ONE_MORE_CALIBRATION`.

Antes da próxima geração:
1. localizar material primário oficial PSU-GO;
2. registrar preferencialmente >=20 questões oficiais, idealmente distribuídas em 2–3 edições recentes, quando disponíveis;
3. documentar anos, fonte, organizadora e tamanho da amostra;
4. usar PSU-MG apenas como proxy declarado e secundário, nunca como identidade substituta.

Próximo lote de teste:
- 30 questões totalmente inéditas;
- não reciclar temas/estruturas do T5;
- aproximadamente 20% fáceis, 55–60% médias e 20–25% difíceis;
- easy + very_easy não deve ultrapassar 40% sem evidência empírica da banca;
- pelo menos dois distratores plausíveis sempre que possível;
- explicações A–D específicas;
- fonte definitiva já na geração;
- nenhuma “Fonte candidata”.

Critério para considerar o perfil pronto para 200:
- evidência primária suficiente para `style_confidence >= medium-high`;
- após correção e reauditoria, >=90% das 30 questões com quality_score >=97;
- 0 hard fails;
- 0 ambiguidades relevantes;
- nenhuma falha sistêmica de dificuldade baixa;
- ausência de dependência de proxy para caracterizar estilo;
- revisão do usuário repetida após a reauditoria.

Se esses critérios não forem atingidos, manter `NEEDS_ONE_MORE_CALIBRATION`.



### Aprendizado específico PSU-MG após T5
- Status atual: `NEEDS_MORE_PRIMARY_STYLE_DATA`.
- O T5 foi clinicamente correto em geral, mas apresentou 93,3% de itens easy/very_easy, explicações genéricas, distratores fracos, fontes candidatas, sequência A-B-C-D repetida e distribuição de MBE potencialmente artificial.
- O principal limite é falta de amostra primária oficial suficiente para caracterizar estilo PSU-MG.
- Antes do próximo teste, buscar preferencialmente >=20 questões oficiais e idealmente 2–3 cadernos/edições recentes, quando disponíveis.
- MBE/cálculo só deve ganhar peso editorial após validação empírica.
- Gabarito não pode seguir padrão determinístico.
- Fonte candidata/inespecífica: `answer_source_issue != null` e bloqueia aprovação, mas NÃO é hard fail automático.
- Hard fail de fonte exige fonte inexistente, falsa, incorreta ou incapaz de sustentar o gabarito.
- Fonte real porém ampla deve receber pontuação parcial proporcional, não automaticamente 0/15.
- Próximo teste: 30 questões inéditas; fontes definitivas; explicações A–D específicas; dificuldade distribuída; gabarito sem padrão; corte >=97.
- Só considerar READY_FOR_200 se `style_confidence >= medium-high` com evidência primária, >=90% das 30 >=97 após correção/reauditoria, 0 hard fails e 0 ambiguidades relevantes, seguido de nova revisão do usuário.



### Aprendizado específico SUS-SP após T6
- Decisão atual: `NEEDS_MINOR_PROMPT_REFINEMENT`.
- O relatório do Perplexity teve uma inconsistência interna: começou com 5 divergências de gabarito e depois corrigiu para 50/50 concordantes, mas não recalculou as métricas globais.
- Recalculando os 50 escores finais por item: média 97,58; mediana 98; 41/50 (82%) >=97; 32/50 (64%) >=98; 0 questões =100.
- Itens abaixo do corte: 01, 03, 11, 14, 19, 27, 29, 34 e 43.
- Item 49 =97, portanto está no corte e pode receber apenas polish.
- Qualquer componente acima do teto da rubrica é inválido; exemplo: difficulty=6 em rubrica 0–5.
- Identidade SUS-SP foi confirmada como forte: casos curtos, decisão prática, pouca narrativa excessiva e boa mistura de emergência/ambulatório/APS.
- Principal gargalo agora é gerativo: blocos de 5 temas, sintaxe repetida, resposta correta frequentemente mais longa e uso de absolutos denunciadores.
- Antes de READY_FOR_200, corrigir os 9 itens <97, reauditar e reduzir AI_PATTERN_RISK de high.



### Aprendizado específico SES-DF após T6
- Status: `NEEDS_ONE_MORE_CALIBRATION`.
- Métricas: média 98,08; mediana 98; 90% >=97; 84% >=98.
- A média alta não supera gates eliminatórios: 1 ambiguidade, fontes insuficientemente específicas e padrão gerativo forte.
- Rede artificial permaneceu em ~32%; clínica pura em ~42%.
- Correta mais longa em ~82% — principal risco psicométrico residual.
- AI_PATTERN_RISK = high.
- Itens prioritários: 034, 041, 042, 045, 011, 026 e 043.
- Próxima calibração deve: remover rede ornamental, equilibrar extensão das alternativas, substituir absolutos/caricaturas, variar sintaxe e usar fonte diretamente verificável.
- Gate para 200: >=90% >=97 após correção/reauditoria, 0 ambiguidades, 0 hard fails, answer_source_issue=null em todos, network_artificial residual e AI_PATTERN_RISK abaixo de high.



### Novos perfis adicionados — USP-SP, UNIFESP e AMP-PR

#### USP-SP
- Organizador confirmado: FUVEST / COREME-FMUSP.
- Edital COREME/FM nº 02/2026: prova objetiva com 4 alternativas e uma correta.
- Status: CALIBRACAO_INICIAL.
- Antes de produção, amostrar preferencialmente >=20 questões oficiais de 2–3 edições.
- Não inferir dificuldade pelo prestígio da instituição.

#### UNIFESP
- Status: NEEDS_PRIMARY_STYLE_DATA.
- Não usar residência multiprofissional como proxy.
- Não usar outra banca paulista como substituta.
- Só consolidar perfil após localizar e analisar prova médica oficial recente.

#### AMP-PR
- Organizador: AMP / UCAMP.
- 25ª edição em 2026; prova geral e prova específica.
- A AMP disponibiliza material oficial com questões 2023–2025.
- Status: CALIBRACAO_INICIAL.
- Calibrar exclusivamente a prova geral para acesso direto antes de gerar lotes LURIA.



### Aprendizado específico USP-SP após calibração inicial
- Status: `NEEDS_MORE_PRIMARY_STYLE_DATA`.
- Média 92,5; mediana 92; nenhuma das 30 questões chegou a 97.
- 0 hard fails e 0 ambiguidades: o problema não foi gabarito científico, e sim fidelidade editorial, distratores, especificidade de fonte e calibração de dificuldade.
- Evidência formal confirmada: FUVEST/FMUSP usa prova objetiva de múltipla escolha com quatro alternativas e uma correta; a FUVEST publica provas e gabaritos oficiais. 
- Ainda não há base suficiente para afirmar assinatura USP-SP fina porque a auditoria não amostrou questões oficiais textualmente.
- O primeiro lote foi 100% case-based, 80% manejo, 0% conceito puro e só 26,7% multistep; isso não deve ser congelado como identidade.
- Próximo passo obrigatório: >=20 questões oficiais, idealmente 2–3 edições, antes do segundo lote.
- Não usar reputação da instituição como proxy de dificuldade ou profundidade.



### Aprendizado específico UNIFESP após calibração inicial
- Status: `NEEDS_MORE_PRIMARY_STYLE_DATA`.
- Média 87,5; mediana 88; nenhuma questão >=97.
- 0 hard fails e 0 ambiguidades: ciência/gabarito não foram o problema principal.
- Style médio = 2/10 por ausência de amostra textual primária comparável, não por incompatibilidade demonstrada.
- Processo oficial UNIFESP/EPM/COREME, prova teórica e divulgação de cadernos/gabaritos estão confirmados.
- Identidade fina permanece `NOT_ENOUGH_PRIMARY_DATA`.
- O piloto não pode ser usado para inferir que UNIFESP é 100% caso clínico, predominantemente manejo ou dificuldade média.
- Próximo passo obrigatório: >=20 questões médicas oficiais, idealmente de 2–3 edições.
- Proibido usar multiprofissional ou outra banca paulista como proxy silencioso.



### Aprendizado específico AMP-PR após calibração inicial
- Status: `NEEDS_MORE_PRIMARY_STYLE_DATA`.
- A auditoria encontrou média 81,3 e mediana 81, mas parte da perda de style decorreu de penalização inválida pelo formato de quatro alternativas.
- O LURIA mantém exatamente A–D, independentemente de a AMP oficial usar A–E.
- Estrutura AMP confirmada: Prova Geral de 100 questões, seis áreas básicas equilibradas e uma única correta.
- Para fidelidade, reproduzir matriz, comandos, nível de raciocínio, stem e distratores — não o número de alternativas.
- O lote piloto não representa a matriz AMP: só Clínica Médica, Cirurgia Geral e Pediatria.
- Próxima calibração deve incluir Obstetrícia, Ginecologia e Medicina Preventiva e Social, quebrar blocos temáticos e reduzir AI_PATTERN_RISK.

## 15. Terceira barreira independente — Gemini

Depois que o lote de 1.000 passar pela revisão global do ChatGPT e do Perplexity:
1. enviar o arquivo completo ao Gemini;
2. Gemini atua como auditor adversarial de lote, não como editor;
3. ele não modifica questão diretamente;
4. achados voltam para adjudicação;
5. somente mudanças tecnicamente aceitas são aplicadas;
6. após correções necessárias, ocorre a aprovação humana final.

O Gemini deve procurar principalmente duplicatas semânticas, gabaritos conflitantes, explicações incompatíveis, fontes fracas, padrões anormais de resposta, repetição temática/estrutural e recomendações possivelmente desatualizadas.

Prompts permanentes do Perplexity: `docs/question-factory-perplexity-prompts.md`.
