(() => {
  "use strict";

  const E=window.PlantaoEngine;
  const sb = window.supabaseClient;
  if (!sb) return;

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");

  const CATEGORY_LABELS = {
    anamnese:"Anamnese",
    exame:"Exame físico",
    exames:"Exames",
    laboratorio:"Laboratório",
    imagem:"Imagem",
    monitorizacao:"Monitorização",
    procedimentos:"Procedimentos",
    tratamento:"Tratamento",
    raciocinio:"Raciocínio"
  };

  const state = {
    user:null,
    cases:[],
    sessions:[],
    current:null,
    session:null,
    elapsed:0,
    score:0,
    vitals:{},
    performed:[],
    outcomes:[],
    triggered:[],
    log:[],
    sequenceViolations:[],
    monitorOn:false,
    harmfulCount:0,
    dead:false,
    deathReason:"",
    fetalHarmCount:0,
    fetalDeath:false,
    fetalStatus:"",
    clinicalEvents:[],
    category:null,
    examTab:"gerais",
    penalties:0, criticalElapsed:0, diagnosis:null, disposition:null, busy:false,
    phoneCases:[], phoneCase:null, phoneSession:null, phoneTurn:0, phoneMode:false, phoneUsedChoices:new Set(),
    filters:{specialty:"",difficulty:""}
  };

  function fmtTime(minutes) {
    const total = Math.max(0, Math.round(Number(minutes||0)*60));
    return String(Math.floor(total/60)).padStart(2,"0")+":"+String(total%60).padStart(2,"0");
  }

  function show(section) {
    ["plantao-library","plantao-simulator","plantao-debrief"].forEach(id => {
      const el=$(id);
      if (el) el.hidden = id !== section;
    });
    window.scrollTo({top:0,behavior:"smooth"});
  }

  async function load() {
    const {data:{user}} = await sb.auth.getUser();
    if (!user) return;
    state.user=user;

    // A navegação do Plantão não pode depender de uma RPC opcional: se a checagem
    // de acesso falhar, a Sala de emergência deve continuar abrindo normalmente.
    let phoneAllowed = true;
    try {
      const accessRes = await sb.rpc("has_interconsultation_access");
      if (!accessRes.error && typeof accessRes.data === "boolean") phoneAllowed = accessRes.data;
    } catch (error) {
      console.warn("Plantão: checagem do Telefone indisponível; mantendo a navegação funcional.", error);
    }
    const phoneModeCard = $("plantao-phone-mode-card");
    const phoneSection = $("plantao-telefone");
    if (phoneModeCard) phoneModeCard.hidden = !phoneAllowed;
    if (phoneSection) phoneSection.hidden = true;

    if(phoneAllowed){
      const phoneCasesRes=await sb.from("interconsultation_cases")
        .select("id,slug,title,specialty,difficulty,requester_role,opening_message,known_by_requester")
        .eq("active",true)
        .order("created_at",{ascending:true});
      state.phoneCases=phoneCasesRes.error ? [] : (phoneCasesRes.data||[]);
      renderPhoneCases();
    }

    // Biblioteca leve: carrega somente metadados. O conteúdo clínico completo
    // é buscado sob demanda quando o usuário realmente inicia a estação.
    let casesRes=await sb.rpc("list_active_clinical_case_summaries");
    if(casesRes.error){
      console.warn("Plantão: RPC leve indisponível; usando apenas metadados por leitura direta.",casesRes.error);
      casesRes=await sb.from("clinical_cases")
        .select("id,slug,title,setting,specialty,difficulty,summary,presentation,version")
        .eq("active",true).order("title");
    }
    if(casesRes.error){
      console.error("Plantão: falha ao carregar índice de casos",casesRes.error);
      $("plantao-empty").hidden=false;
      $("plantao-empty").textContent="Não foi possível carregar os casos clínicos.";
      return;
    }
    state.cases=Array.isArray(casesRes.data)?casesRes.data:[];

    const sessionsRes = await sb.from("clinical_case_sessions")
      .select("id,case_id,status,started_at,completed_at,score,result,attempt_count")
      .eq("user_id",user.id)
      .eq("status","completed")
      .order("started_at",{ascending:false})
      .limit(100);
    state.sessions=sessionsRes.error ? [] : (sessionsRes.data || []);
    // Remove resíduos de atendimentos interrompidos em fechamentos/reloads anteriores.
    const cleanup=await sb.from("clinical_case_sessions")
      .delete()
      .eq("user_id",user.id)
      .neq("status","completed");
    if(cleanup.error) console.warn("Plantão: limpeza de sessões incompletas pendente",cleanup.error);
    const specialties=[...new Set(state.cases.map(x=>x.specialty).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"pt-BR"));
    const difficulties=[...new Set(state.cases.map(x=>x.difficulty).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"pt-BR"));
    buildSiteFilter("specialty",specialties);
    buildSiteFilter("difficulty",difficulties);
    renderLibrary();
    setPlantaoMode("emergency");
  }

  function bestScore(caseId) {
    const values=state.sessions.filter(x=>x.case_id===caseId && x.status==="completed").map(x=>Number(x.score||0));
    return values.length ? Math.max(...values) : null;
  }

  function renderLibrary() {
    const specialty=state.filters.specialty || "";
    const difficulty=state.filters.difficulty || "";
    const visibleCases=state.cases.filter(item=>(!specialty || item.specialty===specialty) && (!difficulty || item.difficulty===difficulty));
    $("plantao-case-count").textContent=visibleCases.length;
    $("plantao-session-count").textContent=state.sessions.length;
    const grid=$("plantao-case-grid");
    const empty=$("plantao-empty");
    if (!visibleCases.length) {
      grid.innerHTML="";
      empty.hidden=false;
      return;
    }
    empty.hidden=true;
    grid.innerHTML=visibleCases.map(item=>{
      const best=bestScore(item.id);
      const attempts=state.sessions.find(x=>x.case_id===item.id && x.status==="completed")?.attempt_count || (best==null ? 0 : 1);
      return `
        <article class="plantao-case-card">
          <div class="plantao-case-card-head">
            <div>
              <h3>${esc(item.presentation?.chief_complaint || item.presentation?.display_title || item.summary || "Queixa não informada")}</h3>
              <div class="plantao-case-tags">
                <span>${esc(item.specialty)}</span>
                <span>${esc(item.difficulty)}</span>
                <span>${esc(item.setting)}</span>
              </div>
            </div>
            ${best==null ? "" : `<span class="badge accent">Melhor: ${Math.round(best)}/100 · ${attempts} tentativa${attempts===1?"":"s"}</span>`}
          </div>
          <p>Paciente aguardando avaliação. O diagnóstico será revelado somente após a conclusão do caso.</p>
          <button class="button primary" type="button" data-start-case="${esc(item.id)}">Iniciar caso</button>
        </article>
      `;
    }).join("");
  }

  function setPlantaoMode(mode){
    const phone=mode==="phone" || mode==="telefone";
    state.phoneMode=phone;

    const emergencyPanel=$("plantao-emergency-panel");
    const phoneSection=$("plantao-telefone");
    const hero=$("plantao-hero");

    if(emergencyPanel){
      emergencyPanel.hidden=phone;
      emergencyPanel.style.display=phone ? "none" : "";
      emergencyPanel.setAttribute("aria-hidden",phone ? "true" : "false");
    }
    if(phoneSection){
      phoneSection.hidden=!phone;
      phoneSection.style.display=phone ? "grid" : "none";
      phoneSection.setAttribute("aria-hidden",phone ? "false" : "true");
    }

    const emergencyCard=$("plantao-emergency-mode-card");
    const phoneCard=$("plantao-phone-mode-card");
    [emergencyCard,phoneCard].forEach(card=>{
      if(!card) return;
      const isPhone=card===phoneCard;
      const active=phone ? isPhone : !isPhone;
      card.classList.toggle("active",active);
      if(active) card.setAttribute("aria-current","page"); else card.removeAttribute("aria-current");
    });

    document.body.classList.toggle("plantao-phone-mode",phone);
    document.body.classList.toggle("plantao-emergency-mode",!phone);

    if(phone){
      renderPhoneCases();
      if(!state.phoneSession){
        $("plantao-phone-station").hidden=true;
        $("plantao-phone-inbox").hidden=false;
      }
      window.scrollTo({top:0,behavior:"instant"});
    }else{
      window.scrollTo({top:0,behavior:"instant"});
    }
  }

  function renderPhoneCases(){
    const host=$("plantao-phone-case-list");
    if(!host) return;
    if(!state.phoneCases.length){
      host.innerHTML='<div class="plantao-phone-empty">Nenhuma interconsulta disponível.</div>';
      return;
    }
    host.innerHTML=state.phoneCases.map(item=>`
      <button class="plantao-phone-conversation" type="button" data-start-phone-case="${esc(item.id)}">
        <span class="plantao-phone-conversation-avatar" aria-hidden="true">✚</span>
        <span class="plantao-phone-conversation-main">
          <span class="plantao-phone-conversation-top">
            <strong>${esc(item.requester_role||"Interconsulta")}</strong>
            <small>agora</small>
          </span>
          <span class="plantao-phone-conversation-title">${esc(item.title)}</span>
          <span class="plantao-phone-conversation-preview">${esc(item.opening_message||"Nova solicitação de interconsulta")}</span>
        </span>
        <span class="plantao-phone-conversation-chevron" aria-hidden="true">›</span>
      </button>
    `).join("");
  }

  async function startPhoneCase(caseId){
    const item=state.phoneCases.find(x=>x.id===caseId);
    if(!item) return;
    state.phoneCase=item;
    state.phoneTurn=0;
    state.phoneUsedChoices=new Set();
    const {data:session,error}=await sb.from("interconsultation_sessions")
      .insert({user_id:state.user.id,case_id:item.id,status:"in_progress",turn_count:0,state:{mode:"scripted_pilot"}})
      .select("*").single();
    if(error){console.error("Telefone: não foi possível iniciar a sessão",error);return;}
    state.phoneSession=session;
    const {error:msgError}=await sb.from("interconsultation_messages").insert({
      session_id:session.id,user_id:state.user.id,turn_index:0,sender:"requester",content:item.opening_message,metadata:{pilot:true}
    });
    if(msgError) console.warn("Telefone: falha ao registrar abertura",msgError);
    $("plantao-phone-inbox").hidden=true;
    $("plantao-phone-station").hidden=false;
    $("plantao-phone-requester").textContent=item.requester_role||"Solicitante";
    $("plantao-phone-context").textContent=(item.specialty||"Interconsulta")+" · "+new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
    renderPhoneMessages([{sender:"requester",content:item.opening_message}]);
    renderPhoneChoices();
  }

  function updatePhoneStatusTime(){
    const el=$("plantao-phone-status-time");
    if(!el) return;
    el.textContent=new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  }

  function phoneChoiceOptions(){
    return [
      {id:"meds",group:"Perguntar",label:"Quais medicamentos ele usa?",text:"Quais medicamentos o paciente usa atualmente?"},
      {id:"renal",group:"Perguntar",label:"Como está a função renal?",text:"Como estão creatinina, ureia, potássio e função renal?"},
      {id:"hf",group:"Perguntar",label:"A IC está compensada?",text:"A insuficiência cardíaca está compensada? Tem dispneia, edema ou estertores?"},
      {id:"pain",group:"Perguntar",label:"Como é a dor no joelho?",text:"Como começou a dor no joelho? Houve trauma? Como está o exame do joelho?"},
      {id:"vitals",group:"Perguntar",label:"Quais são os sinais vitais?",text:"Quais são os sinais vitais agora? Pressão, frequência cardíaca, saturação e temperatura?"},
      {id:"allergy",group:"Perguntar",label:"Tem alguma alergia?",text:"O paciente tem alguma alergia medicamentosa?"},
      {id:"avoid_nsaid",group:"Orientar",label:"Evitar diclofenaco/AINE",text:"Eu evitaria diclofenaco e outros AINEs sistêmicos nesse paciente por causa da insuficiência cardíaca e do risco renal."},
      {id:"analgesia",group:"Conduta",label:"Sugerir analgesia mais segura",text:"Sugiro analgesia com dipirona ou paracetamol, conforme contraindicações, e reavaliar o joelho."}
    ];
  }

  function renderPhoneChoices(){
    const host=$("plantao-phone-choices");
    if(!host) return;
    const available=phoneChoiceOptions().filter(opt=>!state.phoneUsedChoices.has(opt.id));
    if(!available.length){
      host.innerHTML='<div class="plantao-phone-choice-done">Sem outras opções neste caso piloto.</div>';
      return;
    }
    const grouped={};
    available.forEach(opt=>{(grouped[opt.group] ||= []).push(opt);});
    host.innerHTML=Object.entries(grouped).map(([group,opts])=>`
      <section class="plantao-phone-choice-group">
        <strong>${esc(group)}</strong>
        <div>
          ${opts.map(opt=>`<button type="button" data-phone-choice="${esc(opt.id)}">${esc(opt.label)}</button>`).join("")}
        </div>
      </section>
    `).join("");
  }

  async function choosePhoneOption(choiceId){
    const opt=phoneChoiceOptions().find(item=>item.id===choiceId);
    if(!opt || state.phoneUsedChoices.has(choiceId)) return;
    state.phoneUsedChoices.add(choiceId);
    renderPhoneChoices();
    await sendPhoneMessage(opt.text,{choiceId:opt.id,choiceGroup:opt.group});
  }

  function phoneReplyFor(text){
    const t=normalizeLabel(text);
    const k=state.phoneCase?.known_by_requester||{};
    if(/remedio|medicacao|usa|enalapril|furosemida|carvedilol/.test(t)) return k.medications;
    if(/creatin|ureia|renal|rim|potass/.test(t)) return k.renal_function;
    if(/compens|dispneia|edema|estertor|pulmao|ausculta|ic /.test(t)) return k.heart_failure_status;
    if(/joelho|dor|trauma|tempo|comec|movimento/.test(t)) return [k.pain_history,k.knee_exam].filter(Boolean).join(" ");
    if(/pressao| pa |fc|frequencia|satur|sinais vitais|temperatura/.test(" "+t+" ")) return k.vitals;
    if(/alerg/.test(t)) return k.allergies;
    if((/diclofenaco|aine/.test(t)) && (/nao|evit|susp|contra/.test(t))) return "Entendi. Vou evitar o diclofenaco fixo. Você sugere alguma alternativa para a dor?";
    if(/paracetamol|dipirona/.test(t)) return "Perfeito. Vou usar analgesia mais segura e reavaliar o joelho. Obrigado.";
    if(/diclofenaco|aine/.test(t) && /pode|liber|deixa|mantem|fixo/.test(t)) return "Certo. Só confirmando: você autoriza deixar o diclofenaco fixo mesmo com insuficiência cardíaca e uso de enalapril e furosemida?";
    return "Não tenho essa informação agora. Se quiser, consigo checar os dados do prontuário e te responder algo mais específico.";
  }

  function renderPhoneMessages(messages){
    const body=$("plantao-phone-chat-body");
    if(!body) return;
    body.innerHTML=messages.map(m=>`
      <div class="plantao-phone-bubble ${m.sender==="specialist"?"outgoing":"incoming"}">
        ${m.sender==="requester"?'<strong>'+esc(state.phoneCase?.requester_role||"Solicitante")+'</strong>':""}
        <span>${esc(m.content)}</span>
      </div>
    `).join("");
    body.scrollTop=body.scrollHeight;
    body.dataset.messages=JSON.stringify(messages);
  }

  function currentPhoneMessages(){
    const body=$("plantao-phone-chat-body");
    try{return JSON.parse(body?.dataset.messages||"[]");}catch{return [];}
  }

  async function sendPhoneMessage(text,choiceMeta={}){
    if(!state.phoneSession||!state.phoneCase||!text.trim()) return;
    const clean=text.trim();
    state.phoneTurn+=1;
    const specialistIndex=state.phoneTurn*2-1;
    const requesterIndex=state.phoneTurn*2;
    const reply=phoneReplyFor(clean)||"Não tenho essa informação agora.";
    const messages=[...currentPhoneMessages(),{sender:"specialist",content:clean},{sender:"requester",content:reply}];
    renderPhoneMessages(messages);
    await sb.from("interconsultation_messages").insert([
      {session_id:state.phoneSession.id,user_id:state.user.id,turn_index:specialistIndex,sender:"specialist",content:clean,metadata:{pilot:true,...choiceMeta}},
      {session_id:state.phoneSession.id,user_id:state.user.id,turn_index:requesterIndex,sender:"requester",content:reply,metadata:{pilot:true,...choiceMeta}}
    ]);
    await sb.from("interconsultation_sessions").update({
      quota_counted_at:state.phoneSession.quota_counted_at||new Date().toISOString(),
      turn_count:state.phoneTurn,
      state:{mode:"scripted_pilot",last_user_message:clean}
    }).eq("id",state.phoneSession.id);
  }

  $("plantao-emergency-mode-card")?.addEventListener("click",()=>setPlantaoMode("emergency"));
  $("plantao-phone-mode-card")?.addEventListener("click",event=>{
    event.preventDefault(); setPlantaoMode("phone");
  });
  $("plantao-phone-case-list")?.addEventListener("click",event=>{
    const btn=event.target.closest("[data-start-phone-case]");
    if(btn) startPhoneCase(btn.dataset.startPhoneCase);
  });
  $("plantao-phone-choices")?.addEventListener("click",event=>{
    const btn=event.target.closest("[data-phone-choice]");
    if(btn) choosePhoneOption(btn.dataset.phoneChoice);
  });
  $("plantao-phone-back")?.addEventListener("click",async()=>{
    if(state.phoneSession?.id){
      await sb.from("interconsultation_sessions").update({status:"abandoned",completed_at:new Date().toISOString()}).eq("id",state.phoneSession.id);
    }
    state.phoneSession=null; state.phoneCase=null; state.phoneTurn=0; state.phoneUsedChoices=new Set();
    $("plantao-phone-station").hidden=true;
    $("plantao-phone-inbox").hidden=false;
    renderPhoneCases();
  });

  $("plantao-phone-exit")?.addEventListener("click",async()=>{
    if(state.phoneSession?.id){
      await sb.from("interconsultation_sessions").update({status:"abandoned",completed_at:new Date().toISOString()}).eq("id",state.phoneSession.id);
    }
    state.phoneSession=null; state.phoneCase=null; state.phoneTurn=0; state.phoneUsedChoices=new Set();
    $("plantao-phone-station").hidden=true;
    $("plantao-phone-inbox").hidden=false;
    setPlantaoMode("emergency");
  });

  function closeSiteFilters(except=null){
    document.querySelectorAll(".plantao-site-select-list").forEach(list=>{
      if(list===except) return;
      list.hidden=true;
      const trigger=list.parentElement?.querySelector(".plantao-site-select-trigger");
      trigger?.setAttribute("aria-expanded","false");
    });
  }

  function buildSiteFilter(kind,values){
    const list=$("plantao-filter-"+kind+"-list");
    if(!list) return;
    const current=state.filters[kind]||"";
    const items=["",...values];
    list.innerHTML=items.map(value=>`
      <button type="button" role="option" class="plantao-site-select-option${value===current?" selected":""}"
        data-filter-kind="${esc(kind)}" data-filter-value="${esc(value)}"
        aria-selected="${value===current?"true":"false"}">
        <span>${esc(value||"Todas")}</span>
        <span class="plantao-site-select-check" aria-hidden="true">✓</span>
      </button>
    `).join("");
  }

  function setSiteFilter(kind,value){
    state.filters[kind]=value||"";
    const label=$("plantao-filter-"+kind+"-label");
    if(label) label.textContent=value||"Todas";
    const values=[...new Set(state.cases.map(x=>x[kind]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"pt-BR"));
    buildSiteFilter(kind,values);
    renderLibrary();
    closeSiteFilters();
  }

  ["specialty","difficulty"].forEach(kind=>{
    $("plantao-filter-"+kind+"-button")?.addEventListener("click",event=>{
      event.stopPropagation();
      const list=$("plantao-filter-"+kind+"-list");
      if(!list) return;
      const willOpen=list.hidden;
      closeSiteFilters(list);
      list.hidden=!willOpen;
      event.currentTarget.setAttribute("aria-expanded",willOpen?"true":"false");
    });
    $("plantao-filter-"+kind+"-list")?.addEventListener("click",event=>{
      const option=event.target.closest("[data-filter-value]");
      if(option) setSiteFilter(kind,option.dataset.filterValue||"");
    });
  });
  document.addEventListener("click",()=>closeSiteFilters());
  document.addEventListener("keydown",event=>{if(event.key==="Escape") closeSiteFilters();});
  $("plantao-report-close")?.addEventListener("click",closeExamReport);
  $("plantao-report-ok")?.addEventListener("click",closeExamReport);
  $("plantao-report-overlay")?.addEventListener("click",event=>{
    if(event.target===event.currentTarget) closeExamReport();
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape" && !$("plantao-report-overlay")?.hidden) closeExamReport();
  });

  $("plantao-filter-clear")?.addEventListener("click",()=>{
    state.filters.specialty="";
    state.filters.difficulty="";
    ["specialty","difficulty"].forEach(kind=>{
      const label=$("plantao-filter-"+kind+"-label");
      if(label) label.textContent="Todas";
      const values=[...new Set(state.cases.map(x=>x[kind]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"pt-BR"));
      buildSiteFilter(kind,values);
    });
    renderLibrary();
  });

  const GROUPS = {
    anamnese:{label:"Anamnese",icon:"◉",categories:["anamnese"]},
    fisico:{label:"Exame físico",icon:"✚",categories:["exame"]},
    iniciais:{label:"Procedimentos iniciais / emergência",icon:"ϟ",categories:["iniciais","monitorizacao"]},
    exames:{label:"Exames",icon:"▤",categories:["exames","laboratorio","imagem"]},
    intervir:{label:"Intervenções",icon:"✚",categories:["tratamento","procedimentos","procedimentos_terapeuticos"]},
    hipoteses:{label:"Hipóteses",icon:"◎",categories:["hipoteses","raciocinio"]},
    conduta:{label:"Conduta final",icon:"✓",categories:["destino","encaminhamento"]}
  };
  const GENERIC_ACTIONS = [
    {id:"exam_ectoscopy",label:"Ectoscopia / estado geral",category:"exame",subgroup:"01 · Ectoscopia",time_min:.333,points:0,result:"__PHYSICAL__"},
    {id:"exam_head",label:"Crânio e face",category:"exame",subgroup:"02 · Crânio e face",time_min:.333,points:0,result:"__PHYSICAL__"},
    {id:"exam_eyes",label:"Olhos e pupilas",category:"exame",subgroup:"03 · Olhos",time_min:.333,points:0,result:"__PHYSICAL__"},
    {id:"exam_ears",label:"Otoscopia / orelhas",category:"exame",subgroup:"04 · Orelhas",time_min:.333,points:0,result:"__PHYSICAL__"},
    {id:"exam_nose",label:"Nariz e seios da face",category:"exame",subgroup:"05 · Nariz e seios da face",time_min:.333,points:0,result:"__PHYSICAL__"},
    {id:"exam_mouth",label:"Boca e orofaringe",category:"exame",subgroup:"06 · Boca e orofaringe",time_min:.333,points:0,result:"__PHYSICAL__"},
    {id:"exam_airway",label:"Vias aéreas",category:"exame",subgroup:"07 · Vias aéreas",time_min:.333,points:0,result:"__PHYSICAL__"},
    {id:"exam_neck",label:"Pescoço e linfonodos",category:"exame",subgroup:"08 · Pescoço",time_min:.333,points:0,result:"__PHYSICAL__"},
    {id:"exam_thyroid",label:"Tireoide",category:"exame",subgroup:"09 · Tireoide",time_min:.333,points:0,result:"__PHYSICAL__"},
    {id:"exam_neuro",label:"Exame neurológico",category:"exame",subgroup:"10 · Neurológico",time_min:.5,points:0,result:"__PHYSICAL__"},
    {id:"exam_chest",label:"Aparelho respiratório",category:"exame",subgroup:"11 · Tórax · Respiratório",time_min:.5,points:0,result:"__PHYSICAL__"},
    {id:"exam_cardio",label:"Aparelho cardiovascular",category:"exame",subgroup:"12 · Tórax · Cardiovascular",time_min:.5,points:0,result:"__PHYSICAL__"},
    {id:"exam_breast",label:"Mamas",category:"exame",subgroup:"13 · Mamas",time_min:.333,points:0,result:"__PHYSICAL__"},
    {id:"exam_abdomen",label:"Abdômen",category:"exame",subgroup:"14 · Abdômen",time_min:.5,points:0,result:"__PHYSICAL__"},
    {id:"exam_back",label:"Dorso e região lombar",category:"exame",subgroup:"15 · Dorso e lombar",time_min:.333,points:0,result:"__PHYSICAL__"},
    {id:"exam_spine",label:"Coluna vertebral",category:"exame",subgroup:"16 · Coluna",time_min:.333,points:0,result:"__PHYSICAL__"},
    {id:"exam_gyne",label:"Exame ginecológico",category:"exame",subgroup:"17 · Ginecológico",time_min:.667,points:0,result:"__PHYSICAL__"},
    {id:"exam_gu",label:"Exame genitourinário",category:"exame",subgroup:"18 · Genitourinário",time_min:.667,points:0,result:"__PHYSICAL__"},
    {id:"exam_rectal",label:"Exame anorretal / toque retal",category:"exame",subgroup:"19 · Anorretal",time_min:.5,points:0,result:"__PHYSICAL__"},
    {id:"exam_upper",label:"Membros superiores",category:"exame",subgroup:"20 · Membros superiores",time_min:.333,points:0,result:"__PHYSICAL__"},
    {id:"exam_lower",label:"Membros inferiores",category:"exame",subgroup:"21 · Membros inferiores",time_min:.333,points:0,result:"__PHYSICAL__"},
    {id:"exam_msk",label:"Musculoesquelético",category:"exame",subgroup:"22 · Musculoesquelético",time_min:.5,points:0,result:"__PHYSICAL__"},
    {id:"exam_extremities",label:"Extremidades e perfusão",category:"exame",subgroup:"23 · Perfusão periférica",time_min:.333,points:0,result:"__PHYSICAL__"},
    {id:"exam_skin",label:"Pele e mucosas",category:"exame",subgroup:"24 · Pele e mucosas",time_min:.333,points:0,result:"__PHYSICAL__"},
    {id:"monitor",label:"Ligar monitor multiparamétrico",category:"iniciais",subgroup:"Monitorização",time_min:.25,points:0,result:"Monitor conectado; sinais vitais e traçados passam a ser exibidos."},
    {id:"check_pulse",label:"Checar pulso e respiração",category:"iniciais",subgroup:"Avaliação imediata",time_min:.25,points:0,result:"Pulso e padrão respiratório avaliados."},
    {id:"check_rhythm",label:"Avaliar ritmo no monitor",category:"iniciais",subgroup:"Avaliação imediata",time_min:.25,points:0,result:"Ritmo avaliado no monitor.",requires_all:["monitor"],requires_penalty:2},
    {id:"abcde",label:"Avaliação ABCDE",category:"iniciais",subgroup:"Avaliação imediata",time_min:1,points:0,result:"ABCDE realizado de forma sistemática."},
    {id:"iv_access",label:"Acesso venoso periférico",category:"iniciais",subgroup:"Acessos",time_min:.5,points:0,result:"Acesso venoso periférico obtido."},
    {id:"iv_access_2",label:"Segundo acesso venoso periférico",category:"iniciais",subgroup:"Acessos",time_min:.5,points:0,result:"Segundo acesso venoso periférico obtido."},
    {id:"io_access",label:"Acesso intraósseo",category:"iniciais",subgroup:"Acessos",time_min:.5,points:0,result:"Acesso intraósseo obtido."},
    {id:"oxygen",label:"Oxigênio suplementar",category:"iniciais",subgroup:"Suporte",time_min:.25,points:0,result:"Oxigênio suplementar iniciado."},
    {id:"bvm",label:"Bolsa-válvula-máscara",category:"iniciais",subgroup:"Suporte",time_min:.25,points:0,result:"Ventilação com bolsa-válvula-máscara iniciada."},
    {id:"cpr",label:"Iniciar RCP",category:"iniciais",subgroup:"Ressuscitação",time_min:.25,points:0,result:"RCP de alta qualidade iniciada."},
    {id:"call_team",label:"Acionar equipe de emergência",category:"iniciais",subgroup:"Suporte",time_min:.25,points:0,result:"Equipe de emergência acionada."},
    {id:"glucose",label:"Glicemia capilar",category:"iniciais",subgroup:"Avaliação imediata",time_min:.25,points:0,result:"Glicemia capilar aferida."},
    {id:"ecg",label:"Eletrocardiograma de 12 derivações",category:"exames",subgroup:"Gerais",time_min:.5,points:0,result:"ECG realizado; sem alteração adicional relevante além do contexto do caso."},
    {id:"pulse_ox",label:"Oximetria de pulso",category:"exames",subgroup:"Gerais",time_min:.1,points:0,result:"Oximetria aferida."},
    {id:"capnography",label:"Capnografia",category:"exames",subgroup:"Gerais",time_min:.25,points:0,result:"Capnografia realizada."},
    {id:"temperature",label:"Temperatura",category:"exames",subgroup:"Gerais",time_min:.1,points:0,result:"Temperatura aferida."},
    {id:"urinalysis",label:"Urina tipo 1",category:"laboratorio",subgroup:"Laboratoriais",time_min:.5,points:0,result:"Urina tipo 1 sem alteração adicional relevante neste caso."},
    {id:"pregnancy",label:"β-hCG",category:"laboratorio",subgroup:"Laboratoriais",time_min:.5,points:0,result:"β-hCG solicitado; interpretar conforme o contexto."},
    {id:"cbc",label:"Hemograma completo",category:"laboratorio",subgroup:"Hematologia",time_min:.5,points:0,result:"Hemograma disponível; sem alteração adicional relevante neste caso."},
    {id:"wbc",label:"Leucócitos e diferencial",category:"laboratorio",subgroup:"Hematologia",time_min:.5,points:0,result:"Série branca disponível; sem alteração adicional relevante neste caso."},
    {id:"platelets",label:"Plaquetas",category:"laboratorio",subgroup:"Hematologia",time_min:.5,points:0,result:"Plaquetas disponíveis; sem alteração adicional relevante neste caso."},
    {id:"sodium",label:"Sódio",category:"laboratorio",subgroup:"Eletrólitos",time_min:.5,points:0,result:"Sódio sem alteração adicional relevante neste caso.",satisfies:["electrolytes"]},
    {id:"potassium",label:"Potássio",category:"laboratorio",subgroup:"Eletrólitos",time_min:.5,points:0,result:"Potássio sem alteração adicional relevante neste caso.",satisfies:["electrolytes"]},
    {id:"calcium_lab",label:"Cálcio",category:"laboratorio",subgroup:"Eletrólitos",time_min:.5,points:0,result:"Cálcio sem alteração adicional relevante neste caso."},
    {id:"magnesium_lab",label:"Magnésio",category:"laboratorio",subgroup:"Eletrólitos",time_min:.5,points:0,result:"Magnésio sem alteração adicional relevante neste caso."},
    {id:"chloride",label:"Cloro",category:"laboratorio",subgroup:"Eletrólitos",time_min:.5,points:0,result:"Cloro sem alteração adicional relevante neste caso."},
    {id:"urea",label:"Ureia",category:"laboratorio",subgroup:"Função renal",time_min:.5,points:0,result:"Ureia sem alteração adicional relevante neste caso."},
    {id:"creatinine",label:"Creatinina",category:"laboratorio",subgroup:"Função renal",time_min:.5,points:0,result:"Creatinina sem alteração adicional relevante neste caso.",satisfies:["electrolytes"]},
    {id:"gas",label:"Gasometria",category:"laboratorio",subgroup:"Gasometria",time_min:.5,points:0,result:"Gasometria disponível; interpretar conforme o quadro clínico."},
    {id:"lactate",label:"Lactato",category:"laboratorio",subgroup:"Gasometria",time_min:.5,points:0,result:"Lactato disponível; interpretar conforme perfusão e contexto clínico."},
    {id:"troponin",label:"Troponina",category:"laboratorio",subgroup:"Cardíacos",time_min:.5,points:0,result:"Troponina disponível; interpretar no contexto clínico e eletrocardiográfico."},
    {id:"bnp",label:"BNP / NT-proBNP",category:"laboratorio",subgroup:"Cardíacos",time_min:.5,points:0,result:"Peptídeo natriurético disponível; interpretar conforme o contexto."},
    {id:"ast",label:"TGO (AST)",category:"laboratorio",subgroup:"Hepáticos",time_min:.5,points:0,result:"TGO disponível; sem alteração adicional relevante neste caso."},
    {id:"alt",label:"TGP (ALT)",category:"laboratorio",subgroup:"Hepáticos",time_min:.5,points:0,result:"TGP disponível; sem alteração adicional relevante neste caso."},
    {id:"ggt",label:"Gama-GT",category:"laboratorio",subgroup:"Hepáticos",time_min:.5,points:0,result:"Gama-GT disponível; sem alteração adicional relevante neste caso."},
    {id:"alp",label:"Fosfatase alcalina",category:"laboratorio",subgroup:"Hepáticos",time_min:.5,points:0,result:"Fosfatase alcalina disponível; sem alteração adicional relevante neste caso."},
    {id:"bilirubin_total",label:"Bilirrubina total",category:"laboratorio",subgroup:"Hepáticos",time_min:.5,points:0,result:"Bilirrubina total disponível; sem alteração adicional relevante neste caso."},
    {id:"bilirubin_direct",label:"Bilirrubina direta",category:"laboratorio",subgroup:"Hepáticos",time_min:.5,points:0,result:"Bilirrubina direta disponível; sem alteração adicional relevante neste caso."},
    {id:"amylase",label:"Amilase",category:"laboratorio",subgroup:"Pancreáticos",time_min:.5,points:0,result:"Amilase disponível; sem alteração adicional relevante neste caso."},
    {id:"lipase",label:"Lipase",category:"laboratorio",subgroup:"Pancreáticos",time_min:.5,points:0,result:"Lipase disponível; sem alteração adicional relevante neste caso."},
    {id:"crp",label:"PCR (proteína C reativa)",category:"laboratorio",subgroup:"Inflamatórios",time_min:.5,points:0,result:"Proteína C reativa disponível; interpretar conforme o contexto."},
    {id:"procalcitonin",label:"Procalcitonina",category:"laboratorio",subgroup:"Inflamatórios",time_min:.5,points:0,result:"Procalcitonina disponível; interpretar conforme o contexto."},
    {id:"pt_inr",label:"TP / INR",category:"laboratorio",subgroup:"Coagulação",time_min:.5,points:0,result:"TP/INR disponível."},
    {id:"aptt",label:"TTPa",category:"laboratorio",subgroup:"Coagulação",time_min:.5,points:0,result:"TTPa disponível."},
    {id:"ddimer",label:"D-dímero",category:"laboratorio",subgroup:"Coagulação",time_min:.5,points:0,result:"D-dímero disponível; interpretar conforme probabilidade pré-teste."},
    {id:"tsh",label:"TSH",category:"laboratorio",subgroup:"Endócrinos",time_min:.5,points:0,result:"TSH disponível."},
    {id:"free_t4",label:"T4 livre",category:"laboratorio",subgroup:"Endócrinos",time_min:.5,points:0,result:"T4 livre disponível."},
    {id:"ketones",label:"Cetonemia",category:"laboratorio",subgroup:"Metabólicos",time_min:.5,points:0,result:"Cetonemia disponível."},
    {id:"serum_glucose",label:"Glicose sérica",category:"laboratorio",subgroup:"Metabólicos",time_min:.5,points:0,result:"Glicose sérica disponível."},
    {id:"phosphorus",label:"Fósforo",category:"laboratorio",subgroup:"Eletrólitos",time_min:.5,points:0,result:"Fósforo disponível."},
    {id:"albumin",label:"Albumina",category:"laboratorio",subgroup:"Proteínas",time_min:.5,points:0,result:"Albumina disponível."},
    {id:"total_protein",label:"Proteínas totais",category:"laboratorio",subgroup:"Proteínas",time_min:.5,points:0,result:"Proteínas totais disponíveis."},
    {id:"ck",label:"CK total",category:"laboratorio",subgroup:"Musculares",time_min:.5,points:0,result:"CK total disponível."},
    {id:"ckmb",label:"CK-MB",category:"laboratorio",subgroup:"Cardíacos",time_min:.5,points:0,result:"CK-MB disponível."},
    {id:"ldh",label:"LDH",category:"laboratorio",subgroup:"Outros",time_min:.5,points:0,result:"LDH disponível."},
    {id:"fibrinogen",label:"Fibrinogênio",category:"laboratorio",subgroup:"Coagulação",time_min:.5,points:0,result:"Fibrinogênio disponível."},
    {id:"blood_cultures",label:"Hemoculturas",category:"laboratorio",subgroup:"Microbiologia",time_min:.5,points:0,result:"Hemoculturas coletadas."},
    {id:"urine_culture",label:"Urocultura",category:"laboratorio",subgroup:"Microbiologia",time_min:.5,points:0,result:"Urocultura coletada."},
    {id:"toxicology",label:"Triagem toxicológica",category:"laboratorio",subgroup:"Toxicologia",time_min:.5,points:0,result:"Triagem toxicológica solicitada."},
    {id:"ethanol",label:"Etanol sérico",category:"laboratorio",subgroup:"Toxicologia",time_min:.5,points:0,result:"Etanol sérico disponível."},
    {id:"pocus",label:"POCUS",category:"imagem",subgroup:"Ultrassom",time_min:.5,points:0,result:"POCUS realizado; nenhum achado adicional relevante neste caso."},
    {id:"fast",label:"FAST / eFAST",category:"imagem",subgroup:"Ultrassom",time_min:.5,points:0,result:"FAST/eFAST realizado; sem achado adicional relevante neste caso."},
    {id:"xray_chest",label:"Raio-X de tórax",category:"imagem",subgroup:"Radiografia",time_min:1,points:0,result:"Radiografia de tórax realizada; sem achado adicional relevante neste caso.",satisfies:["cxr"]},
    {id:"xray_abdomen",label:"Raio-X de abdômen",category:"imagem",subgroup:"Radiografia",time_min:1,points:0,result:"Radiografia de abdômen realizada; sem achado adicional relevante neste caso."},
    {id:"ct_head",label:"Tomografia de crânio",category:"imagem",subgroup:"Tomografia",time_min:5,points:0,result:"Tomografia de crânio realizada; sem achado adicional relevante neste caso.",satisfies:["ct_brain"]},
    {id:"ct_chest",label:"Tomografia de tórax",category:"imagem",subgroup:"Tomografia",time_min:5,points:0,result:"Tomografia de tórax realizada; sem achado adicional relevante neste caso."},
    {id:"ct_abdomen",label:"Tomografia de abdômen e pelve",category:"imagem",subgroup:"Tomografia",time_min:5,points:0,result:"Tomografia de abdômen e pelve realizada; sem achado adicional relevante neste caso."},
    {id:"cta_head_neck",label:"Angio-TC de crânio e pescoço",category:"imagem",subgroup:"Tomografia",time_min:6,points:0,result:"Angio-TC realizada; sem achado adicional relevante neste caso."},
    {id:"cta_chest",label:"Angio-TC de tórax",category:"imagem",subgroup:"Tomografia",time_min:6,points:0,result:"Angio-TC de tórax realizada; sem achado adicional relevante neste caso."},
    {id:"mri_brain",label:"Ressonância de crânio",category:"imagem",subgroup:"Ressonância",time_min:10,points:0,result:"Ressonância de crânio realizada; sem achado adicional relevante neste caso."},
    {id:"mri_spine",label:"Ressonância de coluna",category:"imagem",subgroup:"Ressonância",time_min:10,points:0,result:"Ressonância de coluna realizada; sem achado adicional relevante neste caso."},
    {id:"us_abdomen",label:"Ultrassonografia de abdome total",category:"imagem",subgroup:"Ultrassom",time_min:4,points:0,result:"Ultrassonografia de abdome total realizada.",satisfies:["abdominal_ultrasound","us_abdomen_total"]},
    {id:"us_upper_abdomen",label:"Ultrassonografia de abdome superior",category:"imagem",subgroup:"Ultrassom",time_min:4,points:0,result:"Ultrassonografia de abdome superior realizada."},
    {id:"us_pelvis",label:"Ultrassonografia pélvica",category:"imagem",subgroup:"Ultrassom",time_min:4,points:0,result:"Ultrassonografia pélvica realizada.",satisfies:["pelvic_ultrasound"]},
    {id:"us_transvaginal",label:"Ultrassonografia transvaginal",category:"imagem",subgroup:"Ultrassom",time_min:4,points:0,result:"Ultrassonografia transvaginal realizada.",satisfies:["transvaginal_ultrasound","tvus"]},
    {id:"us_obstetric",label:"Ultrassonografia obstétrica",category:"imagem",subgroup:"Ultrassom",time_min:4,points:0,result:"Ultrassonografia obstétrica realizada.",satisfies:["obstetric_ultrasound"]},
    {id:"us_renal_urinary",label:"Ultrassonografia de rins e vias urinárias",category:"imagem",subgroup:"Ultrassom",time_min:4,points:0,result:"Ultrassonografia de rins e vias urinárias realizada.",satisfies:["renal_ultrasound"]},
    {id:"us_scrotal",label:"Ultrassonografia de bolsa escrotal com Doppler",category:"imagem",subgroup:"Ultrassom",time_min:4,points:0,result:"Ultrassonografia de bolsa escrotal com Doppler realizada.",satisfies:["scrotal_ultrasound","testicular_ultrasound"]},
    {id:"us_thyroid",label:"Ultrassonografia de tireoide",category:"imagem",subgroup:"Ultrassom",time_min:4,points:0,result:"Ultrassonografia de tireoide realizada."},
    {id:"us_soft_tissue",label:"Ultrassonografia de partes moles",category:"imagem",subgroup:"Ultrassom",time_min:3,points:0,result:"Ultrassonografia de partes moles realizada."},
    {id:"us_lung",label:"Ultrassonografia pulmonar",category:"imagem",subgroup:"Ultrassom",time_min:2,points:0,result:"Ultrassonografia pulmonar realizada.",satisfies:["lung_ultrasound"]},
    {id:"echo",label:"Ecocardiograma",category:"imagem",subgroup:"Ultrassom",time_min:4,points:0,result:"Ecocardiograma realizado."},
    {id:"vascular_doppler",label:"Doppler vascular",category:"imagem",subgroup:"Ultrassom",time_min:4,points:0,result:"Doppler vascular realizado."},
    {id:"ct_spine",label:"Tomografia de coluna",category:"imagem",subgroup:"Tomografia",time_min:6,points:0,result:"Tomografia de coluna realizada."},
    {id:"defibrillate",label:"Desfibrilar",category:"iniciais",subgroup:"Ressuscitação",time_min:.25,points:0,result:"Desfibrilação executada conforme o estágio atual do caso.",repeatable:true},
    {id:"sync_cardioversion",label:"Cardioversão sincronizada",category:"procedimentos_terapeuticos",subgroup:"Terapia elétrica",time_min:.25,points:0,result:"Cardioversão sincronizada realizada."},
    {id:"airway",label:"Via aérea definitiva / intubação",category:"iniciais",subgroup:"Via aérea / emergência",time_min:.5,points:0,result:"Via aérea definitiva realizada; confirmar posicionamento e ventilação."},
    {id:"cricothyrotomy",label:"Cricotireoidostomia",category:"iniciais",subgroup:"Via aérea / emergência",time_min:1,points:0,result:"Via aérea cirúrgica realizada."},
    {id:"needle_decompression",label:"Descompressão torácica imediata",category:"procedimentos_terapeuticos",subgroup:"Tórax",time_min:.5,points:0,result:"Descompressão torácica realizada."},
    {id:"chest_tube",label:"Drenagem torácica",category:"procedimentos_terapeuticos",subgroup:"Tórax",time_min:2,points:0,result:"Dreno torácico instalado."},
    {id:"pelvic_binder",label:"Cinta pélvica",category:"procedimentos_terapeuticos",subgroup:"Trauma",time_min:.5,points:0,result:"Cinta pélvica aplicada."},
    {id:"tourniquet",label:"Torniquete",category:"procedimentos_terapeuticos",subgroup:"Hemorragia",time_min:.25,points:0,result:"Torniquete aplicado."},
    {id:"direct_pressure",label:"Compressão direta de sangramento",category:"procedimentos_terapeuticos",subgroup:"Hemorragia",time_min:.25,points:0,result:"Compressão direta realizada."},
    {id:"urinary_catheter",label:"Sonda vesical",category:"procedimentos_terapeuticos",subgroup:"Dispositivos",time_min:.5,points:0,result:"Sonda vesical instalada."},
    {id:"ng_tube",label:"Sonda nasogástrica",category:"procedimentos_terapeuticos",subgroup:"Dispositivos",time_min:.5,points:0,result:"Sonda nasogástrica instalada."},
    {id:"transcutaneous_pacing",label:"Marcapasso transcutâneo",category:"procedimentos_terapeuticos",subgroup:"Terapia elétrica",time_min:.5,points:0,result:"Marcapasso transcutâneo iniciado."},
    {id:"pericardiocentesis",label:"Pericardiocentese",category:"procedimentos_terapeuticos",subgroup:"Procedimentos invasivos",time_min:1,points:0,result:"Pericardiocentese realizada."},
    {id:"thoracentesis",label:"Toracocentese",category:"procedimentos_terapeuticos",subgroup:"Tórax",time_min:1,points:0,result:"Toracocentese realizada."},
    {id:"central_line",label:"Acesso venoso central",category:"procedimentos_terapeuticos",subgroup:"Acessos",time_min:2,points:0,result:"Acesso venoso central obtido."},
    {id:"arterial_line_generic",label:"Cateter arterial",category:"procedimentos_terapeuticos",subgroup:"Acessos",time_min:2,points:0,result:"Cateter arterial instalado."},
    {id:"epi_im",label:"Adrenalina IM",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Adrenalina IM administrada."},
    {id:"epi",label:"Adrenalina IV/IO",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Adrenalina IV/IO administrada."},
    {id:"amiodarone",label:"Amiodarona",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Amiodarona administrada."},
    {id:"lidocaine",label:"Lidocaína",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Lidocaína administrada."},
    {id:"bicarb",label:"Bicarbonato de sódio",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Bicarbonato administrado; benefício depende da indicação clínica."},
    {id:"calcium",label:"Cálcio IV",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Cálcio IV administrado; benefício depende da indicação clínica."},
    {id:"atropine",label:"Atropina",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Atropina administrada."},
    {id:"adenosine",label:"Adenosina",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Adenosina administrada."},
    {id:"magnesium",label:"Sulfato de magnésio",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Sulfato de magnésio administrado."},
    {id:"norepi",label:"Noradrenalina",category:"tratamento",subgroup:"Vasoativos",time_min:.25,points:0,result:"Noradrenalina iniciada e titulada."},
    {id:"dobutamine",label:"Dobutamina",category:"tratamento",subgroup:"Vasoativos",time_min:.25,points:0,result:"Dobutamina iniciada."},
    {id:"dopamine",label:"Dopamina",category:"tratamento",subgroup:"Vasoativos",time_min:.25,points:0,result:"Dopamina iniciada."},
    {id:"nitroglycerin",label:"Nitroglicerina",category:"tratamento",subgroup:"Cardiovasculares",time_min:.25,points:0,result:"Nitroglicerina administrada."},
    {id:"metoprolol",label:"Metoprolol",category:"tratamento",subgroup:"Cardiovasculares",time_min:.25,points:0,result:"Metoprolol administrado."},
    {id:"diltiazem",label:"Diltiazem",category:"tratamento",subgroup:"Cardiovasculares",time_min:.25,points:0,result:"Diltiazem administrado."},
    {id:"furosemide",label:"Furosemida",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Furosemida administrada."},
    {id:"salbutamol",label:"Salbutamol",category:"tratamento",subgroup:"Respiratórios",time_min:.25,points:0,result:"Salbutamol administrado."},
    {id:"ipratropium",label:"Ipratrópio",category:"tratamento",subgroup:"Respiratórios",time_min:.25,points:0,result:"Ipratrópio administrado."},
    {id:"hydrocortisone",label:"Hidrocortisona",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Hidrocortisona administrada."},
    {id:"antihistamine",label:"Anti-histamínico H1",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Anti-histamínico administrado."},
    {id:"ceftriaxone",label:"Ceftriaxona",category:"tratamento",subgroup:"Antimicrobianos",time_min:.25,points:0,result:"Ceftriaxona administrada."},
    {id:"azithromycin",label:"Azitromicina",category:"tratamento",subgroup:"Antimicrobianos",time_min:.25,points:0,result:"Azitromicina administrada."},
    {id:"piperacillin_tazo",label:"Piperacilina-tazobactam",category:"tratamento",subgroup:"Antimicrobianos",time_min:.25,points:0,result:"Piperacilina-tazobactam administrada."},
    {id:"vancomycin",label:"Vancomicina",category:"tratamento",subgroup:"Antimicrobianos",time_min:.25,points:0,result:"Vancomicina administrada."},
    {id:"morphine",label:"Morfina",category:"tratamento",subgroup:"Analgesia",time_min:.25,points:0,result:"Morfina administrada."},
    {id:"fentanyl",label:"Fentanil",category:"tratamento",subgroup:"Analgesia",time_min:.25,points:0,result:"Fentanil administrado."},
    {id:"dipyrone",label:"Dipirona",category:"tratamento",subgroup:"Analgesia",time_min:.25,points:0,result:"Dipirona administrada."},
    {id:"paracetamol",label:"Paracetamol",category:"tratamento",subgroup:"Analgesia",time_min:.25,points:0,result:"Paracetamol administrado."},
    {id:"ondansetron",label:"Ondansetrona",category:"tratamento",subgroup:"Sintomáticos",time_min:.25,points:0,result:"Ondansetrona administrada."},
    {id:"midazolam",label:"Midazolam",category:"tratamento",subgroup:"Sedação",time_min:.25,points:0,result:"Midazolam administrado."},
    {id:"ketamine",label:"Cetamina",category:"tratamento",subgroup:"Sedação",time_min:.25,points:0,result:"Cetamina administrada."},
    {id:"propofol",label:"Propofol",category:"tratamento",subgroup:"Sedação",time_min:.25,points:0,result:"Propofol administrado."},
    {id:"rocuronium",label:"Rocurônio",category:"tratamento",subgroup:"Sequência rápida",time_min:.25,points:0,result:"Rocurônio administrado."},
    {id:"succinylcholine",label:"Succinilcolina",category:"tratamento",subgroup:"Sequência rápida",time_min:.25,points:0,result:"Succinilcolina administrada."},
    {id:"crystalloid",label:"Cristaloide IV",category:"tratamento",subgroup:"Fluidos",time_min:.5,points:0,result:"Cristaloide administrado com reavaliação clínica."},
    {id:"blood",label:"Concentrado de hemácias",category:"tratamento",subgroup:"Hemoderivados",time_min:.5,points:0,result:"Concentrado de hemácias iniciado."},
    {id:"plasma",label:"Plasma fresco congelado",category:"tratamento",subgroup:"Hemoderivados",time_min:.5,points:0,result:"Plasma fresco congelado iniciado."},
    {id:"platelets_tx",label:"Concentrado de plaquetas",category:"tratamento",subgroup:"Hemoderivados",time_min:.5,points:0,result:"Concentrado de plaquetas iniciado."},
    {id:"tranexamic",label:"Ácido tranexâmico",category:"tratamento",subgroup:"Hemostáticos",time_min:.25,points:0,result:"Ácido tranexâmico administrado."},
    {id:"aspirin",label:"AAS",category:"tratamento",subgroup:"Antitrombóticos",time_min:.25,points:0,result:"AAS administrado."},
    {id:"clopidogrel",label:"Clopidogrel",category:"tratamento",subgroup:"Antitrombóticos",time_min:.25,points:0,result:"Clopidogrel administrado."},
    {id:"heparin",label:"Heparina não fracionada",category:"tratamento",subgroup:"Antitrombóticos",time_min:.25,points:0,result:"Heparina administrada."},
    {id:"enoxaparin",label:"Enoxaparina",category:"tratamento",subgroup:"Antitrombóticos",time_min:.25,points:0,result:"Enoxaparina administrada."},
    {id:"thrombolytic",label:"Trombólise sistêmica",category:"tratamento",subgroup:"Trombolíticos",time_min:.25,points:0,result:"Trombólise iniciada conforme indicação selecionada."},
    {id:"insulin",label:"Insulina regular",category:"tratamento",subgroup:"Metabólicos",time_min:.25,points:0,result:"Insulina regular administrada."},
    {id:"dextrose",label:"Glicose IV",category:"tratamento",subgroup:"Metabólicos",time_min:.25,points:0,result:"Glicose IV administrada."},
    {id:"glucagon",label:"Glucagon",category:"tratamento",subgroup:"Metabólicos",time_min:.25,points:0,result:"Glucagon administrado."},
    {id:"naloxone",label:"Naloxona",category:"tratamento",subgroup:"Antídotos",time_min:.25,points:0,result:"Naloxona administrada."},
    {id:"flumazenil",label:"Flumazenil",category:"tratamento",subgroup:"Antídotos",time_min:.25,points:0,result:"Flumazenil administrado; avaliar risco de convulsões e contraindicações."},
    {id:"diazepam",label:"Diazepam",category:"tratamento",subgroup:"Neurológicos",time_min:.25,points:0,result:"Diazepam administrado."},
    {id:"levetiracetam",label:"Levetiracetam",category:"tratamento",subgroup:"Neurológicos",time_min:.25,points:0,result:"Levetiracetam administrado."},
    {id:"phenobarbital",label:"Fenobarbital",category:"tratamento",subgroup:"Neurológicos",time_min:.25,points:0,result:"Fenobarbital administrado."},
    {id:"haloperidol",label:"Haloperidol",category:"tratamento",subgroup:"Psiquiátricos",time_min:.25,points:0,result:"Haloperidol administrado."},
    {id:"amoxicillin",label:"Amoxicilina",category:"tratamento",subgroup:"Antimicrobianos",time_min:.25,points:0,result:"Amoxicilina administrada."},
    {id:"amox_clav",label:"Amoxicilina-clavulanato",category:"tratamento",subgroup:"Antimicrobianos",time_min:.25,points:0,result:"Amoxicilina-clavulanato administrada."},
    {id:"penicillin_g",label:"Penicilina G cristalina",category:"tratamento",subgroup:"Antimicrobianos",time_min:.25,points:0,result:"Penicilina G cristalina administrada."},
    {id:"benzathine_penicillin",label:"Penicilina benzatina",category:"tratamento",subgroup:"Antimicrobianos",time_min:.25,points:0,result:"Penicilina benzatina administrada."},
    {id:"cefazolin",label:"Cefazolina",category:"tratamento",subgroup:"Antimicrobianos",time_min:.25,points:0,result:"Cefazolina administrada."},
    {id:"cephalexin",label:"Cefalexina",category:"tratamento",subgroup:"Antimicrobianos",time_min:.25,points:0,result:"Cefalexina administrada."},
    {id:"cefepime",label:"Cefepime",category:"tratamento",subgroup:"Antimicrobianos",time_min:.25,points:0,result:"Cefepime administrado."},
    {id:"meropenem",label:"Meropenem",category:"tratamento",subgroup:"Antimicrobianos",time_min:.25,points:0,result:"Meropenem administrado."},
    {id:"metronidazole",label:"Metronidazol",category:"tratamento",subgroup:"Antimicrobianos",time_min:.25,points:0,result:"Metronidazol administrado."},
    {id:"clindamycin",label:"Clindamicina",category:"tratamento",subgroup:"Antimicrobianos",time_min:.25,points:0,result:"Clindamicina administrada."},
    {id:"doxycycline",label:"Doxiciclina",category:"tratamento",subgroup:"Antimicrobianos",time_min:.25,points:0,result:"Doxiciclina administrada."},
    {id:"tmp_smx",label:"Sulfametoxazol-trimetoprim",category:"tratamento",subgroup:"Antimicrobianos",time_min:.25,points:0,result:"Sulfametoxazol-trimetoprim administrado."},
    {id:"nitrofurantoin",label:"Nitrofurantoína",category:"tratamento",subgroup:"Antimicrobianos",time_min:.25,points:0,result:"Nitrofurantoína administrada."},
    {id:"fosfomycin",label:"Fosfomicina",category:"tratamento",subgroup:"Antimicrobianos",time_min:.25,points:0,result:"Fosfomicina administrada."},
    {id:"acyclovir",label:"Aciclovir",category:"tratamento",subgroup:"Antivirais",time_min:.25,points:0,result:"Aciclovir administrado."},
    {id:"oseltamivir",label:"Oseltamivir",category:"tratamento",subgroup:"Antivirais",time_min:.25,points:0,result:"Oseltamivir administrado."},
    {id:"fluconazole",label:"Fluconazol",category:"tratamento",subgroup:"Antifúngicos",time_min:.25,points:0,result:"Fluconazol administrado."},
    {id:"nystatin",label:"Nistatina",category:"tratamento",subgroup:"Antifúngicos",time_min:.25,points:0,result:"Nistatina administrada."},
    {id:"mupirocin",label:"Mupirocina tópica",category:"tratamento",subgroup:"Dermatológicos",time_min:.25,points:0,result:"Mupirocina tópica aplicada."},
    {id:"permethrin",label:"Permetrina",category:"tratamento",subgroup:"Dermatológicos",time_min:.25,points:0,result:"Permetrina aplicada conforme indicação."},
    {id:"topical_corticosteroid",label:"Corticoide tópico",category:"tratamento",subgroup:"Dermatológicos",time_min:.25,points:0,result:"Corticoide tópico aplicado."},
    {id:"ibuprofen",label:"Ibuprofeno",category:"tratamento",subgroup:"Analgesia",time_min:.25,points:0,result:"Ibuprofeno administrado."},
    {id:"ketorolac",label:"Cetorolaco",category:"tratamento",subgroup:"Analgesia",time_min:.25,points:0,result:"Cetorolaco administrado."},
    {id:"diclofenac",label:"Diclofenaco",category:"tratamento",subgroup:"Analgesia",time_min:.25,points:0,result:"Diclofenaco administrado."},
    {id:"colchicine",label:"Colchicina",category:"tratamento",subgroup:"Anti-inflamatórios",time_min:.25,points:0,result:"Colchicina administrada."},
    {id:"prednisone",label:"Prednisona",category:"tratamento",subgroup:"Corticoides",time_min:.25,points:0,result:"Prednisona administrada."},
    {id:"dexamethasone",label:"Dexametasona",category:"tratamento",subgroup:"Corticoides",time_min:.25,points:0,result:"Dexametasona administrada."},
    {id:"budesonide",label:"Budesonida inalatória",category:"tratamento",subgroup:"Respiratórios",time_min:.25,points:0,result:"Budesonida inalatória administrada."},
    {id:"racemic_epinephrine",label:"Adrenalina nebulizada",category:"tratamento",subgroup:"Respiratórios",time_min:.25,points:0,result:"Adrenalina nebulizada administrada."},
    {id:"pantoprazole",label:"Pantoprazol IV",category:"tratamento",subgroup:"Gastrointestinais",time_min:.25,points:0,result:"Pantoprazol administrado."},
    {id:"omeprazole",label:"Omeprazol",category:"tratamento",subgroup:"Gastrointestinais",time_min:.25,points:0,result:"Omeprazol administrado."},
    {id:"metoclopramide",label:"Metoclopramida",category:"tratamento",subgroup:"Sintomáticos",time_min:.25,points:0,result:"Metoclopramida administrada."},
    {id:"dimenhydrinate",label:"Dimenidrinato",category:"tratamento",subgroup:"Sintomáticos",time_min:.25,points:0,result:"Dimenidrinato administrado."},
    {id:"lactulose",label:"Lactulose",category:"tratamento",subgroup:"Gastrointestinais",time_min:.25,points:0,result:"Lactulose administrada."},
    {id:"polyethylene_glycol",label:"Polietilenoglicol",category:"tratamento",subgroup:"Gastrointestinais",time_min:.25,points:0,result:"Polietilenoglicol administrado."},
    {id:"propranolol",label:"Propranolol",category:"tratamento",subgroup:"Cardiovasculares",time_min:.25,points:0,result:"Propranolol administrado."},
    {id:"esmolol",label:"Esmolol",category:"tratamento",subgroup:"Cardiovasculares",time_min:.25,points:0,result:"Esmolol administrado."},
    {id:"verapamil",label:"Verapamil",category:"tratamento",subgroup:"Cardiovasculares",time_min:.25,points:0,result:"Verapamil administrado."},
    {id:"labetalol",label:"Labetalol",category:"tratamento",subgroup:"Anti-hipertensivos",time_min:.25,points:0,result:"Labetalol administrado."},
    {id:"hydralazine",label:"Hidralazina",category:"tratamento",subgroup:"Anti-hipertensivos",time_min:.25,points:0,result:"Hidralazina administrada."},
    {id:"nicardipine",label:"Nicardipina",category:"tratamento",subgroup:"Anti-hipertensivos",time_min:.25,points:0,result:"Nicardipina administrada."},
    {id:"nifedipine",label:"Nifedipino",category:"tratamento",subgroup:"Anti-hipertensivos",time_min:.25,points:0,result:"Nifedipino administrado."},
    {id:"nitroprusside",label:"Nitroprussiato de sódio",category:"tratamento",subgroup:"Anti-hipertensivos",time_min:.25,points:0,result:"Nitroprussiato de sódio iniciado."},
    {id:"vasopressin",label:"Vasopressina",category:"tratamento",subgroup:"Vasoativos",time_min:.25,points:0,result:"Vasopressina iniciada."},
    {id:"phenylephrine",label:"Fenilefrina",category:"tratamento",subgroup:"Vasoativos",time_min:.25,points:0,result:"Fenilefrina iniciada."},
    {id:"methimazole",label:"Metimazol",category:"tratamento",subgroup:"Endócrinos",time_min:.25,points:0,result:"Metimazol administrado."},
    {id:"propylthiouracil",label:"Propiltiouracil",category:"tratamento",subgroup:"Endócrinos",time_min:.25,points:0,result:"Propiltiouracil administrado."},
    {id:"potassium_iodide",label:"Iodeto de potássio",category:"tratamento",subgroup:"Endócrinos",time_min:.25,points:0,result:"Iodeto de potássio administrado."},
    {id:"potassium_chloride",label:"Cloreto de potássio",category:"tratamento",subgroup:"Eletrólitos",time_min:.25,points:0,result:"Cloreto de potássio administrado."},
    {id:"calcium_gluconate",label:"Gluconato de cálcio",category:"tratamento",subgroup:"Eletrólitos",time_min:.25,points:0,result:"Gluconato de cálcio administrado."},
    {id:"sodium_polystyrene",label:"Poliestirenossulfonato de sódio",category:"tratamento",subgroup:"Eletrólitos",time_min:.25,points:0,result:"Poliestirenossulfonato administrado."},
    {id:"oxytocin",label:"Ocitocina",category:"tratamento",subgroup:"Obstetrícia",time_min:.25,points:0,result:"Ocitocina administrada."},
    {id:"misoprostol",label:"Misoprostol",category:"tratamento",subgroup:"Obstetrícia",time_min:.25,points:0,result:"Misoprostol administrado."},
    {id:"methylergometrine",label:"Metilergometrina",category:"tratamento",subgroup:"Obstetrícia",time_min:.25,points:0,result:"Metilergometrina administrada."},
    {id:"carboprost",label:"Carboprost",category:"tratamento",subgroup:"Obstetrícia",time_min:.25,points:0,result:"Carboprost administrado."},
    {id:"anti_d_immunoglobulin",label:"Imunoglobulina anti-D",category:"tratamento",subgroup:"Obstetrícia",time_min:.25,points:0,result:"Imunoglobulina anti-D administrada."},
    {id:"methotrexate",label:"Metotrexato",category:"tratamento",subgroup:"Obstetrícia",time_min:.25,points:0,result:"Metotrexato administrado conforme indicação selecionada."},
    {id:"terbutaline",label:"Terbutalina",category:"tratamento",subgroup:"Obstetrícia",time_min:.25,points:0,result:"Terbutalina administrada."},
    {id:"tamsulosin",label:"Tansulosina",category:"tratamento",subgroup:"Urológicos",time_min:.25,points:0,result:"Tansulosina administrada."},
    {id:"finasteride",label:"Finasterida",category:"tratamento",subgroup:"Urológicos",time_min:.25,points:0,result:"Finasterida administrada."},
    {id:"benztropine",label:"Biperideno",category:"tratamento",subgroup:"Neurológicos",time_min:.25,points:0,result:"Biperideno administrado."},
    {id:"phenytoin",label:"Fenitoína",category:"tratamento",subgroup:"Neurológicos",time_min:.25,points:0,result:"Fenitoína administrada."},
    {id:"valproate",label:"Valproato de sódio",category:"tratamento",subgroup:"Neurológicos",time_min:.25,points:0,result:"Valproato de sódio administrado."},
    {id:"thiamine",label:"Tiamina",category:"tratamento",subgroup:"Toxicologia",time_min:.25,points:0,result:"Tiamina administrada."},
    {id:"fomepizole",label:"Fomepizol",category:"tratamento",subgroup:"Antídotos",time_min:.25,points:0,result:"Fomepizol administrado."},
    {id:"activated_charcoal",label:"Carvão ativado",category:"tratamento",subgroup:"Toxicologia",time_min:.25,points:0,result:"Carvão ativado administrado conforme indicação."},
    {id:"acetylcysteine",label:"N-acetilcisteína",category:"tratamento",subgroup:"Antídotos",time_min:.25,points:0,result:"N-acetilcisteína administrada."}
  ];

  function diagnosisSubgroup(item){
    const text=normalizeLabel([item?.title,item?.specialty].filter(Boolean).join(" "));
    if(/infarto|coronar|angina|fibrilacao|taquic|bradic|pericard|cardio|aort|tampon|edema agudo de pulmao|estenose aortica/.test(text)) return "Cardíacas e vasculares";
    if(/pneum|asma|dpoc|bronq|pleur|hemopt|toracica|respirat|epiglot|crupe|laring/.test(text)) return "Respiratórias";
    if(/avc|hemorragia subarac|mening|convuls|epilep|guillain|miasten|neurol|tce|hematoma epidural|hematoma subdural|cauda equina/.test(text)) return "Neurológicas";
    if(/sepse|septic|celulit|erisip|abscesso|infect|meningococ|pielonefr|pneumonia|endometrit|mastit|fasceite|artrite septica|impetigo/.test(text)) return "Infecciosas";
    if(/diabet|cetoacid|hiperosm|hipoglic|hiperglic|hiper?calem|hipocalem|hiponatrem|tireo|adrenal|metabol/.test(text)) return "Endócrinas e metabólicas";
    if(/apendic|colec|colang|pancreat|obstrucao|volvulo|invagin|perfur|divert|hernia|hemorragia digest|gastr|reflux|dispeps|constip|diarreia|periton|isquemia mesenter/.test(text)) return "Gastrointestinais e cirúrgicas";
    if(/renal|urin|cistite|epidid|orquite|hidrocele|varicocele|parafim|fimose|balan|colica renal|retencao urinaria/.test(text)) return "Renais e urológicas";
    if(/gesta|gravidez|aborta|eclamps|placenta|puerper|parto|vagino|vulvo|cervic|ovar|uter|mamari|mastalgia|endometr|dismen|barthol|tricomon|sifilis/.test(text)) return "Ginecológicas e obstétricas";
    if(/intoxic|abstin|alcool|metanol|salicil|cocaina|cafeina|opioide|benzodiazep|simpatomim/.test(text)) return "Toxicológicas";
    if(/trauma|fratura|luxacao|entorse|queimadura|ferimento|contus|mordedura|escori|afogamento|tornozelo|ombro|punho|joelho|costal/.test(text)) return "Trauma e ortopedia";
    if(/dermat|urtic|escab|tinea|herpes|folicul|intertrigo|onicocrip|paroniq|varicela|molusco|pedicul/.test(text)) return "Dermatológicas";
    if(/conjunt|cerat|blefar|horde|ocular/.test(text)) return "Oftalmológicas";
    if(/otite|sinus|rinite|faring|epistaxe|cerume|corpo estranho nasal|corpo estranho em ouvido/.test(text)) return "Otorrino";
    if(String(item?.specialty||"")==="Pediatria") return "Pediátricas";
    return "Outras hipóteses";
  }

  function allCaseDiagnoses(){
    const seen=new Set();
    return state.cases
      .filter(item=>item?.title)
      .filter(item=>{
        const key=normalizeLabel(item.title);
        if(seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((item,index)=>({
        id:"catalog_dx_"+index,
        role:"diagnosis",
        label:item.title,
        category:"hipoteses",
        subgroup:diagnosisSubgroup(item),
        time_min:.1,
        points:0,
        genericDiagnosis:true
      }));
  }

  const GENERAL_DISPOSITIONS = [
    {id:"generic_dest_discharge",role:"disposition",label:"Alta domiciliar",category:"destino",subgroup:"Conduta final",time_min:.1,points:0,genericDisposition:true},
    {id:"generic_dest_observation",role:"disposition",label:"Observação hospitalar",category:"destino",subgroup:"Conduta final",time_min:.1,points:0,genericDisposition:true},
    {id:"generic_dest_ward",role:"disposition",label:"Internação em enfermaria / unidade monitorizada",category:"destino",subgroup:"Conduta final",time_min:.1,points:0,genericDisposition:true},
    {id:"generic_dest_icu",role:"disposition",label:"Internação em UTI",category:"destino",subgroup:"Conduta final",time_min:.1,points:0,genericDisposition:true},
    {id:"generic_refer_none",label:"Não encaminhar",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Atendimento mantido sem encaminhamento para outra especialidade."},
    {id:"generic_refer_surgery",label:"Cirurgia Geral",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Cirurgia Geral acionada."},
    {id:"generic_refer_cardio",label:"Cardiologia",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Cardiologia acionada."},
    {id:"generic_refer_neuro",label:"Neurologia",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Neurologia acionada."},
    {id:"generic_refer_ortho",label:"Ortopedia",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Ortopedia acionada."},
    {id:"generic_refer_vascular",label:"Cirurgia Vascular",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Cirurgia Vascular acionada."},
    {id:"generic_refer_urology",label:"Urologia",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Urologia acionada."},
    {id:"generic_refer_obgyn",label:"Ginecologia e Obstetrícia",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Ginecologia e Obstetrícia acionada."},
    {id:"generic_refer_psych",label:"Psiquiatria",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Psiquiatria acionada."},
    {id:"generic_refer_pediatrics",label:"Pediatria",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Pediatria acionada."},
    {id:"generic_refer_infectious",label:"Infectologia",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Infectologia acionada."},
    {id:"generic_refer_pulmonology",label:"Pneumologia",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Pneumologia acionada."},
    {id:"generic_refer_gastro",label:"Gastroenterologia",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Gastroenterologia acionada."},
    {id:"generic_refer_nephro",label:"Nefrologia",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Nefrologia acionada."},
    {id:"generic_refer_hematology",label:"Hematologia",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Hematologia acionada."},
    {id:"generic_refer_endocrine",label:"Endocrinologia",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Endocrinologia acionada."}
  ];

  const HIDDEN_CASE_ACTIONS = new Set(["shock1","shock2","shock3","electrolytes","cxr","ct_brain"]);
  function caseActions(){ return Array.isArray(state.current?.actions) ? state.current.actions : []; }
  function normalizeLabel(value){ return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase(); }

  function physicalExamResult(action) {
    if(!action || action.category!=="exame") return action?.result || "";
    const custom=state.current?.presentation?.physical_exam;
    if(custom && typeof custom==="object" && custom[action.id]) return String(custom[action.id]);

    const title=normalizeLabel(state.current?.title);
    const opening=normalizeLabel([state.current?.presentation?.opening,state.current?.presentation?.chief_complaint].filter(Boolean).join(" "));
    const text=title+" "+opening;
    const v=state.vitals||state.current?.initial_vitals||{};
    const hr=Number(v.hr), rr=Number(v.rr), spo2=Number(v.spo2), temp=Number(v.temp);
    const mental=String(v.mental||"").trim();
    const bp=String(v.bp||"").trim();
    const hypotensive=/^\s*(?:[0-8]?\d|9[0-2])\s*\//.test(bp);
    const febrile=Number.isFinite(temp)&&temp>=38;
    const hypox=Number.isFinite(spo2)&&spo2<92;

    switch(action.id){
      case "exam_ectoscopy":{
        const parts=[];
        parts.push(mental ? "Estado geral: "+mental+"." : "Paciente responsivo durante a avaliação.");
        if(hypotensive) parts.push("Aspecto de hipoperfusão, com palidez e prostração.");
        else if(/choque|sepse|anafilax|hemorrag|sangramento/.test(text)) parts.push("Paciente com aspecto de doença aguda e desconforto evidente.");
        else parts.push("Sem sinais externos de choque à inspeção.");
        if(febrile) parts.push("Pele quente ao toque, compatível com febre.");
        if(hypox || /dispne|asma|edema agudo|pneumotorax|embolia pulmonar|bronquiolite|pneumonia/.test(text)) parts.push("Padrão respiratório aumentado, com desconforto respiratório perceptível.");
        else if(Number.isFinite(rr)) parts.push("Padrão respiratório sem esforço importante visível.");
        return parts.join(" ");
      }
      case "exam_head":
        if(/trauma cran|tce|hematoma epidural|hematoma subdural/.test(text)) return "Crânio e face examinados em busca de ferimentos, hematomas, deformidades, dor à palpação, sinais de fratura de base e assimetrias; há achados traumáticos compatíveis com o mecanismo descrito no caso.";
        if(/celulite|erisipela.*face|angioedema/.test(text)) return "Face inspecionada: edema e alterações de partes moles são avaliados quanto a extensão, simetria, calor, hiperemia e progressão.";
        return "Crânio normocefálico, face simétrica, sem deformidades, hematomas, dor focal ou sinais externos de trauma.";
      case "exam_eyes":
        if(/conjuntivite bacteriana/.test(text)) return "Hiperemia conjuntival difusa com secreção mucopurulenta; córnea transparente, pupila fotorreagente e sem dor ocular profunda.";
        if(/conjuntivite viral/.test(text)) return "Hiperemia conjuntival aquosa, secreção serosa e sem opacidade corneana; pupila fotorreagente.";
        if(/ceratite/.test(text)) return "Olho doloroso e hiperemiado, com fotofobia; córnea apresenta alteração focal compatível com ceratite e deve ser examinada com fluoresceína.";
        if(/corpo estranho superficial ocular/.test(text)) return "Hiperemia e lacrimejamento no olho acometido; corpo estranho superficial visível ou defeito epitelial à fluoresceína, sem deformidade pupilar.";
        if(/blefarite/.test(text)) return "Bordas palpebrais hiperemiadas, com crostas/descamação junto aos cílios; conjuntiva sem alteração grave.";
        if(/hordeolo/.test(text)) return "Nódulo palpebral focal, doloroso e hiperemiado junto à margem ciliar, compatível com hordéolo.";
        if(/avc|hemorragia subaracnoidea|meningite|encefal|intoxic|coma|convuls|trauma cran/.test(text)) return "Pupilas avaliadas quanto a diâmetro, simetria e fotorreação; motilidade ocular e desvio conjugado do olhar pesquisados, junto ao restante do exame neurológico.";
        if(/tireotoxic|hipertireoid/.test(text)) return "Retração palpebral e olhar vivo; pesquisa de proptose, hiperemia conjuntival e limitação da motilidade ocular. Pupilas fotorreagentes.";
        return "Conjuntivas sem hiperemia importante; córneas transparentes; pupilas isocóricas e fotorreagentes; motilidade ocular extrínseca preservada.";
      case "exam_ears":
        if(/otite externa/.test(text)) return "Dor à mobilização do trago/pavilhão; conduto auditivo externo hiperemiado e edemaciado, podendo haver secreção. Membrana timpânica sem abaulamento quando visualizada.";
        if(/otite media aguda/.test(text)) return "Membrana timpânica opaca, hiperemiada e abaulada, com perda dos reparos anatômicos e mobilidade reduzida; conduto sem edema importante.";
        if(/cerume impactado/.test(text)) return "Conduto auditivo preenchido por cerume impactado, dificultando ou impedindo a visualização da membrana timpânica.";
        if(/corpo estranho em ouvido/.test(text)) return "Corpo estranho visível no conduto auditivo externo; são avaliados edema, sangramento, secreção e integridade da membrana timpânica antes da retirada.";
        if(/mastoidite/.test(text)) return "Alteração otoscópica compatível com otite média associada a dor, hiperemia e edema retroauricular/mastoideo.";
        return "Pavilhões e condutos auditivos livres; membranas timpânicas íntegras, translúcidas, sem abaulamento, perfuração ou secreção.";
      case "exam_nose":
        if(/epistaxe anterior/.test(text)) return "Sangramento anterior visível em cavidade nasal, geralmente em septo anterior; sem sinais de sangramento posterior volumoso na inspeção inicial.";
        if(/corpo estranho nasal/.test(text)) return "Corpo estranho unilateral visível em cavidade nasal, com obstrução e possível secreção local; sem sangramento importante.";
        if(/rinite alergica/.test(text)) return "Mucosa nasal pálida e edemaciada, com cornetos aumentados e secreção aquosa bilateral.";
        if(/sinusite bacteriana|rinossinusite/.test(text)) return "Mucosa nasal edemaciada com secreção espessa; dor/sensibilidade sobre seios da face no território sintomático.";
        return "Mucosa nasal sem sangramento ativo ou secreção purulenta; fossas nasais pérvias e sem dor importante nos seios da face.";
      case "exam_mouth":
        if(/faringoamigdalite estreptococica/.test(text)) return "Orofaringe hiperemiada, amígdalas aumentadas com exsudato e petéquias palatinas; sem sinais de abscesso peritonsilar.";
        if(/faringite viral/.test(text)) return "Orofaringe hiperemiada, sem exsudato purulento exuberante; ausência de assimetria peritonsilar ou desvio de úvula.";
        if(/candidiase oral/.test(text)) return "Placas esbranquiçadas aderidas à mucosa oral/língua, removíveis à raspagem com base eritematosa.";
        if(/gengivoestomatite herpetica/.test(text)) return "Gengiva hiperemiada e friável, com múltiplas vesículas/úlceras dolorosas em mucosa oral.";
        if(/estomatite aftosa/.test(text)) return "Úlcera oral rasa, dolorosa, de base esbranquiçada/amarelada e halo eritematoso, sem sinais de infecção profunda.";
        if(/herpangina/.test(text)) return "Pequenas vesículas/úlceras em palato mole e pilares amigdalianos, com hiperemia de orofaringe.";
        if(/doenca mao-pe-boca/.test(text)) return "Vesículas/úlceras dolorosas na cavidade oral, em conjunto com as lesões cutâneas típicas do quadro.";
        if(/abscesso peritonsilar/.test(text)) return "Assimetria de orofaringe com abaulamento peritonsilar, desvio contralateral da úvula, trismo e voz abafada.";
        if(/desidrat|cetoacid|hiperosmolar/.test(text)) return "Mucosa oral seca e saliva espessa, compatíveis com desidratação; sem obstrução mecânica da orofaringe.";
        return "Mucosa oral úmida, dentição sem foco evidente; orofaringe sem exsudato, edema importante, assimetria ou lesões agudas.";
      case "exam_airway":
        if(/anafilax|angioedema|epiglot|obstrucao de via aerea/.test(text)) return "Via aérea examinada imediatamente: voz, estridor, sialorreia, edema de lábios/língua/orofaringe e capacidade de manejar secreções avaliados; há risco de comprometimento de via aérea compatível com o caso.";
        return "Via aérea pérvia; paciente consegue vocalizar, sem estridor, sialorreia, secreções obstrutivas ou edema orofaríngeo importante.";
      case "exam_neck":
        if(/meningite|hemorragia subaracnoidea/.test(text)) return "Pescoço avaliado quanto a rigidez de nuca e sinais meníngeos; linfonodos, massas e mobilidade cervical também examinados.";
        if(/insuficiencia cardiaca|edema agudo|tamponamento/.test(text)) return "Pescoço examinado com atenção à pressão venosa jugular, refluxo hepatojugular, mobilidade cervical, massas e linfonodos.";
        return "Pescoço móvel, sem rigidez de nuca; sem linfonodomegalias ou massas cervicais evidentes; jugulares sem turgência importante em repouso.";
      case "exam_thyroid":
        if(/tireotoxic|hipertireoid|tempestade tireoid/.test(text)) return "Tireoide inspecionada e palpada quanto a bócio, nódulos, dor, sopro e mobilidade; tremor fino, pele quente/úmida e sinais oculares são pesquisados em conjunto.";
        return "Tireoide sem aumento evidente, nódulo dominante ou dor à palpação; mobilidade à deglutição preservada.";
      case "exam_neuro":
        if(/avc isquemico|avc de circulacao posterior/.test(text)) return "Déficit neurológico focal de início agudo: assimetria de força/sensibilidade e alteração de fala ou coordenação compatíveis com o território acometido; pupilas fotorreagentes.";
        if(/avc hemorragico|hemorragia subaracnoidea/.test(text)) return "Nível de consciência reduzido em relação ao basal, cefaleia intensa e possível déficit focal; pupilas fotorreagentes, sem sinais de hipoglicemia como explicação.";
        if(/meningite/.test(text)) return "Rigidez de nuca presente, fotofobia e desconforto à flexão cervical; sem déficit focal motor grosseiro no exame inicial.";
        if(/convuls|estado de mal/.test(text)) return "Paciente em período ictal/pós-ictal conforme o momento do caso, com rebaixamento transitório da consciência e recuperação neurológica a ser acompanhada.";
        if(/tce|trauma cran|hematoma epidural|hematoma subdural/.test(text)) return "Alteração do nível de consciência compatível com TCE, com avaliação de Glasgow e pesquisa de anisocoria/déficit focal; achados neurológicos acompanham a gravidade descrita.";
        return "Consciente e orientado; fala clara; pupilas isocóricas e fotorreagentes; pares cranianos sem déficit grosseiro; força e sensibilidade preservadas e simétricas, sem déficit focal aparente.";
      case "exam_chest":
        if(/asma|broncoespasmo/.test(text)) return "Taquipneia, uso de musculatura acessória e expiração prolongada; sibilos difusos bilateralmente, com murmúrio vesicular reduzido nas crises mais graves.";
        if(/edema agudo|insuficiencia cardiaca/.test(text)) return "Ausculta pulmonar com estertores crepitantes, predominando em bases, em contexto de dispneia/ortopneia; expansibilidade avaliada bilateralmente.";
        if(/pneumotorax hipertensivo/.test(text)) return "Expansibilidade reduzida no hemitórax acometido, murmúrio vesicular abolido ou muito diminuído e hipertimpanismo à percussão, com esforço respiratório importante.";
        if(/pneumonia|choque septico pulmonar/.test(text)) return "Crepitações focais e redução localizada do murmúrio vesicular no território acometido; pode haver sopro tubário e aumento do frêmito tóraco-vocal.";
        if(/embolia pulmonar/.test(text)) return "Taquipneia e esforço respiratório podem estar presentes; ausculta pode ser pouco específica, sem achado focal obrigatório apesar da hipoxemia.";
        return "Tórax simétrico, expansibilidade bilateral preservada; murmúrio vesicular presente nos dois hemitórax, sem sibilos, roncos ou crepitações relevantes.";
      case "exam_cardio":{
        const arr=[];
        if(Number.isFinite(hr)) arr.push("Frequência cardíaca de aproximadamente "+Math.round(hr)+" bpm.");
        if(/fibrilacao atrial/.test(text)) arr.push("Ritmo irregular à palpação/ausculta.");
        else if(/taquicardia ventricular|taquicardia supraventricular/.test(text)) arr.push("Ritmo taquicárdico.");
        else if(/bradicardia/.test(text)) arr.push("Ritmo bradicárdico.");
        else arr.push("Bulhas cardíacas audíveis, sem sopro evidente ao exame inicial.");
        if(/tamponamento/.test(text)) arr.push("Bulhas hipofonéticas, turgência jugular e sinais de baixo débito/perfusão periférica reduzida.");
        if(hypotensive) arr.push("Perfusão periférica reduzida em contexto de hipotensão.");
        return arr.join(" ");
      }
      case "exam_breast":
        if(/mastite|abscesso mamario|puerperal/.test(text)) return "Mamas inspecionadas e palpadas: pesquisa de hiperemia, calor, dor, endurecimento, flutuação, fissuras mamilares e drenagem. Há alteração focal compatível com o quadro mamário descrito.";
        return "Mamas sem hiperemia, calor, massa dolorosa, flutuação ou secreção anormal evidente ao exame.";
      case "exam_abdomen":
        if(/apendicite/.test(text)) return "Dor predominante em fossa ilíaca direita, com defesa localizada e dor à descompressão; sinais de irritação peritoneal podem estar presentes conforme a evolução.";
        if(/colecistite/.test(text)) return "Dor à palpação do hipocôndrio direito, com sinal de Murphy positivo; sem rigidez abdominal difusa.";
        if(/pancreatite/.test(text)) return "Dor importante em epigástrio, com sensibilidade à palpação profunda e sem sinais peritoneais exuberantes na apresentação típica.";
        if(/obstrucao intestinal|volvulo/.test(text)) return "Abdômen distendido e timpânico, com ruídos hidroaéreos aumentados/metálicos inicialmente e dor difusa, sem peritonismo obrigatório no início.";
        if(/peritonite|perfuracao de viscera/.test(text)) return "Abdômen rígido, muito doloroso, com defesa involuntária e descompressão brusca positiva, compatível com irritação peritoneal.";
        if(/isquemia mesenterica/.test(text)) return "Dor abdominal intensa desproporcional aos achados iniciais de palpação, com abdômen relativamente pouco exuberante nas fases precoces.";
        if(/gravidez ectopica/.test(text)) return "Dor pélvica intensa, mais evidente em um dos quadrantes inferiores, com defesa e sinais de irritação peritoneal quando há hemoperitônio.";
        if(/cetoacid|hiperosmolar/.test(text)) return "Abdômen sem sinais de irritação peritoneal; dor difusa pode acompanhar o distúrbio metabólico, devendo ser reavaliada após estabilização.";
        return "Abdômen plano, flácido, ruídos hidroaéreos presentes; indolor à palpação superficial e profunda, sem defesa, rigidez ou massa palpável.";
      case "exam_back":
        if(/pielonefr/.test(text)) return "Dor à punho-percussão lombar (Giordano) no lado acometido, associada a sensibilidade em flanco.";
        if(/colica renal|litia|uropatia/.test(text)) return "Dor intensa em flanco/lombar, sem sinais de irritação peritoneal; punho-percussão pode reproduzir o desconforto.";
        if(/aneurisma de aorta|sindrome aortica/.test(text)) return "Dorso examinado em busca de dor intensa, assimetria, sinais de hipoperfusão e outras pistas vasculares associadas ao quadro.";
        return "Dorso sem lesões ou deformidades aparentes; punho-percussão lombar sem dor significativa bilateralmente.";
      case "exam_spine":
        if(/trauma|queda|acidente/.test(text)) return "Coluna cervical, torácica e lombar avaliadas quanto a dor em linha média, deformidade, degrau, déficit neurológico e necessidade de manutenção de imobilização.";
        return "Coluna sem deformidade ou dor importante à palpação da linha média; mobilidade preservada quando clinicamente segura.";
      case "exam_gyne":
        if(/placenta previa/.test(text)) return "Sangramento vaginal vermelho vivo ao exame externo/especular; toque vaginal digital não é realizado antes de excluir placenta prévia.";
        if(/descolamento prematuro|dpp/.test(text)) return "Útero hipertônico e doloroso à palpação, com sangramento vaginal variável; há dor abdominal contínua.";
        if(/gravidez ectopica/.test(text)) return "Sangramento vaginal discreto/moderado, dor anexial unilateral e dor à mobilização do colo, conforme estabilidade do caso.";
        if(/abortamento/.test(text)) return "Sangramento vaginal com coágulos/material eliminado; colo uterino pode estar aberto no abortamento em evolução e fechado após esvaziamento completo.";
        if(/doenca inflamatoria pelvica/.test(text)) return "Dor à mobilização do colo e dor anexial/uterina ao toque bimanual, com corrimento cervical patológico.";
        if(/torcao ovariana/.test(text)) return "Dor anexial intensa e unilateral à palpação, com defesa pélvica e possível massa anexial dolorosa.";
        if(/eclampsia|pre-eclampsia/.test(text)) return "Sem sangramento vaginal significativo; útero compatível com idade gestacional, com avaliação obstétrica direcionada ao bem-estar fetal.";
        return "Genitália externa sem lesões evidentes; exame especular/toque bimanual sem sangramento significativo, corrimento patológico, dor cervical ou massa anexial ao exame inicial.";
      case "exam_gu":
        if(/torcao testicular/.test(text)) return "Testículo acometido elevado e muito doloroso, com orientação horizontal e reflexo cremastérico ausente no lado sintomático.";
        if(/epididim/.test(text)) return "Epidídimo aumentado e doloroso, com edema escrotal; reflexo cremastérico preservado.";
        if(/orquite/.test(text)) return "Testículo aumentado, edemaciado e doloroso, com hiperemia escrotal.";
        if(/retencao urinaria/.test(text)) return "Globo vesical palpável e doloroso em hipogástrio, compatível com retenção urinária.";
        if(/priapismo/.test(text)) return "Ereção persistente e dolorosa dos corpos cavernosos, com glande relativamente flácida no priapismo isquêmico.";
        return "Genitália externa sem edema, lesão ou secreção relevante; regiões inguinais sem hérnia evidente; sem distensão suprapúbica importante.";
      case "exam_rectal":
        if(/hemorragia digestiva alta|melena/.test(text)) return "Toque retal com fezes enegrecidas/melênicas, sem massa palpável.";
        if(/hematoquezia|sangramento retal/.test(text)) return "Sangue vermelho vivo ao toque/inspeção, sem descrição de massa obstrutiva no exame inicial.";
        if(/abscesso perianal/.test(text)) return "Tumefação perianal muito dolorosa, hiperemiada e flutuante, com dor intensa à palpação.";
        return "Região perianal sem lesão evidente; toque retal sem sangue macroscópico, massa ou dor importante quando clinicamente indicado.";
      case "exam_upper":
        if(/avc|neurolog/.test(text)) return "Membros superiores avaliados quanto a força, sensibilidade, simetria, pulsos e sinais de déficit focal.";
        return "Membros superiores simétricos, sem edema ou deformidade; pulsos radiais palpáveis e simétricos, perfusão distal preservada.";
      case "exam_lower":
        if(/embolia pulmonar|trombose venosa|tvp/.test(text)) return "Edema e aumento de circunferência unilateral de membro inferior, com dor/empastamento de panturrilha; pulsos arteriais preservados.";
        if(/isquemia aguda|arterial/.test(text)) return "Membro frio, pálido, doloroso, com redução/ausência de pulso distal e enchimento capilar lentificado; déficit sensitivo ou motor pode surgir nos quadros avançados.";
        return "Membros inferiores simétricos, sem edema importante; panturrilhas sem empastamento; pulsos periféricos palpáveis e simétricos.";
      case "exam_msk":
        if(/artrite septica/.test(text)) return "Articulação muito dolorosa, quente e edemaciada, com limitação importante tanto do movimento ativo quanto passivo.";
        if(/fratura/.test(text)) return "Dor focal intensa, edema e possível deformidade no segmento acometido, com avaliação neurovascular distal documentada.";
        if(/luxacao/.test(text)) return "Deformidade articular evidente, dor e perda da amplitude de movimento, com perfusão e sensibilidade distal avaliadas.";
        if(/trauma/.test(text)) return "Dor e edema localizados no segmento traumatizado, com limitação funcional proporcional ao mecanismo e sem déficit neurovascular quando não descrito.";
        return "Sem deformidades musculoesqueléticas evidentes; amplitude de movimento global preservada nas articulações não dolorosas, sem edema articular importante.";
      case "exam_extremities":
        return hypotensive || /choque|sepse|hemorrag|anafilax/.test(text)
          ? "Extremidades avaliadas quanto a temperatura, coloração, pulsos e enchimento capilar; há sinais de perfusão periférica reduzida compatíveis com instabilidade hemodinâmica."
          : "Extremidades aquecidas e bem perfundidas; pulsos periféricos palpáveis e simétricos; enchimento capilar inferior a 2 segundos.";
      case "exam_skin":
        if(/anafilax|urticaria/.test(text)) return "Placas urticariformes eritematosas e pruriginosas, podendo haver angioedema de lábios/pálpebras no quadro sistêmico.";
        if(/meningococcemia|purpura|petéquias/.test(text)) return "Petéquias e lesões purpúricas não desaparecem à digitopressão, com perfusão periférica reduzida nos casos de choque.";
        if(/fasceite/.test(text)) return "Área eritematosa e edemaciada com dor desproporcional ao aspecto inicial, podendo haver bolhas, alteração de sensibilidade e crepitação em evolução.";
        if(/erisipela/.test(text)) return "Placa eritematosa quente, dolorosa, edemaciada e bem delimitada, frequentemente em membro inferior.";
        if(/celulite/.test(text)) return "Área de eritema, calor, edema e dor com limites menos definidos, sem crepitação ou necrose no quadro não complicado.";
        return "Pele íntegra, sem exantema, petéquias ou lesões agudas relevantes; mucosas coradas e sem cianose ou icterícia.";
      default:
        return "Sem alteração objetiva relevante neste segmento ao exame atual.";
    }
  }

  // V7: transforma os tópicos de anamnese importados da planilha em perguntas clicáveis.
  // Cada caso pode ter quantas perguntas forem necessárias, sem depender de actions legadas.

  function clinicalContextText(){
    return normalizeLabel([
      state.current?.title,
      state.current?.summary,
      state.current?.presentation?.opening,
      state.current?.presentation?.chief_complaint
    ].filter(Boolean).join(" "));
  }

  function isGenericHistoryAnswer(answer){
    const a=normalizeLabel(answer);
    return !a
      || a.includes("informacao nao disponivel")
      || a.includes("alem desses sintomas")
      || a.includes("alem dessas queixas")
      || a.includes("nao percebi nenhum outro")
      || a.includes("nao houve trauma")
      || a.includes("nao identifiquei um gatilho")
      || a.includes("nao consigo apontar")
      || a.includes("nao tenho doenca cronica importante")
      || a.includes("nao ha antecedente medico relevante")
      || a.includes("nao uso medicacao continua")
      || a.includes("nao tenho remedios de uso habitual")
      || a.includes("os sintomas comecaram antes da chegada")
      || a.includes("o quadro apareceu sem um fator")
      || a.includes("ate entao eu seguia minha rotina habitual");
  }

  function contextualHistoryAnswer(topic,answer){
    if(!isGenericHistoryAnswer(answer)) return answer;
    const t=clinicalContextText();
    const k=normalizeLabel(topic);

    if(k.includes("sintomas associados")){
      if(/iam|sindrome coronariana|angina/.test(t)) return "Junto com a dor vieram suor frio, náusea e sensação de fraqueza; não notei piora da dor apenas ao apertar o peito.";
      if(/embolia pulmonar/.test(t)) return "A falta de ar veio acompanhada de dor que piora ao respirar e sensação de coração acelerado; não tive tosse com secreção.";
      if(/asma|broncoespasmo/.test(t)) return "Além da falta de ar, estou com chiado e aperto no peito; falar frases longas e caminhar pioram bastante.";
      if(/pneumonia/.test(t)) return "Tenho tosse, febre e cansaço para respirar; em alguns momentos sinto dor no peito ao inspirar fundo.";
      if(/sepse|pielonefrite/.test(t)) return "Além da febre, fiquei muito fraco, com calafrios e menos disposto; nas últimas horas comecei a ficar mais sonolento/tonto.";
      if(/cetoacidose/.test(t)) return "Além dos vômitos e da sede, estou urinando muito, com dor abdominal e respirando de forma mais funda e rápida.";
      if(/hipoglicemia/.test(t)) return "Tive suor frio, tremores, fome e depois comecei a ficar confuso e sonolento.";
      if(/avc|acidente vascular/.test(t)) return "A fraqueza veio de repente, acompanhada de alteração da fala; não senti dor importante antes do início.";
      if(/meningite/.test(t)) return "Tenho dor de cabeça forte, febre, náusea e incômodo com a luz; mexer o pescoço piora a dor.";
      if(/hemorragia digestiva/.test(t)) return "Depois de vomitar sangue fiquei muito tonto, fraco e suando frio, principalmente quando tento sentar ou levantar.";
      if(/pancreatite/.test(t)) return "A dor é forte na parte alta da barriga, vai para as costas e vem acompanhada de náuseas e vômitos.";
      if(/colecistite/.test(t)) return "Tenho náusea, falta de apetite e febre; a dor fica concentrada do lado direito, principalmente depois de comer.";
      if(/apendicite/.test(t)) return "Perdi o apetite, fiquei enjoado e a dor, que começou mais difusa, passou a se concentrar no lado direito inferior da barriga.";
      if(/gravidez ectopica|abortamento|sangramento.*gravidez/.test(t)) return "Além do sangramento, tenho cólicas ou dor pélvica e sensação de fraqueza conforme a perda aumenta.";
      if(/eclampsia|pre-eclampsia/.test(t)) return "Estou com dor de cabeça forte, visão embaçada e náusea; também percebi inchaço maior nos últimos dias.";
      if(/panico/.test(t)) return "Senti coração muito acelerado, falta de ar, tremores, formigamento nas mãos e uma sensação súbita de que algo muito ruim ia acontecer.";
      if(/conjuntivite|blefarite|ceratite|hordeolo/.test(t)) return "O incômodo fica principalmente no olho/pálpebra afetado, com vermelhidão, lacrimejamento ou secreção; não tive sintomas gerais importantes.";
      return "Não percebi outro sintoma marcante além dos que fazem parte deste episódio.";
    }

    if(k.includes("antecedentes")){
      if(/asma/.test(t)) return "Tenho asma e já tive crises antes, mas esta está mais intensa e respondeu pouco à medicação de resgate.";
      if(/dpoc/.test(t)) return "Tenho DPOC e histórico de tabagismo; já tive pioras antes, mas esta veio com mais falta de ar que o habitual.";
      if(/diabet|cetoacid|hipoglic|hiperglic/.test(t)) return "Tenho diabetes e faço tratamento regular; já tive alterações da glicose antes, mas não costumo ficar assim.";
      if(/fibrilacao atrial|arritm/.test(t)) return "Já fui diagnosticado com arritmia e faço acompanhamento cardiológico.";
      if(/insuficiencia cardiaca|edema agudo/.test(t)) return "Tenho hipertensão e problema cardíaco em acompanhamento, com episódios prévios de inchaço e falta de ar.";
      if(/doenca renal|renal|dialise|hipercalemia/.test(t)) return "Tenho doença renal crônica e faço acompanhamento; quando indicado, realizo diálise regularmente.";
      if(/gesta|gravidez|eclamps|placenta|abort/.test(t)) return "Estou em acompanhamento obstétrico e sei aproximadamente a idade gestacional; até este episódio, a evolução vinha sem intercorrência semelhante.";
      return "Não tenho antecedente diretamente relacionado a este quadro e nunca tive um episódio exatamente igual.";
    }

    if(k.includes("medicamentos")){
      if(/bradicardia.*betabloqueador/.test(t)) return "Uso betabloqueador diariamente e houve erro/duplicação recente da dose antes do início da tontura.";
      if(/asma|dpoc/.test(t)) return "Uso medicação inalatória habitual e tentei a medicação de resgate antes de vir, sem melhora suficiente.";
      if(/diabet|cetoacid|hiperglic|hipoglic/.test(t)) return "Uso medicação para diabetes; houve dificuldade recente para manter alimentação, hidratação ou tratamento como de costume.";
      if(/fibrilacao atrial/.test(t)) return "Uso os medicamentos prescritos para o coração; não comecei nenhuma droga nova nas últimas horas.";
      if(/hipertens/.test(t)) return "Uso anti-hipertensivos diariamente e não fiz mudança intencional recente na prescrição.";
      return "Não tomei nenhuma medicação nova especificamente para este episódio antes de chegar.";
    }

    if(k.includes("contexto") || k.includes("fatores de risco")){
      if(/embolia pulmonar|trombose/.test(t)) return "Houve imobilização/viagem prolongada ou outro fator trombótico recente antes do início dos sintomas.";
      if(/anafilax/.test(t)) return "Os sintomas começaram minutos depois de uma exposição alimentar, medicamentosa ou outro possível alérgeno.";
      if(/sindrome coronariana associada a cocaina|cocaina/.test(t)) return "Houve uso recente de cocaína antes do início da dor e das palpitações.";
      if(/trauma|fratura|hemotorax|pneumotorax/.test(t)) return "O quadro começou logo após o mecanismo de trauma descrito, sem intervalo assintomático importante.";
      if(/calor|exaustao/.test(t)) return "Passei bastante tempo exposto ao calor, com hidratação inadequada, antes de começar a me sentir mal.";
      if(/reacao medicamentosa/.test(t)) return "As lesões começaram após o início recente de um medicamento que eu ainda não costumava usar.";
      return "Não identifiquei um gatilho único, mas o início e a evolução foram diferentes do meu estado habitual.";
    }

    if(k.includes("alerg")){
      return "Não tenho alergia medicamentosa conhecida.";
    }

    if(k.includes("inicio") || k.includes("evolucao")){
      return String(state.current?.presentation?.opening||answer||state.current?.summary||"O quadro começou antes da chegada e evoluiu até motivar atendimento.");
    }

    return answer;
  }

  function diagnosticTestResult(action){
    if(!action) return "";
    const custom=state.current?.presentation?.test_results;
    if(custom && typeof custom==="object" && custom[action.id]) return String(custom[action.id]);

    const t=clinicalContextText();
    const v=state.vitals||state.current?.initial_vitals||{};
    const hr=Number(v.hr), spo2=Number(v.spo2), temp=Number(v.temp);
    const id=action.id;

    if(id==="ecg"){
      if(/iam com supra|infarto.*supra/.test(t)) return "ECG: supradesnivelamento do segmento ST em derivações contíguas compatíveis com o território acometido, com alterações recíprocas.";
      if(/fibrilacao atrial/.test(t)) return "ECG: ritmo irregularmente irregular, ausência de ondas P organizadas e resposta ventricular rápida.";
      if(/taquicardia ventricular/.test(t)) return "ECG: taquicardia regular de QRS largo, compatível com taquicardia ventricular.";
      if(/taquicardia supraventricular/.test(t)) return "ECG: taquicardia regular de QRS estreito, sem ondas P claramente discerníveis durante a crise.";
      if(/bradicardia/.test(t)) return "ECG: bradicardia sinusal, sem taquiarritmia; avaliar intervalo PR e presença de bloqueios conforme o caso.";
      if(/hipercalemia/.test(t)) return "ECG: ondas T apiculadas e simétricas, com alterações progressivas de condução compatíveis com hipercalemia.";
      if(/pericardite/.test(t)) return "ECG: supradesnivelamento difuso de ST com depressão de PR, sem padrão territorial típico de IAM.";
      if(/hipocalemia/.test(t)) return "ECG: achatamento de onda T, depressão de ST e ondas U mais evidentes.";
      return "ECG: ritmo "+String(v.rhythm||"sinusal")+", FC aproximada de "+(Number.isFinite(hr)?hr:"—")+" bpm, sem alteração aguda específica adicional.";
    }

    if(id==="pulse_ox") return "SpO₂: "+(Number.isFinite(spo2)?spo2+"%":"não mensurável")+".";
    if(id==="temperature") return "Temperatura: "+(Number.isFinite(temp)?String(temp).replace(".",",")+" °C":"não mensurável")+".";
    if(id==="capnography"){
      if(/cetoacidose|hiperventil|panico/.test(t)) return "Capnografia: ETCO₂ reduzido, compatível com hiperventilação.";
      if(/opioide|depressao respiratoria/.test(t)) return "Capnografia: hipoventilação com ETCO₂ elevado.";
      return "Capnografia com curva presente e ETCO₂ sem alteração crítica.";
    }

    if(id==="cbc"||id==="wbc"){
      if(/sepse|pneumonia|pielonefrite|colecistite|apendicite|meningite|celulite|erisipela|abscesso|artrite septica/.test(t)) return "Hemograma: leucocitose neutrofílica com desvio à esquerda.";
      if(/neutropenia febril/.test(t)) return "Hemograma: neutropenia importante, com contagem absoluta de neutrófilos <500/mm³.";
      if(/anemia|hemorrag|sangramento/.test(t)) return "Hemograma: hemoglobina reduzida, compatível com perda sanguínea/anemia no contexto.";
      return "Hemograma sem anemia, leucocitose ou plaquetopenia clinicamente relevantes.";
    }
    if(id==="platelets"){
      if(/eclampsia|pre-eclampsia|hellp/.test(t)) return "Plaquetas reduzidas, achado compatível com doença hipertensiva gestacional grave/HELLP quando presente.";
      if(/dengue/.test(t)) return "Plaquetopenia presente.";
      return "Plaquetas em faixa preservada.";
    }
    if(id==="sodium"){
      if(/hiponatremia/.test(t)) return "Sódio sérico reduzido, compatível com hiponatremia significativa.";
      if(/hiperosmolar|desidratacao/.test(t)) return "Sódio normal-alto, compatível com perda de água livre/desidratação.";
      return "Sódio dentro da faixa de referência.";
    }
    if(id==="potassium"){
      if(/hipercalemia/.test(t)) return "Potássio sérico acentuadamente elevado.";
      if(/hipocalemia/.test(t)) return "Potássio sérico reduzido.";
      if(/cetoacidose/.test(t)) return "Potássio sérico pode estar normal ou elevado inicialmente, apesar do déficit corporal total.";
      return "Potássio dentro da faixa de referência.";
    }
    if(id==="urea"||id==="creatinine"){
      if(/lesao renal|renal aguda|desidratacao|hiperosmolar/.test(t)) return (id==="creatinine"?"Creatinina":"Ureia")+" elevada, compatível com redução da função renal/perfusão.";
      return (id==="creatinine"?"Creatinina":"Ureia")+" sem elevação significativa.";
    }
    if(id==="gas"){
      if(/cetoacidose/.test(t)) return "Gasometria: acidose metabólica com bicarbonato reduzido e ânion gap aumentado, com compensação respiratória.";
      if(/asma grave|dpoc/.test(t)) return /dpoc/.test(t) ? "Gasometria: hipercapnia e hipoxemia, podendo haver acidose respiratória na exacerbação grave." : "Gasometria: hipoxemia; PaCO₂ normalizando ou elevando em crise grave sugere fadiga ventilatória.";
      if(/choque|sepse|hemorrag/.test(t)) return "Gasometria: acidose metabólica com hiperlactatemia, compatível com hipoperfusão.";
      if(/panico/.test(t)) return "Gasometria: alcalose respiratória aguda por hiperventilação.";
      return "Gasometria sem distúrbio ácido-básico grave.";
    }
    if(id==="lactate"){
      if(/choque|sepse|hipoperfus|hemorrag/.test(t)) return "Lactato elevado, compatível com hipoperfusão tecidual.";
      return "Lactato sem elevação clinicamente significativa.";
    }
    if(id==="troponin"){
      if(/iam|sindrome coronariana|miocardite/.test(t)) return "Troponina elevada acima do percentil 99, com dinâmica compatível com lesão miocárdica aguda.";
      return "Troponina sem elevação significativa.";
    }
    if(id==="bnp"){
      if(/insuficiencia cardiaca|edema agudo de pulmao/.test(t)) return "BNP/NT-proBNP elevado, apoiando congestão/insuficiência cardíaca no contexto clínico.";
      return "BNP/NT-proBNP sem elevação expressiva.";
    }
    if(id==="lipase"||id==="amylase"){
      if(/pancreatite/.test(t)) return (id==="lipase"?"Lipase":"Amilase")+" elevada, com lipase >3 vezes o limite superior da normalidade.";
      return (id==="lipase"?"Lipase":"Amilase")+" sem elevação significativa.";
    }
    if(["ast","alt","ggt","alp","bilirubin_total","bilirubin_direct"].includes(id)){
      if(/colangite|coledocolitiase|obstrucao biliar/.test(t)) return "Perfil hepático com padrão colestático: fosfatase alcalina/GGT e bilirrubinas elevadas.";
      if(/hepatite/.test(t)) return "Transaminases marcadamente elevadas, com padrão hepatocelular.";
      return action.label+" sem alteração relevante.";
    }
    if(id==="crp"||id==="procalcitonin"){
      if(/sepse|pneumonia|pielonefrite|infec|abscesso|colecistite|apendicite/.test(t)) return action.label+" elevada, compatível com processo inflamatório/infeccioso.";
      return action.label+" sem elevação importante.";
    }
    if(id==="ddimer"){
      if(/embolia pulmonar|trombose/.test(t)) return "D-dímero elevado; resultado não específico, porém compatível com o contexto tromboembólico.";
      return "D-dímero não elevado.";
    }
    if(id==="pregnancy"){
      if(/gravidez|gesta|ectopica|abortamento|hiperemese/.test(t)) return "β-hCG positivo, em nível compatível com gestação; correlacionar com idade gestacional e ultrassonografia.";
      return "β-hCG negativo.";
    }
    if(id==="urinalysis"){
      if(/pielonefrite|cistite|itu/.test(t)) return "Urina tipo 1: leucocitúria, bacteriúria e teste de nitrito/esterase leucocitária sugestivo de infecção urinária.";
      if(/colica renal|litíase|litíase renal/.test(t)) return "Urina tipo 1: hematúria microscópica, sem padrão infeccioso exuberante.";
      return "Urina tipo 1 sem leucocitúria, hematúria ou proteinúria relevantes.";
    }

    if(id==="xray_chest"){
      if(/pneumonia lobar/.test(t)) return "Radiografia: consolidação alveolar lobar com broncograma aéreo.";
      if(/pneumonia/.test(t)) return "Radiografia: infiltrado/consolidação pulmonar focal compatível com pneumonia.";
      if(/edema agudo|insuficiencia cardiaca/.test(t)) return "Radiografia: congestão vascular pulmonar, opacidades alveolares bilaterais e possível cardiomegalia.";
      if(/pneumotorax/.test(t)) return "Radiografia: linha pleural visceral com ausência de trama vascular periférica; no quadro hipertensivo pode haver desvio mediastinal.";
      if(/derrame pleural/.test(t)) return "Radiografia: velamento do seio costofrênico com opacidade basal compatível com derrame pleural.";
      return "Radiografia de tórax sem consolidação, pneumotórax, derrame ou edema agudo.";
    }
    if(id==="ct_head"){
      if(/avc hemorr|hemorragia subaracnoidea|hematoma epidural|hematoma subdural/.test(t)) return "TC de crânio sem contraste: hemorragia intracraniana visível, com localização compatível com o quadro.";
      if(/avc isquemico/.test(t)) return "TC de crânio sem contraste: sem hemorragia; pode haver sinais isquêmicos precoces discretos.";
      return "TC de crânio sem hemorragia, efeito de massa ou lesão aguda evidente.";
    }
    if(id==="cta_head_neck"){
      if(/avc isquemico|circulacao posterior/.test(t)) return "Angio-TC: oclusão arterial compatível com o território neurológico acometido.";
      return "Angio-TC sem oclusão arterial de grande vaso ou dissecção evidente.";
    }
    if(id==="cta_chest"){
      if(/embolia pulmonar/.test(t)) return "Angio-TC: defeitos de enchimento em artérias pulmonares, compatíveis com tromboembolismo pulmonar.";
      if(/sindrome aortica|disseccao/.test(t)) return "Angio-TC: flap intimal com duplo lúmen, compatível com dissecção aórtica.";
      return "Angio-TC de tórax sem tromboembolismo pulmonar ou síndrome aórtica aguda.";
    }
    if(id==="ct_abdomen"){
      if(/apendicite/.test(t)) return "TC: apêndice dilatado e espessado, com densificação da gordura adjacente.";
      if(/diverticulite/.test(t)) return "TC: divertículos com espessamento parietal e densificação da gordura pericólica.";
      if(/pancreatite/.test(t)) return "TC: edema/inflamação pancreática e alterações da gordura peripancreática, conforme gravidade.";
      if(/obstrucao intestinal/.test(t)) return "TC: alças dilatadas com ponto de transição, compatível com obstrução intestinal.";
      return "TC de abdômen/pelve sem achado agudo específico relevante.";
    }
    if(id==="us_abdomen" || id==="us_upper_abdomen"){
      if(/colecistite/.test(t)) return "Ultrassom: cálculos, espessamento da parede vesicular, distensão e sinal de Murphy ultrassonográfico.";
      if(/colelitiase/.test(t)) return "Ultrassom: cálculos móveis na vesícula, sem sinais inflamatórios de colecistite.";
      if(/hidronefrose|lit(i|í)ase renal|c(o|ó)lica renal/.test(t)) return "Ultrassom: dilatação do sistema coletor compatível com hidronefrose, conforme o lado acometido.";
      return id==="us_upper_abdomen" ? "Ultrassonografia de abdome superior sem alteração focal aguda relevante." : "Ultrassonografia de abdome total sem alteração focal aguda relevante.";
    }
    if(id==="us_transvaginal" || id==="us_pelvis"){
      if(/gravidez ectopica/.test(t)) return "Ultrassonografia transvaginal: ausência de gestação intrauterina identificável e achado anexial suspeito, com ou sem líquido livre, conforme o caso.";
      if(/torcao ovariana/.test(t)) return "Ultrassonografia pélvica/transvaginal: ovário aumentado e edemaciado, com alteração do fluxo ao Doppler, compatível com torção no contexto clínico.";
      if(/abortamento|aborto/.test(t)) return "Ultrassonografia transvaginal: achados gestacionais compatíveis com o estágio e a evolução do abortamento descrito no caso.";
      if(/doenca inflamatoria pelvica|dip|abscesso tubo-ovariano/.test(t)) return "Ultrassonografia pélvica/transvaginal com achados inflamatórios anexiais compatíveis com o quadro clínico.";
      return "Ultrassonografia pélvica/transvaginal sem alteração aguda específica relevante.";
    }
    if(id==="us_obstetric"){
      if(/descolamento prematuro de placenta|dpp/.test(t)) return "Ultrassonografia obstétrica realizada; a ausência de achado específico não exclui descolamento prematuro de placenta.";
      if(/placenta previa/.test(t)) return "Ultrassonografia obstétrica mostra placenta recobrindo ou próxima ao orifício interno do colo, conforme a apresentação do caso.";
      return "Ultrassonografia obstétrica com avaliação de vitalidade, localização gestacional, placenta e líquido amniótico conforme a idade gestacional.";
    }
    if(id==="us_renal_urinary"){
      if(/hidronefrose|lit(i|í)ase renal|c(o|ó)lica renal/.test(t)) return "Ultrassonografia de rins e vias urinárias: dilatação pielocalicial compatível com hidronefrose, conforme o lado acometido.";
      return "Ultrassonografia de rins e vias urinárias sem dilatação relevante ou outra alteração aguda específica.";
    }
    if(id==="us_scrotal"){
      if(/torcao testicular/.test(t)) return "Ultrassonografia escrotal com Doppler: redução ou ausência de fluxo no testículo acometido, compatível com torção no contexto clínico.";
      if(/epididimite|orquite/.test(t)) return "Ultrassonografia escrotal com Doppler: hiperemia epididimária/testicular compatível com processo inflamatório.";
      return "Ultrassonografia de bolsa escrotal sem alteração aguda específica relevante.";
    }
    if(id==="us_thyroid") return "Ultrassonografia de tireoide realizada, sem achado agudo específico relevante neste contexto.";
    if(id==="us_soft_tissue"){
      if(/abscesso|celulite/.test(t)) return "Ultrassonografia de partes moles diferencia coleção drenável de edema/celulite conforme o sítio examinado.";
      return "Ultrassonografia de partes moles sem coleção ou alteração focal aguda relevante.";
    }
    if(id==="us_lung"){
      if(/pneumotorax/.test(t)) return "Ultrassonografia pulmonar com ausência de deslizamento pleural e achados compatíveis com pneumotórax no lado acometido.";
      if(/edema agudo|insuficiencia cardiaca/.test(t)) return "Ultrassonografia pulmonar com múltiplas linhas B bilaterais, compatíveis com congestão intersticial.";
      if(/derrame pleural/.test(t)) return "Ultrassonografia pulmonar evidencia líquido pleural no hemitórax acometido.";
      return "Ultrassonografia pulmonar sem achado crítico adicional.";
    }
    if(id==="echo"){
      if(/tamponamento/.test(t)) return "Ecocardiograma: derrame pericárdico com sinais de comprometimento hemodinâmico/tamponamento.";
      if(/choque cardiogenico|insuficiencia cardiaca/.test(t)) return "Ecocardiograma: disfunção ventricular significativa, compatível com baixo débito/congestão.";
      return "Ecocardiograma sem disfunção ventricular grave ou derrame pericárdico significativo.";
    }
    if(id==="fast"){
      if(/hemorragia intra-abdominal|trauma abdominal|hemoperitonio/.test(t)) return "FAST/eFAST positivo para líquido livre intraperitoneal no contexto de trauma/hemorragia.";
      if(/pneumotorax/.test(t)) return "eFAST com ausência de deslizamento pleural no hemitórax acometido.";
      return "FAST/eFAST sem líquido livre e com deslizamento pleural bilateral.";
    }
    if(id==="pocus"){
      if(/choque|insuficiencia cardiaca|edema agudo/.test(t)) return "POCUS com achados hemodinâmicos compatíveis com o mecanismo de choque/congestão do caso.";
      return "POCUS sem achado crítico adicional.";
    }
    if(id==="vascular_doppler"){
      if(/trombose venosa|tvp/.test(t)) return "Doppler: veia não compressível com trombo intraluminal, compatível com TVP.";
      if(/isquemia aguda/.test(t)) return "Doppler com redução/ausência de fluxo arterial distal no membro acometido.";
      return "Doppler sem trombose ou redução arterial significativa.";
    }

    return String(action.result||"Resultado sem alteração específica relevante.");
  }

  function importedHistoryActions(){
    const raw=String(state.current?.presentation?.history_topics||"").trim();
    if(!raw) return [];
    return raw.split(/\n+/).map(x=>x.replace(/^\s*[•*-]\s*/,"").trim()).filter(Boolean).map((line,i)=>{
      const parts=line.split(/\s*(?:→|=>)\s*/);
      const topic=(parts[0]||("Pergunta "+(i+1))).trim();
      const question=(parts[1]||topic).replace(/^[“"']|[”"']$/g,"").trim();
      const rawAnswer=(parts.slice(2).join(" → ")||"Informação não disponível neste caso.").trim();
      const answer=contextualHistoryAnswer(topic,rawAnswer);
      return {
        id:"history_v7_"+i,
        label:question,
        category:"anamnese",
        subgroup:topic,
        time_min:.1,
        points:0,
        result:answer
      };
    });
  }

  function mergedActions(){
    const caseList=[...caseActions(),...importedHistoryActions()];

    const byId=new Map(caseList.map(a=>[a.id,a]));
    const generic=[...GENERIC_ACTIONS,...allCaseDiagnoses(),...GENERAL_DISPOSITIONS].map(a=>{
      const exact=byId.get(a.id);
      return exact ? {...a,...exact,subgroup:a.subgroup||exact.subgroup} : a;
    });
    const existingIds=new Set(generic.map(a=>a.id));
    const extras=caseList.filter(a=>!existingIds.has(a.id)&&!HIDDEN_CASE_ACTIONS.has(a.id)&&a.role!=="diagnosis"&&a.role!=="disposition"&&!["exame","iniciais","monitorizacao"].includes(a.category));
    return [...generic,...extras];
  }
  function resolveSpecialAction(action){
    if(action.id!=="defibrillate") return action;
    const sequence=["shock1","shock2","shock3"];
    const next=sequence.find(id=>!done(id));
    return next ? caseActions().find(a=>a.id===next) || action : action;
  }
  function isCorrectGenericDiagnosis(label){
    const target=normalizeLabel(state.current?.debrief?.diagnosis||state.current?.title||"");
    const candidate=normalizeLabel(label);
    if(!target||!candidate) return false;
    const keys=candidate.split(/\s+/).filter(x=>x.length>4);
    return keys.length ? keys.filter(k=>target.includes(k)).length>=Math.min(2,keys.length) : target.includes(candidate);
  }
  function inferGenericDisposition(action){
    const correct=caseActions().find(a=>a.role==="disposition"&&a.correct===true);
    if(!correct) return false;
    const a=normalizeLabel(action.label), b=normalizeLabel(correct.label);
    if(a.includes("uti")) return b.includes("uti");
    if(a.includes("observ")) return b.includes("observ");
    if(a.includes("enfermaria")||a.includes("monitorizada")) return b.includes("enfermaria")||b.includes("monitorizada")||b.includes("ward");
    if(a.includes("alta")) return b.includes("alta");
    return false;
  }

  const groupOf = category => Object.keys(GROUPS).find(key=>GROUPS[key].categories.includes(category)) || "intervir";
  const done = id => E.done(state.current,state.performed,id);
  function openActions(category) {
    if(category==="conduta" && !state.diagnosis) {
      feed("Defina primeiro uma hipótese diagnóstica antes de escolher a conduta final.","warning");
      return;
    }
    state.category=category;
    $("plantao-action-search").value="";
    $("plantao-action-drawer").hidden=false;
    renderActions();
    $("plantao-action-tabs").inert=true;
    $("plantao-action-close").focus();
  }
  function closeActions() {
    $("plantao-action-drawer").hidden=true;
    $("plantao-action-tabs").inert=false;
    renderActions();
    $("plantao-action-tabs").querySelector(`[data-case-category="${state.category}"]`)?.focus();
  }
  function updateScore() {
    const clock=$("plantao-score-live");
    if(!clock)return;
    clock.textContent="◷ "+fmtTime(state.elapsed);
    clock.setAttribute("aria-label","Tempo do caso: "+fmtTime(state.elapsed));
  }
  function patientSex(){
    const raw=normalizeLabel(state.current?.presentation?.sex||"");
    return raw==="f" || raw.startsWith("fem") ? "F" : "M";
  }
  function genderText(text){
    let value=String(text||"");
    if(patientSex()!=="F") return value;
    const pairs=[
      ["orientado","orientada"],["consciente","consciente"],["sonolento","sonolenta"],
      ["confuso","confusa"],["agitado","agitada"],["pálido","pálida"],["corado","corada"],
      ["normocorado","normocorada"],["desidratado","desidratada"],["hidratado","hidratada"],
      ["ictérico","ictérica"],["cianótico","cianótica"],["afebril","afebril"],
      ["acordado","acordada"],["desacordado","desacordada"],["inconsciente","inconsciente"]
    ];
    for(const [m,f] of pairs){
      value=value.replace(new RegExp("\\b"+m+"\\b","gi"),match=>{
        const out=f;
        return match[0]===match[0].toUpperCase()?out.toUpperCase():match[0]===match[0].toUpperCase()?"":match[0][0]===match[0][0].toUpperCase()?out[0].toUpperCase()+out.slice(1):out;
      });
    }
    return value;
  }
  function contextual(text) {
    const filled=String(text||"").replace(/\{\{(\w+)\}\}/g,(_,key)=>String(state.vitals[key]??"não informado"));
    return genderText(filled);
  }

  function renderVitals() {
    const v=state.vitals || {};
    window.PlantaoMonitor?.update(v, {slug:state.current?.slug,enabled:state.monitorOn,patient_image:state.current?.presentation?.patient_image,unconscious_image:state.current?.presentation?.unconscious_image});
    const items=[
      ["FC",v.hr,"bpm"],
      ["SpO₂",v.spo2,"%"],
      ["FR",v.rr,"irpm"],
      ["PA",v.bp,"mmHg"],
      ["Temp",v.temp,"°C"]
    ];
    $("plantao-vitals").innerHTML=items.map(([label,val,unit],idx)=>`
      <div class="plantao-vital">
        <span>${esc(label)}</span>
        <strong>${esc(state.monitorOn ? (val ?? "—") : "—")}${state.monitorOn && unit && val!=null && val!=="—" ? " <small>"+unit+"</small>" : ""}</strong>
      </div>
    `).join("");
  }

  function liveSafeMessage(message) {
    let text=String(message||"").trim();
    if(!text || state.session?.status==="completed") return text;
    const secrets=[state.current?.debrief?.diagnosis,state.current?.title]
      .filter(Boolean)
      .map(value=>String(value).trim())
      .filter(value=>value.length>=5);
    for(const secret of secrets){
      const escaped=secret.replace(/[.*+?^$()|[\]\\]/g,match=>"\\\\"+match);
      text=text.replace(new RegExp(escaped,"gi"),"achado clínico relevante");
    }
    return text || "Informação registrada no prontuário.";
  }

  function feed(message,type="event",time=state.elapsed) {
    message=liveSafeMessage(message);
    state.log.push({time,message,type});
    $("plantao-feed").innerHTML=state.log.slice().reverse().map(item=>`
      <div class="plantao-feed-item ${esc(item.type)}">
        <span>T+${fmtTime(item.time)}</span>
        <p>${esc(item.message)}</p>
      </div>
    `).join("");
  }

  function interventionSection(action){
    return action.category==="tratamento" ? "medicamentos" : "gerais";
  }
  function examSection(action){
    if(action.category==="imagem") return "imagem";
    if(action.category==="laboratorio") return "laboratoriais";
    return "gerais";
  }
  function isPediatricCase() {
    const specialty=normalizeLabel(state.current?.specialty||"");
    const rawAge=String(state.current?.presentation?.age||"");
    const age=Number((rawAge.match(/\d+(?:[.,]\d+)?/)||[])[0]?.replace(",","."));
    return specialty.includes("pediatr") || (Number.isFinite(age) && age<18);
  }

  function medicationDoseHint(action) {
    if(action.category!=="tratamento") return "";

    const explicit=action.dose_hint||action.dose||action.dosage;
    if(explicit) return String(explicit);

    const peds=isPediatricCase();
    const target=normalizeLabel([
      state.current?.title,
      state.current?.debrief?.diagnosis,
      state.current?.summary,
      state.current?.initial_vitals?.rhythm
    ].filter(Boolean).join(" "));

    const id=action.id;

    if(id==="epi_im") return peds ? "0,01 mg/kg IM (1 mg/mL), máx. 0,5 mg" : "0,3–0,5 mg IM (1 mg/mL)";
    if(id==="epi") return peds ? "0,01 mg/kg IV/IO (0,1 mg/mL) a cada 3–5 min" : "1 mg IV/IO a cada 3–5 min";
    if(id==="amiodarone") return peds ? "5 mg/kg IV/IO" : (/fibrilacao ventricular|tv sem pulso/.test(target) ? "300 mg IV/IO; depois 150 mg" : "150 mg IV em 10 min");
    if(id==="lidocaine") return peds ? "1 mg/kg IV/IO" : "1–1,5 mg/kg IV/IO";
    if(id==="atropine") return peds ? "0,02 mg/kg IV/IO; mín. 0,1 mg, máx. 0,5 mg" : "1 mg IV a cada 3–5 min; máx. 3 mg";
    if(id==="adenosine") return peds ? "0,1 mg/kg IV rápido; depois 0,2 mg/kg" : "6 mg IV rápido; depois 12 mg";
    if(id==="magnesium") return /eclamps|pre-eclamps/.test(target) ? "4–6 g IV ataque; manutenção 1–2 g/h" : (peds ? "25–50 mg/kg IV" : "1–2 g IV");
    if(id==="norepi") return "0,05–0,1 mcg/kg/min IV, titular";
    if(id==="vasopressin") return "0,03 U/min IV";
    if(id==="dopamine") return "5–20 mcg/kg/min IV, titular";
    if(id==="dobutamine") return "2–20 mcg/kg/min IV, titular";
    if(id==="phenylephrine") return "50–200 mcg IV em bolus ou 0,2–2 mcg/kg/min";
    if(id==="nitroglycerin") return "5–10 mcg/min IV, titular";
    if(id==="nitroprusside") return "0,3–0,5 mcg/kg/min IV, titular";
    if(id==="metoprolol") return "5 mg IV a cada 5 min, até 15 mg";
    if(id==="propranolol") return "1 mg IV lento; repetir conforme resposta";
    if(id==="esmolol") return "500 mcg/kg ataque; 50–200 mcg/kg/min";
    if(id==="diltiazem") return "0,25 mg/kg IV; pode repetir 0,35 mg/kg";
    if(id==="verapamil") return "2,5–5 mg IV lento; repetir 5–10 mg";
    if(id==="labetalol") return "20 mg IV; depois 40–80 mg a cada 10 min";
    if(id==="hydralazine") return "5–10 mg IV";
    if(id==="nicardipine") return "5 mg/h IV; aumentar 2,5 mg/h";
    if(id==="nifedipine") return "10 mg VO; repetir conforme indicação";
    if(id==="furosemide") return peds ? "1 mg/kg IV" : "20–40 mg IV";
    if(id==="salbutamol") return peds ? "2,5–5 mg nebulizado" : "2,5–5 mg nebulizado";
    if(id==="ipratropium") return peds ? "250–500 mcg nebulizado" : "500 mcg nebulizado";
    if(id==="hydrocortisone") return peds ? "2–4 mg/kg IV" : "100–200 mg IV";
    if(id==="ceftriaxone") return peds ? "50–100 mg/kg IV" : "1–2 g IV";
    if(id==="azithromycin") return peds ? "10 mg/kg VO/IV" : "500 mg VO/IV";
    if(id==="piperacillin_tazo") return peds ? "80–100 mg/kg/dose IV (piperacilina)" : "4,5 g IV";
    if(id==="vancomycin") return peds ? "15 mg/kg IV" : "15–20 mg/kg IV";
    if(id==="cefepime") return peds ? "50 mg/kg IV" : "2 g IV";
    if(id==="meropenem") return peds ? "20–40 mg/kg IV" : "1 g IV";
    if(id==="metronidazole") return peds ? "7,5–10 mg/kg IV/VO" : "500 mg IV/VO";
    if(id==="clindamycin") return peds ? "10 mg/kg IV/VO" : "600–900 mg IV";
    if(id==="doxycycline") return peds ? "2,2 mg/kg por dose (≥8 anos)" : "100 mg VO/IV";
    if(id==="amoxicillin") return peds ? "40–50 mg/kg por dose VO" : "500–875 mg VO";
    if(id==="amox_clav") return peds ? "45 mg/kg/dia de amoxicilina, dividido" : "875/125 mg VO";
    if(id==="cefazolin") return peds ? "25–50 mg/kg IV" : "1–2 g IV";
    if(id==="cephalexin") return peds ? "25–50 mg/kg/dia VO, dividido" : "500 mg VO";
    if(id==="morphine") return peds ? "0,05–0,1 mg/kg IV" : "2–4 mg IV, titular";
    if(id==="fentanyl") return peds ? "1–2 mcg/kg IV" : "25–50 mcg IV, titular";
    if(id==="dipyrone") return peds ? "10–20 mg/kg" : "500–1.000 mg";
    if(id==="paracetamol") return peds ? "10–15 mg/kg" : "500–1.000 mg";
    if(id==="ondansetron") return peds ? "0,15 mg/kg IV" : "4 mg IV/VO";
    if(id==="midazolam") return peds ? "0,1 mg/kg IV ou 0,2 mg/kg IN/IM" : "2–5 mg IV/IM, titular";
    if(id==="diazepam") return peds ? "0,15–0,2 mg/kg IV" : "5–10 mg IV";
    if(id==="ketamine") return peds ? "1–2 mg/kg IV" : "1–2 mg/kg IV";
    if(id==="propofol") return "0,5–1 mg/kg IV, titular";
    if(id==="rocuronium") return "1,2 mg/kg IV";
    if(id==="succinylcholine") return peds ? "1–2 mg/kg IV" : "1–1,5 mg/kg IV";
    if(id==="tranexamic") return peds ? "10–15 mg/kg IV" : "1 g IV em 10 min";
    if(id==="aspirin") return "160–325 mg VO mastigável";
    if(id==="clopidogrel") return "300–600 mg VO ataque";
    if(id==="heparin") return "60–80 U/kg IV em bolus, conforme indicação";
    if(id==="enoxaparin") return "1 mg/kg SC a cada 12 h";
    if(id==="insulin") return /hipercalemia/.test(target) ? "10 U regular IV + glicose" : "0,1 U/kg/h IV";
    if(id==="dextrose") return peds ? "0,25 g/kg IV" : "25 g IV";
    if(id==="glucagon") return peds ? "0,5–1 mg IM" : "1 mg IM";
    if(id==="naloxone") return peds ? "0,1 mg/kg IV/IM/IN" : "0,4–2 mg IV/IM/IN, titular";
    if(id==="levetiracetam") return peds ? "40–60 mg/kg IV" : "60 mg/kg IV, máx. 4,5 g";
    if(id==="phenobarbital") return peds ? "20 mg/kg IV" : "15–20 mg/kg IV";
    if(id==="phenytoin") return "20 mg/kg IV";
    if(id==="valproate") return "20–40 mg/kg IV";
    if(id==="dexamethasone") return peds ? "0,6 mg/kg" : "6–10 mg IV/VO";
    if(id==="prednisone") return peds ? "1–2 mg/kg VO" : "40–60 mg VO";
    if(id==="racemic_epinephrine") return peds ? "0,5 mL de solução 2,25% nebulizada" : "0,5 mL de solução 2,25% nebulizada";
    if(id==="pantoprazole") return /hemorragia digestiva/.test(target) ? "80 mg IV ataque + 8 mg/h" : "40 mg IV";
    if(id==="omeprazole") return "20–40 mg VO";
    if(id==="metoclopramide") return peds ? "0,1–0,15 mg/kg" : "10 mg IV/VO";
    if(id==="ibuprofen") return peds ? "10 mg/kg VO" : "400–600 mg VO";
    if(id==="ketorolac") return "15–30 mg IV/IM";
    if(id==="colchicine") return "1,2 mg VO + 0,6 mg após 1 h";
    if(id==="oxytocin") return "10 U IM ou 20–40 U em infusão IV";
    if(id==="misoprostol") return /hemorragia pos-parto|atonia/.test(target) ? "800–1.000 mcg retal/sublingual" : "conforme protocolo obstétrico";
    if(id==="methylergometrine") return "0,2 mg IM";
    if(id==="carboprost") return "250 mcg IM; repetir a cada 15–90 min";
    if(id==="methotrexate") return "50 mg/m² IM (esquema de dose única)";
    if(id==="terbutaline") return "0,25 mg SC";
    if(id==="thiamine") return "100–500 mg IV";
    if(id==="fomepizole") return "15 mg/kg IV ataque";
    if(id==="activated_charcoal") return peds ? "1 g/kg VO" : "50 g VO";
    if(id==="acetylcysteine") return "150 mg/kg IV ataque";

    return "conforme indicação, peso e protocolo";
  }

  function renderActions() {
    const actions=mergedActions();
    if(!GROUPS[state.category])state.category="anamnese";
    $("plantao-action-tabs").innerHTML=Object.entries(GROUPS)
      .filter(([key])=>key!=="conduta" || !!state.diagnosis)
      .map(([key,g])=>`
      <button class="plantao-action-tab" type="button" data-case-category="${key}" aria-controls="plantao-action-drawer" aria-expanded="${!$("plantao-action-drawer").hidden&&key===state.category}">
        <span aria-hidden="true">${g.icon}</span><span>${g.label}</span>
      </button>`).join("");
    $("plantao-action-title").textContent=GROUPS[state.category].label;
    const search=$("plantao-action-search").value.trim().toLocaleLowerCase('pt-BR');
    let available=actions.filter(a=>groupOf(a.category)===state.category && (!search||(a.label+" "+(a.subgroup||"")+" "+medicationDoseHint(a)).toLocaleLowerCase('pt-BR').includes(search)));
    if(state.category==="intervir"){
      state.interventionTab=state.interventionTab||"gerais";
      const tabHtml='<div class="plantao-intervention-tabs"><button type="button" data-intervention-tab="gerais" class="'+(state.interventionTab==="gerais"?"active":"")+'">Gerais</button><button type="button" data-intervention-tab="medicamentos" class="'+(state.interventionTab==="medicamentos"?"active":"")+'">Medicamentos</button></div>';
      available=available.filter(a=>interventionSection(a)===state.interventionTab);
      $("plantao-actions").dataset.tabs=tabHtml;
    } else if(state.category==="exames"){
      state.examTab=state.examTab||"gerais";
      const tabHtml='<div class="plantao-intervention-tabs plantao-exam-tabs"><button type="button" data-exam-tab="gerais" class="'+(state.examTab==="gerais"?"active":"")+'">Gerais</button><button type="button" data-exam-tab="imagem" class="'+(state.examTab==="imagem"?"active":"")+'">Exames de imagem</button><button type="button" data-exam-tab="laboratoriais" class="'+(state.examTab==="laboratoriais"?"active":"")+'">Exames laboratoriais</button></div>';
      available=available.filter(a=>examSection(a)===state.examTab);
      $("plantao-actions").dataset.tabs=tabHtml;
    } else $("plantao-actions").dataset.tabs="";
    const groups=[...new Set(available.map(a=>a.subgroup||CATEGORY_LABELS[a.category]||"Opções"))];
    $("plantao-actions").innerHTML=($("plantao-actions").dataset.tabs||"")+groups.map(group=>`<section class="plantao-action-group"><h3>${esc(group)}</h3>${available.filter(a=>(a.subgroup||CATEGORY_LABELS[a.category]||"Opções")===group).map(action=>{
      const completed=done(action.id);
      const specialRepeat=action.id==="defibrillate";
      const dose=medicationDoseHint(action);
      return `<button class="plantao-action" type="button" data-case-action="${esc(action.id)}" ${state.busy||(completed&&!action.repeatable&&!specialRepeat)?"disabled":""}>
        <strong>${esc(action.label)}</strong>
        ${dose?`<span class="plantao-action-dose">Dose: ${esc(dose)}</span>`:""}
        <small>${completed&&!action.repeatable?"Realizado":"+"+fmtTime(action.time_min||0)}${action.role==='disposition'?" · Encerrar atendimento":""}</small>
      </button>`;
    }).join("")}</section>`).join("") || '<p class="plantao-no-actions">Nenhuma opção encontrada.</p>';
  }

  function recordSequenceViolation(action,{missing=[],penalty=2,blocked=true,message=""}={}) {
    const missingLabels=missing.map(actionLabel);
    const text=message || (blocked
      ? "Você tentou "+action.label+" antes de "+missingLabels.join(", ")+"."
      : "Você realizou "+action.label+" antes de "+missingLabels.join(", ")+".");
    state.sequenceViolations.push({
      action_id:action.id,
      action_label:action.label,
      missing_ids:[...missing],
      missing_labels:missingLabels,
      penalty:Number(penalty||0),
      blocked:blocked===true,
      message:text,
      time:state.elapsed
    });
    return text;
  }

  function sequenceCheck(action) {
    const hardMissing=(action.requires_all||[]).filter(id=>!done(id));
    if(hardMissing.length) {
      return {
        blocked:true,
        missing:hardMissing,
        penalty:Number(action.requires_penalty??2),
        message:action.result_if_blocked||""
      };
    }

    const softMissing=(action.order_after_all||[]).filter(id=>!done(id));
    const anyIds=action.order_after_any||[];
    const anySatisfied=!anyIds.length || anyIds.some(id=>done(id));
    if(softMissing.length || !anySatisfied) {
      const missing=[...softMissing,...(!anySatisfied?anyIds:[])];
      return {
        blocked:false,
        missing:[...new Set(missing)],
        penalty:Number(action.order_penalty??3),
        message:action.order_message||""
      };
    }
    return null;
  }

  function ongoingPregnancyCase() {
    const text=normalizeLabel([
      state.current?.title,
      state.current?.summary,
      state.current?.presentation?.opening,
      state.current?.presentation?.chief_complaint
    ].filter(Boolean).join(" "));

    const pregnancy=/gravidez|gestante|gestacao|eclampsia|pre-eclampsia/.test(text);
    const noOngoingFetus=/abortamento|aborto|ectopica|mola|pos-parto|puerper/.test(text);
    return pregnancy && !noOngoingFetus;
  }

  function currentSystolic() {
    const raw=String(state.vitals?.bp||"");
    const n=Number(raw.split("/")[0]);
    return Number.isFinite(n) ? n : null;
  }

  function isHighImpactMedication(id) {
    return new Set([
      "epi_im","epi","norepi","vasopressin","dopamine","dobutamine","phenylephrine",
      "nitroglycerin","nitroprusside","metoprolol","propranolol","esmolol","diltiazem","verapamil",
      "adenosine","atropine","amiodarone","lidocaine","magnesium",
      "thrombolytic","heparin","enoxaparin","insulin","dextrose","potassium_chloride",
      "midazolam","diazepam","propofol","ketamine","morphine","fentanyl",
      "rocuronium","succinylcholine","methotrexate","oxytocin","misoprostol",
      "methylergometrine","carboprost","terbutaline"
    ]).has(id);
  }

  function medicationIndicated(id,target,rules) {
    const required=rules.required_actions||[];
    const recommended=rules.recommended_actions||[];
    if(required.includes(id)||recommended.includes(id)) return true;

    const specific=caseActions().find(a=>a.id===id);
    if(specific && (
      Number(specific.points||0)>0
      || specific.essential===true
      || specific.clinical_class==="essencial"
      || specific.clinical_class==="benefica"
    )) return true;

    const patterns={
      epi_im:/anafilax/,
      epi:/parada cardiorrespiratoria|fibrilacao ventricular|tv sem pulso|anafilax/,
      norepi:/choque|hipotens|sepse/,
      vasopressin:/choque|vasopleg|parada cardiorrespiratoria/,
      dopamine:/bradicardia.*instavel|choque/,
      dobutamine:/choque cardiogenico|baixo debito|insuficiencia cardiaca.*choque/,
      phenylephrine:/hipotens/,
      nitroglycerin:/edema agudo de pulmao.*hipertens|sindrome coronariana|angina|iam/,
      nitroprusside:/emergencia hipertensiva|disseccao aortica|sindrome aortica/,
      metoprolol:/taquic|fibrilacao atrial|flutter|sindrome coronariana|hipertireoid/,
      propranolol:/hipertireoid|tempestade tireoid|taquic/,
      esmolol:/taquic|sindrome aortica/,
      diltiazem:/fibrilacao atrial.*estavel|flutter.*estavel|taquicardia supraventricular/,
      verapamil:/taquicardia supraventricular|fibrilacao atrial.*estavel/,
      adenosine:/taquicardia supraventricular|taquicardia regular.*qrs estreito/,
      atropine:/bradicardia.*sintomat|bradicardia.*instavel/,
      amiodarone:/fibrilacao ventricular|taquicardia ventricular|arritmia ventricular/,
      lidocaine:/fibrilacao ventricular|taquicardia ventricular|arritmia ventricular/,
      magnesium:/eclampsia|pre-eclampsia|torsades|asma grave/,
      thrombolytic:/avc isquemico|embolia pulmonar.*alto risco|iam/,
      heparin:/embolia pulmonar|trombose|sindrome coronariana|iam/,
      enoxaparin:/embolia pulmonar|trombose|sindrome coronariana|iam/,
      insulin:/cetoacidose|hiperosmolar|hiperglicemia|hipercalemia/,
      dextrose:/hipoglicemia/,
      potassium_chloride:/hipocalemia/,
      midazolam:/convuls|estado de mal|sedacao/,
      diazepam:/convuls|estado de mal|abstinencia alcoolica/,
      propofol:/sedacao|intubacao|estado de mal/,
      ketamine:/sedacao|intubacao|broncoespasmo/,
      morphine:/dor intensa|analgesia|iam/,
      fentanyl:/dor intensa|analgesia|intubacao/,
      rocuronium:/intubacao|via aerea definitiva/,
      succinylcholine:/intubacao|via aerea definitiva/,
      methotrexate:/gravidez ectopica/,
      oxytocin:/hemorragia pos-parto|atonia uterina/,
      misoprostol:/hemorragia pos-parto|atonia uterina|abortamento/,
      methylergometrine:/hemorragia pos-parto|atonia uterina/,
      carboprost:/hemorragia pos-parto|atonia uterina/,
      terbutaline:/taquissistolia|hiperestimulacao uterina/
    };
    return patterns[id]?.test(target)===true;
  }

  function medicationHarmClassification(id,target,rules) {
    if(!isHighImpactMedication(id) || medicationIndicated(id,target,rules)) return null;

    const sbp=currentSystolic();
    const hr=Number(state.vitals?.hr);
    const hypotensive=Number.isFinite(sbp) && sbp<90;
    const brady=Number.isFinite(hr) && hr<50;

    if(id==="epi")
      return {level:"mortal",reason:"Adrenalina IV/IO foi administrada sem indicação de parada, choque refratário ou anafilaxia. A descarga adrenérgica provocou arritmia e deterioração hemodinâmica grave."};

    if(["nitroglycerin","nitroprusside"].includes(id) && hypotensive)
      return {level:"mortal",reason:"Vasodilatador foi administrado em paciente hipotenso, provocando colapso circulatório grave."};

    if(["metoprolol","propranolol","esmolol","diltiazem","verapamil"].includes(id) && (hypotensive||brady))
      return {level:"mortal",reason:"Bloqueio cronotrópico/inotrópico foi administrado em paciente já bradicárdico ou hipotenso, precipitando instabilidade grave."};

    if(["rocuronium","succinylcholine"].includes(id) && !/intubacao|via aerea definitiva/.test(target))
      return {level:"mortal",reason:"Bloqueador neuromuscular foi administrado sem uma sequência de controle de via aérea, causando paralisia respiratória."};

    if(id==="methotrexate" && ongoingPregnancyCase())
      return {level:"mortal_fetal",reason:"Metotrexato foi administrado em gestação intrauterina em curso sem indicação, causando dano embriofetal catastrófico."};

    return {level:"malefica",reason:"Medicamento de alto impacto foi administrado sem indicação clínica para este caso, com risco real de deterioração hemodinâmica, respiratória ou metabólica."};
  }

  function registerFetalHarm(action,reason,{fatal=false}={}) {
    if(!ongoingPregnancyCase()) return false;

    state.fetalHarmCount+=1;

    if(fatal || state.fetalHarmCount>=2) {
      if(!state.fetalDeath) {
        state.fetalDeath=true;
        state.fetalStatus="Óbito fetal";
        state.penalties+=25;
        state.score=Math.min(state.score,-50);
        recordClinicalEvent("mortal",action,"Óbito fetal relacionado à conduta: "+reason);
        feed("ÓBITO FETAL: a conduta comprometeu de forma crítica a perfusão/segurança fetal.","warning");
      }
      return true;
    }

    state.fetalStatus="Sofrimento fetal agudo";
    feed("ALERTA FETAL: surgiram sinais de sofrimento fetal após a conduta inadequada.","warning");
    return false;
  }

  function classifyAction(action,original) {
    const slug=state.current?.slug||"";
    const id=original?.id||action.id;
    const target=normalizeLabel([state.current?.title,state.current?.debrief?.diagnosis,state.current?.initial_vitals?.rhythm].filter(Boolean).join(" "));
    const shockAction=["defibrillate","shock1","shock2","shock3","unsync_shock"].includes(id);
    const shockableArrest =
      target.includes("fibrilacao ventricular") ||
      target.includes("fv") ||
      target.includes("taquicardia ventricular sem pulso") ||
      target.includes("tv sem pulso");
    // Regra do simulador: choque NÃO sincronizado fora de FV/TV sem pulso é uma conduta mortal.
    // Cardioversão sincronizada continua sendo uma ação distinta para taquiarritmias com pulso.
    if(shockAction && !shockableArrest)
      return {level:"mortal",reason:"Você aplicou desfibrilação não sincronizada em um paciente sem ritmo chocável de parada. A conduta provocou deterioração fatal no caso simulado."};
    if(slug==="vf-arrest-ed" && !done("cpr")) {
      if(id==="cricothyrotomy") return {level:"mortal",reason:"Cricotireoidostomia realizada em um paciente em parada cardiorrespiratória antes das medidas imediatas de ressuscitação."};
      if(["ct_head","ct_chest","ct_abdomen","mri_brain","mri_spine","xray_chest","xray_abdomen"].includes(id))
        return {level:"mortal",reason:"Você priorizou um exame demorado durante uma PCR antes de iniciar RCP."};
      if(action.category==="exame")
        return {level:"malefica",reason:"Você atrasou RCP para realizar exame físico durante uma PCR."};
    }
    const rules=state.current?.completion_rules||{};
    const mal=normalizeLabel(rules.maleficos||"");
    const mort=normalizeLabel(rules.mortais||"");
    const caseTitle=normalizeLabel(state.current?.title||"");
    const actionText=normalizeLabel([id,action.label,action.subgroup].filter(Boolean).join(" "));

    // Regras estruturadas importadas da planilha: primeiro avalia as condutas mortais,
    // depois as maléficas. Regras específicas vencem o comportamento genérico.
    const isDischarge=/alta|home|discharge/.test(actionText);
    const isThrombolysis=/thrombolytic|trombol|trombolise/.test(actionText);
    const isAnticoag=/heparin|enoxaparin|anticoag/.test(actionText);
    const isImaging=/ct_|mri_|xray|tomografia|ressonancia|raio/.test(actionText);
    const isAggressiveAirway=/cricothyrotomy|airway|intub|orofaring/.test(actionText);
    const isSedation=/midazolam|diazepam|propofol|ketamine|fentanyl|morphine|sedac/.test(actionText);

    if(isDischarge && /alta|abandono/.test(mort))
      return {level:"mortal",reason:"A planilha deste caso classifica alta/abandono nesta condição como conduta mortal no simulador."};
    if(isThrombolysis && /trombol/.test(mort))
      return {level:"mortal",reason:"A planilha deste caso classifica trombólise nesta situação como conduta mortal no simulador."};
    if(isAggressiveAirway && /instrumentacao.*obstrucao/.test(mort))
      return {level:"mortal",reason:"A planilha deste caso classifica instrumentação que precipite obstrução como conduta mortal no simulador."};

    if((isThrombolysis||isAnticoag) && /anticoagulacao|trombolise/.test(mal))
      return {level:"malefica",reason:"A planilha deste caso classifica anticoagulação/trombólise nesta situação como conduta maléfica."};
    if(isImaging && /aguardar rx|atrasar.*exames|baixo valor.*atrase/.test(mal))
      return {level:"malefica",reason:"Este exame atrasa uma intervenção tempo-dependente e é classificado como maléfico neste caso."};
    if(isSedation && /sedacao sem controle de via aerea/.test(mal))
      return {level:"malefica",reason:"Sedação sem controle adequado da via aérea é classificada como maléfica neste caso."};

    const brainBleed=/avc hemorragico|hemorragia subaracnoidea|hematoma epidural|hematoma subdural/.test(caseTitle);
    if(brainBleed && isThrombolysis) return {level:"mortal",reason:"Trombólise é classificada como mortal neste caso simulado."};
    if(brainBleed && isAnticoag) return {level:"malefica",reason:"Anticoagulação é classificada como maléfica neste caso."};
    if(caseTitle.includes("sindrome aortica aguda") && isThrombolysis) return {level:"mortal",reason:"Trombólise é classificada como mortal neste caso simulado."};
    if(caseTitle.includes("sindrome aortica aguda") && isAnticoag) return {level:"malefica",reason:"Anticoagulação antes de excluir dissecção é maléfica neste caso."};
    if(caseTitle.includes("anafilaxia") && id==="antihistamine" && !done("epi_im")) return {level:"malefica",reason:"Anti-histamínico antes da adrenalina IM atrasa a terapia prioritária."};
    if(caseTitle.includes("intoxicacao por benzodiazepinico") && id==="flumazenil") return {level:"malefica",reason:"Flumazenil indiscriminado é maléfico neste caso."};
    if(caseTitle.includes("pneumotorax hipertensivo") && isImaging && !done("needle_decompression")) return {level:"malefica",reason:"Imagem antes da descompressão no paciente instável é maléfica."};

    /*
      Procedimentos invasivos/elétricos do catálogo global não podem ser neutros
      quando executados sem indicação. Isso evita que casos simples tolerem
      cardioversão, marcapasso, descompressão torácica etc. como se nada tivesse
      acontecido. Três condutas maléficas acumuladas já acionam óbito no motor.
    */
    const configuredRequired=(rules.required_actions||[]);
    const configuredRecommended=(rules.recommended_actions||[]);
    const explicitlyIndicated=
      configuredRequired.includes(id)
      || configuredRecommended.includes(id)
      || action.clinical_class==="essencial"
      || action.clinical_class==="benefica";

    const syncCardioversionIndicated =
      explicitlyIndicated
      || /fibrilacao atrial.*instavel|flutter atrial.*instavel|taquicardia supraventricular.*instavel|taquicardia ventricular com pulso.*instavel|taquiarritmia.*instavel/.test(target);

    const pacingIndicated =
      explicitlyIndicated
      || /bradicardia.*sintomat|bradicardia.*instavel|bloqueio atrioventricular.*(alto grau|total|instavel)|bav.*(2|3|total|alto grau)/.test(target);

    const needleDecompressionIndicated =
      explicitlyIndicated
      || /pneumotorax hipertensivo/.test(target);

    const chestTubeIndicated =
      explicitlyIndicated
      || /pneumotorax|hemotorax/.test(target);

    const pericardiocentesisIndicated =
      explicitlyIndicated
      || /tamponamento cardiaco|derrame pericardico.*instavel/.test(target);

    const cricothyrotomyIndicated =
      explicitlyIndicated
      || /obstrucao de via aerea|via aerea impossivel|nao intuba.*nao ventila|cricotireoid/.test(target);

    if(id==="sync_cardioversion" && !syncCardioversionIndicated)
      return {level:"malefica",reason:"Cardioversão sincronizada foi realizada sem uma taquiarritmia com indicação de terapia elétrica. A intervenção desnecessária expôs a paciente a deterioração hemodinâmica e arritmia."};

    if(id==="transcutaneous_pacing" && !pacingIndicated)
      return {level:"malefica",reason:"Marcapasso transcutâneo foi iniciado sem bradicardia sintomática ou bloqueio de alto grau que justificasse estimulação elétrica."};

    if(id==="needle_decompression" && !needleDecompressionIndicated)
      return {level:"malefica",reason:"Descompressão torácica foi realizada sem evidência de pneumotórax hipertensivo, criando risco de lesão pulmonar, vascular e deterioração respiratória."};

    if(id==="chest_tube" && !chestTubeIndicated)
      return {level:"malefica",reason:"Drenagem torácica foi realizada sem indicação de pneumotórax ou hemotórax, expondo o paciente a lesão pleuropulmonar desnecessária."};

    if(id==="pericardiocentesis" && !pericardiocentesisIndicated)
      return {level:"malefica",reason:"Pericardiocentese foi realizada sem evidência de tamponamento ou derrame pericárdico instável."};

    if(id==="cricothyrotomy" && !cricothyrotomyIndicated)
      return {level:"malefica",reason:"Cricotireoidostomia foi realizada sem uma emergência de via aérea que justificasse acesso cirúrgico."};

    const medicationHarm=medicationHarmClassification(id,target,rules);
    if(medicationHarm) return medicationHarm;

    const pts=Number(action.points||0);
    if(action.clinical_class) return {level:action.clinical_class,reason:action.clinical_reason||""};
    const required=configuredRequired;
    const recommended=configuredRecommended;
    if(required.some(x=>x===id||x===action.id)) return {level:"essencial",reason:action.clinical_reason||"Conduta essencial para o manejo deste caso."};
    if(recommended.some(x=>x===id||x===action.id)) return {level:"benefica",reason:action.clinical_reason||"Conduta útil e apropriada neste caso."};
    if(pts<=-15) return {level:"mortal",reason:action.result||"A conduta provocou deterioração crítica."};
    if(pts<0) return {level:"malefica",reason:action.result||"A conduta foi prejudicial."};
    if(pts>0) return {level:"benefica",reason:""};
    return {level:"neutra",reason:action.clinical_reason||"Conduta sem benefício ou dano relevante para este caso."};
  }

  function recordClinicalEvent(level,action,reason) {
    state.clinicalEvents.push({level,action_id:action.id,action_label:action.label,reason:reason||"",time:state.elapsed});
  }

  async function killPatient(reason,action=null) {
    if(state.dead)return;
    state.dead=true;
    state.deathReason=reason||"O paciente evoluiu a óbito.";
    state.vitals={...state.vitals,hr:0,spo2:0,rr:0,bp:"0/0",temp:state.vitals.temp,rhythm:"Assistolia",pulse:false,mental:"Inconsciente"};
    state.monitorOn=true;
    window.PlantaoMonitor?.update(state.vitals,{slug:state.current?.slug,enabled:true});
    renderVitals();
    $("plantao-time").textContent=fmtTime(state.elapsed);
    state.score=Math.min(state.score,-50);
    state.penalties+=25;
    recordClinicalEvent("mortal",action||{id:"death",label:"Óbito"},state.deathReason);
    feed("ÓBITO: "+state.deathReason,"warning");
    $("plantao-death-reason").textContent=state.deathReason;
    const criticalHost=$("plantao-critical-window"); if(criticalHost) criticalHost.hidden=true;
    $("plantao-death-overlay").hidden=false;
    $("plantao-simulator").classList.add("patient-dead");
    $("plantao-action-tabs").inert=true;
    $("plantao-action-drawer").hidden=true;
    $("plantao-action-search").value="";
    renderActions();
    $("plantao-finish").disabled=true;
    await persistSession({status:"completed",completed_at:new Date().toISOString(),score:0,result:{death:true,death_reason:state.deathReason,clinical_events:state.clinicalEvents, harmful_count:state.harmfulCount,fetal_death:state.fetalDeath,fetal_status:state.fetalStatus,fetal_harm_count:state.fetalHarmCount,scoring_version:5}});
  }

  async function applyClinicalClass(action,original) {
    const cls=classifyAction(action,original);
    if(cls.level==="mortal"){await killPatient(cls.reason,action);return true;}
    if(cls.level==="mortal_fetal"){
      registerFetalHarm(action,cls.reason,{fatal:true});
      state.harmfulCount+=1;
      return false;
    }
    if(cls.level==="malefica"){
      state.harmfulCount+=1;
      if(isHighImpactMedication(action.id)) registerFetalHarm(action,cls.reason);
      const penalty=Number(action.harmful_penalty??4);
      state.penalties+=penalty; state.score-=penalty;
      recordClinicalEvent("malefica",action,cls.reason);
      if(state.harmfulCount>=3){await killPatient("Três condutas prejudiciais acumuladas levaram à deterioração fatal. Última: "+(cls.reason||action.label),action);return true;}
    } else if(cls.level==="essencial"){
      const bonus=Number(action.essential_points??8); state.score+=bonus; recordClinicalEvent("essencial",action,cls.reason);
    } else if(cls.level==="benefica"){
      const bonus=Number(action.beneficial_points??3); state.score+=bonus; recordClinicalEvent("benefica",action,cls.reason);
    } else recordClinicalEvent(cls.level,action,cls.reason);
    return false;
  }


  function clampVital(value,min,max) {
    const n=Number(value);
    if(!Number.isFinite(n)) return null;
    return Math.max(min,Math.min(max,Math.round(n)));
  }

  function parsedBP(bp) {
    const match=String(bp||"").match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
    if(!match) return null;
    return {sys:Number(match[1]),dia:Number(match[2])};
  }

  function setVitalIfNotExplicit(explicit,key,value) {
    if(Object.prototype.hasOwnProperty.call(explicit,key)) return;
    if(value===undefined || value===null || Number.isNaN(value)) return;
    state.vitals={...state.vitals,[key]:value};
  }

  function adjustVital(explicit,key,delta,min,max) {
    if(Object.prototype.hasOwnProperty.call(explicit,key)) return;
    const current=Number(state.vitals?.[key]);
    if(!Number.isFinite(current)) return;
    setVitalIfNotExplicit(explicit,key,clampVital(current+delta,min,max));
  }

  function adjustBP(explicit,sysDelta=0,diaDelta=Math.round(sysDelta*.55)) {
    if(Object.prototype.hasOwnProperty.call(explicit,"bp")) return;
    const bp=parsedBP(state.vitals?.bp);
    if(!bp) return;
    const sys=clampVital(bp.sys+sysDelta,45,260);
    const dia=clampVital(bp.dia+diaDelta,25,160);
    state.vitals={...state.vitals,bp:sys+"/"+dia};
  }

  function physiologicTargetText() {
    return normalizeLabel([
      state.current?.title,
      state.current?.debrief?.diagnosis,
      state.current?.summary,
      state.current?.initial_vitals?.rhythm,
      state.vitals?.rhythm
    ].filter(Boolean).join(" "));
  }

  function applyPhysiologicReaction(action,original,beforeVitals={}) {
    if(!action) return;
    const id=action.id;
    const originalId=original?.id||id;
    const category=action.category||original?.category||"";
    const isIntervention=["iniciais","tratamento","procedimentos_terapeuticos"].includes(category);
    if(!isIntervention) return;

    const explicit=(action.effects && typeof action.effects.vitals==="object") ? action.effects.vitals : {};
    const target=physiologicTargetText();
    const shockable=/fibrilacao ventricular|\bfv\b|tv sem pulso|taquicardia ventricular sem pulso/.test(target);
    const bronchospasm=/asma|broncoespasmo|anafilax/.test(target);
    const hypoxemic=Number(state.vitals?.spo2)<94;
    const hypotensive=(parsedBP(state.vitals?.bp)?.sys||999)<90;
    const tachy=Number(state.vitals?.hr)>110;
    const brady=Number(state.vitals?.hr)>0 && Number(state.vitals?.hr)<55;
    let reactionType="procedure";
    let changed=false;

    const before=JSON.stringify(state.vitals);
    const upSpo2=(n=3)=>adjustVital(explicit,"spo2",n,0,100);
    const downRR=(n=2)=>adjustVital(explicit,"rr",-n,0,60);

    switch(originalId){
      case "monitor":
      case "check_pulse":
      case "check_rhythm":
      case "abcde":
      case "iv_access":
      case "iv_access_2":
      case "io_access":
      case "call_team":
      case "glucose":
      case "central_line":
      case "arterial_line_generic":
      case "urinary_catheter":
      case "ng_tube":
        break;

      case "oxygen":
        reactionType="oxygen";
        if(hypoxemic){ upSpo2(4); downRR(1); }
        break;
      case "bvm":
        reactionType="ventilation";
        upSpo2(8);
        if(!Object.prototype.hasOwnProperty.call(explicit,"rr")) setVitalIfNotExplicit(explicit,"rr",12);
        break;
      case "airway":
      case "cricothyrotomy":
        reactionType="ventilation";
        if(hypoxemic) upSpo2(6);
        if(!Object.prototype.hasOwnProperty.call(explicit,"rr")) setVitalIfNotExplicit(explicit,"rr",14);
        break;
      case "cpr":
        reactionType="cpr";
        break;
      case "defibrillate":
        reactionType="defibrillation";
        // O choque sempre produz artefato elétrico. A conversão sustentada do ritmo
        // vem primeiro dos efeitos específicos do caso; sem efeito configurado,
        // não inventamos ROSC apenas por o botão ter sido pressionado.
        break;
      case "sync_cardioversion":
        reactionType="cardioversion";
        if(!Object.keys(explicit).length && /fibrilacao atrial|flutter|taquicardia supraventricular|taquicardia ventricular com pulso/.test(target)){
          setVitalIfNotExplicit(explicit,"rhythm","Ritmo sinusal");
          setVitalIfNotExplicit(explicit,"hr",82);
          setVitalIfNotExplicit(explicit,"pulse",true);
          if(hypotensive) adjustBP(explicit,12,7);
        }
        break;
      case "transcutaneous_pacing":
        reactionType="pacing";
        if(brady){
          setVitalIfNotExplicit(explicit,"rhythm","Ritmo estimulado por marcapasso");
          setVitalIfNotExplicit(explicit,"hr",70);
          setVitalIfNotExplicit(explicit,"pulse",true);
          adjustBP(explicit,10,6);
        }
        break;
      case "needle_decompression":
      case "chest_tube":
      case "thoracentesis":
        if(/pneumotorax|hemotorax|derrame pleural/.test(target)){
          upSpo2(originalId==="needle_decompression"?7:5);
          downRR(originalId==="needle_decompression"?4:2);
          if(hypotensive) adjustBP(explicit,12,7);
          adjustVital(explicit,"hr",-8,0,220);
        }
        break;
      case "pericardiocentesis":
        if(/tamponamento|derrame pericardico/.test(target)){
          adjustBP(explicit,18,10);
          adjustVital(explicit,"hr",-10,0,220);
        }
        break;
      case "pelvic_binder":
      case "tourniquet":
      case "direct_pressure":
        if(/hemorrag|sangramento|choque hemorr/.test(target)){
          adjustBP(explicit,8,4);
          adjustVital(explicit,"hr",-6,0,220);
        }
        break;

      case "epi_im":
        reactionType="medication";
        adjustVital(explicit,"hr",10,0,220);
        adjustBP(explicit,16,9);
        if(/anafilax/.test(target)){ upSpo2(3); downRR(2); }
        break;
      case "epi":
        reactionType="medication";
        if(state.vitals?.pulse!==false && !shockable){
          adjustVital(explicit,"hr",18,0,220);
          adjustBP(explicit,18,10);
        }
        break;
      case "norepi":
      case "phenylephrine":
      case "vasopressin":
        reactionType="medication";
        adjustBP(explicit,18,10);
        if(originalId==="phenylephrine") adjustVital(explicit,"hr",-4,0,220);
        break;
      case "dopamine":
        reactionType="medication";
        adjustBP(explicit,12,7); adjustVital(explicit,"hr",10,0,220);
        break;
      case "dobutamine":
        reactionType="medication";
        adjustBP(explicit,8,4); adjustVital(explicit,"hr",8,0,220);
        break;
      case "nitroglycerin":
      case "nitroprusside":
      case "hydralazine":
      case "nicardipine":
      case "nifedipine":
        reactionType="medication";
        adjustBP(explicit,originalId==="nitroprusside"?-22:-14,originalId==="nitroprusside"?-12:-8);
        if(originalId==="hydralazine"||originalId==="nifedipine") adjustVital(explicit,"hr",5,0,220);
        break;
      case "metoprolol":
      case "propranolol":
      case "esmolol":
      case "diltiazem":
      case "verapamil":
      case "labetalol":
        reactionType="medication";
        adjustVital(explicit,"hr",tachy?-18:-10,0,220);
        adjustBP(explicit,-10,-6);
        break;
      case "atropine":
        reactionType="medication";
        adjustVital(explicit,"hr",brady?22:12,0,220);
        if(brady) adjustBP(explicit,8,4);
        break;
      case "adenosine":
        reactionType="cardioversion";
        if(/taquicardia supraventricular|qrs estreito/.test(target) && tachy){
          setVitalIfNotExplicit(explicit,"rhythm","Ritmo sinusal");
          setVitalIfNotExplicit(explicit,"hr",82);
        }
        break;
      case "amiodarone":
      case "lidocaine":
        reactionType="medication";
        if(/taquicardia ventricular|arritmia ventricular/.test(target)) adjustVital(explicit,"hr",-18,0,220);
        break;
      case "salbutamol":
      case "terbutaline":
      case "racemic_epinephrine":
        reactionType="medication";
        adjustVital(explicit,"hr",8,0,220);
        if(bronchospasm){ upSpo2(3); downRR(3); }
        break;
      case "ipratropium":
      case "budesonide":
        reactionType="medication";
        if(bronchospasm){ upSpo2(2); downRR(2); }
        break;
      case "morphine":
      case "fentanyl":
        reactionType="medication";
        adjustVital(explicit,"rr",-3,0,60);
        adjustVital(explicit,"hr",-4,0,220);
        adjustBP(explicit,-6,-3);
        break;
      case "midazolam":
      case "diazepam":
      case "propofol":
      case "phenobarbital":
        reactionType="medication";
        adjustVital(explicit,"rr",originalId==="propofol"?-5:-3,0,60);
        adjustBP(explicit,originalId==="propofol"?-10:-5,originalId==="propofol"?-6:-3);
        break;
      case "ketamine":
        reactionType="medication";
        adjustVital(explicit,"hr",6,0,220); adjustBP(explicit,6,3);
        break;
      case "naloxone":
        reactionType="medication";
        if(/opioide|depressao respiratoria/.test(target)){
          adjustVital(explicit,"rr",6,0,60); upSpo2(4);
          if(!Object.prototype.hasOwnProperty.call(explicit,"mental")) setVitalIfNotExplicit(explicit,"mental","Mais responsivo");
        }
        break;
      case "crystalloid":
        reactionType="medication";
        if(hypotensive){adjustBP(explicit,10,6);adjustVital(explicit,"hr",-5,0,220);}
        break;
      case "blood":
      case "plasma":
      case "platelets_tx":
        reactionType="medication";
        if(/hemorrag|sangramento|anemia|choque hemorr/.test(target) && hypotensive){
          adjustBP(explicit,originalId==="blood"?14:8,originalId==="blood"?8:4);
          adjustVital(explicit,"hr",-6,0,220);
        }
        break;
      case "methylergometrine":
        reactionType="medication";
        adjustBP(explicit,10,6);
        break;
      case "succinylcholine":
      case "rocuronium":
        reactionType="medication";
        // Bloqueio neuromuscular não melhora o monitor por si só; sem ventilação,
        // o dano é tratado pelas regras de segurança do caso.
        break;
      default:
        // Antibióticos, analgésicos simples (ex.: dipirona/paracetamol),
        // antieméticos, antiagregantes, anticoagulantes, corticoides e outros
        // fármacos sem efeito monitorizável imediato não alteram sinais vitais.
        if(category==="tratamento") reactionType="medication";
        break;
    }

    changed=before!==JSON.stringify(state.vitals);
    window.PlantaoMonitor?.react(reactionType,{
      actionId:originalId,
      changed,
      before:beforeVitals,
      after:{...state.vitals}
    });
  }

  function applyEffects(effects={}) {
    if (effects.vitals && typeof effects.vitals==="object") {
      state.vitals={...state.vitals,...effects.vitals};
    }
    if (effects.outcome && !state.outcomes.includes(effects.outcome)) {
      state.outcomes.push(effects.outcome);
    }
  }

  function applyDeterioration() {
    const events=Array.isArray(state.current?.deterioration) ? state.current.deterioration : [];
    for (const event of events) {
      if (state.triggered.includes(event.once_key)) continue;
      if (state.elapsed < Number(event.after_min||0)) continue;
      if (event.unless_action && done(event.unless_action)) continue;
      state.triggered.push(event.once_key);
      state.score-=6;
      state.penalties+=6;
      applyEffects(event.effects||{});
      feed("O paciente apresentou piora clínica.","warning");
    }
  }

  function criticalWindow() {
    const t=normalizeLabel(state.current?.title||"");
    if(state.current?.slug==="vf-arrest-ed" || /pcr pediatrica em fibrilacao ventricular|parada cardiorrespiratoria/.test(t))
      return {actionIds:["cpr"],label:"Iniciar RCP",deadline:.5,fatal:"A parada cardiorrespiratória permaneceu sem RCP por mais de 30 segundos."};
    if(t.includes("pneumotorax hipertensivo"))
      return {actionIds:["needle_decompression"],label:"Descompressão torácica",deadline:1,fatal:"A descompressão torácica foi atrasada além da janela crítica."};
    if(/fibrilacao atrial instavel|taquicardia ventricular com pulso instavel/.test(t))
      return {actionIds:["sync_cardioversion"],label:"Cardioversão sincronizada",deadline:2,fatal:"A cardioversão sincronizada foi atrasada apesar da instabilidade."};
    if(t.includes("anafilaxia"))
      return {actionIds:["epi_im"],label:"Adrenalina IM",deadline:2,fatal:"A adrenalina IM foi atrasada em anafilaxia grave."};
    if(/estado de mal epileptico|convulsao febril prolongada/.test(t))
      return {actionIds:["midazolam","diazepam"],label:"Benzodiazepínico",deadline:2,fatal:"O benzodiazepínico foi atrasado durante convulsão prolongada."};
    if(/eclampsia|pre-eclampsia pos-parto/.test(t))
      return {actionIds:["magnesium"],label:"Sulfato de magnésio",deadline:3,fatal:"O sulfato de magnésio foi atrasado na emergência obstétrica."};
    if(t.includes("intoxicacao por opioide"))
      return {actionIds:["bvm","naloxone"],label:"Ventilar / naloxona",deadline:1,fatal:"O suporte ventilatório foi atrasado na depressão respiratória grave."};
    if(/choque septico|meningococcemia|neutropenia febril/.test(t))
      return {actionIds:["ceftriaxone","piperacillin_tazo","vancomycin","cefepime","meropenem"],label:"Antimicrobiano",deadline:10,fatal:"O antimicrobiano foi atrasado de forma crítica na sepse grave."};
    return null;
  }

  function renderCriticalWindow() {
    const host=$("plantao-critical-window");
    if(!host) return;
    const rule=criticalWindow();
    if(!rule){host.hidden=true;host.textContent="";return;}
    const completed=rule.actionIds.some(id=>done(id));
    if(completed){host.hidden=true;host.textContent="";return;}
    const remaining=Math.max(0,rule.deadline-state.elapsed);
    host.hidden=false;
    host.innerHTML='<strong>CASO TEMPO-DEPENDENTE</strong><span>'+esc(rule.label)+' até '+fmtTime(rule.deadline)+' · restam '+fmtTime(remaining)+'</span>';
    host.classList.toggle("critical",remaining<=Math.min(.5,rule.deadline/2));
  }

  function fatalDelayReason() {
    const rule=criticalWindow();
    if(rule && !rule.actionIds.some(id=>done(id)) && state.elapsed>=rule.deadline) return rule.fatal;
    return "";
  }

  async function persistSession(extra={}) {
    if (!state.session?.id) return;
    const payload={
      elapsed_minutes:Math.ceil(state.elapsed),
      score:finalScore(),
      state:{
        vitals:state.vitals,
        performed:state.performed,
        outcomes:state.outcomes,
        triggered:state.triggered,
        penalties:state.penalties, criticalElapsed:state.criticalElapsed, elapsed_seconds:Math.round(state.elapsed*60),
        sequenceViolations:state.sequenceViolations,
        harmfulCount:state.harmfulCount, dead:state.dead, deathReason:state.deathReason, clinicalEvents:state.clinicalEvents,
        diagnosis:state.diagnosis, disposition:state.disposition, scoring_version:5
      },
      action_log:state.log,
      ...extra
    };
    const {error}=await sb.from("clinical_case_sessions").update(payload).eq("id",state.session.id);
    if (error) { console.warn("Plantão: não foi possível persistir a sessão",error); return false; }
    return true;
  }

  async function startCase(caseId) {
    if(state.busy)return;
    const summaryItem=state.cases.find(x=>x.id===caseId);
    if(!summaryItem)return;
    state.busy=true;
    const caseRes=await sb.rpc("get_active_clinical_case",{p_case_id:caseId});
    if(caseRes.error || !caseRes.data?.length){
      state.busy=false;
      console.error("Plantão: falha ao baixar o caso",caseRes.error);
      window.alert("Não foi possível carregar este caso.");
      return;
    }
    const item=caseRes.data[0];
    state.current=item;
    state.elapsed=0;
    state.score=0;
    state.vitals={...(item.initial_vitals||{})};
    state.performed=[];
    state.outcomes=[];
    state.triggered=[];
    state.log=[];
    state.sequenceViolations=[];
    state.monitorOn=false;
    state.harmfulCount=0; state.dead=false; state.deathReason=""; state.fetalHarmCount=0; state.fetalDeath=false; state.fetalStatus=""; state.clinicalEvents=[];
    $("plantao-death-overlay").hidden=true;
    $("plantao-simulator").classList.remove("patient-dead");
    state.category=null;
    state.penalties=0; state.criticalElapsed=0; state.diagnosis=null; state.disposition=null; state.busy=false;
    $("plantao-action-search").value="";
    $("plantao-action-drawer").hidden=true;
    $("plantao-action-tabs").inert=false;

    state.busy=true;
    const {data,error}=await sb.from("clinical_case_sessions").insert({
      user_id:state.user.id,
      case_id:item.id,
      status:"in_progress",
      elapsed_minutes:0,
      score:0,
      state:{vitals:state.vitals,performed:[],outcomes:[],triggered:[],sequenceViolations:[],harmfulCount:0,dead:false,fetalHarmCount:0,fetalDeath:false,fetalStatus:"",clinicalEvents:[],scoring_version:5},
      action_log:[]
    }).select("id,case_id,status,started_at").single();

    if (error) {
      state.busy=false;
      console.error("Plantão: falha ao iniciar sessão",error);
      window.alert("Não foi possível iniciar o caso.");
      return;
    }
    state.busy=false;
    state.session=data;

    const safeOpening=item.presentation?.opening || item.presentation?.chief_complaint || "Paciente admitido para avaliação na sala de emergência.";
    $("plantao-setting").textContent=item.setting || "Sala de emergência";
    $("plantao-case-title").textContent=item.presentation?.chief_complaint || item.presentation?.display_title || "Caso em avaliação";
    $("plantao-opening").textContent=safeOpening;
    const rawAge=String(item.presentation?.age||"").trim();
    const ageNumber=Number(rawAge);
    const ageLabel=rawAge
      ? (/ano|mes|mês|dia/i.test(rawAge) ? rawAge : (Number.isFinite(ageNumber) ? ageNumber+" "+(ageNumber===1?"ano":"anos") : rawAge))
      : "";
    const rawSex=normalizeLabel(item.presentation?.sex||"");
    const sexLabel=rawSex==="f"||rawSex==="feminino" ? "Feminino" : rawSex==="m"||rawSex==="masculino" ? "Masculino" : (item.presentation?.sex||"");
    $("plantao-age").textContent=ageLabel ? "Idade · "+ageLabel : "";
    $("plantao-sex").textContent=sexLabel ? "Sexo · "+sexLabel : "";
    $("plantao-chief").textContent="";
    $("plantao-time").textContent=fmtTime(0);
    updateScore();
    renderVitals();
    renderActions();
    renderCriticalWindow();
    feed(safeOpening,"event",0);
    show("plantao-simulator");
  }

  function patientReportName(){
    const explicit=String(state.current?.presentation?.patient_name||state.current?.presentation?.name||"").trim();
    if(explicit) return explicit;

    const female=["Ana Martins","Mariana Alves","Camila Rocha","Juliana Ribeiro","Fernanda Costa","Larissa Gomes","Patrícia Lima","Beatriz Souza"];
    const male=["Carlos Martins","Rafael Alves","Bruno Rocha","Lucas Ribeiro","Felipe Costa","Gustavo Gomes","Eduardo Lima","André Souza"];
    const source=String(state.current?.slug||state.current?.id||state.current?.title||"paciente");
    let hash=0;
    for(let i=0;i<source.length;i++) hash=(hash*31+source.charCodeAt(i))>>>0;
    const list=patientSex()==="F"?female:male;
    return list[hash%list.length];
  }

  function reportAgeLabel(){
    const raw=String(state.current?.presentation?.age||"").trim();
    if(!raw) return "—";
    if(/ano|mes|mês|dia/i.test(raw)) return raw;
    const n=Number(raw);
    return Number.isFinite(n) ? n+" "+(n===1?"ano":"anos") : raw;
  }

  function reportSexLabel(){
    return patientSex()==="F" ? "Feminino" : "Masculino";
  }

  function closeExamReport(){
    const overlay=$("plantao-report-overlay");
    if(!overlay) return;
    overlay.hidden=true;
    overlay.setAttribute("aria-hidden","true");
  }

  function openExamReport(action,result){
    const overlay=$("plantao-report-overlay");
    if(!overlay) return;
    $("plantao-report-name").textContent=patientReportName();
    $("plantao-report-age").textContent=reportAgeLabel();
    $("plantao-report-sex").textContent=reportSexLabel();
    $("plantao-report-time").textContent="T+"+fmtTime(state.elapsed);
    $("plantao-report-exam").textContent=action.label||"Exame";
    $("plantao-report-text").textContent=String(result||"Sem laudo disponível.");
    overlay.hidden=false;
    overlay.setAttribute("aria-hidden","false");
    requestAnimationFrame(()=>$("plantao-report-close")?.focus());
  }

  async function runAction(actionId) {
    if (!state.current || state.busy || state.session?.status==="completed") return;
    const original=mergedActions().find(x=>x.id===actionId);
    if (!original || (done(actionId)&&!original.repeatable)) return;
    const selected=resolveSpecialAction(original);
    const action=E.resolve(state.current,state,selected);
    if(action.role==='disposition') {
      if(!state.diagnosis) { feed("Selecione uma hipótese principal antes de definir o destino final.","warning");return; }
      if(!window.confirm(action.label+"? Esta decisão encerra o atendimento e abre a avaliação."))return;
    }
    state.busy=true;renderActions();
    $("plantao-finish").disabled=true;$("plantao-back").disabled=true;
    try {
      const sequenceIssue=sequenceCheck(action);
      if(sequenceIssue?.blocked) {
        state.elapsed+=.25;
        if(!E.success(state.current,state))state.criticalElapsed+=.25;
        const penalty=Number(sequenceIssue.penalty||0);
        state.penalties+=penalty;state.score-=penalty;
        const message=recordSequenceViolation(action,sequenceIssue);
        feed((sequenceIssue.message||message)+" (−"+penalty+" pontos por sequência)","warning");
        applyDeterioration();
        renderCriticalWindow();
        const fatalDelay=fatalDelayReason();
        if(fatalDelay){await killPatient(fatalDelay,action);return;}
      } else {
        if(sequenceIssue) {
          const penalty=Number(sequenceIssue.penalty||0);
          state.penalties+=penalty;state.score-=penalty;
          const message=recordSequenceViolation(action,sequenceIssue);
          feed((sequenceIssue.message||message)+" (−"+penalty+" pontos por sequência)","warning");
        }
        const repeated=done(action.id);
        const delta=Number(action.time_min||0);
        if(!E.success(state.current,state))state.criticalElapsed+=delta;
        state.elapsed+=delta;
        // Do not let a late definitive action erase deterioration that occurred during its delay.
        applyDeterioration();
        const fatalDelay=fatalDelayReason();
        if(fatalDelay){await killPatient(fatalDelay,action);return;}
        if(!repeated)state.performed.push(action.id);
        if(original.id==="defibrillate" && !state.performed.includes("defibrillate")) state.performed.push("defibrillate");
        for(const id of (original.satisfies||[])) if(!state.performed.includes(id)) state.performed.push(id);
        if(action.id==="monitor" || original.id==="monitor") state.monitorOn=true;
        const points=repeated?0:Number(action.points||0);
        state.score+=points;
        if(points<0)state.penalties+=Math.abs(points);
        const vitalsBeforeAction={...state.vitals};
        applyEffects(action.effects||{});
        applyPhysiologicReaction(action,original,vitalsBeforeAction);
        if(action.role==='diagnosis'){
          const correct=action.genericDiagnosis===true ? isCorrectGenericDiagnosis(action.label) : action.correct===true;
          state.diagnosis={id:action.id,label:action.label,correct};
          if(action.genericDiagnosis===true && !correct){state.penalties+=4;state.score-=4;}
        }
        if(action.role==='disposition'){
          const correct=action.genericDisposition===true ? inferGenericDisposition(action) : action.correct===true;
          state.disposition={id:action.id,label:action.label,correct};
          if(action.genericDisposition===true && !correct){state.penalties+=8;state.score-=8;}
          if(action.genericDisposition===true && normalizeLabel(action.label).includes("alta") && !correct && ["septic-shock-ed","vf-arrest-ed","af-unstable-ed","anaphylaxis-ed"].includes(state.current?.slug)){
            await killPatient("Você deu alta a um paciente que necessitava tratamento e monitorização hospitalar imediatos.",action);
            return;
          }
        }
        const actionResult=action.category==="exame"
          ? physicalExamResult(action)
          : (["exames","laboratorio","imagem"].includes(action.category)
              ? diagnosticTestResult(action)
              : contextual(action.result||action.label));
        const isDiagnosticExam=["exames","laboratorio","imagem"].includes(action.category);
        if(isDiagnosticExam){
          feed((action.label||"Exame")+" realizado. Laudo disponível.","event");
          openExamReport(action,actionResult);
        } else {
          feed(actionResult+(points<0?` (−${Math.abs(points)} pontos)`:""),points<0?"warning":"event");
        }
        const diedFromAction=await applyClinicalClass(action,original);
        if(diedFromAction)return;
      }
      $("plantao-time").textContent=fmtTime(state.elapsed);
      renderCriticalWindow();
      updateScore();renderVitals();
      const saved=await persistSession();
      if(!saved)feed("Não foi possível salvar agora. Mantenha esta tela aberta; a próxima ação tentará novamente.","warning");
      if(action.role==='disposition'&&state.disposition)await finishCase();
    } finally {
      state.busy=false;renderActions();
      $("plantao-finish").disabled=false;$("plantao-back").disabled=false;
    }
  }

  function hasAnySuccessOutcome() {return E.success(state.current,state);}
  function finalScore() {return E.score(state.current,state).total;}

  async function finishCase() {
    if (!state.current || !state.session) return;
    const rules=state.current.completion_rules || {};
    const required=E.requiredActions ? E.requiredActions(state.current) : (rules.required_actions || []);
    const recommended=rules.recommended_actions || [];
    const missingRequired=required.filter(x=>!done(x));
    const missingRecommended=recommended.filter(x=>!done(x));
    if(!state.diagnosis || !state.disposition) {openActions("hipoteses");return;}
    const score=finalScore();

    const result={
      final_score:score,
      scoring_version:5, penalties:E.score(state.current,state).penalties,
      death:state.dead, death_reason:state.deathReason, fetal_death:state.fetalDeath, fetal_status:state.fetalStatus, fetal_harm_count:state.fetalHarmCount, harmful_count:state.harmfulCount, clinical_events:state.clinicalEvents,
      sequence_violations:state.sequenceViolations,
      diagnosis:state.diagnosis, disposition:state.disposition,
      missing_required:missingRequired,
      missing_recommended:missingRecommended,
      performed_count:state.performed.length,
      elapsed_minutes:Math.ceil(state.elapsed),
      outcomes:state.outcomes
    };

    const saved=await persistSession({
      status:"completed",
      completed_at:new Date().toISOString(),
      score,
      result
    });

    if(!saved){feed("Não foi possível salvar o encerramento. Tente novamente em Definir destino.","warning");return;}
    state.sessions.unshift({id:state.session.id,case_id:state.current.id,status:"completed",score,result,started_at:state.session.started_at,completed_at:new Date().toISOString()});
    state.session.status="completed";
    await pruneCaseHistory(state.current.id);
    renderDebrief(score,missingRequired,missingRecommended);
    show("plantao-debrief");
  }

  function actionLabel(id) {
    return mergedActions().find(x=>x.id===id)?.label || id;
  }

  async function openDeathDebrief(){
    $("plantao-death-overlay").hidden=true;
    const rules=state.current?.completion_rules||{};
    const required=E.requiredActions ? E.requiredActions(state.current) : (rules.required_actions||[]);
    const missingRequired=required.filter(x=>!done(x));
    const missingRecommended=(rules.recommended_actions||[]).filter(x=>!done(x));
    renderDebrief(0,missingRequired,missingRecommended);
    $("plantao-diagnosis").textContent="Óbito durante a simulação — "+state.deathReason;
    show("plantao-debrief");
  }

  function renderDebrief(score,missingRequired,missingRecommended) {
    const d=state.current.debrief || {};
    $("plantao-debrief-title").textContent=state.current.title;
    $("plantao-diagnosis").textContent=d.diagnosis || "";
    $("plantao-final-score").textContent=score;
    $("plantao-pulo").textContent=d.pulo_do_gato || "";
    $("plantao-case-explanation").innerHTML=[
      ["O que costuma ter?",d.o_que_costuma_ter||d.epidemiologia||d.explanation||d.explicacao||""],
      ["O que está acontecendo?",d.o_que_esta_acontecendo||d.quadro_clinico||d.explanation||d.explicacao||""],
      ["Como aparece no plantão?",d.como_aparece_no_plantao||d.apresentacao||state.current?.summary||""],
      ["Como faço o fechamento diagnóstico?",d.fechamento_diagnostico||d.diagnostico||d.diagnosis||""]
    ].map(x=>'<section class="plantao-understand-topic"><h3>'+esc(x[0])+'</h3><p>'+esc(x[1]||"Conteúdo ainda não cadastrado para este tópico.")+'</p></section>').join("");

    const essentialTotal=(E.requiredActions ? E.requiredActions(state.current) : (state.current.completion_rules?.required_actions||[])).length;
    const essentialDone=essentialTotal-missingRequired.length;
    const eventCount=level=>state.clinicalEvents.filter(x=>x.level===level).length;
    const positive=eventCount("essencial")+eventCount("benefica");
    const harmful=eventCount("malefica")+eventCount("mortal");

    $("plantao-performance").innerHTML=[
      ["Tempo",fmtTime(state.elapsed)],
      ["Penalidades","−"+E.score(state.current,state).penalties+" pontos"],
      ["Hipótese",state.diagnosis?.label||"Não definida"],
      ["Destino",state.disposition?.label||"Não definido"],
      ["Ações realizadas",String(state.performed.length)],
      ["Essenciais",essentialDone+"/"+essentialTotal],
      ["Ações essenciais",String(eventCount("essencial"))],
      ["Ações benéficas",String(eventCount("benefica"))],
      ["Bônus por ações benéficas","+"+(eventCount("benefica")*2)+" pontos"],
      ["Ações neutras",String(eventCount("neutra"))],
      ["Ações prejudiciais",String(harmful)],
      ["Erros de sequência",String(state.sequenceViolations.length)],
      ["Condutas maléficas",String(state.clinicalEvents.filter(x=>x.level==="malefica").length)],
      ["Condutas mortais",String(state.clinicalEvents.filter(x=>x.level==="mortal").length)],
      ["Desfecho",state.dead?"Óbito materno":(state.fetalDeath?"Paciente viva · óbito fetal":"Paciente vivo")],
      ...(ongoingPregnancyCase() ? [["Desfecho fetal",state.fetalDeath?"Óbito fetal":(state.fetalStatus||"Sem deterioração fetal registrada")]] : [])
    ].map(([a,b])=>`<div class="plantao-performance-row"><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`).join("");

    const key=[...(d.key_actions||[]),d.scoring_note].filter(Boolean).map(text=>`<div class="plantao-review-item"><span>✓</span><span>${esc(text)}</span></div>`);
    if (missingRequired.length) key.push(...missingRequired.map(id=>`<div class="plantao-review-item"><span>!</span><span>Você não realizou: ${esc(actionLabel(id))}</span></div>`));
    if (missingRecommended.length) key.push(...missingRecommended.slice(0,4).map(id=>`<div class="plantao-review-item"><span>–</span><span>Poderia acrescentar: ${esc(actionLabel(id))}</span></div>`));
    $("plantao-key-actions").innerHTML=key.join("");

    const sequence=state.sequenceViolations.map(item=>
      '<div class="plantao-review-item plantao-sequence-item"><span>↳</span><span><strong>'+
      esc(item.blocked?"Ação antecipada bloqueada":"Ação fora de sequência")+
      ':</strong> '+esc(item.message)+(item.penalty?' (−'+esc(item.penalty)+' pts)':'')+'</span></div>'
    );
    const expectedSequence=(d.sequence_errors||[]).map(text=>
      '<div class="plantao-review-item plantao-sequence-item"><span>•</span><span><strong>Ponto crítico de sequência:</strong> '+esc(text)+'</span></div>'
    );
    $("plantao-sequence-errors").innerHTML=[...sequence,...expectedSequence].join("")||'<div class="plantao-review-item"><span>✓</span><span>Nenhum erro de sequência registrado.</span></div>';

    const wrongEvents=state.clinicalEvents.filter(x=>x.level==="malefica"||x.level==="mortal");
    const expectedWrong=(d.wrong_actions||[]).map(text=>`<div class="plantao-review-item"><span>•</span><span>${esc(text)}</span></div>`);
    const performedWrong=wrongEvents.map(item=>`<div class="plantao-review-item"><span>!</span><span><strong>${esc(item.action_label)}:</strong> ${esc(item.reason||"Conduta inadequada para o contexto clínico.")}</span></div>`);
    $("plantao-wrong-actions").innerHTML=[...performedWrong,...expectedWrong].join("")||'<div class="plantao-review-item"><span>✓</span><span>Nenhuma conduta errada prevista ou registrada.</span></div>';

    const danger=(d.dangerous_actions||[]).map(text=>`<div class="plantao-review-item"><span>!</span><span>${esc(text)}</span></div>`);
    $("plantao-danger-actions").innerHTML=danger.join("");

    $("plantao-sources").innerHTML=(state.current.source_refs||[]).map(src=>`<a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">${esc(src.title)}</a>`).join("");
  }

  async function pruneCaseHistory(caseId) {
    if(!caseId)return;
    const {error}=await sb.rpc("prune_clinical_case_sessions_keep_best",{p_case_id:caseId});
    if(error){console.warn("Plantão: não foi possível limpar o histórico da estação",error);return false;}
    state.sessions=state.sessions.filter(s=>s.case_id!==caseId);
    const {data}=await sb.from("clinical_case_sessions")
      .select("id,case_id,status,started_at,completed_at,score,result,attempt_count")
      .eq("user_id",state.user.id).eq("case_id",caseId).eq("status","completed")
      .order("score",{ascending:false}).limit(1);
    if(data?.length)state.sessions.push(data[0]);
    return true;
  }

  async function discardActiveSession() {
    const sessionId=state.session?.id;
    if(!sessionId || state.session?.status==="completed") return true;
    const {error}=await sb.rpc("discard_clinical_case_session",{p_session_id:sessionId});
    if(error){console.warn("Plantão: não foi possível descartar a sessão incompleta",error);return false;}
    state.session=null;
    return true;
  }

  async function backToLibrary() {
    const caseId=state.current?.id;
    const leavingDebrief=!!caseId && state.session?.status==="completed";
    if(leavingDebrief) await pruneCaseHistory(caseId);
    else await discardActiveSession();
    state.current=null;
    state.session=null;
    renderLibrary();
    $("plantao-action-drawer").hidden=true;
    $("plantao-action-tabs").inert=false;
    show("plantao-library");
  }

  document.addEventListener("click",async event=>{
    const closeDrawer=event.target.closest("#plantao-action-close");
    if (closeDrawer) {
      event.preventDefault();
      event.stopPropagation();
      closeActions();
      return;
    }

    const start=event.target.closest("[data-start-case]");
    if (start) return startCase(start.dataset.startCase);

    const tab=event.target.closest("[data-case-category]");
    if (tab) {
      $("plantao-action-search").value="";
      openActions(tab.dataset.caseCategory);
      return;
    }

    const interventionTab=event.target.closest("[data-intervention-tab]");
    if (interventionTab) {
      state.interventionTab=interventionTab.dataset.interventionTab;
      renderActions();
      return;
    }

    const examTab=event.target.closest("[data-exam-tab]");
    if (examTab) {
      state.examTab=examTab.dataset.examTab;
      renderActions();
      return;
    }

    const action=event.target.closest("[data-case-action]");
    if (action) return runAction(action.dataset.caseAction);
  });

  $("plantao-finish")?.addEventListener("click",()=>{if(state.disposition)finishCase();else openActions("hipoteses");});
  $("plantao-conduta-finish")?.addEventListener("click",()=>{if(state.disposition)finishCase();else feed("Defina a conduta final antes de finalizar o atendimento.","warning");});
  $("plantao-action-close")?.addEventListener("click",closeActions);
  $("plantao-action-search")?.addEventListener("input",renderActions);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("plantao-action-drawer").hidden)closeActions();});
  $("plantao-back")?.addEventListener("click",async()=>{
    await backToLibrary();
  });
  $("plantao-all-cases")?.addEventListener("click",()=>backToLibrary());
  $("plantao-retry")?.addEventListener("click",async()=>{
    if(!state.current)return;
    const caseId=state.current.id;
    if(state.session?.status==="completed") await pruneCaseHistory(caseId);
    else await discardActiveSession();
    await startCase(caseId);
  });
  $("plantao-death-review")?.addEventListener("click",openDeathDebrief);

  function updatePhonePreviewClock(){
    const now=new Date();
    const hh=String(now.getHours()).padStart(2,"0");
    const mm=String(now.getMinutes()).padStart(2,"0");
    const value=hh+":"+mm;
    const status=$("plantao-phone-time");
    const deviceStatus=$("plantao-phone-status-time");
    const stamp=$("plantao-phone-chat-time");
    if(status) status.textContent=value;
    if(deviceStatus) deviceStatus.textContent=value;
    if(stamp) stamp.textContent=value;
  }

  updatePhonePreviewClock();
  window.setInterval(updatePhonePreviewClock,30000);
  load().catch(error=>console.error("Plantão:",error));
})();