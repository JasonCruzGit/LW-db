import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export async function POST(req: NextRequest, ctx: { params: Promise<{ songId: string }> }) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { songId } = await ctx.params;
  try {
    await prisma.favoriteSong.create({ data: { userId: auth.sub, songId } });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Already favorited or invalid song" }, { status: 409 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ songId: string }> }) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { songId } = await ctx.params;
  await prisma.favoriteSong.deleteMany({ where: { userId: auth.sub, songId } });
  return new NextResponse(null, { status: 204 });
}

