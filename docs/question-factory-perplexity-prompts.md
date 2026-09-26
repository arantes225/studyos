# Documento legado — fluxo Perplexity desativado

Este documento é mantido apenas para rastreabilidade histórica. O Perplexity não faz mais parte do pipeline obrigatório da Fábrica de Questões.

O fluxo vigente usa ChatGPT em revisões independentes e cegas, com regra obrigatória de ignorar memória, histórico, pareceres, scores e conclusões anteriores. A memória do modelo não é fonte.

Para ver o fluxo atual, consulte `docs/question-factory-manual.md` e `assets/js/question-factory-prompts.js`.

Os nomes técnicos de algumas etapas ainda contêm `perplexity_*` por compatibilidade do banco, mas o executor operacional é ChatGPT.
