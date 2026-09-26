(() => {
  const sb = window.supabaseClient;
  const points = [100, 80, 60, 40, 20];
  let challenge = null;
  let progress = null;
  let user = null;

  const els = {
    loading: document.getElementById("daily-loading"),
    unavailable: document.getElementById("daily-unavailable"),
    card: document.getElementById("daily-card"),
    area: document.getElementById("daily-area"),
    number: document.getElementById("daily-number"),
    date: document.getElementById("daily-date"),
    progressLabel: document.getElementById("daily-progress-label"),
    pointsLive: document.getElementById("daily-points-live"),
    dots: [...document.querySelectorAll("#daily-progress-dots span")],
    clues: document.getElementById("daily-clues"),
    feedback: document.getElementById("daily-feedback"),
    form: document.getElementById("daily-form"),
    answer: document.getElementById("daily-answer"),
    submit: document.getElementById("daily-submit"),
    result: document.getElementById("daily-result"),
    resultIcon: document.getElementById("daily-result-icon"),
    resultKicker: document.getElementById("daily-result-kicker"),
    diagnosis: document.getElementById("daily-diagnosis"),
    explanation: document.getElementById("daily-explanation"),
    finalScore: document.getElementById("daily-final-score"),
    finalAttempts: document.getElementById("daily-final-attempts")
  };

  function saoPauloDateISO() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    const value = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return value.year + "-" + value.month + "-" + value.day;
  }

  function formatDate(iso) {
    const [y,m,d] = iso.split("-").map(Number);
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "long", day: "2-digit", month: "long"
    }).format(new Date(y, m - 1, d));
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[c]));
  }

  function showFeedback(message, type) {
    els.feedback.textContent = message;
    els.feedback.className = "daily-feedback " + type;
    els.feedback.hidden = false;
  }

  function hideFeedback() {
    els.feedback.hidden = true;
    els.feedback.textContent = "";
  }

  function clueCount() {
    return Math.max(1, Math.min(5, Number(progress?.revealed_clues || 1)));
  }

  function renderClues() {
    const visible = clueCount();
    els.clues.innerHTML = Array.from({length: visible}, (_, i) => {
      const n = i + 1;
      const text = challenge["clue_" + n] || "";
      return '<div class="daily-clue ' + (n === visible ? "is-current" : "") + '">' +
        '<span class="daily-clue-number">' + n + '</span>' +
        '<p>' + esc(text) + '</p></div>';
    }).join("");

    els.dots.forEach((dot, i) => {
      dot.classList.toggle("is-visible", i < visible);
      dot.classList.toggle("is-current", i === visible - 1);
    });

    els.progressLabel.textContent = "Pista " + visible + " de 5";
    const nextValue = points[Math.min(4, Number(progress?.attempts || 0))];
    els.pointsLive.textContent = progress?.status === "in_progress" || !progress
      ? "Vale " + nextValue + " pontos"
      : "Desafio concluído";
  }

  function renderHeader() {
    els.area.textContent = challenge.area || "Desafio clínico";
    els.number.textContent = "#" + String(challenge.id).padStart(3, "0");
    els.date.textContent = formatDate(challenge.challenge_date);
  }

  async function showResult(result) {
    if (!result) return;
    els.form.hidden = true;
    els.result.hidden = false;
    els.resultIcon.textContent = result.status === "won" ? "✓" : "×";
    els.resultKicker.textContent = result.status === "won" ? "DIAGNÓSTICO CORRETO" : "FIM DO DESAFIO";
    els.diagnosis.textContent = result.diagnosis || "";
    els.explanation.textContent = result.explanation || "";
    els.finalScore.textContent = String(result.score || 0);
    els.finalAttempts.textContent = String(result.attempts || 0);
    els.pointsLive.textContent = "Desafio concluído";
    els.dots.forEach(dot => dot.classList.add("is-visible"));
    if (result.status === "won") showFeedback("Acertou! Desafio concluído.", "ok");
    else showFeedback("As cinco pistas foram usadas. Confira o diagnóstico abaixo.", "error");
  }

  async function loadTerminalResult() {
    const { data, error } = await sb.rpc("get_daily_challenge_result", {
      p_challenge_id: challenge.id
    });
    if (error) throw error;
    if (data) await showResult(data);
  }

  async function load() {
    try {
      if (!sb) throw new Error("Cliente Supabase não inicializado.");
      const { data: authData, error: authError } = await sb.auth.getUser();
      if (authError || !authData?.user) {
        els.loading.hidden = true;
        els.unavailable.hidden = false;
        const title = els.unavailable.querySelector("strong");
        const p = els.unavailable.querySelector("p");
        if (title) title.textContent = "Sessão não encontrada";
        if (p) p.textContent = "Entre novamente para abrir o Desafio Diário.";
        return;
      }
      user = authData.user;

      const today = saoPauloDateISO();
      const { data: challengeData, error: challengeError } = await sb
        .from("daily_challenges")
        .select("id,challenge_date,area,clue_1,clue_2,clue_3,clue_4,clue_5,active")
        .eq("challenge_date", today)
        .eq("active", true)
        .maybeSingle();

      if (challengeError) throw challengeError;

      els.loading.hidden = true;
      if (!challengeData) {
        els.unavailable.hidden = false;
        return;
      }

      challenge = challengeData;

      const { data: progressData, error: progressError } = await sb
        .from("daily_challenge_progress")
        .select("attempts,revealed_clues,score,status,answers")
        .eq("user_id", user.id)
        .eq("challenge_id", challenge.id)
        .maybeSingle();

      if (progressError) throw progressError;

      progress = progressData || {
        attempts: 0,
        revealed_clues: 1,
        score: 0,
        status: "in_progress",
        answers: []
      };

      renderHeader();
      renderClues();
      els.card.hidden = false;

      if (progress.status === "won" || progress.status === "lost") {
        await loadTerminalResult();
      } else {
        setTimeout(() => els.answer?.focus(), 80);
      }
    } catch (error) {
      console.error("Desafio Diário:", error);
      els.loading.hidden = true;
      els.unavailable.hidden = false;
      const p = els.unavailable.querySelector("p");
      if (p) p.textContent = "Não foi possível carregar o desafio. Tente novamente.";
    }
  }

  els.form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!challenge || !user || progress?.status !== "in_progress") return;

    const answer = els.answer.value.trim();
    if (!answer) return;

    els.submit.disabled = true;
    els.answer.disabled = true;
    hideFeedback();

    try {
      const { data, error } = await sb.rpc("submit_daily_challenge_answer", {
        p_challenge_id: challenge.id,
        p_answer: answer
      });
      if (error) throw error;

      progress = {
        ...progress,
        attempts: data.attempts,
        revealed_clues: data.revealed_clues,
        score: data.score,
        status: data.status
      };

      renderClues();

      if (data.status === "won" || data.status === "lost") {
        await showResult(data);
      } else {
        showFeedback("Ainda não. A próxima pista foi liberada.", "error");
        els.answer.value = "";
        els.answer.disabled = false;
        els.submit.disabled = false;
        requestAnimationFrame(() => {
          els.clues.lastElementChild?.scrollIntoView({behavior:"smooth", block:"nearest"});
          els.answer.focus();
        });
      }
    } catch (error) {
      console.error("Falha ao enviar resposta:", error);
      showFeedback("Não foi possível enviar sua resposta. Tente novamente.", "error");
      els.answer.disabled = false;
      els.submit.disabled = false;
    }
  });

  load();
})();