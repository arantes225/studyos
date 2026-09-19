RESIBULANDO — GALERIA TEMPORÁRIA DE IMAGENS DOS ERROS

O QUE MUDA
- As imagens que o importador já detectou e salvou agora aparecem como
  uma galeria quando você marca uma questão como "Errei".
- A escolha da imagem é OPCIONAL.
- Você pode selecionar qualquer imagem detectada no simulado.
- A imagem escolhida é copiada para a entrada correspondente no
  Caderno de Erros.
- Depois que os erros são enviados ao Caderno, a galeria temporária
  daquele simulado é apagada.
- A cópia que foi enviada ao Caderno NÃO é apagada.

FLUXO
1. Importar PDF.
2. Abrir o simulado.
3. Marcar "Errei".
4. Preencher Área, Resposta correta e CCQ.
5. Se quiser, escolher uma imagem da galeria.
6. Salvar gabarito.
7. Enviar erros ao Caderno.
8. O Resibulando:
   - cria o erro;
   - copia a imagem selecionada para o Caderno;
   - marca o erro como enviado;
   - apaga a galeria temporária do simulado.

IMPORTANTE
Este patch parte do princípio de que o SQL anterior já foi rodado:
question_items.image_path

Como você informou que as imagens já estavam sendo reconhecidas e salvas,
NÃO há SQL novo nesta versão.

ARQUIVOS PARA SUBSTITUIR
- questoes-simulados.js
- questoes-simulados.html

PUBLICAR
git add -A
git commit -m "Adiciona galeria de imagens aos erros"
git pull --rebase origin main
git push origin main

Depois:
Ctrl + Shift + R

OBSERVAÇÃO
O PDF original continua salvo normalmente. O que é apagado após o envio
são apenas os PNGs temporários da galeria.
