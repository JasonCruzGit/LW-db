import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { requireAuth, requireRole } from "@/lib/server/auth";

const timestampSchema = z.object({
  label: z.string().min(1).max(120),
  timeSeconds: z.number().int().min(0).max(60 * 60 * 6),
});

const updateSchema = z
  .object({
    platform: z.enum(["youtube", "spotify", "other"]).optional(),
    url: z.string().url().optional(),
    label: z.string().max(120).optional().nullable(),
    notes: z.string().max(5000).optional().nullable(),
    timestamps: z.array(timestampSchema).optional().nullable(),
  })
  .strict();

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ audioLinkId: string }> }) {
  const auth = requireRole(requireAuth(req), "admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { audioLinkId } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { timestamps, label, notes, ...rest } = parsed.data;

  const updated = await prisma.audioLink.update({
    where: { id: audioLinkId },
    data: {
      ...rest,
      ...(label !== undefined ? { label: label?.trim() || null } : {}),
      ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
      ...(timestamps !== undefined
        ? { timestamps: timestamps === null ? Prisma.JsonNull : timestamps }
        : {}),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ audioLinkId: string }> }) {
  const auth = requireRole(requireAuth(req), "admin");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { audioLinkId } = await ctx.params;

  await prisma.audioLink.delete({ where: { id: audioLinkId } });
  return new NextResponse(null, { status: 204 });
}

