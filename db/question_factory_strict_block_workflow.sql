-- Enforces the per-block operational order using persisted stage evidence.
-- generation -> chatgpt_initial -> blind_resolution/perplexity_initial
-- -> chatgpt adjudication/correction -> blind_resolution/perplexity_reaudit
-- -> human review. The 4 <-> 5 correction loop repeats until current versions pass.

do $$
declare
  fn text;
  old_block text;
  new_block text;
begin
  select pg_get_functiondef(p.oid) into fn
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='admin_question_factory_block_tracker'
    and pg_get_function_identity_arguments(p.oid)='';

  old_block := $old$
      case
        when bb.question_count < coalesce(bb.target_size,200) then 'generation'
        when bb.chatgpt_review_status is null then 'chatgpt_initial'
        when bb.chatgpt_review_status='needs_revision' then 'chatgpt_initial'
        when exists(select 1 from public.question_factory_items q where q.block_id=bb.block_id and q.status in ('needs_revision','rejected')) then
          case
            when exists(
              select 1 from public.question_factory_items q
              join lateral (
                select r.chatgpt_agreement_status
                from public.question_factory_reviews r
                where r.item_id=q.id and r.item_version=q.version
                  and r.review_stage in ('perplexity_initial','perplexity_reaudit','lot_chatgpt_final','lot_perplexity_final','lot_gemini_final')
                order by r.created_at desc,r.id desc limit 1
              ) x on true
              where q.block_id=bb.block_id and q.status in ('needs_revision','rejected')
                and x.chatgpt_agreement_status in ('agree','partially_agree')
            ) then 'chatgpt_correction'
            when exists(
              select 1 from public.question_factory_items q
              join lateral (
                select r.chatgpt_agreement_status
                from public.question_factory_reviews r
                where r.item_id=q.id and r.item_version=q.version
                  and r.review_stage in ('perplexity_initial','perplexity_reaudit','lot_chatgpt_final','lot_perplexity_final','lot_gemini_final')
                order by r.created_at desc,r.id desc limit 1
              ) x on true
              where q.block_id=bb.block_id and q.status in ('needs_revision','rejected')
                and x.chatgpt_agreement_status='disagree'
            ) then 'perplexity_reaudit'
            else 'chatgpt_adjudication'
          end
        when exists(
          select 1 from public.question_factory_items q
          where q.block_id=bb.block_id
            and not exists(
              select 1 from public.question_factory_reviews r
              where r.item_id=q.id and r.item_version=q.version and r.review_stage='blind_resolution'
            )
        ) then 'blind_resolution'
        when exists(select 1 from public.question_factory_items q where q.block_id=bb.block_id and not private.qf_current_approved(q))
          then case when bb.latest_review_stage='chatgpt_correction_review' then 'perplexity_reaudit' else 'perplexity_initial' end
        when bb.human_review_status is distinct from 'approved' then 'human_review'
        else 'block_complete'
      end as next_stage
$old$;

  new_block := $new$
      case
        when bb.question_count < coalesce(bb.target_size,200) then 'generation'
        when bb.chatgpt_review_status is null or bb.chatgpt_review_status='needs_revision' then 'chatgpt_initial'
        when exists(
          select 1
          from public.question_factory_items q
          where q.block_id=bb.block_id
            and not exists(
              select 1 from public.question_factory_reviews r
              where r.item_id=q.id and r.item_version=q.version and r.review_stage='blind_resolution'
            )
        ) then 'blind_resolution'
        when exists(
          select 1
          from public.question_factory_items q
          where q.block_id=bb.block_id
            and q.latest_review_stage='chatgpt_correction_review'
            and not exists(
              select 1 from public.question_factory_reviews r
              where r.item_id=q.id and r.item_version=q.version and r.review_stage='perplexity_reaudit'
            )
        ) then 'perplexity_reaudit'
        when exists(
          select 1
          from public.question_factory_items q
          where q.block_id=bb.block_id
            and q.latest_review_stage is distinct from 'chatgpt_correction_review'
            and not exists(
              select 1 from public.question_factory_reviews r
              where r.item_id=q.id and r.item_version=q.version and r.review_stage='perplexity_initial'
            )
        ) then 'perplexity_initial'
        when exists(
          select 1 from public.question_factory_items q
          where q.block_id=bb.block_id and not private.qf_current_approved(q)
        ) then
          case
            when exists(
              select 1
              from public.question_factory_items q
              join lateral (
                select r.chatgpt_agreement_status
                from public.question_factory_reviews r
                where r.item_id=q.id and r.item_version=q.version
                  and r.review_stage in ('perplexity_initial','perplexity_reaudit')
                order by r.created_at desc,r.id desc limit 1
              ) x on true
              where q.block_id=bb.block_id
                and x.chatgpt_agreement_status in ('agree','partially_agree')
            ) then 'chatgpt_correction'
            when exists(
              select 1
              from public.question_factory_items q
              join lateral (
                select r.chatgpt_agreement_status
                from public.question_factory_reviews r
                where r.item_id=q.id and r.item_version=q.version
                  and r.review_stage in ('perplexity_initial','perplexity_reaudit')
                order by r.created_at desc,r.id desc limit 1
              ) x on true
              where q.block_id=bb.block_id
                and x.chatgpt_agreement_status='disagree'
            ) then 'perplexity_reaudit'
            else 'chatgpt_adjudication'
          end
        when bb.human_review_status is distinct from 'approved' then 'human_review'
        else 'block_complete'
      end as next_stage
$new$;

  if strpos(fn,old_block)=0 then
    raise exception 'expected tracker state-machine block not found';
  end if;
  execute replace(fn,old_block,new_block);
end $$;
