import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

const schema = z.object({
  q: z.string().min(1).max(100),
});

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const url = new URL(req.url);
    const parsed = schema.safeParse({ q: url.searchParams.get("q") ?? "" });
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const q = parsed.data.q.trim();
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, email: true },
      take: 8,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users);
  } catch (e) {
    console.error("[api/users/search]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

