# Auditorias da fábrica — contrato 2.0

Os prompts executáveis estão centralizados em `assets/js/question-factory-prompts.js` e são exibidos no admin por banca. Use os botões dessa banca; não reutilize instruções ou notas de pilotos anteriores.

## Ordem

1. Calibração editorial: `prompt_calibration`, saída bruta inédita, rubrica própria e FINAL_PROMPT_SCORE >=94.
2. Resolução cega: `blind_resolution`, somente prova-cega.json em conversa limpa; importar respostas antes de abrir gabaritos.
3. Auditoria completa: `perplexity_initial`, fontes abertas, rubrica final 25/20/15/10/10/10/5/5, questão >=97 e demais critérios eliminatórios.
4. Julgamento: `chatgpt_adjudication`, parecer/versão identificados e patch exato autorizado.
5. Correção: `chatgpt_correction_review`, somente patch aprovado, invalidando a aprovação anterior.
6. Nova resolução cega e `perplexity_reaudit` das versões corrigidas/pendentes. Mesma rubrica, sem presumir que mudanças resolveram o problema.
7. Revisões globais ChatGPT e Perplexity; terceira barreira Gemini; aprovação humana final.

## Contrato comum

- A–D em todas as bancas; AMP-PR não é exceção.
- Cada avaliação informa question_id e item_version. Nunca preencher versão pela suposição de que é a atual.
- A nota de estilo do bloco não representa a qualidade do prompt bruto.
- Fonte não verificável por limitação operacional = SOURCE_VERIFICATION_PENDING. Não fabricar referência ou declarar VERIFIED sem leitura.
- Corpus insuficiente = NEEDS_MORE_PRIMARY_STYLE_DATA, nota de estilo indeterminada e pendência; não interpretar falta de acesso como incompatibilidade editorial demonstrada.
- Pontuação alta não supera hard fail ou ambiguidade. Explicação insuficiente não torna, sozinha, o enunciado ambíguo.
- Toda perda de pontos exige justificativa. Proposta de correção identifica campo e texto substituto; evidência insuficiente não autoriza invenção de solução.
- Correções gerais de clareza/distratores não mudam automaticamente a identidade editorial.
- Definir e registrar cobertura. Operação em partes não autoriza declarar auditoria integral antes de cobrir todos os IDs.
- Reauditoria de subconjunto não recebe nota global do bloco; o sistema só agrega estilo com 200 versões atuais auditadas.
- O Gemini sinaliza riscos e não modifica itens. Qualquer mudança exige nova versão, reauditoria e renovação das revisões finais.

Veja `docs/question-factory-manual.md` para schemas, critérios, evidências de corpus e aprovação. O admin gera os exemplos JSON diretamente da fonte única, incluindo campos específicos de cada etapa.
