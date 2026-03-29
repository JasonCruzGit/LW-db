import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

/** Distinct keys and tags from songs for filter UI */
router.get("/song-filters", async (_req, res) => {
  const songs = await prisma.song.findMany({
    select: { key: true, tags: true, bpm: true },
  });
  const keys = [...new Set(songs.map((s) => s.key))].sort();
  const tags = [...new Set(songs.flatMap((s) => s.tags))].sort();
  const bpmMin = songs.length ? Math.min(...songs.map((s) => s.bpm)) : 60;
  const bpmMax = songs.length ? Math.max(...songs.map((s) => s.bpm)) : 180;
  res.json({ keys, tags, bpmMin, bpmMax });
});

/** Songs that appeared in recent published lineups (setlist history proxy) */
router.get("/recent-songs", async (_req, res) => {
  const rows = await prisma.lineupSong.findMany({
    where: { lineup: { status: "published", publishedAt: { not: null } } },
    orderBy: [{ lineup: { publishedAt: "desc" } }, { order: "asc" }],
    take: 80,
    include: {
      song: { include: { chordSheets: true } },
    },
  });
  const seen = new Set<string>();
  const songs: typeof rows[number]["song"][] = [];
  for (const r of rows) {
    if (!seen.has(r.songId)) {
      seen.add(r.songId);
      songs.push(r.song);
    }
    if (songs.length >= 12) break;
  }
  res.json(songs);
});

export default router;
