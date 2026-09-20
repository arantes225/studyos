DOCMAP — CADERNO DE ERROS v7.1

ALTERAÇÕES IMPLEMENTADAS

1. ADICIONAR NOVOS ERROS
Nova seção "Adicionar novo erro".
Campos:
- Área
- Matéria
- Tema
- CCQ
- Questão
- Resposta correta
- O que eu pensei
- Imagem opcional

A imagem é comprimida antes do upload:
- máximo 1400px
- WebP quando vantajoso
- qualidade inicial 72%
- nova compressão a 62% se continuar pesada

2. NOVO CARD DE REVISÃO
O CCQ é o elemento principal e aparece grande.
Abaixo aparece em texto pequeno:
Área · Matéria · Tema

Botões:
- Abrir
- Lido

Abrir:
mostra Questão + Resposta correta + O que eu pensei.

Lido:
chama review_error_entry,
agenda a próxima revisão,
e mostra o próximo item automaticamente.

3. REMOVIDOS OS DOIS CARDS INÚTEIS
Foram removidos:
- CCQ / Ideia central
- Revisão / Caderno de erros

4. REVISÃO POR ÁREA
Novo seletor:
Todas as áreas / área específica.

Quando aberto pela Agenda:
o lote continua respeitando data + área
e o filtro fica travado no lote agendado.

5. MINIDASHBOARD
- Erros registrados
- Feitos (itens com ao menos 1 revisão)
- Atrasados
- Retenção média estimada

A retenção usa a mesma função memory_retrievability do DocMap.

INSTALAÇÃO

1. Supabase:
rode UMA VEZ:
caderno_erros_v7_1.sql

2. Substitua:
- caderno-erros.html
- caderno-erros.css
- caderno-erros.js

3. Publique:
git add -A
git commit -m "Melhora caderno de erros"
git push origin main

4. Ctrl + F5

NÃO PRECISA ALTERAR
- ambientacao.html
- ambientacao.js
- dashboard.html
- app.js
- style.css

As integrações atuais com Agenda e Ambientação continuam funcionando.
