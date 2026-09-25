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
    const recommended=Array.isArray(rules.recommended_actions)?rules.recommended_actions:[];
    const ratio=ids=>ids.length?ids.filter(id=>done(item,state.performed,id)).length/ids.length:1;
    const missingRequired=required.filter(id=>!done(item,state.performed,id));
    const omissionPenalty=missingRequired.length*8;
    const earned=45*ratio(required)+15*ratio(recommended)
      +(success(item,state)?15:0)+(state.diagnosis?.correct?10:0)+(state.disposition?.correct?15:0);
    const timePenalty=Math.max(0,(state.criticalElapsed||0)-Number(rules.max_minutes||30));
    const penalties=Number(state.penalties||0)+timePenalty+omissionPenalty;
    return {earned:Math.round(earned),penalties:Math.round(penalties*10)/10,omissionPenalty,missingRequired,total:Math.max(0,Math.min(100,Math.round(earned-penalties)))};
  }
  const api={done,resolve,score,success,requiredActions};root.PlantaoEngine=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
