-- Importadores por etapa da Fábrica de Questões LURIA 3.1
-- Aplicado ao Supabase em 2026-09-24.
-- Mantém RPCs específicos por etapa e um roteador único para o Admin.
-- Todos exigem sessão Admin; anon/PUBLIC não recebem EXECUTE.

begin;

create unique index if not exists question_factory_items_question_id_uidx
on public.question_factory_items(question_id);

create unique index if not exists question_factory_items_block_sequence_uidx
on public.question_factory_items(block_id, block_sequence_no)
where block_sequence_no is not null;

CREATE OR REPLACE FUNCTION public.admin_import_question_factory_blind_resolution(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin_session() then raise exception 'admin access required' using errcode='42501'; end if;
  if p_payload->>'review_stage' is distinct from 'blind_resolution' then raise exception 'review_stage deve ser blind_resolution'; end if;
  return public.admin_import_question_factory_review(p_payload);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_import_question_factory_chatgpt_adjudication(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin_session() then raise exception 'admin access required' using errcode='42501'; end if;
  if p_payload->>'review_stage' is distinct from 'chatgpt_adjudication' then raise exception 'review_stage deve ser chatgpt_adjudication'; end if;
  return public.admin_import_question_factory_adjudication(p_payload);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_import_question_factory_chatgpt_correction(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin_session() then raise exception 'admin access required' using errcode='42501'; end if;
  if p_payload->>'review_stage' is distinct from 'chatgpt_correction_review' then raise exception 'review_stage deve ser chatgpt_correction_review'; end if;
  return public.admin_import_question_factory_corrections(p_payload);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_import_question_factory_chatgpt_initial(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin_session() then raise exception 'admin access required' using errcode='42501'; end if;
  if p_payload->>'review_stage' is distinct from 'chatgpt_initial' then raise exception 'review_stage deve ser chatgpt_initial'; end if;
  if p_payload ? 'initial_reviews' then
    return public.admin_import_question_factory_chatgpt_autocorrection(p_payload);
  end if;
  return public.admin_import_question_factory_review(p_payload);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_import_question_factory_generation(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_batch_number int := coalesce(nullif(p_payload->>'batch_number','')::int, nullif(p_payload->'batch'->>'batch_number','')::int);
  v_block_number int := coalesce(nullif(p_payload->>'block_number','')::int, nullif(p_payload->'batch'->>'block_number','')::int);
  v_exam_style text := coalesce(nullif(p_payload->>'exam_style',''), nullif(p_payload->'batch'->>'exam_style',''));
  v_batch_id uuid;
  v_block_id uuid;
  v_batch_code text;
  v_block_code text;
  v_batch_style text;
  v_target_size int;
  v_q jsonb;
  v_existing public.question_factory_items%rowtype;
  v_count int;
  v_inserted int := 0;
  v_skipped int := 0;
  v_received int := 0;
  v_expected_sequence int;
  v_required text;
  v_complete boolean := false;
  v_total_after int := 0;
  v_min_block_seq int;
  v_max_block_seq int;
  v_min_global_seq int;
  v_max_global_seq int;
begin
  if not public.is_admin_session() then
    raise exception 'admin access required' using errcode='42501';
  end if;

  if p_payload->>'schema_version' is distinct from '2.0' then
    raise exception 'schema_version deve ser 2.0';
  end if;

  if v_batch_number is null or v_block_number is null then
    raise exception 'batch_number e block_number são obrigatórios';
  end if;

  if jsonb_typeof(p_payload->'questions') is distinct from 'array'
     or jsonb_array_length(p_payload->'questions') = 0 then
    raise exception 'questions deve ser array não vazio';
  end if;

  if jsonb_array_length(p_payload->'questions') > 200 then
    raise exception 'Uma importação de geração não pode conter mais de 200 questões';
  end if;

  select b.id,b.batch_code,b.exam_style,bl.id,bl.block_code,bl.target_size
  into v_batch_id,v_batch_code,v_batch_style,v_block_id,v_block_code,v_target_size
  from public.question_factory_batches b
  join public.question_factory_blocks bl on bl.batch_id=b.id
  where b.batch_number=v_batch_number
    and bl.block_number=v_block_number
  for update of b,bl;

  if v_block_id is null then
    raise exception 'Lote/bloco não encontrado';
  end if;

  if exists(select 1 from public.question_factory_batches where id=v_batch_id and status='published') then
    raise exception 'Lote publicado é imutável';
  end if;

  if v_target_size is distinct from 200 then
    raise exception 'Bloco com target_size inesperado: %',v_target_size;
  end if;

  if v_exam_style is null then
    v_exam_style := v_batch_style;
  end if;

  if upper(v_exam_style) is distinct from upper(v_batch_style) then
    raise exception 'Banca do payload (%) difere da banca do lote (%)',v_exam_style,v_batch_style;
  end if;

  if exists(
    select 1
    from public.question_factory_reviews r
    where r.block_id=v_block_id
  ) then
    raise exception 'Geração bloqueada: este bloco já possui registros de revisão';
  end if;

  if (select count(*) <> count(distinct x->>'question_id') from jsonb_array_elements(p_payload->'questions') x) then
    raise exception 'question_id repetido ou ausente no payload';
  end if;

  if (select count(*) <> count(distinct x->>'question_code') from jsonb_array_elements(p_payload->'questions') x) then
    raise exception 'question_code repetido ou ausente no payload';
  end if;

  if (select count(*) <> count(distinct (x->>'block_sequence_no')::int) from jsonb_array_elements(p_payload->'questions') x) then
    raise exception 'block_sequence_no repetido ou ausente no payload';
  end if;

  if (select count(*) <> count(distinct (x->>'sequence_no')::int) from jsonb_array_elements(p_payload->'questions') x) then
    raise exception 'sequence_no repetido ou ausente no payload';
  end if;

  for v_q in select value from jsonb_array_elements(p_payload->'questions')
  loop
    v_received := v_received + 1;

    foreach v_required in array array[
      'question_id','question_code','enunciado',
      'alternativa_a','alternativa_b','alternativa_c','alternativa_d',
      'gabarito',
      'explicacao_a','explicacao_b','explicacao_c','explicacao_d',
      'mensagem_chave','area','tema','subtema','dificuldade',
      'fonte_instituicao','fonte_documento','fonte_ano','fonte_url',
      'answer_source_institution','answer_source_document','answer_source_year',
      'answer_source_url','answer_source_section','answer_source_note'
    ]
    loop
      if nullif(btrim(v_q->>v_required),'') is null then
        raise exception 'Campo obrigatório vazio em %: %',coalesce(v_q->>'question_code',v_q->>'question_id'),v_required;
      end if;
    end loop;

    if v_q->>'gabarito' not in ('A','B','C','D') then
      raise exception 'Gabarito inválido em %',v_q->>'question_code';
    end if;

    if coalesce((v_q->>'version')::int,1) <> 1 then
      raise exception 'Questão nova deve iniciar em version=1: %',v_q->>'question_code';
    end if;

    if coalesce(v_q->>'status','generated') <> 'generated' then
      raise exception 'Questão nova deve ter status=generated: %',v_q->>'question_code';
    end if;

    if coalesce(nullif(v_q->>'exam_style',''),v_exam_style) is distinct from v_exam_style then
      raise exception 'exam_style divergente em %',v_q->>'question_code';
    end if;

    if (v_q->>'block_sequence_no')::int < 1 or (v_q->>'block_sequence_no')::int > 200 then
      raise exception 'block_sequence_no fora de 1..200 em %',v_q->>'question_code';
    end if;

    v_expected_sequence := ((v_block_number-1)*200) + (v_q->>'block_sequence_no')::int;
    if (v_q->>'sequence_no')::int is distinct from v_expected_sequence then
      raise exception 'sequence_no inválido em %: esperado %, recebido %',
        v_q->>'question_code',v_expected_sequence,(v_q->>'sequence_no')::int;
    end if;

    if v_q->>'fonte_url' !~ '^https?://' or v_q->>'answer_source_url' !~ '^https?://' then
      raise exception 'URL de fonte inválida em %',v_q->>'question_code';
    end if;

    select * into v_existing
    from public.question_factory_items
    where question_id=v_q->>'question_id'
       or (batch_id=v_batch_id and question_code=v_q->>'question_code')
       or (batch_id=v_batch_id and sequence_no=(v_q->>'sequence_no')::int)
       or (block_id=v_block_id and block_sequence_no=(v_q->>'block_sequence_no')::int)
    order by case when question_id=v_q->>'question_id' then 0 else 1 end
    limit 1
    for update;

    if v_existing.id is not null then
      if v_existing.question_id = v_q->>'question_id'
         and v_existing.batch_id = v_batch_id
         and v_existing.block_id = v_block_id
         and v_existing.question_code = v_q->>'question_code'
         and v_existing.sequence_no = (v_q->>'sequence_no')::int
         and v_existing.block_sequence_no = (v_q->>'block_sequence_no')::int
         and v_existing.version = 1
         and v_existing.status = 'generated'
         and v_existing.exam_style = v_exam_style
         and v_existing.enunciado = v_q->>'enunciado'
         and v_existing.alternativa_a = v_q->>'alternativa_a'
         and v_existing.alternativa_b = v_q->>'alternativa_b'
         and v_existing.alternativa_c = v_q->>'alternativa_c'
         and v_existing.alternativa_d = v_q->>'alternativa_d'
         and v_existing.gabarito = v_q->>'gabarito'
         and coalesce(v_existing.explicacao_a,'') = v_q->>'explicacao_a'
         and coalesce(v_existing.explicacao_b,'') = v_q->>'explicacao_b'
         and coalesce(v_existing.explicacao_c,'') = v_q->>'explicacao_c'
         and coalesce(v_existing.explicacao_d,'') = v_q->>'explicacao_d'
         and coalesce(v_existing.mensagem_chave,'') = v_q->>'mensagem_chave'
         and coalesce(v_existing.area,'') = v_q->>'area'
         and coalesce(v_existing.tema,'') = v_q->>'tema'
         and coalesce(v_existing.subtema,'') = v_q->>'subtema'
         and coalesce(v_existing.dificuldade,'') = v_q->>'dificuldade'
         and coalesce(v_existing.fonte_instituicao,'') = v_q->>'fonte_instituicao'
         and coalesce(v_existing.fonte_documento,'') = v_q->>'fonte_documento'
         and coalesce(v_existing.fonte_ano,'') = v_q->>'fonte_ano'
         and coalesce(v_existing.fonte_url,'') = v_q->>'fonte_url'
         and coalesce(v_existing.answer_source_institution,'') = v_q->>'answer_source_institution'
         and coalesce(v_existing.answer_source_document,'') = v_q->>'answer_source_document'
         and coalesce(v_existing.answer_source_year,'') = v_q->>'answer_source_year'
         and coalesce(v_existing.answer_source_url,'') = v_q->>'answer_source_url'
         and coalesce(v_existing.answer_source_section,'') = v_q->>'answer_source_section'
         and coalesce(v_existing.answer_source_note,'') = v_q->>'answer_source_note'
      then
        v_skipped := v_skipped + 1;
        v_existing.id := null;
        continue;
      else
        raise exception 'Conflito com questão já existente: % / %',v_q->>'question_id',v_q->>'question_code';
      end if;
    end if;

    insert into public.question_factory_items(
      batch_id,block_id,sequence_no,question_code,
      area,tema,subtema,dificuldade,
      enunciado,alternativa_a,alternativa_b,alternativa_c,alternativa_d,gabarito,
      explicacao_a,explicacao_b,explicacao_c,explicacao_d,mensagem_chave,
      fonte_instituicao,fonte_documento,fonte_ano,fonte_url,
      status,block_sequence_no,exam_style,
      answer_source_institution,answer_source_document,answer_source_year,
      answer_source_url,answer_source_section,answer_source_note,
      version,question_id,latest_review_stage
    ) values (
      v_batch_id,v_block_id,(v_q->>'sequence_no')::int,v_q->>'question_code',
      v_q->>'area',v_q->>'tema',v_q->>'subtema',v_q->>'dificuldade',
      v_q->>'enunciado',v_q->>'alternativa_a',v_q->>'alternativa_b',v_q->>'alternativa_c',v_q->>'alternativa_d',v_q->>'gabarito',
      v_q->>'explicacao_a',v_q->>'explicacao_b',v_q->>'explicacao_c',v_q->>'explicacao_d',v_q->>'mensagem_chave',
      v_q->>'fonte_instituicao',v_q->>'fonte_documento',v_q->>'fonte_ano',v_q->>'fonte_url',
      'generated',(v_q->>'block_sequence_no')::int,v_exam_style,
      v_q->>'answer_source_institution',v_q->>'answer_source_document',v_q->>'answer_source_year',
      v_q->>'answer_source_url',v_q->>'answer_source_section',v_q->>'answer_source_note',
      1,v_q->>'question_id','generation'
    );

    v_inserted := v_inserted + 1;
    v_existing.id := null;
  end loop;

  select count(*),min(block_sequence_no),max(block_sequence_no),min(sequence_no),max(sequence_no)
  into v_total_after,v_min_block_seq,v_max_block_seq,v_min_global_seq,v_max_global_seq
  from public.question_factory_items
  where block_id=v_block_id;

  if v_total_after > 200 then
    raise exception 'Bloco excedeu 200 questões';
  end if;

  v_complete := v_total_after=200;

  if v_complete then
    if v_min_block_seq<>1 or v_max_block_seq<>200
       or (select count(distinct block_sequence_no) from public.question_factory_items where block_id=v_block_id)<>200 then
      raise exception 'Bloco completo possui lacuna/duplicidade em block_sequence_no';
    end if;
    if v_min_global_seq<>((v_block_number-1)*200+1) or v_max_global_seq<>(v_block_number*200)
       or (select count(distinct sequence_no) from public.question_factory_items where block_id=v_block_id)<>200 then
      raise exception 'Bloco completo possui lacuna/duplicidade em sequence_no';
    end if;
  end if;

  update public.question_factory_blocks
  set status='building',
      chatgpt_review_status=null,
      perplexity_review_status=null,
      human_review_status=null,
      human_reviewed_at=null,
      updated_at=now()
  where id=v_block_id;

  update public.question_factory_batches
  set status='building',updated_at=now()
  where id=v_batch_id and status<>'published';

  return jsonb_build_object(
    'stage','generation',
    'batch_number',v_batch_number,
    'batch_code',v_batch_code,
    'block_number',v_block_number,
    'block_code',v_block_code,
    'received',v_received,
    'inserted',v_inserted,
    'idempotent_skipped',v_skipped,
    'block_total',v_total_after,
    'block_complete',v_complete,
    'next_stage',case when v_complete then 'chatgpt_initial' else 'generation' end
  );
end
$function$
;

CREATE OR REPLACE FUNCTION public.admin_import_question_factory_lot_chatgpt_final(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin_session() then raise exception 'admin access required' using errcode='42501'; end if;
  if p_payload->>'review_stage' is distinct from 'lot_chatgpt_final' then raise exception 'review_stage deve ser lot_chatgpt_final'; end if;
  return public.admin_import_question_factory_lot_review(p_payload);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_import_question_factory_lot_perplexity_final(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin_session() then raise exception 'admin access required' using errcode='42501'; end if;
  if p_payload->>'review_stage' is distinct from 'lot_perplexity_final' then raise exception 'review_stage deve ser lot_perplexity_final'; end if;
  return public.admin_import_question_factory_lot_review(p_payload);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_import_question_factory_perplexity_initial(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin_session() then raise exception 'admin access required' using errcode='42501'; end if;
  if p_payload->>'review_stage' is distinct from 'perplexity_initial' then raise exception 'review_stage deve ser perplexity_initial'; end if;
  return public.admin_import_question_factory_review(p_payload);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_import_question_factory_perplexity_reaudit(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin_session() then raise exception 'admin access required' using errcode='42501'; end if;
  if p_payload->>'review_stage' is distinct from 'perplexity_reaudit' then raise exception 'review_stage deve ser perplexity_reaudit'; end if;
  return public.admin_import_question_factory_review(p_payload);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_import_question_factory_stage(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_stage text;
  v_result jsonb;
  v_metrics jsonb;
begin
  if not public.is_admin_session() then
    raise exception 'admin access required' using errcode='42501';
  end if;

  if p_payload->>'schema_version' is distinct from '2.0' then
    raise exception 'schema_version deve ser 2.0';
  end if;

  v_stage := coalesce(
    nullif(p_payload->>'review_stage',''),
    nullif(p_payload->'stage_metrics'->>'stage',''),
    case when p_payload ? 'questions' and p_payload ? 'batch' then 'generation' end
  );

  if v_stage='generation' then
    v_result := public.admin_import_question_factory_generation(p_payload);
  elsif v_stage='prompt_calibration' then
    v_result := public.admin_import_question_factory_calibration(p_payload);
  elsif v_stage='blind_resolution' then
    v_result := public.admin_import_question_factory_blind_resolution(p_payload);
  elsif v_stage='chatgpt_initial' then
    v_result := public.admin_import_question_factory_chatgpt_initial(p_payload);
  elsif v_stage='perplexity_initial' then
    v_result := public.admin_import_question_factory_perplexity_initial(p_payload);
  elsif v_stage='chatgpt_adjudication' then
    v_result := public.admin_import_question_factory_chatgpt_adjudication(p_payload);
  elsif v_stage in ('chatgpt_correction','chatgpt_correction_review') then
    v_result := public.admin_import_question_factory_chatgpt_correction(p_payload);
  elsif v_stage='perplexity_reaudit' then
    v_result := public.admin_import_question_factory_perplexity_reaudit(p_payload);
  elsif v_stage='lot_chatgpt_final' then
    v_result := public.admin_import_question_factory_lot_chatgpt_final(p_payload);
  elsif v_stage='lot_perplexity_final' then
    v_result := public.admin_import_question_factory_lot_perplexity_final(p_payload);
  elsif v_stage='stage_metrics' then
    v_result := public.admin_import_question_factory_stage_metrics(p_payload);
  else
    raise exception 'Etapa de importação desconhecida: %',coalesce(v_stage,'null');
  end if;

  if p_payload ? 'stage_metrics' and v_stage <> 'stage_metrics' then
    begin
      v_metrics := private.qf_record_stage_metrics(p_payload->'stage_metrics');
    exception when others then
      v_metrics := jsonb_build_object('stored',false,'error',sqlerrm);
    end;
  end if;

  return jsonb_build_object(
    'routed_stage',v_stage,
    'result',v_result,
    'stage_metrics',v_metrics
  );
end
$function$
;

revoke all on function public.admin_import_question_factory_blind_resolution(jsonb) from public,anon;
grant execute on function public.admin_import_question_factory_blind_resolution(jsonb) to authenticated;
revoke all on function public.admin_import_question_factory_chatgpt_adjudication(jsonb) from public,anon;
grant execute on function public.admin_import_question_factory_chatgpt_adjudication(jsonb) to authenticated;
revoke all on function public.admin_import_question_factory_chatgpt_correction(jsonb) from public,anon;
grant execute on function public.admin_import_question_factory_chatgpt_correction(jsonb) to authenticated;
revoke all on function public.admin_import_question_factory_chatgpt_initial(jsonb) from public,anon;
grant execute on function public.admin_import_question_factory_chatgpt_initial(jsonb) to authenticated;
revoke all on function public.admin_import_question_factory_generation(jsonb) from public,anon;
grant execute on function public.admin_import_question_factory_generation(jsonb) to authenticated;
revoke all on function public.admin_import_question_factory_lot_chatgpt_final(jsonb) from public,anon;
grant execute on function public.admin_import_question_factory_lot_chatgpt_final(jsonb) to authenticated;
revoke all on function public.admin_import_question_factory_lot_perplexity_final(jsonb) from public,anon;
grant execute on function public.admin_import_question_factory_lot_perplexity_final(jsonb) to authenticated;
revoke all on function public.admin_import_question_factory_perplexity_initial(jsonb) from public,anon;
grant execute on function public.admin_import_question_factory_perplexity_initial(jsonb) to authenticated;
revoke all on function public.admin_import_question_factory_perplexity_reaudit(jsonb) from public,anon;
grant execute on function public.admin_import_question_factory_perplexity_reaudit(jsonb) to authenticated;
revoke all on function public.admin_import_question_factory_stage(jsonb) from public,anon;
grant execute on function public.admin_import_question_factory_stage(jsonb) to authenticated;

commit;
