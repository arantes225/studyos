const SUPABASE_URL = "https://ietitoxjojsdiuridr​​fk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ReynfGuOnOGco0kf7NO_Jw__frEPrb0";

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function criarConta() {
  const email = document.getElementById("signup-email").value.trim();
  const senha = document.getElementById("signup-password").value;
  const mensagem = document.getElementById("signup-msg");

  mensagem.textContent = "";

  if (!email || !senha) {
    mensagem.textContent = "Preencha o e-mail e a senha.";
    return;
  }

  if (senha.length < 6) {
    mensagem.textContent = "A senha precisa ter pelo menos 6 caracteres.";
    return;
  }

  try {
    const { error } = await sb.auth.signUp({
      email,
      password: senha
    });

    if (error) throw error;

    mensagem.textContent =
      "Conta criada. Verifique seu e-mail se essa opção estiver ativada no Supabase.";
  } catch (error) {
    mensagem.textContent = "Erro ao criar conta: " + error.message;
  }
}

async function entrar() {
  const email = document.getElementById("login-email").value.trim();
  const senha = document.getElementById("login-password").value;
  const mensagem = document.getElementById("login-msg");

  mensagem.textContent = "";

  if (!email || !senha) {
    mensagem.textContent = "Preencha o e-mail e a senha.";
    return;
  }

  try {
    const { error } = await sb.auth.signInWithPassword({
      email,
      password: senha
    });

    if (error) throw error;

    mensagem.textContent = "Login realizado. Abrindo o dashboard...";

    setTimeout(() => {
      window.location.href = "index.html";
    }, 800);
  } catch (error) {
    mensagem.textContent = "Erro ao entrar: " + error.message;
  }
}
function formatarData(dataIso) {
  const [ano, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}/${ano}`;
}

async function carregarAulas() {
  const lista = document.getElementById("lista-aulas");

  if (!lista) return;

  const {
    data: { user }
  } = await sb.auth.getUser();

  if (!user) return;

  lista.innerHTML = '<p class="empty-state">Carregando aulas...</p>';

  const { data: aulas, error } = await sb
    .from("cronograma_aulas")
    .select("*")
    .eq("user_id", user.id)
    .order("data", { ascending: true })
    .order("horario_inicio", { ascending: true });

  if (error) {
    lista.innerHTML = `<p class="empty-state">Erro ao carregar: ${error.message}</p>`;
    return;
  }

  if (!aulas || aulas.length === 0) {
    lista.innerHTML =
      '<p class="empty-state">Você ainda não cadastrou nenhuma aula.</p>';
    return;
  }

  lista.innerHTML = "";

  aulas.forEach((aula) => {
    const item = document.createElement("article");
    item.className = "aula-list-item";

    const horario =
      aula.horario_inicio
        ? `${aula.horario_inicio.slice(0, 5)}${aula.horario_fim ? ` – ${aula.horario_fim.slice(0, 5)}` : ""}`
        : "Horário não definido";

    item.innerHTML = `
      <div>
        <h3>${aula.tema}</h3>
        <p>${aula.disciplina || "Sem disciplina"} · ${formatarData(aula.data)}</p>
        <p>${horario}</p>
      </div>
      <span class="aula-status ${aula.status}">
        ${aula.status}
      </span>
    `;

    lista.appendChild(item);
  });
}

async function salvarAula(event) {
  event.preventDefault();

  const mensagem = document.getElementById("aula-msg");
  const data = document.getElementById("aula-data").value;
  const disciplina = document.getElementById("aula-disciplina").value.trim();
  const tema = document.getElementById("aula-tema").value.trim();
  const horarioInicio = document.getElementById("aula-inicio").value || null;
  const horarioFim = document.getElementById("aula-fim").value || null;

  mensagem.textContent = "";

  if (!data || !tema) {
    mensagem.textContent = "Preencha a data e o tema da aula.";
    return;
  }

  const {
    data: { user }
  } = await sb.auth.getUser();

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  mensagem.textContent = "Salvando aula...";

  const { error } = await sb
    .from("cronograma_aulas")
    .insert([
      {
        user_id: user.id,
        data,
        disciplina: disciplina || null,
        tema,
        horario_inicio: horarioInicio,
        horario_fim: horarioFim,
        status: "pendente"
      }
    ]);

  if (error) {
    mensagem.textContent = "Erro ao salvar: " + error.message;
    return;
  }

  mensagem.textContent = "Aula salva com sucesso.";

  document.getElementById("aula-form").reset();

  carregarAulas();
}

function iniciarPaginaCronograma() {
  verificarLoginNoDashboard();

  const formulario = document.getElementById("aula-form");
  const botaoAtualizar = document.getElementById("atualizar-aulas-btn");

  if (formulario) {
    formulario.addEventListener("submit", salvarAula);
  }

  if (botaoAtualizar) {
    botaoAtualizar.addEventListener("click", carregarAulas);
  }

  carregarAulas();
}

document.addEventListener("DOMContentLoaded", () => {
  const estaNoLogin = document.getElementById("login-btn");

  if (estaNoLogin) {
    const signupBtn = document.getElementById("signup-btn");

    estaNoLogin.addEventListener("click", entrar);

    if (signupBtn) {
      signupBtn.addEventListener("click", criarConta);
    }

    return;
  }

  const estaNoDashboard = document.getElementById("logout-btn");

  if (estaNoDashboard) {
    verificarLoginNoDashboard();
  }

  const estaNoCronograma = document.getElementById("aula-form");

  if (estaNoCronograma) {
    iniciarPaginaCronograma();
  }
});