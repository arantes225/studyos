
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.110.6";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const RUBRIC = {
  scientific: 25,
  answer_key: 20,
  answer_source: 15,
  distractors: 10,
  explanations: 10,
  style: 10,
  writing: 5,
  difficulty: 5,
};

const EDITABLE_FIELDS = new Set([
  "enunciado","alternativa_a","alternativa_b","alternativa_c","alternativa_d",
  "gabarito","explicacao_a","explicacao_b","explicacao_c","explicacao_d",
  "mensagem_chave","area","tema","subtema","dificuldade",
  "fonte_instituicao","fonte_documento","fonte_ano","fonte_url",
  "answer_source_institution","answer_source_document","answer_source_year",
  "answer_source_url","answer_source_section","answer_source_note",
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

function getPublishableKey() {
  const bundle = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (bundle) {
    try {
      const parsed = JSON.parse(bundle);
      if (parsed?.default) return parsed.default;
      const first = Object.values(parsed || {}).find((value) => typeof value === "string");
      if (first) return String(first);
    } catch (_) {}
  }
  return Deno.env.get("SUPABASE_ANON_KEY") || "";
}

function pad3(n: number) {
  return String(n).padStart(3, "0");
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function padQ(n: number) {
  return String(n).padStart(3, "0");
}

function issueOrNull(value: unknown) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || ["none","null","n/a","na","sem problema","nenhum"].includes(text.toLowerCase())) return null;
  return text;
}

function styleEvidenceVerified(profile: any) {
  const c = profile?.prompt_calibration || {};
  return String(c?.status || "").toUpperCase() === "CALIBRATED_FROZEN"
    || String(c?.identity_status || "").toUpperCase() === "FROZEN"
    || (
      String(c?.decision || "").toUpperCase() === "PROMPT_APPROVED"
      && Number(profile?.final_prompt_score || c?.final_prompt_score || 0) >= 84
    );
}

function canonicalUrl(value: string) {
  try {
    const u = new URL(value);
    u.hash = "";
    u.search = "";
    let path = u.pathname.replace(/\/+$/, "");
    if (!path) path = "/";
    return (u.hostname.replace(/^www\./, "") + path).toLowerCase();
  } catch (_) {
    return "";
  }
}

function collectProviderEvidence(response: any) {
  const results: Array<{url:string,title:string,snippet:string,type:string}> = [];
  for (const item of Array.isArray(response?.output) ? response.output : []) {
    if (!item || typeof item !== "object") continue;
    if (item.type === "search_results") {
      for (const r of Array.isArray(item.results) ? item.results : []) {
        if (typeof r?.url === "string" && /^https?:\/\//i.test(r.url)) {
          results.push({
            url: r.url,
            title: String(r.title || ""),
            snippet: String(r.snippet || ""),
            type: "search_result",
          });
        }
      }
    }
    if (item.type === "fetch_url_results") {
      const walk = (node: any) => {
        if (!node) return;
        if (Array.isArray(node)) return node.forEach(walk);
        if (typeof node !== "object") return;
        if (typeof node.url === "string" && /^https?:\/\//i.test(node.url)) {
          results.push({
            url: node.url,
            title: String(node.title || ""),
            snippet: String(node.snippet || ""),
            type: "fetch_url",
          });
        }
        for (const [key, val] of Object.entries(node)) {
          if (key !== "url") walk(val);
        }
      };
      walk(item);
    }
  }
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = canonicalUrl(r.url) || r.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractOutputText(response: any) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }
  const parts: string[] = [];
  for (const item of Array.isArray(response?.output) ? response.output : []) {
    if (item?.type !== "message") continue;
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (part?.type === "output_text" && typeof part?.text === "string") {
        parts.push(part.text);
      } else if (typeof part?.text === "string") {
        parts.push(part.text);
      }
    }
  }
  return parts.join("\n").trim();
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function urlReachable(url: string) {
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    let res = await fetchWithTimeout(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": "LURIA-Source-Verifier/1.0" },
    }, 8000);
    if (res.status === 405 || res.status === 501) {
      res = await fetchWithTimeout(url, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent": "LURIA-Source-Verifier/1.0",
          "Range": "bytes=0-4095",
        },
      }, 10000);
    }
    return res.status >= 200 && res.status < 500 && res.status !== 404 && res.status !== 410;
  } catch (_) {
    return false;
  }
}

