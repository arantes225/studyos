RESIBULANDO — FASE 13.3
CADERNO DIGITAL TIPO DOCUMENTO

O QUE FOI CRIADO

1. NOVA PÁGINA: caderno.html
Editor em formato de folha/documento, sem cartões para cada parágrafo.
O conteúdo fica corrido como em um Google Docs.

2. CADA AULA/TEMA TEM SEU PRÓPRIO CADERNO
Na lateral ficam os tópicos do Cronograma, inclusive aulas concluídas.
Ao escolher uma aula, abre o documento correspondente.

3. FORMATAÇÃO
- Texto normal
- Título 1
- Título 2
- Subtítulo
- Negrito
- Emojis
- Post-it amarelo de alerta

O título da aula já aparece grande e em negrito no topo do documento.
Dentro das anotações você pode criar outros títulos/subtítulos e manter o texto corrido.

4. AUTOSAVE
O caderno salva automaticamente cerca de 650 ms depois que você para de digitar.
Também existe botão Salvar.

5. AMBIENTAÇÃO
Ao dar play/iniciar uma AULA pelo Cronograma, na Ambientação aparece:

[Abrir caderno]

O botão abre em nova aba o caderno já selecionado exatamente na aula atual,
sem interromper o cronômetro/Pomodoro da Ambientação.

6. MENU LATERAL
Adicionado Caderno dentro de Estudar.

INSTALAÇÃO

1. Rode SOMENTE este SQL uma vez no Supabase:
   fase13_3_caderno_digital.sql

2. Adicione/substitua:
   caderno.html
   caderno.js
   caderno.css
   ambientacao.html
   ambientacao.js
   ambientacao.css
   app.js

3. Publique:

git add -A
git commit -m "Adiciona caderno digital por aula"
git pull --rebase origin main
git push origin main

4. Depois faça Ctrl + Shift + R.

IMPORTANTE
Não rode SQL mestre. Use apenas fase13_3_caderno_digital.sql.
