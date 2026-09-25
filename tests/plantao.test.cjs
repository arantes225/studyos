const assert=require('node:assert/strict');
const E=require('../assets/js/plantao-engine.js');
const cases=require('../data/plantao-cases-v2.json');
for(const c of cases){
 const ids=c.actions.map(a=>a.id);assert.equal(new Set(ids).size,ids.length);
 for(const a of c.actions){assert(Number.isFinite(a.points));assert(Number.isFinite(a.time_min));for(const id of a.requires_all||[])assert(ids.includes(id));}
 for(const cat of ['anamnese','exame','iniciais','laboratorio','imagem','hipoteses','destino'])assert(c.actions.some(a=>a.category===cat),c.slug+': '+cat);
 const rules=c.completion_rules;
 const state={performed:[...new Set([...rules.required_actions,...rules.recommended_actions])],outcomes:rules.success_outcomes,penalties:0,criticalElapsed:0,diagnosis:{correct:true},disposition:{correct:true}};
 assert.equal(E.score(c,state).total,100);
 assert.equal(E.score(c,{...state,penalties:20}).total,80,'Positive actions must never erase a harmful-action penalty');
 assert.equal(E.score(c,{...state,diagnosis:{correct:false},disposition:{correct:false},penalties:26}).total,49);
 assert.equal(E.score(c,{...state,criticalElapsed:rules.max_minutes+5}).total,95);
 const empty={performed:[],outcomes:[],penalties:0,criticalElapsed:0};
 assert.equal(E.score(c,empty).total,0);
 if(['anaphylaxis-ed','af-unstable-ed'].includes(c.slug)){
  const a=c.actions.find(a=>a.id==='dest_ward');assert.equal(E.resolve(c,empty,a).correct,false);assert.equal(E.resolve(c,state,a).correct,true);
 }
}
const sepsis=cases.find(c=>c.slug==='septic-shock-ed');assert(E.done(sepsis,['amp_sulbactam'],'antibiotic'));
const vf=cases.find(c=>c.slug==='vf-arrest-ed');assert(E.done(vf,['lidocaine'],'amiodarone'));
const ana=cases.find(c=>c.slug==='anaphylaxis-ed'),a=ana.actions.find(a=>a.id==='salbutamol');
assert(E.resolve(ana,{performed:[],outcomes:[]},a).points<0);
assert(E.resolve(ana,{performed:['epi_im'],outcomes:['responding']},a).points>0);
console.log('PASS: four cases, six groups, 213 unique case actions, contextual penalties, equivalent therapies, diagnosis and disposition scoring.');
