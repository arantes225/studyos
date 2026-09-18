-- =========================================================
-- DOCMAP — CADERNO DE ERROS v7.1
--
-- Rode UMA VEZ no Supabase SQL Editor.
-- Não apaga dados.
--
-- Adiciona:
-- - minidashboard do Caderno de Erros
-- - retenção média estimada
-- =========================================================

begin;


create or replace view public.error_notebook_metrics
with (
  security_invoker = true
)
as
select

  user_id,

  count(*) filter (
    where active = true
  )::integer
    as registered_errors,

  count(*) filter (
    where
      active = true
      and review_count > 0
  )::integer
    as reviewed_errors,

  count(*) filter (
    where
      active = true
      and due_date < current_date
  )::integer
    as overdue_errors,

  round(
    (
      avg(
        public.memory_retrievability(
          coalesce(
            last_reviewed_at,
            created_at
          ),
          stability_days,
          current_date
        )
      ) filter (
        where active = true
      )
    )
    * 100,
    1
  )
    as retention_percent

from public.error_notebook

group by
  user_id;


grant select
on public.error_notebook_metrics
to authenticated;


commit;
