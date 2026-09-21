(() => {
  const KEY_PREFIX = "luria:onboarding:v1:";
  const CHALLENGE_PREFIX = "luria:discover:v1:";
  const page = document.body.dataset.page || "dashboard";

  const ROUTES = {
    configuracoes: "/configuracoes/",
    cronograma: "/cronograma/",
    caderno: "/caderno/",
    flashcards: "/flashcards/",
    erros: "/caderno-erros/",
    questoes: "/questoes-simulados/",
    dashboard: "/dashboard/",
    estatisticas: "/estatisticas/",
    editais: "/editais/",
    amigos: "/amigos/"
  };

  const STEPS = [
    {page:"configuracoes", target:".settings-page, .page", title:"Prepare o seu LURIA", transparent:true, text:"Começamos pelas configurações. Ajuste nome, especialidade, sexo, dias de estudo e preferências. Depois de ler, clique em Explorar para deixar a tela livre e configurar enquanto este texto continua visível.", top:true},
    {page:"configuracoes", target:".setting-row", title:"Seu perfil", transparent:true, text:"Preencha seus dados principais. No modo Explorar o fundo fica transparente e os campos continuam totalmente utilizáveis."},
    {page:"configuracoes", target:"[data-weekday], .weekday-grid, .study-days, .setting-row:nth-of-type(2)", title:"Dias de estudo", transparent:true, text:"Escolha em quais dias você quer estudar. O cronograma e as revisões respeitam essa disponibilidade."},
    {page:"configuracoes", target:".interval-editor, [data-interval-field]", title:"Revisões", text:"Defina os intervalos de revisão. O LURIA distribui as revisões dentro dos dias permitidos."},

    {page:"cronograma", target:".topbar, .page-heading", title:"Seu cronograma", text:"O cronograma é a base da organização do LURIA. Você pode importar o material do cursinho por PDF ou Excel, ou montar tudo manualmente.", top:true, demo:"schedule"},
    {page:"cronograma", target:"#file-drop, #schedule-file", title:"PDF, Excel ou manual", text:"PDF: envie o cronograma do cursinho. Excel: importe uma planilha estruturada. Manual: cadastre área, matéria, tema e data diretamente no LURIA.", top:true, noScroll:true, demo:"schedule"},
    {page:"cronograma", target:".import-mode, [name=import-mode], #manual-topic-form", title:"Como importar", transparent:true, text:"Você decide se as aulas entram já programadas ou no Deck. O cadastro manual serve para inserir uma aula por vez sem arquivo.", demo:"schedule"},
    {page:"cronograma", target:"#deck-panel, #deck-list", title:"Deck", text:"O Deck é a área de espera das aulas ainda não programadas. Deixamos duas atividades simuladas aqui para você visualizar como funciona.", demo:"schedule"},
    {page:"cronograma", target:"#week-planner", title:"Semana", text:"As aulas programadas aparecem distribuídas na semana. Deixamos cinco atividades simuladas para mostrar a organização visual.", demo:"schedule"},
    {page:"cronograma", target:".theme-library-panel, #theme-library-list", title:"Lista de aulas", text:"A lista reúne todo o cronograma. Você pode pesquisar, filtrar, selecionar, mover para o Deck, marcar como feita e excluir. Há dez aulas simuladas para você visualizar.", demo:"schedule"},

    {page:"caderno", target:".notebook-topic-panel, #notebook-topic-list", title:"Aulas na lateral", text:"As aulas do cronograma aparecem nesta lateral. As aulas de onboarding são apenas simulações e permitem visualizar o fluxo sem mexer no seu conteúdo.", demo:"notebook"},
    {page:"caderno", target:"#notebook-editor, .notebook-document", title:"Caderno da aula", text:"Ao abrir uma aula, o caderno correspondente aparece aqui. No modo Explorar você consegue ler e testar a interface com o fundo totalmente transparente.", demo:"notebook"},
    {page:"caderno", target:".notebook-toolbar", title:"Ferramentas do caderno", text:"Aqui ficam estilos, fonte, alinhamento, listas, estruturas, linhas, tabelas, imagens, emojis e callouts.", demo:"notebook"},

    {page:"flashcards", target:".flash-tabs", title:"Flashcards", text:"O fluxo tem Revisar, Criar, Importar e Biblioteca. Vamos passar pelas partes principais com cinco cartões de demonstração.", demo:"flashcards", action:"flash-review", top:true},
    {page:"flashcards", target:".flash-review-panel, #review-stage", title:"Revisar um flashcard", text:"Leia a frente e clique em Mostrar resposta. Depois que o cartão vira, aparecem Difícil, Intermediário e Fácil para classificar sua lembrança.", demo:"flashcards", action:"flash-review"},
    {page:"flashcards", target:"#rating-actions, #show-answer", title:"Difícil, intermediário ou fácil", text:"Experimente Mostrar resposta. A classificação define como o cartão volta para suas revisões.", demo:"flashcards", action:"flash-answer"},
    {page:"flashcards", target:"[data-flash-section=create]", title:"Criar flashcard", text:"Em Criar, escolha Área, opcionalmente Matéria e Tema, escreva frente e verso e adicione imagens se quiser.", demo:"flashcards", action:"flash-create"},
    {page:"flashcards", target:"[data-flash-section=library], #library-list, #library-decks", title:"Biblioteca e Decks", text:"A Biblioteca reúne os seus cartões e os organiza em decks. Você pode filtrar, revisar, compartilhar, exportar e gerenciar conjuntos.", demo:"flashcards", action:"flash-library"},

    {page:"erros", target:".error-tabs", title:"Caderno de Erros", text:"Aqui você revisa erros, cria novos registros, consulta a Biblioteca e importa conteúdo. Deixamos cinco exemplos para visualizar o funcionamento.", demo:"errors", action:"error-review", top:true},
    {page:"erros", target:".error-review-panel, #error-stage", title:"Revisão dos erros", text:"O CCQ aparece primeiro para revisão ativa. CCQ significa Comando de Checagem de Conhecimento: uma pergunta curta criada a partir do seu erro para obrigar você a recuperar ativamente a informação antes de ver a resposta. Depois, você pode abrir os detalhes da questão, conferir a resposta correta e revisar o raciocínio.", demo:"errors", action:"error-review"},
    {page:"erros", target:"[data-error-section=create], #error-create-form", title:"Novo Caderno de Erro", text:"No Novo erro você organiza Área, Matéria, Tema, CCQ, questão e resposta. Também pode anexar um print da questão.", demo:"errors", action:"error-create"},
    {page:"erros", target:"#new-error-image, #extract-error-image-text", title:"Extrair texto de um print", text:"Ao adicionar a imagem da questão, o botão Extrair texto pode transformar o conteúdo do print em texto para acelerar o registro do erro.", demo:"errors", action:"error-create"},
    {page:"erros", target:"[data-error-section=library], #error-library", title:"Biblioteca do Caderno de Erros", text:"Todos os erros ficam reunidos na Biblioteca, com busca, filtros, seleção e exportação.", demo:"errors", action:"error-library"},

    {page:"questoes", target:".qs-mode-tabs, .qs-tabs, .page-heading", title:"Questões e Simulados", text:"Esta é uma das áreas mais importantes do LURIA. Você pode criar um simulado manualmente ou enviar um PDF para o sistema separar as questões, montar o gabarito e organizar seus erros.", demo:"questions", action:"questions-mine", top:true},
    {page:"questoes", target:"#qs-history", title:"Meus simulados", text:"Aqui ficam os simulados que você criou ou importou. Durante o onboarding deixamos três simulados fictícios para você visualizar como aparecem os resultados, acertos, erros e aproveitamento sem alterar seus dados reais.", demo:"questions", action:"questions-mine"},
    {page:"questoes", target:".qs-add-mode-tabs", title:"Automático ou manual", text:"A partir daqui o passeio acontece dentro de Adicionar simulado. Automaticamente, você envia um PDF e o LURIA identifica as questões. Manualmente, você informa o nome e a quantidade de questões e usa somente o gabarito e as estatísticas.", demo:"questions", action:"questions-create", transparent:true},
    {page:"questoes", target:"label[for='qs-file']", title:"Selecionar arquivo", text:"No modo automático, clique em Escolher PDF. Para o onboarding, o LURIA já separou um Simulado Onbording de Eletrocardiograma para demonstrar o fluxo sem usar nenhum arquivo seu.", action:"questions-file", transparent:true},
    {page:"questoes", target:"#qs-onboarding-pdf-preview", title:"Visualizando o PDF", text:"Antes de extrair, você consegue conferir o material. Durante esta etapa o PDF de demonstração percorre as páginas apenas para você visualizar como um arquivo real entra no fluxo.", action:"questions-pdf", transparent:true, noScroll:true},
    {page:"questoes", target:"#qs-extraction-mode", title:"Tipo de extração", text:"Extração rápida prioriza velocidade. Extração detalhada cruza mais estratégias e tenta preservar melhor questões, textos e imagens. Se o PDF for complexo, prefira a detalhada.", action:"questions-create", transparent:true},
    {page:"questoes", target:"#qs-source-profile", title:"Origem do material", text:"Informe de onde veio o PDF. O perfil adapta a leitura ao padrão visual mais comum de cada cursinho, como MEDCOF, Aristo, Medway, Estratégia MED ou Medcurso. Neste exemplo usamos Geral.", action:"questions-create", transparent:true},
    {page:"questoes", target:"#qs-import", title:"Extrair questões", text:"Com o arquivo, o tipo de extração e a origem definidos, clique em Extrair questões. No onboarding simulamos o processamento local sem gravar nada no banco.", action:"questions-extract", transparent:true},
    {page:"questoes", target:"#qs-answer-panel, #qs-question-list", title:"Questões extraídas", text:"O LURIA separou as 10 questões do PDF. Aqui você confere cada questão individualmente antes de trabalhar com o gabarito.", action:"questions-answer", transparent:true},
    {page:"questoes", target:"#qs-open-answer-import", title:"Leitor de gabarito", text:"Depois das questões extraídas, você pode importar um print do resultado. O leitor identifica as questões corretas e erradas e prepara o preenchimento do gabarito.", action:"questions-reader", transparent:true},
    {page:"questoes", target:"#qs-onboarding-answer-key", title:"Gabarito reconhecido", text:"Este é o gabarito de demonstração: as questões 2 e 5 foram erradas e aparecem em vermelho; as demais aparecem em verde.", action:"questions-answerkey", transparent:true},
    {page:"questoes", target:"#qs-apply-answer-import", title:"Introduzir gabarito", text:"Ao aplicar os resultados, o LURIA transfere essas marcações para o simulado. No onboarding fazemos isso apenas visualmente, sem salvar nenhum dado real.", action:"questions-applykey", transparent:true},
    {page:"questoes", target:"#qs-question-list", title:"Gabarito aplicado", text:"Pronto: o simulado agora mostra 8 acertos, 2 erros e 80% de aproveitamento. As questões 2 e 5 ficam marcadas como erro para você revisar.", action:"questions-applied", transparent:true},
    {page:"questoes", target:"#qs-send-errors, .qs-error-fields", title:"Enviar erros ao Caderno de Erros", text:"As questões erradas podem virar CCQs. Você pode ajustar Área, Matéria, Tema e explicação antes de enviar, ou escolher não mandar uma questão ao Caderno de Erros.", action:"questions-applied", transparent:true},

    {page:"dashboard", target:".topbar, .page-heading", title:"Dashboard", text:"O Dashboard reúne agenda, revisões, métricas, CCQ e progresso. Ele é o ponto de partida depois da configuração.", top:true},
    {page:"dashboard", target:".calendar-panel, #calendar", title:"Agenda", text:"Aulas, flashcards, CCQs e revisões aparecem na mesma rotina. Você pode alternar entre Dia, Semana e Mês."},
    {page:"dashboard", target:"#dashboard-streak-card, [data-sidebar-streak-card]", title:"Ofensiva", text:"A ofensiva aparece tanto no Dashboard quanto no menu lateral. Ela registra sua sequência de dias de estudo; um dia pulado reinicia a sequência.", action:"streak"},

    {page:"estatisticas", target:".topbar, .page-heading", title:"Estatísticas", text:"Esta área transforma sua atividade em indicadores de desempenho, retenção, volume e pontos de atenção.", top:true},
    {page:"estatisticas", target:".stats-tabs", title:"Visões por recurso", text:"Este menu fica no topo. Durante a apresentação o LURIA percorre Geral, Aulas, Flashcards, Caderno de Erros e Questões para você visualizar cada painel.", action:"stats-tabs", top:true},

    {page:"editais", target:".exam-mode-tabs", title:"Editais e Provas", text:"Aqui você acompanha provas, inscrições, resultados e notas de corte. Vamos abrir Nova prova para mostrar cada campo.", action:"exam-new", top:true},
    {page:"editais", target:"#exam-dialog, #exam-form", title:"Nova prova", text:"Cadastre instituição, banca, status, datas, taxa, sua nota e a última nota de corte. Nada desta demonstração será salvo.", action:"exam-dialog"},
    {page:"editais", target:"#exam-score, #exam-cutoff", title:"Cores da nota", text:"A comparação usa a nota de corte como referência: vermelho quando sua nota fica mais de 2 pontos abaixo; amarelo quando fica na faixa de ±2 pontos; verde quando fica mais de 2 pontos acima.", action:"exam-dialog", forceCardTop:true, scrollPageDown:true},

    {page:"amigos", target:".friends-card:first-of-type", title:"Amigos", text:"Cada usuário possui um ID LURIA. Adicione amigos pelo código e compartilhe materiais diretamente com eles.", top:true},
    {page:"amigos", target:".friends-card:last-of-type", title:"Materiais recebidos", text:"Decks de flashcards e cadernos enviados por amigos ficam reunidos aqui."},

    {page:"dashboard", target:".topbar, .page-heading", title:"Seu LURIA está pronto", text:"O tour terminou. Agora começa Conheça o LURIA: seis desafios para transformar o tutorial em uso real.", finish:true, top:true}
  ];

  function userId(){ return window.docmapUser?.id || "guest"; }
  function stateKey(){ return KEY_PREFIX + userId(); }
  function readState(){
    try { return JSON.parse(localStorage.getItem(stateKey()) || "null"); } catch { return null; }
  }
  function saveState(s){ try { localStorage.setItem(stateKey(), JSON.stringify(s)); } catch {} }
  function status(){ return readState() || {started:false, completed:false, skipped:false, step:0}; }

  const SUMMARY_TITLES = new Set([
    "Prepare o seu LURIA","Seu cronograma","PDF, Excel ou manual","Flashcards",
    "Caderno de Erros","Questões e Simulados","Automático ou manual","Selecionar arquivo",
    "Visualizando o PDF","Tipo de extração","Origem do material","Questões extraídas",
    "Leitor de gabarito","Gabarito reconhecido","Introduzir gabarito","Gabarito aplicado",
    "Enviar erros ao Caderno de Erros","Meus simulados","Dashboard","Estatísticas","Editais e Provas",
    "Amigos","Seu LURIA está pronto"
  ]);

  function activeSteps(s=status()){
    return s.mode==="summary" ? STEPS.filter(step=>SUMMARY_TITLES.has(step.title)) : STEPS;
  }
  function stepAt(index,s=status()){ return activeSteps(s)[Math.max(0,Math.min(index,activeSteps(s).length-1))]; }
  function routeForActiveStep(i,s=status()){ return ROUTES[stepAt(i,s)?.page] || "/dashboard/"; }

  function routeForStep(i,s=status()){
    const base=routeForActiveStep(i,s);
    const params=new URLSearchParams();
    params.set("onboarding","1");
    params.set("step",String(i));
    if(s.mode) params.set("mode",s.mode);
    return base+"?"+params.toString();
  }
  function normalizePath(){ return location.pathname.replace(/\.html$/,"/").replace(/\/+/g,"/"); }
  function onCorrectPage(step){ return page === step.page; }

  function ensureStyles(){
    let l=document.getElementById("luria-onboarding-css");
    if(l){
      if(!String(l.href||"").includes("v=2.0")) l.href="/assets/css/onboarding.css?v=2.0";
      return;
    }
    l=document.createElement("link");
    l.id="luria-onboarding-css";
    l.rel="stylesheet";
    l.href="/assets/css/onboarding.css?v=2.0";
    document.head.appendChild(l);
  }

  function chooseMode(existing=false){
    ensureStyles();
    clearOverlay();
    const overlay=document.createElement("div");
    overlay.id="luria-onboarding-overlay";
    overlay.className="luria-onboarding-mode";
    overlay.innerHTML=`
      <div class="luria-onboarding-dim"></div>
      <section class="luria-onboarding-card luria-onboarding-mode-card" role="dialog" aria-label="Escolher onboarding">
        <span class="eyebrow">Primeiros passos</span>
        <h2>Como você quer conhecer o LURIA?</h2>
        <p>Você pode fazer o tour completo ou uma versão resumida. O guia de Questões e Simulados continuará disponível dentro da própria página.</p>
        <div class="luria-onboarding-mode-grid">
          <button type="button" data-mode="full"><strong>Onboarding completo</strong><small>Passa por todas as áreas, botões principais e fluxos.</small></button>
          <button type="button" data-mode="summary"><strong>Onboarding resumido</strong><small>Mostra só o essencial, com atenção especial aos simulados.</small></button>
        </div>
        ${existing?'<button type="button" class="luria-onboarding-cancel" data-mode-cancel>Cancelar</button>':""}
      </section>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll("[data-mode]").forEach(btn=>btn.onclick=()=>{
      const s={started:true,completed:false,skipped:false,step:0,phase:"explain",mode:btn.dataset.mode};
      saveState(s); clearOverlay();
      if(page!=="configuracoes") location.href="/configuracoes/?onboarding=1";
      else setTimeout(render,100);
    });
    overlay.querySelector("[data-mode-cancel]")?.addEventListener("click",clearOverlay);
  }

  function firstTimeRedirect(){
    const s=status();
    if(s.completed || s.skipped || s.started) return false;
    if(page==="admin") return false;

    const forced =
      new URLSearchParams(location.search)
        .get("onboarding") === "1";

    const createdAt =
      window.docmapUser?.created_at
        ? new Date(window.docmapUser.created_at).getTime()
        : 0;

    const isNewAccount =
      createdAt > 0
      && Date.now() - createdAt < 48 * 60 * 60 * 1000;

    if(!forced && !isNewAccount) return false;

    if(!s.mode){ chooseMode(false); return true; }
    s.started=true; s.step=0; saveState(s);
    if(page!=="configuracoes"){
      location.replace(routeForStep(0,s));
      return true;
    }
    return false;
  }

  function activateTab(selector){
    const button=document.querySelector(selector);
    if(button) button.click();
  }

  function demoNode(host, html, className="onboarding-demo-block"){
    if(!host || host.querySelector(":scope > [data-onboarding-demo]")) return;
    const node=document.createElement("div");
    node.dataset.onboardingDemo="1";
    node.className=className;
    node.innerHTML=html;
    host.prepend(node);
  }

  function addScheduleDemo(){
    const deck=document.getElementById("deck-panel");
    if(deck) deck.hidden=false;
    demoNode(document.getElementById("deck-list"),
      '<article class="onboarding-mini-activity"><strong>Trauma abdominal</strong><small>Cirurgia Geral · aguardando programação</small></article><article class="onboarding-mini-activity"><strong>Diabetes mellitus</strong><small>Clínica Médica · aguardando programação</small></article>');

    const week=document.getElementById("week-planner");
    if(week && !week.querySelector("[data-onboarding-week-card]")){
      const examples=['Hipertensão arterial','Pneumonia comunitária','Apendicite aguda','Pré-natal de baixo risco','Vacinação do adulto'];
      const dayBodies=[...week.querySelectorAll(".planner-day-body")].slice(0,5);
      dayBodies.forEach((body,i)=>{
        body.querySelectorAll(".empty-planner").forEach(el=>el.style.display="none");
        const card=document.createElement("article");
        card.dataset.onboardingDemo="1";
        card.dataset.onboardingWeekCard="1";
        card.className="topic-card onboarding-week-topic";
        card.innerHTML='<div class="topic-card-head"><h3>'+examples[i]+'</h3></div><div class="topic-meta">Aula simulada · Onboarding</div>';
        body.prepend(card);
      });
    }

    const list=document.getElementById("theme-library-list");
    const names=['Hipertensão arterial','Pneumonia comunitária','Apendicite aguda','Pré-natal','Vacinação','Trauma abdominal','Diabetes mellitus','Asma','Hemorragia digestiva','Puericultura'];
    demoNode(list,names.map((x,i)=>'<div class="onboarding-list-row"><span><strong>'+x+'</strong><small>'+(i%2?'Clínica / revisão':'Onboarding · aula simulada')+'</small></span><span>'+(i<5?'Programada':'No deck')+'</span></div>').join(""));
  }

  function addNotebookDemo(){
    const list=document.querySelector("#notebook-topic-list, .notebook-topic-list");
    if(list && !list.querySelector("[data-onboarding-demo]")){
      const box=document.createElement("div");
      box.dataset.onboardingDemo="1";
      box.className="onboarding-demo-lessons";
      box.innerHTML='<div class="onboarding-demo-label">SIMULAÇÃO</div><button type="button">Onboarding — Hipertensão arterial</button><button type="button">Onboarding — Pneumonia</button><button type="button">Onboarding — Apendicite</button><button type="button">Onboarding — Diabetes</button><button type="button">Onboarding — Trauma</button>';
      list.prepend(box);
    }
    const editor=document.querySelector("#notebook-editor");
    if(editor && !editor.dataset.onboardingTouched){
      editor.dataset.onboardingTouched="1";
      editor.dataset.onboardingOriginal=editor.innerHTML;
      editor.innerHTML='<h2>Hipertensão arterial</h2><p><strong>Definição:</strong> condição clínica caracterizada por elevação sustentada da pressão arterial.</p><h3>Quadro clínico</h3><p>Exemplo de anotação organizada dentro do caderno da aula.</p><div class="notebook-divider arabesque" contenteditable="false"><span class="notebook-divider-luria" aria-hidden="true"></span></div><h3>Revisão</h3><p>Este conteúdo existe somente durante o onboarding.</p>';
    }
  }

  function addFlashDeckDemo(){
    const host=document.getElementById("library-decks");
    if(!host || host.querySelector("[data-onboarding-demo-decks]")) return;

    const wrap=document.createElement("div");
    wrap.dataset.onboardingDemo="1";
    wrap.dataset.onboardingDemoDecks="1";
    wrap.style.display="contents";
    wrap.innerHTML=[
      {
        area:"Clínica Médica",
        materia:"Cardiologia",
        theme:"Hipertensão",
        title:"Cardiologia · Hipertensão",
        count:12
      },
      {
        area:"Cirurgia Geral",
        materia:"Trauma",
        theme:"ATLS",
        title:"Cirurgia · Trauma",
        count:8
      },
      {
        area:"Pediatria",
        materia:"Puericultura",
        theme:"Crescimento",
        title:"Pediatria · Puericultura",
        count:10
      }
    ].map(deck=>`
      <article class="flash-deck-card" data-onboarding-demo="1">
        <div class="flash-deck-taxonomy">
          <span class="taxonomy-chip">${deck.area}</span>
          <span class="taxonomy-chip">${deck.materia}</span>
          <span class="taxonomy-chip accent">${deck.theme}</span>
        </div>
        <strong>${deck.title}</strong>
        <small>${deck.count} flashcards · demonstração</small>
        <div class="flash-deck-buttons">
          <button class="button primary" type="button" data-onboarding-demo-action>
            Revisar agora
          </button>
          <button class="button secondary" type="button" data-onboarding-demo-action>
            Compartilhar
          </button>
        </div>
      </article>
    `).join("");

    host.prepend(wrap);

    wrap.querySelectorAll("[data-onboarding-demo-action]").forEach(button=>{
      button.addEventListener("click",event=>{
        event.preventDefault();
        event.stopImmediatePropagation();
      },true);
    });
  }

  function addFlashDemo(){
    activateTab('[data-flash-tab="review"]');

    const stage=document.getElementById("review-stage");
    const empty=document.getElementById("review-empty");
    const answer=document.getElementById("review-answer");
    const ratings=document.getElementById("rating-actions");
    const showAnswer=document.getElementById("show-answer");
    const menu=document.querySelector(".review-card-menu-wrap");
    const status=document.getElementById("review-status");

    if(empty) empty.hidden=true;

    if(stage){
      stage.hidden=false;
      stage.dataset.onboardingDemo="1";
      stage.dataset.onboardingFlashcard="1";

      const area=document.getElementById("review-area");
      if(area){area.hidden=false;area.textContent="Clínica Médica";}

      const materia=document.getElementById("review-materia");
      if(materia){materia.hidden=false;materia.textContent="Cardiologia";}

      const theme=document.getElementById("review-theme");
      if(theme){theme.hidden=false;theme.textContent="Onboarding · Hipertensão";}

      const front=document.getElementById("review-front");
      if(front) front.textContent="Qual é a meta pressórica geral no tratamento da hipertensão arterial?";

      const back=document.getElementById("review-back");
      if(back) back.textContent="Em geral, busca-se pressão arterial abaixo de 130/80 mmHg quando bem tolerado, individualizando a meta conforme o perfil clínico.";

      const pos=document.getElementById("review-position");
      if(pos) pos.textContent="1 / 1";

      const session=document.getElementById("review-session-copy");
      if(session) session.textContent="flashcard de onboarding";

      if(answer) answer.hidden=true;
      if(ratings) ratings.hidden=true;
      if(showAnswer) showAnswer.hidden=false;
      if(menu) menu.hidden=true;
      if(status) status.textContent="";
    }

    document.querySelectorAll("#rating-actions [data-rating]").forEach(button=>{
      button.dataset.onboardingDemoRating="1";
      if(button.dataset.onboardingGuardBound==="1") return;
      button.dataset.onboardingGuardBound="1";
      button.addEventListener("click",event=>{
        if(button.dataset.onboardingDemoRating!=="1") return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const reviewStatus=document.getElementById("review-status");
        if(reviewStatus) reviewStatus.textContent="Demonstração concluída — nenhuma revisão real foi alterada.";
      },true);
    });

    const lib=document.getElementById("library-list");
    demoNode(
      lib,
      ['HAS: meta pressórica','Pneumonia: tratamento','Apendicite: diagnóstico','Diabetes: rastreio','Trauma: avaliação inicial']
        .map((x,i)=>'<article class="onboarding-demo-card"><small>FLASHCARD '+(i+1)+'</small><strong>'+x+'</strong><span>Cartão de demonstração</span></article>')
        .join("")
    );

    addFlashDeckDemo();
  }

  function addErrorDemo(){
    activateTab('[data-error-tab="review"]');

    const stage=document.getElementById("error-stage");
    if(stage) stage.hidden=false;

    const empty=document.getElementById("error-empty");
    if(empty) empty.hidden=true;

    const ccq=document.getElementById("error-ccq");
    if(ccq) ccq.textContent="Qual achado diferencia uma urgência hipertensiva de uma emergência hipertensiva?";

    const meta=document.getElementById("error-meta");
    if(meta) meta.textContent="Clínica Médica · Cardiologia · 1 de 12";

    const q=document.getElementById("error-question");
    if(q) q.textContent="Paciente com PA muito elevada. Qual elemento define emergência hipertensiva?";

    const a=document.getElementById("error-correct-answer");
    if(a) a.textContent="Lesão aguda de órgão-alvo.";

    const lib=document.getElementById("error-library");

    if(lib && !lib.querySelector("[data-onboarding-error-library]")){
      const wrap=document.createElement("div");
      wrap.dataset.onboardingDemo="1";
      wrap.dataset.onboardingErrorLibrary="1";
      wrap.className="onboarding-error-library-demo";

      const items=[
        {
          area:"Clínica Médica",
          materia:"Cardiologia",
          theme:"Emergência hipertensiva",
          ccq:"Qual achado define emergência hipertensiva?",
          answer:"Lesão aguda de órgão-alvo."
        },
        {
          area:"Clínica Médica",
          materia:"Pneumologia",
          theme:"Pneumonia comunitária",
          ccq:"Qual escore pode auxiliar na avaliação de gravidade da PAC?",
          answer:"CURB-65."
        },
        {
          area:"Cirurgia Geral",
          materia:"Abdome agudo",
          theme:"Apendicite",
          ccq:"Qual sinal clínico clássico pode ocorrer na apendicite?",
          answer:"Dor migratória para fossa ilíaca direita."
        },
        {
          area:"Ginecologia e Obstetrícia",
          materia:"Pré-natal",
          theme:"Diabetes gestacional",
          ccq:"Em que período costuma ser feito o TOTG 75 g quando indicado?",
          answer:"Entre 24 e 28 semanas."
        },
        {
          area:"Pediatria",
          materia:"Imunizações",
          theme:"Vacinação",
          ccq:"Qual é a lógica de revisar um erro no LURIA?",
          answer:"Recuperar ativamente a informação antes de conferir a resposta."
        },
        {
          area:"Clínica Médica",
          materia:"Endocrinologia",
          theme:"Cetoacidose diabética",
          ccq:"Qual alteração ácido-base é típica da cetoacidose diabética?",
          answer:"Acidose metabólica com ânion gap aumentado."
        },
        {
          area:"Cirurgia Geral",
          materia:"Trauma",
          theme:"Choque hemorrágico",
          ccq:"Qual é a prioridade inicial no choque hemorrágico do trauma?",
          answer:"Controle da hemorragia associado à ressuscitação hemodinâmica."
        },
        {
          area:"Pediatria",
          materia:"Neonatologia",
          theme:"Icterícia neonatal",
          ccq:"Quando a icterícia neonatal é considerada precoce?",
          answer:"Quando surge nas primeiras 24 horas de vida."
        },
        {
          area:"Ginecologia e Obstetrícia",
          materia:"Obstetrícia",
          theme:"Pré-eclâmpsia",
          ccq:"Qual achado pode caracterizar gravidade na pré-eclâmpsia?",
          answer:"PA ≥ 160/110 mmHg ou sinais de disfunção orgânica."
        },
        {
          area:"Preventiva",
          materia:"Epidemiologia",
          theme:"Rastreamento",
          ccq:"Qual medida representa a capacidade de um teste identificar doentes?",
          answer:"Sensibilidade."
        },
        {
          area:"Clínica Médica",
          materia:"Neurologia",
          theme:"AVC isquêmico",
          ccq:"Qual exame de imagem é prioritário na avaliação inicial do AVC agudo?",
          answer:"Tomografia de crânio sem contraste."
        },
        {
          area:"Cirurgia Geral",
          materia:"Hérnias",
          theme:"Hérnia encarcerada",
          ccq:"Qual achado sugere estrangulamento de uma hérnia encarcerada?",
          answer:"Dor intensa associada a sinais de sofrimento isquêmico."
        }
      ];

      wrap.innerHTML=items.map((item,index)=>`
        <article class="onboarding-demo-card onboarding-error-library-card">
          <div class="onboarding-error-library-head">
            <small>ERRO ${index+1}</small>
            <span>${item.area}</span>
          </div>
          <strong>${item.theme}</strong>
          <span>${item.materia}</span>
          <div class="onboarding-error-library-ccq">
            <small>CCQ</small>
            <p>${item.ccq}</p>
          </div>
          <div class="onboarding-error-library-answer">
            <small>Resposta</small>
            <p>${item.answer}</p>
          </div>
        </article>
      `).join("");

      lib.prepend(wrap);
    }
  }

  function addQuestionSetsDemo(){
    const host=document.getElementById("qs-history");
    if(!host || host.querySelector("[data-onboarding-simulations]")) return;

    const count=document.getElementById("qs-set-count");
    if(count){
      count.dataset.onboardingOriginalText=count.textContent || "";
      count.textContent="3 simulados de demonstração";
    }

    host.querySelectorAll(".qs-empty").forEach(el=>el.hidden=true);

    const wrap=document.createElement("div");
    wrap.dataset.onboardingDemo="1";
    wrap.dataset.onboardingSimulations="1";
    wrap.style.display="contents";

    const simulations=[
      {title:"Simulado ENARE · Clínica Médica",total:100,correct:78,wrong:22,accuracy:"78,0%"},
      {title:"Simulado Cirurgia Geral · Onboarding",total:80,correct:61,wrong:19,accuracy:"76,3%"},
      {title:"Simulado Misto · R1 Acesso Direto",total:100,correct:84,wrong:16,accuracy:"84,0%"}
    ];

    wrap.innerHTML=simulations.map((sim,index)=>`
      <article class="qs-set-card" data-onboarding-demo="1">
        <h3>${sim.title}</h3>
        <p>${sim.total} questões · demonstração</p>
        <div class="qs-set-metrics">
          <div><span>Acertos</span><strong>${sim.correct}</strong></div>
          <div><span>Erros</span><strong>${sim.wrong}</strong></div>
          <div><span>Acerto</span><strong>${sim.accuracy}</strong></div>
        </div>
        <div class="qs-set-actions">
          <button
            class="qs-mini-button primary"
            type="button"
            data-onboarding-simulation-open="${index}"
          >
            Abrir
          </button>
        </div>
      </article>
    `).join("");

    host.prepend(wrap);

    wrap.querySelectorAll("[data-onboarding-simulation-open]").forEach(button=>{
      button.addEventListener("click",event=>{
        event.preventDefault();
        event.stopImmediatePropagation();
        const panel=document.getElementById("qs-answer-panel");
        if(panel) panel.hidden=false;
        const title=document.getElementById("qs-current-title");
        const sim=simulations[Number(button.dataset.onboardingSimulationOpen)||0];
        if(title) title.textContent=sim.title;
        const total=document.getElementById("qs-summary-total");
        const correct=document.getElementById("qs-summary-correct");
        const wrong=document.getElementById("qs-summary-wrong");
        const accuracy=document.getElementById("qs-summary-accuracy");
        if(total) total.textContent=String(sim.total);
        if(correct) correct.textContent=String(sim.correct);
        if(wrong) wrong.textContent=String(sim.wrong);
        if(accuracy) accuracy.textContent=sim.accuracy;
      },true);
    });
  }

  const ONBOARDING_ECG_QUESTIONS = [
    "Qual é o ritmo cardíaco mais provável neste traçado?",
    "Qual é o diagnóstico eletrocardiográfico mais provável?",
    "O traçado abaixo é mais compatível com flutter atrial, fibrilação atrial, ritmo sinusal ou extrassístoles?",
    "Qual alteração melhor descreve este eletrocardiograma?",
    "O traçado é mais sugestivo de taquicardia ventricular, supraventricular, ritmo sinusal ou flutter?",
    "Qual alteração aguda deve ser reconhecida neste traçado?",
    "Qual distúrbio metabólico é sugerido por este traçado?",
    "Qual distúrbio de condução o traçado sugere?",
    "Qual é a principal interpretação deste traçado?",
    "Qual é o achado mais provável neste traçado?"
  ];

  function ensureQuestionsAddMode(){
    document.querySelector('[data-qs-mode="add"]')?.click();
    document.querySelector('[data-qs-section="add"]')?.classList.add("active");
    document.querySelector('[data-qs-mode="add"]')?.classList.add("active");
    document.querySelector('[data-qs-mode="mine"]')?.classList.remove("active");
  }

  function simulateOnboardingFileSelection(){
    ensureQuestionsAddMode();

    const fileName=document.getElementById("qs-file-name");
    const title=document.getElementById("qs-title");
    const extraction=document.getElementById("qs-extraction-mode");
    const source=document.getElementById("qs-source-profile");

    if(fileName) fileName.textContent="simulado_onbording_eletrocardiograma.pdf";
    if(title && !title.dataset.onboardingOriginalValue){
      title.dataset.onboardingOriginalValue=title.value || "";
      title.value="SIMULADO ONBORDING · Eletrocardiograma";
    }
    if(extraction) extraction.value="detailed";
    if(source) source.value="general";

    const status=document.getElementById("qs-import-status");
    if(status){
      status.dataset.onboardingOriginalText=status.textContent || "";
      status.textContent="PDF de demonstração selecionado · 10 questões";
      status.className="qs-status success";
    }
  }

  async function loadOnboardingPdfBytes(){
    if(window.__luriaOnboardingPdfBytes) return window.__luriaOnboardingPdfBytes;

    const response=await fetch("/assets/onboarding/simulado-onboarding.b64?v=1",{cache:"force-cache"});
    if(!response.ok) throw new Error("PDF de onboarding indisponível.");

    const base64=(await response.text()).replace(/\s+/g,"");
    const binary=atob(base64);
    const bytes=new Uint8Array(binary.length);

    for(let i=0;i<binary.length;i+=1){
      bytes[i]=binary.charCodeAt(i);
    }

    window.__luriaOnboardingPdfBytes=bytes;
    return bytes;
  }

  async function addOnboardingPdfPreview(){
    simulateOnboardingFileSelection();

    const automatic=document.querySelector('[data-qs-add-section="automatic"]');
    if(!automatic) return null;

    let host=document.getElementById("qs-onboarding-pdf-preview");
    if(host) return host;

    host=document.createElement("section");
    host.id="qs-onboarding-pdf-preview";
    host.dataset.onboardingDemo="1";
    host.className="onboarding-pdf-preview";
    host.innerHTML=`
      <div class="onboarding-pdf-preview-head">
        <div>
          <strong>SIMULADO ONBORDING · Eletrocardiograma</strong>
          <small>PDF de demonstração · 4 páginas · 10 questões</small>
        </div>
        <span>PDF</span>
      </div>
      <div class="onboarding-pdf-pages" data-onboarding-pdf-pages>
        <div class="onboarding-pdf-loading">Carregando visualização do PDF…</div>
      </div>
    `;

    automatic.appendChild(host);

    try{
      const bytes=await loadOnboardingPdfBytes();

      if(!window.pdfjsLib){
        throw new Error("Leitor de PDF não carregado.");
      }

      const doc=await window.pdfjsLib.getDocument({data:bytes.slice()}).promise;
      const pages=host.querySelector("[data-onboarding-pdf-pages]");
      pages.innerHTML="";

      for(let pageNumber=1;pageNumber<=doc.numPages;pageNumber+=1){
        const page=await doc.getPage(pageNumber);
        const rawViewport=page.getViewport({scale:1});
        const maxWidth=660;
        const scale=Math.min(1.12,maxWidth/rawViewport.width);
        const viewport=page.getViewport({scale});

        const pageWrap=document.createElement("div");
        pageWrap.className="onboarding-pdf-page";

        const canvas=document.createElement("canvas");
        canvas.width=Math.ceil(viewport.width);
        canvas.height=Math.ceil(viewport.height);
        canvas.setAttribute("aria-label",`Página ${pageNumber} do PDF de onboarding`);

        pageWrap.appendChild(canvas);
        pages.appendChild(pageWrap);

        await page.render({
          canvasContext:canvas.getContext("2d"),
          viewport
        }).promise;
      }
    }catch(error){
      console.warn("Não foi possível renderizar o PDF do onboarding:",error);
      const pages=host.querySelector("[data-onboarding-pdf-pages]");
      if(pages){
        pages.innerHTML='<div class="onboarding-pdf-loading">SIMULADO ONBORDING · Eletrocardiograma<br>10 questões prontas para extração.</div>';
      }
    }

    return host;
  }

  function animateOnboardingPdf(){
    addOnboardingPdfPreview().then(host=>{
      const scroller=host?.querySelector("[data-onboarding-pdf-pages]");
      if(!scroller) return;

      scroller.scrollTop=0;
      const max=()=>Math.max(0,scroller.scrollHeight-scroller.clientHeight);

      const checkpoints=[0,.28,.58,.86,1];
      checkpoints.forEach((point,index)=>{
        setTimeout(()=>{
          if(!document.body.contains(scroller)) return;
          scroller.scrollTo({
            top:max()*point,
            behavior:"smooth"
          });
        },index*900);
      });
    });
  }

  function moveAnswerPanelIntoAdd(){
    const panel=document.getElementById("qs-answer-panel");
    const addSection=document.querySelector('[data-qs-section="add"]');

    if(!panel || !addSection) return panel;

    if(!document.getElementById("qs-onboarding-answer-marker")){
      const marker=document.createElement("span");
      marker.id="qs-onboarding-answer-marker";
      marker.dataset.onboardingDemoMarker="1";
      marker.hidden=true;
      panel.parentNode?.insertBefore(marker,panel);
    }

    if(panel.parentNode!==addSection){
      addSection.appendChild(panel);
    }

    panel.hidden=false;
    panel.classList.add("active");
    panel.dataset.onboardingForcedActive="1";

    return panel;
  }

  function renderExtractedQuestionsDemo(applied=false){
    ensureQuestionsAddMode();
    simulateOnboardingFileSelection();

    const panel=moveAnswerPanelIntoAdd();
    if(!panel) return;

    const title=document.getElementById("qs-current-title");
    const total=document.getElementById("qs-summary-total");
    const correct=document.getElementById("qs-summary-correct");
    const wrong=document.getElementById("qs-summary-wrong");
    const accuracy=document.getElementById("qs-summary-accuracy");

    if(title) title.textContent="SIMULADO ONBORDING · Eletrocardiograma";
    if(total) total.textContent="10";
    if(correct) correct.textContent=applied ? "8" : "0";
    if(wrong) wrong.textContent=applied ? "2" : "0";
    if(accuracy) accuracy.textContent=applied ? "80%" : "—";

    const list=document.getElementById("qs-question-list");
    if(!list) return;

    list.querySelectorAll("[data-onboarding-extracted-questions]").forEach(el=>el.remove());

    const wrap=document.createElement("div");
    wrap.dataset.onboardingDemo="1";
    wrap.dataset.onboardingExtractedQuestions="1";

    wrap.innerHTML=ONBOARDING_ECG_QUESTIONS.map((text,index)=>{
      const number=index+1;
      const isWrong=applied && (number===2 || number===5);

      return `
        <article class="qs-question ${isWrong ? "wrong" : ""}" data-onboarding-question="${number}">
          <div class="qs-question-main">
            <span class="qs-number">${number}</span>
            <div class="qs-question-title">
              <strong>Questão ${number}</strong>
              <small>${text}</small>
            </div>
            <label class="qs-wrong-toggle">
              <input type="checkbox" ${isWrong ? "checked" : ""} tabindex="-1">
              <span>${applied ? (isWrong ? "Errei" : "Correta") : "Extraída"}</span>
            </label>
          </div>
          ${isWrong ? `
            <div class="qs-error-fields">
              <label class="full">
                <strong>Enviar ao Caderno de Erros</strong>
                <small>Esta questão pode virar um CCQ de revisão.</small>
              </label>
            </div>
          ` : ""}
        </article>
      `;
    }).join("");

    list.prepend(wrap);

    const status=document.getElementById("qs-answer-status");
    if(status){
      status.textContent=applied
        ? "Gabarito aplicado: 8 acertos e 2 erros."
        : "10 questões extraídas com sucesso.";
      status.className="qs-status success";
    }
  }

  function openOnboardingAnswerReader(showKey=false){
    ensureQuestionsAddMode();
    renderExtractedQuestionsDemo(false);

    const dialog=document.getElementById("qs-answer-import-dialog");
    if(!dialog) return;

    dialog.dataset.onboardingDemoDialog="1";
    dialog.setAttribute("open","");
    dialog.classList.add("onboarding-answer-reader-open");

    const preview=document.getElementById("qs-answer-screenshot-preview");
    const table=document.getElementById("qs-answer-import-table");
    const status=document.getElementById("qs-answer-import-status");
    const apply=document.getElementById("qs-apply-answer-import");

    if(preview){
      preview.innerHTML=`
        <div class="onboarding-answer-reader-file" data-onboarding-demo="1">
          <strong>gabarito_simulado_onbording.png</strong>
          <small>Imagem de demonstração carregada</small>
        </div>
      `;
    }

    if(showKey){
      const circles=Array.from({length:10},(_,i)=>{
        const number=i+1;
        const wrong=number===2 || number===5;
        return `<span class="onboarding-answer-circle ${wrong ? "wrong" : "correct"}">${number}</span>`;
      }).join("");

      if(table){
        table.innerHTML=`
          <div id="qs-onboarding-answer-key" class="onboarding-answer-key" data-onboarding-demo="1">
            <strong>Gabarito reconhecido</strong>
            <div>${circles}</div>
            <small>Vermelho = erro · Verde = acerto</small>
          </div>
        `;
      }

      if(status){
        status.textContent="10 questões reconhecidas · 8 acertos · 2 erros";
        status.className="qs-status success";
      }

      if(apply) apply.disabled=false;
    }else{
      if(table){
        table.innerHTML=`
          <div class="onboarding-answer-reader-hint" data-onboarding-demo="1">
            O leitor identifica os números e as cores do resultado antes de preencher o simulado.
          </div>
        `;
      }
      if(status){
        status.textContent="Imagem pronta para leitura.";
        status.className="qs-status";
      }
    }
  }

  function applyOnboardingAnswerKey(){
    const dialog=document.getElementById("qs-answer-import-dialog");
    if(dialog){
      dialog.removeAttribute("open");
      dialog.classList.remove("onboarding-answer-reader-open");
    }

    renderExtractedQuestionsDemo(true);

    const list=document.getElementById("qs-question-list");
    list?.scrollIntoView({behavior:"smooth",block:"center"});
  }

  function addQuestionsDemo(){
    addQuestionSetsDemo();
  }

  function addDemoData(kind){
    if(kind==="schedule") addScheduleDemo();
    if(kind==="notebook") addNotebookDemo();
    if(kind==="flashcards") addFlashDemo();
    if(kind==="errors") addErrorDemo();
    if(kind==="questions") addQuestionsDemo();
  }

  function runStepAction(step){
    if(step.action==="flash-review") activateTab('[data-flash-tab="review"]');
    if(step.action==="flash-answer"){
      activateTab('[data-flash-tab="review"]');
      const answer=document.getElementById("review-answer"); if(answer) answer.hidden=false;
      const ratings=document.getElementById("rating-actions"); if(ratings) ratings.hidden=false;
      const show=document.getElementById("show-answer"); if(show) show.hidden=true;
    }
    if(step.action==="flash-create") activateTab('[data-flash-tab="create"]');
    if(step.action==="flash-library"){
      activateTab('[data-flash-tab="library"]');
      setTimeout(addFlashDeckDemo,250);
      setTimeout(addFlashDeckDemo,700);
    }

    if(step.action==="error-review") activateTab('[data-error-tab="review"]');
    if(step.action==="error-create"){
      activateTab('[data-error-tab="create"]');
      const form=document.getElementById("error-create-form"); if(form) form.hidden=false;
    }
    if(step.action==="error-library") activateTab('[data-error-tab="library"]');

    if(step.action==="questions-mine"){
      document.querySelector('[data-qs-mode="mine"]')?.click();
      setTimeout(addQuestionSetsDemo,150);
      setTimeout(addQuestionSetsDemo,500);
    }

    if(step.action==="questions-create"){
      ensureQuestionsAddMode();

      if(step.title!=="Automático ou manual"){
        simulateOnboardingFileSelection();
      }
    }

    if(step.action==="questions-file"){
      ensureQuestionsAddMode();

      const fileLabel=document.querySelector('label[for="qs-file"]');
      if(fileLabel){
        fileLabel.dataset.onboardingPointerLocked="1";
        fileLabel.style.pointerEvents="none";
        fileLabel.classList.add("onboarding-demo-click");
      }

      setTimeout(()=>{
        fileLabel?.classList.remove("onboarding-demo-click");
        simulateOnboardingFileSelection();
        addOnboardingPdfPreview();
      },650);
    }

    if(step.action==="questions-pdf"){
      ensureQuestionsAddMode();
      simulateOnboardingFileSelection();
      animateOnboardingPdf();
    }

    if(step.action==="questions-extract"){
      ensureQuestionsAddMode();
      simulateOnboardingFileSelection();

      const button=document.getElementById("qs-import");
      if(button){
        button.dataset.onboardingDemoExtract="1";
        button.disabled=false;
        button.dataset.onboardingPointerLocked="1";
        button.style.pointerEvents="none";
      }

      const status=document.getElementById("qs-import-status");
      if(status){
        status.textContent="Pronto para extrair as 10 questões do PDF de demonstração.";
        status.className="qs-status";
      }
    }

    if(step.action==="questions-answer"){
      renderExtractedQuestionsDemo(false);
    }

    if(step.action==="questions-reader"){
      renderExtractedQuestionsDemo(false);

      const readerButton=document.getElementById("qs-open-answer-import");
      if(readerButton){
        readerButton.dataset.onboardingPointerLocked="1";
        readerButton.style.pointerEvents="none";
      }

      openOnboardingAnswerReader(false);
    }

    if(step.action==="questions-answerkey"){
      renderExtractedQuestionsDemo(false);
      openOnboardingAnswerReader(true);
    }

    if(step.action==="questions-applykey"){
      renderExtractedQuestionsDemo(false);
      openOnboardingAnswerReader(true);

      const apply=document.getElementById("qs-apply-answer-import");
      if(apply){
        apply.dataset.onboardingDemoApply="1";
        apply.disabled=false;
        apply.dataset.onboardingPointerLocked="1";
        apply.style.pointerEvents="none";
      }
    }

    if(step.action==="questions-applied"){
      ensureQuestionsAddMode();
      applyOnboardingAnswerKey();
    }

    if(step.action==="stats-tabs"){
      const tabs=[...document.querySelectorAll(".stats-tab")];
      tabs.forEach((tab,i)=>setTimeout(()=>tab.click(),i*500));
      setTimeout(()=>tabs[0]?.click(),Math.max(0,tabs.length)*500);
    }

    if(step.action==="exam-new" || step.action==="exam-dialog"){
      const d=document.getElementById("exam-dialog");

      if(d){
        if(d.open){
          try{ d.close(); }catch{}
        }

        // No onboarding o formulário é apenas exibido como demonstração.
        // Não usamos showModal(), pois dialogs modais entram na top layer
        // do navegador e ficam por cima do card do onboarding.
        d.setAttribute("open","");
        d.dataset.onboardingDemoDialog="1";
        d.classList.add("onboarding-exam-preview");
      }

      const inst=document.getElementById("exam-institution");
      if(inst && !inst.dataset.onboardingOriginalValue){
        inst.dataset.onboardingOriginalValue=inst.value || "";
        inst.value="Hospital LURIA — demonstração";
      }

      const board=document.getElementById("exam-board");
      if(board && !board.dataset.onboardingOriginalValue){
        board.dataset.onboardingOriginalValue=board.value || "";
        board.value="ENARE";
      }

      const score=document.getElementById("exam-score");
      if(score && !score.dataset.onboardingOriginalValue){
        score.dataset.onboardingOriginalValue=score.value || "";
        score.value="78";
      }

      const cutoff=document.getElementById("exam-cutoff");
      if(cutoff && !cutoff.dataset.onboardingOriginalValue){
        cutoff.dataset.onboardingOriginalValue=cutoff.value || "";
        cutoff.value="80";
      }
    }
  }

  function clearDemo(){
    document.querySelectorAll("[data-onboarding-demo],[data-onboarding-demo-card],[data-onboarding-demo-error]").forEach(el=>el.remove());
    document.querySelectorAll("[data-onboarding-demo-rating]").forEach(el=>el.removeAttribute("data-onboarding-demo-rating"));
    document.querySelectorAll("#week-planner .empty-planner").forEach(el=>el.style.removeProperty("display"));
    const editor=document.querySelector("#notebook-editor[data-onboarding-touched]");
    if(editor){ editor.innerHTML=editor.dataset.onboardingOriginal||""; editor.removeAttribute("data-onboarding-original"); editor.removeAttribute("data-onboarding-touched"); }
    const forcedAnswer=document.querySelector('[data-onboarding-forced-active="1"]');
    if(forcedAnswer){
      forcedAnswer.classList.remove("active");
      forcedAnswer.removeAttribute("data-onboarding-forced-active");
    }

    const answerMarker=document.getElementById("qs-onboarding-answer-marker");
    const answerPanel=document.getElementById("qs-answer-panel");
    if(answerMarker && answerPanel && answerMarker.parentNode){
      answerMarker.parentNode.insertBefore(answerPanel,answerMarker.nextSibling);
      answerMarker.remove();
    }

    const answerDialog=document.getElementById("qs-answer-import-dialog");
    if(answerDialog?.dataset.onboardingDemoDialog==="1"){
      answerDialog.removeAttribute("open");
      answerDialog.classList.remove("onboarding-answer-reader-open");
      delete answerDialog.dataset.onboardingDemoDialog;
    }

    const answerPreview=document.getElementById("qs-answer-screenshot-preview");
    const answerTable=document.getElementById("qs-answer-import-table");
    if(answerPreview) answerPreview.innerHTML="";
    if(answerTable) answerTable.innerHTML="";

    const applyAnswer=document.getElementById("qs-apply-answer-import");
    if(applyAnswer?.dataset.onboardingDemoApply==="1"){
      applyAnswer.disabled=true;
      delete applyAnswer.dataset.onboardingDemoApply;
    }

    document.querySelectorAll('[data-onboarding-pointer-locked="1"]').forEach(el=>{
      el.style.removeProperty("pointer-events");
      delete el.dataset.onboardingPointerLocked;
    });

    const extractButton=document.getElementById("qs-import");
    if(extractButton) delete extractButton.dataset.onboardingDemoExtract;

    const fileName=document.getElementById("qs-file-name");
    if(fileName?.textContent==="simulado_onbording_eletrocardiograma.pdf"){
      fileName.textContent="Selecione um PDF";
    }

    const qsTitle=document.getElementById("qs-title");
    if(qsTitle?.dataset.onboardingOriginalValue !== undefined){
      qsTitle.value=qsTitle.dataset.onboardingOriginalValue;
      delete qsTitle.dataset.onboardingOriginalValue;
    }

    const importStatus=document.getElementById("qs-import-status");
    if(importStatus?.dataset.onboardingOriginalText !== undefined){
      importStatus.textContent=importStatus.dataset.onboardingOriginalText;
      delete importStatus.dataset.onboardingOriginalText;
      importStatus.className="qs-status";
    }

    const qsCount=document.getElementById("qs-set-count");
    if(qsCount?.dataset.onboardingOriginalText !== undefined){
      qsCount.textContent=qsCount.dataset.onboardingOriginalText;
      delete qsCount.dataset.onboardingOriginalText;
    }
    const exam=document.getElementById("exam-dialog");
    if(exam?.dataset.onboardingDemoDialog==="1"){
      try{ if(exam.open) exam.close(); }catch{ exam.removeAttribute("open"); }
      exam.removeAttribute("open");
      exam.classList.remove("onboarding-exam-preview");
      delete exam.dataset.onboardingDemoDialog;
    }

    ["exam-institution","exam-board","exam-score","exam-cutoff"].forEach(id=>{
      const el=document.getElementById(id);
      if(el?.dataset.onboardingOriginalValue !== undefined){
        el.value=el.dataset.onboardingOriginalValue;
        delete el.dataset.onboardingOriginalValue;
      }
    });
  }

  function resolveTarget(selector){
    if(!selector) return null;
    for(const part of selector.split(",").map(x=>x.trim())){
      const el=document.querySelector(part);
      if(el && el.getBoundingClientRect().width>0) return el;
    }
    return null;
  }

  function render(){
    clearOverlay();
    const s=status();
    if(!s.started || s.completed || s.skipped) return;
    if(!s.phase) s.phase="explain";
    const steps=activeSteps(s);
    const step=steps[Math.min(s.step,steps.length-1)];
    if(!onCorrectPage(step)){
      const forced=new URLSearchParams(location.search).get("onboarding")==="1";
      if(forced) location.replace(routeForStep(s.step,s));
      return;
    }
    ensureStyles();
    if(step.demo) addDemoData(step.demo);
    runStepAction(step);

    const target=resolveTarget(step.target) || document.querySelector(".main") || document.body;
    if(step.scrollPageDown){
      requestAnimationFrame(()=>{
        window.scrollTo({
          top:Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight
          ),
          left:0,
          behavior:"smooth"
        });

        const examDialog=document.getElementById("exam-dialog");
        if(examDialog){
          examDialog.scrollTo({
            top:examDialog.scrollHeight,
            behavior:"smooth"
          });
        }
      });
    }else if(step.noScroll){
      window.scrollTo({top:0,left:0,behavior:"auto"});
    }else{
      target.scrollIntoView({behavior:"smooth",block:step.top?"start":"center"});
    }
    const liberated = s.phase==="explore";
    if(liberated){
      target.classList.remove("luria-onboarding-target");
      target.classList.add("luria-onboarding-target-clear");
      target.style.setProperty("box-shadow","0 0 0 2px color-mix(in srgb,var(--accent,#184888) 58%,transparent)","important");
      target.style.setProperty("filter","none","important");
      target.style.setProperty("opacity","1","important");
    }else{
      target.classList.remove("luria-onboarding-target-clear");
      target.classList.add("luria-onboarding-target");
      target.style.removeProperty("box-shadow");
      target.style.removeProperty("filter");
      target.style.removeProperty("opacity");
    }

    const overlay=document.createElement("div");
    overlay.id="luria-onboarding-overlay";
    overlay.classList.toggle("is-exploring",liberated);
    document.body.classList.toggle("luria-onboarding-exploring",liberated);
    overlay.classList.remove("card-top");
    overlay.innerHTML=`
      ${liberated ? "" : '<div class="luria-onboarding-dim"></div>'}
      <section class="luria-onboarding-card" role="dialog" aria-label="Onboarding LURIA">
        <div class="luria-onboarding-progress"><span>Conhecendo o LURIA</span><strong>${s.step+1} de ${steps.length}</strong></div>
        <div class="luria-onboarding-bar"><i style="width:${((s.step+1)/steps.length)*100}%"></i></div>
        <h2>${step.title}</h2>
        <p>${step.text}</p>
        
        <div class="luria-onboarding-actions">
          <button type="button" data-onboarding-skip>Pular onboarding</button>
          <div>
            <button type="button" data-onboarding-back ${s.step===0?"disabled":""}>Voltar</button>
            <button type="button" class="primary" data-onboarding-next>${step.finish?"Concluir":s.phase==="explain"?"Explorar":"Continuar"}</button>
          </div>
        </div>
      </section>`;
    document.body.appendChild(overlay);

    // O card fica embaixo por padrão. Só sobe quando cobrir o elemento
    // que está sendo explicado na parte inferior da tela.
    const onboardingCard=overlay.querySelector(".luria-onboarding-card");
    const placeOnboardingCard=()=>{
      overlay.classList.remove("card-top");

      if(step.forceCardTop){
        overlay.classList.add("card-top");
        return;
      }

      if(!onboardingCard || !target) return;

      const targetRect=target.getBoundingClientRect();
      const cardRect=onboardingCard.getBoundingClientRect();
      const bottomGap=Math.max(10,window.innerHeight-cardRect.top);
      const safetyGap=18;
      const wouldCoverTarget=
        targetRect.bottom > window.innerHeight-bottomGap-safetyGap
        && targetRect.top < window.innerHeight-safetyGap;

      if(wouldCoverTarget){
        overlay.classList.add("card-top");
      }
    };

    requestAnimationFrame(placeOnboardingCard);

    overlay.querySelector("[data-onboarding-skip]").onclick=()=>finish(true);
    overlay.querySelector("[data-onboarding-back]").onclick=()=>move(-1);
    overlay.querySelector("[data-onboarding-next]").onclick=()=>{
      if(step.finish) return finish(false);
      if(s.phase==="explain"){
        s.phase="explore"; saveState(s); render();
      } else {
        move(1);
      }
    };
  }

  function clearOverlay(){
    document.body.classList.remove("luria-onboarding-exploring");
    document.getElementById("luria-onboarding-overlay")?.remove();
    document.querySelectorAll(".luria-onboarding-target,.luria-onboarding-target-clear").forEach(el=>{
      el.classList.remove("luria-onboarding-target");
      el.classList.remove("luria-onboarding-target-clear");
      el.style.removeProperty("box-shadow");
      el.style.removeProperty("filter");
      el.style.removeProperty("opacity");
    });
  }

  function move(delta){
    const s=status();
    const steps=activeSteps(s);
    s.step=Math.max(0,Math.min(steps.length-1,s.step+delta)); s.phase="explain"; saveState(s);
    clearOverlay(); clearDemo();
    const next=stepAt(s.step,s);
    if(next.page!==page) location.href=routeForStep(s.step,s);
    else setTimeout(render,120);
  }

  function finish(skipped){
    const s=status(); s.completed=!skipped; s.skipped=skipped; s.started=false; saveState(s);
    clearOverlay(); clearDemo();
    location.href="/dashboard/";
  }

  function restart(event){
    event?.preventDefault?.();
    clearOverlay();
    clearDemo();
    const s={started:false,completed:false,skipped:false,step:0,phase:"explain",mode:null};
    saveState(s);

    if(page==="configuracoes"){
      chooseMode(true);
      return;
    }

    location.href="/configuracoes/?onboarding=1&restart=1";
  }

  function addRestartButton(){
    if(page!=="configuracoes") return;

    const nativeButton =
      document.getElementById("restart-luria-onboarding");

    if(nativeButton){
      nativeButton.onclick=restart;
      return;
    }

    if(document.querySelector("[data-restart-onboarding]")) return;
    const host=document.querySelector(".settings-page, .page");
    if(!host) return;
    const b=document.createElement("button");
    b.type="button"; b.dataset.restartOnboarding="1"; b.className="luria-restart-onboarding";
    b.textContent="Refazer onboarding";
    b.onclick=restart; host.appendChild(b);
  }

  function challengeState(){
    try{return JSON.parse(localStorage.getItem(CHALLENGE_PREFIX+userId())||"{}");}catch{return{};}
  }

  function saveChallenge(name){
    if(!name) return;
    const current=challengeState();
    if(current[name]) return;
    current[name]=true;
    try{ localStorage.setItem(CHALLENGE_PREFIX+userId(),JSON.stringify(current)); }catch{}
    document.getElementById("luria-discover-card")?.remove();
    renderChallenges();
  }

  function trackChallenges(){
    const s=status();
    if(!s.completed) return;

    if(page==="cronograma"){
      document.addEventListener("click",(e)=>{
        if(e.target.closest("button,.button,input[type=file]")) saveChallenge("schedule");
      },{once:true});
    }

    if(page==="caderno"){
      const editor=document.querySelector("#notebook-editor");
      editor?.addEventListener("input",()=>saveChallenge("notebook"),{once:true});
    }

    if(page==="flashcards"){
      document.addEventListener("click",(e)=>{
        const t=e.target.closest("button,.button");
        if(t && /salvar|criar|adicionar|novo/i.test(t.textContent||"")) saveChallenge("flashcards");
      });
    }

    if(page==="erros"){
      document.addEventListener("click",(e)=>{
        const t=e.target.closest("button,.button");
        if(t && /salvar|criar|adicionar/i.test(t.textContent||"")) saveChallenge("ccq");
      });
    }

    if(page==="questoes"){
      document.addEventListener("click",(e)=>{
        const t=e.target.closest("button,.button");
        if(t && /iniciar|lista|simulado|salvar/i.test(t.textContent||"")) saveChallenge("questions");
      });
    }

    if(page==="dashboard"){
      const value=Number(document.querySelector("[data-streak-value]")?.textContent||0);
      if(value>0) saveChallenge("streak");
    }
  }
  function renderChallenges(){
    if(page!=="dashboard") return;
    const s=status();
    if(!s.completed) return;
    if(document.getElementById("luria-discover-card")) return;
    const done=challengeState();
    const items=[
      ["schedule","Criar seu primeiro cronograma"],
      ["notebook","Criar ou preencher um caderno"],
      ["flashcards","Criar 5 flashcards"],
      ["ccq","Criar seu primeiro CCQ"],
      ["questions","Fazer uma lista de questões"],
      ["streak","Completar um dia de estudos"]
    ];
    const count=items.filter(([k])=>done[k]).length;
    const card=document.createElement("section");
    card.id="luria-discover-card"; card.className="panel luria-discover-card";
    card.innerHTML='<div class="luria-discover-head"><div><span class="eyebrow">Primeiros passos</span><h2>Conheça o LURIA</h2><p>Complete os desafios usando sua própria conta.</p></div><strong>'+count+' de 6</strong></div><div class="luria-discover-progress"><i style="width:'+(count/6*100)+'%"></i></div><div class="luria-discover-list">'+items.map(([k,l])=>'<div class="'+(done[k]?'done':'')+'"><span>'+(done[k]?'✓':'○')+'</span><span>'+l+'</span></div>').join("")+'</div>';
    const target=document.querySelector(".dashboard-page, .page");
    target?.insertBefore(card,target.children[1]||null);
  }

  const QUESTIONS_GUIDE = [
    {target:".qs-mode-tabs, .page-heading",title:"Visão geral",text:"Aqui você alterna entre o painel, adicionar simulado, seus simulados e a biblioteca."},
    {target:".qs-add-mode-tabs",title:"Automático ou manual",text:"Automático usa um PDF. Manual cria apenas a estrutura do simulado e o gabarito, sem precisar extrair questões."},
    {target:"#qs-extraction-mode",title:"Tipo de extração",text:"Rápida é mais ágil. Detalhada usa mais estratégias e é a indicada quando o PDF tem imagens, colunas ou diagramação complexa."},
    {target:"#qs-source-profile",title:"Origem do material",text:"Escolha o cursinho para adaptar o extrator ao padrão visual mais provável do PDF."},
    {target:"#qs-import",title:"Extrair questões",text:"Inicia a leitura do PDF. Depois confira a separação das questões antes de trabalhar com o gabarito."},
    {target:"#qs-open-answer-import",title:"Print do gabarito",text:"Use um print para o LURIA tentar identificar acertos, erros e anuladas automaticamente."},
    {target:"#qs-save-key",title:"Salvar gabarito",text:"Confirme as marcações. O que não estiver marcado como erro será considerado correto."},
    {target:"#qs-send-errors",title:"Caderno de Erros",text:"Envie somente os erros que você quer revisar. Antes do envio, você pode ajustar Área, Matéria, Tema e CCQ."}
  ];
  let questionsGuideIndex=0;
  function renderQuestionsGuide(){
    clearOverlay(); ensureStyles();
    const step=QUESTIONS_GUIDE[questionsGuideIndex];
    const target=resolveTarget(step.target)||document.querySelector(".main")||document.body;
    target.scrollIntoView({behavior:"smooth",block:"center"});
    target.classList.add("luria-onboarding-target");
    const overlay=document.createElement("div");
    overlay.id="luria-onboarding-overlay"; overlay.className="is-exploring";
    document.body.classList.add("luria-onboarding-exploring");
    overlay.innerHTML=`<section class="luria-onboarding-card" role="dialog" aria-label="Ajuda de simulados">
      <div class="luria-onboarding-progress"><span>Guia de Simulados</span><strong>${questionsGuideIndex+1} de ${QUESTIONS_GUIDE.length}</strong></div>
      <div class="luria-onboarding-bar"><i style="width:${((questionsGuideIndex+1)/QUESTIONS_GUIDE.length)*100}%"></i></div>
      <h2>${step.title}</h2><p>${step.text}</p>
      <small class="luria-onboarding-explore-note">A página permanece transparente e utilizável durante este guia.</small>
      <div class="luria-onboarding-actions"><button type="button" data-guide-close>Fechar</button><div><button type="button" data-guide-back ${questionsGuideIndex===0?"disabled":""}>Voltar</button><button type="button" class="primary" data-guide-next>${questionsGuideIndex===QUESTIONS_GUIDE.length-1?"Concluir":"Próximo"}</button></div></div>
    </section>`;
    document.body.appendChild(overlay);
    overlay.querySelector("[data-guide-close]").onclick=clearOverlay;
    overlay.querySelector("[data-guide-back]").onclick=()=>{questionsGuideIndex=Math.max(0,questionsGuideIndex-1);renderQuestionsGuide();};
    overlay.querySelector("[data-guide-next]").onclick=()=>{if(questionsGuideIndex>=QUESTIONS_GUIDE.length-1){clearOverlay();return;}questionsGuideIndex++;renderQuestionsGuide();};
  }
  function addQuestionsHelpButton(){
    if(page!=="questoes"||document.getElementById("qs-onboarding-help")) return;
    const host=document.querySelector(".qs-mode-tabs, .qs-tabs, .topbar");
    if(!host) return;
    const b=document.createElement("button");
    b.id="qs-onboarding-help"; b.type="button"; b.className="qs-onboarding-help"; b.textContent="Como funcionam os simulados?";
    b.onclick=()=>{questionsGuideIndex=0;renderQuestionsGuide();};
    host.appendChild(b);
  }

  document.addEventListener("click",event=>{
    const restartButton=event.target.closest?.("#restart-luria-onboarding,[data-restart-onboarding]");
    if(!restartButton) return;
    restart(event);
  });

  window.LuriaOnboarding={restart,startQuestionsGuide:()=>{questionsGuideIndex=0;renderQuestionsGuide();}};

  function syncStateFromUrl(){
    const params=new URLSearchParams(location.search);
    if(params.get("onboarding")!=="1") return;
    const rawStep=Number(params.get("step"));
    const mode=params.get("mode");
    const current=status();
    if(Number.isInteger(rawStep)&&rawStep>=0) current.step=rawStep;
    if(mode==="full"||mode==="summary") current.mode=mode;
    current.started=true;
    current.completed=false;
    current.skipped=false;
    if(!current.phase) current.phase="explain";
    saveState(current);
  }

  window.addEventListener("docmap:ready",()=>{
    ensureStyles();
    syncStateFromUrl();
    if(firstTimeRedirect()) return;
    addRestartButton();
    addQuestionsHelpButton();
    renderChallenges();
    trackChallenges();
    const s=status();
    const forced=new URLSearchParams(location.search).get("onboarding")==="1";
    if(forced && s.started && !s.completed && !s.skipped) setTimeout(render,650);
  });
})();