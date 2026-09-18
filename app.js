const SUPABASE_URL = "https://ietitoxjojsdiuridrfk.supabase.com";
const SUPABASE_KEY = "sb_publishable_ReynfGuOnOGco0kf7NO_Jw__frEPrb0";

const clientesupabase = window.supabase.createClient(
    supabaseUrl, 
    supabaseKey
);

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

  const nomeUsuario = document.getElementById("nome-usuario");

  if (nomeUsuario) {
    nomeUsuario.textContent = usuarioAtual.email.split("@")[0];
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
  const totalAulas = document.getElementById("total-aulas");
  const totalQuestoes = document.getElementById("total-questoes");
  const totalSimulados = document.getElementById("total-simulados");

  if (!totalAulas || !totalQuestoes || !totalSimulados) return;

  const { count: aulas } = await supabase
    .from("cronograma_aulas")
    .select("*", { count: "exact", head: true })
    .eq("user_id", usuarioAtual.id);

  const { count: questoes } = await supabase
    .from("questoes_respondidas")
    .select("*", { count: "exact", head: true })
    .eq("user_id", usuarioAtual.id);

  const { count: simulados } = await supabase
    .from("simulados")
    .select("*", { count: "exact", head: true })
    .eq("user_id", usuarioAtual.id);

  totalAulas.textContent = aulas || 0;
  totalQuestoes.textContent = questoes || 0;
  totalSimulados.textContent = simulados || 0;
}

