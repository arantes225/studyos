const SUPABASE_URL =
  "https://sxdsfklllilhdyuamvvg.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_AQ5-Pn1knmBhSFyt5aMtjQ_XQynLJ_L";


const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );


const emailUsuario =
  document.getElementById(
    "email-usuario"
  );

const status =
  document.getElementById(
    "status"
  );

const botaoSair =
  document.getElementById(
    "sair"
  );


/* =====================================================
   CARREGAR DASHBOARD
===================================================== */

async function iniciarDashboard() {

  const {
    data: {
      session
    },
    error
  } =
    await supabaseClient.auth
      .getSession();


  if (error) {

    console.error(
      error
    );


    status.textContent =
      "Erro ao verificar sessão.";

    return;

  }


  /*
    Não está logado.
  */

  if (
    !session
  ) {

    window.location.href =
      "login.html";

    return;

  }


  emailUsuario.textContent =
    session.user.email;


  status.textContent =
    "Sessão autenticada.";

}


/* =====================================================
   SAIR
===================================================== */

async function sair() {

  botaoSair.disabled =
    true;


  const {
    error
  } =
    await supabaseClient.auth
      .signOut();


  if (error) {

    console.error(
      error
    );


    alert(
      error.message
    );


    botaoSair.disabled =
      false;

    return;

  }


  window.location.href =
    "login.html";

}


botaoSair.addEventListener(
  "click",
  sair
);


iniciarDashboard();