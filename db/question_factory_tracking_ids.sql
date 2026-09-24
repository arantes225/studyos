-- Human-readable tracking IDs for question-factory lots and blocks.
-- L001 = lote de 1.000; L001-B01 = bloco de 200.

alter table public.question_factory_batches
  add column if not exists batch_code text;

alter table public.question_factory_blocks
  add column if not exists block_code text;

alter table public.question_factory_stage_metrics
  add column if not exists batch_code text,
  add column if not exists block_code text;

update public.question_factory_batches
set batch_code = 'L' || lpad(batch_number::text,3,'0')
where batch_code is null or batch_code='';

update public.question_factory_blocks bl
set block_code = 'L' || lpad(b.batch_number::text,3,'0') || '-B' || lpad(bl.block_number::text,2,'0')
from public.question_factory_batches b
where b.id=bl.batch_id
  and (bl.block_code is null or bl.block_code='');

create unique index if not exists qf_batches_batch_code_uidx
  on public.question_factory_batches(batch_code)
  where batch_code is not null;

create unique index if not exists qf_blocks_block_code_uidx
  on public.question_factory_blocks(block_code)
  where block_code is not null;

create or replace function private.qf_assign_tracking_codes()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_batch_number integer;
begin
  if tg_table_name='question_factory_batches' then
    new.batch_code := 'L' || lpad(new.batch_number::text,3,'0');
    return new;
  end if;

  select b.batch_number into v_batch_number
  from public.question_factory_batches b
  where b.id=new.batch_id;

  if v_batch_number is null then
    raise exception 'batch_id inválido para bloco';
  end if;

  new.block_code := 'L' || lpad(v_batch_number::text,3,'0') || '-B' || lpad(new.block_number::text,2,'0');
  return new;
end;
$function$;

drop trigger if exists qf_batches_tracking_code_trg on public.question_factory_batches;
create trigger qf_batches_tracking_code_trg
before insert or update of batch_number
on public.question_factory_batches
for each row execute function private.qf_assign_tracking_codes();

drop trigger if exists qf_blocks_tracking_code_trg on public.question_factory_blocks;
create trigger qf_blocks_tracking_code_trg
before insert or update of batch_id,block_number
on public.question_factory_blocks
for each row execute function private.qf_assign_tracking_codes();

-- Note: admin_question_factory_snapshot(), admin_question_factory_block_tracker()
-- and private.qf_record_stage_metrics(jsonb) were updated live to expose/store batch_code/block_code.
