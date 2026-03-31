import type { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

const lineupSongInput = z.object({
  songId: z.string(),
  order: z.number().int().min(0),
  selectedKey: z.string().min(1),
  notes: z.string().optional().nullable(),
});

const createLineupSchema = z.object({
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  songLeaderName: z.string().max(200).optional().nullable(),
  changeNote: z.string().max(10000).optional().nullable(),
  status: z.enum(["draft", "final", "published"]).optional(),
  audience: z.enum(["team_all", "musicians_only"]).optional(),
  songs: z.array(lineupSongInput),
});

function canManageLineup(role: string) {
  return role === "admin" || role === "song_leader" || role === "musician" || role === "singer";
}
function memberSeesPublishedOnly(role: string) {
  return role === "musician" || role === "singer";
}

function audienceFilterForRole(role: string): Prisma.LineupWhereInput | undefined {
  if (role === "singer") return { audience: "team_all" };
  if (role === "musician") return { audience: { in: ["team_all", "musicians_only"] } };
  return undefined;
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const upcoming = url.searchParams.get("upcoming") === "true";
  const history = url.searchParams.get("history") === "true";
  const draftsOnly = url.searchParams.get("drafts") === "true";
  const serviceDate = url.searchParams.get("date") ?? undefined;
  const role = auth.role;

  const where: Prisma.LineupWhereInput = {};
  if (serviceDate) {
    where.serviceDate = new Date(serviceDate + "T12:00:00.000Z");
    if (memberSeesPublishedOnly(role)) where.status = "published";
    const aud = audienceFilterForRole(role);
    if (aud) Object.assign(where, aud);
  } else if (draftsOnly && (role === "admin" || role === "song_leader")) {
    where.status = "draft";
    if (role === "song_leader") where.createdById = auth.sub;
  } else if (upcoming) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    where.serviceDate = { gte: start };
    where.status = "published";
    where.audience = "team_all";
  } else if (history) {
    where.status = "published";
    const aud = audienceFilterForRole(role);
    if (aud) Object.assign(where, aud);
  } else {
    if (memberSeesPublishedOnly(role)) {
      where.status = "published";
      const aud = audienceFilterForRole(role);
      if (aud) Object.assign(where, aud);
    } else {
      where.OR = [
        { status: "published", audience: "team_all" },
        { status: "final", audience: "team_all" },
        { createdById: auth.sub, status: "draft" },
        ...(role === "admin" ? [{ status: "draft" as const }] : []),
      ];
    }
  }

  const lineups = await prisma.lineup.findMany({
    where,
    orderBy: { serviceDate: upcoming ? "asc" : "desc" },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      songs: {
        orderBy: { order: "asc" },
        include: { song: { include: { chordSheets: true } } },
      },
    },
    take: upcoming ? 5 : history ? 50 : 100,
  });
  return NextResponse.json(lineups);
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!canManageLineup(auth.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = createLineupSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { serviceDate, songLeaderName, changeNote, status, songs, audience } = parsed.data;
  const date = new Date(serviceDate + "T12:00:00.000Z");
  const leader = songLeaderName?.trim() || null;
  const note = changeNote?.trim() || null;

  const aud =
    auth.role === "musician"
      ? "musicians_only"
      : audience ?? "team_all";

  const lineup = await prisma.lineup.create({
    data: {
      serviceDate: date,
      songLeaderName: leader,
      changeNote: note,
      createdById: auth.sub,
      status: status ?? "draft",
      audience: aud,
      publishedAt: status === "published" ? new Date() : null,
      songs: {
        create: songs.map((s) => ({
          songId: s.songId,
          order: s.order,
          selectedKey: s.selectedKey,
          notes: s.notes ?? null,
        })),
      },
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      songs: { orderBy: { order: "asc" }, include: { song: { include: { chordSheets: true } } } },
    },
  });
  return NextResponse.json(lineup, { status: 201 });
}

