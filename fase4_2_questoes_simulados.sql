-- =========================================================
-- DOCMAP — FASE 4.2 NOVA
-- QUESTÕES E SIMULADOS
--
-- PDF -> extração das questões -> gabarito rápido ->
-- classificação dos erros -> Caderno de Erros ->
-- maior dificuldade no Dashboard
--
-- Rode UMA VEZ no Supabase SQL Editor.
-- Este patch NÃO apaga dados existentes.
-- =========================================================

begin;

-- ---------------------------------------------------------
-- 1. SIMULADOS / LISTAS DE QUESTÕES
-- ---------------------------------------------------------

create table if not exists public.question_sets (

  id uuid
    primary key
    default gen_random_uuid(),

  user_id uuid
    not null
    references auth.users(id)
    on delete cascade,

  title text
    not null,

  source_file_name text,

  source_file_path text,

  total_questions integer
    not null
    default 0
    check (total_questions >= 0),

  status text
    not null
    default 'processing'
    check (
      status in (
        'processing',
        'ready',
        'failed',
        'archived'
      )
    ),

  error_message text,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now()

);

create index if not exists idx_question_sets_user_created
on public.question_sets (
  user_id,
  created_at desc
);


create table if not exists public.question_items (

  id uuid
    primary key
    default gen_random_uuid(),

  user_id uuid
    not null
    references auth.users(id)
    on delete cascade,

  set_id uuid
    not null
    references public.question_sets(id)
    on delete cascade,

  question_number integer
    not null
    check (question_number > 0),

  order_index integer
    not null
    check (order_index > 0),

  source_label text,

  stem text,

  alternatives jsonb
    not null
    default '{}'::jsonb,

  raw_text text
    not null,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  unique (
    set_id,
    question_number
  )

);

create index if not exists idx_question_items_set_order
on public.question_items (
  set_id,
  order_index
);


create table if not exists public.question_attempts (

  id uuid
    primary key
    default gen_random_uuid(),

  user_id uuid
    not null
    references auth.users(id)
    on delete cascade,

  question_item_id uuid
    not null
    references public.question_items(id)
    on delete cascade,

  result text
    not null
    check (
      result in (
        'correct',
        'wrong'
      )
    ),

  area text,

  materia text,

  correct_option text
    check (
      correct_option is null
      or correct_option in (
        'A','B','C','D','E'
      )
    ),

  what_i_thought text,

  sent_to_error boolean
    not null
    default false,

  error_entry_id uuid
    references public.error_notebook(id)
    on delete set null,

  answered_at timestamptz
    not null
    default now(),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  unique (
    user_id,
    question_item_id
  )

);

create index if not exists idx_question_attempts_user_result
on public.question_attempts (
  user_id,
  result
);

create index if not exists idx_question_attempts_item
on public.question_attempts (
  question_item_id
);


-- ---------------------------------------------------------
-- 2. updated_at
-- ---------------------------------------------------------

drop trigger if exists question_sets_updated_at
on public.question_sets;

create trigger question_sets_updated_at
before update on public.question_sets
for each row
execute function public.set_updated_at();


drop trigger if exists question_items_updated_at
on public.question_items;

create trigger question_items_updated_at
before update on public.question_items
for each row
execute function public.set_updated_at();


drop trigger if exists question_attempts_updated_at
on public.question_attempts;

create trigger question_attempts_updated_at
before update on public.question_attempts
for each row
execute function public.set_updated_at();


-- ---------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------

alter table public.question_sets
enable row level security;

alter table public.question_items
enable row level security;

alter table public.question_attempts
enable row level security;


drop policy if exists own_rows
on public.question_sets;

create policy own_rows
on public.question_sets
for all
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);


drop policy if exists own_rows
on public.question_items;

create policy own_rows
on public.question_items
for all
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);


drop policy if exists own_rows
on public.question_attempts;

create policy own_rows
on public.question_attempts
for all
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);


grant
  select,
  insert,
  update,
  delete
on table
  public.question_sets,
  public.question_items,
  public.question_attempts
to authenticated;


-- ---------------------------------------------------------
-- 4. VIEW — MAIOR DIFICULDADE
--
-- Como o usuário classifica a ÁREA apenas das questões
-- erradas, esta métrica mede concentração de ERROS,
-- e não taxa de acerto por área.
-- ---------------------------------------------------------

create or replace view public.question_area_difficulty
with (
  security_invoker = true
)
as
with grouped as (

  select
    qa.user_id,
    trim(qa.area) as area,
    count(*)::integer as wrong_count,
    count(
      distinct qi.set_id
    )::integer as set_count

  from public.question_attempts qa

  join public.question_items qi
    on qi.id = qa.question_item_id

  where
    qa.result = 'wrong'
    and nullif(trim(qa.area), '') is not null

  group by
    qa.user_id,
    trim(qa.area)

)

select

  user_id,
  area,
  wrong_count,
  set_count,

  round(
    (
      wrong_count::numeric
      /
      nullif(
        sum(wrong_count) over (
          partition by user_id
        ),
        0
      )
      * 100
    ),
    1
  ) as error_share_percent

from grouped;


grant select
on public.question_area_difficulty
to authenticated;


commit;
