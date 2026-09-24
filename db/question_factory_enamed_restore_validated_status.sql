-- ENAMED calibration status correction
-- Restores the previously validated baseline as the live status used by the admin dashboard.

update public.question_exam_style_profiles
set
  final_prompt_score = 84,
  calibration_notes = 'ENAMED já validado/calibrado em rodada anterior. Estado atual corrigido para CALIBRADO/CONGELADO para produção. Auditorias experimentais posteriores com notas menores permanecem apenas como histórico diagnóstico e não substituem a versão aprovada. Preservar identidade ENAMED e aplicar apenas gates globais atuais.',
  prompt_calibration = jsonb_build_object(
    'status','CALIBRATED_FROZEN',
    'decision','PROMPT_APPROVED',
    'final_prompt_score',84,
    'cutoff',84,
    'identity_status','FROZEN',
    'note','Versão previamente validada; auditorias posteriores com regressão não substituem o baseline aprovado.',
    'dashboard_status','ready_for_production'
  ),
  calibrated_at = now(),
  updated_at = now()
where exam_style='ENAMED';
