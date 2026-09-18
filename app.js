const SUPABASE_URL = "https://ietitoxjojsdiuridr​​fk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ReynfGuOnOGco0kf7NO_Jw__frEPrb0";

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function criarConta() {
  const email = document.getElementById("signup-email").value.trim();
  const senha = document.getElementById("signup-password").value;
  const mensagem = document.getElementById("signup-msg");

  mensagem.textContent = "";

  if (!email || !senha) {
    mensagem.textContent = "Preencha o e-mail e a senha.";
    return;
  }

  if (senha.length < 6) {
    mensagem.textContent = "A senha precisa ter pelo menos 6 caracteres.";
    return;
  }

  try {
    const { error } = await sb.auth.signUp({
      email,
      password: senha
    });

    if (error) throw error;

    mensagem.textContent =
      "Conta criada. Verifique seu e-mail se essa opção estiver ativada no Supabase.";
  } catch (error) {
    mensagem.textContent = "Erro ao criar conta: " + error.message;
  }
}

async function entrar() {
  const email = document.getElementById("login-email").value.trim();
  const senha = document.getElementById("login-password").value;
  const mensagem = document.getElementById("login-msg");

  mensagem.textContent = "";

  if (!email || !senha) {
    mensagem.textContent = "Preencha o e-mail e a senha.";
    return;
  }

  try {
    const { error } = await sb.auth.signInWithPassword({
      email,
      password: senha
    });

    if (error) throw error;

    mensagem.textContent = "Login realizado. Abrindo o dashboard...";

    setTimeout(() => {
      window.location.href = "index.html";
    }, 800);
  } catch (error) {
    mensagem.textContent = "Erro ao entrar: " + error.message;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("login-btn");
  const signupBtn = document.getElementById("signup-btn");

  if (loginBtn) {
    loginBtn.addEventListener("click", entrar);
  }

  if (signupBtn) {
    signupBtn.addEventListener("click", criarConta);
  }
});