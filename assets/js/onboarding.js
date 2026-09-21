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
    {page:"configuracoes", target:".settings-page, .page", title:"Prepare o seu LURIA", text:"Começamos pelas configurações. Ajuste nome, especialidade, sexo, dias de estudo e preferências. Depois de ler, clique em Explorar para deixar a tela livre e configurar enquanto este texto continua visível.", top:true},
    {page:"configuracoes", target:".setting-row", title:"Seu perfil", text:"Preencha seus dados principais. No modo Explorar o fundo fica transparente e os campos continuam totalmente utilizáveis."},
    {page:"configuracoes", target:"[data-weekday], .weekday-grid, .study-days, .setting-row:nth-of-type(2)", title:"Dias de estudo", text:"Escolha em quais dias você quer estudar. O cronograma e as revisões respeitam essa disponibilidade."},
    {page:"configuracoes", target:".interval-editor, [data-interval-field]", title:"Revisões", text:"Defina os intervalos de revisão. O LURIA distribui as revisões dentro dos dias permitidos."},

    {page:"cronograma", target:".topbar, .page-heading", title:"Seu cronograma", text:"O cronograma é a base da organização do LURIA. Você pode importar o material do cursinho por PDF ou Excel, ou montar tudo manualmente.", top:true, demo:"schedule"},
    {page:"cronograma", target:"#file-drop, #schedule-file", title:"PDF, Excel ou manual", text:"PDF: envie o cronograma do cursinho. Excel: importe uma planilha estruturada. Manual: cadastre área, matéria, tema e data diretamente no LURIA. Em Explorar, você pode navegar por esses controles.", top:true, demo:"schedule"},
    {page:"cronograma", target:".import-mode, [name=import-mode], #manual-topic-form", title:"Como importar", text:"Você decide se as aulas entram já programadas ou no Deck. O cadastro manual serve para inserir uma aula por vez sem arquivo.", demo:"schedule"},
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
    {page:"erros", target:".error-review-panel, #error-stage", title:"Revisão dos erros", text:"O CCQ aparece primeiro para revisão ativa. Depois você pode abrir os detalhes da questão, resposta correta e raciocínio.", demo:"errors", action:"error-review"},
    {page:"erros", target:"[data-error-section=create], #error-create-form", title:"Novo Caderno de Erro", text:"No Novo erro você organiza Área, Matéria, Tema, CCQ, questão e resposta. Também pode anexar um print da questão.", demo:"errors", action:"error-create"},
    {page:"erros", target:"#new-error-image, #extract-error-image-text", title:"Extrair texto de um print", text:"Ao adicionar a imagem da questão, o botão Extrair texto pode transformar o conteúdo do print em texto para acelerar o registro do erro.", demo:"errors", action:"error-create"},
    {page:"erros", target:"[data-error-section=library], #error-library", title:"Biblioteca do Caderno de Erros", text:"Todos os erros ficam reunidos na Biblioteca, com busca, filtros, seleção e exportação.", demo:"errors", action:"error-library"},

    {page:"questoes", target:".qs-mode-tabs, .qs-tabs, .page-heading", title:"Questões e Simulados", text:"Vamos simular a criação de uma lista, a leitura das questões e o preenchimento do gabarito sem salvar nada na sua conta.", demo:"questions", action:"questions-create", top:true},
    {page:"questoes", target:"[data-qs-section=create], [data-qs-section=import], #qs-create-manual", title:"Adicionar questões", text:"Você pode criar um simulado manual ou importar material. A simulação abaixo mostra como as questões ficam depois de processadas.", demo:"questions", action:"questions-create"},
    {page:"questoes", target:"#qs-answer-panel, #qs-question-list", title:"Questões processadas", text:"Aqui estão questões simuladas. Você consegue ler o enunciado e visualizar como o LURIA separa cada item.", demo:"questions", action:"questions-answer"},
    {page:"questoes", target:"#qs-open-answer-import, #qs-question-list", title:"Gabarito e erros", text:"O print do gabarito pode ser lido e as respostas sinalizadas. Questões marcadas como erro abrem os campos usados para enviar conteúdo ao Caderno de Erros.", demo:"questions", action:"questions-key"},

    {page:"dashboard", target:".topbar, .page-heading", title:"Dashboard", text:"O Dashboard reúne agenda, revisões, métricas, CCQ e progresso. Ele é o ponto de partida depois da configuração.", top:true},
    {page:"dashboard", target:".calendar-panel, #calendar", title:"Agenda", text:"Aulas, flashcards, CCQs e revisões aparecem na mesma rotina. Você pode alternar entre Dia, Semana e Mês."},
    {page:"dashboard", target:"#dashboard-streak-card, [data-sidebar-streak-card]", title:"Ofensiva", text:"A ofensiva aparece tanto no Dashboard quanto no menu lateral. Ela registra sua sequência de dias de estudo; um dia pulado reinicia a sequência.", action:"streak"},

    {page:"estatisticas", target:".topbar, .page-heading", title:"Estatísticas", text:"Esta área transforma sua atividade em indicadores de desempenho, retenção, volume e pontos de atenção.", top:true},
    {page:"estatisticas", target:".stats-tabs", title:"Visões por recurso", text:"Este menu fica no topo. Durante a apresentação o LURIA percorre Geral, Aulas, Flashcards, Caderno de Erros e Questões para você visualizar cada painel.", action:"stats-tabs", top:true},

    {page:"editais", target:".exam-mode-tabs", title:"Editais e Provas", text:"Aqui você acompanha provas, inscrições, resultados e notas de corte. Vamos abrir Nova prova para mostrar cada campo.", action:"exam-new", top:true},
    {page:"editais", target:"#exam-dialog, #exam-form", title:"Nova prova", text:"Cadastre instituição, banca, status, datas, taxa, sua nota e a última nota de corte. Nada desta demonstração será salvo.", action:"exam-dialog"},
    {page:"editais", target:"#exam-score, #exam-cutoff", title:"Cores da nota", text:"A comparação usa a nota de corte como referência: vermelho quando sua nota fica mais de 2 pontos abaixo; amarelo quando fica na faixa de ±2 pontos; verde quando fica mais de 2 pontos acima.", action:"exam-dialog"},

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

  function routeForStep(i){ return ROUTES[STEPS[i]?.page] || "/dashboard/"; }
  function normalizePath(){ return location.pathname.replace(/\.html$/,"/").replace(/\/+/g,"/"); }
  function onCorrectPage(step){ return page === step.page; }

  function ensureStyles(){
    if(document.getElementById("luria-onboarding-css")) return;
    const l=document.createElement("link");
    l.id="luria-onboarding-css"; l.rel="stylesheet"; l.href="/assets/css/onboarding.css?v=1";
    document.head.appendChild(l);
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

    s.started=true; s.step=0; saveState(s);
    if(page!=="configuracoes"){
      location.replace("/configuracoes/?onboarding=1");
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
    demoNode(week,
      ['Seg · Hipertensão arterial','Ter · Pneumonia comunitária','Qua · Apendicite aguda','Qui · Pré-natal de baixo risco','Sex · Vacinação do adulto'].map((x,i)=>'<article class="onboarding-week-activity"><small>AULA '+(i+1)+'</small><strong>'+x+'</strong></article>').join(""));

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

  function addFlashDemo(){
    activateTab('[data-flash-tab="review"]');
    const stage=document.getElementById("review-stage");
    const empty=document.getElementById("review-empty");
    if(empty) empty.hidden=true;
    if(stage){
      stage.hidden=false;
      stage.dataset.onboardingDemo="1";
      const area=document.getElementById("review-area"); if(area){area.hidden=false;area.textContent="Clínica Médica";}
      const materia=document.getElementById("review-materia"); if(materia){materia.hidden=false;materia.textContent="Cardiologia";}
      const theme=document.getElementById("review-theme"); if(theme){theme.hidden=false;theme.textContent="Hipertensão";}
      const front=document.getElementById("review-front"); if(front) front.textContent="Qual é a meta pressórica geral no tratamento da hipertensão?";
      const back=document.getElementById("review-back"); if(back) back.textContent="Exemplo de resposta de demonstração. Classifique sua lembrança abaixo.";
      const pos=document.getElementById("review-position"); if(pos) pos.textContent="1 / 5";
    }
    const lib=document.getElementById("library-list");
    demoNode(lib,['HAS: meta pressórica','Pneumonia: tratamento','Apendicite: diagnóstico','Diabetes: rastreio','Trauma: avaliação inicial'].map((x,i)=>'<article class="onboarding-demo-card"><small>FLASHCARD '+(i+1)+'</small><strong>'+x+'</strong><span>Cartão de demonstração</span></article>').join(""));
  }

  function addErrorDemo(){
    activateTab('[data-error-tab="review"]');
    const stage=document.getElementById("error-stage"); if(stage) stage.hidden=false;
    const empty=document.getElementById("error-empty"); if(empty) empty.hidden=true;
    const ccq=document.getElementById("error-ccq"); if(ccq) ccq.textContent="Qual achado diferencia uma urgência hipertensiva de uma emergência hipertensiva?";
    const meta=document.getElementById("error-meta"); if(meta) meta.textContent="Clínica Médica · Cardiologia · 1 de 5";
    const q=document.getElementById("error-question"); if(q) q.textContent="Paciente com PA muito elevada. Qual elemento define emergência hipertensiva?";
    const a=document.getElementById("error-correct-answer"); if(a) a.textContent="Lesão aguda de órgão-alvo.";
    const lib=document.getElementById("error-library");
    demoNode(lib,['Emergência hipertensiva','CURB-65','Apendicite','DM gestacional','Vacinação'].map((x,i)=>'<article class="onboarding-demo-card"><small>ERRO '+(i+1)+'</small><strong>'+x+'</strong><span>CCQ de demonstração · revisão programada</span></article>').join(""));
  }

  function addQuestionsDemo(){
    const panel=document.getElementById("qs-answer-panel");
    if(panel){panel.hidden=false;panel.dataset.onboardingDemo="1";}
    const title=document.getElementById("qs-current-title"); if(title) title.textContent="Simulado de onboarding";
    const total=document.getElementById("qs-summary-total"); if(total) total.textContent="5";
    const correct=document.getElementById("qs-summary-correct"); if(correct) correct.textContent="3";
    const wrong=document.getElementById("qs-summary-wrong"); if(wrong) wrong.textContent="2";
    const acc=document.getElementById("qs-summary-accuracy"); if(acc) acc.textContent="60%";
    const list=document.getElementById("qs-question-list");
    if(list && !list.querySelector("[data-onboarding-demo]")){
      const wrap=document.createElement("div"); wrap.dataset.onboardingDemo="1";
      const qs=[
        ["1","Paciente hipertenso apresenta déficit neurológico agudo. Qual a prioridade inicial?","wrong"],
        ["2","Qual é o agente mais comum da pneumonia adquirida na comunidade?",""],
        ["3","Dor migratória para FID sugere qual diagnóstico?","wrong"],
        ["4","Quando iniciar rastreio para diabetes em adultos de risco?",""],
        ["5","Qual é a primeira etapa da avaliação primária no trauma?",""]
      ];
      wrap.innerHTML=qs.map(([n,t,w])=>'<article class="qs-question '+w+'"><div class="qs-question-main"><span class="qs-number">'+n+'</span><div class="qs-question-title"><strong>Questão '+n+'</strong><small>'+t+'</small></div><label class="qs-wrong-toggle"><input type="checkbox" '+(w?'checked':'')+'><span>'+(w?'Errei':'Correta')+'</span></label></div>'+(w?'<div class="qs-error-fields"><label class="full"><strong>Enviar ao Caderno de Erros</strong><small>Área, matéria, CCQ e explicação aparecem aqui.</small></label></div>':'')+'</article>').join("");
      list.prepend(wrap);
    }
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
    if(step.action==="flash-library") activateTab('[data-flash-tab="library"]');

    if(step.action==="error-review") activateTab('[data-error-tab="review"]');
    if(step.action==="error-create"){
      activateTab('[data-error-tab="create"]');
      const form=document.getElementById("error-create-form"); if(form) form.hidden=false;
    }
    if(step.action==="error-library") activateTab('[data-error-tab="library"]');

    if(step.action==="questions-create"){
      const btn=document.querySelector('[data-qs-mode="create"],[data-qs-tab="create"],[data-qs-mode="new"]'); btn?.click();
    }
    if(step.action==="questions-answer"||step.action==="questions-key") addQuestionsDemo();

    if(step.action==="stats-tabs"){
      const tabs=[...document.querySelectorAll(".stats-tab")];
      tabs.forEach((tab,i)=>setTimeout(()=>tab.click(),i*500));
      setTimeout(()=>tabs[0]?.click(),Math.max(0,tabs.length)*500);
    }

    if(step.action==="exam-new"){
      document.querySelector('[data-exam-mode="new"]')?.click();
      setTimeout(()=>{const d=document.getElementById("exam-dialog"); if(d&&!d.open){try{d.showModal();}catch{d.setAttribute("open","");}}},150);
    }
    if(step.action==="exam-dialog"){
      const d=document.getElementById("exam-dialog"); if(d&&!d.open){try{d.showModal();}catch{d.setAttribute("open","");}}
      const inst=document.getElementById("exam-institution"); if(inst&&!inst.value) inst.value="Hospital LURIA — demonstração";
      const board=document.getElementById("exam-board"); if(board&&!board.value) board.value="ENARE";
      const score=document.getElementById("exam-score"); if(score&&!score.value) score.value="78";
      const cutoff=document.getElementById("exam-cutoff"); if(cutoff&&!cutoff.value) cutoff.value="80";
    }
  }

  function clearDemo(){
    document.querySelectorAll("[data-onboarding-demo],[data-onboarding-demo-card],[data-onboarding-demo-error]").forEach(el=>el.remove());
    const editor=document.querySelector("#notebook-editor[data-onboarding-touched]");
    if(editor){ editor.innerHTML=editor.dataset.onboardingOriginal||""; editor.removeAttribute("data-onboarding-original"); editor.removeAttribute("data-onboarding-touched"); }
    const exam=document.getElementById("exam-dialog");
    if(exam?.open){try{exam.close();}catch{}}
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
    const step=STEPS[Math.min(s.step,STEPS.length-1)];
    if(!onCorrectPage(step)){
      location.replace(routeForStep(s.step)+"?onboarding=1");
      return;
    }
    ensureStyles();
    if(step.demo) addDemoData(step.demo);
    runStepAction(step);

    const target=resolveTarget(step.target) || document.querySelector(".main") || document.body;
    target.scrollIntoView({behavior:"smooth",block:step.top?"start":"center"});
    target.classList.add("luria-onboarding-target");

    const overlay=document.createElement("div");
    overlay.id="luria-onboarding-overlay";
    overlay.classList.toggle("is-exploring",s.phase==="explore");
    overlay.classList.toggle("card-top",!!step.top);
    overlay.innerHTML=`
      <div class="luria-onboarding-dim"></div>
      <section class="luria-onboarding-card" role="dialog" aria-label="Onboarding LURIA">
        <div class="luria-onboarding-progress"><span>Conhecendo o LURIA</span><strong>${s.step+1} de ${STEPS.length}</strong></div>
        <div class="luria-onboarding-bar"><i style="width:${((s.step+1)/STEPS.length)*100}%"></i></div>
        <h2>${step.title}</h2>
        <p>${step.text}</p>
        ${s.phase==="explore"?'<small class="luria-onboarding-explore-note">Tela liberada: você pode clicar, ler e configurar normalmente.</small>':""}
        <div class="luria-onboarding-actions">
          <button type="button" data-onboarding-skip>Pular onboarding</button>
          <div>
            <button type="button" data-onboarding-back ${s.step===0?"disabled":""}>Voltar</button>
            <button type="button" class="primary" data-onboarding-next>${step.finish?"Concluir":s.phase==="explain"?"Explorar":"Continuar"}</button>
          </div>
        </div>
      </section>`;
    document.body.appendChild(overlay);

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
    document.getElementById("luria-onboarding-overlay")?.remove();
    document.querySelectorAll(".luria-onboarding-target").forEach(el=>el.classList.remove("luria-onboarding-target"));
  }

  function move(delta){
    const s=status();
    s.step=Math.max(0,Math.min(STEPS.length-1,s.step+delta)); s.phase="explain"; saveState(s);
    clearOverlay(); clearDemo();
    const next=STEPS[s.step];
    if(next.page!==page) location.href=routeForStep(s.step)+"?onboarding=1";
    else setTimeout(render,120);
  }

  function finish(skipped){
    const s=status(); s.completed=!skipped; s.skipped=skipped; s.started=false; saveState(s);
    clearOverlay(); clearDemo();
    location.href="/dashboard/";
  }

  function restart(){
    const s={started:true,completed:false,skipped:false,step:0}; saveState(s);
    location.href="/configuracoes/?onboarding=1";
  }

  function addRestartButton(){
    if(page!=="configuracoes") return;

    const nativeButton =
      document.getElementById("restart-luria-onboarding");

    if(nativeButton){
      nativeButton.addEventListener("click", restart);
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

  window.LuriaOnboarding={restart};

  window.addEventListener("docmap:ready",()=>{
    ensureStyles();
    if(firstTimeRedirect()) return;
    addRestartButton();
    renderChallenges();
    trackChallenges();
    const s=status();
    if(s.started && !s.completed && !s.skipped) setTimeout(render,650);
  });
})();