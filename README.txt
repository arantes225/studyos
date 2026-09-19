RESIBULANDO — FASE 13.3
CADERNO VINCULADO AOS TEMAS DAS AULAS

IMPLEMENTADO

1. NOVA PÁGINA
caderno.html

Ela aparece dentro de:
Estudar > Caderno

2. VÍNCULO COM O CRONOGRAMA
O Caderno carrega automaticamente todos os temas existentes em study_topics.

Cada aula tem um caderno próprio.

Na Lista de temas do Cronograma também foi adicionado o botão:
Caderno

Ao clicar:
caderno.html?topic_id=<id da aula>

abre diretamente o resumo daquele tema.

3. ESTRUTURA BÁSICA DE CADA RESUMO
- Doença
- Epidemiologia
- Quadro clínico
- Diagnóstico
- Tratamento
- Profilaxia
- Observações

4. SALVAMENTO
- salva automaticamente após aproximadamente 0,9 s sem digitação;
- possui também botão Salvar;
- cada usuário só acessa o próprio caderno;
- uma aula possui somente um caderno por usuário.

5. LISTA DE TEMAS
Filtros:
- Todos
- Não feitos
- Feitos
- Com anotações

Também existe busca por nome do tema, área ou matéria.

Temas concluídos continuam disponíveis no Caderno.

INSTALAÇÃO

1. Rode SOMENTE:
fase13_3_caderno.sql

uma vez no Supabase SQL Editor.

2. Copie para a raiz:
- caderno.html
- caderno.css
- caderno.js
- app.js
- cronograma.html
- cronograma.js
- cronograma-base-data.js

3. Publique:

git add -A
git commit -m "Adiciona caderno por tema"
git pull --rebase origin main
git push origin main

4. Depois:
Ctrl + Shift + R

IMPORTANTE
Não rode SQL mestre/reset.
