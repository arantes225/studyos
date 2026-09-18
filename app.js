const supabaseUrl = "https://kkyqgcirishgqjyqafzd.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtreXFtY2lyaXNoZ3FqeXFhZnpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzU3NzMsImV4cCI6MjA3MzU1MTc3M30.1iHkYq8JtX3r9XqJqGqJqGqJqGqJqGqJqGqJqGqJqGg";

const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let usuarioAtual = null;

let flashcardsParaEstudar = [];
let indiceFlashcardAtual = 0;

async function verificarLogin() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

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

function formatarData(dataISO) {
  if (!dataISO) return "";

  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

/* =========================
   DASHBOARD
========================= */

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

  const { data: aulas, error } = await supabase
    .from("cronograma_aulas")
    .select("*")
    .eq("user_id", usuarioAtual.id)
    .gte("data", inicioStr)
    .lte("data", fimStr)
    .order("data", { ascending: true });

  if (error) {
    grade.innerHTML = "<p>Erro ao carregar agenda.</p>";
    return;
  }

  renderizarAgendaSemanal(aulas || [], segunda);
}

function renderizarAgendaSemanal(aulas, dataSegunda) {
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

  const porDia = Array.from({ length: 7 }, () => []);

  aulas.forEach((aula) => {
    const dataAula = new Date(`${aula.data}T00:00:00`);

    const diferencaDias = Math.round(
      (dataAula - dataSegunda) / (1000 * 60 * 60 * 24)
    );

    if (diferencaDias >= 0 && diferencaDias <= 6) {
      porDia[diferencaDias].push(aula);
    }
  });

  grade.innerHTML = diasSemana
    .map((dia, indice) => {
      const aulasDoDia = porDia[indice];

      const aulasHtml = aulasDoDia
        .map(
          (aula) => `
            <div class="agenda-item aula">
              <strong>${aula.area || "Sem área"}</strong><br>
              ${aula.disciplina || "Sem subtema"} · ${aula.tema}<br>
              <small>
                ${aula.horario_inicio || ""}
                ${aula.horario_fim ? `– ${aula.horario_fim}` : ""}
              </small>
            </div>
          `
        )
        .join("");

      return `
        <div class="dia-coluna">
          <h4>${dia}</h4>
          ${aulasHtml}
          ${
            aulasDoDia.length === 0
              ? '<p class="sem-item">Nada agendado</p>'
              : ""
          }
        </div>
      `;
    })
    .join("");
}

/* =========================
   CRONOGRAMA
========================= */

async function salvarAula() {
  const dataInput = document.getElementById("aula-data");
  const areaInput = document.getElementById("aula-area");
  const disciplinaInput = document.getElementById("aula-disciplina");
  const temaInput = document.getElementById("aula-tema");
  const horarioInicioInput = document.getElementById("aula-horario-inicio");
  const horarioFimInput = document.getElementById("aula-horario-fim");
  const mensagem = document.getElementById("mensagem-aula");

  if (
    !dataInput ||
    !areaInput ||
    !disciplinaInput ||
    !temaInput ||
    !horarioInicioInput ||
    !horarioFimInput ||
    !mensagem
  ) {
    return;
  }

  const data = dataInput.value;
  const area = areaInput.value;
  const disciplina = disciplinaInput.value.trim();
  const tema = temaInput.value.trim();
  const horarioInicio = horarioInicioInput.value || null;
  const horarioFim = horarioFimInput.value || null;

  if (!data || !area || !tema) {
    mensagem.textContent =
      "Escolha a área e preencha a data e o tema da aula.";
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
    console.error(error);
    mensagem.textContent = `Erro ao salvar aula: ${error.message}`;
    return;
  }

  mensagem.textContent = "Aula salva com sucesso.";

  dataInput.value = "";
  areaInput.value = "";
  disciplinaInput.value = "";
  temaInput.value = "";
  horarioInicioInput.value = "";
  horarioFimInput.value = "";

  document.querySelectorAll(".area-option").forEach((botao) => {
    botao.classList.remove("selected");
  });

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
    console.error(error);
    lista.innerHTML = "<p>Erro ao carregar aulas.</p>";
    return;
  }

  if (!aulas || aulas.length === 0) {
    lista.innerHTML = "<p>Nenhuma aula salva ainda.</p>";
    return;
  }

  lista.innerHTML = aulas
    .map(
      (aula) => `
        <div class="cronograma-item">
          <p><strong>${aula.area || "Sem área"}</strong></p>
          <p>${aula.disciplina || "Sem subtema"} · ${aula.tema}</p>
          <p>
            ${formatarData(aula.data)}
            ${aula.horario_inicio ? `· ${aula.horario_inicio}` : ""}
            ${aula.horario_fim ? `– ${aula.horario_fim}` : ""}
          </p>
        </div>
      `
    )
    .join("");
}

