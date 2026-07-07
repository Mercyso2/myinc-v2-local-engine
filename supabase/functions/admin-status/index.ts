import {
  err,
  json,
  okOptions,
  requireUser,
  serviceClient,
} from "../_shared/v2-utils.ts";

function hasEnv(name: string) {
  return Boolean((Deno.env.get(name) || "").trim());
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function tableExists(
  supabase: ReturnType<typeof serviceClient>,
  table: string,
) {
  const { error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });
  return !error;
}

async function checkBuckets(supabase: ReturnType<typeof serviceClient>, names: string[]) {
  const { data, error } = await supabase.storage.listBuckets();
  if (error || !data) return Object.fromEntries(names.map((name) => [name, false]));
  const existing = new Set(data.map((bucket) => bucket.name));
  return Object.fromEntries(names.map((name) => [name, existing.has(name)]));
}

// Ping real via OPTIONS usando o service role como bearer: confirma que a
// function está de fato deployada e respondendo, não apenas "assumida".
async function checkEdgeFunctionDeployed(supabaseUrl: string, serviceRoleKey: string, name: string) {
  try {
    const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/${name}`, {
      method: "OPTIONS",
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    }, 5000);
    return response.status < 500 && response.status !== 404;
  } catch {
    return false;
  }
}

async function checkOpenAI(apiKey: string) {
  if (!apiKey) return false;
  try {
    const response = await fetchWithTimeout("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    }, 6000);
    return response.ok;
  } catch {
    return false;
  }
}

async function checkMetaToken(token: string, graphVersion: string) {
  if (!token) return false;
  try {
    const response = await fetchWithTimeout(
      `https://graph.facebook.com/${graphVersion}/me?fields=id&access_token=${encodeURIComponent(token)}`,
      {},
      6000,
    );
    return response.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return okOptions(req);
  try {
    await requireUser(req);
    const supabase = serviceClient();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const graphVersion = Deno.env.get("META_GRAPH_VERSION") || "v21.0";

    const requiredTables = [
      "app_users",
      "brands",
      "brand_profiles",
      "posts",
      "monthly_plans",
      "post_ideas",
      "media_assets",
      "library_items",
      "publish_queue",
      "system_logs",
    ];
    const requiredBuckets = ["creative-media", "brand-assets", "library"];
    const requiredFunctions = [
      "enqueue-generation",
      "engine-register-worker",
      "engine-save-result",
      "publish-meta",
      "publish-scheduled-posts",
    ];

    const [tablePairs, storage, openaiOk, metaOk, functionPairs] = await Promise.all([
      Promise.all(requiredTables.map(async (table) => [table, await tableExists(supabase, table)] as const)),
      checkBuckets(supabase, requiredBuckets),
      checkOpenAI(Deno.env.get("OPENAI_API_KEY") || ""),
      checkMetaToken(Deno.env.get("META_PAGE_ACCESS_TOKEN") || "", graphVersion),
      Promise.all(requiredFunctions.map(async (name) => [name, await checkEdgeFunctionDeployed(supabaseUrl, serviceRoleKey, name)] as const)),
    ]);

    const tables = Object.fromEntries(tablePairs);
    const databaseConnected = Object.values(tables).some(Boolean);
    const edgeFunctions = Object.fromEntries(functionPairs);

    return json(req, {
      ok: true,
      admin: true,
      environment: {
        supabaseBackend: databaseConnected,
        serviceRole: Boolean(serviceRoleKey) && databaseConnected,
        openaiApiKey: openaiOk,
        openaiTextModel: Deno.env.get("OPENAI_TEXT_MODEL") || "gpt-4o-mini",
        openaiImageModel: Deno.env.get("OPENAI_IMAGE_MODEL") || "gpt-image-1",
        metaPageAccessToken: metaOk,
        metaPageId: hasEnv("META_PAGE_ID"),
        metaInstagramBusinessId: hasEnv("META_INSTAGRAM_BUSINESS_ID"),
        workerKey: hasEnv("WORKER_DEVICE_KEY") || hasEnv("SUPABASE_WORKER_DEVICE_KEY"),
        publishCronSecret: hasEnv("PUBLISH_CRON_SECRET"),
        publicMediaBaseUrl: Deno.env.get("PUBLIC_MEDIA_BASE_URL") || null,
        corsAllowOrigin: Deno.env.get("CORS_ALLOW_ORIGIN") || "*",
        secretsWriteConfigured: hasEnv("SUPABASE_ACCESS_TOKEN"),
      },
      database: { connected: databaseConnected, tables },
      storage,
      edgeFunctions,
      message: databaseConnected
        ? "Status real validado: banco, storage, funções, OpenAI e Meta testados de verdade."
        : "Supabase respondeu, mas as tabelas principais ainda não foram encontradas.",
    });
  } catch (error) {
    return err(req, error, 500);
  }
});
