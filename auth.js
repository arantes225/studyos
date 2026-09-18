console.log("auth.js carregado");

const supabase =
  window.supabaseClient;

const emailInput =
  document.getElementById("email");

const senhaInput =
  document.getElementById("senha");

const botaoEntrar =
  document.getElementById("entrar");

const botaoCriar =
  document.getElementById("criar-conta");

const mensagem =
  document.getElementById("mensagem");


function mostrarMensagem(
  texto,
  erro = false
) {

  mensagem.textContent =
    texto;

  mensagem.style.color =
    erro
      ? "red"
      : "green";

}


/* =====================================================
   LOGIN
===================================================== */

async function entrar() {

  console.log(
    "Botão entrar clicado"
  );


  const email =
    emailInput.value.trim();

  const senha =
    senhaInput.value;


  if (
    !email ||
    !senha
  ) {

    mostrarMensagem(
      "Preencha e-mail e senha.",
      true
    );

    return;

  }


  mostrarMensagem(
    "Entrando..."
  );


  const {
    data,
    error
  } =
    await supabase.auth
      .signInWithPassword({

        email: email,

        password: senha

      });


  if (error) {

    console.error(
      error
    );


    mostrarMensagem(
      error.message,
      true
    );

    return;

  }


  console.log(
    "Login realizado:",
    data
  );


  mostrarMensagem(
    "Login realizado com sucesso."
  );


  window.location.href =
    "dashboard.html";

}


/* =====================================================
   CRIAR CONTA
===================================================== */

async function criarConta() {

  console.log(
    "Botão criar conta clicado"
  );


  const email =
    emailInput.value.trim();

  const senha =
    senhaInput.value;


  if (
    !email ||
    !senha
  ) {

    mostrarMensagem(
      "Preencha e-mail e senha.",
      true
    );

    return;

  }


  if (
    senha.length < 6
  ) {

    mostrarMensagem(
      "A senha precisa ter pelo menos 6 caracteres.",
      true
    );

    return;

  }


  mostrarMensagem(
    "Criando conta..."
  );


  const {
    data,
    error
  } =
    await supabase.auth
      .signUp({

        email: email,

        password: senha

      });


  if (error) {

    console.error(
      error
    );


    mostrarMensagem(
      error.message,
      true
    );

    return;

  }


  console.log(
    "Conta criada:",
    data
  );


  if (
    data.session
  ) {

    window.location.href =
      "dashboard.html";

    return;

  }


  mostrarMensagem(
    "Conta criada. Verifique seu e-mail para confirmar o cadastro."
  );

}


/* =====================================================
   EVENTOS
===================================================== */

botaoEntrar.addEventListener(
  "click",
  entrar
);


botaoCriar.addEventListener(
  "click",
  criarConta
);


senhaInput.addEventListener(
  "keydown",
  function(evento) {

    if (
      evento.key === "Enter"
    ) {

      entrar();

    }

  }
);


/* =====================================================
   TESTE
===================================================== */

console.log(
  "Botão entrar:",
  botaoEntrar
);

console.log(
  "Botão criar conta:",
  botaoCriar
);

console.log(
  "Cliente Supabase:",
  supabase
);