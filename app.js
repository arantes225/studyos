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
  const estaNoLogin = document.getElementById("login-btn");

  // Se existe botão de login, esta é a página login.html
  if (estaNoLogin) {
    const signupBtn = document.getElementById("signup-btn");

    estaNoLogin.addEventListener("click", entrar);

    if (signupBtn) {
      signupBtn.addEventListener("click", criarConta);
    }

    return;
  }

  // Se não há botão de login, pode ser o dashboard
  const estaNoDashboard = document.getElementById("logout-btn");

  if (estaNoDashboard) {
    verificarLoginNoDashboard();
  }
});
async function sairDaConta() {
  const { error } = await sb.auth.signOut();

  if (error) {
    alert("Não foi possível sair: " + error.message);
    return;
  }

  window.location.href = "login.html";
}

async function verificarLoginNoDashboard() {
  const {
    data: { user }
  } = await sb.auth.getUser();

  // Se não houver usuário logado, manda a pessoa para login.html
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // Mostra a data atual no dashboard
  const dataElemento = document.getElementById("dashboard-date");

  if (dataElemento) {
    const hoje = new Date();

    dataElemento.textContent = hoje.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
  }

  // Faz o botão "Sair" funcionar
  const botaoSair = document.getElementById("logout-btn");

  if (botaoSair) {
    botaoSair.addEventListener("click", sairDaConta);
  }
}