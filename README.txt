RESIBULANDO — FASE 12.9

1. AMBIENTAÇÃO
O cronômetro agora possui um pequeno menu clicável:

- Cronômetro
- Pomodoro

CRONÔMETRO SIMPLES
- conta para cima a partir de 00:00;
- sem limite de tempo;
- Iniciar;
- Pausar;
- Continuar;
- Finalizar sessão;
- registra o tempo no Dashboard;
- mostra o total estudado hoje;
- ao recarregar a página, uma sessão em andamento volta pausada.

POMODORO
- mantém Foco / Pausa;
- mantém as durações configuradas em Configurações.

O sistema impede duas sessões simultâneas:
é necessário finalizar a sessão atual antes de trocar de tipo.

2. CRONOGRAMA — LISTA DE TEMAS
Novo filtro:
- Feitos e não feitos
- Não feitos
- Feitos

As ações de seleção agora ficam em um menu de 3 pontos (⋯).

Opções:
- Remover para o deck
- Marcar selecionadas como já feitas
- Excluir selecionadas

"Remover para o deck" é aplicado às aulas selecionadas que ainda não
foram concluídas e que possuem data agendada.

3. EDITAIS / PROVAS
Removido dos cards:
- botão Questões / Simulados

A alteração rápida de status continua disponível.

ARQUIVOS PARA SUBSTITUIR

Ambientação:
- ambientacao.html
- ambientacao.js
- ambientacao.css

Cronograma:
- cronograma.html
- cronograma.js
- cronograma-base-data.js

Editais / Provas:
- editais.html
- editais.js
- editais.css

NÃO PRECISA RODAR SQL NOVO.

PUBLICAR

git add -A
git commit -m "Implementa ajustes fase 12.9"
git pull --rebase origin main
git push origin main

Depois:
Ctrl + Shift + R
