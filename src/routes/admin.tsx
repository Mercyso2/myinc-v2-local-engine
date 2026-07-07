import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Database, Lock, PlusCircle, RadioTower, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ConnectionStatus,
  ErrorState,
  LoadingState,
  PublishLogTable,
} from "@/components/social-components";
import { ReleaseStatusCard } from "@/components/release-status";
import { LocalEngineConfigPanel } from "@/components/local-engine-config";
import { useAuth } from "@/lib/auth";
import { callEdgeFunction, createAdminUser, isSupabaseConfigured } from "@/lib/supabase/client";
import { logRepository } from "@/lib/repositories/log-repository";
import type { SystemLog } from "@/lib/social-types";
import type { SystemLogRow } from "@/lib/supabase/types";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Painel ADM — MYINC" }] }),
  component: Admin,
});

type AdminStatus = {
  ok: boolean;
  admin?: boolean;
  error?: string;
  environment?: Record<string, boolean | string | null>;
  database?: { connected: boolean; tables: Record<string, boolean> };
  storage?: Record<string, boolean>;
  edgeFunctions?: Record<string, boolean>;
};

type SecretField = {
  key: string;
  label: string;
  hint: string;
  sensitive: boolean;
  statusKey?: string;
};

const SECRET_FIELDS: SecretField[] = [
  { key: "OPENAI_API_KEY", label: "OpenAI API Key", hint: "Chave usada pelas Edge Functions de conteúdo (o motor local usa a própria .env.engine).", sensitive: true, statusKey: "openaiApiKey" },
  { key: "OPENAI_TEXT_MODEL", label: "Modelo de texto OpenAI", hint: "Ex.: gpt-4o-mini.", sensitive: false },
  { key: "OPENAI_IMAGE_MODEL", label: "Modelo de imagem OpenAI", hint: "Ex.: gpt-image-1.", sensitive: false },
  { key: "META_PAGE_ACCESS_TOKEN", label: "Meta Page Access Token", hint: "Token de página do Facebook/Instagram Business.", sensitive: true, statusKey: "metaPageAccessToken" },
  { key: "META_PAGE_ID", label: "Meta Page ID", hint: "ID da página do Facebook.", sensitive: false, statusKey: "metaPageId" },
  { key: "META_INSTAGRAM_BUSINESS_ID", label: "Instagram Business ID", hint: "ID da conta comercial do Instagram.", sensitive: false, statusKey: "metaInstagramBusinessId" },
  { key: "META_GRAPH_VERSION", label: "Versão da Graph API", hint: "Ex.: v21.0.", sensitive: false },
  { key: "WORKER_DEVICE_KEY", label: "Worker Device Key", hint: "Chave que o Motor Local usa para autenticar (deve bater com SUPABASE_WORKER_DEVICE_KEY no .env.engine).", sensitive: true, statusKey: "workerKey" },
  { key: "PUBLISH_CRON_SECRET", label: "Publish Cron Secret", hint: "Segredo do cron que dispara a publicação agendada.", sensitive: true, statusKey: "publishCronSecret" },
  { key: "PUBLIC_MEDIA_BASE_URL", label: "URL pública de mídia", hint: "Base HTTPS pública usada para a Meta acessar as imagens/vídeos.", sensitive: false, statusKey: "publicMediaBaseUrl" },
  { key: "CORS_ALLOW_ORIGIN", label: "CORS Allow Origin", hint: "Domínio(s) permitido(s) a chamar as Edge Functions.", sensitive: false },
];

function mapLog(row: SystemLogRow): SystemLog {
  return {
    id: row.id,
    date: new Date(row.created_at).toLocaleString("pt-BR"),
    type: row.module,
    user: row.user_id ?? "sistema",
    module: row.module,
    status: row.status,
    friendlyMessage: row.friendly_message,
    technicalDetail: row.technical_detail ?? "",
    postId: row.post_id ?? undefined,
  };
}

