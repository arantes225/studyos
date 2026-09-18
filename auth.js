const supabase = window.studyos.supabase;

const emailInput = document.getElementById("email");
const senhaInput = document.getElementById("senha");
const botaoEntrar = document.getElementById("botao-entrar");
const botaoCriarConta = document.getElementById("botao-criar-conta");
const mensagem = document.getElementById("mensagem-auth");

function showMessage(text, type = "") {
  mensagem.textContent = text;
  mensagem.className = `message ${type}`;
}

function validate() {
  const email = emailInput.value.trim();
  const password = senhaInput.value;

  if (!email) {
    showMessage("Digite seu e-mail.", "error");
    return false;
  }

  if (!password || password.length < 6) {
    showMessage("A senha deve ter pelo menos 6 caracteres.", "error");
    return false;
  }

  return true;
}

function translateError(message) {
  if (message.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
  if (message.includes("Email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (message.includes("User already registered")) return "Já existe uma conta com este e-mail.";
  if (message.includes("Password should be")) return "A senha não atende aos requisitos mínimos.";
  return message;
}

async function login() {
  if (!validate()) return;

  botaoEntrar.disabled = true;
  showMessage("Entrando...");

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailInput.value.trim(),
    password: senhaInput.value
  });

  botaoEntrar.disabled = false;

  if (error) {
    showMessage(translateError(error.message), "error");
    return;
  }

  if (data.session) {
    window.location.href = "dashboard.html";
  }
}

async function signUp() {
  if (!validate()) return;

  botaoCriarConta.disabled = true;
  showMessage("Criando conta...");

  const { data, error } = await supabase.auth.signUp({
    email: emailInput.value.trim(),
    password: senhaInput.value
  });

  botaoCriarConta.disabled = false;

  if (error) {
    showMessage(translateError(error.message), "error");
    return;
  }

  if (data.session) {
    window.location.href = "dashboard.html";
    return;
  }

  showMessage("Conta criada. Verifique seu e-mail para confirmar o cadastro.", "success");
}

botaoEntrar.addEventListener("click", login);
botaoCriarConta.addEventListener("click", signUp);
senhaInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") login();
});

(async () => {
  const session = await window.studyos.getSession();
  if (session) window.location.href = "dashboard.html";
})();