const SUPABASE_URL = "SUA_URL_DO_SUPABASE";

const SUPABASE_KEY = "SUA_CHAVE_PUBLICA_DO_SUPABASE";


const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );


async function testarConexao() {

  const status =
    document.getElementById("status");

  try {

    const { data, error } =
      await supabaseClient
        .from("flashcards")
        .select("id")
        .limit(1);


    if (error) {

      console.error(
        "Erro Supabase:",
        error
      );

      status.className =
        "status erro";

      status.textContent =
        "❌ Erro na conexão: " +
        error.message;

      return;

    }


    console.log(
      "Supabase conectado:",
      data
    );


    status.className =
      "status sucesso";

    status.textContent =
      "✅ Supabase conectado com sucesso.";

  }

  catch (erro) {

    console.error(
      "Erro inesperado:",
      erro
    );


    status.className =
      "status erro";

    status.textContent =
      "❌ Não foi possível conectar ao Supabase.";

  }

}


testarConexao();