/* =========================
   EDITAIS E PROVAS
========================= */

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
  const valor = valorInput?.value ? Number(valorInput.value) : null;
  const local = localInput?.value.trim() || null;
  const limite = limiteInput?.value || null;
  const gabarito = gabaritoInput?.value || null;

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
    console.error(error);
    mensagem.textContent = `Erro ao salvar prova: ${error.message}`;
    return;
  }

  mensagem.textContent = "Prova salva com sucesso.";

  nomeInput.value = "";
  dataInput.value = "";

  if (valorInput) valorInput.value = "";
  if (localInput) localInput.value = "";
  if (limiteInput) limiteInput.value = "";
  if (gabaritoInput) gabaritoInput.value = "";

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
    console.error(error);
    lista.innerHTML = "<p>Erro ao carregar provas.</p>";
    return;
  }

  if (!provas || provas.length === 0) {
    lista.innerHTML = "<p>Nenhuma prova cadastrada ainda.</p>";
    return;
  }

  lista.innerHTML = provas
    .map(
      (prova) => `
        <div class="cronograma-item">
          <p><strong>${prova.prova}</strong></p>
          <p>Data da prova: ${formatarData(prova.data_prova)}</p>
          ${
            prova.valor !== null
              ? `<p>Valor: R$ ${Number(prova.valor).toFixed(2)}</p>`
              : ""
          }
          ${prova.local ? `<p>Local: ${prova.local}</p>` : ""}
          ${
            prova.data_limite_inscricao
              ? `<p>Inscrição até: ${formatarData(
                  prova.data_limite_inscricao
                )}</p>`
              : ""
          }
          ${
            prova.data_divulgacao_gabarito
              ? `<p>Gabarito em: ${formatarData(
                  prova.data_divulgacao_gabarito
                )}</p>`
              : ""
          }
        </div>
      `
    )
    .join("");
}

/* =========================
   FLASHCARDS
========================= */

function comprimirImagem(file, qualidade = 0.7) {
  return new Promise((resolve, reject) => {
    const imagem = new Image();
    const urlTemporaria = URL.createObjectURL(file);

    imagem.onload = () => {
      const canvas = document.createElement("canvas");
      const contexto = canvas.getContext("2d");

      let largura = imagem.width;
      let altura = imagem.height;
      const larguraMaxima = 1200;

      if (largura > larguraMaxima) {
        const proporcao = larguraMaxima / largura;
        largura = larguraMaxima;
        altura = Math.round(altura * proporcao);
      }

      canvas.width = largura;
      canvas.height = altura;

      contexto.drawImage(imagem, 0, 0, largura, altura);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(urlTemporaria);

          if (!blob) {
            reject(new Error("Não foi possível comprimir a imagem."));
            return;
          }

          resolve(blob);
        },
        "image/jpeg",
        qualidade
      );
    };

    imagem.onerror = () => {
      URL.revokeObjectURL(urlTemporaria);
      reject(new Error("Não foi possível abrir a imagem."));
    };

    imagem.src = urlTemporaria;
  });
}

