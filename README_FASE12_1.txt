RESIBULANDO — FASE 12.1 CORREÇÕES

CORRIGIDO NESTA VERSÃO

1. MODO ODONTOLOGIA — ÁREAS EM TODO O SITE
Quando o modo Odontologia está ativo, as opções de área passam a usar
as áreas odontológicas em:
- Cronograma
- Flashcards
- Caderno de Erros
- Questões e Simulados
- Configurações
- campos de criação
- campos de edição
- filtros por área
- importação do Anki
- áreas das questões erradas

Modo Medicina mantém:
- Clínica Médica
- Pediatria
- Ginecologia e Obstetrícia
- Cirurgia Geral
- Preventiva

2. BARRA LATERAL REBATÍVEL
Agora existe um botão preso à borda da sidebar.
- ‹ fecha completamente
- › abre novamente
- o estado fica salvo no navegador
- no celular continua usando o menu móvel

3. MENU "ESTUDAR"
"Estudar" agora é realmente clicável.
Abre/fecha:
- Ambientação
- Flashcards
- Caderno de erros
- Questões e Simulados

4. CRONOGRAMA GENÉRICO
Dentro do bloco "Adicionar aulas", junto de:
- Automaticamente
- Manualmente

agora aparece:
- Utilizar cronograma genérico

O conteúdo continua vindo das duas planilhas-base:
- Medicina: 180 aulas
- Odontologia: 108 aulas

5. DOIS BOTÕES DE REORGANIZAÇÃO
Agora são separados:

A) Reorganizar aulas atrasadas
- abre o campo de data limite
- a data limite vale SOMENTE para as atrasadas
- não adianta aulas futuras

B) Reorganizar aulas adiantadas
- só funciona se NÃO houver aulas atrasadas
- não usa data limite
- compacta as aulas futuras para frente
- respeita o máximo de aulas por dia
- usa NO MÁXIMO 3 dias de aula por semana

INSTALAÇÃO

1. No Supabase SQL Editor, rode SOMENTE:
   fase12_1_correcoes.sql

2. Copie TODOS os arquivos do ZIP para a raiz do projeto.
   Escolha substituir quando solicitado.

3. Publique:

git add -A
git commit -m "Corrige fase 12.1 do Resibulando"
git pull --rebase origin main
git push origin main

4. Depois do GitHub Pages atualizar:
Ctrl + Shift + R

NÃO rode SQL mestre.
NÃO apague buckets.
NÃO renomeie identificadores internos docmap.
