const SUPABASE_URL = "https://sxdsfklllilhdyuamvvg.supabase.co";
const SUPABASE_KEY = "sb_publishable_AQ5-Pn1knmBhSFyt5aMtjQ_XQynLJ_L";

// Limit image-signing pressure during an outage. Never retry writes here.
window.LuriaNetwork = (() => {
  const nativeFetch = window.fetch.bind(window);
  const waiting = [];
  let active = 0;
  let failures = 0;
  let retryAfter = 0;
  const readRpcs = new Set([
    "get_my_entitlements", "is_admin", "is_admin_session",
    "my_studyrats_challenges_v3", "admin_question_factory_snapshot",
    "admin_question_factory_block_tracker", "admin_question_factory_quality_snapshot",
    "admin_question_factory_block_flow_snapshot"
  ]);

  function unavailable() {
    return new Error("Serviço de imagens temporariamente indisponível. Tente novamente em alguns segundos.");
  }

  function acquire(signal) {
    if (signal?.aborted) return Promise.reject(signal.reason);
    if (Date.now() < retryAfter || waiting.length >= 100) return Promise.reject(unavailable());
    if (active < 3) { active += 1; return Promise.resolve(); }
    return new Promise((resolve, reject) => {
      const item = { resolve, reject, signal, abort: null };
      item.abort = () => {
        const index = waiting.indexOf(item);
        if (index >= 0) waiting.splice(index, 1);
        reject(signal.reason);
      };
      signal?.addEventListener("abort", item.abort, { once: true });
      waiting.push(item);
    });
  }

  function release() {
    active -= 1;
    while (waiting.length) {
      const item = waiting.shift();
      item.signal?.removeEventListener("abort", item.abort);
      if (Date.now() < retryAfter) { item.reject(unavailable()); continue; }
      active += 1;
      item.resolve();
      break;
    }
  }

  async function guardedFetch(input, init = {}) {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (url.origin !== SUPABASE_URL) return nativeFetch(input, init);
    const method = String(init.method || input.method || "GET").toUpperCase();
    const signing = method === "POST" && url.pathname.startsWith("/storage/v1/object/sign/");
    const read = (url.pathname.startsWith("/rest/v1/") && (method === "GET" || method === "HEAD"))
      || (url.pathname.startsWith("/rest/v1/rpc/") && readRpcs.has(url.pathname.split("/").pop()));
    // Uploads, mutations and long-running Edge Functions keep their own semantics.
    if (!signing && (!read || url.pathname.startsWith("/functions/v1/"))) return nativeFetch(input, init);
    const parentSignal = init.signal || input.signal;
    const controller = new AbortController();
    const onAbort = () => controller.abort(parentSignal.reason);
    if (parentSignal?.aborted) onAbort();
    else parentSignal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(new DOMException("O servidor demorou para responder. Tente novamente.", "TimeoutError")), 15000);
    let acquired = false;
    try {
      if (signing) { await acquire(controller.signal); acquired = true; }
      const response = await nativeFetch(input, { ...init, signal: controller.signal });
      if (signing) {
        if (response.status === 429 || response.status >= 500) {
          failures += 1;
          if (failures >= 3) retryAfter = Date.now() + 15000;
        } else if (response.ok) failures = 0;
        // Keep the slot and timeout until the small signing response is consumed.
        const body = await response.arrayBuffer();
        return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
      }
      return response;
    } catch (error) {
      if (signing && acquired && !parentSignal?.aborted) {
        failures += 1;
        if (failures >= 3) retryAfter = Date.now() + 15000;
      }
      throw error;
    } finally {
      clearTimeout(timer);
      parentSignal?.removeEventListener("abort", onAbort);
      if (acquired) release();
    }
  }
  return { fetch: guardedFetch };
})();

window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    global: { fetch: window.LuriaNetwork.fetch },
    auth: {
      experimental: {
        passkey: true
      }
    }
  }
);