async function salvarFlashcard() {
  const frenteInput = document.getElementById("fc-frente");
  const versoInput = document.getElementById("fc-verso");
  const imagemInput = document.getElementById("fc-imagem");
  const areaInput = document.getElementById("fc-area");
  const mensagem = document.getElementById("mensagem-flashcard");

  if (!frenteInput || !versoInput || !imagemInput || !mensagem) {
    return;
  }

  const frente = frenteInput.value.trim();
  const verso = versoInput.value.trim();
  const area = areaInput?.value || "";

  if (!frente || !verso) {
    mensagem.textContent = "Preencha a frente e o verso do flashcard.";
    return;
  }

  mensagem.textContent = "Salvando flashcard…";

  let imagemPath = null;

  if (imagemInput.files && imagemInput.files[0]) {
    try {
      mensagem.textContent = "Comprimindo e enviando imagem…";

      const imagemComprimida = await comprimirImagem(
        imagemInput.files[0],
        0.7
      );

      const nomeArquivo = `${usuarioAtual.id}/${Date.now()}-flashcard.jpg`;

      const { error: erroUpload } = await supabase.storage
        .from("studyos")
        .upload(nomeArquivo, imagemComprimida, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (erroUpload) {
        console.error(erroUpload);
        mensagem.textContent = `Erro ao enviar imagem: ${erroUpload.message}`;
        return;
      }

      imagemPath = nomeArquivo;
    } catch (erroImagem) {
      console.error(erroImagem);
      mensagem.textContent = "Erro ao comprimir a imagem.";
      return;
    }
  }

  /*
    A coluna "area" não existe na sua tabela original.
    Para manter a área, usamos o campo "tags".
  */
  const { error } = await supabase.from("flashcards").insert({
    user_id: usuarioAtual.id,
    frente,
    verso,
    imagem_path: imagemPath,
    deck: null,
    tags: area || null,
    intervalo_dias: 0,
    facilidade: 2.5,
    proxima_revisao: new Date().toISOString().split("T")[0],
  });

  if (error) {
    console.error(error);
    mensagem.textContent = `Erro ao salvar flashcard: ${error.message}`;
    return;
  }

  mensagem.textContent = "Flashcard salvo com sucesso.";

  frenteInput.value = "";
  versoInput.value = "";
  imagemInput.value = "";

  if (areaInput) {
    areaInput.value = "";
  }

  await carregarFlashcards();
  await prepararEstudoFlashcards();
}

async function obterUrlImagemPrivada(imagemPath) {
  if (!imagemPath) return null;

  const { data, error } = await supabase.storage
    .from("studyos")
    .createSignedUrl(imagemPath, 3600);

  if (error) {
    console.error(error);
    return null;
  }

  return data.signedUrl;
}

async function carregarFlashcards() {
  const lista = document.getElementById("flashcards-lista");

  if (!lista) return;

  lista.innerHTML = "<p>Carregando flashcards…</p>";

  const { data: flashcards, error } = await supabase
    .from("flashcards")
    .select("*")
    .eq("user_id", usuarioAtual.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    lista.innerHTML = `<p>Erro ao carregar flashcards: ${error.message}</p>`;
    return;
  }

  if (!flashcards || flashcards.length === 0) {
    lista.innerHTML = "<p>Nenhum flashcard criado ainda.</p>";
    return;
  }

  const itensHtml = await Promise.all(
    flashcards.map(async (flashcard) => {
      const urlImagem = await obterUrlImagemPrivada(flashcard.imagem_path);

      return `
        <div class="cronograma-item">
          <p><strong>Frente:</strong> ${flashcard.frente}</p>
          <p><strong>Verso:</strong> ${flashcard.verso}</p>
          ${
            flashcard.tags
              ? `<p><strong>Área:</strong> ${flashcard.tags}</p>`
              : ""
          }
          ${
            urlImagem
              ? `<img src="${urlImagem}" class="fc-imagem" alt="Imagem do flashcard">`
              : ""
          }
        </div>
      `;
    })
  );

  lista.innerHTML = itensHtml.join("");
}

async function prepararEstudoFlashcards() {
  const frenteEl = document.getElementById("fc-estudo-frente");

  if (!frenteEl) return;

  const hoje = new Date().toISOString().split("T")[0];

  const { data: flashcards, error } = await supabase
    .from("flashcards")
    .select("*")
    .eq("user_id", usuarioAtual.id)
    .lte("proxima_revisao", hoje)
    .order("proxima_revisao", { ascending: true });

  if (error) {
    console.error(error);
    frenteEl.textContent = "Não foi possível carregar os cards para revisão.";
    return;
  }

  flashcardsParaEstudar = flashcards || [];
  indiceFlashcardAtual = 0;

  await atualizarTelaEstudo();
}

async function atualizarTelaEstudo() {
  const containerEstudo = document.getElementById("flashcard-estudo");
  const containerResposta = document.getElementById("flashcard-resposta");
  const frenteEl = document.getElementById("fc-estudo-frente");
  const versoEl = document.getElementById("fc-estudo-verso");
  const imagemEl = document.getElementById("fc-estudo-imagem");
  const botaoVirar = document.getElementById("botao-virar");

  if (
    !containerEstudo ||
    !containerResposta ||
    !frenteEl ||
    !versoEl ||
    !imagemEl ||
    !botaoVirar
  ) {
    return;
  }

  if (
    flashcardsParaEstudar.length === 0 ||
    !flashcardsParaEstudar[indiceFlashcardAtual]
  ) {
    containerEstudo.style.display = "block";
    containerResposta.style.display = "none";

    frenteEl.textContent = "Nenhum flashcard para revisar agora.";
    versoEl.textContent = "";
    imagemEl.style.display = "none";
    botaoVirar.style.display = "none";

    return;
  }

  const flashcard = flashcardsParaEstudar[indiceFlashcardAtual];

  containerEstudo.style.display = "block";
  containerResposta.style.display = "none";

  frenteEl.textContent = flashcard.frente;
  versoEl.textContent = "";
  botaoVirar.style.display = "inline-block";

  const urlImagem = await obterUrlImagemPrivada(flashcard.imagem_path);

  if (urlImagem) {
    imagemEl.src = urlImagem;
    imagemEl.style.display = "block";
  } else {
    imagemEl.removeAttribute("src");
    imagemEl.style.display = "none";
  }
}

function virarFlashcard() {
  if (
    flashcardsParaEstudar.length === 0 ||
    !flashcardsParaEstudar[indiceFlashcardAtual]
  ) {
    return;
  }

  const containerEstudo = document.getElementById("flashcard-estudo");
  const containerResposta = document.getElementById("flashcard-resposta");
  const versoEl = document.getElementById("fc-estudo-verso");

  if (!containerEstudo || !containerResposta || !versoEl) return;

  const flashcard = flashcardsParaEstudar[indiceFlashcardAtual];

  versoEl.textContent = flashcard.verso;

  containerEstudo.style.display = "none";
  containerResposta.style.display = "block";
}

async function registrarDificuldade(dificuldade) {
  const flashcard = flashcardsParaEstudar[indiceFlashcardAtual];

  if (!flashcard) return;

  let dias;
  let novaFacilidade = Number(flashcard.facilidade || 2.5);

  if (dificuldade === "facil") {
    dias = Math.max(
      4,
      Math.round((flashcard.intervalo_dias || 1) * novaFacilidade)
    );
    novaFacilidade += 0.15;
  } else if (dificuldade === "regular") {
    dias = Math.max(2, Math.round((flashcard.intervalo_dias || 1) * 1.8));
  } else {
    dias = 1;
    novaFacilidade = Math.max(1.3, novaFacilidade - 0.2);
  }

  const proximaRevisao = new Date();
  proximaRevisao.setDate(proximaRevisao.getDate() + dias);

  const { error } = await supabase
    .from("flashcards")
    .update({
      intervalo_dias: dias,
      facilidade: novaFacilidade,
      proxima_revisao: proximaRevisao.toISOString().split("T")[0],
    })
    .eq("id", flashcard.id)
    .eq("user_id", usuarioAtual.id);

  if (error) {
    console.error(error);
    alert(`Erro ao registrar revisão: ${error.message}`);
    return;
  }

  indiceFlashcardAtual += 1;

  await atualizarTelaEstudo();
  await carregarFlashcards();
}

/* =========================
   INICIALIZAÇÃO DAS PÁGINAS
========================= */

function iniciarAplicacao() {
  const caminho = window.location.pathname;

  if (caminho.includes("dashboard.html")) {
    verificarLogin().then((session) => {
      if (!session) return;

      carregarEstatisticas();
      carregarAgendaSemanal();
    });
  }

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

          if (campoArea) {
            campoArea.value = botao.dataset.area;
          }
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

      const botaoAbrirAristo = document.getElementById("botao-abrir-aristo");

      if (botaoAbrirAristo) {
        botaoAbrirAristo.addEventListener("click", () => {
          window.open("https://aristo.com.br/editais/", "_blank");
        });
      }

      carregarProvas();
    });
  }

  if (caminho.includes("flashcards.html")) {
    verificarLogin().then((session) => {
      if (!session) return;

      const botaoSalvarFlashcard = document.getElementById(
        "botao-salvar-flashcard"
      );

      const botaoVirar = document.getElementById("botao-virar");

      if (botaoSalvarFlashcard) {
        botaoSalvarFlashcard.addEventListener("click", salvarFlashcard);
      }

      if (botaoVirar) {
        botaoVirar.addEventListener("click", virarFlashcard);
      }

      document.querySelectorAll(".botao-dificuldade").forEach((botao) => {
        botao.addEventListener("click", () => {
          registrarDificuldade(botao.dataset.dificuldade);
        });
      });

      carregarFlashcards();
      prepararEstudoFlashcards();
    });
  }
}

iniciarAplicacao();