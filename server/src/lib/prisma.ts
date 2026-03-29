import { PrismaClient } from "@prisma/client";
import { normalizeDatabaseUrl } from "./db-url.js";

/**
 * Supabase *session* pooler (`pooler.*.supabase.com:5432`) is often unreachable from cloud
 * egress (e.g. Railway → pooler timeouts). A single Node API can use the direct host for Prisma.
 * Keep DIRECT_URL in Railway as the "Direct connection" string from Supabase Connect.
 */
function preferDirectOverSessionPooler(): void {
  const db = process.env.DATABASE_URL ?? "";
  const direct = process.env.DIRECT_URL;
  if (!direct?.trim()) return;
  const looksLikeSessionPooler =
    db.includes("pooler.supabase.com") && (db.includes(":5432/") || db.includes(":5432?") || db.endsWith(":5432"));
  if (looksLikeSessionPooler) {
    process.env.DATABASE_URL = direct;
  }
}

preferDirectOverSessionPooler();

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
