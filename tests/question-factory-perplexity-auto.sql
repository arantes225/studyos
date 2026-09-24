-- Regression checks for the automatic Perplexity audit pipeline.
begin;

do $$
declare
  good jsonb;
  rejected_missing_field boolean := false;
begin
  if to_regprocedure('private.qf_assert_perplexity_review_v34(jsonb,text)') is null then
    raise exception 'Missing private.qf_assert_perplexity_review_v34(jsonb,text)';
  end if;
  if to_regprocedure('public.admin_question_factory_review_coverage(integer,integer,text,text,integer,integer)') is null then
    raise exception 'Missing admin_question_factory_review_coverage';
  end if;
  if to_regprocedure('public.admin_question_factory_next_perplexity_item(integer,integer,integer,integer,text)') is null then
    raise exception 'Missing admin_question_factory_next_perplexity_item';
  end if;
  if to_regclass('public.question_factory_reviews_perplexity_logical_uq') is null then
    raise exception 'Missing Perplexity idempotency index';
  end if;

  good := '{
    "original_answer":"A",
    "independent_answer":"A",
    "answer_agreement":"agree",
    "confidence":"high",
    "ambiguity":false,
    "single_best_answer":true,
    "hard_fail":false,
    "hard_fail_reasons":[],
    "surface_guess_without_vignette":"B",
    "surface_guess_confidence":"low",
    "lexical_asymmetry":"PASS",
    "vignette_dependency":"PASS",
    "best_distractor":"B",
    "best_distractor_rationale":"Concorrente plausível antes do dado decisivo.",
    "counterfactual_change":"Uma mudança clínica pequena tornaria B defensável.",
    "functional_killer_1_option":"B",
    "functional_killer_1":"Dado funcional específico que elimina B.",
    "functional_killer_2_option":"C",
    "functional_killer_2":"Outro dado funcional específico que elimina C.",
    "explanation_checks":{
      "A":{"status":"PASS","reason":"Explica a correta."},
      "B":{"status":"PASS","reason":"Explica o erro de B."},
      "C":{"status":"PASS","reason":"Explica o erro de C."},
      "D":{"status":"PASS","reason":"Explica o erro de D."}
    },
    "message_key_check":{"status":"PASS","reason":"Discriminativa.","decisive_feature":"Dado decisivo."},
    "source_verification_status":"VERIFIED",
    "source_checks":[{
      "institution":"Instituição",
      "document":"Documento",
      "year":"2026",
      "url":"https://example.org/doc",
      "section":"Seção 1",
      "verification_status":"VERIFIED",
      "url_reachable":true,
      "title_match":true,
      "year_match":true,
      "section_found":true,
      "supports_answer":true
    }],
    "verified_sources":[{
      "institution":"Instituição","document":"Documento","year":"2026",
      "url":"https://example.org/doc","section":"Seção 1"
    }],
    "proposed_change":{"change_required":false,"exact_replacement":{},"reason":""},
    "scientific_issue":null,
    "source_issue":null,
    "answer_source_issue":null,
    "explanation_issue":null,
    "distractor_issue":null,
    "style_issue":null,
    "wording_issue":null,
    "difficulty_issue":null,
    "distractor_quality":"GOOD",
    "alternative_granularity":"PASS",
    "difficulty_alignment":"PASS"
  }'::jsonb;

  perform private.qf_assert_perplexity_review_v34(good,'A');

  begin
    perform private.qf_assert_perplexity_review_v34(good - 'functional_killer_2','A');
  exception when others then
    rejected_missing_field := true;
  end;

  if not rejected_missing_field then
    raise exception 'Strict validator accepted review without functional_killer_2';
  end if;
end
$$;

rollback;
