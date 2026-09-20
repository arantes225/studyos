/*
  LURIA Storage Router
  -----------------------------------------------------------
  Centraliza upload, leitura e remoção de arquivos.
  Hoje todas as rotas apontam para o Supabase principal.
  No futuro cada categoria pode usar outro provider sem
  reescrever as páginas.

  Referência legada:
    user-id/errors/file.webp

  Referência multi-provider:
    luria-storage://provider/bucket/user-id/path/file.webp

  Nunca exponha service_role/secret key no frontend.
*/
(function () {
  "use strict";

  const PREFIX = "luria-storage://";
  const providers = new Map();
  const routes = {
    error_images: { provider: "main", bucket: "docmap" },
    flashcard_images: { provider: "main", bucket: "docmap" },
    question_assets: { provider: "main", bucket: "docmap" },
    notebook_images: { provider: "main", bucket: "docmap" },
    generic: { provider: "main", bucket: "docmap" }
  };

  providers.set("main", {
    type: "supabase",
    getClient: () => window.supabaseClient || null
  });

  function clean(value) {
    return String(value || "").trim().replace(/^\/+|\/+$/g, "");
  }

  function encodeReference({ provider, bucket, path }) {
    const p = clean(provider);
    const b = clean(bucket);
    const objectPath = String(path || "").replace(/^\/+/, "");

    if (p === "main") return objectPath;

    return PREFIX
      + encodeURIComponent(p)
      + "/"
      + encodeURIComponent(b)
      + "/"
      + objectPath;
  }

  function parseEncodedReference(reference) {
    const raw = String(reference || "");
    if (!raw.startsWith(PREFIX)) return null;

    const parts = raw.slice(PREFIX.length).split("/");
    if (parts.length < 3) return null;

    const provider = decodeURIComponent(parts.shift());
    const bucket = decodeURIComponent(parts.shift());
    const path = parts.join("/");

    if (!provider || !bucket || !path) return null;
    return { provider, bucket, path };
  }

  function routeConfig(name) {
    return routes[name] || routes.generic;
  }

  function resolveReference(routeName, reference) {
    const encoded = parseEncodedReference(reference);
    if (encoded) return encoded;

    const route = routeConfig(routeName);
    return {
      provider: route.provider,
      bucket: route.bucket,
      path: String(reference || "")
    };
  }

  function providerClient(name) {
    const provider = providers.get(name);

    if (!provider) {
      throw new Error(`Storage provider "${name}" não configurado.`);
    }

    if (provider.type !== "supabase") {
      throw new Error(`Provider "${name}" não usa cliente Supabase direto.`);
    }

    const client = provider.getClient
      ? provider.getClient()
      : provider.client;

    if (!client) {
      throw new Error(`Cliente do storage "${name}" indisponível.`);
    }

    return client;
  }

  async function upload(routeName, path, file, options = {}) {
    const route = routeConfig(routeName);
    const client = providerClient(route.provider);

    const result = await client
      .storage
      .from(route.bucket)
      .upload(path, file, options);

    return {
      ...result,
      reference: result.error
        ? null
        : encodeReference({
            provider: route.provider,
            bucket: route.bucket,
            path: result.data?.path || path
          }),
      provider: route.provider,
      bucket: route.bucket
    };
  }

  async function createSignedUrl(routeName, reference, expiresIn = 3600) {
    const resolved = resolveReference(routeName, reference);
    return providerClient(resolved.provider)
      .storage
      .from(resolved.bucket)
      .createSignedUrl(resolved.path, expiresIn);
  }

  async function download(routeName, reference) {
    const resolved = resolveReference(routeName, reference);
    return providerClient(resolved.provider)
      .storage
      .from(resolved.bucket)
      .download(resolved.path);
  }

  async function remove(routeName, references) {
    const values = (Array.isArray(references) ? references : [references])
      .filter(Boolean);

    if (!values.length) return { data: [], error: null };

    const groups = new Map();

    for (const reference of values) {
      const resolved = resolveReference(routeName, reference);
      const key = `${resolved.provider}::${resolved.bucket}`;

      if (!groups.has(key)) {
        groups.set(key, {
          provider: resolved.provider,
          bucket: resolved.bucket,
          paths: []
        });
      }

      groups.get(key).paths.push(resolved.path);
    }

    const removed = [];

    for (const group of groups.values()) {
      const result = await providerClient(group.provider)
        .storage
        .from(group.bucket)
        .remove(group.paths);

      if (result.error) {
        return { data: removed, error: result.error };
      }

      removed.push(...(result.data || []));
    }

    return { data: removed, error: null };
  }

  function configureRoute(routeName, config) {
    if (!routeName || !config?.provider || !config?.bucket) {
      throw new Error("Rota de storage inválida.");
    }

    routes[routeName] = {
      provider: config.provider,
      bucket: config.bucket
    };
  }

  function registerSupabaseProvider(name, clientOrGetter) {
    if (!name) throw new Error("Nome do provider obrigatório.");

    providers.set(name, {
      type: "supabase",
      ...(typeof clientOrGetter === "function"
        ? { getClient: clientOrGetter }
        : { client: clientOrGetter })
    });
  }

  window.LuriaStorage = {
    upload,
    download,
    remove,
    createSignedUrl,
    resolveReference,
    encodeReference,
    configureRoute,
    registerSupabaseProvider,
    routes,
    version: "1.0.0"
  };
})();
