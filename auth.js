const emailInput =
  document.getElementById("email");

const senhaInput =
  document.getElementById("senha");

const botaoEntrar =
  document.getElementById("botao-entrar");

const botaoCriarConta =
  document.getElementById("botao-criar-conta");

const botaoSair =
  document.getElementById("botao-sair");

const mensagem =
  document.getElementById("mensagem-auth");

const formAutenticacao =
  document.getElementById("form-autenticacao");

const usuarioLogado =
  document.getElementById("usuario-logado");

const emailLogado =
  document.getElementById("email-logado");


function mostrarMensagem(texto, tipo = "") {

  mensagem.textContent = texto;

  mensagem.className =
    `mensagem ${tipo}`;
}


function validarCampos() {

  const email =
    emailInput.value.trim();

  const senha =
    senhaInput.value;

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
      "A senha precisa ter pelo menos 6 caracteres.",
      "erro"
    );

    return false;
  }

  return true;
}


/* ============================================================
   ENTRAR
============================================================ */

async function entrar() {

  if (!validarCampos()) {
    return;
  }

  mostrarMensagem(
    "Entrando..."
  );

  botaoEntrar.disabled = true;

  const email =
    emailInput.value.trim();

  const senha =
    senhaInput.value;


  const {
    data,
    error
  } =
    await window.supabaseClient.auth
      .signInWithPassword({
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


  mostrarMensagem(
    "Login realizado com sucesso.",
    "sucesso"
  );


  await atualizarInterfaceUsuario();

}


/* ============================================================
   CRIAR CONTA
============================================================ */

async function criarConta() {

  if (!validarCampos()) {
    return;
  }

  mostrarMensagem(
    "Criando conta..."
  );

  botaoCriarConta.disabled = true;


  const email =
    emailInput.value.trim();

  const senha =
    senhaInput.value;


  const {
    data,
    error
  } =
    await window.supabaseClient.auth
      .signUp({
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


  /*
    Dependendo da configuração do Supabase,
    o usuário pode precisar confirmar o e-mail.
  */

  if (
    data.user &&
    !data.session
  ) {

    mostrarMensagem(
      "Conta criada. Confira seu e-mail para confirmar o cadastro.",
      "sucesso"
    );

    return;
  }


  mostrarMensagem(
    "Conta criada e login realizado.",
    "sucesso"
  );


  await atualizarInterfaceUsuario();

}


/* ============================================================
   SAIR
============================================================ */

async function sair() {

  const {
    error
  } =
    await window.supabaseClient.auth
      .signOut();


  if (error) {

    console.error(error);

    alert(
      "Erro ao sair: " +
      error.message
    );

    return;
  }


  await atualizarInterfaceUsuario();

}


/* ============================================================
   VERIFICAR USUÁRIO
============================================================ */

async function atualizarInterfaceUsuario() {

  const {
    data: {
      session
    }
  } =
    await window.supabaseClient.auth
      .getSession();


  if (
    session &&
    session.user
  ) {

    formAutenticacao.style.display =
      "none";

    usuarioLogado.style.display =
      "block";

    emailLogado.textContent =
      session.user.email;

    return;
  }


  formAutenticacao.style.display =
    "block";

  usuarioLogado.style.display =
    "none";

  emailLogado.textContent =
    "";

}


/* ============================================================
   TRADUZIR ERROS COMUNS
============================================================ */

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


/* ============================================================
   EVENTOS
============================================================ */

botaoEntrar.addEventListener(
  "click",
  entrar
);


botaoCriarConta.addEventListener(
  "click",
  criarConta
);


botaoSair.addEventListener(
  "click",
  sair
);


/* Permitir ENTER para entrar */

senhaInput.addEventListener(
  "keydown",
  (evento) => {

    if (
      evento.key === "Enter"
    ) {

      entrar();

    }

  }
);


/* ============================================================
   INICIALIZAÇÃO
============================================================ */

atualizarInterfaceUsuario();