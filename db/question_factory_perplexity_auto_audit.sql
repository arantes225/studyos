-- Question Factory: automatic Perplexity audit pipeline (LURIA 3.4)
-- Mirrors the live Studyos Supabase deployment as of 2026-09-24.
-- Reviews are persisted only through controlled SECURITY DEFINER importers.

begin;

create unique index if not exists question_factory_reviews_perplexity_logical_uq
on public.question_factory_reviews(item_id,item_version,review_stage,reviewer)
where review_stage in ('blind_resolution','perplexity_initial','perplexity_reaudit');

CREATE OR REPLACE FUNCTION private.qf_assert_perplexity_review_v34(p jsonb, answer text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  k text;
  x jsonb;
  expected_agreement text;
  source_status text := coalesce(p->>'source_verification_status','');
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Parecer Perplexity deve ser objeto JSON';
  end if;

  if p->>'original_answer' is distinct from answer then
    raise exception 'original_answer deve coincidir com o gabarito atual';
  end if;

  if not (p ? 'independent_answer')
     or (p->>'independent_answer' is not null and p->>'independent_answer' not in ('A','B','C','D')) then
    raise exception 'independent_answer ausente ou inválida';
  end if;

  if coalesce(p->>'confidence','') not in ('low','medium','high') then
    raise exception 'confidence deve ser low, medium ou high';
  end if;
  if jsonb_typeof(p->'ambiguity') is distinct from 'boolean' then
    raise exception 'ambiguity deve ser boolean';
  end if;
  if jsonb_typeof(p->'single_best_answer') is distinct from 'boolean' then
    raise exception 'single_best_answer deve ser boolean';
  end if;
  if jsonb_typeof(p->'hard_fail') is distinct from 'boolean' then
    raise exception 'hard_fail deve ser boolean';
  end if;
  if jsonb_typeof(p->'hard_fail_reasons') is distinct from 'array' then
    raise exception 'hard_fail_reasons deve ser array';
  end if;

  expected_agreement := case
    when p->>'independent_answer' is null then 'unresolved'
    when p->>'independent_answer'=answer then 'agree'
    else 'disagree'
  end;
  if p->>'answer_agreement' is distinct from expected_agreement then
    raise exception 'answer_agreement incompatível com independent_answer/original_answer';
  end if;

  if not (p ? 'surface_guess_without_vignette')
     or (p->>'surface_guess_without_vignette' is not null and p->>'surface_guess_without_vignette' not in ('A','B','C','D')) then
    raise exception 'surface_guess_without_vignette ausente ou inválido';
  end if;
  if coalesce(p->>'surface_guess_confidence','') not in ('low','medium','high') then
    raise exception 'surface_guess_confidence deve ser low, medium ou high';
  end if;
  if coalesce(p->>'lexical_asymmetry','') not in ('PASS','FAIL') then
    raise exception 'lexical_asymmetry deve ser PASS ou FAIL';
  end if;
  if coalesce(p->>'vignette_dependency','') not in ('PASS','FAIL') then
    raise exception 'vignette_dependency deve ser PASS ou FAIL';
  end if;

  if coalesce(p->>'best_distractor','') not in ('A','B','C','D')
     or p->>'best_distractor'=answer then
    raise exception 'best_distractor deve apontar uma alternativa incorreta';
  end if;
  if nullif(btrim(coalesce(p->>'best_distractor_rationale','')),'') is null then
    raise exception 'best_distractor_rationale obrigatório';
  end if;
  if nullif(btrim(coalesce(p->>'counterfactual_change','')),'') is null then
    raise exception 'counterfactual_change obrigatório';
  end if;
  if nullif(btrim(coalesce(p->>'functional_killer_1','')),'') is null
     or nullif(btrim(coalesce(p->>'functional_killer_2','')),'') is null then
    raise exception 'functional_killer_1 e functional_killer_2 são obrigatórios';
  end if;
  if coalesce(p->>'functional_killer_1_option','') not in ('A','B','C','D')
     or coalesce(p->>'functional_killer_2_option','') not in ('A','B','C','D')
     or p->>'functional_killer_1_option'=answer
     or p->>'functional_killer_2_option'=answer
     or p->>'functional_killer_1_option'=p->>'functional_killer_2_option' then
    raise exception 'functional killers devem identificar dois distratores distintos';
  end if;

  if jsonb_typeof(p->'explanation_checks') is distinct from 'object' then
    raise exception 'explanation_checks obrigatório';
  end if;
  foreach k in array array['A','B','C','D'] loop
    x := p->'explanation_checks'->k;
    if jsonb_typeof(x) is distinct from 'object'
       or coalesce(x->>'status','') not in ('PASS','FAIL')
       or nullif(btrim(coalesce(x->>'reason','')),'') is null then
      raise exception 'explanation_checks.% incompleto',k;
    end if;
  end loop;

  x := p->'message_key_check';
  if jsonb_typeof(x) is distinct from 'object'
     or coalesce(x->>'status','') not in ('PASS','FAIL')
     or nullif(btrim(coalesce(x->>'reason','')),'') is null
     or nullif(btrim(coalesce(x->>'decisive_feature','')),'') is null then
    raise exception 'message_key_check incompleto';
  end if;

  if source_status not in ('VERIFIED','SOURCE_VERIFICATION_PENDING','SOURCE_VERIFICATION_FAILED') then
    raise exception 'source_verification_status inválido';
  end if;
  if jsonb_typeof(p->'source_checks') is distinct from 'array'
     or p->'source_checks'='[]'::jsonb then
    raise exception 'source_checks deve conter ao menos uma fonte tentada';
  end if;

  for x in select value from jsonb_array_elements(p->'source_checks') loop
    if nullif(btrim(coalesce(x->>'institution','')),'') is null
       or nullif(btrim(coalesce(x->>'document','')),'') is null
       or nullif(btrim(coalesce(x->>'year','')),'') is null
       or coalesce(x->>'url','') !~ '^https?://'
       or coalesce(x->>'verification_status','') not in ('VERIFIED','PENDING','FAILED') then
      raise exception 'source_checks contém fonte incompleta';
    end if;
    if x->>'verification_status'='VERIFIED' and (
      x->'url_reachable' is distinct from 'true'::jsonb
      or x->'title_match' is distinct from 'true'::jsonb
      or x->'year_match' is distinct from 'true'::jsonb
      or x->'section_found' is distinct from 'true'::jsonb
      or x->'supports_answer' is distinct from 'true'::jsonb
      or nullif(btrim(coalesce(x->>'section','')),'') is null
    ) then
      raise exception 'Fonte marcada VERIFIED sem comprovação completa';
    end if;
  end loop;

  if source_status='VERIFIED' then
    if jsonb_typeof(p->'verified_sources') is distinct from 'array'
       or p->'verified_sources'='[]'::jsonb then
      raise exception 'VERIFIED exige verified_sources';
    end if;
    if not exists (
      select 1
      from jsonb_array_elements(p->'source_checks') s
      where s->>'verification_status'='VERIFIED'
        and s->'supports_answer'='true'::jsonb
    ) then
      raise exception 'VERIFIED exige source_check que sustente a resposta';
    end if;
  end if;

  if jsonb_typeof(p->'proposed_change') is distinct from 'object'
     or jsonb_typeof(p->'proposed_change'->'change_required') is distinct from 'boolean'
     or jsonb_typeof(p->'proposed_change'->'exact_replacement') is distinct from 'object'
     or not (p->'proposed_change' ? 'reason') then
    raise exception 'proposed_change incompleto';
  end if;

  foreach k in array array[
    'scientific_issue','source_issue','answer_source_issue','explanation_issue',
    'distractor_issue','style_issue','wording_issue','difficulty_issue'
  ] loop
    if not (p ? k) then
      raise exception 'Campo obrigatório ausente: %',k;
    end if;
  end loop;

  if coalesce(p->>'distractor_quality','') not in ('WEAK','FAIR','GOOD','EXCELLENT') then
    raise exception 'distractor_quality inválido';
  end if;
  if coalesce(p->>'alternative_granularity','') not in ('PASS','FAIL') then
    raise exception 'alternative_granularity inválido';
  end if;
  if coalesce(p->>'difficulty_alignment','') not in ('PASS','FAIL') then
    raise exception 'difficulty_alignment inválido';
  end if;

  return true;
end
$function$;

CREATE OR REPLACE FUNCTION public.admin_question_factory_review_coverage(p_batch_number integer, p_block_number integer, p_stage text, p_reviewer text, p_start integer DEFAULT 1, p_end integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_block_id uuid;
  v_expected integer;
  v_found integer;
  v_persisted integer;
  v_approved integer;
  v_revision integer;
  v_rejected integer;
  v_hard integer;
  v_agreement integer;
  v_source_pending integer;
  v_score numeric;
  v_reviewed_ids jsonb;
  v_pending_ids jsonb;
  v_reviewed_sequences jsonb;
  v_pending_sequences jsonb;
begin
  if not public.is_admin_session() then
    raise exception 'admin access required' using errcode='42501';
  end if;
  if p_start < 1 or p_end < p_start or p_end > 200 then raise exception 'Faixa inválida'; end if;
  if p_stage not in ('blind_resolution','perplexity_initial','perplexity_reaudit','chatgpt_initial') then raise exception 'Etapa inválida'; end if;

  select bl.id into v_block_id
  from public.question_factory_blocks bl
  join public.question_factory_batches b on b.id=bl.batch_id
  where b.batch_number=p_batch_number and bl.block_number=p_block_number;

  if v_block_id is null then raise exception 'Lote/bloco não encontrado'; end if;
  v_expected := p_end-p_start+1;

  with target as (
    select q.id,q.question_id,q.version,q.block_sequence_no
    from public.question_factory_items q
    where q.block_id=v_block_id
      and q.block_sequence_no between p_start and p_end
      and (
        p_stage <> 'perplexity_reaudit'
        or q.latest_review_stage='chatgpt_correction_review'
        or exists(
          select 1
          from public.question_factory_reviews rr
          where rr.item_id=q.id and rr.item_version=q.version
            and rr.review_stage='perplexity_reaudit' and rr.reviewer=p_reviewer
        )
      )
  ),
  covered as (
    select t.*,
      lr.review_status,lr.hard_fail,lr.independent_answer,lr.original_answer,
      lr.quality_score,lr.raw_payload,
      (lr.id is not null) persisted
    from target t
    left join lateral (
      select r.id,r.review_status,r.hard_fail,r.independent_answer,r.original_answer,
             r.quality_score,r.raw_payload
      from public.question_factory_reviews r
      where r.item_id=t.id and r.item_version=t.version
        and r.review_stage=p_stage and r.reviewer=p_reviewer
      order by r.created_at desc,r.id desc limit 1
    ) lr on true
  )
  select
    count(*),
    count(*) filter(where persisted),
    count(*) filter(where review_status='approved'),
    count(*) filter(where review_status='needs_revision'),
    count(*) filter(where review_status='rejected'),
    count(*) filter(where coalesce(hard_fail,false)),
    count(*) filter(where persisted and independent_answer is not distinct from original_answer and independent_answer is not null),
    count(*) filter(where persisted and raw_payload->>'source_verification_status' in ('SOURCE_VERIFICATION_PENDING','SOURCE_VERIFICATION_FAILED')),
    round(avg(quality_score) filter(where persisted and quality_score is not null),2),
    coalesce(jsonb_agg(question_id order by block_sequence_no) filter(where persisted),'[]'::jsonb),
    coalesce(jsonb_agg(question_id order by block_sequence_no) filter(where not persisted),'[]'::jsonb),
    coalesce(jsonb_agg(block_sequence_no order by block_sequence_no) filter(where persisted),'[]'::jsonb),
    coalesce(jsonb_agg(block_sequence_no order by block_sequence_no) filter(where not persisted),'[]'::jsonb)
  into v_found,v_persisted,v_approved,v_revision,v_rejected,v_hard,v_agreement,
       v_source_pending,v_score,v_reviewed_ids,v_pending_ids,v_reviewed_sequences,v_pending_sequences
  from covered;

  if p_stage='perplexity_reaudit' then
    v_expected:=v_found;
  end if;

  return jsonb_build_object(
    'batch_number',p_batch_number,'block_number',p_block_number,
    'review_stage',p_stage,'reviewer',p_reviewer,
    'range',jsonb_build_object('start',p_start,'end',p_end,'expected',v_expected,'found',v_found),
    'processed',v_persisted,'persisted',v_persisted,
    'approved',v_approved,'needs_revision',v_revision,'rejected',v_rejected,
    'hard_rejects',v_hard,'agreement_count',v_agreement,
    'source_pending_count',v_source_pending,'average_quality_score',v_score,
    'reviewed_ids',v_reviewed_ids,'pending_ids',v_pending_ids,
    'reviewed_sequences',v_reviewed_sequences,'pending_sequences',v_pending_sequences,
    'complete',(v_found=v_expected and v_persisted=v_expected)
  );
end
$function$;

CREATE OR REPLACE FUNCTION public.admin_question_factory_next_perplexity_item(p_batch_number integer, p_block_number integer, p_start integer DEFAULT 1, p_end integer DEFAULT 200, p_review_stage text DEFAULT 'perplexity_initial'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_block_id uuid;
  q public.question_factory_items%rowtype;
  v_blind jsonb;
  v_profile jsonb;
  v_block_code text;
begin
  if not public.is_admin_session() then
    raise exception 'admin access required' using errcode='42501';
  end if;
  if p_start < 1 or p_end < p_start or p_end > 200 then raise exception 'Faixa inválida'; end if;
  if p_review_stage not in ('perplexity_initial','perplexity_reaudit') then raise exception 'Etapa inválida'; end if;

  select bl.id,coalesce(bl.block_code,'L'||lpad(b.batch_number::text,3,'0')||'-B'||lpad(bl.block_number::text,2,'0'))
  into v_block_id,v_block_code
  from public.question_factory_blocks bl
  join public.question_factory_batches b on b.id=bl.batch_id
  where b.batch_number=p_batch_number and bl.block_number=p_block_number;

  if v_block_id is null then raise exception 'Lote/bloco não encontrado'; end if;

  select qi.* into q
  from public.question_factory_items qi
  where qi.block_id=v_block_id
    and qi.block_sequence_no between p_start and p_end
    and (
      (
        p_review_stage='perplexity_initial'
        and exists(
          select 1
          from public.question_factory_reviews r
          where r.item_id=qi.id and r.item_version=qi.version
            and r.review_stage='chatgpt_initial' and r.review_status='approved'
        )
      )
      or (
        p_review_stage='perplexity_reaudit'
        and qi.latest_review_stage='chatgpt_correction_review'
      )
    )
    and not exists(
      select 1
      from public.question_factory_reviews r
      where r.item_id=qi.id and r.item_version=qi.version
        and r.review_stage=p_review_stage and r.reviewer='Perplexity'
    )
  order by qi.block_sequence_no
  limit 1;

  if q.id is null then return null; end if;

  select r.raw_payload into v_blind
  from public.question_factory_reviews r
  where r.item_id=q.id and r.item_version=q.version
    and r.review_stage='blind_resolution' and r.reviewer='Perplexity'
  order by r.created_at desc,r.id desc
  limit 1;

  select to_jsonb(p) into v_profile
  from public.question_exam_style_profiles p
  where p.exam_style=q.exam_style;

  return jsonb_build_object(
    'batch_number',p_batch_number,
    'block_number',p_block_number,
    'block_code',v_block_code,
    'block_sequence_no',q.block_sequence_no,
    'question_id',q.question_id,
    'item_version',q.version,
    'question',to_jsonb(q) - 'id' - 'batch_id' - 'block_id',
    'blind_resolution',v_blind,
    'style_profile',coalesce(v_profile,'{}'::jsonb)
  );
end
$function$;

CREATE OR REPLACE FUNCTION public.admin_import_question_factory_review(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 b uuid; bl uuid; q public.question_factory_items%rowtype; r jsonb;
 stage text:=p_payload->>'review_stage';
 reviewer text:=coalesce(p_payload->>'reviewer',p_payload->>'auditor');
 ok boolean; n int:=0; approved int:=0; rejected int:=0; good int; total int; blind text;
 adv jsonb;
 existing_blind public.question_factory_reviews%rowtype;
begin
 if not public.is_admin_session() then raise exception 'admin access required' using errcode='42501'; end if;
 if coalesce(p_payload->>'schema_version','') not in ('2.0','2.3') or stage is null or stage not in ('blind_resolution','chatgpt_initial','perplexity_initial','perplexity_reaudit') then raise exception 'Etapa/contrato inválido; use 2.3'; end if;
 if reviewer is distinct from (case when stage='chatgpt_initial' then 'ChatGPT' else 'Perplexity' end) then raise exception 'Revisor incompatível com etapa'; end if;

 select b1.id,bl1.id into b,bl
 from public.question_factory_batches b1
 join public.question_factory_blocks bl1 on bl1.batch_id=b1.id
 where b1.batch_number=(p_payload->>'batch_number')::int
   and bl1.block_number=(p_payload->>'block_number')::int
 for update of b1,bl1;

 if bl is null then raise exception 'Lote/bloco não encontrado'; end if;
 if exists(select 1 from public.question_factory_batches where id=b and status='published') then raise exception 'Lote publicado é imutável neste fluxo'; end if;
 if jsonb_typeof(p_payload->'reviews') is distinct from 'array' or p_payload->'reviews'='[]'::jsonb then raise exception 'reviews não pode estar vazio'; end if;
 if (select count(*)<>count(distinct x->>'question_id') from jsonb_array_elements(p_payload->'reviews') x) then raise exception 'IDs repetidos/ausentes'; end if;

 for r in select value from jsonb_array_elements(p_payload->'reviews') loop
  select * into q
  from public.question_factory_items
  where block_id=bl and question_id=r->>'question_id'
  for update;

  if q.id is null or (r->>'item_version')::int is distinct from q.version then
    raise exception 'Questão/versão divergente: %',r->>'question_id';
  end if;

  if stage='blind_resolution' then
   if not(r ? 'independent_answer')
      or (r->>'independent_answer' is not null and r->>'independent_answer' not in ('A','B','C','D'))
      or nullif(btrim(r->>'reason'),'') is null then
     raise exception 'Resolução cega incompleta';
   end if;

   select * into existing_blind
   from public.question_factory_reviews r0
   where r0.item_id=q.id and r0.item_version=q.version
     and r0.review_stage='blind_resolution' and r0.reviewer='Perplexity'
   order by r0.created_at desc,r0.id desc
   limit 1;

   if found then
     if existing_blind.independent_answer is distinct from r->>'independent_answer'
        or coalesce(existing_blind.raw_payload->>'reason','') is distinct from coalesce(r->>'reason','') then
       raise exception 'Resolução cega já registrada com conteúdo diferente; resposta original é imutável';
     end if;
     n:=n+1;
     continue;
   end if;

   if exists(
     select 1 from public.question_factory_reviews r0
     where r0.item_id=q.id and r0.item_version=q.version
       and r0.review_stage in ('perplexity_initial','perplexity_reaudit')
   ) then
     raise exception 'Resolução cega não pode ser criada após auditoria da mesma versão';
   end if;

   if not (
     q.latest_review_stage='chatgpt_correction_review'
     or exists(
       select 1 from public.question_factory_reviews r0
       where r0.item_id=q.id and r0.item_version=q.version
         and r0.review_stage='chatgpt_initial' and r0.review_status='approved'
     )
   ) then
     raise exception 'Resolução cega bloqueada: versão atual precisa estar aprovada no ChatGPT inicial ou corrigida pelo ChatGPT para %',q.question_id;
   end if;

   insert into public.question_factory_reviews(
     item_id,block_id,batch_id,question_id,item_version,review_stage,reviewer,
     review_status,independent_answer,raw_payload
   )
   values(
     q.id,bl,b,q.question_id,q.version,stage,reviewer,
     'needs_revision',r->>'independent_answer',r
   )
   on conflict (item_id,item_version,review_stage,reviewer)
   where review_stage in ('blind_resolution','perplexity_initial','perplexity_reaudit')
   do nothing;

  else
   if stage<>'chatgpt_initial' then
    select independent_answer into blind
    from public.question_factory_reviews
    where item_id=q.id and item_version=q.version and review_stage='blind_resolution'
    order by created_at desc,id desc
    limit 1;

    if not found then raise exception 'Resolução cega da versão atual obrigatória: %',q.question_id; end if;
    if blind is distinct from r->>'independent_answer' then raise exception 'Resposta independente difere do registro cego'; end if;
   end if;

   if stage in ('perplexity_initial','perplexity_reaudit') then
     perform private.qf_assert_perplexity_review_v34(r,q.gabarito);
   end if;

   adv:=private.qf_adversarial_reject_reasons(r,q.gabarito);
   if adv <> '[]'::jsonb then
     r:=jsonb_set(r,'{status}','"rejected"'::jsonb,true);
     r:=jsonb_set(r,'{hard_fail}','true'::jsonb,true);
     r:=jsonb_set(r,'{hard_fail_reasons}',coalesce(r->'hard_fail_reasons','[]'::jsonb) || adv,true);
     r:=jsonb_set(r,'{adversarial_reject_reasons}',adv,true);
   end if;

   ok:=private.qf_assert_review(r,q.gabarito);

   if stage in ('perplexity_initial','perplexity_reaudit') then
     insert into public.question_factory_reviews(
       item_id,block_id,batch_id,question_id,item_version,review_stage,reviewer,
       quality_score,component_scores,independent_answer,original_answer,review_status,
       confidence,ambiguity,single_best_answer,hard_fail,hard_fail_reasons,
       scientific_issue,source_issue,answer_source_issue,explanation_issue,distractor_issue,
       style_issue,suggested_correction,verified_sources,raw_payload,proposed_change
     )
     values(
       q.id,bl,b,q.question_id,q.version,stage,reviewer,
       (r->>'quality_score')::numeric,r->'component_scores',r->>'independent_answer',r->>'original_answer',r->>'status',
       r->>'confidence',(r->>'ambiguity')::boolean,(r->>'single_best_answer')::boolean,(r->>'hard_fail')::boolean,
       coalesce(r->'hard_fail_reasons','[]'::jsonb),
       r->>'scientific_issue',r->>'source_issue',r->>'answer_source_issue',r->>'explanation_issue',r->>'distractor_issue',
       r->>'style_issue',r->>'suggested_correction',coalesce(r->'verified_sources','[]'::jsonb),r,
       coalesce(r->'proposed_change','{}'::jsonb)
     )
     on conflict (item_id,item_version,review_stage,reviewer)
     where review_stage in ('blind_resolution','perplexity_initial','perplexity_reaudit')
     do update set
       quality_score=excluded.quality_score,
       component_scores=excluded.component_scores,
       independent_answer=excluded.independent_answer,
       original_answer=excluded.original_answer,
       review_status=excluded.review_status,
       confidence=excluded.confidence,
       ambiguity=excluded.ambiguity,
       single_best_answer=excluded.single_best_answer,
       hard_fail=excluded.hard_fail,
       hard_fail_reasons=excluded.hard_fail_reasons,
       scientific_issue=excluded.scientific_issue,
       source_issue=excluded.source_issue,
       answer_source_issue=excluded.answer_source_issue,
       explanation_issue=excluded.explanation_issue,
       distractor_issue=excluded.distractor_issue,
       style_issue=excluded.style_issue,
       suggested_correction=excluded.suggested_correction,
       verified_sources=excluded.verified_sources,
       raw_payload=excluded.raw_payload,
       proposed_change=excluded.proposed_change,
       created_at=clock_timestamp();
   else
     insert into public.question_factory_reviews(
       item_id,block_id,batch_id,question_id,item_version,review_stage,reviewer,
       quality_score,component_scores,independent_answer,original_answer,review_status,
       confidence,ambiguity,single_best_answer,hard_fail,hard_fail_reasons,
       scientific_issue,source_issue,answer_source_issue,explanation_issue,distractor_issue,
       style_issue,suggested_correction,verified_sources,raw_payload,proposed_change
     )
     values(
       q.id,bl,b,q.question_id,q.version,stage,reviewer,
       (r->>'quality_score')::numeric,r->'component_scores',r->>'independent_answer',r->>'original_answer',r->>'status',
       r->>'confidence',(r->>'ambiguity')::boolean,(r->>'single_best_answer')::boolean,(r->>'hard_fail')::boolean,
       coalesce(r->'hard_fail_reasons','[]'::jsonb),
       r->>'scientific_issue',r->>'source_issue',r->>'answer_source_issue',r->>'explanation_issue',r->>'distractor_issue',
       r->>'style_issue',r->>'suggested_correction',coalesce(r->'verified_sources','[]'::jsonb),r,
       coalesce(r->'proposed_change','{}'::jsonb)
     );
   end if;

   if stage='chatgpt_initial' then
     update public.question_factory_items
     set latest_review_stage=stage,
         status=case when r->>'status' in ('needs_revision','rejected') then r->>'status' else status end,
         updated_at=now()
     where id=q.id;
   else
     update public.question_factory_items
     set quality_score=(r->>'quality_score')::numeric,
         latest_review_stage=stage,
         block_review_status=r->>'status',
         block_review_answer=r->>'independent_answer',
         block_review_notes=case when adv<>'[]'::jsonb then 'Adversarial hard reject: '||adv::text else r->>'suggested_correction' end,
         status=case when ok then 'generated' else r->>'status' end,
         updated_at=now()
     where id=q.id;
   end if;

   if ok then approved:=approved+1;
   elsif r->>'status'='rejected' then rejected:=rejected+1;
   end if;
  end if;

  n:=n+1;
 end loop;

 if stage='chatgpt_initial' then
  select count(*),count(*) filter(where coalesce((
    select r2.review_status='approved'
    from public.question_factory_reviews r2
    where r2.item_id=qi.id and r2.item_version=qi.version and r2.review_stage='chatgpt_initial'
    order by r2.created_at desc,r2.id desc limit 1
  ),false))
  into total,good
  from public.question_factory_items qi
  where qi.block_id=bl;

  update public.question_factory_blocks
  set chatgpt_review_status=case when total=200 and good=200 then 'approved' else 'needs_revision' end,
      updated_at=now()
  where id=bl;

 elsif stage<>'blind_resolution' then
  perform private.qf_invalidate_lot(b);

  select count(*),count(*) filter(where private.qf_current_approved(qi))
  into total,good
  from public.question_factory_items qi
  where qi.block_id=bl;

  update public.question_factory_blocks
  set perplexity_review_status=case when total=200 and good=200 then 'approved' else 'needs_revision' end,
      status=case when total=200 and good=200 then 'approved' else 'needs_revision' end,
      human_review_status=case when total=200 and good=200 then 'pending' else null end,
      updated_at=now()
  where id=bl;
 end if;

 return jsonb_build_object(
   'imported',n,
   'approved',approved,
   'needs_revision',n-approved-rejected,
   'rejected',rejected,
   'quality_threshold',97,
   'adversarial_hard_rejects_enforced',true,
   'idempotent_perplexity_key',true
 );
end
$function$;

CREATE OR REPLACE FUNCTION public.admin_question_factory_block_flow_snapshot()
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

  with blocks as (
    select b.batch_number,
      coalesce(b.batch_code,'L'||lpad(b.batch_number::text,3,'0')) batch_code,
      bl.id block_id,bl.block_number,
      coalesce(bl.block_code,coalesce(b.batch_code,'L'||lpad(b.batch_number::text,3,'0'))||'-B'||lpad(bl.block_number::text,2,'0')) block_code,
      bl.target_size,bl.human_review_status
    from public.question_factory_blocks bl
    join public.question_factory_batches b on b.id=bl.batch_id
  ),
  item_base as (
    select
      q.id item_id,q.block_id,q.version,q.latest_review_stage,
      exists(
        select 1 from public.question_factory_reviews r
        where r.item_id=q.id and r.item_version=q.version
          and r.review_stage='chatgpt_initial' and r.review_status='approved'
      ) has_chatgpt_initial,
      exists(
        select 1 from public.question_factory_reviews r
        where r.item_id=q.id and r.item_version=q.version
          and r.review_stage='blind_resolution' and r.reviewer='Perplexity'
      ) has_blind_resolution,
      exists(
        select 1 from public.question_factory_reviews r
        where r.item_id=q.id and r.item_version=q.version
          and r.review_stage in ('perplexity_initial','perplexity_reaudit')
          and r.reviewer='Perplexity'
      ) has_perplexity,
      (
        select r.review_stage
        from public.question_factory_reviews r
        where r.item_id=q.id and r.item_version=q.version
          and r.review_stage in ('perplexity_initial','perplexity_reaudit')
          and r.reviewer='Perplexity'
        order by case r.review_stage when 'perplexity_reaudit' then 2 else 1 end desc,
                 r.created_at desc,r.id desc limit 1
      ) current_perplexity_stage,
      (
        select r.review_status
        from public.question_factory_reviews r
        where r.item_id=q.id and r.item_version=q.version
          and r.review_stage in ('perplexity_initial','perplexity_reaudit')
          and r.reviewer='Perplexity'
        order by case r.review_stage when 'perplexity_reaudit' then 2 else 1 end desc,
                 r.created_at desc,r.id desc limit 1
      ) current_perplexity_status,
      (
        select r.chatgpt_agreement_status
        from public.question_factory_reviews r
        where r.item_id=q.id and r.item_version=q.version
          and r.review_stage in ('perplexity_initial','perplexity_reaudit')
          and r.reviewer='Perplexity'
        order by case r.review_stage when 'perplexity_reaudit' then 2 else 1 end desc,
                 r.created_at desc,r.id desc limit 1
      ) current_agreement,
      exists(
        select 1
        from public.question_factory_reviews rp
        where rp.item_id=q.id
          and rp.item_version=q.version-1
          and rp.review_stage in ('perplexity_initial','perplexity_reaudit')
          and rp.chatgpt_agreement_status in ('agree','partially_agree')
          and coalesce(rp.raw_payload->'adjudication'->'approved_patch','{}'::jsonb) <> '{}'::jsonb
      ) corrected_to_current_version
    from public.question_factory_items q
  ),
  item_stats as (
    select block_id,
      count(*) generated_count,
      count(*) filter(where has_chatgpt_initial) initial_audited_count,
      0::bigint initial_flagged_count,
      count(*) filter(where has_blind_resolution) blind_resolved_count,
      count(*) filter(where has_perplexity) perplexity_audited_count,
      count(*) filter(where current_perplexity_status in ('needs_revision','rejected') or current_agreement in ('partially_agree','disagree')) perplexity_flagged_count,
      count(*) filter(where current_agreement is not null) adjudicated_count,
      count(*) filter(where corrected_to_current_version) corrected_count,
      count(*) filter(where current_perplexity_stage='perplexity_reaudit') reaudit_count,
      count(*) filter(
        where coalesce(
          current_perplexity_status='approved'
          and (
            current_perplexity_stage='perplexity_reaudit'
            or (current_perplexity_stage='perplexity_initial' and current_agreement='agree')
          ),
          false
        )
      ) machine_approved_count,
      count(*) filter(
        where not coalesce(
          current_perplexity_status='approved'
          and (
            current_perplexity_stage='perplexity_reaudit'
            or (current_perplexity_stage='perplexity_initial' and current_agreement='agree')
          ),
          false
        )
      ) machine_pending_count
    from item_base
    group by block_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'batch_number',b.batch_number,'batch_code',b.batch_code,
    'block_number',b.block_number,'block_code',b.block_code,'target_size',b.target_size,
    'generated_count',coalesce(s.generated_count,0),
    'initial_audited_count',coalesce(s.initial_audited_count,0),
    'initial_flagged_count',coalesce(s.initial_flagged_count,0),
    'versioned_count',0,
    'blind_resolved_count',coalesce(s.blind_resolved_count,0),
    'perplexity_audited_count',coalesce(s.perplexity_audited_count,0),
    'perplexity_flagged_count',coalesce(s.perplexity_flagged_count,0),
    'adjudicated_count',coalesce(s.adjudicated_count,0),
    'corrected_count',coalesce(s.corrected_count,0),
    'reaudit_count',coalesce(s.reaudit_count,0),
    'reaudit_reviews_total',coalesce(s.reaudit_count,0),
    'reaudit_questions_total',coalesce(s.reaudit_count,0),
    'machine_approved_count',coalesce(s.machine_approved_count,0),
    'machine_pending_count',coalesce(s.machine_pending_count,0),
    'human_review_status',b.human_review_status
  ) order by b.batch_number,b.block_number),'[]'::jsonb)
  into result
  from blocks b
  left join item_stats s on s.block_id=b.block_id;

  return result;
end
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
      coalesce(b.batch_code,'L'||lpad(b.batch_number::text,3,'0')) as batch_code,
      b.automation_mode,
      bl.id as block_id,
      coalesce(
        bl.block_code,
        coalesce(b.batch_code,'L'||lpad(b.batch_number::text,3,'0'))
          ||'-B'||lpad(bl.block_number::text,2,'0')
      ) as block_code,
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
      coalesce((
        select q.exam_style
        from public.question_factory_items q
        where q.block_id=bl.id
          and nullif(q.exam_style,'') is not null
        group by q.exam_style
        order by count(*) desc,q.exam_style
        limit 1
      ),b.exam_style) as exam_style
    from public.question_factory_blocks bl
    join public.question_factory_batches b on b.id=bl.batch_id
  ),
  item_state as (
    select
      q.id as item_id,
      q.block_id,
      q.version,
      q.latest_review_stage,
      pr.review_stage as perplexity_stage,
      pr.review_status as perplexity_status,
      pr.chatgpt_agreement_status as agreement_status,
      coalesce(pr.raw_payload->'adjudication'->'approved_patch','{}'::jsonb) as approved_patch,
      exists(
        select 1
        from public.question_factory_reviews r
        where r.item_id=q.id
          and r.item_version=q.version
          and r.review_stage='blind_resolution'
          and r.reviewer='Perplexity'
      ) as has_blind
    from public.question_factory_items q
    left join lateral (
      select r.*
      from public.question_factory_reviews r
      where r.item_id=q.id
        and r.item_version=q.version
        and r.review_stage in ('perplexity_initial','perplexity_reaudit')
        and r.reviewer='Perplexity'
      order by
        case r.review_stage when 'perplexity_reaudit' then 2 else 1 end desc,
        r.created_at desc,
        r.id desc
      limit 1
    ) pr on true
  ),
  item_stats as (
    select
      block_id,
      count(*) as question_count,
      count(*) filter (where has_blind) as blind_seen_count,
      count(*) filter (where perplexity_stage is not null) as perplexity_seen_count,
      count(*) filter (
        where (
          perplexity_stage='perplexity_initial'
          and agreement_status is null
        ) or (
          perplexity_stage='perplexity_reaudit'
          and perplexity_status in ('needs_revision','rejected')
          and agreement_status is null
        )
      ) as adjudication_pending_count,
      count(*) filter (
        where (
          perplexity_stage='perplexity_initial'
          and agreement_status is not null
        ) or (
          perplexity_stage='perplexity_reaudit'
          and perplexity_status in ('needs_revision','rejected')
          and agreement_status is not null
        )
      ) as adjudicated_count,
      count(*) filter (where agreement_status='disagree') as disagreement_count,
      count(*) filter (
        where agreement_status in ('agree','partially_agree')
          and approved_patch <> '{}'::jsonb
      ) as correction_pending_count,
      count(*) filter (where latest_review_stage='chatgpt_correction_review') as corrected_count,
      count(*) filter (where perplexity_stage='perplexity_reaudit') as valid_reaudit_count,
      count(*) filter (
        where latest_review_stage='chatgpt_correction_review'
          and perplexity_stage is distinct from 'perplexity_reaudit'
      ) as corrected_waiting_reaudit_count,
      count(*) filter (
        where (
          perplexity_stage='perplexity_initial'
          and perplexity_status='approved'
          and agreement_status='agree'
          and approved_patch='{}'::jsonb
        ) or (
          perplexity_stage='perplexity_reaudit'
          and perplexity_status='approved'
        )
      ) as machine_approved_count,
      max(latest_review_stage) filter (where latest_review_stage is not null) as any_latest_review_stage
    from item_state
    group by block_id
  ),
  enriched as (
    select
      bb.*,
      coalesce(s.question_count,0) as question_count,
      coalesce(s.blind_seen_count,0) as blind_seen_count,
      coalesce(s.perplexity_seen_count,0) as perplexity_seen_count,
      coalesce(s.adjudication_pending_count,0) as adjudication_pending_count,
      coalesce(s.adjudicated_count,0) as adjudicated_count,
      coalesce(s.disagreement_count,0) as disagreement_count,
      coalesce(s.correction_pending_count,0) as correction_pending_count,
      coalesce(s.corrected_count,0) as corrected_count,
      coalesce(s.valid_reaudit_count,0) as valid_reaudit_count,
      coalesce(s.corrected_waiting_reaudit_count,0) as corrected_waiting_reaudit_count,
      coalesce(s.machine_approved_count,0) as machine_approved_count,
      s.any_latest_review_stage as latest_review_stage,
      p.style_score as profile_style_score,
      p.style_confidence_score as profile_confidence_score,
      case
        when coalesce(s.question_count,0) < coalesce(bb.target_size,200)
          then 'generation'
        when bb.chatgpt_review_status is null
          or bb.chatgpt_review_status='needs_revision'
          then 'chatgpt_initial'
        when coalesce(s.perplexity_seen_count,0) < coalesce(bb.target_size,200)
          then 'perplexity_initial'
        when coalesce(s.adjudication_pending_count,0) > 0
          then 'chatgpt_adjudication'
        when coalesce(s.correction_pending_count,0) > 0
          then 'chatgpt_correction'
        when coalesce(s.corrected_waiting_reaudit_count,0) > 0
          then 'perplexity_reaudit'
        when coalesce(s.disagreement_count,0) > 0
          then 'perplexity_reaudit'
        when coalesce(s.machine_approved_count,0) < coalesce(bb.target_size,200)
          then 'perplexity_reaudit'
        when bb.human_review_status is distinct from 'approved'
          then 'human_review'
        else 'block_complete'
      end as next_stage
    from block_base bb
    left join item_stats s on s.block_id=bb.block_id
    left join public.question_exam_style_profiles p on p.exam_style=bb.exam_style
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'batch_number',batch_number,
        'batch_code',batch_code,
        'automation_mode',automation_mode,
        'block_number',block_number,
        'block_code',block_code,
        'question_count',question_count,
        'target_size',target_size,
        'exam_style',exam_style,
        'status',status,
        'chatgpt_review_status',chatgpt_review_status,
        'perplexity_review_status',perplexity_review_status,
        'human_review_status',human_review_status,
        'blind_seen_count',blind_seen_count,
        'perplexity_seen_count',perplexity_seen_count,
        'adjudication_pending_count',adjudication_pending_count,
        'adjudicated_count',adjudicated_count,
        'adjudication_disagree_count',disagreement_count,
        'correction_pending_count',correction_pending_count,
        'corrected_count',corrected_count,
        'valid_reaudit_count',valid_reaudit_count,
        'pending_reaudit_count',corrected_waiting_reaudit_count + disagreement_count,
        'machine_approved_count',machine_approved_count,
        'latest_review_stage',latest_review_stage,
        'phase',case
          when next_stage='generation' then 'Geração'
          when next_stage='chatgpt_initial' then 'Revisão ChatGPT'
          when next_stage='perplexity_initial' then 'Auditoria Perplexity'
          when next_stage='chatgpt_adjudication' then 'Adjudicação ChatGPT'
          when next_stage='chatgpt_correction' then 'Correção ChatGPT'
          when next_stage='perplexity_reaudit' then 'Reauditoria Perplexity'
          when next_stage='human_review' then 'Aprovação humana'
          when next_stage='block_complete' then 'No lote'
          else 'Fluxo'
        end,
        'next_stage',next_stage,
        'next_provider',case
          when next_stage in ('perplexity_initial','perplexity_reaudit') then 'perplexity'
          when next_stage in ('generation','chatgpt_initial','chatgpt_adjudication','chatgpt_correction') then 'chatgpt'
          else null
        end,
        'style_score',coalesce(style_score,profile_style_score),
        'reliability_score',coalesce(reliability_score,profile_confidence_score),
        'style_score_note',style_score_note,
        'style_score_updated_at',style_score_updated_at
      )
      order by batch_number,block_number
    ),
    '[]'::jsonb
  )
  into result
  from enriched;

  return result;
end
$function$;

revoke all on function public.admin_question_factory_review_coverage(integer,integer,text,text,integer,integer) from public,anon;
grant execute on function public.admin_question_factory_review_coverage(integer,integer,text,text,integer,integer) to authenticated,service_role;

revoke all on function public.admin_question_factory_next_perplexity_item(integer,integer,integer,integer,text) from public,anon;
grant execute on function public.admin_question_factory_next_perplexity_item(integer,integer,integer,integer,text) to authenticated,service_role;

commit;
