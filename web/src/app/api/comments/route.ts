import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

const listSchema = z.object({
  entityType: z.enum(["song", "lineup"]),
  entityId: z.string().min(1),
});

const createSchema = z
  .object({
    entityType: z.enum(["song", "lineup"]),
    entityId: z.string().min(1),
    body: z.string().min(1).max(5000),
  })
  .strict();

function extractMentions(body: string): string[] {
  // @email or @name tokens. We'll match to users by email prefix or name.
  const tokens = body
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const raw = tokens
    .filter((t) => t.startsWith("@") && t.length > 1)
    .map((t) => t.slice(1).replace(/[^\w@.+-]/g, "")) // keep email-ish chars
    .filter(Boolean);
  return Array.from(new Set(raw.map((x) => x.toLowerCase())));
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const url = new URL(req.url);
    const parsed = listSchema.safeParse({
      entityType: url.searchParams.get("entityType"),
      entityId: url.searchParams.get("entityId"),
    });
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { entityType, entityId } = parsed.data;
    const comments = await prisma.comment.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { id: true, name: true, email: true } },
        mentions: { select: { userId: true } },
      },
    });
    return NextResponse.json(comments);
  } catch (e) {
    console.error("[api/comments][GET]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    let author = await prisma.user.findUnique({ where: { id: auth.sub }, select: { id: true, email: true } });
    if (!author) {
      // If the JWT is valid but the user row is missing (stale token after DB reset),
      // try to re-create the user so comment posting doesn't 500/401.
      const existingByEmail = auth.email
        ? await prisma.user.findUnique({ where: { email: auth.email.toLowerCase() }, select: { id: true, email: true } })
        : null;
      if (existingByEmail) {
        return NextResponse.json({ error: "Unauthorized (please log out/in again)." }, { status: 401 });
      }
      if (!auth.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      author = await prisma.user.create({
        data: {
          id: auth.sub,
          email: auth.email.toLowerCase(),
          name: auth.email.split("@")[0] || "User",
          role: auth.role,
          passwordHash: await bcrypt.hash(globalThis.crypto?.randomUUID?.() ?? String(Date.now()), 10),
        },
        select: { id: true, email: true },
      });
    }

    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { entityType, entityId, body: text } = parsed.data;
    const handles = extractMentions(text);

    const users = handles.length
      ? await prisma.user.findMany({
          where: {
            OR: handles.flatMap((h) => [
              { email: { startsWith: h, mode: "insensitive" } },
              { name: { contains: h, mode: "insensitive" } },
            ]),
          },
          select: { id: true },
          take: 10,
        })
      : [];

    const comment = await prisma.comment.create({
      data: {
        entityType,
        entityId,
        body: text,
        authorId: author.id,
        mentions: users.length ? { create: users.map((u) => ({ userId: u.id })) } : undefined,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
        mentions: { select: { userId: true, readAt: true } },
      },
    });
    return NextResponse.json(comment, { status: 201 });
  } catch (e) {
    console.error("[api/comments][POST]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

