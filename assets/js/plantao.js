(() => {
  "use strict";

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
    category:null
  };

  function fmtTime(minutes) {
    const total = Math.max(0, Number(minutes || 0));
    return String(Math.floor(total/60)).padStart(2,"0") + ":" + String(total%60).padStart(2,"0");
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
              <h3>${esc(item.title)}</h3>
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

  function renderVitals() {
    const v=state.vitals || {};
    const items=[
      ["FC",v.hr,"bpm"],
      ["PA",v.bp,"mmHg"],
      ["FR",v.rr,"irpm"],
      ["SpO₂",v.spo2,"%"],
      ["Temp",v.temp,"°C"],
      ["Ritmo",v.rhythm,""],
      ["Neurológico",v.mental,""]
    ];
    $("plantao-vitals").innerHTML=items.map(([label,val,unit],idx)=>`
      <div class="plantao-vital ${idx>=5 ? "wide":""}">
        <span>${esc(label)}</span>
        <strong>${esc(val ?? "—")}${unit && val!==undefined && val!=="—" ? " "+unit : ""}</strong>
      </div>
    `).join("");
  }

  function feed(message,type="event",time=state.elapsed) {
    state.log.push({time,message,type});
    $("plantao-feed").innerHTML=state.log.slice().reverse().map(item=>`
      <div class="plantao-feed-item ${esc(item.type)}">
        <span>T+${esc(item.time)} min</span>
        <p>${esc(item.message)}</p>
      </div>
    `).join("");
  }

  function renderActions() {
    const actions=Array.isArray(state.current?.actions) ? state.current.actions : [];
    const categories=[...new Set(actions.map(x=>x.category))];
    if (!state.category || !categories.includes(state.category)) state.category=categories[0] || null;

    $("plantao-action-tabs").innerHTML=categories.map(cat=>`
      <button class="plantao-action-tab ${state.category===cat?"active":""}" type="button" data-case-category="${esc(cat)}">${esc(CATEGORY_LABELS[cat]||cat)}</button>
    `).join("");

    $("plantao-actions").innerHTML=actions.filter(x=>x.category===state.category).map(action=>{
      const done=state.performed.includes(action.id);
      return `
        <button class="plantao-action" type="button" data-case-action="${esc(action.id)}" ${done?"disabled":""}>
          <strong>${esc(action.label)}</strong>
          <small>${done ? "Já realizado" : "+"+Number(action.time_min||0)+" min"}</small>
        </button>
      `;
    }).join("");
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
      if (event.unless_action && state.performed.includes(event.unless_action)) continue;
      state.triggered.push(event.once_key);
      state.score-=6;
      applyEffects(event.effects||{});
      feed(event.message||"O paciente apresentou piora clínica.","warning");
    }
  }

  async function persistSession(extra={}) {
    if (!state.session?.id) return;
    const payload={
      elapsed_minutes:state.elapsed,
      score:state.score,
      state:{
        vitals:state.vitals,
        performed:state.performed,
        outcomes:state.outcomes,
        triggered:state.triggered
      },
      action_log:state.log,
      ...extra
    };
    const {error}=await sb.from("clinical_case_sessions").update(payload).eq("id",state.session.id);
    if (error) console.warn("Plantão: não foi possível persistir a sessão",error);
  }

  async function startCase(caseId) {
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
    state.category=null;

    const {data,error}=await sb.from("clinical_case_sessions").insert({
      user_id:state.user.id,
      case_id:item.id,
      status:"in_progress",
      elapsed_minutes:0,
      score:0,
      state:{vitals:state.vitals,performed:[],outcomes:[],triggered:[]},
      action_log:[]
    }).select("id,case_id,status,started_at").single();

    if (error) {
      console.error("Plantão: falha ao iniciar sessão",error);
      window.alert("Não foi possível iniciar o caso.");
      return;
    }
    state.session=data;

    $("plantao-setting").textContent=item.setting || "Sala de emergência";
    $("plantao-case-title").textContent=item.title;
    $("plantao-opening").textContent=item.presentation?.opening || item.summary;
    $("plantao-age").textContent=item.presentation?.age || "";
    $("plantao-sex").textContent=item.presentation?.sex || "";
    $("plantao-chief").textContent=item.presentation?.chief_complaint ? "Queixa: "+item.presentation.chief_complaint : "";
    $("plantao-time").textContent=fmtTime(0);
    $("plantao-score-live").textContent="0 pts";
    renderVitals();
    renderActions();
    feed(item.presentation?.opening || item.summary,"event",0);
    show("plantao-simulator");
  }

  async function runAction(actionId) {
    if (!state.current || state.performed.includes(actionId)) return;
    const action=(state.current.actions||[]).find(x=>x.id===actionId);
    if (!action) return;

    const missing=(action.requires_all||[]).filter(id=>!state.performed.includes(id));
    if (missing.length) {
      state.elapsed+=1;
      state.score-=2;
      feed(action.result_if_blocked || "Essa ação ainda não pode ser executada com segurança neste ponto do caso.","warning");
      applyDeterioration();
      $("plantao-time").textContent=fmtTime(state.elapsed);
      $("plantao-score-live").textContent=state.score+" pts";
      renderVitals();
      await persistSession();
      return;
    }

    state.performed.push(action.id);
    state.elapsed+=Number(action.time_min||0);
    state.score+=Number(action.points||0);
    applyEffects(action.effects||{});
    feed(action.result || action.label, Number(action.points||0)<0 ? "warning" : "event");
    applyDeterioration();

    $("plantao-time").textContent=fmtTime(state.elapsed);
    $("plantao-score-live").textContent=state.score+" pts";
    renderVitals();
    renderActions();
    await persistSession();
  }

  function hasAnySuccessOutcome() {
    const acceptable=state.current?.completion_rules?.success_outcomes || [];
    return acceptable.some(x=>state.outcomes.includes(x));
  }

  function finalScore() {
    const rules=state.current?.completion_rules || {};
    const required=rules.required_actions || [];
    const recommended=rules.recommended_actions || [];
    const reqDone=required.filter(x=>state.performed.includes(x)).length;
    const recDone=recommended.filter(x=>state.performed.includes(x)).length;
    const reqRatio=required.length ? reqDone/required.length : 1;
    const recRatio=recommended.length ? recDone/recommended.length : 1;
    const outcomeBonus=hasAnySuccessOutcome()?15:0;
    const timeLimit=Number(rules.max_minutes||30);
    const timePenalty=Math.max(0,state.elapsed-timeLimit);
    return Math.max(0,Math.min(100,Math.round(25 + state.score + reqRatio*25 + recRatio*15 + outcomeBonus - timePenalty)));
  }

  async function finishCase() {
    if (!state.current || !state.session) return;
    const rules=state.current.completion_rules || {};
    const required=rules.required_actions || [];
    const recommended=rules.recommended_actions || [];
    const missingRequired=required.filter(x=>!state.performed.includes(x));
    const missingRecommended=recommended.filter(x=>!state.performed.includes(x));
    const score=finalScore();

    const result={
      final_score:score,
      missing_required:missingRequired,
      missing_recommended:missingRecommended,
      performed_count:state.performed.length,
      elapsed_minutes:state.elapsed,
      outcomes:state.outcomes
    };

    await persistSession({
      status:"completed",
      completed_at:new Date().toISOString(),
      score,
      result
    });

    state.sessions.unshift({id:state.session.id,case_id:state.current.id,status:"completed",score,result,started_at:state.session.started_at,completed_at:new Date().toISOString()});
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
      ["Tempo",state.elapsed+" min"],
      ["Ações realizadas",String(state.performed.length)],
      ["Essenciais",essentialDone+"/"+essentialTotal],
      ["Ações úteis",String(positive)],
      ["Ações prejudiciais",String(harmful)]
    ].map(([a,b])=>`<div class="plantao-performance-row"><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`).join("");

    const key=(d.key_actions||[]).map(text=>`<div class="plantao-review-item"><span>✓</span><span>${esc(text)}</span></div>`);
    if (missingRequired.length) key.push(...missingRequired.map(id=>`<div class="plantao-review-item"><span>!</span><span>Você não realizou: ${esc(actionLabel(id))}</span></div>`));
    if (missingRecommended.length) key.push(...missingRecommended.slice(0,4).map(id=>`<div class="plantao-review-item"><span>–</span><span>Poderia acrescentar: ${esc(actionLabel(id))}</span></div>`));
    $("plantao-key-actions").innerHTML=key.join("");

    const danger=(d.dangerous_actions||[]).map(text=>`<div class="plantao-review-item"><span>!</span><span>${esc(text)}</span></div>`);
    $("plantao-danger-actions").innerHTML=danger.join("");

    $("plantao-sources").innerHTML=(state.current.source_refs||[]).map(src=>`<a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">${esc(src.title)}</a>`).join("");
  }

  function backToLibrary() {
    state.current=null;
    state.session=null;
    renderLibrary();
    show("plantao-library");
  }

  document.addEventListener("click",async event=>{
    const start=event.target.closest("[data-start-case]");
    if (start) return startCase(start.dataset.startCase);

    const tab=event.target.closest("[data-case-category]");
    if (tab) {
      state.category=tab.dataset.caseCategory;
      renderActions();
      return;
    }

    const action=event.target.closest("[data-case-action]");
    if (action) return runAction(action.dataset.caseAction);
  });

  $("plantao-finish")?.addEventListener("click",finishCase);
  $("plantao-back")?.addEventListener("click",async()=>{
    if (state.session?.id) await persistSession({status:"abandoned"});
    backToLibrary();
  });
  $("plantao-all-cases")?.addEventListener("click",backToLibrary);
  $("plantao-retry")?.addEventListener("click",()=>state.current && startCase(state.current.id));

  load().catch(error=>console.error("Plantão:",error));
})();