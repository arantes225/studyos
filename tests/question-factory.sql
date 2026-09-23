-- Executar após carregar o DDL, na mesma transação de validação; nada persiste.
do $$
declare good jsonb; bad jsonb; patch jsonb; rejected boolean; n int:=0; i int;
begin
 good:='{"status":"approved","quality_score":100,"component_scores":{"scientific":25,"answer_key":20,"answer_source":15,"distractors":10,"explanations":10,"style":10,"writing":5,"difficulty":5},"independent_answer":"A","original_answer":"A","hard_fail":false,"hard_fail_reasons":[],"ambiguity":false,"single_best_answer":true,"answer_source_issue":null,"source_verification_status":"VERIFIED","style_evidence_status":"VERIFIED","distractor_quality":"GOOD","alternative_granularity":"PASS","difficulty_alignment":"PASS","verified_sources":[{"institution":"Fixture","document":"Documento de teste","year":"2026","url":"https://example.org/fixture"}]}';
 if not private.qf_assert_review(good,'A') then raise exception 'Aprovação válida rejeitada'; end if;
 for patch in select value from jsonb_array_elements('[{"quality_score":null},{"quality_score":97},{"ambiguity":true},{"single_best_answer":false},{"hard_fail":true},{"answer_source_issue":"Fonte insuficiente"},{"independent_answer":"B"},{"original_answer":"B"},{"verified_sources":[]},{"source_verification_status":"SOURCE_VERIFICATION_PENDING"},{"style_evidence_status":"NEEDS_MORE_PRIMARY_STYLE_DATA"},{"distractor_quality":"WEAK"},{"alternative_granularity":"FAIL"},{"difficulty_alignment":"FAIL"},{"hard_fail_reasons":["problema"]}]') loop
  rejected:=false;
  begin perform private.qf_assert_review(good||patch,'A'); exception when others then rejected:=true; end;
  if not rejected then raise exception 'Caso inválido aceito: %',patch; end if;
  n:=n+1;
 end loop;
 rejected:=false;
 begin perform private.qf_assert_review(jsonb_set(good,'{component_scores,difficulty}','6'),'A'); exception when others then rejected:=true; end;
 if not rejected then raise exception 'Componente acima do teto aceito'; end if;
 rejected:=false;
 begin perform private.qf_assert_review(good-'answer_source_issue','A'); exception when others then rejected:=true; end;
 if not rejected then raise exception 'Campo obrigatório ausente aceito'; end if;
 bad:=good||'{"status":"needs_revision","quality_score":null,"style_evidence_status":"NEEDS_MORE_PRIMARY_STYLE_DATA"}';
 bad:=jsonb_set(bad,'{component_scores,style}','null');
 if private.qf_assert_review(bad,'A') then raise exception 'Pendência de corpus aprovada'; end if;
 if has_function_privilege('anon','public.admin_export_question_factory(integer,integer,boolean)','EXECUTE') then raise exception 'Anon pode exportar'; end if;
 if has_function_privilege('anon','public.admin_import_question_factory_review(jsonb)','EXECUTE') then raise exception 'Anon pode importar'; end if;
 if has_function_privilege('authenticated','private.qf_invalidate_lot(uuid)','EXECUTE') then raise exception 'Helper privado exposto'; end if;
 -- O teste não falsifica identidade nem desativa PIN/autorização.
 if not public.is_admin_session() then
  rejected:=false;
  begin perform public.admin_import_question_factory_review('{}'); exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Sessão não administrativa aceita'; end if;
 end if;
 raise notice 'Contrato validado: caso positivo, % casos negativos, tetos, campos obrigatórios, pendência e permissões.',n;
end $$;