async function callPerplexity(args: {
  apiKey: string;
  prompt: string;
  instructions: string;
  schemaName: string;
  schema: Record<string, unknown>;
  useWeb: boolean;
}) {
  const body: Record<string, unknown> = {
    preset: "pro-search",
    input: args.prompt,
    instructions: args.instructions,
    max_output_tokens: args.useWeb ? 9000 : 1800,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: args.schemaName,
        strict: true,
        schema: args.schema,
      },
    },
  };
  if (args.useWeb) {
    body.tools = [
      { type: "web_search" },
      { type: "fetch_url" },
    ];
    body.max_steps = 8;
  }

  const res = await fetchWithTimeout("https://api.perplexity.ai/v1/agent", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + args.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }, 135000);

  const text = await res.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    throw new Error("Perplexity retornou resposta não JSON (HTTP " + res.status + ").");
  }

  if (!res.ok) {
    throw new Error("Perplexity HTTP " + res.status + ": " + String(parsed?.error?.message || parsed?.error || "falha"));
  }
  if (parsed?.status && parsed.status !== "completed") {
    throw new Error("Perplexity status=" + parsed.status + ": " + String(parsed?.error?.message || parsed?.error || "execução incompleta"));
  }

  const outputText = extractOutputText(parsed);
  if (!outputText) throw new Error("Perplexity não retornou output_text estruturado.");

  let value: any;
  try {
    value = JSON.parse(outputText);
  } catch (_) {
    throw new Error("Perplexity retornou JSON estruturado inválido.");
  }

  return {
    value,
    evidence: collectProviderEvidence(parsed),
    response_id: String(parsed?.id || ""),
    model: String(parsed?.model || ""),
    usage: parsed?.usage || null,
  };
}

const BLIND_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["independent_answer","ambiguity","single_best_answer","confidence","reason"],
  properties: {
    independent_answer: { type: "string", enum: ["A","B","C","D","UNRESOLVED"] },
    ambiguity: { type: "boolean" },
    single_best_answer: { type: "boolean" },
    confidence: { type: "string", enum: ["low","medium","high"] },
    reason: { type: "string", minLength: 12 },
  },
};

