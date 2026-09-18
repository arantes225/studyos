const SUPABASE_URL =
  "https://sxdsfklllilhdyuamvvg.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_AQ5-Pn1knmBhSFyt5aMtjQ_XQynLJ_L";


const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );


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
  tipo = ""
) {

  mensagem.textContent =
    texto;


  if (tipo === "erro") {

    mensagem.style.color =
      "#dc2626";

  }

  else if (
    tipo === "sucesso"
  ) {

    mensagem.style.color =
      "#16a34a";

  }

  else {

    mensagem.style.color =
      "#374151";

  }

}


/* =====================================================
   LOGIN
===================================================== */

async function entrar() {

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
      "erro"
    );

    return;

  }


  mostrarMensagem(
    "Entrando..."
  );


  botaoEntrar.disabled =
    true;


  const {
    data,
    error
  } =
    await supabaseClient.auth
      .signInWithPassword({

        email,

        password: senha

      });


  botaoEntrar.disabled =
    false;


  if (error) {

    console.error(
      error
    );


    if (
      error.message.includes(
        "Invalid login credentials"
      )
    ) {

      mostrarMensagem(
        "E-mail ou senha incorretos.",
        "erro"
      );

    }

    else {

      mostrarMensagem(
        error.message,
        "erro"
      );

    }

    return;

  }


  if (
    data.session
  ) {

    window.location.href =
      "dashboard.html";

  }

}


/* =====================================================
   CRIAR CONTA
===================================================== */

async function criarConta() {

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
      "erro"
    );

    return;

  }


  if (
    senha.length < 6
  ) {

    mostrarMensagem(
      "A senha precisa ter pelo menos 6 caracteres.",
      "erro"
    );

    return;

  }


  mostrarMensagem(
    "Criando conta..."
  );


  botaoCriar.disabled =
    true;


  const {
    data,
    error
  } =
    await supabaseClient.auth
      .signUp({

        email,

        password: senha

      });


  botaoCriar.disabled =
    false;


  if (error) {

    console.error(
      error
    );


    mostrarMensagem(
      error.message,
      "erro"
    );

    return;

  }


  /*
    Se confirmação de e-mail
    estiver desativada.
  */

  if (
    data.session
  ) {

    window.location.href =
      "dashboard.html";

    return;

  }


  /*
    Se confirmação de e-mail
    estiver ativada.
  */

  mostrarMensagem(
    "Conta criada. Verifique seu e-mail para confirmar o cadastro.",
    "sucesso"
  );

}


/* =====================================================
   ENTER
===================================================== */

senhaInput.addEventListener(
  "keydown",
  function(evento) {

    if (
      evento.key ===
      "Enter"
    ) {

      entrar();

    }

  }
);


/* =====================================================
   BOTÕES
===================================================== */

botaoEntrar.addEventListener(
  "click",
  entrar
);


botaoCriar.addEventListener(
  "click",
  criarConta
);


/* =====================================================
   SE JÁ ESTIVER LOGADO
===================================================== */

async function verificarSessao() {

  const {
    data: {
      session
    }
  } =
    await supabaseClient.auth
      .getSession();


  if (
    session
  ) {

    window.location.href =
      "dashboard.html";

  }

}


verificarSessao();