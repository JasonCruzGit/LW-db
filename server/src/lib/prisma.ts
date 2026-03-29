import { PrismaClient } from "@prisma/client";
import { normalizeDatabaseUrl } from "./db-url.js";

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
