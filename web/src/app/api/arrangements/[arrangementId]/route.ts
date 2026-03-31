import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { requireAuth, requireRole } from "@/lib/server/auth";

const sheetSchema = z.object({
  section: z.enum(["verse", "chorus", "bridge", "outro"]),
  instrumentType: z.enum(["guitar", "bass", "keys", "drums", "vocals"]),
  lyricsWithChords: z.string(),
});

const updateSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    key: z.string().min(1).max(10).optional(),
    bpm: z.number().int().min(20).max(300).optional(),
    timeSignature: z.string().optional().nullable(),
    message: z.string().optional().nullable(),
    lyrics: z.string().optional().nullable(),
    structure: z.string().optional().nullable(),
    chordSheets: z.array(sheetSchema).optional(),
  })
  .strict();

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ arrangementId: string }> }) {
  const auth = requireRole(requireAuth(req), "admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { arrangementId } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;
  const chordSheets = data.chordSheets;
  const { chordSheets: _cs, ...rest } = data;

  const updated = await prisma.$transaction(async (tx) => {
    if (chordSheets) {
      await tx.arrangementChordSheet.deleteMany({ where: { arrangementId } });
    }
    return tx.songArrangement.update({
      where: { id: arrangementId },
      data: {
        ...rest,
        ...(data.timeSignature !== undefined ? { timeSignature: data.timeSignature?.trim() || null } : {}),
        ...(data.message !== undefined ? { message: data.message?.trim() || null } : {}),
        ...(data.lyrics !== undefined ? { lyrics: data.lyrics?.trim() || null } : {}),
        ...(data.structure !== undefined ? { structure: data.structure?.trim() || null } : {}),
        ...(chordSheets
          ? {
              chordSheets: {
                create: chordSheets
                  .filter((c) => c.lyricsWithChords.trim())
                  .map((c) => ({
                    section: c.section,
                    instrumentType: c.instrumentType,
                    lyricsWithChords: c.lyricsWithChords,
                  })),
              },
            }
          : {}),
      },
      include: { chordSheets: true },
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ arrangementId: string }> }) {
  const auth = requireRole(requireAuth(req), "admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { arrangementId } = await ctx.params;

  await prisma.songArrangement.delete({ where: { id: arrangementId } });
  return new NextResponse(null, { status: 204 });
}

