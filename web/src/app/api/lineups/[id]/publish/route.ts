import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

function canManageLineup(role: string) {
  return role === "admin" || role === "song_leader" || role === "musician" || role === "singer";
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!canManageLineup(auth.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const existing = await prisma.lineup.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Lineup not found" }, { status: 404 });
  if (existing.createdById !== auth.sub && auth.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const lineup = await prisma.lineup.update({
    where: { id },
    data: { status: "published", publishedAt: new Date() },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      songs: { orderBy: { order: "asc" }, include: { song: { include: { chordSheets: true } } } },
    },
  });
  return NextResponse.json(lineup);
}

