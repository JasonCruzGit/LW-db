import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma.js";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import songsRoutes from "./routes/songs.js";
import lineupsRoutes from "./routes/lineups.js";
import favoritesRoutes from "./routes/favorites.js";
import metaRoutes from "./routes/meta.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";
const corsAllowList = WEB_ORIGIN.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function corsOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  if (corsAllowList.includes(origin)) return true;
  // Preview / legacy Vercel hostnames (e.g. web-two-jet-81.vercel.app) when using NEXT_PUBLIC_API_URL → Railway
  if (process.env.CORS_ALLOW_VERCEL_APP === "1" && /^https:\/\/[a-zA-Z0-9.-]+\.vercel\.app$/.test(origin)) {
    return true;
  }
  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (process.env.NODE_ENV !== "production") return callback(null, true);
      if (corsOriginAllowed(origin)) return callback(null, true);
      callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

/** Confirms Prisma can reach Postgres (use this when debugging Railway ↔ Supabase). */
app.get("/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: true });
  } catch (e) {
    console.error("[health/db]", e);
    res.status(503).json({
      ok: false,
      db: false,
      error: e instanceof Error ? e.message : "Database unreachable",
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/songs", songsRoutes);
app.use("/api/lineups", lineupsRoutes);
app.use("/api/favorites", favoritesRoutes);
app.use("/api/meta", metaRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

async function start() {
  try {
    await prisma.$connect();
    console.log("Prisma connected to database");
  } catch (e) {
    // Do not exit: Railway would return 502 and hide the app; /health/db surfaces DB errors.
    console.error("WARN: Prisma could not connect at startup — check DATABASE_URL / DIRECT_URL.", e);
  }

  app.listen(PORT, () => {
    console.log(`Worship Team API listening on http://localhost:${PORT}`);
  });
}

void start();
