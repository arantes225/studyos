# Plantão — importação dos 200 casos

Arquivos SQL de publicação dos 200 novos casos clínicos, divididos em quatro partes de 50 casos.

Execute as partes 1 → 4 no projeto Supabase da LURIA. Os inserts usam `ON CONFLICT (slug) DO UPDATE`, portanto são idempotentes.
