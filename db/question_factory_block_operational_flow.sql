-- Operational metrics for the fixed per-block question factory workflow.
-- Flow: generation -> ChatGPT adversarial+autocorrection -> Perplexity blind+audit
-- -> ChatGPT adjudication+correction -> Perplexity reaudit -> human approval.

create or replace function public.admin_question_factory_block_flow_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if not public.is_admin_session() then
    raise exception 'admin access required' using errcode='42501';
  end if;

  with blocks as (
    select
      b.batch_number,
      coalesce(b.batch_code,'L'||lpad(b.batch_number::text,3,'0')) batch_code,
      bl.id block_id,
      bl.block_number,
      coalesce(bl.block_code,coalesce(b.batch_code,'L'||lpad(b.batch_number::text,3,'0'))||'-B'||lpad(bl.block_number::text,2,'0')) block_code,
      bl.target_size,
      bl.human_review_status
    from public.question_factory_blocks bl
    join public.question_factory_batches b on b.id=bl.batch_id
  ),
  item_base as (
    select
      q as qrow,
      q.block_id,
      q.latest_review_stage,
      q.version,
      exists(
        select 1 from public.question_factory_reviews r
        where r.item_id=q.id and r.review_stage='chatgpt_initial'
      ) has_chatgpt_initial,
      (
        select r.review_status
        from public.question_factory_reviews r
        where r.item_id=q.id and r.review_stage='chatgpt_initial'
        order by r.created_at desc,r.id desc limit 1
      ) initial_status,
      exists(
        select 1 from public.question_factory_reviews r
        where r.item_id=q.id and r.item_version=q.version and r.review_stage='blind_resolution'
      ) current_blind,
      exists(
        select 1 from public.question_factory_reviews r
        where r.item_id=q.id and r.item_version=q.version and r.review_stage='perplexity_initial'
      ) current_perplexity_initial,
      (
        select r.review_status
        from public.question_factory_reviews r
        where r.item_id=q.id and r.item_version=q.version
          and r.review_stage in ('perplexity_initial','perplexity_reaudit')
        order by r.created_at desc,r.id desc limit 1
      ) current_perplexity_status,
      exists(
        select 1 from public.question_factory_reviews r
        where r.item_id=q.id and r.item_version=q.version
          and r.review_stage in ('perplexity_initial','perplexity_reaudit')
          and r.chatgpt_agreement_status is not null
      ) current_adjudicated,
      exists(
        select 1 from public.question_factory_reviews r
        where r.item_id=q.id and r.item_version=q.version and r.review_stage='perplexity_reaudit'
      ) current_perplexity_reaudit
    from public.question_factory_items q
  ),
  item_stats as (
    select
      block_id,
      count(*) generated_count,
      count(*) filter(where has_chatgpt_initial) initial_audited_count,
      count(*) filter(where initial_status in ('needs_revision','rejected')) initial_flagged_count,
      count(*) filter(where version>1) versioned_count,
      count(*) filter(where current_blind) blind_resolved_count,
      count(*) filter(where current_perplexity_initial) perplexity_audited_count,
      count(*) filter(where current_perplexity_status in ('needs_revision','rejected')) perplexity_flagged_count,
      count(*) filter(where current_adjudicated) adjudicated_count,
      count(*) filter(where latest_review_stage='chatgpt_correction_review') corrected_count,
      count(*) filter(where current_perplexity_reaudit) reaudit_count,
      count(*) filter(where private.qf_current_approved(qrow)) machine_approved_count,
      count(*) filter(where not private.qf_current_approved(qrow)) machine_pending_count
    from item_base
    group by block_id
  ),
  rr as (
    select
      block_id,
      count(*) reaudit_reviews_total,
      count(distinct question_id) reaudit_questions_total
    from public.question_factory_reviews
    where review_stage='perplexity_reaudit'
    group by block_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'batch_number',b.batch_number,
    'batch_code',b.batch_code,
    'block_number',b.block_number,
    'block_code',b.block_code,
    'target_size',b.target_size,
    'generated_count',coalesce(s.generated_count,0),
    'initial_audited_count',coalesce(s.initial_audited_count,0),
    'initial_flagged_count',coalesce(s.initial_flagged_count,0),
    'versioned_count',coalesce(s.versioned_count,0),
    'blind_resolved_count',coalesce(s.blind_resolved_count,0),
    'perplexity_audited_count',coalesce(s.perplexity_audited_count,0),
    'perplexity_flagged_count',coalesce(s.perplexity_flagged_count,0),
    'adjudicated_count',coalesce(s.adjudicated_count,0),
    'corrected_count',coalesce(s.corrected_count,0),
    'reaudit_count',coalesce(s.reaudit_count,0),
    'reaudit_reviews_total',coalesce(rr.reaudit_reviews_total,0),
    'reaudit_questions_total',coalesce(rr.reaudit_questions_total,0),
    'machine_approved_count',coalesce(s.machine_approved_count,0),
    'machine_pending_count',coalesce(s.machine_pending_count,0),
    'human_review_status',b.human_review_status
  ) order by b.batch_number,b.block_number),'[]'::jsonb)
  into result
  from blocks b
  left join item_stats s on s.block_id=b.block_id
  left join rr on rr.block_id=b.block_id;

  return result;
end
$$;

revoke all on function public.admin_question_factory_block_flow_snapshot() from public;
grant execute on function public.admin_question_factory_block_flow_snapshot() to authenticated;
