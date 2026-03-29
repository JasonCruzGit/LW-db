import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import songsRoutes from "./routes/songs.js";
import lineupsRoutes from "./routes/lineups.js";
import favoritesRoutes from "./routes/favorites.js";
import metaRoutes from "./routes/meta.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";
const corsOrigins =
  process.env.NODE_ENV === "production"
    ? WEB_ORIGIN
    : Array.from(
        new Set([WEB_ORIGIN, "http://localhost:3000", "http://127.0.0.1:3000"])
      );

app.use(
  cors({
    // In dev, reflect any request origin (localhost vs 127.0.0.1, file, alternate ports).
    origin: process.env.NODE_ENV === "production" ? corsOrigins : true,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
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

app.listen(PORT, () => {
  console.log(`Worship Team API listening on http://localhost:${PORT}`);
});