const AUDIT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "status","confidence","ambiguity","single_best_answer","hard_fail","hard_fail_reasons",
    "quality_score","component_scores",
    "source_verification_status","style_evidence_status",
    "surface_guess_without_vignette","surface_guess_confidence","lexical_asymmetry",
    "best_distractor","best_distractor_rationale","counterfactual_change",
    "functional_killer_1_option","functional_killer_1",
    "functional_killer_2_option","functional_killer_2",
    "vignette_dependency","distractor_quality","alternative_granularity","difficulty_alignment",
    "explanation_checks","message_key_check","source_checks",
    "scientific_issue","source_issue","answer_source_issue","explanation_issue",
    "distractor_issue","style_issue","wording_issue","difficulty_issue","suggested_correction",
    "proposed_change","points_lost"
  ],
  properties: {
    status: { type: "string", enum: ["approved","needs_revision","rejected"] },
    confidence: { type: "string", enum: ["low","medium","high"] },
    ambiguity: { type: "boolean" },
    single_best_answer: { type: "boolean" },
    hard_fail: { type: "boolean" },
    hard_fail_reasons: { type: "array", items: { type: "string" } },
    quality_score: { type: "number", minimum: 0, maximum: 100 },
    component_scores: {
      type: "object",
      additionalProperties: false,
      required: ["scientific","answer_key","answer_source","distractors","explanations","style","writing","difficulty"],
      properties: {
        scientific: { type: "number", minimum: 0, maximum: 25 },
        answer_key: { type: "number", minimum: 0, maximum: 20 },
        answer_source: { type: "number", minimum: 0, maximum: 15 },
        distractors: { type: "number", minimum: 0, maximum: 10 },
        explanations: { type: "number", minimum: 0, maximum: 10 },
        style: { type: "number", minimum: 0, maximum: 10 },
        writing: { type: "number", minimum: 0, maximum: 5 },
        difficulty: { type: "number", minimum: 0, maximum: 5 },
      },
    },
    source_verification_status: {
      type: "string",
      enum: ["VERIFIED","SOURCE_VERIFICATION_PENDING","SOURCE_VERIFICATION_FAILED"],
    },
    style_evidence_status: {
      type: "string",
      enum: ["VERIFIED","NEEDS_MORE_PRIMARY_STYLE_DATA"],
    },
    surface_guess_without_vignette: { type: "string", enum: ["A","B","C","D","UNRESOLVED"] },
    surface_guess_confidence: { type: "string", enum: ["low","medium","high"] },
    lexical_asymmetry: { type: "string", enum: ["PASS","FAIL"] },
    best_distractor: { type: "string", enum: ["A","B","C","D"] },
    best_distractor_rationale: { type: "string", minLength: 8 },
    counterfactual_change: { type: "string", minLength: 8 },
    functional_killer_1_option: { type: "string", enum: ["A","B","C","D"] },
    functional_killer_1: { type: "string", minLength: 8 },
    functional_killer_2_option: { type: "string", enum: ["A","B","C","D"] },
    functional_killer_2: { type: "string", minLength: 8 },
    vignette_dependency: { type: "string", enum: ["PASS","FAIL"] },
    distractor_quality: { type: "string", enum: ["WEAK","FAIR","GOOD","EXCELLENT"] },
    alternative_granularity: { type: "string", enum: ["PASS","FAIL"] },
    difficulty_alignment: { type: "string", enum: ["PASS","FAIL"] },
    explanation_checks: {
      type: "object",
      additionalProperties: false,
      required: ["A","B","C","D"],
      properties: {
        A: { type: "object", additionalProperties: false, required: ["status","reason"], properties: { status:{type:"string",enum:["PASS","FAIL"]}, reason:{type:"string",minLength:4} } },
        B: { type: "object", additionalProperties: false, required: ["status","reason"], properties: { status:{type:"string",enum:["PASS","FAIL"]}, reason:{type:"string",minLength:4} } },
        C: { type: "object", additionalProperties: false, required: ["status","reason"], properties: { status:{type:"string",enum:["PASS","FAIL"]}, reason:{type:"string",minLength:4} } },
        D: { type: "object", additionalProperties: false, required: ["status","reason"], properties: { status:{type:"string",enum:["PASS","FAIL"]}, reason:{type:"string",minLength:4} } },
      },
    },
    message_key_check: {
      type: "object",
      additionalProperties: false,
      required: ["status","reason","decisive_feature"],
      properties: {
        status: { type:"string", enum:["PASS","FAIL"] },
        reason: { type:"string", minLength:4 },
        decisive_feature: { type:"string", minLength:4 },
      },
    },
    source_checks: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "institution","document","year","url","section","verification_status",
          "url_reachable","title_match","year_match","section_found","supports_answer","note"
        ],
        properties: {
          institution:{type:"string",minLength:2},
          document:{type:"string",minLength:2},
          year:{type:"string",minLength:4},
          url:{type:"string",minLength:8},
          section:{type:"string"},
          verification_status:{type:"string",enum:["VERIFIED","PENDING","FAILED"]},
          url_reachable:{type:"boolean"},
          title_match:{type:"boolean"},
          year_match:{type:"boolean"},
          section_found:{type:"boolean"},
          supports_answer:{type:"boolean"},
          note:{type:"string"},
        },
      },
    },
    scientific_issue:{type:"string"},
    source_issue:{type:"string"},
    answer_source_issue:{type:"string"},
    explanation_issue:{type:"string"},
    distractor_issue:{type:"string"},
    style_issue:{type:"string"},
    wording_issue:{type:"string"},
    difficulty_issue:{type:"string"},
    suggested_correction:{type:"string"},
    proposed_change:{
      type:"object",
      additionalProperties:false,
      required:["change_required","replacements","reason"],
      properties:{
        change_required:{type:"boolean"},
        replacements:{
          type:"array",
          maxItems:20,
          items:{
            type:"object",
            additionalProperties:false,
            required:["field","replacement"],
            properties:{
              field:{type:"string"},
              replacement:{type:"string"},
            },
          },
        },
        reason:{type:"string"},
      },
    },
    points_lost:{
      type:"array",
      items:{
        type:"object",
        additionalProperties:false,
        required:["component","points","reason"],
        properties:{
          component:{type:"string"},
          points:{type:"number",minimum:0,maximum:25},
          reason:{type:"string"},
        },
      },
    },
  },
};

