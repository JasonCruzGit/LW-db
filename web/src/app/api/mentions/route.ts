import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const onlyUnread = new URL(req.url).searchParams.get("unread") === "true";

  const mentions = await prisma.commentMention.findMany({
    where: { userId: auth.sub, ...(onlyUnread ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      comment: {
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  return NextResponse.json(
    mentions.map((m) => ({
      id: m.id,
      readAt: m.readAt,
      createdAt: m.createdAt,
      comment: m.comment,
    }))
  );
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Mark all as read (simple v1).
  await prisma.commentMention.updateMany({
    where: { userId: auth.sub, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

