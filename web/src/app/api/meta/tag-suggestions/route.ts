import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { requireAuth } from "@/lib/server/auth";

const inputSchema = z
  .object({
    text: z.string().max(20000),
    limit: z.number().int().min(1).max(20).optional(),
  })
  .strict();

const KEYWORDS: Array<{ tag: string; words: string[] }> = [
  { tag: "communion", words: ["communion", "table", "bread", "cup", "wine", "remember", "body", "blood"] },
  { tag: "baptism", words: ["baptism", "water", "buried", "raised", "new life"] },
  { tag: "resurrection", words: ["resurrection", "risen", "empty tomb", "alive", "grave"] },
  { tag: "advent", words: ["advent", "wait", "come", "promise", "manger"] },
  { tag: "christmas", words: ["christmas", "noel", "bethlehem", "manger", "born"] },
  { tag: "easter", words: ["easter", "risen", "cross", "calvary", "empty tomb"] },
  { tag: "praise", words: ["praise", "hallelujah", "worship", "glory"] },
  { tag: "confession", words: ["confess", "forgive", "mercy", "repent"] },
  { tag: "mission", words: ["mission", "nations", "go", "send", "gospel"] },
];

function scoreSuggestions(text: string): Array<{ tag: string; score: number }> {
  const t = text.toLowerCase();
  return KEYWORDS.map(({ tag, words }) => {
    let score = 0;
    for (const w of words) {
      if (!w) continue;
      if (t.includes(w)) score += 1;
    }
    return { tag, score };
  }).filter((x) => x.score > 0);
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { text, limit = 8 } = parsed.data;
  const scored = scoreSuggestions(text).sort((a, b) => b.score - a.score);

  // Prefer existing tags already used in DB (helps keep taxonomy consistent).
  const existing = await prisma.song.findMany({
    select: { tags: true },
    take: 200,
    orderBy: { createdAt: "desc" },
  });
  const known = new Set(existing.flatMap((s) => s.tags.map((x) => x.toLowerCase())));

  const suggestions = scored
    .map((s) => s.tag)
    .filter((t) => !known.size || known.has(t.toLowerCase()) || true)
    .slice(0, limit);

  return NextResponse.json({ suggestions });
}

