-- Question Factory Contract 2.3 hard adversarial gates
-- Keeps bank identity separate from global generator/validator enforcement.

begin;

create or replace function private.qf_adversarial_reject_reasons(p jsonb, answer text)
returns jsonb
language plpgsql
immutable
set search_path=''
as $$
declare
  reasons jsonb := '[]'::jsonb;
  sg text := upper(coalesce(p->>'surface_guess_without_vignette',''));
  conf text := lower(coalesce(p->>'surface_guess_confidence',''));
  lex text := upper(coalesce(p->>'lexical_asymmetry',''));
  vd text := upper(coalesce(p->>'vignette_dependency',''));
  cf text := btrim(coalesce(p->>'counterfactual_change',''));
  bd text := btrim(coalesce(p->>'best_distractor',''));
begin
  if sg = upper(coalesce(answer,'')) and conf in ('media','média','alta','medium','high') then
    reasons := reasons || jsonb_build_array('surface_guess_matches_key');
  end if;
  if lex <> 'PASS' then
    reasons := reasons || jsonb_build_array('lexical_asymmetry_fail');
  end if;
  if bd = '' or cf = '' or upper(cf) in ('FAIL','FAILED','NONE','N/A','NA') then
    reasons := reasons || jsonb_build_array('counterfactual_fail');
  end if;
  if vd <> 'PASS' then
    reasons := reasons || jsonb_build_array('vignette_dependency_fail');
  end if;
  return reasons;
end
$$;

create or replace function private.qf_assert_review(p jsonb, answer text)
returns boolean
language plpgsql
immutable
set search_path=''
as $$
declare
  k text; cap numeric; score numeric; total numeric:=0; c jsonb:=p->'component_scores';
  adv jsonb;
begin
 if jsonb_typeof(c) is distinct from 'object' then raise exception 'component_scores obrigatório'; end if;
 for k,cap in select key,value::numeric from jsonb_each_text('{"scientific":25,"answer_key":20,"answer_source":15,"distractors":10,"explanations":10,"style":10,"writing":5,"difficulty":5}'::jsonb) loop
  if not c ? k then raise exception 'Componente ausente: %',k; end if;
  if c->k='null'::jsonb and k='style' and p->>'style_evidence_status'='NEEDS_MORE_PRIMARY_STYLE_DATA' and p->>'quality_score' is null and p->>'status'<>'approved' then continue; end if;
  if jsonb_typeof(c->k) is distinct from 'number' then raise exception 'Componente inválido: %',k; end if;
  score:=(c->>k)::numeric;
  if score<0 or score>cap then raise exception 'Componente % fora de 0–%',k,cap; end if;
  total:=total+score;
 end loop;
 if p->>'quality_score' is not null and ((p->>'quality_score')::numeric <> total or (c->>'style') is null) then raise exception 'Nota não corresponde à soma da rubrica'; end if;
 if p->>'status' is null or p->>'status' not in ('approved','needs_revision','rejected') then raise exception 'Status inválido'; end if;
 adv := private.qf_adversarial_reject_reasons(p,answer);
 if p->>'status'='approved' and adv <> '[]'::jsonb then
   raise exception 'Aprovação bloqueada por hard reject adversarial: %',adv::text;
 end if;
 if p->>'status'<>'approved' then return false; end if;
 if jsonb_typeof(p->'quality_score') is distinct from 'number' or total<97 or (c->>'style')::numeric<9.7
    or p->'hard_fail' is distinct from 'false'::jsonb or p->'ambiguity' is distinct from 'false'::jsonb
    or p->'single_best_answer' is distinct from 'true'::jsonb
    or not(p ? 'answer_source_issue') or p->'answer_source_issue' is distinct from 'null'::jsonb
    or p->>'independent_answer' is distinct from answer or p->>'original_answer' is distinct from answer
    or p->>'source_verification_status' is distinct from 'VERIFIED'
    or p->>'style_evidence_status' is distinct from 'VERIFIED'
    or coalesce(p->>'distractor_quality','') not in ('GOOD','EXCELLENT')
    or p->>'alternative_granularity' is distinct from 'PASS' or p->>'difficulty_alignment' is distinct from 'PASS'
    or jsonb_typeof(p->'hard_fail_reasons') is distinct from 'array' or p->'hard_fail_reasons'<>'[]'::jsonb
    or jsonb_typeof(p->'verified_sources') is distinct from 'array' or p->'verified_sources'='[]'::jsonb
 then raise exception 'Aprovação incompatível com os critérios finais'; end if;
 if exists(select 1 from jsonb_array_elements(p->'verified_sources') s where coalesce(s->>'url','') !~ '^https?://' or nullif(btrim(s->>'document'),'') is null or nullif(btrim(s->>'institution'),'') is null or nullif(btrim(s->>'year'),'') is null) then raise exception 'Fonte verificada incompleta'; end if;
 return true;
end
$$;

-- Runtime functions admin_import_question_factory_review, admin_export_question_factory,
-- admin_import_question_factory_calibration, admin_set_question_factory_block_human_review
-- and admin_question_factory_block_tracker are deployed in Supabase with:
-- * schema versions 2.0/2.3 accepted for migration compatibility;
-- * adversarial failures forcibly rewritten to status=rejected;
-- * chatgpt_initial rejection persisted on the item;
-- * blind export/resolution blocked until current version has approved chatgpt_initial review;
-- * rejected chatgpt_initial items routed back to generation;
-- * raw calibration threshold = 84 (not 94).

revoke all on function private.qf_adversarial_reject_reasons(jsonb,text) from public,anon,authenticated;

commit;
