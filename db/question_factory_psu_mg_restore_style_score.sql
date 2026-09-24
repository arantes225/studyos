-- PSU-MG editorial fidelity restore
update public.question_exam_style_profiles
set
  style_score = 8.42,
  style_score_note = 'PSU-MG R4 aprovada: fidelidade editorial média 84,2/100 (8,42/10), mediana 86/100. Perfil congelado para produção.',
  style_score_updated_at = now(),
  updated_at = now()
where exam_style='PSU-MG';