function questionForPrompt(q: any) {
  return {
    question_id: q.question_id,
    version: q.version,
    block_sequence_no: q.block_sequence_no,
    exam_style: q.exam_style,
    area: q.area,
    tema: q.tema,
    subtema: q.subtema,
    dificuldade: q.dificuldade,
    enunciado: q.enunciado,
    alternativa_a: q.alternativa_a,
    alternativa_b: q.alternativa_b,
    alternativa_c: q.alternativa_c,
    alternativa_d: q.alternativa_d,
    gabarito: q.gabarito,
    explicacao_a: q.explicacao_a,
    explicacao_b: q.explicacao_b,
    explicacao_c: q.explicacao_c,
    explicacao_d: q.explicacao_d,
    mensagem_chave: q.mensagem_chave,
    fonte_instituicao: q.fonte_instituicao,
    fonte_documento: q.fonte_documento,
    fonte_ano: q.fonte_ano,
    fonte_url: q.fonte_url,
    answer_source_institution: q.answer_source_institution,
    answer_source_document: q.answer_source_document,
    answer_source_year: q.answer_source_year,
    answer_source_url: q.answer_source_url,
    answer_source_section: q.answer_source_section,
    answer_source_note: q.answer_source_note,
  };
}

function blindPrompt(q: any) {
  return [
    "Resolva esta questão de forma CEGA e independente.",
    "Você NÃO recebeu gabarito, explicações nem fonte da resposta.",
    "Não tente inferir a resposta por padrão editorial; resolva clinicamente.",
    "Se houver mais de uma resposta defensável ou dados insuficientes, use independent_answer=UNRESOLVED.",
    "Retorne apenas o JSON exigido pelo schema.",
    "",
    "ENUNCIADO:",
    String(q.enunciado || ""),
    "",
    "A) " + String(q.alternativa_a || ""),
    "B) " + String(q.alternativa_b || ""),
    "C) " + String(q.alternativa_c || ""),
    "D) " + String(q.alternativa_d || ""),
  ].join("\n");
}

function auditPrompt(q: any, blind: any, profile: any) {
  const profileSnapshot = {
    exam_style: profile?.exam_style || q.exam_style,
    final_prompt_score: profile?.final_prompt_score ?? null,
    prompt_calibration: profile?.prompt_calibration || {},
    full_generation_brief: profile?.full_generation_brief || "",
    generation_instructions: profile?.generation_instructions || "",
    recommended_generation_rules: profile?.recommended_generation_rules || "",
    what_to_avoid: profile?.what_to_avoid || "",
    scientific_source_strategy: profile?.scientific_source_strategy || "",
  };
  return [
    "CONTRATO LURIA 3.4 — AUDITORIA CIENTÍFICA/EDITORIAL INDEPENDENTE.",
    "A resposta cega abaixo é IMUTÁVEL. Não a altere para coincidir com o gabarito.",
    "Use pesquisa web e leitura/fetch das fontes. Fonte apenas citada pela questão NÃO conta como verificada.",
    "Só marque source_verification_status=VERIFIED quando localizar fonte autoritativa/primária, confirmar documento/ano/seção e verificar que a recomendação sustenta exatamente a decisão/gabarito.",
    "Se não conseguir comprovar, marque SOURCE_VERIFICATION_PENDING ou SOURCE_VERIFICATION_FAILED e o item NÃO pode ser approved.",
    "Faça o teste cego das alternativas: ignore a vinheta e tente prever a chave por comando+opções; registre surface_guess e confiança.",
    "Avalie assimetria lexical/estrutural, dependência real da vinheta, single-best-answer, dificuldade e plausibilidade dos distratores.",
    "Escolha o melhor distrator e depois dois distratores distintos para functional_killer_1/2. Cada killer deve completar: 'esta alternativa seria defensável, exceto porque a vinheta informa ___'.",
    "Valide individualmente as explicações A-D.",
    "Valide mensagem_chave como Pulo do Gato: frase específica e discriminativa suficiente para levar à resposta correta, não resumo genérico.",
    "Ao propor correções, use proposed_change.replacements apenas nos campos realmente necessários. Não aplique a correção nesta etapa.",
    "Rubrica máxima: scientific 25, answer_key 20, answer_source 15, distractors 10, explanations 10, style 10, writing 5, difficulty 5. quality_score deve ser a soma.",
    "Status approved exige >=97, style>=9.7, zero hard fail, zero ambiguidade, single best answer, resposta cega concordante, fontes VERIFIED, distratores GOOD/EXCELLENT e todos os gates de aprovação.",
    "Se a resposta cega divergir do gabarito, não presuma que o resolvedor errou: rejeite/suspenda para revisão científica.",
    "Retorne somente o JSON do schema.",
    "",
    "RESPOSTA CEGA PERSISTIDA:",
    JSON.stringify(blind || {}),
    "",
    "PERFIL EDITORIAL CANÔNICO:",
    JSON.stringify(profileSnapshot),
    "",
    "QUESTÃO COMPLETA:",
    JSON.stringify(questionForPrompt(q)),
  ].join("\n");
}

