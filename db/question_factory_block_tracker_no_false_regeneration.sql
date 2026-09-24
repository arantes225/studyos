-- Corrige falso retorno à etapa de geração quando o bloco já possui 200/200 questões.
-- Antes, qualquer item marcado needs_revision/rejected em chatgpt_initial fazia
-- admin_question_factory_block_tracker() retornar next_stage='generation',
-- mesmo com o bloco completo. Isso fazia o Admin exibir "Gerar 200 questões".
--
-- A correção remove apenas esse atalho. Itens problemáticos continuam no
-- pipeline normal de revisão/correção; a etapa generation fica reservada a
-- blocos com question_count < target_size.

do $$
declare
  fn text;
begin
  select pg_get_functiondef(p.oid)
    into fn
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_question_factory_block_tracker'
    and pg_get_function_identity_arguments(p.oid) = '';

  if fn is null then
    raise exception 'admin_question_factory_block_tracker() not found';
  end if;

  fn := replace(
    fn,
    '        when bb.has_adversarial_reject then ''generation''' || chr(10),
    ''
  );

  fn := replace(
    fn,
    '        when has_adversarial_reject then ''Regeneração adversarial''' || chr(10),
    ''
  );

  execute fn;
end $$;
