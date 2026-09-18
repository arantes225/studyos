const SUPABASE_URL =
  "https://ietitoxjojsdiuridrfk.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_4q_xxpp87T5OCPIrkszEng_mLSLGAhP";

window.supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );