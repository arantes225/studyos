-- Contrato 2.0: execução transacional; preserva questões e históricos.
begin;
alter table public.question_exam_style_profiles add column if not exists final_prompt_score numeric check(final_prompt_score between 0 and 100);
alter table public.question_exam_style_profiles add column if not exists prompt_calibration jsonb;
alter table public.question_exam_style_profiles add column if not exists primary_style_evidence jsonb not null default '[]';
alter table public.question_factory_batches add column if not exists final_review_gemini_status text check(final_review_gemini_status in ('pending','approved','needs_revision'));
alter table public.question_factory_batches add column if not exists final_human_review_status text check(final_human_review_status in ('pending','approved','needs_revision'));
alter table public.question_factory_batches add column if not exists final_review_receipts jsonb not null default '{}';
alter table public.question_factory_reviews alter column created_at set default clock_timestamp();
alter table public.question_factory_reviews drop constraint if exists question_factory_reviews_review_stage_check;
alter table public.question_factory_reviews add constraint question_factory_reviews_review_stage_check check(review_stage in ('blind_resolution','chatgpt_initial','perplexity_initial','chatgpt_correction_review','perplexity_reaudit','lot_chatgpt_final','lot_perplexity_final','lot_gemini_final'));

create or replace function private.qf_assert_review(p jsonb, answer text) returns boolean language plpgsql immutable set search_path='' as $$
declare k text; cap numeric; score numeric; total numeric:=0; c jsonb:=p->'component_scores';
begin
 if jsonb_typeof(c) is distinct from 'object' then raise exception 'component_scores obrigatório'; end if;
 for k,cap in select key,value::numeric from jsonb_each_text('{"scientific":25,"answer_key":20,"answer_source":15,"distractors":10,"explanations":10,"style":10,"writing":5,"difficulty":5}'::jsonb) loop
  if not c ? k then raise exception 'Componente ausente: %',k; end if;
  if c->k='null'::jsonb and k='style' and p->>'style_evidence_status'='NEEDS_MORE_PRIMARY_STYLE_DATA' and p->>'quality_score' is null and p->>'status'<>'approved' then continue; end if;
  if jsonb_typeof(c->k) is distinct from 'number' then raise exception 'Componente inválido: %',k; end if;
  score:=(c->>k)::numeric;
  if score<0 or score>cap then raise exception 'Componente % fora de 0–%',k,cap; end if;
  total:=total+score;
 end loop;
 if p->>'quality_score' is not null and ((p->>'quality_score')::numeric <> total or (c->>'style') is null) then raise exception 'Nota não corresponde à soma da rubrica'; end if;
 if p->>'status' is null or p->>'status' not in ('approved','needs_revision','rejected') then raise exception 'Status inválido'; end if;
 if p->>'status'<>'approved' then return false; end if;
 if jsonb_typeof(p->'quality_score') is distinct from 'number' or total<97 or (c->>'style')::numeric<9.7
    or p->'hard_fail' is distinct from 'false'::jsonb or p->'ambiguity' is distinct from 'false'::jsonb
    or p->'single_best_answer' is distinct from 'true'::jsonb
    or not(p ? 'answer_source_issue') or p->'answer_source_issue' is distinct from 'null'::jsonb
    or p->>'independent_answer' is distinct from answer or p->>'original_answer' is distinct from answer
    or p->>'source_verification_status' is distinct from 'VERIFIED'
    or p->>'style_evidence_status' is distinct from 'VERIFIED'
    or coalesce(p->>'distractor_quality','') not in ('GOOD','EXCELLENT')
    or p->>'alternative_granularity' is distinct from 'PASS' or p->>'difficulty_alignment' is distinct from 'PASS'
    or jsonb_typeof(p->'hard_fail_reasons') is distinct from 'array' or p->'hard_fail_reasons'<>'[]'::jsonb
    or jsonb_typeof(p->'verified_sources') is distinct from 'array' or p->'verified_sources'='[]'::jsonb
 then raise exception 'Aprovação incompatível com os critérios finais'; end if;
 if exists(select 1 from jsonb_array_elements(p->'verified_sources') s where coalesce(s->>'url','') !~ '^https?://' or nullif(btrim(s->>'document'),'') is null or nullif(btrim(s->>'institution'),'') is null or nullif(btrim(s->>'year'),'') is null) then raise exception 'Fonte verificada incompleta'; end if;
 return true;
end $$;

create or replace function private.qf_current_approved(q public.question_factory_items) returns boolean language sql stable set search_path='' as $$
 select coalesce((select r.review_status='approved' and r.quality_score>=97
 and r.hard_fail=false and r.ambiguity=false and r.single_best_answer=true and r.answer_source_issue is null
 and r.independent_answer=q.gabarito and r.original_answer=q.gabarito
 and (r.component_scores->>'style')::numeric>=9.7
 and r.raw_payload->>'source_verification_status'='VERIFIED'
 and r.raw_payload->>'style_evidence_status'='VERIFIED'
 from public.question_factory_reviews r where r.item_id=q.id and r.item_version=q.version
 and r.review_stage in ('perplexity_initial','perplexity_reaudit','lot_chatgpt_final','lot_perplexity_final','lot_gemini_final')
 order by r.created_at desc,r.id desc limit 1),false)
 and q.block_review_status='approved' and q.status not in ('needs_revision','rejected')
$$;

create or replace function private.qf_manifest(b uuid) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('question_id',question_id,'item_version',version) order by question_id),'[]') from public.question_factory_items where batch_id=b
$$;
create or replace function private.qf_invalidate_lot(b uuid) returns void language plpgsql set search_path='' as $$
begin
 update public.question_factory_batches set final_review_chatgpt_status=null,final_review_perplexity_status=null,final_review_gemini_status=null,final_human_review_status=null,final_review_receipts='{}',status='reviewing',updated_at=now() where id=b and status<>'published';
 update public.question_factory_items set status='generated' where batch_id=b and status='ready';
end $$;

