import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { requireAuth, requireRole } from "@/lib/server/auth";

const chordSheetInput = z.object({
  section: z.enum(["verse", "chorus", "bridge", "outro"]),
  lyricsWithChords: z.string(),
  instrumentType: z.enum(["guitar", "bass", "keys", "drums", "vocals"]),
});

const updateSongSchema = z
  .object({
    title: z.string().min(1).optional(),
    artist: z.string().min(1).optional(),
    key: z.string().min(1).optional(),
    bpm: z.number().int().min(20).max(300).optional(),
    timeSignature: z.string().optional().nullable(),
    message: z.string().optional().nullable(),
    lyrics: z.string().optional().nullable(),
    tags: z.array(z.string()).optional(),
    chordSheets: z.array(chordSheetInput).optional(),
  })
  .strict();

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  const song = await prisma.song.findUnique({
    where: { id },
    include: {
      chordSheets: { orderBy: [{ section: "asc" }, { instrumentType: "asc" }] },
      arrangements: { include: { chordSheets: { orderBy: [{ section: "asc" }, { instrumentType: "asc" }] } } },
      audioLinks: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!song) return NextResponse.json({ error: "Song not found" }, { status: 404 });
  return NextResponse.json(song);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireRole(requireAuth(req), "admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = updateSongSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;
  const chordSheets = data.chordSheets;
  const { chordSheets: _cs, ...rest } = data;

  try {
    const song = await prisma.$transaction(async (tx) => {
      if (chordSheets) {
        await tx.chordSheet.deleteMany({ where: { songId: id } });
      }
      return tx.song.update({
        where: { id },
        data: {
          ...rest,
          ...(chordSheets
            ? {
                chordSheets: {
                  create: chordSheets.map((c) => ({
                    section: c.section,
                    lyricsWithChords: c.lyricsWithChords,
                    instrumentType: c.instrumentType,
                  })),
                },
              }
            : {}),
        },
        include: { chordSheets: true },
      });
    });
    return NextResponse.json(song);
  } catch {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireRole(requireAuth(req), "admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  try {
    await prisma.song.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }
}

