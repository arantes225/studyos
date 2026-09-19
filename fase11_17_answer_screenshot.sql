-- =========================================================
-- RESIBULANDO — GABARITO OFICIAL PARA CORREÇÃO POR PRINT
--
-- Rode SOMENTE este patch UMA VEZ no Supabase SQL Editor.
-- Não apaga dados.
-- =========================================================

begin;

alter table public.question_items
add column if not exists official_answer text;

alter table public.question_items
drop constraint if exists question_items_official_answer_check;

alter table public.question_items
add constraint question_items_official_answer_check
check (
  official_answer is null
  or official_answer in (
    'A','B','C','D','E','X'
  )
);

commit;

notify pgrst, 'reload schema';
