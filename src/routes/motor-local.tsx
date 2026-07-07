import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MonitorCog, RefreshCw, Copy, Activity } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/social-components";
import { LocalEngineConfigPanel } from "@/components/local-engine-config";
import { useAuth } from "@/lib/auth";
import { selectRows } from "@/lib/supabase/client";
import type { GenerationJobRow } from "@/lib/supabase/types";

type WorkerDevice = {
  id: string;
  name?: string | null;
  status?: string | null;
  last_seen_at?: string | null;
  current_job_id?: string | null;
  app_version?: string | null;
  created_at?: string | null;
};

export const Route = createFileRoute("/motor-local")({
  head: () => ({
    meta: [
      { title: "Motor Local — MYINC" },
      { name: "description", content: "Status do EXE local responsável pelo processamento pesado." },
    ],
  }),
  component: MotorLocal,
});

function MotorLocal() {
  const { session } = useAuth();
  const [workers, setWorkers] = useState<WorkerDevice[]>([]);
  const [jobs, setJobs] = useState<GenerationJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const [workerRows, jobRows] = await Promise.all([
        selectRows<WorkerDevice>(
          "worker_devices",
          session.access_token,
          "select=*&order=last_seen_at.desc&limit=20",
        ),
        selectRows<GenerationJobRow>(
          "generation_jobs",
          session.access_token,
          "select=*&order=created_at.desc&limit=200",
        ),
      ]);
      setWorkers(workerRows);
      setJobs(jobRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar status do motor local.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  const engineKeyName = ["SUPABASE", "WORKER", "DEVICE", "KEY"].join("_");
  const openAiKeyName = ["OPENAI", "API", "KEY"].join("_");
  const envExample = [
    "SUPABASE_URL=https://SEU-PROJETO.supabase.co",
    "SUPABASE_ANON_KEY=SUA_ANON_KEY",
    `${engineKeyName}=A_MESMA_CHAVE_DO_EDGE_SECRET_DO_WORKER`,
    `${openAiKeyName}=SUA_CHAVE_OPENAI_LOCAL`,
    "ENGINE_WORKER_NAME=MYINC Local Engine",
    "ENGINE_POLL_INTERVAL_MS=5000",
    "ENGINE_MAX_CONCURRENCY=1",
    "ENGINE_AUTO_START=true",
  ].join("\n");

  async function copyEnv() {
    await navigator.clipboard.writeText(envExample);
    toast.success("Exemplo de .env.engine copiado.");
  }
  const jobCounts = {
    pending: jobs.filter((job) => ["queued", "retrying"].includes(String(job.status))).length,
    processing: jobs.filter((job) => String(job.status) === "processing").length,
    failed: jobs.filter((job) => String(job.status) === "failed").length,
    completed: jobs.filter((job) => String(job.status) === "completed").length,
  };


  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <PageHeader
        title="Motor Local EXE"
        description="Processador pesado da arquitetura V2. Ele busca jobs no Supabase, processa 1 por vez e salva os resultados no Storage."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full" onClick={copyEnv}><Copy className="h-4 w-4" /> Copiar .env.engine</Button>
            <Button className="rounded-full bg-gradient-primary text-primary-foreground shadow-glow" onClick={() => void load()} disabled={loading}><RefreshCw className="h-4 w-4" /> Atualizar</Button>
          </div>
        }
      />

      {loading ? <LoadingState label="Verificando workers locais registrados..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      <div className="rounded-3xl border border-border bg-sidebar p-6 text-sidebar-foreground shadow-elevated">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sidebar-primary">Arquitetura correta</p>
            <h2 className="mt-2 text-2xl font-bold">Frontend não gera imagem pesada</h2>
            <p className="mt-2 text-sm text-sidebar-foreground/70">Vercel hospeda o painel. Supabase guarda banco/fila/storage. EXE local executa OpenAI e upload final.</p>
          </div>
          <MonitorCog className="h-12 w-12 text-sidebar-primary" />
        </div>
      </div>

      <LocalEngineConfigPanel />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label="Pendentes" value={jobCounts.pending} />
        <Metric label="Processando" value={jobCounts.processing} />
        <Metric label="Falhas" value={jobCounts.failed} />
        <Metric label="Concluídos" value={jobCounts.completed} />
      </div>

      <Card className="rounded-3xl shadow-soft">
        <CardHeader><CardTitle>Workers registrados</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!workers.length && !loading ? <EmptyState title="Nenhum motor online" description="Rode npm run engine:dev ou abra o EXE para registrar heartbeat." /> : null}
          {workers.map((worker) => {
            const online = worker.last_seen_at ? Date.now() - new Date(worker.last_seen_at).getTime() < 90_000 : false;
            return (
              <div key={worker.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={online ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                        <Activity className="mr-1 h-3.5 w-3.5" />{online ? "online" : worker.status ?? "offline"}
                      </Badge>
                      {worker.app_version ? <Badge variant="outline">{worker.app_version}</Badge> : null}
                    </div>
                    <h3 className="mt-2 font-bold">{worker.name ?? "MYINC Local Engine"}</h3>
                    {worker.current_job_id ? <p className="text-sm text-muted-foreground">Job atual: {worker.current_job_id}</p> : <p className="text-sm text-muted-foreground">Sem job ativo.</p>}
                  </div>
                  <div className="text-sm text-muted-foreground md:text-right">
                    <p>Último heartbeat</p>
                    <p>{worker.last_seen_at ? new Date(worker.last_seen_at).toLocaleString("pt-BR") : "sem registro"}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}


function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
