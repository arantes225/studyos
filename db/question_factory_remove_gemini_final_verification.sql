-- Remove a etapa ativa de verificação final pelo Gemini.
-- O histórico/coluna legado pode permanecer para compatibilidade, mas não participa mais do fluxo.

create or replace function public.admin_import_question_factory_lot_review(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  b public.question_factory_batches%rowtype;
  stage text := p_payload->>'review_stage';
  st text := p_payload->>'lote_status';
  manifest jsonb;
  supplied jsonb;
  x jsonb;
  q public.question_factory_items%rowtype;
  k text;
  ids jsonb;
  total int;
  good int;
begin
  if not public.is_admin_session() then raise exception 'admin access required' using errcode='42501'; end if;
  if p_payload->>'schema_version' is distinct from '2.0'
     or coalesce(stage,'') not in ('lot_chatgpt_final','lot_perplexity_final')
     or coalesce(st,'') not in ('approved','needs_revision') then
    raise exception 'Contrato/etapa/status inválido';
  end if;
  if p_payload->>'reviewer' is distinct from (case stage when 'lot_chatgpt_final' then 'ChatGPT' else 'Perplexity' end) then
    raise exception 'Revisor incorreto';
  end if;

  select * into b from public.question_factory_batches
  where batch_number=(p_payload->>'batch_number')::int for update;
  if b.id is null or b.status='published' then raise exception 'Lote inválido/publicado'; end if;
  if (select count(*) from public.question_factory_blocks where batch_id=b.id and status='merged')<>5 then
    raise exception 'Exige cinco blocos aprovados pelo administrador';
  end if;

  manifest:=private.qf_manifest(b.id);
  if jsonb_typeof(p_payload->'version_manifest') is distinct from 'array' then raise exception 'Manifesto obrigatório'; end if;
  select jsonb_agg(v order by v->>'question_id') into supplied from jsonb_array_elements(p_payload->'version_manifest') v;
  if supplied is distinct from manifest or jsonb_array_length(manifest)<>1000 then raise exception 'Manifesto incompleto/desatualizado'; end if;
  if jsonb_typeof(p_payload->'questions_flagged') is distinct from 'array' then raise exception 'questions_flagged obrigatório'; end if;

  if st='approved' then
    foreach k in array array[
      'questions_flagged','duplicate_clusters','duplicate_or_near_duplicate','answer_source_problems',
      'answer_key_disagreements','outdated_sources','guideline_conflicts','coverage_gaps','style_problems',
      'difficulty_findings','high_risk_rechecks','questions_to_recheck','editorial_issues','findings'
    ] loop
      if p_payload ? k and p_payload->k not in ('[]'::jsonb,'null'::jsonb) then
        raise exception 'Achados pendentes impedem aprovação: %',k;
      end if;
    end loop;

    if jsonb_typeof(p_payload->'coverage'->'global_reviewed_ids') is distinct from 'array' then raise exception 'Cobertura global obrigatória'; end if;
    select jsonb_agg(v order by v) into ids from jsonb_array_elements(p_payload->'coverage'->'global_reviewed_ids') v;
    if ids is distinct from (
      select jsonb_agg(v->'question_id' order by v->>'question_id') from jsonb_array_elements(manifest) v
    ) then raise exception 'Cobertura global deve conter exatamente as 1000 questões'; end if;

    if p_payload->'coverage'->'all_high_risk_rechecked' is distinct from 'true'::jsonb
       or nullif(btrim(p_payload->'coverage'->>'sampling_method'),'') is null
       or jsonb_typeof(p_payload->'coverage'->'scientific_rechecked_ids') is distinct from 'array' then
      raise exception 'Cobertura científica incompleta';
    end if;

    select count(*),count(distinct v) into total,good
    from jsonb_array_elements_text(p_payload->'coverage'->'scientific_rechecked_ids') v;
    if total<>good or exists(
      select 1 from jsonb_array_elements_text(p_payload->'coverage'->'scientific_rechecked_ids') v
      where not exists(select 1 from public.question_factory_items qi where qi.batch_id=b.id and qi.question_id=v)
    ) then raise exception 'IDs de rechecagem inválidos'; end if;
    if total<>1000 then raise exception 'Sem classificação estruturada de risco, rechecagem científica deve cobrir as 1000 questões'; end if;
    if exists(select 1 from public.question_factory_items qi where qi.batch_id=b.id and not private.qf_current_approved(qi)) then
      raise exception 'Há questões sem aprovação atual válida';
    end if;
  else
    for x in select value from jsonb_array_elements(p_payload->'questions_flagged') loop
      select * into q from public.question_factory_items
      where batch_id=b.id and question_id=x->>'question_id' for update;
      if q.id is null or q.version is distinct from (x->>'item_version')::int or nullif(btrim(x->>'reason'),'') is null then
        raise exception 'Achado precisa de ID, versão atual e motivo';
      end if;
      insert into public.question_factory_reviews(
        item_id,block_id,batch_id,question_id,item_version,review_stage,reviewer,review_status,
        suggested_correction,raw_payload,proposed_change
      ) values(
        q.id,q.block_id,b.id,q.question_id,q.version,stage,p_payload->>'reviewer','needs_revision',
        x->>'reason',x,x->'proposed_change'
      );
      update public.question_factory_items
      set status='needs_revision',block_review_status='needs_revision',latest_review_stage=stage
      where id=q.id;
      update public.question_factory_blocks set status='needs_revision',human_review_status=null where id=q.block_id;
    end loop;
    perform private.qf_invalidate_lot(b.id);
  end if;

  update public.question_factory_batches
  set final_review_chatgpt_status=case when stage='lot_chatgpt_final' then st else final_review_chatgpt_status end,
      final_review_perplexity_status=case when stage='lot_perplexity_final' then st else final_review_perplexity_status end,
      final_review_gemini_status=null,
      final_human_review_status='pending',
      final_review_receipts=final_review_receipts||jsonb_build_object(stage,p_payload),
      status='reviewing',
      updated_at=now()
  where id=b.id;

  return jsonb_build_object('ready',false,'review_stage',stage,'lote_status',st,'next_stage','remaining_reviews_or_human_approval');
end
$function$;

create or replace function public.admin_approve_question_factory_lot(p_batch_number integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  b public.question_factory_batches%rowtype;
  manifest jsonb;
  k text;
  supplied jsonb;
begin
  if not public.is_admin_session() then raise exception 'admin access required' using errcode='42501'; end if;
  select * into b from public.question_factory_batches where batch_number=p_batch_number for update;

  if b.id is null or b.status='published'
     or b.final_review_chatgpt_status is distinct from 'approved'
     or b.final_review_perplexity_status is distinct from 'approved' then
    raise exception 'Duas revisões finais aprovadas são obrigatórias';
  end if;

  manifest:=private.qf_manifest(b.id);
  if jsonb_array_length(manifest)<>1000
     or (select count(*) from public.question_factory_blocks where batch_id=b.id and status='merged' and human_review_status='approved')<>5 then
    raise exception 'Lote incompleto';
  end if;
  if exists(select 1 from public.question_factory_items qi where qi.batch_id=b.id and not private.qf_current_approved(qi)) then
    raise exception 'Questão pendente ou versão não aprovada';
  end if;

  foreach k in array array['lot_chatgpt_final','lot_perplexity_final'] loop
    select jsonb_agg(v order by v->>'question_id') into supplied
    from jsonb_array_elements(b.final_review_receipts->k->'version_manifest') v;
    if supplied is distinct from manifest then raise exception 'Revisão final desatualizada: %',k; end if;
  end loop;

  update public.question_factory_batches
  set status='ready',final_human_review_status='approved',final_review_gemini_status=null,updated_at=now()
  where id=b.id;
  update public.question_factory_items set status='ready',updated_at=now() where batch_id=b.id;

  return jsonb_build_object('ready',true);
end
$function$;
