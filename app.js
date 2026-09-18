const supabaseUrl = "https://kkyqgcirishgqjyqafzd.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtreXFtY2lyaXNoZ3FqeXFhZnpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzU3NzMsImV4cCI6MjA3MzU1MTc3M30.1iHkYq8JtX3r9XqJqGqJqGqJqGqJqGqJqGqJqGqJqGg";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let usuarioAtual = null;

async function verificarLogin() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "index.html";
    return null;
  }

  usuarioAtual = session.user;

  const nomeElement = document.getElementById("nome-usuario");
  if (nomeElement) {
    nomeElement.textContent = usuarioAtual.email.split("@")[0];
  }

  return session;
}

async function carregarEstatisticas() {
  const totalAulasEl = document.getElementById("total-aulas");
  const totalQuestoesEl = document.getElementById("total-questoes");
  const totalSimuladosEl = document.getElementById("total-simulados");

  if (!totalAulasEl || !totalQuestoesEl || !totalSimuladosEl) return;

  const { count: countAulas } = await supabase
    .from("cronograma_aulas")
    .select("*", { count: "exact", head: true })
    .eq("user_id", usuarioAtual.id);

  const { count: countQuestoes } = await supabase
    .from("questoes_respondidas")
    .select("*", { count: "exact", head: true })
    .eq("user_id", usuarioAtual.id);

  const { count: countSimulados } = await supabase
    .from("simulados")
    .select("*", { count: "exact", head: true })
    .eq("user_id", usuarioAtual.id);

  totalAulasEl.textContent = countAulas || 0;
  totalQuestoesEl.textContent = countQuestoes || 0;
  totalSimuladosEl.textContent = countSimulados || 0;
}

async function carregarAgendaSemanal() {
  const grade = document.getElementById("grade-semanal");
  if (!grade) return;

  grade.innerHTML = "<p>Carregando agenda…</p>";

  const hoje = new Date();
  const diaSemana = hoje.getDay();
  const diferencaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;

  const segunda = new Date(hoje);
  segunda.setDate(hoje.getDate() + diferencaSegunda);
  segunda.setHours(0, 0, 0, 0);

  const domingo = new Date(segunda);
  domingo.setDate(segunda.getDate() + 6);
  domingo.setHours(23, 59, 59, 999);

  const inicioStr = segunda.toISOString().split("T")[0];
  const fimStr = domingo.toISOString().split("T")[0];

  const { data: aulas, error: errorAulas } = await supabase
    .from("cronograma_aulas")
    .select("*")
    .eq("user_id", usuarioAtual.id)
    .gte("data", inicioStr)
    .lte("data", fimStr)
    .order("data", { ascending: true });

  if (errorAulas) {
    grade.innerHTML = "<p>Erro ao carregar agenda.</p>";
    return;
  }

  renderizarAgendaSemanal(aulas || [], [], segunda);
}

function renderizarAgendaSemanal(aulas, _eventosIgnorados, dataSegunda) {
  const grade = document.getElementById("grade-semanal");
  if (!grade) return;

  const diasSemana = [
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
    "Domingo",
  ];

  const porDia = Array.from({ length: 7 }, () => ({
    aulas: [],
  }));

  aulas.forEach((aula) => {
    const dataAula = new Date(aula.data + "T00:00:00");
    const diffDias = Math.round(
      (dataAula - dataSegunda) / (1000 * 60 * 60 * 24)
    );
    if (diffDias >= 0 && diffDias <= 6) {
      porDia[diffDias].aulas.push(aula);
    }
  });

  grade.innerHTML = diasSemana
    .map((dia, idx) => {
      const itens = porDia[idx].aulas;

      const aulasHtml = porDia[idx].aulas
        .map(
          (aula) => `
            <div class="agenda-item aula">
              <strong>${aula.area || "Sem área"}</strong><br>
              ${aula.disciplina || "Sem subtema"} · ${aula.tema}<br>
              <small>${aula.horario_inicio || ""} ${aula.horario_fim ? "– " + aula.horario_fim : ""}</small>
            </div>
          `
        )
        .join("");

      return `
        <div class="dia-coluna">
          <h4>${dia}</h4>
          ${aulasHtml}
          ${itens.length === 0 ? '<p class="sem-item">Nada agendado</p>' : ""}
        </div>
      `;
    })
    .join("");
}

