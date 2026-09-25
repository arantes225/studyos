/* Pure clinical simulation rules shared by UI and regression checks. */
(function(root){
  'use strict';
  function canonical(item,id){return (item.actions||[]).find(a=>a.id===id)?.equivalent_to || id;}
  function done(item,performed,id){return performed.some(x=>canonical(item,x)===canonical(item,id));}
  function matches(item,state,when={}){
    return (!when.performed_all || when.performed_all.every(id=>done(item,state.performed,id)))
      && (!when.performed_none || when.performed_none.every(id=>!done(item,state.performed,id)))
      && (!when.outcomes_any || when.outcomes_any.some(x=>state.outcomes.includes(x)))
      && (!when.outcomes_none || when.outcomes_none.every(x=>!state.outcomes.includes(x)));
  }
  function resolve(item,state,action){
    const variant=(action.variants||[]).find(v=>matches(item,state,v.when));
    return variant ? {...action,...variant} : action;
  }
  function success(item,state){return (item.completion_rules?.success_outcomes||[]).some(x=>state.outcomes.includes(x));}
  function requiredActions(item){
    const configured=Array.isArray(item.completion_rules?.required_actions)?item.completion_rules.required_actions.filter(Boolean):[];
    if(configured.length) return [...new Set(configured)];
    const t=String(item.title||item.debrief?.diagnosis||"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase();
    const ids=["abcde","monitor"];
    const add=(...xs)=>ids.push(...xs);
    if(/anafilax/.test(t)) add("epi_im");
    if(/pneumotorax hipertensivo/.test(t)) add("needle_decompression");
    if(/estado de mal|convulsao.*prolong/.test(t)) add("midazolam");
    if(/eclamps|pre-eclamps/.test(t)) add("magnesium");
    if(/fibrilacao atrial.*instavel|taquicardia ventricular com pulso instavel/.test(t)) add("sync_cardioversion");
    if(/fibrilacao ventricular|tv sem pulso|parada cardiorrespiratoria|pcr pediatrica/.test(t)) add("cpr","defibrillate");
    if(/sepse|choque septico|meningococcemia|neutropenia febril/.test(t)) add("iv_access");
    if(/hipoglic/.test(t)) add("glucose");
    if(/asma.*grave|broncoespasmo/.test(t)) add("oxygen");
    if(/hemorrag|choque hemorr|ectopica rota|hemotorax macico/.test(t)) add("iv_access","iv_access_2");
    return [...new Set(ids)];
  }
  function score(item,state){
    const rules=item.completion_rules||{};
    const required=requiredActions(item);
    const completed=required.filter(id=>done(item,state.performed,id)).length;
    // 70 pontos: condutas-chave, divididos igualmente entre elas.
    // 15 pontos: hipótese correta. 15 pontos: destino correto.
    // Penalidades são subtraídas depois. A nota exibida não fica negativa,
    // mas raw preserva o saldo real (ex.: 0 - 12 = -12).
    const keyEarned=required.length ? 70*(completed/required.length) : 0;
    const earned=keyEarned+(state.diagnosis?.correct?15:0)+(state.disposition?.correct?15:0);
    const timePenalty=Math.max(0,(state.criticalElapsed||0)-Number(rules.max_minutes||30));
    const penalties=Number(state.penalties||0)+timePenalty;
    const raw=Math.round((earned-penalties)*10)/10;
    return {
      earned:Math.round(earned*10)/10,
      penalties:Math.round(penalties*10)/10,
      omissionPenalty:0,
      missingRequired:required.filter(id=>!done(item,state.performed,id)),
      raw,
      total:Math.max(0,Math.min(100,Math.round(raw)))
    };
  }
  const api={done,resolve,score,success,requiredActions};root.PlantaoEngine=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
