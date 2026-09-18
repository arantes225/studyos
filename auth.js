const supabase = window.supabaseClient;

const emailInput = document.getElementById("email");
const senhaInput = document.getElementById("senha");

const botaoEntrar = document.getElementById("botao-entrar");
const botaoCriarConta = document.getElementById("botao-criar-conta");
const botaoSair = document.getElementById("botao-sair");

const mensagem = document.getElementById("mensagem-auth");

const formAutenticacao =
  document.getElementById("form-autenticacao");

const usuarioLogado =
  document.getElementById("usuario-logado");

const emailLogado =
  document.getElementById("email-logado");


/* =========================================================
   MENSAGENS
========================================================= */

function mostrarMensagem(texto, tipo = "") {
  if (!mensagem) return;

  mensagem.textContent = texto;
  mensagem.className = `mensagem ${tipo}`;
}


/* =========================================================
   VALIDAR CAMPOS
========================================================= */

function validarCampos() {
  const email = emailInput.value.trim();
  const senha = senhaInput.value;

  if (!email) {
    mostrarMensagem(
      "Digite seu e-mail.",
      "erro"
    );

    return false;
  }

  if (!senha) {
    mostrarMensagem(
      "Digite sua senha.",
      "erro"
    );

    return false;
  }

  if (senha.length < 6) {
    mostrarMensagem(
      "A senha deve ter pelo menos 6 caracteres.",
      "erro"
    );

    return false;
  }

  return true;
}


/* =========================================================
   ENTRAR
========================================================= */

async function entrar() {
  if (!validarCampos()) return;

  mostrarMensagem("Entrando...");

  botaoEntrar.disabled = true;

  const email = emailInput.value.trim();
  const senha = senhaInput.value;

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password: senha
    });

  botaoEntrar.disabled = false;

  if (error) {
    console.error(error);

    mostrarMensagem(
      traduzirErro(error.message),
      "erro"
    );

    return;
  }

  if (data.session) {
    mostrarMensagem(
      "Login realizado.",
      "sucesso"
    );

    window.location.href =
  "teste-auth.html";
  }
}


/* =========================================================
   CRIAR CONTA
========================================================= */

async function criarConta() {
  if (!validarCampos()) return;

  mostrarMensagem("Criando conta...");

  botaoCriarConta.disabled = true;

  const email = emailInput.value.trim();
  const senha = senhaInput.value;

  const { data, error } =
    await supabase.auth.signUp({
      email,
      password: senha
    });

  botaoCriarConta.disabled = false;

  if (error) {
    console.error(error);

    mostrarMensagem(
      traduzirErro(error.message),
      "erro"
    );

    return;
  }

  if (data.session) {
    window.location.href =
      "dashboard.html";

    return;
  }

  mostrarMensagem(
    "Conta criada. Verifique seu e-mail para confirmar o cadastro.",
    "sucesso"
  );
}


/* =========================================================
   SAIR
========================================================= */

async function sair() {
  const { error } =
    await supabase.auth.signOut();

  if (error) {
    console.error(error);

    mostrarMensagem(
      "Erro ao sair.",
      "erro"
    );

    return;
  }

  window.location.href =
    "login.html";
}


/* =========================================================
   VERIFICAR SESSÃO
========================================================= */

async function verificarSessao() {
  const {
    data: { session }
  } =
    await supabase.auth.getSession();

  if (!session) {
    if (formAutenticacao) {
      formAutenticacao.style.display =
        "block";
    }

    if (usuarioLogado) {
      usuarioLogado.style.display =
        "none";
    }

    return;
  }

  /*
    Se já estiver logado e abrir login.html,
    manda direto para o dashboard.
  */

  window.location.href =
    "dashboard.html";
}


/* =========================================================
   ERROS
========================================================= */

function traduzirErro(erro) {
  if (
    erro.includes(
      "Invalid login credentials"
    )
  ) {
    return "E-mail ou senha incorretos.";
  }

  if (
    erro.includes(
      "Email not confirmed"
    )
  ) {
    return "Confirme seu e-mail antes de entrar.";
  }

  if (
    erro.includes(
      "User already registered"
    )
  ) {
    return "Já existe uma conta com este e-mail.";
  }

  if (
    erro.includes(
      "Password should be"
    )
  ) {
    return "A senha não atende aos requisitos mínimos.";
  }

  return erro;
}


/* =========================================================
   EVENTOS
========================================================= */

if (botaoEntrar) {
  botaoEntrar.addEventListener(
    "click",
    entrar
  );
}

if (botaoCriarConta) {
  botaoCriarConta.addEventListener(
    "click",
    criarConta
  );
}

if (botaoSair) {
  botaoSair.addEventListener(
    "click",
    sair
  );
}

if (senhaInput) {
  senhaInput.addEventListener(
    "keydown",
    (evento) => {
      if (evento.key === "Enter") {
        entrar();
      }
    }
  );
}


/* =========================================================
   INICIAR
========================================================= */

verificarSessao();