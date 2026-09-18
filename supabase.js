const SUPABASE_URL =
  "https://sxdsfklllilhdyuamvvg.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_AQ5-Pn1knmBhSFyt5aMtjQ_XQynLJ_L";

window.supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

console.log("Supabase carregado");