import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (req: AuthedRequest, res) => {
  const favorites = await prisma.favoriteSong.findMany({
    where: { userId: req.user!.sub },
    orderBy: { createdAt: "desc" },
    include: {
      song: {
        include: { chordSheets: true },
      },
    },
  });
  res.json(favorites.map((f) => f.song));
});

router.post("/:songId", async (req: AuthedRequest, res) => {
  const songId = String(req.params.songId);
  try {
    await prisma.favoriteSong.create({
      data: {
        userId: req.user!.sub,
        songId,
      },
    });
    res.status(201).json({ ok: true });
  } catch {
    res.status(409).json({ error: "Already favorited or invalid song" });
  }
});

router.delete("/:songId", async (req: AuthedRequest, res) => {
  const songId = String(req.params.songId);
  await prisma.favoriteSong.deleteMany({
    where: {
      userId: req.user!.sub,
      songId,
    },
  });
  res.status(204).send();
});

export default router;
