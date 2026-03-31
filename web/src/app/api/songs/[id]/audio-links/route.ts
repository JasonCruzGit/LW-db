import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { requireAuth, requireRole } from "@/lib/server/auth";

const timestampSchema = z.object({
  label: z.string().min(1).max(120),
  timeSeconds: z.number().int().min(0).max(60 * 60 * 6),
});

const createSchema = z
  .object({
    platform: z.enum(["youtube", "spotify", "other"]),
    url: z.string().url(),
    label: z.string().max(120).optional().nullable(),
    notes: z.string().max(5000).optional().nullable(),
    timestamps: z.array(timestampSchema).optional().nullable(),
  })
  .strict();

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id: songId } = await ctx.params;

  const list = await prisma.audioLink.findMany({
    where: { songId },
    orderBy: { createdAt: "desc" },
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

  const created = await prisma.audioLink.create({
    data: {
      songId,
      platform: parsed.data.platform,
      url: parsed.data.url,
      label: parsed.data.label?.trim() || null,
      notes: parsed.data.notes?.trim() || null,
      timestamps: parsed.data.timestamps ?? undefined,
    },
  });
  return NextResponse.json(created, { status: 201 });
}

