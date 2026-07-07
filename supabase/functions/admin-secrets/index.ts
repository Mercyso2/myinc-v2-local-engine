import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { err, json, okOptions, readJson, requireUser, safeString, serviceClient } from "../_shared/v2-utils.ts";

// Sessão local de desenvolvimento (motor/desktop) sempre conta como admin.
const LOCAL_ADMIN_ID = "local-mauricio-admin";

// Nomes reservados pelo próprio Supabase: são injetados automaticamente em
// toda Edge Function e a Management API recusa sobrescrevê-los (o projeto
// sempre aponta para si mesmo). Trocar "a URL do banco" de verdade exige
// redeploy do frontend na Vercel com novas VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY,
// não é algo que uma secret de Edge Function possa mudar.
const RESERVED_NAMES = new Set([
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DB_URL",
  "SUPABASE_JWT_SECRET",
]);

// Nome de variável de ambiente válido: letras maiúsculas, números e "_",
// não pode começar com número.
const VALID_NAME = /^[A-Z_][A-Z0-9_]*$/;

async function requireAdmin(req: Request, supabase: ReturnType<typeof serviceClient>) {
  const user = await requireUser(req);
  if (user.id === LOCAL_ADMIN_ID) return user;
  const { data } = await supabase
    .from("app_users")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!data || data.role !== "admin") {
    throw new Error("Apenas administradores podem editar credenciais.");
  }
  return user;
}

function projectRefFromUrl(url: string) {
  const match = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (!match) {
    throw new Error("Não foi possível identificar o project ref a partir de SUPABASE_URL.");
  }
  return match[1];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return okOptions(req);
  const supabase = serviceClient();
  try {
    await requireAdmin(req, supabase);
    const body = (await readJson(req)) as Record<string, unknown>;
    const rawSecrets =
      body.secrets && typeof body.secrets === "object" ? (body.secrets as Record<string, unknown>) : {};

    const candidates = Object.entries(rawSecrets)
      .map(([name, value]) => [name.trim().toUpperCase(), safeString(value)] as const)
      .filter(([, value]) => value.length > 0);

    const reserved = candidates.filter(([name]) => RESERVED_NAMES.has(name));
    if (reserved.length) {
      throw new Error(
        `${reserved.map(([name]) => name).join(", ")} não pode ser alterado por aqui: é reservado pelo próprio Supabase e sempre reflete o projeto onde as Edge Functions estão implantadas. Para apontar o app para outro projeto/banco, redeploy o frontend na Vercel com novas VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.`,
      );
    }

    const invalidNames = candidates.filter(([name]) => !VALID_NAME.test(name));
    if (invalidNames.length) {
      throw new Error(
        `Nome(s) de credencial inválido(s): ${invalidNames.map(([name]) => name).join(", ")}. Use apenas letras maiúsculas, números e "_", sem começar com número.`,
      );
    }

    const entries = candidates;
    if (!entries.length) {
      throw new Error("Nenhuma credencial válida enviada para salvar.");
    }

    const accessToken = Deno.env.get("SUPABASE_ACCESS_TOKEN");
    if (!accessToken) {
      throw new Error(
        "SUPABASE_ACCESS_TOKEN não configurado. Gere um Personal Access Token em supabase.com/dashboard/account/tokens, adicione como Edge Secret uma única vez (Supabase Studio → Edge Functions → Secrets) e tente novamente. Esse é o único passo manual necessário; depois disso todas as outras credenciais podem ser editadas por aqui.",
      );
    }
    const projectRef =
      Deno.env.get("SUPABASE_PROJECT_REF") || projectRefFromUrl(Deno.env.get("SUPABASE_URL") || "");

    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/secrets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(entries.map(([name, value]) => ({ name, value }))),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        `Supabase Management API recusou a escrita (HTTP ${response.status}): ${JSON.stringify(data).slice(0, 500)}`,
      );
    }

    return json(req, {
      ok: true,
      saved: entries.map(([name]) => name),
      message: `${entries.length} credencial(is) salva(s) direto nos Edge Function Secrets. Pode levar alguns segundos para propagar nas próximas invocações.`,
    });
  } catch (error) {
    return err(req, error, 500);
  }
});