create or replace function public.admin_export_question_factory(p_batch_number integer,p_block_number integer default null,p_blind boolean default true) returns jsonb language plpgsql security definer set search_path='' as $$
declare b uuid; result jsonb;
begin
 if not public.is_admin_session() then raise exception 'admin access required' using errcode='42501'; end if;
 select id into b from public.question_factory_batches where batch_number=p_batch_number;
 if b is null then raise exception 'Lote não encontrado'; end if;
 select jsonb_build_object('schema_version','2.0','batch_number',p_batch_number,'block_number',p_block_number,'blind',p_blind,
 'version_manifest',coalesce(jsonb_agg(jsonb_build_object('question_id',q.question_id,'item_version',q.version) order by q.question_id),'[]'),
 'questions',coalesce(jsonb_agg(case when p_blind then jsonb_build_object('question_id',q.question_id,'version',q.version,'enunciado',q.enunciado,'alternativa_a',q.alternativa_a,'alternativa_b',q.alternativa_b,'alternativa_c',q.alternativa_c,'alternativa_d',q.alternativa_d)
 else to_jsonb(q)||jsonb_build_object('latest_review',(select to_jsonb(r) from public.question_factory_reviews r where r.item_id=q.id and r.item_version=q.version and r.review_stage<>'blind_resolution' order by r.created_at desc,r.id desc limit 1),'blind_resolution',(select r.raw_payload from public.question_factory_reviews r where r.item_id=q.id and r.item_version=q.version and r.review_stage='blind_resolution' order by r.created_at desc,r.id desc limit 1)) end order by q.sequence_no),'[]')) into result
 from public.question_factory_items q join public.question_factory_blocks bl on bl.id=q.block_id where q.batch_id=b and (p_block_number is null or bl.block_number=p_block_number);
 return result;
end $$;

