const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const E=require('../assets/js/plantao-engine.js'),cases=require('../data/plantao-cases-v2.json');
async function fixture(){
 const elements={},handlers={},writes=[];
 const el=id=>elements[id]||(elements[id]={hidden:id==='plantao-action-drawer',value:'',textContent:'',innerHTML:'',addEventListener(name,fn){this[name]=fn},focus(){},querySelector(){return {focus(){}}}});
 const doc={getElementById:el,addEventListener(name,fn){handlers[name]=fn}};
 const sb={auth:{getUser:async()=>({data:{user:{id:'test-user'}}})},from(table){let kind='read',payload;return {select(){return this},eq(){return kind==='update'?(writes.push(payload),Promise.resolve({error:null})):this},order(){return this},limit(){return this},insert(p){kind='insert';payload=p;return this},update(p){kind='update';payload=p;assert(Number.isInteger(p.elapsed_minutes));return this},single:async()=>({data:{id:'test-session',started_at:'2026-09-25',status:'in_progress'},error:null}),then(resolve){resolve({data:table==='clinical_cases'?cases:[],error:null})}}}};
 const win={supabaseClient:sb,PlantaoEngine:E,PlantaoMonitor:{update(){}},scrollTo(){},confirm:()=>true,alert:msg=>{throw Error(msg)}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../assets/js/plantao.js'),'utf8'),{window:win,document:doc,console,Date,setTimeout});
 await new Promise(r=>setTimeout(r,0));
 const click=async(key,value)=>handlers.click({target:{closest(selector){return selector===`[${key}]`?{dataset:{[{'data-start-case':'startCase','data-case-category':'caseCategory','data-case-action':'caseAction'}[key]]:value}}:null}}});
 return {el,writes,click};
}
(async()=>{
 const plans={
 'anaphylaxis-ed':['epi_im','monitor','iv_access','oxygen','crystalloid','dx_0','dest_ward'],
 'af-unstable-ed':['cardioversion','monitor','iv_access','ecg','sedation','dx_0','dest_ward'],
 'septic-shock-ed':['antibiotic','crystalloid','norepi','cultures','lactate','monitor','iv_access','oxygen','dx_0','dest_icu'],
 'vf-arrest-ed':['cpr','pads','shock1','ivio','shock2','epi','shock3','amiodarone','causes','rosc','dx_0','dest_icu']};
 for(const c of cases){
  const f=await fixture();await f.click('data-start-case',c.id);
  assert.equal((f.el('plantao-action-tabs').innerHTML.match(/data-case-category=/g)||[]).length,6);
  await f.click('data-case-category','exames');assert.equal(f.el('plantao-action-drawer').hidden,false);assert.equal(f.el('plantao-action-tabs').inert,true);f.el('plantao-action-close').click();assert.equal(f.el('plantao-action-drawer').hidden,true);
  for(const id of plans[c.slug])await f.click('data-case-action',id);
  const final=f.writes.at(-1);assert.equal(final.status,'completed',c.slug);assert.equal(final.score,100,c.slug);assert.equal(final.result.disposition.correct,true);
 }
 const c=cases.find(c=>c.slug==='anaphylaxis-ed'),f=await fixture();await f.click('data-start-case',c.id);
 await f.click('data-case-action','dx_1');
 for(const id of plans[c.slug])await f.click('data-case-action',id);
 assert.equal(f.writes.at(-1).score,94,'Wrong diagnostic choice remains penalized after all correct steps');
 const early=await fixture();await early.click('data-start-case',c.id);await early.click('data-case-action','dx_0');await early.click('data-case-action','dest_discharge');assert.equal(early.writes.at(-1).result.disposition.correct,false);assert.equal(early.writes.at(-1).score,0);
 console.log('PASS: all four full clinical flows, left overlay menu, diagnosis error retained, unsafe discharge, integer persistence and 100-point ideal paths.');
})().catch(e=>{console.error(e);process.exit(1)});
