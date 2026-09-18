RESIBULANDO — IMPORTADOR MEDCOF

Este patch corrige a leitura de PDFs como:
Teste-18-09-2026---18-53-download.pdf

O problema principal era que o importador antigo reconhecia:
1. Questão...

mas o MedCof usa:
1) Questão...

CORREÇÕES
- reconhece questões iniciadas por 1) e 1.
- reconhece alternativas A), B), C), D), E)
- remove cabeçalhos e rodapés repetidos do MedCof
- para de anexar texto quando encontra a seção GABARITO
- reconhece gabarito compacto do MedCof, inclusive X = anulada
- identifica a fonte como MedCof QBank
- inclui fallback de leitura quando o agrupamento visual do PDF falhar
- NÃO usa OCR desnecessariamente quando o PDF já possui camada de texto

IMPORTANTE
O gabarito oficial é detectado para validar a leitura do PDF,
mas nesta versão não é gravado automaticamente como resposta do usuário.
O fluxo atual do Resibulando continua permitindo marcar as questões erradas
e informar a resposta correta apenas quando necessário.

INSTALAÇÃO
Substitua na raiz do projeto:
- questoes-simulados.js
- questoes-simulados.html

Depois:

git add -A
git commit -m "Corrige importacao de PDFs MedCof"
git pull --rebase origin main
git push origin main

Depois que o GitHub Pages atualizar:
Ctrl + Shift + R

NÃO PRECISA RODAR SQL.
