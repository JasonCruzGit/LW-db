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

const updateLineupSchema = z.object({
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  songLeaderName: z.string().max(200).optional().nullable(),
  changeNote: z.string().max(10000).optional().nullable(),
  status: z.enum(["draft", "final", "published"]).optional(),
  audience: z.enum(["team_all", "musicians_only"]).optional(),
  songs: z.array(lineupSongInput).optional(),
});

function canManageLineup(role: string) {
  return role === "admin" || role === "song_leader" || role === "musician" || role === "singer";
}
function memberSeesPublishedOnly(role: string) {
  return role === "musician" || role === "singer";
}

function roleCanViewLineup(role: string, audience: string): boolean {
  if (audience === "musicians_only") {
    return role === "musician" || role === "admin" || role === "song_leader";
  }
  return true;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  const lineup = await prisma.lineup.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      songs: {
        orderBy: { order: "asc" },
        include: {
          song: {
            include: {
              chordSheets: true,
              audioLinks: { take: 1, orderBy: { createdAt: "desc" } },
            },
          },
        },
      },
    },
  });
  if (!lineup) return NextResponse.json({ error: "Lineup not found" }, { status: 404 });

  const role = auth.role;
  const isOwner = lineup.createdById === auth.sub;
  if (!roleCanViewLineup(role, (lineup as any).audience)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (memberSeesPublishedOnly(role) && lineup.status !== "published") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (role === "song_leader" && lineup.status === "draft" && !isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(lineup);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!canManageLineup(auth.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = updateLineupSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.lineup.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Lineup not found" }, { status: 404 });
  if (existing.createdById !== auth.sub && auth.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { serviceDate, songLeaderName, changeNote, status, songs, audience } = parsed.data;
  const data: Prisma.LineupUpdateInput = {};
  if (serviceDate) data.serviceDate = new Date(serviceDate + "T12:00:00.000Z");
  if (songLeaderName !== undefined) data.songLeaderName = songLeaderName?.trim() || null;
  if (changeNote !== undefined) data.changeNote = changeNote?.trim() || null;
  if (status !== undefined) {
    data.status = status;
    if (status === "published") data.publishedAt = new Date();
  }
  if (audience !== undefined) {
    // Musicians can only create/edit musicians-only setlists.
    if (auth.role === "musician" && audience !== "musicians_only")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    data.audience = audience;
  }
  if (songs) {
    await prisma.lineupSong.deleteMany({ where: { lineupId: id } });
    data.songs = {
      create: songs.map((s) => ({
        songId: s.songId,
        order: s.order,
        selectedKey: s.selectedKey,
        notes: s.notes ?? null,
      })),
    };
  }

  const lineup = await prisma.lineup.update({
    where: { id },
    data,
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      songs: {
        orderBy: { order: "asc" },
        include: {
          song: {
            include: {
              chordSheets: true,
              audioLinks: { take: 1, orderBy: { createdAt: "desc" } },
            },
          },
        },
      },
    },
  });
  return NextResponse.json(lineup);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  const existing = await prisma.lineup.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Lineup not found" }, { status: 404 });
  if (existing.createdById !== auth.sub && auth.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (existing.status !== "draft" && auth.role !== "admin")
    return NextResponse.json({ error: "Only draft lineups can be deleted (or ask admin)" }, { status: 400 });
  await prisma.lineup.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}

