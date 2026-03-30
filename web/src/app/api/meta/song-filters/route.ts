import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const songs = await prisma.song.findMany({ select: { key: true, tags: true, bpm: true } });
  const keys = [...new Set(songs.map((s) => s.key))].sort();
  const tags = [...new Set(songs.flatMap((s) => s.tags))].sort();
  const bpmMin = songs.length ? Math.min(...songs.map((s) => s.bpm)) : 60;
  const bpmMax = songs.length ? Math.max(...songs.map((s) => s.bpm)) : 180;
  return NextResponse.json({ keys, tags, bpmMin, bpmMax });
}

