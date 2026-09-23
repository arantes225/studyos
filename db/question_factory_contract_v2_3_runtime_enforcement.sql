-- Runtime enforcement for Question Factory Contract 2.3.
-- Apply after question_factory_contract_v2.sql.
-- This file documents the live Supabase enforcement deployed on 2026-09-23.

begin;

-- Blind export is allowed only after current-version adversarial ChatGPT PASS.
create or replace function public.admin_export_question_factory(
  p_batch_number integer,
  p_block_number integer default null,
  p_blind boolean default true
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare b uuid; result jsonb; blocked int;
begin
 if not public.is_admin_session() then raise exception 'admin access required' using errcode='42501'; end if;
 select id into b from public.question_factory_batches where batch_number=p_batch_number;
 if b is null then raise exception 'Lote não encontrado'; end if;

 if p_blind then
   select count(*) into blocked
   from public.question_factory_items q
   join public.question_factory_blocks bl on bl.id=q.block_id
   where q.batch_id=b
     and (p_block_number is null or bl.block_number=p_block_number)
     and not exists(
       select 1 from public.question_factory_reviews r
       where r.item_id=q.id and r.item_version=q.version
         and r.review_stage='chatgpt_initial'
         and r.review_status='approved'
     );
   if blocked>0 then
     raise exception 'Exportação cega bloqueada: % item(ns) sem PASS adversarial ChatGPT na versão atual',blocked;
   end if;
 end if;

 select jsonb_build_object(
   'schema_version','2.3',
   'batch_number',p_batch_number,
   'block_number',p_block_number,
   'blind',p_blind,
   'version_manifest',coalesce(jsonb_agg(jsonb_build_object('question_id',q.question_id,'item_version',q.version) order by q.question_id),'[]'),
   'questions',coalesce(jsonb_agg(
     case when p_blind then
       jsonb_build_object(
         'question_id',q.question_id,'version',q.version,'enunciado',q.enunciado,
         'alternativa_a',q.alternativa_a,'alternativa_b',q.alternativa_b,
         'alternativa_c',q.alternativa_c,'alternativa_d',q.alternativa_d
       )
     else
       to_jsonb(q)||jsonb_build_object(
         'latest_review',(select to_jsonb(r) from public.question_factory_reviews r where r.item_id=q.id and r.item_version=q.version and r.review_stage<>'blind_resolution' order by r.created_at desc,r.id desc limit 1),
         'blind_resolution',(select r.raw_payload from public.question_factory_reviews r where r.item_id=q.id and r.item_version=q.version and r.review_stage='blind_resolution' order by r.created_at desc,r.id desc limit 1)
       )
     end order by q.sequence_no
   ),'[]')
 ) into result
 from public.question_factory_items q
 join public.question_factory_blocks bl on bl.id=q.block_id
 where q.batch_id=b and (p_block_number is null or bl.block_number=p_block_number);

 return result;
end
$$;

-- Raw calibration threshold is 84.
create or replace function public.admin_import_question_factory_calibration(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare total numeric:=0; k text; cap numeric; n numeric;
 evidence jsonb:=p_payload->'primary_style_evidence';
 score numeric:=(p_payload->>'FINAL_PROMPT_SCORE')::numeric;
begin
 if not public.is_admin_session() then raise exception 'admin access required' using errcode='42501'; end if;
 if coalesce(p_payload->>'schema_version','') not in ('2.0','2.3') or p_payload->>'review_stage' is distinct from 'prompt_calibration' then raise exception 'Contrato/etapa inválido'; end if;
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
  if score>=84 and (coalesce((p_payload->>'sample_size')::int,0)<15 or (p_payload->>'hard_fail_count')::int is distinct from 0 or p_payload->>'decision' is distinct from 'PROMPT_APPROVED') then raise exception 'Avanço exige pelo menos 15 itens brutos inéditos, zero hard fails e PROMPT_APPROVED'; end if;
 end if;
 update public.question_exam_style_profiles
 set final_prompt_score=score,prompt_calibration=p_payload,primary_style_evidence=coalesce(evidence,'[]'),updated_at=now()
 where exam_style=p_payload->>'exam_style';
 return jsonb_build_object('updated',true,'FINAL_PROMPT_SCORE',score,'calibration_threshold',84);
end
$$;

-- Human merge gate also uses raw calibration threshold 84.
-- The live function additionally requires all 200 current-version items to be machine-approved.

-- Tracker routes adversarially rejected ChatGPT items back to generation rather than Perplexity.
-- Exact live definition is intentionally kept in Supabase as the source of truth; this marker
-- exists so future contract deployments do not revert the routing behavior.

commit;