create or replace function public.admin_import_question_factory_review(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare b uuid; bl uuid; q public.question_factory_items%rowtype; r jsonb; stage text:=p_payload->>'review_stage'; reviewer text:=coalesce(p_payload->>'reviewer',p_payload->>'auditor'); ok boolean; n int:=0; approved int:=0; rejected int:=0; good int; total int; blind text;
begin
 if not public.is_admin_session() then raise exception 'admin access required' using errcode='42501'; end if;
 if p_payload->>'schema_version' is distinct from '2.0' or stage is null or stage not in ('blind_resolution','chatgpt_initial','perplexity_initial','perplexity_reaudit') then raise exception 'Etapa/contrato inválido; use 2.0'; end if;
 if reviewer is distinct from (case when stage='chatgpt_initial' then 'ChatGPT' else 'Perplexity' end) then raise exception 'Revisor incompatível com etapa'; end if;
 select b1.id,bl1.id into b,bl from public.question_factory_batches b1 join public.question_factory_blocks bl1 on bl1.batch_id=b1.id where b1.batch_number=(p_payload->>'batch_number')::int and bl1.block_number=(p_payload->>'block_number')::int for update of b1,bl1;
 if bl is null then raise exception 'Lote/bloco não encontrado'; end if;
 if exists(select 1 from public.question_factory_batches where id=b and status='published') then raise exception 'Lote publicado é imutável neste fluxo'; end if;
 if jsonb_typeof(p_payload->'reviews') is distinct from 'array' or p_payload->'reviews'='[]'::jsonb then raise exception 'reviews não pode estar vazio'; end if;
 if (select count(*)<>count(distinct x->>'question_id') from jsonb_array_elements(p_payload->'reviews') x) then raise exception 'IDs repetidos/ausentes'; end if;
 for r in select value from jsonb_array_elements(p_payload->'reviews') loop
  select * into q from public.question_factory_items where block_id=bl and question_id=r->>'question_id' for update;
  if q.id is null or (r->>'item_version')::int is distinct from q.version then raise exception 'Questão/versão divergente: %',r->>'question_id'; end if;
  if stage='blind_resolution' then
   if not(r ? 'independent_answer') or (r->>'independent_answer' is not null and r->>'independent_answer' not in ('A','B','C','D')) or nullif(btrim(r->>'reason'),'') is null then raise exception 'Resolução cega incompleta'; end if;
   if exists(select 1 from public.question_factory_reviews where item_id=q.id and item_version=q.version and review_stage in ('blind_resolution','perplexity_initial','perplexity_reaudit')) then raise exception 'Resolução cega já registrada ou versão já auditada; preserve a resposta original'; end if;
   insert into public.question_factory_reviews(item_id,block_id,batch_id,question_id,item_version,review_stage,reviewer,review_status,independent_answer,raw_payload) values(q.id,bl,b,q.question_id,q.version,stage,reviewer,'needs_revision',r->>'independent_answer',r);
  else
   if stage<>'chatgpt_initial' then
    select independent_answer into blind from public.question_factory_reviews where item_id=q.id and item_version=q.version and review_stage='blind_resolution' order by created_at desc,id desc limit 1;
    if not found then raise exception 'Resolução cega da versão atual obrigatória: %',q.question_id; end if;
    if blind is distinct from r->>'independent_answer' then raise exception 'Resposta independente difere do registro cego'; end if;
   end if;
   ok:=private.qf_assert_review(r,q.gabarito);
   insert into public.question_factory_reviews(item_id,block_id,batch_id,question_id,item_version,review_stage,reviewer,quality_score,component_scores,independent_answer,original_answer,review_status,confidence,ambiguity,single_best_answer,hard_fail,hard_fail_reasons,scientific_issue,source_issue,answer_source_issue,explanation_issue,distractor_issue,style_issue,suggested_correction,verified_sources,raw_payload,proposed_change)
   values(q.id,bl,b,q.question_id,q.version,stage,reviewer,(r->>'quality_score')::numeric,r->'component_scores',r->>'independent_answer',r->>'original_answer',r->>'status',r->>'confidence',(r->>'ambiguity')::boolean,(r->>'single_best_answer')::boolean,(r->>'hard_fail')::boolean,coalesce(r->'hard_fail_reasons','[]'),r->>'scientific_issue',r->>'source_issue',r->>'answer_source_issue',r->>'explanation_issue',r->>'distractor_issue',r->>'style_issue',r->>'suggested_correction',coalesce(r->'verified_sources','[]'),r,r->'proposed_change');
   if stage<>'chatgpt_initial' then
    update public.question_factory_items set quality_score=(r->>'quality_score')::numeric,latest_review_stage=stage,block_review_status=r->>'status',block_review_answer=r->>'independent_answer',block_review_notes=r->>'suggested_correction',status=case when ok then 'generated' else r->>'status' end,updated_at=now() where id=q.id;
   end if;
   if ok then approved:=approved+1; elsif r->>'status'='rejected' then rejected:=rejected+1; end if;
  end if;
  n:=n+1;
 end loop;
 if stage='chatgpt_initial' then
  select count(*),count(*) filter(where coalesce((select r2.review_status='approved' from public.question_factory_reviews r2 where r2.item_id=qi.id and r2.item_version=qi.version and r2.review_stage='chatgpt_initial' order by r2.created_at desc,r2.id desc limit 1),false)) into total,good from public.question_factory_items qi where qi.block_id=bl;
  update public.question_factory_blocks set chatgpt_review_status=case when total=200 and good=200 then 'approved' else 'needs_revision' end,updated_at=now() where id=bl;
 elsif stage<>'blind_resolution' then
  perform private.qf_invalidate_lot(b);
  select count(*),count(*) filter(where private.qf_current_approved(qi)) into total,good from public.question_factory_items qi where qi.block_id=bl;
  update public.question_factory_blocks set perplexity_review_status=case when total=200 and good=200 then 'approved' else 'needs_revision' end,status=case when total=200 and good=200 then 'approved' else 'needs_revision' end,human_review_status=case when total=200 and good=200 then 'pending' else null end,updated_at=now() where id=bl;
 end if;
 return jsonb_build_object('imported',n,'approved',approved,'needs_revision',n-approved-rejected,'rejected',rejected,'quality_threshold',97);
end $$;

create or replace function public.admin_import_question_factory_adjudication(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb; q public.question_factory_items%rowtype; r public.question_factory_reviews%rowtype; n int:=0; k text;
begin
 if not public.is_admin_session() then raise exception 'admin access required' using errcode='42501'; end if;
 if p_payload->>'schema_version' is distinct from '2.0' or p_payload->>'review_stage' is distinct from 'chatgpt_adjudication' then raise exception 'Contrato/etapa inválido'; end if;
 if jsonb_typeof(p_payload->'decisions') is distinct from 'array' or p_payload->'decisions'='[]'::jsonb then raise exception 'decisions obrigatório'; end if;
 if (select count(*)<>count(distinct x->>'question_id') from jsonb_array_elements(p_payload->'decisions') x) then raise exception 'IDs repetidos/ausentes'; end if;
 for d in select value from jsonb_array_elements(p_payload->'decisions') loop
  select qi.* into q from public.question_factory_items qi join public.question_factory_blocks bl on bl.id=qi.block_id join public.question_factory_batches b on b.id=qi.batch_id where b.batch_number=(p_payload->>'batch_number')::int and bl.block_number=(p_payload->>'block_number')::int and qi.question_id=d->>'question_id' for update of qi;
  if q.id is null or q.version is distinct from (d->>'item_version')::int or q.status='published' then raise exception 'Questão/versão inválida'; end if;
  select * into r from public.question_factory_reviews where item_id=q.id and item_version=q.version and review_stage in ('perplexity_initial','perplexity_reaudit','lot_chatgpt_final','lot_perplexity_final','lot_gemini_final') order by created_at desc,id desc limit 1 for update;
  if r.id is null or r.id is distinct from (d->>'review_id')::uuid or r.review_status='approved' then raise exception 'Parecer desatualizado ou não requer correção'; end if;
  if coalesce(d->>'agreement_status','') not in ('agree','partially_agree','disagree') or nullif(btrim(d->>'agreement_reason'),'') is null or jsonb_typeof(d->'approved_patch') is distinct from 'object' then raise exception 'Julgamento incompleto'; end if;
  if d->>'agreement_status'='disagree' then
   if d->'approved_patch'<>'{}'::jsonb or nullif(btrim(d->>'rebuttal_to_perplexity'),'') is null then raise exception 'Discordância exige rebuttal e nenhum patch'; end if;
  else
   if d->'approved_patch'='{}'::jsonb then raise exception 'Mudança autorizada precisa de patch exato'; end if;
   for k in select jsonb_object_keys(d->'approved_patch') loop
    if k not in ('enunciado','alternativa_a','alternativa_b','alternativa_c','alternativa_d','gabarito','explicacao_a','explicacao_b','explicacao_c','explicacao_d','mensagem_chave','area','tema','subtema','dificuldade','fonte_instituicao','fonte_documento','fonte_ano','fonte_url','answer_source_institution','answer_source_document','answer_source_year','answer_source_url','answer_source_section','answer_source_note') then raise exception 'Campo não editável: %',k; end if;
    if jsonb_typeof(d->'approved_patch'->k) is distinct from 'string' or nullif(btrim(d->'approved_patch'->>k),'') is null then raise exception 'Texto de substituição inválido: %',k; end if;
   end loop;
  end if;
  update public.question_factory_reviews set chatgpt_agreement_status=d->>'agreement_status',chatgpt_agreement_reason=d->>'agreement_reason',rebuttal_to_reviewer=d->>'rebuttal_to_perplexity',raw_payload=coalesce(raw_payload,'{}')||jsonb_build_object('adjudication',d) where id=r.id;
  n:=n+1;
 end loop;
 return jsonb_build_object('decisions_imported',n);
end $$;

create or replace function public.admin_import_question_factory_corrections(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare x jsonb; patch jsonb; q public.question_factory_items%rowtype; r public.question_factory_reviews%rowtype; b uuid; bl uuid; n int:=0; k text;
begin
 if not public.is_admin_session() then raise exception 'admin access required' using errcode='42501'; end if;
 if p_payload->>'schema_version' is distinct from '2.0' or p_payload->>'review_stage' is distinct from 'chatgpt_correction_review' then raise exception 'Contrato/etapa inválido'; end if;
 select b1.id,bl1.id into b,bl from public.question_factory_batches b1 join public.question_factory_blocks bl1 on bl1.batch_id=b1.id where b1.batch_number=(p_payload->>'batch_number')::int and bl1.block_number=(p_payload->>'block_number')::int for update of b1,bl1;
 if bl is null or exists(select 1 from public.question_factory_batches where id=b and status='published') then raise exception 'Lote/bloco inválido ou publicado'; end if;
 if jsonb_typeof(p_payload->'questions') is distinct from 'array' or p_payload->'questions'='[]'::jsonb then raise exception 'questions obrigatório'; end if;
 if (select count(*)<>count(distinct v->>'question_id') from jsonb_array_elements(p_payload->'questions') v) then raise exception 'IDs repetidos/ausentes'; end if;
 for x in select value from jsonb_array_elements(p_payload->'questions') loop
  select * into q from public.question_factory_items where block_id=bl and question_id=x->>'question_id' for update;
  if q.id is null or (x->>'expected_version')::int is distinct from q.version or q.status='published' then raise exception 'Questão/versão divergente'; end if;
  select * into r from public.question_factory_reviews where item_id=q.id and item_version=q.version and review_stage in ('perplexity_initial','perplexity_reaudit','lot_chatgpt_final','lot_perplexity_final','lot_gemini_final') order by created_at desc,id desc limit 1 for update;
  patch:=x->'patch';
  if r.id is null or r.id is distinct from (x->>'review_id')::uuid or coalesce(r.chatgpt_agreement_status,'') not in ('agree','partially_agree') or r.review_status='approved' or jsonb_typeof(patch) is distinct from 'object' or patch='{}'::jsonb or patch is distinct from r.raw_payload->'adjudication'->'approved_patch' then raise exception 'Correção exige adjudicação atual e patch exato autorizado'; end if;
  if patch ? 'gabarito' and patch->>'gabarito' not in ('A','B','C','D') then raise exception 'Gabarito deve ser A-D'; end if;
  -- Cada chave foi autorizada e validada na adjudicação; %I protege o identificador.
  for k in select jsonb_object_keys(patch) loop
   execute format('update public.question_factory_items set %I=$1 where id=$2',k) using patch->>k,q.id;
  end loop;
  update public.question_factory_items set version=q.version+1,status='generated',quality_score=null,latest_review_stage='chatgpt_correction_review',block_review_status='pending',block_review_answer=null,block_review_notes=null,review_1_status=null,review_2_status=null,review_3_status=null,lot_review_chatgpt_status=null,lot_review_perplexity_status=null,updated_at=now() where id=q.id;
  n:=n+1;
 end loop;
 perform private.qf_invalidate_lot(b);
 update public.question_factory_blocks set status='perplexity_review',perplexity_review_status='pending',human_review_status=null,human_reviewed_at=null,updated_at=now() where id=bl;
 return jsonb_build_object('corrected',n,'next_stage','blind_resolution');
end $$;

create or replace function public.admin_import_question_factory_lot_review(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.question_factory_batches%rowtype; stage text:=p_payload->>'review_stage'; st text:=p_payload->>'lote_status'; manifest jsonb; supplied jsonb; x jsonb; q public.question_factory_items%rowtype; k text; ids jsonb; total int; good int;
begin
 if not public.is_admin_session() then raise exception 'admin access required' using errcode='42501'; end if;
 if p_payload->>'schema_version' is distinct from '2.0' or coalesce(stage,'') not in ('lot_chatgpt_final','lot_perplexity_final','lot_gemini_final') or coalesce(st,'') not in ('approved','needs_revision') then raise exception 'Contrato/etapa/status inválido'; end if;
 if p_payload->>'reviewer' is distinct from (case stage when 'lot_chatgpt_final' then 'ChatGPT' when 'lot_perplexity_final' then 'Perplexity' else 'Gemini' end) then raise exception 'Revisor incorreto'; end if;
 select * into b from public.question_factory_batches where batch_number=(p_payload->>'batch_number')::int for update;
 if b.id is null or b.status='published' then raise exception 'Lote inválido/publicado'; end if;
 if (select count(*) from public.question_factory_blocks where batch_id=b.id and status='merged')<>5 then raise exception 'Exige cinco blocos aprovados pelo administrador'; end if;
 manifest:=private.qf_manifest(b.id);
 if jsonb_typeof(p_payload->'version_manifest') is distinct from 'array' then raise exception 'Manifesto obrigatório'; end if;
 select jsonb_agg(v order by v->>'question_id') into supplied from jsonb_array_elements(p_payload->'version_manifest') v;
 if supplied is distinct from manifest or jsonb_array_length(manifest)<>1000 then raise exception 'Manifesto incompleto/desatualizado'; end if;
 if stage='lot_gemini_final' and (b.final_review_chatgpt_status is distinct from 'approved' or b.final_review_perplexity_status is distinct from 'approved') then raise exception 'Gemini exige revisão dupla aprovada da versão atual'; end if;
 if jsonb_typeof(p_payload->'questions_flagged') is distinct from 'array' then raise exception 'questions_flagged obrigatório'; end if;
 if st='approved' then
  foreach k in array array['questions_flagged','duplicate_clusters','duplicate_or_near_duplicate','answer_source_problems','answer_key_disagreements','outdated_sources','guideline_conflicts','coverage_gaps','style_problems','difficulty_findings','high_risk_rechecks','questions_to_recheck','editorial_issues','findings'] loop
   if p_payload ? k and p_payload->k not in ('[]'::jsonb,'null'::jsonb) then raise exception 'Achados pendentes impedem aprovação: %',k; end if;
  end loop;
  if jsonb_typeof(p_payload->'coverage'->'global_reviewed_ids') is distinct from 'array' then raise exception 'Cobertura global obrigatória'; end if;
  select jsonb_agg(v order by v) into ids from jsonb_array_elements(p_payload->'coverage'->'global_reviewed_ids') v;
  if ids is distinct from (select jsonb_agg(v->'question_id' order by v->>'question_id') from jsonb_array_elements(manifest) v) then raise exception 'Cobertura global deve conter exatamente as 1000 questões'; end if;
  if p_payload->'coverage'->'all_high_risk_rechecked' is distinct from 'true'::jsonb or nullif(btrim(p_payload->'coverage'->>'sampling_method'),'') is null or jsonb_typeof(p_payload->'coverage'->'scientific_rechecked_ids') is distinct from 'array' then raise exception 'Cobertura científica incompleta'; end if;
  select count(*),count(distinct v) into total,good from jsonb_array_elements_text(p_payload->'coverage'->'scientific_rechecked_ids') v;
  if total<>good or exists(select 1 from jsonb_array_elements_text(p_payload->'coverage'->'scientific_rechecked_ids') v where not exists(select 1 from public.question_factory_items qi where qi.batch_id=b.id and qi.question_id=v)) then raise exception 'IDs de rechecagem inválidos'; end if;
  -- Sem classificação estruturada de risco, o contrato exige rechecagem integral.
  if total<>1000 then raise exception 'Sem classificação estruturada de risco, rechecagem científica deve cobrir as 1000 questões'; end if;
  if exists(select 1 from public.question_factory_items qi where qi.batch_id=b.id and not private.qf_current_approved(qi)) then raise exception 'Há questões sem aprovação atual válida'; end if;
 else
  for x in select value from jsonb_array_elements(p_payload->'questions_flagged') loop
   select * into q from public.question_factory_items where batch_id=b.id and question_id=x->>'question_id' for update;
   if q.id is null or q.version is distinct from (x->>'item_version')::int or nullif(btrim(x->>'reason'),'') is null then raise exception 'Achado precisa de ID, versão atual e motivo'; end if;
   insert into public.question_factory_reviews(item_id,block_id,batch_id,question_id,item_version,review_stage,reviewer,review_status,suggested_correction,raw_payload,proposed_change) values(q.id,q.block_id,b.id,q.question_id,q.version,stage,p_payload->>'reviewer','needs_revision',x->>'reason',x,x->'proposed_change');
   update public.question_factory_items set status='needs_revision',block_review_status='needs_revision',latest_review_stage=stage where id=q.id;
   update public.question_factory_blocks set status='needs_revision',human_review_status=null where id=q.block_id;
  end loop;
  perform private.qf_invalidate_lot(b.id);
 end if;
 update public.question_factory_batches set
 final_review_chatgpt_status=case when stage='lot_chatgpt_final' then st else final_review_chatgpt_status end,
 final_review_perplexity_status=case when stage='lot_perplexity_final' then st else final_review_perplexity_status end,
 final_review_gemini_status=case when stage='lot_gemini_final' then st else null end,
 final_human_review_status='pending',
 final_review_receipts=final_review_receipts||jsonb_build_object(stage,p_payload),status='reviewing',updated_at=now()
 where id=b.id;
 return jsonb_build_object('ready',false,'review_stage',stage,'lote_status',st,'next_stage','remaining_reviews_or_human_approval');
end $$;

create or replace function public.admin_approve_question_factory_lot(p_batch_number integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.question_factory_batches%rowtype; manifest jsonb; k text; supplied jsonb;
begin
 if not public.is_admin_session() then raise exception 'admin access required' using errcode='42501'; end if;
 select * into b from public.question_factory_batches where batch_number=p_batch_number for update;
 if b.id is null or b.status='published' or b.final_review_chatgpt_status is distinct from 'approved' or b.final_review_perplexity_status is distinct from 'approved' or b.final_review_gemini_status is distinct from 'approved' then raise exception 'Três revisões finais aprovadas são obrigatórias'; end if;
 manifest:=private.qf_manifest(b.id);
 if jsonb_array_length(manifest)<>1000 or (select count(*) from public.question_factory_blocks where batch_id=b.id and status='merged' and human_review_status='approved')<>5 then raise exception 'Lote incompleto'; end if;
 if exists(select 1 from public.question_factory_items qi where qi.batch_id=b.id and not private.qf_current_approved(qi)) then raise exception 'Questão pendente ou versão não aprovada'; end if;
 foreach k in array array['lot_chatgpt_final','lot_perplexity_final','lot_gemini_final'] loop
  select jsonb_agg(v order by v->>'question_id') into supplied from jsonb_array_elements(b.final_review_receipts->k->'version_manifest') v;
  if supplied is distinct from manifest then raise exception 'Revisão final desatualizada: %',k; end if;
 end loop;
 update public.question_factory_batches set status='ready',final_human_review_status='approved',updated_at=now() where id=b.id;
 update public.question_factory_items set status='ready',updated_at=now() where batch_id=b.id;
 return jsonb_build_object('ready',true);
end $$;

create or replace function public.admin_import_question_factory_calibration(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare total numeric:=0; k text; cap numeric; n numeric; evidence jsonb:=p_payload->'primary_style_evidence'; score numeric:=(p_payload->>'FINAL_PROMPT_SCORE')::numeric;
begin
 if not public.is_admin_session() then raise exception 'admin access required' using errcode='42501'; end if;
 if p_payload->>'schema_version' is distinct from '2.0' or p_payload->>'review_stage' is distinct from 'prompt_calibration' then raise exception 'Contrato/etapa inválido'; end if;
 if not exists(select 1 from public.question_exam_style_profiles where exam_style=p_payload->>'exam_style') then raise exception 'Banca inválida'; end if;
 if score is not null then
  for k,cap in select key,value::numeric from jsonb_each_text('{"fidelity":40,"distractors":20,"difficulty":15,"diversity":15,"clarity":10}') loop
   if jsonb_typeof(p_payload->'prompt_component_scores'->k) is distinct from 'number' then raise exception 'Componente de calibração ausente: %',k; end if;
   n:=(p_payload->'prompt_component_scores'->>k)::numeric;
   if n<0 or n>cap then raise exception 'Componente fora do teto'; end if;
   total:=total+n;
  end loop;
  if total<>score then raise exception 'Soma da calibração incorreta'; end if;
  if jsonb_typeof(evidence) is distinct from 'array' or evidence='[]'::jsonb then raise exception 'Corpus documentado obrigatório para atribuir nota'; end if;
  if exists(select 1 from jsonb_array_elements(evidence) e where coalesce(e->>'url','') !~ '^https?://' or nullif(e->>'edition','') is null or nullif(e->>'sampled_items','') is null or nullif(e->>'observed_features','') is null) then raise exception 'Corpus exige URL, edição, itens amostrados e características observadas'; end if;
  if score>=94 and (coalesce((p_payload->>'sample_size')::int,0)<30 or (p_payload->>'hard_fail_count')::int is distinct from 0 or p_payload->>'decision' is distinct from 'PROMPT_APPROVED') then raise exception 'Avanço exige 30 itens brutos inéditos, zero hard fails e PROMPT_APPROVED'; end if;
 end if;
 update public.question_exam_style_profiles set final_prompt_score=score,prompt_calibration=p_payload,primary_style_evidence=coalesce(evidence,'[]'),updated_at=now() where exam_style=p_payload->>'exam_style';
 return jsonb_build_object('updated',true,'FINAL_PROMPT_SCORE',score);
end $$;

CREATE OR REPLACE FUNCTION public.admin_question_factory_style_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode='42501';
  end if;

  with item_stats as (
    select
      q.exam_style,
      count(*) as total,
      count(*) filter (where q.status in ('generated','review_1','review_2','review_3','needs_revision','ready','published')
                       or q.block_review_status is not null) as generated,
      count(*) filter (where q.block_review_status is not null
                       and q.block_review_status <> '') as perplexity_seen,
      count(*) filter (
        where q.status='needs_revision'
           or q.block_review_status='needs_revision'
           or q.lot_review_chatgpt_status='needs_revision'
           or q.lot_review_perplexity_status='needs_revision'
      ) as in_correction,
      count(*) filter (where q.status='ready') as ready
    from public.question_factory_items q
    group by q.exam_style
  ),
  block_stats as (
    select
      q.exam_style,
      count(distinct q.block_id) filter (
        where q.block_id is not null
          and bl.status in ('approved','merged')
      ) as blocks_ok,
      coalesce(
        jsonb_agg(distinct jsonb_build_object(
          'batch_number', b.batch_number,
          'block_number', bl.block_number,
          'count', corr.correction_count
        )) filter (where corr.correction_count > 0),
        '[]'::jsonb
      ) as correction_blocks
    from public.question_factory_items q
    left join public.question_factory_blocks bl on bl.id=q.block_id
    left join public.question_factory_batches b on b.id=q.batch_id
    left join lateral (
      select count(*)::int as correction_count
      from public.question_factory_items q2
      where q2.block_id=q.block_id
        and q2.exam_style=q.exam_style
        and (
          q2.status='needs_revision'
          or q2.block_review_status='needs_revision'
          or q2.lot_review_chatgpt_status='needs_revision'
          or q2.lot_review_perplexity_status='needs_revision'
        )
    ) corr on true
    group by q.exam_style
  ),
  lot_stats as (
    select
      q.exam_style,
      count(distinct q.batch_id) filter (
        where q.batch_id is not null
          and b.status='reviewing'
      ) as lots_in_final_review
    from public.question_factory_items q
    left join public.question_factory_batches b on b.id=q.batch_id
    group by q.exam_style
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'exam_style',p.exam_style,
      'style_score',p.style_score,
      'style_confidence_score',p.style_confidence_score,
      'style_score_note',p.style_score_note,
      'style_score_updated_at',p.style_score_updated_at,
      'reference_years',p.reference_years,
      'organizing_body',p.organizing_body,
      'style_reference_url',p.style_reference_url,
      'average_stem_length',p.average_stem_length,
      'case_based_question_rate',p.case_based_question_rate,
      'average_difficulty',p.average_difficulty,
      'clinical_reasoning_depth',p.clinical_reasoning_depth,
      'common_question_types',p.common_question_types,
      'distractor_style',p.distractor_style,
      'typical_alternative_length',p.typical_alternative_length,
      'frequent_contexts',p.frequent_contexts,
      'frequent_topics',p.frequent_topics,
      'writing_style',p.writing_style,
      'recommended_generation_rules',p.recommended_generation_rules,
      'calibration_notes',p.calibration_notes,
      'calibration_source_note',p.calibration_source_note,
      'scientific_source_strategy',p.scientific_source_strategy,
      'generation_instructions',p.generation_instructions,
      'what_to_avoid',p.what_to_avoid,
      'full_generation_brief',p.full_generation_brief,
      'final_prompt_score',p.final_prompt_score,
      'primary_style_evidence',p.primary_style_evidence,
      'total',coalesce(i.total,0),
      'generated',coalesce(i.generated,0),
      'perplexity_seen',coalesce(i.perplexity_seen,0),
      'in_correction',coalesce(i.in_correction,0),
      'correction_blocks',coalesce(bs.correction_blocks,'[]'::jsonb),
      'blocks_ok',coalesce(bs.blocks_ok,0),
      'lots_in_final_review',coalesce(ls.lots_in_final_review,0),
      'ready',coalesce(i.ready,0)
    )
    order by p.exam_style
  ),'[]'::jsonb)
  into result
  from public.question_exam_style_profiles p
  left join item_stats i on i.exam_style=p.exam_style
  left join block_stats bs on bs.exam_style=p.exam_style
  left join lot_stats ls on ls.exam_style=p.exam_style;

  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_question_factory_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
  if not public.is_admin_session() then
    raise exception 'admin access required' using errcode='42501';
  end if;

  select jsonb_build_object(
    'totals',jsonb_build_object(
      'questions',(select count(*) from public.question_factory_items),
      'blocks',(select count(*) from public.question_factory_blocks),
      'blocks_in_review',(select count(*) from public.question_factory_blocks where status='perplexity_review'),
      'blocks_needs_revision',(select count(*) from public.question_factory_blocks where status='needs_revision'),
      'blocks_approved',(select count(*) from public.question_factory_blocks where status in('approved','merged')),
      'blocks_waiting_human',(select count(*) from public.question_factory_blocks where human_review_status='pending'),
      'lots_ready_for_final_review',(
        select count(*) from public.question_factory_batches b
        where (select count(*) from public.question_factory_blocks bl where bl.batch_id=b.id and bl.status='merged')=5
          and b.status <> 'published'
      ),
      'ready',(select count(*) from public.question_factory_items where status='ready'),
      'published',(select count(*) from public.question_factory_items where status='published')
    ),
    'batches',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'batch_number',b.batch_number,
          'title',b.title,
          'target_size',b.target_size,
          'status',b.status,
          'final_review_mode',b.final_review_mode,
          'final_review_chatgpt_status',b.final_review_chatgpt_status,
          'final_review_perplexity_status',b.final_review_perplexity_status,
          'final_review_gemini_status',b.final_review_gemini_status,
          'final_human_review_status',b.final_human_review_status,
          'final_lot_quality_score',b.final_lot_quality_score,
          'question_count',(select count(*) from public.question_factory_items qi where qi.batch_id=b.id),
          'approved_blocks',(select count(*) from public.question_factory_blocks bl where bl.batch_id=b.id and bl.status='merged'),
          'blocks',coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'block_number',bl.block_number,
                'target_size',bl.target_size,
                'status',bl.status,
                'chatgpt_review_status',bl.chatgpt_review_status,
                'perplexity_review_status',bl.perplexity_review_status,
                'human_review_status',bl.human_review_status,
                'human_review_notes',bl.human_review_notes,
                'question_count',(select count(*) from public.question_factory_items qi where qi.block_id=bl.id),
                'approved_count',(select count(*) from public.question_factory_items qi where qi.block_id=bl.id and qi.block_review_status='approved'),
                'needs_revision_count',(select count(*) from public.question_factory_items qi where qi.block_id=bl.id and qi.block_review_status='needs_revision'),
                'rejected_count',(select count(*) from public.question_factory_items qi where qi.block_id=bl.id and qi.block_review_status='rejected'),
                'under_90_count',(select count(*) from public.question_factory_items qi where qi.block_id=bl.id and qi.quality_score is not null and qi.quality_score<90),
                'reviewed_count',(select count(*) from public.question_factory_items qi where qi.block_id=bl.id and qi.block_review_status is not null),
                'corrected_version_count',(select count(*) from public.question_factory_items qi where qi.block_id=bl.id and qi.version>1)
              ) order by bl.block_number
            )
            from public.question_factory_blocks bl
            where bl.batch_id=b.id
          ),'[]'::jsonb)
        ) order by b.batch_number
      )
      from public.question_factory_batches b
    ),'[]'::jsonb)
  ) into result;

  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_question_factory_block_human_review(p_batch_number integer, p_block_number integer, p_decision text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_block_id uuid;
  v_batch_id uuid;
  v_count integer;
  v_bad integer;
  v_merged integer;
begin
  if not public.is_admin_session() then raise exception 'admin access required' using errcode='42501'; end if;
  if p_decision is null or p_decision not in('approved','rejected') then raise exception 'invalid decision'; end if;

  select bl.id,b.id into v_block_id,v_batch_id
  from public.question_factory_batches b
  join public.question_factory_blocks bl on bl.batch_id=b.id
  where b.batch_number=p_batch_number and bl.block_number=p_block_number for update of b,bl;

  if v_block_id is null then raise exception 'block not found'; end if;

  if exists(select 1 from public.question_factory_batches where id=v_batch_id and status='published') then raise exception 'Lote publicado'; end if;
  select count(*),count(*) filter(where not private.qf_current_approved(question_factory_items))
  into v_count,v_bad
  from public.question_factory_items
  where block_id=v_block_id;

  if p_decision='approved' and exists(select 1 from public.question_factory_items q left join public.question_exam_style_profiles p on p.exam_style=q.exam_style where q.block_id=v_block_id and (p.final_prompt_score is null or p.final_prompt_score<94)) then raise exception 'Calibração editorial bruta >=94 obrigatória'; end if;
  if p_decision='approved' and (v_count<>200 or v_bad<>0) then
    raise exception 'block cannot be approved: % questions, % not machine-approved',v_count,v_bad;
  end if;

  perform private.qf_invalidate_lot(v_batch_id);
  update public.question_factory_blocks
  set human_review_status=p_decision,
      human_review_notes=p_notes,
      human_reviewed_at=now(),
      status=case when p_decision='approved' then 'merged' else 'needs_revision' end,
      updated_at=now()
  where id=v_block_id;

  select count(*) into v_merged
  from public.question_factory_blocks
  where batch_id=v_batch_id and status='merged';

  update public.question_factory_batches
  set status=case
      when v_merged=5 then 'reviewing'
      when status in('ready','published') then status
      else 'building'
    end,
    updated_at=now()
  where id=v_batch_id;

  return jsonb_build_object(
    'batch_number',p_batch_number,
    'block_number',p_block_number,
    'decision',p_decision,
    'merged_blocks',v_merged,
    'lot_ready_for_final_review',(v_merged=5)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_question_factory_block_tracker()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  result jsonb;
begin
  if not public.is_admin_session() then
    raise exception 'admin access required' using errcode='42501';
  end if;

  with block_base as (
    select
      b.batch_number,
      b.status as batch_status,
      b.final_review_mode,
      b.final_review_chatgpt_status,
      b.final_review_perplexity_status,
      bl.id as block_id,
      bl.block_number,
      bl.target_size,
      bl.status,
      bl.chatgpt_review_status,
      bl.perplexity_review_status,
      bl.human_review_status,
      bl.style_score,
      bl.reliability_score,
      bl.style_score_note,
      bl.style_score_updated_at,
      (select count(*) from public.question_factory_items q where q.block_id=bl.id) as question_count,
      (
        select q.exam_style
        from public.question_factory_items q
        where q.block_id=bl.id and nullif(q.exam_style,'') is not null
        group by q.exam_style
        order by count(*) desc, q.exam_style
        limit 1
      ) as exam_style,
      (
        select q.latest_review_stage
        from public.question_factory_items q
        where q.block_id=bl.id and nullif(q.latest_review_stage,'') is not null
        group by q.latest_review_stage
        order by max(q.updated_at) desc
        limit 1
      ) as latest_review_stage
    from public.question_factory_blocks bl
    join public.question_factory_batches b on b.id=bl.batch_id
  ),
  enriched as (
    select
      bb.*,
      p.style_score as profile_style_score,
      p.style_confidence_score as profile_confidence_score,
      case
        when bb.question_count < coalesce(bb.target_size,200) then 'generation'
        when bb.chatgpt_review_status is null then 'chatgpt_initial'
        when exists(select 1 from public.question_factory_items q where q.block_id=bb.block_id and q.status in ('needs_revision','rejected')) then
          case when exists(select 1 from public.question_factory_items q join lateral (select r.chatgpt_agreement_status from public.question_factory_reviews r where r.item_id=q.id and r.item_version=q.version and r.review_stage in ('perplexity_initial','perplexity_reaudit','lot_chatgpt_final','lot_perplexity_final','lot_gemini_final') order by r.created_at desc,r.id desc limit 1) x on true where q.block_id=bb.block_id and q.status in ('needs_revision','rejected') and x.chatgpt_agreement_status in ('agree','partially_agree')) then 'chatgpt_correction'
          when exists(select 1 from public.question_factory_items q join lateral (select r.chatgpt_agreement_status from public.question_factory_reviews r where r.item_id=q.id and r.item_version=q.version and r.review_stage in ('perplexity_initial','perplexity_reaudit','lot_chatgpt_final','lot_perplexity_final','lot_gemini_final') order by r.created_at desc,r.id desc limit 1) x on true where q.block_id=bb.block_id and q.status in ('needs_revision','rejected') and x.chatgpt_agreement_status='disagree') then 'perplexity_reaudit'
          else 'chatgpt_adjudication' end
        when exists(select 1 from public.question_factory_items q where q.block_id=bb.block_id and not exists(select 1 from public.question_factory_reviews r where r.item_id=q.id and r.item_version=q.version and r.review_stage='blind_resolution')) then 'blind_resolution'
        when exists(select 1 from public.question_factory_items q where q.block_id=bb.block_id and not private.qf_current_approved(q)) then case when bb.latest_review_stage='chatgpt_correction_review' then 'perplexity_reaudit' else 'perplexity_initial' end
        when bb.human_review_status is distinct from 'approved' then 'human_review'
        else 'block_complete'
      end as next_stage
    from block_base bb
    left join public.question_exam_style_profiles p on p.exam_style=bb.exam_style
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'batch_number',batch_number,
      'block_number',block_number,
      'question_count',question_count,
      'target_size',target_size,
      'exam_style',exam_style,
      'status',status,
      'chatgpt_review_status',chatgpt_review_status,
      'perplexity_review_status',perplexity_review_status,
      'human_review_status',human_review_status,
      'latest_review_stage',latest_review_stage,
      'phase',case
        when question_count < coalesce(target_size,200) then 'Geração'
        when status='perplexity_review' and latest_review_stage='chatgpt_correction_review' then 'Reauditoria Perplexity'
        when status='perplexity_review' then 'Auditoria Perplexity'
        when status='needs_revision' then 'Correção'
        when human_review_status='pending' then 'Aprovação humana'
        when status='merged' then 'No lote de 1.000'
        when status='approved' then 'Bloco aprovado'
        else 'Checagem ChatGPT'
      end,
      'next_stage',next_stage,
      'next_provider',case
        when next_stage in ('blind_resolution','perplexity_initial','perplexity_reaudit') then 'perplexity'
        when next_stage in ('chatgpt_initial','chatgpt_adjudication','chatgpt_correction') then 'chatgpt'
        else null
      end,
      'style_score',coalesce(style_score,profile_style_score),
      'reliability_score',coalesce(reliability_score,profile_confidence_score),
      'style_score_note',style_score_note,
      'style_score_updated_at',style_score_updated_at
    )
    order by batch_number,block_number
  ),'[]'::jsonb)
  into result
  from enriched;

  return result;
end;
$function$;

create or replace function public.admin_update_question_factory_style_calibration(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare bl uuid; n int; avg_style numeric;
begin
 if not public.is_admin_session() then raise exception 'admin access required' using errcode='42501'; end if;
 select x.id into bl from public.question_factory_blocks x join public.question_factory_batches b on b.id=x.batch_id where b.batch_number=(p_payload->>'batch_number')::int and x.block_number=(p_payload->>'block_number')::int;
 if bl is null then return jsonb_build_object('updated',false,'reason','no_block'); end if;
 select count(*),avg((r.component_scores->>'style')::numeric) into n,avg_style
 from public.question_factory_items q join lateral (select * from public.question_factory_reviews r2 where r2.item_id=q.id and r2.item_version=q.version and r2.review_stage in ('perplexity_initial','perplexity_reaudit') order by r2.created_at desc,r2.id desc limit 1) r on true
 where q.block_id=bl and r.raw_payload->>'style_evidence_status'='VERIFIED';
 if n<>200 then return jsonb_build_object('updated',false,'reason','incomplete_current_version_coverage'); end if;
 update public.question_factory_blocks set style_score=round(avg_style,2),style_score_note='Média das 200 versões atuais; não é FINAL_PROMPT_SCORE.',style_score_updated_at=now() where id=bl;
 return jsonb_build_object('updated',true,'style_score',round(avg_style,2));
end $$;

revoke all on function public.admin_export_question_factory(integer,integer,boolean) from public,anon;
grant execute on function public.admin_export_question_factory(integer,integer,boolean) to authenticated;

revoke all on function public.admin_import_question_factory_review(jsonb) from public,anon;
grant execute on function public.admin_import_question_factory_review(jsonb) to authenticated;

revoke all on function public.admin_import_question_factory_adjudication(jsonb) from public,anon;
grant execute on function public.admin_import_question_factory_adjudication(jsonb) to authenticated;

revoke all on function public.admin_import_question_factory_corrections(jsonb) from public,anon;
grant execute on function public.admin_import_question_factory_corrections(jsonb) to authenticated;

revoke all on function public.admin_import_question_factory_lot_review(jsonb) from public,anon;
grant execute on function public.admin_import_question_factory_lot_review(jsonb) to authenticated;

revoke all on function public.admin_approve_question_factory_lot(integer) from public,anon;
grant execute on function public.admin_approve_question_factory_lot(integer) to authenticated;

revoke all on function public.admin_import_question_factory_calibration(jsonb) from public,anon;
grant execute on function public.admin_import_question_factory_calibration(jsonb) to authenticated;

revoke all on function public.admin_question_factory_style_snapshot() from public,anon;
grant execute on function public.admin_question_factory_style_snapshot() to authenticated;

revoke all on function public.admin_question_factory_snapshot() from public,anon;
grant execute on function public.admin_question_factory_snapshot() to authenticated;

revoke all on function public.admin_set_question_factory_block_human_review(integer,integer,text,text) from public,anon;
grant execute on function public.admin_set_question_factory_block_human_review(integer,integer,text,text) to authenticated;

revoke all on function public.admin_question_factory_block_tracker() from public,anon;
grant execute on function public.admin_question_factory_block_tracker() to authenticated;

revoke all on function public.admin_update_question_factory_style_calibration(jsonb) from public,anon;
grant execute on function public.admin_update_question_factory_style_calibration(jsonb) to authenticated;

revoke all on function private.qf_assert_review(jsonb,text),private.qf_current_approved(public.question_factory_items),private.qf_manifest(uuid),private.qf_invalidate_lot(uuid) from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.archive_rejected_question_factory_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_stage text;
  v_reason text;
  v_batch integer;
  v_block integer;
begin
  if new.status='rejected' then
    v_stage := 'item_status';
    v_reason := coalesce(to_jsonb(new)->>'observacao_revisao', new.block_review_notes, new.lot_review_chatgpt_notes, new.lot_review_perplexity_notes);
  elsif new.block_review_status='rejected' then
    v_stage := 'perplexity_block_review';
    v_reason := new.block_review_notes;
  elsif new.lot_review_chatgpt_status='rejected' then
    v_stage := 'chatgpt_final_review';
    v_reason := new.lot_review_chatgpt_notes;
  elsif new.lot_review_perplexity_status='rejected' then
    v_stage := 'perplexity_final_review';
    v_reason := new.lot_review_perplexity_notes;
  else
    return new;
  end if;

  select b.batch_number, bl.block_number
    into v_batch, v_block
  from public.question_factory_batches b
  left join public.question_factory_blocks bl on bl.id=new.block_id
  where b.id=new.batch_id;

  insert into public.question_factory_bad_items(
    original_item_id, question_id, question_code, exam_style,
    batch_number, block_number, sequence_no, item_version,
    failure_stage, failure_status, failure_reason, question_snapshot
  )
  values(
    new.id,
    coalesce(new.question_id, new.question_code, new.id::text),
    new.question_code,
    new.exam_style,
    v_batch,
    v_block,
    new.sequence_no,
    coalesce(new.version,1),
    v_stage,
    'rejected',
    v_reason,
    to_jsonb(new)
  )
  on conflict(original_item_id,item_version,failure_stage)
  do update set
    failure_reason=excluded.failure_reason,
    question_snapshot=excluded.question_snapshot,
    archived_at=now();

  return new;
end;
$function$;

commit;
