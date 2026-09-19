RESIBULANDO — FASE 12.6
CRONOGRAMA GENÉRICO — CORREÇÃO SIMPLIFICADA

A versão anterior ainda podia falhar porque tentava usar a nova RPC
apply_generic_schedule antes do fallback.

Nesta versão removi completamente essa dependência.

O botão agora usa SOMENTE create_study_topic, que é a mesma função
já usada pelo cadastro manual de uma aula no Cronograma.

Também:
- o clique chama a função diretamente no HTML;
- não depende do listener do botão;
- mostra progresso;
- informa exatamente qual aula falhou;
- recarrega as aulas antes de começar;
- ignora temas que já estão no cronograma;
- Medicina usa a lista de 180 aulas;
- Odontologia usa a lista de 108 aulas;
- distribui até a data limite;
- usa no máximo 3 dias diferentes por semana;
- depois rola automaticamente até o Planejador.

ARQUIVOS
Substitua:
- cronograma.html
- cronograma.js
- cronograma-base-data.js

NÃO PRECISA RODAR SQL NOVO.

PUBLICAR
git add -A
git commit -m "Corrige definitivamente cronograma generico"
git pull --rebase origin main
git push origin main

Depois:
Ctrl + Shift + R

TESTE
Ao confirmar, o texto abaixo do botão deve começar a mudar para:
Adicionando aulas... 0/180

ou:
Adicionando aulas... 0/108
