const STUDYOS_SUPABASE_URL =
  "https://kkyqgcirishgqjyqafzd.supabase.co";

const STUDYOS_SUPABASE_KEY =
  "sb_publishable_ReynfGuOnOGco0kf7NO_Jw__frEPrb0   ietitoxjojsdiuridrfk";

const clienteSupabase = window.supabase.createClient(
  STUDYOS_SUPABASE_URL,
  STUDYOS_SUPABASE_KEY
);

let usuarioAtual = null;

async function verificarLogin() {
  const {
    data: { session },
  } = await clienteSupabase.auth.getSession();

  if (!session) {
    window.location.href = "index.html";
    return null;
  }

  usuarioAtual = session.user;

  return session;
}