function normalizeReplacements(modelChange: any) {
  const exact: Record<string,string> = {};
  for (const item of Array.isArray(modelChange?.replacements) ? modelChange.replacements : []) {
    const field = String(item?.field || "").trim();
    const replacement = String(item?.replacement ?? "");
    if (EDITABLE_FIELDS.has(field)) exact[field] = replacement;
  }
  return {
    change_required: Boolean(modelChange?.change_required) && Object.keys(exact).length > 0,
    exact_replacement: exact,
    reason: String(modelChange?.reason || ""),
  };
}

async function normalizeAudit(model: any, q: any, blind: any, profile: any, evidence: any[]) {
  const blindAnswerRaw = blind?.independent_answer ?? null;
  const blindAnswer = ["A","B","C","D"].includes(String(blindAnswerRaw)) ? String(blindAnswerRaw) : null;
  const originalAnswer = String(q.gabarito || "");
  const answerAgreement = blindAnswer == null ? "unresolved" : (blindAnswer === originalAnswer ? "agree" : "disagree");

  const styleVerified = styleEvidenceVerified(profile);
  const componentScores: Record<string,number|null> = {};
  let completeNumeric = true;
  let total = 0;
  for (const [key, cap] of Object.entries(RUBRIC)) {
    if (key === "style" && !styleVerified) {
      componentScores[key] = null;
      completeNumeric = false;
      continue;
    }
    const raw = Number(model?.component_scores?.[key]);
    const value = Number.isFinite(raw) ? Math.max(0, Math.min(Number(cap), raw)) : 0;
    componentScores[key] = value;
    total += value;
  }

  const evidenceKeys = new Set(evidence.map((e) => canonicalUrl(String(e.url || ""))).filter(Boolean));
  const sourceChecks = [];
  for (const raw of Array.isArray(model?.source_checks) ? model.source_checks.slice(0,5) : []) {
    const source = { ...raw };
    const url = String(source.url || "");
    const reachable = await urlReachable(url);
    const providerMatch = evidenceKeys.has(canonicalUrl(url));
    source.url_reachable = reachable;
    source.provider_evidence_match = providerMatch;
    if (
      source.verification_status === "VERIFIED"
      && (
        !reachable || !providerMatch
        || source.title_match !== true || source.year_match !== true
        || source.section_found !== true || source.supports_answer !== true
        || !String(source.section || "").trim()
      )
    ) {
      source.verification_status = "PENDING";
      source.note = [String(source.note || ""), "Verificação automática rebaixou VERIFIED: falta comprovação integral por busca/fetch/reachability."].filter(Boolean).join(" ");
    }
    sourceChecks.push(source);
  }

  const verifiedChecks = sourceChecks.filter((s:any) =>
    s.verification_status === "VERIFIED"
    && s.url_reachable === true
    && s.provider_evidence_match === true
    && s.title_match === true
    && s.year_match === true
    && s.section_found === true
    && s.supports_answer === true
  );

  let sourceStatus = String(model?.source_verification_status || "SOURCE_VERIFICATION_PENDING");
  if (!verifiedChecks.length) {
    sourceStatus = sourceChecks.some((s:any) => s.verification_status === "FAILED")
      ? "SOURCE_VERIFICATION_FAILED"
      : "SOURCE_VERIFICATION_PENDING";
  } else {
    sourceStatus = "VERIFIED";
  }

  const verifiedSources = verifiedChecks.map((s:any) => ({
    institution: String(s.institution || ""),
    document: String(s.document || ""),
    year: String(s.year || ""),
    url: String(s.url || ""),
    section: String(s.section || ""),
    note: String(s.note || ""),
  }));

  const surfaceGuess = ["A","B","C","D"].includes(String(model?.surface_guess_without_vignette))
    ? String(model.surface_guess_without_vignette)
    : null;

  let status = ["approved","needs_revision","rejected"].includes(String(model?.status))
    ? String(model.status)
    : "needs_revision";

  let hardFail = Boolean(model?.hard_fail);
  const hardReasons = Array.isArray(model?.hard_fail_reasons)
    ? model.hard_fail_reasons.map((x:any) => String(x)).filter(Boolean)
    : [];

  if (answerAgreement !== "agree") {
    status = "rejected";
    hardFail = true;
    if (!hardReasons.includes("independent_answer_disagreement")) hardReasons.push("independent_answer_disagreement");
  }
  if (sourceStatus !== "VERIFIED" && status === "approved") status = "needs_revision";
  if (!styleVerified && status === "approved") status = "needs_revision";

  const exp = model?.explanation_checks || {};
  const explanationFailed = ["A","B","C","D"].some((k) => exp?.[k]?.status !== "PASS");
  const messageFailed = model?.message_key_check?.status !== "PASS";
  if ((explanationFailed || messageFailed) && status === "approved") status = "needs_revision";

  const qualityScore = completeNumeric ? Number(total.toFixed(2)) : null;

  if (
    status === "approved"
    && (
      qualityScore == null || qualityScore < 97
      || Number(componentScores.style || 0) < 9.7
      || hardFail || Boolean(model?.ambiguity) || model?.single_best_answer !== true
      || sourceStatus !== "VERIFIED"
      || !["GOOD","EXCELLENT"].includes(String(model?.distractor_quality))
      || model?.alternative_granularity !== "PASS"
      || model?.difficulty_alignment !== "PASS"
    )
  ) {
    status = "needs_revision";
  }

  const normalized = {
    question_id: String(q.question_id),
    item_version: Number(q.version),
    original_answer: originalAnswer,
    independent_answer: blindAnswer,
    answer_agreement: answerAgreement,
    status,
    confidence: ["low","medium","high"].includes(String(model?.confidence)) ? model.confidence : "medium",
    ambiguity: Boolean(model?.ambiguity),
    single_best_answer: Boolean(model?.single_best_answer),
    hard_fail: hardFail,
    hard_fail_reasons: hardReasons,
    quality_score: qualityScore,
    component_scores: componentScores,
    source_verification_status: sourceStatus,
    style_evidence_status: styleVerified ? "VERIFIED" : "NEEDS_MORE_PRIMARY_STYLE_DATA",
    verified_sources: verifiedSources,
    source_checks: sourceChecks,
    surface_guess_without_vignette: surfaceGuess,
    surface_guess_confidence: ["low","medium","high"].includes(String(model?.surface_guess_confidence))
      ? model.surface_guess_confidence : "medium",
    lexical_asymmetry: model?.lexical_asymmetry === "PASS" ? "PASS" : "FAIL",
    best_distractor: String(model?.best_distractor || ""),
    best_distractor_rationale: String(model?.best_distractor_rationale || ""),
    counterfactual_change: String(model?.counterfactual_change || ""),
    functional_killer_1_option: String(model?.functional_killer_1_option || ""),
    functional_killer_1: String(model?.functional_killer_1 || ""),
    functional_killer_2_option: String(model?.functional_killer_2_option || ""),
    functional_killer_2: String(model?.functional_killer_2 || ""),
    vignette_dependency: model?.vignette_dependency === "PASS" ? "PASS" : "FAIL",
    distractor_quality: ["WEAK","FAIR","GOOD","EXCELLENT"].includes(String(model?.distractor_quality))
      ? model.distractor_quality : "WEAK",
    alternative_granularity: model?.alternative_granularity === "PASS" ? "PASS" : "FAIL",
    difficulty_alignment: model?.difficulty_alignment === "PASS" ? "PASS" : "FAIL",
    explanation_checks: exp,
    message_key_check: model?.message_key_check || { status:"FAIL", reason:"Ausente", decisive_feature:"Ausente" },
    scientific_issue: issueOrNull(model?.scientific_issue),
    source_issue: issueOrNull(model?.source_issue),
    answer_source_issue: issueOrNull(model?.answer_source_issue),
    explanation_issue: issueOrNull(model?.explanation_issue),
    distractor_issue: issueOrNull(model?.distractor_issue),
    style_issue: issueOrNull(model?.style_issue),
    wording_issue: issueOrNull(model?.wording_issue),
    difficulty_issue: issueOrNull(model?.difficulty_issue),
    suggested_correction: issueOrNull(model?.suggested_correction),
    proposed_change: normalizeReplacements(model?.proposed_change),
    points_lost: Array.isArray(model?.points_lost) ? model.points_lost : [],
    provider_evidence: {
      search_result_count: evidence.length,
      results: evidence.slice(0,30),
    },
  };
  return normalized;
}

