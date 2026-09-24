-- Corrige contaminação do status de revisão do Perplexity pela auditoria inicial do ChatGPT.
-- block_review_status / block_review_answer / block_review_notes ficam reservados
-- às etapas reais perplexity_initial / perplexity_reaudit.
--
-- 1) Limpa marcações antigas sem evidência em question_factory_reviews.
-- 2) Ajusta admin_import_question_factory_review(jsonb) para chatgpt_initial
--    não escrever mais nesses campos.

update public.question_factory_items q
set
  block_review_status = null,
  block_review_answer = null,
  block_review_notes = null,
  updated_at = now()
where not exists (
  select 1
  from public.question_factory_reviews r
  where r.item_id = q.id
    and r.item_version = q.version
    and r.review_stage in ('perplexity_initial','perplexity_reaudit')
)
and q.block_review_status is not null;

do $$
declare
  fn text;
begin
  select pg_get_functiondef(p.oid)
    into fn
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_import_question_factory_review'
    and pg_get_function_identity_arguments(p.oid) = 'p_payload jsonb';

  if fn is null then
    raise exception 'admin_import_question_factory_review(jsonb) not found';
  end if;

  fn := replace(
    fn,
    '   if stage=''chatgpt_initial'' then
     update public.question_factory_items
     set latest_review_stage=stage,
         block_review_status=case when r->>''status'' in (''needs_revision'',''rejected'') then r->>''status'' else block_review_status end,
         block_review_notes=case when adv<>''[]''::jsonb then ''Adversarial hard reject: ''||adv::text else r->>''suggested_correction'' end,
         status=case when r->>''status'' in (''needs_revision'',''rejected'') then r->>''status'' else status end,
         updated_at=now()
     where id=q.id;',
    '   if stage=''chatgpt_initial'' then
     update public.question_factory_items
     set latest_review_stage=stage,
         status=case when r->>''status'' in (''needs_revision'',''rejected'') then r->>''status'' else status end,
         updated_at=now()
     where id=q.id;'
  );

  execute fn;
end $$;
