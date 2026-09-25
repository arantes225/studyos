const sb = window.supabaseClient;

const form = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const senhaInput = document.getElementById("senha");
const entrarButton = document.getElementById("entrar");
const criarButton = document.getElementById("criar-conta");
const passkeyButton = document.getElementById("passkey-login");
const mensagem = document.getElementById("mensagem");

const AUTH_STORAGE_KEY = "sb-sxdsfklllilhdyuamvvg-auth-token";

function mostrarMensagem(texto, tipo = "") {
  mensagem.textContent = texto;
  mensagem.className = `auth-message ${tipo}`.trim();
}

function setCarregando(ativo) {
  entrarButton.disabled = ativo;
  criarButton.disabled = ativo;
  if (passkeyButton) passkeyButton.disabled = ativo;
}

function isNetworkError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("load failed")
  );
}

function limparSessaoLocalCorrompida() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (_) {}
}

async function tentarLogin(email, password) {
  try {
    const result = await sb.auth.signInWithPassword({ email, password });
    return result;
  } catch (error) {
    return { data: null, error };
  }
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

  let result = await tentarLogin(email, password);

  // Uma falha de rede não comprova corrupção da sessão. Preserve o estado local
  // e deixe uma nova tentativa explícita a cargo do usuário.

  if (result.error) {
    const message = isNetworkError(result.error)
      ? "Não foi possível conectar ao servidor de autenticação. Atualize a página e tente novamente."
      : result.error.message;

    mostrarMensagem(message, "error");
    setCarregando(false);
    return;
  }

  window.location.replace("/dashboard/");
}

async function entrarComPasskey() {
  if (!passkeyButton || !window.PublicKeyCredential || !sb?.auth?.signInWithPasskey) {
    mostrarMensagem("Este dispositivo ou navegador não oferece suporte a Passkeys.", "error");
    return;
  }

  setCarregando(true);
  mostrarMensagem("Confirme sua identidade no dispositivo...");

  try {
    const { data, error } = await sb.auth.signInWithPasskey();

    if (error) {
      const msg = String(error.message || error);
      mostrarMensagem(
        msg.toLowerCase().includes("passkey_disabled")
          ? "A entrada por Passkey ainda não está habilitada no servidor."
          : msg,
        "error"
      );
      return;
    }

    if (data?.session) {
      window.location.replace("/dashboard/");
      return;
    }

    mostrarMensagem("Não foi possível concluir a autenticação por Passkey.", "error");
  } catch (error) {
    const name = String(error?.name || "");
    mostrarMensagem(
      name === "NotAllowedError"
        ? "Autenticação cancelada ou não autorizada no dispositivo."
        : "Não foi possível usar a Passkey neste dispositivo.",
      "error"
    );
  } finally {
    setCarregando(false);
  }
}

async function criarConta() {
  const email = emailInput.value.trim();
  const password = senhaInput.value;

  if (!email || !password) {
    mostrarMensagem("Preencha e-mail e senha.", "error");
    return;
  }

  if (password.length < 8) {
    mostrarMensagem("Use uma senha com pelo menos 8 caracteres.", "error");
    return;
  }

  setCarregando(true);
  mostrarMensagem("Criando conta...");

  try {
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
  } catch (error) {
    mostrarMensagem(
      isNetworkError(error)
        ? "Não foi possível conectar ao servidor de autenticação."
        : "Não foi possível criar a conta.",
      "error"
    );
  } finally {
    setCarregando(false);
  }
}

(async function verificarSessao() {
  try {
    const { data, error } = await sb.auth.getSession();

    if (error && isNetworkError(error)) {
      limparSessaoLocalCorrompida();
      return;
    }

    if (data?.session) {
      window.location.replace("/dashboard/");
    }
  } catch (error) {
    if (isNetworkError(error)) {
      limparSessaoLocalCorrompida();
    }
  }
})();

form.addEventListener("submit", entrar);
criarButton.addEventListener("click", criarConta);

if (passkeyButton) {
  const supported = Boolean(window.PublicKeyCredential && sb?.auth?.signInWithPasskey);
  passkeyButton.hidden = !supported;
  if (supported) {
    passkeyButton.addEventListener("click", entrarComPasskey);
  }
}
