import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";

const router = Router();

const chordSheetInput = z.object({
  section: z.enum(["verse", "chorus", "bridge", "outro"]),
  lyricsWithChords: z.string(),
  instrumentType: z.enum(["guitar", "bass", "keys"]),
});

const createSongSchema = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  key: z.string().min(1),
  bpm: z.number().int().min(20).max(300),
  timeSignature: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  lyrics: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  chordSheets: z.array(chordSheetInput).default([]),
});

const updateSongSchema = createSongSchema.partial();

router.use(requireAuth);

router.get("/", async (req, res) => {
  const q = req.query.q as string | undefined;
  const key = req.query.key as string | undefined;
  const bpmMin = req.query.bpmMin ? Number(req.query.bpmMin) : undefined;
  const bpmMax = req.query.bpmMax ? Number(req.query.bpmMax) : undefined;
  const tags = req.query.tags
    ? String(req.query.tags)
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  const sort = (req.query.sort as string) || "recent";

  const where: Prisma.SongWhereInput = {};

  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { title: { contains: term, mode: "insensitive" } },
      { artist: { contains: term, mode: "insensitive" } },
      { message: { contains: term, mode: "insensitive" } },
      { lyrics: { contains: term, mode: "insensitive" } },
    ];
  }
  if (key) where.key = key;
  const bpmFilter: { gte?: number; lte?: number } = {};
  if (bpmMin !== undefined && !Number.isNaN(bpmMin)) bpmFilter.gte = bpmMin;
  if (bpmMax !== undefined && !Number.isNaN(bpmMax)) bpmFilter.lte = bpmMax;
  if (Object.keys(bpmFilter).length) where.bpm = bpmFilter;
  if (tags.length) {
    where.tags = { hasEvery: tags };
  }

  let orderBy: Prisma.SongOrderByWithRelationInput = { createdAt: "desc" };
  if (sort === "alpha") orderBy = { title: "asc" };
  if (sort === "bpm") orderBy = { bpm: "asc" };

  const songs = await prisma.song.findMany({
    where,
    orderBy,
    include: {
      chordSheets: { orderBy: [{ section: "asc" }, { instrumentType: "asc" }] },
    },
  });
  res.json(songs);
});

router.get("/:id", async (req, res) => {
  const id = String(req.params.id);
  const song = await prisma.song.findUnique({
    where: { id },
    include: {
      chordSheets: { orderBy: [{ section: "asc" }, { instrumentType: "asc" }] },
    },
  });
  if (!song) {
    res.status(404).json({ error: "Song not found" });
    return;
  }
  res.json(song);
});

router.post("/", requireRole("admin"), async (req: AuthedRequest, res) => {
  const parsed = createSongSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { chordSheets, ...rest } = parsed.data;
  const song = await prisma.song.create({
    data: {
      ...rest,
      chordSheets: {
        create: chordSheets.map((c) => ({
          section: c.section,
          lyricsWithChords: c.lyricsWithChords,
          instrumentType: c.instrumentType,
        })),
      },
    },
    include: { chordSheets: true },
  });
  res.status(201).json(song);
});

router.patch("/:id", requireRole("admin"), async (req, res) => {
  const id = String(req.params.id);
  const parsed = updateSongSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { chordSheets, ...rawFields } = parsed.data;
  const fields = Object.fromEntries(
    Object.entries(rawFields).filter(([, v]) => v !== undefined)
  ) as typeof rawFields;

  try {
    if (chordSheets !== undefined) {
      const song = await prisma.$transaction(async (tx) => {
        await tx.chordSheet.deleteMany({ where: { songId: id } });
        return tx.song.update({
          where: { id },
          data: {
            ...fields,
            chordSheets: {
              create: chordSheets.map((c) => ({
                section: c.section,
                lyricsWithChords: c.lyricsWithChords,
                instrumentType: c.instrumentType,
              })),
            },
          },
          include: { chordSheets: true },
        });
      });
      res.json(song);
      return;
    }
    const song = await prisma.song.update({
      where: { id },
      data: fields,
      include: { chordSheets: true },
    });
    res.json(song);
  } catch {
    res.status(404).json({ error: "Song not found" });
  }
});

router.delete("/:id", requireRole("admin"), async (req, res) => {
  const id = String(req.params.id);
  try {
    await prisma.song.delete({ where: { id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: "Song not found" });
  }
});

export default router;
