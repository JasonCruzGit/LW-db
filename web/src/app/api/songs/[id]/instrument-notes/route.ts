import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

const listSchema = z.object({
  instrument: z.enum(["guitar", "bass", "keys", "drums", "vocals"]).optional(),
});

const upsertSchema = z
  .object({
    instrument: z.enum(["guitar", "bass", "keys", "drums", "vocals"]),
    body: z.string().max(10000),
  })
  .strict();

function canEdit(role: string) {
  return role === "admin" || role === "song_leader" || role === "musician" || role === "singer";
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: songId } = await ctx.params;
  const url = new URL(req.url);
  const parsed = listSchema.safeParse({ instrument: url.searchParams.get("instrument") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const where = parsed.data.instrument ? { songId, instrument: parsed.data.instrument } : { songId };
  const items = await prisma.songInstrumentNote.findMany({
    where,
    orderBy: { instrument: "asc" },
  });
  return NextResponse.json(items);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!canEdit(auth.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: songId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { instrument, body: text } = parsed.data;
  const trimmed = text.trim();
  if (!trimmed) {
    await prisma.songInstrumentNote.deleteMany({ where: { songId, instrument } });
    return new NextResponse(null, { status: 204 });
  }

  const note = await prisma.songInstrumentNote.upsert({
    where: { songId_instrument: { songId, instrument } },
    update: { body: trimmed },
    create: { songId, instrument, body: trimmed },
  });
  return NextResponse.json(note);
}

