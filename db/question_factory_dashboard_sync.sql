-- Question Factory — dashboard sync
-- Keeps each board dashboard card synchronized with live calibration state.
-- Applied live to Supabase on 2026-09-23.

create or replace function public.admin_question_factory_style_snapshot()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
      count(*) filter (
        where q.status in ('generated','review_1','review_2','review_3','needs_revision','ready','published')
           or q.block_review_status is not null
      ) as generated,
      count(*) filter (
        where q.block_review_status is not null
          and q.block_review_status <> ''
      ) as perplexity_seen,
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
      'prompt_calibration',p.prompt_calibration,
      'primary_style_evidence',p.primary_style_evidence,
      'calibrated_at',p.calibrated_at,
      'updated_at',p.updated_at,
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
