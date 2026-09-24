-- Santa Casa-SP validated R4 status restore
update public.question_exam_style_profiles
set
  style_score = 8.8,
  style_score_note = 'Santa Casa-SP R4 validada com style médio 88/100. A V2 antiga de 80/100 permanece apenas como histórico diagnóstico.',
  final_prompt_score = 88,
  calibration_notes = 'Santa Casa-SP R4: PASS. 15/15 concordância cega com gabarito, 0 falhas científicas, 0 falhas de SBA. Mean style 88,1; mediana 89; 13/15 itens >=84. Identidade editorial restaurada e congelada. Limitações residuais pertencem ao gerador/validador global, não ao perfil da banca.',
  prompt_calibration = jsonb_build_object(
    'round','R4',
    'status','CALIBRATED_FROZEN',
    'decision','PROMPT_APPROVED',
    'final_prompt_score',88,
    'mean_style_score',88.1,
    'median_style_score',89,
    'percent_style_ge_84',86.7,
    'cutoff',84,
    'sample_size',15,
    'answer_key_match',15,
    'scientific_fail_count',0,
    'single_best_answer_failure_count',0,
    'identity_status','FROZEN',
    'dashboard_status','ready_for_production',
    'historical_previous_state',jsonb_build_object(
      'version','V2',
      'style_score',80,
      'decision','NEEDS_ANOTHER_CALIBRATION'
    )
  ),
  calibrated_at = now(),
  style_score_updated_at = now(),
  updated_at = now()
where exam_style='Santa Casa-SP';
