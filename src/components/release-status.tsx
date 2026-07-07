import { BadgeCheck, GitBranch, ShieldCheck } from "lucide-react";
import { APP_RELEASE, STABILITY_GATES } from "@/lib/release";
import { cn } from "@/lib/utils";

export function ReleaseBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-primary",
        compact && "px-2 py-0.5 text-[0.65rem]",
      )}
      title={`${APP_RELEASE.label} ${APP_RELEASE.version}`}
    >
      <BadgeCheck className="h-3.5 w-3.5" />
      {compact ? APP_RELEASE.version : `${APP_RELEASE.label} ${APP_RELEASE.version}`}
    </span>
  );
}

export function ReleaseStatusCard({
  liveStatus,
}: {
  /** Estado real por área "checkable" (undefined = ainda não verificado). */
  liveStatus?: { metaReady?: boolean; dbReady?: boolean };
}) {
  function resolveDot(area: string): { className: string; title: string } {
    if (area === "Publicação Meta" && liveStatus?.metaReady !== undefined) {
      return liveStatus.metaReady
        ? { className: "bg-success", title: "Credenciais Meta configuradas" }
        : { className: "bg-destructive", title: "Faltam credenciais Meta" };
    }
    if (area === "Banco de dados" && liveStatus?.dbReady !== undefined) {
      return liveStatus.dbReady
        ? { className: "bg-success", title: "Banco conectado e tabelas presentes" }
        : { className: "bg-destructive", title: "Banco sem conexão ou tabela ausente" };
    }
    return { className: "bg-muted-foreground/40", title: "Nota de arquitetura, não é um teste em tempo real" };
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
      <div className="border-b border-border bg-sidebar p-6 text-sidebar-foreground">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sidebar-primary">
              Release atual
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              {APP_RELEASE.name} {APP_RELEASE.version}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-sidebar-foreground/65">
              {APP_RELEASE.description}
            </p>
          </div>
          <ReleaseBadge />
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-sidebar-foreground/70">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1">
            <GitBranch className="h-3.5 w-3.5 text-sidebar-primary" />
            Tag sugerida: {APP_RELEASE.githubTag}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1">
            <ShieldCheck className="h-3.5 w-3.5 text-sidebar-primary" />
            Canal: {APP_RELEASE.channel}
          </span>
        </div>
      </div>
      <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-5">
        {STABILITY_GATES.map((gate) => {
          const dot = resolveDot(gate.area);
          return (
            <div key={gate.area} className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", dot.className)} title={dot.title} />
                <p className="text-sm font-bold">{gate.area}</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{gate.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
