const supabase =
  window.supabaseClient;


async function verificarUsuario() {

  const status =
    document.getElementById("status");

  const email =
    document.getElementById("email");


  const {
    data: { session },
    error
  } =
    await supabase.auth.getSession();


  if (error) {

    console.error(error);

    status.textContent =
      "Erro: " + error.message;

    return;

  }


  if (!session) {

    email.textContent =
      "nenhum usuário";

    status.textContent =
      "Você NÃO está logado.";

    return;

  }


  email.textContent =
    session.user.email;


  status.textContent =
    "Você está logado corretamente.";

}


async function sair() {

  await supabase.auth.signOut();

  window.location.href =
    "login.html";

}


document
  .getElementById("sair")
  .addEventListener(
    "click",
    sair
  );


verificarUsuario();