-- =========================================================
-- DOCMAP — FASE 4.1
-- Aulas já feitas + distribuição inteligente
-- Dias permitidos por tipo de estudo
-- Estrutura para registro de questões
--
-- Rode UMA VEZ no Supabase SQL Editor.
-- =========================================================

begin;

-- =========================================================
-- 1. VALIDAÇÃO DE DIAS DA SEMANA
-- ISO: 1=Segunda ... 7=Domingo
-- =========================================================

create or replace function public.valid_weekdays(
  p_days smallint[]
)
returns boolean
language sql
immutable
as $$
  select
    p_days is not null
    and cardinality(p_days) > 0
    and not exists (
      select 1
      from unnest(p_days) as d
      where d < 1 or d > 7
    );
$$;


create or replace function public.next_allowed_date(
  p_candidate date,
  p_weekdays smallint[]
)
returns date
language plpgsql
immutable
as $$
declare
  v_date date;
  i integer;
begin
  v_date := coalesce(p_candidate, current_date);

  if
    p_weekdays is null
    or cardinality(p_weekdays) = 0
  then
    return v_date;
  end if;

  for i in 0..13 loop
    if extract(isodow from v_date)::smallint = any(p_weekdays) then
      return v_date;
    end if;

    v_date := v_date + 1;
  end loop;

  return v_date;
end;
$$;


-- =========================================================
-- 2. NOVAS CONFIGURAÇÕES
-- =========================================================

alter table public.user_settings
  add column if not exists flashcard_weekdays smallint[]
    not null
    default array[1,2,3,4,5,6,7]::smallint[];

alter table public.user_settings
  add column if not exists theory_study_weekdays smallint[]
    not null
    default array[1,2,3,4,5,6,7]::smallint[];

alter table public.user_settings
  add column if not exists theory_review_weekdays smallint[]
    not null
    default array[1,2,3,4,5,6,7]::smallint[];

alter table public.user_settings
  add column if not exists error_weekdays smallint[]
    not null
    default array[1,2,3,4,5,6,7]::smallint[];

alter table public.user_settings
  add column if not exists question_weekdays smallint[]
    not null
    default array[1,2,3,4,5,6,7]::smallint[];

alter table public.user_settings
  add column if not exists max_subject_reviews_per_day integer
    not null
    default 3;


do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_settings_flashcard_weekdays_valid'
  ) then
    alter table public.user_settings
      add constraint user_settings_flashcard_weekdays_valid
      check (public.valid_weekdays(flashcard_weekdays));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_settings_theory_study_weekdays_valid'
  ) then
    alter table public.user_settings
      add constraint user_settings_theory_study_weekdays_valid
      check (public.valid_weekdays(theory_study_weekdays));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_settings_theory_review_weekdays_valid'
  ) then
    alter table public.user_settings
      add constraint user_settings_theory_review_weekdays_valid
      check (public.valid_weekdays(theory_review_weekdays));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_settings_error_weekdays_valid'
  ) then
    alter table public.user_settings
      add constraint user_settings_error_weekdays_valid
      check (public.valid_weekdays(error_weekdays));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_settings_question_weekdays_valid'
  ) then
    alter table public.user_settings
      add constraint user_settings_question_weekdays_valid
      check (public.valid_weekdays(question_weekdays));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'user_settings_max_subject_reviews_positive'
  ) then
    alter table public.user_settings
      add constraint user_settings_max_subject_reviews_positive
      check (max_subject_reviews_per_day > 0);
  end if;
end
$$;


-- =========================================================
-- 3. AULAS JÁ FEITAS
-- =========================================================

alter table public.study_topics
  add column if not exists already_done boolean
    not null
    default false;

alter table public.study_topics
  add column if not exists studied_on date;


-- =========================================================
-- 4. ESTRUTURA PARA QUESTÕES
-- A interface entra na Fase 4.2.
-- =========================================================