async function carregarAgendaSemanal() {
  const grade = document.getElementById("grade-semanal");

  if (!grade) return;

  grade.innerHTML = "<p>Carregando agenda…</p>";

  const hoje = new Date();
  const diaSemana = hoje.getDay();
  const diferencaParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;

  const segunda = new Date(hoje);
  segunda.setDate(hoje.getDate() + diferencaParaSegunda);
  segunda.setHours(0, 0, 0, 0);

  const domingo = new Date(segunda);
  domingo.setDate(segunda.getDate() + 6);

  const inicio = segunda.toISOString().split("T")[0];
  const fim = domingo.toISOString().split("T")[0];

  const { data: aulas, error } = await supabase
    .from("cronograma_aulas")
    .select("*")
    .eq("user_id", usuarioAtual.id)
    .gte("data", inicio)
    .lte("data", fim)
    .order("data", { ascending: true });

  if (error) {
    console.error(error);
    grade.innerHTML = "<p>Erro ao carregar agenda.</p>";
    return;
  }

  const dias = [
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
    "Domingo",
  ];

  const aulasPorDia = Array.from({ length: 7 }, () => []);

  (aulas || []).forEach((aula) => {
    const dataAula = new Date(`${aula.data}T00:00:00`);
    const indice = Math.round(
      (dataAula - segunda) / (1000 * 60 * 60 * 24)
    );

    if (indice >= 0 && indice <= 6) {
      aulasPorDia[indice].push(aula);
    }
  });

  grade.innerHTML = dias
    .map((dia, indice) => {
      const aulasDoDia = aulasPorDia[indice];

      return `
        <div class="dia-coluna">
          <h4>${dia}</h4>

          ${
            aulasDoDia.length
              ? aulasDoDia
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
                  .join("")
              : '<p class="sem-item">Nada agendado</p>'
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
  const subtemaInput = document.getElementById("aula-disciplina");
  const temaInput = document.getElementById("aula-tema");
  const inicioInput = document.getElementById("aula-horario-inicio");
  const fimInput = document.getElementById("aula-horario-fim");
  const mensagem = document.getElementById("mensagem-aula");

  if (!dataInput || !areaInput || !temaInput || !mensagem) return;

  const data = dataInput.value;
  const area = areaInput.value;
  const subtema = subtemaInput ? subtemaInput.value.trim() : "";
  const tema = temaInput.value.trim();

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
    disciplina: subtema || null,
    tema,
    horario_inicio: inicioInput?.value || null,
    horario_fim: fimInput?.value || null,
  });

  if (error) {
    console.error(error);
    mensagem.textContent = `Erro ao salvar aula: ${error.message}`;
    return;
  }

  mensagem.textContent = "Aula salva com sucesso.";

  dataInput.value = "";
  areaInput.value = "";

  if (subtemaInput) subtemaInput.value = "";
  if (temaInput) temaInput.value = "";
  if (inicioInput) inicioInput.value = "";
  if (fimInput) fimInput.value = "";

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
  const provaInput = document.getElementById("prova-nome");
  const dataInput = document.getElementById("prova-data");
  const valorInput = document.getElementById("prova-valor");
  const localInput = document.getElementById("prova-local");
  const limiteInput = document.getElementById("prova-limite");
  const gabaritoInput = document.getElementById("prova-gabarito");
  const mensagem = document.getElementById("mensagem-prova");

  if (!provaInput || !dataInput || !mensagem) return;

  const prova = provaInput.value.trim();
  const dataProva = dataInput.value;

  if (!prova || !dataProva) {
    mensagem.textContent = "Preencha o nome e a data da prova.";
    return;
  }

  mensagem.textContent = "Salvando…";

  const { error } = await supabase.from("provas_editais").insert({
    user_id: usuarioAtual.id,
    prova,
    data_prova: dataProva,
    valor: valorInput?.value ? Number(valorInput.value) : null,
    local: localInput?.value.trim() || null,
    data_limite_inscricao: limiteInput?.value || null,
    data_divulgacao_gabarito: gabaritoInput?.value || null,
  });

  if (error) {
    console.error(error);
    mensagem.textContent = `Erro ao salvar prova: ${error.message}`;
    return;
  }

  mensagem.textContent = "Prova salva com sucesso.";

  provaInput.value = "";
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

function comprimirImagem(arquivo, qualidade = 0.7) {
  return new Promise((resolve, reject) => {
    const imagem = new Image();
    const urlTemporaria = URL.createObjectURL(arquivo);

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
  const area = areaInput ? areaInput.value : "";

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
    } catch (erro) {
      console.error(erro);
      mensagem.textContent = `Erro ao processar imagem: ${erro.message}`;
      return;
    }
  }

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

  const cardsHtml = await Promise.all(
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

  lista.innerHTML = cardsHtml.join("");
}

async function prepararEstudoFlashcards() {
  const frente = document.getElementById("fc-estudo-frente");

  if (!frente) return;

  const hoje = new Date().toISOString().split("T")[0];

  const { data: flashcards, error } = await supabase
    .from("flashcards")
    .select("*")
    .eq("user_id", usuarioAtual.id)
    .lte("proxima_revisao", hoje)
    .order("proxima_revisao", { ascending: true });

  if (error) {
    console.error(error);
    frente.textContent = "Erro ao carregar revisões.";
    return;
  }

  flashcardsParaEstudar = flashcards || [];
  indiceFlashcardAtual = 0;

  await atualizarTelaEstudo();
}

async function atualizarTelaEstudo() {
  const frente = document.getElementById("fc-estudo-frente");
  const verso = document.getElementById("fc-estudo-verso");
  const imagem = document.getElementById("fc-estudo-imagem");
  const card = document.getElementById("flashcard-estudo");
  const resposta = document.getElementById("flashcard-resposta");
  const botaoVirar = document.getElementById("botao-virar");

  if (!frente || !verso || !imagem || !card || !resposta || !botaoVirar) {
    return;
  }

  const flashcard = flashcardsParaEstudar[indiceFlashcardAtual];

  if (!flashcard) {
    card.style.display = "block";
    resposta.style.display = "none";
    frente.textContent = "Nenhum flashcard para revisar agora.";
    verso.textContent = "";
    imagem.style.display = "none";
    botaoVirar.style.display = "none";
    return;
  }

  card.style.display = "block";
  resposta.style.display = "none";

  frente.textContent = flashcard.frente;
  verso.textContent = "";
  botaoVirar.style.display = "inline-block";

  const urlImagem = await obterUrlImagemPrivada(flashcard.imagem_path);

  if (urlImagem) {
    imagem.src = urlImagem;
    imagem.style.display = "block";
  } else {
    imagem.removeAttribute("src");
    imagem.style.display = "none";
  }
}

function virarFlashcard() {
  const flashcard = flashcardsParaEstudar[indiceFlashcardAtual];

  if (!flashcard) return;

  const card = document.getElementById("flashcard-estudo");
  const resposta = document.getElementById("flashcard-resposta");
  const verso = document.getElementById("fc-estudo-verso");

  if (!card || !resposta || !verso) return;

  verso.textContent = flashcard.verso;

  card.style.display = "none";
  resposta.style.display = "block";
}

async function registrarDificuldade(dificuldade) {
  const flashcard = flashcardsParaEstudar[indiceFlashcardAtual];

  if (!flashcard) return;

  const intervaloAnterior = Number(flashcard.intervalo_dias || 0);
  let facilidade = Number(flashcard.facilidade || 2.5);
  let proximoIntervalo;

  if (dificuldade === "facil") {
    proximoIntervalo = Math.max(
      4,
      Math.round(Math.max(1, intervaloAnterior) * facilidade)
    );
    facilidade += 0.15;
  } else if (dificuldade === "regular") {
    proximoIntervalo = Math.max(
      2,
      Math.round(Math.max(1, intervaloAnterior) * 1.8)
    );
  } else {
    proximoIntervalo = 1;
    facilidade = Math.max(1.3, facilidade - 0.2);
  }

  const proximaRevisao = new Date();
  proximaRevisao.setDate(proximaRevisao.getDate() + proximoIntervalo);

  const { error } = await supabase
    .from("flashcards")
    .update({
      intervalo_dias: proximoIntervalo,
      facilidade,
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
   INICIALIZAÇÃO
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
      const campoArea = document.getElementById("aula-area");
      const botoesArea = document.querySelectorAll(".area-option");

      if (botaoSalvarAula) {
        botaoSalvarAula.addEventListener("click", salvarAula);
      }

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
      const botaoAristo = document.getElementById("botao-abrir-aristo");

      if (botaoSalvarProva) {
        botaoSalvarProva.addEventListener("click", salvarProva);
      }

      if (botaoAristo) {
        botaoAristo.addEventListener("click", () => {
          window.open("https://aristo.com.br/editais/", "_blank");
        });
      }

      carregarProvas();
    });
  }

  if (caminho.includes("flashcards.html")) {
    verificarLogin().then((session) => {
      if (!session) return;

      const botaoSalvar = document.getElementById("botao-salvar-flashcard");
      const botaoVirar = document.getElementById("botao-virar");
      const botoesDificuldade = document.querySelectorAll(
        ".botao-dificuldade"
      );

      if (botaoSalvar) {
        botaoSalvar.addEventListener("click", salvarFlashcard);
      }

      if (botaoVirar) {
        botaoVirar.addEventListener("click", virarFlashcard);
      }

      botoesDificuldade.forEach((botao) => {
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