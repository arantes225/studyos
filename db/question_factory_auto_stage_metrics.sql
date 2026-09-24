-- Controlled automatic telemetry persistence for AI agents with authorized Supabase SQL access.
create schema if not exists private;

alter table public.question_factory_stage_metrics
  add column if not exists event_key text;

create unique index if not exists qf_stage_metrics_event_key_uidx
  on public.question_factory_stage_metrics(event_key)
  where event_key is not null;

create or replace function private.qf_record_stage_metrics(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  m jsonb := case
    when jsonb_typeof(p_payload->'stage_metrics')='object' then p_payload->'stage_metrics'
    else p_payload
  end;
  v_exam_style text;
  v_stage text;
  v_provider text;
  v_status text;
  v_event_key text;
  v_batch integer;
  v_block integer;
  v_total integer;
  v_approved integer;
  v_revision integer;
  v_rejected integer;
  v_hard integer;
  v_agreement integer;
  v_score numeric;
  v_id uuid;
begin
  if m is null or jsonb_typeof(m) <> 'object' then
    raise exception 'stage_metrics deve ser um objeto JSON';
  end if;

  v_exam_style := nullif(btrim(m->>'exam_style'),'');
  v_stage := nullif(btrim(m->>'stage'),'');
  v_provider := nullif(btrim(m->>'provider'),'');
  v_status := nullif(btrim(m->>'status'),'');
  v_batch := nullif(m->>'batch_number','')::integer;
  v_block := nullif(m->>'block_number','')::integer;
  v_total := coalesce(nullif(m->>'total_count','')::integer,0);
  v_approved := coalesce(nullif(m->>'approved_count','')::integer,0);
  v_revision := coalesce(nullif(m->>'needs_revision_count','')::integer,0);
  v_rejected := coalesce(nullif(m->>'rejected_count','')::integer,0);
  v_hard := coalesce(nullif(m->>'hard_reject_count','')::integer,0);
  v_agreement := coalesce(nullif(m->>'agreement_count','')::integer,0);
  v_score := nullif(m->>'score','')::numeric;

  if v_exam_style is null then raise exception 'exam_style obrigatório'; end if;
  if v_stage is null then raise exception 'stage obrigatório'; end if;

  if not exists (
    select 1 from public.question_exam_style_profiles p
    where p.exam_style=v_exam_style
  ) then
    raise exception 'Banca inválida: %', v_exam_style;
  end if;

  if v_provider is not null and v_provider not in ('ChatGPT','Perplexity','Gemini','Human','System') then
    raise exception 'provider inválido: %', v_provider;
  end if;

  if v_stage !~ '^[a-z0-9_:-]{2,80}$' then
    raise exception 'stage inválido: %', v_stage;
  end if;

  if v_batch is not null and v_batch < 1 then raise exception 'batch_number inválido'; end if;
  if v_block is not null and v_block < 1 then raise exception 'block_number inválido'; end if;

  if least(v_total,v_approved,v_revision,v_rejected,v_hard,v_agreement) < 0 then
    raise exception 'contagens não podem ser negativas';
  end if;

  if v_approved + v_revision + v_rejected > v_total then
    raise exception 'approved + needs_revision + rejected não pode exceder total_count';
  end if;

  if v_hard > v_total or v_agreement > v_total then
    raise exception 'hard_reject_count/agreement_count não pode exceder total_count';
  end if;

  if v_score is not null and (v_score < 0 or v_score > 100) then
    raise exception 'score deve estar entre 0 e 100';
  end if;

  v_event_key := nullif(btrim(m->>'event_key'),'');
  if v_event_key is null then
    v_event_key := concat_ws(':',
      'qf',
      lower(regexp_replace(v_exam_style,'[^a-zA-Z0-9]+','-','g')),
      coalesce(v_batch::text,'na'),
      coalesce(v_block::text,'na'),
      v_stage,
      coalesce(nullif(btrim(m->>'run_label'),''), md5(m::text))
    );
  end if;

  insert into public.question_factory_stage_metrics(
    event_key, exam_style,batch_number,block_number,stage,provider,run_label,
    total_count,approved_count,needs_revision_count,rejected_count,
    hard_reject_count,agreement_count,score,status,metrics,notes
  )
  values(
    v_event_key,
    v_exam_style,v_batch,v_block,v_stage,v_provider,m->>'run_label',
    v_total,v_approved,v_revision,v_rejected,
    v_hard,v_agreement,v_score,v_status,
    coalesce(m->'metrics','{}'::jsonb),m->>'notes'
  )
  on conflict (event_key) where event_key is not null
  do update set
    exam_style=excluded.exam_style,
    batch_number=excluded.batch_number,
    block_number=excluded.block_number,
    stage=excluded.stage,
    provider=excluded.provider,
    run_label=excluded.run_label,
    total_count=excluded.total_count,
    approved_count=excluded.approved_count,
    needs_revision_count=excluded.needs_revision_count,
    rejected_count=excluded.rejected_count,
    hard_reject_count=excluded.hard_reject_count,
    agreement_count=excluded.agreement_count,
    score=excluded.score,
    status=excluded.status,
    metrics=excluded.metrics,
    notes=excluded.notes
  returning id into v_id;

  update public.question_exam_style_profiles
  set updated_at=now()
  where exam_style=v_exam_style;

  return jsonb_build_object(
    'stored',true,
    'id',v_id,
    'event_key',v_event_key,
    'exam_style',v_exam_style,
    'stage',v_stage,
    'status',v_status
  );
end;
$function$;

revoke all on function private.qf_record_stage_metrics(jsonb) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.qf_record_stage_metrics(jsonb) to service_role;

create or replace function public.admin_import_question_factory_stage_metrics(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not public.is_admin_session() then
    raise exception 'admin access required' using errcode='42501';
  end if;

  return private.qf_record_stage_metrics(p_payload);
end;
$function$;

revoke all on function public.admin_import_question_factory_stage_metrics(jsonb) from public, anon, authenticated;
grant execute on function public.admin_import_question_factory_stage_metrics(jsonb) to authenticated;
