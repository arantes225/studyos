const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const p=require('../assets/js/question-factory-prompts.js');
const stages=['prompt_calibration','blind_resolution','chatgpt_initial','perplexity_initial','chatgpt_adjudication','chatgpt_correction','perplexity_reaudit','lot_chatgpt_final','lot_perplexity_final','lot_gemini_final'];
test('geração inclui todos os campos complementares e contexto sem feedback histórico',()=>{
 const item={exam_style:'AMP-PR',full_generation_brief:'CANONICO',generation_instructions:'INSTRUCAO',recommended_generation_rules:'COMPLEMENTO',what_to_avoid:'CUIDADO',scientific_source_strategy:'CIENCIA',calibration_notes:'NAO_INCLUIR',style_score_note:'NAO_INCLUIR'};
 const s=p.generation(item,{batch_number:7,block_number:3});
 for(const v of ['CANONICO','INSTRUCAO','COMPLEMENTO','CUIDADO','CIENCIA','"batch_number": 7','"block_number": 3','answer_source_url','explicacao_d'])assert.ok(s.includes(v),v);
 assert.ok(!s.includes('NAO_INCLUIR'));
});
test('exportação cega é whitelist e não vaza campos futuros',()=>{
 const result=p.blind([{question_id:'1',version:2,enunciado:'x',alternativa_a:'a',alternativa_b:'b',alternativa_c:'c',alternativa_d:'d',gabarito:'A',explicacao_a:'spoiler',latest_review:{},answer_source_url:'spoiler',future_secret:'spoiler'}]);
 assert.deepEqual(Object.keys(result[0]),['question_id','version','enunciado','alternativa_a','alternativa_b','alternativa_c','alternativa_d']);
 assert.ok(!JSON.stringify(result).includes('spoiler'));
});
test('dez bancas e todas etapas são autocontidas',()=>{
 for(const exam_style of ['AMP-PR','ENAMED','PSU-GO','PSU-MG','Santa Casa-SP','SES-DF','SUS-SP','UERJ','UNIFESP','USP-SP']){
  for(const stage of stages){const s=p.segment({exam_style},stage);assert.ok(s.includes('A-D'));assert.ok(s.includes(stage));}
 }
 assert.equal(Object.values(p.rubric).reduce((a,b)=>a+b,0),100);
 for(const stage of ['perplexity_initial','perplexity_reaudit']){const s=p.segment({},stage);for(const key of ['item_version','component_scores','proposed_change','verified_sources','difficulty_alignment'])assert.ok(s.includes(key));}
});
test('cópias estáticas das duas rotas coincidem com módulo',()=>{
 const map={'generate':p.generation(),'perplexity-block':p.segment({},'perplexity_initial'),'correction':p.segment({},'chatgpt_correction'),'chatgpt-final':p.segment({},'lot_chatgpt_final'),'perplexity-final':p.segment({},'lot_perplexity_final')};
 const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#x27;');
 for(const path of ['admin.html','admin/index.html']){
  const s=fs.readFileSync(require('node:path').join(__dirname,'..',path),'utf8');
  assert.ok(s.indexOf('question-factory-prompts.js?v=2.0')<s.indexOf('admin.js?v=4.0'));
  assert.ok(s.includes('admin-qf-import-calibration'));
  for(const [key,text] of Object.entries(map)){const start=`<pre id="qf-prompt-${key}" class="admin-qf-prompt">`;assert.equal(s.split(start)[1].split('</pre>')[0],escape(text));}
 }
});
test('todos os caminhos do admin usam construtor e roteiam adjudicação/Gemini',()=>{
 const s=fs.readFileSync(require('node:path').join(__dirname,'../assets/js/admin.js'),'utf8');
 assert.ok(!s.includes('full_generation_brief ||'));
 assert.ok(s.includes('admin_import_question_factory_adjudication'));
 assert.ok(s.includes('lot_gemini_final'));
 assert.ok(s.includes('https://gemini.google.com/app'));
 assert.ok(!s.includes('payload.batch_number = state'));
});
