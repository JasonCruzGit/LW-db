import { PrismaClient } from "@prisma/client";

// Supabase (and many managed Postgres hosts) require SSL from external connections.
// Append `sslmode=require` in production if not already present.
function dbUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || process.env.NODE_ENV !== "production") return url;
  return url.includes("sslmode") ? url : url + (url.includes("?") ? "&" : "?") + "sslmode=require";
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: { db: { url: dbUrl() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
