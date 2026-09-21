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
    {page:"configuracoes", target:".settings-page, .page", title:"Prepare o seu LURIA", text:"Começamos pelas configurações. Ajuste seu nome, especialidade, sexo, dias de estudo e preferências de revisão. O LURIA usa essas escolhas para adaptar sua rotina."},
    {page:"configuracoes", target:".setting-row", title:"Seu perfil", text:"Preencha seus dados principais. Eles personalizam sua conta e deixam a navegação com a sua cara."},
    {page:"configuracoes", target:"[data-weekday], .weekday-grid, .study-days, .setting-row:nth-of-type(2)", title:"Dias de estudo", text:"Escolha em quais dias você quer estudar. O cronograma e as revisões respeitam essa disponibilidade."},
    {page:"configuracoes", target:".interval-editor, [data-interval-field]", title:"Revisões", text:"Aqui você define os intervalos de revisão. O LURIA distribui as revisões automaticamente dentro dos dias permitidos."},

    {page:"cronograma", target:".page, .schedule-page", title:"Seu cronograma", text:"O cronograma é a base da organização do LURIA. Você pode importar o material do seu cursinho ou montar tudo manualmente."},
    {page:"cronograma", target:"input[type=file], .import-card, .schedule-import, [id*=upload], [id*=import]", title:"PDF, Excel ou manual", text:"Você pode subir o PDF do cursinho, importar uma planilha Excel ou cadastrar aulas manualmente. Escolha o caminho que combina com seu material."},
    {page:"cronograma", target:"[id*=modality], [class*=modality], [id*=modalidade], [class*=modalidade]", title:"Modalidades", text:"Modalidades separam diferentes objetivos ou trilhas de estudo. Use-as quando quiser organizar cronogramas distintos sem misturar os conteúdos."},
    {page:"cronograma", target:"[id*=deck], [class*=deck]", title:"Deck", text:"O Deck reúne aulas ou temas que você quer separar do fluxo principal. É útil para montar blocos personalizados de estudo e revisão."},
    {page:"cronograma", target:"[id*=list], [class*=theme-library], [class*=list]", title:"Lista de aulas", text:"A lista mostra suas aulas e permite filtrar, selecionar, editar, excluir, marcar como feita e organizar conteúdos em conjunto."},
    {page:"cronograma", target:"button, .button", title:"Ações do cronograma", text:"Os botões do cronograma servem para criar, importar, filtrar, editar e reorganizar suas aulas. Durante o uso, o LURIA mantém agenda e revisões sincronizadas."},

    {page:"caderno", target:".notebook-topic-panel, #notebook-topic-list", title:"Aulas na lateral", text:"As aulas do seu cronograma aparecem nesta lateral. Durante o onboarding, incluímos aulas de simulação para você entender o fluxo." , demo:"notebook"},
    {page:"caderno", target:"#notebook-editor, .notebook-document", title:"Caderno da aula", text:"Ao abrir uma aula, o caderno correspondente aparece aqui. Você pode estudar, anotar e organizar o conteúdo sem sair do fluxo da aula.", demo:"notebook"},
    {page:"caderno", target:".notebook-toolbar", title:"Ferramentas do caderno", text:"Use estilos de texto, fonte, alinhamento, listas, estruturas prontas, linhas, tabelas, imagens, emojis e callouts. As linhas divisórias são blocos fixos para não serem quebradas acidentalmente.", demo:"notebook"},

    {page:"flashcards", target:".page, .flashcards-page", title:"Flashcards", text:"Crie cartões por área e matéria. Depois, o LURIA organiza as revisões e mostra o que precisa ser revisto na Agenda.", demo:"flashcards"},
    {page:"flashcards", target:"[class*=flashcard], [id*=flashcard]", title:"Revisão ativa", text:"Abra, responda mentalmente e revele a resposta. Os cartões de demonstração existem apenas para você experimentar o funcionamento.", demo:"flashcards"},

    {page:"erros", target:".page, .error-notebook-page", title:"Caderno de erros", text:"Transforme erros em material de revisão. Salve a questão, explicação, imagem e CCQ para revisar depois.", demo:"errors"},
    {page:"erros", target:"[id*=ccq], [class*=ccq], form", title:"CCQ", text:"O CCQ resume o ponto que você errou em uma pergunta curta de revisão. Ele reaparece na sua rotina e também pode ser exibido no Dashboard.", demo:"errors"},

    {page:"questoes", target:".page, .questions-page", title:"Questões e Simulados", text:"Aqui você cria listas, registra questões e acompanha simulados. Os erros podem ser enviados diretamente para o Caderno de Erros."},
    {page:"questoes", target:"input[type=file], [id*=pdf], [id*=gabarito], [class*=upload]", title:"Importação", text:"Quando disponível, você pode importar o PDF e o gabarito. O LURIA processa as questões e usa o resultado para alimentar suas métricas e revisões."},
    {page:"questoes", target:"button, .button", title:"Listas e simulados", text:"Use listas para blocos de questões e simulados para sessões completas. Você pode acompanhar acertos, erros e evolução ao longo do tempo."},

    {page:"dashboard", target:".page, .dashboard-page", title:"Dashboard", text:"O Dashboard reúne o que importa hoje: agenda, revisões, métricas e CCQ. Ele é o ponto de partida depois que seu LURIA está configurado."},
    {page:"dashboard", target:".calendar-panel, #calendar", title:"Agenda", text:"Tudo que o LURIA agenda aparece aqui. Aulas, flashcards, CCQs e revisões ficam concentrados na mesma rotina."},
    {page:"dashboard", target:"[data-sidebar-streak-card], .streak-card, [id*=streak]", title:"Ofensiva", text:"A ofensiva registra sua sequência de dias de estudo. Estude em dias consecutivos para mantê-la; ao passar um dia sem atividade, a sequência é reiniciada."},

    {page:"estatisticas", target:".page, .stats-page", title:"Estatísticas", text:"Conforme você usa o LURIA, esta área transforma sua atividade em indicadores de desempenho, retenção, volume e pontos de atenção."},
    {page:"estatisticas", target:"[data-stats-panel], .stats-tabs, .segmented-control", title:"Visões por recurso", text:"Alterne entre a visão geral e as estatísticas específicas de aulas, flashcards, Caderno de Erros e questões."},

    {page:"editais", target:".page", title:"Editais e Provas", text:"Organize seus processos seletivos, acompanhe provas, notas e referências de corte em um único lugar."},

    {page:"amigos", target:".friends-card:first-of-type", title:"Amigos", text:"Cada usuário possui um ID LURIA. Adicione seus amigos por esse código e compartilhe materiais diretamente com eles."},
    {page:"amigos", target:".friends-card:last-of-type", title:"Materiais recebidos", text:"Decks de flashcards e cadernos enviados por amigos ficam reunidos aqui para você aceitar e usar."},

    {page:"dashboard", target:".page, .dashboard-page", title:"Seu LURIA está pronto", text:"O tour terminou. Os conteúdos de demonstração desaparecem e começa a etapa Conheça o LURIA: 6 desafios para transformar o tutorial em uso real.", finish:true}
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

  function addDemoData(kind){
    if(kind==="notebook"){
      const list=document.querySelector("#notebook-topic-list, .notebook-topic-list");
      if(list && !list.querySelector("[data-onboarding-demo]")){
        const box=document.createElement("div");
        box.dataset.onboardingDemo="1";
        box.className="onboarding-demo-lessons";
        box.innerHTML='<div class="onboarding-demo-label">SIMULAÇÃO</div><button type="button">Onboarding — Hipertensão arterial</button><button type="button">Onboarding — Pneumonia</button><button type="button">Onboarding — Apendicite</button>';
        list.prepend(box);
      }
      const editor=document.querySelector("#notebook-editor");
      if(editor && !editor.textContent.trim()){
        editor.dataset.onboardingOriginal="";
        editor.innerHTML='<h2>Hipertensão arterial</h2><p><strong>Definição:</strong> exemplo de como suas anotações podem ficar organizadas dentro do LURIA.</p><div class="notebook-study-block"><strong>Quadro clínico</strong><p>Use estruturas, tabelas, imagens e callouts para organizar o estudo.</p></div><div class="notebook-divider arabesque" contenteditable="false"><span class="notebook-divider-luria" aria-hidden="true"></span></div><p><strong>Revisão:</strong> este é apenas um conteúdo de demonstração do onboarding.</p>';
      }
    }
    if(kind==="flashcards"){
      const host=document.querySelector(".flashcards-page, .page");
      if(host && !host.querySelector("[data-onboarding-demo-card]")){
        const card=document.createElement("div"); card.dataset.onboardingDemoCard="1"; card.className="onboarding-demo-card";
        card.innerHTML='<small>SIMULAÇÃO</small><strong>Qual é o objetivo dos flashcards no LURIA?</strong><span>Revisão ativa e espaçada dos conteúdos que você quer consolidar.</span>';
        host.appendChild(card);
      }
    }
    if(kind==="errors"){
      const host=document.querySelector(".error-notebook-page, .page");
      if(host && !host.querySelector("[data-onboarding-demo-error]")){
        const card=document.createElement("div"); card.dataset.onboardingDemoError="1"; card.className="onboarding-demo-card";
        card.innerHTML='<small>SIMULAÇÃO</small><strong>CCQ: Qual foi o principal conceito que levou ao erro?</strong><span>Exemplo de CCQ criado a partir de uma questão errada.</span>';
        host.appendChild(card);
      }
    }
  }

  function clearDemo(){
    document.querySelectorAll("[data-onboarding-demo],[data-onboarding-demo-card],[data-onboarding-demo-error]").forEach(el=>el.remove());
    const editor=document.querySelector("#notebook-editor[data-onboarding-original]");
    if(editor){ editor.innerHTML=""; editor.removeAttribute("data-onboarding-original"); }
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
    const step=STEPS[Math.min(s.step,STEPS.length-1)];
    if(!onCorrectPage(step)){
      location.replace(routeForStep(s.step)+"?onboarding=1");
      return;
    }
    ensureStyles();
    if(step.demo) addDemoData(step.demo);

    const target=resolveTarget(step.target) || document.querySelector(".main") || document.body;
    target.scrollIntoView({behavior:"smooth",block:"center"});
    target.classList.add("luria-onboarding-target");

    const overlay=document.createElement("div");
    overlay.id="luria-onboarding-overlay";
    overlay.innerHTML=`
      <div class="luria-onboarding-dim"></div>
      <section class="luria-onboarding-card" role="dialog" aria-modal="true" aria-label="Onboarding LURIA">
        <div class="luria-onboarding-progress"><span>Conhecendo o LURIA</span><strong>${s.step+1} de ${STEPS.length}</strong></div>
        <div class="luria-onboarding-bar"><i style="width:${((s.step+1)/STEPS.length)*100}%"></i></div>
        <h2>${step.title}</h2>
        <p>${step.text}</p>
        <div class="luria-onboarding-actions">
          <button type="button" data-onboarding-skip>Pular onboarding</button>
          <div>
            <button type="button" data-onboarding-back ${s.step===0?"disabled":""}>Voltar</button>
            <button type="button" class="primary" data-onboarding-next>${step.finish?"Concluir":"Próximo"}</button>
          </div>
        </div>
      </section>`;
    document.body.appendChild(overlay);

    overlay.querySelector("[data-onboarding-skip]").onclick=()=>finish(true);
    overlay.querySelector("[data-onboarding-back]").onclick=()=>move(-1);
    overlay.querySelector("[data-onboarding-next]").onclick=()=>step.finish?finish(false):move(1);
  }

  function clearOverlay(){
    document.getElementById("luria-onboarding-overlay")?.remove();
    document.querySelectorAll(".luria-onboarding-target").forEach(el=>el.classList.remove("luria-onboarding-target"));
  }

  function move(delta){
    const s=status();
    s.step=Math.max(0,Math.min(STEPS.length-1,s.step+delta)); saveState(s);
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
    if(page!=="configuracoes" || document.querySelector("[data-restart-onboarding]")) return;
    const host=document.querySelector(".settings-page, .page");
    if(!host) return;
    const b=document.createElement("button");
    b.type="button"; b.dataset.restartOnboarding="1"; b.className="luria-restart-onboarding";
    b.textContent="Refazer onboarding do LURIA";
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