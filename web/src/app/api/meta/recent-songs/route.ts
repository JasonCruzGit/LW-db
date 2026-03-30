import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rows = await prisma.lineupSong.findMany({
    where: { lineup: { status: "published", publishedAt: { not: null } } },
    orderBy: [{ lineup: { publishedAt: "desc" } }, { order: "asc" }],
    take: 80,
    include: { song: { include: { chordSheets: true } } },
  });

  const seen = new Set<string>();
  const songs: typeof rows[number]["song"][] = [];
  for (const r of rows) {
    if (!seen.has(r.songId)) {
      seen.add(r.songId);
      songs.push(r.song);
    }
    if (songs.length >= 12) break;
  }
  return NextResponse.json(songs);
}

