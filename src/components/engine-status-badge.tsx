import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { selectRows } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const ONLINE_THRESHOLD_MS = 90_000;
const POLL_MS = 30_000;

type WorkerDeviceRow = { last_seen_at?: string | null };

export function EngineStatusBadge({ compact = false }: { compact?: boolean }) {
  const { session } = useAuth();
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    async function check() {
      try {
        const [worker] = await selectRows<WorkerDeviceRow>(
          "worker_devices",
          session!.access_token,
          "select=last_seen_at&order=last_seen_at.desc&limit=1",
        );
        if (cancelled) return;
        const isOnline = Boolean(
          worker?.last_seen_at &&
            Date.now() - new Date(worker.last_seen_at).getTime() < ONLINE_THRESHOLD_MS,
        );
        setOnline(isOnline);
      } catch {
        if (!cancelled) setOnline(null);
      }
    }

    void check();
    const timer = window.setInterval(() => void check(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [session]);

  const label = online === null ? "verificando" : online ? "motor online" : "motor offline";
  const dotColor = online === null ? "bg-muted-foreground/40" : online ? "bg-success" : "bg-destructive";

  return (
    <Link
      to="/motor-local"
      title={label}
      className={cn(
        "flex items-center gap-2 rounded-full border border-sidebar-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-sidebar-accent",
        compact ? "justify-center" : "",
      )}
    >
      <span className="relative flex h-2 w-2">
        {online ? (
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", dotColor)} />
        ) : null}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", dotColor)} />
      </span>
      <Activity className="h-3.5 w-3.5 text-sidebar-foreground/70" />
      {!compact ? <span className="text-sidebar-foreground/70">{label}</span> : null}
    </Link>
  );
}