function formatarData(dataISO) {
  if (!dataISO) return "";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

async function salvarAula() {
  const dataInput = document.getElementById("aula-data");
  const areaInput = document.getElementById("aula-area");
  const disciplinaInput = document.getElementById("aula-disciplina");
  const temaInput = document.getElementById("aula-tema");
  const horarioInicioInput = document.getElementById("aula-horario-inicio");
  const horarioFimInput = document.getElementById("aula-horario-fim");
  const mensagem = document.getElementById("mensagem-aula");

  if (!dataInput || !areaInput || !temaInput || !mensagem) return;

  const data = dataInput.value;
  const area = areaInput.value;
  const disciplina = disciplinaInput.value.trim();
  const tema = temaInput.value.trim();
  const horarioInicio = horarioInicioInput.value || null;
  const horarioFim = horarioFimInput.value || null;

  if (!data || !area || !tema) {
    mensagem.textContent = "Escolha a área, preencha a data e o tema da aula.";
    return;
  }

  mensagem.textContent = "Salvando…";

  const { error } = await supabase.from("cronograma_aulas").insert({
    user_id: usuarioAtual.id,
    data,
    area,
    disciplina: disciplina || null,
    tema,
    horario_inicio: horarioInicio,
    horario_fim: horarioFim,
  });

  if (error) {
    mensagem.textContent = "Erro ao salvar aula.";
    return;
  }

  mensagem.textContent = "Aula salva com sucesso.";
  dataInput.value = "";
  areaInput.value = "";
  disciplinaInput.value = "";
  temaInput.value = "";
  horarioInicioInput.value = "";
  horarioFimInput.value = "";

  document.querySelectorAll(".area-option").forEach((b) => b.classList.remove("selected"));

  carregarAulas();
}

async function carregarAulas() {
  const lista = document.getElementById("cronograma-lista");
  if (!lista) return;

  lista.innerHTML = "<p>Carregando aulas…</p>";

  const { data: aulas, error } = await supabase
    .from("cronograma_aulas")
    .select("*")
    .eq("user_id", usuarioAtual.id)
    .order("data", { ascending: false });

  if (error) {
    lista.innerHTML = "<p>Erro ao carregar aulas.</p>";
    return;
  }

  if (aulas.length === 0) {
    lista.innerHTML = "<p>Nenhuma aula salva ainda.</p>";
    return;
  }

  lista.innerHTML = aulas
    .map(
      (aula) => `
        <div class="cronograma-item">
          <div>
            <p><strong>${aula.area || "Sem área"}</strong></p>
            <p>${aula.disciplina || "Sem subtema"} · ${aula.tema}</p>
            <p>${formatarData(aula.data)} ${aula.horario_inicio ? "· " + aula.horario_inicio : ""} ${aula.horario_fim ? "– " + aula.horario_fim : ""}</p>
          </div>
        </div>
      `
    )
    .join("");
}

async function salvarProva() {
  const nomeInput = document.getElementById("prova-nome");
  const dataInput = document.getElementById("prova-data");
  const valorInput = document.getElementById("prova-valor");
  const localInput = document.getElementById("prova-local");
  const limiteInput = document.getElementById("prova-limite");
  const gabaritoInput = document.getElementById("prova-gabarito");
  const mensagem = document.getElementById("mensagem-prova");

  if (!nomeInput || !dataInput || !mensagem) return;

  const prova = nomeInput.value.trim();
  const dataProva = dataInput.value;
  const valor = valorInput.value ? Number(valorInput.value) : null;
  const local = localInput.value.trim() || null;
  const limite = limiteInput.value || null;
  const gabarito = gabaritoInput.value || null;

  if (!prova || !dataProva) {
    mensagem.textContent = "Preencha pelo menos o nome e a data da prova.";
    return;
  }

  mensagem.textContent = "Salvando…";

  const { error } = await supabase.from("provas_editais").insert({
    user_id: usuarioAtual.id,
    prova,
    data_prova: dataProva,
    valor,
    local,
    data_limite_inscricao: limite,
    data_divulgacao_gabarito: gabarito,
  });

  if (error) {
    mensagem.textContent = "Erro ao salvar prova.";
    return;
  }

  mensagem.textContent = "Prova salva com sucesso.";

  nomeInput.value = "";
  dataInput.value = "";
  valorInput.value = "";
  localInput.value = "";
  limiteInput.value = "";
  gabaritoInput.value = "";

  carregarProvas();
}

async function carregarProvas() {
  const lista = document.getElementById("provas-lista");
  if (!lista) return;

  lista.innerHTML = "<p>Carregando provas…</p>";

  const { data: provas, error } = await supabase
    .from("provas_editais")
    .select("*")
    .eq("user_id", usuarioAtual.id)
    .order("data_prova", { ascending: false });

  if (error) {
    lista.innerHTML = "<p>Erro ao carregar provas.</p>";
    return;
  }

  if (provas.length === 0) {
    lista.innerHTML = "<p>Nenhuma prova cadastrada ainda.</p>";
    return;
  }

  lista.innerHTML = provas
    .map(
      (p) => `
        <div class="cronograma-item">
          <div>
            <p><strong>${p.prova}</strong></p>
            <p>Data da prova: ${formatarData(p.data_prova)}</p>
            ${p.valor ? `<p>Valor: R$ ${Number(p.valor).toFixed(2)}</p>` : ""}
            ${p.local ? `<p>Local: ${p.local}</p>` : ""}
            ${p.data_limite_inscricao ? `<p>Inscrição até: ${formatarData(p.data_limite_inscricao)}</p>` : ""}
            ${p.data_divulgacao_gabarito ? `<p>Gabarito em: ${formatarData(p.data_divulgacao_gabarito)}</p>` : ""}
          </div>
        </div>
      `
    )
    .join("");
}

function iniciarPaginaCronograma() {
  const caminho = window.location.pathname;

  if (caminho.includes("cronograma.html")) {
    verificarLogin().then((session) => {
      if (!session) return;

      const botaoSalvarAula = document.getElementById("botao-salvar-aula");
      if (botaoSalvarAula) {
        botaoSalvarAula.addEventListener("click", salvarAula);
      }

      const botoesArea = document.querySelectorAll(".area-option");
      const campoArea = document.getElementById("aula-area");

      botoesArea.forEach((botao) => {
        botao.addEventListener("click", () => {
          botoesArea.forEach((outroBotao) => {
            outroBotao.classList.remove("selected");
          });

          botao.classList.add("selected");
          campoArea.value = botao.dataset.area;
        });
      });

      carregarAulas();
    });
  }

  if (caminho.includes("editais-provas.html")) {
    verificarLogin().then((session) => {
      if (!session) return;

      const botaoSalvarProva = document.getElementById("botao-salvar-prova");
      if (botaoSalvarProva) {
        botaoSalvarProva.addEventListener("click", salvarProva);
      }

      carregarProvas();

      const botaoAbrirAristo = document.getElementById("botao-abrir-aristo");
      if (botaoAbrirAristo) {
        botaoAbrirAristo.addEventListener("click", () => {
          window.open("https://aristo.com.br/editais/", "_blank");
        });
      }

      const msgIframe = document.getElementById("mensagem-iframe");
      if (msgIframe) {
        msgIframe.textContent =
          "Se a área abaixo ficar em branco, o site da Aristo não permite ser exibido dentro de outras páginas. Nesse caso, use o botão para abrir em outra aba.";
      }
    });
  }

  if (caminho.includes("dashboard.html")) {
    verificarLogin().then((session) => {
      if (!session) return;

      carregarEstatisticas();
      carregarAgendaSemanal();
    });
  }
}

iniciarPaginaCronograma();