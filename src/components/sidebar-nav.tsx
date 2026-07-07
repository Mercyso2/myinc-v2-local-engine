import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Sparkles,
  Brain,
  Images,
  CalendarDays,
  Settings,
  ClipboardList,
  ScrollText,
} from "lucide-react";
import { MyIncLogo } from "@/components/myinc-logo";
import { ReleaseBadge } from "@/components/release-status";
import { EngineStatusBadge } from "@/components/engine-status-badge";
import { cn } from "@/lib/utils";

export const navItems = [
  { title: "Painel", url: "/", icon: LayoutDashboard, exact: true },
  { title: "Planejamento", url: "/planejamento", icon: ClipboardList },
  { title: "Estúdio Criativo", url: "/conteudos", icon: Sparkles },
  { title: "Calendário", url: "/calendario", icon: CalendarDays },
  { title: "Fila V2", url: "/fila-v2", icon: ClipboardList },
  { title: "Motor Local", url: "/motor-local", icon: Settings },
  { title: "Cérebro da IA", url: "/cerebro-ia", icon: Brain, highlight: true },
  { title: "Biblioteca", url: "/biblioteca", icon: Images },
  { title: "Memória da Marca", url: "/configuracoes", icon: Settings },
  { title: "Configurações Técnicas", url: "/admin", icon: Settings },
  { title: "Logs", url: "/logs", icon: ScrollText },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center justify-between gap-2 px-6">
        <MyIncLogo variant="white" className="h-7" />
      </div>

      <div className="px-4 pb-2">
        <EngineStatusBadge />
      </div>

      <div className="px-4 pb-2 pt-3">
        <p className="px-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/40">
          Plataforma
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const active = isActive(item.url, item.exact);
          return (
            <Link
              key={item.url}
              to={item.url}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-sidebar-primary/15 text-sidebar-foreground"
                  : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
              )}
              <item.icon
                className={cn(
                  "h-[18px] w-[18px] transition-colors",
                  active
                    ? "text-sidebar-primary"
                    : "text-sidebar-foreground/55 group-hover:text-sidebar-foreground",
                )}
              />
              <span>{item.title}</span>
              {item.highlight && (
                <span className="ml-auto rounded-full bg-sidebar-primary/20 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-sidebar-primary">
                  IA
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="m-3 rounded-2xl bg-sidebar-accent/60 p-4">
        <div className="flex items-center gap-2 text-sidebar-primary">
          <Sparkles className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Plano Premium</span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-sidebar-foreground/55">
          Automação criativa com qualidade de agência.
        </p>
        <div className="mt-3">
          <ReleaseBadge compact />
        </div>
      </div>
    </div>
  );
}
