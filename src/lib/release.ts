export const APP_RELEASE = {
  name: "MYINC Social Media AI",
  version: "v2.0.0-local-engine",
  channel: "production-candidate",
  label: "Arquitetura V2 Local Engine",
  date: "2026-06-15",
  githubTag: "v2.0.0-local-engine",
  description:
    "Versão V2 em 3 camadas: frontend controla, Supabase organiza fila/storage/logs, Motor Local EXE executa geração pesada e publicador Edge cuida apenas de mídia pronta.",
} as const;

// `checkable` marca as áreas em que dá para checar estado real em runtime
// (ver ReleaseStatusCard). As demais são apenas notas de arquitetura/design —
// não fingem um teste que não foi feito, por isso não recebem bolinha verde.
export const STABILITY_GATES = [
  {
    area: "Segurança",
    checkable: false,
    detail:
      "Segredos ficam em variáveis de ambiente/server-side e campos sensíveis são mascarados no Painel ADM.",
  },
  {
    area: "Publicação Meta",
    checkable: true,
    detail:
      "Publicação real só ocorre após validação de token, IDs, aprovação do post e URL pública HTTPS.",
  },
  {
    area: "Fluxo editorial",
    checkable: false,
    detail:
      "Planejamento, produção, revisão, comentários, calendário e fila estão conectados por estados consistentes.",
  },
  {
    area: "Banco de dados",
    checkable: true,
    detail: "Migração Supabase/Postgres inclui as tabelas principais e índices de operação.",
  },
  {
    area: "Build",
    checkable: false,
    detail: "Versão validada com lint, build e captura visual da central no momento do deploy.",
  },
] as const;

export const REQUIRED_ENV_GROUPS = [
  { group: "Frontend público", keys: ["URL pública do Supabase", "chave anon pública", "URL do app", "ambiente"] },
  { group: "Edge Secrets", keys: ["chave service role", "chave do worker", "segredo do cron", "credenciais Meta"] },
  { group: "Motor Local", keys: ["URL Supabase", "chave anon", "chave do worker", "chave OpenAI local"] },
] as const;
