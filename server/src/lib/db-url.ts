/**
 * Normalize Postgres URLs for Supabase + Prisma on hosts like Railway.
 *
 * - Supabase requires TLS from the public internet → sslmode=require
 * - Transaction pooler (port 6543) needs pgbouncer=true + connection_limit=1 for Prisma
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

  // Prisma + Supabase transaction pooler (port 6543)
  if (role === "database" && url.port === "6543") {
    if (!params.has("pgbouncer")) params.set("pgbouncer", "true");
    if (!params.has("connection_limit")) params.set("connection_limit", "1");
  }

  return url.toString();
}
