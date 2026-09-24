-- AMP-PR validated status restore
update public.question_exam_style_profiles
set
  style_score = 9.38,
  style_score_note = 'AMP-PR validada em rodada posterior com 93,8/100. A V2 de 85/100 permanece apenas como histórico e não representa o estado atual.',
  final_prompt_score = 93.8,
  calibration_notes = 'AMP-PR já validada/calibrada. Estado restaurado para CALIBRADO/CONGELADO para produção com FINAL_PROMPT_SCORE 93,8/100. A V2 antiga (85/100, NEEDS_ANOTHER_CALIBRATION) permanece como histórico diagnóstico e não substitui a versão aprovada.',
  prompt_calibration = jsonb_build_object(
    'status','CALIBRATED_FROZEN',
    'decision','PROMPT_APPROVED',
    'final_prompt_score',93.8,
    'cutoff',84,
    'identity_status','FROZEN',
    'dashboard_status','ready_for_production',
    'historical_previous_state',jsonb_build_object(
      'version','V2',
      'style_score',85,
      'decision','NEEDS_ANOTHER_CALIBRATION'
    )
  ),
  calibrated_at = now(),
  style_score_updated_at = now(),
  updated_at = now()
where exam_style='AMP-PR';
