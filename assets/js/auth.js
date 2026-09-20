const sb = window.supabaseClient;

const form = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const senhaInput = document.getElementById("senha");
const entrarButton = document.getElementById("entrar");
const criarButton = document.getElementById("criar-conta");
const mensagem = document.getElementById("mensagem");

function mostrarMensagem(texto, tipo = "") {
  mensagem.textContent = texto;
  mensagem.className = `auth-message ${tipo}`.trim();
}

function setCarregando(ativo) {
  entrarButton.disabled = ativo;
  criarButton.disabled = ativo;
}

async function entrar(event) {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = senhaInput.value;

  if (!email || !password) {
    mostrarMensagem("Preencha e-mail e senha.", "error");
    return;
  }

  setCarregando(true);
  mostrarMensagem("Entrando...");

  const { error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    mostrarMensagem(error.message, "error");
    setCarregando(false);
    return;
  }

  window.location.replace("/dashboard/");
}

async function criarConta() {
  const email = emailInput.value.trim();
  const password = senhaInput.value;

  if (!email || !password) {
    mostrarMensagem("Preencha e-mail e senha.", "error");
    return;
  }

  if (password.length < 6) {
    mostrarMensagem("Use uma senha com pelo menos 6 caracteres.", "error");
    return;
  }

  setCarregando(true);
  mostrarMensagem("Criando conta...");

  const { data, error } = await sb.auth.signUp({ email, password });

  if (error) {
    if (error.message.toLowerCase().includes("rate limit")) {
      mostrarMensagem(
        "O Supabase limitou temporariamente os e-mails de cadastro. Use a conta já criada ou tente novamente mais tarde.",
        "error"
      );
    } else {
      mostrarMensagem(error.message, "error");
    }

    setCarregando(false);
    return;
  }

  if (data.session) {
    window.location.replace("/dashboard/");
    return;
  }

  mostrarMensagem(
    "Conta criada. Se a confirmação por e-mail estiver ativa, confirme o e-mail antes de entrar.",
    "success"
  );
  setCarregando(false);
}

(async function verificarSessao() {
  const { data } = await sb.auth.getSession();

  if (data.session) {
    window.location.replace("/dashboard/");
  }
})();

form.addEventListener("submit", entrar);
criarButton.addEventListener("click", criarConta);