create table if not exists public.question_sessions (

  id uuid
    primary key
    default gen_random_uuid(),

  user_id uuid
    not null
    references auth.users(id)
    on delete cascade,

  session_date date
    not null
    default current_date,

  platform text,

  area text,

  materia text,

  theme text,

  total_questions integer
    not null
    check (total_questions > 0),

  correct_answers integer
    not null
    default 0
    check (correct_answers >= 0),

  wrong_answers integer
    not null
    default 0
    check (wrong_answers >= 0),

  duration_seconds integer
    check (
      duration_seconds is null
      or duration_seconds >= 0
    ),

  notes text,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint question_answers_match_total
    check (
      correct_answers + wrong_answers = total_questions
    )

);

create index if not exists idx_question_sessions_user_date
on public.question_sessions (
  user_id,
  session_date desc
);

drop trigger if exists question_sessions_updated_at
on public.question_sessions;

create trigger question_sessions_updated_at
before update on public.question_sessions
for each row
execute function public.set_updated_at();

alter table public.question_sessions
enable row level security;

drop policy if exists own_rows
on public.question_sessions;

create policy own_rows
on public.question_sessions
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
on table public.question_sessions
to authenticated;


-- =========================================================
-- 5. PRÓXIMA DATA DISPONÍVEL PARA REVISÃO TEÓRICA
--
-- Respeita:
-- - dias permitidos
-- - limite máximo de revisões por dia
-- =========================================================

create or replace function public.next_available_subject_review_date(
  p_candidate date,
  p_exclude_review_id uuid default null
)
returns date
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_weekdays smallint[];
  v_limit integer;
  v_date date;
  v_count integer;
  i integer;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  select
    theory_review_weekdays,
    max_subject_reviews_per_day
  into
    v_weekdays,
    v_limit
  from public.user_settings
  where user_id = auth.uid();

  v_weekdays :=
    coalesce(
      v_weekdays,
      array[1,2,3,4,5,6,7]::smallint[]
    );

  v_limit :=
    greatest(
      1,
      coalesce(v_limit, 3)
    );

  v_date :=
    greatest(
      coalesce(p_candidate, current_date),
      current_date
    );

  for i in 0..365 loop

    v_date :=
      public.next_allowed_date(
        v_date,
        v_weekdays
      );

    select count(*)::integer
    into v_count
    from public.subject_reviews sr
    where
      sr.user_id = auth.uid()
      and sr.completed_at is null
      and sr.scheduled_date = v_date
      and (
        p_exclude_review_id is null
        or sr.id <> p_exclude_review_id
      );

    if v_count < v_limit then
      return v_date;
    end if;

    v_date := v_date + 1;

  end loop;

  raise exception 'Não foi possível encontrar data disponível para revisão';
end;
$$;


revoke all
on function public.next_available_subject_review_date(date, uuid)
from public;

grant execute
on function public.next_available_subject_review_date(date, uuid)
to authenticated;


-- =========================================================
-- 6. GERAR REVISÕES DE MATÉRIA
--
-- Modo normal:
-- usa a data em que a aula foi concluída.
--
-- Modo recuperação:
-- espalha a primeira revisão pelos próximos dias disponíveis.
-- As revisões seguintes partem da anterior.
-- =========================================================

