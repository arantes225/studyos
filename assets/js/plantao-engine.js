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
  function score(item,state){
    const rules=item.completion_rules||{};
    const ratio=ids=>ids.length?ids.filter(id=>done(item,state.performed,id)).length/ids.length:1;
    const earned=45*ratio(rules.required_actions||[])+15*ratio(rules.recommended_actions||[])
      +(success(item,state)?15:0)+(state.diagnosis?.correct?10:0)+(state.disposition?.correct?15:0);
    const timePenalty=Math.max(0,(state.criticalElapsed||0)-Number(rules.max_minutes||30));
    const penalties=Number(state.penalties||0)+timePenalty;
    return {earned:Math.round(earned),penalties:Math.round(penalties*10)/10,total:Math.max(0,Math.min(100,Math.round(earned-penalties)))};
  }
  const api={done,resolve,score,success};root.PlantaoEngine=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
