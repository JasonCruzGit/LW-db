/**
 * Normalize Postgres URLs for Supabase + Prisma on hosts like Railway.
 *
 * - Supabase requires TLS from the public internet → sslmode=require
 * - Session pooler uses :5432; Prisma should use **transaction** pooler :5432 → :5432 is wrong for many clouds — use **6543** + pgbouncer
 * @see https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler
 */
export function normalizeDatabaseUrl(raw: string | undefined, role: "database" | "direct"): string | undefined {
  if (!raw?.trim()) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }

  const host = url.hostname.toLowerCase();
  const isSupabase = host.includes("supabase.co") || host.includes("pooler.supabase.com");
  if (!isSupabase) return raw;

  const params = url.searchParams;
  if (!params.has("sslmode")) {
    params.set("sslmode", "require");
  }
  if (!params.has("connect_timeout")) {
    params.set("connect_timeout", "30");
  }

  // Prisma runtime: Supabase *session* pooler (:5432) is often unreachable from Railway; transaction pooler (:6543) works.
  if (role === "database" && host.includes("pooler.supabase.com")) {
    const port = url.port || "5432";
    if (port === "5432") {
      url.port = "6543";
    }
  }

  // Prisma + Supabase transaction pooler (port 6543)
  if (role === "database" && url.port === "6543") {
    if (!params.has("pgbouncer")) params.set("pgbouncer", "true");
    if (!params.has("connection_limit")) params.set("connection_limit", "1");
  }

  return url.toString();
}
