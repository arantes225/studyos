RESIBULANDO — FASE 12.4
CORREÇÃO DO BOTÃO "ADICIONAR CRONOGRAMA GENÉRICO"

O botão foi refeito para não depender de insert direto do navegador.

NOVO FLUXO
1. Seleciona Medicina ou Odontologia nas Configurações.
2. Cronograma -> Adicionar aulas -> Utilizar cronograma genérico.
3. Escolhe a data limite.
4. Clica "Adicionar cronograma genérico".
5. O site envia a lista completa para UMA função no Supabase.
6. A função:
   - usa no máximo 3 dias de aula por semana;
   - distribui as aulas até a data limite;
   - ignora aulas que já existem;
   - insere tudo em uma única transação;
   - retorna quantas foram criadas.
7. A página recarrega o cronograma e rola até o planejador.

FALLBACK
Se a nova função SQL ainda não existir, o site tenta usar a função
create_study_topic já existente. Assim o botão não fica completamente
inutilizado.

INSTALAÇÃO
1. No Supabase SQL Editor, rode SOMENTE:
   fase12_4_cronograma_generico.sql

2. Depois substitua:
   - cronograma.html
   - cronograma.js
   - cronograma-base-data.js

3. Publique:
git add -A
git commit -m "Corrige cronograma generico"
git pull --rebase origin main
git push origin main

4. Depois:
Ctrl + Shift + R

NÃO rode SQL mestre.
NÃO apague tabelas.
