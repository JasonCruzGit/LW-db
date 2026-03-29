import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/auth.js";

const router = Router();

const lineupSongInput = z.object({
  songId: z.string(),
  order: z.number().int().min(0),
  selectedKey: z.string().min(1),
  notes: z.string().optional().nullable(),
});

const createLineupSchema = z.object({
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  songLeaderName: z.string().max(200).optional().nullable(),
  status: z.enum(["draft", "final", "published"]).optional(),
  songs: z.array(lineupSongInput),
});

const updateLineupSchema = z.object({
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  songLeaderName: z.string().max(200).optional().nullable(),
  status: z.enum(["draft", "final", "published"]).optional(),
  songs: z.array(lineupSongInput).optional(),
});

function canManageLineup(role: string) {
  return role === "admin" || role === "song_leader";
}

/** Members without chord charts only see published lineups. */
function memberSeesPublishedOnly(role: string) {
  return role === "musician" || role === "singer";
}

router.use(requireAuth);

router.get("/", async (req: AuthedRequest, res) => {
  const upcoming = req.query.upcoming === "true";
  const history = req.query.history === "true";
  const draftsOnly = req.query.drafts === "true";
  const serviceDate = req.query.date as string | undefined;
  const role = req.user!.role;

  const where: Prisma.LineupWhereInput = {};

  if (serviceDate) {
    where.serviceDate = new Date(serviceDate + "T12:00:00.000Z");
    if (memberSeesPublishedOnly(role)) where.status = "published";
  } else if (draftsOnly && (role === "admin" || role === "song_leader")) {
    where.status = "draft";
    if (role === "song_leader") where.createdById = req.user!.sub;
  } else if (upcoming) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    where.serviceDate = { gte: start };
    where.status = "published";
  } else if (history) {
    where.status = "published";
  } else {
    // Default: musicians only see published; staff see published + their non-published
    if (memberSeesPublishedOnly(role)) {
      where.status = "published";
    } else {
      where.OR = [
        { status: "published" },
        { status: "final" },
        { createdById: req.user!.sub, status: "draft" },
        ...(role === "admin" ? [{ status: "draft" as const }] : []),
      ];
    }
  }

  const lineups = await prisma.lineup.findMany({
    where,
    orderBy: { serviceDate: upcoming ? "asc" : "desc" },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      songs: {
        orderBy: { order: "asc" },
        include: {
          song: {
            include: { chordSheets: true },
          },
        },
      },
    },
    take: upcoming ? 5 : history ? 50 : 100,
  });
  res.json(lineups);
});

router.get("/:id", async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const lineup = await prisma.lineup.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      songs: {
        orderBy: { order: "asc" },
        include: {
          song: {
            include: { chordSheets: true },
          },
        },
      },
    },
  });
  if (!lineup) {
    res.status(404).json({ error: "Lineup not found" });
    return;
  }
  const role = req.user!.role;
  const isOwner = lineup.createdById === req.user!.sub;
  if (memberSeesPublishedOnly(role) && lineup.status !== "published") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (role === "song_leader" && lineup.status === "draft" && !isOwner) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json(lineup);
});

router.post("/", async (req: AuthedRequest, res) => {
  if (!canManageLineup(req.user!.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const parsed = createLineupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { serviceDate, songLeaderName, status, songs } = parsed.data;
  const date = new Date(serviceDate + "T12:00:00.000Z");
  const leader = songLeaderName?.trim() || null;

  const lineup = await prisma.lineup.create({
    data: {
      serviceDate: date,
      songLeaderName: leader,
      createdById: req.user!.sub,
      status: status ?? "draft",
      publishedAt: status === "published" ? new Date() : null,
      songs: {
        create: songs.map((s) => ({
          songId: s.songId,
          order: s.order,
          selectedKey: s.selectedKey,
          notes: s.notes ?? null,
        })),
      },
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      songs: {
        orderBy: { order: "asc" },
        include: { song: { include: { chordSheets: true } } },
      },
    },
  });
  res.status(201).json(lineup);
});

router.patch("/:id", async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  if (!canManageLineup(req.user!.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const parsed = updateLineupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { serviceDate, songLeaderName, status, songs } = parsed.data;

  const existing = await prisma.lineup.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Lineup not found" });
    return;
  }
  if (existing.createdById !== req.user!.sub && req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const data: Prisma.LineupUpdateInput = {};
  if (serviceDate) data.serviceDate = new Date(serviceDate + "T12:00:00.000Z");
  if (songLeaderName !== undefined) {
    data.songLeaderName = songLeaderName?.trim() || null;
  }
  if (status !== undefined) {
    data.status = status;
    if (status === "published") data.publishedAt = new Date();
  }

  if (songs) {
    await prisma.lineupSong.deleteMany({ where: { lineupId: id } });
    data.songs = {
      create: songs.map((s) => ({
        songId: s.songId,
        order: s.order,
        selectedKey: s.selectedKey,
        notes: s.notes ?? null,
      })),
    };
  }

  const lineup = await prisma.lineup.update({
    where: { id },
    data,
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      songs: {
        orderBy: { order: "asc" },
        include: { song: { include: { chordSheets: true } } },
      },
    },
  });
  res.json(lineup);
});

router.post("/:id/publish", async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  if (!canManageLineup(req.user!.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const existing = await prisma.lineup.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Lineup not found" });
    return;
  }
  if (existing.createdById !== req.user!.sub && req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const lineup = await prisma.lineup.update({
    where: { id },
    data: {
      status: "published",
      publishedAt: new Date(),
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      songs: {
        orderBy: { order: "asc" },
        include: { song: { include: { chordSheets: true } } },
      },
    },
  });
  res.json(lineup);
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const existing = await prisma.lineup.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Lineup not found" });
    return;
  }
  if (existing.createdById !== req.user!.sub && req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (existing.status !== "draft" && req.user!.role !== "admin") {
    res.status(400).json({ error: "Only draft lineups can be deleted (or ask admin)" });
    return;
  }
  await prisma.lineup.delete({ where: { id } });
  res.status(204).send();
});

export default router;
