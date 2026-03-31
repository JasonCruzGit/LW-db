import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { requireAuth, requireRole } from "@/lib/server/auth";

const createSchema = z
  .object({
    name: z.string().min(1).max(120),
    key: z.string().min(1).max(10),
    bpm: z.number().int().min(20).max(300),
    timeSignature: z.string().optional().nullable(),
    message: z.string().optional().nullable(),
    lyrics: z.string().optional().nullable(),
    structure: z.string().optional().nullable(),
    chordSheets: z
      .array(
        z.object({
          section: z.enum(["verse", "chorus", "bridge", "outro"]),
          instrumentType: z.enum(["guitar", "bass", "keys", "drums", "vocals"]),
          lyricsWithChords: z.string(),
        })
      )
      .optional(),
  })
  .strict();

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id: songId } = await ctx.params;

  const list = await prisma.songArrangement.findMany({
    where: { songId },
    orderBy: { createdAt: "desc" },
    include: { chordSheets: { orderBy: [{ section: "asc" }, { instrumentType: "asc" }] } },
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireRole(requireAuth(req), "admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id: songId } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { chordSheets, ...rest } = parsed.data;
  const created = await prisma.songArrangement.create({
    data: {
      songId,
      ...rest,
      timeSignature: rest.timeSignature?.trim() || null,
      message: rest.message?.trim() || null,
      lyrics: rest.lyrics?.trim() || null,
      structure: rest.structure?.trim() || null,
      chordSheets: chordSheets
        ? {
            create: chordSheets
              .filter((c) => c.lyricsWithChords.trim())
              .map((c) => ({
                section: c.section,
                instrumentType: c.instrumentType,
                lyricsWithChords: c.lyricsWithChords,
              })),
          }
        : undefined,
    },
    include: { chordSheets: true },
  });
  return NextResponse.json(created, { status: 201 });
}

