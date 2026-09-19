RESIBULANDO — FASE 12 MULTIMODO

Este pacote reúne as alterações pedidas para Cronograma, Configurações,
Caderno de Erros, Flashcards, Questões e Simulados e barra lateral.

============================================================
1. CRONOGRAMA
============================================================

REORGANIZAR CRONOGRAMA
- A data limite é usada SOMENTE para distribuir aulas atrasadas.
- Depois de tratar as atrasadas, o Resibulando procura semanas futuras
  com menos de 2 aulas incompletas.
- Quando encontra uma semana assim, puxa as próximas aulas para frente,
  respeitando os dias de estudo teórico e o máximo de aulas por dia.
- Essa segunda etapa NÃO usa a data limite.

MARCAR VÁRIAS COMO JÁ FEITAS
- A Lista de temas ganhou o botão:
  "Marcar selecionadas como já feitas".
- A data usada é a própria scheduled_date de cada aula.
- A data limite do reorganizador não interfere nessa função.

FILTRO POR DATA
- Lista de temas agora pode ser filtrada por:
  - data inicial;
  - data final;
  - além dos filtros de área e busca já existentes.

CRONOGRAMA BASE
- Novo modo dentro de "Adicionar aulas": Cronograma base.
- Mostra a lista em formato de deck antes de adicionar.
- Usa a data limite escolhida para diluir toda a lista.
- Usa no máximo 3 dias de aula por semana.
- Prioriza os dias configurados em "Estudo teórico".
- Evita duplicar aulas do Cronograma Base que já existam no cronograma.

Cronogramas incorporados a partir das planilhas enviadas:
- Medicina: 180 aulas.
- Odontologia: 108 aulas.

============================================================
2. CONFIGURAÇÕES — MEDICINA / ODONTOLOGIA
============================================================

Nova configuração "Modo de estudo":
- Medicina
- Odontologia

MEDICINA
- Mantém o funcionamento e as áreas atuais.
- Habilita o Cronograma Base ENARE Medicina de 180 aulas.

ODONTOLOGIA
- Habilita o Cronograma Base ENARE Odontologia de 108 aulas.
- As listas de área passam a usar:
  Dentística
  Endodontia
  Periodontia
  Cirurgia e Traumatologia Bucomaxilofacial
  Prótese Dentária
  Ortodontia
  Odontopediatria
  Estomatologia
  Patologia Oral e Maxilofacial
  Radiologia e Imaginologia Odontológica
  Implantodontia
  Disfunção Temporomandibular e Dor Orofacial
  Odontogeriatria
  Odontologia para Pacientes com Necessidades Especiais
  Odontologia Hospitalar
  Saúde Coletiva / Saúde Bucal Coletiva
  Odontologia Legal
  Anestesiologia e Farmacologia
  Urgências e Emergências em Odontologia
  Anatomia, Fisiologia e Ciências Básicas Aplicadas à Odontologia
  Cariologia e Odontologia Preventiva
  Materiais Dentários

O modo é aplicado às áreas de:
- Cronograma manual
- Flashcards
- Caderno de Erros
- classificação dos erros em Questões e Simulados
- campo de especialidade/área nas Configurações

============================================================
3. CADERNO DE ERROS
============================================================

IMAGENS / OCR
- "Extrair texto e remover imagem": extrai o texto e descarta a imagem.
- "Extrair texto e manter imagem": extrai o texto e preserva a imagem.
- "Remover imagem": disponível antes de salvar um novo erro.
- "Excluir imagem": disponível ao editar um erro já salvo.
- Ao excluir uma imagem salva, a referência é removida do banco e o
  arquivo também é apagado do bucket docmap.

COMPRESSÃO
- Máximo aproximado: 1100 px no maior lado.
- Conversão para WebP.
- Qualidade inicial 0,68.
- Se ainda ficar acima de aproximadamente 420 KB, tenta qualidade 0,55.

EXPORTAR PDF
- Na Biblioteca, selecione os itens e clique em "Exportar PDF".
- O PDF inclui os textos e tenta incluir também a imagem salva de cada erro.
- Geração ocorre no navegador.

============================================================
4. FLASHCARDS
============================================================

EXPORTAR PDF
- Na Biblioteca, selecione os flashcards.
- Clique em "Exportar PDF".
- O PDF inclui:
  - Área / Matéria
  - Tema
  - Frente
  - Verso
  - imagens da frente e do verso quando existirem

============================================================
5. QUESTÕES E SIMULADOS
============================================================

DASHBOARD
- Desktop em 3 colunas.
- Cards principais em formato quadrado.
- Gráfico de aproveitamento ao longo dos meses ocupa a largura completa.
- Tablet: 2 colunas.
- Celular: 1 coluna.

IMAGENS PARA O CADERNO
- A imagem escolhida na galeria é comprimida antes de ser copiada para
  o Caderno de Erros.
- Destino no Caderno usa WebP e tamanho reduzido.

O reconhecimento por cor do print do gabarito e a galeria temporária de
imagens continuam presentes nesta versão.

============================================================
6. BARRA LATERAL
============================================================

- No desktop, a barra lateral pode ser recolhida e expandida.
- O estado fica salvo no navegador.
- No celular, o comportamento de menu lateral permanece separado.

ESTUDAR
- O grupo "Estudar" agora abre e fecha.
- Subitens:
  - Ambientação
  - Flashcards
  - Caderno de erros
  - Questões e Simulados
- O estado do grupo também fica salvo no navegador.

============================================================
INSTALAÇÃO
============================================================

1. SUPABASE

Abra o SQL Editor e rode SOMENTE este arquivo UMA VEZ:

fase12_multimodo_cronograma.sql

Ele:
- adiciona user_settings.study_mode;
- cria mark_topics_already_done_on_schedule(...);
- cria reorganize_schedule_smart(...).

Não reseta tabelas e não apaga dados.

2. SITE

Extraia o ZIP e copie TODOS os arquivos para a raiz do projeto,
substituindo os arquivos existentes com o mesmo nome.

3. GIT

git add -A
git commit -m "Implementa fase 12 multimodo"
git pull --rebase origin main
git push origin main

4. ATUALIZAÇÃO

Depois que o GitHub Pages terminar o deploy:
Ctrl + Shift + R

============================================================
IMPORTANTE
============================================================

- Não renomeie identificadores internos docmap:*.
- Não renomeie window.docmapUser / window.docmapAudio.
- Não renomeie os buckets docmap e docmap-assets.
- Não é necessário criar bucket novo.
- As planilhas originais não precisam ficar hospedadas no site:
  seus dados já estão incorporados em cronograma-base-data.js.
