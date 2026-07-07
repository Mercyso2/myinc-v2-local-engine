import { useCallback, useEffect, useState } from "react";
import { MonitorCog, PauseCircle, PlayCircle, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState, LoadingState } from "@/components/social-components";
import {
  getEngineConfig,
  getEngineStatus,
  isDesktopApp,
  pauseEngine,
  resumeEngine,
  restartEngine,
  saveEngineConfig,
  type LocalEngineConfig,
  type LocalEngineStatus,
} from "@/lib/local-engine-bridge";

type Field = {
  key: string;
  label: string;
  hint: string;
  sensitive: boolean;
  kind?: "text" | "select" | "toggle";
  options?: string[];
};

const FIELDS: Field[] = [
  { key: "OPENAI_API_KEY", label: "OpenAI API Key (motor local)", hint: "Chave usada apenas neste computador para gerar imagens/vídeos/texto.", sensitive: true },
  { key: "OPENAI_TEXT_MODEL", label: "Modelo de texto", hint: "Ex.: gpt-4o-mini.", sensitive: false },
  { key: "OPENAI_IMAGE_MODEL", label: "Modelo de imagem", hint: "Ex.: gpt-image-1.", sensitive: false },
  { key: "OPENAI_IMAGE_QUALITY", label: "Qualidade de imagem", hint: "", sensitive: false, kind: "select", options: ["high", "medium", "low"] },
  { key: "CREATIVE_COST_MODE", label: "Modo de custo", hint: "balanced ou economy.", sensitive: false, kind: "select", options: ["balanced", "economy"] },
  { key: "OPENAI_VIDEO_MODEL", label: "Modelo de vídeo", hint: "Ex.: sora-2.", sensitive: false },
  { key: "ENGINE_WORKER_NAME", label: "Nome deste motor", hint: "Aparece no painel Motor Local.", sensitive: false },
  { key: "ENGINE_POLL_INTERVAL_MS", label: "Intervalo de verificação (ms)", hint: "Padrão: 5000.", sensitive: false },
  { key: "SUPABASE_WORKER_DEVICE_KEY", label: "Worker Device Key", hint: "Deve ser igual ao WORKER_DEVICE_KEY salvo no Painel ADM.", sensitive: true },
];

export function LocalEngineConfigPanel() {
  const desktop = isDesktopApp();
  const [config, setConfig] = useState<LocalEngineConfig>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<LocalEngineStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!desktop) return;
    setLoading(true);
    setError("");
    try {
      const [cfg, st] = await Promise.all([getEngineConfig(), getEngineStatus()]);
      setConfig(cfg);
      setStatus(st);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao ler configuração do motor local.");
    } finally {
      setLoading(false);
    }
  }, [desktop]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!desktop) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-start gap-3">
          <MonitorCog className="mt-1 h-6 w-6 text-primary" />
          <div>
            <h3 className="text-xl font-bold">Configuração do motor local</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Editar a chave OpenAI, o modelo de IA e os demais parâmetros do motor local só é
              possível dentro do app desktop MYINC (o EXE), porque o arquivo <code>.env.engine</code>{" "}
              vive no computador onde o motor roda — não neste navegador. Abra o app desktop para
              configurar por aqui mesmo, ou edite o arquivo <code>.env.engine</code> manualmente na
              pasta de instalação.
            </p>
          </div>
        </div>
      </div>
    );
  }

  function update(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    const patch = Object.fromEntries(
      Object.entries(values).filter(([, value]) => value.trim().length > 0),
    );
    if (!Object.keys(patch).length) {
      toast.info("Preencha ao menos um campo para salvar.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveEngineConfig(patch);
      await restartEngine();
      toast.success("Configuração salva e motor local reiniciado.");
      setValues({});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar configuração do motor local.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleRunning() {
    try {
      if (status?.running) {
        await pauseEngine();
        toast.success("Motor local pausado.");
      } else {
        await resumeEngine();
        toast.success("Motor local retomado.");
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao alterar o motor local.");
    }
  }

  return (
    <div className="rounded-3xl border border-primary/20 bg-card p-6 shadow-soft">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <MonitorCog className="mt-1 h-6 w-6 text-primary" />
          <div>
            <h3 className="text-xl font-bold">Configuração do motor local</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Edite a chave OpenAI, o modelo de IA e os demais parâmetros direto por aqui. Ao salvar,
              o arquivo <code>.env.engine</code> deste computador é atualizado e o motor reinicia
              sozinho.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => void load()}>
            <RotateCw className="h-4 w-4" /> Atualizar
          </Button>
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => void toggleRunning()}>
            {status?.running ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
            {status?.running ? "Pausar" : "Retomar"}
          </Button>
        </div>
      </div>

      {loading ? <LoadingState label="Lendo .env.engine..." /> : null}
      {error ? (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      ) : null}

      {status ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Status atual: <b className="text-foreground">{status.status ?? (status.running ? "online" : "parado")}</b>
          {status.workerName ? ` · ${status.workerName}` : ""}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {FIELDS.map((field) => {
          const current = config[field.key];
          return (
            <label key={field.key} className="space-y-1.5">
              <span className="flex items-center gap-2 text-sm font-semibold">
                {field.label}
                {current ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase ${
                      current.configured ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {current.configured ? "configurado" : "não configurado"}
                  </span>
                ) : null}
              </span>
              {field.kind === "select" ? (
                <Select
                  value={values[field.key] ?? current?.value ?? ""}
                  onValueChange={(value) => update(field.key, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={field.sensitive ? "password" : "text"}
                  value={values[field.key] ?? (field.sensitive ? "" : (current?.value ?? ""))}
                  onChange={(event) => update(field.key, event.target.value)}
                  placeholder={field.sensitive ? "••••••••" : "Digite aqui..."}
                />
              )}
              {field.hint ? <span className="block text-xs text-muted-foreground">{field.hint}</span> : null}
            </label>
          );
        })}
      </div>

      <Button
        className="mt-5 rounded-full bg-gradient-primary text-primary-foreground"
        disabled={saving}
        onClick={() => void save()}
      >
        {saving ? "Salvando..." : "Salvar e reiniciar motor local"}
      </Button>
    </div>
  );
}
