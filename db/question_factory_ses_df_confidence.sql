-- SES-DF calibration confidence
update public.question_exam_style_profiles
set
  style_confidence_score = 85,
  updated_at = now()
where exam_style='SES-DF';
