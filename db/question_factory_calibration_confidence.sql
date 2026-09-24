-- Calibration confidence normalization
update public.question_exam_style_profiles
set style_confidence_score = case exam_style
  when 'AMP-PR' then 95
  when 'ENAMED' then 90
  when 'Santa Casa-SP' then 90
  when 'PSU-MG' then 85
  when 'SUS-SP' then 80
  else style_confidence_score
end,
updated_at=now()
where exam_style in ('AMP-PR','ENAMED','Santa Casa-SP','PSU-MG','SUS-SP');
