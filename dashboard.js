const supabase =
  window.supabaseClient;


async function iniciarDashboard() {

  const {
    data: {
      session
    }
  } =
    await supabase.auth.getSession();


  /*
    Usuário não está logado
  */

  if (!session) {

    window.location.href =
      "login.html";

    return;

  }


  const email =
    document.getElementById(
      "dashboard-email"
    );


  const status =
    document.getElementById(
      "dashboard-status"
    );


  email.textContent =
    session.user.email;


  status.textContent =
    "Sessão autenticada com sucesso.";

}


/* =========================================================
   SAIR
========================================================= */

async function sair() {

  const {
    error
  } =
    await supabase.auth.signOut();


  if (error) {

    console.error(error);

    alert(
      "Não foi possível sair."
    );

    return;

  }


  window.location.href =
    "login.html";

}


document
  .getElementById(
    "dashboard-sair"
  )
  .addEventListener(
    "click",
    sair
  );


iniciarDashboard();