async function coverage(sb:any, batch:number, block:number, stage:string, start:number, end:number) {
  const { data, error } = await sb.rpc("admin_question_factory_review_coverage", {
    p_batch_number: batch,
    p_block_number: block,
    p_stage: stage,
    p_reviewer: "Perplexity",
    p_start: start,
    p_end: end,
  });
  if (error) throw new Error("Falha ao reler cobertura: " + error.message);
  return data;
}

async function recordMetrics(sb:any, args:{
  examStyle:string,batch:number,block:number,stage:string,start:number,end:number,coverage:any
}) {
  const blockCode = "L" + pad3(args.batch) + "-B" + pad2(args.block);
  const runLabel = "auto-" + blockCode + "-" + args.stage + "-Q" + padQ(args.start) + "-Q" + padQ(args.end);
  const c = args.coverage || {};
  const metrics = {
    event_key: "qf:" + String(args.examStyle || "unknown").toLowerCase() + ":" + args.batch + ":" + args.block + ":" + args.stage + ":" + runLabel,
    exam_style: args.examStyle || "ENAMED",
    batch_number: args.batch,
    block_number: args.block,
    stage: args.stage,
    provider: "Perplexity",
    run_label: runLabel,
    total_count: Number(c.persisted || 0),
    approved_count: Number(c.approved || 0),
    needs_revision_count: Number(c.needs_revision || 0),
    rejected_count: Number(c.rejected || 0),
    hard_reject_count: Number(c.hard_rejects || 0),
    agreement_count: Number(c.agreement_count || 0),
    score: c.average_quality_score == null ? null : Number(c.average_quality_score),
    status: c.complete ? "completed" : "in_progress",
    metrics: {
      expected_count: Number(c?.range?.expected || (args.end-args.start+1)),
      persisted_count: Number(c.persisted || 0),
      pending_count: Array.isArray(c.pending_ids) ? c.pending_ids.length : 0,
      source_pending_count: Number(c.source_pending_count || 0),
      range_start: args.start,
      range_end: args.end,
      coverage_complete: Boolean(c.complete),
    },
    notes: c.complete
      ? "Faixa auditada e persistida integralmente; cobertura confirmada por item_version atual."
      : "Faixa em processamento; cobertura calculada por question_id distinto e item_version atual.",
  };
  const { data, error } = await sb.rpc("admin_import_question_factory_stage_metrics", {
    p_payload: { stage_metrics: metrics },
  });
  return {
    stage_metrics: metrics,
    supabase_write: error
      ? { attempted:true, stored:false, error:error.message }
      : { attempted:true, stored:data?.stored === true, event_key:data?.event_key || null },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok:false, error:"METHOD_NOT_ALLOWED" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const publishableKey = getPublishableKey();
    const authHeader = req.headers.get("Authorization") || "";
    if (!supabaseUrl || !publishableKey) {
      return json({ ok:false, error:"SUPABASE_RUNTIME_CONFIG_MISSING" }, 500);
    }
    if (!authHeader) return json({ ok:false, error:"AUTH_REQUIRED" }, 401);

    const apiKey = Deno.env.get("PERPLEXITY_API_KEY");
    if (!apiKey) {
      return json({
        ok:false,
        error:"PERPLEXITY_API_KEY_MISSING",
        message:"Configure PERPLEXITY_API_KEY nos Secrets das Edge Functions; não envie a chave ao cliente.",
      }, 503);
    }

    const body = await req.json().catch(() => ({}));
    const batch = Number(body?.batch_number);
    const block = Number(body?.block_number);
    const start = Number(body?.start ?? 1);
    const end = Number(body?.end ?? Math.min(200,start+49));
    const reviewStage = String(body?.review_stage || "perplexity_initial");

    if (!Number.isInteger(batch) || batch < 1 || !Number.isInteger(block) || block < 1) {
      return json({ ok:false,error:"INVALID_BATCH_OR_BLOCK" }, 400);
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > 200) {
      return json({ ok:false,error:"INVALID_RANGE" }, 400);
    }
    if (!["perplexity_initial","perplexity_reaudit"].includes(reviewStage)) {
      return json({ ok:false,error:"INVALID_REVIEW_STAGE" }, 400);
    }

    const sb = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
    });

    const { data: item, error: itemError } = await sb.rpc("admin_question_factory_next_perplexity_item", {
      p_batch_number: batch,
      p_block_number: block,
      p_start: start,
      p_end: end,
      p_review_stage: reviewStage,
    });

    if (itemError) return json({ ok:false,error:"NEXT_ITEM_FAILED",message:itemError.message }, 403);

    if (!item) {
      const c = await coverage(sb,batch,block,reviewStage,start,end);
      const metrics = await recordMetrics(sb,{
        examStyle:"ENAMED",batch,block,stage:reviewStage,start,end,coverage:c,
      });
      return json({ ok:true, phase:"range_complete", coverage:c, ...metrics });
    }

    const q = item.question || {};
    const seq = Number(item.block_sequence_no);
    const examStyle = String(q.exam_style || item?.style_profile?.exam_style || "ENAMED");
    const existingBlind = item.blind_resolution;
    const hasBlind = existingBlind && typeof existingBlind === "object"
      && Object.prototype.hasOwnProperty.call(existingBlind,"independent_answer");

    if (!hasBlind) {
      const p = await callPerplexity({
        apiKey,
        prompt: blindPrompt(q),
        instructions: "Você é um médico revisor independente. Resolva apenas a questão recebida, sem qualquer gabarito oculto. Produza JSON válido conforme o schema.",
        schemaName: "LuriaBlindResolution",
        schema: BLIND_SCHEMA,
        useWeb: false,
      });

      const answer = ["A","B","C","D"].includes(String(p.value?.independent_answer))
        ? String(p.value.independent_answer)
        : null;

      const blindReview = {
        question_id: String(item.question_id),
        item_version: Number(item.item_version),
        independent_answer: answer,
        ambiguity: Boolean(p.value?.ambiguity),
        single_best_answer: Boolean(p.value?.single_best_answer),
        confidence: ["low","medium","high"].includes(String(p.value?.confidence)) ? p.value.confidence : "medium",
        reason: String(p.value?.reason || "").trim(),
        provider_response_id: p.response_id,
        provider_model: p.model,
      };

      const blindPayload = {
        schema_version:"2.0",
        batch_number:batch,
        block_number:block,
        review_stage:"blind_resolution",
        reviewer:"Perplexity",
        reviews:[blindReview],
      };

      const { data: stored, error: storeError } = await sb.rpc("admin_import_question_factory_stage", {
        p_payload: blindPayload,
      });
      if (storeError) {
        return json({
          ok:false,phase:"blind_resolution",error:"BLIND_PERSIST_FAILED",
          question_id:item.question_id,item_version:item.item_version,sequence_no:seq,
          message:storeError.message,
        }, 422);
      }

      const blindCoverage = await coverage(sb,batch,block,"blind_resolution",start,end);
      return json({
        ok:true,
        phase:"blind_resolution_persisted",
        question_id:item.question_id,
        item_version:item.item_version,
        sequence_no:seq,
        persisted:stored?.result || stored,
        blind_coverage:blindCoverage,
      });
    }

    const p = await callPerplexity({
      apiKey,
      prompt: auditPrompt(q, existingBlind, item.style_profile || {}),
      instructions: "Você é um auditor médico adversarial e editorial. Pesquise fontes autoritativas, abra/fetch URLs relevantes e só declare VERIFIED com comprovação. Produza exatamente um parecer completo em JSON conforme o schema.",
      schemaName: "LuriaPerplexityAudit",
      schema: AUDIT_SCHEMA,
      useWeb: true,
    });

    const review = await normalizeAudit(p.value,q,existingBlind,item.style_profile || {},p.evidence);
    review.provider_response_id = p.response_id;
    review.provider_model = p.model;
    review.provider_usage = p.usage;

    const payload = {
      schema_version:"2.0",
      batch_number:batch,
      block_number:block,
      review_stage:reviewStage,
      reviewer:"Perplexity",
      reviews:[review],
    };

    const { data: stored, error: storeError } = await sb.rpc("admin_import_question_factory_stage", {
      p_payload: payload,
    });

    if (storeError) {
      return json({
        ok:false,phase:"audit",error:"AUDIT_PERSIST_FAILED",
        question_id:item.question_id,item_version:item.item_version,sequence_no:seq,
        message:storeError.message,
        review_status:review.status,
      }, 422);
    }

    const c = await coverage(sb,batch,block,reviewStage,start,end);
    const metrics = await recordMetrics(sb,{
      examStyle,batch,block,stage:reviewStage,start,end,coverage:c,
    });

    return json({
      ok:true,
      phase:"audit_persisted",
      question_id:item.question_id,
      item_version:item.item_version,
      sequence_no:seq,
      review_status:review.status,
      source_verification_status:review.source_verification_status,
      persisted:stored?.result || stored,
      coverage:c,
      ...metrics,
    });
  } catch (error) {
    return json({
      ok:false,
      error:"UNHANDLED",
      message:error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