function Admin() {
  const { session } = useAuth();
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const requiredTables = useMemo(
    () => [
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
    ],
    [],
  );

  const loadLogs = useCallback(async () => {
    if (!session) return;
    const rows = await logRepository.list(
      session.access_token,
      "select=*&order=created_at.desc&limit=100",
    );
    setLogs(rows.map(mapLog));
  }, [session]);

  async function testConnections() {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const result = await callEdgeFunction<AdminStatus>("admin-status", session.access_token, {});
      setStatus(result);
      await loadLogs();
      toast.success("Status real atualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao testar conexões reais.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void testConnections();
  }, [session]);

  const env = status?.environment ?? {};
  const tables = status?.database?.tables ?? {};
  const storage = status?.storage ?? {};

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <PageHeader
        title="Painel ADM / Configurações Técnicas"
        description="Status real de Supabase, Edge Functions, OpenAI, Meta, Storage, tabelas, usuários e logs. Segredos nunca são exibidos."
        actions={
          <Button
            className="rounded-full bg-gradient-primary text-primary-foreground"
            disabled={loading}
            onClick={testConnections}
          >
            <ShieldCheck className="h-4 w-4" />
            Testar conexões reais
          </Button>
        }
      />
      {loading ? <LoadingState label="Testando backend real..." /> : null}
      {error ? <ErrorState message={error} /> : null}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="flex gap-3">
          <Lock className="h-5 w-5 text-primary" />
          <p className="text-sm text-muted-foreground">
            <b className="text-foreground">Segurança:</b> tokens não são expostos no frontend. O
            Painel ADM chama admin-status no backend e recebe apenas booleanos/modelos, nunca
            segredos.
          </p>
        </div>
      </div>
      <Tabs defaultValue="chaves" className="space-y-5">
        <TabsList className="flex h-auto flex-wrap justify-start rounded-2xl bg-muted p-1">
          <TabsTrigger value="chaves">Chaves e APIs</TabsTrigger>
          <TabsTrigger value="publicacao">Publicação Meta</TabsTrigger>
          <TabsTrigger value="banco">Banco de dados</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="versao">Versão estável</TabsTrigger>
        </TabsList>
        <TabsContent value="chaves">
          <RuntimeSettingsPanel status={status} onSaved={testConnections} />
          <div className="grid gap-4 md:grid-cols-2">
            <ConnectionStatus
              label="Supabase frontend"
              status={isSupabaseConfigured ? "online" : "offline"}
              detail="Variáveis públicas do Supabase configuradas na Vercel."
            />
            <ConnectionStatus
              label="Supabase backend"
              status={status?.database?.connected ? "online" : "offline"}
              detail="admin-status respondeu usando service role no backend."
            />
            <ConnectionStatus
              label="OpenAI texto"
              status={env.openaiApiKey && env.openaiTextModel ? "online" : "offline"}
              detail={`Modelo: ${env.openaiTextModel ?? "não configurado"}`}
            />
            <ConnectionStatus
              label="OpenAI imagem"
              status={env.openaiApiKey && env.openaiImageModel ? "online" : "offline"}
              detail={`Modelo: ${env.openaiImageModel ?? "não configurado"}`}
            />
          </div>
        </TabsContent>
        <TabsContent value="publicacao">
          <div className="grid gap-4 md:grid-cols-2">
            <ConnectionStatus
              label="Meta token"
              status={env.metaPageAccessToken ? "online" : "offline"}
              detail="Token Meta presente no backend."
            />
            <ConnectionStatus
              label="Instagram Business"
              status={env.metaInstagramBusinessId ? "online" : "offline"}
              detail="Instagram Business configurado."
            />
            <ConnectionStatus
              label="Facebook Page"
              status={env.metaPageId ? "online" : "offline"}
              detail="Página Meta configurada."
            />
            <ConnectionStatus
              label="URL pública HTTPS"
              status={env.publicMediaBaseUrl ? "online" : "offline"}
              detail="Base pública de mídia configurada."
            />
          </div>
          <div className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-soft">
            <h3 className="font-bold">Modos de publicação</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Publicação automática total permanece desabilitada até ser ativada por configuração
              explícita no backend.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Button variant="outline" disabled>
                Manual
              </Button>
              <Button className="bg-gradient-primary text-primary-foreground" disabled>
                Semi-automático
              </Button>
              <Button variant="outline" disabled>
                Automático total bloqueado
              </Button>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="banco">
          <div className="grid gap-4 md:grid-cols-2">
            <ConnectionStatus
              label="Conexão Postgres"
              status={status?.database?.connected ? "online" : "offline"}
              detail="Teste head nas tabelas principais."
            />
            {Object.entries(storage).map(([bucket, ok]) => (
              <ConnectionStatus
                key={bucket}
                label={`Storage ${bucket}`}
                status={ok ? "online" : "offline"}
                detail={
                  bucket === "creative-media"
                    ? "Deve ser público para Meta acessar."
                    : "Bucket esperado."
                }
              />
            ))}
          </div>
          <div className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-soft">
            <h3 className="flex items-center gap-2 font-bold">
              <Database className="h-4 w-4 text-primary" />
              Tabelas obrigatórias
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {requiredTables.map((table) => (
                <span
                  key={table}
                  className={`rounded-full border px-3 py-1 text-xs ${tables[table] ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"}`}
                >
                  {table}
                </span>
              ))}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="usuarios">
          <AdminUsersPanel />
        </TabsContent>
        <TabsContent value="logs">
          <div className="mb-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadLogs()}>
              Atualizar logs
            </Button>
            <Button
              variant="outline"
              onClick={() => navigator.clipboard.writeText(JSON.stringify(logs, null, 2))}
            >
              Copiar JSON
            </Button>
            <Button variant="outline" disabled>
              Limpar logs antigos indisponível
            </Button>
          </div>
          <PublishLogTable logs={logs} />
        </TabsContent>
        <TabsContent value="versao">
          <ReleaseStatusCard
            liveStatus={{
              metaReady: Boolean(
                env.metaPageAccessToken && env.metaInstagramBusinessId && env.metaPageId && env.publicMediaBaseUrl,
              ),
              dbReady: Boolean(status?.database?.connected && requiredTables.every((table) => tables[table])),
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RuntimeSettingsPanel({
  status,
  onSaved,
}: {
  status: AdminStatus | null;
  onSaved: () => Promise<void>;
}) {
  const { session } = useAuth();
  const [values, setValues] = useState<Record<string, string>>({});
  const [customFields, setCustomFields] = useState<{ id: string; name: string; value: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const env = status?.environment ?? {};
  const secretsWriteReady = Boolean(env.secretsWriteConfigured);

  function update(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function addCustomField() {
    setCustomFields((current) => [...current, { id: crypto.randomUUID(), name: "", value: "" }]);
  }

  function updateCustomField(id: string, patch: Partial<{ name: string; value: string }>) {
    setCustomFields((current) => current.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  }

  function removeCustomField(id: string) {
    setCustomFields((current) => current.filter((field) => field.id !== id));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    const custom = Object.fromEntries(
      customFields
        .filter((field) => field.name.trim() && field.value.trim())
        .map((field) => [field.name.trim().toUpperCase().replace(/\s+/g, "_"), field.value.trim()]),
    );
    const secrets = {
      ...Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim().length > 0)),
      ...custom,
    };
    if (!Object.keys(secrets).length) {
      toast.info("Preencha ao menos uma credencial para salvar.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await callEdgeFunction<{ ok: true; saved: string[]; message?: string }>(
        "admin-secrets",
        session.access_token,
        { secrets },
      );
      toast.success(result.message ?? `${result.saved.length} credencial(is) salva(s).`);
      setValues({});
      setCustomFields([]);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar credenciais.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-5 rounded-3xl border border-primary/20 bg-card p-5 shadow-soft">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-bold">Credenciais</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Edite as credenciais reais do backend por aqui. Ao salvar, os valores vão direto para os
            Edge Function Secrets do Supabase via Management API — nunca ficam salvos ou exibidos no navegador.
          </p>
        </div>
        <Button type="button" variant="outline" className="rounded-full" onClick={() => void onSaved()}>
          Revalidar status
        </Button>
      </div>

      {!secretsWriteReady ? (
        <div className="mt-4 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Edição direta ainda não liberada: falta configurar <code>SUPABASE_ACCESS_TOKEN</code> como Edge Secret
          (gere em supabase.com/dashboard/account/tokens). É o único passo manual — depois disso, tudo abaixo
          passa a salvar direto por aqui.
        </div>
      ) : null}
      <div className="mt-4 rounded-2xl border border-border bg-background/60 p-4 text-xs text-muted-foreground">
        <b className="text-foreground">Sobre a URL do banco de dados:</b> <code>SUPABASE_URL</code>,{" "}
        <code>SUPABASE_ANON_KEY</code> e a chave de service role são reservadas pelo próprio
        Supabase e não podem ser sobrescritas por secrets — elas sempre refletem o projeto onde as Edge Functions
        estão implantadas. Para apontar o app para outro projeto/banco Supabase, é preciso redeploy do frontend
        na Vercel com novas variáveis <code>VITE_SUPABASE_URL</code>/<code>VITE_SUPABASE_ANON_KEY</code>; não é
        algo editável em runtime por aqui.
      </div>
      {error ? (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      ) : null}

      <form onSubmit={save} className="mt-5 grid gap-4 md:grid-cols-2">
        {SECRET_FIELDS.map((field) => {
          const configured = field.statusKey ? Boolean(env[field.statusKey]) : undefined;
          return (
            <label key={field.key} className="space-y-1.5">
              <span className="flex items-center gap-2 text-sm font-semibold">
                {field.label}
                {configured !== undefined ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase ${
                      configured ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {configured ? "configurado" : "não configurado"}
                  </span>
                ) : null}
              </span>
              <Input
                type={field.sensitive ? "password" : "text"}
                value={values[field.key] ?? ""}
                onChange={(event) => update(field.key, event.target.value)}
                placeholder={field.sensitive ? "••••••••" : "Digite aqui..."}
              />
              <span className="block text-xs text-muted-foreground">{field.hint}</span>
            </label>
          );
        })}

        <div className="md:col-span-2 space-y-3 rounded-2xl border border-dashed border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <b className="text-sm">Adicionar outra API/credencial</b>
              <p className="text-xs text-muted-foreground">
                Para qualquer chave que não esteja na lista acima (nova integração, API extra etc.).
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={addCustomField}>
              <PlusCircle className="h-4 w-4" /> Adicionar campo
            </Button>
          </div>
          {customFields.map((field) => (
            <div key={field.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={field.name}
                onChange={(event) => updateCustomField(field.id, { name: event.target.value })}
                placeholder="NOME_DA_VARIAVEL (ex.: RESEND_API_KEY)"
                className="sm:w-1/2"
              />
              <Input
                type="password"
                value={field.value}
                onChange={(event) => updateCustomField(field.id, { value: event.target.value })}
                placeholder="Valor"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-destructive"
                onClick={() => removeCustomField(field.id)}
              >
                Remover
              </Button>
            </div>
          ))}
        </div>

        <div className="md:col-span-2">
          <Button
            type="submit"
            disabled={saving || !session}
            className="rounded-full bg-gradient-primary text-primary-foreground"
          >
            {saving ? "Salvando..." : "Salvar credenciais preenchidas"}
          </Button>
        </div>
      </form>

      <div className="mt-5 space-y-2">
        <b className="text-sm">Motor Local</b>
        <p className="text-xs text-muted-foreground">
          A chave OpenAI pesada e o modelo de IA do motor ficam no arquivo <code>.env.engine</code> deste
          computador (nunca passam pelo Supabase). As credenciais acima valem para as Edge Functions e para
          o painel Vercel. Para editar a chave/modelo do motor local, use o painel abaixo (funciona quando
          este painel está aberto dentro do app desktop MYINC).
        </p>
        <LocalEngineConfigPanel />
      </div>
    </div>
  );
}

function AdminUsersPanel() {
  const { session, isLocalFallback } = useAuth();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!session || isLocalFallback) {
      setError("Faça login real no Supabase para criar usuários.");
      return;
    }
    setLoading(true);
    try {
      await createAdminUser(session.access_token, { email, password, fullName, role });
      toast.success("Usuário criado no Auth e app_users.");
      setEmail("");
      setFullName("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar usuário.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <h3 className="text-lg font-bold">Adicionar usuário</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Criação real via Edge Function admin-users.
      </p>
      {error ? (
        <div className="mt-3">
          <ErrorState message={error} />
        </div>
      ) : null}
      <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-semibold">Nome</span>
          <Input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold">E-mail</span>
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold">Credencial inicial</span>
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="mínimo 6 caracteres"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold">Perfil</span>
          <Select value={role} onValueChange={(value) => setRole(value as "admin" | "user")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">Usuário</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <div className="md:col-span-2">
          <Button
            disabled={loading}
            className="rounded-full bg-gradient-primary text-primary-foreground"
          >
            {loading ? "Criando..." : `Criar usuário ${role}`}
          </Button>
        </div>
      </form>
    </div>
  );
}
