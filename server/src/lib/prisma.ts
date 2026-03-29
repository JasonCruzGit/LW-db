import { PrismaClient } from "@prisma/client";
import { normalizeDatabaseUrl } from "./db-url.js";

/**
 * If DATABASE_URL points at `db.<ref>.supabase.co:5432` (direct) and Railway cannot reach it,
 * set SUPABASE_POOLER_HOST from Supabase Connect (e.g. `aws-1-ap-southeast-1.pooler.supabase.com`)
 * so we can use the transaction pooler on :6543 with the same password.
 */
function coerceDirectUrlToTransactionPooler(): void {
  const raw = process.env.DATABASE_URL;
  const poolerHost = process.env.SUPABASE_POOLER_HOST?.trim();
  if (!raw?.trim() || !poolerHost) return;

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return;
  }

  const h = u.hostname.toLowerCase();
  if (!h.startsWith("db.") || !h.endsWith(".supabase.co")) return;
  const port = u.port || "5432";
  if (port !== "5432") return;

  const projectRef = h.slice("db.".length, -".supabase.co".length);
  const pass = u.password;
  if (!pass) return;

  u.protocol = "postgresql:";
  u.username = `postgres.${projectRef}`;
  u.password = pass;
  u.hostname = poolerHost;
  u.port = "6543";
  u.pathname = u.pathname || "/postgres";

  process.env.DATABASE_URL = u.toString();
}

coerceDirectUrlToTransactionPooler();

// Prisma reads DATABASE_URL / DIRECT_URL from env; normalize before first Client init.
if (process.env.DATABASE_URL) {
  const n = normalizeDatabaseUrl(process.env.DATABASE_URL, "database");
  if (n) process.env.DATABASE_URL = n;
}
if (process.env.DIRECT_URL) {
  const n = normalizeDatabaseUrl(process.env.DIRECT_URL, "direct");
  if (n) process.env.DIRECT_URL = n;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