create or replace function public.generate_subject_reviews(
  p_topic_id uuid,
  p_recovery_mode boolean default false,
  p_reference_date date default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_topic public.study_topics;
  v_intervals integer[];
  v_reference date;
  v_candidate date;
  v_scheduled date;
  v_previous date;
  i integer;
begin

  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  select *
  into v_topic
  from public.study_topics
  where
    id = p_topic_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Tema não encontrado';
  end if;

  select subject_review_intervals
  into v_intervals
  from public.user_settings
  where user_id = auth.uid();

  if
    v_intervals is null
    or cardinality(v_intervals) = 0
  then
    v_intervals := array[7,14,30];
  end if;

  delete from public.subject_reviews
  where
    topic_id = p_topic_id
    and user_id = auth.uid()
    and completed_at is null;

  v_reference :=
    coalesce(
      p_reference_date,
      v_topic.studied_on,
      current_date
    );

  v_previous := null;

  for i in 1..cardinality(v_intervals) loop

    if p_recovery_mode then

      if i = 1 then
        v_candidate :=
          greatest(
            current_date + 1,
            v_reference + v_intervals[i]
          );
      else
        v_candidate :=
          v_previous + v_intervals[i];
      end if;

    else

      v_candidate :=
        v_reference + v_intervals[i];

      if v_previous is not null then
        v_candidate :=
          greatest(
            v_candidate,
            v_previous + 1
          );
      end if;

    end if;

    v_scheduled :=
      public.next_available_subject_review_date(
        v_candidate,
        null
      );

    insert into public.subject_reviews (
      user_id,
      topic_id,
      stage,
      interval_days,
      scheduled_date
    )
    values (
      auth.uid(),
      p_topic_id,
      i,
      v_intervals[i],
      v_scheduled
    )
    on conflict (
      topic_id,
      stage
    )
    do update
    set
      interval_days = excluded.interval_days,
      scheduled_date = excluded.scheduled_date,
      completed_at = null,
      rescheduled_manually = false;

    v_previous := v_scheduled;

  end loop;

end;
$$;


revoke all
on function public.generate_subject_reviews(uuid, boolean, date)
from public;

grant execute
on function public.generate_subject_reviews(uuid, boolean, date)
to authenticated;


-- =========================================================
-- 7. CONCLUIR AULA NORMAL
-- Agora também respeita dias de revisão e carga diária.
-- =========================================================

create or replace function public.complete_study_topic(
  p_topic_id uuid
)
returns public.study_topics
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_topic public.study_topics;
begin

  select *
  into v_topic
  from public.study_topics
  where
    id = p_topic_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Tema não encontrado';
  end if;

  if v_topic.completed_at is not null then
    return v_topic;
  end if;

  update public.study_topics
  set
    completed_at = now(),
    studied_on = current_date,
    already_done = false,
    status = 'completed'
  where id = p_topic_id
  returning *
  into v_topic;

  perform public.generate_subject_reviews(
    p_topic_id,
    false,
    current_date
  );

  return v_topic;

end;
$$;


-- =========================================================
-- 8. MARCAR "AULA JÁ FEITA"
--
-- Data em que estudou é opcional.
-- Se desconhecida, começa a recuperação a partir de amanhã.
-- =========================================================

create or replace function public.mark_topic_already_done(
  p_topic_id uuid,
  p_studied_on date default null
)
returns public.study_topics
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_topic public.study_topics;
begin

  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  select *
  into v_topic
  from public.study_topics
  where
    id = p_topic_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Tema não encontrado';
  end if;

  if v_topic.completed_at is not null then
    raise exception 'Esta aula já está concluída';
  end if;

  update public.study_topics
  set
    completed_at = now(),
    studied_on = p_studied_on,
    already_done = true,
    status = 'completed'
  where id = p_topic_id
  returning *
  into v_topic;

  perform public.generate_subject_reviews(
    p_topic_id,
    true,
    p_studied_on
  );

  return v_topic;

end;
$$;


revoke all
on function public.mark_topic_already_done(uuid, date)
from public;

grant execute
on function public.mark_topic_already_done(uuid, date)
to authenticated;


-- =========================================================
-- 9. FLASHCARDS: RESPEITAR DIAS PERMITIDOS
-- =========================================================

create or replace function public.create_flashcard(

  p_area text,

  p_materia text,

  p_front_text text,

  p_back_text text,

  p_front_image_path text default null,

  p_back_image_path text default null

)
returns public.flashcards
language plpgsql
security invoker
set search_path = public
as $$
declare

  v_card public.flashcards;
  v_weekdays smallint[];
  v_due date;

begin

  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  if trim(coalesce(p_front_text, '')) = '' then
    raise exception 'Frente obrigatória';
  end if;

  if trim(coalesce(p_back_text, '')) = '' then
    raise exception 'Verso obrigatório';
  end if;

  select flashcard_weekdays
  into v_weekdays
  from public.user_settings
  where user_id = auth.uid();

  v_weekdays :=
    coalesce(
      v_weekdays,
      array[1,2,3,4,5,6,7]::smallint[]
    );

  v_due :=
    public.next_allowed_date(
      current_date,
      v_weekdays
    );

  insert into public.flashcards (

    user_id,
    area,
    materia,
    front_text,
    back_text,
    front_image_path,
    back_image_path,
    due_date

  )
  values (

    auth.uid(),
    nullif(trim(p_area), ''),
    nullif(trim(p_materia), ''),
    trim(p_front_text),
    trim(p_back_text),
    p_front_image_path,
    p_back_image_path,
    v_due

  )
  returning *
  into v_card;

  return v_card;

end;
$$;


create or replace function public.review_flashcard(

  p_flashcard_id uuid,

  p_rating text,

  p_was_correct boolean default null

)
returns public.flashcards
language plpgsql
security invoker
set search_path = public
as $$
declare

  v_card public.flashcards;

  v_hard integer[];
  v_medium integer[];
  v_easy integer[];
  v_intervals integer[];
  v_weekdays smallint[];

  v_stage integer;
  v_index integer;
  v_target_interval integer;
  v_actual_interval integer;
  v_due date;

  v_retention numeric;
  v_correct boolean;

begin

  if p_rating not in ('hard', 'medium', 'easy') then
    raise exception 'Avaliação inválida';
  end if;

  select *
  into v_card
  from public.flashcards
  where
    id = p_flashcard_id
    and user_id = auth.uid()
    and active = true
  for update;

  if not found then
    raise exception 'Flashcard não encontrado';
  end if;

  select
    flashcard_intervals_hard,
    flashcard_intervals_medium,
    flashcard_intervals_easy,
    flashcard_weekdays
  into
    v_hard,
    v_medium,
    v_easy,
    v_weekdays
  from public.user_settings
  where user_id = auth.uid();

  v_hard := coalesce(v_hard, array[1,3,7]);
  v_medium := coalesce(v_medium, array[7,21,45]);
  v_easy := coalesce(v_easy, array[15,45,70]);
  v_weekdays :=
    coalesce(
      v_weekdays,
      array[1,2,3,4,5,6,7]::smallint[]
    );

  case p_rating
    when 'hard' then v_intervals := v_hard;
    when 'medium' then v_intervals := v_medium;
    when 'easy' then v_intervals := v_easy;
  end case;

  v_stage := v_card.review_count + 1;

  v_index :=
    least(
      v_stage,
      cardinality(v_intervals)
    );

  v_target_interval := v_intervals[v_index];

  v_due :=
    public.next_allowed_date(
      current_date + v_target_interval,
      v_weekdays
    );

  v_actual_interval :=
    greatest(
      1,
      v_due - current_date
    );

  v_retention :=
    public.memory_retrievability(
      v_card.last_reviewed_at,
      v_card.stability_days,
      current_date
    );

  v_correct :=
    coalesce(
      p_was_correct,
      p_rating <> 'hard'
    );

  insert into public.flashcard_reviews (

    user_id,
    flashcard_id,
    rating,
    was_correct,
    stage,
    scheduled_date_before,
    interval_before_days,
    interval_after_days,
    stability_before_days,
    stability_after_days,
    retrievability_before,
    next_due_date

  )
  values (

    auth.uid(),
    v_card.id,
    p_rating,
    v_correct,
    v_stage,
    v_card.due_date,
    v_card.current_interval_days,
    v_actual_interval,
    v_card.stability_days,
    v_actual_interval,
    v_retention,
    v_due

  );

  update public.flashcards
  set
    due_date = v_due,
    current_interval_days = v_actual_interval,
    stability_days = v_actual_interval,
    review_count = review_count + 1,
    last_reviewed_at = now(),
    last_rating = p_rating
  where id = v_card.id
  returning *
  into v_card;

  return v_card;

end;
$$;


-- =========================================================
-- 10. CADERNO DE ERROS: RESPEITAR DIAS PERMITIDOS
-- =========================================================

create or replace function public.create_error_entry(

  p_area text,

  p_materia text,

  p_theme text,

  p_ccq text,

  p_question_text text,

  p_correct_answer text,

  p_what_i_thought text default null,

  p_question_image_path text default null

)
returns public.error_notebook
language plpgsql
security invoker
set search_path = public
as $$
declare

  v_entry public.error_notebook;
  v_interval integer;
  v_weekdays smallint[];
  v_due date;
  v_actual_interval integer;

begin

  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;

  if trim(coalesce(p_ccq, '')) = '' then
    raise exception 'CCQ obrigatório';
  end if;

  if trim(coalesce(p_correct_answer, '')) = '' then
    raise exception 'Resposta correta obrigatória';
  end if;

  if
    nullif(trim(coalesce(p_question_text, '')), '') is null
    and p_question_image_path is null
  then
    raise exception 'Informe a questão ou uma imagem';
  end if;

  select
    error_review_interval_days,
    error_weekdays
  into
    v_interval,
    v_weekdays
  from public.user_settings
  where user_id = auth.uid();

  v_interval := coalesce(v_interval, 21);

  v_weekdays :=
    coalesce(
      v_weekdays,
      array[1,2,3,4,5,6,7]::smallint[]
    );

  v_due :=
    public.next_allowed_date(
      current_date + v_interval,
      v_weekdays
    );

  v_actual_interval :=
    greatest(
      1,
      v_due - current_date
    );

  insert into public.error_notebook (

    user_id,
    area,
    materia,
    theme,
    ccq,
    question_text,
    question_image_path,
    correct_answer,
    what_i_thought,
    due_date,
    current_interval_days,
    stability_days

  )
  values (

    auth.uid(),
    nullif(trim(p_area), ''),
    nullif(trim(p_materia), ''),
    nullif(trim(p_theme), ''),
    trim(p_ccq),
    nullif(trim(p_question_text), ''),
    p_question_image_path,
    trim(p_correct_answer),
    nullif(trim(p_what_i_thought), ''),
    v_due,
    v_actual_interval,
    v_actual_interval

  )
  returning *
  into v_entry;

  return v_entry;

end;
$$;


create or replace function public.review_error_entry(
  p_error_id uuid
)
returns public.error_notebook
language plpgsql
security invoker
set search_path = public
as $$
declare

  v_entry public.error_notebook;
  v_interval integer;
  v_weekdays smallint[];
  v_retention numeric;
  v_due date;
  v_actual_interval integer;

begin

  select *
  into v_entry
  from public.error_notebook
  where
    id = p_error_id
    and user_id = auth.uid()
    and active = true
  for update;

  if not found then
    raise exception 'Registro não encontrado';
  end if;

  select
    error_review_interval_days,
    error_weekdays
  into
    v_interval,
    v_weekdays
  from public.user_settings
  where user_id = auth.uid();

  v_interval := coalesce(v_interval, 21);

  v_weekdays :=
    coalesce(
      v_weekdays,
      array[1,2,3,4,5,6,7]::smallint[]
    );

  v_due :=
    public.next_allowed_date(
      current_date + v_interval,
      v_weekdays
    );

  v_actual_interval :=
    greatest(
      1,
      v_due - current_date
    );

  v_retention :=
    public.memory_retrievability(
      coalesce(
        v_entry.last_reviewed_at,
        v_entry.created_at
      ),
      v_entry.stability_days,
      current_date
    );

  insert into public.error_reviews (

    user_id,
    error_id,
    scheduled_date_before,
    interval_days,
    retrievability_before,
    next_due_date

  )
  values (

    auth.uid(),
    v_entry.id,
    v_entry.due_date,
    v_actual_interval,
    v_retention,
    v_due

  );

  update public.error_notebook
  set
    due_date = v_due,
    current_interval_days = v_actual_interval,
    stability_days = v_actual_interval,
    review_count = review_count + 1,
    last_reviewed_at = now()
  where id = v_entry.id
  returning *
  into v_entry;

  return v_entry;

end;
$$;


-- =========================================================
-- 11. PERMISSÕES
-- =========================================================

grant execute
on function public.next_allowed_date(date, smallint[])
to authenticated;

grant execute
on function public.mark_topic_already_done(uuid, date)
to authenticated;

grant execute
on function public.generate_subject_reviews(uuid, boolean, date)
to authenticated;


commit;
