import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const favorites = await prisma.favoriteSong.findMany({
    where: { userId: auth.sub },
    orderBy: { createdAt: "desc" },
    include: { song: { include: { chordSheets: true } } },
  });
  return NextResponse.json(favorites.map((f) => f.song));
}

