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
    category:null,
    penalties:0, criticalElapsed:0, diagnosis:null, disposition:null, busy:false
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

    const [casesRes,sessionsRes] = await Promise.all([
      sb.from("clinical_cases")
        .select("id,slug,title,setting,specialty,difficulty,summary,presentation,initial_vitals,actions,deterioration,completion_rules,debrief,source_refs,version")
        .eq("active",true)
        .order("title"),
      sb.from("clinical_case_sessions")
        .select("id,case_id,status,started_at,completed_at,score,result")
        .eq("user_id",user.id)
        .order("started_at",{ascending:false})
        .limit(100)
    ]);

    if (casesRes.error) {
      console.error("Plantão: falha ao carregar casos",casesRes.error);
      $("plantao-empty").hidden=false;
      $("plantao-empty").textContent="Não foi possível carregar os casos clínicos.";
      return;
    }
    state.cases=casesRes.data || [];
    state.sessions=sessionsRes.error ? [] : (sessionsRes.data || []);
    renderLibrary();
  }

  function bestScore(caseId) {
    const values=state.sessions.filter(x=>x.case_id===caseId && x.status==="completed").map(x=>Number(x.score||0));
    return values.length ? Math.max(...values) : null;
  }

  function renderLibrary() {
    $("plantao-case-count").textContent=state.cases.length;
    $("plantao-session-count").textContent=state.sessions.length;
    const grid=$("plantao-case-grid");
    const empty=$("plantao-empty");
    if (!state.cases.length) {
      grid.innerHTML="";
      empty.hidden=false;
      return;
    }
    empty.hidden=true;
    grid.innerHTML=state.cases.map(item=>{
      const best=bestScore(item.id);
      return `
        <article class="plantao-case-card">
          <div class="plantao-case-card-head">
            <div>
              <h3>${esc(item.presentation?.display_title || item.title)}</h3>
              <div class="plantao-case-tags">
                <span>${esc(item.specialty)}</span>
                <span>${esc(item.difficulty)}</span>
                <span>${esc(item.setting)}</span>
              </div>
            </div>
            ${best==null ? "" : `<span class="badge accent">Melhor: ${Math.round(best)}/100</span>`}
          </div>
          <p>${esc(item.summary)}</p>
          <button class="button primary" type="button" data-start-case="${esc(item.id)}">Iniciar caso</button>
        </article>
      `;
    }).join("");
  }

  const GROUPS = {
    anamnese:{label:"Anamnese",icon:"◉",categories:["anamnese"]},
    fisico:{label:"Exame físico",icon:"✚",categories:["exame"]},
    iniciais:{label:"Procedimentos iniciais / emergência",icon:"ϟ",categories:["iniciais","monitorizacao"]},
    exames:{label:"Exames",icon:"▤",categories:["exames","laboratorio","imagem"]},
    intervir:{label:"Intervenções",icon:"✚",categories:["tratamento","procedimentos","procedimentos_terapeuticos"]},
    hipoteses:{label:"Hipóteses e conduta final",icon:"◎",categories:["hipoteses","destino","encaminhamento","raciocinio"]}
  };
  const groupOf = category => Object.keys(GROUPS).find(key=>GROUPS[key].categories.includes(category)) || "intervir";
  const done = id => E.done(state.current,state.performed,id);
  function openActions(category) {
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
    const score=E.score(state.current,state);
    $("plantao-score-live").textContent=score.total+"/100 · −"+score.penalties+" pts";
  }
  function contextual(text) {
    return String(text||"").replace(/\{\{(\w+)\}\}/g,(_,key)=>String(state.vitals[key]??"não informado"));
  }

  function renderVitals() {
    const v=state.vitals || {};
    window.PlantaoMonitor?.update(v, {slug:state.current?.slug});
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
        <strong>${esc(val ?? "—")}${unit && val!=null && val!=="—" ? " <small>"+unit+"</small>" : ""}</strong>
      </div>
    `).join("");
  }

  function feed(message,type="event",time=state.elapsed) {
    state.log.push({time,message,type});
    $("plantao-feed").innerHTML=state.log.slice().reverse().map(item=>`
      <div class="plantao-feed-item ${esc(item.type)}">
        <span>T+${fmtTime(item.time)}</span>
        <p>${esc(item.message)}</p>
      </div>
    `).join("");
  }

  function renderActions() {
    const actions=Array.isArray(state.current?.actions) ? state.current.actions : [];
    if(!GROUPS[state.category])state.category="anamnese";
    $("plantao-action-tabs").innerHTML=Object.entries(GROUPS).map(([key,g])=>`
      <button class="plantao-action-tab" type="button" data-case-category="${key}" aria-controls="plantao-action-drawer" aria-expanded="${!$("plantao-action-drawer").hidden&&key===state.category}">
        <span aria-hidden="true">${g.icon}</span><span>${g.label}</span>
      </button>`).join("");
    $("plantao-action-title").textContent=GROUPS[state.category].label;
    const search=$("plantao-action-search").value.trim().toLocaleLowerCase('pt-BR');
    const available=actions.filter(a=>groupOf(a.category)===state.category && (!search||(a.label+" "+(a.subgroup||"")).toLocaleLowerCase('pt-BR').includes(search)));
    const groups=[...new Set(available.map(a=>a.subgroup||CATEGORY_LABELS[a.category]||"Opções"))];
    $("plantao-actions").innerHTML=groups.map(group=>`<section class="plantao-action-group"><h3>${esc(group)}</h3>${available.filter(a=>(a.subgroup||CATEGORY_LABELS[a.category]||"Opções")===group).map(action=>{
      const completed=done(action.id);
      return `<button class="plantao-action" type="button" data-case-action="${esc(action.id)}" ${state.busy||(completed&&!action.repeatable)?"disabled":""}>
        <strong>${esc(action.label)}</strong>
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
      feed((event.message||"O paciente apresentou piora clínica.")+" (−6 pontos por atraso)","warning");
    }
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
        diagnosis:state.diagnosis, disposition:state.disposition, scoring_version:3
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
    const item=state.cases.find(x=>x.id===caseId);
    if (!item) return;
    state.current=item;
    state.elapsed=0;
    state.score=0;
    state.vitals={...(item.initial_vitals||{})};
    state.performed=[];
    state.outcomes=[];
    state.triggered=[];
    state.log=[];
    state.sequenceViolations=[];
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
      state:{vitals:state.vitals,performed:[],outcomes:[],triggered:[],sequenceViolations:[],scoring_version:3},
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

    $("plantao-setting").textContent=item.setting || "Sala de emergência";
    $("plantao-case-title").textContent=item.presentation?.display_title || item.title;
    $("plantao-opening").textContent=item.presentation?.opening || item.summary;
    $("plantao-age").textContent=item.presentation?.age || "";
    $("plantao-sex").textContent=item.presentation?.sex || "";
    $("plantao-chief").textContent=item.presentation?.chief_complaint ? "Queixa: "+item.presentation.chief_complaint : "";
    $("plantao-time").textContent=fmtTime(0);
    updateScore();
    renderVitals();
    renderActions();
    feed(item.presentation?.opening || item.summary,"event",0);
    show("plantao-simulator");
  }

  async function runAction(actionId) {
    if (!state.current || state.busy || state.session?.status==="completed") return;
    const original=(state.current.actions||[]).find(x=>x.id===actionId);
    if (!original || (done(actionId)&&!original.repeatable)) return;
    const action=E.resolve(state.current,state,original);
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
        if(!repeated)state.performed.push(action.id);
        const points=repeated?0:Number(action.points||0);
        state.score+=points;
        if(points<0)state.penalties+=Math.abs(points);
        applyEffects(action.effects||{});
        if(action.role==='diagnosis')state.diagnosis={id:action.id,label:action.label,correct:action.correct===true};
        if(action.role==='disposition')state.disposition={id:action.id,label:action.label,correct:action.correct===true};
        feed(contextual(action.result||action.label)+(points<0?` (−${Math.abs(points)} pontos)`:""),points<0?"warning":"event");
      }
      $("plantao-time").textContent=fmtTime(state.elapsed);
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
    const required=rules.required_actions || [];
    const recommended=rules.recommended_actions || [];
    const missingRequired=required.filter(x=>!done(x));
    const missingRecommended=recommended.filter(x=>!done(x));
    if(!state.diagnosis || !state.disposition) {openActions("hipoteses");return;}
    const score=finalScore();

    const result={
      final_score:score,
      scoring_version:3, penalties:E.score(state.current,state).penalties,
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
    renderDebrief(score,missingRequired,missingRecommended);
    show("plantao-debrief");
  }

  function actionLabel(id) {
    return state.current?.actions?.find(x=>x.id===id)?.label || id;
  }

  function renderDebrief(score,missingRequired,missingRecommended) {
    const d=state.current.debrief || {};
    $("plantao-debrief-title").textContent=state.current.title;
    $("plantao-diagnosis").textContent=d.diagnosis || "";
    $("plantao-final-score").textContent=score;
    $("plantao-pulo").textContent=d.pulo_do_gato || "";

    const essentialTotal=(state.current.completion_rules?.required_actions||[]).length;
    const essentialDone=essentialTotal-missingRequired.length;
    const positive=state.current.actions.filter(a=>state.performed.includes(a.id)&&Number(a.points||0)>0).length;
    const harmful=state.current.actions.filter(a=>state.performed.includes(a.id)&&Number(a.points||0)<0).length;

    $("plantao-performance").innerHTML=[
      ["Tempo",fmtTime(state.elapsed)],
      ["Penalidades","−"+E.score(state.current,state).penalties+" pontos"],
      ["Hipótese",state.diagnosis?.label||"Não definida"],
      ["Destino",state.disposition?.label||"Não definido"],
      ["Ações realizadas",String(state.performed.length)],
      ["Essenciais",essentialDone+"/"+essentialTotal],
      ["Ações úteis",String(positive)],
      ["Ações prejudiciais",String(harmful)],
      ["Erros de sequência",String(state.sequenceViolations.length)]
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
    $("plantao-sequence-errors").innerHTML=sequence.length?sequence.join(""):'<div class="plantao-review-item"><span>✓</span><span>Nenhum erro de sequência registrado.</span></div>';

    const danger=(d.dangerous_actions||[]).map(text=>`<div class="plantao-review-item"><span>!</span><span>${esc(text)}</span></div>`);
    $("plantao-danger-actions").innerHTML=danger.join("");

    $("plantao-sources").innerHTML=(state.current.source_refs||[]).map(src=>`<a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">${esc(src.title)}</a>`).join("");
  }

  function backToLibrary() {
    state.current=null;
    state.session=null;
    renderLibrary();
    $("plantao-action-drawer").hidden=true;
    $("plantao-action-tabs").inert=false;
    show("plantao-library");
  }

  document.addEventListener("click",async event=>{
    const start=event.target.closest("[data-start-case]");
    if (start) return startCase(start.dataset.startCase);

    const tab=event.target.closest("[data-case-category]");
    if (tab) {
      $("plantao-action-search").value="";
      openActions(tab.dataset.caseCategory);
      return;
    }

    const action=event.target.closest("[data-case-action]");
    if (action) return runAction(action.dataset.caseAction);
  });

  $("plantao-finish")?.addEventListener("click",()=>{if(state.disposition)finishCase();else openActions("hipoteses");});
  $("plantao-action-close")?.addEventListener("click",closeActions);
  $("plantao-action-search")?.addEventListener("input",renderActions);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("plantao-action-drawer").hidden)closeActions();});
  $("plantao-back")?.addEventListener("click",async()=>{
    if (state.session?.id) await persistSession({status:"abandoned"});
    backToLibrary();
  });
  $("plantao-all-cases")?.addEventListener("click",backToLibrary);
  $("plantao-retry")?.addEventListener("click",()=>state.current && startCase(state.current.id));

  load().catch(error=>console.error("Plantão:",error));
})();