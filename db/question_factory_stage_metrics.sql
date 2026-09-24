-- Question Factory stage telemetry
-- Every AI stage returns top-level stage_metrics; the Admin importer persists it here.

create table if not exists public.question_factory_stage_metrics (
  id uuid primary key default gen_random_uuid(),
  exam_style text not null references public.question_exam_style_profiles(exam_style) on update cascade on delete restrict,
  batch_number integer,
  block_number integer,
  stage text not null,
  provider text,
  run_label text,
  total_count integer not null default 0,
  approved_count integer not null default 0,
  needs_revision_count integer not null default 0,
  rejected_count integer not null default 0,
  hard_reject_count integer not null default 0,
  agreement_count integer not null default 0,
  score numeric,
  status text,
  metrics jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.question_factory_stage_metrics enable row level security;
revoke all on public.question_factory_stage_metrics from anon, authenticated;

create index if not exists qf_stage_metrics_exam_style_idx
  on public.question_factory_stage_metrics(exam_style, created_at desc);
create index if not exists qf_stage_metrics_batch_block_idx
  on public.question_factory_stage_metrics(batch_number, block_number, created_at desc);

create or replace function public.admin_import_question_factory_stage_metrics(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  m jsonb := p_payload->'stage_metrics';
  v_exam_style text := coalesce(m->>'exam_style', p_payload->>'exam_style');
  v_stage text := coalesce(m->>'stage', p_payload->>'review_stage', 'unknown');
  v_provider text := coalesce(m->>'provider', p_payload->>'reviewer');
  v_id uuid;
begin
  if not public.is_admin_session() then
    raise exception 'admin access required' using errcode='42501';
  end if;

  if m is null or jsonb_typeof(m) <> 'object' then
    return jsonb_build_object('stored',false,'reason','stage_metrics_missing');
  end if;

  if nullif(v_exam_style,'') is null then
    raise exception 'stage_metrics.exam_style obrigatório';
  end if;

  if not exists(select 1 from public.question_exam_style_profiles p where p.exam_style=v_exam_style) then
    raise exception 'Banca inválida em stage_metrics: %', v_exam_style;
  end if;

  insert into public.question_factory_stage_metrics(
    exam_style,batch_number,block_number,stage,provider,run_label,
    total_count,approved_count,needs_revision_count,rejected_count,
    hard_reject_count,agreement_count,score,status,metrics,notes
  )
  values(
    v_exam_style,
    nullif(coalesce(m->>'batch_number',p_payload->>'batch_number'),'')::integer,
    nullif(coalesce(m->>'block_number',p_payload->>'block_number'),'')::integer,
    v_stage,
    v_provider,
    m->>'run_label',
    coalesce(nullif(m->>'total_count','')::integer,0),
    coalesce(nullif(m->>'approved_count','')::integer,0),
    coalesce(nullif(m->>'needs_revision_count','')::integer,0),
    coalesce(nullif(m->>'rejected_count','')::integer,0),
    coalesce(nullif(m->>'hard_reject_count','')::integer,0),
    coalesce(nullif(m->>'agreement_count','')::integer,0),
    nullif(m->>'score','')::numeric,
    m->>'status',
    coalesce(m->'metrics','{}'::jsonb),
    m->>'notes'
  )
  returning id into v_id;

  update public.question_exam_style_profiles
  set updated_at=now()
  where exam_style=v_exam_style;

  return jsonb_build_object('stored',true,'id',v_id,'exam_style',v_exam_style,'stage',v_stage);
end;
$function$;

revoke all on function public.admin_import_question_factory_stage_metrics(jsonb) from public, anon, authenticated;
grant execute on function public.admin_import_question_factory_stage_metrics(jsonb) to authenticated;
