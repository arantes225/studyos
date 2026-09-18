DOCMAP — FASE 11.5
OCR / EXTRAÇÃO DE TEXTO NO CADERNO DE ERROS

O QUE ENTROU

1. NOVO ERRO
Ao selecionar uma imagem:
- o DocMap prepara/comprime a imagem
- mostra o tamanho original e o tamanho final
- habilita o botão "Extrair texto da imagem"
- o OCR reconhece português
- o texto extraído vai direto para o campo "Questão"

Se o campo Questão já tiver texto, o DocMap pergunta antes de substituir.

2. EDIÇÃO
Se um item já possui imagem salva:
- Editar pelo menu ⋯
- aparece "Extrair texto da imagem salva"
- o arquivo é baixado do bucket privado
- o OCR insere o resultado no campo Questão

3. COMPRESSÃO CONFERIDA
A rotina já existente foi mantida e agora o resultado fica visível.

Regras atuais:
- redimensiona para no máximo 1400 px no maior lado
- converte para WebP com qualidade 0.72
- se ainda passar de ~650 KB, tenta qualidade 0.62
- se o arquivo comprimido ficar MAIOR que o original,
  mantém o original em vez de piorar o tamanho

Ou seja: a imagem é comprimida quando isso realmente reduz o arquivo.

4. OCR
Foi adicionado Tesseract.js no navegador.
Idioma padrão: português.

Nenhum texto OCR é salvo automaticamente:
ele entra no campo Questão e você ainda pode revisar antes de salvar.

INSTALAÇÃO

NÃO PRECISA RODAR SQL.

SUBSTITUA SOMENTE:
- caderno-erros.html
- caderno-erros.css
- caderno-erros.js

PUBLICAÇÃO:

git add -A
git commit -m "Fase 11.5 OCR no caderno de erros"
git push origin main

Depois:
Ctrl + F5
