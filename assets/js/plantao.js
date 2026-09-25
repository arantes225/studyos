(() => {
  "use strict";

  const E=window.PlantaoEngine;
  const sb = window.supabaseClient;
  if (!sb) return;

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");

  const CATEGORY_LABELS = {
    anamnese:"Anamnese",
    exame:"Exame físico",
    exames:"Exames",
    laboratorio:"Laboratório",
    imagem:"Imagem",
    monitorizacao:"Monitorização",
    procedimentos:"Procedimentos",
    tratamento:"Tratamento",
    raciocinio:"Raciocínio"
  };

  const state = {
    user:null,
    cases:[],
    sessions:[],
    current:null,
    session:null,
    elapsed:0,
    score:0,
    vitals:{},
    performed:[],
    outcomes:[],
    triggered:[],
    log:[],
    sequenceViolations:[],
    monitorOn:false,
    harmfulCount:0,
    dead:false,
    deathReason:"",
    clinicalEvents:[],
    category:null,
    penalties:0, criticalElapsed:0, diagnosis:null, disposition:null, busy:false
  };

  function fmtTime(minutes) {
    const total = Math.max(0, Math.round(Number(minutes||0)*60));
    return String(Math.floor(total/60)).padStart(2,"0")+":"+String(total%60).padStart(2,"0");
  }

  function show(section) {
    ["plantao-library","plantao-simulator","plantao-debrief"].forEach(id => {
      const el=$(id);
      if (el) el.hidden = id !== section;
    });
    window.scrollTo({top:0,behavior:"smooth"});
  }

  async function load() {
    const {data:{user}} = await sb.auth.getUser();
    if (!user) return;
    state.user=user;

    // Plantão é restrito ao admin; busca os casos por RPC administrativo.
    // Isso evita depender da combinação de RLS/cache de sessão para montar a biblioteca.
    let casesRes = await sb.rpc("admin_list_active_clinical_cases");

    // Fallback defensivo para instalações antigas enquanto a migration propaga.
    if (casesRes.error) {
      console.warn("Plantão: RPC de casos falhou; tentando leitura direta.", casesRes.error);
      casesRes = await sb.from("clinical_cases")
        .select("id,slug,title,setting,specialty,difficulty,summary,presentation,initial_vitals,actions,deterioration,completion_rules,debrief,source_refs,version")
        .eq("active",true)
        .order("title");
    }

    if (casesRes.error) {
      console.error("Plantão: falha ao carregar casos",casesRes.error);
      $("plantao-empty").hidden=false;
      $("plantao-empty").textContent="Não foi possível carregar os casos clínicos.";
      return;
    }
    state.cases=Array.isArray(casesRes.data) ? casesRes.data : [];

    const sessionsRes = await sb.from("clinical_case_sessions")
      .select("id,case_id,status,started_at,completed_at,score,result")
      .eq("user_id",user.id)
      .eq("status","completed")
      .order("started_at",{ascending:false})
      .limit(100);
    state.sessions=sessionsRes.error ? [] : (sessionsRes.data || []);
    const specialties=[...new Set(state.cases.map(x=>x.specialty).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"pt-BR"));
    const difficulties=[...new Set(state.cases.map(x=>x.difficulty).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"pt-BR"));
    if($("plantao-filter-specialty")) $("plantao-filter-specialty").innerHTML='<option value="">Todas</option>'+specialties.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");
    if($("plantao-filter-difficulty")) $("plantao-filter-difficulty").innerHTML='<option value="">Todas</option>'+difficulties.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");
    renderLibrary();
  }

  function bestScore(caseId) {
    const values=state.sessions.filter(x=>x.case_id===caseId && x.status==="completed").map(x=>Number(x.score||0));
    return values.length ? Math.max(...values) : null;
  }

  function renderLibrary() {
    const specialty=$("plantao-filter-specialty")?.value || "";
    const difficulty=$("plantao-filter-difficulty")?.value || "";
    const visibleCases=state.cases.filter(item=>(!specialty || item.specialty===specialty) && (!difficulty || item.difficulty===difficulty));
    $("plantao-case-count").textContent=visibleCases.length;
    $("plantao-session-count").textContent=state.sessions.length;
    const grid=$("plantao-case-grid");
    const empty=$("plantao-empty");
    if (!visibleCases.length) {
      grid.innerHTML="";
      empty.hidden=false;
      return;
    }
    empty.hidden=true;
    grid.innerHTML=visibleCases.map(item=>{
      const best=bestScore(item.id);
      return `
        <article class="plantao-case-card">
          <div class="plantao-case-card-head">
            <div>
              <h3>${esc(item.presentation?.chief_complaint || item.presentation?.display_title || item.summary || "Queixa não informada")}</h3>
              <div class="plantao-case-tags">
                <span>${esc(item.specialty)}</span>
                <span>${esc(item.difficulty)}</span>
                <span>${esc(item.setting)}</span>
              </div>
            </div>
            ${best==null ? "" : `<span class="badge accent">Melhor: ${Math.round(best)}/100</span>`}
          </div>
          <p>Paciente aguardando avaliação. O diagnóstico será revelado somente após a conclusão do caso.</p>
          <button class="button primary" type="button" data-start-case="${esc(item.id)}">Iniciar caso</button>
        </article>
      `;
    }).join("");
  }

  ["plantao-filter-specialty","plantao-filter-difficulty"].forEach(id=>{
    $(id)?.addEventListener("change",renderLibrary);
  });
  $("plantao-filter-clear")?.addEventListener("click",()=>{
    $("plantao-filter-specialty").value="";
    $("plantao-filter-difficulty").value="";
    renderLibrary();
  });

  const GROUPS = {
    anamnese:{label:"Anamnese",icon:"◉",categories:["anamnese"]},
    fisico:{label:"Exame físico",icon:"✚",categories:["exame"]},
    iniciais:{label:"Procedimentos iniciais / emergência",icon:"ϟ",categories:["iniciais","monitorizacao"]},
    exames:{label:"Exames",icon:"▤",categories:["exames","laboratorio","imagem"]},
    intervir:{label:"Intervenções",icon:"✚",categories:["tratamento","procedimentos","procedimentos_terapeuticos"]},
    hipoteses:{label:"Hipóteses",icon:"◎",categories:["hipoteses","raciocinio"]},
    conduta:{label:"Conduta final",icon:"✓",categories:["destino","encaminhamento"]}
  };
  const GENERIC_ACTIONS = [
    {id:"exam_neuro",label:"Exame neurológico",category:"exame",subgroup:"01 · Neurológico",time_min:.5,points:0,result:"Consciente e orientado, Glasgow 15, fala clara, pupilas isocóricas e fotorreagentes, força preservada e simétrica nos quatro membros, sem déficit focal aparente."},
    {id:"exam_head",label:"Cabeça e pescoço",category:"exame",subgroup:"02 · Cabeça e pescoço",time_min:.5,points:0,result:"Crânio normocefálico, sem lesões ou deformidades aparentes. Pescoço sem rigidez, massas, turgência jugular ou sinais externos de trauma."},
    {id:"exam_airway",label:"Vias aéreas",category:"exame",subgroup:"03 · Vias aéreas",time_min:.5,points:0,result:"Vias aéreas patentes, sem secreções, edema ou trauma aparente; sem estridor ou sinais de obstrução."},
    {id:"exam_eyes",label:"Olhos e pupilas",category:"exame",subgroup:"04 · Olhos",time_min:.5,points:0,result:"Olhos sem hiperemia ou lesões aparentes; pupilas isocóricas e fotorreagentes, motilidade ocular extrínseca preservada."},
    {id:"exam_chest",label:"Tórax",category:"exame",subgroup:"05 · Tórax",time_min:.5,points:0,result:"Tórax simétrico, expansibilidade preservada bilateralmente, sem deformidades aparentes; murmúrio vesicular presente bilateralmente, sem ruídos adventícios."},
    {id:"exam_upper",label:"Membros superiores",category:"exame",subgroup:"06 · Membros superiores",time_min:.5,points:0,result:"Membros superiores simétricos, sem deformidades ou edema; pulsos periféricos palpáveis e simétricos, perfusão preservada."},
    {id:"exam_abdomen",label:"Abdômen",category:"exame",subgroup:"07 · Abdômen",time_min:.5,points:0,result:"Abdômen plano, flácido, ruídos hidroaéreos presentes, indolor à palpação superficial e profunda, sem defesa, rigidez ou massas palpáveis."},
    {id:"exam_lower",label:"Membros inferiores",category:"exame",subgroup:"08 · Membros inferiores",time_min:.5,points:0,result:"Membros inferiores simétricos, sem deformidades ou edema; panturrilhas livres, pulsos periféricos palpáveis e simétricos."},
    {id:"exam_extremities",label:"Extremidades e perfusão",category:"exame",subgroup:"09 · Extremidades",time_min:.5,points:0,result:"Extremidades aquecidas, perfundidas, pulsos periféricos palpáveis e simétricos, enchimento capilar inferior a 2 segundos."},
    {id:"exam_skin",label:"Pele e mucosas",category:"exame",subgroup:"10 · Pele",time_min:.5,points:0,result:"Pele íntegra, normocorada e sem lesões aparentes; mucosas úmidas e coradas, sem cianose ou icterícia."},
    {id:"exam_gyne",label:"Exame ginecológico",category:"exame",subgroup:"11 · Ginecológico",time_min:1,points:0,result:"Exame ginecológico realizado. Inspeção vulvovaginal, exame especular e toque bimanual avaliados conforme o contexto clínico do caso."},
    {id:"exam_gu",label:"Exame genitourinário",category:"exame",subgroup:"12 · Genitourinário",time_min:1,points:0,result:"Exame genitourinário realizado. Genitais externos, região inguinal e achados urinários/genitais pertinentes avaliados conforme o contexto clínico do caso."},
    {id:"monitor",label:"Ligar monitor multiparamétrico",category:"iniciais",subgroup:"Monitorização",time_min:.25,points:0,result:"Monitor conectado; sinais vitais e traçados passam a ser exibidos."},
    {id:"check_pulse",label:"Checar pulso e respiração",category:"iniciais",subgroup:"Avaliação imediata",time_min:.25,points:0,result:"Pulso e padrão respiratório avaliados."},
    {id:"check_rhythm",label:"Avaliar ritmo no monitor",category:"iniciais",subgroup:"Avaliação imediata",time_min:.25,points:0,result:"Ritmo avaliado no monitor.",requires_all:["monitor"],requires_penalty:2},
    {id:"abcde",label:"Avaliação ABCDE",category:"iniciais",subgroup:"Avaliação imediata",time_min:1,points:0,result:"ABCDE realizado de forma sistemática."},
    {id:"iv_access",label:"Acesso venoso periférico",category:"iniciais",subgroup:"Acessos",time_min:.5,points:0,result:"Acesso venoso periférico obtido."},
    {id:"iv_access_2",label:"Segundo acesso venoso periférico",category:"iniciais",subgroup:"Acessos",time_min:.5,points:0,result:"Segundo acesso venoso periférico obtido."},
    {id:"io_access",label:"Acesso intraósseo",category:"iniciais",subgroup:"Acessos",time_min:.5,points:0,result:"Acesso intraósseo obtido."},
    {id:"oxygen",label:"Oxigênio suplementar",category:"iniciais",subgroup:"Suporte",time_min:.25,points:0,result:"Oxigênio suplementar iniciado."},
    {id:"bvm",label:"Bolsa-válvula-máscara",category:"iniciais",subgroup:"Suporte",time_min:.25,points:0,result:"Ventilação com bolsa-válvula-máscara iniciada."},
    {id:"cpr",label:"Iniciar RCP",category:"iniciais",subgroup:"Ressuscitação",time_min:.25,points:0,result:"RCP de alta qualidade iniciada."},
    {id:"call_team",label:"Acionar equipe de emergência",category:"iniciais",subgroup:"Suporte",time_min:.25,points:0,result:"Equipe de emergência acionada."},
    {id:"glucose",label:"Glicemia capilar",category:"iniciais",subgroup:"Avaliação imediata",time_min:.25,points:0,result:"Glicemia capilar aferida."},
    {id:"ecg",label:"Eletrocardiograma de 12 derivações",category:"exames",subgroup:"Gerais",time_min:.5,points:0,result:"ECG realizado; sem alteração adicional relevante além do contexto do caso."},
    {id:"pulse_ox",label:"Oximetria de pulso",category:"exames",subgroup:"Gerais",time_min:.1,points:0,result:"Oximetria aferida."},
    {id:"capnography",label:"Capnografia",category:"exames",subgroup:"Gerais",time_min:.25,points:0,result:"Capnografia realizada."},
    {id:"temperature",label:"Temperatura",category:"exames",subgroup:"Gerais",time_min:.1,points:0,result:"Temperatura aferida."},
    {id:"urinalysis",label:"Urina tipo 1",category:"laboratorio",subgroup:"Laboratoriais",time_min:.5,points:0,result:"Urina tipo 1 sem alteração adicional relevante neste caso."},
    {id:"pregnancy",label:"β-hCG",category:"laboratorio",subgroup:"Laboratoriais",time_min:.5,points:0,result:"β-hCG solicitado; interpretar conforme o contexto."},
    {id:"cbc",label:"Hemograma completo",category:"laboratorio",subgroup:"Hematologia",time_min:.5,points:0,result:"Hemograma disponível; sem alteração adicional relevante neste caso."},
    {id:"wbc",label:"Leucócitos e diferencial",category:"laboratorio",subgroup:"Hematologia",time_min:.5,points:0,result:"Série branca disponível; sem alteração adicional relevante neste caso."},
    {id:"platelets",label:"Plaquetas",category:"laboratorio",subgroup:"Hematologia",time_min:.5,points:0,result:"Plaquetas disponíveis; sem alteração adicional relevante neste caso."},
    {id:"sodium",label:"Sódio",category:"laboratorio",subgroup:"Eletrólitos",time_min:.5,points:0,result:"Sódio sem alteração adicional relevante neste caso.",satisfies:["electrolytes"]},
    {id:"potassium",label:"Potássio",category:"laboratorio",subgroup:"Eletrólitos",time_min:.5,points:0,result:"Potássio sem alteração adicional relevante neste caso.",satisfies:["electrolytes"]},
    {id:"calcium_lab",label:"Cálcio",category:"laboratorio",subgroup:"Eletrólitos",time_min:.5,points:0,result:"Cálcio sem alteração adicional relevante neste caso."},
    {id:"magnesium_lab",label:"Magnésio",category:"laboratorio",subgroup:"Eletrólitos",time_min:.5,points:0,result:"Magnésio sem alteração adicional relevante neste caso."},
    {id:"chloride",label:"Cloro",category:"laboratorio",subgroup:"Eletrólitos",time_min:.5,points:0,result:"Cloro sem alteração adicional relevante neste caso."},
    {id:"urea",label:"Ureia",category:"laboratorio",subgroup:"Função renal",time_min:.5,points:0,result:"Ureia sem alteração adicional relevante neste caso."},
    {id:"creatinine",label:"Creatinina",category:"laboratorio",subgroup:"Função renal",time_min:.5,points:0,result:"Creatinina sem alteração adicional relevante neste caso.",satisfies:["electrolytes"]},
    {id:"gas",label:"Gasometria",category:"laboratorio",subgroup:"Gasometria",time_min:.5,points:0,result:"Gasometria disponível; interpretar conforme o quadro clínico."},
    {id:"lactate",label:"Lactato",category:"laboratorio",subgroup:"Gasometria",time_min:.5,points:0,result:"Lactato disponível; interpretar conforme perfusão e contexto clínico."},
    {id:"troponin",label:"Troponina",category:"laboratorio",subgroup:"Cardíacos",time_min:.5,points:0,result:"Troponina disponível; interpretar no contexto clínico e eletrocardiográfico."},
    {id:"bnp",label:"BNP / NT-proBNP",category:"laboratorio",subgroup:"Cardíacos",time_min:.5,points:0,result:"Peptídeo natriurético disponível; interpretar conforme o contexto."},
    {id:"ast",label:"TGO (AST)",category:"laboratorio",subgroup:"Hepáticos",time_min:.5,points:0,result:"TGO disponível; sem alteração adicional relevante neste caso."},
    {id:"alt",label:"TGP (ALT)",category:"laboratorio",subgroup:"Hepáticos",time_min:.5,points:0,result:"TGP disponível; sem alteração adicional relevante neste caso."},
    {id:"ggt",label:"Gama-GT",category:"laboratorio",subgroup:"Hepáticos",time_min:.5,points:0,result:"Gama-GT disponível; sem alteração adicional relevante neste caso."},
    {id:"alp",label:"Fosfatase alcalina",category:"laboratorio",subgroup:"Hepáticos",time_min:.5,points:0,result:"Fosfatase alcalina disponível; sem alteração adicional relevante neste caso."},
    {id:"bilirubin_total",label:"Bilirrubina total",category:"laboratorio",subgroup:"Hepáticos",time_min:.5,points:0,result:"Bilirrubina total disponível; sem alteração adicional relevante neste caso."},
    {id:"bilirubin_direct",label:"Bilirrubina direta",category:"laboratorio",subgroup:"Hepáticos",time_min:.5,points:0,result:"Bilirrubina direta disponível; sem alteração adicional relevante neste caso."},
    {id:"amylase",label:"Amilase",category:"laboratorio",subgroup:"Pancreáticos",time_min:.5,points:0,result:"Amilase disponível; sem alteração adicional relevante neste caso."},
    {id:"lipase",label:"Lipase",category:"laboratorio",subgroup:"Pancreáticos",time_min:.5,points:0,result:"Lipase disponível; sem alteração adicional relevante neste caso."},
    {id:"crp",label:"PCR (proteína C reativa)",category:"laboratorio",subgroup:"Inflamatórios",time_min:.5,points:0,result:"Proteína C reativa disponível; interpretar conforme o contexto."},
    {id:"procalcitonin",label:"Procalcitonina",category:"laboratorio",subgroup:"Inflamatórios",time_min:.5,points:0,result:"Procalcitonina disponível; interpretar conforme o contexto."},
    {id:"pt_inr",label:"TP / INR",category:"laboratorio",subgroup:"Coagulação",time_min:.5,points:0,result:"TP/INR disponível."},
    {id:"aptt",label:"TTPa",category:"laboratorio",subgroup:"Coagulação",time_min:.5,points:0,result:"TTPa disponível."},
    {id:"ddimer",label:"D-dímero",category:"laboratorio",subgroup:"Coagulação",time_min:.5,points:0,result:"D-dímero disponível; interpretar conforme probabilidade pré-teste."},
    {id:"tsh",label:"TSH",category:"laboratorio",subgroup:"Endócrinos",time_min:.5,points:0,result:"TSH disponível."},
    {id:"free_t4",label:"T4 livre",category:"laboratorio",subgroup:"Endócrinos",time_min:.5,points:0,result:"T4 livre disponível."},
    {id:"ketones",label:"Cetonemia",category:"laboratorio",subgroup:"Metabólicos",time_min:.5,points:0,result:"Cetonemia disponível."},
    {id:"serum_glucose",label:"Glicose sérica",category:"laboratorio",subgroup:"Metabólicos",time_min:.5,points:0,result:"Glicose sérica disponível."},
    {id:"phosphorus",label:"Fósforo",category:"laboratorio",subgroup:"Eletrólitos",time_min:.5,points:0,result:"Fósforo disponível."},
    {id:"albumin",label:"Albumina",category:"laboratorio",subgroup:"Proteínas",time_min:.5,points:0,result:"Albumina disponível."},
    {id:"total_protein",label:"Proteínas totais",category:"laboratorio",subgroup:"Proteínas",time_min:.5,points:0,result:"Proteínas totais disponíveis."},
    {id:"ck",label:"CK total",category:"laboratorio",subgroup:"Musculares",time_min:.5,points:0,result:"CK total disponível."},
    {id:"ckmb",label:"CK-MB",category:"laboratorio",subgroup:"Cardíacos",time_min:.5,points:0,result:"CK-MB disponível."},
    {id:"ldh",label:"LDH",category:"laboratorio",subgroup:"Outros",time_min:.5,points:0,result:"LDH disponível."},
    {id:"fibrinogen",label:"Fibrinogênio",category:"laboratorio",subgroup:"Coagulação",time_min:.5,points:0,result:"Fibrinogênio disponível."},
    {id:"blood_cultures",label:"Hemoculturas",category:"laboratorio",subgroup:"Microbiologia",time_min:.5,points:0,result:"Hemoculturas coletadas."},
    {id:"urine_culture",label:"Urocultura",category:"laboratorio",subgroup:"Microbiologia",time_min:.5,points:0,result:"Urocultura coletada."},
    {id:"toxicology",label:"Triagem toxicológica",category:"laboratorio",subgroup:"Toxicologia",time_min:.5,points:0,result:"Triagem toxicológica solicitada."},
    {id:"ethanol",label:"Etanol sérico",category:"laboratorio",subgroup:"Toxicologia",time_min:.5,points:0,result:"Etanol sérico disponível."},
    {id:"pocus",label:"POCUS",category:"imagem",subgroup:"Ultrassom",time_min:.5,points:0,result:"POCUS realizado; nenhum achado adicional relevante neste caso."},
    {id:"fast",label:"FAST / eFAST",category:"imagem",subgroup:"Ultrassom",time_min:.5,points:0,result:"FAST/eFAST realizado; sem achado adicional relevante neste caso."},
    {id:"xray_chest",label:"Raio-X de tórax",category:"imagem",subgroup:"Radiografia",time_min:1,points:0,result:"Radiografia de tórax realizada; sem achado adicional relevante neste caso.",satisfies:["cxr"]},
    {id:"xray_abdomen",label:"Raio-X de abdômen",category:"imagem",subgroup:"Radiografia",time_min:1,points:0,result:"Radiografia de abdômen realizada; sem achado adicional relevante neste caso."},
    {id:"ct_head",label:"Tomografia de crânio",category:"imagem",subgroup:"Tomografia",time_min:5,points:0,result:"Tomografia de crânio realizada; sem achado adicional relevante neste caso.",satisfies:["ct_brain"]},
    {id:"ct_chest",label:"Tomografia de tórax",category:"imagem",subgroup:"Tomografia",time_min:5,points:0,result:"Tomografia de tórax realizada; sem achado adicional relevante neste caso."},
    {id:"ct_abdomen",label:"Tomografia de abdômen e pelve",category:"imagem",subgroup:"Tomografia",time_min:5,points:0,result:"Tomografia de abdômen e pelve realizada; sem achado adicional relevante neste caso."},
    {id:"cta_head_neck",label:"Angio-TC de crânio e pescoço",category:"imagem",subgroup:"Tomografia",time_min:6,points:0,result:"Angio-TC realizada; sem achado adicional relevante neste caso."},
    {id:"cta_chest",label:"Angio-TC de tórax",category:"imagem",subgroup:"Tomografia",time_min:6,points:0,result:"Angio-TC de tórax realizada; sem achado adicional relevante neste caso."},
    {id:"mri_brain",label:"Ressonância de crânio",category:"imagem",subgroup:"Ressonância",time_min:10,points:0,result:"Ressonância de crânio realizada; sem achado adicional relevante neste caso."},
    {id:"mri_spine",label:"Ressonância de coluna",category:"imagem",subgroup:"Ressonância",time_min:10,points:0,result:"Ressonância de coluna realizada; sem achado adicional relevante neste caso."},
    {id:"us_abdomen",label:"Ultrassonografia de abdômen",category:"imagem",subgroup:"Ultrassom",time_min:4,points:0,result:"Ultrassonografia de abdômen realizada."},
    {id:"echo",label:"Ecocardiograma",category:"imagem",subgroup:"Ultrassom",time_min:4,points:0,result:"Ecocardiograma realizado."},
    {id:"vascular_doppler",label:"Doppler vascular",category:"imagem",subgroup:"Ultrassom",time_min:4,points:0,result:"Doppler vascular realizado."},
    {id:"ct_spine",label:"Tomografia de coluna",category:"imagem",subgroup:"Tomografia",time_min:6,points:0,result:"Tomografia de coluna realizada."},
    {id:"defibrillate",label:"Desfibrilar",category:"iniciais",subgroup:"Ressuscitação",time_min:.25,points:0,result:"Desfibrilação executada conforme o estágio atual do caso.",repeatable:true},
    {id:"sync_cardioversion",label:"Cardioversão sincronizada",category:"procedimentos_terapeuticos",subgroup:"Terapia elétrica",time_min:.25,points:0,result:"Cardioversão sincronizada realizada."},
    {id:"airway",label:"Via aérea definitiva / intubação",category:"iniciais",subgroup:"Via aérea / emergência",time_min:.5,points:0,result:"Via aérea definitiva realizada; confirmar posicionamento e ventilação."},
    {id:"cricothyrotomy",label:"Cricotireoidostomia",category:"iniciais",subgroup:"Via aérea / emergência",time_min:1,points:0,result:"Via aérea cirúrgica realizada."},
    {id:"needle_decompression",label:"Descompressão torácica imediata",category:"procedimentos_terapeuticos",subgroup:"Tórax",time_min:.5,points:0,result:"Descompressão torácica realizada."},
    {id:"chest_tube",label:"Drenagem torácica",category:"procedimentos_terapeuticos",subgroup:"Tórax",time_min:2,points:0,result:"Dreno torácico instalado."},
    {id:"pelvic_binder",label:"Cinta pélvica",category:"procedimentos_terapeuticos",subgroup:"Trauma",time_min:.5,points:0,result:"Cinta pélvica aplicada."},
    {id:"tourniquet",label:"Torniquete",category:"procedimentos_terapeuticos",subgroup:"Hemorragia",time_min:.25,points:0,result:"Torniquete aplicado."},
    {id:"direct_pressure",label:"Compressão direta de sangramento",category:"procedimentos_terapeuticos",subgroup:"Hemorragia",time_min:.25,points:0,result:"Compressão direta realizada."},
    {id:"urinary_catheter",label:"Sonda vesical",category:"procedimentos_terapeuticos",subgroup:"Dispositivos",time_min:.5,points:0,result:"Sonda vesical instalada."},
    {id:"ng_tube",label:"Sonda nasogástrica",category:"procedimentos_terapeuticos",subgroup:"Dispositivos",time_min:.5,points:0,result:"Sonda nasogástrica instalada."},
    {id:"transcutaneous_pacing",label:"Marcapasso transcutâneo",category:"procedimentos_terapeuticos",subgroup:"Terapia elétrica",time_min:.5,points:0,result:"Marcapasso transcutâneo iniciado."},
    {id:"pericardiocentesis",label:"Pericardiocentese",category:"procedimentos_terapeuticos",subgroup:"Procedimentos invasivos",time_min:1,points:0,result:"Pericardiocentese realizada."},
    {id:"thoracentesis",label:"Toracocentese",category:"procedimentos_terapeuticos",subgroup:"Tórax",time_min:1,points:0,result:"Toracocentese realizada."},
    {id:"central_line",label:"Acesso venoso central",category:"procedimentos_terapeuticos",subgroup:"Acessos",time_min:2,points:0,result:"Acesso venoso central obtido."},
    {id:"arterial_line_generic",label:"Cateter arterial",category:"procedimentos_terapeuticos",subgroup:"Acessos",time_min:2,points:0,result:"Cateter arterial instalado."},
    {id:"epi_im",label:"Adrenalina IM",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Adrenalina IM administrada."},
    {id:"epi",label:"Adrenalina IV/IO",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Adrenalina IV/IO administrada."},
    {id:"amiodarone",label:"Amiodarona",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Amiodarona administrada."},
    {id:"lidocaine",label:"Lidocaína",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Lidocaína administrada."},
    {id:"bicarb",label:"Bicarbonato de sódio",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Bicarbonato administrado; benefício depende da indicação clínica."},
    {id:"calcium",label:"Cálcio IV",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Cálcio IV administrado; benefício depende da indicação clínica."},
    {id:"atropine",label:"Atropina",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Atropina administrada."},
    {id:"adenosine",label:"Adenosina",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Adenosina administrada."},
    {id:"magnesium",label:"Sulfato de magnésio",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Sulfato de magnésio administrado."},
    {id:"norepi",label:"Noradrenalina",category:"tratamento",subgroup:"Vasoativos",time_min:.25,points:0,result:"Noradrenalina iniciada e titulada."},
    {id:"dobutamine",label:"Dobutamina",category:"tratamento",subgroup:"Vasoativos",time_min:.25,points:0,result:"Dobutamina iniciada."},
    {id:"dopamine",label:"Dopamina",category:"tratamento",subgroup:"Vasoativos",time_min:.25,points:0,result:"Dopamina iniciada."},
    {id:"nitroglycerin",label:"Nitroglicerina",category:"tratamento",subgroup:"Cardiovasculares",time_min:.25,points:0,result:"Nitroglicerina administrada."},
    {id:"metoprolol",label:"Metoprolol",category:"tratamento",subgroup:"Cardiovasculares",time_min:.25,points:0,result:"Metoprolol administrado."},
    {id:"diltiazem",label:"Diltiazem",category:"tratamento",subgroup:"Cardiovasculares",time_min:.25,points:0,result:"Diltiazem administrado."},
    {id:"furosemide",label:"Furosemida",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Furosemida administrada."},
    {id:"salbutamol",label:"Salbutamol",category:"tratamento",subgroup:"Respiratórios",time_min:.25,points:0,result:"Salbutamol administrado."},
    {id:"ipratropium",label:"Ipratrópio",category:"tratamento",subgroup:"Respiratórios",time_min:.25,points:0,result:"Ipratrópio administrado."},
    {id:"hydrocortisone",label:"Hidrocortisona",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Hidrocortisona administrada."},
    {id:"antihistamine",label:"Anti-histamínico H1",category:"tratamento",subgroup:"Medicamentos",time_min:.25,points:0,result:"Anti-histamínico administrado."},
    {id:"ceftriaxone",label:"Ceftriaxona",category:"tratamento",subgroup:"Antimicrobianos",time_min:.25,points:0,result:"Ceftriaxona administrada."},
    {id:"azithromycin",label:"Azitromicina",category:"tratamento",subgroup:"Antimicrobianos",time_min:.25,points:0,result:"Azitromicina administrada."},
    {id:"piperacillin_tazo",label:"Piperacilina-tazobactam",category:"tratamento",subgroup:"Antimicrobianos",time_min:.25,points:0,result:"Piperacilina-tazobactam administrada."},
    {id:"vancomycin",label:"Vancomicina",category:"tratamento",subgroup:"Antimicrobianos",time_min:.25,points:0,result:"Vancomicina administrada."},
    {id:"morphine",label:"Morfina",category:"tratamento",subgroup:"Analgesia",time_min:.25,points:0,result:"Morfina administrada."},
    {id:"fentanyl",label:"Fentanil",category:"tratamento",subgroup:"Analgesia",time_min:.25,points:0,result:"Fentanil administrado."},
    {id:"dipyrone",label:"Dipirona",category:"tratamento",subgroup:"Analgesia",time_min:.25,points:0,result:"Dipirona administrada."},
    {id:"paracetamol",label:"Paracetamol",category:"tratamento",subgroup:"Analgesia",time_min:.25,points:0,result:"Paracetamol administrado."},
    {id:"ondansetron",label:"Ondansetrona",category:"tratamento",subgroup:"Sintomáticos",time_min:.25,points:0,result:"Ondansetrona administrada."},
    {id:"midazolam",label:"Midazolam",category:"tratamento",subgroup:"Sedação",time_min:.25,points:0,result:"Midazolam administrado."},
    {id:"ketamine",label:"Cetamina",category:"tratamento",subgroup:"Sedação",time_min:.25,points:0,result:"Cetamina administrada."},
    {id:"propofol",label:"Propofol",category:"tratamento",subgroup:"Sedação",time_min:.25,points:0,result:"Propofol administrado."},
    {id:"rocuronium",label:"Rocurônio",category:"tratamento",subgroup:"Sequência rápida",time_min:.25,points:0,result:"Rocurônio administrado."},
    {id:"succinylcholine",label:"Succinilcolina",category:"tratamento",subgroup:"Sequência rápida",time_min:.25,points:0,result:"Succinilcolina administrada."},
    {id:"crystalloid",label:"Cristaloide IV",category:"tratamento",subgroup:"Fluidos",time_min:.5,points:0,result:"Cristaloide administrado com reavaliação clínica."},
    {id:"blood",label:"Concentrado de hemácias",category:"tratamento",subgroup:"Hemoderivados",time_min:.5,points:0,result:"Concentrado de hemácias iniciado."},
    {id:"plasma",label:"Plasma fresco congelado",category:"tratamento",subgroup:"Hemoderivados",time_min:.5,points:0,result:"Plasma fresco congelado iniciado."},
    {id:"platelets_tx",label:"Concentrado de plaquetas",category:"tratamento",subgroup:"Hemoderivados",time_min:.5,points:0,result:"Concentrado de plaquetas iniciado."},
    {id:"tranexamic",label:"Ácido tranexâmico",category:"tratamento",subgroup:"Hemostáticos",time_min:.25,points:0,result:"Ácido tranexâmico administrado."},
    {id:"aspirin",label:"AAS",category:"tratamento",subgroup:"Antitrombóticos",time_min:.25,points:0,result:"AAS administrado."},
    {id:"clopidogrel",label:"Clopidogrel",category:"tratamento",subgroup:"Antitrombóticos",time_min:.25,points:0,result:"Clopidogrel administrado."},
    {id:"heparin",label:"Heparina não fracionada",category:"tratamento",subgroup:"Antitrombóticos",time_min:.25,points:0,result:"Heparina administrada."},
    {id:"enoxaparin",label:"Enoxaparina",category:"tratamento",subgroup:"Antitrombóticos",time_min:.25,points:0,result:"Enoxaparina administrada."},
    {id:"thrombolytic",label:"Trombólise sistêmica",category:"tratamento",subgroup:"Trombolíticos",time_min:.25,points:0,result:"Trombólise iniciada conforme indicação selecionada."},
    {id:"insulin",label:"Insulina regular",category:"tratamento",subgroup:"Metabólicos",time_min:.25,points:0,result:"Insulina regular administrada."},
    {id:"dextrose",label:"Glicose IV",category:"tratamento",subgroup:"Metabólicos",time_min:.25,points:0,result:"Glicose IV administrada."},
    {id:"glucagon",label:"Glucagon",category:"tratamento",subgroup:"Metabólicos",time_min:.25,points:0,result:"Glucagon administrado."},
    {id:"naloxone",label:"Naloxona",category:"tratamento",subgroup:"Antídotos",time_min:.25,points:0,result:"Naloxona administrada."},
    {id:"flumazenil",label:"Flumazenil",category:"tratamento",subgroup:"Antídotos",time_min:.25,points:0,result:"Flumazenil administrado; avaliar risco de convulsões e contraindicações."},
    {id:"diazepam",label:"Diazepam",category:"tratamento",subgroup:"Neurológicos",time_min:.25,points:0,result:"Diazepam administrado."},
    {id:"levetiracetam",label:"Levetiracetam",category:"tratamento",subgroup:"Neurológicos",time_min:.25,points:0,result:"Levetiracetam administrado."},
    {id:"phenobarbital",label:"Fenobarbital",category:"tratamento",subgroup:"Neurológicos",time_min:.25,points:0,result:"Fenobarbital administrado."},
    {id:"haloperidol",label:"Haloperidol",category:"tratamento",subgroup:"Psiquiátricos",time_min:.25,points:0,result:"Haloperidol administrado."}
  ];

  const GENERAL_DIAGNOSES = [
    "PCR em fibrilação ventricular","PCR em taquicardia ventricular sem pulso","Assistolia","Atividade elétrica sem pulso",
    "Fibrilação atrial com instabilidade","Taquicardia supraventricular","Taquicardia ventricular com pulso","Bradicardia sintomática",
    "Síndrome coronariana aguda","Edema agudo de pulmão","Choque cardiogênico","Choque hipovolêmico","Choque distributivo",
    "Anafilaxia","Choque séptico","Pneumonia","Crise asmática","DPOC exacerbada","Embolia pulmonar","Pneumotórax hipertensivo",
    "AVC isquêmico","AVC hemorrágico","Crise convulsiva","Meningite","Hipoglicemia","Cetoacidose diabética","Estado hiperosmolar",
    "Hemorragia digestiva","Pancreatite aguda","Colecistite aguda","Colangite","Apendicite","Obstrução intestinal","Perfuração de víscera",
    "Pielonefrite","Cólica renal","Trauma cranioencefálico","Trauma torácico","Trauma abdominal"
  ].map((label,index)=>({id:"generic_dx_"+index,role:"diagnosis",label,category:"hipoteses",subgroup:"Hipótese principal",time_min:.1,points:0,genericDiagnosis:true}));

  const GENERAL_DISPOSITIONS = [
    {id:"generic_dest_discharge",role:"disposition",label:"Alta domiciliar",category:"destino",subgroup:"Conduta final",time_min:.1,points:0,genericDisposition:true},
    {id:"generic_dest_observation",role:"disposition",label:"Observação hospitalar",category:"destino",subgroup:"Conduta final",time_min:.1,points:0,genericDisposition:true},
    {id:"generic_dest_ward",role:"disposition",label:"Internação em enfermaria / unidade monitorizada",category:"destino",subgroup:"Conduta final",time_min:.1,points:0,genericDisposition:true},
    {id:"generic_dest_icu",role:"disposition",label:"Internação em UTI",category:"destino",subgroup:"Conduta final",time_min:.1,points:0,genericDisposition:true},
    {id:"generic_refer_none",label:"Não encaminhar",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Atendimento mantido sem encaminhamento para outra especialidade."},
    {id:"generic_refer_surgery",label:"Cirurgia Geral",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Cirurgia Geral acionada."},
    {id:"generic_refer_cardio",label:"Cardiologia",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Cardiologia acionada."},
    {id:"generic_refer_neuro",label:"Neurologia",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Neurologia acionada."},
    {id:"generic_refer_ortho",label:"Ortopedia",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Ortopedia acionada."},
    {id:"generic_refer_vascular",label:"Cirurgia Vascular",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Cirurgia Vascular acionada."},
    {id:"generic_refer_urology",label:"Urologia",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Urologia acionada."},
    {id:"generic_refer_obgyn",label:"Ginecologia e Obstetrícia",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Ginecologia e Obstetrícia acionada."},
    {id:"generic_refer_psych",label:"Psiquiatria",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Psiquiatria acionada."},
    {id:"generic_refer_pediatrics",label:"Pediatria",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Pediatria acionada."},
    {id:"generic_refer_infectious",label:"Infectologia",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Infectologia acionada."},
    {id:"generic_refer_pulmonology",label:"Pneumologia",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Pneumologia acionada."},
    {id:"generic_refer_gastro",label:"Gastroenterologia",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Gastroenterologia acionada."},
    {id:"generic_refer_nephro",label:"Nefrologia",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Nefrologia acionada."},
    {id:"generic_refer_hematology",label:"Hematologia",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Hematologia acionada."},
    {id:"generic_refer_endocrine",label:"Endocrinologia",category:"encaminhamento",subgroup:"Especialidades",time_min:.1,points:0,result:"Endocrinologia acionada."}
  ];

  const HIDDEN_CASE_ACTIONS = new Set(["shock1","shock2","shock3","electrolytes","cxr","ct_brain"]);
  function caseActions(){ return Array.isArray(state.current?.actions) ? state.current.actions : []; }
  function normalizeLabel(value){ return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase(); }

  // V7: transforma os tópicos de anamnese importados da planilha em perguntas clicáveis.
  // Cada caso pode ter quantas perguntas forem necessárias, sem depender de actions legadas.
  function importedHistoryActions(){
    const raw=String(state.current?.presentation?.history_topics||"").trim();
    if(!raw) return [];
    return raw.split(/\n+/).map(x=>x.replace(/^\s*[•*-]\s*/,"").trim()).filter(Boolean).map((line,i)=>{
      const parts=line.split(/\s*(?:→|=>)\s*/);
      const topic=(parts[0]||("Pergunta "+(i+1))).trim();
      const question=(parts[1]||topic).replace(/^[“"']|[”"']$/g,"").trim();
      const answer=(parts.slice(2).join(" → ")||"Informação não disponível neste caso.").trim();
      return {
        id:"history_v7_"+i,
        label:question,
        category:"anamnese",
        subgroup:topic,
        time_min:.25,
        points:0,
        result:answer
      };
    });
  }

  function mergedActions(){
    const caseList=[...caseActions(),...importedHistoryActions()];

    const byId=new Map(caseList.map(a=>[a.id,a]));
    const generic=[...GENERIC_ACTIONS,...GENERAL_DIAGNOSES,...GENERAL_DISPOSITIONS].map(a=>{
      const exact=byId.get(a.id);
      return exact ? {...a,...exact,subgroup:a.subgroup||exact.subgroup} : a;
    });
    const existingIds=new Set(generic.map(a=>a.id));
    const extras=caseList.filter(a=>!existingIds.has(a.id)&&!HIDDEN_CASE_ACTIONS.has(a.id)&&a.role!=="diagnosis"&&a.role!=="disposition"&&!["exame","iniciais","monitorizacao"].includes(a.category));
    return [...generic,...extras];
  }
  function resolveSpecialAction(action){
    if(action.id!=="defibrillate") return action;
    const sequence=["shock1","shock2","shock3"];
    const next=sequence.find(id=>!done(id));
    return next ? caseActions().find(a=>a.id===next) || action : action;
  }
  function isCorrectGenericDiagnosis(label){
    const target=normalizeLabel(state.current?.debrief?.diagnosis||state.current?.title||"");
    const candidate=normalizeLabel(label);
    if(!target||!candidate) return false;
    const keys=candidate.split(/\s+/).filter(x=>x.length>4);
    return keys.length ? keys.filter(k=>target.includes(k)).length>=Math.min(2,keys.length) : target.includes(candidate);
  }
  function inferGenericDisposition(action){
    const correct=caseActions().find(a=>a.role==="disposition"&&a.correct===true);
    if(!correct) return false;
    const a=normalizeLabel(action.label), b=normalizeLabel(correct.label);
    if(a.includes("uti")) return b.includes("uti");
    if(a.includes("observ")) return b.includes("observ");
    if(a.includes("enfermaria")||a.includes("monitorizada")) return b.includes("enfermaria")||b.includes("monitorizada")||b.includes("ward");
    if(a.includes("alta")) return b.includes("alta");
    return false;
  }

  const groupOf = category => Object.keys(GROUPS).find(key=>GROUPS[key].categories.includes(category)) || "intervir";
  const done = id => E.done(state.current,state.performed,id);
  function openActions(category) {
    state.category=category;
    $("plantao-action-search").value="";
    $("plantao-action-drawer").hidden=false;
    renderActions();
    $("plantao-action-tabs").inert=true;
    $("plantao-action-close").focus();
  }
  function closeActions() {
    $("plantao-action-drawer").hidden=true;
    $("plantao-action-tabs").inert=false;
    renderActions();
    $("plantao-action-tabs").querySelector(`[data-case-category="${state.category}"]`)?.focus();
  }
  function updateScore() {
    const clock=$("plantao-score-live");
    if(!clock)return;
    clock.textContent="◷ "+fmtTime(state.elapsed);
    clock.setAttribute("aria-label","Tempo do caso: "+fmtTime(state.elapsed));
  }
  function patientSex(){
    const raw=normalizeLabel(state.current?.presentation?.sex||"");
    return raw==="f" || raw.startsWith("fem") ? "F" : "M";
  }
  function genderText(text){
    let value=String(text||"");
    if(patientSex()!=="F") return value;
    const pairs=[
      ["orientado","orientada"],["consciente","consciente"],["sonolento","sonolenta"],
      ["confuso","confusa"],["agitado","agitada"],["pálido","pálida"],["corado","corada"],
      ["normocorado","normocorada"],["desidratado","desidratada"],["hidratado","hidratada"],
      ["ictérico","ictérica"],["cianótico","cianótica"],["afebril","afebril"],
      ["acordado","acordada"],["desacordado","desacordada"],["inconsciente","inconsciente"]
    ];
    for(const [m,f] of pairs){
      value=value.replace(new RegExp("\\b"+m+"\\b","gi"),match=>{
        const out=f;
        return match[0]===match[0].toUpperCase()?out.toUpperCase():match[0]===match[0].toUpperCase()?"":match[0][0]===match[0][0].toUpperCase()?out[0].toUpperCase()+out.slice(1):out;
      });
    }
    return value;
  }
  function contextual(text) {
    const filled=String(text||"").replace(/\{\{(\w+)\}\}/g,(_,key)=>String(state.vitals[key]??"não informado"));
    return genderText(filled);
  }

  function renderVitals() {
    const v=state.vitals || {};
    window.PlantaoMonitor?.update(v, {slug:state.current?.slug,enabled:state.monitorOn,patient_image:state.current?.presentation?.patient_image,unconscious_image:state.current?.presentation?.unconscious_image});
    const items=[
      ["FC",v.hr,"bpm"],
      ["SpO₂",v.spo2,"%"],
      ["FR",v.rr,"irpm"],
      ["PA",v.bp,"mmHg"],
      ["Temp",v.temp,"°C"]
    ];
    $("plantao-vitals").innerHTML=items.map(([label,val,unit],idx)=>`
      <div class="plantao-vital">
        <span>${esc(label)}</span>
        <strong>${esc(state.monitorOn ? (val ?? "—") : "—")}${state.monitorOn && unit && val!=null && val!=="—" ? " <small>"+unit+"</small>" : ""}</strong>
      </div>
    `).join("");
  }

  function liveSafeMessage(message) {
    let text=String(message||"").trim();
    if(!text || state.session?.status==="completed") return text;
    const secrets=[state.current?.debrief?.diagnosis,state.current?.title]
      .filter(Boolean)
      .map(value=>String(value).trim())
      .filter(value=>value.length>=5);
    for(const secret of secrets){
      const escaped=secret.replace(/[.*+?^$()|[\]\\]/g,match=>"\\\\"+match);
      text=text.replace(new RegExp(escaped,"gi"),"achado clínico relevante");
    }
    return text || "Informação registrada no prontuário.";
  }

  function feed(message,type="event",time=state.elapsed) {
    message=liveSafeMessage(message);
    state.log.push({time,message,type});
    $("plantao-feed").innerHTML=state.log.slice().reverse().map(item=>`
      <div class="plantao-feed-item ${esc(item.type)}">
        <span>T+${fmtTime(item.time)}</span>
        <p>${esc(item.message)}</p>
      </div>
    `).join("");
  }

  function interventionSection(action){
    return action.category==="tratamento" ? "medicamentos" : "gerais";
  }
  function renderActions() {
    const actions=mergedActions();
    if(!GROUPS[state.category])state.category="anamnese";
    $("plantao-action-tabs").innerHTML=Object.entries(GROUPS).map(([key,g])=>`
      <button class="plantao-action-tab" type="button" data-case-category="${key}" aria-controls="plantao-action-drawer" aria-expanded="${!$("plantao-action-drawer").hidden&&key===state.category}">
        <span aria-hidden="true">${g.icon}</span><span>${g.label}</span>
      </button>`).join("");
    $("plantao-action-title").textContent=GROUPS[state.category].label;
    const search=$("plantao-action-search").value.trim().toLocaleLowerCase('pt-BR');
    let available=actions.filter(a=>groupOf(a.category)===state.category && (!search||(a.label+" "+(a.subgroup||"")).toLocaleLowerCase('pt-BR').includes(search)));
    if(state.category==="intervir"){
      state.interventionTab=state.interventionTab||"gerais";
      const tabHtml='<div class="plantao-intervention-tabs"><button type="button" data-intervention-tab="gerais" class="'+(state.interventionTab==="gerais"?"active":"")+'">Gerais</button><button type="button" data-intervention-tab="medicamentos" class="'+(state.interventionTab==="medicamentos"?"active":"")+'">Medicamentos</button></div>';
      available=available.filter(a=>interventionSection(a)===state.interventionTab);
      $("plantao-actions").dataset.tabs=tabHtml;
    } else $("plantao-actions").dataset.tabs="";
    const groups=[...new Set(available.map(a=>a.subgroup||CATEGORY_LABELS[a.category]||"Opções"))];
    $("plantao-actions").innerHTML=($("plantao-actions").dataset.tabs||"")+groups.map(group=>`<section class="plantao-action-group"><h3>${esc(group)}</h3>${available.filter(a=>(a.subgroup||CATEGORY_LABELS[a.category]||"Opções")===group).map(action=>{
      const completed=done(action.id);
      const specialRepeat=action.id==="defibrillate";
      return `<button class="plantao-action" type="button" data-case-action="${esc(action.id)}" ${state.busy||(completed&&!action.repeatable&&!specialRepeat)?"disabled":""}>
        <strong>${esc(action.label)}</strong>
        <small>${completed&&!action.repeatable?"Realizado":"+"+fmtTime(action.time_min||0)}${action.role==='disposition'?" · Encerrar atendimento":""}</small>
      </button>`;
    }).join("")}</section>`).join("") || '<p class="plantao-no-actions">Nenhuma opção encontrada.</p>';
  }

  function recordSequenceViolation(action,{missing=[],penalty=2,blocked=true,message=""}={}) {
    const missingLabels=missing.map(actionLabel);
    const text=message || (blocked
      ? "Você tentou "+action.label+" antes de "+missingLabels.join(", ")+"."
      : "Você realizou "+action.label+" antes de "+missingLabels.join(", ")+".");
    state.sequenceViolations.push({
      action_id:action.id,
      action_label:action.label,
      missing_ids:[...missing],
      missing_labels:missingLabels,
      penalty:Number(penalty||0),
      blocked:blocked===true,
      message:text,
      time:state.elapsed
    });
    return text;
  }

  function sequenceCheck(action) {
    const hardMissing=(action.requires_all||[]).filter(id=>!done(id));
    if(hardMissing.length) {
      return {
        blocked:true,
        missing:hardMissing,
        penalty:Number(action.requires_penalty??2),
        message:action.result_if_blocked||""
      };
    }

    const softMissing=(action.order_after_all||[]).filter(id=>!done(id));
    const anyIds=action.order_after_any||[];
    const anySatisfied=!anyIds.length || anyIds.some(id=>done(id));
    if(softMissing.length || !anySatisfied) {
      const missing=[...softMissing,...(!anySatisfied?anyIds:[])];
      return {
        blocked:false,
        missing:[...new Set(missing)],
        penalty:Number(action.order_penalty??3),
        message:action.order_message||""
      };
    }
    return null;
  }

  function classifyAction(action,original) {
    const slug=state.current?.slug||"";
    const id=original?.id||action.id;
    const target=normalizeLabel([state.current?.title,state.current?.debrief?.diagnosis,state.current?.initial_vitals?.rhythm].filter(Boolean).join(" "));
    const shockAction=["defibrillate","shock1","shock2","shock3","unsync_shock"].includes(id);
    const shockableArrest =
      target.includes("fibrilacao ventricular") ||
      target.includes("fv") ||
      target.includes("taquicardia ventricular sem pulso") ||
      target.includes("tv sem pulso");
    // Regra do simulador: choque NÃO sincronizado fora de FV/TV sem pulso é uma conduta mortal.
    // Cardioversão sincronizada continua sendo uma ação distinta para taquiarritmias com pulso.
    if(shockAction && !shockableArrest)
      return {level:"mortal",reason:"Você aplicou desfibrilação não sincronizada em um paciente sem ritmo chocável de parada. A conduta provocou deterioração fatal no caso simulado."};
    if(slug==="vf-arrest-ed" && !done("cpr")) {
      if(id==="cricothyrotomy") return {level:"mortal",reason:"Cricotireoidostomia realizada em um paciente em parada cardiorrespiratória antes das medidas imediatas de ressuscitação."};
      if(["ct_head","ct_chest","ct_abdomen","mri_brain","mri_spine","xray_chest","xray_abdomen"].includes(id))
        return {level:"mortal",reason:"Você priorizou um exame demorado durante uma PCR antes de iniciar RCP."};
      if(["exam_neuro","exam_head","exam_airway","exam_eyes","exam_chest","exam_upper","exam_abdomen","exam_lower","exam_extremities","exam_skin"].includes(id))
        return {level:"malefica",reason:"Você atrasou RCP para realizar exame físico durante uma PCR."};
    }
    const rules=state.current?.completion_rules||{};
    const mal=normalizeLabel(rules.maleficos||"");
    const mort=normalizeLabel(rules.mortais||"");
    const caseTitle=normalizeLabel(state.current?.title||"");
    const actionText=normalizeLabel([id,action.label,action.subgroup].filter(Boolean).join(" "));

    // Regras estruturadas importadas da planilha: primeiro avalia as condutas mortais,
    // depois as maléficas. Regras específicas vencem o comportamento genérico.
    const isDischarge=/alta|home|discharge/.test(actionText);
    const isThrombolysis=/thrombolytic|trombol|trombolise/.test(actionText);
    const isAnticoag=/heparin|enoxaparin|anticoag/.test(actionText);
    const isImaging=/ct_|mri_|xray|tomografia|ressonancia|raio/.test(actionText);
    const isAggressiveAirway=/cricothyrotomy|airway|intub|orofaring/.test(actionText);
    const isSedation=/midazolam|diazepam|propofol|ketamine|fentanyl|morphine|sedac/.test(actionText);

    if(isDischarge && /alta|abandono/.test(mort))
      return {level:"mortal",reason:"A planilha deste caso classifica alta/abandono nesta condição como conduta mortal no simulador."};
    if(isThrombolysis && /trombol/.test(mort))
      return {level:"mortal",reason:"A planilha deste caso classifica trombólise nesta situação como conduta mortal no simulador."};
    if(isAggressiveAirway && /instrumentacao.*obstrucao/.test(mort))
      return {level:"mortal",reason:"A planilha deste caso classifica instrumentação que precipite obstrução como conduta mortal no simulador."};

    if((isThrombolysis||isAnticoag) && /anticoagulacao|trombolise/.test(mal))
      return {level:"malefica",reason:"A planilha deste caso classifica anticoagulação/trombólise nesta situação como conduta maléfica."};
    if(isImaging && /aguardar rx|atrasar.*exames|baixo valor.*atrase/.test(mal))
      return {level:"malefica",reason:"Este exame atrasa uma intervenção tempo-dependente e é classificado como maléfico neste caso."};
    if(isSedation && /sedacao sem controle de via aerea/.test(mal))
      return {level:"malefica",reason:"Sedação sem controle adequado da via aérea é classificada como maléfica neste caso."};

    const brainBleed=/avc hemorragico|hemorragia subaracnoidea|hematoma epidural|hematoma subdural/.test(caseTitle);
    if(brainBleed && isThrombolysis) return {level:"mortal",reason:"Trombólise é classificada como mortal neste caso simulado."};
    if(brainBleed && isAnticoag) return {level:"malefica",reason:"Anticoagulação é classificada como maléfica neste caso."};
    if(caseTitle.includes("sindrome aortica aguda") && isThrombolysis) return {level:"mortal",reason:"Trombólise é classificada como mortal neste caso simulado."};
    if(caseTitle.includes("sindrome aortica aguda") && isAnticoag) return {level:"malefica",reason:"Anticoagulação antes de excluir dissecção é maléfica neste caso."};
    if(caseTitle.includes("anafilaxia") && id==="antihistamine" && !done("epi_im")) return {level:"malefica",reason:"Anti-histamínico antes da adrenalina IM atrasa a terapia prioritária."};
    if(caseTitle.includes("intoxicacao por benzodiazepinico") && id==="flumazenil") return {level:"malefica",reason:"Flumazenil indiscriminado é maléfico neste caso."};
    if(caseTitle.includes("pneumotorax hipertensivo") && isImaging && !done("needle_decompression")) return {level:"malefica",reason:"Imagem antes da descompressão no paciente instável é maléfica."};

    const pts=Number(action.points||0);
    if(action.clinical_class) return {level:action.clinical_class,reason:action.clinical_reason||""};
    const required=(rules.required_actions||[]);
    const recommended=(rules.recommended_actions||[]);
    if(required.some(x=>x===id||x===action.id)) return {level:"essencial",reason:action.clinical_reason||"Conduta essencial para o manejo deste caso."};
    if(recommended.some(x=>x===id||x===action.id)) return {level:"benefica",reason:action.clinical_reason||"Conduta útil e apropriada neste caso."};
    if(pts<=-15) return {level:"mortal",reason:action.result||"A conduta provocou deterioração crítica."};
    if(pts<0) return {level:"malefica",reason:action.result||"A conduta foi prejudicial."};
    if(pts>0) return {level:"benefica",reason:""};
    return {level:"neutra",reason:action.clinical_reason||"Conduta sem benefício ou dano relevante para este caso."};
  }

  function recordClinicalEvent(level,action,reason) {
    state.clinicalEvents.push({level,action_id:action.id,action_label:action.label,reason:reason||"",time:state.elapsed});
  }

  async function killPatient(reason,action=null) {
    if(state.dead)return;
    state.dead=true;
    state.deathReason=reason||"O paciente evoluiu a óbito.";
    state.vitals={...state.vitals,hr:0,spo2:0,rr:0,bp:"0/0",temp:state.vitals.temp,rhythm:"Assistolia",pulse:false,mental:"Inconsciente"};
    state.monitorOn=true;
    window.PlantaoMonitor?.update(state.vitals,{slug:state.current?.slug,enabled:true});
    renderVitals();
    $("plantao-time").textContent=fmtTime(state.elapsed);
    state.score=Math.min(state.score,-50);
    state.penalties+=25;
    recordClinicalEvent("mortal",action||{id:"death",label:"Óbito"},state.deathReason);
    feed("ÓBITO: "+state.deathReason,"warning");
    $("plantao-death-reason").textContent=state.deathReason;
    $("plantao-death-overlay").hidden=false;
    $("plantao-simulator").classList.add("patient-dead");
    $("plantao-action-tabs").inert=true;
    $("plantao-action-drawer").hidden=true;
    $("plantao-action-search").value="";
    renderActions();
    $("plantao-finish").disabled=true;
    await persistSession({status:"completed",completed_at:new Date().toISOString(),score:0,result:{death:true,death_reason:state.deathReason,clinical_events:state.clinicalEvents, harmful_count:state.harmfulCount,scoring_version:4}});
  }

  async function applyClinicalClass(action,original) {
    const cls=classifyAction(action,original);
    if(cls.level==="mortal"){await killPatient(cls.reason,action);return true;}
    if(cls.level==="malefica"){
      state.harmfulCount+=1;
      const penalty=Number(action.harmful_penalty??4);
      state.penalties+=penalty; state.score-=penalty;
      recordClinicalEvent("malefica",action,cls.reason);
      if(state.harmfulCount>=3){await killPatient("Três condutas prejudiciais acumuladas levaram à deterioração fatal. Última: "+(cls.reason||action.label),action);return true;}
    } else if(cls.level==="essencial"){
      const bonus=Number(action.essential_points??8); state.score+=bonus; recordClinicalEvent("essencial",action,cls.reason);
    } else if(cls.level==="benefica"){
      const bonus=Number(action.beneficial_points??3); state.score+=bonus; recordClinicalEvent("benefica",action,cls.reason);
    } else recordClinicalEvent(cls.level,action,cls.reason);
    return false;
  }

  function applyEffects(effects={}) {
    if (effects.vitals && typeof effects.vitals==="object") {
      state.vitals={...state.vitals,...effects.vitals};
    }
    if (effects.outcome && !state.outcomes.includes(effects.outcome)) {
      state.outcomes.push(effects.outcome);
    }
  }

  function applyDeterioration() {
    const events=Array.isArray(state.current?.deterioration) ? state.current.deterioration : [];
    for (const event of events) {
      if (state.triggered.includes(event.once_key)) continue;
      if (state.elapsed < Number(event.after_min||0)) continue;
      if (event.unless_action && done(event.unless_action)) continue;
      state.triggered.push(event.once_key);
      state.score-=6;
      state.penalties+=6;
      applyEffects(event.effects||{});
      feed("O paciente apresentou piora clínica.","warning");
    }
  }

  function fatalDelayReason() {
    const t=normalizeLabel(state.current?.title||"");
    const anyDone=(ids)=>ids.some(done);
    if((state.current?.slug==="vf-arrest-ed" || t.includes("pcr pediatrica em fibrilacao ventricular")) && !done("cpr") && state.elapsed>=4) return "A parada cardiorrespiratória permaneceu sem RCP por tempo crítico.";
    if(t.includes("pneumotorax hipertensivo") && !done("needle_decompression") && state.elapsed>=4) return "A descompressão torácica foi atrasada criticamente.";
    if(/fibrilacao atrial instavel|taquicardia ventricular com pulso instavel/.test(t) && !done("sync_cardioversion") && state.elapsed>=6) return "A cardioversão sincronizada foi atrasada apesar da instabilidade.";
    if(t.includes("anafilaxia") && !done("epi_im") && state.elapsed>=5) return "A adrenalina IM foi atrasada em anafilaxia grave.";
    if(/choque septico|sepse|meningococcemia|neutropenia febril/.test(t) && !anyDone(["ceftriaxone","piperacillin_tazo","vancomycin"]) && state.elapsed>=12) return "O antimicrobiano foi atrasado em sepse grave.";
    if(/estado de mal epileptico|convulsao febril prolongada/.test(t) && !anyDone(["midazolam","diazepam"]) && state.elapsed>=5) return "O benzodiazepínico foi atrasado durante convulsão prolongada.";
    if(/eclampsia|pre-eclampsia pos-parto/.test(t) && !done("magnesium") && state.elapsed>=8) return "O sulfato de magnésio foi atrasado na emergência obstétrica.";
    if(t.includes("intoxicacao por opioide") && !done("bvm") && state.elapsed>=4) return "A ventilação foi atrasada na depressão respiratória.";
    return "";
  }

  async function persistSession(extra={}) {
    if (!state.session?.id) return;
    const payload={
      elapsed_minutes:Math.ceil(state.elapsed),
      score:finalScore(),
      state:{
        vitals:state.vitals,
        performed:state.performed,
        outcomes:state.outcomes,
        triggered:state.triggered,
        penalties:state.penalties, criticalElapsed:state.criticalElapsed, elapsed_seconds:Math.round(state.elapsed*60),
        sequenceViolations:state.sequenceViolations,
        harmfulCount:state.harmfulCount, dead:state.dead, deathReason:state.deathReason, clinicalEvents:state.clinicalEvents,
        diagnosis:state.diagnosis, disposition:state.disposition, scoring_version:4
      },
      action_log:state.log,
      ...extra
    };
    const {error}=await sb.from("clinical_case_sessions").update(payload).eq("id",state.session.id);
    if (error) { console.warn("Plantão: não foi possível persistir a sessão",error); return false; }
    return true;
  }

  async function startCase(caseId) {
    if(state.busy)return;
    const item=state.cases.find(x=>x.id===caseId);
    if (!item) return;
    state.current=item;
    state.elapsed=0;
    state.score=0;
    state.vitals={...(item.initial_vitals||{})};
    state.performed=[];
    state.outcomes=[];
    state.triggered=[];
    state.log=[];
    state.sequenceViolations=[];
    state.monitorOn=false;
    state.harmfulCount=0; state.dead=false; state.deathReason=""; state.clinicalEvents=[];
    $("plantao-death-overlay").hidden=true;
    $("plantao-simulator").classList.remove("patient-dead");
    state.category=null;
    state.penalties=0; state.criticalElapsed=0; state.diagnosis=null; state.disposition=null; state.busy=false;
    $("plantao-action-search").value="";
    $("plantao-action-drawer").hidden=true;
    $("plantao-action-tabs").inert=false;

    state.busy=true;
    const {data,error}=await sb.from("clinical_case_sessions").insert({
      user_id:state.user.id,
      case_id:item.id,
      status:"in_progress",
      elapsed_minutes:0,
      score:0,
      state:{vitals:state.vitals,performed:[],outcomes:[],triggered:[],sequenceViolations:[],harmfulCount:0,dead:false,clinicalEvents:[],scoring_version:4},
      action_log:[]
    }).select("id,case_id,status,started_at").single();

    if (error) {
      state.busy=false;
      console.error("Plantão: falha ao iniciar sessão",error);
      window.alert("Não foi possível iniciar o caso.");
      return;
    }
    state.busy=false;
    state.session=data;

    const safeOpening=item.presentation?.opening || item.presentation?.chief_complaint || "Paciente admitido para avaliação na sala de emergência.";
    $("plantao-setting").textContent=item.setting || "Sala de emergência";
    $("plantao-case-title").textContent=item.presentation?.chief_complaint || item.presentation?.display_title || "Caso em avaliação";
    $("plantao-opening").textContent=safeOpening;
    $("plantao-age").textContent=item.presentation?.age || "";
    $("plantao-sex").textContent=item.presentation?.sex || "";
    $("plantao-chief").textContent="";
    $("plantao-time").textContent=fmtTime(0);
    updateScore();
    renderVitals();
    renderActions();
    feed(safeOpening,"event",0);
    show("plantao-simulator");
  }

  async function runAction(actionId) {
    if (!state.current || state.busy || state.session?.status==="completed") return;
    const original=mergedActions().find(x=>x.id===actionId);
    if (!original || (done(actionId)&&!original.repeatable)) return;
    const selected=resolveSpecialAction(original);
    const action=E.resolve(state.current,state,selected);
    if(action.role==='disposition') {
      if(!state.diagnosis) { feed("Selecione uma hipótese principal antes de definir o destino final.","warning");return; }
      if(!window.confirm(action.label+"? Esta decisão encerra o atendimento e abre a avaliação."))return;
    }
    state.busy=true;renderActions();
    $("plantao-finish").disabled=true;$("plantao-back").disabled=true;
    try {
      const sequenceIssue=sequenceCheck(action);
      if(sequenceIssue?.blocked) {
        state.elapsed+=.25;
        if(!E.success(state.current,state))state.criticalElapsed+=.25;
        const penalty=Number(sequenceIssue.penalty||0);
        state.penalties+=penalty;state.score-=penalty;
        const message=recordSequenceViolation(action,sequenceIssue);
        feed((sequenceIssue.message||message)+" (−"+penalty+" pontos por sequência)","warning");
        applyDeterioration();
        const fatalDelay=fatalDelayReason();
        if(fatalDelay){await killPatient(fatalDelay,action);return;}
      } else {
        if(sequenceIssue) {
          const penalty=Number(sequenceIssue.penalty||0);
          state.penalties+=penalty;state.score-=penalty;
          const message=recordSequenceViolation(action,sequenceIssue);
          feed((sequenceIssue.message||message)+" (−"+penalty+" pontos por sequência)","warning");
        }
        const repeated=done(action.id);
        const delta=Number(action.time_min||0);
        if(!E.success(state.current,state))state.criticalElapsed+=delta;
        state.elapsed+=delta;
        // Do not let a late definitive action erase deterioration that occurred during its delay.
        applyDeterioration();
        const fatalDelay=fatalDelayReason();
        if(fatalDelay){await killPatient(fatalDelay,action);return;}
        if(!repeated)state.performed.push(action.id);
        if(original.id==="defibrillate" && !state.performed.includes("defibrillate")) state.performed.push("defibrillate");
        for(const id of (original.satisfies||[])) if(!state.performed.includes(id)) state.performed.push(id);
        if(action.id==="monitor" || original.id==="monitor") state.monitorOn=true;
        const points=repeated?0:Number(action.points||0);
        state.score+=points;
        if(points<0)state.penalties+=Math.abs(points);
        applyEffects(action.effects||{});
        if(action.role==='diagnosis'){
          const correct=action.genericDiagnosis===true ? isCorrectGenericDiagnosis(action.label) : action.correct===true;
          state.diagnosis={id:action.id,label:action.label,correct};
          if(action.genericDiagnosis===true && !correct){state.penalties+=4;state.score-=4;}
        }
        if(action.role==='disposition'){
          const correct=action.genericDisposition===true ? inferGenericDisposition(action) : action.correct===true;
          state.disposition={id:action.id,label:action.label,correct};
          if(action.genericDisposition===true && !correct){state.penalties+=8;state.score-=8;}
          if(action.genericDisposition===true && normalizeLabel(action.label).includes("alta") && !correct && ["septic-shock-ed","vf-arrest-ed","af-unstable-ed","anaphylaxis-ed"].includes(state.current?.slug)){
            await killPatient("Você deu alta a um paciente que necessitava tratamento e monitorização hospitalar imediatos.",action);
            return;
          }
        }
        feed(contextual(action.result||action.label)+(points<0?` (−${Math.abs(points)} pontos)`:""),points<0?"warning":"event");
        const diedFromAction=await applyClinicalClass(action,original);
        if(diedFromAction)return;
      }
      $("plantao-time").textContent=fmtTime(state.elapsed);
      updateScore();renderVitals();
      const saved=await persistSession();
      if(!saved)feed("Não foi possível salvar agora. Mantenha esta tela aberta; a próxima ação tentará novamente.","warning");
      if(action.role==='disposition'&&state.disposition)await finishCase();
    } finally {
      state.busy=false;renderActions();
      $("plantao-finish").disabled=false;$("plantao-back").disabled=false;
    }
  }

  function hasAnySuccessOutcome() {return E.success(state.current,state);}
  function finalScore() {return E.score(state.current,state).total;}

  async function finishCase() {
    if (!state.current || !state.session) return;
    const rules=state.current.completion_rules || {};
    const required=rules.required_actions || [];
    const recommended=rules.recommended_actions || [];
    const missingRequired=required.filter(x=>!done(x));
    const missingRecommended=recommended.filter(x=>!done(x));
    if(!state.diagnosis || !state.disposition) {openActions("hipoteses");return;}
    const score=finalScore();

    const result={
      final_score:score,
      scoring_version:4, penalties:E.score(state.current,state).penalties,
      death:state.dead, death_reason:state.deathReason, harmful_count:state.harmfulCount, clinical_events:state.clinicalEvents,
      sequence_violations:state.sequenceViolations,
      diagnosis:state.diagnosis, disposition:state.disposition,
      missing_required:missingRequired,
      missing_recommended:missingRecommended,
      performed_count:state.performed.length,
      elapsed_minutes:Math.ceil(state.elapsed),
      outcomes:state.outcomes
    };

    const saved=await persistSession({
      status:"completed",
      completed_at:new Date().toISOString(),
      score,
      result
    });

    if(!saved){feed("Não foi possível salvar o encerramento. Tente novamente em Definir destino.","warning");return;}
    state.sessions.unshift({id:state.session.id,case_id:state.current.id,status:"completed",score,result,started_at:state.session.started_at,completed_at:new Date().toISOString()});
    state.session.status="completed";
    renderDebrief(score,missingRequired,missingRecommended);
    show("plantao-debrief");
  }

  function actionLabel(id) {
    return mergedActions().find(x=>x.id===id)?.label || id;
  }

  async function openDeathDebrief(){
    $("plantao-death-overlay").hidden=true;
    const rules=state.current?.completion_rules||{};
    const missingRequired=(rules.required_actions||[]).filter(x=>!done(x));
    const missingRecommended=(rules.recommended_actions||[]).filter(x=>!done(x));
    renderDebrief(0,missingRequired,missingRecommended);
    $("plantao-diagnosis").textContent="Óbito durante a simulação — "+state.deathReason;
    show("plantao-debrief");
  }

  function renderDebrief(score,missingRequired,missingRecommended) {
    const d=state.current.debrief || {};
    $("plantao-debrief-title").textContent=state.current.title;
    $("plantao-diagnosis").textContent=d.diagnosis || "";
    $("plantao-final-score").textContent=score;
    $("plantao-pulo").textContent=d.pulo_do_gato || "";
    $("plantao-case-explanation").innerHTML=[
      ["O que costuma ter?",d.o_que_costuma_ter||d.epidemiologia||d.explanation||d.explicacao||""],
      ["O que está acontecendo?",d.o_que_esta_acontecendo||d.quadro_clinico||d.explanation||d.explicacao||""],
      ["Como aparece no plantão?",d.como_aparece_no_plantao||d.apresentacao||state.current?.summary||""],
      ["Como faço o fechamento diagnóstico?",d.fechamento_diagnostico||d.diagnostico||d.diagnosis||""]
    ].map(x=>'<section class="plantao-understand-topic"><h3>'+esc(x[0])+'</h3><p>'+esc(x[1]||"Conteúdo ainda não cadastrado para este tópico.")+'</p></section>').join("");

    const essentialTotal=(state.current.completion_rules?.required_actions||[]).length;
    const essentialDone=essentialTotal-missingRequired.length;
    const eventCount=level=>state.clinicalEvents.filter(x=>x.level===level).length;
    const positive=eventCount("essencial")+eventCount("benefica");
    const harmful=eventCount("malefica")+eventCount("mortal");

    $("plantao-performance").innerHTML=[
      ["Tempo",fmtTime(state.elapsed)],
      ["Penalidades","−"+E.score(state.current,state).penalties+" pontos"],
      ["Hipótese",state.diagnosis?.label||"Não definida"],
      ["Destino",state.disposition?.label||"Não definido"],
      ["Ações realizadas",String(state.performed.length)],
      ["Essenciais",essentialDone+"/"+essentialTotal],
      ["Ações essenciais",String(eventCount("essencial"))],
      ["Ações benéficas",String(eventCount("benefica"))],
      ["Ações neutras",String(eventCount("neutra"))],
      ["Ações prejudiciais",String(harmful)],
      ["Erros de sequência",String(state.sequenceViolations.length)],
      ["Condutas maléficas",String(state.clinicalEvents.filter(x=>x.level==="malefica").length)],
      ["Condutas mortais",String(state.clinicalEvents.filter(x=>x.level==="mortal").length)],
      ["Desfecho",state.dead?"Óbito":"Paciente vivo"]
    ].map(([a,b])=>`<div class="plantao-performance-row"><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`).join("");

    const key=[...(d.key_actions||[]),d.scoring_note].filter(Boolean).map(text=>`<div class="plantao-review-item"><span>✓</span><span>${esc(text)}</span></div>`);
    if (missingRequired.length) key.push(...missingRequired.map(id=>`<div class="plantao-review-item"><span>!</span><span>Você não realizou: ${esc(actionLabel(id))}</span></div>`));
    if (missingRecommended.length) key.push(...missingRecommended.slice(0,4).map(id=>`<div class="plantao-review-item"><span>–</span><span>Poderia acrescentar: ${esc(actionLabel(id))}</span></div>`));
    $("plantao-key-actions").innerHTML=key.join("");

    const sequence=state.sequenceViolations.map(item=>
      '<div class="plantao-review-item plantao-sequence-item"><span>↳</span><span><strong>'+
      esc(item.blocked?"Ação antecipada bloqueada":"Ação fora de sequência")+
      ':</strong> '+esc(item.message)+(item.penalty?' (−'+esc(item.penalty)+' pts)':'')+'</span></div>'
    );
    $("plantao-sequence-errors").innerHTML=sequence.length?sequence.join(""):'<div class="plantao-review-item"><span>✓</span><span>Nenhum erro de sequência registrado.</span></div>';

    const wrongEvents=state.clinicalEvents.filter(x=>x.level==="malefica"||x.level==="mortal");
    const expectedWrong=(d.wrong_actions||[]).map(text=>`<div class="plantao-review-item"><span>•</span><span>${esc(text)}</span></div>`);
    const performedWrong=wrongEvents.map(item=>`<div class="plantao-review-item"><span>!</span><span><strong>${esc(item.action_label)}:</strong> ${esc(item.reason||"Conduta inadequada para o contexto clínico.")}</span></div>`);
    $("plantao-wrong-actions").innerHTML=[...performedWrong,...expectedWrong].join("")||'<div class="plantao-review-item"><span>✓</span><span>Nenhuma conduta errada prevista ou registrada.</span></div>';

    const danger=(d.dangerous_actions||[]).map(text=>`<div class="plantao-review-item"><span>!</span><span>${esc(text)}</span></div>`);
    $("plantao-danger-actions").innerHTML=danger.join("");

    $("plantao-sources").innerHTML=(state.current.source_refs||[]).map(src=>`<a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">${esc(src.title)}</a>`).join("");
  }

  function backToLibrary() {
    state.current=null;
    state.session=null;
    renderLibrary();
    $("plantao-action-drawer").hidden=true;
    $("plantao-action-tabs").inert=false;
    show("plantao-library");
  }

  document.addEventListener("click",async event=>{
    const start=event.target.closest("[data-start-case]");
    if (start) return startCase(start.dataset.startCase);

    const tab=event.target.closest("[data-case-category]");
    if (tab) {
      $("plantao-action-search").value="";
      openActions(tab.dataset.caseCategory);
      return;
    }

    const interventionTab=event.target.closest("[data-intervention-tab]");
    if (interventionTab) {
      state.interventionTab=interventionTab.dataset.interventionTab;
      renderActions();
      return;
    }

    const action=event.target.closest("[data-case-action]");
    if (action) return runAction(action.dataset.caseAction);
  });

  $("plantao-finish")?.addEventListener("click",()=>{if(state.disposition)finishCase();else openActions("hipoteses");});
  $("plantao-conduta-finish")?.addEventListener("click",()=>{if(state.disposition)finishCase();else feed("Defina a conduta final antes de finalizar o atendimento.","warning");});
  $("plantao-action-close")?.addEventListener("click",closeActions);
  $("plantao-action-search")?.addEventListener("input",renderActions);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("plantao-action-drawer").hidden)closeActions();});
  $("plantao-back")?.addEventListener("click",async()=>{
    if (state.session?.id) await persistSession({status:"abandoned"});
    backToLibrary();
  });
  $("plantao-all-cases")?.addEventListener("click",backToLibrary);
  $("plantao-retry")?.addEventListener("click",()=>state.current && startCase(state.current.id));
  $("plantao-death-review")?.addEventListener("click",openDeathDebrief);

  load().catch(error=>console.error("Plantão:",error));
})();