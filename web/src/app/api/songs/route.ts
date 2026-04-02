import type { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { requireAuth, requireRole } from "@/lib/server/auth";

const chordSheetInput = z.object({
  section: z.enum(["verse", "chorus", "bridge", "outro"]),
  lyricsWithChords: z.string(),
  instrumentType: z.enum(["guitar", "bass", "keys", "drums", "vocals"]),
});

const audioLinkInput = z.object({
  platform: z.enum(["youtube", "spotify", "other"]),
  url: z.string().min(1),
  label: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
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
  audioLinks: z.array(audioLinkInput).default([]),
});

const updateSongSchema = createSongSchema.partial();

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? undefined;
    const key = url.searchParams.get("key") ?? undefined;
    const bpmMin = url.searchParams.get("bpmMin") ? Number(url.searchParams.get("bpmMin")) : undefined;
    const bpmMax = url.searchParams.get("bpmMax") ? Number(url.searchParams.get("bpmMax")) : undefined;
    const tags = url.searchParams.get("tags")
      ? String(url.searchParams.get("tags"))
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    const sort = url.searchParams.get("sort") || "recent";

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
    if (tags.length) where.tags = { hasEvery: tags };

    let orderBy: Prisma.SongOrderByWithRelationInput = { createdAt: "desc" };
    if (sort === "alpha") orderBy = { title: "asc" };
    if (sort === "bpm") orderBy = { bpm: "asc" };

    const songs = await prisma.song.findMany({
      where,
      orderBy,
      include: {
        chordSheets: { orderBy: [{ section: "asc" }, { instrumentType: "asc" }] },
        audioLinks: { take: 1, orderBy: { createdAt: "desc" } },
      },
    });
    return NextResponse.json(songs);
  } catch (e) {
    console.error("[api/songs][GET]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireRole(requireAuth(req), "admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const parsed = createSongSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { chordSheets, audioLinks, ...rest } = parsed.data;
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
      ...(audioLinks.length
        ? {
            audioLinks: {
              create: audioLinks.map((a) => ({
                platform: a.platform,
                url: a.url,
                label: a.label ?? null,
                notes: a.notes ?? null,
              })),
            },
          }
        : {}),
    },
    include: { chordSheets: true, audioLinks: { orderBy: { createdAt: "desc" } } },
  });
  return NextResponse.json(song, { status: 201 });
}

